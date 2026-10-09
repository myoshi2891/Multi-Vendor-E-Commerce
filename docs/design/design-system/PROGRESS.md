# デザインシステム移行 — 進捗ノート

## 2026-10-09 監査指摘修正後の現在地

公開3画面の指摘操作を修正し、実3幅で確認。属性3画面は個別UI/Portal/Action Propsを適用し補助検証済み、認証後実受け入れ保留。現在のソースは本体適用59・仮実装1・転送7の計67。部品245＝検証済み26・実装済み12・保留98・TODO109（未完了219は再実装数ではない）。下記の全監査の数値は修正前の歴史として維持する。[証跡](#監査指摘6画面移行記録)。

## 2026-10-09 全実ルート再監査

67ルート＝画面本体60（公開20、認証後機能39、仮実装1）＋転送7。ソース判定は本体適用56・個別部分移行3・仮実装1・転送7。242部品＝検証済み26・実装済み12・保留91・TODO113。下記の66ページ/240部品/55適用等は過去時点の集計。現在の正確な範囲・証跡は[全実画面再監査](full-route-reaudit-2026-10-09.md)を参照。

公開20画面のPC/モバイル初期表示を目視確認。browseは旧ページング色/27px操作、homeはmotion切替32〜38px、商品詳細はカテゴリ/評価/share/follow等の操作寸法不足。属性3画面は親theme適用済み・個別UI/Portal部分移行。seller/storesは仮実装。修正対象既知6画面＋仮実装1だが、認証後機能39は本体未確認（属性3を含む）で確定総残数ではない。台帳を全状態検証済みへ昇格しない。


- 更新日: 2026-10-09
- 状態: 運用文書・ルール整備済み／個別移行は継続
- 対象・優先度・受け入れ条件: [移行計画](../../../plans/layout-design/design-system-adoption-plan.md)。
- 実施手順: [design-system-workflow](../../../.agent/skills/design-system-workflow/SKILL.md)。
- 運用整備計画: [design-system-workflow-plan](../../../plans/layout-design/design-system-workflow-plan.md)。
- 全体進捗: [docs/PROGRESS.md](../../PROGRESS.md)。全体テスト統計の正本: [QA_HANDOFF](../../testing/QA_HANDOFF.md)。

## 現在地と次の作業

この文書は画面・部品の移行状態と検証証跡の正本。66ページ定義と200部品項目を2026-09-30のソース監査から初期登録した。cart移行でストア通知DS-COMP-201を追加。messages移行で購入者専用thread DS-COMP-202を追加、属性facet DS-COMP-203と購入導線CSS DS-COMP-204を追加、公開ページDS-COMP-205・account共通表示206・履歴container207を追加（優先7画面で208〜216、優先6画面で217〜218を追加、P3優先6画面で219〜225を追加、P4優先6画面で226〜233を追加、今回の購入導線共通UIで234〜237を追加、商品レビュー専用CSS238を追加、通知一覧239・未読バッジ240を追加、現台帳240部品）。ソース判定は本体適用8、未適用50、仮実装1、転送専用7。これらは検証済み件数ではない。購入者・販売者移行後の現在のソース判定は本体適用55・未適用3・仮実装1・転送専用7。本体適用55の内訳は本体検証済み15・周辺のみ適用12・認証後受け入れ保留28。検証済みの転送alias4件は本体検証済み15件へ加算しない。

About・Contact・sign-in・sign-upは前セッションで実装・一部検証済みだが、移行全体の受け入れ条件と関連文書同期の確認が残るため「実装済み」で登録する。他の本体適用ページも周辺部品・表示状態の確認が残る。部品台帳はすべてTODOで開始する。

販売者scopeの共通基盤と優先7画面・優先6画面、P3優先6画面を実装した。P4優先6画面も実装・補助検証した。認証後28画面の受け入れ環境と残り属性3画面は[QA_HANDOFF](../../testing/QA_HANDOFF.md#ds-p4-six-browser)に記録する。グローバル基盤と未対象の共有部品の移行は継続。[優先7画面の証跡](#優先7画面移行記録)。

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
| DS-PAGE-003 | `/order/[orderId]` | 本体適用・検証保留 | P1 | 保留 | [src/app/(fullscreen)/order/[orderId]/page.tsx](<../../../src/app/(fullscreen)/order/[orderId]/page.tsx>) | [checkout-order移行記録](#checkout-order移行記録) |
| DS-PAGE-004 | `/seller/apply` | 本体適用・検証保留 | P3 | 保留 | [src/app/(fullscreen)/seller/apply/page.tsx](<../../../src/app/(fullscreen)/seller/apply/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-005 | `/about` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/about/page.tsx](<../../../src/app/(store)/about/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-006 | `/browse` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/browse/page.tsx](<../../../src/app/(store)/browse/page.tsx>) | [購入導線6画面](#購入導線優先6画面移行記録)、補助/RTL済み、schema-current実route保留 |
| DS-PAGE-007 | `/cart` | 本体適用（2026-10-01移行） | P1 | 検証済み | [src/app/(store)/cart/page.tsx](<../../../src/app/(store)/cart/page.tsx>) | [cart移行記録](#cart移行記録) |
| DS-PAGE-008 | `/checkout` | 本体適用・検証保留 | P1 | 保留 | [src/app/(store)/checkout/page.tsx](<../../../src/app/(store)/checkout/page.tsx>) | [checkout-order移行記録](#checkout-order移行記録) |
| DS-PAGE-009 | `/compare` | 本体適用（2026-09-30移行） | P2 | 実装済み | [src/app/(store)/compare/page.tsx](<../../../src/app/(store)/compare/page.tsx>) | [compare実施記録](#compare移行記録) |
| DS-PAGE-010 | `/contact` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/contact/page.tsx](<../../../src/app/(store)/contact/page.tsx>) | [前セッションの確認](#前セッションの確認結果) |
| DS-PAGE-011 | `/customer-service` | 本体適用（2026-10-01移行） | P2 | 検証済み | [src/app/(store)/customer-service/page.tsx](<../../../src/app/(store)/customer-service/page.tsx>) | [customer-service移行記録](#customer-service移行記録) |
| DS-PAGE-012 | `/dispute` | 検証済み | P2 | 検証済み | [src/app/(store)/dispute/page.tsx](<../../../src/app/(store)/dispute/page.tsx>) | [P2実施記録](#p2優先5画面移行記録) |
| DS-PAGE-013 | `/faq` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/faq/page.tsx](<../../../src/app/(store)/faq/page.tsx>) | 未実施 |
| DS-PAGE-014 | `/faqs` | 本体適用（2026-09-30移行） | P3 | 検証済み | [src/app/(store)/faqs/page.tsx](<../../../src/app/(store)/faqs/page.tsx>) | [FAQs実施記録](#faqs移行記録) |
| DS-PAGE-015 | `/legal` | 検証済み | P3 | 検証済み | [src/app/(store)/legal/page.tsx](<../../../src/app/(store)/legal/page.tsx>) | [P3移行記録](#p3優先6画面移行記録) |
| DS-PAGE-016 | `/offers` | 検証済み | P2 | 検証済み | [src/app/(store)/offers/page.tsx](<../../../src/app/(store)/offers/page.tsx>) | [P2実施記録](#p2優先5画面移行記録) |
| DS-PAGE-017 | `/` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/page.tsx](<../../../src/app/(store)/page.tsx>) | [購入導線6画面](#購入導線優先6画面移行記録)、header/reduced-motion回帰済み、商品あり実route保留 |
| DS-PAGE-018 | `/product-support` | 本体適用（2026-10-01移行） | P3 | 検証済み | [src/app/(store)/product-support/page.tsx](<../../../src/app/(store)/product-support/page.tsx>) | [product-support移行記録](#product-support移行記録) |
| DS-PAGE-019 | `/product/[productSlug]/[variantSlug]` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx](<../../../src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx>) | [購入導線6画面](#購入導線優先6画面移行記録)、操作/ページング補助検証済み、実route保留 |
| DS-PAGE-020 | `/product/[productSlug]` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/product/[productSlug]/page.tsx](<../../../src/app/(store)/product/[productSlug]/page.tsx>) | 未実施 |
| DS-PAGE-021 | `/profile/addresses` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/addresses/page.tsx](<../../../src/app/(store)/profile/addresses/page.tsx>) | [addresses実施記録](#profile-addresses移行記録) |
| DS-PAGE-022 | `/profile/following/[page]` | 本体適用・検証保留 | P2 | 保留 | [src/app/(store)/profile/following/[page]/page.tsx](<../../../src/app/(store)/profile/following/[page]/page.tsx>) | [P2実施記録](#p2優先5画面移行記録) |
| DS-PAGE-023 | `/profile/following` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/following/page.tsx](<../../../src/app/(store)/profile/following/page.tsx>) | aliasのRTL回帰済み。認証後実ルートは[P2記録](#p2優先5画面移行記録)の保留を継続 |
| DS-PAGE-024 | `/profile/history/[page]` | 本体適用・検証保留 | P2 | 保留 | [src/app/(store)/profile/history/[page]/page.tsx](<../../../src/app/(store)/profile/history/[page]/page.tsx>) | [P2実施記録](#p2優先5画面移行記録) |
| DS-PAGE-025 | `/profile/history` | 転送専用 | 回帰検証 | TODO | [src/app/(store)/profile/history/page.tsx](<../../../src/app/(store)/profile/history/page.tsx>) | aliasのRTL回帰済み。認証後実ルートは[P2記録](#p2優先5画面移行記録)の保留を継続 |
| DS-PAGE-026 | `/profile/messages` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/messages/page.tsx](<../../../src/app/(store)/profile/messages/page.tsx>) | [messages実施記録](#profile-messages移行記録) |
| DS-PAGE-027 | `/profile/orders/[filter]` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/orders/[filter]/page.tsx](<../../../src/app/(store)/profile/orders/[filter]/page.tsx>) | [orders実施記録](#profile-orders移行記録) |
| DS-PAGE-028 | `/profile/orders` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/orders/page.tsx](<../../../src/app/(store)/profile/orders/page.tsx>) | [orders実施記録](#profile-orders移行記録) |
| DS-PAGE-029 | `/profile` | 本体適用（2026-09-30移行） | P2 | 検証済み | [src/app/(store)/profile/page.tsx](<../../../src/app/(store)/profile/page.tsx>) | [profile実施記録](#profile移行記録) |
| DS-PAGE-030 | `/profile/payment` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/payment/page.tsx](<../../../src/app/(store)/profile/payment/page.tsx>) | [payment実施記録](#profile-payment移行記録) |
| DS-PAGE-031 | `/profile/reviews` | 本体適用（2026-10-03移行） | P2 | 検証済み | [src/app/(store)/profile/reviews/page.tsx](<../../../src/app/(store)/profile/reviews/page.tsx>) | [reviews実施記録](#profile-reviews移行記録) |
| DS-PAGE-032 | `/profile/settings` | 本体適用・検証保留 | P2 | 保留 | [src/app/(store)/profile/settings/page.tsx](<../../../src/app/(store)/profile/settings/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-033 | `/profile/wishlist/[page]` | 本体適用（2026-09-30移行） | P2 | 検証済み | [src/app/(store)/profile/wishlist/[page]/page.tsx](<../../../src/app/(store)/profile/wishlist/[page]/page.tsx>) | [wishlist実施記録](#wishlist移行記録) |
| DS-PAGE-034 | `/profile/wishlist` | 転送専用 | 回帰検証 | 検証済み | [src/app/(store)/profile/wishlist/page.tsx](<../../../src/app/(store)/profile/wishlist/page.tsx>) | [wishlist実施記録](#wishlist移行記録) |
| DS-PAGE-035 | `/report-problem` | 検証済み | P2 | 検証済み | [src/app/(store)/report-problem/page.tsx](<../../../src/app/(store)/report-problem/page.tsx>) | [P2実施記録](#p2優先5画面移行記録) |
| DS-PAGE-036 | `/returns-exchange` | 本体適用（2026-10-01移行） | P2 | 検証済み | [src/app/(store)/returns-exchange/page.tsx](<../../../src/app/(store)/returns-exchange/page.tsx>) | [returns-exchange移行記録](#returns-exchange移行記録) |
| DS-PAGE-037 | `/store/[storeUrl]` | 本体適用・周辺確認 | 周辺部品を監査 | 実装済み | [src/app/(store)/store/[storeUrl]/page.tsx](<../../../src/app/(store)/store/[storeUrl]/page.tsx>) | [購入導線6画面](#購入導線優先6画面移行記録)、長文/空/商品あり補助検証済み、実route保留 |
| DS-PAGE-038 | `/track-order` | 本体適用（2026-10-01移行） | P2 | 検証済み | [src/app/(store)/track-order/page.tsx](<../../../src/app/(store)/track-order/page.tsx>) | [track-order移行記録](#track-order移行記録) |
| DS-PAGE-039 | `/dashboard/admin/attributes/[id]/options` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/attributes/[id]/options/page.tsx](<../../../src/app/dashboard/admin/attributes/[id]/options/page.tsx>) | 実装・補助検証済み、認証後保留。[証跡](#監査指摘6画面移行記録) |
| DS-PAGE-040 | `/dashboard/admin/attributes/new` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/attributes/new/page.tsx](<../../../src/app/dashboard/admin/attributes/new/page.tsx>) | 実装・補助検証済み、認証後保留。[証跡](#監査指摘6画面移行記録) |
| DS-PAGE-041 | `/dashboard/admin/attributes` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/attributes/page.tsx](<../../../src/app/dashboard/admin/attributes/page.tsx>) | 実装・補助検証済み、認証後受け入れ保留。[証跡](#監査指摘6画面移行記録) |
| DS-PAGE-042 | `/dashboard/admin/categories/new` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/categories/new/page.tsx](<../../../src/app/dashboard/admin/categories/new/page.tsx>) | [P4証跡](#p4優先6画面移行記録) |
| DS-PAGE-043 | `/dashboard/admin/categories` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/categories/page.tsx](<../../../src/app/dashboard/admin/categories/page.tsx>) | [P4証跡](#p4優先6画面移行記録) |
| DS-PAGE-044 | `/dashboard/admin/coupons/new` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/coupons/new/page.tsx](<../../../src/app/dashboard/admin/coupons/new/page.tsx>) | [P4証跡](#p4優先6画面移行記録) |
| DS-PAGE-045 | `/dashboard/admin/coupons` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/coupons/page.tsx](<../../../src/app/dashboard/admin/coupons/page.tsx>) | [P4証跡](#p4優先6画面移行記録) |
| DS-PAGE-046 | `/dashboard/admin/offer-tags/new` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/offer-tags/new/page.tsx](<../../../src/app/dashboard/admin/offer-tags/new/page.tsx>) | [P4証跡](#p4優先6画面移行記録) |
| DS-PAGE-047 | `/dashboard/admin/offer-tags` | 本体適用・検証保留 | P4 | 保留 | [src/app/dashboard/admin/offer-tags/page.tsx](<../../../src/app/dashboard/admin/offer-tags/page.tsx>) | [P4証跡](#p4優先6画面移行記録) |
| DS-PAGE-048 | `/dashboard/admin/orders` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/admin/orders/page.tsx](<../../../src/app/dashboard/admin/orders/page.tsx>) | [P3移行記録](#p3優先6画面移行記録) |
| DS-PAGE-049 | `/dashboard/admin` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/admin/page.tsx](<../../../src/app/dashboard/admin/page.tsx>) | [P3移行記録](#p3優先6画面移行記録) |
| DS-PAGE-050 | `/dashboard/admin/stores` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/admin/stores/page.tsx](<../../../src/app/dashboard/admin/stores/page.tsx>) | [P3移行記録](#p3優先6画面移行記録) |
| DS-PAGE-051 | `/dashboard` | 転送専用 | 回帰検証 | TODO | [src/app/dashboard/page.tsx](<../../../src/app/dashboard/page.tsx>) | 未実施 |
| DS-PAGE-052 | `/dashboard/seller` | 転送専用 | 回帰検証 | TODO | [src/app/dashboard/seller/page.tsx](<../../../src/app/dashboard/seller/page.tsx>) | 未実施 |
| DS-PAGE-053 | `/dashboard/seller/stores/[storeUrl]/coupons/new` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/coupons/new/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/new/page.tsx>) | [P3移行記録](#p3優先6画面移行記録) |
| DS-PAGE-054 | `/dashboard/seller/stores/[storeUrl]/coupons` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/coupons/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/page.tsx>) | [P3移行記録](#p3優先6画面移行記録) |
| DS-PAGE-055 | `/dashboard/seller/stores/[storeUrl]/inventory` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-056 | `/dashboard/seller/stores/[storeUrl]/messages` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-057 | `/dashboard/seller/stores/[storeUrl]/orders` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-058 | `/dashboard/seller/stores/[storeUrl]` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-059 | `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page.tsx>) | [優先6画面移行記録](#優先6画面移行記録) |
| DS-PAGE-060 | `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page.tsx>) | [優先6画面移行記録](#優先6画面移行記録) |
| DS-PAGE-061 | `/dashboard/seller/stores/[storeUrl]/products/new` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/products/new/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/new/page.tsx>) | [優先6画面移行記録](#優先6画面移行記録) |
| DS-PAGE-062 | `/dashboard/seller/stores/[storeUrl]/products` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/products/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/page.tsx>) | [優先7画面移行記録](#優先7画面移行記録) |
| DS-PAGE-063 | `/dashboard/seller/stores/[storeUrl]/settings` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/settings/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/settings/page.tsx>) | [優先6画面移行記録](#優先6画面移行記録) |
| DS-PAGE-064 | `/dashboard/seller/stores/[storeUrl]/shipping` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/[storeUrl]/shipping/page.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/shipping/page.tsx>) | [優先6画面移行記録](#優先6画面移行記録) |
| DS-PAGE-065 | `/dashboard/seller/stores/new` | 本体適用・検証保留 | P3 | 保留 | [src/app/dashboard/seller/stores/new/page.tsx](<../../../src/app/dashboard/seller/stores/new/page.tsx>) | [優先6画面移行記録](#優先6画面移行記録) |
| DS-PAGE-066 | `/dashboard/seller/stores` | 仮実装 | P3・機能課題別枠 | TODO | [src/app/dashboard/seller/stores/page.tsx](<../../../src/app/dashboard/seller/stores/page.tsx>) | 未実施 |
| DS-PAGE-067 | `/profile/notifications` | 本体適用（2026-10-07新規・plan 086） | P2 | 実装済み | [src/app/(store)/profile/notifications/page.tsx](<../../../src/app/(store)/profile/notifications/page.tsx>) | [通知一覧の実施記録](#通知一覧の新設2026-10-07plan-086未コミット)。部品は fixture で検証済み、Clerk 認証後の実ルートは未確認。P2表示追加は[残存6画面](#p2残存6画面移行記録)、認証後実ルート保留 |

## 部品台帳

元計画のファイル単位の200項目を登録。呼び出し元・表示状態・Portalを確認する。P3/P4は着手計画で対象業務に応じて確定する。

| ID | 優先度 | グループ | 対象 | 状態 | 証跡・次の作業 |
|---|---|---|---|---|---|
| DS-COMP-001 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/user-menu/user-menu.tsx](<../../../src/components/store/layout/header/user-menu/user-menu.tsx>) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)。store表示の補助検証済み、最終確認中 |
| DS-COMP-002 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/search/search.tsx](<../../../src/components/store/layout/header/search/search.tsx>) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)。store表示の補助検証済み、最終確認中 |
| DS-COMP-003 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/search/suggestions.tsx](<../../../src/components/store/layout/header/search/suggestions.tsx>) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)。store表示の補助検証済み、最終確認中 |
| DS-COMP-004 | P1 | ヘッダー展開部品（P1） | [src/components/store/layout/header/country-lang-curr-selector.tsx](<../../../src/components/store/layout/header/country-lang-curr-selector.tsx>) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)。store表示の補助検証済み、最終確認中 |
| DS-COMP-005 | P1 | ヘッダー展開部品（P1） | [src/components/shared/country-selector.tsx](<../../../src/components/shared/country-selector.tsx>) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)。store表示の補助検証済み、最終確認中 |
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
| DS-COMP-020 | P1 | モーダル・配送先（P1） | [src/components/store/shared/shipping-addresses/shipping-addresses.tsx](<../../../src/components/store/shared/shipping-addresses/shipping-addresses.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-021 | P1 | モーダル・配送先（P1） | [src/components/store/shared/shipping-addresses/address-details.tsx](<../../../src/components/store/shared/shipping-addresses/address-details.tsx>) | TODO | 未実施 |
| DS-COMP-022 | P1 | モーダル・配送先（P1） | [src/components/ui/dialog.tsx](<../../../src/components/ui/dialog.tsx>) | TODO | pending時closeDisabledを追加しseller配送で補助検証。グローバル基盤は未移行。[優先6画面](#優先6画面移行記録) |
| DS-COMP-023 | P1 | モーダル・配送先（P1） | [src/components/ui/alert-dialog.tsx](<../../../src/components/ui/alert-dialog.tsx>) | TODO | 未実施 |
| DS-COMP-024 | P1 | モーダル・配送先（P1） | [src/components/ui/drawer.tsx](<../../../src/components/ui/drawer.tsx>) | TODO | 未実施 |
| DS-COMP-025 | P1 | モーダル・配送先（P1） | [src/components/ui/sheet.tsx](<../../../src/components/ui/sheet.tsx>) | TODO | 未実施 |
| DS-COMP-026 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/container.tsx](<../../../src/components/store/cart-page/container.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-027 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/cart-header.tsx](<../../../src/components/store/cart-page/cart-header.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-028 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/summary.tsx](<../../../src/components/store/cart-page/summary.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-029 | P1 | カート・購入手続き（P1） | [src/components/store/cart-page/empty-cart.tsx](<../../../src/components/store/cart-page/empty-cart.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-030 | P1 | カート・購入手続き（P1） | [src/components/store/cards/cart-product.tsx](<../../../src/components/store/cards/cart-product.tsx>) | 検証済み | [cart移行記録](#cart移行記録) |
| DS-COMP-031 | P1 | カート・購入手続き（P1） | [src/components/store/checkout-page/container.tsx](<../../../src/components/store/checkout-page/container.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-032 | P1 | カート・購入手続き（P1） | [src/components/store/cards/checkout-product.tsx](<../../../src/components/store/cards/checkout-product.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-033 | P1 | カート・購入手続き（P1） | [src/components/store/cards/place-order.tsx](<../../../src/components/store/cards/place-order.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-034 | P1 | カート・購入手続き（P1） | [src/components/store/forms/apply-coupon.tsx](<../../../src/components/store/forms/apply-coupon.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-035 | P1 | カート・購入手続き（P1） | [src/components/store/cards/fast-delivery.tsx](<../../../src/components/store/cards/fast-delivery.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-036 | P1 | カート・購入手続き（P1） | [src/components/store/product-page/returns-security-privacy-card.tsx](<../../../src/components/store/product-page/returns-security-privacy-card.tsx>) | 保留 | 実装あり・[実施記録](#checkout-order移行記録)（036はcheckout opt-inのみ） |
| DS-COMP-037 | P1 | カート・購入手続き（P1） | [src/components/store/shared/country-note.tsx](<../../../src/components/store/shared/country-note.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-038 | P1 | 注文・支払い（P1） | [src/components/store/order-page/header.tsx](<../../../src/components/store/order-page/header.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-039 | P1 | 注文・支払い（P1） | [src/components/store/order-page/groups-container.tsx](<../../../src/components/store/order-page/groups-container.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-040 | P1 | 注文・支払い（P1） | [src/components/store/order-page/group-table.tsx](<../../../src/components/store/order-page/group-table.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-041 | P1 | 注文・支払い（P1） | [src/components/store/order-page/product-row.tsx](<../../../src/components/store/order-page/product-row.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-042 | P1 | 注文・支払い（P1） | [src/components/store/order-page/payment.tsx](<../../../src/components/store/order-page/payment.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-043 | P1 | 注文・支払い（P1） | [src/components/store/cards/order/info.tsx](<../../../src/components/store/cards/order/info.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-044 | P1 | 注文・支払い（P1） | [src/components/store/cards/order/total.tsx](<../../../src/components/store/cards/order/total.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-045 | P1 | 注文・支払い（P1） | [src/components/store/cards/order/user.tsx](<../../../src/components/store/cards/order/user.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-046 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/stripe/stripe-wrapper.tsx](<../../../src/components/store/cards/payment/stripe/stripe-wrapper.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-047 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/stripe/stripe-payment.tsx](<../../../src/components/store/cards/payment/stripe/stripe-payment.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-048 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/paypal/paypal-wrapper.tsx](<../../../src/components/store/cards/payment/paypal/paypal-wrapper.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-049 | P1 | 注文・支払い（P1） | [src/components/store/cards/payment/paypal/paypal-payment.tsx](<../../../src/components/store/cards/payment/paypal/paypal-payment.tsx>) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-050 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/product/product-card.tsx](<../../../src/components/store/cards/product/product-card.tsx>) | TODO | 未実施 |
| DS-COMP-051 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/product/swiper.tsx](<../../../src/components/store/cards/product/swiper.tsx>) | TODO | 未実施 |
| DS-COMP-052 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/product/variant-switcher.tsx](<../../../src/components/store/cards/product/variant-switcher.tsx>) | TODO | 未実施 |
| DS-COMP-053 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/product-page/product-info/product-price.tsx](<../../../src/components/store/product-page/product-info/product-price.tsx>) | TODO | 未実施 |
| DS-COMP-054 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/cards/store-card.tsx](<../../../src/components/store/cards/store-card.tsx>) | TODO | 未実施 |
| DS-COMP-055 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/shared/product-list.tsx](<../../../src/components/store/shared/product-list.tsx>) | TODO | 未実施 |
| DS-COMP-056 | P2 | 商品・店舗カードと一覧（P2） | [src/components/store/compare/compare-grid.tsx](<../../../src/components/store/compare/compare-grid.tsx>) | 実装済み | [compare実施記録](#compare移行記録) |
| DS-COMP-057 | P2 | ページング・フィルター（P2） | [src/components/store/shared/pagination.tsx](<../../../src/components/store/shared/pagination.tsx>) | 実装済み | product review opt-inのみ。[購入導線6画面](#購入導線優先6画面移行記録)。他callerは未移行 |
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
| DS-COMP-086 | P2 | マイページ（P2） | [src/components/store/profile/following/container.tsx](<../../../src/components/store/profile/following/container.tsx>) | 保留 | 実装あり・[P2実施記録](#p2優先5画面移行記録) |
| DS-COMP-087 | P2 | マイページ（P2） | [src/components/store/profile/reviews/reviews-container.tsx](<../../../src/components/store/profile/reviews/reviews-container.tsx>) | 検証済み | [reviews実施記録](#profile-reviews移行記録) |
| DS-COMP-088 | P2 | マイページ（P2） | [src/components/store/profile/reviews/reviews-header.tsx](<../../../src/components/store/profile/reviews/reviews-header.tsx>) | 検証済み | [reviews実施記録](#profile-reviews移行記録) |
| DS-COMP-089 | P2 | メッセージ共用部品（P2） | [src/components/shared/messages/messages-layout.tsx](<../../../src/components/shared/messages/messages-layout.tsx>) | TODO | 未実施 |
| DS-COMP-090 | P2 | メッセージ共用部品（P2） | [src/components/store/profile/messages/messages-container.tsx](<../../../src/components/store/profile/messages/messages-container.tsx>) | 検証済み | [messages実施記録](#profile-messages移行記録) |
| DS-COMP-091 | P2 | メッセージ共用部品（P2） | [src/components/store/profile/messages/conversation-thread.tsx](<../../../src/components/store/profile/messages/conversation-thread.tsx>) | TODO | 未実施 |
| DS-COMP-092 | P2 | メッセージ共用部品（P2） | [src/components/dashboard/seller/seller-messages-container.tsx](<../../../src/components/dashboard/seller/seller-messages-container.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
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
| DS-COMP-113 | P3 | 出店申請（P3） | [src/components/store/layout/minimal-header/header.tsx](<../../../src/components/store/layout/minimal-header/header.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-114 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/apply-seller.tsx](<../../../src/components/store/forms/apply-seller/apply-seller.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-115 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/progress-bar.tsx](<../../../src/components/store/forms/apply-seller/progress-bar.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-116 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/instructions.tsx](<../../../src/components/store/forms/apply-seller/instructions.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-117 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/animated-container.tsx](<../../../src/components/store/forms/apply-seller/animated-container.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-118 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-1/step-1.tsx](<../../../src/components/store/forms/apply-seller/steps/step-1/step-1.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-119 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-1/user-details.tsx](<../../../src/components/store/forms/apply-seller/steps/step-1/user-details.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-120 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-2/step-2.tsx](<../../../src/components/store/forms/apply-seller/steps/step-2/step-2.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-121 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-3/step-3.tsx](<../../../src/components/store/forms/apply-seller/steps/step-3/step-3.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-122 | P3 | 出店申請（P3） | [src/components/store/forms/apply-seller/steps/step-4/step-4.tsx](<../../../src/components/store/forms/apply-seller/steps/step-4/step-4.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-123 | P3 | 静的コンテンツ（P3） | [src/components/store/static/static-page-layout.tsx](<../../../src/components/store/static/static-page-layout.tsx>) | TODO | 未実施 |
| DS-COMP-124 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/header/Header.tsx](<../../../src/components/dashboard/header/Header.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 ／[P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-125 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/sidebar.tsx](<../../../src/components/dashboard/sidebar/sidebar.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 ／[P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-126 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/nav-admin.tsx](<../../../src/components/dashboard/sidebar/nav-admin.tsx>) | 保留 | [P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-127 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/nav-seller.tsx](<../../../src/components/dashboard/sidebar/nav-seller.tsx>) | TODO | 未実施 |
| DS-COMP-128 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/store-switcher.tsx](<../../../src/components/dashboard/sidebar/store-switcher.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-129 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/sidebar/user-info.tsx](<../../../src/components/dashboard/sidebar/user-info.tsx>) | 保留 | [P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-130 | P3 | ダッシュボード共通（P3） | [src/components/shared/theme-toggle.tsx](<../../../src/components/shared/theme-toggle.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 ／[P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-131 | P3 | ダッシュボード共通（P3） | [src/components/ui/data-table.tsx](<../../../src/components/ui/data-table.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)／[優先6画面](#優先6画面移行記録)（空表のkeyboard access）。他scopeは未完了 ／[P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-132 | P3 | ダッシュボード共通（P3） | [src/components/ui/table.tsx](<../../../src/components/ui/table.tsx>) | 保留 | sellerの任意scrollLabelで名前付きfocusable領域、補助検証済み・他scope/認証後は保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-133 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/shared/custom-modal.tsx](<../../../src/components/dashboard/shared/custom-modal.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)／[優先6画面証跡](#優先6画面移行記録)。他scopeは未完了 |
| DS-COMP-134 | P3 | ダッシュボード共通（P3） | [src/components/dashboard/shared/order-table-cells.tsx](<../../../src/components/dashboard/shared/order-table-cells.tsx>) | TODO | 未実施 |
| DS-COMP-135 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/stats-cards.tsx](<../../../src/components/dashboard/admin/stats-cards.tsx>) | 保留 | [P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-136 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/sales-chart.tsx](<../../../src/components/dashboard/admin/sales-chart.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 ／[P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-137 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/recent-orders.tsx](<../../../src/components/dashboard/admin/recent-orders.tsx>) | 保留 | [P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-138 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/admin/recent-stores.tsx](<../../../src/components/dashboard/admin/recent-stores.tsx>) | 保留 | [P3優先6画面](#p3優先6画面移行記録)：管理者opt-in補助検証済み、認証後実ルート・Clerk保留。旧scopeを完了扱いしない |
| DS-COMP-139 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/store-stats-cards.tsx](<../../../src/components/dashboard/seller/store-stats-cards.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-140 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/store-recent-orders.tsx](<../../../src/components/dashboard/seller/store-recent-orders.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-141 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/store-top-products.tsx](<../../../src/components/dashboard/seller/store-top-products.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-142 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/inventory-alert-summary.tsx](<../../../src/components/dashboard/seller/inventory-alert-summary.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-143 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/low-stock-threshold-form.tsx](<../../../src/components/dashboard/seller/low-stock-threshold-form.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-144 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/inventory-quantity-cell.tsx](<../../../src/components/dashboard/seller/inventory-quantity-cell.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-145 | P3 | 業務概要・在庫操作（P3） | [src/components/dashboard/seller/stock-status-badge.tsx](<../../../src/components/dashboard/seller/stock-status-badge.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)。他scopeは未完了 |
| DS-COMP-146 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/store-details.tsx](<../../../src/components/dashboard/forms/store-details.tsx>) | 保留 | 設定/作成scope補助検証済み・実ルート保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-147 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/product-details.tsx](<../../../src/components/dashboard/forms/product-details.tsx>) | 保留 | 販売者/申請scope本体適用・[優先7画面証跡](#優先7画面移行記録)／[優先6画面証跡](#優先6画面移行記録)。他scopeは未完了 |
| DS-COMP-148 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/store-default-shipping-details.tsx](<../../../src/components/dashboard/forms/store-default-shipping-details.tsx>) | 保留 | seller本体適用・補助検証済み・実ルート保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-149 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/shippingRate-details.tsx](<../../../src/components/dashboard/forms/shippingRate-details.tsx>) | 保留 | seller本体適用・補助検証済み・実ルート保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-150 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/coupon-details.tsx](<../../../src/components/dashboard/forms/coupon-details.tsx>) | TODO | 未実施 |
| DS-COMP-151 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/coupon-form-fields.tsx](<../../../src/components/dashboard/forms/coupon-form-fields.tsx>) | 保留 | seller/admin opt-inのnative fieldsは補助検証済み。既定SDK/認証後は保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-152 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/order-status-select.tsx](<../../../src/components/dashboard/forms/order-status-select.tsx>) | TODO | 未実施 |
| DS-COMP-153 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/product-status-select.tsx](<../../../src/components/dashboard/forms/product-status-select.tsx>) | TODO | 未実施 |
| DS-COMP-154 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/store-status-select.tsx](<../../../src/components/dashboard/forms/store-status-select.tsx>) | TODO | 未実施 |
| DS-COMP-155 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/category-details.tsx](<../../../src/components/dashboard/forms/category-details.tsx>) | TODO | P4の6実ルートからは未使用。旧部品は利用監査対象、全scope移行済みとしない。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-156 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/attribute-details.tsx](<../../../src/components/dashboard/forms/attribute-details.tsx>) | 保留 | 実装・補助検証済み、認証後受け入れ保留。[証跡](#監査指摘6画面移行記録) |
| DS-COMP-157 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/attribute-option-details.tsx](<../../../src/components/dashboard/forms/attribute-option-details.tsx>) | 保留 | 実装・補助検証済み、認証後受け入れ保留。[証跡](#監査指摘6画面移行記録) |
| DS-COMP-158 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/attribute-fields.tsx](<../../../src/components/dashboard/forms/attribute-fields.tsx>) | TODO | 未実施 |
| DS-COMP-159 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/offer-tag-details.tsx](<../../../src/components/dashboard/forms/offer-tag-details.tsx>) | TODO | P4の6実ルートからは未使用。旧部品は利用監査対象、全scope移行済みとしない。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-160 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/admin-coupon-details.tsx](<../../../src/components/dashboard/forms/admin-coupon-details.tsx>) | TODO | P4の6実ルートからは未使用。旧部品は利用監査対象、全scope移行済みとしない。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-161 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/forms/click-to-add.tsx](<../../../src/components/dashboard/forms/click-to-add.tsx>) | 保留 | seller opt-in補助検証済み・他scope未完了。[優先6画面](#優先6画面移行記録) |
| DS-COMP-162 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/input-fieldset.tsx](<../../../src/components/dashboard/shared/input-fieldset.tsx>) | TODO | 未実施 |
| DS-COMP-163 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/image-upload.tsx](<../../../src/components/dashboard/shared/image-upload.tsx>) | TODO | 未実施 |
| DS-COMP-164 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/images-preview-grid.tsx](<../../../src/components/dashboard/shared/images-preview-grid.tsx>) | 保留 | seller opt-in: 画像名・キーボード削除対応、補助検証済み・実SDK/他scope保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-165 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/color-palette.tsx](<../../../src/components/dashboard/shared/color-palette.tsx>) | TODO | 未実施 |
| DS-COMP-166 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/store-summary.tsx](<../../../src/components/dashboard/shared/store-summary.tsx>) | TODO | 未実施 |
| DS-COMP-167 | P3/P4 | 業務フォーム・編集部品（P3/P4） | [src/components/dashboard/shared/store-order-summary.tsx](<../../../src/components/dashboard/shared/store-order-summary.tsx>) | TODO | 未実施 |
| DS-COMP-168 | P4 | 印刷（P4） | [src/components/store/order-page/pdf-invoice.tsx](<../../../src/components/store/order-page/pdf-invoice.tsx>) | TODO | 未実施 |
| DS-COMP-169 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/attributes/[id]/options/columns.tsx](<../../../src/app/dashboard/admin/attributes/[id]/options/columns.tsx>) | 保留 | 実装・補助検証済み、認証後受け入れ保留。[証跡](#監査指摘6画面移行記録) |
| DS-COMP-170 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/attributes/columns.tsx](<../../../src/app/dashboard/admin/attributes/columns.tsx>) | 保留 | 実装・補助検証済み、認証後受け入れ保留。[証跡](#監査指摘6画面移行記録) |
| DS-COMP-171 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/categories/columns.tsx](<../../../src/app/dashboard/admin/categories/columns.tsx>) | TODO | P4の6実ルートからは未使用。旧部品は利用監査対象、全scope移行済みとしない。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-172 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/coupons/columns.tsx](<../../../src/app/dashboard/admin/coupons/columns.tsx>) | TODO | P4の6実ルートからは未使用。旧部品は利用監査対象、全scope移行済みとしない。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-173 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/offer-tags/columns.tsx](<../../../src/app/dashboard/admin/offer-tags/columns.tsx>) | TODO | P4の6実ルートからは未使用。旧部品は利用監査対象、全scope移行済みとしない。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-174 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/orders/columns.tsx](<../../../src/app/dashboard/admin/orders/columns.tsx>) | TODO | 未実施 |
| DS-COMP-175 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/admin/stores/columns.tsx](<../../../src/app/dashboard/admin/stores/columns.tsx>) | TODO | 未実施 |
| DS-COMP-176 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx>) | TODO | 未実施 |
| DS-COMP-177 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx>) | TODO | 未実施 |
| DS-COMP-178 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx>) | TODO | 未実施 |
| DS-COMP-179 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/products/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/products/columns.tsx>) | TODO | 未実施 |
| DS-COMP-180 | P3/P4 | データテーブルの画面別列・操作（P3/P4） | [src/app/dashboard/seller/stores/[storeUrl]/shipping/columns.tsx](<../../../src/app/dashboard/seller/stores/[storeUrl]/shipping/columns.tsx>) | 保留 | seller本体適用・補助検証済み・実ルート保留。[優先6画面](#優先6画面移行記録) |
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
| DS-COMP-204 | P1 | 購入導線の共通表示 | [src/components/store/shared/commerce.module.css](../../../src/components/store/shared/commerce.module.css) | 保留 | 実装あり・[checkout-order移行記録](#checkout-order移行記録) |
| DS-COMP-205 | P2 | 公開opt-in共通表示 | [DesignPage](../../../src/components/store/shared/design-page/design-page.tsx)・専用CSS | 検証済み | [P2実施記録](#p2優先5画面移行記録) |
| DS-COMP-206 | P2 | account共通表示・ページング | [Discovery](../../../src/components/store/profile/shared/discovery.tsx)・専用CSS | 保留 | 補助検証済み・[P2実施記録](#p2優先5画面移行記録) |
| DS-COMP-207 | P2 | 閲覧履歴 | [HistoryContainer](../../../src/components/store/profile/history/container.tsx) | 保留 | 補助検証済み・[P2実施記録](#p2優先5画面移行記録) |

| DS-COMP-208 | P2/P3 | 販売者テーマ・業務枠 | [SellerShell](../../../src/components/dashboard/design/seller-shell.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-209 | P2/P3 | 設定SDK appearance | [設定appearance](../../../src/components/store/profile/settings/appearance.ts) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-210 | P2/P3 | 申請専用表示 | [申請CSS](../../../src/components/store/forms/apply-seller/application.module.css) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-211 | P2/P3 | 販売者見出し・loading/error | [SellerPage](../../../src/components/dashboard/design/seller-page.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-212 | P2/P3 | 店舗概要表示 | [StoreOverview](../../../src/components/dashboard/seller/store-overview.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-213 | P2/P3 | 販売者商品一覧・列factory | [SellerProducts](../../../src/components/dashboard/seller/seller-products.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-214 | P2/P3 | 在庫一覧・数量編集 | [SellerInventory/StockNumberEditor](../../../src/components/dashboard/seller/seller-inventory.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-215 | P2/P3 | 注文一覧・詳細・状態編集 | [SellerOrders/Summary/StatusEditor](../../../src/components/dashboard/seller/seller-orders.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-216 | P2/P3 | 販売者スレッドopt-in | [ProfileConversationThread seller opt-in](../../../src/components/store/profile/messages/profile-conversation-thread.tsx) | 保留 | 本体適用・補助検証済み・[優先7画面証跡](#優先7画面移行記録) |
| DS-COMP-217 | P3 | 配送設定共通表示 | [SellerShipping](../../../src/components/dashboard/seller/seller-shipping.tsx) | 保留 | 補助検証済み・実ルート保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-218 | P3 | 配送フォーム共通入力 | [ShippingFields](../../../src/components/dashboard/forms/shipping-fields.tsx) | 保留 | 既定/国別の入力を共通化。補助検証済み・認証後実ルート保留。[優先6画面](#優先6画面移行記録) |
| DS-COMP-219 | P3 | 取得失敗・再試行 | [LoadError](../../../src/components/dashboard/design/load-error.tsx) | 保留 | 補助検証済み・認証後保留。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-220 | P3 | 管理者注文・詳細・列factory | [AdminOrders](../../../src/components/dashboard/admin/admin-orders.tsx) | 保留 | 補助検証済み・実ルート保留。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-221 | P3 | 管理者店舗・配送詳細・列factory | [AdminStores](../../../src/components/dashboard/admin/admin-stores.tsx) | 保留 | 補助検証済み・認証後保留。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-222 | P3 | 削除確認・pending lock | [ConfirmDelete](../../../src/components/dashboard/design/confirm-delete.tsx) | 保留 | モックAction検証済み・実ルート保留。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-223 | P3 | クーポン一覧・列factory・編集再取得 | [SellerCoupons](../../../src/components/dashboard/seller/seller-coupons.tsx) | 保留 | 補助検証済み・認証後保留。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-224 | P3 | seller専用クーポンフォーム | [SellerCouponForm](../../../src/components/dashboard/seller/seller-coupon-form.tsx) | 保留 | 補助検証済み・認証後保留。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-225 | P3 | Legal本文・目次スタイル | [Legal CSS](<../../../src/app/(store)/legal/legal.module.css>) | 検証済み | 公開実ルート3幅・axe/目次検証。[P3証跡](#p3優先6画面移行記録) |
| DS-COMP-226 | P4 | カテゴリ一覧・列factory | [admin-categories.tsx](../../../src/components/dashboard/admin/admin-categories.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-227 | P4 | カテゴリ専用フォーム | [category-form.tsx](../../../src/components/dashboard/admin/category-form.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-228 | P4 | 管理者クーポン一覧・toggle・列factory | [admin-coupons.tsx](../../../src/components/dashboard/admin/admin-coupons.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-229 | P4 | 管理者専用クーポンフォーム | [coupon-form.tsx](../../../src/components/dashboard/admin/coupon-form.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-230 | P4 | オファータグ一覧・列factory | [admin-offer-tags.tsx](../../../src/components/dashboard/admin/admin-offer-tags.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-231 | P4 | オファータグ専用フォーム | [offer-tag-form.tsx](../../../src/components/dashboard/admin/offer-tag-form.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-232 | P4 | 取得失敗・stale対策・編集/作成dialog | [master-dialog.tsx](../../../src/components/dashboard/admin/master-dialog.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |
| DS-COMP-233 | P4 | 同期pending guard・状態通知 | [save-state.tsx](../../../src/components/dashboard/admin/save-state.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[P4証跡](#p4優先6画面移行記録) |

| DS-COMP-234 | P1 | Store header frame | [header-frame.tsx](../../../src/components/store/layout/header/header-frame.tsx) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)、公開/補助検証済み、商品あり実route保留 |
| DS-COMP-235 | P1 | Account menu presentation | [account-menu.tsx](../../../src/components/store/layout/header/user-menu/account-menu.tsx) | 保留 | 実装あり、signed補助検証済み、実Clerk受け入れ保留 |
| DS-COMP-236 | P1 | Store panel tokens/styles | [panels.module.css](../../../src/components/store/layout/header/panels.module.css) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)、補助axe済み |
| DS-COMP-237 | P1 | Country picker styles | [country-selector.module.css](../../../src/components/shared/country-selector.module.css) | 実装済み | [購入導線優先6画面](#購入導線優先6画面移行記録)、store opt-in補助検証済み |

| DS-COMP-238 | P2 | Review pagination styles | [pagination.module.css](../../../src/components/store/shared/pagination.module.css) | 実装済み | product review opt-inの補助検証済み、実route保留 |
| DS-COMP-239 | P2 | 通知一覧 | [notification-list.tsx](../../../src/components/store/profile/notifications/notification-list.tsx) | 検証済み | [通知一覧の実施記録](#通知一覧の新設2026-10-07plan-086未コミット)。P2表示追加は[残存6画面](#p2残存6画面移行記録)、認証後実ルート保留 |
| DS-COMP-240 | P2 | ヘッダーの未読バッジ・通知リンク | [account-menu.tsx](../../../src/components/store/layout/header/user-menu/account-menu.tsx) | 実装済み | RTL のみ。ブラウザー表示は認証後ヘッダーの fixture が無く未確認 |
| DS-COMP-241 | P1 | 購入theme tokens | [purchase-theme.module.css](../../../src/components/store/shared/purchase-theme.module.css) | 保留 | store限定・補助検証済み、認証後実ルート保留。[残存6画面](#購入導線残存部品6画面移行記録) |
| DS-COMP-242 | P1 | store状態タグCSS | [store-status.module.css](../../../src/components/shared/store-status.module.css) | 保留 | 34状態/明暗祖先/3幅/AA補助検証済み、認証後order実ルート保留。[残存6画面](#購入導線残存部品6画面移行記録) |
| DS-COMP-243 | P4 | 属性一覧Client境界 | [AdminAttributes](../../../src/components/dashboard/admin/admin-attributes.tsx) | 保留 | 補助検証済み・認証後受け入れ保留。[証跡](#監査指摘6画面移行記録) |
| DS-COMP-244 | P4 | 属性操作scope | [attribute CSS](../../../src/components/dashboard/admin/attribute.module.css) | 保留 | 補助検証済み・認証後保留。[証跡](#監査指摘6画面移行記録) |
| DS-COMP-245 | P4 | 属性選択肢Client境界 | [AdminAttributeOptions](../../../src/components/dashboard/admin/admin-attribute-options.tsx) | 保留 | 補助検証済み・認証後保留。[証跡](#監査指摘6画面移行記録) |

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
- 残課題／保留: フィルタ見出し（DS-COMP-059 `filters/header.tsx`）の選択中チップが `attr.*` の生の値（例: `silk`）を表示し、属性名と値ラベルを出さない。「Filter (n)」の件数への算入とチップの × による値単位の解除は 2026-10-04 に対応済み（`225e8d76`）。ラベル表示は QA_HANDOFF の FS-CHIPS で追跡する。
- 変更記録: 未コミット

<a id="checkout-order移行記録"></a>

## Checkout・注文詳細移行記録

- 2026-10-04。DS-PAGE-008／003、DS-COMP-020／031〜049、追加DS-COMP-204。未コミット。[保存計画](../../../plans/layout-design/checkout-order-design-system-plan.md)、[Checkout要件](../checkout/requirements.md)／[設計](../checkout/design.md)、[注文要件](../order-detail/requirements.md)／[設計](../order-detail/design.md)。
- 状態: **保留（両画面の実装あり）**。承認済みの専用テストDB方式に対し、ローカルDockerに稼働／停止中の専用DBがなく、`.env`は非local・非test、`.env.docker`はlocal開発DB。DB名／用途が確認できない接続先には書き込まず、ルール上のseed／DB初期化も実行しなかった。解除条件: 専用DBとアプリ接続先が一致し既存schemaを利用できる環境で、認証後fixtureの作成・後処理、実ルートとSDK描画、関連既存画面の実ブラウザー回帰を確認する。[QA課題](../../testing/QA_HANDOFF.md#ds-purchase-browser)。
- CheckoutはPC2カラム／mobile1カラム、住所radio・Radix dialog・既存AddressForm再利用、住所save/default/load action Props。国と保証はopt-in。couponのlabel／validation／pending／error、送料queueと注文成功後の永久ガードを保持し、更新失敗では注文ロック＋retry。
- 注文詳細は固定幅／固定高scroll撤去、長文・複数店舗・画像fallback、集計1つ、既存payment条件を保持。戻る実リンク／未実装cancel disabled。header/PDFのplain invoice投影、生成準備中／失敗。Stripe appearance、SDK読込／取引失敗、PayPal script retryと両方式ロック。backend/API/認可/金額計算/在庫/状態遷移/PDF装飾に変更なし。
- Red: `bun run test -- --runInBand --runTestsByPath tests/component/store/commerce-design.test.tsx` 4/4 failed。旧住所にnamed radio／button／dialogがなく、order summary h2もないことを確認。初期Greenは4/4。差分レビューで住所save後のload失敗と次のinvalid入力により前回loadが再実行される追加Red1件（expected1／received2）を確認。保存完了フラグとretry先を分離して修正し最終Green5/5。既存購入・provider・queryテストは回帰として扱う。ブラウザーは実装後の回帰でありRed実績には含めない。
- 最終Jest: `bun run test -- --runInBand --silent --runTestsByPath` に対象18ファイルを指定し **420/420、18 suites**。Checkout queue・失敗/retry・二重注文・成立後cleanup失敗、coupon store/platform、Stripe/PayPal、住所/profile/cart、owner guardsを確認。order pageのpayment条件4通り／集計1つ／missing redirect／invoice plain値も確認。
- Supplemental Chromium: `bunx playwright test --config playwright.commerce.config.ts` **11/11**。`tests/browser/commerce-design.spec.ts` とproduction部品/CSSの独立fixture bundleを使用。1440／768／390px、長文・2店舗・空bag/住所なし・pending/失敗/retry・coupon lock・住所保存成功/失敗と既定変更・radio Space・focus outline・dialog trap/Escape/復帰、axe WCAG2.1AA（contrast除外なし）違反0。住所再読込の追加修正後、関連Chromium6/6も再確認。screenshots `test-results/checkout-{1440,768,390}.png`／dialog、order-paid/order-pendingを生成しPC/mobileを目視確認。Nextナビゲーション/SDK/actionはmock、Clerk・DB・購入・外部送信は実行しない。
- lint **0 errors／既存12 warnings**、`bunx tsc --noEmit` 成功。sandboxでのlisten EPERMは権限付き再実行で解消。fixtureのprocess定義と長文住所のvalidationテスト条件を修正して再検証済み。これらの環境／fixture失敗はRed実績に含めない。
- [SDD要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)／[architecture](../../../specs/multi-vendor-ecommerce/02-architecture.md)／[workflows](../../../specs/multi-vendor-ecommerce/05-workflows.md)／[testing](../../../specs/multi-vendor-ecommerce/07-testing.md)と画面要件/設計/task、計画・QA・テスト計画を同期。[overview](../../../specs/multi-vendor-ecommerce/00-overview.md)／[data-model](../../../specs/multi-vendor-ecommerce/03-data-model.md)／[interfaces](../../../specs/multi-vendor-ecommerce/04-interfaces.md)／[quality](../../../specs/multi-vendor-ecommerce/06-quality.md)は変更不要（scope/DB/API/品質基準に変更なし）。旧住所部品と共有Modal、全体tokens、商品詳細保証の全利用先移行は完了扱いにしない。
- ダッシュボード再生成: **321 test files／lcov328／18/80 cells（23%）**。lcovと全体Jest成功数は再測定せず既存実測値を維持。実認証後route、SDK実描画、Firefox/WebKit、全E2Eと全体coverageは未実行。

## P2優先5画面移行記録

- 2026-10-05。[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md)。
- Offers: RTL新要件Red 2件、Green/Refactor 4/4、tsc 0、lint 0 errors/12既存warnings。`0195267c`→`1069ef25`→`5fea2f4a`。ブラウザー検証待ち。

- Dispute: Red 1件→Green/Refactor 9/9（SupportForm含む）、tsc 0、lint 0 errors/12既存warnings。`0ab9d890` / `89f5f198` / `a2c7ddb2`。公開実ルートHTTP 200確認、表示・操作検証待ち。

- Report problem: Red 1件→関連10/10、tsc 0、lint 0 errors/12既存warnings。`4bda3231` / `3f35e4f1`。共有部品再利用後のRefactor差分なし。

- Following: Red4件→Green4/4→Refactor関連18/18、tsc0、lint0 errors/12既存warnings。`1ed94eaf` / `e5c54728` / `982f13b5`。旧共有StoreCard/Paginationは未移行を維持。認証後検証待ち。

- History: Red6件→Green6/6→Refactor関連21/21、tsc0、lint0 errors/12既存warnings。`a52ef2f0` / `31492ef3` / `85022b3b`。client routeをServer Action Props境界へ変更。専用test DBなしで認証後実ルートは保留（実装あり）。補助browserは別検証として実施中。

### 最終検証・状態（2026-10-05）

- **検証済み**: DS-PAGE-016 offers / 012 dispute / 035 report-problem、DS-COMP-205。**保留（実装あり・補助検証済み）**: DS-PAGE-022 following / 024 history、DS-COMP-086/206/207。
- 公開実ルート: `bunx playwright test --config playwright.priority-public.config.ts` **11/11**。3画面×1440/768/390px、2つの未認証戻り先。フォームはServer Action応答mockでticket DBへの書込・外部送信なし。通常/validation/pending/error/retry/receipt、serif/cream、focus/Enter、横溢れなし、mainのaxe AA違反0（contrast除外なし）。Offersは既存DBのタグをread-only表示。空/失敗はRTLで検証。公開3画面PC/mobile画像目視確認。
- 補助ブラウザー: `bunx playwright test --config playwright.priority-components.config.ts` **6/6**。2画面×1440/768/390px、長い店舗名/商品名、follow pending/失敗保持/再試行/成功/件数、history pending/error/retry/empty/editorial compare、URL page linksとブラウザー戻る、keyboard/focus、axe AA違反0。Next adapters/actionをmockしたfixtureで、認証後実ルートは証明しない。PC/mobile画像目視確認。
- 追加回帰: discovery-regression **8/8**、support-category-regression **2/2**。alias/canonical、非string/非配列のstorage、旧ページ応答破棄、カテゴリーpayload/必須UUID/無注文番号/ロック/失敗入力保持/受付。
- 全体: `bun run test -- --runInBand --coverage --json --outputFile=/tmp/ds-full-jest.json` **2766 passed / 2769 total（3 skipped）**、263 suites（262 passed/1 skipped）、127 snapshots。coverage **83.16/69.26/77.45/83.24%**（statements/branches/functions/lines）。`bunx tsc --noEmit` 0、`bun run lint` 0 errors/12既存warnings。
- dashboard再生成 **329 test files / lcov349 / 18 of80 cells（23%）**。統計はQA_HANDOFFからSDD/COVERAGE_REPORT/docs/PROGRESSへ同期。全E2E、Firefox/WebKit、Integrationは今回未実行。
- テストコード修正の失敗（pointer modality、ボタン名称変更、Page2/20の部分一致、router mock安定性、Zodが空orderIdをundefinedへ変換する期待値）は新要件Redへ算入しない。追加回帰に過去のRedを創作しない。
- 保留理由: `docker ps -a`のread-only確認でdev app/dev DBのみ、専用test DB不在。解除条件は[QA DS-ACCOUNT-DISCOVERY-BROWSER](../../testing/QA_HANDOFF.md#ds-account-discovery-browser)。既存接続へのtest-user/fixture書込、seed/resetは行わない。
- 仕様同期: SDD01/02/04/05/07、offers/support-forms、following/history。SDD00はプロダクトスコープ不変、03はモデル不変、06は既存品質基準維持、08は既存Open Question未解消で変更不要。旧共有カードと全体基盤の状態は維持。
- 検証commit: `c4724e29` / `c3b7eaa8` / `d04848cb` / `b22ccc44`。本文は実装履歴を維持し、最終判定は本節を正本にする。

- 本番ビルド: `bun run build` **exit 0**、compile/TypeScript/static page generation成功。既存のmetadataBase未設定とOG画像の✦ dynamic-font download（HTTP400）警告あり。sandbox内の停止したビルドは中断し、昇格後の成功結果を最終結果とする。

## 優先7画面移行記録

2026-10-05。[承認済み保存計画](../../../plans/layout-design/priority-seven-design-system-plan.md)。対象032/004/058/062/055/057/056。計画に従って7画面の実装・TDD・画面単位コミットを完了。認証後実ルート/SDK受け入れは保留。画面単位Green後にテスト・文書を同梱するコミット粒度はユーザー選択。既存QAの未コミット差分を保持する。

### 共通基盤

- DS-BASE-001は本タスクの販売者scopeのみ実装。グローバル共通基盤全体の完了とは扱わない。新設DS-COMP-208: SellerShellとseller.module.css。
- Red: seller-shell RTL2件、メニューbutton欠落。Green/Refactor: shell/header/sidebar関連5/5。tscエラー0、lintエラー0/既存警告12。
- 既存認可/DB取得は変更なし。[02-architecture](../../../specs/multi-vendor-ecommerce/02-architecture.md)／[03-data-model](../../../specs/multi-vendor-ecommerce/03-data-model.md)は変更不要。
- 補助ブラウザfixtureを追加。Next/Clerk adaptersはmock、DB/送信なし。ローカルlistenのsandbox EPERMは環境失敗でありRedに数えない。

- Supplemental Chromium6/6: 1440/768/390px、light/dark、navigation、theme Portal、overflowなし、axe AA違反0。Radix閉じる遷移中のaria-hiddenを待つようテストを修正（実装のRedに数えない）。実ルート認可/Clerkは未検証。画像は切替前テーマへ戻して記録する。

### アカウント設定（DS-PAGE-032）

2026-10-05。Red1件: ラベル付きsection欠落。Green/Refactor関連Jest14/14、Supplemental Chromium3/3(1440/768/390px・overflow・axe AA)。Clerk mockはappearance/hashをRTLで検証。実UserProfileのresponsive/security/dialogは未確認。tsc0、lintエラー0/既存警告12。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 出店申請（DS-PAGE-004）

2026-10-05。Red2件: heading/進捗role欠落。Green/Refactor新規RTL3/3(1件は実装後回帰)、設定を含む関連5/5。Supplemental Chromium3/3: 4step、validation、画像SDK adapter、値保持、pending lock、failure/retry/receipt、1440/768/390px・axe AA違反0・overflowなし・画像目視。actionはServer Propsへ変更、実店舗作成/画像アップロードなし。tsc0、lintエラー0/警告11。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 店舗概要（DS-PAGE-058）

2026-10-05。Red1件: ラベル付きoverview region欠落。Green/Refactor関連Jest11/11、Supplemental Chromium6/6(1440/768/390px・light/dark・実Tremorチャート・金額/空・axe AA違反0・overflowなし)。KPI/sectionを見出しにし、チャートはopt-inでゴールドとemptyを導入。tsc0、lintエラー0/警告11。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 商品一覧（DS-PAGE-062）

2026-10-05。Red2件: headingと取得失敗表示欠落。Green/Refactor関連Jest41/41・既存snapshots2/2、Supplemental Chromium6/6(3幅/light/dark・長文/欠画像/金額/検索/空/削除pending/error/作成dialog/axe AA・Escape focus復帰)。ブラウザで検出した色見本role・色選択/Selectラベル・国選択・focus復帰も修正。商品サイズ価格は表示項目だけに投影し数値化、/100なし。作成/属性取得/削除をaction Propsへ移行し、他3フォーム呼出先の配線のみ同期。Jodit/画像SDKはfixture adapterで実SDK未確認。tsc0、lintエラー0/警告11。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 在庫管理（DS-PAGE-055）

2026-10-05。SellerPage、検索、数量/しきい値の編集・保存中・検証失敗・保存失敗・再試行・成功通知を適用。Red3件（見出し欠如、取得失敗の空一覧誤表示、更新失敗の再試行欠如）を確認後Green。関連RTL18/18、補助Chromium6/6（1440/768/390、light/dark、axe AAコントラスト除外なし）。所有権ガード・在庫判定・更新query・価格単位は維持。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 注文一覧（DS-PAGE-057）

2026-10-05。SellerPage、検索、空/取得失敗の区別、テーマ対応の詳細モーダル、注文/明細の状態編集を適用。Red2件（見出し欠如、取得失敗の空一覧誤表示）後Green。関連RTL12/12、補助Chromium6/6（3幅2テーマ、axe AA、モーダルEscape/focus復帰、状態の失敗/再試行/成功）。追加操作テストは実装後の回帰確認。金額は既存ドル値の表示投影、注文遷移/認可/更新queryは維持。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 販売者メッセージ（DS-PAGE-056）

2026-10-05。SellerPage、購入者名の会話一覧、モバイル一覧/スレッド切替、取得/既読失敗の再試行、送信中の切替ロック、下書き保持を適用。Red2件（workspace/refresh欠如、取得失敗の空一覧誤表示）後Green。関連RTL40/40（購入者回帰を含む）、補助Chromium6/6（3幅2テーマ、axe AA、keyboard選択/focus復帰、失敗/再試行/送信成功）。既存5秒pollの非表示停止・unmount取消・stale破棄・重複防止を回帰確認。認可/送信/既読queryは維持。

実装あり。認証後実ルート/第三者SDK実描画は専用テストDBと認証テスト環境で受け入れ確認するまで保留。補助fixtureを実ルート検証済みとは扱わない。

### 最終検証と残課題（2026-10-05）

- 補助fixture: 7画面とSellerShellのChromium42/42。1440/768/390px、販売者light/dark、コントラスト除外なしのaxe AA、長文/空/エラー/pending/再試行/成功、検索、キーボード、dialog閉鎖とfocus復帰を確認。PC/390pxの7画面画像を目視。設定はmock UserProfile外枠のみでSDK内部の検証実績には含めない。
- 実Next.js guestルート: Chromium5/5。申請3幅の全document axe AA/overflow/focus表示、settingsのsign-in redirect、5販売者ルートのguest redirectを確認。実ルートで申請ヘッダーのロゴと旧Sign in buttonのコントラスト不足をRed3件として確認し、申請scopeの色・anchor化でGreen5/5。共通BrandはCSS変数opt-inとし他scopeの既定色を維持。
- 画像目視後のRefactor: 検索icon/inputを同じ行に保ち、表見出しと先頭列の読みやすい幅を確保、上位商品名の省略を折り返しへ変更。関連検証を再実行。
- 専用E2E_DATABASE_URLが未設定、Docker daemon/socket不在。接続できる既存DBは専用test DBでなくProduct.searchKeywords未適用を実Nextのread-onlyログで確認。環境のschema不整合は本変更のTDD Redに数えない。migration/seed/resetは未実施。認証後7画面・Clerk UserProfile/UserButton lifecycle・Cloudinary・実商品フォーム/受送信のSDK描画は保留。解除条件: 既存schema適用済み専用test DBとClerkテストアカウントを用意し、認証後7実ルートを3幅/light/dark、実Sidebar/StoreSwitcher、Portal/第三者UI、操作と既存関連ルート回帰で確認する。[QA残課題](../../testing/QA_HANDOFF.md#ds-seven-browser)。
- 部品208〜216と実装した既存部品は本体適用・保留。共有部品全scopeや第三者SDKをfixtureだけで検証済みにしない。メッセージの旧MessagesLayout/旧ConversationThread（089/091）は新販売者から使わず他利用者の監査を継続。
- SDD [01要件](../../../specs/multi-vendor-ecommerce/01-requirements.md)／[04内部IF](../../../specs/multi-vendor-ecommerce/04-interfaces.md)／[05workflow](../../../specs/multi-vendor-ecommerce/05-workflows.md)／[06品質](../../../specs/multi-vendor-ecommerce/06-quality.md)／[07テスト](../../../specs/multi-vendor-ecommerce/07-testing.md)を同期。02/03は既存認可・schema・金額・在庫・注文更新契約を変更しないため変更不要。

- 最終全体実測: 2802 passed / 2805 total、3 skipped、127 snapshots passed、275 スイート（274 passed／1 skipped、failed 0）。Statements84.12%（9459/11244）／Branches69.87%（5329/7626）／Functions78.23%（1754/2242）／Lines84.3%（8596/10196）。lint errors0/既存warnings11、tsc0、dashboard343files/363lcov/18 of 80cells。正本は[QA_HANDOFF](../../testing/QA_HANDOFF.md#優先7画面のデザイン移行2026-10-05)。

- 台帳整合: 66画面（本体適用37/未適用21/転送専用7/仮実装1）、216部品のID一意性と新設連番、変更文書の113ローカルリンク（アンカー含む）を検証。画面状態の検証済み18件には転送alias4件を含み、採用計画の本体検証済み14件と一致する。

### 申請SSR/reduced-motionの回帰修正（2026-10-05）

実ルート画像確認で、reduced-motionのSSR初期opacity0と初回Client描画の差によるhydration警告/本文非表示を検出。実guest3幅のconsole hydration警告なし・Sign upと親のopacity表示を先行テストでRed確認し、初期表示を両環境でvisibleに統一、reduced-motionではtransition0として修正。実guest5/5、申請補助3/3と全体Jestを再実行。認証SDKの設定画面内部とは別の実ルート検証。


## 優先6画面移行記録

[保存計画](../../../plans/layout-design/priority-six-design-system-plan.md)。2026-10-05。各画面の補助検証と認証後実ルート受け入れを区別する。

認証後実ルート・実SDKはschema-current専用test DBとClerkテスト販売者環境が揃うまで保留。DB/API/認可/計算変更なし。[architecture](../../../specs/multi-vendor-ecommerce/02-architecture.md)・[data model](../../../specs/multi-vendor-ecommerce/03-data-model.md)は既存Props境界/スキーマを維持するため変更不要。

### DS-PAGE-061 商品登録

RTLの見出しRed1件・フォーム保存Red1件、ブラウザーの見出しRedと目視後の追加Redを確認。Green/Refactor後の関連Jest50/50、補助Chromium6/6（1440/768/390px・light/dark・focus・カテゴリPortal・axe contrast含む）、画像目視、lint errors0（既存warnings10）、tsc0、harness成功。ProductDetailsのseller opt-in・見出し階層・保存lock/汎用error/retry/status、画像とキーワードの縦配置・動的行の折り返し・旧青色を整理。 認証後実ルート/SDKは実装あり・保留。画面単位コミット `5fae94f3`。

### DS-PAGE-060 バリアント追加

新要件RTL1件の見出しRedを確認。最小実装・既存フォーム再利用後の関連Jest46/46。商品情報の初期値と既存null応答、action Propsを維持。ブラウザーのカテゴリ操作可否は既存仕様に合わせ、商品名/説明/brand非表示とカテゴリ継承を確認する。 認証後実ルート/SDKは実装あり・保留。画面単位コミット `f9a88c8f`。

DS-PAGE-060最終確認: 補助Chromium6/6（3幅/light/dark、初期カテゴリ・商品scope非表示・focus・overflow・axe contrast含む）、関連Jest46/46、tsc0、lint errors0/warnings10、harness成功。

### DS-PAGE-059 バリアント編集

新要件RTL1件の見出しRed、保存後axeで既存Radix toastのaria-hidden-focus/button-nameをRed確認。seller opt-inではフォーム内status/alertへ統一し、旧scopeのtoastは維持。Refactor後関連Jest69/69（編集ownership/属性/商品一覧含む）、補助Chromium6/6（3幅/light/dark・初期価格12.5・pending lock/error/retry/success/refresh・overflow・axe contrast含む）、lint errors0/warnings10・tsc0・harness成功。 認証後実ルート/SDKは実装あり・保留。画面単位コミット `0ceb6844`。

### DS-PAGE-064 配送設定

先行RTL4件で見出し/名前付きform/Action境界不足をRed確認。重複submit再現のRedを同期submit guardで修正。Refactor後Jest90/90（商品dialog/seller shell/store queries含む）、補助Chromium6/6（3幅/light/dark・国別検索・12.5ドル初期値・Portal・pending lock/close防止/error/retry/success・Escape focus復帰・overflow・axe contrast含む）、lint errors0/warnings10・tsc0・harness成功。表示用数値へserializeし単位を維持。 認証後実ルート/SDKは実装あり・保留。画面単位コミット `bc39f453`。

### DS-PAGE-063 店舗設定

先行RTL2件でページheading/名前付きform/送信中ロック不足をRed確認。共通StoreDetailsを画像・連絡先のレスポンシブ配置へ整理し、Server注入Actionとinline status/alertを導入。型変更に必要な店舗作成呼び出し元のAction注入だけ先行し、同画面の本体移行は未完了。Refactor後関連Jest91/91（store query認可・配送・商品dialog含む）、補助Chromium6/6（3幅/light/dark・画像upload adapter・featured・pending lock/error/値保持/retry/success/refresh・overflow・axe contrast含む）、画像目視、lint errors0/warnings10・tsc0・harness成功。DBはフォームに必要な列のみselectし、既存redirectと例外伝播を維持。 認証後実ルート/SDKは実装あり・保留。画面単位コミット `ec51fe12`。

### DS-PAGE-065 店舗作成

先行RTL2件でmain/h1/theme control不足と新規IDがAPI更新branchへ誤接続する問題をRed確認。店舗別Shell外に専用テーマ枠とThemeToggleを用意し、既存upsertStoreの作成契約に合わせ新規のみidを省略（query/認可/schemaは変更なし）。更新idは維持。Refactor後関連Jest93/93、補助Chromium6/6（3幅/light/dark・theme Portal・空/画像validation・upload adapter・pending lock/error/値保持/retry/success/返却URL・overflow・axe contrast含む）、lint errors0/warnings10・tsc0・harness成功。 認証後実ルート/SDKは実装あり・保留。画面単位コミット `07e1a3eb`。


### 最終監査・全体証跡（2026-10-05）

- 画像galleryの名前付き削除buttonにRTL/ブラウザーRedを確認しseller opt-inで修正（実装a2e71dad、回帰ce270ae6）。既存scopeのclass挙動は維持。追加ブラウザーで空配送表のscrollable-region-focusableをRed確認し、sellerだけ名前付きfocusableスクロール領域へ修正。
- 配送入力共通化ShippingFieldsをDS-COMP-218として登録。店舗URL変更後の返却URLへのreplaceは既存レビュー修正と回帰を維持。関連設計/仕様と台帳へ同期。
- 最終全体Jest2,842 passed / 2,845 total、3 skipped、280 suites（279 passed/1 skipped）、127 snapshots passed。coverageとdashboardは[QA正本](../../testing/QA_HANDOFF.md#ds-six-browser2026-10-05実装あり認証後検証保留)。six37/37、既存seven回帰42/42、renderer12/12、tsc0、lint errors0/warnings10、harness成功。3幅/light/dark、axe contrast含む、ページと配送dialog画像目視。
- 66画面: 本体適用43/未適用15/仮実装1/転送専用7。218部品のIDを維持。現在の認証後保留は既存11＋今回6＝17。外部SDK/専用DB/認証後ルートをfixtureのみで完了扱いにしない。
- 00-overviewは製品scope/role変更なし、02-architectureは既存Server注入境界維持、03-data-modelはschema不変で変更不要。category-attributes仕様はカテゴリ/属性契約不変、seller-dashboardのKPI/在庫設計は今回対象外で変更不要。今回表示契約はseller-ui-migrationとSDD01/04/05/06/07へ同期。
- 一時ログ: `/tmp/six-full-jest.log`、`/tmp/six-final-browser.log`、`/tmp/six-seven-regression.log`。永続添付ではなく結果をこの記録に保存。tsxのIPC起動時EPERMはsandbox外実行で解消し、TDD Redには含めない。

## P3優先6画面移行記録

2026-10-05。[承認済み計画](../../../plans/layout-design/priority-six-p3-design-system-plan.md)。画面別Green後コミット。認証後実ルート/SDKは専用test DB/Clerk環境で別途受け入れ確認。fixtureを実ルート完了と扱わない。DB/API/認可/計算変更なし。[architecture](../../../specs/multi-vendor-ecommerce/02-architecture.md)と[data model](../../../specs/multi-vendor-ecommerce/03-data-model.md)は既存契約維持のため変更不要。

### DS-PAGE-049 管理者概要

新要件RTL2件とmobile nav browserのRed確認。Green/Refactor後Jest26/26、補助Chromium6/6（3幅/light/dark・nav Escape/focus復帰・長文/空/取得失敗/retry・axe contrast含む）、390px画像目視。tsc0、lint0 errors/既存10 warnings、harness成功。共通Shellを管理者にも利用、metric/activity h2、SDK graphと集計値維持。認証後実ルートは実装あり・保留。

### DS-PAGE-048 管理者注文

先行RTL2件のregion/searchbox/取得失敗Red確認。Green後に管理者group/item Action引数・ID/詳細の回帰を追加。Refactor後関連Jest37/37、補助Chromium6/6（3幅/light/dark・codeではなく注文ID検索・状態pending/error/retry/success・詳細Portal/Escape復帰・axe contrast含む）、390px dark画像目視。tsc0、lint0 errors/既存10 warnings、harness成功。ServerでDecimal/日時を表示用にserialize、既存searchParams/query契約保持。認証後実ルートは実装あり・保留。

### DS-PAGE-050 管理者店舗

先行RTL2件のregion/searchbox/取得失敗Red確認。Green後にstore identity・pending削除lock/重複防止の回帰を追加。関連Jest102/102、補助Chromium6/6（3幅/light/dark・名前検索・状態pending/error/retry/success・詳細配送値/Portal/Escape復帰・削除cancel/pending lock/error/retry/success・axe contrast含む）、390px画像目視。tsc0、lint0 errors/既存10 warnings、harness成功。不要なUser情報をClientに渡さず配送Decimalのみserialize。認証後実ルートは実装あり・保留。

店舗回帰テスト補正: 後続の統合tscでRTL getByRoleの余分なexact optionを検出し削除。実装動作変更なし。補正後の単独Jest1/1・tsc exit0・対象ESLint exit0を確認。以後チェックはset -eで失敗終了を伝播させる。

### DS-PAGE-054 販売者クーポン

SDK/uuidのJest adapter不足は環境エラーとして除外後、先行RTL2件のheading/code検索/取得失敗Red確認。SellerCoupons/専用formでscope・更新ID・payload・遷移を維持。共有CouponFormFieldsのnative number/datetime-localはseller opt-inのみ、admin既定SDKは維持。browser6/6（3幅/light/dark・load失敗/retry/null拒否・編集pending/close lock/error/値保持/retry/success・create validation・delete cancel・axe contrast含む）、390px dark画像目視。最終Jest/tsc/lint結果は下記最終確認。認証後実ルートは実装あり・保留。

旧CouponDetails/旧クーポン列（DS-COMP-150/176）、旧admin注文/店舗列（174/175）は新ルートから利用しない。旧部品の全scope移行完了とは扱わず利用監査を継続する。

DS-PAGE-054最終確認: 関連Jest117/117（旧coupon列/既定adminフォーム含む）、tsc exit0、lint0 errors/既存10 warnings、補助Chromium6/6、harness成功。新要件Redと既存実装の回帰追加は区別する。

### DS-PAGE-053 クーポン作成

先行RTL2件でcreation region/form/action接続のRed確認。日時編集の秒精度維持に追加RTL1件のRed→Greenを確認。Playwright fillのゼロ秒表記はChromiumの正規化に合わせ、ネイティブ入力は保存前に従来の秒精度へ戻す。関連Jest113/113、tsc exit0、lint0 errors/既存10 warnings、harness成功。ブラウザー最終再検証は以下に記録。保存後URL/新規UUID/scope/validation/pending/error/入力保持/retry/successを維持。認証後実ルートは実装あり・保留。

DS-PAGE-053最終確認: 補助Chromium作成6/6＋一覧回帰6/6、3幅/light/dark・日付/validation/pending/error/入力保持/retry/success/返却URL・axe contrast含む、390px画像目視。

### DS-PAGE-015 Legal

先行RTL2件のlabeled目次/Breadcrumb Red確認。既存DesignPageとLegal専用CSSで既存3本文/placeholder/metadata/heading由来アンカーを保持。Jest28/28、補助Chromium3/3、公開実ルートChromium3/3（1440/768/390px・HTTP200/title/既存目次・focus/Enter/fragment・reduced-motion・overflow・main axe contrast含む）、実ルート390px画像目視。保護5ルートの既存ホーム転送も1/1（未認証）。tsc exit0、lint0 errors/既存10 warnings、harness成功。公開Legalは検証済み。認証後業務5ルート/SDKは別途保留。

転送確認の初回テストはsign-inを期待したが、既存proxy.ts/plans072はresource側layoutでdashboardゲストをホームへ転送する仕様。テストを既存契約へ修正し4/4確認。認可/転送実装は変更しない。Next devのtsconfigへの生成types追記は元のincludeへ戻しコミットしない。

### 共通枠の最終差分監査

補助fixtureを実Sidebar/Headerへ拡張し、Clerk認証/UserButtonのみadapterを使用。先行browserでdark Avatar fallbackのcontrast不足2件と旧P4 toolbarの390px横溢れ1件をRed確認。UserInfoのseller/admin opt-inをinitials・primary-foreground・折返し可能な非操作情報へ整理、DataTable toolbarのdata属性とtheme内CSSで局所化。既存DataTable snapshot差分は属性2行のみを確認して更新。

Refactor後Chromium p3 37/37（6画面、3幅/light/dark、実Sidebar展開、P4既定表検索と新規ページURL、axe contrast含む）、既存seven回帰42/42、公開p3-public 4/4。P4本文・既定表の移行完了を意味しない。RTL layout3件でADMINの共通main/sidebar opt-inとguest/SELLERの既存ホーム転送を回帰確認。関連Jest9/9、tsc exit0、lint0 errors/既存10 warnings、harness成功。実Sidebar dark390px画像目視。全体Jest/coverage/buildの実測値は最終統計同期へ記録する。

### P3最終Codex監査・全体回帰

6画面の本体・展開UI・Portal・エラー／空状態・pending・再試行・関連利用先を自己監査。実Sidebar/Headerをfixtureへ追加したRedでdarkアバター文字と390px旧P4 toolbarの欠陥を検出し、修正後37/37。legacy DataTableのsnapshot差分2箇所は属性追加のみ確認・更新、全体Jest2862/2865・127 snapshots成功。公開Legal3幅＋guest確認4/4、seven回帰42/42、tsc・lint（既存10 warnings）・build・Playwright構成検査成功。統計正本は[QA_HANDOFF](../../testing/QA_HANDOFF.md#ds-p3-six-browser)。

次の新規移行は未適用9画面（P4）から選定する。認証後受け入れ保留22画面は専用テストDBとClerk情報を用意して別途解除する。SDD architecture/data-model/open-questionsは境界・DB・未解決仕様を変更しないため据え置き、requirements/interfaces/workflows/quality/testingに適用範囲と検証限界を同期した。

最終文書監査：66画面／225部品IDの一意性、追加ローカル参照49件（anchor含む）、状態件数、`git diff --check`を確認。DB schema／queriesの変更なし。dashboard生成器の関連Jest12/12・型検査・lint成功、統計同期後にdashboardを再生成（361／375／18/80）。

## P4優先6画面移行記録

- 日付: 2026-10-06。[承認済み保存計画](../../../plans/layout-design/priority-six-p4-design-system-plan.md)。対象DS-PAGE-043/042/045/044/047/046。自己レビュー・画面別コミット。
- 認証後実ルート/Clerk/実Cloudinaryは専用環境の確認まで保留。補助fixtureの成功を実ルート検証済みとしない。

### Step 1 — DS-PAGE-043 カテゴリ一覧

先行RTL2件（region/h1/searchboxと取得失敗）と390px browser見出し欠落のRedを確認。CategoryForm・Action Props列factory・MasterDialog・SaveFeedbackを導入。旧CategoryDetails/旧列は未使用の旧scopeとして別管理。Refactor後関連Jest112/112（6 suites）、Chromium6/6（1440/768/390 × light/dark、検索/空/load失敗/retry/保存pending・close lock/error/入力保持/retry/success/Delete cancel/Escape focus復帰、axe AA contrast含む）、390px dark画像目視。tsc成功、lint0 errors/既存10 warnings、harness成功。カテゴリ階層・サブツリー制約・正準slug・更新createdAt維持を回帰確認。認証後実ルートは実装あり・保留。

### Step 2 — DS-PAGE-042 カテゴリ作成

先行RTL1件のh1欠落をRed確認。既存CategoryForm再利用後Jest4/4、Chromium6/6（3幅/light/dark、validation・画像adapter・親選択・featured・focus・pending lock/error/入力保持/retry/success、axe contrast含む）。作成ID/createdAt/root parent契約を確認。 認証後実ルート/実SDKは実装あり・保留。

### Step 3 — DS-PAGE-045 管理者クーポン一覧

先行RTL2件のregion/h1/searchboxと取得例外をRed確認。AdminCouponFormと管理者Action Props列factoryを導入し、toggle操作も保持。関連Jest118/118＋共通dialog回帰3件。Chromium6/6（3幅/light/dark・edit load failure/retry・pending close lock/入力保持/retry・toggle pending/success・delete cancel・空/取得失敗・axe contrast含む）。toggleの処理中ラベルに対するテストlocatorを修正し再検証。tsc成功、lint0 errors/既存10 warnings、harness成功。 認証後実ルート/実SDKは実装あり・保留。

### Step 4 — DS-PAGE-044 管理者クーポン作成

先行RTL1件の作成h1欠落をRed確認。既存AdminCouponFormをAction Propsで接続。関連Jest9/9、Chromium6/6（3幅/light/dark・validation・PLATFORM時Store ID非表示/null payload・native日時/割引・focus・pending/error/値保持/retry/success・axe contrast含む）、390px dark画像目視。共通dialog回帰テストのgeneric型とRTL selector型不整合は型検査で検出し修正。 認証後実ルート/実SDKは実装あり・保留。

### Step 5 — DS-PAGE-047 オファータグ一覧

先行RTL2件（h1/searchbox/new-page linkと取得例外）のRed確認。Action Props・列factory・既存MasterDialog/SaveFeedbackを再利用。関連Jest36/36＋フォーム回帰2/2、Chromium6/6（3幅/light/dark・長文検索・load失敗/retry・pending close lock/error/値保持/retry/success/delete cancel/空/取得失敗・axe contrast含む）。編集ID/createdAtを保持。tsc成功、lint0 errors/既存10 warnings。 認証後実ルート/実SDKは実装あり・保留。

### Step 6 — DS-PAGE-046 オファータグ作成

先行RTL1件の作成h1欠落をRed確認。Action Propsの共通OfferTagFormへ接続。関連Jest11/11、Chromium6/6（3幅/light/dark・validation・focus/Enter・pending/error/値保持/retry/success・axe contrast含む）。作成ID/name/url/createdAtと既存一覧遷移を維持。tsc成功、lint0 errors/既存10 warnings。 認証後実ルート/実SDKは実装あり・保留。

### 6画面横断の自己レビュー

| 対象 | 確認した部品・状態 | 証跡 |
|---|---|---|
| カテゴリ一覧/作成 | 階層/親/slug/画像/featured/並び順、検索/空/取得失敗、作成/編集/削除、欠落データ・古いsession応答 | admin-p4-pages、admin-category-form、admin-master-dialog、p4 browser |
| クーポン一覧/作成 | STORE/PLATFORM・storeId、割引/日時/active、toggle、検索/空/取得失敗、作成/編集/削除 | admin-p4-pages、admin-coupon-form、p4 browser、既存coupon queries/default SDK/seller回帰 |
| オファータグ一覧/作成 | name/url・更新ID/createdAt、検索/長文/空/取得失敗、作成/編集/削除 | admin-p4-pages、admin-offer-tag-form、p4 browser、既存offer queries |
| 全dialog/form | validation、重複submit、pending field/close lock、値保持error/retry/success、削除cancel/confirm/retry、欠落loadを拒否、focus/Enter/Escape/復帰、axe contrast | admin-master-dialog + 各form RTL、p4 browser |
| 共通利用先 | 管理者Shell/Sidebar/Header、P3概要/注文/店舗、seller coupon一覧/作成、CouponFormFields既定SDK | p3 browser、全体Jest |

新画面と展開時/Portalを別に確認。旧CategoryDetails/AdminCouponDetails/OfferTagDetailsと旧列は6実ルートから利用しないが、旧scopeの利用監査は未完了。一覧は元実装と同じクライアント検索・全行表示で、存在しないページング機能を新規追加していない。DB/権限/業務処理は変更しない。

仕様確認: [overview](../../../specs/multi-vendor-ecommerce/00-overview.md)は製品scope不変、[data model](../../../specs/multi-vendor-ecommerce/03-data-model.md)はDB不変、[open questions](../../../specs/multi-vendor-ecommerce/08-open-questions.md)は新規業務判断なしで変更不要。requirements/architecture/interfaces/workflows/quality/testingとadmin-dashboard要件/設計/tasks/進捗を同期した。

### 最終監査で検出した親選択のaxe違反

開いたRadix親選択で、aria-hidden背景にfocus可能要素が残るaria-hidden-focus（serious）を追加browserのRedとして確認した。対象CategoryFormの親選択だけをscoped native selectへ置換し、Root→null・親ID・サブツリー/深さ制限を維持した。共有Selectと旧フォームには変更を波及させない。新カテゴリフォームの階層・親選択/Root・numeric orderを直接RTLで回帰し、creation dialogのaxe AA・実Tab移動・Escape focus復帰・reduced motionは修正後1/1で成功。

P4 suiteは既存P3 serverのDESIGN_SUITEに応じてname/portをp4/3126へ分離する。P3はp3/3124を維持し、新config/serverは作らない。sandboxのlisten/tsx IPC EPERMとbuild停止、同portの一時競合、処理中ラベルに対するテストlocator修正は環境/テスト問題として記録し、新要件Redに数えない。sandbox外buildと最終検証の結果を採用する。

画像選択面も目視で旧shadow/白枠/大きな丸みの残存を発見し、先行browserのshadow要件Redを確認した。CategoryFormだけがcategory.module.cssへopt-inし、themeのmuted面/罫線、3px角丸、shadowなしへ変更した。ImageUpload本体/他scope/実Cloudinaryには波及させない。

### 最終監査で検出したクーポンのClient境界

getAllCouponsのstore:trueには配送Decimalが含まれる。表示用Propsが店舗全体を持ち込むことを先行RTLでRed確認（1 failed/9 passed）し、Server ComponentでCouponスカラー項目とstore.nameだけへ投影した。型もAdminCouponRowの表示契約へ限定し、10/10でGreen。既存query/DB/権限は変更しない。

### 最終検証結果（2026-10-06）

全体Jest2903 passed/2906 total（3 skipped、298 passed/299 suites、127 snapshots）。Statements86.81%（10190/11738）、Branches77.32%（6356/8220）、Functions82.72%（1983/2397）、Lines87.25%（9285/10641）。6画面の最終補助Chromium37/37と既存P3回帰37/37を確認。店舗名投影後のクーポン一覧6ケースも6/6で再確認した。1440/768/390px × light/dark、axe AA（contrast含む）と6画面/展開Dialogのスクリーンショットを目視確認した。

型検査exit0、本番build成功、lint0 errors/既存10 warnings、Playwright harness成功。認証後6実ルート・実Clerk/Cloudinaryは専用test DBと管理者テスト認証未設定で保留。補助検証の成功を実DBの受け入れに加算しない。

最終文書監査: 66画面/233部品IDの一意性、追加ローカル参照、状態件数、git diff --checkを確認。dashboard371 test files/383 lcov/18/80セルへ再生成した。計画・6画面・最終監査の8段階コミット。

## 購入導線優先6画面移行記録

- 2026-10-06。[保存計画](../../../plans/layout-design/priority-six-purchase-design-system-plan.md)。承認済み対象: DS-PAGE-017/006/019/037/007/008。共通対象DS-COMP-001〜005とDS-BASE-001のstore subset。
- 共通UI Red: header-search/country-selectorの新要件8件失敗（link/status/stale-response/expanded/unique-ID/keyboard）。Green: 3 suites・24/24。国保存pending/failure/retry/fixed EN/USDは新実装の回帰確認として3件追加。
- ブラウザーRed: 3幅でsearch triggerが19px（44px要件違反）。続いてsearch statusのcontrast違反を確認。最小修正後Chromium3/3・header内axe AA違反0（account/search/country）。
- Server identity lookupからproduction HeaderFrame/AccountMenu表示を分離し、fixtureも同じ表示部品を使用。旧nested Link/Buttonを解消、Clerk hydration wrapperは保持。native検索リンク、query保持、abort/stale/unmount、国選択keyboard/ARIAとAPI保存retry、store専用token/CSSを適用。
- 既存共通fixture serverのesbuild出力名をpreviewへ固定し、別名entryでも共通配信を再利用。config/serverを新設しない。listen EPERMとentry出力名不一致は環境/ハーネス不備で、TDD Redに含めない。
- 認証後Clerk実描画と商品あり実ルートは未確認。実Nextは既存DBのProduct.searchKeywords欠落を再確認（read-only）。DB変更なし。画面全体とDS-BASE-001は完了にしない。各画面の証跡を以下へ追記する。

### 共通UI最終確認

- Refactor後RTL24/24・Chromium5/5。signed provider adapterで既存account links/controlsを確認、native suggestion Enterの遷移を確認。1440/768/390pxのaccount/search/country screenshotとaxe AAを取得。実Clerk lifecycleは別途保留。
- SDD requirements/architecture/interfaces/testingとテスト設計/QAを同期。overview/data-modelは既存product scope/DB/moneyに変更なしのため変更不要。採用計画の共通部品全体チェックは実認証/他callerの受け入れ完了まで維持する。

### Step 1 — DS-PAGE-017 Home

- 共通UI適用後、既存home本体を維持。既存実装の回帰としてExperience/Selection/dataのJest20/20、Chromium home3/3（3幅・reduced motion・collection link・全体axe AA違反0・overflowなし）を確認。今回追加したhome回帰に新機能Redは主張しない。
- 実route home3幅でheader/accountと商品取得失敗状態を確認。商品あり実routeはschema-current test DB待ち。[画面受け入れ仕様](../purchase-header/requirements.md)。画面全体は実装済み・受け入れ一部保留。

### Step 2 — DS-PAGE-006 Browse

- Red: Chromium3幅でsort radio itemが40px未満、hover/open label contrast 4.01:1、modal rootのaria-hidden-focusを確認。Green: 44px、state付きreduced-motion CSS、濃いlabel、sort専用non-modal menuへ修正。Chromium3/3・axe AA違反0・overflowなし、keyboard選択でcategory/size/searchを保持。
- Refactor後sort RTL10/10。関連filter/pagingの回帰38/38、browse pageは括弧パスをrunTestsByPathで実行25/25（合計63、11 suites）。専用fixtureのwrapperをproduction CSSに合わせた。実browseは既存DB schema不整合で保留、route suiteは専用E2E_DATABASE_URLなしでは明示skip。

### Step 3 — DS-PAGE-019 Product

- Red: quantityのsize未選択状態は無通知の旧pulse表示、editorial Paginationのnamed navが不在（RTL2件）。browser3幅でquantity操作が36px。Green: branded status、quantity/review filter44px、ivory review controls、input focusとreduced motion、review opt-inのnamed nav/current/disabledとscoped gold/cream CSSへ移行。
- Refactor後Jest69/69（14 suites）、Chromium product3/3（3幅・quantity stock上限・review pressed・paging/current・axe AA違反0・overflowなし・no-size status）。既存商品計算、在庫制限、サイズURL、配送、レビュー処理は変更しない。フォーム/ギャラリー/実SDK/商品あり実routeの全状態は専用DB待ちで画面全体を検証済みにしない。fixture JSXの閉じタグ修正はRed実績に含めない。

### Step 4 — DS-PAGE-037 Store

- Red: store collection link43px・商品compare40px（各3幅）、件数/空状態本文のcontrast4.19:1を確認。Green: collection/about/clearとeditorial card操作44px、件数/空本文を濃い色へ、選択compareをgoldへ修正。ProductListのeditorial empty muted色も同期しbrowseへの波及を確認対象に含めた。
- Refactor後Jest38/38（store details/products/sort、shared ProductList/ProductCardの5 suites）、tsc成功、Chromium6/6（3幅×長文/空・商品あり比較、axe AA違反0、overflowなし）。fixtureはproduction StoreProductsをquery adapterで解決し、本体のcollection結果/件数/リンクを直接検証。商品データ実routeはschema-current test DB待ち。

### Step 5 — DS-PAGE-007 Cart

- Red: quantity36px（3幅）とnotification close32px（390px）。Green: item/wishlist/remove/quantityとstore notification closeを44pxへ拡大。業務動作は維持。
- Jest52/52（container/product/summary/cart store）、Chromium3幅3/3（quantity/pending/checkout failure通知/削除→empty、全体axe AA違反0、overflowなし）。checkout retry1件・sync失敗保持1件も確認。実route empty cart3幅はWebpackで検証済み。既存DS-PAGE-007の検証済み状態は維持し新共通headerを追加監査。
- 先行specの数量role/既存文言に誤ったlocatorがあり修正した。fixture追加時のspec誤上書きはHEADから復旧。これらテスト作成ミスはTDD Red実績に含めない。

### Step 6 — DS-PAGE-008 Checkout

- 既存Checkout本体の住所/coupon/pending/retryを維持し、production共通headerを既存commerce fixtureへ統合。既存実装の回帰確認として関連Jest20/20（3 suites）とChromium14/14（既存11件＋header/dialog 3幅）を確認。新機能Redは主張しない。
- Account→address dialogのkeyboard/focus、refresh failure/retry、全体axe AA違反0とoverflowなしを確認。型検査exit0。実Clerk顧客認証後checkout/決済SDKは専用環境待ちで、画面全体の保留状態を維持する。

### 最終自己レビュー・検証（購入導線）

- 6画面×共通header×状態の仕様表を照合。purchase25/25、commerce14/14、公開route7 passed/3 skipped（schema-current専用DBなしのbrowseは明示skip）。1440/768/390pxのaxe AA（contrast含む）、keyboard/focus、overflowを確認。PC/mobileの6画面・住所dialog画像を目視確認した。fixtureのbrowse/product画像は対象部品の構成であり、実商品ページ全体の画像検証を代替しない。
- 全体回帰で旧UserMenuのbutton/画像alt期待4件が残っていたため、native signin linkのhrefと新altへ期待を同期。UserMenu13/13で成功。これは既存テスト追随漏れの修正で、新要件TDD Redには加算しない。
- lint0 errors/8 warnings、tsc exit0、Playwright harness成功。新規clientの直接Server Action importなし、API/DB/金額/在庫/認可変更なし。CountrySelector/Paginationの既存Propsとdefault variant、既存Clerk hydration wrapperを維持。
- 66画面/238部品IDの一意性と追加ローカルリンクを確認。検証済み15・周辺確認12・保留28・未適用3・placeholder1・redirect7の66画面分類は維持。実環境の未確認を成功件数へ加算しない。共通tokenの全体移行・実Clerk/他callerの移行は別受け入れとして残す。
- overview/data-modelと既存画面の業務設計は契約不変のため変更不要。関連requirements/architecture/interfaces/testing、cart/checkout仕様、画面別受け入れ、計画/QA/テスト計画を同期。[次の実受け入れ](../../testing/QA_HANDOFF.md#ds-purchase-six2026-10-06)。

最終全体Jest: 2916 passed / 2919 total、3 skipped、127 snapshots passed、301 スイート（300 passed／1 skipped、failed 0）。Statements87.09%（10273/11795）／Branches77.34%（6327/8180）／Functions83.21%（1998/2401）／Lines87.57%（9357/10685）。dashboard375 files/387 lcov/18 of 80 cells。計画・共通UI・6画面・最終同期の9段階コミット。

## OI-10 color-contrast 是正（2026-10-07・plan 084、未コミット）

- [計画](../../../plans/084-fix-a11y-color-contrast-oi10.md)。対象: DS-PAGE-006 Browse・DS-PAGE-019 Product の CSS Module 配色のみ。画面の状態分類は変更しない。
- **Red**: E2E a11y 6 spec の `disabledRules:["color-contrast"]` を解除し、Chromium で `/browse` 6 ノード・`/product` 22 ノードの color-contrast 違反を実測（クリーム背景 `#f2f0e9`〜`#f8f7f2` 上のゴールド/セージ系の小さい文字、比 2.36〜4.47）。`/checkout`・`/profile`・`/seller/apply`・`/cart` は違反 0（移行時点で解消済み）。
- **Green**: `browse.module.css`・`product.module.css` の該当ルールの文字色だけを、色相・彩度を保ったまま明度を下げた色へ置換（最も暗い淡色背景 `#edf0e8` 比 4.6:1 以上、`.catalogIntro h2 em` は大きな見出しなので 3:1 以上）。ヒーロー（ダーク背景）と共有の `.eyebrow` は変えず、`.catalogIntro .eyebrow` で上書き。グローバルトークンは変更なし。
- 検証: Chromium a11y 7/7 pass（抑制なし。checkout/profile は Docker DB 接続でテスト実行）、関連 Jest 23/23（5 suites）、tsc exit0、lint 0 errors／8 warnings。1440／390px の Browse・Product をスクリーンショットで確認し、配色の印象（ゴールド/セージ）を維持。
- 仕様: 配色の微調整で要件・インターフェース・ワークフローの変更はないため `specs/` は変更不要。全体 Jest／coverage 統計は部分実行のため更新しない。

## 通知一覧の新設（2026-10-07・plan 086、未コミット）

- [計画](../../../plans/086-implement-notification-foundation.md) Step 8。対象: DS-PAGE-067 `/profile/notifications`（新規）、DS-COMP-239 通知一覧、DS-COMP-240 ヘッダーの未読バッジ。既存の profile トークン（`--account-*`）と `pageHeading` / `eyebrow` / `error` を再利用し、新しい色は足していない。
- **Red**: `tests/component/store/notification-list.test.tsx`（6 件）・`user-menu.test.tsx`（通知 4 件）・`profile-sidebar.test.tsx`（1 件）を先に追加し、空の実装でアサーションの失敗を確認（30 件中 10 件失敗。成立していた 1 件は空の実装でも満たす「未認証では取得しない」）。既存の「10 個の行き先」テストは行き先が増える意図どおりの変更として 11 へ更新。
- **Green**: 通知一覧（空 / 未読の印 / 一括既読 / 失敗時の alert / 1 件の既読化 / 古い通知へのリンク）、ヘッダーの未読件数（summary の aria-label と `sr-only` の件数）、サイドバーのリンク。
- 検証: `DESIGN_SUITE=priority bun run test:design` 9/9（通知一覧 1440 / 768 / 390px で axe AA 違反 0・横スクロールなし・ボタンの focus outline・一括既読・失敗 alert・空状態）、`bun run check:playwright` pass、関連 Jest 425/425、tsc exit0、lint 0 errors／8 warnings。1440 / 390px のスクリーンショットで長い店舗名の折り返しを確認。
- 保留: Clerk 認証後の実ルート `/profile/notifications` と、ダークなヘッダー上の未読バッジのブラウザー表示は未確認（認証後のヘッダーを描画する fixture が無い）。解除条件: 認証後受け入れ環境（[QA_HANDOFF](../../testing/QA_HANDOFF.md#ds-p4-six-browser)）で確認する。
- 仕様: `04-interfaces.md`（ルート・notification module・cron API）、`05-workflows.md`（発送通知フロー）、`03-data-model.md` を更新。

## 購入導線残存部品6画面移行記録

- 2026-10-08。[保存計画](../../../plans/layout-design/priority-six-purchase-residual-design-system-plan.md) / [受け入れ仕様](../purchase-residual/requirements.md)。対象DS-PAGE-006/037/019/007/008/003は対応中（既存の検証済み/保留と履歴を維持）。
- 計画コミット: `43cafd89`。overview/data-modelは商品scope/DB契約不変のため変更不要。対象外callerとSDK受け入れは今回の補助検証へ含めない。

### 共通トークン

- Red: purchase Chromium1件、FilterPanelの面がtransparent（期待ivory）。最初のEPERMは環境エラーでRedに数えず、許可されたローカルサーバー実行で確認。
- Green/Refactor: opt-in purchase-themeをFilterPanelにcompose。面/文字/状態/focus/44pxトークンと明示light scheme。Chromium1/1、focus/面/scheme確認。lint/tsc結果はコミット前に確認。
- DS-BASE-001のstore subset追加。全体tokens移行の完了にはしない。

### 残存部品 Step 1 — DS-PAGE-006 商品一覧

- Red: variantリンクの名前/focusのRTL2件、カテゴリ操作36pxのChromium3件。Green/Refactor: カードvariant名/current/focus、editorial操作44px、filters/browse/sort Portalのtokens。Jest40/40、Chromium10/10（3幅/URL保持/variant Enter/axe AA）。途中のpointer後focus locatorはkeyboard modalityへ修正しRedに加算しない。
- 仕様: [6画面受け入れ](../purchase-residual/requirements.md)。既存の業務契約と画面全体の保留は維持。lint/tscは通過状態でコミット。

### 残存部品 Step 2 — DS-PAGE-037 店舗詳細

- Red: 修正済みlocatorで空カード背景transparentをChromium3幅で確認（最初の文言locatorミスはRedに含めない）。Green/Refactor: hero/results/emptyにtheme compose、空カードpanel面、light面focusは濃gold、dark heroは装飾gold。関連Jest27/27、Chromium9/9（3幅×長文/商品あり/空、axe AA、focus、URL）。
- 仕様: [6画面受け入れ](../purchase-residual/requirements.md)。既存の業務契約と画面全体の保留は維持。lint/tscは通過状態でコミット。

### 残存部品 Step 3 — DS-PAGE-019 商品詳細

- Red: review sort34pxのChromium3件。Green/Refactor: select44px/入力面/focus、review card/formとdropdown/errorのtokens、フォーム文字色/長文折返し。関連Jest20/20、product選択Chromium10/10、実card/form補助3/3（paint/draft/focus/overflow、Cloudinary/Action adapters）。フォーム全体のSDK/投稿実受け入れは別。初回fixtureのvariant空配列とlikes不足はテストfixture修正でRedには数えない。
- 仕様: [6画面受け入れ](../purchase-residual/requirements.md)。既存の業務契約と画面全体の保留は維持。lint/tscは通過状態でコミット。

### 残存部品 Step 4 — DS-PAGE-007 Cart

- Red: select-all label18pxのChromium3件。Green/Refactor: page tokens、44px選択label/item label/bulk/retry、商品grid領域調整。Jest52/52、Chromium8/8（3幅・数量・失敗保持/retry・sync失敗・bulk→empty・axe AA）。cart要件/設計を同期。
- 仕様: [6画面受け入れ](../purchase-residual/requirements.md)。既存の業務契約と画面全体の保留は維持。lint/tscは通過状態でコミット。

### 残存部品 Step 5 — DS-PAGE-008 Checkout

- Red: Portal保存buttonが従来green（期待gold）のChromium3件。Green/Refactor: commerce page/dialogへのtheme composeと共用AddressFormのtoken fallback。Jest33/33、commerce17/17、account既定配色/axe互換1/1。住所保存pending/error/success/focus、coupon/order lock/retry、3幅/axe AA。checkout要件/設計/tasksと共有order要件を同期。実認証/SDKは保留。
- 仕様: [6画面受け入れ](../purchase-residual/requirements.md)。既存の業務契約と画面全体の保留は維持。lint/tscは通過状態でコミット。

### 残存部品 Step 6 — DS-PAGE-003 注文詳細

- Red: store opt-inのRTL34件、角丸6pxのChromium6件。Green/Refactor: 注文/支払い/itemの任意store variantと共通意味色、header/group/itemに適用。関連Jest96/96、commerce24/24（全34状態×3幅×明暗祖先、axe AA、pending/paid/SDK-adapter失敗/retry、single total）。注文要件/設計/tasks同期。実SDK/認証後routeは保留。
- 仕様: [6画面受け入れ](../purchase-residual/requirements.md)。既存の業務契約と画面全体の保留は維持。lint/tscは通過状態でコミット。

### 残存部品 最終統合検証

- 全体Jest coverage付き: 3075 passed / 3078 total、3 skipped、317 suites（316 passed/1 skipped）、127 snapshots。Statements87.83%、Branches78.04%、Functions84.1%、Lines88.34%。
- purchase44/44、commerce24/24。1440/768/390px、明暗祖先、キーボード、Portal、overflow、reduced motion、axe AAと画像目視を確認。公開home/cart6件とguest sign-in戻り先1件を確認（初回の古いguest期待を修正して対象再試行）。browse3件は専用DB不在でskip。
- 仕様・SDD・QA・全体進捗・coverage dashboard同期。台帳は通知追加分を含め67ページへ集計整合、全画面の検証済み判定は変更しない。SDKアップロード/投稿、認証後checkout/order、商品あり実DBの受け入れは保留。
- 最終lint errors0／既存warnings8、tsc exit0、check:playwright pass、diff --check pass。追加文書リンク14件、台帳67ページ・242部品のID重複なしを確認。

## P2残存6画面移行記録

- 2026-10-09。[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)。DS-PAGE-009/033/022/024/067/032は本体適用・補助検証済み。既存の検証済み・保留・履歴は維持する。
- 共通基盤はstore限定purchase themeとaccount aliases。dashboard・API・DB・認可は対象外。

### 共通基盤

- Red: `DESIGN_SUITE=priority bun run test:design -- --grep 'account shell inherits'`。tokenを上書きしてもheadingが旧固定inkのままで失敗。初回listen EPERMは環境エラーでRedに含めず、sandbox外で再実行して確認。
- Green/Refactor: profile shellで既存purchase themeをcomposeし、account ink/muted/gold/accent/line/panel/selected/focus/状態色を役割で接続。既存profile bodyの面もaliasesへ統一。認可や子ページの機能契約は不変。
- 基盤検証: 関連Jest197/197（18 suites）、tsc exit0、lint0 errors/既存8 warnings。新テストはCSS文字列ではなくheading/操作の計算済み配色を検証。色schemeの重複定義はRefactorで除去。
- Refactor後補助Chromium10/10（既存9状態＋継承1）、3幅・axe AA違反0・overflowなし。harness/diff check成功。共通基盤はDS-BASE-001のstore/account subsetのみ。

### Step 1 比較（DS-PAGE-009）

- Red: `priority --grep 'compare tokens'`。priceが共通link tokenを継承せず旧固定色で失敗。Green: CSS Moduleでtheme合成、価格/card/hero/操作/focusをtokensへ接続。共通ProductPriceのロジックは不変。
- 既存最大4件・個別削除/clear・empty/loading/error/retry/unavailable・古い応答の無視は回帰確認。
- Refactor後: 補助Chromium4/4（1440/768/700/390px）、axe AA違反0・overflowなし・狭幅の局所ArrowRight操作、Jest26/26、tsc exit0、lint0 errors/既存8 warnings。画像はtest-results/design/priorityの画面別outputへ保存。

### Step 2 Wishlist（DS-PAGE-033）

- Red: `priority --grep 'wishlist tokens'`、番号リンクの実寸36pxで44px条件に失敗。Green/Refactor: 最小幅44pxとaccount aliases、状態/見出し/罫線/hover/focusを統一。fixtureは本番page/loadingをimportし、既存serverのprofile query adapterで通常/空/失敗を供給。URLが変わった後もWishlistを描画する。
- 既存検証済み履歴は維持。今回認証後実ルートは専用E2E_DATABASE_URL不在で保留（Clerkキーあり、Docker socketあり。DB初期化は行わない）。
- Refactor後: 補助Chromium4/4（1440/768/480/390px）、Jest7/7、tsc exit0、lint0 errors/既存8 warnings。axe AA違反0・overflowなし・URL/back/current/empty/error/loadingと390px画像目視を確認。

### Step 3 フォロー店舗（DS-PAGE-022）

- Red: `priority --grep 'following tokens'`、番号リンクの実寸36pxで44px条件に失敗。Green/Refactor: shared discoveryの番号操作・heading/card/actions/feedbackをaccount aliasesへ接続。色だけでfollow/成功/失敗を表さずaria-pressed/status/alertを維持。
- 閲覧履歴の共通ページャー・URL・back/forward・商品操作への影響も回帰検証。認証後実ルート保留は継続。
- Refactor後: 補助Chromium10/10（フォロー既存3/新4・履歴既存3）、Jest10/10、tsc exit0、lint0 errors/既存8 warnings、3幅＋480px境界・axe AA違反0・overflowなし・390px画像目視。

### Step 4 閲覧履歴（DS-PAGE-024）

- Red: `priority --grep 'history tokens'`、失敗パネルがshared panel tokenを継承せず旧固定面で失敗。Green: empty/error/retry/loadingをaccount aliasesへ接続。Refactor: browser操作領域helperはnavigationの描画を待ち、未描画時の空ループで誤成功しないよう修正。
- 保存順/不正storage/アクセス不可/古い応答/範囲補正は既存RTL、URL/backとcompare/follow状態は補助ブラウザーで回帰。認証後実ルート保留を継続。
- Refactor後: 補助Chromium10/10（履歴既存3/新4・フォロー既存3）、Jest10/10、tsc exit0、lint0 errors/既存8 warnings。1440/768/480/390px、axe AA違反0・overflowなし、390px画像目視。

### Step 5 通知（DS-PAGE-067／DS-COMP-239）

- Red: RTL2件（取得失敗にh1/名前付きsectionがない、一括既読pendingにstatusがない）、browser1件（通知listがpanel tokenを継承しない）。Green: 失敗時の見出しとcursor reload、常設status・aria-busy、Read/Unread文字、panel/focus/44px操作。
- Refactor: 同一moduleのNotificationHeadingで成功/失敗の見出しを集約、cursorを一度だけ正規化。既読化の既存楽観/非楽観更新とリンク遷移は維持。新しいServer Action/APIは追加しない。
- 補助Chromium7/7（既存3＋継承1＋新状態3）、関連Jest26/26、tsc exit0、lint0 errors/既存8 warnings。1440/768/390px、pending/error/retry/success、リンクなし/空cursor/取得失敗、axe AA違反0・overflowなし・390px画像目視。
- 新しい[画面要件](../profile-notifications/requirements.md)・設計/tasks/進捗を追加し、基盤設計から参照。認証後実ルートは専用DB不在で保留。

### Step 6 設定（DS-PAGE-032）

- Red: RTL1件（appearanceが旧固定値）、browser1件（primary token上書きが操作の計算済み色に反映されない）。Green: settings root/appearanceをpurchase themeへ統一。Refactor: 型付きmodalContentにPortal専用themeを合成し、埋め込みrootから独立した描画でもtokensを供給。
- 既存seven fixtureのUserProfile adapterがproduction appearance/hashを受け取り、入力/操作/danger/別rootのPortal sampleを描画する。実SDK機能はmockであり受け入れ証明に含めない。hash/認可/webhook/securityの契約は不変。
- Refactor後: settings補助Chromium7/7（1440/768/767/390px・embedded/Portal）、関連Jest11/11、tsc exit0、lint0 errors/既存8 warnings。axe AA違反0・overflowなし、390px画像目視。認証後実ルート/実Clerkは保留を継続。

### 最終統合と仕様同期（2026-10-09）

設定Portalのreduced-motion漏れを追加TDDで検出。先行390pxテストでanimation-nameがpulseとなりRed、root/Portalの共通抑制へ修正後settings7/7でGreen。PC/モバイルの画像とcomputed style、axe、focus、溢れを確認。

全体Jest3077 passed/3080 total、3 skipped、318 suites（317 passed/1 skipped）、127 snapshots。Statements87.84%（10745/12232）／Branches78.05%（6578/8427）／Functions84.12%（2098/2494）／Lines88.34%（9780/11070）。priority全29/29＋settings7/7＝補助Chromium36/36。tsc0、Lint0errors/既存8warnings、check:playwright成功。dashboard393files/400lcov/18of80（23%）。

[要求](../../../specs/multi-vendor-ecommerce/01-requirements.md)・[品質](../../../specs/multi-vendor-ecommerce/06-quality.md)・[テスト仕様](../../../specs/multi-vendor-ecommerce/07-testing.md)、画面別仕様、QA、coverage報告、テスト計画/設計、全体進捗を同期。architecture/data-model/interfaces/workflowsはAPI・DB・認可・業務遷移に変更がないため維持。台帳は67画面/242部品のIDと分類を維持し、fixture成功だけで全画面受け入れ状態を更新しない。

専用E2E_DATABASE_URLは未設定、Clerkキーは存在を確認（値は非出力）。認証後実ルート/実Clerkは[QA解除条件](../../testing/QA_HANDOFF.md#ds-p2-residual-browser)まで保留。Integration/フルE2Eは今回未実行。

| 段階 | commit |
|---|---|
| 計画 | 3821597d |
| 共通基盤 | 60b39545 |
| 比較 | 8d933bf8 |
| Wishlist | 168e6b7d |
| フォロー店舗 | 5bc71aa9 |
| 閲覧履歴 | 68d3addd |
| 通知 | adc85009 |
| 設定 | 042d5518 |
| 最終同期 | 本記録とPortal抑制修正のコミット |


## 監査指摘6画面移行記録

2026-10-09。[保存計画](../../../plans/layout-design/priority-six-audit-remediation-design-system-plan.md)。DS-PAGE-006/017/019/041/040/039の実装・関連検証・文書同期を完了。既存画面全体の判定・保留と今回の修正範囲を区別する。

### Step 1 商品一覧

DS-PAGE-006: editorialページャとCollection pages名を適用。Red: 新RTL1件はnavigation欠如、browser3幅は高さ27pxで失敗。Green/Refactor: 関連RTL12/12、purchase audit browse3/3、tsc成功。検索/複数size/属性/sort保持、44px、hover濃金、focus、axe AA、横溢れなし、390px画像目視を確認。listen EPERMは環境エラーとして除外し、許可済み実行で再検証。公開実ルートは最終検証で確認するため画面全体判定は維持。

確認したSDD overview/data-modelは業務範囲/DBを変えないため変更不要。requirements/interfaces/quality/testingの既存契約を保持する。

### Step 2 ホーム

DS-PAGE-017: motion切替にmin-height/min-width44px。Red: 1440/768幅38px、390幅32pxで先行browser3件失敗。Green/Refactor: browser3/3、既存motion RTL11/11回帰。設定reduceでdisabled、設定変更後Pause/Resume・aria-pressed・focus・axe AA・横溢れを確認。新機能のRTL Redは創作しない。機能/URL/APIは維持。

### Step 3 商品詳細

DS-PAGE-019: category/評価/follow/share/SKUを44pxに統一。Red: browser3幅のcategory36px、続いて実next-shareのinline outline:noneを検出。共有tile内のみfocus-visibleを補正。Green/Refactor: browser3/3、関連RTL26/26。コピー/評価/フォロー、カテゴリEscape、axe AA、横溢れなし、390px画像目視。fixture祖先の初期誤り（productBody不足）を直し、誤配置によるcontrast違反は実ページ不具合として数えない。

### Step 4 属性一覧・共通フォーム

DS-PAGE-041: SellerPage/DataTable seller、作成/編集Portal、native階層select、Action Props、送信中ロック/失敗保持/retry/status。Red: RTL3件（見出し/取得失敗/名前付きフォーム）、browser6件（h1欠如）。初回adapterのnotFound export不足はRedから除外。Green/Refactor: RTL28/28、browser6/6、tsc成功。1440/768/390×light/dark、検索/空/取得失敗、編集key不変、Escape focus復帰、pending中Escape禁止、失敗保持/retry、axe AAと画像目視。認証後ADMIN実受け入れは保留。新規routeへsaveActionを接続した変更は共通フォームの必須Propsへの追随であり、新規画面のレイアウト移行はStep5。

### Step 5 属性新規

DS-PAGE-040: SellerPageの名前付き見出しとカテゴリ取得失敗/Retryを適用。Red: RTL2件（h1/取得失敗）、browser6件（h1欠如）。Green/Refactor: 関連RTL14/14、browser6/6。1440/768/390×light/dark、未入力validation、ENUM/VARIANT/多値保持、送信中入力ロック、失敗保持/retry、成功statusと既存一覧遷移、axe AA・overflow・画像目視。認証後ADMIN実ルートは保留。

### Step 6 属性選択肢・操作寸法の最終補正

DS-PAGE-039: SellerPage/フォーム/表/編集Portalと型付きAttributeOptionActionsを適用。Red: RTL2件（名前付きregion/formと注入save）、browser6件（名前付きform欠如）。Green/Refactor: 属性関連+既存P4 RTL66/66、選択肢browser6/6。ENUM限定404、archived定義の追加非表示、value不変、連続追加後resetとsortOrder+1、pending入力/dismissロック、失敗保持/retry、archive、focus復帰、AA/overflowを確認。認証後ADMIN実ルートは未確認。

最終操作監査でcreate button40pxをRed確認し、属性scopeのみ44pxへ補正。MasterDialog/CustomModalは任意classNameを追加し、属性独立Portalへ専用CSSを渡す。他callerの既定は維持。隠しcheckbox input16pxは合否対象とせず、ラベル込み44pxを確認。touch regression1/1、tsc/Playwright構成チェック成功。全体検証と最終画像目視は下記へ追記する。

### 最終自己レビュー

| 対象 | 変更/状態 | 最終証跡 | 実ルート制約 |
|---|---|---|---|
| `DS-PAGE-006` | editorial pager・URL条件保持・44px/focus | purchaseの新3幅+既存回帰、公開実3幅 | 画面全体の他状態/共有callerは別 |
| `DS-PAGE-017` | motion44px・reduce/Pause/Resume保持 | purchaseの新3幅+既存回帰、公開実3幅 | 実WebGL/全データ状態は別 |
| `DS-PAGE-019` | category/review/follow/share/SKU44px、SDK focus | purchaseの新3幅・RTL26、公開実3幅 | 認証後follow/外部共有送信は未実行 |
| `DS-PAGE-041` | heading/table/form/Portal/light-dark/Action Props | 新browser6ケース、属性RTL56 | 認証後ADMIN実ルート保留 |
| `DS-PAGE-040` | heading/validation/pending/error/retry/success | 新browser6ケース、属性RTL56 | 認証後ADMIN実ルート保留 |
| `DS-PAGE-039` | ENUM/archived/immutable value/reset/table/edit | 新browser6ケース、属性RTL56 | 認証後ADMIN実ルート保留 |

Refactor後: 属性+既存P4 RTL66/66、既存P4を含む全browser56/56、購入共通browser53/53。追加touch/surface回帰1/1でbutton/input/select/close44px、checkbox label44px、既存themeによる影なし/3pxを確認（後追加の影/丸み検査はRedとして数えない）。管理者3幅×light/dark・初期/空/検索/validation/pending/error/retry/success/編集・focus/Escape復帰・axe AA（contrast除外なし）、公開fixture全幅と公開実3画面×3幅を確認。最終p4の390px newattribute light/options dark画像と公開実商品詳細390pxを目視。新規propsへの追随以外のDB/query/認可/業務・計算変更なし。

SDD overview/data-modelは範囲・DB変更がないため更新不要、他SDD/画面要件/設計/tasksを同期。認証後ADMIN実受け入れはstorageState未提供で保留。解除条件: 検証用ADMINログイン状態とschema-currentテストDBで3実ルート（light/dark・操作・実Portal）を確認。fixtureで業務操作を検証し、既存DBへ検証用保存を行っていない。

最終全体検証: `bun run test -- --runInBand --json --outputFile=/tmp/ds-remediation-jest.json`は3091/3094、3skip、319 suites（318pass/1skip）、127 snapshots。`DESIGN_SUITE=purchase bun run test:design`53/53、`DESIGN_SUITE=p4 bun run test:design`56/56、後追加surface回帰1/1。`DATABASE_URL=<既存local dev DB> DESIGN_AUDIT_INVENTORY=/tmp/ds-remediation-route-inventory.json DESIGN_SUITE=purchase-public bun run test:design -- --grep 'audit public'`3/3（実3画面×3幅）。

`bunx tsc --noEmit`/`bun run lint`/`bun run check:playwright`成功、lint既存warning8。sandbox内buildはcompile段階で進まず、自分で起動したprocessのみ停止（exit143）してsandbox外で同じ`bun run build`を再実行し成功。Next devのtsconfig include追加は検証副作用として元のincludeへ戻した。全体coverage/Integrationは未再測定で過去値を保持する。

`bun run coverage:dashboard`で395 test files / 400 LCOV entries / 18/80（23%）を再生成。LCOVは既存スナップショットを使用し、coverage率は再測定していない。文書の相対リンクと台帳IDの重複・件数を確認。


## 購入後P2 6画面移行記録

2026-10-10。[保存計画](../../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md)。既存全画面判定は保持し、今回の変更受け入れを別記する。

### Step 1: DS-PAGE-028 orders

Red: supportの色が固定117/97/59で注入96/74/43へ追従せず失敗。Green/Refactor: postpurchase --grep orders 4/4（1440/768/390px、axe AA、pending/error/retry/empty/paging/focus）；RTL orders-table 10/10；tsc成功。仕様・設計・タスク・進捗を同期。認証後実ルートは保留（保存状態なし、既存helperはアカウント作成/削除を伴う）。解除条件は既存顧客のテストログイン状態。API/DB/認可/業務仕様は変更なし。

### Step 2: DS-PAGE-030 payment

Red: supportの固定色が注入したlinkへ追従せず失敗。Green/Refactor: postpurchase --grep payment 4/4（3幅、axe AA、empty/pending/error/retry/paging/focus）；RTL payments-table 10/10。仕様・設計・タスク・進捗を同期。認証後実ルートは保留（保存状態なし、既存helperはアカウント作成/削除を伴う）。解除条件は既存顧客のテストログイン状態。API/DB/認可/業務仕様は変更なし。

### Step 3: DS-PAGE-021 addresses

Red: 独立Dialogの固定背景250/248/242が注入panel255/253/247へ追従せず失敗。Green/Refactor: postpurchase --grep addresses 4/4（3幅、axe AA、validation/save pending/failure/retry/success/default/focus復帰）；RTL profile-addresses 11/11；tsc/check:playwright成功。仕様・設計・タスク・進捗を同期。認証後実ルートは保留（保存状態なし、既存helperはアカウント作成/削除を伴う）。解除条件は既存顧客のテストログイン状態。API/DB/認可/業務仕様は変更なし。

### Step 4: DS-PAGE-031 reviews

Red: supportの固定色が注入linkへ追従せず失敗。Green/Refactor: postpurchase --grep reviews 4/4（3幅、axe AA、写真/小数評価/長文、empty/pending/error/retry/paging/focus）；RTL reviews-container 11/11。仕様・設計・タスク・進捗を同期。認証後実ルートは保留（保存状態なし、既存helperはアカウント作成/削除を伴う）。解除条件は既存顧客のテストログイン状態。API/DB/認可/業務仕様は変更なし。

### Step 5: DS-PAGE-026 messages

Red: 購入者supportのmessage固定色が注入linkへ追従せず失敗。Green/Refactor: postpurchase --grep messages 4/4（3幅、axe AA、thread failure/retry、長文、send pending/failure/draft保持/success、empty/list retry）；購入者と販売者RTL4 suites 31/31；tsc成功。仕様・設計・タスク・進捗を同期。認証後実ルートは保留（保存状態なし、既存helperはアカウント作成/削除を伴う）。解除条件は既存顧客のテストログイン状態。API/DB/認可/業務仕様は変更なし。

### Step 6: DS-PAGE-029 overview

Red: 取得失敗時のReload accountのmin-heightが0pxでtouch52pxに追従せず失敗（通常表示の既存token接続は回帰確認）。Green/Refactor: postpurchase --grep overview 4/4（3幅、axe AA、長い氏名、未提供機能、URL/Enter/focus、error）；概要/sidebar/layout RTL3 suites 16/16。仕様・設計・タスク・進捗を同期。認証後実ルートは保留（保存状態なし、既存helperはアカウント作成/削除を伴う）。解除条件は既存顧客のテストログイン状態。API/DB/認可/業務仕様は変更なし。
