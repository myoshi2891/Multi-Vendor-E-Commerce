import { writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import {
    PrismaClient,
    type ReturnItemCondition,
    type ReturnReasonCode,
    type ReturnRequestStatus,
} from "@prisma/client";

/**
 * 返品 RMA 画面（DS-PAGE-068 / DS-COMP-247 / DS-COMP-248）の認証後実ルート受け入れの準備
 * （plans/layout-design/returns-real-route-acceptance-plan.md）。
 *
 * 前提: 専用DBへ `bunx prisma migrate deploy` と `bun run seed:e2e` を実行済み。
 * seller-eight-route / purchase-route の店舗と干渉しないよう、返品専用の店舗を使う。
 *
 * 1. DATABASE_URL / DIRECT_URL / E2E_DATABASE_URL が同値で、ローカルの専用DBを指すことを検査する。
 * 2. Clerk dev の `+clerk_test` 販売者・顧客を作成または再利用し、同じ ID の User を DB に用意する。
 * 3. 返品専用店舗の RMA と注文を消してから、Delivered の注文 1 件と 6 状態の RMA を投入する（冪等）。
 *
 * 使い方: bun scripts/design/prepare-returns-route.ts <output.json>
 */

const SELLER_EMAIL = "design-seller+clerk_test@example.com";
const CUSTOMER_EMAIL = "design-customer+clerk_test@example.com";
const STORE_URL = "design-returns-store";

const output = process.argv[2];
if (!output) {
    throw new Error(
        "Usage: bun scripts/design/prepare-returns-route.ts <output.json>"
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

/** Clerk dev のテストユーザーを作成または再利用する。販売者は layout が判定する privateMetadata.role も設定する */
const ensureClerkUser = async (
    email: string,
    username: string,
    lastName: string,
    role?: "SELLER"
): Promise<string> => {
    const { data } = await clerk.users.getUserList({ emailAddress: [email] });
    const user =
        data[0] ??
        (await clerk.users.createUser({
            emailAddress: [email],
            // このインスタンスは username 必須（tests/e2e/helpers/auth.ts と同じ）
            username,
            firstName: "Design",
            lastName,
            skipPasswordRequirement: true,
        }));
    if (role) {
        await clerk.users.updateUserMetadata(user.id, {
            privateMetadata: { role },
        });
    }
    return user.id;
};

/** 別 ID の既存ユーザーを書き換えないよう、書き込み前に Clerk ID と照合する */
const ensureDbUser = async (
    id: string,
    email: string,
    name: string,
    role: "USER" | "SELLER"
): Promise<string> => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== id) {
        throw new Error(
            `DB の User.id が Clerk ID と一致しません（${email}）。`
        );
    }
    const user = existing
        ? await prisma.user.update({ where: { id }, data: { name, role } })
        : await prisma.user.create({
              data: {
                  id,
                  email,
                  name,
                  picture: "/assets/images/default-user.jpg",
                  role,
              },
          });
    return user.id;
};

type SeedRequest = {
    status: ReturnRequestStatus;
    reasonCode: ReturnReasonCode;
    condition?: ReturnItemCondition;
    extra?: {
        sellerNote?: string;
        returnTrackingNumber?: string;
        refundAmount?: string;
    };
};

// 明細 A（数量 6）に 1 個ずつ。明細 B（数量 2）は申請フォームの対象として残す
const REQUESTS: SeedRequest[] = [
    { status: "REQUESTED", reasonCode: "SIZE_FIT" },
    {
        status: "APPROVED",
        reasonCode: "DEFECTIVE",
        extra: { returnTrackingNumber: "1Z999AA10123456784" },
    },
    { status: "RECEIVED", reasonCode: "WRONG_ITEM", condition: "RESELLABLE" },
    {
        status: "RESOLVED",
        reasonCode: "NOT_AS_DESCRIBED",
        condition: "DAMAGED",
        extra: { refundAmount: "24.00" },
    },
    {
        status: "REJECTED",
        reasonCode: "CHANGED_MIND",
        extra: {
            sellerNote:
                "The item shows signs of use beyond trying it on, so this return cannot be accepted.",
        },
    },
    { status: "CANCELED", reasonCode: "OTHER" },
];

const timestampsFor = (
    status: ReturnRequestStatus,
    at: Date
): Record<string, Date> => {
    switch (status) {
        case "APPROVED":
            return { approvedAt: at };
        case "RECEIVED":
            return { approvedAt: at, receivedAt: at };
        case "RESOLVED":
            return { approvedAt: at, receivedAt: at, resolvedAt: at };
        case "REJECTED":
            return { rejectedAt: at };
        case "CANCELED":
            return { canceledAt: at };
        default:
            return {};
    }
};

try {
    const sellerId = await ensureDbUser(
        await ensureClerkUser(SELLER_EMAIL, "designseller", "Seller", "SELLER"),
        SELLER_EMAIL,
        "Design Seller",
        "SELLER"
    );
    const customerId = await ensureDbUser(
        await ensureClerkUser(CUSTOMER_EMAIL, "designcustomer", "Customer"),
        CUSTOMER_EMAIL,
        "Design Customer",
        "USER"
    );

    const store = await prisma.store.upsert({
        where: { url: STORE_URL },
        create: {
            name: "Design Returns Store",
            description: "Store for the returns real-route acceptance.",
            email: "design-returns-store@example.com",
            phone: "0000000136",
            url: STORE_URL,
            logo: "/assets/images/no_image.png",
            cover: "/assets/images/home-wallpaper.webp",
            status: "ACTIVE",
            returnPolicy: "Return within 30 days.",
            userId: sellerId,
        },
        update: {
            status: "ACTIVE",
            acceptsReturns: true,
            returnWindowDays: null,
            userId: sellerId,
        },
    });

    // ReturnRequest は Order / Store / User を onDelete: Restrict で拘束するので先に消す（明細は Cascade）
    await prisma.returnRequest.deleteMany({ where: { storeId: store.id } });
    await prisma.order.deleteMany({
        where: { groups: { some: { storeId: store.id } } },
    });

    const country = await prisma.country.findFirstOrThrow({
        orderBy: { name: "asc" },
    });
    const address =
        (await prisma.shippingAddress.findFirst({
            where: { userId: customerId },
            orderBy: { createdAt: "asc" },
        })) ??
        (await prisma.shippingAddress.create({
            data: {
                firstName: "Design",
                lastName: "Customer",
                phone: "0000000000",
                address1: "1 Verification Street",
                state: "CA",
                city: "Test City",
                zip_code: "00000",
                default: true,
                userId: customerId,
                countryId: country.id,
            },
        }));

    // 商品行は作らない（OrderItem の id 列は FK の無いスナップショット。実商品は他 suite の前提を変える）
    const itemSnapshot = (key: string, name: string, quantity: number) => ({
        productId: `design-returns-${key}`,
        variantId: `design-returns-${key}-variant`,
        sizeId: `design-returns-${key}-size`,
        productSlug: `design-returns-${key}`,
        variantSlug: `design-returns-${key}-variant`,
        sku: `DESIGN-RETURNS-${key.toUpperCase()}`,
        name,
        image: "/assets/images/no_image.png",
        size: "M",
        quantity,
        price: "24.00",
        totalPrice: (24 * quantity).toFixed(2),
        status: "Delivered" as const,
    });
    const order = await prisma.order.create({
        data: {
            subTotal: "192.00",
            total: "192.00",
            orderStatus: "Delivered",
            paymentStatus: "Paid",
            shippingAddressId: address.id,
            userId: customerId,
            groups: {
                create: {
                    status: "Delivered",
                    shippingService: "Design Courier",
                    shippingDeliveryMin: 3,
                    shippingDeliveryMax: 7,
                    shippingFees: "0.00",
                    subTotal: "192.00",
                    total: "192.00",
                    storeId: store.id,
                    items: {
                        create: [
                            itemSnapshot("a", "Linen Overshirt", 6),
                            itemSnapshot("b", "Merino Crew Sweater", 2),
                        ],
                    },
                },
            },
        },
        include: { groups: { include: { items: true } } },
    });
    const group = order.groups[0];
    const itemA = group.items.find((item) => item.productId.endsWith("-a"));
    if (!itemA) throw new Error("明細 A を作成できませんでした。");

    // createdAt を 1 分ずつずらし、一覧の並び（createdAt desc）を決定的にする
    const base = Date.now() - REQUESTS.length * 60_000;
    for (const [index, request] of REQUESTS.entries()) {
        const at = new Date(base + index * 60_000);
        await prisma.returnRequest.create({
            data: {
                orderGroupId: group.id,
                storeId: store.id,
                userId: customerId,
                status: request.status,
                resolution: "REFUND",
                idempotencyKey: `design-returns-${index}`,
                requestHash: `design-returns-${index}`,
                customerNote:
                    index === 0
                        ? "The fit is tighter across the shoulders than the size guide suggests."
                        : null,
                createdAt: at,
                ...timestampsFor(request.status, at),
                ...request.extra,
                items: {
                    create: {
                        orderItemId: itemA.id,
                        quantity: 1,
                        reasonCode: request.reasonCode,
                        condition: request.condition ?? null,
                    },
                },
            },
        });
    }

    writeFileSync(
        output,
        JSON.stringify(
            {
                sellerEmail: SELLER_EMAIL,
                customerEmail: CUSTOMER_EMAIL,
                storeUrl: STORE_URL,
                orderId: order.id,
                requestCount: REQUESTS.length,
                eligibleItemName: "Merino Crew Sweater",
            },
            null,
            2
        )
    );
    console.log(
        `prepared returns route data: store=${STORE_URL} order=${order.id}`
    );
} finally {
    await prisma.$disconnect();
}
