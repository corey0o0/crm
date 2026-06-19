import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  useTheme,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { MASTER_ACCOUNTS } from '../../config/menuConfig';
import { startOfWeek, endOfWeek, format, parseISO, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import CalendarViewDayIcon from '@mui/icons-material/CalendarViewDay';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';

function ServiceStatistics() {
  const { user } = useAuth();
  const isMaster = user?.email && MASTER_ACCOUNTS.includes(user.email);
  const theme = useTheme();
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('monthly');
  const [dailyData, setDailyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyComparison, setYearlyComparison] = useState([]);
  const [profitAnalysis, setProfitAnalysis] = useState({});

  useEffect(() => {
    fetchStatisticsData();
  }, [selectedBrand, selectedYear, viewMode]);

  const fetchStatisticsData = async () => {
    setLoading(true);
    try {
      const { data: servicesData, error } = await supabase
        .from('services')
        .select(`
          *,
          service_parts (
            part_id,
            quantity,
            price,
            parts (
              cost_price,
              name
            )
          ),
          labor_cost
        `)
        .eq('brand', selectedBrand)
        .gte('reception_date', `${selectedYear}-01-01`)
        .lte('reception_date', `${selectedYear}-12-31`);

      if (error) throw error;

      // 일별, 주별, 월별 데이터 처리
      const daily = processDailyData(servicesData);
      const weekly = processWeeklyData(servicesData);
      const monthly = processMonthlyData(servicesData);

      setDailyData(daily);
      setWeeklyData(weekly);
      setMonthlyData(monthly);
      setProfitAnalysis(calculateProfitAnalysis(servicesData));

    } catch (error) {
      console.error('통계 데이터 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const processDailyData = (data) => {
    const dailyStats = {};
    
    data.forEach(service => {
      const date = service.reception_date;
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          count: 0,
          partsRevenue: 0,
          partsCost: 0,
          laborRevenue: 0,
          totalRevenue: 0,
          totalProfit: 0
        };
      }

      // 파츠 매출과 비용 계산
      let partsRevenue = 0;
      let partsCost = 0;
      service.service_parts?.forEach(part => {
        partsRevenue += part.price * part.quantity;
        partsCost += (part.parts?.cost_price || 0) * part.quantity;
      });

      // 공임 매출 계산
      const laborRevenue = service.labor_cost || 0;

      dailyStats[date].count++;
      dailyStats[date].partsRevenue += partsRevenue;
      dailyStats[date].partsCost += partsCost;
      dailyStats[date].laborRevenue += laborRevenue;
      dailyStats[date].totalRevenue += (partsRevenue + laborRevenue);
      dailyStats[date].totalProfit += (partsRevenue - partsCost + laborRevenue);
    });

    return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
  };

  const processWeeklyData = (data) => {
    const weeklyStats = {};
    
    data.forEach(service => {
      const date = parseISO(service.reception_date);
      const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekKey = `${weekStart}~${weekEnd}`;

      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = {
          week: weekKey,
          count: 0,
          partsRevenue: 0,
          partsCost: 0,
          laborRevenue: 0,
          totalRevenue: 0,
          totalProfit: 0
        };
      }

      // 파츠 매출과 비용 계산
      let partsRevenue = 0;
      let partsCost = 0;
      service.service_parts?.forEach(part => {
        partsRevenue += part.price * part.quantity;
        partsCost += (part.parts?.cost_price || 0) * part.quantity;
      });

      // 공임 매출 계산
      const laborRevenue = service.labor_cost || 0;

      weeklyStats[weekKey].count++;
      weeklyStats[weekKey].partsRevenue += partsRevenue;
      weeklyStats[weekKey].partsCost += partsCost;
      weeklyStats[weekKey].laborRevenue += laborRevenue;
      weeklyStats[weekKey].totalRevenue += (partsRevenue + laborRevenue);
      weeklyStats[weekKey].totalProfit += (partsRevenue - partsCost + laborRevenue);
    });

    return Object.values(weeklyStats).sort((a, b) => a.week.localeCompare(b.week));
  };

  const processMonthlyData = (data) => {
    const months = Array(12).fill(0).map((_, i) => ({
      month: i + 1,
      count: 0,
      partsRevenue: 0,
      partsCost: 0,
      laborRevenue: 0,
      totalRevenue: 0,
      totalProfit: 0
    }));

    data.forEach(service => {
      const month = service.reception_date ? new Date(service.reception_date).getMonth() : null;
      if (month === null || isNaN(month)) return;
      
      // 파츠 매출과 비용 계산
      let partsRevenue = 0;
      let partsCost = 0;
      service.service_parts?.forEach(part => {
        partsRevenue += part.price * part.quantity;
        partsCost += (part.parts?.cost_price || 0) * part.quantity;
      });

      // 공임 매출 계산
      const laborRevenue = service.labor_cost || 0;

      months[month].count++;
      months[month].partsRevenue += partsRevenue;
      months[month].partsCost += partsCost;
      months[month].laborRevenue += laborRevenue;
      months[month].totalRevenue += (partsRevenue + laborRevenue);
      months[month].totalProfit += (partsRevenue - partsCost + laborRevenue);
    });

    return months;
  };

  const calculateProfitAnalysis = (data) => {
    const totalStats = {
      partsRevenue: 0,
      partsCost: 0,
      laborRevenue: 0,
      totalRevenue: 0,
      totalProfit: 0
    };

    data.forEach(service => {
      let partsRevenue = 0;
      let partsCost = 0;
      service.service_parts?.forEach(part => {
        partsRevenue += part.price * part.quantity;
        partsCost += (part.parts?.cost_price || 0) * part.quantity;
      });

      const laborRevenue = service.labor_cost || 0;

      totalStats.partsRevenue += partsRevenue;
      totalStats.partsCost += partsCost;
      totalStats.laborRevenue += laborRevenue;
      totalStats.totalRevenue += (partsRevenue + laborRevenue);
      totalStats.totalProfit += (partsRevenue - partsCost + laborRevenue);
    });

    return totalStats;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let data = viewMode === 'daily' ? dailyData : 
               viewMode === 'weekly' ? weeklyData : monthlyData;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // 헤더 추가 (비마스터는 원가/순이익/이익률 제외)
    csvContent += isMaster
      ? "기간,건수,파츠매출,파츠비용,공임,총매출,순이익,이익률\n"
      : "기간,건수,파츠매출,공임,총매출\n";

    // 데이터 행 추가
    data.forEach(row => {
      const period = viewMode === 'monthly' ? `${row.month}월` :
                    viewMode === 'weekly' ? format(parseISO(row.week.split('~')[0]), 'MM/dd') :
                    format(parseISO(row.date), 'MM/dd');

      if (isMaster) {
        const profit = row.totalProfit;
        const margin = row.totalRevenue ? ((row.totalProfit / row.totalRevenue) * 100).toFixed(1) : 0;
        csvContent += `${period},${row.count},${row.partsRevenue},${row.partsCost},${row.laborRevenue},${row.totalRevenue},${profit},${margin}%\n`;
      } else {
        csvContent += `${period},${row.count},${row.partsRevenue},${row.laborRevenue},${row.totalRevenue}\n`;
      }
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedBrand}_${selectedYear}_${viewMode}_statistics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderProfitPieChart = () => {
    const data = [
      { name: '파츠 이익', value: profitAnalysis.partsRevenue - profitAnalysis.partsCost },
      { name: '공임', value: profitAnalysis.laborRevenue }
    ];
    const COLORS = [theme.palette.primary.main, theme.palette.secondary.main];

    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip formatter={(value) => value.toLocaleString() + '원'} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    let data = [];
    let xAxisKey = '';
    let xAxisFormatter = (value) => value;

    switch (viewMode) {
      case 'daily':
        data = dailyData;
        xAxisKey = 'date';
        xAxisFormatter = (value) => format(parseISO(value), 'MM/dd');
        break;
      case 'weekly':
        data = weeklyData;
        xAxisKey = 'week';
        xAxisFormatter = (value) => {
          const [start] = value.split('~');
          return format(parseISO(start), 'MM/dd');
        };
        break;
      case 'monthly':
        data = monthlyData;
        xAxisKey = 'month';
        xAxisFormatter = (value) => `${value}월`;
        break;
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis 
            dataKey={xAxisKey} 
            tickFormatter={xAxisFormatter}
            stroke={theme.palette.text.primary}
          />
          <YAxis 
            yAxisId="left"
            stroke={theme.palette.primary.main}
            label={{ 
              value: '매출액 (원)', 
              angle: -90, 
              position: 'insideLeft',
              style: { fill: theme.palette.text.primary }
            }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            stroke={theme.palette.secondary.main}
            label={{ 
              value: '건수', 
              angle: 90, 
              position: 'insideRight',
              style: { fill: theme.palette.text.primary }
            }}
          />
          <RechartsTooltip 
            formatter={(value) => value.toLocaleString()}
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`
            }}
          />
          <Legend />
          <Bar 
            yAxisId="left" 
            dataKey="partsRevenue" 
            name="파츠 매출" 
            fill={theme.palette.primary.main}
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            yAxisId="left" 
            dataKey="laborRevenue" 
            name="공임 매출" 
            fill={theme.palette.secondary.main}
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            yAxisId="right" 
            dataKey="count" 
            name="건수" 
            fill={theme.palette.info.main}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1800px', mx: 'auto', p: 3 }}>
      {/* 헤더 영역 */}
      <Box sx={{ 
        mb: 4, 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Typography variant="h4" component="h1" gutterBottom>
          A/S 통계 분석
        </Typography>
        
        <Stack direction="row" spacing={2}>
          <Tooltip title="CSV 다운로드">
            <IconButton onClick={handleExportCSV}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="프린트">
            <IconButton onClick={handlePrint}>
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* 필터 영역 */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Stack 
          direction="row" 
          spacing={2} 
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 2 }}
        >
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>브랜드</InputLabel>
            <Select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              label="브랜드"
              size="small"
            >
              <MenuItem value="XRB">X-RIDER</MenuItem>
              <MenuItem value="NB">NEARBIKE</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>연도</InputLabel>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              label="연도"
              size="small"
            >
              {[...Array(5)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <MenuItem key={year} value={year}>{year}년</MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            aria-label="통계 보기 모드"
            size="small"
          >
            <ToggleButton value="daily">
              <Tooltip title="일별 보기">
                <CalendarViewDayIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="weekly">
              <Tooltip title="주별 보기">
                <CalendarViewWeekIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="monthly">
              <Tooltip title="월별 보기">
                <CalendarViewMonthIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                파츠 매출/비용
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">매출</Typography>
                <Typography variant="h5" color="primary">
                  {profitAnalysis.partsRevenue?.toLocaleString()}원
                </Typography>
              </Box>
              {isMaster && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">비용</Typography>
                <Typography variant="h5" color="error">
                  {profitAnalysis.partsCost?.toLocaleString()}원
                </Typography>
              </Box>
              )}
              {isMaster && (
              <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="body2" color="textSecondary">순이익</Typography>
                <Typography variant="h5" color="success.main">
                  {(profitAnalysis.partsRevenue - profitAnalysis.partsCost)?.toLocaleString()}원
                </Typography>
              </Box>
              </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                공임
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" color="primary">
                  {profitAnalysis.laborRevenue?.toLocaleString()}원
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  전체 매출 대비: {profitAnalysis.totalRevenue ? ((profitAnalysis.laborRevenue / profitAnalysis.totalRevenue) * 100).toFixed(1) : '0.0'}%
                </Typography>
              </Box>
              {renderProfitPieChart()}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                총 실적
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">총 매출</Typography>
                <Typography variant="h5" color="primary">
                  {profitAnalysis.totalRevenue?.toLocaleString()}원
                </Typography>
              </Box>
              {isMaster && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">순이익</Typography>
                <Typography variant="h5" color="success.main">
                  {profitAnalysis.totalProfit?.toLocaleString()}원
                </Typography>
              </Box>
              )}
              {isMaster && (
              <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="body2" color="textSecondary">이익률</Typography>
                <Typography variant="h5" color={
                  profitAnalysis.totalRevenue && ((profitAnalysis.totalProfit / profitAnalysis.totalRevenue) * 100) > 20
                    ? 'success.main'
                    : 'warning.main'
                }>
                  {profitAnalysis.totalRevenue ? ((profitAnalysis.totalProfit / profitAnalysis.totalRevenue) * 100).toFixed(1) : '0.0'}%
                </Typography>
              </Box>
              </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 차트 */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          매출 추이
        </Typography>
        {renderChart()}
      </Paper>

      {/* 상세 테이블 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          상세 내역
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{viewMode === 'daily' ? '날짜' : viewMode === 'weekly' ? '주차' : '월'}</TableCell>
                <TableCell align="right">건수</TableCell>
                <TableCell align="right">파츠 매출</TableCell>
                {isMaster && <TableCell align="right">파츠 비용</TableCell>}
                <TableCell align="right">공임</TableCell>
                <TableCell align="right">총 매출</TableCell>
                {isMaster && <TableCell align="right">순이익</TableCell>}
                {isMaster && <TableCell align="right">이익률</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {(viewMode === 'daily' ? dailyData : viewMode === 'weekly' ? weeklyData : monthlyData).map((row) => (
                <TableRow 
                  key={viewMode === 'monthly' ? row.month : viewMode === 'weekly' ? row.week : row.date}
                  hover
                >
                  <TableCell>
                    {viewMode === 'monthly' ? `${row.month}월` : 
                     viewMode === 'weekly' ? format(parseISO(row.week.split('~')[0]), 'MM/dd') : 
                     format(parseISO(row.date), 'MM/dd')}
                  </TableCell>
                  <TableCell align="right">{row.count}건</TableCell>
                  <TableCell align="right">{row.partsRevenue?.toLocaleString()}원</TableCell>
                  {isMaster && <TableCell align="right">{row.partsCost?.toLocaleString()}원</TableCell>}
                  <TableCell align="right">{row.laborRevenue?.toLocaleString()}원</TableCell>
                  <TableCell align="right">{row.totalRevenue?.toLocaleString()}원</TableCell>
                  {isMaster && <TableCell align="right">{row.totalProfit?.toLocaleString()}원</TableCell>}
                  {isMaster && (
                  <TableCell
                    align="right"
                    sx={{
                      color: row.totalRevenue && ((row.totalProfit / row.totalRevenue) * 100) > 20
                        ? 'success.main'
                        : 'warning.main'
                    }}
                  >
                    {row.totalRevenue ? ((row.totalProfit / row.totalRevenue) * 100).toFixed(1) : 0}%
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default ServiceStatistics; 