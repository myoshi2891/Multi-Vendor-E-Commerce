# Multi-Vendor E-Commerce - Overview

## Purpose
Build a multi-vendor marketplace where customers browse and purchase products,
sellers manage their stores and inventory, and admins manage catalog taxonomy
and store status.

## In Scope
- Multi-role access (customer, seller, admin).
- Storefront browsing, search, product details, cart, checkout, orders.
- Seller store management, product and variant management, shipping rules.
- Admin category, subcategory, and offer tag management.
- Stripe and PayPal payments.
- PostgreSQL + Prisma persistence.
- Media uploads via Cloudinary.

## Out of Scope (Current Implementation)
- Multi-currency pricing.
- Tax calculation engine.
- Advanced analytics dashboards.
- Third-party shipping carrier integrations beyond configurable rates.

## Actors and Roles
- Customer (Role: USER)
- Seller (Role: SELLER)
- Admin (Role: ADMIN)

## System Summary
- Next.js 14 App Router with storefront and dashboard surfaces.
- Server actions in `src/queries` encapsulate domain operations.
- Prisma ORM with a PostgreSQL database.
- Clerk authentication with webhook sync to local users.
- Stripe and PayPal integrations for payment capture.
- Cart state managed by Zustand with localStorage persistence.
