import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { startOfMonth, getDaysInMonth, format } from 'date-fns';

function PurchaseOrderManagement() {
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));

  const getDaysArray = (monthStart) => {
    const total = getDaysInMonth(monthStart);
    return Array.from({ length: total }, (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
  };

  const days = getDaysArray(selectedMonth);

  const [ordersMap, setOrdersMap] = useState(new Map());
  const [loadingOrders, setLoadingOrders] = useState(true);

  const orderKey = (partId, dateObj) => `${partId}_${format(dateObj, 'yyyy-MM-dd')}`;

  const fetchOrders = useCallback(async (monthStart) => {
    setLoadingOrders(true);
    try {
      if (isOffline()) {
        showSnackbar('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return;
      }
      const rangeStart = format(monthStart, 'yyyy-MM-dd');
      const rangeEnd = format(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0), 'yyyy-MM-dd');
      const { data, error } = await safeRetry(() =>
        supabase
          .from('purchase_orders')
          .select('part_id, order_date, quantity, received, received_at')
          .gte('order_date', rangeStart)
          .lte('order_date', rangeEnd)
      );
      if (error) throw error;
      const map = new Map();
      (data || []).forEach((row) => {
        map.set(`${row.part_id}_${row.order_date}`, {
          quantity: row.quantity,
          received: row.received,
          received_at: row.received_at,
        });
      });
      setOrdersMap(map);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(selectedMonth);
  }, [selectedMonth, fetchOrders]);

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
        supabase.from('parts').select('id, name, brand, code, track_inventory').order('brand').order('name')
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

  const filteredParts = parts.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
  });

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>발주 관리</Typography>

      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
        <DatePicker
          views={['year', 'month']}
          label="년/월"
          value={selectedMonth}
          onChange={(newValue) => newValue && setSelectedMonth(startOfMonth(newValue))}
          slotProps={{ textField: { size: 'small', sx: { width: 160, mb: 2 } } }}
        />
      </LocalizationProvider>

      <TextField
        size="small"
        placeholder="브랜드/코드/이름 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, ml: 2, width: 300 }}
      />

      {(loadingParts || loadingOrders) ? (
        <CircularProgress size={24} />
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: '75vh', overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper', minWidth: 200 }}>
                  상품명
                </TableCell>
                {days.map((d) => (
                  <TableCell key={d.toISOString()} align="center" sx={{ minWidth: 90 }}>
                    {format(d, 'd')}일
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.brand} / {p.name}
                  </TableCell>
                  {days.map((d) => {
                    const cell = ordersMap.get(orderKey(p.id, d)) || { quantity: 0, received: false };
                    return (
                      <TableCell key={d.toISOString()} align="center">
                        {cell.quantity || ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
