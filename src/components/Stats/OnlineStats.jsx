import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { getBrandFallback } from './SalesHistoryStats';
import { computeOnlineAgencyStats } from '../../utils/onlineAgencyStats';
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
  InputLabel,
  Chip
} from '@mui/material';
import { getCafe24Malls } from '../../utils/cafe24Api';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, parseISO, startOfYear, endOfYear, getMonth, startOfDay, endOfDay, differenceInCalendarDays, addDays } from 'date-fns';
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
  const { getAllowedMalls } = useAuth();
  const allowedMalls = getAllowedMalls();
  const mallLocked = allowedMalls !== 'all' && allowedMalls.length > 0;
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [stats, setStats] = useState({ totalPayment: 0, orderCount: 0, list: [], agencyStats: {}, brandStats: {}, totals: {} });
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [brands, setBrands] = useState(['전체']);
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [malls, setMalls] = useState([]);
  const [selectedMall, setSelectedMall] = useState(mallLocked ? allowedMalls[0] : 'all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);
  const [modalShippingTotal, setModalShippingTotal] = useState(0);
  const [rawOrders, setRawOrders] = useState([]);
  const [agencyMapGlobal, setAgencyMapGlobal] = useState({});

  useEffect(() => {
    const fetchMalls = async () => {
      try {
        const res = await getCafe24Malls();
        if (res.success && res.malls) {
          setMalls(res.malls.filter(m => m.connected && (allowedMalls.includes('all') || allowedMalls.includes(m.mall_id))));
        }
      } catch (err) { console.error(err); }
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
      let orderHasMatch = false;
      (o.order_items || []).forEach(item => {
        if (dataFilter(o, agName, item, item._isAirframe, item._brand)) {
           // 교환/취소 상태여도 실결제(payment_amount>0)가 있으면 정상 매출 → 취소표시 안 함
           const isCancelled = ['C11', 'C34', 'C36', 'C40', 'C47', 'C48', 'C49', 'R34', 'R36', 'R40', 'E40'].includes(item.order_status) && !(Number(item.payment_amount || 0) > 0);
           items.push({
             ...item,
             order_id: o.order_id,
             order_date: o.order_date,
             buyer_name: o.buyer_name,
             agency_name: agName,
             mall_id: o.mall_id,
             isCancelled,
             total_price: item._calculated_amount !== undefined ? item._calculated_amount : (Number(item.quantity || 1) * Number(item.product_price || item.price || 0))
           });
           orderHasMatch = true;
        }
      });
      if (orderHasMatch && Number(o.shipping_fee || 0) > 0) {
        items.push({
          order_id: o.order_id,
          order_date: o.order_date,
          buyer_name: o.buyer_name,
          agency_name: agName,
          mall_id: o.mall_id,
          isCancelled: false,
          isShipping: true,
          name: '배송비',
          quantity: '-',
          total_price: Number(o.shipping_fee),
          _isAirframe: false,
          _brand: ''
        });
      }
    });
    items.sort((a, b) => {
      const dateComp = (a.order_date || '').localeCompare(b.order_date || '');
      if (dateComp !== 0) return dateComp;
      const idComp = (a.order_id || '').localeCompare(b.order_id || '');
      if (idComp !== 0) return idComp;
      if (a.isShipping && !b.isShipping) return 1;
      if (!a.isShipping && b.isShipping) return -1;
      if (a._isAirframe && !b._isAirframe) return -1;
      if (!a._isAirframe && b._isAirframe) return 1;
      return 0;
    });
    setModalData(items);
    setModalShippingTotal(0);
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
    if (mallLocked) qMall = allowedMalls[0];
    setLoading(true);
    try {
      const startDateTime = formatDateToStartOfDay(qStart || startDate);
      const endDateTime = formatDateToEndOfDay(qEnd || endDate);

      let orderQuery = supabase.from('cafe24_orders').select('*').gte('order_date', startDateTime).lte('order_date', endDateTime).eq('is_deleted', false).eq('is_transferred', true);

      if (!allowedMalls.includes('all')) {
        orderQuery = orderQuery.in('mall_id', allowedMalls);
      }

      if (qMall !== 'all') {
        orderQuery = orderQuery.eq('mall_id', qMall);
      }

      const [
        { data: cafe24Orders, error },
        { data: agenciesData },
        { data: partsData }
      ] = await Promise.all([
        orderQuery,
        supabase.from('agencies').select('id, name'),
        supabase.from('parts').select('id, code, barcode, brand, note, price, name')
      ]);

      if (error) throw error;

      if (cafe24Orders) {
        let total = 0;
        const brandStats = { agency_xrb: {}, agency_nb: {}, general_xrb: {}, general_nb: {} };
        const generalProductStats = {};
        const agencyMap = {};
        agenciesData?.forEach(a => { agencyMap[a.id] = a.name; });
        setAgencyMapGlobal(agencyMap);
        setRawOrders(cafe24Orders);
        const partMapById = {};
        const partMapByCode = {};
        const partMapByName = {};
        const brandSet = new Set(['XRB', 'NB']);
        partsData?.forEach(p => {
          partMapById[p.id] = p;
          if (p.code) partMapByCode[String(p.code).trim()] = p;
          if (p.barcode) partMapByCode[String(p.barcode).trim()] = p;
          if (p.name) partMapByName[p.name] = p;
          if (p.brand && p.brand.trim() !== '') brandSet.add(p.brand.trim());
        });
        // 브랜드 판정: 제품(part_id→code→name) 기준 + getBrandFallback — 판매현황 통계와 동일 (몰 기준 fallback 아님)
        const resolveBrandOnline = (partId, code, fallbackName, mallId) => {
          let name = fallbackName;
          if (partId && partMapById[partId]?.name) name = partMapById[partId].name;
          else if (code && partMapByCode[code]?.name) name = partMapByCode[code].name;
          let b = '';
          if (partId && partMapById[partId]?.brand) b = partMapById[partId].brand;
          else if (code && partMapByCode[code]?.brand) b = partMapByCode[code].brand;
          else if (name && partMapByName[name]?.brand) b = partMapByName[name].brand;
          return getBrandFallback(b, name, code, mallId);
        };
        setBrands(['전체', ...Array.from(brandSet).sort()]);

        let filteredOrderCount = 0;
        const filteredList = [];
        
        let totalB2BAirframeQty = 0, totalB2BAirframeAmt = 0, totalB2BPartsQty = 0, totalB2BPartsAmt = 0;
        let totalB2CAirframeQty = 0, totalB2CAirframeAmt = 0, totalB2CPartsQty = 0, totalB2CPartsAmt = 0;

        cafe24Orders.forEach(o => {
          let orderTotalForBrand = 0;
          let hasMatchingBrand = false;

          // 창고 정보 없는 건(반영 예외 처리된 건) 제외 — SalesHistory/SalesHistoryStats와 동일 기준
          const orderItems = o.order_items || [];
          if (orderItems.length > 0 && !orderItems.some(item => item._warehouse_id)) return;

          const CANCEL_STATUSES = ['C11', 'C34', 'C36', 'C40', 'C47', 'C48', 'C49', 'R34', 'R36', 'R40', 'E40'];
          // 교환/취소 상태여도 실결제(payment_amount>0)가 있으면 유효 거래로 인정 (예: 교환 차액 결제)
          const isValidItem = (it) => !CANCEL_STATUSES.includes(it.order_status) || Number(it.payment_amount || 0) > 0;
          const validItems = orderItems.filter(isValidItem);
          if (validItems.length === 0) return; // 전액 취소건은 제외

           const canceledItems = (o.order_items || []).filter(it => !isValidItem(it));
           const canceledAmount = canceledItems.reduce((acc, it) => {
               if (it.payment_amount !== undefined && it.payment_amount !== null) return acc + Number(it.payment_amount);
               const cp = it.product_price !== undefined && it.product_price !== null ? Number(it.product_price) : (it.price !== undefined && it.price !== null ? Number(it.price) : 0);
               return acc + (cp * Number(it.quantity || 1));
           }, 0);
           // 선불금 처리: total_amount=0 → payment_amount 합계 → used_points 순으로 폴백
           const _itemPaySum = validItems.reduce((acc, i) => acc + Number(i.payment_amount || 0), 0);
           const isNearbikeMemberDiscount = String(o.order_id || '').startsWith('nearbike_') && Number(o.total_amount || 0) === 0;
           const _itemPayMethod = (validItems[0]?.payment_method || '').toLowerCase();
           const isChunbulgeum = _itemPayMethod.includes('선불금');
           const _effTotal = !isNearbikeMemberDiscount && Number(o.total_amount || 0) === 0
             ? _itemPaySum > 0 ? _itemPaySum
               : isChunbulgeum && Number(o.used_points || 0) > 0 ? Number(o.used_points)
               : 0
             : Number(o.total_amount || 0);
           const distributableAmount = Math.max(0, _effTotal - Number(o.shipping_fee || 0) - canceledAmount);

           let totalWeight = validItems.reduce((acc, i) => {
              let w = 0;
              if (i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) > 0) {
                  w = Number(i.payment_amount);
              } else if (!(i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) === 0)) {
                  const pCode = String(i.custom_product_code || i.product_code || '').trim();
                  const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
                  const pPrice = i.product_price !== undefined && i.product_price !== null ? Number(i.product_price) : (i.price !== undefined && i.price !== null ? Number(i.price) : Number(p ? p.price : 0));
                  w = pPrice * Number(i.quantity || 1);
              }
              return acc + w;
           }, 0);

           if (totalWeight === 0 && distributableAmount > 0) {
               validItems.forEach(i => {
                   const pCode = String(i.custom_product_code || i.product_code || '').trim();
                   const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
                   i._fallbackWeight = Number(p ? p.price : 0) * Number(i.quantity || 1);
                   totalWeight += i._fallbackWeight;
               });
               if (totalWeight === 0) {
                   validItems.forEach(i => {
                       i._fallbackWeight = Number(i.quantity || 1);
                       totalWeight += i._fallbackWeight;
                   });
               }
           }
           const totalQty = validItems.reduce((acc, i) => acc + Number(i.quantity || 1), 0);

           if (validItems.length > 0) {
              let seenProductCodes = new Set();
              validItems.forEach((item, idx) => {
                const pCode = String(item.custom_product_code || item.product_code || '').trim();
                const p = item.part_id ? partMapById[item.part_id] : (pCode ? partMapByCode[pCode] : null);
                const pName = item.product_name || item.name || '상품';
                const qty = Number(item.quantity || 1);

                const pCodeCheck = (String(item.product_code || '') + '_' + String(item.custom_product_code || '') + '_' + String(item.option_value || item.options || '')).trim();

                let statQty = qty;
                if (pCodeCheck !== '__') {
                    if (seenProductCodes.has(pCodeCheck)) {
                        statQty = 0;
                    } else {
                        seenProductCodes.add(pCodeCheck);
                    }
                }
                
                let baseWeight = 0;
                if (item._fallbackWeight !== undefined) {
                    baseWeight = item._fallbackWeight;
                } else {
                    let isExplicitlyZero = item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) === 0;
                    if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
                       baseWeight = Number(item.payment_amount);
                    } else if (!isExplicitlyZero) {
                       const pPrice = item.product_price !== undefined && item.product_price !== null ? Number(item.product_price) : (item.price !== undefined && item.price !== null ? Number(item.price) : Number(p ? p.price : 0));
                       baseWeight = pPrice * qty;
                    }
                }

                let amount = 0;
                if (totalWeight > 0) {
                    amount = Math.floor((baseWeight / totalWeight) * distributableAmount);
                    if (idx === validItems.length - 1) {
                        const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                            let prevW = 0;
                            if (prev._fallbackWeight !== undefined) {
                                prevW = prev._fallbackWeight;
                            } else {
                                if (prev.payment_amount !== undefined && prev.payment_amount !== null && Number(prev.payment_amount) > 0) {
                                    prevW = Number(prev.payment_amount);
                                } else if (!(prev.payment_amount !== undefined && prev.payment_amount !== null && Number(prev.payment_amount) === 0)) {
                                    const prevPCode = String(prev.custom_product_code || prev.product_code || '').trim();
                                    const prevP = prev.part_id ? partMapById[prev.part_id] : (prevPCode ? partMapByCode[prevPCode] : null);
                                    const prevPrice = prev.product_price !== undefined && prev.product_price !== null ? Number(prev.product_price) : (prev.price !== undefined && prev.price !== null ? Number(prev.price) : Number(prevP ? prevP.price : 0));
                                    prevW = prevPrice * Number(prev.quantity || 1);
                                }
                            }
                            return acc + Math.floor((prevW / totalWeight) * distributableAmount);
                        }, 0);
                        amount = distributableAmount - prevTotal;
                    }
                } else if (distributableAmount > 0) {
                   amount = Math.floor(distributableAmount / validItems.length);
                   if (idx === validItems.length - 1) {
                       amount = distributableAmount - (amount * (validItems.length - 1));
                   }
               }
               
               item._calculated_amount = amount;
               const isAirframe = p ? (p.note?.includes('기체')) : (pName.includes('기체') || pName.includes('차체') || pName.includes('완차') || pName.includes('스쿠터') || pName.includes('전기자전거'));
               let sup = resolveBrandOnline(item.part_id, pCode, pName, o.mall_id);
               item._brand = sup;
               item._isAirframe = isAirframe;

               if (qBrand !== '전체' && sup !== qBrand) {
                 return; // 현재 선택된 브랜드가 아니면 패스
               }

               // 취소된 항목은 통계 집계에서 제외 (단, 실결제 payment_amount>0인 교환건은 정상 매출로 포함)
               const isCancelled = ['C11', 'C34', 'C36', 'C40', 'C47', 'C48', 'C49', 'R34', 'R36', 'R40', 'E40'].includes(item.order_status) && !(Number(item.payment_amount || 0) > 0);
               if (isCancelled) {
                 return;
               }

               hasMatchingBrand = true;
               orderTotalForBrand += amount;
               
               if (!o._validOrderTotal) o._validOrderTotal = 0;
               o._validOrderTotal += amount;
               
               const isGeneral = !o.agency_id;
                const mallSuffix = o.mall_id === 'nearbike' ? '_nb' : '_xrb';
                const customerType = (isGeneral ? 'general' : 'agency') + mallSuffix;

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

                     item._modelName = modelName;
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
              const shipFee = Number(o.shipping_fee || 0);
              const validOrderTotal = (o._validOrderTotal || 0) + shipFee;

              if (qBrand === '전체') {
                 total += validOrderTotal;
                 // 배송비를 파츠 합계에 반영 (mall 기준 브랜드 결정)
                 if (shipFee > 0) {
                    const shipBrandSuffix = o.mall_id === 'nearbike' ? '_nb' : '_xrb';
                    const shipCustomerType = (o.agency_id ? 'agency' : 'general') + shipBrandSuffix;
                    const shipBrand = o.mall_id === 'nearbike' ? 'NB' : 'XRB';
                    if (!brandStats[shipCustomerType]) brandStats[shipCustomerType] = {};
                    if (!brandStats[shipCustomerType][shipBrand]) {
                       brandStats[shipCustomerType][shipBrand] = { airframes: {}, airframeTotalQty: 0, parts: 0, airframeAmount: 0, partsAmount: 0 };
                    }
                    brandStats[shipCustomerType][shipBrand].parts += 0; // qty는 추가 안 함
                    brandStats[shipCustomerType][shipBrand].partsAmount += shipFee;
                    if (o.agency_id) totalB2BPartsAmt += shipFee;
                    else totalB2CPartsAmt += shipFee;
                 }
              } else {
                 const apportionedShipping = (o._validOrderTotal > 0) ? Math.floor(shipFee * (orderTotalForBrand / o._validOrderTotal)) : 0;
                 const adjustedTotalForBrand = orderTotalForBrand + apportionedShipping;
                 total += adjustedTotalForBrand;
              }
              filteredOrderCount += 1;
              filteredList.push(o);
           }
        });

        const { agencyStats } = computeOnlineAgencyStats({ orders: cafe24Orders, agencies: agenciesData, parts: partsData, brand: qBrand });

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

        const periodStart = qStart || startDate;
        const periodEnd = qEnd || endDate;
        const periodDays = differenceInCalendarDays(periodEnd, periodStart);
        const groupByDay = periodDays <= 31;

        const periodMap = {};
        if (groupByDay) {
          let cur = new Date(periodStart);
          while (cur <= periodEnd) {
            const key = format(cur, 'M/d');
            periodMap[key] = { label: key, sales: 0 };
            cur = addDays(cur, 1);
          }
        } else {
          let cur = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
          const endMonth = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
          while (cur <= endMonth) {
            const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            const label = cur.getFullYear() !== new Date().getFullYear()
              ? `${cur.getFullYear()}.${cur.getMonth() + 1}월`
              : `${cur.getMonth() + 1}월`;
            periodMap[key] = { label, sales: 0 };
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
          }
        }
        if (cafe24Orders) {
          cafe24Orders.forEach(o => {
            // 혼합 주문 처리를 위해 mall_id 기반 필터링은 제거하고, 아이템별로 검사
            const items = o.order_items || [];
            // 창고 정보 없는 건(반영 예외 처리된 건) 제외
            if (items.length > 0 && !items.some(item => item._warehouse_id)) return;
            const CANCEL_STATUSES = ['C11', 'C34', 'C36', 'C40', 'C47', 'C48', 'C49', 'R34', 'R36', 'R40', 'E40'];
            // 교환/취소 상태여도 실결제(payment_amount>0)가 있으면 유효 거래로 인정 (예: 교환 차액 결제)
            const isValidItem = (it) => !CANCEL_STATUSES.includes(it.order_status) || Number(it.payment_amount || 0) > 0;
            const validItems = items.filter(isValidItem);
            let orderItemsSum = 0;
            const canceledItems = items.filter(it => !isValidItem(it));
            const canceledAmount = canceledItems.reduce((acc, it) => {
                if (it.payment_amount !== undefined && it.payment_amount !== null) return acc + Number(it.payment_amount);
                const cp = it.product_price !== undefined && it.product_price !== null ? Number(it.product_price) : (it.price !== undefined && it.price !== null ? Number(it.price) : 0);
                return acc + (cp * Number(it.quantity || 1));
            }, 0);
            // 선불금 처리: total_amount=0 → payment_amount 합계 → used_points 순으로 폴백
            const _itemPaySum2 = validItems.reduce((acc, i) => acc + Number(i.payment_amount || 0), 0);
            const isNearbikeMemberDiscount2 = String(o.order_id || '').startsWith('nearbike_') && Number(o.total_amount || 0) === 0;
            const _itemPayMethod2 = (validItems[0]?.payment_method || '').toLowerCase();
            const isChunbulgeum2 = _itemPayMethod2.includes('선불금');
            const _effTotal2 = !isNearbikeMemberDiscount2 && Number(o.total_amount || 0) === 0
              ? _itemPaySum2 > 0 ? _itemPaySum2
                : isChunbulgeum2 && Number(o.used_points || 0) > 0 ? Number(o.used_points)
                : 0
              : Number(o.total_amount || 0);
            const distributableAmount = Math.max(0, _effTotal2 - Number(o.shipping_fee || 0) - canceledAmount);

            let totalWeight = validItems.reduce((acc, i) => {
               let w = 0;
               if (i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) > 0) {
                   w = Number(i.payment_amount);
               } else if (!(i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) === 0)) {
                   const cp = i.product_price !== undefined && i.product_price !== null ? Number(i.product_price) : (i.price !== undefined && i.price !== null ? Number(i.price) : 0);
                   w = cp * Number(i.quantity || 1);
               }
               return acc + w;
            }, 0);

            if (totalWeight === 0 && distributableAmount > 0) {
                validItems.forEach(i => {
                    const pCode = String(i.custom_product_code || i.product_code || '').trim();
                    const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
                    i._fallbackWeight = Number(p ? p.price : 0) * Number(i.quantity || 1);
                    totalWeight += i._fallbackWeight;
                });
                if (totalWeight === 0) {
                    validItems.forEach(i => {
                        i._fallbackWeight = Number(i.quantity || 1);
                        totalWeight += i._fallbackWeight;
                    });
                }
            }
            const totalQty = validItems.reduce((acc, i) => acc + Number(i.quantity || 1), 0);

            let brandMatchedAmount = 0;
            validItems.forEach((item, idx) => {
               const pName = item.name || item.product_name || '';
               const pCode = String(item.custom_product_code || item.product_code || '').trim();
               const isAirframe = pName.includes('기체') || pName.includes('차체') || pName.includes('완차') || pName.includes('스쿠터') || pName.includes('전기자전거');
               let itemBrand = '';
               if (o.mall_id === 'slimpack79') itemBrand = 'XRB';
               else if (o.mall_id === 'nearbike') itemBrand = 'NB';
               else itemBrand = '기타 브랜드';

               const qty = Number(item.quantity || 1);

               let baseWeight = 0;
               if (item._fallbackWeight !== undefined) {
                   baseWeight = item._fallbackWeight;
               } else {
                   let isExplicitlyZero = item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) === 0;
                   if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
                      baseWeight = Number(item.payment_amount);
                   } else if (!isExplicitlyZero) {
                      const pPrice = item.product_price !== undefined && item.product_price !== null ? Number(item.product_price) : (item.price !== undefined && item.price !== null ? Number(item.price) : 0);
                      baseWeight = pPrice * qty;
                   }
               }

               let amount = 0;
               if (totalWeight > 0) {
                   amount = Math.floor((baseWeight / totalWeight) * distributableAmount);
                   if (idx === validItems.length - 1) {
                       const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                           let prevW = 0;
                           if (prev._fallbackWeight !== undefined) {
                               prevW = prev._fallbackWeight;
                           } else {
                               if (prev.payment_amount !== undefined && prev.payment_amount !== null && Number(prev.payment_amount) > 0) {
                                   prevW = Number(prev.payment_amount);
                               } else if (!(prev.payment_amount !== undefined && prev.payment_amount !== null && Number(prev.payment_amount) === 0)) {
                                   const prevPrice = prev.product_price !== undefined && prev.product_price !== null ? Number(prev.product_price) : (prev.price !== undefined && prev.price !== null ? Number(prev.price) : 0);
                                   prevW = prevPrice * Number(prev.quantity || 1);
                               }
                           }
                           return acc + Math.floor((prevW / totalWeight) * distributableAmount);
                       }, 0);
                       amount = distributableAmount - prevTotal;
                   }
               }
               orderItemsSum += amount;
               if (qBrand === '전체' || itemBrand === qBrand) {
                   brandMatchedAmount += amount;
               }
            });
            
            let finalMonthlyAmt = 0;
            if (qBrand === '전체') {
                finalMonthlyAmt = orderItemsSum + Number(o.shipping_fee || 0);
            } else {
                const apportionedShipping = (orderItemsSum > 0) ? Math.floor(Number(o.shipping_fee || 0) * (brandMatchedAmount / orderItemsSum)) : 0;
                finalMonthlyAmt = brandMatchedAmount + apportionedShipping;
            }

            if (finalMonthlyAmt > 0) {
                const orderDate = new Date(o.order_date);
                let key;
                if (groupByDay) {
                  key = format(orderDate, 'M/d');
                } else {
                  key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                }
                if (periodMap[key]) periodMap[key].sales += finalMonthlyAmt;
            }
          });
        }
        setMonthlyStats(Object.values(periodMap));
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

  const renderBrandTable = (brandData, isAgency) => {
    const entries = Object.entries(brandData || {});
    const totalAirframeAmt = entries.reduce((s, [,d]) => s + d.airframeAmount, 0);
    const totalPartsAmt = entries.reduce((s, [,d]) => s + d.partsAmount, 0);
    const totalPartsQty = entries.reduce((s, [,d]) => s + d.parts, 0);
    return (
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
          {entries.length > 0 ? (
            entries
              .sort((a, b) => (b[1].airframeAmount + b[1].partsAmount) - (a[1].airframeAmount + a[1].partsAmount))
              .map(([brandName, data]) => (
                <TableRow key={brandName} hover>
                  <TableCell
                    onClick={() => handleOpenModal(`${isAgency ? '대리점(B2B)' : '일반고객(B2C)'} - ${brandName} 판매 상세 내역`, (o, agName, item, isAirframe, brand) => (isAgency ? !!o.agency_id : !o.agency_id) && brand === brandName)}
                    sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2, cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                  >{brandName}</TableCell>
                  <TableCell sx={{ verticalAlign: 'top', pt: 2 }}>
                    {Object.entries(data.airframes).length > 0 ? (
                      Object.entries(data.airframes).sort((a, b) => b[1].qty - a[1].qty).map(([model, info], idx, arr) => (
                        <Box key={model} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: idx === arr.length - 1 ? 0 : 1.5, pb: idx === arr.length - 1 ? 0 : 1.5, borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #eee' }}>
                          <Typography variant="body2" color="textSecondary" sx={{ pr: 2, flex: 1, wordBreak: 'keep-all' }}>{model}</Typography>
                          <Box sx={{ textAlign: 'right', minWidth: '80px' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={(e) => { e.stopPropagation(); handleOpenModal(`${brandName} - ${model} 기체 상세`, (o, agName, item, isAirframe, brand) => (isAgency ? !!o.agency_id : !o.agency_id) && brand === brandName && isAirframe && item._modelName === model); }}
                            >{info.qty}</Typography>
                            <Typography variant="caption" color="textSecondary">{formatCurrency(info.amount)}</Typography>
                          </Box>
                        </Box>
                      ))
                    ) : <Typography variant="body2" color="textSecondary">-</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>{formatCurrency(data.airframeAmount)}</TableCell>
                  <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: data.parts > 0 ? 'bold' : 'normal', color: data.parts > 0 ? 'primary.main' : 'inherit', cursor: data.parts > 0 ? 'pointer' : 'default', textDecoration: data.parts > 0 ? 'underline' : 'none' }}
                      onClick={() => data.parts > 0 && handleOpenModal(`${brandName} - 파츠/용품 상세`, (o, agName, item, isAirframe, brand) => (isAgency ? !!o.agency_id : !o.agency_id) && brand === brandName && !isAirframe)}
                    >{data.parts}</Typography>
                    <Typography variant="caption" color="textSecondary">{formatCurrency(data.partsAmount)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2 }}>{formatCurrency(data.airframeAmount + data.partsAmount)}</TableCell>
                </TableRow>
              ))
          ) : (
            <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
        {entries.length > 0 && (
          <TableHead sx={{ bgcolor: 'grey.200' }}>
            <TableRow>
              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>총합</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(totalAirframeAmt)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{totalPartsQty}개 / {formatCurrency(totalPartsAmt)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(totalAirframeAmt + totalPartsAmt)}</TableCell>
            </TableRow>
          </TableHead>
        )}
      </Table>
    );
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
          {mallLocked ? (
            <Chip
              label={allowedMalls[0] === 'nearbike' ? '니어바이크(nearbike)' : allowedMalls[0] === 'slimpack79' ? '엑스라이더(slimpack79)' : allowedMalls[0]}
              color="primary"
              sx={{ height: 40, fontSize: '0.95rem', px: 1 }}
            />
          ) : (
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
          )}

          {/* 브랜드 선택 버튼 숨김 처리 */}
          <Button variant="contained" onClick={() => fetchData()} disabled={loading} sx={{ height: 40, bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, fontWeight: 'bold', px: 4 }}>조회</Button>
        </Box>

        {/* 강제 재계산 버튼 숨김 처리 */}
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
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              {differenceInCalendarDays(endDate, startDate) <= 31 ? '일별 총 매출 추이' : '월별 총 매출 추이'}
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                 <BarChart data={monthlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
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
                               <Typography variant="body2" sx={{ fontWeight: data.airframe > 0 ? 'bold' : 'normal', color: data.airframe > 0 ? 'primary.main' : 'inherit' }}>{data.airframe}</Typography>
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
              {/* B2B - XRB */}
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>브랜드별 제품 출고 현황 (대리점 B2B)</Typography>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#1565c0' }}>▶ XRB (엑스라이더)</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 2 }}>
                {renderBrandTable(stats.brandStats?.agency_xrb, true)}
              </TableContainer>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#2e7d32' }}>▶ NB (니어바이크)</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4 }}>
                {renderBrandTable(stats.brandStats?.agency_nb, true)}
              </TableContainer>

              {/* B2C - XRB */}
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>브랜드별 제품 출고 현황 (일반고객 B2C)</Typography>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#1565c0' }}>▶ XRB (엑스라이더)</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 2 }}>
                {renderBrandTable(stats.brandStats?.general_xrb, false)}
              </TableContainer>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#2e7d32' }}>▶ NB (니어바이크)</Typography>
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                {renderBrandTable(stats.brandStats?.general_nb, false)}
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
              {Object.entries(stats.generalProductStats || {}).length > 0 && (
                <TableFooter>
                  <TableRow sx={{ bgcolor: 'grey.200' }}>
                    <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>총합</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                      {Object.values(stats.generalProductStats).reduce((sum, item) => sum + item.quantity, 0)}개
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                      {formatCurrency(Object.values(stats.generalProductStats).reduce((sum, item) => sum + item.amount, 0))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
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
                  <TableCell>쇼핑몰</TableCell>
                  <TableCell>주문자/대리점</TableCell>
                  <TableCell>상품명</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell align="right">결제금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalData.length > 0 ? modalData.map((row, idx) => (
                  <TableRow key={idx} hover sx={{ opacity: row.isCancelled ? 0.6 : 1, bgcolor: row.isShipping ? '#f8f9fa' : 'inherit' }}>
                    <TableCell sx={{ color: row.isShipping ? '#888' : 'inherit' }}>{row.order_date ? row.order_date.split('T')[0] : ''}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: row.isShipping ? '#888' : 'inherit' }}>{String(row.order_id || '').includes('_') ? String(row.order_id).split('_').slice(1).join('_') : row.order_id}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: row.isShipping ? '#888' : (row.mall_id === 'nearbike' ? '#2e7d32' : '#1565c0') }}>{row.isShipping ? '' : (row.mall_id === 'slimpack79' ? 'XRB' : row.mall_id === 'nearbike' ? 'NB' : (row.mall_id || '-'))}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', color: row.isShipping ? '#888' : 'inherit' }}>{row.isShipping ? '' : (row.agency_name !== '일반 주문' ? row.agency_name : (row.buyer_name || '-'))}</TableCell>
                    <TableCell sx={{ fontStyle: row.isShipping ? 'italic' : 'normal', color: row.isShipping ? '#888' : 'inherit' }}>
                       {row.isCancelled && <Box component="span" sx={{ color: 'error.main', fontWeight: 'bold', mr: 1 }}>[취소/반품]</Box>}
                       <span style={{ textDecoration: row.isCancelled ? 'line-through' : 'none' }}>
                         {row._resolvedName || row.name || row.product_name}
                       </span>
                    </TableCell>
                    <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isShipping ? '#888' : 'inherit' }}>{row.isShipping ? '-' : `${row.quantity}개`}</TableCell>
                    <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isShipping ? '#888' : 'inherit', fontStyle: row.isShipping ? 'italic' : 'normal' }}>{formatCurrency(row.total_price)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} align="center">판매 내역이 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow sx={{ bgcolor: 'grey.200' }}>
                  <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>기체 총합 (취소 제외)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{modalData.filter(i => i._isAirframe && !i.isCancelled).reduce((sum, i) => sum + Number(i.quantity || 1), 0)}대</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(modalData.filter(i => i._isAirframe && !i.isCancelled).reduce((sum, i) => sum + i.total_price, 0))}</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: 'grey.200' }}>
                  <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>파츠 총합 (취소 제외)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{modalData.filter(i => !i._isAirframe && !i.isCancelled && !i.isShipping).reduce((sum, i) => sum + Number(i.quantity || 1), 0)}개</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(modalData.filter(i => !i._isAirframe && !i.isCancelled && !i.isShipping).reduce((sum, i) => sum + i.total_price, 0))}</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: 'primary.light' }}>
                  <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>총 주문 금액 (취소 제외)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>-</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.contrastText' }}>
                    {formatCurrency(modalData.filter(i => !i.isCancelled).reduce((sum, i) => sum + i.total_price, 0))}
                  </TableCell>
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
