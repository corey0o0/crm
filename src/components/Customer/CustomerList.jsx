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
  CardContent
} from '@mui/material';
import {
  Close as CloseIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

function CustomerList() {
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    setFilteredCustomers(customers);
  }, [customers]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      // 서비스 데이터와 태그 정보 함께 조회
      const { data: servicesData, error } = await supabase
        .from('services')
        .select(`
          customer_name,
          customer_phone,
          customer_address,
          reception_date,
          service_tags (
            tag_name
          )
        `)
        .order('reception_date', { ascending: false });

      if (error) throw error;

      // 고객별 최근 A/S 정보, 건수, 첫 번째 태그를 포함한 목록 생성
      const uniqueCustomers = servicesData.reduce((acc, curr) => {
        const existingCustomer = acc.find(c => c.phone === curr.customer_phone);
        if (!existingCustomer) {
          acc.push({
            name: curr.customer_name,
            phone: curr.customer_phone,
            address: curr.customer_address,
            lastServiceDate: curr.reception_date,
            serviceCount: 1,
            recentTag: curr.service_tags?.[0]?.tag_name || null
          });
        } else {
          existingCustomer.serviceCount += 1;
        }
        return acc;
      }, []);

      // 고객 등급 정보 가져오기
      const { data: customerGrades, error: gradesError } = await supabase
        .from('customers')
        .select('phone, grade');

      if (gradesError) throw gradesError;

      // 등급 정보 병합
      const customersWithGrades = uniqueCustomers.map(customer => {
        const gradeInfo = customerGrades?.find(g => g.phone === customer.phone);
        return {
          ...customer,
          grade: gradeInfo?.grade || 'V3'
        };
      });

      setCustomers(customersWithGrades);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceHistory = async (phone) => {
    try {
      // A/S 이력 조회
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          service_tags (
            tag_name
          )
        `)
        .eq('customer_phone', phone)
        .order('reception_date', { ascending: false });

      if (servicesError) throw servicesError;

      // 출고 이력 조회
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .eq('customer_phone', phone)
        .order('shipment_date', { ascending: false });

      if (shipmentsError) throw shipmentsError;

      // 태그 데이터 처리
      const servicesWithTags = servicesData.map(service => ({
        ...service,
        tags: service.service_tags?.map(t => t.tag_name) || []
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

  // 검색어 처리 함수
  const handleSearch = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);

    const filtered = customers.filter(customer => 
      customer.name.toLowerCase().includes(term) ||
      customer.phone.toLowerCase().includes(term) ||
      customer.address.toLowerCase().includes(term)
    );
    setFilteredCustomers(filtered);
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

  // 고객 A/S 이력 페이지로 이동하는 함수 추가
  const handleRowClick = (customer) => {
    // URL 쿼리 파라미터로 고객 정보 전달
    const queryParams = new URLSearchParams({
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    }).toString();
    
    navigate(`/services?${queryParams}`);
  };

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
    <Box>
      {/* 헤더 영역 */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" sx={{ 
            color: 'text.primary',
            fontWeight: 600,
          }}>
            고객 관리
          </Typography>
        </Stack>
      </Box>

      {/* 검색 및 필터 영역 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="고객명, 연락처, 주소 검색..."
          value={searchTerm}
          onChange={handleSearch}
          sx={{ 
            flexGrow: 1,
            bgcolor: 'background.paper',
            '& .MuiOutlinedInput-root': {
              '&:hover': {
                bgcolor: '#f2f4f6'
              }
            }
          }}
        />
      </Box>

      {/* 고객 목록 테이블 */}
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="15%">고객명</TableCell>
              <TableCell width="15%">연락처</TableCell>
              <TableCell width="50%">최근 이력</TableCell>
              <TableCell width="20%" align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow 
                key={customer.phone} 
                hover 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={() => handleRowClick(customer)}
              >
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        최근 A/S: {customer.lastServiceDate 
                          ? new Date(customer.lastServiceDate).toLocaleDateString()
                          : '-'}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'primary.main',
                          bgcolor: 'primary.lighter',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.75rem'
                        }}
                      >
                        총 {customer.serviceCount}건
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
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: getGradeColor(customer.grade).color,
                          bgcolor: getGradeColor(customer.grade).bgcolor,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.75rem'
                        }}
                      >
                        {customer.grade}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {customer.address}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddService(customer);
                      }}
                      startIcon={<BuildIcon />}
                      size="small"
                      variant="outlined"
                      sx={{
                        '&:hover': { bgcolor: 'primary.lighter' }
                      }}
                    >
                      A/S 등록
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddShipment(customer);
                      }}
                      startIcon={<AddIcon />}
                      size="small"
                      variant="outlined"
                      color="success"
                      sx={{
                        '&:hover': { bgcolor: 'success.lighter' }
                      }}
                    >
                      출고 등록
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* A/S 이력 다이얼로그 */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedCustomer?.name} 고객님의 A/S 이력
            </Typography>
            <IconButton onClick={() => setOpenDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* 고객 정보 요약 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              연락처: {selectedCustomer?.phone} | 주소: {selectedCustomer?.address}
            </Typography>
          </Box>

          {/* 탭 추가 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
              <Tab label="A/S 이력" value="service" />
              <Tab label="출고 이력" value="shipment" />
            </Tabs>
          </Box>

          {/* A/S 이력 테이블 */}
          {activeTab === 'service' && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>접수일</TableCell>
                    <TableCell>제품</TableCell>
                    <TableCell>증상</TableCell>
                    <TableCell>주행거리</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell>태그</TableCell>
                    <TableCell align="center">상세</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {serviceHistory.map((service) => (
                    <TableRow key={service.id} hover>
                      <TableCell>
                        {new Date(service.reception_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{service.product_name}</TableCell>
                      <TableCell>{service.symptom}</TableCell>
                      <TableCell>{service.mileage ? `${service.mileage}km` : '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={service.status}
                          size="small"
                          color={getStatusColor(service.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {service.tags?.map((tag, index) => (
                            <Chip
                              key={index}
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
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          component={RouterLink}
                          to={`/services/${service.id}`}
                          size="small"
                          sx={{ color: 'primary.main' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {serviceHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        A/S 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* 출고 이력 테이블 */}
          {activeTab === 'shipment' && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>출고일</TableCell>
                    <TableCell>제품</TableCell>
                    <TableCell>수량</TableCell>
                    <TableCell>배송방법</TableCell>
                    <TableCell>상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shipmentHistory.map((shipment) => (
                    <TableRow key={shipment.id} hover>
                      <TableCell>
                        {new Date(shipment.shipment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{shipment.product_name}</TableCell>
                      <TableCell>{shipment.quantity}</TableCell>
                      <TableCell>{shipment.delivery_method}</TableCell>
                      <TableCell>
                        <Chip
                          label={shipment.status}
                          size="small"
                          color={getStatusColor(shipment.status)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {shipmentHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        출고 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default CustomerList;
