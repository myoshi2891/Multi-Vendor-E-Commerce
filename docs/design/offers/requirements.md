# Offers — 要件（requirements.md）

> 記法: EARS 風（`When/While/The system shall`）。受け入れ基準は `AC-OF<n>`。
> 設計は [design.md](./design.md)、実装手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件

| ID       | 要件（EARS 風）                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **OF-1** | 任意の訪問者が `/offers` にアクセスしたとき、システムは現在のオファータグ（`OfferTag`）を商品数の多い順に一覧表示しなければならない。 |
| **OF-2** | システムは各オファータグに、対象商品を表示する `/browse?offer=<url>` への遷移リンクを付与しなければならない。                         |
| **OF-3** | When オファータグが 1 件も存在しないとき、システムは空状態（現在オファーが無い旨）を表示しなければならない。                          |
| **OF-4** | ユーザーメニューの「Discounts & Offers」リンクは `/offers` を指さなければならない（現状 `""`）。                                      |
| **OF-5** | （任意）While プラットフォーム全体クーポン（`scope=PLATFORM` かつ `isActive`）が存在するとき、システムはそれを掲示してもよい。        |

---

## 2. 受け入れ基準（AC）

| ID         | 受け入れ基準                                                                                               | 検証方法                         |
| ---------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **AC-OF1** | `/offers` が `getAllOfferTags()` を呼び、返ったタグ名と `/browse?offer=<url>` リンクを描画する。           | RTL（`getAllOfferTags` を mock） |
| **AC-OF2** | タグが空のとき空状態が表示される。                                                                         | RTL                              |
| **AC-OF3** | `user-menu.tsx` の `extraLinks`「Discounts & Offers」の `link` が `/offers`（旧 `""` でない）。            | RTL（回帰）                      |
| **AC-OF4** | `/offers/page.tsx` に `export const dynamic = 'force-dynamic'` が宣言されている（Prisma 依存ページ規約）。 | コードレビュー / 静的確認        |

---

## 3. 非機能要件（NFR）

| ID                              | 内容                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **NFR-OF1**（コード規約）       | `any` 禁止・`console.log` 禁止。ページは async server component。                                                                          |
| **NFR-OF2**（動的レンダリング） | `src/queries/*` 経由で Prisma を読むため `export const dynamic = 'force-dynamic'` を宣言（[tech.md](../../../.claude/steering/tech.md)）。 |
| **NFR-OF3**（DRY）              | 商品一覧は `/browse` の既存フィルタに委譲し、`/offers` で再実装しない。                                                                    |
| **NFR-OF4**（視覚整合）         | shadcn/ui + Tailwind、slate ベース。既存 home/browse のカード意匠に整合。                                                                  |
| **NFR-OF5**（TDD）              | [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) 遵守。                                               |

---

## 4. スコープ外

- キャンペーンの期間管理（開始/終了日・予約公開）。
- `/offers` 内での全商品グリッド描画（任意拡張・design §判断3）。
- クーポンコードの適用処理（既存カート/チェックアウトが担当）。
- 管理者によるオファー編集 UI（既存 admin offer-tag 管理が担当）。
