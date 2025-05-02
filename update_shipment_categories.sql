-- 출고 카테고리 대량 업데이트 스크립트
-- 파츠 관리의 정보를 기반으로 shipment_parts 테이블의 카테고리 정보 업데이트

-- 1. 코드 기반 카테고리 업데이트
UPDATE public.shipment_parts AS sp
SET part_category = 
  CASE 
    WHEN sp.part_code LIKE 'XRBM-%' THEN '기체'
    WHEN sp.part_code LIKE 'XRBP-%' THEN '파츠'
    WHEN sp.part_code LIKE 'XRBS-%' THEN '공임'
    WHEN sp.part_code LIKE 'NBM-%' THEN '기체'
    WHEN sp.part_code LIKE 'NBP-%' THEN '파츠'
    WHEN sp.part_code LIKE 'NBS-%' THEN '공임'
    ELSE sp.part_category -- 기존 카테고리 유지
  END
WHERE sp.part_code IS NOT NULL AND LENGTH(sp.part_code) > 0;

-- 2. 파츠 테이블의 note 필드를 기반으로 카테고리 업데이트
WITH parts_with_notes AS (
  SELECT 
    code, 
    LOWER(note) AS lower_note
  FROM 
    public.parts
  WHERE 
    note IS NOT NULL AND LENGTH(note) > 0
)
UPDATE public.shipment_parts AS sp
SET part_category = 
  CASE 
    WHEN pn.lower_note LIKE '%파츠%' OR pn.lower_note LIKE '%part%' OR pn.lower_note LIKE '%부품%' THEN '파츠'
    WHEN pn.lower_note LIKE '%공임%' OR pn.lower_note LIKE '%작업%' OR pn.lower_note LIKE '%서비스%' THEN '공임'
    WHEN pn.lower_note LIKE '%기타%' OR pn.lower_note LIKE '%etc%' THEN '기타'
    WHEN pn.lower_note LIKE '%기체%' OR pn.lower_note LIKE '%바이크%' OR pn.lower_note LIKE '%자전거%' THEN '기체'
    ELSE sp.part_category -- 기존 카테고리 유지
  END
FROM 
  parts_with_notes AS pn
WHERE 
  sp.part_code = pn.code;

-- 3. 제품명 기반 카테고리 업데이트 (코드나 note 없는 경우)
UPDATE public.shipment_parts AS sp
SET part_category = 
  CASE 
    -- 기체 키워드
    WHEN LOWER(sp.part_name) LIKE '%자전거%' OR LOWER(sp.part_name) LIKE '%바이크%' OR 
         LOWER(sp.part_name) LIKE '%bike%' OR LOWER(sp.part_name) LIKE '%기체%' OR
         LOWER(sp.part_name) LIKE '%x200%' OR LOWER(sp.part_name) LIKE '%x300%' OR
         LOWER(sp.part_name) LIKE '%x400%' OR LOWER(sp.part_name) LIKE '%x500%' THEN '기체'
    
    -- 파츠 키워드
    WHEN LOWER(sp.part_name) LIKE '%배터리%' OR LOWER(sp.part_name) LIKE '%컨트롤러%' OR
         LOWER(sp.part_name) LIKE '%브레이크%' OR LOWER(sp.part_name) LIKE '%타이어%' OR
         LOWER(sp.part_name) LIKE '%휠%' OR LOWER(sp.part_name) LIKE '%바퀴%' OR
         LOWER(sp.part_name) LIKE '%시트%' OR LOWER(sp.part_name) LIKE '%안장%' OR
         LOWER(sp.part_name) LIKE '%핸들%' OR LOWER(sp.part_name) LIKE '%모터%' OR
         LOWER(sp.part_name) LIKE '%거치대%' OR LOWER(sp.part_name) LIKE '%스탠드%' OR
         LOWER(sp.part_name) LIKE '%페달%' OR LOWER(sp.part_name) LIKE '%클립%' OR
         LOWER(sp.part_name) LIKE '%벨%' OR LOWER(sp.part_name) LIKE '%체인%' THEN '파츠'
    
    -- 공임 키워드
    WHEN LOWER(sp.part_name) LIKE '%공임%' OR LOWER(sp.part_name) LIKE '%조립%' OR
         LOWER(sp.part_name) LIKE '%수리%' OR LOWER(sp.part_name) LIKE '%점검%' OR
         LOWER(sp.part_name) LIKE '%교체%' OR LOWER(sp.part_name) LIKE '%설치%' OR
         LOWER(sp.part_name) LIKE '%작업%' OR LOWER(sp.part_name) LIKE '%서비스%' OR
         LOWER(sp.part_name) LIKE '%수정%' OR LOWER(sp.part_name) LIKE '%정비%' THEN '공임'
    
    ELSE sp.part_category -- 기존 카테고리 유지
  END
WHERE (sp.part_category IS NULL OR sp.part_category = '기체' OR sp.part_category = '') 
  AND (sp.part_code IS NULL OR sp.part_code = '');

-- 4. 가격 기반 카테고리 추정 (최후의 방법)
UPDATE public.shipment_parts AS sp
SET part_category = 
  CASE 
    WHEN sp.price > 500000 THEN '기체' -- 50만원 초과면 기체
    WHEN sp.price < 100000 THEN '파츠' -- 10만원 미만이면 파츠
    ELSE '기타' -- 그 외는 기타
  END
WHERE (sp.part_category IS NULL OR sp.part_category = '' OR sp.part_category = '기체')
  AND (sp.part_code IS NULL OR sp.part_code = '');

-- 5. 카테고리 NULL 값 처리
UPDATE public.shipment_parts
SET part_category = '기타'
WHERE part_category IS NULL OR part_category = '';

-- 결과 확인 및 통계
SELECT 
  part_category, 
  COUNT(*) as count, 
  ROUND(AVG(price), 0) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM 
  public.shipment_parts
GROUP BY 
  part_category
ORDER BY 
  count DESC; 