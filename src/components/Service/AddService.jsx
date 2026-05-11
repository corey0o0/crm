import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { readExcelFile } from '../../utils/excelUtils';
import CustomerHistoryDialog from './CustomerHistoryDialog';
import CustomerSearchModal from './CustomerSearchModal';
import PartsSelectionDialog from './PartsSelectionDialog';
import useAutoSave from '../../hooks/useAutoSave';
import { processServiceCompletion } from '../../utils/inventoryUtils';
import { logAction } from '../../utils/auditLog';
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
  Checkbox,
  Link
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  CloudDone as CloudDoneIcon
} from '@mui/icons-material';
import { API_CONFIG } from '../../config/api';
import { downloadExcel } from '../../utils/excelUtils';
import { formatKoreanDateTime } from '../../utils/dateUtils';
import { format } from 'date-fns';
import { sendTelegramNotification } from '../../lib/telegram'; // 텔레그램 유틸리티 함수 import
import { 
  uploadFileToR2, 
  findOrCreateFolder, 
  deleteFileFromR2 
} from '../../utils/cloudflareR2Utils';
import imageCompression from 'browser-image-compression';

// 접수방법과 배송방법 옵션
const RECEPTION_TYPES = ['공홈', '방문', '전화', '대리점', '기타'];
const DELIVERY_METHODS = ['방문수령', '택배', '퀵-선불', '퀵-착불'];

// 사전 정의된 태그 목록
const PREDEFINED_TAGS = [
  '배터리스위치', 'DBSM', '배터리', '모터', '컨트롤러', '브레이크', '타이어', '전체점검',
  'E010', 'E004', 'E007', '사고수리', '충전안됨'
];

// 대문자 변환 함수 추가
const toUpperCaseIfEnglish = (value) => {
  if (!value) return '';
  return value.replace(/[a-z]/g, (c) => c.toUpperCase());
};

// ... 기존 import 위에 추가
const TEMP_KEY = 'addServiceTemp';

function AddService() {
  const navigate = useNavigate();
  const submitActionRef = useRef('list');
  const location = useLocation();
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [submitting, setSubmitting] = useState(false);
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({
    brand: 'XRB',
    reception_date: new Date().toLocaleDateString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit'}),
    reception_time: '',
    repair_date: '',
    completion_date: '',
    completion_time: '',
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
    status: '준비중'
  });
  const [tags, setTags] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [partQuantity, setPartQuantity] = useState(1);
  const [status, setStatus] = useState('준비중');
  const [availableTags] = useState([
    '배터리스위치','전체점검', '브레이크-패드', '브레이크-로터', '브레이크-교체', '배터리',
    '충전기', '모터', '워런티', '사고-보험', 'E07','E09','E010','배터리스위치'
  ]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const searchAbortControllerRef = React.useRef(null);
  
  // 창고 상태 추가
  const [warehouses, setWarehouses] = useState([]);
  // 자동저장 관련 상태
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedData, setSavedData] = useState(null);
  
  // 자동저장 Hook
  const autoSave = useAutoSave(
    {
      formData,
      selectedParts,
      tags
    },
    'addService_draft',
    30000, // 30초
    true // 활성화
  );
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
  
  // 고객 이전 기록 관련 상태
  const [isSimpleSale, setIsSimpleSale] = useState(false);

  const handleSimpleSaleToggle = (e) => {
    const checked = e.target.checked;
    setIsSimpleSale(checked);
    if (checked) {
      applyStatusChange('준비완료');
      setFormData(prev => ({
        ...prev,
        customer_name: '판매건',
        customer_phone: '000',
        product_name: selectedParts.map(p => p.name).join(', '),
        symptom: '단순 판매건',
        solution: '',
        status: '준비완료'
      }));
      setStatus('준비완료');
    } else {
      setFormData(prev => ({
        ...prev,
        customer_name: '',
        customer_phone: '',
        product_name: '',
        symptom: '',
        solution: '',
        status: '준비중'
      }));
      setStatus('준비중');
    }
  };

  // 단순 판매 등록 모드일 때 선택된 부품이 변경되면 제품명 자동 업데이트
  useEffect(() => {
    if (isSimpleSale) {
      setFormData(prev => ({
        ...prev,
        product_name: selectedParts.map(p => p.name).join(', ')
      }));
    }
  }, [selectedParts, isSimpleSale]);

  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [customerHistoryData, setCustomerHistoryData] = useState([]);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);
  const [customerHistoryCounts, setCustomerHistoryCounts] = useState({});

  // 변경사항 감지를 위한 상태 추가
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  // ... AddService 함수 내에 추가
  const [hasTempData, setHasTempData] = useState(false);
  
  // 파일 업로드 관련 상태
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // 변경사항 감지 함수
  const checkForChanges = useCallback(() => {
    if (!initialData || isFormSubmitted) return;
    
    const currentData = {
      formData,
      selectedParts: selectedParts.map(part => ({
        id: part.id,
        name: part.name,
        code: part.code,
        quantity: part.quantity,
        price: part.price,
        usage: part.usage
      })),
      tags: tags.slice().sort(),
      status
    };
    
    const hasChanges = JSON.stringify(currentData) !== JSON.stringify(initialData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, selectedParts, tags, status, initialData, isFormSubmitted]);

  // 페이지 로드 시 자동저장 데이터 복구 확인
  useEffect(() => {
    const saved = autoSave.restore();
    if (saved && saved.formData) {
      console.log('[AddService] 저장된 데이터 발견:', saved.timestamp);
      setSavedData(saved);
      setShowRestoreDialog(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 폼 데이터 변경 감지
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // 페이지 떠날 때 확인 메시지
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !isFormSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isFormSubmitted]);

  // 브라우저 뒤로가기 방지
  useEffect(() => {
    if (hasUnsavedChanges && !isFormSubmitted) {
      // 현재 페이지를 히스토리에 추가
      window.history.pushState(null, '', window.location.href);
      
      const handlePopState = (event) => {
        if (hasUnsavedChanges && !isFormSubmitted) {
          // 브라우저 뒤로가기 시 확인 다이얼로그 표시
          const confirmLeave = window.confirm('변경사항이 저장되지 않았습니다. 정말 나가시겠습니까?');
          
          if (confirmLeave) {
            // 사용자가 확인하면 실제로 뒤로가기 실행
            setHasUnsavedChanges(false);
            window.history.back();
          } else {
            // 사용자가 취소하면 현재 페이지 유지
            window.history.pushState(null, '', window.location.href);
          }
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [hasUnsavedChanges, isFormSubmitted]);

  // 초기 데이터 설정
  useEffect(() => {
    if (!initialData) {
      const now = new Date();
      let hour = now.getHours();
      let min = now.getMinutes();

      // 30분 단위 반올림
      if (min > 44) {
        hour += 1;
        min = 0;
      } else if (min > 14) {
        min = 30;
      } else {
        min = 0;
      }

      // 시간 범위 제한: 범위 밖이면 10:30으로 고정
      if (hour < 10 || hour > 20 || (hour === 20 && min > 0)) {
        hour = 10;
        min = 30;
      }

      let timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      if (!RECEPTION_TIME_OPTIONS.includes(timeStr)) {
        timeStr = RECEPTION_TIME_OPTIONS[0];
      }
      
      setInitialData({
        formData: {
          brand: 'XRB',
          reception_date: now.toISOString().slice(0, 10),
          reception_time: timeStr,
          repair_date: '',
          completion_date: '',
          completion_time: '',
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
          status: '준비중'
        },
        selectedParts: [],
        tags: [],
        status: '준비중'
      });
    }
  }, [initialData]);

  // 접수시간 옵션 (10:00~20:00, 30분 단위)
  const RECEPTION_TIME_OPTIONS = useMemo(() => {
    const arr = [];
    for (let h = 10; h <= 20; h++) {
      arr.push(`${String(h).padStart(2, '0')}:00`);
      if (h !== 20) arr.push(`${String(h).padStart(2, '0')}:30`);
    }
    return arr;
  }, []);

  useEffect(() => {
    if (location.state?.selectedBrand) {
      setSelectedBrand(location.state.selectedBrand);
      setFormData(prev => ({ ...prev, brand: location.state.selectedBrand }));
    }
  }, [location.state]);

  // 폼이 처음 열릴 때 접수일시를 현재 날짜와 시간으로 자동 입력
  useEffect(() => {
    const now = new Date();
    let hour = now.getHours();
    let min = now.getMinutes();

    // 30분 단위 반올림
    if (min > 44) {
      hour += 1;
      min = 0;
    } else if (min > 14) {
      min = 30;
    } else {
      min = 0;
    }

    // 시간 범위 제한: 범위 밖이면 10:30으로 고정
    if (hour < 10 || hour > 20 || (hour === 20 && min > 0)) {
      hour = 10;
      min = 30;
    }

    let timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    if (!RECEPTION_TIME_OPTIONS.includes(timeStr)) {
      timeStr = RECEPTION_TIME_OPTIONS[0];
    }
    const date = now.toISOString().slice(0, 10);

    setFormData(prev => ({
      ...prev,
      reception_date: date,
      reception_time: timeStr
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [RECEPTION_TIME_OPTIONS]);

  // 서비스 목록 조회
  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false });

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
        .in('brand', [selectedBrand, 'COMMON']) // 선택된 브랜드 + 공용 파츠 포함
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

  // 창고 목록 조회
  const fetchWarehouses = async () => {
    try {
      const { data } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(data || []);
      if (data && data.length > 0 && !formData.warehouse_id) {
         const defaultWh = data.find(w => w.name.includes('청담')) || data[0];
         setFormData(prev => ({ ...prev, warehouse_id: defaultWh.id }));
      }
    } catch (e) {
      console.error('창고 로딩 에러:', e);
    }
  };

  // 마운트 시 창고 불러오기
  useEffect(() => {
    fetchWarehouses();
  }, []);

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
          usage: 'A/S',
          status: formData.status === '출고완료' ? '출고완료' : '준비중'
        };
        setSelectedParts(prev => [...prev, newPart]);
      }
      
      setSelectedPart(null);
      setPartQuantity(1);
      setModifiedPrice('');
      
      setSnackbar({
        open: true,
        message: '부품이 추가되었습니다. 계속해서 다른 부품을 추가할 수 있습니다.',
        severity: 'success'
      });
      // 연속 등록을 위해 다이얼로그를 닫지 않습니다.
      // setOpenPartsDialog(false);
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

  // 부품 상태 변경 핸들러 (준비완료 이후 변경 불가)
  const handlePartStatusChange = (index, newStatus) => {
    const part = selectedParts[index];
    const isLocked = part.status === '준비완료' || part.status === '출고완료' || part.status === '반품완료';
    if (isLocked) {
      setSnackbar({ open: true, message: '준비완료 이후에는 상태를 변경할 수 없습니다. 반품 버튼을 사용하세요.', severity: 'warning' });
      return;
    }
    const updatedParts = [...selectedParts];
    updatedParts[index].status = newStatus;
    setSelectedParts(updatedParts);
  };

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

  // 부품 삭제 (준비중일 때만 가능)
  const handleRemovePart = (partId) => {
    const part = selectedParts.find(p => p.id === partId);
    if (part && part.status !== '준비중') {
      setSnackbar({ open: true, message: '준비완료 이후에는 삭제할 수 없습니다. 반품 버튼을 사용하세요.', severity: 'warning' });
      return;
    }
    setSelectedParts(prev => prev.filter(p => p.id !== partId));
  };

  // 부품 반품 처리
  const handleReturnPart = (partId) => {
    setSelectedParts(prev => prev.map(p => {
      if (p.id !== partId) return p;
      return { ...p, status: '반품완료', usage: (p.usage || '') + '[반품완료]' };
    }));
    setSnackbar({ open: true, message: '반품 처리되었습니다. 저장 시 재고에 반영됩니다.', severity: 'info' });

    // 감사 로그
    const returnedPart = selectedParts.find(p => p.id === partId);
    try {
      logAction({
        action: '반품',
        targetTable: 'service_parts',
        targetId: partId,
        summary: `[A/S 부품 반품] ${returnedPart?.name || 'unknown'} x ${returnedPart?.quantity || 1}개`,
        details: returnedPart
      });
    } catch (logErr) {
      console.warn('[AuditLog] 반품 로그 실패:', logErr);
    }
  };


  // 엑셀 템플릿 다운로드 함수
  const handleDownloadTemplate = () => {
    try {
      // 템플릿 데이터 생성
      const templateData = [
        {
          '날짜': '2024-03-20',
          '완료 여부': '준비중',
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

      // 헤더 정의
      const headers = [
        { label: '날짜', key: '날짜' },
        { label: '완료 여부', key: '완료 여부' },
        { label: '작성자', key: '작성자' },
        { label: '이름', key: '이름' },
        { label: '연락처', key: '연락처' },
        { label: '기종명', key: '기종명' },
        { label: '누적 주행거리', key: '누적 주행거리' },
        { label: '구입처', key: '구입처' },
        { label: '문의내용', key: '문의내용' },
        { label: '처리내용', key: '처리내용' },
        { label: '첨부', key: '첨부' },
        { label: 'JPG', key: 'JPG' },
        { label: '기타', key: '기타' },
        { label: '문의 위치', key: '문의 위치' }
      ];

      // 파일 다운로드
      downloadExcel(templateData, headers, `A/S등록템플릿_${selectedBrand}`);

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


  // 날짜 변환 함수 수정
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      if (dateStr instanceof Date) {
        return dateStr.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\.$/, '');
      }
      const dateString = String(dateStr);
      if (dateString.includes('/')) {
        const [month, day] = dateString.split('/').map(num => String(num).trim());
        const year = new Date().getFullYear();
        const formattedMonth = month.padStart(2, '0');
        const formattedDay = day.padStart(2, '0');
        return `${year}-${formattedMonth}-${formattedDay}`;
      }
      const excelDate = parseInt(dateString);
      if (!isNaN(excelDate)) {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\.$/, '');
      }
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\.$/, '');
      }
      return null;
    } catch (error) {
      console.error('날짜 변환 중 오류:', error);
      return null;
    }
  };

  // 엑셀 업로드 처리 함수 수정
  const handleExcelFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const jsonData = await readExcelFile(file);
      console.log('엑셀 데이터 파싱 결과:', jsonData);

      // 데이터 처리
      const validData = jsonData.map((row, index) => {
        const currentDate = new Date().toLocaleDateString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit'});
        
        return {
          brand: selectedBrand,
          reception_date: parseDate(row['접수일자']) || currentDate,
          reception_time: row['접수시간'] || new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}),
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
          status: row['상태'] || '준비중',
          note: row['메모'] || '',
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

      // 등록 성공 후 알림 추가
      if (insertedData && insertedData.length > 0) {
        // 알림 데이터 생성
        const notificationsToInsert = insertedData.map(service => ({
          type: 'service_create',
          message: `A/S 등록 (접수번호: ${service.id}) - 고객: ${service.customer_name || '정보없음'}, 연락처: ${service.customer_phone || '정보없음'}`,
          link: `/service/${service.id}`
        }));
        
        const { error: notificationError } = await supabase.from('notifications').insert(notificationsToInsert);

        if (notificationError) {
          console.error('A/S 등록 알림 저장 실패 (엑셀/단일):', notificationError);
        } else {
          // 텔레그램 알림 전송 (엑셀/단일)
          for (const service of insertedData) {
            try {
              await sendTelegramNotification({
                message: `A/S 등록 (접수번호: ${service.id}) - 고객: ${service.customer_name || '정보없음'}, 연락처: ${service.customer_phone || '정보없음'}`
              }, { eventType: 'service_add' });
            } catch (telegramError) {
              console.error('엑셀 업로드 A/S 텔레그램 알림 전송 중 오류:', telegramError);
            }
          }
        }
      }

    } catch (err) {
      console.error('엑셀 데이터 처리 중 오류:', err);
      setSnackbar({
        open: true,
        message: '엑셀 데이터 처리 중 오류가 발생했습니다.',
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
    if (submitting) return;
    setSubmitting(true);
    setIsFormSubmitted(true); // 폼 제출 상태로 변경
    let serviceId = null; // 등록된 서비스 ID를 저장할 변수

    try {
      console.log('[AddService] 등록 시작');
      
      let receptionDateTime = null;
      if (formData.reception_date && formData.reception_time) {
        receptionDateTime = `${formData.reception_date}T${formData.reception_time}:00+09:00`;
      }

      const serviceInsertData = {
        brand: selectedBrand,
        reception_date: receptionDateTime,
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
        writer: formData.writer || '관리자',
        warehouse_id: formData.warehouse_id || null,
        updated_at: new Date().toISOString()
      };

      if (formData.status === '출고완료' || formData.status === '부품준비' || formData.status === '준비완료') {
        const now = new Date();
        // completion_time 컬럼 없음 → completion_date(timestamp)에 날짜+시간 통합 저장
        serviceInsertData.completion_date = now.toISOString();
      }

      console.log('[AddService] A/S 정보 등록 시작');
      let insertedService;
      const { data: insertData, error: insertError } = await supabase
        .from('services')
        .insert([serviceInsertData])
        .select()
        .single();

      if (insertError) {
        console.error('[AddService] Service insert error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
        
        // JWT 또는 인증 오류 시 재시도
        if (insertError.message?.includes('JWT') || 
            insertError.message?.includes('auth') || 
            insertError.code === '401' ||
            insertError.message?.includes('Unauthorized')) {
          console.log('[AddService] 인증 오류 감지 - 재시도');
          
          // 짧은 대기 후 재시도 (1회)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: retryService, error: retryError } = await supabase
            .from('services')
            .insert([serviceInsertData])
            .select()
            .single();
          
          if (retryError) {
            console.error('[AddService] 재시도 실패:', retryError);
            throw new Error(`A/S 정보 등록 중 오류: ${retryError.message}`);
          }
          
          console.log('[AddService] 재시도 성공');
          insertedService = retryService;
        } else {
          throw new Error(`A/S 정보 등록 중 오류: ${insertError.message}`);
        }
      } else {
        console.log('[AddService] A/S 정보 등록 성공:', insertData.id);
        insertedService = insertData;
      }
      serviceId = insertedService.id;

      if (tags.length > 0) {
        const formattedTags = tags.map(tag => ({
          service_id: insertedService.id,
          tag_name: tag
        }));
        const { error: tagError } = await supabase.from('service_tags').insert(formattedTags);
        if (tagError) {
          console.warn('Tag insert warning (non-critical):', tagError);
        }
      }

      if (selectedParts.length > 0) {
        const partsToInsert = selectedParts.map(part => ({
          service_id: insertedService.id,
          part_id: part.id,
          quantity: part.quantity,
          price: part.price,
          usage: part.usage || 'A/S'
        }));
        const { error: partsError } = await supabase.from('service_parts').insert(partsToInsert);
        if (partsError) {
          console.error('Parts insert error:', partsError);
          throw new Error(`사용 부품 등록 중 오류: ${partsError.message}`);
        }
      }

      // 상태가 '출고완료'인 상태로 신규 등록 시 재고 차감 즉시 실행
      if (formData.status === '출고완료' || formData.status === '부품준비' || formData.status === '준비완료') {
        try {
          console.log(`[AddService] A/S 완료 처리 시작 - 서비스ID: ${insertedService.id}, 브랜드: ${formData.brand}`);
          const inventoryResult = await processServiceCompletion(insertedService.id, formData.brand);
          if (!inventoryResult.success) {
            console.error('재고 차감 오류:', inventoryResult.message);
          }
        } catch (invErr) {
          console.error('재고 차감 중 예외:', invErr);
        }
      }

      // 업로드된 파일 정보를 DB에 저장
      if (uploadedFiles.length > 0) {
        try {
          // 파일은 이미 구글 드라이브(또는 임시 폴더)에 업로드된 상태이므로, DB 레코드만 생성합니다.

          const fileRecords = uploadedFiles.map(file => ({
            service_id: parseInt(insertedService.id),
            file_id: file.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            web_view_link: file.webViewLink,
            web_content_link: file.webContentLink,
            upload_date: file.uploadDate
          }));

          const { error: filesError } = await supabase
            .from('service_files')
            .insert(fileRecords);

          if (filesError) {
            console.error('[AddService] 파일 정보 DB 저장 오류:', filesError);
            // 파일 DB 저장 실패는 경고로 처리하고 계속 진행
            setSnackbar({
              open: true,
              message: 'A/S는 등록되었으나, 파일 정보 저장 중 오류가 발생했습니다.',
              severity: 'warning'
            });
          } else {
            console.log('[AddService] 파일 정보 DB 저장 완료:', uploadedFiles.length);
          }
        } catch (filesCatchError) {
          console.error('[AddService] 파일 정보 저장 중 예외:', filesCatchError);
          // 파일 저장 실패는 경고로 처리하고 계속 진행
        }
      }

      let notificationSuccess = true;
      // 알림 전송을 비동기 처리하여 UI 응답 속도 개선
      Promise.resolve().then(async () => {
        try {
          const notificationPayload = {
            type: 'service_create',
            message: `A/S 등록 (접수번호: ${insertedService.id}) - 고객: ${formData.customer_name}, 연락처: ${formData.customer_phone}`,
            link: `/service/${insertedService.id}`
          };
          await supabase.from('notifications').insert(notificationPayload);
        } catch (e) {
          console.error('Notification insert exception:', e);
        }

        if (insertedService && insertedService.id) {
          try {
            await sendTelegramNotification({
              message: `A/S 등록 (접수번호: ${insertedService.id}) - 고객: ${formData.customer_name}, 연락처: ${formData.customer_phone}`
            }, { eventType: 'service_add' });
          } catch (e) {
            console.error('A/S 등록 텔레그램 알림 전송 중 오류:', e);
          }
        }
      });

      localStorage.setItem('highlightServiceId', String(insertedService.id));

      setSnackbar({
        open: true,
        message: 'A/S가 성공적으로 등록되었습니다.',
        severity: 'success'
      });

      // 감사 로그
      try {
        logAction({
          action: '등록',
          targetTable: 'services',
          targetId: insertedService.id,
          summary: `[A/S 등록] ${formData.customer_name} - ${formData.product_name} (상태: ${formData.status})`,
          details: { service: serviceInsertData, parts: selectedParts, tags }
        });
      } catch (logErr) {
        console.warn('[AuditLog] A/S 등록 로그 실패:', logErr);
      }

      // 변경사항 초기화
      setHasUnsavedChanges(false);
      
      // 자동저장 데이터 삭제
      autoSave.clear();
      console.log('[AddService] 등록 성공 - 자동저장 데이터 삭제');

      // 등록 직후 바로 페이지 이동 (인위적 딜레이 제거)
      if (submitActionRef.current === 'detail') {
        navigate(`/services/${insertedService.id}`);
      } else {
        navigate('/services');
      }

    } catch (error) {
      console.error('Error in handleSubmit:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      
      // AbortError는 무시 (사용자가 페이지를 떠났거나 요청이 취소됨)
      if (error.name === 'AbortError') {
        console.log('[AddService] 요청이 취소되었습니다.');
        setIsFormSubmitted(false);
        setSubmitting(false);
        return;
      }
      
      let userMessage = `오류가 발생했습니다: ${error.message}`;
      if (error.message.includes('부품 등록 중 오류') && serviceId) {
        userMessage = `A/S 정보는 등록되었으나, 부품 정보 등록 중 오류가 발생했습니다. (A/S ID: ${serviceId}) 서비스 상세 화면에서 수정해주세요.`;
      }
      setSnackbar({
        open: true,
        message: userMessage,
        severity: 'error'
      });
      setIsFormSubmitted(false); // 오류 발생 시 제출 상태 해제
    } finally {
      setSubmitting(false);
    }
  };

  // 이미지 리사이즈 함수
  const resizeImage = async (file) => {
    try {
      // 이미지 파일이 아니면 원본 반환
      if (!file.type.startsWith('image/')) {
        return file;
      }

      const options = {
        maxSizeMB: 2, // 최대 파일 크기 2MB
        maxWidthOrHeight: 1920, // 최대 크기 1920x1920
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.8,
        maxIteration: 5
      };

      const compressedFile = await imageCompression(file, options);
      console.log('이미지 리사이즈 완료:', {
        원본: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        압축: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
      });
      
      return compressedFile;
    } catch (error) {
      console.error('이미지 리사이즈 실패:', error);
      // 리사이즈 실패 시 원본 반환
      return file;
    }
  };



  // 파일 업로드 핸들러
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // 파일 크기 검증 (10MB 제한)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    
    if (oversizedFiles.length > 0) {
      setSnackbar({
        open: true,
        message: `다음 파일의 크기가 10MB를 초과합니다: ${oversizedFiles.map(f => f.name).join(', ')}`,
        severity: 'error'
      });
      event.target.value = '';
      return;
    }

    // 총 파일 개수 검증 (최대 5개)
    const MAX_TOTAL_FILES = 5;
    if (uploadedFiles.length + files.length > MAX_TOTAL_FILES) {
      setSnackbar({
        open: true,
        message: `최대 ${MAX_TOTAL_FILES}개의 파일만 업로드할 수 있습니다. (현재: ${uploadedFiles.length}개)`,
        severity: 'error'
      });
      event.target.value = '';
      return;
    }

    try {
      setUploadingFiles(true);
      
      // 업로드 서브 폴더 설정
      const subFolderName = 'upload_crm';

      // 서브폴더(upload_crm)를 생성/탐색
      const subRootFolder = await findOrCreateFolder(subFolderName, null, null);

      // 임시 폴더 생성 (서비스 ID가 없으므로 임시로 저장)
      const tempFolderName = `temp_${Date.now()}`;
      const tempFolder = await findOrCreateFolder(tempFolderName, subRootFolder?.id, null);

      const uploadResults = [];
      
      for (const file of files) {
        try {
          // 이미지 파일인 경우 리사이즈
          let fileToUpload = file;
          if (file.type.startsWith('image/')) {
            fileToUpload = await resizeImage(file);
          }

          // 파일 업로드
          const uploadResult = await uploadFileToR2(fileToUpload, tempFolder.id);
          
          uploadResults.push({
            id: uploadResult.id,
            name: uploadResult.name,
            webViewLink: uploadResult.webViewLink,
            webContentLink: uploadResult.webContentLink,
            size: fileToUpload.size,
            type: fileToUpload.type,
            uploadDate: new Date().toISOString(),
            tempFolderId: tempFolder.id // 나중에 서비스 폴더로 이동하기 위해 저장
          });
          
        } catch (fileError) {
          console.error(`파일 ${file.name} 업로드 실패:`, fileError);
          setSnackbar({
            open: true,
            message: `파일 ${file.name} 업로드 실패: ${fileError.message}`,
            severity: 'error'
          });
        }
      }

      if (uploadResults.length > 0) {
        setUploadedFiles(prev => [...prev, ...uploadResults]);
        
        setSnackbar({
          open: true,
          message: `${uploadResults.length}개 파일이 성공적으로 업로드되었습니다.`,
          severity: 'success'
        });
      }

    } catch (error) {
      console.error('파일 업로드 실패:', error);
      setSnackbar({
        open: true,
        message: `파일 업로드 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setUploadingFiles(false);
      event.target.value = '';
    }
  };

  // 파일 삭제 핸들러
  const handleFileDelete = async (fileId) => {
    try {
      // 보관소(R2)에서 파일 삭제
      try {
        await deleteFileFromR2(fileId);
        console.log('[AddService] 파일 보관소(R2) 파일 삭제 완료:', fileId);
      } catch (driveError) {
        console.warn('[AddService] 파일 보관소(R2) 파일 삭제 실패 (무시):', driveError);
      }
      
      // 로컬 상태에서 제거
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
      
      setSnackbar({
        open: true,
        message: '파일이 삭제되었습니다.',
        severity: 'success'
      });
      
    } catch (error) {
      console.error('[AddService] 파일 삭제 실패:', error);
      setSnackbar({
        open: true,
        message: `파일 삭제 실패: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // 파일 미리보기 핸들러
  const handlePreview = (url) => {
    if (!url) return;
    
    const fileType = url.toLowerCase().endsWith('.pdf') || url.includes('pdf') ? 'pdf' : 'image';
    setPreviewType(fileType);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };



  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };


  const handlePartsSelected = async (selectedParts) => {
    // 선택된 파츠를 현재 선택된 파츠 목록에 추가
    const newParts = selectedParts.map(part => ({
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

  // PDF 로드 성공 핸들러
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  // 상태 변경 핸들러
  const applyStatusChange = (newStatus) => {
    // 상품(부품)들의 상태값 자동 동기화 (반품완료된 항목 제외)
    setSelectedParts(prev => prev.map(p => {
      if (p.status === '반품완료' || (p.usage && p.usage.includes('[반품완료]'))) return p;
      return { ...p, status: newStatus };
    }));

    setStatus(newStatus);
    setFormData(prev => ({
      ...prev,
      status: newStatus
    }));
  };

  // 상태 변경 핸들러
  const handleStatusChange = (newStatus) => {
    // 1. 준비완료 -> 준비중 제한 (부품이 추가되어 있으면 반품 필요)
    if (status === '준비완료' && newStatus === '준비중') {
      const hasActiveParts = selectedParts.some(p => p.status !== '반품완료' && (!p.usage || !p.usage.includes('[반품완료]')));
      if (hasActiveParts) {
        setSnackbar({
          open: true,
          message: '사용 부품이 추가되어 있어 준비중 상태로 변경할 수 없습니다. 부품을 먼저 반품해주세요.',
          severity: 'warning'
        });
        return; // 상태 변경 중단
      }
    }

    // 2. 준비중 -> 준비완료 확인 메시지
    if (status === '준비중' && newStatus === '준비완료') {
      setConfirmDialog({
        open: true,
        title: '상태 변경 확인',
        message: 'A/S 상태를 준비완료로 변경하시겠습니까?',
        onConfirm: () => {
          applyStatusChange(newStatus);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
      return;
    }

    // 3. 출고완료 확인 로직
    if (newStatus === '출고완료') {
      setConfirmDialog({
        open: true,
        title: 'A/S 완료 확인',
        message: '해당 A/S를 출고완료 처리하시겠습니까?',
        onConfirm: () => {
          setSelectedParts(prev => prev.map(p => {
            if (p.status === '반품완료' || (p.usage && p.usage.includes('[반품완료]'))) return p;
            return { ...p, status: newStatus };
          }));
          setStatus(newStatus);
          setFormData(prev => {
            const updatedData = { ...prev, status: newStatus };
            if (!prev.completion_date) {
              const currentDate = new Date().toLocaleDateString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit'});
              updatedData.completion_date = currentDate;
            }
            return updatedData;
          });
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
      return;
    }

    // 그 외 일반적인 상태 변경
    applyStatusChange(newStatus);
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

  // selectedBrand와 formData.brand 동기화
  useEffect(() => {
    if (selectedBrand !== formData.brand) {
      setFormData(prev => ({ ...prev, brand: selectedBrand }));
    }
  }, [selectedBrand, formData.brand]);

  // 컴포넌트 마운트 시 최근 고객 정보 로드
  useEffect(() => {
    searchCustomers('');
  }, []);

  // 고객 신규 등록 핸들러 (검색 모달에서 호출)
  const handleAddNewCustomer = (searchValue) => {
    if (!searchValue) return;
    
    // 전화번호 형식인지 확인 (숫자나 하이픈으로만 이루어져 있는지)
    const isPhoneNumber = /^[\d-]+$/.test(searchValue.trim());
    
    setFormData(prev => ({
      ...prev,
      customer_phone: isPhoneNumber ? searchValue.trim() : prev.customer_phone,
      customer_name: !isPhoneNumber ? searchValue.trim() : prev.customer_name
    }));
    
    setCustomerSearchOpen(false);
  };

  // 제품명에서 기체만 추출하는 함수
  const extractMainProduct = (productName) => {
    if (!productName) return '';
    
    // 쉼표로 구분된 제품명들을 배열로 분리
    const products = productName.split(',').map(p => p.trim()).filter(Boolean);
    
    // 기체를 찾기 위한 키워드들
    const mainProductKeywords = ['기체', '드론', '드론기체', '기본기체'];
    
    // 기체 키워드가 포함된 제품을 찾기
    for (const product of products) {
      for (const keyword of mainProductKeywords) {
        if (product.includes(keyword)) {
          return product;
        }
      }
    }
    
    // 기체를 찾지 못한 경우 첫 번째 제품 반환
    return products[0] || '';
  };

  // 고객 검색 함수
  const searchCustomers = async (searchTerm) => {
    // 이전 검색 요청 취소
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    // 새 취소 컨트롤러 생성
    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;
    const signal = abortController.signal;

    try {
      setSearchLoading(true);
      if (!searchTerm || searchTerm.length < 2) {
        // 최근 고객 정보 조회 (A/S + 출고) - 브랜드 구분 없이 모든 고객 검색
        const { data: recentServices, error: recentServicesError } = await supabase
          .from('services')
          .select('customer_name, customer_phone, customer_address, brand, product_name, seller')
          .order('reception_date', { ascending: false })
          .limit(10);
        const { data: recentShipments, error: recentShipmentsError } = await supabase
          .from('shipments')
          .select('customer_name, customer_phone, customer_address, brand, product_name')
          .order('order_date', { ascending: false })
          .limit(10);
        if (recentServicesError) throw recentServicesError;
        if (recentShipmentsError) throw recentShipmentsError;
        const allRecentCustomers = [...(recentServices || []), ...(recentShipments || [])];
        
        // 최근 고객도 이름 + 전화번호 조합으로 중복 제거
        const recentUniqueMap = new Map();
        let customerIndex = 0;
        allRecentCustomers.forEach(customer => {
          if (customer.customer_name && customer.customer_phone) {
            const key = `${customer.customer_name.trim()}_${customer.customer_phone.trim()}`;
            if (!recentUniqueMap.has(key)) {
              recentUniqueMap.set(key, {
                id: `${key}_${customerIndex++}`, // 고유한 ID 생성
                name: customer.customer_name,
                phone: customer.customer_phone,
                address: customer.customer_address || '',
                product_name: customer.product_name || '',
                seller: customer.seller || '',
                brand: customer.brand || ''
              });
            } else {
              // 기존 고객이 있으면 product_name이 있는 경우 업데이트
              const existing = recentUniqueMap.get(key);
              if (customer.product_name && !existing.product_name) {
                existing.product_name = customer.product_name;
              }
            }
          }
        });
        
        const uniqueRecentCustomers = Array.from(recentUniqueMap.values()).slice(0, 10);
        setCustomerSearchResults(uniqueRecentCustomers);
        
        const fetchHistoryCountsSequentially = async () => {
          for (const customer of uniqueRecentCustomers) {
            if (signal.aborted) break;
            try {
              await fetchCustomerHistoryCount(customer, signal);
            } catch (err) {
              if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
                console.log('최근 고객 이력 건수 조회 취소됨');
              } else {
                console.error('최근 고객 이력 건수 조회 오류:', err);
              }
            }
          }
        };
        fetchHistoryCountsSequentially();
        return;
      }
      const cleanSearchTerm = searchTerm.replace(/-/g, '');
      
      // 전화번호 패턴인지 확인 (숫자나 하이픈이 포함된 경우)
      const isPhoneSearch = /^[\d-]+$/.test(searchTerm) && cleanSearchTerm.length >= 3;
      
      let serviceQuery, shipmentQuery;
      
      const safeSearchTerm = searchTerm.replace(/"/g, '');
      const safeCleanSearchTerm = cleanSearchTerm.replace(/"/g, '');

      if (isPhoneSearch) {
        // 전화번호 검색: 하이픈 있는/없는 형태 모두 검색
        serviceQuery = supabase
          .from('services')
          .select('customer_name, customer_phone, customer_address, brand, product_name, seller')
          .or(`customer_phone.ilike."%${safeCleanSearchTerm}%",customer_phone.ilike."%${safeSearchTerm}%"`)
          .order('reception_date', { ascending: false })
          .abortSignal(signal);
          
        shipmentQuery = supabase
          .from('shipments')
          .select('customer_name, customer_phone, customer_address, brand, product_name')
          .or(`customer_phone.ilike."%${safeCleanSearchTerm}%",customer_phone.ilike."%${safeSearchTerm}%"`)
          .order('order_date', { ascending: false })
          .abortSignal(signal);
      } else {
        // 이름 검색 + 혼합 검색
        serviceQuery = supabase
          .from('services')
          .select('customer_name, customer_phone, customer_address, brand, product_name, seller')
          .or(`customer_name.ilike."%${safeSearchTerm}%",customer_phone.ilike."%${safeCleanSearchTerm}%",customer_phone.ilike."%${safeSearchTerm}%"`)
          .order('reception_date', { ascending: false })
          .abortSignal(signal);
          
        shipmentQuery = supabase
          .from('shipments')
          .select('customer_name, customer_phone, customer_address, brand, product_name')
          .or(`customer_name.ilike."%${safeSearchTerm}%",customer_phone.ilike."%${safeCleanSearchTerm}%",customer_phone.ilike."%${safeSearchTerm}%"`)
          .order('order_date', { ascending: false })
          .abortSignal(signal);
      }
      
      const { data: serviceResults, error: serviceError } = await serviceQuery;
      if (serviceError) throw serviceError;
      if (signal.aborted) return;

      const { data: shipmentResults, error: shipmentError } = await shipmentQuery;
      if (shipmentError) throw shipmentError;
      if (signal.aborted) return;
      
      const allResults = [...(serviceResults || []), ...(shipmentResults || [])];
      
      // 이름 + 전화번호 조합으로 중복 제거 (더 정확한 고객 식별)
      const uniqueMap = new Map();
      let searchIndex = 0;
      allResults.forEach(customer => {
        if (customer.customer_name && customer.customer_phone) {
          const key = `${customer.customer_name.trim()}_${customer.customer_phone.trim()}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
              id: `${key}_search_${searchIndex++}`, // 고유한 ID 생성
              name: customer.customer_name,
              phone: customer.customer_phone,
              address: customer.customer_address || '',
              product_name: customer.product_name || '',
              seller: customer.seller || '',
              brand: customer.brand || ''
            });
          } else {
            // 기존 고객이 있으면 product_name이 있는 경우 업데이트
            const existing = uniqueMap.get(key);
            if (customer.product_name && !existing.product_name) {
              existing.product_name = customer.product_name;
            }
          }
        }
      });
      
      const uniqueResults = Array.from(uniqueMap.values());
      setCustomerSearchResults(uniqueResults);
      
      // 각 고객의 이력 건수를 순차적으로 조회하여 AbortError 방지
      const fetchHistoryCountsSequentially = async () => {
        for (const customer of uniqueResults) {
          if (signal.aborted) break;
          try {
            await fetchCustomerHistoryCount(customer, signal);
          } catch (err) {
            if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
              console.log('고객 이력 건수 조회 취소됨');
            } else {
              console.error('고객 이력 건수 조회 오류:', err);
            }
          }
        }
      };
      fetchHistoryCountsSequentially();
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
        console.log('이전 검색 요청이 취소되었습니다.');
        return;
      }
      
      setSnackbar({
        open: true,
        message: '고객 검색 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      if (searchAbortControllerRef.current === abortController) {
        setSearchLoading(false);
      }
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

  // 고객별 이력 건수 조회 함수
  const fetchCustomerHistoryCount = async (customer, signal) => {
    try {
      // A/S 이력 건수 조회 - 이름과 전화번호 모두 정확히 매칭
      let serviceQuery = supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('customer_phone', customer.phone)
        .eq('customer_name', customer.name);

      if (signal) {
        serviceQuery = serviceQuery.abortSignal(signal);
      }

      const { count: serviceCount, error: serviceError } = await serviceQuery;

      if (serviceError) throw serviceError;

      // 출고 이력 건수 조회 - 이름과 전화번호 모두 정확히 매칭
      let shipmentQuery = supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('customer_phone', customer.phone)
        .eq('customer_name', customer.name);

      if (signal) {
        shipmentQuery = shipmentQuery.abortSignal(signal);
      }

      const { count: shipmentCount, error: shipmentError } = await shipmentQuery;

      if (shipmentError) throw shipmentError;

      const totalCount = (serviceCount || 0) + (shipmentCount || 0);
      
      setCustomerHistoryCounts(prev => ({
        ...prev,
        [`${customer.phone}_${customer.name}`]: totalCount
      }));

      return totalCount;
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('AbortError') || error.code === '20') {
        throw error; // Let the caller handle AbortError
      }
      console.error('고객 이력 건수 조회 오류:', error);
      return 0;
    }
  };

  // 고객 이전 기록 조회 함수
  const fetchCustomerHistory = async (customer) => {
    try {
      setCustomerHistoryLoading(true);
      setSelectedCustomerForHistory(customer);
      
      console.log('고객 이력 조회 시작:', customer);
      
      // A/S 이력 조회 - 이름과 전화번호 정확히 매칭
      const { data: serviceHistory, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('customer_phone', customer.phone)
        .eq('customer_name', customer.name)
        .order('reception_date', { ascending: false })
        .limit(10);

      console.log('A/S 이력 조회 결과:', { serviceHistory, serviceError });

      if (serviceError) {
        console.error('A/S 이력 조회 오류:', {
          message: serviceError.message,
          code: serviceError.code,
          details: serviceError.details,
          hint: serviceError.hint
        });
      }

      // 출고 이력 조회 - 이름과 전화번호 정확히 매칭
      const { data: shipmentHistory, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('customer_phone', customer.phone)
        .eq('customer_name', customer.name)
        .order('order_date', { ascending: false })
        .limit(10);

      console.log('출고 이력 조회 결과:', { shipmentHistory, shipmentError });

      if (shipmentError) {
        console.error('출고 이력 조회 오류:', {
          message: shipmentError.message,
          code: shipmentError.code,
          details: shipmentError.details,
          hint: shipmentError.hint
        });
      }

      // 데이터 통합 및 정렬
      const combinedHistory = [
        ...(serviceHistory || []).map(item => ({
          ...item,
          type: 'service',
          date: item.reception_date || item.created_at,
          title: `A/S 접수 - ${item.product_name || '제품명 없음'}`,
          description: item.symptom || item.repair_content || item.solution || '증상/수리내용 없음',
          amount: item.total_amount,
          status: item.status
        })),
        ...(shipmentHistory || []).map(item => ({
          ...item,
          type: 'shipment',
          date: item.order_date || item.created_at,
          title: `출고 - ${item.product_name || '제품명 없음'}`,
          description: `수량: ${item.quantity}개${item.note ? ` / ${item.note}` : ''}`,
          amount: item.price,
          status: item.shipment_date ? '출고완료' : '출고대기'
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log('통합된 이력 데이터:', combinedHistory);
      
      setCustomerHistoryData(combinedHistory);
      setCustomerHistoryOpen(true);

    } catch (error) {
      console.error('고객 이력 조회 오류:', error);
      setSnackbar({
        open: true,
        message: '고객 이력 조회 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setCustomerHistoryLoading(false);
    }
  };

  // 고객 선택 핸들러
  const handleCustomerSelect = (customer) => {
    // 기체만 추출하여 제품명 설정
    const mainProduct = extractMainProduct(customer.product_name);
    
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address || '',
      product_name: mainProduct || prev.product_name,
      seller: customer.seller || prev.seller
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
            
            /* 절취선 스타일 수정 - 가로로 변경, 여백 제거 */
            .cut-section {
              margin-top: 50px;
              border-top: 1px dashed #999;
              width: 100%;
            }
            .cut-box {
              width: 100%;
              height: 60px;
              text-align: center;
              display: flex;
              flex-direction: row;
              justify-content: center;
              align-items: center;
              border-bottom: 1px dashed #999;
              padding: 0;
            }
            .customer-info {
              font-size: 24px;
              font-weight: bold;
              white-space: nowrap;
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
            <p>접수일자: ${formatKoreanDateTime(formData.reception_date)}</p>
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
          
          <!-- 절취선 섹션 수정 - 가로로 변경, 이름과 연락처 한 줄에 -->
          <div class="cut-section">
            <div class="cut-box">
              <div class="customer-info">${formData.customer_name || '-'} ${formData.customer_phone || '-'}</div>
            </div>
            <div class="cut-box">
              <div class="customer-info">${formData.customer_name || '-'} ${formData.customer_phone || '-'}</div>
            </div>
            <div class="cut-box">
              <div class="customer-info">${formData.customer_name || '-'} ${formData.customer_phone || '-'}</div>
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

  // 버튼 스타일 정의
  const buttonStyle = (isSelected, currentStatus) => {
    const getBgColor = () => {
      switch (currentStatus) {
        case '준비중': return '#1976d2';
        case '부품준비': return '#ed6c02';
        case '준비완료': return '#f57c00';
        case '반품완료': return '#d32f2f';
        case '출고완료': return '#2e7d32';
        default: return '#3182f6';
      }
    };
    const getHoverBgColor = () => {
      switch (currentStatus) {
        case '준비중': return '#1565c0';
        case '부품준비': return '#d65f02';
        case '준비완료': return '#e65100';
        case '반품완료': return '#c62828';
        case '출고완료': return '#1e5e20';
        default: return '#1b64da';
      }
    };
    return {
      marginLeft: '8px',
      backgroundColor: isSelected ? getBgColor() : '#f2f4f6',
      color: isSelected ? '#ffffff' : '#4e5968',
      '&:hover': {
        backgroundColor: isSelected ? getHoverBgColor() : '#e5e8eb'
      }
    };
  };

  // handlePrintEstimate 함수 교체 (ServiceDetail.jsx 참고)
  const handlePrintEstimate = () => {
    const today = new Date();
    const estimateTotal = selectedParts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
    const estimateHtml = `
      <html>
        <head>
          <title>견적서</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
            body { 
              font-family: 'Noto Sans KR', sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
            }
            h1 { 
              font-size: 32px; 
              font-weight: 700;
              margin-bottom: 40px;
              text-align: left;
            }
            .header-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 40px;
            }
            .header-item {
              display: grid;
              grid-template-columns: 120px 1fr;
              border-bottom: 1px solid #ddd;
              padding: 8px 0;
            }
            .header-label {
              font-weight: 500;
            }
            .estimate-amount {
              border: 2px solid #000;
              padding: 15px;
              margin: 20px 0;
              text-align: center;
              font-size: 18px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              border-top: 2px solid #000;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: center;
            }
            th { 
              background: #f8f9fa;
              font-weight: 500;
            }
            .total-row { 
              font-weight: 500;
              background: #f8f9fa;
            }
            .amount-cell {
              text-align: right;
            }
            .note-section {
              margin-top: 30px;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            .note-title {
              font-weight: 500;
              margin-bottom: 10px;
            }
            .note-content {
              white-space: pre-line;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <h1>견적서</h1>
          <div class="header-grid">
            <div>
              <div class="header-item">
                <span class="header-label">수신</span>
                <span>${formData.customer_name || ''}</span>
              </div>
              <div class="header-item">
                <span class="header-label">견적명</span>
                <span>${formData.product_name || ''} 수리</span>
              </div>
              <div class="header-item">
                <span class="header-label">견적날짜</span>
                <span>${today.toLocaleDateString('ko-KR')}</span>
              </div>
              <div class="header-item">
                <span class="header-label">유효기간</span>
                <span>견적일로부터 1개월</span>
              </div>
            </div>
            <div>
              <div class="header-item">
                <span class="header-label">상호</span>
                <span>(주)슬림팩</span>
              </div>
              <div class="header-item">
                <span class="header-label">사업자번호</span>
                <span>230-81-03757</span>
              </div>
              <div class="header-item">
                <span class="header-label">주소</span>
                <span>서울시 강남구 도산대로55길 18 1층</span>
              </div>
              <div class="header-item">
                <span class="header-label">연락처</span>
                <span>02-548-8890</span>
              </div>
            </div>
          </div>

          <div class="estimate-amount">
            견적금액: 일금 ${estimateTotal.toLocaleString()}원 (￦${estimateTotal.toLocaleString()}) ※ 부가세포함
          </div>

          <table>
            <thead>
              <tr>
                <th>세부내용</th>
                <th>수량</th>
                <th>단가</th>
                <th>금액</th>
                <th>세액</th>
              </tr>
            </thead>
            <tbody>
              ${selectedParts.map(part => {
                const amount = (part.price || 0) * (part.quantity || 1);
                const tax = Math.round(amount * 0.1);
                return `
                  <tr>
                    <td>${part.name}</td>
                    <td>${part.quantity}</td>
                    <td class="amount-cell">${(part.price || 0).toLocaleString()}</td>
                    <td class="amount-cell">${amount.toLocaleString()}</td>
                    <td class="amount-cell">${tax.toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align:center;">합계</td>
                <td class="amount-cell">${estimateTotal.toLocaleString()}</td>
                <td class="amount-cell">${Math.round(estimateTotal * 0.1).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="note-section">
            <div class="note-title">비고</div>
            <div class="note-content">${formData.solution || ''}</div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(estimateHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // 하단 버튼 영역 수정
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
        onClick={handlePrintEstimate}
        startIcon={<DescriptionIcon />}
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
        견적서
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

  // 임시 저장
  const saveTempData = useCallback(() => {
    const temp = {
      formData,
      selectedParts,
      tags,
      status
    };
    localStorage.setItem(TEMP_KEY, JSON.stringify(temp));
    setHasTempData(true);
  }, [formData, selectedParts, tags, status]);

  // 임시 데이터 불러오기
  const loadTempData = () => {
    const temp = localStorage.getItem(TEMP_KEY);
    if (temp) {
      const { formData, selectedParts, tags, status } = JSON.parse(temp);
      setFormData(formData);
      setSelectedParts(selectedParts);
      setTags(tags);
      setStatus(status);
    }
  };

  // 임시 데이터 삭제
  const clearTempData = () => {
    localStorage.removeItem(TEMP_KEY);
    setHasTempData(false);
  };

  // 마운트 시 임시 데이터 존재 여부 확인
  useEffect(() => {
    setHasTempData(!!localStorage.getItem(TEMP_KEY));
  }, []);

  // 폼 데이터 변경 시 임시 저장
  useEffect(() => {
    if (hasUnsavedChanges && !isFormSubmitted) {
      saveTempData();
    }
  }, [formData, selectedParts, tags, status, hasUnsavedChanges, isFormSubmitted, saveTempData]);

  // 정상 등록 시 임시 데이터 삭제
  useEffect(() => {
    if (isFormSubmitted) {
      clearTempData();
    }
  }, [isFormSubmitted]);

  return (
    <Box sx={{ mt: 3, mx: 'auto', width: '95%', maxWidth: 1400 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
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
        {hasTempData && (
          <>
            <Button 
              variant="outlined" 
              onClick={loadTempData}
              sx={{ ml: 2, minWidth: 150 }}
            >
              임시 데이터 불러오기
            </Button>
            <Button 
              variant="outlined" 
              color="error"
              onClick={clearTempData}
              sx={{ ml: 1, mr: 2, minWidth: 120 }}
            >
              임시 데이터 삭제
            </Button>
          </>
        )}
      </Box>

      <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)', bgcolor: '#ffffff' }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4
        }}>
          <Typography variant="h5" sx={{ 
            color: '#191f28',
            fontWeight: 600 
          }}>
            A/S 신규 등록
          </Typography>
          <FormControlLabel
            control={
              <Checkbox 
                checked={isSimpleSale} 
                onChange={handleSimpleSaleToggle} 
                color="primary" 
              />
            }
            label="단순 판매 등록 (증상입력 생략 및 준비완료 상태로 전환)"
            sx={{ ml: 2, flexGrow: 1 }}
          />

          {/* 자동저장 상태 표시 */}
          {autoSave.lastSaved && (
            <Chip
              size="small"
              icon={<CloudDoneIcon />}
              label={`자동저장됨 ${format(autoSave.lastSaved, 'HH:mm:ss')}`}
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
          
          {autoSave.isSaving && (
            <Chip
              size="small"
              icon={<CircularProgress size={16} />}
              label="저장 중..."
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Box>

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
                      variant="standard"
                      fullWidth
                      required
                      type="date"
                      name="reception_date"
                      value={formData.reception_date}
                      onChange={handleInputChange}
                      size="small"
                      sx={{
                        '& .MuiInput-root': {
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
                      variant="standard"
                      fullWidth
                      required
                      select
                      name="reception_time"
                      value={RECEPTION_TIME_OPTIONS.includes(formData.reception_time) ? formData.reception_time : RECEPTION_TIME_OPTIONS[0]}
                      onChange={handleInputChange}
                      size="small"
                      sx={{
                        '& .MuiInput-root': {
                          height: '36px',
                          borderRadius: 1,
                          bgcolor: '#f9fafb'
                        }
                      }}
                    >
                      {RECEPTION_TIME_OPTIONS.map((time) => (
                        <MenuItem key={time} value={time}>{time}</MenuItem>
                      ))}
                    </TextField>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                          완료일자
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            variant="standard"
                            fullWidth
                      type="date"
                            name="completion_date"
                            value={formData.completion_date || ''}
                      onChange={handleInputChange}
                      size="small"
                      sx={{
                              flex: 2,
                        '& .MuiInput-root': {
                                height: '36px',
                          borderRadius: 1,
                          bgcolor: '#f9fafb'
                        }
                      }}
                    />
                          <TextField
                            variant="standard"
                            select
                            name="completion_time"
                            value={formData.completion_time || '00'}
                            onChange={handleInputChange}
                            size="small"
                            sx={{
                              flex: 1,
                              '& .MuiInput-root': {
                                height: '36px',
                                borderRadius: 1,
                                bgcolor: '#f9fafb'
                              }
                            }}
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <MenuItem key={i} value={String(i).padStart(2, '0')}>
                                {String(i).padStart(2, '0')}시
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {['준비중', '준비완료', '출고완료'].map((st) => (
                          <Button 
                            key={st}
                            onClick={() => handleStatusChange(st)}
                            variant={status === st ? "contained" : "outlined"}
                            size="small"
                            sx={buttonStyle(status === st, st)}
                          >
                            {st}
                          </Button>
                        ))}
                      </Box>
                      <TextField
                        variant="standard"
                        size="small"
                        name="writer"
                        label="작성자"
                        value={formData.writer}
                        onChange={handleInputChange}
                        sx={{ 
                          width: '150px',
                          '& .MuiInput-root': {
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
                        <Autocomplete
                          freeSolo
                          options={customerSearchResults}
                          getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            return option.name || '';
                          }}
                          getOptionKey={(option) => {
                            if (typeof option === 'string') return option;
                            return option.id || `${option.name}_${option.phone}`;
                          }}
                          value={formData.customer_name}
                          onInputChange={(event, newInputValue) => {
                            setFormData(prev => ({
                              ...prev,
                              customer_name: newInputValue
                            }));
                            if (newInputValue.length >= 2) {
                              searchCustomers(newInputValue);
                            }
                          }}
                          onChange={(event, newValue) => {
                            if (newValue && typeof newValue === 'object') {
                              // 기체만 추출하여 제품명 설정
                              const mainProduct = extractMainProduct(newValue.product_name);
                              
                              setFormData(prev => ({
                                ...prev,
                                customer_name: newValue.name,
                                customer_phone: newValue.phone,
                                customer_address: newValue.address,
                                product_name: mainProduct || prev.product_name,
                                seller: newValue.seller || prev.seller,
                                brand: newValue.brand || prev.brand
                              }));
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              variant="standard"
                              {...params}
                              fullWidth
                              required
                              size="small"
                              label="고객명"
                              placeholder="고객명을 입력하세요"
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                              <Box key={key} component="li" {...otherProps}>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {option.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.phone} {option.address && `• ${option.address}`}
                                  </Typography>
                                  {option.product_name && (
                                    <Typography variant="caption" color="primary" display="block">
                                      기종: {option.product_name}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            );
                          }}
                          loading={searchLoading}
                          noOptionsText="검색 결과가 없습니다"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Autocomplete
                          freeSolo
                          options={customerSearchResults}
                          getOptionLabel={(option) => {
                            if (typeof option === 'string') return option;
                            return option.phone || '';
                          }}
                          getOptionKey={(option) => {
                            if (typeof option === 'string') return option;
                            return option.id || `${option.name}_${option.phone}`;
                          }}
                          value={formData.customer_phone}
                          onInputChange={(event, newInputValue) => {
                            setFormData(prev => ({
                              ...prev,
                              customer_phone: newInputValue
                            }));
                            if (newInputValue.length >= 3) {
                              searchCustomers(newInputValue);
                            }
                          }}
                          onChange={(event, newValue) => {
                            if (newValue && typeof newValue === 'object') {
                              // 기체만 추출하여 제품명 설정
                              const mainProduct = extractMainProduct(newValue.product_name);
                              
                              setFormData(prev => ({
                                ...prev,
                                customer_name: newValue.name,
                                customer_phone: newValue.phone,
                                customer_address: newValue.address,
                                product_name: mainProduct || prev.product_name,
                                seller: newValue.seller || prev.seller,
                                brand: newValue.brand || prev.brand
                              }));
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              variant="standard"
                              {...params}
                              fullWidth
                              required
                              size="small"
                              label="연락처"
                              placeholder="연락처를 입력하세요"
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                              <Box key={key} component="li" {...otherProps}>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {option.phone}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.name} {option.address && `• ${option.address}`}
                                  </Typography>
                                  {option.product_name && (
                                    <Typography variant="caption" color="primary" display="block">
                                      기종: {option.product_name}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            );
                          }}
                          loading={searchLoading}
                          noOptionsText="검색 결과가 없습니다"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
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
                          variant="standard"
                          select
                          fullWidth
                          size="small"
                          name="brand"
                          label="브랜드"
                          value={selectedBrand}
                          onChange={(e) => {
                            setSelectedBrand(e.target.value);
                            setFormData(prev => ({ ...prev, brand: e.target.value, product_name: '' }));
                          }}
                          sx={{
                            '& .MuiInput-root': {
                              borderRadius: 1,
                              bgcolor: '#f9fafb'
                            }
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
                              product_name: toUpperCaseIfEnglish(newValue)
                            }));
                          }}
                          onInputChange={(event, newInputValue) => {
                            setFormData(prev => ({
                              ...prev,
                              product_name: toUpperCaseIfEnglish(newInputValue)
                            }));
                          }}
                          renderInput={(params) => (
                            <TextField
                              variant="standard"
                              {...params}
                              fullWidth
                              required
                              size="small"
                              label="제품명"
                              name="product_name"
                              sx={{
                                '& .MuiInput-root': {
                                  borderRadius: 1,
                                  bgcolor: '#f9fafb'
                                }
                              }}
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                product_name: toUpperCaseIfEnglish(e.target.value)
                              }))}
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                              <li key={key} {...otherProps}>
                                <Typography noWrap>
                                  {option}
                                </Typography>
                              </li>
                            );
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
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
                          variant="standard"
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
                          variant="standard"
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
                          variant="standard"
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
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          select
                          fullWidth
                          size="small"
                          name="warehouse_id"
                          label="A/S 담당 창고"
                          value={formData.warehouse_id || ''}
                          onChange={handleInputChange}
                        >
                          <MenuItem value=""><em>지정 안 함</em></MenuItem>
                          {warehouses.map((w) => (
                            <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
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
                      variant="standard"
                      fullWidth
                      required={!isSimpleSale}
                      multiline
                      minRows={5}
                      maxRows={15}
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
                      variant="standard"
                      fullWidth
                      multiline
                      minRows={5}
                      maxRows={15}
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
                          variant="standard"
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

          {/* 파일 업로드 섹션 */}
          <Grid item xs={12}>
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle1" sx={sectionStyle}>
                첨부 파일
              </Typography>
              <Box sx={{ mt: 2 }}>
                {/* 파일 업로드 버튼 */}
                <Box sx={{ mb: 2 }}>
                  <input
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                    style={{ display: 'none' }}
                    id="file-upload-addservice"
                    multiple
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                  />
                  <label htmlFor="file-upload-addservice">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={uploadingFiles ? <CircularProgress size={20} /> : <AddIcon />}
                      disabled={uploadingFiles}
                      sx={{ mb: 2 }}
                    >
                      {uploadingFiles ? '업로드 중...' : '파일 추가 (사진/영상/문서, 최대 5개)'}
                    </Button>
                  </label>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    첨부된 파일은 클라우드 보관소에 자동으로 업로드됩니다 (이미지는 자동 리사이즈됩니다)
                  </Typography>
                </Box>

                {/* 업로드된 파일 목록 */}
                {uploadedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      업로드된 파일 ({uploadedFiles.length}/5)
                    </Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>파일명</TableCell>
                            <TableCell>크기</TableCell>
                            <TableCell>업로드일</TableCell>
                            <TableCell align="center">작업</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {uploadedFiles.map((file) => (
                            <TableRow key={file.id}>
                              <TableCell>
                                <Link 
                                  href={file.webViewLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  sx={{ textDecoration: 'none' }}
                                >
                                  {file.name}
                                </Link>
                              </TableCell>
                              <TableCell>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </TableCell>
                              <TableCell>
                                {new Date(file.uploadDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  onClick={() => handlePreview(file.webViewLink)}
                                  title="미리보기"
                                  sx={{ mr: 1 }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleFileDelete(file.id)}
                                  color="error"
                                  title="파일 삭제"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            </Box>
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
                    startIcon={<AddIcon />}
                    variant="contained"
                    onClick={handleOpenPartsDialog}
                    sx={{ 
                      bgcolor: '#3182f6',
                      '&:hover': { bgcolor: '#1b64da' }
                    }}
                  >
                    부품 추가
                  </Button>
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
                              variant="standard"
                              type="number"
                              size="small"
                              value={part.quantity}
                              onChange={e => handleQuantityChange(index, e.target.value)}
                              sx={{
                                width: '80px',
                                '& .MuiInput-root': {
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
                                  variant="standard"
                                  type="number"
                                  size="small"
                                  value={part.price}
                                  onChange={(e) => handlePriceChange(index, e.target.value)}
                                  sx={{ 
                                    width: '120px',
                                    '& .MuiInput-root': {
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                              <Select
                                size="small"
                                value={part.status || '준비중'}
                                onChange={(e) => handlePartStatusChange(index, e.target.value)}
                                sx={{ minWidth: 90, height: '32px' }}
                              >
                                {/* 준비완료/출고완료/반품완료 상태에서는 준비중 선택 불가 */}
                                <MenuItem
                                  value="준비중"
                                  disabled={part.status === '준비완료' || part.status === '출고완료' || part.status === '반품완료'}
                                >
                                  준비중
                                </MenuItem>
                                <MenuItem value="부품준비">부품준비</MenuItem>
                                <MenuItem value="준비완료">준비완료</MenuItem>
                                <MenuItem value="출고완료">출고완료</MenuItem>
                                {part.status === '반품완료' && <MenuItem value="반품완료">반품완료</MenuItem>}
                              </Select>
                              {/* 준비중일 때만 삭제 아이콘 */}
                              {(part.status === '준비중' || part.status === '부품준비' || !part.status) ? (
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemovePart(part.id)}
                                  color="error"
                                  title="삭제"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              ) : part.status !== '반품완료' ? (
                                /* 준비완료 이후 반품 버튼 */
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleReturnPart(part.id)}
                                  sx={{ minWidth: '56px', height: '28px', fontSize: '11px', px: 1 }}
                                >
                                  반품
                                </Button>
                              ) : (
                                /* 반품완료 상태 표시 */
                                <Typography variant="caption" color="error" sx={{ fontSize: '11px', fontWeight: 'bold' }}>반품완료</Typography>
                              )}
                            </Box>
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
                onClick={handlePrintEstimate}
                startIcon={<DescriptionIcon />}
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
                견적서
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
                variant="outlined"
                disabled={submitting}
                onClick={() => { submitActionRef.current = 'list'; }}
                sx={{
                  color: '#3182f6',
                  borderColor: '#3182f6',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 4,
                  '&:hover': {
                    bgcolor: 'rgba(49, 130, 246, 0.04)'
                  }
                }}
              >
                저장/목록
              </Button>
              <Button 
                type="submit"
                variant="contained"
                disabled={submitting}
                onClick={() => { submitActionRef.current = 'detail'; }}
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
                저장/계속
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



      {/* 파일 미리보기 다이얼로그 */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography>파일 미리보기</Typography>
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
                alt="파일 미리보기"
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

      {/* 부품 검색 다이얼로그 */}
      <PartsSelectionDialog
        open={openPartsDialog}
        onClose={handleClosePartsDialog}
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onSearchKeyPress={() => {}}
        parts={availableParts
          .filter(part => 
            part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            part.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            part.brand.toLowerCase().includes(searchTerm.toLowerCase())
          )}
        selectedPart={selectedPart}
        onPartSelect={handlePartSelect}
        onAddPart={handleAddPart}
        quantity={1}
        onQuantityChange={() => {}}
      />

      {/* 미리보기 다이얼로그 */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography>이미지 미리보기</Typography>
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
      <CustomerSearchModal
        open={customerSearchOpen}
        onClose={() => setCustomerSearchOpen(false)}
        searchValue={customerInputValue}
        onSearchChange={handleCustomerSearchInput}
        onSearchKeyPress={handleCustomerSearchKeyPress}
        searchResults={customerSearchResults}
        searchLoading={searchLoading}
        historyCounts={customerHistoryCounts}
        onHistoryClick={fetchCustomerHistory}
        onCustomerSelect={handleCustomerSelect}
        historyLoading={customerHistoryLoading}
        onAddNewCustomer={handleAddNewCustomer}
      />

      {/* 고객 이력 다이얼로그 */}
      <CustomerHistoryDialog
        open={customerHistoryOpen}
        onClose={() => setCustomerHistoryOpen(false)}
        selectedCustomer={selectedCustomerForHistory}
        historyData={customerHistoryData}
        loading={customerHistoryLoading}
      />

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

      {/* 자동저장 복구 다이얼로그 */}
      <Dialog 
        open={showRestoreDialog} 
        onClose={() => setShowRestoreDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          💾 저장된 데이터가 있습니다
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {savedData && savedData.timestamp && (
              <>
                <strong>{format(new Date(savedData.timestamp), 'yyyy-MM-dd HH:mm:ss')}</strong>에 
                자동저장된 데이터를 복구하시겠습니까?
              </>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            복구하지 않으면 저장된 데이터가 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              autoSave.clear();
              setShowRestoreDialog(false);
              setSavedData(null);
              console.log('[AddService] 자동저장 데이터 삭제됨');
            }}
            sx={{ color: '#666' }}
          >
            삭제
          </Button>
          <Button 
            variant="contained"
            onClick={() => {
              if (savedData) {
                setFormData(savedData.formData || formData);
                setSelectedParts(savedData.selectedParts || []);
                setTags(savedData.tags || []);
                console.log('[AddService] 자동저장 데이터 복구됨');
                setSnackbar({
                  open: true,
                  message: '저장된 데이터를 복구했습니다.',
                  severity: 'success'
                });
              }
              setShowRestoreDialog(false);
            }}
            sx={{
              bgcolor: '#3182f6',
              '&:hover': { bgcolor: '#1b64da' }
            }}
          >
            복구하기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AddService;


