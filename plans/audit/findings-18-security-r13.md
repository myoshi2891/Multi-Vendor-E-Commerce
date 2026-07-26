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
> - **本番到達・直接依存**: `next`（`<16.2.5` の HIGH クラスタ。fix floor は 16.2.5。
>   **監査 HEAD `7080b12` 時点では `16.2.1` に解決され、まだ脆弱**。SSRF/DoS/複数
>   middleware bypass はすべてこの範囲。対応は **plan 057**（lockfile の floor を
>   `~16.2.10` へ引き上げる）で、この HEAD では **未適用**）/
>   `dompurify`（`>=3.1.3 <3.2.7` の XSS 系。`src/utils/sanitize.ts` の sink 防御に直結 →
>   **SECURITY-11 で起票**）。
> - **本番到達・間接**: `qs`（stripe 経由・DoS moderate/low）/ `postcss`（ビルド時のみ）/
>   `uuid`（`src/**/*-details.tsx` で `v4()` を **React key 用途のみ**に使用 — 勧告は
>   `buf` 付き v3/v5/v6 の bounds 欠落であり **v4 no-buf は非該当** → 対応不要）。
> - **dev/CI のみ（本番非到達）**: `handlebars`（critical・**ts-jest 経由**）/ `ws` / `picomatch` /
>   `minimatch` / `tmp` / `undici`(testcontainers) /
>   `brace-expansion` / `flatted` / `js-yaml` / `glob` / `@babel/core` / `jodit`(seller エディタ、
>   ストアフロントは DOMPurify で閉鎖済み — DEPS-03) → **DEPS-05「dev-only は routine refresh に
>   畳む」の既定方針を維持**（本ラウンドでも個別プラン化しない）。
> - **runtime transitive・悪用経路は現状未到達**: `lodash` / `lodash-es`
>   （`react-color` / `react-tag-input` / `@tremor/react` が `dependencies` にあるため本番
>   ツリーへ到達する。`_.template` を攻撃者制御文字列で呼ぶ経路は無い）→ §4 **DEPS-06**
>   の分類訂正に従う。対応は DEPS-05 の routine refresh に含める。
>   **本行は recon §0 の「dev/CI のみ」分類を上書きする**（同一パッケージを 2 か所で
>   別ラベルにしないこと）。

#### 監査後の変化（この §0 の観測値には含めない）

上のベースラインは HEAD `7080b12`・2026-07-17 時点の観測であり、以後の対応で変化した
ものはここに分けて記録する（観測値の行に事後の結果を混ぜると、「監査時に何が見えていたか」
が読み取れなくなるため）。

| 項目 | 監査時点（`7080b12`） | その後 |
|---|---|---|
| `next` | `16.2.1` に解決・HIGH クラスタの影響下 | **2026-07-18: plan 057 実行で `~16.2.10` へ bump（DONE）** |

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

## 1. 監査サマリ（6 領域・並列 Explore A〜F の vet 結果）

| 領域 | サブエージェント | 結果 |
|---|---|---|
| A 認可・IDOR・RBAC | Explore A | 新規 **SECURITY-10**（getCoupon IDOR）+ deferred 2（AUTHZ 境界防御）。管理者 RBAC・seller ownership・buyer scope・権限昇格は **clean** |
| B 入力検証・注入・XSS | Explore B | raw SQL・XSS sink・cookie/URL は **clean**（sink は sanitize 済み）。新規 **SECURITY-15**（サーバー側 Zod 未検証・広域）。SECURITY-05 を再確認 |
| C 決済・ビジネスロジック | Explore C | 新規 **SECURITY-12/13**（PayPal capture 検証欠落）・**SECURITY-14**（upsertCoupon 割引上限未検証）・deferred 3（LOGIC-22/23・SECURITY-24）。Stripe 導出・placeOrder 金額精度・アトミック性は **clean** |
| D Webhook・SSRF | Explore D | 署名検証（Svix/Stripe/PayPal）・SSRF・remotePatterns は **clean**。deferred 3（SECURITY-16/17/18） |
| E ヘッダ・CSP・列挙 | Explore E | CORS・cookie 属性・列挙は **clean**。SECURITY-06 を payment surface 証拠で補強。新規 **SECURITY-19**（検索入力長上限） |
| F 依存・秘密・PII ログ | Explore F | CI SHA pin・秘密取り扱い・PII ログは **clean**。**DEPS-06**（台帳分類訂正のみ）。dompurify は SECURITY-11 に集約 |

> **全所見は本体が引用 file:line を直接開いて vet 済み**（サブエージェント報告のみを根拠にした所見はゼロ）。
> 却下・by-design・重複の排除は §4 に記録。

---

## 2. 新規 SECURITY 所見（leverage 順・vetted）

> フォーマットは playbook「## Finding format」準拠。**exploit 文字列・手順は書かない**（防御的フレーミング）。

### [SECURITY-10] `getCoupon` サーバーアクションに認可・所有権スコープを追加する（cross-store IDOR read）

- **Evidence**: `src/queries/coupon.ts:1`（`'use server'`）+ `coupon.ts:147-165` — `getCoupon(couponId)` は `db.coupon.findUnique({ where: { id: couponId } })` を **`requireStoreOwner`/`requireAdmin` なし**で実行。JSDoc は `@PermissionLevel Public` と誤記。呼び出し元はクライアントコンポーネント `dashboard/seller/stores/[storeUrl]/coupons/columns.tsx:158` と `dashboard/admin/coupons/columns.tsx:150`（＝サーバーアクションとして到達可能なエンドポイント）。同ファイルの兄弟（`getStoreCoupons:118`・`deleteCoupon:180`）はいずれも `requireStoreOwner` で防御済み。
- **Impact**: 任意の `couponId` を渡すと、他店舗・PLATFORM のクーポン行（`code`・`discount`・`storeId`・期間）が丸ごと返る cross-tenant IDOR read。漏れた割引コードは `applyCoupon` 経由で不正利用に繋がりうる。
- **Effort**: S
- **Risk**: LOW — 正規呼び出し元は既に owner/admin スコープ済みページ内で動くため、ガード追加で破綻しない。
- **Confidence**: HIGH — コードを直接読み、identity/ownership チェックの不在を確認。
- **Fix sketch**: seller 経路は `storeURL` 引数を追加して `requireStoreOwner(storeURL)` + `where: { id, storeId: store.id }` にスコープ。admin 経路は `requireAdmin()` 付きの別バリアントに分離。→ **plan 058**。

### [SECURITY-12] PayPal capture で金額・注文相関・通貨をサーバー検証する（Stripe パリティ欠落）

- **Evidence**: `src/queries/paypal.ts:186-283`（`capturePayPalPayment`）— クライアント供給の `paymentId` をそのまま capture し、`captureData.purchase_units[0].custom_id === orderId`・`amount.value === order.total`・`currency_code` の**いずれも検証せず** `paymentStatus:"Paid"` を確定（`paypal.ts:264-281`）。所有権チェック済みの `order`（`total` 込み）は `paypal.ts:159-164` で取得済みだが金額検証に未使用。対比: `src/queries/stripe.ts:189-216` は `metadata.orderId` 一致・`amount === expectedAmount`・`currency === "usd"`・active intent id 一致を全て検証。
- **Impact**: 所有権（userId スコープ）は通るため、同一ユーザーが安価な別注文向けに生成した PayPal オーダー id を高額注文の capture に流用でき、過少支払いで高額注文が Paid になりうる。注文額と受領額が乖離する。
- **Effort**: S
- **Risk**: LOW — 追加は拒否条件のみ。丸め比較は `order.total` を 2 桁正規化して行う。
- **Confidence**: HIGH — capture ブロックに相関・金額検証が存在しないことを確認。
- **Fix sketch**: capture 応答の `custom_id`／`amount.value`／`currency_code` を `order` 由来値と突合してから Paid を確定（Stripe 経路と同型）。→ **plan 059**（SECURITY-13 と同一プラン）。

### [SECURITY-13] PayPal capture に settled-status ガードを追加する（確定済み決済の退行防止）

- **Evidence**: `src/queries/paypal.ts:210-218` — capture 応答が非 COMPLETED のとき無条件で `paymentStatus:"Failed"` に更新。事前の確定状態チェックが無い。対比: `src/queries/stripe.ts:182-184` は `isSettledPaymentStatus(order.paymentStatus)` で確定済み注文を早期 throw。ヘルパー `SETTLED_PAYMENT_STATUSES`/`isSettledPaymentStatus` は `stripe.ts:63-71` に**module-private**で存在（PayPal から使うには export か共有ユーティリティ化が必要）。
- **Impact**: 既に Paid/Refunded 等で確定した注文に未完了/DENIED の capture を投げると確定状態が Failed に退行し、決済状態整合性が壊れる。SECURITY-12 と同根（paymentId と orderId の束縛欠落）。
- **Effort**: S
- **Risk**: LOW。
- **Confidence**: HIGH — ガード不在を確認。
- **Fix sketch**: `capturePayPalPayment` 冒頭で `order.paymentStatus` が確定済みなら早期 throw（Stripe 同型）。`isSettledPaymentStatus` を共有化して両経路で使う。→ **plan 059**。

### [SECURITY-14] `upsertCoupon`/`upsertCouponAsAdmin` にサーバー側 Zod 検証を必須化する（割引上限・mass assignment）

- **Evidence**: `src/queries/coupon.ts:81-89`（`upsertCoupon`）と `coupon.ts:397-398`（`upsertCouponAsAdmin`）— `db.coupon.upsert` に `...coupon`（クライアント供給 `Coupon` 全体）を展開。`storeId`/`scope` は上書きするが `discount`・`code`・`startDate`・`endDate`・`id` は未検証。フォーム契約 `CouponFormSchema`（`src/lib/schemas.ts:523,542-548`）は `discount` を `.min(1).max(99)` に制限するが、サーバーアクションからは呼ばれていない（`coupon.ts` に `parse(` 無し）。所有権検証（`existingById` の storeId 照合 `coupon.ts:51-61`）は済んでいるため、本件は**入力検証**の欠落に限定。
- **Impact**: SELLER がフォームを介さず直接アクションを呼べば **`discount > 99`**（DB 上 `Int` 無上限）を保存できる。ここから先は 2 段階で影響が変わるので分けて記す —— `applyCoupon`（`coupon.ts:294`）と `placeOrder`（`user.ts:679`）は `total.mul(discount).div(100)` で割引額を出すため、**`discount = 100` で割引額 = 商品総額（`total` が 0）**、**`discount > 100`（`Int` なので実質 101 以上）で割引額 > 商品総額 → グループ/注文 `total` が負値**になる。すなわち「フォーム契約（`.max(99)`）違反」の閾値と「`total` 負値化」の閾値は同じではない。いずれもフォーム契約とサーバー実装のドリフトである点は変わらない。
- **Effort**: S–M
- **Risk**: LOW–MED — 既存の不正値クーポンがあると更新時に弾かれうる。
- **Confidence**: HIGH — サーバー側検証の不在をコードで確認。負値 total 化は演算式から確実。
- **Fix sketch**: 各アクション冒頭で `CouponFormSchema`/`AdminCouponFormSchema` を `safeParse` し、DB 書込は検証済みフィールドの明示マッピングに置換（`src/queries/inventory.ts:99`・`support.ts:20` の既存 `safeParse` パターンに統一）。→ **plan 060**。

### [SECURITY-15]（広域）主要ミューテーションのサーバー側 Zod 検証欠落 — deferred

- **Evidence**: `src/queries/product.ts:71`（`upsertProduct`・`ProductFormSchema` 未使用）/ `review.ts:15`（`upsertReview`・`AddReviewSchema` 未使用）/ `user.ts:347`（`upsertShippingAddress`・`ShippingAddressSchema` 未使用）/ `category.ts:19`・`store.ts:68/334/460`。`grep` で `src/queries/` の `safeParse` 使用は inventory/message/order/support のみと確認。
- **Impact**: 認証/所有権は別途担保されるため影響はデータ品質・境界検証に限定（負価格・範囲外 rating・過大長テキスト等の永続化）。SECURITY-14 は本件の money-critical な部分集合。
- **Effort**: M（アクション横断）／**Risk**: MED（緩い既存 client データが弾かれうるため回帰確認要）／**Confidence**: HIGH。
- **Fix sketch**: plan 060 が確立するパターンを review/shipping-address/product へ横展開。→ **deferred**（§3）。

### [SECURITY-19] 公開検索エンドポイントに検索語の最大長を設ける（per-request コスト有界化）— deferred

- **Evidence**: `src/app/api/index-products/route.ts:16-25`（POST `query`）/ 同 `route.ts:153-` の **GET ハンドラ**（`q` — plan 023 が page/limit の境界を入れた経路）/ `src/app/api/search-products/route.ts:22-26`（GET `q`）の **3 経路**が、いずれも presence/type のみ検証し**文字列長上限なし**（下の Fix sketch の「3 経路」はこの 3 本を指す）。`setUserCountryInCookies/route.ts:4,28-31` は `MAX_FIELD_LEN=100` を強制しており粒度が非一貫。SQL 自体は `Prisma.sql` でパラメータ化済み（注入なし）。
- **Impact**: 認証不要の公開検索に巨大文字列を送ると 1 リクエストの全文検索コストを増幅可能。レート制限（NEW-3 / plan 025）は頻度、本件は単発コストを制御する直交防御。
- **Effort**: S／**Risk**: LOW／**Confidence**: MED（非検証は確実、DoS 増幅度は DB プラン依存）。
- **Fix sketch**: 3 経路の検索語に共通最大長を設け超過時 400。→ **deferred**（rate-limit spike 025 と併走が自然）。

### [SECURITY-16] Cloudinary の unsigned upload preset とアップロード制約の欠如 — deferred/investigate

- **Evidence**: `src/components/dashboard/shared/image-upload.tsx:92`（`CldUploadWidget uploadPreset="…"`・ハードコード）ほか `:144/:212`・`src/components/store/shared/upload-images.tsx:83`。サーバー署名エンドポイントや `maxFileSize`/`clientAllowedFormats` 制約がコード上に無い。
- **Impact**: preset が unsigned 構成なら第三者がアプリを介さず当該 Cloudinary アカウントへアップロード可能（ストレージ/帯域濫用）。
- **Effort**: M／**Risk**: MED（signed 化はアップロードフロー全体に影響）／**Confidence**: MED（**preset が signed/unsigned か・ダッシュボード側制約の有無はコードから確認不可**）。
- **Fix sketch**: サーバー署名 + widget を signed 化、最低でも preset に allowed_formats/max_file_size/folder を設定。→ **deferred/investigate**（Cloudinary ダッシュボード設定の確認が先行）。

### [SECURITY-17] Webhook のステータス更新が確定状態を無条件上書きする（out-of-order 退行）— deferred

- **Evidence**: `src/app/api/webhooks/stripe/route.ts:153-180` と `paypal/route.ts:241-268` — 署名検証済みイベントを `paymentDetails.upsert`+`order.update` する際、現在値に関係なくイベント値で `status`/`paymentStatus` を上書き。遷移ガードなし。
- **Impact**: 正当署名済みイベントが順不同/再配信で届くと確定状態（Refunded/Failed）が古い Paid に退行しうる。冪等性（plan 032）とは別軸（順序・状態遷移）。webhook は署名済み権威ソースのため実悪用余地はプロバイダのタイムスタンプ窓に制限。
- **Effort**: S–M／**Risk**: LOW／**Confidence**: MED。
- **Fix sketch**: 終端状態を古いイベントで上書き禁止する遷移ガード or イベント時刻の単調性担保。→ **deferred**（plan 059 が確立する settled-guard を webhook にも展開する形が自然・plan 032 と調整）。

### [SECURITY-18] Clerk/Svix 検証を raw body で行う（fail-closed 信頼性）— deferred

- **Evidence**: `src/app/api/webhooks/route.ts:40-41` — `const payload = await req.json()` の後 `JSON.stringify(payload)` を `wh.verify()` 入力に使用。Svix 署名は元 raw bytes に対し計算される。Stripe 経路（`stripe/route.ts:100`）は正しく `req.text()` を使用。
- **Impact**: 再シリアライズ結果が元 body と（空白/キー順/非 ASCII エスケープで）不一致なら**正当な** webhook が検証失敗し user 同期が欠落しうる。**署名バイパスではなく fail-closed**（厳格化方向）。
- **Effort**: S／**Risk**: LOW／**Confidence**: MED（実運用の顕在化頻度は Clerk のシリアライズ次第）。
- **Fix sketch**: `await req.text()` を検証入力にし、検証後に `JSON.parse`（Stripe 経路に統一）。→ **deferred**（reliability であり security exposure ではないが低コスト・クリーン）。

---

## 3. deferred（再評価条件つき）

| ID | 内容 | 現状の扱い / 昇格条件 |
|---|---|---|
| SECURITY-11 | `dompurify >=3.1.3 <3.2.7` の XSS advisory（`src/utils/sanitize.ts:2` 経由・本番 UI 到達） | sink（`product-description.tsx:22-23`）は sanitize 済みで即時 exploit 経路ではない。**依存 refresh で patched 版へ**（plan 057 の `next` bump と同じ依存メンテ枠。個別プラン化しない） |
| SECURITY-15 | 主要ミューテーションのサーバー側 Zod 検証欠落（広域） | plan 060 が coupon で確立するパターンを review/shipping-address/product へ横展開する follow-up |
| SECURITY-16 | Cloudinary unsigned upload | **investigate 先行**（preset の signed/unsigned・ダッシュボード制約はコード外）。unsigned 確定なら M プラン化 |
| SECURITY-17 | Webhook ステータス退行 | plan 059 の settled-guard 展開 + plan 032（冪等性統合テスト）と調整して起票 |
| SECURITY-18 | Svix raw-body 検証 | 低コスト・クリーン。次の webhook 系作業に同梱 |
| SECURITY-19 | 検索入力長上限 | rate-limit spike（plan 025）と併走が自然 |
| AUTHZ-02 | seller-store layout の `[storeUrl]` 所有権未検証（`layout.tsx:19-45`） | 多層防御ギャップ。クエリ層（`getStoreOrders`/`getStoreInventory`/`getStoreCoupons` は `requireStoreOwner`）が実データを守るため MED。`getAllStoreProducts`/`getStoreDefaultShippingDetails` は owner スコープでない点が昇格条件 |
| AUTHZ-03 | `getProductMainInfo`（`product.ts:478-506`）が caller チェックなしで product 内部を返す | データの大半は公開商品ページで既出のため LOW。境界一貫性のため記録 |
| LOGIC-22 | 送料計算の二系統分岐（`user.ts:548-566`・`coupon.ts:287-290` は Decimal 内製 / `shipping-utils.ts:13-42` は float・表示のみ） | tech-debt（tech.md「配送料計算の中央集約」規約と実装のドリフト）。security exposure ではないが規約違反。Decimal 版への統合プラン候補 |
| LOGIC-23 | `placeOrder` が在庫0サイズを quantity=0 行で受理し ITEM 送料が負値化（`user.ts:502,551-557,730-733`） | LOW（攻撃者利得小・注文データ汚染）。`validQuantity <= 0` を明示拒否する S プラン候補 |
| SECURITY-24 | クーポン利用回数制限が無く `CouponToUser` 関係が未使用（`schema.prisma:670-692`・`coupon.ts:262-265`） | **product 判断先行**（1人1回制限が仕様意図か要確認。dangling relation は強い意図シグナル）。仕様確定後 M プラン化 |

---

## 4. considered and rejected / by-design（再監査防止）

- **SECURITY-05 / SECURITY-06**: rejected ではなく **§0 で「未プラン化の現存所見」と判定 → 本ラウンドでプラン化**（plan 062 / plan 061）。重複ではない。
- **`src/components/ui/chart.tsx:81-98` の `dangerouslySetInnerHTML`**: 開発者定義 `ChartConfig`（テーマ/色）由来で外部入力経路なし。shadcn/ui 上流の標準実装。**by-design（finding にしない）**。
- **`src/queries/subCategory.ts:188-190` の `ORDER BY RANDOM() LIMIT ${limit}`**: `limit` は `number|null` 型でタグ付きテンプレート束縛・外部文字列連結なし。**注入なし（clean）**。
- **PayPal sandbox URL ハードコード**（`paypal.ts:189` ほか）: rejected 済み SECURITY-07 と同一。ホストは固定で SSRF ではない。**再報告しない**。
- **`applyCoupon` の `cart.total` ロストアップデート**: `specs/.../08-open-questions.md` Known Issues に既記録。**再報告しない**。
- **CORS / 認証系列挙 / セッション**: 自前 CORS ヘッダ・OPTIONS ハンドラ・自前ログイン/リセットエンドポイントは不在（Clerk 委譲）。**clean**。
- **CI SHA pin / 秘密取り扱い / PII ログ**: `.env`/`.env.docker` は git 追跡外・pin 規約（rule 01）充足・`console.error` は `error.message`/`stack` と ID のみで PII 非出力。**clean**。
- **DEPS-06（台帳訂正のみ・プラン化しない）**: recon §0 は lodash/lodash-es を「dev/CI のみ（本番非到達）」と分類したが、`react-color`/`react-tag-input`/`@tremor/react` は `package.json` の **`dependencies`（runtime）** であり、`lodash >=4.0.0 <=4.17.22` の high（`_.template` Code Injection）は 3 本の runtime transitive パスで本番ツリーに到達する（`src/` に直接 import・`_.template` 呼び出しは無し）。ただしコンシューマ側が `_.template` を攻撃者制御文字列で呼ばないため**実悪用到達性は低い**。**DEPS-05 の routine refresh 対象に lodash/lodash-es を含め、台帳ラベルを「runtime transitive・悪用経路は現状未到達」に訂正**する（個別プラン不要）。

---

## 5. プラン化サマリ（自動選定・leverage 順・水増しなし）

| プラン | 所見 | Priority | Effort | 根拠 |
|---|---|---|---|---|
| **058** | SECURITY-10（getCoupon IDOR） | P1 | S | cross-tenant 情報漏洩・HIGH・クリーンな fix |
| **059** | SECURITY-12 + SECURITY-13（PayPal capture 検証 + settled guard） | P1 | S | 過少支払い→Paid の決済整合性・HIGH・Stripe パリティ |
| **060** | SECURITY-14（upsertCoupon サーバー側 Zod） | P1 | S–M | discount>99 → 注文 total 負値化・HIGH |
| **061** | SECURITY-06（セキュリティレスポンスヘッダ） | P2 | M | payment surface の clickjacking/CSP 防御・設定変更中心 |
| **062** | SECURITY-05（生 error.message 500 漏洩 + `error:any` 撤去） | P2 | S | データ最小化・クリーンなレスポンス整形 |

> **選定方針**: HIGH confidence × 高レバレッジ × クリーンな検証ストーリーを優先し 5 本に限定。残り 11 件は §3 で理由付き deferred。
> **着手順**: 058 / 059 / 060 は独立（相互依存なし）。061 / 062 も独立。059 は `isSettledPaymentStatus` の共有化を伴うため stripe.ts に軽微に触れる（詳細は plan 059）。
