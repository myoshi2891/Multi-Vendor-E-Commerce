# plans/ja — 日本語訳の対象範囲

このディレクトリは **Round 1（deep 監査 / 2026-07-03・HEAD `f9752c0`）の英語プラン 001〜012 の
日本語訳のみ**を置く。索引・ステータス・監査台帳は**複製しない**。

## 唯一の出所（SSOT）

| 知りたいこと | 参照先 |
|---|---|
| プラン索引・実行順・ステータス表・先送り/却下 | [`../README.md`](../README.md) |
| セッション再開状態・ラウンド履歴 | [`../ADVISOR_STATE.md`](../ADVISOR_STATE.md) |
| 監査の生データ・vet 済み findings・recon | [`../audit/`](../audit/) |
| プラン 013〜063（Round 2〜14） | [`../`](../) — **原本がすでに日本語**。訳は不要 |

## なぜ ja/ は 001〜012 だけなのか

`plans/` 配下で英語で書かれているのは **Round 1 の 001〜012 だけ**である。
`ADVISOR_STATE.md`・`README.md`・`audit/**`・プラン 013〜063（Round 2〜14）は
**原本がすでに日本語**で書かれており、訳す対象が存在しない。

> **新規プラン追加時の同期義務**: 上表と本節の上限番号（現在 **063**）は、プランを
> 追加したラウンドで**必ず更新する**こと。ここが古いままだと「058〜062 は英語版が
> あるのでは / 訳が漏れているのでは」という誤読を生む（実際に Round 13 で 058〜062 を
> 追加した際に更新が漏れ、`013〜057` のまま Round 14 まで残っていた）。

Round 2 でこの方針は明示的に決定されている（[`../ADVISOR_STATE.md`](../ADVISOR_STATE.md) 参照）:

> **本ラウンドの成果物は日本語のみ**（Round 1 の EN 原本 + `plans/ja/` ミラー構成は踏襲しない）

かつてこのディレクトリには `ADVISOR_STATE.md`・`README.md`・`audit/**` の日本語コピーが
置かれていたが、これらは訳ではなく**日本語原本の複製**だった。原本が Round 4 以降に更新される
一方でコピーは Round 1 のまま取り残され、26〜98 行の乖離が生じた（`findings-02` に至っては
原本とバイト単位で同一だった）。二重管理が唯一の原因であるため、コピーは削除した。

これは本リポジトリが既に学習済みの教訓と同じものである
（[`../ADVISOR_STATE.md`](../ADVISOR_STATE.md) の direction 残候補の項 —
「本ファイルに一覧を再掲していたが、README 側と二重管理になり、片方だけ更新されて
ドリフトしていた」→ 単一の出所に一本化して解消）。
規約上の根拠は [`documentation-guide.md`](../../.claude/steering/documentation-guide.md)
「重複記録: 同じ情報を複数の場所に記録しない」。

## 翻訳の維持ルール

- 各訳は冒頭に `> 原本: [../0NN-*.md](../0NN-*.md)` を持つ。**原本が SSOT**。
- 原本（001〜012）を変更したら、**同一 PR 内で**対応する訳を更新する。
- **索引・ステータス・監査結果をここに再掲しない**。上表のリンクで原本を指すこと。
- 013 以降の新規プランに ja/ の訳は作らない（原本が日本語のため）。

## 訳の一覧

ステータスと実行順は [`../README.md`](../README.md) を参照（ここには再掲しない）。

| # | 訳 | カテゴリ |
|---|---|---|
| 001 | [`updateOrderItemStatus` を所有店舗にスコープ（クロスストア IDOR）](001-scope-order-item-status-to-owned-store.md) | security |
| 002 | [seller が編集可能な Store フィールドを allowlist 化（mass assignment）](002-allowlist-mutable-store-fields.md) | security |
| 003 | [Stripe の状態をサーバー側で導出・住所所有権を検証](003-server-side-payment-and-address-trust.md) | security |
| 004 | [`@clerk/nextjs` を CRITICAL 認証バイパス勧告の圏外へアップグレード](004-upgrade-clerk-nextjs-security.md) | dependencies |
| 005 | [原子的 `saveUserCart` + カート永続化の単一ソース化](005-cart-integrity-atomic-save-and-persist.md) | correctness |
| 006 | [「注文を確定」の二重送信ガード](006-place-order-double-submit-guard.md) | correctness |
| 007 | [`logError` ヘルパー; デバッグ `console.log` の除去; coupon ログの修正](007-logging-consolidation-and-debug-cleanup.md) | tech-debt |
| 008 | [dead `search copy.tsx` を削除; インライン Zod スキーマを移動](008-remove-dead-search-copy-and-relocate-schema.md) | tech-debt |
| 009 | [`getStoreOrders` を有界化; 破棄されたブラウズクエリを除去](009-query-hygiene-bound-store-orders-and-drop-dead-query.md) | perf |
| 010 | [`computeShippingTotal`（配送料計算 SSOT）のユニットテスト](010-unit-test-compute-shipping-total.md) | tests |
| 011 | [stale な画面ドキュメントの退役; env ドキュメント補完; `.env.example` 追加](011-onboarding-docs-env-and-stale-plan.md) | docs |
| 012 | [**Spike**: 在庫復元をアイテムレベルの status 遷移まで拡張](012-spike-item-level-inventory-restock.md) | direction |
