# 全実画面デザインシステム再監査（2026-10-09）

## 結論の読み方

全67 page.tsxと台帳は一致。画面本体60定義（うち仮実装1）と転送専用7定義。旧デザイン残存数、ソース上の未完了数、実画面未確認数は別々に扱う。前回の42画面は台帳の未完了集計であり、旧デザイン残存の確定数ではない。

今回は既存ローカルDBを読み取り、既存Next実ルートをChromiumの1440/390pxで開く。fixtureは使用しない。認証を迂回しない。顧客/販売者/管理者の保存済みログイン状態は見つからず、利用可能なテスト認証情報をユーザーへ照会した。認証後の本体を表示できるまで全実画面監査完了とは扱わない。

## 全体構成

| 領域 | 画面定義 | 認証条件 |
|---|---:|---|
| 公開・未ログイン表示（認証画面/出店申請のguest分岐を含む） | 20 | guest |
| マイページ | 12 | 顧客 |
| checkout・注文詳細 | 2 | 顧客・所有権 |
| 管理者 | 12 | ADMIN |
| 販売者 | 14 | SELLER・店舗所有権。仮実装1を含む |
| 転送専用 | 7 | 転送先と認証条件に従う |
| 合計 | 67 | 画面本体60、機能を持つ本体59 |

## ソースで確定した残作業

| 対象 | 根拠 | 残る内容 |
|---|---|---|
| 属性一覧（DS-PAGE-041） | admin layoutはSellerShell。DataTableはdesign指定なし、AttributeDetailsは従来Card | 個別heading/toolbar/44px/focus、編集modalの独立Portal theme、Action Props、状態/狭幅/light-dark検証 |
| 属性新規（DS-PAGE-040） | rootはw-fullと従来AttributeDetails。親shellの色を継承 | SellerPage/Formの個別適用、カテゴリ階層/型/validation保持、送信中/エラーの表示検証 |
| 属性選択肢（DS-PAGE-039） | text-2xl/font-bold、従来AttributeOptionDetails、DataTable designなし | 見出し/フォーム/表/操作の統一、ENUM/アーカイブ/編集状態の保持 |
| 販売者店舗一覧（DS-PAGE-066） | page.tsxはSellerStoresPageという文字列のみ | 機能範囲・導線を決める。デザイン適用だけでは完成できない |

属性3画面を「何も適用されていない」とする従来分類は粗い。親のテーマは適用されているが個別UIとPortalは未完了。ここでの3はソース根拠のある個別移行対象数であり、認証後全画面の目視による残存確定数ではない。

## 共通部品の全体像

台帳242部品は検証済み26、実装済み12、保留91、TODO113。未完了216は受け入れ・仕様同期・利用確認を含む項目数であり、216部品の再実装を意味しない。主要表示依存をページと祖先layoutから追跡した対象は408ソースファイル（import参照による閉包。全表示状態の到達証明ではない）。

- DS-BASE-001: purchase themeとseller themeは存在するが、global tokens/Portal/ライト・ダークの基盤全体受け入れは残る。
- DS-COMP-006〜018: 旧store操作部品とshadcn基本部品。既存のeditorial/seller/申請CSSで上書きされる場合があるので、呼び出し元ごとに監査する。旧色の文字列だけで全呼び出し画面を未移行にしない。
- DS-COMP-019〜025/102〜112: modal/dialog/popover/tooltip/toastなど。Portalは親からthemeを継承しないケースを確認する。
- 旧住所Modalのmin-width800pxは残っているが、address.list→address-card→Modalの上流参照は見つからない。現checkoutは別の新AddressForm/Dialogを使う。未使用の旧部品として確認し、現checkoutの移行漏れへ加算しない。
- 属性フォームと列・操作、商品レビューの入力/アップロード、通知バッジ、メッセージ、印刷PDFなどは表示条件ごとの確認が必要。
- TODO113の内訳: 旧部品利用確認20、通知/状態17、業務フォーム15、基本操作13、商品詳細11、表の列/操作11、ページング8、modal6、カード6、メッセージ2、dashboard共通2、静的1、印刷1。

## 監査手順と再実行

[保存計画](../../../plans/layout-design/full-route-design-system-reaudit-plan.md)。既存playwright.design.config.tsにfull-route-audit（route、3129）を追加し、tests/browser/full-route-audit-design.spec.tsで測定。新規fixture/configなし。

```sh
# inventory とdevサーバーで同じDBを使う（configはDATABASE_URLを固定しない）
export DATABASE_URL=postgresql://dev:dev@localhost:5432/multivendor_dev
bun scripts/design/prepare-route-audit.ts /tmp/design-audit-inventory.json
DESIGN_AUDIT_INVENTORY=/tmp/design-audit-inventory.json DESIGN_SUITE=full-route-audit bun run test:design
```

識別子は既存DBの実在レコードから取得する。入力manifestはログイン情報を含まない。アカウント作成、seed、migration、DB更新、購入、問い合わせ送信、アカウント削除は実行しない。Next devのtsconfig include追記は実行後に戻す。ブラウザーspecの成功は全ルートの測定完了を意味し、全画面のデザイン合格を意味しない。

今回の追加は監査と文書。UI/API/DB/機能仕様は変更しない。新機能のTDD Red実績は作らない。全体Jest/coverageの以前の実測を維持する。

## 実表示の結果と残り画面数

67ルート×PC/モバイルの134到達記録を収集（収集spec 1件成功、18.3分）。公開20画面の40画像を目視確認。補足spec 2件成功（2.4分）で、Clerk待機後4画像、共通開閉6状態、公開操作寸法40記録を確認した。成功は測定処理の完走であり、デザイン合格ではない。

**現在、修正対象と判明している機能画面は6画面**（実表示の操作不足3＋ソース上の属性部分移行3）。別に仮実装1画面。認証後の機能画面39は実表示未確認で、その中に属性3画面を含む。したがって6＋39という足し算はしない。残りの確定総数は、認証後監査が終わるまで出せない。

| 区分 | 数 | 根拠・限界 |
|---|---:|---|
| 公開初期表示で新テーマを確認、今回の寸法検査で指摘なし | 17 | 全状態/axe/light-darkの受け入れ完了ではない |
| 公開初期表示で修正箇所を確認 | 3 | browse・home・商品詳細。画面全体が旧UIという意味ではない |
| 認証後の機能画面本体未確認 | 39 | ソース上は本体適用36、個別部分移行3 |
| 仮実装 | 1 | seller/stores。本体実表示も未確認 |
| 転送専用 | 7 | 機能画面数へ加算しない |
| 合計 | 67 | 公開20＋保護40＋転送7 |

### 実表示で確認した3画面

- DS-PAGE-006 `/browse`: ページ番号の幅22.6〜25.1px・高さ27px、前後ボタン高さ36px。PC/モバイルともhoverが `rgb(253, 56, 79)`。BrowsePaginationが旧Pagination既定分岐を使用。新テーマの44px操作と色へ移行が必要（DS-COMP-057/058）。
- DS-PAGE-017 `/`: reduced-motionの表示切替buttonはPC高さ38px、モバイル32px。新テーマは表示済みだが44px操作条件を満たさない。旧デザイン残存とは別の受け入れ不足。
- DS-PAGE-019 商品詳細: モバイルカテゴリbutton36×36px、評価button40×44px、follow高さ42px、share高さ41〜43px。SKUコピー操作高さ15pxも要確認。新テーマの購入枠は表示済みだが周辺操作の44px条件が残る。小さいnative checkboxはlabelを含む操作領域の再測定が必要で、単体寸法だけでは不合格へ加算しない。

Clerkログイン・登録は20秒以内の表示待機後、PC/モバイルで新appearance適用を目視確認。ログイン成功・アカウント管理・認証エラー状態は未検証。ヘッダーのaccount/search/menu開閉6状態に横溢れなし。初回133到達完了記録にも横溢れなし。

注文詳細DS-PAGE-003は未認証でHTTP500（Unauthenticated）となり、本体未確認。管理offer-tags DS-PAGE-047のモバイルはnavigation timeout1件。これを旧UI数へ加算せず、認証取得後の再到達項目とする。商品画像placeholderは既存DBのデータ条件。画面の全状態が揃っている証明にはならない。

### 残タスクの順序

1. 顧客・SELLER・ADMINのテストログイン状態を取得し、39機能画面＋仮実装1を認証後に監査。既存DBは読取可能。利用可能なログイン状態が必要で、認証を迂回して合格にはしない。
2. 公開3画面の操作を修正。browseの旧Paginationを優先し、homeの切替と商品詳細の周辺操作を44pxへ統一。変更時は既存specへTDD回帰を追加する。
3. 属性3画面の個別フォーム/表/heading/Portalを移行し、Action Props・validation・ENUM/アーカイブ等の機能を維持する。
4. 共通部品216未完了項目を「実利用・実装・表示状態・受け入れ・未使用」に仕分け、global tokens/独立Portal/状態表示を呼び出し元で確認。216を再実装件数と扱わない。
5. seller/storesの仮実装1は、機能化するか導線を整理するか仕様を決める。
6. 通常/空/エラー/送信中、1440/768/390px、light/dark、focus/keyboard/axe、関連仕様同期を確認して台帳を検証済みへ更新する。

即時TODOの正本は[QA_HANDOFF](../../testing/QA_HANDOFF.md)。上記は監査で明らかになった作業範囲と依存順を示す。

## 全67ルートの記録

[機械可読JSON](full-route-reaudit-2026-10-09.json)にPC/モバイル到達結果、ソース判定、依存数を保存。URL内の私有注文識別子は保存しない。スクリーンショットと詳細測定JSONは `test-results/design/full-route-audit/` 配下（git対象外）。下表の公開確認は初期表示の確認のみ。

| ID | ルート | ソース判定 | 実表示判定 |
|---|---|---|---|
| DS-PAGE-001 | `/sign-in` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-002 | `/sign-up` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-003 | `/order/[orderId]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-004 | `/seller/apply` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-005 | `/about` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-006 | `/browse` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認・操作寸法不足 |
| DS-PAGE-007 | `/cart` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-008 | `/checkout` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-009 | `/compare` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-010 | `/contact` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-011 | `/customer-service` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-012 | `/dispute` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-013 | `/faq` | 転送専用 | 転送専用 |
| DS-PAGE-014 | `/faqs` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-015 | `/legal` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-016 | `/offers` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-017 | `/` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認・操作寸法不足 |
| DS-PAGE-018 | `/product-support` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-019 | `/product/[productSlug]/[variantSlug]` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認・操作寸法不足 |
| DS-PAGE-020 | `/product/[productSlug]` | 転送専用 | 転送専用 |
| DS-PAGE-021 | `/profile/addresses` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-022 | `/profile/following/[page]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-023 | `/profile/following` | 転送専用 | 転送専用 |
| DS-PAGE-024 | `/profile/history/[page]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-025 | `/profile/history` | 転送専用 | 転送専用 |
| DS-PAGE-026 | `/profile/messages` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-027 | `/profile/orders/[filter]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-028 | `/profile/orders` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-029 | `/profile` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-030 | `/profile/payment` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-031 | `/profile/reviews` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-032 | `/profile/settings` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-033 | `/profile/wishlist/[page]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-034 | `/profile/wishlist` | 転送専用 | 転送専用 |
| DS-PAGE-035 | `/report-problem` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-036 | `/returns-exchange` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-037 | `/store/[storeUrl]` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-038 | `/track-order` | 本体適用（受け入れ未完了を含む） | 公開初期表示確認 |
| DS-PAGE-039 | `/dashboard/admin/attributes/[id]/options` | 親枠適用・個別UI部分移行 | 認証後本体未確認 |
| DS-PAGE-040 | `/dashboard/admin/attributes/new` | 親枠適用・個別UI部分移行 | 認証後本体未確認 |
| DS-PAGE-041 | `/dashboard/admin/attributes` | 親枠適用・個別UI部分移行 | 認証後本体未確認 |
| DS-PAGE-042 | `/dashboard/admin/categories/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-043 | `/dashboard/admin/categories` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-044 | `/dashboard/admin/coupons/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-045 | `/dashboard/admin/coupons` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-046 | `/dashboard/admin/offer-tags/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-047 | `/dashboard/admin/offer-tags` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-048 | `/dashboard/admin/orders` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-049 | `/dashboard/admin` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-050 | `/dashboard/admin/stores` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-051 | `/dashboard` | 転送専用 | 転送専用 |
| DS-PAGE-052 | `/dashboard/seller` | 転送専用 | 転送専用 |
| DS-PAGE-053 | `/dashboard/seller/stores/[storeUrl]/coupons/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-054 | `/dashboard/seller/stores/[storeUrl]/coupons` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-055 | `/dashboard/seller/stores/[storeUrl]/inventory` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-056 | `/dashboard/seller/stores/[storeUrl]/messages` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-057 | `/dashboard/seller/stores/[storeUrl]/orders` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-058 | `/dashboard/seller/stores/[storeUrl]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-059 | `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-060 | `/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-061 | `/dashboard/seller/stores/[storeUrl]/products/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-062 | `/dashboard/seller/stores/[storeUrl]/products` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-063 | `/dashboard/seller/stores/[storeUrl]/settings` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-064 | `/dashboard/seller/stores/[storeUrl]/shipping` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-065 | `/dashboard/seller/stores/new` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |
| DS-PAGE-066 | `/dashboard/seller/stores` | 仮実装 | 仮実装・本体未表示 |
| DS-PAGE-067 | `/profile/notifications` | 本体適用（受け入れ未完了を含む） | 認証後本体未確認 |

## 今回の検証

収集spec1件・補足spec2件成功。TypeScriptエラー0、監査helper/spec/configのESLintエラー0、check:playwright成功、追加TS2ファイルのPrettier成功、git diff --check成功。67ページID・242部品ID・134到達記録・追加監査リンクを照合。認証後本体、全表示状態、768px/light-dark/axeは未実施。UIは修正せず、監査コード・計画・仕様/進捗/QA文書を更新。コミットは行っていない。
