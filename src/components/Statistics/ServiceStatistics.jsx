import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Tabs,
  Tab,
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
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';

function ServiceStatistics() {
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyComparison, setYearlyComparison] = useState([]);
  const [profitAnalysis, setProfitAnalysis] = useState([]);

  useEffect(() => {
    fetchStatisticsData();
  }, [selectedBrand, selectedYear]);

  const fetchStatisticsData = async () => {
    setLoading(true);
    try {
      // 1. 월별 통계 데이터 가져오기
      const { data: currentYearData, error: currentYearError } = await supabase
        .from('services')
        .select(`
          *,
          service_parts (
            part_id,
            quantity,
            price,
            parts (
              cost_price
            )
          )
        `)
        .eq('brand', selectedBrand)
        .gte('reception_date', `${selectedYear}-01-01`)
        .lte('reception_date', `${selectedYear}-12-31`);

      if (currentYearError) throw currentYearError;

      // 2. 전년도 데이터 가져오기
      const { data: previousYearData, error: previousYearError } = await supabase
        .from('services')
        .select(`
          *,
          service_parts (
            part_id,
            quantity,
            price,
            parts (
              cost_price
            )
          )
        `)
        .eq('brand', selectedBrand)
        .gte('reception_date', `${selectedYear - 1}-01-01`)
        .lte('reception_date', `${selectedYear - 1}-12-31`);

      if (previousYearError) throw previousYearError;

      // 3. 데이터 가공
      const monthlyStats = processMonthlyData(currentYearData);
      const yearComparison = compareYearlyData(currentYearData, previousYearData);
      const profitStats = calculateProfitAnalysis(currentYearData);

      setMonthlyData(monthlyStats);
      setYearlyComparison(yearComparison);
      setProfitAnalysis(profitStats);

    } catch (error) {
      console.error('통계 데이터 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 월별 데이터 처리
  const processMonthlyData = (data) => {
    const months = Array(12).fill(0).map((_, i) => ({
      month: i + 1,
      count: 0,
      revenue: 0,
      cost: 0,
      profit: 0
    }));

    data.forEach(service => {
      const month = new Date(service.reception_date).getMonth();
      months[month].count++;
      
      // 매출액, 원가, 이익 계산
      let revenue = 0;
      let cost = 0;
      
      service.service_parts?.forEach(part => {
        revenue += part.price * part.quantity;
        cost += (part.parts?.cost_price || 0) * part.quantity;
      });

      months[month].revenue += revenue;
      months[month].cost += cost;
      months[month].profit += (revenue - cost);
    });

    return months;
  };

  // 전년도 비교 데이터 처리
  const compareYearlyData = (currentData, previousData) => {
    const months = Array(12).fill(0).map((_, i) => ({
      month: i + 1,
      currentYear: 0,
      previousYear: 0,
      growth: 0
    }));

    // 현재년도 데이터 처리
    currentData.forEach(service => {
      const month = new Date(service.reception_date).getMonth();
      months[month].currentYear++;
    });

    // 전년도 데이터 처리
    previousData.forEach(service => {
      const month = new Date(service.reception_date).getMonth();
      months[month].previousYear++;
    });

    // 성장률 계산
    months.forEach(month => {
      month.growth = month.previousYear === 0 ? 100 :
        ((month.currentYear - month.previousYear) / month.previousYear) * 100;
    });

    return months;
  };

  // 영업이익 분석
  const calculateProfitAnalysis = (data) => {
    const months = Array(12).fill(0).map((_, i) => ({
      month: i + 1,
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: 0
    }));

    data.forEach(service => {
      const month = new Date(service.reception_date).getMonth();
      
      service.service_parts?.forEach(part => {
        const revenue = part.price * part.quantity;
        const cost = (part.parts?.cost_price || 0) * part.quantity;
        const profit = revenue - cost;

        months[month].revenue += revenue;
        months[month].cost += cost;
        months[month].profit += profit;
      });
    });

    // 이익률 계산
    months.forEach(month => {
      month.margin = month.revenue === 0 ? 0 :
        (month.profit / month.revenue) * 100;
    });

    return months;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1800px', mx: 'auto', p: 3 }}>
      {/* 필터 영역 */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>브랜드</InputLabel>
          <Select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            label="브랜드"
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
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - i;
              return (
                <MenuItem key={year} value={year}>{year}년</MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      {/* 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                총 A/S 건수
              </Typography>
              <Typography variant="h4">
                {monthlyData.reduce((sum, month) => sum + month.count, 0)}건
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                총 매출
              </Typography>
              <Typography variant="h4">
                {monthlyData.reduce((sum, month) => sum + month.revenue, 0).toLocaleString()}원
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                총 영업이익
              </Typography>
              <Typography variant="h4">
                {monthlyData.reduce((sum, month) => sum + month.profit, 0).toLocaleString()}원
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                평균 이익률
              </Typography>
              <Typography variant="h4">
                {(monthlyData.reduce((sum, month) => sum + month.profit, 0) / 
                  monthlyData.reduce((sum, month) => sum + month.revenue, 0) * 100).toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 월별 통계 차트 */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>월별 A/S 건수</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={(value) => `${value}월`} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" name="A/S 건수" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* 전년도 비교 차트 */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>전년도 비교</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={yearlyComparison}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={(value) => `${value}월`} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="currentYear" 
              name={`${selectedYear}년`} 
              stroke="#8884d8" 
            />
            <Line 
              type="monotone" 
              dataKey="previousYear" 
              name={`${selectedYear-1}년`} 
              stroke="#82ca9d" 
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* 영업이익 분석 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>영업이익 분석</Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>월</TableCell>
                <TableCell align="right">매출액</TableCell>
                <TableCell align="right">원가</TableCell>
                <TableCell align="right">영업이익</TableCell>
                <TableCell align="right">이익률</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {profitAnalysis.map((row) => (
                <TableRow key={row.month}>
                  <TableCell>{row.month}월</TableCell>
                  <TableCell align="right">{row.revenue.toLocaleString()}원</TableCell>
                  <TableCell align="right">{row.cost.toLocaleString()}원</TableCell>
                  <TableCell align="right">{row.profit.toLocaleString()}원</TableCell>
                  <TableCell align="right">{row.margin.toFixed(1)}%</TableCell>
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