# P1購入導線・共通UI優先6画面

- 日付: 2026-10-06
- 承認: ユーザーの対象選定、通過状態コミット、自己レビューの選択と「Implement the plan」を再利用。
- 正本: [採用計画](design-system-adoption-plan.md)、[進捗](../../docs/design/design-system/PROGRESS.md)。

## 対象・依存関係

共通ヘッダー DS-COMP-001〜005、DS-BASE-001のストア専用subsetを先行する。全体tokens・dashboard・旧部品を一括完了にしない。

| 順序 | ID | URL | 受け入れ対象 |
|---|---|---|---|
| 1 | DS-PAGE-017 | / | account/search/country展開、reduced motion、既存home選択 |
| 2 | DS-PAGE-006 | /browse | 検索候補、URL条件保持、filters/cards/paging |
| 3 | DS-PAGE-019 | /product/[productSlug]/[variantSlug] | サイズ/数量/在庫、配送、レビュー展開、共通header |
| 4 | DS-PAGE-037 | /store/[storeUrl] | 長文、sort、商品あり/空、共通header |
| 5 | DS-PAGE-007 | /cart | 数量/削除/通知/checkout引継ぎと共通header |
| 6 | DS-PAGE-008 | /checkout | 住所dialog/coupon/pending/errorと共通header |

## 実装と対象外

- 深緑/アイボリー/ゴールド、serif見出し、細い罫線、visible focusと44px操作をストア専用CSS tokensで統一する。
- UserMenuの内部をブランド化し、Sign inのnested interactiveを解消、既存Clerk lifecycleとリンクを保持。
- 検索候補をnativeリンクにし、pending/empty/errorを通知。既存search URL、条件保持、abortを維持し古い応答を無視する。
- CountrySelectorの既存Propsを保持し、store専用variantを追加。正確なexpanded/selected、ラベル、unique IDs、Arrow/Home/End/Enter/Escapeを整備。国保存pending/error/retryを表示。English/USDは固定表示。
- 本体適用済み部品を二重に改修しない。画面別auditと意味のある回帰テストを追加し、修正が必要な残存部品だけ変更する。
- DB/API/認可/金額/在庫/決済契約と購入状態遷移は対象外。外部送信・購入・既存DB初期化を検証目的で実施しない。

## TDD・コミット

計画保存 → 共通UI → 上記6画面 → 最終統合検証の順。各単位はRed（期待した要件失敗）→Green→Refactor→検証→文書同期。Redは証跡として保存し、コミットは通過状態。既存実装の回帰はRed扱いにしない。

## 検証と完了条件

- RTL: keyboard候補リンク、search状態/URL/abort、country状態/keyboard/save失敗保持、各画面の既存動作。
- browser: 1440/768/390px、panels/長文/empty/pending/error/success、hover/focus/Tab/Enter/Escape、overflow、axe WCAG AA、reduced motion、画像目視。
- 既存playwright.design.config.tsと共通fixture serverを利用し、specはtests/browser/。fixtureを実route検証済みとして数えない。
- 関連Jest、check:playwright、lint、tsc、git diff --check、文書リンク/ID/件数/状態の照合。
- 専用test DB/Clerk不足時はcheckout認証後・SDK実表示を保留し解除条件を記録。必須チェック未実施なら画面全体を検証済みにしない。
- 更新: 採用計画、design進捗、関連SDD/画面仕様、QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、必要時COVERAGE_REPORTとdashboard。全体統計は実測のみ。
- 最後に6画面×共有部品×状態×テスト×仕様×文書×コミットの自己レビューを実施。
