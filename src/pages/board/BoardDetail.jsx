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
import DOMPurify from 'dompurify';
import { DEFAULT_CATEGORY } from './boardCategories';
import BoardAttachments from './BoardAttachments';

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
  const answers = Array.isArray(post.answers) ? post.answers : [];

  return (
    <Box sx={{ p: 2, maxWidth: 900 }}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, mr: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            {!isCafe24 && (
              <Chip label={post.category || DEFAULT_CATEGORY} size="small" sx={{ height: 22, fontSize: '0.7rem' }} />
            )}
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
          <Button variant="outlined" size="small" startIcon={<ListIcon />} onClick={() => navigate(isCafe24 ? '/board-cafe24' : '/board')}>
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

      {/* 카페24 질문자 정보 배너 */}
      {isCafe24 && (
        <Paper
          sx={{ p: 1.5, mb: 2, bgcolor: '#fff8f5', border: '1px solid #FF6B35', borderRadius: 2 }}
          elevation={0}
        >
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <StoreIcon sx={{ color: '#FF6B35', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: '#FF6B35', fontWeight: 700 }}>
                질문자 정보
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {post.cafe24_writer_name && (
                <Typography variant="body2">
                  <span style={{ color: '#888', marginRight: 4 }}>이름</span>
                  <strong>{post.cafe24_writer_name}</strong>
                </Typography>
              )}
              {post.cafe24_writer_email && (
                <Typography variant="body2">
                  <span style={{ color: '#888', marginRight: 4 }}>이메일</span>
                  <strong>{post.cafe24_writer_email}</strong>
                </Typography>
              )}
              {post.cafe24_mall_id && (
                <Typography variant="body2" color="text.secondary">
                  사이트: {post.cafe24_mall_id} · 게시판 {post.cafe24_board_no}번 · 글 {post.cafe24_article_no}번
                </Typography>
              )}
            </Stack>
            <Chip
              label={answers.length > 0 ? `답변 ${answers.length}개` : '미답변'}
              size="small"
              sx={answers.length > 0
                ? { bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600, height: 22 }
                : { bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600, height: 22 }}
            />
          </Stack>
        </Paper>
      )}

      {/* 본문 */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box
          sx={{
            '& p': { my: 0.5 },
            '& img': { maxWidth: '100%', borderRadius: 1 },
            // 에디터에서 작성한 표 렌더링(신규 표는 인라인 스타일이 없으므로 여기서 테두리 적용)
            '& table': { borderCollapse: 'collapse', width: '100%', margin: '8px 0' },
            '& th, & td': { border: '1px solid #ccc', padding: '8px' },
            '& th': { background: '#f5f5f5', fontWeight: 600 },
            lineHeight: 1.8
          }}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(post.content, {
              // 인라인 CSS·<style> 블록·표·임베드는 허용, JavaScript(<script>·on* 핸들러)는 기본값대로 차단
              // FORCE_BODY: <style>을 body 컨텍스트로 파싱해 살림 (없으면 <head>로 빠져 제거됨)
              // 주의: <style> 규칙은 페이지 전역 적용 — 작성 시 body{}/*{} 같은 광범위 선택자 금지
              FORCE_BODY: true,
              ADD_TAGS: ['style', 'iframe'],
              ADD_ATTR: [
                'style', 'class',
                'target', 'rel',
                'allow', 'allowfullscreen', 'frameborder', 'scrolling',
                'colspan', 'rowspan', 'width', 'height',
                'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'bgcolor'
              ]
            })
          }}
        />
      </Paper>

      {Array.isArray(post.attachments) && post.attachments.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <BoardAttachments attachments={post.attachments} />
        </Paper>
      )}

      {/* 카페24 답변 목록 */}
      {isCafe24 && answers.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#2e7d32' }}>
            💬 답변 ({answers.length})
          </Typography>
          <Stack spacing={1.5}>
            {answers.map((a, i) => (
              <Paper
                key={a.comment_no || i}
                elevation={0}
                sx={{ p: 2, border: '1px solid #c8e6c9', borderRadius: 2, bgcolor: '#f9fbe7' }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="답변" size="small" sx={{ bgcolor: '#2e7d32', color: 'white', height: 20, fontSize: '0.7rem' }} />
                    {a.writer_name && (
                      <Typography variant="body2" fontWeight={600}>{a.writer_name}</Typography>
                    )}
                    {a.writer_email && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                        {a.writer_email}
                      </Typography>
                    )}
                  </Stack>
                  {a.created_date && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(a.created_date).toLocaleString('ko-KR')}
                    </Typography>
                  )}
                </Stack>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                  {a.content}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

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
