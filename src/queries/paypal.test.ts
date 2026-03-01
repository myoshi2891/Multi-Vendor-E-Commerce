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
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
            ).rejects.toThrow("Failed to create PayPal payment");
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
            ).rejects.toThrow("Failed to create PayPal payment");
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
        });

        it("キャプチャ失敗時にOrder.paymentStatusをFailedに更新する", async () => {
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        status: "FAILED",
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
    });

    describe("キャプチャ成功", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        const mockCaptureResponse = {
            status: "COMPLETED",
            purchase_units: [
                {
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
                paymentMethod: "Paypal",
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
                        paymentMethod: "Paypal",
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
});
