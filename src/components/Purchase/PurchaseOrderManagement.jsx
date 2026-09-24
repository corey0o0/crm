import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress, Checkbox,
  TablePagination, Avatar, IconButton, Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { supabase, queryWithTimeout } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';

function PurchaseOrderManagement() {
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [dateColumns, setDateColumns] = useState([]);
  const [newDate, setNewDate] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersMap, setOrdersMap] = useState(new Map());

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchParts = useCallback(async () => {
    setLoadingParts(true);
    try {
      if (isOffline()) {
        showSnackbar('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return;
      }
      const { data, error } = await safeRetry(() =>
        queryWithTimeout(
          supabase
            .from('parts')
            .select('id, name, name_en, brand, code, barcode, image_url, supply_price, price, note, memo')
            .order('brand')
            .order('name'),
          8000
        )
      );
      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingParts(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const fetchOrdersForDate = async (dateStr) => {
    setLoadingOrders(true);
    try {
      if (isOffline()) {
        showSnackbar('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return;
      }
      const { data, error } = await safeRetry(() =>
        queryWithTimeout(
          supabase
            .from('purchase_orders')
            .select('part_id, quantity, received, received_at')
            .eq('order_date', dateStr),
          8000
        )
      );
      if (error) throw error;
      setOrdersMap((m) => {
        const next = new Map(m);
        (data || []).forEach((row) => {
          next.set(`${row.part_id}_${dateStr}`, {
            quantity: row.quantity,
            received: row.received,
            received_at: row.received_at,
          });
        });
        return next;
      });
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleAddDateColumn = () => {
    if (!newDate) return;
    const dateStr = format(newDate, 'yyyy-MM-dd');
    if (dateColumns.includes(dateStr)) {
      showSnackbar('이미 추가된 날짜입니다.', 'warning');
      return;
    }
    setDateColumns((prev) => [...prev, dateStr].sort());
    setNewDate(null);
    fetchOrdersForDate(dateStr);
  };

  const handleRemoveDateColumn = (dateStr) => {
    setDateColumns((prev) => prev.filter((d) => d !== dateStr));
  };

  const upsertOrder = async (partId, dateStr, patch) => {
    const key = `${partId}_${dateStr}`;
    const prev = ordersMap.get(key) || { quantity: 0, received: false, received_at: null };
    const next = { ...prev, ...patch };

    setOrdersMap((m) => new Map(m).set(key, next));

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .upsert(
          { part_id: partId, order_date: dateStr, quantity: next.quantity, received: next.received, received_at: next.received_at },
          { onConflict: 'part_id,order_date' }
        );
      if (error) throw error;
    } catch (err) {
      setOrdersMap((m) => new Map(m).set(key, prev));
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleQuantityBlur = (partId, dateStr, rawValue) => {
    const parsed = parseInt(rawValue, 10);
    const quantity = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const prev = ordersMap.get(`${partId}_${dateStr}`) || { quantity: 0, received: false };
    if (prev.quantity === quantity) return;
    upsertOrder(partId, dateStr, { quantity });
  };

  const handleReceivedChange = (partId, dateStr, checked) => {
    upsertOrder(partId, dateStr, {
      received: checked,
      received_at: checked ? new Date().toISOString() : null,
    });
  };

  const filteredParts = parts.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
  });

  const pagedParts = filteredParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>발주 관리</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="브랜드/코드/이름 검색"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          sx={{ width: 300 }}
        />

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
          <DatePicker
            label="날짜 추가"
            value={newDate}
            onChange={(v) => setNewDate(v)}
            slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
          />
        </LocalizationProvider>
        <Button variant="contained" size="small" onClick={handleAddDateColumn} disabled={!newDate}>
          열 추가
        </Button>
        {loadingOrders && <CircularProgress size={20} />}
      </Box>

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <Paper>
        <TableContainer sx={{ maxHeight: '75vh', overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>이미지</TableCell>
                <TableCell>브랜드</TableCell>
                <TableCell>코드</TableCell>
                <TableCell>바코드</TableCell>
                <TableCell>제품명</TableCell>
                <TableCell align="right">공급가</TableCell>
                <TableCell align="right">판매가</TableCell>
                <TableCell>구분</TableCell>
                <TableCell>적요</TableCell>
                {dateColumns.map((dateStr) => (
                  <TableCell key={dateStr} align="center" sx={{ minWidth: 90 }}>
                    {format(parseISO(dateStr), 'MM/dd')}
                    <IconButton size="small" onClick={() => handleRemoveDateColumn(dateStr)} sx={{ p: 0, ml: 0.5 }}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Avatar src={p.image_url} alt={p.name} variant="rounded" sx={{ width: 32, height: 32 }} />
                  </TableCell>
                  <TableCell>{p.brand}</TableCell>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>{p.barcode || '-'}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell align="right">{p.supply_price?.toLocaleString() || '-'}</TableCell>
                  <TableCell align="right">{p.price?.toLocaleString() || '-'}</TableCell>
                  <TableCell>{p.note || '-'}</TableCell>
                  <TableCell>{p.memo || '-'}</TableCell>
                  {dateColumns.map((dateStr) => {
                    const cell = ordersMap.get(`${p.id}_${dateStr}`) || { quantity: 0, received: false };
                    return (
                      <TableCell key={dateStr} align="center" sx={{ p: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          defaultValue={cell.quantity || ''}
                          key={`${p.id}_${dateStr}_${cell.quantity}`}
                          onBlur={(e) => handleQuantityBlur(p.id, dateStr, e.target.value)}
                          inputProps={{ min: 0, style: { width: 50, textAlign: 'center' } }}
                        />
                        <Checkbox
                          size="small"
                          checked={!!cell.received}
                          onChange={(e) => handleReceivedChange(p.id, dateStr, e.target.checked)}
                          sx={{ p: 0 }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredParts.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100]}
        />
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PurchaseOrderManagement;
