import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress,
  FormControl, Select, MenuItem, InputLabel, Button, Divider, TextField
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import SearchIcon from '@mui/icons-material/Search';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#7b1fa2'];

function SalesHistoryStats() {
  const [loading, setLoading] = useState(true);
  const [flatRows, setFlatRows] = useState([]);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [filterType, setFilterType] = useState('all');
  const [filterBrand, setFilterBrand] = useState('전체');

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

    const [shipRes, asRes, cafeRes, whRes, partsRes] = await Promise.all([
      shipQuery, asQuery, cafeQuery,
      supabase.from('warehouses').select('id, name'),
      supabase.from('parts').select('id, code, barcode, name, note, brand')
    ]);

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
        _type: 'shipment', date_val: s.order_date, sales_channel: s.sales_channel || '매장출고',
      };
      if (parts.length === 0) {
        rows.push({ ...baseFields, part_category: '기타', part_brand: '-', quantity: 0, total_price: Number(s.price || 0) });
      } else {
        parts.forEach((p) => {
          const total = Number(p.total_price || (Number(p.price || 0) * Number(p.quantity || 1)));
          const cat = resolveCategory(p.part_name, p.part_code);
          const brand = resolveBrand(p.part_name, p.part_code);
          rows.push({ ...baseFields, part_category: cat, part_brand: brand, quantity: Number(p.quantity || 1), total_price: total });
        });
      }
    });

    // A/S 건
    (asRes.data || []).forEach(s => {
      const parts = servicePartsMap[s.id] || [];
      const agencyName = s.agencies?.name || 'A/S수리';
      const baseFields = {
        _type: 'service', date_val: s.completion_date || s.reception_date, sales_channel: agencyName,
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
            rows.push({ ...baseFields, part_category: cat, part_brand: brand, quantity: qty, total_price: total });
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
        _type: 'cafe24', date_val: o.order_date, sales_channel: '온라인주문',
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
          rows.push({ ...baseFields, part_category: cat, part_brand: brand, quantity: itemQty, total_price: total });
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

  return (
    <Box sx={{ p: 3, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>판매현황 통합 통계</Typography>
      </Box>

      {/* 필터 영역 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
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
            <Button variant="contained" fullWidth startIcon={<SearchIcon />} onClick={fetchSales} disabled={loading} sx={{ height: 40 }}>
              조회
            </Button>
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
        </>
      )}
    </Box>
  );
}

export default SalesHistoryStats;
