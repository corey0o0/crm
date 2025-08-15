-- model_settings 테이블 스키마 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'model_settings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 테이블 구조 상세 확인
\d model_settings;
