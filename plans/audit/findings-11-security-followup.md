# Findings 11 — Security follow-up（追加監査ラウンド・vetted）

> **監査対象 HEAD**: `78397dc`（branch: `dev`）。監査実施時点では Round 1 deep 監査
> （`f9752c0`, 2026-07-03）からソース未変更（差分は docs コミットのみ）だった。
> **⚠️ 本ラウンド以降にソースは変更されている**: 下記 NEW-1 / NEW-2 は
> プラン 023 / 024 として**実装済み**（索引表の Status を参照）。
> したがって **NEW-1〜3 の引用 file:line は採取時点（`78397dc`）に紐づき、現 HEAD とは一致しない**
> （[`VETTED_FINDINGS.md`](VETTED_FINDINGS.md) の「行番号は採取時点の HEAD に紐づく」規約）。
> 本ファイルは修正前の監査スナップショットとして読むこと。
> **Vet 日**: 2026-07-10 / **方法**: 各 finding の引用 file:line を本体が直接開いて確認。
> 防御的メンテナンスのフレーミング。exploit 文字列・手順は含めない。
>
> **目的**: ユーザー指示「現在見つかっているもの（SECURITY-01〜09）の他に脆弱性がないか再精査」。
> 既存 findings（[`findings-02-security.md`](findings-02-security.md) の SECURITY-01〜09）・
> [`VETTED_FINDINGS.md`](VETTED_FINDINGS.md) の clean 判定・deferred・rejected の**いずれにも無い新規のみ**を記載する。

---

## 本ラウンドで再検証し、健全（clean）と確認した領域

Round 1 の「Areas checked and found clean」に加え、本ラウンドで**直接コードを開いて**再確認した:

- **query 層の認可・IDOR 防御は網羅的に健全**:
  - `deleteProduct`（`product.ts:557-589`）: `requireSeller()` の後に `product.store.userId !== user.id` で所有権検証（`:573`）。
  - `upsertShippingAddress`（`user.ts:345-410`）: `findFirst({ where: { id, userId } })` で所有権確認後 upsert、`userId: user.id` を強制上書き（他ユーザーのアドレス上書き不可）。
  - `addToWishlist`（`user.ts:912-953`）/ `followStore`（`user.ts:29-100`）: いずれも `user.id` スコープ。
  - `updateStoreDefaultShippingDetails`（`store.ts:207`）/ `upsertShippingRate`（`store.ts:291`）/ `updateStoreLowStockThreshold`（`inventory.ts:146`）: `requireStoreOwner(storeUrl)` で店舗所有権を try/catch 外で検証。
  - `toggleCouponActive`（`coupon.ts:462`）/ `deleteStore`（`store.ts:615`, ADMIN）: 管理者ロール検証あり。
- **ダッシュボード layout の role 強制（多層防御）は健全**: `src/app/dashboard/admin/layout.tsx:21` と
  `src/app/dashboard/seller/layout.tsx:13` がともに `if (!user || user.privateMetadata.role !== "ADMIN"/"SELLER") redirect("/")`。
  middleware は認証のみ（`middleware.ts:6-13` の `protectedRoutes`）だが、layout 境界で role を強制しており query 層とあわせ三層防御。
- **Clerk webhook**（`app/api/webhooks/route.ts`）: Svix 署名検証（`:50-61`）+ upsert は冪等。SECURITY 再発なし。
- **SECURITY-01〜09 の再発なし**: 監査時点では既存 findings の対象コードは未修正だが未悪化。
  - **その後の変化（現 HEAD）**: plan 023 が `index-products/route.ts` を編集したため、
    SECURITY-05（`error.message` の 500 漏洩）は**依然未修正のまま行番号のみ移動**した
    （現 HEAD では `:134` / `:414`）。023 は pagination のみを対象とし、漏洩経路には触れていない。

---

## 新規 findings（vetted・leverage 順）

### [NEW-1] `index-products` GET のページネーションを境界化・正規化する（DoS / 堅牢性）

> **✅ 解消済み（plan 023）**: 現 HEAD の `src/app/api/index-products/route.ts:171-182` は
> `MAX_LIMIT = 50`（POST の `take: 50` と一致）・`MAX_PAGE = 10_000` を導入し、
> tech.md の「URL パラメータ正規化」規約どおり `Number.isFinite(raw) && raw >= 1` で
> クランプする。回帰テストは `src/app/api/index-products/route.test.ts`。
> 以下は**修正前**の監査所見。

- **Evidence**: `src/app/api/index-products/route.ts:170-172` —
  `const page = parseInt(url.searchParams.get("page") || "1");`
  `const limit = parseInt(url.searchParams.get("limit") || "20");`
  `const skip = (page - 1) * limit;`
  この `limit` が `:266`（FULLTEXT 経路）と `:385`（fallback 経路）の `take: limit` にそのまま渡り、**上限クランプが無い**。
  `page` にも `Number.isFinite`/範囲チェックが無い。
- **Impact**:
  - `?limit=99999999` → `take` が無制限 → 巨大な DB スキャン + 巨大 JSON レスポンス（リソース枯渇 / DoS）。
  - `?page=-1` → 負の `skip` → Prisma が例外 → 500。`:403` の `{ error: error.message }`（= SECURITY-05 の未修正経路）で
    内部エラー詳細が漏洩し得る（**SECURITY-05 と複合**）。
  - `?page=abc`/`?limit=abc` → `parseInt` が `NaN` → `skip=NaN`/`take=NaN` で不定動作。
- **対照**: 同ルートの **POST 版**は `take: 50`（`:71`）で上限あり、`search-products` GET は固定 `LIMIT 50`（`search-products/route.ts`）で健全。
  `getAllOrders` も `limit ≤100` で clean 判定済み（`VETTED_FINDINGS.md`）。**ギャップは `index-products` GET ハンドラ限定**。
- **規約違反**: `.claude/steering/tech.md` の「URL パラメータ正規化」ルール
  （`Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1`）が適用されていない。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **対応プラン**: [`../023-bound-and-validate-public-search-pagination.md`](../023-bound-and-validate-public-search-pagination.md)

### [NEW-2] `setUserCountryInCookies` の cookie 書き込みを検証する（書き込み側の非対称）

> **✅ 解消済み（plan 024）**: 現 HEAD の `src/app/api/setUserCountryInCookies/route.ts:23` は
> 書き込み前に `isCountry(userCountry)` で shape 検証し（読み取り側 `parseUserCountryCookie` と
> 対称）、`:51` で `path: "/"` を明示して middleware（`middleware.ts:32`）とスコープを揃える。
> 回帰テストは `src/app/api/setUserCountryInCookies/route.test.ts`。
> 以下は**修正前**の監査所見。

- **Evidence**: `src/app/api/setUserCountryInCookies/route.ts:7,16-20` —
  `const { userCountry } = body`（未検証）を
  `response.cookies.set('userCountry', JSON.stringify(userCountry), { httpOnly, secure, sameSite: 'lax' })` で書き込み。
  **shape 検証なし・サイズ上限なし・`path` 属性なし**。未認証エンドポイント。
- **Impact**: 読み取り側 `parseUserCountryCookie`（`src/lib/utils.ts`）が `isCountry` で全フィールド検証 →
  不正データは `DEFAULT_COUNTRY` にフォールバックするため **injection は封じ込め済み（低深刻度）**。ただし:
  - 任意サイズの JSON を cookie に格納可能 → 以後**毎リクエストで送出**される cookie を肥大化（bloat）。
  - `path` 未指定は middleware 自身の cookie set（`middleware.ts:32` で `path: "/"`）と**非対称**で、
    書き込み経路により cookie スコープがぶれる。
- **規約整合**: `.claude/steering/tech.md`「cookie パース」は読み取りで `parseUserCountryCookie` 必須と定める。
  書き込み側も `isCountry` で対称に検証するのが設計意図に沿う。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED
- **対応プラン**: [`../024-validate-usercountry-cookie-write.md`](../024-validate-usercountry-cookie-write.md)

### [NEW-3] 公開エンドポイントのレート制限 seam を設計する（多層防御 / DoS）— spike

> **✅ spike 完了（plan 025）**: 設計文書は [`../../docs/architecture/rate-limiting-spike.md`](../../docs/architecture/rate-limiting-spike.md)。
> spike の性質上、**レート制限の実装自体は未導入**（`ratelimit`/`upstash`/`throttle` は現 HEAD でも 0 件）。
> 導入可否はこの設計文書の推奨に基づくメンテナ判断。

- **Evidence**: `src` 全体で `ratelimit`/`upstash`/`throttle` の実装 **0 件**（grep 空）。
  未認証で重いクエリを実行する公開経路: `index-products`（POST/GET, `to_tsvector`/`plainto_tsquery`/`findMany`）・
  `search-products`（GET, `$queryRaw` 全文検索）・`setUserCountryInCookies`（POST）。
- **Impact**: 単一クライアントが認証なしで重い DB 負荷を反復駆動可能。**NEW-1 の無制限 `limit` と複合**すると増幅。
  個別バグではなく横断的な多層防御ギャップ。
- **判断事項**: `.claude/steering/product.md` の「スコープ外」表にレート制限の記載は無く、ADR も存在しない。
  導入可否・方式（in-memory / Upstash / Vercel WAF 等）はメンテナ判断を要するため、**実装ではなく設計 spike** とする。
- **Effort**: M / **Risk**: LOW-MED / **Confidence**: LOW-MED
- **対応プラン（spike）**: [`../025-spike-rate-limit-public-endpoints.md`](../025-spike-rate-limit-public-endpoints.md)

---

## 本ラウンドの索引（023〜025）

既存 [`../README.md`](../README.md) の実行順表（001〜022）は本ラウンドでは**編集していない**
（ユーザー指示: 新規ファイルのみ）。本ラウンドの成果物は以下:

| Plan | Title | Category | Priority | Effort | Risk | Depends on | Status |
|------|-------|----------|----------|--------|------|------------|--------|
| [023](../023-bound-and-validate-public-search-pagination.md) | Bound & validate `index-products` GET pagination | security | P2 | S | LOW | — | DONE |
| [024](../024-validate-usercountry-cookie-write.md) | Validate `userCountry` cookie write (symmetry) | security | P3 | S | LOW | — | DONE |
| [025](../025-spike-rate-limit-public-endpoints.md) | **Spike**: rate-limit seam for public endpoints | security | P3 | M | LOW-MED | — | DONE |

推奨順（当時）: **023 → 024**（いずれも独立・S・LOW）、**025 は spike**（設計文書 + 後続実装プラン提案で STOP）。

**現況**: 023 / 024 / 025 はいずれも完了済み。当初「023 は SECURITY-05（`index-products` の
`error.message` 漏洩）と同一ファイルを触るため、SECURITY-05 の将来プラン化時にマージ実行を検討」
としていたが、**023 は単独で完了したためこのマージ機会は消滅した**。SECURITY-05 は現 HEAD でも
未修正（`route.ts:134` / `:414`）であり、プラン化する場合は独立プランとなる。

## Considered / 除外（再監査防止）

- **SECURITY-05〜09（既存 investigate/deferred）**: 本ラウンドで再プラン化しない。NEW-1 が SECURITY-05 の 500 経路と
  複合する点のみ相互参照（上記）。
- **`getProducts(filters: any)`（`product.ts:601`）**: `any` 使用の規約違反だが Prisma 経由で SQL injection なし。
  セキュリティ finding ではなく tech-debt（型付け）扱い。本ラウンドのスコープ外。
- **middleware が `/api/*` を role 保護しない**: by-design。webhooks は署名検証、検索は公開、cookie 書き込みは低影響。finding ではない。
