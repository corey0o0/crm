import { useEffect, useState, useRef } from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { supabase } from '../../lib/supabaseClient';
import { Box, Button, Typography } from '@mui/material';

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null); // interval ID 저장

  const localStorageKey = 'lastCheckedNotificationTimestamp'; // localStorage 키 정의

  const fetchNotifications = async (currentPage = 0) => {
    const from = currentPage * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[NotificationBell] Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
      setTotalCount(0);
      return;
    }

    const newNotifications = data || [];
    setNotifications(newNotifications);
    setTotalCount(count || 0);

    // unreadCount 계산은 localStorage 기준으로 변경 (다음 단계에서 적용)
    const lastCheckedTimestamp = localStorage.getItem(localStorageKey);
    if (lastCheckedTimestamp) {
      const newUnread = newNotifications.filter(n => new Date(n.created_at) > new Date(lastCheckedTimestamp)).length;
      setUnreadCount(newUnread);
    } else {
      // localStorage에 값이 없으면 모든 알림을 새 알림으로 간주 (또는 초기값 설정)
      setUnreadCount(newNotifications.length > 0 ? newNotifications.length : 0); 
    }
  };

  const startPolling = () => {
    fetchNotifications(page);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchNotifications(page), 1 * 60 * 1000); 
  };

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    // 초기 로드 시 탭이 활성화 상태면 폴링 시작
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling(); // 컴포넌트 언마운트 시 폴링 중단
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [page]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    // 알림 벨 클릭 시, 현재 시간을 localStorage에 저장
    const nowTimestamp = new Date().toISOString();
    localStorage.setItem(localStorageKey, nowTimestamp);
    setUnreadCount(0); // 뱃지 카운트를 즉시 0으로 업데이트
  };
  const handleClose = () => setAnchorEl(null);

  const handleNotificationClick = async (n) => {
    if (n.link) {
        window.location.href = n.link;
    }    
    handleClose();
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    // fetchNotifications는 page useEffect에 의해 호출됨
  };

  // Tooltip title은 계속 최신 5개 보여주도록 유지
  const tooltipTitle = 
    notifications.length > 0 ? (
      <div>
        {notifications.slice(0, 5).map((n, i) => (
          <div key={n.id || i} style={{ whiteSpace: 'pre-line', display: 'flex', alignItems: 'center' }}>
            <span>{n.message}</span>
            <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>
              {new Date(n.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    ) : '최근 알림이 없습니다.';

  return (
    <>
      <Tooltip
        arrow
        title={tooltipTitle} 
      >
        <Badge 
          badgeContent={unreadCount} 
          color="error"
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          sx={{
            '& .MuiBadge-badge': {
            },
          }}
        >
          <NotificationsIcon
            sx={{ 
              cursor: 'pointer', 
              ml: unreadCount > 0 ? 1 : 2,
              mr: 2
            }}
            fontSize="medium"
            onClick={handleClick}
          />
        </Badge>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <List sx={{ minWidth: 260, maxWidth: 350, maxHeight: 400, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText primary="최근 알림이 없습니다." />
            </ListItem>
          ) : (
            notifications.map((n) => (
              <ListItem disablePadding key={n.id}>
                <ListItemButton
                  onClick={() => handleNotificationClick(n)}
                >
                  <ListItemIcon>
                    <RadioButtonUncheckedIcon color="primary" /> 
                  </ListItemIcon>
                  <ListItemText
                    primary={n.message}
                    secondary={new Date(n.created_at).toLocaleString('ko-KR')}
                  />
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
        {totalCount > pageSize && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1 }}>
            <Button size="small" onClick={() => handlePageChange(page - 1)} disabled={page === 0}>이전</Button>
            <Typography variant="caption" sx={{ mx: 2 }}>
              {page + 1} / {Math.ceil(totalCount / pageSize)}
            </Typography>
            <Button size="small" onClick={() => handlePageChange(page + 1)} disabled={page >= Math.ceil(totalCount / pageSize) - 1}>다음</Button>
          </Box>
        )}
      </Popover>
    </>
  );
}

export default NotificationBell; 