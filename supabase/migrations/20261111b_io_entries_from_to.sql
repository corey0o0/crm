-- 입출고 등록 그리드 재설계: 단일 창고 입고/출고 누적 방식 -> 보낸곳(FROM)/받는곳(TO) 방향 고정 방식
-- 날짜 컬럼 하나 = 하나의 이동(FROM -> TO). 같은 날짜라도 이동이 다르면 컬럼을 추가로 만든다
-- (예: "11/11 수입->형동", "11/11-2 형동->청담"). 아직 실제 등록 데이터 없어 테이블을 새로 만든다.

DROP FUNCTION IF EXISTS public.register_io_entry_stock(integer, uuid, text, integer, integer, text, text, text, date, text);
DROP TABLE IF EXISTS public.io_entries;
DROP TABLE IF EXISTS public.io_date_columns;

CREATE TABLE public.io_date_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL,
  label text,
  from_location text NOT NULL, -- warehouses.id 또는 '외부'
  to_location text NOT NULL,   -- warehouses.id 또는 '외부'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.io_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id integer NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.io_date_columns(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 0,
  registered_qty integer NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (part_id, column_id)
);

CREATE INDEX idx_io_entries_column_id ON public.io_entries(column_id);
CREATE INDEX idx_io_entries_part_id ON public.io_entries(part_id);

CREATE OR REPLACE FUNCTION update_io_entries_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_io_entries_updated_at ON public.io_entries;
CREATE TRIGGER trg_update_io_entries_updated_at
  BEFORE UPDATE ON public.io_entries
  FOR EACH ROW EXECUTE FUNCTION update_io_entries_updated_at();

-- 등록(재고 반영) 이후엔 날짜 컬럼 삭제 금지 (발주관리와 동일한 보호 규칙)
CREATE OR REPLACE FUNCTION prevent_delete_registered_io_date_column() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.io_entries WHERE column_id = OLD.id AND registered_qty > 0
  ) THEN
    RAISE EXCEPTION '이미 등록(재고 반영)된 이동은 삭제할 수 없습니다.';
  END IF;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_registered_io_date_column ON public.io_date_columns;
CREATE TRIGGER trg_prevent_delete_registered_io_date_column
  BEFORE DELETE ON public.io_date_columns
  FOR EACH ROW EXECUTE FUNCTION prevent_delete_registered_io_date_column();

ALTER TABLE public.io_date_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.io_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON public.io_date_columns
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON public.io_entries
  FOR ALL USING (auth.role() = 'authenticated');

-- 해당 컬럼(FROM->TO)의 목표 수량을 실제 재고에 원자적으로 반영.
-- FROM/TO가 실제 창고면 그 창고 재고를 차감/증가시키고, '외부'면 그쪽은 재고 변경 없이 기록만 남김.
CREATE OR REPLACE FUNCTION public.register_io_entry_stock(
  p_part_id integer,
  p_column_id uuid,
  p_qty integer,     -- 목표 누적 이동 수량
  p_part_name text,
  p_part_code text,
  p_brand_code text,
  p_common_memo text
)
RETURNS TABLE (delta_qty integer, from_location text, to_location text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered integer;
  v_delta integer;
  v_from text;
  v_to text;
  v_order_date date;
  v_from_prev integer;
  v_from_new integer;
  v_to_prev integer;
  v_to_new integer;
BEGIN
  SELECT c.from_location, c.to_location, c.order_date
  INTO v_from, v_to, v_order_date
  FROM public.io_date_columns c
  WHERE c.id = p_column_id;

  IF v_from IS NULL THEN
    RAISE EXCEPTION '해당 날짜 컬럼을 찾을 수 없습니다 (column_id=%)', p_column_id;
  END IF;

  SELECT registered_qty INTO v_registered
  FROM public.io_entries
  WHERE part_id = p_part_id AND column_id = p_column_id
  FOR UPDATE;

  IF v_registered IS NULL THEN
    RAISE EXCEPTION '해당 입출고 행을 찾을 수 없습니다 (part_id=%, column_id=%)', p_part_id, p_column_id;
  END IF;

  v_delta := GREATEST(p_qty - v_registered, 0);

  IF v_delta = 0 THEN
    RETURN QUERY SELECT 0, v_from, v_to;
    RETURN;
  END IF;

  IF v_from <> '외부' THEN
    INSERT INTO public.inventory (warehouse_id, product_id, quantity, created_at, updated_at)
    VALUES (v_from, p_part_id, -v_delta, NOW(), NOW())
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = public.inventory.quantity - v_delta, updated_at = NOW()
    RETURNING public.inventory.quantity INTO v_from_new;
    v_from_prev := v_from_new + v_delta;

    INSERT INTO public.inventory_logs (
      part_id, part_name, part_code, warehouse_id, brand_code,
      change_type, quantity_change, previous_quantity, new_quantity,
      reference_type, notes
    ) VALUES (
      p_part_id, p_part_name, p_part_code, v_from, p_brand_code,
      'io_out', -v_delta, v_from_prev, v_from_new,
      'io_entry',
      p_common_memo || ' (일자: ' || coalesce(v_order_date::text, '') || ', ' || v_from || '->' || v_to || ') [' || v_from_prev || ' -> ' || v_from_new || ']'
    );
  END IF;

  IF v_to <> '외부' THEN
    INSERT INTO public.inventory (warehouse_id, product_id, quantity, created_at, updated_at)
    VALUES (v_to, p_part_id, v_delta, NOW(), NOW())
    ON CONFLICT (warehouse_id, product_id)
    DO UPDATE SET quantity = public.inventory.quantity + v_delta, updated_at = NOW()
    RETURNING public.inventory.quantity INTO v_to_new;
    v_to_prev := v_to_new - v_delta;

    INSERT INTO public.inventory_logs (
      part_id, part_name, part_code, warehouse_id, brand_code,
      change_type, quantity_change, previous_quantity, new_quantity,
      reference_type, notes
    ) VALUES (
      p_part_id, p_part_name, p_part_code, v_to, p_brand_code,
      'io_in', v_delta, v_to_prev, v_to_new,
      'io_entry',
      p_common_memo || ' (일자: ' || coalesce(v_order_date::text, '') || ', ' || v_from || '->' || v_to || ') [' || v_to_prev || ' -> ' || v_to_new || ']'
    );
  END IF;

  INSERT INTO public.transactions (
    type, product_id, product_name, product_code, product_supplier,
    quantity, from_location, to_location, date, note, is_grouped
  ) VALUES (
    CASE WHEN v_from = '외부' THEN 'in' ELSE 'out' END,
    p_part_id, p_part_name, p_part_code, p_brand_code,
    v_delta, v_from, v_to, v_order_date, p_common_memo, true
  );

  UPDATE public.io_entries SET registered_qty = p_qty
  WHERE part_id = p_part_id AND column_id = p_column_id;

  RETURN QUERY SELECT v_delta, v_from, v_to;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_io_entry_stock(
  integer, uuid, integer, text, text, text, text
) TO authenticated;
