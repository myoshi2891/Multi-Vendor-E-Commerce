# a11y (Accessibility) Tests

## 概要

`@axe-core/playwright` を使った a11y スキャン。WCAG 2.1 AA 適合を計測する。
認証フォーム（MVP / Phase 2）に加え、顧客の滞在時間が長いゲストのストアフロント
主要ページ（Phase 3）を対象とする。

## スコープ

| ページ | URL | 認証 | Phase |
|---|---|---|---|
| Sign-in | `/sign-in` | 不要 | **MVP** |
| Seller Apply Step 1 | `/seller/apply` | 不要 | **MVP** |
| Checkout | `/checkout` | 必須 (USER) | **Phase 2**（2026-05-22 追加、OI-3） |
| Profile | `/profile` | 必須 (USER) | **Phase 2**（2026-05-22 追加、OI-3） |
| Browse | `/browse` | 不要 | **Phase 3**（2026-08-09 追加、plan 052 / TESTS-43） |
| Product 詳細 | `/product/[productSlug]/[variantSlug]` | 不要 | **Phase 3**（同上。URL は seed 依存） |
| Cart（空状態） | `/cart` | 不要 | **Phase 3**（同上。商品入りは checkout と重複のため対象外） |
| Home | `/` | 不要 | 今後（**着手可能**）|
| Seller Apply Step 2-4 | `/seller/apply` | 必須 | 今後 |

> Phase 3 の初回スキャンで critical 3 種 / serious 2 種の実違反を検出し、
> `sort.tsx` / `quantity-selector.tsx` / `categories-menu.tsx` を修正した
> （commit `df4d4f7`）。
>
> **Home の前提だった OI-9（`featured.tsx` の SSR 500）は 2026-06-06 に解消済み**
> （`c196e3d5`。2026-07-26 に E2E で SSR 200 を実測）。plan 052 本文は執筆時点
> （2026-07-12）の情報で「OI-9 未解消」と書いているが、実際には解消後だった。
> `home.spec.ts` の追加は依存なしで着手できる。

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
