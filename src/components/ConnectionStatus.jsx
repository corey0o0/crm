/**
 * 연결 상태 모니터링 컴포넌트
 * 실시간 네트워크 상태 표시 및 사용자 알림
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  Typography,
  Snackbar,
  Alert,
  Tooltip,
  IconButton,
  Badge,
  CircularProgress
} from '@mui/material';
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Sync as SyncIcon,
  SyncProblem as SyncProblemIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { getSyncStatus, getPendingChanges } from '../utils/syncUtils';

const ConnectionStatus = ({ 
  position = 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
  showDetails = true,
  onSyncClick = null 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({});
  const [pendingChanges, setPendingChanges] = useState([]);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // 연결 상태 업데이트
  const updateConnectionStatus = useCallback(() => {
    const online = navigator.onLine;
    const wasOffline = !isOnline && online;
    const wasOnline = isOnline && !online;
    
    setIsOnline(online);
    
    if (wasOffline) {
      setSnackbarMessage('인터넷 연결이 복구되었습니다. 데이터를 동기화합니다.');
      setSnackbarSeverity('success');
      setShowSnackbar(true);
      setLastSyncTime(new Date());
    } else if (wasOnline) {
      setSnackbarMessage('인터넷 연결이 끊어졌습니다. 오프라인 모드로 전환합니다.');
      setSnackbarSeverity('warning');
      setShowSnackbar(true);
    }
  }, [isOnline]);

  // 동기화 상태 업데이트
  const updateSyncStatus = useCallback(() => {
    const status = getSyncStatus();
    const changes = getPendingChanges();
    
    setSyncStatus(status);
    setPendingChanges(changes);
  }, []);

  // 상태 업데이트 주기적 실행
  useEffect(() => {
    const interval = setInterval(updateSyncStatus, 2000); // 2초마다 업데이트
    return () => clearInterval(interval);
  }, [updateSyncStatus]);

  // 연결 상태 이벤트 리스너
  useEffect(() => {
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
    };
  }, [updateConnectionStatus]);

  // 스낵바 자동 닫기
  useEffect(() => {
    if (showSnackbar) {
      const timer = setTimeout(() => {
        setShowSnackbar(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSnackbar]);

  // 상태별 아이콘 및 색상
  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOffIcon color="error" sx={{ fontSize: 24 }} />;
    }
    
    if (syncStatus.syncInProgress) {
      return <CircularProgress size={24} color="primary" />;
    }
    
    if (pendingChanges.length > 0) {
      return <SyncProblemIcon color="warning" sx={{ fontSize: 24 }} />;
    }
    
    return <WifiIcon color="success" sx={{ fontSize: 24 }} />;
  };

  // 상태별 텍스트 (아이콘만 표시하므로 빈 문자열)
  const getStatusText = () => {
    return '';
  };

  // 상태별 색상
  const getStatusColor = () => {
    if (!isOnline) {
      return 'error';
    }
    
    if (syncStatus.syncInProgress) {
      return 'primary';
    }
    
    if (pendingChanges.length > 0) {
      return 'warning';
    }
    
    return 'success';
  };

  // 위치별 스타일
  const getPositionStyle = () => {
    const baseStyle = {
      position: 'fixed',
      zIndex: 9999, // 더 높은 z-index
      padding: '8px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)', // 배경색 추가
      borderRadius: '8px', // 둥근 모서리
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)' // 그림자 추가
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyle, top: 16, right: 16 };
      case 'top-left':
        return { ...baseStyle, top: 16, left: 16 };
      case 'bottom-right':
        return { ...baseStyle, bottom: 16, right: 16 };
      case 'bottom-left':
        return { ...baseStyle, bottom: 16, left: 16 };
      default:
        return { ...baseStyle, top: 16, right: 16 };
    }
  };

  // 동기화 클릭 핸들러
  const handleSyncClick = () => {
    if (onSyncClick) {
      onSyncClick();
    } else {
      setSnackbarMessage('수동 동기화를 시작합니다...');
      setSnackbarSeverity('info');
      setShowSnackbar(true);
    }
  };

  return (
    <>
      <Box sx={getPositionStyle()}>
        <Tooltip 
          title={
            showDetails ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>연결 상태:</strong> {isOnline ? '온라인' : '오프라인'}
                </Typography>
                {isOnline && (
                  <>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>대기 중인 변경사항:</strong> {pendingChanges.length}개
                    </Typography>
                    {lastSyncTime && (
                      <Typography variant="body2">
                        <strong>마지막 동기화:</strong> {lastSyncTime.toLocaleTimeString()}
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            ) : undefined
          }
        >
          <IconButton
            onClick={isOnline && pendingChanges.length > 0 ? handleSyncClick : undefined}
            sx={{
              cursor: isOnline && pendingChanges.length > 0 ? 'pointer' : 'default',
              color: getStatusColor() === 'error' ? 'error.main' : 
                     getStatusColor() === 'warning' ? 'warning.main' : 
                     getStatusColor() === 'success' ? 'success.main' : 'primary.main',
              '&:hover': isOnline && pendingChanges.length > 0 ? {
                backgroundColor: 'action.hover'
              } : {}
            }}
          >
            {getStatusIcon()}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 상태 알림 스낵바 */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={5000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSnackbar(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ConnectionStatus;
