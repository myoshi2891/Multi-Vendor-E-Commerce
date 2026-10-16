# 優先7画面 — 表示要件と受け入れ基準

[保存計画](../../../plans/layout-design/priority-seven-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#優先7画面移行記録)。2026-10-05。

## 共通基盤

- 深緑・アイボリー・ゴールド、セリフ見出し、サンセリフ業務本文。状態色は危険・警告・成功の意味を保つ。
- 販売者のThemeToggleを維持。テーマはshellとopt-inのPortalへ限定し、管理者は既定表示を保持。
- 768px以上は幅300pxの常時サイドバー、未満は開閉ナビゲーション。Escapeで閉じ、起点へfocusを戻す。リンク選択時も閉じる。
- mainは狭い画面で固定左余白を持たない。表の横スクロールは表に限定。
- 1440/768/390px・light/dark・キーボード・axe AA(contrast含む)を確認。補助fixtureはClerk/認可/実ルートの証拠にしない。

## インターフェース・境界

SellerShellはServer側のsidebar/header/childrenを受け、ナビの開閉だけをClientで管理。Header/Sidebar/StoreSwitcher/ThemeToggle/CustomModalの任意design="seller"は既存利用先の既定値を変えない。PortalにCSS Moduleのthemeを直接付ける。

認可・DB/API・集計・金額・在庫・注文状態遷移は従来仕様を維持。[seller-dashboard要件](../seller-dashboard/requirements.md)を機能の正本とする。

## 出店申請（DS-PAGE-004）

4ステップ、既存StoreFormSchema/StoreShippingSchema、画像・申請payload・Pending店舗の機能を維持。説明は開閉可能、進捗はラベル付きprogressbar。フォームはnative label/validation、送信中fieldsetと前後操作をロック、二重送信防止、失敗時は値を維持し汎用エラーと再送操作を提示。applySellerActionはpageから注入。完了はstatusとHomeリンク。レイアウトは自然スクロール、768px未満は縦配置、reduced-motionを尊重。Clerk/Cloudinary実描画・認証後実ルートは保留。

## 店舗概要（DS-PAGE-058）

既存の6KPI・売上推移・最近の注文・上位商品を保持。KPI/sectionは見出しとして認識可能。空の売上は説明、商品・注文の空状態を維持。親ルートのloading/statusとerror/再読み込みを共通部品で用意。チャートのブランド色/軸文字はseller opt-inで管理者表示を保持。

## 商品一覧（DS-PAGE-062）

Products見出し、ラベル付き検索、商品名/バリアント/カテゴリ/オファー/ブランド/追加操作を表示。商品色は元の色を保ち、欠画像も操作可能な編集リンクを示す。サイズ価格は表示項目に投影しDecimalを数値化（ドル単位、/100なし）。列定義はClient内でactionを受け取るfactoryから生成。作成モーダル、別ページ作成リンク、既存ProductDetailsのvalidation/payloadを維持し、sellerではラベル付きnative国複数選択を使用。作成/削除dialogのthemeとfocusを維持。削除は確認中のpending lock、失敗時dialogを維持して再試行可能。取得失敗は空と区別して再読み込みを提示。作成/属性/削除はServerから型付きaction Propsを注入し、他フォームルートも配線のみ同期する。

## 在庫管理（DS-PAGE-055）

数量/しきい値はラベル付き整数入力、保存/Enter、処理中disabled、汎用errorと再試行、成功statusを備える。失敗時は確定値を表示し、再試行で失敗した値を再送。判定・金額・所有権・更新queryは維持。検索で空と取得失敗を区別する。

## 注文一覧（DS-PAGE-057）

STORE_ORDERS_MAXの上限、ID検索、金額、商品画像と名称、支払状態、注文/明細状態編集と配送・支払・住所・顧客詳細を維持。取得失敗は空と区別。状態は既存enum全選択肢を表示し、明示保存、処理中ロック、汎用error、選択値保持、再試行、成功statusを備える。詳細はテーマをPortalへ渡し、Escapeで閉じトリガーへfocus復帰。SellerOrderRowは表示項目を投影し金額をnumber化（ドル単位を維持・再計算なし）。既存管理者向け列とフォームは変更なし。

## メッセージ（DS-PAGE-056）

DS-PAGE-056: 購入者名/画像での識別、最新メッセージが購入者発かつ未読の場合の表示、選択時の既読更新、取得/既読errorとretry、送信draft保持・成功後クリア/再取得、5秒poll/hidden/unmount/staleを維持。PC2ペイン、1000px以下で一覧/スレッド切替と戻りfocus復帰。共通thread/CSSをopt-in拡張し購入者の既定表示を維持、左右の購入者発判定を維持し販売者のsenderラベルをBuyer/Youにする。関連RTL40/40、補助Chromium6/6。認証後の実送受信/SDK実描画は保留。[販売者要件](../seller-ui-migration/requirements.md)／[証跡](../design-system/PROGRESS.md#優先7画面移行記録)。

## 最終guest検証と表示整理（2026-10-05）

実Next.jsの申請guest表示でロゴと旧Sign in buttonのコントラスト不足を検出し、申請内のBrand CSS変数とMinimalHeader opt-in、Sign in/Sign upの単一anchorで修正。実guest3幅の全document axe AAと6保護ルートのguest redirectを計5ケースで検証。検索input/iconは同一行、表見出し/商品列は可読幅を確保し、上位商品名は折り返す。旧色/管理者など他scopeを維持。認証後とSDK内部の保留は継続。

### 申請SSR/reduced-motionの回帰修正（2026-10-05）

実ルート画像確認で、reduced-motionのSSR初期opacity0と初回Client描画の差によるhydration警告/本文非表示を検出。実guest3幅のconsole hydration警告なし・Sign upと親のopacity表示を先行テストでRed確認し、初期表示を両環境でvisibleに統一、reduced-motionではtransition0として修正。実guest5/5、申請補助3/3と全体Jestを再実行。認証SDKの設定画面内部とは別の実ルート検証。

## 優先6画面の表示要件

DS-PAGE-061 商品登録: RTLの見出しRed1件・フォーム保存Red1件、ブラウザーの見出しRedと目視後の追加Redを確認。Green/Refactor後の関連Jest50/50、補助Chromium6/6（1440/768/390px・light/dark・focus・カテゴリPortal・axe contrast含む）、画像目視、lint errors0（既存warnings10）、tsc0、harness成功。ProductDetailsのseller opt-in・見出し階層・保存lock/汎用error/retry/status、画像とキーワードの縦配置・動的行の折り返し・旧青色を整理。 実ルートとSDK受け入れは保留。[計画](../../../plans/layout-design/priority-six-design-system-plan.md)。

DS-PAGE-060 バリアント追加: 新要件RTL1件の見出しRedを確認。最小実装・既存フォーム再利用後の関連Jest46/46。商品情報の初期値と既存null応答、action Propsを維持。ブラウザーのカテゴリ操作可否は既存仕様に合わせ、商品名/説明/brand非表示とカテゴリ継承を確認する。 実ルートとSDK受け入れは保留。[計画](../../../plans/layout-design/priority-six-design-system-plan.md)。

DS-PAGE-059 バリアント編集: 新要件RTL1件の見出しRed、保存後axeで既存Radix toastのaria-hidden-focus/button-nameをRed確認。seller opt-inではフォーム内status/alertへ統一し、旧scopeのtoastは維持。Refactor後関連Jest69/69（編集ownership/属性/商品一覧含む）、補助Chromium6/6（3幅/light/dark・初期価格12.5・pending lock/error/retry/success/refresh・overflow・axe contrast含む）、lint errors0/warnings10・tsc0・harness成功。 実ルートとSDK受け入れは保留。[計画](../../../plans/layout-design/priority-six-design-system-plan.md)。

DS-PAGE-064 配送設定: 先行RTL4件で見出し/名前付きform/Action境界不足をRed確認。重複submit再現のRedを同期submit guardで修正。Refactor後Jest90/90（商品dialog/seller shell/store queries含む）、補助Chromium6/6（3幅/light/dark・国別検索・12.5ドル初期値・Portal・pending lock/close防止/error/retry/success・Escape focus復帰・overflow・axe contrast含む）、lint errors0/warnings10・tsc0・harness成功。表示用数値へserializeし単位を維持。 実ルートとSDK受け入れは保留。[計画](../../../plans/layout-design/priority-six-design-system-plan.md)。

DS-PAGE-063 店舗設定: 先行RTL2件でページheading/名前付きform/送信中ロック不足をRed確認。共通StoreDetailsを画像・連絡先のレスポンシブ配置へ整理し、Server注入Actionとinline status/alertを導入。型変更に必要な店舗作成呼び出し元のAction注入だけ先行し、同画面の本体移行は未完了。Refactor後関連Jest91/91（store query認可・配送・商品dialog含む）、補助Chromium6/6（3幅/light/dark・画像upload adapter・featured・pending lock/error/値保持/retry/success/refresh・overflow・axe contrast含む）、画像目視、lint errors0/warnings10・tsc0・harness成功。DBはフォームに必要な列のみselectし、既存redirectと例外伝播を維持。 実ルートとSDK受け入れは保留。[計画](../../../plans/layout-design/priority-six-design-system-plan.md)。

DS-PAGE-065 店舗作成: 先行RTL2件でmain/h1/theme control不足と新規IDがAPI更新branchへ誤接続する問題をRed確認。店舗別Shell外に専用テーマ枠とThemeToggleを用意し、既存upsertStoreの作成契約に合わせ新規のみidを省略（query/認可/schemaは変更なし）。更新idは維持。Refactor後関連Jest93/93、補助Chromium6/6（3幅/light/dark・theme Portal・空/画像validation・upload adapter・pending lock/error/値保持/retry/success/返却URL・overflow・axe contrast含む）、lint errors0/warnings10・tsc0・harness成功。 実ルートとSDK受け入れは保留。[計画](../../../plans/layout-design/priority-six-design-system-plan.md)。


最終監査の要件: 商品画像の削除はキーボードで操作でき、番号付きの名前を持つ。配送表のスクロール領域は空状態でもフォーカス可能。店舗URLを変更して保存した場合は返却URLのsettingsへ移動し、同一URLの場合はrefreshする。[設計](design.md)。

## 販売者クーポン デザイン移行（2026-10-05）

深緑・アイボリー・ゴールド、セリフ見出し、ラベル・focus・状態通知、1440/768/390pxで全体横溢れなし。業務画面はlight/dark、Portal・pending/error/retry/successを含める。既存データ/業務契約を維持。

証跡: [P3移行記録](../design-system/PROGRESS.md#p3優先6画面移行記録)。

## クーポン作成 デザイン移行（2026-10-05）

深緑・アイボリー・ゴールド、セリフ見出し、ラベル・focus・状態通知、1440/768/390pxで全体横溢れなし。業務画面はlight/dark、Portal・pending/error/retry/successを含める。既存データ/業務契約を維持。

証跡: [P3移行記録](../design-system/PROGRESS.md#p3優先6画面移行記録)。


## 販売者優先8画面残存移行

2026-10-10。[保存計画](../../../plans/layout-design/priority-eight-seller-residual-design-system-plan.md). 既存本体適用と今回の残存受け入れを区別する。

### 共通基盤

共有ナビとsellerテーマ切替は44px以上。面・状態色・focusを既存のスコープ付きテーマから参照する。

### Step 1 店舗概要 — DS-PAGE-058

KPIカードはサイドバーを除いた利用可能幅に応じて列数を変え、160px以上の可読幅を保つ。大きな金額・長い商品名は面の内側で折り返す。6指標・売上推移・注文・商品・空状態は維持する。

### Step 2 商品一覧 — DS-PAGE-062

検索・新規作成・新規バリアント・行操作・削除確認・作成Dialogの主要操作を44px以上にする。Dialog closeは44×44px、Portalもlight/darkの面・文字・focusを継承する。

### Step 3 在庫 — DS-PAGE-055

数量・しきい値・保存・再試行は44px以上。保存成功は文字とブランド成功色で通知し、在庫切れ/過小在庫の意味色と判定を維持する。

### Step 4 注文 — DS-PAGE-057

状態select・保存・再試行・詳細起動は44px以上。成功はブランド成功色、Paidは成功、Pending/PartiallyRefundedは警告、Failed/Declined/ChargeBackは危険色と状態文字を併用する。他状態は中立表示。

### Step 5 メッセージ — DS-PAGE-056

未読会話にはUnread文字と読み上げ説明を表示し、既読更新失敗時は維持、成功時に解除する。seller操作寸法/focusはseller-touch/ringに追従し、選択・送信・戻る・下書き・pollの既存挙動を維持する。

### Step 6 商品登録 — DS-PAGE-061

商品入力/選択/動的行/画像/キーワード操作は44px以上。属性ENUM/BOOLEANのPortalはseller themeと操作寸法を継承し、仕様重複の警告はwarning/cardトークンを使う。キーワードは名前付きbuttonで削除可能。checkboxは小さい表示器と大きなlabel操作領域を分離する。

### Step 7 配送 — DS-PAGE-064

既定配送・国別編集の入力と保存・再試行は44px以上。国別Actionsは44×44px、編集メニューは44px、成功はブランド成功色。Default/Free/数値単位と既存国検索・料金12.5ドルを維持する。

### Step 8 店舗設定 — 操作と保存状態

店舗設定の入力・保存・Featuredラベルは44px以上の操作領域を持ち、保存成功を意味色で表示する。失敗時の入力値を保持して再試行できる。


## ストアフロント残存8画面 Step 8（2026-10-12）

出店申請はpurchase tokens、説明summary/前後/完了導線44px、フォーム境界3:1。四段階、validation/入力保持/pending/error/retry/successとpayloadを維持。

[承認済み計画](../../../plans/layout-design/priority-eight-storefront-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)。補助検証と実認証/SDK受け入れを区別する。


### ストアフロント残存8画面・最終受け入れ（2026-10-12）

今回の表示変更は実装・関連仕様同期・3幅の補助/実route確認を完了。pending/error/retry/successはadapter/RTL、実routeは読取の表示確認として区別する。実followingは空、履歴は既存商品あり、申請はguest/認証後第1段階。実更新/送信/uploadの既存保留は維持。[最終証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)／[QA正本](../../testing/QA_HANDOFF.md#ds-storefront-eight-acceptance)。


### P3残存8画面 Step 4（2026-10-13）

DS-PAGE-054 販売者クーポン一覧: 作成/編集triggerと編集Portalの入力・保存操作を44pxへ拡張。コード検索/日付/STORE scope/削除/取得失敗/入力保持/retry/閉じるlock/focus復帰を維持。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 5（2026-10-13）

DS-PAGE-053 販売者クーポン作成: standalone CouponFormへcontrols・成功意味色を接続。seller light input tokenを50%へ調整し実境界contrast3:1以上を確保。入力/payload/日付/割引/保存/入力保持/retry/navigationを維持。共通callerを最終回帰する。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 6（2026-10-13）

DS-PAGE-060 バリアント追加: seller限定Select/属性Portalへpopover opt-inを追加し、3px角丸・影なし・popover面/文字tokenを適用。カテゴリ/継承項目/属性scope/payloadとEscape復帰を維持。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 7（2026-10-13）

DS-PAGE-059 バリアント編集: seller限定の動的行削除は残る行の先頭入力へfocusを戻す。最低1行の削除buttonをdisabledにし、既定caller/価格/画像/属性/値保持/保存payloadを維持。useLayoutEffectでDOM更新後にfocusし入力編集では移動しない。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 8（2026-10-13）

DS-PAGE-065 店舗作成: 独立headerのworkspaceリンクを44pxとhoverへ接続し、ThemeToggle Portalへ既存popover opt-inを適用。フォーム/payload/no-id/返却URL/画像adapter/Featured/validation/pending/error/retryを保持。sixのupsertStore adapterを現行のok/id/url結果へ修正（業務コード変更なし）。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


## 受け入れ未完了8 Step 8（2026-10-16）

DS-PAGE-004 出店申請。既存実装の回帰確認（新規Redなし・追加改修不要）。seven apply6/6: 3幅の4段階・入力保持・upload adapter・validation/pending/error/retry/success・説明summary/44px/focus・axe AA。認証後read-only1/1内3幅、guest3/3。Contact/About/申請関連RTL計17/17。実routeのClerk読込とPrevious無効/Next有効の準備完了を待ち、動的DOM列挙のraceを解消（製品Redではない）。PC/390px画像目視、型0・lint0 errors/既存8 warnings。実Cloudinary upload/申請保存は対象外で既存保留を維持。既存4段階・schema・payload・業務契約は変更不要。 [証跡](../design-system/PROGRESS.md#受け入れ未完了8画面2026-10-16)。


### 販売者8再監査 Step 1 DS-PAGE-058（2026-10-16）

店舗概要: 既存実装の回帰確認（新規Redなし・追加改修不要）。大きな注文金額のfixture/ブラウザー回帰を追加。seven residual overview 6/6（3幅×light/dark・KPI/注文金額の面内表示・空・axe AA）、390px dark画像目視。関連Jest150/150、型0・lint0 errors/既存8 warnings。 [保存計画](../../../plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md)。既存台帳・認証後実業務の過去履歴を維持。API/DB/認可/計算/payload/URLは変更不要。


### 販売者8再監査 Step 2 DS-PAGE-062（2026-10-16）

商品一覧: 既存実装の回帰確認（新規Redなし・追加改修不要）。seven residual products 6/6（3幅×light/dark・44px・削除確認・作成Dialog・Escape focus復帰・axe AA）、390px dark画像目視。関連Jest150/150、型0・lint0 errors/既存8 warnings。 [保存計画](../../../plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md)。既存台帳・認証後実業務の過去履歴を維持。API/DB/認可/計算/payload/URLは変更不要。


### 販売者8再監査 Step 3 DS-PAGE-055（2026-10-16）

在庫管理: TDD Red: 無効な入力にaria-invalid/説明関連付けがなくRTL1件失敗。Green: invalid時のみエラーIDをaria-describedbyに関連付け、再入力で解除。RTL7/7・seven residual inventory6/6（3幅×light/dark・validation/Enter/pending/error/retry/success・44px・axe AA）。390px dark画像目視。型0・lint0 errors/既存8 warnings。 [保存計画](../../../plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md)。既存台帳・認証後実業務の過去履歴を維持。API/DB/認可/計算/payload/URLは変更不要。


### 販売者8再監査 Step 4 DS-PAGE-057（2026-10-16）

注文一覧: 既存実装の回帰確認（新規Redなし・追加改修不要）。seven residual orders6/6（3幅×light/dark・保存失敗/値保持/retry/success・支払意味色・詳細Dialog・Escape focus復帰・44px・axe AA）。390px dark画像目視、関連Jest150/150、型0・lint0 errors/既存8 warnings。 [保存計画](../../../plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md)。既存台帳・認証後実業務の過去履歴を維持。API/DB/認可/計算/payload/URLは変更不要。


### 販売者8再監査 Step 5 DS-PAGE-056（2026-10-16）

メッセージ: 既存実装の回帰確認（新規Redなし・追加改修不要）。seven residual messages8/8（1440/1000/768/390px×light/dark・seller tokens/未読説明/既読失敗とretry/モバイル戻りfocus・axe AA）。390px dark画像目視。関連Jest150/150、型0・lint0 errors/既存8 warnings。 [保存計画](../../../plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md)。既存台帳・認証後実業務の過去履歴を維持。API/DB/認可/計算/payload/URLは変更不要。


### 販売者8再監査 Step 6 DS-PAGE-061（2026-10-16）

商品登録: 既存実装の回帰確認（新規Redなし・追加改修不要）。six product6/6（3幅×light/dark・見出し/画像/カテゴリPortal/入力focus/overflow/axe AA）。390px dark・1440px light画像目視、関連Jest150/150と全体実行内product-details合格、型0・lint0 errors/既存8 warnings。属性と共有variantの最終suite結果は最終統合に記録。 [保存計画](../../../plans/layout-design/priority-eight-seller-reaudit-design-system-plan.md)。既存台帳・認証後実業務の過去履歴を維持。API/DB/認可/計算/payload/URLは変更不要。
