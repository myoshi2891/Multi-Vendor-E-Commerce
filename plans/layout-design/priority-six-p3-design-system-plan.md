# 未適用P3・6画面のデザインシステム移行

- 日付: 2026-10-05
- 承認: ユーザーが未適用P3の6画面、画面別Green後コミット、Codex最終差分監査を選択し実装を依頼。
- 正本: [採用計画](design-system-adoption-plan.md)／[進捗](../../docs/design/design-system/PROGRESS.md)

## 対象・順序

| Step | ID | 対象 |
|---|---|---|
| 1 | DS-PAGE-049 | 管理者概要 `/dashboard/admin` |
| 2 | DS-PAGE-048 | 管理者注文 `/dashboard/admin/orders` |
| 3 | DS-PAGE-050 | 管理者店舗 `/dashboard/admin/stores` |
| 4 | DS-PAGE-054 | 販売者クーポン `/dashboard/seller/stores/[storeUrl]/coupons` |
| 5 | DS-PAGE-053 | 販売者クーポン作成 `同 /coupons/new` |
| 6 | DS-PAGE-015 | Legal `/legal` |

## 実装・境界

既存sellerテーマ・responsive shellを再利用し管理者用見出し/ナビ名を追加。固定300px余白をモバイルで解消。概要の統計/グラフ/最近の活動、注文/店舗の表・詳細・状態操作・削除確認を移行。Client Action直接importをServer注入の型付きProps/列factoryへ置換。検索/並べ替え/ページ操作の既存能力とURL/query契約は保持し新機能を追加しない。取得失敗を空一覧と区別し再試行を提供。

販売者クーポンはSellerPage、code検索、作成/編集/削除dialogを統一。作成と更新のpayload・日付/discount・store scope・保存後遷移を維持。pending重複防止/閉じるlock/error/入力保持/retry/statusを確認。Legalは既存3本文/プレースホルダ/metadata/アンカーを保持し専用ブランド表示を提供する。

DB/API/認可/集計・計算/状態遷移/法務本文は変更しない。既存保留解除、P4本文、仮実装店舗一覧、push/deployは対象外。管理者共通枠が波及するP4と共有部品既存利用先は回帰対象。新規部品IDは219以降、既存IDは保持。

## TDD・受け入れ条件

画面単位でRed→Green→Refactor→検証→仕様/進捗同期→コミット。Red失敗理由/コマンドを記録し失敗状態はコミットしない（ユーザー選択をTDD規約のフェーズ別コミットより優先）。共有実装は最初の利用画面に含める。

- RTL: heading/label、Action Props、URL/query保持、code検索、初期値/payload、validation/pending/error/retry/success、削除・状態変更、保存後遷移。
- browser: 1440/768/390px、業務light/dark、長文/空/失敗、hover/focus/Tab/Enter/Escape、dialog trap/復帰、局所table scroll/全体overflow、reduced-motion、axe AA（contrast除外なし）、画像目視。
- playwright.design.config.tsへsuiteを追加、tests/browser/へspec、既存shared fixture serverを使用。独自config/server実装を増やさない。Legalは公開実ルートも検証。
- 各画面commit前: 関連Jest/browser、bun run lint、bunx tsc --noEmit、bun run check:playwright。最終全体Jestと既存seller/共有利用先回帰。
- 認証後実ルート/SDKはschema-current専用test DB/Clerkテスト環境で検証。環境が不足すれば補助検証と区別し理由/解除条件付き保留、fixtureだけで検証済みにしない。実DB削除/外部送信/seed/resetは実施しない。

## 文書同期・漏れ監査

画面ごとに本体/展開UI/Portal/状態/操作/関連利用先/証跡を記録し最終Codex差分監査。採用計画・画面/部品台帳・進捗、admin-dashboard/seller-ui-migration/storefront-static-pages仕様、SDD/TEST_IMPLEMENTATION_PLAN/QA_HANDOFFを同期。変更不要の仕様に理由を残す。全体Jest統計とcoverageは実測しQA正本から同期、dashboard再生成を最終証跡commitに含める。リンク/Markdown/66画面件数/ID一意性/状態と証跡/diff-checkを確認。

## 実施チェック

- [x] DS-PAGE-049: TDD/実装/検証/文書同期/commit
- [x] DS-PAGE-048: TDD/実装/検証/文書同期/commit
- [ ] DS-PAGE-050: TDD/実装/検証/文書同期/commit
- [ ] DS-PAGE-054: TDD/実装/検証/文書同期/commit
- [ ] DS-PAGE-053: TDD/実装/検証/文書同期/commit
- [ ] DS-PAGE-015: TDD/実装/検証/文書同期/commit
- [ ] 最終Codex監査・回帰・統計・文書整合
- [ ] 認証後5実ルート/実SDKの受け入れ確認
