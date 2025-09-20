import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Skeleton,
  Container,
  Backdrop,
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
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { serviceApi } from '../../api/services';
import { supabase } from '../../lib/supabaseClient';
import ResponsiveTable from '../common/ResponsiveTable';
import AddService from './AddService';
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';
import { formatKoreanDateTime } from '../../utils/dateUtils';
import { sendTelegramNotification } from '../../lib/telegram'; // 텔레그램 유틸리티 함수 import

// KST 변환 함수 추가
// function toKST(dateString) { ... } // 삭제

// 개발 모드 전용 디버그 로그
const ENABLE_DEBUG_LOGS = false;
const debugLog = (...args) => {
  if (process.env.NODE_ENV === 'development' && ENABLE_DEBUG_LOGS) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

function formatDateYYMMDD(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const ymd = date.toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\. /g, '-').replace(/\.$/, '');
  const weekday = date.toLocaleDateString('ko-KR', { weekday: 'short' });
  return `${ymd} ${weekday}`;
}

function formatTimeHHMM(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  let hour = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  const isAM = hour < 12;
  const ampm = isAM ? '오전' : '오후';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${ampm} ${String(hour).padStart(2, '0')}:${min}`;
}

// 날짜만 추출하는 함수 추가
function extractDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function ServiceList() {
  const validateBrand = (value) => (value === 'XRB' || value === 'NB' ? value : 'XRB');
  const [selectedBrand, setSelectedBrand] = useState(() => {
    // URL 파라미터나 로컬스토리지에서 브랜드 정보를 가져오려고 시도
    const savedBrand = localStorage.getItem('selectedBrand');
    return validateBrand(savedBrand || 'XRB');
  });
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
    setHighlightedId(id);
    setCookie('highlightServiceId', String(id));
    // 로컬스토리지에도 저장
    localStorage.setItem('highlightServiceId', String(id));

    // 이전 타이머가 있다면 제거
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    // 새로운 타이머 설정 (시간을 30초로 늘림)
    highlightTimerRef.current = setTimeout(() => {
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
      
      if (savedId) {
        const numericId = parseInt(savedId, 10);
        const serviceExists = services.some(service => service.id === numericId);
        
        if (serviceExists) {
          setHighlightWithTimeout(numericId);
        } else {
          removeCookie('highlightServiceId');
          localStorage.removeItem('highlightServiceId');
          setHighlightedId(null);
        }
      }
    }
  }, [loading, services]);

  // 하이라이트 ID가 변경될 때마다 콘솔에 출력
  useEffect(() => {
    debugLog('Current highlightedId (state):', highlightedId);
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
    console.log('selectedBrand changed to:', selectedBrand);
    fetchServices();
  }, [selectedBrand]);

  // 첫 페이지만 빠르게 로딩하는 함수
  const fetchFirstPage = async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setNetworkError(false);
      setFirstPageLoaded(false);
      setLoadedChunks(0);
      setHasMoreData(true);
      
      if (retryAttempt === 0) {
        setServices([]); // 첫 번째 시도에서만 초기화
      }
      
      console.log('fetchFirstPage called with selectedBrand:', selectedBrand, 'retry:', retryAttempt);
      
      // 첫 페이지 크기 (빠른 로딩을 위해 작게)
      const FIRST_PAGE_SIZE = 50;
      
      // 총 데이터 개수와 첫 페이지 데이터를 동시에 가져오기
      const [countResult, firstPageResult] = await Promise.all([
        supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
          .eq('brand', selectedBrand),
        supabase
          .from('services')
          .select(`
            *,
            service_tags (
              tag_name
            ),
            service_parts (
              price,
              quantity,
              parts (
                name
              )
            )
          `)
          .eq('brand', selectedBrand)
          .order('reception_date', { ascending: false })
          .range(0, FIRST_PAGE_SIZE - 1)
      ]);
      
      if (countResult.error) {
        console.error('Error counting services:', countResult.error);
        throw countResult.error;
      }
      
      if (firstPageResult.error) {
        console.error('Error fetching first page:', firstPageResult.error);
        throw firstPageResult.error;
      }
      
      const totalCount = countResult.count;
      const firstPageData = firstPageResult.data;
      
      setTotalExpected(totalCount);
      console.log(`Total services: ${totalCount}, First page loaded: ${firstPageData?.length || 0}`);
      
      if (firstPageData && firstPageData.length > 0) {
        // 첫 페이지 데이터 처리 및 즉시 표시
        const processedServices = firstPageData.map(service => ({
          ...service,
          status: service.status || '접수',
          tags: service.service_tags?.map(tag => tag.tag_name) || [],
          parts: service.service_parts?.map(part => ({
            name: part.parts?.name || '',
            price: part.price,
            quantity: part.quantity
          })) || []
        }));
        
        setServices(processedServices);
        setFirstPageLoaded(true);
        setLoading(false); // 첫 페이지 로딩 완료
        setLoadedChunks(1); // 첫 번째 청크 로드 완료
        
        // 하이라이트 ID 체크 (첫 페이지에서)
        const savedIdFromCookie = getCookie('highlightServiceId');
        const savedIdFromStorage = localStorage.getItem('highlightServiceId');
        const savedId = savedIdFromCookie || savedIdFromStorage;
        
        if (savedId) {
          const numericId = parseInt(savedId, 10);
          const serviceExists = processedServices.some(service => service.id === numericId);
          
          if (serviceExists) {
            setHighlightWithTimeout(numericId);
          }
        }
        
        // 백그라운드에서 한 청크(100건)만 더 로딩
        if (totalCount > FIRST_PAGE_SIZE) {
          setTimeout(() => {
            fetchNextChunk(FIRST_PAGE_SIZE);
          }, 200); // 200ms 후 백그라운드 로딩 시작
        } else {
          setHasMoreData(false);
        }
      } else {
        setFirstPageLoaded(true);
        setLoading(false);
        setHasMoreData(false);
      }
      
      // 재시도 카운트 초기화
      setRetryCount(0);
      
    } catch (err) {
      console.error('Error fetching first page:', err);
      setNetworkError(true);
      
      // 네트워크 오류 시 재시도 로직
      if (retryAttempt < 3) {
        const nextRetry = retryAttempt + 1;
        setRetryCount(nextRetry);
        console.log(`Retrying fetchFirstPage... attempt ${nextRetry}`);
        
        // 지수 백오프로 재시도 간격 증가
        const retryDelay = Math.pow(2, retryAttempt) * 1000;
        setTimeout(() => {
          fetchFirstPage(nextRetry);
        }, retryDelay);
      } else {
        setError(`네트워크 오류로 데이터를 불러올 수 없습니다: ${err.message}`);
        setLoading(false);
      }
    }
  };

  // 다음 청크(100건) 로딩하는 함수
  const fetchNextChunk = async (startOffset) => {
    try {
      setIsLoadingNextChunk(true);
      
      const CHUNK_SIZE = 100;
      const endOffset = startOffset + CHUNK_SIZE - 1;
      
      console.log(`Loading next chunk: ${startOffset}-${endOffset}`);
      
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          service_tags (
            tag_name
          ),
          service_parts (
            price,
            quantity,
            parts (
              name
            )
          )
        `)
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false })
        .range(startOffset, endOffset);

        if (servicesError) {
        console.error('Error fetching next chunk:', servicesError);
        return;
        }
        
        if (!servicesData || servicesData.length === 0) {
        setHasMoreData(false);
        return;
      }
      
      // 데이터 처리 및 기존 데이터에 추가
      const processedServices = servicesData.map(service => ({
        ...service,
        status: service.status || '접수',
        tags: service.service_tags?.map(tag => tag.tag_name) || [],
        parts: service.service_parts?.map(part => ({
          name: part.parts?.name || '',
          price: part.price,
          quantity: part.quantity
        })) || []
      }));
      
      // 기존 데이터에 추가
      setServices(prev => [...prev, ...processedServices]);
      setLoadedChunks(prev => prev + 1);
      
      // 로드된 데이터가 청크 크기보다 작으면 더 이상 데이터 없음
      if (servicesData.length < CHUNK_SIZE) {
        setHasMoreData(false);
      }
      
      console.log(`Chunk loaded: ${servicesData.length} items. Total chunks: ${loadedChunks + 1}`);
      
    } catch (err) {
      console.error('Error loading next chunk:', err);
    } finally {
      setIsLoadingNextChunk(false);
    }
  };

  // 페이지 변경 시 필요하면 새 청크 로딩
  const handlePageChangeWithLoading = (event, newPage) => {
    // 표시할 데이터가 없으면 페이지 변경하지 않음
    if (filteredServices.length === 0) {
      console.log('No data to display, staying on current page');
      return;
    }
    
    // 현재 페이지에 표시할 데이터가 있는지 확인
    const maxPage = Math.max(0, Math.ceil(filteredServices.length / rowsPerPage) - 1);
    const validPage = Math.min(newPage, maxPage);
    
    setPage(validPage);
    
    // 3페이지마다 새 청크 로딩 체크
    const itemsNeeded = (validPage + 1) * rowsPerPage;
    const currentItemsLoaded = services.length;
    
    // 현재 로드된 데이터로 충분하지 않고, 더 로드할 데이터가 있으며, 현재 로딩 중이 아닐 때
    if (itemsNeeded > currentItemsLoaded && hasMoreData && !isLoadingNextChunk && !hasActiveSearch) {
      console.log(`Need ${itemsNeeded} items, have ${currentItemsLoaded}. Loading next chunk...`);
      fetchNextChunk(currentItemsLoaded);
    }
  };

  // 서버 사이드 검색 함수
  const performServerSearch = async (searchParams = {}) => {
    try {
      setSearchLoading(true);
      setServices([]); // 검색 시 기존 데이터 초기화
      setFirstPageLoaded(false);
      setBackgroundLoading(false);
      
      console.log('Performing server search with params:', searchParams);
      
      // 검색 쿼리 구성
      let query = supabase
        .from('services')
        .select(`
          *,
          service_tags (
            tag_name
          ),
          service_parts (
            price,
            quantity,
            parts (
              name
            )
          )
        `)
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false });
      
      // 검색어 필터링 (최소 2글자 이상일 때만)
      if (searchParams.searchTerm && searchParams.searchTerm.length >= 2) {
        console.log('Applying search filter for term:', searchParams.searchTerm);
        // 기본 필드 검색 (고객명, 연락처, 제품명, 증상)
        const basicSearch = `customer_name.ilike.%${searchParams.searchTerm}%,customer_phone.ilike.%${searchParams.searchTerm}%,product_name.ilike.%${searchParams.searchTerm}%,symptom.ilike.%${searchParams.searchTerm}%`;
        
        // A/S ID 검색 - 숫자인지 확인
        const isNumeric = /^\d+$/.test(searchParams.searchTerm);
        
        if (isNumeric) {
          // 숫자인 경우: 정확한 일치로 검색
          query = query.or(`${basicSearch},id.eq.${searchParams.searchTerm}`);
        } else {
          // 문자열인 경우: 기본 검색만 (UUID 검색은 복잡하므로 제외)
          query = query.or(basicSearch);
        }
      } else if (searchParams.searchTerm && searchParams.searchTerm.length < 2) {
        console.log('Search term too short, ignoring:', searchParams.searchTerm);
        // 검색어가 너무 짧으면 검색하지 않고 전체 데이터 로딩으로 변경
        setSearchLoading(false);
        setFirstPageLoaded(true);
        setHasActiveSearch(false);
        fetchServices();
        return;
      }
      
      // 상태 필터링
      if (searchParams.selectedStatuses && searchParams.selectedStatuses.length > 0) {
        query = query.in('status', searchParams.selectedStatuses);
      }
      
      // 날짜 필터링
      if (searchParams.dateFilter && (searchParams.dateFilter.startDate || searchParams.dateFilter.endDate)) {
        const dateField = searchParams.dateFilter.type || 'reception_date';
        if (searchParams.dateFilter.startDate) {
          query = query.gte(dateField, `${searchParams.dateFilter.startDate}T00:00:00.000Z`);
        }
        if (searchParams.dateFilter.endDate) {
          query = query.lte(dateField, `${searchParams.dateFilter.endDate}T23:59:59.999Z`);
        }
      }
      
      // 첫 페이지만 먼저 가져오기 (검색 결과)
      const FIRST_PAGE_SIZE = 50;
      const firstPageQuery = query.range(0, FIRST_PAGE_SIZE - 1);
      
      // 카운트용 쿼리 (별도로 생성)
      let countQuery = supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('brand', selectedBrand);

      // 카운트 쿼리에도 필터 적용
      if (searchParams.searchTerm && searchParams.searchTerm.length >= 2) {
        const basicSearch = `customer_name.ilike.%${searchParams.searchTerm}%,customer_phone.ilike.%${searchParams.searchTerm}%,product_name.ilike.%${searchParams.searchTerm}%,symptom.ilike.%${searchParams.searchTerm}%`;
        const isNumeric = /^\d+$/.test(searchParams.searchTerm);
        
        if (isNumeric) {
          // 숫자인 경우: 정확한 일치로 검색
          countQuery = countQuery.or(`${basicSearch},id.eq.${searchParams.searchTerm}`);
        } else {
          // 문자열인 경우: 기본 검색만
          countQuery = countQuery.or(basicSearch);
        }
      }

      if (searchParams.selectedStatuses && searchParams.selectedStatuses.length > 0) {
        if (searchParams.selectedStatuses.length === 1) {
          countQuery = countQuery.eq('status', searchParams.selectedStatuses[0]);
        } else {
          countQuery = countQuery.in('status', searchParams.selectedStatuses);
        }
      }

      if (searchParams.selectedTags && searchParams.selectedTags.length > 0) {
        countQuery = countQuery.overlaps('tag_names', searchParams.selectedTags);
      }

      if (searchParams.dateFilter) {
        const { startDate, endDate, dateType } = searchParams.dateFilter;
        if (startDate && endDate) {
          const dateField = dateType === 'receipt_date' ? 'receipt_date' : 'request_date';
          countQuery = countQuery
            .gte(dateField, startDate)
            .lte(dateField, endDate);
        }
      }

      // 총 검색 결과 수와 첫 페이지를 동시에 가져오기
      const [countResult, firstPageResult] = await Promise.all([
        countQuery,
        firstPageQuery
      ]);
      
      if (countResult.error) {
        console.error('Error counting search results:', countResult.error);
        throw countResult.error;
      }
      
      if (firstPageResult.error) {
        console.error('Error fetching search results:', firstPageResult.error);
        throw firstPageResult.error;
      }
      
      const totalCount = countResult.count;
      const firstPageData = firstPageResult.data;
      
      setTotalExpected(totalCount);
      console.log(`Search results: ${totalCount} total, ${firstPageData?.length || 0} loaded`);
      
      if (firstPageData && firstPageData.length > 0) {
        // 검색 결과 처리 및 표시
        const processedServices = firstPageData.map(service => ({
            ...service,
            status: service.status || '접수',
            tags: service.service_tags?.map(tag => tag.tag_name) || [],
            parts: service.service_parts?.map(part => ({
              name: part.parts?.name || '',
            price: part.price,
            quantity: part.quantity
            })) || []
          }));
          
        setServices(processedServices);
        setFirstPageLoaded(true);
        
        // 검색 결과가 첫 페이지보다 많으면 나머지도 백그라운드에서 로딩
        if (totalCount > FIRST_PAGE_SIZE) {
          setTimeout(() => {
            fetchRemainingSearchResults(query, FIRST_PAGE_SIZE, totalCount);
          }, 300); // 검색 후 조금 더 기다렸다가 백그라운드 로딩
        }
      } else {
        setFirstPageLoaded(true);
      }
      
      setHasActiveSearch(true);
      
    } catch (err) {
      console.error('Error in server search:', err);
      setError(`검색 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // 검색 결과의 나머지 데이터를 백그라운드에서 로딩
  const fetchRemainingSearchResults = async (baseQuery, startOffset, totalCount) => {
    try {
      setBackgroundLoading(true);
      setLoadProgress(0);
      
      const PAGE_SIZE = 200;
      let currentOffset = startOffset;
      
      console.log(`Loading remaining search results from offset ${startOffset}`);
      
      while (currentOffset < totalCount) {
        try {
          const progress = Math.min((currentOffset / totalCount) * 100, 95);
          setLoadProgress(progress);
          
          const { data: servicesData, error: servicesError } = await baseQuery
            .range(currentOffset, currentOffset + PAGE_SIZE - 1);
            
          if (servicesError) {
            console.error('Error fetching remaining search results:', servicesError);
            break;
          }
          
          if (!servicesData || servicesData.length === 0) {
            break;
          }
          
          const processedServices = servicesData.map(service => ({
        ...service,
        status: service.status || '접수',
        tags: service.service_tags?.map(tag => tag.tag_name) || [],
        parts: service.service_parts?.map(part => ({
          name: part.parts?.name || '',
              price: part.price,
              quantity: part.quantity
        })) || []
      }));

          setServices(prev => [...prev, ...processedServices]);
          
          currentOffset += servicesData.length;
          
          if (servicesData.length < PAGE_SIZE) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (pageError) {
          console.error(`Error loading search page:`, pageError);
          currentOffset += PAGE_SIZE;
        }
      }
      
      setLoadProgress(100);
      console.log(`Search background loading completed.`);
      
    } catch (err) {
      console.error('Error in search background loading:', err);
    } finally {
      setBackgroundLoading(false);
      setLoadProgress(0);
    }
  };

  // 메인 fetchServices 함수 (첫 페이지 우선 로딩)
  const fetchServices = (retryAttempt = 0) => {
    setHasActiveSearch(false);
    fetchFirstPage(retryAttempt);
  };

  // 실시간 업데이트 구독
  useEffect(() => {
    const channel = supabase
      .channel('services-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'services' }, 
        payload => {
          debugLog('Received real-time update:', payload);
          if (payload.eventType === 'INSERT' && payload.new.brand === selectedBrand) {
            const newServiceId = payload.new.id;
            debugLog('New service added, ID:', newServiceId);
            
            // 새로운 서비스 추가 및 하이라이트 설정
            setServices(prev => [{
              ...payload.new,
              tags: []
            }, ...prev]);
            
            // 하이라이트 ID 설정
            setHighlightWithTimeout(newServiceId);
            debugLog('Highlight set for service:', newServiceId);
            
            // 30초 후 하이라이트 제거
            setTimeout(() => {
              debugLog('Removing highlight for service:', newServiceId);
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

  // 클라이언트 필터링 제거 - 서버 사이드 검색으로 대체됨
  // 이제 services가 이미 서버에서 필터링된 데이터임

  // 데이터 로딩 상태 확인을 위한 useEffect
  useEffect(() => {
    debugLog('Current services state:', services);
    debugLog('Current loading state:', loading);
    debugLog('Current error state:', error);
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
      debugLog('Setting highlightServiceId before navigation:', serviceId);
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
    console.log('handleBrandChange called with newValue:', newValue);
    if (!newValue) return;
    const validatedBrand = validateBrand(newValue);
    console.log('validatedBrand:', validatedBrand);
    setSelectedBrand(validatedBrand);
    // 브랜드 변경 시 로컬스토리지에 저장
    localStorage.setItem('selectedBrand', validatedBrand);
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
        const jsonData = await readExcelFile(file);

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

        // 텔레그램 알림 전송
        if (insertedData && insertedData.length > 0) {
          for (const service of insertedData) {
            try {
              await sendTelegramNotification({
                message: `A/S 등록 (접수번호: ${service.id}) - 고객: ${service.customer_name || '정보없음'}, 연락처: ${service.customer_phone || '정보없음'}`,
                link: `/service/${service.id}`
              });
            } catch (telegramError) {
              console.error('엑셀 업로드 A/S 텔레그램 알림 전송 중 오류:', telegramError);
            }
          }
        }
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
      debugLog('Setting highlightServiceId before navigation:', service.id);
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
      if (orderBy === 'customer_name') {
        // 고객명으로 정렬
        comparison = a.customer_name.localeCompare(b.customer_name);
      } else if (orderBy === 'customer_phone') {
        // 연락처로 정렬
        comparison = a.customer_phone.localeCompare(b.customer_phone);
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

  // 페이지 변경 핸들러 (기존 함수는 handlePageChangeWithLoading으로 대체됨)

  // 페이지당 행 수 변경 핸들러
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };


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
      id: 'customer_name', 
      label: '이름',
      sortable: true,
      render: (row) => (
        <Typography noWrap sx={{ 
          fontSize: '0.95rem', 
          fontWeight: 700,
          letterSpacing: '0.01em' 
        }}>
          {row.customer_name}
        </Typography>
      )
    },
    { 
      id: 'customer_phone', 
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
                      {sp.parts?.name || '-'} : {sp.price?.toLocaleString() || 0}원 × {sp.quantity ?? 1}
                    </Typography>
                  ))}
                  <Typography variant="body2" sx={{ fontWeight: 900, color: '#fff', mt: 1 }}>
                    합계: {row.service_parts.reduce((sum, sp) => {
                      const partTotal = (sp.price || 0) * (sp.quantity ?? 1);
                      return sum + partTotal;
                    }, 0).toLocaleString()}원
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
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}
            >
              {formatDateYYMMDD(row.completion_date)}
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
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatDateYYMMDD(row.completion_date)}
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

      // 헤더 정의
      const headers = [
        { label: '접수일자', key: '접수일자' },
        { label: '접수방법', key: '접수방법' },
        { label: '입고일', key: '입고일' },
        { label: '출고일', key: '출고일' },
        { label: '배송방법', key: '배송방법' },
        { label: '고객명', key: '고객명' },
        { label: '연락처', key: '연락처' },
        { label: '주소', key: '주소' },
        { label: '제품', key: '제품' },
        { label: '주행거리', key: '주행거리' },
        { label: '증상', key: '증상' },
        { label: '처리내역', key: '처리내역' },
        { label: '상태', key: '상태' },
        { label: '메모', key: '메모' },
        { label: 'JPG', key: 'JPG' },
        { label: '구매처', key: '구매처' },
        { label: '작성자', key: '작성자' }
      ];

      // 파일 다운로드 (브랜드명 포함)
      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      downloadExcel(exportData, headers, `AS목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

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

  // 검색 실행 함수 (서버 사이드 검색)
  const executeSearch = () => {
    const term = inputValue.toLowerCase().trim();
    setSearchTerm(term);
    
    // 검색어 로컬스토리지에 저장
    if (term) {
      localStorage.setItem('serviceSearchTerm', term);
    } else {
      localStorage.removeItem('serviceSearchTerm');
    }
    
    // 검색어가 1글자면 경고 메시지 표시하고 검색하지 않음
    if (term && term.length === 1) {
      setSnackbar({
        open: true,
        message: '검색어는 최소 2글자 이상 입력해주세요.',
        severity: 'warning'
      });
      return;
    }

    // 검색어가 없거나 다른 필터도 없으면 전체 데이터 로딩으로 돌아가기
    if (!term && selectedStatuses.length === 0 && selectedTags.length === 0 && !dateFilter.startDate && !dateFilter.endDate) {
      fetchServices();
      return;
    }
    
    // 서버 사이드 검색 실행
    const searchParams = {
      searchTerm: term,
      selectedStatuses: selectedStatuses.length > 0 ? selectedStatuses : null,
      selectedTags: selectedTags.length > 0 ? selectedTags : null,
      dateFilter: (dateFilter.startDate || dateFilter.endDate) ? dateFilter : null,
      searchMode
    };
    
    performServerSearch(searchParams);
  };

  //1. 초기화 함수 추가
  const handleClearSearch = () => {
    setInputValue('');
    setSearchTerm('');
    localStorage.removeItem('serviceSearchTerm');
    debugLog('Search cleared');
    
    // 검색 초기화 시 전체 데이터 다시 로딩
    if (hasActiveSearch) {
      fetchServices();
    }
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
    
    // 다중 상태, 태그, 검색 모드 초기화
    setSelectedStatuses([]);
    setSelectedTags([]);
    setSearchMode('AND');

    // 필터 저장값 삭제
    localStorage.removeItem(FILTER_KEY);
    
    // 페이지 초기화
    setPage(0);
    
    // 전체 데이터 다시 로딩
    fetchServices();
    
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
      selectedStatuses,
      selectedTags,
      searchMode
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
      setSelectedBrand(validateBrand(filterState.selectedBrand || 'XRB'));
      setStatusFilter(filterState.statusFilter || 'all');
      setDateFilter(filterState.dateFilter || { type: 'reception_date', startDate: '', endDate: '' });
      setInputValue(filterState.inputValue || '');
      setSearchTerm(filterState.searchTerm || '');
      setSelectedStatuses(filterState.selectedStatuses || []);
      setSelectedTags(filterState.selectedTags || []);
      setSearchMode(filterState.searchMode || 'AND');
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

  // 브랜드 값 정규화 가드: 유효하지 않은 값이면 기본값으로 복원
  useEffect(() => {
    if (selectedBrand !== 'XRB' && selectedBrand !== 'NB') {
      setSelectedBrand('XRB');
    }
  }, [selectedBrand]);

  const [searchMode, setSearchMode] = useState('AND'); // AND/OR 검색 모드
  const [selectedStatuses, setSelectedStatuses] = useState([]); // 다중 상태
  const [selectedTags, setSelectedTags] = useState([]); // 다중 태그
  const [progressiveLoading, setProgressiveLoading] = useState(false); // 점진적 로딩 상태
  const [loadProgress, setLoadProgress] = useState(0); // 로딩 진행률
  const [retryCount, setRetryCount] = useState(0); // 재시도 횟수
  const [networkError, setNetworkError] = useState(false); // 네트워크 오류 상태
  const [isOnline, setIsOnline] = useState(navigator.onLine); // 온라인 상태
  const [backgroundLoading, setBackgroundLoading] = useState(false); // 백그라운드 로딩 상태
  const [firstPageLoaded, setFirstPageLoaded] = useState(false); // 첫 페이지 로딩 완료 상태
  const [totalExpected, setTotalExpected] = useState(0); // 전체 예상 데이터 수
  const [searchLoading, setSearchLoading] = useState(false); // 검색 로딩 상태
  const [hasActiveSearch, setHasActiveSearch] = useState(false); // 활성 검색 여부
  const [loadedChunks, setLoadedChunks] = useState(0); // 로드된 청크 수
  const [isLoadingNextChunk, setIsLoadingNextChunk] = useState(false); // 다음 청크 로딩 상태
  const [hasMoreData, setHasMoreData] = useState(true); // 더 로드할 데이터가 있는지
  
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

  // 서버 사이드 검색으로 클라이언트 필터링 제거
  // filteredServices는 항상 services와 동일 (서버에서 이미 필터링됨)
  useEffect(() => {
    setFilteredServices(services);
  }, [services]);

  // 검색이나 필터 변경 시에만 페이지 초기화
  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedStatuses, selectedTags, dateFilter, hasActiveSearch]);

  // 페이지네이션된 서비스 데이터 계산
  const paginatedServices = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredServices.slice(startIndex, endIndex);
  }, [filteredServices, page, rowsPerPage]);

  // 네트워크 상태 감지
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkError(false);
      // 온라인 복구 시 자동으로 데이터 다시 로드
      if (services.length === 0) {
        fetchFirstPage();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkError(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [services.length]);

  // 컴포넌트 마운트 시 자동으로 필터 불러오기
  useEffect(() => {
    loadFilterState();
    // eslint-disable-next-line
  }, []);

  // 필터 상태가 바뀔 때마다 자동 저장
  useEffect(() => {
    saveFilterState();
    // eslint-disable-next-line
  }, [selectedBrand, statusFilter, dateFilter, inputValue, searchTerm, selectedStatuses, selectedTags, searchMode]);

  // 스켈레톤 로딩 컴포넌트
  const renderSkeletonTable = () => (
    <Box sx={{ maxWidth: '1800px', width: 'auto', mx: 'auto' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Skeleton variant="rectangular" width={120} height={48} />
            <Skeleton variant="rectangular" width={120} height={48} />
          </Box>
          <Stack direction="row" spacing={2}>
            <Skeleton variant="rectangular" width={100} height={36} />
            <Skeleton variant="rectangular" width={100} height={36} />
            <Skeleton variant="rectangular" width={120} height={36} />
          </Stack>
        </Stack>
      </Box>
      
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Skeleton variant="rectangular" width={300} height={40} />
          <Skeleton variant="rectangular" width={80} height={40} />
          <Skeleton variant="rectangular" width={120} height={40} />
          <Skeleton variant="rectangular" width={120} height={40} />
          <Skeleton variant="rectangular" width={100} height={40} />
          <Skeleton variant="rectangular" width={100} height={40} />
        </Stack>
      </Box>
      
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column, index) => (
                <TableCell key={index}>
                  <Skeleton variant="text" width="80%" height={20} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                {columns.map((column, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton 
                      variant={colIndex === 0 ? "circular" : "text"} 
                      width={colIndex === 0 ? 24 : "90%"} 
                      height={colIndex === 0 ? 24 : 20}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Skeleton variant="rectangular" width={400} height={52} />
      </Box>
    </Box>
  );

  // 첫 페이지 로딩 중이거나 검색 중이면 스켈레톤 표시
  if ((loading && !firstPageLoaded) || searchLoading) {
    return (
      <>
        {renderSkeletonTable()}
        <Backdrop
          sx={{ 
            color: '#fff', 
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)'
          }}
          open={loading}
        >
          <Box sx={{ textAlign: 'center', maxWidth: 400, px: 3 }}>
            <CircularProgress color="inherit" size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              {searchLoading ? 'A/S 데이터를 검색하는 중...' : 'A/S 데이터를 불러오는 중...'}
            </Typography>
            
            {progressiveLoading && loadProgress > 0 && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={loadProgress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#4fc3f7'
                    }
                  }}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {Math.round(loadProgress)}% 완료
                </Typography>
      </Box>
            )}
            
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
              {services.length > 0 ? `${services.length}건 로드됨` : '잠시만 기다려주세요'}
            </Typography>
            
            {retryCount > 0 && (
              <Typography variant="body2" sx={{ mt: 1, color: '#ffb74d' }}>
                재시도 중... ({retryCount}/3)
              </Typography>
            )}
            
            {networkError && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#f44336', mb: 1 }}>
                  네트워크 연결이 불안정합니다
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => fetchServices()}
                  sx={{
                    color: '#fff',
                    borderColor: '#fff',
                    '&:hover': {
                      borderColor: '#fff',
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  다시 시도
                </Button>
              </Box>
            )}
          </Box>
        </Backdrop>
      </>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => {
              setError(null);
              fetchServices();
            }}>
              다시 시도
            </Button>
          }
        >
          <Typography variant="h6" gutterBottom>
            데이터를 불러올 수 없습니다
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            문제가 지속되면 다음을 확인해보세요:
          </Typography>
          <Box component="ul" sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
            <li>인터넷 연결 상태</li>
            <li>브라우저 새로고침 (Ctrl+F5)</li>
            <li>잠시 후 다시 시도</li>
      </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: '1800px', 
      width: 'auto', 
      mx: 'auto'
    }}>
      {/* 오프라인 상태 알림 */}
      {!isOnline && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => window.location.reload()}
            >
              새로고침
            </Button>
          }
        >
          <Typography variant="body2">
            오프라인 상태입니다. 일부 기능이 제한될 수 있습니다.
          </Typography>
        </Alert>
      )}
      
      {/* 백그라운드 로딩 상태 표시 */}
      {(backgroundLoading || isLoadingNextChunk) && firstPageLoaded && (
        <Box sx={{ 
          position: 'fixed', 
          bottom: 20, 
          right: 20, 
          zIndex: 1000,
          minWidth: 280
        }}>
          <Alert 
            severity="info" 
            variant="filled"
            sx={{ 
              boxShadow: 3,
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} color="inherit" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {isLoadingNextChunk ? '다음 페이지 로딩 중...' : '추가 데이터 로딩 중...'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {services.length}/{hasActiveSearch ? services.length : totalExpected}건 
                  {loadProgress > 0 && ` (${Math.round(loadProgress)}%)`}
                  {isLoadingNextChunk && ` • 청크 ${loadedChunks + 1} 로딩`}
                </Typography>
              </Box>
            </Box>
            {loadProgress > 0 && (
              <LinearProgress 
                variant="determinate" 
                value={loadProgress}
                sx={{
                  mt: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: 'rgba(255,255,255,0.8)'
                  }
                }}
              />
            )}
          </Alert>
        </Box>
      )}
      
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
            placeholder="고객명, 연락처, 제품명, A/S ID로 검색"
            value={inputValue}
            onChange={handleSearchInput}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const term = inputValue.toLowerCase().trim();
                if (term && term.length === 1) {
                  setSnackbar({
                    open: true,
                    message: '검색어는 최소 2글자 이상 입력해주세요.',
                    severity: 'warning'
                  });
                  return;
                }
                executeSearch();
              }
            }}
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
            InputProps={{
              endAdornment: dateFilter.startDate ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label="시작일 초기화"
                    onClick={() => setDateFilter(prev => ({ ...prev, startDate: '' }))}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
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
            InputProps={{
              endAdornment: dateFilter.endDate ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label="종료일 초기화"
                    onClick={() => setDateFilter(prev => ({ ...prev, endDate: '' }))}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
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
              disabled={searchLoading}
              sx={{ minWidth: 70, height: 40 }}
              startIcon={searchLoading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {searchLoading ? '검색 중' : '검색'}
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
        count={hasActiveSearch ? filteredServices.length : Math.max(filteredServices.length, totalExpected)}
        page={page}
        onPageChange={handlePageChangeWithLoading}
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