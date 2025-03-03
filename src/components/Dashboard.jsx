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
  Button
} from '@mui/material';
import {
  Build as BuildIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalServices: 0,
    pendingServices: 0,
    completedServices: 0,
    recentServices: [],
    monthlyStats: {
      total: 0,
      completed: 0,
      avgProcessingDays: 0
    },
    statusDistribution: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      if (servicesError) throw servicesError;

      // 고객 수 계산 (중복 제거)
      const uniqueCustomers = services 
        ? [...new Set(services.map(service => service.customer_phone))]
        : [];
      const totalCustomers = uniqueCustomers.length;

      // 3. 최근 서비스 데이터 가져오기 (최근 5개)
      const { data: recentServices, error: recentServicesError } = await supabase
        .from('services')
        .select(`
          id,
          customer_name,
          product_name,
          status,
          reception_date
        `)
        .order('reception_date', { ascending: false })
        .limit(5);

      if (recentServicesError) throw recentServicesError;

      // 이번 달 데이터 필터링
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // 안전하게 필터링 (services가 null이 아닌 경우에만)
      const monthlyServices = services ? services.filter(service => 
        new Date(service.reception_date) >= startOfMonth
      ) : [];

      // 상태별 분포 계산 (services가 null이 아닌 경우에만)
      const statusCounts = services ? services.reduce((acc, service) => {
        acc[service.status] = (acc[service.status] || 0) + 1;
        return acc;
      }, {}) : {};

      const statusDistribution = Object.keys(statusCounts).map(status => ({
        name: status,
        value: statusCounts[status],
        color: statusColors[status] || '#999999'
      }));

      // 평균 처리 기간 계산 (services가 null이 아닌 경우에만)
      const completedServices = services ? services.filter(service => 
        service.status === '완료' && service.completion_date && service.reception_date
      ) : [];

      let avgProcessingDays = 0;
      if (completedServices.length > 0) {
        const totalDays = completedServices.reduce((sum, service) => {
          const receptionDate = new Date(service.reception_date);
          const completionDate = new Date(service.completion_date);
          const days = Math.round((completionDate - receptionDate) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgProcessingDays = (totalDays / completedServices.length).toFixed(1);
      }

      // 데이터 설정 (null 체크 추가)
      setStats({
        totalCustomers: totalCustomers,
        totalServices: services?.length || 0,
        pendingServices: services ? services.filter(s => s.status !== '완료').length : 0,
        completedServices: services ? services.filter(s => s.status === '완료').length : 0,
        recentServices: recentServices ? recentServices.map(service => ({
          id: service.id,
          customerName: service.customer_name,
          productName: service.product_name,
          status: service.status,
          requestDate: new Date(service.reception_date).toLocaleDateString('ko-KR')
        })) : [],
        monthlyStats: {
          total: monthlyServices.length,
          completed: monthlyServices.filter(s => s.status === '완료').length,
          avgProcessingDays: avgProcessingDays
        },
        statusDistribution
      });
    } catch (err) {
      console.error('대시보드 데이터 로딩 오류:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
          대시보드
        </Typography>
        <Button 
          startIcon={<RefreshIcon />} 
          onClick={fetchDashboardData}
          sx={{ 
            color: 'primary.main',
            bgcolor: 'primary.light',
            '&:hover': { bgcolor: 'primary.light', opacity: 0.9 }
          }}
        >
          새로고침
        </Button>
      </Box>

      {/* 주요 통계 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <PersonIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  전체 고객 수
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  {stats.totalCustomers}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <BuildIcon sx={{ fontSize: 40, color: 'secondary.main', mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  전체 A/S 건수
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                  {stats.totalServices}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <TimelineIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  처리중 A/S
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'warning.main' }}>
                  {stats.pendingServices}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <SpeedIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
              <Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  평균 처리 기간
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'success.main' }}>
                  {stats.monthlyStats.avgProcessingDays}일
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 차트와 통계 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
              A/S 상태 분포
            </Typography>
            <Box sx={{ height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {stats.statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}건`, '건수']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  데이터가 없습니다
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
              이번 달 통계
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {stats.monthlyStats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    전체 접수
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: 'success.main' }}>
                    {stats.monthlyStats.completed}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    처리 완료
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: 'warning.main' }}>
                    {stats.monthlyStats.total > 0 
                      ? `${((stats.monthlyStats.completed / stats.monthlyStats.total) * 100).toFixed(1)}%` 
                      : '0%'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    완료율
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* 최근 A/S 목록 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
          최근 A/S 현황
        </Typography>
        <Divider sx={{ my: 2 }} />
        {stats.recentServices.length > 0 ? (
          <List>
            {stats.recentServices.map((service) => (
              <ListItem 
                key={service.id} 
                sx={{ 
                  borderRadius: 2, 
                  mb: 1, 
                  '&:hover': { bgcolor: 'background.default', cursor: 'pointer' } 
                }}
                onClick={() => handleServiceClick(service.id)}
              >
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      {service.customerName} - {service.productName}
                    </Typography>
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
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
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
    </Box>
  );
}

export default Dashboard; 