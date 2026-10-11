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
