# 購入導線6画面の残存部品 — requirements

- 日付: 2026-10-08。対象: DS-PAGE-006/037/019/007/008/003。
- [保存計画](../../../plans/layout-design/priority-six-purchase-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#購入導線残存部品6画面移行記録)。
- ストア限定のpurchase-theme CSS Moduleをpage/component rootsとPortalに明示適用。固定light面の色・罫線・focus・状態色を共有しdashboard既定themeに波及させない。
- 独立した操作は44px以上、checkbox/radioはlabelを含む操作領域を確保。可視focus、長文折返し、局所scroll、reduced motion、WCAG AAを維持。
- Browse/Store: 絞込み・sort・商品variant・compareのURL/状態を保持。商品variantのfocusでも表示を選択し、Enterで既存URLへ移動。
- Product: レビューsort select44px以上。レビューcard/formの面・入力・focusを統一。rating/photo/sort/pagingとレビュー投稿契約を保持。
- Cart: selection/bulk remove/retry44px以上。数量1で減少は削除、送料・金額・失敗時のbag保持は既存仕様。
- Checkout: Portal内でも統一した面・入力・保存button・focusを使用。保存失敗時の入力保持、pending中dismiss禁止、focus復帰、住所/coupon更新時の注文ロックを維持。
- Order: store variantのタグは状態名・意味を保持し、明暗祖先に依存しない可読性を持つ。全注文/支払状態を含む。single total、支払い表示条件、SDK loading/error/retryを保持。
- DB/API/認可/購入計算/在庫/注文・決済状態/PDFの契約は変更しない。補助fixtureと実認証後route/SDK受け入れは区別する。

## 2026-10-09 監査指摘の補正

Browseのページャはeditorialテーマと`Collection pages`のnavigation名を使用する。既定Review pagesと他callerを保持し、44×44px以上・濃金hover・可視focus・aria-current・先頭/末尾disabledを満たす。繰り返しsize/attrフィルターを含むURL条件を保持する。[計画](../../../plans/layout-design/priority-six-audit-remediation-design-system-plan.md)。

Home（DS-PAGE-017）のmotion切替は全幅で44×44px以上を確保する。設定reduce時のdisabledと静止表示、Pause/Resume・aria-pressed・focusを保持する。

Product（DS-PAGE-019）のカテゴリ、評価フィルター、boutique操作、SKUコピーと共有操作は44×44px以上。共有SDKのinline outline resetはeditorial共有tile内のみ上書きして可視focusを確保し、共有URL/媒体/ブランドアイコンを保持する。

## P1・P2優先8画面受け入れ（2026-10-11）

対象はDS-PAGE-006/037/019/007/008/003/009/033。[計画](../../../plans/layout-design/priority-eight-purchase-acceptance-design-system-plan.md)。store限定の意味別tokensに入力境界・暗い面の罫線・画像面・overlay・暗いhoverを追加。focusは周囲の面とのcontrast 3:1以上をブラウザーで確認する。既存表示の回帰確認と新要件Redを区別し、認証後受け入れは別記録する。

### Step 1 商品一覧

商品カードの主商品リンクは明るい面で濃いfocusを使い、暗い操作パネルはgoldのfocusを保持する。editorial商品一覧の空状態は同じpurchase themeの面・文字・罫線を使用し、Explore all piecesは44px以上・可視focus・既存/browseリンクを持つ。旧variantの見た目は維持する。

### Step 2 店舗詳細

店舗heroのbreadcrumbリンクは44×44px以上、暗い面で可読focusを持つ。heroのgold/補助文字とcollection導線はpurchaseの意味別tokensへ接続し、既存rating・長文・storeのfilter/sortを保持する。

### Step 3 商品詳細

カテゴリdropdownと明るい商品情報面は濃いfocus、暗い購入面はgoldを使う。カテゴリリンクからEscapeで閉じるとtriggerへfocusを戻す。画像切替・拡大画像closeは44×44px以上。画像/variant/size/価格/在庫・レビュー・共有契約は保持する。

拡大画像はRadix DialogのPortalを使用し、独立したpurchase themeを持つ。開くとClose imageへfocusし、Tab/Shift+Tabを内部に留める。EscapeまたはCloseで元の画像triggerへfocusを戻す。背景スクロールをロックし、画像URL・選択・altとplaceholderの表示条件を保持する。


## 8画面共通役割の受け入れ（2026-10-11）

purchase-themeへcontrol-line（#877957）、line-on-dark、divider-on-dark、dark-hover、image、overlay、danger-on-darkを追加。roleごとに面との可読性を保ち、light入力境界とfocusは3:1以上。画像面・overlayは装飾役割で同じcontrast基準を直接適用しない。product-list空状態をCSS Moduleのthemeへ接続し、旧caller既定表示を保持。

[計画](../../../plans/layout-design/priority-eight-purchase-acceptance-design-system-plan.md)。API/schema/認可/金額/注文決済/PDF内容は変更せず、[overview](../../../specs/multi-vendor-ecommerce/00-overview.md)・[data model](../../../specs/multi-vendor-ecommerce/03-data-model.md)・[architecture](../../../specs/multi-vendor-ecommerce/02-architecture.md)・[interfaces](../../../specs/multi-vendor-ecommerce/04-interfaces.md)は更新不要。

### 再監査 Step 1 DS-PAGE-006 商品一覧（2026-10-14）

ProductSortの通常・hover境界は隣接面に対して3:1以上とし、Portalの選択面はpurchase-selected。並び替え時に繰り返しsizeとsearchを保持する。API/DB/認可/金額契約は不変。

### 再監査 Step 2 DS-PAGE-037 店舗詳細（2026-10-14）

店舗のProductSortにも共通の境界contrast・選択面を適用し、850px境界と空状態の/store/fixture#collection導線を回帰確認。店舗のデータ取得・rating・URL・商品操作の設計変更は不要。

### 再監査 Step 3 DS-PAGE-019 商品詳細（2026-10-14）

拡大画像はモーダルPortalとしてfocus trapとtrigger復帰を備え、背景scrollをロックする。purchase themeをPortalでcomposeしgold close/focus・dark面・44px操作を使用。既存ギャラリーとplaceholder条件は維持。

### 再監査 Step 4 DS-PAGE-007 カート（2026-10-14）

商品名の独立詳細linkは名称の長さにかかわらず44×44px以上。画像link・金額・variant/size付きURL・数量/送料契約を変更しない。

### 再監査 Step 5 DS-PAGE-008 Checkout（2026-10-14）

編集住所Portalを800px境界も含めて検証。既存値・入力境界3:1・close44px・focus復帰・選択住所保持を満たす。既存住所/coupon/注文ロックの要件・設計・タスクは変更不要。

### 再監査 Step 6 DS-PAGE-003 注文詳細（2026-10-14）

未払い初期化失敗はlight面のdanger色、再試行はcontrol-lineと可読focusを持つ。800px境界・再試行中通知・支払欄条件・単一合計を回帰確認。既存注文/決済/PDFの要件・設計・タスクは変更不要。

### 再監査 Step 7 DS-PAGE-009 比較（2026-10-14）

heroのパンくずと継続探索linkは44×44px以上。700px境界でも折返しとgold focusを保ち、明るい選択面の濃いfocusと局所スクロールを維持する。

### 再監査 Step 8 DS-PAGE-033 Wishlist（2026-10-14）

現在ページのaccent境界はhover/focusでも3:1以上の可読性を保つ。非currentのhover・44px・URL/current・既定カードと保存variantの契約を維持する。

### 購入10画面再監査 Step 1（2026-10-18）

DS-PAGE-006: sort境界・Portalのkeyboard選択、複数size/searchのURL保持、ページャ44pxとcurrent、filterと商品操作を既存実装の回帰として確認。要件・設計の追加変更なし。[今回の証跡](../design-system/PROGRESS.md#購入10画面再監査-step-1-ds-page-0062026-10-18)を参照。fixtureと認証後実routeの判定は分離する。

### 購入10画面再監査 Step 2（2026-10-18）

DS-PAGE-037: 長い店舗情報・商品カード・空状態・sort Portal・850px境界・Clear filtersのURLを既存実装の回帰として確認。要件・設計の追加変更なし。[今回の証跡](../design-system/PROGRESS.md#購入10画面再監査-step-2-ds-page-0372026-10-18)を参照。fixtureと認証後実routeの判定は分離する。

### 購入10画面再監査 Step 3（2026-10-18）

DS-PAGE-019: 拡大画像Dialogの初期focus/trap/Escape復帰、size/quantity/review/共有、在庫操作制約を既存実装の回帰として確認。要件・設計の追加変更なし。[今回の証跡](../design-system/PROGRESS.md#購入10画面再監査-step-3-ds-page-0192026-10-18)を参照。fixtureと認証後実routeの判定は分離する。
