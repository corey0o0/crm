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
import InventoryIcon from '@mui/icons-material/Inventory';
import BuildIcon from '@mui/icons-material/Build';

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
  const [partsData, setPartsData] = useState({
    servicePartsByDate: {},
    shipmentPartsByDate: {}
  });
  const brandOptions = ['전체', 'XRB', 'NB'];

  const fetchSalesData = async () => {
    try {
      setLoading(true);

      // A/S 부품 데이터 조회
      let servicePartsQuery = supabase
        .from('service_parts')
        .select(`
          price,
          quantity,
          usage,
          services!inner (
            reception_date,
            brand
          ),
          parts!inner (
            name,
            code
          )
        `)
        .gte('services.reception_date', format(startDate, 'yyyy-MM-dd'))
        .lte('services.reception_date', format(endDate, 'yyyy-MM-dd'));
      
      if (brand !== '전체') {
        servicePartsQuery = servicePartsQuery.eq('services.brand', brand);
      }
      
      const { data: servicePartsData, error: servicePartsError } = await servicePartsQuery;
      if (servicePartsError) throw servicePartsError;

      // 데이터를 저장할 객체 초기화
      const servicePartsByDate = {};
      const shipmentPartsByDate = {};

      // A/S 부품 데이터 가공
      if (servicePartsData) {
        servicePartsData.forEach(item => {
          if (item.services && item.parts) {
            const date = format(parseISO(item.services.reception_date), 'yyyy-MM-dd');
            if (!servicePartsByDate[date]) {
              servicePartsByDate[date] = [];
            }
            servicePartsByDate[date].push({
              name: item.parts.name,
              code: item.parts.code,
              quantity: item.quantity || 0,
              price: item.price || 0,
              total: (item.quantity || 0) * (item.price || 0),
              usage: item.usage
            });
          }
        });
      }

      // 출고 부품 데이터 조회
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      
      console.log('조회 기간:', {
        시작일: formattedStartDate,
        종료일: formattedEndDate,
        브랜드: brand
      });

      // 출고 데이터 조회 수정
      let shipmentQuery = supabase
        .from('shipments')
        .select(`
          id,
          brand,
          shipment_date,
          product_name,
          quantity,
          price,
          status
        `)
        .gte('shipment_date', formattedStartDate)
        .lte('shipment_date', formattedEndDate);

      if (brand !== '전체') {
        shipmentQuery = shipmentQuery.eq('brand', brand);
      }

      const { data: shipmentsData, error: shipmentsError } = await shipmentQuery;
      
      if (shipmentsError) {
        console.error('출고 데이터 조회 오류:', shipmentsError);
        throw shipmentsError;
      }

      console.log('조회된 출고 데이터:', shipmentsData);

      // 출고 데이터 처리
      if (shipmentsData && shipmentsData.length > 0) {
        shipmentsData.forEach(shipment => {
          const date = format(parseISO(shipment.shipment_date), 'yyyy-MM-dd');
          if (!shipmentPartsByDate[date]) {
            shipmentPartsByDate[date] = [];
          }

          // 제품 정보를 직접 처리
          const partData = {
            name: shipment.product_name,
            code: '',  // 코드가 없는 경우 빈 문자열로 처리
            quantity: Number(shipment.quantity) || 0,
            price: Number(shipment.price) || 0,
            total: (Number(shipment.quantity) || 0) * (Number(shipment.price) || 0)
          };
          
          console.log('처리된 출고 항목:', partData);
          shipmentPartsByDate[date].push(partData);
        });
      }

      console.log('날짜별 출고 부품 데이터:', shipmentPartsByDate);

      // 부품 데이터 상태 업데이트
      setPartsData({
        servicePartsByDate,
        shipmentPartsByDate
      });

      // 매출 데이터 처리를 위한 salesByDate 객체 초기화
      const salesByDate = {};

      // 날짜별 초기 데이터 구조 설정
      [...Object.keys(servicePartsByDate), ...Object.keys(shipmentPartsByDate)].forEach(date => {
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
      });

      // A/S 매출 데이터 처리
      Object.entries(servicePartsByDate).forEach(([date, parts]) => {
        parts.forEach(part => {
          const amount = Number(part.price || 0) * Number(part.quantity || 0);
          salesByDate[date].serviceSales += amount;
          if (part.usage === 'A/S') {
            salesByDate[date].serviceSalesAS += amount;
          } else if (part.usage === '판매') {
            salesByDate[date].serviceSalesSell += amount;
          }
        });
      });

      // 출고 매출 데이터 처리
      Object.entries(shipmentPartsByDate).forEach(([date, parts]) => {
        console.log(`${date} 출고 부품 처리:`, parts);
        let dailyShipmentSales = 0;
        parts.forEach(part => {
          const amount = Number(part.price || 0) * Number(part.quantity || 0);
          console.log(`${date} 출고 매출 계산:`, {
            제품명: part.name,
            수량: part.quantity,
            단가: part.price,
            계산금액: amount
          });
          dailyShipmentSales += amount;
        });
        salesByDate[date].shipmentSales = dailyShipmentSales;
        console.log(`${date} 최종 출고 매출:`, dailyShipmentSales);
      });

      // 총계 계산
      Object.values(salesByDate).forEach(item => {
        item.totalSales = Number(item.serviceSales || 0) + Number(item.shipmentSales || 0);
      });

      // 날짜순으로 정렬
      const sortedData = Object.values(salesByDate).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      console.log('최종 정렬된 매출 데이터:', sortedData);

      // 총계 통계 계산
      const totalServiceSales = sortedData.reduce((sum, item) => sum + Number(item.serviceSales || 0), 0);
      const totalShipmentSales = sortedData.reduce((sum, item) => sum + Number(item.shipmentSales || 0), 0);
      const totalSales = totalServiceSales + totalShipmentSales;
      const totalServiceSalesAS = sortedData.reduce((sum, item) => sum + Number(item.serviceSalesAS || 0), 0);
      const totalServiceSalesSell = sortedData.reduce((sum, item) => sum + Number(item.serviceSalesSell || 0), 0);

      console.log('최종 집계:', {
        서비스매출: totalServiceSales,
        출고매출: totalShipmentSales,
        총매출: totalSales
      });

      setTotalStats({
        totalServiceSales: Number(totalServiceSales || 0),
        totalShipmentSales: Number(totalShipmentSales || 0),
        totalSales: Number(totalSales || 0),
        totalServiceSalesAS: Number(totalServiceSalesAS || 0),
        totalServiceSalesSell: Number(totalServiceSalesSell || 0)
      });
      setSalesData(sortedData);

    } catch (error) {
      console.error('데이터 조회 중 오류:', error);
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

  const renderPartsDetail = () => {
    const dates = [...new Set([
      ...Object.keys(partsData.servicePartsByDate),
      ...Object.keys(partsData.shipmentPartsByDate)
    ])].sort();

    return (
      <Box>
        {dates.map(date => (
          <Box key={date} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              {date}
            </Typography>
            
            {/* A/S 부품 사용 내역 */}
            {partsData.servicePartsByDate[date]?.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon fontSize="small" />
                  A/S 부품 사용 내역
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>부품명</TableCell>
                        <TableCell>코드</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell align="right">단가</TableCell>
                        <TableCell align="right">금액</TableCell>
                        <TableCell>용도</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {partsData.servicePartsByDate[date].map((part, idx) => (
                        <TableRow key={`service-${idx}`}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.code}</TableCell>
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(part.price)}</TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                          <TableCell>{part.usage}</TableCell>
                        </TableRow>
                      ))}
                      {/* 용도별 합계 행 추가 */}
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right" sx={{ fontWeight: 600 }}>
                          용도별 합계
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(
                            partsData.servicePartsByDate[date].reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right">
                          A/S
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            partsData.servicePartsByDate[date]
                              .filter(part => part.usage === 'A/S')
                              .reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right">
                          판매
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            partsData.servicePartsByDate[date]
                              .filter(part => part.usage === '판매')
                              .reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right">
                          워런티
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            partsData.servicePartsByDate[date]
                              .filter(part => part.usage === '워런티')
                              .reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* 출고 부품 내역 */}
            {partsData.shipmentPartsByDate[date]?.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InventoryIcon fontSize="small" />
                  출고 부품 내역
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>제품명</TableCell>
                        <TableCell>코드</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell align="right">단가</TableCell>
                        <TableCell align="right">금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {partsData.shipmentPartsByDate[date].map((part, idx) => (
                        <TableRow key={`shipment-${idx}`}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.code}</TableCell>
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(part.price)}</TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
            
            <Divider sx={{ mt: 3 }} />
          </Box>
        ))}
      </Box>
    );
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
            <Tab label="매출 요약" />
            <Tab label="부품 상세" />
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
            ) : tabValue === 1 ? (
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
            ) : (
              renderPartsDetail()
            )}
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}

export default SalesStats; 