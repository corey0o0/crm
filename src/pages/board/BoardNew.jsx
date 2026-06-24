import React, { useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Box, Paper, Typography, TextField, Button, Stack, LinearProgress, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from '../../components/common/RichTextEditor';
import { uploadFileToR2 } from '../../utils/cloudflareR2Utils';
import { BOARD_CATEGORIES, DEFAULT_CATEGORY } from './boardCategories';

const isImageFile = (name = '') => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);

const escapeHtml = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function BoardNew() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const editorRef = useRef(null);
  const navigate = useNavigate();

  // 본문 이미지 업로드(툴바 이미지 버튼) → R2
  const handleImageUpload = async (file) => {
    const res = await uploadFileToR2(file, 'board');
    return res?.url || null;
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      setSaving(true);
      const user = (await supabase.auth.getUser()).data.user;
      const is_html = editorRef.current?.isHtmlMode?.() || false;
      const { data, error } = await supabase
        .from('board_posts')
        .insert([{ title, content, category, is_html, author_id: user?.id || null, author_email: user?.email || null }])
        .select();
      if (error) throw error;
      const id = data?.[0]?.id;
      navigate(`/board/${id}`);
    } catch (e) {
      console.error('게시글 저장 오류:', e);
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

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>글쓰기</Typography>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <TextField
              select
              label="카테고리"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              sx={{ width: 140 }}
            >
              {BOARD_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          </Stack>
          <RichTextEditor
            ref={editorRef}
            value={content}
            onChange={setContent}
            onImageUpload={handleImageUpload}
            enableHtmlMode
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
            <Button variant="outlined" onClick={() => navigate('/board')}>취소</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>저장</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

export default BoardNew;
