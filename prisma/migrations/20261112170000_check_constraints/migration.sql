-- Regras de integridade reforçadas no próprio banco (defesa em profundidade).
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_nonnegative" CHECK ("priceCents" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_consumption_positive" CHECK ("stockConsumptionMilli" IS NULL OR "stockConsumptionMilli" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_price_nonnegative" CHECK ("unitPriceCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_valid" CHECK (
  "subtotalCents" >= 0 AND "discountCents" >= 0 AND "deliveryFeeCents" >= 0 AND "totalCents" >= 0
  AND "discountCents" <= "subtotalCents"
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_singleton" CHECK ("id" = 1);
