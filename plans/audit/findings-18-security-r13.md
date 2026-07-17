# Findings 18 — Security（Round 13 deep 監査・vetted）

> **監査対象 HEAD**: `7080b12`（branch: `dev` — Round 12 triage クローズ）。
> **バリアント**: `security` フォーカス・effort = **deep**（並列 Explore サブエージェント ≤8）。
> **Vet 日**: 2026-07-17 / **方法**: 各 finding の引用 file:line を本体が直接開いて確認。
> 防御的メンテナンスのフレーミング。**exploit 文字列・手順は含めない**（findings-11 前例）。
>
> **目的**: Amazon 級の世界トップクラス EC サイトを目標水準として、認可/IDOR・
> インジェクション/XSS・決済/ビジネスロジック悪用・Webhook/SSRF・ヘッダ/CSP/レート制限・
> 依存/サプライチェーン/PII の 6 領域を deep 監査し、新規所見（SECURITY-10〜）を起票する。
> 既存 findings（findings-02 の SECURITY-01〜09 / findings-11 の NEW-1〜3）・
> VETTED_FINDINGS の rejected・決定済みトレードオフ（ADR-001 CSRF 等）の**いずれにも無い
> 新規のみ**、および**既存所見の実装状態 reconcile**を記載する。

---

## 0. Recon ベースライン（2026-07-17 / HEAD `7080b12`）

### 静的解析・依存監査の実測

| 項目 | 実測値 |
|---|---|
| `bunx tsc --noEmit` | **0 エラー** |
| `bun run lint` | **0 エラー**（warnings のみ） |
| `bun audit` | **90 件**（critical 1 / high 30 / moderate 45 / low 14） |

> **`bun audit` 90 件の内訳（本番到達性で分類）**:
> - **本番到達・直接依存**: `next`（`<16.2.5` の HIGH クラスタ — **plan 057 が 16.2.5 bump で
>   包括対応済み** の TODO。SSRF/DoS/複数 middleware bypass はすべてこの範囲）/
>   `dompurify`（`>=3.1.3 <3.2.7` の XSS 系。`src/utils/sanitize.ts` の sink 防御に直結 →
>   **SECURITY-11 で起票**）。
> - **本番到達・間接**: `qs`（stripe 経由・DoS moderate/low）/ `postcss`（ビルド時のみ）/
>   `uuid`（`src/**/*-details.tsx` で `v4()` を **React key 用途のみ**に使用 — 勧告は
>   `buf` 付き v3/v5/v6 の bounds 欠落であり **v4 no-buf は非該当** → 対応不要）。
> - **dev/CI のみ（本番非到達）**: `handlebars`（critical・**ts-jest 経由**）/ `ws` / `picomatch` /
>   `minimatch` / `lodash`(react-color/testcontainers 等) / `tmp` / `undici`(testcontainers) /
>   `brace-expansion` / `flatted` / `js-yaml` / `glob` / `@babel/core` / `jodit`(seller エディタ、
>   ストアフロントは DOMPurify で閉鎖済み — DEPS-03) → **DEPS-05「dev-only は routine refresh に
>   畳む」の既定方針を維持**（本ラウンドでも個別プラン化しない）。

### 既存セキュリティ所見の実装状態 reconcile（現 HEAD で直接確認）

| 所見 | 対応プラン | 現 HEAD の実装状態 | README Status | 判定 |
|---|---|---|---|---|
| SECURITY-01（updateOrderItemStatus IDOR） | 001 | `order.ts:257-260` が `updateMany({ where: { id, orderGroup: { storeId } } })` にスコープ済み | DONE | 整合 |
| SECURITY-02（Store mass-assignment） | 002 | `store.ts:17-19` に allowlist コメント + create 経路 `:179-180`/`:513-514` が `featured:false`/`status:PENDING` 強制 | DONE | 整合 |
| SECURITY-03（Stripe server-side 導出） | 003 | `stripe.ts:187` が `paymentIntents.retrieve(paymentIntentId)` で再取得し `:228` で導出 | DONE | 整合 |
| SECURITY-04（住所所有権 in placeOrder） | 003 | `user.ts:447` が `shippingAddress.findFirst({ where: { id, userId } })` → `:624` で `ownedAddress.id` を使用 | DONE | 整合 |
| NEW-1（index-products ページング境界） | 023 | `index-products/route.ts:171-182` が `MAX_LIMIT=50`/`MAX_PAGE=10_000`/`Number.isFinite` クランプ実装済み | **TODO** | **ドリフト → README を DONE に修正** |
| NEW-2（userCountry cookie 書込検証） | 024 | `setUserCountryInCookies/route.ts:23` が `isCountry()` 検証 + `:51` `path:"/"` | **TODO** | **ドリフト → README を DONE に修正** |

> **README Status ドリフト**: plans **023 / 024 は実装済みなのに Status 表が TODO のまま**
> （findings-11 冒頭注記の「実装済み」記述とも一致）。Round 13 の README 更新（Step 6）で
> 両者を DONE に補正する。plans 001〜006 は README・実装ともに DONE で整合。

### 本ラウンドで再確認し「未対応で現存」と判定した既存所見（新規ではないが reconcile 上重要）

| 既存所見 | 現 HEAD の状態 | 本ラウンドでの扱い |
|---|---|---|
| **SECURITY-05**（index-products の生 `error.message` 500 漏洩） | `index-products/route.ts:134` / `:414` に `{ error: error.message }, { status: 500 }` が**現存**。plan 023 は pagination のみ触れ漏洩経路は未修正（findings-11 で予告済み） | **SECURITY-05 として未プラン化のまま現存 → Round 13 でプラン化候補に昇格**（後述） |
| **SECURITY-06**（セキュリティレスポンスヘッダ不在） | `next.config.mjs` は `images.remotePatterns` のみで **`headers()` ブロック無し**。`src/middleware.ts` もヘッダ付与なし。Round 1 で fix sketch はあったが**プラン化されず未対応** | **SECURITY-06 として未プラン化のまま現存 → Round 13 でプラン化候補に昇格**（後述） |

> **注**: SECURITY-05 / 06 は Round 1 の raw findings に存在するが、Round 1 で
> プラン化されたセキュリティは 001〜004 のみで、05/06 は **fix sketch 止まりでプラン未発行**の
> まま現在に至る。Round 13 は「新規発見」に加え、この**未プラン化の既存 HIGH/MED 所見を
> Sonnet 実行可能プランに落とす**ことも成果とする（improve スキル Phase 4 の「未計画の
> 高レバレッジ所見を計画に落とす」に合致）。

### 監査が「再報告しない」もの（サブエージェントにも周知）

- **修正済み（回帰なし）**: SECURITY-01/02/03/04・NEW-1/NEW-2、および SECURITY_GAP_REPORT の
  既修正（PayPal/Stripe userId スコープ・upsertCoupon 所有権・applyCoupon CAS・review IDOR）。
- **rejected（VETTED_FINDINGS）**: SECURITY-07（PayPal sandbox — 意図確認要 LOW）/
  SECURITY-08（旧 query の raw error 補間 — Next.js server-action マスキングで緩和 LOW）/
  SECURITY-09（upsertReview 購入検証なし — 1 アカ 1 レビューで限定 LOW）/ DEPS-05（dev-only 勧告）。
- **決定済みトレードオフ**: ADR-001 CSRF トークンモジュール新設禁止 / `reactStrictMode:false` /
  Elasticsearch コメントアウト / DB ページ `force-dynamic` / `middleware`→`proxy`・AVIF 警告 /
  product.md スコープ外（多通貨・税・高度分析・配送キャリア連携）。

---

<!-- 以下、Step 4 で監査結果（clean 再確認 / SECURITY-10〜 / deferred / rejected）を追記する -->
