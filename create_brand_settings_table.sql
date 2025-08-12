-- 브랜드 설정 테이블 생성
CREATE TABLE IF NOT EXISTS public.brand_settings (
    id SERIAL PRIMARY KEY,
    brand_code VARCHAR(10) NOT NULL UNIQUE,
    brand_name VARCHAR(50) NOT NULL,
    auto_inventory_deduction BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 기본 브랜드 데이터 삽입
INSERT INTO public.brand_settings (brand_code, brand_name, auto_inventory_deduction) 
VALUES 
    ('XRB', 'X-RIDER', false),
    ('NB', 'NEARBIKE', true)
ON CONFLICT (brand_code) DO NOTHING;

-- RLS 정책 설정
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 권한
CREATE POLICY "Allow read access for all users" ON public.brand_settings
    FOR SELECT 
    USING (TRUE);

-- 인증된 사용자만 쓰기 권한
CREATE POLICY "Allow insert for authenticated users only" ON public.brand_settings
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users only" ON public.brand_settings
    FOR UPDATE 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users only" ON public.brand_settings
    FOR DELETE 
    USING (auth.role() = 'authenticated');

-- 인덱스 생성
CREATE INDEX brand_settings_brand_code_idx ON public.brand_settings (brand_code);

-- 재고 변동 로그 테이블 생성
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id SERIAL PRIMARY KEY,
    part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    part_code TEXT,
    brand_code VARCHAR(10) NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'shipment_complete', 'service_complete', 'manual_adjust'
    quantity_change INTEGER NOT NULL, -- 양수: 입고, 음수: 출고
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reference_id UUID, -- shipment_id 또는 service_id
    reference_type VARCHAR(20), -- 'shipment' 또는 'service'
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
CREATE INDEX inventory_logs_part_id_idx ON public.inventory_logs (part_id);
CREATE INDEX inventory_logs_brand_code_idx ON public.inventory_logs (brand_code);
CREATE INDEX inventory_logs_reference_idx ON public.inventory_logs (reference_id, reference_type);
CREATE INDEX inventory_logs_created_at_idx ON public.inventory_logs (created_at);

COMMENT ON TABLE public.brand_settings IS '브랜드별 설정 정보 테이블';
COMMENT ON TABLE public.inventory_logs IS '재고 변동 로그 테이블';