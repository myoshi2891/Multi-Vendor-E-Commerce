/**
 * upsertReview の評価集計（rating / numReviews）統合テスト (plan 034 / TESTS-18)
 *
 * 商品の `rating` / `numReviews` は商品カード・商品詳細・プロフィールに広く出る
 * **信頼シグナル**だが、その集計 —— レビュー投稿のたびに全レビューを読み直して平均を
 * 再計算し `product.update` する（`src/queries/review.ts`）—— は実 DB で一度も
 * 検証されていなかった。unit テスト (`src/queries/review.test.ts`・全モック) は
 * 呼び出し構造しか固定できず、次の 2 点は原理的に観測できない:
 *
 *   - **同一ユーザーの再投稿が create ではなく update になる**（`numReviews` が増えない）
 *   - **複数ユーザーの平均が実データから正しく導出される**
 *
 * 集計ドリフトは静かに蓄積し、表示上の平均と実レビューの乖離として顧客に露出する。
 * 本テストは実 PostgreSQL (testcontainers) でそれを固定する。
 *
 * 併せて **User フォールバック upsert**（`review.ts:31-53`）も検証する。これは Clerk
 * Webhook の同期漏れに備えて DB ユーザーをオンデマンド作成する経路で、レビュー投稿が
 * 「DB に User 行が無い状態」から始まっても成立することを保証している。
 *
 * **前提を assert に落としていることに注意**（シナリオ 1）。「reviewer は DB に居ないはず」を
 * コメントで主張するだけでは、もし居た場合に create 分岐を素通りして **検証したい経路を
 * 一度も通らないまま緑になる**。呼び出し前に `null` であることを機械で固定している。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - plans/034-integration-test-review-aggregation.md
 * - src/queries/review.ts（検証対象。本テストでは 1 行も変更しない）
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// upsertReview は currentUser() を直接呼ぶ（auth-guards は経由しない）。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import { cpus } from "os";

import { currentUser } from "@clerk/nextjs/server";
import type { PrismaClient, Product } from "@prisma/client";

import type { ReviewDetailsType } from "@/lib/types";
import { upsertReview } from "@/queries/review";

import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

let db: PrismaClient;

/**
 * Clerk の currentUser() を差し替える。
 *
 * User フォールバック upsert (`review.ts:31-53`) が参照するフィールドを**すべて**供給する
 * —— email が無いと `'User email not found in Clerk.'` で手前の分岐に落ち、集計まで到達しない。
 */
function mockAuthAsClerkUser(id: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id,
        emailAddresses: [{ emailAddress: `${id}@example.test` }],
        firstName: "Test",
        lastName: "User",
        imageUrl: "https://example.test/avatar.png",
    });
}

/**
 * Prisma の接続プール上限を求める。
 *
 * 並行ディスパッチテストは **プールが 1 だと 2 本が接続待ちで直列化され、集計の並行性を
 * 検証しないまま緑になる**（偽陽性）。そのため「並行を検証できない環境」を silently pass
 * させず、テスト内で明示的に expect する。`connection_limit` の指定が無い場合、Prisma は
 * `num_cpus * 2 + 1` を既定値として使う。
 *
 * （`order-lifecycle.test.ts` / `webhook-payment.test.ts` にも同じヘルパーがある。
 * 共通化するなら 3 箇所まとめて `setup/` へ出すこと。）
 */
function resolveConnectionLimit(): number {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL が未設定です（globalSetup 未実行）");
    const explicit = new URL(url).searchParams.get("connection_limit");
    if (explicit !== null) {
        const parsed = Number(explicit.trim());
        if (!Number.isFinite(parsed)) {
            throw new Error(`connection_limit が数値ではありません: ${explicit}`);
        }
        return parsed;
    }
    return cpus().length * 2 + 1;
}

/** `ReviewDetailsType` のフル shape を作る。rating と images 以外はダミー固定値。 */
function buildReview(
    overrides: Partial<ReviewDetailsType> = {}
): ReviewDetailsType {
    return {
        id: "",
        review: "Great product",
        rating: 5,
        images: [{ url: "https://example.test/review-1.png" }],
        size: "M",
        quantity: "1",
        variant: "Default variant",
        color: "Black",
        ...overrides,
    };
}

describe("upsertReview の評価集計（実 DB）", () => {
    let product: Product;

    beforeAll(async () => {
        db = await getTestDb();
    });

    afterAll(async () => {
        await disconnectTestDb();
    });

    beforeEach(async () => {
        await resetDb(db);
        jest.mocked(currentUser).mockReset();

        // 店舗オーナー。**reviewer とは別人**である点が重要（シナリオ 1 参照）。
        const owner = await seedUser(db, { role: "SELLER" });
        const store = await seedStore(db, { userId: owner.id });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const seeded = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
        });
        product = seeded.product;
    });

    // ------------------------------------------------------------------------
    // シナリオ 1: 初回投稿 + User フォールバック upsert
    // ------------------------------------------------------------------------
    it("初回投稿で rating / numReviews が設定され、DB に居ない reviewer が自動作成される", async () => {
        // Arrange: reviewer は seed していない。**この前提を assert で固定する** ——
        // ここが null でなければ fallback create 分岐を検証できず、テストは
        // 「既存ユーザーで投稿できた」だけを見る空振りになる。
        expect(
            await db.user.findUnique({ where: { id: "reviewer-1" } })
        ).toBeNull();
        mockAuthAsClerkUser("reviewer-1");

        // Act
        await upsertReview(product.id, buildReview({ rating: 4 }));

        // Assert: 集計が反映されている
        const updated = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(updated.rating).toBe(4);
        expect(updated.numReviews).toBe(1);

        // Assert: User フォールバックが Clerk の値で行を作った
        const createdUser = await db.user.findUniqueOrThrow({
            where: { id: "reviewer-1" },
        });
        expect(createdUser).toMatchObject({
            email: "reviewer-1@example.test",
            name: "Test User",
            role: "USER",
        });
    });

    // ------------------------------------------------------------------------
    // シナリオ 2: 複数ユーザーの平均
    // ------------------------------------------------------------------------
    it("複数ユーザーのレビューから平均 rating が導出される", async () => {
        // Arrange & Act
        mockAuthAsClerkUser("reviewer-1");
        await upsertReview(product.id, buildReview({ rating: 4 }));

        mockAuthAsClerkUser("reviewer-2");
        await upsertReview(product.id, buildReview({ rating: 2 }));

        // Assert: (4 + 2) / 2 = 3。Product.rating は Float なので厳密比較を避ける。
        const updated = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(updated.rating).toBeCloseTo(3, 5);
        expect(updated.numReviews).toBe(2);
    });

    // ------------------------------------------------------------------------
    // シナリオ 3: 同一ユーザーの再投稿は update（件数不変・平均のみ変動）
    // ------------------------------------------------------------------------
    it("同一ユーザーの再投稿はレビュー件数を増やさず、平均だけが変わる", async () => {
        // Arrange: シナリオ 2 と同じ状態（4 と 2 で平均 3）を作る
        mockAuthAsClerkUser("reviewer-1");
        await upsertReview(product.id, buildReview({ rating: 4 }));
        mockAuthAsClerkUser("reviewer-2");
        await upsertReview(product.id, buildReview({ rating: 2 }));

        // Act: reviewer-1 が 5 で投稿し直す。画像も別 URL 1 件へ差し替える。
        mockAuthAsClerkUser("reviewer-1");
        await upsertReview(
            product.id,
            buildReview({
                rating: 5,
                images: [{ url: "https://example.test/review-1-updated.png" }],
            })
        );

        // Assert: create ではなく update なので件数は増えない
        expect(
            await db.review.count({ where: { productId: product.id } })
        ).toBe(2);

        // Assert: 平均は (5 + 2) / 2 = 3.5 へ動く
        const updated = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(updated.rating).toBeCloseTo(3.5, 5);
        expect(updated.numReviews).toBe(2);

        // Assert: 画像は総入れ替え（deleteMany + create）で 1 件のまま。
        // **対象 review に限定して数えること** —— グローバルな reviewImage.count() は
        // reviewer-2 の画像も拾うので、増殖・残存の検出が緩む / 壊れる。
        const review = await db.review.findFirstOrThrow({
            where: { productId: product.id, userId: "reviewer-1" },
        });
        expect(
            await db.reviewImage.count({ where: { reviewId: review.id } })
        ).toBe(1);
        const images = await db.reviewImage.findMany({
            where: { reviewId: review.id },
        });
        expect(images[0].url).toBe("https://example.test/review-1-updated.png");
    });

    // ------------------------------------------------------------------------
    // シナリオ 4: 商品間の独立性
    // ------------------------------------------------------------------------
    it("別商品へのレビューは対象商品の集計に影響しない", async () => {
        // Arrange: Product A にレビュー 1 件（rating 4）
        mockAuthAsClerkUser("reviewer-1");
        await upsertReview(product.id, buildReview({ rating: 4 }));

        // Arrange: 同じ店舗・カテゴリに Product B を追加
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const productB = (
            await seedProductWithVariantAndSize(db, {
                storeId: product.storeId,
                categoryId: category.id,
                subCategoryId: subCategory.id,
            })
        ).product;

        // Act: Product B に rating 1 を投稿
        mockAuthAsClerkUser("reviewer-2");
        await upsertReview(productB.id, buildReview({ rating: 1 }));

        // Assert: A は無傷（findMany が productId で絞れていることの検証）
        const updatedA = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(updatedA.rating).toBe(4);
        expect(updatedA.numReviews).toBe(1);

        // Assert: B 側にだけ反映されている
        const updatedB = await db.product.findUniqueOrThrow({
            where: { id: productB.id },
        });
        expect(updatedB.rating).toBe(1);
        expect(updatedB.numReviews).toBe(1);
    });

    // ------------------------------------------------------------------------
    // シナリオ 5: 未認証は reject + 副作用なし
    // ------------------------------------------------------------------------
    it("未認証の投稿は拒否され、レビュー行も商品集計も変化しない", async () => {
        // Arrange
        (currentUser as unknown as jest.Mock).mockResolvedValue(null);

        // Act & Assert: 'Unauthorized.' は try の内側で throw され catch にラップされる
        // （`Error updating review: Unauthorized.`）ため、部分一致で見る。
        await expect(
            upsertReview(product.id, buildReview({ rating: 5 }))
        ).rejects.toThrow(/Unauthorized/);

        // Assert: 副作用なし
        expect(await db.review.count()).toBe(0);
        const untouched = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(untouched.numReviews).toBe(0);
        // rating も seed 直後の値から動いていないこと。numReviews だけを見ると、
        // 集計が「件数は据え置きで平均だけ書き換える」形に壊れた場合を見逃す
        // （0 件で平均を計算すれば NaN、既定値へ落とせば 0 と、どちらも起こりうる）。
        // 期待値は 0 のハードコードではなく **呼び出し前の product の値**と比べる。
        expect(untouched.rating).toBe(product.rating);
    });

    // ------------------------------------------------------------------------
    // シナリオ 6: 同一ユーザーの同時二重投稿で行が水増しされない
    // ------------------------------------------------------------------------
    it("同一ユーザーの同時二重投稿でもレビュー行は 1 本、numReviews も 1", async () => {
        // 前提: プールが 1 だと 2 本が接続待ちで直列化され、並行性を検証しないまま
        // 緑になる。「並行を検証できない環境」を silently pass させない。
        expect(resolveConnectionLimit()).toBeGreaterThanOrEqual(2);

        // Arrange: **同一** reviewer が 2 本同時に投稿する（連打・二重送信）。
        mockAuthAsClerkUser("reviewer-1");

        // バリア: 2 本が in-flight になってから初めて DB へ進ませる。
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let arrived = 0;
        const arm = async (rating: number): Promise<void> => {
            arrived += 1;
            if (arrived === 2) release();
            await gate;
            await upsertReview(product.id, buildReview({ rating }));
        };

        // Act
        const settled = await Promise.allSettled([arm(5), arm(3)]);

        // Assert: 2 本とも成功する（片方を落として整合させる設計ではない）
        expect(settled.filter((s) => s.status === "rejected")).toEqual([]);

        // Assert: 行は 1 本。`Review` には (productId, userId) の unique 制約が無いため、
        // 直列化されていないと 2 本が揃って findFirst で null を見て両方 create に落ちる。
        // ロックがあれば後続はロック解放後に先行の行を見つけて update に落ちる。
        //
        // **識別力（実測）**: 集計を非トランザクション実装に戻すとこの assert は
        // `Received: 2` で落ちる —— ただし **3 回中 2 回**で、たまたま直列化した回は
        // 通ってしまう。ロックを入れた側は 5 回連続で緑（決定論的）。
        // 「壊すと必ず落ちる」ではなく「壊すと高確率で落ちる」ガードである点に注意。
        expect(
            await db.review.count({ where: { productId: product.id } })
        ).toBe(1);

        // Assert: 集計も 1 件ぶん。rating はどちらが後勝ちしたか（5 or 3）に依存する
        // ので値は固定しない —— 固定したい不変条件は「件数が水増しされないこと」。
        const updated = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(updated.numReviews).toBe(1);
        expect([5, 3]).toContain(updated.rating);
    });

    // ------------------------------------------------------------------------
    // シナリオ 7: 別ユーザーの同時投稿でロック競合が事故にならない
    // ------------------------------------------------------------------------
    it("別ユーザーの同時投稿が輻輳しても全員成功し、集計が一致する", async () => {
        expect(resolveConnectionLimit()).toBeGreaterThanOrEqual(2);

        // ⚠️ **これは lost update の再現テストではない。**
        // 集計を非トランザクション実装（create → findMany → product.update の
        // 3 往復）に戻しても**このテストは緑のまま**であることを実測で確認している
        // —— 同形の呼び出しは往復ごとに歩調が揃うため、全員の create が
        // 出揃ってから全員の findMany が走り、結果的に全員が正しい件数を書く。
        // 「findMany で古い件数を読んだ側が最後に update する」並びは、
        // レイテンシが均一なローカル DB では現実に踏めない。
        // lost update に対する本当のガードは `src/queries/review.test.ts` の
        // 「集計の原子性」——`$transaction` と Product 行ロックの**配線**を固定する
        // ユニットテスト —— であり、本ケースの役割はその配線が
        // **競合下で事故を起こさないこと**の確認である:
        //   - `FOR UPDATE` の待ちが P2028（tx timeout）に化けない
        //   - デッドロックしない
        //   - 直列化しても最終集計が全員ぶんになる
        const ratings = [5, 4, 3, 2];
        const expectedAverage =
            ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

        // 各呼び出しに別々の reviewer を割り当てる。誰がどの rating を引くかは
        // 決めない —— 最終集計は割り当ての順列に依存しない。
        let handedOut = 0;
        (currentUser as unknown as jest.Mock).mockImplementation(async () => {
            const id = `reviewer-${handedOut}`;
            handedOut += 1;
            return {
                id,
                emailAddresses: [{ emailAddress: `${id}@example.test` }],
                firstName: "Test",
                lastName: "User",
                imageUrl: "https://example.test/avatar.png",
            };
        });

        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let arrived = 0;
        const arm = async (rating: number): Promise<void> => {
            arrived += 1;
            if (arrived === ratings.length) release();
            await gate;
            await upsertReview(product.id, buildReview({ rating }));
        };

        // Act
        const settled = await Promise.allSettled(ratings.map(arm));

        // Assert: 全員成功（ロック待ちがタイムアウトやデッドロックに化けていない）
        expect(settled.filter((s) => s.status === "rejected")).toEqual([]);

        // Assert: 全員ぶんが集計に載っている
        expect(
            await db.review.count({ where: { productId: product.id } })
        ).toBe(ratings.length);
        const updated = await db.product.findUniqueOrThrow({
            where: { id: product.id },
        });
        expect(updated.numReviews).toBe(ratings.length);
        expect(updated.rating).toBeCloseTo(expectedAverage, 5);
    });
});
