# QA & Test Implementation Handoff（次回セッションへの引き継ぎ）

> **最終更新**: 2026-10-04 / **HEAD**: `65f9f3c0`（**PR #187 レビュー対応（続き）** —— HEAD 上の作業ツリー分・コミット前: 同一商品へのバリアント並行追加で Product 行ロックを子の書き込み後に取っていたためデッドロックしていた件を、`lockProductRow` を tx 先頭（`lockAttributeCategoryPath` 直後）へ移して修正（Integration +1）。`?attr.=x` の空キーを捨てて全件表示に化けていた件を `parseProductFilters` で invalid にさせる修正（Jest +1）。サジェストの画像仕様・FS-CHIPS の範囲・残課題見出し日付を整合。以下は 86b9c786 時点の記録: （**PR #187 レビュー対応** —— HEAD 上の作業ツリー分・コミット前: `buildPrefixTsQuery` が `2.5` を `2 & 5:*` に割って `to_tsvector` の lexeme `'2.5'` に一致しなかった不具合を修正（小数・バージョン表記を 1 語に）。`search-query.test.ts` +2。plan 074 の導出 SQL・デプロイ時のロック、plans/README の commit 範囲、統計見出しの実測日を整合。以下は 3277d8a5 時点の記録: （**ファセット検索 plans 073〜076 の実装** —— HEAD 上の作業ツリー分・コミット前: ヘッダー検索サジェストの復旧（`?search=`/`?q=` の食い違い）と並び順の `id` tie-breaker（073）、重み付き検索ベクトル列 `searchVector` + `searchKeywords`（074・ADR-008 Accepted）、`getProducts` の生 SQL 一本化・`filters: any` 撤去・前方一致 tsquery（075）、`minPrice` による全件の価格ソートと属性ファセット（076）。マイグレーション 4 本（ローカル適用済み・リモート未適用）。Jest +34 / スイート +3、Integration +35、E2E +1/browser。以下は 42a872c3 時点の記録: （**プロフィール住所の失敗ログ（レビュー対応）** —— HEAD 上の作業ツリー分・コミット前: `user.ts` の `getProfileShippingAddresses` / `saveProfileShippingAddress` / `makeProfileShippingAddressDefault` が `catch {}` で原因を捨てていたため、`[User:<関数名>]` の構造化ログを追加（利用者向けの汎用メッセージは不変）。`profile-addresses.test.ts` +6。前回同期（`632c356e`）以降の Profile 移行コミットで未同期だった件数もあわせて全体実測で更新。以下は 632c356e 時点の記録: **開発時コンソール警告の解消（plan 072）** —— HEAD 上の作業ツリー分・コミット前: Clerk の `createRouteMatcher` 非推奨化に合わせ、`src/proxy.ts` のパスマッチ保護を撤去し `/profile/*` は `profile/layout.tsx` の `auth()` + `redirectToSignIn()` で保護（`/dashboard/*`・`/checkout` は既存のリソース側検証）。`UserButton` のアバター寸法を構造依存 CSS から `appearance.elements` へ、`html { position: relative }` で framer-motion の警告を解消。テスト +3・スイート +1。以下は従前の記録: **商品詳細ページのデザイン刷新（PR#181）のレビュー・SonarCloud 対応** —— HEAD 上の作業ツリー分・コミット前: `d3e87f64` の刷新で CSS Module 化された価格・サイズ選択・配送料の各テストを ARIA / 表示テキスト検証へ移行（`59b97659`）。レビュー指摘でナビ用クエリ失敗時の縮退・グリッドの代表画像フォールバック〔`/no_image` のギャラリー画像も欠落扱い〕・コピー失敗通知と `<output>` の live region（`253c8ccc`）、全サイズ在庫切れ時の選択ヒント差し替え・`maxQty` を現在在庫基準に修正・FIXED 配送の数量行削除。Sonar の New Code 未解決 18 件を解消〔ライトボックスの到達不能な背景クリックを外しネイティブ `<dialog>` 化で Reliability 3 件、認知的複雑度、`role=region` → `<section>`、仕様表 `dt` のコントラスト 4.23 → 4.91:1、index key、props の `Readonly` ほか〕。New Code カバレッジ 66.9% の主因だった `container`・`product-info`・`store-card` を新規テストで、`product-swiper`・`product-navigation` を追加テストで埋めた（ローカル見積もり 87.0%）。以下は 9b68b0ae 時点の記録: **ラグジュアリーホーム（PR#180）の SonarCloud 対応** —— HEAD 上の作業ツリー分・コミット前: Reliability ほか New Code の未解決 45 件を解消。うち 34 件は react-three-fiber の JSX プロパティを DOM 属性表で判定する `S6747` の誤検知で、`sonar-project.properties` の `sonar.issue.ignore.multicriteria` で `scene.tsx` に限定して除外。残り 11 件はコード修正〔props の `Readonly`、入れ子三項の切り出し、`role="status"` → `<output>`（フレーズ内容のみ許容のためリンクは live region の外へ）、`<details>` の JSX `onClick`/`onSubmit` をネイティブリスナーへ移設〕。New Code カバレッジ 25.6% の主因だった `experience.tsx`・`data.ts`・`dismissible-details.tsx` をテスト 23 本で埋め、jsdom で描画できない WebGL の `scene.tsx` は jest `collectCoverageFrom` と `sonar.coverage.exclusions` の両方から除外。直前の `e4c03de4`〜`9b68b0ae` は `make install`〔node_modules named volume の同期〕とラグジュアリーホーム本体。以下は f31416dc 時点の記録: **PR#179 のレビュー指摘・SonarCloud 対応**`173b0075`〜`f31416dc`: 属性同期の読み取り専用行を `FOR SHARE` へ（Product / ProductVariant は `FOR UPDATE` のまま同一商品の同期を直列化）、TEXT 値の trim 後の長さ上限をフォームと共有、Spec の名前・値を一度だけ trim、属性定義・選択肢の再アーカイブを拒否して `archivedAt` の監査時刻を保持。Sonar の Reliability 指摘〔`localeCompare`〕と認知的複雑度 3 件ほか 19 件を解消し、New Code カバレッジ 0% だった admin 属性フォーム 2 本・一覧列 2 本・カテゴリ選択肢ローダをテスト 45 本で埋めた。直前の `b05b9008`〜`2cb0d1e8` はレビューのシードを一括書き込みにしてトランザクションタイムアウトを回避。以下は c27fde9b 時点の記録: **plan 069 フォローアップ**`dd5b6bd8`〜`c27fde9b`: 既存バリアントの編集ページ〔属性の初期値 + そのレコードのアーカイブ済み現在値〕、Spec の `min(1)` 撤去、Spec 名と属性の重複警告、ファッション 12 商品 + パイロット 2 商品の属性値シード。以下は 5d54e5cf 時点の記録: **plan 069 カテゴリ別属性 Step 9〜11**`d33c207b`〜`5d54e5cf`: 商品詳細を「Specifications（構造化属性）/ Other specifications（Spec）」の 2 セクションへ、パイロット 3 部門（家電・ファッション・食品）の属性定義シード〔使い捨て Postgres で 2 回実行して同一を実測〕、統合テスト 40 本。以下は b55f2cf4 時点の記録: **CodeRabbit レビュー指摘の対応（第 2 巡）**`f506eb7c`〜`b55f2cf4`: design.md の店舗スコープ例を実装どおり `nodeProducts` へ修正、Phase A 本番手順に Step 6.5〔最終リコンサイル〕を追加（書き込みゲート案は本書の目的と矛盾するため不採用）、footer のカテゴリ取得失敗時のグレースフルデグレード、ERD パーサのコメント誤検出、E2E teardown の握り潰し解消。**移行済みマイグレーションの ON CONFLICT 変更と、`handleProductAndVariantUpdate` のリーフ検証を常時化する指摘は不採用**（前者は適用済みマイグレーション改変の禁止、後者は Phase B の経過措置として意図的に素通ししている）。以下は fa554bae 時点の記録: **CodeRabbit レビュー指摘の対応**`905082b8`〜`fa554bae`: 親候補の深さ判定にサブツリー高さを含める実バグ修正、`getProducts` の `whereClause: any` 撤廃（`subtreeOf` の readonly タプルが `CategoryWhereInput` に載っていなかった型不整合が露見）、E2E の子孫削除順序とシード update 側のツリー列、統合テストの接続数ガード。以下は 41afbc7f 時点の記録: **カバレッジ作業中に見つかった実バグ**`41afbc7f`: セール終了日が保存できない —— `ProductFormSchema.saleEndDate` は `.datetime({ offset: true })` なのに DateTimePicker の onChange がオフセット無し表記を、クリアが空文字を書いていた（`nullish()` は空文字を許さない）。**FormMessage が無いため画面に理由が出ず、保存だけが黙って止まる**症状。`toISOString()` / `null` へ修正し回帰テスト 2 件を追加。直前は `5015eb07`: **PR#176 の Coverage on New Code 残ギャップ（product-details.tsx / category-details.tsx）を潰し切った**。`bcdf62f5` ProductDetails の外部ウィジェット配線（画像追加/削除・キーワード上限・セール終了日・無料配送国）で line 81.3% → **100%** / branch 88.0% → 90.3%、`5015eb07` CategoryDetails の画像削除分岐で line 96.2% → **100%**。**未カバーは分岐のみ**となり、Sonar の New Code 側は行ベースで解消済み。直前は `3fef0e45`: **SonarCloud PR#176 の Coverage on New Code ギャップをコンポーネントテストで埋めた**。`d2b6cbeb` footer カテゴリリンクの href 形式 / `9efb08be` footer の子ノード優先フォールバックと 7 件上限 / `0be7c434` ProductFilters の storeUrl 伝播 / `03812ca3` CategoryLink の `?category=` 張り替えと旧 `subCategory` 除去 / `46abe694` CategoryDetails の親候補絞り込み・旧 url 正準化・送信 3 分岐 / `3fef0e45` ProductDetails のツリー選択（`isProductAssignableCategory` の 2 条件）とルート categoryId 導出。**Sonar Issue 8 件の修正（sort 比較関数・正規表現のバックトラッキング・認知的複雑度 45/24・`.at(-2)`・未使用 import・Readonly props・optional chaining）は作業ツリーに未コミットで残っている**。plan 068 の不可逆な **Phase C（Step 5 以降）は引き続き未着手**で、オペレーター承認待ち。直前は `9034f300`: `9034f300` E2E 検証（`524ba258` の未検証状態を解消）/ `c653864f`〜`86cef918` upsertCategory のツリー編集（V-7 / V-7b / V-7c / V-7d）/ `7f260c18`〜`ddf6ace1` CategoryFormSchema に parentId・sortOrder / `bfbdb8fd`〜`77e28c24` upsertProduct のリーフ強制（V-5 / V-5b / V-5c）/ `4fcfabd7`〜`1b41dc0f` admin カテゴリ表のツリー表示 / `50c6093b`〜`32c33a00` slug 正準化 + 別名 + 親選択フォーム / `3d776a4f` category-path.ts への分離 / `9571d880` admin/subCategories ルート廃止 / `19c51755`〜`95e72cb0` 商品フォームのツリー選択 1 本化 / `d9fb8f04` 統合テスト V-7d・V-5d / `a15b8850`〜`366a2951` deleteCategory の childCount 修正 / `524ba258` E2E（**未検証**）。直前は `cb551bd0`

> 2026-10-03追記: 注文履歴の関連81件/支払い履歴の関連93件、住所管理の関連110件、レビュー履歴の関連116件、メッセージ移行の関連94件、各Chromium5件を確認。全体Jest統計は2026-10-03に実測。詳細は本書の各履歴セクション。

---

## 現在の実装状態サマリ

### テスト統計（Jest の件数は 2026-10-04 実測 / Integration の件数は 2026-10-04 実測 / E2E の件数とフルランは 2026-10-03 実測。lcov カバレッジは 2026-09-30 実測）

> **記載ルール（2026-07-10 整理）**: このテーブルは**最新値のみ**を保持する。増減の経緯・
> 機能実装の詳細ナラティブは [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) が
> アーカイブ先（日付・コミット付きで全件記録済み）。本テーブルのセルに履歴長文を追記しないこと。

| 指標 | 値 |
|------|-----|
| Jest テスト総数 (unit/component) | **2726 passed / 2729 total / 254 スイート**（253 passed / 1 skipped suite、3 skipped tests、127 snapshots）。2026-10-04 作業ツリー全体を `bun run test` で実測（PR #187 レビュー対応・`extractAttributeParams` の空キー回帰 +1 後）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| カバレッジ全体（lcov **2026-09-30 実測**・PR#183 SonarCloud New Code 対応後） | Statements **80.97%** (8268/10211) / Branches **68.02%** (4408/6480) / Functions **74.24%** (1482/1996) / Lines **80.79%** (7497/9279)。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| Jest Integration テスト総数 | **222** / **17 スイート**（**2026-10-04 実測: 222/222 pass**・`bun run test:integration`。PR #187 レビュー対応で `product-update.test.ts` に同一商品へのバリアント並行追加 +1）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| Jest スナップショット | **127**（`tests/component/ui/__snapshots__/`・49/49 shadcn/ui プリミティブカバー） |
| Playwright E2E（全プロジェクト集計） | **46 files・3 ブラウザ計 447 tests**（2026-10-03 `bunx playwright test --list`）。2026-10-03 のフルラン（使い捨てのクリーン DB・`--retries=2`）: **283 passed / 77 failed / 7 flaky / 41 skipped / 39 did not run / 1.0h**。失敗の大半は Clerk Testing の FAPI 通信失敗（`FAPI request failed after 4 attempts`）に伴う認証フローで、他に既存の OI-13（VRT 3 スペック）・OI-14（`mobile-responsive` の旧ブランド名）を含む。**変更前の HEAD でも VRT 3 スペックは同じ差分で失敗することを確認済み**。plans 073〜076 の対象（`search-filter` 3 ブラウザ・`a11y/browse`・`visual/browse`）はクリーン DB で全 pass。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| Playwright Visual | **4 スペック**（cart / checkout / browse / **商品詳細**）・**5 テストとも passed**（chromium 限定）。2026-08-31 実測。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| Playwright a11y | **7 スペック**（sign-in / seller-apply / checkout / profile / **browse / product / cart**）・**7 spec すべて passed**。2026-08-09 実測（`bash scripts/e2e/run-local.sh tests/e2e/a11y --project=chromium` が 7 passed / 58.3s）。home（`/`）は OI-9（本番ビルドで SSR 500）が未解消のため対象外。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| 型エラー | **0 件** |
| Skipped テスト | **3 件**（idempotency suite 3 件 [`prisma/seed/__tests__/idempotency.test.ts` を `SKIP_DB_TESTS` 環境変数で `describe.skip`]）。modal-provider 9 件は 2026-06-14 に un-skip 済み（OI-8 解消）。Playwright a11y spec は別系統で `CLERK_SECRET_KEY` 未設定時に `test.skip` 条件分岐 |
| Skipped スイート | **1 件**（idempotency suite のみ。modal-provider.test.tsx の file-level skip は OI-8 解消で解除） |
| テストファイル総数（ダッシュボード集計） | **317** / lcovエントリ **328** / マトリクス18/80セル（23%）。2026-10-04 `bun run coverage:dashboard` の走査で 317 を実測（lcov は 2026-09-30 の測定値）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |

### `/profile/wishlist/[page]` デザイン移行の検証（2026-09-30、未コミット）

- [保存計画](../../plans/layout-design/wishlist-design-system-plan.md)、[仕様](../design/profile-wishlist/requirements.md)、[証跡](../design/design-system/PROGRESS.md#wishlist移行記録)。
- Redは新RTL5件／Chromium5件の要件不一致を実測。既存正規化・redirect1件は回帰確認。loading1件は実装後回帰。
- 最終関連Jest87/87（4 suites）、Chromium5/5、lint 0 errors／既存12 warnings、tsc成功。空・10商品・最終1商品、1440／390／768px、カード比較・focus・Enter、axe違反0（contrast除外なし）、URLページング・ブラウザ戻る・alias／範囲外ページを確認。
- テスト顧客の11件wishlist fixtureは顧客cleanupで除去、既存商品・取得仕様は維持。商品作成・seed・DB初期化・購入なし。
- dashboard走査296ファイル／既存lcov328を実測。当時のファイル数は296。全体Jest成功数・カバレッジ率は前回実測値を維持。
- Wishlist移行固有の未解決事項なし。エラー・loadingはRTL確認、ブラウザでの障害強制・Firefox／WebKit・全E2Eは未実行。次着手は既存移行計画のDS-BASE-001。他profile本文は別IDを継続。

### `/profile` デザイン移行の検証（2026-09-30、未コミット）

- [保存計画](../../plans/layout-design/profile-design-system-plan.md)、[仕様](../design/profile-overview/requirements.md)、[証跡](../design/design-system/PROGRESS.md#profile移行記録)。
- Redは新RTL11件と新ブラウザ4件の要件不一致を実測。既存Settingsリンク／user=nullと未認証転送は回帰確認。
- 最終Jest28/28（5 suites）、Chromium5/5、lint 0 errors／既存12 warnings、tsc成功。1440／390／768px、横スクロールなし、focus／Tab／Enter、profile共通枠axe違反0（contrast除外なし）、Orders／Addresses／Settings遷移とClerk設定表示を確認。
- 会員名保持・未設定・Clerk失敗はRTLで検証。未実装Coupons／creditはComing soon、サポート無操作行は既存Contact／Disputeへのリンク。認可・DB・注文統計取得は変更しない。
- dashboard走査294ファイル／既存lcov328を実測。表のファイル数は今回の走査値で、全体Jest成功数・カバレッジ率は前回実測値を維持。
- profile概要固有の未解決事項なし。Firefox／WebKit・全E2E、Clerk設定操作は未実行。次着手は既存移行計画の共通基盤DS-BASE-001、profile子ページ本文の移行は台帳の別IDとして継続。

### `/faqs` デザイン移行の検証（2026-09-30、未コミット）

- [保存計画](../../plans/layout-design/faqs-design-system-plan.md)、[仕様](../design/storefront-static-pages/requirements.md)、[検証記録](../design/design-system/PROGRESS.md#faqs移行記録)。
- Red: 新RTL2件と3画面幅のブラウザ配色テストが期待どおり失敗。既存表示と308転送は回帰確認。
- 最終関連Jest24/24、Chromium4/4（1440／390／768px、focus・Enter、横スクロールなし、FAQ mainのaxe違反0、旧URL308）。lint 0 errors／既存12 warnings、tsc成功。
- 別作業のmiddleware→proxy移行に合わせて既存テストimportを同期（11件成功）。FAQ専用CSSと定数を使い、他の静的ページはそのまま。
- dashboard再生成で292ファイル／既存lcov328を実測。上表の292は本セッションでのファイル走査値、全体Jest・coverageの成功数と率は前回実測値を維持。
- FAQ固有の未解決事項なし。Firefox／WebKit・全E2Eは未実行。次着手は既存移行計画の共通基盤DS-BASE-001。回答プレースホルダの確定は運営側の既存課題として継続。

### `/compare` デザイン移行の検証（2026-09-30、未コミット）

- [計画](../../plans/layout-design/compare-design-system-plan.md)、[要件・設計](../design/compare/README.md)、[移行進捗](../design/design-system/PROGRESS.md)。
- Redは新UI要件4件の失敗を実測。既存回帰8件は成功。Green／Refactor後の比較グリッド12件＋ストア11件は23/23成功。
- Chromiumの表示・操作・axeテスト6/6成功。1440px／390px、700pxの境界幅、空・4商品・読み込み・取得ゼロ・失敗／再試行、個別削除・全消去・キーボード横スクロールを検証。商品取得はテスト内のServer Action応答フィクスチャで再現し、DBを書き換えない。
- `bun run lint`: 0 errors／12 warnings（変更対象への限定ESLintは警告・エラーなし）。`bunx tsc --noEmit`: 成功。
- 全体Jest＋coverage: 2566 passed／2569 total、238 suites（237 passed／1 skipped）、3 skipped tests、127 snapshots成功。Statements80.8%／Branches67.7%／Functions74.14%／Lines80.62%。全体結果には前セッション・他作業の未コミット分も含む。
- 取得応答の旧結果が全消去後に再表示されない回帰も確認。仕様・進捗を同期し、既存の上限4件とlocalStorageキーを維持した。
- 実データの追加確認1件も成功。既存商品カードのハイドレーションを待って選択を保存し、実Actionの取得と画像のロードを確認。追加確認の初期手順の失敗と修正は移行進捗に記録済み。
- 引き継ぎ: 全ブラウザ・全E2Eは未実行。移行全体の次着手は共通基盤DS-BASE-001（既存の移行計画を参照）。新E2Eはloadイベント全体を待たず、commit後に各表示条件を待つ。

### `/browse` 刷新の検証（2026-09-29、作業ツリー）

- `npm test -- --runInBand --silent`: 2534 passed / 2537 total、234 suites（233 passed / 1 skipped）、127 snapshots passed。
- 実 DB の `tests/integration/product-browse.test.ts`: 21/21 passed。関連する Chromium E2E `search-filter.spec.ts` と `a11y/browse.spec.ts`: 7/7 passed。
- `npx tsc --noEmit`、関連ファイルの ESLint、`git diff --check` は通過。ソート変更時の URL 条件保持、個別チップ削除、Clear All、長いフィルタ値の表示範囲、商品カードのホバー切替もブラウザで確認した。
- 全ブラウザ・全 E2E は今回実行していない。`browse-grid` の画像ベースラインは 2026-09-30 に更新済み（`a8c385a2`）: `scripts/e2e/run-local.sh` 経由の chromium 実行で旧 GoShop レイアウトとの差分を確認し、新レイアウト（ヒーロー / editorial グリッド / フィルタパネル / ページネーション）への意図した変更とレビューしたうえで再撮影、更新フラグなしで 2 回連続 passed を確認した。上表の Integration / E2E / Visual の総数と過去のフルラン結果は今回の部分実行で更新していない。

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

### 🔴 現在アクティブな残課題（優先度順・2026-10-04 時点） {#active-open-issues}

> 解消済み OI（OI-1〜OI-9）は下表に取り消し線付きで監査証跡として残す。**着手すべきは以下（OI-11 / OI-10 / OI-12 / OI-13 / OI-14 / C2）。**

| 優先 | ID | 課題 | 期限 / 状態 | 次の一手 |
|---|---|---|---|---|
| ~~1~~ | ~~**OI-9**~~ | ~~ホーム `/` が SSR で 500（`featured.tsx` の `window` 初期化子参照）~~ | ✅ **解消済み（2026-06-06 / `c196e3d5`）** | 実装は `useState<number>(1200)` の安全な既定値 + `useEffect` での実測反映済み（`featured.tsx:19,30`）。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass。**次の一手は D2** — `.lighthouserc.json` / `lhci.yml` の計測 URL へ `/` を追加できる状態になった。 |
| **1（最優先）** | **OI-11** | `/dashboard/seller` 系ルートが本番 SSR で `ReferenceError: self is not defined`（`next-cloudinary` の `CldUploadWidget` をサーバ評価）。OI-9 と同族の client-only ref 問題。現状テストは落ちていない（ログのみ）が本番でも再現の可能性 | 🟡 未着手 | `image-upload.tsx` の `CldUploadWidget` を `next/dynamic` の `ssr:false` で遅延 import する。発見: 2026-06-19（E2E 本番ビルド化で顕在化） |
| 2 | **OI-10** | a11y `color-contrast` 負債: `/checkout`・`/profile`・`/seller/apply` でグレー/ブルー系テキストが 4.5:1 未満。E2E では `runA11yScan` の `disabledRules:["color-contrast"]` で抑制中（追跡のため意図的） | 🟢 低 | 配色（テキスト色）を是正して `disabledRules` を解除する。発見: 2026-06-19（a11y readiness 修正で axe 到達後に検出） |
| 3 | **OI-12** | E2E のローカル Firefox 実行で navigation が hang する（dev サーバの HMR 起因と推定）。`tests/e2e/profile.spec.ts`（住所追加 / 注文履歴）と `tests/e2e/mobile-responsive.spec.ts` の計 3 件を `testInfo.project.name === "firefox" && !process.env.CI` で skip 中。**CI は本番ビルドで実行されるため skip されず**、3 ブラウザのカバレッジは CI 側で維持されている | 🟢 低 / 🟡 未着手（**見直し期限: 2026-10-31**） | **解消条件**: ローカル dev サーバ（`bun run dev`）で当該 3 件が Firefox 連続 2 回 pass すること。**次の一手**: dev の Turbopack HMR クライアントが Firefox で navigation を保留させているかを `PWDEBUG=1` + `--project=firefox` で切り分け、再現したら `webServer` を本番ビルド（`next build && next start`）へ寄せる案を検討する。発見: 2026-08-23（plan 049 / TESTS-37） |
| 4 | **OI-13** | VRT `visual/cart.spec.ts`（空 / 商品追加後）・`visual/checkout.spec.ts`・`visual/product.spec.ts` が**新しい空の DB + `seed:e2e`** では高さが一致せず失敗する（1405→1375 / 1841→1811 / 5931→5525px）。2026-10-03 に**変更前の HEAD `3277d8a5` を git worktree で同条件実行して同じ差分を再現**（plans 073〜076 とは無関係）。ベースライン撮影時の DB に他スペック由来のデータ（レビュー・カテゴリ等）が混ざっていたと推定 | 🟡 未着手 | クリーン DB + `seed:e2e` 直後の状態でベースラインを撮り直すか、データ依存部分（フッターのカテゴリ一覧・レビュー）を `mask` する。撮り直す場合は「意図した見た目」であることを差分画像で確認してから。 |
| 5 | **OI-14** | `tests/e2e/mobile-responsive.spec.ts:119`（タブレットのレイアウト切替）が `h1` に旧ブランド名 `GoShop` を期待して全ブラウザで失敗（現行は `Luxuries`）。リブランド時の取り残し | 🟢 低 | 期待値を現行ブランドへ更新するか、ブランド名に依存しないランドマーク検証へ置き換える。 |
| 6 | **C2** | Bundle Size の継続監視 | 🟢 低 | `@next/bundle-analyzer + size-limit` で初期 JS の閾値超過を CI 警告（下記 C2 プロンプト参照）。 |

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

- 現在、アクティブな残課題は **OI-11 / OI-10 / OI-12 / OI-13 / OI-14 / C2** の 6 件です（優先度・次の一手は[アクティブな残課題テーブル](#active-open-issues)を SSOT として参照）。**OI-9（ホーム `/` の SSR 500）は 2026-06-06 に解消済み**（`c196e3d5`。2026-07-26 に E2E 実測でクローズ確認）。**OI-8（CI flake）は 2026-06-14 に解消済み**（真因 = `size.test.ts` の Prisma 接続リーク `83ef06c` + modal-provider un-skip `49fa32d`。経緯: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)）。
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

#### FS-COMMIT: plans 073〜076（ファセット検索）の未コミット作業をコミット分割して PR にする

2026-10-03 のセッションで plans 073〜076 を実装・検証したが、**作業ツリーに未コミットで残っている**（HEAD `3277d8a5`）。
新規マイグレーション 4 本は**ローカル DB にのみ適用済み・リモート（Neon）未適用**。

```text
plans 073〜076（plan 015 ファセット検索の後続）の未コミット作業を、規約どおりに分割コミットして PR を作ってください。

前提（必ず最初に確認）:
- git status で作業ツリーが 2026-10-04（PR #187 レビュー対応）時点の状態か確認する（HEAD 86b9c786 / 未コミット）。
  変更内容の全体像は plans/073〜076 の「実施結果」節と docs/design/faceted-search/design.md §5 にある。
- 着手前に bun run test / bun run test:integration / bunx tsc --noEmit / bun run lint を実行し、
  2723 passed / 2726 total（254 スイート）・Integration 218/218・型エラー 0・lint 0 errors を再現すること。
  再現しなければ STOP して報告する。

コミット分割（.claude/rules/02-tdd-step-commit.md・03-data-model-diagram-sync.md に従う）:
1. docs(plans): 015 の実施結果 + 073〜076 のプラン本文 + design.md + ADR-008（+ decisions/README）
2. 073: サジェスト復旧（route.ts / search.tsx / suggestions.tsx と各テスト）→ orderBy の tie-breaker
3. 074: マイグレーション 120000 / 120100 + schema.prisma + data-model.drawio（同一コミット必須）+ product.ts の再計算 + テスト
4. 075: マイグレーション 120200 + search-query.ts + parseProductFilters + getProducts の生 SQL 化 + browse/page.tsx + テスト
5. 076: マイグレーション 120300 + product-derived-columns.ts + seed 2 本 + getProductFacets + attribute-key.ts
   + facet UI（filters/attribute/）+ E2E seed / spec（search-filter・a11y/browse）+ テスト
6. docs: 仕様書（specs 02〜08）・design-system PROGRESS（DS-COMP-203）
7. docs: テスト統計同期（QA_HANDOFF / 07-testing / COVERAGE_REPORT / PROGRESS / coverage-dashboard.html / render-html.ts）
- 各コミット時点で bunx tsc --noEmit が通ること。通らない分割になる場合は隣接コミットとまとめ、理由を PR に書く。
- 1 コミットが 3 ファイル / 200 行の目安を超える場合は PR 説明に理由とレビュアー承認チェックボックスを付ける。

PR 本文に必ず書くこと:
- **デプロイ時に bunx prisma migrate deploy でマイグレーション 4 本の適用が必要**（本番 PostgreSQL 17.11 で生成列が使えることは確認済み）。
  migrate deploy 自体はこのタスクで実行しない（本番操作はオペレーター承認が必要）。
- ADR-008 D-5: schema.prisma の searchVector は dbgenerated(生成式) + @@index(type: Gin) を宣言しないとドリフト扱いになる。
- 既存の E2E 失敗（OI-13 / OI-14・Clerk FAPI 通信失敗）は本変更と無関係であること（HEAD で再現済み）。

完了条件:
1. 分割コミット + PR 作成（push / PR 作成は依頼された場合のみ）。
2. render-html.ts の NEXT_ACTIONS から FS-COMMIT を削除し、本プロンプトも削除（二重 SSOT 同期）→ bun run coverage:dashboard。
```

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

<!-- 073〜076（plan 015 ファセット検索の後続）✅ 実装完了 2026-10-03（未コミット）: サジェスト復旧 + tie-breaker / searchVector（ADR-008）/ getProducts の生 SQL 一本化 / minPrice + 属性ファセット。詳細は plans/073〜076 の「実施結果」と COVERAGE_REPORT.md §7 -->

<!-- NA-NS-01 (B1+ shadcn/ui Snapshot 拡張) ✅ 完了 2026-05-28: 49/49 プリミティブ / 127 snapshot。詳細: B1_SNAPSHOT_EXPANSION_PLAN.md / COVERAGE_REPORT.md §7 -->
<!-- NA-NS-02 (B2: Stripe/PayPal Webhook Contract テスト) ✅ 完了 2026-05-28: 30+2 ケース。コミット 338ab41 / 1d69f0f / 2321cd8 -->
<!-- NA-NS-03 (B3: Cart → Checkout Integration テスト) ✅ 完了 2026-05-29: 4 シナリオ / 11 テスト。ADR-004 参照 -->
<!-- D1 (categorize.ts 改修 / Integration 行実体化) ✅ 完了 2026-06-02: commit b57841a。詳細: COVERAGE_REPORT.md §3 D1 -->

#### OI-13: VRT ベースライン 3 スペック（cart / checkout / product）が空の DB で一致しない

```text
Playwright VRT の visual/cart.spec.ts（空カート / 商品追加後）・visual/checkout.spec.ts・visual/product.spec.ts が、
新しい空の DB + bun run seed:e2e の状態で高さ不一致により失敗する問題（OI-13）を解消してください。

事実（2026-10-03 実測）:
- 差分: 1405→1375px / 1841→1811px / 5931→5525px（いずれも chromium）。
- 変更前の HEAD 3277d8a5 を git worktree に展開し、同じ条件（空の DB・全マイグレーション適用・seed:e2e）で
  実行しても同じ差分で失敗する → plans 073〜076 とは無関係。visual/browse.spec.ts は通る。
- 推定原因: ベースライン撮影時の DB に他スペック由来のデータ（レビュー件数・フッターのカテゴリ一覧等）が混ざっていた。
  共有の開発 DB（multivendor_dev）はラグジュアリーデータ入りなので、そこで撮り直してはならない。

進め方:
1. 使い捨て DB を作って再現する（開発 DB は触らない）:
   docker compose exec -T db createdb -U dev e2e_vrt_check
   DATABASE_URL / DIRECT_URL / E2E_DATABASE_URL をその DB に向け、E2E_NO_REUSE=1 PORT=3100 E2E_BASE_URL=http://localhost:3100 で
   bunx prisma migrate deploy → bun run seed:e2e → bunx playwright test tests/e2e/visual --project=chromium
2. 差分画像（test-results/**/*-diff.png）で、どこがデータ依存かを特定する。
3. 対策を選ぶ: (a) データ依存部分（レビュー件数・フッターのカテゴリ一覧など）を mask する、
   (b) クリーン DB + seed:e2e 直後の状態でベースラインを撮り直す（--update-snapshots）。
   ベースラインは「意図した見た目」の宣言なので、撮り直す前に actual 画像が意図どおりかを目視確認すること。
   (a) で済むなら (a) を優先（CI と ローカルの両方で決定的になる）。
4. 終わったら使い捨て DB を dropdb で消す。

完了条件:
1. 空の DB + seed:e2e で visual 4 スペックが chromium で全 pass。
2. QA_HANDOFF の OI-13 を取り消し線で解消扱いにし、render-html.ts の NEXT_ACTIONS と本プロンプトを削除 → bun run coverage:dashboard。
```

#### FS-CHIPS: 属性ファセットの選択チップに属性名と値ラベルを表示する

```text
/browse のフィルタ見出し（src/components/store/browse-page/filters/header.tsx・DS-COMP-059）で、
属性ファセットの選択（?attr.<key>=<value>・plan 076）のチップが生の値（例: silk）しか表示しない問題を直してください。

現状:
- browse/page.tsx が attr.* を queries に載せて渡すため（225e8d76）、「Filter (n)」の件数には attr.* の値が含まれ、
  チップの × で attr.<key> の該当値だけを外せる（件数・解除は実装済み）。
- ただしチップは queries の値をそのまま表示するので、属性名が分からず ENUM は AttributeOption.value（機械値）が出る。
- ファセットのデータは browse/page.tsx が getProductFacets で集計し、filters.tsx → AttributeFacetFilter へ props で渡している
  （facet の name / 値の label を持っている）。

方針:
1. design-system-workflow（.agent/skills/design-system-workflow/SKILL.md）に従う。計画は plans/ に保存してから着手。
2. attr.* のチップを「属性名: 値ラベル」（例: Material: Silk）で表示する。ラベルは facets から引き、
   facets に無い key / 値は key・値そのものを表示する（カテゴリ切替で残った選択も読めるように）。
   件数と解除の挙動は変えない。
3. RTL で Red → Green。header.test.tsx（filters/header.test.tsx）を拡張。
4. 実装後に 1440 / 390px で表示確認、a11y は tests/e2e/a11y/browse.spec.ts（seed カテゴリ URL・ファセットあり）で確認。

完了条件:
1. RTL / lint / tsc グリーン、a11y browse が pass。
2. docs/design/design-system/PROGRESS.md の DS-COMP-203 記録の「残課題」を解消済みに更新し、DS-COMP-059 に記録を追加。
   specs/multi-vendor-ecommerce/05-workflows.md の Browse Collection Flow 6) の「chips still show raw values」記述を更新。
3. render-html.ts の NEXT_ACTIONS から FS-CHIPS を削除し、本プロンプトも削除 → bun run coverage:dashboard。
```

#### OI-14: `mobile-responsive.spec.ts` のタブレットテストが旧ブランド名 `GoShop` を期待している

```text
tests/e2e/mobile-responsive.spec.ts:119（タブレットレスポンシブ › タブレットビューポートでレイアウト切替）が
locator('h1').filter({ hasText: 'GoShop' }) を待って全ブラウザで失敗する問題（OI-14）を直してください。

- 現行のブランド表記は "Luxuries"（リブランド時の取り残し）。2026-10-03 の E2E フルランで chromium / firefox / webkit すべて失敗。
- ブランド名の文字列に依存させず、ランドマーク（banner / navigation）やヘッダーの data-testid など、
  リブランドで壊れない要素で「タブレット幅でレイアウトが切り替わったこと」を検証する形を優先する。
- 同ファイルの他テスト（:73 モバイルでチェックアウトボタンが機能する）も同じ前提を持っていないか確認する。

完了条件:
1. bun run test:e2e:local -- tests/e2e/mobile-responsive.spec.ts が 3 ブラウザで pass（OI-12 の firefox ローカル skip は既存どおり）。
2. QA_HANDOFF の OI-14 を解消扱いにし、render-html.ts の NEXT_ACTIONS と本プロンプトを削除 → bun run coverage:dashboard。
```

#### E2E-AUTH: E2E フルランの認証系の失敗（Clerk Testing FAPI 通信失敗）を切り分ける

```text
2026-10-03 の E2E フルラン（使い捨てのクリーン DB・--retries=2）で 283 passed / 77 failed / 7 flaky / 41 skipped / 39 did not run だった。
失敗の大半はサインイン・サインアウト・カート引き継ぎ・チェックアウト・プロフィール系で、
ログに "[Clerk Testing] FAPI request failed after 4 attempts" が繰り返し出ていた。これを切り分けてください。

確認すること:
1. 外部要因か（Clerk 開発インスタンスの一時障害・レート制限・ネットワーク）を判定する:
   時間を置いて bun run test:e2e:local -- tests/e2e/auth-surface.spec.ts --project=chromium を再実行し、同じ FAPI エラーが出るか。
2. クリーン DB 起因か: run-local.sh（共有の開発 DB）で同じ spec を実行し、結果を比較する。
   クリーン DB には Clerk のユーザーと DB の User 行の対応が無いため、seed:e2e が作る E2E ユーザーで足りているか確認する。
3. 再現する場合、失敗箇所（setupClerkTestingToken / signIn ヘルパー / ストア取得 "Store with URL e2e-status-store-... not found"）を
   ログから特定し、テスト基盤の問題かアプリの問題かを分ける。アプリ側の退行が疑われる場合は git worktree で HEAD と比較する。
4. 見つかった恒久課題は QA_HANDOFF の残課題表に OI として起票する（推測で直さない）。

完了条件:
1. 原因の切り分け結果（外部 / 環境 / テスト基盤 / アプリ）を QA_HANDOFF に記録。
2. render-html.ts の NEXT_ACTIONS から E2E-AUTH を削除し、本プロンプトも削除 → bun run coverage:dashboard。
```

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

#### PRICE-FILTER: 価格の絞り込みの意味（定価 / 割引後）を決めて揃える

```text
/browse の価格の絞り込み（minPrice / maxPrice）は定価（Size.price）で判定し、商品カードの表示と価格ソート
（Product.minPrice）は割引後の価格を使っていて、意味が食い違っている。プロダクト判断を確認したうえで揃えてください。

背景: specs/multi-vendor-ecommerce/08-open-questions.md「価格の絞り込みは定価、表示と価格ソートは割引後」、
docs/design/faceted-search/design.md §0-9 / §2-Q4。

進め方:
1. **まず AskUserQuestion で方針を確認する（独断で決めない）**:
   (a) 割引後の最小価格（Product.minPrice）で絞る — 単純・インデックスが効く。商品単位の判定になる。
   (b) サイズ単位の割引後価格で「どれか 1 サイズが範囲内」で絞る — 現行の some 意味論を保つ。
   (c) 現状維持（定価で絞る）とし、UI に「定価で絞り込み」と明示する。
2. 決定に沿って src/queries/product.ts の buildProductPredicates の価格述語を変更（(a) なら p."minPrice" BETWEEN、
   (b) なら s.price * (1 - s.discount::numeric / 100) を Decimal で比較。discount は Float なので ::numeric を必ず先に）。
3. TDD: tests/integration/product-browse.test.ts の Scenario 4（価格境界）に割引付きの Arrange を足して Red → Green。
   maxPrice: 0 を「上限 0」として扱う既存の回帰ガード（単体・統合）を壊さないこと。

完了条件:
1. 単体 / 統合 / tsc / lint グリーン。
2. 08-open-questions.md の当該項目を Resolved Issues へ移し、04-interfaces.md の /browse の説明を更新。
3. render-html.ts の NEXT_ACTIONS から PRICE-FILTER を削除し、本プロンプトも削除 → bun run coverage:dashboard。
```

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

### `/track-order` デザイン移行（2026-10-01、未コミット）

計画: [track-order-design-system-plan](../../plans/layout-design/track-order-design-system-plan.md)。詳細: [移行証跡](../design/design-system/PROGRESS.md#track-order移行記録)。RTL Red1件確認後、関連Jest82/82・Chromium3/3・lint 0 errors/既存12 warnings・tsc成功。1440/390/768pxの各状態とaxe AA違反0を確認。新規課題なし。次着手は既存Open Issuesを維持。dashboard走査297ファイル（既存lcov328）、全体テスト成功数・coverage率の再測定なし。

### `/customer-service` デザイン移行（2026-10-01、未コミット）

[計画](../../plans/layout-design/customer-service-design-system-plan.md)、[証跡](../design/design-system/PROGRESS.md#customer-service移行記録)。Chromium Red3件→最終3/3、track-order回帰3/3、既存RTL1/1、lint 0 errors／既存12 warnings、tsc成功。3幅・hover・focus・Enter・axe AA違反0、画像を確認。新規Open Issueなし。次着手は既存Open Issuesを維持。dashboard298ファイル（直前297）・既存lcov328。全体Jest成功数・coverage率は前回実測維持。

### `/returns-exchange` デザイン移行（2026-10-01、未コミット）

[計画](../../plans/layout-design/returns-exchange-design-system-plan.md)、[証跡](../design/design-system/PROGRESS.md#returns-exchange移行記録)。RTL新要件1件／Chromium3幅のRedを実測後、関連Jest16/16・Chromium4/4、lintエラー0／既存警告12、tsc成功。3幅の各状態axe AA違反0、他3フォームのProps経由モック送信回帰、画像確認完了。実チケット作成なし。新規Open Issueなし、次着手は既存Open Issuesを維持。dashboard299ファイル（直前298）・既存lcov328。全体Jest成功数・coverage率は前回実測維持。

### `/product-support` デザイン移行（2026-10-01、未コミット）

[計画](../../plans/layout-design/product-support-design-system-plan.md)、[証跡](../design/design-system/PROGRESS.md#product-support移行記録)。RTL1件・Chromium3幅Red確認後、関連Jest11/11・Chromium3/3、lint 0 errors／既存12 warnings、tsc成功。本文とプレースホルダ保持、目次・サポート導線・focus/Enter・3幅・axe AA違反0・画像確認完了。新規Open Issueなし、次着手は既存Open Issuesを維持。dashboard301ファイル（直前299）・既存lcov328。全体Jest成功数・coverage率は前回実測維持。

## 2026-10-01 Cartデザイン移行

- 関連Jest 27/27（4 suites）、Chromium cart-design 10/10、1440/390/768px・main/通知axe AA・focus・横あふれを確認。型チェック成功、lintは0 errors／既存12 warnings。全体テスト統計は未再測定のため変更しない。
- [検証証跡](../design/design-system/PROGRESS.md#cart移行記録)。通知の成功・エラー・dismiss、保存中の二重送信、送料の削除cleanupを追加。消失明細同期の既存修正を保持。
- 開発環境のキャッシュ競合は両キャッシュ削除とNEXT_DEV_DIST_DIRによる分離で解消。3001は専用キャッシュ、Dockerは既定キャッシュで再起動済み。
- 次着手: cartの実認証後checkout遷移・実保存は既存購入フローE2Eとして検証。今回の通知成功/保存失敗はmock応答。Firefox/WebKit・全E2E・全coverageは未実施。Radix/Sonnerや他画面のデザイン移行は既存台帳に従う。

- Cart画像回帰: 空／商品入りの基準更新・目視確認後、更新なしのChromium実行2/2成功。


### `/profile/orders` デザイン移行（2026-10-03、未コミット）

- [計画](../../plans/layout-design/profile-orders-design-system-plan.md)、[要件](../design/profile-orders/requirements.md)、[証跡](../design/design-system/PROGRESS.md#profile-orders移行記録)。DS-PAGE-028/027とDS-COMP-080/081を検証済みへ。
- Red: 新RTL5件・mobile h1のChromium1件。最終関連Jest81/81（3 suites）、Chromium5/5、lint 0 errors/既存11 warnings、tsc成功。1440/390/768px、空/通常/取得中/失敗/再試行、検索/期間/ページング/全解除、filter fallback/未認証、focus/Enter/axe AAを確認。
- dashboard走査306ファイル、既存lcov328、18/80セル。全体Jest/coverage率は再測定していないため上表の前回値を維持。
- 本件固有の未解決事項なし。通常注文/遅延/障害はaction応答mock、実注文作成/購入なし。Firefox/WebKit/全E2E未実行。次着手は既存移行計画DS-BASE-001、残りprofile本文は別IDで継続。


### `/profile/payment` デザイン移行（2026-10-03、未コミット）

- [計画](../../plans/layout-design/profile-payment-design-system-plan.md)、[要件](../design/profile-payment/requirements.md)、[証跡](../design/design-system/PROGRESS.md#profile-payment移行記録)。DS-PAGE-030とDS-COMP-082/083を検証済みへ。
- Red: 新RTL5件/Chromium mobile見出し1件、money既存回帰2件成功。最終関連Jest93/93（4 suites）、Chromium5/5、lint 0 errors/既存11 warnings、tsc成功。1440/390/768px、長いID、空/通常/取得中/失敗/再試行、方法/期間/検索/ページング/全解除、未認証、focus/Enter/axe AAを確認。
- 表示queryは既存所有者条件を保持、amountはドルnumber/updatedAt ISO、最小投影、Clientはaction Props。Stripe/PayPal表示に/100なし。先行orders実装は変更せずRTL回帰を確認。
- dashboard走査307ファイル/既存lcov328、18/80。全体Jest/coverage率は未再測定のため上表の前回値を保持。
- 本件固有の未解決事項なし。通常支払い/遅延/障害はaction mock、初期空は実query、初回失敗/loadingはRTL。実決済/返金/支払DB作成なし。Firefox/WebKit/全E2E未実行。次着手は移行計画DS-BASE-001、残りprofile本文は別IDで継続。

### `/profile/addresses` デザイン移行（2026-10-03、未コミット）

- [計画](../../plans/layout-design/profile-addresses-design-system-plan.md)、[要件](../design/profile-addresses/requirements.md)、[証跡](../design/design-system/PROGRESS.md#profile-addresses移行記録)。DS-PAGE-021/DS-COMP-084を検証済みへ。
- 先行RTL6/query11/Chromium mobile h1のRed→Green。関連110/110、5 suites。Chromium5/5、3幅/全状態/keyboard/axe AA、lint 0 errors/既存11 warnings、tsc成功。
- 初期空は実認証/query。保存/既定変更はaction mock、住所DB書き込みなし。既存DB書き込みprofile E2Eはselector同期のみで未実行。checkout/共有住所部品の移行は対象外。
- dashboard実測310ファイル/既存lcov328、18/80。全体Jest/coverage率は未再測定のため前回値を保持。受け入れ範囲の残課題なし。次着手は既存Open Issuesと共通DS-BASE-001の計画に従う。

### `/profile/reviews` デザイン移行（2026-10-03、未コミット）

- [計画](../../plans/layout-design/profile-reviews-design-system-plan.md)、[要件](../design/profile-reviews/requirements.md)、[証跡](../design/design-system/PROGRESS.md#profile-reviews移行記録)。DS-PAGE-031/DS-COMP-087/088を検証済みへ。
- 先行RTL6/query2/mobile h1のRed→Green。旧実装でも成功する初期データ回帰1件、実装後server/loading/draft回帰4件はRedと区別。最終関連116/116（7 suites）、Chromium5/5、3幅/全状態/keyboard/axe AA。lint 0 errors/既存11 warnings、tsc成功。
- 初期空は実認証/query、通常/遅延/失敗はaction mock。レビューDB書き込み/購入なし。共有商品ページReviewCardは移行対象外。
- dashboard実測312ファイル/既存lcov328、18/80。全体Jest/coverage率は前回値を保持。受け入れ範囲の残課題なし。次着手は既存Open Issuesと共通DS-BASE-001の計画に従う。

### `/profile/messages` デザイン移行（2026-10-03、未コミット）

- [計画](../../plans/layout-design/profile-messages-design-system-plan.md)、[要件](../design/profile-messages/requirements.md)、[証跡](../design/design-system/PROGRESS.md#profile-messages移行記録)。DS-PAGE-026/DS-COMP-090/新202を検証済みへ。旧共有089/091と販売者092はTODO維持。
- 先行RTL8/query4/mobile h1のRed→Green。server/loading/上限validation/queued refresh5件は実装後回帰。最終94/94、7 suites。Chromium5/5、3幅/keyboard/axe AA/取得・既読・送信失敗とretry。lint 0 errors/既存11 warnings、tsc成功。
- 初期空は実認証/query。会話データ/送信/既読はaction mockで、実店舗への送信とメッセージDB書き込みなし。AC-M8実往復とFirefox/WebKit/全E2Eは未実行。
- dashboard実測314ファイル/既存lcov328、18/80。全体Jest/coverageは前回値維持。受け入れ範囲の残課題なし。次着手は既存Open Issuesと共通DS-BASE-001の計画に従う。
