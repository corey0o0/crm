-- shipment_parts 테이블 생성 스크립트
CREATE TABLE IF NOT EXISTS public.shipment_parts (
    id SERIAL PRIMARY KEY,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    part_code TEXT,
    quantity INTEGER DEFAULT 1,
    price NUMERIC(10, 2) DEFAULT 0,
    total_price NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS 정책 설정 (Row Level Security)
ALTER TABLE public.shipment_parts ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 권한 갖도록 설정
CREATE POLICY "Allow read access for all users" ON public.shipment_parts
    FOR SELECT 
    USING (TRUE);

-- 인증된 사용자만 쓰기 권한 갖도록 설정
CREATE POLICY "Allow insert for authenticated users only" ON public.shipment_parts
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users only" ON public.shipment_parts
    FOR UPDATE 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users only" ON public.shipment_parts
    FOR DELETE 
    USING (auth.role() = 'authenticated');

-- 인덱스 생성
CREATE INDEX shipment_parts_shipment_id_idx ON public.shipment_parts (shipment_id);
CREATE INDEX shipment_parts_part_code_idx ON public.shipment_parts (part_code);

COMMENT ON TABLE public.shipment_parts IS '출고 부품 상세 정보 테이블'; 