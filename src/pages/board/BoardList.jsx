import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Chip,
  Tabs, Tab, IconButton, Tooltip, Alert, Stack
} from '@mui/material';
import {
  Sync as SyncIcon,
  Add as AddIcon,
  Store as StoreIcon,
  Forum as ForumIcon,
  AllInbox as AllIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeRetry, isOffline } from '../../utils/networkUtils';
import { syncCafe24Posts, getCafe24Malls } from '../../utils/cafe24Api';

function BoardList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [cafe24Malls, setCafe24Malls] = useState([]);
  const [tab, setTab] = useState(0); // 0: 전체, 1: 내부, 2: 카페24
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'internal') setTab(1);
    else if (tabParam === 'cafe24') setTab(2);
    else setTab(0);
  }, [location.search]);

  const fetchPosts = useCallback(async (tabIndex = 0) => {
    try {
      if (isOffline()) { setLoading(false); return; }
      setLoading(true);

      let query = supabase
        .from('board_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (tabIndex === 1) query = query.or('source.eq.internal,source.is.null');
      else if (tabIndex === 2) query = query.eq('source', 'cafe24');

      const { data, error } = await safeRetry(async () => query, {
        maxRetries: 3, maxTime: 30000, baseDelay: 1000
      });

      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      console.error('게시글 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const [autoSynced, setAutoSynced] = useState(false);

  useEffect(() => {
    fetchPosts(tab);
    getCafe24Malls().then(res => { 
      if(res.success) {
        setCafe24Malls(res.malls || []); 
      }
    }).catch(() => {});
  }, [tab, fetchPosts]);

  // 백그라운드 자동 동기화 (최초 진입 시 1회만 조용히 실행)
  useEffect(() => {
    const activeMalls = cafe24Malls.filter(m => m.connected);
    if (activeMalls.length > 0 && !autoSynced) {
      setAutoSynced(true);
      // 백그라운드에서 조용히 동기화 실행 후 목록만 새로고침
      const runAutoSync = async () => {
        try {
          for (const m of activeMalls) {
            await syncCafe24Posts(m.mall_id, m.board_no || 1);
          }
          fetchPosts(tab); // 동기화 완료 후 리스트 업데이트
        } catch (e) {
          console.error('[Auto Sync Error]', e);
        }
      };
      runAutoSync();
    }
  }, [cafe24Malls, autoSynced, fetchPosts, tab]);

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
        } catch(e) { allMsg += `[${m.mall_id}] 실패: ${e.message}\n`; }
      }
      setSyncMsg({ type: 'success', text: allMsg });
      await fetchPosts(tab);
    } catch (e) {
      setSyncMsg({ type: 'error', text: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleTabChange = (_, newVal) => {
    setTab(newVal);
    setSyncMsg(null);
  };

  const getSourceText = (post) => {
    if (post.source === 'cafe24') {
      return `카페24 (${post.cafe24_board_no}번)`;
    }
    return '내부';
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>게시판</Typography>
        <Stack direction="row" spacing={1}>
          {cafe24Malls.some(m => m.connected) ? (
            <Tooltip title="카페24 게시글 가져오기">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? '동기화 중...' : '전체 카페24 동기화'}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="카페24 연동 설정">
              <Button
                variant="outlined"
                size="small"
                startIcon={<StoreIcon />}
                onClick={() => navigate('/settings/cafe24')}
                sx={{ color: '#FF6B35', borderColor: '#FF6B35' }}
              >
                카페24 연동
              </Button>
            </Tooltip>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/board/new')}
          >
            글쓰기
          </Button>
        </Stack>
      </Stack>

      {syncMsg && (
        <Alert severity={syncMsg.type} onClose={() => setSyncMsg(null)} sx={{ mb: 2 }}>
          {syncMsg.text}
        </Alert>
      )}

      {/* 탭 */}
      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 1, borderBottom: '1px solid #e0e0e0' }}>
        <Tab icon={<AllIcon fontSize="small" />} iconPosition="start" label="전체" />
        <Tab icon={<ForumIcon fontSize="small" />} iconPosition="start" label="내부" />
        <Tab
          icon={<StoreIcon fontSize="small" />}
          iconPosition="start"
          label="카페24"
          disabled={!cafe24Malls.some(m => m.connected) && posts.filter(p => p.source === 'cafe24').length === 0}
        />
      </Tabs>

      {/* 게시글 목록 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 600, width: '15%' }}>분류</TableCell>
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
                    onClick={() => navigate(`/board/${p.id}`)}
                  >
                    <TableCell>
                      <Chip
                        label={getSourceText(p)}
                        size="small"
                        icon={p.source === 'cafe24' ? <StoreIcon style={{ fontSize: 12 }} /> : <ForumIcon style={{ fontSize: 12 }} />}
                        sx={{ 
                          bgcolor: p.source === 'cafe24' ? '#FF6B35' : '#e0e0e0', 
                          color: p.source === 'cafe24' ? 'white' : 'rgba(0,0,0,0.87)', 
                          height: 22, fontSize: '0.75rem' 
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {p.title}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {p.source === 'cafe24' && p.cafe24_writer_name
                        ? p.cafe24_writer_name
                        : (p.author_email || '-')}
                    </TableCell>
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
                      {tab === 2
                        ? '카페24 게시글이 없습니다. 동기화 버튼을 눌러주세요.'
                        : '게시글이 없습니다.'}
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

export default BoardList;
