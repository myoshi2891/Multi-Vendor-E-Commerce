# Quality Attributes

## Security
- `/dashboard`, `/checkout`, and `/profile` are protected at the resource level (layout / page / Server Action auth checks); `src/proxy.ts` (`clerkMiddleware`) only establishes auth context and does not path-match routes.
- Server actions validate authentication via `currentUser`.
- Webhook requests are verified with Svix signatures; handlers use the
  SDK-verified `evt.data` object instead of re-parsing the raw body.
- Cookies for country detection are `httpOnly` and `sameSite`.
- Secrets are read from environment variables only.
- CSRF protection: Server Actions rely on Next.js 16's built-in Origin/Host
  validation combined with Clerk's `SameSite=Lax` session cookies. No explicit
  CSRF token implementation is introduced. Rationale and alternatives:
  [`docs/architecture/decisions/001-csrf-policy.md`](../../docs/architecture/decisions/001-csrf-policy.md).
- IDOR prevention: mutations that touch user-owned resources (reviews, stores,
  orders) verify ownership before writing. Review operations use conditional
  `update`/`create` instead of `upsert` to prevent client-supplied IDs from
  overwriting other users' records.
- Supply chain hardening (CI): All third-party GitHub Actions and container
  service images are pinned to immutable digests (full commit SHA or
  `sha256:` digest) with a trailing `# <version>` comment. Checkout steps set
  `persist-credentials: false`, and the workflow declares `permissions: contents: read`
  by default. See `.github/workflows/ci.yml` and the CI / Supply Chain rule in
  `.claude/rules/01-engineering-standards.md`.

## Data Integrity
- Prisma relations enforce ownership and cascade deletes where appropriate.
- CartItem and OrderItem store snapshot fields (price, name, image, size).
- Server actions validate resource ownership before mutation to prevent
  cross-user data corruption via client-supplied identifiers.
- Store status updates (`updateStoreStatus`) use Prisma interactive
  transactions (`db.$transaction`) to atomically update store status and
  promote user role on PENDING → ACTIVE transition.
- Order placement (`placeOrder`) wraps all DB writes (order, order groups,
  order items, total update) in a single `db.$transaction` for atomicity.
  Read-only queries (delivery details) are pre-fetched before the
  transaction to minimize lock duration.
- A user has **at most one** `ShippingAddress` with `default = true`. Checkout
  auto-selects the delivery address with `addresses.find((a) => a.default)` and the
  source query is unordered, so a second default makes that selection depend on
  physical row order. `upsertShippingAddress` clears the other defaults and writes
  the address in one `db.$transaction` — atomicity is required, not merely
  desirable, because the clear must not survive a rejected write (an id belonging
  to another user fails the create with P2002 *after* the clear would have run).
  The invariant is additionally enforced in the database by the partial unique index
  `ShippingAddress("userId") WHERE "default"`, which also covers writes that bypass
  the server action.
- All money fields use `Decimal(12,2)` for exact arithmetic. Internal
  calculations use `Prisma.Decimal` methods; conversion to `number` happens
  only at presentation boundaries.

## Performance
- PostgreSQL fulltext search (tsvector/tsquery) on the weighted `Product.searchVector` column (GIN); no `contains` fallback since plan 075.
- Pagination in search endpoints limits result size.
- Client-side cart interactions avoid roundtrips.
- Shipping fee calculations are centralized in `src/lib/shipping-utils.ts`
  (`computeShippingTotal`) to ensure consistent precision across all
  components. Floating-point errors are mitigated using
  `Math.round((result + Number.EPSILON) * 100) / 100` to guarantee 2-decimal
  precision for all monetary values.
- Lighthouse CI (`.lighthouserc.json`) による、主要画面（例: 商品一覧 `/browse`）のパフォーマンス予算（LCP, CLS, TBT 等）の自動計測と継続的監視（CI上の実行結果は一時パブリックストレージへアップロード）。

## Reliability
- Payment details are upserted and linked to orders.
- Stripe PaymentIntent creation passes a deterministic `idempotencyKey` derived
  from the order id **and** the amount (`src/queries/stripe.ts`). Without a key,
  every double-click or network retry mints a new intent and overwrites the
  recorded "active" intent id, locking out a user already paying on the earlier
  one. The amount is part of the key because Stripe rejects a reused key sent
  with different parameters — keying on the order alone would permanently block
  payment after a legitimate total change (e.g. a coupon).
- Payment status transitions are compare-and-set, not read-then-act.
  `createStripePayment` updates `PaymentDetails` and `Order` inside a single
  `db.$transaction` with `paymentStatus: { notIn: SETTLED_PAYMENT_STATUSES }`
  in the `where` clause. The Stripe webhook (`src/app/api/webhooks/stripe/`)
  writes the same row through an independent path, so a plain guard-then-write
  would let a late server action regress a settled `Paid` order back to
  `Pending`. A CAS miss surfaces as **P2025, which in that case is a designed
  outcome, not a fault**: the row exists but no longer matches the `notIn`
  predicate.
- **P2025 must not be normalized unconditionally.** The code is not specific to a
  CAS miss — a concurrent delete of the order, or a `paymentDetails.connect`
  whose target disappeared, raises the same P2025 from inside the same
  transaction. Mapping every P2025 to "already settled" would report a genuine
  failure as a completed payment. `createStripePayment` therefore **re-reads the
  order and normalizes only when the row is actually settled**; otherwise the
  original error propagates. If the re-read itself fails the outcome is
  undecidable, so it is logged and the original P2025 is rethrown rather than
  swallowed. A normalized P2025 is **not retried** — retrying cannot change the
  answer, because the order is settled and will stay settled.
- **P2034 is a separate event from the CAS P2025 above.** Transactions declared
  `isolationLevel: Serializable` are retried on P2034 via
  `retryOnSerializationFailure` (`src/lib/db-retry.ts`). P2034 means the database
  refused to serialize two concurrent transactions and asks the caller to *redo*
  the work; the outcome is undetermined, so a retry can succeed. Serializable
  only converts a conflict into this retryable form — it does not eliminate the
  conflict — so declaring it without a retry just turns a would-be lost update
  into a failed request, and the legitimate concurrent caller still gets an error.
  The two codes must not be conflated when reading logs or writing handlers:
  P2025 from a CAS `where` is a **terminal, expected** signal; P2034 is a
  **transient, retryable** one.
- Work that follows an irreversible side effect is best-effort. After
  `placeOrder` succeeds, both the local (`emptyCart`) and server-side
  (`emptyUserCart`) cart cleanups are individually guarded so a failure cannot
  block navigation to the order — the persisted Zustand store means even the
  synchronous call can throw on a storage failure.
- User records are upserted via webhook using immutable Clerk user ID as
  lookup key, ensuring correct matching even after email changes.
- User deletion via webhook uses `deleteMany` for idempotent retry handling
  (avoids Prisma P2025 on re-delivery).
- External service calls (Prisma, Clerk API) in webhook and store handlers
  are wrapped in try/catch with appropriate HTTP status codes or error
  re-throwing.

## Observability & Code Quality
- Errors are logged to the console; no centralized logging is in place yet.
- Catch blocks use `error: unknown` (never `any`) with `instanceof Error`
  type guards for structured logging (`console.error` with context prefix,
  message, and stack).
- All server actions in `src/queries/` must wrap external calls in try/catch
  and use structured log format: `[Module:Function] Error message` with
  `{ error: message, stack: error.stack }` for consistent error tracking and
  debugging.
- 静的解析プラットフォームとして **SonarQube / SonarCloud** を採用し、継続的なコード品質（バグ・スメル・脆弱性・テストカバレッジ）の可視化および監視を行います。
  - **CI (SaaS)**: PR 毎に SonarCloud にて自動解析を実行します。品質ゲート (Quality Gate) は導入初期段階では非ブロッキング（`continue-on-error`）で運用します。
  - **ローカル (Docker)**: `docker-compose.sonar.yml` および Makefile (`make sonar-up/scan/down`) を使用し、ローカル環境でも CI と同等の静的解析を再現・事前確認できます（詳細は [`docs/architecture/decisions/005-sonarqube-static-analysis.md`](../../docs/architecture/decisions/005-sonarqube-static-analysis.md) を参照）。

## Comparison presentation

- The comparison page scopes brand colors to its CSS Module, preserving semantic state colors and existing price calculations elsewhere.
- At 1440px, 390px and the 700px boundary, horizontal overflow is confined to a named, keyboard-focusable comparison region. Links/buttons expose visible focus; reduced motion disables skeleton animation.
- Loading/error/unavailable feedback uses status/alert semantics. Main-scoped axe checks cover WCAG 2 AA in the comparison E2E; shared header/footer and other routes remain outside this migration's scope.

### Priority seven UI quality

Scoped seller light/dark themes and explicit Portal styles preserve other consumers. Verify 1440/768/390px, keyboard focus and return focus, local table scrolling, pending/error/retry/success and reduced motion. WCAG AA axe checks keep color contrast enabled. Supplemental component adapters do not verify authenticated routes or third-party SDK internals; unavailable dedicated test DB/Clerk environments require implementation-present hold status with explicit release conditions. [Evidence](../../docs/design/design-system/PROGRESS.md#優先7画面移行記録).

## Seller six-screen presentation quality

Use scoped light/dark themes and explicit portal inheritance, serif headings, readable wrapping and visible keyboard focus. Verify 1440/768/390px with axe WCAG AA including contrast; fixture adapters do not prove authenticated route or SDK rendering.

Seller gallery removal is keyboard accessible with meaningful image/button names. Seller data-table scroll regions remain keyboard accessible when filtering returns no rows. The shared shipping fields retain the caller's validation and numeric units. [Six-screen evidence](../../docs/design/design-system/PROGRESS.md#優先6画面移行記録).

## P3優先6画面のデザイン移行（2026-10-05）

P3対象ではscoped themeとPortal scopeでlight/darkを統一、390/768/1440pxとWCAG AA axe（contrast除外なし）を補助fixtureで検証する。実Sidebar/Header・フォーカス・native操作・表スクロール・旧P4 toolbarの回帰を含む。Clerk UIと認証後実ルートの受け入れはfixture証跡から分離する。

詳細は[計画](../../plans/layout-design/priority-six-p3-design-system-plan.md)と[検証正本](../../docs/testing/QA_HANDOFF.md#ds-p3-six-browser)を参照。

## P4管理マスタ6画面のデザイン移行（2026-10-06）

6画面は1440/768/390px × light/dark、長文/横溢れ/検索/空/validation/pending/error/retry/success、Portal、focus/Enter/Escape/復帰、axe WCAG AA（contrast含む）を検証する。第三者SDKと認証後実ルートは補助fixtureと区別して保留理由/解除条件を記録する。旧フォーム/列の全scopeを移行済みとしない。

[証跡と受け入れ保留](../../docs/design/design-system/PROGRESS.md#p4優先6画面移行記録)。

### P2残存6画面の品質条件（2026-10-09）

1440/768/390pxと対象境界幅で、ページ全体の横溢れなし、キーボードfocus、44pxページング、axe AA（contrast除外なし）を補助ブラウザーで検証する。ClerkのPortalは独立themeを持ち、埋め込み領域と同様にreduced-motionでanimation/transitionを抑制する。fixtureと認証後実ルート/実SDKの受け入れを分ける。[未完了条件](../../docs/testing/QA_HANDOFF.md#ds-p2-residual-browser)。

### 監査指摘の操作領域（2026-10-09）

公開3画面の指摘操作と属性3画面の独立操作は44×44px以上。checkboxはラベル込みで判定する。共有SDKのinline focus resetはeditorial share tileに限定して補正する。属性テーマはroot/form/独立Portalに明示適用し、light/dark・AAコントラスト・focus復帰・局所table scrollを検証する。認証後実ルートと補助fixtureの証跡を区別する。


### 購入後P2 6画面の品質条件（2026-10-10）

1440/768/390pxで横溢れなし、長い氏名/ID/本文の折り返し、44px操作領域、keyboard/focus、axe AA（contrast含む）を確認する。独立住所Portalは自身にthemeを持ち、失敗後の入力保持・pending操作ロック・focus復帰を維持。画面と読み込み表示のトークン追従をcomputed styleで検証し、認証後実ルートとfixture証跡は分ける。[計画](../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md)。


## 販売者優先8画面の残存表示（2026-10-10）

1440/768/390px×light/dark、ナビ767px、メッセージ1000pxを確認する。KPIはsidebarを除いた利用可能幅に応じて列数を変え、大きな金額・長文を折り返す。seller touch/ringへの追従、44px操作、局所table scroll、keyboard/focus、axe A/AA（contrast含む）、reduced-motionを検証する。第三者SDK・認証後実ルートとfixtureの証跡を分ける。

[計画](../../plans/layout-design/priority-eight-seller-residual-design-system-plan.md)／[証跡](../../docs/design/design-system/PROGRESS.md#販売者優先8画面残存移行記録)。


## 購入優先8画面の品質条件（2026-10-11）

1440/768/390pxでfocus・44px操作・長文/空/在庫切れ/pending/error/retry/success・独立住所Portal・局所scroll・axe AA（contrast除外なし）を検証する。computed focus/border contrastは実面に対して3:1以上とする。helperが扱わない画像/gradient/透明合成は画像目視とaxeで補完。暗い面のinvoice失敗はalertと意味色を併用し、削除後のfocusは消えない要素へ戻す。

既存Chromeを使う任意channelで補助fixtureを確認し、実Next/認証後/外部SDKの受け入れを分ける。新環境・DB初期化・顧客作成・実購入/送信なし。[QAの解除条件](../../docs/testing/QA_HANDOFF.md#ds-purchase-eight-browser)。
