# ADVISOR_STATE — improve スキル監査の進行状態

> **目的**: セッションを跨いでも次セッションで即再開できるようにする状態ファイル。
> 各マイルストーン完了ごとに更新し、`docs(plans): ...` でコミットする。
> **ソースコードは一切変更しない**（improve スキル Hard Rule 1）。
>
> **編集可能範囲（Hard Rule 1 の適用範囲）**: **原則 `plans/**` のみ**。
> ただし**ラウンドごとに宣言されたスコープ例外**があり、実際に R4〜R9 では
> 以下も編集対象になっている（「`plans/**` のみ」と読むと、各ラウンドが実際に
> 行った docs 同期・ダッシュボード再生成が規約違反に見えてしまう）:
>
> | 例外 | 対象 | 適用ラウンド |
> |---|---|---|
> | テスト関連ドキュメント | `docs/testing/**` | R4〜R9（テスト統計の同期義務: `.claude/rules/02-tdd-step-commit.md`） |
> | カバレッジ生成物とその SSOT | `scripts/coverage-dashboard/render-html.ts` + 生成物 `docs/coverage-dashboard.html` | R4〜R9 |
> | direction の正式版昇格分 | `docs/architecture/expansion/**` 等 | 昇格を行ったラウンドのみ（下記「正式版昇格」節参照） |
>
> **例外はラウンド開始時に明示的に宣言すること**（宣言のない範囲外編集は Hard Rule 1 違反）。
> いずれの場合も **`src/` のソースコードは一切変更しない**という中核は不変。
>
> **⚠️ ただし Hard Rule 1 が適用されるのは「improve スキルの監査ラウンド」だけである**。
> 本ファイルは監査ラウンド（R1〜R9・R13）に加えて、**CodeRabbit レビュー由来の
> triage / 実装ラウンド（R10〜R12・R14）も履歴として記録**している。後者は improve
> スキルの実行ではないため Hard Rule 1 の管轄外で、**Round 14 は実際に `src/` と
> `tests/` を変更している**（それが目的のラウンドであり、違反ではない）。
> ラウンドごとの性格は下表のとおり:
>
> | ラウンド | 性格 | Hard Rule 1 | `src/` 変更 |
> |---|---|---|---|
> | R1〜R9・R13 | improve スキルの監査 | **適用** | なし（各ラウンドのクローズで機械検証済み） |
> | R10〜R12 | CodeRabbit 指摘の triage（plans/ の文書修正） | 管轄外（結果的に `plans/**` のみ） | なし |
> | **R14** | CodeRabbit 指摘の **triage + 実装** | **管轄外** | **あり（決済・注文冪等性の 6 コミット）** |

---

## Round 14 — CodeRabbit レビュー第4弾 + Phase A 実装（**監査ではない** / 2026-07-19）

> **⚠️ 本ラウンドは improve スキルの監査ラウンドではない。** CodeRabbit の指摘に対する
> **実装セッション**であり、`src/` と `tests/` を実際に変更している。
> `git diff 72e8004..b5d0c66 --stat -- src tests` は**空ではない** —
> 他ラウンドのクローズ条件（diff 空の機械検証）を本ラウンドに適用しないこと。

- **対象範囲**: `72e8004..b5d0c66`（branch: `dev` / **6 コミット**）。
  左端は **baseline `72e8004`**（Round 13 末尾）。`934b6fa` は**範囲内の A-2 修正コミット**であり
  baseline ではない — `A..B` は A を含まないため、`934b6fa..b5d0c66` と書くと A-2 が脱落する
- **出所**: CodeRabbit が `dev`（vs `main` / 81 ファイル）に実施したレビュー。
  VSCode「問題」パネルの **114 件**（⚠49 + ⓘ65）は **NEW REVIEW + PREVIOUS REVIEWS (2)
  の合算**であり新規指摘数ではない。精査後の実体は `plans/ja/*` ミラー重複 5 /
  言い換え重複 4 / 既に解消済み（誤検知）3 / **要対応 約 81**（コード 5 + 文書 76）
- **実行計画**: `~/.claude/plans/claude-rules-02-tdd-step-commit-md-peaceful-globe.md`
- **ユーザー確認済みの決定**:
  - Phase A（コード修正）は **TDD（Red → Green）**・1 論理単位 = 1 コミット
  - PayPal settled ガードの CAS 不一致は既存メッセージ `"Order payment is already settled."`
    で再 throw する（read-then-act の事前判定は無駄な PayPal API 呼び出し回避のため**残す**）
  - `PaymentDetails.amount` は**ドル建てに統一**（`schema.prisma:699` の `Decimal(12,2)` に従う。
    マイグレーション不要 — Stripe 側のコード修正のみ）
  - `placeOrder` の冪等性は**カート行を使い捨てトークン**として扱う（マイグレーション不要）
- **採番**: 監査台帳は新設せず、**`audit/VETTED_FINDINGS.md` の「Round 14 追記」節**に記録
  （R10〜R12 の triage ラウンドと同じ扱い）

### Round 14 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | Phase A-1 PayPal settled ガードの CAS 原子化 | ✅ DONE | `4261be0`（`paypal.ts` + `paypal.test.ts`） |
| 2 | Phase A-3 `PaymentDetails.amount` のドル建て統一 | ✅ DONE | `e63474b`（`stripe.ts` + `stripe.test.ts`） |
| 3 | Phase A-5 `placeOrder` のサーバー側冪等性 | ✅ DONE | `824e224`（`user.ts` + `user.test.ts`） |
| 4 | Phase A-4a spy リーク修正（`afterEach` へ集約） | ✅ DONE | `15aef5c`（`index-products/route.test.ts`） |
| 5 | Phase A-4b security-headers E2E の status 検証 | ✅ DONE | `b5d0c66`（`security-headers.spec.ts`） |
| 6 | Phase A-2 `custom_id` 検証の上流化 | ✅ DONE | `934b6fa`（`paypal.ts` + `paypal.test.ts`）。※初版で「不要」と誤記録 — 下記訂正記録を参照 |
| 7 | Phase B 監査台帳の整合性回復（本タスク） | ✅ DONE | findings-06/13/14/17 + VETTED_FINDINGS + README ×2 + 本ファイル（1 ファイル = 1 コミット） |
| 8 | Phase C 個別プラン文書 約 60 件 | ⬜ **未着手** | `plans/003`〜`plans/062`。1 プラン = 1 コミット |

### Round 14 の rejected（0 件）

**本ラウンドに rejected はない。** Phase A は計画どおり A-1〜A-5 の **6 コミット全てが実装済み**。

> **⚠️ 訂正記録（本節の初版が誤っていた — 再発防止）**
>
> 初版はここで A-2 を「却下（前提が誤り・既に充足済み）」とし、根拠に
> `git show 934b6fa:src/queries/paypal.ts` を「ラウンド開始時点」として引いていた。
> **`934b6fa` は baseline ではなく A-2 の修正コミットそのもの**であり、
> 「修正後」を「修正前」と取り違えた **`A..B` 記法の off-by-one** だった。
>
> 真の baseline `72e8004` では `status !== "COMPLETED"` が **L219**、
> `capturedCustomId !== orderId` が **L242** の順で、**脆弱性は実在した**
> （`934b6fa` 適用後に L228 → L233 へ逆転）。
>
> **判断基準（次ラウンドへ引き継ぐ）**: 「既に解消済みでは」と判定する前に、
> **参照リビジョンが baseline か修正後かを確認する**。baseline を見るなら `A^` を使う。
> 詳細な訂正記録は [`audit/VETTED_FINDINGS.md`](audit/VETTED_FINDINGS.md) の Round 14 節。

### Round 14 が解消した既存 deferred

- **「Server-side `placeOrder` idempotency」**（plan 006 から deferred）→ **A-5 で解消**。
  ただし同項目に併記されていた **`applyCoupon` の lost-update `$transaction` リファクタは未解決**
  （別事案として分離済み — `README.md` Deferred 節）。
- **CORRECTNESS-05**（`PaymentDetails.amount` 単位不一致）→ **コード側は A-3 で解消**。
  **既存行の backfill は未起票**（過去の Stripe 決済行はセント値のまま残る）。
- **TESTS-02 capture 経路** / **`saveUserCart` 統合** → 先行依存だった plan 003 / 005 が
  DONE になり、**deferred 理由そのものが失効**（昇格の再評価対象）。

---

## Round 13 — セキュリティ特化 deep 監査（`deep security` フォーカス / 開始 2026-07-17）

- **開始日**: 2026-07-17 / **監査対象 HEAD**: `7080b12`（branch: `dev` — Round 12 triage クローズ
  コミット。R10〜12 は CodeRabbit triage ラウンドで、`src/` には plan 003/005/006 相当の
  fix コミット群（`f046d22` / `ab97f8f` / `cc7468c` 等）が入っている — Round 9 以前と異なり
  **ソースが動いた後の初のセキュリティ監査**）
- **バリアント**: `security` フォーカス・**effort = deep**（リポジトリ全体・全セキュリティ領域を
  並列 Explore サブエージェント ≤8 で網羅）。Round 1 の findings-02（SECURITY-01〜09）と
  security follow-up（findings-11 / NEW-1〜3）に続く第 3 のセキュリティラウンド
- **目的**: Amazon 級の世界トップクラス EC サイトを目標水準として、認可/IDOR・インジェクション/XSS・
  決済/ビジネスロジック悪用・Webhook/SSRF・ヘッダ/CSP/レート制限・依存/サプライチェーン/PII の
  6 領域を deep 監査し、新規所見を Sonnet が zero-context で実行できる自己完結プラン
  （**058〜**）に落とす
- **ユーザー確認済みの決定**:
  - 実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/`・`docs/` は無変更）
  - プラン承認済み（`~/.claude/plans/agent-skills-improve-skill-md-amazon-ec-drifting-breeze.md`）
  - **effort = deep**（AskUserQuestion で明示選択）
  - **プラン化は自動選定**（vet 済み所見からレバレッジ順 3〜6 本目安。水増しせず、候補が
    薄ければ正直に減らす — R7 前例。AskUserQuestion で明示選択）
  - 成果物は日本語のみ（Round 2 以降の決定を継承）
  - **編集可能範囲は `plans/**` のみ**（スコープ例外なし — R4〜R9 の docs/testing 例外は
    本ラウンドでは不要: テスト統計が動かないため）
  - 既 vet/rejected（SECURITY-01〜09・NEW-1〜3・VETTED_FINDINGS の rejected・
    決定済みトレードオフ ADR-001 CSRF 等）の再監査はしない
- **既知の reconcile 対象（Step 2 で実測確認 → Step 6 で README 修正）**: findings-11 冒頭注記は
  「023/024 は実装済み（回帰テストあり）」と記すが README Status 表は両方 TODO のまま。
  直近 git log の fix コミット群から 003/005/006 も DONE の可能性が高い
- **採番**: 監査台帳 = `audit/findings-18-security-r13.md` / 新規所見 = SECURITY-10〜 /
  新規プラン = 058〜
- **成果物**: findings-18（監査台帳・clean 再確認 + 新規所見 + deferred + rejected）+
  plans 058〜（自動選定分）+ README 索引（Status ドリフト修正含む）+ VETTED_FINDINGS R13 追記

### Round 13 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション（`82febbf`） |
| 2 | Recon リフレッシュ（ベースライン実測 + 既存資産突合 + 実装状態 reconcile） | ✅ DONE | findings-18 §0（`03f9a74`）。`tsc` 0 / `lint` 0 / `bun audit` 90。023/024 の Status ドリフト検出 |
| 3 | deep 監査（並列サブエージェント A〜F） | ✅ DONE | 6 領域 Explore（認可/入力/決済/webhook/ヘッダ/依存）。全所見を本体が file:line で vet |
| 4 | Vet + 監査台帳（findings-18 + VETTED_FINDINGS R13 追記） | ✅ DONE | `d2aff76`。新規 SECURITY-10〜19 + AUTHZ/LOGIC + DEPS-06、clean 領域・rejected 記録 |
| 5 | plans 058〜 執筆（自動選定・1 プラン = 1 コミット） | ✅ DONE | 058（`2a1e6b6`）/ 059（`56ae6fb`）/ 060（`efcbffa`）/ 061（`cdfa685`）/ 062（`3ba0f6c`） |
| 6 | README 索引更新（058〜 追加 + Status ドリフト修正 + deferred/rejected 記録） | ✅ DONE | `c148915`。058〜062 追加・023/024 を DONE 補正・sequencing #16・deferred/rejected R13 |
| 7 | ADVISOR_STATE クローズ（`git diff 7080b12..HEAD --stat -- src tests prisma` = 空 を検証） | ✅ DONE | 本コミット。**検証: diff 空を確認済み（src/tests/prisma 無変更）** |

### Round 13 クローズ記録（2026-07-17）

- **成果物**: 監査台帳 `audit/findings-18-security-r13.md`（新規 SECURITY-10〜19・AUTHZ-02/03・
  LOGIC-22/23・SECURITY-24・DEPS-06、clean 6 領域の再確認、rejected/by-design）+ VETTED_FINDINGS
  Round 13 節 + プラン **058〜062**（5 本）+ README 索引（Status ドリフト修正含む）。
- **プラン選定（自動・水増しなし）**: HIGH confidence × 高レバレッジ 5 本に限定。
  - **P1**: 058（getCoupon cross-store IDOR read）/ 059（PayPal capture 金額・相関・通貨検証 +
    settled ガード）/ 060（クーポン mutation のサーバー側 Zod 検証・discount>99→負値 total 防止）
  - **P2**: 061（レスポンス強化ヘッダ・clickjacking/HSTS 等）/ 062（検索 route の生 error.message
    漏洩停止 + `error:any` 撤去）
- **未プラン化の既存所見をプラン化**: SECURITY-05（→062）・SECURITY-06（→061）は Round 1 で
  fix sketch 止まりだったものを Sonnet 実行可能プランに昇格。
- **reconcile 修正**: plans 023 / 024 を README で DONE に補正（実装済みだが TODO のままドリフト）。
- **機械検証**: `git diff 7080b12..HEAD --stat -- src tests prisma` = **空**（ソース無変更を確認）。
  本ラウンドの全コミットは `docs(plans):` / `docs(audit):` 形式・1 マイルストーン=1 コミット。
- **次アクション（実行順）**: 依存 P1 の **057**（`next` bump）と本ラウンド P1 の **058→059→060**
  を優先（相互にファイル競合なし・並行可）。次いで 061 / 062。deferred 11 件は findings-18 §3 の
  昇格条件つき（dompurify は依存 refresh、SECURITY-15 は 060 の横展開、SECURITY-24 は仕様判断先行 等）。

---

## Round 9 — E2E 残余監査（`tests` フォーカス・E2E 限定 第 2 弾 / 開始 2026-07-12）

- **開始日**: 2026-07-12 / **監査対象 HEAD**: `25e50d9`（branch: `dev` — R8 クローズコミット。
  R8 監査 HEAD `fbd1020` からソース `src/ tests/ prisma/` は無変更 — R8 クローズ時に diff 空を検証済み）
- **バリアント**: `tests` フォーカス・**E2E（Playwright）限定**の第 2 弾（R6/R7 の integration
  残余監査と同型）。R8 が「既存 15 spec の 3 ブラウザ実測 + 主要導線ギャップ」をスイープ済みの
  ため、R9 は **R8 未スイープの新規切り口** + **R8 deferred の再裁定** の 2 軸で残余を精査する
- **目的**: 追加が必要な E2E テスト項目を Sonnet が zero-context で実行できる自己完結プラン
  （**051〜**）に落とす。あわせて docs/testing 精査・更新と coverage-dashboard.html 再生成
  （R4〜R8 と同じ Hard Rule 1 のスコープ例外: `plans/**`・`docs/testing/**`・
  `scripts/coverage-dashboard/render-html.ts`・生成物 HTML のみ編集可）
- **ユーザー確認済みの決定**:
  - テストコードの実装は一切しない（プラン化のみ。`src/`・`tests/`・`prisma/` は無変更）
  - プラン承認済み（`~/.claude/plans/agent-skills-improve-skill-md-e2e-sonne-splendid-pudding.md`）
  - **ベースライン再実測なし**: ソース無変更のため R8 実測 #2（52 passed / 17 failed /
    39 skipped / 3 did not run / 25.5m — findings-16 参照）を SSOT として引き継ぐ。Docker は
    起動済みだが個別候補のスポット検証（curl 等の読み取り系）に限定して使用
  - プラン化対象は**監査台帳完成後にユーザーが選択**（R8 方式・AskUserQuestion で PAUSE）
  - plans 042〜050 とシナリオ・対象 UI が重複するプランは作らない。候補が薄ければ
    水増しせず本数を減らす（R7 前例）
- **R9 監査の切り口（recon 済み候補仮説 — 台帳で vet）**: (1) サインアップ導線 /
  (2) Newsletter 購読の dormant 404 疑い（`newsletter.tsx:41` が `fetch('/api/newsletter')` するが
  route 不在）/ (3) 国選択セレクタ + `userCountry` cookie / (4) ゲストカート→ログイン時マージ /
  (5) a11y 対象拡大（home/browse/product/cart — TESTS-26 非依存）/ (6) VRT 対象拡大 /
  (7) 404・サインアウト等の残余スイープ / (8) R8 deferred 再裁定（ソース無変更のため維持確認のみ）
- **採番**: 監査台帳 = `audit/findings-17-e2e-coverage-r9.md` / 新規所見 = TESTS-39〜 /
  新規プラン = 051〜
- **成果物**: findings-17（監査台帳・ギャップ全量 + deferred + rejected）+ plans 051〜
  （ユーザー選択分）+ README 索引 + docs/testing 同期 + ダッシュボード再生成

### Round 9 チェックリスト

| # | マイルストーン | 状態 | 成果物 / コミット |
|---|---|---|---|
| 1 | ADVISOR_STATE 新ラウンド記録 | ✅ DONE | 本セクション / `95d1308` |
| 2 | 残余監査（候補 1〜8 の vet）+ 監査台帳（TESTS-39〜44 + deferred 再裁定 5 件維持 + rejected 3 件） | ✅ DONE | `audit/findings-17-e2e-coverage-r9.md` / `99ede89`（再実測なし — R8 実測 #2 を SSOT 引き継ぎ。スポット検証: `/api/newsletter` curl **404** 実測。TESTS-44 は plan 054 執筆時の再監査で Evidence 訂正 — seed 画像はローカルアセット / `b8c81cb`） |
| 3 | ギャップ一覧の提示 → ユーザー選択（プラン化対象の確定・PAUSE） | ✅ DONE | AskUserQuestion で全 6 所見（TESTS-39〜44）**すべてプラン化**を決定（deferred の再昇格なし） |
| 4 | plans 051〜056 執筆（選択分・1 プラン = 1 コミット） | ✅ DONE | 051 `0f9460b` / 052 `f631cbd` / 053 `14a83a8` / 054 `b8c81cb`（+ TESTS-44 訂正）/ 055 `46868c8` / 056 `a10dabc` |
| 5 | README 索引更新（051〜056 追加・推奨順序 #13・R9 deferred/rejected 記録） | ✅ DONE | `c89914d` |
| 6 | docs/testing 精査・更新（QA_HANDOFF R9 プロンプト / COVERAGE_REPORT §3 R9 / PERSPECTIVES §20 +5 行 / TEST_IMPLEMENTATION_PLAN Phase 6。TESTING_DESIGN は新パターン導入なしのためドリフトなし → 無変更を記録） | ✅ DONE | `f7368c2` |
| 7 | NEXT_ACTIONS R9 追加 + coverage-dashboard.html 再生成（lint 0 エラー・15 警告 / tsc ソース 0 エラー — `.next/` 生成物内の 2 件は稼働中 dev コンテナと過去本番ビルドの型スナップショット競合による環境ノイズで追跡対象外） | ✅ DONE | `f6a9b7a` |
| 8 | ADVISOR_STATE クローズ（`git diff 25e50d9..HEAD --stat -- src tests prisma` = 空 を検証） | ✅ DONE | 本コミット。`git diff 25e50d9..HEAD --stat -- src tests prisma` = **空**（ソース無変更を機械検証）。QA_HANDOFF R9 ↔ NEXT_ACTIONS R9 は plans 051〜056 で一対一対応を確認 |

**Round 9 完了（2026-07-12）**。ソースコード（`src/` `tests/` `prisma/`）は無変更。
成果物: `audit/findings-17-e2e-coverage-r9.md`（TESTS-39〜44 + R8 deferred 5 件の維持再裁定 +
rejected 3 件。全所見を直接コード読解で vet・Newsletter 404 は curl 実測）+ plans **051〜056**
（6 本すべてユーザー選択・Sonnet 実行可能な自己完結形式）+ README 索引 + docs/testing
4 ファイル同期 + ダッシュボード再生成。
特記事項: (1) **Newsletter dormant 404 はアプリ側の新規発見ギャップ**（route + schema とも不在）—
成功系は機能実装プランの起票が先で、plan 056 は現挙動の characterization（実装時に意図的 fail
して書き直しを強制する設計）。(2) home（`/`）の a11y / VRT は OI-9 解消後の追加項目として
plan 052 / 054 の Maintenance notes に記録。
次のアクション: **051（依存ゼロ・P1）と 056 は即実行可能**。R8 plans 042〜050 の実行と併走する
場合の依存順は plans/README「Recommended sequencing #13」参照（052 ← 042 Step 4 /
055・053 サインアウト部 ← 042 / 054 ← 043）。E2E の未スイープ切り口は本ラウンドでほぼ枯渇 —
次ラウンドを行う場合は plans 042〜056 の実行結果と OI-9 / OI-11 の解消状況を先に確認すること。

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
| 4 | プラン執筆（1プラン=1コミット、`.agent/skills/improve/references/plan-template.md` 準拠） | ✅ DONE | `plans/001〜012-*.md` / Commit 5..16 |
| 5 | 索引 `plans/README.md`（実行順・依存・ステータス表・rejected） | ✅ DONE | 最終コミット |

## 次のアクション（NEXT）

> **本節はファイル末尾寄りにあるが「Round 1 の続き」ではなく、全ラウンドを通じた現在地**である。
> ラウンド節は降順（最新が上）に並ぶのに本節だけが Round 1 節の末尾に置かれているため、
> **更新漏れが起きやすい構造**になっている（実際に Round 13 まで「最新は Round 9」「次は 057」の
> ままドリフトし、**完了済みプランを次アクションとして推奨していた**）。
> **ラウンドをクローズしたら必ず本節も更新すること。**

**✅ 最新ラウンドは Round 14（CodeRabbit 第4弾 + Phase A 実装）で、2026-07-19 時点で
Phase A / Phase B が完了。** Round 14 は**監査ではなく実装ラウンド**であり、
`src/` `tests/` は変更されている（R4〜R13 の「無変更」規律は本ラウンドに適用されない）。

### 直近の着手先

1. **Round 14 Phase C（約 60 件）— 最優先**。`plans/003`〜`plans/062` の個別プラン文書に
   対する CodeRabbit 指摘。**1 プラン = 1 コミット**。
   **⚠️ 実装が DONE のプラン（001–009・023・024・057–062）は Phase C の着手先から除外する** ——
   下の「完了済み」節と重複するため、着手先として再掲しない（doc 指摘が残る場合も、
   セキュリティ実装系①はすべて DONE なので新規着手対象ではない）。**残る着手先**は依存の強い順で
   ①spike 系（013–022・025）→ ②テスト計画系（027–041）→ ③E2E 系（042–056）→ ④その他 docs。
   **⚠️ 約 15 件はタイトルだけでは修正内容を確定できない**ため、着手時に該当コメントの
   詳細本文を入手すること（Round 11 判断基準 3）。
2. **未実行プランの実行**。**058〜062 は全て DONE**。残る TODO は
   **[`README.md`](README.md) の Status 表を正とする**（本節に一覧を再掲しない —
   二重管理でドリフトさせないため）。E2E 系は **042 が絶対の先頭**（signIn ヘルパーの
   Clerk UI ドリフトで認証系 16 件が全滅中 / 047–050・052・055 が待ち）。
   依存ゼロで即着手できるのは **051 / 056 / 044 / 045**。
3. **Round 14 が生んだ未起票の残件**（いずれも小さく独立）:
   - `PaymentDetails.amount` の**既存行 backfill**（コード修正は `e63474b` で完了済み）
   - `applyCoupon` の lost-update `$transaction` リファクタ
   - 住所 `default: true` 重複バグの remediation（plan 037 の characterization が先行）

### 完了済み（次アクションとして推奨しないこと）

**001–009・023・024・057–062 は DONE**。とくに **057（`next` bump）は
`~16.2.10` で着地済み**であり、過去の本節が「次に実行する」と書いていたのは
**Round 13 時点で既に古い記述**だった。実行実態は常に
**[`README.md`](README.md) の Status 表**が SSOT。

### 新ラウンドを起こす場合

- **E2E**: 未スイープ切り口は Round 9 でほぼ枯渇 → plans 042〜056 の実行結果と
  OI-9 / OI-11 の解消状況を先に確認する。
- **Integration**: 先行依存だった plan 003 / 005 が DONE になり、**TESTS-02 capture 経路と
  `saveUserCart` 統合の deferred 理由が失効**している（昇格の再評価が可能）。
- **Security**: Round 13 deferred 11 件が `audit/findings-18-security-r13.md` §3 に
  昇格条件つきで残る。**SECURITY-17（webhook の無条件上書き）は Round 14 の A-1 が
  確立した CAS イディオム（`paypal.ts` の `notSettled()`）を横展開すれば解消**でき、
  昇格条件がより具体化している。

---

### 完了記録（参考）

**Round 3 完了（2026-07-10）**: `direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` +
spike プラン 018〜022 + `audit/findings-10-direction-operations-growth.md` +
EXPANSION_BLUEPRINT §5 ロードマップ統合 + README 索引更新。
当時の次アクション候補（**未着手のものは現在も有効**。ただし着手順は上記 NEXT を優先）:

1. Round 1 の実行フェーズ: security 001–004 を `execute <plan>` で最優先実施
2. Round 2 の spike 実行: 013 → 014 → 015 の順（016/017 は独立）。各 spike は設計文書 +
   後続実装プランを生成して STOP する
3. Round 3 の spike 実行: 021（通知 — C の共通前提）→ 018 → 019 → 022 の順、020 は独立。
   018/022 は状態遷移記録方式を一本化（先行した方の決定に従う）
4. ブランド方針が決まったら**`docs/architecture/expansion/` 側**の該当ファイルを更新する
   （2026-07-10 の昇格により、`direction/` の 2 ブループリントは凍結済みの履歴。
   更新先は docs 側 — [`README.md`](README.md) の SSOT 注記を参照）

**Round 2 完了記録（2026-07-09）**: `direction/EXPANSION_BLUEPRINT.md` + spike 013〜017 +
`audit/findings-09-direction-expansion.md` + README 索引更新。

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
（.agent/skills/improve/SKILL.md）の deep 監査を「次のアクション（NEXT）」から再開してください。
ルール: advisor 自身によるソースコード編集は禁止（Hard Rule 1。ただし execute
バリアントは別の executor サブエージェントを隔離 worktree に派遣してコードを
編集させ、advisor はその diff をレビューして判定する — この経路は禁止ではない）・
advisor 自身の成果物は plans/ 配下のみ・各マイルストーンで
plans/ のみを docs(plans): 形式でコミット・プランは references/plan-template.md 準拠で
zero-context executor 向けに自己完結・カテゴリ網羅（セキュリティ/direction 必須）で自動作成。
完了済みフェーズは再実行せず、このファイルのチェックリストを更新しながら進めること。
```

## 完了済みの要点（**Round 1 時点の記録** — 現在値ではない）

> **⚠️ 本節は Round 1（2026-07-03 / HEAD `f9752c0`）時点のスナップショットであり、
> 「次セッションが再導出しなくてよい**現在の**事実」ではない。** 見出しが
> 「完了済みの要点」であるため現況表と誤読されやすいが、以下の数値・判定の多くは
> 後続ラウンドで変化している。**現在値が必要なときは実測するか、下表の参照先を見ること。**
>
> | 項目 | Round 1 時点 | 現在（最終確認: 2026-07-19 / Round 14） |
> |---|---|---|
> | `bun audit` | 97 件 | **90 件**（critical 1 / high 30 / moderate 45 / low 14 — Round 13 実測。詳細 `audit/findings-18-security-r13.md` §0） |
> | `@clerk/nextjs` | `^7.0.7`（CRITICAL 影響圏内） | **`^7.5.0`**（[plan 004](004-upgrade-clerk-nextjs-security.md) DONE で解消） |
> | `next` | `^16.2.1` | **`~16.2.10`**（[plan 057](057-upgrade-next-middleware-bypass.md) DONE。R1 の「最新・対応不要」判定は撤回済み） |
> | `applyCoupon` ロストアップデート | 未対応 | **未対応のまま**（`08-open-questions.md` / README Deferred で継続追跡） |
> | tsc / lint | 0 エラー / 15 警告 | 同左（Round 13 で再実測・変化なし） |

- ベースライン: tsc 0 エラー / lint 0 エラー・15 警告 / `bun audit` 97 件 ← **R1 時点**
- **最重要のセキュリティ既発見**: `@clerk/nextjs` 7.0.7 に CRITICAL ミドルウェア保護バイパス（GHSA-vqx2-fgx2-5wq9、`>=7.0.0 <7.2.1` 影響・修正版 7.2.1+/最新 7.5.x）。`js-cookie` HIGH も Clerk 経由。→ 依存カテゴリのプラン最有力候補 ← **plan 004 で解消済み**
- 既知・未対応（プラン化候補）: OI-9 ホーム SSR 500 / OI-11 seller `self is not defined` / OI-10 a11y color-contrast / C2 bundle size / applyCoupon total ロストアップデート / E2E 120s ハング
  ← **OI-9 / OI-11 は Round 9 時点でも「未着手」を確認済み**（`docs/testing/QA_HANDOFF.md`）。
  最新の解消状況は QA_HANDOFF 側を正とする
- **direction 残候補: 一覧は [`plans/README.md`](README.md) の Deferred 節を参照**（**単一の出所**）。
  > 本ファイルに一覧を再掲していたが、README 側と**二重管理**になり、片方だけ更新されて
  > ドリフトしていた（例: `/dashboard/admin/orders`・`/dashboard/admin/coupons`・
  > seller inventory は「要実在確認」と書かれていたが、後続ラウンドの再監査で
  > **3 画面とも実装済み**と確認され、`docs/unimplemented-screens-plan.md` ごと
  > DX-02 の退役対象になっている — [`audit/recon.md`](audit/recon.md) の残存候補行を参照）。
  > 残候補の追加・削除は **README の Deferred 節だけを更新**すること。

## 2026-07-10 追記: 正式版昇格（docs への SSOT 移管）

- Round 2/3 の direction 成果物（EXPANSION_BLUEPRINT.md / OPERATIONS_TRUST_GROWTH_BLUEPRINT.md）を
  統合・再構成し、`docs/architecture/expansion/`（README + 01〜05 の6ファイル・git 追跡対象）へ
  **正式版として昇格**（コミット 540e759〜78397dc の7コミット）。
  フェーズロードマップの SSOT は `docs/architecture/expansion/05-phased-roadmap.md` へ移管。
  plans/direction/ の2ファイルは監査原本（履歴）として凍結（各冒頭に注記済み）。
  spike 013〜022・audit findings は引き続き plans/ が原本。
