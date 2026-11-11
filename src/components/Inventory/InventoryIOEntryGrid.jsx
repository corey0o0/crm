import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableFooter, TableRow, Snackbar, Alert, CircularProgress,
  TablePagination, IconButton, Button, FormControl, InputLabel, Select, MenuItem,
  Tooltip, Popover, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { supabase, queryWithTimeout } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import { warehouseApi } from '../../api/warehouseApi';

// 발주관리(PurchaseOrderManagement)의 그리드/대기-일괄저장/등록 패턴을 미러링.
// 날짜 컬럼 하나 = 하나의 이동(보낸곳 -> 받는곳), 방향이 컬럼에 고정되므로 칸엔 수량 1개만 입력.
// 같은 날짜라도 이동이 다르면 컬럼을 또 추가한다 (예: "11/11 수입->형동", "11/11-2 형동->청담").

const EXTERNAL = '외부';
const STICKY_WIDTHS = { brand: 70, barcode: 130, name: 260 };
const STICKY_LEFT = { brand: 0, barcode: STICKY_WIDTHS.brand, name: STICKY_WIDTHS.brand + STICKY_WIDTHS.barcode };
const STICKY_TOTAL = STICKY_LEFT.name + STICKY_WIDTHS.name;

function InventoryIOEntryGrid() {
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [warehouses, setWarehouses] = useState([]);

  const [dateColumns, setDateColumns] = useState([]); // [{ id, order_date, label, from_location, to_location, created_at }]
  const [newDate, setNewDate] = useState(null);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [editingColId, setEditingColId] = useState(null);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesMap, setEntriesMap] = useState(new Map()); // `${partId}_${columnId}` -> { qty, registered_qty, memo }
  const [pendingQuantities, setPendingQuantities] = useState({}); // key -> raw string
  const [memoAnchor, setMemoAnchor] = useState(null);
  const [memoDraft, setMemoDraft] = useState({ key: null, partId: null, columnId: null, text: '' });
  const [registeringStock, setRegisteringStock] = useState(false);
  const [registeredColumnIds, setRegisteredColumnIds] = useState(new Set());

  const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const locationLabel = useCallback((locId) => {
    if (locId === EXTERNAL) return '수입(외부)';
    return warehouses.find((w) => w.id === locId)?.name || locId;
  }, [warehouses]);

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
            .select('id, name, name_en, brand, code, barcode, note')
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

  useEffect(() => { fetchParts(); }, [fetchParts]);

  useEffect(() => {
    warehouseApi.getVisible().then(setWarehouses).catch((err) => showSnackbar(getErrorMessage(err), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortColumns = (cols) =>
    [...cols].sort((a, b) =>
      a.order_date === b.order_date
        ? (b.created_at || '').localeCompare(a.created_at || '')
        : b.order_date.localeCompare(a.order_date)
    );

  const fetchEntries = useCallback(async (cols) => {
    if (!cols || cols.length === 0) { setEntriesMap(new Map()); setLoadingEntries(false); return; }
    setLoadingEntries(true);
    try {
      const { data, error } = await safeRetry(() =>
        queryWithTimeout(supabase.from('io_entries').select('part_id, column_id, qty, registered_qty, memo'), 8000)
      );
      if (error) throw error;
      const next = new Map();
      (data || []).forEach((row) => {
        next.set(`${row.part_id}_${row.column_id}`, {
          qty: row.qty || 0,
          registered_qty: row.registered_qty || 0,
          memo: row.memo || '',
        });
      });
      setEntriesMap(next);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await safeRetry(() =>
          queryWithTimeout(
            supabase.from('io_date_columns').select('id, order_date, label, from_location, to_location, created_at')
              .order('order_date', { ascending: false }).order('created_at', { ascending: false }),
            8000
          )
        );
        if (error) throw error;
        const cols = data || [];
        setDateColumns(cols);
        fetchEntries(cols);
      } catch (err) {
        showSnackbar(getErrorMessage(err), 'error');
      }
    })();
  }, [fetchEntries]);

  // 어떤 컬럼이든 재고 등록된 적 있으면 삭제 차단 (DB 트리거로도 2차 방어)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('io_entries').select('column_id').gt('registered_qty', 0);
      setRegisteredColumnIds(new Set((data || []).map((r) => r.column_id)));
    })();
  }, [entriesMap]);

  const handleAddDateColumn = async () => {
    if (!newDate || !newFrom || !newTo) return;
    if (newFrom === newTo) { showSnackbar('보낸곳과 받는곳이 같을 수 없습니다.', 'error'); return; }
    const dateStr = format(newDate, 'yyyy-MM-dd');
    try {
      const { data, error } = await safeRetry(() =>
        queryWithTimeout(
          supabase.from('io_date_columns')
            .insert({ order_date: dateStr, from_location: newFrom, to_location: newTo })
            .select('id, order_date, label, from_location, to_location, created_at').single(),
          8000
        )
      );
      if (error) throw error;
      setDateColumns((prev) => sortColumns([...prev, data]));
      setNewDate(null);
      setNewFrom('');
      setNewTo('');
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleRemoveDateColumn = async (column) => {
    if (registeredColumnIds.has(column.id)) {
      showSnackbar('입출고 등록된 이동은 삭제할 수 없습니다.', 'error');
      return;
    }
    if (!window.confirm('이 이동(컬럼)을 삭제하시겠습니까? 저장된 입출고 데이터도 함께 삭제됩니다.')) return;
    try {
      const { error } = await safeRetry(() => queryWithTimeout(supabase.from('io_date_columns').delete().eq('id', column.id), 8000));
      if (error) throw error;
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
      return;
    }
    setDateColumns((prev) => prev.filter((c) => c.id !== column.id));
    setEntriesMap((m) => {
      const next = new Map(m);
      [...next.keys()].forEach((k) => { if (k.split('_')[1] === column.id) next.delete(k); });
      return next;
    });
  };

  const handleDateLabelChange = (columnId, value) => {
    setDateColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, label: value } : c)));
  };

  const handleDateLabelSave = async (columnId) => {
    const col = dateColumns.find((c) => c.id === columnId);
    try {
      const { error } = await safeRetry(() =>
        queryWithTimeout(supabase.from('io_date_columns').update({ label: col?.label || '' }).eq('id', columnId), 8000)
      );
      if (error) throw error;
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleDateValueChange = async (column, newDateObj) => {
    setEditingColId(null);
    if (!newDateObj) return;
    const newDateStr = format(newDateObj, 'yyyy-MM-dd');
    if (newDateStr === column.order_date) return;
    try {
      const { error } = await safeRetry(() => queryWithTimeout(supabase.from('io_date_columns').update({ order_date: newDateStr }).eq('id', column.id), 8000));
      if (error) throw error;
      setDateColumns((prev) => sortColumns(prev.map((c) => (c.id === column.id ? { ...c, order_date: newDateStr } : c))));
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const parseQty = (raw) => {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  const handleQtyChange = (partId, columnId, rawValue) => {
    const key = `${partId}_${columnId}`;
    setPendingQuantities((prev) => ({ ...prev, [key]: rawValue }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingQuantities);
    const rows = [];
    const commits = [];
    entries.forEach(([key, rawValue]) => {
      const [partIdStr, columnId] = key.split('_');
      const prevCell = entriesMap.get(key) || { qty: 0, registered_qty: 0, memo: '' };
      const qty = parseQty(rawValue);
      if (qty === prevCell.qty) return;
      rows.push({ part_id: Number(partIdStr), column_id: columnId, qty, memo: prevCell.memo || null });
      commits.push({ key, qty });
    });

    if (rows.length === 0) { setPendingQuantities({}); return; }

    try {
      const { error } = await supabase.from('io_entries').upsert(rows, { onConflict: 'part_id,column_id' });
      if (error) throw error;
      setEntriesMap((m) => {
        const next = new Map(m);
        commits.forEach(({ key, qty }) => {
          const prevCell = next.get(key) || { qty: 0, registered_qty: 0, memo: '' };
          next.set(key, { ...prevCell, qty });
        });
        return next;
      });
      setPendingQuantities({});
      showSnackbar(`${rows.length}건 저장되었습니다.`, 'success');
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const partsById = useMemo(() => {
    const map = new Map();
    parts.forEach((p) => map.set(p.id, p));
    return map;
  }, [parts]);

  const columnsById = useMemo(() => {
    const map = new Map();
    dateColumns.forEach((c) => map.set(c.id, c));
    return map;
  }, [dateColumns]);

  // 저장된(entriesMap) 수량 중 아직 등록 안 된 만큼(delta)만 추출
  const registerableRows = useMemo(() => {
    const result = [];
    entriesMap.forEach((cell, key) => {
      const delta = (cell.qty || 0) - (cell.registered_qty || 0);
      if (delta > 0) {
        const [partIdStr, columnId] = key.split('_');
        result.push({ key, partId: Number(partIdStr), columnId, qty: cell.qty || 0 });
      }
    });
    return result;
  }, [entriesMap]);

  const handleRegisterStock = async () => {
    if (registeringStock) return;
    if (registerableRows.length === 0) { showSnackbar('등록할 입출고 내역이 없습니다.', 'info'); return; }

    setRegisteringStock(true);
    let successCount = 0;

    for (const row of registerableRows) {
      const part = partsById.get(row.partId);
      const column = columnsById.get(row.columnId);
      if (!part) continue;
      try {
        const commonMemo = column?.label?.trim() || '입출고 등록';
        const { data: rpcData, error: rpcError } = await supabase.rpc('register_io_entry_stock', {
          p_part_id: row.partId,
          p_column_id: row.columnId,
          p_qty: row.qty,
          p_part_name: part.name,
          p_part_code: part.code,
          p_brand_code: part.brand,
          p_common_memo: commonMemo,
        });
        if (rpcError) throw rpcError;

        const result = rpcData?.[0];
        if ((result?.delta_qty || 0) > 0) successCount += 1;

        setEntriesMap((m) => {
          const next = new Map(m);
          const prevCell = next.get(row.key);
          if (prevCell) next.set(row.key, { ...prevCell, registered_qty: row.qty });
          return next;
        });
      } catch (err) {
        console.error(`부품 ${part.name} 입출고 등록 실패:`, err);
        showSnackbar(`${part.name} 등록 실패: ${getErrorMessage(err)}`, 'error');
      }
    }

    if (successCount > 0) showSnackbar(`${successCount}건 재고에 등록되었습니다.`, 'success');
    setRegisteringStock(false);
  };

  const openMemoEditor = (e, partId, columnId, currentMemo) => {
    setMemoAnchor(e.currentTarget);
    setMemoDraft({ key: `${partId}_${columnId}`, partId, columnId, text: currentMemo || '' });
  };

  const saveMemo = async () => {
    const { key, partId, columnId, text } = memoDraft;
    const prevCell = entriesMap.get(key) || { qty: 0, registered_qty: 0 };
    const memo = text.trim();
    setMemoAnchor(null);
    try {
      const nextCell = { ...prevCell, memo };
      setEntriesMap((m) => new Map(m).set(key, nextCell));
      const { error } = await supabase.from('io_entries').upsert(
        { part_id: partId, column_id: columnId, qty: prevCell.qty, memo: memo || null },
        { onConflict: 'part_id,column_id' }
      );
      if (error) throw error;
    } catch (err) {
      setEntriesMap((m) => new Map(m).set(key, prevCell));
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  // 공임/기타는 물리적 재고가 아니라 입출고 대상 아님 (발주관리와 동일 규칙)
  const filteredParts = parts.filter((p) => {
    if (p.note === '공임' || p.note === '기타') return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.name_en || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term)
    );
  });
  const pagedParts = filteredParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const tableMinWidth = STICKY_TOTAL + dateColumns.length * 160;

  const getCellBg = (qty, registeredQty) => {
    if (qty <= 0) return undefined;
    if (qty <= registeredQty && registeredQty > 0) return '#e8f5e9'; // 등록 완료
    return '#fff9c4'; // 저장은 됐지만 등록 미완료
  };

  const topScrollSyncing = useRef(false);
  const handleTopScroll = () => {
    if (topScrollSyncing.current) { topScrollSyncing.current = false; return; }
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollSyncing.current = true;
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };
  const handleBottomScroll = () => {
    if (topScrollSyncing.current) { topScrollSyncing.current = false; return; }
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollSyncing.current = true;
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const locationOptions = [{ id: EXTERNAL, name: '수입(외부)' }, ...warehouses];

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>입출고 등록</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="브랜드/코드/이름 검색"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          sx={{ width: 260 }}
        />

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
          <DatePicker
            label="날짜"
            value={newDate}
            onChange={(v) => setNewDate(v)}
            slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
          />
        </LocalizationProvider>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>보낸곳</InputLabel>
          <Select label="보낸곳" value={newFrom} onChange={(e) => setNewFrom(e.target.value)}>
            {locationOptions.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </Select>
        </FormControl>
        <ArrowForwardIcon fontSize="small" color="action" />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>받는곳</InputLabel>
          <Select label="받는곳" value={newTo} onChange={(e) => setNewTo(e.target.value)}>
            {locationOptions.map((l) => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" size="small" onClick={handleAddDateColumn} disabled={!newDate || !newFrom || !newTo}>열 추가</Button>

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
          variant="contained"
          color="secondary"
          size="small"
          onClick={handleRegisterStock}
          disabled={registerableRows.length === 0 || registeringStock}
        >
          {registeringStock ? '등록 중...' : `재고 등록${registerableRows.length > 0 ? ` (${registerableRows.length})` : ''}`}
        </Button>

        {(loadingParts || loadingEntries) && <CircularProgress size={20} />}
      </Box>

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <>
        <Box ref={topScrollRef} onScroll={handleTopScroll} sx={{ overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%' }}>
          <Box sx={{ width: tableMinWidth, height: 1 }} />
        </Box>
        <TableContainer
          component={Paper}
          ref={bottomScrollRef}
          onScroll={handleBottomScroll}
          sx={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{ minWidth: tableMinWidth, tableLayout: 'fixed', border: '1px solid', borderColor: 'divider', '& td, & th': { borderRight: '1px solid', borderColor: 'divider' } }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.brand, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.brand, minWidth: STICKY_WIDTHS.brand }}>브랜드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.barcode, minWidth: STICKY_WIDTHS.barcode }}>바코드/코드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.name, minWidth: STICKY_WIDTHS.name }}>제품명</TableCell>
                {dateColumns.map((col) => (
                  <TableCell key={col.id} align="center" sx={{ width: 160, minWidth: 160 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      {editingColId === col.id ? (
                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                          <DatePicker
                            open
                            value={parseISO(col.order_date)}
                            onClose={() => setEditingColId(null)}
                            onChange={(v) => handleDateValueChange(col, v)}
                            slotProps={{ textField: { size: 'small', sx: { width: 100 }, inputProps: { style: { fontSize: 11, padding: '2px 4px' } } } }}
                          />
                        </LocalizationProvider>
                      ) : (
                        <Typography variant="body2" sx={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => setEditingColId(col.id)}>
                          {format(parseISO(col.order_date), 'yy/MM/dd')}
                        </Typography>
                      )}
                      {registeredColumnIds.has(col.id) && (
                        <Tooltip title="재고 등록 완료">
                          <Chip label="등록" size="small" color="success" sx={{ height: 16, fontSize: 10, '& .MuiChip-label': { px: 0.5 } }} />
                        </Tooltip>
                      )}
                      <IconButton size="small" onClick={() => handleRemoveDateColumn(col)} sx={{ p: 0, ml: 0.5 }}>
                        <CloseIcon fontSize="inherit" />
                      </IconButton>
                    </Box>
                    <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: 10 }}>
                      {locationLabel(col.from_location)} → {locationLabel(col.to_location)}
                    </Typography>
                    <TextField
                      variant="standard" size="small" fullWidth placeholder="메모"
                      value={col.label || ''}
                      onChange={(e) => handleDateLabelChange(col.id, e.target.value)}
                      onBlur={() => handleDateLabelSave(col.id)}
                      sx={{ mt: 0.5 }}
                      inputProps={{ style: { fontSize: 11, textAlign: 'center' } }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.brand, zIndex: 2, bgcolor: 'background.paper' }}>{p.brand}</TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.barcode || '-'}
                    <Typography variant="caption" display="block" color="text.secondary">{p.code}</Typography>
                  </TableCell>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.name}
                    {p.name_en && <Typography variant="caption" display="block" color="text.secondary">{p.name_en}</Typography>}
                  </TableCell>
                  {dateColumns.map((col) => {
                    const key = `${p.id}_${col.id}`;
                    const cell = entriesMap.get(key) || { qty: 0, registered_qty: 0, memo: '' };
                    const pendingRaw = pendingQuantities[key];
                    const value = pendingRaw !== undefined ? pendingRaw : (cell.qty || '');
                    const effQty = parseQty(value);
                    return (
                      <TableCell key={key} align="center" sx={{ p: 0.5, bgcolor: getCellBg(effQty, cell.registered_qty) }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                          <TextField
                            type="number" size="small" value={value}
                            onChange={(e) => handleQtyChange(p.id, col.id, e.target.value)}
                            inputProps={{ min: 0, style: { width: 56, textAlign: 'center', padding: '2px 4px' } }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, ...(pendingRaw !== undefined ? { bgcolor: 'warning.light' } : {}) } }}
                          />
                          {cell.memo ? (
                            <Tooltip title={cell.memo} arrow placement="top">
                              <Chip size="small" label="메모" color="warning" variant="filled" onClick={(e) => openMemoEditor(e, p.id, col.id, cell.memo)} sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }} />
                            </Tooltip>
                          ) : (
                            <IconButton size="small" onClick={(e) => openMemoEditor(e, p.id, col.id, cell.memo)} sx={{ p: 0.25 }}>
                              <AddIcon fontSize="inherit" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} sx={{ position: 'sticky', left: 0, zIndex: 3, width: STICKY_TOTAL, minWidth: STICKY_TOTAL, bgcolor: 'background.paper', fontWeight: 600 }}>
                  합계
                </TableCell>
                {dateColumns.map((col) => {
                  let sum = 0;
                  filteredParts.forEach((p) => {
                    const cell = entriesMap.get(`${p.id}_${col.id}`);
                    if (cell) sum += cell.qty || 0;
                  });
                  return (
                    <TableCell key={col.id} align="center" sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>
                      {sum}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
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
        </>
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
            autoFocus multiline minRows={2} fullWidth size="small" placeholder="메모 입력"
            value={memoDraft.text}
            onChange={(e) => setMemoDraft((d) => ({ ...d, text: e.target.value }))}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
            <Button size="small" onClick={() => setMemoAnchor(null)}>취소</Button>
            <Button size="small" variant="contained" onClick={saveMemo}>저장</Button>
          </Box>
        </Box>
      </Popover>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default InventoryIOEntryGrid;
