# View history — 要件

DS-PAGE-024。認証済み顧客がlocalStorage productHistoryのvariant ID順で閲覧済み商品を再訪する。既存editorial商品カードの詳細/wishlist/compareを維持。新デザインはaccountのアイボリー/深緑/ゴールド、serif見出し、responsive grid、可視focus。loadingをstatus、失敗を汎用alertと再試行で通知。不正JSON/非配列/非string配列/未保存は空、storageアクセス不可は再試行可能な失敗。URLページングは最大7番号とcurrent indication。取得の順序/ページサイズ/範囲補正を維持。履歴の削除や新DB永続化は追加しない。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。

## P2残存表示統一（2026-10-09）

shared discoveryの空/失敗パネル・retry・読み込み文字をaccount aliasesへ統一。共有ページャーは番号44×44px以上、URL/current/disabledを保持。保存ID順・storage不正/アクセス失敗・古い応答の抑制・範囲補正・editorial商品操作は変更しない。フォロー店舗の空/失敗にも共通表示が適用されるため回帰確認する。

[計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。
