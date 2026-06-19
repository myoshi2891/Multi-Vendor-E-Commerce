# Profile Settings — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)。
> 進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（必須・SKILL 呼び出し漏れ防止）

> **このフェーズで呼ぶ SKILL を各 Step に再掲する。チェックが埋まらないままコミットしないこと。**

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] DB 依存 page では `export const dynamic='force-dynamic';` を宣言（**本機能は対象外** — [design §判断3](./design.md#判断3-なぜ-force-dynamic-を付与しないか)）。
- [ ] 新規コードに `any` 禁止（`unknown` + 型ガード）。`console.log` 禁止。
- [ ] 認証情報の自前実装をしない（Clerk `<UserProfile />` に委譲・[design §判断1](./design.md#判断1-なぜ-clerk-userprofile--埋め込みか自前フォーム却下)）。
- [ ] **server-action-scaffold / safe-migration は起動しない**（新規 server action・schema 変更が無いため・[design §判断2](./design.md#判断2-なぜ新規-server-action-を作らないか)）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint / tsc / test の3点）通過 + `bun run build` 成功。
- [ ] テスト数 / スイート数が変動したら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) → `bun run coverage:dashboard`（**同一コミット**で同期）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan         本設計書を入力に最終計画化・承認取得（必須）
1. test-gen             リンク修正/ページ描画の RTL テスト生成（Red→Green）
2. test-complete        lint/tsc/test（各コミット前・必須）
3. spec-sync-after-test テスト数変動 → QA_HANDOFF(SSOT)→07-testing/COVERAGE_REPORT/PROGRESS 伝播 + dashboard 再生成（同一コミット）
4. spec-sync-check      最終ドリフト確認（任意）
```

> 本機能は **単一フェーズ**（破壊的変更なし）。実装は「テストコード」「実装」「ドキュメント同期」を別コミットに分離する（rule 02）。

---

## Phase 1: Settings 画面 + 導線修正

### 1-A. リンク回帰テスト（user-menu / sidebar）　【SKILL: test-gen】

| Step | 内容 | コミット例 |
|------|------|-----------|
| 1-A-1 Red | [test-gen](../../../.claude/skills/test-gen/) で `user-menu` の「Settings」リンク期待値を `/profile/settings` とするテストを書き、**現状 `/` で失敗することを確認**（AC-S3） | `test(user-menu): add failing settings link regression test` |
| 1-A-2 Green | [user-menu.tsx:163-164](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L163) の Settings リンクを `/profile/settings` に修正 → Green | `fix(user-menu): point settings link to /profile/settings` |
| 1-A-3 Red→Green | `sidebar` の menu に「Settings」エントリが存在するテストを書き（Red）、[sidebar.tsx:96](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L96) 付近に追加して Green（AC-S4） | `test(sidebar): assert settings entry` / `feat(sidebar): add settings menu entry` |

> **コミット粒度**: 1-A-1（テスト）と 1-A-2（実装）は Red/Green で**別コミット**。1-A-3 は同一カテゴリ（sidebar 単一ファイル）のため Red→Green を 2 コミットに分けるか、snapshot 不要な単純追加なら 1 コミット可（rule 02 の「1ファイル=1commit 基本」に従う）。

### 1-B. Settings ページ追加　【SKILL: test-gen】

| Step | 内容 | コミット例 |
|------|------|-----------|
| 1-B-1 Red | `settings/page.tsx` の描画テスト（Clerk `<UserProfile>` を `jest.mock`・`data-testid="clerk-user-profile"` を検証）を書き **失敗確認**（AC-S2・[design §2.1](./design.md#21-新規ページ-srcappstoreprofilesettingspagetsx)） | `test(settings): add failing render test for settings page` |
| 1-B-2 Green | [design §2.1](./design.md#21-新規ページ-srcappstoreprofilesettingspagetsx) のコードで `src/app/(store)/profile/settings/page.tsx` を新規作成 → Green | `feat(settings): add /profile/settings page with Clerk UserProfile` |
| 1-B-3 Refactor | `appearance.elements` を `bun run dev` 実描画で微調整（NFR-S3）。機能不変のリファクタ | `refactor(settings): tune UserProfile appearance for profile layout` |

### 1-C. 品質チェック　【SKILL: test-complete】

- [ ] [test-complete](../../../.claude/skills/test-complete/) を起動: `bun run lint` / `bunx tsc --noEmit` / `bun run test` の3点 + `bun run build`。**全緑を確認してからコミット**（rule 02 NEVER: test-complete 未実行コミット禁止）。

### 1-D. ドキュメント同期　【SKILL: spec-sync-after-test】

- [ ] テスト数（T-S1〜T-S3 で +3 前後）が変動 → [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) を起動。
  - `docs/testing/QA_HANDOFF.md`（**統計 SSOT**）を更新 → `specs/multi-vendor-ecommerce/07-testing.md` / `COVERAGE_REPORT.md` / `docs/PROGRESS.md` へ伝播。
  - 新規ページ追加のため `04-interfaces.md`（ルート `/profile/settings`）/ `05-workflows.md`（設定編集フロー）を同期。
  - `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を再生成。
  - 上記を **ドキュメント同期コミット**（テストコード・実装とは別コミット）にまとめる。
- コミット例: `docs: sync settings page stats and regenerate coverage dashboard`

### 1-E. 最終ドリフト確認　【SKILL: spec-sync-check・任意】

- [ ] [spec-sync-check](../../../.claude/skills/spec-sync-check/) で仕様↔実装・規約↔skill のドリフトが無いか確認（報告のみ・自動修正なし）。

---

## レビュー必須ポイント（着手前に確認）

- [ ] `routing="hash"` で MVP 要件を満たすか（path ベースが必要なら `[[...rest]]` 構成へ）。
- [ ] `appearance` 調整がサイドバー 296px と干渉しないか（実描画確認）。
- [ ] webhook（`user.updated`/`user.deleted`）の既存同期に**回帰が無い**こと（変更しない前提）。

---

## コミット分割サマリー（rule 02 準拠）

| コミット | 種別 | 内容 |
|---------|------|------|
| 1 | test | user-menu settings リンク回帰テスト（Red） |
| 2 | fix | user-menu リンク修正（Green） |
| 3 | test+feat | sidebar settings エントリ（rule 02 の1ファイル基準） |
| 4 | test | settings page 描画テスト（Red） |
| 5 | feat | settings page 追加（Green） |
| 6 | refactor | appearance 調整 |
| 7 | docs | spec-sync + dashboard 再生成（**統計同期は単独コミット**） |

> 各コミットは単独で `bunx tsc --noEmit` 通過すること。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。
