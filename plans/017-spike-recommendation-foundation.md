# プラン 017（design/spike）: ルールベース・レコメンド基盤 v1（relatedProducts スロットの充填）を設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat a17e2cc..HEAD -- src/queries/product.ts prisma/schema.prisma`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> `formatProductResponse` の `relatedProducts` が既に実データを返していたら STOP して報告する。

## Status

- **Priority**: P3（Phase D — 成長。効果はカタログ構造化 A/B の完成度に比例。ただし「共起注文」は独立に PoC 可）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW（読み取り専用機能の追加。誤ったレコメンドの UX 影響のみ）
- **Depends on**: なし（plans/013〜015 の完成度が推薦品質を高めるが、v1 は現行スキーマで成立させる）
- **Category**: direction
- **Planned at**: commit `a17e2cc`, 2026-07-09
- **背景ドキュメント**: `plans/direction/EXPANSION_BLUEPRINT.md` §4-⑤ / `plans/audit/findings-09-direction-expansion.md` E-5

## Why this matters

レコメンドに必要な行動シグナル（views / sales / rating / Wishlist / 注文履歴）は**すべて
収集・保存済み**なのに、活用する層が一切なく、商品ページのレスポンスは
`relatedProducts: []` を**ハードコード**で返している — UI 契約はレコメンドを想定済みなのに
常に空、という「配線されていないコンセント」状態である。単品ページが行き止まりになる
ことで回遊とクロスセルの機会を失っており、USER KPI（チェックアウト完了率）にも
販売者の露出機会にも効いていない。本 spike は、外部 ML 基盤を**持ち込まず**に既存シグナルの
SQL 合成で成立する v1（関連商品・一緒に購入・人気商品）を設計し、同時に**将来の協調
フィルタリング/ベクタ検索へ差し替え可能なインターフェイス（seam）を固定する**ことが目的。
戦略の中身より seam の固定が本命である（EXPANSION_BLUEPRINT §4-⑤）。

## Current state（設計前に必ず読む）

### 空のスロット — `src/queries/product.ts:1080`（`formatProductResponse`）

```ts
    return {
        // ...
        reviewsStatistics: ratingStatistics,
        shippingDetails,
        relatedProducts: [],          // ← product.ts:1080 — 常に空のハードコード
        variantInfo: product.variantsInfo,
    };
```

`formatProductResponse` は商品詳細ページのレスポンス整形ヘルパーで、`getProductPageData`
（`product.ts:898`）から呼ばれる。呼び出しの過程で `incrementProductViews(product.id)` が
実行される（`product.ts:929-931`）— views シグナルはここで蓄積されている。

### 収集済みシグナル（すべて実装済み・未活用）

| シグナル | スキーマ | 現在の用途 |
|---|---|---|
| `Product.views` | `schema.prisma:140` | ソート `most-popular`（`product.ts:761-762`）のみ |
| `Product.sales` / `ProductVariant.sales` | `schema.prisma:137` / `:184` | 表示のみ |
| `Product.rating` / `numReviews` | `schema.prisma:136,138` | ソート `top-rated` のみ |
| `Wishlist`（userId × productId × variantId × sizeId?） | `schema.prisma:641-663` | プロフィール一覧のみ |
| 注文履歴（`OrderItem` → `OrderGroup` → `Order` → user） | `schema.prisma:612` / `:529` / `:499` | 履歴表示のみ |
| `Category/SubCategory` FK（同カテゴリの母集合） | `schema.prisma:157-161` | ブラウズのみ |

### スコープ境界（product.md との整合）

`product.md:33-36` は「高度な分析ダッシュボード」をスコープ外とする。**レコメンドは
購買動線上の機能であり分析 UI ではない**ため対象外に該当しない — ただし本 spike は
分析画面・レポート機能を一切設計しないことでこの境界を守る（design doc に明記）。

### 遵守すべきリポジトリ規約

- サーバーアクション/データ取得は `src/queries/` 配置、UI から直接 import 禁止
- 生 SQL は `Prisma.sql` + `$queryRaw`（共起注文クエリで使用する場合）
- DB 依存ページの `force-dynamic` 規約（レコメンド枠を別ページに足す場合）
- `console.log` 禁止・構造化ログ規約

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| relatedProducts の UI 消費側 | `grep -rn "relatedProducts" src/ -l` | 商品ページの UI 側の受け口 |
| 商品カードの再利用可能コンポーネント | `ls src/components/store/` + grep `ProductCard` 相当 | 一覧カードの既存実装 |
| 共起注文の母数確認（ローカル/シード） | `grep -rn "orderItem" prisma/seed/ -il` | シードの注文データ量 |
| 型チェック | `bunx tsc --noEmit` | exit 0 |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/recommendations/design.md`（新規） — Open questions 全てに決定 + 根拠
- v1 戦略それぞれの **SQL/Prisma クエリ雛形**（現行スキーマで動く形。PoC 実行はローカル DB が
  あれば行い、結果を design doc に記録する — 無ければ雛形の静的検証のみでよい）
- 後続**実装**プラン `plans/0NN-implement-recommendations-v1.md`（次の空き番号、plan-template 準拠）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- 協調フィルタリング・埋め込み（ベクタ検索）・外部 ML サービスの導入 — 差し替え先として
  seam の設計にのみ登場させる
- 分析ダッシュボード・レポート UI（product.md スコープ外）
- A/B テスト基盤（将来項目として言及のみ）

## Open questions（spike が証拠付きで必ず答える）

1. **v1 戦略セットの確定**: 以下の候補から v1 に含める戦略と各クエリ雛形を確定する:
   - (a) **関連商品**（商品詳細ページ）: 同一（サブ）カテゴリ × views/sales 降順 × 自店舗/
     自商品除外。カテゴリツリー化（plan 013）後はリーフ→親へのフォールバックを含めるか
   - (b) **一緒に購入されている商品**: `OrderItem` の共起（同一 Order に同時出現）集計。
     `$queryRaw` の GROUP BY 雛形と、注文数が少ない初期フェーズでの最小サポート数
     （共起 2 件未満は出さない等）
   - (c) **人気商品/あなたへのおすすめ（ホーム）**: 閲覧ユーザーの wishlist/注文カテゴリに
     基づく人気商品。未ログイン時のフォールバック（全体人気）
2. **seam（インターフェイス）の固定 — v1 戦略セット全体を覆うこと**:
   `getRelatedProducts(productId, ...)` の**商品アンカー前提だけでは Q1(c) のホーム推薦
   （ユーザーアンカー / 無ログイン時は全体人気）を表現できない**。seam は 3 戦略すべてを
   1 つの契約で扱える形にする。推奨:

   ```ts
   type RecommendationContext =
     | { anchor: "product"; productId: string }   // (a) 関連商品・(b) 一緒に購入
     | { anchor: "user"; userId: string }         // (c) あなたへのおすすめ（ホーム）
     | { anchor: "anonymous" };                    // (c) 未ログイン時の全体人気フォールバック
   function getRecommendations(
     ctx: RecommendationContext,
     opts: { strategy: RecommendationStrategy; limit: number }
   ): Promise<ProductCardData[]>;  // 戻り値は既存の商品カード props と互換
   ```

   戦略の実装が SQL からベクタ検索に変わっても**呼び出し側が変わらない**ことが要件。
   配置は `src/queries/`（規約）。商品アンカー専用の薄いラッパ
   （`getRelatedProducts(productId, opts)` → `getRecommendations({anchor:"product",productId}, opts)`）は
   置いてよいが、**正準の seam は文脈を受け取る形**にし、ホーム推薦を後付けで別シグネチャにしない。
3. **鮮度と性能 + キャッシュのユーザー分離**: リクエスト毎計算か、`unstable_cache` 等での
   キャッシュか（PERF-05・plan 015 のファセット集計キャッシュと同じ層 — 方式を揃えるか）。
   共起集計はマテビュー/定期集計に逃がすべき規模かを、想定データ量で見積もる。

   > **パーソナライズ推薦（Q1c のユーザーアンカー）をキャッシュする場合、キャッシュキーに
   > `userId` を必ず含めてユーザー間で分離すること**（`anchor:"user"` の結果を共有キーで
   > キャッシュすると、あるユーザーの wishlist/注文ベース推薦が別ユーザーに漏れる）。設計方針:
   > - `anchor:"anonymous"`（全体人気）と `anchor:"product"`（非パーソナライズな関連商品）は
   >   **共有キャッシュ可**（キーは戦略 + productId 等、ユーザー非依存）。
   > - `anchor:"user"` は **per-user キー**（`["recs", userId, strategy]` 等）にするか、
   >   個人化データはキャッシュしない（計算コスト次第）。`unstable_cache` の `keyParts` /
   >   tag に `userId` を含めることを設計に明記する。
   > - ログイン状態が切り替わったとき（ログアウト）に個人化キャッシュが残らない無効化方針も決める。
4. **表示枠の設計**: `relatedProducts` スロット（商品詳細）以外にどの枠を v1 に含めるか
   （カート画面の「一緒に購入」、ホームの「人気」）。UI は既存の商品カード/カルーセルの
   再利用で足りるか。
5. **品質ガード**: 在庫切れ・非公開（plan 016 の ListingStatus 導入後）・自店舗商品の除外
   ルール。016 の「公開商品スコープ」ヘルパーが確定していれば必ずそれを通す形で設計する。
6. **効果測定の最小手段**: 分析ダッシュボードを作らない制約下で、レコメンド経由の遷移を
   どう観測するか（例: クリック時の URL パラメータ + 既存 views の増分で代替）。
   スコープ外の境界を越えない最小案を1つ決める。

## Steps

### Step 1: UI 受け口とデータ量の調査

`relatedProducts` を消費する UI コンポーネント（現状空配列でどう描画されるか）と、
再利用できる商品カード/カルーセルを特定する。シード/ローカル DB の注文データ量から
共起集計が成立する規模かを確認する。

**Verify**: UI 受け口の `file:line` と、共起集計の成立性（成立しない場合は (b) を
「注文数 N 件到達後に有効化」とする条件付き設計になる）が調査ノートにある。

### Step 2: 戦略クエリの雛形設計（+ 可能なら PoC）

Open question 1 の各戦略について SQL/Prisma 雛形を書く。ローカル DB（`make setup` /
`bun run seed:luxury`）が使えるなら実行し、結果例と実行時間を design doc に記録する。

**Verify**: 各戦略の雛形が現行スキーマのカラム名で書かれており（脳内スキーマ禁止）、
少なくとも (a) は Prisma クエリとして型が通る形になっている。

### Step 3: seam と品質ガードの設計

Open questions 2・5 に答える。戻り値型は UI の商品カード props から逆算し、016/013 の
将来変更（公開スコープ・カテゴリツリー）が来ても**シグネチャが不変**であることを検算する。

**Verify**: シグネチャ・戻り値型・除外ルールが design doc にあり、「016 導入後の変更点は
実装内部のみ」の検算が書かれている。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/recommendations/design.md` を書き、`plans/0NN-implement-recommendations-v1.md` を
plan-template 準拠で書く。実装プランは (a) 関連商品 → (c) 人気 → (b) 共起、の順の段階導入とし、
各段に「空配列フォールバック（レコメンド失敗が商品ページを壊さない）」の検証を含める。

**Verify**: 後続プランに「`getProductPageData` のレスポンス形は `relatedProducts` の中身が
埋まる以外変わらない」ことの検証（既存テスト/スナップショットの非破壊）が含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/recommendations/design.md` が存在し、Open questions 全6問に決定 + 証拠がある
- [ ] v1 各戦略の SQL/Prisma 雛形が現行スキーマで書かれている（PoC 実行結果は任意）
- [ ] seam のシグネチャと戻り値型が確定し、将来差し替えの検算が書かれている
- [ ] `plans/0NN-implement-recommendations-v1.md` が存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` が新規ドキュメント/プランのみ）
- [ ] `plans/README.md` の 017 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- `relatedProducts` が既に実データを返す実装になっている（前提消滅）
- UI 側に `relatedProducts` の受け口が存在しない（＝スロットが dead code）と判明した場合 —
  レコメンド UI の新設から設計し直す必要があるため、工数見積の変更を添えて報告
- 共起集計が Accelerate 経由の `$queryRaw` で実行不能な制約に当たった場合 —
  一次情報を添えて報告（plan 015 の同種 STOP 条件と同じ扱い）

## Maintenance notes

- 本 seam は plan 015 のカテゴリスコープ済みブラウズクエリ、plan 016 の公開商品スコープと
  実装を共有すべき — 3 プランの実装が揃う際に「公開商品を返すクエリの共通基盤」として
  リファクタリング候補になる（その時点で ADR 検討）
- views/sales はレコメンド導入後に**自己強化ループ**（人気商品がさらに露出→さらに人気）を
  起こす — design doc の効果測定節に「多様性の担保（同一店舗の連続表示制限等）」を
  将来課題として記録しておくこと
- レビュアーが後続実装 PR で最も精査すべき点: レコメンドクエリの失敗が商品ページ本体を
  巻き込まないこと（try/catch + 空配列フォールバック）と、N+1 の混入（関連商品の
  カード表示に必要な variant/画像を include で一括取得しているか）
