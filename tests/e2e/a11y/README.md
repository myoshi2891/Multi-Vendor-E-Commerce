# a11y (Accessibility) Tests

## 概要

`@axe-core/playwright` を使ったフォーム a11y スキャン。WCAG 2.1 AA 適合を計測する。
本ディレクトリは MVP として未認証ページ 2 つ (`/sign-in`, `/seller/apply` Step 1) を対象とする。

## スコープ

| ページ | URL | 認証 | Phase |
|---|---|---|---|
| Sign-in | `/sign-in` | 不要 | **MVP** |
| Seller Apply Step 1 | `/seller/apply` | 不要 | **MVP** |
| Checkout | `/checkout` | 必須 (USER) | **Phase 2**（2026-05-22 追加、OI-3） |
| Profile | `/profile` | 必須 (USER) | **Phase 2**（2026-05-22 追加、OI-3） |
| Seller Apply Step 2-4 | `/seller/apply` | 必須 | 今後 |

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

## Phase 2（認証必須ページ）

`tests/e2e/helpers/auth.ts` の `createCustomerSession()` で Clerk テストモードのユーザーを
動的作成・サインイン・クリーンアップする。`CLERK_SECRET_KEY` が未設定の環境では `test.skip` で自動スキップ。

### 前提

- `CLERK_SECRET_KEY` がローカル環境変数または CI Secrets に設定されていること
- Clerk テストモード（メールに `+clerk_test@` を含むと検証コード自動 OK）が有効

### 実装パターン

```typescript
const session = createCustomerSession();

test.beforeAll(async () => {
    await session.create({ role: "USER" });
});
test.afterAll(async () => {
    await session.cleanup();
});

test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
    await session.signIn(page);
    await runA11yScan(page, "/profile", { readinessLocator: page.getByRole("main") });
});
```

参照: `tests/e2e/a11y/checkout.spec.ts`, `tests/e2e/a11y/profile.spec.ts`

## 関連

- 上位計画: `~/.claude/plans/melodic-plotting-bubble.md` の A3
- テスト設計: `docs/testing/TESTING_DESIGN.md`
