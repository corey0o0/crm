import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Snackbar,
  Alert,
  InputAdornment
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { getAppSetting, saveAppSetting } from '../../api/settingsApi';

const RATE_FIELDS = [
  { key: 'toss', label: '토스페이 수수료 (온라인)' },
  { key: 'naver', label: '네이버페이 수수료 (온라인)' },
  { key: 'other', label: '기타 결제수단 수수료 (온라인)' },
  { key: 'offline', label: '매장 판매 수수료 (오프라인, 단일 요율)' },
  { key: 'ricycle', label: '라이클 일반 수수료' },
  { key: 'ricycle_rental', label: '라이클 렌탈 수수료' },
  { key: 'toss_installment', label: '토스페이 수수료 (스마트 할부)' }
];

const DEFAULT_RATES = { toss: 0, naver: 0, other: 0, offline: 0, ricycle: 0, ricycle_rental: 0, toss_installment: 0 };

export default function CommissionSettings() {
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await getAppSetting('payment_commission_rates');
    if (data) {
      setRates({ ...DEFAULT_RATES, ...data });
    }
    setLoading(false);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  const handleChange = (key, value) => {
    setRates(prev => ({ ...prev, [key]: value === '' ? '' : Number(value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const normalized = Object.fromEntries(
      Object.entries(rates).map(([k, v]) => [k, Number(v) || 0])
    );
    const { error } = await saveAppSetting('payment_commission_rates', normalized);
    setSaving(false);

    if (error) {
      showSnackbar('설정 저장 중 오류가 발생했습니다.', 'error');
    } else {
      setRates(normalized);
      showSnackbar('수수료 설정이 저장되었습니다.', 'success');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">판매 수수료 설정</Typography>
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
        판매 통계 화면에서 매출 순수익(수수료 차감) 계산에 사용되는 요율입니다.<br/>
        매장 판매는 결제수단 구분 없이 단일 요율이 전체 매장 매출에 적용됩니다.
      </Typography>

      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 3 }}>
        <Grid container spacing={3}>
          {RATE_FIELDS.map(field => (
            <Grid item xs={12} sm={6} key={field.key}>
              <TextField
                fullWidth
                label={field.label}
                type="number"
                value={rates[field.key]}
                onChange={e => handleChange(field.key, e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
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
