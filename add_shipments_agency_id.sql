-- 수기판매(B2B) 거래처 인식 버그 수정
-- 1) shipments 테이블에 agency_id 컬럼 추가
-- 2) 과거 수기판매 건 agency_id 소급 백필
-- 3) 이미 생성된 transactions.to_location 소급 보정 ('외부(고객)' -> 실제 거래처 id)
--
-- Supabase SQL Editor에서 실행. 순서대로 실행할 것 (1 -> 2 -> 3).

-- ── 1. 컬럼 추가 ──────────────────────────────────────────────
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

-- ── 2. 과거 수기판매(record_type='manual_sale') 건 agency_id 소급 백필 ──
-- sales_channel 텍스트가 agencies.name과 정확히 일치하는 경우만 채움(오매칭 방지).
UPDATE public.shipments s
SET agency_id = a.id
FROM public.agencies a
WHERE s.record_type = 'manual_sale'
  AND s.agency_id IS NULL
  AND a.name = s.sales_channel;

-- 위 실행 후 몇 건이 백필됐는지, 매칭 안 된 건 몇 개인지 확인:
-- SELECT count(*) FILTER (WHERE agency_id IS NOT NULL) AS matched,
--        count(*) FILTER (WHERE agency_id IS NULL) AS unmatched
-- FROM public.shipments WHERE record_type = 'manual_sale';

-- ── 3. 연결된 transactions.to_location 소급 보정 ──
-- 방금 agency_id가 채워진 shipment들의 출고(out) 트랜잭션 중,
-- 목적지가 옛 하드코딩 값 '외부(고객)'로 찍힌 것만 실제 거래처 id로 교정.
UPDATE public.transactions t
SET to_location = s.agency_id
FROM public.shipments s
WHERE s.record_type = 'manual_sale'
  AND s.agency_id IS NOT NULL
  AND t.group_id::text = s.id::text
  AND t.type = 'out'
  AND t.to_location = '외부(고객)';

-- 보정 후 입출고관리 대리점 통계 화면에서 과거 건이 잡히는지 확인.
