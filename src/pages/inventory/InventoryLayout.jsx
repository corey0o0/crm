import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ExcelJS from 'exceljs';
import BarcodeInspectTab from '../../components/Inventory/tabs/BarcodeInspectTab';
import StoreOnlineOutboundTab from '../../components/Inventory/tabs/StoreOnlineOutboundTab';
import BoxStatusTab from '../../components/Inventory/tabs/BoxStatusTab';
import Cafe24InventoryReconciliation from '../../components/Inventory/Cafe24InventoryReconciliation';
import {
  Container,
  Stack,
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  Badge,
  Autocomplete,
  Pagination,
  InputAdornment,
  Popover,
  Checkbox,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  ButtonGroup,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Inventory as InventoryIcon,
  Store as StoreIcon,
  LocalShipping as ShippingIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
  GetApp as GetAppIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  Close as CloseIcon,
  ArrowDownward as ArrowDownwardIcon,
  QrCodeScanner as QrCodeScannerIcon
} from '@mui/icons-material';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import LocationManagement from '../../components/Inventory/LocationManagement';
import BarcodeScanner from '../../components/Inventory/BarcodeScanner';
import { productApi } from '../../api/productApi';
import { warehouseApi } from '../../api/warehouseApi';
import { agencyApi as dealerApi } from '../../api/agencyApi';
import { transactionApi } from '../../api/transactionApi';
import { inventoryApi } from '../../api/inventoryApi';
import { supabase } from '../../lib/supabaseClient';
import { fetchFromSupabase } from '../../utils/restApiUtils';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { logAction, logActions } from '../../utils/auditLog';
import { checkAndSendLowStockAlerts } from '../../utils/inventoryAlert';

// 창고 및 대리점 코드를 숨기고 이름만 표시하는 유틸리티
const formatLocationName = (locationId, warehouses, dealers) => {
  if (!locationId || locationId === '외부') return '외부';
  if (locationId === 'adjustment') return '재고 조정';
  if (locationId === 'direct_edit') return '직접 수정';
  const warehouse = warehouses.find(w => w.id === locationId);
  if (warehouse) return warehouse.name;
  const dealer = dealers.find(d => d.id === locationId);
  if (dealer) return dealer.name;
  // 문자열 자체에 코드가 괄호로 포함된 경우 제거 (예: 청담 반포 (W002) -> 청담 반포)
  return String(locationId).replace(/\s*\([A-Za-z0-9_-]+\)$/, '').trim();
};

function InventoryLayout() {
  const [openDialog, setOpenDialog] = useState(false);
  // 창고별 상세 재고 Dialog 상태
  const [warehouseDetailOpen, setWarehouseDetailOpen] = useState(false);
  const [warehouseDetailTarget, setWarehouseDetailTarget] = useState(null); // { id, name }
  const [warehouseDetailSearch, setWarehouseDetailSearch] = useState('');
  const [warehouseDetailFilter, setWarehouseDetailFilter] = useState('inStock'); // 'all', 'inStock', 'outOfStock', 'below'
  const [warehouseDetailBelow, setWarehouseDetailBelow] = useState(5); // N개 미만 임계값
  
  // 대리점별 통계 필터
  const [dealerStatsFilter, setDealerStatsFilter] = useState({
    period: 'month', // 'day', 'week', 'month', 'year'
    dateFrom: '',
    dateTo: '',
    dealer: ''
  });

  // 전체보기(창고 x 상품 매트릭스) 검색
  const [overallSearch, setOverallSearch] = useState('');
  const [overallStockFilter, setOverallStockFilter] = useState('all'); // 기본: 전체

  // 엑셀 업로드 관련 상태
  const [excelUploadOpen, setExcelUploadOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [showOriginalHistory, setShowOriginalHistory] = useState(false);

  // 거래내역 보기 모드: 'list' | 'table'
  const [transactionViewMode, setTransactionViewMode] = useState('list');
  
  // 표보기 클릭된 거래 모달 상태
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [selectedTableTransactions, setSelectedTableTransactions] = useState([]);
  
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  
  const handleDeleteSelectedTransactions = async () => {
    if (selectedTransactions.length === 0) return;
    if (!window.confirm(`선택한 ${selectedTransactions.length}개의 거래내역을 삭제하시겠습니까?\n※ 삭제 시 해당 거래로 인한 재고 변동이 자동으로 복구됩니다.`)) return;
    try {
      // 1. 삭제 대상 트랜잭션들을 수집하여 재고 역방향 복구 준비
      const reverseTransactions = [];
      for (const selectedId of selectedTransactions) {
        const itemsInGroup = transactions.filter(t => t.groupId != null && String(t.groupId) === String(selectedId));
        if (itemsInGroup.length > 0) {
          itemsInGroup.forEach(item => {
            reverseTransactions.push({
              ...item,
              // 타입을 반전시켜 재고를 되돌림 (출고→입고, 입고→출고)
              type: item.type === 'out' ? 'in' : 'out',
              // from/to 위치 교환
              fromLocation: item.toLocation,
              toLocation: item.fromLocation,
            });
          });
        } else {
          // 단일 거래인 경우 — transactions state에서 직접 찾기
          const singleTx = transactions.find(t => String(t.id) === String(selectedId));
          if (singleTx) {
            reverseTransactions.push({
              ...singleTx,
              type: singleTx.type === 'out' ? 'in' : 'out',
              fromLocation: singleTx.toLocation,
              toLocation: singleTx.fromLocation,
            });
          }
        }
      }

      // 2. 재고 역방향 복구 (삭제 전에 수행)
      if (reverseTransactions.length > 0) {
        try {
          await batchUpdateInventory(reverseTransactions);
        } catch (revertErr) {
          console.warn('재고 복구 중 경고:', revertErr.message);
          // 재고 복구 실패해도 삭제는 계속 진행 (로그만 남김)
        }
      }

      // 3. 거래내역 삭제
      for (const selectedId of selectedTransactions) {
        const itemsInGroup = transactions.filter(t => t.groupId != null && String(t.groupId) === String(selectedId));
        if (itemsInGroup.length > 0) {
          await transactionApi.deleteByGroupId(selectedId);
        } else {
          await transactionApi.delete(selectedId);
        }
      }
      
      const updatedTransactions = await transactionApi.getAll();
      setTransactions(updatedTransactions);
      setSelectedTransactions([]);
      
      setTimeout(() => {
        fetchInventoryData();
      }, 100);
      
      showSnackbar(`선택한 거래내역이 삭제되고 재고가 복구되었습니다.`, 'success');

      // 감사 로그: 삭제된 거래 내역 기록 (삭제 전 데이터 스냅샷 보존)
      try {
        const deleteLogs = reverseTransactions.map(rt => ({
          action: '삭제',
          targetTable: 'inventory_transactions',
          targetId: rt.groupId || rt.id,
          summary: `[입출고 삭제] ${rt.productName} x ${rt.quantity}개 (${formatLocationName(rt.toLocation, warehouses, dealers)}→${formatLocationName(rt.fromLocation, warehouses, dealers)})`,
          details: { original: rt, reversed: true },
          groupId: rt.groupId || null
        }));
        logActions(deleteLogs);
      } catch (logErr) {
        console.warn('[AuditLog] 삭제 로그 기록 실패:', logErr);
      }
    } catch (error) {
      console.error('거래내역 선택 삭제 실패:', error);
      showSnackbar('거래내역 삭제에 실패했습니다.', 'error');
    }
  };

  // 표보기 마우스 오버 팝오버 상태
  const [hoverAnchorEl, setHoverAnchorEl] = useState(null);
  const [hoverTransactions, setHoverTransactions] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [excelUploadType, setExcelUploadType] = useState(''); // 'in' | 'out'
  
  // 거래내역 상세 Dialog 상태
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editProducts, setEditProducts] = useState([]);
  const [dialogType, setDialogType] = useState(''); // 'in' | 'out'
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState({});
  const [pendingInventory, setPendingInventory] = useState({});
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // 동적 창고 및 대리점 상태
  const [warehouses, setWarehouses] = useState([]);
  const [dealers, setDealers] = useState([]);

  // 입출고 폼 데이터
  const [formData, setFormData] = useState({
    type: 'in', // 'in' | 'out'
    productId: '',
    quantity: '',
    fromLocation: '',
    toLocation: '',
    note: '',
    date: new Date().toISOString().split('T')[0]
  });

  // 다중 상품 입출고용 단일 데이터 (통합)
  const [multipleIoProducts, setMultipleIoProducts] = useState([
    {
      id: Date.now(),
      productId: '',
      quantity: '',
      fromLocation: '', // '' 또는 '외부'는 신규입고로 간주
      toLocation: '',   // 필수: 창고/대리점/창고 간 이동 목적지
      note: '',
      additionalNote: ''
    }
  ]);

  const [batchFromLocation, setBatchFromLocation] = useState('');
  const [batchToLocation, setBatchToLocation] = useState('');

  // 상품 데이터
  const [products, setProducts] = useState([]);

  const [filter, setFilter] = useState(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - today.getDay());
    return {
      dateFrom: weekAgo.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
      fromLocation: '',
      toLocation: '',
      product: '',
      note: '',
      type: 'all',
      sortBy: 'date',
      sortOrder: 'desc'
    };
  });

  // 날짜 필터 버튼 상태
  const [dateFilter, setDateFilter] = useState('week');
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50); // 페이지당 50개 항목
  
  // 바코드 스캔 상태
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [currentScanningRow, setCurrentScanningRow] = useState(null); // 현재 스캔 중인 행 인덱스
  
  // 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const handleViewOriginal = async () => {
    if (!selectedTransaction) return;
    const groupId = selectedTransaction.group_id || selectedTransaction.id;
    if (!groupId || groupId === 'none') {
      setSnackbar({ open: true, message: '원본 전표를 찾을 수 없는 단일 입출고 건입니다.', severity: 'warning' });
      return;
    }
    
    // UUID 형식 검사
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(groupId);
    
    if (isUuid) {
       // shipments 테이블에서 note 필드로 수기판매 여부 확인
       const { data: shipData } = await supabase.from('shipments').select('id, note').eq('id', groupId).single();
       if (shipData) {
         const isManualB2B = shipData.note && String(shipData.note).includes('[수기판매]');
         if (isManualB2B) {
           // 수기 판매(B2B) → 편집 페이지로 이동
           navigate(`/sales/manual/edit/${groupId}`);
         } else {
           // 일반 매장출고 → 상세 페이지로 이동
           navigate(`/shipment/${groupId}`);
         }
         return;
       }
    }
    
    // 숫자 형식 (A/S) 확인
    if (/^\d+$/.test(String(groupId))) {
       const { data: asData } = await supabase.from('services').select('id').eq('id', groupId).single();
       if (asData) {
         navigate(`/service/${groupId}`);
         return;
       } else if (selectedTransaction.note && selectedTransaction.note.includes('[A/S 취소]')) {
         setSnackbar({ open: true, message: '취소(삭제)되어 원본이 더 이상 존재하지 않는 A/S 전표입니다.', severity: 'info' });
         return;
       }
    }
    
    // Cafe24 주문 확인 (예: 2024, 2025 등 숫자로 시작하는 주문번호)
    if (/^20\d{2}/.test(String(groupId)) || String(groupId).includes('-')) {
       navigate(`/sales/cafe24`); 
       return;
    }
    
    setSnackbar({ open: true, message: '원본 전표를 찾을 수 없습니다.', severity: 'warning' });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'outbound_scan') {
      navigate('/inventory-management/scan', { replace: true });
    } else if (tabParam === 'inventory_status') {
      navigate('/inventory-management/status', { replace: true });
    } else if (tabParam === 'inventory_stats') {
      navigate('/inventory-management/history', { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    // API 호출을 병렬로 실행하여 초기 로딩 속도 개선
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchProducts(),
          fetchWarehouses(),
          fetchDealers()
        ]);
      } catch (error) {
        console.error('초기 데이터 로딩 실패:', error);
      }
    };
    
    loadInitialData();
  }, []);

  useEffect(() => {
    if (products.length > 0 && warehouses.length > 0) {
      fetchTransactions();
    }
  }, [products, warehouses]);

  useEffect(() => {
    if (products.length > 0 && warehouses.length > 0) {
      // 컴포넌트 마운트 및 기초 데이터 로딩 완료 시 서버에서 재고 조회
      const timer = setTimeout(() => {
        fetchInventoryData();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [warehouses, dealers, products]);

  // 상품 데이터 가져오기 (상품관리와 연동)
  const fetchProducts = async () => {
    try {
      // 오프라인 상태 체크
      if (isOffline()) {
        console.log('[InventoryManagement] 오프라인 상태 - 상품 데이터 로딩 건너뛰기');
        showSnackbar('오프라인 상태입니다. 인터넷 연결을 확인해주세요.', 'error');
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // 안전한 재시도 로직 적용
      const productsData = await safeRetry(async () => {
        return await productApi.getAll();
      }, {
        maxRetries: 3,
        maxTime: 30000,
        baseDelay: 1000
      });
      
      setProducts(productsData);
      console.log(`상품관리에서 ${productsData.length}개의 전체 상품을 가져왔습니다.`);
    } catch (error) {
      console.error('상품 데이터 로딩 실패:', error);
      
      // 스마트 오류 처리
      const errorMessage = getErrorMessage(error);
      showSnackbar(`상품관리에서 상품 데이터를 불러오는데 실패했습니다: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 창고 데이터 가져오기
  const fetchWarehouses = async () => {
    try {
      const warehousesData = await warehouseApi.getAll();
      setWarehouses(warehousesData);
      console.log(`서버에서 ${warehousesData.length}개의 창고를 가져왔습니다.`);
    } catch (error) {
      console.error('창고 데이터 로딩 실패:', error);
      showSnackbar('창고 데이터를 불러오는데 실패했습니다.', 'error');
    }
  };

  // 대리점 데이터 가져오기
  const fetchDealers = async () => {
    try {
      const dealersData = await dealerApi.getAll();
      setDealers(dealersData);
      console.log(`서버에서 ${dealersData.length}개의 대리점을 가져왔습니다.`);
    } catch (error) {
      console.error('대리점 데이터 로딩 실패:', error);
      showSnackbar('대리점 데이터를 불러오는데 실패했습니다.', 'error');
    }
  };

  // 재고 초기화 (창고별 재고만 관리, 대리점은 출고 기록만)
  const initializeInventory = () => {
    const initialInventory = {};
    
    // 창고별 재고 초기화 (실제 재고 관리)
    warehouses.forEach(warehouse => {
      initialInventory[warehouse.id] = {};
      products.forEach(product => {
        if (warehouse.syncWithProductStock) {
          // 상품 관리의 실제 재고 사용 (창고 A)
          initialInventory[warehouse.id][product.id] = product.stock || 0;
          console.log(`창고 ${warehouse.name}: ${product.name} 재고 ${product.stock}개로 연동`);
        } else {
          // 독립적인 창고 재고 (창고 B, C) - 실제 재고의 일정 비율로 설정
          const baseStock = product.stock || 0;
          const randomStock = Math.floor(baseStock * (0.3 + Math.random() * 0.4)); // 30-70% 범위
          initialInventory[warehouse.id][product.id] = randomStock;
        }
      });
    });

    // 대리점은 재고를 별도로 관리하지 않음 (출고 기록만 추적)
    
    setInventory(initialInventory);
  };

  // 날짜 필터 버튼 클릭 처리 (useCallback으로 메모이제이션)
  const handleDateFilterClick = useCallback((filterType) => {
    setDateFilter(filterType);
    
    const today = new Date();
    let dateFrom = '';
    let dateTo = '';
    
    switch (filterType) {
      case 'today':
        dateFrom = today.toISOString().split('T')[0];
        dateTo = today.toISOString().split('T')[0];
        break;
      case 'week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        dateFrom = startOfWeek.toISOString().split('T')[0];
        dateTo = today.toISOString().split('T')[0];
        break;
      case 'month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFrom = startOfMonth.toISOString().split('T')[0];
        dateTo = today.toISOString().split('T')[0];
        break;
      case 'prevMonth':
        const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        dateFrom = prevMonthStart.toISOString().split('T')[0];
        dateTo = prevMonthEnd.toISOString().split('T')[0];
        break;
      default:
        dateFrom = '';
        dateTo = '';
    }
    
    setFilter(prev => ({
      ...prev,
      dateFrom,
      dateTo
    }));
  }, []);

  // 표보기 셀 클릭 시 해당 거래들을 모달로 표시 (useCallback으로 메모이제이션)
  const handleTableCellClick = useCallback((warehouseId, productId, date) => {
    const dayTransactions = transactions.filter(tx => {
      if (!tx || !tx.date) return false;
      const txDate = typeof tx.date === 'string' ? tx.date.split('T')[0] : new Date(tx.date).toISOString().split('T')[0];
      return txDate === date && 
             (tx.toLocation === warehouseId || tx.fromLocation === warehouseId) &&
             tx.productId === productId;
    });
    
    if (dayTransactions.length > 0) {
      setSelectedTableTransactions(dayTransactions);
      setTableModalOpen(true);
    }
  }, [transactions]);

  // 표보기 셀 마우스 오버 시 해당 거래들을 팝오버로 표시
  const handleTableCellHover = useCallback((event, warehouseId, productId, date) => {
    const dayTransactions = transactions.filter(tx => {
      if (!tx || !tx.date) return false;
      const txDate = typeof tx.date === 'string' ? tx.date.split('T')[0] : new Date(tx.date).toISOString().split('T')[0];
      return txDate === date && 
             (tx.toLocation === warehouseId || tx.fromLocation === warehouseId) &&
             tx.productId === productId;
    });
    
    if (dayTransactions.length > 0) {
      setHoverTransactions(dayTransactions);
      setHoverAnchorEl(event.currentTarget);
    }
  }, [transactions]);

  const handleTableCellHoverLeave = useCallback(() => {
    setHoverAnchorEl(null);
    setHoverTransactions([]);
  }, []);

  // 서버 DB(inventory 테이블)에서 최신 재고 데이터를 단일 진실 공급원(SSOT)으로 조회
  const fetchInventoryData = async () => {
    try {
      // 1) inventory 테이블에서 최신 재고 직접 조회
      const invData = await inventoryApi.getAll();
      const newInventory = {};
      
      // 창고별 재고 객체 초기화
      warehouses.forEach(warehouse => {
        newInventory[warehouse.id] = {};
        products.forEach(product => {
          newInventory[warehouse.id][product.id] = 0;
        });
      });
      
      // DB 데이터를 로컬 state로 매핑
      invData.forEach(row => {
        if (!newInventory[row.warehouse_id]) {
          newInventory[row.warehouse_id] = {};
        }
        newInventory[row.warehouse_id][row.product_id] = row.quantity;
      });
      
      // 2) 출고 대기 수량 집계를 위해 status='대기'인 트랜잭션만 가볍게 조회
      const { data: pendingTxs, error } = await supabase
        .from('transactions')
        .select('from_location, product_id, quantity, type')
        .eq('status', '대기');
        
      if (error) {
        console.error('대기 트랜잭션 조회 에러:', error);
        showSnackbar('대기 트랜잭션 조회 중 오류가 발생했습니다.', 'error');
        throw error;
      }
        
      const newPendingInventory = {};
      warehouses.forEach(warehouse => {
        newPendingInventory[warehouse.id] = {};
        products.forEach(product => {
          newPendingInventory[warehouse.id][product.id] = 0;
        });
      });

      if (pendingTxs) {
        pendingTxs.forEach(tx => {
          if (tx.type === 'out' && warehouses.find(w => w.id === tx.from_location)) {
            const qty = Number(tx.quantity) || 0;
            if (!newPendingInventory[tx.from_location]) {
              newPendingInventory[tx.from_location] = {};
            }
            newPendingInventory[tx.from_location][tx.product_id] = 
              (newPendingInventory[tx.from_location][tx.product_id] || 0) + qty;
          }
        });
      }

      setInventory(newInventory);
      setPendingInventory(newPendingInventory);
      console.log('서버 DB(inventory)에서 최신 재고 정보를 성공적으로 불러왔습니다.');
      return newInventory; // 최신 재고 데이터 반환
    } catch (error) {
      console.error('재고 정보 로딩 실패:', error);
      showSnackbar('재고 정보 로딩 중 오류가 발생했습니다.', 'error');
      return null;
    }
  };

  // 위치 업데이트 콜백 (LocationManagement에서 호출)
  const handleLocationUpdate = async () => {
    // 서버에서 최신 창고 정보 다시 불러오기
    try {
      await fetchWarehouses();
      await fetchDealers();
      // 재고도 다시 초기화
      setTimeout(() => {
        fetchInventoryData();
      }, 100);
    } catch (error) {
      console.error('위치 정보 업데이트 실패:', error);
    }
  };

  // 창고 재고 연동 설정 토글
  const toggleWarehouseSync = async (warehouseId) => {
    try {
      const warehouse = warehouses.find(w => w.id === warehouseId);
      if (!warehouse) return;
      
      const newSyncState = !warehouse.syncWithProductStock;
      
      // 서버에서 창고 정보 업데이트
      await warehouseApi.update(warehouseId, {
        syncWithProductStock: newSyncState,
        stockSync: newSyncState
      });
      
      setWarehouses(prev => {
        const updatedWarehouses = prev.map(w => {
          if (w.id === warehouseId) {
            return {
              ...w,
              syncWithProductStock: newSyncState,
              stockSync: newSyncState
            };
          }
          return w;
        });
        return updatedWarehouses;
      });
      
      showSnackbar(
        `${warehouse.name}의 재고 연동이 ${newSyncState ? '활성화' : '비활성화'}되었습니다.`, 
        'success'
      );
      
      // 연동 상태 변경 시 재고 재초기화
      setTimeout(() => {
        fetchInventoryData();
      }, 100);
    } catch (error) {
      console.error('창고 연동 설정 변경 실패:', error);
      showSnackbar('창고 연동 설정 변경에 실패했습니다.', 'error');
    }
  };

  // 창고 상세 열기
  const openWarehouseDetail = (warehouse) => {
    setWarehouseDetailTarget(warehouse);
    setWarehouseDetailSearch('');
    setWarehouseDetailOpen(true);
  };

  const closeWarehouseDetail = () => {
    setWarehouseDetailOpen(false);
    setWarehouseDetailTarget(null);
  };

  // 거래내역 상세 열기/닫기
  const openTransactionDetail = (transaction) => {
    setSelectedTransaction(transaction);
    setTransactionDetailOpen(true);
  };

  const closeTransactionDetail = () => {
    setTransactionDetailOpen(false);
    setSelectedTransaction(null);
    setEditMode(false);
    setEditFormData({});
  };

  // 거래내역 수정 모드 시작
  const startEditTransaction = () => {
    if (selectedTransaction) {
      setEditFormData({
        date: selectedTransaction.date || '',
        note: selectedTransaction.note || '',
        fromLocation: selectedTransaction.fromLocation || '',
        toLocation: selectedTransaction.toLocation || ''
      });
      
      // 상품 정보 초기화
      if (selectedTransaction.items && selectedTransaction.items.length > 0) {
        setEditProducts(selectedTransaction.items.map(item => ({
          product: products.find(p => p.code === item.productCode) || null,
          quantity: item.quantity,
          fromLocation: item.fromLocation,
          toLocation: item.toLocation,
          note: item.note || '',
          additionalNote: item.additionalNote || ''
        })));
      } else {
        // 개별 거래인 경우
        setEditProducts([{
          product: products.find(p => p.code === selectedTransaction.productCode) || null,
          quantity: selectedTransaction.quantity,
          fromLocation: selectedTransaction.fromLocation,
          toLocation: selectedTransaction.toLocation,
          note: selectedTransaction.note || '',
          additionalNote: ''
        }]);
      }
      
      setEditMode(true);
    }
  };

  // 거래내역 수정 취소
  const cancelEditTransaction = () => {
    setEditMode(false);
    setEditFormData({});
    setEditProducts([]);
  };

  // 수정 모드에서 상품 추가
  const addEditProduct = () => {
    setEditProducts([...editProducts, {
      product: null,
      quantity: 1,
      fromLocation: editFormData.fromLocation || '',
      toLocation: editFormData.toLocation || '',
      note: '',
      additionalNote: ''
    }]);
  };

  // 수정 모드에서 상품 삭제 (마지막 1개여도 삭제 가능)
  const removeEditProduct = (index) => {
    setEditProducts(prev => prev.filter((_, i) => i !== index));
  };

  // 수정 모드에서 상품 정보 업데이트
  const updateEditProduct = (index, field, value) => {
    const updated = [...editProducts];
    updated[index] = { ...updated[index], [field]: value };
    setEditProducts(updated);
  };

  // 거래내역 수정 저장 (useCallback으로 메모이제이션)
  const saveEditTransaction = useCallback(async () => {
    if (!selectedTransaction) return;

    try {
      const isGroup = Array.isArray(selectedTransaction.items) && selectedTransaction.items.length >= 1;
      if (isGroup) {
        // 그룹 편집: 기존 그룹 삭제 후 재생성 (롤백 지원)
        const groupId = selectedTransaction.groupId || selectedTransaction.id;

        const baseDate = editFormData.date || selectedTransaction.date;
        const baseNote = editFormData.note || selectedTransaction.note || null;
        const txType = selectedTransaction.type;

        const commonNote = (editFormData.note ?? '').toString().trim();
        const newRows = editProducts
          .filter(it => it.product && it.quantity)
          .map((item, idx) => ({
            id: groupId + idx,
            groupId,
            type: txType,
            productId: parseInt(item.product.id, 10),
            productName: item.product.name,
            productCode: item.product.code || null,
            productSupplier: item.product.supplier || '-',
            quantity: parseInt(item.quantity, 10) || 0,
            fromLocation: item.fromLocation || null,
            toLocation: item.toLocation || null,
            date: baseDate,
            note: (commonNote !== '' ? commonNote : ((item.note ?? '').toString().trim() || baseNote)),
            additionalNote: item.additionalNote || null,
            createdAt: new Date().toISOString(),
            isGrouped: true
          }));

        if (newRows.length === 0) {
          showSnackbar('저장할 상품이 없습니다.', 'error');
          return;
        }

        // 원본 백업 후 삭제 → 재생성, 실패 시 롤백
        const backupItems = selectedTransaction.items.map(it => ({
          groupId: it.groupId,
          type: it.type,
          productId: it.productId,
          productName: it.productName,
          productCode: it.productCode,
          productSupplier: it.productSupplier,
          quantity: it.quantity,
          fromLocation: it.fromLocation,
          toLocation: it.toLocation,
          date: it.date,
          note: it.note,
          additionalNote: it.additionalNote,
          isGrouped: it.isGrouped,
          status: it.status
        }));

        await transactionApi.deleteByGroupId(groupId);

        try {
          await transactionApi.createMany(newRows);
        } catch (createErr) {
          // 재생성 실패 시 원본 복원
          console.error('거래내역 재생성 실패, 원본 복원 시도:', createErr);
          try {
            await transactionApi.createMany(backupItems);
            showSnackbar('수정에 실패하여 원본을 복원했습니다.', 'error');
          } catch (restoreErr) {
            console.error('원본 복원도 실패:', restoreErr);
            showSnackbar('수정 및 복원 모두 실패했습니다. 관리자에게 문의하세요.', 'error');
          }
          return;
        }
      } else {
        // 단일 편집: 단일 트랜잭션 업데이트
        const item = editProducts[0];
        const payload = {
          ...selectedTransaction,
          type: selectedTransaction.type,
          productId: parseInt(item.product?.id ?? selectedTransaction.productId, 10),
          productName: item.product?.name ?? selectedTransaction.productName,
          productCode: item.product?.code ?? selectedTransaction.productCode ?? null,
          productSupplier: item.product?.supplier ?? selectedTransaction.productSupplier ?? '-',
          quantity: parseInt(item.quantity ?? selectedTransaction.quantity, 10) || 0,
          fromLocation: item.fromLocation ?? selectedTransaction.fromLocation ?? null,
          toLocation: item.toLocation ?? selectedTransaction.toLocation ?? null,
          date: editFormData.date || selectedTransaction.date,
          note: ((editFormData.note ?? '').toString().trim() !== '')
            ? (editFormData.note).toString()
            : (((item.note ?? '').toString().trim() !== '') ? item.note : (selectedTransaction.note || null)),
          additionalNote: item.additionalNote ?? selectedTransaction.additionalNote ?? null,
          isGrouped: false
        };
        await transactionApi.update(selectedTransaction.id, payload);
      }

      // 수정 후 전체 재고 재계산으로 일관성 보장 (조용히 실행)
      await recalculateAllInventory(true);

      // 서버에서 최신 거래내역 다시 반영
      const latest = await transactionApi.getAll();
      setTransactions(latest);
      // 선택된 거래 초기화
      setSelectedTransaction(null);

      setEditMode(false);
      setEditFormData({});
      setEditProducts([]);
      showSnackbar('거래내역이 수정되었습니다.', 'success');

      // 감사 로그: 거래내역 수정
      try {
        await logAction({
          action: '수정',
          targetTable: 'inventory_transactions',
          targetId: selectedTransaction.groupId || selectedTransaction.id,
          summary: `[입출고 수정] 그룹 ${selectedTransaction.groupId || selectedTransaction.id}`,
          details: { before: selectedTransaction, after: editProducts },
          groupId: selectedTransaction.groupId || null
        });
      } catch (logErr) {
        console.warn('[AuditLog] 수정 로그 실패:', logErr);
      }

      // 상세 모달 닫기
      closeTransactionDetail();
    } catch (error) {
      console.error('거래내역 수정 실패:', error);
      showSnackbar('거래내역 수정에 실패했습니다.', 'error');
    }
  }, [selectedTransaction, editFormData, editProducts]);

  // 거래내역 삭제 (useCallback으로 메모이제이션)
  const deleteTransaction = useCallback(async (transactionId) => {
    try {
      // 서버에서 거래내역 삭제
      await transactionApi.delete(transactionId);
      
      // 삭제 후 전체 재고 재계산으로 일관성 보장 (조용히 실행)
      await recalculateAllInventory(true);

      // 서버에서 최신 거래내역 다시 가져오기
      const updatedTransactions = await transactionApi.getAll();
      setTransactions(updatedTransactions);
      
      showSnackbar('거래내역이 삭제되었습니다.', 'success');

      // 감사 로그: 단건 거래 삭제
      try {
        await logAction({
          action: '삭제',
          targetTable: 'inventory_transactions',
          targetId: transactionId,
          summary: `[입출고 삭제] 거래 ID: ${transactionId}`,
          details: { transactionId }
        });
      } catch (logErr) {
        console.warn('[AuditLog] 단건 삭제 로그 실패:', logErr);
      }
    } catch (error) {
      console.error('거래내역 삭제 실패:', error);
      showSnackbar('거래내역 삭제에 실패했습니다.', 'error');
    }
  }, []);

  // 재고 수동 동기화
  const syncWarehouseStock = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    if (!warehouse || !warehouse.syncWithProductStock) return;

    setInventory(prev => {
      const newInventory = { ...prev };
      if (!newInventory[warehouseId]) newInventory[warehouseId] = {};
      
      let syncCount = 0;
      products.forEach(product => {
        const oldStock = newInventory[warehouseId][product.id] || 0;
        const newStock = product.stock || 0;
        if (oldStock !== newStock) {
          newInventory[warehouseId][product.id] = newStock;
          syncCount++;
        }
      });
      
      if (syncCount > 0) {
        showSnackbar(`${warehouse.name}에서 ${syncCount}개 상품의 재고가 동기화되었습니다.`, 'success');
      } else {
        showSnackbar(`${warehouse.name}의 모든 재고가 이미 동기화되어 있습니다.`, 'info');
      }
      
      return newInventory;
    });
  };

  // 상품관리 상품 데이터 새로고침
  const refreshProductsFromPartsManagement = async () => {
    try {
      setLoading(true);
      const latestProducts = await productApi.getAll();
      setProducts(latestProducts);
      
      // 새로운 상품이 추가되었거나 기존 상품이 변경된 경우 재고 재초기화
      setTimeout(() => {
        initializeInventory();
      }, 100);
      
      showSnackbar(`상품관리 모듈에서 최신 전체 상품 데이터를 동기화했습니다. (총 ${latestProducts.length}개)`, 'success');
    } catch (error) {
      console.error('상품 데이터 새로고침 실패:', error);
      showSnackbar('상품관리 데이터 새로고침에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 기존 'reset-all' 내역들(5월 12일 등)이 개별로 저장되어 있는 것을 500개씩 DB에서 묶어주는 일회성 작업
  const fixLegacyResetGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, group_id')
        .like('group_id', 'reset-all-%')
        .eq('date', '2026-05-12');
      
      if (!error && data) {
        const unchunked = data.filter(t => !t.group_id.includes('chunk'));
        if (unchunked.length > 0) {
          console.log(`[마이그레이션] ${unchunked.length}건의 데이터를 500개 단위로 묶습니다...`);
          const chunkSize = 500;
          for (let i = 0; i < unchunked.length; i++) {
            const chunkIndex = Math.floor(i / chunkSize) + 1;
            unchunked[i].new_group_id = `reset-all-2026-05-12-chunk-${chunkIndex}`;
          }
          
          for (let i = 0; i < unchunked.length; i += 100) {
            const chunk = unchunked.slice(i, i + 100);
            await Promise.all(chunk.map(tx => 
              supabase.from('transactions').update({ 
                group_id: tx.new_group_id, 
                is_grouped: true,
                note: `[재고 조정] 2026-05-12 기준 초기화 (${Math.floor(i / chunkSize) + 1}그룹)` 
              }).eq('id', tx.id)
            ));
          }
          console.log('[마이그레이션 완료]');
          // 마이그레이션 완료 후 전체 목록 다시 로드
          const allData = await transactionApi.getAll();
          setTransactions(allData);
        }
      }
    } catch (e) {
      console.warn('마이그레이션 중 오류:', e);
    }
  };

  // 거래 내역 가져오기 (빠른 초기 로딩 + 백그라운드 전체 로딩)
  const fetchTransactions = async () => {
    try {
      // 1. 빠른 화면 렌더링을 위해 최근 500건 먼저 가져오기
      const recentData = await transactionApi.getRecent(500);
      setTransactions(recentData);
      
      // 2. 검색 및 필터링을 위해 전체 데이터 백그라운드 로드
      setTimeout(async () => {
        try {
          const allData = await transactionApi.getAll();
          setTransactions(allData);
          
          // 백그라운드 로드 후 일회성 DB 묶음 마이그레이션 시도
          fixLegacyResetGroups();
        } catch (bgError) {
          console.warn('백그라운드 전체 거래내역 로딩 실패 (최근 500건만 유지):', bgError);
        }
      }, 500);
    } catch (error) {
      console.error('거래내역 로딩 실패:', error);
      showSnackbar('거래내역을 불러오는데 실패했습니다.', 'error');
      setTransactions([]);
    }
  };



  const handleOpenDialog = () => {
    setDialogType('io');
    setFormData(prev => ({ 
      ...prev,
      date: new Date().toISOString().split('T')[0]
    }));
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      type: 'in',
      productId: '',
      quantity: '',
      fromLocation: '',
      toLocation: '',
      note: '',
      date: new Date().toISOString().split('T')[0]
    });
    // 다중 상품 데이터 초기화 (통합)
    setMultipleIoProducts([
      {
        id: Date.now(),
        productId: '',
        quantity: '',
        fromLocation: '',
        toLocation: '',
        boxNo: '',
        note: '',
        additionalNote: ''
      }
    ]);
  };

  const handleSubmitTransaction = useCallback(async () => {
    // 통합 제출: 각 행의 fromLocation이 창고이면 '출고', 아니면 '입고'로 판단
    // 유효성 검사
    let errorMessage = '모든 상품의 필수 항목을 올바르게 입력해주세요.';
    const invalidItems = multipleIoProducts.filter(item => {
      if (!item.productId || !item.quantity) return true;
      const isOutbound = warehouses.find(w => w.id === item.fromLocation);
      if (isOutbound) {
        // 출고: 출발지(창고) 필수, 목적지 필수
        if (!item.fromLocation || !item.toLocation) return true;

        // 가용 수량 부족하더라도 마이너스 재고 허용 (검증 제거)
      } else {
        // 입고: 목적지는 창고여야 함
        const toIsWarehouse = warehouses.find(w => w.id === item.toLocation);
        if (!toIsWarehouse) return true;
      }
      return false;
    });

    if (invalidItems.length > 0) {
      showSnackbar(errorMessage, 'error');
      return;
    }

    const groupId = crypto.randomUUID();
    const newTransactions = [];
    
    // 현재 트랜잭션 배치 내에서의 재고 변화를 추적 (여러 건 등록 시 누적 계산)
    const currentInventory = JSON.parse(JSON.stringify(inventory || {}));

    multipleIoProducts.forEach((item, index) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return;
      const isOutbound = warehouses.find(w => w.id === item.fromLocation);
      const isInbound = warehouses.find(w => w.id === item.toLocation);
      const isTransfer = isOutbound && isInbound;
      
      const qty = parseInt(item.quantity, 10) || 0;
      let noteSuffix = '';
      
      if (isTransfer) {
        const fromWh = item.fromLocation;
        const toWh = item.toLocation;
        
        const beforeFrom = currentInventory[fromWh]?.[item.productId] || 0;
        const afterFrom = beforeFrom - qty;
        if (!currentInventory[fromWh]) currentInventory[fromWh] = {};
        currentInventory[fromWh][item.productId] = afterFrom;
        
        const beforeTo = currentInventory[toWh]?.[item.productId] || 0;
        const afterTo = beforeTo + qty;
        if (!currentInventory[toWh]) currentInventory[toWh] = {};
        currentInventory[toWh][item.productId] = afterTo;
        
        noteSuffix = ` [출발지: ${beforeFrom}->${afterFrom}, 목적지: ${beforeTo}->${afterTo}]`;
      } else if (isOutbound) {
        const wh = item.fromLocation;
        const before = currentInventory[wh]?.[item.productId] || 0;
        const after = before - qty;
        if (!currentInventory[wh]) currentInventory[wh] = {};
        currentInventory[wh][item.productId] = after;
        
        noteSuffix = ` [${before} -> ${after}]`;
      } else if (isInbound) {
        const wh = item.toLocation;
        const before = currentInventory[wh]?.[item.productId] || 0;
        const after = before + qty;
        if (!currentInventory[wh]) currentInventory[wh] = {};
        currentInventory[wh][item.productId] = after;
        
        noteSuffix = ` [${before} -> ${after}]`;
      }

      let baseNote = item.note || formData.note || '';

      const transaction = {
        id: groupId + index,
        groupId,
        type: isOutbound ? 'out' : 'in',
        productId: parseInt(item.productId, 10),
        productName: product.name,
        productCode: product.code,
        productSupplier: product.supplier || '-',
        quantity: parseInt(item.quantity, 10),
        fromLocation: isOutbound ? item.fromLocation : (item.fromLocation || '외부'),
        toLocation: item.toLocation,
        date: formData.date,
        boxNo: item.boxNo || '',
        note: baseNote + noteSuffix,
        additionalNote: item.additionalNote || '',
        createdAt: new Date().toLocaleString(),
        isGrouped: true,
        status: '완료'
      };
      newTransactions.push(transaction);
    });

    if (newTransactions.length === 0) {
      showSnackbar('등록할 유효한 상품이 없습니다.', 'error');
      return;
    }

    try {
      await transactionApi.createMany(newTransactions);
      const updatedTransactions = [...newTransactions, ...transactions];
      setTransactions(updatedTransactions);
      await batchUpdateInventory(newTransactions);
      showSnackbar(`입출고 등록이 완료되었습니다. (${newTransactions.length}개 상품)`, 'success');

      // 감사 로그: 신규 입출고 등록
      try {
        const createLogs = newTransactions.map(t => ({
          action: t.type === 'in' ? '입고' : '출고',
          targetTable: 'inventory_transactions',
          targetId: t.groupId,
          summary: `[${t.type === 'in' ? '입고' : '출고'}] ${t.productName} x ${t.quantity}개 (${formatLocationName(t.fromLocation, warehouses, dealers)}→${formatLocationName(t.toLocation, warehouses, dealers)})${t.note ? ' - ' + t.note : ''}`,
          details: t,
          groupId: t.groupId
        }));
        logActions(createLogs);
      } catch (logErr) {
        console.warn('[AuditLog] 입출고 등록 로그 실패:', logErr);
      }
      handleCloseDialog();
    } catch (error) {
      console.error('입출고 등록 실패:', error);
      showSnackbar('입출고 등록에 실패했습니다.', 'error');
    }
  }, [multipleIoProducts, warehouses, inventory, products, formData, transactions]);

  // (통합됨) 기존 입/출고 개별 처리 함수는 통합 제출 로직으로 대체되었습니다.

  const batchUpdateInventory = async (newTransactions) => {
    // DB 레벨 원자적 증감 연산(adjust_inventory RPC) 사용
    // → 로컬 state에 의존하지 않으므로 다중 PC/탭에서도 재고 정합성 보장
    const warehouseMap = new Map((warehouses || []).map(w => [w.id, w]));
    const rpcCalls = []; // { warehouse_id, product_id, delta }
    const stockDeltas = []; // { productId, delta } for parts.stock sync

    for (const transaction of newTransactions) {
      const qty = parseInt(transaction.quantity, 10) || 0;
      if (qty === 0) continue;

      if (transaction.type === 'in') {
        // 목적지 창고에 입고(+)
        const toWh = warehouseMap.get(transaction.toLocation);
        if (toWh) {
          rpcCalls.push({ warehouse_id: transaction.toLocation, product_id: transaction.productId, delta: qty });
          if (toWh.syncWithProductStock) {
            stockDeltas.push({ productId: transaction.productId, delta: qty });
          }
        }
        // 출발지가 창고이면 출고(-)  (창고 간 이동)
        const fromWh = warehouseMap.get(transaction.fromLocation);
        if (fromWh) {
          rpcCalls.push({ warehouse_id: transaction.fromLocation, product_id: transaction.productId, delta: -qty });
          if (fromWh.syncWithProductStock) {
            stockDeltas.push({ productId: transaction.productId, delta: -qty });
          }
        }
      } else {
        // 출고: 출발지 창고에서 차감(-)
        const fromWh = warehouseMap.get(transaction.fromLocation);
        if (fromWh) {
          rpcCalls.push({ warehouse_id: transaction.fromLocation, product_id: transaction.productId, delta: -qty });
          if (fromWh.syncWithProductStock) {
            stockDeltas.push({ productId: transaction.productId, delta: -qty });
          }
        }
        // 목적지가 창고이면 입고(+) (창고 간 이동)
        const toWh = warehouseMap.get(transaction.toLocation);
        if (toWh) {
          rpcCalls.push({ warehouse_id: transaction.toLocation, product_id: transaction.productId, delta: qty });
          if (toWh.syncWithProductStock) {
            stockDeltas.push({ productId: transaction.productId, delta: qty });
          }
        }
      }
    }

    // 같은 창고+상품 조합의 delta를 합산 (한 번의 RPC 호출로 통합)
    const rpcMap = {};
    rpcCalls.forEach(call => {
      const key = `${call.warehouse_id}_${call.product_id}`;
      if (!rpcMap[key]) rpcMap[key] = { ...call };
      else rpcMap[key].delta += call.delta;
    });

    // DB 원자적 증감 실행
    const rpcEntries = Object.values(rpcMap).filter(e => e.delta !== 0);
    if (rpcEntries.length > 0) {
      const results = await Promise.all(
        rpcEntries.map(entry =>
          supabase.rpc('adjust_inventory', {
            p_warehouse_id: entry.warehouse_id,
            p_product_id: entry.product_id,
            p_quantity_change: entry.delta
          })
        )
      );

      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('[batchUpdateInventory] RPC 오류:', errors.map(e => e.error.message));
        throw new Error(`재고 업데이트 중 ${errors.length}건의 오류가 발생했습니다.`);
      }
    }

    // 서버 DB에서 최신 재고 다시 조회 (Single Source of Truth)
    const latestInventory = await fetchInventoryData();

    // 상품 재고(parts.stock) 동기화
    if (stockDeltas.length > 0) {
      const groupedStockDeltas = stockDeltas.reduce((acc, curr) => {
        acc[curr.productId] = (acc[curr.productId] || 0) + curr.delta;
        return acc;
      }, {});

      setProducts(prevProducts => {
        const newProducts = [...prevProducts];
        for (const [productId, delta] of Object.entries(groupedStockDeltas)) {
          if (delta === 0) continue;
          const productIndex = newProducts.findIndex(p => p.id === parseInt(productId, 10));
          if (productIndex !== -1) {
            const p = newProducts[productIndex];
            const newStock = Math.max(0, p.stock + delta);
            newProducts[productIndex] = { ...p, stock: newStock };
            
            productApi.updateStock(parseInt(productId, 10), newStock).catch(err => {
              console.error(`Failed to update stock for product ${productId}:`, err);
            });
          }
        }
        return newProducts;
      });
    }

    // 재고 부족 알림 체크 — 변경된 상품만 (비동기, 업무 흐름 방해하지 않음)
    if (latestInventory) {
      const changedProductIds = [...new Set(newTransactions.map(t => t.productId).filter(Boolean))];
      checkAndSendLowStockAlerts(latestInventory, products, warehouses, changedProductIds).catch(err => {
        console.warn('[InventoryAlert] 알림 체크 실패:', err);
      });
    }
  };

  // 기존 내역 전체를 기반으로 재고(inventory 및 parts) 전면 재계산 (시스템 복구용)
  const recalculateAllInventory = async (silent = false) => {
    if (!silent) {
      if (!window.confirm('경고: 현재 데이터베이스의 모든 입출고 내역을 기반으로 재고를 0부터 다시 계산합니다. 이 작업은 되돌릴 수 없습니다. 진행하시겠습니까?')) {
        return;
      }
    }
    if (!silent) setLoading(true);
    try {
      if (!silent) showSnackbar('재고 전면 재계산을 시작합니다...', 'info');
      
      // 1. 서버에서 모든 트랜잭션 가져오기 (오래된 순으로 정렬)
      const allTx = await transactionApi.getAll();
      const sortedTx = [...allTx].sort((a, b) => {
        const dateA = a.date || a.createdAt;
        const dateB = b.date || b.createdAt;
        const timeDiff = new Date(dateA) - new Date(dateB);
        if (timeDiff !== 0) return timeDiff;
        // 같은 날짜 내에서 리셋(reset-all-*) 건은 항상 먼저 처리
        // (리셋 후 수동 조정이 덮어쓰여야 하므로)
        const aIsReset = a.groupId && String(a.groupId).startsWith('reset-all-');
        const bIsReset = b.groupId && String(b.groupId).startsWith('reset-all-');
        if (aIsReset && !bIsReset) return -1;
        if (!aIsReset && bIsReset) return 1;
        // 그 외에는 생성일시(createdAt)로 정밀하게 비교
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
      
      // 2. 초기 재고 설정 (0으로 초기화)
      const newInventory = {};
      const warehouseMap = new Map((warehouses || []).map(w => [w.id, w]));
      
      warehouses.forEach(w => {
        newInventory[w.id] = {};
        products.forEach(p => {
          newInventory[w.id][p.id] = 0;
        });
      });

      const stockUpdates = {}; // { productId: finalStock }
      // 재고 비관리 상품 ID 목록 (track_inventory === false)
      const noTrackIds = new Set(
        products.filter(p => p.track_inventory === false).map(p => p.id)
      );
      products.forEach(p => {
        if (!noTrackIds.has(p.id)) {
          stockUpdates[p.id] = 0;
        }
      });

      // 3. 트랜잭션 순차 적용
      for (const tx of sortedTx) {
        if (!tx.productId) continue;
        // 재고 비관리 상품은 건너뜀
        if (noTrackIds.has(tx.productId)) continue;
        const qty = Number(tx.quantity) || 0;
        
        if (tx.type === 'in') {
          const toWh = warehouseMap.get(tx.toLocation);
          if (toWh) {
            if (!newInventory[tx.toLocation]) newInventory[tx.toLocation] = {};
            // adjustment 입고도 일반 입고와 동일하게 더하기(ADD) 처리
            // batchUpdateInventory와 동작 일치시킴 (등록 시와 재계산 시 결과 동일)
            // 리셋 스크립트(reset-all-*, qty=0)는 리셋 전용 로직에서 별도 처리
            const isResetEntry = tx.groupId && String(tx.groupId).startsWith('reset-all-');
            if (isResetEntry && tx.fromLocation === 'adjustment') {
              // 리셋 건: 해당 값으로 덮어쓰기 (재고를 0으로 초기화)
              const oldQty = newInventory[tx.toLocation][tx.productId] || 0;
              newInventory[tx.toLocation][tx.productId] = qty;
              if (toWh.syncWithProductStock) {
                stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) + (qty - oldQty);
              }
            } else {
              // 일반 입고 및 수동 재고 조정: 더하기(ADD) 처리
              newInventory[tx.toLocation][tx.productId] = (newInventory[tx.toLocation][tx.productId] || 0) + qty;
              if (toWh.syncWithProductStock) {
                stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) + qty;
              }
            }
          }
        } else if (tx.type === 'out') {
          const fromWh = warehouseMap.get(tx.fromLocation);
          if (fromWh) {
            if (!newInventory[tx.fromLocation]) newInventory[tx.fromLocation] = {};
            const isResetEntry = tx.groupId && String(tx.groupId).startsWith('reset-all-');
            if (isResetEntry && tx.toLocation === 'adjustment') {
              // 리셋 건: 해당 값으로 덮어쓰기
              const oldQty = newInventory[tx.fromLocation][tx.productId] || 0;
              newInventory[tx.fromLocation][tx.productId] = qty;
              if (fromWh.syncWithProductStock) {
                stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) + (qty - oldQty);
              }
            } else {
              // 일반 출고: 차감(SUB) 처리
              newInventory[tx.fromLocation][tx.productId] = (newInventory[tx.fromLocation][tx.productId] || 0) - qty;
              if (fromWh.syncWithProductStock) {
                stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) - qty;
              }
            }
          }
        } else if (tx.type === 'move') {
          const fromWh = warehouseMap.get(tx.fromLocation);
          const toWh = warehouseMap.get(tx.toLocation);
          if (fromWh) {
            if (!newInventory[tx.fromLocation]) newInventory[tx.fromLocation] = {};
            newInventory[tx.fromLocation][tx.productId] = (newInventory[tx.fromLocation][tx.productId] || 0) - qty;
            if (fromWh.syncWithProductStock) {
              stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) - qty;
            }
          }
          if (toWh) {
            if (!newInventory[tx.toLocation]) newInventory[tx.toLocation] = {};
            newInventory[tx.toLocation][tx.productId] = (newInventory[tx.toLocation][tx.productId] || 0) + qty;
            if (toWh.syncWithProductStock) {
              stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) + qty;
            }
          }
        } else if (tx.type === 'adjustment') {
          const toWh = warehouseMap.get(tx.toLocation);
          if (toWh) {
            if (!newInventory[tx.toLocation]) newInventory[tx.toLocation] = {};
            const oldQty = newInventory[tx.toLocation][tx.productId] || 0;
            newInventory[tx.toLocation][tx.productId] = qty;
            if (toWh.syncWithProductStock) {
              stockUpdates[tx.productId] = (stockUpdates[tx.productId] || 0) + (qty - oldQty);
            }
          }
        }
      }

      // 4. DB 일괄 업데이트 준비 (inventory 테이블)
      const inventoryUpserts = [];
      for (const [whId, prods] of Object.entries(newInventory)) {
        for (const [pId, qty] of Object.entries(prods)) {
          inventoryUpserts.push({
            warehouse_id: whId,
            product_id: parseInt(pId, 10),
            quantity: qty
          });
        }
      }
      
      if (inventoryUpserts.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < inventoryUpserts.length; i += chunkSize) {
          const chunk = inventoryUpserts.slice(i, i + chunkSize);
          await inventoryApi.upsertMany(chunk);
        }
      }

      // 5. DB 일괄 업데이트 준비 (parts 테이블)
      const stockUpdatesArray = Object.entries(stockUpdates);
      const chunkSizeParts = 100;
      for (let i = 0; i < stockUpdatesArray.length; i += chunkSizeParts) {
        const chunk = stockUpdatesArray.slice(i, i + chunkSizeParts);
        await Promise.all(chunk.map(([pId, qty]) => {
          const finalQty = Math.max(0, qty); // parts 테이블 재고는 음수 불가
          return supabase.from('parts').update({ stock: finalQty }).eq('id', pId);
        }));
      }

      // 6. 데이터 리프레시
      await fetchInventoryData();
      await fetchProducts();
      if (!silent) showSnackbar('재고 재계산이 성공적으로 완료되었습니다!', 'success');
      
    } catch (err) {
      console.error('재고 재계산 실패:', err);
      if (!silent) showSnackbar('재고 재계산 중 오류가 발생했습니다.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 실제 상품 재고 업데이트 함수
  const updateProductStock = async (productId, quantityChange, type) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      let newStock;
      if (type === 'increase') {
        newStock = product.stock + quantityChange;
      } else {
        newStock = Math.max(0, product.stock + quantityChange); // quantityChange는 음수
      }

      // API를 통해 실제 상품 재고 업데이트
      await productApi.updateStock(productId, newStock);
      
      // 로컬 상품 상태도 업데이트
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, stock: newStock } : p
      ));

      console.log(`상품 ${product.name}의 재고가 ${product.stock}에서 ${newStock}으로 업데이트되었습니다.`);
    } catch (error) {
      console.error('상품 재고 업데이트 실패:', error);
      showSnackbar('상품 재고 업데이트에 실패했습니다.', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // 엑셀 업로드 다이얼로그 열기
  const handleOpenExcelUpload = (type) => {
    setExcelUploadType(type);
    setExcelUploadOpen(true);
    setExcelFile(null);
    setExcelData([]);
  };

  // 엑셀 업로드 다이얼로그 닫기
  const handleCloseExcelUpload = () => {
    setExcelUploadOpen(false);
    setExcelFile(null);
    setExcelData([]);
    setExcelUploadType('');
  };

  // 엑셀 파일 처리 (다중 상품 가로배열 데이터 형식 지원)
  const handleExcelFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setExcelFile(file);
    
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.getWorksheet(1);
      const data = [];
      
      // 통합 파츠 템플릿(가로) 형식 감지
      let isNearbikeFormat = false;
      let headerRow = 1;
      
      // 헤더 행 찾기 (주문번호, 주문처, 비고 등이 있는 행)
      worksheet.eachRow((row, rowNumber) => {
        const rowData = row.values;
        if (rowData[1] && rowData[1].toString().includes('주문번호')) {
          isNearbikeFormat = true;
          headerRow = rowNumber;
        }
      });

      if (isNearbikeFormat) {
        // [업데이트]: 통합 상품 관리 (가로 형태의 다중 상품 주문서 양식 지원)
        const headerRowValues = worksheet.getRow(headerRow).values;
        
        // 어떤 열이 어떤 상품을 의미하는지 동적으로 식별 (4번째 열부터)
        // 엑셀은 1-based index 이지만, empty cell 이 있으면 length 가 길 수 있음
        const dynamicProductColumns = [];
        for (let i = 4; i < headerRowValues.length; i++) {
          const colName = headerRowValues[i]?.toString().trim();
          if (colName) {
            dynamicProductColumns.push({ col: i, name: colName, code: colName.replace(/\s+/g, '') });
          }
        }

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRow) return; // 헤더 행 건너뛰기
          
          const rowData = row.values;
          const orderNumber = rowData[1]; // A열: 주문번호
          const orderSource = rowData[2]; // B열: 주문처
          const note = rowData[3]; // C열: 비고
          
          if (!orderNumber || orderNumber.toString().trim() === '') return;
          
          dynamicProductColumns.forEach(product => {
            const quantity = parseInt(rowData[product.col], 10) || 0;
            if (quantity !== 0) {
              const item = {
                productCode: product.code, // 추후 handleExcelDataSubmit 에서 products와 매칭
                productName: product.name,
                parsedColName: product.name, 
                quantity: Math.abs(quantity), 
                fromLocation: quantity < 0 ? '외부' : 'W001', // 음수면 입고, 양수면 출고
                toLocation: quantity < 0 ? 'W001' : note || '외부',
                note: `${orderSource} - ${orderNumber}`,
                additionalNote: note || '',
                orderNumber: orderNumber,
                orderSource: orderSource
              };
              data.push(item);
            }
          });
        });
      } else {
        // 기존 형식 처리 (표준 템플릿)
        // 헤더 매핑
        const headerRowValues = worksheet.getRow(1).values;
        const colMap = {};
        for (let i = 1; i < headerRowValues.length; i++) {
          const val = headerRowValues[i]?.toString().replace(/\s+/g, '');
          if (val) colMap[val] = i;
        }

        const getColVal = (row, ...keys) => {
          for (const key of keys) {
            if (colMap[key] && row.values[colMap[key]] !== undefined) {
              const raw = row.values[colMap[key]];
              // 숫자 바코드가 과학적 표기법(8.80925e+12)으로 변환되는 것 방지
              if (typeof raw === 'number') {
                return raw.toFixed(0);
              }
              const str = String(raw);
              // 문자열이 과학적 표기법(8.80925E+12)인 경우 숫자로 변환 후 정수 문자열로
              if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(str)) {
                return Number(str).toFixed(0);
              }
              return str;
            }
          }
          return '';
        };

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // 헤더 행 건너뛰기
          
          const productCode = getColVal(row, '상품코드', '제품코드', '품목코드');
          const barcode = getColVal(row, '바코드');
          const productName = getColVal(row, '상품명', '제품명', '품목명');
          const qtyStr = getColVal(row, '수량');
          
          if (productCode || barcode || productName) {
            const item = {
              productCode: productCode,
              barcode: barcode,
              productName: productName,
              quantity: parseInt(qtyStr, 10) || 0,
              fromLocation: getColVal(row, '출발지', '보내는곳'),
              toLocation: getColVal(row, '목적지', '받는곳'),
              note: getColVal(row, '메모', '비고'),
              additionalNote: getColVal(row, '개별메모')
            };
            data.push(item);
          }
        });
      }

      // 상품 매칭 검증
      data.forEach(item => {
        const inputCode = String(item.productCode || '').trim().toLowerCase();
        const inputBarcode = String(item.barcode || '').trim().toLowerCase();
        const inputName = String(item.productName || '').trim().toLowerCase();
        const inputParsedCol = String(item.parsedColName || '').trim().toLowerCase();

        let product = null;

        // 1. 정확한 코드/바코드 매칭 (최우선, 공백 무시)
        const possibleCodes = [inputCode, inputBarcode, inputName, inputParsedCol]
          .filter(v => v)
          .map(v => v.replace(/\s+/g, ''));
          
        for (const code of possibleCodes) {
          product = products.find(p => {
            const dbCode = String(p.code || '').replace(/\s+/g, '').toLowerCase();
            const dbBarcode = String(p.barcode || '').replace(/\s+/g, '').toLowerCase();
            // 바코드 비교 시 앞뒤 0 차이 등도 고려 (숫자로 비교)
            const numericMatch = dbBarcode && !isNaN(code) && !isNaN(dbBarcode) && 
                                 parseInt(code, 10) === parseInt(dbBarcode, 10);
            return (dbCode && dbCode === code) || (dbBarcode && dbBarcode === code) || numericMatch;
          });
          if (product) break;
        }

        // 2. 정확한 이름 매칭 (공백 제거)
        if (!product) {
          const possibleNames = [inputName, inputCode, inputParsedCol].filter(v => v);
          for (const name of possibleNames) {
            const nameNoSpace = name.replace(/\s+/g, '');
            product = products.find(p => {
              const dbNameNoSpace = String(p.name || '').replace(/\s+/g, '').toLowerCase();
              return dbNameNoSpace && dbNameNoSpace === nameNoSpace;
            });
            if (product) break;
          }
        }

        // 3. 부분 이름 매칭 (최소 2글자 이상일 때만)
        if (!product) {
          const possibleNames = [inputName, inputCode, inputParsedCol].filter(v => v && v.replace(/\s+/g, '').length >= 2);
          for (const name of possibleNames) {
            const nameNoSpace = name.replace(/\s+/g, '');
            product = products.find(p => {
              const dbNameNoSpace = String(p.name || '').replace(/\s+/g, '').toLowerCase();
              return dbNameNoSpace && dbNameNoSpace.includes(nameNoSpace);
            });
            if (product) break;
          }
        }

        if (!product) {
          item.error = '등록되지 않은 상품(상품명/코드 불일치)';
        } else if (item.quantity === 0 || isNaN(item.quantity)) {
          item.error = '수량이 올바르지 않거나 0입니다';
        } else {
          item.product = product;
        }
      });

      setExcelData(data);
      const formatType = isNearbikeFormat ? '다중 파츠 형식' : '표준 형식';
      showSnackbar(`${data.length}개의 상품 데이터를 읽었습니다. (${formatType})`, 'success');
    } catch (error) {
      console.error('엑셀 파일 읽기 오류:', error);
      showSnackbar('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'error');
    }
  };

  // 엑셀 데이터로 입고/출고 처리 (통합) (useCallback으로 메모이제이션)
  const handleExcelDataSubmit = useCallback(async () => {
    if (excelData.length === 0) {
      showSnackbar('처리할 데이터가 없습니다.', 'error');
      return;
    }

    const groupId = crypto.randomUUID();
    const newTransactions = [];
    const inventoryUpdates = [];
    let inboundCount = 0;
    let outboundCount = 0;

    excelData.forEach((item, index) => {
      const product = item.product;
      
      if (!item.error && product) {
        // 출발지/목적지 텍스트를 내부 ID로 변환
        const resolveLocationId = (locText) => {
          if (!locText || locText === '' || locText === '외부') return '외부';
          const t = locText.trim();
          if (t === '재고 조정' || t === '재고조정' || t === 'adjustment') return 'adjustment';
          // 창고 이름으로 매칭
          const wh = warehouses.find(w => w.name === t || w.id === t);
          if (wh) return wh.id;
          // 대리점 이름으로 매칭
          const dl = dealers.find(d => d.name === t || d.id === t);
          if (dl) return dl.id;
          return locText; // 매칭 안 되면 원본 텍스트 유지
        };

        const fromLoc = resolveLocationId(item.fromLocation);
        const toLoc = resolveLocationId(item.toLocation);

        // 출발지/목적지로 입고/출고 판단
        const fromIsWarehouse = warehouses.find(w => w.id === fromLoc);
        const isInbound = fromLoc === '외부' || fromLoc === 'adjustment' || (!fromIsWarehouse && !item.fromLocation);
        const transactionType = isInbound ? 'in' : 'out';
        
        if (isInbound) inboundCount++;
        else outboundCount++;

        const transaction = {
          id: groupId + index,
          groupId: groupId,
          type: transactionType,
          productId: parseInt(product.id, 10),
          productName: product.name,
          productCode: product.code,
          productSupplier: product.supplier || '-',
          quantity: item.quantity,
          fromLocation: fromLoc || (isInbound ? '외부' : ''),
          toLocation: toLoc,
          date: formData.date,
          note: item.note || formData.note,
          additionalNote: item.additionalNote || '',
          createdAt: new Date().toLocaleString(),
          isGrouped: true,
          status: '완료'
        };
        
        newTransactions.push(transaction);
        inventoryUpdates.push(transaction);
      }
    });

    if (newTransactions.length === 0) {
      showSnackbar(`유효한 상품 데이터가 없습니다. (전체 ${excelData.length}건 중 오류 ${excelData.filter(d => d.error).length}건)`, 'error');
      return;
    }

    try {
      // 서버에 거래내역 저장
      await transactionApi.createMany(newTransactions);
      
      // 거래 내역 업데이트
      const updatedTransactions = [...newTransactions, ...transactions];
      setTransactions(updatedTransactions);
      
      // 재고 업데이트 (배치 처리)
      await batchUpdateInventory(inventoryUpdates);
      
      const resultMessage = `총 ${newTransactions.length}개 상품 처리 완료 (입고: ${inboundCount}개, 출고: ${outboundCount}개)`;
      showSnackbar(resultMessage, 'success');
      handleCloseExcelUpload();
    } catch (error) {
      console.error('엑셀 업로드 처리 실패:', error);
      showSnackbar('엑셀 업로드 처리에 실패했습니다.', 'error');
    }
  }, [excelData, products, formData, transactions]);

  // 엑셀 템플릿 다운로드 (통합)
  const downloadExcelTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('입출고 통합 템플릿');
    
    // 헤더 설정
    worksheet.columns = [
      { header: 'A', key: 'colA', width: 10 },
      { header: 'B', key: 'colB', width: 10 },
      { header: '상품코드', key: 'productCode', width: 15 },
      { header: '바코드', key: 'barcode', width: 15 },
      { header: '상품명', key: 'productName', width: 20 },
      { header: '수량', key: 'quantity', width: 10 },
      { header: '출발지', key: 'fromLocation', width: 15 },
      { header: '목적지', key: 'toLocation', width: 15 },
      { header: '메모', key: 'note', width: 20 },
      { header: '개별메모', key: 'additionalNote', width: 20 }
    ];

    // 샘플 데이터 추가 (입고 예시)
    worksheet.addRow({
      colA: '예시(입고)',
      colB: '',
      productCode: 'NB-BIKE-001',
      barcode: '',
      productName: '레트로 20 블랙',
      quantity: 5,
      fromLocation: '외부',
      toLocation: '청담본점',
      note: '본사 입고',
      additionalNote: '비고 입력'
    });

    // 샘플 데이터 추가 (출고 예시)
    worksheet.addRow({
      colA: '예시(출고)',
      colB: '',
      productCode: 'NB-PART-002',
      barcode: '',
      productName: '스로틀 레버',
      quantity: 2,
      fromLocation: '청담본점',
      toLocation: '외부',
      note: '고객 발송',
      additionalNote: 'AS 처리'
    });

    // 스타일 적용
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // 설명 추가
    worksheet.addRow({});
    worksheet.addRow({ colA: '※ 설명:', productCode: '출발지가 "외부"이거나 비어있으면 입고, 창고ID가 있으면 출고로 자동 판단됩니다.' });

    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '입출고_통합_템플릿.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
    });
  };

  // 다중 상품 형식 템플릿 다운로드
  const downloadNearbikeTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('다중_파츠_입출고_관리');
    
    // 헤더 설정 (구글 시트와 동일한 형식)
    worksheet.columns = [
      { header: '주문번호', key: 'orderNumber', width: 20 },
      { header: '주문처', key: 'orderSource', width: 15 },
      { header: '비고', key: 'note', width: 20 },
      { header: '청담', key: '청담', width: 10 },
      { header: '레트로 20블랙', key: '레트로20블랙', width: 15 },
      { header: '레트로 20베이지', key: '레트로20베이지', width: 15 },
      { header: '카고', key: '카고', width: 10 },
      { header: '스프린터블랙', key: '스프린터블랙', width: 15 },
      { header: '스프린터그레이', key: '스프린터그레이', width: 15 }
    ];

    // 샘플 데이터 추가 (입고 예시)
    worksheet.addRow({
      orderNumber: '20250930-0000031',
      orderSource: '공홈',
      note: '9/30 에코',
      청담: -1,
      레트로20블랙: -2,
      레트로20베이지: -3,
      카고: 0,
      스프린터블랙: 0,
      스프린터그레이: 0
    });

    // 샘플 데이터 추가 (출고 예시)
    worksheet.addRow({
      colA: '20250930-0000045',
      orderNumber: '20250930-0000045',
      orderSource: '공홈',
      note: '9/30 삼성 퍼스널휠스',
      청담: 1,
      레트로20블랙: 1,
      레트로20베이지: 0,
      카고: 0,
      스프린터블랙: 0,
      스프린터그레이: 0
    });

    // 스타일 적용
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // 설명 추가
    worksheet.addRow({});
    worksheet.addRow({ 
      colA: '※ 설명:', 
      orderNumber: '음수(-)는 입고, 양수(+)는 출고로 자동 판단됩니다.',
      orderSource: '주문번호는 B열에 입력하세요.',
      note: '비고는 D열에 입력하세요.'
    });

    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '통합_파츠_재고관리_템플릿.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const handleBatchApplyLocation = () => {
    if (!batchFromLocation && !batchToLocation) return;
    setMultipleIoProducts(prev => prev.map(p => ({
      ...p,
      ...(batchFromLocation ? { fromLocation: batchFromLocation } : {}),
      ...(batchToLocation ? { toLocation: batchToLocation } : {})
    })));
  };

  // 다중 상품 관리 함수들 (통합)
  const addIoProductRow = () => {
    setMultipleIoProducts(prev => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        quantity: '',
        fromLocation: '',
        toLocation: '',
        boxNo: '',
        note: '',
        additionalNote: ''
      }
    ]);
  };

  const removeIoProductRow = (id) => {
    if (multipleIoProducts.length > 1) {
      setMultipleIoProducts(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateIoProductRow = (id, field, value) => {
    setMultipleIoProducts(prev => 
      prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // (통합됨) 출고 전용 행 관리 함수 제거, 통합 함수 사용

  // 거래 유형 판별
  const getTransactionTypeInfo = useCallback((tx) => {
    if (!tx) return { label: '알 수 없음', color: 'default' };
    const actualTx = tx.items && tx.items.length > 0 ? tx.items[0] : tx;
    const fromLoc = actualTx.fromLocation;
    const toLoc = actualTx.toLocation;
    
    const isW = (id) => warehouses.some(w => w.id === id);
    const isD = (id) => dealers.some(d => d.id === id);
    const isExt = (id) => !id || id === '외부' || id === 'none';

    if (fromLoc === 'adjustment' || toLoc === 'adjustment') return { label: '재고 조정', color: 'error' };
    if (fromLoc === 'direct_edit' || toLoc === 'direct_edit') return { label: '직접 수정', color: 'warning' };

    if (actualTx.type === 'in') {
      if (isExt(fromLoc)) return { label: '수입', color: 'primary' };
      if (isW(fromLoc) && isW(toLoc)) return { label: '창고이동', color: 'info' };
      if (isD(fromLoc)) return { label: '반품입고', color: 'primary' };
      return { label: '입고', color: 'primary' };
    } else {
      if (isW(fromLoc) && isW(toLoc)) return { label: '창고이동', color: 'info' };
      if (isD(toLoc)) return { label: '거래처출고', color: 'warning' };
      if (isExt(toLoc)) return { label: '출고(외부)', color: 'secondary' };
      return { label: '출고', color: 'secondary' };
    }
  }, [warehouses, dealers]);

  // 재고 현황 계산
  const getInventorySummary = () => {
    const summary = {};
    
    Object.entries(inventory).forEach(([locationId, products]) => {
      const location = warehouses.find(w => w.id === locationId) || 
                      dealers.find(d => d.id === locationId);
      if (location) {
        summary[locationId] = {
          name: location.name,
          totalProducts: Object.keys(products).length,
          totalQuantity: Object.values(products).reduce((sum, qty) => sum + qty, 0)
        };
      }
    });
    
    return summary;
  };

  // 그룹화된 거래내역 생성 (useMemo로 메모이제이션)
  const groupedTransactions = useMemo(() => {
    const grouped = {};
    
    transactions.forEach(transaction => {
      // groupId가 존재하면 무조건 그룹으로 묶는다 (isGrouped 여부와 무관)
      const hasGroup = transaction.groupId !== undefined && transaction.groupId !== null;
      if (hasGroup) {
        const key = transaction.groupId;
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            groupId: key,
            type: transaction.type,
            date: transaction.date,
            createdAt: transaction.createdAt,
            note: transaction.note, // 공용메모 추가
            items: []
          };
        }
        grouped[key].items.push(transaction);
        // 그룹 대표 속성은 'out'(출고)을 우선시함 (환입보다 원본 전송 내역 표시)
        if (transaction.type === 'out') {
          grouped[key].type = 'out';
        }
      } else {
        // 개별 거래는 그대로 추가
        grouped[transaction.id] = {
          id: transaction.id,
          type: transaction.type,
          date: transaction.date,
          createdAt: transaction.createdAt,
          note: transaction.note,
          items: [transaction]
        };
      }
    });

    // 최종 차감 내역만 보여주기 위한 상계(Net) 처리
    const finalGrouped = Object.values(grouped).map(group => {
      if (group.items.length <= 1) return group;

      const itemMap = {};
      group.items.forEach(item => {
        // 상품별로 상계 처리 (옵션/바코드가 같은 것을 동일 상품으로 취급)
        const pid = item.productId || item.productCode || item.productName || item.id;
        if (!itemMap[pid]) {
          itemMap[pid] = { ...item, netQuantity: 0, originalItems: [] };
        }
        itemMap[pid].originalItems.push(item);

        const qty = Number(item.quantity) || 0;
        // 그룹의 기준 타입(보통 'out')과 같으면 더하고 다르면 뺌
        if (item.type === group.type) {
          itemMap[pid].netQuantity += qty;
        } else {
          itemMap[pid].netQuantity -= qty;
        }

        // 기준 타입 아이템 정보로 덮어씌움 (반품보다는 원래 출고 정보 유지)
        if (item.type === group.type) {
          itemMap[pid] = { ...itemMap[pid], ...item, netQuantity: itemMap[pid].netQuantity, originalItems: itemMap[pid].originalItems };
        }
      });

      // 최종 상계 수량이 0이 아닌 것만 남김 (단, 애초에 수량이 0인 명시적 재고 조정 건은 내역에 남김)
      const aggregatedItems = Object.values(itemMap)
        .filter(i => i.netQuantity !== 0 || i.originalItems.some(orig => Number(orig.quantity) === 0))
        .map(i => {
          if (i.netQuantity < 0) {
            // 상계 결과가 음수면 원래 그룹 타입의 반대 성격(예: 출고 그룹의 반대는 '입고/취소')
            const reversedType = group.type === 'out' ? 'in' : 'out';
            // 가장 최신의 역방향 트랜잭션 정보(from/to Location 등)를 가져오기 위함
            const reverseItem = [...i.originalItems].reverse().find(orig => orig.type === reversedType) || i;
            return {
              ...reverseItem,
              quantity: Math.abs(i.netQuantity),
              type: reversedType,
              note: `[상계결과] ${reverseItem.note || i.note || ''}`
            };
          }
          return { ...i, quantity: i.netQuantity };
        });

      // 모든 아이템이 상계되어 남은 아이템들이 전부 역방향(예: 모두 입고)이라면 그룹 타입도 역방향으로 맞춤
      if (aggregatedItems.length > 0) {
        const allReversed = aggregatedItems.every(i => i.type !== group.type);
        if (allReversed) {
          group.type = aggregatedItems[0].type;
        }
      }

      // 모든 아이템이 상계되어 0이 되더라도, 빈 배열로 만들어서 필터링 되게 함
      return { ...group, items: aggregatedItems };
    });

    // 최종적으로 아이템이 하나도 없는 그룹(전체 환불 등)은 목록에서 제외
    return finalGrouped.filter(g => g.items.length > 0);
  }, [transactions]);
  
  // 날짜 형식 헬퍼 함수
  const getDateKey = (date, period) => {
    const d = new Date(date);
    if (period === 'day') {
      return d.toISOString().split('T')[0];
    } else if (period === 'week') {
      const year = d.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `${year}-W${week.toString().padStart(2, '0')}`;
    } else if (period === 'month') {
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    } else if (period === 'year') {
      return d.getFullYear().toString();
    }
    return d.toISOString().split('T')[0];
  };

  // 대리점별 입출고 통계 계산 (→대리점: 출고, ←대리점: 입고) (날짜 필터 적용)
  const dealerStats = useMemo(() => {
    const stats = {};
    const dateFrom = dealerStatsFilter.dateFrom;
    const dateTo = dealerStatsFilter.dateTo;
    
    dealers.forEach(dealer => {
      stats[dealer.id] = {
        name: dealer.name,
        location: dealer.location,
        // 출고(→대리점)
        outTotalQuantity: 0,
        outTransactions: 0,
        outLastDate: null,
        // 입고(←대리점)
        inTotalQuantity: 0,
        inTransactions: 0,
        inLastDate: null,
        // 기간별 통계
        dailyStats: {},
        weeklyStats: {},
        monthlyStats: {},
        yearlyStats: {},
        totalTransactions: 0
      };
    });

    transactions.forEach(t => {
      // 날짜 필터 적용
      if (dateFrom && t.date < dateFrom) return;
      if (dateTo && t.date > dateTo) return;
      
      const txDate = new Date(t.date);
      const dayKey = getDateKey(t.date, 'day');
      const weekKey = getDateKey(t.date, 'week');
      const monthKey = getDateKey(t.date, 'month');
      const yearKey = getDateKey(t.date, 'year');

      // →대리점 (출고)
      if (t.type === 'out' && t.status !== '대기' && stats[t.toLocation]) {
        const s = stats[t.toLocation];
        s.outTotalQuantity += t.quantity;
        s.outTransactions += 1;
        s.totalTransactions += 1;
        if (!s.outLastDate || txDate > new Date(s.outLastDate)) {
          s.outLastDate = t.date;
        }
        
        // 기간별 통계 (출고)
        s.dailyStats[dayKey] = s.dailyStats[dayKey] || { quantity: 0, transactions: 0 };
        s.dailyStats[dayKey].quantity += t.quantity;
        s.dailyStats[dayKey].transactions += 1;
        
        s.weeklyStats[weekKey] = s.weeklyStats[weekKey] || { quantity: 0, transactions: 0 };
        s.weeklyStats[weekKey].quantity += t.quantity;
        s.weeklyStats[weekKey].transactions += 1;
        
        s.monthlyStats[monthKey] = s.monthlyStats[monthKey] || { quantity: 0, transactions: 0 };
        s.monthlyStats[monthKey].quantity += t.quantity;
        s.monthlyStats[monthKey].transactions += 1;
        
        s.yearlyStats[yearKey] = s.yearlyStats[yearKey] || { quantity: 0, transactions: 0 };
        s.yearlyStats[yearKey].quantity += t.quantity;
        s.yearlyStats[yearKey].transactions += 1;
      }
      // ←대리점 (입고: from이 대리점)
      if (t.type === 'in' && stats[t.fromLocation]) {
        const s = stats[t.fromLocation];
        s.inTotalQuantity += t.quantity;
        s.inTransactions += 1;
        s.totalTransactions += 1;
        if (!s.inLastDate || txDate > new Date(s.inLastDate)) {
          s.inLastDate = t.date;
        }
        
        // 기간별 통계 (입고) - 대리점에서 입고는 출고로 카운트
        s.dailyStats[dayKey] = s.dailyStats[dayKey] || { quantity: 0, transactions: 0 };
        s.dailyStats[dayKey].quantity += t.quantity;
        s.dailyStats[dayKey].transactions += 1;
        
        s.weeklyStats[weekKey] = s.weeklyStats[weekKey] || { quantity: 0, transactions: 0 };
        s.weeklyStats[weekKey].quantity += t.quantity;
        s.weeklyStats[weekKey].transactions += 1;
        
        s.monthlyStats[monthKey] = s.monthlyStats[monthKey] || { quantity: 0, transactions: 0 };
        s.monthlyStats[monthKey].quantity += t.quantity;
        s.monthlyStats[monthKey].transactions += 1;
        
        s.yearlyStats[yearKey] = s.yearlyStats[yearKey] || { quantity: 0, transactions: 0 };
        s.yearlyStats[yearKey].quantity += t.quantity;
        s.yearlyStats[yearKey].transactions += 1;
      }
    });

    return stats;
  }, [dealers, transactions, dealerStatsFilter.dateFrom, dealerStatsFilter.dateTo]);

  // 창고별 출고 통계 계산 (날짜 필터 적용)
  const warehouseStats = useMemo(() => {
    const stats = {};
    const dateFrom = dealerStatsFilter.dateFrom;
    const dateTo = dealerStatsFilter.dateTo;
    
    warehouses.forEach(warehouse => {
      stats[warehouse.id] = {
        name: warehouse.name,
        location: warehouse.location,
        // 출고(창고에서 나간 수량)
        outTotalQuantity: 0,
        outTransactions: 0,
        outLastDate: null,
        // 기간별 통계
        dailyStats: {},
        weeklyStats: {},
        monthlyStats: {},
        yearlyStats: {},
        totalTransactions: 0
      };
    });

    transactions.forEach(t => {
      // 날짜 필터 적용
      if (dateFrom && t.date < dateFrom) return;
      if (dateTo && t.date > dateTo) return;
      
      // 출고: 출발지가 창고인 경우
      if (t.type === 'out' && t.status !== '대기' && stats[t.fromLocation]) {
        const s = stats[t.fromLocation];
        const txDate = new Date(t.date);
        s.outTotalQuantity += t.quantity;
        s.outTransactions += 1;
        s.totalTransactions += 1;
        if (!s.outLastDate || txDate > new Date(s.outLastDate)) {
          s.outLastDate = t.date;
        }
        
        // 기간별 통계
        const dayKey = getDateKey(t.date, 'day');
        const weekKey = getDateKey(t.date, 'week');
        const monthKey = getDateKey(t.date, 'month');
        const yearKey = getDateKey(t.date, 'year');
        
        s.dailyStats[dayKey] = s.dailyStats[dayKey] || { quantity: 0, transactions: 0 };
        s.dailyStats[dayKey].quantity += t.quantity;
        s.dailyStats[dayKey].transactions += 1;
        
        s.weeklyStats[weekKey] = s.weeklyStats[weekKey] || { quantity: 0, transactions: 0 };
        s.weeklyStats[weekKey].quantity += t.quantity;
        s.weeklyStats[weekKey].transactions += 1;
        
        s.monthlyStats[monthKey] = s.monthlyStats[monthKey] || { quantity: 0, transactions: 0 };
        s.monthlyStats[monthKey].quantity += t.quantity;
        s.monthlyStats[monthKey].transactions += 1;
        
        s.yearlyStats[yearKey] = s.yearlyStats[yearKey] || { quantity: 0, transactions: 0 };
        s.yearlyStats[yearKey].quantity += t.quantity;
        s.yearlyStats[yearKey].transactions += 1;
      }
    });

    return stats;
  }, [warehouses, transactions, dealerStatsFilter.dateFrom, dealerStatsFilter.dateTo]);

  // 총 이동 수령 (총 입고량) 계산
  const totalInboundStats = useMemo(() => {
    let totalQuantity = 0;
    let totalTransactions = 0;
    const dailyStats = {};
    const weeklyStats = {};
    const monthlyStats = {};
    const yearlyStats = {};

    transactions.forEach(t => {
      if (t.type === 'in') {
        totalQuantity += t.quantity;
        totalTransactions += 1;
        
        const dayKey = getDateKey(t.date, 'day');
        const weekKey = getDateKey(t.date, 'week');
        const monthKey = getDateKey(t.date, 'month');
        const yearKey = getDateKey(t.date, 'year');
        
        dailyStats[dayKey] = dailyStats[dayKey] || { quantity: 0, transactions: 0 };
        dailyStats[dayKey].quantity += t.quantity;
        dailyStats[dayKey].transactions += 1;
        
        weeklyStats[weekKey] = weeklyStats[weekKey] || { quantity: 0, transactions: 0 };
        weeklyStats[weekKey].quantity += t.quantity;
        weeklyStats[weekKey].transactions += 1;
        
        monthlyStats[monthKey] = monthlyStats[monthKey] || { quantity: 0, transactions: 0 };
        monthlyStats[monthKey].quantity += t.quantity;
        monthlyStats[monthKey].transactions += 1;
        
        yearlyStats[yearKey] = yearlyStats[yearKey] || { quantity: 0, transactions: 0 };
        yearlyStats[yearKey].quantity += t.quantity;
        yearlyStats[yearKey].transactions += 1;
      }
    });

    return {
      totalQuantity,
      totalTransactions,
      dailyStats,
      weeklyStats,
      monthlyStats,
      yearlyStats
    };
  }, [transactions]);

  // 모델(제품)별 출고 통계 계산 (날짜 필터 적용)
  const productStats = useMemo(() => {
    const stats = {};
    const dateFrom = dealerStatsFilter.dateFrom;
    const dateTo = dealerStatsFilter.dateTo;
    
    transactions.forEach(t => {
      if (t.type === 'out' && t.status !== '대기') {
        // 날짜 필터 적용
        if (dateFrom && t.date < dateFrom) return;
        if (dateTo && t.date > dateTo) return;
        
        const productId = t.productId;
        const productName = t.productName || '알 수 없음';
        const productCode = t.productCode || '';
        
        if (!stats[productId]) {
          stats[productId] = {
            productId,
            productName,
            productCode,
            // 총 출고량
            outTotalQuantity: 0,
            outTransactions: 0,
            outLastDate: null,
            // 기간별 통계
            dailyStats: {},
            weeklyStats: {},
            monthlyStats: {},
            yearlyStats: {},
            totalTransactions: 0
          };
        }
        
        const s = stats[productId];
        const txDate = new Date(t.date);
        s.outTotalQuantity += t.quantity;
        s.outTransactions += 1;
        s.totalTransactions += 1;
        if (!s.outLastDate || txDate > new Date(s.outLastDate)) {
          s.outLastDate = t.date;
        }
        
        // 기간별 통계
        const dayKey = getDateKey(t.date, 'day');
        const weekKey = getDateKey(t.date, 'week');
        const monthKey = getDateKey(t.date, 'month');
        const yearKey = getDateKey(t.date, 'year');
        
        s.dailyStats[dayKey] = s.dailyStats[dayKey] || { quantity: 0, transactions: 0 };
        s.dailyStats[dayKey].quantity += t.quantity;
        s.dailyStats[dayKey].transactions += 1;
        
        s.weeklyStats[weekKey] = s.weeklyStats[weekKey] || { quantity: 0, transactions: 0 };
        s.weeklyStats[weekKey].quantity += t.quantity;
        s.weeklyStats[weekKey].transactions += 1;
        
        s.monthlyStats[monthKey] = s.monthlyStats[monthKey] || { quantity: 0, transactions: 0 };
        s.monthlyStats[monthKey].quantity += t.quantity;
        s.monthlyStats[monthKey].transactions += 1;
        
        s.yearlyStats[yearKey] = s.yearlyStats[yearKey] || { quantity: 0, transactions: 0 };
        s.yearlyStats[yearKey].quantity += t.quantity;
        s.yearlyStats[yearKey].transactions += 1;
      }
    });

    return stats;
  }, [transactions, dealerStatsFilter.dateFrom, dealerStatsFilter.dateTo]);

  // 창고/대리점 ID 매핑 객체 (필터링 성능 최적화)
  const locationMappings = useMemo(() => {
    const warehouseMap = {};
    const dealerMap = {};
    
    warehouses.forEach(w => {
      warehouseMap[w.id] = { name: w.name, id: w.id };
    });
    
    dealers.forEach(d => {
      dealerMap[d.id] = { name: d.name, id: d.id };
    });
    
    return { warehouseMap, dealerMap };
  }, [warehouses, dealers]);

  // 거래내역 표보기용 날짜 키 생성 (일별)
  const dateKeys = useMemo(() => {
    const result = [];
    const today = new Date();
    const toKey = (d) => d.toISOString().split('T')[0];
    let start = filter.dateFrom ? new Date(filter.dateFrom) : new Date(today);
    if (!filter.dateFrom) {
      start.setDate(start.getDate() - 13); // 최근 14일
    }
    let end = filter.dateTo ? new Date(filter.dateTo) : new Date(today);
    // 최대 31일 가드
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 30);
    if (end > maxEnd) end = maxEnd;
    // normalize
    start = new Date(toKey(start));
    end = new Date(toKey(end));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      result.push(toKey(d));
    }
    return result;
  }, [filter.dateFrom, filter.dateTo]);

  // 창고/상품/일자별 입고/출고 집계
  const ioByWarehouseProductDate = useMemo(() => {
    const set = new Set(dateKeys);
    const warehouseIds = new Set(warehouses.map(w => w.id));
    const acc = {};
    transactions.forEach(tx => {
      if (!tx || !tx.date) return;
      const key = typeof tx.date === 'string' ? tx.date.split('T')[0] : new Date(tx.date).toISOString().split('T')[0];
      if (!set.has(key)) return;
      
      // 입고: 목적지가 창고인 경우
      if (warehouseIds.has(tx.toLocation)) {
        const wid = tx.toLocation; const pid = tx.productId;
        acc[wid] = acc[wid] || {}; acc[wid][pid] = acc[wid][pid] || {}; acc[wid][pid][key] = acc[wid][pid][key] || { inQty: 0, outQty: 0 };
        acc[wid][pid][key].inQty += Number(tx.quantity) || 0;
      }
      
      // 출고: 출발지가 창고인 경우
      if (warehouseIds.has(tx.fromLocation) && tx.status !== '대기') {
        const wid = tx.fromLocation; const pid = tx.productId;
        acc[wid] = acc[wid] || {}; acc[wid][pid] = acc[wid][pid] || {}; acc[wid][pid][key] = acc[wid][pid][key] || { inQty: 0, outQty: 0 };
        acc[wid][pid][key].outQty += Number(tx.quantity) || 0;
      }
    });
    return acc;
  }, [transactions, warehouses, dateKeys]);
  
  // 필터링된 거래내역 (useMemo로 메모이제이션 및 성능 최적화)
  const filteredTransactions = useMemo(() => {
    const { warehouseMap, dealerMap } = locationMappings;
    
    return groupedTransactions.filter(group => {
      let matchesType = false;
      if (filter.type === 'all') {
        matchesType = true;
      } else if (filter.type === 'import') {
        matchesType = getTransactionTypeInfo(group).label === '수입';
      } else if (filter.type === 'adjustment') {
        matchesType = getTransactionTypeInfo(group).label === '재고 조정';
      } else {
        matchesType = group.type === filter.type;
      }      
      const matchesFromLocation = !filter.fromLocation || 
                            group.items.some(item => {
                              const srcId = item.fromLocation;
                              if (!srcId || srcId === '외부') return '외부'.includes(filter.fromLocation);
                              if (srcId === 'adjustment') return '재고 조정'.includes(filter.fromLocation);
                              const w = warehouseMap[srcId];
                              if (w) return (w.name + w.id).toLowerCase().includes(filter.fromLocation.toLowerCase());
                              const d = dealerMap[srcId];
                              if (d) return (d.name + d.id).toLowerCase().includes(filter.fromLocation.toLowerCase());
                              return srcId.toLowerCase().includes(filter.fromLocation.toLowerCase());
                            });
      
      const matchesToLocation = !filter.toLocation || 
                            group.items.some(item => {
                              const destId = item.toLocation;
                              if (destId === 'adjustment') return '재고 조정'.includes(filter.toLocation);
                              const w = warehouseMap[destId];
                              if (w) return (w.name + w.id).toLowerCase().includes(filter.toLocation.toLowerCase());
                              const d = dealerMap[destId];
                              if (d) return (d.name + d.id).toLowerCase().includes(filter.toLocation.toLowerCase());
                              return destId.toLowerCase().includes(filter.toLocation.toLowerCase());
                            });
      
      const matchesProduct = !filter.product || 
                           group.items.some(item => {
                             const searchTerm = filter.product.toLowerCase();
                             const pName = (item.productName || '').toLowerCase();
                             const pCode = (item.productCode || '').toLowerCase();
                             const product = products.find(p => p.id === item.productId);
                             const pBarcode = (product && product.barcode) ? String(product.barcode).toLowerCase() : '';
                             return pName.includes(searchTerm) || pCode.includes(searchTerm) || pBarcode.includes(searchTerm);
                           });
      
      const cleanSearchTerm = (filter.note || '').toLowerCase().replace(/^shp-/, '').trim();
      
      const matchesNote = !filter.note || 
                         group.items.some(item => 
                           (item.note || '').toLowerCase().includes(cleanSearchTerm) ||
                           String(item.id).toLowerCase().includes(cleanSearchTerm)
                         ) ||
                         (group.note || '').toLowerCase().includes(cleanSearchTerm) ||
                         String(group.id).toLowerCase().includes(cleanSearchTerm);
      
      const matchesDateFrom = !filter.dateFrom || group.date >= filter.dateFrom;
      const matchesDateTo = !filter.dateTo || group.date <= filter.dateTo;
      
      return matchesType && matchesFromLocation && matchesToLocation && matchesProduct && matchesNote && matchesDateFrom && matchesDateTo;
    }).sort((a, b) => {
      const dir = filter.sortOrder === 'asc' ? 1 : -1;
      const key = filter.sortBy;
      const val = (g, field) => {
        switch (field) {
          case 'date': return g.date || '';
          case 'type': return g.type || '';
          case 'product': return g.items.length === 1 ? (g.items[0].productName || '') : `${g.items.length}개 상품`;
          case 'quantity': return g.items.length === 1 ? (parseInt(g.items[0].quantity, 10) || 0) : g.items.reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0);
          case 'from':
            if (g.items.length === 1) return g.items[0].fromLocation || '';
            {
              const set = [...new Set(g.items.map(it => it.fromLocation))];
              return set.length === 1 ? (set[0] || '') : '다양';
            }
          case 'to':
            if (g.items.length === 1) return g.items[0].toLocation || '';
            {
              const set = [...new Set(g.items.map(it => it.toLocation))];
              return set.length === 1 ? (set[0] || '') : '다양';
            }
          case 'note':
            return (g.items.length === 1 ? (g.items[0].note || '') : (g.note || ''));
          default:
            return g.date || '';
        }
      };
      const av = val(a, key);
      const bv = val(b, key);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [groupedTransactions, filter, locationMappings]);

  // 대시보드 통계 데이터 (useMemo로 메모이제이션)
  const dashboardStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    const weekStart = thisWeek.toISOString().split('T')[0];
    
    // 오늘 거래 통계
    const todayTransactions = transactions.filter(tx => tx.date === today);
    const todayInbound = todayTransactions.filter(tx => tx.type === 'in').reduce((sum, tx) => sum + tx.quantity, 0);
    const todayOutbound = todayTransactions.filter(tx => tx.type === 'out').reduce((sum, tx) => sum + tx.quantity, 0);
    
    // 이번 주 거래 통계
    const weekTransactions = transactions.filter(tx => tx.date >= weekStart);
    const weekInbound = weekTransactions.filter(tx => tx.type === 'in').reduce((sum, tx) => sum + tx.quantity, 0);
    const weekOutbound = weekTransactions.filter(tx => tx.type === 'out').reduce((sum, tx) => sum + tx.quantity, 0);
    
    // 전체 재고 통계
    const totalInventory = Object.values(inventory).reduce((total, warehouse) => {
      return total + Object.values(warehouse).reduce((sum, qty) => sum + qty, 0);
    }, 0);
    
    // 재고 부족 상품 수
    const lowStockProducts = products.filter(product => {
      return warehouses.some(warehouse => {
        const stock = inventory[warehouse.id]?.[product.id] || 0;
        return stock <= 5; // 5개 이하를 재고 부족으로 간주
      });
    }).length;
    
    // 최근 거래 활동
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    
    return {
      today: {
        inbound: todayInbound,
        outbound: todayOutbound,
        transactions: todayTransactions.length
      },
      week: {
        inbound: weekInbound,
        outbound: weekOutbound,
        transactions: weekTransactions.length
      },
      inventory: {
        total: totalInventory,
        lowStockCount: lowStockProducts,
        warehouseCount: warehouses.length,
        productCount: products.length
      },
      recent: recentTransactions
    };
  }, [transactions, inventory, warehouses, products]);

  // 페이지네이션된 거래내역 (useMemo로 메모이제이션)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // 총 페이지 수 계산
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // 페이지 변경 핸들러 (useCallback으로 메모이제이션)
  const handlePageChange = useCallback((event, value) => {
    setCurrentPage(value);
  }, []);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // 키보드 단축키 지원 (useEffect로 전역 키보드 이벤트 처리)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // ESC 키로 모달 닫기
      if (event.key === 'Escape') {
        if (openDialog) {
          handleCloseDialog();
        } else if (transactionDetailOpen) {
          closeTransactionDetail();
        } else if (warehouseDetailOpen) {
          setWarehouseDetailOpen(false);
        } else if (excelUploadOpen) {
          handleCloseExcelUpload();
        } else if (barcodeScannerOpen) {
          setBarcodeScannerOpen(false);
          setCurrentScanningRow(null);
        }
      }
      
      // Enter 키로 상품 행 추가 (입출고 등록 모달이 열려있을 때)
      if (event.key === 'Enter' && openDialog && !event.shiftKey) {
        event.preventDefault();
        addIoProductRow();
      }
      
      // Ctrl+N으로 새 입출고 등록
      if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        if (!openDialog) {
          handleOpenDialog('in');
        }
      }
      
      // Ctrl+F로 필터 포커스
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        // 필터 입력 필드에 포커스 (실제 구현 시 ref 사용)
      }
    };

    // 단축키 전체 보류: 전역 단축키 리스너 등록을 임시로 중단
    const shortcutsEnabled = false; // 재개 시 true로 변경
    if (!shortcutsEnabled) {
      return;
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDialog, transactionDetailOpen, warehouseDetailOpen, excelUploadOpen, barcodeScannerOpen]);

  // 바코드 스캔 핸들러 (useCallback으로 메모이제이션)
  const handleBarcodeScan = useCallback((barcode) => {
    if (currentScanningRow !== null) {
      // 상품 코드로 상품 찾기
      const product = products.find(p => p.code === barcode);
      if (product) {
        // 해당 행의 상품을 바코드로 스캔한 상품으로 설정
        const updatedProducts = [...multipleIoProducts];
        updatedProducts[currentScanningRow] = {
          ...updatedProducts[currentScanningRow],
          productId: product.id,
          product: product
        };
        setMultipleIoProducts(updatedProducts);
        showSnackbar(`상품이 스캔되었습니다: ${product.name}`, 'success');
      } else {
        showSnackbar('해당 바코드의 상품을 찾을 수 없습니다.', 'error');
      }
    }
    setBarcodeScannerOpen(false);
    setCurrentScanningRow(null);
  }, [currentScanningRow, products, multipleIoProducts]);

  // 바코드 스캔 시작 (useCallback으로 메모이제이션)
  const startBarcodeScan = useCallback((rowIndex) => {
    setCurrentScanningRow(rowIndex);
    setBarcodeScannerOpen(true);
  }, []);

  // 바코드 스캔 에러 핸들러 (useCallback으로 메모이제이션)
  const handleBarcodeScanError = useCallback((error) => {
    showSnackbar(`바코드 스캔 오류: ${error}`, 'error');
    setBarcodeScannerOpen(false);
    setCurrentScanningRow(null);
  }, []);

  // 드래그 앤 드롭 핸들러 (useCallback으로 메모이제이션)
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setExcelFile(file);
        handleExcelFileUpload({ target: { files: [file] } });
      } else {
        showSnackbar('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.', 'error');
      }
    }
  }, []);
  const handleDirectInventoryEdit = async (warehouseId, productId, currentQty, newQty, reason) => {
    if (newQty === currentQty) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const delta = newQty - currentQty;
    const isOut = delta < 0;
    const absQty = Math.abs(delta);
    
    const transaction = {
      groupId: `TX-${Date.now()}`,
      type: isOut ? 'out' : 'in',
      productId: parseInt(productId, 10),
      productName: product.name,
      productCode: product.code || '',
      productSupplier: product.supplier || '-',
      quantity: absQty,
      fromLocation: isOut ? warehouseId : 'direct_edit',
      toLocation: isOut ? 'direct_edit' : warehouseId,
      date: new Date().toISOString().split('T')[0],
      boxNo: '',
      note: `${reason || '\uc7ac\uace0 \ud604\ud669\uc5d0\uc11c \uc9c1\uc811 \uc218\uc815'} [${currentQty} -> ${newQty}]`,
      additionalNote: `\uae30\uc874: ${currentQty} -> \ubcc0\uacbd: ${newQty}`,
      createdAt: new Date().toISOString(),
      isGrouped: false,
      status: '\uc644\ub8cc'
    };
    
    try {
      // 1. \ud2b8\ub79c\uc7ad\uc158 \uae30\ub85d \uc0dd\uc131
      await transactionApi.createMany([transaction]);
      
      // 2. \ud574\ub2f9 \uc140\ub9cc \uc9c1\uc811 DB \uc5c5\ub370\uc774\ud2b8 (\uc804\uccb4 \uc7ac\uacc4\uc0b0 \ub300\uc2e0)
      await inventoryApi.upsertMany([{
        warehouse_id: warehouseId,
        product_id: parseInt(productId, 10),
        quantity: newQty
      }]);
      
      // 3. \ub85c\uceec \uc0c1\ud0dc \uc989\uc2dc \ubc18\uc601
      setInventory(prev => ({
        ...prev,
        [warehouseId]: {
          ...prev[warehouseId],
          [productId]: newQty
        }
      }));
      
      // 4. \ud2b8\ub79c\uc7ad\uc158 \ub9ac\uc2a4\ud2b8 \uac31\uc2e0
      const latest = await transactionApi.getAll();
      setTransactions(latest);
      
      showSnackbar('\uc7ac\uace0\uac00 \uc218\uc815\ub418\uc5c8\uc2b5\ub2c8\ub2e4.', 'success');
      
      // 5. \uc7ac\uace0 \ubd80\uc871 \uc54c\ub9bc \uccb4\ud06c
      const latestInv = await fetchInventoryData();
      if (latestInv) {
        checkAndSendLowStockAlerts(latestInv, products, warehouses, [parseInt(productId, 10)]).catch(err => {
          console.warn('[InventoryAlert] \uc54c\ub9bc \uccb4\ud06c \uc2e4\ud328:', err);
        });
      }
    } catch (err) {
      console.error(err);
      showSnackbar('\uc7ac\uace0 \uc218\uc815 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.', 'error');
    }
  };


  const contextValue = {
    openDialog, setOpenDialog, warehouseDetailOpen, setWarehouseDetailOpen,
    warehouseDetailTarget, setWarehouseDetailTarget, warehouseDetailSearch, setWarehouseDetailSearch,
    warehouseDetailFilter, setWarehouseDetailFilter, warehouseDetailBelow, setWarehouseDetailBelow,
    dealerStatsFilter, setDealerStatsFilter, overallSearch, setOverallSearch, overallStockFilter, setOverallStockFilter,
    excelUploadOpen, setExcelUploadOpen, excelFile, setExcelFile, transactionViewMode, setTransactionViewMode,
    tableModalOpen, setTableModalOpen, selectedTableTransactions, setSelectedTableTransactions,
    selectedTransactions, setSelectedTransactions, hoverAnchorEl, setHoverAnchorEl, hoverTransactions, setHoverTransactions,
    excelData, setExcelData, excelUploadType, setExcelUploadType, transactionDetailOpen, setTransactionDetailOpen,
    selectedTransaction, setSelectedTransaction, editMode, setEditMode, editFormData, setEditFormData,
    editProducts, setEditProducts, dialogType, setDialogType, transactions, setTransactions, inventory, setInventory,
    pendingInventory, setPendingInventory, loading, setLoading, snackbar, setSnackbar, warehouses, setWarehouses,
    dealers, setDealers, formData, setFormData, multipleIoProducts, setMultipleIoProducts, products, setProducts,
    filter, setFilter, dateFilter, setDateFilter, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, barcodeScannerOpen, setBarcodeScannerOpen,
    currentScanningRow, setCurrentScanningRow, isDragOver, setIsDragOver, groupedTransactions, dealerStats,
    warehouseStats, totalInboundStats, productStats, locationMappings, dateKeys, ioByWarehouseProductDate,
    filteredTransactions, dashboardStats, paginatedTransactions, fetchProducts, fetchWarehouses, fetchDealers,
    fetchTransactions, fetchInventoryData, handleLocationUpdate, toggleWarehouseSync,
    openWarehouseDetail, closeWarehouseDetail, openTransactionDetail, closeTransactionDetail, startEditTransaction,
    cancelEditTransaction, addEditProduct, removeEditProduct, updateEditProduct, saveEditTransaction,
    handleCloseDialog, handleOpenDialog, addIoProductRow, removeIoProductRow,
    updateIoProductRow, handleExcelFileUpload, handleCloseExcelUpload,
    handleOpenExcelUpload, showSnackbar, getTransactionTypeInfo, formatLocationName,
    handleDeleteSelectedTransactions, handleViewOriginal, handleDateFilterClick, handleTableCellClick,
    handleTableCellHover, handleTableCellHoverLeave, handlePageChange, handleBarcodeScan, startBarcodeScan,
    handleBarcodeScanError, handleDragOver, handleDragLeave, handleDrop,
    totalPages, recalculateAllInventory, deleteTransaction,
    batchFromLocation, setBatchFromLocation, batchToLocation, setBatchToLocation, showOriginalHistory, setShowOriginalHistory, handleSubmitTransaction, downloadExcelTemplate, handleExcelDataSubmit, handleBatchApplyLocation, handleDirectInventoryEdit};

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <Outlet context={contextValue} />
    </Box>
  );
}

export default InventoryLayout;