import { writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * 販売者8実ルート受け入れ（plans/layout-design/priority-eight-seller-residual-design-system-plan.md）の準備。
 *
 * 前提: 専用DBへ `bunx prisma migrate deploy` と `bun run seed:e2e` を実行済み。
 * seed を再実行すると店舗の所有者が seed ユーザーへ戻るため、本スクリプトはその後に毎回実行する。
 *
 * 1. DATABASE_URL / DIRECT_URL / E2E_DATABASE_URL が同値で、ローカルの専用DB（名前に e2e/test を含み、
 *    multivendor_dev ではない）を指すことを検査する。アプリ・seed・本スクリプトが別DBを見る事故を防ぐ。
 * 2. Clerk dev に `+clerk_test` の販売者を作成または再利用し、privateMetadata.role を SELLER にする
 *    （seller layout は DB ではなく Clerk の metadata で判定する）。
 * 3. Clerk ID の User へ seed 店舗を付け替え、注文・会話・国別配送料率を冪等に投入する。
 *
 * 使い方: bun scripts/design/prepare-seller-route.ts <output.json>
 */

const SELLER_EMAIL = "design-seller+clerk_test@example.com";
const BUYER_EMAIL = "design-buyer@example.com";
const STORE_URL = "e2e-store-chromium-w0";
const OTHER_STORE_URL = "e2e-store-b-chromium-w0";

const output = process.argv[2];
if (!output) {
    throw new Error("Usage: bun scripts/design/prepare-seller-route.ts <output.json>");
}

const assertDedicatedDatabase = (): string => {
    const urls = ["DATABASE_URL", "DIRECT_URL", "E2E_DATABASE_URL"].map(
        (name) => process.env[name]?.trim() ?? ""
    );
    const [databaseUrl] = urls;
    if (!databaseUrl || urls.some((url) => url !== databaseUrl)) {
        throw new Error(
            "DATABASE_URL / DIRECT_URL / E2E_DATABASE_URL を同じ専用DBに揃えてください。"
        );
    }
    const parsed = new URL(databaseUrl);
    const name = parsed.pathname.replace(/^\//, "");
    const isLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (!isLocal || name === "multivendor_dev" || !/e2e|test/.test(name)) {
        throw new Error(`専用のローカルテストDBではありません（db=${name}）。`);
    }
    return databaseUrl;
};

const secretKey = process.env.CLERK_SECRET_KEY?.trim();
if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("Clerk の dev インスタンス（sk_test_）の CLERK_SECRET_KEY が必要です。");
}

const databaseUrl = assertDedicatedDatabase();
const clerk = createClerkClient({ secretKey });
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const ensureClerkSeller = async (): Promise<string> => {
    const { data } = await clerk.users.getUserList({ emailAddress: [SELLER_EMAIL] });
    const existing = data[0];
    const user =
        existing ??
        (await clerk.users.createUser({
            emailAddress: [SELLER_EMAIL],
            // このインスタンスは username 必須（tests/e2e/helpers/auth.ts と同じ）
            username: "designseller",
            firstName: "Design",
            lastName: "Seller",
            skipPasswordRequirement: true,
        }));
    await clerk.users.updateUserMetadata(user.id, {
        privateMetadata: { role: "SELLER" },
    });
    return user.id;
};

try {
    const sellerId = await ensureClerkSeller();

    const seller = await prisma.user.upsert({
        where: { email: SELLER_EMAIL },
        create: {
            id: sellerId,
            email: SELLER_EMAIL,
            name: "Design Seller",
            picture: "/assets/images/default-user.jpg",
            role: "SELLER",
        },
        update: { name: "Design Seller", role: "SELLER" },
    });
    if (seller.id !== sellerId) {
        throw new Error("DB の販売者 User.id が Clerk ID と一致しません。");
    }

    const buyer = await prisma.user.upsert({
        where: { email: BUYER_EMAIL },
        create: {
            email: BUYER_EMAIL,
            name: "Design Buyer",
            picture: "/assets/images/default-user.jpg",
        },
        update: {},
    });

    const store = await prisma.store.update({
        where: { url: STORE_URL },
        // seed は 3 ブラウザ分の店舗を同じ name / phone で作るため、upsertStore の重複検査で
        // 保存が拒否される。検証店舗だけ固有値にする
        // 保存テストが途中で失敗しても次回が同じ初期値から始まるよう、操作対象の値もここで戻す
        data: {
            userId: seller.id,
            name: "Design Seller Store",
            phone: "1000000001",
            lowStockThreshold: 5,
            defaultShippingService: "International Delivery",
        },
    });
    await prisma.size.updateMany({
        where: { productVariant: { product: { storeId: store.id } } },
        data: { quantity: 10 },
    });
    await prisma.orderGroup.updateMany({
        where: { storeId: store.id },
        data: { status: "Pending" },
    });

    const size = await prisma.size.findFirstOrThrow({
        where: { productVariant: { product: { storeId: store.id } } },
        include: { productVariant: { include: { product: true, images: true } } },
        orderBy: { createdAt: "asc" },
    });
    const variant = size.productVariant;
    const country = await prisma.country.findFirstOrThrow({ orderBy: { name: "asc" } });

    await prisma.shippingRate.upsert({
        where: { storeId_countryId: { storeId: store.id, countryId: country.id } },
        create: {
            storeId: store.id,
            countryId: country.id,
            shippingService: "Design Express",
            shippingFeePerItem: new Prisma.Decimal("5.00"),
            shippingFeeForAdditionalItem: new Prisma.Decimal("2.00"),
            shippingFeePerKg: new Prisma.Decimal("1.50"),
            shippingFeeFixed: new Prisma.Decimal("8.00"),
            deliveryTimeMin: 2,
            deliveryTimeMax: 5,
            returnPolicy: "Return in 30 days.",
        },
        update: {},
    });

    // 注文は既存の有無で冪等化する（同じ購入者・店舗の注文が無いときだけ作る）
    const existingGroup = await prisma.orderGroup.findFirst({
        where: { storeId: store.id, order: { userId: buyer.id } },
    });
    let orderId = existingGroup?.orderId;
    if (!orderId) {
        const price = size.price;
        const quantity = 2;
        const subTotal = price.mul(quantity);
        const shippingFees = new Prisma.Decimal("5.00");
        const total = subTotal.add(shippingFees);
        const order = await prisma.$transaction(async (tx) => {
            const address = await tx.shippingAddress.create({
                data: {
                    firstName: "Design",
                    lastName: "Buyer",
                    phone: "0000000000",
                    address1: "1 Test Street",
                    state: "CA",
                    city: "Test City",
                    zip_code: "00000",
                    userId: buyer.id,
                    countryId: country.id,
                },
            });
            return tx.order.create({
                data: {
                    userId: buyer.id,
                    shippingAddressId: address.id,
                    subTotal,
                    shippingFees,
                    total,
                    paymentStatus: "Paid",
                    groups: {
                        create: {
                            storeId: store.id,
                            shippingService: "Design Express",
                            shippingDeliveryMin: 2,
                            shippingDeliveryMax: 5,
                            shippingFees,
                            subTotal,
                            total,
                            items: {
                                create: {
                                    productId: variant.productId,
                                    variantId: variant.id,
                                    sizeId: size.id,
                                    productSlug: variant.product.slug,
                                    variantSlug: variant.slug,
                                    sku: variant.sku,
                                    name: variant.product.name,
                                    image: variant.images[0]?.url ?? "/assets/images/no_image.png",
                                    size: size.size,
                                    quantity,
                                    shippingFee: shippingFees,
                                    price,
                                    totalPrice: subTotal,
                                },
                            },
                        },
                    },
                },
            });
        });
        orderId = order.id;
    }

    const conversation = await prisma.conversation.upsert({
        where: { userId_storeId: { userId: buyer.id, storeId: store.id } },
        create: { userId: buyer.id, storeId: store.id, orderId },
        update: {},
    });
    const messageCount = await prisma.message.count({
        where: { conversationId: conversation.id },
    });
    if (messageCount === 0) {
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: buyer.id,
                content: "Design verification: is this item in stock?",
            },
        });
    }

    writeFileSync(
        output,
        JSON.stringify(
            { sellerEmail: SELLER_EMAIL, storeUrl: STORE_URL, otherStoreUrl: OTHER_STORE_URL, orderId },
            null,
            2
        )
    );
    console.log(`prepared seller route data: store=${STORE_URL}`);
} finally {
    await prisma.$disconnect();
}
