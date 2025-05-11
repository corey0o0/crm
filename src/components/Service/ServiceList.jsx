import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Chip,
  IconButton,
  Typography,
  TextField,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Grid,
  Alert,
  Stack,
  Input,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  TableFooter,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  TableSortLabel,
  TablePagination,
  InputAdornment,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  ButtonGroup,
} from '@mui/material';
import { 
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  RestartAlt as RestartAltIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { serviceApi } from '../../api/services';
import { supabase } from '../../lib/supabaseClient';
import ResponsiveTable from '../common/ResponsiveTable';
import AddService from './AddService';
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';
import { formatKoreanDateTime } from '../../utils/dateUtils';

// KST 변환 함수 추가
function toKST(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  // UTC → KST(+9)
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function formatDateYYMMDD(dateString) {
  const date = toKST(dateString);
  if (!date) return '';
  const ymd = date.toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\. /g, '-').replace(/\.$/, '');
  const weekday = date.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `${ymd} ${weekday}`;
}

function formatTimeHHMM(dateString) {
  const date = toKST(dateString);
  if (!date) return '';
  let hour = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  const isAM = hour < 12;
  const ampm = isAM ? '오전' : '오후';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${ampm} ${String(hour).padStart(2, '0')}:${min}`;
}

function ServiceList() {
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [services, setServices] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [filteredServices, setFilteredServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPart, setNewPart] = useState({ name: '', price: '' });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState([]);
  const [selectedOcrItems, setSelectedOcrItems] = useState({});
  const [ocrBoxes, setOcrBoxes] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [orderBy, setOrderBy] = useState('reception_date');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [excelUploadDialogOpen, setExcelUploadDialogOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    type: 'reception_date',
    startDate: '',
    endDate: ''
  });
  const [highlightedId, setHighlightedId] = useState(() => {
    // 쿠키와 로컬스토리지 모두 확인
    const savedIdFromCookie = getCookie('highlightServiceId');
    const savedIdFromStorage = localStorage.getItem('highlightServiceId');
    const savedId = savedIdFromCookie || savedIdFromStorage;
    
    console.log('Initial highlightServiceId from cookie/storage (on mount):', savedId);
    return savedId ? parseInt(savedId, 10) : null;
  });

  // 하이라이트 타이머 관리를 위한 ref
  const highlightTimerRef = useRef(null);

  // 컴포넌트 마운트 시 실행
  useEffect(() => {
    // 저장된 검색어 불러오기
    const savedSearchTerm = localStorage.getItem('serviceSearchTerm');
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
      setInputValue(savedSearchTerm);
    }
  }, []);

  // 검색어 변경 시 로컬스토리지에 저장
  useEffect(() => {
    if (searchTerm) {
      localStorage.setItem('serviceSearchTerm', searchTerm);
    }
  }, [searchTerm]);

  // 하이라이트 설정 함수 수정
  const setHighlightWithTimeout = (id) => {
    console.log('Setting highlight for ID:', id);
    setHighlightedId(id);
    setCookie('highlightServiceId', String(id));
    // 로컬스토리지에도 저장
    localStorage.setItem('highlightServiceId', String(id));
    console.log('Saved highlightServiceId to cookie and localStorage:', id);

    // 이전 타이머가 있다면 제거
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    // 새로운 타이머 설정 (시간을 30초로 늘림)
    highlightTimerRef.current = setTimeout(() => {
      console.log('Clearing highlight for ID:', id);
      setHighlightedId(null);
      removeCookie('highlightServiceId');
      localStorage.removeItem('highlightServiceId');
      highlightTimerRef.current = null;
    }, 30000); // 30초로 늘림
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // 데이터 로드 완료 후 하이라이트 체크 수정
  useEffect(() => {
    if (!loading && services.length > 0) {
      // 쿠키와 로컬스토리지 모두 확인
      const savedIdFromCookie = getCookie('highlightServiceId');
      const savedIdFromStorage = localStorage.getItem('highlightServiceId');
      const savedId = savedIdFromCookie || savedIdFromStorage;
      
      console.log('Checking highlight after data load. SavedId:', savedId, 'Loading:', loading);
      
      if (savedId) {
        const numericId = parseInt(savedId, 10);
        const serviceExists = services.some(service => service.id === numericId);
        
        if (serviceExists) {
          console.log('Found service to highlight:', numericId);
          setHighlightWithTimeout(numericId);
        } else {
          console.log('Service not found, clearing highlight');
          removeCookie('highlightServiceId');
          localStorage.removeItem('highlightServiceId');
          setHighlightedId(null);
        }
      }
    }
  }, [loading, services]);

  // 하이라이트 ID가 변경될 때마다 콘솔에 출력
  useEffect(() => {
    console.log('Current highlightedId (state):', highlightedId);
  }, [highlightedId]);

  const brandColors = {
    xlider: {
      main: '#000000',  // 검정색
      light: '#f5f5f5',
      text: '#ffffff'   // 흰색 텍스트
    },
    nearbike: {
      main: '#1976d2',  // 파란색
      light: '#e3f2fd',
      text: '#ffffff'   // 흰색 텍스트
    }
  };

  const steps = [
    '파일 선택',
    '업로드 중',
    'OCR 처리 중',
    '처리 완료'
  ];

  useEffect(() => {
    fetchServices();
  }, [selectedBrand]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setServices([]); // 데이터 로드 시작 시 초기화
      
      // 쿼리당 가져올 데이터 개수 (최대 1,000건, Supabase 기본 제한)
      const PAGE_SIZE = 1000;
      // 모든 데이터를 저장할 배열
      let allServicesData = [];
      // 데이터가 더 있는지 여부
      let hasMoreData = true;
      // 현재 오프셋
      let currentOffset = 0;
      
      // 먼저 총 데이터 개수 확인
      const { count, error: countError } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('brand', selectedBrand);
        
      if (countError) {
        console.error('Error counting services:', countError);
        throw countError;
      }
      
      console.log(`Total services in database: ${count}`);
      const totalPages = Math.ceil(count / PAGE_SIZE);
      console.log(`Will fetch data in ${totalPages} pages`);
      
      // 진행 중인 페이지 번호
      let currentPage = 1;
      
      while (hasMoreData) {
        console.log(`Fetching page ${currentPage}/${totalPages}: from=${currentOffset}, to=${currentOffset + PAGE_SIZE - 1}`);
        
        // 페이지네이션 방식으로 데이터 가져오기 - range 함수 사용
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          service_tags (
            tag_name
          ),
          service_parts (
            price,
            parts (
              name
            )
          )
        `)
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        if (servicesError) {
          console.error('Error fetching services page:', servicesError);
          throw servicesError;
        }
        
        if (!servicesData || servicesData.length === 0) {
          // 더 이상 데이터가 없음
          console.log('No more data found, ending fetch cycle');
          hasMoreData = false;
        } else {
          // 데이터 병합
          allServicesData = [...allServicesData, ...servicesData];
          
          // 다음 페이지 준비
          currentOffset += servicesData.length;
          currentPage++;
          
          // 가져온 데이터가 PAGE_SIZE보다 적으면 마지막 페이지
          if (servicesData.length < PAGE_SIZE) {
            console.log(`Last page reached with ${servicesData.length} records`);
            hasMoreData = false;
          }
          
          // 모든 페이지를 가져왔는지 확인
          if (currentPage > totalPages) {
            console.log('All pages fetched');
            hasMoreData = false;
          }
          
          // 진행 상황 업데이트
          console.log(`Loaded ${allServicesData.length}/${count} services (${Math.floor(allServicesData.length/count*100)}%)`);
          
          // 페이지별 데이터를 바로 상태에 적용하여 UI 반응성 향상
          const partialServicesWithTags = servicesData.map(service => ({
            ...service,
            status: service.status || '접수',
            tags: service.service_tags?.map(tag => tag.tag_name) || [],
            parts: service.service_parts?.map(part => ({
              name: part.parts?.name || '',
              price: part.price
            })) || []
          }));
          
          // 기존 데이터와 병합하여 상태 업데이트
          setServices(prev => [...prev, ...partialServicesWithTags]);
        }
      }

      // 최종 데이터 확인 및 갱신
      if (allServicesData.length !== count) {
        console.warn(`Warning: Loaded ${allServicesData.length} services, but expected ${count}`);
      }

      // 2. 서비스와 태그 데이터 병합
      const servicesWithTags = allServicesData.map(service => ({
        ...service,
        status: service.status || '접수',
        tags: service.service_tags?.map(tag => tag.tag_name) || [],
        parts: service.service_parts?.map(part => ({
          name: part.parts?.name || '',
          price: part.price
        })) || []
      }));

      // 전체 데이터를 한 번에 다시 설정 (혹시 모를 중복 방지)
      setServices(servicesWithTags);
      
      // 총 데이터 개수 확인 (로그용)
      console.log(`Total services loaded: ${servicesWithTags.length}`);
      
      // 데이터 로딩 완료 후 하이라이트 ID 체크
      const savedIdFromCookie = getCookie('highlightServiceId');
      const savedIdFromStorage = localStorage.getItem('highlightServiceId');
      const savedId = savedIdFromCookie || savedIdFromStorage;
      console.log('Checking highlightServiceId after data load:', savedId);
      
      if (savedId) {
        const numericId = parseInt(savedId, 10);
        // 해당 ID가 현재 데이터에 존재하는지 확인
        const serviceExists = servicesWithTags.some(service => service.id === numericId);
        
        if (serviceExists) {
          console.log('Service found, setting highlight:', numericId);
          setHighlightWithTimeout(numericId);
          
          // 30초 후 하이라이트 제거
          setTimeout(() => {
            console.log('Clearing highlight effect after timeout');
            setHighlightedId(null);
            removeCookie('highlightServiceId');
            localStorage.removeItem('highlightServiceId');
          }, 30000);
        } else {
          console.log('Service not found, clearing highlight');
          removeCookie('highlightServiceId');
          localStorage.removeItem('highlightServiceId');
        }
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 실시간 업데이트 구독
  useEffect(() => {
    const channel = supabase
      .channel('services-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'services' }, 
        payload => {
          console.log('Received real-time update:', payload);
          if (payload.eventType === 'INSERT' && payload.new.brand === selectedBrand) {
            const newServiceId = payload.new.id;
            console.log('New service added, ID:', newServiceId);
            
            // 새로운 서비스 추가 및 하이라이트 설정
            setServices(prev => [{
              ...payload.new,
              tags: []
            }, ...prev]);
            
            // 하이라이트 ID 설정
            setHighlightWithTimeout(newServiceId);
            console.log('Highlight set for service:', newServiceId);
            
            // 30초 후 하이라이트 제거
            setTimeout(() => {
              console.log('Removing highlight for service:', newServiceId);
              setHighlightedId(null);
              removeCookie('highlightServiceId');
              localStorage.removeItem('highlightServiceId');
            }, 30000);
          } else if (payload.eventType === 'UPDATE') {
            setServices(prev => prev.map(service => 
              service.id === payload.new.id ? {
                ...payload.new,
                tags: service.tags || []  // 기존 태그 유지
              } : service
            ));
          } else if (payload.eventType === 'DELETE') {
            setServices(prev => prev.filter(service => 
              service.id !== payload.old.id
            ));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedBrand]);

  useEffect(() => {
    // 브랜드와 검색어, 상태 필터, 날짜 필터 모두 적용
    const filtered = services.filter(service => {
      const matchesBrand = service.brand === selectedBrand;
      const matchesSearch = searchTerm === '' || 
        service.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.symptom?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || service.status === statusFilter;

      // 날짜 필터링 추가
      let matchesDate = true;
      if (dateFilter.startDate || dateFilter.endDate) {
        const serviceDate = service[dateFilter.type];
        if (dateFilter.startDate && (!serviceDate || serviceDate < dateFilter.startDate)) {
          matchesDate = false;
        }
        if (dateFilter.endDate && (!serviceDate || serviceDate > dateFilter.endDate)) {
          matchesDate = false;
        }
      }

      return matchesBrand && matchesSearch && matchesStatus && matchesDate;
    });
    setFilteredServices(filtered);
    setPage(0);
  }, [searchTerm, statusFilter, services, selectedBrand, dateFilter]);

  // 데이터 로딩 상태 확인을 위한 useEffect
  useEffect(() => {
    console.log('Current services state:', services); // 현재 services 상태 확인
    console.log('Current loading state:', loading); // 로딩 상태 확인
    console.log('Current error state:', error); // 에러 상태 확인
  }, [services, loading, error]);

  const getStatusColor = (status) => {
    if (!status) return 'default'; // null이나 undefined 처리
    if (status.includes('완료')) {
      return 'success';  // 완료는 초록색 계열
    }
    switch(status) {
      case '접수':
        return 'info';   // 접수는 파란색 계열
      case '처리중':
        return 'warning';  // 처리중은 주황색 계열
      case '부분완료':
        return 'secondary';  // 부분완료는 보라색 계열
      default:
        return 'default';
    }
  };

  const getDisplayStatus = (status) => {
    if (!status) return ''; // null이나 undefined 처리
    return status.includes('완료(**)')  ? '완료' : status;
  };

  const handleEdit = (serviceId) => {
    // 현재 하이라이트 ID를 명시적으로 저장
    if (serviceId) {
      setCookie('highlightServiceId', String(serviceId));
      localStorage.setItem('highlightServiceId', String(serviceId));
      console.log('Setting highlightServiceId before navigation:', serviceId);
    }
    navigate(`/services/${serviceId}`);
  };

  const handleDeleteClick = (service) => {
    setSelectedService(service);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', selectedService.id);

      if (error) throw error;

      setServices(prev => prev.filter(s => s.id !== selectedService.id));
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting service:', err);
      setError(err.message);
    }
  };

  const handleSave = () => {
    if (selectedService) {
      // API 호출로 데이터 업데이트
      const updatedServices = services.map(service => 
        service.id === selectedService.id 
          ? selectedService
          : service
      );
      setServices(updatedServices);
      setFilteredServices(updatedServices);
      setOpenDialog(false);
    }
  };

  const processImage = async (file) => {
    try {
      // 이미지를 base64로 변환
      const base64Image = await convertToBase64(file);
      
      // Google Cloud Vision API 요청 데이터 준비
      const requestData = {
        requests: [
          {
            image: {
              content: base64Image.split(',')[1]
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 50
              }
            ],
            imageContext: {
              languageHints: ['ko', 'en']
            }
          }
        ]
      };

      // API 호출
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.REACT_APP_GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        }
      );

      const result = await response.json();
      
      if (result.responses && result.responses[0].textAnnotations) {
        return processOcrResult(result.responses[0].textAnnotations);
      } else {
        throw new Error('텍스트를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('OCR 처리 실패:', error);
      throw error;
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processOcrResult = (annotations) => {
    const extractedItems = [];
    let currentItem = null;
    
    annotations.slice(1).forEach(annotation => {
      const text = annotation.description;
      const bbox = annotation.boundingPoly.vertices;
      
      const pricePattern = /(\d{1,3}(,\d{3})*원|\d+원)/;
      const partNamePattern = /[가-힣a-zA-Z0-9\s]+/;

      if (pricePattern.test(text)) {
        if (currentItem) {
          currentItem.price = parseInt(text.replace(/[^0-9]/g, ''));
          currentItem.box = bbox;
          extractedItems.push(currentItem);
          currentItem = null;
        }
      } else if (partNamePattern.test(text) && !currentItem) {
        currentItem = {
          id: extractedItems.length + 1,
          name: text,
          box: bbox
        };
      }
    });

    return extractedItems;
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    try {
      const file = files[0];
      setActiveStep(1);

      // OCR 처리
      setActiveStep(2);
      const result = await processImage(file);
      
      // OCR 결과 처리
      const extractedItems = result;
      
      // 신뢰도가 높은 항목만 필터링 (70% 이상)
      const filteredResults = extractedItems.filter(item => item.confidence > 0.7);
      
      setOcrResults(filteredResults);
      setOcrBoxes(filteredResults.map(item => ({
        ...item.box,
        id: item.id,
        isHighlighted: false,
        confidence: item.confidence
      })));

      // 신뢰도 높은 항목 자동 선택
      const initialSelection = {};
      filteredResults.forEach(item => {
        initialSelection[item.id] = item.confidence > 0.9;
      });
      setSelectedOcrItems(initialSelection);

      // 파일 저장
      setUploadedFiles([{
        url: URL.createObjectURL(file),
        name: file.name,
        type: 'image'
      }]);

      setActiveStep(3);

    } catch (error) {
      console.error('OCR 처리 중 오류:', error);
      setSnackbar({
        open: true,
        message: 'OCR 처리 중 오류가 발생했습니다.',
        severity: 'error'
      });
      setActiveStep(0);
    }

    setUploadProgress(0);
    setOcrProgress(0);
  };

  const handleOcrItemHover = (itemId, isHovered) => {
    setOcrBoxes(prev => 
      prev.map(box => ({
        ...box,
        isHighlighted: box.id === itemId ? isHovered : box.isHighlighted
      }))
    );
  };

  const handleOcrItemSelect = (itemId) => {
    setSelectedOcrItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleApplyOcrResults = () => {
    // 선택된 항목만 파츠에 추가
    const selectedParts = ocrResults.filter(item => selectedOcrItems[item.id]);
    
    setSelectedService(prev => ({
      ...prev,
      parts: [...(prev.parts || []), ...selectedParts]
    }));

    // OCR 결과 초기화
    setOcrResults([]);
    setSelectedOcrItems({});
  };

  const handleServiceChange = (event) => {
    const { name, value } = event.target;
    setSelectedService(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 파츠 총합 계산 함수
  const calculatePartsTotal = (parts) => {
    return parts?.reduce((sum, part) => sum + (part.price || 0), 0) || 0;
  };

  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleAddService = () => {
    navigate('/add-service', { state: { selectedBrand } });
  };

  const handleAddServiceSuccess = () => {
    fetchServices(); // 목록 새로고침
    setSnackbar({
      open: true,
      message: 'A/S가 성공적으로 등록되었습니다.',
      severity: 'success'
    });
  };

  // 날짜 변환 함수 추가
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    try {
      // 날짜가 이미 Date 객체인 경우
      if (dateStr instanceof Date) {
        return dateStr.toISOString().split('T')[0];
      }

      // 문자열이 아닌 경우 문자열로 변환
      const dateString = String(dateStr).trim();
      
      // 빈 문자열 처리
      if (dateString === '') return null;

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

  // 엑셀 업로드 핸들러 수정
  const handleExcelUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploadLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // 데이터 형식 변환
            const formattedData = jsonData.map(row => {
              const currentDate = new Date().toISOString().split('T')[0];
              
              return {
                brand: selectedBrand,
                reception_date: parseDate(row['접수일자']) || currentDate,
                reception_type: row['접수방법'] || '',
                repair_date: parseDate(row['입고일']) || null,
                completion_date: parseDate(row['출고일']) || null,
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
                mileage: row['주행거리'] || '',
                writer: row['작성자'] || '관리자',
                service_parts: [],
                service_tags: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
            });

            // 데이터 일괄 등록
            const { data: insertedData, error } = await supabase
              .from('services')
              .insert(formattedData)
              .select();

            if (error) throw error;

            // 성공 메시지 표시
            setSnackbar({
              open: true,
              message: `${insertedData.length}건의 A/S 데이터가 등록되었습니다.`,
              severity: 'success'
            });

            // 목록 새로고침
            fetchServices();

          } catch (error) {
            console.error('Error processing excel:', error);
            setSnackbar({
              open: true,
              message: '엑셀 데이터 처리 중 오류가 발생했습니다: ' + error.message,
              severity: 'error'
            });
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Error uploading excel:', error);
        setSnackbar({
          open: true,
          message: '엑셀 업로드 중 오류가 발생했습니다.',
          severity: 'error'
        });
      } finally {
        setUploadLoading(false);
      }
    };

    input.click();
  };

  const handleRowClick = (service) => {
    if (!service || !service.id) {
      setSnackbar({
        open: true,
        message: 'A/S 정보를 찾을 수 없습니다.',
        severity: 'error'
      });
      return;
    }
    
    // 하이라이트 ID 설정
    if (service.id) {
      setCookie('highlightServiceId', String(service.id));
      localStorage.setItem('highlightServiceId', String(service.id));
      console.log('Setting highlightServiceId before navigation:', service.id);
    }
    
    navigate(`/services/${service.id}`);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortData = (data) => {
    return [...data].sort((a, b) => {
      if (!a[orderBy] || !b[orderBy]) return 0;
      
      let comparison = 0;
      if (orderBy === 'customer_info') {
        // 고객 정보는 고객명으로 정렬
        comparison = a.customer_name.localeCompare(b.customer_name);
      } else if (orderBy === 'tags') {
        // 태그는 첫 번째 태그로 정렬
        const tagA = a.tags?.[0] || '';
        const tagB = b.tags?.[0] || '';
        comparison = tagA.localeCompare(tagB);
      } else if (orderBy === 'reception_date') {
        // 접수일자는 날짜 비교
        comparison = new Date(a[orderBy]) - new Date(b[orderBy]);
      } else {
        // 나머지 필드는 직접 비교
        comparison = String(a[orderBy]).localeCompare(String(b[orderBy]));
      }
      
      return order === 'desc' ? -comparison : comparison;
    });
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
  const paginatedServices = sortData(filteredServices).slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 테이블 컬럼 정의
  const columns = [
    { 
      id: 'status_indicator', 
      label: '',
      sortable: false,
      width: '6px',
      render: (row) => (
        <Box
          sx={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: row.id === highlightedId 
              ? '#ffd700'
              : row.status?.includes('완료') 
                ? '#2e7d32'
                : row.status === '처리중'
                  ? '#ed6c02'
                  : row.status === '접수'
                    ? '#1976d2'
                    : '#757575',
            transition: 'all 0.3s ease',
            animation: row.id === highlightedId 
              ? 'pulse 1.5s ease-in-out infinite'
              : 'none',
            '@keyframes pulse': {
              '0%': {
                boxShadow: '0 0 0 0 rgba(255, 215, 0, 0.7)',
                transform: 'scale(1)'
              },
              '50%': {
                boxShadow: '0 0 0 6px rgba(255, 215, 0, 0)',
                transform: 'scale(1.1)'
              },
              '100%': {
                boxShadow: '0 0 0 0 rgba(255, 215, 0, 0)',
                transform: 'scale(1)'
              }
            }
          }}
        />
      )
    },
    { 
      id: 'reception_date',
      label: '접수일시',
      sortable: true,
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} noWrap>
            {formatDateYYMMDD(params.value)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5, whiteSpace: 'nowrap' }} noWrap>
            {formatTimeHHMM(params.value)}
          </Typography>
        </Box>
      ),
      render: (row) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} noWrap>
            {formatDateYYMMDD(row.reception_date)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5, whiteSpace: 'nowrap' }} noWrap>
            {formatTimeHHMM(row.reception_date)}
          </Typography>
        </Box>
      )
    },
    { 
      id: 'customer_info', 
      label: '이름',
      sortable: true,
      render: (row) => (
        <Typography notwrap sx={{ 
          fontSize: '0.95rem', 
          fontWeight: 700,
          letterSpacing: '0.01em' 
        }}>
          {row.customer_name}
        </Typography>
      )
    },
    { 
      id: 'customer_info', 
      label: '연락처',
      sortable: true,
      render: (row) => (
        <Typography noWrap sx={{ 
          fontSize: '0.95rem', 
          fontWeight: 700,
          letterSpacing: '0.01em', 
          color: 'text.primary' 
        }}>
          {row.customer_phone}
        </Typography>
      )
    },
    { 
      id: 'product_name', 
      label: '기종',
      sortable: true,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ 
            fontSize: '0.95rem', 
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: 'text.primary' 
          }}>
            {row.product_name}
          </Typography>
            {row.mileage && (
              <Typography noWrap sx={{ 
                fontSize: '0.85rem', 
                mt: 0.5,
                color: 'text.secondary',
                letterSpacing: '0.01em' 
              }}>
                ODO: {row.mileage}
              </Typography>
            )}
          </Box>
          {(row.note?.includes('JPG:') || row.receipt_link) && (
            <Tooltip title="영수증 첨부됨">
              <ReceiptIcon 
                sx={{ 
                  fontSize: '1.1rem', 
                  color: 'primary.main',
                  opacity: 0.8,
                  flexShrink: 0
                }} 
              />
            </Tooltip>
          )}
        </Box>
      )
    },
    { 
      id: 'symptom', 
      label: '문의내역',
      sortable: true,
      width: 200,
      render: (row) => (
        <Tooltip 
          title={
            <Box sx={{ p: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                문의내역:
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {row.symptom || '문의내역이 없습니다.'}
              </Typography>
            </Box>
          } 
          placement="top"
          arrow
        >
          <Typography sx={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '200px',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.4em',
            maxHeight: '5.6em',
            fontSize: '0.95rem',
            letterSpacing: '0.01em',
            color: 'text.primary'
          }}>
            {row.symptom}
          </Typography>
        </Tooltip>
      )
    },
    { 
      id: 'tags', 
      label: '처리내역',
      sortable: true,
      width: 200,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: '200px' }}>
          {/* 사용부품 아이콘 및 툴팁 */}
          {Array.isArray(row.service_parts) && row.service_parts.length > 0 && (
            <Tooltip
              title={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>사용부품</Typography>
                  {row.service_parts.map((sp, idx) => (
                    <Typography key={idx} variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {sp.parts?.name || '-'} : {sp.price?.toLocaleString() || 0}원
                    </Typography>
                  ))}
                  <Typography variant="body2" sx={{ fontWeight: 900, color: '#fff', mt: 1 }}>
                    합계: {row.service_parts.reduce((sum, sp) => sum + (sp.price || 0), 0).toLocaleString()}원
                  </Typography>
                </Box>
              }
              placement="top"
              arrow
            >
              <BuildIcon sx={{ color: 'primary.main', fontSize: 20, mr: 0.5 }} />
            </Tooltip>
          )}
          {/* 기존 처리내역/태그 렌더링 */}
          <Tooltip 
            title={
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                  처리내역:
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {row.solution || '처리내역이 없습니다.'}
                </Typography>
              </Box>
            } 
            placement="top"
            arrow
          >
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: '170px' }}>
              {row.tags?.length > 0 ? (
                row.tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    size="small"
                    sx={{
                      height: '22px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      letterSpacing: '0.01em',
                      bgcolor: 'primary.50',
                      color: 'primary.700',
                      '&:hover': {
                        bgcolor: 'primary.100'
                      }
                    }}
                  />
                ))
              ) : (
                row.solution ? (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      maxWidth: '170px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.4em',
                      maxHeight: '5.6em',
                      fontSize: '0.95rem',
                      letterSpacing: '0.01em'
                    }}
                  >
                    {row.solution}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">-</Typography>
                )
              )}
            </Box>
          </Tooltip>
        </Box>
      )
    },
    { 
      id: 'status', 
      label: '상태',
      sortable: true,
      render: (row) => (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 0.8 
        }}>
          <Chip
            label={getDisplayStatus(row.status)}
            color={getStatusColor(row.status)}
            size="small"
            sx={{
              height: '24px',
              fontSize: '0.9rem',
              fontWeight: 500,
              letterSpacing: '0.01em',
              '& .MuiChip-label': {
                px: 1.5
              }
            }}
          />
          {row.status.includes('완료') && row.completion_date && (
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.85rem',
                color: 'text.secondary',
                letterSpacing: '0.02em'
              }}
            >
              {row.completion_date.replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${y.slice(-2)}-${m}-${d}`)}
            </Typography>
          )}
        </Box>
      )
    },
    { 
      id: 'actions', 
      label: '관리',
      sortable: false,
      render: (row) => (
        <Box>
          <IconButton size="small" onClick={(e) => {
            e.stopPropagation();
            handleEdit(row.id);
          }}>
            <EditIcon />
          </IconButton>
          <IconButton size="small" onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(row);
          }}>
            <DeleteIcon />
          </IconButton>
        </Box>
      )
    }
  ];

  // 하이라이트 ID 모니터링
  useEffect(() => {
    if (!loading && services.length > 0) {
      console.log('Services loaded, current highlightedId:', highlightedId);
    }
  }, [loading, services, highlightedId]);

  // 모바일 카드 렌더링 함수 수정
  const renderMobileCard = (row, index) => (
    <Card 
      key={index} 
      onClick={() => handleRowClick(row)} 
      sx={{ 
        cursor: 'pointer',
        position: 'relative',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)'
        },
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box
            sx={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: row.id === highlightedId 
                ? '#ffd700'
                : row.status?.includes('완료') 
                  ? '#2e7d32'
                  : row.status === '처리중'
                    ? '#ed6c02'
                    : row.status === '접수'
                      ? '#1976d2'
                      : '#757575',
              transition: 'all 0.3s ease',
              animation: row.id === highlightedId 
                ? 'pulse 1.5s ease-in-out infinite'
                : 'none',
              '@keyframes pulse': {
                '0%': {
                  boxShadow: '0 0 0 0 rgba(255, 215, 0, 0.7)',
                  transform: 'scale(1)'
                },
                '50%': {
                  boxShadow: '0 0 0 6px rgba(255, 215, 0, 0)',
                  transform: 'scale(1.1)'
                },
                '100%': {
                  boxShadow: '0 0 0 0 rgba(255, 215, 0, 0)',
                  transform: 'scale(1)'
                }
              },
              flexShrink: 0
            }}
          />
        <Typography variant="subtitle1" sx={{ 
          fontSize: '1.1rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
        }}>
          {row.customer_name}
        </Typography>
        </Box>
        <Typography sx={{ 
          fontSize: '0.95rem',
          fontWeight: 700,
          letterSpacing: '0.01em',
          mb: 1.5,
          color: 'text.primary'
        }}>
          {row.customer_phone}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ 
            fontSize: '0.95rem',
            letterSpacing: '0.01em',
            color: 'text.primary'
          }}>
            기종: {row.product_name}
          </Typography>
          {(row.note?.includes('JPG:') || row.receipt_link) && (
            <Tooltip title="영수증 첨부됨">
              <ReceiptIcon 
                sx={{ 
                  fontSize: '1.1rem', 
                  color: 'primary.main',
                  opacity: 0.8,
                  flexShrink: 0
                }} 
              />
            </Tooltip>
          )}
        </Box>
        {row.mileage && (
        <Typography sx={{ 
            ml: 1,
            mt: 0.5,
            fontSize: '0.9rem',
          letterSpacing: '0.01em',
            color: 'text.secondary',
        }}>
            ODO: {row.mileage}
        </Typography>
        )}
        <Typography sx={{ 
          mt: 1.5,
          fontSize: '0.95rem',
          letterSpacing: '0.01em',
          color: 'text.primary',
          lineHeight: 1.4,
          maxWidth: '200px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxHeight: '5.6em'
        }}>
          문의내역: {row.symptom}
        </Typography>
        
        {/* 처리내역 및 태그 부분 */}
        <Box sx={{ mt: 1.5, mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            처리내역:
          </Typography>
          {row.tags?.length > 0 ? (
            <Tooltip
              title={
                <Box sx={{ p: 1 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    처리내역:
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {row.solution || '처리내역이 없습니다.'}
                  </Typography>
                </Box>
              }
              placement="top"
              arrow
            >
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: '200px' }}>
                {row.tags.map((tag, index) => (
            <Chip
              key={index}
              label={tag}
              size="small"
              sx={{
                height: '22px',
                fontSize: '0.85rem',
                fontWeight: 500,
                letterSpacing: '0.01em',
                bgcolor: 'primary.50',
                color: 'primary.700'
              }}
            />
          ))}
        </Box>
            </Tooltip>
          ) : (
            row.solution ? (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  maxWidth: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '1.4em',
                  maxHeight: '5.6em',
                  fontSize: '0.95rem',
                  letterSpacing: '0.01em'
                }}
              >
                {row.solution}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )
          )}
        </Box>

        <Box sx={{ 
          mt: 2, 
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-start', 
            gap: 0.8 
          }}>
            <Chip
              label={getDisplayStatus(row.status)}
              color={getStatusColor(row.status)}
              size="small"
              sx={{
                height: '24px',
                fontSize: '0.9rem',
                fontWeight: 500,
                letterSpacing: '0.01em',
                '& .MuiChip-label': {
                  px: 1.5
                }
              }}
            />
            {row.status.includes('완료') && row.completion_date && (
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.85rem',
                  color: 'text.secondary',
                  letterSpacing: '0.02em'
                }}
              >
                {row.completion_date.replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${y.slice(-2)}-${m}-${d}`)}
              </Typography>
            )}
          </Box>
          <Box>
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row.id);
              }}
              sx={{ 
                color: 'primary.main',
                '&:hover': { 
                  backgroundColor: 'primary.50' 
                }
              }}
            >
              <EditIcon />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(row);
              }}
              sx={{ 
                color: 'error.main',
                '&:hover': { 
                  backgroundColor: 'error.50' 
                }
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ mt: 2, mb: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatDateYYMMDD(row.reception_date)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {formatTimeHHMM(row.reception_date)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );

  // 엑셀 다운로드 함수 추가
  const handleDownloadExcel = async () => {
    try {
      // 현재 선택된 브랜드의 서비스 데이터 가져오기
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false });

      if (error) throw error;

      // 데이터 가공
      const exportData = data.map(service => ({
        접수일자: service.reception_date || '',
        접수방법: service.reception_type || '',
        입고일: service.repair_date || '',
        출고일: service.completion_date || '',
        배송방법: service.delivery_method || '',
        고객명: service.customer_name || '',
        연락처: service.customer_phone || '',
        주소: service.customer_address || '',
        제품: service.product_name || '',
        주행거리: service.mileage || '',
        증상: service.symptom || '',
        처리내역: service.solution || '',
        상태: service.status || '',
        메모: service.note || '',
        JPG: service.receipt_link || '',
        구매처: service.seller || '',
        작성자: service.writer || '관리자'
      }));

      // 엑셀 워크북 생성
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AS목록");

      // 컬럼 너비 설정
      const wscols = [
        { wch: 12 },  // 접수일자
        { wch: 10 },  // 접수방법
        { wch: 12 },  // 입고일
        { wch: 12 },  // 출고일
        { wch: 10 },  // 배송방법
        { wch: 12 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 40 },  // 주소
        { wch: 20 },  // 제품
        { wch: 10 },  // 주행거리
        { wch: 40 },  // 증상
        { wch: 40 },  // 처리내역
        { wch: 10 },  // 상태
        { wch: 30 },  // 메모
        { wch: 10 },  // JPG
        { wch: 20 },  // 구매처
        { wch: 10 },  // 작성자
      ];
      ws['!cols'] = wscols;

      // 파일 다운로드 (브랜드명 포함)
      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      XLSX.writeFile(wb, `AS목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

    } catch (error) {
      console.error('Error downloading excel:', error);
      setSnackbar({
        open: true,
        message: '엑셀 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 검색어 입력 처리 함수
  const handleSearchInput = (event) => {
    setInputValue(event.target.value);
  };

  // 검색 실행 함수
  const executeSearch = () => {
    const term = inputValue.toLowerCase().trim();
    setSearchTerm(term);
    
    // 검색어 로컬스토리지에 저장
    if (term) {
      localStorage.setItem('serviceSearchTerm', term);
    } else {
      localStorage.removeItem('serviceSearchTerm');
    }
    
    if (!term) {
      setFilteredServices(services);
      return;
    }

    const filtered = services.filter(service => {
      const nameMatch = service.customer_name?.toLowerCase().includes(term);
      const phoneMatch = service.customer_phone?.toLowerCase().includes(term);
      const productMatch = service.product_name?.toLowerCase().includes(term);
      const symptomMatch = service.symptom?.toLowerCase().includes(term);
      
      return nameMatch || phoneMatch || productMatch || symptomMatch;
    });
    
    setFilteredServices(filtered);
  };

  //1. 초기화 함수 추가
  const handleClearSearch = () => {
    setInputValue('');
    setSearchTerm('');
    localStorage.removeItem('serviceSearchTerm');
    console.log('Search cleared');
    setFilteredServices(services);
  };

  // 검색, 필터 모두 초기화하는 함수 추가
  const handleResetAll = () => {
    // 검색어 초기화
    setInputValue('');
    setSearchTerm('');
    localStorage.removeItem('serviceSearchTerm');
    
    // 상태 필터 초기화
    setStatusFilter('all');
    
    // 날짜 필터 초기화
    setDateFilter({
      type: 'reception_date',
      startDate: '',
      endDate: ''
    });
    
    // 필터링된 서비스 초기화
    setFilteredServices(services);
    
    // 페이지 초기화
    setPage(0);
    
    console.log('모든 필터가 초기화되었습니다.');
    
    setSnackbar({
      open: true,
      message: '모든 필터가 초기화되었습니다.',
      severity: 'info'
    });
  };

  // 1. 필터 상태 저장/불러오기 함수 추가
  const FILTER_KEY = 'serviceListFilters';

  const saveFilterState = () => {
    const filterState = {
      selectedBrand,
      statusFilter,
      dateFilter,
      inputValue,
      searchTerm,
    };
    localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
    setSnackbar({
      open: true,
      message: '필터가 저장되었습니다.',
      severity: 'success'
    });
  };

  const loadFilterState = () => {
    const saved = localStorage.getItem(FILTER_KEY);
    if (!saved) {
      setSnackbar({
        open: true,
        message: '저장된 필터가 없습니다.',
        severity: 'info'
      });
      return;
    }
    try {
      const filterState = JSON.parse(saved);
      setSelectedBrand(filterState.selectedBrand || 'XRB');
      setStatusFilter(filterState.statusFilter || 'all');
      setDateFilter(filterState.dateFilter || { type: 'reception_date', startDate: '', endDate: '' });
      setInputValue(filterState.inputValue || '');
      setSearchTerm(filterState.searchTerm || '');
      setSnackbar({
        open: true,
        message: '필터가 불러와졌습니다.',
        severity: 'success'
      });
    } catch {
      setSnackbar({
        open: true,
        message: '필터 불러오기 실패',
        severity: 'error'
      });
    }
  };

  const [searchMode, setSearchMode] = useState('AND'); // AND/OR 검색 모드
  const [selectedStatuses, setSelectedStatuses] = useState([]); // 다중 상태
  const [selectedTags, setSelectedTags] = useState([]); // 다중 태그
  const statusOptions = ['접수', '처리중', '부분완료', '완료'];
  const tagOptions = Array.from(new Set(services.flatMap(s => s.tags || [])));

  const handleSearchModeChange = (e, value) => {
    if (value) setSearchMode(value);
  };
  const handleStatusChange = (e, value) => setSelectedStatuses(value);
  const handleTagChange = (e, value) => setSelectedTags(value);
  const handleQuickDate = (type) => {
    const today = new Date();
    let start, end;
    if (type === 'today') {
      start = end = today;
    } else if (type === 'yesterday') {
      start = new Date(today);
      start.setDate(today.getDate() - 1);
      end = new Date(start);
    } else if (type === 'thisWeek') {
      const day = today.getDay();
      start = new Date(today);
      start.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
      end = today;
    } else if (type === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (type === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }
    setDateFilter(prev => ({
      ...prev,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    }));
  };

  useEffect(() => {
    const filtered = services.filter(service => {
      // 다중 상태 필터
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(service.status);
      // 다중 태그 필터
      const matchesTags = selectedTags.length === 0 || (service.tags && selectedTags.every(tag => service.tags.includes(tag)));
      // 날짜 필터
      let matchesDate = true;
      if (dateFilter.startDate || dateFilter.endDate) {
        const serviceDate = service[dateFilter.type];
        if (dateFilter.startDate && (!serviceDate || serviceDate < dateFilter.startDate)) {
          matchesDate = false;
        }
        if (dateFilter.endDate && (!serviceDate || serviceDate > dateFilter.endDate)) {
          matchesDate = false;
        }
      }
      // 복합 검색 (AND/OR)
      if (searchTerm) {
        const keywords = searchTerm.split(/\s+/).filter(Boolean);
        const fields = [service.customer_name, service.customer_phone, service.product_name, service.symptom].map(f => (f || '').toLowerCase());
        if (searchMode === 'AND') {
          if (!keywords.every(kw => fields.some(f => f.includes(kw)))) return false;
        } else {
          if (!keywords.some(kw => fields.some(f => f.includes(kw)))) return false;
        }
      }
      return matchesStatus && matchesTags && matchesDate;
    });
    setFilteredServices(filtered);
    setPage(0);
  }, [searchTerm, searchMode, selectedStatuses, selectedTags, statusFilter, services, selectedBrand, dateFilter]);

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
    <Box sx={{ 
      maxWidth: '1800px', 
      width: 'auto', 
      mx: 'auto'
    }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Tabs 
            value={selectedBrand} 
            onChange={handleBrandChange}
          >
            <Tab 
              label="X-RIDER" 
              value="XRB"
              sx={{ fontWeight: 'bold' }}
            />
            <Tab 
              label="NEARBIKE" 
              value="NB"
              sx={{ fontWeight: 'bold' }}
            />
          </Tabs>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/service/add', { state: { selectedBrand } })}
              sx={{
                bgcolor: '#3182f6',
                '&:hover': { bgcolor: '#1b64da' }
              }}
            >
              신규 등록
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleExcelUpload}
            >
              엑셀 등록
            </Button>
            <Tooltip title="A/S 목록 다운로드">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
              >
                엑셀 다운로드
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <TextField
            variant="outlined"
            placeholder="고객명, 연락처, 제품명으로 검색"
            value={inputValue}
            onChange={handleSearchInput}
            onKeyPress={(e) => e.key === 'Enter' && executeSearch()}
            sx={{ flex: 1, minWidth: 200, maxWidth: 400 }}
            size="small"
            InputProps={{
              endAdornment: inputValue ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={handleClearSearch}
                    size="small"
                    aria-label="검색어 초기화"
                    sx={{ color: 'gray' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
          />
          <ToggleButtonGroup
            value={searchMode}
            exclusive
            onChange={handleSearchModeChange}
            size="small"
            sx={{ height: 40 }}
          >
            <ToggleButton value="AND">AND</ToggleButton>
            <ToggleButton value="OR">OR</ToggleButton>
          </ToggleButtonGroup>
          <Autocomplete
            multiple
            options={statusOptions}
            value={selectedStatuses}
            onChange={handleStatusChange}
            disableCloseOnSelect
            size="small"
            sx={{ minWidth: 140, maxWidth: 180 }}
            renderInput={(params) => <TextField {...params} label="상태" size="small" />}
          />
          <Autocomplete
            multiple
            options={tagOptions}
            value={selectedTags}
            onChange={handleTagChange}
            disableCloseOnSelect
            size="small"
            sx={{ minWidth: 140, maxWidth: 180 }}
            renderInput={(params) => <TextField {...params} label="태그" size="small" />}
          />
          <TextField
            select
            value={dateFilter.type}
            onChange={(e) => setDateFilter(prev => ({ ...prev, type: e.target.value }))}
            sx={{ width: 120, minWidth: 100 }}
            size="small"
            label="날짜유형"
          >
            <MenuItem value="reception_date">접수일자</MenuItem>
            <MenuItem value="completion_date">완료일자</MenuItem>
          </TextField>
          <TextField
            type="date"
            value={dateFilter.startDate}
            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
            sx={{ width: 120, minWidth: 100 }}
            size="small"
            label="시작일"
            InputLabelProps={{ shrink: true }}
          />
          <Typography variant="body2" sx={{ mx: 0.5 }}>~</Typography>
          <TextField
            type="date"
            value={dateFilter.endDate}
            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
            sx={{ width: 120, minWidth: 100 }}
            size="small"
            label="종료일"
            InputLabelProps={{ shrink: true }}
          />
          <ButtonGroup sx={{ ml: 1 }}>
            <Button onClick={() => handleQuickDate('today')}>오늘</Button>
            <Button onClick={() => handleQuickDate('yesterday')}>어제</Button>
            <Button onClick={() => handleQuickDate('thisWeek')}>이번주</Button>
            <Button onClick={() => handleQuickDate('thisMonth')}>이번달</Button>
            <Button onClick={() => handleQuickDate('lastMonth')}>지난달</Button>
          </ButtonGroup>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={executeSearch}
              sx={{ minWidth: 70, height: 40 }}
            >
              검색
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleResetAll}
              sx={{ minWidth: 70, height: 40 }}
              startIcon={<RestartAltIcon fontSize="small" />}
            >
              초기화
            </Button>
            <Button variant="outlined" onClick={saveFilterState} sx={{ minWidth: 70, height: 40 }}>
              필터 저장
            </Button>
            <Button variant="outlined" onClick={loadFilterState} sx={{ minWidth: 70, height: 40 }}>
              필터 불러오기
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* A/S 목록 테이블 */}
      <ResponsiveTable
        columns={columns.map(column => ({
          ...column,
          label: column.sortable ? (
            <TableSortLabel
              active={orderBy === column.id}
              direction={orderBy === column.id ? order : 'asc'}
              onClick={() => handleSort(column.id)}
            >
              <Typography noWrap component="span" sx={{ fontWeight: 'bold' }}>
                {column.label}
              </Typography>
            </TableSortLabel>
          ) : (
            <Typography noWrap component="span" sx={{ fontWeight: 'bold' }}>
              {column.label}
            </Typography>
          )
        }))}
        data={paginatedServices}
        renderMobileCard={renderMobileCard}
        onRowClick={handleRowClick}
        hoverEffect={true}
        rowSx={(row) => ({
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)'
          }
        })}
        sx={{
          '& .MuiTableRow-root': {
            transition: 'background-color 0.3s ease',
          }
        }}
      />

      {/* 페이지네이션 추가 */}
      <TablePagination
        component="div"
        count={filteredServices.length}
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

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="md" 
        fullWidth
        keepMounted={false}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">A/S 작업</Typography>
            <IconButton 
              onClick={() => setOpenDialog(false)} 
              size="small"
              aria-label="닫기"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="접수일자"
                type="date"
                name="reception_date"
                value={selectedService?.reception_date || ''}
                onChange={handleServiceChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="입고일"
                type="date"
                name="repair_date"
                value={selectedService?.repair_date || ''}
                onChange={handleServiceChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="출고일"
                type="date"
                name="completion_date"
                value={selectedService?.completion_date || ''}
                onChange={handleServiceChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="접수 방법"
                name="reception_type"
                value={selectedService?.reception_type || ''}
                onChange={handleServiceChange}
              >
                <MenuItem value="공홈">공홈</MenuItem>
                <MenuItem value="방문">방문</MenuItem>
                <MenuItem value="전화">전화</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="배송 방법"
                name="delivery_method"
                value={selectedService?.delivery_method || ''}
                onChange={handleServiceChange}
              >
                <MenuItem value="방문수령">방문수령</MenuItem>
                <MenuItem value="택배">택배</MenuItem>
                <MenuItem value="설치기사">설치기사</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="고객명"
                name="customer_name"
                value={selectedService?.customer_name || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="연락처"
                name="customer_phone"
                value={selectedService?.customer_phone || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="주소"
                name="customer_address"
                value={selectedService?.customer_address || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="제품명"
                name="product_name"
                value={selectedService?.product_name || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="문제 설명"
                name="symptom"
                multiline
                rows={4}
                value={selectedService?.symptom || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="처리 내역"
                name="solution"
                multiline
                rows={4}
                value={selectedService?.solution || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="상태"
                name="status"
                value={selectedService?.status || ''}
                onChange={handleServiceChange}
              >
                <MenuItem value="접수">접수</MenuItem>
                <MenuItem value="처리중">처리중</MenuItem>
                <MenuItem value="부분완료">부분완료</MenuItem>
                <MenuItem value="완료">완료</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                영수증/이미지 업로드
              </Typography>
              
              {/* 업로드 진행 상태 */}
              <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {uploadProgress > 0 && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={uploadProgress} 
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    업로드 중... {uploadProgress}%
                  </Typography>
                </Box>
              )}

              {ocrProgress > 0 && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={ocrProgress} 
                    color="secondary"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    OCR 처리 중... {ocrProgress}%
                  </Typography>
                </Box>
              )}

              {/* 파일 업로드 버튼 */}
              <Box sx={{ mb: 2 }}>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  id="file-upload"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                  >
                    파일 업로드
                  </Button>
                </label>
                <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                  * 영수증 이미지 업로드 시 자동으로 항목을 인식합니다.
                </Typography>
              </Box>

              {/* 업로드된 파일 목록 */}
              {uploadedFiles.length > 0 && (
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <ImageList sx={{ maxHeight: 400 }} cols={1} rowHeight={400}>
                    {uploadedFiles.map((file, index) => (
                      <ImageListItem key={index} sx={{ position: 'relative' }}>
                        {file.type === 'image' ? (
                          <>
                            <img
                              src={file.url}
                              alt={file.name}
                              loading="lazy"
                              style={{ objectFit: 'contain' }}
                            />
                            {/* OCR 인식 영역 표시 */}
                            {ocrBoxes.map((box) => (
                              <Box
                                key={box.id}
                                sx={{
                                  position: 'absolute',
                                  left: `${box.x}px`,
                                  top: `${box.y}px`,
                                  width: `${box.width}px`,
                                  height: `${box.height}px`,
                                  border: '2px solid',
                                  borderColor: box.isHighlighted ? 'primary.main' : 'success.main',
                                  backgroundColor: box.isHighlighted ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                                  transition: 'all 0.2s',
                                  pointerEvents: 'none'
                                }}
                              />
                            ))}
                          </>
                        ) : (
                          <Box
                            sx={{
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'grey.100'
                            }}
                          >
                            <DescriptionIcon sx={{ fontSize: 40 }} />
                          </Box>
                        )}
                        <IconButton
                          sx={{
                            position: 'absolute',
                            top: 5,
                            right: 5,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            },
                          }}
                          size="small"
                          onClick={() => {
                            setUploadedFiles(prev => 
                              prev.filter((_, i) => i !== index)
                            );
                            setOcrBoxes([]);
                            setOcrResults([]);
                          }}
                        >
                          <DeleteIcon sx={{ color: 'white' }} />
                        </IconButton>
                      </ImageListItem>
                    ))}
                  </ImageList>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                사용 파츠
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>품목</TableCell>
                      <TableCell align="right">가격</TableCell>
                      <TableCell align="right">작업</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedService?.parts?.map((part, index) => (
                      <TableRow key={index}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell align="right">
                          {part.price?.toLocaleString()}원
                        </TableCell>
                        <TableCell align="right">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setSelectedService({
                                ...selectedService,
                                parts: selectedService.parts.filter(p => p.id !== part.id)
                              });
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>총합</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {calculatePartsTotal(selectedService?.parts).toLocaleString()}원
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12}>
              <Alert 
                severity="success" 
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={handleApplyOcrResults}
                  >
                    파츠에 추가
                  </Button>
                }
                sx={{ mb: 2 }}
              >
                영수증에서 다음 항목들이 인식되었습니다.
              </Alert>
              
              <List>
                {ocrResults.map((item) => (
                  <ListItem 
                    key={item.id} 
                    dense
                    onMouseEnter={() => handleOcrItemHover(item.id, true)}
                    onMouseLeave={() => handleOcrItemHover(item.id, false)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <Checkbox
                      edge="start"
                      checked={selectedOcrItems[item.id] || false}
                      onChange={() => handleOcrItemSelect(item.id)}
                    />
                    <ListItemText
                      primary={item.name}
                      secondary={`${item.price.toLocaleString()}원`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button onClick={handleSave} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            정말로 이 A/S 기록을 삭제하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error">삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 상세 정보 다이얼로그 */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">A/S 상세 정보</Typography>
            <IconButton onClick={() => setDetailDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedService && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">고객 정보</Typography>
                <Typography variant="body1">{selectedService.customer_name}</Typography>
                <Typography variant="body2" color="textSecondary">{selectedService.customer_phone}</Typography>
                <Typography variant="body2" color="textSecondary">{selectedService.customer_address}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">제품 정보</Typography>
                <Typography variant="body1">{selectedService.product_name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  주행거리: {selectedService.mileage || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">문의내역</Typography>
                <Typography variant="body1">{selectedService.symptom}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">처리내역</Typography>
                <Typography variant="body1">{selectedService.solution || '-'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">태그</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                  {selectedService.tags?.map((tag, index) => (
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
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>닫기</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setDetailDialogOpen(false);
              handleEdit(selectedService.id);
            }}
          >
            수정하기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 로딩 인디케이터 추가 */}
      {uploadLoading && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 9999 
        }}>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );
}

export default ServiceList; 