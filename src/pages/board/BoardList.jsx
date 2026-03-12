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
import { useNavigate } from 'react-router-dom';
import { safeRetry, isOffline } from '../../utils/networkUtils';
import { syncCafe24Posts, getCafe24Status } from '../../utils/cafe24Api';

function BoardList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [cafe24Status, setCafe24Status] = useState(null);
  const [tab, setTab] = useState(0); // 0: 전체, 1: 내부, 2: 카페24
  const navigate = useNavigate();

  const fetchPosts = useCallback(async (tabIndex = 0) => {
    try {
      if (isOffline()) { setLoading(false); return; }
      setLoading(true);

      let query = supabase
        .from('board_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (tabIndex === 1) query = query.eq('source', 'internal').or('source.is.null');
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

  useEffect(() => {
    fetchPosts(tab);
    getCafe24Status().then(setCafe24Status).catch(() => {});
  }, [tab, fetchPosts]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncCafe24Posts(cafe24Status?.board_no || 1);
      setSyncMsg({ type: 'success', text: result.message });
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

  const getSourceChip = (post) => {
    if (post.source === 'cafe24') {
      return (
        <Chip
          label="카페24"
          size="small"
          icon={<StoreIcon style={{ fontSize: 12 }} />}
          sx={{ bgcolor: '#FF6B35', color: 'white', height: 20, fontSize: '0.7rem', ml: 1 }}
        />
      );
    }
    return null;
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>게시판</Typography>
        <Stack direction="row" spacing={1}>
          {cafe24Status?.connected && (
            <Tooltip title="카페24 게시글 가져오기">
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? '동기화 중...' : '카페24 동기화'}
                </Button>
              </span>
            </Tooltip>
          )}
          {!cafe24Status?.connected && (
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
          disabled={!cafe24Status?.connected && posts.filter(p => p.source === 'cafe24').length === 0}
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
                  <TableCell sx={{ fontWeight: 600 }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>작성자</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>작성일</TableCell>
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
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {p.title}
                        {getSourceChip(p)}
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
                    <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
