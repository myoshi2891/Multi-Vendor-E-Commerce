# P3優先8画面のデザインシステム残存対応

- 日付: 2026-10-13
- 承認: ユーザーが残存P3の8画面を選択し、計画の実装と段階コミットを依頼。
- 正本: [採用計画](design-system-adoption-plan.md) / [進捗](../../docs/design/design-system/PROGRESS.md)

## 対象・順序

| Step | ID | 画面 | 確認・対応 |
|---|---|---|---|
| 1 | DS-PAGE-049 | 管理者概要 | KPI、chart/tooltip、新規店舗状態 |
| 2 | DS-PAGE-048 | 管理者注文 | 表、詳細Portal、状態操作 |
| 3 | DS-PAGE-050 | 管理者店舗 | 長文/画像/配送情報、詳細Portal、状態/削除 |
| 4 | DS-PAGE-054 | 販売者クーポン一覧 | 検索/ページ操作、作成/編集/削除Dialog |
| 5 | DS-PAGE-053 | 販売者クーポン作成 | 日付/割引、validation、保存/再試行 |
| 6 | DS-PAGE-060 | バリアント追加 | 継承情報、動的属性/選択Portal、保存 |
| 7 | DS-PAGE-059 | バリアント編集 | 初期値/画像/属性、長文、編集/再試行 |
| 8 | DS-PAGE-065 | 店舗作成 | 独立header/theme、画像/入力/保存 |

## 実装・境界

既存dashboardのスコープ付きseller theme、production部品、p3/six fixtureとroute harnessを再利用。深緑/アイボリー/ゴールド、serif見出し、細い罫線、控えめな角丸を本体とPortalで揃える。実表示で不足を確認して最小変更し、既存適用を二重改修しない。共通変更は最初の利用画面へ含め、関連callerを回帰する。

公開API/DB schema/認可/集計/金額/状態遷移は変更しない。PropsのAction注入境界とpayloadを維持する。未実装機能追加、実保存/削除/upload、DB初期化、push/deployは対象外。

## TDD・受け入れ条件

各画面でRed→Green→Refactor→検証→仕様同期→Green状態のcommit。既存合格条件は回帰と記録しRedを創作しない。環境/adapter失敗はRedから除外する。

- 44px操作領域、keyboard、視認可能focus、入力境界/focus contrast 3:1、本文AA。
- 1440/768/390px × light/dark、長文、全体overflowなし/表局所scroll、Portal、reduced motion、axe AAと画像目視。
- 必要な通常/空/取得失敗/validation/pending/保存失敗/retry/success、duplicate lock、入力保持、dialog閉じる制御/focus復帰。
- RTLはAction引数/初期値/payload/validation/pending/retry/navigation/追加編集契約を検証。CSS文字列テストは追加しない。
- 各commit前に関連Jest/browser、bun run lint、bunx tsc --noEmit、bun run check:playwright、diff check。
- 最終はP4管理マスタ、seller登録/設定、共通Dialog/表/状態操作を回帰し、全体Jest/coverageを実測。
- 認証後routeは既存専用DB/SELLER/ADMIN状態が利用可能なら非保存操作で検証。不足時は理由/解除条件をQAへ記録しfixtureと区別する。config/server新設なし。

## 文書・コミット

計画commit → 画面別8commit → 最終統合commit。画面ごとに採用計画/台帳/進捗、admin-dashboard/seller-ui-migration要件/設計/tasks、関連SDD、TEST_IMPLEMENTATION_PLAN/QA_HANDOFFを同期。変更不要のoverview/architecture/data-modelは理由を記録。全体統計は実測後QA正本からdocs/PROGRESSへ同期、coverage-dashboard再生成。既存ID/履歴/全画面判定を保持しリンク/形式/状態と証跡を検査。

## 実施チェック

- [x] Step 1 DS-PAGE-049: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 2 DS-PAGE-048: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 3 DS-PAGE-050: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 4 DS-PAGE-054: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 5 DS-PAGE-053: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 6 DS-PAGE-060: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 7 DS-PAGE-059: 補助検証・仕様同期完了（認証後実routeは別判定）
- [x] Step 8 DS-PAGE-065: 補助検証・仕様同期完了（認証後実routeは別判定）
- [ ] 最終統合・文書同期
