import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Box, Paper, Typography, TextField, Button, Stack, LinearProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import RichTextEditor from '../../components/common/RichTextEditor';
import { uploadFileToR2 } from '../../utils/cloudflareR2Utils';

const isImageFile = (name = '') => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);

const escapeHtml = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function BoardEdit() {
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const editorRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPost = async () => {
      try {
        const { data, error } = await supabase.from('board_posts').select('*').eq('id', id).single();
        if (error) throw error;
        setTitle(data.title || '');
        setContent(data.content || '');
      } catch (e) {
        console.error('게시글 불러오기 오류:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [id]);

  // 본문 이미지 업로드(툴바 이미지 버튼) → R2
  const handleImageUpload = async (file) => {
    const res = await uploadFileToR2(file, 'board');
    return res?.url || null;
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('board_posts')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      navigate(`/board/${id}`);
    } catch (e) {
      console.error('게시글 수정 오류:', e);
    } finally {
      setSaving(false);
    }
  };

  // 파일 첨부 → R2 업로드 후 에디터 커서 위치에 삽입(이미지는 <img>, 그 외는 링크)
  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const res = await uploadFileToR2(file, 'board');
          if (res?.url) uploaded.push({ name: file.name, url: res.url });
        } catch (err) {
          console.error('파일 업로드 오류:', err);
        }
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      if (uploaded.length > 0) {
        const html = uploaded
          .map((f) =>
            isImageFile(f.name)
              ? `<p><img src="${f.url}" alt="${escapeHtml(f.name)}" /></p>`
              : `<p><a href="${f.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.name)}</a></p>`
          )
          .join('');
        editorRef.current?.insertContent(html);
      }
    } catch (err) {
      console.error('첨부 처리 오류:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) return null;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>글 수정</Typography>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <RichTextEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            onImageUpload={handleImageUpload}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" component="label">
              파일 첨부
              <input type="file" multiple hidden onChange={handleFilesSelected} />
            </Button>
            {uploading && (
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="outlined" onClick={() => navigate(`/board/${id}`)}>취소</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>저장</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default BoardEdit;
