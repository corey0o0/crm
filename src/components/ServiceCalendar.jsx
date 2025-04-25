import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Badge, Tooltip } from '@mui/material';
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

    const tooltipContent = (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {day.format('YYYY년 MM월 DD일')}
        </Typography>
        {dayData.접수 > 0 && (
          <Typography variant="body2" color="info.main">접수: {dayData.접수}건</Typography>
        )}
        {dayData.처리중 > 0 && (
          <Typography variant="body2" color="warning.main">처리중: {dayData.처리중}건</Typography>
        )}
        {dayData.완료 > 0 && (
          <Typography variant="body2" color="success.main">완료: {dayData.완료}건</Typography>
        )}
      </Box>
    );

    return (
      <Tooltip title={tooltipContent} arrow>
        <Box sx={{ position: 'relative' }}>
          <PickersDay 
            day={day} 
            {...other}
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
            flexDirection: 'column',
            gap: '2px',
            alignItems: 'flex-end'
          }}>
            {dayData.접수 > 0 && (
              <Typography 
                variant="caption" 
                sx={{ 
                  bgcolor: 'info.main',
                  color: 'white',
                  px: 0.5,
                  py: 0.1,
                  borderRadius: 1,
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  fontWeight: 'bold',
                  minWidth: '16px',
                  textAlign: 'center'
                }}
              >
                {dayData.접수}
              </Typography>
            )}
          </Box>
          <Box sx={{ 
            position: 'absolute', 
            bottom: 2,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 0.5,
            px: 0.5
          }}>
            <Box sx={{ 
              display: 'flex',
              gap: '2px',
              height: '4px',
              width: '100%',
              maxWidth: '32px'
            }}>
              {dayData.처리중 > 0 && (
                <Box sx={{ 
                  flex: dayData.처리중, 
                  bgcolor: 'warning.main',
                  borderRadius: '2px'
                }} />
              )}
              {dayData.완료 > 0 && (
                <Box sx={{ 
                  flex: dayData.완료, 
                  bgcolor: 'success.main',
                  borderRadius: '2px'
                }} />
              )}
            </Box>
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