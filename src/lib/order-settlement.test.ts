import { PaymentStatus } from "@prisma/client";
import { SETTLED_PAYMENT_STATUSES } from "@/lib/payment-status";

jest.mock("@/lib/db", () => ({
    db: {
        order: {
            findUnique: jest.fn(),
        },
    },
}));

import { hasOrderSettledAfterConflict } from "./order-settlement";
import { db } from "@/lib/db";

const mockFindUnique = db.order.findUnique as jest.Mock;

const STRIPE_PREFIX = "[Stripe:createStripePayment]";
const PAYPAL_PREFIX = "[paypal:capturePayPalPayment]";

/** 未確定（= 決済がまだ不可逆になっていない）ステータス。 */
const UNSETTLED_STATUSES: PaymentStatus[] = [
    "Pending",
    "Failed",
    "Declined",
    "Cancelled",
];

describe("hasOrderSettledAfterConflict", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("再読が成功した場合", () => {
        // SSOT は src/lib/payment-status.ts。ここでハードコードすると
        // 確定済みステータスの追加時に本テストだけ取り残される。
        it.each(SETTLED_PAYMENT_STATUSES)(
            "確定済みステータス %s は true を返す",
            async (paymentStatus) => {
                // Arrange
                mockFindUnique.mockResolvedValue({ paymentStatus });

                // Act
                const result = await hasOrderSettledAfterConflict(
                    "order-001",
                    STRIPE_PREFIX
                );

                // Assert
                expect(result).toBe(true);
            }
        );

        it.each(UNSETTLED_STATUSES)(
            "未確定ステータス %s は false を返す",
            async (paymentStatus) => {
                // Arrange
                mockFindUnique.mockResolvedValue({ paymentStatus });

                // Act
                const result = await hasOrderSettledAfterConflict(
                    "order-001",
                    STRIPE_PREFIX
                );

                // Assert
                expect(result).toBe(false);
            }
        );

        it("注文が存在しない場合は false を返す", async () => {
            // Arrange: P2025 が並行削除に由来する場合、再読でも見つからない
            mockFindUnique.mockResolvedValue(null);

            // Act
            const result = await hasOrderSettledAfterConflict(
                "order-001",
                STRIPE_PREFIX
            );

            // Assert
            expect(result).toBe(false);
        });

        it("paymentStatus のみを userId で絞らずに再読する", async () => {
            // Arrange: 所有権検証は呼び出し元で済んでいるため、ここでは
            // 権威ソースとしての行そのものを読む
            mockFindUnique.mockResolvedValue({ paymentStatus: "Paid" });

            // Act
            await hasOrderSettledAfterConflict("order-001", STRIPE_PREFIX);

            // Assert
            expect(mockFindUnique).toHaveBeenCalledWith({
                where: { id: "order-001" },
                select: { paymentStatus: true },
            });
        });
    });

    describe("再読自体が失敗した場合", () => {
        let consoleSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it("throw せず false を返す（元の P2025 を呼び出し元に残す）", async () => {
            // Arrange
            mockFindUnique.mockRejectedValue(new Error("connection lost"));

            // Act
            const result = await hasOrderSettledAfterConflict(
                "order-001",
                STRIPE_PREFIX
            );

            // Assert
            expect(result).toBe(false);
        });

        it("Error の場合は message と stack を構造化ログに出す", async () => {
            // Arrange
            const failure = new Error("connection lost");
            mockFindUnique.mockRejectedValue(failure);

            // Act
            await hasOrderSettledAfterConflict("order-001", STRIPE_PREFIX);

            // Assert
            expect(consoleSpy).toHaveBeenCalledWith(
                `${STRIPE_PREFIX} Failed to re-read order after P2025`,
                { error: "connection lost", stack: failure.stack }
            );
        });

        it("Error でない値の場合はそのままログに出す", async () => {
            // Arrange: Prisma の生オブジェクトや文字列 throw を想定
            mockFindUnique.mockRejectedValue("string failure");

            // Act
            const result = await hasOrderSettledAfterConflict(
                "order-001",
                STRIPE_PREFIX
            );

            // Assert
            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                `${STRIPE_PREFIX} Failed to re-read order after P2025`,
                { error: "string failure" }
            );
        });

        it("logPrefix が呼び出し元ごとに反映される", async () => {
            // Arrange
            mockFindUnique.mockRejectedValue(new Error("connection lost"));

            // Act
            await hasOrderSettledAfterConflict("order-001", PAYPAL_PREFIX);

            // Assert
            expect(consoleSpy).toHaveBeenCalledWith(
                `${PAYPAL_PREFIX} Failed to re-read order after P2025`,
                expect.objectContaining({ error: "connection lost" })
            );
        });
    });
});
