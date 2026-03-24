import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Alert, Stack, Divider,
  CircularProgress, Chip, Switch, FormControlLabel, IconButton, Tooltip,
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Sync as SyncIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { getCafe24Status, openCafe24AuthPopup, exchangeCafe24Code, syncCafe24Posts, getCafe24Boards, getCafe24Config } from '../../utils/cafe24Api';

const REDIRECT_URI = `${window.location.origin}/cafe24-callback.html`;

function Cafe24Settings() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [boards, setBoards] = useState([]);

  // 폼 상태
  const [boardNo, setBoardNo] = useState('1');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState(null);

  // 저장된 설정 불러오기
  const loadSettings = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const storedBoardNo = localStorage.getItem('cafe24_board_no');
      if (storedBoardNo) {
        setBoardNo(storedBoardNo);
      }

      const s = await getCafe24Status();
      setStatus(s);
    } catch (e) {
      setStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 설정 저장 (보드 번호만 로컬에 저장)
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      localStorage.setItem('cafe24_board_no', boardNo);
      setSaveMsg({ type: 'success', text: '게시판 번호가 기기에 저장되었습니다.' });
    } catch (e) {
      setSaveMsg({ type: 'error', text: `저장 실패: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  // 카페24 OAuth 연동 팝업
  const handleConnect = async () => {
    setConnecting(true);
    setConnectMsg(null);

    const config = await getCafe24Config();
    if (!config.mall_id || !config.client_id) {
      setConnectMsg({ type: 'error', text: '서버 .env에 카페24 설정(CAFE24_MALL_ID, CAFE24_CLIENT_ID)이 누락되어 있습니다.' });
      setConnecting(false);
      return;
    }

    const popup = openCafe24AuthPopup({
      mallId: config.mall_id,
      clientId: config.client_id,
      redirectUri: REDIRECT_URI
    });

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'CAFE24_AUTH_CODE') {
        window.removeEventListener('message', handleMessage);
        try {
          await exchangeCafe24Code({
            code: event.data.code,
            redirectUri: REDIRECT_URI
          });
          setConnectMsg({ type: 'success', text: '카페24 연동 성공! 이제 게시글을 동기화할 수 있습니다.' });
          await loadSettings();
          // 게시판 목록도 가져오기
          try {
            const { boards: b } = await getCafe24Boards();
            setBoards(b || []);
          } catch {}
        } catch (err) {
          setConnectMsg({ type: 'error', text: err.message });
        } finally {
          setConnecting(false);
        }
      } else if (event.data?.type === 'CAFE24_AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        setConnectMsg({ type: 'error', text: `인증 거부됨: ${event.data.error}` });
        setConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // 팝업 닫힘 감지
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        window.removeEventListener('message', handleMessage);
        if (connecting) {
          setConnecting(false);
        }
      }
    }, 1000);
  };

  // 게시글 동기화
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncCafe24Posts(boardNo);
      setSyncResult({ type: 'success', text: result.message });
      await loadSettings();
    } catch (e) {
      setSyncResult({ type: 'error', text: e.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loadingStatus) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
        🛒 카페24 게시판 연동
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        카페24 쇼핑몰의 게시판(Q&amp;A, 고객문의 등) 게시글을 CRM에서 통합 관리합니다.
      </Typography>

      {/* 연동 상태 */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          {status?.connected ? (
            <CheckCircleIcon color="success" />
          ) : (
            <LinkOffIcon color="disabled" />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {status?.connected ? '연동됨' : '연동되지 않음'}
            </Typography>
            {status?.connected && (
              <Typography variant="body2" color="text.secondary">
                쇼핑몰: <b>{status.mall_id}</b> · 게시판: <b>{boardNo}번</b>
                {status.last_synced_at && (
                  <> · 마지막 동기화: <b>{new Date(status.last_synced_at).toLocaleString('ko-KR')}</b></>
                )}
              </Typography>
            )}
          </Box>
          {status?.connected && (
            <Chip label="연결됨" color="success" size="small" icon={<CheckCircleIcon />} />
          )}
        </Stack>
      </Paper>

      {/* 설정 입력 */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
          🔑 API 설정
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <b>카페24 연동 보안 설정 알림:</b><br />
            현재 카페24 앱 자격 증명(Client ID, Secret Key, Mall ID)은 서버의 안전한 <code>.env</code> 파일로 관리되고 있습니다.<br />
            하단의 <b>카페24 연결하기</b> 버튼을 클릭하여 본인 쇼핑몰 아이디로 로그인 해 권한을 승인해 주시면 연동이 즉시 완료됩니다.
          </Typography>
        </Alert>

        <Stack spacing={2}>
          <TextField
            label="동기화할 게시판 번호 (쉼표로 구분)"
            type="text"
            value={boardNo}
            onChange={(e) => setBoardNo(e.target.value)}
            helperText="여러 게시판 조회 시 쉼표로 구분 (예: 6,9)"
            fullWidth
            size="small"
          />

          {saveMsg && (
            <Alert severity={saveMsg.type}>{saveMsg.text}</Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={handleSaveSettings}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              설정 저장
            </Button>
            <Button
              variant="contained"
              startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
              onClick={handleConnect}
              disabled={connecting}
            >
              {status?.connected ? '재연동하기' : '카페24 연결하기'}
            </Button>
          </Stack>

          {connectMsg && (
            <Alert severity={connectMsg.type}>{connectMsg.text}</Alert>
          )}
        </Stack>
      </Paper>

      {/* 동기화 */}
      {status?.connected && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            🔄 게시글 동기화
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            카페24 게시판의 최근 게시글을 CRM 게시판으로 가져옵니다. 이미 가져온 게시글은 자동으로 업데이트됩니다.
          </Typography>

          {syncResult && (
            <Alert severity={syncResult.type} sx={{ mb: 2 }}>{syncResult.text}</Alert>
          )}

          <Button
            variant="contained"
            color="primary"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? '동기화 중...' : '지금 동기화'}
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default Cafe24Settings;
