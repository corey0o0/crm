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

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null); // interval ID 저장

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setNotifications(data || []);
    setUnreadCount((data || []).filter(n => !n.is_read).length);
  };

  const startPolling = () => {
    fetchNotifications(); // 즉시 실행
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchNotifications, 1 * 60 * 1000); // 1분 간격
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
  }, []);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    // window.location.href = n.link; // 페이지 이동 대신 useNavigate 사용 권장
    // 예시: navigate(n.link);
    // 현재는 페이지 이동 로직 주석 처리 (navigate 훅 추가 필요)
    if (n.link) {
        // 현재 창에서 링크 열기
        window.location.href = n.link;
    }    
    handleClose();
  };

  return (
    <>
      <Tooltip title="최근 알림" arrow>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon
            sx={{ cursor: 'pointer', mr: 2 }}
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
                  selected={!n.is_read}
                >
                  <ListItemIcon>
                    {n.is_read ? <CheckCircleIcon color="action" /> : <RadioButtonUncheckedIcon color="primary" />}
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
      </Popover>
    </>
  );
}

export default NotificationBell; 