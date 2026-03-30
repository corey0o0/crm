import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    // 에러 상태와 세부 정보를 저장
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 렌더링 단계에서 하위 컴포넌트가 에러를 던지면 이 메서드가 상태를 업데이트합니다.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 에러 리포팅 또는 로깅 로직
    console.error('ErrorBoundary가 에러를 잡았습니다:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // 단순 강력 새로고침
    window.location.reload(true);
  };

  handleClearCache = () => {
    // 로컬/세션 스토리지 초기화 후 새로고침
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload(true);
  };

  render() {
    if (this.state.hasError) {
      // 에러 시 렌더링될 Fallback UI
      return (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            p: 3
          }}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 5, 
              maxWidth: 600, 
              textAlign: 'center',
              borderRadius: 3
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom fontWeight="bold" color="text.primary">
              앱 화면 렌더링 오류
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              예기치 않은 문제로 화면을 표시할 수 없습니다. 빈 화면 대신 이 메시지가 표시됩니다.<br />
              아래 버튼을 눌러 새로고침하거나 캐시를 초기화해보세요.
            </Typography>
            
            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary" 
                size="large"
                onClick={this.handleReload}
              >
                새로고침
              </Button>
              <Button 
                variant="outlined" 
                color="error" 
                size="large"
                onClick={this.handleClearCache}
              >
                데이터 비우기 및 재시작
              </Button>
            </Box>

            {/* 디버깅 정보를 보여줌 (개발용 혹은 확인용) */}
            {this.state.error && (
              <Box sx={{ mt: 4, textAlign: 'left', bgcolor: '#f8d7da', p: 2, borderRadius: 1, overflowX: 'auto' }}>
                <Typography variant="subtitle2" color="error.dark" fontWeight="bold">
                  개발자 디버그 정보 (에러 내역):
                </Typography>
                <Typography variant="caption" component="pre" sx={{ color: '#721c24', mt: 1, whiteSpace: 'pre-wrap' }}>
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    // 에러가 없으면 자식 컴포넌트 렌더링
    return this.props.children;
  }
}

export default ErrorBoundary;
