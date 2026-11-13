-- 상품(parts) 금액(USD) 필드 추가. 발주관리/상품관리 화면에서 사용.
ALTER TABLE parts ADD COLUMN IF NOT EXISTS price_usd numeric;
