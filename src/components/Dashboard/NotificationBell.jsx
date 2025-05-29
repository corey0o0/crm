import { useEffect, useState, useRef } from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { supabase } from '../../lib/supabaseClient';
import { Box, Button, Typography, IconButton } from '@mui/material';

// 알림 메시지 파싱 함수
const parseNotificationMessage = (messageStr) => {
  if (typeof messageStr !== 'string' || !messageStr.trim()) {
    return { type: '내용 없음', name: '', contact: '', original: messageStr || '', isStructured: false };
  }
  const match = messageStr.match(/^(.*?)\[(.*?)]\\((.*?)\\)$/);
  if (match) {
    const type = match[1].trim() || '알림'; 
    const name = match[2].trim();
    const contact = match[3].trim();
    const isStructured = !!(name && contact);
    return { type, name, contact, original: messageStr, isStructured };
  }
  return { type: messageStr, name: '', contact: '', original: messageStr, isStructured: false };
};

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

    const lastCheckedTimestamp = localStorage.getItem(localStorageKey);
    if (lastCheckedTimestamp) {
      const newUnread = newNotifications.filter(n => new Date(n.created_at) > new Date(lastCheckedTimestamp)).length;
      setUnreadCount(newUnread);
    } else {
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

    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [page]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    const nowTimestamp = new Date().toISOString();
    localStorage.setItem(localStorageKey, nowTimestamp);
    setUnreadCount(0);
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
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label="show new notifications"
        sx={{ mr: 1 }}
      >
        <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <List sx={{ minWidth: 280, maxWidth: 400, maxHeight: 450, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText primary="최근 알림이 없습니다." />
            </ListItem>
          ) : (
            notifications.map((n) => {
              const parsed = parseNotificationMessage(n.message);
              const timeString = new Date(n.created_at).toLocaleString('ko-KR', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
              });
              return (
                <ListItem disablePadding key={n.id}>
                  <ListItemButton onClick={() => handleNotificationClick(n)} sx={{ alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 32, mt: '6px' }}>
                      <RadioButtonUncheckedIcon color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                          {parsed.isStructured ? parsed.type : parsed.original}
                        </Typography>
                      }
                      secondary={
                        <Typography component="div" variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                          {parsed.isStructured ? (
                            <>
                              {`${parsed.name} (${parsed.contact})`}
                              <br />
                              {timeString}
                            </>
                          ) : (
                            timeString
                          )}
                        </Typography>
                      }
                      sx={{ my: 0.5 }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })
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