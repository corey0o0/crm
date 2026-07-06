import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Chip,
  Alert, Stack, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import { Sync as SyncIcon, Store as StoreIcon, QuestionAnswer as QAIcon } from '@mui/icons-material';
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
  const [selectedMall, setSelectedMall] = useState('all');
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

  useEffect(() => {
    const activeMalls = cafe24Malls.filter(m => m.mall_id && m.board_no);
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
      const activeMalls = cafe24Malls.filter(m => m.mall_id && m.board_no);
      if (activeMalls.length === 0) throw new Error('동기화할 카페24 쇼핑몰이 없습니다.');

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

  // 사이트별 필터
  const mallIds = ['all', ...new Set(posts.map(p => p.cafe24_mall_id).filter(Boolean))];
  const filtered = selectedMall === 'all' ? posts : posts.filter(p => p.cafe24_mall_id === selectedMall);

  const boardLabel = (boardNo) => {
    const n = parseInt(boardNo);
    if (n === 9) return { label: '1:1상담', color: '#7b1fa2', bg: '#f3e5f5' };
    if (n === 6) return { label: '상품Q&A', color: '#1565c0', bg: '#e3f2fd' };
    return { label: `게시판${boardNo}`, color: '#555', bg: '#f5f5f5' };
  };

  const mallLabel = (id) => {
    if (id === 'all') return '전체';
    if (id === 'nearbike') return '니어바이크';
    if (id === 'slimpack79') return 'X-RIDER';
    return id;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <QAIcon sx={{ color: '#FF6B35' }} />
          <Typography variant="h5" fontWeight={700}>카페24 Q&A</Typography>
          <Chip label={`${filtered.length}건`} size="small" sx={{ bgcolor: '#fff3ee', color: '#FF6B35', fontWeight: 600 }} />
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

      {/* 사이트 필터 */}
      {mallIds.length > 1 && (
        <ToggleButtonGroup
          value={selectedMall}
          exclusive
          onChange={(_, v) => v && setSelectedMall(v)}
          size="small"
          sx={{ mb: 2 }}
        >
          {mallIds.map(id => (
            <ToggleButton
              key={id}
              value={id}
              sx={{
                px: 2, fontSize: '0.8rem', fontWeight: 600,
                '&.Mui-selected': { bgcolor: '#FF6B35', color: 'white', '&:hover': { bgcolor: '#e55a2b' } }
              }}
            >
              {mallLabel(id)}
              {id !== 'all' && (
                <Chip
                  label={posts.filter(p => p.cafe24_mall_id === id).length}
                  size="small"
                  sx={{ ml: 0.5, height: 18, fontSize: '0.7rem', bgcolor: 'rgba(0,0,0,0.1)', color: 'inherit' }}
                />
              )}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

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
                  <TableCell sx={{ fontWeight: 600, width: '12%' }}>사이트</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '10%' }}>구분</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '28%' }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '18%' }}>질문자</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>이메일</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '8%' }} align="center">답변</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '12%' }}>작성일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/board-cafe24/${p.id}`)}
                  >
                    <TableCell>
                      <Chip
                        label={mallLabel(p.cafe24_mall_id)}
                        size="small"
                        icon={<StoreIcon style={{ fontSize: 12 }} />}
                        sx={{ bgcolor: '#FF6B35', color: 'white', height: 22, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => { const b = boardLabel(p.cafe24_board_no); return (
                        <Chip label={b.label} size="small" sx={{ bgcolor: b.bg, color: b.color, fontWeight: 700, height: 22, fontSize: '0.72rem' }} />
                      ); })()}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography variant="body2" noWrap>{p.title}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{p.cafe24_writer_name || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                        {p.cafe24_writer_email || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {p.answer_count > 0 ? (
                        <Chip label="답변완료" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                      ) : (
                        <Chip label="미답변" size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', height: 20, fontSize: '0.7rem' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                        {new Date(p.created_at).toLocaleDateString('ko-KR')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {posts.length === 0 ? '동기화 버튼을 눌러 데이터를 가져오세요.' : '해당 사이트의 게시글이 없습니다.'}
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
