import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { read, utils, writeFile } from 'xlsx';
import ReceiptScanner from '../Receipt/ReceiptScanner';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Autocomplete,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Popover,
  CircularProgress,
  Stack,
  InputAdornment
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { API_CONFIG } from '../../config/api';
import XLSX from 'xlsx';
import { Close as CloseIcon } from '@mui/icons-material';

// 접수방법과 배송방법 옵션
const RECEPTION_TYPES = ['방문', '전화', '대리점','기타'];
const DELIVERY_METHODS = ['방문수령', '택배', '퀵-선불', '퀵-착불'];

// 사전 정의된 태그 목록
const PREDEFINED_TAGS = [
  'DBSM', '배터리', '모터', '컨트롤러', '브레이크', '타이어', '전체점검',
  'E010', 'E004', 'E007', '사고수리', '충전안됨'
];

// 버튼 스타일 정의
const buttonStyle = (isSelected) => ({
  marginLeft: '8px',
  backgroundColor: isSelected ? '#3182f6' : '#f2f4f6',
  color: isSelected ? '#ffffff' : '#4e5968',
  '&:hover': {
    backgroundColor: isSelected ? '#1b64da' : '#e5e8eb'
  }
});

function AddService() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [submitting, setSubmitting] = useState(false);
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({
    brand: selectedBrand,
    reception_date: new Date().toISOString().split('T')[0],
    repair_date: '',
    completion_date: '',
    reception_type: '',
    delivery_method: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    product_name: '',
    mileage: '',
    symptom: '',
    solution: '',
    note: '',
    writer: '',
    seller: '',
  });
  const [tags, setTags] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [partQuantity, setPartQuantity] = useState(1);
  const [status, setStatus] = useState('접수');
  const [availableTags] = useState([
    '전체점검', '브레이크-패드', '브레이크-로터', '브레이크-교체', '배터리',
    '충전기', '모터', '워런티', '사고-보험', 'E07','E09','E010'
  ]);
  const [receiptLink, setReceiptLink] = useState('');
  const [receiptPreviewAnchor, setReceiptPreviewAnchor] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (location.state?.selectedBrand) {
      setSelectedBrand(location.state.selectedBrand);
      setFormData(prev => ({ ...prev, brand: location.state.selectedBrand }));
    }
  }, [location.state]);

  // 서비스 목록 조회
  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('brand', selectedBrand)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('서비스 목록 조회 중 오류:', error);
    }
  };

  // 부품 목록 조회
  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', selectedBrand)
        .order('name');

      if (error) throw error;
      setAvailableParts(data);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setSnackbar({
        open: true,
        message: '부품 목록을 불러오는 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 부품 검색 다이얼로그 열기
  const handleOpenPartsDialog = () => {
    setOpenPartsDialog(true);
    setSearchTerm('');
    fetchParts();
  };

  // 부품 검색 다이얼로그 닫기
  const handleClosePartsDialog = () => {
    setOpenPartsDialog(false);
    setSearchTerm('');
    setPartQuantity(1);
  };

  // 부품 추가
  const handleAddPart = (part) => {
    const existingPart = selectedParts.find(p => p.id === part.id);
    if (existingPart) {
      setSelectedParts(prev => prev.map(p => 
        p.id === part.id 
          ? { ...p, quantity: p.quantity + partQuantity }
          : p
      ));
    } else {
      setSelectedParts(prev => [...prev, { ...part, quantity: partQuantity }]);
    }
    setPartQuantity(1);
  };

  // 부품 삭제
  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(p => p.id !== partId));
  };

  // 영수증 이미지 분석 함수
  const analyzeReceiptImage = async (imageData) => {
    try {
      const base64Image = await convertToBase64(imageData);
      
      const response = await fetch(API_CONFIG.OPENAI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "이 영수증 이미지에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error('영수증 분석 API 호출 실패');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('영수증 분석 중 오류:', error);
      throw error;
    }
  };

  // 파츠 매칭 함수
  const matchPartsWithItems = async (items) => {
    try {
      const { data: parts, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', selectedBrand);

      if (error) throw error;

      return items.map(item => {
        const matchedPart = parts.find(part => 
          part.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(part.name.toLowerCase())
        );

        return matchedPart ? {
          part_id: matchedPart.id,
          quantity: item.quantity || 1,
          price: matchedPart.price
        } : null;
      }).filter(Boolean);
    } catch (error) {
      console.error('파츠 매칭 중 오류:', error);
      return [];
    }
  };

  // Base64 변환 함수
  const convertToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // 엑셀 템플릿 다운로드 함수
  const handleDownloadTemplate = () => {
    try {
      // 템플릿 데이터 생성
      const templateData = [
        {
          '날짜': '2024-03-20',
          '완료 여부': '접수',
          '작성자': '',
          '이름': '홍길동',
          '연락처': '010-1234-5678',
          '기종명': 'X-RIDER 전기자전거',
          '누적 주행거리': '100km',
          '구입처': '',
          '문의내용': '배터리 충전 안됨',
          '처리내용': '',
          '첨부': '',
          'JPG': '',
          '기타': '',
          '문의 위치': ''
        }
      ];

      // 워크시트 생성
      const ws = XLSX.utils.json_to_sheet(templateData);

      // 열 너비 설정
      const wscols = [
        { wch: 12 },  // 날짜
        { wch: 10 },  // 완료 여부
        { wch: 10 },  // 작성자
        { wch: 15 },  // 이름
        { wch: 15 },  // 연락처
        { wch: 30 },  // 기종명
        { wch: 15 },  // 누적 주행거리
        { wch: 15 },  // 구입처
        { wch: 40 },  // 문의내용
        { wch: 40 },  // 처리내용
        { wch: 30 },  // 첨부
        { wch: 10 },  // JPG
        { wch: 30 },  // 기타
        { wch: 20 }   // 문의 위치
      ];
      ws['!cols'] = wscols;

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "A/S등록템플릿");

      // 파일 다운로드
      XLSX.writeFile(wb, `A/S등록템플릿_${selectedBrand}.xlsx`);

      setSnackbar({
        open: true,
        message: '템플릿이 다운로드되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('템플릿 다운로드 중 오류:', err);
      setSnackbar({
        open: true,
        message: '템플릿 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 영수증 이미지 URL에서 이미지 데이터 가져오기
  const fetchImageFromUrl = async (url) => {
    try {
      // Google Drive 공유 링크를 직접 다운로드 링크로 변환
      const fileId = url.match(/\/d\/(.*?)\/view/)?.[1];
      if (!fileId) throw new Error('Invalid Google Drive URL');
      
      const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(directUrl);
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  };

  // 날짜 변환 함수 수정
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    try {
      // 날짜가 이미 Date 객체인 경우
      if (dateStr instanceof Date) {
        return dateStr.toISOString().split('T')[0];
      }

      // 문자열이 아닌 경우 문자열로 변환
      const dateString = String(dateStr);

      // 8/1 형식 처리
      if (dateString.includes('/')) {
        const [month, day] = dateString.split('/').map(num => String(num).trim());
        const year = new Date().getFullYear();
        const formattedMonth = month.padStart(2, '0');
        const formattedDay = day.padStart(2, '0');
        return `${year}-${formattedMonth}-${formattedDay}`;
      }

      // Excel의 날짜 형식(시리얼 넘버) 처리
      const excelDate = parseInt(dateString);
      if (!isNaN(excelDate)) {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
      }

      // 기타 형식의 날짜 문자열 처리
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      console.error('날짜 변환 중 오류:', error);
      return null;
    }
  };

  // 엑셀 업로드 처리 함수 수정
  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          console.log('엑셀 데이터 파싱 결과:', jsonData);

          // 데이터 처리
          const validData = jsonData.map((row, index) => {
            const currentDate = new Date().toISOString().split('T')[0];
            
            return {
              brand: selectedBrand,
              reception_date: parseDate(row['접수일자']) || currentDate,
              reception_type: row['접수방법'] || '',
              repair_date: parseDate(row['입고일']) || '',
              completion_date: parseDate(row['출고일']) || '',
              delivery_method: row['배송방법'] || '',
              customer_name: row['고객명'] || '',
              customer_phone: row['연락처'] || '',
              customer_address: row['주소'] || '',
              product_name: row['제품'] || '',
              symptom: row['증상'] || '',
              solution: row['처리내역'] || '',
              status: row['상태'] || '접수',
              note: row['메모'] || '',
              receipt_link: row['JPG'] || '',
              seller: row['구매처'] || '',
              created_at: new Date().toISOString()
            };
          });

          // 데이터 일괄 등록
          const { data: insertedData, error } = await supabase
            .from('services')
            .insert(validData)
            .select();

          if (error) throw error;

          console.log('등록된 데이터:', insertedData);
          
          setSnackbar({
            open: true,
            message: `${validData.length}건의 A/S 정보가 등록되었습니다.`,
            severity: 'success'
          });

          // 목록 새로고침
          fetchServices();
        } catch (err) {
          console.error('엑셀 데이터 처리 중 오류:', err);
          setSnackbar({
            open: true,
            message: '엑셀 데이터 처리 중 오류가 발생했습니다.',
            severity: 'error'
          });
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('파일 업로드 중 오류:', err);
      setSnackbar({
        open: true,
        message: '파일 업로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
    // 파일 입력 초기화
    event.target.value = '';
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      // 날짜 필드 처리
      const processDate = (dateStr) => {
        return dateStr && dateStr.trim() !== '' ? dateStr : null;
      };

      // 1. 서비스 등록
      const serviceData = {
        brand: selectedBrand,
        reception_date: processDate(formData.reception_date) || new Date().toISOString().split('T')[0],
        repair_date: processDate(formData.repair_date),
        completion_date: processDate(formData.completion_date),
        reception_type: formData.reception_type || '',
        delivery_method: formData.delivery_method || '',
        customer_name: formData.customer_name || '',
        customer_phone: formData.customer_phone || '',
        customer_address: formData.customer_address || '',
        product_name: formData.product_name || '',
        mileage: formData.mileage || '',
        symptom: formData.symptom || '',
        solution: formData.solution || '',
        note: formData.note || '',
        status: status || '접수',
        receipt_link: receiptLink || null,
        writer: formData.writer || '관리자',
        seller: formData.seller || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 필수 필드 검증
      if (!serviceData.customer_name) {
        throw new Error('고객명은 필수 입력 항목입니다.');
      }

      if (!serviceData.product_name) {
        throw new Error('제품명은 필수 입력 항목입니다.');
      }

      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single();

      if (serviceError) throw serviceError;

      // 2. 태그 등록
      if (tags.length > 0) {
        const { error: tagsError } = await supabase
          .from('service_tags')
          .insert(tags.map(tag => ({
            service_id: newService.id,
            tag_name: tag.startsWith('#') ? tag : `#${tag}`
          })));

        if (tagsError) throw tagsError;
      }

      // 3. 부품 등록
      if (selectedParts.length > 0) {
        const { error: partsError } = await supabase
          .from('service_parts')
          .insert(selectedParts.map(part => ({
            service_id: newService.id,
            part_id: part.id,
            quantity: part.quantity,
            price: part.price
          })));

        if (partsError) throw partsError;
      }

      // 성공 처리
      setSnackbar({
        open: true,
        message: 'A/S가 성공적으로 등록되었습니다.',
        severity: 'success'
      });

      // 3초 후 목록 페이지로 이동
      setTimeout(() => {
        navigate('/services');
      }, 3000);

    } catch (error) {
      console.error('Error adding service:', error);
      setSnackbar({
        open: true,
        message: error.message || '서비스 등록 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleOpenReceiptScanner = () => {
    setOpenReceiptDialog(true);
  };

  const handleCloseReceiptScanner = () => {
    setOpenReceiptDialog(false);
  };

  const handlePartsSelected = async (selectedParts) => {
    // 선택된 파츠 처리 로직
    setOpenReceiptDialog(false);
  };

  // 스타일 상수 추가
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

  // 태그 입력 핸들러
  const handleTagInput = (event, value, reason) => {
    if (reason === 'input') {
      setTags(value ? [...new Set([...tags, value])] : tags);
    } else {
      setTags(value);
    }
  };

  // 영수증 미리보기 핸들러
  const handleReceiptMouseEnter = (event) => {
    if (receiptLink) {
      setReceiptPreviewAnchor(event.currentTarget);
    }
  };

  const handleReceiptMouseLeave = () => {
    setReceiptPreviewAnchor(null);
  };

  // PDF 로드 성공 핸들러
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  // 상태 변경 핸들러
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === '확인') {
      const currentDate = new Date().toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        completion_date: currentDate,
        repair_date: currentDate
      }));
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
          .filter(item => item.brand === selectedBrand)
          .map(item => item.product_name)
      )].filter(Boolean); // null/empty 값 제거

      setProductOptions(uniqueProducts);
    } catch (err) {
      console.error('제품명 목록 조회 중 오류:', err);
    }
  };

  // 브랜드 선택 시 제품명 목록 업데이트
  useEffect(() => {
    if (selectedBrand) {
      fetchProductNames();
    }
  }, [selectedBrand]);

  // 고객 검색 함수
  const searchCustomers = async (searchTerm) => {
    try {
      setSearchLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // 브랜드 필터링은 클라이언트 사이드에서 수행
      const filteredData = selectedBrand 
        ? data.filter(customer => customer.brand === selectedBrand)
        : data;

      console.log('검색 결과:', filteredData); // 디버깅을 위한 로그

      setCustomerSearchResults(filteredData || []);
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

  // 고객 검색 입력 핸들러 수정
  const handleCustomerSearchChange = async (e) => {
    const value = e.target.value;
    setCustomerSearchTerm(value);
    
    if (value.length >= 2) {
      await searchCustomers(value);
    } else {
      setCustomerSearchResults([]);
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
  };

  return (
    <Box sx={{ mt: 3, mx: 'auto', width: '95%', maxWidth: 1400 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Button
          onClick={handleCancel}
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

      <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)', bgcolor: '#ffffff' }}>
        <Typography variant="h5" gutterBottom sx={{ 
          mb: 4, 
          color: '#191f28',
          fontWeight: 600 
        }}>
          A/S 신규 등록
        </Typography>

        <form onSubmit={handleSubmit}>
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
                    <TextField
                      fullWidth
                      required
                      label="접수일자"
                      type="date"
                      name="reception_date"
                      value={formData.reception_date}
                      onChange={handleInputChange}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          bgcolor: '#f9fafb'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="완료일"
                      type="date"
                      name="repair_date"
                      value={formData.repair_date}
                      onChange={handleInputChange}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          bgcolor: '#f9fafb'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          onClick={() => handleStatusChange('접수')}
                          variant={status === '접수' ? "contained" : "outlined"}
                          size="small"
                          sx={buttonStyle(status === '접수')}
                        >
                          접수
                        </Button>
                        <Button 
                          onClick={() => handleStatusChange('처리')}
                          variant={status === '처리' ? "contained" : "outlined"}
                          size="small"
                          sx={buttonStyle(status === '처리')}
                        >
                          처리
                        </Button>
                        <Button 
                          onClick={() => handleStatusChange('확인')}
                          variant={status === '확인' ? "contained" : "outlined"}
                          size="small"
                          sx={buttonStyle(status === '확인')}
                        >
                          확인
                        </Button>
                      </Box>
                      <TextField
                        size="small"
                        name="writer"
                        label="작성자"
                        value={formData.writer}
                        onChange={handleInputChange}
                        sx={{ width: '150px' }}
                      />
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
                          onChange={handleInputChange}
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
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="주소"
                          name="customer_address"
                          value={formData.customer_address}
                          onChange={handleInputChange}
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
                          value={selectedBrand}
                          disabled
                          onChange={(e) => {
                            setSelectedBrand(e.target.value);
                            setFormData(prev => ({ ...prev, brand: e.target.value }));
                          }}
                        >
                          <MenuItem value="XRB">X-RIDER BIKE</MenuItem>
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
                              required
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
                          label="주행거리"
                          name="mileage"
                          value={formData.mileage}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="구입처"
                          name="seller"
                          value={formData.seller || ''}
                          onChange={handleInputChange}
                          placeholder="구입처를 입력하세요"
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
                          onChange={handleInputChange}
                        >
                          {RECEPTION_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          name="delivery_method"
                          label="배송방법"
                          value={formData.delivery_method}
                          onChange={handleInputChange}
                        >
                          {DELIVERY_METHODS.map((method) => (
                            <MenuItem key={method} value={method}>{method}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            {/* 오른쪽 컬럼: A/S 내역 */}
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle1" sx={sectionStyle}>
                  A/S 내역
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      multiline
                      rows={5}
                      name="symptom"
                      label="증상"
                      value={formData.symptom}
                      onChange={handleInputChange}
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
                      onChange={handleInputChange}
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
                            key={index}
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
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          {/* 부품 정보 섹션 */}
          <Grid item xs={12}>
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ 
                mb: 2,
                color: '#191f28',
                fontWeight: 600
              }}>
                사용 부품
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    startIcon={<SearchIcon />}
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
                    onClick={handleOpenReceiptScanner}
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
                    label="영수증 링크"
                    value={receiptLink}
                    onChange={(e) => setReceiptLink(e.target.value)}
                    onMouseEnter={handleReceiptMouseEnter}
                    onMouseLeave={handleReceiptMouseLeave}
                    sx={{ 
                      width: '100%',
                      maxWidth: '400px',
                      ml: 'auto',
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#ffffff'
                      }
                    }}
                    size="small"
                    InputProps={{
                      endAdornment: receiptLink && (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => window.open(receiptLink, '_blank')}
                            size="small"
                            title="새 창에서 보기"
                          >
                            <OpenInNewIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handlePreview(receiptLink)}
                            size="small"
                            title="미리보기"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
              </Stack>

              {/* 부품 테이블 */}
              {selectedParts.length > 0 && (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>부품명</TableCell>
                        <TableCell>코드</TableCell>
                        <TableCell align="right">단가</TableCell>
                        <TableCell align="center">수량</TableCell>
                        <TableCell align="right">금액</TableCell>
                        <TableCell align="center">삭제</TableCell>
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
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  if (part.quantity > 1) {
                                    setSelectedParts(prev => prev.map(p => 
                                      p.id === part.id 
                                        ? { ...p, quantity: p.quantity - 1 }
                                        : p
                                    ));
                                  }
                                }}
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                              <TextField
                                type="number"
                                size="small"
                                value={part.quantity}
                                onChange={(e) => {
                                  const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                                  setSelectedParts(prev => prev.map(p => 
                                    p.id === part.id 
                                      ? { ...p, quantity: newQuantity }
                                      : p
                                  ));
                                }}
                                inputProps={{ 
                                  min: 1,
                                  style: { 
                                    textAlign: 'center',
                                    width: '50px',
                                    padding: '4px'
                                  }
                                }}
                              />
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  setSelectedParts(prev => prev.map(p => 
                                    p.id === part.id 
                                      ? { ...p, quantity: p.quantity + 1 }
                                      : p
                                  ));
                                }}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {((part.price || 0) * part.quantity).toLocaleString()}원
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
              )}
            </Box>
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
            <Box />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button 
                onClick={handleCancel}
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
                등록
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 영수증 스캐너 다이얼로그 */}
      <Dialog
        open={openReceiptDialog}
        onClose={handleCloseReceiptScanner}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>영수증 스캔</DialogTitle>
        <DialogContent>
          <ReceiptScanner
            onPartsSelected={(parts) => {
              // 선택된 파츠를 현재 선택된 파츠 목록에 추가
              const newParts = parts.map(part => ({
                id: part.id,
                name: part.name,
                code: part.code,
                price: part.price,
                quantity: part.quantity || 1
              }));
              
              setSelectedParts(prevParts => {
                const updatedParts = [...prevParts];
                newParts.forEach(newPart => {
                  const existingPartIndex = updatedParts.findIndex(p => p.id === newPart.id);
                  if (existingPartIndex >= 0) {
                    updatedParts[existingPartIndex].quantity += newPart.quantity;
                  } else {
                    updatedParts.push(newPart);
                  }
                });
                return updatedParts;
              });
              
              handleCloseReceiptScanner();
            }}
            isDialogMode={true}
          />
        </DialogContent>
      </Dialog>

      {/* 부품 검색 다이얼로그 */}
      <Dialog
        open={openPartsDialog}
        onClose={handleClosePartsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>부품 검색</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="부품명 또는 코드 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell align="right">단가</TableCell>
                  <TableCell align="center">수량</TableCell>
                  <TableCell align="center">추가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableParts
                  .filter(part => 
                    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    part.code.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((part) => (
                    <TableRow key={part.id}>
                      <TableCell>{part.name}</TableCell>
                      <TableCell>{part.code}</TableCell>
                      <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          size="small"
                          value={partQuantity}
                          onChange={(e) => setPartQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          inputProps={{ min: 1, style: { textAlign: 'center' } }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="primary"
                          onClick={() => handleAddPart(part)}
                        >
                          <AddIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePartsDialog}>닫기</Button>
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
              value={customerSearchTerm}
              onChange={handleCustomerSearchChange}
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
                      {customerSearchTerm.length > 0 
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
  );
}

export default AddService;


