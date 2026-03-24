import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Stack, Button, TextField, CircularProgress,
  Alert, Divider, Chip, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { Link as LinkIcon, Sync as SyncIcon, Delete as DeleteIcon, Save as SaveIcon, CheckCircle as CheckCircleIcon, Store as StoreIcon } from '@mui/icons-material';
import { getCafe24Malls, addCafe24Mall, deleteCafe24Mall, openCafe24AuthPopup, exchangeCafe24Code, syncCafe24Posts, updateCafe24BoardNo } from '../../utils/cafe24Api';

const REDIRECT_URI = window.location.origin + '/cafe24-callback.html';

function Cafe24Settings() {
  const [malls, setMalls] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [newMallId, setNewMallId] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newClientSecret, setNewClientSecret] = useState('');
  
  const [msg, setMsg] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activePopupMall, setActivePopupMall] = useState(null);

  const loadMalls = async () => {
    setLoading(true);
    try {
      const res = await getCafe24Malls();
      if (res.success) setMalls(res.malls || []);
    } catch (e) {
      setMsg({ type: 'error', text: '목록 조회 실패: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMalls(); }, []);

  const handleAddMall = async () => {
    if (!newMallId || !newClientId || !newClientSecret) {
      setMsg({ type: 'warning', text: '모든 항목을 기입해주세요.' });
      return;
    }
    setMsg(null);
    try {
      await addCafe24Mall({ mall_id: newMallId, client_id: newClientId, client_secret: newClientSecret });
      setMsg({ type: 'success', text: `${newMallId} 쇼핑몰이 추가되었습니다.` });
      setNewMallId(''); setNewClientId(''); setNewClientSecret('');
      loadMalls();
    } catch(e) { setMsg({ type: 'error', text: e.message }); }
  };

  const handleDeleteMall = async (mallId) => {
    if(!window.confirm(`정말 ${mallId} 쇼핑몰을 삭제하시겠습니까?`)) return;
    try {
      await deleteCafe24Mall(mallId);
      setMsg({ type: 'success', text: `${mallId} 삭제 완료` });
      loadMalls();
    } catch(e) { setMsg({ type: 'error', text: e.message }); }
  };

  const handleConnect = (mall) => {
    setActivePopupMall(mall.mall_id);
    const popup = openCafe24AuthPopup({ mallId: mall.mall_id, clientId: mall.client_id, redirectUri: REDIRECT_URI });
    
    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'CAFE24_AUTH_CODE') {
        window.removeEventListener('message', handleMessage);
        try {
          await exchangeCafe24Code({ code: event.data.code, redirectUri: REDIRECT_URI, mallId: mall.mall_id });
          setMsg({ type: 'success', text: `${mall.mall_id} 계정 연동 성공!` });
          loadMalls();
        } catch(e) { setMsg({ type: 'error', text: e.message }); }
      }
    };
    window.addEventListener('message', handleMessage);

    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        window.removeEventListener('message', handleMessage);
      }
    }, 1000);
  };

  const handleBoardUpdate = async (mallId, newBoardNo) => {
    try {
      await updateCafe24BoardNo(mallId, newBoardNo);
      setMsg({ type: 'success', text: `${mallId} 게시판 번호가 업데이트되었습니다.` });
      loadMalls();
    } catch(e) { setMsg({ type: 'error', text: e.message }); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      let finalMsg = '';
      for (const mall of malls) {
        if (!mall.connected) continue;
        try {
          const res = await syncCafe24Posts(mall.mall_id, mall.board_no || 1);
          finalMsg += `[${mall.mall_id}] ${res.message}\n`;
        } catch(e) { finalMsg += `[${mall.mall_id}] 오류: ${e.message}\n`; }
      }
      setMsg({ type: 'info', text: finalMsg || '연동된 쇼핑몰이 없습니다.' });
      loadMalls();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setSyncing(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>🛒 다중 카페24 게시판 연동 관리</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        여러 개의 카페24 쇼핑몰을 등록하고 각 쇼핑몰의 상품/게시판을 CRM 한 곳에서 관리하세요.
      </Typography>

      {msg && <Alert severity={msg.type} sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>{msg.text}</Alert>}

      <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>➕ 신규 쇼핑몰 등록하기</Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField size="small" label="Mall ID" value={newMallId} onChange={e=>setNewMallId(e.target.value)} sx={{ flex: 1 }}/>
          <TextField size="small" label="Client ID" value={newClientId} onChange={e=>setNewClientId(e.target.value)} sx={{ flex: 2 }}/>
          <TextField size="small" label="Client Secret" type="password" value={newClientSecret} onChange={e=>setNewClientSecret(e.target.value)} sx={{ flex: 2 }}/>
        </Stack>
        <Button variant="contained" disableElevation onClick={handleAddMall}>쇼핑몰 추가</Button>
      </Paper>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>📋 등록된 쇼핑몰 목록</Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
             <TableRow>
               <TableCell width="20%">쇼핑몰 아이디</TableCell>
               <TableCell width="15%">연동 상태</TableCell>
               <TableCell width="25%">동기화할 게시판 번호</TableCell>
               <TableCell width="20%">마지막 동기화</TableCell>
               <TableCell width="20%">관리</TableCell>
             </TableRow>
          </TableHead>
          <TableBody>
            {malls.map(mall => (
              <TableRow key={mall.mall_id}>
                <TableCell sx={{ fontWeight: 600 }}>{mall.mall_id}</TableCell>
                <TableCell>
                  {mall.connected ? <Chip label="설정됨" color="success" size="small"/> : <Chip label="미설정/만료" color="error" size="small"/>}
                </TableCell>
                <TableCell>
                  <TextField 
                    size="small" 
                    defaultValue={mall.board_no || ''} 
                    onBlur={(e)=>handleBoardUpdate(mall.mall_id, e.target.value)} 
                    placeholder="예: 6,9"
                    variant="standard"
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {mall.last_synced_at ? new Date(mall.last_synced_at).toLocaleString('ko-KR') : '-'}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button 
                      size="small" 
                      variant={mall.connected ? "outlined" : "contained"} 
                      onClick={()=>handleConnect(mall)}
                      color={mall.connected ? "primary" : "secondary"}
                    >
                      {mall.connected ? "재인증" : "연동하기"}
                    </Button>
                    <IconButton size="small" onClick={()=>handleDeleteMall(mall.mall_id)} color="error"><DeleteIcon fontSize="small"/></IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {malls.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color:'text.secondary' }}>등록된 쇼핑몰이 없습니다.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {malls.length > 0 && (
         <Button 
           variant="contained" 
           size="large" 
           startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />} 
           onClick={handleSyncAll}
           disabled={syncing || !malls.some(m=>m.connected)}
           sx={{ width: '100%', py: 1.5 }}
         >
           전체 쇼핑몰 게시판 동기화 실행
         </Button>
      )}

    </Box>
  );
}

export default Cafe24Settings;
