import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  useTheme,
  useMediaQuery,
  SwipeableDrawer,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Build as BuildIcon,
  BarChart as BarChartIcon,
  Inventory as InventoryIcon,
  LocalShipping as LocalShippingIcon,
  Receipt as ReceiptIcon,
  DriveFileMove as DriveIcon,
  Message as MessageIcon,
  Assessment as AssessmentIcon,
  Link as LinkIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  MenuBook as MenuBookIcon,
  CalendarToday as CalendarTodayIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import NotificationBell from './Dashboard/NotificationBell';
import ServiceCalendar from './ServiceCalendar';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

// 드로어 너비 설정
const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: 0,
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: drawerWidth,
    }),
    [theme.breakpoints.down('sm')]: {
      marginLeft: 0,
      padding: theme.spacing(2),
    },
  }),
);

const AppBarStyled = styled(AppBar)(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  borderRadius: 0,
  elevation: 0,
  '& .MuiAppBar-root': {
    borderRadius: 0,
  }
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(!isMobile);
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [dailyServices, setDailyServices] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date) => {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDateTimeWithWeekday = (date) => {
    const dayjs_date = dayjs(date).locale('ko');
    return {
      date: dayjs_date.format('MM월 DD일'),
      weekday: dayjs_date.format('dddd'),
      time: dayjs_date.format('HH:mm'),
      year: dayjs_date.format('YYYY년')
    };
  };

  // 선택된 날짜의 A/S 현황 가져오기
  const fetchDailyServices = async (date) => {
    try {
      const selectedDateStr = date.format('YYYY-MM-DD');
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .gte('reception_date', `${selectedDateStr}T00:00:00.000Z`)
        .lte('reception_date', `${selectedDateStr}T23:59:59.999Z`)
        .order('reception_date', { ascending: false });

      if (error) throw error;
      setDailyServices(data || []);
    } catch (error) {
      console.error('일일 A/S 현황 조회 중 오류:', error);
      setDailyServices([]);
    }
  };

  // 달력 열기
  const handleCalendarOpen = () => {
    setCalendarOpen(true);
    fetchDailyServices(selectedDate);
  };

  // 달력 닫기
  const handleCalendarClose = () => {
    setCalendarOpen(false);
  };

  // 날짜 변경
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    fetchDailyServices(newDate);
  };

  const menuItems = [
    { text: '대시보드', icon: <DashboardIcon />, path: '/' },
    { text: 'A/S 관리', icon: <BuildIcon />, path: '/services' },
    { text: '출고 관리', icon: <LocalShippingIcon />, path: '/shipment' },
    { text: '고객 관리', icon: <PeopleIcon />, path: '/customers' },
    { text: '파츠 관리', icon: <InventoryIcon />, path: '/parts' },
    { text: '재고 관리', icon: <InventoryIcon />, path: '/stocks' },
    { text: '재고 변경 내역', icon: <HistoryIcon />, path: '/inventory-logs' },
    { text: '게시판', icon: <MenuBookIcon />, path: '/board' },
    // { text: '기존 메뉴얼', icon: <MenuBookIcon />, path: '/xrider-manual' },
    // { text: 'A/S 통계', icon: <AssessmentIcon />, path: '/stats/service' }, //
    { text: '매출 통계', icon: <BarChartIcon />, path: '/sales/stats' }
    // { text: '영수증 스캔', icon: <ReceiptIcon />, path: '/receipts' },
    // { text: '드라이브 테스트', icon: <DriveIcon />, path: '/google-drive-test' }
  ];

  const handleDrawerToggle = () => {
    setOpen(!open);
  };
  

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate('/login');
    }
  };

  // 모바일에서 메뉴 클릭시 자동으로 드로어 닫기
  const handleMenuClick = (path) => {
    navigate(path);
    if (isMobile) {
      setOpen(false);
    }
  };

  const handleOpenEkuraExcel = () => {
    window.open('https://docs.google.com/spreadsheets/d/1VPMcM_qRly_lKsx0wt54QjpRStolIhk9G_QPKJDOP-U/edit?gid=0#gid=0', '_blank');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            고객관리시스템
          </Typography>
          <NotificationBell />
          <Box
            onClick={handleCalendarOpen}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mr: 2,
              cursor: 'pointer',
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                transform: 'scale(1.02)'
              }
            }}
          >
            <CalendarTodayIcon sx={{ fontSize: '1.1rem', color: 'inherit' }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'inherit',
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  fontWeight: 700,
                  lineHeight: 1,
                  textAlign: 'center'
                }}
              >
                {formatDateTimeWithWeekday(currentDateTime).date}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'inherit',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  fontWeight: 500,
                  opacity: 0.9,
                  lineHeight: 1,
                  textAlign: 'center'
                }}
              >
                {formatDateTimeWithWeekday(currentDateTime).weekday} • {formatDateTimeWithWeekday(currentDateTime).time}
              </Typography>
            </Box>
          </Box>
          <Button
            color="inherit"
            startIcon={<MessageIcon />}
            component={Link}
            href="https://messages.google.com/web/conversations"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mr: 1 }}
          >
            구글 메시지
          </Button>
          <Button 
            color="inherit" 
            startIcon={<LinkIcon />}
            onClick={handleOpenEkuraExcel} 
            sx={{ mr: 1 }}
          >
            엑라엑셀
          </Button>
          <Button color="inherit" onClick={handleSignOut}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBarStyled>
      {isMobile ? (
        <SwipeableDrawer
          anchor="left"
          open={open}
          onClose={handleDrawerToggle}
          onOpen={handleDrawerToggle}
          sx={{
            '& .MuiDrawer-paper': {
              width: 'auto',
              minWidth: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          disableBackdropTransition
          disableDiscovery
        >
          <DrawerHeader>
            <IconButton onClick={handleDrawerToggle}>
              <ChevronLeftIcon />
            </IconButton>
          </DrawerHeader>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => handleMenuClick(item.path)}
                selected={location.pathname === item.path}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  borderRadius: '4px',
                  mx: 1,
                  mb: 0.5
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.path ? 700 : 400
                  }}
                />
              </ListItem>
            ))}
          </List>
        </SwipeableDrawer>
      ) : (
        <Drawer
          sx={{
            width: 'auto',
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 'auto',
              minWidth: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(0, 0, 0, 0.08)',
            },
          }}
          variant="persistent"
          anchor="left"
          open={open}
        >
          <DrawerHeader>
            <IconButton onClick={handleDrawerToggle}>
              <ChevronLeftIcon />
            </IconButton>
          </DrawerHeader>
          <Divider />
          <List>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => handleMenuClick(item.path)}
                selected={location.pathname === item.path}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  borderRadius: '4px',
                  mx: 1,
                  mb: 0.5
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.path ? 700 : 400
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}
      <Main open={open && !isMobile}>
        <DrawerHeader />
        <Outlet />
      </Main>
      
      {/* 달력 모달 */}
      <Dialog 
        open={calendarOpen} 
        onClose={handleCalendarClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            📅 달력 및 A/S 현황
          </Typography>
          <IconButton onClick={handleCalendarClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* 달력 */}
            <Grid item xs={12} md={7}>
              <ServiceCalendar 
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
              />
            </Grid>
            
            {/* 선택된 날짜의 A/S 현황 */}
            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', border: '1px solid #e9ecef' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  {selectedDate.locale('ko').format('MM월 DD일 dddd')} A/S 현황
                </Typography>
                
                {dailyServices.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    선택된 날짜에 A/S 접수 내역이 없습니다.
                  </Typography>
                ) : (
                  <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {dailyServices.map((service) => (
                      <ListItem 
                        key={service.id} 
                        sx={{ 
                          mb: 1, 
                          bgcolor: 'white', 
                          borderRadius: 1,
                          border: '1px solid #e9ecef',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#f1f3f4' }
                        }}
                        onClick={() => {
                          handleCalendarClose();
                          navigate(`/services/${service.id}`);
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {service.customer_name}
                              </Typography>
                              <Chip 
                                label={service.status} 
                                size="small"
                                sx={{
                                  bgcolor: service.status === '접수' ? '#3182f6' :
                                          service.status === '처리중' ? '#ffa927' :
                                          service.status === '부분완료' ? '#4e5968' :
                                          '#00c773',
                                  color: 'white',
                                  fontSize: '0.75rem'
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {service.product_name} • {dayjs(service.reception_date).format('HH:mm')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                                📞 {service.customer_phone}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCalendarClose} variant="contained">
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Layout; 