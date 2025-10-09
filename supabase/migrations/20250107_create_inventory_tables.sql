-- 입출고 관리 시스템을 위한 테이블 생성

-- 창고 테이블
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT,
  manager TEXT,
  address TEXT,
  stock_sync BOOLEAN DEFAULT false,
  sync_with_product_stock BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 대리점 테이블
CREATE TABLE IF NOT EXISTS dealers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT,
  manager TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 거래내역 테이블
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  product_supplier TEXT DEFAULT 'NEARBIKE',
  quantity INTEGER NOT NULL,
  from_location TEXT,
  to_location TEXT,
  date DATE NOT NULL,
  note TEXT,
  additional_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_grouped BOOLEAN DEFAULT false
);

-- 재고 테이블 (창고별 상품 재고)
CREATE TABLE IF NOT EXISTS inventory (
  id BIGSERIAL PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 설정 (인증된 사용자만)
CREATE POLICY "Enable all operations for authenticated users" ON warehouses
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON dealers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON transactions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON inventory
  FOR ALL USING (auth.role() = 'authenticated');

-- 기본 창고 데이터 삽입
INSERT INTO warehouses (id, name, location, phone, manager, address, stock_sync, sync_with_product_stock) VALUES
('W001', '창고 A', '서울', '02-1234-5678', '김창고', '서울시 강남구 테헤란로 123', true, true),
('W002', '창고 B', '부산', '051-1234-5678', '박창고', '부산시 해운대구 마린시티 456', false, false),
('W003', '창고 C', '대구', '053-1234-5678', '이창고', '대구시 수성구 범어동 789', false, false)
ON CONFLICT (id) DO NOTHING;

-- 기본 대리점 데이터 삽입 (10개)
INSERT INTO dealers (id, name, location, phone, manager, address) VALUES
('D001', '대리점 1', '지역 1', '010-1234-5678', '관리자1', '1번 지역 주소'),
('D002', '대리점 2', '지역 2', '010-2345-6789', '관리자2', '2번 지역 주소'),
('D003', '대리점 3', '지역 3', '010-3456-7890', '관리자3', '3번 지역 주소'),
('D004', '대리점 4', '지역 4', '010-4567-8901', '관리자4', '4번 지역 주소'),
('D005', '대리점 5', '지역 5', '010-5678-9012', '관리자5', '5번 지역 주소'),
('D006', '대리점 6', '지역 6', '010-6789-0123', '관리자6', '6번 지역 주소'),
('D007', '대리점 7', '지역 7', '010-7890-1234', '관리자7', '7번 지역 주소'),
('D008', '대리점 8', '지역 8', '010-8901-2345', '관리자8', '8번 지역 주소'),
('D009', '대리점 9', '지역 9', '010-9012-3456', '관리자9', '9번 지역 주소'),
('D010', '대리점 10', '지역 10', '010-0123-4567', '관리자10', '10번 지역 주소')
ON CONFLICT (id) DO NOTHING;
