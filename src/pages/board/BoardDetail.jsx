import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Paper, Typography, Button, Stack, Chip, Divider,
  TextField, CircularProgress, Alert, Tooltip
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Store as StoreIcon,
  Replay as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  List as ListIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { postCafe24Comment } from '../../utils/cafe24Api';

function BoardDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyMsg, setReplyMsg] = useState(null);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOne = async () => {
      const { data, error } = await supabase
        .from('board_posts')
        .select('*')
        .eq('id', id)
        .single();
      if (!error) setPost(data);
    };
    fetchOne();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('board_posts').delete().eq('id', id);
    if (!error) navigate('/board');
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setReplying(true);
    setReplyMsg(null);
    try {
      await postCafe24Comment({
        mall_id: post.cafe24_mall_id,
        board_no: post.cafe24_board_no,
        article_no: post.cafe24_article_no,
        content: replyContent.trim()
      });
      setReplyMsg({ type: 'success', text: '카페24에 답글이 등록되었습니다.' });
      setReplyContent('');
      setShowReplyBox(false);
    } catch (e) {
      setReplyMsg({ type: 'error', text: e.message });
    } finally {
      setReplying(false);
    }
  };

  if (!post) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isCafe24 = post.source === 'cafe24';

  return (
    <Box sx={{ p: 2, maxWidth: 900 }}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, mr: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="h5" fontWeight={700}>{post.title}</Typography>
            {isCafe24 && (
              <Chip
                label="카페24"
                size="small"
                icon={<StoreIcon style={{ fontSize: 13 }} />}
                sx={{ bgcolor: '#FF6B35', color: 'white', height: 22, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {isCafe24
              ? (post.cafe24_writer_name || '쇼핑몰 고객')
              : (post.author_email || '-')}
            {' · '}
            {new Date(post.created_at).toLocaleString('ko-KR')}
            {isCafe24 && post.synced_at && (
              <> · 동기화: {new Date(post.synced_at).toLocaleString('ko-KR')}</>
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button variant="outlined" size="small" startIcon={<ListIcon />} onClick={() => navigate('/board')}>
            목록
          </Button>
          {isCafe24 && post.cafe24_url && (
            <Tooltip title="카페24 원본 보기">
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open(post.cafe24_url, '_blank')}
                sx={{ color: '#FF6B35', borderColor: '#FF6B35' }}
              >
                원본
              </Button>
            </Tooltip>
          )}
          {!isCafe24 && (
            <>
              <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => navigate(`/board/${id}/edit`)}>
                수정
              </Button>
              <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} onClick={handleDelete}>
                삭제
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* 카페24 게시글 정보 배너 */}
      {isCafe24 && (
        <Paper
          sx={{
            p: 1.5, mb: 2, bgcolor: '#fff8f5',
            border: '1px solid #FF6B35', borderRadius: 2
          }}
          elevation={0}
        >
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <StoreIcon sx={{ color: '#FF6B35', fontSize: 18 }} />
            <Typography variant="body2" sx={{ color: '#FF6B35', fontWeight: 600 }}>
              카페24 게시글
            </Typography>
            {post.cafe24_writer_email && (
              <Typography variant="body2" color="text.secondary">
                작성자 이메일: {post.cafe24_writer_email}
              </Typography>
            )}
            {post.cafe24_board_no && (
              <Typography variant="body2" color="text.secondary">
                게시판: {post.cafe24_board_no}번 · 게시글: {post.cafe24_article_no}번
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {/* 본문 */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box
          sx={{
            '& p': { my: 0.5 },
            '& img': { maxWidth: '100%', borderRadius: 1 },
            lineHeight: 1.8
          }}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </Paper>

      {/* 카페24 게시글: 답글 작성 */}
      {isCafe24 && post.cafe24_article_no && (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: showReplyBox ? 2 : 0 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              💬 카페24 답글 작성
            </Typography>
            <Button
              size="small"
              variant={showReplyBox ? 'outlined' : 'contained'}
              startIcon={<ReplyIcon />}
              onClick={() => setShowReplyBox(v => !v)}
              sx={showReplyBox ? {} : { bgcolor: '#FF6B35', '&:hover': { bgcolor: '#e55a2b' } }}
            >
              {showReplyBox ? '취소' : '답글 쓰기'}
            </Button>
          </Stack>

          {showReplyBox && (
            <>
              <TextField
                multiline
                rows={4}
                fullWidth
                placeholder="카페24 게시판에 등록될 답글 내용을 입력하세요..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                size="small"
                sx={{ mb: 1 }}
              />
              {replyMsg && (
                <Alert severity={replyMsg.type} sx={{ mb: 1 }}>{replyMsg.text}</Alert>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={handleReply}
                disabled={replying || !replyContent.trim()}
                startIcon={replying ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ bgcolor: '#FF6B35', '&:hover': { bgcolor: '#e55a2b' } }}
              >
                {replying ? '등록 중...' : '카페24에 답글 등록'}
              </Button>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default BoardDetail;
