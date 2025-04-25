import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Badge } from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { supabase } from '../../lib/supabaseClient';

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
        .select('reception_date, completion_date, status')
        .gte('reception_date', startOfMonth)
        .lte('reception_date', endOfMonth);

      if (error) throw error;

      // 날짜별로 상태 카운트를 집계
      const aggregatedData = data.reduce((acc, service) => {
        // 접수일자 처리
        const receptionDate = dayjs(service.reception_date).format('YYYY-MM-DD');
        if (!acc[receptionDate]) {
          acc[receptionDate] = { 접수: 0, 처리중: 0, 완료: 0, 출고: 0 };
        }
        acc[receptionDate][service.status]++;
        
        // 출고일자 처리
        if (service.completion_date) {
          const completionDate = dayjs(service.completion_date).format('YYYY-MM-DD');
          if (!acc[completionDate]) {
            acc[completionDate] = { 접수: 0, 처리중: 0, 완료: 0, 출고: 0 };
          }
          acc[completionDate].출고++;
        }
        
        return acc;
      }, {});

      setServiceData(aggregatedData);
    } catch (error) {
      console.error('서비스 데이터 조회 중 오류:', error);
    }
  };

  const renderDayContent = (date) => {
    const formattedDate = date.format('YYYY-MM-DD');
    const dayData = serviceData[formattedDate] || { 접수: 0, 처리중: 0, 완료: 0, 출고: 0 };
    const total = dayData.접수 + dayData.처리중 + dayData.완료 + dayData.출고;

    if (total === 0) return null;

    return (
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
        {dayData.출고 > 0 && (
          <Badge 
            badgeContent={dayData.출고} 
            color="secondary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: '14px', minWidth: '14px' } }}
          />
        )}
      </Box>
    );
  };

  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 2,
        bgcolor: '#ffffff',
        borderRadius: 2,
        width: '100%'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#191f28' }}>
          A/S 현황
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Badge color="info" variant="dot" />
            <Typography variant="caption" color="text.secondary">접수</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Badge color="warning" variant="dot" />
            <Typography variant="caption" color="text.secondary">처리중</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Badge color="success" variant="dot" />
            <Typography variant="caption" color="text.secondary">완료</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Badge color="secondary" variant="dot" />
            <Typography variant="caption" color="text.secondary">출고</Typography>
          </Box>
        </Box>
      </Box>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
        <DateCalendar
          value={selectedDate}
          onChange={(newValue) => setSelectedDate(newValue)}
          slots={{
            day: (props) => {
              const { day, ...other } = props;
              return (
                <Box sx={{ position: 'relative' }}>
                  <DateCalendar.Day day={day} {...other} />
                  {renderDayContent(day)}
                </Box>
              );
            }
          }}
          sx={{
            width: '100%',
            '& .MuiDayCalendar-weekDayLabel': {
              color: '#666',
              fontWeight: 600
            },
            '& .MuiPickersDay-root': {
              height: '45px',
              width: '45px',
              backgroundColor: 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              },
              '&.Mui-selected': {
                backgroundColor: '#3182f6',
                color: '#fff',
                '&:hover': {
                  backgroundColor: '#1b64da'
                }
              }
            }
          }}
        />
      </LocalizationProvider>
    </Paper>
  );
};

export default ServiceCalendar; 