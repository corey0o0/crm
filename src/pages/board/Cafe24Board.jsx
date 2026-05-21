import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Chip,
  Alert, Stack
} from '@mui/material';
import { Sync as SyncIcon, Store as StoreIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { safeRetry, isOffline } from '../../utils/networkUtils';
import { syncCafe24Posts, getCafe24Malls } from '../../utils/cafe24Api';

function Cafe24Board() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [cafe24Malls, setCafe24Malls] = useState([]);
  const [autoSynced, setAutoSynced] = useState(false);
  const navigate = useNavigate();

  const fetchPosts = useCallback(async () => {
    try {
      if (isOffline()) { setLoading(false); return; }
      setLoading(true);

      const { data, error } = await safeRetry(async () =>
        supabase
          .from('board_posts')
          .select('*')
          .eq('source', 'cafe24')
          .order('created_at', { ascending: false }),
        { maxRetries: 3, maxTime: 30000, baseDelay: 1000 }
      );

      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      console.error('카페24 게시글 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    getCafe24Malls().then(res => {
      if (res.success) setCafe24Malls(res.malls || []);
    }).catch(() => {});
  }, [fetchPosts]);

  // 최초 진입 시 백그라운드 자동 동기화
  useEffect(() => {
    const activeMalls = cafe24Malls.filter(m => m.connected);
    if (activeMalls.length > 0 && !autoSynced) {
      setAutoSynced(true);
      const runAutoSync = async () => {
        try {
          for (const m of activeMalls) {
            await syncCafe24Posts(m.mall_id, m.board_no || 1);
          }
          fetchPosts();
        } catch (e) {
          console.error('[Auto Sync Error]', e);
        }
      };
      runAutoSync();
    }
  }, [cafe24Malls, autoSynced, fetchPosts]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const activeMalls = cafe24Malls.filter(m => m.connected);
      if (activeMalls.length === 0) throw new Error('연동된 카페24 쇼핑몰이 없습니다.');

      let allMsg = '';
      for (const m of activeMalls) {
        try {
          const result = await syncCafe24Posts(m.mall_id, m.board_no || 1);
          allMsg += `[${m.mall_id}] ${result.message}\n`;
        } catch (e) {
          allMsg += `[${m.mall_id}] 실패: ${e.message}\n`;
        }
      }
      setSyncMsg({ type: 'success', text: allMsg });
      await fetchPosts();
    } catch (e) {
      setSyncMsg({ type: 'error', text: e.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <StoreIcon sx={{ color: '#FF6B35' }} />
          <Typography variant="h5" fontWeight={700}>카페24 게시판</Typography>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
          onClick={handleSync}
          disabled={syncing}
          sx={{ borderColor: '#FF6B35', color: '#FF6B35', '&:hover': { borderColor: '#e55a2b', color: '#e55a2b' } }}
        >
          {syncing ? '동기화 중...' : '동기화'}
        </Button>
      </Stack>

      {syncMsg && (
        <Alert severity={syncMsg.type} onClose={() => setSyncMsg(null)} sx={{ mb: 2 }}>
          {syncMsg.text}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#fff8f5' }}>
                  <TableCell sx={{ fontWeight: 600, width: '15%' }}>쇼핑몰</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '45%' }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>작성자</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>작성일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {posts.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/board-cafe24/${p.id}`)}
                  >
                    <TableCell>
                      <Chip
                        label={p.cafe24_mall_id || 'cafe24'}
                        size="small"
                        icon={<StoreIcon style={{ fontSize: 12 }} />}
                        sx={{ bgcolor: '#FF6B35', color: 'white', height: 22, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{p.cafe24_writer_name || p.cafe24_writer_email || '-'}</TableCell>
                    <TableCell>
                      {new Date(p.created_at).toLocaleString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                {posts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      카페24 게시글이 없습니다. 동기화 버튼을 눌러주세요.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}

export default Cafe24Board;
