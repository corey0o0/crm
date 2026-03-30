import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasMenuAccess } from '../../config/menuConfig';

/**
 * 간단한 이메일 기반 권한 라우트
 * DB 쿼리 없이 이메일로만 체크 (빠름!)
 */
function SimplePermissionRoute({ children, requiredKey }) {
  const { user, loading, userMenuPermissions } = useAuth();

  // 로딩 중일 때는 아무것도 렌더링하지 않음
  if (loading) {
    return null;
  }

  // 로그인하지 않은 경우
  if (!user) {
    return <Navigate to="/login" />;
  }

  // 권한 체크 (이메일 및 동적 권한 기반)
  if (requiredKey && !hasMenuAccess(user.email, requiredKey, userMenuPermissions)) {
    // 권한 없으면 대시보드로 리다이렉트
    return <Navigate to="/" />;
  }

  // 권한이 있으면 자식 컴포넌트 렌더링
  return children;
}

export default SimplePermissionRoute;

