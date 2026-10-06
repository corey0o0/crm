import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress, Checkbox,
  TablePagination, Avatar, IconButton, Button, Dialog, DialogContent, FormControlLabel,
  Select, MenuItem, FormControl, InputLabel, Tooltip, Popover, Chip, Switch,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import ExcelJS from 'exceljs';
import { supabase, queryWithTimeout } from '../../lib/supabaseClient';
import { inventoryApi } from '../../api/inventoryApi';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import { matchAllKnownAirframeModels } from '../../utils/airframeModelNormalize';

// 왼쪽 고정(스티키) 컬럼 폭. 헤더/바디 offset 계산에 재사용.
const STICKY_WIDTHS = { checkbox: 42, image: 48, brand: 70, barcode: 90, name: 160 };
const STICKY_LEFT = {
  checkbox: 0,
  image: STICKY_WIDTHS.checkbox,
  brand: STICKY_WIDTHS.checkbox + STICKY_WIDTHS.image,
  barcode: STICKY_WIDTHS.checkbox + STICKY_WIDTHS.image + STICKY_WIDTHS.brand,
  name: STICKY_WIDTHS.checkbox + STICKY_WIDTHS.image + STICKY_WIDTHS.brand + STICKY_WIDTHS.barcode,
};
const STICKY_TOTAL = STICKY_LEFT.name + STICKY_WIDTHS.name;

// 추가한 날짜 열은 컴포넌트 state라 새로고침하면 사라짐 → localStorage에 저장해 복원
const DATE_COLUMNS_STORAGE_KEY = 'po_date_columns';

// 기종은 DB 컬럼이 없어 상품명에서 추출. 브랜드별 위치(괄호/대시)가 제각각이라
// 판매통계에서 쓰는 기종 키워드 매칭(브랜드 무관, 텍스트 전체 스캔)을 재사용.
function extractModel(p) {
  return matchAllKnownAirframeModels(p.name).join('/');
}

function PurchaseOrderManagement() {
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [visibleCols, setVisibleCols] = useState({ model: true, supply_price: true, price: true, note: true, memo: true, purchase_source: true });
  const [showHiddenParts, setShowHiddenParts] = useState(false);
  const [receivedFilter, setReceivedFilter] = useState('all');
  const [noteFilter, setNoteFilter] = useState('all');
  const [purchaseSourceFilter, setPurchaseSourceFilter] = useState([]); // 빈 배열 = 전체
  const [sortBy, setSortBy] = useState('brand');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [dateColumns, setDateColumns] = useState([]);
  const [newDate, setNewDate] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [pendingQuantities, setPendingQuantities] = useState({});
  const [memoAnchor, setMemoAnchor] = useState(null);
  const [memoDraft, setMemoDraft] = useState({ key: null, partId: null, dateStr: null, text: '' });
  const [excelDownloading, setExcelDownloading] = useState(false);
  const [stockTotals, setStockTotals] = useState({});

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
            .select('id, name, name_en, brand, code, barcode, image_url, supply_price, price, note, memo, purchase_source, created_at')
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

  useEffect(() => {
    // 전체 창고(숨김 포함) 재고 합계 — 발주관리 "현재고"는 parts.stock(기준창고 1곳)이 아니라
    // inventory 테이블의 창고별 수량 전체 합산이어야 함
    inventoryApi.getAll().then((rows) => {
      const totals = {};
      rows.forEach((r) => {
        totals[r.product_id] = (totals[r.product_id] || 0) + (Number(r.quantity) || 0);
      });
      setStockTotals(totals);
    });
  }, []);

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

  // 새로고침해도 추가했던 날짜 열이 유지되도록 복원
  const dateColumnsLoadedRef = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DATE_COLUMNS_STORAGE_KEY) || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        setDateColumns(saved);
        saved.forEach((d) => fetchOrdersForDate(d));
      }
    } catch (e) {
      // 저장된 값이 깨졌으면 무시
    } finally {
      dateColumnsLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 복원 완료 전에는 저장하지 않음 (초기 빈 배열이 복원값을 덮어쓰는 것 방지)
    if (!dateColumnsLoadedRef.current) return;
    localStorage.setItem(DATE_COLUMNS_STORAGE_KEY, JSON.stringify(dateColumns));
  }, [dateColumns]);

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

  const handleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pagedParts.forEach((p) => {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  const handleExcelDownload = async () => {
    setExcelDownloading(true);
    try {
      const exportParts = selectedIds.size > 0 ? sortedParts.filter((p) => selectedIds.has(p.id)) : sortedParts;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('발주현황');

      const headers = ['이미지', '브랜드', '코드', '바코드', '영문명', '제품명'];
      if (visibleCols.model) headers.push('기종');
      if (visibleCols.supply_price) headers.push('공급가');
      if (visibleCols.price) headers.push('판매가');
      if (visibleCols.note) headers.push('구분');
      if (visibleCols.memo) headers.push('적요');
      if (visibleCols.purchase_source) headers.push('매입처');
      headers.push('현재고');
      dateColumns.forEach((d) => headers.push(`${d} 발주`, `${d} 입고`, `${d} 상태`, `${d} 메모`));
      worksheet.addRow(headers);
      worksheet.getRow(1).font = { bold: true };
      worksheet.getColumn(1).width = 10;
      worksheet.getColumn(6).width = 24;
      // 이미지 셀 크기(픽셀 환산): 열너비(문자단위) ≈ chars*7+5, 행높이(pt) ≈ pt*96/72
      const IMAGE_CELL_PX = { width: Math.round(10 * 7 + 5), height: Math.round(40 * 96 / 72) };

      const imageBuffers = new Map();
      await Promise.all(exportParts.map(async (p) => {
        if (!p.image_url) return;
        try {
          const res = await fetch(p.image_url);
          const blob = await res.blob();
          const buffer = await blob.arrayBuffer();
          const ext = blob.type.includes('png') ? 'png' : 'jpeg';
          const bitmap = await createImageBitmap(blob);
          imageBuffers.set(p.id, { buffer, ext, width: bitmap.width, height: bitmap.height });
          bitmap.close();
        } catch (e) {
          // 이미지 로드 실패시 건너뜀
        }
      }));

      for (const p of exportParts) {
        const row = [null, p.brand, p.code, p.barcode || '-', p.name_en || '', p.name];
        if (visibleCols.model) row.push(extractModel(p));
        if (visibleCols.supply_price) row.push(p.supply_price || 0);
        if (visibleCols.price) row.push(p.price || 0);
        if (visibleCols.note) row.push(p.note || '');
        if (visibleCols.memo) row.push((p.memo || '').replace('[HIDDEN]', '').trim());
        if (visibleCols.purchase_source) row.push(p.purchase_source || '');
        row.push(stockTotals[p.id] ?? 0);
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

        const img = imageBuffers.get(p.id);
        if (img) {
          const scale = Math.min(IMAGE_CELL_PX.width / img.width, IMAGE_CELL_PX.height / img.height);
          const imageId = workbook.addImage({ buffer: img.buffer, extension: img.ext });
          worksheet.addImage(imageId, {
            tl: { col: 0, row: excelRow.number - 1 },
            ext: { width: img.width * scale, height: img.height * scale },
          });
        }
      }

      worksheet.eachRow((row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

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

  // 날짜 열 중 하나라도 입고수량이 있는지 (부분입고 포함)
  const hasAnyReceived = (partId) => {
    return dateColumns.some((dateStr) => {
      const cell = ordersMap.get(`${partId}_${dateStr}`);
      return cell && (cell.received_quantity || 0) > 0;
    });
  };

  // 셀 배경색: 입고수량 0=회색, 전부 입고=그린, 일부만 입고=노랑 (날짜 셀 단위)
  const getCellBg = (order, received) => {
    if (order <= 0) return undefined;
    if (received === 0) return '#f5f5f5';
    if (received >= order) return '#e8f5e9';
    return '#fff9c4';
  };

  const hiddenPartsCount = parts.filter((p) => (p.memo || '').includes('[HIDDEN]')).length;

  const filteredParts = parts.filter((p) => {
    if (p.note === '공임' || p.note === '기타') return false; // 발주관리: 공임/기타는 발주 대상 아님
    if (!showHiddenParts && (p.memo || '').includes('[HIDDEN]')) return false;
    const term = searchTerm.trim().toLowerCase();
    const matchesTerm = !term || (
      (p.name || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term)
    );
    if (!matchesTerm) return false;
    if (noteFilter !== 'all' && (p.note || '') !== noteFilter) return false;
    if (purchaseSourceFilter.length > 0 && !purchaseSourceFilter.includes(p.purchase_source || '')) return false;
    if (receivedFilter === 'all') return true;
    if (receivedFilter === 'has_received') return hasAnyReceived(p.id);
    return getReceivedStatus(p.id) === receivedFilter;
  });

  const noteOptions = [...new Set(parts.map((p) => p.note).filter((n) => n && n !== '공임' && n !== '기타'))].sort((a, b) => a.localeCompare(b, 'ko'));
  const purchaseSourceOptions = [...new Set(parts.map((p) => p.purchase_source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  const sortedParts = [...filteredParts].sort((a, b) => {
    const av = (a[sortBy] || '').toString();
    const bv = (b[sortBy] || '').toString();
    const cmp = av.localeCompare(bv, 'ko');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const pagedParts = sortedParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const MIN_DATE_COLUMNS = 2;
  const placeholderColumnCount = Math.max(0, MIN_DATE_COLUMNS - dateColumns.length);
  const tableMinWidth = STICKY_TOTAL + 440 + (dateColumns.length + placeholderColumnCount) * 160;

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
          엑셀 다운로드{selectedIds.size > 0 && ` (선택 ${selectedIds.size})`}
        </Button>
        {selectedIds.size > 0 && (
          <Button size="small" onClick={() => setSelectedIds(new Set())}>
            선택 해제
          </Button>
        )}
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
            <MenuItem value="has_received">입고있음</MenuItem>
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

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>매입처</InputLabel>
          <Select
            multiple
            label="매입처"
            value={purchaseSourceFilter}
            onChange={(e) => { setPurchaseSourceFilter(e.target.value); setPage(0); }}
            renderValue={(selected) => selected.length === 0 ? '전체' : selected.join(', ')}
          >
            {purchaseSourceOptions.map((s) => (
              <MenuItem key={s} value={s}>
                <Checkbox size="small" checked={purchaseSourceFilter.includes(s)} />
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>정렬</InputLabel>
          <Select
            label="정렬"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              if (e.target.value === 'created_at') setSortDir('desc');
              setPage(0);
            }}
          >
            <MenuItem value="brand">브랜드순</MenuItem>
            <MenuItem value="code">코드순</MenuItem>
            <MenuItem value="name">제품명순</MenuItem>
            <MenuItem value="created_at">최신순</MenuItem>
          </Select>
        </FormControl>
        <IconButton size="small" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          {sortDir === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">컬럼 표시:</Typography>
        <FormControlLabel
          control={<Checkbox size="small" checked={visibleCols.model} onChange={(e) => setVisibleCols((c) => ({ ...c, model: e.target.checked }))} />}
          label="기종"
        />
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
        <FormControlLabel
          control={<Checkbox size="small" checked={visibleCols.memo} onChange={(e) => setVisibleCols((c) => ({ ...c, memo: e.target.checked }))} />}
          label="적요"
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={visibleCols.purchase_source} onChange={(e) => setVisibleCols((c) => ({ ...c, purchase_source: e.target.checked }))} />}
          label="매입처"
        />
        <FormControlLabel
          control={<Switch size="small" checked={showHiddenParts} onChange={(e) => { setShowHiddenParts(e.target.checked); setPage(0); }} color="warning" />}
          label={`숨김상품 표시${hiddenPartsCount > 0 ? ` (${hiddenPartsCount})` : ''}`}
        />
      </Box>

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <Paper>
        <TableContainer sx={{ overflowX: 'auto', overflowY: 'visible' }}>
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
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.checkbox, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.checkbox, minWidth: STICKY_WIDTHS.checkbox, p: 0.5 }}>
                  <Checkbox
                    size="small"
                    checked={pagedParts.length > 0 && pagedParts.every((p) => selectedIds.has(p.id))}
                    indeterminate={pagedParts.some((p) => selectedIds.has(p.id)) && !pagedParts.every((p) => selectedIds.has(p.id))}
                    onChange={(e) => handleSelectAllPage(e.target.checked)}
                  />
                </TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.image, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.image, minWidth: STICKY_WIDTHS.image }}>이미지</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.brand, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.brand, minWidth: STICKY_WIDTHS.brand }}>브랜드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.barcode, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.barcode, minWidth: STICKY_WIDTHS.barcode }}>바코드</TableCell>
                <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.name, zIndex: 3, bgcolor: 'background.paper', width: STICKY_WIDTHS.name, minWidth: STICKY_WIDTHS.name }}>제품명</TableCell>
                {visibleCols.model && <TableCell sx={{ width: 90 }}>기종</TableCell>}
                {visibleCols.supply_price && <TableCell align="right" sx={{ width: 90 }}>공급가</TableCell>}
                {visibleCols.price && <TableCell align="right" sx={{ width: 90 }}>판매가</TableCell>}
                {visibleCols.note && <TableCell sx={{ width: 70 }}>구분</TableCell>}
                {visibleCols.memo && <TableCell sx={{ width: 120 }}>적요</TableCell>}
                {visibleCols.purchase_source && <TableCell sx={{ width: 100 }}>매입처</TableCell>}
                <TableCell align="right" sx={{ width: 70 }}>현재고</TableCell>
                {dateColumns.map((dateStr) => (
                  <TableCell key={dateStr} align="center" sx={{ width: 160, minWidth: 160 }}>
                    {format(parseISO(dateStr), 'yy/MM/dd')}
                    <IconButton size="small" onClick={() => handleRemoveDateColumn(dateStr)} sx={{ p: 0, ml: 0.5 }}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </TableCell>
                ))}
                {Array.from({ length: placeholderColumnCount }).map((_, i) => (
                  <TableCell key={`ph-${i}`} align="center" sx={{ width: 160, minWidth: 160, bgcolor: 'action.hover' }} />
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedParts.map((p) => {
                return (
                <TableRow key={p.id}>
                  <TableCell sx={{ position: 'sticky', left: STICKY_LEFT.checkbox, zIndex: 2, bgcolor: 'background.paper', p: 0.5 }}>
                    <Checkbox size="small" checked={selectedIds.has(p.id)} onChange={() => handleSelectRow(p.id)} />
                  </TableCell>
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
                    {(p.memo || '').includes('[HIDDEN]') && (
                      <Chip size="small" label="숨김상품" sx={{ height: 18, fontSize: '0.6rem', ml: 0.5 }} />
                    )}
                    {p.name_en && (
                      <Typography variant="body2" display="block" color="text.secondary">
                        {p.name_en}
                      </Typography>
                    )}
                  </TableCell>
                  {visibleCols.model && <TableCell>{extractModel(p) || '-'}</TableCell>}
                  {visibleCols.supply_price && <TableCell align="right">{p.supply_price?.toLocaleString() || '-'}</TableCell>}
                  {visibleCols.price && <TableCell align="right">{p.price?.toLocaleString() || '-'}</TableCell>}
                  {visibleCols.note && <TableCell>{p.note || '-'}</TableCell>}
                  {visibleCols.memo && (() => {
                    const memoText = (p.memo || '').replace('[HIDDEN]', '').trim();
                    return (
                      <TableCell>
                        {memoText ? (
                          <Tooltip title={memoText}>
                            <span style={{ display: 'block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memoText}</span>
                          </Tooltip>
                        ) : '-'}
                      </TableCell>
                    );
                  })()}
                  {visibleCols.purchase_source && <TableCell>{p.purchase_source || '-'}</TableCell>}
                  <TableCell align="right">{stockTotals[p.id] ?? 0}</TableCell>
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
                      <TableCell key={dateStr} align="center" sx={{ p: 0.5, bgcolor: getCellBg(effOrder, effReceived) }}>
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
                          {cell.memo ? (
                            <Tooltip
                              title={cell.memo}
                              arrow
                              placement="top"
                              componentsProps={{ tooltip: { sx: { fontSize: '18px' } } }}
                            >
                              <Chip
                                size="small"
                                label="메모"
                                color="warning"
                                variant="filled"
                                onClick={(e) => openMemoEditor(e, p.id, dateStr, cell.memo)}
                                sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }}
                              />
                            </Tooltip>
                          ) : (
                            <IconButton size="small" onClick={(e) => openMemoEditor(e, p.id, dateStr, cell.memo)} sx={{ p: 0.25 }}>
                              <AddIcon fontSize="inherit" />
                            </IconButton>
                          )}
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
                  {Array.from({ length: placeholderColumnCount }).map((_, i) => (
                    <TableCell key={`ph-${i}`} sx={{ bgcolor: 'action.hover' }} />
                  ))}
                </TableRow>
                );
              })}
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
