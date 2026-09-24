import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress, Checkbox,
  TablePagination, Avatar, IconButton, Button, Dialog, DialogContent, FormControlLabel,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { supabase, queryWithTimeout } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';

// 왼쪽 고정(스티키) 컬럼 폭. 헤더/바디 offset 계산에 재사용.
const STICKY_WIDTHS = { image: 48, brand: 70, code: 70, barcode: 90, name: 160 };
const STICKY_LEFT = {
  image: 0,
  brand: STICKY_WIDTHS.image,
  code: STICKY_WIDTHS.image + STICKY_WIDTHS.brand,
  barcode: STICKY_WIDTHS.image + STICKY_WIDTHS.brand + STICKY_WIDTHS.code,
  name: STICKY_WIDTHS.image + STICKY_WIDTHS.brand + STICKY_WIDTHS.code + STICKY_WIDTHS.barcode,
};
const STICKY_TOTAL = STICKY_LEFT.name + STICKY_WIDTHS.name;

function PurchaseOrderManagement() {
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [visibleCols, setVisibleCols] = useState({ supply_price: true, price: true, note: true });
  const [receivedFilter, setReceivedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('brand');
  const [sortDir, setSortDir] = useState('asc');

  const [dateColumns, setDateColumns] = useState([]);
  const [newDate, setNewDate] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [pendingQuantities, setPendingQuantities] = useState({});

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
      showSnackbar('저장되었습니다.', 'success');
    } catch (err) {
      setOrdersMap((m) => new Map(m).set(key, prev));
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleQuantityChange = (partId, dateStr, rawValue) => {
    const key = `${partId}_${dateStr}`;
    setPendingQuantities((prev) => ({ ...prev, [key]: { partId, dateStr, rawValue } }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingQuantities);
    const rows = [];
    const commits = [];
    entries.forEach(([key, { partId, dateStr, rawValue }]) => {
      const prevCell = ordersMap.get(key) || { quantity: 0, received: false, received_at: null };
      const parsed = parseInt(rawValue, 10);
      const quantity = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
      if (quantity === prevCell.quantity) return;
      rows.push({
        part_id: partId,
        order_date: dateStr,
        quantity,
        received: prevCell.received,
        received_at: prevCell.received_at,
      });
      commits.push({ key, quantity });
    });

    if (rows.length === 0) {
      setPendingQuantities({});
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .upsert(rows, { onConflict: 'part_id,order_date' });
      if (error) throw error;
      setOrdersMap((m) => {
        const next = new Map(m);
        commits.forEach(({ key, quantity }) => {
          const prevCell = next.get(key) || { quantity: 0, received: false, received_at: null };
          next.set(key, { ...prevCell, quantity });
        });
        return next;
      });
      setPendingQuantities({});
      showSnackbar(`${rows.length}건 저장되었습니다.`, 'success');
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleReceivedChange = (partId, dateStr, checked) => {
    upsertOrder(partId, dateStr, {
      received: checked,
      received_at: checked ? new Date().toISOString() : null,
    });
  };

  // 표시중인 날짜 열 기준 입고 상태: 미입고 주문 하나라도 있으면 미입고, 주문 있고 전부 입고면 입고완료
  const getReceivedStatus = (partId) => {
    let hasOrder = false;
    let hasUnreceived = false;
    dateColumns.forEach((dateStr) => {
      const cell = ordersMap.get(`${partId}_${dateStr}`);
      if (cell && cell.quantity > 0) {
        hasOrder = true;
        if (!cell.received) hasUnreceived = true;
      }
    });
    if (!hasOrder) return 'none';
    return hasUnreceived ? 'unreceived' : 'received';
  };

  const filteredParts = parts.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesTerm = !term || (
      (p.name || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
    if (!matchesTerm) return false;
    if (receivedFilter === 'all') return true;
    return getReceivedStatus(p.id) === receivedFilter;
  });

  const sortedParts = [...filteredParts].sort((a, b) => {
    const av = (a[sortBy] || '').toString();
    const bv = (b[sortBy] || '').toString();
    const cmp = av.localeCompare(bv, 'ko');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const pagedParts = sortedParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const tableMinWidth = STICKY_TOTAL + 360 + dateColumns.length * 90;

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>발주 관리</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
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
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleSaveAll}
          disabled={Object.keys(pendingQuantities).length === 0}
        >
          전체 저장{Object.keys(pendingQuantities).length > 0 && ` (${Object.keys(pendingQuantities).length})`}
        </Button>
        {loadingOrders && <CircularProgress size={20} />}

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>입고여부</InputLabel>
          <Select
            label="입고여부"
            value={receivedFilter}
            onChange={(e) => { setReceivedFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="unreceived">미입고</MenuItem>
            <MenuItem value="received">입고완료</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>정렬</InputLabel>
          <Select
            label="정렬"
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(0); }}
          >
            <MenuItem value="brand">브랜드순</MenuItem>
            <MenuItem value="code">코드순</MenuItem>
            <MenuItem value="name">제품명순</MenuItem>
          </Select>
        </FormControl>
        <IconButton size="small" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          {sortDir === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">컬럼 표시:</Typography>
        <FormControlLabel
          control={<Checkbox size="small" checked={visibleCols.supply_price} onChange={(e) => setVisibleCols((c) => ({ ...c, supply_price: e.target.checked }))} />}
          label="공급가"
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={visibleCols.price} onChange={(e) => setVisibleCols((c) => ({ ...c, price: e.target.checked }))} />}
          label="판매가"
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={visibleCols.note} onChange={(e) => setVisibleCols((c) => ({ ...c, note: e.target.checked }))} />}
          label="구분"
        />
      </Box>

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <Paper>
        <TableContainer sx={{ maxHeight: '75vh', overflow: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: tableMinWidth }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.image, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.image, minWidth: STICKY_WIDTHS.image }}>이미지</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.brand, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.brand, minWidth: STICKY_WIDTHS.brand }}>브랜드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.code, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.code, minWidth: STICKY_WIDTHS.code }}>코드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.barcode, minWidth: STICKY_WIDTHS.barcode }}>바코드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.name, minWidth: STICKY_WIDTHS.name }}>제품명</TableCell>
                {visibleCols.supply_price && <TableCell align="right">공급가</TableCell>}
                {visibleCols.price && <TableCell align="right">판매가</TableCell>}
                {visibleCols.note && <TableCell>구분</TableCell>}
                <TableCell>적요</TableCell>
                {dateColumns.map((dateStr) => (
                  <TableCell key={dateStr} align="center" sx={{ minWidth: 100 }}>
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
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.image, zIndex: 2, bgcolor: 'background.paper' }}>
                    <Avatar
                      src={p.image_url}
                      alt={p.name}
                      variant="rounded"
                      sx={{ width: 32, height: 32, cursor: p.image_url ? 'pointer' : 'default' }}
                      onClick={() => p.image_url && setEnlargedImage(p.image_url)}
                    />
                  </TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.brand, zIndex: 2, bgcolor: 'background.paper' }}>{p.brand}</TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.code, zIndex: 2, bgcolor: 'background.paper' }}>{p.code}</TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 2, bgcolor: 'background.paper' }}>{p.barcode || '-'}</TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.name}
                    {p.name_en && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {p.name_en}
                      </Typography>
                    )}
                  </TableCell>
                  {visibleCols.supply_price && <TableCell align="right">{p.supply_price?.toLocaleString() || '-'}</TableCell>}
                  {visibleCols.price && <TableCell align="right">{p.price?.toLocaleString() || '-'}</TableCell>}
                  {visibleCols.note && <TableCell>{p.note || '-'}</TableCell>}
                  <TableCell>{p.memo || '-'}</TableCell>
                  {dateColumns.map((dateStr) => {
                    const key = `${p.id}_${dateStr}`;
                    const cell = ordersMap.get(key) || { quantity: 0, received: false };
                    const displayValue = pendingQuantities[key]
                      ? pendingQuantities[key].rawValue
                      : (cell.quantity || '');
                    return (
                      <TableCell key={dateStr} align="center" sx={{ p: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TextField
                            type="number"
                            size="small"
                            value={displayValue}
                            onChange={(e) => handleQuantityChange(p.id, dateStr, e.target.value)}
                            inputProps={{ min: 0, style: { width: 44, textAlign: 'center' } }}
                            sx={pendingQuantities[key] ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.light' } } : undefined}
                          />
                        </Box>
                        <Button
                          size="small"
                          variant={cell.received ? 'contained' : 'outlined'}
                          color={cell.received ? 'success' : 'inherit'}
                          onClick={() => handleReceivedChange(p.id, dateStr, !cell.received)}
                          sx={{ minWidth: 0, height: 20, fontSize: 10, px: cell.received ? 0.75 : 1.5, lineHeight: 1, mt: 0.25 }}
                        >
                          {cell.received ? '입고완료' : ''}
                        </Button>
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
          count={sortedParts.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100]}
        />
        </Paper>
      )}

      <Dialog open={!!enlargedImage} onClose={() => setEnlargedImage(null)} maxWidth="md">
        <DialogContent sx={{ p: 1, position: 'relative', bgcolor: 'transparent', textAlign: 'center' }}>
          <IconButton
            onClick={() => setEnlargedImage(null)}
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            <CloseIcon />
          </IconButton>
          <img src={enlargedImage} alt="Enlarged" style={{ maxWidth: '100%', height: 'auto', display: 'block', maxHeight: '80vh', objectFit: 'contain', margin: '0 auto' }} />
        </DialogContent>
      </Dialog>

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
