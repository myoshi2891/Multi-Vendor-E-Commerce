# Functional Requirements

## Customer
- Browse featured products, categories, and stores.
- Reach the collection from the landing page's three editorial chapters; browse live category links and a curated product selection, with usable links and imagery when animation or product data is unavailable.
- Pause the landing-page animation, and respect the device's reduced-motion setting.
- Search products by name, brand, and variant keywords.
- Refine the browse collection by category, offer, size, color, price, and search term; keep active conditions when sorting or paging, and allow removing individual conditions or clearing them all.
- Use the browse filters on narrow screens and reach product-card actions with touch or keyboard as well as pointer hover.
- Compare up to four persisted product variants side by side, remove individual selections or clear them, and reach the collection from empty or unavailable states. Show accessible loading and failure feedback with retry while preserving the selection.
- View product details, variants, sizes, colors, images, and specs.
- On a product detail page, inspect gallery images and their enlarged view, see the selected size's price and stock, and review delivery, returns, seller, reviews, questions, and related products when available.
- Prevent purchase actions when no valid in-stock size is selected; show a clear selection or sold-out message.
- Add items to cart with quantity and size selection.
- Manage cart contents (update quantity, remove items).
- Checkout with shipping address selection and shipping fees.
- Pay with Stripe or PayPal.
- View order details and order status history.
- Manage profile, addresses, wishlist, and reviews.
- Browse saved wishlist pieces in the branded responsive account layout with existing product-card actions and URL-based pagination; reach the collection from empty results and see readable loading or lookup-failure feedback with reload.
- Reach account sections from responsive branded navigation with an accessible current-page indication; use profile shortcuts and existing order filters, see readable account-lookup failure feedback, and reach order support. Show unimplemented coupon/credit shortcuts as unavailable rather than broken links.

- Read the public FAQs with all existing answers visible, navigate to individual questions by keyboard-accessible anchors, and reach contact, tracking, returns, and customer service from the branded responsive page. Keep the permanent `/faq` to `/faqs` redirect.

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
