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
  ToggleButton,
  ToggleButtonGroup,
  DialogActions,
  LinearProgress,
  TablePagination,
  Skeleton,
  Backdrop,
  Dialog,
  DialogTitle,
  DialogContent,
  Snackbar,
  Alert,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { warehouseApi } from '../../api/warehouseApi';
import { fetchShipments as fetchShipmentsAPI, countShipments, countPendingAndShippingByBrand } from '../../utils/restApiUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  format, parseISO, isValid, subDays, addDays
} from 'date-fns';
import { processShipmentRevert } from '../../utils/inventoryUtils';
import { downloadExcel } from '../../utils/excelUtils';
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

  // 캘린더/타임라인 뷰 중심 날짜 상태
  const [timelineDate, setTimelineDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'timeline'

  // 엑셀 업로드 관련 상태 추가
  const [excelUploadDialog, setExcelUploadDialog] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [uploadedData, setUploadedData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [up0, setUp0] = useState(0);
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
    const [totalExpected, setTotalExpected] = useState(0);
        const [networkError, setNetworkError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

      const [searchLoading] = useState(false);
  const [hasActiveSearch, setHasActiveSearch] = useState(false);

  // 브랜드별 준비중+출고대기 건수
  const [brandCounts, setBrandCounts] = useState({
    XRB: 0,
    NB: 0
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, dateFilter, page, rowsPerPage, statusFilter, sellerFilter, searchTerm]);

  // 브랜드별 준비중+출고대기 건수 조회
  const fetchBrandCounts = async () => {
    try {
      const [xrbCount, nbCount] = await Promise.all([
        countPendingAndShippingByBrand('XRB'),
        countPendingAndShippingByBrand('NB')
      ]);

      // 디버깅: 실제 데이터 확인
      if (xrbCount > 0 || nbCount > 0) {
        console.log('[ShipmentList] 브랜드별 건수:', { XRB: xrbCount, NB: nbCount });
      }

      setBrandCounts({
        XRB: xrbCount || 0,
        NB: nbCount || 0
      });
    } catch (error) {
      console.error('브랜드별 건수 조회 실패:', error);
      // 에러 발생 시 0으로 설정
      setBrandCounts({ XRB: 0, NB: 0 });
    }
  };

  useEffect(() => {
    fetchBrandCounts();
    // 주기적으로 갱신 (30초마다)
    const interval = setInterval(fetchBrandCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const data = await warehouseApi.getAll();
        setWarehouses(data || []);
      } catch (err) {
        console.error('Failed to load warehouses:', err);
      }
    };
    fetchWarehouses();
  }, []);

  // 출고 정보 변경 시 건수 갱신
  useEffect(() => {
    if (!loading) {
      fetchBrandCounts();
    }
  }, [!loading, shipments.length]);

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
        fetchShipments();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const keywords = ['공홈', '블로그', '네이버', '인스타', '쿠팡', '매장', '스마트할부', '라이클-우리', '스마트스토어'];
    for (const k of keywords) if (note.includes(k)) return k;
    return '공홈';
  };


  const fetchShipments = async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setNetworkError(false);
      setHasActiveSearch(false);

      let processedDateFilter = {};
      if (dateFilter.startDate && dateFilter.endDate) {
        try {
          const parsedStart = new Date(dateFilter.startDate);
          const parsedEnd = new Date(dateFilter.endDate);
          if (isValid(parsedStart) && isValid(parsedEnd)) {
            processedDateFilter = {
              startDate: format(parsedStart, 'yyyy-MM-dd') + 'T00:00:00+09:00',
              endDate: format(parsedEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00',
              type: dateFilter.type
            };
          }
        } catch (e) {
          console.warn('[ShipmentList] Invalid date filter, skipping:', e);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [totalCount, pageData] = await Promise.all([
        countShipments({
          selectedBrand,
          searchTerm,
          dateFilter: processedDateFilter,
          statusFilter,
          sellerFilter,
          recordType: 'store_shipment',
          signal: controller.signal
        }),
        fetchShipmentsAPI({
          selectedBrand,
          searchTerm,
          dateFilter: processedDateFilter,
          statusFilter,
          sellerFilter,
          recordType: 'store_shipment',
          page: page,
          pageSize: rowsPerPage,
          signal: controller.signal
        })
      ]);

      clearTimeout(timeoutId);

      setTotalExpected(totalCount || 0);
      setShipments(pageData || []);

      // 판매처 목록 수집 (현재 페이지 + 기본 항목)
      const uniqueSellers = new Set(['전체', '공홈']);
      if (pageData) {
        pageData.forEach(shipment => {
          uniqueSellers.add(extractSalesChannel(shipment.note, shipment.sales_channel));
        });
      }
      setSellers(Array.from(uniqueSellers));

      setRetryCount(0);
      setLoading(false);

    } catch (err) {
      console.error('[ShipmentList] Error fetching page:', err?.message || err?.statusText || JSON.stringify(err) || err);
      setNetworkError(true);
      if (err?.name === 'AbortError') {
        setSnackbar({ open: true, severity: 'error', message: '요청이 시간 초과로 취소되었습니다.' });
        setLoading(false);
        return;
      }

      const msg = String(err?.message || '');
      if (retryAttempt === 0 && (msg.includes('Failed to fetch') || msg.includes('NetworkError'))) {
        return fetchShipments(1);
      }

      setSnackbar({ open: true, message: '네트워크 연결 문제가 발생했습니다.', severity: 'error' });
      setLoading(false);
    }
  };

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

  // 실시간 검색을 위한 debounce 효과
  useEffect(() => {
    const trimmedValue = inputValue.trim();

    // 검색어가 비어있으면 searchTerm만 초기화 (페이지 새로고침 없음)
    if (trimmedValue === '') {
      setSearchTerm('');
      // fetchShipments()를 호출하지 않고, searchTerm이 비워지면 자연스럽게 전체 목록이 표시됨
      return;
    }

    // 검색어가 1글자면 검색하지 않음
    if (trimmedValue.length === 1) {
      return;
    }

    // 검색어가 2글자 이상이면 500ms 후 자동 검색
    const debounceTimer = setTimeout(() => {
      console.log('[ShipmentList] 실시간 검색 실행:', trimmedValue);
      setSearchTerm(trimmedValue);
    }, 500); // 500ms 대기 후 검색

    // cleanup: 이전 타이머 취소
    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

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

    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(today.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thisWeek':
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
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
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
        }
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
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

      if (selectedShipment.status === '출고완료') {
        const revertResult = await processShipmentRevert(selectedShipment.id, selectedShipment.brand);
        if (!revertResult.success) {
          throw new Error('재고 복구 중 오류 발생: ' + revertResult.message);
        }
      }

      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', selectedShipment.id);

      if (error) throw error;

      fetchShipments();
      fetchBrandCounts(); // 건수 갱신

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
      // 필터가 적용된 현재 표시 중인 출고 데이터 사용
      const shipmentsToExport = shipments;

      if (shipmentsToExport.length === 0) {
        setSnackbar({
          open: true,
          message: '다운로드할 데이터가 없습니다.',
          severity: 'warning'
        });
        return;
      }

      const exportData = shipmentsToExport.map(shipment => ({
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

      // 필터 정보를 파일명에 포함
      let filterInfo = '';
      if (searchTerm) {
        filterInfo += `_검색_${searchTerm}`;
      }
      if (statusFilter && statusFilter !== 'all') {
        filterInfo += `_상태_${statusFilter}`;
      }
      if (sellerFilter && sellerFilter !== 'all') {
        filterInfo += `_판매처_${sellerFilter}`;
      }
      if (dateFilter.startDate || dateFilter.endDate) {
        try {
          const startDate = dateFilter.startDate && isValid(new Date(dateFilter.startDate)) ? format(new Date(dateFilter.startDate), 'yyyy-MM-dd') : '';
          const endDate = dateFilter.endDate && isValid(new Date(dateFilter.endDate)) ? format(new Date(dateFilter.endDate), 'yyyy-MM-dd') : '';
          filterInfo += `_기간_${startDate}_${endDate}`;
        } catch (e) { /* ignore date format errors in filename */ }
      }

      const fileName = `출고목록_${brandName}${filterInfo}_${exportData.length}건_${new Date().toLocaleDateString()}.xlsx`;
      downloadExcel(exportData, headers, fileName);

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
      case '접수':
      case '준비중':
        return 'info';
      case '출고대기':
        return 'info';
      case '부품준비':
        return 'warning';
      case '준비완료':
      case '작업완료':
        return 'warning';
      case '반품완료':
        return 'error';
      case '출고완료':
        return 'success';
      default:
        return 'default';
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


  // 엑셀 데이터 저장 처리
  const handleSaveExcelData = async () => {
    if (uploadedData.length === 0) return;

    setIsUploading(true);
    setUp0(0);

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
            orderDate: item['주문일'] || format(new Date(), 'yyyy-MM-dd'),
            shipmentDate: item['출고일'] || '',
            note: item['메모'] || '',
            salesChannel: item['판매처'] || '공홈',
            deliveryMethod: item['배송방법'] || '택배',
            status: item['출고일'] ? '출고완료' : '접수',
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
          updated_at: new Date().toISOString(),
          record_type: 'store_shipment'
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

          // 추가: 입출고 관리(transactions)에 기록 (단, 현재 재고(inventory)에는 영향을 주지 않으므로 trigger 없음)
          const transactionData = groupData.products.map(product => ({
            group_id: shipmentId,
            type: 'out',
            product_id: null, // 과거 데이터라 정확한 part_id 매칭이 안될 수 있음, 이름/코드로 기록
            product_name: product.name,
            product_code: product.code || '',
            product_supplier: selectedBrand || 'NEARBIKE',
            quantity: product.quantity,
            from_location: 'DEFAULT', // 이카운트 이전 데이터용 가상 창고
            to_location: '외부(고객)',
            date: groupData.orderDate || format(new Date(), 'yyyy-MM-dd'),
            note: `[이카운트 이전] ${groupData.customer.name}`,
            is_grouped: groupData.products.length > 1,
            status: '완료' // 완료 처리하여 입출고 내역에 표시
          }));

          if (transactionData.length > 0) {
            await supabase.from('transactions').insert(transactionData);
          }
        } catch (partsError) {
          console.error('제품 상세 정보/기록장 저장 중 오류:', partsError);
          // 오류가 있어도 진행
        }

        processedGroups++;
        setUp0(Math.round((processedGroups / totalGroups) * 100));
      }

      // 모든 데이터 처리 완료
      setSnackbar({
        open: true,
        message: `${Object.keys(customerGroups).length}건의 출고 정보가 성공적으로 등록되었습니다.`,
        severity: 'success'
      });

      // 데이터 새로고침
      fetchShipments();
      fetchBrandCounts(); // 건수 갱신

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

            // 상품 관리 시스템에서 매칭되는 제품 검색
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

                // 상품 관리에 설정된 구분 확인
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
        setMigrationStats({ ...stats });
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
      fetchBrandCounts(); // 건수 갱신

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
    const isInitialLoading = loading && loading;
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
          <Table sx={{ minWidth: 650, width: '100%', tableLayout: 'fixed', border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
            <TableHead>
              <TableRow>
                <TableCell width="8%">주문일자</TableCell>
                <TableCell width="8%">출고일자</TableCell>
                <TableCell width="9%">고객명</TableCell>
                <TableCell width="10%">연락처</TableCell>
                <TableCell width="16%">제품정보</TableCell>
                <TableCell width="8%">판매처</TableCell>
                <TableCell width="13%">출고처</TableCell>
                <TableCell width="16%">배송정보</TableCell>
                <TableCell width="7%">상태</TableCell>
                <TableCell width="5%">관리</TableCell>
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
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="90%" />
                  </TableCell>
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

  // --- 공통 식별 및 색상 맵핑 함수 (리스트, 타임라인 공용) ---
  const getSalesChannel = (note) => {
    const match = note?.match(/\[판매처: (.*?)\]/);
    return match && match[1] ? match[1] : '공홈';
  };

  const getChannelColorInfo = (channel) => {
    const colors = {
      '공홈': { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
      '스마트스토어': { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
      '네이버': { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
      '쿠팡': { bg: '#fbe9e7', color: '#d84315', border: '#ffab91' },
      '청담매장': { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
      '인스타': { bg: '#fce4ec', color: '#c2185b', border: '#f48fb1' },
      '라이클-우리': { bg: '#fff8e1', color: '#f57f17', border: '#ffe082' },
      '스마트할부': { bg: '#ebf8fa', color: '#00838f', border: '#80deea' },
      '블로그': { bg: '#e8eaf6', color: '#283593', border: '#9fa8da' }
    };
    return colors[channel] || { bg: '#f5f5f5', color: '#616161', border: '#e0e0e0' };
  };

  const getDeliveryColorInfo = (method) => {
    const colors = {
      '택배': { bg: '#e3f2fd', color: '#1565c0' },
      '방문수령': { bg: '#f3e5f5', color: '#6a1b9a' },
      '화물': { bg: '#424242', color: '#ffffff' },
      '퀵-선불': { bg: '#424242', color: '#ffffff' },
      '퀵-착불': { bg: '#ffebee', color: '#c62828' }
    };
    return colors[method] || { bg: '#f5f5f5', color: '#616161' };
  };
  // -----------------------------------------------------------

  // 타임라인 뷰 렌더링 함수
  const renderTimelineCard = (shipment) => {
    const timeStr = shipment.created_at ? format(parseISO(shipment.created_at), 'HH:mm') : '-';
    // 판매처
    const salesChannel = getSalesChannel(shipment.note);
    const channelColor = getChannelColorInfo(salesChannel);
    // 배송
    const delColor = getDeliveryColorInfo(shipment.delivery_method);

    return (
      <Paper
        key={shipment.id}
        elevation={0}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': { bgcolor: '#f8f9fa' },
          cursor: 'pointer'
        }}
        onClick={() => handleViewDetails(shipment.id)}
      >
        <Box sx={{ minWidth: '60px', textAlign: 'center', pt: 0.5 }}>
          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>{timeStr}</Typography>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{shipment.customer_name}</Typography>
            <Typography variant="body2" color="text.secondary">{shipment.customer_phone}</Typography>
            <Chip label={shipment.status} color={getStatusColor(shipment.status)} size="small" sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(() => {
              const products = getSortedProducts(shipment);
              if (products.length === 0) {
                return <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>-</Typography>;
              }
              return products.map((item, idx) => (
                <Typography key={idx} variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                  • {item.name} {item.quantity}개
                </Typography>
              ));
            })()}
            <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary', fontWeight: 'bold' }}>
              총 수량: {shipment.quantity}개
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: '120px', alignItems: 'flex-end' }}>
          <Chip
            label={salesChannel}
            size="small"
            sx={{
              backgroundColor: channelColor.bg,
              color: channelColor.color,
              borderColor: channelColor.border,
              borderWidth: '1px',
              borderStyle: 'solid',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={shipment.delivery_method || '미지정'}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                bgcolor: delColor.bg,
                color: delColor.color,
                fontWeight: 600
              }}
            />
            {shipment.tracking_number && (
              <Typography variant="caption" sx={{ color: '#1976d2', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                [{shipment.tracking_number}]
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
    );
  };

  const renderTimeline = () => {
    const handlePrevDay = () => setTimelineDate(prev => subDays(prev, 1));
    const handleNextDay = () => setTimelineDate(prev => addDays(prev, 1));

    const targetDateStr = format(timelineDate, 'yyyy-MM-dd');

    // 선택된 일자의 출고건 필터링 및 시간순 정렬
    const dayShipments = shipments
      .filter(shipment => {
        // 출고일자(shipment_date) 기준 필터링
        if (!shipment.shipment_date || !isValid(parseISO(shipment.shipment_date))) return false;
        return format(parseISO(shipment.shipment_date), 'yyyy-MM-dd') === targetDateStr;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // 생성시간 오름차순 (아침->저녁)

    return (
      <Box sx={{ mt: 3, px: 2, pb: 4 }}>
        {/* 일자 네비게이션 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 4 }}>
          <IconButton onClick={handlePrevDay} sx={{ bgcolor: 'rgba(0,0,0,0.04)', mr: 2 }}>
            <NavigateBeforeIcon />
          </IconButton>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              {format(timelineDate, 'yyyy년 MM월 dd일')}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
              총 {dayShipments.length}건
            </Typography>
          </Box>
          <IconButton onClick={handleNextDay} sx={{ bgcolor: 'rgba(0,0,0,0.04)', ml: 2 }}>
            <NavigateNextIcon />
          </IconButton>
        </Box>

        {/* 세로 타임라인 라인 및 리스트 */}
        {dayShipments.length === 0 ? (
          <Typography align="center" sx={{ mt: 3, py: 5, color: 'text.secondary', bgcolor: '#f9f9f9', borderRadius: 2 }}>
            해당 일자에 배정된 출고 내역이 없습니다.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', pl: 4 }}>
            {/* 세로선 */}
            <Box sx={{
              position: 'absolute',
              left: '14px',
              top: '10px',
              bottom: '10px',
              width: '2px',
              bgcolor: '#e0e0e0'
            }} />

            {dayShipments.map((shipment) => (
              <Box key={shipment.id} sx={{ position: 'relative' }}>
                {/* 타임라인 노드(점) */}
                <Box sx={{
                  position: 'absolute',
                  left: '-32.5px',
                  top: '20px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  bgcolor: '#1976d2',
                  boxShadow: '0 0 0 3px white',
                  zIndex: 1
                }} />
                {renderTimelineCard(shipment)}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  // 제품명 정렬 함수: 기체가 1번
  function getSortedProducts(shipment) {
    if (!shipment.product_name) return [];
    const names = shipment.product_name.split(',').map(n => n.trim()).filter(Boolean);
    const partsMap = new Map();
    if (shipment.shipment_parts && Array.isArray(shipment.shipment_parts)) {
      shipment.shipment_parts.forEach(part => {
        partsMap.set(part.part_name, { category: part.part_category || '기타', quantity: part.quantity || 1 });
      });
    }

    // Convert names into object format
    const products = names.map(name => ({
      name,
      category: partsMap.get(name)?.category || '기타',
      quantity: partsMap.get(name)?.quantity || 1
    }));

    // Sort logic
    products.sort((a, b) => {
      if (a.category === '기체' && b.category !== '기체') return -1;
      if (a.category !== '기체' && b.category === '기체') return 1;
      return 0;
    });

    return products;
  }

  // 초기 로딩 중일 때 스켈레톤 표시
  if (loading && loading) {
    return (
      <Box sx={{ width: '100%', maxWidth: '1800px', mx: 'auto', p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">매장 출고관리</Typography>
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
              label={`X-RIDER${brandCounts.XRB > 0 ? `(${brandCounts.XRB})` : ''}`}
              value="XRB"
              sx={{ fontWeight: 'bold' }}
            />
            <Tab
              label={`NEARBIKE${brandCounts.NB > 0 ? `(${brandCounts.NB})` : ''}`}
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
        <Typography variant="h5">매장 출고관리</Typography>
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs
          value={selectedBrand}
          onChange={handleBrandChange}
        >
          <Tab
            label={`X-RIDER${brandCounts.XRB > 0 ? `(${brandCounts.XRB})` : ''}`}
            value="XRB"
            sx={{ fontWeight: 'bold' }}
          />
          <Tab
            label={`NEARBIKE${brandCounts.NB > 0 ? `(${brandCounts.NB})` : ''}`}
            value="NB"
            sx={{ fontWeight: 'bold' }}
          />
        </Tabs>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => {
            if (newMode) setViewMode(newMode);
            if (newMode === 'timeline') {
              // 타임라인 진입시 오늘 날짜로 포커스 이동을 제안 (현재는 뷰상에서만 움직임 처리)
              // 원한다면 setTimelineDate(new Date()) 추가
            }
          }}
          size="small"
        >
          <ToggleButton value="list" sx={{ px: 2, py: 0.5, fontSize: '0.85rem' }}>리스트</ToggleButton>
          <ToggleButton value="timeline" sx={{ px: 2, py: 0.5, fontSize: '0.85rem' }}>타임라인</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>상태</InputLabel>
            <Select
              value={statusFilter}
              label="상태"
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="all">전체 상태</MenuItem>
              <MenuItem value="준비중">준비중</MenuItem>
              <MenuItem value="부품준비">부품준비</MenuItem>
              <MenuItem value="준비완료">준비완료</MenuItem>
              <MenuItem value="출고대기">출고대기</MenuItem>
              <MenuItem value="반품완료">반품완료</MenuItem>
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

              <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap', mb: { xs: 1, sm: 0 } }}>
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('lastWeek')}>지난주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
                <Button onClick={() => handleQuickDateFilter('thisYear')}>올해</Button>
              </ButtonGroup>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => {
                      handleDateFilterChange('startDate', newValue && isValid(newValue) ? format(newValue, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { width: 140 }
                      }
                    }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => {
                      handleDateFilterChange('endDate', newValue && isValid(newValue) ? format(newValue, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { width: 140 }
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
      </Box>

      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} useFlexGap flexWrap="wrap">
          {(dateFilter.startDate || dateFilter.endDate) && (
            <Chip
              label={`${dateFilter.startDate || '—'} ~ ${dateFilter.endDate || '—'}`}
              size="small"
              variant="outlined"
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          )}
          <TextField
            placeholder="고객명, 연락처, 제품명, 출고ID로 검색"
            variant="outlined"
            size="small"
            value={inputValue}
            onChange={handleSearchInput}
            onKeyPress={handleKeyPress}
            sx={{
              flex: { xs: '1 1 100%', sm: '0 1 400px' },
              width: { xs: '100%', sm: 'auto' },
              maxWidth: { xs: '100%', sm: 400 },
              minWidth: { xs: 'auto', sm: 200 }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant="contained"
              onClick={executeSearch}
              size="small"
              sx={{ flex: { xs: 1, sm: 'none' } }}
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
              sx={{ flex: { xs: 1, sm: 'none' } }}
            >
              초기화
            </Button>
          </Box>
        </Stack>
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
      {(false || false) && !loading && (
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
                  {false ? '다음 페이지 로딩 중...' : '추가 데이터 로딩 중...'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {shipments.length}/{hasActiveSearch ? shipments.length : totalExpected}건
                  {0 > 0 && ` (${Math.round(0)}%)`}
                  {false && ` • 청크 ${0 + 1} 로딩`}
                </Typography>
              </Box>
            </Box>
            {0 > 0 && (
              <LinearProgress
                variant="determinate"
                value={0}
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

      {viewMode === 'timeline' ? (
        renderTimeline()
      ) : (
        <>
          {shipments.length === 0 ? (
            <Typography align="center" sx={{ mt: 3 }}>
              {searchTerm || statusFilter !== 'all' || sellerFilter !== 'all' || dateFilter.startDate || dateFilter.endDate ?
                '검색 조건에 맞는 출고 정보가 없습니다.' :
                '등록된 출고 정보가 없습니다.'}
            </Typography>
          ) : (
            <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650, width: '100%', tableLayout: 'fixed', border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell width="8%">주문일자</TableCell>
                    <TableCell width="8%">출고일자</TableCell>
                    <TableCell width="9%">고객명</TableCell>
                    <TableCell width="10%">연락처</TableCell>
                    <TableCell width="16%">제품정보</TableCell>
                    <TableCell width="8%">판매처</TableCell>
                    <TableCell width="13%">출고처</TableCell>
                    <TableCell width="16%">배송정보</TableCell>
                    <TableCell width="7%">상태</TableCell>
                    <TableCell width="5%">관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shipments
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
                          <Tooltip
                            title={
                              <Box sx={{ p: 0.5 }}>
                                {getSortedProducts(shipment).map((item, idx) => (
                                  <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                                    • {item.name} {item.quantity}개
                                  </Typography>
                                ))}
                                <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.2)' }} />
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                  총 수량: {shipment.quantity}개
                                </Typography>
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, cursor: 'pointer' }}>
                              <Typography noWrap sx={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                {(() => {
                                  const products = getSortedProducts(shipment);
                                  if (products.length === 0) return '-';
                                  if (products.length === 1) return products[0].name;
                                  return `${products[0].name} 외 ${products.length - 1}건`;
                                })()}
                              </Typography>
                            </Box>
                          </Tooltip>
                          <Typography variant="body2" color="text.secondary">
                            {shipment.quantity}개 / {shipment.price?.toLocaleString()}원
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const salesChannel = getSalesChannel(shipment.note);
                            const colorInfo = getChannelColorInfo(salesChannel);

                            return (
                              <Chip
                                label={salesChannel}
                                size="small"
                                sx={{
                                  backgroundColor: colorInfo.bg,
                                  color: colorInfo.color,
                                  borderColor: colorInfo.border,
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  fontWeight: 600,
                                  fontSize: '0.75rem'
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const wh = warehouses.find(w => w.id === shipment.warehouse_id);
                            const whName = wh ? wh.name : (shipment.warehouse_id ? '알수없음' : '-');
                            const orderNum = shipment.note ? (shipment.note.match(/\[주문:(.*?)\]/)?.[1] || shipment.note.match(/20\d{6}-\d{7}/)?.[0] || `SHP-${shipment.id.slice(0, 8).toUpperCase()}`) : `SHP-${shipment.id.slice(0, 8).toUpperCase()}`;
                            return (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>{whName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', lineHeight: 1.1 }}>
                                  {orderNum}
                                </Typography>
                              </Box>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const delColor = getDeliveryColorInfo(shipment.delivery_method);

                            return (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                                <Chip
                                  label={shipment.delivery_method || '미지정'}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    bgcolor: delColor.bg,
                                    color: delColor.color,
                                    fontWeight: 600
                                  }}
                                />
                                {shipment.tracking_number ? (
                                  <Typography variant="caption" sx={{ color: '#1976d2', fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.5px' }}>
                                    {shipment.tracking_number}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    송장번호 없음
                                  </Typography>
                                )}
                              </Box>
                            );
                          })()}
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
                count={hasActiveSearch ? shipments.length : Math.max(shipments.length, totalExpected)}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[30, 50, 100]}
                labelRowsPerPage="페이지당 행 수"
                labelDisplayedRows={({ from, to, count }) =>
                  `${count}개 중 ${from}-${to}`
                }
              />
            </TableContainer>
          )}
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          top: '50% !important',
          transform: 'translateY(-50%)'
        }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
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
                  데이터 처리 중... {up0}%
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
                      width: `${up0}%`,
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
                  • 출고일이 지정된 항목은 '출고완료' 상태로, 그렇지 않은 항목은 '접수' 상태로 등록됩니다.
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