import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress,
  Stack, Tabs, Tab, Chip
} from '@mui/material';
import { Add as AddIcon, Forum as ForumIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { safeRetry, isOffline } from '../../utils/networkUtils';
import { BOARD_CATEGORIES, DEFAULT_CATEGORY } from './boardCategories';

function BoardList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('전체');
  const navigate = useNavigate();

  const filtered = cat === '전체' ? posts : posts.filter((p) => (p.category || DEFAULT_CATEGORY) === cat);

  const fetchPosts = useCallback(async () => {
    try {
      if (isOffline()) { setLoading(false); return; }
      setLoading(true);

      const { data, error } = await safeRetry(async () =>
        supabase
          .from('board_posts')
          .select('*')
          .or('source.eq.internal,source.is.null')
          .order('created_at', { ascending: false }),
        { maxRetries: 3, maxTime: 30000, baseDelay: 1000 }
      );

      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      console.error('게시글 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ForumIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="h5" fontWeight={700}>내부 게시판</Typography>
        </Stack>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate('/board/new')}
        >
          글쓰기
        </Button>
      </Stack>

      <Tabs
        value={cat}
        onChange={(e, v) => setCat(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="전체" label="전체" />
        {BOARD_CATEGORIES.map((c) => (
          <Tab key={c} value={c} label={c} />
        ))}
      </Tabs>

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
                  <TableCell sx={{ fontWeight: 600, width: '12%' }}>카테고리</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '43%' }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '25%' }}>작성자</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>작성일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/board/${p.id}`)}
                  >
                    <TableCell><Chip size="small" label={p.category || DEFAULT_CATEGORY} /></TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell>{p.author_email || '-'}</TableCell>
                    <TableCell>
                      {new Date(p.created_at).toLocaleString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      게시글이 없습니다.
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
