import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, Button, Grid, Divider,
  TablePagination, CircularProgress, FormControl, InputLabel, Select, MenuItem, Stack, ButtonGroup
} from '@mui/material';
import { Assessment as AssessmentIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SalesEditModal from './SalesEditModal';
import { useAuth } from '../../contexts/AuthContext';

// ── 공급가/부가세 역산 헬퍼 ────────────────────────────
const calcVAT = (total) => {
  const t = Number(total || 0);
  const supply = Math.round(t / 1.1);
  return { supply, vat: t - supply };
};

// ── 공통 상태 매핑 ────────────────────────────
const CAFE24_STATUS_KO = {
  'N00': '입금전', 'N10': '상품준비중', 'N20': '배송준비중', 'N21': '배송대기',
  'N22': '배송보류', 'N30': '배송중', 'N40': '배송완료', 'N50': '구매확정',
  // 취소 (C)
  'C00': '취소신청', 'C10': '취소 접수 - 관리자', 'C34': '취소처리중 - 환불전', 'C36': '취소처리중 - 환불보류',
  'C40': '취소 완료', 'C47': '입금전취소 - 구매자', 'C48': '입금전취소 - 자동취소', 'C49': '입금전취소 - 관리자',
  // 반품 (R)
  'R00': '반품신청', 'R10': '반품 접수', 'R12': '반품 보류', 'R30': '반품처리중 - 수거전',
  'R34': '반품처리중 - 환불전', 'R36': '반품처리중 - 환불보류', 'R40': '반품완료 - 환불완료',
  // 교환 (E)
  'E00': '교환신청', 'E10': '교환접수', 'E12': '교환보류', 'E20': '교환준비',
  'E30': '교환처리중 - 수거전', 'E32': '교환처리중 - 입금전', 'E34': '교환처리중 - 환불전', 'E36': '교환처리중 - 환불보류', 'E40': '교환 완료',
  // 배송 등 영문자 단일 상태 보완
  'M': '배송준비중', 'T': '배송중', 'F': '배송완료', 'W': '배송보류',
  'C': '취소 완료', 'E': '교환 완료', 'R': '반품완료', 'null': '상태없음'
};
const getKoStatus = (status) => {
  if (!status) return '배송완료';
  return CAFE24_STATUS_KO[String(status).trim()] || status;
};

function SalesHistory() {
  const { getAllowedMalls } = useAuth();
  const allowedMalls = getAllowedMalls();
  const [loading, setLoading] = useState(true);
  const [flatRows, setFlatRows] = useState([]);   // 품목 단위로 펼친 데이터
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate] = useState(() => new Date());
  const [filterType, setFilterType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [dateType, setDateType] = useState('주문/출고/완료일자');
  const [sellers, setSellers] = useState(['all']);
  const [brands, setBrands] = useState(['all']);
  const [statuses, setStatuses] = useState(['all']);

  // 편집 모달
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState({ id: null, type: null });

  // 공급가/부가세 표시 토글
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  // 페이지네이션
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);

  useEffect(() => { fetchSales(); }, []);

  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let start = null;
    let end = null;

    switch (period) {
      case 'today':        start = end = today; break;
      case 'yesterday':    start = end = subDays(today, 1); break;
      case 'thisWeek':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'lastWeek':
        const lastWeek = subDays(today, 7);
        start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      case 'thisMonth':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(today), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      default: break;
    }
    setStartDate(start);
    setEndDate(end);
    fetchSales(start, end);
  };

  // ── 데이터 패치 ────────────────────────────────────────
  const fetchSales = async (overrideStart, overrideEnd) => {
    setLoading(true);

    const activeStart = overrideStart !== undefined ? overrideStart : startDate;
    const activeEnd = overrideEnd !== undefined ? overrideEnd : endDate;

    let shipQuery = supabase
      .from('shipments')
      .select('id, order_date, customer_name, price, sales_channel, status, note, warehouse_id, shipment_parts(id, part_name, quantity, price, total_price, note)')
      .in('status', ['출고완료', '완료'])
      .order('order_date', { ascending: false });

    if (activeStart) shipQuery = shipQuery.gte('order_date', format(activeStart, 'yyyy-MM-dd') + 'T00:00:00+09:00');
    if (activeEnd)   shipQuery = shipQuery.lte('order_date', format(activeEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00');

    let asQuery = supabase
      .from('services')
      .select('id, reception_date, completion_date, customer_name, status, note')
      .in('status', ['출고완료', '완료'])
      .order('completion_date', { ascending: false });

    if (activeStart && activeEnd) {
      const sDate = format(activeStart, 'yyyy-MM-dd') + 'T00:00:00+09:00';
      const eDate = format(activeEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00';
      asQuery = asQuery.or(`and(completion_date.gte.${sDate},completion_date.lte.${eDate}),and(completion_date.is.null,reception_date.gte.${sDate},reception_date.lte.${eDate})`);
    } else if (activeStart) {
      const sDate = format(activeStart, 'yyyy-MM-dd') + 'T00:00:00+09:00';
      asQuery = asQuery.or(`completion_date.gte.${sDate},and(completion_date.is.null,reception_date.gte.${sDate})`);
    } else if (activeEnd) {
      const eDate = format(activeEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00';
      asQuery = asQuery.or(`completion_date.lte.${eDate},and(completion_date.is.null,reception_date.lte.${eDate})`);
    }

    let cafeQuery = supabase
      .from('cafe24_orders')
      .select('id, order_id, order_date, buyer_name, total_amount, order_items, status, shipping_fee, used_points, mall_id, agencies(name)')
      .eq('is_deleted', false)
      .eq('is_transferred', true)
      .order('order_date', { ascending: false });

    if (!allowedMalls.includes('all')) {
      cafeQuery = cafeQuery.in('mall_id', allowedMalls);
    }

    if (activeStart) cafeQuery = cafeQuery.gte('order_date', format(activeStart, 'yyyy-MM-dd') + 'T00:00:00+09:00');
    if (activeEnd)   cafeQuery = cafeQuery.lte('order_date', format(activeEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00');

    // 주문번호를 note에서 파싱하는 헬퍼
    const parseOrderNo = (note, id, prefix) => {
      // 매장출고(SHP)의 경우 무조건 SHP-xxxx ID 형식 사용 (온라인 주문번호 병기)
      if (prefix === 'SHP') {
        const shpId = `${prefix}-${(id || '').toString().slice(0, 8).toUpperCase()}`;
        if (note) {
          const m = note.match(/20\d{6}-\d{7}/);
          if (m) return `${shpId} (${m[0]})`;
        }
        return shpId;
      }
      
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
      supabase.from('parts').select('id, code, barcode, name, note, brand, price')
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
    const partsById = {};
    const partsBrandById = {};
    const partsNameById = {};
    const partsNameByCode = {};
    const partsPriceById = {};
    const partsPriceByCode = {};

    (partsRes.data || []).forEach(p => {
      const cat = formatCategory(p.note);
      const brand = p.brand || '-';
      partsById[p.id] = cat;
      partsBrandById[p.id] = brand;
      partsNameById[p.id] = p.name;
      partsPriceById[p.id] = p.price || 0;

      if (p.name) {
        partsMap[p.name] = cat;
        partsBrandMap[p.name] = brand;
      }
      if (p.code) {
        partsByCode[p.code] = cat;
        partsBrandByCode[p.code] = brand;
        partsNameByCode[p.code] = p.name;
        partsPriceByCode[p.code] = p.price || 0;
      }
      if (p.barcode) {
        partsByCode[p.barcode] = cat;
        partsBrandByCode[p.barcode] = brand;
        partsNameByCode[p.barcode] = p.name;
        partsPriceByCode[p.barcode] = p.price || 0;
      }
    });

    const resolvePartName = (originalName, customCode = '', productCode = '', partId = null) => {
      if (partId && partsNameById[partId]) return partsNameById[partId];
      if (customCode && partsNameByCode[customCode]) return partsNameByCode[customCode];
      if (productCode && partsNameByCode[productCode]) return partsNameByCode[productCode];
      return originalName;
    };

    const resolveCategory = (name, customCode = '', productCode = '', partId = null) => {
      if (partId && partsById[partId]) return partsById[partId];
      if (customCode && partsByCode[customCode]) return partsByCode[customCode];
      if (productCode && partsByCode[productCode]) return partsByCode[productCode];
      if (name && partsMap[name]) return partsMap[name];
      const n = (name || '').toLowerCase();
      if (n.includes('교환') || n.includes('수리') || n.includes('공임') || n.includes('출장') || n.includes('작업')) return '공임';
      if (n.includes('자전거') || n.includes('기체') || n.includes('완차') || n.includes('스쿠터')) return '기체';
      if (productCode && (productCode.startsWith('XRBP') || productCode.startsWith('NBP'))) return '부품';
      if (productCode && (productCode.startsWith('XRBS') || productCode.startsWith('NBS'))) return '공임';
      return '기타';
    };

    const resolveBrand = (name, customCode = '', productCode = '', partId = null) => {
      if (partId && partsBrandById[partId]) return partsBrandById[partId];
      if (customCode && partsBrandByCode[customCode]) return partsBrandByCode[customCode];
      if (productCode && partsBrandByCode[productCode]) return partsBrandByCode[productCode];
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
        .select('id, service_id, quantity, price, usage, part_id, parts(name, price)')
        .in('service_id', asIds);
      if (spErr) console.warn('service_parts fetch error (non-critical):', spErr.message);
      (spData || []).forEach(sp => {
        if (!servicePartsMap[sp.service_id]) servicePartsMap[sp.service_id] = [];
        servicePartsMap[sp.service_id].push(sp);
      });
    }

    // Cafe24 연동 시 발생한 transactions 를 통해 실 출고 창고 역추적
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

    // === BUG 2 FIX: Deduplicate shipments that have Cafe24 order numbers in note ===
    const duplicatedCafeOrderNos = new Set();
    const shipmentCafeOrderNos = (shipRes.data || []).map(s => {
      const m = s.note ? String(s.note).match(/(20\d{6}-\d{7})/) : null;
      return m ? m[0] : null;
    }).filter(Boolean);

    if (shipmentCafeOrderNos.length > 0) {
      // 100개 단위로 끊어서 조회 (Supabase 필터 길이 제한 대비)
      for (let i = 0; i < shipmentCafeOrderNos.length; i += 100) {
        try {
          const chunk = shipmentCafeOrderNos.slice(i, i + 100);
          const { data: dupCafeOrders, error } = await supabase
            .from('cafe24_orders')
            .select('order_id')
            .in('order_id', chunk)
            .eq('is_deleted', false)
            .eq('is_transferred', true);
          
          if (error) {
            console.error('Error fetching duplicate cafe orders chunk:', error);
            continue;
          }
          (dupCafeOrders || []).forEach(o => duplicatedCafeOrderNos.add(o.order_id));
        } catch (err) {
          console.error('Exception fetching duplicate cafe orders chunk:', err);
        }
      }
    }
    // =================================================================================

    const rows = [];

    // 출고 건 → 품목 단위로 펼치기
    (shipRes.data || []).forEach(s => {
      const match = s.note ? String(s.note).match(/(20\d{6}-\d{7})/) : null;
      if (match && duplicatedCafeOrderNos.has(match[0])) {
         return; // 중복 집계 방지 (Bug 2)
      }
      const parts = s.shipment_parts || [];
      const warehouseName = (s.warehouse_id && warehouseMap[s.warehouse_id]) || '-';
      const orderNo = parseOrderNo(s.note, s.id, 'SHP');
      let extractedChannel = s.sales_channel && s.sales_channel !== '-' ? s.sales_channel : '-';
      if (extractedChannel === '-' && s.note) {
         const match = s.note.match(/\[판매처:\s*(.*?)\]/);
         if (match && match[1]) {
             extractedChannel = match[1].trim();
         }
      }
      if (extractedChannel === '-') extractedChannel = '일반출고(공홈)';

      // VAT 보정: shipment.price(VAT포함)와 parts.price 합계(공급가일 수 있음) 비교
      const shipTotalPrice = Number(s.price || 0);
      const partsRawSum = parts.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 1), 0);
      // parts.price가 공급가(VAT별도)인지 판별: shipment.price / parts합 ≈ 1.1이면 공급가
      const needsVatCorrection = partsRawSum > 0 && shipTotalPrice > 0 && Math.abs((shipTotalPrice / partsRawSum) - 1.1) < 0.01;
      const vatMultiplier = needsVatCorrection ? 1.1 : 1;

      const baseFields = {
        _orderId: s.id, _type: 'shipment',
        date_val: s.order_date,
        customer_name: s.customer_name || '-',
        sales_channel: extractedChannel,
        status: s.status || '완료',
        note: s.note || '',
        warehouse_name: warehouseName,
        order_no: orderNo,
      };
      if (parts.length === 0) {
        rows.push({ ...baseFields, _id: `ship_${s.id}_none`, part_name: '(품목 미기재)', part_category: '기타', quantity: 0, unit_price: 0, total_price: shipTotalPrice });
      } else {
        parts.forEach((p, idx) => {
          let returnedQty = 0;
          if (p.note && p.note.includes('[반품완료]')) {
            returnedQty = p.quantity;
          } else if (p.note && p.note.includes('[부분반품:')) {
            const matches = p.note.match(/\[부분반품:(\d+)개\]/g);
            if (matches) {
              matches.forEach(m => {
                const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
                if (qtyMatch && qtyMatch[1]) {
                  returnedQty += parseInt(qtyMatch[1], 10);
                }
              });
            }
          }
          const effectiveQty = Math.max(0, Number(p.quantity || 1) - returnedQty);
          const unitPriceVat = Math.round(Number(p.price || 0) * vatMultiplier);
          const total = unitPriceVat * effectiveQty;
          
          const pName = p.part_name || '상품';
          const pCode = p.part_code || '';
          
          let cat = p.part_category;
          if (cat === '파츠') cat = '부품'; // 통계 용어 통일
          if (!cat || cat === '-' || cat === '알수없음') {
            cat = resolveCategory(pName, pCode, '', p.part_id);
          }
          const brand = resolveBrand(pName, pCode, '', p.part_id);
          
          if (effectiveQty > 0) {
            rows.push({ ...baseFields, _id: `ship_${s.id}_${p.id || idx}`, part_name: pName, part_category: cat, part_brand: brand, quantity: effectiveQty, unit_price: unitPriceVat, total_price: total });
          }
          
          if (returnedQty > 0) {
            rows.push({ ...baseFields, _id: `ship_${s.id}_${p.id || idx}_ret`, part_name: `[반품] ${pName}`, part_category: cat, part_brand: brand, quantity: returnedQty, unit_price: unitPriceVat, total_price: 0, isCancelled: true });
          }
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
        status: s.status || '완료',
        note: s.note || '',
        order_no: orderNo,
      };
      if (parts.length > 0) {
        let pushedAny = false;
        parts.forEach((sp, idx) => {
          // A/S에서 실제 청구된 금액(sp.price)을 사용 (0원이면 워런티 등 무상수리)
          const unitPrice = sp.price !== undefined && sp.price !== null ? Number(sp.price) : Number(sp.parts?.price || 0);
          
          let returnedQty = 0;
          if (sp.usage && sp.usage.includes('[반품완료]')) {
            returnedQty = sp.quantity;
          } else if (sp.usage && sp.usage.includes('[부분반품:')) {
            const matches = sp.usage.match(/\[부분반품:(\d+)개\]/g);
            if (matches) {
              matches.forEach(m => {
                const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
                if (qtyMatch && qtyMatch[1]) {
                  returnedQty += parseInt(qtyMatch[1], 10);
                }
              });
            }
          }
          const qty = Math.max(0, Number(sp.quantity || 1) - returnedQty);
          const total = unitPrice * qty;
          
          const pName = sp.parts?.name || '부품';
          const cat = resolveCategory(pName, '', '', sp.part_id);
          const brand = resolveBrand(pName, '', '', sp.part_id);
          
          let wid = serviceTxMap[`${s.id}_${sp.part_id}`];
          if (!wid) wid = fallbackWhId;
          let itemWarehouseName = fallbackWhName;
          if (wid && warehouseMap[wid]) itemWarehouseName = warehouseMap[wid];

          if (qty > 0) {
            pushedAny = true;
            rows.push({ ...baseFields, warehouse_name: itemWarehouseName, _id: `as_${s.id}_${sp.id || idx}`, part_name: pName, part_category: cat, part_brand: brand, quantity: qty, unit_price: unitPrice, total_price: total });
          }
          
          if (returnedQty > 0) {
            pushedAny = true;
            rows.push({ ...baseFields, warehouse_name: itemWarehouseName, _id: `as_${s.id}_${sp.id || idx}_ret`, part_name: `[반품] ${pName}`, part_category: cat, part_brand: brand, quantity: returnedQty, unit_price: unitPrice, total_price: 0, isCancelled: true });
          }
        });
        if (!pushedAny) {
           rows.push({ ...baseFields, warehouse_name: fallbackWhName, _id: `as_${s.id}_none`, part_name: '(품목 미기재/전부반품)', part_category: '기타', part_brand: '-', quantity: 0, unit_price: 0, total_price: 0 });
        }
      } else {
        rows.push({ ...baseFields, warehouse_name: fallbackWhName, _id: `as_${s.id}_none`, part_name: '(품목 미기재)', part_category: '기타', part_brand: '-', quantity: 0, unit_price: 0, total_price: 0 });
      }
    });

    // 온라인 건 → 품목 단위로 펼치기
    (cafeRes.data || []).forEach(o => {
      const items = o.order_items || [];
      const orderNo = String(o.order_id || '').includes('_') ? String(o.order_id).split('_').slice(1).join('_') : o.order_id;
      const fallbackWid = cafeWarehouseMap[o.id];
      
      // "반영 예외(무시)" 처리된 건은 제외
      const hasWarehouseInfo = items.some(item => item._warehouse_id) || fallbackWid;
      if (!hasWarehouseInfo) return;
      
      const fallbackWarehouseName = fallbackWid && warehouseMap[fallbackWid] ? warehouseMap[fallbackWid] : '온라인출고';
      
      const koStatus = getKoStatus(o.status);
      const baseFields = {
        _orderId: o.id, _type: 'cafe24',
        date_val: o.order_date,
        customer_name: o.buyer_name || '-',
        sales_channel: o.agencies?.name || '온라인주문',
        status: koStatus,
        note: koStatus,
        order_no: orderNo,
      };

      if (items.length === 0) {
        rows.push({ ...baseFields, warehouse_name: fallbackWarehouseName, _id: `cafe_${o.id}_none`, part_name: '(품목 미기재)', part_category: '기타', part_brand: '-', quantity: 0, unit_price: 0, total_price: Number(o.total_amount || 0) });
      } else {
        let orderBrand = '-';
        let seenProductCodes = new Set();
        const validItems = items.filter(item => !['C11', 'C40', 'R40', 'E40'].includes(item.order_status));
        validItems.sort((a, b) => {
             const amtA = Number(a.payment_amount !== undefined && a.payment_amount !== null ? a.payment_amount : (a.product_price || a.price || 0));
             const amtB = Number(b.payment_amount !== undefined && b.payment_amount !== null ? b.payment_amount : (b.product_price || b.price || 0));
             return amtB - amtA;
        });
        if (validItems.length === 0) return; // 전액/전부 취소건은 리스트에서 제외
        
        const canceledItems = (items || []).filter(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
        const canceledAmount = canceledItems.reduce((acc, it) => acc + (Number(it.product_price || it.price || 0) * Number(it.quantity || 1)), 0);
        // 선불금 처리: total_amount=0이면 품목 payment_amount 합계 사용
        // 단, nearbike_ 주문은 회원할인 전액 건으로 실결제 0원이므로 제외
        const itemPaymentSum = validItems.reduce((acc, i) => acc + Number(i.payment_amount || 0), 0);
        const isNearbikeMemberDiscount = String(orderNo).startsWith('nearbike_') && Number(o.total_amount || 0) === 0;
        const effectiveTotal = !isNearbikeMemberDiscount && Number(o.total_amount || 0) === 0 && itemPaymentSum > 0 ? itemPaymentSum : Number(o.total_amount || 0);
        const distributableAmount = Math.max(0, effectiveTotal - Number(o.shipping_fee || 0) - canceledAmount);

        let totalWeight = validItems.reduce((acc, i) => {
           let w = 0;
           if (i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) > 0) {
               w = Number(i.payment_amount);
           } else if (!(i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) === 0)) {
               w = Number(i.product_price || i.price || 0) * Number(i.quantity || 1);
           }
           return acc + w;
        }, 0);

        if (totalWeight === 0 && distributableAmount > 0) {
            validItems.forEach(i => {
                const pCode = String(i.custom_product_code || i.product_code || '').trim();
                const pPrice = i.part_id ? partsPriceById[i.part_id] : (pCode ? partsPriceByCode[pCode] : 0);
                i._fallbackWeight = Number(pPrice || 0) * Number(i.quantity || 1);
                totalWeight += i._fallbackWeight;
            });
            if (totalWeight === 0) {
                validItems.forEach(i => {
                    i._fallbackWeight = Number(i.quantity || 1);
                    totalWeight += i._fallbackWeight;
                });
            }
        }

        const orderRows = [];

        validItems.forEach((item, idx) => {
          const itemCode = item.custom_product_code || item.product_code || '';
          let wid = item._warehouse_id || cafeWarehouseMap[`${o.id}_${itemCode}`];
          if (!wid) wid = fallbackWid;
          
          let itemWarehouseName = '온라인출고';
          if (wid === 'DEFAULT') itemWarehouseName = '청담본점';
          else if (wid && warehouseMap[wid]) itemWarehouseName = warehouseMap[wid];
          
          let pName = resolvePartName(item.product_name || item.name || '상품', item.custom_product_code, item.product_code, item.part_id);
          const optStr = item.option_value || item.options;
          if (optStr && String(optStr).trim() !== '') {
            pName = `${pName} [${String(optStr).trim()}]`;
          }
          const itemQty = Number(item.quantity || 1);
          let statQty = itemQty;
          const pCodeCheck = (String(item.product_code || '') + '_' + String(item.custom_product_code || '') + '_' + String(item.option_value || item.options || '')).trim();
          let isDuplicate = false;
          if (pCodeCheck !== '__') {
              if (seenProductCodes.has(pCodeCheck)) {
                  isDuplicate = true;
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
                 baseWeight = Number(item.product_price || item.price || 0) * itemQty;
              }
          }
          let iPrice = Number(item.product_price || item.price || 0);

          let total = 0;
          if (totalWeight > 0) {
             total = Math.floor((baseWeight / totalWeight) * distributableAmount);
             if (idx === validItems.length - 1) {
                let previousTotals = validItems.slice(0, validItems.length - 1).reduce((acc, prevItem) => {
                   let prevW = 0;
                   if (prevItem.payment_amount !== undefined && prevItem.payment_amount !== null && Number(prevItem.payment_amount) > 0) {
                       prevW = Number(prevItem.payment_amount);
                   } else if (!(prevItem.payment_amount !== undefined && prevItem.payment_amount !== null && Number(prevItem.payment_amount) === 0)) {
                       prevW = Number(prevItem.product_price || prevItem.price || 0) * Number(prevItem.quantity || 1);
                   }
                   return acc + Math.floor((prevW / totalWeight) * distributableAmount);
                }, 0);
                total = distributableAmount - previousTotals;
             }
          } else if (distributableAmount > 0) {
             total = Math.floor(distributableAmount / validItems.length);
             if (idx === validItems.length - 1) {
                total = distributableAmount - (total * (validItems.length - 1));
             }
          }

          if (iPrice === 0 && total > 0) iPrice = itemQty > 0 ? Math.round(total / itemQty) : 0;

          let shipFee = 0;
          if (idx === 0) {
            shipFee = Number(o.shipping_fee || 0);
          }
          const customCode = item.custom_product_code || '';
          const pCode = item.product_code || '';

          const cat = resolveCategory(pName, customCode, pCode, item.part_id);
          const brand = resolveBrand(pName, customCode, pCode, item.part_id);
          
          if (idx === 0) {
             orderBrand = brand;
          }

          if (isDuplicate) {
              const firstRow = orderRows.find(r => r._pCode === pCodeCheck);
              if (firstRow) {
                  firstRow.total_price += total;
                  firstRow.quantity += itemQty;
                  total = 0;
                  statQty = 0;
              }
          }

          if (!['C11', 'C40', 'R40', 'E40'].includes(item.order_status)) {
             orderRows.push({ ...baseFields, warehouse_name: itemWarehouseName, _id: `cafe_${o.id}_${idx}`, part_name: pName, part_category: cat, part_brand: brand, quantity: statQty, unit_price: iPrice, unit_shipping_fee: shipFee, total_price: total, _pCode: pCodeCheck });
          }
        });
        
        orderRows.forEach(r => rows.push(r));
        
        const canceledItemsList = items.filter(item => ['C11', 'C40', 'R40', 'E40'].includes(item.order_status));
        canceledItemsList.forEach((item, idx) => {
          let pName = resolvePartName(item.product_name || item.name || '상품', item.custom_product_code, item.product_code, item.part_id);
          const optStr = item.option_value || item.options;
          if (optStr && String(optStr).trim() !== '') {
            pName = `${pName} [${String(optStr).trim()}]`;
          }
          const customCode = item.custom_product_code || '';
          const pCode = item.product_code || '';
          const cat = resolveCategory(pName, customCode, pCode, item.part_id);
          const brand = resolveBrand(pName, customCode, pCode, item.part_id);
          
          rows.push({
             ...baseFields,
             warehouse_name: fallbackWarehouseName,
             _id: `cafe_${o.id}_${idx}_canc`,
             part_name: `[취소/반품] ${pName}`,
             part_category: cat,
             part_brand: brand,
             quantity: Number(item.quantity || 1),
             unit_price: Number(item.product_price || item.price || 0),
             total_price: 0,
             unit_shipping_fee: 0,
             isCancelled: true
          });
        });

        const shipFee = Number(o.shipping_fee || 0);

        if (shipFee > 0) {
          rows.push({
            ...baseFields,
            warehouse_name: fallbackWarehouseName,
            _id: `cafe_${o.id}_shipping`,
            part_name: '배송비',
            part_category: '기타',
            part_brand: orderBrand,
            quantity: 1,
            unit_price: Number(o.shipping_fee),
            unit_shipping_fee: 0,
            total_price: shipFee
          });
        }
        

      }
    });

    const uniqueSellers = new Set();
    const uniqueStatuses = new Set();
    const uniqueBrands = new Set();
    rows.forEach(r => {
       if (r.sales_channel) uniqueSellers.add(r.sales_channel);
       if (r.status) uniqueStatuses.add(r.status);
       if (r.part_brand && r.part_brand !== '-') uniqueBrands.add(r.part_brand);
    });
    // Ensure '고객' is always present as a group filter option
    uniqueSellers.add('고객');
    setSellers(['all', '전체 대리점', ...Array.from(uniqueSellers)]);
    setStatuses(['all', ...Array.from(uniqueStatuses)]);
    setBrands(['all', ...Array.from(uniqueBrands)]);

    rows.sort((a, b) => new Date(b.date_val) - new Date(a.date_val));
    setFlatRows(rows);
    setLoading(false);
  };

  const B2C_CHANNELS = ['공홈', '청담매장', '라이클', '라이클-우리', '스마트할부', '스마트스토어', '기타', '온라인주문', '고객', '-', '본사/기본', '과거 이카운트 이관', '일반출고(공홈)', '매장출고', '본점', '매장'];

  // ── 필터 ────────────────────────────────────────────
  const filtered = flatRows.filter(r => {
    if (filterType !== 'all' && r._type !== filterType) return false;
    if (statusFilter !== 'all' && statusFilter !== '전체 상태' && r.status !== statusFilter) return false;
    
    if (sellerFilter !== 'all' && sellerFilter !== '전체 판매처') {
      if (sellerFilter === '전체 대리점') {
        const isAgency = r.sales_channel && !B2C_CHANNELS.includes(r.sales_channel);
        if (!isAgency) return false;
      } else if (sellerFilter === '고객') {
        const isB2C = !r.sales_channel || B2C_CHANNELS.includes(r.sales_channel);
        if (!isB2C) return false;
      } else if (r.sales_channel !== sellerFilter) {
        return false;
      }
    }

    if (brandFilter !== 'all' && brandFilter !== '전체 브랜드' && r.part_brand !== brandFilter) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (String(r.customer_name || '')).toLowerCase().includes(q) ||
        (String(r.sales_channel || '')).toLowerCase().includes(q) ||
        (String(r.part_name || '')).toLowerCase().includes(q) ||
        (String(r.note || '')).toLowerCase().includes(q) ||
        (String(r.order_no || '')).toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── 합계 계산 ────────────────────────────────────────
  const totalAmt   = filtered.reduce((a, r) => a + Number(r.total_price || 0), 0);
  const totalSupply = Math.round(totalAmt / 1.1);
  const totalVat   = totalAmt - totalSupply;
  const totalQty   = filtered.reduce((a, r) => a + Number(r.quantity || 0), 0);

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

  filtered.forEach(r => {
    const price = Number(r.total_price || 0);
    if (r._type === 'service') {
      if (r._orderId) uniqueGroups.service.add(r._orderId);
      groupAmounts.service += price;
    } else {
      const isAgency = r.sales_channel && !B2C_CHANNELS.includes(r.sales_channel);
      if (isAgency) {
        if (r._orderId) uniqueGroups.agency.add(r._orderId);
        groupAmounts.agency += price;
      } else if (r._type === 'cafe24') {
        if (r._orderId) uniqueGroups.online.add(r._orderId);
        groupAmounts.online += price;
      } else {
        if (r._orderId) uniqueGroups.store.add(r._orderId);
        groupAmounts.store += price;
      }
    }
  });

  const countService = uniqueGroups.service.size;
  const countStore = uniqueGroups.store.size;
  const countOnline = uniqueGroups.online.size;
  const countAgency = uniqueGroups.agency.size;

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
  const paginatedItems = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  
  const paginated = [];
  paginatedItems.forEach((r, idx) => {
    paginated.push(r);
    const globalIdx = page * rowsPerPage + idx;
    const currentMonth = r.date_val ? format(new Date(r.date_val), 'yyyy/MM') : '';
    const nextItem = filtered[globalIdx + 1];
    const nextMonth = nextItem?.date_val ? format(new Date(nextItem.date_val), 'yyyy/MM') : '';
    
    // 월이 바뀌거나 마지막 항목인 경우에만 해당 월의 요약행 삽입
    if (currentMonth && currentMonth !== nextMonth) {
      paginated.push({ _isMonthSummary: true, _month: currentMonth, ...monthlyTotals[currentMonth] });
    }
  });

  // ── 행 클릭 ─────────────────────────────────────────
  const handleRowClick = (row) => {
    if (row._isMonthSummary) return;
    setEditTarget({ id: row._orderId, type: row._type });
    setEditOpen(true);
  };

  const handleExportExcel = async () => {
    try {
      const { downloadExcel } = await import('../../utils/excelUtils');
      const headers = [
        { key: 'date_val', label: '일자' },
        { key: 'cLabel', label: '구분' },
        { key: 'sales_channel_display', label: '채널(대리점)' },
        { key: 'customer_name', label: '고객명/수령인' },
        { key: 'warehouse_name', label: '출고창고' },
        { key: 'order_no', label: '주문번호' },
        { key: 'part_category', label: '품목구분' },
        { key: 'part_brand', label: '브랜드' },
        { key: 'part_name', label: '품목명' },
        { key: 'quantity', label: '수량' },
        { key: 'unit_price', label: '단가' },
        { key: 'supply', label: '공급가액' },
        { key: 'vat', label: '부가세' },
        { key: 'total_price', label: '합계' }
      ];

      const excelData = filtered.map(row => {
        const amtInfo = calcVAT(row.total_price);
        const isService = row._type === 'service';
        const isCafe = row._type === 'cafe24';
        
        let cLabel = '고객-출고';
        const isEcount = row._type === 'shipment' && row.note && row.note.includes('이카운트');
        const startsWithDate = row.order_no && /^(20[2-9]\d[0-1]\d[0-3]\d)/.test(row.order_no);
        const channel = row.sales_channel || '';
        
        const isAgency = channel && !B2C_CHANNELS.includes(channel);
        const isOnline = row._type === 'cafe24';

        if (isAgency) {
          if (isOnline || (isEcount && startsWithDate)) {
             cLabel = '대리점-온라인';
          } else {
             cLabel = '대리점-일반';
          }
        } else if (isOnline || (isEcount && startsWithDate)) {
          cLabel = '고객-온라인';
        } else if (isService) {
          cLabel = '고객-A/S';
        } else {
          cLabel = '고객-출고';
        }

        const sales_channel_display = channel || '-';

        return {
          ...row,
          date_val: row.date_val ? format(new Date(row.date_val), 'yyyy-MM-dd') : '-',
          cLabel,
          sales_channel_display,
          part_brand: row.part_brand || '-',
          supply: amtInfo.supply,
          vat: amtInfo.vat
        };
      });

      await downloadExcel(excelData, headers, `판매현황_${format(new Date(), 'yyyy-MM-dd')}`);
    } catch (err) {
      console.error(err);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
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
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#e3f2fd', borderRadius: 2, height: '100%' }}>
            <AssessmentIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="body2" color="textSecondary">총 판매액 (합계)</Typography>
              <Typography variant="h5" fontWeight="bold">{totalAmt.toLocaleString()}원</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={8}>
          <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f5f5f5', borderRadius: 2, height: '100%' }}>
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2" color="textSecondary" mb={1}>구분별 주문/처리 건수</Typography>
              <Stack direction="row" justifyContent="space-around" alignItems="center" sx={{ width: '100%' }} divider={<Divider orientation="vertical" flexItem />}>
                 <Box sx={{ flex: 1, textAlign: 'center' }}>
                   <Typography variant="body2" color="textSecondary">매장/일반 출고</Typography>
                   <Typography variant="h5" fontWeight="bold" color="primary">{countStore.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                   <Typography variant="body2" color="textSecondary">{groupAmounts.store.toLocaleString()}원</Typography>
                 </Box>
                 <Box sx={{ flex: 1, textAlign: 'center' }}>
                   <Typography variant="body2" color="textSecondary">온라인 출고</Typography>
                   <Typography variant="h5" fontWeight="bold" sx={{ color: '#0288d1' }}>{countOnline.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                   <Typography variant="body2" color="textSecondary">{groupAmounts.online.toLocaleString()}원</Typography>
                 </Box>
                 <Box sx={{ flex: 1, textAlign: 'center' }}>
                   <Typography variant="body2" color="textSecondary">대리점 (B2B)</Typography>
                   <Typography variant="h5" fontWeight="bold" sx={{ color: '#2e7d32' }}>{countAgency.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                   <Typography variant="body2" color="textSecondary">{groupAmounts.agency.toLocaleString()}원</Typography>
                 </Box>
                 <Box sx={{ flex: 1, textAlign: 'center' }}>
                   <Typography variant="body2" color="textSecondary">A/S 수리</Typography>
                   <Typography variant="h5" fontWeight="bold" sx={{ color: '#ed6c02' }}>{countService.toLocaleString()} <Typography component="span" variant="body1">건</Typography></Typography>
                   <Typography variant="body2" color="textSecondary">{groupAmounts.service.toLocaleString()}원</Typography>
                 </Box>
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* 검색/기간 통합 필터 UI */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          
          {/* 상태 & 판매처 & 구분 드롭다운 */}
          <Grid item xs={12} md="auto">
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ width: 110 }}>
                <InputLabel>분류</InputLabel>
                <Select value={filterType} label="분류" onChange={e => { setFilterType(e.target.value); setPage(0); }}>
                  <MenuItem value="all">전체분류</MenuItem>
                  <MenuItem value="cafe24">온라인주문</MenuItem>
                  <MenuItem value="shipment">일반출고(수기)</MenuItem>
                  <MenuItem value="service">A/S</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 120 }}>
                <InputLabel>상태</InputLabel>
                <Select value={statusFilter} label="상태" onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
                  {statuses.map(s => <MenuItem key={s} value={s}>{s === 'all' ? '전체 상태' : s}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 130 }}>
                <InputLabel>판매처</InputLabel>
                <Select value={sellerFilter} label="판매처" onChange={e => { setSellerFilter(e.target.value); setPage(0); }}>
                  {sellers.map(s => <MenuItem key={s} value={s}>{s === 'all' ? '전체 판매처' : s}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 130 }}>
                <InputLabel>브랜드</InputLabel>
                <Select value={brandFilter} label="브랜드" onChange={e => { setBrandFilter(e.target.value); setPage(0); }}>
                  {brands.map(b => <MenuItem key={b} value={b}>{b === 'all' ? '전체 브랜드' : b}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </Grid>

          {/* 날짜 필터 & 퀵버튼 */}
          <Grid item xs={12} md>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '6px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#e0e0e0', borderRadius: '4px' } }}>
              <FormControl size="small" sx={{ width: 140, flexShrink: 0 }}>
                <InputLabel>날짜 기준</InputLabel>
                <Select value={dateType} label="날짜 기준" onChange={e => setDateType(e.target.value)}>
                  <MenuItem value="주문/출고/완료일자">주문/출고/완료일자</MenuItem>
                </Select>
              </FormControl>

              <ButtonGroup size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('lastWeek')}>지난주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={startDate}
                    onChange={v => setStartDate(v)}
                    slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={endDate}
                    onChange={v => setEndDate(v)}
                    slotProps={{ textField: { size: 'small', sx: { width: 140 } } }}
                  />
                </Box>
              </LocalizationProvider>
            </Stack>
          </Grid>

          {/* 검색명 입력 & 버튼 그룹 */}
          <Grid item xs={12}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="고객명, 판매처, 주문번호, 제품명 등 검색"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyPress={e => { if (e.key === 'Enter') fetchSales(); }}
                sx={{ flexGrow: 1, maxWidth: 500 }}
              />
              <Button variant="contained" onClick={() => { setPage(0); fetchSales(); }} sx={{ bgcolor: '#3182f6' }}>검색</Button>
              <Button variant="outlined" onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSellerFilter('all');
                setFilterType('all');
                setStartDate(null);
                setEndDate(null);
                setPage(0);
                setTimeout(() => fetchSales(), 0);
              }}>초기화</Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button 
                variant="outlined" 
                color="success" 
                startIcon={<FileDownloadIcon />} 
                onClick={handleExportExcel}
                sx={{ mr: 1, bgcolor: 'white' }}
              >
                엑셀 추출
              </Button>
              <Button 
                variant="text" 
                color="primary" 
                onClick={() => setShowTaxDetails(!showTaxDetails)}
                sx={{ fontWeight: 'bold' }}
              >
                {showTaxDetails ? '공급가/부가세 숨기기' : '공급가/부가세 보기'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* 테이블 */}
      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 650, width: '100%', tableLayout: 'auto', border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              {['일자', '구분', '채널(대리점)', '고객명/수령인', '출고창고', '주문번호', '품목구분', '브랜드', '품목명', '수량', '단가'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: h === '출고창고' || h === '주문번호' || h === '품목구분' || h === '브랜드' ? 'center' : 'left' }}>{h}</TableCell>
              ))}
              {showTaxDetails && <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>공급가액</TableCell>}
              {showTaxDetails && <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>부가세</TableCell>}
              <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>합계</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showTaxDetails ? 14 : 12} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showTaxDetails ? 14 : 12} align="center" sx={{ py: 5 }}>조회된 판매 내역이 없습니다.</TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => {
                // 월별 합계 행
                if (row._isMonthSummary) {
                  return (
                    <TableRow key={`month_${row._month}_${idx}`} sx={{ bgcolor: '#e8eaf6' }}>
                      <TableCell colSpan={9} sx={{ fontWeight: 'bold', color: '#3f51b5', textAlign: 'center' }}>{row._month} 계</TableCell>
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

                let cLabel = '고객-출고';
                let cColor = 'primary';
                const isEcount = row._type === 'shipment' && row.note && row.note.includes('이카운트');
                const startsWithDate = row.order_no && /^(20[2-9]\d[0-1]\d[0-3]\d)/.test(row.order_no);
                const channel = row.sales_channel || '';
                
                const isAgency = channel && !B2C_CHANNELS.includes(channel);
                const isOnline = row._type === 'cafe24';

                if (isAgency) {
                  if (isOnline || (isEcount && startsWithDate)) {
                     cLabel = '대리점-온라인';
                  } else {
                     cLabel = '대리점-일반';
                  }
                  cColor = 'info';
                } else if (isOnline || (isEcount && startsWithDate)) {
                  cLabel = '고객-온라인';
                  cColor = 'success';
                } else if (isService) {
                  cLabel = '고객-A/S';
                  cColor = 'warning';
                } else {
                  cLabel = '고객-출고';
                  cColor = 'primary';
                }

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
                      <Chip size="small" label={cLabel} color={cColor} variant="outlined" sx={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem', color: '#1976d2', fontWeight: 500, whiteSpace: 'nowrap' }}>
                       {row.sales_channel || '-'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{row.customer_name}</span>
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
                      <Typography variant="body2" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isCancelled ? 'text.secondary' : 'inherit' }}>{row.part_name}</Typography>
                      {row.unit_shipping_fee > 0 && <Typography variant="caption" color="textSecondary">배송비 포함</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isCancelled ? 'text.secondary' : 'inherit' }}>{Number(row.quantity).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isCancelled ? 'text.secondary' : 'inherit' }}>{Number(row.unit_price).toLocaleString()}</TableCell>
                    {showTaxDetails && <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isCancelled ? 'text.secondary' : 'inherit' }}>{supply.toLocaleString()}</TableCell>}
                    {showTaxDetails && <TableCell align="right" sx={{ textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isCancelled ? 'text.secondary' : 'inherit' }}>{vat.toLocaleString()}</TableCell>}
                    <TableCell align="right" sx={{ fontWeight: row.isCancelled ? 'normal' : 'bold', textDecoration: row.isCancelled ? 'line-through' : 'none', color: row.isCancelled ? 'text.secondary' : 'inherit' }}>
                      {Number(row.total_price).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}

            {/* 전체 합계 푸터 */}
            {!loading && filtered.length > 0 && (
              <TableRow sx={{ bgcolor: '#fff3e0', '& td': { fontWeight: 'bold', fontSize: '0.9rem' } }}>
                <TableCell colSpan={9} align="right" sx={{ color: 'text.secondary' }}>총합계</TableCell>
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
        count={filtered.length}
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
