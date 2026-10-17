# Profile Payment — タスク

- [x] 計画保存、対象ID・既存仕様・呼び出し元確認。
- [x] 新RTL5件とChromium390px見出しのRed、金額回帰2件を実測。
- [x] ブランド本文/カード/操作/空/取得中/失敗/再試行、表示queryとroute loadingを実装。
- [x] Refactor後関連Jest、Chromium、lint/tsc、画像目視。
- [x] SDD、移行計画/台帳、QA/テスト計画/全体進捗、文書リンク整合を同期。

[要件](requirements.md)、[設計](design.md)、[進捗](PROGRESS.md)。コミットは明示依頼時のみ。


## 購入後6画面の共通表示（2026-10-10）

[保存計画](../../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md)。- [x] Step 2: 先行Red、Green/Refactor、補助表示検証・既存操作回帰・文書同期。
- [ ] 認証後実ルートの今回の変更受け入れ（既存ログイン状態が必要）。

## 購入10画面再監査 Step 10（2026-10-18）

- [x] キーボードページ変更/再試行のfocus消失を先行RTL/browserで再現し修正。
- [x] 成功/空/失敗とfocusを奪わないRTL、3幅とfocus contrastのbrowser回帰。
- [x] 要件・設計・SDD・計画・進捗を同期。
- [ ] 今回の認証後実route受け入れ。専用DB不在の解除条件はQA正本を参照。

[保存計画](../../../plans/layout-design/priority-ten-purchase-reaudit-design-system-plan.md)／[統合証跡](../design-system/PROGRESS.md#purchase-ten-final)。
