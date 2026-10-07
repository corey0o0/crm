-- 기존 model 필드를 이름(name) 접미사의 실제 텍스트(공백 없는 표기)에 맞춰 통일
-- 자동생성, 총 3건
-- Supabase SQL Editor에서 실행하세요

BEGIN;

UPDATE parts SET model = 'X200GT' WHERE id = 1397; -- was 'X200 GT' (name: "소프트 숏시트 블랙(N) - X200GT")
UPDATE parts SET model = 'X50GT' WHERE id = 1398; -- was 'X50 GT' (name: "시트포스트 - X50GT")
UPDATE parts SET model = 'X200GT/X100GT' WHERE id = 1391; -- was 'X200 GT/X100 GT' (name: "컨트롤러 - X200GT/X100GT")

COMMIT;
