-- 저장 시 400 에러 원인: purchase_orders.order_date가 아직 NOT NULL인데
-- 앱은 이제 column_id로만 upsert함 (order_date 안 보냄) -> NOT NULL 위반.
-- column_id가 진짜 식별자(po_date_columns FK)라 order_date는 더 이상 필요 없음 -> nullable로 변경.
ALTER TABLE purchase_orders ALTER COLUMN order_date DROP NOT NULL;
