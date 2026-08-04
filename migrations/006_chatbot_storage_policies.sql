-- [사용 안 함] chatbot 스토리지 버킷 접근 정책 (FAQ 첨부 이미지용)
--
-- FAQ 첨부 이미지 저장소를 Supabase Storage 대신 Cloudflare R2 로 바꾸면서
-- (CRM 의 다른 첨부와 동일한 경로) 이 정책은 더 이상 쓰이지 않는다.
-- 이미 실행했다면 그대로 두어도 무해하다. 기록용으로 남긴다.
--
-- 실행: Supabase Dashboard → SQL Editor
--
-- 버킷은 API(service_role)로 생성했는데, service_role 은 RLS 를 우회하므로
-- 정책 없이도 서버에서는 업로드가 된다. 반면 관리자 화면은 브라우저에서
-- 로그인 사용자 권한으로 올리기 때문에 storage.objects 정책이 없으면
-- "new row violates row-level security policy" 로 실패한다.
--
-- 읽기: 버킷이 public 이라 공개 URL 은 정책 없이도 열린다(네이버 톡톡이 이 URL 을 받아감).
--       아래 SELECT 정책은 관리 화면에서 목록 조회를 할 때를 위한 것.

-- 재실행해도 안전하도록 기존 정책을 먼저 정리한다
DROP POLICY IF EXISTS "chatbot_images_read"   ON storage.objects;
DROP POLICY IF EXISTS "chatbot_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_images_update" ON storage.objects;
DROP POLICY IF EXISTS "chatbot_images_delete" ON storage.objects;

CREATE POLICY "chatbot_images_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chatbot');

CREATE POLICY "chatbot_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chatbot');

CREATE POLICY "chatbot_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chatbot')
  WITH CHECK (bucket_id = 'chatbot');

CREATE POLICY "chatbot_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chatbot');
