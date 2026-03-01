import { currentUser } from "@clerk/nextjs/server";
import { upsertReview } from "./review";
import { TEST_CONFIG } from "../config/test-config";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        review: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
        product: {
            update: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

// テスト用レビューデータ
const createMockReviewInput = (
    overrides: Record<string, unknown> = {}
) => ({
    id: "review-001",
    review: "Great product, highly recommend!",
    rating: 5,
    images: [{ url: "https://example.com/img1.jpg" }],
    size: "M",
    quantity: "1",
    variant: "Black",
    color: "Black",
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// upsertReview
// ==================================================
describe("upsertReview", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertReview("product-001", createMockReviewInput() as never)
            ).rejects.toThrow("Error updating review");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("productIdが空の場合エラーをスローする", async () => {
            await expect(
                upsertReview("", createMockReviewInput() as never)
            ).rejects.toThrow("Error updating review");
        });
    });

    describe("新規レビュー作成", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // 既存レビューなし
            mockDb.review.findFirst.mockResolvedValue(null);
        });

        it("新規レビューをupsertで作成する", async () => {
            const reviewInput = createMockReviewInput();
            const createdReview = {
                ...reviewInput,
                productId: "product-001",
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            };
            mockDb.review.upsert.mockResolvedValue(createdReview);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            const result = await upsertReview(
                "product-001",
                reviewInput as never
            );

            expect(result).toEqual(createdReview);
            expect(mockDb.review.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: reviewInput.id },
                    create: expect.objectContaining({
                        productId: "product-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });

        it("画像をcreateで保存する", async () => {
            const reviewInput = createMockReviewInput({
                images: [
                    { url: "https://example.com/img1.jpg" },
                    { url: "https://example.com/img2.jpg" },
                ],
            });
            mockDb.review.upsert.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            expect(mockDb.review.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        images: {
                            create: [
                                { url: "https://example.com/img1.jpg" },
                                { url: "https://example.com/img2.jpg" },
                            ],
                        },
                    }),
                })
            );
        });
    });

    describe("既存レビュー更新", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("既存レビューがある場合、そのIDで更新する", async () => {
            const existingReview = {
                id: "existing-review-001",
                productId: "product-001",
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            };
            mockDb.review.findFirst.mockResolvedValue(existingReview);

            const reviewInput = createMockReviewInput({ id: "new-id" });
            mockDb.review.upsert.mockResolvedValue({
                ...reviewInput,
                id: "existing-review-001",
            });
            mockDb.review.findMany.mockResolvedValue([{ rating: 4 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            // 既存レビューのIDが使われる
            expect(mockDb.review.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "existing-review-001" },
                })
            );
        });

        it("更新時に既存画像を全削除して再作成する", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
            });
            const reviewInput = createMockReviewInput();
            mockDb.review.upsert.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            expect(mockDb.review.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({
                        images: expect.objectContaining({
                            deleteMany: {},
                            create: expect.any(Array),
                        }),
                    }),
                })
            );
        });
    });

    describe("商品の平均評価・レビュー数の再計算", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.review.findFirst.mockResolvedValue(null);
        });

        it("レビュー後に平均評価を再計算して商品を更新する", async () => {
            const reviewInput = createMockReviewInput({ rating: 4 });
            mockDb.review.upsert.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([
                { rating: 5 },
                { rating: 3 },
                { rating: 4 },
            ]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            expect(mockDb.product.update).toHaveBeenCalledWith({
                where: { id: "product-001" },
                data: {
                    rating: 4, // (5+3+4)/3 = 4
                    numReviews: 3,
                },
            });
        });

        it("レビュー1件の場合、その評価がそのまま平均になる", async () => {
            const reviewInput = createMockReviewInput({ rating: 3 });
            mockDb.review.upsert.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 3 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            expect(mockDb.product.update).toHaveBeenCalledWith({
                where: { id: "product-001" },
                data: {
                    rating: 3,
                    numReviews: 1,
                },
            });
        });

        it("小数点の平均評価を正しく計算する", async () => {
            const reviewInput = createMockReviewInput({ rating: 4 });
            mockDb.review.upsert.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([
                { rating: 5 },
                { rating: 4 },
            ]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            expect(mockDb.product.update).toHaveBeenCalledWith({
                where: { id: "product-001" },
                data: {
                    rating: 4.5, // (5+4)/2 = 4.5
                    numReviews: 2,
                },
            });
        });

        it("imagesとuserをincludeしてレビューを返す", async () => {
            const reviewInput = createMockReviewInput();
            mockDb.review.upsert.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput as never);

            expect(mockDb.review.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: {
                        images: true,
                        user: true,
                    },
                })
            );
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラー時にラップされたメッセージをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.review.findFirst.mockRejectedValue(
                new Error("DB connection failed")
            );

            await expect(
                upsertReview("product-001", createMockReviewInput() as never)
            ).rejects.toThrow("Error updating review");
        });
    });
});
