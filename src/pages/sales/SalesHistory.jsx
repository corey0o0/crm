import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, Button, Grid,
  TablePagination, CircularProgress, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Assessment as AssessmentIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SalesEditModal from './SalesEditModal';

// ── 공급가/부가세 역산 헬퍼 ────────────────────────────
const calcVAT = (total) => {
  const t = Number(total || 0);
  const supply = Math.round(t / 1.1);
  return { supply, vat: t - supply };
};

function SalesHistory() {
  const [loading, setLoading] = useState(true);
  const [flatRows, setFlatRows] = useState([]);   // 품목 단위로 펼친 데이터
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filterType, setFilterType] = useState('all');

  // 편집 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState({ id: null, type: null });

  // 공급가/부가세 표시 토글
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  // 페이지네이션
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);

  useEffect(() => { fetchSales(); }, []);

  // ── 데이터 패치 ────────────────────────────────────────
  const fetchSales = async () => {
    setLoading(true);

    let shipQuery = supabase
      .from('shipments')
      .select('id, order_date, customer_name, price, sales_channel, status, note, warehouse_id, shipment_parts(id, part_name, quantity, price, total_price)')
      .in('status', ['출고완료', '완료'])
      .order('order_date', { ascending: false })
      .limit(800);

    if (startDate) shipQuery = shipQuery.gte('order_date', format(startDate, 'yyyy-MM-dd'));
    if (endDate)   shipQuery = shipQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

    let asQuery = supabase
      .from('services')
      .select('id, reception_date, completion_date, customer_name, status, note')
      .ilike('status', '%완료%')
      .order('completion_date', { ascending: false })
      .limit(800);
    if (startDate) {
      const sDate = format(startDate, 'yyyy-MM-dd');
      asQuery = asQuery.or(`completion_date.gte.${sDate},and(completion_date.is.null,reception_date.gte.${sDate})`);
    }
    if (endDate) {
      const eDate = format(endDate, 'yyyy-MM-dd') + 'T23:59:59';
      asQuery = asQuery.or(`completion_date.lte.${eDate},and(completion_date.is.null,reception_date.lte.${eDate})`);
    }

    let cafeQuery = supabase
      .from('cafe24_orders')
      .select('id, order_id, order_date, buyer_name, total_amount, order_items, status')
      .eq('is_transferred', true)
      .order('order_date', { ascending: false })
      .limit(800);

    if (startDate) cafeQuery = cafeQuery.gte('order_date', format(startDate, 'yyyy-MM-dd'));
    if (endDate)   cafeQuery = cafeQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

    // 주문번호를 note에서 파싱하는 헬퍼
    const parseOrderNo = (note, id, prefix) => {
      if (note) {
        const m = note.match(/20\d{6}-\d{7}/);
        if (m) return m[0];
      }
      return `${prefix}-${(id || '').toString().slice(0, 8).toUpperCase()}`;
    };

    const [shipRes, asRes, cafeRes, whRes, partsRes] = await Promise.all([
      shipQuery,
      asQuery,
      cafeQuery,
      supabase.from('warehouses').select('id, name'),
      supabase.from('parts').select('id, code, barcode, name, note, brand')
    ]);

    // 사전 창고 맵 생성
    const warehouseMap = {};
    (whRes.data || []).forEach(w => { warehouseMap[w.id] = w.name; });

    const formatCategory = (cat) => {
      if (!cat) return '기타';
      if (cat === '파츠') return '부품';
      return cat;
    };

    const partsMap = {};
    const partsByCode = {};
    const partsBrandMap = {};
    const partsBrandByCode = {};

    (partsRes.data || []).forEach(p => {
      const cat = formatCategory(p.note);
      const brand = p.brand || '-';
      if (p.name) {
        partsMap[p.name] = cat;
        partsBrandMap[p.name] = brand;
      }
      if (p.code) {
        partsByCode[p.code] = cat;
        partsBrandByCode[p.code] = brand;
      }
      if (p.barcode) {
        partsByCode[p.barcode] = cat;
        partsBrandByCode[p.barcode] = brand;
      }
    });

    const resolveCategory = (name, code = '') => {
      if (code && partsByCode[code]) return partsByCode[code];
      if (name && partsMap[name]) return partsMap[name];
      const n = (name || '').toLowerCase();
      if (n.includes('교환') || n.includes('수리') || n.includes('공임') || n.includes('출장') || n.includes('작업')) return '공임';
      if (n.includes('자전거') || n.includes('기체') || n.includes('완차') || n.includes('스쿠터')) return '기체';
      if (code && (code.startsWith('XRBP') || code.startsWith('NBP'))) return '부품';
      if (code && (code.startsWith('XRBS') || code.startsWith('NBS'))) return '공임';
      return '기타';
    };

    const resolveBrand = (name, code = '') => {
      if (code && partsBrandByCode[code]) return partsBrandByCode[code];
      if (name && partsBrandMap[name]) return partsBrandMap[name];
      return '-';
    };

    if (shipRes.error) console.error('Ship error:', shipRes.error);
    if (asRes.error) console.error('A/S error:', asRes.error);
    if (cafeRes.error) console.error('Cafe24 error:', cafeRes.error);

    // service_parts 개별 조회 (에러 시에도 기본 A/S 데이터는 표시되도록 분리)
    const asIds = (asRes.data || []).map(s => s.id);
    const servicePartsMap = {};
    if (asIds.length > 0) {
      const { data: spData, error: spErr } = await supabase
        .from('service_parts')
        .select('id, service_id, quantity, part_id, parts(name, price)')
        .in('service_id', asIds);
      if (spErr) console.warn('service_parts fetch error (non-critical):', spErr.message);
      (spData || []).forEach(sp => {
        if (!servicePartsMap[sp.service_id]) servicePartsMap[sp.service_id] = [];
        servicePartsMap[sp.service_id].push(sp);
      });
    }

    // Cafe24 연동 시 발생한 inventory_logs 를 통해 warehouse_id 역추적
    const cafeIds = (cafeRes.data || []).map(o => o.id);
    const cafeWarehouseMap = {};
    if (cafeIds.length > 0) {
      const { data: invData, error: invErr } = await supabase
        .from('inventory_logs')
        .select('reference_id, warehouse_id, part_code')
        .eq('reference_type', 'cafe24_order')
        .in('reference_id', cafeIds);
      if (!invErr) {
        (invData || []).forEach(log => {
          cafeWarehouseMap[log.reference_id] = log.warehouse_id;
          if (log.part_code) {
            cafeWarehouseMap[`${log.reference_id}_${log.part_code}`] = log.warehouse_id;
          }
        });
      }
    }

    // A/S 출고 시 발생한 transactions 를 통해 실 출고 창고 역추적
    const serviceTxMap = {};
    if (asIds.length > 0) {
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('group_id, product_id, from_location')
        .in('group_id', asIds.map(String))
        .eq('type', 'out');
      
      if (!txErr && txData) {
        txData.forEach(tx => {
           serviceTxMap[tx.group_id] = tx.from_location;
           if (tx.product_id) {
             serviceTxMap[`${tx.group_id}_${tx.product_id}`] = tx.from_location;
           }
        });
      }
    }

    const rows = [];

    // 출고 건 → 품목 단위로 펼치기
    (shipRes.data || []).forEach(s => {
      const parts = s.shipment_parts || [];
      const warehouseName = (s.warehouse_id && warehouseMap[s.warehouse_id]) || '-';
      const orderNo = parseOrderNo(s.note, s.id, 'SHP');
      const baseFields = {
        _orderId: s.id, _type: 'shipment',
        date_val: s.order_date,
        customer_name: s.customer_name || '-',
        sales_channel: s.sales_channel || '-',
        note: s.note || '',
        warehouse_name: warehouseName,
        order_no: orderNo,
      };
      if (parts.length === 0) {
        rows.push({ ...baseFields, _id: `ship_${s.id}_none`, part_name: '(품목 미기재)', part_category: '기타', quantity: 0, unit_price: 0, total_price: Number(s.price || 0) });
      } else {
        parts.forEach((p, idx) => {
          const total = Number(p.total_price || (Number(p.price || 0) * Number(p.quantity || 1)));
          const pName = p.part_name || '상품';
          const pCode = p.part_code || '';
          const cat = resolveCategory(pName, pCode);
          const brand = resolveBrand(pName, pCode);
          rows.push({ ...baseFields, _id: `ship_${s.id}_${p.id || idx}`, part_name: pName, part_category: cat, part_brand: brand, quantity: Number(p.quantity || 1), unit_price: Number(p.price || 0), total_price: total });
        });
      }
    });

    // A/S 건 → 품목 단위로 펼치기
    (asRes.data || []).forEach(s => {
      const parts = servicePartsMap[s.id] || [];
      const agencyName = s.agencies?.name || '고객';
      const orderNo = parseOrderNo(s.note, s.id, 'AS');
      
      const fallbackWhId = serviceTxMap[String(s.id)];
      const fallbackWhName = fallbackWhId && warehouseMap[fallbackWhId] ? warehouseMap[fallbackWhId] : '청담본점'; // A/S는 기본 청담

      const baseFields = {
        _orderId: s.id, _type: 'service',
        date_val: s.completion_date || s.reception_date,
        customer_name: s.customer_name || '-',
        sales_channel: agencyName,
        note: s.note || '',
        order_no: orderNo,
      };
      if (parts.length > 0) {
        parts.forEach((sp, idx) => {
          const unitPrice = Number(sp.parts?.price || 0);
          const qty = Number(sp.quantity || 1);
          const total = unitPrice * qty;
          if (qty > 0) {
            const pName = sp.parts?.name || '부품';
            const cat = resolveCategory(pName);
            const brand = resolveBrand(pName);
            
            let wid = serviceTxMap[`${s.id}_${sp.part_id}`];
            if (!wid) wid = fallbackWhId;
            let itemWarehouseName = fallbackWhName;
            if (wid && warehouseMap[wid]) itemWarehouseName = warehouseMap[wid];

            rows.push({ ...baseFields, warehouse_name: itemWarehouseName, _id: `as_${s.id}_${sp.id || idx}`, part_name: pName, part_category: cat, part_brand: brand, quantity: qty, unit_price: unitPrice, total_price: total });
          }
        });
      }
    });

    // 온라인 건 → 품목 단위로 펼치기
    (cafeRes.data || []).forEach(o => {
      const items = o.order_items || [];
      const orderNo = o.order_id;
      const fallbackWid = cafeWarehouseMap[o.id];
      const fallbackWarehouseName = fallbackWid && warehouseMap[fallbackWid] ? warehouseMap[fallbackWid] : '온라인출고';
      
      const baseFields = {
        _orderId: o.id, _type: 'cafe24',
        date_val: o.order_date,
        customer_name: o.buyer_name || '-',
        sales_channel: '온라인주문',
        note: o.status || '',
        order_no: orderNo,
      };

      if (items.length === 0) {
        rows.push({ ...baseFields, warehouse_name: fallbackWarehouseName, _id: `cafe_${o.id}_none`, part_name: '(품목 미기재)', part_category: '기타', part_brand: '-', quantity: 0, unit_price: 0, total_price: Number(o.total_amount || 0) });
      } else {
        items.forEach((item, idx) => {
          const itemCode = item.custom_product_code || item.product_code || '';
          let wid = item._warehouse_id || cafeWarehouseMap[`${o.id}_${itemCode}`];
          if (!wid) wid = fallbackWid;
          
          let itemWarehouseName = '온라인출고';
          if (wid === 'DEFAULT') itemWarehouseName = '청담본점';
          else if (wid && warehouseMap[wid]) itemWarehouseName = warehouseMap[wid];
          
          const pName = item.product_name || item.name || '상품';
          const itemQty = Number(item.quantity || 1);
          const iPrice = Number(item.product_price || item.price || 0);
          let shipFee = 0;
          if (idx === 0) {
            shipFee = Number(o.shipping_fee || 0);
            if (o.points_spent) shipFee -= Number(o.points_spent);
          }
          const total = (iPrice * itemQty) + shipFee;
          const cat = resolveCategory(pName, itemCode);
          const brand = resolveBrand(pName, itemCode);

          rows.push({ ...baseFields, warehouse_name: itemWarehouseName, _id: `cafe_${o.id}_${idx}`, part_name: pName, part_category: cat, part_brand: brand, quantity: itemQty, unit_price: iPrice, unit_shipping_fee: shipFee, total_price: total });
        });
      }
    });

    rows.sort((a, b) => new Date(b.date_val) - new Date(a.date_val));
    setFlatRows(rows);
    setLoading(false);
  };

  // ── 필터 ────────────────────────────────────────────
  const filtered = flatRows.filter(r => {
    if (filterType !== 'all' && r._type !== filterType) return false;

    return (
      (r.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.sales_channel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.part_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.note || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // ── 합계 계산 ────────────────────────────────────────
  const totalAmt   = filtered.reduce((a, r) => a + Number(r.total_price || 0), 0);
  const totalSupply = Math.round(totalAmt / 1.1);
  const totalVat   = totalAmt - totalSupply;
  const totalQty   = filtered.reduce((a, r) => a + Number(r.quantity || 0), 0);

  // ── 월별 합계 계산 ───────────────────────────────────
  const monthlyTotals = {};
  filtered.forEach(r => {
    if (!r.date_val) return;
    const monthKey = format(new Date(r.date_val), 'yyyy/MM');
    if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = { qty: 0, supply: 0, vat: 0, total: 0 };
    const { supply, vat } = calcVAT(r.total_price);
    monthlyTotals[monthKey].qty    += Number(r.quantity || 0);
    monthlyTotals[monthKey].supply += supply;
    monthlyTotals[monthKey].vat    += vat;
    monthlyTotals[monthKey].total  += Number(r.total_price || 0);
  });

  // ── 페이지네이션 ─────────────────────────────────────
  // 월별 합계 행을 삽입한 렌더 목록 생성
  const renderRows = [];
  let prevMonth = null;
  filtered.forEach(r => {
    const month = r.date_val ? format(new Date(r.date_val), 'yyyy/MM') : '';
    if (prevMonth && month !== prevMonth) {
      renderRows.push({ _isMonthSummary: true, _month: prevMonth, ...monthlyTotals[prevMonth] });
    }
    renderRows.push(r);
    prevMonth = month;
  });
  if (prevMonth) {
    renderRows.push({ _isMonthSummary: true, _month: prevMonth, ...monthlyTotals[prevMonth] });
  }

  const paginated = renderRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // ── 행 클릭 ─────────────────────────────────────────
  const handleRowClick = (row) => {
    if (row._isMonthSummary) return;
    setEditTarget({ id: row._orderId, type: row._type });
    setEditOpen(true);
  };

  return (
    <Box>
      {/* 제목 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">판매 현황 (품목 내역)</Typography>
      </Box>

      {/* 요약 카드 */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
            <AssessmentIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="body2" color="textSecondary">총 판매액 (합계)</Typography>
              <Typography variant="h5" fontWeight="bold">{totalAmt.toLocaleString()}원</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f3e5f5', borderRadius: 2 }}>
            <AssessmentIcon color="secondary" fontSize="large" />
            <Box>
              <Typography variant="body2" color="textSecondary">공급가 합계</Typography>
              <Typography variant="h5" fontWeight="bold">{totalSupply.toLocaleString()}원</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#e8f5e9', borderRadius: 2 }}>
            <AssessmentIcon sx={{ color: '#2e7d32' }} fontSize="large" />
            <Box>
              <Typography variant="body2" color="textSecondary">부가세 합계</Typography>
              <Typography variant="h5" fontWeight="bold">{totalVat.toLocaleString()}원</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* 검색/기간 필터 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>구분</InputLabel>
            <Select
              value={filterType}
              label="구분"
              onChange={e => setFilterType(e.target.value)}
            >
              <MenuItem value="all">전체보기</MenuItem>
              <MenuItem value="cafe24">온라인주문</MenuItem>
              <MenuItem value="shipment">매장출고</MenuItem>
              <MenuItem value="service">A/S</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="고객/채널/품목/메모 검색"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{ width: 260 }}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DatePicker
              label="시작일"
              value={startDate}
              onChange={v => setStartDate(v)}
              slotProps={{ textField: { size: 'small', sx: { width: 145 } } }}
            />
            <Typography>~</Typography>
            <DatePicker
              label="종료일"
              value={endDate}
              onChange={v => setEndDate(v)}
              slotProps={{ textField: { size: 'small', sx: { width: 145 } } }}
            />
          </LocalizationProvider>
          <Button variant="contained" onClick={fetchSales}>검색/새로고침</Button>
          <Button variant="outlined" color="secondary" onClick={() => { setStartDate(null); setEndDate(null); setSearchTerm(''); setFilterType('all'); }}>
            초기화
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button 
            variant="text" 
            color="primary" 
            onClick={() => setShowTaxDetails(!showTaxDetails)}
            sx={{ fontWeight: 'bold' }}
          >
            {showTaxDetails ? '공급가/부가세 숨기기' : '공급가/부가세 보기'}
          </Button>
        </Box>
      </Paper>

      {/* 테이블 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#3f51b5' }}>
              {['일자', '구분', '고객명/거래처명', '출고창고', '주문번호', '품목구분', '브랜드', '품목명', '수량', '단가'].map(h => (
                <TableCell key={h} sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: h === '출고창고' || h === '주문번호' || h === '품목구분' || h === '브랜드' ? 'center' : 'left' }}>{h}</TableCell>
              ))}
              {showTaxDetails && <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>공급가액</TableCell>}
              {showTaxDetails && <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>부가세</TableCell>}
              <TableCell sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>합계</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showTaxDetails ? 13 : 11} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showTaxDetails ? 13 : 11} align="center" sx={{ py: 5 }}>조회된 판매 내역이 없습니다.</TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => {
                // 월별 합계 행
                if (row._isMonthSummary) {
                  return (
                    <TableRow key={`month_${row._month}_${idx}`} sx={{ bgcolor: '#e8eaf6' }}>
                      <TableCell colSpan={8} sx={{ fontWeight: 'bold', color: '#3f51b5', textAlign: 'center' }}>{row._month} 계</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>{row.qty.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                      {showTaxDetails && <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>{row.supply.toLocaleString()}</TableCell>}
                      {showTaxDetails && <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>{row.vat.toLocaleString()}</TableCell>}
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1565c0' }}>{row.total.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                }

                const { supply, vat } = calcVAT(row.total_price);
                const isService = row._type === 'service';
                const isCafe = row._type === 'cafe24';
                const catColor = {
                  bg: row.part_category === '기체' ? '#e3f2fd' : row.part_category === '부품' ? '#f3e5f5' : row.part_category === '공임' ? '#e8f5e9' : '#f5f5f5',
                  text: row.part_category === '기체' ? '#1976d2' : row.part_category === '부품' ? '#7b1fa2' : row.part_category === '공임' ? '#2e7d32' : '#616161'
                };

                return (
                  <TableRow
                    key={row._id}
                    hover
                    onClick={() => handleRowClick(row)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f0f4ff' } }}
                  >
                    <TableCell sx={{ color: '#1976d2', whiteSpace: 'nowrap' }}>
                      {row.date_val ? format(new Date(row.date_val), 'yyyy-MM-dd') : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={isCafe ? '온라인주문' : (isService ? 'A/S' : '매장출고')}
                        color={isCafe ? 'success' : (isService ? 'warning' : 'primary')}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{row.customer_name}</span>
                        {row.sales_channel && row.sales_channel !== '-' && row.sales_channel !== '온라인주문' && (
                          <span style={{ fontSize: '0.73rem', color: '#6b7280', fontWeight: 'normal' }}>{row.sales_channel}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{row.warehouse_name}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.78rem', color: '#1565c0', whiteSpace: 'nowrap' }}>{row.order_no}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        size="small" 
                        label={row.part_category} 
                        sx={{ bgcolor: catColor.bg, color: catColor.text, fontWeight: 'bold', minWidth: 50 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', color: '#555' }}>
                      {row.part_brand || '-'}
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Typography variant="body2">{row.part_name}</Typography>
                      {row.unit_shipping_fee > 0 && <Typography variant="caption" color="textSecondary">배송비 포함</Typography>}
                    </TableCell>
                    <TableCell align="right">{Number(row.quantity).toLocaleString()}</TableCell>
                    <TableCell align="right">{Number(row.unit_price).toLocaleString()}</TableCell>
                    {showTaxDetails && <TableCell align="right">{supply.toLocaleString()}</TableCell>}
                    {showTaxDetails && <TableCell align="right">{vat.toLocaleString()}</TableCell>}
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {Number(row.total_price).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}

            {/* 전체 합계 푸터 */}
            {!loading && filtered.length > 0 && (
              <TableRow sx={{ bgcolor: '#fff3e0', '& td': { fontWeight: 'bold', fontSize: '0.9rem' } }}>
                <TableCell colSpan={7} align="right" sx={{ color: 'text.secondary' }}>총합계</TableCell>
                <TableCell align="right">{totalQty.toLocaleString()}</TableCell>
                <TableCell></TableCell>
                {showTaxDetails && <TableCell align="right">{totalSupply.toLocaleString()}</TableCell>}
                {showTaxDetails && <TableCell align="right">{totalVat.toLocaleString()}</TableCell>}
                <TableCell align="right" sx={{ color: '#c62828', fontSize: '1rem' }}>
                  {totalAmt.toLocaleString()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 페이지네이션 */}
      <TablePagination
        component="div"
        count={renderRows.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        labelRowsPerPage="페이지당 행:"
        rowsPerPageOptions={[20, 30, 50, 100]}
      />

      {/* 판매 수정 모달 */}
      <SalesEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        orderId={editTarget.id}
        orderType={editTarget.type}
        onRefresh={fetchSales}
      />
    </Box>
  );
}

export default SalesHistory;
