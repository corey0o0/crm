-- 007_customers_rls.sql
-- customers 테이블 RLS 잠금 (2026-08-05)
--
-- 문제: anon 키만으로 로그인 없이 customers 전체(31건, 이름·연락처·주소)가 읽혔다.
--       anon 키는 프론트 번들과 공개 GitHub 리포에 노출돼 있으므로 사실상 전면 공개 상태였다.
--
--       변경 전 정책 3개는 전부 roles={public} 이었다. 이름에 "authenticated" 가
--       들어 있지만 TO 절이 빠져 anon 까지 포함됐다 — 읽기뿐 아니라
--       INSERT/UPDATE 도 외부에서 가능한 상태였다.
--         "Enable read access for all users"            SELECT public USING true
--         "Enable insert access for authenticated users" INSERT public
--         "Enable update access for authenticated users" UPDATE public USING true
--
--       DELETE 정책은 없었다. RLS 가 켜져 있었다면 앱의 고객 삭제
--       (CustomerList.jsx:623,630)가 조용히 실패하고 있었다는 뜻이며,
--       이 마이그레이션이 그 동작을 정상화한다.
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
--
-- ---------------------------------------------------------------------------
-- 롤백 (문제가 생기면 이것만 실행하면 즉시 원복된다)
--
-- 로그인/세션에는 영향이 없다. Supabase 는 인증(GoTrue)과 DB(PostgREST)가 분리돼
-- 있어 테이블 정책으로 토큰이 무효화되지 않는다. 코드에도 쿼리 에러 시 자동
-- 로그아웃시키는 경로가 없다 (signOut() 은 Layout.jsx 의 로그아웃 버튼 1곳뿐).
-- 최악의 경우 증상은 "고객 목록이 빈 화면" 이고, 아래로 되돌린다.
--
-- 아래는 변경 전 정책 3개를 그대로 복원한다 (2026-08-05 스냅샷 기준).
-- 원본은 전부 roles={public} 이었다 — TO 절이 빠져 anon 까지 포함된 상태였다.
--
--   DROP POLICY IF EXISTS customers_select_authenticated ON public.customers;
--   DROP POLICY IF EXISTS customers_insert_authenticated ON public.customers;
--   DROP POLICY IF EXISTS customers_update_authenticated ON public.customers;
--   DROP POLICY IF EXISTS customers_delete_authenticated ON public.customers;
--
--   CREATE POLICY "Enable read access for all users"
--     ON public.customers FOR SELECT USING (true);
--   CREATE POLICY "Enable insert access for authenticated users"
--     ON public.customers FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Enable update access for authenticated users"
--     ON public.customers FOR UPDATE USING (true);
--   -- DELETE 정책은 원래 없었다
--
-- 주의: 위 롤백은 유출 상태로 되돌리는 것이다. 임시 조치로만 쓰고 원인을 찾을 것.
--       (INSERT/UPDATE 의 with_check 는 스냅샷에서 조회하지 않아 true 로 가정했다)
-- ---------------------------------------------------------------------------
