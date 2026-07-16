# Recon Notes — improve スキル deep 監査

- **監査日**: 2026-07-03
- **監査対象 HEAD**: `f9752c0`（branch: `dev`）
- **effort level**: deep（全9カテゴリ / リポジトリ全体 / Explore サブエージェント 8体・2ウェーブ）

## リポジトリ概要

マルチベンダー E コマースマーケットプレイス（USER / SELLER / ADMIN の3ロール）。

| 項目 | 値 |
|---|---|
| Framework | Next.js 16.2.1 (App Router) + React 19 + TypeScript strict |
| DB | PostgreSQL (Neon) + Prisma 5.22.0 + Prisma Accelerate。全文検索は tsvector |
| 認証 | Clerk v7.0.7（`src/middleware.ts`） |
| 決済 | Stripe 17.4.0 / PayPal (`@paypal/react-paypal-js`) |
| その他 | Cloudinary（画像）、Svix（Webhook 検証）、Zustand（cart/compare store） |
| パッケージマネージャー | Bun（`bun.lock`） |

## 検証コマンド（ベースライン @ f9752c0）

> **表題の「実測済み」は表全体には掛からない。** 下表は **3 種の出所が混在**しており、
> **区分**列で明示する。区分を書かずに一括で「実測済みベースライン」と呼ぶと、
> 後続ラウンドが**転載値や未実行の項目を実測値として引き継ぐ**（数値が独り歩きし、
> 「いつ・誰が測ったか」が失われる）。
>
> - **実測** = 本 recon の監査時（2026-07-03 / HEAD `f9752c0`）に**実際に実行**した
> - **転載** = 他ドキュメントに記録された値を**引き写した**（測定日と出所が別）
> - **未実行** = 本 recon では**走らせていない**（値は参考・前提）

| 目的 | コマンド | 区分 | ベースライン結果 |
|---|---|---|---|
| 型チェック | `bunx tsc --noEmit` | **実測** | exit 0（エラー 0 件） |
| Lint | `bun run lint` | **実測** | exit 0（0 errors / **15 warnings**） |
| ユニット/コンポーネント | `bun run test` | **転載**（`docs/testing/QA_HANDOFF.md` 2026-06-26 時点） | 1659 passed / 1662 total / 172 suites |
| 統合（実DB） | `bun run test:integration` | **未実行**（testcontainers / Docker 前提） | 17 tests / 2 suites（参考値） |
| E2E | `bunx playwright test` | **未実行** | 9 spec + visual 2 + a11y 4（構成の参考値） |
| 依存監査 | `bun audit` | **実測** | **97 件**（critical 3 / high 35 / moderate 45 / low 14）詳細下記 |
| ビルド | `bun run build` | **未実行**（CI で検証済みの前提） | — |

> **転載・未実行の値を根拠にプランの Done criteria を書かないこと**。必要なら
> 着手時に実行して測り直す（テスト統計の SSOT は `docs/testing/QA_HANDOFF.md`）。

### bun audit の要点（ランタイム到達性で選別）

- 🔴 **`@clerk/nextjs` 7.0.7（直接依存・ランタイム）**: CRITICAL [GHSA-vqx2-fgx2-5wq9](https://github.com/advisories/GHSA-vqx2-fgx2-5wq9)（ミドルウェアベースのルート保護バイパス、>=7.0.0 <=7.2.3 が影響）+ HIGH GHSA-w24r-5266-9c3c。修正版は 7.2.4 以降（最新 stable 7.5.x）。
- 🔴 `js-cookie` HIGH（`@clerk/nextjs › @clerk/backend › @clerk/shared` 経由）→ Clerk 更新で解消見込み。
- 🟡 `jodit` moderate prototype pollution（`jodit-react` 経由・リッチテキストエディタ＝ランタイム）。
- ⚪ dev 専用（本番非到達）: `handlebars`（ts-jest 経由）、`ws`（jsdom / @lhci/cli 経由）、`picomatch`（jest/tailwind 等）。
- **証跡の所在**: 監査実行ログの全文は**セッション scratchpad に保存されており
  コミット対象外**。つまり**リポジトリ内には 97 件の内訳を裏付ける証跡が残っていない**
  （scratchpad はセッション終了で失われるため、後任は上記サマリを検証できない）。
  再監査防止のため、以下のいずれかを**リポジトリ内に**残すこと:
  - **(A) 要約表を本ファイルに置く**（推奨）— 少なくとも
    **ランタイム到達性のある advisory** について
    `GHSA ID / パッケージ / 深刻度 / 経路（直接依存 or transitive の親）/ 修正版`
    を表で記録する。上の 🔴🟡⚪ の箇条書きはこの要約の core にあたるので、
    GHSA ID と修正版を各行に補って表へ昇格させれば足りる。
  - **(B) 再実行手順 + 期待内訳を明記する** — 「`bun audit` を実行し、
    **critical 3 / high 35 / moderate 45 / low 14（計 97）** と一致するか確認する。
    一致しない場合は依存が動いているので内訳の差分を特定する」という形で、
    **期待値付きの検証手順**として書く（数値だけを置くと、次に誰かが実行したとき
    増減の意味を判断できない）。
  > **dev 専用（本番非到達）の 90 件超をそのまま「97 件」として引用しない**こと。
  > 判断に効くのはランタイム到達性のある 3 件（Clerk / js-cookie / jodit）であり、
  > 総数は深刻度の指標として誤解を招く。

### lint 警告の要点

- `react-hooks/incompatible-library`: TanStack Table `useReactTable()` がメモ化不能（データテーブル系）
- 残りは tailwindcss classname order 等の warn（計 15 件、エラー 0）

## 規約（プランに必ずインラインすべきもの）

1. **認可ガード**: `src/lib/auth-guards.ts` の `requireUser`/`requireAdmin`/`requireSeller`/`requireStoreOwner` 必須。インライン `currentUser()` + role チェックの新規追加禁止。ガードは try/catch の**外**。
2. **金額**: `Decimal(12,2)` + `Prisma.Decimal` メソッド演算。ループ内 `.toNumber()` 加算禁止。`toNumber()` は return 境界のみ。
3. **構造化ログ**: `console.error("[Module:Function] msg", { error, stack })` 2引数形式。`src/` で `console.log` 禁止。
4. **Server Action は `src/queries/` のみ**。UI から直接 import 禁止。Zod スキーマは `src/lib/schemas.ts`。
5. **DB アクセスは `src/lib/db.ts` シングルトン**（seed/テストは例外）。複数テーブル更新は `db.$transaction`。
6. **DB 依存ページは `export const dynamic = 'force-dynamic'`**（CI ビルド安定性のため。SSG 放棄は文書化済みトレードオフ）。
7. **テスト**: AAA パターン。server action テストは `src/queries/*.test.ts` co-located。IDOR テストは 3 階層 (a)スロー/(b)where構造/(c)副作用なし（`docs/testing/SECURITY_GAP_REPORT.md` §5.2）。
8. **コミット**: Conventional Commits。テスト追加は 1 ファイル 1 コミット原則（`.claude/rules/02-tdd-step-commit.md`）。
9. **配送料計算は `src/lib/shipping-utils.ts::computeShippingTotal`** に一元化。
10. **cookie パースは `parseUserCountryCookie()`**（`src/lib/utils.ts`）。生 `JSON.parse` + キャスト禁止。

## 決定済みトレードオフ（findings として報告しない）

| 決定 | 根拠 |
|---|---|
| CSRF トークンモジュールを作らない（Next.js Origin/Host 検証 + Clerk SameSite=Lax に依拠） | ADR-001 |
| CI Jest の `--verbose` 常用 | ADR-002 |
| `ModalProvider.setOpen` の同期化（floating promise 回避） | ADR-003 |
| 統合テストは testcontainers + 実 PostgreSQL | ADR-004 |
| SonarCloud は CI 非ブロッキング（`continue-on-error`） | ADR-005 |
| `reactStrictMode: false` | `next.config.mjs`・既知の制約 |
| Elasticsearch は放棄、tsvector 採用（コメントアウト残置は既知） | `docs/migration/` |
| DB 依存ページの SSG/ISR 放棄（`force-dynamic`） | `.claude/steering/tech.md` |
| `middleware`→`proxy` 警告・AVIF Turbopack 警告に対応しない | `.claude/steering/tech.md` |
| スコープ外: 多通貨 / 税計算 / 高度分析 / 配送キャリア連携 | `.claude/steering/product.md` |

## 既知・追跡済みの未対応課題（監査での再発見は不要。プラン化候補）

| ID | 内容 | SSOT |
|---|---|---|
| OI-9 (QA_HANDOFF) | ホーム `/` が本番 SSR で 500（`featured.tsx` の `window` をモジュール初期化子で参照） | `docs/testing/QA_HANDOFF.md` 残課題表 最優先 |
| OI-11 | `/dashboard/seller` 系が本番 SSR で `ReferenceError: self is not defined`（`next-cloudinary` の `CldUploadWidget` サーバ評価） | 同上 |
| OI-10 | a11y color-contrast 負債（checkout / profile / seller/apply）。axe の `color-contrast` ルールを意図的に抑制中 | 同上 |
| C2 | Bundle size 継続監視の仕組みが無い（`@next/bundle-analyzer` + size-limit 案） | 同上 |
| — | `applyCoupon` の `cart.total` ロストアップデート（CAS は couponId のみ保護。対応は $transaction リファクタ） | `specs/.../08-open-questions.md` Known Issues |
| — | E2E 重い注文フローの間欠 120s ハング（retries で吸収中・trace 解析未着手） | 同上 |
| — | Firefox カートページナビゲーションタイムアウト（dev 環境のみ・skip 中） | 同上 |

## churn ホットスポット（直近200コミット）

コード側: `src/queries/coupon.ts`(11) / `src/lib/schemas.ts`(8) / `src/queries/user.ts`・`inventory.ts`・`src/lib/types.ts`(6) / `src/app/(store)/checkout/page.tsx`(6) / `prisma/schema.prisma`(5)。docs 側の高 churn（QA_HANDOFF 33 等）はドキュメント同期運用によるもので正常。

## Direction（将来機能）の根拠ソース

- `docs/unimplemented-screens-plan.md` — ただし**一部 stale**: seller/admin ダッシュボードトップ・profile settings/messages・track-order・support-forms・offers・compare・静的ページ群は 2026-06 に実装済み（QA_HANDOFF 参照）。
  **残り候補だったもの: `/dashboard/admin/orders`・`/dashboard/admin/coupons`・seller inventory**
  > **追記（後続ラウンドの確認結果と同期）**: この 3 画面は
  > [`findings-08-direction.md`](findings-08-direction.md) 起票時の再監査で
  > **3 画面とも実装済み**であることが確認された
  > （admin coupons は `src/app/dashboard/admin/coupons/` が存在し、
  > admin 専用 CRUD `getAllCoupons` / `upsertCouponAsAdmin` / `deleteCouponAsAdmin` /
  > `toggleCouponActive` が揃っている — [`findings-10-direction-operations-growth.md`](findings-10-direction-operations-growth.md) 参照）。
  > → **「残り候補」は現存しない**。`docs/unimplemented-screens-plan.md` は
  > **全体が stale** であり、**DX-02（stale doc 退役）の退役対象**として
  > plan 011 で扱う（[`findings-07-dx-docs.md`](findings-07-dx-docs.md) DX-02）。
  > 本行を「未実装画面の一覧」として参照しないこと。
- `specs/multi-vendor-ecommerce/08-open-questions.md` — 返金処理のダウンストリーム（restock + Stripe/PayPal refund）と運営側チケット閲覧/更新 UI が明示的な未実装領域
- `docs/architecture/saas-roadmap.md` — Phase 2: orgId+RLS / Phase 3: 課金 / Phase 5: 監視・ログ基盤（Sentry 等）
- `docs/design/` 配下の設計書群 / `docs/design/support-forms/` §4
- i18n 設計文書が既に存在（コミット `f058782` "docs: add i18n localization design documents"）

## サブエージェントに渡すディレクトリマップ

- `src/queries/` — server actions（認可・決済・在庫の中核。テスト co-located）
- `src/lib/` — db シングルトン / schemas(Zod) / auth-guards / shipping-utils / utils
- `src/app/(store)/` 顧客ページ / `src/app/dashboard/` admin+seller / `src/app/api/` API ルート+Webhook
- `src/components/` store / dashboard / shared / ui(shadcn) / `src/cart-store/`・`src/compare-store/`（Zustand）
- `src/middleware.ts` — Clerk ルート保護
- `prisma/` schema+migrations / `prisma/seed/`（CLI・console.log 許容）
- `tests/`（component/integration/e2e）・`src/config/`（テストインフラ）
- **スキップ**: `node_modules/`, `coverage/`, `playwright-report/`, `test-results/`, `docs/coverage-dashboard.html`（生成物）, `docs/architecture/data-model.drawio`（生成物）, `.next/`
