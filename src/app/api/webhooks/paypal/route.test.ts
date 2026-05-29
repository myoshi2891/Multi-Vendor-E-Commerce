import { POST } from "./route";
import { createMockOrder } from "@/config/test-fixtures";
import { TEST_CONFIG } from "@/config/test-config";

import captureCompletedFixture from "../../../../../tests/fixtures/webhooks/paypal/payment-capture-completed.json";
import captureDeniedFixture from "../../../../../tests/fixtures/webhooks/paypal/payment-capture-denied.json";
import captureRefundedFixture from "../../../../../tests/fixtures/webhooks/paypal/payment-capture-refunded.json";

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

const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
    headers: () => ({
        get: (key: string) => mockHeadersMap.get(key) ?? null,
    }),
}));

type MockResponseShape = {
    ok: boolean;
    status?: number;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
};
const mockFetch = jest.fn<Promise<MockResponseShape>, [unknown, unknown?]>();
global.fetch = mockFetch as unknown as typeof fetch;

const mockDb = require("@/lib/db").db;

const originalEnv = process.env;
beforeAll(() => {
    process.env = {
        ...originalEnv,
        NEXT_PUBLIC_PAYPAL_CLIENT_ID: "paypal-client-id-test",
        PAYPAL_SECRET: "paypal-secret-test",
        PAYPAL_WEBHOOK_ID: "WEBHOOK-ID-TEST",
        PAYPAL_API_BASE: "https://api-m.sandbox.paypal.com",
    };
});
afterAll(() => {
    process.env = originalEnv;
});

const setPayPalHeaders = () => {
    mockHeadersMap.set("paypal-transmission-id", "transmission-id-test");
    mockHeadersMap.set("paypal-transmission-time", "2026-05-28T10:00:00Z");
    mockHeadersMap.set("paypal-transmission-sig", "sig-test");
    mockHeadersMap.set("paypal-cert-url", "https://api-m.paypal.com/cert");
    mockHeadersMap.set("paypal-auth-algo", "SHA256withRSA");
};

const mockSignatureVerification = (status: "SUCCESS" | "FAILURE") => {
    // 1st fetch: OAuth token, 2nd fetch: verify-webhook-signature
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "test-access-token" }),
    });
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification_status: status }),
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockHeadersMap.clear();
    setPayPalHeaders();
    // $transaction の callback に mockDb をそのまま渡すことで、
    // tx.paymentDetails.upsert / tx.order.update が既存モックを呼ぶ。
    mockDb.$transaction.mockImplementation(
        async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
            callback(mockDb)
    );
});

const createPayPalRequest = (body: unknown) =>
    new Request("http://localhost:3000/api/webhooks/paypal", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

describe("POST /api/webhooks/paypal", () => {
    // ============================================
    // A. 署名検証
    // ============================================
    describe("ヘッダー検証", () => {
        it("paypal-transmission-id ヘッダーがない場合 400 を返す", async () => {
            mockHeadersMap.delete("paypal-transmission-id");

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(400);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("paypal-transmission-sig ヘッダーがない場合 400 を返す", async () => {
            mockHeadersMap.delete("paypal-transmission-sig");

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(400);
        });
    });

    describe("PayPal 署名検証 API", () => {
        it("verification_status が SUCCESS 以外の場合 400 を返す", async () => {
            mockSignatureVerification("FAILURE");

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(400);
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("OAuth token 取得失敗時は 500 を返す（外部障害は再送可能な 5xx で返す）", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: () => Promise.resolve("invalid_client"),
            });

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(500);
            expect(mockDb.order.findUnique).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("verify API が HTTP エラーを返した場合 500 を返す（無効署名と区別する）", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            // 1st: OAuth token OK
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ access_token: "test-access-token" }),
            });
            // 2nd: verify API が 503 を返す → 外部障害として throw → 5xx
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 503,
                text: () => Promise.resolve("service unavailable"),
            });

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(500);
            expect(mockDb.order.findUnique).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("verify API に必要なヘッダーと webhook_id をペイロードに含める", async () => {
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ id: "order-paypal-success" })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            await POST(createPayPalRequest(captureCompletedFixture));

            // 2 回目の fetch (verify) を検証
            const verifyCall = mockFetch.mock.calls[1];
            expect(verifyCall[0]).toContain("/v1/notifications/verify-webhook-signature");
            const requestInit = verifyCall[1] as { body: string };
            const body = JSON.parse(requestInit.body);
            expect(body).toMatchObject({
                webhook_id: "WEBHOOK-ID-TEST",
                transmission_id: "transmission-id-test",
                auth_algo: "SHA256withRSA",
            });
            expect(body.webhook_event).toMatchObject({
                event_type: "PAYMENT.CAPTURE.COMPLETED",
            });
        });
    });

    // ============================================
    // B. 正常系イベント分岐
    // ============================================
    describe("PAYMENT.CAPTURE.COMPLETED イベント", () => {
        beforeEach(() => {
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ id: "order-paypal-success" })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});
        });

        it("Order.paymentStatus を Paid に更新する", async () => {
            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-paypal-success" },
                data: {
                    paymentStatus: "Paid",
                    paymentMethod: "PayPal",
                },
            });
        });

        it("PaymentDetails を upsert する（resource.id を paymentIntentId に格納）", async () => {
            await POST(createPayPalRequest(captureCompletedFixture));

            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { orderId: "order-paypal-success" },
                    create: expect.objectContaining({
                        paymentIntentId: "CAPTURE-COMPLETED-001",
                        paymentMethod: "Paypal",
                        status: "Paid",
                    }),
                })
            );
        });

        it("paymentDetails.upsert と order.update を $transaction で囲んでアトミックに実行する", async () => {
            await POST(createPayPalRequest(captureCompletedFixture));

            // 実装が serial 呼び出しに退行した場合、このアサーションが落ちて検知する
            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
            expect(mockDb.$transaction).toHaveBeenCalledWith(expect.any(Function));
            // tx 経由で 2 つの書き込みがそれぞれ 1 回ずつ呼ばれる
            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledTimes(1);
            expect(mockDb.order.update).toHaveBeenCalledTimes(1);
        });
    });

    describe("PAYMENT.CAPTURE.DENIED イベント", () => {
        it("Order.paymentStatus を Failed に更新する", async () => {
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ id: "order-paypal-denied" })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            const response = await POST(
                createPayPalRequest(captureDeniedFixture)
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-paypal-denied" },
                data: {
                    paymentStatus: "Failed",
                    paymentMethod: "PayPal",
                },
            });
        });
    });

    describe("PAYMENT.CAPTURE.REFUNDED イベント", () => {
        it("Order.paymentStatus を Refunded に更新する", async () => {
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ id: "order-paypal-success" })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            const response = await POST(
                createPayPalRequest(captureRefundedFixture)
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
    });

    // ============================================
    // C. 境界系
    // ============================================
    describe("境界系", () => {
        it("resource.custom_id が欠落している場合 400 を返す", async () => {
            mockSignatureVerification("SUCCESS");
            const event = JSON.parse(
                JSON.stringify(captureCompletedFixture)
            ) as { resource: { custom_id?: string } };
            delete event.resource.custom_id;

            const response = await POST(createPayPalRequest(event));

            expect(response.status).toBe(400);
            expect(mockDb.order.findUnique).not.toHaveBeenCalled();
        });

        it("未知のイベントタイプは 200 で no-op になる", async () => {
            mockSignatureVerification("SUCCESS");

            const response = await POST(
                createPayPalRequest({
                    ...captureCompletedFixture,
                    event_type: "CHECKOUT.ORDER.APPROVED",
                })
            );

            expect(response.status).toBe(200);
            expect(mockDb.order.findUnique).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("Order が存在しない場合 404 を返す", async () => {
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(null);

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(404);
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("冪等性: 同一イベントを 2 回送信しても upsert で安全に処理される", async () => {
            mockSignatureVerification("SUCCESS");
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ id: "order-paypal-success" })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            await POST(createPayPalRequest(captureCompletedFixture));
            await POST(createPayPalRequest(captureCompletedFixture));

            expect(mockDb.paymentDetails.upsert).toHaveBeenCalledTimes(2);
            const calls = mockDb.paymentDetails.upsert.mock.calls;
            expect(calls[0][0].where).toEqual(calls[1][0].where);
            expect(calls[0][0].create.paymentIntentId).toBe(
                calls[1][0].create.paymentIntentId
            );
        });

        it("DB エラー時は 500 を返す", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockRejectedValue(
                new Error("DB connection lost")
            );

            const response = await POST(
                createPayPalRequest(captureCompletedFixture)
            );

            expect(response.status).toBe(500);
            consoleSpy.mockRestore();
        });

        it("Order の userId が PaymentDetails の userId に伝播する", async () => {
            mockSignatureVerification("SUCCESS");
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({
                    id: "order-paypal-success",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                })
            );
            mockDb.paymentDetails.upsert.mockResolvedValue({});
            mockDb.order.update.mockResolvedValue({});

            await POST(createPayPalRequest(captureCompletedFixture));

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
