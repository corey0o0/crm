-- 입출고 등록 그리드 (발주관리 구조를 단일 창고 입고/출고용으로 미러링)

CREATE TABLE IF NOT EXISTS public.io_date_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date date NOT NULL,
  label text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.io_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id integer NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.io_date_columns(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  in_qty integer NOT NULL DEFAULT 0,
  out_qty integer NOT NULL DEFAULT 0,
  in_registered_qty integer NOT NULL DEFAULT 0,
  out_registered_qty integer NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (warehouse_id, part_id, column_id)
);

CREATE INDEX IF NOT EXISTS idx_io_entries_column_id ON public.io_entries(column_id);
CREATE INDEX IF NOT EXISTS idx_io_entries_warehouse_id ON public.io_entries(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_io_entries_part_id ON public.io_entries(part_id);

CREATE OR REPLACE FUNCTION update_io_entries_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_io_entries_updated_at ON public.io_entries;
CREATE TRIGGER trg_update_io_entries_updated_at
  BEFORE UPDATE ON public.io_entries
  FOR EACH ROW EXECUTE FUNCTION update_io_entries_updated_at();

-- 입고/출고 등록(재고 반영) 이후엔 날짜 컬럼 삭제 금지 (발주관리와 동일한 보호 규칙)
CREATE OR REPLACE FUNCTION prevent_delete_registered_io_date_column() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.io_entries
    WHERE column_id = OLD.id
      AND (in_registered_qty > 0 OR out_registered_qty > 0)
  ) THEN
    RAISE EXCEPTION '이미 입출고 등록(재고 반영)된 날짜 컬럼은 삭제할 수 없습니다.';
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

-- 선택 창고의 입고/출고 목표수량을 실제 재고(inventory)에 원자적으로 반영.
-- register_purchase_order_stock과 동일한 패턴: 행 잠금 -> 델타 계산 -> 멱등 적용.
CREATE OR REPLACE FUNCTION public.register_io_entry_stock(
  p_part_id integer,
  p_column_id uuid,
  p_warehouse_id text,
  p_in_qty integer,    -- 목표 누적 입고수량
  p_out_qty integer,   -- 목표 누적 출고수량
  p_part_name text,
  p_part_code text,
  p_brand_code text,
  p_order_date date,
  p_common_memo text
)
RETURNS TABLE (delta_in integer, delta_out integer, previous_quantity integer, new_quantity integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_registered integer;
  v_out_registered integer;
  v_delta_in integer;
  v_delta_out integer;
  v_net_delta integer;
  v_prev integer;
  v_new integer;
BEGIN
  SELECT in_registered_qty, out_registered_qty
  INTO v_in_registered, v_out_registered
  FROM public.io_entries
  WHERE part_id = p_part_id AND column_id = p_column_id AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  IF v_in_registered IS NULL THEN
    RAISE EXCEPTION '해당 입출고 행을 찾을 수 없습니다 (part_id=%, column_id=%, warehouse_id=%)', p_part_id, p_column_id, p_warehouse_id;
  END IF;

  v_delta_in := GREATEST(p_in_qty - v_in_registered, 0);
  v_delta_out := GREATEST(p_out_qty - v_out_registered, 0);

  IF v_delta_in = 0 AND v_delta_out = 0 THEN
    SELECT quantity INTO v_prev FROM public.inventory
    WHERE warehouse_id = p_warehouse_id AND product_id = p_part_id;
    RETURN QUERY SELECT 0, 0, COALESCE(v_prev, 0), COALESCE(v_prev, 0);
    RETURN;
  END IF;

  v_net_delta := v_delta_in - v_delta_out;

  INSERT INTO public.inventory (warehouse_id, product_id, quantity, created_at, updated_at)
  VALUES (p_warehouse_id, p_part_id, v_net_delta, NOW(), NOW())
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  RETURNING public.inventory.quantity INTO v_new;

  v_prev := v_new - v_net_delta;

  IF v_delta_in > 0 THEN
    INSERT INTO public.inventory_logs (
      part_id, part_name, part_code, warehouse_id, brand_code,
      change_type, quantity_change, previous_quantity, new_quantity,
      reference_type, notes
    ) VALUES (
      p_part_id, p_part_name, p_part_code, p_warehouse_id, p_brand_code,
      'io_in', v_delta_in, v_prev, v_prev + v_delta_in,
      'io_entry',
      p_common_memo || ' (일자: ' || coalesce(p_order_date::text, '') || ') [' || v_prev || ' -> ' || (v_prev + v_delta_in) || ']'
    );

    INSERT INTO public.transactions (
      type, product_id, product_name, product_code, product_supplier,
      quantity, from_location, to_location, date, note, is_grouped
    ) VALUES (
      'in', p_part_id, p_part_name, p_part_code, p_brand_code,
      v_delta_in, '외부(입고등록)', p_warehouse_id, p_order_date,
      p_common_memo || ' [' || v_prev || ' -> ' || (v_prev + v_delta_in) || ']', true
    );
  END IF;

  IF v_delta_out > 0 THEN
    INSERT INTO public.inventory_logs (
      part_id, part_name, part_code, warehouse_id, brand_code,
      change_type, quantity_change, previous_quantity, new_quantity,
      reference_type, notes
    ) VALUES (
      p_part_id, p_part_name, p_part_code, p_warehouse_id, p_brand_code,
      'io_out', -v_delta_out, v_prev + v_delta_in, v_new,
      'io_entry',
      p_common_memo || ' (일자: ' || coalesce(p_order_date::text, '') || ') [' || (v_prev + v_delta_in) || ' -> ' || v_new || ']'
    );

    INSERT INTO public.transactions (
      type, product_id, product_name, product_code, product_supplier,
      quantity, from_location, to_location, date, note, is_grouped
    ) VALUES (
      'out', p_part_id, p_part_name, p_part_code, p_brand_code,
      v_delta_out, p_warehouse_id, '외부(출고등록)', p_order_date,
      p_common_memo || ' [' || (v_prev + v_delta_in) || ' -> ' || v_new || ']', true
    );
  END IF;

  UPDATE public.io_entries
  SET in_registered_qty = p_in_qty, out_registered_qty = p_out_qty
  WHERE part_id = p_part_id AND column_id = p_column_id AND warehouse_id = p_warehouse_id;

  RETURN QUERY SELECT v_delta_in, v_delta_out, v_prev, v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_io_entry_stock(
  integer, uuid, text, integer, integer, text, text, text, date, text
) TO authenticated;
