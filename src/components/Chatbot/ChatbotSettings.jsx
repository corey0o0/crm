import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Switch, FormControlLabel, TextField, Button,
  Grid, Snackbar, Alert, CircularProgress, Divider, Chip, Stack
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';

const BRANDS = [
  { key: 'NB', name: '니어바이크' },
  { key: 'XRB', name: 'X-RIDER' },
];
const DAYS = [
  { v: 0, label: '일' }, { v: 1, label: '월' }, { v: 2, label: '화' }, { v: 3, label: '수' },
  { v: 4, label: '목' }, { v: 5, label: '금' }, { v: 6, label: '토' },
];

export default function ChatbotSettings() {
  const [rows, setRows] = useState({}); // { NB: {...}, XRB: {...} }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('chatbot_settings').select('*');
    const map = {};
    (data || []).forEach(r => { map[r.brand] = r; });
    // 누락 브랜드 기본값 채움
    BRANDS.forEach(b => {
      if (!map[b.key]) map[b.key] = {
        brand: b.key, enabled: true, hours_start: '09:00', hours_end: '18:00',
        days: [1, 2, 3, 4, 5],
        offhours_message: '지금은 상담 운영시간이 아닙니다. A/S 접수를 남겨주시면 영업시간에 순차적으로 연락드리겠습니다.',
        offhours_image_url: '',
      };
    });
    setRows(map);
    setLoading(false);
  };

  const showSnack = (message, severity = 'success') => setSnackbar({ open: true, message, severity });
  const patch = (brand, key, value) => setRows(prev => ({ ...prev, [brand]: { ...prev[brand], [key]: value } }));
  const toggleDay = (brand, v) => {
    const cur = rows[brand].days || [];
    patch(brand, 'days', cur.includes(v) ? cur.filter(d => d !== v) : [...cur, v].sort((a, b) => a - b));
  };

  const save = async (brand) => {
    setSaving(brand);
    const r = rows[brand];
    const payload = {
      brand,
      enabled: !!r.enabled,
      hours_start: r.hours_start || '09:00',
      hours_end: r.hours_end || '18:00',
      days: r.days || [],
      offhours_message: r.offhours_message || '',
      offhours_image_url: r.offhours_image_url || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('chatbot_settings').upsert(payload, { onConflict: 'brand' });
    setSaving('');
    if (error) showSnack('저장 실패: ' + error.message, 'error');
    else showSnack(`${BRANDS.find(b => b.key === brand)?.name} 챗봇 설정이 저장되었습니다.`);
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        네이버 톡톡·웹 위젯 챗봇의 운영 ON/OFF와 상담 운영시간을 브랜드별로 설정합니다.<br />
        운영시간 외에도 봇은 FAQ·AI 답변을 계속하되, 아래 안내 메시지를 함께 전달합니다. (OFF 시에는 안내 메시지만 전송)
      </Typography>

      <Grid container spacing={2}>
        {BRANDS.map(b => {
          const r = rows[b.key] || {};
          return (
            <Grid item xs={12} md={6} key={b.key}>
              <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6">{b.name} <Typography component="span" variant="caption" color="text.secondary">({b.key})</Typography></Typography>
                  <FormControlLabel
                    control={<Switch checked={!!r.enabled} onChange={e => patch(b.key, 'enabled', e.target.checked)} color="primary" />}
                    label={<Typography fontWeight="bold" color={r.enabled ? 'primary.main' : 'text.disabled'}>{r.enabled ? 'ON' : 'OFF'}</Typography>}
                    labelPlacement="start"
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>운영 시간</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <TextField type="time" size="small" label="시작" value={r.hours_start || '09:00'}
                    onChange={e => patch(b.key, 'hours_start', e.target.value)} InputLabelProps={{ shrink: true }} />
                  <Typography>~</Typography>
                  <TextField type="time" size="small" label="종료" value={r.hours_end || '18:00'}
                    onChange={e => patch(b.key, 'hours_end', e.target.value)} InputLabelProps={{ shrink: true }} />
                </Stack>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>운영 요일</Typography>
                <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
                  {DAYS.map(d => (
                    <Chip key={d.v} label={d.label} size="small"
                      color={(r.days || []).includes(d.v) ? 'primary' : 'default'}
                      variant={(r.days || []).includes(d.v) ? 'filled' : 'outlined'}
                      onClick={() => toggleDay(b.key, d.v)} sx={{ width: 36, cursor: 'pointer' }} />
                  ))}
                </Stack>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>운영시간 외 안내 메시지</Typography>
                <TextField multiline minRows={2} fullWidth size="small" value={r.offhours_message || ''}
                  onChange={e => patch(b.key, 'offhours_message', e.target.value)} sx={{ mb: 1.5 }} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>안내 이미지 URL <Typography component="span" variant="caption" color="text.secondary">(선택, https://)</Typography></Typography>
                <TextField fullWidth size="small" placeholder="https://..." value={r.offhours_image_url || ''}
                  onChange={e => patch(b.key, 'offhours_image_url', e.target.value)} sx={{ mb: 2 }} />

                <Button variant="contained" startIcon={<SaveIcon />} onClick={() => save(b.key)}
                  disabled={saving === b.key} fullWidth>
                  {saving === b.key ? '저장 중...' : `${b.name} 설정 저장`}
                </Button>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
