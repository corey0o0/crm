import React, { useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import { uploadToGoogleDrive } from '../../utils/cloudflareR2Utils';

function ReceiptAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (event) => {
    try {
      setLoading(true);
      setError(null);
      const file = event.target.files[0];
      
      if (!file) return;

      // 클라이언트 측 파일 검증
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const ALLOWED_TYPES = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf'
      ];

      // 파일 크기 검증
      if (file.size > MAX_FILE_SIZE) {
        setError('파일 크기가 10MB를 초과합니다.');
        setLoading(false);
        return;
      }

      // 파일 타입 검증
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('지원되지 않는 파일 형식입니다. JPEG, PNG, GIF, WebP, PDF 파일만 지원됩니다.');
        setLoading(false);
        return;
      }

      // 파일명 검증
      if (file.name.match(/[<>:"/\\|?*\x00-\x1f]/)) {
        setError('파일명에 허용되지 않는 문자가 포함되어 있습니다.');
        setLoading(false);
        return;
      }

      // 1. Google Drive에 영수증 이미지 업로드
      const timestamp = new Date().toISOString();
      const fileName = `receipt_${timestamp}_${file.name}`;
      const { fileId, webViewLink } = await uploadToGoogleDrive(file, fileName);

      // 2. Supabase에 영수증 정보 저장
      const { error: dbError } = await supabase
        .from('receipts')
        .insert([
          {
            original_filename: file.name,
            drive_file_id: fileId,
            drive_view_link: webViewLink,
            upload_date: timestamp,
            status: '분석중'
          }
        ]);

      if (dbError) throw dbError;

      // 3. 영수증 분석 시작
      // TODO: 영수증 분석 로직 구현

    } catch (err) {
      console.error('Error processing receipt:', err);
      setError('영수증 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        영수증 분석
      </Typography>

      <Box sx={{ mb: 2 }}>
        <input
          accept="image/*"
          style={{ display: 'none' }}
          id="receipt-upload"
          type="file"
          onChange={handleFileUpload}
          disabled={loading}
        />
        <label htmlFor="receipt-upload">
          <Button
            variant="contained"
            component="span"
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ mr: 1 }} />
            ) : null}
            영수증 업로드
          </Button>
        </label>
      </Box>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

export default ReceiptAnalysis; 