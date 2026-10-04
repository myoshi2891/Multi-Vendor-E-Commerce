# P2優先5画面 デザインシステム適用計画

- 日付: 2026-10-05。ユーザー承認済み（対象5画面・Red/Green/Refactor分割コミット）。
- 基準: [移行計画](design-system-adoption-plan.md)、[運用](../../.agent/skills/design-system-workflow/SKILL.md)。
- 対象順: DS-PAGE-016 offers → DS-PAGE-012 dispute → DS-PAGE-035 report-problem → DS-PAGE-022 following → DS-PAGE-024 history。
- 対象部品: SupportForm DS-COMP-093（ブランド表示再利用）、FollowingContainer DS-COMP-086。商品一覧/editorial商品カードと既存profile枠は再利用。新規部品は台帳204以降に連番登録する。
- 対象外: Clerk設定、P1 checkout/orderの実ルート検証保留解消、全体テーマ、DB/API/認可/金額/既存クエリ契約の変更、旧共有カードとPaginationの全面移行。

## 実装と受け入れ条件

1. Offers: 深緑/アイボリー/ゴールド、serif見出し、細い罫線、一覧/空/読込/失敗。既存タグ順・商品数・browseリンク維持。
2. Dispute: ブランドフォームとパンくず。DISPUTE/必須UUID注文番号/申立ラベルを維持。
3. Report problem: 同じフォーム表示、PROBLEM_REPORT/注文番号欄なし/報告ラベルを維持。
4. Following: 専用ブランド店舗カード、店舗リンク、空/読込/失敗、Action Propsによるfollow操作、pending重複防止、成功/失敗通知。URLリンクページングと範囲補正維持。
5. History: Server→Client Action Props境界、localStorage productHistoryの既存順、editorial商品カード、読込/空/失敗・再試行、URLページング・範囲補正維持。不正保存値は安全な空状態、storageアクセス失敗は再試行可能なエラー。

## TDD・コミット

- 各画面: Redテスト→意図した失敗確認→Redコミット→最小実装Green→コミット→Refactor（変更があれば別コミット）→文書同期コミット。
- Redの期待した失敗だけをユーザー承認の例外とする。環境エラーや型/lintエラーは例外にしない。
- 回帰テストは既存実装の回帰として記録。テスト補完は原則ファイル別コミット。
- 各段階の関連Jest→tsc→lint、Refactor後の最終確認。git diff --checkと明示ファイルのstage。

## 検証

- RTL: リンク/タグ数/空/エラー、カテゴリー別payload/UUID/送信ロック/入力保持/再試行/受付、follow pending/成功/失敗、history storage/取得順/キャンセル/再試行/ページ補正。
- Chromium: 1440/768/390px、長文、overflow、keyboard/focus、reduced-motion、axe AA contrast。実ルートと認証戻り先を確認。送信とfollow mutationはmock、実チケット送信やseed/resetをしない。
- 認証/DB環境で実ルート検証ができなければ、補助ブラウザfixtureで表示確認し、対象を実装あり・検証保留とする。理由と解除条件を記録。
- 最後にJest全体の統計を実測。部分結果を全体値へ足さない。

## 文書同期と完了条件

- offers/support-formsのrequirements/design/tasks/PROGRESS、following/history新規同形式文書。
- SDD 01/02/04/05/07を最小更新、00/03/06/08の変更要否を確認して理由を記録。
- 移行計画と[進捗](../../docs/design/design-system/PROGRESS.md): ID状態・日付・Red/Green/Refactor・コマンド結果・commit・状態別確認範囲。
- QA_HANDOFFを最初に更新し、実測値を07-testing/COVERAGE_REPORT/docs/PROGRESSへ同期。テスト計画に該当Step追記。coverage:dashboard再生成と統計文書を同じdocs commit。
- 必須検証と文書同期が揃った項目だけ検証済み。保留は実装有無・理由・解除条件を明記。

## 実施チェック

- [ ] Step 1 Offers
- [ ] Step 2 Dispute
- [ ] Step 3 Report problem
- [ ] Step 4 Following
- [ ] Step 5 History
- [ ] 最終検証・統計・文書同期
