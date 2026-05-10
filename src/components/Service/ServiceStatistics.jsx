import React, { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  Typography,
  Card,
  CardContent,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Box,
  MenuItem,
  TextField,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Divider,
  Button,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';
import {
  Build as BuildIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, format, isWithinInterval } from 'date-fns';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DateRangeIcon from '@mui/icons-material/DateRange';

function ServiceStatistics() {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    xlider: {
      totalCustomers: 0,
      totalServices: 0,
      pendingServices: 0,
      completedServices: 0,
      monthlyStats: {
        total: 0,
        completed: 0,
        avgProcessingDays: 0,
        totalPartsAmount: 0
      },
      partsStatistics: {
        totalPartsAmount: 0,
        averagePartsAmount: 0,
        monthlyPartsTotal: 0,
        topParts: []
      },
      statusDistribution: []
    },
    nearbike: {
      totalCustomers: 0,
      totalServices: 0,
      pendingServices: 0,
      completedServices: 0,
      monthlyStats: {
        total: 0,
        completed: 0,
        avgProcessingDays: 0,
        totalPartsAmount: 0
      },
      partsStatistics: {
        totalPartsAmount: 0,
        averagePartsAmount: 0,
        monthlyPartsTotal: 0,
        topParts: []
      },
      statusDistribution: []
    }
  });

  const [tagStatistics, setTagStatistics] = useState({
    xlider: {},
    nearbike: {}
  });

  const [extendedStats, setExtendedStats] = useState({
    xlider: {
      customerRetention: {
        repeatCustomers: 0,
        repeatRate: 0,
        avgVisitsPerCustomer: 0
      },
      serviceEfficiency: {
        avgResponseTime: 0,
        avgRepairTime: 0,
        satisfactionRate: 0
      },
      revenueAnalysis: {
        totalRevenue: 0,
        avgRevenuePerService: 0,
        monthlyRevenue: [],
        categoryRevenue: {}
      },
      seasonalTrends: {
        peakMonths: [],
        lowMonths: [],
        seasonalPatterns: {}
      },
      productAnalysis: {
        commonIssues: [],
        productCategories: [],
        warrantyServices: 0
      }
    },
    nearbike: {
      customerRetention: {
        repeatCustomers: 0,
        repeatRate: 0,
        avgVisitsPerCustomer: 0
      },
      serviceEfficiency: {
        avgResponseTime: 0,
        avgRepairTime: 0,
        satisfactionRate: 0
      },
      revenueAnalysis: {
        totalRevenue: 0,
        avgRevenuePerService: 0,
        monthlyRevenue: [],
        categoryRevenue: {}
      },
      seasonalTrends: {
        peakMonths: [],
        lowMonths: [],
        seasonalPatterns: {}
      },
      productAnalysis: {
        commonIssues: [],
        productCategories: [],
        warrantyServices: 0
      }
    }
  });

  const brandColors = {
    xlider: {
      main: '#000000',
      light: '#f5f5f5',
      text: '#ffffff'
    },
    nearbike: {
      main: '#1976d2',
      light: '#e3f2fd',
      text: '#ffffff'
    }
  };

  const [activeTab, setActiveTab] = useState(0);

  // 기간 필터 상태
  const [periodFilter, setPeriodFilter] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(subDays(new Date(), 30));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // 원본 데이터 저장
  const [rawData, setRawData] = useState({
    xlider: {
      services: [],
      parts: []
    },
    nearbike: {
      services: [],
      parts: []
    }
  });

  const statusColors = {
    '접수': '#3182f6',
    '처리중': '#ffa927',
    '부분완료': '#4e5968',
    '완료': '#00c773'
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 기간 변경 시 통계 재계산
  useEffect(() => {
    if (rawData.xlider.services.length > 0 || rawData.nearbike.services.length > 0) {
      calculateStatistics();
    }
  }, [periodFilter, customStartDate, customEndDate, rawData]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // 브랜드별 데이터 가져오기
      const brands = ['XRB', 'NBK'];
      const newRawData = {
        xlider: { services: [], parts: [] },
        nearbike: { services: [], parts: [] }
      };

      for (const brand of brands) {
        const brandKey = brand === 'XRB' ? 'xlider' : 'nearbike';

        // 1. 서비스 데이터 가져오기
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select(`
            *,
            service_parts (
              id,
              part_id,
              quantity,
              price,
              usage
            ),
            service_tags (
              tag_name
            )
          `)
          .eq('brand', brand);

        if (servicesError) throw servicesError;
        newRawData[brandKey].services = services || [];

        // 2. 부품 데이터 가져오기
        const { data: parts, error: partsError } = await supabase
          .from('parts')
          .select('*')
          .eq('brand', brand);

        if (partsError) throw partsError;
        newRawData[brandKey].parts = parts || [];

        // 3. 서비스 부품 연결 데이터 가져오기
        const { data: serviceParts, error: servicePartsError } = await supabase
          .from('service_parts')
          .select(`
            *,
            parts:part_id (
              id,
              name,
              code,
              price
            )
          `);

        if (servicePartsError) throw servicePartsError;
        
        // 서비스 데이터에 부품 정보 연결
        if (services && serviceParts) {
          for (const service of services) {
            service.parts = serviceParts.filter(sp => 
              sp.service_id === service.id
            );
          }
        }
      }

      setRawData(newRawData);
      calculateStatistics();
      setLoading(false);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setLoading(false);
    }
  };

  const calculateStatistics = () => {
    const dateRange = getDateRange();
    const newStatistics = {
      xlider: { ...statistics.xlider },
      nearbike: { ...statistics.nearbike }
    };
    const newTagStats = {
      xlider: {},
      nearbike: {}
    };

    // 브랜드별 통계 계산
    ['xlider', 'nearbike'].forEach(brand => {
      const services = rawData[brand].services || [];

      // 반품 차감 유틸리티
      const getEffectiveQty = (part) => {
        let returnedQty = 0;
        const usage = part.usage || '';
        if (usage.includes('[반품완료]')) {
          returnedQty = part.quantity || 0;
        } else if (usage.includes('[부분반품:')) {
          const matches = usage.match(/\[부분반품:(\d+)개\]/g);
          if (matches) {
            matches.forEach(m => {
              const qm = m.match(/\[부분반품:(\d+)개\]/);
              if (qm && qm[1]) returnedQty += parseInt(qm[1], 10);
            });
          }
        }
        return Math.max(0, (part.quantity || 0) - returnedQty);
      };
      
      // 선택된 기간 내의 서비스만 필터링
      const filteredServices = services.filter(service => {
        const receptionDate = new Date(service.reception_date);
        return isWithinInterval(receptionDate, dateRange);
      });

      // 고객 수 계산 (중복 제거)
      const uniqueCustomers = [...new Set(filteredServices.map(service => service.customer_phone))];
      
      // 상태별 서비스 수
      const pendingServices = filteredServices.filter(service => 
        !['완료', '출고완료', '수령완료'].includes(service.status)
      ).length;
      
      const completedServices = filteredServices.filter(service => 
        ['완료', '출고완료', '수령완료'].includes(service.status)
      ).length;

      // 상태 분포 계산
      const statusCounts = filteredServices.reduce((acc, service) => {
        acc[service.status] = (acc[service.status] || 0) + 1;
        return acc;
      }, {});

      const statusDistribution = Object.keys(statusCounts).map(status => ({
        name: status,
        value: statusCounts[status],
        color: statusColors[status] || '#999999'
      }));

      // 평균 처리 기간 계산
      const completedWithDates = filteredServices.filter(service => 
        ['완료', '출고완료', '수령완료'].includes(service.status) && service.completion_date && service.reception_date
      );

      let avgProcessingDays = 0;
      if (completedWithDates.length > 0) {
        const totalDays = completedWithDates.reduce((sum, service) => {
          const receptionDate = new Date(service.reception_date);
          const completionDate = new Date(service.completion_date);
          const days = Math.round((completionDate - receptionDate) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgProcessingDays = totalDays / completedWithDates.length;
      }

      // 부품 통계 계산
      let totalPartsAmount = 0;
      const partUsage = {};

      filteredServices.forEach(service => {
        if (service.service_parts && service.service_parts.length > 0) {
          service.service_parts.forEach(part => {
            const effQty = getEffectiveQty(part);
            const amount = (part.price || 0) * effQty;
            totalPartsAmount += amount;

            // 부품별 사용 통계
            if (part.part_id) {
              if (!partUsage[part.part_id]) {
                partUsage[part.part_id] = {
                  id: part.part_id,
                  count: 0,
                  totalAmount: 0
                };
              }
              partUsage[part.part_id].count += effQty;
              partUsage[part.part_id].totalAmount += amount;
            }
          });
        }
      });

      // 부품 이름 매핑
      const partsWithNames = Object.values(partUsage).map(part => {
        const partInfo = rawData[brand].parts.find(p => p.id === part.id) || {};
        return {
          ...part,
          name: partInfo.name || '알 수 없는 부품',
          code: partInfo.code || '-'
        };
      });

      // 태그 통계 계산
      filteredServices.forEach(service => {
        if (service.service_tags && service.service_tags.length > 0) {
          service.service_tags.forEach(tag => {
            const tagName = tag.tag_name;
            newTagStats[brand][tagName] = (newTagStats[brand][tagName] || 0) + 1;
          });
        }
      });

      // 통계 업데이트
      newStatistics[brand] = {
        totalCustomers: uniqueCustomers.length,
        totalServices: filteredServices.length,
        pendingServices,
        completedServices,
        monthlyStats: {
          total: filteredServices.length,
          completed: completedServices,
          avgProcessingDays: parseFloat(avgProcessingDays.toFixed(1)),
          totalPartsAmount
        },
        partsStatistics: {
          totalPartsAmount,
          averagePartsAmount: filteredServices.length > 0 
            ? parseFloat((totalPartsAmount / filteredServices.length).toFixed(0)) 
            : 0,
          topParts: partsWithNames
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 5)
        },
        statusDistribution
      };
    });

    setStatistics(newStatistics);
    setTagStatistics(newTagStats);
  };

  // 기간 변경 핸들러
  const handlePeriodChange = (event, newPeriod) => {
    if (newPeriod !== null) {
      setPeriodFilter(newPeriod);
      setShowCustomDatePicker(newPeriod === 'custom');
    }
  };

  // 현재 선택된 기간에 따라 날짜 범위 계산
  const getDateRange = () => {
    const now = new Date();
    
    switch (periodFilter) {
      case 'day':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'year':
        return {
          start: startOfYear(now),
          end: endOfYear(now)
        };
      case 'custom':
        return {
          start: startOfDay(customStartDate),
          end: endOfDay(customEndDate)
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getBrandName = (brand) => {
    return brand === 'xlider' ? '엑스라이더' : '니어바이크';
  };

  const getBrandColor = (brand) => {
    return brand === 'xlider' ? '#3182f6' : '#00c773';
  };

  // 기간 필터 UI 렌더링
  const renderPeriodFilter = () => {
    return (
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2 }}>
        <ToggleButtonGroup
          value={periodFilter}
          exclusive
          onChange={handlePeriodChange}
          aria-label="기간 필터"
          sx={{ 
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 500,
              px: 2
            }
          }}
        >
          <ToggleButton value="day">오늘</ToggleButton>
          <ToggleButton value="week">이번 주</ToggleButton>
          <ToggleButton value="month">이번 달</ToggleButton>
          <ToggleButton value="year">올해</ToggleButton>
          <ToggleButton value="custom">기간 지정</ToggleButton>
        </ToggleButtonGroup>
        
        {showCustomDatePicker && (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <DatePicker
                label="시작일"
                value={customStartDate}
                onChange={(newValue) => setCustomStartDate(newValue)}
                renderInput={(params) => <TextField size="small" {...params} />}
              />
              <Typography variant="body2">~</Typography>
              <DatePicker
                label="종료일"
                value={customEndDate}
                onChange={(newValue) => setCustomEndDate(newValue)}
                renderInput={(params) => <TextField size="small" {...params} />}
              />
            </Box>
          </LocalizationProvider>
        )}
        
        <Button 
          startIcon={<RefreshIcon />}
          onClick={fetchAllData}
          variant="outlined"
          sx={{ ml: 'auto' }}
        >
          새로고침
        </Button>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const renderStatistics = (brand) => {
    const stats = statistics[brand];
    const brandColor = getBrandColor(brand);
    const brandName = getBrandName(brand);
    
    // 기간 표시 텍스트
    const dateRange = getDateRange();
    const periodText = periodFilter === 'custom' 
      ? `${format(dateRange.start, 'yyyy.MM.dd')} ~ ${format(dateRange.end, 'yyyy.MM.dd')}`
      : periodFilter === 'day' ? '오늘'
      : periodFilter === 'week' ? '이번 주'
      : periodFilter === 'month' ? '이번 달'
      : '올해';

    return (
      <Box>
        {/* 기간 표시 */}
        <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
          <CalendarTodayIcon sx={{ mr: 1, color: brandColor }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {brandName} 통계: {periodText}
          </Typography>
        </Paper>

        {/* 주요 통계 카드 */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <PersonIcon sx={{ fontSize: 40, color: brandColor, mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    전체 고객 수
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: brandColor }}>
                    {stats.totalCustomers}
                  </Typography>
                </Box>
              </CardContent>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <BuildIcon sx={{ fontSize: 40, color: brandColor, mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    전체 A/S 건수
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: brandColor }}>
                    {stats.totalServices}
                  </Typography>
                </Box>
              </CardContent>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <TimelineIcon sx={{ fontSize: 40, color: brandColor, mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    처리중 A/S
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: brandColor }}>
                    {stats.pendingServices}
                  </Typography>
                </Box>
              </CardContent>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <SpeedIcon sx={{ fontSize: 40, color: brandColor, mr: 2 }} />
                <Box>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    평균 처리 기간
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, color: brandColor }}>
                    {stats.monthlyStats.avgProcessingDays}일
                  </Typography>
                </Box>
              </CardContent>
            </Paper>
          </Grid>
        </Grid>

        {/* A/S 상태 분포 및 월간 통계 */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                A/S 상태 분포
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {stats.statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
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
                {periodText} 통계
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: `${brandColor}10`, borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: brandColor }}>
                      {stats.monthlyStats.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      전체 접수
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#00c77310', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#00c773' }}>
                      {stats.monthlyStats.completed}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      처리 완료
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#ffa92710', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 600, color: '#ffa927' }}>
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

        {/* 파츠 통계 */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
            파츠 사용 통계
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 3, bgcolor: `${brandColor}10`, borderRadius: 2 }}>
                <AttachMoneyIcon sx={{ fontSize: 40, color: brandColor, mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: brandColor }}>
                  {stats.partsStatistics.totalPartsAmount.toLocaleString()}원
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 파츠 사용 금액
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>품목</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>사용 횟수</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>총 금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.partsStatistics.topParts.length > 0 ? (
                      stats.partsStatistics.topParts.map((part, index) => (
                        <TableRow key={index}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell align="right">{part.count}회</TableCell>
                          <TableCell align="right">
                            {part.totalAmount.toLocaleString()}원
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          파츠 사용 데이터가 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </Paper>

        {/* 태그 통계 */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
            자주 사용된 태그
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            {Object.entries(tagStatistics[brand])
              .sort(([, a], [, b]) => b - a)
              .slice(0, 12)
              .map(([tag, count]) => (
                <Grid item xs={6} sm={4} md={3} key={tag}>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: `${brandColor}10`
                  }}>
                    <Chip 
                      label={tag}
                      size="small"
                      sx={{
                        bgcolor: `${brandColor}20`,
                        color: brandColor,
                        fontWeight: 500,
                        '& .MuiChip-label': {
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {count}건
                    </Typography>
                  </Box>
                </Grid>
              ))}
          </Grid>
        </Paper>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '1rem',
              py: 2
            },
            '& .Mui-selected': {
              color: activeTab === 0 ? '#3182f6' : '#00c773'
            },
            '& .MuiTabs-indicator': {
              backgroundColor: activeTab === 0 ? '#3182f6' : '#00c773'
            }
          }}
        >
          <Tab label="엑스라이더" />
          <Tab label="니어바이크" />
        </Tabs>
      </Paper>

      {/* 기간 필터 */}
      {renderPeriodFilter()}

      {activeTab === 0 ? renderStatistics('xlider') : renderStatistics('nearbike')}
    </Box>
  );
}

export default ServiceStatistics; 