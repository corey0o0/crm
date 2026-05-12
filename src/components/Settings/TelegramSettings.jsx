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
  TextField,
  Chip,
  IconButton,
  Stack
} from '@mui/material';
import { Save as SaveIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { getAppSetting, saveAppSetting } from '../../api/settingsApi';

const AVAILABLE_EVENTS = [
  { key: 'service_add', label: 'A/S 신규 등록' },
  { key: 'service_edit', label: 'A/S 상태 변경 / 수정' },
  { key: 'shipment_add', label: '매장 출고 신규 등록' },
  { key: 'shipment_edit', label: '매장 출고 내역 수정' },
  { key: 'stock_adjust', label: '재고 조정 (단건)' },
  { key: 'stock_bulk_save', label: '재고 일괄 저장' },
  { key: 'stock_low_alert', label: '⚠️ 재고 부족 알림' },
  { key: 'part_add', label: '부품 신규 등록 (엑셀 포함)' },
  { key: 'part_edit', label: '부품 정보 수정' },
  { key: 'dashboard_memo', label: '대시보드 거래처 메모 발송' }
];

export default function TelegramSettings() {
  const [settingsMap, setSettingsMap] = useState({}); // { "service_add": true, ... }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 재고 부족 알림 전용 설정
  const [alertSettings, setAlertSettings] = useState({
    enabled: false,
    thresholds: [10, 5, 0]
  });
  const [newThreshold, setNewThreshold] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);

    // 1) 텔레그램 이벤트 설정
    const { data } = await getAppSetting('telegram_settings');
    const initialSettings = {};
    AVAILABLE_EVENTS.forEach(event => {
      initialSettings[event.key] = data ? !!data[event.key] : false;
    });
    setSettingsMap(initialSettings);

    // 2) 재고 부족 알림 설정
    const { data: alertData } = await getAppSetting('inventory_alert_settings');
    if (alertData) {
      setAlertSettings({
        enabled: alertData.enabled ?? false,
        thresholds: alertData.thresholds ?? [10, 5, 0]
      });
    }

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

  const handleAddThreshold = () => {
    const val = parseInt(newThreshold, 10);
    if (isNaN(val) || val < 0) return;
    if (alertSettings.thresholds.includes(val)) {
      showSnackbar('이미 등록된 임계값입니다.', 'warning');
      return;
    }
    setAlertSettings(prev => ({
      ...prev,
      thresholds: [...prev.thresholds, val].sort((a, b) => b - a)
    }));
    setNewThreshold('');
  };

  const handleRemoveThreshold = (val) => {
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.filter(t => t !== val)
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    // 1) 텔레그램 이벤트 설정 저장
    const { error: err1 } = await saveAppSetting('telegram_settings', settingsMap);

    // 2) 재고 부족 알림 설정 저장
    const { error: err2 } = await saveAppSetting('inventory_alert_settings', alertSettings);

    setSaving(false);

    if (err1 || err2) {
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

      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          {AVAILABLE_EVENTS.map((event) => (
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

      {/* 재고 부족 알림 상세 설정 */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" sx={{ mb: 1 }}>📦 재고 부족 알림 상세 설정</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        창고별 재고가 설정한 임계값 이하로 떨어지면 텔레그램으로 알림을 전송합니다.<br/>
        같은 상품에 대해 동일 임계값 알림은 24시간 내 중복 전송되지 않습니다.
      </Typography>

      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={alertSettings.enabled}
              onChange={() => setAlertSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              color="warning"
            />
          }
          label={
            <Typography variant="body1" fontWeight={alertSettings.enabled ? 'bold' : 'normal'}>
              재고 부족 알림 활성화
            </Typography>
          }
          sx={{ mb: 2 }}
        />

        {alertSettings.enabled && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>알림 임계값 (개)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              재고가 아래 수량 이하가 되면 알림이 발송됩니다. 예: 10, 5, 0
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
              {alertSettings.thresholds.map(t => (
                <Chip
                  key={t}
                  label={`${t}개 이하`}
                  color={t === 0 ? 'error' : t <= 5 ? 'warning' : 'default'}
                  variant="outlined"
                  onDelete={() => handleRemoveThreshold(t)}
                  sx={{ fontWeight: 'bold' }}
                />
              ))}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                type="number"
                placeholder="임계값 추가"
                value={newThreshold}
                onChange={e => setNewThreshold(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddThreshold(); }}
                sx={{ width: 140 }}
                inputProps={{ min: 0 }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddThreshold}
                disabled={!newThreshold}
              >
                추가
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
