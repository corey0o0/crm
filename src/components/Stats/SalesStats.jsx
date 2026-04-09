import React, { useState, useEffect, useRef } from 'react';
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
  TextField,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Tabs,
  Tab,
  Divider,
  Autocomplete,
  ButtonGroup,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';


import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, parseISO, setMonth, getMonth, startOfWeek, endOfWeek, addWeeks, startOfYear, endOfYear, getWeekOfMonth } from 'date-fns';
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
import InventoryIcon from '@mui/icons-material/Inventory';
import BuildIcon from '@mui/icons-material/Build';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RefreshIcon from '@mui/icons-material/Refresh';
import { downloadExcel } from '../../utils/excelUtils';
import DownloadIcon from '@mui/icons-material/Download';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';

const getCategoryChipProps = (category) => {
  switch (category) {
    case '기체': return { sx: { bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 'bold' } };
    case '파츠': return { sx: { bgcolor: '#fce4ec', color: '#c2185b', fontWeight: 'bold' } };
    case '배터리': return { sx: { bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' } };
    case '공임': return { sx: { bgcolor: '#fff3e0', color: '#e65100', fontWeight: 'bold' } };
    case '악세서리': return { sx: { bgcolor: '#f3e5f5', color: '#6a1b9a', fontWeight: 'bold' } };
    default: return { sx: { bgcolor: '#f5f5f5', color: '#616161', fontWeight: 'bold' } };
  }
};

const getUsageChipProps = (usage) => {
  switch (usage) {
    case '워런티': return { sx: { bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 'bold' } };
    case '일반수리': return { sx: { bgcolor: '#fce4ec', color: '#c2185b', fontWeight: 'bold' } };
    case '판매': return { sx: { bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' } };
    case '초기불량': return { sx: { bgcolor: '#fff3e0', color: '#e65100', fontWeight: 'bold' } };
    default: return { sx: { bgcolor: '#f5f5f5', color: '#616161', fontWeight: 'bold' } };
  }
};

function SalesStats() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [brand, setBrand] = useState('전체');
  const [salesData, setSalesData] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalServiceSales: 0,
    totalShipmentSales: 0,
    totalSales: 0,
    totalServiceSalesAS: 0,
    totalServiceSalesSell: 0,
    totalServiceCount: 0,
    totalShipmentCount: 0,
    totalCustomerSales: {}
  });
  const [partsData, setPartsData] = useState({
    servicePartsByDate: {},
    shipmentPartsByDate: {}
  });
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [typeStats, setTypeStats] = useState([]);
  const [yearlyStats, setYearlyStats] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [compareStats, setCompareStats] = useState({ context: null, mom: null, yoy: null, wow: null, yoyWeek: null });
  const [topProducts, setTopProducts] = useState([]);
  const [topServiceParts, setTopServiceParts] = useState([]);
  const [topN, setTopN] = useState(5); // Top 리스트 개수 (기본 5)
  const [topSort, setTopSort] = useState('qty'); // 'qty' | 'amount'
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [selectedChannelStats, setSelectedChannelStats] = useState(null);
  const [totalLaborSales, setTotalLaborSales] = useState(0);
  const brandOptions = ['전체', 'XRB', 'NB'];
  const currentMonth = getMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const partsPriceMapRef = useRef(new Map());

  // 개발 모드 전용 디버그 로그
  const ENABLE_DEBUG_LOGS = false;
  const debugLog = (...args) => {
    if (process.env.NODE_ENV === 'development' && ENABLE_DEBUG_LOGS) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  // 연도 선택 핸들러
  const handleYearSelect = (year) => {
    setSelectedYear(year);
    // 선택된 연도의 1월 1일부터 12월 31일까지로 날짜 설정
    const newStartDate = startOfYear(new Date(year, 0, 1));
    const newEndDate = endOfYear(new Date(year, 11, 31));

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setSelectedMonth(null); // 월 선택 초기화

    handleSearch(newStartDate, newEndDate, brand);
  };

  // 월별 버튼 클릭 핸들러
  const handleMonthSelect = (monthIndex) => {
    // monthIndex는 0부터 시작하는 인덱스임 (0: 1월, 1: 2월, ..., 11: 12월)
    // 버튼의 월 표시는 1부터 시작하므로 화면에 표시되는 월과 내부 처리 월이 정확히 일치하는지 확인해야 함
    const year = selectedYear;

    // 선택된 월의 날짜를 직접 생성 (setMonth 대신)
    const newDate = new Date(year, monthIndex, 1); // 선택한 월의 1일

    // 해당 월의 시작일과 종료일 설정
    const newStartDate = startOfMonth(newDate);
    const newEndDate = endOfMonth(newDate);

    console.log(`선택한 월: ${monthIndex + 1}월`);
    console.log(`시작일: ${format(newStartDate, 'yyyy-MM-dd')}`);
    console.log(`종료일: ${format(newEndDate, 'yyyy-MM-dd')}`);

    // 상태 업데이트 (시간차를 두고 처리하지 않도록 상태 업데이트 후 데이터 조회)
    setSelectedMonth(monthIndex);
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    // 이 부분에서 fetchSalesData를 직접 호출하지 않고 handleSearch를 대신 호출
    // setTimeout 대신 handleSearch 함수로 데이터 조회 통합
    handleSearch(newStartDate, newEndDate, brand);
  };

  // 판매처 정보 추출 함수
  const extractSalesChannel = (note, salesChannelField) => {
    // 1. sales_channel 필드가 있으면 우선 사용
    if (salesChannelField && salesChannelField.trim() !== '') {
      return salesChannelField.trim();
    }

    // 2. note 필드에서 [판매처: XXX] 형식 검색
    if (note) {
      const match = note.match(/\[판매처:\s*(.*?)\]/);
      if (match && match[1]) {
        return match[1].trim();
      }
      // 주요 키워드 검색 (청담매장 우선 처리)
      if (note.includes('청담매장')) {
        return '청담매장';
      }
      if (note.includes('청담')) {
        return '청담매장';
      }

      const keywords = ['공홈', '블로그', '네이버', '인스타', '쿠팡', '매장', '스마트할부', '라이클-우리', '스마트스토어'];
      for (const keyword of keywords) {
        if (note.includes(keyword)) {
          return keyword;
        }
      }
    }
    return '미지정'; // 모든 조건에 해당하지 않으면 '미지정'으로 처리
  };

  // 날짜를 'YYYY-MM-DD 00:00:00'로 변환
  const formatDateToStartOfDay = (date) => {
    return format(date, 'yyyy-MM-dd') + ' 00:00:00';
  };
  // 날짜를 'YYYY-MM-DD 23:59:59'로 변환
  const formatDateToEndOfDay = (date) => {
    return format(date, 'yyyy-MM-dd') + ' 23:59:59';
  };

  const fetchSalesData = async (periodInfo) => {
    // periodInfo가 없으면 현재 상태 값 사용
    const { startDate: queryStartDate, endDate: queryEndDate, brand: queryBrand } =
      periodInfo || { startDate, endDate, brand };

    try {
      setLoading(true);

      // 1. parts 테이블에서 모든 부품의 이름과 단가(price)를 가져옵니다.
      const { data: allPartsData, error: allPartsError } = await supabase
        .from('parts')
        .select('name, price, note');

      if (allPartsError) {
        console.error('Parts 테이블 조회 오류:', allPartsError);
      }

      const partsPriceMap = new Map();
      if (allPartsData) {
        allPartsData.forEach(p => {
          if (p.name) {
            // 가격과 노트를 객체로 저장
            partsPriceMap.set(p.name.trim(), {
              price: typeof p.price === 'number' ? p.price : 0,
              note: p.note
            });
          }
        });
      }
      partsPriceMapRef.current = partsPriceMap;
      console.log('[DEBUG] Parts Price Map Loaded');

      // 날짜 범위를 'YYYY-MM-DD 00:00:00' ~ 'YYYY-MM-DD 23:59:59'로 변환
      const formattedStartDate = format(queryStartDate, 'yyyy-MM-dd');
      const formattedEndDate = format(queryEndDate, 'yyyy-MM-dd');
      const startDateTime = formatDateToStartOfDay(queryStartDate);
      const endDateTime = formatDateToEndOfDay(queryEndDate);
      console.log('====== 매출 데이터 조회 시작 ======');
      console.log(`조회 기간: ${startDateTime} ~ ${endDateTime}`);
      console.log(`브랜드: ${queryBrand}`);

      // 1-1. 출고 데이터 먼저 조회 (id 목록 추출)
      let shipmentQuery = supabase
        .from('shipments')
        .select(`
          id,
          brand,
          order_date,
          product_name,
          quantity,
          price,
          status,
          note,
          sales_channel,
          customer_name,
          customer_phone
        `)
        .gte('order_date', startDateTime)
        .lte('order_date', endDateTime);

      if (forceRefresh > 0) {
        shipmentQuery = shipmentQuery.options({
          cache: 'no-store',
          head: false
        });
      }
      if (queryBrand !== '전체') {
        shipmentQuery = shipmentQuery.eq('brand', queryBrand);
      }
      const { data: shipmentsData, error: shipmentsError } = await shipmentQuery;
      if (shipmentsError) {
        console.error('출고 데이터 조회 오류:', shipmentsError);
        throw shipmentsError;
      }
      console.log('조회된 출고 데이터:', shipmentsData);

      // 1-2. 출고건 id 목록 추출
      const shipmentIds = (shipmentsData || []).map(s => s.id);
      let shipmentPartsByDate = {};
      if (shipmentIds.length > 0) {
        // 2. shipment_parts에서 실제 부품별 금액/수량/합계 조회
        const { data: shipmentPartsData, error: shipmentPartsError } = await supabase
          .from('shipment_parts')
          .select('shipment_id, part_name, part_code, part_category, quantity, price, total_price, created_at')
          .in('shipment_id', shipmentIds);
        if (shipmentPartsError) {
          console.error('shipment_parts 조회 오류:', shipmentPartsError);
        }
        // 3. 날짜별로 그룹핑 (order_date 기준)
        if (shipmentPartsData && shipmentPartsData.length > 0) {
          shipmentPartsData.forEach(part => {
            // 해당 출고건의 order_date 찾기
            const shipment = shipmentsData.find(s => s.id === part.shipment_id);
            if (!shipment) return;
            const date = format(parseISO(shipment.order_date), 'yyyy-MM-dd');
            if (!shipmentPartsByDate[date]) shipmentPartsByDate[date] = [];
            shipmentPartsByDate[date].push({
              shipment_id: part.shipment_id,
              name: part.part_name,
              code: part.part_code,
              part_category: part.part_category,
              quantity: part.quantity,
              price: part.price,
              total: part.total_price,
              brand: shipment.brand,
              customer_name: shipment.customer_name,
              customer_phone: shipment.customer_phone,
              sales_channel: extractSalesChannel(shipment.note, shipment.sales_channel),
              shipment_item_key: `${part.shipment_id}-${part.part_code || part.part_name}`,
            });
          });
        }
      }
      // 4. shipment_parts 데이터가 없는 출고건만 fallback (기존 임의 분배/추정)
      const fallbackShipmentPartsByDate = {};
      shipmentsData.forEach(shipment => {
        const date = format(parseISO(shipment.order_date), 'yyyy-MM-dd');
        // shipmentPartsByDate에 이미 해당 출고건이 있으면 skip
        if (shipmentPartsByDate[date] && shipmentPartsByDate[date].some(p => p.shipment_id === shipment.id)) return;
        // fallback: 기존 임의 분배/추정 로직 (단일 품목만 처리)
        const productNames = (shipment.product_name || '').split(',').map(pn => pn.trim()).filter(pn => pn);
        if (productNames.length === 1) {
          const partInfo = partsPriceMap.get(productNames[0]);
          const unitPriceFromMap = partInfo ? partInfo.price : undefined;
          const actualQuantity = shipment.quantity || 1;
          let displayedUnitPrice = typeof unitPriceFromMap === 'number' ? unitPriceFromMap : (shipment.price || 0) / actualQuantity;
          if (!fallbackShipmentPartsByDate[date]) fallbackShipmentPartsByDate[date] = [];
          fallbackShipmentPartsByDate[date].push({
            shipment_id: shipment.id,
            name: productNames[0],
            code: '',
            quantity: actualQuantity,
            price: displayedUnitPrice,
            total: shipment.price || 0,
            brand: shipment.brand,
            customer_name: shipment.customer_name,
            customer_phone: shipment.customer_phone,
            sales_channel: extractSalesChannel(shipment.note, shipment.sales_channel),
            shipment_item_key: `${shipment.id}-fallback`,
          });
        }
      });
      // 두 객체 병합 (shipmentPartsByDate 우선)
      Object.entries(fallbackShipmentPartsByDate).forEach(([date, parts]) => {
        if (!shipmentPartsByDate[date]) shipmentPartsByDate[date] = [];
        shipmentPartsByDate[date].push(...parts);
      });

      // A/S 부품 데이터 조회
      let servicePartsQuery = supabase
        .from('service_parts')
        .select(`
          price,
          quantity,
          usage,
          services!inner (
            id,
            completion_date,
            brand
          ),
          parts!inner (
            name,
            code,
            note
          )
        `)
        .gte('services.completion_date', startDateTime)
        .lte('services.completion_date', endDateTime);

      // forceRefresh가 1 이상일 때 캐시를 사용하지 않도록 설정
      if (forceRefresh > 0) {
        servicePartsQuery = servicePartsQuery.options({
          cache: 'no-store',
          head: false
        });
      }

      if (queryBrand !== '전체') {
        servicePartsQuery = servicePartsQuery.eq('services.brand', queryBrand);
      }

      const { data: servicePartsData, error: servicePartsError } = await servicePartsQuery;
      console.log('조회된 A/S 부품 데이터:', servicePartsData);
      console.log('A/S 부품 데이터 조회 오류:', servicePartsError);
      if (servicePartsError) throw servicePartsError;

      // 데이터를 저장할 객체 초기화
      const servicePartsByDate = {};
      const tempShipmentPartsByDate = {}; // 임시 객체 사용

      // A/S 부품 데이터 가공
      if (servicePartsData) {
        servicePartsData.forEach(item => {
          if (item.services && item.parts) {
            const date = format(parseISO(item.services.completion_date), 'yyyy-MM-dd');
            if (!servicePartsByDate[date]) {
              servicePartsByDate[date] = [];
            }

            // 디버깅을 위한 로그 추가
            console.log('Processing service part:', {
              service_id: item.services.id,
              name: item.parts.name,
              usage: item.usage,
              quantity: item.quantity,
              price: item.price,
              total: (item.quantity || 0) * (item.price || 0)
            });

            servicePartsByDate[date].push({
              service_id: item.services.id,
              name: item.parts.name,
              code: item.parts.code,
              parts_note: item.parts.note,
              quantity: item.quantity || 0,
              price: item.price || 0,
              total: Math.round((item.quantity || 0) * (item.price || 0)),
              usage: item.usage || 'AS',  // 기본값을 'AS'로 설정
              brand: item.services.brand
            });
          }
        });
      }

      // 출고 데이터 가공 (수정된 로직)
      if (shipmentsData) {
        shipmentsData.forEach(shipment => {
          const date = format(parseISO(shipment.order_date), 'yyyy-MM-dd');
          if (!tempShipmentPartsByDate[date]) {
            tempShipmentPartsByDate[date] = [];
          }
          const salesChannel = extractSalesChannel(shipment.note, shipment.sales_channel);

          // 청담매장 출고 데이터 가공 디버깅
          if (salesChannel === '청담매장' || salesChannel.includes('청담')) {
            debugLog('청담매장 출고 데이터 가공:', {
              shipment_id: shipment.id,
              date: date,
              customer: shipment.customer_name,
              product_name: shipment.product_name,
              price: shipment.price,
              quantity: shipment.quantity,
              sales_channel_field: shipment.sales_channel,
              note: shipment.note,
              extracted_channel: salesChannel
            });
          }

          const productNames = (shipment.product_name || "").split(',').map(pn => pn.trim()).filter(pn => pn);
          const numIndividualProducts = productNames.length > 0 ? productNames.length : 1;

          const originalShipmentTotal = shipment.price || 0;
          const originalShipmentQuantity = shipment.quantity || 0;

          if (productNames.length === 0) { // product_name이 비어있거나 단일 항목이지만 분리 안된 경우 (예: 이전 데이터)
            const productNameTrimmed = (shipment.product_name || '').trim();
            const partInfo = productNameTrimmed ? partsPriceMap.get(productNameTrimmed) : undefined;
            const unitPriceFromMap = partInfo ? partInfo.price : undefined;

            let displayedUnitPrice; // 부품 1개당 단가
            const actualQuantity = originalShipmentQuantity || 1; // 실제 출고된 수량 (단일 품목이므로 세트 수량과 동일)

            if (typeof unitPriceFromMap === 'number') {
              displayedUnitPrice = unitPriceFromMap;
            } else {
              // parts에 단가 정보 없으면, (총액 / 수량)을 추정 단가로 사용
              displayedUnitPrice = actualQuantity > 0 ? originalShipmentTotal / actualQuantity : 0;
            }

            tempShipmentPartsByDate[date].push({
              shipment_id: shipment.id,
              name: shipment.product_name || 'N/A',
              code: '',
              quantity: actualQuantity, // 단일 품목이므로 실제 출고 수량 표시
              price: displayedUnitPrice,
              total: originalShipmentTotal, // 단일 품목이므로 해당 출고 건의 총액
              status: shipment.status,
              note: shipment.note,
              sales_channel: salesChannel,
              customer_name: shipment.customer_name,
              customer_phone: shipment.customer_phone,
              shipment_item_key: `${shipment.id}-0`,
            });
          } else {
            productNames.forEach((individualName, index) => {
              const partInfo = partsPriceMap.get(individualName);
              const unitPriceFromMap = partInfo ? partInfo.price : undefined;
              const actualSetQuantity = originalShipmentQuantity || 1; // 실제 출고된 세트 수량

              let displayedUnitPrice; // '단가' 컬럼에 표시될 값 (부품 1개당 단가)
              // let lineTotal;          // '합계' 컬럼에 표시될 값 (부품단가 * 세트수량 또는 할당금액) <- 이 부분을 수정

              if (typeof unitPriceFromMap === 'number') {
                displayedUnitPrice = unitPriceFromMap; // parts에서 찾은 단가
                // lineTotal = displayedUnitPrice * actualSetQuantity; // 단가 * 세트 수량 <- 이 계산 방식을 변경
              } else {
                // parts에 단가 정보가 없는 경우: 
                // 해당 제품라인에 할당된 금액을 lineTotal로 사용
                const allocatedAmountForThisItem = numIndividualProducts > 0 ? originalShipmentTotal / numIndividualProducts : 0;
                // lineTotal = allocatedAmountForThisItem;
                // 추정 단가는 (할당된 금액 / 세트 수량)으로 계산
                displayedUnitPrice = actualSetQuantity > 0 ? allocatedAmountForThisItem / actualSetQuantity : 0;
              }

              tempShipmentPartsByDate[date].push({
                shipment_id: shipment.id,
                name: individualName,
                code: '', // 부품 코드가 필요하다면 partsPriceMap에서 함께 가져와야 함
                quantity: 1, // 여러 부품으로 구성된 경우, 각 라인의 수량은 1로 표시 (세트 내 1개 의미)
                price: displayedUnitPrice,
                total: displayedUnitPrice, // 여러 부품 세트의 경우, '합계'는 해당 부품 1개의 '단가'와 동일하게 표시
                status: shipment.status,
                note: index === 0 ? shipment.note : '',
                sales_channel: salesChannel,
                customer_name: shipment.customer_name,
                customer_phone: shipment.customer_phone,
                shipment_item_key: `${shipment.id}-${index}`,
              });
            });
          }
        });
      }

      // partsData 상태 업데이트 시 shipmentPartsByDate에 가공된 데이터 할당
      setPartsData({
        servicePartsByDate,
        shipmentPartsByDate // shipment_parts 기준으로 반드시 반영
      });

      // 베스트 상품 Top 5 (출고 기준) 계산 - 브랜드 구분 포함
      try {
        const byBrand = {};
        Object.values(shipmentPartsByDate).forEach(parts => {
          parts.forEach(p => {
            const brandKey = (p.brand || '미지정');
            if (!byBrand[brandKey]) byBrand[brandKey] = {};
            const productKey = (p.name || 'N/A').toString().trim();
            if (!byBrand[brandKey][productKey]) byBrand[brandKey][productKey] = { name: productKey, quantity: 0, total: 0, brand: brandKey };
            byBrand[brandKey][productKey].quantity += Number(p.quantity || 0);
            byBrand[brandKey][productKey].total += Number(p.total || 0);
          });
        });

        // 선택한 브랜드만 보거나 전체일 때는 합산/또는 브랜드별을 따로 준비
        if (queryBrand !== '전체') {
          const map = byBrand[queryBrand] || {};
          const top = Object.values(map)
            .sort((a, b) => topSort === 'qty' ? ((b.quantity - a.quantity) || (b.total - a.total)) : ((b.total - a.total) || (b.quantity - a.quantity)))
            .slice(0, topN);
          setTopProducts(top);
        } else {
          // 전체: 브랜드별 Top 5 목록 배열로 변환
          const brandTopLists = Object.entries(byBrand).map(([brandName, products]) => ({
            brand: brandName,
            list: Object.values(products)
              .sort((a, b) => topSort === 'qty' ? ((b.quantity - a.quantity) || (b.total - a.total)) : ((b.total - a.total) || (b.quantity - a.quantity)))
              .slice(0, topN)
          }));
          setTopProducts(brandTopLists);
        }
      } catch (e) {
        console.error('베스트 상품 집계 오류:', e);
        setTopProducts(queryBrand === '전체' ? [] : []);
      }

      // 베스트 부품 Top 5 (A/S 기준, 공임 제외) 계산 - 브랜드 구분 포함
      try {
        const svcByBrand = {};
        Object.values(servicePartsByDate).forEach(parts => {
          parts.forEach(p => {
            const isLabor = (p.name && p.name.includes('공임')) ||
              (p.usage && p.usage.toString().trim() === '공임') ||
              (p.parts_note && p.parts_note.toString().trim() === '공임');
            if (isLabor) return; // 공임 제외
            const brandKey = (p.brand || '미지정');
            if (!svcByBrand[brandKey]) svcByBrand[brandKey] = {};
            const key = (p.name || 'N/A').toString().trim();
            if (!svcByBrand[brandKey][key]) svcByBrand[brandKey][key] = { name: key, quantity: 0, total: 0, brand: brandKey };
            svcByBrand[brandKey][key].quantity += Number(p.quantity || 0);
            svcByBrand[brandKey][key].total += Number(p.total || 0);
          });
        });

        if (queryBrand !== '전체') {
          const map = svcByBrand[queryBrand] || {};
          const topSvc = Object.values(map)
            .sort((a, b) => topSort === 'qty' ? ((b.quantity - a.quantity) || (b.total - a.total)) : ((b.total - a.total) || (b.quantity - a.quantity)))
            .slice(0, topN);
          setTopServiceParts(topSvc);
        } else {
          const brandTopSvcLists = Object.entries(svcByBrand).map(([brandName, products]) => ({
            brand: brandName,
            list: Object.values(products)
              .sort((a, b) => topSort === 'qty' ? ((b.quantity - a.quantity) || (b.total - a.total)) : ((b.total - a.total) || (b.quantity - a.quantity)))
              .slice(0, topN)
          }));
          setTopServiceParts(brandTopSvcLists);
        }
      } catch (e) {
        console.error('A/S 베스트 부품 집계 오류:', e);
        setTopServiceParts(queryBrand === '전체' ? [] : []);
      }

      // 총 매출 및 통계 계산
      let newTotalServiceSales = 0;
      let newTotalServiceSalesAS = 0;
      let newTotalServiceSalesSell = 0;
      let newTotalShipmentSales = 0;
      let newTotalServiceCount = 0;
      let newTotalShipmentCount = 0;
      let newTotalLaborSalesOnly = 0;
      const newTotalCustomerSales = {};

      const uniqueServiceIds = new Set();

      // A/S 부품 매출 집계
      Object.values(servicePartsByDate).forEach(dailyParts => {
        dailyParts.forEach(part => {
          const isLabor = (part.name && part.name.includes('공임')) ||
            (part.usage && part.usage.toString().trim() === '공임') ||
            (part.parts_note && part.parts_note.toString().trim() === '공임');

          if (isLabor) {
            newTotalLaborSalesOnly += (part.total || 0);
          } else {
            // usage에 따른 구분 (기본값은 'AS')
            if (part.usage === '판매') {
              newTotalServiceSalesSell += (part.total || 0);
            } else {
              newTotalServiceSalesAS += (part.total || 0);
            }
          }
          uniqueServiceIds.add(part.service_id);
        });
      });

      // 디버깅을 위한 로그 추가
      console.log('매출 집계 현황:', {
        공임: newTotalLaborSalesOnly,
        AS부품: newTotalServiceSalesAS,
        판매부품: newTotalServiceSalesSell
      });

      // 출고 매출 집계 (원본 shipmentsData 기준으로 정확한 계산)
      shipmentsData.forEach(shipment => {
        const shipmentPrice = shipment.price || 0;
        newTotalShipmentSales += shipmentPrice;

        // 판매처별 매출 집계 (원본 데이터 기준)
        const salesChannel = extractSalesChannel(shipment.note, shipment.sales_channel);

        // 청담매장 관련 디버깅 로그
        if (salesChannel === '청담매장' || salesChannel.includes('청담')) {
          debugLog('청담매장 총 출고매출 집계 (원본 기준):', {
            shipment_id: shipment.id,
            price: shipmentPrice,
            running_total: newTotalShipmentSales
          });
        }

        if (!newTotalCustomerSales[salesChannel]) {
          newTotalCustomerSales[salesChannel] = {
            name: salesChannel,
            totalAmount: 0,
            shipmentCount: 0,
            processedShipments: new Set(),
            products: {} // 제품별 수량 집계
          };
        }

        // 원본 출고 가격으로 판매처별 매출 집계
        newTotalCustomerSales[salesChannel].totalAmount += shipmentPrice;
        if (!newTotalCustomerSales[salesChannel].processedShipments.has(shipment.id)) {
          newTotalCustomerSales[salesChannel].shipmentCount++;
          newTotalCustomerSales[salesChannel].processedShipments.add(shipment.id);
        }
      });

      // [수정] 제품별 상세 수량 집계 (shipmentPartsByDate 기준 - 정확한 파트별 수량 사용)
      Object.values(shipmentPartsByDate).forEach(dailyParts => {
        dailyParts.forEach(part => {
          // 채널명 추출 (이미 part 객체에 있으면 사용, 없으면 찾기 - shipmentPartsByDate 생성 시점에 추출됨)
          const salesChannel = part.sales_channel || '미지정';

          if (!newTotalCustomerSales[salesChannel]) {
            // 혹시라도 위 루프에서 누락된 채널이 있다면 생성 (보통은 위에서 처리됨)
            newTotalCustomerSales[salesChannel] = {
              name: salesChannel,
              totalAmount: 0,
              shipmentCount: 0,
              processedShipments: new Set(),
              products: {}
            };
          }
          if (!newTotalCustomerSales[salesChannel].products) {
            newTotalCustomerSales[salesChannel].products = {};
          }

          const productName = (part.name || '미지정').trim();

          // 카테고리 정보 저장 (정렬을 위해)
          // DB에서 가져온 part_category가 있으면 사용, 없으면 partsPriceMap에서 조회
          let category = part.part_category;
          if (!category) {
            const partInfo = partsPriceMapRef.current.get(productName);
            category = partInfo ? partInfo.note : '기타';
          }

          if (!newTotalCustomerSales[salesChannel].products[productName]) {
            newTotalCustomerSales[salesChannel].products[productName] = {
              quantity: 0,
              category: category
            };
          }
          newTotalCustomerSales[salesChannel].products[productName].quantity += (part.quantity || 0);
          // 카테고리가 없었다면 업데이트
          if (!newTotalCustomerSales[salesChannel].products[productName].category && category) {
            newTotalCustomerSales[salesChannel].products[productName].category = category;
          }
        });
      });

      // 총 건수 계산
      newTotalServiceCount = uniqueServiceIds.size;
      newTotalShipmentCount = new Set(Object.values(tempShipmentPartsByDate)
        .flatMap(parts => parts.map(p => p.shipment_id))).size;

      // A/S 매출 총계 계산 (공임 + AS부품 + 판매부품)
      const finalTotalServiceSalesWithLabor = newTotalServiceSalesAS + newTotalServiceSalesSell + newTotalLaborSalesOnly;

      // 디버깅을 위한 로그 추가
      console.log('A/S 매출 총계:', finalTotalServiceSalesWithLabor);

      // 날짜별 판매 데이터 생성
      const aggregatedSales = {};
      const currentDate = new Date(formattedStartDate);
      const lastDate = new Date(formattedEndDate);

      while (currentDate <= lastDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        aggregatedSales[dateStr] = {
          date: dateStr,
          serviceSales: 0,
          serviceSalesAS: 0,
          serviceSalesSell: 0,
          serviceCount: 0,
          shipmentSales: 0,
          shipmentCount: 0,
          laborSalesOnly: 0,
          totalSales: 0,
          warrantyNormalValue: 0
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // A/S 부품 매출 집계 (일별)
      Object.entries(servicePartsByDate).forEach(([date, parts]) => {
        if (aggregatedSales[date]) {
          const dailyServiceIds = new Set();
          let dailyServiceSalesAS = 0;
          let dailyServiceSalesSell = 0;
          let dailyLaborSales = 0;
          let warrantyNormalValue = 0;
          parts.forEach(part => {
            const isLabor = (part.name && part.name.includes('공임')) ||
              (part.usage && part.usage.toString().trim() === '공임') ||
              (part.parts_note && part.parts_note.toString().trim() === '공임');
            if (isLabor) {
              dailyLaborSales += (part.total || 0);
            } else {
              // usage 값에 따라 AS와 판매로 구분
              if (part.usage === '판매') {
                dailyServiceSalesSell += (part.total || 0);
              } else {
                dailyServiceSalesAS += (part.total || 0);
              }
            }
            // 워런티 0원 처리 정상가치
            if (part.usage === '워런티' && (part.price === 0 || part.price === '0')) {
              const partInfo = partsPriceMapRef.current.get((part.name || '').trim());
              const normalPrice = partInfo ? partInfo.price : 0;
              warrantyNormalValue += (part.quantity || 0) * normalPrice;
            }
            dailyServiceIds.add(part.service_id);
          });
          // 일별 A/S 매출 업데이트
          aggregatedSales[date].serviceSalesAS = dailyServiceSalesAS;
          aggregatedSales[date].serviceSalesSell = dailyServiceSalesSell;
          aggregatedSales[date].laborSalesOnly = dailyLaborSales;
          aggregatedSales[date].serviceSales = dailyServiceSalesAS + dailyServiceSalesSell + dailyLaborSales;
          aggregatedSales[date].serviceCount = dailyServiceIds.size;
          aggregatedSales[date].warrantyNormalValue = warrantyNormalValue;
        }
      });

      // 일별 출고 매출 및 건수 집계 (원본 shipmentsData 기준)
      const dailyShipmentAggregates = {};
      shipmentsData.forEach(shipment => {
        const dateStr = format(parseISO(shipment.order_date), 'yyyy-MM-dd');
        const salesChannel = extractSalesChannel(shipment.note, shipment.sales_channel);

        if (!dailyShipmentAggregates[dateStr]) {
          dailyShipmentAggregates[dateStr] = {
            sales: 0,
            ids: new Set()
          };
        }

        // shipment.price가 0이거나 undefined인 경우 0을 사용
        const shipmentPrice = shipment.price || 0;

        // 청담매장 관련 디버깅 로그
        if (salesChannel === '청담매장' || salesChannel.includes('청담')) {
          debugLog('청담매장 출고 데이터:', {
            id: shipment.id,
            date: dateStr,
            customer: shipment.customer_name,
            product: shipment.product_name,
            price: shipmentPrice,
            quantity: shipment.quantity,
            sales_channel: shipment.sales_channel,
            note: shipment.note,
            extracted_channel: salesChannel
          });
        }

        dailyShipmentAggregates[dateStr].sales += shipmentPrice;
        dailyShipmentAggregates[dateStr].ids.add(shipment.id);
      });

      // 출고 매출 집계
      Object.entries(dailyShipmentAggregates).forEach(([date, data]) => {
        if (aggregatedSales[date]) {
          aggregatedSales[date].shipmentSales = data.sales;
          aggregatedSales[date].shipmentCount = data.ids.size;
        }
      });

      // 모든 날짜에 대해 총 매출 계산 (A/S + 출고)
      Object.keys(aggregatedSales).forEach(date => {
        aggregatedSales[date].totalSales =
          (aggregatedSales[date].serviceSales || 0) +
          (aggregatedSales[date].shipmentSales || 0);
      });

      const sortedSalesData = Object.values(aggregatedSales).sort((a, b) => new Date(a.date) - new Date(b.date));
      setSalesData(sortedSalesData);

      // 월별, 주별, 연도별, 유형별 통계 생성
      generateMonthlyStats(sortedSalesData);
      generateWeeklyStats(sortedSalesData);
      generateYearlyStats(sortedSalesData);
      generateTypeStats(sortedSalesData);

      // 일별 데이터를 기준으로 매출 요약 재계산 (정확한 동일성 보장)
      const dailyTotalServiceSales = sortedSalesData.reduce((sum, row) => sum + (row.serviceSales || 0), 0);
      const dailyTotalServiceSalesAS = sortedSalesData.reduce((sum, row) => sum + (row.serviceSalesAS || 0), 0);
      const dailyTotalServiceSalesSell = sortedSalesData.reduce((sum, row) => sum + (row.serviceSalesSell || 0), 0);
      const dailyTotalLaborSalesOnly = sortedSalesData.reduce((sum, row) => sum + (row.laborSalesOnly || 0), 0);
      const dailyTotalShipmentSales = sortedSalesData.reduce((sum, row) => sum + (row.shipmentSales || 0), 0);
      const calculatedTotalFromDaily = sortedSalesData.reduce((sum, row) => {
        const rowTotal = (row.serviceSales || 0) + (row.shipmentSales || 0);
        return sum + rowTotal;
      }, 0);

      // 매출 요약을 일별 집계 데이터 기준으로 업데이트
      setTotalStats({
        totalServiceSales: dailyTotalServiceSales,  // 일별 A/S 매출 총계
        totalShipmentSales: dailyTotalShipmentSales, // 일별 출고 매출 총계
        totalSales: calculatedTotalFromDaily,        // 일별 전체 매출 총계
        totalServiceSalesAS: dailyTotalServiceSalesAS,        // 일별 AS 부품 매출
        totalServiceSalesSell: dailyTotalServiceSalesSell,    // 일별 판매 부품 매출
        totalServiceCount: newTotalServiceCount,            // A/S 건수
        totalShipmentCount: newTotalShipmentCount,
        totalCustomerSales: newTotalCustomerSales,
      });
      
      // 디버깅을 위한 상세 로그
      debugLog('매출 데이터 집계 완료 (A/S 포함):', sortedSalesData);

      // 상세 매출 분석
      debugLog('=== 매출 분석 (일별 집계 기준) ===');
      debugLog('A/S 매출 (전체):', dailyTotalServiceSales);
      debugLog('  - AS 부품:', dailyTotalServiceSalesAS);
      debugLog('  - 판매 부품:', dailyTotalServiceSalesSell);
      debugLog('  - 공임:', dailyTotalLaborSalesOnly);
      debugLog('출고 매출 (전체):', dailyTotalShipmentSales);
      debugLog('매출 요약 총계:', calculatedTotalFromDaily);
      debugLog('검색결과 총계:', calculatedTotalFromDaily);
      debugLog('차이:', Math.abs(calculatedTotalFromDaily - calculatedTotalFromDaily));

      // 청담매장 관련 최종 결과 로그
      const chungdamData = newTotalCustomerSales['청담매장'];
      if (chungdamData) {
        debugLog('청담매장 최종 집계 결과:', {
          총매출: chungdamData.totalAmount,
          출고건수: chungdamData.shipmentCount,
          처리된출고ID: Array.from(chungdamData.processedShipments)
        });
      } else {
        debugLog('청담매장 데이터가 집계되지 않았습니다.');
      }

      debugLog('매출 데이터 조회 완료');

    } catch (error) {
      console.error('데이터 조회 중 오류:', error);
      setSnackbar({
        open: true,
        message: '데이터 조회 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setLoading(false);

      // 강제 새로고침 또는 일반 검색 완료 메시지
      setSnackbar({
        open: true,
        message: forceRefresh > 0 ? '매출 데이터가 성공적으로, 재계산되었습니다.' : '매출 데이터 조회가 완료되었습니다.',
        severity: 'success'
      });

      // 3초 후 알림 닫기
      setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 3000);
    }
  };

  // 범위 합계 조회(간단 총액) - 전월/전년 또는 전주/전년동주 비교용
  const fetchTotalsForRange = async ({ start, end, brand: brandFilter }) => {
    const startDateTime = format(start, 'yyyy-MM-dd') + ' 00:00:00';
    const endDateTime = format(end, 'yyyy-MM-dd') + ' 23:59:59';
    // Shipments 총액
    let shipmentQuery = supabase
      .from('shipments')
      .select('price, brand, order_date')
      .gte('order_date', startDateTime)
      .lte('order_date', endDateTime);
    if (brandFilter && brandFilter !== '전체') {
      shipmentQuery = shipmentQuery.eq('brand', brandFilter);
    }
    const { data: shipmentRows, error: shipmentErr } = await shipmentQuery;
    if (shipmentErr) throw shipmentErr;
    const shipmentTotal = (shipmentRows || []).reduce((sum, r) => sum + (r.price || 0), 0);

    // Service Parts 총액 (공임 포함)
    let spQuery = supabase
      .from('service_parts')
      .select(`
        price,
        quantity,
        usage,
        services!inner ( completion_date, brand ),
        parts!inner ( name, note )
      `)
      .gte('services.completion_date', startDateTime)
      .lte('services.completion_date', endDateTime);
    if (brandFilter && brandFilter !== '전체') {
      spQuery = spQuery.eq('services.brand', brandFilter);
    }
    const { data: spRows, error: spErr } = await spQuery;
    if (spErr) throw spErr;
    const serviceTotal = (spRows || []).reduce((sum, item) => {
      const isLabor = (item.parts?.name && item.parts.name.includes('공임')) ||
        (item.usage && item.usage.toString().trim() === '공임') ||
        (item.parts?.note && item.parts.note.toString().trim() === '공임');
      const total = Math.round((item.quantity || 0) * (item.price || 0));
      return sum + total + 0; // 공임도 이미 price*qty로 합산됨
    }, 0);

    return { shipmentTotal, serviceTotal, total: shipmentTotal + serviceTotal };
  };

  const percentChange = (current, previous) => {
    if (previous === 0 || previous === null || previous === undefined) return null;
    return ((current - previous) / previous) * 100;
  };

  // 현재 조회 기간이 주/월이면 비교 수치 계산
  useEffect(() => {
    const compute = async () => {
      try {
        if (!currentPeriod) return;
        const curStart = currentPeriod.startDate;
        const curEnd = currentPeriod.endDate;
        const curBrand = currentPeriod.brand;

        const days = Math.floor((curEnd - curStart) / (24 * 60 * 60 * 1000)) + 1;
        const isFullMonth = format(curStart, 'yyyy-MM-dd') === format(startOfMonth(curStart), 'yyyy-MM-dd') &&
          format(curEnd, 'yyyy-MM-dd') === format(endOfMonth(curStart), 'yyyy-MM-dd');
        const isApproxWeek = days >= 7 && days <= 8; // 7일 범위

        const currentTotal = totalStats.totalSales || 0;

        if (isFullMonth) {
          // 전월 / 전년 동월
          const prevMonthStart = startOfMonth(setMonth(curStart, getMonth(curStart) - 1));
          const prevMonthEnd = endOfMonth(prevMonthStart);
          const lastYearMonthStart = startOfMonth(new Date(curStart.getFullYear() - 1, getMonth(curStart), 1));
          const lastYearMonthEnd = endOfMonth(lastYearMonthStart);

          const [prev, yoyBase] = await Promise.all([
            fetchTotalsForRange({ start: prevMonthStart, end: prevMonthEnd, brand: curBrand }),
            fetchTotalsForRange({ start: lastYearMonthStart, end: lastYearMonthEnd, brand: curBrand })
          ]);
          setCompareStats({
            context: 'month',
            mom: percentChange(currentTotal, prev.total),
            yoy: percentChange(currentTotal, yoyBase.total),
            wow: null,
            yoyWeek: null
          });
        } else if (isApproxWeek) {
          // 전주 / 전년 동주
          const prevWeekStart = startOfWeek(new Date(curStart.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
          const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
          const lastYearWeekStart = startOfWeek(new Date(curStart.getFullYear() - 1, curStart.getMonth(), curStart.getDate()), { weekStartsOn: 1 });
          const lastYearWeekEnd = endOfWeek(lastYearWeekStart, { weekStartsOn: 1 });

          const [prev, yoyBase] = await Promise.all([
            fetchTotalsForRange({ start: prevWeekStart, end: prevWeekEnd, brand: curBrand }),
            fetchTotalsForRange({ start: lastYearWeekStart, end: lastYearWeekEnd, brand: curBrand })
          ]);
          setCompareStats({
            context: 'week',
            mom: null,
            yoy: null,
            wow: percentChange(currentTotal, prev.total),
            yoyWeek: percentChange(currentTotal, yoyBase.total)
          });
        } else {
          setCompareStats({ context: null, mom: null, yoy: null, wow: null, yoyWeek: null });
        }
      } catch (e) {
        console.error('비교 지표 계산 오류:', e);
        setCompareStats({ context: null, mom: null, yoy: null, wow: null, yoyWeek: null });
      }
    };
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesData, currentPeriod, totalStats.totalSales]);

  // 월별 통계 생성 함수
  const generateMonthlyStats = (salesData) => {
    const monthlyMap = {};

    salesData.forEach(day => {
      const monthKey = format(parseISO(day.date), 'yyyy-MM');
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          period: format(parseISO(day.date), 'yyyy년 MM월'),
          serviceSales: 0,
          serviceSalesAS: 0,
          serviceSalesSell: 0,
          laborSalesOnly: 0,
          shipmentSales: 0,
          serviceCount: 0,
          shipmentCount: 0,
          totalSales: 0
        };
      }

      monthlyMap[monthKey].serviceSales += day.serviceSales || 0;
      monthlyMap[monthKey].serviceSalesAS += day.serviceSalesAS || 0;
      monthlyMap[monthKey].serviceSalesSell += day.serviceSalesSell || 0;
      monthlyMap[monthKey].laborSalesOnly += day.laborSalesOnly || 0;
      monthlyMap[monthKey].shipmentSales += day.shipmentSales || 0;
      monthlyMap[monthKey].serviceCount += day.serviceCount || 0;
      monthlyMap[monthKey].shipmentCount += day.shipmentCount || 0;
      monthlyMap[monthKey].totalSales += day.totalSales || 0;
    });

    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.period.localeCompare(b.period));
    setMonthlyStats(monthlyData);
  };

  // 주별 통계 생성 함수
  const generateWeeklyStats = (salesData) => {
    const weeklyMap = {};

    salesData.forEach(day => {
      const date = parseISO(day.date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // 월요일 시작
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          period: `${format(weekStart, 'MM.dd')} ~ ${format(weekEnd, 'MM.dd')}`,
          serviceSales: 0,
          serviceSalesAS: 0,
          serviceSalesSell: 0,
          laborSalesOnly: 0,
          shipmentSales: 0,
          serviceCount: 0,
          shipmentCount: 0,
          totalSales: 0,
          weekStart: weekStart,
          weekEnd: weekEnd
        };
      }

      weeklyMap[weekKey].serviceSales += day.serviceSales || 0;
      weeklyMap[weekKey].serviceSalesAS += day.serviceSalesAS || 0;
      weeklyMap[weekKey].serviceSalesSell += day.serviceSalesSell || 0;
      weeklyMap[weekKey].laborSalesOnly += day.laborSalesOnly || 0;
      weeklyMap[weekKey].shipmentSales += day.shipmentSales || 0;
      weeklyMap[weekKey].serviceCount += day.serviceCount || 0;
      weeklyMap[weekKey].shipmentCount += day.shipmentCount || 0;
      weeklyMap[weekKey].totalSales += day.totalSales || 0;
    });

    const weeklyData = Object.values(weeklyMap).sort((a, b) => a.weekStart - b.weekStart);
    // 주차 라벨(예: 5월 1주차)과 전주 대비 증감률 계산
    weeklyData.forEach((item, idx) => {
      const monthLabel = format(item.weekStart, 'M');
      const weekOfMonth = getWeekOfMonth(item.weekStart, { weekStartsOn: 1 });
      item.weekLabel = `${monthLabel}월 ${weekOfMonth}주차`;
      if (idx > 0) {
        const prev = weeklyData[idx - 1];
        item.wowPct = percentChange(item.totalSales || 0, prev.totalSales || 0);
      } else {
        item.wowPct = null;
      }
    });
    setWeeklyStats(weeklyData);
  };

  // 매출 유형별 통계 생성 함수
  const generateTypeStats = (salesData) => {
    const typeData = [
      {
        type: 'A/S 부품 (AS)',
        amount: salesData.reduce((sum, day) => sum + (day.serviceSalesAS || 0), 0),
        count: salesData.reduce((sum, day) => sum + (day.serviceCount || 0), 0),
        color: '#1976d2'
      },
      {
        type: 'A/S 부품 (판매)',
        amount: salesData.reduce((sum, day) => sum + (day.serviceSalesSell || 0), 0),
        count: salesData.reduce((sum, day) => sum + (day.serviceCount || 0), 0),
        color: '#9c27b0'
      },
      {
        type: 'A/S 공임',
        amount: salesData.reduce((sum, day) => sum + (day.laborSalesOnly || 0), 0),
        count: salesData.reduce((sum, day) => sum + (day.serviceCount || 0), 0),
        color: '#2e7d32'
      },
      {
        type: '출고 매출',
        amount: salesData.reduce((sum, day) => sum + (day.shipmentSales || 0), 0),
        count: salesData.reduce((sum, day) => sum + (day.shipmentCount || 0), 0),
        color: '#f57c00'
      }
    ].filter(item => item.amount > 0); // 0원인 항목은 제외

    setTypeStats(typeData);
  };

  // 연도별 통계 생성 함수
  const generateYearlyStats = (salesData) => {
    const yearlyMap = {};

    salesData.forEach(day => {
      const yearKey = format(parseISO(day.date), 'yyyy');
      if (!yearlyMap[yearKey]) {
        yearlyMap[yearKey] = {
          period: `${yearKey}년`,
          serviceSales: 0,
          serviceSalesAS: 0,
          serviceSalesSell: 0,
          laborSalesOnly: 0,
          shipmentSales: 0,
          serviceCount: 0,
          shipmentCount: 0,
          totalSales: 0
        };
      }

      yearlyMap[yearKey].serviceSales += day.serviceSales || 0;
      yearlyMap[yearKey].serviceSalesAS += day.serviceSalesAS || 0;
      yearlyMap[yearKey].serviceSalesSell += day.serviceSalesSell || 0;
      yearlyMap[yearKey].laborSalesOnly += day.laborSalesOnly || 0;
      yearlyMap[yearKey].shipmentSales += day.shipmentSales || 0;
      yearlyMap[yearKey].serviceCount += day.serviceCount || 0;
      yearlyMap[yearKey].shipmentCount += day.shipmentCount || 0;
      yearlyMap[yearKey].totalSales += day.totalSales || 0;
    });

    const yearlyData = Object.values(yearlyMap).sort((a, b) => a.period.localeCompare(b.period));
    setYearlyStats(yearlyData);
  };

  // 차트용 데이터 가져오기 함수
  const getChartData = () => {
    switch (chartPeriod) {
      case 'weekly':
        return weeklyStats.map(item => ({
          ...item,
          date: item.period
        }));
      case 'monthly':
        return monthlyStats.map(item => ({
          ...item,
          date: item.period
        }));
      case 'yearly':
        return yearlyStats.map(item => ({
          ...item,
          date: item.period
        }));
      default:
        return salesData;
    }
  };

  useEffect(() => {
    // 처음 로드될 때만 데이터 조회 및 현재 선택된 달로 초기화
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    setSelectedMonth(currentMonthIndex);

    const currentMonthDate = new Date(now.getFullYear(), currentMonthIndex, 1);
    const monthStartDate = startOfMonth(currentMonthDate);
    const monthEndDate = endOfMonth(currentMonthDate);

    setStartDate(monthStartDate);
    setEndDate(monthEndDate);

    // 초기 currentPeriod 설정
    const initialPeriod = {
      startDate: monthStartDate,
      endDate: monthEndDate,
      brand: '전체'
    };
    setCurrentPeriod(initialPeriod);

    // 데이터 초기 로드
    fetchSalesData(initialPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 의존성 배열을 비워서 컴포넌트 마운트 시 한 번만 실행

  // forceRefresh가 변경될 때만 재계산 수행
  useEffect(() => {
    if (forceRefresh > 0) {
      // 강제 새로고침일 때만 별도 처리 (캐시 무시 설정은 이미 fetchSalesData 내부에 있음)
      console.log('강제 새로고침 실행 (캐시 무시)');
      handleSearch(null, null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceRefresh]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const formatCurrency = (amount) => {
    // amount가 유효한 숫자인지 확인하고, 아니면 0으로 처리
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      return '0원';
    }

    // 정수인 경우 소수점 없이 표시, 소수가 있는 경우 2자리까지 표시
    if (numAmount % 1 === 0) {
      return numAmount.toLocaleString('ko-KR') + '원';
    } else {
      return numAmount.toLocaleString('ko-KR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }) + '원';
    }
  };

  const formatPercent = (val) => {
    if (val === null || val === undefined) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  const renderPartsDetail = () => {
    // A/S 부품 데이터
    const serviceDataToRender = partsData.servicePartsByDate;
    const serviceGroupedByDate = Object.entries(serviceDataToRender)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
      .reduce((acc, [date, parts]) => {
        acc[date] = parts;
        return acc;
      }, {});

    // 출고 부품 데이터
    const shipmentDataToRender = partsData.shipmentPartsByDate;
    const shipmentGroupedByDate = Object.entries(shipmentDataToRender)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
      .reduce((acc, [date, parts]) => {
        acc[date] = parts;
        return acc;
      }, {});

    return (
      <Box sx={{ mt: 2, maxHeight: '800px', overflowY: 'auto' }}>
        <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'primary.main', borderBottom: '2px solid', borderColor: 'primary.main', pb: 0.5 }}>
          <BuildIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          A/S 부품 상세 내역
        </Typography>
        {Object.keys(serviceGroupedByDate).length === 0 ? (
          <Typography sx={{ my: 2, color: 'text.secondary' }}>해당 기간에 A/S된 부품 내역이 없습니다.</Typography>
        ) : (
          Object.entries(serviceGroupedByDate).map(([date, parts]) => {
            // 워런티 0원 처리 정상가치 계산
            let warrantyNormalValue = 0;
            parts.forEach(p => {
              if (p.usage === '워런티' && (p.price === 0 || p.price === '0')) {
                const normalPrice = partsPriceMapRef.current.get((p.name || '').trim()) || 0;
                warrantyNormalValue += (p.quantity || 0) * normalPrice;
              }
            });
            return (
              <Box key={`service-${date}`} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {format(parseISO(date), 'MM월 dd일 (EEE)', { locale: ko })} - A/S
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>A/S ID</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>제품/부품명</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>부품코드</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>수량</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>단가</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>합계</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>구분</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>세부 구분(Parts Note)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parts.map((part, index) => {
                        // Log the first A/S part for debugging
                        if (index === 0 && date === Object.keys(serviceGroupedByDate)[0]) { // 첫 번째 날짜의 첫 번째 항목만 로그
                          console.log('[DEBUG] Rendering First A/S Part of First Date:', part);
                          console.log('[DEBUG] service_id:', part.service_id, 'type:', typeof part.service_id);
                          console.log('[DEBUG] Part object keys:', Object.keys(part));
                        }
                        return (
                          <TableRow key={`servicepart-${part.service_id}-${part.code}-${index}`}> {/* 키를 더 고유하게 만듭니다. */}
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                {part.service_id ? String(part.service_id).slice(-8) : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>{part.name}</TableCell> {/* Tooltip과 스타일 없이 직접 표시 */}
                            <TableCell>{part.code}</TableCell>
                            <TableCell align="right">{part.quantity}</TableCell>
                            <TableCell align="right">{formatCurrency(part.price)}</TableCell>
                            <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                            <TableCell>
                              <Chip
                                label={part.usage || '기타'}
                                size="small"
                                {...getUsageChipProps(part.usage)}
                                sx={{ height: 20, fontSize: '0.75rem', ...getUsageChipProps(part.usage).sx }}
                              />
                            </TableCell>
                            <TableCell>{part.parts_note || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                      {/* 구분별(usage) 합계 */}
                      {(() => {
                        const usageMap = {};
                        let warrantyNormalValue = 0;
                        parts.forEach(p => {
                          const key = p.usage || '기타';
                          if (!usageMap[key]) usageMap[key] = { quantity: 0, total: 0 };
                          usageMap[key].quantity += p.quantity || 0;
                          usageMap[key].total += p.total || 0;
                          // 워런티 정상가치 누적
                          if (p.usage === '워런티' && (p.price === 0 || p.price === '0')) {
                            const normalPrice = partsPriceMapRef.current.get((p.name || '').trim()) || 0;
                            warrantyNormalValue += (p.quantity || 0) * normalPrice;
                          }
                        });
                        return Object.entries(usageMap).map(([usage, sum], idx) => {
                          // 워런티 합계만 금액 포맷 변경
                          let displayTotal = formatCurrency(sum.total);
                          if (usage === '워런티') {
                            displayTotal = `0원${warrantyNormalValue > 0 ? ` (판매가: ${formatCurrency(warrantyNormalValue)})` : ''}`;
                          }
                          return (
                            <TableRow key={`usage-sum-${usage}-${idx}`} sx={{ backgroundColor: '#f7f7f7' }}>
                              <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                <Chip label={usage} size="small" sx={{ mr: 1, height: 20, fontSize: '0.75rem', ...getUsageChipProps(usage).sx }} />
                                합계
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{sum.quantity}</TableCell>
                              <TableCell></TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>{displayTotal}</TableCell>
                              <TableCell colSpan={2}></TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {/* 세부 구분별(parts_note) 합계 */}
                      {(() => {
                        const noteMap = {};
                        parts.forEach(p => {
                          const key = p.parts_note || '기타';
                          if (!noteMap[key]) noteMap[key] = { quantity: 0, total: 0 };
                          noteMap[key].quantity += p.quantity || 0;
                          noteMap[key].total += p.total || 0;
                        });
                        return Object.entries(noteMap).map(([note, sum], idx) => (
                          <TableRow key={`note-sum-${note}-${idx}`} sx={{ backgroundColor: '#f0f4ff' }}>
                            <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>{note} 합계</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{sum.quantity}</TableCell>
                            <TableCell></TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(sum.total)}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            );
          })
        )}

        <Divider sx={{ my: 4, borderStyle: 'dashed' }} />

        <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'secondary.main', borderBottom: '2px solid', borderColor: 'secondary.main', pb: 0.5 }}>
          <InventoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          출고 상세 내역
        </Typography>
        {Object.keys(shipmentGroupedByDate).length === 0 ? (
          <Typography sx={{ my: 2, color: 'text.secondary' }}>해당 기간에 출고된 내역이 없습니다.</Typography>
        ) : (
          Object.entries(shipmentGroupedByDate).map(([date, parts]) => (
            <Box key={`shipment-${date}`} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                {format(parseISO(date), 'MM월 dd일 (EEE)', { locale: ko })} - 출고
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>출고 ID</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>제품/부품명</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>카테고리</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>수량</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>단가</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>합계</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>고객명</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>연락처</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>판매채널</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parts.map((part, idx) => (
                      <TableRow key={part.shipment_item_key || idx}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {part.shipment_id ? String(part.shipment_id).slice(-8) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{part.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={part.part_category || '기타'}
                            size="small"
                            {...getCategoryChipProps(part.part_category)}
                            sx={{ height: 20, fontSize: '0.75rem', ...getCategoryChipProps(part.part_category).sx }}
                          />
                        </TableCell>
                        <TableCell align="right">{part.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(part.price)}</TableCell>
                        <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                        <TableCell>{part.customer_name || '-'}</TableCell>
                        <TableCell>{part.customer_phone || '-'}</TableCell>
                        <TableCell>{part.sales_channel || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {/* 구분별(카테고리) 합계 */}
                    {(() => {
                      const catMap = {};
                      parts.forEach(p => {
                        const key = p.part_category || '기타';
                        if (!catMap[key]) catMap[key] = { quantity: 0, total: 0 };
                        catMap[key].quantity += p.quantity || 0;
                        catMap[key].total += p.total || 0;
                      });
                      return Object.entries(catMap).map(([cat, sum], idx) => (
                        <TableRow key={`cat-sum-${cat}-${idx}`} sx={{ backgroundColor: '#e3f2fd' }}>
                          <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            <Chip label={cat} size="small" sx={{ mr: 1, height: 20, fontSize: '0.75rem', ...getCategoryChipProps(cat).sx }} />
                            합계
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{sum.quantity}</TableCell>
                          <TableCell></TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(sum.total)}</TableCell>
                          <TableCell colSpan={4}></TableCell>
                        </TableRow>
                      ));
                    })()}
                    {/* 판매채널별 + 카테고리별 합계 */}
                    {(() => {
                      const channelCategoryMap = {};
                      parts.forEach(p => {
                        const channelKey = p.sales_channel || '미지정';
                        const categoryKey = p.part_category || '기타';
                        const combinedKey = `${channelKey}-${categoryKey}`;

                        if (!channelCategoryMap[combinedKey]) {
                          channelCategoryMap[combinedKey] = {
                            channel: channelKey,
                            category: categoryKey,
                            quantity: 0,
                            total: 0
                          };
                        }
                        channelCategoryMap[combinedKey].quantity += p.quantity || 0;
                        channelCategoryMap[combinedKey].total += p.total || 0;
                      });

                      // 판매채널별로 그룹화하여 표시
                      const channelGroups = {};
                      Object.values(channelCategoryMap).forEach(item => {
                        if (!channelGroups[item.channel]) {
                          channelGroups[item.channel] = [];
                        }
                        channelGroups[item.channel].push(item);
                      });

                      return Object.entries(channelGroups).map(([channel, categories]) => (
                        <React.Fragment key={`channel-group-${channel}`}>
                          {/* 판매채널별 카테고리 상세 */}
                          {categories.map((cat, catIdx) => (
                            <TableRow key={`channel-cat-${channel}-${cat.category}-${catIdx}`} sx={{ backgroundColor: '#f8f9ff' }}>
                              <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold', color: '#1565c0', fontSize: '0.9rem', verticalAlign: 'middle' }}>
                                {channel}{' '}
                                <Chip label={cat.category} size="small" sx={{ height: 20, fontSize: '0.75rem', ml: 0.5, ...getCategoryChipProps(cat.category).sx }} />
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#424242', fontSize: '0.9rem' }}>{cat.quantity}</TableCell>
                              <TableCell></TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#424242', fontSize: '0.9rem' }}>{formatCurrency(cat.total)}</TableCell>
                              <TableCell colSpan={4}></TableCell>
                            </TableRow>
                          ))}
                          {/* 판매채널 총합계 */}
                          <TableRow key={`channel-total-${channel}`} sx={{ backgroundColor: '#e8f5e9' }}>
                            <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '0.95rem' }}>
                              {channel} 총합계
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#424242' }}>
                              {categories.reduce((sum, cat) => sum + cat.quantity, 0)}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: '#424242' }}>
                              {formatCurrency(categories.reduce((sum, cat) => sum + cat.total, 0))}
                            </TableCell>
                            <TableCell colSpan={4}></TableCell>
                          </TableRow>
                        </React.Fragment>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))
        )}
      </Box>
    );
  };

  // 매출 강제 재계산 함수
  const handleForceRecalculate = () => {
    if (window.confirm('과거 데이터를 포함한 모든 매출 데이터를 새로 계산합니다. 계속하시겠습니까?')) {
      // 로컬 캐시를 무시하고 서버에서 데이터를 새로 가져오도록 강제합니다
      setLoading(true);
      // forceRefresh 카운터를 증가시켜 useEffect 트리거
      setForceRefresh(prev => prev + 1);

      // 사용자에게 알림 표시
      setSnackbar({
        open: true,
        message: '매출 데이터를 다시 계산 중입니다. 잠시만 기다려주세요.',
        severity: 'info'
      });

      // 새로운 handleSearch 함수 호출하여 데이터 조회
      setTimeout(() => {
        handleSearch(null, null, null);
      }, 100);
    }
  };

  // 조회 버튼 클릭 핸들러 추가
  const handleSearch = (customStartDate, customEndDate, customBrand) => {
    // 매개변수로 받은 값 또는 현재 상태 값 사용
    const finalStartDate = customStartDate || startDate;
    const finalEndDate = customEndDate || endDate;
    const finalBrand = customBrand || brand;

    // 로딩 상태 시작
    setLoading(true);
    // 스낵바로 사용자에게 알림
    setSnackbar({
      open: true,
      message: '데이터를 조회하는 중입니다...',
      severity: 'info'
    });

    // 현재 조회 중인 기간 정보 업데이트
    const periodInfo = {
      startDate: finalStartDate,
      endDate: finalEndDate,
      brand: finalBrand
    };
    setCurrentPeriod(periodInfo);

    // 데이터 조회 실행 (인자로 전달하여 정확한 값 사용)
    fetchSalesData(periodInfo);
  };

  // 검색 필터를 텍스트로 표시
  const getSearchFilterText = () => {
    if (!currentPeriod) return '';

    let text = `${format(currentPeriod.startDate, 'yyyy년 MM월 dd일')} ~ ${format(currentPeriod.endDate, 'yyyy년 MM월 dd일')}`;
    if (currentPeriod.brand !== '전체') {
      text += ` (브랜드: ${currentPeriod.brand})`;
    }
    return text;
  };

  // 판매처 클릭 핸들러
  const handleChannelClick = (channelData) => {
    setSelectedChannelStats(channelData);
    setChannelModalOpen(true);
  };

  const handleChannelClose = () => {
    setChannelModalOpen(false);
    setSelectedChannelStats(null);
  };

  // 매출 요약 엑셀 다운로드 함수
  const handleDownloadSummaryExcel = () => {
    if (!salesData || salesData.length === 0) return;
    const exportData = salesData.map(row => ({
      '날짜': row.date,
      'A/S 매출(공임포함)': row.serviceSales,
      'A/S매출(AS-부품)': row.serviceSalesAS,
      'A/S매출(판매-부품)': row.serviceSalesSell,
      'A/S 공임만': row.laborSalesOnly,
      'A/S 검수 건수': row.serviceCount,
      '출고 매출': row.shipmentSales,
      '출고 건수': row.shipmentCount,
      '총계': row.totalSales,
      '워런티 정상가치': row.warrantyNormalValue > 0 ? (
        <span style={{ color: '#d32f2f', fontWeight: 600 }}>
          ({formatCurrency(row.warrantyNormalValue)})
        </span>
      ) : (
        formatCurrency(0)
      ),
    }));
    const headers = [
      { label: '날짜', key: '날짜' },
      { label: 'A/S 매출(공임포함)', key: 'A/S 매출(공임포함)' },
      { label: 'A/S매출(AS-부품)', key: 'A/S매출(AS-부품)' },
      { label: 'A/S매출(판매-부품)', key: 'A/S매출(판매-부품)' },
      { label: 'A/S 공임만', key: 'A/S 공임만' },
      { label: 'A/S 검수 건수', key: 'A/S 검수 건수' },
      { label: '출고 매출', key: '출고 매출' },
      { label: '출고 건수', key: '출고 건수' },
      { label: '총계', key: '총계' },
      { label: '워런티 정상가치', key: '워런티 정상가치' }
    ];
    const today = format(new Date(), 'yyyy-MM-dd');
    downloadExcel(exportData, headers, `매출요약_${today}`);
  };

  // 부품 상세 엑셀 다운로드 함수
  const handleDownloadPartsExcel = () => {
    if (!partsData || Object.keys(partsData).length === 0) return;

    // A/S 부품 데이터
    const serviceExportData = Object.entries(partsData.servicePartsByDate || {})
      .flatMap(([date, parts]) => parts.map(part => ({
        '날짜': date,
        '유형': 'A/S',
        '부품명': part.name,
        '부품코드': part.code || '',
        '구분': part.usage,
        '수량': part.quantity,
        '단가': part.price,
        '합계': part.total,
        '세부구분': part.parts_note || '',
        '고객명': '',
        '연락처': '',
        '판매채널': ''
      })));

    // 출고 부품 데이터
    const shipmentExportData = Object.entries(partsData.shipmentPartsByDate || {})
      .flatMap(([date, parts]) => parts.map(part => ({
        '날짜': date,
        '유형': '출고',
        '부품명': part.name,
        '부품코드': part.code || '',
        '구분': part.part_category || '기타',
        '수량': part.quantity,
        '단가': part.price,
        '합계': part.total,
        '세부구분': '',
        '고객명': part.customer_name || '',
        '연락처': part.customer_phone || '',
        '판매채널': part.sales_channel || ''
      })));

    // 두 데이터 합치기
    const exportData = [...serviceExportData, ...shipmentExportData]
      .sort((a, b) => new Date(b.날짜) - new Date(a.날짜)); // 날짜 내림차순 정렬

    const headers = [
      { label: '날짜', key: '날짜' },
      { label: '유형', key: '유형' },
      { label: '부품명', key: '부품명' },
      { label: '부품코드', key: '부품코드' },
      { label: '구분', key: '구분' },
      { label: '수량', key: '수량' },
      { label: '단가', key: '단가' },
      { label: '합계', key: '합계' },
      { label: '세부구분', key: '세부구분' },
      { label: '고객명', key: '고객명' },
      { label: '연락처', key: '연락처' },
      { label: '판매채널', key: '판매채널' }
    ];

    const today = format(new Date(), 'yyyy-MM-dd');
    downloadExcel(exportData, headers, `부품상세_${today}`);
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        mt: 10,
        height: '50vh'
      }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 3 }}>
          매출 데이터를 불러오는 중입니다...
        </Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          매출 통계
        </Typography>

        {/* 안내 문구 추가 */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#fffde7', borderLeft: '4px solid #ffc107' }}>
          <Typography variant="body2" sx={{ color: '#b28704', fontWeight: 500 }}>
            ※ A/S는 <b>완료일 기준</b>, 출고는 <b>주문일 기준</b>으로 집계됩니다.
          </Typography>
        </Paper>

        {/* 스낵바 추가 */}
        {snackbar.open && (
          <Box
            sx={{
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 9999,
              padding: 2,
              borderRadius: 1,
              boxShadow: 3,
              bgcolor: snackbar.severity === 'error' ? '#f44336' : snackbar.severity === 'success' ? '#4caf50' : '#2196f3',
              color: 'white',
            }}
          >
            {snackbar.message}
          </Box>
        )}

        {/* 기간 + 브랜드 선택 */}
        <Paper sx={{ p: 3, mb: 3, borderLeft: '4px solid #3182f6' }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#3182f6' }}>
            검색 필터
          </Typography>

          {/* 연도 선택 */}
          <Box sx={{ mb: 2 }}>
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
                      '&:hover': {
                        backgroundColor: selectedYear === year ? 'primary.dark' : ''
                      }
                    }}
                  >
                    {year}년
                  </Button>
                ));
              })()}
            </ButtonGroup>
          </Box>

          {/* 월별 버튼 그룹 추가 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
              월 선택
              {selectedMonth !== null && (
                <Box component="span" sx={{
                  ml: 2,
                  py: 0.5,
                  px: 1.5,
                  borderRadius: 1,
                  backgroundColor: '#e3f2fd',
                  fontSize: '0.9rem',
                  color: '#1976d2',
                  display: 'inline-flex',
                  alignItems: 'center'
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
                    '&:hover': {
                      backgroundColor: selectedMonth === idx ? 'primary.dark' : ''
                    }
                  }}
                >
                  {idx + 1}월
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={3}>
              <DatePicker
                label="시작일"
                value={startDate}
                onChange={setStartDate}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <DatePicker
                label="종료일"
                value={endDate}
                onChange={setEndDate}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {brandOptions.map(option => (
                  <Button
                    key={option}
                    variant={brand === option ? "contained" : "outlined"}
                    size="small"
                    onClick={() => setBrand(option)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      px: 1,
                      bgcolor: brand === option ? 'primary.main' : 'background.paper',
                      '&:hover': {
                        bgcolor: brand === option ? 'primary.dark' : ''
                      }
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                onClick={() => handleSearch(null, null, null)}
                sx={{
                  height: '40px',
                  bgcolor: '#3182f6',
                  '&:hover': { bgcolor: '#1b64da' }
                }}
                fullWidth
                disabled={loading}
              >
                조회
              </Button>
            </Grid>
            {/* 매출 재계산 버튼 추가 */}
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleForceRecalculate}
                sx={{
                  height: '40px',
                  borderColor: '#ff9800',
                  color: '#ff9800',
                  '&:hover': {
                    bgcolor: '#fff8e1',
                    borderColor: '#ff8f00'
                  }
                }}
                fullWidth
                disabled={loading}
                startIcon={<RefreshIcon />}
              >
                매출 강제 재계산 (캐시 무시)
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 총계 카드 + 비교 지표 */}
        <Paper sx={{ p: 2, mb: 3, borderLeft: '4px solid #4caf50' }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#4caf50', display: 'flex', alignItems: 'center' }}>
            <Box component="span" sx={{ mr: 1 }}>검색 결과</Box>
            <Box component="span" sx={{
              py: 0.5,
              px: 1.5,
              borderRadius: 1,
              backgroundColor: '#f0f9f0',
              fontSize: '0.9rem',
              color: '#2e7d32',
              display: 'inline-flex',
              alignItems: 'center'
            }}>
              {getSearchFilterText()}
            </Box>
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    A/S 매출
                  </Typography>
                  <Typography variant="h5" component="div">
                    {formatCurrency(totalStats.totalServiceSales)}
                    {totalStats.totalLaborSalesOnly > 0 &&
                      <Typography variant="caption" sx={{ ml: 1, color: 'success.main' }}>
                        (공임: {formatCurrency(totalStats.totalLaborSalesOnly)} 포함)
                      </Typography>
                    }
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      AS(부품): {formatCurrency(totalStats.totalServiceSalesAS)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      판매(부품): {formatCurrency(totalStats.totalServiceSalesSell)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      검수 건수: {totalStats.totalServiceCount}건
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    출고 매출
                  </Typography>
                  <Typography variant="h5" component="div">
                    {formatCurrency(totalStats.totalShipmentSales)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      출고 건수: {totalStats.totalShipmentCount}건
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* 총 매출 카드 */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    총 매출
                  </Typography>
                  <Typography variant="h5" component="div">
                    {formatCurrency(totalStats.totalSales)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      총 검수 건수: {totalStats.totalServiceCount}건
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      총 출고 건수: {totalStats.totalShipmentCount}건
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* 판매처별 매출 카드 */}
            <Grid item xs={12} md={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <StorefrontIcon fontSize="small" color="primary" />
                    판매처별 매출 (출고)
                  </Typography>
                  <Grid container spacing={2}>
                    {Object.entries(totalStats.totalCustomerSales || {})
                      .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
                      .map(([channelName, channelData]) => (
                        <Grid item xs={12} sm={6} md={3} lg={2} key={channelName}>
                          <Paper
                            onClick={() => handleChannelClick(channelData)}
                            sx={{
                              p: 2,
                              bgcolor: '#f9fafb',
                              display: 'flex',
                              flexDirection: 'column',
                              height: '100%',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 3,
                                bgcolor: '#e3f2fd'
                              }
                            }}
                          >
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {channelData.name} {/* 판매채널 이름 */}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 500, color: '#1976d2', mt: 'auto' }}>
                              {formatCurrency(channelData.totalAmount)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              출고건수: {channelData.shipmentCount}건
                              <br />
                              <span style={{ fontSize: '0.75rem', color: '#1976d2' }}>상세보기 &gt;</span>
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    {Object.keys(totalStats.totalCustomerSales || {}).length === 0 && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
                          판매처 데이터 없음
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          {/* 비교 지표 행 */}
          {(compareStats.context === 'month' || compareStats.context === 'week') && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#f6f8ff', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main', fontWeight: 600 }}>
                {compareStats.context === 'month' ? '월별 비교' : '주별 비교'} (현재 검색 기간 기준)
              </Typography>
              <Grid container spacing={2}>
                {compareStats.context === 'month' && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">전월 대비</Typography>
                        <Typography variant="h6" sx={{ color: compareStats.mom > 0 ? 'error.main' : 'success.main' }}>{formatPercent(compareStats.mom)}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">전년 동월 대비</Typography>
                        <Typography variant="h6" sx={{ color: compareStats.yoy > 0 ? 'error.main' : 'success.main' }}>{formatPercent(compareStats.yoy)}</Typography>
                      </Paper>
                    </Grid>
                  </>
                )}
                {compareStats.context === 'week' && (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">전주 대비</Typography>
                        <Typography variant="h6" sx={{ color: compareStats.wow > 0 ? 'error.main' : 'success.main' }}>{formatPercent(compareStats.wow)}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">전년 동주 대비</Typography>
                        <Typography variant="h6" sx={{ color: compareStats.yoyWeek > 0 ? 'error.main' : 'success.main' }}>{formatPercent(compareStats.yoyWeek)}</Typography>
                      </Paper>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          )}
        </Paper>

        {/* 베스트 상품/부품 Top 5 - 출고 vs A/S 분리 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderLeft: '4px solid #1976d2', height: '100%' }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#1976d2' }}>
                많이 팔린 상품 TOP 5 (출고 기준)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Top</Typography>
                <Select size="small" value={topN} onChange={(e) => setTopN(Number(e.target.value))} sx={{ width: 80 }}>
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                </Select>
                <ButtonGroup size="small">
                  <Button variant={topSort === 'qty' ? 'contained' : 'outlined'} onClick={() => setTopSort('qty')}>수량</Button>
                  <Button variant={topSort === 'amount' ? 'contained' : 'outlined'} onClick={() => setTopSort('amount')}>매출</Button>
                </ButtonGroup>
              </Box>
              {(!topProducts || (Array.isArray(topProducts) && topProducts.length === 0)) ? (
                <Typography variant="body2" color="text.secondary">데이터가 없습니다.</Typography>
              ) : (
                <>
                  {brand === '전체' ? (
                    // 브랜드별 Top5 블록 반복
                    (topProducts || []).map((group) => (
                      <Box key={`brand-top-${group.brand}`} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{group.brand}</Typography>
                        <TableContainer>
                          <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell width="60">순위</TableCell>
                                <TableCell>상품명</TableCell>
                                <TableCell align="right" width="100">수량</TableCell>
                                <TableCell align="right" width="140">매출</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(group.list || []).map((item, idx) => (
                                <TableRow key={`${group.brand}-${item.name}`}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                                    {item.name}
                                  </TableCell>
                                  <TableCell align="right">{item.quantity.toLocaleString('ko-KR')}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    ))
                  ) : (
                    // 단일 브랜드 Top5 표 (그룹/아이템 혼합 상태 안전 처리)
                    (() => {
                      const items = Array.isArray(topProducts)
                        ? (topProducts[0] && topProducts[0].list
                          ? ((topProducts.find(g => g.brand === brand) || {}).list || [])
                          : topProducts)
                        : [];
                      return (
                        <TableContainer>
                          <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell width="60">순위</TableCell>
                                <TableCell>상품명</TableCell>
                                <TableCell align="right" width="100">수량</TableCell>
                                <TableCell align="right" width="140">매출</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {items.map((item, idx) => (
                                <TableRow key={item.name || idx}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                                    {item.name}
                                  </TableCell>
                                  <TableCell align="right">{Number(item.quantity || 0).toLocaleString('ko-KR')}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.total || 0)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()
                  )}
                </>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderLeft: '4px solid #2e7d32', height: '100%' }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500, color: '#2e7d32' }}>
                많이 사용된 부품 TOP 5 (A/S 기준)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Top</Typography>
                <Select size="small" value={topN} onChange={(e) => setTopN(Number(e.target.value))} sx={{ width: 80 }}>
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                </Select>
                <ButtonGroup size="small">
                  <Button variant={topSort === 'qty' ? 'contained' : 'outlined'} onClick={() => setTopSort('qty')}>수량</Button>
                  <Button variant={topSort === 'amount' ? 'contained' : 'outlined'} onClick={() => setTopSort('amount')}>매출</Button>
                </ButtonGroup>
              </Box>
              {(!topServiceParts || (Array.isArray(topServiceParts) && topServiceParts.length === 0)) ? (
                <Typography variant="body2" color="text.secondary">데이터가 없습니다.</Typography>
              ) : (
                <>
                  {brand === '전체' ? (
                    (topServiceParts || []).map((group) => (
                      <Box key={`brand-svc-${group.brand}`} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{group.brand}</Typography>
                        <TableContainer>
                          <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell width="60">순위</TableCell>
                                <TableCell>부품명</TableCell>
                                <TableCell align="right" width="100">수량</TableCell>
                                <TableCell align="right" width="140">매출(부품가)</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(group.list || []).map((item, idx) => (
                                <TableRow key={`${group.brand}-${item.name}`}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                                    {item.name}
                                  </TableCell>
                                  <TableCell align="right">{item.quantity.toLocaleString('ko-KR')}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    ))
                  ) : (
                    (() => {
                      const items = Array.isArray(topServiceParts)
                        ? (topServiceParts[0] && topServiceParts[0].list
                          ? ((topServiceParts.find(g => g.brand === brand) || {}).list || [])
                          : topServiceParts)
                        : [];
                      return (
                        <TableContainer>
                          <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell width="60">순위</TableCell>
                                <TableCell>부품명</TableCell>
                                <TableCell align="right" width="100">수량</TableCell>
                                <TableCell align="right" width="140">매출(부품가)</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {items.map((item, idx) => (
                                <TableRow key={item.name || idx}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                                    {item.name}
                                  </TableCell>
                                  <TableCell align="right">{Number(item.quantity || 0).toLocaleString('ko-KR')}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.total || 0)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()
                  )}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* 차트와 테이블 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="차트" />
            <Tab label="매출 요약" />
            <Tab label="월별 통계" />
            <Tab label="주별 통계" />
            <Tab label="매출 유형별" />
            <Tab label="부품 상세" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {tabValue === 0 ? (
              <>
                {/* 차트 기간 선택 버튼 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">매출 차트</Typography>
                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      variant={chartPeriod === 'daily' ? 'contained' : 'outlined'}
                      onClick={() => setChartPeriod('daily')}
                    >
                      일별
                    </Button>
                    <Button
                      variant={chartPeriod === 'weekly' ? 'contained' : 'outlined'}
                      onClick={() => setChartPeriod('weekly')}
                    >
                      주별
                    </Button>
                    <Button
                      variant={chartPeriod === 'monthly' ? 'contained' : 'outlined'}
                      onClick={() => setChartPeriod('monthly')}
                    >
                      월별
                    </Button>
                    <Button
                      variant={chartPeriod === 'yearly' ? 'contained' : 'outlined'}
                      onClick={() => setChartPeriod('yearly')}
                    >
                      년별
                    </Button>
                  </ButtonGroup>
                </Box>

                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer>
                    <BarChart data={getChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        angle={chartPeriod === 'daily' ? -45 : 0}
                        textAnchor={chartPeriod === 'daily' ? 'end' : 'middle'}
                        height={chartPeriod === 'daily' ? 80 : 60}
                        interval={chartPeriod === 'daily' ? 'preserveStartEnd' : 0}
                      />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value), name]}
                        labelFormatter={(label) => `기간: ${label}`}
                      />
                      <Legend />
                      <Bar yAxisId="left" name="A/S 매출(공임포함)" dataKey="serviceSales" fill="#8884d8" />
                      <Bar yAxisId="left" name="출고 매출" dataKey="shipmentSales" fill="#ffc658" />
                      <Bar yAxisId="left" name="A/S 공임만" dataKey="laborSalesOnly" fill="#82ca9d" />
                      <Bar yAxisId="right" name="A/S 검수 건수" dataKey="serviceCount" fill="#ff8042" />
                      <Bar yAxisId="right" name="출고 건수" dataKey="shipmentCount" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </>
            ) : tabValue === 1 ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">매출 요약</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadSummaryExcel}
                    size="small"
                  >
                    엑셀 다운로드
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>날짜</TableCell>
                        <TableCell align="right">A/S 매출(공임포함)</TableCell>
                        <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>A/S매출(AS-부품)</TableCell>
                        <TableCell align="right" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>A/S매출(판매-부품)</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>A/S 공임만</TableCell>
                        <TableCell align="right">A/S 검수 건수</TableCell>
                        <TableCell align="right">출고 매출</TableCell>
                        <TableCell align="right">출고 건수</TableCell>
                        <TableCell align="right">워런티 정상가치</TableCell>
                        <TableCell align="right">총계</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {salesData.map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSales)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSalesAS)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSalesSell)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.laborSalesOnly)}</TableCell>
                          <TableCell align="right">{row.serviceCount}</TableCell>
                          <TableCell align="right">{formatCurrency(row.shipmentSales)}</TableCell>
                          <TableCell align="right">{row.shipmentCount}</TableCell>
                          <TableCell align="right">
                            {row.warrantyNormalValue > 0 ? (
                              <span style={{ color: '#d32f2f', fontWeight: 600 }}>
                                ({formatCurrency(row.warrantyNormalValue)})
                              </span>
                            ) : (
                              formatCurrency(0)
                            )}
                          </TableCell>
                          <TableCell align="right">{formatCurrency((row.serviceSales || 0) + (row.shipmentSales || 0))}</TableCell>
                        </TableRow>
                      ))}
                      {/* 합계 행 추가 */}
                      <TableRow
                        sx={{
                          backgroundColor: '#f5f5f5',
                          '& td': {
                            fontWeight: 'bold',
                            borderTop: '2px solid #e0e0e0'
                          }
                        }}
                      >
                        <TableCell>합계</TableCell>
                        <TableCell align="right">
                          {formatCurrency(salesData.reduce((sum, row) => sum + (row.serviceSales || 0), 0))}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'primary.main' }}>
                          {formatCurrency(salesData.reduce((sum, row) => sum + (row.serviceSalesAS || 0), 0))}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'secondary.main' }}>
                          {formatCurrency(salesData.reduce((sum, row) => sum + (row.serviceSalesSell || 0), 0))}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {formatCurrency(salesData.reduce((sum, row) => sum + (row.laborSalesOnly || 0), 0))}
                        </TableCell>
                        <TableCell align="right">
                          {salesData.reduce((sum, row) => sum + (row.serviceCount || 0), 0)}건
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(salesData.reduce((sum, row) => sum + (row.shipmentSales || 0), 0))}
                        </TableCell>
                        <TableCell align="right">
                          {salesData.reduce((sum, row) => sum + (row.shipmentCount || 0), 0)}건
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(salesData.reduce((sum, row) => sum + (row.warrantyNormalValue || 0), 0) > 0
                            ? salesData.reduce((sum, row) => sum + (row.warrantyNormalValue || 0), 0)
                            : 0)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(salesData.reduce((sum, row) => {
                            const rowTotal = (row.serviceSales || 0) + (row.shipmentSales || 0);
                            return sum + rowTotal;
                          }, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : tabValue === 2 ? (
              // 월별 통계
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">월별 매출 통계</Typography>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>기간</TableCell>
                        <TableCell align="right">A/S 매출</TableCell>
                        <TableCell align="right">A/S(AS-부품)</TableCell>
                        <TableCell align="right">A/S(판매-부품)</TableCell>
                        <TableCell align="right">A/S 공임</TableCell>
                        <TableCell align="right">출고 매출</TableCell>
                        <TableCell align="right">총 매출</TableCell>
                        <TableCell align="right">A/S 건수</TableCell>
                        <TableCell align="right">출고 건수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monthlyStats.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{row.period}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSales)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSalesAS)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSalesSell)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.laborSalesOnly)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.shipmentSales)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatCurrency(row.totalSales)}
                          </TableCell>
                          <TableCell align="right">{row.serviceCount}건</TableCell>
                          <TableCell align="right">{row.shipmentCount}건</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : tabValue === 3 ? (
              // 주별 통계
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">주별 매출 통계</Typography>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>기간</TableCell>
                        <TableCell align="right">총 매출</TableCell>
                        <TableCell align="right">전주 대비</TableCell>
                        <TableCell align="right">A/S 매출</TableCell>
                        <TableCell align="right">A/S(AS-부품)</TableCell>
                        <TableCell align="right">A/S(판매-부품)</TableCell>
                        <TableCell align="right">A/S 공임</TableCell>
                        <TableCell align="right">출고 매출</TableCell>
                        <TableCell align="right">A/S 건수</TableCell>
                        <TableCell align="right">출고 건수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {weeklyStats.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ fontWeight: 'bold' }}>{row.weekLabel || row.period}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatCurrency(row.totalSales)}</TableCell>
                          <TableCell align="right" sx={{ color: row.wowPct > 0 ? 'error.main' : 'success.main' }}>{formatPercent(row.wowPct)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSales)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSalesAS)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.serviceSalesSell)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.laborSalesOnly)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.shipmentSales)}</TableCell>
                          <TableCell align="right">{row.serviceCount}건</TableCell>
                          <TableCell align="right">{row.shipmentCount}건</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : tabValue === 4 ? (
              // 매출 유형별 통계
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">매출 유형별 통계</Typography>
                </Box>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  {typeStats.map((type, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                      <Card sx={{ height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                bgcolor: type.color,
                                borderRadius: '50%',
                                mr: 1
                              }}
                            />
                            <Typography variant="subtitle2" color="textSecondary">
                              {type.type}
                            </Typography>
                          </Box>
                          <Typography variant="h5" component="div" sx={{ color: type.color, fontWeight: 'bold' }}>
                            {formatCurrency(type.amount)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            건수: {type.count}건
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            비율: {totalStats.totalSales > 0 ? ((type.amount / totalStats.totalSales) * 100).toFixed(1) : 0}%
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {/* 유형별 차트 */}
                <Box sx={{ height: 300, mt: 3 }}>
                  <ResponsiveContainer>
                    <BarChart data={typeStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="amount" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </>
            ) : tabValue === 5 ? (
              // 부품 상세 (tabValue === 5)
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">부품 상세</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadPartsExcel}
                    size="small"
                  >
                    엑셀 다운로드
                  </Button>
                </Box>
                {renderPartsDetail()}
              </>
            ) : null}
          </Box>
        </Paper>
        {/* 판매처 상세 내역 모달 */}
        <Dialog
          open={channelModalOpen}
          onClose={handleChannelClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ borderBottom: '1px solid #eee' }}>
            {selectedChannelStats?.name} 상세 출고 내역
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              기간: {format(startDate, 'yyyy-MM-dd')} ~ {format(endDate, 'yyyy-MM-dd')}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            {selectedChannelStats && (
              <TableContainer component={Paper} elevation={0} variant="outlined">
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell>순위</TableCell>
                      <TableCell>제품명</TableCell>
                      <TableCell align="right">수량</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(selectedChannelStats.products || {})
                      .sort(([nameA, dataA], [nameB, dataB]) => {
                        // 1. 기체(Airframe) 우선 정렬
                        const isAirframeA = dataA.category === '기체';
                        const isAirframeB = dataB.category === '기체';

                        if (isAirframeA && !isAirframeB) return -1;
                        if (!isAirframeA && isAirframeB) return 1;

                        // 2. 수량 내림차순
                        return dataB.quantity - dataA.quantity;
                      })
                      .map(([productName, data], index) => (
                        <TableRow key={productName} hover>
                          <TableCell width="60">{index + 1}</TableCell>
                          <TableCell>
                            {productName}
                            {data.category === '기체' && (
                              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'primary.main', bgcolor: '#e3f2fd', px: 0.5, borderRadius: 0.5 }}>
                                기체
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {data.quantity.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    {Object.keys(selectedChannelStats.products || {}).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          출고 상세 내역이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Typography variant="subtitle2" color="primary">
                총 출고 건수: {selectedChannelStats?.shipmentCount}건
              </Typography>
              <Typography variant="subtitle2" color="primary">
                총 매출액: {formatCurrency(selectedChannelStats?.totalAmount)}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleChannelClose} color="primary">닫기</Button>
          </DialogActions>
        </Dialog>
      </Box>

    </LocalizationProvider>
  );
}

export default SalesStats; 