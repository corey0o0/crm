-- part_category가 비어있거나 NULL인 레코드를 기본값으로 업데이트
UPDATE public.shipment_parts 
SET part_category = '기체'
WHERE part_category IS NULL OR part_category = '';

-- 인덱스가 없는 경우 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'shipment_parts_part_category_idx') THEN
        CREATE INDEX shipment_parts_part_category_idx ON public.shipment_parts (part_category);
    END IF;
END
$$;

-- note 필드가 없는 경우 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shipment_parts' AND column_name = 'note'
    ) THEN
        ALTER TABLE public.shipment_parts ADD COLUMN note TEXT;
        COMMENT ON COLUMN public.shipment_parts.note IS '부품 관련 메모';
    END IF;
END
$$;

-- part_category에 대한 설명이 없는 경우 추가
COMMENT ON COLUMN public.shipment_parts.part_category IS '부품 카테고리 (기체, 파츠, 공임, 기타)';

-- 현재 shipment_parts 테이블의 카테고리 현황 조회
SELECT part_category, COUNT(*) 
FROM public.shipment_parts 
GROUP BY part_category 
ORDER BY COUNT(*) DESC; 