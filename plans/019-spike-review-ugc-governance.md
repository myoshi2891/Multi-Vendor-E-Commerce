# プラン 019（design/spike）: レビュー・UGC 品質ガバナンスを設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat 86c04a1..HEAD -- prisma/schema.prisma src/queries/review.ts src/queries/store.ts`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> `Review` にモデレーション状態カラムが追加済み、または `upsertReview` に購入検証が
> 入っていたら STOP して報告する。

## Status

- **Priority**: P3（マーケットプレイスの「治安」 — Phase C）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW-MED（読み取り調査は安全。本体実装は評価集計の変更が商品/店舗の表示に波及）
- **Depends on**: なし（設計供給のソフト接続: 本 spike の集計修正が plan 022 の
  セラー品質シグナル1系統を供給する — 022 より先の実行を推奨）
- **Category**: direction
- **Planned at**: commit `86c04a1`, 2026-07-10
- **背景ドキュメント**: `plans/direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` §3-⑦ /
  `plans/audit/findings-10-direction-operations-growth.md` O-2

## Why this matters

レビューはマーケットプレイスの信頼の通貨だが、現行実装には信頼装置が無い:
**購入していないユーザーが任意の商品にレビューでき**、モデレーション・通報の仕組みが無く、
評価集計は非アトミック（並行レビューでロストアップデート）で、
**店舗評価（`Store.averageRating`）に至ってはどのクエリからも更新されない死にフィールド**である。
UGC が増えるほど、偽レビュー・不適切コンテンツ・不正確な評価が「発見性」
（Round 2 の spike 015/017 が強化する検索・レコメンド）の入力を汚染する。
本 spike は (a) 購入検証バッジ、(b) モデレーション状態機械 + 通報、(c) アトミック評価集計
（Product と Store の両方）、(d) helpful 投票の per-user 化 — の4点を、
モデレーションの厳しさをポリシー（データ）で差し替え可能な形で設計する。

## Current state（設計前に必ず読む）

### Review モデル — 信頼装置なし（`prisma/schema.prisma:353-391`）

抜粋（**関連フィールドのみを抜き出した簡略版**。実物は `prisma/schema.prisma:353-391` を参照）。
構文は有効な Prisma として書く（1 行複数フィールドのような擬似記法は使わない）:

```prisma
model Review {
  variant  String
  review   String
  rating   Float               // ← Float（金額ではないため Decimal 規約対象外。範囲検証は別途必要 — 下記）
  color    String
  size     String
  quantity String
  likes    Int    @default(0)  // ← 参照・更新する query が存在しない死にフィールド
  images   ReviewImage[]

  @@unique([userId, productId]) // 1ユーザー1商品1レビュー
  // 注: userId / productId / タイムスタンプ等の他フィールドは本抜粋では省略
}
```

- モデレーション状態・通報・購入検証フラグに相当するカラムは**存在しない**（作成即公開）
- `likes Int` に対する操作 action・per-user 記録（ReviewLike モデル等）は無い —
  実装しても二重 like を防げない構造

### upsertReview — 購入検証なし・非アトミック集計（`src/queries/review.ts:15-144`）

```typescript
// review.ts:20-24 — 認証チェックのみ。購入履歴の検証は無い
const user = await currentUser()
if (!user) throw new Error('Unauthorized.')
// ...（中略: User レコードのオンデマンド upsert フォールバック）

// review.ts:106-131 — upsert 後に全レビューを findMany → JS float reduce → product.update
const productReviews = await db.review.findMany({ where: { productId }, select: { rating: true } })
const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0)
const newAverageRating = totalRating / productReviews.length
await db.product.update({ where: { id: productId },
  data: { rating: newAverageRating, numReviews: productReviews.length } })
```

- **`db.$transaction` なし**: レビュー upsert と評価再計算が別トランザクション。並行実行で
  `Product.rating` / `numReviews` が古い集合で上書きされうる。
  ただし **`$transaction` で囲むだけではこの競合は解消しない**（Open question 4 参照）——
  トランザクションが与えるのは原子性であって分離性ではなく、PostgreSQL の既定分離レベル
  READ COMMITTED では「全件 findMany → 平均を再計算 → update」の read-modify-write は
  ロストアップデートを起こす。2 つの投稿が同じレビュー集合を読んでから両方書くと後勝ちで
  片方が消え、**両方とも commit に成功するためエラーにもならない**
- **`rating` の範囲検証が無い**: `rating Float` は現状どの経路でも 1〜5 の範囲チェックを受けない。
  `upsertReview` は範囲外（0・6・負値・`NaN`・非整数）をそのまま保存し、平均が汚染される。
  設計で **rating の許容範囲（1〜5 の整数を初期仮説）を確定し、多層で強制**すること:
  (i) 入口の Zod（`src/lib/schemas.ts`）で `z.number().int().min(1).max(5)`、
  (ii) 可能なら DB CHECK 制約（`rating BETWEEN 1 AND 5`）で最終防衛、
  (iii) 集計は範囲内保証済みの値に対して行う。これを Open questions / 実装プランの必須項目にする。
- クライアント提供 ID を信頼しない IDOR 対策（`review.ts:55-60`）は既に施されている — 維持する

### Store.averageRating — 死にフィールド（`prisma/schema.prisma:93-94`）

```prisma
averageRating Float @default(0)  // schema.prisma:93 — 更新する query が存在しない
numReviews    Int   @default(0)  // schema.prisma:94 — 同上
```

書き込み箇所ゼロ（読むのは `getStoreDetails` 系 `src/queries/store.ts:670` のみ）。
店舗ページには常に 0 が表示され続ける。

### Q&A は販売者の静的 FAQ（`prisma/schema.prisma:274-286`）

`Question` モデルは `question`/`answer` を販売者が商品フォームで同時入力する構造
（userId カラム自体が無い）。**顧客が質問を投稿するフローではない** — 本 spike では
顧客 Q&A を初期スコープに含めるかの判断のみ行う（含めない判断も可）。

### 通報の受け皿の現状

`SupportTicketCategory.PROBLEM_REPORT`（`schema.prisma:783-788`）は汎用自由記述で、
レビュー ID への構造化参照を持たない。

### 遵守すべきリポジトリ規約

- 認可は auth-guards（`src/lib/auth-guards.ts`）。モデレーション action は `requireAdmin`
- 複数テーブル更新（レビュー + Product 集計 + Store 集計）は `db.$transaction`
- スキーマ変更時は ERD 再生成（`.claude/rules/03-data-model-diagram-sync.md`）
- IDOR テストは 3 階層パターン（`docs/testing/SECURITY_GAP_REPORT.md` §5.2）

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| レビュー表示経路の列挙 | `grep -rn "reviews\|Review" src/components/store/product-page/ -l` | 表示コンポーネント一覧 |
| rating の消費箇所（ソート・表示） | `grep -rn "rating" src/queries/product.ts \| head -20` | ソート・フィルタでの利用 |
| likes の参照確認（死に確認） | `grep -rn "likes" src/queries/ src/components/store/` | ヒットなし（or 表示のみ） |
| 購入履歴の照合材料 | `grep -n "OrderItem\|productId" prisma/schema.prisma \| head -10` | OrderItem.productId の存在 |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/review-governance/design.md`（新規） — Open questions 全てに決定 + 根拠
- 後続**実装**プラン `plans/0NN-implement-review-governance.md`（実行時点の次の空き番号、plan-template 準拠）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- 自動コンテンツモデレーション（ML/外部 API による文面審査 — 将来項目として言及のみ）
- レコメンド・検索側での評価シグナル利用（spike 015/017 の領域 — 接続点の言及のみ）
- セラー品質メトリクスの集約そのもの（plan 022 の領域 — 本 spike は Store 集計の
  「正しい書き込み」までを設計し、閾値・措置は 022 に渡す）

## Open questions（spike が証拠付きで必ず答える）

1. **購入検証の判定基準**: 「購入者」をどう定義するか — 対象 productId を含む OrderItem を
   持つこと（状態不問）か、`Delivered` 到達済みに限るか。検証結果を `Review` のカラム
   （例: `isVerifiedPurchase Boolean`）に**書き込み時スナップショット**するか、表示時に
   都度照合するか（性能と正確性のトレードオフを根拠付きで確定）。
   **未購入者のレビュー投稿を禁止するか、投稿可 + バッジ無しにするか**もポリシー論点
   （ブランド未定のためデータで切り替え可能にする案を優先検討）。
2. **モデレーション状態機械**: 状態集合と遷移。初期仮説:
   `PUBLISHED（事後審査モード時の初期値）/ PENDING_REVIEW（事前審査モード時の初期値）→
   PUBLISHED / REJECTED`、`PUBLISHED → FLAGGED（通報閾値超過）→ PUBLISHED / REMOVED`。
   モード（事前/事後/無審査）はポリシーとしてデータ化し、spike 016 の審査ポリシー機構と
   表現を揃える（016 実行済みならその決定に従う。未実行なら本 spike の案を 016 へ相互参照）。
3. **通報の受け皿**: レビュー通報を `SupportTicket` の拡張（reviewId 参照の追加）で受けるか、
   専用モデル（`ReviewReport`）を新設するか。通報数の閾値で `FLAGGED` へ自動遷移させる場合の
   閾値のデータ化を含めて確定する。
4. **アトミック集計の方式**: 集計更新を、(a) 全件 findMany + 再計算の
   現行方式の原子化、(b) 差分更新（加重平均の増分計算）、(c) DB 集計（`AVG()` を
   `$queryRaw`）のどれにするか。**Product と Store の両方**を同一トランザクションで
   更新すること。モデレーションで非公開になったレビューを集計から除外する仕様も確定する。

   > **`$transaction` で囲むことと競合の解消は別問題**。トランザクションは原子性
   > （全部成功するか全部失敗するか）を与えるが、**分離性は分離レベル次第**であり、
   > PostgreSQL の既定は READ COMMITTED。(a) をそのまま `$transaction` で包んでも、
   > 並行する 2 投稿が同じレビュー集合を読んでから両方 update すればロストアップデートが
   > 残る（両方 commit 成功するので検知もできない）。
   > よって spike は方式 (a)/(b)/(c) の選択に加えて、**その方式で並行投稿が壊れない機構**を
   > 明示的に確定すること。選択肢:
   > - **Serializable 分離レベル**（`db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })`）
   >   と直列化失敗時のリトライ方針。本リポジトリの先例: `src/queries/user.ts:286`（Round 10 の
   >   `saveUserCart` TOCTOU 修正で採用）
   > - **行ロック**（`SELECT ... FOR UPDATE` を `$queryRaw` で先に取る）
   > - **単一文への畳み込み**（(c) 相当。`UPDATE ... SET rating = (SELECT AVG(...))` を 1 文で。
   >   ただし文の開始時点のスナップショットを読むため、これだけで十分かは要検証）
   > - **条件付き書き込み**（(b) 相当。読んだ値を WHERE 条件に含める楽観ロック + リトライ）
   >
   > Step 3 の「新設計で壊れない根拠」は、**分離レベル / ロックまで含めて**書くこと。
   > Accelerate 経由での Serializable の可否・タイムアウト制約は STOP conditions の
   > 「Accelerate の制約と衝突」に該当しうるため実測で確認する。
5. **`rating` の型と範囲検証**: 表示は小数1桁で足りる。`Float` 維持か `Decimal(2,1)` 化かを
   ADR 判断として確定する（tech.md の Decimal 規約は金額対象 — 評価への適用は判断事項）。
   **加えて入力 rating の許容範囲を必ず設計に含める**（Current state の観察参照）:
   1〜5 の整数を初期仮説とし、Zod（`z.number().int().min(1).max(5)`）+ 可能なら DB CHECK
   （`rating BETWEEN 1 AND 5`）で多層に強制。範囲外・`NaN`・非整数を保存させないことを
   集計汚染防止の要件として明記する。
6. **helpful 投票**: `likes Int` を per-user の `ReviewVote`（unique [userId, reviewId]）へ
   置き換えるか、初期スコープから外して `likes` を撤去するか。表示ソート
   （「参考になった順」）に使うかも含めて判断する。

## Steps

### Step 1: レビューの生成・消費経路の棚卸し

レビューの作成（upsertReview の呼び出し元 UI）・表示（商品ページのレビュー一覧・評価
サマリー）・消費（`Product.rating` を使うソート/フィルタ/レコメンド）を列挙し、
モデレーション状態の導入が波及する箇所を特定する。

**Verify**: 経路一覧表（生成/表示/消費 × ファイル × モデレーション対応要否）が design doc 案にある。

### Step 2: 購入検証とモデレーションの設計

Open questions 1〜3 に答える。spike 016（実行済みならその design doc、未実行なら
`plans/016-spike-seller-onboarding-catalog-approval.md` の Open question 2）の
審査ポリシー機構と表現を揃えること。

**Verify**: 遷移表（状態 × アクション × 実行ロール → 次状態）とポリシー切り替えの
データモデル案が design doc 案にある。

### Step 3: 集計の原子化設計

Open questions 4〜5 に答える。並行レビュー投稿シナリオ（2ユーザー同時投稿）で
現行実装が壊れる手順と、新設計で壊れない根拠を書く。`Store.averageRating` の
初回 backfill（全店舗の既存レビューからの再計算）手順も設計する。

**Verify**: 並行シナリオの before/after 分析と backfill 手順が design doc 案にある。
before/after 分析は **`$transaction` で囲んだこと**を根拠にせず、**分離レベル / ロック機構まで
特定**して「なぜロストアップデートが起きないか」を説明していること（Open question 4 の
blockquote 参照）。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/review-governance/design.md` を書き、`plans/0NN-implement-review-governance.md`
を plan-template 準拠で書く。実装プランには: スキーマ変更（モデレーション状態・検証フラグ・
必要なら ReviewReport/ReviewVote）+ backfill → ERD 再生成 → upsertReview の購入検証 +
`$transaction` 化 → モデレーション action（`requireAdmin`、IDOR 3 階層テスト付き）→
表示側の状態反映 → テスト、を含める。

**Verify**: 後続プランの done criteria に「非公開レビューが商品ページ・評価集計の両方から
除外されることのテスト」と「並行投稿で集計が正しいことのテスト（または testcontainers 統合
テストの明示的な deferred 判断）」が含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/review-governance/design.md` が存在し、Open questions 全6問に決定 + 根拠がある
- [ ] `Store.averageRating` の backfill 手順と以後の更新経路が design doc にある
- [ ] モデレーションモードが「コード変更なしで差し替え可能」である説明が design doc にある
- [ ] spike 016 のポリシー機構との整合（同一表現 or 相互参照）が明記されている
- [ ] `plans/0NN-implement-review-governance.md` が存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` の変更が新規ドキュメント/プランと、下記の `plans/README.md` 更新のみ）
- [ ] `plans/README.md` の 019 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- `Review` にモデレーション/検証カラムが既に追加されている（前提消滅）
- レビュー表示経路の調査中に、認可・XSS 等の即時悪用可能な欠陥を発見した場合 —
  設計継続より先に P1 発見としてただちに報告する
- 集計の原子化が Prisma Accelerate の制約（`$transaction` のタイムアウト等）と衝突すると
  判明した場合 — 代替案（差分更新 or バッチ再計算）を添えて判断を仰ぐ
- spike 016 実行済みで、そのポリシー機構が本 spike の初期仮説と両立しない場合 —
  016 の決定を正とし、差分を報告する

## Maintenance notes

- 本 spike の集計修正は plan 022（セラーパフォーマンス）の評価シグナルの供給源になる —
  022 の実行者は本 design doc の「Store 集計の更新経路」を必ず読むこと
- モデレーション状態はレコメンド（spike 017）・検索（spike 015）の対象絞り込みにも
  効かせる必要が出る — 実装時に「公開レビューのみ」条件の適用先を横断確認すること
- レビュアーが後続実装 PR で最も精査すべき点: `$transaction` の範囲（upsert + Product 集計 +
  Store 集計が1トランザクション）**と、その分離レベル / ロック機構**（範囲が正しくても
  READ COMMITTED のままではロストアップデートが残る — Open question 4 の blockquote 参照）、
  および backfill マイグレーションの冪等性
