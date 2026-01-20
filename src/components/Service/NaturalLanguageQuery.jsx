import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  Clear as ClearIcon,
  QuestionAnswer as QuestionAnswerIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { processNaturalLanguageQuery } from '../../utils/aiAnalysisUtils';

function NaturalLanguageQuery({ analysisData }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState([]);

  const exampleQueries = [
    '브레이크 소음이 가장 많은 기종은?',
    '완료율이 낮은 접수 내용은?',
    '가장 많이 사용된 부품은?',
    '주행거리별 접수 패턴은?',
    '태그별 주요 접수 내용은?'
  ];

  const handleQuery = async () => {
    if (!query.trim()) {
      setError('질문을 입력해주세요.');
      return;
    }

    if (!analysisData || analysisData.totalCount === 0) {
      setError('분석할 데이터가 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await processNaturalLanguageQuery(query, analysisData);
      
      setAnswers(prev => [
        {
          question: query,
          answer: response,
          timestamp: new Date()
        },
        ...prev
      ]);
      
      setQuery('');
    } catch (err) {
      console.error('질의 처리 오류:', {
        error: err,
        message: err?.message,
        stack: err?.stack
      });
      const errorMessage = err?.message || err?.toString() || '질의 처리 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  const handleExampleClick = (example) => {
    setQuery(example);
  };

  const clearHistory = () => {
    setAnswers([]);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <QuestionAnswerIcon color="primary" /> 자연어 질의
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
          데이터에 대해 자연어로 질문하세요. 예:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {exampleQueries.map((example, index) => (
            <Chip
              key={index}
              label={example}
              size="small"
              onClick={() => handleExampleClick(example)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder="예: 브레이크 소음이 가장 많은 기종은?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <Button
          variant="contained"
          onClick={handleQuery}
          disabled={loading || !query.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          sx={{ minWidth: 100 }}
        >
          {loading ? '분석 중' : '질문'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {answers.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" color="textSecondary">
            질의 이력 ({answers.length}개)
          </Typography>
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={clearHistory}
          >
            전체 삭제
          </Button>
        </Box>
      )}

      <Box sx={{ maxHeight: '600px', overflowY: 'auto' }}>
        {answers.map((item, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'start', mb: 1 }}>
                <QuestionAnswerIcon color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    질문
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {item.question}
                  </Typography>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    답변
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {item.answer}
                  </Typography>
                  
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    {item.timestamp.toLocaleString('ko-KR')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {answers.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography color="textSecondary">
            질문을 입력하고 답변을 받아보세요.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default NaturalLanguageQuery;
