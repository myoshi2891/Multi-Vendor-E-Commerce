# Profile Settings — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| # | 事実 | 出典（行番号） |
|---|------|----------------|
| 0-1 | Clerk webhook が `user.created`/`user.updated` を処理し、`db.user.upsert` で `id`/`name`/`email`/`picture` を Prisma `User` へ同期する | [`src/app/api/webhooks/route.ts:64-112`](../../../src/app/api/webhooks/route.ts#L64-L112) |
| 0-2 | 同 webhook が `user.deleted` を処理し `db.user.deleteMany` で Prisma `User` を削除する | [`route.ts:114-126`](../../../src/app/api/webhooks/route.ts#L114-L126) |
| 0-3 | ユーザーメニューの `extraLinks` の「Settings」が `link: "/"`（誤リンク） | [`user-menu.tsx:162-165`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L162-L165) |
| 0-4 | ユーザーメニューの `links` の「Messages」は `link: "/profile/messages"`（リンク済・本設計の対象外、姉妹設計書 messages 側） | [`user-menu.tsx:146-150`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L146-L150) |
| 0-5 | プロフィールサイドバーの `menu` 配列に Settings エントリが無い（Overview/Orders/Payment/.../Following の8項目のみ） | [`sidebar.tsx:63-96`](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L63-L96) |
| 0-6 | profile 配下ページの雛形は `export const dynamic='force-dynamic'` + async server component + container（ただし本ページは DB 非依存のため `force-dynamic` 不要） | [`profile/reviews/page.tsx`](../../../src/app/(store)/profile/reviews/page.tsx) |
| 0-7 | profile レイアウトはサイドバー幅 296px + メインコンテンツ | [`sidebar.tsx:32`](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L32) |

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
src/app/(store)/profile/settings/page.tsx        ← 新規（server component）
src/components/store/layout/header/user-menu/
  └─ user-menu.tsx                                ← 変更（Settings リンク修正）
src/components/store/layout/profile-sidebar/
  └─ sidebar.tsx                                  ← 変更（Settings エントリ追加）
```

### 1.2 再利用元マトリクス

| 流用するもの | 出典 | 用途 |
|-------------|------|------|
| ページ構造（server component） | `profile/reviews/page.tsx` | `settings/page.tsx` の雛形 |
| `<UserProfile />` | `@clerk/nextjs` | 認証情報 UI 全体（パスワード/MFA/メール/削除） |
| webhook 同期 | `route.ts:64-126` | Clerk→Prisma の name/email/picture/削除 同期（**変更不要**） |
| `cn` ユーティリティ | `src/lib/utils.ts` | クラス結合（必要時） |

### 1.3 認可方針

- `/profile/*` は Clerk middleware の保護ルート（[`src/middleware.ts`](../../../src/middleware.ts)）。`settings/page.tsx` で追加の認可ガードは不要。
- `<UserProfile />` 自体が現在のセッションユーザーにスコープされるため、IDOR の懸念は無い。

---

## 2. 機能詳細

### 2.1 新規ページ `src/app/(store)/profile/settings/page.tsx`

**方針**: server component が Clerk の client コンポーネント `<UserProfile />` を描画。`routing="hash"` でキャッチオール route を回避。

```tsx
// src/app/(store)/profile/settings/page.tsx
import { UserProfile } from "@clerk/nextjs";

/**
 * 顧客アカウント設定ページ。
 * Clerk の <UserProfile /> を埋め込み、氏名/メール編集・パスワード変更・MFA・
 * アカウント削除を提供する。これらの編集は Clerk webhook (user.updated /
 * user.deleted) 経由で Prisma User に自動同期される（src/app/api/webhooks/route.ts）。
 *
 * routing="hash" を用いることで catch-all route ([[...rest]]) を不要にする。
 * src/queries 経由の DB 呼び出しが無いため force-dynamic は付与しない。
 */
export default function ProfileSettingsPage() {
    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">Account settings</h1>
            <UserProfile
                routing="hash"
                appearance={{
                    elements: {
                        // profile レイアウト(サイドバー 296px)と干渉しないよう
                        // カード幅を内側に収める。実値は実装時に screenshot 調整。
                        rootBox: "w-full",
                        cardBox: "w-full shadow-none",
                    },
                }}
            />
        </div>
    );
}
```

> **注意（実装時に確認）**: `<UserProfile routing="hash" />` は単一ページで全タブをハッシュ遷移で扱う。もし path ベースが要件化された場合のみ `settings/[[...rest]]/page.tsx` 構成へ変更する（本 MVP では hash で十分）。`appearance.elements` のキー名は Clerk のバージョンに依存するため、`bun run dev` で実描画を確認しながら微調整する（NFR-S3）。

### 2.2 変更: `user-menu.tsx`（Settings リンク修正）

[`user-menu.tsx:162-165`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L162-L165) の `extraLinks` 内 Settings:

```diff
  const extraLinks = [
    { title: "Profile", link: "/profile" },
-   { title: "Settings", link: "/" },
+   { title: "Settings", link: "/profile/settings" },
    { title: "Become a Seller", link: "/seller/apply" },
    // ...
  ];
```

### 2.3 変更: `sidebar.tsx`（Settings エントリ追加）

[`sidebar.tsx:63-96`](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L63-L96) の `menu` 配列末尾（または「Following」の後）に追加:

```diff
  const menu = [
    { title: "Overview", link: "/profile" },
    // ... 既存項目 ...
    { title: "Following", link: "/profile/following/1" },
+   { title: "Settings", link: "/profile/settings" },
  ];
```

> サイドバーのアクティブ判定は `pathname.startsWith(item.link)`（[`sidebar.tsx:46-49`](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L46-L49)）。`/profile/settings` は他項目の prefix にならないため追加変更は不要。

---

## 3. テスト設計

> 配置: コンポーネントテストはソースと同階層 or `tests/component/`（[tech.md テスト要件](../../../.claude/steering/tech.md)）。RTL（jsdom）。Clerk は `jest.mock`。

| テスト | 対象 | アサート（AAA） | 対応 AC |
|--------|------|-----------------|---------|
| T-S1 | `user-menu.tsx` | extraLinks の「Settings」リンクが `/profile/settings`（**回帰**: 旧 `/` を弾く） | AC-S3 |
| T-S2 | `sidebar.tsx` | menu に「Settings」→`/profile/settings` が描画される | AC-S4 |
| T-S3 | `settings/page.tsx` | `UserProfile` をモックし、ページが当該要素を描画する（`<h1>Account settings` + モック `<UserProfile>` プレースホルダ） | AC-S2 |

**Clerk モック例**（T-S3）:

```tsx
jest.mock("@clerk/nextjs", () => ({
    UserProfile: () => <div data-testid="clerk-user-profile" />,
}));
```

> **テスト数変動に注意**: T-S1〜T-S3 追加でテスト総数が増えるため、[tasks.md](./tasks.md) の通り `spec-sync-after-test` を**必ず**起動し、`QA_HANDOFF.md`（SSOT）→ 関連 docs へ伝播 + `bun run coverage:dashboard` を**同一コミット**に含める。

---

## 判断1. なぜ Clerk `<UserProfile />` 埋め込みか（自前フォーム却下）

- **選択肢A（採用）**: `<UserProfile />` 埋め込み。
  - メリット: パスワード・MFA・メール検証・アカウント削除を**公式が安全に内蔵**。実装量が最小で Sonnet 実装が容易。Clerk 側のセキュリティ更新に追随。
  - デメリット: UI が Clerk テーマ依存（`appearance` で調整が必要）。
- **選択肢B（却下）**: shadcn Form + Zod の自前フォーム + `clerkClient().users.updateUser()`。
  - デメリット: パスワード変更・MFA・アカウント削除フローを再実装する必要があり、**セキュリティ責任が増大**（NFR-S1 違反リスク）。実装量・テスト量が大きい。MVP に不適。
- **結論**: A を採用。global CLAUDE.md「秘密情報をハードコードしない」「外部入力のバリデーション」の方針とも整合。

## 判断2. なぜ新規 server action を作らないか

- webhook（[`route.ts:64-126`](../../../src/app/api/webhooks/route.ts#L64-L126)）が `user.updated`/`user.deleted` を既に処理し Prisma `User` へ name/email/picture/削除を同期済み（事実 0-1/0-2）。
- `<UserProfile />` 経由の編集は Clerk が webhook を発火 → 既存ハンドラが同期する。**二重実装は不要**で、むしろ整合性リスクになる。
- したがって `src/queries/` への追加は無し。`server-action-scaffold` skill は本機能では**起動しない**（[tasks.md](./tasks.md) 明記）。

## 判断3. なぜ `force-dynamic` を付与しないか

- tech.md「DB 依存ページの動的レンダリング規約」は `src/queries/*` 経由で **Prisma を呼ぶ** page を対象とする。本ページは Prisma を呼ばず、`<UserProfile />` が client 側で Clerk から取得する。
- middleware による保護で動的化されるため、ビルド時静的化の問題も生じない。よって明示宣言は不要（不要な宣言を避ける = ランタイム優先順位「不要なファイル編集を回避」）。

---

## 影響箇所マトリクス

| パス | 変更種別 | 行（目安） | 理由 | リスク |
|------|---------|-----------|------|--------|
| `src/app/(store)/profile/settings/page.tsx` | 新規 | — | 設定ページ本体 | 低（独立追加） |
| `src/components/store/layout/header/user-menu/user-menu.tsx` | 変更 | 163-164 | 誤リンク `/` → `/profile/settings` | 低（1行・回帰テストで保護） |
| `src/components/store/layout/profile-sidebar/sidebar.tsx` | 変更 | 96 付近 | Settings エントリ追加 | 低（配列1要素追加） |
| `docs/testing/QA_HANDOFF.md` ほか統計 docs | 変更 | — | テスト数変動の spec-sync | 低（生成・同期） |

---

## リスク分析

| リスク | 区分 | 緩和策 |
|--------|------|--------|
| `<UserProfile>` がサイドバーと視覚干渉 | UI | `appearance.elements` 調整 + `bun run dev`/Playwright screenshot（ターゲット ref・content-heavy 回避） |
| Clerk バージョン差で `appearance` キー名が変わる | 依存 | 実装時に実描画で確認。キー不一致でも機能は動作（見た目のみ） |
| webhook 未発火環境（ローカル）で Prisma 同期が見えない | 検証 | ローカルは Clerk webhook をトンネル（svix）or 手動確認。AC-S5/S6 は staging で最終確認 |

---

## Verification（実装後の検証手順）

1. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-S1〜T-S3 含む）/ `bun run build`。
2. `bun run dev` → 認証済みで `/profile/settings` を開き、`<UserProfile>` が描画されること、サイドバー/ユーザーメニューから到達できることを確認（Playwright `browser_take_screenshot` をターゲット ref で）。
3. 氏名を変更 → Clerk webhook（staging）→ `bunx prisma studio` で `User.name` 更新を確認（AC-S5）。
4. （任意・破壊的）テストアカウントで削除 → `User` 行が消えること（AC-S6）。
