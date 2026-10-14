-- 발주관리: 날짜컬럼 완전삭제 + 같은 날짜 여러 메모 허용을 위한 구조 변경
-- A) po_date_columns UPDATE 정책 누락 보완 (라벨 저장 안되던 버그)
-- B) po_date_columns PK를 order_date -> id(uuid) 로 교체 (created_at은 이미 있어서 건너뜀)
-- C) purchase_orders에 column_id 추가, order_date 매칭으로 백필, FK(CASCADE)+유니크 교체
-- D) stock_registered_qty > 0 인 행이 있으면 컬럼 삭제 자체를 막는 트리거 (방어선, 1차 차단은 앱에서)

BEGIN;

-- A) UPDATE 정책
DROP POLICY IF EXISTS "Allow authenticated users to update" ON po_date_columns;
CREATE POLICY "Allow authenticated users to update" ON po_date_columns
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- B) id 컬럼 추가 + PK 교체
ALTER TABLE po_date_columns ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE po_date_columns DROP CONSTRAINT po_date_columns_pkey;
ALTER TABLE po_date_columns ADD CONSTRAINT po_date_columns_pkey PRIMARY KEY (id);
ALTER TABLE po_date_columns ALTER COLUMN order_date SET NOT NULL;

-- C) purchase_orders.column_id 추가 + 백필 + 제약 교체
ALTER TABLE purchase_orders ADD COLUMN column_id uuid;

-- 예전에 날짜컬럼은 지웠지만 purchase_orders 데이터는 안 지워져서 남아있던 고아 날짜들
-- -> 백필 매칭 안 되면 column_id NULL 나니까, 먼저 해당 날짜 컬럼을 복원해줌
INSERT INTO po_date_columns (order_date)
SELECT DISTINCT po.order_date
FROM purchase_orders po
WHERE NOT EXISTS (
  SELECT 1 FROM po_date_columns pdc WHERE pdc.order_date = po.order_date
);

UPDATE purchase_orders po
SET column_id = pdc.id
FROM po_date_columns pdc
WHERE po.order_date = pdc.order_date;

ALTER TABLE purchase_orders ALTER COLUMN column_id SET NOT NULL;
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_column_id_fkey
  FOREIGN KEY (column_id) REFERENCES po_date_columns(id) ON DELETE CASCADE;

ALTER TABLE purchase_orders DROP CONSTRAINT unique_part_order_date;
ALTER TABLE purchase_orders
  ADD CONSTRAINT unique_part_column UNIQUE (part_id, column_id);

-- D) 입출고 등록된 컬럼 삭제 차단 트리거 (방어선)
CREATE OR REPLACE FUNCTION prevent_delete_registered_date_column() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE column_id = OLD.id AND stock_registered_qty > 0
  ) THEN
    RAISE EXCEPTION '입출고 등록된 날짜는 삭제할 수 없습니다.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_registered_date_column ON po_date_columns;
CREATE TRIGGER trg_prevent_delete_registered_date_column
BEFORE DELETE ON po_date_columns
FOR EACH ROW EXECUTE FUNCTION prevent_delete_registered_date_column();

COMMIT;
