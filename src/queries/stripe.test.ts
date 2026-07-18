import { currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { createStripePaymentIntent, createStripePayment } from "./stripe";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockOrder,
    createMockPaymentDetails,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        order: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        paymentDetails: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
        },
    },
}));

// Stripeモック
const mockStripePaymentIntentsCreate = jest.fn();
const mockStripePaymentIntentsRetrieve = jest.fn();
jest.mock("stripe", () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: (...args: Parameters<Stripe["paymentIntents"]["create"]>) =>
                mockStripePaymentIntentsCreate(...args),
            retrieve: (
                ...args: Parameters<Stripe["paymentIntents"]["retrieve"]>
            ) => mockStripePaymentIntentsRetrieve(...args),
        },
    }));
});

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// createStripePaymentIntent
// ==================================================
describe("createStripePaymentIntent", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                createStripePaymentIntent("order-001")
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("存在しない注文の場合エラーをスローする", async () => {
            mockDb.order.findUnique.mockResolvedValue(null);

            await expect(
                createStripePaymentIntent("nonexistent")
            ).rejects.toThrow("Order not found.");
        });
    });

    describe("PaymentIntent作成", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("正確な金額（セント単位）でPaymentIntentを作成する", async () => {
            const order = createMockOrder({ total: 99.99 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_test_123",
                client_secret: "pi_test_123_secret",
            });

            const result = await createStripePaymentIntent("order-001");

            expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
                {
                    amount: 9999, // $99.99 → 9999セント
                    currency: "usd",
                    automatic_payment_methods: { enabled: true },
                    metadata: { orderId: "order-001" },
                },
                expect.objectContaining({
                    idempotencyKey: expect.any(String),
                })
            );
            expect(result).toEqual({
                paymentIntentId: "pi_test_123",
                clientSecret: "pi_test_123_secret",
            });
        });

        it("Webhook 相関用に metadata.orderId を PaymentIntent に付与する", async () => {
            // Webhook (src/app/api/webhooks/stripe) で event.data.object.metadata.orderId から
            // 内部 Order を逆引きするため、metadata の付与は破壊的変更として保護する。
            const order = createMockOrder({ total: 50 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_meta_001",
                client_secret: "pi_meta_001_secret",
            });

            await createStripePaymentIntent("order-meta-test");

            expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { orderId: "order-meta-test" },
                }),
                expect.anything()
            );
        });

        it("小数点以下の丸め処理が正しく行われる", async () => {
            const order = createMockOrder({ total: 10.005 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_test_456",
                client_secret: "pi_test_456_secret",
            });

            await createStripePaymentIntent("order-001");

            // Prisma.Decimal で 10.005 を 1001 セントへ丸める
            expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: 1001,
                }),
                expect.anything()
            );
        });

        it("最小金額 ($0.01) のPaymentIntentを作成できる", async () => {
            const order = createMockOrder({ total: 0.01 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_test_min",
                client_secret: "pi_test_min_secret",
            });

            await createStripePaymentIntent("order-001");

            expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
                expect.objectContaining({ amount: 1 }),
                expect.anything()
            );
        });
    });

    // 冪等キーが無いと、二重クリックやネットワーク再送のたびに Stripe 側へ
    // 新しい intent が作られ、孤児 intent が量産される。さらに paymentDetails の
    // 「有効な intent id」が毎回上書きされるため、先行 intent で決済中のユーザーが
    // createStripePayment で拒否されうる。
    describe("冪等性", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("同一注文・同一金額の再実行では同じ冪等キーを送る", async () => {
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 42.5 })
            );
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_idem_001",
                client_secret: "pi_idem_001_secret",
            });

            await createStripePaymentIntent("order-idem");
            await createStripePaymentIntent("order-idem");

            const [, firstOptions] =
                mockStripePaymentIntentsCreate.mock.calls[0];
            const [, secondOptions] =
                mockStripePaymentIntentsCreate.mock.calls[1];

            expect(firstOptions.idempotencyKey).toBe(
                secondOptions.idempotencyKey
            );
            expect(firstOptions.idempotencyKey).toContain("order-idem");
        });

        it("注文ごとに異なる冪等キーを送る", async () => {
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_idem_002",
                client_secret: "pi_idem_002_secret",
            });

            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 42.5 })
            );
            await createStripePaymentIntent("order-a");

            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 42.5 })
            );
            await createStripePaymentIntent("order-b");

            const [, firstOptions] =
                mockStripePaymentIntentsCreate.mock.calls[0];
            const [, secondOptions] =
                mockStripePaymentIntentsCreate.mock.calls[1];

            expect(firstOptions.idempotencyKey).not.toBe(
                secondOptions.idempotencyKey
            );
        });

        // Stripe は「同一キー・異なるパラメータ」の再送をエラーで拒否する。
        // 金額をキーに含めないと、クーポン適用等で合計が正当に変わった際に
        // 決済が永久に通らなくなる。
        it("同一注文でも金額が変われば異なる冪等キーを送る", async () => {
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_idem_003",
                client_secret: "pi_idem_003_secret",
            });

            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 100 })
            );
            await createStripePaymentIntent("order-amount");

            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 80 })
            );
            await createStripePaymentIntent("order-amount");

            const [, firstOptions] =
                mockStripePaymentIntentsCreate.mock.calls[0];
            const [, secondOptions] =
                mockStripePaymentIntentsCreate.mock.calls[1];

            expect(firstOptions.idempotencyKey).not.toBe(
                secondOptions.idempotencyKey
            );
        });
    });

    describe("エラーハンドリング", () => {
        it("Stripe APIエラーをログ出力し再スローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 100 })
            );
            const stripeError = new Error("Stripe API error");
            mockStripePaymentIntentsCreate.mockRejectedValue(stripeError);

            await expect(
                createStripePaymentIntent("order-001")
            ).rejects.toThrow(stripeError);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe("IDOR防止（他人の orderId 拒否）", () => {
        // db.order.findUnique の where 句に userId フィルタが含まれることを検証する。
        // 詳細は docs/testing/SECURITY_GAP_REPORT.md を参照。
        it("認証ユーザーの所有しない orderId では Order not found となる", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(null);

            await expect(
                createStripePaymentIntent("other-user-order")
            ).rejects.toThrow("Order not found.");

            expect(mockDb.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: "other-user-order",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });
    });
});

// ==================================================
// createStripePayment
// ==================================================
describe("createStripePayment", () => {
    const mockPaymentIntent = {
        id: "pi_test_123",
        amount: 9999,
        currency: "usd",
        status: "succeeded",
        metadata: { orderId: "order-001" },
    };

    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                createStripePayment("order-001", mockPaymentIntent.id)
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("存在しない注文の場合エラーをスローする", async () => {
            mockDb.order.findUnique.mockResolvedValue(null);

            await expect(
                createStripePayment("nonexistent", mockPaymentIntent.id)
            ).rejects.toThrow("Order not found.");
        });
    });

    describe("決済処理", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // intent.amount(9999) と order.total を一致させる（サーバー側 amount 照合のため）
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
            mockStripePaymentIntentsRetrieve.mockResolvedValue(
                mockPaymentIntent
            );
        });

        it("決済成功時にPaymentDetailsをupsertしステータスをCompletedにする", async () => {
            const paymentDetails = createMockPaymentDetails({
                status: "Completed",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            const updatedOrder = {
                ...createMockOrder({ paymentStatus: "Paid" }),
                paymentDetails,
            };
            mockDb.order.update.mockResolvedValue(updatedOrder);

            const result = await createStripePayment(
                "order-001",
                mockPaymentIntent.id
            );

            expect(result).toEqual(updatedOrder);
            expect(mockStripePaymentIntentsRetrieve).toHaveBeenCalledWith(
                mockPaymentIntent.id
            );
            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orderId: "order-001" },
                    create: expect.objectContaining({
                        paymentIntentId: "pi_test_123",
                        paymentMethod: "Stripe",
                        amount: 9999,
                        currency: "usd",
                        status: "Completed",
                        orderId: "order-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });

        it("決済成功時にOrder.paymentStatusをPaidに更新する", async () => {
            const paymentDetails = createMockPaymentDetails();
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await createStripePayment("order-001", mockPaymentIntent.id);

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "order-001" },
                    data: expect.objectContaining({
                        paymentStatus: "Paid",
                        paymentMethod: "Stripe",
                    }),
                })
            );
        });

        it("決済失敗時にOrder.paymentStatusをFailedに更新する", async () => {
            const failedPaymentIntent = {
                ...mockPaymentIntent,
                status: "requires_payment_method",
                // 拒否された attempt の証跡。これが無い requires_payment_method は
                // 「まだ決済手段が付いていない初期状態」と区別できない。
                last_payment_error: { code: "card_declined" },
            };
            const paymentDetails = createMockPaymentDetails({
                status: "failed",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            mockDb.order.update.mockResolvedValue(createMockOrder());
            mockStripePaymentIntentsRetrieve.mockResolvedValue(
                failedPaymentIntent
            );

            await createStripePayment("order-001", failedPaymentIntent.id);

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: "Failed",
                    }),
                })
            );
        });

        // requires_payment_method は「拒否後」だけでなく PaymentIntent の初期状態でもある。
        // last_payment_error が無い = まだ一度も決済を試みていない = 再試行可能。
        // ここで Failed を確定させると、その後の正常な決済を注文が受け付けられなくなる。
        it("決済手段未設定の requires_payment_method は Pending に更新する", async () => {
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails({ status: "requires_payment_method" })
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                status: "requires_payment_method",
                last_payment_error: null,
            });

            await createStripePayment("order-001", mockPaymentIntent.id);

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: "Pending",
                    }),
                })
            );
        });

        // 3DS 認証待ちや非同期決済手段の intent は「まだ失敗していない」。
        // Failed を確定させると、後続 webhook が succeeded を通知した際に
        // DB 上の paymentStatus と Stripe の真実が食い違う。
        it.each([
            ["processing"],
            ["requires_action"],
            ["requires_confirmation"],
            ["requires_capture"],
        ])(
            "未完了 intent (%s) は Failed ではなく Pending に更新する",
            async (status) => {
                mockDb.paymentDetails.upsert.mockResolvedValue(
                    createMockPaymentDetails({ status })
                );
                mockDb.order.update.mockResolvedValue(createMockOrder());
                mockStripePaymentIntentsRetrieve.mockResolvedValue({
                    ...mockPaymentIntent,
                    status,
                });

                await createStripePayment("order-001", mockPaymentIntent.id);

                expect(mockDb.order.update).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: expect.objectContaining({
                            paymentStatus: "Pending",
                        }),
                    })
                );
            }
        );

        // canceled は失敗ではなく取消。enum に Cancelled がある以上、区別して記録する。
        it("取消済み intent は Cancelled に更新する", async () => {
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails({ status: "canceled" })
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                status: "canceled",
            });

            await createStripePayment("order-001", mockPaymentIntent.id);

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: "Cancelled",
                    }),
                })
            );
        });

        it("PaymentDetailsのconnect(紐付け)が正しく行われる", async () => {
            const paymentDetails = createMockPaymentDetails({
                id: "pd-123",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await createStripePayment("order-001", mockPaymentIntent.id);

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentDetails: {
                            connect: { id: "pd-123" },
                        },
                    }),
                })
            );
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラーをログ出力し再スローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
            mockStripePaymentIntentsRetrieve.mockResolvedValue(
                mockPaymentIntent
            );
            mockDb.paymentDetails.upsert.mockRejectedValue(
                new Error("DB error")
            );

            await expect(
                createStripePayment("order-001", mockPaymentIntent.id)
            ).rejects.toThrow("DB error");

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe("IDOR防止（他人の orderId 拒否）", () => {
        // db.order.findUnique の where 句に userId フィルタが含まれることを検証する。
        // 詳細は docs/testing/SECURITY_GAP_REPORT.md を参照。
        it("認証ユーザーの所有しない orderId では Order not found となる", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(null);

            await expect(
                createStripePayment("other-user-order", mockPaymentIntent.id)
            ).rejects.toThrow("Order not found.");

            expect(mockDb.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: "other-user-order",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });
    });

    describe("PaymentIntent と注文の対応検証", () => {
        it("別注文に紐づく PaymentIntent を拒否し、Order を更新しない", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                metadata: { orderId: "other-order" },
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );

            await expect(
                createStripePayment("order-001", mockPaymentIntent.id)
            ).rejects.toThrow("Payment intent does not match order.");

            expect(mockDb.order.update).not.toHaveBeenCalled();
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
        });
    });

    describe("有効な PaymentIntent の一意性検証", () => {
        // 同一注文に対して createStripePaymentIntent は都度新しい intent を作るため、
        // 古い Pending/canceled intent も metadata・金額・通貨は一致してしまう。
        // 「作成時に保存した有効な intent id」との一致確認で、確定済み決済の退行を防ぐ。
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // mockPaymentIntent.amount(9999) と一致する総額にし、
            // 金額検証ではなく intent id の一致確認に到達させる
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());
        });

        it("作成時に有効な PaymentIntent ID を保存する", async () => {
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_active_001",
                client_secret: "pi_active_001_secret",
                status: "requires_payment_method",
            });

            await createStripePaymentIntent("order-001");

            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orderId: "order-001" },
                    update: expect.objectContaining({
                        paymentIntentId: "pi_active_001",
                    }),
                    create: expect.objectContaining({
                        paymentIntentId: "pi_active_001",
                    }),
                })
            );
        });

        it("保存済みの有効な intent と一致しない古い intent を拒否する", async () => {
            // 有効な intent は pi_active_001。攻撃者は同一注文の古い intent を渡す
            mockDb.paymentDetails.findUnique.mockResolvedValue(
                createMockPaymentDetails({ paymentIntentId: "pi_active_001" })
            );
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                id: "pi_stale_000",
                status: "canceled",
            });

            await expect(
                createStripePayment("order-001", "pi_stale_000")
            ).rejects.toThrow("Payment intent is not active for this order.");

            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("確定済み(Paid)注文を canceled intent で退行させない", async () => {
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99, paymentStatus: "Paid" })
            );
            mockDb.paymentDetails.findUnique.mockResolvedValue(
                createMockPaymentDetails({ paymentIntentId: mockPaymentIntent.id })
            );
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                status: "canceled",
            });

            await expect(
                createStripePayment("order-001", mockPaymentIntent.id)
            ).rejects.toThrow("Order payment is already settled.");

            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("確定済み(Paid)注文に対する新しい intent の作成を拒否する", async () => {
            // 新規 intent を作れてしまうと、保存済みの有効な intent id が
            // 上書きされ、一致確認そのものが迂回される。
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ paymentStatus: "Paid" })
            );

            await expect(
                createStripePaymentIntent("order-001")
            ).rejects.toThrow("Order payment is already settled.");

            expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
        });
    });

    describe("PaymentIntent の金額・通貨照合", () => {
        // metadata.orderId が正しくても、amount/currency が order.total と食い違う
        // intent を弾く（クライアントが金額を改ざんした intent id を渡す攻撃の防御）。
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // order.total = 99.99 → 期待 amount は 9999 セント
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
        });

        it("amount が注文合計と一致しない intent を拒否し、Order を更新しない", async () => {
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                amount: 100, // 改ざんされた低額
            });

            await expect(
                createStripePayment("order-001", mockPaymentIntent.id)
            ).rejects.toThrow("Payment intent amount/currency mismatch.");

            expect(mockDb.order.update).not.toHaveBeenCalled();
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
        });

        it("currency が usd でない intent を拒否し、Order を更新しない", async () => {
            mockStripePaymentIntentsRetrieve.mockResolvedValue({
                ...mockPaymentIntent,
                currency: "jpy",
            });

            await expect(
                createStripePayment("order-001", mockPaymentIntent.id)
            ).rejects.toThrow("Payment intent amount/currency mismatch.");

            expect(mockDb.order.update).not.toHaveBeenCalled();
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
        });
    });
});
