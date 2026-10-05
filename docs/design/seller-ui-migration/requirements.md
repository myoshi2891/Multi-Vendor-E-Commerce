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
