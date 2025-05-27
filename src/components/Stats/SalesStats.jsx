import React, { useState, useEffect } from 'react';
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
  Container
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, parseISO, setMonth, getMonth } from 'date-fns';
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
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [totalLaborSales, setTotalLaborSales] = useState(0);
  const brandOptions = ['전체', 'XRB', 'NB'];
  const currentMonth = getMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [currentPeriod, setCurrentPeriod] = useState(null);

  // 월별 버튼 클릭 핸들러
  const handleMonthSelect = (monthIndex) => {
    // monthIndex는 0부터 시작하는 인덱스임 (0: 1월, 1: 2월, ..., 11: 12월)
    // 버튼의 월 표시는 1부터 시작하므로 화면에 표시되는 월과 내부 처리 월이 정확히 일치하는지 확인해야 함
    const now = new Date();
    const year = now.getFullYear();
    
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
      // 주요 키워드 검색 (스마트할부 추가)
      const keywords = ['공홈', '블로그', '네이버', '인스타', '청담', '쿠팡', '매장', '스마트할부', '라이클-우리'];
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
        .select('name, price');

      if (allPartsError) {
        console.error('Parts 테이블 조회 오류:', allPartsError);
      }

      const partsPriceMap = new Map();
      if (allPartsData) {
        allPartsData.forEach(p => {
          if (p.name && typeof p.price === 'number') {
            partsPriceMap.set(p.name.trim(), p.price);
          }
        });
      }
      console.log('[DEBUG] Parts Price Map:', partsPriceMap);

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
          .select('shipment_id, part_name, part_code, quantity, price, total_price, created_at')
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
              quantity: part.quantity,
              price: part.price,
              total: part.total_price,
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
          const unitPriceFromMap = partsPriceMap.get(productNames[0]);
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
            servicePartsByDate[date].push({
              service_id: item.services.id,
              name: item.parts.name,
              code: item.parts.code,
              parts_note: item.parts.note,
              quantity: item.quantity || 0,
              price: item.price || 0,
              total: (item.quantity || 0) * (item.price || 0),
              usage: item.usage
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

          const productNames = (shipment.product_name || "").split(',').map(pn => pn.trim()).filter(pn => pn);
          const numIndividualProducts = productNames.length > 0 ? productNames.length : 1;

          const originalShipmentTotal = shipment.price || 0;
          const originalShipmentQuantity = shipment.quantity || 0;

          if (productNames.length === 0) { // product_name이 비어있거나 단일 항목이지만 분리 안된 경우 (예: 이전 데이터)
            const productNameTrimmed = (shipment.product_name || '').trim();
            const unitPriceFromMap = productNameTrimmed ? partsPriceMap.get(productNameTrimmed) : undefined;
            
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
              const unitPriceFromMap = partsPriceMap.get(individualName);
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
        shipmentPartsByDate: tempShipmentPartsByDate 
      });

      // 총 매출 및 통계 계산
      let newTotalServiceSales = 0;
      let newTotalServiceSalesAS = 0;
      let newTotalServiceSalesSell = 0;
      let newTotalShipmentSales = 0;
      let newTotalServiceCount = 0;
      let newTotalShipmentCount = 0;
      let newTotalLaborSalesOnly = 0; // 순수 공임비 총액만 집계
      const newTotalCustomerSales = {};

      const uniqueServiceIds = new Set();
      Object.values(servicePartsByDate).forEach(dailyParts => {
        dailyParts.forEach(part => {
          const isLabor = (part.name && part.name.includes('공임')) || 
                          (part.usage && part.usage.toString().trim() === '공임');
          
          if (isLabor) {
            newTotalLaborSalesOnly += (part.total || 0);
          } else {
            // 공임이 아닌 경우에만 A/S 부품 매출로 집계
            newTotalServiceSales += (part.total || 0); // 공임 제외 부품 매출 합계
            if (part.usage === 'AS') {
              newTotalServiceSalesAS += (part.total || 0);
            } else if (part.usage === '판매') {
              newTotalServiceSalesSell += (part.total || 0);
            }
          }
          uniqueServiceIds.add(part.service_id); 
        });
      });
      newTotalServiceCount = uniqueServiceIds.size; 
      // setTotalLaborSales(newTotalLaborSalesOnly); // 기존 상태 대신 totalStats에 포함

      const uniqueShipmentIds = new Set();
      Object.values(tempShipmentPartsByDate).forEach(dailyParts => {
        dailyParts.forEach(part => {
          // newTotalShipmentSales += part.total || 0; // 이 부분을 원본 데이터 기준으로 변경
          uniqueShipmentIds.add(part.shipment_id);
          
          // 고객별 매출 집계 (출고 기준) -> 판매처별 매출 집계로 변경
          const salesChannelKey = part.sales_channel || '미지정'; // 판매채널을 키로 사용

          if (!newTotalCustomerSales[salesChannelKey]) {
            newTotalCustomerSales[salesChannelKey] = { 
              name: salesChannelKey, // 판매채널 이름
              // phone: part.customer_phone || '정보없음', // 판매처별 집계에서는 고객 연락처는 불필요할 수 있음
              totalAmount: 0, 
              shipmentCount: 0, // 판매처별 출고 건수 (아래에서 로직 수정 필요)
              // firstOrderDate, lastOrderDate는 판매처별로는 의미가 다를 수 있어 일단 보류 또는 다른 방식 고려
            };
          }
          // newTotalCustomerSales[salesChannelKey].totalAmount += part.total || 0; // 이 부분을 원본 데이터 기준으로 변경
                                                                    // 이 방식은 출고된 부품(제품라인) 수를 카운트함.
                                                                    // 판매처별 실제 '출고 건수'는 uniqueShipmentIds를 판매처별로 관리해야 함.
                                                                    // 여기서는 우선 총액만 정확히 집계
        });
      });

      // 총 출고 매출 계산 (원본 shipmentsData 기준)
      newTotalShipmentSales = shipmentsData.reduce((sum, shipment) => sum + (shipment.price || 0), 0);

      // 판매처별 매출 집계 (원본 shipmentsData 기준)
      shipmentsData.forEach(shipment => {
        const salesChannel = extractSalesChannel(shipment.note, shipment.sales_channel) || '미지정';
        if (!newTotalCustomerSales[salesChannel]) {
          newTotalCustomerSales[salesChannel] = {
            name: salesChannel,
            totalAmount: 0,
            shipmentCount: 0, // 아래에서 재계산
          };
        }
        newTotalCustomerSales[salesChannel].totalAmount += (shipment.price || 0);
      });
      
      newTotalShipmentCount = uniqueShipmentIds.size; // 전체 출고 건수

      // 판매처별 출고 건수 재계산 (uniqueShipmentIds 활용)
      const shipmentCountsByChannel = {};
      shipmentsData.forEach(shipment => {
        const salesChannel = extractSalesChannel(shipment.note, shipment.sales_channel) || '미지정';
        if (!shipmentCountsByChannel[salesChannel]) {
          shipmentCountsByChannel[salesChannel] = new Set();
        }
        shipmentCountsByChannel[salesChannel].add(shipment.id);
      });

      Object.keys(newTotalCustomerSales).forEach(channel => {
        if (shipmentCountsByChannel[channel]) {
          newTotalCustomerSales[channel].shipmentCount = shipmentCountsByChannel[channel].size;
        } else {
          newTotalCustomerSales[channel].shipmentCount = 0; // 해당 판매채널에 출고건이 없는 경우
        }
      });

      const finalTotalServiceSalesWithLabor = newTotalServiceSales + newTotalLaborSalesOnly; // 공임 포함 최종 A/S 매출

      setTotalStats({
        totalServiceSales: finalTotalServiceSalesWithLabor, // 공임 포함 A/S 매출
        totalShipmentSales: newTotalShipmentSales,
        totalSales: finalTotalServiceSalesWithLabor + newTotalShipmentSales, // 최종 총 매출
        totalServiceSalesAS: newTotalServiceSalesAS, // 순수 AS 부품 매출
        totalServiceSalesSell: newTotalServiceSalesSell, // 순수 판매 부품 매출
        totalServiceCount: newTotalServiceCount,
        totalShipmentCount: newTotalShipmentCount,
        totalCustomerSales: newTotalCustomerSales, 
        totalLaborSalesOnly: newTotalLaborSalesOnly, // 순수 공임 매출만 저장
      });

      // 날짜별 판매 데이터 생성
      const aggregatedSales = {};
      const currentDate = new Date(formattedStartDate);
      const lastDate = new Date(formattedEndDate);

      while (currentDate <= lastDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        aggregatedSales[dateStr] = {
          date: dateStr,
          serviceSales: 0, // 공임 포함 최종 A/S 매출
          serviceSalesAS: 0, // 순수 AS 부품 매출
          serviceSalesSell: 0, // 순수 판매 부품 매출
          serviceCount: 0,
          shipmentSales: 0,
          shipmentCount: 0, 
          laborSalesOnly: 0, // 날짜별 순수 공임 매출
          totalSales: 0, 
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      Object.entries(servicePartsByDate).forEach(([date, parts]) => {
        if (aggregatedSales[date]) {
          let dailyServiceSalesAS_partsOnly = 0;
          let dailyServiceSalesSell_partsOnly = 0;
          let dailyLaborSales = 0;
          const dailyServiceIds = new Set();

          parts.forEach(part => {
            const isLaborPart = (part.name && part.name.includes('공임')) || 
                                (part.usage && part.usage.toString().trim() === '공임');
            if (isLaborPart) {
              dailyLaborSales += (part.total || 0);
            } else {
              if (part.usage === 'AS') {
                dailyServiceSalesAS_partsOnly += (part.total || 0);
              } else if (part.usage === '판매') {
                dailyServiceSalesSell_partsOnly += (part.total || 0);
              }
            }
            dailyServiceIds.add(part.service_id);
          });
          aggregatedSales[date].serviceSalesAS = dailyServiceSalesAS_partsOnly;
          aggregatedSales[date].serviceSalesSell = dailyServiceSalesSell_partsOnly;
          aggregatedSales[date].laborSalesOnly = dailyLaborSales; // 날짜별 순수 공임
          aggregatedSales[date].serviceSales = dailyServiceSalesAS_partsOnly + dailyServiceSalesSell_partsOnly + dailyLaborSales; // 날짜별 A/S 매출 (공임 포함)
          aggregatedSales[date].serviceCount = dailyServiceIds.size; 
        }
      });

      // 일별 출고 매출 및 건수 집계 (원본 shipmentsData 기준)
      const dailyShipmentAggregates = {};
      shipmentsData.forEach(shipment => {
        const dateStr = format(parseISO(shipment.order_date), 'yyyy-MM-dd');
        if (!dailyShipmentAggregates[dateStr]) {
          dailyShipmentAggregates[dateStr] = {
            sales: 0,
            ids: new Set()
          };
        }
        dailyShipmentAggregates[dateStr].sales += (shipment.price || 0);
        dailyShipmentAggregates[dateStr].ids.add(shipment.id);
      });

      Object.entries(dailyShipmentAggregates).forEach(([date, data]) => {
        if (aggregatedSales[date]) {
          aggregatedSales[date].shipmentSales = data.sales;
          aggregatedSales[date].shipmentCount = data.ids.size;
        } else {
          // 만약 aggregatedSales에 해당 날짜가 없다면 (이론적으로는 발생하지 않아야 함)
          // 필요시 여기서 생성 또는 오류 처리
          console.warn(`aggregatedSales에 ${date} 날짜가 존재하지 않습니다. 일별 출고 집계 건너뜀.`);
        }
      });
      
      // 날짜별 총 매출 계산
      Object.keys(aggregatedSales).forEach(date => {
        aggregatedSales[date].totalSales = 
          (aggregatedSales[date].serviceSales || 0) + // 공임 포함 A/S 매출
          (aggregatedSales[date].shipmentSales || 0); // 출고 매출 (공임 미포함)
      });
      
      setSalesData(Object.values(aggregatedSales).sort((a, b) => new Date(a.date) - new Date(b.date)));
      console.log('매출 데이터 집계 완료 (A/S 포함):', Object.values(aggregatedSales));
      console.log('매출 데이터 조회 완료');

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
      if (forceRefresh > 0) {
        setSnackbar({
          open: true,
          message: '매출 데이터가 성공적으로, 재계산되었습니다.',
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: '매출 데이터 조회가 완료되었습니다.',
          severity: 'success'
        });
      }
      
      // 3초 후 알림 닫기
      setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 3000);
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
    return numAmount.toLocaleString('ko-KR') + '원';
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
          <Typography sx={{my: 2, color: 'text.secondary'}}>해당 기간에 A/S된 부품 내역이 없습니다.</Typography>
        ) : (
          Object.entries(serviceGroupedByDate).map(([date, parts]) => (
            <Box key={`service-${date}`} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'bold'}}>
                {format(parseISO(date), 'MM월 dd일 (EEE)', { locale: ko })} - A/S
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{backgroundColor: 'grey.100'}}>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>제품/부품명</TableCell>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>부품코드</TableCell>
                      <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>수량</TableCell>
                      <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>단가</TableCell>
                      <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>합계</TableCell>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>구분</TableCell>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>세부 구분(Parts Note)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parts.map((part, index) => {
                      // Log the first A/S part for debugging
                      if (index === 0 && date === Object.keys(serviceGroupedByDate)[0]) { // 첫 번째 날짜의 첫 번째 항목만 로그
                        console.log('[DEBUG] Rendering First A/S Part of First Date:', part);
                        console.log('[DEBUG] Rendering First A/S Part Name of First Date:', part.name);
                      }
                      return (
                        <TableRow key={`servicepart-${part.service_id}-${part.code}-${index}`}> {/* 키를 더 고유하게 만듭니다. */}
                          <TableCell>{part.name}</TableCell> {/* Tooltip과 스타일 없이 직접 표시 */}
                          <TableCell>{part.code}</TableCell>
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(part.price)}</TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                          <TableCell>{part.usage}</TableCell>
                          <TableCell>{part.parts_note || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))
        )}

        <Divider sx={{ my: 4, borderStyle: 'dashed' }} />

        <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'secondary.main', borderBottom: '2px solid', borderColor: 'secondary.main', pb: 0.5 }}>
          <InventoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          출고 상세 내역
        </Typography>
        {Object.keys(shipmentGroupedByDate).length === 0 ? (
          <Typography sx={{my: 2, color: 'text.secondary'}}>해당 기간에 출고된 내역이 없습니다.</Typography>
        ) : (
          Object.entries(shipmentGroupedByDate).map(([date, parts]) => (
            <Box key={`shipment-${date}`} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'bold'}}>
                {format(parseISO(date), 'MM월 dd일 (EEE)', { locale: ko })} - 출고
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{backgroundColor: 'grey.100'}}>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>제품/부품명</TableCell>
                      <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>수량</TableCell>
                      <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>단가</TableCell>
                      <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>합계</TableCell>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>고객명</TableCell>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>연락처</TableCell>
                      <TableCell sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>판매채널</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parts.map((part, index) => {
                      // Log the first shipment part for debugging
                      if (index === 0 && date === Object.keys(shipmentGroupedByDate)[0]) { // 첫 번째 날짜의 첫 번째 항목만 로그
                        console.log('[DEBUG] Rendering First Shipment Part of First Date:', part);
                        console.log('[DEBUG] Rendering First Shipment Part Name of First Date:', part.name);
                      }
                      return (
                        <TableRow key={part.shipment_item_key || `shipmentpart-${part.shipment_id}-${index}`}> 
                          <TableCell>{part.name}</TableCell> 
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">
                            {/* 단가: part.price 사용 (fetchSalesData에서 parts 테이블 기준으로 계산됨) */}
                            {formatCurrency(part.price)}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                          <TableCell>{part.customer_name || '-'}</TableCell>
                          <TableCell>{part.customer_phone || '-'}</TableCell>
                          <TableCell>{part.sales_channel || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
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
              <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
                브랜드
              </Typography>
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

        {/* 총계 카드 */}
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
                          <Paper sx={{ p: 2, bgcolor: '#f9fafb', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {channelData.name} {/* 판매채널 이름 */}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 500, color: '#1976d2', mt: 'auto' }}>
                              {formatCurrency(channelData.totalAmount)} 
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              출고건수: {channelData.shipmentCount}건
                              {/* firstOrderDate, lastOrderDate는 제거 또는 다른 방식으로 표시 */}
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
        </Paper>

        {/* 차트와 테이블 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="차트" />
            <Tab label="매출 요약" />
            <Tab label="부품 상세" />
          </Tabs>
          
          <Box sx={{ p: 3 }}>
            {tabValue === 0 ? (
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip formatter={(value, name) => formatCurrency(value)} />
                    <Legend />
                    <Bar yAxisId="left" name="A/S 매출(공임포함)" dataKey="serviceSales" fill="#8884d8" />
                    <Bar yAxisId="left" name="출고 매출" dataKey="shipmentSales" fill="#ffc658" />
                    <Bar yAxisId="left" name="A/S 공임만" dataKey="laborSalesOnly" fill="#82ca9d" />
                    <Bar yAxisId="right" name="A/S 검수 건수" dataKey="serviceCount" fill="#ff8042" />
                    <Bar yAxisId="right" name="출고 건수" dataKey="shipmentCount" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : tabValue === 1 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>날짜</TableCell>
                      <TableCell align="right">A/S 매출(공임포함)</TableCell>
                      <TableCell align="right">A/S매출(AS-부품)</TableCell>
                      <TableCell align="right">A/S매출(판매-부품)</TableCell>
                      <TableCell align="right">A/S 공임만</TableCell>
                      <TableCell align="right">A/S 검수 건수</TableCell>
                      <TableCell align="right">출고 매출</TableCell>
                      <TableCell align="right">출고 건수</TableCell>
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
                        <TableCell align="right">{formatCurrency(row.totalSales)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              renderPartsDetail()
            )}
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}

export default SalesStats; 