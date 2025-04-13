import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { supabase } from '../../lib/supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

const ServiceStats = () => {
  const [startDate, setStartDate] = useState(dayjs().startOf('month'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month'));
  const [dailyStats, setDailyStats] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const fetchDailyStats = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('reception_date, price')
        .gte('reception_date', startDate.format('YYYY-MM-DD'))
        .lte('reception_date', endDate.format('YYYY-MM-DD'))
        .order('reception_date', { ascending: true });

      if (error) throw error;

      // 일별 매출 데이터 가공
      const dailyData = data.reduce((acc, curr) => {
        const date = curr.reception_date;
        const price = curr.price || 0;
        
        if (!acc[date]) {
          acc[date] = {
            date,
            count: 1,
            amount: price
          };
        } else {
          acc[date].count += 1;
          acc[date].amount += price;
        }
        return acc;
      }, {});

      // 배열로 변환
      const statsArray = Object.values(dailyData);
      
      // 총 매출 계산
      const total = statsArray.reduce((sum, day) => sum + day.amount, 0);
      
      setDailyStats(statsArray);
      setTotalAmount(total);
    } catch (error) {
      console.error('통계 데이터 조회 중 오류:', error);
    }
  };

  useEffect(() => {
    fetchDailyStats();
  }, [startDate, endDate]);

  // 금액 포맷팅 함수
  const formatAmount = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>A/S 일별 매출 통계</Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
            <DatePicker
              label="시작일"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              format="YYYY-MM-DD"
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
            <DatePicker
              label="종료일"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              format="YYYY-MM-DD"
            />
          </LocalizationProvider>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>날짜</TableCell>
              <TableCell align="right">건수</TableCell>
              <TableCell align="right">매출액</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dailyStats.map((row) => (
              <TableRow key={row.date}>
                <TableCell>{row.date}</TableCell>
                <TableCell align="right">{row.count}건</TableCell>
                <TableCell align="right">{formatAmount(row.amount)}원</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold' }}>
                총 매출
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                {formatAmount(totalAmount)}원
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ServiceStats; 