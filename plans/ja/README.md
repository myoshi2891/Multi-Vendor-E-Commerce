# 実装プラン一覧

> 原本: [../README.md](../README.md)

**improve** スキル（deep 監査）により 2026-07-03、HEAD `f9752c0`（branch `dev`）を対象に生成。
各 executor は着手前にプランを最後まで読み、STOP 条件を遵守し、検証ゲートを実行し、完了後は下表の自分の行を更新すること。プランは**読み取り専用のアドバイザリ成果物**です — 監査自体はソースコードを一切変更していません。

- 監査の生データ: [`audit/findings-01〜08-*.md`](audit/)
- Vet 済み findings 表 + rejected リスト: [`audit/VETTED_FINDINGS.md`](audit/VETTED_FINDINGS.md)
- Recon の事実 / 規約 / 検証ベースライン: [`audit/recon.md`](audit/recon.md)
- セッション再開状態: [`ADVISOR_STATE.md`](ADVISOR_STATE.md)

## 実行順序とステータス

推奨順は優先度 → レバレッジの順。「Depends on」の記載がない限り、各プランは独立しています。

| プラン | タイトル | カテゴリ | 優先度 | Effort | Risk | Depends on | ステータス |
|------|-------|----------|----------|--------|------|------------|--------|
| [001](001-scope-order-item-status-to-owned-store.md) | `updateOrderItemStatus` を所有店舗にスコープ（クロスストア IDOR） | security | P1 | S | LOW | — | TODO |
| [002](002-allowlist-mutable-store-fields.md) | seller が編集可能な Store フィールドを allowlist 化（mass assignment） | security | P1 | S–M | LOW | — | TODO |
| [003](003-server-side-payment-and-address-trust.md) | Stripe の状態をサーバー側で導出・住所所有権を検証 | security | P1 | M | MED | — | TODO |
| [004](004-upgrade-clerk-nextjs-security.md) | `@clerk/nextjs` を CRITICAL 認証バイパス勧告の圏外へアップグレード | dependencies | P1 | S | LOW-MED | — | TODO |
| [005](005-cart-integrity-atomic-save-and-persist.md) | 原子的 `saveUserCart` + カート永続化の単一ソース化 | correctness | P2 | S | LOW | — | TODO |
| [006](006-place-order-double-submit-guard.md) | 「注文を確定」の二重送信ガード | correctness | P2 | S | LOW | — | TODO |
| [007](007-logging-consolidation-and-debug-cleanup.md) | `logError` ヘルパー; デバッグ `console.log` の除去; coupon ログの修正 | tech-debt | P3 | M | LOW | — | TODO |
| [008](008-remove-dead-search-copy-and-relocate-schema.md) | dead `search copy.tsx` を削除; インライン Zod スキーマを移動 | tech-debt | P3 | S | LOW | — | TODO |
| [009](009-query-hygiene-bound-store-orders-and-drop-dead-query.md) | `getStoreOrders` を有界化; 破棄されたブラウズクエリを除去 | perf | P3 | S | LOW | — | TODO |
| [010](010-unit-test-compute-shipping-total.md) | `computeShippingTotal`（配送料計算 SSOT）のユニットテスト | tests | P3 | S | LOW | — | TODO |
| [011](011-onboarding-docs-env-and-stale-plan.md) | stale な画面ドキュメントの退役; env ドキュメント補完; `.env.example` 追加 | docs | P3 | S | LOW | — | TODO |
| [012](012-spike-item-level-inventory-restock.md) | **Spike**: 在庫復元をアイテムレベルの status 遷移まで拡張 | direction | P3 | M | MED | — | TODO |

ステータス値: `TODO` | `IN PROGRESS` | `DONE` | `BLOCKED`（一言で理由） | `REJECTED`（一言で根拠）。

## 推奨実行順

1. **セキュリティ最優先（001–004）** — 最高優先度。001/002/004 は S-effort・LOW-risk の即効性ある修正、003 はより重い MED-risk の決済信頼修正。これらは独立しており executor 間で並列実行可能。
2. **正確性（005, 006）** — ユーザー影響のあるデータ損失/二重注文バグ。小規模かつ安全。
3. **技術的負債 + 衛生（007, 008, 009）** — 008/009 は自明、007 は共有 `logError` の受け皿を導入（先送りされている約90箇所のログ移行の前に実施）。
4. **テスト（010）** — 純粋な追加カバレッジ。いつでも実施可。
5. **ドキュメント（011）** — ドキュメントのみ。いつでも実施可。
6. **Direction spike（012）** — 設計文書 + 後続の実装プラン（`plans/013-*`）を生成。order/restock コードに触れるため、正確性修正の後に実施。

## 依存関係の注記

- プラン間にハードなコード依存はなし。ソフトな順序のみ:
  - 007 は、名指ししている先送り中の一括ログ移行より先に着地させるべき（全箇所が `logError` へ収束するように）。
  - 012（spike）は `plans/013-implement-item-level-restock.md` を生成する。013 は 012 の設計判断が承認された後にのみ実行すること。
  - 003 と 006 はどちらも checkout/order フローに触れる — 並行実行する場合は `src/queries/user.ts` のマージ重複を確認（003 は住所チェックを追加、006 は `user.ts` に触れないため重複は最小限）。

## 先送り（意味のある finding だが今回はプラン化せず）

[`audit/VETTED_FINDINGS.md`](audit/VETTED_FINDINGS.md) に記録済み。今後のラウンドまたは `execute`/追加プランの候補:

- **DEPS-04** Prisma 5.22 → 6.x メジャーアップグレード（spike; フルテキスト検索 + Accelerate revalidation）。
- **PERF-01** cart/checkout の per-item N+1（product/shipping/country lookup をバッチ化）— MED risk、金銭クリティカル。
- **PERF-05** 参照データ（categories/countries/offer tags）を `unstable_cache`/Accelerate でキャッシュ。
- **CORRECTNESS-01** Stripe `charge.refunded` webhook の相関（`paymentIntentId` で相関）。
- **CORRECTNESS-05** `PaymentDetails.amount` の単位不一致（Stripe cents vs PayPal dollars）— バックフィルが必要。
- **TESTS-05** `placeOrder` のオーバーセルロールバック分岐の統合テスト（testcontainers）。
- **DX-01 / PERF-09** CI 依存関係/Prisma/ビルドキャッシュ（同一 finding）。
- **TECHDEBT-01（一括）** 約90箇所のレガシー `console.error` → `logError` 移行（プラン 007 の後）。
- **TECHDEBT-02** `product-details.tsx`（1382行の god component）の分割 — L effort、characterization テスト先行。
- **TECHDEBT-03** 3つの profile テーブルから `usePaginatedFilteredList` を抽出。
- **サーバー側 `placeOrder` 冪等性**（並行二重送信）— プラン 006 から先送り。`applyCoupon` ロストアップデートの `$transaction` リファクタと重複。
- **seller 注文の完全サーバー側ページネーション** — プラン 009 から先送り（`StoreOrderType` + DataTable の検索を変更）。
- **Direction**: DIRECTION-01 返金実行（L, HIGH risk）、DIRECTION-03 サポートチケットコンソール、DIRECTION-04 i18n 基盤、DIRECTION-05 エラーモニタリング（roadmap Phase 5）。

## 検討済みで却下した finding（再監査防止のため）

- **SECURITY-07** PayPal sandbox エンドポイントのハードコード（`paypal.ts:72,189`）: LOW confidence — 先に意図された本番 env 配線を確認すること。investigate 止まりで修正ではない。
- **SECURITY-08/09** 古い raw `error.message` の補間 / `upsertReview` の購入検証: LOW confidence。Next.js の server-action エラーマスキングで緩和済み。
- **DEPS-05** dev 専用勧告（handlebars/ws/picomatch）: 本番非到達。定期的な dev ツールリフレッシュに折り込む。
- **DEPS-08** Next.js 16.2.1: 既に最新 — アクション不要。
- **DX-09** `.editorconfig`、**TECHDEBT-07** 共有ダッシュボードフォームスキャフォールド: 低価値/議論の余地あり。再検討時のみ spike。
- **決定済みトレードオフ（finding ではない）**: ADR-001 CSRF（トークンモジュールなし）、ADR-002 CI `--verbose`、ADR-003 `setOpen` 同期化、ADR-004 testcontainers、ADR-005 SonarCloud 非ブロッキング、`reactStrictMode: false`、Elasticsearch コメントアウト（tsvector 採用）、DB ページの `force-dynamic`（SSG 放棄が文書化済み）、`middleware`→`proxy` / AVIF 警告への非対応、プロダクトのスコープ外（多通貨 / 税計算 / 高度分析 / 配送キャリア連携）。詳細は [`audit/recon.md`](audit/recon.md) の「決定済みトレードオフ」参照。
- **既修正のセキュリティ**（引き続き健全・回帰なし）: PayPal/Stripe の userId スコープ、`upsertCoupon` 所有権、`applyCoupon` CAS、review IDOR — `docs/testing/SECURITY_GAP_REPORT.md` 記載どおり。

## 今回監査**しなかった**範囲（深いが範囲を限定）

- フルテストスイート / E2E は今回の セッションでは**実行していない**（統計は `docs/testing/QA_HANDOFF.md` から読み取り）。型チェック + lint + `bun audit` のベースラインは実行済み（recon 参照）。
- 実際の外部サービス（Stripe/PayPal/Clerk/Cloudinary）環境でのテストは実施していない。
- 生成物はスキップ: `coverage/`、`docs/coverage-dashboard.html`、`docs/architecture/data-model.drawio`、`.next/`、`node_modules/`。
