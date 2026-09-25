import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress, Checkbox,
  TablePagination, Avatar, IconButton, Button, Dialog, DialogContent, FormControlLabel,
  Select, MenuItem, FormControl, InputLabel, Badge, Tooltip, Popover,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import ExcelJS from 'exceljs';
import { supabase, queryWithTimeout } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';

// 왼쪽 고정(스티키) 컬럼 폭. 헤더/바디 offset 계산에 재사용.
const STICKY_WIDTHS = { image: 48, brand: 70, barcode: 90, name: 160 };
const STICKY_LEFT = {
  image: 0,
  brand: STICKY_WIDTHS.image,
  barcode: STICKY_WIDTHS.image + STICKY_WIDTHS.brand,
  name: STICKY_WIDTHS.image + STICKY_WIDTHS.brand + STICKY_WIDTHS.barcode,
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
  const [noteFilter, setNoteFilter] = useState('all');
  const [sortBy, setSortBy] = useState('brand');
  const [sortDir, setSortDir] = useState('asc');

  const [dateColumns, setDateColumns] = useState([]);
  const [newDate, setNewDate] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [pendingQuantities, setPendingQuantities] = useState({});
  const [memoAnchor, setMemoAnchor] = useState(null);
  const [memoDraft, setMemoDraft] = useState({ key: null, partId: null, dateStr: null, text: '' });
  const [excelDownloading, setExcelDownloading] = useState(false);

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
            .select('part_id, quantity, received_quantity, received, received_at, memo')
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
            received_quantity: row.received_quantity || 0,
            received: row.received,
            received_at: row.received_at,
            memo: row.memo || '',
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
    setDateColumns((prev) => [dateStr, ...prev]);
    setNewDate(null);
    fetchOrdersForDate(dateStr);
  };

  const handleRemoveDateColumn = (dateStr) => {
    setDateColumns((prev) => prev.filter((d) => d !== dateStr));
  };

  const parseQty = (raw) => {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  const handleOrderQtyChange = (partId, dateStr, rawValue) => {
    const key = `${partId}_${dateStr}`;
    setPendingQuantities((prev) => ({ ...prev, [key]: { ...prev[key], partId, dateStr, orderRaw: rawValue } }));
  };

  const handleReceivedQtyChange = (partId, dateStr, rawValue) => {
    const key = `${partId}_${dateStr}`;
    setPendingQuantities((prev) => ({ ...prev, [key]: { ...prev[key], partId, dateStr, receivedRaw: rawValue } }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingQuantities);
    const rows = [];
    const commits = [];
    entries.forEach(([key, { partId, dateStr, orderRaw, receivedRaw }]) => {
      const prevCell = ordersMap.get(key) || { quantity: 0, received_quantity: 0, received: false, received_at: null };
      const quantity = orderRaw !== undefined ? parseQty(orderRaw) : prevCell.quantity;
      const received_quantity = receivedRaw !== undefined ? parseQty(receivedRaw) : prevCell.received_quantity;
      if (quantity === prevCell.quantity && received_quantity === prevCell.received_quantity) return;

      const received = quantity > 0 && received_quantity >= quantity;
      const received_at = received ? (prevCell.received_at || new Date().toISOString()) : null;

      rows.push({ part_id: partId, order_date: dateStr, quantity, received_quantity, received, received_at });
      commits.push({ key, quantity, received_quantity, received, received_at });
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
        commits.forEach(({ key, ...patch }) => {
          const prevCell = next.get(key) || { quantity: 0, received_quantity: 0, received: false, received_at: null };
          next.set(key, { ...prevCell, ...patch });
        });
        return next;
      });
      setPendingQuantities({});
      showSnackbar(`${rows.length}건 저장되었습니다.`, 'success');
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleExcelDownload = async () => {
    setExcelDownloading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('발주현황');

      const headers = ['이미지', '브랜드', '코드', '바코드', '제품명'];
      if (visibleCols.supply_price) headers.push('공급가');
      if (visibleCols.price) headers.push('판매가');
      if (visibleCols.note) headers.push('구분');
      headers.push('적요');
      dateColumns.forEach((d) => headers.push(`${d} 발주`, `${d} 입고`, `${d} 상태`, `${d} 메모`));
      worksheet.addRow(headers);
      worksheet.getRow(1).font = { bold: true };
      worksheet.getColumn(1).width = 10;
      worksheet.getColumn(5).width = 24;

      for (const p of sortedParts) {
        const row = [null, p.brand, p.code, p.barcode || '-', p.name];
        if (visibleCols.supply_price) row.push(p.supply_price || 0);
        if (visibleCols.price) row.push(p.price || 0);
        if (visibleCols.note) row.push(p.note || '');
        row.push(p.memo || '');
        dateColumns.forEach((d) => {
          const cell = ordersMap.get(`${p.id}_${d}`) || { quantity: 0, received_quantity: 0, memo: '' };
          const order = cell.quantity || 0;
          const received = cell.received_quantity || 0;
          let status = '';
          if (order > 0 && received > 0) {
            status = received >= order ? '입고완료' : `부분입고(잔여 ${order - received})`;
          }
          row.push(order, received, status, cell.memo || '');
        });
        const excelRow = worksheet.addRow(row);
        excelRow.height = 40;

        if (p.image_url) {
          try {
            const res = await fetch(p.image_url);
            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();
            const ext = blob.type.includes('png') ? 'png' : 'jpeg';
            const imageId = workbook.addImage({ buffer, extension: ext });
            worksheet.addImage(imageId, { tl: { col: 0, row: excelRow.number - 1 }, ext: { width: 40, height: 40 } });
          } catch (e) {
            // 이미지 로드 실패시 건너뜀
          }
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `발주현황_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setExcelDownloading(false);
    }
  };

  const openMemoEditor = (e, partId, dateStr, currentMemo) => {
    setMemoAnchor(e.currentTarget);
    setMemoDraft({ key: `${partId}_${dateStr}`, partId, dateStr, text: currentMemo || '' });
  };

  const saveMemo = async () => {
    const { key, partId, dateStr, text } = memoDraft;
    const prevCell = ordersMap.get(key) || { quantity: 0, received_quantity: 0, received: false, received_at: null, memo: '' };
    const memo = text.trim();

    setOrdersMap((m) => new Map(m).set(key, { ...prevCell, memo }));
    setMemoAnchor(null);

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .upsert(
          {
            part_id: partId,
            order_date: dateStr,
            quantity: prevCell.quantity,
            received_quantity: prevCell.received_quantity,
            received: prevCell.received,
            received_at: prevCell.received_at,
            memo: memo || null,
          },
          { onConflict: 'part_id,order_date' }
        );
      if (error) throw error;
    } catch (err) {
      setOrdersMap((m) => new Map(m).set(key, prevCell));
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  // 표시중인 날짜 열 기준 입고 상태: 입고수량 < 발주수량 있으면 미입고, 주문 있고 전부 입고면 입고완료
  const getReceivedStatus = (partId) => {
    let hasOrder = false;
    let hasUnreceived = false;
    dateColumns.forEach((dateStr) => {
      const cell = ordersMap.get(`${partId}_${dateStr}`);
      if (cell && cell.quantity > 0) {
        hasOrder = true;
        if ((cell.received_quantity || 0) < cell.quantity) hasUnreceived = true;
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
    if (noteFilter !== 'all' && (p.note || '') !== noteFilter) return false;
    if (receivedFilter === 'all') return true;
    return getReceivedStatus(p.id) === receivedFilter;
  });

  const noteOptions = [...new Set(parts.map((p) => p.note).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  const sortedParts = [...filteredParts].sort((a, b) => {
    const av = (a[sortBy] || '').toString();
    const bv = (b[sortBy] || '').toString();
    const cmp = av.localeCompare(bv, 'ko');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const pagedParts = sortedParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const tableMinWidth = STICKY_TOTAL + 370 + dateColumns.length * 160;

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
        <Button
          variant="outlined"
          size="small"
          startIcon={excelDownloading ? <CircularProgress size={14} /> : <DownloadIcon />}
          onClick={handleExcelDownload}
          disabled={excelDownloading}
        >
          엑셀 다운로드
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
          <InputLabel>구분</InputLabel>
          <Select
            label="구분"
            value={noteFilter}
            onChange={(e) => { setNoteFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="all">전체</MenuItem>
            {noteOptions.map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
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
          <Table
            size="small"
            stickyHeader
            sx={{
              minWidth: tableMinWidth,
              tableLayout: 'fixed',
              '& td, & th': { borderRight: '1px solid', borderColor: 'divider' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.image, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.image, minWidth: STICKY_WIDTHS.image }}>이미지</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.brand, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.brand, minWidth: STICKY_WIDTHS.brand }}>브랜드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.barcode, minWidth: STICKY_WIDTHS.barcode }}>바코드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.name, minWidth: STICKY_WIDTHS.name }}>제품명</TableCell>
                {visibleCols.supply_price && <TableCell align="right" sx={{ width: 90 }}>공급가</TableCell>}
                {visibleCols.price && <TableCell align="right" sx={{ width: 90 }}>판매가</TableCell>}
                {visibleCols.note && <TableCell sx={{ width: 70 }}>구분</TableCell>}
                <TableCell sx={{ width: 120 }}>적요</TableCell>
                {dateColumns.map((dateStr) => (
                  <TableCell key={dateStr} align="center" sx={{ width: 160, minWidth: 160 }}>
                    {format(parseISO(dateStr), 'yy/MM/dd')}
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
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.barcode || '-'}
                    <Typography variant="caption" display="block" color="text.secondary">{p.code}</Typography>
                  </TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.name}
                    {p.name_en && (
                      <Typography variant="body2" display="block" color="text.secondary">
                        {p.name_en}
                      </Typography>
                    )}
                  </TableCell>
                  {visibleCols.supply_price && <TableCell align="right">{p.supply_price?.toLocaleString() || '-'}</TableCell>}
                  {visibleCols.price && <TableCell align="right">{p.price?.toLocaleString() || '-'}</TableCell>}
                  {visibleCols.note && <TableCell>{p.note || '-'}</TableCell>}
                  <TableCell sx={{ fontSize: '18px' }}>{p.memo || '-'}</TableCell>
                  {dateColumns.map((dateStr) => {
                    const key = `${p.id}_${dateStr}`;
                    const cell = ordersMap.get(key) || { quantity: 0, received_quantity: 0 };
                    const pending = pendingQuantities[key];
                    const orderValue = pending?.orderRaw !== undefined ? pending.orderRaw : (cell.quantity || '');
                    const receivedValue = pending?.receivedRaw !== undefined ? pending.receivedRaw : (cell.received_quantity || '');
                    const effOrder = parseQty(orderValue);
                    const effReceived = parseQty(receivedValue);
                    let statusLabel = '';
                    let statusColor = 'text.secondary';
                    if (effOrder > 0 && effReceived > 0) {
                      if (effReceived >= effOrder) {
                        statusLabel = '입고완료';
                        statusColor = 'success.main';
                      } else {
                        statusLabel = `부분입고 (잔여 ${effOrder - effReceived})`;
                        statusColor = 'warning.main';
                      }
                    }
                    return (
                      <TableCell key={dateStr} align="center" sx={{ p: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                          <TextField
                            type="number"
                            size="small"
                            value={orderValue}
                            onChange={(e) => handleOrderQtyChange(p.id, dateStr, e.target.value)}
                            inputProps={{ min: 0, style: { width: 52, textAlign: 'center', padding: '2px 4px' } }}
                            sx={{
                              '& .MuiOutlinedInput-root': { borderRadius: 0 },
                              ...(pending?.orderRaw !== undefined ? { '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: 'warning.light' } } : {}),
                            }}
                          />
                          <Typography variant="caption">/</Typography>
                          <TextField
                            type="number"
                            size="small"
                            value={receivedValue}
                            onChange={(e) => handleReceivedQtyChange(p.id, dateStr, e.target.value)}
                            inputProps={{ min: 0, style: { width: 52, textAlign: 'center', padding: '2px 4px' } }}
                            sx={{
                              '& .MuiOutlinedInput-root': { borderRadius: 0 },
                              ...(pending?.receivedRaw !== undefined ? { '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: 'warning.light' } } : {}),
                            }}
                          />
                          <Tooltip
                            title={cell.memo || ''}
                            arrow
                            placement="top"
                            disableHoverListener={!cell.memo}
                            componentsProps={{ tooltip: { sx: { fontSize: '18px' } } }}
                          >
                            <Badge color="primary" variant="dot" overlap="circular" invisible={!cell.memo}>
                              <IconButton size="small" onClick={(e) => openMemoEditor(e, p.id, dateStr, cell.memo)} sx={{ p: 0.25 }}>
                                <AddIcon fontSize="inherit" />
                              </IconButton>
                            </Badge>
                          </Tooltip>
                        </Box>
                        {statusLabel && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="body2" sx={{ color: statusColor, fontWeight: 600 }}>
                              {statusLabel}
                            </Typography>
                          </Box>
                        )}
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

      <Popover
        open={Boolean(memoAnchor)}
        anchorEl={memoAnchor}
        onClose={() => setMemoAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, width: 220 }}>
          <TextField
            autoFocus
            multiline
            minRows={2}
            fullWidth
            size="small"
            placeholder="메모 입력"
            value={memoDraft.text}
            onChange={(e) => setMemoDraft((d) => ({ ...d, text: e.target.value }))}
            sx={{ '& .MuiInputBase-input': { fontSize: '18px' } }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
            <Button size="small" onClick={() => setMemoAnchor(null)}>취소</Button>
            <Button size="small" variant="contained" onClick={saveMemo}>저장</Button>
          </Box>
        </Box>
      </Popover>

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
