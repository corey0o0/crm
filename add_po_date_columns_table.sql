-- =============================================
-- 발주관리 날짜 열(po_date_columns) 테이블 생성
-- 기존에는 브라우저 localStorage에만 저장돼서 다른 PC/브라우저에서는
-- 추가한 날짜 열이 안 보이는 문제가 있었음 → DB로 이전
-- Supabase SQL Editor에서 실행하세요
-- =============================================

CREATE TABLE IF NOT EXISTS public.po_date_columns (
  order_date date PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.po_date_columns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    CREATE POLICY "Allow public read access" ON public.po_date_columns FOR SELECT USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Allow authenticated users to insert" ON public.po_date_columns FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    CREATE POLICY "Allow authenticated users to delete" ON public.po_date_columns FOR DELETE USING (auth.role() = 'authenticated');
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 기존에 발주 데이터는 있는데 날짜 열 레코드가 없는 날짜들 백필
INSERT INTO public.po_date_columns (order_date)
SELECT DISTINCT order_date FROM public.purchase_orders
ON CONFLICT (order_date) DO NOTHING;
