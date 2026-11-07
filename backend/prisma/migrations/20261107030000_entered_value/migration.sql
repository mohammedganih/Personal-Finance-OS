-- SIPs and mutual funds: the value as last entered, as of "priceUpdatedAt".
-- Null means no value was entered, so the holding is valued at what was paid in.
ALTER TABLE "investments" ADD COLUMN "enteredValue" DECIMAL(14,2);

-- One-off mutual funds: their units x NAV is the value entered.
-- SIPs start at what was paid in: their units and NAV were typed before later
-- instalments, so they wait for a fresh value.
UPDATE "investments"
SET "enteredValue" = ROUND("quantity" * "currentPrice", 2)
WHERE "assetType" = 'MUTUAL_FUND' AND "quantity" > 0 AND "currentPrice" > 0;
