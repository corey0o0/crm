-- 기존 '파츠' 카테고리를 '파츠 - 일반 부품' / '파츠 - 전기 부품'으로 세분화

-- 1. 기본값: 파츠 → 파츠 - 일반 부품
UPDATE parts
SET category = '파츠 - 일반 부품'
WHERE category = '파츠';

-- 2. 전기 부품 키워드 매칭: 파츠 - 전기 부품으로 변경
UPDATE parts
SET category = '파츠 - 전기 부품'
WHERE category = '파츠 - 일반 부품'
  AND (
    name ILIKE '%모터%' OR
    name ILIKE '%컨트롤러%' OR
    name ILIKE '%릴레이%' OR
    name ILIKE '%메인케이블%' OR
    name ILIKE '%케이블%' OR
    name ILIKE '%젠더%' OR
    name ILIKE '%스위치%' OR
    name ILIKE '%디스플레이%' OR
    name ILIKE '%충전기%' OR
    name ILIKE '%라이트%' OR
    name ILIKE '%거치대%' OR
    name ILIKE '%트레이%'
  );

-- 결과 확인 쿼리 (실행 후 확인용)
-- SELECT category, COUNT(*) as count
-- FROM parts
-- GROUP BY category
-- ORDER BY category;
