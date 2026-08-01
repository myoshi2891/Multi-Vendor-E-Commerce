# Findings 14 — Integration 次点候補の深掘り監査（Round 6 / vetted）

> **Round 6**（2026-07-11 / 監査対象 HEAD `4ec6b5b` / branch `dev` — R5 監査 HEAD `1750ef2` から
> ソース `src/ tests/ prisma/` は無変更を diff で確認済み）。
> `tests` フォーカス・**Integration（testcontainers 実 PostgreSQL）限定**の第 2 弾。
> **方法**: Round 5（findings-13）が「`$transaction` / raw SQL / webhook 全サイト」を精査済みのため、
> 本ラウンドは (A) R5 の deferred/次点候補の再評価 + (B) R5 未スイープの新規切り口
> （非原子 multi-write / unique・FK カスケードの実セマンティクス / admin・seller 経路の upsert 群 /
> 複雑 where ビルダー）を直接読解でスイープ →
> **全所見を本体が直接コード・migration SQL を開いて vet 済み**（サブエージェント不使用）。

## ベースライン実測（2026-07-11 / Round 6 冒頭）

| 指標 | 値 |
|---|---|
| Integration（testcontainers） | **17 passed / 17 total / 2 スイート — 全 pass**（exit 0） |
| 実行時間 | **4.008 s**（コンテナ起動 + TRUNCATE リセット込み。teardown 正常） |
| 実行コマンド | `bun run test:integration` |
| 前回統計との差分 | なし（R5 実測 17/17・4.779s と同一構成。ソース無変更のため当然の一致） |

## スコープ定義

- **対象**: `tests/integration/`（testcontainers 実 PostgreSQL、ADR-004）のみ。
- **対象外**: `prisma/seed/__tests__/`（別 tier）・E2E・unit/component（Round 4 監査済み）。
- **重複回避**: plan 027 / 031〜035（TODO）とシナリオ・対象分岐が重ならないことを所見ごとに確認。
  本ラウンドの 4 所見はすべて **R5 プランが触れていない server action / 経路**が対象
  （036: deleteProduct、037: upsertShippingAddress、038: updateProduct 編集経路、039: getProducts）。

---

## 新規所見（Round 6・すべて直接 vet 済み）

### [TESTS-20] `deleteProduct` の FK Restrict / カスケード削除の実セマンティクスが未検証 — レビュー付き商品は削除不能（P2003）

- **Evidence**: `src/queries/product.ts:557-589` — `deleteProduct` は所有権検証後に
  `db.product.delete({ where: { id: productId } })` の**ハード削除**を実行する。
- **Evidence**: `prisma/migrations/20260222101357_init_postgresql/migration.sql:694` —
  `Review.productId → Product` は **`ON DELETE RESTRICT`**（schema.prisma:369 に `onDelete` 指定なし
  = Prisma 必須リレーションのデフォルト）。一方 ProductVariant（schema:186）→ Size/Image/Color
  （:210/:224/:237）、Spec（:262）、Question（:280）、FreeShipping（:330）、Wishlist（:648）は
  **`ON DELETE CASCADE`**。
- **Evidence**: `src/queries/product.test.ts` の deleteProduct テストは `db.product.delete` を
  モックしており、FK 違反（P2003）もカスケードも実行されない。`tests/integration/` に削除系の
  テストはゼロ。
- **Impact**: **レビューが 1 件でも付いた商品はセラーが削除できず、ダッシュボードで未処理の
  P2003 が 500 として露出する**（catch は re-throw のみ）。逆にレビューなし商品の削除では
  variants/sizes/images/colors/specs/questions/freeShipping/wishlist が連鎖消滅する — この
  「何が消え、何が削除を阻止するか」の境界はモック unit では原理的に検証不能。
  なお `deleteStore`（`src/queries/store.ts:615-644`）は**ソフト削除**（isDeleted フラグ）のため
  `Product.storeId` / `OrderGroup.storeId` の RESTRICT（migration.sql:643/:727）とは衝突しない
  （by-design として記録、テスト対象は deleteProduct 側のみ）。
- **Effort**: S–M（seedProductWithVariantAndSize + Review 1 行の追加 seed で完結） /
  **Risk**: LOW / **Confidence**: HIGH（migration SQL レベルで確証済み）
- **Fix sketch**: `tests/integration/product-deletion.test.ts` を新設。①レビューなし商品の削除で
  子テーブル（Size/ProductVariantImage/Color/Spec/Question/Wishlist）が実際に連鎖消滅、
  ②レビュー付き商品の削除が P2003 で失敗し**商品・子テーブルとも無傷**（S5「副作用なし」
  パターン）、③非所有商品の削除拒否 + 副作用なし、を実 DB で固定する。→ **plan 036**

### [TESTS-21] `upsertShippingAddress` の default フラグ不変条件（1 ユーザー 1 default）が実 DB 未検証 — 新規作成経路は他住所の default を解除しない

- **Evidence**: `src/queries/user.ts:345-411` — `address.default === true` のとき、
  `:358-362` で **`findUnique({ where: { id: address.id } })` が既存行を返した場合のみ**
  他住所の `default: false` 一括更新（`:365-373`）を実行する。**新規住所（addressDB = null）を
  default 付きで作成する経路では解除処理がスキップされ、既存 default と併存する**。
  さらに解除 updateMany と upsert 本体（`:386-400`）は `$transaction` 外の非原子 2 書き込み。
- **Evidence**: `src/components/store/shared/shipping-addresses/address.list.tsx:21` —
  checkout の住所自動選択は `addresses.find((address) => address.default)` で**最初の default を
  採用**する。default が複数あると選択が並び順依存になる。
- **Evidence**: `src/queries/user.test.ts` に upsertShippingAddress の unit テストはあるが全モック。
  「更新経路で他住所の default が実際に落ちる」「新規経路で落ちない」という実 DB の行状態は
  どのテストでも観測されていない。
- **Impact**: default 二重化は **checkout の配送先自動選択を非決定にする**（意図しない住所への
  配送リスク — money/trust 隣接）。現挙動の characterization を実 DB で固定すれば、
  将来の修正（新規経路への解除追加・$transaction 化）の回帰網になる。
- **Effort**: S（`seedShippingAddress` ヘルパーが seed.ts:398 に既存） / **Risk**: LOW /
  **Confidence**: HIGH
- **正しい不変条件（テストの期待値と混同しないこと）**: **「1 ユーザーにつき
  `default: true` は最大 1 件」**。②で固定する `count === 2` は**この不変条件を
  満たしていない現在のバグ挙動**であり、あるべき値ではない。
- **Fix sketch**: `tests/integration/shipping-address-default.test.ts` を新設。①既存住所を
  default に更新 → 他住所の default が実 DB で false に落ちる、②新規住所を default 付きで
  作成 → **既存 default が残存し 2 行になる**（**既知バグの characterization**。
  テストコードに `TODO(characterization): 既知バグ TESTS-21。修正時にこの期待値を 1 に
  反転する` という**機械検索可能なタグ**と、正しい不変条件（1 ユーザー = default 最大 1 件）を
  必須で明記する。タグが無いと後任が `=== 2` を**満たすべき契約**と誤読し、
  バグ修正時に「テストが壊れた」として修正側を差し戻す）、③他ユーザーの住所 id を指定した上書きが所有権検証で
  新規 create に落ちる（IDOR 防御の実挙動）、を検証。→ **plan 037**
- > **remediation（バグ本体の修正）の追跡先 — 2026-07-19 時点で「未起票」**:
  > plan 037 は **characterization（現挙動の固定）のみ**を担当し、`default: true` の
  > 重複を解消する**コード修正プランは存在しない**。`TODO(characterization)` タグは
  > テストコード側に反転指示を残すだけで、**修正そのものを誰かのキューに載せない**ため、
  > 台帳側にも追跡先を明記しておく必要がある。
  > - **修正対象**: `upsertShippingAddress`（`src/queries/user.ts`）— 新規 create 経路で
  >   既存 default を落とす処理が無い。更新経路（`:` 既存 default を false に落とす）とは非対称。
  > - **起票の条件**: 単独の correctness プラン化。plan 037 が緑になった時点で
  >   「期待値 2 → 1 への反転」とセットで実施すると差分が機械的に見える。
  > - **依存**: plan 037 完了が先行（テストが無い状態で修正すると回帰検知器が無い）。
  > - **同型の未起票 remediation**: 下記 TESTS-23 ⑥ の fail-open（存在しない category URL で
  >   全件返却。store / offer の URL 解決にも同型）も characterization のみで修正プランは未起票。

### [TESTS-22] `updateProduct`（handleProductAndVariantUpdate）の削除+再作成 tx と slug 一意性・SetNull 副作用が実 DB 未検証 — R5 次点候補の昇格

- **Evidence**: `src/queries/product.ts:297-469` — 商品+バリアント更新は
  `db.$transaction`（`:327`）内で specs/questions/freeShipping/images/colors/**sizes** を
  **deleteMany → createMany の全置換**で更新する。`Size.id` は再作成のたびに変わる。
- **Evidence**: `src/queries/product.ts:28-55` — `generateUniqueSlug` は findFirst ループで
  `base`, `base-1`, `base-2`… と suffix を採番（最大 100 回で throw）。名前変更時のみ再生成
  （`:302-313`）。unique 制約（Product.slug / ProductVariant.slug）との整合は実 DB でしか
  検証できない。
- **Evidence**: `prisma/migrations/20260222101357_init_postgresql/migration.sql:745` —
  `Wishlist.sizeId → Size` は **`ON DELETE SET NULL`**。つまり **sizes の全置換のたびに、
  そのバリアントを size 指定でウィッシュリスト登録した全行の sizeId が NULL 化**する。
  `CartItem.productId/variantId/sizeId`（schema.prisma:414-416）は **FK なしの平文字列**のため
  カート行は**古い sizeId を保持したまま残存**する（checkout 時の再検証で弾かれる経路）。
- **Evidence**: `src/queries/product.test.ts` は upsertProduct 系をモックで分岐検証するのみ。
  tx の原子性・slug suffix の実採番・SetNull 連鎖はどのテストでも実行されない。
- **Impact**: セラーの商品編集は日常操作であり、①tx が途中で失敗した場合に子テーブルが
  半置換で残らないこと、②名前変更時の slug 衝突が suffix で解決されること、③size 再作成が
  Wishlist に及ぼす SetNull 連鎖、はいずれも実 DB でしか観測できない。findings-13 が
  「次点候補」として README Deferred に記録済み — 本ラウンドで昇格。
- **Effort**: M（既存 seed ヘルパー + Wishlist 1 行の追加 seed。ProductWithVariantType の
  入力組み立てが必要） / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/product-update.test.ts` を新設。①specs/questions/sizes の
  全置換が正確に反映（旧行消滅・新行のみ残存）、②名前変更で slug 再生成 + 既存 slug と
  衝突時に `-1` suffix、③名前不変なら slug 不変、④sizes 置換で Wishlist.sizeId が NULL 化・
  CartItem.sizeId は残存、⑤tx **後段**での失敗で全子テーブルが変更前のまま（原子性）、を検証。
  → **plan 038**

  > **⑤の失敗注入について（訂正 2026-07-17 — plan 038 と統一）**: 当初の本文は
  > 「不正 `categoryId` 等の FK 違反」としていたが、[plan 038](../038-integration-test-product-update-tx.md)
  > （`:213-231`）がこれを**明示的に否決**している。`categoryId` 注入は tx の**最初の操作**
  > `product.update` で失敗するため、Spec / Question / Size の置換が**そもそも実行されず**、
  > 「実行したが巻き戻った」と「最初から実行していない」を区別できない
  > — tx が無くてもテストが green になり、**原子性の証拠にならない**。
  > 正しくは **Size 全置換より後段**へ失敗を注入する。038 の採用手段は plan 035 と同型の
  > **テスト内 DDL による一時 CHECK 制約**で、tx 最終操作である variant 分の Spec create のみを
  > 決定論的に落とす。**注入手段の詳細は plan 038 を正とする**（本ファイルでは再掲しない）。

### [TESTS-23] `getProducts`（browse 主経路）のフィルタ合成・ソート・ページングが実 DB 未検証

- **Evidence**: `src/queries/product.ts:601-794` — `whereClause.AND` に store/category/
  subCategory/size/offer/search/price/color の 8 フィルタを動的合成。ネスト
  `variants.some.sizes.some` / `colors.some`、`mode: "insensitive"` 検索、
  `Promise.all` の findMany + count、`orderBy`（views/createdAt/rating）、
  さらに **`lte: filters.maxPrice || Infinity`（`:732`）を Decimal カラムに渡す** minPrice 単独
  指定経路がある。
- **Evidence**: 存在しない store/category/subCategory/offer URL はフィルタが**黙って脱落**し
  （`:626-628` 等の `if (store)` ガード）、**全商品が返る**（絞り込み失敗として空になる
  のではない）。この挙動は unit（`product.test.ts` — db 全モック）では固定されていない。
- **Impact**: browse ページは検索（plan 033 の tsvector）と並ぶ**商品発見の主経路**。
  ネスト some 句・insensitive 検索・Decimal 境界（`Infinity`）は Prisma のクエリエンジンが
  実際に SQL 化して初めて挙動が確定する領域で、**Prisma 5→6 メジャーアップグレード
  （DEPS-04 spike 予定）の回帰網**として直接的な価値を持つ。
- **Effort**: M（属性の異なる商品群の seed が必要 — 既存 `seedProductWithVariantAndSize` の
  引数で価格/サイズ/色を変えて複数投入） / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `tests/integration/product-browse.test.ts` を新設。①category/subCategory
  フィルタの絞り込み、②size / color のネスト some、③minPrice/maxPrice 境界
  （**`Infinity` 経路の扱いは下記の注記に従う** — エラーになる場合は STOP して所見報告）、④insensitive
  検索（name/description/variantName）、⑤ページング（totalCount / totalPages / skip）、
  ⑥存在しない category URL でフィルタ脱落 → 全件返却（**fail-open の characterization**。
  あるべき挙動は空結果 or 404 なので、`TODO(characterization)` タグ +「空結果へ修正する
  場合は totalCount === 0 に反転」を明記する。同じ fail-open は store / offer の URL 解決
  にもあり、修正時はまとめて反転する）、を検証。
  → **plan 039**
- **`Infinity` 経路（③）の扱い — characterization で固定してはならない**:
  > 他の項目（⑥の fail-open 等）と違い、**`lte: Infinity` を Decimal カラムへ渡すのは
  > 「安定したバグ挙動」ではなく Prisma の未定義領域**であり、
  > **バージョン間で挙動が変わりうる**。ここを「現挙動」として期待値に焼き付けると、
  > **本 finding が価値の根拠に挙げている Prisma 5→6 アップグレードの回帰網**という
  > 目的と正面から衝突する（アップグレードで挙動が変わったとき、テストが
  > 「仕様変更を検出した」のか「テストが古い前提を守っている」のかを区別できず、
  > 最悪 characterization を守るために正しい修正を差し戻す）。
  >
  > **正しい方針**: `Infinity` を渡すこと自体を**修正対象**として扱う。
  > `lte` 条件を**値がある時だけ付ける**形に変える:
  > ```typescript
  > // 現状（product.ts:732 付近）: maxPrice が無いと Infinity が Decimal フィルタへ渡る
  > price: { gte: filters.minPrice || 0, lte: filters.maxPrice || Infinity }
  >
  > // 修正: 値がある時だけ条件を付ける（キー自体を生やさない）
  > price: {
  >     gte: filters.minPrice ?? 0,
  >     ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
  > }
  > ```
  >
  > **明示的な `undefined` を渡す形（`lte: filters.maxPrice ?? undefined`）に依存しないこと**。
  > 「`undefined` は Prisma が条件ごと無視する」は**無条件の前提ではない**:
  > 現行の `prisma@5.22.0`（`schema.prisma:3` の `previewFeatures = ["fullTextSearch"]` のみ）
  > では確かに無視されるが、これは `strictUndefinedChecks` を有効化していないことに依存する。
  > 同機能は明示的な `undefined` をエラーにする方向の preview であり、
  > **Prisma 5→6 の major 移行（`plans/README.md` の DEPS-04 — 意図的に保留中）で
  > 前提が変わりうる**。上記のようにキー自体を条件付きで生やせば、この前提に依存しない。
  >
  > テストは**修正後の挙動**（minPrice 単独指定で上限なしの絞り込みが正しく効く）を
  > 検証する。これなら Prisma のバージョンが変わっても期待値は不変であり、
  > 回帰網として機能し続ける。
  >
  > ただし plan 039 は「`src/queries/product.ts` は変更しない」という制約
  > （テストのみのプラン）で書かれているため、**修正はコード修正プランの領分**。
  > 039 の実行中に `Infinity` 経路が throw した場合は STOP して所見報告し、
  > **期待値の合わせ込みはしない**（characterization として固定しないこと）。

---

## Round 5 deferred/次点の再裁定（A 軸）

| 項目 | Round 6 時点の現状（直接確認） | 裁定 |
|---|---|---|
| `updateProduct` specs/questions tx + `generateUniqueSlug`（R5 次点候補） | `product.ts:297-469` 再読。SetNull 連鎖（Wishlist.sizeId）の新事実を追加確認 | **TESTS-22 に昇格 → plan 038** |
| `saveUserCart` 統合（R5 rejected） | ~~plan 005 が依然 TODO。非原子構造は不変~~ → **plan 005 は DONE**（`../README.md:68`） | **deferred 維持**（ただし「005 待ち」という理由は消滅済み。昇格の再評価が可能） |
| TESTS-02 capture 経路（R1 raw / R5 deferred） | ~~plan 003 が依然 TODO。`stripe.ts`/`paypal.ts` の非原子 2 書き込みは不変~~ → **plan 003 は DONE**（`../README.md:66`）。**残課題は PayPal 側のみ**: `stripe.ts` は tx + CAS で解消済み、`paypal.ts` の 2 書き込みはトップレベルの別呼び出しのまま（実測 2026-07-26・下の注記参照） | **deferred 維持**（ただし理由が変わった —— 「003 待ち」ではなく「PayPal 側の原子性シナリオが未設計」。下の注記を参照して経路ごとに再評価すること） |

> **⚠️ 上表の「Round 6 時点の現状」列は 2026-07-11 のスナップショットであり、
> 先行依存としている plan 003 / 005 は現在いずれも DONE**
> （[`../README.md`](../README.md) の Status 表が実行実態の SSOT）。
> したがって**下 2 行**（`saveUserCart`＝plan 005 待ち / TESTS-02 capture 経路＝plan 003 待ち）の
> deferred 理由（「コード修正が先行依存だから待つ」）は**既に消滅**しており、
> 両者とも**昇格の再評価が可能な状態**にある。**この表を根拠に「まだ待ち」と判断しないこと** —
> 再評価の起点は [`VETTED_FINDINGS.md`](VETTED_FINDINGS.md) の「Round 14 追記」節。
>
> **⚠️ ただし CAS ガードの追加を「非原子性の解消」と読まないこと。** Round 14（2026-07-19）で
> capture 経路へ CAS ガードが入った（`4261be0` / `e63474b`）が、これは**別の性質の対策**である:
>
> | | CAS ガード（条件付き `updateMany` + `where` 再評価） | tx 原子性（`db.$transaction`） |
> |---|---|---|
> | 防ぐもの | **ロストアップデート** — read-then-act の隙に別経路が書いた値を上書きする退行 | **部分適用** — 2 書き込みの片方だけが永続化される状態 |
> | 防げないもの | 1 書き込み目の成功後に 2 書き込み目が失敗した場合の不整合 | 並行更新による上書き（分離レベル次第） |
>
> **2 経路で状況が異なる（実測 2026-07-26）**:
>
> - **Stripe**: `src/queries/stripe.ts:231-258` は `paymentDetails.upsert` と `order.update` が
>   **同一 `tx` 内**にあり、かつ `where` に `paymentStatus: { notIn: SETTLED_PAYMENT_STATUSES }`
>   の CAS を持つ。原子性・ロストアップデートとも解消済み。
> - **PayPal**: `src/queries/paypal.ts:281`（`db.paymentDetails.upsert`）と `:323`
>   （`db.order.update`）は**トップレベルの別呼び出しのまま**で、`$transaction` に入っていない。
>   CAS ガード（`:22` の `SETTLED_PAYMENT_STATUS_GUARD`）は付いたが、**非原子 2 書き込みは残存**。
>
> したがって「非原子 2 書き込みは不変」が当てはまらなくなったのは **Stripe 側だけ**であり、
> **PayPal 側では plan 003 の課題がそのまま残っている**。正しい要約は「TESTS-02 は**解消済み**」
> ではなく「**検証すべきシナリオが経路ごとに変わった**」—— Stripe は CAS + tx の回帰網、
> PayPal は CAS の回帰網に加えて原子性シナリオ（片側書き込みの巻き戻し）が依然必要。
> 昇格時は経路ごとに区別して設計に含めること。

## Considered and rejected（Round 6・再監査防止）

- **`followStore` トグル**（`src/queries/user.ts:29-92`）: findFirst → connect/disconnect の
  非原子トグルだが、implicit M2M join テーブル（`_StoreFollowers`）は (A,B) unique を持ち
  二重 connect は Prisma レベルで冪等。競合時の実害は「トグル結果が 1 回分ずれる」に留まり、
  unit（`user.test.ts:129-`）で分岐網羅済み。実 DB の増分検証価値が薄い — 低レバレッジ。
- **`addToWishlist` の重複ガード**（`src/queries/user.ts:912-952`）: `Wishlist` に複合 unique
  制約が**存在しない**（schema.prisma:641-661 は index のみ）ため、実 DB で検証できる制約
  セマンティクスがそもそもない。findFirst 事前チェックは unit で網羅済み。競合時の重複行は
  表示上の問題に留まる。unique 制約の追加はスキーマ変更（コード修正系）であり本ラウンドの
  範囲外 — 低レバレッジ。
- **dashboard taxonomy/coupon upsert 群**（category/subCategory/offer-tag/coupon）:
  `upsertCoupon`（`coupon.ts:32-106`）は事前 findFirst + **P2002 フォールバック**（`:94-100`）の
  二重防御が実装済みで、unit がエラー分岐を網羅。category 系 upsert も同型。admin/seller
  経路で money-path でなく、036〜039 より増分価値が低い — 次点候補として README Deferred に
  記録（P2002 実発火の統合検証は将来ラウンドの候補）。
- **`applyCoupon` の total ロストアップデート**: CAS（`coupon.ts:300-310` の
  `couponId: null` 条件付き updateMany）は integration 済み（cart-checkout S3 二重適用）。
  残る「Step 3 の cart 読取と Step 7 の書込の間に cartItems が変化すると total がずれる」は
  **コード修正（$transaction 化）が先行する correctness 事案**で、README Deferred の既存記録を
  維持。テストだけ先行しても修正時に書き直しになる（saveUserCart と同じ理由）。

## 監査しなかったもの

- E2E / unit / component の網羅性（Round 4 監査済み。本ラウンドは Integration 限定）。
- 外部サービス実環境（Stripe/PayPal/Clerk/Cloudinary）。
- `prisma/seed/__tests__/`（スコープ定義のとおり対象外）。
- `getStoreOrders` 等ダッシュボード一覧系の実 DB ページング（B7 の残余 — getProducts より
  閲覧頻度・リスクが低く、水増し回避のためプラン化見送り。将来ラウンドの候補として記録）。
