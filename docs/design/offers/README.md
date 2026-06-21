# Offers — 設計書

> ディスカウント・オファー一覧画面（`/offers`）。プラットフォーム全体のキャンペーン（OfferTag）を一覧し、各タグの対象商品へ誘導する。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「D. 静的ページ・補助画面・カスタマーサービス」（user-menu「Discounts & Offers」）優先度=低。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。データ取得・ページ・導線・影響箇所）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## 対象画面（1 画面）

| 画面               | ルート            | 現状リンク     | 優先度 |
| ------------------ | ----------------- | -------------- | ------ |
| Discounts & Offers | `/offers`（確定） | user-menu `""` | 低     |

---

## スコープ境界

|              | 含む                                                                 | 含まない（後続・別 PR）                            |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------- |
| **一覧**     | `OfferTag`（キャンペーン）の一覧表示（商品数順）                     | 期間指定キャンペーンの開始/終了管理                |
| **誘導**     | 各 OfferTag → 既存 `/browse?offer=<url>` への遷移                    | `/offers` 内での商品グリッド全表示（**任意拡張**） |
| **クーポン** | （任意）プラットフォーム全体クーポン（`CouponScope.PLATFORM`）の掲示 | クーポン適用ロジック（既存カートが担当）           |
| **導線**     | user-menu「Discounts & Offers」を `/offers` に配線                   | フッターへの追加                                   |

---

## 核心判断（詳細は design.md の判断章）

| 判断                         | 結論                                       | 理由                                                                                                                                                         |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| データ取得                   | **既存 `getAllOfferTags()` を再利用**      | [offer-tag.ts:82](../../../src/queries/offer-tag.ts#L82) が OfferTag を商品数順で返す。新規クエリ不要                                                        |
| 商品への誘導                 | **既存 `/browse?offer=<url>` を再利用**    | `getProducts` は `filters.offer`（OfferTag URL）で絞り込み済（[product.ts:672-681](../../../src/queries/product.ts#L601)）。browse が既に offer フィルタ対応 |
| `/offers` の役割             | **オファー landing（一覧 → browse 誘導）** | 商品全件描画を抱えず browse の既存フィルタに委譲（DRY・実装最小）                                                                                            |
| プラットフォームクーポン掲示 | **任意（MVP は OfferTag のみ）**           | `CouponScope.PLATFORM` の掲示は加点。コード公開の可否は運営判断（follow-up）                                                                                 |
| `force-dynamic`              | **必須**                                   | `src/queries/*` 経由で Prisma を読む（[tech.md「DB 依存ページの動的レンダリング規約」](../../../.claude/steering/tech.md)）                                  |

---

## 規模感

- **新規ファイル**: `/offers/page.tsx` 1（+ 任意でオファーカード部品 1）。
- **server action / migration**: なし（既存 `getAllOfferTags` を再利用）。
- **変更ファイル**: 1（`user-menu.tsx` の「Discounts & Offers」配線）。
- **テスト**: ページ描画（オファー一覧 + 各 browse リンク）+ user-menu リンク回帰。
- **フェーズ**: 単一フェーズ（破壊的変更なし）。

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- 流用元: [`src/queries/offer-tag.ts`](../../../src/queries/offer-tag.ts)（`getAllOfferTags`）/ [`src/app/(store)/browse/page.tsx`](<../../../src/app/(store)/browse/page.tsx>)（offer フィルタ）
- 雛形: [`docs/design/profile-settings/`](../profile-settings/)（リンク回帰テスト・単一フェーズ構成）
- 姉妹設計書: [`docs/design/support-forms/`](../support-forms/)（同じ user-menu `extraLinks` を触るため衝突注意）
