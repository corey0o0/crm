import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
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
  TextField,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Tabs,
  Tab,
  Divider,
  Autocomplete
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function SalesStats() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [brand, setBrand] = useState('전체');
  const [salesData, setSalesData] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalServiceSales: 0,
    totalShipmentSales: 0,
    totalSales: 0
  });
  const brandOptions = ['전체', 'XRB', 'NB'];

  const fetchSalesData = async () => {
    try {
      setLoading(true);

      // A/S 매출 데이터 조회
      let serviceQuery = supabase
        .from('service_parts')
        .select(`
          price,
          quantity,
          usage,
          services!inner (
            reception_date,
            brand
          )
        `)
        .gte('services.reception_date', format(startDate, 'yyyy-MM-dd'))
        .lte('services.reception_date', format(endDate, 'yyyy-MM-dd'));
      if (brand !== '전체') {
        serviceQuery = serviceQuery.eq('services.brand', brand);
      }
      const { data: serviceData, error: serviceError } = await serviceQuery;
      if (serviceError) throw serviceError;

      // 출고 매출 데이터 조회 (brand 컬럼이 있다고 가정)
      let shipmentQuery = supabase
        .from('product_shipments')
        .select('shipment_date, total_price, brand')
        .gte('shipment_date', format(startDate, 'yyyy-MM-dd'))
        .lte('shipment_date', format(endDate, 'yyyy-MM-dd'));
      if (brand !== '전체') {
        shipmentQuery = shipmentQuery.eq('brand', brand);
      }
      const { data: shipmentData, error: shipmentError } = await shipmentQuery;
      if (shipmentError) throw shipmentError;

      // 데이터 가공
      const salesByDate = {};

      // A/S 데이터 처리
      serviceData.forEach(item => {
        const date = format(parseISO(item.services.reception_date), 'yyyy-MM-dd');
        if (!salesByDate[date]) {
          salesByDate[date] = {
            date,
            serviceSales: 0,
            serviceSalesAS: 0,
            serviceSalesSell: 0,
            shipmentSales: 0,
            totalSales: 0
          };
        }
        const amount = (item.price || 0) * (item.quantity || 0);
        salesByDate[date].serviceSales += amount;
        if (item.usage === 'A/S') {
          salesByDate[date].serviceSalesAS += amount;
        } else if (item.usage === '판매') {
          salesByDate[date].serviceSalesSell += amount;
        }
      });

      // 출고 데이터 처리
      shipmentData.forEach(item => {
        const date = format(parseISO(item.shipment_date), 'yyyy-MM-dd');
        if (!salesByDate[date]) {
          salesByDate[date] = {
            date,
            serviceSales: 0,
            serviceSalesAS: 0,
            serviceSalesSell: 0,
            shipmentSales: 0,
            totalSales: 0
          };
        }
        salesByDate[date].shipmentSales += item.total_price || 0;
      });

      // 총계 계산
      Object.values(salesByDate).forEach(item => {
        item.totalSales = item.serviceSales + item.shipmentSales;
      });

      // 날짜순으로 정렬
      const sortedData = Object.values(salesByDate).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      // 총계 통계 계산
      const totalServiceSales = sortedData.reduce((sum, item) => sum + item.serviceSales, 0);
      const totalShipmentSales = sortedData.reduce((sum, item) => sum + item.shipmentSales, 0);
      const totalSales = totalServiceSales + totalShipmentSales;
      const totalServiceSalesAS = sortedData.reduce((sum, item) => sum + item.serviceSalesAS, 0);
      const totalServiceSalesSell = sortedData.reduce((sum, item) => sum + item.serviceSalesSell, 0);

      setTotalStats({
        totalServiceSales,
        totalShipmentSales,
        totalSales,
        totalServiceSalesAS,
        totalServiceSalesSell
      });
      setSalesData(sortedData);

    } catch (error) {
      console.error('매출 데이터 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [startDate, endDate, brand]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          매출 통계
        </Typography>

        {/* 기간 + 브랜드 선택 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={3}>
              <DatePicker
                label="시작일"
                value={startDate}
                onChange={setStartDate}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <DatePicker
                label="종료일"
                value={endDate}
                onChange={setEndDate}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <Autocomplete
                options={brandOptions}
                value={brand}
                onChange={(_, newValue) => setBrand(newValue || '전체')}
                renderInput={(params) => (
                  <TextField {...params} label="브랜드" size="small" fullWidth />
                )}
                disableClearable
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                variant="contained"
                onClick={fetchSalesData}
                sx={{ 
                  height: '40px',
                  bgcolor: '#3182f6',
                  '&:hover': { bgcolor: '#1b64da' }
                }}
                fullWidth
              >
                조회
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 총계 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  A/S 매출
                </Typography>
                <Typography variant="h5" component="div">
                  {formatCurrency(totalStats.totalServiceSales)}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    A/S: {formatCurrency(totalStats.totalServiceSalesAS)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    판매: {formatCurrency(totalStats.totalServiceSalesSell)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  출고 매출
                </Typography>
                <Typography variant="h5" component="div">
                  {formatCurrency(totalStats.totalShipmentSales)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  총 매출
                </Typography>
                <Typography variant="h5" component="div">
                  {formatCurrency(totalStats.totalSales)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 차트와 테이블 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="차트" />
            <Tab label="테이블" />
          </Tabs>
          
          <Box sx={{ p: 3 }}>
            {tabValue === 0 ? (
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar name="A/S 매출(A/S)" dataKey="serviceSalesAS" fill="#8884d8" />
                    <Bar name="A/S 매출(판매)" dataKey="serviceSalesSell" fill="#82ca9d" />
                    <Bar name="출고 매출" dataKey="shipmentSales" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>날짜</TableCell>
                      <TableCell align="right">A/S 매출(A/S)</TableCell>
                      <TableCell align="right">A/S 매출(판매)</TableCell>
                      <TableCell align="right">출고 매출</TableCell>
                      <TableCell align="right">총계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesData.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell align="right">{formatCurrency(row.serviceSalesAS)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.serviceSalesSell)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.shipmentSales)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.totalSales)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}

export default SalesStats; 