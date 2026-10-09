-- 상품명에 '/'로 여러 기종이 나열되어 있는데 model 컬럼에 일부/전부 빠진 14건 보정
-- X200고급형(S) = X200S (X200 Pro와는 별개 기종)
BEGIN;

UPDATE parts SET model = 'X200/X200S/X200T/X100' WHERE id = 557; -- was: (없음) | 헤드라이트 - X200/X200S/X200T/New X100
UPDATE parts SET model = 'X100/X200' WHERE id = 559; -- was: (없음) | 헤드라이트 홀더 - New X100/X200
UPDATE parts SET model = '미니/X200/X200S/X100' WHERE id = 560; -- was: 미니 | 리어라이트 - X200/X200S/New X100/미니(48V,방향)
UPDATE parts SET model = 'X100/X100S' WHERE id = 561; -- was: (없음) | 리어라이트 - X100/X100S
UPDATE parts SET model = 'X200/X200S/X200T/X100' WHERE id = 563; -- was: (없음) | 기능 스위치 - X200/X200S/X200T/New X100
UPDATE parts SET model = 'X100/X100S' WHERE id = 709; -- was: (없음) | 체인 - X100/X100S
UPDATE parts SET model = 'Turbo Pro/X200T' WHERE id = 736; -- was: Turbo Pro | BB 풋페그 - 터보프로/X200T(페달 제거)
UPDATE parts SET model = '클래식/레트로/카고' WHERE id = 950; -- was: (없음) | 컨트롤러(사용X) - 클래식/레트로/카고
UPDATE parts SET model = '레트로/레트로 미니' WHERE id = 964; -- was: (없음) | KTET 프론트 브레이크 세트 - 레트로/레트로미니
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X200' WHERE id = 1202; -- was: X200 Pro | 머드가드 세트 - X200 프로/터보 프로/X200
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X200/X200S/X200T' WHERE id = 1237; -- was: X200 Pro | 프레임 미러크롬 - X200프로/터보 프로/X200/X200고급형(S)/X200T
UPDATE parts SET model = 'X200 Pro/Turbo Pro/X200/X200S/X200T' WHERE id = 1238; -- was: X200 Pro | 프레임 메탈그레이 - X200프로/터보 프로/X200/X200고급형(S)/X200T
UPDATE parts SET model = 'Turbo Pro/X200T' WHERE id = 1243; -- was: (없음) | 체인텐션 2개 세트 - 터보프로/X200T(구경이 큼)
UPDATE parts SET model = 'X50 GT/레트로 FS/레트로 투어' WHERE id = 1392; -- was: (없음) | 컨트롤러 - X50GT/레트로FS/레트로투어

COMMIT;
