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
 *   - Clerk メタデータ同期の発火条件が DB 昇格条件と**異なる**現仕様
 *   - status 更新とロール昇格が同一 `$transaction` で原子的であること
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
            await db.$executeRawUnsafe(
                `ALTER TABLE "User" DROP CONSTRAINT "tmp_block_seller"`
            );
        }
    });
});
