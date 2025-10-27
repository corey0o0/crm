-- A/S 서비스별 업로드 파일 정보를 저장하는 테이블 생성
CREATE TABLE IF NOT EXISTS service_files (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  file_id VARCHAR(255) NOT NULL,  -- Google Drive 파일 ID
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT,  -- 바이트 단위
  file_type VARCHAR(100),  -- MIME type
  web_view_link TEXT,  -- Google Drive 미리보기 링크
  web_content_link TEXT,  -- Google Drive 다운로드 링크
  upload_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_service_files_service_id ON service_files(service_id);
CREATE INDEX IF NOT EXISTS idx_service_files_file_id ON service_files(file_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE service_files ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 작업 가능
CREATE POLICY "Enable all operations for authenticated users" 
ON service_files 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 테이블 주석
COMMENT ON TABLE service_files IS 'A/S 서비스별 업로드된 파일 정보 (Google Drive)';
COMMENT ON COLUMN service_files.service_id IS '연결된 A/S 서비스 ID';
COMMENT ON COLUMN service_files.file_id IS 'Google Drive 파일 ID';
COMMENT ON COLUMN service_files.file_name IS '파일명';
COMMENT ON COLUMN service_files.file_size IS '파일 크기 (바이트)';
COMMENT ON COLUMN service_files.file_type IS 'MIME 타입 (예: image/jpeg, application/pdf)';
COMMENT ON COLUMN service_files.web_view_link IS 'Google Drive 미리보기 링크';
COMMENT ON COLUMN service_files.web_content_link IS 'Google Drive 다운로드 링크';
COMMENT ON COLUMN service_files.upload_date IS '파일 업로드 시간';

-- 테이블 생성 확인
SELECT 'service_files 테이블이 성공적으로 생성되었습니다.' AS result;

