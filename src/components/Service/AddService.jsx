import React, { useState, useEffect } from 'react';
import { 
  TextField, 
  Button, 
  Box, 
  Paper,
  Typography,
  MenuItem,
  Grid,
  Input,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  InputAdornment,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { serviceApi } from '../../api/services';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { supabase } from '../../lib/supabaseClient';

function AddService() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const initialBrand = location.state?.selectedBrand || 'XRB';
  
  const [formData, setFormData] = useState({
    brand: initialBrand,
    receptionDate: new Date(),
    repairDate: null,
    completionDate: null,
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    productName: '',
    mileage: '',
    note: '',
    symptom: '',
    solution: '',
    receptionType: '',
  });

  const [newPart, setNewPart] = useState({ name: '', price: '' });
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partsList, setPartsList] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [partsQuantity, setPartsQuantity] = useState(1);

  const [submitting, setSubmitting] = useState(false);

  const [tags, setTags] = useState([]);
  
  // 추천 태그 예시
  const [suggestedTags] = useState([
    // 부품 관련
    '엔진', '브레이크패드', '타이어', '체인', '스프라켓',
    '배터리', '휠', '라이트', '케이블', '오일',
    // 증상 관련
    '소음', '진동', '출력저하', '시동불량', '주행불안정',
    '브레이크이상', '전기문제', '오일누유', '과열', '외관손상'
  ]);

  // 접수 방법 옵션
  const receptionTypes = [
    { value: 'phone', label: '전화' },
    { value: 'visit', label: '방문' },
    { value: 'dealer', label: '대리점' },
    { value: 'other', label: '기타' }
  ];

  // 브랜드 옵션
  const brands = [
    { value: 'XRB', label: 'X-RIDER' },
    { value: 'NB', label: 'NEARBIKE' }
  ];

  useEffect(() => {
    // 고객 데이터 로드 (임시 데이터)
    const dummyCustomers = [
      { id: 1, name: '홍길동', phone: '010-1234-5678' },
      { id: 2, name: '김철수', phone: '010-2345-6789' },
    ];
    setCustomers(dummyCustomers);

    // 파츠 목록 가져오기 (임시 데이터)
    const dummyParts = [
      { id: 1, brand: 'XRB', code: 'XL-001', name: '컴프레서', price: 150000 },
      { id: 2, brand: 'NB', code: 'NB-001', name: '모터', price: 80000 },
    ];
    setPartsList(dummyParts);

    // 브랜드가 없는 경우 리디렉션 처리 (선택사항)
    if (!location.state) {
      navigate('/services');
    }
  }, [location.state, navigate]);

  const handleCustomerSelect = (event) => {
    const phone = event.target.value;
    if (phone === 'new') {
      setIsNewCustomer(true);
      setSelectedCustomer(null);
      setFormData(prev => ({
        ...prev,
        customerName: '',
        customerPhone: '',
        customerAddress: ''
      }));
    } else {
      setIsNewCustomer(false);
      const customer = customers.find(c => c.phone === phone);
      setSelectedCustomer(customer);
      setFormData(prev => ({
        ...prev,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerAddress: customer.address || ''
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // 날짜 필드 특별 처리
    if (['receptionDate', 'repairDate', 'completionDate'].includes(name)) {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        receipt: {
          name: file.name,
          url: URL.createObjectURL(file)
        }
      });
    }
  };

  const handleOpenPartsDialog = () => {
    setOpenPartsDialog(true);
    setSelectedPart(null);
    setPartsQuantity(1);
  };

  const handleClosePartsDialog = () => {
    setOpenPartsDialog(false);
    setSelectedPart(null);
    setPartsQuantity(1);
  };

  const handleAddPart = () => {
    if (selectedPart && partsQuantity > 0) {
      const newPart = {
        ...selectedPart,
        quantity: partsQuantity,
        totalPrice: selectedPart.price * partsQuantity
      };
      setSelectedParts(prev => [...prev, newPart]);
      handleClosePartsDialog();
    }
  };

  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(p => p.id !== partId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName || !formData.customerPhone || !formData.productName || !formData.symptom) {
      setSnackbar({
        open: true,
        message: '필수 항목을 모두 입력해주세요.',
        severity: 'error'
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // 1. 서비스 데이터 생성
      const serviceData = {
        brand: formData.brand,
        reception_date: formData.receptionDate,
        repair_date: formData.repairDate || null,
        completion_date: formData.completionDate || null,
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone,
        customer_address: formData.customerAddress,
        product_name: formData.productName,
        mileage: formData.mileage,
        note: formData.note,
        symptom: formData.symptom,
        solution: formData.solution,
        reception_type: formData.receptionType,
        status: '접수'
      };

      // 2. 서비스 레코드 생성
      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single();

      if (serviceError) throw serviceError;

      // 3. 태그 데이터 생성
      if (tags.length > 0) {
        const tagData = tags.map(tag => ({
          service_id: newService.id,
          tag_name: tag.startsWith('#') ? tag : `#${tag}`
        }));

        const { error: tagError } = await supabase
          .from('service_tags')
          .insert(tagData);

        if (tagError) throw tagError;
      }

      // 4. 파츠 데이터 생성
      if (selectedParts.length > 0) {
        const partsData = selectedParts.map(part => ({
          service_id: newService.id,
          part_id: part.id,
          quantity: part.quantity,
          price: part.price
        }));

        const { error: partsError } = await supabase
          .from('service_parts')
          .insert(partsData);

        if (partsError) throw partsError;
      }

      setSnackbar({
        open: true,
        message: 'A/S가 등록되었습니다.',
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/services');
      }, 1000);
    } catch (error) {
      console.error('Error details:', error);
      setSnackbar({
        open: true,
        message: '등록 중 오류가 발생했습니다: ' + error.message,
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 브랜드 표시 텍스트
  const getBrandDisplayName = (brandCode) => {
    return brandCode === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, mx: 'auto', maxWidth: 1000 }}>
        {/* 뒤로 가기 버튼 */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={() => navigate('/services')}
            startIcon={<ArrowBackIcon />}
            sx={{
              color: 'text.secondary',
              fontSize: '0.95rem',
              fontWeight: 500,
              '&:hover': {
                bgcolor: 'grey.100'
              }
            }}
          >
            A/S 관리
          </Button>
        </Box>

        <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)' }}>
          {/* 브랜드 헤더 */}
          <Typography variant="h5" gutterBottom sx={{ 
            mb: 4,
            color: 'text.primary',
            fontWeight: 600
          }}>
            {getBrandDisplayName(formData.brand)} A/S 등록
          </Typography>

          <Grid container spacing={3}>
            {/* 1. 기본 정보 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ 
                pb: 1, 
                mb: 2, 
                borderBottom: '1px solid #f2f2f2',
                color: 'primary.main',
                fontWeight: 600
              }}>
                기본 정보
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <DatePicker
                    label="접수일"
                    value={formData.receptionDate}
                    onChange={(newValue) => {
                      setFormData(prev => ({
                        ...prev,
                        receptionDate: newValue
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        fullWidth
                        required
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: '#f9fafb'
                          }
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="수리일"
                    type="date"
                    name="repairDate"
                    value={formData.repairDate}
                    onChange={handleInputChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="완료일"
                    type="date"
                    name="completionDate"
                    value={formData.completionDate}
                    onChange={handleInputChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 2. 고객 정보 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ 
                pb: 1, 
                mb: 2, 
                borderBottom: '1px solid #f2f2f2',
                color: 'primary.main',
                fontWeight: 600
              }}>
                고객 정보
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="고객명"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="연락처"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleInputChange}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="주소"
                    name="customerAddress"
                    value={formData.customerAddress}
                    onChange={handleInputChange}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 3. 제품 정보 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ 
                pb: 1, 
                mb: 2, 
                borderBottom: '1px solid #f2f2f2',
                color: 'primary.main',
                fontWeight: 600
              }}>
                제품 정보
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="기종"
                    name="productName"
                    value={formData.productName}
                    onChange={handleInputChange}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="주행거리"
                    name="mileage"
                    value={formData.mileage}
                    onChange={handleInputChange}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">km</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="구매처"
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    multiline
                    rows={1}
                    placeholder="구매처를 입력하세요"
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 4. A/S 내역 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ 
                pb: 1, 
                mb: 2, 
                borderBottom: '1px solid #f2f2f2',
                color: 'primary.main',
                fontWeight: 600
              }}>
                A/S 내역
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    name="symptom"
                    label="증상"
                    value={formData.symptom}
                    onChange={handleInputChange}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#f9fafb'
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    name="solution"
                    label="처리내용"
                    value={formData.solution}
                    onChange={handleInputChange}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#f9fafb'
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* 5. 사용 부품 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ 
                pb: 1, 
                mb: 2, 
                borderBottom: '1px solid #f2f2f2',
                color: 'primary.main',
                fontWeight: 600
              }}>
                사용 부품
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenPartsDialog}
                sx={{ mb: 2 }}
              >
                부품 추가
              </Button>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" sx={{ padding: '8px' }}>브랜드</TableCell>
                      <TableCell align="center" sx={{ padding: '8px' }}>상품코드</TableCell>
                      <TableCell align="center" sx={{ padding: '8px' }}>파츠명</TableCell>
                      <TableCell align="right" sx={{ padding: '8px' }}>단가</TableCell>
                      <TableCell align="center" sx={{ padding: '8px' }}>수량</TableCell>
                      <TableCell align="right" sx={{ padding: '8px' }}>금액</TableCell>
                      <TableCell align="center" sx={{ padding: '8px' }}>관리</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell align="center" sx={{ padding: '8px' }}>{part.brand}</TableCell>
                        <TableCell align="center" sx={{ padding: '8px' }}>{part.code}</TableCell>
                        <TableCell align="center" sx={{ padding: '8px' }}>{part.name}</TableCell>
                        <TableCell align="right" sx={{ padding: '8px' }}>{part.price?.toLocaleString()}원</TableCell>
                        <TableCell align="center" sx={{ padding: '8px' }}>{part.quantity}</TableCell>
                        <TableCell align="right" sx={{ padding: '8px' }}>{part.totalPrice?.toLocaleString()}원</TableCell>
                        <TableCell align="center" sx={{ padding: '8px' }}>
                          <IconButton size="small" onClick={() => handleRemovePart(part.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* 태그 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ 
                pb: 1, 
                mb: 2, 
                borderBottom: '1px solid #f2f2f2',
                color: 'primary.main',
                fontWeight: 600
              }}>
                태그 목록
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    sx={{
                      bgcolor: 'primary.light',
                      color: 'primary.main',
                      fontWeight: 500,
                      '& .MuiChip-label': {
                        fontSize: '0.875rem'
                      }
                    }}
                  />
                ))}
              </Box>
              <Autocomplete
                multiple
                freeSolo
                options={suggestedTags}
                value={tags}
                onChange={(_, newValue) => {
                  if (newValue.length <= 10) {
                    setTags(newValue.map(tag => tag.startsWith('#') ? tag : `#${tag}`));
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="태그 입력"
                    placeholder={tags.length >= 10 ? "최대 10개까지 입력 가능합니다" : "태그 입력 또는 선택"}
                    helperText="부품명이나 증상을 입력해주세요 (최대 10개)"
                    error={tags.length >= 10}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option}
                      {...getTagProps({ index })}
                      sx={{
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        fontWeight: 500,
                        '& .MuiChip-label': {
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  ))
                }
              />
            </Grid>
          </Grid>

          {/* 하단 버튼 */}
          <Box sx={{ 
            mt: 5, 
            pt: 3, 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 2,
            borderTop: '1px solid #f2f2f2' 
          }}>
            <Button 
              onClick={() => navigate('/services')}
              sx={{
                color: 'text.secondary',
                fontSize: '0.95rem',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#f2f4f6'
                }
              }}
            >
              취소
            </Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={submitting}
              sx={{
                fontSize: '0.95rem',
                fontWeight: 600,
                px: 4
              }}
            >
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </Box>
        </Paper>

        {/* 다이얼로그 및 스낵바 유지 */}
        <Dialog open={openPartsDialog} onClose={handleClosePartsDialog} maxWidth="sm" fullWidth>
          <DialogTitle>파츠 선택</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Autocomplete
                options={partsList}
                getOptionLabel={(option) => `[${option.brand}] ${option.code} - ${option.name}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="파츠 검색"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
                    }}
                  />
                )}
                onChange={(_, newValue) => setSelectedPart(newValue)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
              {selectedPart && (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    fullWidth
                    label="수량"
                    type="number"
                    value={partsQuantity}
                    onChange={(e) => setPartsQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    InputProps={{
                      inputProps: { min: 1 }
                    }}
                    sx={{ mt: 2 }}
                  />
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePartsDialog}>취소</Button>
            <Button 
              onClick={handleAddPart} 
              variant="contained"
              disabled={!selectedPart}
            >
              추가
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}

export default AddService; 