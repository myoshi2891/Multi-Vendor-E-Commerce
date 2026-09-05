# QA & Test Implementation Handoff（次回セッションへの引き継ぎ）

> **最終更新**: 2026-09-04 / **HEAD**: `b55f2cf4`（**CodeRabbit レビュー指摘の対応（第 2 巡）**`f506eb7c`〜`b55f2cf4`: design.md の店舗スコープ例を実装どおり `nodeProducts` へ修正、Phase A 本番手順に Step 6.5〔最終リコンサイル〕を追加（書き込みゲート案は本書の目的と矛盾するため不採用）、footer のカテゴリ取得失敗時のグレースフルデグレード、ERD パーサのコメント誤検出、E2E teardown の握り潰し解消。**移行済みマイグレーションの ON CONFLICT 変更と、`handleProductAndVariantUpdate` のリーフ検証を常時化する指摘は不採用**（前者は適用済みマイグレーション改変の禁止、後者は Phase B の経過措置として意図的に素通ししている）。以下は fa554bae 時点の記録: **CodeRabbit レビュー指摘の対応**`905082b8`〜`fa554bae`: 親候補の深さ判定にサブツリー高さを含める実バグ修正、`getProducts` の `whereClause: any` 撤廃（`subtreeOf` の readonly タプルが `CategoryWhereInput` に載っていなかった型不整合が露見）、E2E の子孫削除順序とシード update 側のツリー列、統合テストの接続数ガード。以下は 41afbc7f 時点の記録: **カバレッジ作業中に見つかった実バグ**`41afbc7f`: セール終了日が保存できない —— `ProductFormSchema.saleEndDate` は `.datetime({ offset: true })` なのに DateTimePicker の onChange がオフセット無し表記を、クリアが空文字を書いていた（`nullish()` は空文字を許さない）。**FormMessage が無いため画面に理由が出ず、保存だけが黙って止まる**症状。`toISOString()` / `null` へ修正し回帰テスト 2 件を追加。直前は `5015eb07`: **PR#176 の Coverage on New Code 残ギャップ（product-details.tsx / category-details.tsx）を潰し切った**。`bcdf62f5` ProductDetails の外部ウィジェット配線（画像追加/削除・キーワード上限・セール終了日・無料配送国）で line 81.3% → **100%** / branch 88.0% → 90.3%、`5015eb07` CategoryDetails の画像削除分岐で line 96.2% → **100%**。**未カバーは分岐のみ**となり、Sonar の New Code 側は行ベースで解消済み。直前は `3fef0e45`: **SonarCloud PR#176 の Coverage on New Code ギャップをコンポーネントテストで埋めた**。`d2b6cbeb` footer カテゴリリンクの href 形式 / `9efb08be` footer の子ノード優先フォールバックと 7 件上限 / `0be7c434` ProductFilters の storeUrl 伝播 / `03812ca3` CategoryLink の `?category=` 張り替えと旧 `subCategory` 除去 / `46abe694` CategoryDetails の親候補絞り込み・旧 url 正準化・送信 3 分岐 / `3fef0e45` ProductDetails のツリー選択（`isProductAssignableCategory` の 2 条件）とルート categoryId 導出。**Sonar Issue 8 件の修正（sort 比較関数・正規表現のバックトラッキング・認知的複雑度 45/24・`.at(-2)`・未使用 import・Readonly props・optional chaining）は作業ツリーに未コミットで残っている**。plan 068 の不可逆な **Phase C（Step 5 以降）は引き続き未着手**で、オペレーター承認待ち。直前は `9034f300`: `9034f300` E2E 検証（`524ba258` の未検証状態を解消）/ `c653864f`〜`86cef918` upsertCategory のツリー編集（V-7 / V-7b / V-7c / V-7d）/ `7f260c18`〜`ddf6ace1` CategoryFormSchema に parentId・sortOrder / `bfbdb8fd`〜`77e28c24` upsertProduct のリーフ強制（V-5 / V-5b / V-5c）/ `4fcfabd7`〜`1b41dc0f` admin カテゴリ表のツリー表示 / `50c6093b`〜`32c33a00` slug 正準化 + 別名 + 親選択フォーム / `3d776a4f` category-path.ts への分離 / `9571d880` admin/subCategories ルート廃止 / `19c51755`〜`95e72cb0` 商品フォームのツリー選択 1 本化 / `d9fb8f04` 統合テスト V-7d・V-5d / `a15b8850`〜`366a2951` deleteCategory の childCount 修正 / `524ba258` E2E（**未検証**）。直前は `cb551bd0`

---

## 現在の実装状態サマリ

### テスト統計（Jest は 2026-09-04 実測 / Integration は 2026-09-03 実測 / E2E の件数は 2026-09-02 実測・フルランは 2026-08-04 実測。lcov カバレッジは 2026-09-03 実測）

> **記載ルール（2026-07-10 整理）**: このテーブルは**最新値のみ**を保持する。増減の経緯・
> 機能実装の詳細ナラティブは [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) が
> アーカイブ先（日付・コミット付きで全件記録済み）。本テーブルのセルに履歴長文を追記しないこと。

| 指標 | 値 |
|------|-----|
| Jest テスト総数 (unit/component) | **2184** passed / 2187 total / **199 スイート**（198 passed + 1 skipped suite）。**2026-09-04 実測**（CodeRabbit レビュー指摘対応の第 2 巡で **+2 / スイート不変** —— `tests/component/store/footer.test.tsx`〔カテゴリ取得が失敗しても throw せずリンク欄だけ空で描画する〕、`scripts/erd/parse-models.test.ts`〔コメント中の @@id / @@unique を複合キーとして拾わない〕。以下は 2182 時点までの記録: **2182** passed / 2185 total / **199 スイート**。**2026-09-04 実測**（CodeRabbit レビュー指摘対応で **+1 / スイート不変** —— `tests/component/dashboard/category-details.test.tsx`〔自分の子孫が上限を超える親は候補から外す〕。修正前の実装で Red になることを確認済み。以下は 2181 時点までの記録: **2181** passed / 2184 total / **199 スイート**。**2026-09-03 実測**（saleEndDate の実バグ修正で **+2 / スイート不変** —— `product-details.test.tsx`〔終了日を設定して保存できる / クリアして保存できる〕。以下は 2179 時点までの記録: **2179** passed / 2182 total / **199 スイート**。**2026-09-03 実測**（PR#176 の残ギャップ解消で **+15 / スイート不変** —— `tests/component/dashboard/product-details.test.tsx` +14〔ImageUpload / ImagesPreviewGrid / ReactTags / DateTimePicker / MultiSelect / Jodit へ渡す inline コールバックの配線。モックが `<div/>` の素通しで一度も発火せず未カバーだった〕、`tests/component/dashboard/category-details.test.tsx` +1〔ImageUpload の onRemove 後は length(1) 検証で送信を止める〕。内訳 +14 / +1 は 2164 → 2179 の増分 **+15** と一致）。これにより product-details.tsx は line **100%** / branch 90.3%、category-details.tsx は line **100%** / branch 92.2% となり、**未カバーは分岐のみ**。以下は 2164 時点までの記録: **2164** passed / 2167 total / **199 スイート**（198 passed + 1 skipped suite）。**2026-09-03 実測**（SonarCloud PR#176 の Coverage on New Code 対応で **+35 / スイート +5** —— `tests/component/store/footer-links.test.tsx` +3〔`?category=` の href 形式・空配列・固定リンクの 6 件分割〕、`tests/component/store/footer.test.tsx` +4〔子ノード優先フォールバック・7 件上限〕、`tests/component/store/product-filters.test.tsx` +3〔storeUrl の両クエリ伝播〕、`tests/component/dashboard/category-details.test.tsx` +13〔親候補の絞り込み・旧 url 正準化・送信 3 分岐〕、`tests/component/dashboard/product-details.test.tsx` +9〔`isProductAssignableCategory` の 2 条件・ルート categoryId 導出・送信〕、`tests/component/store/category-link.test.tsx` +3〔`?category=` 張り替えと旧 `subCategory` 除去・同一 slug 再クリックの早期リターン〕）。これにより PR#176 の新コード未カバー行は **141 → 38**（product-details.tsx 0%→81.3% / category-details.tsx 0%→96.2% / footer.tsx・links.tsx・filters.tsx は 100%）。以下は 2129 時点までの記録: **2129** passed / 2132 total / **194 スイート**（193 passed + 1 skipped suite）。**2026-09-03 実測**（レビュー指摘対応で **+4 / スイート不変** —— `src/queries/category.test.ts` +2〔`upsertCategory` が**自ノード**も `FOR UPDATE` の対象に含めること / 子孫を掴んでから rebase すること。親だけを掴む実装では「subtree を動かす側」と「その子孫を動かす側」が同じ行で出会わず、`path` と `parentId` が矛盾する〕、`scripts/erd/parse-models.test.ts` +2〔行コメント中の `@@index(` に反応して後続フィールドを落とさない / インデントされた `@@unique` は従来どおり除去する〕）。**計測済みだった 2121 との差 +8 のうち +4 は既存の未同期分**（`category.test.ts` +2 / `admin/categories/columns.test.tsx` +1 ほか。dashboard 再生成で同時に解消）。以下は 2121 時点までの記録: **2121** passed / 2124 total / **194 スイート**。**2026-09-03 再実測で確認**（plan 068 Step 1–9 で **+49 / スイート不変** —— `category.test.ts` +8〔ツリー編集 V-7 系・別名・deleteCategory の childCount〕、`product.test.ts` +8〔リーフ強制 V-5 系・Phase B の depth 制約〕、`schemas.test.ts` +6〔parentId / sortOrder〕、`category-tree.test.ts` +15〔slug 正準化・商品紐づけ可否〕、`admin/categories/columns.test.tsx` +4〔親列・字下げ・sortOrder〕ほか）。以下は 2072 時点までの記録: **2072** passed / 2075 total / **194 スイート**（193 passed + 1 skipped suite）。**2026-09-02 実測**（コードレビュー指摘対応の第 2 弾で **+1 / スイート不変** —— `src/lib/category-tree.test.ts` に `resolveCategoryNode` の DB 障害ケースを追加〔`null` に畳まず再送出することの回帰ガード。`null` は「未解決 slug」を意味し、呼び出し側で 0 件へ変換されるため、障害が「商品なし」として静かに表示される経路を塞ぐ〕）。以下は 2071 時点までの記録: **2026-09-02 実測（コードレビュー指摘対応で **+6 / スイート +1** —— (a) `tests/component/store/category-link.test.tsx` を新設し **+3 / スイート +1**〔カテゴリツリーの選択肢がクライアント遷移に追随して開く / 未選択時はユーザーの折りたたみを維持する。`useState` 初期化子はマウント時 1 回しか走らず、枝がマウントされたまま `?category=` が変わる経路を塞いだ。レンダー中の状態調整で実装〕、(b) `src/app/(store)/browse/page.test.tsx` に **+2**〔明示された `category` が解決できない場合・配列の場合に `?category=<sub>` へ 308 で畳まない —— 畳むと getProducts の fail-closed な 0 件が sub の結果へ化ける〕、(c) `scripts/erd/parse-models.test.ts` に **+1**〔Prisma の行コメントをフィールドとして計上しない〕。直前は 2065 passed / 2068 total / 193 スイート）。以下は 2065 時点までの記録: **2026-09-02 実測（レビュー指摘対応で **+1 / スイート不変** —— `scripts/coverage-dashboard/scan-tests.ts` の `BLOCK_PATTERN` / `EACH_PATTERN` の否定後読みが `(?<![.\w$])` だったため、**プライベートメンバ `this.#test(...)`** が宣言として計上されていた（`test` の直前は `#` で、`.` は `#` の手前にあるため後読みに掛からない）。後読みを `(?<![.#\w$])` へ広げ、`scan-tests.test.ts` に回帰ガードを追加した（Red→Green 実測: 修正前 1 件一致 / 修正後 0 件）。同テストは計算プロパティ `obj["test"](…)` とテンプレートリテラル経由の member access も併せて固定する（こちらは文字列マスクと「`test` の直後が `(` でない」ことで元から安全だが、後読み変更で退行しないことを縛る）。直前は 2064 passed / 2067 total）。以下は 2064 時点までの記録: **2026-09-02 実測（plan 067 Phase B 完了。`category-tree.test.ts` に `flattenCategoryTree` の **+2**〔pre-order 平坦化・空配列〕。footer のカテゴリリンクをツリー由来の正準 slug へ移した変更に伴う。直前は 2062 passed / 2065 total）。以下は 2062 時点までの記録: **2026-09-02 実測（plan 067 Phase B。`src/lib/category-tree.test.ts` を新設し **+1 スイート**、`subtreeOf` / `resolveCategoryNode` / `buildCategoryTree` / `isWithinSubtree` の 12 テスト。ほかに `schemas.test.ts` +10〔slug 文字集合〕・`product.test.ts` +1〔2 サブツリーの積〕・`category.test.ts` +2〔ツリー組み立て・祖先の prefix 展開〕・`browse/page.test.tsx` +5〔308 正準化〕）。直前は 2032 passed / 2035 total / 192 スイート）。以下は 2032 時点までの記録: **2026-09-02 実測（`bun run test`。`scripts/erd/parse-models.test.ts` を新設し **+4 / スイート +1** —— ERD パーサの記法回帰を固定〔1 行の `@@id`/`@@unique` を複合キーとして拾いフィールドに混ぜない / 複数行に跨る名前付き `@@id` の継続行をフィールドとして出さない / オプション付き `@@index` の閉じ行を同様に出さない / リレーションと `Decimal` 表示型を従来どおり解釈する〕。直前は 2028 passed / 2031 total / 191 スイート）。以下は 2028 時点までの記録: **2026-08-31 実測（レビュー指摘対応で **+1 / スイート不変** —— `scan-tests.ts` の `EACH_PATTERN` が `schema.test.each(` のメンバー呼び出しをテーブル展開として計上していた件の回帰ガード。直前は 2027 passed / 2030 total）。以下は 2027 時点までの記録: 2026-08-31 実測（レビュー指摘対応）: +1 / スイート不変** —— `scripts/coverage-dashboard/scan-tests.ts` の `BLOCK_PATTERN` が `\b(it|test)\s*\(` だったため、`/^CREATE\b/i.test(sql)` のような `RegExp.prototype.test` のメンバー呼び出しをテスト宣言として計上していた（`\b` は `.` と識別子の境界でも成立する）。否定後読み `(?<![.\w$])` で塞ぎ、回帰ガードを `scan-tests.test.ts` に追加した。ダッシュボードの integration × queries は 118 → **117** となり、本ドキュメントの記載値と一致した。直前: **2026** passed / 2029 total / **191 スイート**（190 passed + 1 skipped suite）。**2026-08-31 実測（レビュー指摘対応）: +1 / スイート不変** —— `upsertCategory` が ツリー管理列（`parentId` / `path` / `depth` / `sortOrder` / `childCount`）を実行時に落とすことの回帰ガードを `src/queries/category.test.ts` に追加した（`Omit` はコンパイル時にしか効かず、DB から読み戻した `Category` を渡す経路が型検査を素通りするため）。直前は 2025 passed / 2028 total。 以下は 2025 時点までの記録: 2026-08-31 実測（plan 066 でシードの宣言データを単一の木へ統合したのに伴う **−1 / スイート不変**。`prisma/seed/__tests__/` の SubCategory 前提テストを木の不変条件テストへ置き換えた —— 削除: `SEED_SUB_CATEGORIES` の件数/name/url/一意性/親参照/各カテゴリ 2 件以上（6 本）と商品の `subCategoryUrl` 系 2 本。追加: `parentUrl` の参照整合性 / 自己親の不在 / **depth 1 上限**〔Phase A の legacy SubCategory はルート直下しか表現できないため〕/ 各ルートに子 2 件以上 / 商品が**リーフのみ**を指すこと / legacy SubCategory 行が Category ノードと **id を共有**すること / `childCount` が宣言データから再計算されること。`src/queries/category.test.ts` は件数不変で `create` の期待値を `{ ...category, path: url, depth: 0 }` へ更新している）。直前: **2026** passed / 2029 total / **191 スイート**（190 passed + 1 skipped suite）。2026-08-25 実測（レビュー指摘の追加対応で `src/app/(store)/browse/page.test.tsx` に **+1 / スイート不変** —— `normalizePriceParam` が空白のみの `?maxPrice=%20` を `Number("   ") === 0` 経由で「上限 0 の空レンジ」として通していた不具合の回帰ガード〔Red→Green 実測〕。直前は **2025** passed / 2028 total で、コードレビュー指摘の修正に伴う回帰検知点 **+4 / スイート不変** —— `tests/component/store/stripe-payment.test.tsx` +1〔`createStripePaymentIntent` が `clientSecret: null` で解決したケースを握り潰さずエラー描画すること。throw 経路と同じ「無限スピナー」症状なのにエラー状態が立たないため、これまで検出できなかった〕、`src/queries/store.test.ts` +1〔`updateStoreStatus` の非昇格経路が、オーナーのロールを tx 外スナップショットではなくロック取得後の tx 内で読み直すこと。status 側で FOR UPDATE により閉じた TOCTOU が role 側に残っていた〕、`src/app/(store)/browse/page.test.tsx` +2〔`?maxPrice=0` が `Number(x) || MAX_SAFE_INTEGER` の truthy 判定で「上限なし」へ反転しないこと / 非数値・未指定はフォールバックすること〕）。**注記: 直前エントリの記載値 2020/2023 は実測 2021/2024 と 1 件ドリフトしていたため、本更新で実測値に合わせた。** 直前: **2020** passed / 2023 total / **191 スイート**（190 passed + 1 skipped suite）。2026-08-24 実測（コードレビュー指摘の修正に伴う回帰検知点 **+3 / スイート不変** —— `src/queries/product.test.ts` +2〔価格フィルタの `maxPrice: 0` / `minPrice: 0` を truthy 判定で「未指定」に化けさせないこと〕、`payments-table.test.tsx` +1〔シリアライズ済み Stripe ドル値を /100 しないこと〕）。直前: **2017** passed / 2020 total / **191 スイート**（190 passed + 1 skipped suite）。2026-08-23 実測（plan 049 の本体修正に伴う検知点 **+4 / スイート +1** ——`orders-table.test.tsx` 新設 2 / `payments-table.test.tsx` +1 / `shipping-form.test.tsx` +1）。直前: **2013** passed / 2016 total / **190 スイート**（189 passed + 1 skipped suite）。2026-08-23 実測（`bun run test`。plan 030 で `tests/component/store/` に money-path クライアント **6 スイート・+26 テスト**を新設）。直前: **1987** passed / 1990 total / **184 スイート**（183 passed + 1 skipped suite）。2026-08-13 実測（`bun run test`。レビュー指摘対応で **+3 / スイート不変** —— `src/queries/review.test.ts` に **+2**〔集計の原子性: レビュー書き込みと集計更新が単一 `$transaction` へ配線されること / Product 行の排他ロックがレビュー書き込みより**手前**で取られること。**lost update に対する決定論的なガードはこの 2 本**であり、統合テスト側ではない〕、`src/lib/shipping-utils.test.ts` に **+1**〔`Prisma.Decimal` 移行の回帰: WEIGHT 方式 `0.15 × 1.45 × 10` は 10 進で厳密に 2.175 なので half-up で **2.18** だが、旧 `Math.round((x + EPSILON) * 100) / 100` は `* 100` のスケーリング誤差で 2.17 を返していた〕）。直前は **1984** passed / 1987 total / **184 スイート**・2026-08-13 実測（`bun run test`。plan 010 で `src/lib/shipping-utils.test.ts` を新設し **+8 / スイート +1** —— 配送料計算 SSOT `computeShippingTotal` の quantity ガード（0 / 負値）・ITEM 単数/複数・WEIGHT 整数/float 誤差の 2 桁正規化/`.xx5` の half-up 丸め境界・FIXED の weight・quantity 非依存。**期待値はすべて手計算定数のハードコード**で、関数自身をオラクルにしていない）。直前は 1976 passed / 1979 total / **183 スイート**（182 passed + 1 skipped suite）・2026-08-12 実測（`bun run test`。レビュー指摘対応で **+1 / スイート不変** —— `browse/page.test.tsx` に `?page=2&page=999` の配列パラメータで先頭要素を採りリダイレクトしないケースを追加。`product.test.ts` の未マッチ URL ケースは件数不変で `findUnique` の引数検証を強化）。直前は 1975 passed / 1978 total / 183 スイート・2026-08-12 実測（`bun run test`。`getProducts` の未マッチ URL フィルタ是正で **+5 / スイート不変** —— store / category / subCategory / offer の 4 モデル分と `currentPage` / `pageSize` 保持）。直前は 1970 passed / 1973 total / 183 スイート・2026-08-12 実測（`bun run test`。URL 数値パラメータ正規化の恒久対応で **+36 / スイート +1** —— `src/lib/utils.test.ts` に **+28**（`normalizePositiveIntParam` / `normalizePageParam` の正常系・異常系・上限クランプ・配列先頭採用・`max: 0` を falsy として取りこぼさない回帰ガード）、新設 `src/app/(store)/browse/page.test.tsx` に **+8**（範囲外ページの正準リダイレクト・クエリ保持・0 件時のループ防止・`?page=1e21` の `MAX_PAGE` クランプ）。**先行コミット `49e0daa2` は Jest テストを増やしていない**〔`tests/e2e/engagement.spec.ts` と `src/` のみ〕ため、+36 はすべて本作業分）。直前は 1934 passed / 1937 total / 182 スイート（181 passed + 1 skipped suite）・2026-08-11 実測（`bun run test`。SonarCloud PR #173 の New Code カバレッジ 0.0% を受けて `tests/component/store/browse-pagination.test.tsx` を新設し **+6 / スイート +1**。**スイートの実測値は本更新前の時点で既に 181** で、直前の記載 180 は 1 件未同期だった〔テスト総数 1931 は一致〕）。直前は 1928 passed / 1931 total / 180 スイート（179 passed + 1 skipped suite）・2026-08-11 実測（`bun run test`。**plan 046 は Jest テストを増やしていない** —— +13 はすべて先行コミット `a9083b17`〜`7064f9f3`（Prisma クライアントの遅延初期化 Proxy と初期化エラーの再 throw / 参照同一性）の未同期分で、本行はその時点で更新されていなかった）。直前は 1915 passed / 1918 total / 180 スイート・2026-08-10 実測（`bun run test`。CodeRabbit レビュー対応で `tests/component/store/categories-menu.test.tsx` に **+6**（タイマー破棄 / Enter・Space・クリック開閉 / `aria-expanded` / 閉時のフォーカス除外）・`product-sort.test.tsx` に **+1**（未知 sort 値で既定項目が `aria-checked=true`）。**1895 → 1915 の差 20 のうち 13 テスト・スイート 178 → 180 の 2 件は先行コミット `879763a0` の未同期分**で、本行はその時点で更新されていなかった）。直前は 1895 passed / 1898 total / 178 スイート・2026-08-09 実測（CodeRabbit 指摘対応で `scripts/coverage-dashboard/render-html.test.ts` に **+1**・スイート不変 —— §03 Next Actions が「a11y 拡大は完了」と読める文言へ退行しないことを固定）。直前は 1894 passed / 1897 total・2026-08-09 実測（plan 064 / TESTS-21 の本体修正で `src/queries/user.test.ts` に **+3**・スイート不変 —— 新規経路でも default 解除が走ること / 解除と作成が tx 経由であること / P2002 が code を保って伝播すること）。直前は 1891 passed / 1894 total・2026-08-08 実測（SonarCloud PR #169 の New Code カバレッジ 70% を受けて `src/app/api/webhooks/stripe/route.test.ts` に非 USD 拒否のケースを追加し **+1**・スイート不変）。その前は 1890 passed / 1893 total・2026-08-04 実測（plan 028 で `src/queries/country.test.ts` を新設し +4 テスト / +1 スイート、plan 029 で `profile.test.ts` を 34→63 に拡張し +29、plan 026 で `paypal.test.ts` を 40→56 に拡張し +16。029/026 はスイート数不変）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| カバレッジ全体（lcov **2026-09-03 実測**・saleEndDate 修正後） | Statements **75.32%** (6650/8828) / Branches **60.8%** (3194/5253) / Functions **65.9%** (1119/1698) / Lines **74.8%** (6016/8042)。分母が 1 行減っているのは未使用になった `date-fns` の import を落としたため。以下は直前の記録: Statements 75.33% (6651/8829) / Branches 60.8% / Functions 65.9% / Lines 74.81% (6017/8043)。**Functions が 64.36% → 65.9% と 1.5pt 動いた**のは、巨大フォーム 2 本に散っていた inline コールバック（`onChange` / `onRemove`）がモック経由で初めて実行されたため。以下は直前の記録: Statements 74.94% (6617/8829) / Branches 60.59% (3183/5253) / Functions 64.36% (1093/1698) / Lines 74.43% (5987/8043)。**Branches が 52.06% → 60.59% と 8.5pt 動いた**のは、admin/seller の巨大フォーム 2 本（`product-details.tsx` / `category-details.tsx`）が 0% から入ったため —— いずれも分岐密度が高く、lcov 全体の分母に占める比重が大きい。以下は plan 068 後までの記録: Statements **72.45%** (6395/8826) / Branches **52.06%** (2745/5272) / Functions **60.73%** (1024/1686) / Lines **71.81%** (5772/8037)。**分母が 8727 → 8826 へ増えた上で全指標が上がっている**ので、068 の新規コード（`src/lib/category-path.ts` ほか）は追加分を上回る密度でテストされている。以下は 2026-08-23 実測（plan 030 後）までの記録: Statements **70.51%** (6154/8727) / Branches **50.00%** (2611/5221) / Functions **58.23%** (972/1669) / Lines **69.67%** (5548/7963)。**money-path クライアント 6 ファイルは Lines 0% → 96.8〜100%**（paypal-payment 100% / stripe-payment 97.6% / cart-page/container 100% / cart-page/summary 100% / checkout-page/container 96.8% / newsletter 100%）。直前: Statements **68.49%** (5957/8697) / Branches **48.46%** (2524/5208) / Functions **56.57%** (942/1665) / Lines **67.58%** (5366/7940)（前回 67.71 / 48.00 / 55.48 / 66.79 = 2026-08-04 実測 plans 028/029/026 後。差分は本 PR の browse-pagination テストだけでなく、**2026-08-04 以降に積まれた全コミット分の未再測**を含む —— 分母も 8657 → 8697 と増えているため、単一プランへの帰属はできない）。直前（2026-08-04 実測・plans 028/029/026 後）: Statements **67.71%** (5862/8657) / Branches **48.00%** (2498/5204) / Functions **55.48%** (921/1660) / Lines **66.79%** (5279/7903)（前回 66.8 / 46.86 / 55.39 / 65.81 — Statements +0.91 / Branches +1.14 / Functions +0.09 / Lines +0.98。内訳は plan 029（`profile.ts` Branches 67.81%→**100%**）と plan 026（`paypal.ts` Branches 72.05%→**91.91%**・Statements/Lines/Functions **100%**）が大半で、plan 028 の country.ts は 19 行の小モジュールなので寄与は小さい。Functions がほぼ動かないのは 3 プランとも既存関数の分岐を埋める作業で新規関数を増やさないため） |
| Jest Integration テスト総数 | **136** / **16 スイート**（**2026-09-03 実測: 136/136 pass**。レビュー指摘対応で `category-tree-write.test.ts` に **+1 / スイート不変** —— Scenario 5〔subtree 移動と「子孫を subtree 外へ動かす」並行トランザクションの競合。修正前は `parentId = z` なのに `path = b/x/d` が書き戻される破損を実測〕。同ファイルの固定 `setTimeout(300)` は `pg_stat_activity` の待ちポーリングへ置換した（当て推量の待ちは遅い CI で競合を再現しないまま緑になる）。以下は 135 時点までの記録: **135** / **16 スイート**（**2026-09-03 再実測で確認: 135/135 pass**。plan 068 で `tests/integration/category-tree-write.test.ts` を新設し **+4 / スイート +1** —— V-7d〔再親子化の子孫追随を DB 値と**検索結果**の両方で検算 / 上限超過では 1 行も書き換わらない〕と V-5d〔子作成の tx を**開いたまま** upsertProduct をロック待ちにし、childCount = 1 を読んで拒否されること。**素朴な同時ディスパッチではロックを外しても緑になる**ためこの形にした。FOR UPDATE を findUnique に置き換えると本シナリオのみ赤になることを実測済み〕）。以下は 131 時点までの記録: **131** / **15 スイート**（**2026-09-02 実測: 131/131 pass**。レビュー指摘対応で **+2 / スイート不変** —— `category-tree-resync.test.ts` に `Product.categoryNodeId` の再同期〔066 適用後に作られた商品の **NULL** を埋める / カテゴリ変更で **stale** になった値を追随させる〕。区間の `UPDATE "Product"` は 実行されていたが**一度も検算されていなかった**（ファイル冒頭の docstring が 「先に読み取りを切り替えるとその商品が静かに消える」と説明している当の経路）。併せて `setup/migration-sql.ts` の `runStatements` を `$transaction` で包み、移行区間を本番と同じ原子性で流すようにした。直前は 129 / 15 スイート）。以下は 129 時点までの記録: **2026-09-02 実測: 129/129 pass**。plan 067 の残作業で `product-browse.test.ts` に **+4**〔V-1 兄弟 prefix の非ヒット / depth 2 の商品がルート祖先で取れる / 旧 `?subCategory=` が同一サブツリーへ解決 / V-6 未解決 slug で 0 件〕、`product-update.test.ts` に **+2**〔create・update 両経路で `categoryId`・`subCategoryId`・`categoryNodeId` の 3 列が揃う dual-write〕。スイート数は不変。**いずれも本体を壊すと赤になることを実測で確認済み**（`subtreeOf` から境界文字 `/` を落とす / `categoryNode` の connect を落とす）。直前は 123 / 15 スイート）。以下は 123 時点までの記録: **2026-09-02 実測: 123/123 pass**。plan 067 で `category-tree-resync.test.ts` を新設し **+6 / スイート +1** —— Phase B 再同期を実 DB で検証〔新規取り込み / rename・親付け替え・featured の追随 / 旧 slug alias の保持＝308 到達性 / 衝突リネームと自己衝突の除外 / childCount の全件再計算 / 冪等性〕。抽出・分割器は `setup/migration-sql.ts` へ集約し Phase A のテストもそこへ寄せた。直前は 117 / 14 スイート）。以下は 117 時点までの記録: **117** / **14 スイート**（… + `category-tree-migration.test.ts` **9**）。**2026-08-31 実測: 117/117 pass**（plan 066 / V-3・V-4 で `category-tree-migration.test.ts` を新設し **+9 / スイート +1**。カテゴリツリー Phase A のデータ移行を実 DB で検証 —— DML 区間の抽出自体〔DO ブロックが内部の `;` で刻まれていない / DDL を巻き込んでいない〕/ A-1 ルートの path・depth 正規化 / A-3 子ノード取り込みと **id 共有** / 衝突リネーム〔上位 URL 温存・第一候補が埋まっていれば `-2`〕と **alias 2 行の共存**〔`(entityType, oldSlug)` 複合キーの存在理由そのもの〕/ **V-3 2 回実行の同一性** / **V-4 childCount 整合** / A-5 子削除後のドリフト解消 / A-6 `categoryNodeId` の backfill。**本テストはマイグレーション本体の `PHASE_A_DATA_MOVE` マーカー区間を読み出してそのまま実行する** —— globalSetup の `prisma migrate deploy` は空 DB に掛かるため DML はそこでは常に no-op で、移行を検証するには旧形状データを入れて能動的に再実行するしかない。SQL をテストへ写経すると SSOT が 2 つになりドリフトするので、読み出す側に倒している）。直前: **108** / **13 スイート**（… + `store-status.test.ts` **9** + `product-update.test.ts` **5** + `product-browse.test.ts` **16**）。**2026-08-24 実測: 108/108 pass**（レビュー指摘対応で `store-status.test.ts` に並行遷移シナリオを **+1**〔スイート不変〕。`updateStoreStatus` の昇格判定が tx 外スナップショットを見ていた TOCTOU を、tx 内の `SELECT "status" … FOR UPDATE` へ移して閉塞した本体修正の回帰ガード）。直前: **107** / 13 スイート（**2026-08-23 実測: 107/107 pass**。plan 039 / TESTS-23 で `product-browse.test.ts` を新設し **+16 / スイート +1**。browse の where 動的合成・ソート・ページングを実 DB で初めて検証し、**`lte: Infinity` が Prisma の Decimal フィルタで throw する実バグを検出**して本体を修正した〔`f1be1aa0`〕。**R6 ラウンドが閉じ切った**）。直前: **91** / **12 スイート**（`cart-checkout.test.ts` 11 + `order-placement.test.ts` **9** + `order-lifecycle.test.ts` **8** + `webhook-payment.test.ts` **12** + `search-products.test.ts` **9** + `product-deletion.test.ts` **4** + `shipping-address-default.test.ts` **6** + `user-deletion-webhook.test.ts` **7** + `coupon-code-uniqueness.test.ts` **5** + `review-aggregation.test.ts` **7** + `store-status.test.ts` **8** + `product-update.test.ts` **5**）。**2026-08-23 実測: 91/91 pass**（plan 038 / TESTS-22 で `product-update.test.ts` を新設し **+5 / スイート +1**。商品編集の全置換 tx を実 DB で初めて検証 —— 子レコードの全置換と `Size.id` の変化 / slug 再生成と `-1` suffix / 名前不変時の slug 維持 / **Wishlist は SET NULL・CartItem は stale** という下流副作用 / tx 後段の失敗で全置換が巻き戻る原子性）。直前: **86** / **11 スイート**（`cart-checkout.test.ts` 11 + `order-placement.test.ts` **9** + `order-lifecycle.test.ts` **8** + `webhook-payment.test.ts` **12** + `search-products.test.ts` **9** + `product-deletion.test.ts` **4** + `shipping-address-default.test.ts` **6** + `user-deletion-webhook.test.ts` **7** + `coupon-code-uniqueness.test.ts` **5** + `review-aggregation.test.ts` **7** + `store-status.test.ts` **8**）。**2026-08-23 実測: 86/86 pass**（plan 035 / TESTS-19 で `store-status.test.ts` を新設し **+8 / スイート +1**。`updateStoreStatus` の「遷移条件つき権限付与」を実 DB で初めて検証 —— PENDING→ACTIVE でのみ `User.role` が SELLER へ昇格すること / PENDING→BANNED と非 PENDING 起点では昇格しないこと / **DB 昇格条件と Clerk 同期条件が異なる現仕様**〔`TODO(characterization)` タグ付き・remediation 時に反転〕/ 再実行時の DB 冪等性と Clerk 呼び出しの非冪等性 / `$transaction` の原子性〔一時 CHECK 制約で後段 `user.update` のみ失敗させ、前段 `store.update` が PENDING へ巻き戻ることを実証。制約は `finally` で DROP し、同一ファイル 2 回連続実行で後始末漏れが無いことを確認〕。**これで R5 ラウンドが閉じ切った**）。直前: **78** / **10 スイート**（`cart-checkout.test.ts` 11 + `order-placement.test.ts` **9** + `order-lifecycle.test.ts` **8** + `webhook-payment.test.ts` **12** + `search-products.test.ts` **9** + `product-deletion.test.ts` **4** + `shipping-address-default.test.ts` **6** + `user-deletion-webhook.test.ts` **7** + `coupon-code-uniqueness.test.ts` **5** + `review-aggregation.test.ts` **7**）。**2026-08-13 実測: 78/78 pass**（レビュー指摘対応で `review-aggregation.test.ts` に **+2 / スイート不変** —— `upsertReview` の集計を単一 `$transaction` + Product 行 `SELECT … FOR UPDATE` へ直列化した本体修正に伴う並行シナリオ 2 件〔同一ユーザーの同時二重投稿で行が水増しされない / 別ユーザーの輻輳で全員成功・集計一致〕。**多ユーザー輻輳ケースは修正前の実装でも緑**である点に注意 —— 同形の呼び出しは往復ごとに歩調が揃うため、レイテンシが均一なローカル DB では lost update の並びを踏めない。決定論的なガードは `src/queries/review.test.ts`「集計の原子性」側の配線テスト。同一ユーザー二重投稿ケースは修正前だと 3 回中 2 回 fail する確率的ガード）。直前: **76** / 10 スイート。**2026-08-13 実測: 76/76 pass / 13.923s**（plan 034 / TESTS-18 で `review-aggregation.test.ts` を新設し **+5 / スイート +1**。`upsertReview` の評価集計を実 DB で初めて検証 —— 初回投稿の rating / numReviews と **User フォールバック upsert**〔Clerk Webhook 同期漏れ時のオンデマンド作成〕/ 複数ユーザーの平均 / **同一ユーザー再投稿が create でなく update になること**〔件数不変・平均のみ変動・画像は総入れ替え〕/ 商品間の独立性 / 未認証 reject + 副作用なし）。直前: **71** / 9 スイート。**同日実測: 71/71 pass / 13.073s**（plan 041 / TESTS-25 で `coupon-code-uniqueness.test.ts` を新設し **+5 / スイート +1**。`Coupon.code` はグローバル unique だが seller 経路の事前重複チェックは**自店舗内のみ**を検索するため、他店舗 / PLATFORM との code 衝突は**実 DB の unique 制約だけ**が止めている —— race ではなく 2 店舗が同じ code を作るだけで決定論的に到達する本経路。**両経路は同一のエラーメッセージを投げるので、テスト側で経路を推論してはならない**〔プランが 2026-07-18 に撤回した手法。テスト側の再クエリは実装と独立しており、実装が変わっても緑のまま腐る〕。観測可能な不変条件〔拒否 + 既存行無傷 + 行数不変〕のみを assert している。**これで R7 ラウンドが閉じ切った**）。直前: **66** / 8 スイート。**2026-08-09 実測: 66/66 pass**（plan 064 / TESTS-21 で `shipping-address-default.test.ts` が 4 → **6**・スイート不変。シナリオ2 の characterization〔default 2 件併存〕を不変条件へ反転し、原子性〔P2002 時に攻撃者自身の default 解除もロールバック〕と DB 部分 unique index の存在を検証するシナリオ 5 / 6 を追加）。直前: **64** / 8 スイート。`bun run test:integration`（testcontainers + 専用 config）で実行、`bun run test` の集計外。**2026-08-09 実測: 64/64 pass**（plan 040 で `user-deletion-webhook.test.ts` を新設し **+7 / スイート +1**。Clerk `user.deleted` の FK 連鎖 —— CASCADE 7 種の消滅〔implicit M2M は相手側の `_count` で確認〕・**RESTRICT 4 経路の 500 characterization**〔Order / Review / 住所 / Store。PII を含む User 行が残存し続ける〕・SupportTicket の SET NULL + PII 秘匿化〔正の保証〕・deleteMany の冪等性）。**同日 57/57 pass**（plan 037 で `shipping-address-default.test.ts` を新設し **+4 / スイート +1**。default フラグの不変条件 —— 更新経路は解除が効くが**新規経路はスキップされ 2 件併存する既知バグ TESTS-21 の characterization**〔`TODO(characterization)` タグ付き・修正時に 1 へ反転〕・他ユーザー住所 id の上書きが P2002 で reject される IDOR 防御の実体）。**同日 53/53 pass**（plan 036 で `product-deletion.test.ts` を新設し **+4 / スイート +1**。`deleteProduct` の FK セマンティクス —— CASCADE 9 種の全件消滅〔孫の FreeShippingCountry を含む〕・Review による **RESTRICT（P2003）** の characterization・失敗時に子が 1 件も欠けない原子性・所有権ガードの副作用なし）。**同日 49/49 pass**（plan 033 で `search-products.test.ts` を新設し **+9 / スイート +1**。tsvector 全文検索の raw SQL を実 DB で初めて実行 —— トークナイザーの小文字化・`ts_rank` 降順・`plainto_tsquery` の AND 意味論・空白トリムと `q` 欠落の 2 分岐・パラメータ化の安全性・従属の `ORDER BY RANDOM()`。**本ファイルのみ docblock で `testEnvironment: node`**〔plan 032 と同じ理由〕）。**2026-08-08 計上: 40**（`a4d01b27` が `webhook-payment.test.ts` に非 USD 拒否の Scenario S8 を追加し **+1 / スイート不変**。Stripe 8 + PayPal 4。ダッシュボードの静的走査と一致。**フルラン実測は 2026-08-04 の 39/39 pass が最新**で、S8 追加後の実行実測はまだ取っていない）。**2026-08-04 実測: 39/39 pass**（plan 032 で `webhook-payment.test.ts` を新設し **+11 / スイート +1**。Stripe 7 + PayPal 4。**本ファイルのみ docblock で `testEnvironment: node` に上書き**している —— jsdom には Fetch API の `Request` / `Response` が無く Route Handler を直接呼べないため。config は無変更）。**同日 28/28 pass**（plan 031 で `order-lifecycle.test.ts` を新設し **+8 / スイート +1**。キャンセル・返金の親子連動と在庫復元、二重キャンセルの冪等性〔逐次 + 並行ディスパッチ〕、group 単位キャンセルの親集約、両 admin 関数の認可ガード。**`updateOrderPaymentStatus`（CAS 済み）と `updateOrderGroupStatusAsAdmin`（read-then-act・未対応）は区別すること** —— 並行安全性を固定しているのは前者のみ）。**同日 20/20 pass / 4.054s**（plan 027 で order-placement に Scenario 7 = 在庫の実減算量 / Scenario 8 = オーバーセルロールバック / Scenario 9 = PLATFORM クーポン端数吸収 の 3 本を追加。直前は 17 / order-placement 6）。**2026-07-11 実測: 17/17 pass / 4.779s**（Round 4 時点の「Docker 停止により未実測」を解消）。**同日 Round 6 冒頭に 17/17 pass / 4.008s、Round 7 冒頭に 17/17 pass / 4.473s を再実測**（いずれもソース無変更の確認込み）。**2026-07-17: ダッシュボードの `integration × queries` が 14 と表示され本行の 17 と乖離していた問題を解消**（`scan-tests.ts` が `it.each` を 0 件と数えていた静的走査の欠陥。`c1be6d7` で展開対応し 14→17 で一致） |
| Jest スナップショット | **127**（`tests/component/ui/__snapshots__/`・49/49 shadcn/ui プリミティブカバー） |
| Playwright E2E（全プロジェクト集計） | **66 tests/browser**（30 files・3 ブラウザ計 **198**）。2026-09-03 実測（`bunx playwright test --list` が `Total: 198 tests in 30 files`）。plan 068 の `admin-category-tree.spec.ts` で **+1 test/browser・+1 file**。**3 ブラウザすべてで緑を実測**（2026-09-03）。chromium は dev 起動・本番ビルド起動の両方で pass、firefox 7.9s / webkit 12.7s は本番ビルド起動で pass。`retries=2` を有効にしたまま実行して **flaky 0**（`bun run test:e2e:local -- tests/e2e/admin-category-tree.spec.ts --project=firefox --project=webkit`）。以下は 65 tests 時点までの記録: **65 tests/browser**（29 files・3 ブラウザ計 **195**）。2026-09-02 実測（`bunx playwright test --list` が `Total: 195 tests in 29 files`）。plan 067 V-2 で `search-filter.spec.ts` に **+1 test/browser** —— 旧 `?subCategory=` が **308** で正準 `?category=` へ着地することを、正準 slug と `CategorySlugAlias` 経由でしか解決できない旧 slug の 2 経路で検証する（`maxRedirects: 0` でステータスと `Location` を直接見る）。chromium で 6/6 pass を実測。**ローカル実行は `PORT=3100 E2E_NO_REUSE=1` で隔離すること** —— :3000 に別リポジトリの next-server が居ると `reuseExistingServer` がそれを掴み、全 spec が赤になる（`playwright.config.ts` の警告どおり）。直前: **64 tests/browser**（29 files・3 ブラウザ計 **192**）。2026-08-31 実測（`bunx playwright test --list` が `Total: 192 tests in 29 files`）。plan 054 の残りで `tests/e2e/visual/product.spec.ts` を新設し **+1 test/browser**（**VRT は chromium 限定**なので実際に実行されるのは 1 件で、firefox / webkit では skip される）。直前: **63 tests/browser**（28 files・3 ブラウザ計 **189**）。2026-08-23 実測（`bunx playwright test --list` が `Total: 189 tests in 28 files`）。plan 054 で `tests/e2e/visual/browse.spec.ts` を新設し **+1 test/browser**（**VRT は chromium 限定**なので実際に実行されるのは 1 件で、firefox / webkit では skip される）。直前: **62 tests/browser**（27 files・3 ブラウザ計 **186**）。2026-08-23 実測（`bunx playwright test --list` が `Total: 186 tests in 27 files`）。plan 049 で `tests/e2e/profile.spec.ts` を新設し **+2 tests/browser / +1 file**。**実測 chromium 2 passed / 3 ブラウザ 4 passed・2 skipped**（Firefox は `stock-decrement` と同条件の dev モード skip）。直前: **60 tests/browser**（26 files・3 ブラウザ計 **180**）。2026-08-23 実測（`bunx playwright test --list` が `Total: 180 tests in 26 files`）。plan 056 で `tests/e2e/newsletter.spec.ts` を新設し **+2 tests/browser / +1 file**（3 ブラウザ計 +6）。**新スペック単体の実測: chromium 2 passed / 3 ブラウザ 6 passed / flaky 0**。E2E メインスペックは 16 → **17**。**characterization スイート**（`/api/newsletter` 不在で購読が 100% 失敗する dormant 機能の固定）であり、route が実装されたら**意図的に fail する** —— その時は成功系へ書き直すこと（`test.skip` で黙らせない）。直前: **58 tests/browser**（25 files・3 ブラウザ計 **174**）。2026-08-12 実測（`bunx playwright test --list` が `Total: 174 tests in 25 files`）。plan 055 で `tests/e2e/cart-login-handoff.spec.ts` を新設し **+1 tests/browser / +1 file**（3 ブラウザ計 +3）。**新スペック単体の実測: chromium 1 passed / 3 ブラウザ 3 passed / flaky 0**。E2E メインスペックは 15 → **16**。**`CLERK_SECRET_KEY` 未設定時は describe ごと skip**。**このテストが埋めたのは「ゲスト→会員化の順序」**で、既存カバーは「未認証で Checkout → 認証エラー」（purchase-flow）と「最初から認証済みでカート構築」（a11y/checkout・plan 047）だけだった。**`page.reload()` に簡略化してはいけない** —— 同一コンテキストでは localStorage が残り、`saveUserCart` が壊れていても green になる。直前: **57 tests/browser**（24 files・計 **171**）。2026-08-12 実測（`bunx playwright test --list` が `Total: 171 tests in 24 files`）。plan 053 で `tests/e2e/auth-surface.spec.ts` を新設し **+3 tests/browser / +1 file**（3 ブラウザ計 +9）。**新スペック単体の実測: chromium 3 passed / 3 ブラウザ 9 passed / flaky 0**。E2E メインスペックは 14 → **15**。**サインアウト往復のみ `CLERK_SECRET_KEY` 未設定時に skip**（ゲスト 2 件は依存なしで常時実行される）。**この spec が Clerk アップグレード時の canary** —— ウィジェットの DOM 変更なら本 spec の locator を、サインインフローの変更なら `helpers/auth.ts` を直す（役割を混ぜないこと）。**フルラン実測は 2026-08-04 の 83 passed / 0 failed / 3 flaky / 37 skipped が最新**で、plans 045 / 052 / 046 / 048 / 050 / 053 追加後のフルランはまだ取っていない。直前: **54 tests/browser**（23 files・計 **162**）。2026-08-11 実測（`bunx playwright test --list` が `Total: 162 tests in 23 files`、`--project=chromium` が `Total: 54 tests in 23 files`）。plan 050 で `tests/e2e/admin-store-status.spec.ts` を新設し **+1 tests/browser / +1 file**（3 ブラウザ計 +3）。**新スペック単体の実測: chromium 1 passed / 3 ブラウザ 3 passed / flaky 0**（当初 2 flaky だったが原因は sign-in 直後の遅延リダイレクトによる goto 割り込みで、`gotoStable` 経由に統一して解消）。E2E メインスペックは 13 → **14**。直前: **53 tests/browser**（22 files・計 **159**）。plan 048 で `tests/e2e/engagement.spec.ts` を新設し **+3 tests/browser / +1 file**（3 ブラウザ計 +9）。**新スペック単体の実測: chromium 3 passed / 3 ブラウザ 9 passed / flaky 0**。E2E メインスペックは 12 → **13**（+ `engagement`）。**フルラン実測は 2026-08-04 の 83 passed / 0 failed / 3 flaky / 37 skipped が最新**で、plans 045 / 052 / 046 / 048 追加後のフルランはまだ取っていない。直前: **50 tests/browser**（21 files・計 **150**）。**plan 046 では件数が動いていない**（同 plan は `search-filter.spec.ts` の既存 `test.skip` を `test` へ変えただけでテストを追加していない。`--list` は skip も数えるため総数は動かず、**変わったのは skip 0 件化**）。plan 046 実測: `search-filter` が chromium **5 passed / skip 0**、3 ブラウザ **15 passed**（リトライなし）。回帰として `purchase-flow` + `layout-chrome`（chromium）**12 passed** —— ページネーション用 seed（専用カテゴリ + 12 商品）の波及なしを確認。直前の値の根拠は 2026-08-09 実測（`bunx playwright test --list` が `Total: 150 tests in 21 files`、`--project=chromium` が `Total: 50 tests in 21 files`）。plan 052 で `tests/e2e/a11y/` に browse / product / cart の 3 spec を新設し **+3 tests/browser / +3 files**（3 ブラウザ計 +9。ただし firefox / webkit は a11y 共通の chromium 限定ゲートで skip されるため、実行されるのは chromium の 3 のみ）。直前: **47 tests/browser**（18 files・計 **141**）。plan 045 で `tests/e2e/guest-flows.spec.ts` を新設し **+6 tests/browser / +1 file**（3 ブラウザ計 +18）。**新スペック単体の実測: chromium 6 passed / 3 ブラウザ 18 passed / flaky 0**（`bash scripts/e2e/run-local.sh tests/e2e/guest-flows.spec.ts`・1.7m）。回帰確認として `search-filter` + `layout-chrome` を chromium で実行し **11 passed / 1 skipped**（skip は既存のページネーション test = plan 046 担当）。**フルラン実測は 2026-08-04 の 83 passed / 0 failed / 3 flaky / 37 skipped が最新**で、plan 045 追加後のフルランはまだ取っていない。直前: **41 tests/browser**（17 files・計 **123**）。**18 files の内訳 = E2E メイン 12 + Visual 2 + a11y 4**（`testDir` が `tests/e2e` 単一のため `--list` は 3 系統を合算する。「E2E メイン 12」の区分は [`COVERAGE_REPORT.md §1`](./COVERAGE_REPORT.md) の定義と一致し、Visual / a11y の内訳は下 2 行が担当）。E2E メインの **12 スペック**（purchase-flow / seller-onboarding / payment-error / search-filter / mobile-responsive / platform-coupon / stock-decrement / country-selector / messages / layout-chrome / security-headers / **guest-flows**）。Clerk 依存 spec は `CLERK_SECRET_KEY` 未設定時に自動 skip。2026-08-04 実測: 全プロジェクト `bunx playwright test --list` が `Total: 123 tests in 17 files`、`--project=chromium` / `firefox` / `webkit` が**各 41**（3 ブラウザ計は掛け算ではなく実測値。projects は 3 つとも同一 `testDir` を走査するため各ブラウザで件数が一致する）。**2026-08-04 フルラン実測（plan 043 完了後・`bash scripts/e2e/run-local.sh`）: 83 passed / 0 failed / 3 flaky / 37 skipped / 7.4m**。**failed はゼロ**（042/044 完了時点で残っていた visual 3 件を plan 043 が解消）。flaky 3 件（payment-error@chromium / platform-coupon@firefox / layout-chrome@webkit）はいずれもリトライで pass しており **VRT とは無関係の別事案**として残る。所要は従前ベースライン 25.5m から短縮（サインイン後ハングの除去でリトライ消費が消滅）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| Playwright Visual | **4 スペック**（cart / checkout / browse / **商品詳細**）・**5 テストとも passed**（chromium 限定）。2026-08-31 実測（plan 065 で右購入パネルのクリップを修正したうえで plan 054 の残り＝商品詳細を撮影。更新フラグなしで 2 回連続 5 passed を確認）。**`devices["Desktop Chrome"]` のビューポートは 1280x720 で、これは 065 でクリップが起きていた幅そのもの**なので、同種の回帰の検知器になる。スペックはピクセル比較の前に `Add to cart` の右端が `clientWidth` 以内であることも assert しており、ベースライン更新時に壊れた状態を固定する経路を塞いでいる。直前: **3 スペック**（cart / checkout / **browse**）・**4 テストとも passed**（chromium 限定）。2026-08-23 実測（plan 054 で browse を追加。ベースライン撮影後に更新フラグなしで2 回連続 4 passed を確認）。**商品詳細は右パネルのクリップを目視ゲートで検出したため見送り**（未起票）。直前: **2 スペック**（cart / checkout）・**3 テストとも passed**（chromium 限定）。2026-08-04 に plan 043 で再撮影して解消（連続 2 回 green で再現性確認済み）。cart 2 枚は旧ベースラインが dev サーバー時代の 720px（フッター未描画・Next dev インジケータ写り込み）だった陳腐化。**checkout はベースライン陳腐化ではなかった** —— Clerk が client-only のため撮影時に本文が空で、`toHaveScreenshot` の安定判定（100ms 間隔 2 枚の一致）が空画面を「安定」と誤認していた。spec 側に描画完了アンカー（`.cl-signIn-root` + `input[name="identifier"]` の可視）を追加して解決（`15cbca83`、locator は `62b915a4` で `password` → `identifier` に是正 —— ベースラインは `<SignIn />` の初期表示＝識別子入力ステップで、パスワード欄は写っていない） |
| Playwright a11y | **7 スペック**（sign-in / seller-apply / checkout / profile / **browse / product / cart**）・**7 spec すべて passed**。2026-08-09 実測（`bash scripts/e2e/run-local.sh tests/e2e/a11y --project=chromium` が 7 passed / 58.3s）。plan 052 で Phase 3（ゲストのストアフロント主要ページ）を追加。**初回スキャンで critical 3 種 / serious 2 種の実違反を検出**し、`sort.tsx` / `quantity-selector.tsx` / `categories-menu.tsx` を修正して green 化した（`df4d4f7e`）—— 「検出経路が無いだけで違反は潜在している」という plan の仮説が実証された形。home（`/`）は OI-9（本番ビルドで SSR 500）が未解消のため引き続き対象外。直前: **4 スペック**・2026-08-03 実測。**2026-08-04 の 3 ブラウザフルランでも全て passed を再確認**。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| 型エラー | **0 件** |
| Skipped テスト | **3 件**（idempotency suite 3 件 [`prisma/seed/__tests__/idempotency.test.ts` を `SKIP_DB_TESTS` 環境変数で `describe.skip`]）。modal-provider 9 件は 2026-06-14 に un-skip 済み（OI-8 解消）。Playwright a11y spec は別系統で `CLERK_SECRET_KEY` 未設定時に `test.skip` 条件分岐 |
| Skipped スイート | **1 件**（idempotency suite のみ。modal-provider.test.tsx の file-level skip は OI-8 解消で解除） |
| テストファイル総数（ダッシュボード集計） | **245** / lcov エントリ **303** / マトリクス 18/80 セル (23%)。2026-09-03 実測（`bun run coverage:dashboard` → `found 240 test file(s)`。**lcov は 2026-08-11 ではなく 2026-09-03 の再測定値**で、068 の新規ソースを分母に含む。238 → 240 は 068 で新設した `tests/integration/category-tree-write.test.ts` と `tests/e2e/admin-category-tree.spec.ts`）。以下は 238 時点までの記録: **238** / lcov エントリ **303** / マトリクス 18/80 セル (23%)。2026-09-02 実測（`bun run coverage:dashboard` → `found 237 test file(s)`。plan 067 で新設した `src/lib/category-tree.test.ts` ほかを反映。**237 → 238 は本セッションの再生成で判明した未同期分**（走査対象のファイル自体は前セッションで追加済みで、237 の記載が実測より 1 件少なかった）。234 → 237 の 3 件は 067 の実装中コミットで追加され、ダッシュボード再生成が持ち越されていた分。lcov は 2026-08-11 の測定値のままなのでエントリ数・マトリクスは据え置き）。直前は **234**・2026-08-31 実測（plan 066 で `tests/integration/category-tree-migration.test.ts` を新設し 233 → 234）。直前は 233・2026-08-31 実測（`bun run coverage:dashboard` → `found 233 test file(s)`。lcov は 2026-08-11 の測定値のままなのでエントリ数・マトリクスは据え置き）。**232 → 233 は plan 054 の `tests/e2e/visual/product.spec.ts`**。直前: **232** / lcov エントリ **303** / マトリクス 18/80 セル (23%)。2026-08-23 実測（`bun run coverage:dashboard` → `found 232 test file(s)`。lcov は 2026-08-11 の測定値のままなのでエントリ数・マトリクスは据え置き）。**218 → 219 は plan 034 の `tests/integration/review-aggregation.test.ts`**。直前: **218**・同日実測。**217 → 218 は plan 041 の `tests/integration/coupon-code-uniqueness.test.ts`**。直前: **217**・同日実測。**216 → 217 は plan 010 の `src/lib/shipping-utils.test.ts`**。直前: **216**・2026-08-12 実測（`found 216 test file(s)`）。**215 → 216 は plan 055 の `tests/e2e/cart-login-handoff.spec.ts`**。直前: **215**・同日実測。**213 → 215 の +2 のうち plan 053 の成果は 1 件だけ** —— `tests/e2e/auth-surface.spec.ts`（+1）と、先行コミット `bda2df7a` の `src/app/(store)/browse/page.test.tsx`（+1・未同期分）。直前: **213**・2026-08-11 実測（`found 213 test file(s)`）。**212 → 213 は PR #173 対応の `tests/component/store/browse-pagination.test.tsx`**。直前: **212**（同日実測）。**211 → 212 は plan 050 の `tests/e2e/admin-store-status.spec.ts`**。直前: **211**（同日実測）。**210 → 211 は plan 048 の `tests/e2e/engagement.spec.ts`**。直前: **210**（同日実測）。**209 → 210 は plan 046 の成果ではない** —— +1 は `src/lib/db.test.ts`（Unit × Lib & Utils が 7 → 8）で、先行コミット `ce563985` の未同期分。plan 046 はテストファイルを追加していない（既存 `search-filter.spec.ts` の skip 解除のみ）。直前: **209**・2026-08-10 実測（`found 209 test file(s)`）。**204 → 209 はすべて未同期分の是正**で、本セッションでファイルは追加していない: plan 052 の a11y 3 spec（+3）と、コミット `879763a0` の `tests/component/store/{categories-menu,product-sort}.test.tsx`（+2）。直前: **204**・2026-08-09 実測（plan 045 の `tests/e2e/guest-flows.spec.ts` で +1）。直前: **203**・同日実測（同日 4 プランで +4: plan 033 `search-products.test.ts` / plan 036 `product-deletion.test.ts` / plan 037 `shipping-address-default.test.ts` / plan 040 `user-deletion-webhook.test.ts`。lcov は再測定していないためエントリ数・マトリクスは 2026-08-04 の値のまま）。直前: 199・2026-08-04 実測（plan 032 の `tests/integration/webhook-payment.test.ts` で +1）。直前: 198（plan 031 の `order-lifecycle.test.ts` で +1。ダッシュボード上の `testCount` は 8 で実測と一致）。その前: 197（plan 028 の `country.test.ts` で +1）。直前: 196・2026-08-03 実測（`bun run coverage:dashboard` → `docs/coverage-dashboard.html` の `matrix-data`）。lcov 由来の値（エントリ 302）も 2026-08-04 に `coverage/lcov.info` を測り直した後の再生成なので **2026-08-04 の測定値**（生成物の `generatedAt` は `2026-08-04T15:10:09.967Z`）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |

> **恒久メモ（Unit 行・Integration 行の到達点）**: Unit 行は `queries / pages / store / dashbd /
> shared / lib` が ✦、`api` は構造的 N/A（categorize 上 api-contract 固定・実カバーは API/Contract 行 ✦
> が担保）、`seed` は logic-centric 分母の意図的対象外（2026-05-31 確立）。Integration 行は
> testcontainers 実 PostgreSQL 基盤（ADR-004）+ `integration × queries` 分類（D1, `b57841a`）。
> 各到達の経緯・追加テスト一覧は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) の
> 2026-05-29〜06-02 エントリを参照（本ファイルの詳細セクションは 2026-07-10 に重複整理で削除）。

---

## フェーズ別実施状況

### ✅ Phase 1（基盤ロジック・ユーティリティ）— 完了

| ステップ | 対象 | ファイル | 状態 |
|---|---|---|---|
| 1-1 | middleware.ts | `src/middleware.test.ts` | ✅ 完了 |
| 1-2 | country.ts | `src/lib/country.test.ts` | ✅ 完了 |
| 1-3 | sanitize.ts | `src/utils/sanitize.test.ts` | ✅ 完了 |
| 1-4a | useIsMobile | `src/hooks/use-mobile.test.tsx` | ✅ 完了 |
| 1-4b | useToast reducer | `src/hooks/use-toast.test.ts` | ✅ 完了 |
| 1-4c | useFromStore | `src/hooks/useFromStore.test.tsx` | ✅ 完了 |
| 1-5 | modal-provider | `src/providers/modal-provider.test.tsx` | ✅ 完了 |
| 1-6 | utils.ts (cn + DOM) | `src/lib/utils.test.ts` / `tests/component/utils-dom.test.ts` | ✅ 完了 |

### ✅ Phase 2（UI コンポーネント）— 完了

| ステップ | 対象コンポーネント | ファイル | 状態 |
|---|---|---|---|
| Step 10 | ステータスタグ群 | `tests/component/shared/status-tags.test.tsx` | ✅ 完了 |
| Step 11 | ProductPrice | `tests/component/store/product-price.test.tsx` | ✅ 完了 |
| Step 12 | ProductShippingFee | `tests/component/store/shipping-fee.test.tsx` | ✅ 完了（2026-03-23） |
| Step 13 | SizeSelector | `tests/component/store/size-selector.test.tsx` | ✅ 完了 |
| Step 14 | QuantitySelector | `tests/component/store/quantity-selector.test.tsx` | ✅ 完了 |
| Step 15 | CartProduct | `tests/component/store/cart-product.test.tsx` | ✅ 完了 |
| Step 16 | ApplyCouponForm | `tests/component/store/apply-coupon-form.test.tsx` | ✅ 完了 |
| Step 17 | PlaceOrderCard | `tests/component/store/place-order-card.test.tsx` | ✅ 完了 |
| Step 18 | OrderStatusSelect | `tests/component/dashboard/order-status-select.test.tsx` | ✅ 完了 |
| Step 19 | ProductStatusSelect | `tests/component/dashboard/product-status-select.test.tsx` | ✅ 完了 |
| Step 20 | StoreStatusSelect | `tests/component/dashboard/store-status-select.test.tsx` | ✅ 完了 |
| Step 21 | CountrySelector | `tests/component/shared/country-selector.test.tsx` | ✅ 完了 |
| F1-1 | StatsCards (admin dashboard) | `tests/component/dashboard/admin/stats-cards.test.tsx` | ✅ 完了 |
| F1-2 | RecentOrders (admin dashboard) | `tests/component/dashboard/admin/recent-orders.test.tsx` | ✅ 完了 |
| F1-3 | SalesChart (admin dashboard) | `tests/component/dashboard/admin/sales-chart.test.tsx` | ✅ 完了 |
| F1-4 | RecentStores (admin dashboard) | `tests/component/dashboard/admin/recent-stores.test.tsx` | ✅ 完了 |

### ⚠️ Phase 3（E2E テスト）— スケルトン完了・一部保留

| ステップ | ファイル | 状態 | 備考 |
|---|---|---|---|
| Step 22 | `tests/e2e/purchase-flow.spec.ts` | ✅ 8/8 テスト | 「複数バリアント追加」を 2026-05-22 に追加（OI-2 解消） |
| Step 23 | `tests/e2e/seller-onboarding.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 24 | `tests/e2e/payment-error.spec.ts` | ✅ 2/4 テスト実行（残 2 は機能未実装 skip） | 実行は seed:e2e 前提。2026-08-03 plan 047 で「住所未選択 → エラー表示」を un-skip（Clerk 認証セッションは `createCustomerSession` で解決） |
| Step 25 | `tests/e2e/search-filter.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 26 | `tests/e2e/mobile-responsive.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |

### ✅ A1（認可テスト横展開）— 完了（2026-05-21）

- `docs/testing/SECURITY_GAP_REPORT.md` で 14 ファイルの認可カバレッジを調査・記録
- `review.test.ts` に IDOR レグレッションテストを追加
- `paypal.ts` / `stripe.ts` の IDOR 脆弱性（orderId 所有権チェック欠落）を修正 → テスト有効化
- 参照コミット: `55c07b1`, `03a7e89`, `37754d9`, `217bf76`

### ✅ A4（認可ガード統合 + IDOR テスト 3 階層化）— 完了（2026-05-24）

- **認可ガード統合 (`src/lib/auth-guards.ts`)**: `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` を導入し、`category` / `subCategory` / `offer-tag` / `coupon` / `product` / `store` の各 Server Action からインライン認可チェックを撤去。エラーメッセージを SSOT 化（"Forbidden: store not owned by current user." 等）。
- **CSRF 防御方針 (ADR 001)**: Next.js 16 Server Actions の Origin/Host 検証 + Clerk SameSite=Lax Cookie に依拠する方針を採択。明示的トークン実装は導入しない。`specs/multi-vendor-ecommerce/06-quality.md` / `.claude/steering/tech.md` に明文化。
- **IDOR テスト 3 階層化**: 既存の「(a) スロー検証」に加え、「(b) `where: { url, userId }` 構造検証」「(c) ガード失敗時の副作用なし検証（下流の `upsert` / `create` / `delete` / `findMany` 非呼び出し）」を 8 件追加 (`product.test.ts` +4 / `coupon.test.ts` +1 / `store.test.ts` +3)。
- 参照コミット: `a73603e` 〜 `eae2cfe`

### ✅ A2（Visual Regression MVP）— 完了（2026-05-22）

- `tests/e2e/visual/cart.spec.ts` / `checkout.spec.ts` を追加（chromium 限定）
- `playwright.config.ts` に `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を追加
- baseline スクリーンショット 3 枚をコミット済み（`688225f`）
  - `cart.spec.ts-snapshots/cart-empty-chromium-darwin.png`
  - `cart.spec.ts-snapshots/cart-with-item-chromium-darwin.png`
  - `checkout.spec.ts-snapshots/checkout-redirect-signin-chromium-darwin.png`
- ⚠️ **CI（Linux）では `-linux.png` baseline が別途必要**（詳細は `specs/multi-vendor-ecommerce/07-testing.md §Visual Regression`）
- 参照コミット: `f639334`, `688225f`

### ✅ A3（a11y MVP）— 完了（2026-05-21）

- `tests/e2e/a11y/sign-in.spec.ts` / `seller-apply.spec.ts` を追加
- `@axe-core/playwright` で WCAG 2.1 AA スキャン
- 参照コミット: `d261d76`

---

## 残課題・Open Issues

### 🔴 現在アクティブな残課題（優先度順・2026-07-30 時点） {#active-open-issues}

> 解消済み OI（OI-1〜OI-9）は下表に取り消し線付きで監査証跡として残す。**着手すべきは以下 3 件（OI-11 / OI-10 / C2）。**

| 優先 | ID | 課題 | 期限 / 状態 | 次の一手 |
|---|---|---|---|---|
| ~~1~~ | ~~**OI-9**~~ | ~~ホーム `/` が SSR で 500（`featured.tsx` の `window` 初期化子参照）~~ | ✅ **解消済み（2026-06-06 / `c196e3d5`）** | 実装は `useState<number>(1200)` の安全な既定値 + `useEffect` での実測反映済み（`featured.tsx:19,30`）。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass。**次の一手は D2** — `.lighthouserc.json` / `lhci.yml` の計測 URL へ `/` を追加できる状態になった。 |
| **1（最優先）** | **OI-11** | `/dashboard/seller` 系ルートが本番 SSR で `ReferenceError: self is not defined`（`next-cloudinary` の `CldUploadWidget` をサーバ評価）。OI-9 と同族の client-only ref 問題。現状テストは落ちていない（ログのみ）が本番でも再現の可能性 | 🟡 未着手 | `image-upload.tsx` の `CldUploadWidget` を `next/dynamic` の `ssr:false` で遅延 import する。発見: 2026-06-19（E2E 本番ビルド化で顕在化） |
| 2 | **OI-10** | a11y `color-contrast` 負債: `/checkout`・`/profile`・`/seller/apply` でグレー/ブルー系テキストが 4.5:1 未満。E2E では `runA11yScan` の `disabledRules:["color-contrast"]` で抑制中（追跡のため意図的） | 🟢 低 | 配色（テキスト色）を是正して `disabledRules` を解除する。発見: 2026-06-19（a11y readiness 修正で axe 到達後に検出） |
| 3 | **OI-12** | E2E のローカル Firefox 実行で navigation が hang する（dev サーバの HMR 起因と推定）。`tests/e2e/profile.spec.ts`（住所追加 / 注文履歴）と `tests/e2e/mobile-responsive.spec.ts` の計 3 件を `testInfo.project.name === "firefox" && !process.env.CI` で skip 中。**CI は本番ビルドで実行されるため skip されず**、3 ブラウザのカバレッジは CI 側で維持されている | 🟢 低 / 🟡 未着手（**見直し期限: 2026-10-31**） | **解消条件**: ローカル dev サーバ（`bun run dev`）で当該 3 件が Firefox 連続 2 回 pass すること。**次の一手**: dev の Turbopack HMR クライアントが Firefox で navigation を保留させているかを `PWDEBUG=1` + `--project=firefox` で切り分け、再現したら `webServer` を本番ビルド（`next build && next start`）へ寄せる案を検討する。発見: 2026-08-23（plan 049 / TESTS-37） |
| 4 | **C2** | Bundle Size の継続監視 | 🟢 低 | `@next/bundle-analyzer + size-limit` で初期 JS の閾値超過を CI 警告（下記 C2 プロンプト参照）。 |

> ✅ **OI-8 完了（2026-06-14）**: CI flake の真因は `src/queries/size.test.ts` の `@/lib/db` 未モックによる実 Prisma 接続リーク（stub DB へ P1001 → jest-circus が別ファイルへ「本文空」失敗を帰属）。`size.test.ts` に `jest.mock("@/lib/db")` を追加して根絶（`83ef06c`）→ 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`、1272→1281 / skip 12→3）。CI push/pull_request 両 event × 2 サイクル緑・stub DB フルスイート P1001 = 0。詳細: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。
>
> ✅ **D1 完了（2026-06-02）**: ダッシュボード Integration 行の誤分類（`tests/integration/` が `unit × other` セルに分類）は `categorize.ts` 改修で恒久解消（commit `b57841a`）。`integration × queries` ◯→◐（lcov に同名ソース無しのため partial）。詳細: [`COVERAGE_REPORT.md §3 D1`](./COVERAGE_REPORT.md)。

---

### 📜 Open Issues 監査証跡（解消済み含む全履歴）

| # | 課題 | 優先度 | 備考 |
|---|---|---|---|
| ~~OI-1~~ | ~~Visual Regression baseline 未コミット~~ | ~~🔴 高~~ | ✅ 解消済み（`688225f`） |
| ~~OI-2~~ | ~~`purchase-flow.spec.ts` の「複数バリアント追加」1テスト保留~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/seed/constants.ts` に第2バリアント追加 + spec 追加） |
| ~~OI-3~~ | ~~`/checkout` / `/profile` の a11y spec 未追加~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/helpers/auth.ts` + `tests/e2e/a11y/{checkout,profile}.spec.ts`。`CLERK_SECRET_KEY` 未設定時は自動スキップ） |
| ~~OI-4~~ | ~~`.github/workflows/` CI 未整備~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`.github/workflows/ci.yml` に lint/test/build 3 並列ジョブ） |
| ~~OI-4a~~ | ~~CI で Visual Regression の `-linux.png` baseline 生成~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` に `workflow_dispatch` 起動の `visual-baselines` ジョブ追加。`gh workflow run ci.yml --ref <branch>` で起動 → 自動 PR） |
| ~~OI-5~~ | ~~E2E シード冪等性（CI 環境での `seed:e2e`）~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` の `seed-idempotency` ジョブで PG service container 起動 → seed 2回実行 → 行数 diff 検証） |
| ~~OI-6~~ | ~~`DashboardStats` コンポーネント調査未完了~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、調査結果: ソース・仕様ともに該当コンポーネントなし。`src/app/dashboard/{admin,seller}/.../page.tsx` はプレースホルダー、`specs/multi-vendor-ecommerce/04-interfaces.md` も「overview」と記載のみ。統計 UI 要件は将来の機能追加時に `specs/` で別途起票） |
| ~~OI-7~~ | ~~`coverage/lcov.info` が古い (2025-03-16 時点)~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、`/coverage` は `.gitignore:10` 対象で git 管理外。`bun run test -- --coverage` でローカル再生成 → `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を更新する運用を確認。CI でのカバレッジ自動化は [`COVERAGE_REPORT §3 B4`](./COVERAGE_REPORT.md#b4-ci-でのカバレッジ-artifact-化--dashboard-自動再生成) に移管 → **B4 完了（2026-06-03）**: `ci.yml` の `test` ジョブで `bun run coverage:dashboard` を実行し `docs/coverage-dashboard.html` を `coverage-dashboard` artifact 化。`generatedAt` の churn 回避のため自動コミットはせず artifact 化に限定） |
| ~~OI-9~~ | ~~**ホーム (`/`) が SSR で 500**: `featured.tsx` の `useState<number>(window.innerWidth)` が初期化子で `window` を参照し、`"use client"` でも SSR 実行時に `ReferenceError: window is not defined` を投げる~~。発見: 2026-05-30 (C1 検証中) | ✅ 解消済み（2026-06-06） | **修正**: `c196e3d5` が初期化子を安全な既定値 `useState<number>(1200)` に置き換え、`useEffect` で実測幅を反映する形にした（現行 `featured.tsx:19,30`）。ハイドレーション差分は `17dfa9f4` の `mounted` ゲートで併せて解消。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass し、SSR 200 を確認。**追跡漏れの経緯**: 修正から本行のクローズまで約 7 週間ドリフトしていた（`1fd0a9ef` で E2E の `/checkout` 404 を調査した際に発覚）。**残作業は D2 のみ** — `.lighthouserc.json` / `lhci.yml` の URL へ `/` を追加する。 |
| ~~OI-8~~ | ~~CI flake（本文空・ローカル緑/CI赤・失敗テストがランダム移動）~~。真因確定 + 解消 2026-06-14 | ✅ 解消済み（2026-06-14） | **真因確定（2026-06-14）**: `src/queries/size.test.ts` が `@/lib/db` をモックせず実 Prisma を `spyOn` していたため、CI の stub `DATABASE_URL` へバックグラウンド接続が `PrismaClientInitializationError`(P1001) で reject。その非同期 reject が同一ワーカーのプロセス境界をまたいでリークし、jest-circus が「その瞬間 current な別ファイルのテスト/フック」に `error` イベントとして帰属（P1001 の stack getter が空のためレポーターが本文を空に整形 → 「本文空」署名）。modal-provider / shipping-form / review-details はいずれも Prisma 非依存の**被害者**だった。**過去の仮説の誤り**: 仮説 A(isMounted)/B(MSW)/workflow 層はいずれも対症療法。`[FLAKE-DIAG:unhandledRejection]`(`0736735`) が沈黙したのは、真因が process の unhandledRejection ではなく jest-circus の `error` イベントだったため。**実観測手段**: 一時カスタム jsdom 環境の `handleTestEvent` で失敗イベントの生エラーを surface（`a93effe`、撤去 `756c6a9`）→ 3× P1001 を捕捉（失敗 push run `27487047124`）。**修正**: `size.test.ts` に `jest.mock("@/lib/db")` 追加（`83ef06c`）。stub DB のフルスイートで P1001 が 6+→0、review-details は CI push/PR 両 event × 2 サイクル緑で確認。**完了（2026-06-14）**: 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`）→ CI push/pull_request 両 event 2 サイクル緑 → `spec-sync-after-test`（passed 1272→1281 / skip 12→3）。手順全文（アーカイブ）: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。 |

---

## 次回セッション 推奨着手順

> **このファイルが即時 TODO の Single Source of Truth。**
> 中長期タスク（B1〜C2）の戦略的背景は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。

### ✅ 完了

全ての優先 OI（OI-2 / OI-3 / OI-4 / OI-4a / OI-5）は 2026-05-22 に解消済み。
**B1（shadcn/ui プリミティブ Snapshot）** は 2026-05-23 に MVP 9 プリミティブ分を完了（40 snapshot）。
**A4（認可ガード統合 + IDOR 3 階層化）** は 2026-05-24 に完了（テスト総数 990 → 1016、+26 件）。**A4 残課題 `getStoreOrders` 統合** は 2026-05-26 にクローズ（`70f5b94`、テスト総数 1015 → 1016 / +1）。
**B1+ Sprint 1（Tier 1 前半 10 プリミティブ）** は 2026-05-26 に完了（`b55e177`〜`66fb8d5`、テスト総数 1016 → 1042 / +26、snapshot 40 → 66 / +26）。
**B1+ Sprint 2（Tier 1 後半 11 プリミティブ）** は 2026-05-28 に完了（`750d830`〜`45c339b`、テスト総数 1042 → 1069 / +27、snapshot 66 → 93 / +27）。
**B1+ Sprint 3（Tier 2 全 8 プリミティブ）** は 2026-05-28 に完了（`e6c79e3`〜`4429b8b`、テスト総数 1069 → 1088 / +19、snapshot 93 → 112 / +19）。
**B1+ Sprint 4（Tier 3 + 補助 全 11 プリミティブ）** は 2026-05-28 に完了（`1b207ba`〜`8e429f2`、テスト総数 1088 → 1103 / +15、snapshot 112 → 127 / +15）。**B1+ 全完了**：49/49 shadcn/ui プリミティブが snapshot テストでカバーされ、NA-NS-01 をアーカイブ化。

### 残課題

- 現在、アクティブな残課題は **OI-11 / OI-10 / C2** の 3 件です（優先度・次の一手は[アクティブな残課題テーブル](#active-open-issues)を SSOT として参照）。**OI-9（ホーム `/` の SSR 500）は 2026-06-06 に解消済み**（`c196e3d5`。2026-07-26 に E2E 実測でクローズ確認）。**OI-8（CI flake）は 2026-06-14 に解消済み**（真因 = `size.test.ts` の Prisma 接続リーク `83ef06c` + modal-provider un-skip `49fa32d`。経緯: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)）。
- 中長期タスクは [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) の B / C グループに集約。

### 🟢 中長期（COVERAGE_REPORT §3 B/C グループ）

- ~~**B1** shadcn/ui プリミティブの Snapshot~~ ✅ MVP 完了（2026-05-23、9 プリミティブ / 40 snapshot）
- ~~**B1+** shadcn/ui プリミティブ Snapshot 拡張~~ ✅ **全完了（2026-05-28）**。Sprint 1 (Tier 1 前半 10) + Sprint 2 (Tier 1 後半 11) + Sprint 3 (Tier 2 全 8) + Sprint 4 (Tier 3 + 補助 全 11) で **49/49 プリミティブ・127 snapshot**。NA-NS-01 をアーカイブ化
- ~~**B2** Stripe / PayPal Webhook の Contract テスト拡充~~ ✅ **完了（2026-05-28）**。`/api/webhooks/stripe` / `/api/webhooks/paypal` ハンドラーを新規実装し、payment_intent.succeeded/failed/charge.refunded と PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED を冪等処理。30 ケース + metadata 検証 2 ケースで網羅
- ~~**B3** Cart → Checkout の Integration テスト~~ ✅ **完了（2026-05-29）**。`tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テストを実装：Zustand persist hydration（2）/ shipping fee 一貫性 ITEM/WEIGHT/FIXED（3）/ クーポン適用（5 正常+異常）/ 未認証リダイレクト（1）。基盤として testcontainers PostgreSQL + 専用 jest config を新設（ADR-004）
- ~~**C1** Lighthouse CI（パフォーマンス予算化）~~ ✅ **完了（2026-05-30）**。`.github/workflows/lhci.yml` + `.lighthouserc.json` を新設し、`@lhci/cli` で `/browse` の LCP/CLS/TBT を計測（warn-only ベースライン）。Clerk は pk_live ダミーで dev handshake を回避。ホーム `/` は OI-9（featured.tsx SSR window バグ）で除外
- **C2** Bundle Size 継続監視（🟢 低）
- ~~**D1** ダッシュボード `categorize.ts` 改修：`tests/integration/` を Integration 行へ正しく分類~~ ✅ **完了（2026-06-02）**。`unit × other` 誤分類を恒久解消し `integration × queries` ◯→◐（commit `b57841a`）
- **D2** Performance 行の着手（🟡 中 / cost S）：**前提だった OI-9 は解消済み**（2026-06-06 `c196e3d5` / 2026-07-26 実測確認）。lhci 計測 URL に `/` を追加 → warn→error 化で予算厳格化。**着手可能**
- ~~**R4** テストギャップ解消~~ ✅ **完了（2026-08-23）**。**030 の完了で R4 全 5 プランが閉じ切った**（`13d3dd70`〜`2a04e331`）。improve Round 4 監査（2026-07-10）の実行プラン **plans/026〜030**（paypal エラー分岐 / placeOrder オーバーセル+PLATFORM 端数統合 / country.ts 新設 / profile.ts catch 分岐 / money-path コンポーネント 6 本）。進捗は [`plans/README.md`](../../plans/README.md) の status 列が SSOT。着手プロンプトは本ファイル「次回着手用 依頼プロンプト」R4 を参照

詳細は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。D2 の着手プロンプトは本ファイル「次回着手用 依頼プロンプト」を参照。

---

## 主要コミット履歴

> 2026-07-10 整理: 旧「主要コミット履歴（2026-05-21〜28）」テーブル（62 行）は
> [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) と重複していたため削除。
> コミット単位の履歴は §7（日付・コミットハッシュ付き）と `git log` を参照。

---

## 次回着手用 依頼プロンプト

> **使い方**: 新しいセッションを開いて以下の **コードブロック内の文字列をそのままコピペ** すれば、文脈再構築なしに該当タスクへ着手できます。
> プロンプトは `coverage-dashboard.html §03 Next Actions` (= `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS`) と一対一で対応しています。
> **更新規約**: タスクを完了したら、対応するプロンプトをこのセクションから削除し、`render-html.ts` の `NEXT_ACTIONS` からも同時に削除する（SSOT 二重管理を防ぐ）。新規タスクを追加する場合は両方に同時追加する。

### 🔴 Immediate (high)

<!--
067-B（カテゴリツリー Phase B の残作業）✅ 完了 2026-09-02: `d7769375`〜`0ed9502a`。
- footer リンクを Category ツリー由来の正準 slug へ（`d7769375`）。旧 SubCategory.url を
  そのまま ?category= に載せ替えるのは不可（移行でリネームされた slug は CATEGORY 別名で
  解決できず 0 件）なので、データ源ごとツリーへ移した。`home/category-card.tsx` は home.ts の
  legacy 経路（067 スコープ外）なので ?subCategory= のまま据え置き。
- 統合 V-1 / V-6 / 3 階層（`171ac4fa`）+ dual-write（`c094f7d4`）。dual-write は
  upsertProduct のフィクスチャがある product-update.test.ts に置いた（browse へ置くと
  約 80 行の重複になるため）。
- E2E V-2（`0ed9502a`）。E2E シードに CategorySlugAlias を 1 行追加し、別名表を引く経路
  （= 外部被リンクの生存経路）を実際に通している。
詳細は COVERAGE_REPORT.md §7 履歴 / plans/README.md の 067 行。
-->

#### 068 の残作業（次セッションの最優先）— カテゴリツリー admin 統合の仕上げ

plan 068 は **Step 1–9（admin ツリー統合・リーフ強制・深さ/循環）まで実装済み**。
**Step 5 以降の Phase C（不可逆）は未着手**。着手前に要るのは**オペレーター承認のみ**で、
067 の再同期マイグレーションは実 DB へ適用済みであることを確認した（下の 067-B 参照）。

次セッションで着手する順:

1. ✅ **E2E `tests/e2e/admin-category-tree.spec.ts` は緑（2026-09-03・`9034f300`）。**
   `524ba258` の未検証状態を解消した。実行して初めて分かった **spec 側の欠陥 3 件**:
   (a) フィクスチャがスキーマ違反 —— `CategoryFormSchema.name` は `^[a-zA-Z0-9\s]+$` で
   ハイフンを弾くのに、`url` 用の `Date.now()-乱数` をそのまま name にも流していた。
   (b) クライアントマウント前に fill していたため react-hook-form の空 defaultValues が
   値を巻き戻した（`ImageUpload` が `isMounted` まで `null` を返す性質をマウント検知に使う）。
   (c) Radix Select がポータルを作り直すため option クリックが間欠的に detached になった。
   いずれも**症状は `waitForURL` のタイムアウト**として現れ、原因から遠い所で落ちていたので、
   送信直前に入力値を検算する assert を足してある。**実装側の欠陥は無かった**。

   **3 ブラウザすべてで緑を実測した（2026-09-03）。** firefox 7.9s / webkit 12.7s、
   **リトライ発生なし・flaky 0**（`retries=2` を有効にしたまま実行しており、再試行で
   通ったケースは Playwright が `flaky` として別集計するので、この 0 は「1 回目で通った」
   ことの証明になる）。**spec の追加修正は不要**で、`tests/e2e/**` も `src/` も無変更。

   ```bash
   # :3000 は他リポジトリのアプリが掴んでいることがある（reuseExistingServer は
   # ポート応答しか見ない）。専用ポートで走らせること。
   # scripts/e2e/run-local.sh が PORT=3100 + E2E_NO_REUSE=1 + ローカル Postgres +
   # migrate deploy + seed:e2e + retries=2 をまとめて面倒を見る。
   bun run test:e2e:local -- tests/e2e/admin-category-tree.spec.ts \
     --project=firefox --project=webkit
   ```

   **エンジン差で落ちなかった理由**: (b)(c) の修正は「タイムアウトを延ばす」ではなく
   **待機条件そのものを状態ベースにした**もの —— `ImageUpload` の attach は「React が
   マウントを終えた」事実を、`toPass` は「トリガーに値が反映された」結果を見ている。
   時間ではなく状態を待つ assert はエンジンの速度差に対して原理的に頑健で、webkit が
   firefox の 1.6 倍遅くても両方通った。**同種の spec を書くときはこの形に倣うこと。**

   > **既知のログノイズ（テスト結果には影響しない）**: フィクスチャが使う偽 Cloudinary
   > URL に対して `upstream image response failed … 404` が WebServer ログへ多数出る。
   > DOM は生成され spec は画像を assert していないため無害だが、**このログを見て
   > 「画像が壊れている」と誤読しないこと**。

2. ✅ **ドキュメント同期は完了（2026-09-03）**。`07-testing.md` / `COVERAGE_REPORT.md` /
   `docs/PROGRESS.md` への統計伝播と `bun run coverage:dashboard` による再生成を実施済み。
   lcov も 2026-09-03 に取り直した（従来は 2026-08-11 の値を引きずっていた）。

3. **Phase C（Step 5–7）**。`categoryNodeId` 必須化 → 旧 2 列 drop →
   `categoryId` へ rename → `SubCategory` drop → `subCategory.ts` の互換 re-export 削除。
   **不可逆**なので承認必須。

**Phase B の制約として実装に入れた点（Phase C で解消する）**: 商品を紐づけられるのは
**depth 1 のリーフだけ**。depth 0（ルート）と depth 2 以上のノードには legacy
`SubCategory` 行が無く、NOT NULL の `Product.subCategoryId` を満たせないため、
`isProductAssignableCategory`（UI の選択可否）と `assertLeafCategoryNode`（サーバー側の強制）の
両方で塞いである。**3 階層目は admin で「作れるが商品は付けられない」状態**である。

**本セッションで見つけて直した実バグ 1 件**: `deleteCategory` が親の `childCount` を
減らしていなかった（`366a2951`）。068 で `childCount` がリーフ強制の判定材料になったため、
放置するとリーフを 1 つ消した親には**二度と商品を紐づけられなくなる**（導出列なので
admin フォームからは復旧できない）。

#### 067-B: Phase B 再同期マイグレーションの実 DB 適用 — ✅ 解消（2026-09-03 確認）

**この項の「BLOCKED」は 2026-09-03 の実測で否定された。** `_prisma_migrations` を直接引くと
`20260901223148_category_tree_phase_b_resync` は **`finished_at` = 2026-09-02T03:03:00Z /
`rolled_back_at` = NULL / `applied_steps_count` = 1** で適用済みであり、
`bunx prisma migrate status` も Neon に対し「17 migrations found / Database schema is up to date」
と応答する。前セッションが記録した「`migrate deploy` が権限で拒否」は、その時点の一時的な失敗を
恒久的な BLOCKED として書き残したものと見られる。**Phase C の前提条件としてはクリア**である。

```bash
# 確認に使ったクエリ（DIRECT_URL 経由・読み取りのみ）
select migration_name, finished_at, rolled_back_at, applied_steps_count
  from _prisma_migrations order by started_at desc limit 4;
```

`Product.categoryNodeId IS NULL` は **0 件 / 全 105 行**（2026-09-03 実測）。
読み取り切替の前提は現データでも満たされている。

**したがって Phase C に残る唯一のゲートはオペレーター承認**（plan 068 の STOP condition:
「plan 067 の状態で本番相当の実測期間を置いたこと」の確認）である。この確認は未取得なので、
**Step 5 へは進んでいない**。

（A4 残課題 `getStoreOrders` 統合は `70f5b94` でクローズ済み）

### 🟡 Next Sprint (medium)

<!-- NA-NS-01 (B1+ shadcn/ui Snapshot 拡張) ✅ 完了 2026-05-28: 49/49 プリミティブ / 127 snapshot。詳細: B1_SNAPSHOT_EXPANSION_PLAN.md / COVERAGE_REPORT.md §7 -->
<!-- NA-NS-02 (B2: Stripe/PayPal Webhook Contract テスト) ✅ 完了 2026-05-28: 30+2 ケース。コミット 338ab41 / 1d69f0f / 2321cd8 -->
<!-- NA-NS-03 (B3: Cart → Checkout Integration テスト) ✅ 完了 2026-05-29: 4 シナリオ / 11 テスト。ADR-004 参照 -->
<!-- D1 (categorize.ts 改修 / Integration 行実体化) ✅ 完了 2026-06-02: commit b57841a。詳細: COVERAGE_REPORT.md §3 D1 -->

#### A11y-home: home（`/`）の a11y spec 追加（052 の残り 1 ページ）

plan 052 が a11y スキャン下に置いたのは **browse・商品詳細・cart の 3 ページのみ**で、
home は上記のドリフト（「OI-9 で対象外」は誤り）により未着手のまま残っている。
R9 の残プラン（054）とは独立した単独タスクとして扱う。

```text
tests/e2e/a11y/home.spec.ts を新規作成し、home（/）の WCAG 2.1 AA スキャンを追加してください。

方針:
1. tests/e2e/a11y/browse.spec.ts を雛形にする（runA11yScan / chromium 限定の test.skip）。
2. readinessLocator は home の SSR 済み要素を 1 つ選ぶ（seed 依存を増やさない）。
3. color-contrast は既知負債 OI-10 なので disabledRules で抑制し、TODO(OI-10) を明記する。
4. 初回スキャンで実違反が出た場合は勝手に src/ を直さず STOP して報告する
   （052 では critical 3 種 / serious 2 種が出た）。

完了条件:
1. bunx playwright test tests/e2e/a11y/home.spec.ts --project=chromium がグリーン。
2. spec-sync-after-test skill で docs 同期（別コミット）。
3. render-html.ts の NEXT_ACTIONS から本エントリを削除し、本プロンプトも削除（二重 SSOT 同期）。
```

#### D2: Performance 行の着手（lhci の計測 URL に `/` を追加）

```text
ヒートマップ Performance 0% 行を前進させるため、Lighthouse CI の計測対象に / を追加してください。

背景:
- C1（Lighthouse CI）は 2026-05-30 に完了済みだが、ホーム / は OI-9（featured.tsx の SSR window
  参照バグで 500）のため計測対象から除外され、暫定的に /browse のみを計測している。
- その OI-9 は 2026-06-06 に解消済み（c196e3d5 が初期化子を安全な既定値へ置換）。
  2026-07-26 に security-headers.spec.ts の / が 3 ブラウザとも status < 400 で pass することを
  実測し、SSR 200 を確認済み。したがってコード修正は不要で、計測 URL の追加から着手できる。

実装方針:
1. .lighthouserc.json / .github/workflows/lhci.yml の collect URL に / を追加する。
2. 数回ベースライン観測後、.lighthouserc.json の assertion を warn → error 化して予算を厳格化（別 PR 可）。

完了条件:
1. lhci が / を計測（CI グリーン）、bunx tsc --noEmit / bun run lint グリーン。
2. render-html.ts の NEXT_ACTIONS から D2 を削除し、本プロンプトも削除（二重 SSOT 同期）。
3. COVERAGE_REPORT.md §2/§3 を更新（Performance 行の状態変化を反映）。

参考:
- OI-9 のクローズ記録: docs/testing/QA_HANDOFF.md「解消済み OI」OI-9 行
- 先行例: .github/workflows/lhci.yml + .lighthouserc.json（C1）
- コミット規約: .claude/rules/02-tdd-step-commit.md
```

#### OI-11: seller ルートの本番 SSR クラッシュ修正

```text
/dashboard/seller 系ルートが本番 SSR で ReferenceError: self is not defined を投げる問題
（OI-11）を修正してください。next-cloudinary の CldUploadWidget がサーバ評価される client-only
コンポーネントであることが原因です（OI-9 と同族）。

実装方針:
1. image-upload.tsx の CldUploadWidget を next/dynamic の { ssr: false } で遅延 import する。
2. 本番ビルド（next build → next start）で /dashboard/seller 系が SSR 200 を返すことを確認。

完了条件:
1. seller ルートが本番 SSR で 200、OI-11 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. bunx tsc --noEmit / bun run lint グリーン。
3. render-html.ts の NEXT_ACTIONS から OI-11 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-11 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-11 行
- 同族先行例: OI-9（featured.tsx の SSR window 参照）
```

### 🟢 Mid–Long Term (low)

SaaS ロードマップ範囲 (docs/architecture/saas-roadmap.md) で別ストリーム扱い。

#### OI-10: a11y color-contrast 負債の是正

```text
/checkout・/profile・/seller/apply のグレー/ブルー系テキストが WCAG 2.1 AA の 4.5:1 を
満たさない a11y 負債（OI-10）を是正してください。現在 E2E では runA11yScan の
disabledRules:["color-contrast"] で追跡のため意図的に抑制中です。

実装方針:
1. 対象ページのテキスト色を 4.5:1 以上を満たす配色へ是正する。
2. runA11yScan の disabledRules から "color-contrast" を解除する。

完了条件:
1. axe color-contrast 違反ゼロ、OI-10 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. E2E a11y spec グリーン（disabledRules 解除後）。
3. render-html.ts の NEXT_ACTIONS から OI-10 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-10 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-10 行
```

<!--
C1 (Lighthouse CI でパフォーマンス予算化) は 2026-05-30 に完了済み。
- 結果: .github/workflows/lhci.yml + .lighthouserc.json を新設、@lhci/cli で /browse の
  LCP/CLS/TBT を計測 (warn-only ベースライン)。
- Clerk 回避: pk_test ダミーは dev handshake (偽 FAPI) で collect 400。本番形式の
  pk_live ダミー (+ sk_live ダミー) で handshake を回避 (ローカルで /browse → 200 実証)。
- ホーム / は OI-9 (featured.tsx の SSR window バグ) で 500 のため URL から除外。修正後に追加。
- scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS からも削除済み。
- フォローアップ: 数回のベースライン観測後に .lighthouserc.json を warn → error 化して予算を厳格化。
-->

#### C2: Bundle Size の継続監視 (`.github/workflows/bundle.yml`)

```text
依存追加による初期 JS バンドルの肥大化を PR で検知するため、Bundle Size 継続監視を導入してください。

背景:
- C1 (Lighthouse CI) は 2026-05-30 に完了済み (.github/workflows/lhci.yml + .lighthouserc.json)。
  C2 は同じ "パフォーマンス退行を PR で検知する" ストリームの 2 件目 (COVERAGE_REPORT.md §3)。
- 目的: @next/bundle-analyzer + size-limit で初期ロード JS の閾値超過を CI で警告する。
- コスト感: S (lhci 比で軽量。サーバー起動・DB seed 不要)。

実装方針:
1. devDependencies に size-limit + @size-limit/file (または @size-limit/preset-app) を追加。
2. .size-limit.json を新設し、.next/static/chunks の主要バンドル (app shell / framework) に
   閾値 (例: gzip 後 KB) を設定。初期は warn 相当の緩い閾値でベースライン観測。
3. .github/workflows/bundle.yml を新設:
   - on: pull_request [main, dev] + workflow_dispatch
   - permissions: contents: read / concurrency: bundle-${{ github.ref }}
   - third-party action は SHA ピン + バージョンコメント (01-engineering-standards.md)。
     postgres service は不要 (bundle はビルド成果物のサイズのみ計測)。
   - steps: checkout → setup-bun (1.3.14) → bun install --frozen-lockfile →
     bunx prisma generate → bun run build → bunx size-limit
   - env: ci.yml と同じ stub 群 (DATABASE_URL は build 時の force-dynamic 回避用 stub で可)。
4. ビルドが DB に到達しないことを確認 (force-dynamic ページは build 時クエリを実行しないが、
   念のため lhci と同様 stub DATABASE_URL を渡す)。

完了条件:
1. .github/workflows/bundle.yml + .size-limit.json + package.json/lockfile をコミット。
2. bunx tsc --noEmit エラーゼロ、bun run lint グリーン。
3. scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS から C2 を削除。
4. 本セクション (QA_HANDOFF.md C2 プロンプト) を削除し、COVERAGE_REPORT.md §3 に
   C2 完了アーカイブ行を追加 (完了日 + commit hash)。
5. docs/coverage-dashboard.html を bun run coverage:dashboard で再生成。
6. docs/PROGRESS.md の「次アクション」を更新 (C シリーズ完了)。

参考:
- 先行例: .github/workflows/lhci.yml (C1。トリガー/ピン/concurrency/env のパターン)
- コミット規約: .claude/rules/02-tdd-step-commit.md (実装とドキュメント同期は別コミット)
- ドキュメント配置: .claude/steering/documentation-guide.md
```

---

*Stay Red, Go Green, and Refactor rigorously.*
