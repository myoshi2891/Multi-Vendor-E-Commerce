# Open Questions and Gaps

- Are taxes, duties, or multi-currency pricing planned?
- What is the intended refund and return workflow beyond status enums?
  *(Partially resolved — support-forms now provides a public return-request /
  dispute intake (`SupportTicket`, `category=RETURN_REQUEST`/`DISPUTE`, `orderId`
  captured, `status` defaults to `OPEN`). The downstream refund processing
  (stock restock, Stripe/PayPal refund) and an operator-side ticket viewing/
  status-update UI remain out of scope — see `docs/design/support-forms/` §4.)*
- What analytics or reporting requirements are expected for sellers/admins?
  *(Partially resolved — admin KPI dashboard (Phase 2 F1) and seller store
  dashboard (seller-dashboard Phase 3: revenue from Paid orders, orders, views,
  sales, products, low-stock count + sales-over-time chart, recent orders, top
  products, store-scoped via `requireStoreOwner`) are implemented. Advanced
  reporting (cohorts, funnels, exports) remains out of scope for the current phase.
  See `docs/design/admin-dashboard/tasks.md` and
  `docs/design/seller-dashboard/tasks.md` for roadmap.)*
- Are there data retention or privacy requirements beyond auth defaults?

## Known Issues

### E2E テスト: Firefox でカートページナビゲーションがタイムアウト

**影響範囲**: Firefox ブラウザでの E2E テスト実行時、`/cart` へのナビゲーションが 30 秒でタイムアウトする（開発環境のみ）

**症状**:
- `page.goto("/cart")` が `waitUntil: "commit"` / `"domcontentloaded"` / `"load"` すべてでタイムアウト
- サーバーは正常に `GET /cart 200` を返却しているが、Playwright のナビゲーション完了イベントが発火しない
- Chromium・WebKit では同じコードが正常動作

**根本原因**:
開発環境の Next.js HMR (Hot Module Replacement) WebSocket と Firefox の相互作用により、ページの "load" / "domcontentloaded" イベントが完了しない。商品ページや他のページでは問題が発生せず、カートページに限定される理由は不明。

**回避策**:
- `tests/e2e/purchase-flow.spec.ts`: Firefox のカートテストを `test.skip()` で無効化
- `tests/e2e/mobile-responsive.spec.ts`: Firefox のモバイルチェックアウトテストを無効化
- Chromium・WebKit で品質保証を継続（本番環境では Firefox も正常動作する想定）

**長期対応案**:
1. **本番ビルドでのテスト**: `bun run build && bun run start` で HMR なしの環境でテストを実行
2. **ページ調査**: CartContainer の useEffect やクライアントコンポーネントの処理を調査
3. **Playwright バージョン更新**: 最新版で Firefox の挙動が改善されている可能性

**関連ファイル**:
- `tests/e2e/purchase-flow.spec.ts` (スキップロジック)
- `tests/e2e/mobile-responsive.spec.ts` (スキップロジック)
- `src/components/store/cart-page/container.tsx` (カートページロジック)

**記録日**: 2026-03-24
**ステータス**: 回避策実装済み（Firefox テストはスキップ、Chromium/WebKit で品質保証）

### E2E テスト: 重い注文フローが間欠的に 120s ハングする (OI-9)

**影響範囲**: `tests/e2e/stock-decrement.spec.ts` / `tests/e2e/platform-coupon.spec.ts` 等、
sign-in → cart → checkout → place order を通す重いフロー。chromium / webkit で間欠的に
1 テストが `test.setTimeout(120000)` を使い切ってタイムアウトする。

**症状**:
- 失敗が run ごとに別テストへ移動する（run1: `stock-decrement` / run2: `platform-coupon`）。
- 失敗 run のスナップショットでは商品ページの `size-option` / `add-to-cart` に到達せず、
  カート 0 のままホームに滞留している。

**調査経緯（重要: 当初仮説は反証済み）**:
- 当初「Neon + Prisma Accelerate の負荷下間欠ハングが原因」と仮説し、E2E をローカル
  docker Postgres（`postgresql://dev:dev@localhost:5432/multivendor_dev`）へ向ける検証を実施。
- migrate/seed が `localhost:5432` に成功し webServer もローカル seed を読めることを確認した
  にもかかわらず、**ローカル Postgres でも 3 run 中 1 run で 120s ハングが再現した**。
- → **DB バックエンド（Neon/Prisma）は真因ではない**ことが controlled experiment により確定。
  ハングは DB ではなく **sign-in 後のブラウザ側ナビゲーション/データ準備レース**。共有ローカル
  DB に対し 3 ブラウザを直列実行する構成で、軽微なタイミング差により間欠化する。

**回避策（実装済み）**:
- ローカル opt-in 経路 `bun run test:e2e:local`（`scripts/e2e/run-local.sh`）が
  `bunx playwright test --retries=2` で実行し、CI（`playwright.config.ts` の `retries: 2`）と
  同じく新規プロセス再実行で間欠ハングを吸収する。ローカル既定（`retries: 0`）では救済されない。
- テストコードは無修正（環境/同期起因のため、ロジック修正は「もぐら叩き」になる）。

**長期対応案（恒久修正・未着手）**:
1. 失敗 run の `test-results/.../trace.zip` を `npx playwright show-trace` で解析し、
   120s を消費した操作が gotoStable の商品 goto か `size-option` 待ちかを確定する。
2. sign-in 後のナビゲーション同期（`waitForPostSignInSettle` / `gotoStable`）の強化、または
   3 ブラウザ直列実行時の seed データ分離（suffix）/共有 DB 競合の見直し。

**関連ファイル**:
- `scripts/e2e/run-local.sh`（ローカル opt-in 実行・retries 吸収）
- `docs/development/docker-dev.md`（経緯と使い方の詳細）
- `src/config/test-helpers.ts`（`gotoStable` / `waitForPostSignInSettle`）
- `tests/e2e/seed/constants.ts`（seed suffix 分離ロジック）

**記録日**: 2026-06-21
**ステータス**: retries で吸収（恒久修正は未着手・trace 解析待ち）

### modal-provider テスト: CI環境での実行時のランダムな失敗 (OI-8)

**影響範囲**: `src/providers/modal-provider.test.tsx` の一部テストが、CI (GitHub Actions) 環境でまれに失敗する。

**症状**:
- `[P1] モーダルを開くと...` テストにおいて、assertion error などの明確なエラーメッセージを出力せず、完全に空の状態でテストが失敗する。
- 開発者ローカル環境（M4 Mac等）では再現しない。

**根本原因**:
詳細な原因は未検証（ResizeObserver の挙動、Radix UI のアクティブな要素へのフォーカス処理、jsdom での非同期イベントタイミングなどが疑われる複数の仮説がある）。
これまでの対策として、`ModalProvider.setOpen` を非同期から同期処理に変更する設計改善を行ったが、CIでの偶発的な失敗（flake）は根治されなかった。詳細は [ADR-003: ModalProvider setOpen 同期化](../../docs/architecture/decisions/003-modal-setopen-sync-for-react19.md) を参照。

**回避策**:
- `src/providers/modal-provider.test.tsx` 内の該当テストに `it.skip` を適用し、CI の安定稼働を最優先として一時的に退避。
- 同等のカバレッジは `[P1] fetchData なしでモーダルを開ける` などの他テストで一部担保。

**長期対応案**:
- `.claude/skills/ci-flake-diagnosis/SKILL.md` の診断プロセスに基づき、CI 実行時の環境変数・jsdom バージョン・非同期モックなどを精査し、根本原因を特定してテストのスキップを解除する。
- 目標解決期限: 2026-06-07。

**関連ファイル**:
- `src/providers/modal-provider.test.tsx` (テスト定義、`it.skip`)
- `src/providers/modal-provider.tsx` (SUT)
- `docs/architecture/decisions/003-modal-setopen-sync-for-react19.md` (ADR-003)
- `docs/testing/QA_HANDOFF.md` (OI-8 追跡用 SSOT)

**記録日**: 2026-05-24
**ステータス**: 回避策実装済み（CI flake回避のため該当テストを一時スキップ中、解決期限: 2026-06-07）

### applyCoupon: `cart.total` の残存ロストアップデート (CAS は couponId のみ保護)

**影響範囲**: `src/queries/coupon.ts::applyCoupon` の Step 7 条件付き `updateMany`
（`where: { id, userId, couponId: null }` の DB レベル CAS）。

**症状**:
- Step 6 で `newTotal = cart.total.sub(discountedAmount)` を計算し、Step 7 で書き込む。
- CAS は `couponId: null`（once-only 適用）のみを保護しており、`cart.total` 自体の
  バージョンは検証していない。`applyCoupon` が `cart.total` を読んだ後・書き込む前に
  別リクエスト（`addToCart` / `updateCart` 等）が `cart.total` を更新すると、
  古い `cart.total` から算出した `newTotal` で上書きしてしまう（ロストアップデート）。
- クーポン適用（`couponId` の once-only）自体は TOCTOU 修正（§7）でアトミック化済み。
  本件はそれとは独立した、`total` フィールドに対するより狭い競合ウィンドウ。

**根本原因**:
TOCTOU 修正は `couponId` の once-only 保証に焦点を当てており、`cart.total` の
楽観的並行制御までは含めていない。

**回避策（現状）**:
- 未対応。`Cart` モデルには `updatedAt @updatedAt` が存在するため技術的には
  `where` に `updatedAt` を加える「最小修正」が可能だが、無関係なカート編集との競合時に
  `"Coupon is already applied to this cart."` という誤解を招くメッセージで失敗するため
  採用しない（コードレビューでスキップ判断）。

**長期対応案**:
- 読み取り → `newTotal` 再計算 → 書き込みを `db.$transaction` 内で行い、
  トランザクション内の最新 `cart.total` から `newTotal` を導出する。
  once-only ガードは `couponId: null` CAS を維持。エラー/返却セマンティクスが
  変わるため、別タスクとして実施する。

**関連ファイル**:
- `src/queries/coupon.ts` (`applyCoupon` Step 6〜7)
- `docs/testing/SECURITY_GAP_REPORT.md` §7（TOCTOU 修正の文脈・残課題注記）

**記録日**: 2026-06-17
**ステータス**: 未対応（残課題として記録、対応は transaction リファクタを伴う別タスク）

### applyCoupon: 意図的 domain error が汎用メッセージで上書きされる（`isDomainError` 未適用）

**影響範囲**: `src/queries/coupon.ts::applyCoupon`（`:311-446`）の catch（`:429-433`）。

**症状**:
- `applyCoupon` の catch は `isDomainError`（`coupon.ts:36`）を**一切呼ばない**。そのため
  関数内で意図的に throw しているユーザー起因エラーが、すべて
  `Error occurred while applying coupon: <元の文言>` に上書きされ、さらに
  `logError('[Coupon:applyCoupon] failed to apply coupon', error)` で運用ログにも載る。
- 上書きされる意図的 throw は **6 種**（実測 2026-07-30）:

  | 行 | メッセージ |
  |---|---|
  | `:328` | `Coupon not found.` |
  | `:336` | `Coupon is not valid for this date.` |
  | `:341` | `This coupon has been deactivated.` |
  | `:357` | `Cart not found`（**末尾ピリオドなし** — `domainMessages` の `'Cart not found.'` 系と表記が揺れている） |
  | `:362` / `:408` | `Coupon is already applied to this cart.` |
  | `:374` | `No items in the cart belong to the store associated with this coupon.` |

- `coupon.ts` の 10 個の export のうち `isDomainError` の適用は **7 箇所**
  （`:142` / `:217` / `:252` / `:292` / `:530` / `:572` / `:611`）。残る **3 つ**
  （`getStoreCoupons` / `getAllCoupons` / `applyCoupon`）は未適用であり、
  10 − 7 = 3 で釣り合う。
- そのうち **`applyCoupon` だけが修正を要する**。判定基準は「export 数」ではなく
  **try ブロック内に意図的な domain throw を持つか**である:
  - `getStoreCoupons`（`:174-186`）と `getAllCoupons` は、try 内に意図的な throw が**無く**、
    catch 内の汎用 DB エラー throw しか持たない。認可ガード（`requireStoreOwner` /
    `requireAdmin`）は tech.md の規約どおり **try/catch の外**にあるため、認可エラーが
    汎用メッセージで上書きされる経路がそもそも存在しない。**`isDomainError` は不要**。
  - `applyCoupon` は try 内に上表の domain throw を多数持つため、`isDomainError` が
    無いとそれらが catch の汎用メッセージへ潰される。**未適用 3 つのうち、意図的な
    domain throw を持つのは `applyCoupon` のみ**。

**根本原因**:
`isDomainError` は upsert 系（Round 14）→ get/delete 系（Round 17）と段階的に適用されてきたが、
`applyCoupon` は当時どちらのバッチにも入っていなかった。同一欠陥クラスの残存。

**既存テストが検出できない理由**:
`coupon.test.ts` の applyCoupon 系アサーション（`:835` の `toThrow("Coupon not found.")` 等）は
**`toThrow(string)` の部分一致**で、ラップ後の `Error occurred while applying coupon: Coupon not found.`
にも部分文字列として含まれるため**全件 pass する**。前ラウンドで upsert / get / delete 系に対して
是正したのと同型の空振り。

> **これらのアサーションは本 Issue の対応時まで意図的に触らない。** 正規表現アンカー
> （`/^Coupon not found\.$/`）へ変えると現状のコードでは fail するため、コード修正と
> 同一コミットで行う必要がある。先にテストだけアンカー化すると Red のまま残る。

**長期対応案**:
1. `domainMessages` に applyCoupon の 6 文言を追加（`Cart not found` の表記揺れをどう扱うかを
   同時に決める。ピリオドを足すなら実装側も変えるためユーザー可視の文言変更になる）。
2. `applyCoupon` の catch 冒頭に `if (isDomainError(error)) throw error` を追加。
3. 上記アサーション 7 件をアンカー化（Red を観測してから Green）。

**別プランとして実施する理由**: エラー表面が 6 箇所変わり、うち 1 件はユーザー可視の文言統一
（`Cart not found` のピリオド）を伴うため、独立したレビューが必要。

**関連ファイル**:
- `src/queries/coupon.ts`（`isDomainError` `:36-50` / `applyCoupon` `:311-446`）
- `src/queries/coupon.test.ts`（applyCoupon の toThrow アサーション群）
- `.claude/steering/tech.md`「エラーハンドリング」（認可・domain エラーを汎用 DB エラーで
  上書きしない原則）

**記録日**: 2026-07-30
**ステータス**: 未対応（起票のみ。コード変更は別プラン）

## Resolved Issues

- `getUserWishlist` (`src/queries/profile.ts`): `variants[0]` への直接アクセスが
  空のバリアント配列で TypeError を発生させていた。`.filter()` で空バリアント商品を
  除外するガードを実装。
- `getProductShippingFee` (`src/queries/product.ts`): 無料配送対象国の比較で
  `country.name` を使用していたバグを `country.id` に修正。
- `webhooks/route.ts`: `email_addresses[0]?.email_address` が undefined でも
  DB操作に渡される問題。`primaryEmail` 抽出 + 早期リターン（400）で防止。
  到達不能コード `if (!user) return;` も削除。
- `review.ts`: IDOR脆弱性修正。`upsert` → 所有権検証付き `update`/`create`。
- `webhooks/route.ts`: Svix検証済み `evt.data` を使用（`JSON.parse(body).data` の
  再パースを排除）。
- `webhooks/route.ts`: upsert の lookup key を `email` → `id` に変更。
  Clerk user ID はイミュータブルなため、メール変更後もレコードが確実にマッチ。
- `webhooks/route.ts`: `db.user.delete` → `db.user.deleteMany` で冪等化。
  レコード不在時も `{ count: 0 }` を返し、Svix リトライループを防止。
- `webhooks/route.ts`: `db.user.upsert` + `clerkClient.users.updateUserMetadata`
  を try/catch でラップし、失敗時に 500 を返却（未ハンドル例外を防止）。
- `store.ts` (`updateStoreStatus`): `store.update` + `user.update` を
  `db.$transaction` でアトミック化。PENDING→ACTIVE 遷移時の不整合を防止。
- `store.ts` (`updateStoreStatus`): try/catch 追加。DB 操作失敗時にエラーを
  ログ出力して再スロー（`deleteStore` パターンに統一）。
- `store.test.ts`: `any` → `Record<string, unknown>` + `MockPrismaClient`
  インターフェースで型安全なモック定義を導入。
- `getShippingDetails` / `getProductShippingFee` (`src/queries/product.ts`):
  ITEM/WEIGHT/FIXED の各配送料計算を実装。店舗の ShippingRate と
  freeShipping 設定に基づいてユーザーの国に応じた配送料を算出。
- `placeOrder` (`src/queries/user.ts`): `db.$transaction` でアトミックに
  注文作成・在庫減算を実行。トランザクション内で在庫チェックと更新を行い
  オーバーセルを防止。
- `ProductWatch` (`src/components/store/product-page/product-info/product-watch.tsx`): 閲覧者数取得のWebSocket接続失敗時のコンソールエラーを抑制し、安全に非表示にフォールバックするように修正。
- `ThemeProvider` & `cookies()` (`src/providers/theme-provider.tsx`, `src/queries/product.ts`): ハイドレーションエラー警告および `cookies()` 非同期化に伴うSSRの不整合を解消。
- `ReviewDetails` (`src/components/store/forms/review-details.tsx`): React 19 と互換性のない `react-rating-stars-component` を廃止し、自前のカスタム評価UI (`CustomRatingStars`) に置き換え、星が描画されない問題を解決。また、バリアント色が `[object Object]` になって保存されるバグを `.map((c) => c.name)` の適用で修正。
- `upsertReview` (`src/queries/review.ts`): Clerk Webhook 未受信によるローカルDBへの `User` 登録漏れ（外部キー制約エラー）を防ぐため、存在しない場合に Clerk 情報を基に User を自動同期（フォールバック）する処理を追加。また、エラー伝播を詳細化。
