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
  TablePagination
} from '@mui/material';
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
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
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
      
      // 1. 고객 정보 조회
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('updated_at', { ascending: false });

      if (customersError) throw customersError;

      // 2. A/S 서비스 데이터와 태그 정보 조회
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          customer_phone,
          customer_name,
          reception_date,
          brand,
          service_tags (
            tag_name
          )
        `)
        .order('reception_date', { ascending: false });

      if (servicesError) throw servicesError;

      // 3. 출고 데이터 조회
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('product_shipments')
        .select('*')
        .order('shipment_date', { ascending: false });

      if (shipmentsError) throw shipmentsError;

      console.log('Services data:', servicesData); // 서비스 데이터 구조 확인
      console.log('Shipments data:', shipmentsData); // 출고 데이터 구조 확인

      // 4. 모든 고객 데이터 통합 (서비스와 출고 데이터에서 고객 정보 추출)
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
          brands: new Set() // 고객이 이용한 브랜드 추적
        });
      });

      // 서비스 데이터에서 고객 정보 추가/업데이트
      servicesData.forEach(service => {
        if (!service.customer_phone) return;
        
        if (!allCustomers.has(service.customer_phone)) {
          allCustomers.set(service.customer_phone, {
            phone: service.customer_phone,
            name: service.customer_name,
            serviceCount: {
              XRB: 0,
              NB: 0
            },
            lastServiceDate: null,
            recentTag: null,
            shipmentCount: 0,
            lastShipmentDate: null,
            brands: new Set()
          });
        }
        
        const customer = allCustomers.get(service.customer_phone);
        customer.serviceCount[service.brand] = (customer.serviceCount[service.brand] || 0) + 1;
        customer.brands.add(service.brand);
        
        if (!customer.lastServiceDate || service.reception_date > customer.lastServiceDate) {
          customer.lastServiceDate = service.reception_date;
          customer.recentTag = service.service_tags?.[0]?.tag_name;
        }
      });

      // 출고 데이터에서 고객 정보 추가/업데이트
      shipmentsData.forEach(shipment => {
        // 실제 데이터 구조에 맞게 필드명 수정 필요
        const phone = shipment.phone || shipment.customer_phone;
        const name = shipment.name || shipment.customer_name;
        const brand = shipment.brand;
        
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
            brands: new Set()
          });
        }
        
        const customer = allCustomers.get(phone);
        customer.shipmentCount++;
        if (brand) customer.brands.add(brand);
        
        if (!customer.lastShipmentDate || shipment.shipment_date > customer.lastShipmentDate) {
          customer.lastShipmentDate = shipment.shipment_date;
        }
      });

      // Set을 Array로 변환하여 저장
      const customersArray = Array.from(allCustomers.values()).map(customer => ({
        ...customer,
        brands: Array.from(customer.brands)
      }));

      console.log('All customers:', customersArray); // 최종 데이터 확인용
      setCustomers(customersArray);
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
    setEditCustomerData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 고객 정보 수정 제출
  const handleEditSubmit = async () => {
    try {
      const { error } = await supabase
        .from('customers')
        .upsert({
          phone: editCustomerData.phone,
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
    <Box>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="이름, 연락처, 제품으로 검색"
          value={searchTerm}
          onChange={handleSearch}
          sx={{ mb: 2 }}
        />
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>이름</TableCell>
              <TableCell>연락처</TableCell>
              <TableCell>최근 A/S</TableCell>
              <TableCell>최근 출고</TableCell>
              <TableCell>건수</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="error">{error}</Typography>
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
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
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
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
                    {customer.lastShipmentDate ? new Date(customer.lastShipmentDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="A/S 건수">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <BuildIcon fontSize="small" color="action" />
                          <Typography variant="body2">{customer.serviceCount.XRB + customer.serviceCount.NB || 0}</Typography>
                        </Box>
                      </Tooltip>
                      <Tooltip title="출고 건수">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocalShippingIcon fontSize="small" color="action" />
                          <Typography variant="body2">{customer.shipmentCount || 0}</Typography>
                        </Box>
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
                  <Tab value="service" label={`A/S 이력 (${serviceHistory.length})`} />
                  <Tab value="shipment" label={`출고 이력 (${shipmentHistory.length})`} />
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

      {/* 고객정보 수정 다이얼로그 추가 */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">고객 정보 수정</Typography>
            <IconButton onClick={() => setEditDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="고객명"
              name="name"
              value={editCustomerData.name}
              onChange={handleEditInputChange}
            />
            <TextField
              fullWidth
              label="연락처"
              name="phone"
              value={editCustomerData.phone}
              onChange={handleEditInputChange}
              disabled
            />
            <TextField
              fullWidth
              label="주소"
              name="address"
              value={editCustomerData.address}
              onChange={handleEditInputChange}
            />
          </Stack>
        </DialogContent>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button 
            variant="contained"
            onClick={handleEditSubmit}
          >
            수정
          </Button>
        </Box>
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
