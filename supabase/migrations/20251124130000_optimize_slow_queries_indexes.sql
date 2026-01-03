-- 목적: 슬로우 쿼리 최적화를 위한 인덱스 추가
-- 우선순위: 가장 큰 비중을 차지하는 쿼리부터 개선

-- 1. inventory 테이블 복합 인덱스 (15.19% 비중, 평균 84ms)
-- ON CONFLICT(warehouse_id, product_id)와 WHERE 조건 최적화
DO $$
BEGIN
  IF to_regclass('public.inventory') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'inventory'
         AND indexname = 'idx_inventory_warehouse_product'
     ) THEN
    EXECUTE 'CREATE INDEX idx_inventory_warehouse_product ON public.inventory(warehouse_id, product_id)';
  END IF;
END $$;

-- 2. service_tags 테이블 인덱스 (services 조회 쿼리 최적화, 3.18% 비중)
DO $$
BEGIN
  IF to_regclass('public.service_tags') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'service_tags'
         AND indexname = 'service_tags_service_id_idx'
     ) THEN
    EXECUTE 'CREATE INDEX service_tags_service_id_idx ON public.service_tags(service_id)';
  END IF;
END $$;

-- 3. services 테이블 복합 인덱스 (brand + reception_date DESC 정렬 최적화)
DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'services'
         AND indexname = 'idx_services_brand_reception_date'
     ) THEN
    EXECUTE 'CREATE INDEX idx_services_brand_reception_date ON public.services(brand, reception_date DESC)';
  END IF;
END $$;

-- 4. services 테이블 복합 인덱스 (customer_phone + customer_name 조회 최적화)
DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'services'
         AND indexname = 'idx_services_customer_lookup'
     ) THEN
    EXECUTE 'CREATE INDEX idx_services_customer_lookup ON public.services(customer_phone, customer_name)';
  END IF;
END $$;

-- 5. parts 테이블 복합 인덱스 (brand + name 정렬 최적화)
DO $$
BEGIN
  IF to_regclass('public.parts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'parts'
         AND indexname = 'idx_parts_brand_name'
     ) THEN
    EXECUTE 'CREATE INDEX idx_parts_brand_name ON public.parts(brand, name)';
  END IF;
END $$;

-- 6. transactions 테이블 인덱스 (created_at DESC 정렬 최적화)
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'transactions'
         AND indexname = 'idx_transactions_created_at_desc'
     ) THEN
    EXECUTE 'CREATE INDEX idx_transactions_created_at_desc ON public.transactions(created_at DESC)';
  END IF;
END $$;

-- 7. services 테이블 인덱스 (product_name 정렬 최적화)
DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'services'
         AND indexname = 'idx_services_product_name'
     ) THEN
    EXECUTE 'CREATE INDEX idx_services_product_name ON public.services(product_name) WHERE product_name IS NOT NULL';
  END IF;
END $$;

