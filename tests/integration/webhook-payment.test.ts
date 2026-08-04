/**
 * @jest-environment node
 *
 * Webhook Payment Idempotency Integration Tests (Stripe / PayPal)
 *
 * ⚠️ 本ファイルだけ `testEnvironment` を **node** に上書きしている。
 * `jest.integration.config.js` の既定は jsdom（cart-checkout の hydration 検証用）だが、
 * jsdom には Fetch API の `Request` / `Response` グローバルが無く、Route Handler を
 * 直接呼ぶテストが書けない（unit の `src/app/api/webhooks/**\/route.test.ts` が
 * `jest.config.js` の `testEnvironment: "node"` で動いているのと同じ理由）。
 * config は変更せず、Jest 標準のファイル単位 docblock で上書きしている。
 * 本ファイルは DOM を一切使わないため副作用はない。
 *
 * 決済 webhook（`src/app/api/webhooks/{stripe,paypal}/route.ts`）を実 DB
 * (testcontainers PostgreSQL) に対して配送し、**冪等性の本体**を検証する。
 * unit テスト（両 `route.test.ts`）は `@/lib/db` を全モックしているため、
 * 以下は一度も実行されていなかった:
 *
 *   - `PaymentDetails.orderId` の unique 制約と `upsert` の実挙動
 *   - 同一イベント再送（**逐次・並行ディスパッチの両方**）で行が 1 本に保たれること
 *   - 状態遷移イベント（succeeded → charge.refunded）が同じ行を更新すること
 *   - Order 不在時に 404 を返し、副作用を一切残さないこと
 *   - `$transaction` の原子性（2 番目の書き込みが失敗したら 1 番目も巻き戻ること）
 *   - プロバイダー切替時（Stripe → PayPal）に 1 行が保たれること
 *     **および現状 `amount` / `currency` が切替後も更新されないこと**（characterization。下記 P4）
 *
 * ⚠️ 並行ケースが主張できるのは「**並行ディスパッチの回帰テスト**」までであり、
 * 「DB 上で 2 つの upsert が重なったことの証明」ではない。バリアと `connection_limit >= 2` が
 * 保証するのは「2 本がクエリ発行の直前まで揃っていた」ことだけで、解放後に片方が先に完走する
 * 実行順でも緑になる。価値は**重ならなかった場合に緑になる構成上の穴を塞ぐ**点にある
 * （`tests/integration/order-lifecycle.test.ts` の Scenario 2 と同じ扱い）。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/app/api/webhooks/stripe/route.ts / src/app/api/webhooks/paypal/route.ts
 * - plans/032-integration-test-webhook-payment-idempotency.md
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// Stripe SDK: 署名検証を差し替え、テストが与えたイベントをそのまま返す。
const mockConstructEvent = jest.fn();
jest.mock("stripe", () => {
    return jest.fn().mockImplementation(() => ({
        webhooks: {
            constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
        },
    }));
});

// 両 route が読むリクエストヘッダー（stripe-signature / paypal-*）を差し替える。
const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => mockHeadersMap.get(key) ?? null,
    }),
}));

// ⚠️ `@/lib/db` は **モックしない**。globalSetup が DATABASE_URL を testcontainers に
// 書き換えるため、route が import するシングルトンは自動的に実コンテナ DB へ接続する。

// ----------------------------------------------------------------------------

import { cpus } from "node:os";
import { Prisma } from "@prisma/client";
import { POST as stripeWebhookPOST } from "@/app/api/webhooks/stripe/route";
import { POST as paypalWebhookPOST } from "@/app/api/webhooks/paypal/route";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import { seedCountry, seedShippingAddress, seedUser } from "./setup/seed";

import paymentIntentSucceededFixture from "../fixtures/webhooks/stripe/payment-intent-succeeded.json";
import chargeRefundedFullFixture from "../fixtures/webhooks/stripe/charge-refunded-full.json";
import chargeRefundedPartialFixture from "../fixtures/webhooks/stripe/charge-refunded-partial.json";
import captureCompletedFixture from "../fixtures/webhooks/paypal/payment-capture-completed.json";
import captureRefundedFixture from "../fixtures/webhooks/paypal/payment-capture-refunded.json";

const db = getTestDb();

/** Order.total（PayPal 経路が PaymentDetails.amount に格納する権威値） */
const ORDER_TOTAL = "110.00";
/** Stripe fixture が持つ amount（cents 単位。PayPal 経路のドル建てと単位が異なる） */
const STRIPE_FIXTURE_AMOUNT_CENTS = 9999;

type StripeEventFixture = {
    type: string;
    data: { object: { metadata?: Record<string, string> } };
};
type PayPalEventFixture = {
    event_type: string;
    resource: { id: string; custom_id: string };
};

const originalEnv = process.env;

beforeAll(() => {
    process.env = {
        ...originalEnv,
        STRIPE_SECRET_KEY: "sk_test_dummy",
        STRIPE_WEBHOOK_SECRET: "whsec_test_dummy",
        NEXT_PUBLIC_PAYPAL_CLIENT_ID: "paypal-client-id-test",
        PAYPAL_SECRET: "paypal-secret-test",
        PAYPAL_WEBHOOK_ID: "WEBHOOK-ID-TEST",
        PAYPAL_API_BASE: "https://api-m.sandbox.paypal.com",
    };
});

afterAll(async () => {
    process.env = originalEnv;
    await disconnectTestDb();
});

const mockFetch = jest.fn();
const realFetch = global.fetch;

beforeEach(async () => {
    await resetDb(db);
    mockConstructEvent.mockReset();
    mockFetch.mockReset();
    mockHeadersMap.clear();
    mockHeadersMap.set("stripe-signature", "t=1,v1=valid-test-signature");
    setPayPalHeaders();
    global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
    global.fetch = realFetch;
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function setPayPalHeaders(): void {
    mockHeadersMap.set("paypal-transmission-id", "transmission-id-test");
    mockHeadersMap.set("paypal-transmission-time", "2026-05-28T10:00:00Z");
    mockHeadersMap.set("paypal-transmission-sig", "sig-test");
    mockHeadersMap.set("paypal-cert-url", "https://api-m.paypal.com/cert");
    mockHeadersMap.set("paypal-auth-algo", "SHA256withRSA");
}

/** PayPal 署名検証の 2 段 fetch（OAuth → verify）を成功で応答させる（1 配送ぶん） */
function mockPayPalSignatureOnce(
    status: "SUCCESS" | "FAILURE" = "SUCCESS"
): void {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "test-access-token" }),
    });
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification_status: status }),
    });
}

/** 決済 webhook が要求する最小の Order（+ User / ShippingAddress）を seed する */
async function seedOrderForWebhook(): Promise<{
    orderId: string;
    userId: string;
}> {
    const user = await seedUser(db);
    const country = await seedCountry(db);
    const address = await seedShippingAddress(db, {
        userId: user.id,
        countryId: country.id,
    });
    const order = await db.order.create({
        data: {
            subTotal: new Prisma.Decimal("100.00"),
            shippingFees: new Prisma.Decimal("10.00"),
            total: new Prisma.Decimal(ORDER_TOTAL),
            shippingAddressId: address.id,
            userId: user.id,
        },
    });
    return { orderId: order.id, userId: user.id };
}

/**
 * fixture の deep clone。
 *
 * jsdom テスト環境には `structuredClone` が無いため、JSON round-trip を使う
 * （fixture は素の JSON なので欠落するデータ型はない）。
 */
function cloneFixture<T>(fixture: unknown): T {
    return JSON.parse(JSON.stringify(fixture)) as T;
}

/** fixture を deep clone し、相関 ID を seed 済み Order に差し替える（fixture 自体は変更しない） */
function stripeEventFor(
    fixture: unknown,
    orderId: string
): StripeEventFixture {
    const event = cloneFixture<StripeEventFixture>(fixture);
    event.data.object.metadata = {
        ...(event.data.object.metadata ?? {}),
        orderId,
    };
    return event;
}

function paypalEventFor(
    fixture: unknown,
    orderId: string
): PayPalEventFixture {
    const event = cloneFixture<PayPalEventFixture>(fixture);
    event.resource.custom_id = orderId;
    return event;
}

/** Stripe webhook へ 1 件配送する（署名検証はモック済みなので body は任意） */
async function deliverStripe(event: StripeEventFixture): Promise<Response> {
    mockConstructEvent.mockReturnValue(event);
    return stripeWebhookPOST(
        new Request("http://localhost:3000/api/webhooks/stripe", {
            method: "POST",
            body: "{}",
        })
    );
}

/** PayPal webhook へ 1 件配送する（署名検証 fetch は配送ごとに 2 回消費される） */
async function deliverPayPal(event: PayPalEventFixture): Promise<Response> {
    mockPayPalSignatureOnce();
    return paypalWebhookPOST(
        new Request("http://localhost:3000/api/webhooks/paypal", {
            method: "POST",
            body: JSON.stringify(event),
        })
    );
}

async function countPaymentDetails(orderId: string): Promise<number> {
    return db.paymentDetails.count({ where: { orderId } });
}

/**
 * Prisma の接続プール上限。並行ディスパッチのテストは、プールが 1 だと 2 本が
 * 接続待ちで直列化され「並行を検証しないまま緑」になる（偽陽性）ため、明示的に expect する。
 * `connection_limit` 未指定時の Prisma 既定値は `num_cpus * 2 + 1`。
 */
function resolveConnectionLimit(): number {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL が未設定です（globalSetup 未実行）");
    const explicit = new URL(url).searchParams.get("connection_limit");
    if (explicit !== null) {
        const parsed = Number(explicit.trim());
        if (!Number.isFinite(parsed)) {
            throw new Error(`connection_limit が数値ではありません: ${explicit}`);
        }
        return parsed;
    }
    return cpus().length * 2 + 1;
}

// ============================================================================
// Scenario S1: Stripe 初回イベントで PaymentDetails が作られる
// ============================================================================

describe("Scenario S1: first Stripe event creates PaymentDetails", () => {
    it("stores the payment row and marks the order Paid", async () => {
        // Arrange
        const { orderId, userId } = await seedOrderForWebhook();
        const event = stripeEventFor(paymentIntentSucceededFixture, orderId);

        // Act
        const res = await deliverStripe(event);

        // Assert
        expect(res.status).toBe(200);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.status).toBe("Paid");
        expect(details.paymentMethod).toBe("Stripe");
        expect(details.paymentIntentId).toBe("pi_test_succeeded");
        expect(details.userId).toBe(userId);
        // Stripe 経路は event 値（cents）をそのまま格納する（同期パスと単位を揃える設計）
        expect(details.amount.toFixed(2)).toBe(
            new Prisma.Decimal(STRIPE_FIXTURE_AMOUNT_CENTS).toFixed(2)
        );
        expect(details.currency).toBe("usd");

        const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.paymentStatus).toBe("Paid");
        expect(order.paymentMethod).toBe("Stripe");
    });
});

// ============================================================================
// Scenario S2: 再送しても行は 1 本（冪等性の本体）
// ============================================================================

describe("Scenario S2: redelivery keeps a single PaymentDetails row", () => {
    it("keeps one row on sequential redelivery", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();
        const event = stripeEventFor(paymentIntentSucceededFixture, orderId);

        // Act: 同一イベントを 2 回配送
        const first = await deliverStripe(event);
        const second = await deliverStripe(event);

        // Assert: 両方成功し、副作用は 1 回ぶん
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(await countPaymentDetails(orderId)).toBe(1);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.status).toBe("Paid");
        expect(details.paymentIntentId).toBe("pi_test_succeeded");
    });

    it("concurrent redelivery keeps a single PaymentDetails row", async () => {
        // プールが 1 だと 2 本が接続待ちで直列化され、並行性を検証しないまま緑になる
        expect(resolveConnectionLimit()).toBeGreaterThanOrEqual(2);

        // Arrange
        const { orderId } = await seedOrderForWebhook();
        const event = stripeEventFor(paymentIntentSucceededFixture, orderId);
        mockConstructEvent.mockReturnValue(event);

        // バリア: 2 本が in-flight になってから初めて DB へ進ませる
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let arrived = 0;
        const arm = async (): Promise<Response> => {
            arrived += 1;
            if (arrived === 2) release();
            await gate;
            return stripeWebhookPOST(
                new Request("http://localhost:3000/api/webhooks/stripe", {
                    method: "POST",
                    body: "{}",
                })
            );
        };

        // Act
        const [a, b] = await Promise.all([arm(), arm()]);

        // Assert: 「両方が成功し、かつ副作用は 1 回」の連言で初めて冪等性の主張になる。
        // count === 1 だけでは、片方が 500 で落ちても緑になってしまう（Stripe は
        // 失敗した側を再配送し続けることになる）。
        expect(a.status).toBeLessThan(300);
        expect(b.status).toBeLessThan(300);
        expect(await countPaymentDetails(orderId)).toBe(1);
    });
});

// ============================================================================
// Scenario S3: 状態遷移イベントは同じ行を更新する
// ============================================================================

describe("Scenario S3: transition events update the same row", () => {
    it("moves Paid → Refunded on a full charge.refunded", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();

        // Act
        await deliverStripe(stripeEventFor(paymentIntentSucceededFixture, orderId));
        const res = await deliverStripe(
            stripeEventFor(chargeRefundedFullFixture, orderId)
        );

        // Assert
        expect(res.status).toBe(200);
        expect(await countPaymentDetails(orderId)).toBe(1);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.status).toBe("Refunded");
        const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.paymentStatus).toBe("Refunded");
    });

    it("moves Paid → PartiallyRefunded when amount_refunded is below amount", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();

        // Act
        await deliverStripe(stripeEventFor(paymentIntentSucceededFixture, orderId));
        const res = await deliverStripe(
            stripeEventFor(chargeRefundedPartialFixture, orderId)
        );

        // Assert
        expect(res.status).toBe(200);
        expect(await countPaymentDetails(orderId)).toBe(1);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.status).toBe("PartiallyRefunded");
        const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.paymentStatus).toBe("PartiallyRefunded");
    });
});

// ============================================================================
// Scenario S4: Order 不在は 404 + 副作用なし
// ============================================================================

describe("Scenario S4: unknown order is rejected without side effects", () => {
    it("returns 404 and writes nothing", async () => {
        // Arrange: Order を作らず、実在しない id を相関 ID にする
        const event = stripeEventFor(
            paymentIntentSucceededFixture,
            "00000000-0000-0000-0000-000000000000"
        );

        // Act
        const res = await deliverStripe(event);

        // Assert
        expect(res.status).toBe(404);
        expect(await db.paymentDetails.count()).toBe(0);
    });
});

// ============================================================================
// Scenario S5: $transaction の原子性（2 番目の書き込み失敗で 1 番目も巻き戻る）
// ============================================================================

describe("Scenario S5: transaction rolls back when the second write fails", () => {
    it("leaves no PaymentDetails row when order.update violates a constraint", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();
        const event = stripeEventFor(paymentIntentSucceededFixture, orderId);

        // 前回実行が finally に到達せず落ちた場合に備え、ADD の直前に必ず落とす
        // （残っていると次回の ADD が「already exists」で恒久的に赤くなる）。
        await db.$executeRawUnsafe(
            `ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS tmp_block_stripe`
        );
        // order.update が書く paymentMethod = 'Stripe' だけを拒む CHECK 制約。
        // IS DISTINCT FROM を使うのは既存行が NULL でも ADD が通るようにするため。
        await db.$executeRawUnsafe(
            `ALTER TABLE "Order" ADD CONSTRAINT tmp_block_stripe CHECK ("paymentMethod" IS DISTINCT FROM 'Stripe'::"PaymentMethod")`
        );

        try {
            // Act: tx 内で upsert は成功するが order.update が CHECK 違反で throw する
            const res = await deliverStripe(event);

            // Assert: ハンドラは 500 を返し、1 番目の書き込みも巻き戻っている
            expect(res.status).toBe(500);
            expect(await countPaymentDetails(orderId)).toBe(0);
        } finally {
            // ADD が失敗した経路では制約が無いため IF EXISTS が必須
            // （素の DROP だと finally 自身が throw して真因を隠す）。
            await db.$executeRawUnsafe(
                `ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS tmp_block_stripe`
            );
        }

        // 対照（control）: 制約が無ければ同じイベントで 1 行できることを確認する。
        // これが無いと「ロールバックされた」と「そもそも 1 番目も書かれなかった」を
        // 区別できず、原子性の証明にならない（対照が 1・本番が 0 で初めて成立する）。
        //
        // 対照は制約を落とした**後**に実行する。順序を逆にすると、対照配送が
        // Order.paymentMethod = 'Stripe' を書いた行が残り、その後の ADD CONSTRAINT が
        // 「is violated by some row」で失敗する（実際に踏んだ）。
        const { orderId: controlOrderId } = await seedOrderForWebhook();
        const controlRes = await deliverStripe(
            stripeEventFor(paymentIntentSucceededFixture, controlOrderId)
        );
        expect(controlRes.status).toBe(200);
        expect(await countPaymentDetails(controlOrderId)).toBe(1);
    });
});

// ============================================================================
// Scenario P1: PayPal 初回イベントで PaymentDetails が作られる
// ============================================================================

describe("Scenario P1: first PayPal event creates PaymentDetails", () => {
    it("stores the capture id and the order total as amount", async () => {
        // Arrange
        const { orderId, userId } = await seedOrderForWebhook();
        const event = paypalEventFor(captureCompletedFixture, orderId);

        // Act
        const res = await deliverPayPal(event);

        // Assert
        expect(res.status).toBe(200);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.status).toBe("Paid");
        expect(details.paymentMethod).toBe("PayPal");
        expect(details.paymentIntentId).toBe("CAPTURE-COMPLETED-001");
        expect(details.userId).toBe(userId);
        // PayPal 経路は event の額ではなく Order.total（ドル建て）を格納する
        expect(details.amount.toFixed(2)).toBe(ORDER_TOTAL);
        expect(details.currency).toBe("usd");

        const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.paymentStatus).toBe("Paid");
        expect(order.paymentMethod).toBe("PayPal");
    });
});

// ============================================================================
// Scenario P2 / P3: PayPal 再送と状態遷移
// ============================================================================

describe("Scenario P2: PayPal redelivery keeps a single row", () => {
    it("keeps one row when the same capture event is redelivered", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();
        const event = paypalEventFor(captureCompletedFixture, orderId);

        // Act
        const first = await deliverPayPal(event);
        const second = await deliverPayPal(event);

        // Assert
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(await countPaymentDetails(orderId)).toBe(1);
    });
});

describe("Scenario P3: PayPal refund updates the same row", () => {
    it("moves Paid → Refunded on PAYMENT.CAPTURE.REFUNDED", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();

        // Act
        await deliverPayPal(paypalEventFor(captureCompletedFixture, orderId));
        const res = await deliverPayPal(
            paypalEventFor(captureRefundedFixture, orderId)
        );

        // Assert
        expect(res.status).toBe(200);
        expect(await countPaymentDetails(orderId)).toBe(1);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.status).toBe("Refunded");
        const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.paymentStatus).toBe("Refunded");
    });
});

// ============================================================================
// Scenario P4: プロバイダー切替（Stripe → PayPal）
// ============================================================================

describe("Scenario P4: switching provider keeps one row", () => {
    /**
     * ⚠️ **characterization テスト（現挙動の固定・要修正の記録）**
     *
     * plan 032 は「切替後は `amount` も PayPal 経路の権威値（`order.total`）に更新される」
     * ことを期待していたが、**実装はそうなっていない**。両 route の `upsert` の `update` 分岐は
     * `paymentIntentId` / `paymentMethod` / `status` / `userId` しか書かず、
     * **`amount` と `currency` は `create` 分岐にしか無い**
     * （`src/app/api/webhooks/stripe/route.ts` / `paypal/route.ts` の upsert）。
     *
     * 結果として切替後の行は「`paymentMethod: PayPal` なのに `amount` は Stripe の
     * **セント値**」という**単位混在**の状態で残る（CORRECTNESS-05 と同じ単位問題の族）。
     * 本テストはこの現挙動をそのまま固定し、修正時に**正しく赤くなる**ようにしてある。
     * 修正が入ったら下の 2 つの expect を反転すること（`ORDER_TOTAL` に一致させる）。
     */
    it("updates method and intent id but leaves the previous provider's amount (current behavior)", async () => {
        // Arrange
        const { orderId } = await seedOrderForWebhook();

        // Act: Stripe → PayPal の順に配送
        const stripeRes = await deliverStripe(
            stripeEventFor(paymentIntentSucceededFixture, orderId)
        );
        const paypalRes = await deliverPayPal(
            paypalEventFor(captureCompletedFixture, orderId)
        );

        // Assert: 行は 1 本のまま、プロバイダー識別子は切替後の値になる
        expect(stripeRes.status).toBe(200);
        expect(paypalRes.status).toBe(200);
        expect(await countPaymentDetails(orderId)).toBe(1);
        const details = await db.paymentDetails.findUniqueOrThrow({
            where: { orderId },
        });
        expect(details.paymentMethod).toBe("PayPal");
        expect(details.paymentIntentId).toBe("CAPTURE-COMPLETED-001");
        expect(details.status).toBe("Paid");

        // ⚠️ 現挙動: amount / currency は update 分岐に無いため切替前の値が残る。
        // 期待される姿は ORDER_TOTAL（"110.00"）だが、実際は Stripe の 9999（cents）。
        expect(details.amount.toFixed(2)).toBe(
            new Prisma.Decimal(STRIPE_FIXTURE_AMOUNT_CENTS).toFixed(2)
        );
        expect(details.amount.toFixed(2)).not.toBe(ORDER_TOTAL);

        const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.paymentMethod).toBe("PayPal");
    });
});
