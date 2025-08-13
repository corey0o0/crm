-- user_memos 테이블에 메모 이름 컬럼 추가
ALTER TABLE user_memos 
ADD COLUMN IF NOT EXISTS memo_name_1 TEXT DEFAULT '메모 1',
ADD COLUMN IF NOT EXISTS memo_name_2 TEXT DEFAULT '메모 2',
ADD COLUMN IF NOT EXISTS memo_name_3 TEXT DEFAULT '메모 3';

-- 기존 데이터에 기본값 설정
UPDATE user_memos 
SET memo_name_1 = COALESCE(memo_name_1, '메모 1'),
    memo_name_2 = COALESCE(memo_name_2, '메모 2'),
    memo_name_3 = COALESCE(memo_name_3, '메모 3')
WHERE memo_name_1 IS NULL OR memo_name_2 IS NULL OR memo_name_3 IS NULL;
EOF < /dev/null