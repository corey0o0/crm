-- 재고 변동 로그 테이블 생성
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id SERIAL PRIMARY KEY,
    part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    part_code TEXT,
    brand_code VARCHAR(10) NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('shipment_complete', 'service_complete', 'manual_adjust')),
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(20) CHECK (reference_type IN ('shipment', 'service')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS 정책 설정
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all users" ON public.inventory_logs
    FOR SELECT 
    USING (TRUE);

CREATE POLICY "Allow insert for authenticated users only" ON public.inventory_logs
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS inventory_logs_part_id_idx ON public.inventory_logs (part_id);
CREATE INDEX IF NOT EXISTS inventory_logs_brand_code_idx ON public.inventory_logs (brand_code);
CREATE INDEX IF NOT EXISTS inventory_logs_reference_idx ON public.inventory_logs (reference_id, reference_type);
CREATE INDEX IF NOT EXISTS inventory_logs_created_at_idx ON public.inventory_logs (created_at);

COMMENT ON TABLE public.inventory_logs IS '재고 변동 로그 테이블';