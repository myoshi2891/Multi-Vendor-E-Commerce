# Workflows

## Customer Purchase Flow
1) Browse or search products.
2) Open product page and choose a variant and size.
3) Add to cart (Zustand + localStorage).
4) Proceed to checkout and select shipping address.
5) Create an order and select payment method.
6) Capture payment via Stripe or PayPal.
7) Order status and payment details are updated.
8) Customer views order history and order details.

## Seller Store and Catalog Flow
1) Apply for seller role and access the seller dashboard.
2) Create a store and configure default shipping settings.
3) Create products and variants with sizes, colors, and images.
4) Configure per-country shipping rates.
5) Receive orders grouped by store and fulfill items.

## Admin Catalog Flow
1) Manage categories, subcategories, and offer tags.
2) Review store listings and update store status.

## Auth and Role Sync
1) User signs up or updates profile in Clerk.
2) Clerk webhook upserts the user in the local database.
3) Clerk private metadata is updated with the role.

## Country Detection
1) Middleware checks for the `userCountry` cookie.
2) If missing, country is detected and written to cookies.
