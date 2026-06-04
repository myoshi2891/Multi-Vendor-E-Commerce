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
- **図の構成（8 ページ）**: `data-model.drawio` は機能ドメインごとに 8 タブに分割されている。
  クロスドメインエッジを同一ページ内に収めるため、関連モデルは複数ページに重複掲載される。

  | Page | タブ名 | 掲載エンティティ数 | 概要 |
  |------|--------|--------------------|------|
  | 1 | System Overview | 6 | 主要エンティティを名前のみで表示する全体鳥瞰図 |
  | 2 | Catalog | 10 | Product 中心の商品カタログドメイン（Category / Variant / Color / Size 等） |
  | 3 | Customer Activity | 4 | Review / Question 等の顧客行動ドメイン |
  | 4 | Cart | 5 | カート構造（ProductVariant は参照注記のみ、エッジなし） |
  | 5 | Order | 6 | 注文・決済フロー（Order / OrderGroup / OrderItem / PaymentDetails 等） |
  | 6 | Shipping | 6 | 配送ルール・住所（ShippingAddress を中心に ShippingRate / Country 等） |
  | 7 | Identity | 2 | User / Store の Identity ドメイン |
  | 8 | Enums | 7 | 全 enum 定義の参照ページ（エッジなし） |

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
