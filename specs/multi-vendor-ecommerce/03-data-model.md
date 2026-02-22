# Data Model

## Core Entities
- User: identity, role, and profile; owns stores, orders, cart, wishlist, and
  payment records.
- Store: owned by a user; contains products, shipping rates, coupons, and order
  groups; has status and default shipping settings.
- Product: belongs to a store, category, and subcategory; has variants, specs,
  reviews, and questions.
- ProductVariant: specific sellable variant; has sizes, colors, images, and
  specs.
- Size: price, quantity, and discount for a variant size.
- Cart and CartItem: per-user cart items with pricing and shipping snapshots.
- Order, OrderGroup, OrderItem: orders grouped per store with item-level status.
- ShippingAddress and Country: address data used for orders and shipping.
- Coupon: store coupon usable in carts and order groups.
- PaymentDetails: payment record tied to an order and user.
- Review and ReviewImage: customer reviews for products.
- Category, SubCategory, OfferTag: taxonomy and merchandising labels.
- ShippingRate, FreeShipping, FreeShippingCountry: shipping rules by country.

## Enumerations
- Role: USER, ADMIN, SELLER
- StoreStatus: PENDING, ACTIVE, BANNED, DISABLED
- ShippingFeeMethod: ITEM, WEIGHT, FIXED
- OrderStatus, PaymentStatus, PaymentMethod, ProductStatus

## Indexing and Uniqueness
- Unique: Store.url, Category.url, SubCategory.url, Product.slug,
  ProductVariant.slug, Coupon.code.
- GIN: Product fulltext search via `to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))` (replaces removed `@@fulltext([name, brand])`); ProductVariant(variantName, keywords) may use trigram index (pg_trgm) for ILIKE acceleration.
