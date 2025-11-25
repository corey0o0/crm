-- 목적: Supabase lint의 auth_rls_initplan 및 multiple_permissive_policies 경고를 해결하기 위해
--       문제 정책을 재정의하고 중복 정책을 정리한다.

-- 서비스 파일 테이블 정책 재정의
DO $$
DECLARE
  pol text;
BEGIN
  IF to_regclass('public.service_files') IS NULL THEN
    RETURN;
  END IF;

  FOREACH pol IN ARRAY ARRAY[
    'Enable all operations for authenticated users',
    'service_files_select_policy',
    'service_files_insert_policy',
    'service_files_update_policy',
    'service_files_delete_policy'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.service_files', pol);
  END LOOP;

  EXECUTE $SQL$
    CREATE POLICY service_files_select_policy ON public.service_files
      FOR SELECT TO authenticated
      USING ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY service_files_insert_policy ON public.service_files
      FOR INSERT TO authenticated
      WITH CHECK ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY service_files_update_policy ON public.service_files
      FOR UPDATE TO authenticated
      USING ((select auth.role()) = 'authenticated')
      WITH CHECK ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY service_files_delete_policy ON public.service_files
      FOR DELETE TO authenticated
      USING ((select auth.role()) = 'authenticated')
  $SQL$;
END $$;

-- 창고/딜러/거래/재고 정책 정리
DO $$
BEGIN
  IF to_regclass('public.warehouses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS warehouses_all ON public.warehouses';
    EXECUTE $SQL$
      CREATE POLICY warehouses_all ON public.warehouses
        FOR ALL TO authenticated
        USING ((select auth.role()) = 'authenticated')
        WITH CHECK ((select auth.role()) = 'authenticated')
    $SQL$;
  END IF;

  IF to_regclass('public.dealers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS dealers_all ON public.dealers';
    EXECUTE $SQL$
      CREATE POLICY dealers_all ON public.dealers
        FOR ALL TO authenticated
        USING ((select auth.role()) = 'authenticated')
        WITH CHECK ((select auth.role()) = 'authenticated')
    $SQL$;
  END IF;

  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS transactions_all ON public.transactions';
    EXECUTE $SQL$
      CREATE POLICY transactions_all ON public.transactions
        FOR ALL TO authenticated
        USING ((select auth.role()) = 'authenticated')
        WITH CHECK ((select auth.role()) = 'authenticated')
    $SQL$;
  END IF;

  IF to_regclass('public.inventory') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS inventory_all ON public.inventory';
    EXECUTE $SQL$
      CREATE POLICY inventory_all ON public.inventory
        FOR ALL TO authenticated
        USING ((select auth.role()) = 'authenticated')
        WITH CHECK ((select auth.role()) = 'authenticated')
    $SQL$;
  END IF;
END $$;

-- products 테이블 중복 정책 제거
DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Allow authenticated users to manage products'
  ) THEN
    EXECUTE 'DROP POLICY "Allow authenticated users to manage products" ON public.products';
  END IF;
END $$;

-- parts 테이블 정책 재구성
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.parts') IS NULL THEN
    RETURN;
  END IF;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'parts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.parts', pol.policyname);
  END LOOP;

  EXECUTE $SQL$
    CREATE POLICY parts_select_public ON public.parts
      FOR SELECT TO public
      USING (true)
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY parts_insert_authenticated ON public.parts
      FOR INSERT TO authenticated
      WITH CHECK ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY parts_update_authenticated ON public.parts
      FOR UPDATE TO authenticated
      USING ((select auth.role()) = 'authenticated')
      WITH CHECK ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY parts_delete_authenticated ON public.parts
      FOR DELETE TO authenticated
      USING ((select auth.role()) = 'authenticated')
  $SQL$;
END $$;

-- service_parts 테이블 정책 재구성
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.service_parts') IS NULL THEN
    RETURN;
  END IF;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_parts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.service_parts', pol.policyname);
  END LOOP;

  EXECUTE $SQL$
    CREATE POLICY service_parts_select_public ON public.service_parts
      FOR SELECT TO public
      USING (true)
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY service_parts_insert_authenticated ON public.service_parts
      FOR INSERT TO authenticated
      WITH CHECK ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY service_parts_update_authenticated ON public.service_parts
      FOR UPDATE TO authenticated
      USING ((select auth.role()) = 'authenticated')
      WITH CHECK ((select auth.role()) = 'authenticated')
  $SQL$;

  EXECUTE $SQL$
    CREATE POLICY service_parts_delete_authenticated ON public.service_parts
      FOR DELETE TO authenticated
      USING ((select auth.role()) = 'authenticated')
  $SQL$;
END $$;

