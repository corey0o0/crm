-- 매개변수와 컬럼명 충돌 방지를 위해 반환 컬럼명 수정
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_warehouse_id TEXT,
  p_product_id INTEGER,
  p_quantity_change INTEGER
)
RETURNS TABLE (
  out_warehouse_id TEXT,
  out_product_id INTEGER,
  out_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.inventory (warehouse_id, product_id, quantity, created_at, updated_at)
  VALUES (p_warehouse_id, p_product_id, p_quantity_change, NOW(), NOW())
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET 
    quantity = public.inventory.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  RETURNING public.inventory.warehouse_id, public.inventory.product_id, public.inventory.quantity;
END;
$$;
