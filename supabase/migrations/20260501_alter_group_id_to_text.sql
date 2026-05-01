-- group_id 컬럼을 UUID 및 숫자 아이디 모두 저장 가능하도록 TEXT로 변경
ALTER TABLE public.transactions ALTER COLUMN group_id TYPE TEXT USING group_id::text;
