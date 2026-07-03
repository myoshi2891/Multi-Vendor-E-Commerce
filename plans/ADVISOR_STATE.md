# ADVISOR_STATE — improve スキル deep 監査の進行状態

> **目的**: セッションを跨いでも次セッションで即再開できるようにする状態ファイル。
> 各マイルストーン完了ごとに更新し、`plans/**` のみを対象に `docs(plans): ...` でコミットする。
> **ソースコードは一切変更しない**（improve スキル Hard Rule 1）。

- **監査対象 HEAD**: `f9752c0`（branch: `dev`）
- **effort level**: deep / プラン選定方針: **カテゴリ網羅で自動作成**（ユーザー承認済み。意味のある発見があった各カテゴリ最低1件、セキュリティ・direction 必須。目安 8〜12 プラン）
- **実行計画の全文**: ユーザーの `~/.claude/plans/agents-skills-improve-skill-md-cosmic-prism.md`（リポジトリ外）。要点は本ファイルと `plans/audit/recon.md` に自己完結で記載済み。

## フェーズチェックリスト

| # | フェーズ | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | Recon（意図ドキュメント・検証ベースライン） | ✅ DONE | `plans/audit/recon.md` / Commit 1 |
| 2a | Audit Wave 1: correctness / security / performance / test-coverage | ✅ DONE | `plans/audit/findings-01〜04-*.md` / Commit 2 |
| 2b | Audit Wave 2: tech-debt / dependencies / DX+docs / direction | ✅ DONE | `plans/audit/findings-05〜08-*.md` / Commit 3 |
| 3 | Vet（引用箇所を自分で開いて検証・重複排除・leverage 順位付け） | 🔲 TODO | `plans/audit/VETTED_FINDINGS.md` / Commit 4 |
| 4 | プラン執筆（1プラン=1コミット、`.agents/skills/improve/references/plan-template.md` 準拠） | 🔲 TODO | `plans/001〜0NN-*.md` / Commit 5..N |
| 5 | 索引 `plans/README.md`（実行順・依存・ステータス表・rejected） | 🔲 TODO | 最終コミット |

## 次のアクション（NEXT）

**Phase 3 — Vet を実行する。** 手順:

1. `plans/audit/findings-01〜08-*.md` の全 finding について、引用された file:line を**自分で開いて**確認する（サブエージェント報告はリードであり事実ではない）。3つの失敗クラスに注意: by-design（recon.md の決定済みトレードオフ表と照合）・evidence の誤帰属（行番号ズレ）・サブエージェント間の重複。
2. `plans/audit/VETTED_FINDINGS.md` を作成: leverage 順（impact ÷ effort × confidence）の findings 表 + **direction findings は別立て** + rejected 一覧（理由付き）。
3. **Commit 4**: `docs(plans): add vetted findings table`（VETTED_FINDINGS.md + 本ファイル更新）
4. ユーザー選択は待たず（承認済み方針）カテゴリ網羅でプラン化へ: 意味のある発見があった各カテゴリ最低1件、セキュリティ・direction 必須。目安 8〜12 プラン。LOW-confidence は "investigate/spike" プランとして書く。

Vet の際の注意点（Wave 2 報告からの引き継ぎ）:
- TECHDEBT-02 の対象は `src/components/dashboard/forms/product-details.tsx`（recon ヒントの store 側パスは存在しない — 訂正済み）
- DX-02 が recon の Direction ヒントを無効化: admin/orders・admin/coupons・seller inventory は**すべて実装済み**（direction 側も検証済みで一致）
- DEPS-02 は独立プランではなく DEPS-01（Clerk バンプ）の検証ゲート
- DEPS-05/08、DX-09、TECHDEBT-07 などの低優先/非アクション項目は rejected/deferred 側に整理してよい

## 再開プロンプト（次セッション用・コピペ可）

```
plans/ADVISOR_STATE.md と plans/audit/recon.md を読んで、improve スキル
（.agents/skills/improve/SKILL.md）の deep 監査を「次のアクション（NEXT）」から再開してください。
ルール: ソースコード変更禁止・成果物は plans/ 配下のみ・各マイルストーンで
plans/ のみを docs(plans): 形式でコミット・プランは references/plan-template.md 準拠で
zero-context executor 向けに自己完結・カテゴリ網羅（セキュリティ/direction 必須）で自動作成。
完了済みフェーズは再実行せず、このファイルのチェックリストを更新しながら進めること。
```

## 完了済みの要点（次セッションが再導出しなくてよい事実）

- ベースライン: tsc 0 エラー / lint 0 エラー・15 警告 / `bun audit` 97 件
- **最重要のセキュリティ既発見**: `@clerk/nextjs` 7.0.7 に CRITICAL ミドルウェア保護バイパス（GHSA-vqx2-fgx2-5wq9、<=7.2.3 影響・修正版 7.2.4+/最新 7.5.x）。`js-cookie` HIGH も Clerk 経由。→ 依存カテゴリのプラン最有力候補
- 既知・未対応（プラン化候補）: OI-9 ホーム SSR 500 / OI-11 seller `self is not defined` / OI-10 a11y color-contrast / C2 bundle size / applyCoupon total ロストアップデート / E2E 120s ハング
- direction 残候補: `/dashboard/admin/orders`・`/dashboard/admin/coupons`・seller inventory 画面（要実在確認）・返金ダウンストリーム＋運営チケット UI・SaaS ロードマップ Phase 5（監視基盤）・i18n（設計文書あり）
