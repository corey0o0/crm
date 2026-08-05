-- 007_customers_rls.sql
-- customers 테이블 RLS 잠금 (2026-08-05)
--
-- 문제: anon 키만으로 로그인 없이 customers 전체(31건, 이름·연락처·주소)가 읽혔다.
--       anon 키는 프론트 번들과 공개 GitHub 리포에 노출돼 있으므로 사실상 전면 공개 상태였다.
--
-- 조치: 기존 정책을 전부 걷어내고 authenticated 에게만 허용한다.
--       - 앱의 customers 접근은 전부 로그인 뒤(App.jsx: session 없으면 /login)에 있어 영향 없음
--       - netlify 함수는 service_role 을 쓰고 service_role 은 RLS 를 우회하므로 영향 없음
--       - 공개 챗봇 위젯(public/chatbot.js)은 customers 를 쓰지 않음
--
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
--       (DDL 은 PostgREST 로 실행할 수 없어 수동 실행이 필요하다)

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 기존 정책 전부 제거 (이름을 몰라도 되도록 카탈로그에서 훑는다)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', p.policyname);
  END LOOP;
END $$;

-- 로그인한 사용자에게만 허용
CREATE POLICY customers_select_authenticated ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY customers_insert_authenticated ON public.customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY customers_update_authenticated ON public.customers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY customers_delete_authenticated ON public.customers
  FOR DELETE TO authenticated USING (true);

-- anon 에게는 어떤 정책도 주지 않는다 → RLS 기본 거부

COMMENT ON TABLE public.customers IS
  '고객 정보. RLS: authenticated 전용 (007_customers_rls.sql). anon 접근 금지 — 이름/연락처/주소 포함.';

-- 확인용: 아래를 실행하면 authenticated 4줄만 나와야 한다
--   SELECT policyname, cmd, roles::text FROM pg_policies
--   WHERE tablename = 'customers' ORDER BY cmd;
