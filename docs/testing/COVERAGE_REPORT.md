# Coverage Report — Field Survey

> **生成日**: 2026-05-21 / **対応する成果物**: [`docs/coverage-dashboard.html`](./coverage-dashboard.html) ([生成元](../../scripts/coverage-dashboard/))
> **再生成コマンド**: `bun run coverage:dashboard`

このレポートは、テストカバレッジダッシュボード初回生成 (2026-05-21) 時点での **現状サマリ・優先アクション・実装記録** を一覧化したものです。ダッシュボード HTML は視覚的な探索用、本ファイルは **読み返し・PR レビュー・スプリントプランニング用** の整理ドキュメントとして使い分けてください。

---

## 1. Executive Summary

| 指標 | 値 |
|---|---|
| テストファイル総数 | **134** (Jest unit/component 128 / Jest integration 1 / Playwright 5) — 2026-05-31 「Unit 行✦化」で co-located unit テスト +10 |
| テスト総数 | **1179 unit/component** (12 skipped) + **11 integration** — 2026-05-31 時点。Integration は `bun run test:integration` の別 config で実行 |
| Jest スナップショット | **127** — 2026-05-28 時点（**B1+ 全完了** で 112 → 127 / 累計 49 プリミティブカバー） |
| マトリクスセル数 | **80** (8 カテゴリ × 10 ドメイン) |
| カバー済みセル | **13 / 80 (16%)** |
| lcov エントリ数 | **96** (2026-05-24 ローカル再生成時点。`coverage/lcov.info` は `.gitignore` 対象で git 管理外。再生成は `bun run test -- --coverage`) |
| 未採用カテゴリ | Visual / Snapshot, a11y, Performance |
| 型エラー | **0 件** (2026-05-21 解消済み) |

**所感**: ユニット & インテグレーションは中核ドメイン（queries, store-ui）で堅実に整備されているが、**横展開（カテゴリ軸）が未着手**。特に売上直結フローの Visual / a11y は盲点で、リリース毎のリスクが暗黙のまま残っている。

---

## 2. Current State Heatmap (テキスト版)

`✦` = full (テスト存在 & skip なし & lcov ≥ 60%) / `◐` = partial (.skip 含む or lcov < 60%) / `◯` = missing

| カテゴリ ╲ ドメイン       | queries | api | pages | store | dashbd | shared | hooks | lib | seed | other |
|---|---|---|---|---|---|---|---|---|---|---|
| **Unit**           |   ✦    |  ◯  |  ✦   |  ✦   |   ✦   |   ✦   |   ◐   |  ✦  |  ◐   |   ◐   |
| **Integration**    |   ✦    |  ◯  |  ✦   |  ✦   |   ✦   |   ✦   |   ◯   |  ✦  |  ◯   |   ◯   |
| **E2E**            |   ◯    |  ◯  |  ✦   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **Visual/Snapshot**|   ◯    |  ◯  |  ◐   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **a11y**           |   ◯    |  ◯  |  ◐   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **Performance**    |   ◯    |  ◯  |  ◯   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **API/Contract**   |   ◯    |  ✦  |  ◯   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **Security**       |   ✦    |  ◯  |  ◯   |  ◯   |   ◯   |   ◯   |   ◯   |  ✦  |  ◯   |   ◯   |

> **Unit 行の注記（2026-05-31 更新）**: `pages / store / dashbd / shared` を co-located unit テストで✦化（[QA_HANDOFF.md「2026-05-31」](./QA_HANDOFF.md) 参照）。残る非✦セルは構造的・スコープ外の理由による:
> - **`api` ◯（構造的 N/A）**: `src/app/api/*` のテストは [`categorize.ts`](../../scripts/coverage-dashboard/categorize.ts) で必ず `api-contract` カテゴリへ分類されるため、Unit×api セルを埋める手段が存在しない。api の実カバーは **API/Contract 行 ✦**（`route.test.ts` × 6）が担保する。Issue #4 の意図的設計（カテゴリ上書き）を崩さないため categorize.ts は変更しない。
> - **`seed` ◐（意図的に分母外）**: `collectCoverageFrom` をロジック中心の `src/**` に限定したため `prisma/seed` は計測されない。「seed 以外を✦化」という本タスクのスコープ通り。
> - **`hooks` ◐**: `modal-provider.test.tsx` の OI-8 スキップ（CI flake 隔離）による `hasSkip`。
> - **`other` ◐**: `scripts/coverage-dashboard/scan-tests.test.ts` がスキップ検出ロジックのテストデータとして `.skip` 文字列を含み、スキャナが自己参照的に `hasSkip` 誤検知する（Issue #7 と同種のドッグフードノイズ）。

### カテゴリ別カバー率

| カテゴリ | カバー済み列 | カバー率 | 備考 |
|---|---|---|---|
| Unit | 6/10 | 60% | queries / pages / store / dashbd / shared / lib が✦。hooks / seed / other は ◐、api は構造的 ◯（上記注記参照） |
| Integration | 3/10 | 30% | tests/component/ 配下のみ |
| E2E | 1/10 | 10% | tests/e2e/ 配下 (5 spec) |
| API / Contract | 1/10 | 10% | route.test.ts のみ |
| Security | 2/10 | **20%** | A1 完了: queries（IDOR認可テスト）+ lib（middleware/sanitize） |
| Visual / Snapshot | 1/10 | **10%** | A2 完了: pages（cart/checkout spec — baseline 未コミット） |
| Accessibility | 1/10 | **10%** | A3 完了: pages（sign-in / seller-apply、WCAG 2.1 AA スキャン） |
| Performance | 0/10 | **0%** | 全列未対応 |

### ドメイン別 (列) のホットスポット

| ドメイン | 既存テスト数 | 状態 |
|---|---|---|
| `src/queries/` (Server Actions) | 14 | Unit のみ。Security 横展開が必要 |
| `src/components/store/` (Store UI) | 10 | Integration のみ。Visual / a11y 未対応 |
| `tests/e2e/` (Pages) | 5 | E2E のみ。Visual / a11y 未対応 |
| `src/app/api/` (API Routes) | 4 | API/Contract のみ。Stripe/PayPal Webhook の契約検証が薄い |
| `src/lib/`, `src/utils/`, `src/middleware.ts` | 5 | Unit + Security |
| `prisma/seed/` | 10 | シード自己整合性テストで充実 |
| `src/components/dashboard/` | 5 | Integration のみ |
| `src/components/shared/`, `ui/` | 2 | Integration のみ。Snapshot が有効そう |
| `src/hooks/`, `cart-store/`, `providers/` | 5 | Unit のみ |

---

## 3. Next Actions (カバレッジ観点の戦略台帳)

> **運用ルール**: このセクションは「なぜやるか・何を達成するか」の**戦略理由**を記録する台帳。
> 「次のセッションで何をするか」の即時 TODO は **[QA_HANDOFF.md](./QA_HANDOFF.md) の `残課題・Open Issues` を Single Source of Truth** とする。

---

### ✅ 完了済みアーカイブ（🔴 高優先度）

#### A1. Server Actions に CSRF / 認可テストを横展開 ✅ 2026-05-21 完了
- **対象**: `src/queries/**.test.ts` (Security 行)
- **達成内容**: 14 ファイル全調査、IDOR 脆弱性 2 件修正（paypal/stripe）、認可テスト補完
- **記録**: [`SECURITY_GAP_REPORT.md`](./SECURITY_GAP_REPORT.md) / commits `55c07b1`, `03a7e89`

#### A2. Checkout / Cart の Visual Regression を導入 ✅ 2026-05-21 完了
- **対象**: `tests/e2e/visual/`
- **達成内容**: cart/checkout の spec ファイル追加、playwright.config.ts に安定化設定を追加、および baseline スクリーンショットの生成・コミット
- **期待効果**: 売上直結フロー (cart, checkout) の UI 崩れをマージ前に阻止

#### A3. フォーム a11y を WCAG 2.1 AA で計測 ✅ 2026-05-21 完了
- **対象**: `tests/e2e/a11y/`
- **達成内容**: sign-in / seller-apply および /checkout / /profile の WCAG 2.1 AA スキャン追加（`@axe-core/playwright`）
- **期待効果**: 認証・申請フォームの障壁を計測 → 改善 → 退行防止のループ確立

#### B1. shadcn/ui プリミティブの Snapshot ✅ MVP 完了 2026-05-23
- **対象**: `tests/component/ui/*.test.tsx` — 9 プリミティブ（button / dialog / select / badge / card / input / label / textarea / skeleton）
- **達成内容**: 40 snapshot を `tests/component/ui/__snapshots__/` に生成・コミット。Tailwind / Radix のスタイル退行を CI で機械検知できるようになった。Portal を伴う `Dialog` / `Select` は `document.body` 経由でスナップショット化
- **運用ルール**: 詳細は [`TESTING_DESIGN.md` § shadcn/ui Snapshot テスト](./TESTING_DESIGN.md) を参照
- **残課題（B1+）**: `src/components/ui/` 配下の残り 40 プリミティブを後続 PR で段階追加

---

### 🟡 未着手（中優先度）— Next Sprint

#### ~~B2. Stripe / PayPal Webhook の Contract テスト~~ ✅ 完了 2026-05-28
- **達成内容**: `/api/webhooks/stripe` と `/api/webhooks/paypal` を新設し、固定ペイロードフィクスチャを `tests/fixtures/webhooks/` に配置。Stripe (payment_intent.succeeded / payment_intent.payment_failed / charge.refunded) と PayPal (PAYMENT.CAPTURE.COMPLETED / DENIED / REFUNDED) の主要イベントを冪等処理する Contract テスト 30 ケース + metadata 検証 2 ケースを追加（commits `338ab41` / `1d69f0f` / `2321cd8`）。署名検証・未知イベント no-op・Order 不在 404・DB エラー 500 の境界系を網羅
- **残課題**: Stripe Dashboard / PayPal Developer Portal での Webhook URL 登録は運用配線・別タスク。`PAYMENT.CAPTURE.REFUNDED` の partial 判定は元 capture lookup が必要なため当面 `Refunded` 一律マップ

#### ~~B3. Cart → Checkout の Integration テスト~~ ✅ 完了 2026-05-29
- **達成内容**: `tests/integration/cart-checkout.test.ts` を新設し、4 シナリオ計 11 テストを実装。Scenario 1 (Zustand persist hydration / 2 テスト) + Scenario 2 (shipping fee 一貫性 ITEM/WEIGHT/FIXED / 3 テスト) + Scenario 3 (`applyCoupon` server action: 正常 + 4 異常パス / 5 テスト) + Scenario 4 (未認証 `/checkout` → `/cart` redirect / 1 テスト)。基盤として testcontainers-managed PostgreSQL + 専用 jest config (`jest.integration.config.js`) + setup ヘルパー (`tests/integration/setup/{container,teardown,db,reset-db,seed,file-mock,style-mock}.{ts,js}`) を整備し、ADR-004 で技術選定の根拠 (testcontainers vs docker-compose vs services.postgres vs Neon vs SQLite) を記録
- **CI**: `.github/workflows/ci.yml` に `integration-tests` ジョブを追加。testcontainers が runner の Docker daemon を直接利用するため `services:` ブロック不要
- **コスト**: ~3.3 秒 / 11 テスト (testcontainers 起動含む)。`maxWorkers: 1` 直列実行

---

### 🟢 未着手（低優先度）— Mid–Long Term

#### B4. CI でのカバレッジ artifact 化 + dashboard 自動再生成
- **対象**: `jest.config.js`（`collectCoverage` / `coverageReporters: ['lcov', 'text-summary']` の追加）+ `.github/workflows/ci.yml`（test ジョブで `bun run test -- --coverage` + `actions/upload-artifact@<sha> # v4` で `coverage/lcov.info` を保存）
- **推奨ツール**: Jest（既存）+ `actions/upload-artifact`。任意で Codecov / Coveralls 連携
- **コスト感**: **S**（jest 設定 + CI 1 ジョブの修正）
- **期待効果**: ローカル再生成漏れによる dashboard の鮮度劣化を防ぎ、PR 上でカバレッジ artifact をレビュー可能にする。`docs/coverage-dashboard.html` の自動再生成も同ジョブで実行できれば手作業を完全に排除できる
- **背景**: 旧 OI-7（`coverage/lcov.info` が古い）の根本対応として、`QA_HANDOFF.md` の Open Issues から本セクションへ移管（2026-05-24）

---

#### ~~C1. Lighthouse CI でパフォーマンス予算化~~ ✅ 完了（2026-05-30）
- **対象**: `.github/workflows/lhci.yml` + `.lighthouserc.json`（新規）
- **採用ツール**: `@lhci/cli@0.15.1` + GitHub Actions
- **コスト感**: **M**
- **期待効果**: LCP / CLS / TBT の退行を PR で検知
- **実装**: `pull_request [main, dev]` + `workflow_dispatch` トリガー。`ci.yml` の `seed-idempotency` を土台に Postgres service → `migrate deploy` → `seed:e2e` → `build` → `bunx lhci autorun` で `/browse` を 3 回計測（`preset: desktop`）。
- **Clerk 回避策（要点）**: `clerkMiddleware` は dev インスタンス（`pk_test`）だと「dev browser cookie 不在」で FAPI への handshake リダイレクトを発行するため、偽ドメインだと collect が 400 で失敗する。本番インスタンス形式の**ダミー `pk_live` キー**（`pk_live_` + base64(`example.clerk.accounts.dev$`)、secret も `sk_live_` ダミー）にすると handshake を行わず、未認証リクエストは FAPI 未到達で `currentUser()` が null を返し公開ページが描画される（ローカル `next start` で `/browse` → 200・handshake なしを実証）。
- **残課題**:
  - assertions は **warn-only** ベースライン。数回観測後に `.lighthouserc.json` を `warn` → `error` 化して予算を厳格化（将来 issue 化）。
  - **ホーム（`/`）は計測対象外**。`src/components/store/home/main/featured.tsx:13` の `useState<number>(window.innerWidth)` が SSR で `ReferenceError: window is not defined` を投げ `/` が 500（C1 とは独立した既存バグ）。当該バグ修正後に `/` を URL リストへ追加する。

#### C2. Bundle Size の継続監視
- **対象**: `.github/workflows/bundle.yml`
- **推奨ツール**: `@next/bundle-analyzer` + `size-limit`
- **コスト感**: **S**
- **期待効果**: 依存追加による初期ロードの膨張を抑制

---

## 4. 実装中に遭遇した問題と解決

### Issue #1: Jest 30 の CLI フラグ変更
- **症状**: `bun run test -- --testPathPattern=...` が `Option "testPathPattern" was replaced by "--testPathPatterns"` でクラッシュ
- **原因**: Jest 30 (2025 リリース) で破壊的変更。複数形 `--testPathPatterns` に置き換わった
- **対応**: 全 CLI 呼び出しを `--testPathPatterns=...` に修正
- **波及**: `package.json` の `test:watch` などには影響なし (フラグ未使用)。README で開発者向けに記載検討

### Issue #2: テストケース数のセマンティクス
- **症状**: 最初の TDD ステップで `it/test/describe` を全てカウントすると、fixture の期待値 `3` に対し実測 `4` で失敗
- **原因**: `describe` は **テストケース** ではなく **グルーピングラッパー**。ケース数として数えるとミスリードになる
- **対応**: `BLOCK_PATTERN` から `describe` を除外。テスト名も「(it / test) の数」に修正
- **学び**: TDD では「期待値ありき」で実装すると、こうしたセマンティクスのズレが早期に顕在化する

### Issue #3: ドメイン数の境界 (9 vs 10)
- **症状**: `expect(DOMAINS).toHaveLength(9)` で失敗。実装は 9 ドメイン + `other` = 10
- **原因**: 「ユーザに見せる主要ドメイン」と「fallback バケット」の混同
- **対応**: `DOMAINS` には `other` を含めて 10 とし、UI 側で 0 件の `other` を非表示にする方針へ
- **副次効果**: スキャナが自分自身のテスト (`scripts/coverage-dashboard/*.test.ts`) を `other` に分類し、自己整合性のあるカウントになった

### Issue #4: components/store の二重解釈
- **症状**: `src/components/store/` と `tests/component/store/` が**ドメインは同じ** (store-ui) だが、**カテゴリは異なる** (前者: unit, 後者: integration)
- **原因**: パスベース分類のヒューリスティック設計時に、`tests/component/` プレフィックスがカテゴリを上書きする仕様を明文化していなかった
- **対応**: `categorize.ts` の `detectCategory` で `tests/component/` 配下を最優先で integration 判定
- **テスト追加**: `tests/component/store/cart.test.tsx → category=integration`、`src/components/store/foo.test.tsx → category=unit`

### Issue #5: lcov.info の鮮度 ✅ 2026-05-24 運用確定
- **再定義**: `coverage/lcov.info` は [`.gitignore:10`](../../.gitignore) で `/coverage` 全体を無視しているため **git 管理外**。古さは「リポジトリの欠陥」ではなく「ローカル生成物の状態」であり、開発者ごとにローカルで再生成する仕様
- **運用**: `bun run test -- --coverage` → `bun run coverage:dashboard` の順で実行し、`docs/coverage-dashboard.html`（こちらは git 追跡）のみコミットする
- **CI 自動化**: → [§3 B4](#b4-ci-でのカバレッジ-artifact-化--dashboard-自動再生成) に移管

### Issue #6: CI ワークフロー未整備
- **症状**: `.github/workflows/` ディレクトリが存在せず、coverage / lint / type check / e2e のいずれも PR ブロックされない
- **影響**: テストを書いても「実行されているか」が保証されない → ダッシュボードのステータスが意味を持ちにくい
- **根本対応**: GitHub Actions で最低限 `bun run lint` + `bun run test` + `bun run build` の 3 ジョブを走らせる必要あり (本タスクのスコープ外)

### Issue #7: ダッシュボードの自己参照
- **症状**: `scripts/coverage-dashboard/*.test.ts` (5 本) が `other` ドメインの unit セルに加算される
- **判断**: バグではなく **自己整合性のある仕様**。スクリプト自体もテスト対象である以上、カウントされるべき
- **副次効果**: 65 → 60 にしたい場合は `IGNORED_DIRS` に `scripts` を追加すれば良いが、ドッグフード性を残すためにあえて未対応

---

## 5. ダッシュボードの再生成

```bash
# 最新の lcov を取得してから生成すると数値が正確
bun run test -- --coverage   # lcov.info を更新 (任意)
bun run coverage:dashboard   # docs/coverage-dashboard.html を再生成
```

実行ログ例:

```
[coverage-dashboard] scanning /path/to/repo
[coverage-dashboard] found 65 test file(s)
[coverage-dashboard] parsed lcov entries: 50
[coverage-dashboard] matrix: 11/80 cells covered (14%)
[coverage-dashboard] wrote docs/coverage-dashboard.html (118.1 KB)
```

### モジュール構成

| ファイル | 責務 | 単体テスト数 |
|---|---|---|
| `scripts/coverage-dashboard/scan-tests.ts` | テストファイル列挙 | 6 |
| `scripts/coverage-dashboard/categorize.ts` | パス → (category, domain) 分類 | 27 |
| `scripts/coverage-dashboard/parse-lcov.ts` | LCOV → ファイル別カバレッジ% | 7 |
| `scripts/coverage-dashboard/build-matrix.ts` | マトリクス + サマリ集計 | 7 |
| `scripts/coverage-dashboard/render-html.ts` | Editorial Laboratory HTML 生成 | 11 |
| `scripts/coverage-dashboard/build.ts` | CLI エントリ | — |

合計 **58 本** の Jest テスト (AAA パターン / TDD 開発)。

---

## 6. 関連ドキュメント

- [`docs/coverage-dashboard.html`](./coverage-dashboard.html) — 視覚的ダッシュボード本体
- [`docs/testing/TESTING_DESIGN.md`](./TESTING_DESIGN.md) — テスト設計の全体方針
- [`docs/testing/QA_TEST_PERSPECTIVES.md`](./QA_TEST_PERSPECTIVES.md) — QA 観点リスト
- [`docs/testing/TEST_IMPLEMENTATION_PLAN.md`](./TEST_IMPLEMENTATION_PLAN.md) — 実装計画
- [`scripts/coverage-dashboard/README.md`](../../scripts/coverage-dashboard/README.md) — ダッシュボード生成スクリプトの開発者向け解説
- [`specs/multi-vendor-ecommerce/07-testing.md`](../../specs/multi-vendor-ecommerce/07-testing.md) — テスト要件 (SDD)

---

## 7. 履歴

| 日付 | 出来事 |
|---|---|
| 2026-05-21 | ダッシュボード初回生成。本レポート作成 (commit `41c9fd9`) |
| 2026-05-21 | Phase 1 基盤テスト検証完了。テスト総数 881 → 945、型エラー 0 件に (commits `8e8df92`–`ad6bbc7`)。ダッシュボード再生成。 |
| 2026-05-21 | **A1 完了**: SECURITY_GAP_REPORT.md 作成。IDOR 脆弱性 2 件（paypal/stripe）を修正。認可テスト 14 ファイル全調査・補完。Security の queries 列が `◯` → `✦` に昇格 (commits `55c07b1`, `03a7e89`). |
| 2026-05-21 | **A2 完了（baseline 未コミット）**: `tests/e2e/visual/` に cart/checkout Visual Regression spec を追加。`playwright.config.ts` に安定化設定を追加。Visual の pages 列が `◯` → `◐` に昇格 (commit `f639334`). |
| 2026-05-21 | **A3 完了**: `tests/e2e/a11y/` に sign-in / seller-apply の WCAG 2.1 AA スキャンを追加（`@axe-core/playwright`）。a11y の pages 列が `◯` → `◐` に昇格 (commit `d261d76`). |
| 2026-05-22 | PayPal `capturePayPalPayment` の try-catch リファクタリング (commit `217bf76`). |
| 2026-05-24 | **A4 完了**: `src/lib/auth-guards.ts` 導入 → 6 ファイルの認可をヘルパー集約。IDOR テスト 3 階層化（where 構造検証 + 副作用なし検証）で +8 件。テスト総数 1008 → 1016。lcov 95 → 96。詳細は [`SECURITY_GAP_REPORT.md §5`](./SECURITY_GAP_REPORT.md#5-追加調査拡充2026-05-24--a4-認可ガード統合--idor-3-階層化) を参照 (commits `a73603e`–`ae66fac`). |
| 2026-05-26 | **B1+ Sprint 1 完了**: Tier 1 前半 10 プリミティブ snapshot 追加（aspect-ratio / separator / progress / switch / checkbox / radio-group / slider / toggle / tooltip / popover）。テスト総数 1016 → 1042 (+26)、Jest snapshot 40 → 66。インフラ: `tests-setup/jest.setup.ts` に ResizeObserver スタブ追加（Radix `useSize` 系の基盤）(commits `b55e177`〜`66fb8d5`, `6545fce`). |
| 2026-05-28 | **B1+ Sprint 2 完了**: Tier 1 後半 11 プリミティブ snapshot 追加（alert / alert-dialog / avatar / breadcrumb / collapsible / hover-card / input-otp / pagination / resizable / scroll-area / chart）。テスト総数 1042 → 1069 (+27)、Jest snapshot 66 → 93 (+27)。chart は recharts ResponsiveContainer の jsdom 0-size 警告を console.warn spy で抑制。hover-card は role 無しのため getByText で styled HoverCardContent を取得 (commits `750d830`〜`45c339b`). |
| 2026-05-28 | **B1+ Sprint 3 完了**: Tier 2 全 8 プリミティブ snapshot 追加（dropdown-menu / context-menu / menubar / sheet / drawer / tabs / toggle-group / table）。テスト総数 1069 → 1088 (+19)、Jest snapshot 93 → 112 (+19)。class-heavy な Menu snapshot を理由に 1 ファイル 1 commit で分離（Menu family 同梱は 200 行閾値超過）。context-menu は fireEvent.contextMenu / menubar は Root defaultValue で open 状態を再現 (commits `e6c79e3`〜`4429b8b`). |
| 2026-05-28 | **B1+ Sprint 4 完了 / NA-NS-01 archive (B1+ 全完了)**: Tier 3 + 補助 全 11 プリミティブ snapshot 追加（form / calendar / carousel / command / sidebar / navigation-menu / sonner / accordion / toast / toaster / data-table）。テスト総数 1088 → 1103 (+15)、Jest snapshot 112 → 127 (+15)。**49/49 shadcn/ui プリミティブカバー達成**。インフラ: `tests-setup/jest.setup.ts` に IntersectionObserver / matchMedia / Element.scrollIntoView スタブ追加（embla-carousel-react / cmdk 基盤）。`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から NA-NS-01 を削除しアーカイブ化 (commits `1b207ba`〜`8e429f2`, infra: `222d16e` / `ab07840`). |
| 2026-05-28 | **B2 完了 / NA-NS-02 archive**: Stripe/PayPal Webhook ハンドラーを新規実装（`/api/webhooks/stripe` + `/api/webhooks/paypal`）。Stripe `webhooks.constructEvent` 署名検証 + PayPal `verify-webhook-signature` API 呼び出し（OAuth Bearer フロー）+ 冪等な PaymentDetails upsert を導入。固定ペイロードフィクスチャを `tests/fixtures/webhooks/{stripe,paypal}/` に配置し Contract テスト 30 ケース + metadata 検証 2 ケース追加。テスト総数 1103 → 1135 (+32)、スイート 110 → 112 (+2)。前提として `src/queries/stripe.ts` `paypal.ts` に `metadata.orderId` / `purchase_units[].custom_id` を付与し Webhook 相関を可能化 (commits `338ab41` / `1d69f0f` / `2321cd8`). |
| 2026-05-31 | **Unit 行✦化（seed 除く）**: `jest.config.js` に logic-centric な `collectCoverageFrom` + `coverageReporters` と画像/スタイルの moduleNameMapper を追加。co-located unit テスト 10 ファイル（shared 3 / store 3 / dashboard 3 / pages 1、+42 テスト・+10 スイート、1137 → 1179）で Unit 行の `pages / store / dashbd / shared` を ◯ → ✦ に昇格。`api` は構造的 N/A（categorize で api-contract 固定）、`seed` は分母外（意図的）、`hooks`/`other` は既存スキップ起因の ◐。詳細は §2 注記 / [`QA_HANDOFF.md`](./QA_HANDOFF.md)。 |
| 2026-05-29 | **B3 完了 / NA-NS-03 archive**: Cart → Checkout の状態橋渡しを Integration tier で初カバー。`tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テスト（Zustand persist hydration / shipping fee 一貫性 ITEM・WEIGHT・FIXED / `applyCoupon` 正常+4 異常パス / 未認証 redirect）。基盤として testcontainers + 専用 jest config (`jest.integration.config.js`) + 5 setup ヘルパーを新設（ADR-004 で技術選定の根拠を記録）。CI workflow に `integration-tests` ジョブを追加。`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から NA-NS-03 を削除しアーカイブ化。Integration マトリクスの queries / pages / lib セルが ✦ に遷移. |
