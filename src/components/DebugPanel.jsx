import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const DebugPanel = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const logCounterRef = useRef(0); // 고유 ID 생성을 위한 카운터

  // 마스터 계정만 디버그 패널 표시
  const isMasterAccount = user?.email === 'master@slimpack.com';

  useEffect(() => {
    // 마스터 계정이 아니면 로그 캡처하지 않음
    if (!isMasterAccount) {
      return;
    }
    // 콘솔 로그 캡처
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (level, args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      // 고유 ID 생성: 타임스탬프 + 카운터 + 랜덤값
      logCounterRef.current += 1;
      const logEntry = {
        id: `${Date.now()}-${logCounterRef.current}-${Math.random()}`,
        level,
        message,
        timestamp: new Date().toLocaleTimeString(),
        raw: args
      };

      // 렌더링 중 상태 업데이트 방지를 위해 비동기로 처리
      queueMicrotask(() => {
        setLogs(prev => {
          const newLogs = [logEntry, ...prev].slice(0, 100); // 최대 100개만 유지
          
          const currentErrors = newLogs.filter(log => log.level === 'error').length;
          setErrorCount(currentErrors);
          
          return newLogs;
        });
      });
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalError(...args);
      
      // ReactQuill의 findDOMNode 경고는 디버그 패널에 표시하지 않음
      try {
        const firstArg = args && args[0];
        if (typeof firstArg === 'string' && firstArg.includes('findDOMNode is deprecated')) {
          return;
        }
      } catch (_) {
        // no-op
      }
      
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    // 전역 에러 캡처
    const handleError = (event) => {
      addLog('error', [
        `[Uncaught Error] ${event.message}`,
        event.filename,
        `Line ${event.lineno}:${event.colno}`
      ]);
    };

    const handleUnhandledRejection = (event) => {
      addLog('error', [
        `[Unhandled Promise Rejection]`,
        event.reason?.message || String(event.reason)
      ]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 환경 변수 상태 확인
    const checkEnv = () => {
      if (typeof window !== 'undefined') {
        const envStatus = {
          hasWindow: typeof window !== 'undefined',
          hasEnv: !!window._env_,
          envKeys: window._env_ ? Object.keys(window._env_) : [],
          hasSupabaseUrl: !!(window._env_ && window._env_.REACT_APP_SUPABASE_URL),
          hasSupabaseKey: !!(window._env_ && window._env_.REACT_APP_SUPABASE_ANON_KEY),
          supabaseUrl: window._env_?.REACT_APP_SUPABASE_URL || '없음'
        };
        addLog('log', ['[환경 변수 상태]', JSON.stringify(envStatus, null, 2)]);
      }
    };

    // 초기 환경 변수 확인
    setTimeout(checkEnv, 1000);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isMasterAccount]);

  // 마스터 계정이 아니면 아무것도 렌더링하지 않음
  if (!isMasterAccount) {
    return null;
  }

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    return log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.level.toLowerCase().includes(filter.toLowerCase());
  });

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return 'error';
      case 'warn': return 'warning';
      default: return 'default';
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setErrorCount(0);
  };

  const toggleDrawer = () => {
    if (!open && errorCount > 0) {
      setFilter('error');
    }
    setOpen(!open);
  };

  return (
    <>
      {/* 디버그 버튼 (Layout에 포함될 것을 가정하여 인라인 렌더링) */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          mr: 1
        }}
      >
        <IconButton
          onClick={toggleDrawer}
          sx={{
            bgcolor: errorCount > 0 ? 'error.main' : 'primary.main',
            color: 'white',
            width: 36,
            height: 36,
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            '&:hover': {
              bgcolor: errorCount > 0 ? 'error.dark' : 'primary.dark',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
            },
            position: 'relative'
          }}
        >
          {errorCount > 0 ? (
            <ErrorIcon sx={{ fontSize: 20 }} />
          ) : (
            <BugReportIcon sx={{ fontSize: 20 }} />
          )}
          {errorCount > 0 && (
            <Chip
              label={errorCount}
              size="small"
              color="error"
              sx={{
                position: 'absolute',
                top: -6,
                right: -6,
                height: 16,
                minWidth: 16,
                fontSize: '0.6rem',
                fontWeight: 'bold',
                px: 0.5
              }}
            />
          )}
        </IconButton>
      </Box>

      {/* 디버그 패널 */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
            maxWidth: '90vw'
          }
        }}
      >
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 헤더 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">디버그 패널</Typography>
            <Box>
              <IconButton size="small" onClick={clearLogs} sx={{ mr: 1 }}>
                <ClearIcon />
              </IconButton>
              <IconButton size="small" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* 검색 */}
          <TextField
            size="small"
            placeholder="로그 검색..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />

          {/* 로그 목록 */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* 환경 변수 정보 (스크롤 영역 내부로 이동하여 상단 고정 해제) */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100', flexShrink: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>환경 변수 상태</Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                {typeof window !== 'undefined' && window._env_
                  ? JSON.stringify({
                    keys: Object.keys(window._env_),
                    hasSupabaseUrl: !!window._env_.REACT_APP_SUPABASE_URL,
                    hasSupabaseKey: !!window._env_.REACT_APP_SUPABASE_ANON_KEY,
                    supabaseUrl: window._env_.REACT_APP_SUPABASE_URL?.substring(0, 30) + '...' || '없음'
                  }, null, 2)
                  : '환경 변수 없음'}
              </Typography>
            </Paper>

            <List dense>
              {filteredLogs.length === 0 ? (
                <ListItem>
                  <ListItemText primary="로그가 없습니다" />
                </ListItem>
              ) : (
                filteredLogs.map((log) => (
                  <ListItem key={log.id} sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Chip
                        label={log.level}
                        size="small"
                        color={getLogColor(log.level)}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {log.timestamp}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        bgcolor: log.level === 'error' ? 'error.light' :
                          log.level === 'warn' ? 'warning.light' : 'grey.50',
                        p: 1,
                        borderRadius: 1,
                        overflow: 'auto',
                        maxHeight: 200
                      }}
                    >
                      {log.message}
                    </Typography>
                  </ListItem>
                ))
              )}
            </List>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default DebugPanel;

