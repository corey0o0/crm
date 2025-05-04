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
  ButtonGroup
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

function SalesStats() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [brand, setBrand] = useState('전체');
  const [salesData, setSalesData] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalServiceSales: 0,
    totalShipmentSales: 0,
    totalSales: 0
  });
  const [partsData, setPartsData] = useState({
    servicePartsByDate: {},
    shipmentPartsByDate: {}
  });
  const brandOptions = ['전체', 'XRB', 'NB'];
  const currentMonth = getMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // 월별 버튼 클릭 핸들러
  const handleMonthSelect = (monthIndex) => {
    const now = new Date();
    const selectedMonthDate = setMonth(now, monthIndex);
    
    // 선택된 월 상태 업데이트
    setSelectedMonth(monthIndex);
    
    // 해당 월의 시작일과 종료일 설정
    const newStartDate = startOfMonth(selectedMonthDate);
    const newEndDate = endOfMonth(selectedMonthDate);
    
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const fetchSalesData = async () => {
    try {
      setLoading(true);

      // A/S 부품 데이터 조회
      let servicePartsQuery = supabase
        .from('service_parts')
        .select(`
          price,
          quantity,
          usage,
          services!inner (
            reception_date,
            brand
          ),
          parts!inner (
            name,
            code
          )
        `)
        .gte('services.reception_date', format(startDate, 'yyyy-MM-dd'))
        .lte('services.reception_date', format(endDate, 'yyyy-MM-dd'));
      
      if (brand !== '전체') {
        servicePartsQuery = servicePartsQuery.eq('services.brand', brand);
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
            const date = format(parseISO(item.services.reception_date), 'yyyy-MM-dd');
            if (!servicePartsByDate[date]) {
              servicePartsByDate[date] = [];
            }
            servicePartsByDate[date].push({
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
          shipment_date,
          product_name,
          quantity,
          price,
          status
        `)
        .gte('shipment_date', format(startDate, 'yyyy-MM-dd'))
        .lte('shipment_date', format(endDate, 'yyyy-MM-dd'));

      if (brand !== '전체') {
        shipmentQuery = shipmentQuery.eq('brand', brand);
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
                shipment_date,
                brand
              )
            `)
            .gte('shipments.shipment_date', format(startDate, 'yyyy-MM-dd'))
            .lte('shipments.shipment_date', format(endDate, 'yyyy-MM-dd'));

          if (brand !== '전체') {
            shipmentPartsQuery = shipmentPartsQuery.eq('shipments.brand', brand);
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
              const date = format(parseISO(part.shipments.shipment_date), 'yyyy-MM-dd');
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
                shipment_id: part.shipment_id
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
            const date = format(parseISO(shipment.shipment_date), 'yyyy-MM-dd');
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
                        shipment_id: shipment.id
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
                        shipment_id: shipment.id
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
                      shipment_id: shipment.id
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
                shipment_id: shipment.id
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
            totalSales: 0
          };
        }
      });

      // A/S 매출 데이터 처리
      Object.entries(servicePartsByDate).forEach(([date, parts]) => {
        parts.forEach(part => {
          const amount = Number(part.price || 0) * Number(part.quantity || 0);
          salesByDate[date].serviceSales += amount;
          if (part.usage === 'A/S') {
            salesByDate[date].serviceSalesAS += amount;
          } else if (part.usage === '판매') {
            salesByDate[date].serviceSalesSell += amount;
          }
        });
      });

      // 출고 매출 데이터 처리 수정
      Object.entries(shipmentPartsByDate).forEach(([date, parts]) => {
        console.log(`${date} 출고 부품 처리:`, parts);
        let dailyShipmentSales = 0;
        parts.forEach(part => {
          // 이미 part.total에 총액이 저장되어 있으므로 그대로 사용
          const amount = part.total;
          console.log(`${date} 출고 매출 계산:`, {
            제품명: part.name,
            수량: part.quantity,
            단가: part.price,
            총액: amount
          });
          dailyShipmentSales += amount;
        });
        salesByDate[date].shipmentSales = dailyShipmentSales;
        console.log(`${date} 최종 출고 매출:`, dailyShipmentSales);
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

      console.log('최종 집계:', {
        서비스매출: totalServiceSales,
        출고매출: totalShipmentSales,
        총매출: totalSales
      });

      setTotalStats({
        totalServiceSales: Number(totalServiceSales || 0),
        totalShipmentSales: Number(totalShipmentSales || 0),
        totalSales: Number(totalSales || 0),
        totalServiceSalesAS: Number(totalServiceSalesAS || 0),
        totalServiceSalesSell: Number(totalServiceSalesSell || 0)
      });
      setSalesData(sortedData);

    } catch (error) {
      console.error('데이터 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [startDate, endDate, brand]);

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
                  출고 부품 내역
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>제품명</TableCell>
                        <TableCell>코드</TableCell>
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
                          <TableCell align="right">{part.quantity}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(part.price)}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(part.total)}</TableCell>
                        </TableRow>
                      ))}
                      {/* 합계 행 추가 */}
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell colSpan={4} align="right" sx={{ fontWeight: 600 }}>
                          합계
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(
                            partsData.shipmentPartsByDate[date].reduce((sum, part) => sum + part.total, 0)
                          )}
                        </TableCell>
                      </TableRow>
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          매출 통계
        </Typography>

        {/* 기간 + 브랜드 선택 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          {/* 월별 버튼 그룹 추가 */}
          <Box sx={{ mb: 2 }}>
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
              <Autocomplete
                options={brandOptions}
                value={brand}
                onChange={(_, newValue) => setBrand(newValue || '전체')}
                renderInput={(params) => (
                  <TextField {...params} label="브랜드" size="small" fullWidth />
                )}
                disableClearable
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                variant="contained"
                onClick={fetchSalesData}
                sx={{ 
                  height: '40px',
                  bgcolor: '#3182f6',
                  '&:hover': { bgcolor: '#1b64da' }
                }}
                fullWidth
              >
                조회
              </Button>
            </Grid>
            {/* 매출 재계산 버튼 추가 */}
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={fetchSalesData}
                sx={{ height: '40px', borderColor: '#3182f6', color: '#3182f6' }}
                fullWidth
              >
                매출 재계산
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 총계 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
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
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  총 매출
                </Typography>
                <Typography variant="h5" component="div">
                  {formatCurrency(totalStats.totalSales)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

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
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar name="A/S 매출(A/S)" dataKey="serviceSalesAS" fill="#8884d8" />
                    <Bar name="A/S 매출(판매)" dataKey="serviceSalesSell" fill="#82ca9d" />
                    <Bar name="출고 매출" dataKey="shipmentSales" fill="#ffc658" />
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
                      <TableCell align="right">출고 매출</TableCell>
                      <TableCell align="right">총계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesData.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell align="right">{formatCurrency(row.serviceSalesAS)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.serviceSalesSell)}</TableCell>
                        <TableCell align="right">{formatCurrency(row.shipmentSales)}</TableCell>
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