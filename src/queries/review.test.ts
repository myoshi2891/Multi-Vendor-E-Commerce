import { currentUser } from "@clerk/nextjs/server";
import { ModerationMode, ReviewStatus } from "@prisma/client";
import {
    getReviewModerationQueue,
    moderateReview,
    reportReview,
    upsertReview,
} from "./review";
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
            // フォールバック作成は createMany + skipDuplicates（ON CONFLICT DO NOTHING）。
            // upsert はレース時に P2002 を投げるため使わない（review.ts のコメント参照）。
            createMany: jest.fn(),
        },
        review: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            aggregate: jest.fn(),
        },
        product: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        store: {
            update: jest.fn(),
        },
        orderItem: {
            count: jest.fn(),
        },
        moderationPolicy: {
            findUnique: jest.fn(),
        },
        reviewReport: {
            createMany: jest.fn(),
            count: jest.fn(),
            updateMany: jest.fn(),
        },
        // レビュー書き込み + 集計更新は単一の interactive transaction で走る。
        // 行ロック（`SELECT … FOR UPDATE`）は $queryRaw 経由。
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
    },
}));

const mockDb = require("@/lib/db").db;

const USER = {
    id: TEST_CONFIG.DEFAULT_USER_ID,
    firstName: "John",
    lastName: "Doe",
    imageUrl: "https://example.com/avatar.jpg",
    emailAddresses: [{ emailAddress: "user@example.com" }],
    privateMetadata: { role: "USER" },
};
const ADMIN = { ...USER, id: "admin-001", privateMetadata: { role: "ADMIN" } };

/** aggregate の戻り値を作る（`_avg.rating` は 0 件のとき null）。 */
const agg = (avg: number | null, count: number) => ({
    _avg: { rating: avg },
    _count: { _all: count },
});

/** `$queryRaw` に渡されたタグ付きテンプレートの SQL を 1 本の文字列にする。 */
const sqlOf = (call: unknown[]): string => (call[0] as string[]).join("?");

beforeEach(() => {
    jest.clearAllMocks();
    (currentUser as jest.Mock).mockResolvedValue(USER);
    mockDb.user.createMany.mockResolvedValue({ count: 1 });
    // transaction callback を同じ DB モックで実行する（user.test.ts と同じ配線）。
    mockDb.$transaction.mockImplementation(
        async (callback: (tx: typeof mockDb) => Promise<unknown>) => callback(mockDb)
    );
    mockDb.$queryRaw.mockResolvedValue([{ id: "locked" }]);
    mockDb.product.findUnique.mockResolvedValue({ storeId: "store-001" });
    mockDb.moderationPolicy.findUnique.mockResolvedValue(null);
    mockDb.orderItem.count.mockResolvedValue(0);
    mockDb.review.findFirst.mockResolvedValue(null);
    mockDb.review.create.mockResolvedValue(createMockReview());
    mockDb.review.update.mockResolvedValue(createMockReview());
    mockDb.review.aggregate.mockResolvedValue(agg(5, 1));
    mockDb.product.update.mockResolvedValue({});
    mockDb.store.update.mockResolvedValue({});
});

// ==================================================
// upsertReview
// ==================================================
describe("upsertReview", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            // 完全一致で照合する。`toThrow(string)` は部分一致なので、
            // 認可エラーを汎用メッセージで包む回帰（"Error updating review: Unauthenticated."）を
            // 素通しさせてしまう。
            await expect(upsertReview("product-001", createMockReview())).rejects.toThrow(
                /^Unauthenticated\.$/
            );
        });
    });

    describe("入力検証（サーバー側・plan 092）", () => {
        it.each([0, 5.5, 2.25, Number.NaN])(
            "rating %p は DB に触れずに拒否する",
            async (rating) => {
                await expect(
                    upsertReview("product-001", createMockReview({ rating }))
                ).rejects.toThrow(/^Invalid review data\.$/);

                expect(mockDb.user.createMany).not.toHaveBeenCalled();
                expect(mockDb.$transaction).not.toHaveBeenCalled();
            }
        );

        it("本文が10文字未満なら拒否する", async () => {
            await expect(
                upsertReview("product-001", createMockReview({ review: "short" }))
            ).rejects.toThrow(/^Invalid review data\.$/);
        });

        it("productIdが空の場合エラーをスローする", async () => {
            await expect(upsertReview("", createMockReview())).rejects.toThrow(
                "Error updating review"
            );
        });
    });

    describe("ユーザーレコード自動同期 (フォールバック)", () => {
        it("Clerk情報からUserレコードを原子的に作成/同期する", async () => {
            await upsertReview("product-001", createMockReview());

            // skipDuplicates: true は ON CONFLICT DO NOTHING に落ち、id / email の
            // どちらの unique 衝突も握り潰す。**この true を落とすとレースが再発する**。
            expect(mockDb.user.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        id: TEST_CONFIG.DEFAULT_USER_ID,
                        name: "John Doe",
                        email: "user@example.com",
                        picture: "https://example.com/avatar.jpg",
                        role: "USER",
                    },
                ],
                skipDuplicates: true,
            });
        });

        it("Clerkユーザーにメールアドレスが無い場合はエラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({ ...USER, emailAddresses: [] });

            await expect(upsertReview("product-001", createMockReview())).rejects.toThrow(
                "User email not found in Clerk."
            );
            expect(mockDb.user.createMany).not.toHaveBeenCalled();
        });
    });

    describe("新規レビュー作成", () => {
        it("新規レビューをcreateで作成する（クライアント提供IDは無視される）", async () => {
            const createdReview = { ...createMockReview(), id: "server-generated-id" };
            mockDb.review.create.mockResolvedValue(createdReview);

            const result = await upsertReview("product-001", createMockReview());

            expect(result).toEqual(createdReview);
            expect(mockDb.review.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        productId: "product-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
            const { data } = mockDb.review.create.mock.calls[0][0];
            expect(data).not.toHaveProperty("id");
            expect(mockDb.review.update).not.toHaveBeenCalled();
        });

        it("画像をcreateで保存する", async () => {
            const reviewInput = createMockReview({
                images: [
                    { url: "https://example.com/img1.jpg" },
                    { url: "https://example.com/img2.jpg" },
                ],
            });

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

        it("ポリシーの行が無ければ即公開（PUBLISHED）で作成する", async () => {
            await upsertReview("product-001", createMockReview());

            expect(mockDb.moderationPolicy.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { subject: "REVIEW" } })
            );
            expect(mockDb.review.create.mock.calls[0][0].data.status).toBe(
                ReviewStatus.PUBLISHED
            );
        });

        it("事前審査モードでは審査待ち（PENDING_REVIEW）で作成する", async () => {
            mockDb.moderationPolicy.findUnique.mockResolvedValue({
                mode: ModerationMode.PRE,
                requireVerifiedPurchase: false,
                flagThreshold: 3,
            });

            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.create.mock.calls[0][0].data.status).toBe(
                ReviewStatus.PENDING_REVIEW
            );
        });
    });

    describe("購入検証", () => {
        it("支払い済み・未取消の明細を本人の注文から探す（where 構造）", async () => {
            await upsertReview("product-001", createMockReview());

            expect(mockDb.orderItem.count).toHaveBeenCalledWith({
                where: {
                    productId: "product-001",
                    status: { notIn: ["Canceled", "Refunded"] },
                    orderGroup: {
                        order: {
                            userId: TEST_CONFIG.DEFAULT_USER_ID,
                            paymentStatus: "Paid",
                        },
                    },
                },
            });
        });

        it("購入者なら isVerifiedPurchase=true で保存する", async () => {
            mockDb.orderItem.count.mockResolvedValue(1);

            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.create.mock.calls[0][0].data.isVerifiedPurchase).toBe(true);
        });

        it("未購入者は既定ポリシーでは投稿でき、isVerifiedPurchase=false になる", async () => {
            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.create.mock.calls[0][0].data.isVerifiedPurchase).toBe(false);
        });

        it("購入必須ポリシーでは未購入者を拒否し、書き込みも集計もしない", async () => {
            mockDb.moderationPolicy.findUnique.mockResolvedValue({
                mode: ModerationMode.POST,
                requireVerifiedPurchase: true,
                flagThreshold: 3,
            });

            await expect(upsertReview("product-001", createMockReview())).rejects.toThrow(
                "Only verified purchasers can review this product."
            );
            expect(mockDb.review.create).not.toHaveBeenCalled();
            expect(mockDb.product.update).not.toHaveBeenCalled();
            expect(mockDb.store.update).not.toHaveBeenCalled();
        });
    });

    describe("既存レビュー更新", () => {
        it("既存レビューがある場合、サーバー検証済みIDで更新する", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
                status: ReviewStatus.PUBLISHED,
            });

            await upsertReview("product-001", createMockReview({ id: "client-provided-id" }));

            expect(mockDb.review.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "existing-review-001" } })
            );
            expect(mockDb.review.create).not.toHaveBeenCalled();
        });

        it("更新時に既存画像を全削除して再作成する", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
                status: ReviewStatus.PUBLISHED,
            });

            await upsertReview("product-001", createMockReview());

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

        it("FLAGGED のレビューを編集しても FLAGGED のまま（審査を編集で解除させない）", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
                status: ReviewStatus.FLAGGED,
            });

            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.update.mock.calls[0][0].data.status).toBe(ReviewStatus.FLAGGED);
        });

        it("REJECTED のレビューを再投稿すると、前回の却下理由と審査日時を消す", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
                status: ReviewStatus.REJECTED,
            });

            await upsertReview("product-001", createMockReview());

            const data = mockDb.review.update.mock.calls[0][0].data;
            expect(data.status).toBe(ReviewStatus.PUBLISHED);
            expect(data.moderationReason).toBeNull();
            expect(data.moderatedAt).toBeNull();
        });

        it("REJECTED 以外の編集では審査メタデータに触れない", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
                status: ReviewStatus.FLAGGED,
            });

            await upsertReview("product-001", createMockReview());

            const data = mockDb.review.update.mock.calls[0][0].data;
            expect(data).not.toHaveProperty("moderationReason");
            expect(data).not.toHaveProperty("moderatedAt");
        });

        it("REMOVED のレビューは編集を拒否し、集計もしない", async () => {
            mockDb.review.findFirst.mockResolvedValue({
                id: "existing-review-001",
                status: ReviewStatus.REMOVED,
            });

            await expect(upsertReview("product-001", createMockReview())).rejects.toThrow(
                "This review has been removed."
            );
            expect(mockDb.review.update).not.toHaveBeenCalled();
            expect(mockDb.product.update).not.toHaveBeenCalled();
        });
    });

    describe("商品・店舗の評価集計の再計算", () => {
        it("公開集合だけを DB で集計し、商品と店舗の両方を更新する", async () => {
            mockDb.review.aggregate
                .mockResolvedValueOnce(agg(4, 3)) // 商品
                .mockResolvedValueOnce(agg(4.25, 8)); // 店舗

            await upsertReview("product-001", createMockReview({ rating: 4 }));

            const publicStatuses = { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] };
            expect(mockDb.review.aggregate).toHaveBeenNthCalledWith(1, {
                where: { productId: "product-001", status: publicStatuses },
                _avg: { rating: true },
                _count: { _all: true },
            });
            expect(mockDb.review.aggregate).toHaveBeenNthCalledWith(2, {
                where: { product: { storeId: "store-001" }, status: publicStatuses },
                _avg: { rating: true },
                _count: { _all: true },
            });
            expect(mockDb.product.update).toHaveBeenCalledWith({
                where: { id: "product-001" },
                data: { rating: 4, numReviews: 3 },
            });
            expect(mockDb.store.update).toHaveBeenCalledWith({
                where: { id: "store-001" },
                data: { averageRating: 4.25, numReviews: 8 },
            });
        });

        it("公開レビューが 0 件（審査待ちのみ等）なら平均は 0", async () => {
            mockDb.review.aggregate.mockResolvedValue(agg(null, 0));

            await upsertReview("product-001", createMockReview());

            expect(mockDb.product.update).toHaveBeenCalledWith({
                where: { id: "product-001" },
                data: { rating: 0, numReviews: 0 },
            });
            expect(mockDb.store.update).toHaveBeenCalledWith({
                where: { id: "store-001" },
                data: { averageRating: 0, numReviews: 0 },
            });
        });

        it("店舗 ID はクライアントから受け取らず、ロック後の Product から読む", async () => {
            await upsertReview("product-001", createMockReview());

            expect(mockDb.product.findUnique).toHaveBeenCalledWith({
                where: { id: "product-001" },
                select: { storeId: true },
            });
        });

        it("imagesとuserをincludeしてレビューを返す", async () => {
            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.create).toHaveBeenCalledWith(
                expect.objectContaining({ include: { images: true, user: true } })
            );
        });
    });

    describe("集計の原子性（並行投稿の lost update 防止）", () => {
        it("書き込みと集計更新を単一の $transaction へ配線する", async () => {
            // tx として渡す client を db モックとは別物にする。実装が `db.*` を直接
            // 叩いていたら（= tx の外に出ていたら）このモックに記録が残らない。
            const txClient = {
                $queryRaw: jest.fn().mockResolvedValue([{ id: "locked" }]),
                product: {
                    findUnique: jest.fn().mockResolvedValue({ storeId: "store-001" }),
                    update: jest.fn().mockResolvedValue({}),
                },
                store: { update: jest.fn().mockResolvedValue({}) },
                moderationPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
                orderItem: { count: jest.fn().mockResolvedValue(0) },
                review: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue(createMockReview()),
                    update: jest.fn(),
                    aggregate: jest.fn().mockResolvedValue(agg(4, 2)),
                },
            };
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: typeof txClient) => Promise<unknown>) => callback(txClient)
            );

            await upsertReview("product-001", createMockReview({ rating: 4 }));

            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
            expect(txClient.review.create).toHaveBeenCalledTimes(1);
            expect(txClient.product.update).toHaveBeenCalledTimes(1);
            expect(txClient.store.update).toHaveBeenCalledTimes(1);
            // tx の外に漏れていないこと
            expect(mockDb.$queryRaw).not.toHaveBeenCalled();
            expect(mockDb.review.create).not.toHaveBeenCalled();
            expect(mockDb.product.update).not.toHaveBeenCalled();
            expect(mockDb.store.update).not.toHaveBeenCalled();
        });

        it("Product → Store → Review の順に行ロックを取り、どれもレビュー書き込みより先", async () => {
            await upsertReview("product-001", createMockReview());

            expect(mockDb.$queryRaw).toHaveBeenCalledTimes(3);
            const [productLock, storeLock, reviewLock] = mockDb.$queryRaw.mock.calls;
            expect(sqlOf(productLock)).toContain('FROM "Product"');
            expect(sqlOf(productLock)).toContain("FOR UPDATE");
            expect(sqlOf(storeLock)).toContain('FROM "Store"');
            expect(sqlOf(storeLock)).toContain("FOR UPDATE");
            // ID は文字列連結ではなくパラメータとして渡す（SQL インジェクション防止）
            expect(productLock[1]).toBe("product-001");
            expect(storeLock[1]).toBe("store-001");

            // ロックの順序を全経路で固定する（Product → Store）。逆順の経路があると
            // 同じ店舗への並行操作でデッドロックしうる（design review-governance §5.2）。
            const order = mockDb.$queryRaw.mock.invocationCallOrder;
            expect(order[0]).toBeLessThan(order[1]);
            expect(order[1]).toBeLessThan(mockDb.review.create.mock.invocationCallOrder[0]);

            // 自分のレビュー行は状態を読む前にロックする（並行通報の FLAGGED を見落とさない）
            expect(sqlOf(reviewLock)).toContain('FROM "Review"');
            expect(sqlOf(reviewLock)).toContain("FOR UPDATE");
            expect(reviewLock.slice(1)).toEqual(["product-001", USER.id]);
            expect(order[1]).toBeLessThan(order[2]);
            expect(order[2]).toBeLessThan(mockDb.review.findFirst.mock.invocationCallOrder[0]);
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラー時にラップされたメッセージをスローする", async () => {
            mockDb.review.findFirst.mockRejectedValue(new Error("DB connection failed"));

            await expect(upsertReview("product-001", createMockReview())).rejects.toThrow(
                "Error updating review: DB connection failed"
            );
        });

        it("Errorオブジェクト以外が投げられた場合も、その内容をラップしてスローする", async () => {
            mockDb.review.findFirst.mockRejectedValue("Database error string");

            await expect(upsertReview("product-001", createMockReview())).rejects.toThrow(
                "Error updating review: Database error string"
            );
        });
    });

    describe("IDOR防止（他人のレビュー操作の拒否）", () => {
        it("既存レビュー検索の where 句に認証ユーザーの userId が含まれる", async () => {
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
            await upsertReview("product-001", createMockReview());

            expect(mockDb.review.update).not.toHaveBeenCalled();
            expect(mockDb.review.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ userId: TEST_CONFIG.DEFAULT_USER_ID }),
                })
            );
        });
    });
});

// ==================================================
// reportReview
// ==================================================
describe("reportReview", () => {
    const input = { reviewId: "review-001", reason: "SPAM", note: "広告" };

    beforeEach(() => {
        mockDb.review.findUnique.mockResolvedValue({
            userId: "author-001",
            status: ReviewStatus.PUBLISHED,
        });
        mockDb.reviewReport.createMany.mockResolvedValue({ count: 1 });
        mockDb.reviewReport.count.mockResolvedValue(1);
    });

    // (a) 認可エラーを汎用メッセージで上書きしない
    it("未認証なら Unauthenticated. をそのままスローする", async () => {
        (currentUser as jest.Mock).mockResolvedValue(null);

        await expect(reportReview(input)).rejects.toThrow(/^Unauthenticated\.$/);
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("不正な入力は DB に触れずに拒否する", async () => {
        await expect(reportReview({ reviewId: "review-001", reason: "BORING" })).rejects.toThrow(
            /^Invalid report\.$/
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("通報は Review 行をロックしてから、本人を通報者として記録する（冪等）", async () => {
        await reportReview(input);

        expect(sqlOf(mockDb.$queryRaw.mock.calls[0])).toContain('FROM "Review"');
        expect(mockDb.$queryRaw.mock.calls[0][1]).toBe("review-001");
        // (b) 通報者は認証ユーザー。入力に reporterId を混ぜても使われない
        expect(mockDb.reviewReport.createMany).toHaveBeenCalledWith({
            data: [
                {
                    reviewId: "review-001",
                    reporterId: TEST_CONFIG.DEFAULT_USER_ID,
                    reason: "SPAM",
                    note: "広告",
                },
            ],
            // 同じ人の二重通報は ON CONFLICT DO NOTHING。P2002 を出すと tx が中断する
            skipDuplicates: true,
        });
    });

    it("通報者の User 行が無くても FK 違反にならないよう、tx の前に作成する", async () => {
        await reportReview(input);

        expect(mockDb.user.createMany).toHaveBeenCalledWith({
            data: [
                {
                    id: TEST_CONFIG.DEFAULT_USER_ID,
                    name: "John Doe",
                    email: "user@example.com",
                    picture: "https://example.com/avatar.jpg",
                    role: "USER",
                },
            ],
            skipDuplicates: true,
        });
        expect(mockDb.user.createMany.mock.invocationCallOrder[0]).toBeLessThan(
            mockDb.$transaction.mock.invocationCallOrder[0]
        );
    });

    it("Clerk ユーザーにメールアドレスが無ければ通報を記録しない", async () => {
        (currentUser as jest.Mock).mockResolvedValue({ ...USER, emailAddresses: [] });

        await expect(reportReview(input)).rejects.toThrow(/^User email not found in Clerk\.$/);
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    // (c) 拒否時は副作用なし
    it("自分のレビューは通報できない", async () => {
        mockDb.review.findUnique.mockResolvedValue({
            userId: TEST_CONFIG.DEFAULT_USER_ID,
            status: ReviewStatus.PUBLISHED,
        });

        await expect(reportReview(input)).rejects.toThrow("You cannot report your own review.");
        expect(mockDb.reviewReport.createMany).not.toHaveBeenCalled();
    });

    it.each([ReviewStatus.PENDING_REVIEW, ReviewStatus.REJECTED, ReviewStatus.REMOVED])(
        "公開されていない（%s）レビューは見つからない扱い",
        async (status) => {
            mockDb.review.findUnique.mockResolvedValue({ userId: "author-001", status });

            await expect(reportReview(input)).rejects.toThrow("Review not found.");
            expect(mockDb.reviewReport.createMany).not.toHaveBeenCalled();
        }
    );

    it("存在しないレビューは見つからない扱い", async () => {
        mockDb.review.findUnique.mockResolvedValue(null);

        await expect(reportReview(input)).rejects.toThrow("Review not found.");
    });

    it("事後審査で未解決の通報が閾値に達したら FLAGGED にする", async () => {
        mockDb.reviewReport.count.mockResolvedValue(3);

        const result = await reportReview(input);

        expect(mockDb.reviewReport.count).toHaveBeenCalledWith({
            where: { reviewId: "review-001", resolvedAt: null },
        });
        expect(mockDb.review.update).toHaveBeenCalledWith({
            where: { id: "review-001" },
            data: { status: ReviewStatus.FLAGGED },
        });
        expect(result).toEqual({ status: ReviewStatus.FLAGGED });
        // PUBLISHED → FLAGGED は公開集合の中の遷移なので集計は変わらない
        expect(mockDb.product.update).not.toHaveBeenCalled();
    });

    it("閾値未満なら状態は変えない", async () => {
        mockDb.reviewReport.count.mockResolvedValue(2);

        const result = await reportReview(input);

        expect(mockDb.review.update).not.toHaveBeenCalled();
        expect(result).toEqual({ status: ReviewStatus.PUBLISHED });
    });

    it("無審査モードでは通報を記録するだけで FLAGGED にしない", async () => {
        mockDb.moderationPolicy.findUnique.mockResolvedValue({
            mode: ModerationMode.NONE,
            requireVerifiedPurchase: false,
            flagThreshold: 1,
        });
        mockDb.reviewReport.count.mockResolvedValue(5);

        await reportReview(input);

        expect(mockDb.reviewReport.createMany).toHaveBeenCalled();
        expect(mockDb.review.update).not.toHaveBeenCalled();
    });

    it("DB エラーは汎用メッセージに畳む", async () => {
        mockDb.reviewReport.createMany.mockRejectedValue(new Error("connection reset"));

        await expect(reportReview(input)).rejects.toThrow(/^Failed to report review\.$/);
    });
});

// ==================================================
// moderateReview
// ==================================================
describe("moderateReview", () => {
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue(ADMIN);
        mockDb.review.findUnique
            // 1 回目: ロック対象の Product / Store を引く
            .mockResolvedValueOnce({ productId: "product-001", product: { storeId: "store-001" } })
            // 2 回目: ロック後に状態を読み直す
            .mockResolvedValueOnce({ status: ReviewStatus.FLAGGED });
        mockDb.review.update.mockResolvedValue({ id: "review-001", status: ReviewStatus.REMOVED });
        mockDb.reviewReport.updateMany.mockResolvedValue({ count: 3 });
    });

    // (a) ADMIN 以外は拒否・副作用なし
    it("ADMIN 以外は Only admins can perform this action. をそのままスローする", async () => {
        (currentUser as jest.Mock).mockResolvedValue(USER);

        await expect(
            moderateReview({ reviewId: "review-001", action: "remove", reason: "spam" })
        ).rejects.toThrow(/^Only admins can perform this action\.$/);
        expect(mockDb.$transaction).not.toHaveBeenCalled();
        expect(mockDb.review.update).not.toHaveBeenCalled();
    });

    it("理由なしの削除は DB に触れずに拒否する", async () => {
        await expect(moderateReview({ reviewId: "review-001", action: "remove" })).rejects.toThrow(
            /^Invalid moderation request\.$/
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("Product → Store → Review の順でロックしてから状態を読み直す", async () => {
        await moderateReview({ reviewId: "review-001", action: "remove", reason: "spam" });

        const calls = mockDb.$queryRaw.mock.calls;
        expect(calls).toHaveLength(3);
        expect(sqlOf(calls[0])).toContain('FROM "Product"');
        expect(sqlOf(calls[1])).toContain('FROM "Store"');
        expect(sqlOf(calls[2])).toContain('FROM "Review"');
        expect(calls.map((c: unknown[]) => c[1])).toEqual(["product-001", "store-001", "review-001"]);
        // 状態の読み直し（2 回目の findUnique）はロックの後
        expect(mockDb.$queryRaw.mock.invocationCallOrder[2]).toBeLessThan(
            mockDb.review.findUnique.mock.invocationCallOrder[1]
        );
    });

    it("FLAGGED の削除は REMOVED にし、理由を残し、集計を再計算し、通報を閉じる", async () => {
        mockDb.review.aggregate.mockResolvedValue(agg(4, 2));

        await moderateReview({ reviewId: "review-001", action: "remove", reason: "  誹謗中傷  " });

        // (b) 更新対象はサーバーで特定した reviewId に限定
        expect(mockDb.review.update).toHaveBeenCalledWith({
            where: { id: "review-001" },
            data: {
                status: ReviewStatus.REMOVED,
                moderationReason: "誹謗中傷",
                moderatedAt: expect.any(Date),
            },
            select: { id: true, status: true },
        });
        expect(mockDb.product.update).toHaveBeenCalledWith({
            where: { id: "product-001" },
            data: { rating: 4, numReviews: 2 },
        });
        expect(mockDb.store.update).toHaveBeenCalled();
        expect(mockDb.reviewReport.updateMany).toHaveBeenCalledWith({
            where: { reviewId: "review-001", resolvedAt: null },
            data: { resolvedAt: expect.any(Date) },
        });
    });

    it("FLAGGED の復帰は PUBLISHED にし、集計は変えずに通報を閉じる", async () => {
        await moderateReview({ reviewId: "review-001", action: "restore" });

        expect(mockDb.review.update.mock.calls[0][0].data.status).toBe(ReviewStatus.PUBLISHED);
        expect(mockDb.product.update).not.toHaveBeenCalled();
        expect(mockDb.store.update).not.toHaveBeenCalled();
        expect(mockDb.reviewReport.updateMany).toHaveBeenCalled();
    });

    it("審査待ちの承認は公開集合に入るので集計を再計算する", async () => {
        mockDb.review.findUnique.mockReset();
        mockDb.review.findUnique
            .mockResolvedValueOnce({ productId: "product-001", product: { storeId: "store-001" } })
            .mockResolvedValueOnce({ status: ReviewStatus.PENDING_REVIEW });

        await moderateReview({ reviewId: "review-001", action: "approve" });

        expect(mockDb.review.update.mock.calls[0][0].data.status).toBe(ReviewStatus.PUBLISHED);
        expect(mockDb.product.update).toHaveBeenCalled();
        expect(mockDb.store.update).toHaveBeenCalled();
        expect(mockDb.reviewReport.updateMany).not.toHaveBeenCalled();
    });

    // (c) 遷移表に無い操作は副作用なし
    it("遷移表に無い操作は拒否し、何も書き込まない", async () => {
        await expect(
            moderateReview({ reviewId: "review-001", action: "approve" })
        ).rejects.toThrow("Invalid moderation transition.");
        expect(mockDb.review.update).not.toHaveBeenCalled();
        expect(mockDb.product.update).not.toHaveBeenCalled();
        expect(mockDb.reviewReport.updateMany).not.toHaveBeenCalled();
    });

    it("存在しないレビューは見つからない扱い", async () => {
        mockDb.review.findUnique.mockReset();
        mockDb.review.findUnique.mockResolvedValue(null);

        await expect(
            moderateReview({ reviewId: "missing", action: "remove", reason: "spam" })
        ).rejects.toThrow("Review not found.");
        expect(mockDb.$queryRaw).not.toHaveBeenCalled();
    });

    it("DB エラーは汎用メッセージに畳む", async () => {
        mockDb.review.update.mockRejectedValue(new Error("deadlock detected"));

        await expect(
            moderateReview({ reviewId: "review-001", action: "remove", reason: "spam" })
        ).rejects.toThrow(/^Failed to moderate review\.$/);
    });
});

// ==================================================
// getReviewModerationQueue
// ==================================================
describe("getReviewModerationQueue", () => {
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue(ADMIN);
        mockDb.review.findMany.mockResolvedValue([]);
        mockDb.review.count.mockResolvedValue(45);
    });

    it("ADMIN 以外は拒否する", async () => {
        (currentUser as jest.Mock).mockResolvedValue(USER);

        await expect(getReviewModerationQueue({})).rejects.toThrow(
            /^Only admins can perform this action\.$/
        );
        expect(mockDb.review.findMany).not.toHaveBeenCalled();
    });

    it("既定では審査待ちと FLAGGED を古い順に返す", async () => {
        const result = await getReviewModerationQueue({});

        const args = mockDb.review.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
            status: { in: [ReviewStatus.PENDING_REVIEW, ReviewStatus.FLAGGED] },
        });
        expect(args.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
        expect(args.skip).toBe(0);
        expect(args.take).toBe(20);
        expect(result.totalPages).toBe(3);
        expect(result.page).toBe(1);
    });

    it("状態を指定すればその状態だけを返す", async () => {
        await getReviewModerationQueue({ status: ReviewStatus.REMOVED });

        expect(mockDb.review.findMany.mock.calls[0][0].where).toEqual({
            status: { in: [ReviewStatus.REMOVED] },
        });
    });

    it("未定義の状態とページ番号は正規化する", async () => {
        await getReviewModerationQueue({ status: "HACKED", page: "1e21" });

        const args = mockDb.review.findMany.mock.calls[0][0];
        expect(args.where.status.in).toEqual([ReviewStatus.PENDING_REVIEW, ReviewStatus.FLAGGED]);
        // normalizePageParam が MAX_PAGE でクランプするので skip は Int に収まる
        expect(Number.isSafeInteger(args.skip)).toBe(true);
        expect(args.skip).toBeLessThan(2 ** 31);
    });

    it("未解決の通報数を数える", async () => {
        await getReviewModerationQueue({});

        const select = mockDb.review.findMany.mock.calls[0][0].select;
        expect(select._count).toEqual({
            select: { reports: { where: { resolvedAt: null } } },
        });
    });
});
