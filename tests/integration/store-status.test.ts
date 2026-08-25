/**
 * Store Status Integration Tests (updateStoreStatus)
 *
 * 店舗承認フロー `updateStoreStatus` (`src/queries/store.ts`) を実 DB
 * (testcontainers PostgreSQL) で検証する。unit テスト
 * (`src/queries/store.test.ts`) は認可エラーが中心で、以下の「遷移条件つき
 * 権限付与」の実 DB セマンティクスは未検証だった:
 *
 *   - PENDING → ACTIVE でのみ DB の User.role が USER → SELLER へ昇格する
 *   - 昇格しない遷移 (PENDING → BANNED / 非 PENDING 起点) では role が動かない
 *   - Clerk メタデータ同期は「更新後の店舗が ACTIVE」かつ「オーナーの DB role が
 *     SELLER」の両方が成立する場合にのみ発火する現仕様（旧仕様は更新後 ACTIVE
 *     だけを見ており、DISABLED/BANNED → ACTIVE でも Clerk に SELLER を書いていた）
 *   - status 更新とロール昇格が同一 `$transaction` で原子的であること
 *   - 更新前ステータスを tx 内で `FOR UPDATE` して読むため、並行遷移でも
 *     「昇格したのは PENDING を観測した tx だけ」が保たれること
 *   - 存在しない店舗 / 非 ADMIN / 未認証での拒否 + 副作用なし
 *
 * ロール昇格は**権限境界の変更**であり、条件を外れて発火すると seller
 * ダッシュボードへのアクセス権が不正に付与される Trust & Safety 上の欠陥になる。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/queries/store.ts (updateStoreStatus)
 * - src/lib/auth-guards.ts (requireSeller — 認可ソースは Clerk の privateMetadata.role)
 * - plans/035-integration-test-store-status-role-promotion.md
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// updateStoreStatus は currentUser() で認証ユーザーを取得し、Clerk 同期は
// `await import("@clerk/nextjs/server")` の**動的 import** で clerkClient を得る。
// jest のモジュールモックは動的 import にも適用されるため、両方をここで差し替える。
const mockUpdateUserMetadata = jest.fn();

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
    clerkClient: jest.fn().mockResolvedValue({
        users: {
            updateUserMetadata: (...args: unknown[]) =>
                mockUpdateUserMetadata(...args),
        },
    }),
}));

// ----------------------------------------------------------------------------

import { cpus } from "os";

import { Role, StoreStatus } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { StoreStatus as AppStoreStatus } from "@/lib/types";
import { updateStoreStatus } from "@/queries/store";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import { seedStore, seedUser } from "./setup/seed";

const db = getTestDb();

// StoreStatus は 2 系統ある。`@prisma/client` の enum は seed / DB 行の assert 用、
// `@/lib/types` の enum は `updateStoreStatus` の**引数の型**（store.ts:4 が後者を import
// している）。値は同一文字列だが TS の enum は名前的型なので相互代入できず、混同すると
// テストは緑のまま `tsc --noEmit` だけが落ちる。呼び出し側は AppStoreStatus を使うこと。

const ADMIN_ID = "admin-integration";

/** currentUser モックを ADMIN として解決させる */
function mockAuthAsAdmin(): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: ADMIN_ID,
        privateMetadata: { role: "ADMIN" },
    });
}

/** 共通 Arrange: 指定ステータスの店舗と、その USER ロールのオーナーを作る */
async function seedOwnerAndStore(status: StoreStatus) {
    const owner = await seedUser(db);
    // seed のデフォルトが USER であること自体を前提として固定する。
    // ここが SELLER で始まっていると「昇格した」判定が空振りする。
    expect(owner.role).toBe(Role.USER);

    const store = await seedStore(db, {
        userId: owner.id,
        overrides: { status },
    });
    return { owner, store };
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();
    mockUpdateUserMetadata.mockReset();
});

// ============================================================================
// Scenario 1: PENDING → ACTIVE で SELLER 昇格 + Clerk 同期
// ============================================================================

describe("Scenario 1: PENDING → ACTIVE promotes the owner to SELLER", () => {
    it("updates store status, promotes User.role, and syncs Clerk metadata", async () => {
        // Arrange
        mockAuthAsAdmin();
        const { owner, store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // Act
        const result = await updateStoreStatus(store.id, AppStoreStatus.ACTIVE);

        // Assert: 戻り値
        expect(result).toBe(StoreStatus.ACTIVE);

        // Assert: DB 側の状態
        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        expect(storeAfter.status).toBe(StoreStatus.ACTIVE);

        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });
        expect(ownerAfter.role).toBe(Role.SELLER);

        // Assert: Clerk 同期の引数（実 API には到達しない — モック）
        expect(mockUpdateUserMetadata).toHaveBeenCalledTimes(1);
        expect(mockUpdateUserMetadata).toHaveBeenCalledWith(owner.id, {
            privateMetadata: { role: "SELLER" },
        });
    });
});

// ============================================================================
// Scenario 2: PENDING → BANNED は昇格しない
// ============================================================================

describe("Scenario 2: PENDING → BANNED does not promote", () => {
    it("keeps User.role at USER and never touches Clerk", async () => {
        // Arrange
        mockAuthAsAdmin();
        const { owner, store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // Act
        const result = await updateStoreStatus(store.id, AppStoreStatus.BANNED);

        // Assert
        expect(result).toBe(StoreStatus.BANNED);

        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        expect(storeAfter.status).toBe(StoreStatus.BANNED);

        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });
        // 昇格条件は「PENDING 起点 かつ 結果が ACTIVE」。BANNED は後半を満たさない。
        expect(ownerAfter.role).toBe(Role.USER);

        expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Scenario 3: 非 PENDING 起点 (DISABLED → ACTIVE) — DB 昇格なし / Clerk 同期なし
// ============================================================================

describe("Scenario 3: DISABLED → ACTIVE skips the DB promotion", () => {
    it("leaves User.role at USER and does not push SELLER to Clerk", async () => {
        // Arrange
        mockAuthAsAdmin();
        const { owner, store } = await seedOwnerAndStore(StoreStatus.DISABLED);

        // Act
        const result = await updateStoreStatus(store.id, AppStoreStatus.ACTIVE);

        // Assert
        expect(result).toBe(StoreStatus.ACTIVE);

        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        expect(storeAfter.status).toBe(StoreStatus.ACTIVE);

        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });
        // DB 昇格は PENDING 起点限定 (store.ts の `store.status === "PENDING"`)。
        expect(ownerAfter.role).toBe(Role.USER);

        // 以前はここが characterization（既知バグの固定）で、DB が USER のままでも
        // Clerk 側には SELLER が書かれていた。認可のソースは DB の User.role ではなく
        // Clerk の privateMetadata.role (`src/lib/auth-guards.ts` の requireSeller) なので、
        // これは**実際に販売者権限が通る**権限昇格だった。
        // Clerk 同期を「DB 上 SELLER であること」で条件付けたため、期待値を反転する。
        expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Scenario 4: ACTIVE → ACTIVE の再実行 — DB は冪等 / Clerk 呼び出しは冪等でない
// ============================================================================

describe("Scenario 4: re-running ACTIVE → ACTIVE", () => {
    it("does not re-promote in the DB but calls Clerk again", async () => {
        // Arrange
        mockAuthAsAdmin();
        const { owner, store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // Act: 1 回目で昇格 → 2 回目は起点が ACTIVE なので昇格分岐に入らない
        await updateStoreStatus(store.id, AppStoreStatus.ACTIVE);
        const result = await updateStoreStatus(store.id, AppStoreStatus.ACTIVE);

        // Assert: throw せず、DB 状態は 1 回目と同じ
        expect(result).toBe(StoreStatus.ACTIVE);

        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        expect(storeAfter.status).toBe(StoreStatus.ACTIVE);

        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });
        expect(ownerAfter.role).toBe(Role.SELLER);

        // 回数 assert が無いと「冪等 = 何も起きない」と誤読され、Clerk への重複呼び出しが
        // 無検証で残る。固定するのは「DB 状態は冪等だが Clerk 呼び出しは毎回発火する
        // (同一値の再送なので結果は同じ)」という現仕様。
        expect(mockUpdateUserMetadata).toHaveBeenCalledTimes(2);
        expect(mockUpdateUserMetadata).toHaveBeenNthCalledWith(2, owner.id, {
            privateMetadata: { role: "SELLER" },
        });
    });
});

// ============================================================================
// Scenario 5: 存在しない storeId
// ============================================================================

describe("Scenario 5: unknown storeId", () => {
    it("rejects with 'Store not found.' and leaves users untouched", async () => {
        // Arrange
        mockAuthAsAdmin();
        const { owner } = await seedOwnerAndStore(StoreStatus.PENDING);

        // Act + Assert
        await expect(
            updateStoreStatus(
                "00000000-0000-0000-0000-000000000000",
                AppStoreStatus.ACTIVE
            )
        ).rejects.toThrow(/Store not found/);

        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });
        expect(ownerAfter.role).toBe(Role.USER);
        expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Scenario 6: 認可
// ============================================================================

describe("Scenario 6: authorization", () => {
    it("rejects a non-admin caller without changing the store", async () => {
        // Arrange
        (currentUser as unknown as jest.Mock).mockResolvedValue({
            id: "regular-user",
            privateMetadata: { role: "USER" },
        });
        const { owner, store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // Act + Assert
        await expect(
            updateStoreStatus(store.id, AppStoreStatus.ACTIVE)
        ).rejects.toThrow(/Only admins can perform this action/);

        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        expect(storeAfter.status).toBe(StoreStatus.PENDING);

        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });
        expect(ownerAfter.role).toBe(Role.USER);
        expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated caller without changing the store", async () => {
        // Arrange
        (currentUser as unknown as jest.Mock).mockResolvedValue(null);
        const { store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // Act + Assert
        await expect(
            updateStoreStatus(store.id, AppStoreStatus.ACTIVE)
        ).rejects.toThrow(/Unauthenticated/);

        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        expect(storeAfter.status).toBe(StoreStatus.PENDING);
        expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Scenario 7: $transaction の原子性 (後段失敗で前段もロールバック)
// ============================================================================

describe("Scenario 7: transactional atomicity", () => {
    it("rolls back the status update when the role promotion fails", async () => {
        // Arrange
        mockAuthAsAdmin();
        const { owner, store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // シナリオ 1〜4 は「両方成功した」ことしか示さない。store.update と user.update が
        // **本当に同一 tx か**は、後段だけを決定論的に失敗させて前段が巻き戻ることを
        // 見ない限り実証できない。
        //
        // オーナー User を事前削除する手は使えない: schema.prisma の
        // `user User @relation("UserStores", ...)` は onDelete 未指定 = 既定 Restrict なので、
        // Store が存在する限り User の削除自体が FK 制約で拒否される。
        // 統合テストは実 DB シングルトンを共有するため tx.user.update の spy 差し替えも不可。
        // よって一時 CHECK 制約で user.update のみを失敗させる。
        // ADD の前に必ず落とす。前回の実行がプロセス強制終了などで finally に
        // 到達できなかった場合、制約が残ったままだと ADD が "already exists" で
        // 失敗する —— しかもその失敗は try の**手前**で起きるため finally による
        // 後始末も走らず、手動で DB を触るまで復旧できない。
        await db.$executeRawUnsafe(
            `ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "tmp_block_seller"`
        );
        await db.$executeRawUnsafe(
            `ALTER TABLE "User" ADD CONSTRAINT "tmp_block_seller" CHECK ("role" <> 'SELLER')`
        );

        try {
            // Act + Assert: 後段 user.update が弾かれ tx 全体が失敗する
            await expect(
                updateStoreStatus(store.id, AppStoreStatus.ACTIVE)
            ).rejects.toThrow();

            // Assert: 前段の store.update がロールバックされている (原子性の本体)
            const storeAfter = await db.store.findUniqueOrThrow({
                where: { id: store.id },
            });
            expect(storeAfter.status).toBe(StoreStatus.PENDING);

            const ownerAfter = await db.user.findUniqueOrThrow({
                where: { id: owner.id },
            });
            expect(ownerAfter.role).toBe(Role.USER);

            // tx が throw するため Clerk 同期 (tx 外) には到達しない
            expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
        } finally {
            // 制約は必ず落とす。resetDb は TRUNCATE でありテーブル制約は落とさないため、
            // 残すと後続テスト (および同一ファイルの 2 回目の実行) が巻き添えで落ちる。
            //
            // IF EXISTS は setup 側と揃える。制約が既に無い場合に DROP が throw すると、
            // finally の例外が try 内の**本来の失敗を握り潰して**すり替わり、
            // 原子性アサートの失敗理由が「制約が無い」に化ける。
            await db.$executeRawUnsafe(
                `ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "tmp_block_seller"`
            );
        }
    });
});

/**
 * Prisma の接続プール上限を求める。
 *
 * 並行ディスパッチテストは **プールが 1 だと 2 本が接続待ちで直列化され、遷移の並行性を
 * 検証しないまま緑になる**（偽陽性）。そのため「並行を検証できない環境」を silently pass
 * させず、テスト内で明示的に expect する。`connection_limit` の指定が無い場合、Prisma は
 * `num_cpus * 2 + 1` を既定値として使う。
 *
 * （`order-lifecycle.test.ts` / `webhook-payment.test.ts` / `review-aggregation.test.ts`
 * にも同じヘルパーがある。共通化するなら 4 箇所まとめて `setup/` へ出すこと。）
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

// ============================================================================
// Scenario 8: PENDING → BANNED と PENDING → ACTIVE の並行ディスパッチ
// ============================================================================

describe("Scenario 8: concurrent PENDING → BANNED / PENDING → ACTIVE", () => {
    it("SELLER 昇格は更新前 PENDING を観測した tx だけに閉じる", async () => {
        // 前提: プールが 1 だと 2 本が接続待ちで直列化され、並行性を検証しないまま
        // 緑になる。「並行を検証できない環境」を silently pass させない。
        expect(resolveConnectionLimit()).toBeGreaterThanOrEqual(2);

        // Arrange
        mockAuthAsAdmin();
        const { owner, store } = await seedOwnerAndStore(StoreStatus.PENDING);

        // バリア: 2 本が in-flight になってから初めて DB へ進ませる。
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let arrived = 0;
        const arm = async (next: AppStoreStatus): Promise<void> => {
            arrived += 1;
            if (arrived === 2) release();
            await gate;
            await updateStoreStatus(store.id, next);
        };

        // Act
        const settled = await Promise.allSettled([
            arm(AppStoreStatus.ACTIVE),
            arm(AppStoreStatus.BANNED),
        ]);

        // Assert: どちらも成功する（片方を落として整合させる設計ではない）
        expect(settled.filter((r) => r.status === "rejected")).toEqual([]);

        const storeAfter = await db.store.findUniqueOrThrow({
            where: { id: store.id },
        });
        const ownerAfter = await db.user.findUniqueOrThrow({
            where: { id: owner.id },
        });

        // Assert: 到達しうる終状態は 2 通りだけで、いずれも
        // 「role が SELLER ⟺ ACTIVE 化した tx が更新前 PENDING を観測した」を満たす。
        //
        //   - BANNED が先にコミット → ACTIVE 側は更新前 BANNED を読むので昇格しない
        //     → (ACTIVE, USER)
        //   - ACTIVE が先にコミット → 昇格し、その後 BANNED が上書きする
        //     → (BANNED, SELLER)
        //
        // 更新前ステータスを tx **外**の findUnique スナップショットから採ると、
        // 両方の tx が PENDING を観測できてしまい、1 つ目の順序でも昇格が起きる
        // ——(ACTIVE, SELLER) という 3 つ目の組み合わせが現れる。
        //
        // **識別力（実測）**: 更新前ステータスを tx 外スナップショットに戻すと、
        // 本テストは **4 回中 3 回**落ちる。落ちるのは BANNED が先にコミットした回だけで、
        // 逆順の回はロック有無に関わらず (BANNED, SELLER) になり通ってしまう。
        // 「壊すと必ず落ちる」ではなく「壊すと高確率で落ちる」ガードである点に注意。
        expect([
            { status: StoreStatus.ACTIVE, role: Role.USER },
            { status: StoreStatus.BANNED, role: Role.SELLER },
        ]).toContainEqual({
            status: storeAfter.status,
            role: ownerAfter.role,
        });
    });
});
