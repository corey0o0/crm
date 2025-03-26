import React, { useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import { uploadToGoogleDrive } from '../../lib/googleDriveConfig';

function ReceiptAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (event) => {
    try {
      setLoading(true);
      setError(null);
      const file = event.target.files[0];
      
      if (!file) return;

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