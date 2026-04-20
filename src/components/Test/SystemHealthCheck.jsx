import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { serviceApi } from '../../api/services';
import { inventoryApi } from '../../api/inventoryApi';
import { productApi } from '../../api/productApi';
import { initializeGoogleAPI } from '../../lib/googleDriveConfig';

const SystemHealthCheck = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [overallStatus, setOverallStatus] = useState('unknown');
  const [expandedSection, setExpandedSection] = useState('env');

  // 상태 정의
  const STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    UNKNOWN: 'unknown'
  };

  // 전체 점검 실행
  const runAllChecks = async () => {
    setLoading(true);
    setResults({}); // 결과 초기화
    setOverallStatus('unknown');

    try {
      // 1. 환경 변수 확인
      const envResult = await checkEnvironmentVariables();
      setResults(prev => ({ ...prev, env: envResult }));

      // 2. Supabase 연결 확인
      const supabaseResult = await checkSupabaseConnection();
      setResults(prev => ({ ...prev, supabase: supabaseResult }));

      // 3. 인증 상태 확인
      const authResult = await checkAuthStatus();
      setResults(prev => ({ ...prev, auth: authResult }));

      // 4. API 엔드포인트 테스트
      const apisResult = await checkApiEndpoints();
      setResults(prev => ({ ...prev, apis: apisResult }));

      // 5. 데이터베이스 테이블 확인
      const dbResult = await checkDatabaseTables();
      setResults(prev => ({ ...prev, database: dbResult }));

      // 6. 외부 서비스 연결 확인
      const extResult = await checkExternalServices();
      setResults(prev => ({ ...prev, external: extResult }));

      // 7. 권한 및 RLS 확인
      const permResult = await checkPermissions();
      setResults(prev => ({ ...prev, permissions: permResult }));

      // 전체 상태 계산 (모든 결과가 모인 후)
      const finalResults = {
        env: envResult,
        supabase: supabaseResult,
        auth: authResult,
        apis: apisResult,
        database: dbResult,
        external: extResult,
        permissions: permResult
      };

      const status = calculateOverallStatus(finalResults);
      setOverallStatus(status);

    } catch (error) {
      console.error('전체 점검 중 오류:', error);
      setResults(prev => ({
        ...prev,
        error: {
          status: STATUS.ERROR,
          message: error.message,
          details: error.stack
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 자동 실행 제거
  // useEffect(() => {
  //   runAllChecks();
  // }, []);
  const checkEnvironmentVariables = async () => {
    const checks = {};
    const env = window._env_ || {};

    const requiredVars = [
      'REACT_APP_SUPABASE_URL',
      'REACT_APP_SUPABASE_ANON_KEY',
      'REACT_APP_OPENAI_API_KEY',
      'REACT_APP_GOOGLE_CLIENT_ID',
      'REACT_APP_TELEGRAM_BOT_TOKEN',
      'REACT_APP_BASE_URL'
    ];

    const optionalVars = [
      'REACT_APP_CLOUDMARSSIVE_API_KEY',
      'REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID',
      'REACT_APP_TELEGRAM_CHAT_ID'
    ];

    requiredVars.forEach(key => {
      const value = env[key] || process.env[key] || '';
      checks[key] = {
        status: value ? STATUS.SUCCESS : STATUS.ERROR,
        value: value ? `${value.substring(0, 20)}...` : '설정되지 않음',
        message: value ? '설정됨' : '필수 환경 변수가 설정되지 않았습니다'
      };
    });

    optionalVars.forEach(key => {
      const value = env[key] || process.env[key] || '';
      checks[key] = {
        status: value ? STATUS.SUCCESS : STATUS.WARNING,
        value: value ? `${value.substring(0, 20)}...` : '설정되지 않음',
        message: value ? '설정됨' : '선택적 환경 변수가 설정되지 않았습니다'
      };
    });

    const allRequiredSet = requiredVars.every(key => {
      const value = env[key] || process.env[key] || '';
      return !!value;
    });

    return {
      status: allRequiredSet ? STATUS.SUCCESS : STATUS.ERROR,
      checks,
      message: allRequiredSet
        ? '모든 필수 환경 변수가 설정되어 있습니다'
        : '일부 필수 환경 변수가 누락되었습니다'
    };
  };

  // Supabase 연결 확인
  const checkSupabaseConnection = async () => {
    const checks = {};

    try {
      // 연결 테스트
      const { error: testError } = await supabase
        .from('services')
        .select('id')
        .limit(1);

      checks.connection = {
        status: !testError ? STATUS.SUCCESS : STATUS.ERROR,
        message: !testError ? 'Supabase 연결 성공' : `연결 실패: ${testError.message}`
      };

      // URL 및 키 확인
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || window._env_?.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || window._env_?.REACT_APP_SUPABASE_ANON_KEY;

      checks.config = {
        status: (supabaseUrl && supabaseKey) ? STATUS.SUCCESS : STATUS.ERROR,
        message: (supabaseUrl && supabaseKey)
          ? 'Supabase 설정이 올바릅니다'
          : 'Supabase URL 또는 키가 설정되지 않았습니다',
        details: {
          url: supabaseUrl ? '설정됨' : '설정되지 않음',
          key: supabaseKey ? '설정됨' : '설정되지 않음'
        }
      };

      return {
        status: (!testError && supabaseUrl && supabaseKey) ? STATUS.SUCCESS : STATUS.ERROR,
        checks,
        message: !testError ? 'Supabase 연결이 정상입니다' : 'Supabase 연결에 문제가 있습니다'
      };
    } catch (error) {
      return {
        status: STATUS.ERROR,
        checks: {
          connection: {
            status: STATUS.ERROR,
            message: `연결 오류: ${error.message}`
          }
        },
        message: `Supabase 연결 확인 중 오류: ${error.message}`
      };
    }
  };

  // 인증 상태 확인
  const checkAuthStatus = async () => {
    const checks = {};

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      checks.session = {
        status: currentSession ? STATUS.SUCCESS : STATUS.WARNING,
        message: currentSession ? '세션이 활성화되어 있습니다' : '세션이 없습니다 (로그인 필요)',
        details: {
          user: currentSession?.user?.email || '없음',
          expiresAt: currentSession?.expires_at ? new Date(currentSession.expires_at * 1000).toLocaleString() : '없음'
        }
      };

      checks.userContext = {
        status: user ? STATUS.SUCCESS : STATUS.WARNING,
        message: user ? '사용자 컨텍스트가 로드되었습니다' : '사용자 컨텍스트가 없습니다',
        details: {
          email: user?.email || '없음',
          id: user?.id || '없음'
        }
      };

      return {
        status: (currentSession && user) ? STATUS.SUCCESS : STATUS.WARNING,
        checks,
        message: (currentSession && user)
          ? '인증 상태가 정상입니다'
          : '인증이 필요합니다'
      };
    } catch (error) {
      return {
        status: STATUS.ERROR,
        checks: {
          session: {
            status: STATUS.ERROR,
            message: `인증 확인 오류: ${error.message}`
          }
        },
        message: `인증 상태 확인 중 오류: ${error.message}`
      };
    }
  };

  // API 엔드포인트 테스트
  const checkApiEndpoints = async () => {
    const results = {};

    // Services API 테스트
    try {
      const services = await serviceApi.getAll();
      results.services = {
        status: STATUS.SUCCESS,
        message: `서비스 조회 성공 (${services.length}개 항목)`,
        data: { count: services.length }
      };
    } catch (error) {
      results.services = {
        status: STATUS.ERROR,
        message: `서비스 조회 실패: ${error.message}`
      };
    }

    // Inventory API 테스트
    try {
      const inventory = await inventoryApi.getAll();
      results.inventory = {
        status: STATUS.SUCCESS,
        message: `인벤토리 조회 성공 (${inventory.length}개 항목)`,
        data: { count: inventory.length }
      };
    } catch (error) {
      results.inventory = {
        status: STATUS.ERROR,
        message: `인벤토리 조회 실패: ${error.message}`
      };
    }

    // Product API 테스트
    try {
      const products = await productApi.getAll();
      results.products = {
        status: STATUS.SUCCESS,
        message: `제품 조회 성공 (${products.length}개 항목)`,
        data: { count: products.length }
      };
    } catch (error) {
      results.products = {
        status: STATUS.ERROR,
        message: `제품 조회 실패: ${error.message}`
      };
    }

    const allSuccess = Object.values(results).every(r => r.status === STATUS.SUCCESS);
    const hasError = Object.values(results).some(r => r.status === STATUS.ERROR);

    return {
      status: allSuccess ? STATUS.SUCCESS : (hasError ? STATUS.ERROR : STATUS.WARNING),
      checks: results,
      message: allSuccess
        ? '모든 API 엔드포인트가 정상입니다'
        : '일부 API 엔드포인트에 문제가 있습니다'
    };
  };

  // 데이터베이스 테이블 확인
  const checkDatabaseTables = async () => {
    const tables = [
      'services',
      'customers',
      'shipments',
      'shipment_parts',
      'inventory',
      'parts',
      'inventory_logs',
      'user_memos',
      'brand_settings'
    ];

    const results = {};
    let successCount = 0;

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          results[table] = {
            status: STATUS.ERROR,
            message: `테이블 접근 실패: ${error.message}`
          };
        } else {
          results[table] = {
            status: STATUS.SUCCESS,
            message: '테이블 접근 성공',
            data: { accessible: true }
          };
          successCount++;
        }
      } catch (error) {
        results[table] = {
          status: STATUS.ERROR,
          message: `테이블 확인 오류: ${error.message}`
        };
      }
    }

    return {
      status: successCount === tables.length
        ? STATUS.SUCCESS
        : (successCount > 0 ? STATUS.WARNING : STATUS.ERROR),
      checks: results,
      message: `${successCount}/${tables.length}개 테이블에 접근 가능합니다`
    };
  };

  // 외부 서비스 연결 확인
  const checkExternalServices = async () => {
    const checks = {};

    // Cloudflare R2 확인
    try {
      // 5초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google API 초기화 시간 초과 (5초)')), 5000)
      );

      await Promise.race([initializeGoogleAPI(), timeoutPromise]);

      checks.googleDrive = {
        status: STATUS.SUCCESS,
        message: 'Cloudflare R2 API 초기화 성공'
      };
    } catch (error) {
      checks.googleDrive = {
        status: STATUS.WARNING,
        message: `Cloudflare R2 API 초기화 실패: ${error.message}`
      };
    }

    // Telegram 확인 (API 키만 확인)
    const telegramToken = window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN || process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
    checks.telegram = {
      status: telegramToken ? STATUS.SUCCESS : STATUS.WARNING,
      message: telegramToken ? 'Telegram 봇 토큰이 설정되어 있습니다' : 'Telegram 봇 토큰이 설정되지 않았습니다'
    };

    // OpenAI 확인 (API 키만 확인)
    const openaiKey = window._env_?.REACT_APP_OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY;
    checks.openai = {
      status: openaiKey ? STATUS.SUCCESS : STATUS.WARNING,
      message: openaiKey ? 'OpenAI API 키가 설정되어 있습니다' : 'OpenAI API 키가 설정되지 않았습니다'
    };

    const allSuccess = Object.values(checks).every(c => c.status === STATUS.SUCCESS);
    const hasError = Object.values(checks).some(c => c.status === STATUS.ERROR);

    return {
      status: allSuccess ? STATUS.SUCCESS : (hasError ? STATUS.ERROR : STATUS.WARNING),
      checks,
      message: allSuccess
        ? '모든 외부 서비스가 연결되어 있습니다'
        : '일부 외부 서비스에 문제가 있습니다'
    };
  };

  // 권한 및 RLS 확인
  const checkPermissions = async () => {
    const checks = {};

    try {
      // 사용자 역할 확인
      if (user) {
        checks.userRole = {
          status: STATUS.SUCCESS,
          message: '사용자 정보가 확인되었습니다',
          details: {
            email: user.email,
            id: user.id
          }
        };
      } else {
        checks.userRole = {
          status: STATUS.WARNING,
          message: '로그인된 사용자가 없습니다'
        };
      }

      // RLS 정책 확인 (services 테이블 접근 테스트)
      try {
        const { error } = await supabase
          .from('services')
          .select('id')
          .limit(1);

        checks.rls = {
          status: !error ? STATUS.SUCCESS : STATUS.WARNING,
          message: !error
            ? 'RLS 정책이 올바르게 작동합니다'
            : `RLS 정책 문제: ${error.message}`
        };
      } catch (error) {
        checks.rls = {
          status: STATUS.WARNING,
          message: `RLS 확인 오류: ${error.message}`
        };
      }

      return {
        status: Object.values(checks).every(c => c.status === STATUS.SUCCESS || c.status === STATUS.WARNING)
          ? STATUS.SUCCESS
          : STATUS.WARNING,
        checks,
        message: '권한 및 RLS 확인 완료'
      };
    } catch (error) {
      return {
        status: STATUS.ERROR,
        checks: {
          error: {
            status: STATUS.ERROR,
            message: `권한 확인 오류: ${error.message}`
          }
        },
        message: `권한 확인 중 오류: ${error.message}`
      };
    }
  };

  // 전체 상태 계산
  const calculateOverallStatus = (results) => {
    const statuses = Object.values(results).map(r => r.status);

    if (statuses.every(s => s === STATUS.SUCCESS)) {
      return STATUS.SUCCESS;
    } else if (statuses.some(s => s === STATUS.ERROR)) {
      return STATUS.ERROR;
    } else {
      return STATUS.WARNING;
    }
  };

  // 상태 아이콘
  const getStatusIcon = (status) => {
    switch (status) {
      case STATUS.SUCCESS:
        return <CheckCircleIcon color="success" />;
      case STATUS.ERROR:
        return <ErrorIcon color="error" />;
      case STATUS.WARNING:
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon color="disabled" />;
    }
  };

  // 상태 색상
  const getStatusColor = (status) => {
    switch (status) {
      case STATUS.SUCCESS:
        return 'success';
      case STATUS.ERROR:
        return 'error';
      case STATUS.WARNING:
        return 'warning';
      default:
        return 'default';
    }
  };

  // 결과를 JSON으로 다운로드
  const downloadResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-health-check-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            시스템 건강 상태 점검
          </Typography>
          <Box>
            <Tooltip title="결과 다운로드">
              <span>
                <IconButton onClick={downloadResults} disabled={!results || Object.keys(results).length === 0}>
                  <DownloadIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={runAllChecks}
              disabled={loading}
              sx={{ ml: 1 }}
            >
              {loading ? '점검 중...' : '전체 점검'}
            </Button>
          </Box>
        </Box>

        {loading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              시스템 점검을 진행하고 있습니다...
              ({Object.keys(results).length} / 7 완료)
            </Typography>
          </Box>
        )}

        {/* 전체 상태 요약 */}
        {overallStatus !== 'unknown' && !loading && (
          <Alert
            severity={getStatusColor(overallStatus)}
            sx={{ mb: 3 }}
            icon={getStatusIcon(overallStatus)}
          >
            <Typography variant="h6">
              전체 상태: {
                overallStatus === STATUS.SUCCESS ? '정상' :
                  overallStatus === STATUS.ERROR ? '오류 발견' :
                    '경고'
              }
            </Typography>
          </Alert>
        )}

        {/* 결과 섹션 */}
        {Object.keys(results).length > 0 && !loading && (
          <Box>
            {/* 환경 변수 */}
            <Accordion
              expanded={expandedSection === 'env'}
              onChange={() => setExpandedSection(expandedSection === 'env' ? '' : 'env')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.env?.status)}
                  <Typography variant="h6">환경 변수</Typography>
                  <Chip
                    label={results.env?.status}
                    color={getStatusColor(results.env?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {results.env?.checks && Object.entries(results.env.checks).map(([key, check]) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {getStatusIcon(check.status)}
                            <Typography variant="subtitle2">{key}</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {check.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            값: {check.value}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity={getStatusColor(results.env?.status)} sx={{ mt: 2 }}>
                  {results.env?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>

            {/* Supabase 연결 */}
            <Accordion
              expanded={expandedSection === 'supabase'}
              onChange={() => setExpandedSection(expandedSection === 'supabase' ? '' : 'supabase')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.supabase?.status)}
                  <Typography variant="h6">Supabase 연결</Typography>
                  <Chip
                    label={results.supabase?.status}
                    color={getStatusColor(results.supabase?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {results.supabase?.checks && Object.entries(results.supabase.checks).map(([key, check]) => (
                  <Card key={key} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getStatusIcon(check.status)}
                        <Typography variant="subtitle2">{key}</Typography>
                      </Box>
                      <Typography variant="body2">{check.message}</Typography>
                      {check.details && (
                        <Box sx={{ mt: 1 }}>
                          {Object.entries(check.details).map(([k, v]) => (
                            <Typography key={k} variant="caption" color="text.secondary">
                              {k}: {v}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Alert severity={getStatusColor(results.supabase?.status)} sx={{ mt: 2 }}>
                  {results.supabase?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>

            {/* 인증 상태 */}
            <Accordion
              expanded={expandedSection === 'auth'}
              onChange={() => setExpandedSection(expandedSection === 'auth' ? '' : 'auth')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.auth?.status)}
                  <Typography variant="h6">인증 상태</Typography>
                  <Chip
                    label={results.auth?.status}
                    color={getStatusColor(results.auth?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {results.auth?.checks && Object.entries(results.auth.checks).map(([key, check]) => (
                  <Card key={key} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getStatusIcon(check.status)}
                        <Typography variant="subtitle2">{key}</Typography>
                      </Box>
                      <Typography variant="body2">{check.message}</Typography>
                      {check.details && (
                        <Box sx={{ mt: 1 }}>
                          {Object.entries(check.details).map(([k, v]) => (
                            <Typography key={k} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {k}: {v}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Alert severity={getStatusColor(results.auth?.status)} sx={{ mt: 2 }}>
                  {results.auth?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>

            {/* API 엔드포인트 */}
            <Accordion
              expanded={expandedSection === 'apis'}
              onChange={() => setExpandedSection(expandedSection === 'apis' ? '' : 'apis')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.apis?.status)}
                  <Typography variant="h6">API 엔드포인트</Typography>
                  <Chip
                    label={results.apis?.status}
                    color={getStatusColor(results.apis?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {results.apis?.checks && Object.entries(results.apis.checks).map(([key, check]) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {getStatusIcon(check.status)}
                            <Typography variant="subtitle2">{key}</Typography>
                          </Box>
                          <Typography variant="body2">{check.message}</Typography>
                          {check.data && (
                            <Box sx={{ mt: 1 }}>
                              {Object.entries(check.data).map(([k, v]) => (
                                <Typography key={k} variant="caption" color="text.secondary">
                                  {k}: {v}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity={getStatusColor(results.apis?.status)} sx={{ mt: 2 }}>
                  {results.apis?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>

            {/* 데이터베이스 테이블 */}
            <Accordion
              expanded={expandedSection === 'database'}
              onChange={() => setExpandedSection(expandedSection === 'database' ? '' : 'database')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.database?.status)}
                  <Typography variant="h6">데이터베이스 테이블</Typography>
                  <Chip
                    label={results.database?.status}
                    color={getStatusColor(results.database?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {results.database?.checks && Object.entries(results.database.checks).map(([key, check]) => (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {getStatusIcon(check.status)}
                            <Typography variant="subtitle2">{key}</Typography>
                          </Box>
                          <Typography variant="body2">{check.message}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity={getStatusColor(results.database?.status)} sx={{ mt: 2 }}>
                  {results.database?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>

            {/* 외부 서비스 */}
            <Accordion
              expanded={expandedSection === 'external'}
              onChange={() => setExpandedSection(expandedSection === 'external' ? '' : 'external')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.external?.status)}
                  <Typography variant="h6">외부 서비스</Typography>
                  <Chip
                    label={results.external?.status}
                    color={getStatusColor(results.external?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {results.external?.checks && Object.entries(results.external.checks).map(([key, check]) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {getStatusIcon(check.status)}
                            <Typography variant="subtitle2">{key}</Typography>
                          </Box>
                          <Typography variant="body2">{check.message}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity={getStatusColor(results.external?.status)} sx={{ mt: 2 }}>
                  {results.external?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>

            {/* 권한 및 RLS */}
            <Accordion
              expanded={expandedSection === 'permissions'}
              onChange={() => setExpandedSection(expandedSection === 'permissions' ? '' : 'permissions')}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  {getStatusIcon(results.permissions?.status)}
                  <Typography variant="h6">권한 및 RLS</Typography>
                  <Chip
                    label={results.permissions?.status}
                    color={getStatusColor(results.permissions?.status)}
                    size="small"
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {results.permissions?.checks && Object.entries(results.permissions.checks).map(([key, check]) => (
                  <Card key={key} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getStatusIcon(check.status)}
                        <Typography variant="subtitle2">{key}</Typography>
                      </Box>
                      <Typography variant="body2">{check.message}</Typography>
                      {check.details && (
                        <Box sx={{ mt: 1 }}>
                          {Object.entries(check.details).map(([k, v]) => (
                            <Typography key={k} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {k}: {v}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Alert severity={getStatusColor(results.permissions?.status)} sx={{ mt: 2 }}>
                  {results.permissions?.message}
                </Alert>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {!loading && Object.keys(results).length === 0 && (
          <Alert severity="info">
            점검을 시작하려면 "전체 점검" 버튼을 클릭하세요.
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default SystemHealthCheck;
