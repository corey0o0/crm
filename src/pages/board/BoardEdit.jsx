import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Box, Paper, Typography, TextField, Button, Stack, LinearProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import QuillEditor from '../../components/common/QuillEditor';
import DOMPurify from 'dompurify';

function BoardEdit() {
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [htmlMode, setHtmlMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      [{ color: [] }, { background: [] }],
      ['link'],
      ['clean']
    ]
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'align',
    'color', 'background',
    'link'
  ];

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

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `board/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
        const { error } = await supabase.storage.from('receipts').upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });
        if (error) {
          console.error('파일 업로드 오류:', error);
          continue;
        }
        const { data: urlData } = await supabase.storage.from('receipts').getPublicUrl(path);
        if (urlData?.publicUrl) {
          uploaded.push({ name: file.name, url: urlData.publicUrl, path });
        }
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      if (uploaded.length > 0) {
        const linksHtml = uploaded.map((f) => `<p><a href="${f.url}" target="_blank" rel="noopener noreferrer">${f.name}</a></p>`).join('');
        setContent((prev) => (prev || '') + DOMPurify.sanitize(linksHtml));
      }
    } catch (err) {
      console.error('첨부 처리 오류:', err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return null;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>글 수정</Typography>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField label="제목" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {htmlMode ? 'HTML 원본을 직접 입력합니다.' : '서식 있는 편집기로 작성합니다.'}
            </Typography>
            <Button size="small" variant="outlined" onClick={() => setHtmlMode((v) => !v)}>
              {htmlMode ? '에디터 모드' : 'HTML 모드'}
            </Button>
          </Stack>
          {htmlMode ? (
            <TextField
              label="HTML"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              fullWidth
              multiline
              rows={14}
            />
          ) : (
            <Box sx={{
              '& .ql-editor': { minHeight: 240 },
              '& .ql-container': { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
              '& .ql-toolbar': { borderTopLeftRadius: 4, borderTopRightRadius: 4 }
            }}>
              <QuillEditor
                theme="snow"
                value={content}
                onChange={setContent}
                modules={quillModules}
                formats={quillFormats}
                placeholder="내용을 입력하세요..."
              />
            </Box>
          )}
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
