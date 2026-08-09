# Plan 064: `upsertShippingAddress` の default 不変条件を修正する（TESTS-21 の remediation）

> **Executor instructions**: 本プランは **2026-08-09 に実行済み（DONE）**。以下は実行記録を
> 兼ねた設計文書である。再実行する必要はない。内容を変更する場合は「実行記録」の実測値と
> 突き合わせ、乖離があれば STOP 条件として扱うこと。
>
> **Drift check（本文を再利用する場合は最初に実行）**:
> ```bash
> git diff --stat cbd32067 -- src/queries/user.ts tests/integration/shipping-address-default.test.ts
> git status --porcelain -- src/queries/user.ts
> ```
> `cbd32067..HEAD` ではなく `cbd32067` を使い、作業ツリー・ステージ済みの変更も見えるようにする。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（migration を伴う）
- **Depends on**: plan 037（characterization。回帰検知器が先に必要だった）
- **Category**: correctness
- **Planned at**: commit `433ffd4c`, 2026-08-09
- **Executed at**: 2026-08-09 — **DONE**。詳細は下の「実行記録」。

## Why this matters

不変条件は **「1 ユーザーにつき `default: true` の `ShippingAddress` は最大 1 件」**。

checkout の配送先自動選択は
[`address.list.tsx:21`](../src/components/store/shared/shipping-addresses/address.list.tsx) の
`addresses.find((a) => a.default)` で**最初の 1 件**を採り、供給元の
`getUserShippingAddresses`（`src/queries/user.ts`）には `orderBy` が無い。したがって default が
2 件あると、**どちらが選ばれるかが物理行順に依存する非決定**になる —— ユーザーが意図しない
住所へ配送されうる（money / trust 隣接）。

## Current state（修正前）

`upsertShippingAddress` は他住所の default 解除を
`findUnique({ where: { id: address.id } })` が非 null であることに条件付けていた。
新規住所の id は UI が `v4()` で採番する
（[`address-details.tsx`](../src/components/store/shared/shipping-addresses/address-details.tsx)）ため
**常に null → 新規経路では解除が丸ごとスキップ**され、default が 2 件併存した。
解除の `updateMany` と `create` / `update` は `$transaction` 外の非原子 2 書き込みでもあった。

出典: [`plans/audit/findings-14-integration-coverage-r6.md`](audit/findings-14-integration-coverage-r6.md) の
TESTS-21。同 finding は remediation を「**単独の correctness プラン化**・plan 037 完了後・
期待値 2 → 1 の反転とセット」と規定し、2026-07-19 時点で「未起票」と明記していた。**本プランがその追跡先**。

## Scope

**In**: `src/queries/user.ts`（`upsertShippingAddress` のみ）/ `src/queries/user.test.ts` /
`tests/integration/shipping-address-default.test.ts` / 新規 migration / docs 同期 /
`plans/README.md` / findings-14。

**Out（意図的に触らない）**:

- **`requireUser()` への切替** — tech.md が禁じるのは*新規*のインライン展開で、これは既存。
  `requireUser` は `currentUser()` 例外を別メッセージで包み直すため、P2002 伝播の修正に
  メッセージ変更を混ぜない。
- **`getUserShippingAddresses` への `orderBy` 追加** — 不変条件が成立すれば `find` は決定的になり
  correctness 上は不要。既存 assertion を巻き込むため分離。
- **既存重複行の backfill** — Step 0 の実測で 0 件のため不要（下記）。

## Steps（実行済み）

### Step 0: 既存重複の調査（migration の前提条件）

部分 unique index は既存重複があると作成に失敗するため、適用前に読み取り専用で調査した。

```sql
SELECT "userId", count(*) FROM "ShippingAddress" WHERE "default" GROUP BY "userId" HAVING count(*) > 1;
```

**実測（2026-08-09・本番相当 Neon DB）**: `ShippingAddress` 総 **6 行** / `default: true` **5 行** /
**重複ユーザー 0 件** → index 作成可能。backfill 不要。

### Step 1: RED（unit）— `879e3d33`

`describe("upsertShippingAddress")` に `$transaction` パススルーを敷いた（従来この describe には
存在せず、ルート `beforeEach` の `jest.clearAllMocks()` が実装を消すため貼り直しが要る）。
テストは +3:

1. 新規経路でも解除が走る（旧 `findUnique` ゲートの不在を `not.toHaveBeenCalled()` で固定）
2. 解除と作成が `tx` 経由（`db` とは別オブジェクトを渡し、`mockDb.*` が呼ばれないことを立証）
3. P2002 が `code` を保ったまま伝播する

意図した Red を実測（3 failed / 4 passed）してから Green へ進んだ。

### Step 2: RED（integration）— `058c5437`

- シナリオ2 を反転（`countDefaults` 2 → **1**）。`TODO(characterization)` を回帰ガードの説明へ
  書き換え、新規行 `default=true` / 旧 default 行 `false` を個別に検証。
- **シナリオ5 を追加（原子性）**: 攻撃者にも default 住所を持たせ、被害者の id で `default: true` を
  送る。P2002 で reject された後、**攻撃者自身の default が残っている**ことを検証。

  > 既存シナリオ3 の `victim?.default === true` は `userId` スコープだけでも通るため、
  > **ロールバックを立証しているのはシナリオ5 だけ**である。

実測 Red: シナリオ2 / 5 が失敗、1 / 3 / 4 は緑。

### Step 3: GREEN（本体修正）— `cbd32067`

解除条件を `address.default` のみにし、所有権検証・解除・作成/更新を `db.$transaction` で束ねた。

**`$transaction` は装飾ではなく前提条件**: 解除を無条件化すると、他ユーザーの id を渡された
IDOR 経路で「create が P2002 で落ちる**前に**攻撃者自身の default が解除される」= 拒否されたのに
副作用が残る状態が生まれる。修正前の実装でも `findUnique` が id だけで引いていたため実際に発生しており、
シナリオ5 が赤くなることで実証された。

その他の判断:

- **`NOT: { id: address.id }`** を解除述語に追加 — 直後の `update` で true に戻す行を二度書きせず、
  同一行を二度ロックしない。`userId` スコープが将来失われても被害者行に触れない多重防御でもある。
- **トランザクションオプションは付けない** — 文は 3 本・外部 I/O 無しで既定 timeout 5s に収まる。
  `ORDER_TRANSACTION_OPTIONS`（20s）は住所行の `FOR UPDATE` を握る注文処理向けの値で、
  流用すると checkout を待たせる窓を無用に広げる。
- **分離レベルは既定（ReadCommitted）** — 同一ユーザーの「default にする」が同時到達しても、
  後続 tx の `updateMany` は先行 tx の行ロックで待たされ解放後に更新後の行を読み直すため lost update に
  ならない。`saveUserCart` が Serializable + P2034 リトライなのは金額の read-then-write だから。
- **内側 `try/catch` を削除** — `"Error making the default address."` への書き換えは原本を握り潰し、
  P2002 の伝播（シナリオ3 の前提）を壊す。この文言に依存するテストは無いことを grep で確認済み。

### Step 4: DB 制約（部分 unique index）— `433ffd4c`

`safe-migration` skill に従って実行（バックアップ確認・接続先確認・破壊的操作チェックを含む）。

```sql
CREATE UNIQUE INDEX "ShippingAddress_userId_single_default_key"
    ON "ShippingAddress" ("userId") WHERE "default";
```

- Prisma スキーマ構文は部分 unique index を表現できないため、
  `migrate dev --create-only` で空マイグレーションを作り SQL を手書きした
  （`20260809064416_add_shipping_address_single_default_index`）。
- **ドリフト確認済み**: index は `schema.prisma` に現れないが、追加後に
  `migrate dev --create-only --name drift_check` が生成した migration は**空**で、
  Prisma は DROP を提案しない（確認後スクラッチ migration は破棄）。
- 統合テスト DB は [`container.ts`](../tests/integration/setup/container.ts) が
  `prisma migrate deploy` を走らせるため index が入る。**シナリオ6** で
  「アプリを迂回した 2 件目の default が P2002 で拒否される」= index の存在そのものを回帰ガード化した。
- **plan 037 の申し送りとの関係**: 037 は「部分 index を選ぶならシナリオ2 は DB エラー期待に
  書き換わる」としていたが、それは **index だけに頼る場合**。本プランはアプリ層で先に解除するため、
  シナリオ2 は正常系（count 1）のままで正しい。

### Step 5: docs 同期 — `95abed00`

`spec-sync-after-test` skill を起動。SSOT `QA_HANDOFF.md` から `07-testing.md` /
`COVERAGE_REPORT.md` / `PROGRESS.md` へ伝播し、`bun run coverage:dashboard` を同一コミットで再生成。
併せて `06-quality.md` § Data Integrity に不変条件と原子性の理由を、`03-data-model.md` に
部分 unique index の所在（手書き migration）とドリフト確認結果を記録した。

### Step 6: プラン文書と台帳

本ファイルの作成、`plans/README.md` の 064 行追加と 037 行の更新、findings-14 の
「remediation 未起票」注記のクローズ。

## Test plan / 実測結果

| 対象 | コマンド | 結果 |
|---|---|---|
| unit | `bun run test -- src/queries/user.test.ts` | **73 passed**（`upsertShippingAddress` は 4 → **7**） |
| unit 全体 | `bun run test` | **1894 passed / 1897 total / 178 スイート** |
| integration（当該） | `bun run test:integration -- tests/integration/shipping-address-default.test.ts` | **6 passed**（4 → 6） |
| integration 全体 | `bun run test:integration` | **66 passed / 8 スイート** |
| 型 | `bunx tsc --noEmit` | **0 件** |
| lint | `bun run lint` | **0 errors / 15 warnings**（既存） |
| ドリフト | `bunx prisma migrate dev --create-only --name drift_check` | **空 migration**（DROP 提案なし） |

## Done criteria

Machine-checkable. ALL hold:

- [x] 新規住所を default 付きで作成しても `countDefaults(userId) === 1`
- [x] 他ユーザーの id を渡した書き込みが P2002 で reject され、**攻撃者自身の default も無傷**
- [x] アプリを迂回した 2 件目の default が DB の部分 unique index で拒否される
- [x] `TODO(characterization)` タグがリポジトリから消えている（`grep -r "TODO(characterization)" tests/`）
- [x] `prisma migrate dev` が部分 unique index の DROP を提案しない
- [x] 統計 5 ドキュメントが同期され、ダッシュボードが再生成されている
- [x] `plans/README.md` の 064 行と findings-14 の追跡注記が更新されている

## STOP conditions（実行時に監視したもの・すべて非該当）

- Step 0 の調査で重複ユーザーが 1 件以上 → **非該当**（0 件）
- `prisma migrate dev` が部分 unique index の DROP を提案する → **非該当**（空 migration）
- 統合シナリオ1 / 3 / 4 が赤くなる → **非該当**（全緑を維持）

## Maintenance notes

- **既存重複行は自動修復されない**。本 DB では 0 件だったので backfill は不要だったが、
  index 適用前の環境（復元されたバックアップ等）に対して migration を流す場合は
  Step 0 の調査を必ず先に行うこと。index 作成が失敗する。
- **default を外す操作で default 0 件になる**のは修正前からの挙動で、本プランは変えていない。
  checkout は自動選択せず、ユーザーが明示的に選ぶことになる。
- `placeOrder` は住所を id + 所有権で解決し `default` を読まないため影響しない。ただし
  `SELECT … FOR UPDATE` で住所行を握るため、同一行への住所更新は当該 tx の間ブロックする（既存同様）。
- 残る follow-up（本プラン外・未起票）: `upsertShippingAddress` の `requireUser()` 化と、
  `getUserShippingAddresses` の決定論的 `orderBy`。いずれも correctness ではなく整合性・可読性の改善。
