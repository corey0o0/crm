import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableFooter,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Container,
  ButtonGroup,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { getCafe24Malls } from '../../utils/cafe24Api';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, parseISO, startOfYear, endOfYear, getMonth, startOfDay, endOfDay } from 'date-fns';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function OnlineStats() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [stats, setStats] = useState({ totalPayment: 0, orderCount: 0, list: [], agencyStats: {}, brandStats: {}, totals: {} });
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [brands, setBrands] = useState(['전체']);
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [malls, setMalls] = useState([]);
  const [selectedMall, setSelectedMall] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);
  const [rawOrders, setRawOrders] = useState([]);
  const [agencyMapGlobal, setAgencyMapGlobal] = useState({});

  useEffect(() => {
    const fetchMalls = async () => {
      try {
        const res = await getCafe24Malls();
        if (res.success && res.malls) {
          setMalls(res.malls.filter(m => m.connected));
        }
      } catch (err) {}
    };
    fetchMalls();
  }, []);
  
  const currentMonth = getMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 연도 선택 핸들러
  const handleYearSelect = (year) => {
    setSelectedYear(year);
    const newStartDate = startOfYear(new Date(year, 0, 1));
    const newEndDate = endOfYear(new Date(year, 11, 31));
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setSelectedMonth(null);
    fetchData(newStartDate, newEndDate, selectedBrand);
  };

  // 월 선택 핸들러
  const handleMonthSelect = (monthIndex) => {
    const newDate = new Date(selectedYear, monthIndex, 1);
    const newStartDate = startOfMonth(newDate);
    const newEndDate = endOfMonth(newDate);
    setSelectedMonth(monthIndex);
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    fetchData(newStartDate, newEndDate, selectedBrand);
  };

  // 쇼핑몰 선택 핸들러
  const handleMallSelect = (mallId) => {
    setSelectedMall(mallId);
    fetchData(startDate, endDate, selectedBrand, mallId);
  };

  const handleOpenModal = (title, dataFilter) => {
    setModalTitle(title);
    const items = [];
    rawOrders.forEach(o => {
      const agName = o.agency_id ? (agencyMapGlobal[o.agency_id] || '미등록 대리점') : '일반 주문';
      (o.order_items || []).forEach(item => {
        if (dataFilter(o, agName, item, item._isAirframe, item._brand)) {
           const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
           items.push({
             ...item,
             order_id: o.order_id,
             order_date: o.order_date,
             buyer_name: o.buyer_name,
             agency_name: agName,
             isCancelled,
             total_price: item._calculated_amount !== undefined ? item._calculated_amount : (Number(item.quantity || 1) * Number(item.product_price || item.price || 0))
           });
        }
      });
    });
    items.sort((a, b) => {
      if (a._isAirframe && !b._isAirframe) return -1;
      if (!a._isAirframe && b._isAirframe) return 1;
      return 0;
    });
    setModalData(items);
    setModalOpen(true);
  };

  // 브랜드 선택 핸들러
  const handleBrandSelect = (brand) => {
    setSelectedBrand(brand);
    fetchData(startDate, endDate, brand);
  };

  const formatDateToStartOfDay = (date) => format(date, 'yyyy-MM-dd') + 'T00:00:00+09:00';
  const formatDateToEndOfDay = (date) => format(date, 'yyyy-MM-dd') + 'T23:59:59+09:00';

  const fetchData = async (qStart, qEnd, qBrand = selectedBrand, qMall = selectedMall) => {
    setLoading(true);
    try {
      const startDateTime = formatDateToStartOfDay(qStart || startDate);
      const endDateTime = formatDateToEndOfDay(qEnd || endDate);

      const yearStart = formatDateToStartOfDay(startOfYear(qStart || startDate));
      const yearEnd = formatDateToEndOfDay(endOfYear(qStart || startDate));

      let orderQuery = supabase.from('cafe24_orders').select('*').gte('order_date', startDateTime).lte('order_date', endDateTime).eq('is_deleted', false).eq('is_transferred', true);
      let chartQuery = supabase.from('cafe24_orders').select('order_date, total_amount, mall_id').gte('order_date', yearStart).lte('order_date', yearEnd).eq('is_deleted', false).eq('is_transferred', true);
      
      if (qMall !== 'all') {
        orderQuery = orderQuery.eq('mall_id', qMall);
        chartQuery = chartQuery.eq('mall_id', qMall);
      }

      const [
        { data: cafe24Orders, error },
        { data: agenciesData },
        { data: partsData },
        { data: chartDataRaw }
      ] = await Promise.all([
        orderQuery,
        supabase.from('agencies').select('id, name'),
        supabase.from('parts').select('id, code, barcode, brand, note, price, name'),
        chartQuery
      ]);

      if (error) throw error;

      if (cafe24Orders) {
        let total = 0;
        const agencyStats = {};
        const brandStats = { agency: {}, general: {} };
        const generalProductStats = {};
        const agencyMap = {};
        agenciesData?.forEach(a => { agencyMap[a.id] = a.name; });
        setAgencyMapGlobal(agencyMap);
        setRawOrders(cafe24Orders);
        const partMapById = {};
        const partMapByCode = {};
        const brandSet = new Set(['XRB', 'NB']);
        partsData?.forEach(p => { 
          partMapById[p.id] = p; 
          if (p.code) partMapByCode[String(p.code).trim()] = p;
          if (p.barcode) partMapByCode[String(p.barcode).trim()] = p;
          if (p.brand && p.brand.trim() !== '') brandSet.add(p.brand.trim());
        });
        setBrands(['전체', ...Array.from(brandSet).sort()]);

        let filteredOrderCount = 0;
        const filteredList = [];
        
        let totalB2BAirframeQty = 0, totalB2BAirframeAmt = 0, totalB2BPartsQty = 0, totalB2BPartsAmt = 0;
        let totalB2CAirframeQty = 0, totalB2CAirframeAmt = 0, totalB2CPartsQty = 0, totalB2CPartsAmt = 0;

        cafe24Orders.forEach(o => {
          let orderTotalForBrand = 0;
          let hasMatchingBrand = false;

          const agName = o.agency_id ? (agencyMap[o.agency_id] || `미등록 대리점`) : '일반 주문';
          if (!agencyStats[agName]) agencyStats[agName] = { amount: 0, count: 0, airframe: 0, airframeAmount: 0, parts: 0, partsAmount: 0 };

          const validItems = (o.order_items || []).filter(
            item => !['C11', 'C40', 'R40', 'E40'].includes(item.order_status)
          );
          if (validItems.length === 0) return; // 전액 취소건은 제외
          
          let totalWeight = 0;
          validItems.forEach(i => {
              const pCode = String(i.custom_product_code || i.product_code || '').trim();
              const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
              const pPrice = Number(i.product_price || i.price || (p ? p.price : 0));
              totalWeight += pPrice * Number(i.quantity || 1);
          });
          const totalQty = validItems.reduce((acc, i) => acc + Number(i.quantity || 1), 0);

          if (validItems.length > 0) {
             let seenProductCodes = new Set();
             validItems.forEach((item, idx) => {
               const pCode = String(item.custom_product_code || item.product_code || '').trim();
               const pName = item.name || item.product_name || '';
               const p = item.part_id ? partMapById[item.part_id] : (pCode ? partMapByCode[pCode] : null);
               
               let qty = Number(item.quantity || 1);
               let statQty = qty;
               if (pCode) {
                   if (seenProductCodes.has(pCode)) {
                       statQty = 0;
                   } else {
                       seenProductCodes.add(pCode);
                   }
               }
               
               let amount = 0;
               let isExplicitlyZero = item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) === 0;
               if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
                   amount = Number(item.payment_amount);
               } else if (isExplicitlyZero) {
                   amount = 0;
               } else {
                   const canceledItems = (o.order_items || []).filter(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
                   const canceledAmount = canceledItems.reduce((acc, it) => acc + (Number(it.product_price || it.price || 0) * Number(it.quantity || 1)), 0);
                   const distributableAmount = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0) - canceledAmount);
                   
                   if (totalWeight > 0) {
                       const pPrice = Number(item.product_price || item.price || (p ? p.price : 0));
                       amount = Math.floor(((pPrice * qty) / totalWeight) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               const prevPCode = String(prev.custom_product_code || prev.product_code || '').trim();
                               const prevP = prev.part_id ? partMapById[prev.part_id] : (prevPCode ? partMapByCode[prevPCode] : null);
                               const prevPrice = Number(prev.product_price || prev.price || (prevP ? prevP.price : 0));
                               return acc + Math.floor(((prevPrice * Number(prev.quantity || 1)) / totalWeight) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   } else if (totalQty > 0) {
                       amount = Math.floor((qty / totalQty) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor((Number(prev.quantity || 1) / totalQty) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   }
               }
               
               item._calculated_amount = amount;
               const isAirframe = p ? (p.note?.includes('기체')) : (pName.includes('기체') || pName.includes('차체'));
               let sup = p ? (p.brand || '') : '';
               if (!sup || sup.trim() === '' || sup === '기타 브랜드') {
                  if (o.mall_id === 'slimpack79') sup = 'XRB';
                  else if (o.mall_id === 'nearbike') sup = 'NB';
                  else sup = '기타 브랜드';
               }
               item._brand = sup;
               item._isAirframe = isAirframe;

               if (qBrand !== '전체' && sup !== qBrand) {
                 return; // 현재 선택된 브랜드가 아니면 패스
               }

               // 취소된 항목은 통계 집계에서 제외
               const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
               if (isCancelled) {
                 return;
               }

               hasMatchingBrand = true;
               orderTotalForBrand += amount;
               
               if (!o._validOrderTotal) o._validOrderTotal = 0;
               o._validOrderTotal += amount;
               
               if (!agencyStats[agName]) agencyStats[agName] = { amount: 0, count: 0, airframe: 0, airframeAmount: 0, parts: 0, partsAmount: 0 };
               
               if (isAirframe) {
                  agencyStats[agName].airframe += statQty;
                  agencyStats[agName].airframeAmount += amount;
               } else {
                   agencyStats[agName].parts += statQty;
                   agencyStats[agName].partsAmount += amount;
                }

                const isGeneral = !o.agency_id;
                const customerType = isGeneral ? 'general' : 'agency';

                if (isGeneral) {
                    if (isAirframe) {
                        totalB2CAirframeQty += statQty;
                        totalB2CAirframeAmt += amount;
                    } else {
                        totalB2CPartsQty += statQty;
                        totalB2CPartsAmt += amount;
                    }
                } else {
                    if (isAirframe) {
                        totalB2BAirframeQty += statQty;
                        totalB2BAirframeAmt += amount;
                    } else {
                        totalB2BPartsQty += statQty;
                        totalB2BPartsAmt += amount;
                    }
                }

                if (!brandStats[customerType]) {
                  brandStats[customerType] = {};
                }
                if (!brandStats[customerType][sup]) {
                  brandStats[customerType][sup] = { airframes: {}, airframeTotalQty: 0, parts: 0, airframeAmount: 0, partsAmount: 0 };
                }
                
                if (isAirframe) {
                     let modelName = p.name || item.name || '알 수 없는 기체';
                     if (item.options) {
                        const colorMatch = item.options.match(/색상=([^,]+)/);
                        if (colorMatch) {
                           const extractedColor = colorMatch[1].trim();
                           
                           // 이름에 이미 ' - 색상' 형태가 포함된 경우 (예: 레트로 FS - 샌드 베이지)
                           // 베이스 모델명만 추출하여 실제 선택된 옵션 색상을 붙여줌
                           if (modelName.includes(' - ')) {
                              modelName = modelName.split(' - ')[0];
                           }
                           
                           // 만약 어떻게든 베이스 모델명에 색상이 포함되어있지 않다면 (혹은 '-' 가 없었다면)
                           if (!modelName.replace(/\s/g, '').includes(extractedColor.replace(/\s/g, ''))) {
                              modelName += ` (${extractedColor})`;
                           }
                        }
                     }

                     if (!brandStats[customerType][sup].airframes[modelName]) {
                        brandStats[customerType][sup].airframes[modelName] = { qty: 0, amount: 0 };
                     }
                     brandStats[customerType][sup].airframes[modelName].qty += statQty;
                     brandStats[customerType][sup].airframes[modelName].amount += amount;

                     brandStats[customerType][sup].airframeTotalQty += statQty;
                     brandStats[customerType][sup].airframeAmount += amount;
                  } else {
                     brandStats[customerType][sup].parts += statQty;
                     brandStats[customerType][sup].partsAmount += amount;
                  }

                   // 일반 고객(B2C) 주문인 경우 상품별로 분리하여 집계
                   if (!o.agency_id && p) {
                      if (!generalProductStats[p.id]) {
                        generalProductStats[p.id] = { name: p.name || item.name, category: p.note, quantity: 0, amount: 0 };
                      }
                      generalProductStats[p.id].quantity += statQty;
                      generalProductStats[p.id].amount += amount;
                   }
             });
          }

          if (hasMatchingBrand) {
              const validOrderTotal = (o._validOrderTotal || 0) + Number(o.shipping_fee || 0);
              
              if (qBrand === '전체') {
                 total += validOrderTotal;
                 if (agencyStats[agName]) {
                    agencyStats[agName].amount += validOrderTotal;
                    agencyStats[agName].count += 1;
                 }
              } else {
                 total += orderTotalForBrand;
                 if (agencyStats[agName]) {
                    agencyStats[agName].amount += orderTotalForBrand;
                    agencyStats[agName].count += 1;
                 }
              }
              filteredOrderCount += 1;
              filteredList.push(o);
           }
        });

        setStats({
          totalPayment: total,
          orderCount: filteredOrderCount,
          list: filteredList.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
          agencyStats,
          brandStats,
          generalProductStats,
          totals: {
            b2b: { airframe: totalB2BAirframeQty, airframeAmt: totalB2BAirframeAmt, parts: totalB2BPartsQty, partsAmt: totalB2BPartsAmt },
            b2c: { airframe: totalB2CAirframeQty, airframeAmt: totalB2CAirframeAmt, parts: totalB2CPartsQty, partsAmt: totalB2CPartsAmt }
          }
        });

        const monthlyMap = {};
        for (let i = 1; i <= 12; i++) monthlyMap[i] = { month: `${i}월`, sales: 0 };
        if (cafe24Orders) {
          cafe24Orders.forEach(o => {
            if (qBrand === 'XRB' && o.mall_id !== 'slimpack79') return;
            if (qBrand === 'NB' && o.mall_id !== 'nearbike') return;
            
            // Re-calculate valid total for monthly chart since chartDataRaw lacks items
            const items = o.order_items || [];
            const validItems = items.filter(item => !['C11', 'C40', 'R40', 'E40'].includes(item.order_status));
            let orderItemsSum = 0;
            let totalWeight = validItems.reduce((acc, i) => acc + (Number(i.product_price || i.price || 0) * Number(i.quantity || 1)), 0);
            const totalQty = validItems.reduce((acc, i) => acc + Number(i.quantity || 1), 0);

            validItems.forEach((item, idx) => {
               const qty = Number(item.quantity || 1);
               let amount = 0;
               if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
                   amount = Number(item.payment_amount);
               } else {
                   const canceledItems = items.filter(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
                   const canceledAmount = canceledItems.reduce((acc, it) => acc + (Number(it.product_price || it.price || 0) * Number(it.quantity || 1)), 0);
                   const distributableAmount = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0) - canceledAmount);
                   
                   if (totalWeight > 0) {
                       const pPrice = Number(item.product_price || item.price || 0);
                       amount = Math.floor(((pPrice * qty) / totalWeight) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor(((Number(prev.product_price || prev.price || 0) * Number(prev.quantity || 1)) / totalWeight) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   } else if (totalQty > 0) {
                       amount = Math.floor((qty / totalQty) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor((Number(prev.quantity || 1) / totalQty) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   }
               }
               orderItemsSum += amount;
            });
            const validOrderTotal = orderItemsSum + Number(o.shipping_fee || 0);

            const m = new Date(o.order_date).getMonth() + 1;
            monthlyMap[m].sales += validOrderTotal;
          });
        }
        setMonthlyStats(Object.values(monthlyMap));
      }
    } catch (err) {
      console.error('온라인 통계 집계 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(value);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
          온라인 매출통계
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3, borderLeft: '4px solid #3182f6' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#3182f6' }}>
          검색 필터
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ mb: 3 }} justifyContent="flex-start" alignItems="flex-start">
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
        </Stack>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DatePicker
              label="시작일"
              value={startDate}
              onChange={(newValue) => { 
                setStartDate(newValue); 
                setSelectedMonth(null); 
                fetchData(newValue, endDate, selectedBrand, selectedMall); 
              }}
              slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
            />
            <DatePicker
              label="종료일"
              value={endDate}
              onChange={(newValue) => { 
                setEndDate(newValue); 
                setSelectedMonth(null); 
                fetchData(startDate, newValue, selectedBrand, selectedMall); 
              }}
              slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
            />
          </LocalizationProvider>

          {/* 사이트 필터 */}
          <FormControl size="small" sx={{ minWidth: 140, height: 40 }}>
            <InputLabel>사이트별 조회</InputLabel>
            <Select
              value={selectedMall}
              label="사이트별 조회"
              onChange={(e) => handleMallSelect(e.target.value)}
              sx={{ height: 40 }}
            >
              <MenuItem value="all">전체 사이트</MenuItem>
              {malls.map(m => (
                <MenuItem key={m.mall_id} value={m.mall_id}>{m.mall_id === 'slimpack79' ? '엑스라이더(slimpack79)' : m.mall_id === 'nearbike' ? '니어바이크(nearbike)' : m.mall_id}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* 브랜드 선택 */}
          <ButtonGroup size="large" variant="outlined" sx={{ height: 40 }}>
            {brands.map((brand) => (
              <Button
                key={brand}
                onClick={() => handleBrandSelect(brand)}
                sx={{
                  minWidth: '60px',
                  height: '100%',
                  backgroundColor: selectedBrand === brand ? 'primary.main' : 'inherit',
                  color: selectedBrand === brand ? 'white' : 'inherit',
                  fontWeight: selectedBrand === brand ? 'bold' : 'normal',
                  '&:hover': { backgroundColor: selectedBrand === brand ? 'primary.dark' : '' }
                }}
              >
                {brand}
              </Button>
            ))}
          </ButtonGroup>

          <Button variant="contained" onClick={() => fetchData()} disabled={loading} sx={{ height: 40, bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, fontWeight: 'bold', px: 4 }}>조회</Button>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" color="warning" startIcon={<RefreshIcon />} onClick={() => fetchData()} sx={{ fontWeight: 'bold' }}>
            매출 강제 재계산 (캐시 무시)
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" my={5}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderLeft: 4, borderColor: 'primary.main', height: '100%', borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    총 주문 금액 (결제액 기준 / 완료 건)
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(stats.totalPayment)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ borderLeft: 4, borderColor: 'secondary.main', height: '100%', borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography color="textSecondary" gutterBottom variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    반영 완료 주문 건수
                  </Typography>
                  <Typography variant="h4" color="secondary" sx={{ fontWeight: 'bold' }}>
                    {stats.orderCount.toLocaleString()}건
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>월별 총 매출 추이 (해당 연도)</Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                 <BarChart data={monthlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(val) => `${val / 10000}만`} />
                    <Tooltip formatter={(value) => [formatCurrency(value), '온라인 매출액']} />
                    <Bar dataKey="sales" name="매출액" fill="#2196f3" radius={[4, 4, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>대리점별 매출</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell>대리점명</TableCell>
                      <TableCell align="right">기체 판매</TableCell>
                      <TableCell align="right">파츠 판매</TableCell>
                      <TableCell align="right">주문 건수</TableCell>
                      <TableCell align="right">총 주문 금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.agencyStats || {}).length > 0 ? (
                      Object.entries(stats.agencyStats)
                        .sort((a, b) => b[1].amount - a[1].amount)
                        .map(([agencyName, data]) => (
                          <TableRow key={agencyName} hover>
                            <TableCell 
                              onClick={() => handleOpenModal(`${agencyName} 판매 상세 내역`, (o, agName) => agName === agencyName)}
                              sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                            >{agencyName}</TableCell>
                            <TableCell align="right">
                               <Typography variant="body2" sx={{ fontWeight: data.airframe > 0 ? 'bold' : 'normal', color: data.airframe > 0 ? 'primary.main' : 'inherit' }}>{data.airframe}대</Typography>
                               <Typography variant="caption" color="textSecondary">{formatCurrency(data.airframeAmount)}</Typography>
                            </TableCell>
                            <TableCell align="right">
                               <Typography variant="body2">{data.parts}개</Typography>
                               <Typography variant="caption" color="textSecondary">{formatCurrency(data.partsAmount)}</Typography>
                            </TableCell>
                            <TableCell align="right">{data.count}건</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.amount)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>브랜드별 제품 출고 현황 (대리점 B2B)</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4 }}>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell>브랜드명</TableCell>
                      <TableCell>기체 종류별 판매 대수</TableCell>
                      <TableCell align="right">기체 합계금액</TableCell>
                      <TableCell align="right">부품/용품 합계금액</TableCell>
                      <TableCell align="right">총 합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.brandStats?.agency || {}).length > 0 ? (
                      Object.entries(stats.brandStats.agency)
                        .sort((a, b) => (b[1].airframeAmount + b[1].partsAmount) - (a[1].airframeAmount + a[1].partsAmount))
                        .map(([brandName, data]) => (
                          <TableRow key={brandName} hover>
                            <TableCell 
                              onClick={() => handleOpenModal(`대리점(B2B) - ${brandName} 판매 상세 내역`, (o, agName, item, isAirframe, brand) => o.agency_id && brand === brandName)}
                              sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2, cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                            >{brandName}</TableCell>
                            <TableCell sx={{ verticalAlign: 'top', pt: 2 }}>
                              {Object.entries(data.airframes).length > 0 ? (
                                Object.entries(data.airframes)
                                  .sort((a, b) => b[1].qty - a[1].qty)
                                  .map(([model, info], index, arr) => (
                                    <Box key={model} sx={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      mb: index === arr.length - 1 ? 0 : 1.5,
                                      pb: index === arr.length - 1 ? 0 : 1.5,
                                      borderBottom: index === arr.length - 1 ? 'none' : '1px solid #eee'
                                    }}>
                                      <Typography variant="body2" color="textSecondary" sx={{ pr: 2, flex: 1, wordBreak: 'keep-all' }}>{model}</Typography>
                                      <Box sx={{ textAlign: 'right', minWidth: '80px' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{info.qty}대</Typography>
                                        <Typography variant="caption" color="textSecondary">{formatCurrency(info.amount)}</Typography>
                                      </Box>
                                    </Box>
                                  ))
                              ) : (
                                <Typography variant="body2" color="textSecondary">-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>{formatCurrency(data.airframeAmount)}</TableCell>
                            <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>
                               <Typography variant="body2" sx={{ fontWeight: data.parts > 0 ? 'bold' : 'normal', color: data.parts > 0 ? 'primary.main' : 'inherit' }}>{data.parts}개</Typography>
                               <Typography variant="caption" color="textSecondary">{formatCurrency(data.partsAmount)}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2 }}>{formatCurrency(data.airframeAmount + data.partsAmount)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                  {Object.entries(stats.brandStats?.agency || {}).length > 0 && stats.totals?.b2b && (
                  <TableHead sx={{ bgcolor: 'grey.200' }}>
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>총합</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2b.airframeAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{stats.totals.b2b.parts}개 / {formatCurrency(stats.totals.b2b.partsAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2b.airframeAmt + stats.totals.b2b.partsAmt)}</TableCell>
                    </TableRow>
                  </TableHead>
                  )}
                </Table>
              </TableContainer>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>브랜드별 제품 출고 현황 (일반고객 B2C)</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell>브랜드명</TableCell>
                      <TableCell>기체 종류별 판매 대수</TableCell>
                      <TableCell align="right">기체 합계금액</TableCell>
                      <TableCell align="right">부품/용품 합계금액</TableCell>
                      <TableCell align="right">총 합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(stats.brandStats?.general || {}).length > 0 ? (
                      Object.entries(stats.brandStats.general)
                        .sort((a, b) => (b[1].airframeAmount + b[1].partsAmount) - (a[1].airframeAmount + a[1].partsAmount))
                        .map(([brandName, data]) => (
                          <TableRow key={brandName} hover>
                            <TableCell 
                              onClick={() => handleOpenModal(`일반고객(B2C) - ${brandName} 판매 상세 내역`, (o, agName, item, isAirframe, brand) => !o.agency_id && brand === brandName)}
                              sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2, cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                            >{brandName}</TableCell>
                            <TableCell sx={{ verticalAlign: 'top', pt: 2 }}>
                              {Object.entries(data.airframes).length > 0 ? (
                                Object.entries(data.airframes)
                                  .sort((a, b) => b[1].qty - a[1].qty)
                                  .map(([model, info], index, arr) => (
                                    <Box key={model} sx={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between',
                                      alignItems: 'center', 
                                      mb: index === arr.length - 1 ? 0 : 1.5,
                                      pb: index === arr.length - 1 ? 0 : 1.5,
                                      borderBottom: index === arr.length - 1 ? 'none' : '1px solid #eee'
                                    }}>
                                      <Typography variant="body2" color="textSecondary" sx={{ pr: 2, flex: 1, wordBreak: 'keep-all' }}>{model}</Typography>
                                      <Box sx={{ textAlign: 'right', minWidth: '80px' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{info.qty}대</Typography>
                                        <Typography variant="caption" color="textSecondary">{formatCurrency(info.amount)}</Typography>
                                      </Box>
                                    </Box>
                                  ))
                              ) : (
                                <Typography variant="body2" color="textSecondary">-</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>{formatCurrency(data.airframeAmount)}</TableCell>
                            <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>
                               <Typography variant="body2" sx={{ fontWeight: data.parts > 0 ? 'bold' : 'normal', color: data.parts > 0 ? 'primary.main' : 'inherit' }}>{data.parts}개</Typography>
                               <Typography variant="caption" color="textSecondary">{formatCurrency(data.partsAmount)}</Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2 }}>{formatCurrency(data.airframeAmount + data.partsAmount)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                  {Object.entries(stats.brandStats?.general || {}).length > 0 && stats.totals?.b2c && (
                  <TableHead sx={{ bgcolor: 'grey.200' }}>
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>총합</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2c.airframeAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{stats.totals.b2c.parts}개 / {formatCurrency(stats.totals.b2c.partsAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2c.airframeAmt + stats.totals.b2c.partsAmt)}</TableCell>
                    </TableRow>
                  </TableHead>
                  )}
                </Table>
              </TableContainer>
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>일반 고객(B2C) 상품별 매출 현황</Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4, maxHeight: 400 }}>
            <Table size="small" stickyHeader sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'grey.100' }}>분류</TableCell>
                  <TableCell sx={{ bgcolor: 'grey.100' }}>상품명</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100' }}>판매 수량</TableCell>
                  <TableCell align="right" sx={{ bgcolor: 'grey.100' }}>판매 금액 합계</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(stats.generalProductStats || {}).length > 0 ? (
                  Object.entries(stats.generalProductStats)
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([partId, data]) => (
                      <TableRow key={partId} hover>
                        <TableCell>
                           <Box sx={{ 
                              display: 'inline-block', 
                              px: 1, 
                              py: 0.5, 
                              bgcolor: data.category === '기체' ? 'primary.light' : 'secondary.light', 
                              color: data.category === '기체' ? 'primary.dark' : 'secondary.dark',
                              borderRadius: 1, 
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                           }}>
                             {data.category || '기타'}
                           </Box>
                        </TableCell>
                        <TableCell>{data.name}</TableCell>
                        <TableCell align="right">{data.quantity}개</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(data.amount)}</TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>일반 고객 주문 데이터가 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>


        </>
      )}
    
      {/* 상세내역 모달 */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{modalTitle}</DialogTitle>
        <DialogContent dividers>
          <TableContainer>
            <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>주문일</TableCell>
                  <TableCell>주문번호</TableCell>
                  <TableCell>상품명</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell align="right">결제금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalData.length > 0 ? modalData.map((row, idx) => (
                  <TableRow key={idx} hover sx={{ opacity: row.isCancelled ? 0.6 : 1 }}>
                    <TableCell>{row.order_date ? row.order_date.split('T')[0] : ''}</TableCell>
                    <TableCell>{row.order_id}</TableCell>
                    <TableCell>
                       {row.isCancelled && <Box component="span" sx={{ color: 'error.main', fontWeight: 'bold', mr: 1 }}>[취소/반품]</Box>}
                       <span style={{ textDecoration: row.isCancelled ? 'line-through' : 'none' }}>
                         {row._resolvedName || row.name || row.product_name}
                       </span>
                    </TableCell>
                    <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none' }}>{row.quantity}개</TableCell>
                    <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none' }}>{formatCurrency(row.total_price)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} align="center">판매 내역이 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow sx={{ bgcolor: 'grey.200' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>기체 총합 (취소 제외)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{modalData.filter(i => i._isAirframe && !i.isCancelled).reduce((sum, i) => sum + Number(i.quantity || 1), 0)}대</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(modalData.filter(i => i._isAirframe && !i.isCancelled).reduce((sum, i) => sum + i.total_price, 0))}</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: 'grey.200' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>파츠 총합 (취소 제외)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{modalData.filter(i => !i._isAirframe && !i.isCancelled).reduce((sum, i) => sum + Number(i.quantity || 1), 0)}개</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(modalData.filter(i => !i._isAirframe && !i.isCancelled).reduce((sum, i) => sum + i.total_price, 0))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} variant="contained" sx={{ bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.900' } }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default OnlineStats;
