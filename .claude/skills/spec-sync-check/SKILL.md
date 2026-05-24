---
name: spec-sync-check
description: >
  Detects and reports divergences across four layers: (1) specs ↔ implementation,
  (2) steering rules ↔ rules/skills/agent docs, (3) top-level docs (CLAUDE.md /
  README.md / GEMINI.md / .agent/) ↔ steering, and (4) SSOT duplication.
  Never auto-fixes — always reports to the human for judgment. Follows SDD
  (Spec-Driven Development) principles where specs are the single source of
  truth, while extending coverage to the operational layer that teaches the rules.
  Triggered by: "仕様確認", "仕様同期", "spec確認", "仕様書チェック",
  "仕様と実装の整合性", "仕様乖離", "ルール確認", "規約整合性チェック",
  "規約浸透チェック", "ドリフト確認", "skill 整合", "rule 整合",
  "spec check", "sync check", "check spec", "verify spec alignment",
  "rule sync", "skill sync", "drift check", "仕様乖離をチェック".
invocation: automatic
allowed-tools: [Read, Grep, Bash]
---

# Spec Sync Checker スキル

## 目的

実装コードと **4 つのレイヤー** のドキュメント間で発生するドリフトを検出し、人間に報告するスキル。

このプロジェクトは **SDD（仕様駆動開発）** を採用しており、`specs/multi-vendor-ecommerce/` が **Single Source of Truth** です。乖離の自動修正は絶対に行わない。実装・ドキュメントどちらが正しいかは人間が判断する。

### 4 レイヤー検査の必要性

過去セッション (2026-05-24 / A4 シリーズ) で、SDD 2 軸 (specs ↔ 実装) だけを検査していた結果、以下のドリフト連鎖が後追い発覚した:

- `.claude/skills/server-action-scaffold/SKILL.md` が旧 `currentUser()` インラインパターンを教示し続け、tech.md の "認可ガード" 禁止事項と直接矛盾
- `CLAUDE.md` / `README.md` / `.agent/rules/core.md` / `.agent/skills/ec-backend-expert/SKILL.md` に同じ旧パターンが並列保持され、規約変更が浸透していない
- `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` 配列が Next Actions の真の SSOT であることが未文書化
- `spec-sync-after-test` skill が `documentation-guide.md` の「QA_HANDOFF = 統計の SSOT」規定を反映していない

これら全ては「specs はクリーン、運用層が drift」というケースであり、SDD 2 軸検査では構造的に検知できなかった。本 skill はこの構造欠陥を解消する。

---

## 実行手順（この順番を厳守すること）

### Step 1｜変更ファイルを特定し、検査スコープを決定する

```bash
git status
git diff --name-only HEAD
git log --oneline -5
```

変更ファイルの種類で、起動する観点を絞り込む（観点 A〜G のうち該当するもののみ実行）:

| 変更ファイル種別 | 起動する観点 |
|------------------|--------------|
| `prisma/schema.prisma` | A (データモデル) |
| `src/queries/*.ts` | B (API) + D (禁止事項 grep) |
| `src/app/` / `src/middleware.ts` | C (ワークフロー) |
| `.claude/rules/*.md` / `.claude/skills/*/SKILL.md` / `.claude/steering/*.md` | E (規約間参照整合性) + F (top-level ↔ steering) |
| `CLAUDE.md` / `README.md` / `GEMINI.md` / `.agent/**` | F (top-level ↔ steering) + G (SSOT 二重化) |
| `scripts/coverage-dashboard/render-html.ts` | E + 「Next Actions 二重 SSOT 同期」確認 |
| 全件確認 (週次レビュー等) | A〜G 全観点 |

---

### Step 2｜関連する仕様書・規約ドキュメントを読み込む

変更内容に応じて必要なものだけ:

| 観点 | 読み込み対象 |
|------|------------|
| A | `specs/multi-vendor-ecommerce/03-data-model.md` |
| B | `specs/multi-vendor-ecommerce/04-interfaces.md` + `.claude/steering/tech.md` "認可ガード" 項 |
| C | `specs/multi-vendor-ecommerce/05-workflows.md` |
| D | `.claude/steering/tech.md` "❌ 禁止事項" 表 |
| E | `.claude/steering/documentation-guide.md` + `.claude/rules/*.md` + `.claude/skills/*/SKILL.md` (該当のみ) |
| F | `CLAUDE.md` / `README.md` / `GEMINI.md` / `.agent/rules/core.md` / `.agent/skills/*/SKILL.md` |
| G | (検査対象は grep スキャン結果の重複箇所) |

未解決事項は常に確認:

```text
Read: specs/multi-vendor-ecommerce/08-open-questions.md
```

---

### Step 3｜乖離を検出する（7 観点 / 4 レイヤー）

#### Layer 1: 仕様 ↔ 実装（SDD コア）

##### A. データモデルの乖離

```text
比較: prisma/schema.prisma ↔ specs/multi-vendor-ecommerce/03-data-model.md
```

チェック項目:
- 新しいモデル（テーブル）の追加・削除
- フィールドの追加・削除・型変更
- リレーション（1:N / N:M）の変更
- インデックス・制約の変更
- 金額フィールドが `Decimal(12,2)` 規約に従っているか

##### B. サーバーアクション（API）の乖離

```text
比較: src/queries/*.ts ↔ specs/multi-vendor-ecommerce/04-interfaces.md
```

チェック項目:
- 新しいサーバーアクションの追加
- 関数シグネチャ（引数・戻り値型）の変更
- 認証・認可ロジックの変更（`requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` の選択）
- エラーハンドリング（`throw` ベース vs `{ success, error }` ラッパー）

##### C. ワークフロー・ルートの乖離

```text
比較: src/app/ + src/middleware.ts ↔ specs/multi-vendor-ecommerce/05-workflows.md
```

チェック項目:
- 新しいページ・ルートの追加
- ユーザーフローの順序変更
- 認証保護ルート（`clerkMiddleware` / `createRouteMatcher`）の変更
- ロール別アクセス制御の変更

---

#### Layer 2: 規約 ↔ 実装（grep ベース禁止事項検査）

##### D. `.claude/steering/tech.md` "❌ 禁止事項" 表の遵守

各禁止事項に対応する `grep` を実行し、ヒットがあれば規約違反として報告:

```bash
# D-1: src/queries/ 配下のインライン認可展開禁止 (auth-guards 経由必須)
grep -rn "if (!user)" src/queries/ --include="*.ts" | grep -v "\.test\."
grep -rn 'role !== "' src/queries/ --include="*.ts" | grep -v "\.test\."
# → ヒット = "認可ガード" 規約違反 (tech.md "認可ガード" 項)

# D-2: src/ 配下の new PrismaClient() 禁止 (db シングルトン経由必須)
grep -rn "new PrismaClient(" src/ --include="*.ts" --include="*.tsx"
# → ヒット = "src/lib/db.ts シングルトン経由を使う" 違反 (例外: prisma/seed/, tests/)

# D-3: src/ 配下の console.log 禁止 (CLI のみ許容)
grep -rn "console\.log(" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
# → ヒット = "console.log 禁止" 違反

# D-4: src/queries/ 以外のサーバーアクション禁止
grep -rln '"use server"' src/ --include="*.ts" | grep -v "src/queries/"
# → ヒット = "src/queries/ 以外でサーバーアクションを定義する" 違反

# D-5: src/csrf* トークンモジュール新設禁止 (ADR 001)
find src/lib -name "csrf*.ts" -o -name "csrf*.tsx"
# → ヒット = ADR 001 違反 (Origin/Host 検証 + Clerk SameSite Cookie に依拠する方針)

# D-6: cookie の生 JSON.parse 禁止 (parseUserCountryCookie 必須)
grep -rn "JSON.parse.*cookie\|cookies().*JSON.parse" src/ --include="*.ts" --include="*.tsx"
# → 要精査 (parseUserCountryCookie 経由かどうか)

# D-7: docs/coverage-dashboard.html の手動編集禁止
git diff --name-only HEAD~5..HEAD | grep "docs/coverage-dashboard.html"
# → ヒットがあれば commit 範囲を確認: 同一 commit に scripts/coverage-dashboard/ または
#   bun run coverage:dashboard 実行ログがないと違反 (生成物の直接編集)
```

> 各 grep は **検出ロジック** なので「ヒット = 必ずしも違反ではない」ケースもある (例: 既存の正当な実装)。
> ヒット件数が前回検査時より **増えた** 場合のみレグレッションとして報告するのが推奨。
> 既存の許容例は本 skill 内に **既知の例外リスト** として記録する。

---

#### Layer 3: 規約 ↔ 規約（運用層内部の整合性）

##### E. `.claude/` 内部の規約間参照整合性

`.claude/rules/` ↔ `.claude/skills/` ↔ `.claude/steering/` の相互参照が一貫しているか:

| 検査項目 | 検査方法 |
|---------|---------|
| rule が「skill X を起動」と書いている場合、skill X が存在し起動条件が一致するか | `grep -rn "skill" .claude/rules/` → 各 skill ファイル存在確認 |
| rule が「Step 1〜N をすべて実行」と書いている場合、対応 skill の Step 数が一致するか | rule の "Step 1〜N" を抽出 → 対応 skill の `^### Step` を `grep -c` で数えて照合 |
| steering で「ファイル X は SSOT」と宣言されている場合、それを使う skill が X を更新対象に含めているか | `documentation-guide.md` の SSOT 記述 → 関連 skill の更新対象表に該当ファイルがあるか |
| skill が参照する他 skill / rule のパスが実在するか | skill 内の `[...](../...)` リンクを `find` で実在確認 |

実例（過去発見済み）:
- `documentation-guide.md` が「QA_HANDOFF.md = テスト統計の SSOT」と規定 → `spec-sync-after-test` skill が QA_HANDOFF.md を更新対象に含めていなかった (2026-05-24 修正済み)

---

#### Layer 4: 運用 ↔ 規約（top-level docs と steering のドリフト）

##### F. top-level docs と `.claude/steering/` の整合

`CLAUDE.md` / `README.md` / `GEMINI.md` / `.agent/rules/core.md` / `.agent/skills/*/SKILL.md` が `.claude/steering/tech.md` の規約と矛盾していないか:

| 検査項目 | 検査方法 |
|---------|---------|
| tech.md の禁止事項 (例: インライン認可禁止) と矛盾する記述が top-level docs にないか | `grep -n "currentUser() で.*ロール\|currentUser() でロール\|currentUser() でロール検証\|currentUser() 等を利用" CLAUDE.md README.md GEMINI.md .agent/` |
| tech.md の "実装パターン例" (auth-guards / shipping-utils 等) を top-level docs が反映しているか | `grep -n "auth-guards\|requireStoreOwner\|requireUser\|requireAdmin\|requireSeller" CLAUDE.md README.md .agent/` で言及件数を確認 |
| `.agent/skills/` が `src/queries/` の現コードと違うパターンを教示していないか | skill 内の「✅ 必須」「❌ 禁止」セクションを抽出して tech.md と突き合わせ |

##### G. SSOT 二重化検出

同一文言・同一データが複数ファイルに並列保持されており、片方だけ更新されると drift する箇所を検出:

```bash
# G-1: CLAUDE.md と .agent/rules/core.md の重複文 (例)
diff <(grep -A 0 "保護されたアクション" CLAUDE.md) \
     <(grep -A 0 "保護されたアクション" .agent/rules/core.md)
# → 同一文があれば「二重 SSOT - drift 候補」として報告

# G-2: render-html.ts NEXT_ACTIONS と QA_HANDOFF.md 依頼プロンプトの対応
grep -E "title:|^#### NA-" \
  scripts/coverage-dashboard/render-html.ts docs/testing/QA_HANDOFF.md
# → 両方のタスク数が一致するか、削除/追加が片側だけ走っていないか
```

既知の二重 SSOT (現在は意図的に維持):
- `CLAUDE.md` "コーディング規約" ↔ `.agent/rules/core.md` "セキュリティ制約" (Claude Code と Antigravity 両方が読むため意図的に並列保持)
- `scripts/coverage-dashboard/render-html.ts NEXT_ACTIONS` ↔ `docs/testing/QA_HANDOFF.md` "次回着手用 依頼プロンプト" (前者がデータ源、後者が依頼文。同期義務を `.claude/rules/02-tdd-step-commit.md` で明文化済み)

---

### Step 4｜未解決事項を確認する

```text
Read: specs/multi-vendor-ecommerce/08-open-questions.md
```

現在の実装に影響する未解決事項があればレポートに含める。

---

### Step 5｜規約変更時の波及確認チェックリスト

`.claude/steering/tech.md` の主要セクションが変更された場合、対応するファイル群が同期されているかチェック:

#### 5-1: "認可ガード" 規約変更時の波及先

```text
- [ ] CLAUDE.md "コーディング規約" セクション
- [ ] README.md "アクセス制御の実装" セクション
- [ ] GEMINI.md (delegate のみで自前保持していないか)
- [ ] .agent/rules/core.md "セキュリティ制約" セクション
- [ ] .agent/skills/ec-backend-expert/SKILL.md §4 認証・アクセス制御
- [ ] .claude/skills/server-action-scaffold/SKILL.md 実装テンプレート
- [ ] .claude/skills/test-gen/SKILL.md IDOR テストパターン
- [ ] docs/testing/SECURITY_GAP_REPORT.md §5 (auth-guards 統合記録)
- [ ] src/lib/auth-guards.ts (規約と実装の整合)
```

#### 5-2: "金額・数値精度" / "配送料計算" / "アトミック操作" 等の規約変更時

各規約に対応する波及先リストを本セクションに段階的に追加していくこと。
新規規約導入時はこのチェックリスト自体の更新が必須。

#### 5-3: テスト統計関連の規約変更時

```text
- [ ] .claude/rules/02-tdd-step-commit.md トリガー条件
- [ ] .claude/skills/spec-sync-after-test/SKILL.md Step 一覧
- [ ] .agent/skills/ec-qa-expert/SKILL.md 更新ファイル表
- [ ] .claude/steering/documentation-guide.md 責務分担セクション
```

---

### Step 6｜レポートを出力する

優先度の高い順 (Layer 1 → 4) で報告する:

```markdown
## 仕様・規約同期チェック結果

### 検出された乖離

#### 🔴 Layer 1: 仕様 ↔ 実装 (SDD コア)

##### [優先度: 高] データモデルの乖離

**乖離 1: [内容]**
- 実装: [実際のコードの状態]
- 仕様書: [仕様書に記載されている内容]
- 該当箇所: `specs/multi-vendor-ecommerce/03-data-model.md` — セクション [番号・見出し]
- 推奨対応: [仕様書を更新すべき内容 or 実装を修正すべき内容]

##### [優先度: 中] API の乖離

**乖離 2: [内容]**
- 実装: ...
- 該当箇所: `specs/multi-vendor-ecommerce/04-interfaces.md` — セクション [番号・見出し]

#### 🟠 Layer 2: 規約 ↔ 実装 (grep ベース禁止事項検査)

**違反 1: tech.md "認可ガード" 禁止事項**
- 検出コマンド: `grep -rn "if (!user)" src/queries/`
- ヒット箇所: `src/queries/foo.ts:42`, `src/queries/bar.ts:88`
- 規約: `.claude/steering/tech.md` "認可ガード" 項
- 推奨対応: `requireUser` / `requireStoreOwner` 等への置換

#### 🟡 Layer 3: 規約 ↔ 規約 (運用層内部の整合性)

**ドリフト 1: skill 間参照の不一致**
- 起点: `.claude/rules/02-tdd-step-commit.md:24` "Step 1〜7 をすべて実行"
- 対応: `.claude/skills/spec-sync-after-test/SKILL.md` の Step 数 = 8
- 該当箇所: rule 側を Step 1〜8 に更新する必要あり

#### 🟢 Layer 4: 運用 ↔ 規約 (top-level docs / .agent と steering)

**ドリフト 2: top-level docs と tech.md の矛盾**
- 起点: `.claude/steering/tech.md` "認可ガード" 項 (インライン展開禁止)
- 違反: `CLAUDE.md:75` "保護されたアクションでは currentUser() とロールチェックが必要"
- 該当箇所: CLAUDE.md を auth-guards 記述に書き換え

**二重 SSOT - drift 候補**
- 並列保持: `CLAUDE.md:75` と `.agent/rules/core.md:24` (完全同一文)
- リスク: 一方の更新時に他方が drift する
- 推奨対応: いずれかを「もう一方を参照」のリンクに置換するか、変更時に必ず両方を同一 commit で更新する規約を明文化

---

### 更新が必要なドキュメント

1. `specs/multi-vendor-ecommerce/03-data-model.md`
   - セクション 3.2 に新モデル `XXX` を追加
2. `CLAUDE.md`
   - "コーディング規約" セクション L.75 を auth-guards 記述に更新
3. `.agent/rules/core.md`
   - "セキュリティ制約" セクション L.24 を同様に更新

---

### 規約変更時の波及確認チェックリスト

[Step 5 の該当チェックリストをそのまま転記。チェック済み項目は ✅、未確認は ⬜]

---

### 未解決事項 (08-open-questions.md より)

- [ ] [未解決事項の内容]

---

### 乖離なし ✅

(乖離が検出されなかった Layer のみこの形式で明示)
- Layer 1 (仕様 ↔ 実装): 乖離なし ✅
- Layer 4 (運用 ↔ 規約): 乖離なし ✅
```

---

## 重要ルール

### ❌ 絶対禁止

- 仕様書・規約ドキュメント・top-level docs の自動修正・自動更新
- 実装コードの自動修正
- 「たぶん問題ない」という判断による乖離の隠蔽
- 乖離の重要度を無断で低く見積もること
- Layer 1 (SDD コア) だけ確認して Layer 2-4 をスキップすること（過去のドリフト後追い発見の根本原因）

### ✅ 必須

- 乖離を検出したら必ず人間に報告する（規模の大小にかかわらず）
- 該当箇所はファイル名だけでなく行番号・セクション番号・見出しも明示する
- `08-open-questions.md` を必ず確認し、関連する未解決事項を報告に含める
- 報告の優先順位は Layer 1 → 2 → 3 → 4 の順に従う
- Step 1 で起動した観点だけを実行し、未起動観点は「未検査」と明示する（網羅範囲の透明性確保）
- 規約変更を検出した場合 (Step 5 該当) は必ず波及確認チェックリストをレポートに含める

### 💡 推奨

- 変更ファイルの種類で読み込む仕様書を絞り込み、不要な仕様書の読み込みを避ける
- 乖離がない場合も Layer ごとに「乖離なし ✅」と明示し、検査範囲の透明性を保つ
- Layer 2 の grep 検査は前回検査時のヒット件数を本 skill 末尾に記録し、増加分のみレグレッションとして報告する運用を推奨
- 新規規約 (`.claude/steering/tech.md` "禁止事項" / "実装パターン例" への行追加) を発見した場合、Step 5-2 / 5-3 の波及チェックリストへの追記を提案する

---

## 参考: 主要ファイルパス

```text
# 仕様書 (Layer 1)
specs/multi-vendor-ecommerce/
  00-overview.md        プロダクトスコープ・システム概要
  01-requirements.md    機能・非機能要件
  02-architecture.md    技術制約・アーキテクチャ
  03-data-model.md      エンティティ定義・ER 図
  04-interfaces.md      API・UI 定義
  05-workflows.md       ユーザーフロー・業務フロー
  06-quality.md         品質基準
  07-testing.md         テスト方針・カバレッジ要件
  08-open-questions.md  未解決事項

# 実装 (Layer 1-2)
prisma/schema.prisma    データモデル定義
src/queries/*.ts        サーバーアクション
src/app/                ルート構造・ページ
src/middleware.ts       認証保護ルート
src/lib/auth-guards.ts  認可ガードヘルパー (Layer 2 規約の実体)

# 規約・運用 (Layer 2-3)
.claude/steering/tech.md             技術制約・禁止事項・実装パターン (Layer 2 SSOT)
.claude/steering/documentation-guide.md  ドキュメント配置ルール (Layer 3 SSOT)
.claude/rules/*.md                   常時適用ガードレール
.claude/skills/*/SKILL.md            運用スキル

# 運用・公開ドキュメント (Layer 4)
CLAUDE.md                            Claude Code 向けプロジェクト設定
README.md                            公開ドキュメント
GEMINI.md                            Antigravity 向け (CLAUDE.md に delegate)
.agent/rules/core.md                 .agent エージェント動作制約
.agent/skills/*/SKILL.md             .agent エージェント実装スキル

# ダッシュボード・生成物
scripts/coverage-dashboard/render-html.ts  ダッシュボードデータ源 (NEXT_ACTIONS 等)
docs/coverage-dashboard.html               生成物 (手動編集禁止)
docs/testing/QA_HANDOFF.md                 即時 TODO + 依頼プロンプト (テスト統計の SSOT)
```
