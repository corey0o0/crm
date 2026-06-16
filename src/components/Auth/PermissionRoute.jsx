import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MASTER_ACCOUNTS } from '../../config/menuConfig';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';

/**
 * 권한 기반 라우트 보호 컴포넌트
 * 사용자가 특정 메뉴에 접근할 권한이 있는지 확인합니다.
 * masterOnly=true 이면 마스터 계정만 접근 가능(메뉴 권한과 무관).
 */
function PermissionRoute({ children, requiredPermission, masterOnly = false, redirectTo = '/' }) {
  const { hasPermission, loading, user } = useAuth();

  // 로딩 중일 때는 아무것도 렌더링하지 않음
  if (loading) {
    return null;
  }

  // 마스터 전용 페이지: 마스터 계정만 통과
  if (masterOnly) {
    const isMaster = !!user?.email && MASTER_ACCOUNTS.includes(user.email);
    if (!isMaster) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', p: 3 }}>
          <Paper elevation={3} sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
            <LockIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom color="error">접근 권한 없음</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              이 페이지는 마스터 관리자만 접근할 수 있습니다.
            </Typography>
            <Button variant="contained" color="primary" href={redirectTo} sx={{ mt: 2 }}>대시보드로 돌아가기</Button>
          </Paper>
        </Box>
      );
    }
    return children;
  }

  // 권한이 필요하지 않은 경우 (대시보드 등)
  if (!requiredPermission) {
    return children;
  }

  // 권한 체크 (배열인 경우 하나라도 있으면 통과, 문자열인 경우 단일 체크)
  const isAuthorized = Array.isArray(requiredPermission)
    ? requiredPermission.some(perm => hasPermission(perm))
    : hasPermission(requiredPermission);

  if (!isAuthorized) {
    // 403 접근 거부 페이지 표시
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '80vh',
          p: 3
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 500,
            textAlign: 'center'
          }}
        >
          <LockIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2
            }}
          />
          <Typography variant="h4" gutterBottom color="error">
            접근 권한 없음
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            이 페이지에 접근할 수 있는 권한이 없습니다.
            관리자에게 문의하세요.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            href={redirectTo}
            sx={{ mt: 2 }}
          >
            대시보드로 돌아가기
          </Button>
        </Paper>
      </Box>
    );
  }

  // 권한이 있으면 자식 컴포넌트 렌더링
  return children;
}

export default PermissionRoute;

