# Followed stores — 要件

DS-PAGE-022。認証済み顧客が店舗名・ロゴ・followers数・follow状態・店舗URLを読み、follow/unfollowできる。新デザインはaccountのアイボリー/深緑/ゴールドとserif見出し、折り返すカード、44px操作と可視focus。空はcollection導線、取得失敗は汎用alertとreload。更新中は同一店舗の二重操作を拒否し、失敗で状態/件数を保持、成功は状態と件数を同期してstatus通知。URLページングは最大7番号、current indication、元の範囲外補正を維持。店舗一覧以外の機能や新規Message操作は追加しない。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)


### 最終判定（2026-10-05）

実装あり・補助ブラウザー検証済み・認証後実ルート検証保留。2画面の補助Chromium6/6、1440/768/390px・keyboard/focus・URL/back・axe AA contrast・長文・pending/error/retry/emptyを確認。PC/mobile画像目視。公開実ルートの未認証転送と、alias/範囲補正のRTL回帰も確認。専用test DB不在。解除条件: 専用DB/アプリ接続先一致の環境で認証後の実画面と操作を検証しtest-userを後処理。[QA](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。
