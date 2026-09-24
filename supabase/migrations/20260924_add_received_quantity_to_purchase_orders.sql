ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS received_quantity integer NOT NULL DEFAULT 0;
