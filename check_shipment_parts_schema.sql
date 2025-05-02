-- shipment_parts 테이블의 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shipment_parts'
ORDER BY ordinal_position;

-- 이미 존재하는 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'shipment_parts';

-- 테이블에 있는 데이터 샘플 확인
SELECT * FROM shipment_parts LIMIT 5; 