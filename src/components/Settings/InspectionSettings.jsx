import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Switch, 
  FormControlLabel, 
  Snackbar, 
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { getAppSetting, saveAppSetting } from '../../api/settingsApi';

export default function InspectionSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    as_enabled: false,
    shipment_enabled: false
  });
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await getAppSetting('inspection_settings');
      if (error) throw error;
      
      if (data) {
        setSettings({
          as_enabled: !!data.as_enabled,
          shipment_enabled: !!data.shipment_enabled
        });
      }
    } catch (err) {
      console.error('설정 조회 오류:', err);
      setSnackbar({
        open: true,
        message: '설정을 불러오는 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };
    
    // UI 즉시 업데이트 (Optimistic UI)
    setSettings(newSettings);
    
    try {
      setSaving(true);
      const { error } = await saveAppSetting('inspection_settings', newSettings);
      if (error) throw error;
      
      setSnackbar({
        open: true,
        message: '설정이 저장되었습니다. 현재 작업 중인 창은 새로고침 해야 반영됩니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('설정 저장 오류:', err);
      // 롤백
      setSettings(settings);
      setSnackbar({
        open: true,
        message: '설정 저장 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        검수 과정 (Inspection Process) 전역 관리
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        각 메뉴의 상세 화면에서 부품준비(검수과정) 단계를 사용할지 여부를 설정합니다.
        해당 설정이 켜지면 일반 권한 사용자는 출고완료/준비완료 처리를 위해 반드시 '검수 프로세스'를 거쳐야 합니다.
      </Typography>
      
      <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              A/S 관리 검수 설정
            </Typography>
            <FormControlLabel
              control={
                <Switch 
                  checked={settings.as_enabled} 
                  onChange={() => handleToggle('as_enabled')}
                  disabled={saving}
                  color="primary"
                />
              }
              label={settings.as_enabled ? "A/S 검수 과정 사용 중" : "A/S 검수 과정 미사용"}
            />
          </Box>
          
          <Divider />
          
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              입출고 관리 검수 설정
            </Typography>
            <FormControlLabel
              control={
                <Switch 
                  checked={settings.shipment_enabled} 
                  onChange={() => handleToggle('shipment_enabled')}
                  disabled={saving}
                  color="secondary"
                />
              }
              label={settings.shipment_enabled ? "입출고 검수 과정 사용 중" : "입출고 검수 과정 미사용"}
            />
          </Box>
        </Box>
      </Paper>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
