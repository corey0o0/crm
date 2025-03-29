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
  Alert
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
      const { data: servicesData, error: servicesError } = await supabase
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

      if (servicesError) throw servicesError;

      // 출고 데이터 조회
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('customer_phone');

      if (shipmentsError) throw shipmentsError;

      // 고객별 출고 건수 계산
      const shipmentCounts = shipmentsData.reduce((acc, curr) => {
        acc[curr.customer_phone] = (acc[curr.customer_phone] || 0) + 1;
        return acc;
      }, {});

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
            shipmentCount: shipmentCounts[curr.customer_phone] || 0,
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
              <TableCell>최근 A/S</TableCell>
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
                    {customer.lastServiceDate ? new Date(customer.lastServiceDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="A/S 건수">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <BuildIcon fontSize="small" color="action" />
                          <Typography variant="body2">{customer.serviceCount || 0}</Typography>
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
                  <Chip 
                    label={selectedCustomer.grade === 'V1' ? 'VIP' : 
                           selectedCustomer.grade === 'V2' ? '우수' : '일반'}
                    size="small"
                    sx={(theme) => ({
                      ...getGradeColor(selectedCustomer.grade),
                      fontWeight: 600
                    })}
                  />
                </Stack>
                <IconButton onClick={() => setOpenDialog(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              {/* 기본 정보 카드 */}
              <Card variant="outlined" sx={{ mb: 3, boxShadow: 'none', border: '1px solid #eee' }}>
                <CardContent sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          연락처
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedCustomer.phone}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          총 A/S 건수
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedCustomer.serviceCount || 0}건
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          주소
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedCustomer.address}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* 탭 메뉴 */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
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
                    serviceHistory.map((service, index) => (
                      <Card 
                        key={index} 
                        variant="outlined" 
                        sx={{ 
                          mb: 2, 
                          boxShadow: 'none',
                          border: '1px solid #eee',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'primary.lighter'
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                접수일
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {new Date(service.reception_date).toLocaleDateString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                상태
                              </Typography>
                              <Chip 
                                label={service.status} 
                                color={getStatusColor(service.status)}
                                size="small"
                                sx={{ fontWeight: 500 }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                증상
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {service.symptom}
                              </Typography>
                            </Grid>
                            {service.tags && service.tags.length > 0 && (
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  태그
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                  {service.tags.map((tag, idx) => (
                                    <Chip 
                                      key={idx} 
                                      label={tag} 
                                      size="small"
                                      sx={{
                                        bgcolor: 'primary.lighter',
                                        color: 'primary.main',
                                        fontWeight: 500
                                      }}
                                    />
                                  ))}
                                </Stack>
                              </Grid>
                            )}
                          </Grid>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Box 
                      sx={{ 
                        p: 3, 
                        textAlign: 'center',
                        bgcolor: 'grey.50',
                        borderRadius: 1
                      }}
                    >
                      <Typography color="text.secondary">
                        A/S 이력이 없습니다.
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* 출고 이력 */}
              {activeTab === 'shipment' && (
                <Box>
                  {shipmentHistory.length > 0 ? (
                    shipmentHistory.map((shipment, index) => (
                      <Card 
                        key={index} 
                        variant="outlined" 
                        sx={{ 
                          mb: 2, 
                          boxShadow: 'none',
                          border: '1px solid #eee',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'primary.lighter'
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                출고일
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {new Date(shipment.shipment_date).toLocaleDateString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                제품
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {shipment.product_name}
                              </Typography>
                            </Grid>
                            {shipment.memo && (
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  메모
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                  {shipment.memo}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Box 
                      sx={{ 
                        p: 3, 
                        textAlign: 'center',
                        bgcolor: 'grey.50',
                        borderRadius: 1
                      }}
                    >
                      <Typography color="text.secondary">
                        출고 이력이 없습니다.
                      </Typography>
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
