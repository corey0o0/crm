import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  ButtonGroup,
  CircularProgress,
  Card,
  CardContent,
  Tabs,
  Tab,
  Stack,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import SearchIcon from '@mui/icons-material/Search';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, getMonth } from 'date-fns';
import { computeOnlineAgencyStats } from '../../utils/onlineAgencyStats';
import { normalizeAirframeModelName } from '../../utils/airframeModelNormalize';

// SalesStats.jsx의 판매처 판정 로직과 동일 - 매장(B2C) 채널 목록. 이 목록에 없는 채널명은
// 대리점명 텍스트로 간주하고, 실제 등록된 agencies.name과 정확히 일치할 때만 집계한다.
const B2C_CHANNELS = ['공홈', '청담매장', '라이클', '라이클-우리', '스마트할부', '스마트스토어', '기타', '온라인주문', '고객', '-', '본사/기본', '과거 이카운트 이관', '일반출고(공홈)', '매장출고', '본점', '매장'];

const extractSalesChannel = (note, salesChannelField) => {
  if (salesChannelField && salesChannelField.trim() !== '') {
    return salesChannelField.trim();
  }
  if (note) {
    const match = note.match(/\[판매처:\s*(.*?)\]/);
    if (match && match[1]) return match[1].trim();
  }
  return '';
};

// SalesStats.jsx의 resolvePartCategory와 동일 - part_category가 없으면 이름 키워드로 추정
const resolvePartCategory = (category, name) => {
  if (category) return category;
  const n = (name || '').toLowerCase();
  if (n.includes('공임') || n.includes('수리') || n.includes('교환') || n.includes('출장') || n.includes('작업')) return '공임';
  if (n.includes('기체') || n.includes('차체') || n.includes('완차') || n.includes('스쿠터') || n.includes('전기자전거')) return '기체';
  return '부품';
};

const ONLINE_EXCLUDED_KEYS = ['일반 주문', '미등록 대리점'];

const emptyBucket = () => ({ offlineAmount: 0, onlineAmount: 0, airframeAmount: 0, partsAmount: 0, airframeQty: 0, partsQty: 0, offlineCount: 0, onlineCount: 0 });

function AgencySalesStats() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(getMonth(new Date()));
  const [selectedQuarter, setSelectedQuarter] = useState(null); // 1~4 | null
  const [agencyStats, setAgencyStats] = useState({});
  // 기종 x 대리점: offline/online 수량·매출 분리
  const [modelStats, setModelStats] = useState([]);
  // 파츠 상품 x 대리점: 상세 모달용
  const [partsStats, setPartsStats] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [topN, setTopN] = useState(10);
  const [modelSearch, setModelSearch] = useState('');
  // amount | qty | offlineAmount | onlineAmount
  const [modelSort, setModelSort] = useState('amount');
  // SalesStats와 동일: 전체 / XRB / NB
  const brandOptions = ['전체', 'XRB', 'NB'];
  const [brand, setBrand] = useState('전체');
  // 기체/파츠 순위 클릭 상세
  const [detailModal, setDetailModal] = useState({
    open: false,
    title: '',
    kind: 'airframe', // airframe | parts
    agency: '',
    rows: [],
  });

  const formatDateToStartOfDay = (date) => format(date, 'yyyy-MM-dd') + 'T00:00:00+09:00';
  const formatDateToEndOfDay = (date) => format(date, 'yyyy-MM-dd') + 'T23:59:59+09:00';

  const formatCurrency = (value) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value || 0);

  const fetchData = async (qStart, qEnd, qBrand = brand) => {
    setLoading(true);
    try {
      const startDateTime = formatDateToStartOfDay(qStart || startDate);
      const endDateTime = formatDateToEndOfDay(qEnd || endDate);

      const { data: agencies, error: agencyError } = await supabase.from('agencies').select('id, name');
      if (agencyError) throw agencyError;
      const agencyNames = new Set((agencies || []).map(a => a.name));

      const merged = {};
      const ensureBucket = (name) => {
        if (!merged[name]) merged[name] = emptyBucket();
        return merged[name];
      };

      // ---------- 오프라인(수기 출고) — 브랜드 필터는 shipments.brand 기준 (SalesStats와 동일) ----------
      let shipmentQuery = supabase
        .from('shipments')
        .select('id, order_date, customer_name, sales_channel, note, status, brand')
        .gte('order_date', startDateTime)
        .lte('order_date', endDateTime)
        .in('status', ['출고완료', '완료']);
      if (qBrand !== '전체') {
        shipmentQuery = shipmentQuery.eq('brand', qBrand);
      }
      const { data: shipments, error: shipmentError } = await shipmentQuery;
      if (shipmentError) throw shipmentError;

      const agencyShipments = (shipments || []).filter(s => {
        const channel = extractSalesChannel(s.note, s.sales_channel);
        return channel && !B2C_CHANNELS.includes(channel) && agencyNames.has(channel);
      });

      const shipmentAgencyMap = {};
      agencyShipments.forEach(s => {
        shipmentAgencyMap[s.id] = extractSalesChannel(s.note, s.sales_channel);
      });

      const offlineModelStats = {}; // { [agencyName]: { [modelName]: { qty, amount } } } - 기체만
      const offlinePartsStats = {}; // { [agencyName]: { [partName]: { qty, amount } } }

      const shipmentIds = agencyShipments.map(s => s.id);
      if (shipmentIds.length > 0) {
        const { data: shipmentParts, error: partsError } = await supabase
          .from('shipment_parts')
          .select('shipment_id, part_name, part_category, quantity, price, note')
          .in('shipment_id', shipmentIds);
        if (partsError) throw partsError;

        const shipmentsWithRevenue = new Set();
        (shipmentParts || []).forEach(part => {
          const agencyName = shipmentAgencyMap[part.shipment_id];
          if (!agencyName) return;

          // 반품 수량 차감 (SalesStats.jsx와 동일 로직)
          let returnedQty = 0;
          if (part.note && part.note.includes('[반품완료]')) {
            returnedQty = part.quantity;
          } else if (part.note && part.note.includes('[부분반품:')) {
            const matches = part.note.match(/\[부분반품:(\d+)개\]/g);
            if (matches) {
              matches.forEach(m => {
                const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
                if (qtyMatch && qtyMatch[1]) returnedQty += parseInt(qtyMatch[1], 10);
              });
            }
          }
          const effectiveQty = Math.max(0, (part.quantity || 0) - returnedQty);
          if (effectiveQty === 0) return;
          const effectiveTotal = Math.round(effectiveQty * (part.price || 0));

          const category = resolvePartCategory(part.part_category, part.part_name);
          const isAirframe = category === '기체';

          const bucket = ensureBucket(agencyName);
          bucket.offlineAmount += effectiveTotal;
          if (isAirframe) {
            bucket.airframeAmount += effectiveTotal;
            bucket.airframeQty += effectiveQty;

            // 색상·N대·한영 별칭을 표준 기종명으로 합침 (온라인과 동일 규칙)
            const modelName = normalizeAirframeModelName(part.part_name || '알 수 없는 기체');
            if (!offlineModelStats[agencyName]) offlineModelStats[agencyName] = {};
            if (!offlineModelStats[agencyName][modelName]) offlineModelStats[agencyName][modelName] = { qty: 0, amount: 0 };
            offlineModelStats[agencyName][modelName].qty += effectiveQty;
            offlineModelStats[agencyName][modelName].amount += effectiveTotal;
          } else {
            bucket.partsAmount += effectiveTotal;
            bucket.partsQty += effectiveQty;

            const partName = (part.part_name || '기타 파츠').trim() || '기타 파츠';
            if (!offlinePartsStats[agencyName]) offlinePartsStats[agencyName] = {};
            if (!offlinePartsStats[agencyName][partName]) offlinePartsStats[agencyName][partName] = { qty: 0, amount: 0 };
            offlinePartsStats[agencyName][partName].qty += effectiveQty;
            offlinePartsStats[agencyName][partName].amount += effectiveTotal;
          }
          shipmentsWithRevenue.add(part.shipment_id);
        });

        shipmentsWithRevenue.forEach(shipmentId => {
          const agencyName = shipmentAgencyMap[shipmentId];
          if (agencyName) ensureBucket(agencyName).offlineCount += 1;
        });
      }

      // ---------- 온라인(cafe24 주문) ----------
      const { data: orders, error: orderError } = await supabase
        .from('cafe24_orders')
        .select('*')
        .gte('order_date', startDateTime)
        .lte('order_date', endDateTime)
        .eq('is_deleted', false)
        .eq('is_transferred', true);
      if (orderError) throw orderError;

      const { data: parts, error: partError } = await supabase
        .from('parts')
        .select('id, code, barcode, brand, note, price, name');
      if (partError) throw partError;

      const {
        agencyStats: onlineAgencyStats,
        agencyModelStats: onlineModelStats,
        agencyPartsStats: onlinePartsStats = {},
      } = computeOnlineAgencyStats({ orders: orders || [], agencies: agencies || [], parts: parts || [], brand: qBrand });

      Object.entries(onlineAgencyStats).forEach(([agencyName, data]) => {
        if (ONLINE_EXCLUDED_KEYS.includes(agencyName)) return; // 미등록/일반 주문은 대리점 순위에서 제외
        if (!data.amount && !data.airframeAmount && !data.partsAmount) return;
        const bucket = ensureBucket(agencyName);
        bucket.onlineAmount += data.amount;
        bucket.airframeAmount += data.airframeAmount;
        bucket.partsAmount += data.partsAmount;
        bucket.airframeQty += data.airframe;
        bucket.partsQty += data.parts;
        bucket.onlineCount += data.count;
      });

      setAgencyStats(merged);

      // ---------- 기종(기체 모델) x 대리점 쌍 집계 (오프/온 분리 병합) ----------
      const modelMerged = {}; // key: agency__model
      const ensureModelRow = (agencyName, modelName) => {
        const key = `${agencyName}__${modelName}`;
        if (!modelMerged[key]) {
          modelMerged[key] = {
            model: modelName,
            agency: agencyName,
            offlineQty: 0,
            offlineAmount: 0,
            onlineQty: 0,
            onlineAmount: 0,
          };
        }
        return modelMerged[key];
      };
      Object.entries(offlineModelStats).forEach(([agencyName, models]) => {
        if (ONLINE_EXCLUDED_KEYS.includes(agencyName)) return;
        Object.entries(models).forEach(([modelName, d]) => {
          const row = ensureModelRow(agencyName, modelName);
          row.offlineQty += d.qty;
          row.offlineAmount += d.amount;
        });
      });
      Object.entries(onlineModelStats || {}).forEach(([agencyName, models]) => {
        if (ONLINE_EXCLUDED_KEYS.includes(agencyName)) return;
        Object.entries(models).forEach(([modelName, d]) => {
          const row = ensureModelRow(agencyName, modelName);
          row.onlineQty += d.qty;
          row.onlineAmount += d.amount;
        });
      });
      setModelStats(
        Object.values(modelMerged).map((r) => ({
          ...r,
          qty: r.offlineQty + r.onlineQty,
          amount: r.offlineAmount + r.onlineAmount,
        }))
      );

      // ---------- 파츠 상품 x 대리점 집계 (상세 모달용) ----------
      const partsMerged = {}; // key: agency__part
      const ensurePartsRow = (agencyName, partName) => {
        const key = `${agencyName}__${partName}`;
        if (!partsMerged[key]) {
          partsMerged[key] = {
            partName,
            agency: agencyName,
            offlineQty: 0,
            offlineAmount: 0,
            onlineQty: 0,
            onlineAmount: 0,
          };
        }
        return partsMerged[key];
      };
      Object.entries(offlinePartsStats).forEach(([agencyName, items]) => {
        if (ONLINE_EXCLUDED_KEYS.includes(agencyName)) return;
        Object.entries(items).forEach(([partName, d]) => {
          const row = ensurePartsRow(agencyName, partName);
          row.offlineQty += d.qty;
          row.offlineAmount += d.amount;
        });
      });
      Object.entries(onlinePartsStats || {}).forEach(([agencyName, items]) => {
        if (ONLINE_EXCLUDED_KEYS.includes(agencyName)) return;
        Object.entries(items).forEach(([partName, d]) => {
          const row = ensurePartsRow(agencyName, partName);
          row.onlineQty += d.qty;
          row.onlineAmount += d.amount;
        });
      });
      setPartsStats(
        Object.values(partsMerged).map((r) => ({
          ...r,
          qty: r.offlineQty + r.onlineQty,
          amount: r.offlineAmount + r.onlineAmount,
        }))
      );
    } catch (err) {
      console.error('대리점 매출 통계 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(startDate, endDate, brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeYear = selectedYear ?? currentYear;

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    const newStartDate = startOfYear(new Date(year, 0, 1));
    const newEndDate = endOfYear(new Date(year, 11, 31));
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setSelectedMonth(null);
    setSelectedQuarter(null);
    fetchData(newStartDate, newEndDate, brand);
  };

  const handleQuarterSelect = (quarter) => {
    const year = activeYear;
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;
    const newStartDate = startOfMonth(new Date(year, startMonth, 1));
    const newEndDate = endOfMonth(new Date(year, endMonth, 1));
    setSelectedYear(year);
    setSelectedQuarter(quarter);
    setSelectedMonth(null);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    fetchData(newStartDate, newEndDate, brand);
  };

  const handleMonthSelect = (monthIndex) => {
    const year = activeYear;
    const newDate = new Date(year, monthIndex, 1);
    const newStartDate = startOfMonth(newDate);
    const newEndDate = endOfMonth(newDate);
    setSelectedYear(year);
    setSelectedMonth(monthIndex);
    setSelectedQuarter(null);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    fetchData(newStartDate, newEndDate, brand);
  };

  const handleCustomDateSearch = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedQuarter(null);
    fetchData(startDate, endDate, brand);
  };

  const handleBrandSelect = (option) => {
    setBrand(option);
    setDetailModal((prev) => ({ ...prev, open: false }));
    fetchData(startDate, endDate, option);
  };

  const openAgencyDetail = (agencyName, kind) => {
    if (kind === 'airframe') {
      const rows = modelStats
        .filter((r) => r.agency === agencyName && ((r.qty || 0) > 0 || (r.amount || 0) > 0))
        .map((r) => ({
          name: r.model,
          qty: r.qty || 0,
          amount: r.amount || 0,
          offlineQty: r.offlineQty || 0,
          offlineAmount: r.offlineAmount || 0,
          onlineQty: r.onlineQty || 0,
          onlineAmount: r.onlineAmount || 0,
        }))
        .sort((a, b) => b.amount - a.amount || b.qty - a.qty || String(a.name).localeCompare(String(b.name), 'ko'));
      setDetailModal({
        open: true,
        title: `${agencyName} — 기체 상세`,
        kind: 'airframe',
        agency: agencyName,
        rows,
      });
      return;
    }
    const rows = partsStats
      .filter((r) => r.agency === agencyName && ((r.qty || 0) > 0 || (r.amount || 0) > 0))
      .map((r) => ({
        name: r.partName,
        qty: r.qty || 0,
        amount: r.amount || 0,
        offlineQty: r.offlineQty || 0,
        offlineAmount: r.offlineAmount || 0,
        onlineQty: r.onlineQty || 0,
        onlineAmount: r.onlineAmount || 0,
      }))
      .sort((a, b) => b.amount - a.amount || b.qty - a.qty || String(a.name).localeCompare(String(b.name), 'ko'));
    setDetailModal({
      open: true,
      title: `${agencyName} — 파츠 상세`,
      kind: 'parts',
      agency: agencyName,
      rows,
    });
  };

  const clickableCellSx = {
    cursor: 'pointer',
    color: 'primary.main',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    '&:hover': { bgcolor: 'action.hover' },
  };

  const rows = Object.entries(agencyStats).map(([name, d]) => ({
    name,
    totalAmount: d.offlineAmount + d.onlineAmount,
    ...d
  }));

  const sortKeyByTab = tabValue === 1 ? 'airframeAmount' : tabValue === 2 ? 'partsAmount' : 'totalAmount';
  const sortedRows = [...rows]
    .filter(r => r[sortKeyByTab] > 0)
    .sort((a, b) => b[sortKeyByTab] - a[sortKeyByTab]);
  const displayRows = topN === 'all' ? sortedRows : sortedRows.slice(0, topN);

  // 기종 → 하위 대리점 목록 (기종 순위 + 기종 내 대리점 순위)
  // 예) 블레이드
  //       - 강남청담점 / 3대 / ₩…
  //       - 코디바이크 / 1대 / ₩…
  const displayModelGroups = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    const filtered = modelStats.filter((r) => {
      if (r.amount <= 0 && r.qty <= 0) return false;
      if (!q) return true;
      return (
        (r.model || '').toLowerCase().includes(q) ||
        (r.agency || '').toLowerCase().includes(q)
      );
    });

    const sortKey = modelSort === 'qty'
      ? 'qty'
      : modelSort === 'offlineAmount'
        ? 'offlineAmount'
        : modelSort === 'onlineAmount'
          ? 'onlineAmount'
          : 'amount';

    const byModel = {};
    filtered.forEach((r) => {
      const m = r.model || '알 수 없는 기체';
      if (!byModel[m]) {
        byModel[m] = {
          model: m,
          qty: 0,
          amount: 0,
          offlineQty: 0,
          offlineAmount: 0,
          onlineQty: 0,
          onlineAmount: 0,
          dealers: [],
        };
      }
      const g = byModel[m];
      g.qty += r.qty || 0;
      g.amount += r.amount || 0;
      g.offlineQty += r.offlineQty || 0;
      g.offlineAmount += r.offlineAmount || 0;
      g.onlineQty += r.onlineQty || 0;
      g.onlineAmount += r.onlineAmount || 0;
      g.dealers.push(r);
    });

    const groups = Object.values(byModel).map((g) => {
      const dealers = [...g.dealers].sort((a, b) => {
        const diff = (b[sortKey] || 0) - (a[sortKey] || 0);
        if (diff !== 0) return diff;
        const amt = (b.amount || 0) - (a.amount || 0);
        if (amt !== 0) return amt;
        return String(a.agency).localeCompare(String(b.agency), 'ko');
      });
      return { ...g, dealers };
    });

    groups.sort((a, b) => {
      const diff = (b[sortKey] || 0) - (a[sortKey] || 0);
      if (diff !== 0) return diff;
      const amt = (b.amount || 0) - (a.amount || 0);
      if (amt !== 0) return amt;
      return String(a.model).localeCompare(String(b.model), 'ko');
    });

    return topN === 'all' ? groups : groups.slice(0, topN);
  }, [modelStats, modelSearch, modelSort, topN]);

  const grandTotal = rows.reduce((acc, r) => ({
    offlineAmount: acc.offlineAmount + r.offlineAmount,
    onlineAmount: acc.onlineAmount + r.onlineAmount,
    totalAmount: acc.totalAmount + r.totalAmount
  }), { offlineAmount: 0, onlineAmount: 0, totalAmount: 0 });

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>대리점 매출 통계</Typography>

        <Paper sx={{ p: 3, mb: 3, borderLeft: '4px solid #3182f6' }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#3182f6' }}>검색 필터</Typography>
          <Stack spacing={1}>
            {/* 날짜: 연도 → 분기 → 월 (위→아래, 라벨 없음) */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i).map((year) => (
                  <Button
                    key={year}
                    onClick={() => handleYearSelect(year)}
                    variant={selectedYear === year ? 'contained' : 'outlined'}
                  >
                    {year}년
                  </Button>
                ))}
              </ButtonGroup>
              {selectedQuarter != null && selectedYear != null && (
                <Box
                  component="span"
                  sx={{
                    py: 0.25,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: '#e3f2fd',
                    fontSize: '0.85rem',
                    color: '#1976d2',
                  }}
                >
                  {selectedYear}년 {selectedQuarter}분기
                </Box>
              )}
            </Stack>

            <ButtonGroup size="small" variant="outlined">
              {[1, 2, 3, 4].map((q) => (
                <Button
                  key={q}
                  onClick={() => handleQuarterSelect(q)}
                  variant={selectedQuarter === q ? 'contained' : 'outlined'}
                >
                  {q}분기
                </Button>
              ))}
            </ButtonGroup>

            <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {Array.from({ length: 12 }, (_, i) => i).map((idx) => (
                <Button
                  key={idx}
                  onClick={() => handleMonthSelect(idx)}
                  variant={selectedMonth === idx ? 'contained' : 'outlined'}
                >
                  {idx + 1}월
                </Button>
              ))}
            </ButtonGroup>

            {/* 기간 직접 지정 + 브랜드 */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              alignItems={{ xs: 'stretch', sm: 'flex-end' }}
              flexWrap="wrap"
              sx={{ pt: 0.5 }}
            >
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>기간(일 단위) 직접 지정</Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <DatePicker
                    label="시작일"
                    value={startDate}
                    onChange={setStartDate}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <Typography>~</Typography>
                  <DatePicker
                    label="종료일"
                    value={endDate}
                    onChange={setEndDate}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <Button variant="contained" size="small" onClick={handleCustomDateSearch}>조회</Button>
                </Stack>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>브랜드</Typography>
                <ButtonGroup size="small" variant="outlined">
                  {brandOptions.map((option) => (
                    <Button
                      key={option}
                      onClick={() => handleBrandSelect(option)}
                      variant={brand === option ? 'contained' : 'outlined'}
                    >
                      {option}
                    </Button>
                  ))}
                </ButtonGroup>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card><CardContent>
                  <Typography variant="body2" color="textSecondary">대리점 총 매출</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{formatCurrency(grandTotal.totalAmount)}</Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card><CardContent>
                  <Typography variant="body2" color="textSecondary">오프라인(수기 출고) 매출</Typography>
                  <Typography variant="h5">{formatCurrency(grandTotal.offlineAmount)}</Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card><CardContent>
                  <Typography variant="body2" color="textSecondary">온라인(카페24) 매출</Typography>
                  <Typography variant="h5">{formatCurrency(grandTotal.onlineAmount)}</Typography>
                </CardContent></Card>
              </Grid>
            </Grid>

            <Paper sx={{ borderRadius: 2 }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ px: 2, pt: 1 }}>
                <Tab label="대리점별 매출 순위" />
                <Tab label="기체기준 순위" />
                <Tab label="파츠기준 순위" />
                <Tab label="기종별 매출처 현황" />
              </Tabs>
              {(tabValue === 1 || tabValue === 2) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1 }}>
                  {tabValue === 1
                    ? '기체 수량·매출 숫자를 클릭하면 해당 대리점의 기종별 상세를 볼 수 있습니다.'
                    : '파츠 수량·매출 숫자를 클릭하면 해당 대리점의 파츠 상품별 상세를 볼 수 있습니다.'}
                </Typography>
              )}
              {tabValue === 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1 }}>
                  한 기종 기준으로 매출처(대리점)별 주문 수량·매출을 펼쳐 보여줍니다.
                  예: 블레이드 → 강남청담점 / 3대 / 매출, 코디바이크 / 1대 / 매출 …
                  기종명은 색상·표기 차이를 표준화해 합산합니다. (X200MAX 블랙 → X200 MAX 등)
                </Typography>
              )}
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                {tabValue === 3 ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ flex: 1, minWidth: 0 }}>
                    <TextField
                      size="small"
                      placeholder="기종·매출처 검색"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      sx={{ minWidth: 200, maxWidth: 320 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel id="model-sort-label">정렬</InputLabel>
                      <Select
                        labelId="model-sort-label"
                        label="정렬"
                        value={modelSort}
                        onChange={(e) => setModelSort(e.target.value)}
                      >
                        <MenuItem value="amount">총 매출</MenuItem>
                        <MenuItem value="qty">총 수량</MenuItem>
                        <MenuItem value="offlineAmount">오프라인 매출</MenuItem>
                        <MenuItem value="onlineAmount">온라인 매출</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                ) : (
                  <Box sx={{ flex: 1 }} />
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="textSecondary">표시 개수</Typography>
                  <Select size="small" value={topN} onChange={(e) => setTopN(e.target.value)} sx={{ width: 100 }}>
                    <MenuItem value={5}>TOP 5</MenuItem>
                    <MenuItem value={10}>TOP 10</MenuItem>
                    <MenuItem value={20}>TOP 20</MenuItem>
                    <MenuItem value="all">전체</MenuItem>
                  </Select>
                </Stack>
              </Box>
              <TableContainer sx={{ p: 2, pt: 0, overflowX: 'auto' }}>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  {tabValue === 3 ? (
                    <>
                      <TableHead sx={{ bgcolor: 'grey.100' }}>
                        <TableRow>
                          <TableCell width={56} rowSpan={2}>순위</TableCell>
                          <TableCell rowSpan={2}>기종 / 매출처</TableCell>
                          <TableCell align="center" colSpan={2} sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>전체</TableCell>
                          <TableCell align="center" colSpan={2} sx={{ fontWeight: 'bold', bgcolor: '#eef6ff' }}>오프라인</TableCell>
                          <TableCell align="center" colSpan={2} sx={{ fontWeight: 'bold', bgcolor: '#f3eefc' }}>온라인</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>수량</TableCell>
                          <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>매출</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>수량</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>매출</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>수량</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>매출</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayModelGroups.length > 0 ? displayModelGroups.map((group, gIdx) => (
                          <React.Fragment key={`model-${group.model}`}>
                            {/* 기종 헤더: 합계 */}
                            <TableRow sx={{ bgcolor: '#f0f4f8' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>{gIdx + 1}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>{group.model}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>
                                {(group.qty || 0).toLocaleString()}대
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>
                                {formatCurrency(group.amount)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#eef6ff' }}>
                                {(group.offlineQty || 0).toLocaleString()}대
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#eef6ff' }}>
                                {formatCurrency(group.offlineAmount)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f3eefc' }}>
                                {(group.onlineQty || 0).toLocaleString()}대
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f3eefc' }}>
                                {formatCurrency(group.onlineAmount)}
                              </TableCell>
                            </TableRow>
                            {/* 하위 대리점 */}
                            {group.dealers.map((row) => (
                              <TableRow key={`${group.model}__${row.agency}`} hover>
                                <TableCell />
                                <TableCell sx={{ pl: 4, color: 'text.secondary' }}>
                                  ㄴ {row.agency}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>
                                  {(row.qty || 0).toLocaleString()}대
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>
                                  {formatCurrency(row.amount)}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>
                                  {(row.offlineQty || 0).toLocaleString()}대
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>
                                  {formatCurrency(row.offlineAmount)}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>
                                  {(row.onlineQty || 0).toLocaleString()}대
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>
                                  {formatCurrency(row.onlineAmount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              {modelSearch.trim() ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </>
                  ) : (
                    <>
                      <TableHead sx={{ bgcolor: 'grey.100' }}>
                        <TableRow>
                          <TableCell width={60}>순위</TableCell>
                          <TableCell>대리점명</TableCell>
                          {tabValue === 0 && <>
                            <TableCell align="right">오프라인 매출</TableCell>
                            <TableCell align="right">온라인 매출</TableCell>
                            <TableCell align="right">총 매출</TableCell>
                          </>}
                          {tabValue === 1 && <>
                            <TableCell align="right">기체 수량</TableCell>
                            <TableCell align="right">기체 매출</TableCell>
                          </>}
                          {tabValue === 2 && <>
                            <TableCell align="right">파츠 수량</TableCell>
                            <TableCell align="right">파츠 매출</TableCell>
                          </>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayRows.length > 0 ? displayRows.map((row, idx) => (
                          <TableRow key={row.name} hover>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            {tabValue === 0 && <>
                              <TableCell align="right">{formatCurrency(row.offlineAmount)}</TableCell>
                              <TableCell align="right">{formatCurrency(row.onlineAmount)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(row.totalAmount)}</TableCell>
                            </>}
                            {tabValue === 1 && <>
                              <TableCell
                                align="right"
                                sx={clickableCellSx}
                                onClick={() => openAgencyDetail(row.name, 'airframe')}
                                title="클릭 시 기종별 상세"
                              >
                                {row.airframeQty.toLocaleString()}대
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ ...clickableCellSx, fontWeight: 'bold' }}
                                onClick={() => openAgencyDetail(row.name, 'airframe')}
                                title="클릭 시 기종별 상세"
                              >
                                {formatCurrency(row.airframeAmount)}
                              </TableCell>
                            </>}
                            {tabValue === 2 && <>
                              <TableCell
                                align="right"
                                sx={clickableCellSx}
                                onClick={() => openAgencyDetail(row.name, 'parts')}
                                title="클릭 시 파츠별 상세"
                              >
                                {row.partsQty.toLocaleString()}개
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ ...clickableCellSx, fontWeight: 'bold' }}
                                onClick={() => openAgencyDetail(row.name, 'parts')}
                                title="클릭 시 파츠별 상세"
                              >
                                {formatCurrency(row.partsAmount)}
                              </TableCell>
                            </>}
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </>
                  )}
                </Table>
              </TableContainer>
            </Paper>

            {/* 기체/파츠 순위 상세 모달 */}
            <Dialog
              open={detailModal.open}
              onClose={() => setDetailModal((m) => ({ ...m, open: false }))}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle sx={{ fontWeight: 'bold' }}>{detailModal.title}</DialogTitle>
              <DialogContent dividers>
                {detailModal.kind === 'airframe' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    해당 대리점의 기체 기종별 주문 수량·매출입니다. (오프라인 수기 출고 + 온라인 합산)
                  </Typography>
                )}
                {detailModal.kind === 'parts' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    해당 대리점의 파츠 상품별 주문 수량·매출입니다. (오프라인 수기 출고 + 온라인 합산)
                  </Typography>
                )}
                <TableContainer>
                  <Table size="small" sx={{ border: '1px solid rgba(224,224,224,1)', '& th, & td': { border: '1px solid rgba(224,224,224,1)' } }}>
                    <TableHead sx={{ bgcolor: 'grey.100' }}>
                      <TableRow>
                        <TableCell width={48}>#</TableCell>
                        <TableCell>{detailModal.kind === 'airframe' ? '기종' : '파츠명'}</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>총 수량</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>총 매출</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>오프 수량</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>오프 매출</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>온 수량</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>온 매출</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(detailModal.rows || []).length > 0 ? (
                        <>
                          {detailModal.rows.map((r, idx) => (
                            <TableRow key={`${r.name}-${idx}`} hover>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell align="right" sx={{ bgcolor: 'grey.50' }}>
                                {(r.qty || 0).toLocaleString()}{detailModal.kind === 'airframe' ? '대' : '개'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>
                                {formatCurrency(r.amount)}
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>
                                {(r.offlineQty || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: '#eef6ff' }}>
                                {formatCurrency(r.offlineAmount)}
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>
                                {(r.onlineQty || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: '#f3eefc' }}>
                                {formatCurrency(r.onlineAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: '#f0f4f8' }}>
                            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>합계</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {detailModal.rows.reduce((s, r) => s + (r.qty || 0), 0).toLocaleString()}
                              {detailModal.kind === 'airframe' ? '대' : '개'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(detailModal.rows.reduce((s, r) => s + (r.amount || 0), 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#eef6ff' }}>
                              {detailModal.rows.reduce((s, r) => s + (r.offlineQty || 0), 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#eef6ff' }}>
                              {formatCurrency(detailModal.rows.reduce((s, r) => s + (r.offlineAmount || 0), 0))}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f3eefc' }}>
                              {detailModal.rows.reduce((s, r) => s + (r.onlineQty || 0), 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f3eefc' }}>
                              {formatCurrency(detailModal.rows.reduce((s, r) => s + (r.onlineAmount || 0), 0))}
                            </TableCell>
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} align="center">상세 데이터가 없습니다.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setDetailModal((m) => ({ ...m, open: false }))}
                  variant="contained"
                  sx={{ bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.900' } }}
                >
                  닫기
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
}

export default AgencySalesStats;
