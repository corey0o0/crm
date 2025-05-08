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
  const extractSalesChannel = (note) => {
    if (!note) return '미지정';
    
    // [판매처: XXX] 형식 검색
    const match = note.match(/\[판매처:\s*(.*?)\]/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // 공홈, 블로그, 네이버 등 주요 키워드 검색
    const keywords = ['공홈', '블로그', '네이버', '인스타', '청담', '쿠팡', '매장'];
    for (const keyword of keywords) {
      if (note.includes(keyword)) {
        return keyword;
      }
    }
    
    return '미지정';
  };

  const fetchSalesData = async (periodInfo) => {
    // periodInfo가 없으면 현재 상태 값 사용
    const { startDate: queryStartDate, endDate: queryEndDate, brand: queryBrand } = 
      periodInfo || { startDate, endDate, brand };
      
    try {
      setLoading(true);

      // 디버깅: 조회 중인 날짜 범위 출력
      const formattedStartDate = format(queryStartDate, 'yyyy-MM-dd');
      const formattedEndDate = format(queryEndDate, 'yyyy-MM-dd');
      console.log('====== 매출 데이터 조회 시작 ======');
      console.log(`조회 기간: ${formattedStartDate} ~ ${formattedEndDate}`);
      console.log(`브랜드: ${queryBrand}`);

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
            code
          )
        `)
        .gte('services.completion_date', formattedStartDate)
        .lte('services.completion_date', formattedEndDate);
      
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
      if (servicePartsError) throw servicePartsError;

      // 데이터를 저장할 객체 초기화
      const servicePartsByDate = {};
      const shipmentPartsByDate = {};

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
              quantity: item.quantity || 0,
              price: item.price || 0,
              total: (item.quantity || 0) * (item.price || 0),
              usage: item.usage
            });
          }
        });
      }

      // 출고 데이터 조회 수정
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
          note
        `)
        .gte('order_date', formattedStartDate)
        .lte('order_date', formattedEndDate);

      // forceRefresh가 1 이상일 때 캐시를 사용하지 않도록 설정
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

      // 출고 부품 데이터 조회 추가 - 시스템에 shipment_parts 테이블이 있는 경우 사용
      try {
        let shipmentPartsData = [];
        
        // shipment_parts 테이블이 있는지 확인
        const { error: checkTableError } = await supabase
          .from('shipment_parts')
          .select('id')
          .limit(1);

        // shipment_parts 테이블이 있다면 해당 테이블에서 데이터 조회
        if (!checkTableError) {
          let shipmentPartsQuery = supabase
            .from('shipment_parts')
            .select(`
              id,
              shipment_id,
              part_name,
              part_code,
              quantity,
              price,
              total_price,
              created_at,
              shipments!inner (
                order_date,
                brand,
                note
              )
            `)
            .gte('shipments.order_date', formattedStartDate)
            .lte('shipments.order_date', formattedEndDate);

            // forceRefresh가 1 이상일 때 캐시를 사용하지 않도록 설정
            if (forceRefresh > 0) {
              shipmentPartsQuery = shipmentPartsQuery.options({ 
                cache: 'no-store',
                head: false 
              });
            }

            if (queryBrand !== '전체') {
              shipmentPartsQuery = shipmentPartsQuery.eq('shipments.brand', queryBrand);
            }

          const { data, error } = await shipmentPartsQuery;
          
          if (!error && data) {
            console.log('조회된 출고 부품 데이터:', data);
            shipmentPartsData = data;
          } else {
            console.log('출고 부품 데이터 조회 오류 또는 데이터 없음:', error);
          }
        } else {
          console.log('shipment_parts 테이블이 존재하지 않습니다. 기존 방식으로 처리합니다.');
        }

        // 출고 부품 데이터 처리
        if (shipmentPartsData.length > 0) {
          // shipment_parts 테이블에서 데이터를 가져온 경우 처리
          shipmentPartsData.forEach(part => {
            if (part.shipments) {
              const date = format(parseISO(part.shipments.order_date), 'yyyy-MM-dd');
              if (!shipmentPartsByDate[date]) {
                shipmentPartsByDate[date] = [];
              }

              // price 필드는 이미 단가로 저장되어 있으므로 그대로 사용
              // total은 단가와 수량을 곱하여 계산
              const partPrice = Number(part.price) || 0;
              const partQuantity = Number(part.quantity) || 0;
              // total_price 필드가 있으면 사용하고, 없으면 계산
              const totalPrice = part.total_price !== undefined ? Number(part.total_price) : partPrice * partQuantity;
              
              shipmentPartsByDate[date].push({
                name: part.part_name,
                code: part.part_code || '',
                quantity: partQuantity,
                price: partPrice,
                total: totalPrice,
                shipment_id: part.shipment_id,
                customer: extractSalesChannel(part.shipments.note)
              });
            }
          });
        } else {
          // 기존 방식으로 처리 (shipments 테이블의 데이터만 사용)
          console.log('shipment_parts 테이블에서 데이터를 찾을 수 없어 출고 정보에서 부품 정보 추출 시작');
          await processShipmentsData(shipmentsData, shipmentPartsByDate);
        }
      } catch (error) {
        console.error('출고 부품 데이터 처리 오류:', error);
        // 오류 발생 시 기존 방식으로 처리
        console.log('오류 발생으로 인해 기존 방식으로 출고 정보에서 부품 정보 추출 시작');
        await processShipmentsData(shipmentsData, shipmentPartsByDate);
      }

      console.log('날짜별 출고 부품 데이터:', shipmentPartsByDate);

      // 부품 데이터 상태 업데이트
      setPartsData({
        servicePartsByDate,
        shipmentPartsByDate
      });

      // 기존 출고 데이터 처리 함수를 별도로 정의
      async function processShipmentsData(shipmentsData, shipmentPartsByDate) {
        if (shipmentsData && shipmentsData.length > 0) {
          // 모든 비동기 작업을 저장할 배열
          const asyncTasks = [];
          
          // 각 출고 항목 처리
          for (const shipment of shipmentsData) {
            const date = format(parseISO(shipment.order_date), 'yyyy-MM-dd');
            if (!shipmentPartsByDate[date]) {
              shipmentPartsByDate[date] = [];
            }

            // 제품명을 쉼표로 분리하여 여러 제품으로 처리
            const productNames = shipment.product_name.split(',').map(name => name.trim());
            
            if (productNames.length > 1) {
              // 여러 제품이 있는 경우, 각각을 별도 항목으로 추가
              // 비동기 함수로 만들어 처리
              const processMultiplePartsTask = async () => {
                try {
                  // 각 제품명으로 parts 테이블에서 정보 조회
                  const partPromises = productNames.map(async (name) => {
                    const { data, error } = await supabase
                      .from('parts')
                      .select('*')
                      .eq('brand', shipment.brand)
                      .ilike('name', `%${name}%`)  // 부분 일치로 변경
                      .limit(1);
                    
                    return { name, partData: error ? null : (data?.length > 0 ? data[0] : null) };
                  });
                  
                  const partResults = await Promise.all(partPromises);
                  console.log(`[${date}] ${shipment.product_name} 부품 조회 결과:`, partResults);
                  
                  // 각 부품 정보 처리
                  const processedParts = partResults.map(({ name, partData }) => {
                    if (partData) {
                      // 파츠 DB에서 정보를 찾은 경우
                      const partPrice = partData.price || 0;
                      // 수량 추정: 총 수량을 부품 수로 나눔 (더 정확한 정보가 없는 경우)
                      const estimatedQuantity = Math.max(1, Math.ceil(Number(shipment.quantity) / productNames.length));
                      
                      return {
                        name: name,
                        code: partData.code || '',
                        quantity: estimatedQuantity,
                        price: partPrice,
                        total: partPrice * estimatedQuantity,
                        shipment_id: shipment.id,
                        customer: extractSalesChannel(shipment.note)
                      };
                    } else {
                      // 파츠 DB에서 정보를 찾지 못한 경우 - 예상 계산
                      const estimatedQuantity = Math.max(1, Math.ceil(Number(shipment.quantity) / productNames.length));
                      // 단가 예상: 총 금액을 동일하게 분배
                      const estimatedPrice = (Number(shipment.price) || 0) / Math.max(1, productNames.length * estimatedQuantity);
                      
                      return {
                        name: name,
                        code: '',
                        quantity: estimatedQuantity,
                        price: estimatedPrice,
                        total: estimatedPrice * estimatedQuantity,
                        shipment_id: shipment.id,
                        customer: extractSalesChannel(shipment.note)
                      };
                    }
                  });
                  
                  // 이미 존재하는 shipmentPartsByDate 배열에 추가
                  if (!shipmentPartsByDate[date]) {
                    shipmentPartsByDate[date] = [];
                  }
                  shipmentPartsByDate[date].push(...processedParts);
                  
                  return processedParts;
                } catch (error) {
                  console.error(`[${date}] ${shipment.product_name} 부품 처리 중 오류:`, error);
                  // 오류 발생 시 기본 예상 처리
                  const fallbackParts = productNames.map(name => {
                    // 단가는 전체 금액을 제품 수로 균등하게 나눔 (더 좋은 방법이 없을 경우)
                    const safeQuantity = Math.max(1, Number(shipment.quantity) || 1);
                    const safePartsCount = Math.max(1, productNames.length);
                    const estimatedQuantity = Math.ceil(safeQuantity / safePartsCount);
                    const estimatedPrice = (Number(shipment.price) || 0) / (safePartsCount * estimatedQuantity);
                    
                    return {
                      name: name,
                      code: '',
                      quantity: estimatedQuantity,
                      price: estimatedPrice,
                      total: estimatedPrice * estimatedQuantity,
                      shipment_id: shipment.id,
                      customer: extractSalesChannel(shipment.note)
                    };
                  });
                  
                  // 이미 존재하는 shipmentPartsByDate 배열에 추가
                  if (!shipmentPartsByDate[date]) {
                    shipmentPartsByDate[date] = [];
                  }
                  shipmentPartsByDate[date].push(...fallbackParts);
                  
                  return fallbackParts;
                }
              };
              
              // 비동기 작업 배열에 추가
              asyncTasks.push(processMultiplePartsTask());
            } else {
              // 단일 제품인 경우
              const partData = {
                name: shipment.product_name,
                code: shipment.product_code || '',
                quantity: Number(shipment.quantity) || 0,
                price: shipment.quantity > 0 ? Number(shipment.price) / Number(shipment.quantity) : 0,
                total: Number(shipment.price) || 0,
                shipment_id: shipment.id,
                customer: extractSalesChannel(shipment.note)
              };
              
              shipmentPartsByDate[date].push(partData);
            }
          }
          
          // 모든 비동기 작업이 완료될 때까지 대기
          await Promise.all(asyncTasks);
        }
        
        // 모든 작업이 완료되면 최종 데이터 반환
        return shipmentPartsByDate;
      }

      // 매출 데이터 처리를 위한 salesByDate 객체 초기화
      const salesByDate = {};

      // 날짜별 초기 데이터 구조 설정
      [...Object.keys(servicePartsByDate), ...Object.keys(shipmentPartsByDate)].forEach(date => {
        if (!salesByDate[date]) {
          salesByDate[date] = {
            date,
            serviceSales: 0,
            serviceSalesAS: 0,
            serviceSalesSell: 0,
            shipmentSales: 0,
            totalSales: 0,
            serviceCount: 0,
            shipmentCount: 0,
            customerSales: {} // 판매처별 매출 정보를 저장할 객체
          };
        }
      });

      // A/S 매출 데이터 처리
      Object.entries(servicePartsByDate).forEach(([date, parts]) => {
        // 중복되지 않는 service_id 집합 생성
        const uniqueServiceIds = new Set();
        
        parts.forEach(part => {
          const amount = Number(part.price || 0) * Number(part.quantity || 0);
          salesByDate[date].serviceSales += amount;
          if (part.usage === 'A/S') {
            salesByDate[date].serviceSalesAS += amount;
          } else if (part.usage === '판매') {
            salesByDate[date].serviceSalesSell += amount;
          }
          
          // service_id가 있으면 Set에 추가
          if (part.service_id) {
            uniqueServiceIds.add(part.service_id);
          }
        });
        
        // 중복되지 않는 A/S 건수 저장
        salesByDate[date].serviceCount = uniqueServiceIds.size;
      });

      // 출고 매출 데이터 처리 수정
      Object.entries(shipmentPartsByDate).forEach(([date, parts]) => {
        console.log(`${date} 출고 부품 처리:`, parts);
        let dailyShipmentSales = 0;
        
        // 중복되지 않는 shipment_id 집합 생성
        const uniqueShipmentIds = new Set();
        
        // 판매처별 매출 정보 임시 저장
        const customerSalesTemp = {};
        
        parts.forEach(part => {
          // 이미 part.total에 총액이 저장되어 있으므로 그대로 사용
          const amount = part.total;
          console.log(`${date} 출고 매출 계산:`, {
            제품명: part.name,
            수량: part.quantity,
            단가: part.price,
            총액: amount,
            판매처: part.customer
          });
          dailyShipmentSales += amount;
          
          // 판매처별 매출 추가
          if (!customerSalesTemp[part.customer]) {
            customerSalesTemp[part.customer] = 0;
          }
          customerSalesTemp[part.customer] += amount;
          
          // shipment_id가 있으면 Set에 추가
          if (part.shipment_id) {
            uniqueShipmentIds.add(part.shipment_id);
          }
        });
        
        salesByDate[date].shipmentSales = dailyShipmentSales;
        // 중복되지 않는 출고 건수 저장
        salesByDate[date].shipmentCount = uniqueShipmentIds.size;
        // 판매처별 매출 정보 저장
        salesByDate[date].customerSales = customerSalesTemp;
        
        console.log(`${date} 최종 출고 매출:`, dailyShipmentSales);
        console.log(`${date} 출고 건수:`, uniqueShipmentIds.size);
        console.log(`${date} 판매처별 매출:`, customerSalesTemp);
      });

      // 총계 계산
      Object.values(salesByDate).forEach(item => {
        item.totalSales = Number(item.serviceSales || 0) + Number(item.shipmentSales || 0);
      });

      // 날짜순으로 정렬
      const sortedData = Object.values(salesByDate).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      console.log('최종 정렬된 매출 데이터:', sortedData);

      // 총계 통계 계산
      const totalServiceSales = sortedData.reduce((sum, item) => sum + Number(item.serviceSales || 0), 0);
      const totalShipmentSales = sortedData.reduce((sum, item) => sum + Number(item.shipmentSales || 0), 0);
      const totalSales = totalServiceSales + totalShipmentSales;
      const totalServiceSalesAS = sortedData.reduce((sum, item) => sum + Number(item.serviceSalesAS || 0), 0);
      const totalServiceSalesSell = sortedData.reduce((sum, item) => sum + Number(item.serviceSalesSell || 0), 0);
      const totalServiceCount = sortedData.reduce((sum, item) => sum + Number(item.serviceCount || 0), 0);
      const totalShipmentCount = sortedData.reduce((sum, item) => sum + Number(item.shipmentCount || 0), 0);
      
      // 전체 판매처별 매출 합계 계산
      const totalCustomerSales = {};
      sortedData.forEach(item => {
        if (item.customerSales) {
          Object.entries(item.customerSales).forEach(([customer, amount]) => {
            if (!totalCustomerSales[customer]) {
              totalCustomerSales[customer] = 0;
            }
            totalCustomerSales[customer] += Number(amount || 0);
          });
        }
      });
      
      console.log('데이터 조회 완료');
      console.log(`조회된 레코드 수: ${sortedData.length}개`);
      console.log(`조회 기간: ${formattedStartDate} ~ ${formattedEndDate}`);
      console.log('====== 매출 데이터 조회 종료 ======');

      setTotalStats({
        totalServiceSales: Number(totalServiceSales || 0),
        totalShipmentSales: Number(totalShipmentSales || 0),
        totalSales: Number(totalSales || 0),
        totalServiceSalesAS: Number(totalServiceSalesAS || 0),
        totalServiceSalesSell: Number(totalServiceSalesSell || 0),
        totalServiceCount: Number(totalServiceCount || 0),
        totalShipmentCount: Number(totalShipmentCount || 0),
        totalCustomerSales
      });
      setSalesData(sortedData);

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
    return amount.toLocaleString('ko-KR') + '원';
  };

  const renderPartsDetail = () => {
    const dates = [...new Set([
      ...Object.keys(partsData.servicePartsByDate),
      ...Object.keys(partsData.shipmentPartsByDate)
    ])].sort();

    return (
      <Box>
        {dates.map(date => (
          <Box key={date} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              {date}
            </Typography>
            
            {/* A/S 부품 사용 내역 */}
            {partsData.servicePartsByDate[date]?.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon fontSize="small" />
                  A/S 부품 사용 내역
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>부품명</TableCell>
                        <TableCell>코드</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell align="right">단가</TableCell>
                        <TableCell align="right">금액</TableCell>
                        <TableCell>용도</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {partsData.servicePartsByDate[date].map((part, idx) => (
                        <TableRow key={`service-${idx}`}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.code}</TableCell>
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(part.price)}</TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                          <TableCell>{part.usage}</TableCell>
                        </TableRow>
                      ))}
                      {/* 용도별 합계 행 추가 */}
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right" sx={{ fontWeight: 600 }}>
                          용도별 합계
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(
                            partsData.servicePartsByDate[date].reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right">
                          A/S
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            partsData.servicePartsByDate[date]
                              .filter(part => part.usage === 'A/S')
                              .reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right">
                          판매
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            partsData.servicePartsByDate[date]
                              .filter(part => part.usage === '판매')
                              .reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right">
                          워런티
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            partsData.servicePartsByDate[date]
                              .filter(part => part.usage === '워런티')
                              .reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* 출고 부품 내역 */}
            {partsData.shipmentPartsByDate[date]?.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InventoryIcon fontSize="small" />
                  출고 부품 내역 (판매처별 집계 포함)
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>제품명</TableCell>
                        <TableCell>코드</TableCell>
                        <TableCell>판매처</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell align="right">단가</TableCell>
                        <TableCell align="right">금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {partsData.shipmentPartsByDate[date].map((part, idx) => (
                        <TableRow key={`shipment-${idx}`}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.code}</TableCell>
                          <TableCell>{part.customer}</TableCell>
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(part.price)}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                        </TableRow>
                      ))}
                      {/* 합계 행 추가 */}
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={5} align="right" sx={{ fontWeight: 600 }}>
                          합계
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(
                            partsData.shipmentPartsByDate[date].reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                      </TableRow>
                      
                      {/* 판매처별 합계 추가 */}
                      {(() => {
                        // 중복되지 않는 판매처 목록 생성
                        const customers = [...new Set(partsData.shipmentPartsByDate[date].map(part => part.customer))];
                        
                        // 판매처별 합계 계산
                        return customers.map(customer => {
                          const total = partsData.shipmentPartsByDate[date]
                            .filter(part => part.customer === customer)
                            .reduce((sum, part) => sum + part.total, 0);
                            
                          return (
                            <TableRow key={`customer-${customer}`} sx={{ bgcolor: '#f0f7fa' }}>
                              <TableCell colSpan={2} align="right" sx={{ color: '#1976d2' }}>
                                판매처 합계
                              </TableCell>
                              <TableCell sx={{ fontWeight: 500, color: '#1976d2' }}>
                                {customer}
                              </TableCell>
                              <TableCell colSpan={2} align="right">
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 500, color: '#1976d2' }}>
                                {formatCurrency(total)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
            
            <Divider sx={{ mt: 3 }} />
          </Box>
        ))}
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
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      A/S: {formatCurrency(totalStats.totalServiceSalesAS)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      판매: {formatCurrency(totalStats.totalServiceSalesSell)}
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
                      검수 건수: {totalStats.totalServiceCount}건
                    </Typography>
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
                      .sort((a, b) => b[1] - a[1])
                      .map(([customer, amount]) => (
                        <Grid item xs={12} sm={6} md={3} lg={2} key={customer}>
                          <Paper sx={{ p: 2, bgcolor: '#f9fafb', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {customer}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 500, color: '#1976d2', mt: 'auto' }}>
                              {formatCurrency(amount)}
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
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" name="A/S 매출(A/S)" dataKey="serviceSalesAS" fill="#8884d8" />
                    <Bar yAxisId="left" name="A/S 매출(판매)" dataKey="serviceSalesSell" fill="#82ca9d" />
                    <Bar yAxisId="left" name="출고 매출" dataKey="shipmentSales" fill="#ffc658" />
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
                      <TableCell align="right">A/S 매출(A/S)</TableCell>
                      <TableCell align="right">A/S 매출(판매)</TableCell>
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
                        <TableCell align="right">{formatCurrency(row.serviceSalesAS)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.serviceSalesSell)}</TableCell>
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