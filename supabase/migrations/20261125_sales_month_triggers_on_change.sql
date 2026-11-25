-- 판매현황 스냅샷 무효화 트리거: 값이 실제로 바뀐 UPDATE만 반영
-- 20261124 적용 후 하루 만에 11월 version 22,914 / 10월 12,238 / ALL 6 — 정각마다 여러 달의 행을 한꺼번에
-- 다시 쓰는 작업(동기화 등)이 값 변화 없이 UPDATE를 날려 스냅샷이 매시간 무효화됨.
-- → UPDATE 트리거에 WHEN 조건 추가: 통계 계산에 쓰는 컬럼이 바뀐 경우만 version +1.
-- 함수는 20261124 것을 그대로 사용. INSERT/DELETE는 조건 없이 유지.

-- 출고
DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.shipments;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR DELETE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_shipments();
DROP TRIGGER IF EXISTS trg_sales_month_dirty_upd ON public.shipments;
CREATE TRIGGER trg_sales_month_dirty_upd AFTER UPDATE ON public.shipments
  FOR EACH ROW WHEN (
    (OLD.order_date, OLD.status, OLD.price, OLD.brand, OLD.sales_channel, OLD.note, OLD.tracking_number)
    IS DISTINCT FROM
    (NEW.order_date, NEW.status, NEW.price, NEW.brand, NEW.sales_channel, NEW.note, NEW.tracking_number)
  ) EXECUTE FUNCTION public.trg_sales_month_shipments();

-- 출고 부품
DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.shipment_parts;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR DELETE ON public.shipment_parts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_shipment_parts();
DROP TRIGGER IF EXISTS trg_sales_month_dirty_upd ON public.shipment_parts;
CREATE TRIGGER trg_sales_month_dirty_upd AFTER UPDATE ON public.shipment_parts
  FOR EACH ROW WHEN (
    (OLD.shipment_id, OLD.quantity, OLD.price, OLD.note, OLD.part_name, OLD.part_code)
    IS DISTINCT FROM
    (NEW.shipment_id, NEW.quantity, NEW.price, NEW.note, NEW.part_name, NEW.part_code)
  ) EXECUTE FUNCTION public.trg_sales_month_shipment_parts();

-- A/S
DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.services;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_services();
DROP TRIGGER IF EXISTS trg_sales_month_dirty_upd ON public.services;
CREATE TRIGGER trg_sales_month_dirty_upd AFTER UPDATE ON public.services
  FOR EACH ROW WHEN (
    (OLD.completion_date, OLD.status, OLD.brand)
    IS DISTINCT FROM
    (NEW.completion_date, NEW.status, NEW.brand)
  ) EXECUTE FUNCTION public.trg_sales_month_services();

-- A/S 부품 (어떤 컬럼이든 바뀌면 반영 — 부품 연결 컬럼명이 코드에 안 드러나서 전체 행 비교)
DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.service_parts;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR DELETE ON public.service_parts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_service_parts();
DROP TRIGGER IF EXISTS trg_sales_month_dirty_upd ON public.service_parts;
CREATE TRIGGER trg_sales_month_dirty_upd AFTER UPDATE ON public.service_parts
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION public.trg_sales_month_service_parts();

-- 카페24 주문
DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.cafe24_orders;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR DELETE ON public.cafe24_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_sales_month_cafe24_orders();
DROP TRIGGER IF EXISTS trg_sales_month_dirty_upd ON public.cafe24_orders;
CREATE TRIGGER trg_sales_month_dirty_upd AFTER UPDATE ON public.cafe24_orders
  FOR EACH ROW WHEN (
    (OLD.order_date, OLD.is_deleted, OLD.is_transferred, OLD.total_amount, OLD.shipping_fee,
     OLD.used_points, OLD.mall_id, OLD.order_id, OLD.order_items, OLD.agency_id)
    IS DISTINCT FROM
    (NEW.order_date, NEW.is_deleted, NEW.is_transferred, NEW.total_amount, NEW.shipping_fee,
     NEW.used_points, NEW.mall_id, NEW.order_id, NEW.order_items, NEW.agency_id)
  ) EXECUTE FUNCTION public.trg_sales_month_cafe24_orders();

-- 상품: INSERT/DELETE는 문장 단위 그대로, UPDATE는 해당 컬럼 값이 바뀐 행이 있을 때만
DROP TRIGGER IF EXISTS trg_sales_month_dirty ON public.parts;
CREATE TRIGGER trg_sales_month_dirty AFTER INSERT OR DELETE ON public.parts
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_sales_month_parts();
DROP TRIGGER IF EXISTS trg_sales_month_dirty_upd ON public.parts;
CREATE TRIGGER trg_sales_month_dirty_upd AFTER UPDATE ON public.parts
  FOR EACH ROW WHEN (
    (OLD.price, OLD.supply_price, OLD.name, OLD.code, OLD.barcode, OLD.note, OLD.brand)
    IS DISTINCT FROM
    (NEW.price, NEW.supply_price, NEW.name, NEW.code, NEW.barcode, NEW.note, NEW.brand)
  ) EXECUTE FUNCTION public.trg_sales_month_parts();
