import { writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * 購入優先8画面の認証後実ルート受け入れ（checkout・注文詳細・wishlist）の準備。
 *
 * 前提: 専用DBへ `bunx prisma migrate deploy` と `bun run seed:e2e` を実行済み。
 * 販売者受け入れ（prepare-seller-route.ts）が初期化する chromium 店舗と干渉しないよう firefox 店舗を使う。
 *
 * 1. DATABASE_URL / DIRECT_URL / E2E_DATABASE_URL が同値で、ローカルの専用DBを指すことを検査する。
 * 2. Clerk dev に `+clerk_test` の顧客を作成または再利用し、同じ ID の User を DB に用意する。
 * 3. 住所2件・カート1件（クーポン未適用へ戻す）・店舗クーポン・支払い済み/未払いの注文・wishlist 12件
 *    （2ページ）を冪等に投入する。クーポン適用テストがカートを変えるため、suite 実行前に毎回実行する。
 *
 * 使い方: bun scripts/design/prepare-purchase-route.ts <output.json>
 */

const CUSTOMER_EMAIL = "design-customer+clerk_test@example.com";
const STORE_URL = "e2e-store-firefox-w0";
const COUPON_CODE = "DESIGN-CUSTOMER-10";
const WISHLIST_COUNT = 12;

const output = process.argv[2];
if (!output) {
    throw new Error(
        "Usage: bun scripts/design/prepare-purchase-route.ts <output.json>"
    );
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
    throw new Error(
        "Clerk の dev インスタンス（sk_test_）の CLERK_SECRET_KEY が必要です。"
    );
}

const databaseUrl = assertDedicatedDatabase();
const clerk = createClerkClient({ secretKey });
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const ensureClerkCustomer = async (): Promise<string> => {
    const { data } = await clerk.users.getUserList({
        emailAddress: [CUSTOMER_EMAIL],
    });
    const existing = data[0];
    if (existing) return existing.id;
    const user = await clerk.users.createUser({
        emailAddress: [CUSTOMER_EMAIL],
        // このインスタンスは username 必須（tests/e2e/helpers/auth.ts と同じ）
        username: "designcustomer",
        firstName: "Design",
        lastName: "Customer",
        skipPasswordRequirement: true,
    });
    return user.id;
};

try {
    const customerId = await ensureClerkCustomer();
    const customer = await prisma.user.upsert({
        where: { email: CUSTOMER_EMAIL },
        create: {
            id: customerId,
            email: CUSTOMER_EMAIL,
            name: "Design Customer",
            picture: "/assets/images/default-user.jpg",
        },
        update: { name: "Design Customer" },
    });
    if (customer.id !== customerId) {
        throw new Error("DB の顧客 User.id が Clerk ID と一致しません。");
    }

    const store = await prisma.store.findUniqueOrThrow({
        where: { url: STORE_URL },
    });
    const country = await prisma.country.findFirstOrThrow({
        orderBy: { name: "asc" },
    });

    // 住所は件数で冪等化する（選択 radio の切り替えに 2 件必要）
    const addressCount = await prisma.shippingAddress.count({
        where: { userId: customer.id },
    });
    for (let i = addressCount; i < 2; i++) {
        await prisma.shippingAddress.create({
            data: {
                firstName: "Design",
                lastName: i === 0 ? "Customer" : "Recipient",
                phone: `000000000${i}`,
                address1: `${i + 1} Verification Street`,
                state: "CA",
                city: "Test City",
                zip_code: "00000",
                default: i === 0,
                userId: customer.id,
                countryId: country.id,
            },
        });
    }
    const address = await prisma.shippingAddress.findFirstOrThrow({
        where: { userId: customer.id, default: true },
    });

    // 在庫の戻しは操作対象の 1 サイズのみ。他の店舗データは変えない
    const size = await prisma.size.findFirstOrThrow({
        where: { productVariant: { product: { storeId: store.id } } },
        include: {
            productVariant: { include: { product: true, images: true } },
        },
        orderBy: { createdAt: "asc" },
    });
    await prisma.size.update({
        where: { id: size.id },
        data: { quantity: 10 },
    });
    const variant = size.productVariant;
    const image = variant.images[0]?.url ?? "/assets/images/no_image.png";

    await prisma.coupon.upsert({
        where: { code: COUPON_CODE },
        create: {
            code: COUPON_CODE,
            startDate: "2020-01-01",
            endDate: "2099-12-31",
            discount: 10,
            scope: "STORE",
            storeId: store.id,
        },
        update: {
            isActive: true,
            startDate: "2020-01-01",
            endDate: "2099-12-31",
        },
    });

    // カートは毎回作り直し、クーポン未適用の状態から始める
    const quantity = 1;
    const price = size.price;
    const shippingFee = new Prisma.Decimal("5.00");
    const subTotal = price.mul(quantity);
    await prisma.$transaction(async (tx) => {
        await tx.cart.deleteMany({ where: { userId: customer.id } });
        await tx.cart.create({
            data: {
                userId: customer.id,
                subTotal,
                shippingFees: shippingFee,
                total: subTotal.add(shippingFee),
                cartItems: {
                    create: {
                        productId: variant.productId,
                        variantId: variant.id,
                        sizeId: size.id,
                        productSlug: variant.product.slug,
                        variantSlug: variant.slug,
                        sku: variant.sku,
                        name: variant.product.name,
                        image,
                        size: size.size,
                        quantity,
                        price,
                        shippingFee,
                        totalPrice: subTotal.add(shippingFee),
                        storeId: store.id,
                    },
                },
            },
        });
    });

    // 注文は支払い状態ごとに 1 件。既存があれば再利用する
    const ensureOrder = async (
        paymentStatus: "Paid" | "Pending"
    ): Promise<string> => {
        const existing = await prisma.order.findFirst({
            where: { userId: customer.id, paymentStatus },
            select: { id: true },
        });
        if (existing) return existing.id;
        const total = subTotal.add(shippingFee);
        const order = await prisma.order.create({
            data: {
                userId: customer.id,
                shippingAddressId: address.id,
                subTotal,
                shippingFees: shippingFee,
                total,
                paymentStatus,
                groups: {
                    create: {
                        storeId: store.id,
                        shippingService: "International Delivery",
                        shippingDeliveryMin: 2,
                        shippingDeliveryMax: 5,
                        shippingFees: shippingFee,
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
                                image,
                                size: size.size,
                                quantity,
                                shippingFee,
                                price,
                                totalPrice: subTotal,
                            },
                        },
                    },
                },
            },
        });
        return order.id;
    };
    const paidOrderId = await ensureOrder("Paid");
    const pendingOrderId = await ensureOrder("Pending");

    // wishlist はページング確認のため 12 件（1 ページ 10 件）へ揃える
    const variants = await prisma.productVariant.findMany({
        where: { product: { storeId: store.id } },
        select: { id: true, productId: true },
        orderBy: { createdAt: "asc" },
        take: WISHLIST_COUNT,
    });
    if (variants.length < WISHLIST_COUNT) {
        throw new Error(
            `wishlist 用のバリアントが不足しています（${variants.length} 件）。`
        );
    }
    await prisma.$transaction([
        prisma.wishlist.deleteMany({ where: { userId: customer.id } }),
        prisma.wishlist.createMany({
            data: variants.map((v) => ({
                userId: customer.id,
                productId: v.productId,
                variantId: v.id,
            })),
        }),
    ]);

    writeFileSync(
        output,
        JSON.stringify(
            {
                customerEmail: CUSTOMER_EMAIL,
                couponCode: COUPON_CODE,
                paidOrderId,
                pendingOrderId,
                wishlistCount: WISHLIST_COUNT,
            },
            null,
            2
        )
    );
    console.log(`prepared purchase route data: store=${STORE_URL}`);
} finally {
    await prisma.$disconnect();
}
