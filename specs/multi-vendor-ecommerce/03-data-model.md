# Data Model

## Core Entities
- User: identity, role, and profile; owns stores, orders, cart, wishlist, and
  payment records.
- Store: owned by a user; contains products, shipping rates, coupons, and order
  groups; has status and default shipping settings (`Decimal(12,2)` for default
  shipping fee fields).
- Product: belongs to a store, category, and subcategory; has variants, specs,
  reviews, and questions.
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
- Coupon: store coupon usable in carts and order groups.
- PaymentDetails: payment record tied to an order and user
  (`Decimal(12,2)` for amount).
- Review and ReviewImage: customer reviews for products.
- Category, SubCategory, OfferTag: taxonomy and merchandising labels.
- ShippingRate, FreeShipping, FreeShippingCountry: shipping rules by country
  (`Decimal(12,2)` for fee fields).

## Enumerations
- Role: USER, ADMIN, SELLER
- StoreStatus: PENDING, ACTIVE, BANNED, DISABLED
- ShippingFeeMethod: ITEM, WEIGHT, FIXED
- OrderStatus, PaymentStatus, PaymentMethod, ProductStatus

## Money Field Convention
- All monetary amounts use `Decimal(12,2)` (Prisma `@db.Decimal(12,2)`) for
  exact precision. Application code uses `Prisma.Decimal` arithmetic
  (`.add()`, `.mul()`, `.sub()`, `.toNumber()`) instead of JavaScript floating
  point.

## Indexing and Uniqueness
- Unique: Store.url, Category.url, SubCategory.url, Product.slug,
  ProductVariant.slug, Coupon.code.
- Composite unique: ShippingRate(storeId, countryId),
  Review(userId, productId).
- GIN: Product fulltext search via `to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))` (replaces removed `@@fulltext([name, brand])`); ProductVariant(variantName, keywords) may use trigram index (pg_trgm) for ILIKE acceleration.

## ER 図 (Diagram)

- 図ファイル: [`docs/architecture/data-model.drawio`](../../docs/architecture/data-model.drawio)
  （draw.io / diagrams.net / VS Code "Draw.io Integration" 拡張で開ける）。
- **この図は自動生成物**。SSOT は [`prisma/schema.prisma`](../../prisma/schema.prisma) であり、
  手書き編集してはならない。`scripts/erd/generate-erd.ts` がスキーマをパースして生成する。
- **再生成**: スキーマ変更後は必ず `bun run erd:generate` を実行し、生成された
  `data-model.drawio` を同一 PR でコミットすること（同期義務は
  [`.claude/rules/03-data-model-diagram-sync.md`](../../.claude/rules/03-data-model-diagram-sync.md) を参照）。
- 図の凡例: 🔑 主キー / ◆ 外部キー / `U` unique / ⊕ 複合ユニーク、
  ER 記法エッジ（1 / N / 0..1）、<span style="color:#C62828">赤線 ⛓</span> = `ON DELETE CASCADE`、
  エンティティの塗り色・枠色 = 機能ドメイン（タイトルの色と対応）、破線枠 = enum ボックス。
