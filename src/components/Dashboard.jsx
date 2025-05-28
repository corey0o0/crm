import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Stack,
  LinearProgress,
  Tabs,
  Tab,
  TextField,
  Container,
  IconButton
} from '@mui/material';
import {
  Build as BuildIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  LocalShipping as LocalShippingIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import ServiceCalendar from './ServiceCalendar';
import { sendTelegramNotification } from '../lib/telegram';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import SendIcon from '@mui/icons-material/Send';

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, setUser } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedStatusBrand, setSelectedStatusBrand] = useState('ALL');
  const [selectedShipmentBrand, setSelectedShipmentBrand] = useState('ALL');
  const [selectedRecentBrand, setSelectedRecentBrand] = useState('ALL');
  const [memoList, setMemoList] = useState([
    { content: '', lastSaved: null },
    { content: '', lastSaved: null }
  ]);
  const [selectedMemoTab, setSelectedMemoTab] = useState(0);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalServices: 0,
    pendingServices: 0,
    completedServices: 0,
    recentServices: {
      ALL: [],
      XRB: [],
      NBK: []
    },
    recentShipments: [],
    monthlyStats: {
      total: 0,
      completed: 0,
      avgProcessingDays: 0
    },
    statusCounts: {
      접수: 0,
      처리중: 0,
      부분완료: 0,
      완료: 0
    },
    shipmentStats: {
      total: 0,
      pending: 0,
      completed: 0,
      todayShipments: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentShipments, setRecentShipments] = useState([]);
  const [telegramResult, setTelegramResult] = useState({ open: false, message: '', success: true });

  // 초기 사용자 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && !authLoading) {
          // 세션이 없는 경우 자동 로그인 시도
          const { data: { user: signInUser }, error: signInError } = await supabase.auth.signInWithPassword({
            email: localStorage.getItem('userEmail'),
            password: localStorage.getItem('userPassword')
          });

          if (signInError) throw signInError;
        }
      } catch (err) {
        console.error('세션 확인 중 오류:', err);
        setError(err.message);
      }
    };

    checkSession();
  }, [authLoading]);

  // 메모 불러오기
  useEffect(() => {
    const fetchMemos = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = user?.id || session?.user?.id;
        
        if (!userId) {
          console.log('사용자 인증 대기 중...');
          return;
        }

        // 먼저 메모 데이터가 있는지 확인
        const { data: existingMemo, error: checkError } = await supabase
          .from('user_memos')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('메모 조회 중 오류:', checkError);
          return;
        }

        // 메모 데이터가 없으면 새로 생성
        if (!existingMemo) {
          const { error: insertError } = await supabase
            .from('user_memos')
            .insert([
              {
                user_id: userId,
                updated_at: new Date().toISOString()
              }
            ]);

          if (insertError) {
            console.error('새 메모 생성 중 오류:', insertError);
            return;
          }

          // 새로 생성된 메모 데이터 조회
          const { data: newMemo, error: fetchError } = await supabase
            .from('user_memos')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (fetchError) {
            console.error('새 메모 조회 중 오류:', fetchError);
            return;
          }

          setMemoList(prev => [
            { content: newMemo.memo1 || '', lastSaved: newMemo.updated_at },
            { content: newMemo.memo2 || '', lastSaved: newMemo.updated_at }
          ]);
        } else {
          setMemoList(prev => [
            { content: existingMemo.memo1 || '', lastSaved: existingMemo.updated_at },
            { content: existingMemo.memo2 || '', lastSaved: existingMemo.updated_at }
          ]);
        }
      } catch (err) {
        console.error('메모 불러오기 오류:', err);
        setError(err.message);
      }
    };

    fetchMemos();

    // 실시간 업데이트를 위한 구독 설정
    const channel = supabase
      .channel('user_memos_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_memos',
          filter: `user_id=eq.${user?.id}`
        },
        payload => {
          if (payload.new) {
            setMemoList(prev => prev.map((m, i) => i === 0 ? { ...m, content: payload.new.memo1 || '', lastSaved: payload.new.updated_at } : i === 1 ? { ...m, content: payload.new.memo2 || '', lastSaved: payload.new.updated_at } : m));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // 메모 저장
  const handleSaveMemo = async (idx) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = user?.id || session?.user?.id;
      if (!userId) return;
      const now = new Date().toISOString();
      // memo1~memo5로 upsert
      const upsertData = {
        user_id: userId,
        updated_at: now,
        memo1: memoList[0]?.content || '',
        memo2: memoList[1]?.content || '',
        memo3: memoList[2]?.content || '',
        memo4: memoList[3]?.content || '',
        memo5: memoList[4]?.content || ''
      };
      const { error } = await supabase
        .from('user_memos')
        .upsert(upsertData, { onConflict: 'user_id' });
      if (error) throw error;
      setMemoList(prev => prev.map((m, i) => i === idx ? { ...m, lastSaved: now } : m));
    } catch (err) {
      setError(err.message);
    }
  };
  
  // 메모 내용 변경
  const handleMemoContentChange = (idx, value) => {
    setMemoList(prev => prev.map((m, i) => i === idx ? { ...m, content: value } : m));
  };

  // 새 메모 추가
  const handleAddMemo = () => {
    if (memoList.length >= 5) return; // 최대 5개 제한
    setMemoList(prev => [...prev, { content: '', lastSaved: null }]);
    setSelectedMemoTab(memoList.length);
  };

  // 메모 삭제
  const handleDeleteMemo = (idx) => {
    if (memoList.length <= 2) return; // 최소 2개 보장
    setMemoList(prev => prev.filter((_, i) => i !== idx));
    setSelectedMemoTab(0);
  };

  // 메모 탭 변경
  const handleMemoTabChange = (event, newValue) => setSelectedMemoTab(newValue);

  // 상태별 색상 정의
  const statusColors = {
    '접수': '#3182f6',
    '처리중': '#ffa927',
    '부분완료': '#4e5968',
    '완료': '#00c773'
  };

  // 데이터 가져오기
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 서비스 데이터 가져오기
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('reception_date', { ascending: false });

      if (servicesError) {
        console.error('서비스 데이터 조회 오류:', servicesError);
        throw new Error('서비스 데이터를 불러오는데 실패했습니다.');
      }

      // 2. 출고 데이터 가져오기
      let shipments = [];
      try {
        const { data: shipmentsData, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .order('created_at', { ascending: false });

        if (shipmentsError) {
          console.error('출고 데이터 조회 오류:', shipmentsError);
          throw new Error(`출고 데이터를 불러오는데 실패했습니다: ${shipmentsError.message}`);
        }

        if (!shipmentsData) {
          console.warn('출고 데이터가 없습니다.');
          shipments = [];
        } else {
          shipments = shipmentsData;
        }
      } catch (shipmentError) {
        console.error('출고 데이터 처리 중 오류:', shipmentError);
        throw new Error('출고 데이터 처리 중 오류가 발생했습니다.');
      }

      // 3. 최근 서비스 데이터 가져오기
      const { data: recentServices, error: recentServicesError } = await supabase
        .from('services')
        .select(`
          id,
          customer_name,
          product_name,
          status,
          reception_date,
          brand
        `)
        .order('reception_date', { ascending: false });

      if (recentServicesError) {
        console.error('최근 서비스 데이터 조회 오류:', recentServicesError);
        throw new Error('최근 서비스 데이터를 불러오는데 실패했습니다.');
      }

      // 4. 최근 출고 데이터 가져오기
      let recentShipments = [];
      try {
        const { data: recentShipmentsData, error: recentShipmentsError } = await supabase
          .from('shipments')
          .select(`
            id,
            customer_name,
            customer_phone,
            product_name,
            status,
            created_at,
            shipment_date,
            brand
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentShipmentsError) {
          console.error('최근 출고 데이터 조회 오류:', recentShipmentsError);
          throw new Error(`최근 출고 데이터를 불러오는데 실패했습니다: ${recentShipmentsError.message}`);
        }

        if (!recentShipmentsData) {
          console.warn('최근 출고 데이터가 없습니다.');
          recentShipments = [];
        } else {
          recentShipments = recentShipmentsData;
        }
      } catch (recentShipmentError) {
        console.error('최근 출고 데이터 처리 중 오류:', recentShipmentError);
        throw new Error('최근 출고 데이터 처리 중 오류가 발생했습니다.');
      }

      // 안전한 데이터 처리를 위한 기본값 설정
      const safeServices = services || [];
      const safeShipments = shipments || [];
      const safeRecentServices = recentServices || [];
      const safeRecentShipments = recentShipments || [];

      // 고객 수 계산
      const uniqueCustomers = [...new Set(safeServices.map(service => service.customer_phone))];
      const totalCustomers = uniqueCustomers.length;

      // 날짜 기준 설정
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 이번 달 서비스 데이터 필터링
      const monthlyServices = safeServices.filter(service => 
        new Date(service.reception_date) >= startOfMonth
      );

      // 상태별 카운트 계산
      const statusCounts = {
        접수: 0,
        처리중: 0,
        부분완료: 0,
        완료: 0
      };

      safeServices.forEach(service => {
        if (statusCounts.hasOwnProperty(service.status)) {
          statusCounts[service.status]++;
        }
      });

      // 출고 통계 계산
      const shipmentStats = {
        total: safeShipments.length,
        pending: safeShipments.filter(s => !s.shipment_date).length,
        completed: safeShipments.filter(s => s.shipment_date).length,
        todayShipments: safeShipments.filter(s => {
          const shipDate = new Date(s.created_at);
          return shipDate >= today;
        }).length
      };

      // 평균 처리 기간 계산
      const completedServices = safeServices.filter(service => 
        service.status === '완료' && service.completion_date && service.reception_date
      );

      let avgProcessingDays = 0;
      if (completedServices.length > 0) {
        const totalDays = completedServices.reduce((sum, service) => {
          const receptionDate = new Date(service.reception_date);
          const completionDate = new Date(service.completion_date);
          const days = Math.round((completionDate - receptionDate) / (1000 * 60 * 60 * 24));
          return sum + Math.max(0, days); // 음수 일수 방지
        }, 0);
        avgProcessingDays = (totalDays / completedServices.length).toFixed(1);
      }

      // 브랜드별 최근 서비스 데이터 정리
      const processedRecentServices = {
        ALL: [],
        XRB: [],
        NBK: []
      };

      // 전체 데이터
      processedRecentServices.ALL = safeRecentServices
        .slice(0, 5)  // 이미 5건으로 제한되어 있음
        .map(service => ({
          id: service.id,
          customerName: service.customer_name || '이름 없음',
          productName: service.product_name || '제품명 없음',
          status: service.status || '상태 없음',
          brand: service.brand || 'UNKNOWN',
          requestDate: service.reception_date ? 
            new Date(service.reception_date).toLocaleDateString('ko-KR') : 
            '날짜 없음'
        }));

      // X-RIDER 데이터
      processedRecentServices.XRB = safeRecentServices
        .filter(service => service.brand === 'XRB')
        .slice(0, 5)
        .map(service => ({
          id: service.id,
          customerName: service.customer_name || '이름 없음',
          productName: service.product_name || '제품명 없음',
          status: service.status || '상태 없음',
          brand: service.brand,
          requestDate: service.reception_date ? 
            new Date(service.reception_date).toLocaleDateString('ko-KR') : 
            '날짜 없음'
        }));

      // NEARBIKE 데이터
      processedRecentServices.NBK = safeRecentServices
        .filter(service => service.brand === 'NBK')
        .slice(0, 5)
        .map(service => ({
          id: service.id,
          customerName: service.customer_name || '이름 없음',
          productName: service.product_name || '제품명 없음',
          status: service.status || '상태 없음',
          brand: service.brand,
          requestDate: service.reception_date ? 
            new Date(service.reception_date).toLocaleDateString('ko-KR') : 
            '날짜 없음'
        }));

      // 최근 출고 데이터 처리
      const processedRecentShipments = safeRecentShipments.map(shipment => ({
        id: shipment.id,
        customerName: shipment.customer_name || '이름 없음',
        customerPhone: shipment.customer_phone || '전화번호 없음',
        productName: shipment.product_name || '제품명 없음',
        status: shipment.shipment_date ? '출고완료' : '출고대기',
        brand: shipment.brand || 'UNKNOWN',
        shipDate: shipment.shipment_date ? 
          new Date(shipment.shipment_date).toLocaleDateString('ko-KR') :
          new Date(shipment.created_at).toLocaleDateString('ko-KR')
      }));

      setStats({
        totalCustomers,
        totalServices: safeServices.length,
        pendingServices: safeServices.filter(s => s.status !== '완료').length,
        completedServices: safeServices.filter(s => s.status === '완료').length,
        recentServices: processedRecentServices,
        recentShipments: processedRecentShipments,
        monthlyStats: {
          total: monthlyServices.length,
          completed: monthlyServices.filter(s => s.status === '완료').length,
          avgProcessingDays
        },
        statusCounts,
        shipmentStats
      });

    } catch (err) {
      console.error('대시보드 데이터 로딩 오류:', err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case '접수': return 'info';
      case '처리중': return 'warning';
      case '부분완료': return 'secondary';
      case '완료': return 'success';
      default: return 'default';
    }
  };

  const handleServiceClick = (serviceId) => {
    navigate(`/services/${serviceId}`);
  };

  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
  };

  const handleStatusBrandChange = (brand) => {
    setSelectedStatusBrand(brand);
  };

  const handleShipmentBrandChange = (brand) => {
    setSelectedShipmentBrand(brand);
  };

  const handleRecentBrandChange = (brand) => {
    setSelectedRecentBrand(brand);
  };

  const fetchRecentShipments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('shipments')
        .select(`
          id,
          customer_name,
          customer_phone,
          product_name,
          status,
          created_at,
          shipment_date,
          brand
        `)
        .order('created_at', { ascending: false })
        .limit(5);  // 10에서 5로 수정

      // ALL이 아닐 때만 브랜드 필터링 적용
      if (selectedBrand !== 'ALL') {
        query = query.eq('brand', selectedBrand);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 데이터 처리 개선
      const processedShipments = data.map(shipment => ({
        id: shipment.id,
        customerName: shipment.customer_name || '이름 없음',
        customerPhone: shipment.customer_phone || '전화번호 없음',
        productName: shipment.product_name || '제품명 없음',
        status: shipment.shipment_date ? '출고완료' : '출고대기',
        brand: shipment.brand || 'UNKNOWN',
        shipDate: shipment.shipment_date ? 
          new Date(shipment.shipment_date).toLocaleDateString('ko-KR') :
          new Date(shipment.created_at).toLocaleDateString('ko-KR')
      }));

      setRecentShipments(processedShipments);
    } catch (err) {
      console.error('Error fetching recent shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentShipments();
  }, [selectedBrand]);

  const handleSendMemoToTelegram = async (idx) => {
    const content = memoList[idx]?.content?.trim();
    if (!content) {
      setTelegramResult({ open: true, message: '메모 내용이 비어 있습니다.', success: false });
      return;
    }
    try {
      await sendTelegramNotification(`[메모 ${idx + 1}]\n${content}`);
      setTelegramResult({ open: true, message: '텔레그램 전송 성공!', success: true });
    } catch (e) {
      setTelegramResult({ open: true, message: '텔레그램 전송 실패', success: false });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          startIcon={<RefreshIcon />} 
          onClick={fetchDashboardData}
          sx={{ mt: 2 }}
        >
          다시 시도
        </Button>
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ mt: 3 }}>
    <Box sx={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        width: '100%',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
          대시보드
        </Typography>
        <Button 
          startIcon={<RefreshIcon />} 
          onClick={fetchDashboardData}
          size="small"
          sx={{ 
            color: 'primary.main',
            bgcolor: 'primary.light',
            '&:hover': { bgcolor: 'primary.light', opacity: 0.9 },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          새로고침
        </Button>
      </Box>

      {/* 메모 섹션 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 메모 1 */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', border: '1px solid #e9ecef', minHeight: '200px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ color: '#4e5968', fontSize: '0.875rem', fontWeight: 600 }}>
                메모 1
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {memoList[0]?.lastSaved && (
                  <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.75rem' }}>
                    마지막 저장: {dayjs(memoList[0].lastSaved).locale('ko').format('YYYY.MM.DD HH:mm')}
                  </Typography>
                )}
                <Tooltip title="이 메모를 텔레그램으로 전송">
                  <IconButton onClick={() => handleSendMemoToTelegram(0)} size="small">
                    <SendIcon fontSize="small" color="primary" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <TextField
              multiline
              fullWidth
              value={memoList[0]?.content || ''}
              onChange={e => handleMemoContentChange(0, e.target.value)}
              placeholder="메모를 입력하세요..."
              variant="outlined"
              sx={{
                flex: 1,
                bgcolor: '#fff',
                fontSize: '0.875rem',
                mt: 2,
                '& textarea': {
                  flex: 1,
                  resize: 'vertical',
                  minHeight: '100px',
                  maxHeight: '500px'
                }
              }}
            />
            <Button
              variant="contained"
              onClick={() => handleSaveMemo(0)}
              sx={{ bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, alignSelf: 'flex-end', mt: 2 }}
            >
              저장
            </Button>
          </Paper>
        </Grid>
        {/* 메모 2 */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', border: '1px solid #e9ecef', minHeight: '200px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ color: '#4e5968', fontSize: '0.875rem', fontWeight: 600 }}>
                메모 2
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {memoList[1]?.lastSaved && (
                  <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.75rem' }}>
                    마지막 저장: {dayjs(memoList[1].lastSaved).locale('ko').format('YYYY.MM.DD HH:mm')}
                  </Typography>
                )}
                <Tooltip title="이 메모를 텔레그램으로 전송">
                  <IconButton onClick={() => handleSendMemoToTelegram(1)} size="small">
                    <SendIcon fontSize="small" color="primary" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <TextField
              multiline
              fullWidth
              value={memoList[1]?.content || ''}
              onChange={e => handleMemoContentChange(1, e.target.value)}
              placeholder="메모를 입력하세요..."
              variant="outlined"
              sx={{
                flex: 1,
                bgcolor: '#fff',
                fontSize: '0.875rem',
                mt: 2,
                '& textarea': {
                  flex: 1,
                  resize: 'vertical',
                  minHeight: '100px',
                  maxHeight: '500px'
                }
              }}
            />
            <Button
              variant="contained"
              onClick={() => handleSaveMemo(1)}
              sx={{ bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, alignSelf: 'flex-end', mt: 2 }}
            >
              저장
            </Button>
          </Paper>
        </Grid>
        {/* 3번 이상 메모는 탭으로 */}
        {memoList.length > 2 && (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', border: '1px solid #e9ecef', minHeight: '200px' }}>
              <Tabs value={selectedMemoTab} onChange={handleMemoTabChange} variant="scrollable" scrollButtons="auto">
                {memoList.slice(2).map((_, idx) => (
                  <Tab label={`메모 ${idx + 3}`} key={idx} />
                ))}
                <Tab label="+ 새 메모" onClick={handleAddMemo} disabled={memoList.length >= 5} />
              </Tabs>
              {memoList.slice(2).map((memo, idx) => (
                selectedMemoTab === idx && (
                  <Box key={idx} sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ color: '#4e5968', fontSize: '0.875rem', fontWeight: 600 }}>
                        메모 {idx + 3}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {memo.lastSaved && (
                          <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.75rem' }}>
                            마지막 저장: {dayjs(memo.lastSaved).locale('ko').format('YYYY.MM.DD HH:mm')}
                          </Typography>
                        )}
                        <Tooltip title="이 메모를 텔레그램으로 전송">
                          <IconButton onClick={() => handleSendMemoToTelegram(idx + 2)} size="small">
                            <SendIcon fontSize="small" color="primary" />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => handleDeleteMemo(idx + 2)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    <TextField
                      multiline
                      fullWidth
                      value={memo.content}
                      onChange={e => handleMemoContentChange(idx + 2, e.target.value)}
                      placeholder="메모를 입력하세요..."
                      variant="outlined"
                      sx={{
                        flex: 1,
                        bgcolor: '#fff',
                        fontSize: '0.875rem',
                        mt: 2,
                        '& textarea': {
                          flex: 1,
                          resize: 'vertical',
                          minHeight: '100px',
                          maxHeight: '500px'
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleSaveMemo(idx + 2)}
                      sx={{ bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, alignSelf: 'flex-end', mt: 2 }}
                    >
                      저장
                    </Button>
                  </Box>
                )
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* 캘린더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <ServiceCalendar />
      </Box>

      {/* A/S 상태 및 출고 현황 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                A/S 상태 현황
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'space-between', sm: 'flex-start' },
                '& .MuiButton-root': {
                  flex: { xs: '1 1 calc(33% - 4px)', sm: 'none' },
                  minWidth: { xs: 'calc(33% - 4px)', sm: 'auto' },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  padding: { xs: '4px 8px', sm: '6px 16px' }
                }
              }}>
                <Button 
                  size="small"
                  variant={selectedStatusBrand === 'ALL' ? 'contained' : 'outlined'}
                  onClick={() => handleStatusBrandChange('ALL')}
                >
                  전체
                </Button>
                <Button 
                  size="small"
                  variant={selectedStatusBrand === 'XRB' ? 'contained' : 'outlined'}
                  onClick={() => handleStatusBrandChange('XRB')}
                >
                  X-RIDER
                </Button>
                <Button 
                  size="small"
                  variant={selectedStatusBrand === 'NBK' ? 'contained' : 'outlined'}
                  onClick={() => handleStatusBrandChange('NBK')}
                >
                  NEARBIKE
                </Button>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={2}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">접수</Typography>
                  <Typography variant="body2" color="text.primary">{stats.statusCounts.접수}건</Typography>
                </Stack>
              </Box>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">처리중</Typography>
                  <Typography variant="body2" color="text.primary">{stats.statusCounts.처리중}건</Typography>
                </Stack>
              </Box>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">부분완료</Typography>
                  <Typography variant="body2" color="text.primary">{stats.statusCounts.부분완료}건</Typography>
                </Stack>
              </Box>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">완료</Typography>
                  <Typography variant="body2" color="text.primary">{stats.statusCounts.완료}건</Typography>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                출고 현황
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'space-between', sm: 'flex-start' },
                '& .MuiButton-root': {
                  flex: { xs: '1 1 calc(33% - 4px)', sm: 'none' },
                  minWidth: { xs: 'calc(33% - 4px)', sm: 'auto' },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  padding: { xs: '4px 8px', sm: '6px 16px' }
                }
              }}>
                <Button 
                  size="small"
                  variant={selectedShipmentBrand === 'ALL' ? 'contained' : 'outlined'}
                  onClick={() => handleShipmentBrandChange('ALL')}
                >
                  전체
                </Button>
                <Button 
                  size="small"
                  variant={selectedShipmentBrand === 'XRB' ? 'contained' : 'outlined'}
                  onClick={() => handleShipmentBrandChange('XRB')}
                >
                  X-RIDER
                </Button>
                <Button 
                  size="small"
                  variant={selectedShipmentBrand === 'NBK' ? 'contained' : 'outlined'}
                  onClick={() => handleShipmentBrandChange('NBK')}
                >
                  NEARBIKE
                </Button>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#e3f2fd', p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <LocalShippingIcon sx={{ fontSize: 30, color: '#1976d2' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">오늘 출고</Typography>
                      <Typography variant="h5" sx={{ color: '#1976d2', fontWeight: 600 }}>
                        {stats.shipmentStats.todayShipments}건
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card sx={{ bgcolor: '#e8f5e9', p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <LocalShippingIcon sx={{ fontSize: 30, color: '#2e7d32' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">총 출고</Typography>
                      <Typography variant="h5" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                        {stats.shipmentStats.completed}건
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* 최근 현황 섹션 */}
      <Grid container spacing={3}>
        {/* 최근 A/S 현황 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                최근 A/S 현황
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'space-between', sm: 'flex-start' },
                '& .MuiButton-root': {
                  flex: { xs: '1 1 calc(33% - 4px)', sm: 'none' },
                  minWidth: { xs: 'calc(33% - 4px)', sm: 'auto' },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  padding: { xs: '4px 8px', sm: '6px 16px' }
                }
              }}>
                <Button 
                  size="small"
                  variant={selectedRecentBrand === 'ALL' ? 'contained' : 'outlined'}
                  onClick={() => handleRecentBrandChange('ALL')}
                >
                  전체
                </Button>
                <Button 
                  size="small"
                  variant={selectedRecentBrand === 'XRB' ? 'contained' : 'outlined'}
                  onClick={() => handleRecentBrandChange('XRB')}
                >
                  X-RIDER
                </Button>
                <Button 
                  size="small"
                  variant={selectedRecentBrand === 'NBK' ? 'contained' : 'outlined'}
                  onClick={() => handleRecentBrandChange('NBK')}
                >
                  NEARBIKE
                </Button>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            {stats.recentServices[selectedRecentBrand].length > 0 ? (
              <List>
                {stats.recentServices[selectedRecentBrand].map((service) => (
                  <ListItem 
                    key={service.id} 
                    sx={{ 
                      borderRadius: 2, 
                      mb: 1,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'background.default', cursor: 'pointer' } 
                    }}
                    onClick={() => handleServiceClick(service.id)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            {service.customerName} - {service.productName}
                          </Typography>
                          <Chip 
                            label={service.brand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'} 
                            size="small"
                            sx={{ 
                              bgcolor: service.brand === 'XRB' ? '#e3f2fd' : '#e8f5e9',
                              color: service.brand === 'XRB' ? '#1976d2' : '#2e7d32',
                              fontWeight: 600
                            }}
                          />
                        </Box>
                      }
                      secondary={service.requestDate}
                    />
                    <Chip 
                      label={service.status} 
                      color={getStatusColor(service.status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  최근 A/S 데이터가 없습니다
                </Typography>
              </Box>
            )}
            <Box sx={{ 
              mt: 2, 
              display: 'flex', 
              justifyContent: 'flex-end',
              '& .MuiButton-root': {
                width: { xs: '100%', sm: 'auto' },
                fontSize: { xs: '0.875rem', sm: '0.875rem' }
              }
            }}>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/services')}
                sx={{ 
                  color: 'primary.main', 
                  borderColor: 'primary.main',
                  '&:hover': { borderColor: 'primary.dark', bgcolor: 'primary.light' }
                }}
              >
                모든 A/S 보기
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* 최근 출고 현황 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                최근 출고 현황
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 1,
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' },
                justifyContent: { xs: 'space-between', sm: 'flex-start' },
                '& .MuiButton-root': {
                  flex: { xs: '1 1 calc(33% - 4px)', sm: 'none' },
                  minWidth: { xs: 'calc(33% - 4px)', sm: 'auto' },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  padding: { xs: '4px 8px', sm: '6px 16px' }
                }
              }}>
                <Button 
                  size="small"
                  variant={selectedBrand === 'ALL' ? 'contained' : 'outlined'}
                  onClick={() => handleBrandChange(null, 'ALL')}
                >
                  전체
                </Button>
                <Button 
                  size="small"
                  variant={selectedBrand === 'XRB' ? 'contained' : 'outlined'}
                  onClick={() => handleBrandChange(null, 'XRB')}
                >
                  X-RIDER
                </Button>
                <Button 
                  size="small"
                  variant={selectedBrand === 'NBK' ? 'contained' : 'outlined'}
                  onClick={() => handleBrandChange(null, 'NBK')}
                >
                  NEARBIKE
                </Button>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            {recentShipments.length > 0 ? (
              <List>
                {recentShipments.map((shipment) => (
                  <ListItem 
                    key={shipment.id} 
                    sx={{ 
                      borderRadius: 2, 
                      mb: 1,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'background.default', cursor: 'pointer' } 
                    }}
                    onClick={() => navigate(`/shipments/${shipment.id}`)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                              {shipment.customerName}
                            </Typography>
                            <Chip 
                              label={shipment.brand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'} 
                              size="small"
                              sx={{ 
                                bgcolor: shipment.brand === 'XRB' ? '#e3f2fd' : '#e8f5e9',
                                color: shipment.brand === 'XRB' ? '#1976d2' : '#2e7d32',
                                fontWeight: 600
                              }}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {shipment.productName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {shipment.customerPhone}
                          </Typography>
                        </Box>
                      }
                      secondary={shipment.shipDate}
                    />
                    <Chip 
                      label={shipment.status} 
                      color={shipment.status === '출고완료' ? 'success' : 'warning'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  최근 출고 데이터가 없습니다
                </Typography>
              </Box>
            )}
            <Box sx={{ 
              mt: 2, 
              display: 'flex', 
              justifyContent: 'flex-end',
              '& .MuiButton-root': {
                width: { xs: '100%', sm: 'auto' },
                fontSize: { xs: '0.875rem', sm: '0.875rem' }
              }
            }}>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/shipments')}
                sx={{ 
                  color: 'primary.main', 
                  borderColor: 'primary.main',
                  '&:hover': { borderColor: 'primary.dark', bgcolor: 'primary.light' }
                }}
              >
                모든 출고 보기
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
    <Snackbar
      open={telegramResult.open}
      autoHideDuration={2500}
      onClose={() => setTelegramResult(r => ({ ...r, open: false }))}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <MuiAlert
        onClose={() => setTelegramResult(r => ({ ...r, open: false }))}
        severity={telegramResult.success ? 'success' : 'error'}
        sx={{ width: '100%' }}
        elevation={6}
        variant="filled"
      >
        {telegramResult.message}
      </MuiAlert>
    </Snackbar>
    </Container>
  );
}

export default Dashboard; 