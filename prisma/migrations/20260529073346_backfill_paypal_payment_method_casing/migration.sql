-- Data backfill (no schema change): canonicalize legacy PayPal casing.
--
-- capturePayPalPayment (src/queries/paypal.ts) previously wrote
-- PaymentDetails.paymentMethod = "Paypal", but getUserPayments
-- (src/queries/profile.ts) filters by { paymentMethod: "PayPal" }, so those
-- historical rows were invisible to the profile "paypal" filter. This repairs
-- them to the canonical "PayPal".
--
-- Scope: only "PaymentDetails"."paymentMethod" (a free String). "Order"."paymentMethod"
-- is the enum PaymentMethod { PayPal, Stripe } and could never hold "Paypal".
--
-- Properties: non-destructive (UPDATE only, no DROP/DELETE/TRUNCATE) and
-- idempotent (a second run matches 0 rows).
UPDATE "PaymentDetails"
SET "paymentMethod" = 'PayPal'
WHERE "paymentMethod" = 'Paypal';
