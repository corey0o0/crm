import { useEffect, useState, useRef } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';
import supabase from '../../supabaseClient';

function NotificationToast() {
  const [alert, setAlert] = useState(null);
  const lastAlertId = useRef(null);

  useEffect(() => {
    // 초기 최신 알림 로드 (선택적)
    const fetchInitialNotification = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        // 이전에 표시된 알림과 다른 경우에만 표시 (새로고침 시 중복 방지)
        if (data[0].id !== lastAlertId.current) {
          setAlert(data[0]);
          lastAlertId.current = data[0].id;
        }
      }
    };
    // fetchInitialNotification(); // 필요에 따라 주석 해제하여 초기 로드 활성화

    // Supabase Realtime 구독 설정
    const channel = supabase
      .channel('public:notifications-toast') // 고유한 채널 이름 사용
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('New notification received (Toast):', payload.new);
          // 동일 알림 중복 표시 방지 (매우 짧은 시간 내 중복 이벤트 발생 가능성 대비)
          if (payload.new.id !== lastAlertId.current) {
            setAlert(payload.new);
            lastAlertId.current = payload.new.id;
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to notifications channel (Toast)');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('CHANNEL_ERROR (Toast):', err);
        }
        if (status === 'TIMED_OUT') {
          console.error('TIMED_OUT (Toast)');
        }
        if (status === 'CLOSED') {
          console.log('CLOSED (Toast)');
        }
      });

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClose = () => setAlert(null);

  return (
    <Snackbar
      open={!!alert}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      message={alert?.message}
      action={
        <Button color="secondary" size="small" onClick={() => window.location.href = alert?.link}>
          바로가기
        </Button>
      }
    />
  );
}

export default NotificationToast; 