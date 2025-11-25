-- 목적: lint 경고(unindexed_foreign_keys) 해소를 위해 FK 컬럼 인덱스 생성

-- service_parts.service_id
DO $$
BEGIN
  IF to_regclass('public.service_parts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'service_parts'
         AND indexname = 'service_parts_service_id_idx'
     ) THEN
    EXECUTE 'CREATE INDEX service_parts_service_id_idx ON public.service_parts(service_id)';
  END IF;
END $$;

-- service_parts.part_id
DO $$
BEGIN
  IF to_regclass('public.service_parts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'service_parts'
         AND indexname = 'service_parts_part_id_idx'
     ) THEN
    EXECUTE 'CREATE INDEX service_parts_part_id_idx ON public.service_parts(part_id)';
  END IF;
END $$;

-- shared_memos.updated_by
DO $$
BEGIN
  IF to_regclass('public.shared_memos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'shared_memos'
         AND indexname = 'shared_memos_updated_by_idx'
     ) THEN
    EXECUTE 'CREATE INDEX shared_memos_updated_by_idx ON public.shared_memos(updated_by)';
  END IF;
END $$;

-- user_roles.role_id
DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
         AND tablename = 'user_roles'
         AND indexname = 'user_roles_role_id_idx'
     ) THEN
    EXECUTE 'CREATE INDEX user_roles_role_id_idx ON public.user_roles(role_id)';
  END IF;
END $$;
