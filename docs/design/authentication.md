# 認証画面のデザイン受け入れ

対象: DS-PAGE-001 `/sign-in`、DS-PAGE-002 `/sign-up`。

## 要件・設計

- 深緑の紹介面、アイボリーのフォーム面、ゴールドの主操作とセリフ見出し。既存store限定purchase themeをAuthFrameへ合成し、SDKは型付き共通appearanceを使用する。
- Home・コレクション・サポートとClerkのリンク/ボタンは44×44px以上。明暗面でfocusを分け、入力境界/focusは3:1以上、本文はWCAG AAを満たす。
- 1440/768/390pxと800pxのレイアウト境界で折返し・横溢れ・キーボード操作を確認。reduced-motionでは遷移を抑制する。
- リダイレクト・認証状態・エラー処理はClerkが管理し、ページからforce/fallback redirect設定を追加しない。既存のreturn destinationを保持する。
- 実認証送信・新規アカウント作成・重要操作のUserVerificationは今回の表示受け入れ対象外。初期表示の実SDKとローカル入力、appearance/redirect propsのRTLを検証する。

## 検証記録

[承認済み計画](../../plans/layout-design/priority-eight-unaccepted-design-system-plan.md) / [画面別証跡](design-system/PROGRESS.md#受け入れ未完了8画面2026-10-16)。priority-publicの実Clerkテストとauth-pages RTLを使用。認証情報を入力・送信するテストは追加しない。
