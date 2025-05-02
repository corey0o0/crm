-- shipment_parts 테이블에 part_category 필드 추가
ALTER TABLE public.shipment_parts ADD COLUMN part_category TEXT DEFAULT '기체';
COMMENT ON COLUMN public.shipment_parts.part_category IS '부품 카테고리 (기체, 파츠, 공임, 기타)';

-- shipment_parts 테이블에 note 필드 추가
ALTER TABLE public.shipment_parts ADD COLUMN note TEXT;
COMMENT ON COLUMN public.shipment_parts.note IS '부품 관련 메모';

-- 모든 기존 레코드 업데이트: 기본값 설정
UPDATE public.shipment_parts SET part_category = '기체' WHERE part_category IS NULL;

-- shipment_parts 테이블에 인덱스 생성
CREATE INDEX IF NOT EXISTS shipment_parts_part_category_idx ON public.shipment_parts (part_category);

-- 완료 메시지
SELECT 'shipment_parts 테이블에 part_category 및 note 필드가 추가되었습니다.' as message; 