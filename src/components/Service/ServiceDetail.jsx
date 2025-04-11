import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Typography,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  ButtonGroup,
  Chip,
  Autocomplete,
  Stack
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptScanner from '../Receipt/ReceiptScanner';

function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({
    brand: '',
    reception_date: null,
    repair_date: null,
    completion_date: null,
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    product_name: '',
    mileage: '',
    note: '',
    symptom: '',
    solution: '',
    reception_type: '',
    status: '',
    delivery_method: ''
  });
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [selectedParts, setSelectedParts] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [tags, setTags] = useState([]);
  const [availableTags] = useState([
    '엔진', '브레이크', '전기', '타이어', '서스펜션',
    '외관', '내장', '소모품', '정기점검', '사고수리'
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [modifiedPrice, setModifiedPrice] = useState('');
  const [partDialogOpen, setPartDialogOpen] = useState(false);

  const fetchServiceDetail = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select(`
          *,
          service_parts (
            id,
            part_id,
            quantity,
            price
          ),
          service_tags (
            tag_name
          )
        `)
        .eq('id', id)
        .single();

      if (serviceError) throw serviceError;

      // 태그 데이터 설정
      if (serviceData.service_tags) {
        setTags(serviceData.service_tags.map(t => t.tag_name));
      }

      // 사용된 부품 정보 조회
      if (serviceData.service_parts?.length > 0) {
        const partIds = serviceData.service_parts.map(sp => sp.part_id);
        const { data: partsData, error: partsError } = await supabase
          .from('parts')
          .select('*')
          .in('id', partIds);

        if (partsError) throw partsError;

        const selectedParts = serviceData.service_parts.map(sp => {
          const part = partsData.find(p => p.id === sp.part_id);
          return {
            ...part,
            quantity: sp.quantity,
            totalPrice: sp.price * sp.quantity
          };
        });

        setSelectedParts(selectedParts);
      }
      
      setFormData({
        ...serviceData,
        reception_date: serviceData.reception_date ? new Date(serviceData.reception_date) : null,
        repair_date: serviceData.repair_date ? new Date(serviceData.repair_date) : null,
        completion_date: serviceData.completion_date ? new Date(serviceData.completion_date) : null,
      });
    } catch (err) {
      console.error('Error fetching service detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchServiceDetail();
  }, [fetchServiceDetail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      // 1. 서비스 데이터 업데이트
      const { error: updateError } = await supabase
        .from('services')
        .update({
          brand: formData.brand,
          reception_date: formData.reception_date,
          repair_date: formData.repair_date,
          completion_date: formData.completion_date,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_address: formData.customer_address,
          product_name: formData.product_name,
          mileage: formData.mileage,
          note: formData.note,
          symptom: formData.symptom,
          solution: formData.solution,
          reception_type: formData.reception_type,
          status: formData.status
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. 기존 태그 삭제
      const { error: deleteTagsError } = await supabase
        .from('service_tags')
        .delete()
        .eq('service_id', id);

      if (deleteTagsError) throw deleteTagsError;

      // 3. 새 태그 추가
      if (tags.length > 0) {
        const tagData = tags.map(tag => ({
          service_id: id,
          tag_name: tag.startsWith('#') ? tag : `#${tag}`
        }));

        const { error: insertTagsError } = await supabase
          .from('service_tags')
          .insert(tagData);

        if (insertTagsError) throw insertTagsError;
      }

      // 4. 기존 부품 삭제
      const { error: deletePartsError } = await supabase
        .from('service_parts')
        .delete()
        .eq('service_id', id);

      if (deletePartsError) throw deletePartsError;

      // 5. 새 부품 추가 (UUID 오류 해결)
      if (selectedParts.length > 0) {
        // 부품 데이터 준비
        const partsData = selectedParts.map(part => ({
          service_id: id,
          part_id: part.id,
          quantity: part.quantity,
          price: part.price || 0
        }));

        const { error: insertPartsError } = await supabase
          .from('service_parts')
          .insert(partsData);

        if (insertPartsError) {
          console.error('부품 추가 오류:', insertPartsError);
          throw new Error(`부품 추가 중 오류가 발생했습니다: ${insertPartsError.message}`);
        }
      }

      setSnackbar({
        open: true,
        message: 'A/S 정보가 업데이트되었습니다.',
        severity: 'success'
      });

      // 데이터 다시 불러오기
      fetchServiceDetail();
    } catch (err) {
      console.error('Error updating service:', err);
      setSnackbar({
        open: true,
        message: `오류가 발생했습니다: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 부품 목록 불러오기
  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // 콘솔에 parts 데이터 출력하여 id 형식 확인
      console.log('Available parts:', data);
      
      setAvailableParts(data);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setError(err.message);
    }
  };

  // 부품 검색 필터링
  const filteredParts = availableParts.filter(part => 
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 부품 추가 다이얼로그 열기
  const handleOpenPartsDialog = () => {
    fetchParts();
    setOpenPartsDialog(true);
    setSearchTerm('');
  };

  // 부품 선택
  const handlePartSelect = (part) => {
    setSelectedPart(part);
  };

  const handleOpenPartDialog = () => {
    setPartDialogOpen(true);
  };

  const handleClosePartDialog = () => {
    setPartDialogOpen(false);
    setSelectedPart(null);
    setPartQuantity(1);
    setModifiedPrice('');
  };

  const handleAddPart = () => {
    if (selectedPart && partQuantity > 0) {
      // 이미 추가된 부품인지 확인
      const existingPartIndex = selectedParts.findIndex(p => p.id === selectedPart.id);
      
      if (existingPartIndex >= 0) {
        // 이미 추가된 부품이면 수량만 증가
        const updatedParts = [...selectedParts];
        updatedParts[existingPartIndex].quantity += partQuantity;
        updatedParts[existingPartIndex].total = updatedParts[existingPartIndex].price * updatedParts[existingPartIndex].quantity;
        setSelectedParts(updatedParts);
      } else {
        // 새 부품 추가
        const newPart = {
          id: selectedPart.id,
          name: selectedPart.name,
          quantity: partQuantity,
          price: modifiedPrice || selectedPart.price || 0,
          total: (modifiedPrice || selectedPart.price || 0) * partQuantity
        };
        setSelectedParts(prev => [...prev, newPart]);
      }
      
      setSelectedPart(null);
      setPartQuantity(1);
      setModifiedPrice('');
      handleClosePartDialog();
    }
  };

  // 부품 삭제
  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(part => part.id !== partId));
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === '완료') {
      setConfirmDialog({
        open: true,
        title: 'A/S 완료 확인',
        message: '해당 A/S를 완료 처리하시겠습니까?',
        onConfirm: () => {
          const currentDate = new Date().toISOString().split('T')[0];
          setFormData(prev => ({
            ...prev,
            status: newStatus,
            completion_date: new Date(),
            repair_date: new Date()
          }));
          setConfirmDialog({ ...confirmDialog, open: false });
        }
      });
    } else {
      setFormData(prev => ({
        ...prev,
        status: newStatus
      }));
    }
  };

  const getStatusColor = (buttonStatus) => {
    if (formData.status === buttonStatus) {
      return { 
        bgcolor: 'primary.main', 
        color: 'white',
        '&:hover': {
          bgcolor: 'primary.dark'
        }
      };
    }
    return { 
      bgcolor: 'grey.100', 
      color: 'text.primary',
      '&:hover': {
        bgcolor: 'grey.200'
      }
    };
  };

  const sectionStyle = {
    pb: 1,
    mb: 2,
    borderBottom: '1px solid #f2f2f2',
    color: '#333333',
    fontSize: '1.1rem',
    fontWeight: 600
  };

  const paperStyle = {
    p: 4,
    borderRadius: 3,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
    bgcolor: '#ffffff'
  };

  const buttonStyle = (isActive) => ({
    borderRadius: 3,
    flex: 1,
    height: 44,
    fontSize: '0.95rem',
    fontWeight: 600,
    textTransform: 'none',
    ...(isActive ? {
      bgcolor: '#3182f6',
      '&:hover': {
        bgcolor: '#1b64da'
      }
    } : {
      bgcolor: '#f2f4f6',
      color: '#4e5968',
      '&:hover': {
        bgcolor: '#e5e8eb'
      }
    })
  });

  // 날짜 포맷팅 함수 추가
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return '';
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      open: true,
      title: '출고 정보 삭제',
      message: '해당 출고 정보를 삭제하시겠습니까?',
      onConfirm: async () => {
        try {
          setSubmitting(true);
          
          // 1. 기존 태그 삭제
          const { error: deleteTagsError } = await supabase
            .from('service_tags')
            .delete()
            .eq('service_id', id);

          if (deleteTagsError) throw deleteTagsError;

          // 2. 기존 부품 삭제
          const { error: deletePartsError } = await supabase
            .from('service_parts')
            .delete()
            .eq('service_id', id);

          if (deletePartsError) throw deletePartsError;

          // 3. 서비스 데이터 삭제
          const { error: deleteServiceError } = await supabase
            .from('services')
            .delete()
            .eq('id', id);

          if (deleteServiceError) throw deleteServiceError;

          setSnackbar({
            open: true,
            message: '출고 정보가 삭제되었습니다.',
            severity: 'success'
          });

          // 목록 페이지로 이동
          navigate('/services');
        } catch (err) {
          console.error('Error deleting service:', err);
          setSnackbar({
            open: true,
            message: `오류가 발생했습니다: ${err.message}`,
            severity: 'error'
          });
        } finally {
          setSubmitting(false);
          setConfirmDialog({ ...confirmDialog, open: false });
        }
      }
    });
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

  // 부품 관련 UI
  const partsSection = (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        사용 부품
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={handleOpenPartsDialog}
          sx={{ 
            bgcolor: '#3182f6',
            '&:hover': { bgcolor: '#1b64da' }
          }}
        >
          수동으로 부품 추가
        </Button>
        <Button
          startIcon={<ReceiptIcon />}
          variant="outlined"
          onClick={() => setOpenReceiptDialog(true)}
          sx={{ 
            color: '#3182f6',
            borderColor: '#3182f6',
            '&:hover': { 
              bgcolor: 'rgba(49, 130, 246, 0.04)',
              borderColor: '#1b64da'
            }
          }}
        >
          영수증으로 부품 추가
        </Button>
      </Stack>
      
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>부품명</TableCell>
              <TableCell>코드</TableCell>
              <TableCell align="right">단가</TableCell>
              <TableCell align="right">수량</TableCell>
              <TableCell align="right">금액</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedParts.map((part) => (
              <TableRow key={part.id}>
                <TableCell>{part.name}</TableCell>
                <TableCell>{part.code}</TableCell>
                <TableCell align="right">
                  {part.price ? part.price.toLocaleString() : '0'}원
                </TableCell>
                <TableCell align="right">{part.quantity}</TableCell>
                <TableCell align="right">
                  {part.price && part.quantity
                    ? (part.price * part.quantity).toLocaleString()
                    : '0'}원
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleRemovePart(part.id)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={4} align="right">
                <Typography variant="subtitle2">합계</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2">
                  {selectedParts.reduce((sum, part) => {
                    const partTotal = part.price && part.quantity 
                      ? part.price * part.quantity 
                      : 0;
                    return sum + partTotal;
                  }, 0).toLocaleString()}원
                </Typography>
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openPartsDialog} onClose={() => setOpenPartsDialog(false)}>
        <DialogTitle>부품 추가</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="부품명, 코드, 브랜드로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell>브랜드</TableCell>
                  <TableCell align="right">단가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredParts.map((part) => (
                  <TableRow 
                    key={part.id}
                    selected={selectedPart?.id === part.id}
                    onClick={() => handlePartSelect(part)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{part.name}</TableCell>
                    <TableCell>{part.code}</TableCell>
                    <TableCell>{part.brand}</TableCell>
                    <TableCell align="right">{part.price.toLocaleString()}원</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {selectedPart && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <TextField
                type="number"
                label="수량"
                value={partQuantity}
                onChange={(e) => setPartQuantity(Number(e.target.value))}
                sx={{ flex: 1 }}
                InputProps={{
                  inputProps: { min: 1 }
                }}
              />
              <TextField
                type="number"
                label="가격"
                value={modifiedPrice || selectedPart.price}
                onChange={(e) => setModifiedPrice(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  inputProps: { min: 0 },
                  startAdornment: <InputAdornment position="start">₩</InputAdornment>
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPartsDialog(false)}>취소</Button>
          <Button onClick={handleAddPart} disabled={!selectedPart}>
            추가
          </Button>
        </DialogActions>
      </Dialog>

      {/* 영수증 스캐너 다이얼로그 */}
      <Dialog 
        open={openReceiptDialog} 
        onClose={() => setOpenReceiptDialog(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle sx={{ 
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          영수증으로 부품 추가
          <IconButton onClick={() => setOpenReceiptDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <ReceiptScanner 
            onPartsSelected={(selectedParts) => {
              // 선택된 부품들을 현재 서비스의 부품 목록에 추가
              setSelectedParts(prev => [...prev, ...selectedParts]);
              setOpenReceiptDialog(false);
            }}
            currentServiceId={id}
            isDialogMode={true}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, mx: 'auto', width: '95%', maxWidth: 1400 }}>
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

        <Paper sx={paperStyle}>
          <Typography variant="h5" gutterBottom sx={{ 
            mb: 4, 
            color: '#191f28',
            fontWeight: 600 
          }}>
            A/S 상세 정보
          </Typography>

          <Grid container spacing={4}>
            {/* 왼쪽 컬럼: 기본 정보, 고객 정보와 제품 정보 */}
            <Grid item xs={12} md={6}>
              {/* 기본 정보 섹션 */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={sectionStyle}>
                  기본 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="접수일"
                      value={formData.reception_date}
                      onChange={(newValue) => {
                        handleChange({
                          target: { name: 'reception_date', value: newValue }
                        });
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          fullWidth
                          size="small"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1,
                              bgcolor: '#f9fafb'
                            }
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="완료일"
                      value={formData.completion_date}
                      onChange={(newValue) => {
                        handleChange({
                          target: { name: 'completion_date', value: newValue }
                        });
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          fullWidth
                          size="small"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1,
                              bgcolor: '#f9fafb'
                            }
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      onClick={() => handleStatusChange('접수')}
                      variant="contained"
                      size="small"
                      sx={buttonStyle(formData.status === '접수')}
                    >
                      접수
                    </Button>
                    <Button 
                      onClick={() => handleStatusChange('처리중')}
                      variant="contained"
                      size="small"
                      sx={buttonStyle(formData.status === '처리중')}
                    >
                      처리중
                    </Button>
                    <Button 
                      onClick={() => handleStatusChange('완료')}
                      variant="contained"
                      size="small"
                      sx={buttonStyle(formData.status === '완료')}
                    >
                      완료
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              {/* 고객 정보와 제품 정보를 나란히 배치 */}
              <Grid container spacing={4}>
                {/* 고객 정보 섹션 */}
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="subtitle1" sx={sectionStyle}>
                      고객 정보
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="customer_name"
                          label="고객명"
                          value={formData.customer_name}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="customer_phone"
                          label="연락처"
                          value={formData.customer_phone}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="customer_address"
                          label="주소"
                          value={formData.customer_address}
                          onChange={handleChange}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>

                {/* 제품 정보 섹션 */}
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="subtitle1" sx={sectionStyle}>
                      제품 정보
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          name="brand"
                          label="브랜드"
                          value={formData.brand}
                          onChange={handleChange}
                        >
                          <MenuItem value="XRB">X-RIDER</MenuItem>
                          <MenuItem value="NB">NEARBIKE</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="product_name"
                          label="제품명"
                          value={formData.product_name}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="mileage"
                          label="주행거리"
                          value={formData.mileage}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          name="reception_type"
                          label="접수방법"
                          value={formData.reception_type}
                          onChange={handleChange}
                        >
                          <MenuItem value="방문">방문</MenuItem>
                          <MenuItem value="전화">전화</MenuItem>
                          <MenuItem value="온라인">온라인</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="note"
                          label="구매처"
                          value={formData.note}
                          onChange={handleChange}
                          placeholder="구매처를 입력하세요"
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            {/* 오른쪽 컬럼: A/S 내역 */}
            <Grid item xs={12} md={6}>
              {/* A/S 내역 섹션 */}
              <Box>
                <Typography variant="subtitle1" sx={sectionStyle}>
                  A/S 내역
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={5}
                      name="symptom"
                      label="증상"
                      value={formData.symptom}
                      onChange={handleChange}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1.1rem',
                          lineHeight: '1.6'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={5}
                      name="solution"
                      label="처리내역"
                      value={formData.solution}
                      onChange={handleChange}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '1.1rem',
                          lineHeight: '1.6'
                        }
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          {/* 부품 정보 섹션 */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" sx={sectionStyle}>
              사용 부품
            </Typography>
            {partsSection}
          </Grid>

          <Box sx={{ 
            mt: 5, 
            pt: 3, 
            display: 'flex', 
            justifyContent: 'space-between', 
            gap: 2,
            borderTop: '1px solid #f2f2f2' 
          }}>
            <Button 
              onClick={handleDelete}
              sx={{
                color: '#f04452',
                fontSize: '0.95rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: 'rgba(240, 68, 82, 0.04)'
                }
              }}
            >
              삭제
            </Button>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                onClick={() => navigate('/services')}
                sx={{
                  color: '#4e5968',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
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
                  bgcolor: '#3182f6',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 4,
                  '&:hover': {
                    bgcolor: '#1b64da'
                  }
                }}
              >
                수정
              </Button>
            </Box>
          </Box>
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            severity={snackbar.severity}
            sx={{
              borderRadius: 2,
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

        {/* 확인 대화상자 추가 */}
        <Dialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        >
          <DialogTitle>{confirmDialog.title}</DialogTitle>
          <DialogContent>
            <Typography>{confirmDialog.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
              sx={{
                color: '#4e5968',
                fontSize: '0.95rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#f2f4f6'
                }
              }}
            >
              취소
            </Button>
            <Button 
              onClick={() => confirmDialog.onConfirm?.()}
              variant="contained"
              sx={{
                bgcolor: '#3182f6',
                fontSize: '0.95rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#1b64da'
                }
              }}
            >
              확인
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default ServiceDetail; 