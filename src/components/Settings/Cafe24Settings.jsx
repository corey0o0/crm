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
import { supabase } from '../../lib/supabaseClient';
import { getCafe24Status, openCafe24AuthPopup, exchangeCafe24Code, syncCafe24Posts, getCafe24Boards } from '../../utils/cafe24Api';

const REDIRECT_URI = `${window.location.origin}/cafe24-callback.html`;

function Cafe24Settings() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [boards, setBoards] = useState([]);

  // 폼 상태
  const [mallId, setMallId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [boardNo, setBoardNo] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState(null);

  // 저장된 설정 불러오기
  const loadSettings = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data } = await supabase
        .from('cafe24_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setMallId(data.mall_id || '');
        setClientId(data.client_id || '');
        setClientSecret(data.client_secret_encrypted || '');
        setBoardNo(data.board_no || 1);
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

  // 설정 저장 (토큰 없이 mall_id, client_id만)
  const handleSaveSettings = async () => {
    if (!mallId.trim() || !clientId.trim() || !clientSecret.trim()) {
      setSaveMsg({ type: 'error', text: '쇼핑몰 아이디, Client ID, Secret Key를 모두 입력해주세요.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data: existing } = await supabase
        .from('cafe24_settings')
        .select('id')
        .eq('mall_id', mallId.trim())
        .single();

      if (existing?.id) {
        await supabase
          .from('cafe24_settings')
          .update({
            client_id: clientId.trim(),
            client_secret_encrypted: clientSecret.trim(),
            board_no: boardNo,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cafe24_settings')
          .insert({
            mall_id: mallId.trim(),
            client_id: clientId.trim(),
            client_secret_encrypted: clientSecret.trim(),
            board_no: boardNo,
          });
      }

      setSaveMsg({ type: 'success', text: '설정이 저장되었습니다.' });
    } catch (e) {
      setSaveMsg({ type: 'error', text: `저장 실패: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  // 카페24 OAuth 연동 팝업
  const handleConnect = () => {
    if (!mallId.trim() || !clientId.trim() || !clientSecret.trim()) {
      setConnectMsg({ type: 'error', text: '먼저 설정을 저장해주세요.' });
      return;
    }

    setConnecting(true);
    setConnectMsg(null);

    const popup = openCafe24AuthPopup({
      mallId: mallId.trim(),
      clientId: clientId.trim(),
      redirectUri: REDIRECT_URI
    });

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'CAFE24_AUTH_CODE') {
        window.removeEventListener('message', handleMessage);
        try {
          await exchangeCafe24Code({
            code: event.data.code,
            mallId: mallId.trim(),
            clientId: clientId.trim(),
            clientSecret: clientSecret.trim(),
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
                쇼핑몰: <b>{status.mall_id}</b> · 게시판: <b>{status.board_no}번</b>
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
            <b>카페24 개발자센터</b>에서 앱을 생성하고 Client ID와 Secret Key를 발급받으세요.
            {' '}<Button size="small" endIcon={<OpenInNewIcon fontSize="small" />}
              onClick={() => window.open('https://developers.cafe24.com', '_blank')}>
              개발자센터 바로가기
            </Button>
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            앱 등록 시 Redirect URI에 <code>{REDIRECT_URI}</code> 를 추가해주세요.
          </Typography>
        </Alert>

        <Stack spacing={2}>
          <TextField
            label="카페24 쇼핑몰 아이디"
            placeholder="예: myshop (myshop.cafe24.com에서 myshop)"
            value={mallId}
            onChange={(e) => setMallId(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Secret Key"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="동기화할 게시판 번호"
            type="number"
            value={boardNo}
            onChange={(e) => setBoardNo(Number(e.target.value))}
            helperText="카페24 관리자 > 게시판 관리에서 번호 확인"
            inputProps={{ min: 1 }}
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
