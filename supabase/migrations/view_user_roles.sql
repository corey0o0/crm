-- 모든 사용자의 역할 조회 스크립트
-- 
-- 사용 방법:
-- Supabase Dashboard > SQL Editor에서 실행하면
-- 모든 사용자와 그들의 역할을 확인할 수 있습니다.

-- ============================================
-- 모든 사용자와 역할 조회
-- ============================================

SELECT 
  u.email AS "이메일",
  u.created_at AS "가입일",
  COALESCE(STRING_AGG(r.name, ', '), '역할 없음') AS "할당된 역할",
  u.id AS "사용자 ID"
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.email, u.created_at, u.id
ORDER BY u.created_at DESC;

