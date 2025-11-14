-- 주문대기 시스템을 위한 테이블 생성

-- 주문대기 그룹 테이블
CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('service', 'shipment')),
  reference_id INTEGER NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('XRB', 'NB')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 주문대기 상품 목록 테이블
CREATE TABLE IF NOT EXISTS pending_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_order_id UUID NOT NULL REFERENCES pending_orders(id) ON DELETE CASCADE,
  part_id INTEGER,
  part_name TEXT NOT NULL,
  part_code TEXT,
  barcode TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  matched_product_id TEXT,
  matched_product_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'out_of_stock', 'ordered')),
  options JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 주문 처리 현황 테이블
CREATE TABLE IF NOT EXISTS order_processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_order_id UUID NOT NULL REFERENCES pending_orders(id) ON DELETE CASCADE,
  order_id TEXT,
  brand TEXT NOT NULL CHECK (brand IN ('XRB', 'NB')),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_completed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pending_orders_reference ON pending_orders(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_brand ON pending_orders(brand);
CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_order_items_order_id ON pending_order_items(pending_order_id);
CREATE INDEX IF NOT EXISTS idx_pending_order_items_status ON pending_order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_processing_logs_order_id ON order_processing_logs(pending_order_id);
CREATE INDEX IF NOT EXISTS idx_order_processing_logs_status ON order_processing_logs(status);

-- RLS 활성화
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_processing_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 정책 설정
CREATE POLICY "Allow public read access on pending_orders"
ON pending_orders FOR SELECT
USING (true);

CREATE POLICY "Allow public read access on pending_order_items"
ON pending_order_items FOR SELECT
USING (true);

CREATE POLICY "Allow public read access on order_processing_logs"
ON order_processing_logs FOR SELECT
USING (true);

-- 인증된 사용자가 데이터를 관리할 수 있도록 정책 설정
CREATE POLICY "Allow authenticated users to insert pending_orders"
ON pending_orders FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update pending_orders"
ON pending_orders FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete pending_orders"
ON pending_orders FOR DELETE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert pending_order_items"
ON pending_order_items FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update pending_order_items"
ON pending_order_items FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete pending_order_items"
ON pending_order_items FOR DELETE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert order_processing_logs"
ON order_processing_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update order_processing_logs"
ON order_processing_logs FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_pending_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pending_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_pending_orders_timestamp
  BEFORE UPDATE ON pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_orders_updated_at();

CREATE TRIGGER update_pending_order_items_timestamp
  BEFORE UPDATE ON pending_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_order_items_updated_at();

-- 테이블 코멘트
COMMENT ON TABLE pending_orders IS '주문대기 그룹 정보';
COMMENT ON TABLE pending_order_items IS '주문대기 상품 목록';
COMMENT ON TABLE order_processing_logs IS '주문 처리 현황 이력';

