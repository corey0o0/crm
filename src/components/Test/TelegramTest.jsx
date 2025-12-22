import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import { sendTelegramNotification } from '../../lib/telegram';

const TelegramTest = () => {
  const [testMessage, setTestMessage] = useState('테스트 메시지입니다');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [envStatus, setEnvStatus] = useState(null);

  // 환경 변수 상태 확인
  const checkEnvStatus = () => {
    const status = {
      hasWindowEnv: typeof window !== 'undefined' && !!window._env_,
      windowEnvKeys: typeof window !== 'undefined' && window._env_ ? Object.keys(window._env_) : [],
      telegramToken: typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN 
        ? window._env_.REACT_APP_TELEGRAM_BOT_TOKEN.substring(0, 15) + '...' 
        : '없음',
      telegramChatId: typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_CHAT_ID 
        ? window._env_.REACT_APP_TELEGRAM_CHAT_ID 
        : '없음',
      baseUrl: typeof window !== 'undefined' && window._env_?.REACT_APP_BASE_URL 
        ? window._env_.REACT_APP_BASE_URL 
        : '없음',
      processEnvToken: process.env.REACT_APP_TELEGRAM_BOT_TOKEN ? '있음' : '없음',
      processEnvChatId: process.env.REACT_APP_TELEGRAM_CHAT_ID ? '있음' : '없음'
    };
    setEnvStatus(status);
    return status;
  };

  // 직접 API 호출 테스트
  const testDirectAPI = async () => {
    setLoading(true);
    setResult(null);

    try {
      const botToken = (typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN) 
        || process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
      const chatId = (typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_CHAT_ID) 
        || process.env.REACT_APP_TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        throw new Error('텔레그램 토큰 또는 채팅 ID가 설정되지 않았습니다.');
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text: `[직접 API 테스트] ${testMessage}`,
        parse_mode: 'HTML'
      };

      console.log('[직접 API 테스트] 요청:', { url: url.replace(botToken, 'TOKEN_HIDDEN'), payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status} - ${JSON.stringify(responseData)}`);
      }

      setResult({
        success: true,
        type: 'direct',
        message: '직접 API 호출 성공!',
        data: responseData
      });
    } catch (error) {
      console.error('[직접 API 테스트] 실패:', error);
      setResult({
        success: false,
        type: 'direct',
        message: error.message,
        error: error
      });
    } finally {
      setLoading(false);
    }
  };

  // sendTelegramNotification 함수 테스트
  const testNotificationFunction = async () => {
    setLoading(true);
    setResult(null);

    try {
      console.log('[함수 테스트] 시작');
      const response = await sendTelegramNotification({
        message: `[함수 테스트] ${testMessage}`,
        link: '/test'
      });

      console.log('[함수 테스트] 응답:', response);

      if (response.success) {
        setResult({
          success: true,
          type: 'function',
          message: 'sendTelegramNotification 함수 호출 성공!',
          data: response.data
        });
      } else {
        setResult({
          success: false,
          type: 'function',
          message: response.message || '알 수 없는 오류',
          error: response.error
        });
      }
    } catch (error) {
      console.error('[함수 테스트] 실패:', error);
      setResult({
        success: false,
        type: 'function',
        message: error.message,
        error: error
      });
    } finally {
      setLoading(false);
    }
  };

  // 봇 정보 확인
  const testBotInfo = async () => {
    setLoading(true);
    setResult(null);

    try {
      const botToken = (typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN) 
        || process.env.REACT_APP_TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        throw new Error('텔레그램 토큰이 설정되지 않았습니다.');
      }

      const url = `https://api.telegram.org/bot${botToken}/getMe`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`봇 정보 조회 실패: ${JSON.stringify(data)}`);
      }

      setResult({
        success: true,
        type: 'botInfo',
        message: '봇 정보 조회 성공!',
        data: data
      });
    } catch (error) {
      console.error('[봇 정보 테스트] 실패:', error);
      setResult({
        success: false,
        type: 'botInfo',
        message: error.message,
        error: error
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        텔레그램 API 연동 테스트
      </Typography>

      {/* 환경 변수 상태 */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          환경 변수 상태
        </Typography>
        <Button 
          variant="outlined" 
          onClick={checkEnvStatus}
          sx={{ mb: 2 }}
        >
          환경 변수 확인
        </Button>
        {envStatus && (
          <List dense>
            <ListItem>
              <ListItemText 
                primary="window._env_ 존재" 
                secondary={envStatus.hasWindowEnv ? '✅ 있음' : '❌ 없음'} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="환경 변수 키 개수" 
                secondary={envStatus.windowEnvKeys.length} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="텔레그램 토큰 (window._env_)" 
                secondary={envStatus.telegramToken} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="텔레그램 채팅 ID (window._env_)" 
                secondary={envStatus.telegramChatId} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Base URL (window._env_)" 
                secondary={envStatus.baseUrl} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="텔레그램 토큰 (process.env)" 
                secondary={envStatus.processEnvToken} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="텔레그램 채팅 ID (process.env)" 
                secondary={envStatus.processEnvChatId} 
              />
            </ListItem>
          </List>
        )}
      </Paper>

      {/* 테스트 메시지 입력 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="테스트 메시지"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={testBotInfo}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            봇 정보 확인
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={testDirectAPI}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            직접 API 호출 테스트
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={testNotificationFunction}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            함수 호출 테스트
          </Button>
        </Box>
      </Paper>

      {/* 결과 표시 */}
      {result && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            테스트 결과
          </Typography>
          <Chip
            label={result.type}
            color={result.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
          />
          <Alert 
            severity={result.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
          >
            {result.message}
          </Alert>
          {result.data && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                응답 데이터:
              </Typography>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </Box>
          )}
          {result.error && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom color="error">
                오류 상세:
              </Typography>
              <pre style={{ 
                background: '#ffebee', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {result.error.toString()}
              </pre>
            </Box>
          )}
        </Paper>
      )}

      {/* 디버깅 정보 */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: 'info.light' }}>
        <Typography variant="h6" gutterBottom>
          디버깅 정보
        </Typography>
        <Typography variant="body2" component="div">
          <strong>콘솔 확인:</strong>
          <ul>
            <li>브라우저 개발자 도구(F12) → Console 탭에서 로그 확인</li>
            <li><code>[텔레그램] 환경 변수 상태:</code> 로그 확인</li>
            <li><code>텔레그램 알림 전송 요청:</code> 로그 확인</li>
            <li><code>텔레그램 API 응답 상태:</code> 로그 확인</li>
          </ul>
          <strong>수동 확인:</strong>
          <ul>
            <li>콘솔에서 <code>window._env_</code> 실행하여 환경 변수 확인</li>
            <li>콘솔에서 <code>window._env_.REACT_APP_TELEGRAM_BOT_TOKEN</code> 실행</li>
          </ul>
        </Typography>
      </Paper>
    </Box>
  );
};

export default TelegramTest;

