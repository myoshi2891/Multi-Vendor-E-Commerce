---
name: erd-diagram-adjust
description: >
  Regenerates the data-model ER diagram from prisma/schema.prisma and visually
  declutters edge routing (lines must not overlap entity boxes) without ever
  hand-editing the generated .drawio. Manual layout intent is captured in the
  layout-overrides side-car so it survives regeneration.
  Triggered by: "ERD調整", "ER図調整", "データモデル図", "data-model.drawio",
  "drawio調整", "図の線が重なる", "線がボックスを突き抜ける", "erd:generate後の調整",
  "ERD再生成", "モデル追加後の図更新", "adjust ERD diagram", "fix ER diagram routing",
  "regenerate data model diagram", "erd layout".
invocation: automatic
allowed-tools: [Read, Grep, Glob, Bash, Edit, Write]
---

# ERD Diagram Adjust スキル

## 目的

`prisma/schema.prisma`（**構造の SSOT**）からデータモデル ER 図 `docs/architecture/data-model.drawio`
を再生成し、**リレーション線がエンティティ・ボックスを突き抜けない**状態へ視覚調整するためのスキル。

調整意図は `scripts/erd/layout-overrides.json`（**レイアウトの SSOT**）に保存し、
生成器がこれを読み込んで再適用する。これにより「再生成のたびに手調整が消える」問題を排除する。

> **鉄則**: 生成物 `.drawio` を直接手編集してコミットしない。視覚調整は必ずサイドカー経由で行う
> （[`.claude/rules/03-data-model-diagram-sync.md`](../../rules/03-data-model-diagram-sync.md)）。

---

## 仕組み（2 ソース → 1 派生物）

```
prisma/schema.prisma ───────┐
                            ├─→ scripts/erd/generate-erd.ts ─→ docs/architecture/data-model.drawio
scripts/erd/layout-overrides.json ┘   ▲                              │（生成物・手編集禁止）
        （レイアウト SSOT）            │                              │ draw.io で視覚調整（スクラッチ）
                                       └── scripts/erd/extract-overrides.ts ◀┘ 調整結果を還流
```

| ファイル | 役割 | 編集してよいか |
|---------|------|---------------|
| `prisma/schema.prisma` | 構造の SSOT | スキーマ変更時のみ |
| `scripts/erd/layout-overrides.json` | 配置・配線の SSOT（手調整の保存先） | ✅ ここを編集（または `erd:extract` で生成） |
| `scripts/erd/generate-erd.ts` | 生成器 | 既定レイアウト/分類を変える時のみ |
| `scripts/erd/extract-overrides.ts` | 抽出ツール | 原則不要 |
| `docs/architecture/data-model.drawio` | 生成物 | ❌ 手編集してコミットしない |

---

## いつ起動するか

- スキーマ（モデル/リレーション/enum/`@@unique`/`onDelete`）を**追加・変更・削除**したとき
  （[`.claude/rules/03-data-model-diagram-sync.md`](../../rules/03-data-model-diagram-sync.md) の MUST）
- 既存図で線がボックスを突き抜けて視認性が落ちているのを直すとき

---

## 実行手順（この順番を厳守）

### Step 1｜クリーン再生成

```bash
bun run erd:generate
```

- サマリ `[ERD] models=.. enums=.. edges=..` を確認。
- 新モデルを追加した場合、**`[ERD] WARNING: 未分類モデル ...` が出ないこと**を確認する。
  出たら `scripts/erd/generate-erd.ts` の `DOMAINS` 配列に分類を追記してから再実行
  （[`.claude/rules/03-data-model-diagram-sync.md`](../../rules/03-data-model-diagram-sync.md)）。
- 既存のサイドカーがあれば `[ERD] layout-overrides applied: nodes=.. edges=..` も表示される。

### Step 2｜重なりを特定する

`docs/architecture/data-model.drawio` を draw.io / diagrams.net で開く。
- **content-heavy なため全体スナップショットは避ける**（トークン浪費）。問題箇所周辺だけを確認する
  （[`~/.claude/CLAUDE.md` トークン効率] 準拠）。
- 典型的な突き抜けパターン:
  - **同一列の飛び越え**（例: `Country → ShippingAddress` が ShippingRate/FreeShipping を貫く）
  - **長距離の横断**（例: `Store → ShippingRate` が複数ドメインを横切る）

### Step 3｜draw.io で視覚調整（スクラッチ）

- エッジをドラッグして**空いている縦ガター（ドメイン列間の空白帯）**へ折り点を作り、ボックスを避ける。
- 必要なら接続点（exit/entry ポート）を固定する。
- ノードを動かす場合は最小限に（動かすと自動レイアウトの前提が崩れるため）。
- **この `.drawio` 編集は一時的（スクラッチ）。このままコミットしない。**

> 💡 ガター座標の目安（既定レイアウト）: ドメイン列の右端と次列の左端の間（幅 `DOMAIN_GAP_X=240`）が
> 上下に空いている。ここを縦の通り道に使うと確実にボックスを避けられる。

### Step 4｜調整結果をサイドカーへ還流

```bash
bun run erd:extract                      # エッジ配線のみ抽出 → layout-overrides.json
# ノード位置も固定したい場合のみ:
bun run erd:extract -- --include-nodes
```

- `scripts/erd/layout-overrides.json` が更新される。
- 手書きで微調整してもよい（スキーマは下記「サイドカー仕様」）。

### Step 5｜決定論的に再現されることを検証

```bash
bun run erd:generate                     # サイドカーから .drawio を再構築
bun run erd:generate                     # 2 回目
git diff --stat docs/architecture/data-model.drawio   # → 空（2 回目で差分が出ないこと）
```

- `.drawio` を再度開き、**Step 2 で見つけた突き抜けが解消**していることを目視。
- 2 回目の再生成で差分ゼロ ＝ サイドカーから決定論的に同じ図が再現される、を確認。

### Step 6｜同一コミットでまとめる

[`.claude/rules/03-data-model-diagram-sync.md`](../../rules/03-data-model-diagram-sync.md) に従い、
以下を**同一コミット**に含める:

- `prisma/schema.prisma`（スキーマを変えた場合）
- `scripts/erd/generate-erd.ts`（`DOMAINS` 等を変えた場合）
- `scripts/erd/layout-overrides.json`（調整した場合）
- 再生成された `docs/architecture/data-model.drawio`

コミットメッセージ例:

```bash
docs(erd): reroute Country/Order edges via gutters and regenerate ER diagram
```

---

## サイドカー仕様（`scripts/erd/layout-overrides.json`）

純粋な JSON（**コメント不可**。生成器は厳格 `JSON.parse`）。

```jsonc
{
  "nodes": {
    "Order": { "x": 2310, "y": 120 }        // 任意: w/h も指定可
  },
  "edges": {
    // キー = "<親>-><子>:<FK カラム名>"（多重辺は FK 名で区別。M:N は "join table"）
    "Country->ShippingAddress:countryId": {
      "exitX": 1, "exitY": 0.5,             // 親側の接続ポート（0..1 相対）
      "entryX": 1, "entryY": 0.5,           // 子側の接続ポート
      "waypoints": [                         // 経由点（draw.io 絶対座標）
        { "x": 3150, "y": 180 },
        { "x": 3150, "y": 1197 }
      ]
    }
  }
}
```

- **エッジキー**: `${parent}->${child}:${label}`。`label` は FK カラム名（cascade の ⛓ は除く）。
  CASCADE 線でも ⛓ は付けない（例 `Order->PaymentDetails:orderId`）。
- **ポート**: `exitX/exitY`（親）, `entryX/entryY`（子）。ER 図は左右接続のため `*X` は基本 `0`(左) か `1`(右)。
- **waypoints**: 縦ガターを通す折れ点。同じガターを複数線が通る場合は **x をずらして並走**させる。
- スキーマから消えたモデル/リレーションの override は**無視される**（生成は壊れない）。

---

## NEVER（禁止事項）

- ❌ `docs/architecture/data-model.drawio` を**直接手編集してコミット**する（調整はサイドカー経由のみ）。
- ❌ サイドカーに**コメント**を書く（厳格 JSON のためパース失敗 → override 無効化）。
- ❌ スキーマを変えたのに**再生成せず**コミットする。
- ❌ 新モデル追加時に `DOMAINS` 未分類のまま（orphan WARNING を無視）放置する。

---

## トラブルシュート

| 症状 | 原因 / 対処 |
|------|------------|
| override が効かない | エッジキーの `label`（FK 名）不一致。生成 `.drawio` の該当 `<mxCell ... edge="1">` の `value` を確認 |
| `[ERD:loadOverrides] Failed to parse` | `layout-overrides.json` が不正 JSON。末尾カンマ/コメントを除去 |
| 線がまだ突き抜ける | 別ガターへ折り点を追加。`waypoints` の x を空白帯内に置く |
| 2 回目再生成で差分が出る | 非決定的な手編集が残存。Step 1 からやり直し、調整は必ず `erd:extract` 経由で |

---

## Related

- [`.claude/rules/03-data-model-diagram-sync.md`](../../rules/03-data-model-diagram-sync.md) — 図とスキーマの同期ルール（同一コミット義務）
- [`scripts/erd/generate-erd.ts`](../../../scripts/erd/generate-erd.ts) — 生成器（構造 SSOT の消費）
- [`scripts/erd/extract-overrides.ts`](../../../scripts/erd/extract-overrides.ts) — 調整還流ツール
- [`scripts/erd/layout-overrides.json`](../../../scripts/erd/layout-overrides.json) — レイアウト SSOT
- [`docs/architecture/README.md`](../../../docs/architecture/README.md) — アーキテクチャ図の説明
