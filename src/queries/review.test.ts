import { currentUser } from "@clerk/nextjs/server";
import { upsertReview } from "./review";
import { TEST_CONFIG } from "../config/test-config";
import type { ReviewDetailsType } from "@/lib/types";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        review: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        product: {
            update: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

// テスト用レビューデータ
const createMockReviewInput = (
    overrides: Partial<ReviewDetailsType> = {}
): ReviewDetailsType => ({
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
                upsertReview("product-001", createMockReviewInput())
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
                upsertReview("", createMockReviewInput())
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

        it("新規レビューをcreateで作成する（クライアント提供IDは無視される）", async () => {
            const reviewInput = createMockReviewInput();
            const createdReview = {
                ...reviewInput,
                id: "server-generated-id",
                productId: "product-001",
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            };
            mockDb.review.create.mockResolvedValue(createdReview);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            const result = await upsertReview(
                "product-001",
                reviewInput
            );

            expect(result).toEqual(createdReview);
            expect(mockDb.review.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        productId: "product-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
            // クライアント提供のIDはwhereに使用されない
            expect(mockDb.review.update).not.toHaveBeenCalled();
        });

        it("画像をcreateで保存する", async () => {
            const reviewInput = createMockReviewInput({
                images: [
                    { url: "https://example.com/img1.jpg" },
                    { url: "https://example.com/img2.jpg" },
                ],
            });
            mockDb.review.create.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

            expect(mockDb.review.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
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

        it("既存レビューがある場合、サーバー検証済みIDで更新する", async () => {
            const existingReview = {
                id: "existing-review-001",
                productId: "product-001",
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            };
            mockDb.review.findFirst.mockResolvedValue(existingReview);

            const reviewInput = createMockReviewInput({ id: "client-provided-id" });
            mockDb.review.update.mockResolvedValue({
                ...reviewInput,
                id: "existing-review-001",
            });
            mockDb.review.findMany.mockResolvedValue([{ rating: 4 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

            // クライアント提供のIDではなく、サーバー検証済みの既存レビューIDが使われる
            expect(mockDb.review.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "existing-review-001" },
                })
            );
            expect(mockDb.review.create).not.toHaveBeenCalled();
        });

        it("更新時に既存画像を全削除して再作成する", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
            });
            const reviewInput = createMockReviewInput();
            mockDb.review.update.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

            expect(mockDb.review.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
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
            mockDb.review.create.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([
                { rating: 5 },
                { rating: 3 },
                { rating: 4 },
            ]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

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
            mockDb.review.create.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 3 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

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
            mockDb.review.create.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([
                { rating: 5 },
                { rating: 4 },
            ]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

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
            mockDb.review.create.mockResolvedValue(reviewInput);
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", reviewInput);

            expect(mockDb.review.create).toHaveBeenCalledWith(
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
                upsertReview("product-001", createMockReviewInput())
            ).rejects.toThrow("Error updating review");
        });
    });
});
