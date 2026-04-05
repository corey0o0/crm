import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Divider,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { getAppSetting, saveAppSetting } from '../../api/settingsApi';

const AVAILABLE_EVENTS = [
  { key: 'service_add', label: 'A/S 신규 등록' },
  { key: 'service_edit', label: 'A/S 상태 변경 / 수정' },
  { key: 'shipment_add', label: '매장 출고 신규 등록' },
  { key: 'shipment_edit', label: '매장 출고 내역 수정' },
  { key: 'stock_adjust', label: '재고 조정 (단건)' },
  { key: 'stock_bulk_save', label: '재고 일괄 저장' },
  { key: 'part_add', label: '부품 신규 등록 (엑셀 포함)' },
  { key: 'part_edit', label: '부품 정보 수정' },
  { key: 'dashboard_memo', label: '대시보드 거래처 메모 발송' }
];

export default function TelegramSettings() {
  const [settingsMap, setSettingsMap] = useState({}); // { "service_add": true, ... }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await getAppSetting('telegram_settings');
    
    // 기본값은 OFF(false)이므로 DB에 없는 항목도 false로 취급
    const initialSettings = {};
    AVAILABLE_EVENTS.forEach(event => {
      initialSettings[event.key] = data ? !!data[event.key] : false;
    });

    setSettingsMap(initialSettings);
    setLoading(false);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  const handleToggle = (key) => {
    setSettingsMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveAppSetting('telegram_settings', settingsMap);
    setSaving(false);

    if (error) {
      showSnackbar('설정 저장 중 오류가 발생했습니다.', 'error');
    } else {
      showSnackbar('텔레그램 알림 설정이 안전하게 저장되었습니다.', 'success');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">텔레그램 자동 알림 발송 설정</Typography>
        <Button 
          variant="contained" 
          startIcon={<SaveIcon />} 
          onClick={handleSave}
          disabled={loading || saving}
        >
          {saving ? '저장 중...' : '변경사항 저장'}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        CRM 기능 사용 시 텔레그램 연동 봇을 통해 단체 대화방으로 자동 전송될 알림 항목을 선택합니다.<br/>
        스위치를 켬(ON)으로 설정한 항목에 대해서만 실제 알림이 발송됩니다.
      </Typography>

      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 3 }}>
        <Grid container spacing={2}>
          {AVAILABLE_EVENTS.map((event, index) => (
            <React.Fragment key={event.key}>
              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ py: 1, px: 2, bgcolor: settingsMap[event.key] ? 'primary.50' : 'transparent', borderRadius: 1, transition: '0.3s' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settingsMap[event.key] || false}
                        onChange={() => handleToggle(event.key)}
                        color="primary"
                      />
                    }
                    label={<Typography variant="body1" fontWeight={settingsMap[event.key] ? 'bold' : 'normal'}>{event.label}</Typography>}
                  />
                </Box>
              </Grid>
            </React.Fragment>
          ))}
        </Grid>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
