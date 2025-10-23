import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';

function BoardList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isOffline()) {
          console.log('[BoardList] 오프라인 상태 - 데이터 로딩 건너뛰기');
          setLoading(false);
          return;
        }
        
        setLoading(true);
        const { data, error } = await safeRetry(async () => {
          return await supabase
            .from('board_posts')
            .select('*')
            .order('created_at', { ascending: false });
        }, { maxRetries: 3, maxTime: 30000, baseDelay: 1000 });
        
        if (error) throw error;
        setPosts(data || []);
      } catch (e) {
        console.error('게시글 조회 오류:', e);
        const errorMessage = getErrorMessage(e);
        console.error('[BoardList] 오류 메시지:', errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">게시판</Typography>
        <Button variant="contained" onClick={() => navigate('/board/new')}>글쓰기</Button>
      </Box>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>제목</TableCell>
                <TableCell>작성자</TableCell>
                <TableCell>작성일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/board/${p.id}`)}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>{p.author_email || '-'}</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">게시글이 없습니다.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

    </Box>
  );
}

export default BoardList;


