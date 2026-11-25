-- 판매현황 통합 통계: 마감된 달의 집계 결과 스냅샷 + 원본 변경 시 자동 무효화
--
-- 동작
--  - 화면(JS)이 마감된 달의 집계를 계산해 sales_month_snapshots에 저장하고 다음부터 재사용.
--  - 출고/A/S/카페24 주문이 바뀌면 트리거가 해당 달 version을 +1 → 저장값이 무효가 되어 다시 계산.
--  - 상품(parts) 가격·원가·분류·브랜드 변경은 모든 달에 영향 → 'ALL' version +1 (전체 무효화).
--  - 스냅샷은 계산 시작 전에 읽은 version을 함께 저장 → 계산 도중 바뀐 경우도 다음 조회 때 무효 처리됨.

CREATE TABLE IF NOT EXISTS public.sales_month_versions (
  month text PRIMARY KEY,                -- 'YYYY-MM'(KST) 또는 'ALL'
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_month_snapshots (
  kind text NOT NULL,                    -- 'chart'(월별 매출/원가) | 'total'(전월·전년 비교 합계)
  variant text NOT NULL,                 -- 몰 권한·수수료 요율 등 계산 조건
  month text NOT NULL,                   -- 'YYYY-MM'(KST)
  data jsonb NOT NULL,
  month_version bigint NOT NULL,
  global_version bigint NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, variant, month)
);

-- 해당 시각이 속한 달의 version +1
CREATE OR REPLACE FUNCTION public.bump_sales_month(ts timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF ts IS NULL THEN RETURN; END IF;
  INSERT INTO public.sales_month_versions (month, version)
  VALUES (to_char(ts AT TIME ZONE 'Asia/Seoul', 'YYYY-MM'), 1)
  ON CONFLICT (month) DO UPDATE
    SET version = public.sales_month_versions.version + 1, updated_at = now();
END $$;

REVOKE EXECUTE ON FUNCTION public.bump_sales_month(timestamptz) FROM PUBLIC, anon, authenticated;

-- 출고: 수정 전/후 날짜의 달 모두 무효화 (날짜 이동 대비)
CREATE OR REPLACE FUNCTION public.trg_sales_month_shipments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.bump_sales_month(OLD.order_date::timestamptz); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.bump_sales_month(NEW.order_date::timestamptz); END IF;
  RETURN NULL;
END $$;

-- A/S: 완료일 기준
CREATE OR REPLACE FUNCTION public.trg_sales_month_services() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.bump_sales_month(OLD.completion_date::timestamptz); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.bump_sales_month(NEW.completion_date::timestamptz); END IF;
  RETURN NULL;
END $$;

-- 카페24 주문: 주문일 기준 (창고 반영도 order_items 수정이라 여기서 잡힘)
CREATE OR REPLACE FUNCTION public.trg_sales_month_cafe24_orders() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.bump_sales_month(OLD.order_date::timestamptz); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.bump_sales_month(NEW.order_date::timestamptz); END IF;
  RETURN NULL;
END $$;

-- 출고 부품(반품 표시 등): 상위 출고의 날짜 기준
CREATE OR REPLACE FUNCTION public.trg_sales_month_shipment_parts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.bump_sales_month((SELECT s.order_date::timestamptz FROM public.shipments s WHERE s.id = OLD.shipment_id));
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.bump_sales_month((SELECT s.order_date::timestamptz FROM public.shipments s WHERE s.id = NEW.shipment_id));
  END IF;
  RETURN NULL;
END $$;

-- A/S 부품: 상위 A/S의 완료일 기준
CREATE OR REPLACE FUNCTION public.trg_sales_month_service_parts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.bump_sales_month((SELECT v.completion_date::timestamptz FROM public.services v WHERE v.id = OLD.service_id));
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.bump_sales_month((SELECT v.completion_date::timestamptz FROM public.services v WHERE v.id = NEW.service_id));
  END IF;
  RETURN NULL;
END $$;

-- 상품 마스터: 원가/가격/분류/브랜드/이름/코드가 바뀌면 모든 달 재계산
CREATE OR REPLACE FUNCTION public.trg_sales_month_parts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.sales_month_versions (month, version) VALUES ('ALL', 1)
  ON CONFLICT (month) DO UPDATE
    SET version = public.sales_month_versions.version + 1, updated_at = now();
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.shipments;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR UPDATE OR DELETE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_shipments();

DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.services;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_services();

DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.cafe24_orders;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR UPDATE OR DELETE ON public.cafe24_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_cafe24_orders();

DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.shipment_parts;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR UPDATE OR DELETE ON public.shipment_parts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_shipment_parts();

DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.service_parts;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR UPDATE OR DELETE ON public.service_parts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_service_parts();

DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.parts;
CREATE TRIGGER trg_sales_month_dirty
  AFTER INSERT OR DELETE OR UPDATE OF price, supply_price, name, code, barcode, note, brand ON public.parts
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_sales_month_parts();

-- ponytail: transactions(카페24 창고 폴백) 변경은 무효화 안 함. 창고 반영 시 order_items도 함께 수정되어 위 트리거로 잡힘.
--           폴백만 쓰는 옛 주문에 출고 트랜잭션을 새로 추가하는 경우만 빠짐 → 필요 시 transactions 트리거 추가.

ALTER TABLE public.sales_month_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_month_snapshots ENABLE ROW LEVEL SECURITY;

-- version은 읽기만 (쓰기는 트리거 전용)
DROP POLICY IF EXISTS "authenticated read" ON public.sales_month_versions;
CREATE POLICY "authenticated read" ON public.sales_month_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated read" ON public.sales_month_snapshots;
CREATE POLICY "authenticated read" ON public.sales_month_snapshots
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated insert" ON public.sales_month_snapshots;
CREATE POLICY "authenticated insert" ON public.sales_month_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated update" ON public.sales_month_snapshots;
CREATE POLICY "authenticated update" ON public.sales_month_snapshots
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
