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
  Link
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
  Message as MessageIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

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

  const menuItems = [
    { text: '대시보드', icon: <DashboardIcon />, path: '/' },
    { text: 'A/S 관리', icon: <BuildIcon />, path: '/services' },
    { text: '출고 관리', icon: <LocalShippingIcon />, path: '/shipments' },
    { text: '고객 관리', icon: <PeopleIcon />, path: '/customers' },
    { text: '파츠 관리', icon: <InventoryIcon />, path: '/parts' },
    { text: '재고 관리', icon: <InventoryIcon />, path: '/stocks' },
    // { text: 'A/S 통계', icon: <BarChartIcon />, path: '/service-statistics' },
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
          <Typography
            variant="body2"
            sx={{
              color: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 500,
              mr: 2
            }}
          >
            {formatDateTime(currentDateTime)}
          </Typography>
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
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
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
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}
      <Main open={open && !isMobile}>
        <DrawerHeader />
        <Outlet />
      </Main>
    </Box>
  );
}

export default Layout; 