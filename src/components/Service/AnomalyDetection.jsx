import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material';
import { detectAnomalies, analyzeAnomalies } from '../../utils/aiAnalysisUtils';

function AnomalyDetection({ analysisData }) {
  const [anomalies, setAnomalies] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (analysisData && analysisData.totalCount > 0) {
      const detected = detectAnomalies(analysisData);
      setAnomalies(detected);
    } else {
      setAnomalies([]);
    }
  }, [analysisData]);

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <ErrorIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'high':
        return '높음';
      case 'medium':
        return '보통';
      case 'low':
        return '낮음';
      default:
        return '알 수 없음';
    }
  };

  const handleAIAnalysis = async () => {
    if (anomalies.length === 0) {
      setError('분석할 이상 패턴이 없습니다.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAiAnalysis(null);

    try {
      const response = await analyzeAnomalies(anomalies, analysisData);
      setAiAnalysis(response);
    } catch (err) {
      console.error('AI 분석 오류:', {
        error: err,
        message: err?.message,
        stack: err?.stack
      });
      const errorMessage = err?.message || err?.toString() || 'AI 분석 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!analysisData || analysisData.totalCount === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
          분석할 데이터가 없습니다.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" /> 이상 패턴 탐지
        </Typography>
        {anomalies.length > 0 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={analyzing ? <CircularProgress size={16} /> : <LightbulbIcon />}
            onClick={handleAIAnalysis}
            disabled={analyzing}
          >
            {analyzing ? 'AI 분석 중...' : 'AI 심층 분석'}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {anomalies.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <InfoIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" color="success.main" gutterBottom>
            이상 패턴이 감지되지 않았습니다
          </Typography>
          <Typography color="textSecondary">
            현재 데이터는 정상적으로 보입니다.
          </Typography>
        </Box>
      ) : (
        <>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {anomalies.length}개의 이상 패턴이 감지되었습니다.
            </Typography>
          </Alert>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {anomalies.map((anomaly, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    borderLeft: `4px solid ${
                      anomaly.severity === 'high' ? '#d32f2f' :
                      anomaly.severity === 'medium' ? '#ed6c02' :
                      '#0288d1'
                    }`
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'start', mb: 1 }}>
                      {getSeverityIcon(anomaly.severity)}
                      <Box sx={{ flex: 1, ml: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {anomaly.title}
                        </Typography>
                        <Chip
                          label={getSeverityLabel(anomaly.severity)}
                          size="small"
                          color={getSeverityColor(anomaly.severity)}
                          sx={{ mb: 1 }}
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      {anomaly.description}
                    </Typography>
                    <Box sx={{ bgcolor: 'grey.50', p: 1, borderRadius: 1 }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                        권장사항:
                      </Typography>
                      <Typography variant="body2">
                        {anomaly.recommendation}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {aiAnalysis && (
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LightbulbIcon color="primary" /> AI 심층 분석 결과
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
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
                    {aiAnalysis}
                  </Typography>
                </Paper>
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}
    </Paper>
  );
}

export default AnomalyDetection;
