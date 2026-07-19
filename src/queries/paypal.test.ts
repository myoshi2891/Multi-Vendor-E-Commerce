import { currentUser } from "@clerk/nextjs/server";
import { createPayPalPayment, capturePayPalPayment } from "./paypal";
import { TEST_CONFIG } from "../config/test-config";
import { createMockOrder, createMockPaymentDetails } from "../config/test-fixtures";

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
        },
    },
}));

// fetch (PayPal API) モック
// 部分的なResponseオブジェクトを返すため、jest.Mock<Promise<Partial<Response>>>で型定義
const mockFetch = jest.fn() as jest.Mock<Promise<Partial<Response>>>;
global.fetch = mockFetch as unknown as typeof fetch;

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// createPayPalPayment
// ==================================================
describe("createPayPalPayment", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                createPayPalPayment("order-001")
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
                createPayPalPayment("nonexistent")
            ).rejects.toThrow("Order not found");
        });
    });

    describe("PayPal Order作成", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("正しい金額でPayPal Orderを作成する", async () => {
            const order = createMockOrder({ total: 99.99 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        id: "PAYPAL-ORDER-123",
                        status: "CREATED",
                    }),
            });

            const result = await createPayPalPayment("order-001");

            expect(result).toEqual({
                id: "PAYPAL-ORDER-123",
                status: "CREATED",
            });
            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.sandbox.paypal.com/v2/checkout/orders",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining('"99.99"'),
                })
            );
        });

        it("通貨がUSDで送信される", async () => {
            const order = createMockOrder({ total: 50.0 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        id: "PAYPAL-ORDER-456",
                        status: "CREATED",
                    }),
            });

            await createPayPalPayment("order-001");

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.purchase_units[0].amount.currency_code).toBe(
                "USD"
            );
        });

        it("intentがCAPTUREで送信される", async () => {
            const order = createMockOrder({ total: 25.0 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve({ id: "PP-789", status: "CREATED" }),
            });

            await createPayPalPayment("order-001");

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.intent).toBe("CAPTURE");
        });

        it("Webhook 相関用に purchase_units[].custom_id を PayPal Order に付与する", async () => {
            // PayPal Webhook (src/app/api/webhooks/paypal) は resource.custom_id から
            // 内部 Order を逆引きするため、custom_id の付与は破壊的変更として保護する。
            const order = createMockOrder({ total: 25.0 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve({ id: "PP-meta", status: "CREATED" }),
            });

            await createPayPalPayment("order-custom-id");

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.purchase_units[0].custom_id).toBe("order-custom-id");
        });
    });

    describe("エラーハンドリング", () => {
        it("PayPal APIエラー時にラップしたエラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 100 })
            );
            mockFetch.mockRejectedValue(new Error("Network error"));

            await expect(
                createPayPalPayment("order-001")
            ).rejects.toThrow("Failed to create PayPal payment");
        });
    });

    describe("IDOR防止（他人の orderId 拒否）", () => {
        // db.order.findUnique の where 句に userId フィルタが含まれることを検証する。
        // 詳細は docs/testing/SECURITY_GAP_REPORT.md を参照。
        it("認証ユーザーの所有しない orderId では Order not found となる", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // 他人の order は userId フィルタで弾かれる
            mockDb.order.findUnique.mockResolvedValue(null);

            await expect(createPayPalPayment("other-user-order"))
                .rejects.toThrow("Order not found");

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
// capturePayPalPayment
// ==================================================
describe("capturePayPalPayment", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("キャプチャ失敗", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // 所有権チェック（IDOR 防止）で利用される findUnique
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());
        });

        it("キャプチャ失敗時にOrder.paymentStatusをFailedに更新する", async () => {
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        // custom_id は status を問わず検証されるため、失敗応答でも
                        // 自注文への相関を示す必要がある。
                        status: "FAILED",
                        purchase_units: [{ custom_id: "order-001" }],
                    }),
            });
            const updatedOrder = createMockOrder({ paymentStatus: "Failed" });
            mockDb.order.update.mockResolvedValue(updatedOrder);

            const result = await capturePayPalPayment(
                "order-001",
                "PAYPAL-ORDER-123"
            );

            expect(result).toEqual(updatedOrder);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { paymentStatus: "Failed" },
            });
        });

        it("非 COMPLETED でも custom_id 不一致なら Failed 更新せずに拒否する", async () => {
            // 他人の PayPal Order id を渡し、その DENIED/DECLINED 応答で
            // 自分の注文を Failed へ落とす経路を塞ぐ。custom_id の検証は
            // status 分岐より上流になければ、この書き込みに到達してしまう。
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        status: "DECLINED",
                        purchase_units: [{ custom_id: "other-order-999" }],
                    }),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal capture does not match order.");
            expect(mockDb.order.update).not.toHaveBeenCalled();
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
        });
    });

    describe("キャプチャ成功", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // 所有権チェック（IDOR 防止）で利用される findUnique
            // capture 検証 (金額 = order.total / custom_id = orderId / USD) を通過するよう
            // total をモック capture 応答の 99.99 に合わせる
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
        });

        const mockCaptureResponse = {
            status: "COMPLETED",
            purchase_units: [
                {
                    // createPayPalPayment が作成時に orderId を custom_id として格納する
                    custom_id: "order-001",
                    payments: {
                        captures: [
                            {
                                amount: {
                                    value: "99.99",
                                    currency_code: "USD",
                                },
                            },
                        ],
                    },
                },
            ],
        };

        it("キャプチャ成功時にPaymentDetailsをupsertする", async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve(mockCaptureResponse),
            });
            const paymentDetails = createMockPaymentDetails({
                paymentMethod: "PayPal",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            const updatedOrder = {
                ...createMockOrder({ paymentStatus: "Paid" }),
                paymentDetails,
            };
            mockDb.order.update.mockResolvedValue(updatedOrder);

            const result = await capturePayPalPayment(
                "order-001",
                "PAYPAL-ORDER-123"
            );

            expect(result).toEqual(updatedOrder);
            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orderId: "order-001" },
                    create: expect.objectContaining({
                        paymentIntentId: "PAYPAL-ORDER-123",
                        paymentMethod: "PayPal",
                        status: "Completed",
                        amount: 99.99,
                        currency: "USD",
                        orderId: "order-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });

        it("Order.paymentStatusをPaidに更新する", async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve(mockCaptureResponse),
            });
            const paymentDetails = createMockPaymentDetails({
                id: "pd-paypal",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await capturePayPalPayment("order-001", "PAYPAL-ORDER-123");

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "order-001" },
                    data: expect.objectContaining({
                        paymentStatus: "Paid",
                        paymentMethod: "PayPal",
                        paymentDetails: {
                            connect: { id: "pd-paypal" },
                        },
                    }),
                })
            );
        });

        it("PayPalキャプチャAPIを正しいURLで呼び出す", async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve(mockCaptureResponse),
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await capturePayPalPayment("order-001", "PAYPAL-ORDER-123");

            expect(mockFetch).toHaveBeenCalledWith(
                "https://api.sandbox.paypal.com/v2/checkout/orders/PAYPAL-ORDER-123/capture",
                expect.objectContaining({ method: "POST" })
            );
        });

        it("PaymentDetailsにpaymentIntentIdが正しく保存される（冪等性の基盤）", async () => {
            mockFetch.mockResolvedValue({
                json: () => Promise.resolve(mockCaptureResponse),
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await capturePayPalPayment("order-001", "PAYPAL-ORDER-123");

            // upsertのwhere条件がorderIdなので、同一orderIdで二度呼ばれてもupdateになる
            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orderId: "order-001" },
                    update: expect.objectContaining({
                        paymentIntentId: "PAYPAL-ORDER-123",
                    }),
                })
            );
        });
    });

    describe("capture 検証（金額/相関/通貨/確定済みガード — Stripe パリティ）", () => {
        // createPayPalPayment が作成時に格納した custom_id (= orderId) /
        // amount.value (= order.total) / currency_code ("USD") を capture 応答で検証し、
        // 不一致時は Paid 確定を拒否する。確定済み注文は capture 前に拒否する。
        const buildCaptureResponse = (overrides: {
            customId?: string;
            value?: string;
            currencyCode?: string;
        }) => ({
            status: "COMPLETED",
            purchase_units: [
                {
                    custom_id: overrides.customId ?? "order-001",
                    payments: {
                        captures: [
                            {
                                amount: {
                                    value: overrides.value ?? "99.99",
                                    currency_code:
                                        overrides.currencyCode ?? "USD",
                                },
                            },
                        ],
                    },
                },
            ],
        });

        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
        });

        it("capture 金額が order.total と不一致の場合スローし、Paid 更新しない", async () => {
            // 安い注文で作った PayPal Order を高い注文の capture に流用する過少支払いベクトル
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve(buildCaptureResponse({ value: "1.00" })),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal capture amount/currency mismatch.");
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("custom_id が orderId と不一致の場合スローし、Paid 更新しない", async () => {
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve(
                        buildCaptureResponse({ customId: "other-order-999" })
                    ),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal capture does not match order.");
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("currency_code が USD 以外の場合スローし、Paid 更新しない", async () => {
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve(
                        buildCaptureResponse({ currencyCode: "JPY" })
                    ),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal capture amount/currency mismatch.");
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("確定済み注文 (Paid) は capture 前に拒否され、PayPal API も呼ばれない", async () => {
            // 遅延/DENIED capture で Paid/Refunded を Failed へ退行させない settled ガード
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99, paymentStatus: "Paid" })
            );

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("Order payment is already settled.");
            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("確定済み注文 (Refunded) も capture 前に拒否される", async () => {
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99, paymentStatus: "Refunded" })
            );

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("Order payment is already settled.");
            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });
    });

    describe("IDOR防止（他人の orderId 拒否）", () => {
        // capturePayPalPayment は PayPal 課金前に userId 付き findUnique で所有権を検証する。
        // 他人の orderId は null となり "Order not found" でスローされる。
        it("認証ユーザーの所有しない orderId では PayPal 課金前に拒否される", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // 所有権チェックで他人の order は見つからない
            mockDb.order.findUnique.mockResolvedValue(null);

            await expect(
                capturePayPalPayment("other-user-order", "PAYPAL-ORDER-123")
            ).rejects.toThrow("Order not found");

            // findUnique の where 句に userId が含まれていることを検証
            expect(mockDb.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: "other-user-order",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
            // PayPal API への課金 fetch が呼ばれていないこと
            expect(mockFetch).not.toHaveBeenCalled();
            // 注文更新も実行されないこと
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });
    });
});
