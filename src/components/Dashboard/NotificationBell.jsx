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
      // Realtime 업데이트와 충돌을 피하기 위해, fetch 시에는 unreadCount를 직접 설정하지 않고
      // Realtime 핸들러에서 새로운 알림에 대해서만 unreadCount를 증가시킵니다.
      // setUnreadCount(newUnread); 
    } else {
      // 처음 로드 시에는 전체 알림 수를 unreadCount로 설정할 수 있으나,
      // 클릭 시 0으로 초기화되므로, Realtime과 일관성을 위해 여기서도 직접 설정하지 않습니다.
      // setUnreadCount(newNotifications.length > 0 ? newNotifications.length : 0);
    }
  };
  
  useEffect(() => {
    // 초기 알림 로드
    fetchNotifications(page);

    let channel;
    let reconnectTimeout;

    const setupRealtimeSubscription = () => {
      // 기존 채널이 있다면 제거
      if (channel) {
        supabase.removeChannel(channel);
      }

      // Supabase Realtime 구독 설정
      channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            console.log('New notification received (Bell):', payload.new);
            // 새 알림을 기존 알림 목록의 맨 앞에 추가
            setNotifications((prevNotifications) => [payload.new, ...prevNotifications].slice(0, pageSize * (page + 1)));
            setTotalCount((prevTotalCount) => prevTotalCount + 1);
            
            // 읽지 않은 알림 수 증가
            setUnreadCount((prevUnreadCount) => prevUnreadCount + 1);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to notifications channel (Bell)');
            // 연결 성공 시 재연결 타이머 클리어
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('CHANNEL_ERROR (Bell):', err);
            // 토큰 만료 오류인 경우 세션 갱신 후 재연결 시도
            if (err && err.message && err.message.includes('expired')) {
              console.log('Token expired, attempting to refresh session...');
              supabase.auth.getSession().then(({ data: { session }, error }) => {
                if (error) {
                  console.error('Session refresh failed:', error);
                } else if (session) {
                  console.log('Session refreshed, reconnecting...');
                  // 5초 후 재연결 시도
                  reconnectTimeout = setTimeout(() => {
                    setupRealtimeSubscription();
                  }, 5000);
                }
              });
            }
          }
          if (status === 'TIMED_OUT') {
            console.error('TIMED_OUT (Bell)');
            // 타임아웃 시 재연결 시도
            reconnectTimeout = setTimeout(() => {
              console.log('Attempting to reconnect after timeout...');
              setupRealtimeSubscription();
            }, 10000);
          }
          if (status === 'CLOSED') {
            console.log('CLOSED (Bell)');
            // 연결이 종료된 경우 재연결 시도
            if (!reconnectTimeout) {
              reconnectTimeout = setTimeout(() => {
                console.log('Attempting to reconnect after close...');
                setupRealtimeSubscription();
              }, 5000);
            }
          }
        });
    };

    // 초기 구독 설정
    setupRealtimeSubscription();

    // 컴포넌트 언마운트 시 구독 해제 및 타이머 클리어
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [page]); // page가 변경될 때마다 fetchNotifications를 다시 호출하여 해당 페이지 데이터를 가져옵니다.

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