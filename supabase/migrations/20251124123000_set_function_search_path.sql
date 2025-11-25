-- 목적: Supabase lint의 function_search_path_mutable 경고를 해결하기 위해
--       public 스키마의 트리거/유틸 함수에 안전한 search_path를 설정한다.

DO $$
DECLARE
  fn_name text;
  proc_signature regprocedure;
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[
    'update_service_files_updated_at',
    'update_user_memos_updated_at',
    'update_shared_memos_updated_at',
    'prevent_multiple_shared_memos',
    'add_service_parts',
    'set_timestamp',
    'update_pending_orders_updated_at',
    'update_pending_order_items_updated_at',
    'update_boxes_updated_at',
    'update_box_items_updated_at'
  ]
  LOOP
    FOR proc_signature IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
    LOOP
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, pg_temp',
        proc_signature
      );
    END LOOP;
  END LOOP;
END $$;

