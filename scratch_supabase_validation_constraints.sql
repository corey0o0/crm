-- Supabase Data Integrity Check Constraints
-- 이 스크립트를 Supabase SQL Editor에서 실행하여 서버(DB) 레벨의 검증을 강제하세요.

-- 1. shipment_parts 테이블의 quantity는 1 이상이어야 합니다.
ALTER TABLE shipment_parts 
ADD CONSTRAINT shipment_parts_quantity_check 
CHECK (quantity > 0);

-- 2. shipment_parts 테이블의 price는 0 이상이어야 합니다.
ALTER TABLE shipment_parts 
ADD CONSTRAINT shipment_parts_price_check 
CHECK (price >= 0);

-- 3. shipments 테이블의 quantity는 0 이상이어야 합니다. (간혹 빈 출고가 있을 수 있으므로 0 허용)
ALTER TABLE shipments 
ADD CONSTRAINT shipments_quantity_check 
CHECK (quantity >= 0);

-- 4. shipments 테이블의 price는 0 이상이어야 합니다.
ALTER TABLE shipments 
ADD CONSTRAINT shipments_price_check 
CHECK (price >= 0);

-- (선택) 서비스(A/S) 부품 테이블에도 동일한 제약을 추가하려면 아래 주석을 해제하고 실행하세요.
-- ALTER TABLE service_parts ADD CONSTRAINT service_parts_quantity_check CHECK (quantity > 0);
-- ALTER TABLE service_parts ADD CONSTRAINT service_parts_price_check CHECK (price >= 0);
