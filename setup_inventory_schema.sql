-- =============================================
-- 매장/온라인 출고 통합 검수 작업 대기열 (Pending Outbounds) 스키마
-- =============================================

CREATE TABLE IF NOT EXISTS public.pending_outbounds (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_no text NOT NULL,              -- 지시서 번호 (예: AS-20231025-01, SHP-20231025-02)
  type text NOT NULL,                  -- 출처 유형 (AS 출고, 일반 출고, 온라인 주문 등)
  source_id text,                      -- 원본 문서 ID (AS 영수증 ID, 출고내역 ID 등 - 유연성을 위해 text)
  status text DEFAULT '대기',          -- 상태 (대기, 진행중, 완료, 취소)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pending_outbound_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  pending_id uuid REFERENCES public.pending_outbounds(id) ON DELETE CASCADE,
  part_id bigint REFERENCES public.parts(id) ON DELETE SET NULL, 
  name text NOT NULL,
  code text,
  barcode text,
  expected_qty integer DEFAULT 1,
  scanned_qty integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS 설정
ALTER TABLE public.pending_outbounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_outbound_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access to pending_outbounds" ON public.pending_outbounds;
CREATE POLICY "Allow authenticated access to pending_outbounds"
  ON public.pending_outbounds FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to pending_outbound_items" ON public.pending_outbound_items;
CREATE POLICY "Allow authenticated access to pending_outbound_items"
  ON public.pending_outbound_items FOR ALL TO authenticated USING (true) WITH CHECK (true);


