CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id integer NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  order_date date NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  received boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_part_order_date UNIQUE (part_id, order_date)
);

CREATE INDEX idx_purchase_orders_part_id ON public.purchase_orders(part_id);
CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders(order_date);

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_purchase_orders_updated_at();

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert" ON public.purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update" ON public.purchase_orders FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to delete" ON public.purchase_orders FOR DELETE USING (auth.role() = 'authenticated');
