import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { createPayPalPayment, capturePayPalPayment } from "./paypal";
import { SETTLED_PAYMENT_STATUSES } from "@/lib/payment-status";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockOrder,
    createMockPaymentDetails,
} from "../config/test-fixtures";

// 確定済みステータスを除外する CAS 条件。order.update の where に付与され、
// read-then-act ガード通過後に別リクエストが確定させたケースを DB 側で弾く。
const NOT_SETTLED = { paymentStatus: { notIn: [...SETTLED_PAYMENT_STATUSES] } };

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

            await expect(createPayPalPayment("order-001")).rejects.toThrow(
                "Unauthenticated."
            );
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

            await expect(createPayPalPayment("nonexistent")).rejects.toThrow(
                "Order not found"
            );
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
            expect(callBody.purchase_units[0].amount.currency_code).toBe("USD");
        });

        it("intentがCAPTUREで送信される", async () => {
            const order = createMockOrder({ total: 25.0 });
            mockDb.order.findUnique.mockResolvedValue(order);
            mockFetch.mockResolvedValue({
                json: () =>
                    Promise.resolve({ id: "PP-789", status: "CREATED" }),
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
                json: () =>
                    Promise.resolve({ id: "PP-meta", status: "CREATED" }),
            });

            await createPayPalPayment("order-custom-id");

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.purchase_units[0].custom_id).toBe(
                "order-custom-id"
            );
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

            await expect(createPayPalPayment("order-001")).rejects.toThrow(
                "Failed to create PayPal payment"
            );
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

            await expect(
                createPayPalPayment("other-user-order")
            ).rejects.toThrow("Order not found");

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
/**
 * PayPal Order retrieve（capture 前の GET）の応答。
 *
 * `createPayPalPayment` が作成時に送る形（`purchase_units[].custom_id` /
 * `purchase_units[].amount`）と同じ構造で返る。capture 応答と違い
 * `payments.captures[]` は**まだ存在しない**ため、検証は注文レベルの
 * `amount` を読む必要がある。
 */
const buildOrderRetrieveResponse = (
    overrides: {
        customId?: string;
        value?: string;
        currencyCode?: string;
    } = {}
) => ({
    id: "PAYPAL-ORDER-123",
    status: "APPROVED",
    purchase_units: [
        {
            custom_id: overrides.customId ?? "order-001",
            amount: {
                currency_code: overrides.currencyCode ?? "USD",
                value: overrides.value ?? "99.99",
            },
        },
    ],
});

/**
 * retrieve（GET）と capture（POST /capture）を **URL で振り分ける** fetch モック。
 *
 * 単一の `mockFetch.mockResolvedValue()` では両方に同じ本文が返るため、
 * 「capture 前の検証」と「capture 応答の検証」を独立に駆動できない
 * （前者は `purchase_units[].amount`、後者は
 * `purchase_units[].payments.captures[].amount` を読む別の形）。
 */
const mockPayPalFetch = ({
    orderResponse = buildOrderRetrieveResponse(),
    captureResponse,
}: {
    orderResponse?: unknown;
    captureResponse?: unknown;
}) => {
    mockFetch.mockImplementation((input: unknown) =>
        Promise.resolve({
            ok: true,
            json: () =>
                Promise.resolve(
                    String(input).endsWith("/capture")
                        ? captureResponse
                        : orderResponse
                ),
        })
    );
};

/** capture URL で呼ばれた fetch のみを抽出する（順序・有無の assert 用）。 */
const captureCalls = () =>
    mockFetch.mock.calls.filter(([input]) =>
        String(input).endsWith("/capture")
    );

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
            // 所有権チェック（IDOR 防止）で利用される findUnique。
            // total は capture 前の retrieve 突合（金額/通貨）を通過させるため
            // `buildOrderRetrieveResponse` の既定値 99.99 に合わせる。ここで検証したいのは
            // **capture 応答側**の分岐なので、その手前で落ちないようにする。
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
        });

        it("キャプチャ失敗時にOrder.paymentStatusをFailedに更新する", async () => {
            mockPayPalFetch({
                captureResponse: {
                    // custom_id は status を問わず検証されるため、失敗応答でも
                    // 自注文への相関を示す必要がある。
                    status: "FAILED",
                    purchase_units: [{ custom_id: "order-001" }],
                },
            });
            const updatedOrder = createMockOrder({ paymentStatus: "Failed" });
            mockDb.order.update.mockResolvedValue(updatedOrder);

            const result = await capturePayPalPayment(
                "order-001",
                "PAYPAL-ORDER-123"
            );

            expect(result).toEqual(updatedOrder);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001", ...NOT_SETTLED },
                data: { paymentStatus: "Failed" },
            });
        });

        it("非 COMPLETED でも custom_id 不一致なら Failed 更新せずに拒否する", async () => {
            // 他人の PayPal Order id を渡し、その DENIED/DECLINED 応答で
            // 自分の注文を Failed へ落とす経路を塞ぐ。custom_id の検証は
            // status 分岐より上流になければ、この書き込みに到達してしまう。
            mockPayPalFetch({
                captureResponse: {
                    status: "DECLINED",
                    purchase_units: [{ custom_id: "other-order-999" }],
                },
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
            mockPayPalFetch({ captureResponse: mockCaptureResponse });
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
            mockPayPalFetch({ captureResponse: mockCaptureResponse });
            const paymentDetails = createMockPaymentDetails({
                id: "pd-paypal",
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(paymentDetails);
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await capturePayPalPayment("order-001", "PAYPAL-ORDER-123");

            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "order-001", ...NOT_SETTLED },
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
            mockPayPalFetch({ captureResponse: mockCaptureResponse });
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
            mockPayPalFetch({ captureResponse: mockCaptureResponse });
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
            mockPayPalFetch({
                captureResponse: buildCaptureResponse({ value: "1.00" }),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal capture amount/currency mismatch.");
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("custom_id が orderId と不一致の場合スローし、Paid 更新しない", async () => {
            mockPayPalFetch({
                captureResponse: buildCaptureResponse({
                    customId: "other-order-999",
                }),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal capture does not match order.");
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("currency_code が USD 以外の場合スローし、Paid 更新しない", async () => {
            mockPayPalFetch({
                captureResponse: buildCaptureResponse({ currencyCode: "JPY" }),
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

        const p2025 = () =>
            new Prisma.PrismaClientKnownRequestError(
                "An operation failed because it depends on one or more records that were required but not found.",
                { code: "P2025", clientVersion: "5.22.0" }
            );

        it("並行 capture: findUnique 通過後に確定した場合も CAS で拒否される", async () => {
            // read-then-act ガードは単一プロセス内でしか効かない。findUnique が
            // Pending を返した後に別リクエストが Paid を確定させると、update の
            // where が 0 件マッチとなり Prisma が P2025 を投げる。これを既存の
            // settled メッセージへ写像し、外から見た挙動を同期ガードと揃える。
            //
            // findUnique は 2 回呼ばれる: 1 回目は冒頭の事前チェック（この時点では
            // 未確定だからこそ処理が先へ進む）、2 回目は P2025 を捕まえた後の再読。
            // 本番で CAS が外れるのは他経路が Paid を書いたからなので、再読は
            // 確定済みを返す。
            mockPayPalFetch({ captureResponse: buildCaptureResponse({}) });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            mockDb.order.findUnique
                .mockResolvedValueOnce(createMockOrder({ total: 99.99 }))
                .mockResolvedValueOnce(
                    createMockOrder({ total: 99.99, paymentStatus: "Paid" })
                );
            mockDb.order.update.mockRejectedValue(p2025());

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("Order payment is already settled.");
        });

        // P2025 は CAS 不一致に固有のコードではない — order の並行削除や
        // `paymentDetails.connect` の対象消失でも同じコードが返る。無条件に
        // settled へ写像すると、実際の障害が「決済確定済み」として誤報告され、
        // 呼び出し側は「もう払えている」と信じて調査もリトライもしなくなる。
        // 再読しても未確定なら正規化してはならない（stripe.ts と同じ契約）。
        it("再読しても未確定なら P2025 を settled へ正規化しない", async () => {
            mockPayPalFetch({ captureResponse: buildCaptureResponse({}) });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            // 事前チェック・再読とも未確定（＝確定させた他経路が存在しない）。
            // `jest.clearAllMocks()` は呼び出し履歴しか消さず `mockResolvedValueOnce`
            // のキューは残るため、直前テストの積み残しを踏まないよう明示的に reset する
            // （これが無いと事前チェックが他テストの Paid を拾い、:209 の同期ガードで
            // 落ちて「settled に化けた」ように見える別の失敗になる）。
            mockDb.order.findUnique.mockReset();
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
            mockDb.order.update.mockRejectedValue(p2025());
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // paypal.ts は stripe.ts と違い元エラーを再 throw せず汎用メッセージで
            // 包む設計。ここで固定するのは「settled に化けないこと」であり、
            // 汎用経路へ落ちること自体は既存の契約どおり。
            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("Failed to capture PayPal payment");

            consoleSpy.mockRestore();
        });
    });

    // capture 応答の検証は「金が動いた後」にしか働かない。過少支払い / 他人の
    // PayPal Order 流用は、throw しても課金そのものは成立してしまう（返金という
    // 別経路の運用が必要になる）。retrieve で先に突合し、不一致なら **capture を
    // 呼ばない**のが本来の形（plans/059 item 4）。
    // capture 後の検証は削除せず残す（PayPal 側で capture 時に値が変わる経路への
    // 二重防御。retrieve → capture の間に承認が差し替わる TOCTOU も塞げない）。
    describe("capture 前の PayPal Order 検証（課金前に不一致を拒否）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findUnique.mockResolvedValue(
                createMockOrder({ total: 99.99 })
            );
        });

        it("custom_id 不一致なら capture を呼ばずに拒否する", async () => {
            mockPayPalFetch({
                orderResponse: buildOrderRetrieveResponse({
                    customId: "other-order-999",
                }),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal order does not match order.");

            expect(captureCalls()).toHaveLength(0);
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("amount が order.total と不一致なら capture を呼ばずに拒否する", async () => {
            mockPayPalFetch({
                orderResponse: buildOrderRetrieveResponse({ value: "1.00" }),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal order amount/currency mismatch.");

            expect(captureCalls()).toHaveLength(0);
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("currency_code が USD 以外なら capture を呼ばずに拒否する", async () => {
            mockPayPalFetch({
                orderResponse: buildOrderRetrieveResponse({
                    currencyCode: "JPY",
                }),
            });

            await expect(
                capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
            ).rejects.toThrow("PayPal order amount/currency mismatch.");

            expect(captureCalls()).toHaveLength(0);
            expect(mockDb.paymentDetails.upsert).not.toHaveBeenCalled();
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        it("正常系では retrieve (GET) → capture (POST) の順で呼ぶ", async () => {
            mockPayPalFetch({
                captureResponse: {
                    status: "COMPLETED",
                    purchase_units: [
                        {
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
                },
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await capturePayPalPayment("order-001", "PAYPAL-ORDER-123");

            const urls = mockFetch.mock.calls.map(([input]) => String(input));
            expect(urls).toEqual([
                "https://api.sandbox.paypal.com/v2/checkout/orders/PAYPAL-ORDER-123",
                "https://api.sandbox.paypal.com/v2/checkout/orders/PAYPAL-ORDER-123/capture",
            ]);
            expect(mockFetch.mock.calls[0][1]).toEqual(
                expect.objectContaining({ method: "GET" })
            );
        });

        it("retrieve と capture は独立した AbortSignal（= 独立したタイムアウト予算）を受け取る", async () => {
            // 単一の AbortController を 2 つの fetch で共有すると、10 秒は
            // 「retrieve + capture の合計」に課される期限になる。retrieve が
            // 9.9 秒かかった場合、capture は残り 0.1 秒で中断されうる —— つまり
            // **金が動く側の呼び出しほど中断されやすい**という最悪の相関が生まれる。
            // capture が途中 abort されると、PayPal 側で課金が成立していても
            // 呼び出し元には失敗が返り、返金という別経路の運用が必要になる。
            mockPayPalFetch({
                captureResponse: {
                    status: "COMPLETED",
                    purchase_units: [
                        {
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
                },
            });
            mockDb.paymentDetails.upsert.mockResolvedValue(
                createMockPaymentDetails()
            );
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await capturePayPalPayment("order-001", "PAYPAL-ORDER-123");

            const retrieveSignal = mockFetch.mock.calls[0][1].signal;
            const captureSignal = mockFetch.mock.calls[1][1].signal;

            expect(retrieveSignal).toBeInstanceOf(AbortSignal);
            expect(captureSignal).toBeInstanceOf(AbortSignal);
            // 同一インスタンスなら予算を共有している = 上記の相関が成立する
            expect(captureSignal).not.toBe(retrieveSignal);
            // capture 発行時点で中断されていないこと
            expect(captureSignal.aborted).toBe(false);
        });

        it("retrieve 側で拒否しても保留中のタイムアウトを残さない", async () => {
            // 現行実装でも既に成立している性質（catch が clearTimeout を持つ）だが、
            // タイムアウト予算を fetch ごとに分割するリファクタで最も壊しやすいのが
            // ここ —— 予算が 2 つに増えると、解放漏れの経路も 2 倍になる。
            // 予算の持ち主が変わっても「関数を抜けたらタイマーは残らない」が保たれる
            // ことを固定する回帰ガードとして置く（Red ではなく不変条件の明文化）。
            jest.useFakeTimers();
            try {
                mockPayPalFetch({
                    orderResponse: buildOrderRetrieveResponse({
                        customId: "other-order-999",
                    }),
                });

                await expect(
                    capturePayPalPayment("order-001", "PAYPAL-ORDER-123")
                ).rejects.toThrow("PayPal order does not match order.");

                expect(captureCalls()).toHaveLength(0);
                expect(jest.getTimerCount()).toBe(0);
            } finally {
                jest.useRealTimers();
            }
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
