import { currentUser } from "@clerk/nextjs/server";
import { upsertReview } from "./review";
import { TEST_CONFIG } from "../config/test-config";
import { createMockReview } from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn(),
        },
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

beforeEach(() => {
    jest.clearAllMocks();
    // upsert はフォールバック作成用。戻り値は upsertReview 内で参照しないが、
    // 既定で解決させて undefined による予期せぬ挙動を避ける。
    mockDb.user.upsert.mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
    });
});

// ==================================================
// upsertReview
// ==================================================
describe("upsertReview", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertReview("product-001", createMockReview())
            ).rejects.toThrow("Error updating review");
        });
    });

    describe("ユーザーレコード自動同期 (フォールバック)", () => {
        it("Clerk情報からUserレコードをupsertで原子的に作成/同期する", async () => {
            // Clerk側にはユーザー情報が存在する
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                firstName: "John",
                lastName: "Doe",
                imageUrl: "https://example.com/avatar.jpg",
                emailAddresses: [{ emailAddress: "john@example.com" }],
            });

            // モックの挙動を設定
            mockDb.review.findFirst.mockResolvedValue(null);
            mockDb.review.create.mockResolvedValue(createMockReview());
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", createMockReview());

            // findUnique→create のレースを避けるため upsert でアトミックに作成されること。
            // 既存ユーザーは update: {} で変更しない（フォールバック作成のみが目的）。
            expect(mockDb.user.upsert).toHaveBeenCalledWith({
                where: { id: TEST_CONFIG.DEFAULT_USER_ID },
                update: {},
                create: {
                    id: TEST_CONFIG.DEFAULT_USER_ID,
                    name: "John Doe",
                    email: "john@example.com",
                    picture: "https://example.com/avatar.jpg",
                    role: "USER",
                },
            });
        });

        it("Clerkユーザーにメールアドレスが無い場合はエラーをスローする", async () => {
            // Clerk 側にユーザーは居るが emailAddresses が空
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                firstName: "John",
                lastName: "Doe",
                imageUrl: "https://example.com/avatar.jpg",
                emailAddresses: [],
            });

            // メール検証は upsert 前に行われるため、upsert へは到達しない
            await expect(
                upsertReview("product-001", createMockReview())
            ).rejects.toThrow("User email not found in Clerk.");

            expect(mockDb.user.upsert).not.toHaveBeenCalled();
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                emailAddresses: [{ emailAddress: "user@example.com" }],
            });
        });

        it("productIdが空の場合エラーをスローする", async () => {
            await expect(
                upsertReview("", createMockReview())
            ).rejects.toThrow("Error updating review");
        });
    });

    describe("新規レビュー作成", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                emailAddresses: [{ emailAddress: "user@example.com" }],
            });
            // 既存レビューなし
            mockDb.review.findFirst.mockResolvedValue(null);
        });

        it("新規レビューをcreateで作成する（クライアント提供IDは無視される）", async () => {
            const reviewInput = createMockReview();
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
            const reviewInput = createMockReview({
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
                emailAddresses: [{ emailAddress: "user@example.com" }],
            });
        });

        it("既存レビューがある場合、サーバー検証済みIDで更新する", async () => {
            const existingReview = {
                id: "existing-review-001",
                productId: "product-001",
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            };
            mockDb.review.findFirst.mockResolvedValue(existingReview);

            const reviewInput = createMockReview({ id: "client-provided-id" });
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
            const reviewInput = createMockReview();
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
                emailAddresses: [{ emailAddress: "user@example.com" }],
            });
            mockDb.review.findFirst.mockResolvedValue(null);
        });

        it("レビュー後に平均評価を再計算して商品を更新する", async () => {
            const reviewInput = createMockReview({ rating: 4 });
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
            const reviewInput = createMockReview({ rating: 3 });
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
            const reviewInput = createMockReview({ rating: 4 });
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
            const reviewInput = createMockReview();
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
                emailAddresses: [{ emailAddress: "user@example.com" }],
            });
            mockDb.review.findFirst.mockRejectedValue(
                new Error("DB connection failed")
            );

            await expect(
                upsertReview("product-001", createMockReview())
            ).rejects.toThrow("Error updating review: DB connection failed");
        });
    });

    describe("IDOR防止（他人のレビュー操作の拒否）", () => {
        // 既存レビュー検索の where 句に userId が含まれることを明示的に検証する
        // レグレッションテスト。将来 userId フィルタが外れた場合に検知できる。
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                emailAddresses: [{ emailAddress: "user@example.com" }],
            });
        });

        it("既存レビュー検索の where 句に認証ユーザーの userId が含まれる", async () => {
            mockDb.review.findFirst.mockResolvedValue(null);
            mockDb.review.create.mockResolvedValue(createMockReview());
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        productId: "product-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });

        it("他ユーザーの既存レビューには触れず、新規 create に分岐する", async () => {
            // findFirst が他ユーザーのレビューを返さないことを userId フィルタで担保している
            // ため、本シナリオでは null が返り create に分岐する
            mockDb.review.findFirst.mockResolvedValue(null);
            mockDb.review.create.mockResolvedValue(createMockReview());
            mockDb.review.findMany.mockResolvedValue([{ rating: 5 }]);
            mockDb.product.update.mockResolvedValue({});

            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.update).not.toHaveBeenCalled();
            expect(mockDb.review.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });
    });
});
