import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { generateAutoReport } from '../../utils/aiAnalysisUtils';
import dayjs from 'dayjs';

function AutoReport({ analysisData, filters }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');

  const generateReport = async () => {
    if (!analysisData || analysisData.totalCount === 0) {
      setError('리포트를 생성할 데이터가 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const filterInfo = {
        brand: filters?.selectedBrand || '전체',
        startDate: filters?.startDate?.format('YYYY-MM-DD') || '',
        endDate: filters?.endDate?.format('YYYY-MM-DD') || '',
        completedOnly: filters?.completedOnly || false
      };

      const response = await generateAutoReport(analysisData, filterInfo);
      setReport(response);

      // 리포트 제목 자동 생성
      const title = `A/S 분석 리포트_${filterInfo.startDate || '전체'}_${filterInfo.endDate || '전체'}_${new Date().toISOString().split('T')[0]}`;
      setReportTitle(title);
    } catch (err) {
      console.error('리포트 생성 오류:', {
        error: err,
        message: err?.message,
        stack: err?.stack
      });
      const errorMessage = err?.message || err?.toString() || '리포트 생성 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const content = `
${reportTitle || 'A/S 분석 리포트'}

생성일시: ${new Date().toLocaleString('ko-KR')}
분석 조건:
- 브랜드: ${filters?.selectedBrand || '전체'}
- 기간: ${filters?.startDate?.format('YYYY-MM-DD') || '전체'} ~ ${filters?.endDate?.format('YYYY-MM-DD') || '전체'}
- 완료 건만: ${filters?.completedOnly ? '예' : '아니오'}

${'='.repeat(50)}

${report}

${'='.repeat(50)}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportTitle || 'A/S_분석_리포트'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!report) return;

    const printWindow = window.open('', '_blank');
    const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle || 'A/S 분석 리포트'}</title>
  <style>
    body {
      font-family: 'Malgun Gothic', sans-serif;
      padding: 20px;
      line-height: 1.6;
    }
    h1, h2, h3 {
      color: #333;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${reportTitle || 'A/S 분석 리포트'}</h1>
  <p><strong>생성일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
  <p><strong>분석 조건:</strong></p>
  <ul>
    <li>브랜드: ${filters?.selectedBrand || '전체'}</li>
    <li>기간: ${filters?.startDate?.format('YYYY-MM-DD') || '전체'} ~ ${filters?.endDate?.format('YYYY-MM-DD') || '전체'}</li>
    <li>완료 건만: ${filters?.completedOnly ? '예' : '아니오'}</li>
  </ul>
  <hr>
  <pre>${report}</pre>
</body>
</html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DescriptionIcon color="primary" /> 자동 리포트 생성
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          현재 필터 조건에 맞는 분석 리포트를 자동으로 생성합니다. 리포트에는 주요 통계, 인사이트, 패턴 분석, 개선 권장사항이 포함됩니다.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="리포트 제목"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="리포트 제목을 입력하세요 (선택사항)"
            fullWidth
            size="small"
          />
        </Box>

        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DescriptionIcon />}
          onClick={generateReport}
          disabled={loading}
          sx={{ mb: 2 }}
        >
          {loading ? '리포트 생성 중...' : '리포트 생성'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {report && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadReport}
            >
              텍스트 다운로드
            </Button>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={printReport}
            >
              인쇄
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={generateReport}
              disabled={loading}
            >
              다시 생성
            </Button>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              maxHeight: '500px',
              overflowY: 'auto',
              bgcolor: 'grey.50'
            }}
          >
            <Typography variant="h6" gutterBottom>
              {reportTitle || 'A/S 분석 리포트'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
              생성일시: {new Date().toLocaleString('ko-KR')}
            </Typography>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontFamily: 'inherit',
                margin: 0
              }}
            >
              {report}
            </Typography>
          </Paper>
        </Box>
      )}

      {!report && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography color="textSecondary">
            리포트를 생성하려면 위의 버튼을 클릭하세요.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default AutoReport;
