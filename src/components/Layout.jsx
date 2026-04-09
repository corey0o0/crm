import React, { useState, useEffect } from 'react';
import DebugPanel from './DebugPanel';
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
  Chip,
  Tooltip,
  CircularProgress,
  Collapse
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Sync as SyncIcon,
  SyncProblem as SyncProblemIcon,
  People as PeopleIcon,
  Build as BuildIcon,
  BarChart as BarChartIcon,
  Inventory as InventoryIcon,
  LocalShipping as LocalShippingIcon,
  Receipt as ReceiptIcon,
  DriveFileMove as DriveIcon,
  Message as MessageIcon,
  Assessment as AssessmentIcon,
  Analytics as AnalyticsIcon,
  Link as LinkIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  MenuBook as MenuBookIcon,
  Backup as BackupIcon,
  CalendarToday as CalendarTodayIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  ShoppingCartOutlined as ShoppingCartOutlinedIcon,
  Science as ScienceIcon,
  Store as StoreIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { getUserMenuKeys } from '../config/menuConfig';
// import NotificationBell from './Dashboard/NotificationBell'; // 임시 비활성화
import ServiceCalendar from './ServiceCalendar';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { getSyncStatus } from '../utils/syncUtils';

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({});
  const { user, userMenuPermissions } = useAuth();
  const [openSubMenus, setOpenSubMenus] = useState({});

  const handleMenuClick = (item) => {
    if (item.children) {
      setOpenSubMenus(prev => ({ ...prev, [item.key]: !prev[item.key] }));
    } else {
      navigate(item.path);
      if (isMobile) setOpen(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 연결 상태 모니터링
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 동기화 상태 모니터링
  useEffect(() => {
    const interval = setInterval(() => {
      const status = getSyncStatus();
      setSyncStatus(status);
    }, 2000);

    return () => clearInterval(interval);
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

  const allMenuItems = [
    // 📊 대시보드
    { text: '대시보드', icon: <DashboardIcon />, path: '/', key: 'dashboard' },

    // ⚙️ 기초등록
    {
      text: '기초등록',
      icon: <MenuBookIcon />,
      path: '',
      key: 'basic_registrations',
      children: [
        { text: '상품 관리', icon: <InventoryIcon />, path: '/parts', key: 'parts' },
        { text: '거래처 관리', icon: <InventoryIcon />, path: '/agencies', key: 'agencies' },
        { text: '고객 관리', icon: <PeopleIcon />, path: '/customers', key: 'customers' },
      ]
    },

    // 🔧 서비스 관리
    { text: 'A/S 관리', icon: <BuildIcon />, path: '/services', key: 'services' },

    // 📦 재고 & 물류 관리
    { 
      text: '판매 관리', 
      icon: <ShoppingCartOutlinedIcon />, 
      path: '', 
      key: 'sales',
      children: [
        { text: '매장출고관리', icon: <LocalShippingIcon />, path: '/shipment', key: 'shipment' },
        { text: '온라인주문관리', icon: <ShoppingCartOutlinedIcon />, path: '/cafe24/orders', key: 'cafe24_orders' },
        { text: '수기 판매 등록', icon: <LocalShippingIcon />, path: '/sales/entry', key: 'sales_entry' }
      ]
    },
    // { text: '주문대기', icon: <ShoppingCartOutlinedIcon />, path: '/pending-orders', key: 'pending_orders' },
    { text: '매장 재고 관리', icon: <InventoryIcon />, path: '/stocks', key: 'stocks' },
    { text: '입출고 관리', icon: <InventoryIcon />, path: '/inventory-management', key: 'inventory_management' },

    // 📊 통계 & 분석
    { 
      text: '통계', 
      icon: <BarChartIcon />, 
      path: '', 
      key: 'stats',
      children: [
        { text: '매출 통계', icon: <BarChartIcon />, path: '/sales/stats', key: 'sales_stats' },
        { text: '온라인 통계', icon: <BarChartIcon />, path: '/online/stats', key: 'online_stats' }
      ]
    },
    // { text: 'A/S 분석', icon: <AnalyticsIcon />, path: '/service/analysis', key: 'service_analysis' },

    // 💬 커뮤니티
    { text: '게시판', icon: <MenuBookIcon />, path: '/board', key: 'board' },

    // ⚙️ 설정
    // { text: '상품 동기화(비교)', icon: <SyncIcon />, path: '/settings/product-sync', key: 'admin_tools' },
    { text: '관리자 도구', icon: <ScienceIcon />, path: '/admin/tools', key: 'admin_tools' }
  ];

  // 이메일 및 DB 설정 기반 메뉴 필터링
  const userMenuKeys = getUserMenuKeys(user?.email, userMenuPermissions);
  const menuItems = userMenuKeys === 'all'
    ? allMenuItems
    : allMenuItems.filter(item => userMenuKeys.includes(item.key));

  const handleDrawerToggle = () => {
    setOpen(!open);
  };


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate('/login');
    }
  };


  const handleOpenEkuraExcel = () => {
    window.open('https://docs.google.com/spreadsheets/d/1VPMcM_qRly_lKsx0wt54QjpRStolIhk9G_QPKJDOP-U/edit?gid=0#gid=0', '_blank');
  };

  const handleOpenBoltonAS = () => {
    window.open('https://onedrive.live.com/:x:/g/personal/4F1EFA708E1F82FD/EcakLuv3M8lEgR5v3v1xFp4BxzwiCQjfozZSYJgoZNyfwQ?resid=4F1EFA708E1F82FD!seb2ea4c633f744c9811e6fdefd71169e&ithint=file%2Cxlsx&e=DIWp4f&migratedtospo=true&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3gvYy80ZjFlZmE3MDhlMWY4MmZkL0VjYWtMdXYzTThsRWdSNXYzdjF4RnA0Qnh6d2lDUWpmb3paU1lKZ29aTnlmd1E_ZT1ESVdwNGY', '_blank');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" open={open}>
        <Toolbar sx={{
          px: { xs: 1, sm: 2 },
          minHeight: { xs: 56, sm: 64 },
          gap: { xs: 0.5, sm: 1 }
        }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: { xs: 1, sm: 2 } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              flexGrow: 1,
              cursor: 'pointer',
              fontSize: { xs: '0.875rem', sm: '1.25rem' },
              fontWeight: { xs: 600, sm: 500 },
              wordBreak: 'keep-all',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: { xs: '100px', sm: 'none' }
            }}
            onClick={() => navigate('/')}
          >
            {isMobile ? 'CRM' : '고객관리시스템'}
          </Typography>
          {/* <NotificationBell /> */} {/* 임시 비활성화 */}
          <Box
            onClick={handleCalendarOpen}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, sm: 1 },
              mr: { xs: 0.5, sm: 2 },
              cursor: 'pointer',
              borderRadius: 1,
              px: { xs: 1, sm: 1.5 },
              py: { xs: 0.5, sm: 0.5 },
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                transform: 'scale(1.02)'
              }
            }}
          >
            <CalendarTodayIcon sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, color: 'inherit', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  color: 'inherit',
                  fontSize: { xs: '0.8rem', sm: '1rem' },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  textAlign: 'center',
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap'
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
                  lineHeight: 1.2,
                  textAlign: 'center',
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatDateTimeWithWeekday(currentDateTime).weekday} • {formatDateTimeWithWeekday(currentDateTime).time}
              </Typography>
            </Box>
          </Box>

          {/* 디버그 버튼 (마스터 계정 전용) */}
          <DebugPanel />

          {/* 연결 상태 아이콘 */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip
              title={
                <Box sx={{ p: 1 }}>
                  <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 'bold' }}>
                    연결 상태
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {isOnline ? (
                      <WifiIcon sx={{ color: 'success.main', mr: 1 }} />
                    ) : (
                      <WifiOffIcon sx={{ color: 'error.main', mr: 1 }} />
                    )}
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      {isOnline ? '온라인' : '오프라인'}
                    </Typography>
                  </Box>
                  {syncStatus.pendingChangesCount > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <SyncProblemIcon sx={{ color: 'warning.main', mr: 1 }} />
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        대기 중인 변경: {syncStatus.pendingChangesCount}개
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    마지막 동기화: {syncStatus.lastSync}
                  </Typography>
                </Box>
              }
              arrow
              placement="bottom"
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: 'rgba(0, 0, 0, 0.9)',
                    '& .MuiTooltip-arrow': {
                      color: 'rgba(0, 0, 0, 0.9)',
                    },
                  },
                },
              }}
            >
              <IconButton
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  color: isOnline ? 'success.main' : 'error.main',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                {isOnline ? (
                  <WifiIcon sx={{
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    filter: 'drop-shadow(0 0 2px rgba(76, 175, 80, 0.3))'
                  }} />
                ) : (
                  <WifiOffIcon sx={{
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    filter: 'drop-shadow(0 0 2px rgba(244, 67, 54, 0.3))'
                  }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {/* 모바일에서는 아이콘만, 데스크톱에서는 텍스트 포함 */}
          {isMobile ? (
            <>
              <IconButton
                color="inherit"
                component={Link}
                href="https://messages.google.com/web/conversations"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{ mr: 0.5 }}
              >
                <MessageIcon />
              </IconButton>
              <IconButton
                color="inherit"
                onClick={handleOpenEkuraExcel}
                size="small"
                sx={{ mr: 0.5 }}
              >
                <LinkIcon />
              </IconButton>
              <IconButton
                color="inherit"
                onClick={handleOpenBoltonAS}
                size="small"
                sx={{ mr: 0.5 }}
              >
                <LinkIcon />
              </IconButton>
              <IconButton
                color="inherit"
                onClick={handleSignOut}
                size="small"
              >
                <LogoutIcon />
              </IconButton>
            </>
          ) : (
            <>
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
              <Button
                color="inherit"
                startIcon={<LinkIcon />}
                onClick={handleOpenBoltonAS}
                sx={{ mr: 1 }}
              >
                볼턴A/S
              </Button>
              <Button color="inherit" onClick={handleSignOut}>
                로그아웃
              </Button>
            </>
          )}
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
            {menuItems.map((item) => {
              const isOpen = item.children && openSubMenus[item.key];
              return (
              <Box key={item.key || item.text} sx={{ mb: 0.5, bgcolor: isOpen ? 'rgba(0, 0, 0, 0.03)' : 'transparent', borderRadius: isOpen ? '8px' : '0px', mx: isOpen ? 0.5 : 0, py: isOpen ? 0.5 : 0 }}>
                <ListItem
                  button
                  onClick={() => handleMenuClick(item)}
                  selected={!item.children && location.pathname === item.path}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'white' },
                    },
                    borderRadius: '4px', mx: 1, mb: 0
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: (!item.children && location.pathname === item.path) ? 700 : 400,
                      sx: { wordBreak: 'keep-all', whiteSpace: 'normal', color: isOpen ? 'primary.main' : 'inherit' }
                    }}
                  />
                  {item.children ? (isOpen ? <ExpandLess color="primary" /> : <ExpandMore />) : null}
                </ListItem>
                {item.children && (
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.children.map((child) => (
                        <ListItem
                          button
                          key={child.key || child.text}
                          onClick={() => handleMenuClick(child)}
                          selected={location.pathname === child.path}
                          sx={{
                            pl: 4,
                            '&.Mui-selected': {
                              backgroundColor: 'primary.main',
                              color: 'white',
                              '&:hover': { backgroundColor: 'primary.dark' },
                              '& .MuiListItemIcon-root': { color: 'white' },
                            },
                            borderRadius: '4px', mx: 1, mt: 0.5
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>{child.icon}</ListItemIcon>
                          <ListItemText primary={child.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: location.pathname === child.path ? 700 : 400 }} />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            )})}
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
            {menuItems.map((item) => {
              const isOpen = item.children && openSubMenus[item.key];
              return (
              <Box key={item.key || item.text} sx={{ mb: 0.5, bgcolor: isOpen ? 'rgba(0, 0, 0, 0.03)' : 'transparent', borderRadius: isOpen ? '8px' : '0px', mx: isOpen ? 0.5 : 0, py: isOpen ? 0.5 : 0 }}>
                <ListItem
                  button
                  onClick={() => handleMenuClick(item)}
                  selected={!item.children && location.pathname === item.path}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'white' },
                    },
                    borderRadius: '4px', mx: 1, mb: 0
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: (!item.children && location.pathname === item.path) ? 700 : 400,
                      sx: { wordBreak: 'keep-all', whiteSpace: 'normal', color: isOpen ? 'primary.main' : 'inherit' }
                    }}
                  />
                  {item.children ? (isOpen ? <ExpandLess color="primary" /> : <ExpandMore />) : null}
                </ListItem>
                {item.children && (
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.children.map((child) => (
                        <ListItem
                          button
                          key={child.key || child.text}
                          onClick={() => handleMenuClick(child)}
                          selected={location.pathname === child.path}
                          sx={{
                            pl: 4,
                            '&.Mui-selected': {
                              backgroundColor: 'primary.main',
                              color: 'white',
                              '&:hover': { backgroundColor: 'primary.dark' },
                              '& .MuiListItemIcon-root': { color: 'white' },
                            },
                            borderRadius: '4px', mx: 1, mt: 0.5
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>{child.icon}</ListItemIcon>
                          <ListItemText primary={child.text} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: location.pathname === child.path ? 700 : 400 }} />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            )})}
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