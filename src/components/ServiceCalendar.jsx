import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Badge } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { supabase } from '../lib/supabaseClient';

const ServiceCalendar = () => {
  const [serviceData, setServiceData] = useState({});
  const [selectedDate, setSelectedDate] = useState(dayjs());

  useEffect(() => {
    fetchServiceData();
  }, []);

  const fetchServiceData = async () => {
    try {
      const startOfMonth = dayjs().startOf('month').toISOString();
      const endOfMonth = dayjs().endOf('month').toISOString();

      const { data, error } = await supabase
        .from('services')
        .select('reception_date, status')
        .gte('reception_date', startOfMonth)
        .lte('reception_date', endOfMonth);

      if (error) throw error;

      // 날짜별로 상태 카운트를 집계
      const aggregatedData = data.reduce((acc, service) => {
        const date = dayjs(service.reception_date).format('YYYY-MM-DD');
        if (!acc[date]) {
          acc[date] = { 접수: 0, 처리중: 0, 완료: 0 };
        }
        
        // 상태 매핑
        const statusMap = {
          '접수': '접수',
          '처리중': '처리중',
          '부분완료': '처리중',
          '완료': '완료'
        };
        
        const mappedStatus = statusMap[service.status] || service.status;
        acc[date][mappedStatus]++;
        return acc;
      }, {});

      setServiceData(aggregatedData);
    } catch (error) {
      console.error('서비스 데이터 조회 중 오류:', error);
    }
  };

  const ServerDay = (props) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const formattedDate = day.format('YYYY-MM-DD');
    const dayData = serviceData[formattedDate] || { 접수: 0, 처리중: 0, 완료: 0 };
    const total = dayData.접수 + dayData.처리중 + dayData.완료;

    if (outsideCurrentMonth || total === 0) {
      return <PickersDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />;
    }

    return (
      <Box sx={{ position: 'relative' }}>
        <PickersDay day={day} {...other} />
        <Box sx={{ 
          position: 'absolute', 
          bottom: 4,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 0.5
        }}>
          {dayData.접수 > 0 && (
            <Badge 
              badgeContent={dayData.접수} 
              color="info"
              sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: '14px', minWidth: '14px' } }}
            />
          )}
          {dayData.처리중 > 0 && (
            <Badge 
              badgeContent={dayData.처리중} 
              color="warning"
              sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: '14px', minWidth: '14px' } }}
            />
          )}
          {dayData.완료 > 0 && (
            <Badge 
              badgeContent={dayData.완료} 
              color="success"
              sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: '14px', minWidth: '14px' } }}
            />
          )}
        </Box>
      </Box>
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
        alignItems: 'center', 
        mb: 3,
        gap: 3,
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' }
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
          onChange={(newValue) => setSelectedDate(newValue)}
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