import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Button
} from '@mui/material';
import {
  Lightbulb as LightbulbIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { generateAIInsights } from '../../utils/aiAnalysisUtils';

function AIInsights({ analysisData }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    if (!analysisData || analysisData.totalCount === 0) {
      setError('분석할 데이터가 없습니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await generateAIInsights(analysisData);
      setInsights(response);
    } catch (err) {
      console.error('AI 인사이트 생성 오류:', {
        error: err,
        message: err?.message,
        stack: err?.stack
      });
      const errorMessage = err?.message || err?.toString() || 'AI 인사이트 생성 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [analysisData]);

  useEffect(() => {
    // 초기 로드 시 자동으로 인사이트 생성
    if (analysisData && analysisData.totalCount > 0) {
      fetchInsights();
    }
  }, [analysisData, fetchInsights]);

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography color="textSecondary">AI가 데이터를 분석하고 있습니다...</Typography>
        </Box>
      </Paper>
    );
  }

  if (error) {
    const isApiKeyError = error.includes('API 키') || error.includes('API_KEY');
    
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          {isApiKeyError && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                OpenAI API 키를 환경 변수에 설정해주세요: REACT_APP_OPENAI_API_KEY
              </Typography>
            </Box>
          )}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchInsights}
        >
          다시 시도
        </Button>
      </Paper>
    );
  }

  if (!insights) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
          AI 인사이트를 생성할 데이터가 없습니다.
        </Typography>
      </Paper>
    );
  }

  // 중복 제거 함수
  const removeDuplicates = (items) => {
    const seen = new Set();
    const unique = [];
    
    items.forEach(item => {
      // 텍스트 정규화 (공백, 특수문자 제거)
      const normalized = item
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s가-힣]/g, '')
        .trim();
      
      // 핵심 키워드 추출 (3단어 이상)
      const words = normalized.split(' ').filter(w => w.length > 2);
      const keyPhrase = words.slice(0, 5).join(' '); // 처음 5개 단어로 유사도 판단
      
      // 유사한 내용이 이미 있는지 확인
      let isDuplicate = false;
      for (const seenPhrase of seen) {
        // 단어 겹침 비율 계산
        const seenWords = seenPhrase.split(' ');
        const commonWords = words.filter(w => seenWords.includes(w));
        const similarity = commonWords.length / Math.max(words.length, seenWords.length);
        
        // 70% 이상 유사하면 중복으로 간주
        if (similarity > 0.7) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate && keyPhrase.length > 5) {
        seen.add(keyPhrase);
        unique.push(item);
      }
    });
    
    return unique;
  };

  // AI 응답을 파싱하여 구조화
  const parseInsights = (text) => {
    const sections = {
      insights: [],
      patterns: [],
      trends: [],
      recommendations: []
    };

    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (trimmed.includes('주요 인사이트') || trimmed.includes('**주요 인사이트**') || trimmed.includes('## 1.') || trimmed.includes('1. **주요 인사이트**')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = removeDuplicates(currentContent);
        }
        currentSection = 'insights';
        currentContent = [];
      } else if (trimmed.includes('패턴 분석') || trimmed.includes('**패턴 분석**') || trimmed.includes('## 2.') || trimmed.includes('2. **패턴 분석**')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = removeDuplicates(currentContent);
        }
        currentSection = 'patterns';
        currentContent = [];
      } else if (trimmed.includes('트렌드 분석') || trimmed.includes('**트렌드 분석**') || trimmed.includes('## 3.') || trimmed.includes('3. **트렌드 분석**')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = removeDuplicates(currentContent);
        }
        currentSection = 'trends';
        currentContent = [];
      } else if (trimmed.includes('개선 권장사항') || trimmed.includes('**개선 권장사항**') || trimmed.includes('## 4.') || trimmed.includes('4. **개선 권장사항**')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = removeDuplicates(currentContent);
        }
        currentSection = 'recommendations';
        currentContent = [];
      } else if (trimmed && (trimmed.startsWith('-') || trimmed.startsWith('•') || /^\d+\./.test(trimmed))) {
        const content = trimmed.replace(/^[-•\d.\s]+/, '').trim();
        if (content && content.length > 10) {
          currentContent.push(content);
        }
      } else if (trimmed && currentSection && !trimmed.match(/^#+\s/) && trimmed.length > 15) {
        // 섹션 헤더가 아니고 충분히 긴 텍스트만 추가
        currentContent.push(trimmed);
      }
    });

    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = removeDuplicates(currentContent);
    }

    // 전체 섹션 간 중복도 제거
    const allItems = [
      ...sections.insights,
      ...sections.patterns,
      ...sections.trends,
      ...sections.recommendations
    ];
    
    // 각 섹션별로 다른 섹션과 중복되는 항목 제거
    sections.insights = sections.insights.filter(item => {
      const normalized = item.toLowerCase().replace(/\s+/g, ' ').trim();
      return !sections.patterns.some(p => 
        p.toLowerCase().replace(/\s+/g, ' ').trim() === normalized
      ) && !sections.trends.some(t => 
        t.toLowerCase().replace(/\s+/g, ' ').trim() === normalized
      ) && !sections.recommendations.some(r => 
        r.toLowerCase().replace(/\s+/g, ' ').trim() === normalized
      );
    });

    return sections;
  };

  const parsedInsights = parseInsights(insights);

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightbulbIcon color="primary" /> AI 인사이트
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchInsights}
        >
          새로고침
        </Button>
      </Box>

      {parsedInsights.insights.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LightbulbIcon color="primary" fontSize="small" /> 주요 인사이트
          </Typography>
          {parsedInsights.insights.map((insight, index) => (
            <Card key={index} sx={{ mb: 1.5, bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2">{insight}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {parsedInsights.patterns.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="secondary" fontSize="small" /> 패턴 분석
          </Typography>
          {parsedInsights.patterns.map((pattern, index) => (
            <Card key={index} sx={{ mb: 1.5 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2">{pattern}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {parsedInsights.trends.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="info" fontSize="small" /> 트렌드 분석
          </Typography>
          {parsedInsights.trends.map((trend, index) => (
            <Card key={index} sx={{ mb: 1.5 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2">{trend}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {parsedInsights.recommendations.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" fontSize="small" /> 개선 권장사항
          </Typography>
          {parsedInsights.recommendations.map((recommendation, index) => (
            <Card key={index} sx={{ mb: 1.5, bgcolor: 'rgba(46, 125, 50, 0.08)' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2">{recommendation}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {parsedInsights.insights.length === 0 && parsedInsights.patterns.length === 0 && 
       parsedInsights.trends.length === 0 && parsedInsights.recommendations.length === 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {insights}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default AIInsights;
