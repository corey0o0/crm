-- =============================================
-- 다중 쇼핑몰 연동을 위한 메이저 DB 구조 개선 v2
-- Supabase의 [SQL Editor] 에서 실행해 주세요!
-- =============================================

-- 1. board_posts 테이블: 글이 어느 쇼핑몰 출신인지 구분표(mall_id)를 달기 위해 컬럼 추가
ALTER TABLE board_posts 
  ADD COLUMN IF NOT EXISTS cafe24_mall_id text;

-- (선택) 기존에 저장되어 있는 옛날 글들(내부 글 제외)이 모두 'slimpack79' 출신이라고 라벨 붙이기
UPDATE board_posts 
  SET cafe24_mall_id = 'slimpack79' 
  WHERE source = 'cafe24' AND cafe24_mall_id IS NULL;

-- 2. cafe24_settings 테이블 구조 보강 (혹시 생성되지 않은 컬럼이 있을 경우 자동 추가)
ALTER TABLE cafe24_settings 
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS board_no varchar(255) DEFAULT '1',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- 강제로 API 서버(PostgREST)의 스키마 캐시를 즉시 새로고침합니다.
NOTIFY pgrst, 'reload schema';

-- 3. cafe24_settings 테이블: 각 쇼핑몰 아이디(mall_id)당 1줄만 존재하도록 보안키(고유 제약조건) 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cafe24_settings_mall_id_key'
    ) THEN
        ALTER TABLE cafe24_settings ADD CONSTRAINT cafe24_settings_mall_id_key UNIQUE (mall_id);
    END IF;
END $$;

-- 완료! 이제 다중 쇼핑몰을 무제한 등록하고 관리할 수 있는 DB 컨테이너가 준비되었습니다.
