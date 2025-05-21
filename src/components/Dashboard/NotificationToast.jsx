import { useEffect, useState, useRef } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';
import supabase from '../../supabaseClient';

function NotificationToast() {
  const [alert, setAlert] = useState(null);
  const lastAlertId = useRef(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0 && data[0].id !== lastAlertId.current) {
        setAlert(data[0]);
        lastAlertId.current = data[0].id;
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000); // 5분마다
    return () => clearInterval(interval);
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