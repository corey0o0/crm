-- 발주 입고 등록 4단계(재고조정 -> 로그 -> 거래내역 -> stock_registered_qty 갱신)가
-- 각각 별도 요청이라 중간에 하나 실패하면 재고는 올라갔는데 "등록됨" 표시가 안 남고,
-- 재시도 시 같은 수량이 또 올라가는 중복적재 위험이 있었음.
-- -> 4단계를 한 함수(=하나의 DB 트랜잭션)로 묶고, 실제 적용할 수량도 서버에서
--    stock_registered_qty를 행 잠금 걸고 다시 계산해서 중복 호출(중복클릭/동시요청)에도 안전하게 함.
CREATE OR REPLACE FUNCTION public.register_purchase_order_stock(
  p_part_id integer,
  p_column_id uuid,
  p_warehouse_id text,
  p_received_quantity integer, -- 목표 누적 입고수량 (ordersMap의 received_quantity)
  p_part_name text,
  p_part_code text,
  p_brand_code text,
  p_order_date date,
  p_common_memo text
)
RETURNS TABLE (delta_applied integer, previous_quantity integer, new_quantity integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_registered integer;
  v_delta integer;
  v_prev integer;
  v_new integer;
BEGIN
  -- 해당 발주 행 잠그고 현재까지 등록된 수량 확인 (동시 등록 경쟁 방지)
  SELECT stock_registered_qty INTO v_current_registered
  FROM public.purchase_orders
  WHERE part_id = p_part_id AND column_id = p_column_id
  FOR UPDATE;

  IF v_current_registered IS NULL THEN
    RAISE EXCEPTION '해당 발주 행을 찾을 수 없습니다 (part_id=%, column_id=%)', p_part_id, p_column_id;
  END IF;

  v_delta := p_received_quantity - v_current_registered;
  IF v_delta <= 0 THEN
    -- 이미 등록된 분량이거나 그 이상 요청 -> 아무것도 안 하고 그대로 반환 (중복호출 방어)
    RETURN QUERY SELECT 0, v_current_registered, v_current_registered;
    RETURN;
  END IF;

  INSERT INTO public.inventory (warehouse_id, product_id, quantity, created_at, updated_at)
  VALUES (p_warehouse_id, p_part_id, v_delta, NOW(), NOW())
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  RETURNING public.inventory.quantity INTO v_new;

  v_prev := v_new - v_delta;

  INSERT INTO public.inventory_logs (
    part_id, part_name, part_code, warehouse_id, brand_code,
    change_type, quantity_change, previous_quantity, new_quantity,
    reference_type, notes
  ) VALUES (
    p_part_id, p_part_name, p_part_code, p_warehouse_id, p_brand_code,
    'purchase_received', v_delta, v_prev, v_new,
    'purchase_order',
    p_common_memo || ' (주문일: ' || coalesce(p_order_date::text, '') || ') [' || v_prev || ' -> ' || v_new || ']'
  );

  INSERT INTO public.transactions (
    type, product_id, product_name, product_code, product_supplier,
    quantity, from_location, to_location, date, note, is_grouped, status
  ) VALUES (
    'in', p_part_id, p_part_name, p_part_code, p_brand_code,
    v_delta, '외부(발주입고)', p_warehouse_id, p_order_date,
    p_common_memo || ' [' || v_prev || ' -> ' || v_new || ']', true, '완료'
  );

  UPDATE public.purchase_orders
  SET stock_registered_qty = p_received_quantity
  WHERE part_id = p_part_id AND column_id = p_column_id;

  RETURN QUERY SELECT v_delta, v_prev, v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_purchase_order_stock(
  integer, uuid, text, integer, text, text, text, date, text
) TO authenticated;
