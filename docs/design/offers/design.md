# Offers — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実                                                                                                   | 出典（行番号）                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 0-1 | `getAllOfferTags(storeUrl?)` が `OfferTag`（`products` の id 含む）を**商品数降順**で返す。空なら `[]` | [`offer-tag.ts:82-135`](../../../src/queries/offer-tag.ts#L82-L135)                                      |
| 0-2 | `OfferTag` は `name` / `url`（`@unique`）/ `products` を持つ                                           | [`schema.prisma:244-253`](../../../prisma/schema.prisma#L244-L253)                                       |
| 0-3 | `getProducts` は `filters.offer`（OfferTag URL）で商品を絞り込む（`offerTagId` 一致）                  | [`product.ts:672-682`](../../../src/queries/product.ts#L601)（"Apply offer filter"）                     |
| 0-4 | `/browse` は searchParams の `offer` を受け取り `getProducts` に渡す                                   | [`browse/page.tsx:24,39`](<../../../src/app/(store)/browse/page.tsx#L24>)                                |
| 0-5 | user-menu の `extraLinks`「Discounts & Offers」=`""`（空文字）                                         | [`user-menu.tsx:197-200`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L197-L200) |
| 0-6 | `CouponScope` enum は `STORE` / `PLATFORM`。`Coupon` は `code`/`discount`/`isActive`/`scope` を持つ    | [`schema.prisma:663-690`](../../../prisma/schema.prisma#L663-L690)                                       |
| 0-7 | DB 依存ページは `export const dynamic = 'force-dynamic'` を import 直後に宣言する規約                  | [tech.md「DB 依存ページの動的レンダリング規約」](../../../.claude/steering/tech.md)                      |

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
src/app/(store)/offers/page.tsx               ← 新規（async server component・force-dynamic）
src/components/store/offers/offer-card.tsx    ← 新規（任意・オファーカード）

src/components/store/layout/header/user-menu/
  └─ user-menu.tsx                            ← 変更（Discounts & Offers 配線）
```

### 1.2 再利用元マトリクス

| 流用するもの         | 出典                                                                         | 用途                     |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| オファー取得         | `getAllOfferTags()`（`offer-tag.ts:82`）                                     | 一覧データ               |
| 商品フィルタ遷移     | `/browse?offer=<url>`（`browse/page.tsx` + `getProducts` の offer フィルタ） | 各タグの対象商品表示     |
| `force-dynamic` 宣言 | `tech.md` 規約（例: `dashboard/admin/categories/page.tsx`）                  | Prisma 依存ページ        |
| リンク回帰テスト型   | [`profile-settings/design.md` §2.2](../profile-settings/design.md)           | user-menu 配線の RTL     |
| カード意匠           | 既存 home/browse のカード部品                                                | `offer-card.tsx`（任意） |

### 1.3 認可方針

- 不要（公開）。`/offers` は middleware 保護対象外。

---

## 2. 機能詳細

### 2.1 ページ `offers/page.tsx`

実装正本は [OffersPage](<../../../src/app/(store)/offers/page.tsx>) と [DesignPage](../../../src/components/store/shared/design-page/design-page.tsx)。

- async Server Component / force-dynamic / metadataを維持。
- getAllOfferTagsをtry/catchし、成功はタグ順・商品数・browse URLをそのまま描画する。
- 共有DesignPageのdeep-green hero/serif h1/パンくずとcream本文、CSS Moduleの1〜3列カードを使用。カードはページ内Linkを維持し、商品グリッドは追加しない。
- 空は既存メッセージとcollectionリンク、失敗は汎用alertと`/offers`再読み込み。route loadingはstatusを通知。
- query戻り値から型を推論し、`any`やデータモデル変更を追加しない。

### 2.2 変更: `user-menu.tsx`（Discounts & Offers 配線）

[`user-menu.tsx:197-200`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L197-L200) の `extraLinks`:

```diff
-   { title: "Discounts & Offers", link: "" },
+   { title: "Discounts & Offers", link: "/offers" },
```

> **衝突注意**: 同じ `extraLinks` 配列を [storefront-static-pages](../storefront-static-pages/)（Help Center/Legal）と [support-forms](../support-forms/)（Return&Refund/Dispute/Report）も触る。本 PR は **Discounts & Offers の 1 行のみ**変更する。

### 2.3（任意拡張）プラットフォームクーポン掲示

- `db.coupon.findMany({ where: { scope: "PLATFORM", isActive: true } })` で全体クーポンを取得し、コード・割引率を掲示するセクションを追加できる。
- ただしコード公開の可否は運営判断（無制限配布のリスク）。**MVP では実装しない**（requirements OF-5 任意 / 判断4）。

---

## 3. テスト設計

> RTL（jsdom）。`getAllOfferTags` を `jest.mock`。

| テスト | 対象              | アサート（AAA）                                                                             | 対応 AC |
| ------ | ----------------- | ------------------------------------------------------------------------------------------- | ------- |
| T-OF1  | `offers/page.tsx` | `getAllOfferTags` がタグを返す → 各 `tag.name` と `href="/browse?offer=<url>"` が描画される | AC-OF1  |
| T-OF2  | `offers/page.tsx` | `getAllOfferTags` が `[]` → 空状態メッセージが描画される                                    | AC-OF2  |
| T-OF3  | `user-menu.tsx`   | extraLinks「Discounts & Offers」→`/offers`（**回帰**: 旧 `""` を弾く）                      | AC-OF3  |

> async server component のテストは、`getAllOfferTags` を mock して `await OffersPage()` の戻り JSX を `render` する（既存 server component テストの流儀に倣う）。テスト数変動のため [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) を起動。

---

## 判断1. なぜ `getAllOfferTags` を再利用するか

- 既存クエリ（事実 0-1）がオファー一覧を商品数順で返す。新規 server action は不要（global CLAUDE.md「不要なファイル編集を回避」）。

## 判断2. なぜ商品表示を `/browse` に委譲するか

- `getProducts` は `filters.offer` で OfferTag 絞り込み済（事実 0-3）、`/browse` が既に offer フィルタ + ソート + ページングを実装（事実 0-4）。
- `/offers` で商品グリッドを再実装すると重複になる。landing → browse 誘導が DRY で実装最小。

## 判断3. 任意拡張（offers 内に商品プレビュー）

- 各オファーの先頭数件を `/offers` 内に出したい場合は、タグごとに `getProducts({ offer: tag.url }, "", 1, 4)` を呼び 4 件プレビューする。
- N+1 呼び出しになるため、タグ数が多い環境では避ける。MVP は landing のみ（スコープ外・requirements §4）。

## 判断4. なぜプラットフォームクーポンを MVP に含めないか

- `CouponScope.PLATFORM`（事実 0-6）を掲示するとコードが公開され、想定外の大量利用リスクがある。掲示可否は運営判断であり、本 MVP では扱わない（OF-5 を任意要件に留める）。

---

## 影響箇所マトリクス

| パス                                                         | 変更種別     | 理由                     | リスク                               |
| ------------------------------------------------------------ | ------------ | ------------------------ | ------------------------------------ |
| `src/app/(store)/offers/page.tsx`                            | 新規         | オファー landing 本体    | 低（独立追加）                       |
| `src/components/store/offers/offer-card.tsx`                 | 新規（任意） | カード意匠の切り出し     | 低                                   |
| `src/components/store/layout/header/user-menu/user-menu.tsx` | 変更（1行）  | Discounts & Offers 配線  | 低（回帰テスト保護・他行は触らない） |
| 統計 docs（QA_HANDOFF 他）                                   | 変更         | テスト数変動の spec-sync | 低（生成・同期）                     |

---

## リスク分析

| リスク                                         | 区分           | 緩和策                                  |
| ---------------------------------------------- | -------------- | --------------------------------------- |
| `force-dynamic` 宣言漏れで CI build が脆くなる | ビルド         | import 直後に宣言（AC-OF4・tech.md）    |
| user-menu を複数設計書が触り衝突               | 実装統合       | 本 PR は Discounts & Offers の 1 行のみ |
| 任意拡張の N+1 クエリ                          | パフォーマンス | MVP は landing のみ。プレビューは慎重に |
| プラットフォームクーポンの無制限利用           | ビジネス       | MVP で掲示しない（運営判断に委ねる）    |

---

## Verification（実装後の検証手順）

1. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-OF1〜T-OF3）/ `bun run build`（`force-dynamic` でビルドが安定すること）。
2. `bun run dev` → `/offers` を開きオファー一覧が出ること、各カードから `/browse?offer=<url>` に遷移し対象商品が出ること。
3. オファーが無い環境では空状態が出ること。
4. user-menu「Discounts & Offers」から `/offers` に到達できること。


## P2デザイン移行（2026-10-05）

DS-PAGE-016。共有opt-in DesignPageでパンくずとserif見出し、タグカード、空状態のcollection導線、取得失敗の汎用alertと再読み込み、route loadingを実装。タグ順・商品数・browse URLを維持。Red 2件→Green/Refactor 4/4、tsc 0、lint 0 errors/12既存warnings。実ブラウザー確認は最終検証で記録し、それまでは実装済み。コミット: `0195267c` / `1069ef25` / `5fea2f4a`。[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md)。


### 最終受け入れ確認（2026-10-05）

対象公開画面は検証済み。公開3画面と2つの未認証転送を実ルートChromium11/11で確認。1440/768/390px、focus/keyboard・横溢れ・axe AA contrast・画像目視。送信はmock応答、実ticket作成なし。Offers空/失敗はRTL、フォームカテゴリーpayload回帰2/2。全体Jest2766/2769（3 skipped）、tsc0、lint0 errors/12既存warnings。[最終証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)。
