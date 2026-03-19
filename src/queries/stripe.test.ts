import { currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { createStripePaymentIntent, createStripePayment } from "./stripe";
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

// Stripeモック
jest.mock("stripe");

const MockedStripe = jest.mocked(Stripe);
const mockStripePaymentIntentsCreate = jest.fn();

MockedStripe.mockImplementation(() => ({
    paymentIntents: {
        create: mockStripePaymentIntentsCreate,
    },
} as unknown as Stripe));

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

            expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith({
                amount: 9999, // $99.99 → 9999セント
                currency: "usd",
                automatic_payment_methods: { enabled: true },
            });
            expect(result).toEqual({
                paymentIntentId: "pi_test_123",
                clientSecret: "pi_test_123_secret",
            });
        });

        it("小数点以下の丸め処理が正しく行われる", async () => {
            const order = createMockOrder({ total: 10.005 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockStripePaymentIntentsCreate.mockResolvedValue({
                id: "pi_test_456",
                client_secret: "pi_test_456_secret",
            });

            await createStripePaymentIntent("order-001");

            // Math.round(10.005 * 100) = 1001
            expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: 1001,
                })
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
                expect.objectContaining({ amount: 1 })
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
    };

    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                createStripePayment("order-001", mockPaymentIntent as never)
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
                createStripePayment("nonexistent", mockPaymentIntent as never)
            ).rejects.toThrow("Order not found.");
        });
    });

    describe("決済処理", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());
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
                mockPaymentIntent as never
            );

            expect(result).toEqual(updatedOrder);
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

            await createStripePayment(
                "order-001",
                mockPaymentIntent as never
            );

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
                status: "failed",
            };
            const paymentDetails = createMockPaymentDetails({
                status: "failed",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await createStripePayment(
                "order-001",
                failedPaymentIntent as never
            );

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentStatus: "Failed",
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

            await createStripePayment(
                "order-001",
                mockPaymentIntent as never
            );

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
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());
            mockDb.paymentDetails.upsert.mockRejectedValue(
                new Error("DB error")
            );

            await expect(
                createStripePayment("order-001", mockPaymentIntent as never)
            ).rejects.toThrow("DB error");

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
