import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

function BoardDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOne = async () => {
      const { data, error } = await supabase.from('board_posts').select('*').eq('id', id).single();
      if (!error) setPost(data);
    };
    fetchOne();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('board_posts').delete().eq('id', id);
    if (!error) navigate('/board');
  };

  if (!post) return null;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{post.title}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/board')}>목록</Button>
          <Button variant="outlined" color="error" onClick={handleDelete}>삭제</Button>
        </Stack>
      </Stack>
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {post.author_email || '-'} · {new Date(post.created_at).toLocaleString()}
        </Typography>
        <Box
          sx={{
            '& p': { my: 0.5 },
            '& img': { maxWidth: '100%' }
          }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </Paper>
    </Box>
  );
}

export default BoardDetail;


