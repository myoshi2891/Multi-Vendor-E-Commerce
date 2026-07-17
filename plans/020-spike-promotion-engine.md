# プラン 020（design/spike）: プロモーション・キャンペーンエンジンを設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat 86c04a1..HEAD -- prisma/schema.prisma src/queries/coupon.ts src/queries/product.ts src/lib/schemas.ts`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> キャンペーン/価格履歴系モデルがスキーマに追加済み、または `Coupon.startDate/endDate` が
> DateTime 化済みなら STOP して報告する。

## Status

- **Priority**: P3（成長 — Phase D。カタログ構造の完成度に比例して効果が増す）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW-MED（読み取り調査は安全。本体実装は価格計算・カート合計に波及するため
  金額まわりの regression リスクが本ラウンドで最も高い）
- **Depends on**: なし（019/021/022 と独立。カテゴリ対象絞り込みは spike 013 の
  ツリー設計を消費するが、013 未確定でも現行2階層前提で設計可能 — 前提を design doc に明記）
- **Category**: direction
- **Planned at**: commit `86c04a1`, 2026-07-10
- **背景ドキュメント**: `plans/direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` §3-⑧ /
  `plans/audit/findings-10-direction-operations-growth.md` O-3

## Why this matters

現行の販促手段は (a) クーポン（店舗/プラットフォームの2スコープ、パーセント引きのみ）と
(b) 販売者が variant 単位で自己申告する `isSale` フラグだけで、
**プラットフォームが企画・編成するセールイベント（Amazon のタイムセール・季節セール型）を
表現する構造が無い**。さらにクーポンには利用回数上限・最低購入額・対象絞り込みが無く
（乱用制御不能）、日付が文字列型（TZ・比較の保証なし）、参考価格の根拠となる価格履歴も無い
（二重価格表示の適正性をデータで担保できない）。本 spike は既存クーポン基盤を土台に、
**(a) クーポンの表現力拡張、(b) キャンペーンエンティティ、(c) 価格履歴**の3層を設計する。
販促の頻度・強度はブランド次第のため、イベント種別・割引ポリシーはデータで差し替え可能にする。

> **価格履歴の要件は「対象法域」に依存する（未確定 — 実装前に必ず確認）**。「二重価格表示の適正性」を
> データで担保するために価格履歴が何を保持すべきかは**適用法域で異なる**ため、法域を決めずに
> スキーマ要件を固定しない。
>
> ⚠️ **以下の法域別要件は未検証の初期仮説であり、そのまま設計の根拠にしないこと**。
> spike は各要件を**一次資料**（法令・指令の条文本体、規制当局の公式ガイドライン）で裏付け、
> design doc に**出典を明記**する（法令名 / 条番号 / 発行機関 / URL / 参照日）。
> 二次情報（ブログ・ベンダー記事・要約サイト）や本プランの記述自体を典拠にしないこと。
> **裏付けが取れるまで、下記の具体的な数値・基準をスキーマ要件へ落とさない** —— 特に「30 日」は
> 価格履歴の保持期間という**スキーマ要件を直接駆動する数値**であり、誤れば法令非対応か過剰実装に
> 直結する。法的助言が必要と判断したら STOP して報告する（本 spike は法務判断の代替ではない）。
>
> 一次資料を当たる際の**出発点**（条文番号・要件の細部とも未検証）:
> - **EU**: いわゆる Omnibus 指令 — Directive (EU) 2019/2161。価格表示指令 Directive 98/6/EC を
>   改正し、値引き告知に関する規定（Art. 6a 相当）を挿入したもの。「参照価格 = 告知前の一定期間
>   （30 日とされる）の最低価格」という理解の当否を条文本体で確認する。加盟国ごとの国内法化の
>   差異（生鮮品等の適用除外・期間の別段の定め）も併せて確認すること。
> - **US**: FTC の欺瞞的価格表示ガイド — 16 CFR Part 233（Guides Against Deceptive Pricing）。
>   「実売実績のある通常価格」という理解の当否を確認する。州法（例: カリフォルニア）の上乗せ規制の
>   有無も確認すること。
> - **日本**: 景品表示法（不当景品類及び不当表示防止法）第5条第2号（有利誤認表示）と、
>   消費者庁の価格表示ガイドライン（「不当な価格表示についての景品表示法上の考え方」）。
>
> - **現状の本プロジェクトの対象法域は未宣言**（`product.md` に記載なし）。
>   → spike は法域を**「未定・実装前に要確認」プレースホルダ**として明記し、
>   「もし EU 基準なら（一次資料で確認した）期間の最低価格を出せる粒度が必要」等の
>   **条件付き要件**として設計する。
>   勝手に特定法域を仮定して要件を固定しないこと（誤ると法令非対応 or 過剰実装になる）。
> - 併せて、多通貨・税計算が現フェーズのスコープ外（`product.md`）である点との整合も注記する。

## Current state（設計前に必ず読む）

### Coupon — 2スコープは在るが表現力が無い（`prisma/schema.prisma:665-691`）

```prisma
enum CouponScope {              // schema.prisma:665
  STORE
  PLATFORM
}
model Coupon {                  // schema.prisma:670
  code      String @unique
  startDate String              // ← 文字列日付（DB レベルの型・TZ 保証なし）
  endDate   String              // ← 同上
  discount  Int                 // ← パーセントのみ。固定額引き・上限額なし
  isActive  Boolean @default(true)
  scope     CouponScope @default(STORE)
  storeId   String?             // PLATFORM は null
}
```

**無いもの**: 利用回数上限（全体/ユーザー毎）・最低購入額・対象絞り込み（カテゴリ/商品/
店舗集合）・併用可否。

### 既存のクーポン運用 — 再利用する資産（`src/queries/coupon.ts`）

- SELLER 用 CRUD: `upsertCoupon`（`coupon.ts:32`）— scope をクライアント入力から信用せず
  STORE に固定（`coupon.ts:79`）、cross-store/PLATFORM hijack 防御（`coupon.ts:44-57`）
- ADMIN 用 CRUD + UI: `getAllCoupons` / `upsertCouponAsAdmin` / `deleteCouponAsAdmin` /
  `toggleCouponActive`（`coupon.ts:349-486`）+ `src/app/dashboard/admin/coupons/`
- 適用: `applyCoupon`（`coupon.ts:212`）— PLATFORM = 全店舗 / STORE = 対象店舗のみ
  （`coupon.ts:266-267`）。並行適用は CAS 対策済み（Round 1 監査で健全確認済みの資産）
- Zod: `CouponScopeEnum` + 「STORE なら storeId 必須、PLATFORM なら null/空」の相関検証
  （`src/lib/schemas.ts:550-565`）

### バリアントセール — 販売者の自己申告（`prisma/schema.prisma:172-216`）

```prisma
model ProductVariant {          // schema.prisma:172
  isSale      Boolean @default(false)   // schema.prisma:178
  saleEndDate String?                    // schema.prisma:179 — 文字列。自動終了処理なし
}
model Size {                    // schema.prisma:200
  discount Float @default(0)             // schema.prisma:205 — サイズ別値引き率
}
```

- ストアフロントは `isSale` のとき `saleEndDate` を表示に渡すのみ
  （`src/queries/product.ts:256-257,407-409,1052`）— **期限切れの強制終了はどこにも無い**
- `OfferTag`（`schema.prisma:245-254`）は name/url のみの手動マーチャンダイジングタグ
  （ホームのタブ表示等）。期間・割引の概念は無い

### 価格履歴 — 存在しない

価格変動を記録するテーブルは無い。参考価格（取り消し線表示）を出す場合の根拠データが無い。

### 遵守すべきリポジトリ規約

- **金額は `Decimal(12,2)` + `Prisma.Decimal` 演算**（固定額引き・上限額・価格履歴で必須。
  中間集計での `.toNumber()` 加算は禁止 — `.claude/steering/tech.md`）
- 配送料計算は `computeShippingTotal`（`src/lib/shipping-utils.ts`）の SSOT を崩さない —
  販促は商品価格側にのみ作用し、配送料割引を導入する場合は SSOT 側の拡張として設計する
- 認可は auth-guards。キャンペーン編成は `requireAdmin`
- スキーマ変更時は ERD 再生成（`.claude/rules/03-data-model-diagram-sync.md`）
- カート再計算・注文確定との整合は `db.$transaction`

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| 価格計算の全経路列挙 | `grep -rn "discount\|salePrice\|isSale" src/queries/ src/lib/ -l` | 価格導出箇所一覧 |
| カート合計の計算箇所 | `grep -n "subTotal\|total" src/queries/user.ts \| head -20` | カート/チェックアウトの合計計算 |
| saleEndDate の期限判定有無 | `grep -rn "saleEndDate" src/` | 表示 pass-through のみ（判定なし） |
| クーポン適用の割引計算 | `sed -n '260,340p' src/queries/coupon.ts` | applyCoupon の割引ロジック |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/promotion-engine/design.md`（新規） — Open questions 全てに決定 + 根拠
- 後続**実装**プラン `plans/0NN-implement-promotion-engine.md`（実行時点の次の空き番号、
  plan-template 準拠。3層を段階分割する場合は複数プラン可 — 分割判断も spike の成果物）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- 多通貨・税計算（`product.md` スコープ外 — 単一通貨前提）
- 広告・スポンサープロダクト（露出課金）— 収益化はゲート付き将来項目として言及のみ
- レコメンド・検索でのセール優遇表示（spike 015/017 の領域 — 接続点の言及のみ）
- 既存 `applyCoupon` の CAS ロジック改変（健全資産 — 拡張フィールドの追加参照のみ）

## Open questions（spike が証拠付きで必ず答える）

1. **Coupon 拡張の形**: `startDate/endDate` の `DateTime` 化（既存データの migration 戦略
   込み）、`discount Int` → 割引種別（率 / 固定額）+ `Decimal(12,2)` 額、利用回数上限
   （全体 / ユーザー毎 — 利用記録テーブルの要否）、最低購入額、対象絞り込み
   （カテゴリ / 商品 / 店舗集合）のそれぞれを入れるか・どう表現するかを確定する。
   **後方互換**: 既存クーポン運用（SELLER/ADMIN の CRUD・applyCoupon）を壊さない
   段階導入手順を含めること。
2. **キャンペーンエンティティの形**: プラットフォーム主導セール（期間・名称・対象商品の
   編成・割引の与え方）をどうモデル化するか。対象は商品単位の手動編成か、カテゴリ/
   店舗/OfferTag による規則指定か。**「キャンペーン参加」を販売者が申請する形**
   （Amazon のセール申請型）を初期スコープに含めるかも判断する。
   `OfferTag` との関係（統合 / 併存 / OfferTag をキャンペーンの表示面として再利用）を確定する。
3. **価格の優先順位と合成規則**: variant セール（`Size.discount`）・キャンペーン割引・
   クーポンが重なったときの適用順・併用可否。**最終価格の導出を単一関数に集約する**
   （配送料の `computeShippingTotal` と同型の SSOT — 例: `computeEffectivePrice()`）ことを
   前提に、入力（基準価格・各種割引）と出力の契約を設計する。

   > **`Size.discount` の Decimal 移行を設計項目に含めること**: 現行スキーマは
   > `Size.discount Float @default(0)`（`schema.prisma:205`）だが `Size.price` は
   > `Decimal(12,2)`。discount は**最終価格の計算に入る**ため、`.claude/steering/tech.md`
   > （金額・数値精度: Float 禁止、`Prisma.Decimal` 演算必須）に反する。設計で:
   > - `Size.discount` を `Decimal` 化する（パーセントなら `Decimal(5,2)`、金額なら `Decimal(12,2)`。
   >   discount の意味＝%かフラット額かを先に確定してから型を選ぶ）。
   > - **移行・変換契約**: 既存 Float 値の backfill 手順（`Float → Decimal` の丸め方針込み）、
   >   補正マイグレーションの作成（既存マイグレーション改変禁止 — 新規追加）、ERD 再生成
   >   （`.claude/rules/03`）を手順化する。
   > - 同様に `Coupon.discount Int`（`schema.prisma:675`）の意味（整数%）も合成関数の入力契約で明示する。
   >
   > **丸め規則と桁数を契約化すること**（`computeEffectivePrice()` の SSOT 契約の一部）:
   > - 中間計算は `Prisma.Decimal` のまま保持し、**途中で `.toNumber()` して number 加算しない**
   >   （IEEE754 誤差の蓄積防止 — tech.md）。
   > - **丸めは最終結果の 1 箇所のみ**（例: 通貨最小単位に合わせ小数第 2 位へ `ROUND_HALF_UP`）。
   >   複数割引を重ねる場合の「各段で丸めるか最後に 1 回丸めるか」を明示的に決め、契約に書く
   >   （段ごとの丸めは合計がズレる）。
   > - 出力は `Decimal(12,2)` 相当（表示・保存の桁数）を保証し、負値にならない下限クランプ規則も定義する。
4. **価格履歴**: 粒度（Size 単位か variant 単位か）・記録タイミング（価格変更時トリガー）・
   参考価格の算出規則（直近 N 日の最頻値等 — 二重価格表示の規制対応として最低限何を持つか）。
   初期スコープを「記録のみ（表示は後続）」に絞る判断も可 — 根拠を書く。
5. **セール自動終了の実行方式**: `saleEndDate` / キャンペーン期限の失効を
   (a) 読み取り時判定（クエリの where/導出で期限を評価 — cron 不要）、
   (b) cron/スケジューラでのフラグ更新、のどちらで行うか。Vercel 環境の制約
   （常駐プロセス不可）を踏まえて確定する。
6. **表示面の初期スコープ**: セールイベントのランディング（`/sale/[campaign]` 等）・
   カウントダウン・取り消し線価格のうち、初期実装に含める最小集合を確定する
   （ホームの既存 OfferTag タブ表示の再利用可否を含む）。

## Steps

### Step 1: 価格導出経路の棚卸し

商品価格がユーザーに提示される・請求される全経路（商品カード・商品詳細・カート・
チェックアウト・注文確定 `placeOrder`）で、`Size.discount` / クーポンがどう合成されているかを
追跡し、価格導出ロジックの現在地（重複・分散の有無）を表にする。

**Verify**: 経路 × 価格導出方式の一覧表が design doc 案にあり、SSOT 関数導入時の
置き換え対象が特定されている。

### Step 2: Coupon 拡張とキャンペーンの設計

Open questions 1〜2 に答える。既存 `applyCoupon` の CAS・scope 防御を壊さない拡張で
あることを、該当コード（`coupon.ts:44-57,79,266-267`）への影響分析付きで示す。

**Verify**: 新旧スキーマ対比表と migration 戦略（既存クーポンの backfill 込み）が
design doc 案にある。

### Step 3: 価格合成 SSOT と価格履歴の設計

Open questions 3〜5 に答える。合成規則は表（割引の組み合わせ × 適用順 → 最終価格）で
確定し、`Prisma.Decimal` 演算前提の関数契約を書く。

**Verify**: 合成規則表・価格履歴のデータモデル・失効方式の決定が design doc 案にある。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/promotion-engine/design.md` を書き、後続実装プラン（分割判断に従い 1〜3 本）を
plan-template 準拠で書く。実装プランには: スキーマ変更 + migration + ERD 再生成 →
価格合成 SSOT 関数（ユニットテスト必須 — `computeShippingTotal` のテストパターンに倣う）→
キャンペーン CRUD（`requireAdmin`）→ 表示面 → E2E、を含める。

**Verify**: 後続プランの done criteria に「割引合成の境界ケース（併用不可・上限額・
期限切れ）のユニットテスト」が含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/promotion-engine/design.md` が存在し、Open questions 全6問に決定 + 根拠がある
- [ ] 価格合成規則表と SSOT 関数の契約（入出力・Decimal 演算）が design doc にある
- [ ] 価格履歴の法域別要件が **一次資料で裏付けられ、出典（法令名 / 条番号 / 発行機関 / URL /
      参照日）が design doc に明記**されている。裏付けの取れない基準を条件付き要件のまま残す場合は
      「未検証」と明示され、スキーマ要件へ落とされていない（Current state の blockquote 参照）
- [ ] 既存クーポン運用の後方互換（migration 手順込み）が design doc にある
- [ ] イベント種別・割引ポリシーが「コード変更なしで差し替え可能」である説明が design doc にある
- [ ] 後続実装プランが存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` の変更が新規ドキュメント/プランと、下記の `plans/README.md` 更新のみ）
- [ ] `plans/README.md` の 020 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- キャンペーン/価格履歴系モデルが既にスキーマに追加されている（前提消滅）
- Step 1 の棚卸しで、価格導出が想定以上に分散しており（例: 5 経路以上で独立実装）、
  SSOT 化自体が L エフォートの独立リファクタリングになると判明した場合 — SSOT 化を先行プランに
  分離する提案を添えて報告する
- 調査中にクーポン/割引まわりの金額計算に実害のある誤り（丸め・二重適用等）を発見した場合 —
  正確性の P1/P2 発見としてただちに報告する（設計より修正が先）
- 価格履歴の法域別要件について**一次資料で裏付けが取れない**、または対象法域の確定や条文解釈に
  **法務判断が要る**と判明した場合 — 推測で要件を確定させず、確認できた範囲と未確定点を整理して
  報告する（本 spike は法務判断の代替ではない。誤った要件はスキーマに固着する）
- Round 1 plan 003/005/006（決済信頼・カート整合）が未実行で、本設計がそれらの
  in-scope（`user.ts` のカート合計等）と重い変更競合を生むと判明した場合 —
  実行順序の勧告を添えて報告する

## Maintenance notes

- 価格合成 SSOT は将来のあらゆる価格表示・請求の門になる — 導入後に「SSOT を経由しない
  価格計算」を grep で検出する運用（`computeShippingTotal` と同じ規約化）を後続プランで
  tech.md へ追記提案すること
- キャンペーン対象の規則指定（カテゴリ集合）は spike 013 の N 階層ツリー確定後に
  「サブツリー指定」へ拡張余地がある — design doc に前提（現行2階層 or ツリー）を明記
- レビュアーが後続実装 PR で最も精査すべき点: 割引合成の Decimal 演算（中間 `.toNumber()`
  禁止の遵守）と、キャンペーン期限境界（失効直前の カート → 注文確定）の整合
