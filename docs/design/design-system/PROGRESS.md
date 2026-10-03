# デザインシステム移行 — 進捗ノート

- 更新日: 2026-10-03
- 状態: 運用文書・ルール整備済み／個別移行は継続
- 対象・優先度・受け入れ条件: [移行計画](../../../plans/layout-design/design-system-adoption-plan.md)。
- 実施手順: [design-system-workflow](../../../.agent/skills/design-system-workflow/SKILL.md)。
- 運用整備計画: [design-system-workflow-plan](../../../plans/layout-design/design-system-workflow-plan.md)。
- 全体進捗: [docs/PROGRESS.md](../../PROGRESS.md)。全体テスト統計の正本: [QA_HANDOFF](../../testing/QA_HANDOFF.md)。

## 現在地と次の作業

この文書は画面・部品の移行状態と検証証跡の正本。66ページ定義と200部品項目を2026-09-30のソース監査から初期登録した。cart移行でストア通知DS-COMP-201を追加。messages移行で購入者専用thread DS-COMP-202を追加（現台帳202部品）。ソース判定は本体適用8、未適用50、仮実装1、転送専用7。これらは検証済み件数ではない。compare・FAQs・profile・wishlist・公開サポート・cart・orders・payment・addresses・reviews・messages移行後のソース判定は本体適用23・未適用35（仮実装1・転送専用7は不変）。

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
| DS-PAGE-007 | `/cart` | 本体適用（2026-10-01移行） | P1 | 検証済み | [src/app/(store)/cart/page.tsx](<../../../src/app/(store)/cart/page.tsx>) | [cart移行記録](#cart移行記録) |
| DS-PAGE-008 | `/checkout` | 未適用 | P1 | TODO | [src/app/(store)/checkout/page.tsx](<../../../src/app/(store)/checkout/page.tsx>) | 未実施 |
| DS-PAGE-009 | `/compare` | 本体適用（2026-09-30移行） | P2 | 実装済み | [src/app/(store)/compare/page.tsx](<../../../src/app/(store)/compare/page.tsx>) | [compare実施記録](#compare移行記録) |
| DS-PAGE-010 | `/contact` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/contact/page.tsx](<../../../src/app/(store)/contact/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-011 | `/customer-service` | 本体適用（2026-10-01移行） | P2 | 検証済み | [src/app/(store)/customer-service/page.tsx](<../../../src/app/(store)/customer-service/page.tsx>) | [customer-service移行記録](#customer-service移行記録) |
| DS-PAGE-012 | `/dispute` | 未適用 | P2 | TODO | [src/app/(store)/dispute/page.tsx](<../../../src/app/(store)/dispute/page.tsx>) | 未実施 |
| DS-PAGE-013 | `/faq` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/faq/page.tsx](<../../../src/app/(store)/faq/page.tsx>) | 未実施 |
| DS-PAGE-014 | `/faqs` | 本体適用（2026-09-30移行） | P3 | 検証済み | [src/app/(store)/faqs/page.tsx](<../../../src/app/(store)/faqs/page.tsx>) | [FAQs実施記録](#faqs移行記録) |
| DS-PAGE-015 | `/legal` | 未適用 | P3 | TODO | [src/app/(store)/legal/page.tsx](<../../../src/app/(store)/legal/page.tsx>) | 未実施 |
| DS-PAGE-016 | `/offers` | 未適用 | P2 | TODO | [src/app/(store)/offers/page.tsx](<../../../src/app/(store)/offers/page.tsx>) | 未実施 |
| DS-PAGE-017 | `/` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/page.tsx](<../../../src/app/(store)/page.tsx>) | 未実施 |
| DS-PAGE-018 | `/product-support` | 本体適用（2026-10-01移行） | P3 | 検証済み | [src/app/(store)/product-support/page.tsx](<../../../src/app/(store)/product-support/page.tsx>) | [product-support移行記録](#product-support移行記録) |
| DS-PAGE-019 | `/product/[productSlug]/[variantSlug]` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx](<../../../src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx>) | 未実施 |
| DS-PAGE-020 | `/product/[productSlug]` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/product/[productSlug]/page.tsx](<../../../src/app/(store)/product/[productSlug]/page.tsx>) | 未実施 |
| DS-PAGE-021 | `/profile/addresses` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/addresses/page.tsx](<../../../src/app/(store)/profile/addresses/page.tsx>) | [addresses実施記録](#profile-addresses移行記録) |
| DS-PAGE-022 | `/profile/following/[page]` | 未適用 | P2 | TODO | [src/app/(store)/profile/following/[page]/page.tsx](<../../../src/app/(store)/profile/following/[page]/page.tsx>) | 未実施 |
| DS-PAGE-023 | `/profile/following` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/following/page.tsx](<../../../src/app/(store)/profile/following/page.tsx>) | 未実施 |
| DS-PAGE-024 | `/profile/history/[page]` | 未適用 | P2 | TODO | [src/app/(store)/profile/history/[page]/page.tsx](<../../../src/app/(store)/profile/history/[page]/page.tsx>) | 未実施 |
| DS-PAGE-025 | `/profile/history` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/history/page.tsx](<../../../src/app/(store)/profile/history/page.tsx>) | 未実施 |
| DS-PAGE-026 | `/profile/messages` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/messages/page.tsx](<../../../src/app/(store)/profile/messages/page.tsx>) | [messages実施記録](#profile-messages移行記録) |
| DS-PAGE-027 | `/profile/orders/[filter]` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/orders/[filter]/page.tsx](<../../../src/app/(store)/profile/orders/[filter]/page.tsx>) | [orders実施記録](#profile-orders移行記録) |
| DS-PAGE-028 | `/profile/orders` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/orders/page.tsx](<../../../src/app/(store)/profile/orders/page.tsx>) | [orders実施記録](#profile-orders移行記録) |
| DS-PAGE-029 | `/profile` | 本体適用（2026-09-30移行） | P2 | 検証済み | [src/app/(store)/profile/page.tsx](<../../../src/app/(store)/profile/page.tsx>) | [profile実施記録](#profile移行記録) |
| DS-PAGE-030 | `/profile/payment` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/payment/page.tsx](<../../../src/app/(store)/profile/payment/page.tsx>) | [payment実施記録](#profile-payment移行記録) |
| DS-PAGE-031 | `/profile/reviews` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/reviews/page.tsx](<../../../src/app/(store)/profile/reviews/page.tsx>) | [reviews実施記録](#profile-reviews移行記録) |
| DS-PAGE-032 | `/profile/settings` | 未適用 | P2 | TODO | [src/app/(store)/profile/settings/page.tsx](<../../../src/app/(store)/profile/settings/page.tsx>) | 未実施 |
| DS-PAGE-033 | `/profile/wishlist/[page]` | 本体適用（2026-09-30移行） | P2 | 検証済み | [src/app/(store)/profile/wishlist/[page]/page.tsx](<../../../src/app/(store)/profile/wishlist/[page]/page.tsx>) | [wishlist実施記録](#wishlist移行記録) |
| DS-PAGE-034 | `/profile/wishlist` | 転送専用 | 回帰検証 | 検証済み | [src/app/(store)/profile/wishlist/page.tsx](<../../../src/app/(store)/profile/wishlist/page.tsx>) | [wishlist実施記録](#wishlist移行記録) |
| DS-PAGE-035 | `/report-problem` | 未適用 | P2 | TODO | [src/app/(store)/report-problem/page.tsx](<../../../src/app/(store)/report-problem/page.tsx>) | 未実施 |
| DS-PAGE-036 | `/returns-exchange` | 本体適用（2026-10-01移行） | P2 | 検証済み | [src/app/(store)/returns-exchange/page.tsx](<../../../src/app/(store)/returns-exchange/page.tsx>) | [returns-exchange移行記録](#returns-exchange移行記録) |
| DS-PAGE-037 | `/store/[storeUrl]` | 本体適用・周辺確認 | 周辺部品を監査 | TODO | [src/app/(store)/store/[storeUrl]/page.tsx](<../../../src/app/(store)/store/[storeUrl]/page.tsx>) | 未実施 |
| DS-PAGE-038 | `/track-order` | 本体適用（2026-10-01移行） | P2 | 検証済み | [src/app/(store)/track-order/page.tsx](<../../../src/app/(store)/track-order/page.tsx>) | [track-order移行記録](#track-order移行記録) |
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
| DS-COMP-026 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/container.tsx](<../../../src/components/store/cart-page/container.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-027 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/cart-header.tsx](<../../../src/components/store/cart-page/cart-header.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-028 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/summary.tsx](<../../../src/components/store/cart-page/summary.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-029 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/empty-cart.tsx](<../../../src/components/store/cart-page/empty-cart.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-030 | P1 | カート・購入手続き（P1） | [src/components/store/cards/cart-product.tsx](<../../../src/components/store/cards/cart-product.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
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
| DS-COMP-056 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/compare/compare-grid.tsx](<../../../src/components/store/compare/compare-grid.tsx>) | 実装済み | [compare実施記録](#compare移行記録) |
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
| DS-COMP-077 | P2 | マイページ（P2） | [src/components/store/layout/profile-sidebar/sidebar.tsx](<../../../src/components/store/layout/profile-sidebar/sidebar.tsx>) | 検証済み | [profile実施記録](#profile移行記録) |
| DS-COMP-078 | P2 | マイページ（P2） | [src/components/store/profile/overview.tsx](<../../../src/components/store/profile/overview.tsx>) | 検証済み | [profile実施記録](#profile移行記録) |
| DS-COMP-079 | P2 | マイページ（P2） | [src/components/store/profile/orders-overview.tsx](<../../../src/components/store/profile/orders-overview.tsx>) | 検証済み | [profile実施記録](#profile移行記録) |
| DS-COMP-080 | P2 | マイページ（P2） | [src/components/store/profile/orders/orders-table.tsx](<../../../src/components/store/profile/orders/orders-table.tsx>) | 検証済み | [orders実施記録](#profile-orders移行記録) |
| DS-COMP-081 | P2 | マイページ（P2） | [src/components/store/profile/orders/order-table-header.tsx](<../../../src/components/store/profile/orders/order-table-header.tsx>) | 検証済み | [orders実施記録](#profile-orders移行記録) |
| DS-COMP-082 | P2 | マイページ（P2） | [src/components/store/profile/payments/payments-table.tsx](<../../../src/components/store/profile/payments/payments-table.tsx>) | 検証済み | [payment実施記録](#profile-payment移行記録) |
| DS-COMP-083 | P2 | マイページ（P2） | [src/components/store/profile/payments/payment-table-header.tsx](<../../../src/components/store/profile/payments/payment-table-header.tsx>) | 検証済み | [payment実施記録](#profile-payment移行記録) |
| DS-COMP-084 | P2 | マイページ（P2） | [src/components/store/profile/addresses/container.tsx](<../../../src/components/store/profile/addresses/container.tsx>) | 検証済み | [addresses実施記録](#profile-addresses移行記録) |
| DS-COMP-085 | P2 | マイページ（P2） | [src/components/store/profile/wishlist/container.tsx](<../../../src/components/store/profile/wishlist/container.tsx>) | 検証済み | [wishlist実施記録](#wishlist移行記録) |
| DS-COMP-086 | P2 | マイページ（P2） | [src/components/store/profile/following/container.tsx](<../../../src/components/store/profile/following/container.tsx>) | TODO | 未実施 |
| DS-COMP-087 | P2 | マイページ（P2） | [src/components/store/profile/reviews/reviews-container.tsx](<../../../src/components/store/profile/reviews/reviews-container.tsx>) | 検証済み | [reviews実施記録](#profile-reviews移行記録) |
| DS-COMP-088 | P2 | マイページ（P2） | [src/components/store/profile/reviews/reviews-header.tsx](<../../../src/components/store/profile/reviews/reviews-header.tsx>) | 検証済み | [reviews実施記録](#profile-reviews移行記録) |
| DS-COMP-089 | P2 | メッセージ共用部品（P2） | [src/components/shared/messages/messages-layout.tsx](<../../../src/components/shared/messages/messages-layout.tsx>) | TODO | 未実施 |
| DS-COMP-090 | P2 | メッセージ共用部品（P2） | [src/components/store/profile/messages/messages-container.tsx](<../../../src/components/store/profile/messages/messages-container.tsx>) | 検証済み | [messages実施記録](#profile-messages移行記録) |
| DS-COMP-091 | P2 | メッセージ共用部品（P2） | [src/components/store/profile/messages/conversation-thread.tsx](<../../../src/components/store/profile/messages/conversation-thread.tsx>) | TODO | 未実施 |
| DS-COMP-092 | P2 | メッセージ共用部品（P2） | [src/components/dashboard/seller/seller-messages-container.tsx](<../../../src/components/dashboard/seller/seller-messages-container.tsx>) | TODO | 未実施 |
| DS-COMP-093 | P2 | サポート・追跡（P2） | [src/components/store/support/support-form.tsx](<../../../src/components/store/support/support-form.tsx>) | 検証済み | [returns-exchange移行記録](#returns-exchange移行記録) |
| DS-COMP-094 | P2 | サポート・追跡（P2） | [src/components/store/track-order/track-order-form.tsx](<../../../src/components/store/track-order/track-order-form.tsx>) | 検証済み | [track-order移行記録](#track-order移行記録) |
| DS-COMP-095 | P2 | サポート・追跡（P2） | [src/components/store/track-order/track-order-result.tsx](<../../../src/components/store/track-order/track-order-result.tsx>) | 検証済み | [track-order移行記録](#track-order移行記録) |
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
| DS-COMP-201 | P1 | ストア通知 | [src/components/store/shared/store-toaster.tsx](../../../src/components/store/shared/store-toaster.tsx) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-202 | P2 | 購入者メッセージ専用スレッド | [src/components/store/profile/messages/profile-conversation-thread.tsx](<../../../src/components/store/profile/messages/profile-conversation-thread.tsx>) | 検証済み | [messages実施記録](#profile-messages移行記録) |
| DS-COMP-203 | P2 | ページング・フィルター（P2） | [src/components/store/browse-page/filters/attribute/attribute-facet-filter.tsx](<../../../src/components/store/browse-page/filters/attribute/attribute-facet-filter.tsx>) | 検証済み | [属性ファセット実施記録](#属性ファセット移行記録) |

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

- 計画: [承認済みの整備計画](../../../plans/layout-design/design-system-workflow-plan.md)。
- 状態: 検証済み（文書検証・計画・進捗同期完了）。
- 変更: 66画面・200部品の台帳、新スキル、AGENTSと既存ルールの参照を整備。
- Red／Green／画面検証: 対象外（文書のみ）。アプリコード・テスト・全体統計を変更しない。
- 文書同期: [移行計画](../../../plans/layout-design/design-system-adoption-plan.md)、[配置ガイド](../../../.claude/steering/documentation-guide.md)、[全体進捗](../../PROGRESS.md)。
- 変更不要: [機能概要](../../../specs/multi-vendor-ecommerce/00-overview.md)、[要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)、[インターフェース](../../../specs/multi-vendor-ecommerce/04-interfaces.md)、[ワークフロー](../../../specs/multi-vendor-ecommerce/05-workflows.md)、[品質](../../../specs/multi-vendor-ecommerce/06-quality.md)、[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)。開発運用文書のみで機能・API・DB・テスト方針を変更しない。
- 変更不要: [静的ページの進捗](../storefront-static-pages/PROGRESS.md)、[サポートフォームの進捗](../support-forms/PROGRESS.md)。過去の機能完了記録を維持し、移行状態はこのノートで追跡する。
- 検証結果: skill-creator付属の `scripts/quick_validate.py` を `python` で `.agent/skills/design-system-workflow` に対して実行 → `Skill is valid!`。初回の `python3` はPyYAML不足で失敗したため、既存のPyYAMLを利用できる `python` で成功を確認した。
- 文書検証: Pythonによる照合で66画面・200部品のID重複なし、元計画との全項目・順序一致、577件のローカルファイル参照の存在を確認。初回の照合は動的パスの角括弧を扱えず失敗したため、リンク／表の抽出を修正して全件成功を確認した。
- 差分検証: `git diff --check` 成功。新規文書の末尾空白・未置換テンプレートなし。画面の完了数と全体テスト統計は変更していない。
- 次の作業: DS-BASE-001。前セッションの関連仕様・QA引き継ぎ同期は各画面の残課題として維持する。
- 変更記録: 未コミット。

## compare移行記録

### 2026-09-30 DS-PAGE-009／DS-COMP-056 — /compare

- 計画: [compare-design-system-plan](../../../plans/layout-design/compare-design-system-plan.md)。適用スキルはdesign-system-workflowとspec-sync-after-test。
- 状態: 実装済み（受け入れ条件・Chromium検証・仕様書／計画／進捗同期完了。Firefox・WebKitのブラウザー検証が残るため検証済みにしない）。未コミット。
- 変更: 深緑のヒーロー・アイボリー比較面・ゴールドの操作と価格・セリフ見出し・罫線、件数表示、コレクション導線、空／取得中／失敗・再試行／商品取得ゼロを整備。既存価格ロジック・最大4件・localStorage・削除・商品リンクを維持。既存取得ActionをServer Componentからpropで渡す。
- Red: `bun run test -- --runInBand --silent src/components/store/compare/compare-grid.test.tsx` → UI未対応4件失敗／既存回帰8件成功。失敗理由はコレクション導線・読み込みstatus・エラーalert／再試行・取得ゼロ案内の欠如。応答キャンセルは既存回帰として先行成功。
- ブラウザー先行テスト: 変更前に追加したが最初の実行はChromiumのMachPort権限拒否で起動できず、ブラウザー上のRedは未確認。環境エラーをRed実績に含めない。権限を拡張して実装後の検証を実施。
- Green／Refactor: 関連Jest2スイート、グリッド12件＋ストア11件＝23/23成功。React Testing Libraryのact import整理後も再実行で成功。
- 全体Jest: `bun run test -- --runInBand --silent` と `--coverage` → 2566 passed／2569 total、238 suites（237 passed／1 skipped）、3 skipped tests、127 snapshots passed。前セッション・他作業の未コミット分を含む。coverageはStatements80.8%／Branches67.7%／Functions74.14%／Lines80.62%。ログは一時ファイル `compare-full-jest.log` と `compare-coverage-jest.log`（ローカル一時ディレクトリ、永続添付ではない）。
- 表示検証: `bunx playwright test --config=/private/tmp/compare.playwright.config.cjs` → Chromium6/6成功。PC1440px／モバイル390px／境界700px、空・4商品・読み込み・取得ゼロ・失敗／再試行、選択保持、個別削除・全消去、キーボードの横スクロールとfocus、色、ページ全体の横スクロールなし。axeはmainに限定、WCAG 2 AA相当の違反なし。reduced-motion設定とCSSのアニメーション停止を確認。
- ブラウザー検証の修正: Nextのroute-announcerにもalertロールがあるため、取得失敗のアサーションをmain内へ限定した。商品応答と画像はテスト内フィクスチャで再現。最終テストの画像はPlaywrightのoutputPathへ保存する。
- 品質: `bun run lint` → 0 errors／12 warnings、変更対象の限定ESLint → エラー・警告なし。`bunx tsc --noEmit` → 成功。既存warningは別画面にあり今回の範囲外。
- カバレッジ同期: `bun run coverage:dashboard` → 288 test files／328 lcov entries／18/80 cells。初回tsxのIPC権限拒否を権限拡張で解消。残っていた単一ファイルのlcovを全体coverageで更新してから再生成した。
- 文書同期: [比較要件](../compare/requirements.md)・[設計](../compare/design.md)・[タスク](../compare/tasks.md)・[進捗](../compare/PROGRESS.md)・[README](../compare/README.md)、[機能要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)・[UIインターフェース](../../../specs/multi-vendor-ecommerce/04-interfaces.md)・[ワークフロー](../../../specs/multi-vendor-ecommerce/05-workflows.md)・[品質](../../../specs/multi-vendor-ecommerce/06-quality.md)・[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)、[QA_HANDOFF](../../testing/QA_HANDOFF.md)・[COVERAGE_REPORT](../../testing/COVERAGE_REPORT.md)・[全体進捗](../../PROGRESS.md)・[元移行計画](../../../plans/layout-design/design-system-adoption-plan.md)・生成ダッシュボード。
- 変更不要: [概要](../../../specs/multi-vendor-ecommerce/00-overview.md)・[アーキテクチャ](../../../specs/multi-vendor-ecommerce/02-architecture.md)・[データモデル](../../../specs/multi-vendor-ecommerce/03-data-model.md)・[Open Questions](../../../specs/multi-vendor-ecommerce/08-open-questions.md)。機能範囲・Actionの引数／戻り値・API・DB・認可は変更しない。スペック行比較・上限時の通知は既存の別課題を維持する。
- 実データ追加確認: 一時Playwright specで既存商品カードのハイドレーション完了を待ち、DOMのclickで比較選択を保存。実際の取得Actionで `E2E Test Product` が表示され、画像のnaturalWidthが正であることを確認。1/1成功、PC／モバイルの画像をローカル一時ディレクトリへ保存した。データベース変更なし。
- 追加確認中の切り分け: 初期手順はload待ち・画像のpointer遮蔽・選択ボタンの名前変更・ハイドレーション前操作で失敗。取得処理そのものの失敗とは扱わず、commit待ちとReactイベント準備後の保存を確認する手順で成功を確認した。既存商品カードのポインター操作全般は今回の移行範囲外。
- 最終ブラウザー再実行: ストリーミング画面のloadイベント待ちが不安定だったため、遷移はcommitを待ち、各表示条件をexpectで待つ方式に変更。最終版で6/6成功（22.0秒）。商品応答フィクスチャの確認と実データ1件の確認を区別する。
- 最終文書検証: 635件のローカル参照、66ページ／200部品のID、適用9／未適用49の件数、compare完了チェックの整合を確認。Prettierと `git diff --check` 成功。
- 制約: 他ブラウザーと全E2Eは未実行。共有ヘッダー・フッターは今回のaxe対象外。比較画面本体の完了と既存商品カード全体の検証を区別する。
- 次: 共通基盤DS-BASE-001。今回の比較画面を基盤変更後の回帰対象に含める。

## FAQs移行記録

- 日付: 2026-09-30。対象: DS-PAGE-014。未コミット。
- [保存計画](../../../plans/layout-design/faqs-design-system-plan.md)。深緑ヒーロー／アイボリー本文／セリフ見出し、質問目次、サポート導線をFAQ専用CSS Moduleで実装。既存4件の質問・プレースホルダ回答を常時plain text表示する。
- Red: RTL新要件2件失敗、既存表示回帰1件成功。Chromiumの3画面幅で旧背景色による失敗を実測、308転送の回帰1件は成功。
- Green／Refactor: 目次と本文を同じ質問配列から生成し、空の日本語slugの代わりに一意なfaq-1〜4を採用。最終関連Jest 4 suites／24件成功（FAQ3・共有静的レイアウト5・コンテンツ5・proxy参照へ同期した既存middleware11）。
- Chromium 4/4成功（`E2E_BASE_URL=http://localhost:3001 bunx playwright test tests/e2e/faqs-design.spec.ts --project=chromium`）。1440／390／768px、全回答、横スクロールなし、目次focus・Enterでアンカー到達、FAQ mainのWCAG axe違反0、`/faq`の308転送を確認。1440／390pxスクリーンショットも目視確認。証跡はtest-results/faqs-1440.png、faqs-390.png、faqs-768.png（ローカル生成物）。
- `bun run lint`: 0 errors／既存12 warnings。`bunx tsc --noEmit`: 成功。別作業のmiddleware→proxy移行に残っていたテストimportを同期して型エラーを解消。proxy本体には変更を加えない。
- 環境記録: 初期起動はsandboxのEPERM、Turbopack内部panic、ポート衝突。Webpack起動へ変更後、CSS未適用も発生。ユーザーから別作業で解消済みとの連絡後に再実行し成功。これら環境エラーはRed実績に含めない。ブラウザ検証は別作業の修正を含む現在の作業ツリーで実施。
- 同期: [要件](../storefront-static-pages/requirements.md)、[設計](../storefront-static-pages/design.md)、[タスク](../storefront-static-pages/tasks.md)、[機能要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)、[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)、移行計画、QA_HANDOFF。02-architectureは別作業のproxy移行に伴う実体パスのみ同期。00-overview／03-data-modelはスコープ・データの変更がないため変更不要。
- `bun run coverage:dashboard`で292 test files／328既存lcov entriesを反映。全体Jest・coverageは再測定していないため全体成功数・率は据え置き。未実施: Firefox／WebKit、全E2E。FAQに送信・ローディング・エラー状態は存在しない。
- DS-PAGE-013は308回帰のみ確認。共有静的レイアウト・他画面の移行は今回の完了範囲に含めない。

- 最終文書確認: 更新対象内のローカル参照52件を確認し、proxy移行で切れた設計書参照を同期。ページ台帳の本体適用10／未適用48／転送7／仮実装1と66件の合計、FAQ完了チェックの整合を確認。変更対象ESLintと `git diff --check` 成功。

## profile移行記録

- 日付: 2026-09-30。DS-PAGE-029／DS-COMP-077・078・079。未コミット。
- [保存計画](../../../plans/layout-design/profile-design-system-plan.md)、[要件](../profile-overview/requirements.md)、[設計](../profile-overview/design.md)、[タスク](../profile-overview/tasks.md)、[進捗](../profile-overview/PROGRESS.md)。
- 共通layoutに深緑アカウント帯・アイボリーの枠、h1 My accountとセリフ見出しを導入。CSS Moduleの変数をshellに限定。sidebarは10リンクを保持し、モバイルでは折り返す。
- 会員名の大文字小文字と画像を保持し、名前未設定のfallback／Clerk取得失敗のalertと通常再読込を整備。クイックリンクと4注文フィルターを保持。未実装Coupons／Shopping creditの404リンクは準備中の非リンクへ、無操作のサポート行はContact／Disputeの既存窓口へのリンクへ変更。
- Red: RTL11件失敗／既存回帰2件成功（Settingsリンク、user=null）。Chromium4件失敗（新h1／navigationなし）／未認証転送1件成功。初期JestのAVIF解析エラーは画像をモックして解消し、要件による失敗を再測定。環境エラーをRedには含めない。
- Green／Refactor: shell・sidebar・概要2部品でCSSを共有し、定数からリンクを描画。日本語ラベル・装飾aria-hidden、aria-labelledbyとaria-currentを整理。モバイルでは会員名と設定リンクを別行へ調整。旧画像依存のテストモックを除去し、Prettier後の最終実行を記録。
- 関連Jest: `bun run test -- --runInBand --silent --runTestsByPath tests/component/store/profile-overview.test.tsx tests/component/store/profile-sidebar.test.tsx tests/component/store/settings-page.test.tsx tests/component/store/user-menu.test.tsx src/components/store/profile/orders/orders-table.test.tsx` → 5 suites／28件成功。氏名保持・未設定・user=null・取得失敗、準備中機能、クイックリンク・注文・サポート、ページング／フィルターの選択を確認。
- Chromium: `E2E_BASE_URL=http://localhost:3001 bunx playwright test tests/e2e/profile-design.spec.ts --project=chromium` → 5/5成功（38.0s）。1440／390／768px、通常表示（氏名なしfallback）、横スクロールなし、可視focus・Tab／Enter、profile共通枠のWCAG axe違反0（color-contrast除外なし）、未認証転送、Orders／Shipping address／Settingsへの遷移と選択、Clerk UserProfileの表示・モバイル横スクロールなしを確認。
- 実Clerkテストユーザーは既存session helperで作成・後処理し、公式testing signInで認証。seed／DB初期化／購入／フォーム送信は実行しない。スクリーンショットtest-results/profile-1440.png／profile-390.png／profile-768.pngを生成し、PC・モバイルを目視確認（ローカル生成物）。
- `bun run lint`: 0 errors／既存12 warnings。対象限定ESLint無警告、`bunx tsc --noEmit`: 成功、`git diff --check`: 成功。dashboardは294ファイル／既存lcov328、マトリクス18/80を再生成。全体Jest・coverage未再測定のため全体成功数・率を推測更新しない。
- 文書同期: profile-overview、profile-settingsの共通枠要件・設計・タスク・進捗、[SDD機能要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)、[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)、移行計画、QA、テスト実装計画、全体進捗。00-overview／02-architecture／03-data-modelは既存範囲・構成・データモデルを維持するため変更不要。
- 制約: Firefox／WebKit・全E2E・Clerk設定フォーム操作は未実行。エラー状態はRTLで検証。子ページ本文／UserProfile自体のデザイン移行は別IDのまま。旧profile a11y specのcontrast除外は過去のスイート設定であり、新specには適用しない。

- 最終文書整合: profile新設仕様・設定仕様・保存計画のローカルリンク68件を検証し、旧middleware参照と括弧入りパスを修正。ページ台帳11適用／47未適用／7転送／1仮実装=66、対象3部品のチェックと検証済み状態を同期。

## wishlist移行記録

- 日付: 2026-09-30。対象: DS-PAGE-033／DS-COMP-085、aliasの回帰DS-PAGE-034。未コミット。
- [保存計画](../../../plans/layout-design/wishlist-design-system-plan.md)、[要件](../profile-wishlist/requirements.md)、[設計](../profile-wishlist/design.md)、[タスク](../profile-wishlist/tasks.md)、[進捗](../profile-wishlist/PROGRESS.md)。
- profile共通枠に合わせたセリフ見出し・日本語リード・コレクションリンクを導入。共有見出しをpageとloadingで使用。既存ProductListのeditorial表示で最大3列、狭い画面は2列。現在ページの表示数とpage／totalPagesのみ表示する。
- 空はコレクションへの案内、取得失敗は汎用alertとフル再読込、loadingはstatus／aria-busyと静的スケルトン。URLページングへ変更し、ローカルstate／effectの旧ページへのpushを除去。番号は最大7件、境界方向は非リンク、現在ページ1件にaria-current。
- Red: RTL新要件5件失敗／正規化とredirectの既存回帰1件成功。Chromium新要件5件失敗を実測（コレクション導線、見出し配色、リンクページング）。
- Green／Refactor: 共通見出し・CSS Module・URLリンクへ整理。loadingのテスト1件は実装後の回帰確認（過去のRedは主張しない）。関連最終Jestはwishlist7、共有product-card11、profile query63、sidebar6、計87件／4 suites成功。
- コマンド: `bun run test -- --runInBand --silent --runTestsByPath tests/component/store/wishlist.test.tsx src/components/store/cards/product/product-card.test.tsx src/queries/profile.test.ts tests/component/store/profile-sidebar.test.tsx`。
- Chromium: `E2E_BASE_URL=http://localhost:3001 bunx playwright test tests/e2e/wishlist-design.spec.ts --project=chromium` → 5/5成功（50.7s）。空・10商品・最終1商品、1440／390／768px、横スクロールなし、focus・Enter、比較追加のaria-pressed、mainのWCAG axe違反0（contrast除外なし）、ページ変更・ブラウザ戻る、alias／範囲外／不正パラメーターの既存正規化を確認。
- 初回Greenの3画面幅テストは価格ノードも数えるselectorで20件になり失敗。商品Linkのみに限定して再実行・成功。テスト参照の誤りであり実装のRedには含めない。Clerk testingのテスト終了後通信警告は出たが、最終認証と全assertionは成功。
- 既存カタログ11商品をテスト顧客のwishlist fixtureに保存し、顧客の後処理で除去。商品作成・seed・DB初期化・購入は行わない。test-results/wishlist-1440.png／wishlist-390.png／wishlist-768.png／wishlist-empty.pngを生成しPC・モバイル・空を目視確認。fixtureの商品画像は既存のno_imageプレースホルダを含む。
- `bun run lint`: 0 errors／既存12 warnings。対象限定ESLint無警告、`bunx tsc --noEmit`: 成功、`git diff --check`: 成功。全体Jest／coverage・Firefox／WebKitは未実行。エラー・loadingの状態はRTL確認、ブラウザでの取得障害・遅延の強制再現は未実施。
- 文書同期: profile-wishlist、[機能要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)、[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)、移行計画、QA、テスト実装計画、全体進捗。00-overview／02-architecture／03-data-modelは既存機能範囲・構成・データを維持するため変更不要。保存バリアントの取得仕様や削除機能、他profile本文は変更しない。

- dashboard再生成は296ファイル／既存lcov328、マトリクス18/80。カバレッジは今回収集していないため率・ヒートマップの変更なし。

## track-order移行記録

- 日付: 2026-10-01。DS-PAGE-038／DS-COMP-094／095。未コミット。
- [保存計画](../../../plans/layout-design/track-order-design-system-plan.md)。深緑ヒーロー・クリーム背景・セリフ・ゴールド、案内／照会フォーム、結果カード、レスポンシブ折り返し。Server ComponentからactionをPropsで渡す。
- Red: RTL追加1件が「照会中…」なしで失敗（既存4件成功）。ブラウザー初回はsandboxのChromium制限で実行不能（Redに数えない）。実装後の成功結果で数量コントラスト4.48不足を検出し修正。
- Green/Refactor: 関連Jest `bun run test -- --runInBand src/components/store/track-order/track-order-form.test.tsx src/queries/order.test.ts` 82/82。既存照合・IDORは回帰確認。
- Playwright: 公開画面専用の一時config（既存localhost:3000、Chromium、1 worker、認証不要なのでClerk globalSetupを省略）で `tests/e2e/track-order-design.spec.ts` 3/3。1440/390/768px、未入力・送信中・未検出・失敗・再試行・成功、長いID／商品名、focus・横溢れなし。各状態axe AA違反0、contrast除外なし。PC／モバイル画像目視確認。
- lint: 0 errors／既存12 warnings。`bunx tsc --noEmit` 成功。dashboard再生成: 297テストファイル、既存lcov328。全体Jest／coverage再測定なし。
- [requirements](../track-order/requirements.md)、[design](../track-order/design.md)、[tasks](../track-order/tasks.md)、SDD [interfaces](../../../specs/multi-vendor-ecommerce/04-interfaces.md)／[workflows](../../../specs/multi-vendor-ecommerce/05-workflows.md)／[testing](../../../specs/multi-vendor-ecommerce/07-testing.md)、QA_HANDOFFを同期。
- overview／architecture／data-modelは確認し変更不要（DB・認証・プロダクト範囲を維持）。要件は画面の見た目・送信中仕様を同期。制約: 成功・失敗はaction応答モック。実注文DB照会・購入・外部送信なし。

## customer-service移行記録

- 2026-10-01、DS-PAGE-011、未コミット。[保存計画](../../../plans/layout-design/customer-service-design-system-plan.md)。
- 深緑ヒーロー・クリーム背景・ゴールド・セリフ、パンくず、案内＋番号付きカード。SUPPORT_LINKSの5タイトル・説明・URLを保持。公開Server Component、DB非依存。
- Red: `customer-service-design.spec.ts` 3幅で背景色がtransparentのため失敗（要件の期待値はcream）。Green: 実装後のPCキーボード遷移チェックが一度失敗し、Enter直前のfocusを明示して再検証。
- 最終Chromium3/3（1440/390/768px、配色・フォント・5導線・hover・focus・Enter・横溢れなし・axe AA違反0、contrast除外なし）。PC／モバイルスクリーンショット目視。注文追跡回帰3/3。
- 既存RTL `bun run test -- --runInBand 'src/app/\(store\)/customer-service/page.test.tsx'` 1/1（既存実装の導線回帰）。`bun run lint` 0 errors／既存12 warnings。`bunx tsc --noEmit` 成功。
- ブラウザーは既存localhost:3000を使う一時config、Chromium・1 worker・公開画面のためClerk globalSetupなし。`bunx playwright test --config /private/tmp/customer-service-playwright.config.ts customer-service-design` 3/3。
- storefront-static-pages requirements/design/tasks、SDD requirements/interfaces/workflows/testing、移行計画、QA_HANDOFF同期。overview／architecture／data-modelは変更不要（範囲・認証・データ変更なし）。
- dashboard再生成: 298ファイル・既存lcov328。全体Jest・coverageの再測定なし。残課題なし。遷移先フォームの外部送信は実行していない。

## returns-exchange移行記録

- 2026-10-01、DS-PAGE-036／DS-COMP-093（ブランド表示をopt-in、他画面は表示既定）。未コミット。[計画](../../../plans/layout-design/returns-exchange-design-system-plan.md)。
- 深緑・クリーム・ゴールド・セリフh1、パンくず、返品ポリシー全文を保つ案内＋フォーム、送信中ロック・受付完了。Clientのaction直接importを型のみにし、4ページがsubmitAction Propsを渡す。
- Red: ブランド送信中RTL1件が「送信中…」なしで失敗（既存と再試行回帰7件成功）。Chromium3件は旧背景transparentで失敗。失敗後再試行は既存挙動の回帰確認。実装後のaxeで入力エラー色の比率3.54不足を検出し、ブランドフォーム内のdestructiveトークンを修正。
- Green/Refactor: 関連Jest `bun run test -- --runInBand src/components/store/support/support-form.test.tsx src/queries/support.test.ts` 16/16（2 suites）。既存二重送信テストのpromise解決後の受付を待ち、act警告を解消。
- Chromium `bunx playwright test --config /private/tmp/returns-exchange-playwright.config.ts` 4/4。公開画面専用一時config、既存localhost:3000、1 worker、Clerk globalSetup省略。1440/390/768px、既存ポリシー全文・未入力・不正email/UUID・focus/Enter・送信中・失敗/再試行・受付、横溢れなし。通常／未入力／送信中／失敗／成功でaxe AA違反0（contrast除外なし）。PC／モバイルのフォームと受付画像を目視。
- contact/dispute/report-problemの入力とモック送信回帰も成功。他画面のデザイン移行とは区別する。
- `bun run lint`: 0 errors／既存12 warnings。`bunx tsc --noEmit`: 成功。dashboard再生成: 299ファイル／既存lcov328。全体Jest・coverage率再測定なし。
- [support-forms requirements](../support-forms/requirements.md)／[design](../support-forms/design.md)／[tasks](../support-forms/tasks.md)／[PROGRESS](../support-forms/PROGRESS.md)、SDD requirements/interfaces/workflows/testing、移行計画、QA_HANDOFF、テスト実装計画を同期。
- overview／architecture／data-modelは確認して変更不要（商品・認証・DB変更なし）。ポリシー・既存validation/action入出力は維持。実チケット作成・返金・在庫更新・外部送信なし。受け入れ範囲の残課題なし。

## product-support移行記録

- 2026-10-01、DS-PAGE-018、未コミット。[計画](../../../plans/layout-design/product-support-design-system-plan.md)。
- 深緑ヒーロー・クリーム・ゴールド・セリフ、Homeパンくず、3目次・番号付き本文・4サポート導線。PRODUCT_SUPPORT_SECTIONSとプレースホルダ表記を保持しplain text表示。専用Server Component／CSS Module。共有StaticPageLayoutは変更せずDS-COMP-123はTODOを維持。
- Red: ページRTL1件が目次不在、Chromium3件が旧背景transparentで失敗。本文保持は回帰確認。
- Green/Refactor: `bun run test -- --runInBand 'src/app/\(store\)/product-support/page.test.tsx' src/components/store/static/static-page-layout.test.tsx src/components/store/static/content/content.test.ts` 11/11、3 suites。
- `bunx playwright test --config /private/tmp/product-support-playwright.config.ts` Chromium3/3。公開ページ専用一時config、既存localhost:3000・1 worker・Clerk globalSetup省略。1440/390/768px、本文・目次focus/Enter・support-3への移動・ContactのEnter遷移・横溢れなし・axe AA違反0（contrast除外なし）。PC／モバイル画像を目視確認。
- `bun run lint`: 0 errors／既存12 warnings。`bunx tsc --noEmit`: 成功。dashboard再生成301ファイル／既存lcov328。全体Jest／coverage率再測定なし。
- storefront-static-pages requirements/design/tasks/PROGRESS、SDD requirements/interfaces/workflows/testing、移行計画・QA_HANDOFF・テスト計画を同期。overview／architecture／data-modelは変更不要（範囲・認証・DB変更なし）。親store layoutのレンダリング方針は維持。受け入れ範囲の残課題なし、外部送信なし。

## Cart移行記録

- 2026-10-01、DS-PAGE-007／DS-COMP-026〜030・201、未コミット。[計画](../../../plans/layout-design/cart-design-system-plan.md)／[要件](../cart/requirements.md)／[設計](../cart/design.md)。
- 深緑ヒーロー・アイボリー・ゴールド、レスポンシブな商品行と集計、空・読み込み・在庫切れ・同期失敗・保存中、全選択・削除・wishlist・数量のnative操作、/legal実リンク。既存の消失明細の除外通知を保持。削除時の送料寄与分を除去し、Server Componentからaction propsを渡す。
- DS-COMP-035〜037相当の保証・配送国表示はカート内にスコープして検証。旧共有部品そのものは変更していないため、それらのTODOは維持。DS-COMP-102/103（Radix）とSonnerの移行は対象外。
- Red: RTL2件がアクセシブル名不在・保存中ボタン未無効化で失敗、Chromiumの390px空状態がmain/h1不在で失敗。追加の送料cleanupテストがunmount時の集計更新不在で失敗。既存機能は回帰確認。
- Green/Refactor: `bun run test --runInBand tests/component/store/cart-summary.test.tsx tests/component/store/cart-product.test.tsx tests/component/store/cart-container.test.tsx tests/unit/next-dev-cache.test.ts` 27/27、4 suites。キャッシュ設定テストは開発時の分離が未対応でRed、既定と本番出力の回帰を含む。
- `bunx playwright test --config /private/tmp/cart-playwright.config.ts tests/e2e/cart-design.spec.ts --project=chromium` 10/10。localhost:3001、1440/390/768px、空／商品入り／読み込み／在庫切れ／同期失敗／wishlist成功／保存中・失敗、選択・削除・focus、横あふれなし、mainと通知のaxe AA違反0（contrast除外なし）。操作のaction応答はmock、PC/モバイル画像を目視確認。
- `bun run lint`: 0 errors／既存12 warnings。`bunx tsc --noEmit`: 成功。`git diff --check`: 成功。dashboard再生成303ファイル／既存lcov328、全体Jestとカバレッジ率は再測定していない。
- 検証中にDocker/ホストが.nextを共有しClerk module factory不在・Turbopack panicが発生。ユーザー指示で両サーバー停止・キャッシュ削除後、NEXT_DEV_DIST_DIRで3001の出力を.next/cart-previewへ分離。開発時のみ有効、既定・本番は.nextを保持。再起動後の最終10件は全成功。
- 01-requirements／02-architecture／07-testing、cart要件・設計、移行計画・QA_HANDOFF・テスト計画・全体進捗を同期。00-overview／03-data-model／04-interfaces／06-qualityは変更不要（商品スコープ、DB、API、品質基準の変更なし）。05-workflowsの既存カート同期／購入フローは保持し表示と再送信防止を追記。
- 画像回帰: `tests/e2e/visual/cart.spec.ts` の古い商品追加通知期待値を既存実装の「Added to your bag」へ同期。空／商品入りのChromium画像基準を更新して目視確認後、`bunx playwright test --config /private/tmp/cart-playwright.config.ts tests/e2e/visual/cart.spec.ts --project=chromium`（更新なし）2/2成功。商品入りは既存fixtureの商品を使い、購入・保存を行わずゲストカート追加と同期を確認。

## profile-orders移行記録

- 2026-10-02〜03。DS-PAGE-028/027、DS-COMP-080/081、未コミット。[保存計画](../../../plans/layout-design/profile-orders-design-system-plan.md)、[要件](../profile-orders/requirements.md)、[設計](../profile-orders/design.md)、[タスク](../profile-orders/tasks.md)。
- 共通account枠に合わせたセリフh1・アイボリー・濃いゴールド、注文カード、折り返す状態/期間/検索/ページャ。ID/日付/画像/数量/2状態/金額/詳細URLを保持。検索をフォーム送信へ、全解除は期間も戻す。空/条件付き空/初回失敗/再取得失敗/取得中/再試行を整備。
- Server Componentからaction Propsを渡し、getUserOrdersForDisplayが既存所有者queryを経由してシリアライズ可能な表示項目のみ返す。Clientの直接action import・mount時の重複取得を除去。認可/DB/購入処理は変更しない。
- Red: 新RTL5件失敗、既存金額回帰2件成功。Chromium390pxのh1不在1件失敗。初回RTLのrouterモック不足は環境エラーとして除外し、修正後に再測定。Refactor後のサーバー/route loading3件と表示query2件は実装後回帰確認。
- 最終Jest: `bun run test -- --runInBand --silent --runTestsByPath src/components/store/profile/orders/orders-table.test.tsx src/queries/profile.test.ts tests/component/store/profile-sidebar.test.tsx` → 81/81、3 suites。検索/空文字解除、条件保持/ページリセット、期間を含む全解除、取得中ロック、旧結果非表示、再試行、初回失敗/loading/重複取得なし、金額/投影/所有者/認証失敗時DB未実行を確認。
- 最終Chromium: `bunx playwright test --config /private/tmp/profile-orders-playwright.config.ts` → 5/5（29.6s）。既存localhost:3000、1 worker、実Clerk test session/cleanup。1440/390/768px、空/通常/長いID、focus/Enter、詳細href、状態表示、モバイル取得中/失敗/再試行/検索/期間/ページング/全解除、filter routeと不正値fallback、未認証転送。対象本文axe AA違反0（contrast除外なし）、横溢れなし。PC/モバイル画像を目視確認。
- 初回GreenのRTLは矢印込みのページボタン名の不一致を検出しaria-labelを明示。ブラウザーの失敗チェックはNext route announcerとalertが重複したため本文へスコープ。fixture画像パスを既存プレースホルダへ修正後、最終5件を再実行。テスト参照修正はRed実績に含めない。
- `bun run lint`: 0 errors／既存11 warnings（旧OrdersTable effect除去により全体警告12→11）。`bunx tsc --noEmit`: 成功。`git diff --check`: 成功。dashboard306ファイル／既存lcov328、18/80。全体Jestとcoverageは再測定せず前回実測保持。最初のdashboard生成はtsx IPCのsandbox制限で失敗し、許可付き再実行で成功。
- 文書同期: profile-orders4文書、SDD requirements/architecture/interfaces/workflows/testing、移行計画/台帳、QA_HANDOFF/TEST_IMPLEMENTATION_PLAN/全体進捗。00-overview・03-data-model・06-qualityは確認済みで変更不要（商品範囲/モデル/認可/品質基準を維持）。
- 制約: 通常注文/遅延/失敗はaction応答mock、初期空は実query。実注文を作成せず購入/支払/外部送信なし。Firefox/WebKit/全E2Eは未実行。受け入れ範囲の残課題なし。

- 最終文書整合: 新設・更新部分のローカルリンク41件（アンカー含む）を検証。ページ計画の12本体適用/7検証済み/39未適用/7転送/1仮実装=66件、対象部品2件のチェックと検証済み状態を照合。

## profile-payment移行記録

- 2026-10-03。DS-PAGE-030、DS-COMP-082/083、未コミット。[保存計画](../../../plans/layout-design/profile-payment-design-system-plan.md)、[要件](../profile-payment/requirements.md)、[設計](../profile-payment/design.md)、[タスク](../profile-payment/tasks.md)。
- My paymentsのセリフh1・日本語リード・サポート、アイボリー/深緑/濃いゴールドの支払いカード、3方法/4期間/検索/ページャ。ID/更新日/決済ID/方法/ドル金額/状態/注文リンクを保持し、長いIDを折り返す。検索案内を実queryの支払いID/決済IDへ同期。空/条件付き空/初回失敗/再取得失敗/取得中/再試行を整備。
- getUserPaymentsForDisplayは既存所有者queryへ委譲し、最小表示データ・number金額・ISO日付を返す。Server Componentからaction Propsを渡し、Client直接action import/mount時重複取得を除去。同期refとnative disabledで二重要求を防ぐ。条件変更でpage=1、全解除は期間も戻す。既存getUserPayments/決済/認可/DBは変更しない。先行ordersのコードも変更しない。
- Red: 新RTL5件失敗・Stripe/PayPal金額の既存回帰2件成功。Chromium390pxのh1不在1件を実測。環境エラーなし。Green/Refactor後のサーバー/route loading3件と表示query2件は実装後回帰確認。旧無効filter値のmock header/pager、consoleログだけの検証、競合要求テストを実操作/汎用失敗/操作ロックに同期。
- 最終Jest: `bun run test -- --runInBand --silent --runTestsByPath src/components/store/profile/payments/payments-table.test.tsx src/components/store/profile/orders/orders-table.test.tsx src/queries/profile.test.ts tests/component/store/profile-sidebar.test.tsx` → 93/93、4 suites。money /100なし、条件/ページング/検索解除/全解除、取得中二重要求なし/旧結果非表示、再試行/初回失敗/loading/重複取得なし、最小投影/所有者/認証失敗時DB未実行、注文履歴/sidebar回帰を確認。
- 最終Chromium: `bunx playwright test --config /private/tmp/profile-payment-playwright.config.ts` → 5/5（29.4s）。既存localhost:3000、1 worker、実Clerk test session/cleanup。1440/390/768px、空/通常/長い支払いID/決済ID、focus/Enter、ドル金額/状態/詳細href/sidebar選択、モバイル取得中/失敗/再試行/期間/検索/ページング/全解除、未認証転送。本文axe AA違反0（contrast除外なし）、横溢れなし。PC/モバイルスクリーンショットtest-results/profile-payment-1440.png・profile-payment-390.pngを目視確認。
- `bun run lint`: 0 errors/既存11 warnings。`bunx tsc --noEmit`: 成功。`git diff --check`: 成功。dashboard再生成307ファイル/既存lcov328、18/80。全体Jest/coverage率は再測定せず前回実測保持。
- 文書同期: profile-payment4文書、SDD requirements/architecture/interfaces/workflows/testing、移行計画/台帳、QA_HANDOFF/テスト実装計画/全体進捗。00-overview/03-data-model/06-qualityは確認済みで変更不要（商品範囲/DBモデル/認可/品質基準を維持）。
- 制約: 初期空は実query、通常データ/遅延/失敗はaction応答mock。初回失敗/loadingはRTL。実支払いを作成せず購入/決済/返金/provider呼び出しなし。Firefox/WebKit/全E2E/全体coverage未実行。受け入れ範囲の残課題なし。

- 最終文書整合: 先行orders分を含む新設/更新部分のローカルリンク79件（アンカー含む）を検証。ページ台帳12本体適用/8検証済み/38未適用/7転送/1仮実装=66、対象部品2件の計画チェック/検証済み状態を照合。対象限定ESLintも無警告。

## profile-addresses移行記録

- 2026-10-03。DS-PAGE-021、DS-COMP-084、未コミット。[保存計画](../../../plans/layout-design/profile-addresses-design-system-plan.md)、[要件](../profile-addresses/requirements.md)、[設計](../profile-addresses/design.md)、[タスク](../profile-addresses/tasks.md)。
- My shipping addressesのserif h1/日本語リード/サポート、住所カードと既定badge、追加/編集/既定変更。profile専用RHF/ZodフォームとDB対応国select、Radix dialog、空/取得中/汎用失敗/入力保持再試行/成功を整備。長い住所を折り返し、保存中は二重要求と閉じる/Escape/外側をロック。全入力disabled中もdialog自体をキーボードでスクロール可能にした。
- 新load/save/default facadeは最小住所/country投影、requireUser/UUID/既存フォームvalidation、編集/既定の所有者whereと既存upsert transactionを使用。新フォームではdatesを送らず既存createdAtを保持。Server Componentからaction Props、Client直接action importなし/mount重複取得なし。checkout/共有旧住所部品DS-COMP-020/021/199は今回移行せずTODOを維持。
- Red: 先行RTL6件/query11件の失敗とChromium390px h1不在1件を実測。Greenで非同期validation前の二重送信ガードを修正。server/loading/国取得失敗等5件は実装後回帰確認。ブラウザは初期hydration完了を待って操作し、pointer操作後のfocusテストはkeyboard操作へ切り替えて確認。
- 最終Jest: `bun run test -- --runInBand --silent --runTestsByPath tests/component/store/profile-addresses.test.tsx src/queries/profile-addresses.test.ts src/queries/user.test.ts tests/component/store/shipping-form.test.tsx tests/component/store/checkout-container.test.tsx` → 110/110、5 suites、5.23s。フォーム/状態遷移/所有者where/認可失敗と他人IDで書き込みなし/最小投影/タイムスタンプ/共有フォームとcheckout回帰を確認。
- 最終Chromium: `bunx playwright test --config /private/tmp/profile-addresses-playwright.config.ts` → 5/5、45.9s。既存localhost:3000、1 worker、実Clerk test session/cleanup。1440/390/768pxの空/通常/長い住所、追加/編集値復元/validation/保存中/失敗/再試行/成功/既定変更、focus/Tab/Enter/Escape/起点復帰、未認証転送。本文/dialog axe AA違反0（contrast除外なし）、横溢れなし。test-results/profile-addresses-1440.png・profile-addresses-390.png・profile-addresses-dialog-390.pngを目視確認。
- `bun run lint`: 0 errors/既存11 warnings。`bunx tsc --noEmit`: 成功。dashboard再生成310ファイル/既存lcov328、18/80。全体Jest/coverage率は再測定せず前回実測保持。
- 文書同期: profile-addresses4文書、SDD requirements/architecture/interfaces/workflows/testing、移行計画/台帳、QA_HANDOFF/テスト実装計画/全体進捗。00-overview/03-data-model/06-qualityは確認済み・変更不要（範囲/DBモデル/認可/品質基準を維持）。旧profile E2Eの住所native selectorと注文カード導線を同期。
- 制約: 初期空は実query、通常fixture/保存/既定変更はaction応答mock。住所DBへの書き込み/購入/seed/実決済をせず、旧DB書き込みprofile E2Eは未実行。Firefox/WebKit/全E2E/全体coverage未実行。受け入れ範囲の残課題なし。

- 最終文書整合: 先行orders/payment分を含む新設/更新部分のローカルリンク122件（アンカー含む）を検証。計画台帳12本体適用/9検証済み/37未適用/7転送/1仮実装=66、DS-PAGE-021/DS-COMP-084の状態と計画チェックを照合。`git diff --check`成功、対象限定ESLint無警告、整形後tsc成功。

## profile-reviews移行記録

- 2026-10-03。DS-PAGE-031、DS-COMP-087/088、未コミット。[保存計画](../../../plans/layout-design/profile-reviews-design-system-plan.md)、[要件](../profile-reviews/requirements.md)、[設計](../profile-reviews/design.md)、[タスク](../profile-reviews/tasks.md)。
- My reviewsのserif h1/日本語リード/サポート、account配色の専用reviewカード、native評価/期間/本文検索/全解除/ページャ。投稿者のマスク名/avatar、小数評価/variant/色/size/数量/本文/写真を保持し、更新日とalt fallbackを追加。長い値/改行と画像wrap、44px操作/focus。商品ページ共有ReviewCard（DS-COMP-072）は変更せずTODOを維持。
- getUserReviewsForDisplayは既存所有者queryへ委譲、最小review/user name+picture/image id+url+alt投影とISO updatedAt。Server Componentからaction Props、Client直接import/mount重複取得を除去。同期ref/fieldset disabledで二重要求を防ぎ、旧結果/pagerを隠す。汎用失敗と条件保持retry。Search/Enter・空検索解除、未送信draftを保持、条件変更page=1、全解除は期間も戻す。既存認証/query/DB/投稿機能は変更しない。
- Red: RTL6失敗/query2失敗、初期データ/pager回帰1件は旧実装でも成功。Chromium390px h1不在1件を実測。環境エラーなし。server/loading/未送信draft4件は実装後回帰確認。旧無効filter/period mock、ログのみの検証を実操作と失敗/再試行へ同期。
- 最終Jest: `bun run test -- --runInBand --silent --runTestsByPath src/components/store/profile/reviews/reviews-container.test.tsx src/queries/profile-reviews.test.ts src/queries/profile.test.ts tests/component/store/profile-sidebar.test.tsx src/components/store/profile/orders/orders-table.test.tsx src/components/store/profile/payments/payments-table.test.tsx tests/component/store/profile-addresses.test.tsx` → 116/116、7 suites、4.685s。先行account画面/sidebar/query回帰を含む。
- 最終Chromium: `bunx playwright test --config /private/tmp/profile-reviews-playwright.config.ts` → 5/5、49.9s。既存localhost:3000、1 worker、実Clerk test session/cleanup。1440/390/768pxの空/通常/長い本文とvariant/写真/小数評価、focus/Enter/sidebar選択、mobile取得中/失敗/再試行/評価/期間/本文検索/条件付き空/空検索解除/ページング/全解除、未認証転送。本文axe AA違反0（contrast除外なし）、横溢れなし。test-results/profile-reviews-1440.png・profile-reviews-390.pngを目視確認。失敗alertはレビュー領域にscopeしNext route announcerと区別。
- lint 0 errors/既存11 warnings、tsc成功。dashboard実測312ファイル/既存lcov328、18/80。全体Jest/coverage率は再測定せず前回実測保持。
- 文書同期: profile-reviews4文書、SDD01/02/04/05/07、移行計画/台帳、QA_HANDOFF/テスト実装計画/全体進捗。00-overview/03-data-model/06-qualityは確認済み・変更不要（機能範囲/DBモデル/認可/品質基準を維持）。
- 制約: 初期空は実query、通常/遅延/失敗はaction応答mock。レビューDB書き込み/購入/seed/実決済/外部送信なし。初回失敗/route loadingはRTL。Firefox/WebKit/全E2E/全体coverage未実行。受け入れ範囲の残課題なし。

- 最終文書整合: 先行account移行分を含む新設/更新部分のローカルリンク158件（アンカー含む）を検証。台帳12本体適用/10検証済み/36未適用/7転送/1仮実装=66、対象3IDと部品2件の計画チェックを照合。`git diff --check`成功、対象限定ESLint無警告、整形後tsc成功。

## profile-messages移行記録

- 2026-10-03。DS-PAGE-026、DS-COMP-090、新設DS-COMP-202、未コミット。[保存計画](../../../plans/layout-design/profile-messages-design-system-plan.md)、[要件](../profile-messages/requirements.md)、[設計](../profile-messages/design.md)、[タスク](../profile-messages/tasks.md)。
- My messagesのserif h1/日本語リード/サポート、account配色の会話一覧と購入者専用スレッド。PC2ペイン/mobile縦配置、長い店舗名/本文/改行wrap、native会話選択/pressed、You/Storeと日時、focus可能な一覧/log。label付きcomposer、trim/1〜2000文字、送信中入力/切替/一覧再読込ロック、失敗時draft保持、成功status/再取得。
- 新表示facadeは既存認証/所有者/参加者queryへ委譲し、表示項目とISO日時へ投影。Server Componentから4action Propsを注入し、新購入者Clientに直接action importなし。初回一覧失敗/retryとroute loading、スレッド取得/既読/送信失敗の汎用案内/retryを整備。旧shared hook/layout/threadと販売者画面DS-COMP-089/091/092は変更せずTODOを維持。
- 専用hookは5秒poll/背面停止/多重要求防止、live IDとcancelledで切替/unmount旧応答を破棄。送信後の再取得は進行中pollの後へqueueし、新着取得を取りこぼさない。認可、送信transaction、DBモデルは変更しない。
- Red: 先行RTL8件/query4件の失敗、Chromium390px h1不在1件を実測（環境エラーなし）。Green/Refactor後のserver/loading/上限validation/queued refresh5件は実装後回帰。旧query直接呼び出し・子モック・consoleログだけの確認をaction Props/実フォーム操作/汎用retryへ同期。
- 最終Jest: `bun run test -- --runInBand --silent --runTestsByPath src/components/store/profile/messages/messages-container.test.tsx src/queries/profile-messages.test.ts src/queries/message.test.ts src/components/store/profile/messages/conversation-thread.test.tsx src/components/dashboard/seller/seller-messages-container.test.tsx tests/component/store/profile-sidebar.test.tsx src/components/store/profile/reviews/reviews-container.test.tsx` → 94/94、7 suites、4.003s。既存queryのIDOR3階層と送信/既読、旧thread、販売者/sidebar/reviews回帰を含む。
- 最終Chromium: `bunx playwright test --config /private/tmp/profile-messages-playwright.config.ts` → 5/5、41.4s。実Clerk test session/cleanup、初期空実query、1440/390/768px、空/長い会話・本文/双方向bubble、focus/Enter、mobile取得失敗/retry・既読失敗/retry・空入力validation・送信中lock・送信失敗/draft保持/retry/success、未認証転送。本文axe AA違反0（contrast除外なし）、横溢れなし。test-results/profile-messages-1440.png・profile-messages-390.pngを目視確認。
- lint 0 errors/既存11 warnings、tsc成功。dashboard実測314ファイル/既存lcov328、18/80。全体Jest/coverage率は再測定せず前回実測保持。
- 文書同期: 既存profile-messages5文書の旧schema未実装/旧UI例/Client直接import可の記述を現行設計へ同期、SDD01/02/04/05/07、移行計画/台帳、QA/テスト実装計画/全体進捗。00-overview/03-data-model/06-qualityは確認済み・変更不要（範囲/DBモデル/認可/品質基準を維持）。初回機能実装のフェーズ/往復E2E履歴は保持。
- 制約: 会話/スレッド/送信/既読はaction応答mock。店舗への実送信/会話DB作成/購入/seedなし。初期サーバー失敗/loadingはRTL、poll/raceはRTL。既存AC-M8実往復E2E/Firefox/WebKit/全E2E/全体coverageは未実行。受け入れ範囲の残課題なし。

- 最終文書整合: 新設/更新部分のローカルリンク33件（アンカー含む）を検証。台帳12本体適用/11検証済み/35未適用/7転送/1仮実装=66、部品202件、新規/対象3IDと計画チェック、旧共有3IDのTODO維持を照合。`git diff --check`成功、対象限定ESLint無警告。

## 属性ファセット移行記録

### 2026-10-03 DS-COMP-203 — /browse 属性ファセット（新規部品）

- 計画: [plans/076](../../../plans/076-facet-counts-and-min-price.md)（Step 5）。設計: [faceted-search design](../faceted-search/design.md) §2-Q3
- 状態: 検証済み（新規部品。既存 Size フィルタと同じ見出し・行・選択マークの書式）
- 変更: `filters/attribute/attribute-facet-filter.tsx` を新設し、`filters.tsx` から Size の下に描画。値は `/browse` の Server Component が `getProductFacets` で集計して props で渡す（Server Action を client から呼ばない）。`?attr.<key>=<value>` をトグルし、ページ番号は外す。開閉は `hidden` 属性。ストアページ（`/store/[storeUrl]`）は facets を渡さないため表示変化なし。
- Red: `attribute-facet-filter.test.tsx` を先に作成し、モジュール不在で失敗（6 件）。Green 後、開閉ケースの失敗はテスト側の取得方法（`hidden` 要素はロール検索から除外）だったため `{ hidden: true }` に修正。
- Green／Refactor: `bun run test -- src/components/store/browse-page/filters/attribute/attribute-facet-filter.test.tsx` 6/6、`browse/page.test.tsx` 23/23、lint 0 errors（既存 12 warnings）、tsc 成功。
- 表示確認: 1440px（`/browse?category=lux-women&attr.material=silk`・ラグジュアリーデータ）で Material / Pattern / Season の 3 セクション、Silk 選択時に Material 内の他の値の件数を維持し他 key は 4 件の母集合で再集計、横スクロールなし。390px でフィルタパネルを開き横スクロールなし（scrollWidth 390）、値ボタンは幅 343 × 高さ 32、focus で 2px のアウトライン、Enter で選択でき URL に `attr.material=wool` が追加され 6 件（OR）に。axe: `tests/e2e/a11y/browse.spec.ts` を seed カテゴリ URL（ファセットあり）に変更し chromium で違反 0（color-contrast は既知負債 OI-10 で従来どおり除外）。ストアフロントのためテーマはライトのみ。
- 文書同期: [04-interfaces](../../../specs/multi-vendor-ecommerce/04-interfaces.md)（/browse の `attr.*`・`getProductFacets`）、[03-data-model](../../../specs/multi-vendor-ecommerce/03-data-model.md)、[08-open-questions](../../../specs/multi-vendor-ecommerce/08-open-questions.md)（価格の絞り込みの意味）、[design.md §5](../faceted-search/design.md)。
- 残課題／保留: フィルタ見出し（DS-COMP-059 `filters/header.tsx`）の「Filter (n)」件数と選択中チップに属性の選択が含まれない（既存 `queries` の項目だけを数える）。解除は各ファセットのボタンと「Clear All」で可能。DS-COMP-059 の移行時に `attr.*` のチップ化を含めること。
- 変更記録: 未コミット
