import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress,
  FormControl, Select, MenuItem, InputLabel, Button, Divider, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, ButtonGroup
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { startOfMonth, endOfMonth, format, startOfYear, endOfYear, getWeek, startOfWeek, startOfQuarter, endOfQuarter, setMonth } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import SearchIcon from '@mui/icons-material/Search';
import AssessmentIcon from '@mui/icons-material/Assessment';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#7b1fa2'];

function SalesHistoryStats() {
  const [loading, setLoading] = useState(true);
  const [flatRows, setFlatRows] = useState([]);
  const [agenciesList, setAgenciesList] = useState([]);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [filterType, setFilterType] = useState('all');
  const [filterBrand, setFilterBrand] = useState('전체');
  const [tabValue, setTabValue] = useState(0);

  const handleSetYear = () => {
    const today = new Date();
    setStartDate(startOfYear(today));
    setEndDate(endOfYear(today));
  };

  const handleQuickDate = (type, monthIndex = 0) => {
    const today = new Date();
    if (type === 'week') {
      setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
      setEndDate(new Date()); // 혹은 endOfWeek
    } else if (type === 'month') {
      setStartDate(startOfMonth(today));
      setEndDate(endOfMonth(today));
    } else if (type === 'quarter') {
      setStartDate(startOfQuarter(today));
      setEndDate(endOfQuarter(today));
    } else if (type === 'specific_month') {
      const targetDate = setMonth(today, monthIndex);
      setStartDate(startOfMonth(targetDate));
      setEndDate(endOfMonth(targetDate));
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchSales = async () => {
    setLoading(true);

    let shipQuery = supabase
      .from('shipments')
      .select('id, order_date, customer_name, price, sales_channel, status, note, warehouse_id, shipment_parts(id, part_name, quantity, price, total_price)')
      .in('status', ['출고완료', '완료'])
      .order('order_date', { ascending: false });

    if (startDate) shipQuery = shipQuery.gte('order_date', format(startDate, 'yyyy-MM-dd'));
    if (endDate)   shipQuery = shipQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

    let asQuery = supabase
      .from('services')
      .select('id, reception_date, completion_date, customer_name, status, note')
      .ilike('status', '%완료%')
      .order('completion_date', { ascending: false });

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
      .order('order_date', { ascending: false });

    if (startDate) cafeQuery = cafeQuery.gte('order_date', format(startDate, 'yyyy-MM-dd'));
    if (endDate)   cafeQuery = cafeQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

    const [shipRes, asRes, cafeRes, whRes, partsRes, agenciesRes] = await Promise.all([
      shipQuery, asQuery, cafeQuery,
      supabase.from('warehouses').select('id, name'),
      supabase.from('parts').select('id, code, barcode, name, note, brand'),
      supabase.from('agencies').select('name')
    ]);

    setAgenciesList((agenciesRes.data || []).map(a => a.name));

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
      if (p.name) { partsMap[p.name] = cat; partsBrandMap[p.name] = brand; }
      if (p.code) { partsByCode[p.code] = cat; partsBrandByCode[p.code] = brand; }
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

    const asIds = (asRes.data || []).map(s => s.id);
    const servicePartsMap = {};
    const serviceTxMap = {};
    if (asIds.length > 0) {
      const [{ data: spData }, { data: txData }] = await Promise.all([
        supabase.from('service_parts').select('id, service_id, quantity, part_id, parts(name, price)').in('service_id', asIds),
        supabase.from('transactions').select('group_id, product_id, from_location').in('group_id', asIds.map(String)).eq('type', 'out')
      ]);
      (spData || []).forEach(sp => {
        if (!servicePartsMap[sp.service_id]) servicePartsMap[sp.service_id] = [];
        servicePartsMap[sp.service_id].push(sp);
      });
      (txData || []).forEach(tx => {
         serviceTxMap[tx.group_id] = tx.from_location;
         if (tx.product_id) serviceTxMap[`${tx.group_id}_${tx.product_id}`] = tx.from_location;
      });
    }

    const cafeIds = (cafeRes.data || []).map(o => o.id);
    const cafeWarehouseMap = {};
    if (cafeIds.length > 0) {
      const { data: invData } = await supabase
        .from('inventory_logs').select('reference_id, warehouse_id, part_code')
        .eq('reference_type', 'cafe24_order').in('reference_id', cafeIds);
      (invData || []).forEach(log => {
        cafeWarehouseMap[log.reference_id] = log.warehouse_id;
        if (log.part_code) cafeWarehouseMap[`${log.reference_id}_${log.part_code}`] = log.warehouse_id;
      });
    }

    const rows = [];

    // 출고 건
    (shipRes.data || []).forEach(s => {
      const parts = s.shipment_parts || [];
      const baseFields = {
        _type: 'shipment', date_val: s.order_date, sales_channel: s.sales_channel || '매장출고', customer_name: s.customer_name || '-'
      };
      if (parts.length === 0) {
        rows.push({ ...baseFields, part_category: '기타', part_brand: '-', quantity: 0, total_price: Number(s.price || 0) });
      } else {
        parts.forEach((p) => {
          const total = Number(p.total_price || (Number(p.price || 0) * Number(p.quantity || 1)));
          const cat = resolveCategory(p.part_name, p.part_code);
          const brand = resolveBrand(p.part_name, p.part_code);
          rows.push({ ...baseFields, part_name: p.part_name || '기체/상품', part_category: cat, part_brand: brand, quantity: Number(p.quantity || 1), total_price: total });
        });
      }
    });

    // A/S 건
    (asRes.data || []).forEach(s => {
      const parts = servicePartsMap[s.id] || [];
      const agencyName = s.agencies?.name || 'A/S수리';
      const baseFields = {
        _type: 'service', date_val: s.completion_date || s.reception_date, sales_channel: agencyName, customer_name: s.customer_name || '-'
      };
      if (parts.length > 0) {
        parts.forEach((sp) => {
          const unitPrice = Number(sp.parts?.price || 0);
          const qty = Number(sp.quantity || 1);
          const total = unitPrice * qty;
          if (qty > 0) {
            const pName = sp.parts?.name || '부품';
            const cat = resolveCategory(pName);
            const brand = resolveBrand(pName);
            rows.push({ ...baseFields, part_name: pName, part_category: cat, part_brand: brand, quantity: qty, total_price: total });
          }
        });
      }
    });

    // 온라인 건
    (cafeRes.data || []).forEach(o => {
      const items = o.order_items || [];
      const fallbackWid = cafeWarehouseMap[o.id];

      // "반영 예외(무시)" 처리된 건은 통계에서 제외
      const hasWarehouseInfo = items.some(item => item._warehouse_id) || fallbackWid;
      if (!hasWarehouseInfo) return;

      const baseFields = {
        _type: 'cafe24', date_val: o.order_date, sales_channel: '온라인주문', customer_name: o.buyer_name || '-'
      };
      if (items.length === 0) {
        rows.push({ ...baseFields, part_category: '기타', part_brand: '-', quantity: 0, total_price: Number(o.total_amount || 0) });
      } else {
        items.forEach((item, idx) => {
          const itemCode = item.custom_product_code || item.product_code || '';
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
          rows.push({ ...baseFields, part_name: pName, part_category: cat, part_brand: brand, quantity: itemQty, total_price: total });
        });
      }
    });

    setFlatRows(rows);
    setLoading(false);
  };

  const currentFiltered = flatRows.filter(r => {
    if (filterType !== 'all' && r._type !== filterType) return false;
    if (filterBrand !== '전체' && r.part_brand !== filterBrand) return false;
    return true;
  });

  // 요약
  const totalAmt = currentFiltered.reduce((a, r) => a + Number(r.total_price || 0), 0);
  const totalSupply = Math.round(totalAmt / 1.1);
  const totalVat = totalAmt - totalSupply;
  const totalQty = currentFiltered.reduce((a, r) => a + Number(r.quantity || 0), 0);

  // 차트 데이터 가공
  const dailyMap = {};
  const channelMap = {};
  const catMap = {};
  const brandMap = {};

  currentFiltered.forEach(r => {
    const dStr = format(new Date(r.date_val), 'MM-dd');
    if (!dailyMap[dStr]) dailyMap[dStr] = { date: dStr, amount: 0 };
    dailyMap[dStr].amount += Number(r.total_price || 0);

    const ch = r.sales_channel || '미지정';
    if (!channelMap[ch]) channelMap[ch] = { name: ch, value: 0 };
    channelMap[ch].value += Number(r.total_price || 0);

    const c = r.part_category || '기타';
    if (!catMap[c]) catMap[c] = { name: c, value: 0 };
    catMap[c].value += Number(r.total_price || 0);

    const b = r.part_brand || '-';
    if (!brandMap[b]) brandMap[b] = { name: b, value: 0 };
    brandMap[b].value += Number(r.total_price || 0);
  });

  const chartDaily = Object.values(dailyMap).sort((a,b) => a.date.localeCompare(b.date));
  const chartChannel = Object.values(channelMap).sort((a,b) => b.value - a.value);
  const chartCat = Object.values(catMap).sort((a,b) => b.value - a.value);
  const chartBrand = Object.values(brandMap).sort((a,b) => b.value - a.value);

  const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val) + '원';

  // 보고서용 다차원 그룹화 로직 (브랜드별, 대리점별, 종합, 시계열)
  const { reportGroups, brandGroups, dealerGroups, timeSeriesData } = React.useMemo(() => {
    const rpGroupData = {};
    const brGroupData = {};
    const dlGroupData = {};
    const tsGroupData = {};

    currentFiltered.forEach(r => {
      let brand = r.part_brand || '기타';
      if (brand === '-') brand = '기타';
      const ch = r.sales_channel || '기타';
      
      // ** 파츠 / 공임 분류 병합 로직 **
      let pName = r.part_name || '상품';
      if (r.part_category === '부품') pName = '[ 부품 종합 ]';
      else if (r.part_category === '공임') pName = '[ 공임 종합 ]';
      else if (r.part_category === '기타') pName = '[ 기타 종합 ]';

      const uPrice = Number(r.unit_price || 0);

      // 출고나 A/S의 경우 채널명에 대리점 이름이 있는 경우가 많으므로 이를 활용하거나 고객명을 우선 활용
      let agencyName = r.customer_name || '-';
      if (r._type === 'shipment' && r.sales_channel && r.sales_channel.includes('대리점')) {
         agencyName = r.customer_name || r.sales_channel;
      } else if (r._type === 'service' && r.sales_channel && r.sales_channel !== 'A/S수리') {
         agencyName = r.sales_channel;
      }
      
      const qty = Number(r.quantity || 0);
      const amt = Number(r.total_price || 0);

      // 1) 상세 보고서 매트릭스 (Brand -> Agency/Customer -> Item)
      const rpKey = brand;
      if (!rpGroupData[rpKey]) rpGroupData[rpKey] = { brand, agenciesMap: {}, subtotalQty: 0, subtotalAmt: 0 };
      if (!rpGroupData[rpKey].agenciesMap[agencyName]) rpGroupData[rpKey].agenciesMap[agencyName] = { agency_name: agencyName, itemsMap: {}, subtotalQty: 0, subtotalAmt: 0 };
      
      const rpAgency = rpGroupData[rpKey].agenciesMap[agencyName];
      const isTotalGroup = pName.includes('종합');
      const rpItemKey = isTotalGroup ? pName : `${pName}_${uPrice}`;
      if (!rpAgency.itemsMap[rpItemKey]) {
        rpAgency.itemsMap[rpItemKey] = { part_name: pName, unit_price: isTotalGroup ? 0 : uPrice, quantity: 0, total_price: 0 };
      }
      rpAgency.itemsMap[rpItemKey].quantity += qty;
      rpAgency.itemsMap[rpItemKey].total_price += amt;
      rpAgency.subtotalQty += qty;
      rpAgency.subtotalAmt += amt;
      rpGroupData[rpKey].subtotalQty += qty;
      rpGroupData[rpKey].subtotalAmt += amt;

      // 2) 브랜드 그룹 (Brand -> Model/Parts) - 기존 유지
      const brKey = brand;
      if (!brGroupData[brKey]) brGroupData[brKey] = { brand, itemsMap: {}, subtotalQty: 0, subtotalAmt: 0 };
      const brItemKey = pName; 
      if (!brGroupData[brKey].itemsMap[brItemKey]) {
        brGroupData[brKey].itemsMap[brItemKey] = { part_name: pName, quantity: 0, total_price: 0 };
      }
      brGroupData[brKey].itemsMap[brItemKey].quantity += qty;
      brGroupData[brKey].itemsMap[brItemKey].total_price += amt;
      brGroupData[brKey].subtotalQty += qty;
      brGroupData[brKey].subtotalAmt += amt;

      // 3) 대리점별 그룹 (Agency -> Brand -> Item)
      // 공식 대리점명인지 부분 일치 포함으로 유효성 검사
      const isOfficialAgency = agenciesList.some(a => agencyName.includes(a) || a.includes(agencyName));
      if (isOfficialAgency) {
        const dlKey = agencyName;
        if (!dlGroupData[dlKey]) dlGroupData[dlKey] = { agency_name: agencyName, brandsMap: {}, subtotalQty: 0, subtotalAmt: 0 };
        if (!dlGroupData[dlKey].brandsMap[brand]) dlGroupData[dlKey].brandsMap[brand] = { brand, itemsMap: {}, subtotalQty: 0, subtotalAmt: 0 };
        
        const dlBrand = dlGroupData[dlKey].brandsMap[brand];
        const dlItemKey = pName;
        if (!dlBrand.itemsMap[dlItemKey]) {
          dlBrand.itemsMap[dlItemKey] = { part_name: pName, quantity: 0, total_price: 0 };
        }
        dlBrand.itemsMap[dlItemKey].quantity += qty;
        dlBrand.itemsMap[dlItemKey].total_price += amt;
        dlBrand.subtotalQty += qty;
        dlBrand.subtotalAmt += amt;
        dlGroupData[dlKey].subtotalQty += qty;
        dlGroupData[dlKey].subtotalAmt += amt;
      }

      // 4) 시계열 그룹 (Weekly & Monthly)
      const dateVal = new Date(r.date_val);
      const weekNum = getWeek(dateVal);
      const monthStr = format(dateVal, 'yyyy-MM');
      const weekStr = `${format(startOfWeek(dateVal, { weekStartsOn: 1 }), 'MM.dd')} 주차`;

      if (!tsGroupData[monthStr]) tsGroupData[monthStr] = { type: 'month', label: monthStr + '월', amount: 0, qty: 0 };
      tsGroupData[monthStr].amount += amt;
      tsGroupData[monthStr].qty += qty;

      if (!tsGroupData[weekStr]) tsGroupData[weekStr] = { type: 'week', label: weekStr, amount: 0, qty: 0 };
      tsGroupData[weekStr].amount += amt;
      tsGroupData[weekStr].qty += qty;
    });

    const reportGroupsArr = Object.values(rpGroupData).map(g => ({
       ...g,
       agencies: Object.values(g.agenciesMap).map(ag => ({
         ...ag,
         items: Object.values(ag.itemsMap).sort((a,b) => b.total_price - a.total_price)
       })).sort((a,b) => b.subtotalAmt - a.subtotalAmt)
    })).sort((a,b) => b.subtotalAmt - a.subtotalAmt);

    const brandGroupsArr = Object.values(brGroupData).map(g => ({
       ...g,
       items: Object.values(g.itemsMap).sort((a,b) => b.total_price - a.total_price)
    })).sort((a,b) => b.subtotalAmt - a.subtotalAmt);

    const dealerGroupsArr = Object.values(dlGroupData).map(g => ({
       ...g,
       brands: Object.values(g.brandsMap).map(br => ({
         ...br,
         items: Object.values(br.itemsMap).sort((a,b) => b.total_price - a.total_price)
       })).sort((a,b) => b.subtotalAmt - a.subtotalAmt)
    })).sort((a,b) => b.subtotalAmt - a.subtotalAmt);

    // 시계열 데이터 누적 계산
    const weeks = Object.values(tsGroupData).filter(x => x.type === 'week').sort((a,b) => a.label.localeCompare(b.label));
    const months = Object.values(tsGroupData).filter(x => x.type === 'month').sort((a,b) => a.label.localeCompare(b.label));

    let weekAcc = 0;
    weeks.forEach(w => { weekAcc += w.amount; w.cumulative = weekAcc; });
    let monthAcc = 0;
    months.forEach(m => { monthAcc += m.amount; m.cumulative = monthAcc; });

    return {
      reportGroups: reportGroupsArr,
      brandGroups: brandGroupsArr,
      dealerGroups: dealerGroupsArr,
      timeSeriesData: { weeks, months }
    };
  }, [currentFiltered]);

  return (
    <Box sx={{ p: 3, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>판매현황 통합 통계</Typography>
      </Box>

      {/* 필터 영역 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* 날짜 범위 퀵 선택 버튼들 */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1, alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1, color: 'text.secondary' }}>빠른 선택:</Typography>
              <Button size="small" variant="outlined" color="secondary" onClick={() => handleQuickDate('week')}>이번 주</Button>
              <Button size="small" variant="outlined" color="secondary" onClick={() => handleQuickDate('month')}>이번 달</Button>
              <Button size="small" variant="outlined" color="secondary" onClick={() => handleQuickDate('quarter')}>이번 분기</Button>
              <Button size="small" variant="outlined" color="secondary" onClick={handleSetYear}>올해 전체</Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              {[...Array(12)].map((_, i) => (
                <Button key={i} size="small" variant="outlined" color="info" onClick={() => handleQuickDate('specific_month', i)}>
                  {i + 1}월
                </Button>
              ))}
            </Box>
          </Grid>
          
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <Grid item xs={12} sm={3}>
              <DatePicker
                label="시작일"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <DatePicker
                label="종료일"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </Grid>
          </LocalizationProvider>

          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>구분</InputLabel>
              <Select value={filterType} label="구분" onChange={(e) => setFilterType(e.target.value)}>
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="shipment">매장출고</MenuItem>
                <MenuItem value="cafe24">온라인주문</MenuItem>
                <MenuItem value="service">A/S</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>브랜드</InputLabel>
              <Select value={filterBrand} label="브랜드" onChange={(e) => setFilterBrand(e.target.value)}>
                <MenuItem value="전체">전체</MenuItem>
                <MenuItem value="XRB">XRB</MenuItem>
                <MenuItem value="NEARBIKE">NEARBIKE</MenuItem>
                <MenuItem value="기타">기타</MenuItem>
              </Select>
            </FormControl>
          </Grid>

            <Grid item xs={12} sm={2}>
              <Button fullWidth variant="contained" onClick={fetchSales} disabled={loading} sx={{ height: 40 }} startIcon={<SearchIcon />}>조회</Button>
            </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* 요약 카드 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card sx={{ bgcolor: '#1976d2', color: 'white' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>총 판매 합계</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>{formatCurrency(totalAmt)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">총 공급가액</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>{formatCurrency(totalSupply)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">총 부가세액</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>{formatCurrency(totalVat)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">판매된 총 물품 수량</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>{totalQty.toLocaleString()} 개</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* 차트 영역 */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>일자별 판매액 추이</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDaily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(val) => (val/10000) + '만'} />
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                      <Legend />
                      <Line type="monotone" name="판매액" dataKey="amount" stroke="#1976d2" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>품목 구분별 비중</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartCat} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                        {chartCat.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>온라인/매장/AS 비중</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartChannel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis hide />
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                      <Bar name="매출" dataKey="value">
                        {chartChannel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index+2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>브랜드 매출 비중</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartBrand} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                        {chartBrand.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index+4) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>

          </Grid>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 4, mb: 2 }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
              <Tab label="시계열 누적 추이 차트" />
              <Tab label="브랜드별 요약 테이블" />
              <Tab label="대리점 종합 요약 테이블" />
              <Tab label="전체 매트릭스 리포트 (통합상세)" />
            </Tabs>
          </Box>

          <Box pb={10}>
            {/* 탭 0: 시계열 추이 (월간/주간 누적) */}
            {tabValue === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, height: 400 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>월별 매출 및 누적 추이 (월간)</Typography>
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={timeSeriesData.months}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis tickFormatter={(val) => (val/10000) + '만'} />
                        <Tooltip formatter={(val) => formatCurrency(val)} />
                        <Legend />
                        <Line type="monotone" name="월별매출액" dataKey="amount" stroke="#1976d2" strokeWidth={2} />
                        <Line type="monotone" name="누적합계" dataKey="cumulative" stroke="#ed6c02" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, height: 400, overflowY: 'auto' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>시계열 데이터 표 (주차별 상세)</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>시기</TableCell>
                          <TableCell align="right">매출액</TableCell>
                          <TableCell align="right">누적매출액</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                         {timeSeriesData.weeks.map(w => (
                           <TableRow key={w.label}>
                             <TableCell>{w.label}</TableCell>
                             <TableCell align="right">{formatCurrency(w.amount)}</TableCell>
                             <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ed6c02' }}>{formatCurrency(w.cumulative)}</TableCell>
                           </TableRow>
                         ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* 탭 1: 브랜드별 요약 표 */}
            {tabValue === 1 && (
              <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 600, '& th, & td': { border: '1px solid #cfd8dc' }, '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell width="20%">브랜드</TableCell>
                      <TableCell width="50%">기종/부품분류</TableCell>
                      <TableCell width="10%">합산수량</TableCell>
                      <TableCell width="20%">합계금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {brandGroups.map((g, gIdx) => (
                       <React.Fragment key={gIdx}>
                         {g.items.map((it, iIdx) => (
                            <TableRow key={`${gIdx}-${iIdx}`} hover>
                              {iIdx === 0 && (
                                <TableCell rowSpan={g.items.length + 1} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                  {g.brand}
                                </TableCell>
                              )}
                              <TableCell>{it.part_name}</TableCell>
                              <TableCell align="center">{it.quantity}</TableCell>
                              <TableCell align="right">{formatCurrency(it.total_price)}</TableCell>
                            </TableRow>
                         ))}
                         <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>[ {g.brand} 종합 ]</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{g.subtotalQty}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{formatCurrency(g.subtotalAmt)}</TableCell>
                         </TableRow>
                       </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 탭 2: 대리점 종합 표 (3-Depth) */}
            {tabValue === 2 && (
              <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 600, '& th, & td': { border: '1px solid #cfd8dc' }, '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell width="30%">공식 대리점명</TableCell>
                      <TableCell width="20%">브랜드</TableCell>
                      <TableCell width="30%">세부내역 (제품/파츠 등)</TableCell>
                      <TableCell width="8%">수량</TableCell>
                      <TableCell width="12%">합산 금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dealerGroups.length === 0 && (
                       <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>조건에 등록된 대리점 판매 내역이 없습니다.</TableCell></TableRow>
                    )}
                    {dealerGroups.map((g, gIdx) => {
                       const dealerRowSpan = g.brands.reduce((sum, br) => sum + br.items.length + 1, 0) + 1;
                       return (
                         <React.Fragment key={`dl-${gIdx}`}>
                           {g.brands.map((br, bIdx) => (
                             <React.Fragment key={`dl-${gIdx}-br-${bIdx}`}>
                               {br.items.map((it, iIdx) => (
                                 <TableRow key={`dl-${gIdx}-br-${bIdx}-it-${iIdx}`} hover>
                                   {bIdx === 0 && iIdx === 0 && (
                                     <TableCell rowSpan={dealerRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                       {g.agency_name}
                                     </TableCell>
                                   )}
                                   {iIdx === 0 && (
                                     <TableCell rowSpan={br.items.length + 1} align="center" sx={{ fontWeight: 'bold' }}>
                                       {br.brand}
                                     </TableCell>
                                   )}
                                   <TableCell>{it.part_name}</TableCell>
                                   <TableCell align="center">{it.quantity}</TableCell>
                                   <TableCell align="right">{formatCurrency(it.total_price)}</TableCell>
                                 </TableRow>
                               ))}
                               <TableRow sx={{ bgcolor: '#f1f8e9' }}>
                                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#33691e', fontSize: '0.85rem' }}>[{br.brand} 소계]</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#33691e' }}>{br.subtotalQty}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#33691e' }}>{formatCurrency(br.subtotalAmt)}</TableCell>
                               </TableRow>
                             </React.Fragment>
                           ))}
                           {/* 대리점 총 합계 행 */}
                           <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold', color: '#e65100' }}>[ {g.agency_name} 총합계 ]</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 'bold', color: '#e65100' }}>{g.subtotalQty}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#e65100' }}>{formatCurrency(g.subtotalAmt)}</TableCell>
                           </TableRow>
                         </React.Fragment>
                       );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 탭 3: 기존의 상세 통합 매트릭스 리포트 (3-Depth 분할표) */}
            {tabValue === 3 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                  <AssessmentIcon sx={{ mr: 1, color: '#1565c0' }}/> 통합 상세 매트릭스 분할표
                </Typography>
                <TableContainer component={Paper} sx={{ overflowX: 'auto', border: '1px solid #cfd8dc' }}>
                  <Table size="small" sx={{ 
                    minWidth: 800, 
                    '& th, & td': { border: '1px solid #cfd8dc', padding: '6px 12px' },
                    '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center', fontSize: '0.9rem' }
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width="15%">브랜드</TableCell>
                        <TableCell width="25%">고객 / 대리점명</TableCell>
                        <TableCell width="28%">기체 모델 / 상세 내역</TableCell>
                        <TableCell width="12%">기준 단가</TableCell>
                        <TableCell width="8%">수량</TableCell>
                        <TableCell width="12%">합계 금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportGroups.length === 0 && (
                         <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>조회된 데이터가 없습니다.</TableCell></TableRow>
                      )}
                      {reportGroups.map((g, gIdx) => {
                         const brandRowSpan = g.agencies.reduce((sum, ag) => sum + ag.items.length + 1, 0) + 1;
                         return (
                           <React.Fragment key={`rp-${gIdx}`}>
                             {g.agencies.map((ag, aIdx) => (
                               <React.Fragment key={`rp-${gIdx}-ag-${aIdx}`}>
                                 {ag.items.map((it, iIdx) => (
                                   <TableRow key={`rp-${gIdx}-ag-${aIdx}-it-${iIdx}`} hover>
                                     {aIdx === 0 && iIdx === 0 && (
                                       <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa', verticalAlign: 'middle' }}>
                                         <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{g.brand}</Typography>
                                       </TableCell>
                                     )}
                                     {iIdx === 0 && (
                                       <TableCell rowSpan={ag.items.length + 1} align="center" sx={{ verticalAlign: 'middle' }}>
                                         {ag.agency_name}
                                       </TableCell>
                                     )}
                                     <TableCell>{it.part_name}</TableCell>
                                     <TableCell align="right">{it.unit_price > 0 ? formatCurrency(it.unit_price) : '-'}</TableCell>
                                     <TableCell align="center">{it.quantity}</TableCell>
                                     <TableCell align="right">{formatCurrency(it.total_price)}</TableCell>
                                   </TableRow>
                                 ))}
                                 {/* 고객/대리점별 소계 행 */}
                                 <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell colSpan={2} align="center" sx={{ fontSize: '0.85rem', color: '#555' }}>[{ag.agency_name} 소계]</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#555' }}>{ag.subtotalQty}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#555' }}>{formatCurrency(ag.subtotalAmt)}</TableCell>
                                 </TableRow>
                               </React.Fragment>
                             ))}
                             {/* 브랜드 총 합계 행 */}
                             <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                                <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>[ {g.brand} 총 매 출 ]</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{g.subtotalQty}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{formatCurrency(g.subtotalAmt)}</TableCell>
                             </TableRow>
                           </React.Fragment>
                         );
                      })}
                      {/* 전체 합계 행 */}
                      {reportGroups.length > 0 && (
                        <TableRow sx={{ bgcolor: '#fff3e0' }}>
                          <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#e65100' }}>총 매 출 합 계 (TOTAL)</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#e65100' }}>{totalQty}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#e65100' }}>{formatCurrency(totalAmt)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

export default SalesHistoryStats;
