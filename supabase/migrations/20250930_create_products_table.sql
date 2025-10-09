-- 니어바이크 상품 테이블 생성
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  brand text default 'nearbike',
  price decimal(10,2) not null default 0,
  cost_price decimal(10,2) default 0,
  stock integer not null default 0,
  min_stock integer default 0,
  description text,
  specifications jsonb default '{}',
  images text[],
  status text default 'active' check (status in ('active', 'inactive', 'discontinued')),
  supplier text,
  supplier_code text,
  weight decimal(8,2),
  dimensions jsonb default '{}',
  warranty_period integer default 12,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 인덱스 생성
create index if not exists idx_products_code on public.products(code);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_brand on public.products(brand);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_name on public.products using gin(to_tsvector('korean', name));

-- RLS 활성화
alter table public.products enable row level security;

-- 모든 사용자가 읽을 수 있도록 정책 설정
create policy "Allow public read access"
on public.products for select
using (true);

-- 인증된 사용자가 상품을 관리할 수 있도록 정책 설정
create policy "Allow authenticated users to insert"
on public.products for insert
with check (auth.role() = 'authenticated');

create policy "Allow authenticated users to update"
on public.products for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Allow authenticated users to delete"
on public.products for delete
using (auth.role() = 'authenticated');

-- 업데이트 트리거로 updated_at 갱신
create or replace function public.update_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_products_updated_at on public.products;
create trigger update_products_updated_at
before update on public.products
for each row execute procedure public.update_products_updated_at();

-- 니어바이크 샘플 상품 데이터 삽입
insert into public.products (code, name, category, price, cost_price, stock, min_stock, description, supplier) values
('NB-FRAME-001', '니어바이크 프레임 모델 A', '프레임', 450000, 320000, 25, 5, '고급 알루미늄 합금 프레임, 경량화 설계', '니어바이크'),
('NB-FRAME-002', '니어바이크 프레임 모델 B', '프레임', 520000, 380000, 18, 3, '카본 파이버 프레임, 최고급 모델', '니어바이크'),
('NB-WHEEL-001', '니어바이크 휠셋 표준형', '휠/타이어', 180000, 125000, 40, 8, '26인치 표준 휠셋, 내구성 우수', '니어바이크'),
('NB-WHEEL-002', '니어바이크 휠셋 고급형', '휠/타이어', 250000, 180000, 22, 5, '29인치 고급 휠셋, 경량 설계', '니어바이크'),
('NB-BRAKE-001', '니어바이크 디스크 브레이크', '브레이크', 85000, 58000, 60, 12, '유압 디스크 브레이크 시스템', '니어바이크'),
('NB-BRAKE-002', '니어바이크 V브레이크', '브레이크', 35000, 22000, 80, 15, '경제형 V브레이크 시스템', '니어바이크'),
('NB-GEAR-001', '니어바이크 21단 변속기', '변속기', 120000, 85000, 35, 7, '시마노 호환 21단 변속 시스템', '니어바이크'),
('NB-GEAR-002', '니어바이크 27단 변속기', '변속기', 180000, 128000, 28, 5, '고급 27단 변속 시스템', '니어바이크'),
('NB-SADDLE-001', '니어바이크 안장 컴포트', '안장/시트포스트', 45000, 28000, 100, 20, '편안한 젤 패드 안장', '니어바이크'),
('NB-SADDLE-002', '니어바이크 안장 스포츠', '안장/시트포스트', 65000, 42000, 75, 15, '스포츠용 경량 안장', '니어바이크'),
('NB-HANDLE-001', '니어바이크 핸들바 표준', '핸들바/스템', 38000, 24000, 90, 18, '알루미늄 핸들바, 표준형', '니어바이크'),
('NB-HANDLE-002', '니어바이크 핸들바 에어로', '핸들바/스템', 58000, 38000, 45, 10, '에어로 다이나믹 핸들바', '니어바이크'),
('NB-PEDAL-001', '니어바이크 페달 기본형', '페달', 25000, 15000, 120, 25, '플라스틱 기본 페달', '니어바이크'),
('NB-PEDAL-002', '니어바이크 페달 알루미늄', '페달', 45000, 28000, 85, 18, '알루미늄 고급 페달', '니어바이크'),
('NB-CHAIN-001', '니어바이크 체인 표준', '체인/스프라켓', 18000, 11000, 150, 30, 'KMC 호환 표준 체인', '니어바이크'),
('NB-LIGHT-001', '니어바이크 LED 전조등', '조명/액세서리', 35000, 22000, 65, 12, 'USB 충전식 LED 전조등', '니어바이크'),
('NB-LIGHT-002', '니어바이크 LED 후미등', '조명/액세서리', 25000, 15000, 80, 15, 'USB 충전식 LED 후미등', '니어바이크'),
('NB-HELMET-001', '니어바이크 헬멧 기본형', '헬멧/보호장비', 55000, 35000, 45, 10, '안전 인증 기본 헬멧', '니어바이크'),
('NB-HELMET-002', '니어바이크 헬멧 고급형', '헬멧/보호장비', 85000, 58000, 32, 8, '통풍 시스템 고급 헬멧', '니어바이크'),
('NB-TOOL-001', '니어바이크 멀티툴', '공구/정비용품', 28000, 18000, 95, 20, '15가지 기능 멀티툴', '니어바이크');

-- 코멘트 추가
comment on table public.products is '니어바이크 상품 정보 테이블';
comment on column public.products.code is '상품 코드 (고유)';
comment on column public.products.name is '상품명';
comment on column public.products.category is '상품 카테고리';
comment on column public.products.brand is '브랜드명';
comment on column public.products.price is '판매가격';
comment on column public.products.cost_price is '원가';
comment on column public.products.stock is '현재 재고';
comment on column public.products.min_stock is '최소 재고';
comment on column public.products.specifications is '상품 사양 (JSON)';
comment on column public.products.images is '상품 이미지 URL 배열';
comment on column public.products.status is '상품 상태 (active/inactive/discontinued)';
comment on column public.products.supplier is '공급업체';
comment on column public.products.supplier_code is '공급업체 상품코드';
comment on column public.products.weight is '무게 (kg)';
comment on column public.products.dimensions is '크기 정보 (JSON)';
comment on column public.products.warranty_period is '보증기간 (개월)';
