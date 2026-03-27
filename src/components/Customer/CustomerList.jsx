import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Link,
  Divider,
  CircularProgress,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Snackbar,
  Alert,
  TablePagination,
  DialogActions,
  DialogContentText,
  useMediaQuery,
  useTheme
} from '@mui/material';
import ResponsiveTable from '../common/ResponsiveTable';
import {
  Close as CloseIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { fetchFromSupabase } from '../../utils/restApiUtils';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { downloadExcel } from '../../utils/excelUtils';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { handlePhoneInput, normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phoneUtils';

function CustomerList({ refreshTrigger, onRefresh }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [shipmentHistory, setShipmentHistory] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('service');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [refreshTrigger]);

  useEffect(() => {
    setFilteredCustomers(customers);
  }, [customers]);

  const fetchCustomers = async () => {
    try {
      // 브라우저 오프라인 오작동으로 인한 차단 해제 (우회)
      /*
      if (isOffline()) {
        console.log('[CustomerList] 오프라인 상태 - 데이터 로딩 건너뛰기');
        setError('오프라인 상태입니다. 인터넷 연결을 확인해주세요.');
        setLoading(false);
        return;
      }
      */

      setLoading(true);
      
      // 안전한 재시도 로직 적용
      const [customersData, servicesData, shipmentsData] = await safeRetry(async () => {
        // 1. 고객 정보 조회 (REST API) - Egress 절감을 위해 limit 추가
        console.log('[CustomerList] Fetching customers via REST API...');
        const customers = await fetchFromSupabase('customers', {
          select: '*',
          order: 'updated_at.desc',
          limit: 1000
        });
        
        console.log('[CustomerList] Customers data received:', customers?.length || 0, 'items');

        // 2. A/S 서비스 데이터 조회 (REST API) - Egress 절감을 위해 limit 추가
        console.log('[CustomerList] Fetching services via REST API...');
        const services = await fetchFromSupabase('services', {
          select: 'customer_phone,customer_name,reception_date,brand,product_name',
          order: 'reception_date.desc',
          limit: 1000
        });
        
        console.log('[CustomerList] Services data received:', services?.length || 0, 'items');

        // 3. 출고 데이터 조회 (REST API) - Egress 절감을 위해 limit 추가
        console.log('[CustomerList] Fetching shipments via REST API...');
        const shipments = await fetchFromSupabase('shipments', {
          select: '*',
          order: 'shipment_date.desc',
          limit: 1000
        });
        
        console.log('[CustomerList] Shipments data received:', shipments?.length || 0, 'items');
        
        return [customers, services, shipments];
      }, {
        maxRetries: 3,
        maxTime: 30000,
        baseDelay: 1000
      });
      
      console.log('[CustomerList] Shipments data received:', shipmentsData?.length || 0, 'items');

      console.log('Services data:', servicesData); // 서비스 데이터 구조 확인
      console.log('Shipments data:', shipmentsData); // 출고 데이터 구조 확인

      // 4. 모든 고객 데이터 통합
      const allCustomers = new Map();

      // 기존 고객 데이터 추가
      customersData.forEach(customer => {
        allCustomers.set(customer.phone, {
          ...customer,
          serviceCount: {
            XRB: 0,
            NB: 0
          },
          lastServiceDate: null,
          recentTag: null,
          shipmentCount: 0,
          lastShipmentDate: null,
          brands: new Set(),
          recentModelName: ''
        });
      });

      // 서비스 데이터에서 고객 정보 추가/업데이트
      servicesData.forEach(service => {
        const phone = service.customer_phone;
        const name = service.customer_name;
        const brand = service.brand;
        const productName = service.product_name || '';
        
        if (!phone) return;
        
        if (!allCustomers.has(phone)) {
          allCustomers.set(phone, {
            phone: phone,
            name: name,
            serviceCount: {
              XRB: 0,
              NB: 0
            },
            lastServiceDate: null,
            recentTag: null,
            shipmentCount: 0,
            lastShipmentDate: null,
            brands: new Set(),
            recentModelName: ''
          });
        }
        
        const customer = allCustomers.get(phone);
        if (brand === 'XRB') {
          customer.serviceCount.XRB++;
        } else if (brand === 'NB') {
          customer.serviceCount.NB++;
        }
        
        if (brand) customer.brands.add(brand);
        
        if (!customer.lastServiceDate || service.reception_date > customer.lastServiceDate) {
          customer.lastServiceDate = service.reception_date;
          customer.recentTag = null; // REST API에서는 관계 데이터를 별도로 조회해야 함
          customer.recentModelName = productName;
        }
      });

      // 출고 데이터에서 고객 정보 추가/업데이트
      shipmentsData.forEach(shipment => {
        const phone = shipment.customer_phone;
        const name = shipment.customer_name;
        const brand = shipment.brand;
        const productName = shipment.product_name || '';
        
        if (!phone) return;
        
        if (!allCustomers.has(phone)) {
          allCustomers.set(phone, {
            phone: phone,
            name: name,
            serviceCount: {
              XRB: 0,
              NB: 0
            },
            lastServiceDate: null,
            recentTag: null,
            shipmentCount: 0,
            lastShipmentDate: null,
            brands: new Set(),
            recentModelName: ''
          });
        }
        
        const customer = allCustomers.get(phone);
        customer.shipmentCount++;
        if (brand) customer.brands.add(brand);
        
        // 최근 출고내역의 기종명 저장 (A/S 내역이 없을 때만)
        if (
          (!customer.lastServiceDate && (!customer.lastShipmentDate || shipment.shipment_date > customer.lastShipmentDate))
          || (!customer.recentModelName && shipment.shipment_date > (customer.lastShipmentDate || ''))
        ) {
          customer.lastShipmentDate = shipment.shipment_date;
          // shipment_parts에서 기체만 추출
          let modelName = '';
          if (shipment.shipment_parts && shipment.shipment_parts.length > 0) {
            const bodyPart = shipment.shipment_parts.find(p => p.part_category === '기체');
            modelName = bodyPart ? bodyPart.part_name : shipment.shipment_parts[0].part_name;
          } else {
            // fallback: 기존 product_name에서 첫 번째
            modelName = (shipment.product_name || '').split(',')[0].trim();
          }
          if (!customer.recentModelName) {
            customer.recentModelName = modelName;
          }
        }
      });

      // Set을 Array로 변환하여 저장
      const customersArray = Array.from(allCustomers.values()).map(customer => ({
        ...customer,
        brands: Array.from(customer.brands)
      }));

      console.log('All customers:', customersArray); // 최종 데이터 확인용
      setCustomers(customersArray);
      setFilteredCustomers(customersArray);
    } catch (err) {
      console.error('Error fetching customers:', err);
      
      // 스마트 오류 처리
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceHistory = async (phone) => {
    try {
      // A/S 이력 조회 (REST API)
      console.log('[CustomerList] Fetching service history via REST API for phone:', phone);
      const servicesData = await fetchFromSupabase('services', {
        select: '*',
        filter: `customer_phone=eq.${encodeURIComponent(phone)}`,
        order: 'reception_date.desc'
      });

      // 출고 이력 조회 (REST API)
      console.log('[CustomerList] Fetching shipment history via REST API for phone:', phone);
      const shipmentsData = await fetchFromSupabase('shipments', {
        select: '*',
        filter: `customer_phone=eq.${encodeURIComponent(phone)}`,
        order: 'shipment_date.desc'
      });
      
      console.log('[CustomerList] Service history:', servicesData?.length || 0, 'items');
      console.log('[CustomerList] Shipment history:', shipmentsData?.length || 0, 'items');

      // 태그 데이터 처리
      const servicesWithTags = servicesData.map(service => ({
        ...service,
        tags: [] // REST API에서는 관계 데이터를 별도로 조회해야 함
      }));

      setServiceHistory(servicesWithTags);
      setShipmentHistory(shipmentsData);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.message);
    }
  };

  const handleCustomerClick = async (customer) => {
    setSelectedCustomer(customer);
    setOpenDialog(true);
    await fetchServiceHistory(customer.phone);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '접수': return 'default';
      case '처리중': return 'primary';
      case '부분완료': return 'warning';
      case '완료': return 'success';
      default: return 'default';
    }
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'V1': return {
        color: '#3182f6',
        bgcolor: '#e8f1fd'
      };
      case 'V2': return {
        color: '#3182f6',
        bgcolor: '#f2f4f6'
      };
      case 'V3': return {
        color: '#3182f6',
        bgcolor: '#ffffff'
      };
      default: return {
        color: '#3182f6',
        bgcolor: '#ffffff'
      };
    }
  };

  const handleGradeChange = async (phone, newGrade) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ grade: newGrade })
        .eq('phone', phone);

      if (error) throw error;

      // 로컬 상태 업데이트
      setCustomers(prevCustomers => 
        prevCustomers.map(customer => 
          customer.phone === phone 
            ? { ...customer, grade: newGrade }
            : customer
        )
      );
    } catch (err) {
      console.error('Error updating customer grade:', err);
    }
  };

  // 검색어 입력 처리 함수
  const handleSearchInput = (event) => {
    setInputValue(event.target.value);
  };

  // 검색 실행 함수
  const executeSearch = () => {
    const term = inputValue.toLowerCase().trim();
    setSearchTerm(term);
    setPage(0); // 검색 시 페이지 번호 초기화

    if (!term) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(customer => {
      const nameMatch = customer.name?.toLowerCase().includes(term);
      const phoneMatch = customer.phone?.toLowerCase().replace(/-/g, '').includes(term.replace(/-/g, ''));
      const addressMatch = customer.address?.toLowerCase().includes(term);
      const brandMatch = customer.brands?.some(brand => brand.toLowerCase().includes(term));
      
      return nameMatch || phoneMatch || addressMatch || brandMatch;
    });
    
    setFilteredCustomers(filtered);
  };

  // 엔터키 처리 함수
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      executeSearch();
    }
  };

  // A/S 등록 페이지로 이동하는 함수 수정
  const handleAddService = (customer) => {
    // URL 쿼리 파라미터로 고객 정보 전달
    const queryParams = new URLSearchParams({
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    }).toString();
    
    // 경로 수정: /services -> /add-service
    navigate(`/add-service?${queryParams}`);
  };

  // 출고 등록 페이지로 이동하는 함수 수정
  const handleAddShipment = (customer) => {
    // URL 쿼리 파라미터로 고객 정보 전달
    const queryParams = new URLSearchParams({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      autoOpen: 'true'
    }).toString();
    
    navigate(`/shipments?${queryParams}`);
  };

  // 고객 A/S 이력 페이지로 이동하는 함수 수정
  const handleRowClick = (customer) => {
    // URL 쿼리 파라미터로 고객 정보 전달
    const queryParams = new URLSearchParams({
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    }).toString();
    
    navigate(`/customer-management?${queryParams}`);
  };

  // 고객 정보 수정 다이얼로그 열기
  const handleEditClick = (customer, e) => {
    e.stopPropagation();
    setEditCustomerData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    });
    setEditDialogOpen(true);
  };

  // 고객 정보 수정 입력 처리
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      // 전화번호 입력 시 한글 자모 변환 및 형식 정규화
      const normalizedPhone = handlePhoneInput(value);
      setEditCustomerData(prev => ({
        ...prev,
        [name]: normalizedPhone
      }));
    } else {
      setEditCustomerData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // 고객 정보 수정 제출
  const handleEditSubmit = async () => {
    try {
      // 전화번호 유효성 검사
      if (!isValidPhoneNumber(editCustomerData.phone)) {
        setSnackbar({
          open: true,
          message: '올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)',
          severity: 'error'
        });
        return;
      }
      
      const normalizedPhone = normalizePhoneNumber(editCustomerData.phone);
      
      const { error } = await supabase
        .from('customers')
        .upsert({
          phone: normalizedPhone,
          name: editCustomerData.name,
          address: editCustomerData.address
        });

      if (error) throw error;

      setSnackbar({
        open: true,
        message: '고객 정보가 수정되었습니다.',
        severity: 'success'
      });

      setEditDialogOpen(false);
      fetchCustomers(); // 목록 새로고침
    } catch (err) {
      console.error('Error updating customer:', err);
      setSnackbar({
        open: true,
        message: '고객 정보 수정 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 고객 삭제 처리
  const handleDeleteCustomer = async () => {
    try {
      // 한글 자모가 포함된 경우 오류 메시지 표시
      if (/[ㄱ-ㅎㅏ-ㅣ]/.test(editCustomerData.phone)) {
        setSnackbar({
          open: true,
          message: '전화번호에 한글 자모가 포함되어 있습니다. 숫자로 입력해주세요.',
          severity: 'error'
        });
        return;
      }
      
      const normalizedPhone = normalizePhoneNumber(editCustomerData.phone);
      console.log('[CustomerList] 삭제 시도 - 고객 전화번호:', normalizedPhone);
      
      if (!normalizedPhone) {
        setSnackbar({
          open: true,
          message: '올바른 전화번호를 입력해주세요.',
          severity: 'error'
        });
        return;
      }
      
      // 삭제 전 고객 존재 확인 - 정규화된 전화번호와 원본 전화번호 모두 시도
      let existingCustomer = null;
      let checkError = null;
      
      // 먼저 정규화된 전화번호로 검색
      const { data: normalizedResult, error: normalizedError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', normalizedPhone)
        .single();
      
      if (normalizedResult) {
        existingCustomer = normalizedResult;
      } else {
        // 정규화된 전화번호로 찾지 못한 경우 원본 전화번호로 검색
        const { data: originalResult, error: originalError } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', editCustomerData.phone)
          .single();
        
        existingCustomer = originalResult;
        checkError = originalError;
      }

      if (checkError) {
        console.error('[CustomerList] 고객 확인 오류:', checkError);
        throw new Error('고객 정보를 확인할 수 없습니다.');
      }

      if (!existingCustomer) {
        throw new Error('삭제할 고객을 찾을 수 없습니다.');
      }

      console.log('[CustomerList] 삭제할 고객 정보:', existingCustomer);

      // 고객 삭제 - 정규화된 전화번호와 원본 전화번호 모두 시도
      let deleteError = null;
      let deleteCount = null;
      
      // 먼저 정규화된 전화번호로 삭제 시도
      const { error: normalizedDeleteError, count: normalizedCount } = await supabase
        .from('customers')
        .delete()
        .eq('phone', normalizedPhone);
      
      if (normalizedDeleteError) {
        // 정규화된 전화번호로 삭제 실패한 경우 원본 전화번호로 삭제 시도
        const { error: originalDeleteError, count: originalCount } = await supabase
          .from('customers')
          .delete()
          .eq('phone', editCustomerData.phone);
        
        deleteError = originalDeleteError;
        deleteCount = originalCount;
      } else {
        deleteCount = normalizedCount;
      }

      if (deleteError) {
        console.error('[CustomerList] 삭제 오류:', deleteError);
        throw deleteError;
      }

      console.log('[CustomerList] 삭제 결과 - 삭제된 행 수:', deleteCount);

      // 삭제 확인 - 정규화된 전화번호와 원본 전화번호 모두 확인
      const { data: normalizedCheck, error: normalizedVerifyError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', normalizedPhone);
      
      const { data: originalCheck, error: originalVerifyError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', editCustomerData.phone);
      
      const deletedCheck = [...(normalizedCheck || []), ...(originalCheck || [])];
      const verifyError = normalizedVerifyError || originalVerifyError;

      if (verifyError) {
        console.error('[CustomerList] 삭제 확인 오류:', verifyError);
      } else {
        console.log('[CustomerList] 삭제 확인 - 남은 고객 수:', deletedCheck?.length || 0);
      }

      // 스낵바 메시지 표시
      setSnackbar({
        open: true,
        message: `고객이 성공적으로 삭제되었습니다. (삭제된 행: ${deleteCount || 0}개)`,
        severity: 'success'
      });

      // 로컬 상태에서 고객 제거 - 정규화된 전화번호와 원본 전화번호 모두 제거
      setCustomers(prevCustomers => 
        prevCustomers.filter(customer => 
          customer.phone !== normalizedPhone && customer.phone !== editCustomerData.phone
        )
      );
      setFilteredCustomers(prevFiltered => 
        prevFiltered.filter(customer => 
          customer.phone !== normalizedPhone && customer.phone !== editCustomerData.phone
        )
      );

      // 다이얼로그 닫기
      setDeleteConfirmOpen(false);
      setEditDialogOpen(false);

      // 부모 컴포넌트에 새로고침 알림
      if (onRefresh) {
        onRefresh();
      }

    } catch (err) {
      console.error('[CustomerList] 고객 삭제 실패:', err);
      setSnackbar({
        open: true,
        message: `고객 삭제 중 오류가 발생했습니다: ${err.message}`,
        severity: 'error'
      });
    }
  };

  // 페이지 변경 핸들러
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 페이지당 행 수 변경 핸들러
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 현재 페이지에 표시할 데이터 계산
  const paginatedCustomers = filteredCustomers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4, color: 'error.main' }}>
        에러가 발생했습니다: {error}
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: '1800px', 
      width: 'auto', 
      mx: 'auto',
      p: { xs: 1, sm: 3 }
    }}>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="이름, 연락처, 제품으로 검색"
          value={inputValue}
          onChange={handleSearchInput}
          onKeyPress={handleKeyPress}
          sx={{ mb: 2 }}
          size={isMobile ? 'small' : 'medium'}
        />
      </Box>
      
      {isMobile ? (
        // 모바일: 카드 형태로 표시
        <Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : filteredCustomers.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography>검색 결과가 없습니다.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {paginatedCustomers.map((customer) => (
                <Card
                  key={customer.phone}
                  onClick={() => handleCustomerClick(customer)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 3
                    }
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      {/* 이름과 연락처 */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            {customer.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {customer.phone}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="고객정보 수정">
                            <IconButton 
                              size="small" 
                              onClick={(e) => handleEditClick(customer, e)}
                            >
                              <PersonIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="A/S 등록">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddService(customer);
                              }}
                            >
                              <BuildIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="출고 등록">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddShipment(customer);
                              }}
                            >
                              <LocalShippingIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                      
                      <Divider />
                      
                      {/* 최근 A/S */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          최근 A/S
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">
                            {customer.lastServiceDate ? new Date(customer.lastServiceDate).toLocaleDateString() : '-'}
                          </Typography>
                          {customer.recentTag && (
                            <Chip 
                              label={customer.recentTag}
                              size="small"
                              sx={{
                                height: '20px',
                                fontSize: '0.7rem',
                                bgcolor: 'primary.lighter',
                                color: 'primary.main'
                              }}
                            />
                          )}
                        </Stack>
                      </Box>
                      
                      {/* 최근 기종명 */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          최근 기종명
                        </Typography>
                        <Typography variant="body2">
                          {customer.recentModelName || '-'}
                        </Typography>
                      </Box>
                      
                      {/* 최근 출고 */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          최근 출고
                        </Typography>
                        <Typography variant="body2">
                          {customer.lastShipmentDate ? new Date(customer.lastShipmentDate).toLocaleDateString() : '-'}
                        </Typography>
                      </Box>
                      
                      {/* 건수 */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          건수
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title={`A/S 건수: ${customer.serviceCount.XRB + customer.serviceCount.NB || 0}`} arrow>
                            <Chip
                              label={
                                <>
                                  <span style={{fontWeight:700, fontSize:'0.85rem'}}>A/S</span> <span style={{fontWeight:700, fontSize:'1rem'}}>{customer.serviceCount.XRB + customer.serviceCount.NB || 0}</span>
                                </>
                              }
                              size="small"
                              sx={{
                                bgcolor: '#e3f2fd',
                                color: '#1976d2',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                borderRadius: '16px',
                                px: 1.5,
                                height: 28
                              }}
                            />
                          </Tooltip>
                          <Tooltip title={`출고 건수: ${customer.shipmentCount || 0}`} arrow>
                            <Chip
                              label={
                                <>
                                  <span style={{fontWeight:700, fontSize:'0.85rem'}}>출고</span> <span style={{fontWeight:700, fontSize:'1rem'}}>{customer.shipmentCount || 0}</span>
                                </>
                              }
                              size="small"
                              sx={{
                                bgcolor: '#e8f5e9',
                                color: '#388e3c',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                borderRadius: '16px',
                                px: 1.5,
                                height: 28
                              }}
                            />
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      ) : (
        // 데스크톱: 테이블 형태로 표시
        <TableContainer component={Paper}>
          <Table sx={{ '& .MuiTableCell-root': { fontSize: '1rem' } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>이름</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>연락처</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>최근 A/S</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>최근 기종명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>최근 출고</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>건수</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="error">{error}</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    검색 결과가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((customer) => (
                  <TableRow 
                    key={customer.phone}
                    onClick={() => handleCustomerClick(customer)}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>{customer.name}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{customer.phone}</TableCell>
                    <TableCell>
                      <Stack direction="column" spacing={0.5}>
                        <Typography variant="body2">
                          {customer.lastServiceDate ? new Date(customer.lastServiceDate).toLocaleDateString() : '-'}
                        </Typography>
                        {customer.recentTag && (
                          <Chip 
                            label={customer.recentTag}
                            size="small"
                            sx={{
                              height: '20px',
                              fontSize: '0.75rem',
                              bgcolor: 'primary.lighter',
                              color: 'primary.main'
                            }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {customer.recentModelName || '-'}
                    </TableCell>
                    <TableCell>
                      {customer.lastShipmentDate ? new Date(customer.lastShipmentDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={`A/S 건수: ${customer.serviceCount.XRB + customer.serviceCount.NB || 0}`} arrow>
                          <Chip
                            label={
                              <>
                                <span style={{fontWeight:700, fontSize:'0.9rem'}}>A/S</span> <span style={{fontWeight:700, fontSize:'1.1rem'}}>{customer.serviceCount.XRB + customer.serviceCount.NB || 0}</span>
                              </>
                            }
                            size="small"
                            sx={{
                              bgcolor: '#e3f2fd',
                              color: '#1976d2',
                              fontWeight: 700,
                              fontSize: '1rem',
                              borderRadius: '16px',
                              px: 1.5,
                              height: 28
                            }}
                          />
                        </Tooltip>
                        <Tooltip title={`출고 건수: ${customer.shipmentCount || 0}`} arrow>
                          <Chip
                            label={
                              <>
                                <span style={{fontWeight:700, fontSize:'0.9rem'}}>출고</span> <span style={{fontWeight:700, fontSize:'1.1rem'}}>{customer.shipmentCount || 0}</span>
                              </>
                            }
                            size="small"
                            sx={{
                              bgcolor: '#e8f5e9',
                              color: '#388e3c',
                              fontWeight: 700,
                              fontSize: '1rem',
                              borderRadius: '16px',
                              px: 1.5,
                              height: 28
                            }}
                          />
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="고객정보 수정">
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleEditClick(customer, e)}
                          >
                            <PersonIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="A/S 등록">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddService(customer);
                            }}
                          >
                            <BuildIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="출고 등록">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddShipment(customer);
                            }}
                          >
                            <LocalShippingIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 페이지네이션 추가 */}
      <TablePagination
        component="div"
        count={filteredCustomers.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="페이지당 행 수"
        labelDisplayedRows={({ from, to, count }) => 
          `${count}개 중 ${from}-${to}`
        }
        sx={{
          '.MuiTablePagination-select': {
            paddingTop: '6px',
            paddingBottom: '6px',
          },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontSize: '0.875rem',
          }
        }}
      />

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedCustomer && (
          <>
            <DialogTitle sx={{ borderBottom: '1px solid #eee', pb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedCustomer.name}
                  </Typography>
                </Stack>
                <IconButton onClick={() => setOpenDialog(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              {/* 기본 정보 */}
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="subtitle2" color="text.secondary">연락처</Typography>
                    <Typography variant="body1">{selectedCustomer.phone}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="subtitle2" color="text.secondary">A/S 건수</Typography>
                    <Typography variant="body1">{selectedCustomer.serviceCount.XRB + selectedCustomer.serviceCount.NB || 0}건</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="subtitle2" color="text.secondary">출고 건수</Typography>
                    <Typography variant="body1">{selectedCustomer.shipmentCount || 0}건</Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* 탭 메뉴 */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs 
                  value={activeTab} 
                  onChange={(e, newValue) => setActiveTab(newValue)}
                  sx={{
                    '& .MuiTab-root': {
                      minWidth: 120,
                      fontWeight: 600
                    }
                  }}
                >
                  <Tab 
                    value="service" 
                    label={`A/S 이력 (${serviceHistory.length})`} 
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Tab 
                    value="shipment" 
                    label={`출고 이력 (${shipmentHistory.length})`} 
                    sx={{ fontWeight: 'bold' }}
                  />
                </Tabs>
              </Box>

              {/* A/S 이력 */}
              {activeTab === 'service' && (
                <Box>
                  {serviceHistory.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>접수일</TableCell>
                          <TableCell>문의내용</TableCell>
                          <TableCell>상태</TableCell>
                          <TableCell>태그</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {serviceHistory.map((service, index) => (
                          <TableRow key={index} hover>
                            <TableCell>
                              {new Date(service.reception_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{service.symptom}</TableCell>
                            <TableCell>
                              <Chip 
                                label={service.status} 
                                color={getStatusColor(service.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                {service.tags?.map((tag, idx) => (
                                  <Chip 
                                    key={idx} 
                                    label={tag} 
                                    size="small"
                                    sx={{
                                      height: '20px',
                                      fontSize: '0.75rem',
                                      bgcolor: 'primary.lighter',
                                      color: 'primary.main'
                                    }}
                                  />
                                ))}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                      A/S 이력이 없습니다.
                    </Box>
                  )}
                </Box>
              )}

              {/* 출고 이력 */}
              {activeTab === 'shipment' && (
                <Box>
                  {shipmentHistory.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>출고일</TableCell>
                          <TableCell>제품</TableCell>
                          <TableCell>상태</TableCell>
                          <TableCell>메모</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shipmentHistory.map((shipment, index) => (
                          <TableRow key={index} hover>
                            <TableCell>
                              {new Date(shipment.shipment_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{shipment.product_name}</TableCell>
                            <TableCell>
                              <Chip 
                                label={shipment.status} 
                                color={getStatusColor(shipment.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{shipment.memo || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                      출고 이력이 없습니다.
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* 고객정보 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>고객 정보 수정</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="이름"
            name="name"
            value={editCustomerData.name}
            onChange={handleEditInputChange}
            fullWidth
          />
          <TextField
            margin="dense"
            label="전화번호"
            name="phone"
            value={editCustomerData.phone}
            onChange={handleEditInputChange}
            fullWidth
            disabled
          />
          <TextField
            margin="dense"
            label="주소"
            name="address"
            value={editCustomerData.address}
            onChange={handleEditInputChange}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(true)} color="error">
            삭제
          </Button>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button onClick={handleEditSubmit} color="primary">
            수정
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>고객 삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText>
            정말로 이 고객을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button onClick={handleDeleteCustomer} color="error" autoFocus>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{
            width: '100%',
            bgcolor: snackbar.severity === 'success' ? '#3182f6' : '#f04452',
            color: 'white',
            '& .MuiAlert-icon': {
              color: 'white'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}

export default CustomerList;
