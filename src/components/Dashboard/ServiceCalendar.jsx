import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Badge, Grid, IconButton, Button } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { supabase } from '../../lib/supabaseClient';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';

const ServiceCalendar = () => {
  const [serviceData, setServiceData] = useState({});
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [currentMonth, setCurrentMonth] = useState(dayjs());

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

  // 선택된 날짜 정보 렌더링
  const renderSelectedDateInfo = () => {
    if (!selectedDate) return null;
    
    const dateKey = selectedDate.format('YYYY-MM-DD');
    const dayData = serviceData[dateKey] || { 접수: 0, 처리중: 0, 완료: 0, 출고: 0 };
    
    return (
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Badge color="info" variant="dot" />
          <Typography variant="body2">접수: {dayData.접수}건</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Badge color="warning" variant="dot" />
          <Typography variant="body2">처리중: {dayData.처리중}건</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Badge color="success" variant="dot" />
          <Typography variant="body2">완료: {dayData.완료}건</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Badge color="secondary" variant="dot" />
          <Typography variant="body2">출고: {dayData.출고}건</Typography>
        </Box>
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
            day: (props) => (
              <Badge
                key={props.day.toString()}
                overlap="circular"
                badgeContent={renderDayContent(props.day)}
                sx={{
                  ".MuiBadge-badge": {
                    right: 7,
                    top: 30
                  }
                }}
              >
                <PickersDay {...props} outsideCurrentMonth={props.outsideCurrentMonth} />
              </Badge>
            ),
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
        
        {/* 선택된 날짜 정보 표시 */}
        {selectedDate && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {selectedDate.format('YYYY년 MM월 DD일')} 현황
            </Typography>
            {renderSelectedDateInfo()}
          </Box>
        )}
      </LocalizationProvider>
    </Paper>
  );
};

export default ServiceCalendar; 