# ADVISOR_STATE — improve スキル監査の進行状態

> **目的**: セッションを跨いでも次セッションで即再開できるようにする状態ファイル。
> 各マイルストーン完了ごとに更新し、`plans/**` のみを対象に `docs(plans): ...` でコミットする。
> **ソースコードは一切変更しない**（improve スキル Hard Rule 1）。

---

## Round 8 — E2E テスト網羅性監査（`tests` フォーカス・E2E 限定 / 開始 2026-07-11）

- **開始日**: 2026-07-11 / **監査対象 HEAD**: `fbd1020`（branch: `dev` — R7 クローズコミット。
  R7 監査 HEAD `9111f41` からソース `src/ tests/ prisma/` は無変更 — R7 クローズ時に diff 空を検証済み）
- **バリアント**: `tests` フォーカス・**E2E（Playwright）限定**。全 Round を通じて E2E は
  「未実測・スコープ外」だったため（R4〜R7 の明記事項）、本ラウンドが初の E2E 実測 + 網羅性監査
- **目的**: 既存 E2E（main 9 spec + visual 2 + a11y 4）の網羅性を **3 ブラウザ実測ベースライン付き**で
  精査し、追加が必要な E2E テスト項目を Sonnet が zero-context で実行できる自己完結プラン
  （**042〜**）に落とす。COVERAGE_REPORT §3 で保留中だった「(backlog) E2E 行の拡大」の起票判断を
  本ラウンドで確定する。あわせて docs/testing 精査・更新と coverage-dashboard.html 再生成
  （R4〜R7 と同じ Hard Rule 1 のスコープ例外）
- **ユーザー確認済みの決定**:
  - テストコードの実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/` は無変更）
  - プラン承認済み（`~/.claude/plans/agent-skills-improve-skill-md-e2e-sonne-idempotent-valley.md`）
  - 実測ベースラインは **3 ブラウザフル**（chromium/firefox/webkit）。手順は文書化済みの
    `scripts/e2e/run-local.sh`（ローカル Docker Postgres へ `migrate deploy` → `seed:e2e` →
    `--retries=2`。:3000 の既存サーバー停止が前提条件のため app コンテナを一時停止 → 実測後に再開）
  - プラン化対象は**監査台帳完成後にユーザーが選択**（R5〜R7 の自動選定と異なる —
    AskUserQuestion で明示決定。台帳にはギャップ全量を記載し、選択待ちで PAUSE する）
  - **販売者ダッシュボード系 E2E（商品 CRUD・注文ステータス更新等）は deferred 維持**
    （OI-11 `self is not defined` 本番ビルド SSR ブロッカーの解消が先行依存。台帳に記録のみ）
  - Docker 起動済み（app + postgres。実測時に app は一時停止する）
- **採番**: 監査台帳 = `audit/findings-16-e2e-coverage.md` / 新規所見 = TESTS-26〜 /
  新規プラン = 042〜
- **成果物**: findings-16（監査台帳・ギャップ全量 + deferred + rejected）+ plans 042〜
  （ユーザー選択分）+ README 索引 + docs/testing 同期 + ダッシュボード再生成

### Round 8 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション |
| 2 | E2E 実測ベースライン（3 ブラウザ・run-local.sh 手順）+ 監査台帳（TESTS-26〜38 + deferred + rejected） | ✅ DONE | `audit/findings-16-e2e-coverage.md`（実測 #1 は :3000 二重占有 + globalTimeout 打ち切りで無効 → app コンテナ停止 + `--global-timeout` 上書きの実測 #2 が SSOT: **52 passed / 17 failed / 39 skipped / 3 did not run / 25.5m**。認証系 16 件の全滅は `auth.ts` signIn の Clerk UI ドリフト単一根本原因 = TESTS-26） |
| 3 | ギャップ一覧の提示 → ユーザー選択（プラン化対象の確定） | ✅ DONE | AskUserQuestion で全 13 所見中 **9 本をプラン化** 決定（TESTS-26/32/33/34/35/36/37/38 系 + ゲスト導線）。決済失敗ロールバック・販売者 CRUD 系は deferred 維持 |
| 4 | plans 042〜 執筆（選択分・1 プラン = 1 コミット） | ✅ DONE | plans 042〜050（9 本）: `154425c`（042 初出）→ `3ae8c3f`（042 を 4 spec に拡張）/ 043 `ff35b66` / 044 `63ac998` / 045 `c13823d` / 046 `754a5b3` / 047 `4e25223` / 048 `d1f13df` / 049 `d24ee4c` / 050 `4eb61f4` |
| 5 | README 索引更新（042〜 追加・TESTS-14 昇格/維持の反映・rejected 記録） | ✅ DONE | `d07186f`（plans/README.md status テーブルに 042〜050 追加） |
| 6 | docs/testing 精査・更新（QA_HANDOFF E2E 実測同期 + R8 プロンプト / COVERAGE_REPORT §3 R8 / PERSPECTIVES / TEST_IMPLEMENTATION_PLAN / TESTING_DESIGN ドリフト確認） | ✅ DONE | `cbfdfad`（QA_HANDOFF / COVERAGE_REPORT / QA_TEST_PERSPECTIVES / TEST_IMPLEMENTATION_PLAN の 4 ファイル同期。TESTING_DESIGN はドリフトなし → 無変更を記録） |
| 7 | NEXT_ACTIONS R8 追加 + coverage-dashboard.html 再生成（tsc 0 / lint 0 確認） | ✅ DONE | `13e0dd4`（render-html.ts の NEXT_ACTIONS に R8 追加 + dashboard 再生成）。クローズ時に再検証: tsc 0 / lint 0（warnings のみ）/ 再生成差分はタイムスタンプのみ（コンテンツ一致） |
| 8 | ADVISOR_STATE クローズ（`git diff fbd1020..HEAD --stat -- src tests prisma` = 空 を検証） | ✅ DONE | 本コミット。`git diff fbd1020..HEAD --stat -- src tests prisma` = **空**（ソース無変更を機械検証）。QA_HANDOFF R8 ↔ NEXT_ACTIONS R8 は plans 042〜050 で一対一対応を確認 |

---

## Round 7 — Integration 残余領域の監査（`tests` フォーカス第 3 弾 / 開始 2026-07-11）

- **開始日**: 2026-07-11 / **監査対象 HEAD**: `9111f41`（branch: `dev` — R6 クローズコミット。
  R6 監査 HEAD `4ec6b5b` からソース `src/ tests/ prisma/` は無変更 — R6 クローズ時に diff 空を検証済み）
- **バリアント**: `tests` フォーカス・**Integration（testcontainers）限定**の第 3 弾
- **目的**: R5/R6 が高レバレッジ候補を消費済みのため、Round 7 は (A) R6 の次点候補の再評価
  （dashboard taxonomy/coupon upsert 群の P2002 実発火・`getStoreOrders` 等一覧系ページング）+
  (B) 未スイープの新規切り口（Clerk webhook `user.deleted` の FK 連鎖 / Store 複合 unique 群 /
  profile 系読み取り / store ページ集計系）の 2 軸で監査し、追加が必要な統合テスト項目を
  Sonnet が zero-context で実行できる自己完結プラン（**040〜**）に落とす。あわせて docs/testing
  精査・更新と coverage-dashboard.html 再生成（R4/R5/R6 と同じ Hard Rule 1 のスコープ例外）
- **ユーザー確認済みの決定**:
  - テストコードの実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/` は無変更）
  - プラン承認済み（`~/.claude/plans/agent-skills-improve-skill-md-integrati-scalable-fox.md`）
  - プラン化は**自動選定**（vet 済み所見から高レバレッジ 3〜5 本。R5/R6 前例踏襲。
    **3 本未満なら水増しせず正直に減らす** — R6 で候補を相当消費済みのため 2〜4 本の見込み）
  - plans 027 / 031〜039 とシナリオ・対象分岐が重複するプランは作らない
  - `prisma/seed/__tests__/` はシードテスト（別枠）であり本ラウンドの「Integration」対象外
  - Docker 起動済み（29.5.2 確認済み）→ 冒頭で `bun run test:integration` を実測
- **Deferred 継続（先行依存が未解消 — 昇格せず維持確認のみ）**: saveUserCart（plan 005 先行）/
  TESTS-02 capture 経路（plan 003 先行）/ applyCoupon total ロストアップデート（correctness 修正先行）
- **採番**: 監査台帳 = `audit/findings-15-integration-coverage-r7.md` / 新規所見 = TESTS-24〜 /
  新規プラン = 040〜
- **成果物**: findings-15（監査台帳）+ plans 040〜（2〜5 本）+ README 索引 +
  docs/testing 同期 + ダッシュボード再生成

### Round 7 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / `921aecc` |
| 2 | 実測ベースライン + A/B 軸監査台帳（TESTS-24〜25 + deferred 再裁定 5 件 + rejected 6 件） | ✅ DONE | `audit/findings-15-integration-coverage-r7.md`（実測: **17/17 pass / 4.473s**）/ `f4428e8` |
| 3 | plan 040 Clerk user.deleted webhook FK 連鎖（TESTS-24） | ✅ DONE | `040-integration-test-user-deletion-webhook.md` / `57cdfa3` |
| 4 | plan 041 Coupon.code グローバル unique P2002（TESTS-25 — R6 次点の再裁定昇格） | ✅ DONE | `041-integration-test-coupon-code-uniqueness.md` / `72c205a` |
| 5 | README 索引更新（040〜041 追加・推奨順序 #12・R6 次点の昇格/deferred 変更・R7 rejected 記録） | ✅ DONE | `f65010e` |
| 6 | docs/testing 精査・更新（QA_HANDOFF R7 実測+プロンプト / COVERAGE_REPORT §3 R7 / PERSPECTIVES 2 観点。TESTING_DESIGN はドリフトなしのため無変更） | ✅ DONE | `cffe6d8` |
| 7 | NEXT_ACTIONS R7 追加 + coverage-dashboard.html 再生成（tsc 0 / lint 0 エラー確認済み） | ✅ DONE | `c32ac08` |
| 8 | ADVISOR_STATE クローズ（`git diff 9111f41..HEAD --stat -- src tests prisma` = 空 を検証） | ✅ DONE | 本コミット（diff 空を検証済み） |

**Round 7 完了（2026-07-11）**。ソースコード（`src/` `tests/` `prisma/`）は無変更
（`git diff 9111f41..HEAD --stat -- src tests prisma` = 空で検証済み）。
Integration 実測 **17/17 pass / 4.473s**（R5/R6 と同一構成の再確認）。
成果物: `audit/findings-15-integration-coverage-r7.md`（TESTS-24〜25 + 再裁定 + rejected、
FK/unique とも migration SQL・schema レベルで裏取り）+ plans **040〜041**（全プラン Docker 必須・
seed.ts / reset-db.ts 非変更・Sonnet 実行可能な自己完結形式。高レバレッジ候補が 2 件のみの
ため水増しせず 2 本）+ README 索引 + docs/testing 3 ファイル同期 + ダッシュボード再生成。
特記事項: 040 シナリオ 2〜4（RESTRICT による削除不能 → PII 残存）と 041 シナリオ 2・3
（クロスストア code 衝突の P2002 フォールバック）は**現挙動の characterization** — 対応する
correctness 修正（user.deleted の匿名化 or ソフト削除 / coupon 事前チェックのスコープ整合）は
将来プランの候補として findings-15 に記録。
次のアクション: plans/031〜035（R5）→ 036〜039（R6）→ 040〜041（R7）の実行
（QA_HANDOFF「次回着手用 依頼プロンプト」R5/R6/R7 参照。R7 推奨順 040 → 041。
seed.ts 競合がないため R5/R6 プランと並行可）。Integration の残余候補はほぼ枯渇 —
次ラウンドを行う場合はコード修正先行の deferred 群（005/003/009/002 完了後の追加テスト）の
解消状況を先に確認すること。

---

## Round 6 — Integration 次点候補の深掘り監査（`tests` フォーカス / 開始 2026-07-11）

- **開始日**: 2026-07-11 / **監査対象 HEAD**: `4ec6b5b`（branch: `dev` — R5 クローズコミット。
  R5 監査 HEAD `1750ef2` からソース `src/ tests/ prisma/` は無変更を確認済み）
- **バリアント**: `tests` フォーカス・**Integration（testcontainers）限定**の第 2 弾
- **目的**: Round 5 が「$transaction / raw SQL / webhook 全サイト」を精査済みのため、
  Round 6 は (A) R5 の deferred/次点候補の再評価 + (B) R5 未スイープの新規切り口
  （非原子 multi-write / unique・FK カスケード / admin・seller 経路の upsert 群 /
  複雑 where ビルダー）の 2 軸で監査し、追加が必要な統合テスト項目を Sonnet が
  zero-context で実行できる自己完結プラン（**036〜**）に落とす。あわせて docs/testing
  精査・更新と coverage-dashboard.html 再生成（R4/R5 と同じ Hard Rule 1 のスコープ例外）
- **ユーザー確認済みの決定**:
  - テストコードの実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/` は無変更）
  - Round 6 の実施は AskUserQuestion で明示選択済み（「次点候補の深掘り監査」）
  - プラン化は**自動選定**（vet 済み所見から高レバレッジ 3〜5 本。R5 前例踏襲。
    高レバレッジが 3 本未満なら水増しせず正直に減らす）
  - plan 027 / 031〜035 とシナリオ・対象分岐が重複するプランは作らない
  - `prisma/seed/__tests__/` はシードテスト（別枠）であり本ラウンドの「Integration」対象外
- **採番**: 監査台帳 = `audit/findings-14-integration-coverage-r6.md` / 新規所見 = TESTS-20〜 /
  新規プラン = 036〜
- **成果物**: findings-14（監査台帳）+ plans 036〜（3〜5 本）+ README 索引 +
  docs/testing 同期 + ダッシュボード再生成

### Round 6 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / `a12d220` |
| 2 | 実測ベースライン + スイープ A/B 監査台帳（TESTS-20〜23 + 再裁定 3 件 + rejected 5 件） | ✅ DONE | `audit/findings-14-integration-coverage-r6.md`（実測: **17/17 pass / 4.008s**）/ `6802d60` |
| 3 | plan 036 deleteProduct FK Restrict/カスケード（TESTS-20） | ✅ DONE | `036-integration-test-product-deletion-fk.md` / `0d14aca` |
| 4 | plan 037 upsertShippingAddress default 不変条件（TESTS-21） | ✅ DONE | `037-integration-test-shipping-address-default.md` / `4795d6d` |
| 5 | plan 038 updateProduct 全置換 tx/slug/SetNull（TESTS-22 — R5 次点昇格） | ✅ DONE | `038-integration-test-product-update-tx.md` / `2ea8948` |
| 6 | plan 039 getProducts フィルタ/ソート/ページング（TESTS-23） | ✅ DONE | `039-integration-test-product-browse-filters.md` / `cd008ca` |
| 7 | README 索引更新（036〜039 追加・推奨順序 #11・R5 次点昇格反映・rejected 記録） | ✅ DONE | `eeb2d94` |
| 8 | docs/testing 精査・更新（QA_HANDOFF R6 実測+プロンプト / COVERAGE_REPORT §3 R6 / PERSPECTIVES 5 観点。TESTING_DESIGN はドリフトなしのため無変更） | ✅ DONE | `fa157c2` |
| 9 | NEXT_ACTIONS R6 追加 + coverage-dashboard.html 再生成（tsc 0 / lint 0 エラー確認済み） | ✅ DONE | `f15d610` |
| 10 | ADVISOR_STATE クローズ（`git diff 4ec6b5b..HEAD --stat -- src tests prisma` = 空 を検証） | ✅ DONE | 本コミット（diff 空を検証済み） |

**Round 6 完了（2026-07-11）**。ソースコード（`src/` `tests/` `prisma/`）は無変更
（`git diff 4ec6b5b..HEAD --stat -- src tests prisma` = 空で検証済み）。
Integration 実測 **17/17 pass / 4.008s**（R5 と同一構成の再確認）。
成果物: `audit/findings-14-integration-coverage-r6.md`（TESTS-20〜23 + 再裁定 + rejected、
FK は migration SQL レベルで裏取り）+ plans **036〜039**（全プラン Docker 必須・seed.ts 非変更・
Sonnet 実行可能な自己完結形式）+ README 索引 + docs/testing 3 ファイル同期 + ダッシュボード再生成。
特記事項: 037 シナリオ 2（default 併存）と 039 シナリオ 2・4（フィルタ黙殺・Infinity 境界）は
**現挙動の characterization** — 対応する correctness 修正は将来プランの候補として findings-14 に記録。
次のアクション: plans/031〜035（R5）→ 036〜039（R6）の実行（QA_HANDOFF「次回着手用
依頼プロンプト」R5/R6 参照。R6 推奨順 036 → 037 → 038 → 039。seed.ts 競合がないため
R5 プランと並行可）。

---

## Round 5 — Integration テスト特化監査（`tests` フォーカス / 開始 2026-07-11）

- **開始日**: 2026-07-11 / **監査対象 HEAD**: `1750ef2`（branch: `dev`）
- **バリアント**: `tests` フォーカス・**Integration（testcontainers）限定**
  （Recon → integration カバレッジのみ監査 → プラン化）
- **目的**: 既存 Integration テスト（`tests/integration/` 17 テスト / 2 スイート）の網羅性を
  **実測ベースライン付き**で精査し、「追加が必要な統合テスト項目」を Sonnet が zero-context で
  実行できる自己完結プラン（031〜）に落とす。あわせて docs/testing 配下の精査・ブラッシュアップと
  coverage-dashboard.html の更新（Round 4 と同じ Hard Rule 1 のスコープ例外:
  docs/testing・`scripts/coverage-dashboard/render-html.ts`・生成物 HTML の編集を許可）
- **ユーザー確認済みの決定**:
  - テストコードの実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/` は無変更）
  - プラン化は**自動作成**（vet 済み所見から高レバレッジ 3〜5 本。Round 1/4 前例踏襲）
  - 監査冒頭で **`bun run test:integration` を実測実行**（Docker 起動済み・使い捨てコンテナ）。
    Round 4 で未実測だった Integration 統計を実測値で更新する
  - plan 027（TESTS-05+08）と重複するプランは作らない。TESTS-02（capture 経路）は
    plan 003 先行依存のため deferred 維持
  - `prisma/seed/__tests__/` はシードテスト（別枠）であり本ラウンドの「Integration」対象外
- **成果物**: `audit/findings-13-integration-coverage.md`（監査台帳）+ plans 031〜（3〜5 本）+
  README 索引 + docs/testing 同期 + ダッシュボード再生成

### Round 5 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / Commit R5-1 |
| 2 | 実測ベースライン + Integration 監査台帳（TESTS-15〜19 + TESTS-02/04/06 reconcile） | ✅ DONE | `audit/findings-13-integration-coverage.md`（実測: **17/17 pass / 4.779s** — Round 4 の未実測を解消） |
| 3 | plan 031 注文ライフサイクル + restock 統合テスト（TESTS-15） | ✅ DONE | `031-integration-test-order-lifecycle-restock.md` |
| 4 | plan 032 webhook 実 DB 冪等性（TESTS-16） | ✅ DONE | `032-integration-test-webhook-payment-idempotency.md` |
| 5 | plan 033 tsvector 全文検索 実 DB 統合（TESTS-17） | ✅ DONE | `033-integration-test-tsvector-search.md` |
| 6 | plan 034 upsertReview 評価集計（TESTS-18） | ✅ DONE | `034-integration-test-review-aggregation.md` |
| 7 | plan 035 updateStoreStatus ロール昇格遷移（TESTS-19） | ✅ DONE | `035-integration-test-store-status-role-promotion.md` |
| 8 | README 索引更新（031〜035 追加・推奨順序 #10・TESTS-04/06 昇格反映・rejected 記録） | ✅ DONE | Commit R5-8 |
| 9 | docs/testing 精査・更新（QA_HANDOFF 実測同期 + R5 プロンプト / TESTING_DESIGN ドリフト 3 件修正 / COVERAGE_REPORT §3 R5 / PERSPECTIVES 4 観点） | ✅ DONE | Commit R5-9 |
| 10 | NEXT_ACTIONS 追加 + coverage-dashboard.html 再生成 | ✅ DONE | `ece9da1`（R5 エントリ + 再生成。tsc 0 / lint 0 エラー確認済み） |
| 11 | ADVISOR_STATE クローズ（`git diff 1750ef2..HEAD --stat -- src tests prisma` = 空 を検証） | ✅ DONE | 本コミット（diff 空を検証済み） |

**Round 5 完了（2026-07-11）**。ソースコード（`src/` `tests/` `prisma/`）は無変更
（`git diff 1750ef2..HEAD --stat -- src tests prisma` = 空で検証済み）。
Integration 実測 **17/17 pass / 4.779s**（本リポジトリ初の実測記録 — Round 4 の未実測を解消）。
成果物: `audit/findings-13-integration-coverage.md`（TESTS-15〜19 + reconcile + rejected）+
plans **031〜035**（全プラン Docker 必須・Sonnet 実行可能な自己完結形式）+ README 索引 +
docs/testing 4 ファイル同期（TESTING_DESIGN のドリフト 3 件修正含む）+ ダッシュボード再生成。
次のアクション: plans/031〜035 の実行（QA_HANDOFF「次回着手用 依頼プロンプト」R5 参照。
推奨順 031 → 032 → 033 → 034 → 035。027 と 031 は seed.ts 拡張が重なるため可能なら 027 先行）。

---

## Round 4 — テストカバレッジ監査（`tests` フォーカス / 開始 2026-07-10）

- **開始日**: 2026-07-10 / **監査対象 HEAD**: `b6591f9`（branch: `dev`）
- **バリアント**: `tests` フォーカス（Recon → test-coverage カテゴリのみ監査 → プラン化）
- **目的**: 既存テスト（Jest 1662 passed / 172 スイート・Integration 17・E2E 9 スペック）の
  網羅性を lcov 実測で精査し、「危険な未テスト箇所」を Sonnet 実行可能なプランに落とす。
  あわせて docs/testing 配下の精査・ブラッシュアップと coverage-dashboard.html の更新
  （いずれもユーザー明示依頼のため Hard Rule 1 のスコープ例外として docs/testing・
  `scripts/coverage-dashboard/render-html.ts`・生成物 HTML の編集を許可）
- **ユーザー確認済みの決定**:
  - テストコードの実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/` は無変更）
  - 成果物形式 = **監査台帳 1 本（findings-11）+ 実行プラン数本（026〜）**
  - QA_HANDOFF.md は**履歴をアーカイブ分離**（統計セルの機能実装履歴長文を
    COVERAGE_REPORT.md §7 へ移動。統計 SSOT 構造は不変）
  - plan 010（TESTS-07 shipping-utils）と重複するプランは作らない
- **ベースライン実測（2026-07-10 / `bun run test -- --coverage`）**:
  - Jest: **1662 passed / 1665 total（3 skipped）/ 172 スイート（171 passed + 1 skipped）**
    — QA_HANDOFF 記載（1659/1662）から +3。差分コミット: `865dda3`（track-order エラー系 +
    テストファイル配置移動 `tests/component/store/` → `src/components/store/track-order/`）・
    `83fe664`（T-TO11 PII 非ログ検証）
  - カバレッジ: Statements 65.19% / **Branches 44.89%** / Functions 54.1% / Lines 64.11%
  - Integration（testcontainers）: **未実行**（Docker デーモン停止中のため。統計は前回値を維持）

### Round 4 チェックリスト

> **採番訂正**: 開始時に「findings-11 / TESTS-08〜12」と予約したが、`findings-11-security-followup.md`
> と Round 1 raw の TESTS-08〜10 が既に存在したため、**台帳 = findings-12 / 新規所見 = TESTS-11〜14**
> に訂正（単調性維持）。

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / `14f4d0e` |
| 2 | lcov 実測監査 + vetting（TESTS-11〜14 + Round 1 TESTS-01〜10 の reconcile） | ✅ DONE | `audit/findings-12-test-coverage.md` + VETTED_FINDINGS Round 4 追記 / `a1cabd1` |
| 3 | plan 026 paypal エラー分岐ユニットテスト（TESTS-11） | ✅ DONE | `c6c57ae` |
| 4 | plan 027 placeOrder オーバーセル + PLATFORM 端数 統合テスト（TESTS-05+08 昇格） | ✅ DONE | `1e3b2d6` |
| 5 | plan 028 country.ts ユニットテスト新設（TESTS-12） | ✅ DONE | `4900374` |
| 6 | plan 029 profile.ts catch 分岐テスト（TESTS-13） | ✅ DONE | `104e6aa` |
| 7 | plan 030 money-path クライアントコンポーネントテスト（TESTS-01 残余） | ✅ DONE | `9ad5303` |
| 8 | README 索引更新（023〜025 の索引漏れ補完 + 026〜030 追加・TESTS-05 昇格反映） | ✅ DONE | Commit R4-8 |
| 9 | docs/testing 精査・更新（QA_HANDOFF 履歴分離 + 統計実測同期 + 関連 docs） | ✅ DONE | `ab98e64`（履歴分離）/ `7f2b6c0`（統計同期+R4 プロンプト）/ `ec60bd4`（COVERAGE_REPORT §3 R4+§7 / TEST_IMPLEMENTATION_PLAN Phase 4 / QA_TEST_PERSPECTIVES 新機能観点） |
| 10 | NEXT_ACTIONS 追加 + coverage-dashboard.html 再生成 | ✅ DONE | `886cd05`（R4 エントリ + 再生成。tsc 0 / lint 0 エラー確認済み） |

**Round 4 完了（2026-07-10）**。ソースコード（`src/` `tests/` `prisma/`）は無変更
（`git diff b6591f9..HEAD --stat -- src tests prisma` = 空で検証済み）。
Integration テスト実測は Docker 停止のため未実施（plan 027 に Docker 前提の STOP 条件を明記済み）。
次のアクション: plans/026〜030 の実行（QA_HANDOFF「次回着手用 依頼プロンプト」R4 参照）。

### Round 4 vet メモ

- **rejected**（詳細は findings-12）: coupon-utils / serialize-cart / shipping-utils の
  「テストファイルなし」（間接カバレッジ 100%）・db.ts・`search copy.tsx`（plan 008 対象）・
  chart.tsx（snapshot 済みプリミティブ）・product-details.tsx（TECHDEBT-02 従属）・
  dashboard forms 群（低レバレッジ → README 次点候補）。
- **索引ドリフト発見**: security-followup ラウンドの 023〜025 が README status テーブルに
  未掲載だった → R4-8 で補完（024 は P3、プラン本文の Status と突合済み）。

---

## Round 3 — direction-expansion 第2弾: 運用・信頼・成長（`next` バリアント / 完了 2026-07-10）

- **開始日**: 2026-07-10 / **監査対象 HEAD**: `86c04a1`（branch: `dev`。Round 2 以降ソース変更なし — 差分は docs(plans) コミットのみ）
- **バリアント**: `next`（roadmap/direction 特化）+ Round 1/2 成果物との reconcile
- **目的**: Round 2（カタログ基盤と発見性）が扱わなかった **運用（Operations）・信頼（Trust）・
  成長（Growth）** 領域の拡張検討ドキュメント + design/spike プラン 5 本（018〜022）。
  Round 2 と同じ「構造はブランド非依存・ポリシーはデータで差し替え」原則で書く
- **ユーザー確認済みの決定**:
  - 実装は一切しない（成果物は `plans/` 配下のみ）
  - 成果物は**日本語のみ**（Round 2 決定を継承）
  - 依頼原文（Amazon 級拡張ドキュメント + 汎用骨組み）は Round 2 で完成済みであることを確認済み。
    今回は **Round 3: 新領域拡張** をユーザーが明示選択
  - `product.md` スコープ外（多通貨・税計算・高度分析・配送キャリア連携）はプラン化しない。
    RMA は追跡番号手入力前提 / セラー指標は自動措置シグナルに限定（分析 UI は作らない）
  - Round 1 DIRECTION-01〜05・Round 2 spike 013〜017 と重複するプランは作らない
- **候補領域**（R3-2 recon で裏取り後に確定。カバー済み/低価値と判明したら本数を減らし README rejected に記録）:
  1. 返品・交換（RMA）顧客ワークフロー（DIRECTION-01 返金実行の上流）
  2. レビュー・UGC 品質ガバナンス（モデレーション・通報・購入者確認バッジ）
  3. プロモーション・販促エンジン（プラットフォーム主導セール・タイムセール）
  4. 通知・トランザクショナルメッセージ基盤（spike 016 / RMA の共通前提）
  5. セラーパフォーマンス指標と自動措置（Trust & Safety、spike 016 の延長）

### Round 3 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / Commit R3-1 |
| 2 | 新領域 recon（O-1〜O-5 のエビデンス収集） | ✅ DONE | `audit/findings-10-direction-operations-growth.md` / Commit R3-2 |
| 3 | 運用・信頼・成長ブループリント執筆 + EXPANSION_BLUEPRINT §5 ロードマップ統合 | ✅ DONE | `direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` / Commit R3-3 |
| 4 | plan 018 spike-returns-rma-workflow | ✅ DONE | Commit R3-4 |
| 5 | plan 019 spike-review-ugc-governance | ✅ DONE | Commit R3-5 |
| 6 | plan 020 spike-promotion-engine | ✅ DONE | Commit R3-6 |
| 7 | plan 021 spike-notification-foundation | ✅ DONE | Commit R3-7 |
| 8 | plan 022 spike-seller-performance-trust | ✅ DONE | Commit R3-8 |
| 9 | README 索引更新（018〜022 追加・依存関係・推奨順序） | ✅ DONE | Commit R3-9 |

### Round 3 vet メモ（rejected なし）

候補5領域はすべて recon で「実在するギャップ」と確認され、5本とも spike 化した
（水増しなし判定の根拠は findings-10 の各 file:line エビデンス）。
既存カバーと判明した部分は spike のスコープから除外して整合を取った:
RETURN_REQUEST 受付・PLATFORM クーポン + admin UI は「再利用する資産」として
各プランの Current state に記載（重複プラン化せず）。

### Round 3 依存メモ

- **021（通知基盤）は 018（RMA）と 016（審査）の通知要件の共通前提** → ロードマップ上は
  Phase C の早い位置に配置する
- 018 は「チケット（DIRECTION-03）→ RMA → 返金実行（DIRECTION-01）→ restock（012）」の鎖に接続
- 019 / 020 / 022 は相互に独立

---

## Round 2 — direction-expansion（`next` バリアント / 完了 2026-07-09）

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
| 8 | plan 017 spike-recommendation-foundation | ✅ DONE | Commit R2-8 |
| 9 | README 索引更新（013〜017 追加・012 後続採番注記の修正・日本語執筆注記） | ✅ DONE | Commit R2-9 |

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

**✅ Round 3（operations/trust/growth expansion）全マイルストーン完了（2026-07-10）。**
成果物: `direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` + spike プラン 018〜022 +
`audit/findings-10-direction-operations-growth.md` + EXPANSION_BLUEPRINT §5 ロードマップ統合 +
README 索引更新。ソースコードは一切未変更。
次のアクション候補（いずれも独立に着手可能）:
1. Round 1 の実行フェーズ: security 001–004 を `execute <plan>` で最優先実施
2. Round 2 の spike 実行: 013 → 014 → 015 の順（016/017 は独立）。各 spike は設計文書 +
   後続実装プランを生成して STOP する
3. Round 3 の spike 実行: 021（通知 — C の共通前提）→ 018 → 019 → 022 の順、020 は独立。
   018/022 は状態遷移記録方式を一本化（先行した方の決定に従う）
4. ブランド方針が決まったら `EXPANSION_BLUEPRINT.md` §3.2 の有効化列・§5 検算表と
   `OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` §4 検算表を更新

**Round 2 完了記録（2026-07-09）**: `direction/EXPANSION_BLUEPRINT.md` + spike 013〜017 +
`audit/findings-09-direction-expansion.md` + README 索引更新。

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

## 2026-07-10 追記: 正式版昇格（docs への SSOT 移管）

- Round 2/3 の direction 成果物（EXPANSION_BLUEPRINT.md / OPERATIONS_TRUST_GROWTH_BLUEPRINT.md）を
  統合・再構成し、`docs/architecture/expansion/`（README + 01〜05 の6ファイル・git 追跡対象）へ
  **正式版として昇格**（コミット 540e759〜78397dc の7コミット）。
  フェーズロードマップの SSOT は `docs/architecture/expansion/05-phased-roadmap.md` へ移管。
  plans/direction/ の2ファイルは監査原本（履歴）として凍結（各冒頭に注記済み）。
  spike 013〜022・audit findings は引き続き plans/ が原本。
