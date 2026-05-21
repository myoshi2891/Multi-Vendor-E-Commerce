# a11y (Accessibility) Tests

## 概要

`@axe-core/playwright` を使ったフォーム a11y スキャン。WCAG 2.1 AA 適合を計測する。
本ディレクトリは MVP として未認証ページ 2 つ (`/sign-in`, `/seller/apply` Step 1) を対象とする。

## スコープ

| ページ | URL | 認証 | Phase |
|---|---|---|---|
| Sign-in | `/sign-in` | 不要 | **MVP（本ディレクトリ）** |
| Seller Apply Step 1 | `/seller/apply` | 不要 | **MVP（本ディレクトリ）** |
| Checkout | `/checkout` | 必須 | Phase 2（Clerk テストセッション整備後） |
| Seller Apply Step 2-4 | `/seller/apply` | 必須 | Phase 2 |

## 実行

```bash
bunx playwright test tests/e2e/a11y --project=chromium
```

違反があるとテストが fail し、`results.violations` の概要がコンソールに出力される。

## 既知違反の抑制

修正困難な違反は `AxeBuilder.disableRules([...])` で一時抑制し、必ず以下のコメントを残すこと:

```typescript
const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // TODO(#issue-number): color-contrast 違反は Clerk テーマ調整が必要
    .disableRules(["color-contrast"])
    .analyze();
```

抑制は仮の措置であり、フォローアップ issue を必ず作成する。

## Phase 2

- `/checkout` の a11y スキャン（カート投入 + Clerk テストセッションでサインイン）
- 認証必須ページの自動化ヘルパー整備
- Cypress / Playwright での CI 統合

## 関連

- 上位計画: `~/.claude/plans/melodic-plotting-bubble.md` の A3
- テスト設計: `docs/testing/TESTING_DESIGN.md`
