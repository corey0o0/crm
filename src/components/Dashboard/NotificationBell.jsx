import { useEffect, useState, useRef } from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { supabase } from '../../lib/supabaseClient';
import { Box, Button, Typography, IconButton, Divider, Card, CardContent } from '@mui/material';

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
  const [toast, setToast] = useState({ open: false, message: '' });
  const [unreadThreshold, setUnreadThreshold] = useState(null); // 드로어 열릴 때 기준 시각
  const localStorageKey = 'lastCheckedNotificationTimestamp';

  const fetchNotifications = async (currentPage = 0) => {
    try {
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        // notifications 테이블이 없는 경우 조용히 처리
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log('[NotificationBell] notifications 테이블이 없습니다. 알림 기능을 비활성화합니다.');
          setNotifications([]);
          setUnreadCount(0);
          setTotalCount(0);
          return;
        }
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
        // 첫 방문: 현재 시각을 기준으로 저장 (이후 새로 들어오는 것만 카운트)
        localStorage.setItem(localStorageKey, new Date().toISOString());
      }
    } catch (error) {
      console.log('[NotificationBell] 알림 기능을 임시로 비활성화합니다:', error.message);
      setNotifications([]);
      setUnreadCount(0);
      setTotalCount(0);
      return;
    }
  };
  
  useEffect(() => {
    // 초기 알림 로드
    fetchNotifications(page);

    let channel;
    let reconnectTimeout;
    let reconnectAttempts = 0; // 재연결 시도 횟수 추적

    const setupRealtimeSubscription = () => {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }

        channel = supabase
          .channel(`notifications-bell-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
              const newItem = payload.new;
              setNotifications((prev) => [newItem, ...prev].slice(0, pageSize * (page + 1)));
              setTotalCount((prev) => prev + 1);
              setUnreadCount((prev) => prev + 1);

              // 페이지에 접속 중인 사용자에게 토스트 안내
              const msg = newItem.message || '새 시스템 알림이 도착했습니다.';
              setToast({ open: true, message: msg });
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
              }
              reconnectAttempts = 0;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
              reconnectAttempts++;
              reconnectTimeout = setTimeout(setupRealtimeSubscription, delay);
            }
          });
      } catch (error) {
        console.log('[NotificationBell] 실시간 구독 설정 중 오류:', error.message);
      }
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
    // 드로어 열릴 때: 현재 lastChecked 기준 시각을 저장 (목록에서 미읽음 구분용)
    const lastChecked = localStorage.getItem(localStorageKey);
    setUnreadThreshold(lastChecked);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    // 드로어 닫힐 때: lastChecked 업데이트 및 미읽음 수 초기화
    const nowTimestamp = new Date().toISOString();
    localStorage.setItem(localStorageKey, nowTimestamp);
    setUnreadCount(0);
    setUnreadThreshold(null);
    setAnchorEl(null);
  };

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
      {/* 실시간 새 알림 토스트 */}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity="info"
          onClose={() => setToast({ open: false, message: '' })}
          sx={{ maxWidth: 360, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          🔔 {toast.message}
        </Alert>
      </Snackbar>

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
      
      {/* 5px 숨김 상태의 오른쪽 엣지 레이아웃 (오버 시 나타남) */}
      <Box 
        onClick={handleClick}
        sx={{
          position: 'fixed',
          right: 0,
          top: 64, // below app bar
          bottom: 0,
          width: 5,
          bgcolor: 'transparent',
          cursor: 'pointer',
          zIndex: 1100,
          transition: 'all 0.2s',
          '&:hover': {
            width: 15,
            bgcolor: 'rgba(0,0,0,0.1)',
            borderLeft: '1px solid #ddd'
          }
        }}
      />
      <Drawer
        anchor="right"
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: { xs: '100vw', sm: 400 }, bgcolor: '#f8f9fa' }
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'white', borderBottom: '1px solid #eee' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>알림</Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
              <Typography>최근 알림이 없습니다.</Typography>
            </Box>
          ) : (
            notifications.map((n) => {
              const parsed = parseNotificationMessage(n.message);
              const timeString = new Date(n.created_at).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              });
              const isUnread = unreadThreshold
                ? new Date(n.created_at) > new Date(unreadThreshold)
                : false;
              return (
                <Card
                  key={n.id}
                  sx={{
                    mb: 2, borderRadius: 2, cursor: 'pointer',
                    boxShadow: isUnread ? '0 2px 12px rgba(25,118,210,0.18)' : '0 2px 8px rgba(0,0,0,0.05)',
                    border: isUnread ? '1.5px solid #1976d2' : '1.5px solid transparent',
                    bgcolor: isUnread ? '#f0f7ff' : 'white',
                    '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                  }}
                  onClick={() => handleNotificationClick(n)}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <RadioButtonUncheckedIcon color={isUnread ? 'primary' : 'disabled'} fontSize="small" sx={{ mr: 1, width: 16, height: 16 }} />
                        <Typography variant="caption" color={isUnread ? 'primary' : 'text.secondary'} sx={{ fontWeight: isUnread ? 600 : 400 }}>
                          {parsed.isStructured ? parsed.type : '시스템 알림'} • {timeString}
                        </Typography>
                      </Box>
                      {isUnread && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1976d2', flexShrink: 0 }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: isUnread ? 700 : 600, mb: 0.5, wordBreak: 'break-word' }}>
                      {parsed.isStructured ? `${parsed.name} (${parsed.contact})` : parsed.original}
                    </Typography>
                    {parsed.isStructured && (
                      <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                        {parsed.original}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Box>
        
        {totalCount > pageSize && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, bgcolor: 'white', borderTop: '1px solid #eee' }}>
            <Button size="small" variant="outlined" onClick={() => handlePageChange(page - 1)} disabled={page === 0}>이전</Button>
            <Typography variant="caption" sx={{ mx: 2 }}>
              {page + 1} / {Math.ceil(totalCount / pageSize)}
            </Typography>
            <Button size="small" variant="outlined" onClick={() => handlePageChange(page + 1)} disabled={page >= Math.ceil(totalCount / pageSize) - 1}>다음</Button>
          </Box>
        )}
      </Drawer>
    </>
  );
}

export default NotificationBell; 