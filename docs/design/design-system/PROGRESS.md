# デザインシステム移行 — 進捗ノート

- 更新日: 2026-09-30
- 状態: 運用文書・ルール整備済み／個別移行は継続
- 対象・優先度・受け入れ条件: [移行計画](../../../plans/design-system-adoption-plan.md)。
- 実施手順: [design-system-workflow](../../../.agent/skills/design-system-workflow/SKILL.md)。
- 運用整備計画: [design-system-workflow-plan](../../../plans/design-system-workflow-plan.md)。
- 全体進捗: [docs/PROGRESS.md](../../PROGRESS.md)。全体テスト統計の正本: [QA_HANDOFF](../../testing/QA_HANDOFF.md)。

## 現在地と次の作業

この文書は画面・部品の移行状態と検証証跡の正本。66ページ定義と200部品項目を2026-09-30のソース監査から初期登録した。ソース判定は本体適用8、未適用50、仮実装1、転送専用7。これらは検証済み件数ではない。compare移行後のソース判定は本体適用9・未適用49（仮実装1・転送専用7は不変）。

About・Contact・sign-in・sign-upは前セッションで実装・一部検証済みだが、移行全体の受け入れ条件と関連文書同期の確認が残るため「実装済み」で登録する。他の本体適用ページも周辺部品・表示状態の確認が残る。部品台帳はすべてTODOで開始する。

次の着手はDS-BASE-001（共通トークンの適用範囲・ライト／ダーク・Portalの設計）。P1の基本操作・ヘッダー展開・モーダルを先行し、カート→checkout→注文・支払いへ進む。既存適用画面の回帰確認を受け入れ条件に含める。今回の文書整備は画面移行の完了数には含めない。

## 状態と更新方法

| 状態 | 判断基準 |
|---|---|
| TODO | 未着手、または既存適用の監査・受け入れ確認が残る |
| 対応中 | 計画を保存し、テスト・実装・確認を進めている |
| 実装済み | 実装あり。必須検証・仕様書確認／更新・計画同期のいずれかが残る |
| 検証済み | 対象の受け入れ条件、検証、関連文書同期が揃っている |
| 保留 | 理由と解除条件を記録し、作業を止めている |

IDは固定する。並べ替えや追加でも既存IDを振り直さない。実施時は台帳の証跡欄を、この文書の実施記録へのリンクに置き換える。共通部品の変更だけで呼び出し先を一括完了扱いしない。転送専用は戻り先の回帰確認、仮実装は機能課題の切り分け、旧部品は利用確認を先に行う。

保留には実装の有無、未検証範囲、理由、解除条件を記録する。部品の完了時は移行計画の対応チェックも更新する。台帳と詳細記録の状態が一致することを確認する。

## 共通基盤・運用

| ID | 優先度 | 対象 | 状態 | 証跡・次の作業 |
|---|---|---|---|---|
| DS-BASE-001 | P1 | ブランドトークン・状態色・適用範囲・Portal・ライト／ダーク | TODO | 波1の計画と先行テストを保存する |
| DS-OPS-001 | 運用 | 計画先行・TDD・検証・文書同期のルールと台帳整備 | 検証済み | [運用整備記録](#運用整備記録) |

## 画面台帳

優先度「周辺部品を監査」「回帰検証」は元計画の分類を維持し、P1共通基盤の変更と同時に回帰確認する。「未実施」はこの台帳の受け入れ確認が未実施という意味。

| ID | URL | ソース判定 | 優先度 | 状態 | 対象ファイル | 証跡・次の作業 |
|---|---|---|---|---|---|---|
| DS-PAGE-001 | `/sign-in` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(auth)/sign-in/[[...sign-in]]/page.tsx](<../../../src/app/(auth)/sign-in/[[...sign-in]]/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-002 | `/sign-up` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(auth)/sign-up/[[...sign-up]]/page.tsx](<../../../src/app/(auth)/sign-up/[[...sign-up]]/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-003 | `/order/[orderId]` | 未適用 | P1 | TODO | [src/app/(fullscreen)/order/[orderId]/page.tsx](<../../../src/app/(fullscreen)/order/[orderId]/page.tsx>) | 未実施 |
| DS-PAGE-004 | `/seller/apply` | 未適用 | P3 | TODO | [src/app/(fullscreen)/seller/apply/page.tsx](<../../../src/app/(fullscreen)/seller/apply/page.tsx>) | 未実施 |
| DS-PAGE-005 | `/about` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/about/page.tsx](<../../../src/app/(store)/about/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-006 | `/browse` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/browse/page.tsx](<../../../src/app/(store)/browse/page.tsx>) | 未実施 |
| DS-PAGE-007 | `/cart` | 未適用 | P1 | TODO | [src/app/(store)/cart/page.tsx](<../../../src/app/(store)/cart/page.tsx>) | 未実施 |
| DS-PAGE-008 | `/checkout` | 未適用 | P1 | TODO | [src/app/(store)/checkout/page.tsx](<../../../src/app/(store)/checkout/page.tsx>) | 未実施 |
| DS-PAGE-009 | `/compare` | 本体適用（2026-09-30移行） | P2 | 検証済み | [src/app/(store)/compare/page.tsx](<../../../src/app/(store)/compare/page.tsx>) | [compare実施記録](#compare移行記録) |
| DS-PAGE-010 | `/contact` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/contact/page.tsx](<../../../src/app/(store)/contact/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-011 | `/customer-service` | 未適用 | P2 | TODO | [src/app/(store)/customer-service/page.tsx](<../../../src/app/(store)/customer-service/page.tsx>) | 未実施 |
| DS-PAGE-012 | `/dispute` | 未適用 | P2 | TODO | [src/app/(store)/dispute/page.tsx](<../../../src/app/(store)/dispute/page.tsx>) | 未実施 |
| DS-PAGE-013 | `/faq` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/faq/page.tsx](<../../../src/app/(store)/faq/page.tsx>) | 未実施 |
| DS-PAGE-014 | `/faqs` | 未適用 | P3 | TODO | [src/app/(store)/faqs/page.tsx](<../../../src/app/(store)/faqs/page.tsx>) | 未実施 |
| DS-PAGE-015 | `/legal` | 未適用 | P3 | TODO | [src/app/(store)/legal/page.tsx](<../../../src/app/(store)/legal/page.tsx>) | 未実施 |
| DS-PAGE-016 | `/offers` | 未適用 | P2 | TODO | [src/app/(store)/offers/page.tsx](<../../../src/app/(store)/offers/page.tsx>) | 未実施 |
| DS-PAGE-017 | `/` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/page.tsx](<../../../src/app/(store)/page.tsx>) | 未実施 |
| DS-PAGE-018 | `/product-support` | 未適用 | P3 | TODO | [src/app/(store)/product-support/page.tsx](<../../../src/app/(store)/product-support/page.tsx>) | 未実施 |
| DS-PAGE-019 | `/product/[productSlug]/[variantSlug]` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx](<../../../src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx>) | 未実施 |
| DS-PAGE-020 | `/product/[productSlug]` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/product/[productSlug]/page.tsx](<../../../src/app/(store)/product/[productSlug]/page.tsx>) | 未実施 |
| DS-PAGE-021 | `/profile/addresses` | 未適用 | P2 | TODO | [src/app/(store)/profile/addresses/page.tsx](<../../../src/app/(store)/profile/addresses/page.tsx>) | 未実施 |
| DS-PAGE-022 | `/profile/following/[page]` | 未適用 | P2 | TODO | [src/app/(store)/profile/following/[page]/page.tsx](<../../../src/app/(store)/profile/following/[page]/page.tsx>) | 未実施 |
| DS-PAGE-023 | `/profile/following` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/following/page.tsx](<../../../src/app/(store)/profile/following/page.tsx>) | 未実施 |
| DS-PAGE-024 | `/profile/history/[page]` | 未適用 | P2 | TODO | [src/app/(store)/profile/history/[page]/page.tsx](<../../../src/app/(store)/profile/history/[page]/page.tsx>) | 未実施 |
| DS-PAGE-025 | `/profile/history` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/history/page.tsx](<../../../src/app/(store)/profile/history/page.tsx>) | 未実施 |
| DS-PAGE-026 | `/profile/messages` | 未適用 | P2 | TODO | [src/app/(store)/profile/messages/page.tsx](<../../../src/app/(store)/profile/messages/page.tsx>) | 未実施 |
| DS-PAGE-027 | `/profile/orders/[filter]` | 未適用 | P2 | TODO | [src/app/(store)/profile/orders/[filter]/page.tsx](<../../../src/app/(store)/profile/orders/[filter]/page.tsx>) | 未実施 |
| DS-PAGE-028 | `/profile/orders` | 未適用 | P2 | TODO | [src/app/(store)/profile/orders/page.tsx](<../../../src/app/(store)/profile/orders/page.tsx>) | 未実施 |
| DS-PAGE-029 | `/profile` | 未適用 | P2 | TODO | [src/app/(store)/profile/page.tsx](<../../../src/app/(store)/profile/page.tsx>) | 未実施 |
| DS-PAGE-030 | `/profile/payment` | 未適用 | P2 | TODO | [src/app/(store)/profile/payment/page.tsx](<../../../src/app/(store)/profile/payment/page.tsx>) | 未実施 |
| DS-PAGE-031 | `/profile/reviews` | 未適用 | P2 | TODO | [src/app/(store)/profile/reviews/page.tsx](<../../../src/app/(store)/profile/reviews/page.tsx>) | 未実施 |
| DS-PAGE-032 | `/profile/settings` | 未適用 | P2 | TODO | [src/app/(store)/profile/settings/page.tsx](<../../../src/app/(store)/profile/settings/page.tsx>) | 未実施 |
| DS-PAGE-033 | `/profile/wishlist/[page]` | 未適用 | P2 | TODO | [src/app/(store)/profile/wishlist/[page]/page.tsx](<../../../src/app/(store)/profile/wishlist/[page]/page.tsx>) | 未実施 |
| DS-PAGE-034 | `/profile/wishlist` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/wishlist/page.tsx](<../../../src/app/(store)/profile/wishlist/page.tsx>) | 未実施 |
| DS-PAGE-035 | `/report-problem` | 未適用 | P2 | TODO | [src/app/(store)/report-problem/page.tsx](<../../../src/app/(store)/report-problem/page.tsx>) | 未実施 |
| DS-PAGE-036 | `/returns-exchange` | 未適用 | P2 | TODO | [src/app/(store)/returns-exchange/page.tsx](<../../../src/app/(store)/returns-exchange/page.tsx>) | 未実施 |
| DS-PAGE-037 | `/store/[storeUrl]` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/store/[storeUrl]/page.tsx](<../../../src/app/(store)/store/[storeUrl]/page.tsx>) | 未実施 |
| DS-PAGE-038 | `/track-order` | 未適用 | P2 | TODO | [src/app/(store)/track-order/page.tsx](<../../../src/app/(store)/track-order/page.tsx>) | 未実施 |
| DS-PAGE-039 | `/dashboard/admin/attributes/[id]/options` | 未適用 | P4 | TODO | [src/app/dashboard/admin/attributes/[id]/options/page.tsx](<../../../src/app/dashboard/admin/attributes/[id]/options/page.tsx>) | 未実施 |
| DS-PAGE-040 | `/dashboard/admin/attributes/new` | 未適用 | P4 | TODO | [src/app/dashboard/admin/attributes/new/page.tsx](<../../../src/app/dashboard/admin/attributes/new/page.tsx>) | 未実施 |
| DS-PAGE-041 | `/dashboard/admin/attributes` | 未適用 | P4 | TODO | [src/app/dashboard/admin/attributes/page.tsx](<../../../src/app/dashboard/admin/attributes/page.tsx>) | 未実施 |
| DS-PAGE-042 | `/dashboard/admin/categories/new` | 未適用 | P4 | TODO | [src/app/dashboard/admin/categories/new/page.tsx](<../../../src/app/dashboard/admin/categories/new/page.tsx>) | 未実施 |
| DS-PAGE-043 | `/dashboard/admin/categories` | 未適用 | P4 | TODO | [src/app/dashboard/admin/categories/page.tsx](<../../../src/app/dashboard/admin/categories/page.tsx>) | 未実施 |
| DS-PAGE-044 | `/dashboard/admin/coupons/new` | 未適用 | P4 | TODO | [src/app/dashboard/admin/coupons/new/page.tsx](<../../../src/app/dashboard/admin/coupons/new/page.tsx>) | 未実施 |
| DS-PAGE-045 | `/dashboard/admin/coupons` | 未適用 | P4 | TODO | [src/app/dashboard/admin/coupons/page.tsx](<../../../src/app/dashboard/admin/coupons/page.tsx>) | 未実施 |
| DS-PAGE-046 | `/dashboard/admin/offer-tags/new` | 未適用 | P4 | TODO | [src/app/dashboard/admin/offer-tags/new/page.tsx](<../../../src/app/dashboard/admin/offer-tags/new/page.tsx>) | 未実施 |
| DS-PAGE-047 | `/dashboard/admin/offer-tags` | 未適用 | P4 | TODO | [src/app/dashboard/admin/offer-tags/page.tsx](<../../../src/app/dashboard/admin/offer-tags/page.tsx>) | 未実施 |
| DS-PAGE-048 | `/dashboard/admin/orders` | 未適用 | P3 | TODO | [src/app/dashboard/admin/orders/page.tsx](<../../../src/app/dashboard/admin/orders/page.tsx>) | 未実施 |
| DS-PAGE-049 | `/dashboard/admin` | 未適用 | P3 | TODO | [src/app/dashboard/admin/page.tsx](<../../../src/app/dashboard/admin/page.tsx>) | 未実施 |
| DS-PAGE-050 | `/dashboard/admin/stores` | 未適用 | P3 | TODO | [src/app/dashboard/admin/stores/page.tsx](<../../../src/app/dashboard/admin/stores/page.tsx>) | 未実施 |
| DS-PAGE-051 | `/dashboard` | 転送専用 | 回帰検証 | TODO | [src/app/dashboard/page.tsx](<../../../src/app/dashboard/page.tsx>) | 未実施 |
| DS-PAGE-052 | `/dashboard/seller` | 転送専用 | 回帰検証 | TODO | [src/app/dashboard/seller/page.tsx](<../../../src/app/dashboard/seller/page.tsx>) | 未実施 |
| DS-PAGE-053 | `/dashboard/seller/stores/[storeUrl]/coupons/new` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/coupons/new/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/new/page.tsx>) | 未実施 |
| DS-PAGE-054 | `/dashboard/seller/stores/[storeUrl]/coupons` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/coupons/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/page.tsx>) | 未実施 |
| DS-PAGE-055 | `/dashboard/seller/stores/[storeUrl]/inventory` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx>) | 未実施 |
| DS-PAGE-056 | `/dashboard/seller/stores/[storeUrl]/messages` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx>) | 未実施 |
| DS-PAGE-057 | `/dashboard/seller/stores/[storeUrl]/orders` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx>) | 未実施 |
| DS-PAGE-058 | `/dashboard/seller/stores/[storeUrl]` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/page.tsx>) | 未実施 |
| DS-PAGE-059 | `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page.tsx>) | 未実施 |
| DS-PAGE-060 | `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page.tsx>) | 未実施 |
| DS-PAGE-061 | `/dashboard/seller/stores/[storeUrl]/products/new` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/products/new/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/new/page.tsx>) | 未実施 |
| DS-PAGE-062 | `/dashboard/seller/stores/[storeUrl]/products` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/products/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/page.tsx>) | 未実施 |
| DS-PAGE-063 | `/dashboard/seller/stores/[storeUrl]/settings` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/settings/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/settings/page.tsx>) | 未実施 |
| DS-PAGE-064 | `/dashboard/seller/stores/[storeUrl]/shipping` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/[storeUrl]/shipping/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/shipping/page.tsx>) | 未実施 |
| DS-PAGE-065 | `/dashboard/seller/stores/new` | 未適用 | P3 | TODO | [src/app/dashboard/seller/stores/new/page.tsx](<../../../src/app/dashboard/seller/stores/new/page.tsx>) | 未実施 |
| DS-PAGE-066 | `/dashboard/seller/stores` | 仮実装 | P3・機能課題別枠 | TODO | [src/app/dashboard/seller/stores/page.tsx](<../../../src/app/dashboard/seller/stores/page.tsx>) | 未実施 |

## 部品台帳

元計画のファイル単位の200項目を登録。呼び出し元・表示状態・Portalを確認する。P3/P4は着手計画で対象業務に応じて確定する。

| ID | 優先度 | グループ | 対象 | 状態 | 証跡・次の作業 |
|---|---|---|---|---|---|
| DS-COMP-001 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/user-menu/user-menu.tsx](<../../../src/components/store/layout/header/user-menu/user-menu.tsx>) | TODO | 未実施 |
| DS-COMP-002 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/search/search.tsx](<../../../src/components/store/layout/header/search/search.tsx>) | TODO | 未実施 |
| DS-COMP-003 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/search/suggestions.tsx](<../../../src/components/store/layout/header/search/suggestions.tsx>) | TODO | 未実施 |
| DS-COMP-004 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/country-lang-curr-selector.tsx](<../../../src/components/store/layout/header/country-lang-curr-selector.tsx>) | TODO | 未実施 |
| DS-COMP-005 | P1 | ヘッダー展開部品（P1） | [src/components/shared/country-selector.tsx](<../../../src/components/shared/country-selector.tsx>) | TODO | 未実施 |
| DS-COMP-006 | P1 | 基本操作・フォーム（P1） | [src/components/store/ui/button.tsx](<../../../src/components/store/ui/button.tsx>) | TODO | 未実施 |
| DS-COMP-007 | P1 | 基本操作・フォーム（P1） | [src/components/store/ui/input.tsx](<../../../src/components/store/ui/input.tsx>) | TODO | 未実施 |
| DS-COMP-008 | P1 | 基本操作・フォーム（P1） | [src/components/store/ui/select.tsx](<../../../src/components/store/ui/select.tsx>) | TODO | 未実施 |
| DS-COMP-009 | P1 | 基本操作・フォーム（P1） | [src/components/store/ui/textarea.tsx](<../../../src/components/store/ui/textarea.tsx>) | TODO | 未実施 |
| DS-COMP-010 | P1 | 基本操作・フォーム（P1） | [src/components/ui/button.tsx](<../../../src/components/ui/button.tsx>) | TODO | 未実施 |
| DS-COMP-011 | P1 | 基本操作・フォーム（P1） | [src/components/ui/input.tsx](<../../../src/components/ui/input.tsx>) | TODO | 未実施 |
| DS-COMP-012 | P1 | 基本操作・フォーム（P1） | [src/components/ui/textarea.tsx](<../../../src/components/ui/textarea.tsx>) | TODO | 未実施 |
| DS-COMP-013 | P1 | 基本操作・フォーム（P1） | [src/components/ui/select.tsx](<../../../src/components/ui/select.tsx>) | TODO | 未実施 |
| DS-COMP-014 | P1 | 基本操作・フォーム（P1） | [src/components/ui/form.tsx](<../../../src/components/ui/form.tsx>) | TODO | 未実施 |
| DS-COMP-015 | P1 | 基本操作・フォーム（P1） | [src/components/ui/label.tsx](<../../../src/components/ui/label.tsx>) | TODO | 未実施 |
| DS-COMP-016 | P1 | 基本操作・フォーム（P1） | [src/components/ui/checkbox.tsx](<../../../src/components/ui/checkbox.tsx>) | TODO | 未実施 |
| DS-COMP-017 | P1 | 基本操作・フォーム（P1） | [src/components/ui/radio-group.tsx](<../../../src/components/ui/radio-group.tsx>) | TODO | 未実施 |
| DS-COMP-018 | P1 | 基本操作・フォーム（P1） | [src/components/ui/switch.tsx](<../../../src/components/ui/switch.tsx>) | TODO | 未実施 |
| DS-COMP-019 | P1 | モーダル・配送先（P1） | [src/components/store/shared/modal.tsx](<../../../src/components/store/shared/modal.tsx>) | TODO | 未実施 |
| DS-COMP-020 | P1 | モーダル・配送先（P1） | [src/components/store/shared/shipping-addresses/shipping-addresses.tsx](<../../../src/components/store/shared/shipping-addresses/shipping-addresses.tsx>) | TODO | 未実施 |
| DS-COMP-021 | P1 | モーダル・配送先（P1） | [src/components/store/shared/shipping-addresses/address-details.tsx](<../../../src/components/store/shared/shipping-addresses/address-details.tsx>) | TODO | 未実施 |
| DS-COMP-022 | P1 | モーダル・配送先（P1） | [src/components/ui/dialog.tsx](<../../../src/components/ui/dialog.tsx>) | TODO | 未実施 |
| DS-COMP-023 | P1 | モーダル・配送先（P1） | [src/components/ui/alert-dialog.tsx](<../../../src/components/ui/alert-dialog.tsx>) | TODO | 未実施 |
| DS-COMP-024 | P1 | モーダル・配送先（P1） | [src/components/ui/drawer.tsx](<../../../src/components/ui/drawer.tsx>) | TODO | 未実施 |
| DS-COMP-025 | P1 | モーダル・配送先（P1） | [src/components/ui/sheet.tsx](<../../../src/components/ui/sheet.tsx>) | TODO | 未実施 |
| DS-COMP-026 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/container.tsx](<../../../src/components/store/cart-page/container.tsx>) | TODO | 未実施 |
| DS-COMP-027 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/cart-header.tsx](<../../../src/components/store/cart-page/cart-header.tsx>) | TODO | 未実施 |
| DS-COMP-028 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/summary.tsx](<../../../src/components/store/cart-page/summary.tsx>) | TODO | 未実施 |
| DS-COMP-029 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/empty-cart.tsx](<../../../src/components/store/cart-page/empty-cart.tsx>) | TODO | 未実施 |
| DS-COMP-030 | P1 | カート・購入手続き（P1） | [src/components/store/cards/cart-product.tsx](<../../../src/components/store/cards/cart-product.tsx>) | TODO | 未実施 |
| DS-COMP-031 | P1 | カート・購入手続き（P1） | [src/components/store/checkout-page/container.tsx](<../../../src/components/store/checkout-page/container.tsx>) | TODO | 未実施 |
| DS-COMP-032 | P1 | カート・購入手続き（P1） | [src/components/store/cards/checkout-product.tsx](<../../../src/components/store/cards/checkout-product.tsx>) | TODO | 未実施 |
| DS-COMP-033 | P1 | カート・購入手続き（P1） | [src/components/store/cards/place-order.tsx](<../../../src/components/store/cards/place-order.tsx>) | TODO | 未実施 |
| DS-COMP-034 | P1 | カート・購入手続き（P1） | [src/components/store/forms/apply-coupon.tsx](<../../../src/components/store/forms/apply-coupon.tsx>) | TODO | 未実施 |
| DS-COMP-035 | P1 | カート・購入手続き（P1） | [src/components/store/cards/fast-delivery.tsx](<../../../src/components/store/cards/fast-delivery.tsx>) | TODO | 未実施 |
| DS-COMP-036 | P1 | カート・購入手続き（P1） | [src/components/store/product-page/returns-security-privacy-card.tsx](<../../../src/components/store/product-page/returns-security-privacy-card.tsx>) | TODO | 未実施 |
| DS-COMP-037 | P1 | カート・購入手続き（P1） | [src/components/store/shared/country-note.tsx](<../../../src/components/store/shared/country-note.tsx>) | TODO | 未実施 |
| DS-COMP-038 | P1 | 注文・支払い（P1） | [src/components/store/order-page/header.tsx](<../../../src/components/store/order-page/header.tsx>) | TODO | 未実施 |
| DS-COMP-039 | P1 | 注文・支払い（P1） | [src/components/store/order-page/groups-container.tsx](<../../../src/components/store/order-page/groups-container.tsx>) | TODO | 未実施 |
| DS-COMP-040 | P1 | 注文・支払い（P1） | [src/components/store/order-page/group-table.tsx](<../../../src/components/store/order-page/group-table.tsx>) | TODO | 未実施 |
| DS-COMP-041 | P1 | 注文・支払い（P1） | [src/components/store/order-page/product-row.tsx](<../../../src/components/store/order-page/product-row.tsx>) | TODO | 未実施 |
| DS-COMP-042 | P1 | 注文・支払い（P1） | [src/components/store/order-page/payment.tsx](<../../../src/components/store/order-page/payment.tsx>) | TODO | 未実施 |
| DS-COMP-043 | P1 | 注文・支払い（P1） | [src/components/store/cards/order/info.tsx](<../../../src/components/store/cards/order/info.tsx>) | TODO | 未実施 |
| DS-COMP-044 | P1 | 注文・支払い（P1） | [src/components/store/cards/order/total.tsx](<../../../src/components/store/cards/order/total.tsx>) | TODO | 未実施 |
| DS-COMP-045 | P1 | 注文・支払い（P1） | [src/components/store/cards/order/user.tsx](<../../../src/components/store/cards/order/user.tsx>) | TODO | 未実施 |
| DS-COMP-046 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/stripe/stripe-wrapper.tsx](<../../../src/components/store/cards/payment/stripe/stripe-wrapper.tsx>) | TODO | 未実施 |
| DS-COMP-047 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/stripe/stripe-payment.tsx](<../../../src/components/store/cards/payment/stripe/stripe-payment.tsx>) | TODO | 未実施 |
| DS-COMP-048 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/paypal/paypal-wrapper.tsx](<../../../src/components/store/cards/payment/paypal/paypal-wrapper.tsx>) | TODO | 未実施 |
| DS-COMP-049 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/paypal/paypal-payment.tsx](<../../../src/components/store/cards/payment/paypal/paypal-payment.tsx>) | TODO | 未実施 |
| DS-COMP-050 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/product/product-card.tsx](<../../../src/components/store/cards/product/product-card.tsx>) | TODO | 未実施 |
| DS-COMP-051 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/product/swiper.tsx](<../../../src/components/store/cards/product/swiper.tsx>) | TODO | 未実施 |
| DS-COMP-052 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/product/variant-switcher.tsx](<../../../src/components/store/cards/product/variant-switcher.tsx>) | TODO | 未実施 |
| DS-COMP-053 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/product-page/product-info/product-price.tsx](<../../../src/components/store/product-page/product-info/product-price.tsx>) | TODO | 未実施 |
| DS-COMP-054 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/store-card.tsx](<../../../src/components/store/cards/store-card.tsx>) | TODO | 未実施 |
| DS-COMP-055 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/shared/product-list.tsx](<../../../src/components/store/shared/product-list.tsx>) | TODO | 未実施 |
| DS-COMP-056 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/compare/compare-grid.tsx](<../../../src/components/store/compare/compare-grid.tsx>) | 検証済み | [compare実施記録](#compare移行記録) |
| DS-COMP-057 | P2 | ページング・フィルター（P2） | [src/components/store/shared/pagination.tsx](<../../../src/components/store/shared/pagination.tsx>) | TODO | 未実施 |
| DS-COMP-058 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/browse-pagination.tsx](<../../../src/components/store/browse-page/browse-pagination.tsx>) | TODO | 未実施 |
| DS-COMP-059 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/header.tsx](<../../../src/components/store/browse-page/filters/header.tsx>) | TODO | 未実施 |
| DS-COMP-060 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/category/category-filter.tsx](<../../../src/components/store/browse-page/filters/category/category-filter.tsx>) | TODO | 未実施 |
| DS-COMP-061 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/category/category-link.tsx](<../../../src/components/store/browse-page/filters/category/category-link.tsx>) | TODO | 未実施 |
| DS-COMP-062 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/offer/offer-filter.tsx](<../../../src/components/store/browse-page/filters/offer/offer-filter.tsx>) | TODO | 未実施 |
| DS-COMP-063 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/offer/offer-link.tsx](<../../../src/components/store/browse-page/filters/offer/offer-link.tsx>) | TODO | 未実施 |
| DS-COMP-064 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/size/size-filter.tsx](<../../../src/components/store/browse-page/filters/size/size-filter.tsx>) | TODO | 未実施 |
| DS-COMP-065 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/size/size-link.tsx](<../../../src/components/store/browse-page/filters/size/size-link.tsx>) | TODO | 未実施 |
| DS-COMP-066 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/shared/countdown.tsx](<../../../src/components/store/shared/countdown.tsx>) | TODO | 未実施 |
| DS-COMP-067 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/product-page/product-info/product-info.tsx](<../../../src/components/store/product-page/product-info/product-info.tsx>) | TODO | 未実施 |
| DS-COMP-068 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/product-page/product-info/product-watch.tsx](<../../../src/components/store/product-page/product-info/product-watch.tsx>) | TODO | 未実施 |
| DS-COMP-069 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/product-page/reviews/product-reviews.tsx](<../../../src/components/store/product-page/reviews/product-reviews.tsx>) | TODO | 未実施 |
| DS-COMP-070 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/product-page/reviews/filters.tsx](<../../../src/components/store/product-page/reviews/filters.tsx>) | TODO | 未実施 |
| DS-COMP-071 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/product-page/reviews/sort.tsx](<../../../src/components/store/product-page/reviews/sort.tsx>) | TODO | 未実施 |
| DS-COMP-072 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/cards/review.tsx](<../../../src/components/store/cards/review.tsx>) | TODO | 未実施 |
| DS-COMP-073 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/cards/product-rating.tsx](<../../../src/components/store/cards/product-rating.tsx>) | TODO | 未実施 |
| DS-COMP-074 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/cards/rating-statistics.tsx](<../../../src/components/store/cards/rating-statistics.tsx>) | TODO | 未実施 |
| DS-COMP-075 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/forms/review-details.tsx](<../../../src/components/store/forms/review-details.tsx>) | TODO | 未実施 |
| DS-COMP-076 | P2 | 商品詳細・レビューの残存確認（P2） | [src/components/store/shared/upload-images.tsx](<../../../src/components/store/shared/upload-images.tsx>) | TODO | 未実施 |
| DS-COMP-077 | P2 | マイページ（P2） | [src/components/store/layout/profile-sidebar/sidebar.tsx](<../../../src/components/store/layout/profile-sidebar/sidebar.tsx>) | TODO | 未実施 |
| DS-COMP-078 | P2 | マイページ（P2） | [src/components/store/profile/overview.tsx](<../../../src/components/store/profile/overview.tsx>) | TODO | 未実施 |
| DS-COMP-079 | P2 | マイページ（P2） | [src/components/store/profile/orders-overview.tsx](<../../../src/components/store/profile/orders-overview.tsx>) | TODO | 未実施 |
| DS-COMP-080 | P2 | マイページ（P2） | [src/components/store/profile/orders/orders-table.tsx](<../../../src/components/store/profile/orders/orders-table.tsx>) | TODO | 未実施 |
| DS-COMP-081 | P2 | マイページ（P2） | [src/components/store/profile/orders/order-table-header.tsx](<../../../src/components/store/profile/orders/order-table-header.tsx>) | TODO | 未実施 |
| DS-COMP-082 | P2 | マイページ（P2） | [src/components/store/profile/payments/payments-table.tsx](<../../../src/components/store/profile/payments/payments-table.tsx>) | TODO | 未実施 |
| DS-COMP-083 | P2 | マイページ（P2） | [src/components/store/profile/payments/payment-table-header.tsx](<../../../src/components/store/profile/payments/payment-table-header.tsx>) | TODO | 未実施 |
| DS-COMP-084 | P2 | マイページ（P2） | [src/components/store/profile/addresses/container.tsx](<../../../src/components/store/profile/addresses/container.tsx>) | TODO | 未実施 |
| DS-COMP-085 | P2 | マイページ（P2） | [src/components/store/profile/wishlist/container.tsx](<../../../src/components/store/profile/wishlist/container.tsx>) | TODO | 未実施 |
| DS-COMP-086 | P2 | マイページ（P2） | [src/components/store/profile/following/container.tsx](<../../../src/components/store/profile/following/container.tsx>) | TODO | 未実施 |
| DS-COMP-087 | P2 | マイページ（P2） | [src/components/store/profile/reviews/reviews-container.tsx](<../../../src/components/store/profile/reviews/reviews-container.tsx>) | TODO | 未実施 |
| DS-COMP-088 | P2 | マイページ（P2） | [src/components/store/profile/reviews/reviews-header.tsx](<../../../src/components/store/profile/reviews/reviews-header.tsx>) | TODO | 未実施 |
| DS-COMP-089 | P2 | メッセージ共用部品（P2） | [src/components/shared/messages/messages-layout.tsx](<../../../src/components/shared/messages/messages-layout.tsx>) | TODO | 未実施 |
| DS-COMP-090 | P2 | メッセージ共用部品（P2） | [src/components/store/profile/messages/messages-container.tsx](<../../../src/components/store/profile/messages/messages-container.tsx>) | TODO | 未実施 |
| DS-COMP-091 | P2 | メッセージ共用部品（P2） | [src/components/store/profile/messages/conversation-thread.tsx](<../../../src/components/store/profile/messages/conversation-thread.tsx>) | TODO | 未実施 |
| DS-COMP-092 | P2 | メッセージ共用部品（P2） | [src/components/dashboard/seller/seller-messages-container.tsx](<../../../src/components/dashboard/seller/seller-messages-container.tsx>) | TODO | 未実施 |
| DS-COMP-093 | P2 | サポート・追跡（P2） | [src/components/store/support/support-form.tsx](<../../../src/components/store/support/support-form.tsx>) | TODO | 未実施 |
| DS-COMP-094 | P2 | サポート・追跡（P2） | [src/components/store/track-order/track-order-form.tsx](<../../../src/components/store/track-order/track-order-form.tsx>) | TODO | 未実施 |
| DS-COMP-095 | P2 | サポート・追跡（P2） | [src/components/store/track-order/track-order-result.tsx](<../../../src/components/store/track-order/track-order-result.tsx>) | TODO | 未実施 |
| DS-COMP-096 | P2 | 通知・状態・補助UI（P2） | [src/components/shared/order-status.tsx](<../../../src/components/shared/order-status.tsx>) | TODO | 未実施 |
| DS-COMP-097 | P2 | 通知・状態・補助UI（P2） | [src/components/shared/payment-status.tsx](<../../../src/components/shared/payment-status.tsx>) | TODO | 未実施 |
| DS-COMP-098 | P2 | 通知・状態・補助UI（P2） | [src/components/shared/product-status.tsx](<../../../src/components/shared/product-status.tsx>) | TODO | 未実施 |
| DS-COMP-099 | P2 | 通知・状態・補助UI（P2） | [src/components/shared/store-status.tsx](<../../../src/components/shared/store-status.tsx>) | TODO | 未実施 |
| DS-COMP-100 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/badge.tsx](<../../../src/components/ui/badge.tsx>) | TODO | 未実施 |
| DS-COMP-101 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/alert.tsx](<../../../src/components/ui/alert.tsx>) | TODO | 未実施 |
| DS-COMP-102 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/toast.tsx](<../../../src/components/ui/toast.tsx>) | TODO | 未実施 |
| DS-COMP-103 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/toaster.tsx](<../../../src/components/ui/toaster.tsx>) | TODO | 未実施 |
| DS-COMP-104 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/sonner.tsx](<../../../src/components/ui/sonner.tsx>) | TODO | 未実施 |
| DS-COMP-105 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/skeleton.tsx](<../../../src/components/ui/skeleton.tsx>) | TODO | 未実施 |
| DS-COMP-106 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/progress.tsx](<../../../src/components/ui/progress.tsx>) | TODO | 未実施 |
| DS-COMP-107 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/tooltip.tsx](<../../../src/components/ui/tooltip.tsx>) | TODO | 未実施 |
| DS-COMP-108 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/popover.tsx](<../../../src/components/ui/popover.tsx>) | TODO | 未実施 |
| DS-COMP-109 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/dropdown-menu.tsx](<../../../src/components/ui/dropdown-menu.tsx>) | TODO | 未実施 |
| DS-COMP-110 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/command.tsx](<../../../src/components/ui/command.tsx>) | TODO | 未実施 |
| DS-COMP-111 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/accordion.tsx](<../../../src/components/ui/accordion.tsx>) | TODO | 未実施 |
| DS-COMP-112 | P2 | 通知・状態・補助UI（P2） | [src/components/ui/tabs.tsx](<../../../src/components/ui/tabs.tsx>) | TODO | 未実施 |
| DS-COMP-113 | P3 | 出店申請（P3） | [src/components/store/layout/minimal-header/header.tsx](<../../../src/components/store/layout/minimal-header/header.tsx>) | TODO | 未実施 |
| DS-COMP-114 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/apply-seller.tsx](<../../../src/components/store/forms/apply-seller/apply-seller.tsx>) | TODO | 未実施 |
| DS-COMP-115 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/progress-bar.tsx](<../../../src/components/store/forms/apply-seller/progress-bar.tsx>) | TODO | 未実施 |
| DS-COMP-116 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/instructions.tsx](<../../../src/components/store/forms/apply-seller/instructions.tsx>) | TODO | 未実施 |
| DS-COMP-117 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/animated-container.tsx](<../../../src/components/store/forms/apply-seller/animated-container.tsx>) | TODO | 未実施 |
| DS-COMP-118 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-1/step-1.tsx](<../../../src/components/store/forms/apply-seller/steps/step-1/step-1.tsx>) | TODO | 未実施 |
| DS-COMP-119 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-1/user-details.tsx](<../../../src/components/store/forms/apply-seller/steps/step-1/user-details.tsx>) | TODO | 未実施 |
| DS-COMP-120 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-2/step-2.tsx](<../../../src/components/store/forms/apply-seller/steps/step-2/step-2.tsx>) | TODO | 未実施 |
| DS-COMP-121 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-3/step-3.tsx](<../../../src/components/store/forms/apply-seller/steps/step-3/step-3.tsx>) | TODO | 未実施 |
| DS-COMP-122 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-4/step-4.tsx](<../../../src/components/store/forms/apply-seller/steps/step-4/step-4.tsx>) | TODO | 未実施 |
| DS-COMP-123 | P3 | 静的コンテンツ（P3） | [src/components/store/static/static-page-layout.tsx](<../../../src/components/store/static/static-page-layout.tsx>) | TODO | 未実施 |
| DS-COMP-124 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/header/Header.tsx](<../../../src/components/dashboard/header/Header.tsx>) | TODO | 未実施 |
| DS-COMP-125 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/sidebar.tsx](<../../../src/components/dashboard/sidebar/sidebar.tsx>) | TODO | 未実施 |
| DS-COMP-126 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/nav-admin.tsx](<../../../src/components/dashboard/sidebar/nav-admin.tsx>) | TODO | 未実施 |
| DS-COMP-127 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/nav-seller.tsx](<../../../src/components/dashboard/sidebar/nav-seller.tsx>) | TODO | 未実施 |
| DS-COMP-128 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/store-switcher.tsx](<../../../src/components/dashboard/sidebar/store-switcher.tsx>) | TODO | 未実施 |
| DS-COMP-129 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/user-info.tsx](<../../../src/components/dashboard/sidebar/user-info.tsx>) | TODO | 未実施 |
| DS-COMP-130 | P3 | ダッシュボード共通（P3） | [src/components/shared/theme-toggle.tsx](<../../../src/components/shared/theme-toggle.tsx>) | TODO | 未実施 |
| DS-COMP-131 | P3 | ダッシュボード共通（P3） | [src/components/ui/data-table.tsx](<../../../src/components/ui/data-table.tsx>) | TODO | 未実施 |
| DS-COMP-132 | P3 | ダッシュボード共通（P3） | [src/components/ui/table.tsx](<../../../src/components/ui/table.tsx>) | TODO | 未実施 |
| DS-COMP-133 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/shared/custom-modal.tsx](<../../../src/components/dashboard/shared/custom-modal.tsx>) | TODO | 未実施 |
| DS-COMP-134 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/shared/order-table-cells.tsx](<../../../src/components/dashboard/shared/order-table-cells.tsx>) | TODO | 未実施 |
| DS-COMP-135 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/stats-cards.tsx](<../../../src/components/dashboard/admin/stats-cards.tsx>) | TODO | 未実施 |
| DS-COMP-136 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/sales-chart.tsx](<../../../src/components/dashboard/admin/sales-chart.tsx>) | TODO | 未実施 |
| DS-COMP-137 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/recent-orders.tsx](<../../../src/components/dashboard/admin/recent-orders.tsx>) | TODO | 未実施 |
| DS-COMP-138 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/recent-stores.tsx](<../../../src/components/dashboard/admin/recent-stores.tsx>) | TODO | 未実施 |
| DS-COMP-139 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/store-stats-cards.tsx](<../../../src/components/dashboard/seller/store-stats-cards.tsx>) | TODO | 未実施 |
| DS-COMP-140 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/store-recent-orders.tsx](<../../../src/components/dashboard/seller/store-recent-orders.tsx>) | TODO | 未実施 |
| DS-COMP-141 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/store-top-products.tsx](<../../../src/components/dashboard/seller/store-top-products.tsx>) | TODO | 未実施 |
| DS-COMP-142 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/inventory-alert-summary.tsx](<../../../src/components/dashboard/seller/inventory-alert-summary.tsx>) | TODO | 未実施 |
| DS-COMP-143 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/low-stock-threshold-form.tsx](<../../../src/components/dashboard/seller/low-stock-threshold-form.tsx>) | TODO | 未実施 |
| DS-COMP-144 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/inventory-quantity-cell.tsx](<../../../src/components/dashboard/seller/inventory-quantity-cell.tsx>) | TODO | 未実施 |
| DS-COMP-145 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/stock-status-badge.tsx](<../../../src/components/dashboard/seller/stock-status-badge.tsx>) | TODO | 未実施 |
| DS-COMP-146 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/store-details.tsx](<../../../src/components/dashboard/forms/store-details.tsx>) | TODO | 未実施 |
| DS-COMP-147 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/product-details.tsx](<../../../src/components/dashboard/forms/product-details.tsx>) | TODO | 未実施 |
| DS-COMP-148 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/store-default-shipping-details.tsx](<../../../src/components/dashboard/forms/store-default-shipping-details.tsx>) | TODO | 未実施 |
| DS-COMP-149 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/shippingRate-details.tsx](<../../../src/components/dashboard/forms/shippingRate-details.tsx>) | TODO | 未実施 |
| DS-COMP-150 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/coupon-details.tsx](<../../../src/components/dashboard/forms/coupon-details.tsx>) | TODO | 未実施 |
| DS-COMP-151 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/coupon-form-fields.tsx](<../../../src/components/dashboard/forms/coupon-form-fields.tsx>) | TODO | 未実施 |
| DS-COMP-152 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/order-status-select.tsx](<../../../src/components/dashboard/forms/order-status-select.tsx>) | TODO | 未実施 |
| DS-COMP-153 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/product-status-select.tsx](<../../../src/components/dashboard/forms/product-status-select.tsx>) | TODO | 未実施 |
| DS-COMP-154 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/store-status-select.tsx](<../../../src/components/dashboard/forms/store-status-select.tsx>) | TODO | 未実施 |
| DS-COMP-155 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/category-details.tsx](<../../../src/components/dashboard/forms/category-details.tsx>) | TODO | 未実施 |
| DS-COMP-156 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/attribute-details.tsx](<../../../src/components/dashboard/forms/attribute-details.tsx>) | TODO | 未実施 |
| DS-COMP-157 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/attribute-option-details.tsx](<../../../src/components/dashboard/forms/attribute-option-details.tsx>) | TODO | 未実施 |
| DS-COMP-158 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/attribute-fields.tsx](<../../../src/components/dashboard/forms/attribute-fields.tsx>) | TODO | 未実施 |
| DS-COMP-159 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/offer-tag-details.tsx](<../../../src/components/dashboard/forms/offer-tag-details.tsx>) | TODO | 未実施 |
| DS-COMP-160 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/admin-coupon-details.tsx](<../../../src/components/dashboard/forms/admin-coupon-details.tsx>) | TODO | 未実施 |
| DS-COMP-161 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/click-to-add.tsx](<../../../src/components/dashboard/forms/click-to-add.tsx>) | TODO | 未実施 |
| DS-COMP-162 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/input-fieldset.tsx](<../../../src/components/dashboard/shared/input-fieldset.tsx>) | TODO | 未実施 |
| DS-COMP-163 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/image-upload.tsx](<../../../src/components/dashboard/shared/image-upload.tsx>) | TODO | 未実施 |
| DS-COMP-164 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/images-preview-grid.tsx](<../../../src/components/dashboard/shared/images-preview-grid.tsx>) | TODO | 未実施 |
| DS-COMP-165 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/color-palette.tsx](<../../../src/components/dashboard/shared/color-palette.tsx>) | TODO | 未実施 |
| DS-COMP-166 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/store-summary.tsx](<../../../src/components/dashboard/shared/store-summary.tsx>) | TODO | 未実施 |
| DS-COMP-167 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/store-order-summary.tsx](<../../../src/components/dashboard/shared/store-order-summary.tsx>) | TODO | 未実施 |
| DS-COMP-168 | P4 | 印刷（P4） | [src/components/store/order-page/pdf-invoice.tsx](<../../../src/components/store/order-page/pdf-invoice.tsx>) | TODO | 未実施 |
| DS-COMP-169 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/attributes/[id]/options/columns.tsx](<../../../src/app/dashboard/admin/attributes/[id]/options/columns.tsx>) | TODO | 未実施 |
| DS-COMP-170 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/attributes/columns.tsx](<../../../src/app/dashboard/admin/attributes/columns.tsx>) | TODO | 未実施 |
| DS-COMP-171 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/categories/columns.tsx](<../../../src/app/dashboard/admin/categories/columns.tsx>) | TODO | 未実施 |
| DS-COMP-172 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/coupons/columns.tsx](<../../../src/app/dashboard/admin/coupons/columns.tsx>) | TODO | 未実施 |
| DS-COMP-173 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/offer-tags/columns.tsx](<../../../src/app/dashboard/admin/offer-tags/columns.tsx>) | TODO | 未実施 |
| DS-COMP-174 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/orders/columns.tsx](<../../../src/app/dashboard/admin/orders/columns.tsx>) | TODO | 未実施 |
| DS-COMP-175 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/stores/columns.tsx](<../../../src/app/dashboard/admin/stores/columns.tsx>) | TODO | 未実施 |
| DS-COMP-176 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx>) | TODO | 未実施 |
| DS-COMP-177 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx>) | TODO | 未実施 |
| DS-COMP-178 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx>) | TODO | 未実施 |
| DS-COMP-179 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/products/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/columns.tsx>) | TODO | 未実施 |
| DS-COMP-180 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/shipping/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/shipping/columns.tsx>) | TODO | 未実施 |
| DS-COMP-181 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/animated-deals.tsx](<../../../src/components/store/home/animated-deals.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-182 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/featured-categories.tsx](<../../../src/components/store/home/featured-categories.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-183 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/category-card.tsx](<../../../src/components/store/home/category-card.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-184 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/main/featured.tsx](<../../../src/components/store/home/main/featured.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-185 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/main/home-swiper.tsx](<../../../src/components/store/home/main/home-swiper.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-186 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/main/user/user.tsx](<../../../src/components/store/home/main/user/user.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-187 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/main/user/products.tsx](<../../../src/components/store/home/main/user/products.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-188 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/sideline/sideline.tsx](<../../../src/components/store/home/sideline/sideline.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-189 | P4 | 利用確認が必要な旧部品 | [src/components/store/home/sideline/item.tsx](<../../../src/components/store/home/sideline/item.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-190 | P4 | 利用確認が必要な旧部品 | [src/components/store/layout/categories-header/categories-header.tsx](<../../../src/components/store/layout/categories-header/categories-header.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-191 | P4 | 利用確認が必要な旧部品 | [src/components/store/layout/categories-header/container.tsx](<../../../src/components/store/layout/categories-header/container.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-192 | P4 | 利用確認が必要な旧部品 | [src/components/store/layout/categories-header/categories-menu.tsx](<../../../src/components/store/layout/categories-header/categories-menu.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-193 | P4 | 利用確認が必要な旧部品 | [src/components/store/layout/categories-header/offerTags-links.tsx](<../../../src/components/store/layout/categories-header/offerTags-links.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-194 | P4 | 利用確認が必要な旧部品 | [src/components/store/layout/header/download-app.tsx](<../../../src/components/store/layout/header/download-app.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-195 | P4 | 利用確認が必要な旧部品 | [src/components/store/layout/footer/contact.tsx](<../../../src/components/store/layout/footer/contact.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-196 | P4 | 利用確認が必要な旧部品 | [src/components/store/cards/product/clean-card.tsx](<../../../src/components/store/cards/product/clean-card.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-197 | P4 | 利用確認が必要な旧部品 | [src/components/store/cards/product/simple-card.tsx](<../../../src/components/store/cards/product/simple-card.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-198 | P4 | 利用確認が必要な旧部品 | [src/components/store/shared/swiper.tsx](<../../../src/components/store/shared/swiper.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-199 | P4 | 利用確認が必要な旧部品 | [src/components/store/shared/shipping-addresses/address.list.tsx](<../../../src/components/store/shared/shipping-addresses/address.list.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |
| DS-COMP-200 | P4 | 利用確認が必要な旧部品 | [src/components/store/cards/address-card.tsx](<../../../src/components/store/cards/address-card.tsx>) | TODO | 利用確認→移行／保管／削除候補の判断 |

## 前セッションの確認結果

以下は前セッションの報告から引き継いだ結果。今回の文書整備で再実行していない。実施時刻・保存ログが残っていない結果は、今回の実測証跡と区別する。

| 対象 | 引き継いだ確認 | 残る確認・文書同期 |
|---|---|---|
| About | 関連テスト11件、lint、PC／モバイル表示、mainのaxe確認が成功との報告 | 過去のRedは未確認。共通基盤変更後の回帰と関連設計書の同期を確認する |
| Contact | SupportFormテスト6件、lint、PC／モバイル表示、mainのaxe確認が成功との報告。既存act警告あり | 過去のRedは未確認。他のサポート画面・成功状態まで適用済みとは扱わない |
| sign-in／sign-up | TDD実施報告。[単体テスト](../../../src/components/store/auth/auth-pages.test.tsx)6件、[E2E](../../../tests/e2e/auth-design.spec.ts)7件、型検査・lint成功。PC／モバイル、配色、focus、空送信、axe、wishlist戻り先の往復を確認 | 認証完了、認証コード、パスワード再設定、外部ログインは未検証。仕様書・QA引き継ぎ同期は未確認 |

すべて未コミットの実装を含む。部分テストの件数は全体テスト統計ではない。過去の一部成功を台帳全体の「検証済み」へ変換しない。

## 実施記録のテンプレート

実施ごとに以下を複製し、対象IDからリンクする。複数IDをまとめる場合は対象と未確認範囲を明記する。

```markdown
### YYYY-MM-DD 対象ID — 作業名

- 計画: plans/の対象計画へのリンク
- 状態: 対応中／実装済み／検証済み／保留
- 変更: 対象・呼び出し元・既存動作への影響
- Red: テスト、コマンド、期待した失敗理由と実測結果
- Green／Refactor: コマンド、結果、ログまたは再現可能な証跡
- 表示確認: PC／モバイルの幅、表示状態、focus、キーボード、axe、テーマ
- 文書同期: 更新した仕様書・設計書・計画・進捗へのリンク
- 変更不要: 確認した文書へのリンクと理由
- 残課題／保留: 未検証範囲、理由、解除条件、次の作業ID
- 変更記録: 未コミット、または依頼に基づくコミットへの参照
```

文書のみの変更はRed／Green／表示確認を「対象外（文書のみ）」とし、リンク・形式・台帳整合・差分の実測結果を記録する。

## 運用整備記録

### 2026-09-30 DS-OPS-001 — 進捗ノート・開発スキル・ルール

- 計画: [承認済みの整備計画](../../../plans/design-system-workflow-plan.md)。
- 状態: 検証済み（文書検証・計画・進捗同期完了）。
- 変更: 66画面・200部品の台帳、新スキル、AGENTSと既存ルールの参照を整備。
- Red／Green／画面検証: 対象外（文書のみ）。アプリコード・テスト・全体統計を変更しない。
- 文書同期: [移行計画](../../../plans/design-system-adoption-plan.md)、[配置ガイド](../../../.claude/steering/documentation-guide.md)、[全体進捗](../../PROGRESS.md)。
- 変更不要: [機能概要](../../../specs/multi-vendor-ecommerce/00-overview.md)、[要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)、[インターフェース](../../../specs/multi-vendor-ecommerce/04-interfaces.md)、[ワークフロー](../../../specs/multi-vendor-ecommerce/05-workflows.md)、[品質](../../../specs/multi-vendor-ecommerce/06-quality.md)、[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)。開発運用文書のみで機能・API・DB・テスト方針を変更しない。
- 変更不要: [静的ページの進捗](../storefront-static-pages/PROGRESS.md)、[サポートフォームの進捗](../support-forms/PROGRESS.md)。過去の機能完了記録を維持し、移行状態はこのノートで追跡する。
- 検証結果: skill-creator付属の `scripts/quick_validate.py` を `python` で `.agent/skills/design-system-workflow` に対して実行 → `Skill is valid!`。初回の `python3` はPyYAML不足で失敗したため、既存のPyYAMLを利用できる `python` で成功を確認した。
- 文書検証: Pythonによる照合で66画面・200部品のID重複なし、元計画との全項目・順序一致、577件のローカルファイル参照の存在を確認。初回の照合は動的パスの角括弧を扱えず失敗したため、リンク／表の抽出を修正して全件成功を確認した。
- 差分検証: `git diff --check` 成功。新規文書の末尾空白・未置換テンプレートなし。画面の完了数と全体テスト統計は変更していない。
- 次の作業: DS-BASE-001。前セッションの関連仕様・QA引き継ぎ同期は各画面の残課題として維持する。
- 変更記録: 未コミット。

## compare移行記録

### 2026-09-30 DS-PAGE-009／DS-COMP-056 — /compare

- 計画: [compare-design-system-plan](../../../plans/compare-design-system-plan.md)。適用スキルはdesign-system-workflowとspec-sync-after-test。
- 状態: 検証済み（受け入れ条件・検証・仕様書／計画／進捗同期完了）。未コミット。
- 変更: 深緑のヒーロー・アイボリー比較面・ゴールドの操作と価格・セリフ見出し・罫線、件数表示、コレクション導線、空／取得中／失敗・再試行／商品取得ゼロを整備。既存価格ロジック・最大4件・localStorage・削除・商品リンクを維持。既存取得ActionをServer Componentからpropで渡す。
- Red: `bun run test -- --runInBand --silent src/components/store/compare/compare-grid.test.tsx` → UI未対応4件失敗／既存回帰8件成功。失敗理由はコレクション導線・読み込みstatus・エラーalert／再試行・取得ゼロ案内の欠如。応答キャンセルは既存回帰として先行成功。
- ブラウザー先行テスト: 変更前に追加したが最初の実行はChromiumのMachPort権限拒否で起動できず、ブラウザー上のRedは未確認。環境エラーをRed実績に含めない。権限を拡張して実装後の検証を実施。
- Green／Refactor: 関連Jest2スイート、グリッド12件＋ストア11件＝23/23成功。React Testing Libraryのact import整理後も再実行で成功。
- 全体Jest: `bun run test -- --runInBand --silent` と `--coverage` → 2566 passed／2569 total、238 suites（237 passed／1 skipped）、3 skipped tests、127 snapshots passed。前セッション・他作業の未コミット分を含む。coverageはStatements80.8%／Branches67.7%／Functions74.14%／Lines80.62%。ログは一時ファイル `compare-full-jest.log` と `compare-coverage-jest.log`（ローカル一時ディレクトリ、永続添付ではない）。
- 表示検証: `bunx playwright test --config=/private/tmp/compare.playwright.config.cjs` → Chromium6/6成功。PC1440px／モバイル390px／境界700px、空・4商品・読み込み・取得ゼロ・失敗／再試行、選択保持、個別削除・全消去、キーボードの横スクロールとfocus、色、ページ全体の横スクロールなし。axeはmainに限定、WCAG 2 AA相当の違反なし。reduced-motion設定とCSSのアニメーション停止を確認。
- ブラウザー検証の修正: Nextのroute-announcerにもalertロールがあるため、取得失敗のアサーションをmain内へ限定した。商品応答と画像はテスト内フィクスチャで再現。最終テストの画像はPlaywrightのoutputPathへ保存する。
- 品質: `bun run lint` → 0 errors／12 warnings、変更対象の限定ESLint → エラー・警告なし。`bunx tsc --noEmit` → 成功。既存warningは別画面にあり今回の範囲外。
- カバレッジ同期: `bun run coverage:dashboard` → 288 test files／328 lcov entries／18/80 cells。初回tsxのIPC権限拒否を権限拡張で解消。残っていた単一ファイルのlcovを全体coverageで更新してから再生成した。
- 文書同期: [比較要件](../compare/requirements.md)・[設計](../compare/design.md)・[タスク](../compare/tasks.md)・[進捗](../compare/PROGRESS.md)・[README](../compare/README.md)、[機能要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)・[UIインターフェース](../../../specs/multi-vendor-ecommerce/04-interfaces.md)・[ワークフロー](../../../specs/multi-vendor-ecommerce/05-workflows.md)・[品質](../../../specs/multi-vendor-ecommerce/06-quality.md)・[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)、[QA_HANDOFF](../../testing/QA_HANDOFF.md)・[COVERAGE_REPORT](../../testing/COVERAGE_REPORT.md)・[全体進捗](../../PROGRESS.md)・[元移行計画](../../../plans/design-system-adoption-plan.md)・生成ダッシュボード。
- 変更不要: [概要](../../../specs/multi-vendor-ecommerce/00-overview.md)・[アーキテクチャ](../../../specs/multi-vendor-ecommerce/02-architecture.md)・[データモデル](../../../specs/multi-vendor-ecommerce/03-data-model.md)・[Open Questions](../../../specs/multi-vendor-ecommerce/08-open-questions.md)。機能範囲・Actionの引数／戻り値・API・DB・認可は変更しない。スペック行比較・上限時の通知は既存の別課題を維持する。
- 実データ追加確認: 一時Playwright specで既存商品カードのハイドレーション完了を待ち、DOMのclickで比較選択を保存。実際の取得Actionで `E2E Test Product` が表示され、画像のnaturalWidthが正であることを確認。1/1成功、PC／モバイルの画像をローカル一時ディレクトリへ保存した。データベース変更なし。
- 追加確認中の切り分け: 初期手順はload待ち・画像のpointer遮蔽・選択ボタンの名前変更・ハイドレーション前操作で失敗。取得処理そのものの失敗とは扱わず、commit待ちとReactイベント準備後の保存を確認する手順で成功を確認した。既存商品カードのポインター操作全般は今回の移行範囲外。
- 最終ブラウザー再実行: ストリーミング画面のloadイベント待ちが不安定だったため、遷移はcommitを待ち、各表示条件をexpectで待つ方式に変更。最終版で6/6成功（22.0秒）。商品応答フィクスチャの確認と実データ1件の確認を区別する。
- 最終文書検証: 635件のローカル参照、66ページ／200部品のID、適用9／未適用49の件数、compare完了チェックの整合を確認。Prettierと `git diff --check` 成功。
- 制約: 他ブラウザーと全E2Eは未実行。共有ヘッダー・フッターは今回のaxe対象外。比較画面本体の完了と既存商品カード全体の検証を区別する。
- 次: 共通基盤DS-BASE-001。今回の比較画面を基盤変更後の回帰対象に含める。
