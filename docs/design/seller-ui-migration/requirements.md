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
