/**
 * @jest-environment node
 */
/**
 * Clerk webhook `user.deleted` の FK 連鎖 統合テスト (plan 040 / TESTS-24)
 *
 * `user.deleted` を受けた webhook は `db.user.deleteMany` の**ハード削除**を実行するが、
 * User への FK は 3 種が混在する:
 *
 *   - **RESTRICT（削除を阻止）**: Store / Review / ShippingAddress / Order
 *   - **CASCADE（連鎖消滅）**: Cart / CartItem / Wishlist / Conversation / Message /
 *     `_UserFollowingStore` / `_CouponToUser`
 *   - **SET NULL（切り離し）**: SupportTicket
 *
 * つまり注文・レビュー・住所・店舗のいずれか 1 件でも持つユーザーが Clerk 上でアカウントを
 * 削除すると、DB 側の削除は P2003 で**永続的に失敗**して webhook は 500 を返し続ける。
 * Svix のリトライは有限回で打ち切られるため、**誰も気付かないままユーザーの PII が DB に
 * 残存し続ける**（GDPR 等の削除要求と衝突するコンプライアンス隣接事案）。
 * この 3 値境界は `db.user.deleteMany` をモックする unit テスト
 * (`src/app/api/webhooks/route.test.ts`) では原理的に検証できない。
 *
 * シナリオ 2〜5（RESTRICT 群）は**現挙動の characterization** であり、「削除できないのが
 * 正しい」という主張ではない。修正（PII 匿名化 + 行温存 / ソフト削除 / onDelete 変更）が
 * 入ったら期待値を反転させること。
 * 一方シナリオ 6 の PII 秘匿化は**実装済みの正の保証**（characterization ではない）。
 *
 * 到達不能なため対象外: `PaymentDetails.userId` の CASCADE。`PaymentDetails.orderId` は
 * Order への必須 FK なので、PaymentDetails を持つユーザーは必ず Order を持ち、削除は常に
 * Order の RESTRICT で先に阻止される（シナリオ 2 の 500 経路に吸収される）。
 *
 * 設計判断: `@/lib/db` は**モックしない**（globalSetup が `DATABASE_URL` を testcontainers へ
 * 書き換えるため route の書き込みは実 DB に当たる）。`testEnvironment` はファイル単位 docblock で
 * `node` に上書きする —— jsdom には Fetch API の `Request` / `Response` が無く Route Handler を
 * 直接呼べないため（plan 032 と同じ。`jest.integration.config.js` は無変更）。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - plans/040-integration-test-user-deletion-webhook.md
 * - plans/audit/findings-15-integration-coverage-r7.md (TESTS-24)
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// Svix 署名検証をバイパスし、テストからイベントを注入する
const mockVerify = jest.fn();
jest.mock("svix", () => ({
    Webhook: jest.fn().mockImplementation(() => ({
        verify: (...args: unknown[]) => mockVerify(...args),
    })),
}));

// next/headers から svix ヘッダーを返す
const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => mockHeadersMap.get(key) ?? null,
    }),
}));

// user.created 経路が clerkClient を呼ぶため形だけ用意（deleted 経路では未使用）
jest.mock("@clerk/nextjs/server", () => ({
    clerkClient: jest.fn().mockResolvedValue({
        users: { updateUserMetadata: jest.fn() },
    }),
}));

// ----------------------------------------------------------------------------

import { Prisma, type PrismaClient } from "@prisma/client";
import { POST } from "@/app/api/webhooks/route";
import { REDACTED_PII } from "@/lib/pii";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCart,
    seedCartItem,
    seedCategoryWithSubcategory,
    seedCoupon,
    seedCountry,
    seedProductWithVariantAndSize,
    seedShippingAddress,
    seedStore,
    seedUser,
} from "./setup/seed";

let db: PrismaClient;

const originalEnv = process.env;

const createWebhookRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost:3000/api/webhooks", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

const setSvixHeaders = () => {
    mockHeadersMap.set("svix-id", "msg_test123");
    mockHeadersMap.set("svix-timestamp", "1234567890");
    mockHeadersMap.set("svix-signature", "v1,test-signature");
};

async function postUserDeleted(userId: string): Promise<Response> {
    setSvixHeaders();
    mockVerify.mockReturnValue({ type: "user.deleted", data: { id: userId } });
    return POST(createWebhookRequest({}));
}

/**
 * 削除対象ユーザーが参照する商品は「別セラーの店舗」に置く。
 * 対象ユーザー自身が Store を持つと `Store.userId` の RESTRICT で削除が阻止され、
 * CASCADE の検証にならないため（Store 単独の阻止はシナリオ 5 が分離して扱う）。
 */
async function seedOtherSellerCatalog() {
    const seller = await seedUser(db);
    const store = await seedStore(db, { userId: seller.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    const { product, variant, size } = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
    });
    return { seller, store, product, variant, size };
}

beforeAll(() => {
    db = getTestDb();
    process.env = { ...originalEnv, WEBHOOK_SECRET: "test-webhook-secret" };
});

afterAll(async () => {
    process.env = originalEnv;
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    jest.clearAllMocks();
    mockHeadersMap.clear();
});

describe("user.deleted webhook — FK 連鎖（RESTRICT / CASCADE / SET NULL）", () => {
    it("シナリオ1: CASCADE 群のみのユーザーは削除され、到達可能な子行がすべて連鎖消滅する", async () => {
        // Arrange
        const user = await seedUser(db);
        const { store, product, variant, size } = await seedOtherSellerCatalog();

        const cart = await seedCart(db, { userId: user.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product,
            variant,
            size,
        });
        await db.wishlist.create({
            data: {
                userId: user.id,
                productId: product.id,
                variantId: variant.id,
                sizeId: size.id,
            },
        });
        // implicit M2M `_UserFollowingStore`
        await db.user.update({
            where: { id: user.id },
            data: { following: { connect: { id: store.id } } },
        });
        // Conversation.orderId は optional なので Order 無しで成立する
        // （= Order の RESTRICT に触れずに Conversation / Message の CASCADE を発火できる）
        const conversation = await db.conversation.create({
            data: { userId: user.id, storeId: store.id },
        });
        await db.message.create({
            data: {
                conversationId: conversation.id,
                senderId: user.id,
                content: "Hello.",
            },
        });
        // implicit M2M `_CouponToUser`
        const coupon = await seedCoupon(db, {
            storeId: store.id,
            connectUserIds: [user.id],
        });

        // Act
        const res = await postUserDeleted(user.id);

        // Assert — 対象ユーザーと CASCADE 群が消える
        expect(res.status).toBe(200);
        expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
        expect(await db.cart.count()).toBe(0);
        expect(await db.cartItem.count()).toBe(0);
        expect(await db.wishlist.count()).toBe(0);
        expect(await db.conversation.count()).toBe(0);
        expect(await db.message.count()).toBe(0);

        // implicit M2M は Prisma から直接クエリできないため、相手側から件数を引く。
        // Store 残存の assert だけでは中間テーブル行が孤児として残っても green になる。
        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
            select: { _count: { select: { followers: true } } },
        });
        expect(storeAfter._count.followers).toBe(0);

        // Coupon 本体は残り、割当（_CouponToUser）だけが消える
        const couponAfter = await db.coupon.findUniqueOrThrow({
            where: { id: coupon.id },
            select: { _count: { select: { users: true } } },
        });
        expect(couponAfter._count.users).toBe(0);

        // セラー側リソースは無傷
        expect(await db.store.count()).toBe(1);
        expect(await db.product.count()).toBe(1);
        expect(await db.productVariant.count()).toBe(1);
        expect(await db.size.count()).toBe(1);
        expect(await db.coupon.count()).toBe(1);
    });

    it("シナリオ2: Order 持ちユーザーは削除できず 500 + User/Order/住所 が残存する（RESTRICT・characterization）", async () => {
        // Arrange
        const user = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });
        await db.order.create({
            data: {
                subTotal: new Prisma.Decimal(100),
                total: new Prisma.Decimal(110),
                shippingAddressId: address.id,
                userId: user.id,
            },
        });

        // Act
        const res = await postUserDeleted(user.id);

        // Assert — 削除が阻止され PII を含む User 行がそのまま残る（現挙動の characterization）
        expect(res.status).toBe(500);
        expect(
            await db.user.findUnique({ where: { id: user.id } })
        ).not.toBeNull();
        expect(await db.order.count()).toBe(1);
        expect(await db.shippingAddress.count()).toBe(1);
    });

    it("シナリオ3: Review のみ持つユーザーも 500 + User/Review が残存する（RESTRICT・characterization）", async () => {
        // Arrange
        const user = await seedUser(db);
        const { product } = await seedOtherSellerCatalog();
        await db.review.create({
            data: {
                variant: "Variant A",
                review: "Nice.",
                rating: 5,
                color: "Black",
                size: "M",
                quantity: "1",
                userId: user.id,
                productId: product.id,
            },
        });

        // Act
        const res = await postUserDeleted(user.id);

        // Assert
        expect(res.status).toBe(500);
        expect(
            await db.user.findUnique({ where: { id: user.id } })
        ).not.toBeNull();
        expect(await db.review.count()).toBe(1);
    });

    it("シナリオ4: ShippingAddress のみ持つユーザーも 500 + User/住所 が残存する（RESTRICT・characterization）", async () => {
        // Arrange
        const user = await seedUser(db);
        const country = await seedCountry(db);
        await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });

        // Act
        const res = await postUserDeleted(user.id);

        // Assert
        expect(res.status).toBe(500);
        expect(
            await db.user.findUnique({ where: { id: user.id } })
        ).not.toBeNull();
        expect(await db.shippingAddress.count()).toBe(1);
    });

    it("シナリオ5: Store 保有ユーザーは削除できず 500 + User/Store が残存する（RESTRICT・販売者側の PII 残存経路）", async () => {
        // Arrange — Order / Review / 住所は作らず、Store 単独で阻止されることを分離して示す
        const seller = await seedUser(db);
        await seedStore(db, { userId: seller.id });

        // Act
        const res = await postUserDeleted(seller.id);

        // Assert
        expect(res.status).toBe(500);
        expect(
            await db.user.findUnique({ where: { id: seller.id } })
        ).not.toBeNull();
        expect(await db.store.count()).toBe(1);
    });

    it("シナリオ6: SupportTicket 持ちユーザーは削除され、ticket は userId が NULL 化され PII 列が秘匿化される", async () => {
        // Arrange — orderId は付けない（Order を作ると RESTRICT で削除が阻止され SET NULL を観測できない）
        const user = await seedUser(db);
        const ticket = await db.supportTicket.create({
            data: {
                category: "CONTACT",
                name: "Jane Doe",
                email: "jane@example.test",
                subject: "Question about my order",
                message: "Please tell me the delivery date.",
                userId: user.id,
            },
        });

        // Act
        const res = await postUserDeleted(user.id);

        // Assert — PII 消去は実装済みの正の保証（characterization ではない）
        expect(res.status).toBe(200);
        expect(await db.user.findUnique({ where: { id: user.id } })).toBeNull();
        const ticketAfter = await db.supportTicket.findUniqueOrThrow({
            where: { id: ticket.id },
        });
        expect(ticketAfter.userId).toBeNull();
        expect(ticketAfter.name).toBe(REDACTED_PII);
        expect(ticketAfter.email).toBe(REDACTED_PII);
        expect(ticketAfter.subject).toBe(REDACTED_PII);
        expect(ticketAfter.message).toBe(REDACTED_PII);
    });

    it("シナリオ7: 存在しない userId は 200（deleteMany は count:0 で正常終了する）", async () => {
        // Act
        const res = await postUserDeleted("user_does_not_exist");

        // Assert
        expect(res.status).toBe(200);
    });
});
