import { POST } from "./route";
import { createMockOrder } from "@/config/test-fixtures";
import { TEST_CONFIG } from "@/config/test-config";
import Stripe from "stripe";

import paymentIntentSucceededFixture from "../../../../../tests/fixtures/webhooks/stripe/payment-intent-succeeded.json";
import paymentIntentFailedFixture from "../../../../../tests/fixtures/webhooks/stripe/payment-intent-failed.json";
import chargeRefundedFullFixture from "../../../../../tests/fixtures/webhooks/stripe/charge-refunded-full.json";
import chargeRefundedPartialFixture from "../../../../../tests/fixtures/webhooks/stripe/charge-refunded-partial.json";

// ---- モック設定 ----
jest.mock("@/lib/db", () => ({
    db: {
        order: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        paymentDetails: {
            upsert: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

const mockConstructEvent = jest.fn();
jest.mock("stripe", () => {
    return jest.fn().mockImplementation(() => ({
        webhooks: {
            constructEvent: (
                ...args: Parameters<Stripe["webhooks"]["constructEvent"]>
            ) => mockConstructEvent(...args),
        },
    }));
});

const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => mockHeadersMap.get(key) ?? null,
    }),
}));

const mockDb = require("@/lib/db").db;

const originalEnv = process.env;
beforeAll(() => {
    process.env = {
        ...originalEnv,
        STRIPE_SECRET_KEY: "sk_test_dummy",
        STRIPE_WEBHOOK_SECRET: "whsec_test_dummy",
    };
});
afterAll(() => {
    process.env = originalEnv;
});

beforeEach(() => {
    jest.clearAllMocks();
    mockHeadersMap.clear();
    mockHeadersMap.set("stripe-signature", "t=1,v1=valid-test-signature");
    // $transaction の callback に mockDb をそのまま渡すことで、
    // tx.paymentDetails.upsert / tx.order.update が既存モックを呼ぶ。
    mockDb.$transaction.mockImplementation(
        async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
            callback(mockDb)
    );
});

/**
 * PaymentDetails.amount は event の minor unit ではなく **Order.total**（ドル建て）を格納する
 * 契約なので、期待値もこの order の total から取る（src/queries/stripe.ts と同一契約）。
 */
const SUCCESS_ORDER = createMockOrder({ id: "order-stripe-success" });

const createStripeRequest = (body: unknown) =>
    new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

describe("POST /api/webhooks/stripe", () => {
    // ============================================
    // A. 署名検証
    // ============================================
    describe("署名検証", () => {
        it("stripe-signature ヘッダーがない場合 400 を返す", async () => {
            mockHeadersMap.delete("stripe-signature");

            const response = await POST(
                createStripeRequest(paymentIntentSucceededFixture)
            );

            expect(response.status).toBe(400);
            expect(mockConstructEvent).not.toHaveBeenCalled();
        });

        it("不正な署名の場合 400 を返す", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            mockConstructEvent.mockImplementation(() => {
                throw new Error("No signatures found matching the expected signature");
            });

            const response = await POST(
                createStripeRequest(paymentIntentSucceededFixture)
            );

            expect(response.status).toBe(400);
            expect(mockDb.order.update).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("正常署名の場合は constructEvent に raw body と署名を渡す", async () => {
            mockConstructEvent.mockReturnValue(paymentIntentSucceededFixture);
            mockDb.order.findUnique.mockResolvedValue(SUCCESS_ORDER);
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            await POST(createStripeRequest(paymentIntentSucceededFixture));

            expect(mockConstructEvent).toHaveBeenCalledWith(
                JSON.stringify(paymentIntentSucceededFixture),
                "t=1,v1=valid-test-signature",
                "whsec_test_dummy"
            );
        });
    });

    // ============================================
    // B. 正常系イベント分岐
    // ============================================
    describe("payment_intent.succeeded イベント", () => {
        beforeEach(() => {
            mockConstructEvent.mockReturnValue(paymentIntentSucceededFixture);
            mockDb.order.findUnique.mockResolvedValue(SUCCESS_ORDER);
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});
        });

        it("Order.paymentStatus を Paid に更新する", async () => {
            const response = await POST(
                createStripeRequest(paymentIntentSucceededFixture)
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-stripe-success" },
                data: {
                    paymentStatus: "Paid",
                    paymentMethod: "Stripe",
                },
            });
        });

        it("PaymentDetails を upsert する（paymentIntentId・amount・currency 含む）", async () => {
            await POST(createStripeRequest(paymentIntentSucceededFixture));

            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orderId: "order-stripe-success" },
                    create: expect.objectContaining({
                        paymentIntentId: "pi_test_succeeded",
                        paymentMethod: "Stripe",
                        status: "Paid",
                        orderId: "order-stripe-success",
                        amount: SUCCESS_ORDER.total, // Order.total（ドル建て）
                        currency: "usd", // fixture: payment_intent.currency
                    }),
                    // update 分岐にも amount / currency を持たせる。欠けると provider 切替や
                    // 再送で「前回の値が残る」状態になる（統合テスト Scenario P4）。
                    update: expect.objectContaining({
                        paymentIntentId: "pi_test_succeeded",
                        status: "Paid",
                        amount: SUCCESS_ORDER.total,
                        currency: "usd",
                    }),
                })
            );
        });
    });

    describe("payment_intent.payment_failed イベント", () => {
        it("Order.paymentStatus を Failed に更新する", async () => {
            mockConstructEvent.mockReturnValue(paymentIntentFailedFixture);
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ id: "order-stripe-failed" })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            const response = await POST(
                createStripeRequest(paymentIntentFailedFixture)
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-stripe-failed" },
                data: {
                    paymentStatus: "Failed",
                    paymentMethod: "Stripe",
                },
            });
        });
    });

    describe("charge.refunded イベント", () => {
        beforeEach(() => {
            mockDb.order.findUnique.mockResolvedValue(SUCCESS_ORDER);
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});
        });

        it("全額返金時に Order.paymentStatus を Refunded に更新する", async () => {
            mockConstructEvent.mockReturnValue(chargeRefundedFullFixture);

            const response = await POST(
                createStripeRequest(chargeRefundedFullFixture)
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: "Refunded",
                    }),
                })
            );
        });

        it("部分返金時に Order.paymentStatus を PartiallyRefunded に更新する", async () => {
            mockConstructEvent.mockReturnValue(chargeRefundedPartialFixture);

            const response = await POST(
                createStripeRequest(chargeRefundedPartialFixture)
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: "PartiallyRefunded",
                    }),
                })
            );
        });

        it("paymentIntentId は charge.payment_intent、currency は charge、amount は Order.total から取得する", async () => {
            mockConstructEvent.mockReturnValue(chargeRefundedFullFixture);

            await POST(createStripeRequest(chargeRefundedFullFixture));

            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        paymentIntentId: "pi_test_succeeded",
                        amount: SUCCESS_ORDER.total, // charge.amount (cents) ではない
                        currency: "usd", // fixture: charge.currency
                    }),
                    update: expect.objectContaining({
                        amount: SUCCESS_ORDER.total,
                        currency: "usd",
                    }),
                })
            );
        });
    });

    // ============================================
    // C. 境界系
    // ============================================
    describe("境界系", () => {
        it("metadata.orderId が欠落している場合 400 を返す", async () => {
            // JSON から型推論された metadata.orderId を意図的に剥がす
            const event = JSON.parse(
                JSON.stringify(paymentIntentSucceededFixture)
            ) as { data: { object: { metadata: Record<string, string> } } };
            event.data.object.metadata = {};
            mockConstructEvent.mockReturnValue(event);

            const response = await POST(createStripeRequest(event));

            expect(response.status).toBe(400);
            expect(mockDb.order.findUnique).not.toHaveBeenCalled();
        });

        it("未知のイベントタイプは 200 で no-op になる", async () => {
            mockConstructEvent.mockReturnValue({
                ...paymentIntentSucceededFixture,
                type: "customer.created",
            });

            const response = await POST(createStripeRequest({}));

            expect(response.status).toBe(200);
            expect(mockDb.order.findUnique).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("Order が存在しない場合 404 を返す", async () => {
            mockConstructEvent.mockReturnValue(paymentIntentSucceededFixture);
            mockDb.order.findUnique.mockResolvedValue(null);

            const response = await POST(
                createStripeRequest(paymentIntentSucceededFixture)
            );

            expect(response.status).toBe(404);
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("冪等性: 同一イベントを 2 回送信しても upsert で安全に処理される", async () => {
            mockConstructEvent.mockReturnValue(paymentIntentSucceededFixture);
            mockDb.order.findUnique.mockResolvedValue(SUCCESS_ORDER);
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            await POST(createStripeRequest(paymentIntentSucceededFixture));
            await POST(createStripeRequest(paymentIntentSucceededFixture));

            // 2 回目も upsert を使うため、create ではなく既存レコードの update パスが
            // Prisma 側で選択される（テスト側はモックなので呼ばれたことのみ検証）
            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledTimes(2);
            // 全コールで同一 where と paymentIntentId が渡される
            const calls = mockDb.paymentDetails.upsert.mock.calls;
            expect(calls[0][0].where).toEqual(calls[1][0].where);
            expect(calls[0][0].create.paymentIntentId).toBe(
                calls[1][0].create.paymentIntentId
            );
        });

        it("USD 以外の通貨のイベントは 400 を返し、DB へ何も書かない", async () => {
            // Arrange: PaymentDetails.amount には order.total（USD 建て）が入るため、
            // event の通貨をそのまま currency へ流すと金額と通貨ラベルが別通貨を指す行になる。
            // 多通貨はスコープ外（.claude/steering/product.md）なので 400 で拒否し、行を作らない。
            // ※ 統合テスト Scenario S8 と同一契約だが、統合テストは jest.config.js の
            //   testPathIgnorePatterns で lcov 対象外のため、ユニット層でも固定する。
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            const event = JSON.parse(
                JSON.stringify(paymentIntentSucceededFixture)
            ) as { data: { object: { currency: string } } };
            event.data.object.currency = "eur";
            mockConstructEvent.mockReturnValue(event);
            mockDb.order.findUnique.mockResolvedValue(SUCCESS_ORDER);

            // Act
            const response = await POST(createStripeRequest(event));

            // Assert
            expect(response.status).toBe(400);
            expect(await response.text()).toBe("Unsupported currency");
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("DB エラー時は 500 を返す", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            mockConstructEvent.mockReturnValue(paymentIntentSucceededFixture);
            mockDb.order.findUnique.mockRejectedValue(
                new Error("DB connection lost")
            );

            const response = await POST(
                createStripeRequest(paymentIntentSucceededFixture)
            );

            expect(response.status).toBe(500);
            consoleSpy.mockRestore();
        });

        it("fixture の userId は DEFAULT_USER_ID と関連付けて PaymentDetails に伝播する", async () => {
            mockConstructEvent.mockReturnValue(paymentIntentSucceededFixture);
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({
                    id: "order-stripe-success",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            await POST(createStripeRequest(paymentIntentSucceededFixture));

            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });
    });
});
