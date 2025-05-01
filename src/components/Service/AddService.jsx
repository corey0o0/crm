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
  InputAdornment,
  FormControlLabel,
  Checkbox
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
import PrintIcon from '@mui/icons-material/Print';
import { API_CONFIG } from '../../config/api';
import XLSX from 'xlsx';
import { Close as CloseIcon } from '@mui/icons-material';

// 접수방법과 배송방법 옵션
const RECEPTION_TYPES = ['공홈', '방문', '전화', '대리점', '기타'];
const DELIVERY_METHODS = ['방문수령', '택배', '퀵-선불', '퀵-착불'];

// 사전 정의된 태그 목록
const PREDEFINED_TAGS = [
  'DBSM', '배터리', '모터', '컨트롤러', '브레이크', '타이어', '전체점검',
  'E010', 'E004', 'E007', '사고수리', '충전안됨'
];

// 버튼 스타일 정의
const buttonStyle = (isSelected, currentStatus) => ({
  marginLeft: '8px',
  backgroundColor: isSelected ? (
    currentStatus === '접수' ? '#1976d2' :
    currentStatus === '처리중' ? '#ed6c02' :
    currentStatus === '완료' ? '#2e7d32' : '#3182f6'
  ) : '#f2f4f6',
  color: isSelected ? '#ffffff' : '#4e5968',
  '&:hover': {
    backgroundColor: isSelected ? (
      currentStatus === '접수' ? '#1565c0' :
      currentStatus === '처리중' ? '#d65f02' :
      currentStatus === '완료' ? '#1e5e20' : '#1b64da'
    ) : '#e5e8eb'
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
    reception_time: '00:00',
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
    status: '접수'
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
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [modifiedPrice, setModifiedPrice] = useState('');
  const [selectedPart, setSelectedPart] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });

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

  // 부품 선택 핸들러
  const handlePartSelect = (part) => {
    setSelectedPart(part);
    setModifiedPrice(part.price || '');
  };

  // 부품 추가 핸들러
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
      setOpenPartsDialog(false);
    }
  };

  // 가격 수정 핸들러
  const handlePriceChange = (index, newPrice) => {
    try {
      const updatedParts = [...selectedParts];
      const priceValue = newPrice === '' ? 0 : Number(newPrice);
      
      updatedParts[index] = {
        ...updatedParts[index],
        price: priceValue,
        total: priceValue * updatedParts[index].quantity
      };
      
      setSelectedParts(updatedParts);
    } catch (err) {
      console.error('가격 수정 중 오류:', err);
      setSnackbar({
        open: true,
        message: '가격 수정 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 용도 변경 핸들러
  const handleUsageChange = (index, newUsage) => {
    const updatedParts = [...selectedParts];
    updatedParts[index] = {
      ...updatedParts[index],
      usage: newUsage
    };
    setSelectedParts(updatedParts);
  };

  // 수량 변경 핸들러
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
              reception_time: row['접수시간'] || new Date().getHours() + ':' + (Math.floor(new Date().getMinutes() / 30) * 30).toString().padStart(2, '0'),
              reception_type: row['접수방법'] || '',
              repair_date: parseDate(row['입고일']) || '',
              completion_date: parseDate(row['출고일']) || '',
              delivery_method: row['배송방법'] || '',
              customer_name: row['고객명'] || '',
              customer_phone: row['연락처'] || '',
              customer_address: row['주소'] || '',
              product_name: row['제품'] || '',
              symptom: row['문의내용'] || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 날짜와 시간 결합
      const combinedReceptionDate = `${formData.reception_date}T${formData.reception_time}:00`;

      // 서비스 데이터 등록
      const { data: insertedService, error: insertError } = await supabase
        .from('services')
        .insert([{
          brand: selectedBrand,
          reception_date: combinedReceptionDate,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_address: formData.customer_address,
          product_name: formData.product_name,
          mileage: formData.mileage,
          symptom: formData.symptom,
          solution: formData.solution,
          reception_type: formData.reception_type,
          status: formData.status,
          delivery_method: formData.delivery_method,
          seller: formData.seller,
          receipt_link: receiptLink,
          writer: formData.writer || '관리자'
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // 태그 등록
      if (tags.length > 0) {
        const formattedTags = tags.map(tag => ({
          service_id: insertedService.id,
          tag_name: tag.startsWith('#') ? tag : `#${tag}`
        }));

        const { error: tagError } = await supabase
          .from('service_tags')
          .insert(formattedTags);

        if (tagError) throw tagError;
      }

      // 부품 등록
      if (selectedParts.length > 0) {
        const partsToInsert = selectedParts.map(part => ({
          service_id: insertedService.id,
          part_id: part.id,
          quantity: part.quantity,
          price: part.price,
          usage: part.usage || 'A/S'
        }));

        const { error: partsError } = await supabase
          .from('service_parts')
          .insert(partsToInsert);

        if (partsError) throw partsError;
      }

      // 로컬 스토리지에 새로 등록된 항목의 ID 저장
      localStorage.setItem('highlightServiceId', String(insertedService.id));

      setSnackbar({
        open: true,
        message: 'A/S가 성공적으로 등록되었습니다.',
        severity: 'success'
      });

      // 2초 후 리스트 페이지로 이동
      setTimeout(() => {
        navigate('/services');
      }, 2000);

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setSnackbar({
        open: true,
        message: `오류가 발생했습니다: ${error.message}`,
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
    if (newStatus === '완료') {
      setConfirmDialog({
        open: true,
        title: 'A/S 완료 확인',
        message: '해당 A/S를 완료 처리하시겠습니까?',
        onConfirm: () => {
    setStatus(newStatus);
          setFormData(prev => {
            const updatedData = { ...prev, status: newStatus };
            if (!prev.completion_date) {
      const currentDate = new Date().toISOString().split('T')[0];
              updatedData.completion_date = currentDate;
            }
            return updatedData;
          });
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
    } else {
      setStatus(newStatus);
      setFormData(prev => ({
        ...prev,
        status: newStatus
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
      console.log('검색 시작:', { searchTerm, selectedBrand });

      // 검색어가 2글자 미만이면 최근 고객 목록 표시
      if (searchTerm.length < 2) {
        const { data: recentCustomers, error: recentError } = await supabase
          .from('services')
          .select('customer_name, customer_phone, customer_address, brand')
          .eq('brand', selectedBrand)
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
        .eq('brand', selectedBrand)
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

  // 프린트 출력 함수 추가
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>A/S 작업지시서</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .header { text-align: center; margin-bottom: 20px; }
            .section { margin-bottom: 15px; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .row { display: flex; }
            .col { flex: 1; padding: 0 10px; }
            
            /* 절취선 스타일 */
            .cut-section {
              margin-top: 50px;
              border-top: 1px dashed #999;
              padding-top: 10px;
              display: flex;
              width: 100%;
            }
            .cut-box {
              flex: 1;
              height: 150px;
              border-right: 1px dashed #999;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 10px;
            }
            .cut-box:last-child {
              border-right: none;
            }
            .customer-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .customer-phone {
              font-size: 18px;
            }
            
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>A/S 작업지시서</h2>
            <p>접수일자: ${formData.reception_date || '-'}</p>
          </div>
          
          <div class="row">
            <div class="col">
              <div class="section">
                <div class="label">고객 정보</div>
                <p>고객명: ${formData.customer_name || '-'}</p>
                <p>연락처: ${formData.customer_phone || '-'}</p>
                <p>주소: ${formData.customer_address || '-'}</p>
              </div>
            </div>
            
            <div class="col">
              <div class="section">
                <div class="label">제품 정보</div>
                <p>브랜드: ${formData.brand || '-'}</p>
                <p>제품명: ${formData.product_name || '-'}</p>
                <p>주행거리: ${formData.mileage || '-'}</p>
                <p>구입처: ${formData.seller || '-'}</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="label">A/S 내역</div>
            <p>문의내용: ${formData.symptom || '-'}</p>
            <p>처리내역: ${formData.solution || '-'}</p>
          </div>
          
          <div class="section">
            <div class="label">사용 부품</div>
            <table>
              <thead>
                <tr>
                  <th>부품명</th>
                  <th>코드</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>용도</th>
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                ${selectedParts.map(part => `
                  <tr>
                    <td>${part.name}</td>
                    <td>${part.code || '-'}</td>
                    <td>${part.quantity}</td>
                    <td>${part.price?.toLocaleString()}원</td>
                    <td>${part.usage || 'A/S'}</td>
                    <td>${(part.price * part.quantity)?.toLocaleString()}원</td>
                  </tr>
                `).join('')}
                <tr>
                  <td colspan="5" style="text-align: right;"><strong>합계</strong></td>
                  <td><strong>${selectedParts.reduce((sum, part) => sum + (part.price * part.quantity || 0), 0).toLocaleString()}원</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- 절취선 섹션 추가 -->
          <div class="cut-section">
            <div class="cut-box">
              <div class="customer-name">${formData.customer_name || '-'}</div>
              <div class="customer-phone">${formData.customer_phone || '-'}</div>
            </div>
            <div class="cut-box">
              <div class="customer-name">${formData.customer_name || '-'}</div>
              <div class="customer-phone">${formData.customer_phone || '-'}</div>
            </div>
            <div class="cut-box">
              <div class="customer-name">${formData.customer_name || '-'}</div>
              <div class="customer-phone">${formData.customer_phone || '-'}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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
                      value={formData.reception_date}
                      onChange={handleInputChange}
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
                      fullWidth
                          required
                          select
                          name="reception_time"
                          value={formData.reception_time}
                          onChange={handleInputChange}
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
                      onChange={handleInputChange}
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
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          onClick={() => handleStatusChange('접수')}
                          variant={status === '접수' ? "contained" : "outlined"}
                          size="small"
                          sx={buttonStyle(status === '접수', status)}
                        >
                          접수
                        </Button>
                        <Button 
                          onClick={() => handleStatusChange('처리중')}
                          variant={status === '처리중' ? "contained" : "outlined"}
                          size="small"
                          sx={buttonStyle(status === '처리중', status)}
                        >
                          처리중
                        </Button>
                        <Button 
                          onClick={() => handleStatusChange('완료')}
                          variant={status === '완료' ? "contained" : "outlined"}
                          size="small"
                          sx={buttonStyle(status === '완료', status)}
                        >
                          완료
                        </Button>
                      </Box>
                      <TextField
                        size="small"
                        name="writer"
                        label="작성자"
                        value={formData.writer}
                        onChange={handleInputChange}
                        sx={{ 
                          width: '150px',
                          '& .MuiOutlinedInput-root': {
                            height: '36px',
                            borderRadius: 1,
                            bgcolor: '#f9fafb'
                          }
                        }}
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
                      label="문의내용"
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
                fontWeight: 600,
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
                        <TableCell align="right">수량</TableCell>
                        <TableCell align="right">금액</TableCell>
                        <TableCell align="right">가격 수정</TableCell>
                        <TableCell align="center">용도</TableCell>
                        <TableCell align="center">삭제</TableCell>
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
                        <TableCell colSpan={3} />
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
                onClick={handlePrint}
                startIcon={<PrintIcon />}
                sx={{
                  color: '#3182f6',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(49, 130, 246, 0.04)'
                  }
                }}
              >
                프린트
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
        autoHideDuration={2000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          top: '50% !important',
          transform: 'translateY(-50%)'
        }}
      >
        <Alert
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
        <DialogTitle>부품 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="부품명 또는 코드로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell>브랜드</TableCell>
                  <TableCell align="right">단가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableParts
                  .filter(part => 
                    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    part.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    part.brand.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((part) => (
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

      {/* 확인 다이얼로그 */}
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
    </Box>
  );
}

export default AddService;


