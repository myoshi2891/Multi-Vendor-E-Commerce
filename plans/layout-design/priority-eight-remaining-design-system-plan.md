# 未完了8画面のデザインシステム適用（2026-10-17）

ユーザー承認済み。対象順: DS-PAGE-066店舗一覧、046オファータグ作成、020商品転送、023フォロー転送、025履歴転送、051dashboard転送、052seller転送、013FAQ転送。

## 実装と対象外

店舗一覧は所有店舗の名前・画像・状態・管理リンク、新規作成、空・取得失敗・再試行を既存seller light/darkトークンで実装する。認可はrequireSeller、DBはqueries経由で所有者条件と表示用selectを使う。認可失敗を取得失敗に変換しない。編集・削除・検索・ページング・DB変更は追加しない。転送6件はUIを作らず既存URL/認証/ステータスを維持する。

## 受け入れと検証

新規挙動はRTL/クエリテストのRed→Green→Refactor、既存挙動は回帰と明記する。店舗取得の所有者条件・認可失敗の副作用なし、空・通常・長文・取得失敗と再試行、フォームvalidation/pending/error/retention/retry/success、転送の分岐を確認。1440/768/390px、dashboard light/dark、axe AA違反0、overflow/focus/keyboardを既存Playwright configとshared fixtureで確認する。専用DBと既存Clerkテストアカウントで実routeを確認し、未確認の必須範囲は保留にする。

関連Jest、lint、tsc、check:playwright、最終全体Jest/coverageを実行する。全体統計は実測値だけを同期する。

## コミットと文書

計画コミット→画面単位8コミット（テスト/実装/証跡/関連仕様）→最終統合コミット。採用計画・design PROGRESS・関連requirements/architecture/testing・QA_HANDOFFを同期。機能/DB仕様が不変なら変更不要理由を記録。全体実測後にcoverage dashboardと統計文書を同期する。

## 進捗

- [x] Step 1 DS-PAGE-066（実装・画面単位検証、全体最終判定は統合時）
- [x] Step 2 DS-PAGE-046（画面単位の実装/回帰・文書同期、実route最終結果は統合欄）
- [ ] Step 3 DS-PAGE-020
- [ ] Step 4 DS-PAGE-023
- [ ] Step 5 DS-PAGE-025
- [ ] Step 6 DS-PAGE-051
- [ ] Step 7 DS-PAGE-052
- [ ] Step 8 DS-PAGE-013
- [ ] 最終統合・文書同期
