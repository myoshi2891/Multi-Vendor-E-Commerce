# Data Model

## Core Entities
- User: identity, role, and profile; owns stores, orders, cart, wishlist, and
  payment records.
- Store: owned by a user; contains products, shipping rates, coupons, order
  groups, and conversations; has status and default shipping settings
  (`Decimal(12,2)` for default shipping fee fields). `lowStockThreshold Int
  @default(5)` drives the inventory low-stock badge/summary (additive,
  non-destructive migration).
- Product: belongs to a store and to the category tree; has variants, specs,
  reviews, and questions. The category link is **phase-dependent**
  (ADR-006 / `docs/design/category-tree/design.md`):
  - **Phase A / B (current)**: three legacy-plus-new foreign keys run in
    parallel — `categoryId` points at the **root** node, `subCategoryId` at the
    **leaf** (both retained from the pre-tree `Category` / `SubCategory` pair),
    and `categoryNodeId` is the single new leaf reference that subtree filters
    read. All three are dual-written.
  - **Phase C (target, plan 068 — irreversible)**: `SubCategory` is dropped and
    `categoryNodeId` is renamed to `categoryId`, leaving Product with **one**
    reference to a single `Category` node at any depth. Root/leaf is then a
    property of that node's `path` / `childCount`, not of a separate column.
- ProductVariant: specific sellable variant; has sizes, colors, images, and
  specs.
- Size: price (`Decimal(12,2)`), quantity, and discount for a variant size.
- Cart and CartItem: per-user cart items with pricing and shipping snapshots
  (`Decimal(12,2)` for all money fields).
- Order, OrderGroup, OrderItem: orders grouped per store with item-level status
  (`Decimal(12,2)` for totals, subtotals, shipping fees, and prices).
  Deleting an Order cascades to its OrderGroups and OrderItems
  (`onDelete: Cascade` on OrderGroup→Order and OrderItem→OrderGroup).
- ShippingAddress and Country: address data used for orders and shipping.
  A partial unique index (`ShippingAddress("userId") WHERE "default"`) enforces
  "at most one default address per user" at the database level. Prisma's schema
  syntax cannot express a partial unique index, so it lives in a hand-written
  migration (`20260809064416_add_shipping_address_single_default_index`) rather
  than in `schema.prisma`; `prisma migrate dev` was verified not to propose
  dropping it. Rationale and the application-level counterpart are in
  [`06-quality.md`](06-quality.md) § Data Integrity.
- Coupon: store coupon usable in carts and order groups.
- PaymentDetails: payment record tied to an order and user
  (`Decimal(12,2)` for amount).
- Review and ReviewImage: customer reviews for products.
- Category, SubCategory, CategorySlugAlias, OfferTag: taxonomy and merchandising labels.
  Category is an N-level tree (plan 066 / ADR-006 Phase A): a self-relation `parentId`
  (`onDelete: Restrict`) plus a materialized `path` (e.g. `electronics/camera`, no trailing
  separator), `depth`, `sortOrder`, and a denormalised `childCount` used for leaf detection.
  Subtree queries are expressed as ``{ OR: [{ path: p }, { path: { startsWith: `${p}/` } }] }``;
  the trailing separator is what keeps `electronics/camera` from matching
  `electronics/camera-accessories`.
  CategorySlugAlias maps a retired slug to its current node. Its primary key is the composite
  `(entityType, oldSlug)` rather than `oldSlug` alone, because a Category and a SubCategory could
  legally share a slug before the merge — the very pair that needs an alias would otherwise
  collide on a single key.
  SubCategory still exists during Phase A/B and is dropped in Phase C (plan 068). Each
  depth-1 Category node and its legacy SubCategory row **share the same id**, which is why the
  `Product.categoryNodeId` backfill is a plain column copy.
- ShippingRate, FreeShipping, FreeShippingCountry: shipping rules by country
  (`Decimal(12,2)` for fee fields).
- Conversation and Message: buyer↔seller 1:1 messaging. A Conversation is unique
  per `(userId, storeId)` and optionally references an `orderId`
  (`onDelete: SetNull`); both `userId`/`storeId` references cascade-delete. Each
  Message belongs to a Conversation and a sender (`User`); the sender role is
  derived (`Message.senderId === Conversation.userId` ⇒ buyer-sent) rather than
  stored. `Message.isRead`/`readAt` drive unread clearing. No money fields.
- SupportTicket: public support-form submission (contact / return / dispute /
  problem-report) collapsed into one table by `category`. Optional `orderId` and
  `userId` references (both `onDelete: SetNull`; guest submissions leave `userId`
  null). `status String @default("OPEN")` (kept as `String` not enum until the
  operator-side admin UI defines the value set — see design.md 判断4). No money
  fields. Added via additive, non-destructive migration `add_support_ticket`.

## Enumerations
- Role: USER, ADMIN, SELLER
- StoreStatus: PENDING, ACTIVE, BANNED, DISABLED
- ShippingFeeMethod: ITEM, WEIGHT, FIXED
- OrderStatus, PaymentStatus, PaymentMethod, ProductStatus
- CouponScope: STORE, PLATFORM (Coupon.scope; default STORE)
- SupportTicketCategory: CONTACT, RETURN_REQUEST, DISPUTE, PROBLEM_REPORT

## Money Field Convention
- All monetary amounts use `Decimal(12,2)` (Prisma `@db.Decimal(12,2)`) for
  exact precision. Application code uses `Prisma.Decimal` arithmetic
  (`.add()`, `.mul()`, `.sub()`, `.toNumber()`) instead of JavaScript floating
  point.

## Indexing and Uniqueness
- Unique: Store.url, Category.url, SubCategory.url（**Phase A / B のみ** ——
  `SubCategory` は Phase C（[plan 068](../../plans/068-implement-category-tree-admin-cutover.md)）で
  drop されるため、その時点でこの項目も本リストから削除する）, Product.slug,
  ProductVariant.slug, Coupon.code. Category.url stays **globally** unique rather than
  unique-per-parent: `home.ts` and `size.ts` resolve slugs through relation filters
  (`where: { category: { url } }`), which compile fine without a uniqueness guarantee and would
  silently match a different node. Global uniqueness also keeps the existing query-shaped URLs
  working unchanged.
- Composite unique: ShippingRate(storeId, countryId),
  Review(userId, productId), Conversation(userId, storeId).
- GIN: Product fulltext search via `to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))` (replaces removed `@@fulltext([name, brand])`); ProductVariant(variantName, keywords) may use trigram index (pg_trgm) for ILIKE acceleration.

## ER 図 (Diagram)

- 図ファイル: [`docs/architecture/data-model.drawio`](../../docs/architecture/data-model.drawio)
  （draw.io / diagrams.net / VS Code "Draw.io Integration" 拡張で開ける）。
- **図の構成（10 ページ）**: `data-model.drawio` は機能ドメインごとに 10 タブに分割されている。
  クロスドメインエッジを同一ページ内に収めるため、関連モデルは複数ページに重複掲載される。

  | Page | タブ名 | 掲載エンティティ数 | 概要 |
  |------|--------|--------------------|------|
  | 1 | System Overview | 6 | 主要エンティティを名前のみで表示する全体鳥瞰図 |
  | 2 | Catalog | 11 | Product 中心の商品カタログドメイン（Category ツリー / CategorySlugAlias / Variant / Color / Size 等） |
  | 3 | Customer Activity | 4 | Review / ReviewImage / Wishlist の顧客行動ドメイン |
  | 4 | Cart | 5 | カート構造（ProductVariant は参照注記のみ、エッジなし） |
  | 5 | Order | 6 | 注文・決済フロー（Order / OrderGroup / OrderItem / PaymentDetails 等） |
  | 6 | Shipping | 6 | 配送ルール・住所（ShippingAddress を中心に ShippingRate / Country 等） |
  | 7 | Identity | 2 | User / Store の Identity ドメイン |
  | 8 | Messaging | 5 | 購入者↔販売者メッセージング（Conversation / Message / User / Store / Order） |
  | 9 | Support | 3 | サポート受付（SupportTicket / User / Order） |
  | 10 | Enums | 9 | 全 enum 定義の参照ページ（エッジなし） |

- **この図は 100% 自動生成物**。SSOT は **構造** については [`prisma/schema.prisma`](../../prisma/schema.prisma)、**配置・配線（レイアウト調整）** については [`scripts/erd/layout-overrides.json`](../../scripts/erd/layout-overrides.json) です。図ファイル自体を直接手編集してコミットしてはなりません（次回再生成で上書き消失するため）。
- **再生成・調整手順**:
  1. スキーマ変更後は、`bun run erd:generate` を実行してクリーン生成を行います。
  2. 線の重なりや突き抜け等のレイアウト調整が必要な場合は、draw.io で図を開き、ノードの移動やエッジのドラッグなどの手動調整を行います（このスクラッチ編集は一時的です）。
  3. 調整後、`bun run erd:extract` を実行して、調整結果を `layout-overrides.json` へ還流させます。
  4. 再び `bun run erd:generate` を実行し、サイドカーから綺麗なレイアウトが決定論的に再現されることを確認します。
  5. 詳細は [`.claude/skills/erd-diagram-adjust/SKILL.md`](../../.claude/skills/erd-diagram-adjust/SKILL.md) の手順を参照してください。
- **同期の義務**: スキーマまたはレイアウト調整（サイドカー）の変更と、再生成された `data-model.drawio` は同一 PR / 同一コミットに含める必要があります（同期義務は [`.claude/rules/03-data-model-diagram-sync.md`](../../.claude/rules/03-data-model-diagram-sync.md) を参照）。
- 図の凡例: 🔑 主キー / ◆ 外部キー / `U` unique / ⊕ 複合ユニーク、
  ER 記法エッジ（1 / N / 0..1）、<span style="color:#C62828">赤線 ⛓</span> = `ON DELETE CASCADE`、
  エンティティの塗り色・枠色 = 機能ドメイン（タイトルの色と対応）、破線枠 = enum ボックス。
