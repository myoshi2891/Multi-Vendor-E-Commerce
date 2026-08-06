-- Data-only migration（スキーマ変更なし）
--
-- Stripe webhook (src/app/api/webhooks/stripe/route.ts) は PaymentDetails.amount に
-- Stripe event の minor unit (cents) を保存していた。PaymentDetails.amount は
-- Decimal(12,2) のドル建てであり、同期パス (src/queries/stripe.ts) と PayPal 経路は
-- Order.total を保存する。混在すると集計・表示・返金額が 100 倍ずれる。
--
-- webhook 側を Order.total 保存に修正したため、既存行も同じ単位契約へ補正する。
-- 同期パス経由で書かれた行は既に amount = Order.total のため WHERE 条件で除外され no-op。
UPDATE "PaymentDetails" pd
SET "amount" = o."total",
    "updatedAt" = NOW()
FROM "Order" o
WHERE pd."orderId" = o."id"
  AND pd."paymentMethod" = 'Stripe'
  AND pd."amount" <> o."total";
