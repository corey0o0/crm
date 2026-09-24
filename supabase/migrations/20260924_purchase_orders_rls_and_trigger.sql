-- 20260924_create_purchase_orders.sql 적용 시 트리거/RLS 누락 → 보강
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_purchase_orders_updated_at();

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow authenticated users to update" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow authenticated users to delete" ON public.purchase_orders;

CREATE POLICY "Allow public read access" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert" ON public.purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update" ON public.purchase_orders FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to delete" ON public.purchase_orders FOR DELETE USING (auth.role() = 'authenticated');
