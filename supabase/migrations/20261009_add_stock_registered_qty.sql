-- 발주관리 입고수량 중 "입출고관리로 등록 완료된 수량"을 추적하기 위한 컬럼
-- 입고수량(received_quantity)을 수정해도 이미 등록된 만큼은 중복 반영되지 않도록 함
BEGIN;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS stock_registered_qty INTEGER NOT NULL DEFAULT 0;

COMMIT;
