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
  Stack,
  Popover,
  ImageList,
  ImageListItem,
  Link,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptScanner from '../Receipt/ReceiptScanner';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { 
  Close as CloseIconMui,
  ZoomIn as ZoomInIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';

// PDF worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({
    brand: '',
    reception_date: null,
    reception_time: '',
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
    delivery_method: '',
    seller: '',
    writer: ''
  });
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [selectedParts, setSelectedParts] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [tags, setTags] = useState([]);
  const [availableTags] = useState([
    '전체점검', '브레이크-패드', '브레이크-로터', '브레이크-교체', '배터리',
    '충전기', '모터', '워런티', '사고-보험', 'E07','E09','E010'
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
  const [tag, setTag] = useState('');
  const [receiptLink, setReceiptLink] = useState('');
  const [receiptPreviewAnchor, setReceiptPreviewAnchor] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [brand, setBrand] = useState('');

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
            price,
            usage
          ),
          service_tags (
            tag_name
          )
        `)
        .eq('id', id)
        .single();

      if (serviceError) throw serviceError;

      // 날짜와 시간 분리
      const receptionDate = serviceData.reception_date ? new Date(serviceData.reception_date) : null;
      const receptionTime = receptionDate ? 
        `${receptionDate.getHours().toString().padStart(2, '0')}:${(Math.floor(receptionDate.getMinutes() / 30) * 30).toString().padStart(2, '0')}` : 
        '00:00';

      // 기존 note에서 구매처 정보가 있다면 seller 필드로 이전
      if (serviceData.note && !serviceData.seller) {
        const { error: updateError } = await supabase
          .from('services')
          .update({
            seller: serviceData.note,
            note: ''
          })
          .eq('id', id);
          
        if (!updateError) {
          serviceData.seller = serviceData.note;
          serviceData.note = '';
        }
      }

      // 태그 데이터 설정
      if (serviceData.service_tags) {
        setTags(serviceData.service_tags.map(t => t.tag_name));
      }

      // 주행거리 데이터 처리
      const mileage = serviceData.mileage === null ? '' : serviceData.mileage;
      
      setFormData({
        ...serviceData,
        reception_date: receptionDate ? receptionDate.toISOString().split('T')[0] : null,
        reception_time: receptionTime,
        repair_date: serviceData.repair_date ? new Date(serviceData.repair_date).toISOString().split('T')[0] : null,
        completion_date: serviceData.completion_date ? new Date(serviceData.completion_date).toISOString().split('T')[0] : null,
        service_parts: serviceData.service_parts || [],
        writer: serviceData.writer || '관리자',
        mileage: mileage
      });

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
            price: sp.price,
            usage: sp.usage || 'A/S',
            totalPrice: sp.price * sp.quantity
          };
        });

        setSelectedParts(selectedParts);
      }
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

  useEffect(() => {
    if (formData?.receipt_link) {
      setReceiptLink(formData.receipt_link);
    }
  }, [formData]);

  const handleStatusChange = (newStatus) => {
    if (newStatus === '완료') {
      setConfirmDialog({
        open: true,
        title: 'A/S 완료 확인',
        message: '해당 A/S를 완료 처리하시겠습니까?',
        onConfirm: () => {
          setFormData(prev => {
            const updatedData = { ...prev, status: newStatus };
            if (!prev.completion_date) {
              const currentDate = new Date().toISOString().split('T')[0];
              updatedData.completion_date = currentDate;
            }
            return updatedData;
          });
          setIsEditing(true);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
    } else {
      setFormData(prev => ({
        ...prev,
        status: newStatus
      }));
      setIsEditing(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 서비스 데이터 업데이트
      const { error: serviceError } = await supabase
        .from('services')
        .update({
          reception_date: formData.reception_date,
          reception_type: formData.reception_type,
          repair_date: formData.repair_date,
          completion_date: formData.completion_date,
          delivery_method: formData.delivery_method,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_address: formData.customer_address,
          product_name: formData.product_name,
          symptom: formData.symptom,
          solution: formData.solution,
          status: formData.status,
          note: formData.note,
          receipt_link: formData.receipt_link,
          seller: formData.seller,
          mileage: formData.mileage,
          writer: formData.writer,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (serviceError) throw serviceError;

      // 태그 업데이트
      const { error: tagDeleteError } = await supabase
        .from('service_tags')
        .delete()
        .eq('service_id', id);

      if (tagDeleteError) throw tagDeleteError;

      if (tags.length > 0) {
        const tagData = tags.map(tag => ({
          service_id: id,
          tag_name: tag
        }));

        const { error: tagInsertError } = await supabase
          .from('service_tags')
          .insert(tagData);

        if (tagInsertError) throw tagInsertError;
      }

      setSnackbar({
        open: true,
        message: '성공적으로 저장되었습니다.',
        severity: 'success'
      });

      // 1초 후에 목록 페이지로 이동
      setTimeout(() => {
        navigate('/services');
      }, 1000);

    } catch (error) {
      console.error('Error updating service:', error);
      setSnackbar({
        open: true,
        message: '저장 중 오류가 발생했습니다: ' + error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'completion_date') {
      setFormData((prev) => ({
        ...prev,
        [name]: value ? new Date(value).toISOString() : '',
        status: value ? '완료' : prev.status
      }));
    } else if (name === 'reception_date') {
      setFormData((prev) => ({
        ...prev,
        [name]: value ? new Date(value).toISOString().split('T')[0] : ''
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // 부품 목록 불러오기
  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', formData.brand)  // 현재 선택된 브랜드로 필터링
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
    (part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.brand.toLowerCase().includes(searchTerm.toLowerCase()))
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
          code: selectedPart.code,
          quantity: partQuantity,
          price: modifiedPrice || selectedPart.price || 0,
          total: (modifiedPrice || selectedPart.price || 0) * partQuantity,
          usage: 'A/S' // 기본값으로 A/S 설정
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

  const getStatusColor = (status) => {
    switch (status) {
      case '접수':
        return 'info';
      case '처리중':
        return 'warning';
      case '완료':
        return 'success';
      default:
        return 'info';
    }
  };

  const buttonStyle = (isSelected) => ({
    marginLeft: '8px',
    backgroundColor: isSelected ? (
      formData.status === '접수' ? '#1976d2' :
      formData.status === '처리중' ? '#ed6c02' :
      formData.status === '완료' ? '#2e7d32' : '#3182f6'
    ) : '#f2f4f6',
    color: isSelected ? '#ffffff' : '#4e5968',
    '&:hover': {
      backgroundColor: isSelected ? (
        formData.status === '접수' ? '#1565c0' :
        formData.status === '처리중' ? '#d65f02' :
        formData.status === '완료' ? '#1e5e20' : '#1b64da'
      ) : '#e5e8eb'
    }
  });

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

          // 2초 후 리스트 페이지로 이동
          setTimeout(() => {
            navigate('/services');
          }, 2000);

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

  // 가격 수정 핸들러 수정
  const handlePriceChange = (index, newPrice) => {
    try {
      console.log('가격 수정 시작:', {
        index,
        newPrice,
        '기존 가격': selectedParts[index].price,
        '기존 총액': selectedParts[index].total
      });

      const updatedParts = [...selectedParts];
      const priceValue = newPrice === '' ? 0 : Number(newPrice);
      
      updatedParts[index] = {
        ...updatedParts[index],
        price: priceValue,
        total: priceValue * updatedParts[index].quantity
      };

      console.log('수정된 부품 정보:', {
        '부품명': updatedParts[index].name,
        '수정된 가격': priceValue,
        '수량': updatedParts[index].quantity,
        '새로운 총액': updatedParts[index].total
      });
      
      setSelectedParts(updatedParts);
      
      console.log('전체 선택된 부품 목록:', updatedParts);
    } catch (err) {
      console.error('가격 수정 중 오류:', err);
      setSnackbar({
        open: true,
        message: '가격 수정 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 가격 저장 핸들러 수정
  const handleSavePrice = async (index) => {
    try {
      const updatedPart = selectedParts[index];
      
      console.log('가격 저장 시작:', {
        '부품명': updatedPart.name,
        '부품 ID': updatedPart.id,
        '새 가격': updatedPart.price,
        '수량': updatedPart.quantity,
        '총액': updatedPart.total
      });

      // service_parts 테이블 업데이트
      const { error: updateError } = await supabase
        .from('service_parts')
        .update({ 
          price: updatedPart.price,
          quantity: updatedPart.quantity,
          usage: updatedPart.usage || 'A/S'
        })
        .eq('service_id', id)
        .eq('part_id', updatedPart.id);

      if (updateError) {
        console.error('부품 데이터 업데이트 중 오류:', updateError);
        throw updateError;
      }

      console.log('가격 저장 완료:', {
        '서비스 ID': id,
        '부품 ID': updatedPart.id,
        '업데이트된 가격': updatedPart.price
      });
      
      setSnackbar({
        open: true,
        message: '가격이 성공적으로 저장되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('가격 저장 중 오류:', err);
      setSnackbar({
        open: true,
        message: `가격 저장 중 오류가 발생했습니다: ${err.message}`,
        severity: 'error'
      });
    }
  };

  // Handle mouse enter for receipt preview
  const handleReceiptMouseEnter = (event) => {
    if (receiptLink) {
      setReceiptPreviewAnchor(event.currentTarget);
    }
  };

  // Handle mouse leave for receipt preview
  const handleReceiptMouseLeave = () => {
    setReceiptPreviewAnchor(null);
  };

  // PDF 로드 성공 핸들러
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  // Add tag input handler
  const handleTagInput = (event, value, reason) => {
    if (reason === 'input') {
      // 직접 입력한 경우
      setTags(value ? [...new Set([...tags, value])] : tags);
    } else {
      // 추천 태그에서 선택한 경우
      setTags(value);
    }
  };

  // 미리보기 처리 함수
  const handlePreview = (url) => {
    if (!url) return;
    
    const fileType = url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
    setPreviewType(fileType);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleDateChange = (date, field) => {
    setFormData(prev => ({
      ...prev,
      [field]: date
    }));
  };

  const handleComplete = async () => {
    try {
      let completionDate = formData.completion_date;
      
      // 완료일이 지정되어 있지 않으면 현재 날짜로 설정
      if (!completionDate) {
        completionDate = new Date();
      }

      const { error } = await supabase
        .from('services')
        .update({
          status: '완료',
          completion_date: completionDate
        })
        .eq('id', id);

      if (error) throw error;

      // 폼 데이터 업데이트
      setFormData(prev => ({
        ...prev,
        status: '완료',
        completion_date: completionDate
      }));

      setSnackbar({
        open: true,
        message: 'A/S가 완료 처리되었습니다.',
        severity: 'success'
      });

    } catch (error) {
      console.error('Error completing service:', error);
      setSnackbar({
        open: true,
        message: '완료 처리 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 구글 드라이브 링크 처리 함수 추가
  const getGoogleDriveImageUrl = (url) => {
    // 구글 드라이브 공유 링크를 이미지 직접 링크로 변환
    const fileId = url.match(/[-\w]{25,}/);
    if (fileId && fileId[0]) {
      return `https://drive.google.com/uc?export=view&id=${fileId[0]}`;
    }
    return url;
  };

  // 영수증 링크 미리보기 컴포넌트
  const ReceiptPreview = ({ url }) => {
    const [open, setOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
      if (url) {
        // 구글 드라이브 링크인지 확인하고 처리
        if (url.includes('drive.google.com')) {
          setPreviewUrl(getGoogleDriveImageUrl(url));
        } else {
          setPreviewUrl(url);
        }
      }
    }, [url]);

    if (!url) return null;

    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Link href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </Link>
          <Tooltip title="미리보기">
            <IconButton size="small" onClick={() => setOpen(true)}>
              <PreviewIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>영수증 미리보기</DialogTitle>
          <DialogContent>
            <Box sx={{ width: '100%', mt: 2 }}>
              <img
                src={previewUrl}
                alt="영수증"
                style={{ width: '100%', height: 'auto' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/placeholder-image.png';
                  console.error('이미지 로드 실패');
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>닫기</Button>
            <Button 
              component="a" 
              href={url} 
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
            >
              원본 보기
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  };

  // 영수증 링크 변경 핸들러
  const handleReceiptLinkChange = (e) => {
    const newLink = e.target.value;
    setReceiptLink(newLink);
    setFormData(prev => ({
      ...prev,
      receipt_link: newLink
    }));
  };

  // 기존 제품명 목록 가져오기
  const fetchProductNames = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('product_name, brand')
        .not('product_name', 'is', null)
        .order('product_name');

      if (error) throw error;

      // 중복 제거 및 현재 선택된 브랜드에 맞는 제품만 필터링
      const uniqueProducts = [...new Set(
        data
          .filter(item => item.brand === formData.brand)
          .map(item => item.product_name)
      )].filter(Boolean); // null/empty 값 제거

      setProductOptions(uniqueProducts);
    } catch (err) {
      console.error('제품명 목록 조회 중 오류:', err);
    }
  };

  // 브랜드 변경 시 제품명 목록 업데이트
  useEffect(() => {
    if (formData.brand) {
      fetchProductNames();
    }
  }, [formData.brand]);

  // handleUsageChange 함수 추가 (컴포넌트 내부의 다른 함수들과 같은 레벨에 추가)
  const handleUsageChange = (index, newUsage) => {
    const updatedParts = [...selectedParts];
    updatedParts[index] = {
      ...updatedParts[index],
      usage: newUsage
    };
    setSelectedParts(updatedParts);
  };

  // handleQuantityChange 함수 추가 (컴포넌트 내부의 다른 함수들과 같은 레벨에 추가)
  const handleQuantityChange = (index, newQuantity) => {
    const updatedParts = [...selectedParts];
    const qty = Math.max(1, Number(newQuantity) || 1);
    updatedParts[index] = {
      ...updatedParts[index],
      quantity: qty,
      total: updatedParts[index].price * qty
    };
    setSelectedParts(updatedParts);
  };

  // 고객 검색 함수
  const searchCustomers = async (searchTerm) => {
    try {
      setSearchLoading(true);
      console.log('검색 시작:', { searchTerm, brand });

      // 검색어가 2글자 미만이면 최근 고객 목록 표시
      if (searchTerm.length < 2) {
        const { data: recentCustomers, error: recentError } = await supabase
          .from('services')
          .select('customer_name, customer_phone, customer_address, brand')
          .eq('brand', brand)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentError) throw recentError;

        const uniqueCustomers = Array.from(new Set(recentCustomers.map(c => c.customer_phone)))
          .map(phone => recentCustomers.find(c => c.customer_phone === phone))
          .filter(customer => customer.customer_name && customer.customer_phone);

        setCustomerSearchResults(uniqueCustomers.map(c => ({
          id: c.customer_phone,
          name: c.customer_name,
          phone: c.customer_phone,
          address: c.customer_address || ''
        })));
        return;
      }

      // 전화번호 검색을 위한 정규화
      const cleanSearchTerm = searchTerm.replace(/-/g, '');

      // services 테이블에서 검색
      const { data: serviceResults, error: serviceError } = await supabase
        .from('services')
        .select('customer_name, customer_phone, customer_address, brand')
        .eq('brand', brand)
        .or(`customer_phone.ilike.%${cleanSearchTerm}%,customer_name.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (serviceError) throw serviceError;

      // 중복 제거 및 결과 포맷팅
      const uniqueResults = Array.from(new Set(serviceResults.map(c => c.customer_phone)))
        .map(phone => serviceResults.find(c => c.customer_phone === phone))
        .filter(customer => customer.customer_name && customer.customer_phone)
        .map(customer => ({
          id: customer.customer_phone,
          name: customer.customer_name,
          phone: customer.customer_phone,
          address: customer.customer_address || ''
        }));

      setCustomerSearchResults(uniqueResults);
      
    } catch (err) {
      console.error('고객 검색 중 오류:', err);
      setSnackbar({
        open: true,
        message: '고객 검색 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // 검색어 입력 처리 함수
  const handleCustomerSearchInput = (event) => {
    setCustomerInputValue(event.target.value);
  };

  // 검색 실행 함수
  const executeCustomerSearch = async () => {
    const term = customerInputValue.trim();
    setCustomerSearchTerm(term);
    await searchCustomers(term);
  };

  // 엔터키 처리 함수
  const handleCustomerSearchKeyPress = (event) => {
    if (event.key === 'Enter') {
      executeCustomerSearch();
    }
  };

  // 고객 선택 핸들러
  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address || ''
    }));
    setCustomerSearchOpen(false);
    setCustomerInputValue('');
    setCustomerSearchResults([]);
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
      <Typography variant="h6" sx={{ 
        mb: 2,
        color: '#191f28',
        fontWeight: 600,
        // 언더라인 스타일 제거
        '&::after': {
          display: 'none'
        }
      }}>
        사용 부품
      </Typography>
      <Box sx={{ mb: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={showPriceEdit}
              onChange={e => setShowPriceEdit(e.target.checked)}
              color="primary"
            />
          }
          label="가격 수정"
        />
      </Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
        </Box>
        <Box sx={{ flex: 1 }}>
          <TextField
            size="small"
            label="영수증"
            name="receipt_link"
            value={receiptLink}
            onChange={handleReceiptLinkChange}
            sx={{
              '& .MuiInputBase-root': {
                bgcolor: '#ffffff'
              },
              width: '100%',
              maxWidth: '400px',
              ml: 'auto'
            }}
            InputProps={{
              endAdornment: receiptLink && (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => window.open(receiptLink, '_blank')}
                    size="small"
                    title="새 창에서 보기"
                    disabled={!receiptLink}
                  >
                    <OpenInNewIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      if (!receiptLink) return;
                      const previewUrl = receiptLink.includes('drive.google.com') 
                        ? receiptLink.replace('/view?usp=sharing', '/preview')
                        : receiptLink;
                      window.open(previewUrl, '_blank', 'width=800,height=600');
                    }}
                    size="small"
                    title="미리보기"
                    disabled={!receiptLink}
                  >
                    <VisibilityIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
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
              <TableCell align="right">가격 수정</TableCell>
              <TableCell align="center">용도</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedParts.map((part, index) => (
              <TableRow key={part.id}>
                <TableCell>{part.name}</TableCell>
                <TableCell>{part.code}</TableCell>
                <TableCell align="right">
                  {part.price.toLocaleString()}원
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    value={part.quantity}
                    onChange={e => handleQuantityChange(index, e.target.value)}
                    sx={{
                      width: '80px',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        bgcolor: '#f9fafb'
                      }
                    }}
                    InputProps={{
                      inputProps: { min: 1, step: '1' }
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  {(part.price * part.quantity).toLocaleString()}원
                </TableCell>
                <TableCell align="right" sx={{ minWidth: '200px' }}>
                  {showPriceEdit && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                      <TextField
                        type="number"
                        size="small"
                        value={part.price}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        onBlur={() => console.log('가격 입력 필드 blur - 현재 값:', {
                          '부품명': part.name,
                          '가격': part.price,
                          '총액': part.total
                        })}
                        sx={{ 
                          width: '120px',
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            bgcolor: '#f9fafb'
                          }
                        }}
                        InputProps={{
                          inputProps: { 
                            min: 0,
                            step: "1"
                          },
                          startAdornment: <InputAdornment position="start">₩</InputAdornment>
                        }}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSavePrice(index)}
                        sx={{ 
                          minWidth: 'auto',
                          px: 2,
                          bgcolor: '#3182f6',
                          '&:hover': { bgcolor: '#1b64da' }
                        }}
                      >
                        저장
                      </Button>
                    </Box>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Select
                    size="small"
                    value={part.usage || 'A/S'}
                    onChange={(e) => handleUsageChange(index, e.target.value)}
                    sx={{ 
                      minWidth: 100,
                      height: '32px',
                      '& .MuiSelect-select': {
                        py: 0.5
                      }
                    }}
                  >
                    <MenuItem value="A/S">A/S</MenuItem>
                    <MenuItem value="판매">판매</MenuItem>
                    <MenuItem value="워런티">워런티</MenuItem>
                  </Select>
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
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                          접수일자*
                        </Typography>
                        <TextField
                          fullWidth
                          required
                          type="date"
                          name="reception_date"
                          value={formData.reception_date || ''}
                          onChange={handleChange}
                          size="small"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: '36px',
                              borderRadius: 1,
                              bgcolor: '#f9fafb'
                            }
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '150px' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                          접수시간*
                        </Typography>
                        <TextField
                          select
                          fullWidth
                          required
                          name="reception_time"
                          value={formData.reception_time}
                          onChange={handleChange}
                          size="small"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: '36px',
                              borderRadius: 1,
                              bgcolor: '#f9fafb'
                            }
                          }}
                        >
                          {Array.from({ length: 48 }, (_, i) => {
                            const hour = Math.floor(i / 2);
                            const minute = (i % 2) * 30;
                            return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                          }).map((time) => (
                            <MenuItem key={time} value={time}>{time}</MenuItem>
                          ))}
                        </TextField>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                          완료일자
                        </Typography>
                        <TextField
                          fullWidth
                          type="date"
                          name="completion_date"
                          value={formData.completion_date || ''}
                          onChange={handleChange}
                          size="small"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: '36px',
                              borderRadius: 1,
                              bgcolor: '#f9fafb'
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Button
                        variant={formData.status === '접수' ? 'contained' : 'outlined'}
                        onClick={() => handleStatusChange('접수')}
                        sx={buttonStyle(formData.status === '접수')}
                      >
                        접수
                      </Button>
                      <Button
                        variant={formData.status === '처리중' ? 'contained' : 'outlined'}
                        onClick={() => handleStatusChange('처리중')}
                        sx={buttonStyle(formData.status === '처리중')}
                      >
                        처리중
                      </Button>
                      <Button
                        variant={formData.status === '완료' ? 'contained' : 'outlined'}
                        onClick={() => handleStatusChange('완료')}
                        sx={buttonStyle(formData.status === '완료')}
                      >
                        완료
                      </Button>
                    </Box>
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
                      <Button
                        size="small"
                        startIcon={<SearchIcon />}
                        onClick={() => setCustomerSearchOpen(true)}
                        sx={{
                          ml: 2,
                          color: '#3182f6',
                          fontSize: '0.875rem',
                          '&:hover': {
                            bgcolor: 'rgba(49, 130, 246, 0.04)'
                          }
                        }}
                      >
                        고객 검색
                      </Button>
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          required
                          size="small"
                          label="고객명"
                          name="customer_name"
                          value={formData.customer_name}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          required
                          size="small"
                          label="연락처"
                          name="customer_phone"
                          value={formData.customer_phone}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="주소"
                          name="customer_address"
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
                        <Autocomplete
                          freeSolo
                          options={productOptions}
                          value={formData.product_name}
                          onChange={(event, newValue) => {
                            setFormData(prev => ({
                              ...prev,
                              product_name: newValue || ''
                            }));
                          }}
                          onInputChange={(event, newInputValue) => {
                            setFormData(prev => ({
                              ...prev,
                              product_name: newInputValue
                            }));
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              fullWidth
                              size="small"
                              label="제품명"
                              name="product_name"
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 1,
                                  bgcolor: '#f9fafb'
                                }
                              }}
                            />
                          )}
                          renderOption={(props, option) => (
                            <li {...props}>
                              <Typography noWrap>
                                {option}
                              </Typography>
                            </li>
                          )}
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
                          <MenuItem value="공홈">공홈</MenuItem>
                          <MenuItem value="방문">방문</MenuItem>
                          <MenuItem value="전화">전화</MenuItem>
                          <MenuItem value="온라인">온라인</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          name="delivery_method"
                          label="배송방법"
                          value={formData.delivery_method || ''}
                          onChange={handleChange}
                        >
                          <MenuItem value="방문수령">방문수령</MenuItem>
                          <MenuItem value="택배">택배</MenuItem>
                          <MenuItem value="퀵-선불">퀵-선불</MenuItem>
                          <MenuItem value="퀵-착불">퀵-착불</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          name="seller"
                          label="구입처"
                          value={formData.seller || ''}
                          onChange={handleChange}
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
                      label="문의내용"
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
                  <Grid item xs={12}>
                    <Autocomplete
                      multiple
                      freeSolo
                      options={availableTags}
                      value={tags}
                      onChange={handleTagInput}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="태그"
                          placeholder="태그를 입력하거나 선택하세요"
                          helperText="엔터를 눌러 새 태그를 추가하세요"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            sx={{
                              bgcolor: '#e8f3ff',
                              color: '#3182f6',
                              '& .MuiChip-deleteIcon': {
                                color: '#3182f6',
                                '&:hover': {
                                  color: '#1b64da'
                                }
                              }
                            }}
                          />
                        ))
                      }
                    />
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {availableTags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          onClick={() => {
                            if (!tags.includes(tag)) {
                              setTags([...tags, tag]);
                            }
                          }}
                          sx={{
                            bgcolor: tags.includes(tag) ? '#e8f3ff' : '#f2f4f6',
                            color: tags.includes(tag) ? '#3182f6' : '#4e5968',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: tags.includes(tag) ? '#e8f3ff' : '#e5e8eb'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          {/* 부품 정보 섹션 */}
          <Grid item xs={12}>
            {partsSection}
          </Grid>

          {/* 하단 버튼 영역 */}
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
              {isEditing ? (
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
                  저장
                </Button>
              ) : (
                <Button 
                  onClick={() => setIsEditing(true)}
                  variant="contained"
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
              )}
            </Box>
          </Box>
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={2000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            top: '50% !important',
            transform: 'translateY(-50%)'
          }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            variant="filled"
            sx={{
              width: '100%',
              minWidth: '300px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '1rem',
              '.MuiAlert-icon': {
                fontSize: '24px'
              }
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* 확인 대화상자 추가 */}
        <Dialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        >
          <DialogTitle>{confirmDialog.title}</DialogTitle>
          <DialogContent>
            <Typography>{confirmDialog.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
              sx={{ color: '#666' }}
            >
              취소
            </Button>
            <Button 
              onClick={confirmDialog.onConfirm}
              variant="contained"
              sx={{ 
                bgcolor: '#3182f6',
                '&:hover': { bgcolor: '#1b64da' }
              }}
            >
              확인
            </Button>
          </DialogActions>
        </Dialog>

        {/* 미리보기 다이얼로그 */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>영수증 미리보기</Typography>
              <IconButton onClick={() => setPreviewOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ 
              width: '100%', 
              height: '80vh', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              {previewType === 'pdf' ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title="PDF 미리보기"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="영수증 이미지"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}
            </Box>
          </DialogContent>
        </Dialog>

        {/* 고객 검색 다이얼로그 */}
        <Dialog
          open={customerSearchOpen}
          onClose={() => setCustomerSearchOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            고객 검색
            <IconButton
              onClick={() => setCustomerSearchOpen(false)}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="고객명 또는 연락처로 검색"
                value={customerInputValue}
                onChange={handleCustomerSearchInput}
                onKeyPress={handleCustomerSearchKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchLoading && (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>고객명</TableCell>
                    <TableCell>연락처</TableCell>
                    <TableCell>주소</TableCell>
                    <TableCell align="center">선택</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customerSearchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        {customerInputValue.length > 0 
                          ? '검색 결과가 없습니다.'
                          : '검색어를 입력하세요. (2글자 이상)'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerSearchResults.map((customer) => (
                      <TableRow key={customer.id} hover>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{customer.address}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            onClick={() => handleCustomerSelect(customer)}
                            sx={{
                              minWidth: 'auto',
                              color: '#3182f6',
                              '&:hover': {
                                bgcolor: 'rgba(49, 130, 246, 0.04)'
                              }
                            }}
                          >
                            선택
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default ServiceDetail; 