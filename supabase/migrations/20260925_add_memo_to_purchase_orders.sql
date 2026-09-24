ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS memo text;
