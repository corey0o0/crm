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
  Tab
} from '@mui/material';
import {
  Build as BuildIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function Dashboard() {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedStatusBrand, setSelectedStatusBrand] = useState('ALL');
  const [selectedShipmentBrand, setSelectedShipmentBrand] = useState('ALL');
  const [selectedRecentBrand, setSelectedRecentBrand] = useState('ALL');
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
          .limit(10);

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
        .slice(0, 5)
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
        .limit(10);

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
  );
}

export default Dashboard; 