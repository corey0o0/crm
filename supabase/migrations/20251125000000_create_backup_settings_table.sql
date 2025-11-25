-- 자동백업 설정 테이블 생성
CREATE TABLE IF NOT EXISTS backup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 자동백업 활성화 여부
  enabled BOOLEAN DEFAULT false,
  
  -- 백업 주기 (daily, weekly, monthly)
  frequency VARCHAR(20) DEFAULT 'daily',
  
  -- 백업 시간 (HH:MM 형식, 24시간)
  backup_time TIME DEFAULT '02:00:00',
  
  -- 구글 드라이브 폴더 ID (선택사항)
  google_drive_folder_id TEXT,
  
  -- 마지막 백업 일시
  last_backup_at TIMESTAMPTZ,
  
  -- 다음 백업 예정 일시
  next_backup_at TIMESTAMPTZ,
  
  -- 백업 보관 개수 (최대 보관할 백업 파일 수)
  retention_count INTEGER DEFAULT 10,
  
  -- 설정 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 사용자당 하나의 설정만 허용
  UNIQUE(user_id)
);

-- RLS 활성화
ALTER TABLE backup_settings ENABLE ROW LEVEL SECURITY;

-- 자신의 백업 설정만 조회 가능
CREATE POLICY "Users can view their own backup settings"
  ON backup_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- 자신의 백업 설정만 삽입 가능
CREATE POLICY "Users can insert their own backup settings"
  ON backup_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 자신의 백업 설정만 업데이트 가능
CREATE POLICY "Users can update their own backup settings"
  ON backup_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 자신의 백업 설정만 삭제 가능
CREATE POLICY "Users can delete their own backup settings"
  ON backup_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_backup_settings_user_id ON backup_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_settings_enabled ON backup_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_backup_settings_next_backup_at ON backup_settings(next_backup_at);

-- 백업 이력 테이블 생성
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 백업 타입 (manual, automatic)
  backup_type VARCHAR(20) DEFAULT 'manual',
  
  -- 백업 파일명
  file_name TEXT NOT NULL,
  
  -- 구글 드라이브 파일 ID
  google_drive_file_id TEXT,
  
  -- 구글 드라이브 파일 링크
  google_drive_file_link TEXT,
  
  -- 백업 크기 (bytes)
  file_size BIGINT,
  
  -- 백업 통계
  total_tables INTEGER,
  total_records INTEGER,
  
  -- 백업 상태 (success, failed, in_progress)
  status VARCHAR(20) DEFAULT 'in_progress',
  
  -- 오류 메시지 (실패 시)
  error_message TEXT,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- 자신의 백업 이력만 조회 가능
CREATE POLICY "Users can view their own backup history"
  ON backup_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- 자신의 백업 이력만 삽입 가능
CREATE POLICY "Users can insert their own backup history"
  ON backup_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_backup_history_user_id ON backup_history(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_backup_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_update_backup_settings_updated_at
  BEFORE UPDATE ON backup_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_backup_settings_updated_at();

