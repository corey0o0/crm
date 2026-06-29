import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Grid, Stack, Typography, Chip, Button, IconButton, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField, MenuItem,
  TablePagination, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../../lib/supabaseClient';

// DB 트리거 기반 변경 로그(db_change_log) 조회 — 앱/서버/스크립트/SQL 어떤 경로든 잡힌 원천 변경 이력
const TABLE_LABELS = { cafe24_orders: '온라인주문', inventory: '재고' };
const OP_META = {
  INSERT: { label: '등록', color: 'success' },
  UPDATE: { label: '수정', color: 'warning' },
  DELETE: { label: '삭제', color: 'error' },
};

// cafe24_orders는 핵심필드, inventory는 수량 위주로 변경 요약
const KEY_FIELDS = {
  cafe24_orders: ['status', 'is_transferred', 'is_deleted', 'order_items'],
  inventory: ['quantity', 'warehouse_id', 'product_id'],
};

function summarizeChange(row) {
  const keys = KEY_FIELDS[row.table_name] || [];
  if (row.op === 'INSERT') return '신규 생성';
  if (row.op === 'DELETE') return '삭제됨';
  const old = row.old_data || {};
  const neu = row.new_data || {};
  const diffs = [];
  for (const k of keys) {
    const ov = JSON.stringify(old[k]);
    const nv = JSON.stringify(neu[k]);
    if (ov !== nv) {
      const short = (v) => (v && v.length > 30 ? v.slice(0, 30) + '…' : v);
      diffs.push(`${k}: ${short(ov)} → ${short(nv)}`);
    }
  }
  return diffs.length ? diffs.join(', ') : '(변경 없음)';
}

export default function DbChangeLogViewer() {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [tableFilter, setTableFilter] = useState('');
  const [opFilter, setOpFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('db_change_log').select('*', { count: 'exact' });
      if (tableFilter) q = q.eq('table_name', tableFilter);
      if (opFilter) q = q.eq('op', opFilter);
      if (startDate) q = q.gte('changed_at', startDate + 'T00:00:00+09:00');
      if (endDate) q = q.lte('changed_at', endDate + 'T23:59:59+09:00');
      if (search.trim()) q = q.ilike('row_pk', `%${search.trim()}%`);
      q = q.order('changed_at', { ascending: false }).range(page * rowsPerPage, page * rowsPerPage + rowsPerPage - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      setRows(data || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.warn('[DbChangeLog] 조회 실패:', e.message);
      setRows([]); setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [tableFilter, opFilter, startDate, endDate, search, page, rowsPerPage]);

  useEffect(() => { load(); }, [page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(0); load(); };
  const handleReset = () => {
    setTableFilter(''); setOpFilter(''); setSearch(''); setPage(0);
  };

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        DB 원천 변경 이력 — 앱·서버·스크립트·SQL 어떤 경로의 변경도 자동 기록됩니다. (현재 대상: 온라인주문 · 재고)
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={6} sm={3} md={2}>
            <TextField size="small" fullWidth type="date" label="시작일" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField size="small" fullWidth type="date" label="종료일" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField select size="small" fullWidth label="대상" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
              <MenuItem value="">전체</MenuItem>
              {Object.entries(TABLE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField select size="small" fullWidth label="작업" value={opFilter} onChange={(e) => setOpFilter(e.target.value)}>
              <MenuItem value="">전체</MenuItem>
              {Object.entries(OP_META).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <TextField size="small" fullWidth placeholder="대상 ID/PK 검색" value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleSearch} startIcon={<SearchIcon />}>조회</Button>
              <Button variant="outlined" size="small" onClick={handleReset}>초기화</Button>
              <IconButton size="small" onClick={load} color="primary"><RefreshIcon /></IconButton>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={28} /></Box>}
        <Table size="small" sx={{ border: '1px solid rgba(224,224,224,1)', '& th, & td': { border: '1px solid rgba(224,224,224,1)' }, '& .MuiTableCell-root': { fontSize: '0.85rem', padding: '6px 10px' } }}>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell width={150}>시간</TableCell>
              <TableCell width={90} align="center">대상</TableCell>
              <TableCell width={70} align="center">작업</TableCell>
              <TableCell width={120}>대상 ID</TableCell>
              <TableCell>변경 내용</TableCell>
              <TableCell width={140}>수행자</TableCell>
              <TableCell width={50} align="center">상세</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>변경 이력이 없습니다.</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const op = OP_META[r.op] || { label: r.op, color: 'default' };
              return (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmt(r.changed_at)}</TableCell>
                  <TableCell align="center">{TABLE_LABELS[r.table_name] || r.table_name}</TableCell>
                  <TableCell align="center"><Chip size="small" label={op.label} color={op.color} variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{r.row_pk || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{summarizeChange(r)}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem' }}>{r.db_user || '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => setDetail(r)}><SearchIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[20, 50, 100]}
          labelRowsPerPage="페이지당"
        />
      </TableContainer>

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          DB 변경 상세
          <IconButton size="small" onClick={() => setDetail(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">시간</Typography><Typography variant="body2" fontWeight="bold">{fmt(detail.changed_at)}</Typography></Grid>
                <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">대상</Typography><Typography variant="body2" fontWeight="bold">{TABLE_LABELS[detail.table_name] || detail.table_name}</Typography></Grid>
                <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">작업</Typography><Typography variant="body2" fontWeight="bold">{(OP_META[detail.op] || {}).label || detail.op}</Typography></Grid>
                <Grid item xs={6} sm={3}><Typography variant="caption" color="text.secondary">수행자</Typography><Typography variant="body2" fontWeight="bold">{detail.db_user || '-'}</Typography></Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>변경 전 (old)</Typography>
                  <Box component="pre" sx={{ bgcolor: '#fff5f5', p: 1.5, borderRadius: 1, fontSize: '0.72rem', overflow: 'auto', maxHeight: 360, m: 0 }}>
                    {detail.old_data ? JSON.stringify(detail.old_data, null, 2) : '-'}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>변경 후 (new)</Typography>
                  <Box component="pre" sx={{ bgcolor: '#f0fff4', p: 1.5, borderRadius: 1, fontSize: '0.72rem', overflow: 'auto', maxHeight: 360, m: 0 }}>
                    {detail.new_data ? JSON.stringify(detail.new_data, null, 2) : '-'}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
