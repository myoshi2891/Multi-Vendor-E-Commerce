# プラン 016（design/spike）: 出品審査ワークフロー（商品レベルの公開制御）を設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: Step 1 が棚卸しする**公開経路の依存ファイル全体**を対象にする
> （`schema.prisma` + store/product クエリだけでは狭すぎる。ブラウズ・ホーム・商品詳細・検索 route・
> カート/チェックアウトの商品参照が別ファイルに散在するため）:
>
> ```
> git diff --stat a17e2cc..HEAD -- \
>   prisma/schema.prisma \
>   src/queries/store.ts src/queries/product.ts \
>   src/app/api/index-products/ src/app/api/search-products/ \
>   'src/app/(store)/**' src/components/store/
> ```
>
> （実際の公開経路ファイルは Step 1 の grep 結果で確定する。ここに挙げた以外の経路が
> 見つかったら差分対象に追加する。）
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> `Product` に公開状態カラムが追加済み、または `upsertProduct` に審査分岐が入っていたら
> STOP して報告する。

## Status

- **Priority**: P3（マーケットプレイスの「治安」 — Phase C。013/014 と独立に着手可能）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW-MED（読み取り調査は安全。本体実装は公開クエリの where 変更を含むため要注意）
- **Depends on**: なし（plan 014 の「必須属性欠落 = 審査差し戻し」論点と相互参照のみ）
- **Category**: direction
- **Planned at**: commit `a17e2cc`, 2026-07-09
- **背景ドキュメント**: `plans/direction/EXPANSION_BLUEPRINT.md` §4-④ / `plans/audit/findings-09-direction-expansion.md` E-4

## Why this matters

店舗レベルには承認ワークフロー（`StoreStatus`: PENDING→ACTIVE、ロール昇格つき）が既に
存在する一方、**商品レベルの審査・公開制御は皆無**で、SELLER が保存した商品は即座に
ストアフロントへ公開される。販売者数と SKU が増えるほど、規約違反・品質不良・誤登録の
商品がカタログの信頼を毀損するリスクが線形に増える。さらに現行の公開クエリは
**店舗の status を where で見ていない疑いがある**（BANNED/DISABLED 店舗の商品が
ブラウズに出続ける可能性 — 本 spike の検証項目）。Amazon 型の「出品ゲート」を、
ブランド未定という前提に合わせて**審査の厳格さをポリシー（データ）で切り替えられる**形で
設計することが本 spike の目的である（EXPANSION_BLUEPRINT §1.2「構造優先」の検算対象）。

## Current state（設計前に必ず読む）

### 既存の店舗承認 — 設計のテンプレート（`src/queries/store.ts:531-602`）

```prisma
enum StoreStatus {            // schema.prisma:76
  PENDING
  ACTIVE
  BANNED
  DISABLED
}
// Store.status StoreStatus @default(PENDING)   — schema.prisma:91
```

`updateStoreStatus`（`store.ts:531`）は `$transaction` 内で status 更新 + PENDING→ACTIVE 時の
ロール昇格を行い、その後 Clerk metadata を同期する（`store.ts:559-591`）。
**この「enum + 遷移 + トランザクション + 管理 UI」一式が商品版審査の設計テンプレート**になる。

なお `updateStoreStatus` / `getAllStores` は `currentUser()` + インラインロール検査の
旧パターン（`store.ts:490-497` / `:537-544`）で、`requireAdmin`（`src/lib/auth-guards.ts`）
未使用 — 規約はインライン展開の**新規追加**を禁じているため、審査機能の追加実装は
auth-guards を使い、既存の旧パターン置き換えは対象外（Round 1 plan 002 と隣接）とする。

### 商品には公開状態が無い — `prisma/schema.prisma:130-170`

`Product` モデルに status / published / draft に相当するカラムは存在しない。
`upsertProduct`（`src/queries/product.ts:71`）は SELLER の保存で即公開となる。

### 命名衝突の罠 — `prisma/schema.prisma:560`

```prisma
enum ProductStatus {          // schema.prisma:560 — ※これは OrderItem の配送状態！
  Pending
  Processing
  ...
}
```

**`ProductStatus` という enum 名は注文アイテムの配送状態に既に使われている**。
商品公開状態の enum は `ProductListingStatus` / `ListingStatus` 等の非衝突名を選ぶこと
（後続実装プランに必ず明記する）。

### 公開クエリの店舗 status 検証（本 spike の検証項目）

`getProducts`（`product.ts:601-772`）の whereClause に `store: { status: ... }` 条件は無い
（findings-09 E-4）。ホーム・商品詳細・検索 route（`search-products/route.ts`）も同様かを
本 spike で網羅的に確認する。

### 遵守すべきリポジトリ規約

- 認可は `requireAdmin` / `requireSeller` / `requireStoreOwner`（auth-guards）。
  インライン検査の新規追加は禁止
- 複数テーブル更新は `db.$transaction`
- スキーマ変更時は ERD 再生成（`03-data-model-diagram-sync`）
- IDOR テストは 3 階層パターン（`docs/testing/SECURITY_GAP_REPORT.md` §5.2）— 審査 action は
  ADMIN 専用のため必須

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| 公開クエリの store.status 参照有無 | `grep -rn "status" src/queries/product.ts src/app/api/search-products/route.ts` | 現状の参照箇所（無いはず） |
| ストアフロントの商品取得経路の列挙 | `grep -rn "getProducts\|retrieveProductDetails\|getProductPageData" src/app -l` | 呼び出しページ一覧 |
| 店舗審査 UI の既存実装 | `ls src/app/dashboard/admin/stores/` | admin テーブルパターン確認 |
| admin テーブルの雛形 | `ls src/app/dashboard/admin/orders/` | TanStack table パターン |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/catalog-approval/design.md`（新規） — Open questions 全てに決定 + 根拠
- **BANNED/DISABLED 店舗の商品露出の検証結果**（露出があれば独立の修正候補として明記 —
  これはセキュリティ/正確性の発見として `plans/README.md` の deferred 節にも追記する）
- 後続**実装**プラン `plans/0NN-implement-catalog-approval.md`（次の空き番号、plan-template 準拠）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- 店舗承認フロー自体の改修（既存 `updateStoreStatus` の旧パターン置き換えは Round 1 plan 002 側）
- サポートチケット・返金との統合ワークフロー（DIRECTION-01/03 — 接続点の言及のみ）
- 画像モデレーション等のコンテンツ審査自動化（将来項目として言及のみ）

## Open questions（spike が証拠付きで必ず答える）

1. **公開状態の状態機械**: 商品公開状態の enum（非衝突名で。例: `ListingStatus`）の値集合と
   合法遷移を確定する。初期仮説: `DRAFT → PENDING_REVIEW → ACTIVE / REJECTED`、
   `ACTIVE → SUSPENDED`（運営停止）、`REJECTED → PENDING_REVIEW`（再申請）。
   **再審査・復帰の戻り先を必ず定義すること**（現仮説には抜けがある）:
   - `ACTIVE → PENDING_REVIEW`: SELLER が重要フィールド（Q4）を編集して再審査に戻る遷移。
     これが無いと Q4「編集時のみ再審査」の戻り先が状態機械に存在しない。
   - `SUSPENDED → ???`: 運営停止からの復帰経路（例: `SUSPENDED → ACTIVE` 直接復帰、または
     `SUSPENDED → PENDING_REVIEW` 再審査経由）を定義する。復帰不能の終端にしない。
   - 各遷移の**実行権限**（SELLER が起こせる遷移 / ADMIN のみの遷移）も併記する。
   既存商品の初期値（全量 `ACTIVE` へ backfill）も決める。
2. **審査ポリシーの切り替え機構**: 「全商品審査 / 新規販売者のみ審査 / 事後審査（即公開 +
   事後チェック）」をデータでどう表現するか。グローバル設定 1 レコードか、店舗ごとの
   `trustLevel` か。ブランド確定時に**コード変更なしで**厳格さを変えられること
   （EXPANSION_BLUEPRINT §5 の検算表）が要件。
3. **公開クエリへの反映（ブラウズ用スコープ）**: **発見/ブラウズ経路**（ブラウズ・ホーム・
   商品詳細・検索 route）に `listingStatus: ACTIVE` + `store: { status: ACTIVE }` を漏れなく効かせる方法。
   各クエリに where を足すか、共通の「公開商品スコープ」ヘルパー（例:
   `publicProductWhere()` を `src/lib/` に置き全**ブラウズ**経路で合成）を導入するか。
   **漏れが即セキュリティ/信頼性問題になるため、grep で機械的に検証可能な形**を選ぶこと。

   > **カート/チェックアウト/注文履歴の商品参照は、このブラウズ用公開スコープと分離すること**
   > （無条件に `listingStatus: ACTIVE` を適用しない）。理由:
   > - ユーザーが既にカートへ追加した商品が後で `SUSPENDED`/`REJECTED` になった場合、
   >   ブラウズ用スコープをそのままカート参照に適用すると**カートから商品が黙って消え**、
   >   小計やチェックアウトが壊れる（UX/整合性の破綻）。
   > - **注文履歴**は過去購入品の参照であり、現在の公開状態に関わらず**必ず読めなければならない**
   >   （履歴の商品が公開停止で 404 になってはならない）。
   > よって設計は 2 系統に分ける:
   >   (i) **ブラウズ用公開スコープ** = `listingStatus: ACTIVE` + `store.status: ACTIVE`（発見経路のみ）。
   >   (ii) **カート/チェックアウト用参照** = 公開スコープを課さず、代わりに「購入可能性チェック」
   >        （在庫・現在の購入可否）をチェックアウト時に**別ロジックで**行い、非 ACTIVE 品は
   >        「購入不可」を明示表示する（消さない）。注文履歴は状態フィルタなしで読む。
   > Q3 の grep 検証は (i) の経路にのみ適用し、(ii) を誤って (i) のスコープに含めないことを確認する。
4. **SELLER の編集と再審査**: ACTIVE 商品の編集は即反映か、重要フィールド（名前・画像・
   カテゴリ）の変更時のみ再審査か。`upsertProduct`（`product.ts:71`）の分岐設計。
5. **審査 UI と運用コスト**: admin の審査キュー（承認/差し戻し + 理由）を
   `src/app/dashboard/admin/orders/` の TanStack table パターンでどう組むか。
   ADMIN KPI「カタログ維持コストの低減」と矛盾しないため、一括承認・フィルタ
   （新規販売者のみ表示等）を初期スコープに含めるかを判断する。
6. **plan 014 との接続**: 「カテゴリ必須属性の欠落」を審査差し戻し理由に含めるか、
   入口の Zod 検証で保存自体をブロックするか（014 の Open question 5 と同一論点 —
   両設計で矛盾しない決定を出し、相互参照を明記する）。

## Steps

### Step 1: 公開経路の棚卸しと露出検証

ストアフロントが商品を取得する全経路（ブラウズ・ホーム・商品詳細・検索 route・カート/
チェックアウトの商品参照）を列挙し、各経路が `store.status` を検証しているかを確認する。

**Verify**: 経路一覧表（経路 × store.status 検証有無）が完成し、BANNED/DISABLED 店舗の
商品が露出する経路が特定されている（または「露出なし」の証拠がある）。

### Step 2: 状態機械とポリシー機構の設計

Open questions 1・2・4 に答える。既存 `StoreStatus` + `updateStoreStatus` の遷移実装
（条件付き更新・`$transaction`）をテンプレートに、商品版の遷移表と審査ポリシーの
データモデルを確定する。plan 012 の spike が確立した「遷移は条件付き updateMany で
冪等化する」パターン（`plans/012-spike-item-level-inventory-restock.md` 参照）に倣う。

**Verify**: 遷移表（現在状態 × アクション × 権限 → 次状態）と、ポリシー切り替えが
コード変更なしで効くことの説明が design doc 案にある。

### Step 3: 公開スコープの設計

Open question 3 に答える。共通ヘルパー方式を採る場合は、既存の全経路への適用手順と
「適用漏れを CI/grep で検出する方法」（例: `db.product.findMany` の直接使用を検索対象にする
lint 的チェック）を設計する。

**Verify**: 全経路への適用マトリクスと検出方法が明記されている。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/catalog-approval/design.md` を書き、`plans/0NN-implement-catalog-approval.md` を
plan-template 準拠で書く。実装プランには: enum 追加（非衝突名）+ backfill マイグレーション →
ERD 再生成 → 公開スコープ適用 → 審査 action（`requireAdmin`、IDOR 3 階層テスト付き）→
審査 UI → E2E、を含める。

**Verify**: 後続プランの done criteria に「BANNED 店舗の商品がブラウズ・検索・商品詳細に
出ないことの E2E/統合テスト」が含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/catalog-approval/design.md` が存在し、Open questions 全6問に決定 + 証拠がある
- [ ] 公開経路の棚卸し表と BANNED/DISABLED 露出の検証結果が design doc にある
- [ ] enum 命名が既存 `ProductStatus`（schema.prisma:560 — 注文アイテム配送状態）と衝突していない
- [ ] `plans/0NN-implement-catalog-approval.md` が存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` が新規ドキュメント/プランのみ）
- [ ] `plans/README.md` の 016 ステータス行を更新し、露出問題があれば deferred 節に追記した

## STOP conditions

以下の場合は STOP して報告する:

- `Product` に公開状態カラムが既に追加されている（前提消滅）
- Step 1 で BANNED 店舗の商品露出が**確認され、かつ**それが即時悪用可能な深刻度
  （例: BANNED 店舗が決済まで完了できる）と判明した場合 — 審査ワークフロー設計より先に
  修正すべき P1 発見としてただちに報告する（本 spike の続行より優先）
- 審査ポリシー機構が SaaS ロードマップの orgId 設計（ゲート済み Phase 2）を先取りしないと
  成立しない構造になった場合 — 単一テナント前提で成立する代替案を添えて判断を仰ぐ

## Maintenance notes

- 公開スコープヘルパーは**将来のあらゆる商品取得クエリが通る門**になる — 新規クエリ追加時の
  適用漏れが最大の再発リスク。design doc の「検出方法」を CI に載せることを後続プランで検討
- DIRECTION-03（サポートチケットコンソール）の RETURN_REQUEST/DISPUTE 処理と、本審査の
  SUSPENDED 遷移は将来同じ admin 運用画面群に並ぶ — UI パターン（TanStack table）を揃えること
- レビュアーが後続実装 PR で最も精査すべき点: backfill マイグレーションの安全性
  （既存全商品が意図せず非公開になる事故の防止）と、審査 action の IDOR テスト
