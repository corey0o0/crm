-- ==========================================
-- 다중 창고 기반 재고 차감 및 출고 구조 개편 (DB 마이그레이션)
-- 환경: Supabase SQL Editor 에서 실행
-- ==========================================

-- 1. shipments 테이블에 warehouse_id 추가
--    온라인 주문이 파츠별로 창고가 다를 수 있으므로, 단일 출고(Shipment)는 한 창고만 담당하도록 분리
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS warehouse_id text;

-- 2. shipment_parts 테이블에 소속 창고 추가 (명시적)
ALTER TABLE public.shipments_parts 
ADD COLUMN IF NOT EXISTS warehouse_id text;

-- (주의) 만약 shipments_parts 테이블 이름이 shipment_parts 라면 아래 코드를 사용:
ALTER TABLE public.shipment_parts 
ADD COLUMN IF NOT EXISTS warehouse_id text;

-- 3. inventory 테이블 점검 및 보완
--    창고(warehouse_id) + 품목(product_id) 별로 수량을 관리
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    warehouse_id text NOT NULL,
    product_id bigint REFERENCES public.parts(id) ON DELETE CASCADE,
    quantity integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (warehouse_id, product_id)
);

-- 재고 RLS 활성화 및 권한
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access to inventory" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. inventory_logs (장부) 테이블에 warehouse_id 추가
ALTER TABLE public.inventory_logs
ADD COLUMN IF NOT EXISTS warehouse_id text;

-- 5. parts 테이블의 기존 stock을 사용 중단하지만 기존 컬럼은 유지
-- (나중에 마이그레이션 앱이나 수동 처리에 사용: 재고 초기화 예정)
-- ALTER TABLE public.parts DROP COLUMN stock; -- (당장 지우지 않고 UI에서 안 보이게 숨김 처리)
