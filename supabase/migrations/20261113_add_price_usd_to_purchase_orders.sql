-- 발주/입고(날짜 열)별 금액(USD) 기록. 입고마다 금액이 다를 수 있어 parts.price_usd(최근 기준가)와 별도로 보존.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS price_usd numeric;
