import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, CircularProgress,
  FormControl, Select, MenuItem, InputLabel, Button, Divider, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, ButtonGroup, Stack, Switch, FormControlLabel
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { startOfMonth, endOfMonth, format, startOfYear, endOfYear, getWeek, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, setMonth, startOfDay, endOfDay } from 'date-fns';
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
  const [inventoryList, setInventoryList] = useState([]); // 재고 목록 상태 추가
  const [agenciesList, setAgenciesList] = useState([]);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [filterType, setFilterType] = useState('all');
  const [filterBrand, setFilterBrand] = useState('전체');
  const [tabValue, setTabValue] = useState(0);
  const [showProfit, setShowProfit] = useState(false);
  const [compareStats, setCompareStats] = useState({ context: null, mom: null, yoy: null, wow: null, yoyWeek: null });



  const currentMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    const newStartDate = startOfYear(new Date(year, 0, 1));
    const newEndDate = endOfYear(new Date(year, 11, 31));
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setSelectedMonth(null);
  };

  const handleMonthSelect = (monthIndex) => {
    const newDate = new Date(selectedYear, monthIndex, 1);
    const newStartDate = startOfMonth(newDate);
    const newEndDate = endOfMonth(newDate);
    setSelectedMonth(monthIndex);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  useEffect(() => {
    fetchSales();
    fetchCompareStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const percentChange = (current, previous) => {
    if (previous === 0 || previous === null || previous === undefined) return null;
    return ((current - previous) / previous) * 100;
  };

  const fetchTotalsForRange = async (start, end) => {
    const sDate = format(start, 'yyyy-MM-dd') + 'T00:00:00+09:00';
    const eDate = format(end, 'yyyy-MM-dd') + 'T23:59:59+09:00';
    
    // Shipments
    const { data: shipRows } = await supabase.from('shipments').select('price').gte('order_date', sDate).lte('order_date', eDate).in('status', ['출고완료', '완료']);
    const shipTotal = (shipRows || []).reduce((acc, r) => acc + Number(r.price || 0), 0);
    
    // Services
    const { data: asRows } = await supabase.from('service_parts')
      .select('price, quantity, services!inner(completion_date, status)')
      .gte('services.completion_date', sDate).lte('services.completion_date', eDate).ilike('services.status', '%완료%');
    const asTotal = (asRows || []).reduce((acc, r) => acc + (Number(r.price || 0) * Number(r.quantity || 1)), 0);

    // Cafe24
    const { data: cafeRows } = await supabase.from('cafe24_orders').select('total_amount').gte('order_date', sDate).lte('order_date', eDate).eq('is_transferred', true);
    const cafeTotal = (cafeRows || []).reduce((acc, r) => acc + Number(r.total_amount || 0), 0);

    return shipTotal + asTotal + cafeTotal;
  };

  const fetchCompareStats = async () => {
    if (!startDate || !endDate) return;
    const days = Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1;
    const isFullMonth = format(startDate, 'yyyy-MM-dd') === format(startOfMonth(startDate), 'yyyy-MM-dd') &&
                        format(endDate, 'yyyy-MM-dd') === format(endOfMonth(startDate), 'yyyy-MM-dd');
    const isApproxWeek = days >= 7 && days <= 8;

    const currentTotal = await fetchTotalsForRange(startDate, endDate);

    if (isFullMonth) {
      const prevMonthStart = startOfMonth(setMonth(startDate, startDate.getMonth() - 1));
      const prevMonthEnd = endOfMonth(prevMonthStart);
      const lastYearMonthStart = startOfMonth(new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1));
      const lastYearMonthEnd = endOfMonth(lastYearMonthStart);

      const [prev, yoyBase] = await Promise.all([
        fetchTotalsForRange(prevMonthStart, prevMonthEnd),
        fetchTotalsForRange(lastYearMonthStart, lastYearMonthEnd)
      ]);
      setCompareStats({ context: 'month', mom: percentChange(currentTotal, prev), yoy: percentChange(currentTotal, yoyBase), wow: null, yoyWeek: null });
    } else if (isApproxWeek) {
      const prevWeekStart = startOfWeek(new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
      const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
      const lastYearWeekStart = startOfWeek(new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate()), { weekStartsOn: 1 });
      const lastYearWeekEnd = endOfWeek(lastYearWeekStart, { weekStartsOn: 1 });

      const [prev, yoyBase] = await Promise.all([
        fetchTotalsForRange(prevWeekStart, prevWeekEnd),
        fetchTotalsForRange(lastYearWeekStart, lastYearWeekEnd)
      ]);
      setCompareStats({ context: 'week', mom: null, yoy: null, wow: percentChange(currentTotal, prev), yoyWeek: percentChange(currentTotal, yoyBase) });
    } else {
      setCompareStats({ context: null, mom: null, yoy: null, wow: null, yoyWeek: null });
    }
  };

  const fetchSales = async () => {
    setLoading(true);

    let shipQuery = supabase
      .from('shipments')
      .select('id, order_date, customer_name, price, sales_channel, status, note, warehouse_id, shipment_parts(id, part_name, quantity, price, total_price, note)')
      .in('status', ['출고완료', '완료'])
      .order('order_date', { ascending: false });

    if (startDate) shipQuery = shipQuery.gte('order_date', format(startDate, 'yyyy-MM-dd') + 'T00:00:00+09:00');
    if (endDate)   shipQuery = shipQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59+09:00');

    let asQuery = supabase
      .from('services')
      .select('id, reception_date, completion_date, customer_name, status, note')
      .ilike('status', '%완료%')
      .order('completion_date', { ascending: false });

    if (startDate) {
      const sDate = format(startDate, 'yyyy-MM-dd') + 'T00:00:00+09:00';
      asQuery = asQuery.or(`completion_date.gte.${sDate},and(completion_date.is.null,reception_date.gte.${sDate})`);
    }
    if (endDate) {
      const eDate = format(endDate, 'yyyy-MM-dd') + 'T23:59:59+09:00';
      asQuery = asQuery.or(`completion_date.lte.${eDate},and(completion_date.is.null,reception_date.lte.${eDate})`);
    }

    let cafeQuery = supabase
      .from('cafe24_orders')
      .select('id, order_id, order_date, buyer_name, total_amount, order_items, status')
      .eq('is_transferred', true)
      .order('order_date', { ascending: false });

    if (startDate) cafeQuery = cafeQuery.gte('order_date', format(startDate, 'yyyy-MM-dd') + 'T00:00:00+09:00');
    if (endDate)   cafeQuery = cafeQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59+09:00');

    const [shipRes, asRes, cafeRes, whRes, partsRes, agenciesRes, invRes] = await Promise.all([
      shipQuery, asQuery, cafeQuery,
      supabase.from('warehouses').select('id, name'),
      supabase.from('parts').select('id, code, barcode, name, note, brand, supply_price'),
      supabase.from('agencies').select('name'),
      supabase.from('inventory').select('product_id, quantity')
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
    const partsNameByCode = {};
    const partsCostMap = {};
    const partsCostByCode = {};

    (partsRes.data || []).forEach(p => {
      const cat = formatCategory(p.note);
      const brand = p.brand || '-';
      const cost = Number(p.supply_price || 0);
      if (p.name) { partsMap[p.name] = cat; partsBrandMap[p.name] = brand; partsCostMap[p.name] = cost; }
      if (p.code) { partsByCode[p.code] = cat; partsBrandByCode[p.code] = brand; partsNameByCode[p.code] = p.name; partsCostByCode[p.code] = cost; }
      if (p.barcode) { partsByCode[p.barcode] = cat; partsBrandByCode[p.barcode] = brand; partsNameByCode[p.barcode] = p.name; partsCostByCode[p.barcode] = cost; }
    });

    const resolveCost = (name, code = '') => {
      if (code && typeof partsCostByCode[code] === 'number') return partsCostByCode[code];
      if (name && typeof partsCostMap[name] === 'number') return partsCostMap[name];
      return 0;
    };

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
        supabase.from('service_parts').select('id, service_id, quantity, price, part_id, usage, parts(name, price)').in('service_id', asIds),
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

    const cafeIds = (cafeRes.data || []).map(o => String(o.id));
    const cafeWarehouseMap = {};
    if (cafeIds.length > 0) {
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('group_id, product_id, from_location')
        .in('group_id', cafeIds)
        .eq('type', 'out');
        
      if (!txErr && txData) {
        txData.forEach(tx => {
           cafeWarehouseMap[tx.group_id] = tx.from_location;
           if (tx.product_id) {
             cafeWarehouseMap[`${tx.group_id}_${tx.product_id}`] = tx.from_location;
           }
        });
      }
    }

    const rows = [];

    // 출고 건
    (shipRes.data || []).forEach(s => {
      const parts = s.shipment_parts || [];
      const baseFields = {
        _id: s.id, _type: 'shipment', date_val: s.order_date, sales_channel: s.sales_channel || '매장출고', customer_name: s.customer_name || '-'
      };
      if (parts.length === 0) {
        rows.push({ ...baseFields, part_category: '기타', part_brand: '-', quantity: 0, total_price: Number(s.price || 0), total_cost: 0 });
      } else {
        parts.forEach((p) => {
          let returnedQty = 0;
          if (p.note && p.note.includes('[반품완료]')) {
            returnedQty = p.quantity;
          } else if (p.note && p.note.includes('[부분반품:')) {
            const matches = p.note.match(/\[부분반품:(\d+)개\]/g);
            if (matches) {
              matches.forEach(m => {
                const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
                if (qtyMatch && qtyMatch[1]) returnedQty += parseInt(qtyMatch[1], 10);
              });
            }
          }
          const effectiveQty = Math.max(0, Number(p.quantity || 1) - returnedQty);
          
          const total = Number(p.price || 0) * effectiveQty;
          const cat = resolveCategory(p.part_name, p.part_code);
          const brand = resolveBrand(p.part_name, p.part_code);
          const unitCost = resolveCost(p.part_name, p.part_code);
          rows.push({ ...baseFields, part_name: p.part_name || '기체/상품', part_category: cat, part_brand: brand, quantity: effectiveQty, total_price: total, total_cost: unitCost * effectiveQty });
        });
      }
    });

    // A/S 건
    (asRes.data || []).forEach(s => {
      const parts = servicePartsMap[s.id] || [];
      const agencyName = s.agencies?.name || 'A/S수리';
      const baseFields = {
        _id: s.id, _type: 'service', date_val: s.completion_date || s.reception_date, sales_channel: agencyName, customer_name: s.customer_name || '-'
      };
      if (parts.length > 0) {
        parts.forEach((sp) => {
          let returnedQty = 0;
          if (sp.usage && sp.usage.includes('[반품완료]')) {
            returnedQty = sp.quantity;
          } else if (sp.usage && sp.usage.includes('[부분반품:')) {
            const matches = sp.usage.match(/\[부분반품:(\d+)개\]/g);
            if (matches) {
              matches.forEach(m => {
                const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
                if (qtyMatch && qtyMatch[1]) returnedQty += parseInt(qtyMatch[1], 10);
              });
            }
          }
          const effectiveQty = Math.max(0, Number(sp.quantity || 1) - returnedQty);

          const unitPrice = sp.price !== undefined && sp.price !== null ? Number(sp.price) : Number(sp.parts?.price || 0);
          const total = unitPrice * effectiveQty;
          if (effectiveQty > 0 || Number(sp.quantity || 1) > 0) {
            const pName = sp.parts?.name || '부품';
            const cat = resolveCategory(pName);
            const brand = resolveBrand(pName);
            const unitCost = resolveCost(pName);
            rows.push({ ...baseFields, part_name: pName, part_category: cat, part_brand: brand, quantity: effectiveQty, total_price: total, total_cost: unitCost * effectiveQty });
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
        _id: o.id, _type: 'cafe24', date_val: o.order_date, sales_channel: '온라인주문', customer_name: o.buyer_name || '-'
      };
      if (items.length === 0) {
        rows.push({ ...baseFields, part_category: '기타', part_brand: '-', quantity: 0, total_price: Number(o.total_amount || 0), total_cost: 0 });
      } else {
        const validItems = items.filter(item => !['C11', 'C40', 'R40', 'E40'].includes(item.order_status));
        if (validItems.length === 0) {
          // 유효 항목이 없으면 건너뛰거나 기본값 처리
          return;
        }

        let totalWeight = validItems.reduce((acc, i) => {
           let qty = Number(i.quantity || 1);
           let p = Number(i.product_price || i.price || 0) * qty;
           return acc + p;
        }, 0);

        validItems.forEach((item, idx) => {
          const itemCode = item.custom_product_code || item.product_code || '';
          let pName = item.product_name || item.name || '상품';
          if (itemCode && partsNameByCode[itemCode]) pName = partsNameByCode[itemCode];
          const itemQty = Number(item.quantity || 1);
          
          let paymentAmt = 0;
          if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
             paymentAmt = Number(item.payment_amount);
          } else {
             paymentAmt = Number(item.product_price || item.price || 0) * itemQty;
          }
          let iPrice = Number(item.product_price || item.price || 0);
          
          let total = 0;

          if (paymentAmt > 0) {
              total = paymentAmt;
              if (iPrice === 0) iPrice = Math.round(paymentAmt / itemQty);
          } else {
              let itemWeight = iPrice * itemQty;

              if (totalWeight > 0) {
                 total = Math.floor((itemWeight / totalWeight) * Number(o.total_amount || 0));
                 if (idx === validItems.length - 1) {
                    let previousTotals = validItems.slice(0, validItems.length - 1).reduce((acc, prevItem) => {
                       let prevQty = Number(prevItem.quantity || 1);
                       let prevWeight = Number(prevItem.product_price || prevItem.price || 0) * prevQty;
                       return acc + Math.floor((prevWeight / totalWeight) * Number(o.total_amount || 0));
                    }, 0);
                    total = Number(o.total_amount || 0) - previousTotals;
                 }
              } else {
                 total = Math.floor(Number(o.total_amount || 0) / validItems.length);
                 if (idx === validItems.length - 1) {
                    total = Number(o.total_amount || 0) - (total * (validItems.length - 1));
                 }
              }
              if (iPrice === 0 && total > 0) iPrice = Math.round(total / itemQty);
          }

          const cat = resolveCategory(pName, itemCode);
          const brand = resolveBrand(pName, itemCode);
          const unitCost = resolveCost(pName, itemCode);
          rows.push({ ...baseFields, part_name: pName, part_category: cat, part_brand: brand, quantity: itemQty, total_price: total, total_cost: unitCost * itemQty });
        });
      }
    });

    setFlatRows(rows);

    // 재고(Inventory) 데이터 가공
    const invQtyMap = {};
    (invRes.data || []).forEach(inv => {
      if (!invQtyMap[inv.product_id]) invQtyMap[inv.product_id] = 0;
      invQtyMap[inv.product_id] += Number(inv.quantity || 0);
    });

    const invRows = [];
    (partsRes.data || []).forEach(p => {
      const qty = invQtyMap[p.id] || 0;
      const supplyPrice = Number(p.supply_price || 0);
      const cat = resolveCategory(p.name, p.code);
      const brand = resolveBrand(p.name, p.code);
      
      // 재고 수량 무관하게 모두 리포트에 표시
      invRows.push({
        part_id: p.id,
        part_name: p.name || '-',
        brand: brand,
        category: cat,
        supply_price: supplyPrice,
        quantity: qty,
        amount: supplyPrice * qty,
        rental: '-', // 대여 정보 (추후 확장을 위해)
        defective: '-' // 불량 정보 (추후 확장을 위해)
      });
    });

    setInventoryList(invRows);
    setLoading(false);
  };

  const currentFiltered = flatRows.filter(r => {
    if (filterType !== 'all' && r._type !== filterType) return false;
    if (filterBrand !== '전체' && r.part_brand !== filterBrand) return false;
    return true;
  });

  // 월별, 주별 데이터 가공 (필터링된 데이터 기준)
  const { monthlyStats, weeklyStats } = React.useMemo(() => {
    const mMap = {};
    const wMap = {};
    currentFiltered.forEach(r => {
      const d = new Date(r.date_val);
      const mKey = format(d, 'yyyy-MM');
      const wStart = startOfWeek(d, { weekStartsOn: 1 });
      const wEnd = endOfWeek(d, { weekStartsOn: 1 });
      const wKey = format(wStart, 'yyyy-MM-dd');
      
      if (!mMap[mKey]) mMap[mKey] = { period: format(d, 'yyyy년 MM월'), amount: 0, cost: 0, profit: 0 };
      if (!wMap[wKey]) wMap[wKey] = { period: `${format(wStart, 'MM.dd')} ~ ${format(wEnd, 'MM.dd')}`, amount: 0, cost: 0, profit: 0 };
      
      const amt = Number(r.total_price || 0);
      const cost = Number(r.total_cost || 0);
      
      mMap[mKey].amount += amt;
      mMap[mKey].cost += cost;
      mMap[mKey].profit += (amt - cost);

      wMap[wKey].amount += amt;
      wMap[wKey].cost += cost;
      wMap[wKey].profit += (amt - cost);
    });

    return {
      monthlyStats: Object.values(mMap).sort((a, b) => a.period.localeCompare(b.period)),
      weeklyStats: Object.values(wMap).sort((a, b) => a.period.localeCompare(b.period))
    };
  }, [currentFiltered]);

  // 요약
  const totalAmt = currentFiltered.reduce((a, r) => a + Number(r.total_price || 0), 0);
  const totalQty = currentFiltered.reduce((a, r) => a + Number(r.quantity || 0), 0);

  const uniqueGroups = {
    service: new Set(),
    store: new Set(),
    online: new Set(),
    agency: new Set()
  };

  const groupAmounts = {
    service: 0,
    store: 0,
    online: 0,
    agency: 0
  };

  currentFiltered.forEach(r => {
    const price = Number(r.total_price || 0);
    if (r._type === 'service') {
      if (r._id) uniqueGroups.service.add(r._id);
      groupAmounts.service += price;
    } else {
      const isAgency = r.sales_channel && !['고객', '-', '일반출고(공홈)', '온라인주문', '매장출고', '청담매장', '기타', '본점'].includes(r.sales_channel) && (agenciesList.includes(r.sales_channel) || r.sales_channel?.includes('대리점'));
      if (isAgency) {
        if (r._id) uniqueGroups.agency.add(r._id);
        groupAmounts.agency += price;
      } else if (r.sales_channel === '온라인주문' || r._type === 'cafe24') {
        if (r._id) uniqueGroups.online.add(r._id);
        groupAmounts.online += price;
      } else {
        if (r._id) uniqueGroups.store.add(r._id);
        groupAmounts.store += price;
      }
    }
  });

  const countService = uniqueGroups.service.size;
  const countStore = uniqueGroups.store.size;
  const countOnline = uniqueGroups.online.size;
  const countAgency = uniqueGroups.agency.size;

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
    // 개편된 보고서용 다차원 그룹화 로직 (브랜드별, 채널별 종합)
  const { comprehensiveSalesGroups, comprehensiveInventoryGroups } = React.useMemo(() => {
    // 1. 판매 매출 그룹화
    // 구조: CustomerType(대리점/일반고객/A/S) -> Brand -> ItemKey -> { qty, amount }
    const sGroupData = {};
    
    currentFiltered.forEach(r => {
      let brand = r.part_brand || '기타';
      if (brand === '-') brand = '기타';
      
      const ch = r.sales_channel || '';
      
      // 대분류: 대리점 / 일반고객 / A/S
      let customerType = '일반 고객 매출';
      
      if (r._type === 'service') {
        customerType = 'A/S 매출';
      } else {
        const isAgency = agenciesList.some(a => r.customer_name?.includes(a) || r.sales_channel?.includes(a)) || ch.includes('대리점');
        if (isAgency) {
          customerType = '대리점 매출';
        } else {
          customerType = '일반 고객 매출';
        }
      }
      
      // 기체 vs 파츠 분류
      let pName = r.part_name || '상품';
      
      const isAirframe = r.part_category === '기체';
      const isService = r._type === 'service';
      
      const qty = Number(r.quantity || 0);
      const amt = Number(r.total_price || 0);
      const cost = Number(r.total_cost || 0);

      if (!sGroupData[customerType]) {
        sGroupData[customerType] = { customerType, brands: {}, totalQty: 0, totalAmt: 0, totalCost: 0, totalProfit: 0 };
      }
      
      const typeNode = sGroupData[customerType];
      if (!typeNode.brands[brand]) {
        typeNode.brands[brand] = { brand, items: {}, subtotalQty: 0, subtotalAmt: 0, subtotalCost: 0, subtotalProfit: 0 };
      }
      
      const brandNode = typeNode.brands[brand];
      
      let itemKey = '';
      let itemName = '';
      
      if (isService) {
        itemKey = 'as_total';
        itemName = 'A/S 처리 (공임/부품 포함)';
      } else if (!isAirframe) {
        itemKey = 'parts_total';
        itemName = '[ 파츠 총합 ]';
      } else {
        itemKey = pName;
        itemName = pName;
      }
      
      if (!brandNode.items[itemKey]) {
         brandNode.items[itemKey] = { name: itemName, isAirframe, isService, quantity: 0, amount: 0, cost: 0, profit: 0 };
      }
      
      brandNode.items[itemKey].quantity += qty;
      brandNode.items[itemKey].amount += amt;
      brandNode.items[itemKey].cost += cost;
      brandNode.items[itemKey].profit += (amt - cost);
      
      brandNode.subtotalQty += qty;
      brandNode.subtotalAmt += amt;
      brandNode.subtotalCost += cost;
      brandNode.subtotalProfit += (amt - cost);

      typeNode.totalQty += qty;
      typeNode.totalAmt += amt;
      typeNode.totalCost += cost;
      typeNode.totalProfit += (amt - cost);
    });

    const typeOrder = { '대리점 매출': 1, '일반 고객 매출': 2, 'A/S 매출': 3 };
    const salesArr = Object.values(sGroupData).map(t => ({
      ...t,
      brandsArr: Object.values(t.brands).map(b => ({
        ...b,
        itemsArr: Object.values(b.items).sort((i1, i2) => {
             if (i1.isService) return 1;
             if (i2.isService) return -1;
             if (i1.isAirframe && !i2.isAirframe) return -1;
             if (!i1.isAirframe && i2.isAirframe) return 1;
             return i2.amount - i1.amount;
        })
      })).sort((a,b) => b.subtotalAmt - a.subtotalAmt)
    })).sort((a,b) => (typeOrder[a.customerType] || 99) - (typeOrder[b.customerType] || 99));

    // 2. 재고 현황 그룹화
    // 구조: Brand -> ItemKey -> { qty, amount }
    const iGroupData = {};
    
    inventoryList.forEach(inv => {
      let brand = inv.brand || '기타';
      if (brand === '-') brand = '기타';
      
      const pName = inv.part_name || '상품';
      const isAirframe = inv.category === '기체';
      const qty = Number(inv.quantity || 0);
      const amt = Number(inv.amount || 0);
      
        if (!iGroupData[brand]) {
          iGroupData[brand] = { brand, items: {}, totalQty: 0, totalAmt: 0 };
        }
        
        const brandNode = iGroupData[brand];
        
        let itemKey = '';
        let itemName = '';
        
        if (!isAirframe) {
          itemKey = 'parts_total';
          itemName = '[ 파츠 종합 ]';
        } else {
          itemKey = pName;
          itemName = pName;
        }
        
        if (!brandNode.items[itemKey]) {
          brandNode.items[itemKey] = { name: itemName, isAirframe, quantity: 0, amount: 0 };
        }
        
        brandNode.items[itemKey].quantity += qty;
        brandNode.items[itemKey].amount += amt;
        
        brandNode.totalQty += qty;
        brandNode.totalAmt += amt;
    });
    
    const invArr = Object.values(iGroupData).map(b => ({
      ...b,
      itemsArr: Object.values(b.items).sort((i1, i2) => {
         if (i1.isAirframe && !i2.isAirframe) return -1;
         if (!i1.isAirframe && i2.isAirframe) return 1;
         return i2.amount - i1.amount;
      })
    })).sort((a,b) => b.totalAmt - a.totalAmt);

    return {
      comprehensiveSalesGroups: salesArr,
      comprehensiveInventoryGroups: invArr
    };
  }, [currentFiltered, agenciesList, inventoryList]);
  return (
    <Box sx={{ p: 3, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>판매현황 통합 통계</Typography>
      </Box>

      {/* 필터 영역 */}
      <Paper sx={{ p: 3, mb: 3, borderLeft: '4px solid #3182f6' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#3182f6' }}>
          검색 필터
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3, alignItems: 'flex-start' }}>
          {/* 연도 선택 */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              연도 선택
            </Typography>
            <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {(() => {
                const minYear = 2022;
                const years = [];
                for (let year = currentYear; year >= minYear; year--) {
                  years.push(year);
                }
                return years.map((year) => (
                  <Button
                    key={year}
                    onClick={() => handleYearSelect(year)}
                    sx={{
                      minWidth: '60px',
                      backgroundColor: selectedYear === year ? 'primary.main' : 'inherit',
                      color: selectedYear === year ? 'white' : 'inherit',
                      fontWeight: selectedYear === year ? 'bold' : 'normal',
                      '&:hover': { backgroundColor: selectedYear === year ? 'primary.dark' : '' }
                    }}
                  >
                    {year}년
                  </Button>
                ));
              })()}
            </ButtonGroup>
          </Box>

          {/* 월별 버튼 그룹 */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
              월 선택
              {selectedMonth !== null && (
                <Box component="span" sx={{
                  ml: 2, py: 0.5, px: 1.5, borderRadius: 1, backgroundColor: '#e3f2fd', fontSize: '0.9rem', color: '#1976d2', display: 'inline-flex', alignItems: 'center'
                }}>
                  현재 선택: {selectedMonth + 1}월 ({format(startDate, 'yyyy-MM-dd')} ~ {format(endDate, 'yyyy-MM-dd')})
                </Box>
              )}
            </Typography>
            <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {[...Array(12)].map((_, idx) => (
                <Button
                  key={idx}
                  onClick={() => handleMonthSelect(idx)}
                  sx={{
                    minWidth: '40px',
                    backgroundColor: selectedMonth === idx ? 'primary.main' : 'inherit',
                    color: selectedMonth === idx ? 'white' : 'inherit',
                    fontWeight: selectedMonth === idx ? 'bold' : 'normal',
                    '&:hover': { backgroundColor: selectedMonth === idx ? 'primary.dark' : '' }
                  }}
                >
                  {idx + 1}월
                </Button>
              ))}
            </ButtonGroup>
          </Box>

        {/* 필터 옵션 및 조회 버튼 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DatePicker
              label="시작일"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
            />
            <DatePicker
              label="종료일"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
            />
          </LocalizationProvider>

          <FormControl size="small" sx={{ width: 120 }}>
            <InputLabel>구분</InputLabel>
            <Select value={filterType} label="구분" onChange={(e) => setFilterType(e.target.value)}>
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="shipment">매장출고</MenuItem>
              <MenuItem value="cafe24">온라인주문</MenuItem>
              <MenuItem value="service">A/S</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: 120 }}>
            <InputLabel>브랜드</InputLabel>
            <Select value={filterBrand} label="브랜드" onChange={(e) => setFilterBrand(e.target.value)}>
              <MenuItem value="전체">전체</MenuItem>
              <MenuItem value="XRB">XRB</MenuItem>
              <MenuItem value="NEARBIKE">NEARBIKE</MenuItem>
              <MenuItem value="기타">기타</MenuItem>
            </Select>
          </FormControl>

          <Button variant="contained" onClick={fetchSales} disabled={loading} sx={{ height: 40, bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, px: 4 }} startIcon={<SearchIcon />}>조회</Button>
          
          <FormControlLabel
            control={<Switch checked={showProfit} onChange={(e) => setShowProfit(e.target.checked)} color="primary" />}
            label={<Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: showProfit ? '#2e7d32' : 'text.secondary' }}>영업이익 보기</Typography>}
            sx={{ ml: 'auto' }}
          />
        </Box>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* 요약 카드 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card sx={{ bgcolor: '#1976d2', color: 'white', height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>총 판매 합계</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>{formatCurrency(totalAmt)}</Typography>
                  {compareStats.context && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                      {compareStats.context === 'month' ? (
                        <>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <span>전월 대비:</span>
                            <span style={{ fontWeight: 'bold', color: compareStats.mom > 0 ? '#69f0ae' : (compareStats.mom < 0 ? '#ff5252' : 'inherit') }}>
                              {compareStats.mom > 0 ? '▲ ' : (compareStats.mom < 0 ? '▼ ' : '')}
                              {compareStats.mom !== null ? Math.abs(compareStats.mom).toFixed(1) + '%' : '-'}
                            </span>
                          </Typography>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>전년 동월 대비:</span>
                            <span style={{ fontWeight: 'bold', color: compareStats.yoy > 0 ? '#69f0ae' : (compareStats.yoy < 0 ? '#ff5252' : 'inherit') }}>
                              {compareStats.yoy > 0 ? '▲ ' : (compareStats.yoy < 0 ? '▼ ' : '')}
                              {compareStats.yoy !== null ? Math.abs(compareStats.yoy).toFixed(1) + '%' : '-'}
                            </span>
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <span>전주 대비:</span>
                            <span style={{ fontWeight: 'bold', color: compareStats.wow > 0 ? '#69f0ae' : (compareStats.wow < 0 ? '#ff5252' : 'inherit') }}>
                              {compareStats.wow > 0 ? '▲ ' : (compareStats.wow < 0 ? '▼ ' : '')}
                              {compareStats.wow !== null ? Math.abs(compareStats.wow).toFixed(1) + '%' : '-'}
                            </span>
                          </Typography>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>전년 동주 대비:</span>
                            <span style={{ fontWeight: 'bold', color: compareStats.yoyWeek > 0 ? '#69f0ae' : (compareStats.yoyWeek < 0 ? '#ff5252' : 'inherit') }}>
                              {compareStats.yoyWeek > 0 ? '▲ ' : (compareStats.yoyWeek < 0 ? '▼ ' : '')}
                              {compareStats.yoyWeek !== null ? Math.abs(compareStats.yoyWeek).toFixed(1) + '%' : '-'}
                            </span>
                          </Typography>
                        </>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>구분별 주문/처리 건수</Typography>
                  <Stack direction="row" justifyContent="space-around" alignItems="center" sx={{ width: '100%' }} divider={<Divider orientation="vertical" flexItem />}>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">매장 출고</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>{countStore.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                      <Typography variant="body2" color="text.secondary">{groupAmounts.store.toLocaleString()}원</Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">온라인 출고</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0288d1' }}>{countOnline.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                      <Typography variant="body2" color="text.secondary">{groupAmounts.online.toLocaleString()}원</Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">대리점 (B2B)</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{countAgency.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                      <Typography variant="body2" color="text.secondary">{groupAmounts.agency.toLocaleString()}원</Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">A/S 수리</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ed6c02' }}>{countService.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                      <Typography variant="body2" color="text.secondary">{groupAmounts.service.toLocaleString()}원</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">판매된 총 물품 수량</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>{totalQty.toLocaleString()}</Typography>
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

          <Box sx={{ mt: 5, mb: 3 }}>
            <Paper sx={{ mb: 3 }}>
              <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="통합 매출 및 재고 보고서" icon={<AssessmentIcon />} iconPosition="start" />
                <Tab label="월별 매출 통계" />
                <Tab label="주별 매출 통계" />
              </Tabs>
            </Paper>
            
            {tabValue === 0 && (
              <Grid container spacing={4}>
              {/* 왼쪽: 판매 매출 */}
              <Grid item xs={12} xl={6}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#424242' }}>
                  [1] 판매 현황 (총 판매 합계: {formatCurrency(totalAmt)})
                </Typography>
                <TableContainer component={Paper} sx={{ border: '1px solid #cfd8dc', borderRadius: 1, boxShadow: 'none' }}>
                  <Table size="small" sx={{ 
                    '& th, & td': { border: '1px solid #cfd8dc', padding: '8px 10px' },
                    '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' },
                    '& td': { fontSize: '0.85rem' }
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width={showProfit ? "15%" : "20%"}>매출 구분 (고객유형)</TableCell>
                        <TableCell width={showProfit ? "15%" : "20%"}>브랜드</TableCell>
                        <TableCell width={showProfit ? "25%" : "40%"}>상품명 (기종-색상 / 파츠)</TableCell>
                        <TableCell width="8%">수량</TableCell>
                        {showProfit && <TableCell width="12%">원가 총액</TableCell>}
                        <TableCell width="12%">판매 금액</TableCell>
                        {showProfit && <TableCell width="10%">영업이익</TableCell>}
                        {showProfit && <TableCell width="8%">이익률</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comprehensiveSalesGroups.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>조회된 매출 데이터가 없습니다.</TableCell></TableRow>
                      ) : (
                        comprehensiveSalesGroups.map((t, tIdx) => {
                          const typeRowSpan = t.brandsArr.reduce((sum, b) => sum + b.itemsArr.length + 1, 0); // +1 for brand subtotal
                          
                          return t.brandsArr.map((b, bIdx) => {
                            const brandRowSpan = b.itemsArr.length + 1; // +1 for subtotal
                            
                            return (
                              <React.Fragment key={`${tIdx}-${bIdx}`}>
                                {b.itemsArr.map((item, iIdx) => (
                                  <TableRow key={`${tIdx}-${bIdx}-${iIdx}`} hover>
                                    {bIdx === 0 && iIdx === 0 && (
                                      <TableCell rowSpan={typeRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                        {t.customerType}
                                      </TableCell>
                                    )}
                                    {iIdx === 0 && (
                                      <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', borderRight: '1px solid #cfd8dc' }}>
                                        {b.brand}
                                      </TableCell>
                                    )}
                                    <TableCell sx={{ color: item.isService ? '#ed6c02' : (!item.isAirframe ? '#607d8b' : 'inherit'), fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                      {item.name}
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontWeight: !item.isAirframe || item.isService ? 'bold' : 'normal' }}>
                                      {item.quantity}
                                    </TableCell>
                                    {showProfit && (
                                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                        {formatCurrency(item.cost)}
                                      </TableCell>
                                    )}
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                      {formatCurrency(item.amount)}
                                    </TableCell>
                                    {showProfit && (
                                      <TableCell align="right" sx={{ fontWeight: 'bold', color: item.profit < 0 ? '#d32f2f' : '#2e7d32' }}>
                                        {formatCurrency(item.profit)}
                                      </TableCell>
                                    )}
                                    {showProfit && (
                                      <TableCell align="center" sx={{ fontWeight: 'bold', color: item.profit < 0 ? '#d32f2f' : '#2e7d32' }}>
                                        {item.amount > 0 ? ((item.profit / item.amount) * 100).toFixed(1) + '%' : '-'}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                                {/* 브랜드별 소계 행 */}
                                <TableRow sx={{ bgcolor: '#f1f8e9' }}>
                                  <TableCell sx={{ fontWeight: 'bold', color: '#33691e', fontSize: '0.8rem' }} align="right">[{b.brand} 소계]</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#33691e' }}>{b.subtotalQty}</TableCell>
                                  {showProfit && (
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#33691e' }}>{formatCurrency(b.subtotalCost)}</TableCell>
                                  )}
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#33691e' }}>{formatCurrency(b.subtotalAmt)}</TableCell>
                                  {showProfit && (
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: b.subtotalProfit < 0 ? '#d32f2f' : '#2e7d32' }}>{formatCurrency(b.subtotalProfit)}</TableCell>
                                  )}
                                  {showProfit && (
                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: b.subtotalProfit < 0 ? '#d32f2f' : '#2e7d32' }}>
                                      {b.subtotalAmt > 0 ? ((b.subtotalProfit / b.subtotalAmt) * 100).toFixed(1) + '%' : '-'}
                                    </TableCell>
                                  )}
                                </TableRow>
                              </React.Fragment>
                            );
                          });
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* 오른쪽: 재고 현황 */}
              <Grid item xs={12} xl={6}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#424242' }}>
                  [2] 창고 종합 재고 현황
                </Typography>
                <TableContainer component={Paper} sx={{ border: '1px solid #cfd8dc', borderRadius: 1, boxShadow: 'none' }}>
                  <Table size="small" sx={{ 
                    '& th, & td': { border: '1px solid #cfd8dc', padding: '8px 10px' },
                    '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' },
                    '& td': { fontSize: '0.85rem' }
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width="15%">창고</TableCell>
                        <TableCell width="15%">브랜드</TableCell>
                        <TableCell width="40%">품목 (기종-색상 / 파츠 종합)</TableCell>
                        <TableCell width="15%">재고 수량</TableCell>
                        <TableCell width="15%">재고 금액(도매가)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comprehensiveInventoryGroups.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>재고 데이터가 없습니다.</TableCell></TableRow>
                      ) : (
                        comprehensiveInventoryGroups.map((b, bIdx) => {
                          const brandRowSpan = b.itemsArr.length;
                          return b.itemsArr.map((item, iIdx) => (
                            <TableRow key={`inv-${bIdx}-${iIdx}`} hover>
                              {bIdx === 0 && iIdx === 0 && (
                                <TableCell 
                                  rowSpan={comprehensiveInventoryGroups.reduce((acc, br) => acc + br.itemsArr.length, 0)} 
                                  align="center" 
                                  sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}
                                >
                                  전체 (종합)
                                </TableCell>
                              )}
                              {iIdx === 0 && (
                                <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                  {b.brand}
                                </TableCell>
                              )}
                              <TableCell sx={{ color: !item.isAirframe ? '#607d8b' : 'inherit', fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                {item.name}
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                {item.quantity}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(item.amount)}
                              </TableCell>
                            </TableRow>
                          ));
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              </Grid>
            )}

            {tabValue === 1 && (
              <TableContainer component={Paper} sx={{ border: '1px solid #cfd8dc', borderRadius: 1, boxShadow: 'none' }}>
                <Table size="small" sx={{ '& th, & td': { border: '1px solid #cfd8dc', padding: '8px 10px' }, '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center' }}}>
                  <TableHead>
                    <TableRow>
                      <TableCell>월</TableCell>
                      <TableCell>총 판매 금액</TableCell>
                      {showProfit && <TableCell>총 원가</TableCell>}
                      {showProfit && <TableCell>영업이익</TableCell>}
                      {showProfit && <TableCell>이익률</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthlyStats.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center">조회된 월별 데이터가 없습니다.</TableCell></TableRow>
                    ) : (
                      monthlyStats.map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell align="center">{row.period}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(row.amount)}</TableCell>
                          {showProfit && <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(row.cost)}</TableCell>}
                          {showProfit && <TableCell align="right" sx={{ fontWeight: 'bold', color: row.profit < 0 ? '#d32f2f' : '#2e7d32' }}>{formatCurrency(row.profit)}</TableCell>}
                          {showProfit && <TableCell align="center" sx={{ fontWeight: 'bold', color: row.profit < 0 ? '#d32f2f' : '#2e7d32' }}>
                            {row.amount > 0 ? ((row.profit / row.amount) * 100).toFixed(1) + '%' : '-'}
                          </TableCell>}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {tabValue === 2 && (
              <TableContainer component={Paper} sx={{ border: '1px solid #cfd8dc', borderRadius: 1, boxShadow: 'none' }}>
                <Table size="small" sx={{ '& th, & td': { border: '1px solid #cfd8dc', padding: '8px 10px' }, '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center' }}}>
                  <TableHead>
                    <TableRow>
                      <TableCell>주차 (월~일)</TableCell>
                      <TableCell>총 판매 금액</TableCell>
                      {showProfit && <TableCell>총 원가</TableCell>}
                      {showProfit && <TableCell>영업이익</TableCell>}
                      {showProfit && <TableCell>이익률</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {weeklyStats.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center">조회된 주별 데이터가 없습니다.</TableCell></TableRow>
                    ) : (
                      weeklyStats.map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell align="center">{row.period}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(row.amount)}</TableCell>
                          {showProfit && <TableCell align="right" sx={{ color: 'text.secondary' }}>{formatCurrency(row.cost)}</TableCell>}
                          {showProfit && <TableCell align="right" sx={{ fontWeight: 'bold', color: row.profit < 0 ? '#d32f2f' : '#2e7d32' }}>{formatCurrency(row.profit)}</TableCell>}
                          {showProfit && <TableCell align="center" sx={{ fontWeight: 'bold', color: row.profit < 0 ? '#d32f2f' : '#2e7d32' }}>
                            {row.amount > 0 ? ((row.profit / row.amount) * 100).toFixed(1) + '%' : '-'}
                          </TableCell>}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

export default SalesHistoryStats;
