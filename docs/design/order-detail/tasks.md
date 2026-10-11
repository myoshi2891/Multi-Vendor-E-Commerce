# Order detail — tasks

- [x] 承認済み計画を保存し、先行RTLのRedを確認。
- [x] 表示／action Props／操作状態を実装し、Refactor後の関連Jest・lint・tscを確認。
- [x] supplemental Chromiumで1440／768／390px、keyboard／focus／dialog、axe（contrast除外なし）、画像目視を確認。
- [x] 要件・設計・SDD・移行計画・進捗・QAを同期。
- [ ] 専用テストDBとClerkの認証後実ルート・SDK実描画を確認。保留理由と解除条件は[QA](../../testing/QA_HANDOFF.md#ds-purchase-browser)と[証跡](../design-system/PROGRESS.md#checkout-order移行記録)を参照。

未コミット。ページ全体の状態は保留（実装あり）。

- [x] 2026-10-08: store variant状態タグ、34状態の互換/明暗祖先/3幅/AAと注文回帰。[証跡](../design-system/PROGRESS.md#購入導線残存部品6画面移行記録)。実認証後route/SDKは保留。


## 優先8画面受け入れ（2026-10-11）

- [x] breadcrumb・invoice失敗/retryを3幅でTDD検証。関連Chrome15/15、Jest11/11、lint 0 errors/8既存warnings、tsc exit0、390px画像目視。
- [ ] 実認証後ルート/決済SDK受け入れは最終QAの既存環境条件待ち。
