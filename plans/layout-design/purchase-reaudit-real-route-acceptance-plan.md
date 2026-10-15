# 購入再監査8（DS-PURCHASE-REAUDIT-EIGHT-ROUTES）保留解除計画

## Context

2026-10-14 の購入再監査8画面（DS-PAGE-006/037/019/007/008/003/009/033）は、実データ・認証後・実決済SDKでの受け入れが保留になっている。理由は「専用DB `multivendor_e2e` へ P1001」。

調査の結果、DB が無くなったのではなく、**Docker の `multivendor-postgres-dev` コンテナが停止していた**だけと判明した（`docker ps -a` は空、volume `multi-vendor-e-commerce_postgres-dev-data` は残っている）。同じ DB で 2026-10-13/14 の p3-residual / admin-master の実ルート 54/54・48/48 が通っているため、コンテナを起動すれば解除できる見込み。

ユーザー決定:
- DB コンテナの起動: 可（db サービスのみ。volume を再利用し、`down -v` や初期化はしない）
- 書き込み: **書き込み系も実施する**（prepare 投入、注文確定、クーポン適用、Stripe テストカード決済を含めて purchase-route を全件実行）
- 管理マスタ8の対象外項目と DS-PAGE-046: **今回は対象外**（記録は既存の保留のまま残す）

## 手順

### 0. 計画の保存（rule 04）
本計画を `plans/layout-design/purchase-reaudit-real-route-acceptance-plan.md` として保存し、既存の [priority-eight-purchase-reaudit 計画](plans/layout-design/priority-eight-purchase-reaudit-design-system-plan.md) と QA_HANDOFF の該当節からリンクする。

### 1. 環境の復旧（読み取り確認）
- `docker compose up -d db`（app は起動しない。:3000 の `.next` 共有を避ける）
- `docker exec multivendor-postgres-dev psql -U <user> -lqt` で `multivendor_e2e` があるか確認する。`_prisma_migrations` の件数を、`prisma/migrations/` の数（27 想定）と照合する。
- 不足している場合は `bunx prisma migrate deploy` を専用DBにだけ適用する（DB変数3つを同値で渡し、`multivendor_dev` と Neon には触れない）。DB が存在しない場合は作業を止めて報告する（初期化はしない）。
- 前提を確認する: `CLERK_SECRET_KEY` が `sk_test_` であること、Stripe キーが有効であること（`curl -u $STRIPE_SECRET_KEY: .../v1/balance`、値は出力しない）、Chrome channel。

### 2. 実ルートの assertion を補強（今回の改修点を実データで確認するため）
既存の実ルート spec には、今回の 5 つの修正点を見る assertion が無い。fixture 側の判定ヘルパー（`tests/browser/purchase-assertions.ts`、`seller-residual-assertions.ts` の `expectBoundaryContrast`）を再利用して追加する。
- `tests/browser/purchase-public-design.spec.ts`（inventory 駆動・読み取り）:
  - browse の sort 境界 3:1 と、並び替え後の URL 保持
  - 商品詳細の画像 modal: 初期 focus、Escape で focus が戻ること
  - store 詳細の sort
  - compare の hero 導線（Home/Continue が 44px）。実商品を並べた状態で確認する
- `tests/browser/purchase-route-design.spec.ts`（認証後）:
  - 実商品が入ったカートで、短い商品名リンクが 44px 以上であること
  - Wishlist の current ページ hover 境界が 3:1 であること
- 追加後は `bun run check:playwright` を通す。config と fixture server は新設しない。

### 3. 実行（1440/768/390 × light/dark）
```bash
# 公開（読み取り）
bun scripts/design/prepare-route-audit.ts <scratch>/inventory.json
DESIGN_SUITE=purchase-public DESIGN_BROWSER_CHANNEL=chrome DESIGN_AUDIT_INVENTORY=<inventory.json> \
  E2E_DATABASE_URL=… DATABASE_URL=… DIRECT_URL=… bun run test:design
# 認証後（書き込みあり。実行ごとに再準備）
bun scripts/design/prepare-purchase-route.ts <scratch>/purchase.json
DESIGN_SUITE=purchase-route DESIGN_BROWSER_CHANNEL=chrome DESIGN_PURCHASE_ROUTE=<purchase.json> \
  DESIGN_STRIPE_READY=1 … bun run test:design
```
- PayPal sandbox の購入者承認は、`PAYPAL_SANDBOX_BUYER_*` が無ければ skip される。これは別の保留として残す。
- 実行後に `tsconfig.json` の include 追記を戻し、db コンテナを停止する（`docker compose stop db`、volume は残す）。
- 失敗したら、製品の不具合か環境の問題かを切り分ける。製品の不具合なら TDD（Red → 修正）で別コミットにする。環境エラーは Red として数えない。

### 4. 文書の同期（検証が通ったものだけ）
- `docs/design/design-system/PROGRESS.md`: 購入再監査8に実ルート受け入れ節を追加する（件数、幅、テーマ、axe、スクリーンショットの保存先）。過去の判定履歴は書き換えない。
- `docs/testing/QA_HANDOFF.md`: DS-PURCHASE-REAUDIT-EIGHT-ROUTES を「解除」に更新し、原因（コンテナ停止）と復旧手順を 1 行で残す。管理マスタの対象外項目、DS-PAGE-046、PayPal sandbox 承認の保留は残す。
- 計画ファイルの完了記録を書く。spec の追加でブラウザーテストの件数だけが変わる場合でも、Jest の統計が変わらないことを確認したうえで記録する。
- メモリ `e2e-seller-real-route-prereqs` に「P1001 はまずコンテナ停止を疑う（`docker compose up -d db`）」を追記する。

## Critical files
- `tests/browser/purchase-public-design.spec.ts`, `tests/browser/purchase-route-design.spec.ts`, `tests/browser/purchase-assertions.ts`
- `scripts/design/prepare-purchase-route.ts`, `scripts/design/prepare-route-audit.ts`（変更しない。そのまま使う）
- `docs/design/design-system/PROGRESS.md`, `docs/testing/QA_HANDOFF.md`, `plans/layout-design/…`

## Verification
- purchase-public / purchase-route がすべて pass すること（PayPal 承認の skip は除く）。axe 違反 0、page error 0。
- `bun run check:playwright`、`bunx tsc --noEmit`、`bun run lint`、`git diff --check` が成功すること。
- 3 幅のスクリーンショットを目視で確認する（商品が実際に表示されていること）。
- コミットは依頼があった場合のみ行う（spec の補強、製品修正、文書同期は別コミット）。

## 完了記録（2026-10-15）

- `purchase-public` 27/27、`purchase-route` 12 passed / 1 skipped（PayPal sandbox 承認）。詳細は [PROGRESS](../../docs/design/design-system/PROGRESS.md#実データ認証後実sdk受け入れ2026-10-15-解除)。
- 計画からの差分: `prepare-route-audit.ts` は「変更しない」予定だったが、商品1件の店舗を拾い既存テストが失敗したため、店舗選択の順序だけを変更した。`account discovery` の flaky も修正した。画像 modal は実データ（全件プレースホルダー）で開けず、fixture/RTL に依拠する。
