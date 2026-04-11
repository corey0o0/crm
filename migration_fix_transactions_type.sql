-- 출고(UUID)와 A/S(BigInt) 아이디를 모두 충돌 없이 담기 위해 컬럼 타입을 text로 변경합니다.
ALTER TABLE public.transactions ALTER COLUMN group_id TYPE text;

-- 재고 로그 테이블도 마찬가지로 타입 충돌 방지를 위해 text로 변경합니다.
ALTER TABLE public.inventory_logs ALTER COLUMN reference_id TYPE text;
