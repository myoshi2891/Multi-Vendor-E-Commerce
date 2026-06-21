# Storefront Static Pages — 実装タスク（tasks.md）

> [.claude/rules/02-tdd-step-commit.md](../../../.claude/rules/02-tdd-step-commit.md) 準拠。各タスクを **Red → Green → Refactor** とコミット粒度に分解する。
> 要件 ID は [requirements.md](./requirements.md)、設計詳細は [design.md](./design.md)。進捗は [PROGRESS.md](./PROGRESS.md)。

---

## 0. 実装前チェック（必須・SKILL 呼び出し漏れ防止）

- [ ] **[feature-plan](../../../.claude/skills/feature-plan/) を起動**し、本設計書を入力に最終計画化・**ユーザー承認**を取得（コード着手前・必須）。
- [ ] 新規コードに `any` 禁止（`unknown` + 型ガード）。`console.log` 禁止。
- [ ] 各ページは server component。コンテンツは型付き定数（`StaticSection[]`）。
- [ ] `dangerouslySetInnerHTML` を使わない（plain text 描画・[design §2.0](./design.md)）。
- [ ] `force-dynamic` は付与しない（[design §判断3](./design.md)）。
- [ ] **server-action-scaffold / safe-migration は起動しない**（新規 server action・schema 変更なし）。
- [ ] **完了の定義**: [test-complete](../../../.claude/skills/test-complete/)（lint / tsc / test）通過 + `bun run build` 成功。
- [ ] テスト数が変動したら [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) → `bun run coverage:dashboard`（**同一コミット**で同期）。

---

## SKILL シーケンス（本機能・俯瞰）

```
0. feature-plan         本設計書を入力に最終計画化・承認取得（必須）
1. test-gen             共有レイアウト/ページ描画/リンク回帰の RTL（Red→Green）
2. test-complete        lint/tsc/test（各コミット前・必須）
3. spec-sync-after-test テスト数変動 → QA_HANDOFF(SSOT)→伝播 + dashboard 再生成（同一コミット）
4. spec-sync-check      最終ドリフト確認（任意）
```

> 本機能は **単一フェーズ**（破壊的変更なし）。「テストコード」「実装」「ドキュメント同期」を別コミットに分離（rule 02）。

---

## Phase 1: 共有レイアウト + 各ページ + 導線配線

### 1-A. 共有レイアウト部品　【SKILL: test-gen】

| Step        | 内容                                                                                                                                               | コミット例                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1-A-1 Red   | [test-gen](../../../.claude/skills/test-gen/) で `static-page-layout.tsx` の描画テスト（`sections` の heading/段落が出る）を書き失敗確認（AC-SP1） | `test(static): add failing static-page-layout render test` |
| 1-A-2 Green | [design §2.0](./design.md) のコードで `static-page-layout.tsx` を作成 → Green                                                                      | `feat(static): add shared StaticPageLayout component`      |

### 1-B. コンテンツ定数 + 各ページ　【SKILL: test-gen】

| Step            | 内容                                                                                                                                       | コミット例                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1-B-1           | `content/{about,legal,faqs,product-support,customer-service}.ts` を作成（プレースホルダ文面）                                              | `feat(static): add page content constants`                                                              |
| 1-B-2 Red→Green | 代表ページ（about）の描画テスト（`<h1>About`）を書き（Red）→ `about/page.tsx` 作成（Green）。`legal`/`faqs`/`product-support` も同型で追加 | `test(static): add about page render test` / `feat(static): add about/legal/faqs/product-support pages` |
| 1-B-3 Red→Green | `customer-service/page.tsx` の 5 導線 `href` テスト（Red）→ 実装（Green）（AC-SP3）                                                        | `test(static): assert customer-service portal links` / `feat(static): add customer-service portal page` |
| 1-B-4           | `/faq` → `/faqs` の redirect ページ作成（単体テストは付けない・[design §3 注](./design.md)）                                               | `feat(static): redirect /faq to canonical /faqs`                                                        |

> **コミット粒度**: ページは「同一カテゴリ・3ファイル以下・200行未満」なら rule 02 の Tier 2 として束ねて可。超える場合は分割（about/legal/faqs を1コミット、product-support/customer-service/faq を別コミット等）。

### 1-C. 導線配線（user-menu）　【SKILL: test-gen】

| Step        | 内容                                                                                                                                     | コミット例                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1-C-1 Red   | user-menu の「Help Center」→`/customer-service`・「Legal & Privacy」→`/legal` の期待値テストを書き、**現状 `""` で失敗確認**（AC-SP4/5） | `test(user-menu): add failing help-center/legal link regression` |
| 1-C-2 Green | [design §2.5](./design.md) の diff で `user-menu.tsx` の 2 行を修正 → Green                                                              | `fix(user-menu): wire help-center and legal links`               |

### 1-D. 品質チェック　【SKILL: test-complete】

- [ ] [test-complete](../../../.claude/skills/test-complete/): `bun run lint` / `bunx tsc --noEmit` / `bun run test` + `bun run build`。**全緑後にコミット**（rule 02 NEVER）。

### 1-E. ドキュメント同期　【SKILL: spec-sync-after-test】

- [ ] テスト数変動 → [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/)。
    - `QA_HANDOFF.md`（**統計 SSOT**）→ `07-testing.md` / `COVERAGE_REPORT.md` / `docs/PROGRESS.md` へ伝播。
    - 新規ルート追加のため `04-interfaces.md`（`/about` 他）/ `05-workflows.md`（ポータル導線）を同期。
    - `bun run coverage:dashboard` で `docs/coverage-dashboard.html` 再生成。
    - 上記を **ドキュメント同期コミット**（実装と別）にまとめる。
- コミット例: `docs: sync static pages stats and regenerate coverage dashboard`

### 1-F. 最終ドリフト確認　【SKILL: spec-sync-check・任意】

- [ ] [spec-sync-check](../../../.claude/skills/spec-sync-check/) でドリフト確認（報告のみ）。

---

## レビュー必須ポイント（着手前に確認）

- [ ] `body` を plain text 描画に保てているか（XSS 回避・`dangerouslySetInnerHTML` 不使用）。
- [ ] user-menu の**他の空文字リンク**（Return & Refund / Discounts & Offers / Dispute / Report）を**触っていない**か（各別設計書が担当）。
- [ ] 文面がプレースホルダであることをレビュアー/運営に共有したか。

---

## コミット分割サマリー（rule 02 準拠）

| コミット | 種別      | 内容                                                   |
| -------- | --------- | ------------------------------------------------------ |
| 1        | test      | StaticPageLayout 描画テスト（Red）                     |
| 2        | feat      | StaticPageLayout 実装（Green）                         |
| 3        | feat      | コンテンツ定数                                         |
| 4        | test+feat | 静的ページ（about/legal/faqs/product-support）         |
| 5        | test+feat | customer-service ポータル + /faq redirect              |
| 6        | test      | user-menu リンク回帰（Red）                            |
| 7        | fix       | user-menu 配線（Green）                                |
| 8        | docs      | spec-sync + dashboard 再生成（統計同期は単独コミット） |

> 各コミットは単独で `bunx tsc --noEmit` 通過。複数フェーズ混在の巨大コミット禁止（rule 02 NEVER）。
