# Functional Requirements

## Customer
- Browse featured products, categories, and stores.
- Reach the collection from the landing page's three editorial chapters; browse live category links and a curated product selection, with usable links and imagery when animation or product data is unavailable.
- Pause the landing-page animation, and respect the device's reduced-motion setting.
- Search products by name, brand, and variant keywords.
- Refine the browse collection by category, offer, size, color, price, and search term; keep active conditions when sorting or paging, and allow removing individual conditions or clearing them all.
- Use the browse filters on narrow screens and reach product-card actions with touch or keyboard as well as pointer hover.
- View product details, variants, sizes, colors, images, and specs.
- On a product detail page, inspect gallery images and their enlarged view, see the selected size's price and stock, and review delivery, returns, seller, reviews, questions, and related products when available.
- Prevent purchase actions when no valid in-stock size is selected; show a clear selection or sold-out message.
- Add items to cart with quantity and size selection.
- Manage cart contents (update quantity, remove items).
- Checkout with shipping address selection and shipping fees.
- Pay with Stripe or PayPal.
- View order details and order status history.
- Manage profile, addresses, wishlist, and reviews.

## Seller
- Apply for seller role.
- Create and manage stores (profile, status, shipping defaults).
- Create and manage products, variants, sizes, colors, and images.
- Maintain inventory and pricing per variant size.
- Configure shipping rates per country.
- Manage store coupons.
- View and fulfill orders grouped by store.

## Admin
- Manage categories, subcategories, and offer tags.
- Review and manage store entries and status.

## Cross-Cutting
- Role-based access control and authentication.
- Validation of form inputs.
- Country-aware shipping configuration.
- Search with fulltext and fallback matching.
