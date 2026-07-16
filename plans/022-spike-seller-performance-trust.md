# プラン 022（design/spike）: セラーパフォーマンス指標と自動措置を設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat 86c04a1..HEAD -- prisma/schema.prisma src/queries/order.ts src/queries/store.ts`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> OrderGroup/OrderItem に `shippedAt`/`deliveredAt` 相当のタイムスタンプ（または
> 状態遷移イベントログ）が追加済みなら STOP して報告する。

## Status

- **Priority**: P3（マーケットプレイスの「治安」 — Phase C。spike 016 = 入口の品質、
  本プラン = 継続運用の品質、で対をなす）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW-MED（読み取り調査は安全。本体実装は注文フローの全遷移点への
  タイムスタンプ記録追加を含むため、書き込み経路の網羅漏れが主リスク）
- **Depends on**: なし（推奨順: plan 019 の後 — 019 が確定させる `Store.averageRating`
  更新経路が本プランの評価シグナル1系統を供給する。019 未実行でも進行可能 —
  その場合、評価シグナルは「019 の設計に従う」前提を design doc に明記）
- **Category**: direction
- **Planned at**: commit `86c04a1`, 2026-07-10
- **背景ドキュメント**: `plans/direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` §3-⑩ /
  `plans/audit/findings-10-direction-operations-growth.md` O-5

## Why this matters

措置の仕組み（`StoreStatus.BANNED/DISABLED` + admin の店舗管理 UI）は在るのに、
**措置を判断する材料が構造的に存在しない**。注文の状態は enum で分かるが「いつ遷移したか」が
記録されず（`createdAt`/`updatedAt` のみ）、出荷遅延率が計算不能。`Store.averageRating` は
どのクエリも更新しない死にフィールド。キャンセル率・返品率の集約もない。
販売者数が増えるほど、運営は「なんとなく怪しい店舗」を勘で処分するか放置するかの二択になり、
カタログの信頼（Round 2 spike 016 が守る入口の品質）が継続運用で毀損されていく。
本 spike は Amazon の Account Health に相当する骨組み — **(a) 事実タイムスタンプ、
(b) 店舗メトリクス集約、(c) 閾値ポリシー → 措置の接続** — を、閾値・措置の厳しさを
ポリシー（データ）で差し替え可能な形で設計する。**分析ダッシュボードは作らない**
（`product.md` スコープ外 — 措置判断のシグナルと販売者への通知に限定）。

## Current state（設計前に必ず読む）

### 措置側 — 存在する（`prisma/schema.prisma:76-81` ほか）

```prisma
enum StoreStatus {              // schema.prisma:76
  PENDING
  ACTIVE
  BANNED
  DISABLED
}
```

- admin の店舗ステータス変更: `updateStoreStatus`（`src/queries/store.ts:531-602` —
  `$transaction` で status 更新 + PENDING→ACTIVE 時のロール昇格 + Clerk 同期）
- admin UI: `src/app/dashboard/admin/stores/`

### 判断材料側 — 存在しない

1. **事実タイムスタンプの欠落**（`prisma/schema.prisma:529-558,612-639`）:
   `OrderGroup` / `OrderItem` は `createdAt` / `updatedAt` のみ。
   `Shipped` になった時刻・`Delivered` になった時刻が残らないため、
   **「注文から出荷までの日数」「約束納期の遵守率」が計算不能**。
   `updatedAt` は任意の更新で動くため代用にならない。
2. **約束側は在る**（`schema.prisma:536-537`）:
   ```prisma
   shippingDeliveryMin Int   // OrderGroup — 注文時点の配送約束日数スナップショット
   shippingDeliveryMax Int
   ```
   「約束 vs 実績」の**実績側だけが無い**。
3. **評価シグナルは死んでいる**（`schema.prisma:93-94`）:
   `Store.averageRating` / `numReviews` は更新する query が無い（詳細: plan 019 / O-2）。
4. **率系メトリクスの集約なし**: キャンセル率（`OrderItem.status = Canceled` の比率）・
   返品率（同 `Returned`）・チケット率（`SupportTicket.orderId` → OrderGroup → storeId で
   店舗に帰属可能）を集約する仕組みが無い。

### 状態遷移の書き込み点（タイムスタンプ記録のフック候補）

- SELLER: `updateOrderGroupStatus`（`src/queries/order.ts:164`）/
  `updateOrderItemStatus`（`order.ts:229`）
- ADMIN: `updateOrderGroupStatusAsAdmin`（`order.ts:459`）/
  `updateOrderItemStatusAsAdmin`（`order.ts:521`）
- いずれも**任意ステータスへ自由遷移可能**（状態機械ガードなし — plan 018 O-1 でも指摘）。
  タイムスタンプ記録は「遷移の正しさ」に依存するため、この自由遷移が精度リスクになる

### 遵守すべきリポジトリ規約

- 認可は auth-guards。措置 action は `requireAdmin`
- 状態遷移 + タイムスタンプ記録 + 措置は `db.$transaction`
- スキーマ変更時は ERD 再生成（`.claude/rules/03-data-model-diagram-sync.md`）
- `src/` で `console.log` 禁止 / 構造化ログ2引数形式
- センシティブデータ（措置理由に含まれうる顧客情報）のログ出力禁止

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| 状態書き込み点の網羅 | `grep -rn "orderGroup.update\|orderItem.update\|updateMany" src/queries/ \| head -20` | 遷移点の全列挙 |
| webhook 経由の状態変更確認 | `grep -rn "orderStatus\|paymentStatus" src/app/api/webhooks/ src/queries/stripe.ts src/queries/paypal.ts \| head -15` | 決済起点の遷移点 |
| SupportTicket → 店舗の帰属経路 | `grep -n "orderId" prisma/schema.prisma \| head` | Ticket→Order→Group→Store の鎖 |
| admin stores UI の構造 | `ls src/app/dashboard/admin/stores/` | 措置 UI の挿入点 |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/seller-performance/design.md`（新規） —
  Open questions 全てに決定 + 根拠
- 後続**実装**プラン `plans/0NN-implement-seller-performance.md`（実行時点の次の空き番号、
  plan-template 準拠。タイムスタンプ導入とメトリクス/措置で段階分割する場合は複数可）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- 販売者向け分析ダッシュボード（`product.md` スコープ外 — 販売者が見るのは
  「自店舗の健全性ステータスと警告」まで、と線引きする）
- 出品審査（spike 016 の領域 — StoreStatus の公開クエリ反映は 016 の検証項目。相互参照のみ）
- 不正検知（決済不正・レビュー操作の検出 — 将来項目として言及のみ）
- レビュー集計の修正そのもの（plan 019 の領域 — 供給を受ける側として接続のみ）

## Open questions（spike が証拠付きで必ず答える）

1. **事実タイムスタンプの持ち方**: (a) 専用カラム（`shippedAt`/`deliveredAt` 等を
   OrderItem/OrderGroup に追加 — 単純・クエリ容易・遷移種別ごとにカラム増）、
   (b) イベントログテーブル（`OrderStatusEvent`: 対象・旧状態・新状態・実行者・時刻 —
   汎用・監査証跡になる・集計に JOIN 必要）のどちらか。**監査証跡（誰がいつ遷移させたか）の
   価値**と集計コストを比較して確定する。plan 018 の RMA 状態機械が同じ問いを持つため、
   018 と同一方式に揃えること（018 実行済みならその決定に従う）。
2. **メトリクスの定義**: 遅延出荷率（実績出荷日数 > `shippingDeliveryMax` の比率）・
   キャンセル率・返品率・評価（019 供給）・チケット率の各定義（分母・対象期間・
   最小注文数の足切り）を確定する。**新規店舗（サンプル数不足）の扱い**も決める。
3. **集計の実行方式**: リアルタイム（遷移時に増分更新）か日次バッチ（cron で再計算）か。
   Vercel 環境の制約（常駐不可）と、措置判断に必要な鮮度（日次で十分か）から確定する。
   集計結果の置き場（Store にカラム追加 vs 別テーブル `StoreHealthSnapshot`）も決める。
4. **閾値ポリシーのデータ化**: 「遅延率 > X% が N 日継続 → 警告、> Y% → DISABLED 候補」の
   ような規則をどう表現するか。ブランド確定時（例: B2B 寄りなら緩和）に**コード変更なしで**
   差し替え可能であること（OPERATIONS_TRUST_GROWTH_BLUEPRINT §1.2）。
5. **自動措置の human-in-the-loop**: 警告（販売者への通知 — plan 021 経由）は自動、
   `DISABLED`/`BANNED` は「候補としてキュー化し ADMIN が承認」とする初期仮説の妥当性を
   確認する。**完全自動の BAN は誤判定時の被害が大きい** — 自動化の段階（通知のみ →
   新規出品停止 → DISABLED）を設計する。
6. **販売者への可視化の最小形**: 販売者ダッシュボードに出すのは「健全性ステータス
   （良好/警告/危険）+ 警告理由 + 改善基準」まで、とする線引きが KPI（販売者の操作性）と
   スコープ外（高度分析）の両方に整合するかを確認する。

## Steps

### Step 1: 遷移点とメトリクス素材の棚卸し

注文状態を書き込む全経路（seller/admin action・決済 webhook・placeOrder）を列挙し、
各経路で「タイムスタンプ記録 or イベントログ挿入」を追加する場合の挿入点と
`$transaction` の内外を確認する。SupportTicket → 店舗の帰属経路も検証する。

**Verify**: 遷移点一覧表（経路 × file:line × transaction 内外）と、各メトリクスの
素材データの有無マトリクスが design doc 案にある。

### Step 2: タイムスタンプ方式とメトリクス定義の確定

Open questions 1〜2 に答える。方式比較は「監査証跡の価値・集計 SQL の複雑さ・
スキーマ変更の大きさ・018 との整合」の4観点の表で行う。

**Verify**: 方式決定（根拠付き）と全メトリクスの定義表（分子/分母/期間/足切り）が
design doc 案にある。

### Step 3: 集計・閾値・措置の接続設計

Open questions 3〜6 に答える。「シグナル → 集計 → 閾値評価 → 措置（通知/キュー化/
ステータス変更）」のパイプラインを、既存の `updateStoreStatus`（`$transaction` +
Clerk 同期）を措置の実行部としてそのまま使う前提で設計する。
warning 通知は plan 021 のマッピング表に渡す形式（イベント名 + 受信者ロール）で定義する。

**Verify**: パイプライン図・閾値ポリシーのデータモデル・自動化段階の表が design doc 案にある。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/seller-performance/design.md` を書き、後続実装プラン（分割判断に従い 1〜2 本）を
plan-template 準拠で書く。実装プランには: タイムスタンプ/イベントログのスキーマ追加 +
ERD 再生成 → 全遷移点への記録組み込み（網羅チェックリスト付き）→ 集計実装（テスト:
既知の注文セットから期待メトリクスが出ること）→ 閾値評価 + 措置キュー（`requireAdmin`、
IDOR 3 階層テスト付き）→ 販売者向け健全性表示、を含める。

**Verify**: 後続プランの done criteria に「全遷移点の記録網羅性を grep で機械検証する手順」が
含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/seller-performance/design.md` が存在し、Open questions 全6問に決定 + 根拠がある
- [ ] タイムスタンプ方式が plan 018 の状態機械設計と整合（同一方式 or 相互参照）している
- [ ] メトリクス定義表と「新規店舗の足切り」規則が design doc にある
- [ ] 閾値・措置が「コード変更なしで差し替え可能」である説明と human-in-the-loop の
      段階設計が design doc にある
- [ ] 分析ダッシュボード（スコープ外）との線引きが明文化されている
- [ ] 後続実装プランが存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` が新規ドキュメント/プランのみ）
- [ ] `plans/README.md` の 022 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- 事実タイムスタンプ or 状態遷移イベントログが既にスキーマに追加されている（前提消滅）
- Step 1 で、決済 webhook 経由の状態変更が seller action と異なる整合性モデル
  （例: webhook が `$transaction` 外で多段更新）を持ち、タイムスタンプの一貫記録が
  この spike の範囲で設計しきれないと判明した場合 — 前提整理のための独立調査を提案して報告する
- 閾値ポリシー機構が spike 016 の審査ポリシー機構と統合すべき（同一テーブルで表現可能）と
  判明した場合 — 統合案を添えて 016 との調整を仰ぐ（勝手に 016 の設計を変えない）
- 調査中に「SELLER が自店舗の注文を Delivered に偽装して指標を操作できる」以外の、
  即時悪用可能な認可欠陥を発見した場合 — P1 発見としてただちに報告する
  （なお指標偽装の耐性自体は Open question 2 の設計論点に含めること）

## Maintenance notes

- 事実タイムスタンプ（またはイベントログ）は plan 018 の返品期限判定・将来の配送 SLA 表示
  にも使われる**基盤データ**になる — 方式決定は 018/022 で必ず一本化すること
- 閾値ポリシーは運用開始後に必ず調整が入る — 変更履歴（いつ誰がどの閾値に変えたか）を
  残すかを実装プランのレビュー論点にすること
- レビュアーが後続実装 PR で最も精査すべき点: 遷移点への記録追加の**網羅性**
  （1 経路でも漏れると率系メトリクスが系統的に歪む）と、措置 action の権限・監査証跡
