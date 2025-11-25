-- 목적: auth.* 호출이 매 행마다 재평가되는 정책을 업데이트하여 Supabase lint 경고(auth_rls_initplan)를 제거하고
--       정책을 명시적인 역할 대상(TO ...)으로 제한해 불필요한 중복 평가를 막는다.

-- 1) 중복된 다국어 정책 제거 (user_memos)
DO $$
BEGIN
  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_memos'
     AND policyname = '사용자는 자신의 메모만 볼 수 있음';
  IF FOUND THEN
    EXECUTE 'DROP POLICY "사용자는 자신의 메모만 볼 수 있음" ON public.user_memos';
  END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_memos'
     AND policyname = '사용자는 자신의 메모만 생성할 수 있음';
  IF FOUND THEN
    EXECUTE 'DROP POLICY "사용자는 자신의 메모만 생성할 수 있음" ON public.user_memos';
  END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_memos'
     AND policyname = '사용자는 자신의 메모만 수정할 수 있음';
  IF FOUND THEN
    EXECUTE 'DROP POLICY "사용자는 자신의 메모만 수정할 수 있음" ON public.user_memos';
  END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_memos'
     AND policyname = '사용자는 자신의 메모만 삭제할 수 있음';
  IF FOUND THEN
    EXECUTE 'DROP POLICY "사용자는 자신의 메모만 삭제할 수 있음" ON public.user_memos';
  END IF;
END $$;

-- 2) 정책 헬퍼 함수 정의
CREATE OR REPLACE FUNCTION public._adjust_policy_initplan(
  schema_name text,
  table_name text,
  policy_name text,
  target_roles text,
  using_expr text,
  check_expr text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = schema_name
      AND tablename = table_name
      AND policyname = policy_name
  ) THEN
    RETURN;
  END IF;

  IF target_roles IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON %I.%I TO %s', policy_name, schema_name, table_name, target_roles);
  END IF;

  IF using_expr IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', policy_name, schema_name, table_name, using_expr);
  END IF;

  IF check_expr IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', policy_name, schema_name, table_name, check_expr);
  END IF;
END;
$$;

-- 3) 정책별 업데이트
SELECT public._adjust_policy_initplan('public','parts','Enable insert access for authenticated users','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','parts','Enable update access for authenticated users','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','service_parts','Enable insert access for authenticated users','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','service_parts','Enable update access for authenticated users','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','service_parts','Enable delete access for authenticated users','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','user_memos','Users can view their own memos','authenticated','(select auth.uid()) = user_id',NULL);
SELECT public._adjust_policy_initplan('public','user_memos','Users can insert their own memos','authenticated',NULL,'(select auth.uid()) = user_id');
SELECT public._adjust_policy_initplan('public','user_memos','Users can update their own memos','authenticated','(select auth.uid()) = user_id','(select auth.uid()) = user_id');
SELECT public._adjust_policy_initplan('public','user_memos','Users can delete their own memos','authenticated','(select auth.uid()) = user_id',NULL);
SELECT public._adjust_policy_initplan('public','stock_logs','Enable insert access for authenticated users','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','shipment_parts','Allow insert for authenticated users only','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','shipment_parts','Allow update for authenticated users only','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','shipment_parts','Allow delete for authenticated users only','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','brand_settings','Allow insert for authenticated users only','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','brand_settings','Allow update for authenticated users only','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','brand_settings','Allow delete for authenticated users only','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','inventory_logs','Allow insert for authenticated users only','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','service_files','Enable all operations for authenticated users','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','pending_orders','Allow authenticated users to insert pending_orders','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','pending_orders','Allow authenticated users to update pending_orders','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','pending_orders','Allow authenticated users to delete pending_orders','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','pending_order_items','Allow authenticated users to insert pending_order_items','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','pending_order_items','Allow authenticated users to update pending_order_items','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','pending_order_items','Allow authenticated users to delete pending_order_items','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','order_processing_logs','Allow authenticated users to insert order_processing_logs','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','order_processing_logs','Allow authenticated users to update order_processing_logs','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','boxes','Allow authenticated users to insert boxes','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','boxes','Allow authenticated users to update boxes','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','boxes','Allow authenticated users to delete boxes','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','box_items','Allow authenticated users to insert box_items','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','box_items','Allow authenticated users to update box_items','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','box_items','Allow authenticated users to delete box_items','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','box_audit_logs','Allow authenticated users to insert box_audit_logs','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','board_posts','board_posts_insert_auth','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','board_posts','board_posts_update_auth','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','board_posts','board_posts_delete_auth','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','products','Allow authenticated users to insert','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','products','Allow authenticated users to update','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','products','Allow authenticated users to delete','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','products','Allow authenticated users to manage products','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','warehouses','Enable all operations for authenticated users','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','dealers','Enable all operations for authenticated users','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','transactions','Enable all operations for authenticated users','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','inventory','Enable all operations for authenticated users','authenticated','(select auth.role()) = ''authenticated''',NULL);
SELECT public._adjust_policy_initplan('public','model_settings','Allow authenticated users to insert','authenticated',NULL,'(select auth.role()) = ''authenticated''');
SELECT public._adjust_policy_initplan('public','model_settings','Allow authenticated users to update','authenticated','(select auth.role()) = ''authenticated''','(select auth.role()) = ''authenticated''');

-- 4) 헬퍼 함수 정리
DROP FUNCTION public._adjust_policy_initplan(
  schema_name text,
  table_name text,
  policy_name text,
  target_roles text,
  using_expr text,
  check_expr text
);

