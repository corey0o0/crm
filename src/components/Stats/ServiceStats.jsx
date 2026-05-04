import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  MenuItem,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineConnector from '@mui/lab/TimelineConnector';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Build as BuildIcon,
  AttachMoney as MoneyIcon,
  LocalOffer as TagIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function ServiceStats() {
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [selectedPeriod, setSelectedPeriod] = useState(6); // 기본 6개월
  const [tabValue, setTabValue] = useState(0);
  const [statsData, setStatsData] = useState({
    totalCount: 0,
    totalAmount: 0,
    monthlyStats: [],
    statusStats: [],
    typeStats: [],
    tagStats: [],
    brandStats: [],
    avgProcessingTime: 0,
    recentServices: []
  });

  useEffect(() => {
    fetchServiceStats();
  }, [selectedBrand, selectedPeriod]);

  const fetchServiceStats = async () => {
    try {
      setLoading(true);
      
      // 기간 설정
      const endDate = endOfMonth(new Date());
      const startDate = startOfMonth(subMonths(endDate, selectedPeriod - 1));
      
      // A/S 데이터 조회
      let query = supabase
        .from('services')
        .select('*, service_parts(price, quantity)')
        .gte('reception_date', startDate.toISOString())
        .lte('reception_date', endDate.toISOString());
      
      if (selectedBrand !== '전체') {
        query = query.eq('brand', selectedBrand);
      }
      
      const { data: services, error } = await query;
      
      if (error) throw error;

      // 월별 통계 계산
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const monthlyStats = months.map(month => {
        const monthServices = services.filter(service => {
          const dateStr = service.reception_date || service.created_at;
          if (!dateStr) return false;
          return format(parseISO(dateStr), 'yyyy-MM') === format(month, 'yyyy-MM');
        });
        
        return {
          month: format(month, 'yyyy-MM'),
          count: monthServices.length,
          amount: monthServices.reduce((sum, service) => {
            const partsCost = service.service_parts?.reduce((pSum, part) => pSum + ((part.price || 0) * (part.quantity || 0)), 0) || 0;
            return sum + partsCost;
          }, 0)
        };
      });

      // 상태별 통계
      const statusCounts = {};
      services.forEach(service => {
        statusCounts[service.status] = (statusCounts[service.status] || 0) + 1;
      });
      
      const statusStats = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: (count / services.length * 100).toFixed(1)
      }));

      // 유형별 통계
      const typeCounts = {};
      services.forEach(service => {
        typeCounts[service.type] = (typeCounts[service.type] || 0) + 1;
      });
      
      const typeStats = Object.entries(typeCounts).map(([type, count]) => ({
        type,
        count,
        percentage: (count / services.length * 100).toFixed(1)
      }));

      // 태그 통계
      const tagCounts = {};
      services.forEach(service => {
        if (service.tags) {
          service.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });
      
      const tagStats = Object.entries(tagCounts)
        .map(([tag, count]) => ({
          tag,
          count,
          percentage: (count / services.length * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // 상위 10개 태그만 표시

      // 브랜드별 통계
      const brandCounts = {};
      const brandAmounts = {};
      services.forEach(service => {
        const partsCost = service.service_parts?.reduce((sum, part) => sum + ((part.price || 0) * (part.quantity || 0)), 0) || 0;
        brandCounts[service.brand] = (brandCounts[service.brand] || 0) + 1;
        brandAmounts[service.brand] = (brandAmounts[service.brand] || 0) + partsCost;
      });
      
      const brandStats = Object.entries(brandCounts).map(([brand, count]) => ({
        brand,
        count,
        amount: brandAmounts[brand],
        percentage: (count / services.length * 100).toFixed(1)
      }));

      // 평균 처리 시간 계산 (완료된 건만)
      const completedServices = services.filter(service => 
        service.status && service.status.includes('완료') && service.completion_date
      );
      
      let validCompletedCount = 0;
      const totalProcessingTime = completedServices.reduce((sum, service) => {
        const dateStr = service.reception_date || service.created_at;
        if (!dateStr) return sum;
        const start = new Date(dateStr).getTime();
        const end = new Date(service.completion_date).getTime();
        if (isNaN(start) || isNaN(end)) return sum;
        
        validCompletedCount++;
        return sum + (end - start);
      }, 0);
      
      const avgProcessingTime = validCompletedCount > 0
        ? totalProcessingTime / validCompletedCount / (1000 * 60 * 60 * 24) // 일 단위로 변환
        : 0;

      // 최근 A/S 목록
      const recentServices = [...services]
        .filter(s => s.reception_date || s.created_at)
        .sort((a, b) => new Date(b.reception_date || b.created_at) - new Date(a.reception_date || a.created_at))
        .slice(0, 5);

      setStatsData({
        totalCount: services.length,
        totalAmount: services.reduce((sum, service) => {
          const partsCost = service.service_parts?.reduce((pSum, part) => pSum + ((part.price || 0) * (part.quantity || 0)), 0) || 0;
          return sum + partsCost;
        }, 0),
        monthlyStats,
        statusStats,
        typeStats,
        tagStats,
        brandStats,
        avgProcessingTime,
        recentServices
      });

    } catch (error) {
      console.error('통계 데이터 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon /> A/S 통계
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="브랜드"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              sx={{ width: 150, mr: 2 }}
            >
              <MenuItem value="전체">전체</MenuItem>
              <MenuItem value="XRB">X-RIDER</MenuItem>
              <MenuItem value="NB">NEARBIKE</MenuItem>
            </TextField>
            <TextField
              select
              label="기간"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              sx={{ width: 150 }}
            >
              <MenuItem value={3}>최근 3개월</MenuItem>
              <MenuItem value={6}>최근 6개월</MenuItem>
              <MenuItem value={12}>최근 1년</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Box>

      {/* 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <BuildIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                총 A/S 건수
              </Typography>
              <Typography variant="h4">
                {statsData.totalCount.toLocaleString()}건
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <MoneyIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                총 A/S 금액
              </Typography>
              <Typography variant="h4">
                {statsData.totalAmount.toLocaleString()}원
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <TagIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                주요 A/S 유형
              </Typography>
              <Typography variant="h4">
                {statsData.typeStats[0]?.type || '-'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <ScheduleIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                평균 처리 시간
              </Typography>
              <Typography variant="h4">
                {statsData.avgProcessingTime.toFixed(1)}일
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 탭 메뉴 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="월별 추이" />
          <Tab label="상태별 현황" />
          <Tab label="유형 분석" />
          <Tab label="태그 분석" />
        </Tabs>
      </Paper>

      {/* 월별 추이 */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>월별 A/S 추이</Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer>
              <BarChart data={statsData.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(value) => format(parseISO(value), 'yyyy년 M월')}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'amount') return `${value.toLocaleString()}원`;
                    return `${value}건`;
                  }}
                  labelFormatter={(label) => format(parseISO(label), 'yyyy년 M월')}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="count" 
                  name="건수" 
                  fill="#8884d8" 
                />
                <Bar 
                  yAxisId="right"
                  dataKey="amount" 
                  name="금액" 
                  fill="#82ca9d" 
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      {/* 상태별 현황 */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>상태별 현황</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statsData.statusStats}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ status, percentage }) => `${status} (${percentage}%)`}
                    >
                      {statsData.statusStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>상태</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statsData.statusStats.map((stat) => (
                      <TableRow key={stat.status}>
                        <TableCell>{stat.status}</TableCell>
                        <TableCell align="right">{stat.count}건</TableCell>
                        <TableCell align="right">{stat.percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 유형 분석 */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>유형별 분석</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statsData.typeStats}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ type, percentage }) => `${type} (${percentage}%)`}
                    >
                      {statsData.typeStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>유형</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statsData.typeStats.map((stat) => (
                      <TableRow key={stat.type}>
                        <TableCell>{stat.type}</TableCell>
                        <TableCell align="right">{stat.count}건</TableCell>
                        <TableCell align="right">{stat.percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 태그 분석 */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>태그 분석</Typography>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>상위 태그</Typography>
            {statsData.tagStats.map((tag) => (
              <Chip
                key={tag.tag}
                label={`${tag.tag} (${tag.count})`}
                sx={{ m: 0.5 }}
              />
            ))}
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>태그</TableCell>
                  <TableCell align="right">사용 횟수</TableCell>
                  <TableCell align="right">비율</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statsData.tagStats.map((stat) => (
                  <TableRow key={stat.tag}>
                    <TableCell>{stat.tag}</TableCell>
                    <TableCell align="right">{stat.count}회</TableCell>
                    <TableCell align="right">{stat.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 최근 A/S 타임라인 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>최근 A/S 현황</Typography>
        <Timeline>
          {statsData.recentServices.map((service) => {
            const serviceCost = service.service_parts?.reduce((sum, part) => sum + ((part.price || 0) * (part.quantity || 0)), 0) || 0;
            return (
            <TimelineItem key={service.id}>
              <TimelineSeparator>
                <TimelineDot color={
                  service.status && service.status.includes('완료') ? 'success' :
                  service.status && service.status.includes('진행중') ? 'primary' :
                  'grey'
                } />
                <TimelineConnector />
              </TimelineSeparator>
              <TimelineContent>
                <Typography variant="subtitle2">
                  {(service.reception_date || service.created_at) 
                    ? format(parseISO(service.reception_date || service.created_at), 'yyyy년 M월 d일')
                    : '날짜 미상'}
                </Typography>
                <Typography>
                  {service.customer_name} - {service.type}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {service.description}
                </Typography>
                {serviceCost > 0 && (
                  <Typography variant="body2" color="primary">
                    비용: {serviceCost.toLocaleString()}원
                  </Typography>
                )}
                {service.tags && service.tags.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {service.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
              </TimelineContent>
            </TimelineItem>
            );
          })}
        </Timeline>
      </Paper>
    </Box>
  );
}

export default ServiceStats; 