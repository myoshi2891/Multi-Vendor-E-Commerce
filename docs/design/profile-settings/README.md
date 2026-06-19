# Profile Settings（`/profile/settings`）— 設計書

> 顧客アカウント設定画面。会員情報（メール・氏名）編集、パスワード変更、多要素認証（MFA）、アカウント削除を提供する。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「C. 顧客アカウント・メニュー」優先度=中。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。ページ・リンク修正・Clerk 埋め込み・影響箇所マトリクス）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## スコープ境界

| | 含む | 含まない |
|---|---|---|
| **画面** | `/profile/settings`（顧客向け） | 販売者/管理者の設定 |
| **機能** | メール・氏名編集 / パスワード変更 / MFA / アカウント削除 | 通知設定・言語設定・テーマ |
| **実装** | Clerk `<UserProfile />` 埋め込み + メニュー導線修正 | 自前の認証フォーム再実装 |

---

## 核心判断（詳細は design.md の判断章）

| 判断 | 結論 | 理由 |
|------|------|------|
| 認証情報の編集 UI | **Clerk `<UserProfile />` を埋め込む** | パスワード・MFA・アカウント削除を公式コンポーネントが安全に内蔵。自前再実装はセキュリティ責任が増す（`any` 禁止・秘密情報ハードコード禁止の方針とも整合） |
| Prisma `User` 同期 | **新規 server action 不要** | webhook [`src/app/api/webhooks/route.ts:64-126`](../../../src/app/api/webhooks/route.ts) が `user.updated`/`user.deleted` を既に処理し name/email/picture を `db.user.upsert`、削除を `db.user.deleteMany` で伝播 |
| ルーティング | **`routing="hash"`** | キャッチオール route（`[[...rest]]`）が不要で Sonnet 実装が容易 |
| `force-dynamic` | **不要** | `src/queries/*` 経由の Prisma 呼び出しが無く Clerk が client 側で取得するため（tech.md「DB 依存ページの動的レンダリング規約」の対象外） |

---

## 規模感

- **新規ファイル**: 1（`settings/page.tsx`）
- **変更ファイル**: 2（`user-menu.tsx` のリンク修正・`sidebar.tsx` のエントリ追加）
- **server action / migration**: なし
- **テスト**: RTL コンポーネントテスト 3 観点（リンク回帰・sidebar エントリ・page 描画）
- **フェーズ**: 単一フェーズ（破壊的変更なし）

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- 認可: [`src/lib/auth-guards.ts`](../../../src/lib/auth-guards.ts)
- 姉妹設計書: [`docs/design/profile-messages/`](../profile-messages/)（同じ顧客メニュー C の Messages 画面）
- 雛形: [`docs/design/admin-dashboard/`](../admin-dashboard/)（本設計書の構成元）
