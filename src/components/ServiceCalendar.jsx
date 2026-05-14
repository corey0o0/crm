import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Badge, Tooltip } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { supabase } from '../lib/supabaseClient';

const ServiceCalendar = ({ onDateChange, selectedDate: propSelectedDate }) => {
  const [serviceData, setServiceData] = useState({});
  const [selectedDate, setSelectedDate] = useState(propSelectedDate || dayjs());
  const [currentMonth, setCurrentMonth] = useState((propSelectedDate || dayjs()).startOf('month'));

  useEffect(() => {
    fetchServiceData(currentMonth);
  }, [currentMonth]);

  // props로 받은 selectedDate가 변경될 때 내부 상태 업데이트
  useEffect(() => {
    if (propSelectedDate) {
      setSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  const fetchServiceData = async (month) => {
    try {
      const targetMonth = month || dayjs();
      const startOfMonth = targetMonth.startOf('month').toISOString();
      const endOfMonth = targetMonth.endOf('month').toISOString();

      const { data, error } = await supabase
        .from('services')
        .select('id, reception_date, status, customer_name, product_name')
        .gte('reception_date', startOfMonth)
        .lte('reception_date', endOfMonth);

      if (error) throw error;

      // 날짜별로 상태별 배열로 집계
      const aggregatedData = {};
      data.forEach(service => {
        const date = dayjs(service.reception_date).format('YYYY-MM-DD');
        if (!aggregatedData[date]) {
          aggregatedData[date] = { 접수: [], 처리중: [], 완료: [] };
        }
        
        // 상태값 매핑 그룹화
        let statusCategory = '완료';
        if (['접수', '준비중'].includes(service.status)) {
          statusCategory = '접수';
        } else if (['처리중', '준비완료', '부품준비', '부분완료'].includes(service.status)) {
          statusCategory = '처리중';
        }
        
        aggregatedData[date][statusCategory].push(service);
      });
      setServiceData(aggregatedData);
    } catch (error) {
      console.error('서비스 데이터 조회 중 오류:', error);
    }
  };

  const ServerDay = (props) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const formattedDate = day.format('YYYY-MM-DD');
    const dayData = serviceData[formattedDate] || { 접수: [], 처리중: [], 완료: [] };
    const 접수수 = dayData.접수.length;
    const 처리중수 = dayData.처리중.length;
    const 완료수 = dayData.완료.length;
    const total = 접수수 + 처리중수 + 완료수;

    if (outsideCurrentMonth || total === 0) {
      return <PickersDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />;
    }

    const tooltipContent = (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {day.locale('ko').format('YYYY년 MM월 DD일 dddd')}
        </Typography>
        {dayData.접수.length > 0 ? (
          dayData.접수.map(s => (
            <Typography key={s.id} variant="body2" sx={{ fontSize: '0.95em' }}>
              {s.customer_name} {s.product_name ? `(${s.product_name})` : ''} - {dayjs(s.reception_date).format('HH:mm')}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">접수건 없음</Typography>
        )}
      </Box>
    );

    return (
      <Tooltip title={tooltipContent} arrow>
        <Box sx={{ position: 'relative' }}>
          <PickersDay 
            day={day} 
            {...other}
            outsideCurrentMonth={outsideCurrentMonth}
            sx={{
              ...other.sx,
              backgroundColor: total > 0 ? 'rgba(25, 118, 210, 0.05)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.1)',
              }
            }}
          />
          <Box sx={{ 
            position: 'absolute',
            top: 2,
            right: 2,
            display: 'flex',
            gap: 0.5
          }}>
            {접수수 > 0 && (
              <Typography variant="caption" sx={{ bgcolor: 'info.main', color: 'white', px: 0.5, borderRadius: 1, fontSize: '0.7em' }}>{접수수}</Typography>
            )}
            {처리중수 > 0 && (
              <Typography variant="caption" sx={{ bgcolor: 'warning.main', color: 'white', px: 0.5, borderRadius: 1, fontSize: '0.7em' }}>{처리중수}</Typography>
            )}
            {완료수 > 0 && (
              <Typography variant="caption" sx={{ bgcolor: 'success.main', color: 'white', px: 0.5, borderRadius: 1, fontSize: '0.7em' }}>{완료수}</Typography>
            )}
          </Box>
        </Box>
      </Tooltip>
    );
  };

  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3,
        bgcolor: '#ffffff',
        borderRadius: 2,
        width: '100%'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: { xs: 'flex-start', sm: 'center' },
        mb: 3,
        gap: 3,
        flexDirection: { xs: 'column', sm: 'row' }
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#191f28' }}>
          A/S 현황
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: 3,
          flexWrap: 'wrap'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge color="info" variant="dot" sx={{ '& .MuiBadge-dot': { width: 8, height: 8 } }} />
            <Typography variant="body2" color="text.secondary">접수</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge color="warning" variant="dot" sx={{ '& .MuiBadge-dot': { width: 8, height: 8 } }} />
            <Typography variant="body2" color="text.secondary">처리중</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge color="success" variant="dot" sx={{ '& .MuiBadge-dot': { width: 8, height: 8 } }} />
            <Typography variant="body2" color="text.secondary">완료</Typography>
          </Box>
        </Box>
      </Box>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
        <DateCalendar
          value={selectedDate}
          onChange={(newValue) => {
            setSelectedDate(newValue);
            if (onDateChange) {
              onDateChange(newValue);
            }
          }}
          onMonthChange={(newMonth) => {
            setCurrentMonth(newMonth);
          }}
          slots={{
            day: ServerDay
          }}
          sx={{
            width: '100%',
            maxWidth: 'none',
            '& .MuiDayCalendar-header': {
              justifyContent: 'space-around',
              '& .MuiTypography-root': {
                width: 'auto',
                height: 'auto'
              }
            },
            '& .MuiDayCalendar-weekContainer': {
              justifyContent: 'space-around',
              margin: '8px 0'
            },
            '& .MuiDayCalendar-weekDayLabel': {
              color: '#666',
              fontWeight: 600,
              width: '48px',
              height: '48px',
              margin: '0 2px',
              fontSize: '0.875rem'
            },
            '& .MuiPickersDay-root': {
              width: '48px',
              height: '48px',
              margin: '0 2px',
              fontSize: '0.875rem',
              '&.Mui-selected': {
                backgroundColor: '#3182f6',
                color: '#fff',
                '&:hover': {
                  backgroundColor: '#1b64da'
                }
              }
            },
            '& .MuiPickersCalendarHeader-root': {
              paddingLeft: 2,
              paddingRight: 2,
              marginTop: 0,
              marginBottom: 2,
              '& .MuiPickersCalendarHeader-label': {
                fontSize: '1rem',
                fontWeight: 600
              }
            }
          }}
        />
      </LocalizationProvider>
    </Paper>
  );
};

export default ServiceCalendar; 