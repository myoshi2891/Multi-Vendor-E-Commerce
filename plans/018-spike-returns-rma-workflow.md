# プラン 018（design/spike）: 返品・交換（RMA）ワークフローを設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat 86c04a1..HEAD -- prisma/schema.prisma src/queries/support.ts src/queries/order.ts "src/app/(store)/returns-exchange"`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> RMA/Return 系モデルがスキーマに追加済み、または `SupportTicket.status` が enum 化済みなら
> STOP して報告する。

## Status

- **Priority**: P3（マーケットプレイスの「治安」 — Phase C。カタログ系 013〜015 と独立）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW-MED(読み取り調査は安全。本体実装は注文状態遷移と返金・在庫の接続を含むため要注意)
- **Depends on**: なし（設計消費のソフト依存: plan 021 の通知基盤が RMA 状態遷移通知の前提。
  021 未確定でも本 spike は進行可能 — その場合、通知は「発火点の定義まで」に留める）
- **Category**: direction
- **Planned at**: commit `86c04a1`, 2026-07-10
- **背景ドキュメント**: `plans/direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md` §3-⑥ /
  `plans/audit/findings-10-direction-operations-growth.md` O-1

## Why this matters

返品・交換の受付は自由記述のサポートチケット（`SupportTicketCategory.RETURN_REQUEST`）止まりで、
**どの注文アイテムを・何個・なぜ・どう解決するか**をデータで持てない。運営はチケット本文を
読んで手動で `OrderItem.status` を書き換えるしかなく、返品量が増えるほど手作業が線形に増える
（ADMIN KPI「カタログ維持コストの低減」に逆行）。さらに Round 1 の DIRECTION-01（返金実行）は
「何に対して返金するか」の構造化された起点を欠いたままである。本 spike は
**RMA エンティティ + 状態機械**を設計し、既存の三つの資産 — 受付チケット・
`ProductStatus.Returned/ExchangeRequested`・restock spike（plan 012）— を1本の
ワークフロー「チケット → RMA → 返金（DIRECTION-01）→ restock（012）」に接続する。
返品ポリシー（期間・可否）はブランド未定のためデータで差し替え可能にする
（OPERATIONS_TRUST_GROWTH_BLUEPRINT §1.2）。

## Current state（設計前に必ず読む）

### 受付面 — 自由記述チケット（`prisma/schema.prisma:755-781`）

```prisma
model SupportTicket {           // schema.prisma:755
  category SupportTicketCategory  // CONTACT / RETURN_REQUEST / DISPUTE / PROBLEM_REPORT
  name    String
  email   String
  subject String
  message String @db.Text        // ← 返品対象・数量・理由はすべてここに自由記述で埋まる
  orderId String?                // RETURN_REQUEST / DISPUTE のみ必須（Zod で強制）
  userId  String?                // ログイン送信時のみ。ゲスト送信は null
  status  String @default("OPEN") // 「閲覧 UI は後続（本 MVP は保存のみ）」（スキーマコメント）
  @@index([category, status])
}
```

- 受付ページ: `src/app/(store)/returns-exchange/page.tsx` — 静的ポリシー要約
  （`RETURNS_POLICY_SUMMARY` 定数）+ `<SupportForm category="RETURN_REQUEST" ...>`
- 保存 action: `createSupportTicket`（`src/queries/support.ts:16`）— 保存のみ。
  対応 UI は未実装（= DIRECTION-03 サポートコンソールの領域）
- 設計の正本: `docs/design/support-forms/design.md` §2.1（スキーマコメントが参照）

### 状態側 — enum は在るが遷移ガードが無い（`prisma/schema.prisma:560-610`）

```prisma
enum ProductStatus {            // schema.prisma:560 — OrderItem の配送状態
  ...
  Returned          // Product has been returned by the customer
  Refunded          // Product cost has been refunded
  ExchangeRequested // Customer requested an exchange for the product
  ...
}
// OrderItem.status ProductStatus @default(Pending)   — schema.prisma:633
```

- 遷移手段は販売者/管理者の手動更新のみ:
  `updateOrderItemStatus`（`src/queries/order.ts:229`、SELLER + 店舗所有権検証）/
  `updateOrderItemStatusAsAdmin`（`order.ts:521`）。**任意ステータスへ自由に遷移可能**
  （状態機械ガードなし）。
- `order.ts:538` に既知の TODO:
  `// TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）`
  — 在庫復元は **plan 012 の spike が設計を確定させる**。本 spike は 012 の設計を前提として
  接続点のみ定義し、restock 自体を再設計しない。

### 顧客の可視性 — pull 型照会のみ

- `trackOrder`（`order.ts:98`）: orderId + email 照合の公開照会（列挙防止のため不存在と
  email 不一致を同一応答 null にするパターン — RMA の顧客照会にも同じ配慮が要る）
- プロフィール注文履歴: `src/app/(store)/profile/` 配下。返品申請の状態を見る場所はない

### 返品ポリシーの現状

- `Store.returnPolicy String @default("Return in 30 days.")`（`schema.prisma:96`）と
  `ShippingRate.returnPolicy String`（`schema.prisma:311`）— **表示用の自由記述**であり、
  期間・可否判定に使える構造化データではない

### 遵守すべきリポジトリ規約

- 認可は `requireUser` / `requireAdmin` / `requireStoreOwner`（`src/lib/auth-guards.ts`）。
  インライン検査の新規追加は禁止
- **DB 状態遷移 + DB 副作用（OrderItem 更新・在庫）は `db.$transaction`**。ただし
  **外部通知（メール/プッシュ等）はトランザクションに含めない**。通知は「commit 成功後に発火」
  または outbox 経由にする（理由: 通知送信は DB でロールバックできない外部副作用。tx 内に置くと
  ①送信失敗が DB 状態をロールバックさせる、②commit 済みなのに送信だけ失敗して不整合、③そもそも
  送信済みメールは取り消せない、という問題が出る）。通知の原子性モデルは下記 Q6 で確定し plan 021 と揃える
- 遷移の冪等化は plan 012 spike が確立する「条件付き updateMany」パターンに倣う
- スキーマ変更時は ERD 再生成（`.claude/rules/03-data-model-diagram-sync.md`）
- 金額（返金額・店舗クレジット）は `Decimal(12,2)` + `Prisma.Decimal` 演算
- IDOR テストは 3 階層パターン（`docs/testing/SECURITY_GAP_REPORT.md` §5.2）— RMA は
  顧客・販売者・運営の3ロールが触るため必須

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| RETURN_REQUEST の現行フロー確認 | `grep -rn "RETURN_REQUEST" src/ --include="*.ts" --include="*.tsx"` | フォーム・schemas・support.ts のみ |
| OrderItem status の全遷移点列挙 | `grep -rn "updateOrderItemStatus\|status: ProductStatus\|OrderItem.*update" src/queries/` | order.ts の手動更新のみ |
| 注文履歴 UI の構造確認 | `ls "src/app/(store)/profile/"` | 顧客導線の挿入点 |
| 支払記録の確認（返金の下流） | `grep -n "PaymentDetails" prisma/schema.prisma src/queries/order.ts` | paymentIntentId の所在 |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/returns-rma/design.md`（新規） — Open questions 全てに決定 + 根拠
- 後続**実装**プラン `plans/0NN-implement-returns-rma.md`（実行時点の次の空き番号、plan-template 準拠）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- 返金の実行そのもの（DIRECTION-01 — 接続点の定義のみ）
- 在庫復元ロジックの設計（plan 012 spike の領域 — 接続点の定義のみ）
- サポートコンソール UI 全体（DIRECTION-03 — RMA 対応キューが将来そこに並ぶ前提の言及のみ）
- 配送キャリア連携（`product.md` スコープ外 — 返送追跡は追跡番号の手入力前提）
- 通知チャネルの実装（plan 021 の領域 — 発火イベントの定義のみ）

## Open questions（spike が証拠付きで必ず答える）

1. **RMA エンティティの形**: `ReturnRequest`（仮称）が持つべき構造 —
   対象 `OrderItem`（複数可か）・数量・理由コード（enum 化する値集合）・
   解決種別（返金 / 交換 / 店舗クレジット）・返送追跡番号（手入力）。
   `OrderGroup`（店舗単位）に紐づけるか `Order` に紐づけるか
   （マルチベンダーでは店舗単位の返品判断が自然 — 根拠を添えて確定する）。

   > **数量上限と同時実行時の不変条件を必須設計項目にすること**:
   > - 不変条件: ある `OrderItem` に対する **未取消の RMA 数量の合計 ≤ 購入数量
   >   （`OrderItem.quantity`）**。1 回の申請でも、複数申請の累積でもこれを超えられない
   >   （超過返金・超過交換を防ぐ）。
   > - **並行申請でも破れないこと**: 2 つの RMA 申請が同時に「残返品可能数」を読んでから両方作成すると
   >   合計が購入数を超えうる（TOCTOU）。対策として、作成を条件付き書き込みで原子化する
   >   （例: `INSERT ... WHERE (既存 RMA 数量合計 + 申請数) <= OrderItem.quantity` 相当を
   >   `$transaction` + 条件付き `updateMany`/行ロックで実現、または OrderItem に
   >   `returnedQuantity` を持たせて条件付き increment）。spike はこの原子化方式を確定する。
   > - 数量が 0 以下・購入数超過の申請は入口の Zod でも弾く（多層防御）。
2. **SupportTicket との関係**: RETURN_REQUEST チケットを RMA へ「昇格」させるのか、
   注文履歴からの直接申請で RMA を作り、チケットは相談窓口として並立させるのか。
   既存フォーム（`returns-exchange/page.tsx`）の扱い（置き換え or 維持）を含めて確定する。
3. **状態機械**: RMA の状態集合と合法遷移。初期仮説:
   `REQUESTED → APPROVED / REJECTED`、`APPROVED → AWAITING_RETURN → RECEIVED →
   RESOLVED(refund/exchange/credit)`、任意時点 `→ CANCELED`（顧客取り下げ）。
   各遷移の実行権限（顧客 / SELLER / ADMIN）と、`OrderItem.status`
   （`Returned` / `ExchangeRequested`）への反映タイミングを遷移表で確定する。
   **現状の `updateOrderItemStatus` が任意遷移可能である問題を RMA 側で再生産しない**こと。
4. **返品ポリシーのデータ化**: 返品可能期間・対象外条件をどう構造化するか。
   `Store.returnPolicy String`（表示用）を残しつつ構造化フィールド（例: `returnWindowDays Int`）
   を追加する案と、プラットフォーム共通ポリシー + 店舗上書きの2層案を比較する。
   期限判定の基準時刻（配達完了時刻が無い — findings-10 O-5 の事実タイムスタンプ欠落）と
   の依存関係を明示する（plan 022 の設計を先取りしない範囲で）。
5. **自動承認の閾値**: 「期間内 + 未開封相当の理由コードは自動 APPROVED」のような
   ポリシー駆動自動化をどこまで初期スコープに含めるか（含めない判断も可 — 根拠を書く）。
6. **通知イベントの定義 + 原子性モデルの確定**: RMA の状態遷移のうち顧客/販売者に通知すべきものを
   列挙し、plan 021 の「イベント → 通知マッピング」に渡す形式で定義する（021 未確定なら
   イベント名と受信者ロールの表まで）。
   **加えて、通知の原子性モデルを本 spike 内で確定する**（021 任せにしない）:
   - 通知は **DB tx の外**で発火する（上の「遵守すべきリポジトリ規約」参照）。
   - モデルの選択肢を比較して 1 つ決める:
     (α) **commit 後発火**（tx 成功をトリガに best-effort 送信。送信失敗はログ + リトライ/放置）、
     (β) **outbox**（tx 内で「通知すべきイベント行」だけを DB に書き、別ワーカーが後で送信 →
         at-least-once。重複排除は 021 の冪等性キーで担保）。
   - どちらでも「通知の送信可否が RMA の DB 状態遷移をロールバックさせない」ことを不変条件として明記する。
   - この決定は **plan 021 の tx 境界設計と一致**させる（相互参照を書く）。021 が別モデルを採ると
     決めた場合は本 spike も追随し、両者で矛盾させない。

## Steps

### Step 1: 現行フローの棚卸し

RETURN_REQUEST の受付から解決までの現行手順（フォーム → チケット保存 → 手動ステータス変更）
を、UI・action・スキーマの各層で追跡し、構造化されていない箇所を特定する。
`PaymentDetails`（`schema.prisma:693-712`）の `paymentIntentId` が返金の下流
（DIRECTION-01）で使える形かも確認する。

**Verify**: 現行フロー図（受付 → 対応 → 解決の各段で「誰が・何を・どのデータで」）が
design doc 案にあり、構造化ギャップが O-1 の記述と一致する。

### Step 2: RMA エンティティと状態機械の設計

Open questions 1〜3 に答える。店舗承認（`store.ts:531-602` の `$transaction` パターン）と
plan 012 の「条件付き updateMany による冪等遷移」をテンプレートに、遷移表
（現在状態 × アクション × 実行ロール → 次状態 + 副作用）を確定する。

**Verify**: 遷移表が design doc 案にあり、各遷移に実行権限・`OrderItem.status` への反映・
冪等化方式が明記されている。

### Step 3: ポリシーのデータ化と接続点の定義

Open questions 4〜6 に答える。「チケット（DIRECTION-03）→ RMA → 返金（DIRECTION-01）→
restock（012）」の接続点それぞれについて、受け渡すデータ（RMA ID・対象 OrderItem・数量・
解決種別）と発火条件を定義する。

**Verify**: 接続点定義表（上流/下流 × 受け渡しデータ × 発火条件）が design doc 案にある。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/returns-rma/design.md` を書き、`plans/0NN-implement-returns-rma.md` を
plan-template 準拠で書く。実装プランには: RMA モデル追加マイグレーション → ERD 再生成 →
顧客申請 action（`requireUser` + 注文所有権検証、IDOR 3 階層テスト付き）→
販売者/運営の承認 action（`requireStoreOwner` / `requireAdmin`）→ 顧客導線 UI
（注文履歴からの申請 + 状態表示）→ E2E、を含める。

**Verify**: 後続プランの done criteria に「他人の注文アイテムに対する RMA 申請が
拒否されることのテスト」が含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/returns-rma/design.md` が存在し、Open questions 全6問に決定 + 証拠がある
- [ ] 遷移表・接続点定義表（DIRECTION-01 / 012 / 021 / DIRECTION-03）が design doc にある
- [ ] 返品ポリシーが「コード変更なしでブランド別に差し替え可能」である説明が design doc にある
- [ ] `plans/0NN-implement-returns-rma.md` が存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` の変更が新規ドキュメント/プランと、下記の `plans/README.md` 更新のみ）
- [ ] `plans/README.md` の 018 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- RMA/Return 系モデルが既にスキーマに追加されている（前提消滅）
- plan 012 の spike が実行済みで、その設計が本 spike の初期仮説（RMA → restock の接続）と
  矛盾する場合 — 012 の設計を正とし、矛盾点を報告して判断を仰ぐ
- 調査中に「顧客が他人の注文の状態を変更できる」等の即時悪用可能な認可欠陥を発見した場合 —
  設計継続より先に P1 発見としてただちに報告する
- SupportTicket の構造変更（status の enum 化等）が DIRECTION-03 の設計と競合すると
  判明した場合 — 両立案を添えて判断を仰ぐ

## Maintenance notes

- RMA の状態機械は将来「交換品の再出荷」（新 OrderItem の生成）を要求する可能性がある —
  design doc に拡張余地として一言残すこと（初期スコープに含めない判断でよい）
- 返品期限判定は plan 022 の事実タイムスタンプ（`deliveredAt` 相当）が入ると精度が上がる —
  それまでの近似（`updatedAt` ベース等）を design doc に明示し、022 実装後の置き換えを
  follow-up として記録する
- レビュアーが後続実装 PR で最も精査すべき点: 遷移 action の権限マトリクス
  （顧客が APPROVED を自分で付けられない等）と、`$transaction` 内での
  OrderItem 反映・通知発火の原子性
