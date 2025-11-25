-- 목적: Supabase lint에서 보고된 공개 테이블 RLS 미적용 오류 해결
-- 전략: 필요한 테이블에 RLS를 강제 활성화하고, 기존 동작을 유지할 최소 정책을 생성

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'shared_memos',
    'receipts',
    'receipt_items',
    'product_shipments',
    'shipments',
    'sales_statistics',
    'roles',
    'role_permissions',
    'user_roles',
    'service_tags'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

-- 업무 데이터 테이블: 인증 사용자에게 기존과 동일한 CRUD 허용
DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'receipts',
    'receipt_items',
    'product_shipments',
    'shipments',
    'sales_statistics',
    'service_tags'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = table_name
    ) THEN
      policy_name := table_name || '_select_authenticated';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
          policy_name,
          table_name
        );
      END IF;

      policy_name := table_name || '_insert_authenticated';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
          policy_name,
          table_name
        );
      END IF;

      policy_name := table_name || '_update_authenticated';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
          policy_name,
          table_name
        );
      END IF;

      policy_name := table_name || '_delete_authenticated';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
          policy_name,
          table_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- 역할 관련 테이블: 조회는 인증 사용자, 변경은 service_role 전용
DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'roles',
    'role_permissions',
    'user_roles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = table_name
    ) THEN
      policy_name := table_name || '_select_authenticated';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
          policy_name,
          table_name
        );
      END IF;

      policy_name := table_name || '_insert_service_role';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO service_role WITH CHECK (true)',
          policy_name,
          table_name
        );
      END IF;

      policy_name := table_name || '_update_service_role';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO service_role USING (true) WITH CHECK (true)',
          policy_name,
          table_name
        );
      END IF;

      policy_name := table_name || '_delete_service_role';
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO service_role USING (true)',
          policy_name,
          table_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;

