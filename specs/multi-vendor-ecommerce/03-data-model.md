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
