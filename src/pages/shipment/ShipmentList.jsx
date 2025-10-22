import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  TextField,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Tabs,
  Tab,
  ButtonGroup,
  Tooltip,
  Snackbar,
  Alert,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  TablePagination,
  Skeleton,
  Container,
  Backdrop
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  CloudUpload as CloudUploadIcon,
  Clear as ClearIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { fetchShipments as fetchShipmentsAPI, countShipments } from '../../utils/restApiUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';
import dayjs from 'dayjs';

function ShipmentList() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(() => {
    const savedBrand = getCookie('shipment_selectedBrand');
    return (savedBrand === 'XRB' || savedBrand === 'NB') ? savedBrand : 'XRB';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const savedStatus = getCookie('shipment_statusFilter');
    return savedStatus || 'all';
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    const savedSearchTerm = getCookie('shipment_searchTerm');
    return savedSearchTerm || '';
  });
  const [inputValue, setInputValue] = useState(() => {
    const savedSearchTerm = getCookie('shipment_searchTerm');
    return savedSearchTerm || '';
  });
  const [sellerFilter, setSellerFilter] = useState(() => {
    const savedSeller = getCookie('shipment_sellerFilter');
    return savedSeller || 'all';
  });
  const [sellers, setSellers] = useState(['전체']);
  const [dateFilter, setDateFilter] = useState(() => {
    const savedDateFilter = getJSONCookie('shipment_dateFilter');
    return savedDateFilter || {
      type: 'order_date',
      startDate: '',
      endDate: ''
    };
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  
  // 엑셀 업로드 관련 상태 추가
  const [excelUploadDialog, setExcelUploadDialog] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // 마이그레이션 관련 상태 추가
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStats, setMigrationStats] = useState({ 
    total: 0, 
    migrated: 0, 
    skipped: 0, 
    failed: 0,
    split: 0
  });

  // 페이징 상태 추가
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  
  // 지연 로딩 관련 상태 추가
  const [firstPageLoaded, setFirstPageLoaded] = useState(false);
  const [totalExpected, setTotalExpected] = useState(0);
  const [loadedChunks, setLoadedChunks] = useState(0);
  const [isLoadingNextChunk, setIsLoadingNextChunk] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [progressiveLoading, setProgressiveLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasActiveSearch, setHasActiveSearch] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // 무한로딩 방지용 감시 타이머
  const loadingWatchdogRef = useRef(null);

  useEffect(() => {
    setCookie('shipment_selectedBrand', selectedBrand);
  }, [selectedBrand]);

  // 브랜드 값 정규화 (안정성): 예상치 못한 값일 때 기본값으로 복원
  useEffect(() => {
    if (selectedBrand !== 'XRB' && selectedBrand !== 'NB') {
      setSelectedBrand('XRB');
    }
  }, [selectedBrand]);

  useEffect(() => {
    setCookie('shipment_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setCookie('shipment_sellerFilter', sellerFilter);
  }, [sellerFilter]);

  useEffect(() => {
    setCookie('shipment_searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setJSONCookie('shipment_dateFilter', dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    fetchShipments();
  }, [selectedBrand, dateFilter, statusFilter, sellerFilter]);

  // 라우트 재진입/포커스/가시성 복귀 시 자동 재요청
  useEffect(() => {
    const onFocus = () => { if (!loading) fetchShipments(); };
    const onVisibility = () => { if (document.visibilityState === 'visible' && !loading) fetchShipments(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    // 최초 진입 시에도 보강 호출
    fetchShipments();
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line
  }, [location.key]);

  // 네트워크 상태 감지
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkError(false);
      // 데이터가 없으면 다시 로딩
      if (shipments.length === 0) {
        fetchFirstPage();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [shipments.length]);

  useEffect(() => {
    return () => {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/shipment')) {
        removeCookie('shipment_selectedBrand');
        removeCookie('shipment_statusFilter');
        removeCookie('shipment_sellerFilter');
        removeCookie('shipment_searchTerm');
        removeCookie('shipment_dateFilter');
      }
    };
  }, []);

  const extractSalesChannel = (note, salesChannelField) => {
    if (salesChannelField && salesChannelField.trim() !== '') return salesChannelField.trim();
    if (!note) return '공홈';
    const match = note.match(/\[판매처:\s*(.*?)\]/);
    if (match && match[1]) return match[1].trim();
    // 키워드 보정
    if (note.includes('청담매장') || note.includes('청담')) return '청담매장';
    const keywords = ['공홈','블로그','네이버','인스타','쿠팡','매장','스마트할부','라이클-우리','스마트스토어'];
    for (const k of keywords) if (note.includes(k)) return k;
    return '공홈';
  };

  // 첫 페이지만 빠르게 로딩하는 함수
  const fetchFirstPage = async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setNetworkError(false);
      setFirstPageLoaded(false);
      setLoadedChunks(0);
      setHasMoreData(true);
      setHasActiveSearch(false);

      // 감시 타이머 시작(15초)
      if (loadingWatchdogRef.current) clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = setTimeout(() => {
        setSnackbar({ open: true, severity: 'error', message: '요청이 예상보다 오래 걸립니다. 네트워크 상태를 확인한 후 다시 시도하세요.' });
        setLoading(false);
      }, 15000);
      
      if (retryAttempt === 0) {
        setShipments([]); // 첫 번째 시도에서만 초기화
      }
      
      console.log('fetchFirstPage called with selectedBrand:', selectedBrand, 'retry:', retryAttempt);
      
      const FIRST_PAGE_SIZE = 50;

      // REST API로 변경 - 날짜 필터 준비
      let processedDateFilter = {};
      if (dateFilter.startDate && dateFilter.endDate) {
        processedDateFilter = {
          startDate: format(new Date(dateFilter.startDate), 'yyyy-MM-dd 00:00:00'),
          endDate: format(new Date(dateFilter.endDate), 'yyyy-MM-dd 23:59:59'),
          type: dateFilter.type
        };
      }

      // 총 데이터 개수와 첫 페이지 데이터를 동시에 가져오기 (Abort + timeout 적용)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      console.log('[ShipmentList] Starting Promise.all for count + first page');
      const [totalCount, firstPageData] = await Promise.all([
        countShipments({
          selectedBrand,
          dateFilter: processedDateFilter,
          signal: controller.signal
        }),
        fetchShipmentsAPI({
          selectedBrand,
          dateFilter: processedDateFilter,
          page: 0,
          pageSize: FIRST_PAGE_SIZE,
          signal: controller.signal
        })
      ]);
      
      clearTimeout(timeoutId);
      
      console.log('[ShipmentList] REST API results - count:', totalCount, 'first page:', firstPageData?.length);
      
      setTotalExpected(totalCount);
      console.log(`Total shipments: ${totalCount}, First page loaded: ${firstPageData?.length || 0}`);
      
      if (firstPageData && firstPageData.length > 0) {
        // 날짜 기준으로 정렬 (REST API 버전)
        const sortedData = [...firstPageData].sort((a, b) => {
          let dateA, dateB;
          if (dateFilter.type === 'order_date') {
            dateA = a.order_date ? new Date(a.order_date) : new Date(a.created_at || 0);
            dateB = b.order_date ? new Date(b.order_date) : new Date(b.created_at || 0);
          } else if (dateFilter.type === 'completion_date') {
            dateA = a.shipment_date ? new Date(a.shipment_date) : new Date(a.created_at || 0);
            dateB = b.shipment_date ? new Date(b.shipment_date) : new Date(b.created_at || 0);
          } else {
            dateA = new Date(a.created_at || 0);
            dateB = new Date(b.created_at || 0);
          }
          return dateB - dateA;
        });
        
        setShipments(sortedData);
        setFirstPageLoaded(true);
        setLoading(false); // 첫 페이지 로딩 완료
        setLoadedChunks(1); // 첫 번째 청크 로드 완료
        
        // 판매처 목록 업데이트
        const uniqueSellers = new Set(['전체']);
        sortedData.forEach(shipment => {
          uniqueSellers.add(extractSalesChannel(shipment.note, shipment.sales_channel));
        });
        setSellers(Array.from(uniqueSellers));
        
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
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
      
    } catch (err) {
      console.error('[ShipmentList] Error fetching first page:', err);
      setNetworkError(true);
      if (loadingWatchdogRef.current) {
        clearTimeout(loadingWatchdogRef.current);
        loadingWatchdogRef.current = null;
      }
      if (err?.name === 'AbortError') {
        setSnackbar({ open: true, severity: 'error', message: '요청이 시간 초과로 취소되었습니다. 다시 시도해주세요.' });
        setLoading(false);
        return;
      }
      
      // Failed to fetch 계열 자동 1회 재시도
      const msg = String(err?.message || '');
      if (retryAttempt === 0 && (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch'))){
        console.log('[ShipmentList] Network error detected, retrying once...');
        return fetchFirstPage(1);
      }
      
      // 네트워크 오류가 계속되면 명확한 안내
      setSnackbar({
        open: true,
        message: '네트워크 연결 문제가 발생했습니다. 브라우저 연결이 유휴 상태였다면 페이지를 새로고침해주세요.',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // 다음 청크(100건) 로딩하는 함수
  const fetchNextChunk = async (startOffset) => {
    try {
      setIsLoadingNextChunk(true);
      
      const CHUNK_SIZE = 100;
      const page = Math.floor(startOffset / CHUNK_SIZE);
      
      console.log(`[ShipmentList] Loading next chunk: page ${page}, offset ${startOffset}`);
      
      // REST API로 변경 - 날짜 필터 준비
      let processedDateFilter = {};
      if (dateFilter.startDate && dateFilter.endDate) {
        processedDateFilter = {
          startDate: format(new Date(dateFilter.startDate), 'yyyy-MM-dd 00:00:00'),
          endDate: format(new Date(dateFilter.endDate), 'yyyy-MM-dd 23:59:59'),
          type: dateFilter.type
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const shipmentsData = await fetchShipmentsAPI({
        selectedBrand,
        dateFilter: processedDateFilter,
        page: page,
        pageSize: CHUNK_SIZE,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!shipmentsData || shipmentsData.length === 0) {
        setHasMoreData(false);
        return;
      }
      
      console.log(`[ShipmentList] Next chunk loaded: ${shipmentsData.length} items`);
      
      // 날짜 기준으로 정렬
      const sortedData = [...shipmentsData].sort((a, b) => {
        let dateA, dateB;
        if (dateFilter.type === 'order_date') {
          dateA = a.order_date ? new Date(a.order_date) : new Date(a.created_at || 0);
          dateB = b.order_date ? new Date(b.order_date) : new Date(a.created_at || 0);
        } else if (dateFilter.type === 'completion_date') {
          dateA = a.shipment_date ? new Date(a.shipment_date) : new Date(a.created_at || 0);
          dateB = b.shipment_date ? new Date(b.shipment_date) : new Date(a.created_at || 0);
        } else {
          dateA = new Date(a.created_at || 0);
          dateB = new Date(b.created_at || 0);
        }
        return dateB - dateA;
      });
      
      // 기존 데이터에 추가 (id 기준 중복 제거)
      setShipments(prev => {
        const byId = new Map(prev.map(item => [item.id, item]));
        for (const item of sortedData) {
          byId.set(item.id, item);
        }
        return Array.from(byId.values());
      });
      setLoadedChunks(prev => prev + 1);
      
      // 판매처 목록 업데이트
      const uniqueSellers = new Set(['전체']);
      setShipments(currentShipments => {
        currentShipments.forEach(shipment => {
          uniqueSellers.add(extractSalesChannel(shipment.note, shipment.sales_channel));
        });
        setSellers(Array.from(uniqueSellers));
        return currentShipments;
      });
      
      // 로드된 데이터가 청크 크기보다 작으면 더 이상 데이터 없음
      if (shipmentsData.length < CHUNK_SIZE) {
        setHasMoreData(false);
      }
      
      console.log(`[ShipmentList] Chunk loaded: ${shipmentsData.length} items. Total chunks: ${loadedChunks + 1}`);
      
      console.log(`Chunk loaded: ${shipmentsData.length} items. Total chunks: ${loadedChunks + 1}`);
      
    } catch (err) {
      console.error('Error loading next chunk:', err);
      if (err?.name === 'AbortError') {
        return;
      }
    } finally {
      setIsLoadingNextChunk(false);
    }
  };

  // 페이지 변경 시 필요하면 새 청크 로딩
  const handlePageChangeWithLoading = (event, newPage) => {
    // 표시할 데이터가 없으면 페이지 변경하지 않음
    if (filteredShipments.length === 0) {
      console.log('No data to display, staying on current page');
      return;
    }
    
    // 현재 페이지에 표시할 데이터가 있는지 확인
    const maxPage = Math.max(0, Math.ceil(filteredShipments.length / rowsPerPage) - 1);
    const validPage = Math.min(newPage, maxPage);
    
    setPage(validPage);
    
    // 3페이지마다 새 청크 로딩 체크
    const itemsNeeded = (validPage + 1) * rowsPerPage;
    const currentItemsLoaded = shipments.length;
    
    // 현재 로드된 데이터로 충분하지 않고, 더 로드할 데이터가 있으며, 현재 로딩 중이 아닐 때
    if (itemsNeeded > currentItemsLoaded && hasMoreData && !isLoadingNextChunk && !hasActiveSearch) {
      console.log(`Need ${itemsNeeded} items, have ${currentItemsLoaded}. Loading next chunk...`);
      fetchNextChunk(currentItemsLoaded);
    }
  };

  // 기존 함수명 유지를 위한 래퍼
  const fetchShipments = () => {
    fetchFirstPage();
  };

  // filteredShipments useMemo로 계산
  const filteredShipments = useMemo(() => {
    let filtered = shipments;

    // 검색
    if (searchTerm) {
      filtered = filtered.filter(shipment =>
        shipment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(shipment => shipment.status === statusFilter);
    }

    // 판매처 필터
    if (sellerFilter !== 'all') {
      filtered = filtered.filter(shipment => extractSalesChannel(shipment.note, shipment.sales_channel) === sellerFilter);
    }

    // 날짜 필터 - 메모리에서의 추가 필터링 제거
    // DB 쿼리에서 이미 필터링된 결과만 사용

    // 정렬
    filtered.sort((a, b) => {
      let dateA, dateB;
      if (dateFilter.type === 'order_date') {
        dateA = a.order_date ? new Date(a.order_date) : new Date(0);
        dateB = b.order_date ? new Date(b.order_date) : new Date(0);
      } else if (dateFilter.type === 'completion_date') {
        dateA = a.shipment_date ? new Date(a.shipment_date) : new Date(0);
        dateB = b.shipment_date ? new Date(b.shipment_date) : new Date(0);
      }
      return dateB - dateA;
    });

    return filtered;
  }, [shipments, searchTerm, statusFilter, sellerFilter, dateFilter.type]);

  // 검색이나 필터 변경 시에만 페이지 초기화 (청크 로딩 시에는 유지)
  useEffect(() => {
    setPage(0);
  }, [searchTerm, statusFilter, sellerFilter, dateFilter, hasActiveSearch]);

  const handleBrandChange = (event, newValue) => {
    const next = newValue === 'XRB' || newValue === 'NB' ? newValue : 'XRB';
    setSelectedBrand(next);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleSellerFilterChange = (event) => {
    setSellerFilter(event.target.value);
  };

  const handleSearchInput = (event) => {
    setInputValue(event.target.value);
  };

  const executeSearch = () => {
    setSearchTerm(inputValue);
    fetchShipments();
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      executeSearch();
    }
  };

  const resetDateFilter = () => {
    const resetFilter = {
      type: 'order_date',
      startDate: '',
      endDate: ''
    };
    setDateFilter(resetFilter);
  };

  const handleDateFilterChange = (type, value) => {
    const newDateFilter = { ...dateFilter, [type]: value };
    setDateFilter(newDateFilter);
  };

  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch(period) {
      case 'today':
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        start.setHours(0,0,0,0);
        end.setDate(today.getDate() - 1);
        end.setHours(23,59,59,999);
        break;
      case 'thisWeek':
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        start.setHours(0,0,0,0);
        end = new Date();
        end.setHours(23,59,59,999);
        break;
      case 'lastWeek':
        // 월요일 시작 기준 지난주
        {
          const day = today.getDay();
          const thisWeekStartOffset = today.getDate() - day + (day === 0 ? -6 : 1);
          const thisWeekStart = new Date(today.getFullYear(), today.getMonth(), thisWeekStartOffset);
          const lastWeekStart = new Date(thisWeekStart);
          lastWeekStart.setDate(thisWeekStart.getDate() - 7);
          const lastWeekEnd = new Date(lastWeekStart);
          lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
          start = lastWeekStart;
          end = lastWeekEnd;
          start.setHours(0,0,0,0);
          end.setHours(23,59,59,999);
        }
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23,59,59,999);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23,59,59,999);
        break;
      default:
        return;
    }
    
    const newDateFilter = {
      ...dateFilter,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
    };
    
    setDateFilter(newDateFilter);
  };

  const handleAddNew = () => {
    navigate('/shipment/new');
  };

  const handleViewDetails = (id) => {
    navigate(`/shipment/${id}`);
  };

  const handleEdit = (id, event) => {
    if (event) {
      event.stopPropagation();
    }
    navigate(`/shipment/edit/${id}`);
  };

  const handleDeleteClick = (shipment, event) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedShipment(shipment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', selectedShipment.id);

      if (error) throw error;
      
      fetchShipments();
      
      setSnackbar({
        open: true,
        message: '출고 정보가 성공적으로 삭제되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('출고 정보 삭제 중 오류:', error);
      setSnackbar({
        open: true,
        message: '출고 정보 삭제 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedShipment(null);
      setLoading(false);
    }
  };

  const handleExcelDownload = () => {
    try {
      const exportData = shipments.map(shipment => ({
        '고객명': shipment.customer_name,
        '연락처': shipment.customer_phone,
        '주소': shipment.customer_address,
        '제품명': shipment.product_name,
        '수량': shipment.quantity,
        '판매처': (() => {
          const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
          return salesChannelMatch ? salesChannelMatch[1] : '공홈';
        })(),
        '배송방법': shipment.delivery_method,
        '출고일': shipment.shipment_date,
        '메모': shipment.note,
        '상태': shipment.status
      }));

      const headers = [
        { label: '고객명', key: '고객명' },
        { label: '연락처', key: '연락처' },
        { label: '주소', key: '주소' },
        { label: '제품명', key: '제품명' },
        { label: '수량', key: '수량' },
        { label: '가격', key: '가격' },
        { label: '상태', key: '상태' },
        { label: '판매채널', key: '판매채널' },
        { label: '배송방법', key: '배송방법' },
        { label: '출고일', key: '출고일' },
        { label: '메모', key: '메모' },
        { label: '상태', key: '상태' }
      ];

      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      downloadExcel(exportData, headers, `출고목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

      setSnackbar({
        open: true,
        message: '엑셀 파일이 다운로드되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('엑셀 다운로드 중 오류:', error);
      setSnackbar({
        open: true,
        message: '엑셀 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '준비중':
        return 'info';
      case '출고완료':
        return 'success';
      case '배송중':
        return 'warning';
      default:
        return 'default';
    }
  };

  // 엑셀 템플릿 다운로드 함수
  const handleDownloadTemplate = () => {
    try {
      // 템플릿 데이터 생성
      const templateData = [
        {
          '고객명': '홍길동',
          '연락처': '010-1234-5678',
          '주소': '서울시 강남구',
          '제품명': 'X-RIDER 전기자전거',
          '제품코드': 'XRBM-001',
          '수량': '1',
          '가격': '1500000',
          '카테고리': '기체',
          '판매처': '공홈',
          '배송방법': '택배',
          '주문일': '2024-05-01',
          '출고일': '2024-05-05',
          '메모': '배송 전 연락 요망'
        },
        {
          '고객명': '김철수',
          '연락처': '010-9876-5432',
          '주소': '부산시 해운대구',
          '제품명': 'X-RIDER MINI',
          '제품코드': 'XRBM-002',
          '수량': '1',
          '가격': '1200000',
          '카테고리': '기체',
          '판매처': '청담매장',
          '배송방법': '방문수령',
          '주문일': '2024-05-02',
          '출고일': '',
          '메모': '주문확인 완료'
        },
        {
          '고객명': '김철수',
          '연락처': '010-9876-5432',
          '주소': '부산시 해운대구',
          '제품명': '배터리 충전기',
          '제품코드': 'XRBP-001',
          '수량': '1',
          '가격': '50000',
          '카테고리': '파츠',
          '판매처': '청담매장',
          '배송방법': '방문수령',
          '주문일': '2024-05-02',
          '출고일': '',
          '메모': ''
        }
      ];

      const headers = [
        { label: '고객명', key: '고객명' },
        { label: '연락처', key: '연락처' },
        { label: '주소', key: '주소' },
        { label: '제품명', key: '제품명' },
        { label: '제품코드', key: '제품코드' },
        { label: '수량', key: '수량' },
        { label: '가격', key: '가격' },
        { label: '카테고리', key: '카테고리' },
        { label: '판매처', key: '판매처' },
        { label: '배송방법', key: '배송방법' },
        { label: '주문일', key: '주문일' },
        { label: '출고일', key: '출고일' },
        { label: '메모', key: '메모' }
      ];

      // 파일 다운로드
      downloadExcel(templateData, headers, `출고등록템플릿_${selectedBrand}.xlsx`);

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

  // 카테고리 결정 함수 (코드 패턴 기반)
  const determineCategory = (code, name, price) => {
    if (!code) return '기타';
    
    const upperCode = code.toUpperCase();
    
    // 코드 패턴 기반 카테고리 결정
    if (upperCode.startsWith('XRBM-') || upperCode.startsWith('NBM-') || upperCode.includes('BIKE')) {
      return '기체';
    } else if (upperCode.startsWith('XRBP-') || upperCode.startsWith('NBP-') || upperCode.includes('PART')) {
      return '파츠';
    } else if (upperCode.startsWith('XRBS-') || upperCode.startsWith('NBS-') || upperCode.includes('SERVICE')) {
      return '공임';
    }
    
    // 기본값
    return '기타';
  };

  // 엑셀 파일 업로드 핸들러
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const jsonData = await readExcelFile(file);

      setUploadProgress(50);
      
      if (jsonData.length === 0) {
        setSnackbar({
          open: true,
          message: '업로드한 파일에 데이터가 없습니다.',
          severity: 'warning'
        });
        setIsUploading(false);
        return;
      }

      // 프리뷰 데이터 생성 (최대 5개 항목)
      setPreviewData(jsonData.slice(0, 5));
      
      // 전체 데이터 저장
      setUploadedData(jsonData);
      
      setUploadProgress(100);
      setExcelUploadDialog(true);
      setIsUploading(false);
    } catch (error) {
      console.error('엑셀 파일 처리 중 오류:', error);
      setSnackbar({
        open: true,
        message: '엑셀 파일 형식이 올바르지 않습니다.',
        severity: 'error'
      });
      setIsUploading(false);
    }
    
    // 파일 input 초기화
    event.target.value = '';
  };

  // 엑셀 데이터 저장 처리
  const handleSaveExcelData = async () => {
    if (uploadedData.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // 중복 확인을 위한 고객 정보별 그룹화
      const customerGroups = {};
      uploadedData.forEach((item, index) => {
        const customer = `${item['고객명'] || ''}/${item['연락처'] || ''}/${item['주문일'] || ''}`;
        if (!customerGroups[customer]) {
          customerGroups[customer] = {
            customer: {
              name: item['고객명'],
              phone: item['연락처'],
              address: item['주소'] || ''
            },
            orderDate: item['주문일'] || new Date().toISOString().split('T')[0],
            shipmentDate: item['출고일'] || '',
            note: item['메모'] || '',
            salesChannel: item['판매처'] || '공홈',
            deliveryMethod: item['배송방법'] || '택배',
            status: item['출고일'] ? '출고완료' : '준비중',
            products: []
          };
        }
        
        // 제품 정보 추가
        customerGroups[customer].products.push({
          name: item['제품명'],
          code: item['제품코드'] || '',
          quantity: parseInt(item['수량']) || 1,
          price: parseFloat(item['가격']) || 0,
          category: item['카테고리'] || determineCategory(item['제품코드'], item['제품명'], item['가격'])
        });
      });
      
      const totalGroups = Object.keys(customerGroups).length;
      let processedGroups = 0;
      
      // 각 고객 그룹별로 출고 정보 저장
      for (const customer of Object.keys(customerGroups)) {
        const groupData = customerGroups[customer];
        
        // 기본 출고 정보 데이터 준비
        const mainProduct = groupData.products[0]; // 첫 번째 제품을 메인 제품으로 사용
        const totalQuantity = groupData.products.reduce((sum, p) => sum + p.quantity, 0);
        const totalPrice = groupData.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const productNames = groupData.products.map(p => p.name).join(', ');
        
        // 판매처 정보를 메모에 포함
        const finalNote = `[판매처: ${groupData.salesChannel}] ${groupData.note || ''}`;
        
        // 출고 데이터 생성
        const shipmentData = {
          brand: selectedBrand,
          customer_name: groupData.customer.name,
          customer_phone: groupData.customer.phone,
          customer_address: groupData.customer.address,
          order_date: groupData.orderDate,
          shipment_date: groupData.shipmentDate || null,
          status: groupData.status,
          delivery_method: groupData.deliveryMethod,
          tracking_number: '',
          note: finalNote,
          product_name: productNames,
          product_code: mainProduct.code || '',
          quantity: totalQuantity,
          price: totalPrice,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // 출고 정보 저장
        const { data: savedShipment, error: shipmentError } = await supabase
          .from('shipments')
          .insert([shipmentData])
          .select();
          
        if (shipmentError) {
          console.error('출고 정보 저장 중 오류:', shipmentError);
          continue; // 오류가 있어도 다음 데이터 처리
        }
        
        const shipmentId = savedShipment[0].id;
        
        // 제품별 상세 정보 저장
        const partsData = groupData.products.map(product => ({
          shipment_id: shipmentId,
          part_name: product.name,
          part_code: product.code || '',
          part_category: product.category || '기타',
          quantity: product.quantity,
          price: product.price,
          total_price: product.price * product.quantity,
          created_at: new Date().toISOString()
        }));
        
        try {
          await supabase
            .from('shipment_parts')
            .insert(partsData);
        } catch (partsError) {
          console.error('제품 상세 정보 저장 중 오류:', partsError);
          // 오류가 있어도 진행
        }
        
        processedGroups++;
        setUploadProgress(Math.round((processedGroups / totalGroups) * 100));
      }
      
      // 모든 데이터 처리 완료
      setSnackbar({
        open: true,
        message: `${Object.keys(customerGroups).length}건의 출고 정보가 성공적으로 등록되었습니다.`,
        severity: 'success'
      });
      
      // 데이터 새로고침
      fetchShipments();
      
    } catch (error) {
      console.error('엑셀 데이터 저장 중 오류:', error);
      setSnackbar({
        open: true,
        message: '엑셀 데이터 저장 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setIsUploading(false);
      setExcelUploadDialog(false);
      setUploadedData([]);
      setPreviewData([]);
    }
  };

  // 데이터 마이그레이션 함수
  const handleBulkMigration = async () => {
    try {
      setMigrating(true);
      setMigrationProgress(0);
      setMigrationStats({ total: 0, migrated: 0, skipped: 0, failed: 0, split: 0 });
      
      // 1. 모든 출고 정보 조회
      const { data: allShipments, error } = await supabase
        .from('shipments')
        .select('id, product_name, product_code, quantity, price, brand')
        .eq('brand', selectedBrand);
        
      if (error) throw error;
      
      if (!allShipments || allShipments.length === 0) {
        setSnackbar({
          open: true,
          message: '마이그레이션할 출고 정보가 없습니다.',
          severity: 'info'
        });
        setMigrating(false);
        return;
      }
      
      // 2. 각 출고 정보별로 부품 정보 유무 확인
      const stats = { total: allShipments.length, migrated: 0, skipped: 0, failed: 0, split: 0 };
      setMigrationStats(stats);
      
      for (let i = 0; i < allShipments.length; i++) {
        const shipment = allShipments[i];
        setMigrationProgress(Math.floor((i / allShipments.length) * 100));
        
        // 제품명이 없으면 스킵
        if (!shipment.product_name) {
          stats.skipped++;
          continue;
        }
        
        // 이미 부품 정보가 있는지 확인
        const { data: existingParts, error: partsError } = await supabase
          .from('shipment_parts')
          .select('id')
          .eq('shipment_id', shipment.id);
          
        if (partsError) {
          stats.failed++;
          continue;
        }
        
        // 이미 부품 정보가 있으면 스킵
        if (existingParts && existingParts.length > 0) {
          stats.skipped++;
          continue;
        }
        
        // 제품명이 여러 개인지 확인 (쉼표로 구분)
        const productNames = shipment.product_name.split(',').map(name => name.trim()).filter(name => name);
        
        // 여러 제품으로 구분된 경우
        if (productNames.length > 1) {
          // 여러 파트로 분리해서 등록
          const partsData = [];
          
          // 각 제품별로 처리
          for (let j = 0; j < productNames.length; j++) {
            const productName = productNames[j];
            
            // 카테고리 추정
            let category = '기체'; // 기본값
            
            // 파츠 관리 시스템에서 매칭되는 제품 검색
            let partFromDB = null;
            try {
              const { data: matchingParts } = await supabase
                .from('parts')
                .select('*')
                .eq('brand', shipment.brand)
                .ilike('name', `%${productName}%`)
                .limit(1);
                
              if (matchingParts && matchingParts.length > 0) {
                partFromDB = matchingParts[0];
                
                // 파츠 관리에 설정된 구분 확인
                if (partFromDB.note) {
                  const note = partFromDB.note.toLowerCase();
                  if (note.includes('파츠') || note.includes('part') || note.includes('부품')) {
                    category = '파츠';
                  } else if (note.includes('공임') || note.includes('작업') || note.includes('서비스')) {
                    category = '공임';
                  } else if (note.includes('기타') || note.includes('etc')) {
                    category = '기타';
                  } else if (note.includes('기체') || note.includes('바이크') || note.includes('자전거')) {
                    category = '기체';
                  }
                }
                
                // 코드 패턴으로 카테고리 추정
                if (partFromDB.code) {
                  const code = partFromDB.code.toUpperCase();
                  if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
                    category = '파츠';
                  } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
                    category = '공임';
                  } else if (code.startsWith('XRBM-') || code.startsWith('NBM-') || code.includes('BIKE')) {
                    category = '기체';
                  }
                }
              }
            } catch (searchError) {
              console.error('파츠 검색 중 오류:', searchError);
            }
            
            // 가격 계산 - 제품별 가격 정보가 없으면 전체 가격을 균등 분배
            const estimatedPrice = shipment.price ? Math.round(shipment.price / productNames.length) : 0;
            
            // 새 부품 정보 생성
            partsData.push({
              shipment_id: shipment.id,
              part_name: productName,
              part_code: partFromDB?.code || '',
              part_category: category,
              quantity: Math.ceil((shipment.quantity || 1) / productNames.length), // 수량 분배
              price: partFromDB?.price || estimatedPrice,
              total_price: partFromDB?.price 
                ? partFromDB.price * Math.ceil((shipment.quantity || 1) / productNames.length)
                : estimatedPrice * Math.ceil((shipment.quantity || 1) / productNames.length),
              created_at: new Date().toISOString()
            });
          }
          
          // 부품 정보 저장
          try {
            const { error: insertError } = await supabase
              .from('shipment_parts')
              .insert(partsData);
              
            if (insertError) {
              console.error('분리된 제품 정보 저장 중 오류:', insertError);
              stats.failed++;
            } else {
              stats.migrated++;
              stats.split++;
            }
          } catch (insertError) {
            console.error('제품 정보 저장 중 오류:', insertError);
            stats.failed++;
          }
        } else {
          // 단일 제품 - 기존 코드 사용
          // 카테고리 추정
          let category = '기체';
          if (shipment.product_code) {
            const code = shipment.product_code.toUpperCase();
            if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
              category = '파츠';
            } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
              category = '공임';
            }
          }
          
          // 새 부품 정보 생성
          const partData = {
            shipment_id: shipment.id,
            part_name: shipment.product_name,
            part_code: shipment.product_code || '',
            part_category: category,
            quantity: shipment.quantity || 1,
            price: shipment.price ? (shipment.price / (shipment.quantity || 1)) : 0,
            total_price: shipment.price || 0,
            created_at: new Date().toISOString()
          };
          
          // 부품 정보 저장
          const { error: insertError } = await supabase
            .from('shipment_parts')
            .insert([partData]);
            
          if (insertError) {
            stats.failed++;
          } else {
            stats.migrated++;
          }
        }
        
        // 상태 업데이트
        setMigrationStats({...stats});
      }
      
      setMigrationProgress(100);
      
      // 작업 완료 메시지
      setSnackbar({
        open: true,
        message: `마이그레이션 완료: ${stats.migrated}개 성공 (${stats.split}개 제품 분리), ${stats.skipped}개 스킵, ${stats.failed}개 실패`,
        severity: 'success'
      });
      
      // 데이터 새로고침
      fetchShipments();
      
    } catch (error) {
      console.error('Error during bulk migration:', error);
      setSnackbar({
        open: true,
        message: '마이그레이션 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setMigrating(false);
      setTimeout(() => setMigrateDialogOpen(false), 2000);
    }
  };

  // 페이지 변경 핸들러 (기존 함수는 handlePageChangeWithLoading으로 대체됨)

  // 스켈레톤 테이블 렌더링
  const renderSkeletonTable = () => {
    const isInitialLoading = loading && !firstPageLoaded;
    const isSearchLoading = searchLoading;
    
    return (
      <>
        {(isInitialLoading || isSearchLoading) && (
          <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column' }} open>
            <CircularProgress color="inherit" size={60} />
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {isSearchLoading ? '출고 데이터를 검색하는 중...' : '출고 데이터를 불러오는 중...'}
              </Typography>
              {networkError && (
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  네트워크 오류가 발생했습니다. 재시도 중... ({retryCount}/3)
                </Typography>
              )}
              {!isOnline && (
                <Typography variant="body2" color="warning.main">
                  인터넷 연결을 확인해주세요.
                </Typography>
              )}
              <LinearProgress 
                sx={{ width: 300, mt: 2 }}
                variant={networkError ? "indeterminate" : "determinate"}
                value={isSearchLoading ? 50 : 25}
              />
            </Box>
          </Backdrop>
        )}
        
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 650, width: '100%', tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell width="10%">주문일자</TableCell>
                <TableCell width="10%">출고일자</TableCell>
                <TableCell width="10%">고객명</TableCell>
                <TableCell width="12%">연락처</TableCell>
                <TableCell width="20%">제품정보</TableCell>
                <TableCell width="10%">판매처</TableCell>
                <TableCell width="20%">배송정보</TableCell>
                <TableCell width="8%">상태</TableCell>
                <TableCell width="10%">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="90%" /></TableCell>
                  <TableCell><Skeleton variant="text" width="100%" /></TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="100%" />
                    <Skeleton variant="text" width="70%" />
                  </TableCell>
                  <TableCell><Skeleton variant="rectangular" width={60} height={24} /></TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="text" width="60%" />
                  </TableCell>
                  <TableCell><Skeleton variant="rectangular" width={50} height={24} /></TableCell>
                  <TableCell>
                    <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block', mr: 1 }} />
                    <Skeleton variant="circular" width={32} height={32} sx={{ display: 'inline-block' }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  };

  // 제품명 정렬 함수: 기체가 1번
  function getSortedProductNames(shipment) {
    if (!shipment.product_name) return '';
    const names = shipment.product_name.split(',').map(n => n.trim()).filter(Boolean);
    // shipment_parts에서 part_category 정보 가져오기
    // shipment에 shipment_parts가 없으면 그냥 기존 순서 반환
    if (!shipment.shipment_parts || !Array.isArray(shipment.shipment_parts)) return names.join(', ');
    // 각 제품명에 대해 part_category 확인
    const partsMap = new Map();
    shipment.shipment_parts.forEach(part => {
      partsMap.set(part.part_name, part.part_category || '기타');
    });
    // 정렬: 기체 먼저, 그 외 뒤에
    names.sort((a, b) => {
      const aCat = partsMap.get(a) || '기타';
      const bCat = partsMap.get(b) || '기타';
      if (aCat === '기체' && bCat !== '기체') return -1;
      if (aCat !== '기체' && bCat === '기체') return 1;
      return 0;
    });
    return names.join(', ');
  }

  // 초기 로딩 중일 때 스켈레톤 표시
  if (loading && !firstPageLoaded) {
    return (
      <Box sx={{ width: '100%', maxWidth: '1800px', mx: 'auto', p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">출고 관리</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              disabled
              sx={{
                bgcolor: '#3182f6',
                '&:hover': { bgcolor: '#1b64da' }
              }}
            >
              신규 등록
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              disabled
            >
              엑셀 다운로드
            </Button>
          </Stack>
        </Box>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
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
        </Box>

        {renderSkeletonTable()}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '1800px', mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">출고 관리</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleAddNew}
            sx={{
              bgcolor: '#3182f6',
              '&:hover': { bgcolor: '#1b64da' }
            }}
          >
            신규 등록
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExcelDownload}
          >
            엑셀 다운로드
          </Button>
          {/*
          <Tooltip title="부품 정보가 없는 출고 정보에 대해 일괄적으로 부품 정보를 추가합니다">
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setMigrateDialogOpen(true)}
              disabled={migrating}
            >
              제품 정보 일괄 업데이트
            </Button>
          </Tooltip>
          */}
        </Stack>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
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
      </Box>

      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} lg={3}>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>상태</InputLabel>
                <Select
                  value={statusFilter}
                  label="상태"
                  onChange={handleStatusFilterChange}
                >
                  <MenuItem value="all">전체 상태</MenuItem>
                  <MenuItem value="준비중">준비중</MenuItem>
                  <MenuItem value="배송중">배송중</MenuItem>
                  <MenuItem value="출고완료">출고완료</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>판매처</InputLabel>
                <Select
                  value={sellerFilter}
                  label="판매처"
                  onChange={handleSellerFilterChange}
                >
                  <MenuItem value="all">전체 판매처</MenuItem>
                  {sellers.map(seller => (
                    <MenuItem key={seller} value={seller}>{seller}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Grid>
          
          <Grid item xs={12} sm={6} lg={9}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>날짜 유형</InputLabel>
                <Select
                  value={dateFilter.type}
                  label="날짜 유형"
                  onChange={(e) => handleDateFilterChange('type', e.target.value)}
                >
                  <MenuItem value="order_date">주문일자</MenuItem>
                  <MenuItem value="completion_date">출고일자</MenuItem>
                </Select>
              </FormControl>
              
              <ButtonGroup size="small" variant="outlined">
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('lastWeek')}>지난주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>
              
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => {
                      handleDateFilterChange('startDate', newValue ? format(newValue, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { width: 120 }
                      }
                    }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => {
                      handleDateFilterChange('endDate', newValue ? format(newValue, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { width: 120 }
                      }
                    }}
                  />
                  {(dateFilter.startDate || dateFilter.endDate) && (
                    <IconButton 
                      size="small" 
                      onClick={resetDateFilter}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </LocalizationProvider>
            </Stack>
          </Grid>
        </Grid>
      </Box>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {(dateFilter.startDate || dateFilter.endDate) && (
          <Chip 
            label={`${dateFilter.startDate || '—'} ~ ${dateFilter.endDate || '—'}`} 
            size="small" 
            variant="outlined" 
            sx={{ mr: 1 }}
          />
        )}
        <TextField
          placeholder="고객명, 연락처, 제품명, 출고ID로 검색"
          variant="outlined"
          size="small"
          value={inputValue}
          onChange={handleSearchInput}
          onKeyPress={handleKeyPress}
          sx={{ flex: '0 1 400px', maxWidth: 400, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button 
          variant="contained" 
          onClick={executeSearch}
          size="small"
        >
          검색
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setInputValue('');
            setSearchTerm('');
            setStatusFilter('all');
            setSellerFilter('all');
            resetDateFilter();
          }}
          size="small"
        >
          초기화
        </Button>
      </Box>
      
      {/* 오프라인 상태 알림 */}
      {!isOnline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
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
          bgcolor: 'rgba(0, 0, 0, 0.8)', 
          color: 'white', 
          borderRadius: 2, 
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 200,
          boxShadow: 3
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 200
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} color="inherit" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {isLoadingNextChunk ? '다음 페이지 로딩 중...' : '추가 데이터 로딩 중...'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {shipments.length}/{hasActiveSearch ? shipments.length : totalExpected}건 
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
                  width: '100%', 
                  mt: 1,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: 'white'
                  }
                }} 
              />
            )}
          </Box>
        </Box>
      )}
      
      {filteredShipments.length === 0 ? (
        <Typography align="center" sx={{ mt: 3 }}>
          {searchTerm || statusFilter !== 'all' || sellerFilter !== 'all' || dateFilter.startDate || dateFilter.endDate ? 
            '검색 조건에 맞는 출고 정보가 없습니다.' : 
            '등록된 출고 정보가 없습니다.'}
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 650, width: '100%', tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell width="10%">주문일자</TableCell>
                <TableCell width="10%">출고일자</TableCell>
                <TableCell width="10%">고객명</TableCell>
                <TableCell width="12%">연락처</TableCell>
                <TableCell width="20%">제품정보</TableCell>
                <TableCell width="10%">판매처</TableCell>
                <TableCell width="20%">배송정보</TableCell>
                <TableCell width="8%">상태</TableCell>
                <TableCell width="10%">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredShipments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((shipment) => (
                  <TableRow 
                    key={shipment.id}
                    hover
                    onClick={() => handleViewDetails(shipment.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      {shipment.order_date
                        ? dayjs(shipment.order_date).format('YYYY-MM-DD')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {isValid(parseISO(shipment.shipment_date)) 
                        ? format(parseISO(shipment.shipment_date), 'yyyy-MM-dd')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 'bold' }}>
                        {shipment.customer_name}
                      </Typography>
                    </TableCell>
                    <TableCell>{shipment.customer_phone}</TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getSortedProductNames(shipment)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {shipment.quantity}개 / {shipment.price?.toLocaleString()}원
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const match = shipment.note?.match(/\[판매처: (.*?)\]/);
                        const salesChannel = match && match[1] ? match[1] : '공홈';
                        return (
                          <Chip
                            label={salesChannel}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Typography>{shipment.delivery_method}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {shipment.tracking_number || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={shipment.status} 
                        color={getStatusColor(shipment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleEdit(shipment.id, e)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="default"
                        sx={{ color: 'grey.500' }}
                        onClick={(e) => handleDeleteClick(shipment, e)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={hasActiveSearch ? filteredShipments.length : Math.max(filteredShipments.length, totalExpected)}
            page={page}
            onPageChange={handlePageChangeWithLoading}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[30, 50, 100]}
            labelRowsPerPage="페이지당 행 수"
            labelDisplayedRows={({ from, to, count }) => 
              `${count}개 중 ${from}-${to}`
            }
          />
        </TableContainer>
      )}
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({...prev, open: false}))}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          출고 정보 삭제
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography id="alert-dialog-description">
              선택한 출고 정보를 삭제하시겠습니까?
            </Typography>
            {selectedShipment && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  고객명: {selectedShipment.customer_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  연락처: {selectedShipment.customer_phone}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  제품: {selectedShipment.product_name}
                </Typography>
              </Box>
            )}
            <Typography color="error" sx={{ mt: 2 }}>
              * 삭제된 정보는 복구할 수 없습니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained" 
            color="error" 
            autoFocus
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 엑셀 업로드 다이얼로그 */}
      <Dialog
        open={excelUploadDialog}
        onClose={() => !isUploading && setExcelUploadDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>엑셀 데이터 업로드 확인</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>
              총 {uploadedData.length}개의 항목이 발견되었습니다. 다음 데이터를 업로드하시겠습니까?
            </Typography>
            
            {isUploading && (
              <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                <Typography variant="body2" align="center">
                  데이터 처리 중... {uploadProgress}%
                </Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 10,
                    bgcolor: '#eee',
                    borderRadius: 5,
                    mt: 1,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      bgcolor: '#3182f6',
                      width: `${uploadProgress}%`,
                      transition: 'width 0.3s ease-in-out'
                    }}
                  />
                </Box>
              </Box>
            )}
            
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>미리보기 (최대 5개 항목)</Typography>
            
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>고객명</TableCell>
                    <TableCell>연락처</TableCell>
                    <TableCell>제품명</TableCell>
                    <TableCell>제품코드</TableCell>
                    <TableCell>카테고리</TableCell>
                    <TableCell>수량</TableCell>
                    <TableCell>가격</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row['고객명']}</TableCell>
                      <TableCell>{row['연락처']}</TableCell>
                      <TableCell>{row['제품명']}</TableCell>
                      <TableCell>{row['제품코드'] || '-'}</TableCell>
                      <TableCell>
                        {row['카테고리'] || determineCategory(row['제품코드'], row['제품명'], row['가격'])}
                      </TableCell>
                      <TableCell>{row['수량'] || '1'}</TableCell>
                      <TableCell>{parseInt(row['가격']).toLocaleString() || '0'}원</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  • 같은 고객/주문일/판매처의 항목은 하나의 출고 정보로 그룹화됩니다.<br />
                  • 제품코드가 없는 제품도 등록이 가능하며, 카테고리가 지정되지 않은 경우 '기타'로 분류됩니다.<br />
                  • 출고일이 지정된 항목은 '출고완료' 상태로, 그렇지 않은 항목은 '준비중' 상태로 등록됩니다.
                </Typography>
              </Alert>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setExcelUploadDialog(false)} 
            disabled={isUploading}
          >
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveExcelData} 
            disabled={isUploading || uploadedData.length === 0}
          >
            업로드
          </Button>
        </DialogActions>
      </Dialog>

      {/* 마이그레이션 다이얼로그 */}
      <Dialog
        open={migrateDialogOpen}
        onClose={() => !migrating && setMigrateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>제품 정보 일괄 업데이트</DialogTitle>
        <DialogContent>
          {migrating ? (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography align="center" gutterBottom>
                제품 정보 업데이트 중입니다...
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                  <LinearProgress variant="determinate" value={migrationProgress} />
                </Box>
                <Box sx={{ minWidth: 35 }}>
                  <Typography variant="body2" color="text.secondary">{`${Math.round(migrationProgress)}%`}</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  총 {migrationStats.total}개 중 {migrationStats.migrated + migrationStats.skipped + migrationStats.failed}개 처리됨
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Chip label={`성공: ${migrationStats.migrated}`} color="success" size="small" />
                  <Chip label={`분리: ${migrationStats.split}`} color="secondary" size="small" />
                  <Chip label={`스킵: ${migrationStats.skipped}`} color="info" size="small" />
                  <Chip label={`실패: ${migrationStats.failed}`} color="error" size="small" />
                </Box>
              </Box>
            </Box>
          ) : (
            <>
              <Typography sx={{ mt: 2 }}>
                제품 정보가 없는 모든 출고 내역에 대해 자동으로 제품 정보를 업데이트합니다.
                이 작업은 대량의 데이터를 처리하므로 시간이 소요될 수 있습니다.
              </Typography>
              <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
                진행하시겠습니까?
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setMigrateDialogOpen(false)} 
            disabled={migrating}
          >
            취소
          </Button>
          <Button 
            onClick={handleBulkMigration} 
            variant="contained" 
            color="primary"
            disabled={migrating}
          >
            진행
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ShipmentList; 