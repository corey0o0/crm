-- =============================================
-- 카페24 매출원장(주문) 테이블 생성 
-- Supabase SQL Editor에서 실행하세요
-- =============================================

CREATE TABLE IF NOT EXISTS cafe24_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  mall_id text NOT NULL,                   -- 해당 쇼핑몰 ID
  order_id text NOT NULL UNIQUE,           -- 카페24 주문번호
  
  order_date timestamptz,                  -- 결제/주문 일시
  total_amount numeric(12, 2) DEFAULT 0,   -- 총 결제/주문 금액
  
  -- 주문한 상품 목록 (배열 형태 JSONB)
  -- 예: [{ product_code: "P001", quantity: 2, price: 15000, product_name: "A" }]
  order_items jsonb DEFAULT '[]'::jsonb,
  
  status text,                             -- 주문 상태 (결제완료, 배송완료 등)
  buyer_name text,                         -- 구매자 이름 (선택사항)
  buyer_phone text,                        -- 구매자 연락처 (선택사항)
  
  synced_at timestamptz DEFAULT now(),     -- 동기화(Sync) 시점 기록
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 설정
ALTER TABLE cafe24_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to cafe24_orders"
  ON cafe24_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- updated_at 자동 갱신 트리거 생성
CREATE OR REPLACE FUNCTION update_cafe24_orders_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cafe24_orders_updated_at ON cafe24_orders;
CREATE TRIGGER update_cafe24_orders_updated_at
  BEFORE UPDATE ON cafe24_orders
  FOR EACH ROW EXECUTE FUNCTION update_cafe24_orders_updated_at_column();

-- 검색 및 조인 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_cafe24_orders_order_id ON cafe24_orders (order_id);
CREATE INDEX IF NOT EXISTS idx_cafe24_orders_mall_id ON cafe24_orders (mall_id);
CREATE INDEX IF NOT EXISTS idx_cafe24_orders_date ON cafe24_orders (order_date);
