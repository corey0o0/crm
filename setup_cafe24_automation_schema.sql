-- =============================================
-- 카페24 자동출고 및 매핑 테이블, 인벤토리 로그 제약조건 설정
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 0. 카페24 매출원장(주문) 테이블 생성 (없는 경우 생성)
CREATE TABLE IF NOT EXISTS public.cafe24_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  mall_id text NOT NULL,                   -- 해당 쇼핑몰 ID
  order_id text NOT NULL UNIQUE,           -- 카페24 주문번호
  
  order_date timestamptz,                  -- 결제/주문 일시
  total_amount numeric(12, 2) DEFAULT 0,   -- 총 결제/주문 금액
  
  -- 주문한 상품 목록 (배열 형태 JSONB)
  order_items jsonb DEFAULT '[]'::jsonb,
  
  status text,                             -- 주문 상태 (결제완료, 배송완료 등)
  buyer_name text,                         -- 구매자 이름 (선택사항)
  buyer_phone text,                        -- 구매자 연락처 (선택사항)
  
  synced_at timestamptz DEFAULT now(),     -- 동기화(Sync) 시점 기록
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 설정
ALTER TABLE public.cafe24_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to cafe24_orders"
  ON public.cafe24_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 1. cafe24_orders 테이블 필드 추가 (재고 차감 완료 여부)
-- 기존에 생성된 테이블일 경우를 대비해 ADD COLUMN
ALTER TABLE public.cafe24_orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT FALSE;

-- 2. inventory_logs 제약 조건 업데이트
-- 기존 데이터 중 제약조건을 벗어나는 값(예: 입고, 취소 등)이 있을 수 있으므로 
-- 제약 조건을 삭제하여 유연성을 가지도록 변경합니다.

-- 2.1 기존 change_type 조건 드랍
ALTER TABLE public.inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_change_type_check;

-- 2.2 기존 reference_type 조건 드랍
ALTER TABLE public.inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_reference_type_check;

-- 3. cafe24_product_to_part 수동 매핑 테이블 생성 (자동매칭 실패 대비 백업용)
CREATE TABLE IF NOT EXISTS public.cafe24_product_to_part (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  mall_id text NOT NULL,
  cafe24_product_code text NOT NULL,
  part_id bigint REFERENCES public.parts(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS (수동 매핑 테이블)
ALTER TABLE public.cafe24_product_to_part ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to cafe24_product_to_part"
  ON public.cafe24_product_to_part
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- updated_at 갱신 트리거 생성
CREATE OR REPLACE FUNCTION update_cafe24_product_mapping_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cafe24_product_to_part_updated_at ON cafe24_product_to_part;
CREATE TRIGGER update_cafe24_product_to_part_updated_at
  BEFORE UPDATE ON cafe24_product_to_part
  FOR EACH ROW EXECUTE FUNCTION update_cafe24_product_mapping_updated_at_column();

-- 4. 주문자 아이디 및 배송메시지 컬럼 추가
ALTER TABLE public.cafe24_orders ADD COLUMN IF NOT EXISTS buyer_id text;
ALTER TABLE public.cafe24_orders ADD COLUMN IF NOT EXISTS buyer_group_no text;
ALTER TABLE public.cafe24_orders ADD COLUMN IF NOT EXISTS shipping_message text;
