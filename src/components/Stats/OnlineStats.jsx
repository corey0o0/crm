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
  Button,
  CircularProgress,
  Card,
  CardContent,
  Container,
  ButtonGroup,
  TextField
} from '@mui/material';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, parseISO, startOfYear, endOfYear, getMonth } from 'date-fns';
import RefreshIcon from '@mui/icons-material/Refresh';
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

function OnlineStats() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [stats, setStats] = useState({ totalPayment: 0, orderCount: 0, list: [], agencyStats: {}, brandStats: {} });
  const [monthlyStats, setMonthlyStats] = useState([]);
  
  const currentMonth = getMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 연도 선택 핸들러
  const handleYearSelect = (year) => {
    setSelectedYear(year);
    const newStartDate = startOfYear(new Date(year, 0, 1));
    const newEndDate = endOfYear(new Date(year, 11, 31));
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setSelectedMonth(null);
    fetchData(newStartDate, newEndDate);
  };

  // 월 선택 핸들러
  const handleMonthSelect = (monthIndex) => {
    const newDate = new Date(selectedYear, monthIndex, 1);
    const newStartDate = startOfMonth(newDate);
    const newEndDate = endOfMonth(newDate);
    setSelectedMonth(monthIndex);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    fetchData(newStartDate, newEndDate);
  };

  const formatDateToStartOfDay = (date) => format(date, 'yyyy-MM-dd') + ' 00:00:00';
  const formatDateToEndOfDay = (date) => format(date, 'yyyy-MM-dd') + ' 23:59:59';

  const fetchData = async (qStart, qEnd) => {
    setLoading(true);
    try {
      const startDateTime = formatDateToStartOfDay(qStart || startDate);
      const endDateTime = formatDateToEndOfDay(qEnd || endDate);

      const yearStart = formatDateToStartOfDay(startOfYear(qStart || startDate));
      const yearEnd = formatDateToEndOfDay(endOfYear(qStart || startDate));

      const [
        { data: cafe24Orders, error },
        { data: agenciesData },
        { data: partsData },
        { data: chartDataRaw }
      ] = await Promise.all([
        supabase.from('cafe24_orders').select('*').gte('order_date', startDateTime).lte('order_date', endDateTime).eq('is_deleted', false).eq('is_transferred', true),
        supabase.from('agencies').select('id, name'),
        supabase.from('parts').select('id, code, barcode, supplier, note, price, category, name'),
        supabase.from('cafe24_orders').select('order_date, total_amount').gte('order_date', yearStart).lte('order_date', yearEnd).eq('is_deleted', false).eq('is_transferred', true)
      ]);

      if (error) throw error;

      if (cafe24Orders) {
        let total = 0;
        const agencyStats = {};
        const brandStats = {};
        const generalProductStats = {};
        const agencyMap = {};
        agenciesData?.forEach(a => { agencyMap[a.id] = a.name; });
        const partMapById = {};
        const partMapByCode = {};
        partsData?.forEach(p => { 
          partMapById[p.id] = p; 
          if (p.code) partMapByCode[String(p.code).trim()] = p;
          if (p.barcode) partMapByCode[String(p.barcode).trim()] = p;
        });

        cafe24Orders.forEach(o => {
          const amt = Number(o.total_amount || 0);
          total += amt;

          const agName = o.agency_id ? (agencyMap[o.agency_id] || `미등록 대리점`) : '일반 주문';
          if (!agencyStats[agName]) agencyStats[agName] = { amount: 0, count: 0, airframe: 0, airframeAmount: 0, parts: 0, partsAmount: 0 };
          agencyStats[agName].amount += amt; // Total includes shipping/discount
          agencyStats[agName].count += 1;

          if (o.order_items && Array.isArray(o.order_items)) {
             o.order_items.forEach(item => {
               const pCode = String(item.custom_product_code || item.product_code || '').trim();
               const pName = item.name || item.product_name || '';
               const p = item.part_id ? partMapById[item.part_id] : (pCode ? partMapByCode[pCode] : null);
               
               const qty = Number(item.quantity || 1);
               const unitPrice = Number(item.product_price || item.price || (p ? p.price : 0));
               const amount = qty * unitPrice;
               
               const isAirframe = p ? (p.category === '기체') : (pName.includes('기체') || pName.includes('차체'));
               
               if (isAirframe) {
                  agencyStats[agName].airframe += qty;
                  agencyStats[agName].airframeAmount += amount;
               } else {
                  agencyStats[agName].parts += qty;
                  agencyStats[agName].partsAmount += amount;
               }

               if (p) {
                  const sup = p.supplier || '기타 브랜드';
                  if (!brandStats[sup]) brandStats[sup] = { airframe: 0, parts: 0, airframeAmount: 0, partsAmount: 0 };
                  
                  if (isAirframe) {
                     brandStats[sup].airframe += qty;
                     brandStats[sup].airframeAmount += amount;
                  } else {
                     brandStats[sup].parts += qty;
                     brandStats[sup].partsAmount += amount;
                  }

                  // 일반 고객(B2C) 주문인 경우 상품별로 분리하여 집계
                  if (!o.agency_id) {
                     if (!generalProductStats[p.id]) {
                       generalProductStats[p.id] = { name: p.name || item.name, category: p.category, quantity: 0, amount: 0 };
                     }
                     generalProductStats[p.id].quantity += qty;
                     generalProductStats[p.id].amount += amount;
                  }
               }
             });
          }
        });

        setStats({
          totalPayment: total,
          orderCount: cafe24Orders.length,
          list: cafe24Orders.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
          agencyStats,
          brandStats,
          generalProductStats
        });

        const monthlyMap = {};
        for (let i = 1; i <= 12; i++) monthlyMap[i] = { month: `${i}월`, sales: 0 };
        if (chartDataRaw) {
          chartDataRaw.forEach(o => {
            const m = new Date(o.order_date).getMonth() + 1;
            monthlyMap[m].sales += Number(o.total_amount || 0);
          });
        }
        setMonthlyStats(Object.values(monthlyMap));
      }
    } catch (err) {
      console.error('온라인 통계 집계 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(value);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
          온라인 주문 통계 (Cafe24)
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3, borderLeft: '4px solid #3182f6' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#3182f6' }}>
          검색 필터
        </Typography>

        {/* 연도 선택 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            연도 선택
          </Typography>
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {(() => {
              const minYear = 2022;
              const years = [];
              for (let year = currentYear; year >= minYear; year--) {
                years.push(year);
              }
              return years.map((year) => (
                <Button
                  key={year}
                  onClick={() => handleYearSelect(year)}
                  sx={{
                    minWidth: '60px',
                    backgroundColor: selectedYear === year ? 'primary.main' : 'inherit',
                    color: selectedYear === year ? 'white' : 'inherit',
                    fontWeight: selectedYear === year ? 'bold' : 'normal',
                    '&:hover': { backgroundColor: selectedYear === year ? 'primary.dark' : '' }
                  }}
                >
                  {year}년
                </Button>
              ));
            })()}
          </ButtonGroup>
        </Box>

        {/* 월별 버튼 그룹 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
            월 선택
            {selectedMonth !== null && (
              <Box component="span" sx={{
                ml: 2, py: 0.5, px: 1.5, borderRadius: 1, backgroundColor: '#e3f2fd', fontSize: '0.9rem', color: '#1976d2', display: 'inline-flex', alignItems: 'center'
              }}>
                현재 선택: {selectedMonth + 1}월 ({format(startDate, 'yyyy-MM-dd')} ~ {format(endDate, 'yyyy-MM-dd')})
              </Box>
            )}
          </Typography>
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {[...Array(12)].map((_, idx) => (
              <Button
                key={idx}
                onClick={() => handleMonthSelect(idx)}
                sx={{
                  minWidth: '40px',
                  backgroundColor: selectedMonth === idx ? 'primary.main' : 'inherit',
                  color: selectedMonth === idx ? 'white' : 'inherit',
                  fontWeight: selectedMonth === idx ? 'bold' : 'normal',
                  '&:hover': { backgroundColor: selectedMonth === idx ? 'primary.dark' : '' }
                }}
              >
                {idx + 1}월
              </Button>
            ))}
          </ButtonGroup>
        </Box>

        <Grid container spacing={2} alignItems="center">
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <Grid item xs={12} sm={3}>
              <DatePicker
                label="시작일"
                value={startDate}
                onChange={(newValue) => { setStartDate(newValue); setSelectedMonth(null); }}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <DatePicker
                label="종료일"
                value={endDate}
                onChange={(newValue) => { setEndDate(newValue); setSelectedMonth(null); }}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
          </LocalizationProvider>

          <Grid item xs={12} sm={2}>
            <Button fullWidth variant="contained" onClick={() => fetchData()} disabled={loading} sx={{ height: 40, bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' } }} startIcon={<RefreshIcon />}>조회</Button>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" my={5}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderLeft: 4, borderColor: 'primary.main', height: '100%', borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    총 주문 금액 (결제액 기준 / 완료 건)
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(stats.totalPayment)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderLeft: 4, borderColor: 'secondary.main', height: '100%', borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    반영 완료 주문 건수
                  </Typography>
                  <Typography variant="h4" color="secondary" sx={{ fontWeight: 'bold' }}>
                    {stats.orderCount.toLocaleString()}건
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>월별 총 매출 추이 (해당 연도)</Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                 <BarChart data={monthlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(val) => `${val / 10000}만`} />
                    <Tooltip formatter={(value) => [formatCurrency(value), '온라인 매출액']} />
                    <Bar dataKey="sales" name="매출액" fill="#2196f3" radius={[4, 4, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>대리점별 매출</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell>대리점명</TableCell>
                      <TableCell align="right">기체 판매</TableCell>
                      <TableCell align="right">파츠 판매</TableCell>
                      <TableCell align="right">주문 건수</TableCell>
                      <TableCell align="right">총 주문 금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.agencyStats || {}).length > 0 ? (
                      Object.entries(stats.agencyStats)
                        .sort((a, b) => b[1].amount - a[1].amount)
                        .map(([agencyName, data]) => (
                          <TableRow key={agencyName} hover>
                            <TableCell>{agencyName}</TableCell>
                            <TableCell align="right">
                               <Typography variant="body2" sx={{ fontWeight: data.airframe > 0 ? 'bold' : 'normal', color: data.airframe > 0 ? 'primary.main' : 'inherit' }}>{data.airframe}대</Typography>
                               <Typography variant="caption" color="textSecondary">{formatCurrency(data.airframeAmount)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                               <Typography variant="body2">{data.parts}개</Typography>
                               <Typography variant="caption" color="textSecondary">{formatCurrency(data.partsAmount)}</Typography>
                            </TableCell>
                            <TableCell align="right">{data.count}건</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.amount)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>브랜드별 제품 출고 현황</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell>브랜드명</TableCell>
                      <TableCell align="right">기체 판매 대수</TableCell>
                      <TableCell align="right">기체 판매 금액</TableCell>
                      <TableCell align="right">파츠 판매 금액</TableCell>
                      <TableCell align="right">총 합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.brandStats || {}).length > 0 ? (
                      Object.entries(stats.brandStats)
                        .sort((a, b) => (b[1].airframeAmount + b[1].partsAmount) - (a[1].airframeAmount + a[1].partsAmount))
                        .map(([brandName, data]) => (
                          <TableRow key={brandName} hover>
                            <TableCell>{brandName}</TableCell>
                            <TableCell align="right" sx={{ color: 'primary.main', fontWeight: data.airframe > 0 ? 'bold' : 'normal' }}>
                              {data.airframe}대
                            </TableCell>
                            <TableCell align="right">{formatCurrency(data.airframeAmount)}</TableCell>
                            <TableCell align="right">{formatCurrency(data.partsAmount)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.airframeAmount + data.partsAmount)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>일반 고객(B2C) 상품별 매출 현황</Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4, maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'grey.100' }}>분류</TableCell>
                  <TableCell sx={{ bgcolor: 'grey.100' }}>상품명</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100' }}>판매 수량</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100' }}>판매 금액 합계</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(stats.generalProductStats || {}).length > 0 ? (
                  Object.entries(stats.generalProductStats)
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([partId, data]) => (
                      <TableRow key={partId} hover>
                        <TableCell>
                           <Box sx={{ 
                              display: 'inline-block', 
                              px: 1, 
                              py: 0.5, 
                              bgcolor: data.category === '기체' ? 'primary.light' : 'secondary.light', 
                              color: data.category === '기체' ? 'primary.dark' : 'secondary.dark',
                              borderRadius: 1, 
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                           }}>
                             {data.category || '기타'}
                           </Box>
                        </TableCell>
                        <TableCell>{data.name}</TableCell>
                        <TableCell align="right">{data.quantity}개</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.amount)}</TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>일반 고객 주문 데이터가 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>해당 기간 주문 리스트 (최신순)</Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell>주문일</TableCell>
                  <TableCell>주문번호</TableCell>
                  <TableCell>주문자</TableCell>
                  <TableCell>주문상품</TableCell>
                  <TableCell align="right">결제액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.list.length > 0 ? (
                  stats.list.map((o) => (
                    <TableRow key={o.id} hover>
                      <TableCell>{format(new Date(o.order_date), 'yyyy-MM-dd HH:mm')}</TableCell>
                      <TableCell>{o.order_id}</TableCell>
                      <TableCell>{o.buyer_name}</TableCell>
                      <TableCell>{o.order_items ? o.order_items.map(i => i.name).join(', ') : '상품 정보 없음'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(o.total_amount || 0)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      해당 기간에 판매 반영된 주문이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Container>
  );
}

export default OnlineStats;
