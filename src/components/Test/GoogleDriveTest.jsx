import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Link,
  Divider
} from '@mui/material';
import { uploadToGoogleDrive, getGoogleDrivePreviewUrl } from '../../utils/cloudflareR2Utils';

const initializeGoogleAPI = async () => true;
const getFileLink = async (id) => getGoogleDrivePreviewUrl(id);

function GoogleDriveTest() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [uploadedFileLink, setUploadedFileLink] = useState(null);
  const [fileIdToCheck, setFileIdToCheck] = useState('');
  const [apiInitialized, setApiInitialized] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setApiInitialized(false);

    try {
      await initializeGoogleAPI();
      setApiInitialized(true);
      setSuccess('Google API 초기화 및 연결 테스트 성공');
    } catch (err) {
      console.error('API initialization error:', err);
      setError('Google API 초기화 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시에는 실행하지 않음
  // useEffect(() => {
  //   runDiagnostic();
  // }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = async () => {
    if (!apiInitialized) {
      setError('Google API가 아직 초기화되지 않았습니다.');
      return;
    }

    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const timestamp = new Date().toISOString();
      const fileName = `test_${timestamp}_${file.name}`;

      const { fileId, webViewLink } = await uploadToGoogleDrive(file, fileName);

      setUploadedFileId(fileId);
      setUploadedFileLink(webViewLink);
      setSuccess('파일이 성공적으로 업로드되었습니다.');
    } catch (err) {
      console.error('Upload error:', err);
      setError('파일 업로드 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetLink = async () => {
    if (!apiInitialized) {
      setError('Google API가 아직 초기화되지 않았습니다.');
      return;
    }

    if (!fileIdToCheck) {
      setError('파일 ID를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const link = await getFileLink(fileIdToCheck);
      setUploadedFileLink(link);
      setSuccess('파일 링크를 성공적으로 가져왔습니다.');
    } catch (err) {
      console.error('Get link error:', err);
      setError('파일 링크 가져오기 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Google Drive API 테스트
        </Typography>

        {/* API 상태 표시 및 진단 버튼 */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Alert
            severity={apiInitialized ? "success" : "info"}
            sx={{ flexGrow: 1 }}
          >
            Google API 상태: {apiInitialized ? '초기화됨' : '미초기화'}
          </Alert>
          <Button
            variant="contained"
            onClick={runDiagnostic}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : '진단 실행'}
          </Button>
        </Box>

        {/* 파일 업로드 섹션 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            파일 업로드 테스트
          </Typography>
          <Box sx={{ mb: 2 }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              disabled={loading || !apiInitialized}
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                disabled={loading || !apiInitialized}
                sx={{ mr: 2 }}
              >
                파일 선택
              </Button>
              {file && (
                <Typography component="span" variant="body2">
                  선택된 파일: {file.name}
                </Typography>
              )}
            </label>
          </Box>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || loading || !apiInitialized}
            sx={{ mb: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : '업로드'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* 파일 링크 확인 섹션 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            파일 링크 확인 테스트
          </Typography>
          <TextField
            fullWidth
            label="파일 ID"
            value={fileIdToCheck}
            onChange={(e) => setFileIdToCheck(e.target.value)}
            disabled={loading || !apiInitialized}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleGetLink}
            disabled={!fileIdToCheck || loading || !apiInitialized}
          >
            {loading ? <CircularProgress size={24} /> : '링크 가져오기'}
          </Button>
        </Box>

        {/* 결과 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        {uploadedFileId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            파일 ID: {uploadedFileId}
          </Alert>
        )}
        {uploadedFileLink && (
          <Alert severity="info" sx={{ mb: 2 }}>
            파일 링크: <Link href={uploadedFileLink} target="_blank" rel="noopener noreferrer">
              {uploadedFileLink}
            </Link>
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default GoogleDriveTest; 