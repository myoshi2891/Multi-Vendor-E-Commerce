# Compare — 設計書

> 商品比較画面（`/compare`）。複数商品（バリアント）を横並びで比較するクライアント主体の画面。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「D. 静的ページ・補助画面・カスタマーサービス」優先度=低。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。Zustand ストア・データ取得・グリッド・影響箇所）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## 対象画面（1 画面）

| 画面                | ルート     | 現状リンク              | 優先度 |
| ------------------- | ---------- | ----------------------- | ------ |
| Compare（商品比較） | `/compare` | footer「Compare」配線済 | 低     |

---

## スコープ境界

|                    | 含む                                                                          | 含まない（後続・別 PR）                                                  |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **比較対象の保持** | localStorage 永続の Zustand ストア（比較リスト = バリアント ID 配列・上限 4） | サーバー側の比較リスト保存（ログイン同期）                               |
| **データ取得**     | 既存 `getProductsByIds` で比較対象の商品情報を取得                            | 専用の重い集計クエリ                                                     |
| **表示**           | 商品名・画像・最安サイズ価格・評価のグリッド比較                              | スペック（Spec）行ごとの詳細比較（**任意拡張**）                         |
| **追加導線**       | `/compare` ページが ID を読み比較を描画                                       | 商品カード/詳細への「Add to compare」ボタン設置（**最小 or follow-up**） |

---

## 核心判断（詳細は design.md の判断章）

| 判断         | 結論                                                                   | 理由                                                                                                                          |
| ------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 状態保持     | **Zustand + `persist`（localStorage）**                                | 既存 `useCartStore`（[useCartStore.ts:30-31](../../../src/cart-store/useCartStore.ts#L30)）と同型。サーバー不要・リロード耐性 |
| 比較キー     | **バリアント ID（`ProductVariant.id`）**                               | 価格・在庫・画像はバリアント単位（[structure.md データモデル](../../../.claude/steering/structure.md)）。カートと同じ粒度     |
| データ取得   | **既存 `getProductsByIds` を再利用**                                   | [product.ts:1511](../../../src/queries/product.ts#L1511) が `ids: string[]` → `ProductType[]` を返す。新規クエリ不要          |
| スペック比較 | **MVP は基本フィールド（名前/画像/価格/評価）。Spec 行比較は任意拡張** | `getProductsByIds` は現状 `Spec` を select しない。拡張時のみ include 追加                                                    |
| 上限         | **比較は最大 4 件**                                                    | 横並びグリッドの可読性。超過時は先頭を押し出すか追加拒否                                                                      |

---

## 規模感

- **新規ファイル**: Zustand ストア 1（`src/compare-store/useCompareStore.ts`）+ `/compare/page.tsx` + 比較グリッド client 部品 1。
- **server action / migration**: なし（既存 `getProductsByIds` を再利用）。
- **変更ファイル**: なし（footer は配線済）。「Add to compare」ボタンは最小 or follow-up。
- **テスト**: ストアのユニット（追加/重複/上限/削除/永続）+ コンポーネント（グリッド描画・空状態）。
- **フェーズ**: 2（ストア → UI）。

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- 流用元（状態）: [`src/cart-store/useCartStore.ts`](../../../src/cart-store/useCartStore.ts)（Zustand + persist + テスト同階層配置）
- 流用元（データ）: [`src/queries/product.ts`](../../../src/queries/product.ts)（`getProductsByIds`）
- テスト配置規約: [tech.md テスト要件](../../../.claude/steering/tech.md)（ストアのテストはソースと同階層 = `src/compare-store/useCompareStore.test.ts`）
