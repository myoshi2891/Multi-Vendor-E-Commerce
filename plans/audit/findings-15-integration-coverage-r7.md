# Findings 15 — Integration 残余領域の監査（Round 7 / vetted）

> **Round 7**（2026-07-11 / 監査対象 HEAD `9111f41` / branch `dev` — R6 監査 HEAD `4ec6b5b` から
> ソース `src/ tests/ prisma/` は無変更を R6 クローズ時の diff で確認済み）。
> `tests` フォーカス・**Integration（testcontainers 実 PostgreSQL）限定**の第 3 弾。
> **方法**: R5（$transaction / raw SQL / webhook 決済サイト）・R6（FK カスケード / default 不変条件 /
> 全置換 tx / browse フィルタ）が精査済みのため、本ラウンドは (A) R6 の次点候補の再評価
> （dashboard taxonomy/coupon upsert 群・一覧系ページング）+ (B) 未スイープの新規切り口
> （Clerk user-sync webhook の FK 連鎖 / Store 複合 unique 群 / profile 読み取り / dashboard 集計 /
> upsertShippingRate）を直接読解でスイープ →
> **全所見を本体が直接コード・migration SQL を開いて vet 済み**（サブエージェント不使用）。

## ベースライン実測（2026-07-11 / Round 7 冒頭）

| 指標 | 値 |
|---|---|
| Integration（testcontainers） | **17 passed / 17 total / 2 スイート — 全 pass**（exit 0） |
| 実行時間 | **4.473 s**（コンテナ起動 + TRUNCATE リセット込み。teardown 正常） |
| 実行コマンド | `bun run test:integration` |
| 前回統計との差分 | なし（R5: 4.779s / R6: 4.008s と同一構成。ソース無変更のため当然の一致） |

## スコープ定義

- **対象**: `tests/integration/`（testcontainers 実 PostgreSQL、ADR-004）のみ。
- **対象外**: `prisma/seed/__tests__/`（別 tier）・E2E・unit/component（Round 4 監査済み）。
- **重複回避**: plans 027 / 031〜039（全 TODO）とシナリオ・対象分岐が重ならないことを所見ごとに確認。
  本ラウンドの 2 所見は R5/R6 プランが触れていないサイトが対象
  （040: Clerk user-sync webhook `src/app/api/webhooks/route.ts` — plan 032 は Stripe/PayPal 決済
  webhook で別 route、041: `coupon.ts` の P2002 経路 — plan 027 は placeOrder の PLATFORM 端数、
  cart-checkout S3 は applyCoupon の CAS で、いずれも upsert 系 P2002 に触れない）。

---

## 新規所見（Round 7・すべて直接 vet 済み）

### [TESTS-24] Clerk webhook `user.deleted` の `db.user.deleteMany` — RESTRICT / CASCADE / SET NULL 混在の FK 連鎖が実 DB 未検証。注文・レビュー・住所・店舗持ちユーザーは削除不能（P2003 → 500 → Svix 無限リトライ + PII 残存）

- **Evidence**: `src/app/api/webhooks/route.ts:114-126` — `user.deleted` イベントで
  `db.user.deleteMany({ where: { id: userId } })` の**ハード削除**を実行。catch は 500 を返すのみ
  （Svix はリトライを継続する）。
- **Evidence**: `prisma/migrations/20260222101357_init_postgresql/migration.sql` — User への FK は
  3 種のセマンティクスが混在:
  - **RESTRICT**（削除を阻止）: `Store.userId`（:640）/ `Review.userId`（:691）/
    `ShippingAddress.userId`（:712）/ `Order.userId`(:721)
  - **CASCADE**（連鎖消滅）: `Cart.userId`（:700）/ `Wishlist.userId`（:736）/
    `PaymentDetails.userId`（:754）/ `_UserFollowingStore`（:760）/ `_CouponToUser`（:766）、
    後続 migration で `Conversation.userId` / `Message.senderId`
    （`20260619115547_add_conversation_message/migration.sql:45,57`）
  - **SET NULL**: `SupportTicket.userId`（`20260622061307_add_support_ticket/migration.sql:34`）
- **Evidence**: `src/app/api/webhooks/route.test.ts:326-390` の user.deleted テストは
  `db.user.deleteMany` をモック（:5-13）しており、P2003 も連鎖消滅も実行されない。
  `tests/integration/` に user 削除系のテストはゼロ。
- **Impact**: **注文・レビュー・住所・店舗のいずれか 1 件でも持つユーザーが Clerk 上で
  アカウント削除すると、DB 側の削除は P2003 で永続的に失敗し、webhook は 500 を返し続けて
  Svix が無限リトライする。ユーザーの PII（name/email/picture）は DB に残存し続ける**
  （GDPR 等の削除要求と直接衝突するコンプライアンス隣接事案）。一方 Cart/Wishlist/
  PaymentDetails/Conversation/Message/フォロー/クーポン割当は黙って連鎖消滅し、
  SupportTicket は匿名化（userId=NULL）される — 「何が削除を阻止し、何が消え、何が残るか」の
  3 値境界はモック unit では原理的に検証不能。なお `deleteMany` のため対象ユーザー不在時は
  count:0 で正常終了（冪等）— この冪等性も実 DB で固定する価値がある。
- **Effort**: S–M（`seedUser` / `seedStore` / `seedShippingAddress` / `seedCart` +
  Order/Review/Wishlist の直接 create で完結。seed.ts 変更不要） / **Risk**: LOW /
  **Confidence**: HIGH（migration SQL レベルで確証済み）
- **Fix sketch**: `tests/integration/user-deletion-webhook.test.ts` を新設。route の POST を
  unit テスト（route.test.ts:26-39 の svix / next/headers モック）と同じ境界モックで呼び、
  `@/lib/db` は**モックしない**（plan 032 と同じ方式 — globalSetup が DATABASE_URL を
  testcontainers に書き換え済み）。①Cart/Wishlist のみのユーザー → 200 + User と子行が連鎖消滅、
  ②Order 持ちユーザー → 500 + User・Order とも無傷（S5 副作用なしパターン。現挙動の
  characterization — 将来の「削除前に匿名化 or ソフト削除」修正の回帰網）、③Review 持ち /
  ShippingAddress 持ちも同様に 500、④存在しない userId → 200（deleteMany の冪等性）、
  ⑤SupportTicket 持ち（Order なし）→ 200 + ticket.userId が NULL 化、を実 DB で固定する。
  → **plan 040**

### [TESTS-25] `Coupon.code` はグローバル unique だが `upsertCoupon` の事前チェックは自店舗スコープのみ — 他店舗/PLATFORM とのコード衝突は**決定論的に** P2002 フォールバックへ到達（実 DB 未検証）

- **Evidence**: `prisma/schema.prisma:672` — `Coupon.code String @unique`（**グローバル一意**。
  storeId との複合ではない）。
- **Evidence**: `src/queries/coupon.ts:64-76` — seller 経路 `upsertCoupon` の事前重複チェックは
  `AND: [{ code }, { storeId: store.id }, { NOT: { id } }]` で**自店舗内のみ**検索する。
  つまり**他店舗または PLATFORM クーポンが同じ code を既に使っている場合、事前チェックを
  素通りして upsert（:80-88）が実 DB の unique 制約に衝突**し、P2002 フォールバック（:94-100）が
  日本語メッセージ「このクーポンコードは既に使用されています」に変換する。
  これは**競合（race）ではなく決定論的に到達可能な本経路**である。
- **Evidence**: `src/queries/coupon.ts:379-419` — admin 経路 `upsertCouponAsAdmin` は事前チェック
  なしで upsert し、P2002 を同じメッセージへ変換する（:402-408）。
- **Evidence**: unit テストは P2002 を**モックの reject で注入**しており
  （`coupon.test.ts:135-140` / `:1198-1205`）、実 DB の unique 制約が本当に発火するか・
  発火時に**既存行が無傷か・新規行が作られていないか**はどのテストでも観測されていない。
- **Impact**: クーポンコードはセラーが自由入力する日常運用値であり、店舗間のコード衝突は
  通常運用で発生する（例: 両店舗が "SUMMER10" を作る）。この時のエラー UX は P2002
  フォールバックだけが担っており、その実挙動（メッセージ変換 + 副作用なし）が未固定。
  また「code はグローバル一意」というスキーマ設計自体が事前チェックのスコープと不整合
  （事前チェックは店舗内一意を意図した書き方）— 実 DB characterization はこの設計ギャップの
  将来修正（複合 unique 化 or 事前チェックのグローバル化）の回帰網になる。
- **Effort**: S（`seedStore` × 2 + `seedCoupon`（seed.ts:245）で完結。seed.ts 変更不要） /
  **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/coupon-code-uniqueness.test.ts` を新設。
  ①同一店舗内の重複 code → 事前チェック（findFirst）の日本語メッセージで拒否 + 行数不変、
  ②**他店舗の既存 code と衝突する create → P2002 フォールバックの同一メッセージ + 既存
  クーポン無傷・新規行なし**（本丸 — 実 unique 制約の発火）、③PLATFORM クーポン
  （storeId=null）の code と衝突する seller create → 同様に P2002 経路、④自クーポンの
  update で code 据え置き → NOT:{id} 除外により成功、⑤admin 経路 `upsertCouponAsAdmin` で
  既存 code と衝突 → P2002 変換 + 副作用なし、を実 DB で固定する。→ **plan 041**

---

## Round 6 次点候補・deferred の再裁定（A 軸）

| 項目 | Round 7 時点の現状（直接確認） | 裁定 |
|---|---|---|
| dashboard taxonomy/coupon upsert 群の P2002 実発火（R6 次点） | coupon.ts 再読で**事前チェックのスコープ不一致**（自店舗限定 vs グローバル unique）を新発見 — R6 の「P2002 は競合時のフォールバック」という前提が崩れ、決定論的到達経路が存在する | **coupon のみ TESTS-25 に昇格 → plan 041**。category/subCategory/offerTag は rejected へ（下記） |
| `getStoreOrders` 等ダッシュボード一覧系の実 DB ページング（B7 残余） | `store.ts:361-404` 再読。無制限 findMany のまま — **plan 009 が take/orderBy の bound を追加予定**で、テストを先に書くと 009 実行時に書き直しになる（saveUserCart と同じ構造） | **deferred へ変更**（009 完了後の追加候補として記録。R6 の「低レバレッジ」裁定に先行依存の理由を追加） |
| `saveUserCart` 統合（R5/R6 deferred） | plan 005 が依然 TODO。非原子構造は不変 | **deferred 維持** |
| TESTS-02 capture 経路（R1 raw / R5/R6 deferred） | plan 003 が依然 TODO | **deferred 維持**（003 完了後に plan 032 へ同型シナリオ追加が低コスト、の裁定を維持） |
| applyCoupon total ロストアップデート（R6 deferred） | コード修正（$transaction 化）先行の correctness 事案のまま | **deferred 維持** |

## Considered and rejected（Round 7・再監査防止）

- **category/subCategory/offerTag upsert 群**（`category.ts:19-70` 等）: 事前チェック
  （findFirst の name/url OR 検索）が**グローバルスコープ**で unique 制約（`Category.url` 等）と
  整合しており、coupon（TESTS-25）のようなスコープ不一致がない。P2002 到達は真の競合（race）
  限定で決定論的に再現不能。P2002 フォールバック自体も未実装（raw エラーが伝播）だが、
  それはテストではなくコード修正（フォールバック追加）が先行する事案 — 低レバレッジ。
- **`applySeller` / `upsertStore` の一意性検証**（`store.ts:20-156` / `:416-478`）: 事前チェックは
  name/url/email/phone の 4 値 OR だが、**DB unique は url・email のみ**（schema.prisma:87,89。
  name/phone はアプリ層のみの強制）。この不一致は実 DB で「characterization」可能だが、
  事前チェックを通る経路では到達不能（P2002 は race 限定）で、事前チェック分岐自体は
  unit（`store.test.ts`）が網羅済み。さらに **plan 002（mass-assignment allowlist）が
  upsertStore の update 経路を変更予定**で、先行テストは書き直しリスクがある — 低レバレッジ +
  先行依存。002 完了後の再評価候補として記録。
- **profile 読み取り群**（`getUserOrders` `profile.ts:32-180` / `getUserPayments` 等）:
  status/period フィルタ + ネスト some 検索 + ページングは **plan 039（getProducts）と同じ
  Prisma クエリセマンティクス族**で、039 が回帰網（Prisma 6 アップグレード対応）を先に張る。
  userId スコープ（:60）は where 構造として unit 検証済みで、実 DB の増分価値は 039 と重複が
  大きい — 水増し回避のため見送り。039 完了後、必要なら同型パターンの横展開として低コストで
  追加できる（その旨を plan 039 の maintenance が参照する構造は不要と判断）。
- **dashboard 集計系**（`getAdminDashboardStats` `dashboard.ts:30-94` / `getSalesOverTime`）:
  revenue の Decimal `_sum` は money-path だが、集計自体は単純な `aggregate` + `count` +
  `groupBy` で分岐がなく、**`unstable_cache` ラッパー（:37-94）が Jest/jsdom 環境で
  Next.js ランタイム外の挙動になる**という試験環境リスクが増分価値を上回る。
  getSalesOverTime のバケット集計は JS 側ロジックで unit 対応可能 — 低レバレッジ。
- **`upsertShippingRate`**（`store.ts:291-350`）: `@@unique([storeId, countryId])`
  （schema.prisma:322 / migration `20260314235842`）を **upsert の where に直接使う正しい
  イディオム**で、事前チェック・P2002 フォールバックとも不要な構造。検証すべきギャップがない。
- **`getStorePageDetails` / `getRecentOrders` / `getRecentStores` / `trackOrder`**: 単純な
  findFirst/findMany + take で、動的 where 合成も集計もない。unit + component 層で網羅済み —
  低レバレッジ。

## 監査しなかったもの

- E2E / unit / component の網羅性（Round 4 監査済み。本ラウンドは Integration 限定）。
- 外部サービス実環境（Stripe/PayPal/Clerk/Cloudinary）。Clerk webhook（TESTS-24）も
  Svix 署名検証は境界モックで、検証対象は DB セマンティクスのみ。
- `prisma/seed/__tests__/`（スコープ定義のとおり対象外）。
- R5/R6 プラン（027 / 031〜039）が既にカバー予定の分岐（重複回避のとおり）。
