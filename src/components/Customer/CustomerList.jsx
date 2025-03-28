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
  Grid
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
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="고객명, 연락처, 주소로 검색"
          value={searchTerm}
          onChange={handleSearch}
          sx={{ mb: 2 }}
        />
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>고객명</TableCell>
              <TableCell>연락처</TableCell>
              <TableCell>주소</TableCell>
              <TableCell>등급</TableCell>
              <TableCell>최근 A/S</TableCell>
              <TableCell>A/S 건수</TableCell>
              <TableCell align="center">관리</TableCell>
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
              filteredCustomers.map((customer) => (
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
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.address}</TableCell>
                  <TableCell>
                    <FormControl size="small">
                      <Select
                        value={customer.grade || 'V3'}
                        onChange={(e) => {
                          e.stopPropagation(); // 이벤트 버블링 방지
                          handleGradeChange(customer.phone, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()} // 클릭 이벤트 버블링 방지
                        sx={(theme) => ({
                          ...getGradeColor(customer.grade),
                          minWidth: 100,
                          '& .MuiSelect-select': {
                            py: 1
                          }
                        })}
                      >
                        <MenuItem value="V1">V1 (VIP)</MenuItem>
                        <MenuItem value="V2">V2 (우수)</MenuItem>
                        <MenuItem value="V3">V3 (일반)</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    {customer.lastServiceDate ? new Date(customer.lastServiceDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{customer.serviceCount || 0}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
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
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedCustomer && (
          <>
            <DialogTitle>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">
                  고객 상세 정보
                </Typography>
                <IconButton onClick={() => setOpenDialog(false)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      기본 정보
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          고객명
                        </Typography>
                        <Typography variant="body1">
                          {selectedCustomer.name}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          연락처
                        </Typography>
                        <Typography variant="body1">
                          {selectedCustomer.phone}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          주소
                        </Typography>
                        <Typography variant="body1">
                          {selectedCustomer.address}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          고객 등급
                        </Typography>
                        <Typography variant="body1">
                          {selectedCustomer.grade === 'V1' ? 'V1 (VIP)' :
                           selectedCustomer.grade === 'V2' ? 'V2 (우수)' : 'V3 (일반)'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          총 A/S 건수
                        </Typography>
                        <Typography variant="body1">
                          {selectedCustomer.serviceCount || 0}건
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                  <Tab value="service" label="A/S 이력" />
                  <Tab value="shipment" label="출고 이력" />
                </Tabs>
              </Box>

              {activeTab === 'service' && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    A/S 이력
                  </Typography>
                  {serviceHistory.length > 0 ? (
                    serviceHistory.map((service, index) => (
                      <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                접수일
                              </Typography>
                              <Typography variant="body1">
                                {new Date(service.reception_date).toLocaleDateString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                상태
                              </Typography>
                              <Chip 
                                label={service.status} 
                                color={getStatusColor(service.status)}
                                size="small"
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" color="text.secondary">
                                증상
                              </Typography>
                              <Typography variant="body1">
                                {service.symptom}
                              </Typography>
                            </Grid>
                            {service.tags && service.tags.length > 0 && (
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  태그
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                  {service.tags.map((tag, idx) => (
                                    <Chip key={idx} label={tag} size="small" />
                                  ))}
                                </Stack>
                              </Grid>
                            )}
                          </Grid>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Typography color="text.secondary">
                      A/S 이력이 없습니다.
                    </Typography>
                  )}
                </Box>
              )}

              {activeTab === 'shipment' && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    출고 이력
                  </Typography>
                  {shipmentHistory.length > 0 ? (
                    shipmentHistory.map((shipment, index) => (
                      <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                출고일
                              </Typography>
                              <Typography variant="body1">
                                {new Date(shipment.shipment_date).toLocaleDateString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                제품
                              </Typography>
                              <Typography variant="body1">
                                {shipment.product_name}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" color="text.secondary">
                                메모
                              </Typography>
                              <Typography variant="body1">
                                {shipment.memo || '-'}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Typography color="text.secondary">
                      출고 이력이 없습니다.
                    </Typography>
                  )}
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default CustomerList;
