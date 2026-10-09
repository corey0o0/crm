-- id 1022 "드레일러 행어 A" model 누락 수정
-- 레트로/클래식(NB) + X200 MAX(XRB) 공용 파츠인데 model에 클래식이 빠져있었음 (name_en: "for Classic / Retro")
BEGIN;

UPDATE parts
SET model = '레트로/클래식/X200 MAX',
    name = '드레일러 행어 A(X200맥스 공용) - 레트로/클래식/X200 MAX'
WHERE id = 1022;

COMMIT;
