# ADVISOR_STATE — improve スキル監査の進行状態

> **目的**: セッションを跨いでも次セッションで即再開できるようにする状態ファイル。
> 各マイルストーン完了ごとに更新し、`plans/**` のみを対象に `docs(plans): ...` でコミットする。
> **ソースコードは一切変更しない**（improve スキル Hard Rule 1）。

---

## Round 2 — direction-expansion（`next` バリアント / 進行中）

- **開始日**: 2026-07-09 / **監査対象 HEAD**: `a17e2cc`（branch: `dev`）
- **バリアント**: `next`（roadmap/direction 特化）+ Round 1 成果物との reconcile
- **目的**: Amazon 級マーケットプレイスへの拡張検討ドキュメント（ブランド非依存の汎用骨組み・
  参照カテゴリタクソノミー・フェーズ別ロードマップ）+ 土台となる design/spike プラン 5本
- **ユーザー確認済みの決定**:
  - 実装は一切しない（成果物は `plans/` 配下のみ）
  - **本ラウンドの成果物は日本語のみ**（Round 1 の EN 原本 + `plans/ja/` ミラー構成は踏襲しない）
  - 範囲: ブループリント + spike 5本（013〜017）
  - `product.md` スコープ外（多通貨・税計算・高度分析・配送キャリア連携）はプラン化しない
  - 既存 DIRECTION-01〜05（`audit/findings-08-direction.md`）と重複するプランは作らず、
    ブループリントのロードマップに参照配置する

### Round 2 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / Commit R2-1 |
| 2 | 拡張観点 recon（データモデル/queries/admin UI のエビデンス） | ✅ DONE | `audit/findings-09-direction-expansion.md` / Commit R2-2 |
| 3 | 拡張ブループリント執筆 | ✅ DONE | `direction/EXPANSION_BLUEPRINT.md` / Commit R2-3 |
| 4 | plan 013 spike-category-tree-n-level | ✅ DONE | Commit R2-4 |
| 5 | plan 014 spike-category-attributes-facets | ✅ DONE | Commit R2-5 |
| 6 | plan 015 spike-faceted-search-and-browse | ✅ DONE | Commit R2-6 |
| 7 | plan 016 spike-seller-onboarding-catalog-approval | ✅ DONE | Commit R2-7 |
| 8 | plan 017 spike-recommendation-foundation | ⬜ TODO | Commit R2-8 |
| 9 | README 索引更新（013〜017 追加・012 後続採番注記の修正・日本語執筆注記） | ⬜ TODO | Commit R2-9 |

### Round 2 採番メモ

Round 1 の `README.md` は「012 の後続 = `plans/013-implement-item-level-restock.md`」と番号を
予約していたが、番号の単調性を保つため **013〜017 は本ラウンドの spike プランが使用**する。
012 実行時に生成される後続実装プランは**実行時点の次の空き番号**を採番する（Commit R2-9 で
README の該当注記を修正）。

---

## Round 1 — deep 監査（完了 / 2026-07-03）

- **監査対象 HEAD**: `f9752c0`（branch: `dev`）
- **effort level**: deep / プラン選定方針: **カテゴリ網羅で自動作成**（ユーザー承認済み。意味のある発見があった各カテゴリ最低1件、セキュリティ・direction 必須。目安 8〜12 プラン）
- **実行計画の全文**: ユーザーの `~/.claude/plans/agents-skills-improve-skill-md-cosmic-prism.md`（リポジトリ外）。要点は本ファイルと `plans/audit/recon.md` に自己完結で記載済み。

## フェーズチェックリスト

| # | フェーズ | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | Recon（意図ドキュメント・検証ベースライン） | ✅ DONE | `plans/audit/recon.md` / Commit 1 |
| 2a | Audit Wave 1: correctness / security / performance / test-coverage | ✅ DONE | `plans/audit/findings-01〜04-*.md` / Commit 2 |
| 2b | Audit Wave 2: tech-debt / dependencies / DX+docs / direction | ✅ DONE | `plans/audit/findings-05〜08-*.md` / Commit 3 |
| 3 | Vet（引用箇所を自分で開いて検証・重複排除・leverage 順位付け） | ✅ DONE | `plans/audit/VETTED_FINDINGS.md` / Commit 4 |
| 4 | プラン執筆（1プラン=1コミット、`.agents/skills/improve/references/plan-template.md` 準拠） | ✅ DONE | `plans/001〜012-*.md` / Commit 5..16 |
| 5 | 索引 `plans/README.md`（実行順・依存・ステータス表・rejected） | ✅ DONE | 最終コミット |

## 次のアクション（NEXT）

**▶ Round 2（direction-expansion）進行中（2026-07-09〜）。** 上記「Round 2 チェックリスト」の
未完了マイルストーンを順に実行する。Round 1（deep 監査・12プラン・索引）は 2026-07-03 に全フェーズ完了済み。
Round 1 プランの実行フェーズ（`execute <plan>` / `reconcile`）は Round 2 とは独立に着手可能
（実行推奨順は `plans/README.md` の「Recommended sequencing」参照。security 001–004 が最優先）。

---

### 完了記録（参考）

**Phase 4 — プラン執筆（1プラン=1コミット、12本）。** `VETTED_FINDINGS.md` の「プラン化対象」12本を `plan-template.md` 準拠で執筆。各プランは:
- 引用コードは**本体の再読から**転記（サブエージェント報告からコピーしない）
- Planned-at SHA=`f9752c0`・drift check・検証コマンド（`bunx tsc --noEmit` / `bun run lint` / `bun run test -- <path>`）・in/out スコープ・STOP 条件・テスト計画・maintenance notes
- リポジトリ規約をインライン（auth-guards・Decimal 演算・構造化ログ・`src/queries/` 配置・02-tdd-step-commit のコミット規律 の該当分）
- direction プラン（012）は build でなく design/spike として書く

各プラン執筆ごとに **Commit 5..16**: `docs(plans): add plan 0NN <slug>`（+ ADVISOR_STATE 更新を同コミットに）。

進捗（このセクションを更新しながら進める）:
- [x] 001 SECURITY-01 IDOR
- [x] 002 SECURITY-02 mass-assignment
- [x] 003 SECURITY-03+04 payment trust
- [x] 004 DEPS-01 Clerk upgrade
- [x] 005 CORRECTNESS-04+02 cart integrity
- [x] 006 CORRECTNESS-03 double-submit
- [x] 007 TECHDEBT-01+06 logging consolidation
- [x] 008 TECHDEBT-05+04 dead code + schema move
- [x] 009 PERF-04+06 query hygiene
- [x] 010 TESTS-07 shipping-utils tests
- [x] 011 DX-02+03+04 onboarding docs
- [x] 012 DIRECTION-02 restock spike

**Phase 5 — 索引** `plans/README.md`（実行順・依存・ステータス表・rejected・次点候補）→ 最終コミット・最終報告。

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
