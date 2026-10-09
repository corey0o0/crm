-- id 560 "리어라이트" model에 X100, X100S 추가
BEGIN;

UPDATE parts
SET model = '미니/X100/X100S'
WHERE id = 560;

COMMIT;
