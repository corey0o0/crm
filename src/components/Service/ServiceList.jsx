import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { useNavigate, useLocation } from 'react-router-dom';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { serviceApi } from '../../api/services';
import { supabase, ensureConnection } from '../../lib/supabaseClient';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { fetchServices as fetchServicesAPI, countServices, countServiceStatusByBrand } from '../../utils/restApiUtils';
import ResponsiveTable from '../common/ResponsiveTable';
import AddService from './AddService';
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';
import { formatKoreanDateTime } from '../../utils/dateUtils';
import { format } from 'date-fns';
import { sendTelegramNotification } from '../../lib/telegram'; // 텔레그램 유틸리티 함수 import
import { processServiceCompletion, processServiceRevert, normalizeServiceStatus } from '../../utils/inventoryUtils';

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
  const location = useLocation();
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
  
  // 초기 로딩 방지를 위한 ref
  const isInitialMountRef = useRef(true);
  const isFilterRestoringRef = useRef(false);
  // 디바운스 타이머 ref
  const debounceTimerRef = useRef(null);
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
  
  // 브랜드별 접수/처리중 건수
  const [brandCounts, setBrandCounts] = useState({
    XRB: { reception: 0, processing: 0 },
    NB: { reception: 0, processing: 0 }
  });

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



  // 무한 로딩 방지를 위한 감시 타이머
  const loadingWatchdogRef = useRef(null);

  useEffect(() => {
    console.log('selectedBrand changed to:', selectedBrand);
    // 초기 데이터 로딩 활성화 (검색은 비활성화)
    fetchServices();
    console.log('[ServiceList] 브랜드 변경 감지 - 초기 데이터 로딩 활성화');
  }, [selectedBrand]);

  // 라우트 재진입(키 변경), 포커스/가시성 복귀 시 재호출 비활성화
  useEffect(() => {
    console.log('[ServiceList] 포커스/가시성 변경 감지 - 자동 데이터 로딩 비활성화');
    // 자동 데이터 로딩 비활성화
    return () => {
      // 이벤트 리스너 정리
    };
    // eslint-disable-next-line
  }, [location.key]);

  // 첫 페이지만 빠르게 로딩하는 함수
  const fetchFirstPage = async (retryAttempt = 0) => {
    try {
      console.log(`[ServiceList] fetchFirstPage 시작 - retryAttempt: ${retryAttempt}, selectedBrand: ${selectedBrand}`);
      
      // 유휴 후 재연결 확인
      console.log('[ServiceList] 연결 상태 확인 중...');
      const connectionOk = await ensureConnection();
      if (!connectionOk) {
        console.warn('[ServiceList] 재연결 실패 - 계속 시도');
      }
      
      // 브라우저 오프라인 오작동으로 인한 차단 해제 (우회)
      /*
      if (isOffline()) {
        console.log('[ServiceList] 오프라인 상태 - 데이터 로딩 건너뛰기');
        setError('오프라인 상태입니다. 인터넷 연결을 확인해주세요.');
        setLoading(false);
        return;
      }
      */

      // 로딩 상태 초기화
      setLoading(true);
      setNetworkError(false);
      setFirstPageLoaded(false);
      setLoadedChunks(0);
      setHasMoreData(true);
      setError(null);
      
      console.log('[ServiceList] 로딩 상태 초기화 완료');

      // 기존 감시 타이머 제거 후 새 타이머 시작 (20초로 여유 확보)
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
      }
      loadingWatchdogRef.current = setTimeout(() => {
        setError('요청이 예상보다 오래 걸립니다. 네트워크 상태를 확인한 후 다시 시도하세요.');
        setLoading(false);
      }, 20000);
      
      if (retryAttempt === 0) {
        setServices([]); // 첫 번째 시도에서만 초기화
      }
      
      console.log('[ServiceList] fetchFirstPage called with selectedBrand:', selectedBrand, 'retry:', retryAttempt);
      // 첫 페이지 크기 (빠른 로딩을 위해 작게)
      const FIRST_PAGE_SIZE = 50;
      
      // 안전한 재시도 로직 적용
      const [totalCount, firstPageData] = await safeRetry(async () => {
        // 총 데이터 개수와 첫 페이지 데이터를 동시에 가져오기 (Abort + timeout 적용)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        
        console.log('[ServiceList] Starting Promise.all for count + first page');
        const result = await Promise.all([
          countServices({
            selectedBrand,
            searchTerm: '',
            statusFilter: '',
            signal: controller.signal
          }),
          fetchServicesAPI({
            selectedBrand,
            searchTerm: '',
            statusFilter: '',
            page: 0,
            pageSize: FIRST_PAGE_SIZE,
            signal: controller.signal
          })
        ]);
        
        clearTimeout(timeoutId);
        return result;
      }, {
        maxRetries: 3,
        maxTime: 30000,
        baseDelay: 1000
      });
      
      console.log('[ServiceList] REST API results - count:', totalCount, 'first page:', firstPageData?.length);
      
      // 기존 Supabase 코드 제거됨 - REST API 사용
      
      setTotalExpected(totalCount);
      console.log(`Total services: ${totalCount}, First page loaded: ${firstPageData?.length || 0}`);
      
      if (firstPageData && firstPageData.length > 0) {
        // 첫 페이지 데이터 처리 및 즉시 표시 (REST API 버전)
        const processedServices = firstPageData.map(service => ({
          ...service,
          status: normalizeServiceStatus(service.status),
          tags: service.service_tags?.map(tag => tag.tag_name) || [],
          service_parts: service.service_parts || []
        }));
        
        setServices(processedServices);
        setFirstPageLoaded(true);
        setLoading(false); // 첫 페이지 로딩 완료
        setLoadedChunks(1); // 첫 번째 청크 로드 완료
        
        console.log('[ServiceList] 첫 페이지 로딩 완료 - 서비스 수:', processedServices.length);
        
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
        console.log('[ServiceList] 데이터가 없음 - 로딩 완료');
        setFirstPageLoaded(true);
        setLoading(false);
        setHasMoreData(false);
      }
      
      // 재시도 카운트 초기화
      setRetryCount(0);
      // 감시 타이머 해제
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
      
    } catch (err) {
      console.error('[ServiceList] Error fetching first page:', err);
      console.error('[ServiceList] Error name:', err?.name);
      console.error('[ServiceList] Error message:', err?.message);
      console.error('[ServiceList] Error details:', JSON.stringify(err, null, 2));
      
      // 로딩 상태 확실히 해제
      setLoading(false);
      setNetworkError(true);
      
      // 스마트 오류 처리
      if (shouldRetry(err, retryAttempt) && retryAttempt < 2) {
        console.log(`[ServiceList] 재시도 ${retryAttempt + 1}/2`);
        setTimeout(() => fetchFirstPage(retryAttempt + 1), 2000);
        return;
      }
      
      // 사용자 친화적 오류 메시지
      const errorMessage = getErrorMessage(err);
      setError(
        <div>
          <div style={{ marginBottom: '8px' }}>{errorMessage}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            문제가 지속되면 페이지를 새로고침해주세요.
          </div>
        </div>
      );
      
      console.log('[ServiceList] 오류로 인한 로딩 완료');
      
      // 감시 타이머 해제
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
    }
  };

  // 다음 청크(100건) 로딩하는 함수
  const fetchNextChunk = async (startOffset) => {
    try {
      setIsLoadingNextChunk(true);
      
      const CHUNK_SIZE = 100;
      // const page = Math.floor(startOffset / CHUNK_SIZE);
      // We pass offset explicitly to avoid pagination bugs.
      
      console.log(`Loading next chunk: offset ${startOffset}, size ${CHUNK_SIZE}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const servicesData = await fetchServicesAPI({
        selectedBrand,
        searchTerm: '',
        statusFilter: '',
        offset: startOffset,
        pageSize: CHUNK_SIZE,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!servicesData || servicesData.length === 0) {
        setHasMoreData(false);
        return;
      }
      
      console.log(`[ServiceList] Next chunk loaded: ${servicesData.length} items`);
      
      // 데이터 처리 (REST API는 이미 기본 형태로 반환됨)
      const processedServices = servicesData.map(service => ({
        ...service,
        status: normalizeServiceStatus(service.status),
        tags: service.service_tags?.map(tag => tag.tag_name) || [],
        service_parts: service.service_parts || [] // 사용부품 정보 포함
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
    
    // 현재 데이터 총량 혹은 필터링된 총량 기준으로 유효한 페이지만 허용
    const dataCount = hasActiveSearch ? filteredServices.length : Math.max(filteredServices.length, totalExpected);
    const maxPage = Math.max(0, Math.ceil(dataCount / rowsPerPage) - 1);
    const validPage = Math.min(newPage, maxPage);
    
    setPage(validPage);
    
    // 페이지 변경 즉시 저장
    const pageState = {
      page: validPage,
      rowsPerPage
    };
    localStorage.setItem(PAGE_KEY, JSON.stringify(pageState));
    console.log('[ServiceList] 페이지 변경 즉시 저장:', pageState);
    
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
  const performServerSearch = async (searchParams = {}, retryCount = 0) => {
    try {
      console.log(`[ServiceList] 검색 시작 (재시도: ${retryCount})`);
      
      // 유휴 후 재연결 확인
      console.log('[ServiceList] 연결 상태 확인 중...');
      const connectionOk = await ensureConnection();
      if (!connectionOk) {
        console.warn('[ServiceList] 재연결 실패 - 계속 시도');
      }
      
      setSearchLoading(true);
      setServices([]); // 검색 시 기존 데이터 초기화
      setFirstPageLoaded(false);
      setBackgroundLoading(false);
      setPage(0); // 검색 시 페이지 번호 초기화
      
      console.log('[ServiceList] 검색 파라미터:', searchParams);
      
      // 검색 쿼리 구성
      // 매우 단순한 쿼리로 변경
      let query = supabase
        .from('services')
        .select('*,service_tags(tag_name),service_parts(id,part_id,quantity,price,usage,parts(name,code))')
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false });
      
      // 태그로 매칭되는 서비스 ID 목록 (중복 제거) - 본문/카운트 모두에 재사용
      let tagMatchedServiceIds = null;
      
      // 검색어 필터링 (최소 2글자 이상일 때만)
      if (searchParams.searchTerm && searchParams.searchTerm.length >= 2) {
        console.log('Applying search filter for term:', searchParams.searchTerm);
        
        // 전화번호 검색을 위해 하이픈 제거
        const cleanSearchTerm = searchParams.searchTerm.replace(/-/g, '');
        const originalSearchTerm = searchParams.searchTerm.trim();
        
        // 고객명, 전화번호, A/S ID 검색
        const isNumeric = /^\d+$/.test(cleanSearchTerm);
        
        if (isNumeric) {
          // 숫자인 경우: A/S ID 정확 검색 또는 전화번호 부분 검색 (하이픈 포함/제거 모두 검색)
          // 전화번호는 원본 검색어와 하이픈 제거한 버전 모두 검색
          const safeOriginal = originalSearchTerm.replace(/"/g, '');
          const safeClean = cleanSearchTerm.replace(/"/g, '');
          query = query.or(`id.eq.${cleanSearchTerm},customer_phone.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeClean}%"`);
        } else {
          // 문자열인 경우: 고객명과 전화번호 검색 (하이픈 포함/제거 모두 검색)
          // 전화번호는 원본 검색어와 하이픈 제거한 버전 모두 검색
          const safeOriginal = originalSearchTerm.replace(/"/g, '');
          const safeClean = cleanSearchTerm.replace(/"/g, '');
          query = query.or(`customer_name.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeClean}%"`);
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

      // 기종 검색 필터링
      if (searchParams.modelSearchTerm && searchParams.modelSearchTerm.length >= 2) {
        console.log('Applying model search filter for term:', searchParams.modelSearchTerm);
        query = query.ilike('product_name', `%${searchParams.modelSearchTerm}%`);
      }

      // 처리내역 및 문의내용 검색 필터링
      if (searchParams.solutionSearchTerm && searchParams.solutionSearchTerm.length >= 2) {
        console.log('Applying solution & symptom search filter for term:', searchParams.solutionSearchTerm);
        const safeTerm = searchParams.solutionSearchTerm.replace(/"/g, '');
        query = query.or(`solution.ilike."%${safeTerm}%",symptom.ilike."%${safeTerm}%"`);
      }
      
      // 날짜 필터링 (상태 필터링 전에 확인하여 완료일자 검색 시 상태 필터 자동 적용)
      let dateField = 'reception_date';
      if (searchParams.dateFilter && (searchParams.dateFilter.startDate || searchParams.dateFilter.endDate)) {
        dateField = searchParams.dateFilter.type || 'reception_date';
      }
      
      // 상태 필터링
      // 완료일자로 검색할 때는 처리상태가 "완료"인 것만 필터링 (기존 상태 필터 무시)
      if (dateField === 'completion_date') {
        console.log('[ServiceList] 완료일자 검색이므로 상태 "출고완료" 필터 자동 적용');
        query = query.eq('status', '출고완료');
      } else if (searchParams.selectedStatuses && searchParams.selectedStatuses.length > 0) {
        console.log('[ServiceList] 상태 필터링 적용:', searchParams.selectedStatuses);
        query = query.in('status', searchParams.selectedStatuses);
      } else {
        console.log('[ServiceList] 상태 필터 없음 또는 비어있음');
      }
      
      // 날짜 필터링
      if (searchParams.dateFilter && (searchParams.dateFilter.startDate || searchParams.dateFilter.endDate)) {
        console.log('[ServiceList] 날짜 필터링 적용:', {
          dateField,
          startDate: searchParams.dateFilter.startDate,
          endDate: searchParams.dateFilter.endDate
        });
        
        // 완료일자 검색 시 null이 아닌 것만 필터링
        if (dateField === 'completion_date') {
          query = query.not(dateField, 'is', null);
        }
        
        if (searchParams.dateFilter.startDate) {
          console.log('[ServiceList] 날짜 시작 필터:', searchParams.dateFilter.startDate);
          query = query.gte(dateField, searchParams.dateFilter.startDate);
        }
        if (searchParams.dateFilter.endDate) {
          // endDate의 다음 날 00:00:00 미만으로 검색하여 해당 날짜의 모든 시간대 포함
          // 날짜 문자열을 직접 조작하여 타임존 문제 방지
          const [year, month, day] = searchParams.dateFilter.endDate.split('-').map(Number);
          const endDate = new Date(year, month - 1, day + 1);
          const nextDay = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
          console.log('[ServiceList] 날짜 종료 필터:', searchParams.dateFilter.endDate, '->', nextDay);
          query = query.lt(dateField, nextDay);
        }
      }

      // 태그 단어 검색 (태그 이름에 포함된 단어로 검색)
      if (searchParams.selectedTags && searchParams.selectedTags.length > 0) {
        console.log('태그 단어 검색 시작:', searchParams.selectedTags);
        
        // 각 태그 단어에 대해 OR 조건으로 검색
        const tagConditions = searchParams.selectedTags.map(tag => {
          const safeTag = tag.replace(/"/g, '');
          return `tag_name.ilike."%${safeTag}%"`;
        }).join(',');
        
        const { data: tagRows, error: tagQueryError } = await supabase
          .from('service_tags')
          .select('service_id, tag_name')
          .or(tagConditions);
          
        if (tagQueryError) {
          console.error('Error fetching services by tag words:', tagQueryError);
          throw tagQueryError;
        }
        
        console.log('태그 단어 검색 결과:', tagRows);
        
        const idSet = new Set((tagRows || []).map(r => r.service_id));
        tagMatchedServiceIds = Array.from(idSet);
        
        // 태그에 매칭되는 서비스가 하나도 없으면 바로 종료 (0건)
        if (tagMatchedServiceIds.length === 0) {
          console.log('태그 단어 검색 결과 없음');
          setTotalExpected(0);
          setServices([]);
          setFirstPageLoaded(true);
          setHasActiveSearch(true);
          setSearchLoading(false);
          return;
        }
        
        console.log('태그 단어 검색으로 찾은 서비스 ID들:', tagMatchedServiceIds);
        query = query.in('id', tagMatchedServiceIds);
      }
      
      // 첫 페이지만 먼저 가져오기 (검색 결과) - 더 작은 크기로
      const FIRST_PAGE_SIZE = 20; // 50에서 20으로 줄임
      const firstPageQuery = query.range(0, FIRST_PAGE_SIZE - 1);
      
      // 카운트 쿼리 완전 제거 - 단순화

      // 단순한 검색 실행
      console.log('[ServiceList] 검색 쿼리 실행 시작');
      
      // 타임아웃 완전 제거 - 직접 쿼리 실행
      console.log('[ServiceList] 타임아웃 없이 직접 쿼리 실행');
      
      // 더 단순한 쿼리로 테스트
      console.log('[ServiceList] 단순 쿼리로 테스트 시작');
      
      let firstPageResult;
      try {
        // 단계별 쿼리 구성
        console.log('[ServiceList] 기본 쿼리 구성 중...');
        let simpleQuery = supabase
          .from('services')
          .select('*,service_tags(tag_name),service_parts(id,part_id,quantity,price,usage,parts(name,code))')
          .eq('brand', selectedBrand);
        
        console.log('[ServiceList] 브랜드 필터 적용 완료');
        
        // 날짜 필터 타입 확인 (상태 필터링 전에 확인하여 완료일자 검색 시 상태 필터 자동 적용)
        let dateField = 'reception_date';
        if (searchParams.dateFilter && (searchParams.dateFilter.startDate || searchParams.dateFilter.endDate)) {
          dateField = searchParams.dateFilter.type || 'reception_date';
        }
        
        // 상태 필터링 적용
        // 완료일자로 검색할 때는 처리상태가 "완료"인 것만 필터링 (기존 상태 필터 무시)
        if (dateField === 'completion_date') {
          console.log('[ServiceList] 완료일자 검색이므로 상태 "출고완료" 필터 자동 적용');
          simpleQuery = simpleQuery.eq('status', '출고완료');
          console.log('[ServiceList] 상태 필터 적용 완료');
        } else if (searchParams.selectedStatuses && searchParams.selectedStatuses.length > 0) {
          console.log('[ServiceList] 상태 필터 적용 중:', searchParams.selectedStatuses);
          simpleQuery = simpleQuery.in('status', searchParams.selectedStatuses);
          console.log('[ServiceList] 상태 필터 적용 완료');
        }
        
        // 기종 검색 필터링
        if (searchParams.modelSearchTerm && searchParams.modelSearchTerm.length >= 2) {
          console.log('[ServiceList] 기종 필터 적용 중:', searchParams.modelSearchTerm);
          simpleQuery = simpleQuery.ilike('product_name', `%${searchParams.modelSearchTerm}%`);
          console.log('[ServiceList] 기종 필터 적용 완료');
        }
        
        // 처리내역 및 문의내용 검색 필터링
        if (searchParams.solutionSearchTerm && searchParams.solutionSearchTerm.length >= 2) {
          console.log('[ServiceList] 처리내역/문의내용 필터 적용 중:', searchParams.solutionSearchTerm);
          const safeTerm = searchParams.solutionSearchTerm.replace(/"/g, '');
          simpleQuery = simpleQuery.or(`solution.ilike."%${safeTerm}%",symptom.ilike."%${safeTerm}%"`);
          console.log('[ServiceList] 처리내역/문의내용 필터 적용 완료');
        }
        
        // 날짜 필터링
        if (searchParams.dateFilter && (searchParams.dateFilter.startDate || searchParams.dateFilter.endDate)) {
          console.log('[ServiceList] 날짜 필터링 적용:', {
            dateField,
            startDate: searchParams.dateFilter.startDate,
            endDate: searchParams.dateFilter.endDate
          });
          
          // 완료일자 검색 시 null이 아닌 것만 필터링
          if (dateField === 'completion_date') {
            console.log('[ServiceList] 완료일자 null 제외 필터 적용');
            simpleQuery = simpleQuery.not(dateField, 'is', null);
          }
          
          if (searchParams.dateFilter.startDate) {
            console.log('[ServiceList] 날짜 시작 필터 적용 중:', searchParams.dateFilter.startDate);
            simpleQuery = simpleQuery.gte(dateField, searchParams.dateFilter.startDate);
          }
          if (searchParams.dateFilter.endDate) {
            console.log('[ServiceList] 날짜 종료 필터 적용 중:', searchParams.dateFilter.endDate);
            // endDate의 다음 날 00:00:00 미만으로 검색하여 해당 날짜의 모든 시간대 포함
            // 날짜 문자열을 직접 조작하여 타임존 문제 방지
            const [year, month, day] = searchParams.dateFilter.endDate.split('-').map(Number);
            const endDate = new Date(year, month - 1, day + 1);
            const nextDay = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            console.log('[ServiceList] 종료일 다음 날로 필터 적용:', nextDay);
            simpleQuery = simpleQuery.lt(dateField, nextDay);
          }
          console.log('[ServiceList] 날짜 필터 적용 완료');
        }
        
        // 검색어 필터 적용 (고객명, 전화번호, A/S ID 검색)
        if (searchParams.searchTerm && searchParams.searchTerm.length >= 2) {
          console.log('[ServiceList] 검색어 필터 적용 중:', searchParams.searchTerm);
          
          // 전화번호 검색을 위해 하이픈 제거
          const cleanSearchTerm = searchParams.searchTerm.replace(/-/g, '');
          const originalSearchTerm = searchParams.searchTerm.trim();
          
          // 고객명, 전화번호, A/S ID 검색
          const isNumeric = /^\d+$/.test(cleanSearchTerm);
          
          if (isNumeric) {
            // 숫자인 경우: A/S ID 정확 검색 또는 전화번호 부분 검색 (하이픈 포함/제거 모두 검색)
            const safeOriginal = originalSearchTerm.replace(/"/g, '');
            const safeClean = cleanSearchTerm.replace(/"/g, '');
            simpleQuery = simpleQuery.or(`id.eq.${cleanSearchTerm},customer_phone.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeClean}%"`);
          } else {
            // 문자열인 경우: 고객명과 전화번호 검색 (하이픈 포함/제거 모두 검색)
            const safeOriginal = originalSearchTerm.replace(/"/g, '');
            const safeClean = cleanSearchTerm.replace(/"/g, '');
            simpleQuery = simpleQuery.or(`customer_name.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeClean}%"`);
          }
          console.log('[ServiceList] 검색어 필터 적용 완료');
        }
        
        // 태그 필터링 (태그 검색 결과가 있으면 적용)
        if (tagMatchedServiceIds && tagMatchedServiceIds.length > 0) {
          console.log('[ServiceList] 태그 필터 적용 중:', tagMatchedServiceIds);
          simpleQuery = simpleQuery.in('id', tagMatchedServiceIds);
          console.log('[ServiceList] 태그 필터 적용 완료');
        }
        
        // 정렬 및 제한
        simpleQuery = simpleQuery
          .order('reception_date', { ascending: false })
          .limit(20);
        
        console.log('[ServiceList] 최종 쿼리 실행 중...');
        console.log('[ServiceList] 쿼리 객체 상세:', {
          table: 'services',
          select: '*',
          brand: selectedBrand,
          searchTerm: searchParams.searchTerm,
          isNumeric: /^\d+$/.test(searchParams.searchTerm)
        });
        
        console.log('[ServiceList] 쿼리 실행 시작 - await 전');
        
        try {
          firstPageResult = await simpleQuery;
          console.log('[ServiceList] 쿼리 실행 완료:', firstPageResult);
        } catch (queryExecutionError) {
          console.error('[ServiceList] 쿼리 실행 중 오류:', queryExecutionError);
          throw queryExecutionError;
        }
      } catch (queryError) {
        console.error('[ServiceList] 쿼리 실행 오류:', queryError);
        throw queryError;
      }
      
      if (firstPageResult.error) {
        console.error('Error fetching search results:', firstPageResult.error);
        throw firstPageResult.error;
      }
      
      // 카운트는 대략적으로 설정 (정확하지 않아도 됨)
      const firstPageData = firstPageResult.data;
      const totalCount = firstPageData ? firstPageData.length : 0;
      console.log('[ServiceList] 대략적인 총 개수:', totalCount);
      
      // 결과 설정
      const countResult = { count: totalCount };
      
      setTotalExpected(totalCount);
      console.log(`[ServiceList] 검색 결과: 총 ${totalCount}건, 로드된 ${firstPageData?.length || 0}건`);
      
      if (firstPageData && firstPageData.length > 0) {
        // 검색 결과 처리 및 표시
        const processedServices = firstPageData.map(service => ({
            ...service,
            status: normalizeServiceStatus(service.status),
            tags: service.service_tags?.map(tag => tag.tag_name) || [],
            service_parts: service.service_parts || [] // 사용부품 정보 포함
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
      console.log('[ServiceList] 검색 완료');
      
    } catch (err) {
      console.error('[ServiceList] 검색 오류:', err);
      
      // 네트워크 오류인 경우에만 재시도 (타임아웃 관련 조건 제거)
      if (retryCount < 2 && (
        err.message.includes('network') || 
        err.message.includes('fetch') || 
        err.message.includes('Failed to fetch')
      )) {
        console.log(`[ServiceList] 네트워크 오류로 인한 재시도 (${retryCount + 1}/2)`);
        
        setTimeout(() => {
          performServerSearch(searchParams, retryCount + 1);
        }, 3000 * (retryCount + 1)); // 3초, 6초 지연
        return;
      }
      
      setError(`검색 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      console.log('[ServiceList] 검색 로딩 상태 해제');
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
        status: normalizeServiceStatus(service.status),
        tags: service.service_tags?.map(tag => tag.tag_name) || [],
        service_parts: service.service_parts || [] // 사용부품 정보 포함
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
            // 새 서비스 추가 시 건수 갱신
            fetchBrandCounts();
          } else if (payload.eventType === 'UPDATE') {
            setServices(prev => prev.map(service => 
              service.id === payload.new.id ? {
                ...payload.new,
                tags: service.tags || []  // 기존 태그 유지
              } : service
            ));
            // 상태 변경 시 건수 갱신
            fetchBrandCounts();
          } else if (payload.eventType === 'DELETE') {
            setServices(prev => prev.filter(service => 
              service.id !== payload.old.id
            ));
            // 삭제 시 건수 갱신
            fetchBrandCounts();
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
    if (!status) return 'default';
    if (status.includes('완료')) {
      if (status === '반품완료') return 'error'; // 빨간색
      return 'success';  // 출고완료 등 초록색
    }
    switch(status) {
      case '준비중':
        return 'info';   // 파란색 계열
      case '부품준비':
        return 'warning';  // 주황색 계열
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
      fetchBrandCounts(); // 건수 갱신
    } catch (err) {
      console.error('Error deleting service:', err);
      setError(err.message);
    }
  };

  const handleSave = async () => {
    if (selectedService) {
      try {
        const originalService = services.find(s => s.id === selectedService.id);
        const wasCompleted = originalService?.status === '출고완료';
        const isNowCompleted = selectedService.status === '출고완료';

        const updateData = {
          reception_date: selectedService.reception_date,
          repair_date: selectedService.repair_date,
          completion_date: selectedService.completion_date,
          reception_type: selectedService.reception_type,
          delivery_method: selectedService.delivery_method,
          customer_name: selectedService.customer_name,
          customer_phone: selectedService.customer_phone,
          customer_address: selectedService.customer_address,
          product_name: selectedService.product_name,
          symptom: selectedService.symptom,
          solution: selectedService.solution,
          status: selectedService.status,
          updated_at: new Date().toISOString()
        };

        // 상태가 '출고완료'로 변경될 때 완료일이 없으면 오늘 날짜로 설정
        if (!wasCompleted && isNowCompleted && !updateData.completion_date) {
          const now = new Date();
          updateData.completion_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          updateData.completion_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }


        const { error: updateError } = await supabase
          .from('services')
          .update(updateData)
          .eq('id', selectedService.id);

        if (updateError) throw updateError;

        // 상태가 변경되었으면 관련 부품 상태도 자동 동기화 (반품완료 제외)
        if (originalService?.status !== selectedService.status) {
          const { error: partsError } = await supabase
            .from('service_parts')
            .update({ status: selectedService.status })
            .eq('service_id', selectedService.id)
            .neq('status', '반품완료');
            
          if (partsError) {
             console.error('부품 상태 자동 동기화 오류:', partsError);
          }
        }

        // 재고 연동 로직
        if (wasCompleted && !isNowCompleted) {
           const revertResult = await processServiceRevert(selectedService.id, selectedBrand);
           if (revertResult && !revertResult.success) {
               throw new Error(`재고 복구 실패: ${revertResult.message || '알 수 없는 오류'}`);
           }
        } else if (!wasCompleted && isNowCompleted) {
           const inventoryResult = await processServiceCompletion(selectedService.id, selectedBrand);
           if (inventoryResult && !inventoryResult.success) {
               throw new Error(`재고 차감 실패: ${inventoryResult.message || '알 수 없는 오류'}`);
           }
        }

        // API 호출로 데이터 업데이트
        const updatedServices = services.map(service => 
          service.id === selectedService.id 
            ? { ...service, ...updateData }
            : service
        );
        setServices(updatedServices);
        
        if (typeof setFilteredServices === 'function') {
          try {
            setFilteredServices(updatedServices);
          } catch (e) {
            // ignore if setFilteredServices doesn't exist or errors
          }
        }
        
        setOpenDialog(false);
        fetchBrandCounts(); // 건수 갱신
        
        setSnackbar({
          open: true,
          message: 'A/S 정보가 성공적으로 업데이트되었습니다.',
          severity: 'success'
        });
      } catch (err) {
        console.error('Error saving service:', err);
        setError(err.message);
        setSnackbar({
          open: true,
          message: `저장 중 오류가 발생했습니다: ${err.message}`,
          severity: 'error'
        });
      }
    }
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

  // 브랜드별 접수/처리중 건수 조회
  const fetchBrandCounts = async () => {
    try {
      const results = await Promise.allSettled([
        countServiceStatusByBrand('XRB'),
        countServiceStatusByBrand('NB')
      ]);
      
      const xrbCounts = results[0].status === 'fulfilled' ? results[0].value : { reception: 0, processing: 0 };
      const nbCounts = results[1].status === 'fulfilled' ? results[1].value : { reception: 0, processing: 0 };
      
      setBrandCounts({
        XRB: xrbCounts,
        NB: nbCounts
      });
    } catch (error) {
      console.error('브랜드별 건수 조회 실패:', error);
      setBrandCounts({
        XRB: { reception: 0, processing: 0 },
        NB: { reception: 0, processing: 0 }
      });
    }
  };

  useEffect(() => {
    fetchBrandCounts();
    // 주기적으로 갱신 (30초마다)
    const interval = setInterval(fetchBrandCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // 서비스 데이터 변경 시 건수 갱신
  useEffect(() => {
    if (services.length > 0) {
      fetchBrandCounts();
    }
  }, [services.length, selectedBrand]);

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
    const newStatusFilter = event.target.value;
    console.log('[ServiceList] handleStatusFilterChange 호출됨', { newStatusFilter });
    setStatusFilter(newStatusFilter);
    
    // selectedStatuses와 동기화
    let newSelectedStatuses = [];
    if (newStatusFilter !== 'all') {
      newSelectedStatuses = [newStatusFilter];
    }
    
    // 필터 복원 중이 아닐 때만 자동 검색 실행
    const shouldRestorePage = sessionStorage.getItem('restorePageState');
    if (shouldRestorePage !== 'true' && !isFilterRestoringRef.current) {
      setSelectedStatuses(newSelectedStatuses);
      // 상태 변경 시 자동 검색 실행 (최신 상태 값 전달)
      setTimeout(() => {
        // 현재 필터 상태 확인 (최신 값 사용)
        const currentInputValue = inputValue.trim();
        const currentSelectedTags = selectedTags;
        const currentDateFilter = dateFilter;
        const currentModelSearchTerm = modelSearchTerm.trim();
        const currentSolutionSearchTerm = solutionSearchTerm.trim();
        
        // 상태 필터가 없고 다른 필터도 없으면 전체 데이터 로딩
        if (newSelectedStatuses.length === 0 && !currentInputValue && currentSelectedTags.length === 0 && !currentDateFilter.startDate && !currentDateFilter.endDate && !currentModelSearchTerm && !currentSolutionSearchTerm) {
          console.log('[ServiceList] 모든 필터가 없음 - 전체 데이터 로딩');
          fetchServices();
        } else {
          // 상태 필터가 있으면 검색 실행 (최신 상태 값 직접 전달)
          console.log('[ServiceList] 상태 필터 변경 - 검색 실행', { newSelectedStatuses });
          executeSearch(newSelectedStatuses, null);
        }
      }, 150);
    } else {
      // 필터 복원 중일 때는 selectedStatuses만 업데이트 (검색 실행 안 함)
      console.log('[ServiceList] 필터 복원 중 - selectedStatuses만 업데이트');
      setSelectedStatuses(newSelectedStatuses);
    }
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
            status: row['상태'] || '준비중',
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

        // 텔레그램 알림 전송 - 정지됨
        // if (insertedData && insertedData.length > 0) {
        //   for (const service of insertedData) {
        //     try {
        //       await sendTelegramNotification({
        //         message: `A/S 등록 (접수번호: ${service.id}) - 고객: ${service.customer_name || '정보없음'}, 연락처: ${service.customer_phone || '정보없음'}`,
        //         link: `/service/${service.id}`
        //       });
        //     } catch (telegramError) {
        //       console.error('엑셀 업로드 A/S 텔레그램 알림 전송 중 오류:', telegramError);
        //     }
        //   }
        // }
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
    
    try {
      // 하이라이트 ID 설정
      setCookie('highlightServiceId', String(service.id));
      localStorage.setItem('highlightServiceId', String(service.id));
      debugLog('Setting highlightServiceId before navigation:', service.id);
      
      // 네비게이션 전에 로딩 상태 표시
      setLoading(true);
      navigate(`/services/${service.id}`);
    } catch (error) {
      console.error('Navigation error:', error);
      setSnackbar({
        open: true,
        message: '페이지 이동 중 오류가 발생했습니다.',
        severity: 'error'
      });
      setLoading(false);
    }
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
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    
    // 행 수 변경 즉시 저장
    const pageState = {
      page: 0,
      rowsPerPage: newRowsPerPage
    };
    localStorage.setItem(PAGE_KEY, JSON.stringify(pageState));
    console.log('[ServiceList] 행 수 변경 즉시 저장:', pageState);
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
                : row.status === '부품준비'
                  ? '#ed6c02'
                  : row.status === '준비중'
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
            wordBreak: 'keep-all',
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
                  : row.status === '부품준비'
                    ? '#ed6c02'
                    : row.status === '준비중'
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              처리내역:
            </Typography>
            {/* 사용부품 아이콘 */}
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
                <BuildIcon sx={{ color: 'primary.main', fontSize: 16 }} />
              </Tooltip>
            )}
          </Box>
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

  // 엑셀 다운로드 함수 추가 (필터 적용된 데이터 사용)
  const handleDownloadExcel = async () => {
    try {
      // 필터가 적용된 현재 표시 중인 서비스 데이터 사용
      const servicesToExport = filteredServices;
      
      if (servicesToExport.length === 0) {
        setSnackbar({
          open: true,
          message: '다운로드할 데이터가 없습니다.',
          severity: 'warning'
        });
        return;
      }

      // 서비스 ID 목록으로 상세 데이터 조회
      const serviceIds = servicesToExport.map(service => service.id);
      
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          service_tags (
            tag_name
          ),
          service_parts (
            id,
            part_id,
            quantity,
            price,
            usage,
            parts (
              name,
              code
            )
          )
        `)
        .in('id', serviceIds)
        .order('reception_date', { ascending: false });

      if (error) throw error;

      // 데이터 가공
      const exportData = data.map(service => {
        // 태그 정보 처리
        const tags = service.service_tags?.map(tag => tag.tag_name).join(', ') || '';
        
        // 사용 부품 정보 처리
        const parts = service.service_parts?.map(part => {
          const partName = part.parts?.name || '알 수 없는 부품';
          const quantity = part.quantity || 1;
          const usage = part.usage || 'A/S';
          return `${partName}(${quantity}개, ${usage})`;
        }).join(', ') || '';
        
        // 처리진행상황 계산
        let progressStatus = '';
        if (service.status === '준비중') {
          progressStatus = '접수 완료';
        } else if (service.status === '부품준비') {
          if (service.repair_date) {
            progressStatus = '수리 진행중';
          } else {
            progressStatus = '부품 준비중';
          }
        } else if (service.status?.includes('완료')) {
          if (service.completion_date) {
            progressStatus = '완료';
          } else {
            progressStatus = '수리 완료';
          }
        }

        return {
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
          처리진행상황: progressStatus,
          태그: tags,
          사용부품: parts,
          메모: service.note || '',
          JPG: service.receipt_link || '',
          구매처: service.seller || '',
          작성자: service.writer || '관리자'
        };
      });

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
        { label: '처리진행상황', key: '처리진행상황' },
        { label: '태그', key: '태그' },
        { label: '사용부품', key: '사용부품' },
        { label: '메모', key: '메모' },
        { label: 'JPG', key: 'JPG' },
        { label: '구매처', key: '구매처' },
        { label: '작성자', key: '작성자' }
      ];

      // 파일 다운로드 (브랜드명 및 필터 정보 포함)
      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      
      // 필터 정보를 파일명에 포함
      let filterInfo = '';
      if (searchTerm) {
        filterInfo += `_검색_${searchTerm}`;
      }
      if (statusFilter && statusFilter !== 'all') {
        filterInfo += `_상태_${statusFilter}`;
      }
      if (dateFilter.startDate || dateFilter.endDate) {
        const startDate = dateFilter.startDate ? format(new Date(dateFilter.startDate), 'yyyy-MM-dd') : '';
        const endDate = dateFilter.endDate ? format(new Date(dateFilter.endDate), 'yyyy-MM-dd') : '';
        filterInfo += `_기간_${startDate}_${endDate}`;
      }
      
      const fileName = `AS목록_${brandName}${filterInfo}_${exportData.length}건_${new Date().toLocaleDateString()}.xlsx`;
      downloadExcel(exportData, headers, fileName);

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

  // 실시간 검색을 위한 debounce 효과
  useEffect(() => {
    const trimmedValue = inputValue.trim();
    
    // 이전 디바운스 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // 검색어가 비어있으면 searchTerm만 초기화 (페이지 새로고침 없음)
    if (trimmedValue === '') {
      setSearchTerm('');
      // fetchServices()를 호출하지 않고, searchTerm이 비워지면 자연스럽게 전체 목록이 표시됨
      return;
    }

    // 검색어가 1글자면 검색하지 않음
    if (trimmedValue.length === 1) {
      return;
    }

    // 검색어가 2글자 이상이면 800ms 후 자동 검색 (조금 더 여유를 줘서 불필요한 호출 감소)
    debounceTimerRef.current = setTimeout(() => {
      console.log('[ServiceList] 실시간 검색 실행:', trimmedValue);
      debounceTimerRef.current = null;
      executeSearch();
    }, 800); // 800ms 대기 후 검색

    // cleanup: 이전 타이머 취소
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]); // executeSearch는 의존성에서 제외 (무한 루프 방지)


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
    
    // 기종, 처리내역 검색어 초기화
    setModelSearchTerm('');
    setSolutionSearchTerm('');

    // 필터 및 페이지 저장값 삭제
    localStorage.removeItem(FILTER_KEY);
    localStorage.removeItem(PAGE_KEY);
    
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
  const PAGE_KEY = 'serviceListPage';

  const saveFilterState = () => {
    const filterState = {
      selectedBrand,
      statusFilter,
      dateFilter,
      inputValue,
      searchTerm,
      selectedStatuses,
      selectedTags,
      searchMode,
      modelSearchTerm,
      solutionSearchTerm
    };
    localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
    setSnackbar({
      open: true,
      message: '필터가 저장되었습니다.',
      severity: 'success'
    });
  };

  // 페이지 상태 저장 함수
  const savePageState = () => {
    const pageState = {
      page,
      rowsPerPage
    };
    localStorage.setItem(PAGE_KEY, JSON.stringify(pageState));
    console.log('[ServiceList] 페이지 상태 저장:', pageState);
  };

  // 페이지 상태 불러오기 함수
  const loadPageState = () => {
    const saved = localStorage.getItem(PAGE_KEY);
    console.log('[ServiceList] 저장된 페이지 상태:', saved);
    if (saved) {
      try {
        const pageState = JSON.parse(saved);
        console.log('[ServiceList] 페이지 상태 복원:', pageState);
        const savedPage = pageState.page || 0;
        const savedRowsPerPage = pageState.rowsPerPage || 20;
        
        // 페이지 상태 복원
        setPage(savedPage);
        setRowsPerPage(savedRowsPerPage);
        
        console.log(`[ServiceList] 페이지 ${savedPage + 1}로 복원됨 (행 수: ${savedRowsPerPage})`);
        
        // 복원 후 추가 확인
        setTimeout(() => {
          console.log(`[ServiceList] 복원 확인 - 현재 페이지: ${page + 1}, 목표 페이지: ${savedPage + 1}`);
          if (page !== savedPage) {
            console.log('[ServiceList] 페이지 복원 실패 - 재시도');
            setPage(savedPage);
          }
        }, 100);
      } catch (err) {
        console.error('페이지 상태 불러오기 실패:', err);
      }
    } else {
      console.log('[ServiceList] 저장된 페이지 상태가 없음');
    }
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
      // 필터 복원 중 플래그 설정
      isFilterRestoringRef.current = true;
      
      const filterState = JSON.parse(saved);
      setSelectedBrand(validateBrand(filterState.selectedBrand || 'XRB'));
      setStatusFilter(filterState.statusFilter || 'all');
      setDateFilter(filterState.dateFilter || { type: 'reception_date', startDate: '', endDate: '' });
      setInputValue(filterState.inputValue || '');
      setSearchTerm(filterState.searchTerm || '');
      setSelectedStatuses(filterState.selectedStatuses || []);
      setSelectedTags(filterState.selectedTags || []);
      setSearchMode(filterState.searchMode || 'AND');
      setModelSearchTerm(filterState.modelSearchTerm || '');
      setSolutionSearchTerm(filterState.solutionSearchTerm || '');
      
      // 필터 복원 완료 (약간의 지연 후 플래그 해제)
      setTimeout(() => {
        isFilterRestoringRef.current = false;
      }, 500);
      
      setSnackbar({
        open: true,
        message: '필터가 불러와졌습니다.',
        severity: 'success'
      });
    } catch {
      isFilterRestoringRef.current = false;
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
  const [modelSearchTerm, setModelSearchTerm] = useState(''); // 기종 검색어
  const [solutionSearchTerm, setSolutionSearchTerm] = useState(''); // 처리내역 검색어
  const [progressiveLoading, setProgressiveLoading] = useState(false); // 점진적 로딩 상태
  const [loadProgress, setLoadProgress] = useState(0); // 로딩 진행률
  const [retryCount, setRetryCount] = useState(0); // 재시도 횟수

  // 검색 실행 함수 (서버 사이드 검색)
  const executeSearch = useCallback((overrideStatuses = null, overrideTags = null) => {
    console.log('[ServiceList] executeSearch 호출됨', { overrideStatuses, overrideTags });
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

    // 오버라이드된 상태 값 사용 (상태 변경 시 최신 값 보장)
    const currentStatuses = overrideStatuses !== null ? overrideStatuses : selectedStatuses;
    const currentTags = overrideTags !== null ? overrideTags : selectedTags;

    // 검색어가 없거나 다른 필터도 없으면 전체 데이터 로딩으로 돌아가기
    if (!term && currentStatuses.length === 0 && currentTags.length === 0 && !dateFilter.startDate && !dateFilter.endDate && !modelSearchTerm.trim() && !solutionSearchTerm.trim()) {
      fetchServices();
      return;
    }
    
    // 서버 사이드 검색 실행
    const searchParams = {
      searchTerm: term,
      selectedStatuses: currentStatuses.length > 0 ? currentStatuses : null,
      selectedTags: currentTags.length > 0 ? currentTags : null,
      dateFilter: (dateFilter.startDate || dateFilter.endDate) ? dateFilter : null,
      searchMode,
      modelSearchTerm: modelSearchTerm.trim(),
      solutionSearchTerm: solutionSearchTerm.trim()
    };
    
    console.log('[ServiceList] 검색 실행 시 필터 상태:', { 
      currentStatuses, 
      currentStatusesLength: currentStatuses.length,
      currentTags, 
      searchParams,
      selectedStatuses: searchParams.selectedStatuses
    });
    
    performServerSearch(searchParams, 0);
  }, [inputValue, selectedStatuses, selectedTags, dateFilter, searchMode, modelSearchTerm, solutionSearchTerm, fetchServices, performServerSearch]);
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
  
  const statusOptions = ['준비중', '부품준비', '준비완료', '출고완료'];
  
  // 태그 옵션을 더 안정적으로 생성 (단어 검색용)
  const tagOptions = useMemo(() => {
    if (!services || services.length === 0) {
      return [];
    }
    
    const allTags = services.flatMap(s => {
      if (s.tags && Array.isArray(s.tags)) {
        return s.tags;
      }
      return [];
    });
    
    // 태그에서 단어 추출 (예: "#유성기어" -> "유성", "기어")
    const tagWords = allTags.flatMap(tag => {
      if (!tag || tag.trim() === '') return [];
      
      // # 제거하고 단어 추출
      const cleanTag = tag.replace(/^#/, '').trim();
      if (!cleanTag) return [];
      
      // 한글, 영문, 숫자로 구성된 단어들 추출
      const words = cleanTag.match(/[가-힣a-zA-Z0-9]+/g) || [];
      return words.filter(word => word.length >= 2); // 2글자 이상만
    });
    
    const uniqueWords = Array.from(new Set(tagWords)).filter(word => word && word.trim() !== '');
    console.log('[ServiceList] 태그 단어 옵션 생성:', uniqueWords);
    console.log('[ServiceList] 서비스 데이터 샘플:', services.slice(0, 2));
    return uniqueWords;
  }, [services]);

  const handleSearchModeChange = (e, value) => {
    if (value) setSearchMode(value);
  };
  const handleStatusChange = (e, value) => {
    console.log('[ServiceList] handleStatusChange 호출됨', { value, isFilterRestoring: isFilterRestoringRef.current });
    // 필터 복원 중이 아닐 때만 자동 검색 실행
    const shouldRestorePage = sessionStorage.getItem('restorePageState');
    if (shouldRestorePage !== 'true' && !isFilterRestoringRef.current) {
      setSelectedStatuses(value);
      // 상태 변경 시 자동 검색 실행 (최신 상태 값 전달)
      // 약간의 지연 없이 즉시 실행하되, 상태 업데이트를 보장하기 위해 다음 틱에서 실행
      setTimeout(() => {
        // 현재 필터 상태 확인 (최신 값 사용)
        const currentInputValue = inputValue.trim();
        const currentSelectedTags = selectedTags;
        const currentDateFilter = dateFilter;
        const currentModelSearchTerm = modelSearchTerm.trim();
        const currentSolutionSearchTerm = solutionSearchTerm.trim();
        
        // 상태 필터가 없고 다른 필터도 없으면 전체 데이터 로딩
        if (value.length === 0 && !currentInputValue && currentSelectedTags.length === 0 && !currentDateFilter.startDate && !currentDateFilter.endDate && !currentModelSearchTerm && !currentSolutionSearchTerm) {
          console.log('[ServiceList] 모든 필터가 없음 - 전체 데이터 로딩');
          fetchServices();
        } else {
          // 상태 필터가 있으면 검색 실행 (최신 상태 값 직접 전달)
          console.log('[ServiceList] 상태 필터 변경 - 검색 실행', { value });
          executeSearch(value, null);
        }
      }, 150);
    } else {
      // 필터 복원 중일 때는 selectedStatuses만 업데이트 (검색 실행 안 함)
      console.log('[ServiceList] 필터 복원 중 - selectedStatuses만 업데이트');
      setSelectedStatuses(value);
    }
  };
  const handleTagChange = (e, value, reason) => {
    console.log('[ServiceList] 태그 변경:', { 이전값: selectedTags, 새값: value, reason });
    
    // freeSolo 모드에서 입력된 값 처리
    if (reason === 'input' && value) {
      // 입력된 값이 문자열인 경우 배열로 변환
      const newValue = Array.isArray(value) ? value : [value];
      setSelectedTags(newValue);
    } else {
      setSelectedTags(value);
    }
  };
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

  // 컴포넌트 마운트 시 자동으로 필터 및 페이지 상태 불러오기
  useEffect(() => {
    loadFilterState();
    loadPageState();
    // eslint-disable-next-line
  }, []);

  // 데이터가 로드된 후 페이지 상태 재확인
  useEffect(() => {
    if (services.length > 0 && !loading) {
      console.log('[ServiceList] 데이터 로드 후 페이지 상태 재확인');
      
      // ServiceDetail에서 돌아왔는지 확인
      const shouldRestorePage = sessionStorage.getItem('restorePageState');
      if (shouldRestorePage === 'true') {
        console.log('[ServiceList] 데이터 로드 후 ServiceDetail 복원 플래그 감지');
        sessionStorage.removeItem('restorePageState');
        
        // 필터 상태 강제 복원
        const filterSaved = localStorage.getItem(FILTER_KEY);
        if (filterSaved) {
          try {
            const filterState = JSON.parse(filterSaved);
            console.log('[ServiceList] 데이터 로드 후 강제 필터 상태 복원:', filterState);
            
            setSelectedBrand(filterState.selectedBrand || 'XRB');
            setStatusFilter(filterState.statusFilter || 'all');
            setDateFilter(filterState.dateFilter || { type: 'reception_date', startDate: '', endDate: '' });
            setInputValue(filterState.inputValue || '');
            setSearchTerm(filterState.searchTerm || '');
            setSelectedStatuses(filterState.selectedStatuses || []);
            setSelectedTags(filterState.selectedTags || []);
            setSearchMode(filterState.searchMode || 'AND');
            setModelSearchTerm(filterState.modelSearchTerm || '');
            setSolutionSearchTerm(filterState.solutionSearchTerm || '');
            
            // 필터 복원 후 자동 검색 실행 비활성화 (페이지 로딩 시 불필요한 검색 방지)
            console.log('[ServiceList] 데이터 로드 후 필터 복원 완료 - 자동 검색 비활성화');
            
            // 추가 검색 실행 보장 비활성화 (페이지 로딩 시 불필요한 검색 방지)
            console.log('[ServiceList] 데이터 로드 후 추가 검색 실행 보장 비활성화');
          } catch (err) {
            console.error('데이터 로드 후 강제 필터 상태 복원 실패:', err);
          }
        }
        
        // 페이지 상태 강제 복원
        const pageSaved = localStorage.getItem(PAGE_KEY);
        if (pageSaved) {
          try {
            const pageState = JSON.parse(pageSaved);
            console.log('[ServiceList] 데이터 로드 후 강제 페이지 상태 복원:', pageState);
            setPage(pageState.page || 0);
            setRowsPerPage(pageState.rowsPerPage || 20);
          } catch (err) {
            console.error('데이터 로드 후 강제 페이지 상태 복원 실패:', err);
          }
        }
      } else {
        // 일반적인 페이지 상태 복원
        loadPageState();
      }
    }
  }, [services.length, loading]);

  // ServiceDetail에서 돌아왔을 때 필터 및 페이지 상태 강제 복원
  useEffect(() => {
    const shouldRestorePage = sessionStorage.getItem('restorePageState');
    if (shouldRestorePage === 'true') {
      console.log('[ServiceList] ServiceDetail에서 돌아옴 - 필터 및 페이지 상태 강제 복원');
      sessionStorage.removeItem('restorePageState');
      
      // 필터 상태 복원
      const restoreFilterState = () => {
        const filterSaved = localStorage.getItem(FILTER_KEY);
        if (filterSaved) {
          try {
            const filterState = JSON.parse(filterSaved);
            console.log('[ServiceList] 강제 필터 상태 복원:', filterState);
            
            setSelectedBrand(filterState.selectedBrand || 'XRB');
            setStatusFilter(filterState.statusFilter || 'all');
            setDateFilter(filterState.dateFilter || { type: 'reception_date', startDate: '', endDate: '' });
            setInputValue(filterState.inputValue || '');
            setSearchTerm(filterState.searchTerm || '');
            setSelectedStatuses(filterState.selectedStatuses || []);
            setSelectedTags(filterState.selectedTags || []);
            setSearchMode(filterState.searchMode || 'AND');
            setModelSearchTerm(filterState.modelSearchTerm || '');
            setSolutionSearchTerm(filterState.solutionSearchTerm || '');
            
            console.log('[ServiceList] 필터 상태 복원 완료');
          } catch (err) {
            console.error('강제 필터 상태 복원 실패:', err);
          }
        }
      };
      
      // 페이지 상태 복원
      const restorePageState = () => {
        const pageSaved = localStorage.getItem(PAGE_KEY);
        if (pageSaved) {
          try {
            const pageState = JSON.parse(pageSaved);
            console.log('[ServiceList] 강제 페이지 상태 복원:', pageState);
            setPage(pageState.page || 0);
            setRowsPerPage(pageState.rowsPerPage || 20);
          } catch (err) {
            console.error('강제 페이지 상태 복원 실패:', err);
          }
        }
      };
      
      // 즉시 복원
      restoreFilterState();
      restorePageState();
      
      // 필터 복원 후 자동 검색 실행 비활성화 (페이지 로딩 시 불필요한 검색 방지)
      console.log('[ServiceList] 필터 복원 후 자동 검색 실행 비활성화');
      
      // 추가 검색 실행 보장 비활성화 (페이지 로딩 시 불필요한 검색 방지)
      console.log('[ServiceList] 필터 복원 후 추가 검색 실행 보장 비활성화');
      
      // 데이터 로드 후 재복원
      setTimeout(() => {
        restorePageState();
      }, 500);
      
      // 추가 지연 후 재복원
      setTimeout(() => {
        restorePageState();
      }, 1000);
    }
  }, []);

  // 필터 상태가 바뀔 때마다 자동 저장
  useEffect(() => {
    saveFilterState();
    // eslint-disable-next-line
  }, [selectedBrand, statusFilter, dateFilter, inputValue, searchTerm, selectedStatuses, selectedTags, searchMode, modelSearchTerm, solutionSearchTerm]);

  
  // 나머지 필터들(태그, 날짜, 기종, 처리내역)은 자동 검색하지 않음 - 검색 버튼 클릭 시에만 실행

  // 필터 복원 후 강제 자동 검색 실행 비활성화 (ServiceDetail에서 돌아온 경우)
  useEffect(() => {
    const shouldRestorePage = sessionStorage.getItem('restorePageState');
    if (shouldRestorePage === 'true') {
      console.log('[ServiceList] ServiceDetail 복원 감지 - 강제 자동 검색 실행 비활성화');
    }
  }, [executeSearch, inputValue]);

  // 페이지 상태가 바뀔 때마다 자동 저장
  useEffect(() => {
    savePageState();
    // eslint-disable-next-line
  }, [page, rowsPerPage]);

  // 페이지 상태 복원 후 추가 확인
  useEffect(() => {
    const shouldRestorePage = sessionStorage.getItem('restorePageState');
    if (shouldRestorePage === 'true' && services.length > 0) {
      console.log('[ServiceList] 페이지 상태 복원 후 추가 확인');
      
      // 추가 지연 후 페이지 상태 재확인
      setTimeout(() => {
        const saved = localStorage.getItem(PAGE_KEY);
        if (saved) {
          try {
            const pageState = JSON.parse(saved);
            console.log('[ServiceList] 추가 확인 - 페이지 상태 복원:', pageState);
            setPage(pageState.page || 0);
            setRowsPerPage(pageState.rowsPerPage || 20);
          } catch (err) {
            console.error('추가 확인 페이지 상태 복원 실패:', err);
          }
        }
      }, 200);
    }
  }, [services.length]);

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
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
              {selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'} 브랜드 데이터 로딩 중
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

  // 에러 발생 시 전체 화면을 덮지 않도록 처리
  // if (error) { ... }

  return (
    <Box sx={{ 
      maxWidth: '1800px', 
      width: 'auto', 
      mx: 'auto'
    }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => {
              setError(null);
              fetchServices();
            }}>
              다시 시도
            </Button>
          }
        >
          {error}
        </Alert>
      )}

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
              label={
                brandCounts.XRB.reception > 0 || brandCounts.XRB.processing > 0
                  ? `X-RIDER 접수(${brandCounts.XRB.reception})/처리중(${brandCounts.XRB.processing})`
                  : "X-RIDER"
              }
              value="XRB"
              sx={{ fontWeight: 'bold', fontSize: brandCounts.XRB.reception > 0 || brandCounts.XRB.processing > 0 ? '0.875rem' : 'inherit' }}
            />
            <Tab 
              label={
                brandCounts.NB.reception > 0 || brandCounts.NB.processing > 0
                  ? `NEARBIKE 접수(${brandCounts.NB.reception})/처리중(${brandCounts.NB.processing})`
                  : "NEARBIKE"
              }
              value="NB"
              sx={{ fontWeight: 'bold', fontSize: brandCounts.NB.reception > 0 || brandCounts.NB.processing > 0 ? '0.875rem' : 'inherit' }}
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

      {/* 단어 검색 필터 섹션 */}
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} useFlexGap flexWrap="wrap">
          <TextField
            variant="outlined"
            placeholder="고객명, 전화번호, A/S ID로 검색"
            value={inputValue}
            onChange={handleSearchInput}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                // 디바운스 타이머 취소 (엔터 키 입력 시 즉시 검색하므로 디바운스 불필요)
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                
                const term = inputValue.toLowerCase().trim();
                if (term && term.length === 1) {
                  setSnackbar({
                    open: true,
                    message: '검색어는 최소 2글자 이상 입력해주세요.',
                    severity: 'warning'
                  });
                  return;
                }
                // 즉시 검색 실행
                executeSearch();
              }
            }}
            sx={{ 
              flex: { xs: '1 1 100%', md: '1 1 auto' },
              width: { xs: '100%', md: 'auto' },
              minWidth: { xs: 'auto', md: 200 },
              maxWidth: { xs: '100%', md: 400 }
            }}
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
          <TextField
            variant="outlined"
            placeholder="기종으로 검색"
            value={modelSearchTerm}
            onChange={(e) => setModelSearchTerm(e.target.value)}
            sx={{ 
              flex: { xs: '1 1 100%', md: '1 1 auto' },
              width: { xs: '100%', md: 'auto' },
              minWidth: { xs: 'auto', md: 150 },
              maxWidth: { xs: '100%', md: 200 }
            }}
            size="small"
            label="기종 검색"
            InputProps={{
              endAdornment: modelSearchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={() => setModelSearchTerm('')}
                    size="small"
                    aria-label="기종 검색어 초기화"
                    sx={{ color: 'gray' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }}
          />
          <TextField
            variant="outlined"
            placeholder="처리내역으로 검색"
            value={solutionSearchTerm}
            onChange={(e) => setSolutionSearchTerm(e.target.value)}
            sx={{ 
              flex: { xs: '1 1 100%', md: '1 1 auto' },
              width: { xs: '100%', md: 'auto' },
              minWidth: { xs: 'auto', md: 150 },
              maxWidth: { xs: '100%', md: 200 }
            }}
            size="small"
            label="문의&처리내역 검색"
            InputProps={{
              endAdornment: solutionSearchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    onClick={() => setSolutionSearchTerm('')}
                    size="small"
                    aria-label="문의&처리내역 검색어 초기화"
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
            sx={{ 
              height: { xs: 44, md: 40 },
              width: { xs: '100%', md: 'auto' },
              '& .MuiToggleButton-root': {
                flex: { xs: 1, md: 'none' },
                fontSize: { xs: '0.95rem', md: '0.875rem' },
                py: { xs: 1.5, md: 0.5 }
              }
            }}
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
            sx={{ 
              flex: { xs: '1 1 100%', md: 'none' },
              width: { xs: '100%', md: 'auto' },
              minWidth: { xs: 'auto', md: 140 },
              maxWidth: { xs: '100%', md: 180 }
            }}
            renderInput={(params) => <TextField {...params} label="상태" size="small" />}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={option}
                    size="small"
                    {...tagProps}
                  />
                );
              })
            }
          />
          <Autocomplete
            multiple
            freeSolo
            options={tagOptions}
            value={selectedTags}
            onChange={handleTagChange}
            disableCloseOnSelect
            size="small"
            sx={{ 
              flex: { xs: '1 1 100%', md: 'none' },
              width: { xs: '100%', md: 'auto' },
              minWidth: { xs: 'auto', md: 140 },
              maxWidth: { xs: '100%', md: 180 }
            }}
            noOptionsText={tagOptions.length === 0 ? "태그 단어가 없습니다" : "태그 단어를 선택하거나 입력하세요"}
            renderInput={(params) => (
              <TextField 
                {...params} 
                label="태그 단어" 
                size="small"
                placeholder="태그 단어 입력"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={option}
                    size="small"
                    {...tagProps}
                  />
                );
              })
            }
          />
        </Stack>
      </Box>

      {/* 날짜 검색 필터 섹션 */}
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} useFlexGap flexWrap="wrap">
          <TextField
            select
            value={dateFilter.type}
            onChange={(e) => setDateFilter(prev => ({ ...prev, type: e.target.value }))}
            sx={{ 
              flex: { xs: '1 1 100%', md: 'none' },
              width: { xs: '100%', md: 120 },
              minWidth: { xs: 'auto', md: 100 }
            }}
            size="small"
            label="날짜유형"
          >
            <MenuItem value="reception_date">접수일자</MenuItem>
            <MenuItem value="completion_date">완료일자</MenuItem>
          </TextField>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            flex: { xs: '1 1 100%', md: 'none' },
            width: { xs: '100%', md: 'auto' }
          }}>
            <TextField
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              sx={{ 
                flex: 1,
                minWidth: { xs: 'auto', md: 100 }
              }}
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
            <Typography variant="body2" sx={{ flexShrink: 0 }}>~</Typography>
            <TextField
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              sx={{ 
                flex: 1,
                minWidth: { xs: 'auto', md: 100 }
              }}
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
          </Box>
          <ButtonGroup 
            sx={{ 
              width: { xs: '100%', md: 'auto' },
              display: 'flex',
              flexWrap: { xs: 'wrap', md: 'nowrap' },
              '& .MuiButton-root': {
                flex: { xs: '1 1 calc(50% - 4px)', md: 'none' },
                minWidth: { xs: 'calc(50% - 4px)', md: 'auto' },
                fontSize: { xs: '0.875rem', md: '0.875rem' },
                py: { xs: 1, md: 0.5 },
                px: { xs: 1, md: 1.5 }
              }
            }}
          >
            <Button onClick={() => handleQuickDate('today')}>오늘</Button>
            <Button onClick={() => handleQuickDate('yesterday')}>어제</Button>
            <Button onClick={() => handleQuickDate('thisWeek')}>이번주</Button>
            <Button onClick={() => handleQuickDate('thisMonth')}>이번달</Button>
            <Button onClick={() => handleQuickDate('lastMonth')}>지난달</Button>
          </ButtonGroup>
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            width: { xs: '100%', md: 'auto' },
            flexWrap: { xs: 'wrap', md: 'nowrap' }
          }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                console.log('[ServiceList] 검색 버튼 클릭됨');
                executeSearch();
              }}
              disabled={searchLoading}
              sx={{ 
                flex: { xs: '1 1 calc(50% - 4px)', md: 'none' },
                minWidth: { xs: 'calc(50% - 4px)', md: 100 },
                height: { xs: 44, md: 40 }
              }}
              startIcon={searchLoading ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {searchLoading ? '검색 중' : '검색 실행'}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleResetAll}
              sx={{ 
                flex: { xs: '1 1 calc(50% - 4px)', md: 'none' },
                minWidth: { xs: 'calc(50% - 4px)', md: 100 },
                height: { xs: 44, md: 40 }
              }}
              startIcon={<RestartAltIcon fontSize="small" />}
            >
              전체 초기화
            </Button>
            <Button 
              variant="outlined" 
              onClick={saveFilterState} 
              sx={{ 
                flex: { xs: '1 1 calc(50% - 4px)', md: 'none' },
                minWidth: { xs: 'calc(50% - 4px)', md: 80 },
                height: { xs: 44, md: 40 }
              }}
            >
              필터 저장
            </Button>
            <Button 
              variant="outlined" 
              onClick={loadFilterState} 
              sx={{ 
                flex: { xs: '1 1 calc(50% - 4px)', md: 'none' },
                minWidth: { xs: 'calc(50% - 4px)', md: 80 },
                height: { xs: 44, md: 40 }
              }}
            >
              필터 불러오기
            </Button>
          </Box>
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
                <MenuItem value="준비중">준비중</MenuItem>
                <MenuItem value="부품준비">부품준비</MenuItem>
                <MenuItem value="준비완료">준비완료</MenuItem>
                <MenuItem value="출고완료">출고완료</MenuItem>
              </TextField>
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