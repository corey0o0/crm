import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ExcelJS from 'exceljs';
import BarcodeInspectTab from './tabs/BarcodeInspectTab';
import StoreOnlineOutboundTab from './tabs/StoreOnlineOutboundTab';
import BoxStatusTab from './tabs/BoxStatusTab';
import Cafe24InventoryReconciliation from './Cafe24InventoryReconciliation';
import {
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
  Checkbox
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
import { useLocation } from 'react-router-dom';
import LocationManagement from './LocationManagement';
import BarcodeScanner from './BarcodeScanner';
import { productApi } from '../../api/productApi';
import { warehouseApi } from '../../api/warehouseApi';
import { agencyApi as dealerApi } from '../../api/agencyApi';
import { transactionApi } from '../../api/transactionApi';
import { inventoryApi } from '../../api/inventoryApi';
import { supabase } from '../../lib/supabaseClient';
import { fetchFromSupabase } from '../../utils/restApiUtils';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';

// 창고 및 대리점 코드를 숨기고 이름만 표시하는 유틸리티
const formatLocationName = (locationId, warehouses, dealers) => {
  if (!locationId || locationId === '외부') return '외부';
  const warehouse = warehouses.find(w => w.id === locationId);
  if (warehouse) return warehouse.name;
  const dealer = dealers.find(d => d.id === locationId);
  if (dealer) return dealer.name;
  // 문자열 자체에 코드가 괄호로 포함된 경우 제거 (예: 청담 반포 (W002) -> 청담 반포)
  return String(locationId).replace(/\s*\([A-Za-z0-9_-]+\)$/, '').trim();
};

function InventoryManagement() {
  const [activeTab, setActiveTab] = useState(0);
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
  const [overallStockFilter, setOverallStockFilter] = useState('inStock'); // 기본: 재고 있음

  // 엑셀 업로드 관련 상태
  const [excelUploadOpen, setExcelUploadOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  // 거래내역 보기 모드: 'list' | 'table'
  const [transactionViewMode, setTransactionViewMode] = useState('list');
  
  // 표보기 클릭된 거래 모달 상태
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [selectedTableTransactions, setSelectedTableTransactions] = useState([]);
  
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  
  const handleDeleteSelectedTransactions = async () => {
    if (selectedTransactions.length === 0) return;
    if (!window.confirm(`선택한 ${selectedTransactions.length}개의 거래내역을 삭제하시겠습니까?`)) return;
    try {
      for (const selectedId of selectedTransactions) {
        // 그룹 ID인지 단일 내역 ID인지 확인 (selectedId가 문자열일 수 있으므로 형변환 비교)
        const itemsInGroup = transactions.filter(t => t.groupId != null && String(t.groupId) === String(selectedId));
        
        if (itemsInGroup.length > 0) {
          // 그룹 거래인 경우 일괄 삭제 API 활용
          await transactionApi.deleteByGroupId(selectedId);
        } else {
          // 단일 거래인 경우
          await transactionApi.delete(selectedId);
        }
      }
      
      const updatedTransactions = await transactionApi.getAll();
      setTransactions(updatedTransactions);
      setSelectedTransactions([]);
      
      setTimeout(() => {
        recalculateInventoryFromTransactions();
      }, 100);
      
      showSnackbar(`선택한 거래내역이 삭제되었습니다.`, 'success');
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

  // 상품 데이터
  const [products, setProducts] = useState([]);

  // 필터 상태
  const [filter, setFilter] = useState({
    dateFrom: '',
    dateTo: '',
    fromLocation: '',
    toLocation: '',
    product: '',
    note: '',
    type: 'all', // 'all' | 'in' | 'out'
    // 정렬 키/순서
    sortBy: 'date', // 'date' | 'type' | 'product' | 'quantity' | 'from' | 'to' | 'note'
    sortOrder: 'desc' // 'asc' | 'desc'
  });

  // 날짜 필터 버튼 상태
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // 페이지당 50개 항목
  
  // 바코드 스캔 상태
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [currentScanningRow, setCurrentScanningRow] = useState(null); // 현재 스캔 중인 행 인덱스
  
  // 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'outbound_scan') {
      setActiveTab(2); // 매장/온라인 출고 탭
    } else if (tabParam === 'inventory_status') {
      setActiveTab(3); // 재고 현황 탭
    } else if (tabParam === 'inventory_stats') {
      setActiveTab(5); // 입출고 통계 탭
    } else if (!tabParam) {
      setActiveTab(0); // 기본 대시보드 탭
    }
  }, [location.search]);

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
    if (products.length > 0 && warehouses.length > 0 && transactions.length >= 0) {
      // 거래내역을 기반으로 재고 계산
      const timer = setTimeout(() => {
        recalculateInventoryFromTransactions();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [warehouses, dealers, products, transactions]);

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

  // 거래내역을 기반으로 창고 재고 재계산
  const recalculateInventoryFromTransactions = async () => {
    let latestTransactions = [];
    
    try {
      // 1) 서버에서 최신 거래내역 다시 가져오기
      latestTransactions = await transactionApi.getAll();

      // 2) 베이스 인벤토리 생성 (연동 창고는 상품 재고, 독립 창고는 0)
      const recalculatedInventory = {};
      const recalculatedPendingInventory = {};
      warehouses.forEach(warehouse => {
        recalculatedInventory[warehouse.id] = {};
        recalculatedPendingInventory[warehouse.id] = {};
        products.forEach(product => {
          recalculatedInventory[warehouse.id][product.id] = warehouse.syncWithProductStock
            ? (product.stock || 0)
            : 0;
          recalculatedPendingInventory[warehouse.id][product.id] = 0;
        });
      });

      // 3) 거래내역을 날짜순으로 적용하여 재고 재계산
      const sorted = [...latestTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
      sorted.forEach(transaction => {
        // 출고 대기 수량 집계 (type='out' && status='대기')
        if (transaction.type === 'out' && transaction.status === '대기') {
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (!recalculatedPendingInventory[transaction.fromLocation]) recalculatedPendingInventory[transaction.fromLocation] = {};
            if (!recalculatedPendingInventory[transaction.fromLocation][transaction.productId]) recalculatedPendingInventory[transaction.fromLocation][transaction.productId] = 0;
            recalculatedPendingInventory[transaction.fromLocation][transaction.productId] += transaction.quantity;
          }
        }
        if (transaction.type === 'in') {
          // 목적지가 창고인 경우 증가
          if (warehouses.find(w => w.id === transaction.toLocation)) {
            if (!recalculatedInventory[transaction.toLocation]) {
              recalculatedInventory[transaction.toLocation] = {};
            }
            if (!recalculatedInventory[transaction.toLocation][transaction.productId]) {
              recalculatedInventory[transaction.toLocation][transaction.productId] = 0;
            }
            recalculatedInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          }
          // 출발지가 창고인 경우 차감
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (recalculatedInventory[transaction.fromLocation] &&
                typeof recalculatedInventory[transaction.fromLocation][transaction.productId] === 'number') {
              recalculatedInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            }
          }
        } else {
          // 출고: 출발지가 창고인 경우 차감
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (recalculatedInventory[transaction.fromLocation] &&
                typeof recalculatedInventory[transaction.fromLocation][transaction.productId] === 'number') {
              recalculatedInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            }
          }
          // 목적지가 창고인 경우 증가 (창고 간 이동)
          if (warehouses.find(w => w.id === transaction.toLocation)) {
            if (!recalculatedInventory[transaction.toLocation]) {
              recalculatedInventory[transaction.toLocation] = {};
            }
            if (!recalculatedInventory[transaction.toLocation][transaction.productId]) {
              recalculatedInventory[transaction.toLocation][transaction.productId] = 0;
            }
            recalculatedInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          }
        }
      });

      // 4) 로컬 상태 업데이트
      setInventory(recalculatedInventory);
      setPendingInventory(recalculatedPendingInventory);
      setTransactions(sorted);

      // 5) 서버에 일괄 반영 (0 포함하여 완전 동기화)
      const updates = [];
      Object.entries(recalculatedInventory).forEach(([warehouseId, productMap]) => {
        Object.entries(productMap).forEach(([productId, quantity]) => {
          updates.push({ warehouse_id: warehouseId, product_id: parseInt(productId, 10), quantity });
        });
      });
      if (updates.length > 0) {
        await inventoryApi.upsertMany(updates);
      }
      
      console.log('거래내역 기반으로 재고를 재계산하고 서버에 반영했습니다.');
    } catch (error) {
      console.error('재고 재계산 실패:', error);
      // 서버 실패 시 기존 방식으로 재계산
      const recalculatedInventory = {};
      const recalculatedPendingInventory = {};
      
      // 창고별 재고 초기화
      warehouses.forEach(warehouse => {
        recalculatedInventory[warehouse.id] = {};
        recalculatedPendingInventory[warehouse.id] = {};
        products.forEach(product => {
          if (warehouse.syncWithProductStock) {
            recalculatedInventory[warehouse.id][product.id] = product.stock || 0;
          } else {
            recalculatedInventory[warehouse.id][product.id] = 0;
          }
          recalculatedPendingInventory[warehouse.id][product.id] = 0;
        });
      });

      // 거래내역을 시간순으로 정렬하여 재고 계산 (로컬 상태 사용)
      const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      sortedTransactions.forEach(transaction => {
        if (transaction.type === 'out' && transaction.status === '대기') {
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (!recalculatedPendingInventory[transaction.fromLocation]) recalculatedPendingInventory[transaction.fromLocation] = {};
            if (!recalculatedPendingInventory[transaction.fromLocation][transaction.productId]) recalculatedPendingInventory[transaction.fromLocation][transaction.productId] = 0;
            recalculatedPendingInventory[transaction.fromLocation][transaction.productId] += transaction.quantity;
          }
        }
        if (transaction.type === 'in') {
          // 입고 처리
          if (warehouses.find(w => w.id === transaction.toLocation)) {
            if (!recalculatedInventory[transaction.toLocation]) {
              recalculatedInventory[transaction.toLocation] = {};
            }
            if (!recalculatedInventory[transaction.toLocation][transaction.productId]) {
              recalculatedInventory[transaction.toLocation][transaction.productId] = 0;
            }
            recalculatedInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          }
          
          // 출발지가 창고인 경우 재고 차감
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (recalculatedInventory[transaction.fromLocation] && 
                recalculatedInventory[transaction.fromLocation][transaction.productId]) {
              recalculatedInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            }
          }
        } else {
          // 출고 처리
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (recalculatedInventory[transaction.fromLocation] && 
                recalculatedInventory[transaction.fromLocation][transaction.productId]) {
              recalculatedInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            }
          }
          
          // 목적지가 창고인 경우 재고 증가
          if (warehouses.find(w => w.id === transaction.toLocation)) {
            if (!recalculatedInventory[transaction.toLocation]) {
              recalculatedInventory[transaction.toLocation] = {};
            }
            if (!recalculatedInventory[transaction.toLocation][transaction.productId]) {
              recalculatedInventory[transaction.toLocation][transaction.productId] = 0;
            }
            recalculatedInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          }
        }
      });

      setInventory(recalculatedInventory);
      setPendingInventory(recalculatedPendingInventory);
      console.log('거래내역을 기반으로 창고 재고를 재계산했습니다.');
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
        recalculateInventoryFromTransactions();
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
        recalculateInventoryFromTransactions();
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
        // 그룹 편집: 기존 그룹 삭제 후 재생성
        const groupId = selectedTransaction.groupId || selectedTransaction.id;
        await transactionApi.deleteByGroupId(groupId);

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
            productSupplier: item.product.supplier || 'NEARBIKE',
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

        await transactionApi.createMany(newRows);
      } else {
        // 단일 편집: 단일 트랜잭션 업데이트
        const item = editProducts[0];
        const payload = {
          ...selectedTransaction,
          type: selectedTransaction.type,
          productId: parseInt(item.product?.id ?? selectedTransaction.productId, 10),
          productName: item.product?.name ?? selectedTransaction.productName,
          productCode: item.product?.code ?? selectedTransaction.productCode ?? null,
          productSupplier: item.product?.supplier ?? selectedTransaction.productSupplier ?? 'NEARBIKE',
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

      // 서버에서 최신 거래내역 다시 반영
      const latest = await transactionApi.getAll();
      setTransactions(latest);
      // 선택된 거래 초기화
      setSelectedTransaction(null);

      setEditMode(false);
      setEditFormData({});
      setEditProducts([]);
      showSnackbar('거래내역이 수정되었습니다.', 'success');

      // 재고 재계산
      setTimeout(() => {
        recalculateInventoryFromTransactions();
      }, 100);

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
      
      // 서버에서 최신 거래내역 다시 가져오기
      const updatedTransactions = await transactionApi.getAll();
      setTransactions(updatedTransactions);
      
      // 삭제 후 재고 재계산
      setTimeout(() => {
        recalculateInventoryFromTransactions();
      }, 100);
      
      showSnackbar('거래내역이 삭제되었습니다.', 'success');
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

  // 거래 내역 가져오기
  const fetchTransactions = async () => {
    try {
      const transactionsData = await transactionApi.getAll();
      setTransactions(transactionsData);
      console.log(`서버에서 ${transactionsData.length}개의 거래내역을 가져왔습니다.`);
    } catch (error) {
      console.error('거래내역 로딩 실패:', error);
      showSnackbar('거래내역을 불러오는데 실패했습니다.', 'error');
      setTransactions([]);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleOpenDialog = () => {
    setDialogType('io');
    setFormData(prev => ({ ...prev }));
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
    const invalidItems = multipleIoProducts.filter(item => {
      if (!item.productId || !item.quantity) return true;
      const isOutbound = warehouses.find(w => w.id === item.fromLocation);
      if (isOutbound) {
        // 출고: 출발지(창고) 필수, 목적지 필수
        if (!item.fromLocation || !item.toLocation) return true;
        
        // 박스번호(boxNo)는 이제 선택 사항으로 변경됨
        const isToWarehouse = warehouses.find(w => w.id === item.toLocation);
        // if (isToWarehouse && !item.boxNo) return true;

        const available = (inventory[item.fromLocation]?.[parseInt(item.productId) || 0]) || 0;
        return (parseInt(item.quantity) || 0) > available;
      }
      // 입고: 목적지는 창고여야 함
      const toIsWarehouse = warehouses.find(w => w.id === item.toLocation);
      return !toIsWarehouse;
    });

    if (invalidItems.length > 0) {
      showSnackbar('모든 상품의 필수 항목을 올바르게 입력해주세요.', 'error');
      return;
    }

    const groupId = Date.now();
    const newTransactions = [];

    multipleIoProducts.forEach((item, index) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return;
      const isOutbound = warehouses.find(w => w.id === item.fromLocation);

      const transaction = {
        id: groupId + index,
        groupId,
        type: isOutbound ? 'out' : 'in',
        productId: parseInt(item.productId),
        productName: product.name,
        productCode: product.code,
        productSupplier: product.supplier || 'NEARBIKE',
        quantity: parseInt(item.quantity),
        fromLocation: isOutbound ? item.fromLocation : (item.fromLocation || '외부'),
        toLocation: item.toLocation,
        date: formData.date,
        boxNo: item.boxNo || '',
        note: item.note || formData.note,
        additionalNote: item.additionalNote || '',
        createdAt: new Date().toLocaleString(),
        isGrouped: true
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
      newTransactions.forEach(t => updateInventory(t));
      showSnackbar(`입출고 등록이 완료되었습니다. (${newTransactions.length}개 상품)`, 'success');
      handleCloseDialog();
    } catch (error) {
      console.error('입출고 등록 실패:', error);
      showSnackbar('입출고 등록에 실패했습니다.', 'error');
    }
  }, [multipleIoProducts, warehouses, inventory, products, formData, transactions]);

  // (통합됨) 기존 입/출고 개별 처리 함수는 통합 제출 로직으로 대체되었습니다.

  const updateInventory = async (transaction) => {
    setInventory(prev => {
      const newInventory = { ...prev };
      
      if (transaction.type === 'in') {
        // 입고 처리 - 목적지가 창고인 경우만 재고 증가
        if (warehouses.find(w => w.id === transaction.toLocation)) {
          if (!newInventory[transaction.toLocation]) {
            newInventory[transaction.toLocation] = {};
          }
          if (!newInventory[transaction.toLocation][transaction.productId]) {
            newInventory[transaction.toLocation][transaction.productId] = 0;
          }
          newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          
          // 서버에 재고 업데이트
          inventoryApi.upsert(transaction.toLocation, transaction.productId, newInventory[transaction.toLocation][transaction.productId]);
          
          // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
          const warehouse = warehouses.find(w => w.id === transaction.toLocation);
          if (warehouse?.syncWithProductStock) {
            updateProductStock(transaction.productId, transaction.quantity, 'increase');
          }
        }
        
        // 출발지가 창고/대리점인 경우 (창고→창고, 대리점→창고 이동) 출발지에서 재고 차감
        if (warehouses.find(w => w.id === transaction.fromLocation)) {
          if (newInventory[transaction.fromLocation] && 
              newInventory[transaction.fromLocation][transaction.productId]) {
            newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            
            // 서버에 재고 업데이트
            inventoryApi.upsert(transaction.fromLocation, transaction.productId, newInventory[transaction.fromLocation][transaction.productId]);
            
            // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
            const warehouse = warehouses.find(w => w.id === transaction.fromLocation);
            if (warehouse?.syncWithProductStock) {
              updateProductStock(transaction.productId, -transaction.quantity, 'decrease');
            }
          }
        }
      } else {
        // 출고 처리 - 출발지가 창고인 경우만 재고 차감
        if (warehouses.find(w => w.id === transaction.fromLocation)) {
          if (newInventory[transaction.fromLocation] && 
              newInventory[transaction.fromLocation][transaction.productId]) {
            newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            
            // 서버에 재고 업데이트
            inventoryApi.upsert(transaction.fromLocation, transaction.productId, newInventory[transaction.fromLocation][transaction.productId]);
            
            // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
            const warehouse = warehouses.find(w => w.id === transaction.fromLocation);
            if (warehouse?.syncWithProductStock) {
              updateProductStock(transaction.productId, -transaction.quantity, 'decrease');
            }
          }
        }
        
        // 목적지가 창고인 경우만 재고 증가 (창고→창고 이동)
        if (warehouses.find(w => w.id === transaction.toLocation)) {
          if (!newInventory[transaction.toLocation]) {
            newInventory[transaction.toLocation] = {};
          }
          if (!newInventory[transaction.toLocation][transaction.productId]) {
            newInventory[transaction.toLocation][transaction.productId] = 0;
          }
          newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          
          // 서버에 재고 업데이트
          inventoryApi.upsert(transaction.toLocation, transaction.productId, newInventory[transaction.toLocation][transaction.productId]);
          
          // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
          const warehouse = warehouses.find(w => w.id === transaction.toLocation);
          if (warehouse?.syncWithProductStock) {
            updateProductStock(transaction.productId, transaction.quantity, 'increase');
          }
        }
        
        // 목적지가 대리점인 경우는 재고 관리하지 않음 (출고 기록만)
      }
      
      return newInventory;
    });
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
          const orderNumber = rowData[1]; // B열: 주문번호
          const orderSource = rowData[2]; // C열: 주문처
          const note = rowData[3]; // D열: 비고
          
          if (!orderNumber || orderNumber.toString().trim() === '') return;
          
          dynamicProductColumns.forEach(product => {
            const quantity = parseInt(rowData[product.col]) || 0;
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
        // 기존 형식 처리
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // 헤더 행 건너뛰기
          
          const rowData = row.values;
          if (rowData.length >= 6 && rowData[2]) { // 최소 필수 데이터 확인
            const item = {
              productCode: rowData[2] || '', // C열: 상품코드
              productName: rowData[3] || '', // D열: 상품명
              quantity: parseInt(rowData[4]) || 0, // E열: 수량
              fromLocation: rowData[5] || '', // F열: 출발지
              toLocation: rowData[6] || '', // G열: 목적지
              note: rowData[7] || '', // H열: 메모
              additionalNote: rowData[8] || '' // I열: 개별메모
            };
            data.push(item);
          }
        });
      }

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

    const groupId = Date.now();
    const newTransactions = [];
    const inventoryUpdates = [];
    let inboundCount = 0;
    let outboundCount = 0;

    excelData.forEach((item, index) => {
      const product = products.find(p => {
        if (p.code === item.productCode) return true;
        
        // 파츠 이름으로 매칭 시도 (공백 및 대소문자 무시)
        const dbNameStr = (p.name || '').replace(/\s+/g, '').toLowerCase();
        const searchStr = (item.parsedColName || item.productName || item.productCode || '').replace(/\s+/g, '').toLowerCase();
        
        if (dbNameStr && searchStr && (dbNameStr === searchStr || dbNameStr.includes(searchStr) || searchStr.includes(dbNameStr))) {
          return true;
        }
        return false;
      });
      
      if (product) {
        // 출발지/목적지로 입고/출고 판단
        const isInbound = item.fromLocation === '외부' || !item.fromLocation || item.fromLocation === '';
        const transactionType = isInbound ? 'in' : 'out';
        
        if (isInbound) inboundCount++;
        else outboundCount++;

        const transaction = {
          id: groupId + index,
          groupId: groupId,
          type: transactionType,
          productId: parseInt(product.id),
          productName: product.name,
          productCode: product.code,
          productSupplier: product.supplier || 'NEARBIKE',
          quantity: item.quantity,
          fromLocation: item.fromLocation || (isInbound ? '외부' : ''),
          toLocation: item.toLocation,
          date: formData.date,
          note: item.note || formData.note,
          additionalNote: item.additionalNote || '',
          createdAt: new Date().toLocaleString(),
          isGrouped: true
        };
        
        newTransactions.push(transaction);
        inventoryUpdates.push(transaction);
      }
    });

    if (newTransactions.length === 0) {
      showSnackbar('유효한 상품 데이터가 없습니다.', 'error');
      return;
    }

    try {
      // 서버에 거래내역 저장
      await transactionApi.createMany(newTransactions);
      
      // 거래 내역 업데이트
      const updatedTransactions = [...newTransactions, ...transactions];
      setTransactions(updatedTransactions);
      
      // 재고 업데이트
      inventoryUpdates.forEach(transaction => {
        updateInventory(transaction);
      });
      
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
      { header: '상품명', key: 'productName', width: 20 },
      { header: '수량', key: 'quantity', width: 10 },
      { header: '출발지', key: 'fromLocation', width: 15 },
      { header: '목적지', key: 'toLocation', width: 15 },
      { header: '메모', key: 'note', width: 20 },
      { header: '개별메모', key: 'additionalNote', width: 20 }
    ];

    // 샘플 데이터 추가 (입고 예시)
    worksheet.addRow({
      colA: '1',
      colB: '1',
      productCode: 'NB001',
      productName: '샘플 상품 (입고)',
      quantity: 10,
      fromLocation: '외부',
      toLocation: 'W001',
      note: '입고 샘플 메모',
      additionalNote: '개별 메모'
    });

    // 샘플 데이터 추가 (출고 예시)
    worksheet.addRow({
      colA: '2',
      colB: '2',
      productCode: 'NB002',
      productName: '샘플 상품 (출고)',
      quantity: 5,
      fromLocation: 'W001',
      toLocation: 'W002',
      note: '출고 샘플 메모',
      additionalNote: '개별 메모'
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
      { header: 'A', key: 'colA', width: 15 },
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
      colA: '20250930-0000031',
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
    
    return Object.values(grouped);
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
      const matchesType = filter.type === 'all' || group.type === filter.type;
      
      const matchesFromLocation = !filter.fromLocation || 
                            group.items.some(item => {
                              const srcId = item.fromLocation;
                              if (!srcId || srcId === '외부') return '외부'.includes(filter.fromLocation);
                              const w = warehouseMap[srcId];
                              if (w) return (w.name + w.id).toLowerCase().includes(filter.fromLocation.toLowerCase());
                              const d = dealerMap[srcId];
                              if (d) return (d.name + d.id).toLowerCase().includes(filter.fromLocation.toLowerCase());
                              return srcId.toLowerCase().includes(filter.fromLocation.toLowerCase());
                            });
      
      const matchesToLocation = !filter.toLocation || 
                            group.items.some(item => {
                              const destId = item.toLocation;
                              const w = warehouseMap[destId];
                              if (w) return (w.name + w.id).toLowerCase().includes(filter.toLocation.toLowerCase());
                              const d = dealerMap[destId];
                              if (d) return (d.name + d.id).toLowerCase().includes(filter.toLocation.toLowerCase());
                              return destId.toLowerCase().includes(filter.toLocation.toLowerCase());
                            });
      
      const matchesProduct = !filter.product || 
                           group.items.some(item => 
                             item.productName.toLowerCase().includes(filter.product.toLowerCase())
                           );
      
      const matchesNote = !filter.note || 
                         group.items.some(item => 
                           (item.note || '').toLowerCase().includes(filter.note.toLowerCase())
                         ) ||
                         (group.note || '').toLowerCase().includes(filter.note.toLowerCase());
      
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
          case 'quantity': return g.items.length === 1 ? (parseInt(g.items[0].quantity) || 0) : g.items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0);
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

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">
          입출고 관리
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            단축키: ESC(닫기) | Enter(행추가) | Ctrl+N(새등록)
          </Typography>
          {/* 재고 초기화 버튼 숨김 처리 */}
          {false && (
            <Button
              variant="outlined"
              color="warning"
              onClick={async () => {
                if (!window.confirm('모든 창고 재고를 초기화하고 베이스로 재설정할까요?')) return;
                try {
                  // 서버 재고 전체 삭제
                  await inventoryApi.clearAll();

                  // 로컬 초기 베이스 재설정
                  const base = {};
                  warehouses.forEach(warehouse => {
                    base[warehouse.id] = {};
                    products.forEach(product => {
                      base[warehouse.id][product.id] = warehouse.syncWithProductStock ? (product.stock || 0) : 0;
                    });
                  });
                  setInventory(base);

                  // 서버에 일괄 반영
                  const updates = [];
                  Object.entries(base).forEach(([warehouseId, productMap]) => {
                    Object.entries(productMap).forEach(([productId, quantity]) => {
                      updates.push({ warehouse_id: warehouseId, product_id: parseInt(productId, 10), quantity });
                    });
                  });
                  if (updates.length > 0) {
                    await inventoryApi.upsertMany(updates);
                  }
                  showSnackbar('재고가 초기화되었습니다.', 'success');
                } catch (e) {
                  console.error('재고 초기화 실패:', e);
                  showSnackbar('재고 초기화에 실패했습니다.', 'error');
                }
              }}
              size="small"
            >
              재고 초기화
            </Button>
          )}
          {products.length === 0 && (
            <Alert severity="warning" sx={{ mr: 2 }}>
              상품 데이터가 없습니다. 상품을 먼저 등록/업로드 해주세요.
            </Alert>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenDialog}
            disabled={products.length === 0}
          >
            입출고 등록
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => handleOpenExcelUpload('unified')}
            disabled={products.length === 0}
          >
            엑셀 업로드
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              fetchProducts();
              fetchTransactions();
              setTimeout(() => {
                recalculateInventoryFromTransactions();
              }, 100);
            }}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 탭 메뉴 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="scrollable" 
          scrollButtons 
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              fontSize: '1.05rem',
              fontWeight: 600,
              px: { xs: 2, sm: 3 }
            }
          }}
        >
          <Tab label="대시보드" />
          <Tab label="거래 내역" />
          <Tab label="매장/온라인 출고" />
          <Tab label="재고 현황" />
          <Tab label="박스 관리" />
          <Tab label="입출고 통계" />
          <Tab label="창고/대리점 관리" />
          <Tab label="카페24 재고 비교" />
        </Tabs>
      </Box>

      {/* 탭 컨텐츠 */}

      {/* 대시보드 탭 */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3 }}>
            📊 입출고 관리 대시보드
          </Typography>
          
          {/* 주요 지표 카드들 */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* 오늘 거래 현황 */}
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                  {dashboardStats.today.transactions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  오늘 거래 건수
                </Typography>
              </Card>
            </Grid>
            
            {/* 오늘 입고량 */}
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main" sx={{ fontWeight: 'bold' }}>
                  {dashboardStats.today.inbound.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  오늘 입고량
                </Typography>
              </Card>
            </Grid>
            
            {/* 오늘 출고량 */}
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="error.main" sx={{ fontWeight: 'bold' }}>
                  {dashboardStats.today.outbound.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  오늘 출고량
                </Typography>
              </Card>
            </Grid>
            
            {/* 전체 재고량 */}
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main" sx={{ fontWeight: 'bold' }}>
                  {dashboardStats.inventory.total.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  전체 재고량
                </Typography>
              </Card>
            </Grid>
          </Grid>
          
          {/* 주간 통계 및 재고 현황 */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* 이번 주 통계 */}
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  📈 이번 주 통계
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">거래 건수:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {dashboardStats.week.transactions}건
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">총 입고량:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {dashboardStats.week.inbound.toLocaleString()}개
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">총 출고량:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    {dashboardStats.week.outbound.toLocaleString()}개
                  </Typography>
                </Box>
              </Card>
            </Grid>
            
            {/* 재고 현황 */}
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  📦 재고 현황
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">창고 수:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {dashboardStats.inventory.warehouseCount}개
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">상품 수:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {dashboardStats.inventory.productCount}개
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">재고 부족 상품:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold" 
                    color={dashboardStats.inventory.lowStockCount > 0 ? 'warning.main' : 'success.main'}
                  >
                    {dashboardStats.inventory.lowStockCount}개
                  </Typography>
                </Box>
              </Card>
            </Grid>
          </Grid>
          
          {/* 최근 거래 활동 */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🔄 최근 거래 활동
            </Typography>
            {dashboardStats.recent.length > 0 ? (
              <TableContainer>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>날짜</TableCell>
                      <TableCell>유형</TableCell>
                      <TableCell>상품</TableCell>
                      <TableCell align="right">수량</TableCell>
                      <TableCell>출발지</TableCell>
                      <TableCell>목적지</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardStats.recent.map((tx) => {
                      const product = products.find(p => p.id === tx.productId);
                      const fromLocation = formatLocationName(tx.fromLocation, warehouses, dealers);
                      const toLocation = formatLocationName(tx.toLocation, warehouses, dealers);
                      
                      return (
                        <TableRow key={tx.id} hover>
                          <TableCell>{tx.date}</TableCell>
                          <TableCell>
                            <Chip 
                              label={getTransactionTypeInfo(tx).label} 
                              size="small"
                              color={getTransactionTypeInfo(tx).color}
                            />
                          </TableCell>
                          <TableCell>{product?.name || '알 수 없음'}</TableCell>
                          <TableCell align="right">{tx.quantity.toLocaleString()}</TableCell>
                          <TableCell>{fromLocation}</TableCell>
                          <TableCell>{toLocation}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                최근 거래 내역이 없습니다.
              </Typography>
            )}
          </Card>
        </Box>
      )}

      {/* 거래 내역 탭 */}
      {activeTab === 1 && (
        <Box>
          {/* 필터 옵션 */}
          <Card sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              필터 옵션
            </Typography>
            
            {/* 날짜 필터 버튼 */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant={dateFilter === 'all' ? 'contained' : 'outlined'}
                onClick={() => handleDateFilterClick('all')}
              >
                전체
              </Button>
              <Button
                size="small"
                variant={dateFilter === 'today' ? 'contained' : 'outlined'}
                onClick={() => handleDateFilterClick('today')}
              >
                당일
              </Button>
              <Button
                size="small"
                variant={dateFilter === 'week' ? 'contained' : 'outlined'}
                onClick={() => handleDateFilterClick('week')}
              >
                이번주
              </Button>
              <Button
                size="small"
                variant={dateFilter === 'month' ? 'contained' : 'outlined'}
                onClick={() => handleDateFilterClick('month')}
              >
                당월
              </Button>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="거래 유형"
                  value={filter.type}
                  onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="in">입고</MenuItem>
                  <MenuItem value="out">출고</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="시작 날짜"
                  type="date"
                  value={filter.dateFrom}
                  onChange={(e) => setFilter(prev => ({ ...prev, dateFrom: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="종료 날짜"
                  type="date"
                  value={filter.dateTo}
                  onChange={(e) => setFilter(prev => ({ ...prev, dateTo: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="출발지 검색"
                  value={filter.fromLocation}
                  onChange={(e) => setFilter(prev => ({ ...prev, fromLocation: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="목적지 검색"
                  value={filter.toLocation}
                  onChange={(e) => setFilter(prev => ({ ...prev, toLocation: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="상품 검색"
                  value={filter.product}
                  onChange={(e) => setFilter(prev => ({ ...prev, product: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="메모 검색"
                  value={filter.note}
                  onChange={(e) => setFilter(prev => ({ ...prev, note: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="정렬 기준"
                  value={filter.sortBy}
                  onChange={(e) => setFilter(prev => ({ ...prev, sortBy: e.target.value }))}
                >
                  <MenuItem value="date">날짜</MenuItem>
                  <MenuItem value="type">유형</MenuItem>
                  <MenuItem value="product">상품</MenuItem>
                  <MenuItem value="quantity">수량</MenuItem>
                  <MenuItem value="from">출발지</MenuItem>
                  <MenuItem value="to">목적지</MenuItem>
                  <MenuItem value="note">메모</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={1.5}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="정렬"
                  value={filter.sortOrder}
                  onChange={(e) => setFilter(prev => ({ ...prev, sortOrder: e.target.value }))}
                >
                  <MenuItem value="asc">오름차순</MenuItem>
                  <MenuItem value="desc">내림차순</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={1.5}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => {
                    showSnackbar('필터가 적용되었습니다.', 'success');
                  }}
                >
                  검색
                </Button>
              </Grid>
              <Grid item xs={12} md={1.5}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    setFilter({
                      dateFrom: '',
                      dateTo: '',
                      fromLocation: '',
                      toLocation: '',
                      product: '',
                      note: '',
                      type: 'all',
                      sortBy: 'date',
                      sortOrder: 'desc'
                    });
                    setDateFilter('all');
                  }}
                >
                  초기화
                </Button>
              </Grid>
            </Grid>
          </Card>

          {/* 거래 내역 보기 전환 및 렌더 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box>
              {transactionViewMode === 'list' && selectedTransactions.length > 0 && (
                <Button size="small" variant="outlined" color="error" onClick={handleDeleteSelectedTransactions}>
                  선택 삭제 ({selectedTransactions.length})
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'inline-flex', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Button size="small" variant={transactionViewMode === 'list' ? 'contained' : 'text'} onClick={() => setTransactionViewMode('list')}>리스트 보기</Button>
              <Button size="small" variant={transactionViewMode === 'table' ? 'contained' : 'text'} onClick={() => setTransactionViewMode('table')}>표 보기</Button>
            </Box>
          </Box>

          {transactionViewMode === 'list' && (
            <>
              <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={paginatedTransactions.length > 0 && selectedTransactions.length === paginatedTransactions.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTransactions(paginatedTransactions.map(t => t.id));
                          else setSelectedTransactions([]);
                        }}
                      />
                    </TableCell>
                    <TableCell>날짜</TableCell>
                    <TableCell>유형</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell>상품</TableCell>
                    <TableCell align="center">품목수</TableCell>
                    <TableCell align="center">수량</TableCell>
                    <TableCell>출발지</TableCell>
                    <TableCell>목적지</TableCell>
                    <TableCell>메모</TableCell>
                    <TableCell align="center">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">검색 결과가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((group) => (
                      <TableRow key={group.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedTransactions.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTransactions(prev => [...prev, group.id]);
                              else setSelectedTransactions(prev => prev.filter(id => id !== group.id));
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>{group.date}</TableCell>
                        <TableCell>
                          <Chip label={getTransactionTypeInfo(group).label} size="small" color={getTransactionTypeInfo(group).color} />
                        </TableCell>
                        <TableCell align="center">
                          {group.items[0]?.status === '대기' ? (
                            <Chip label="출고대기" size="small" color="warning" variant="outlined" />
                          ) : (
                            <Chip label="완료" size="small" color="success" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {group.items.length === 1 ? group.items[0].productName : `${group.items.length}개 상품`}
                        </TableCell>
                        <TableCell align="center">{group.items.length}</TableCell>
                        <TableCell align="center">{group.items.length === 1 ? group.items[0].quantity : group.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {group.items.length === 1 ? formatLocationName(group.items[0].fromLocation, warehouses, dealers) : (() => { const fromLocs = [...new Set(group.items.map(item => formatLocationName(item.fromLocation, warehouses, dealers)))]; return fromLocs.length === 1 ? fromLocs[0] : '다양'; })()}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {group.items.length === 1 ? formatLocationName(group.items[0].toLocation, warehouses, dealers) : (() => { const toLocs = [...new Set(group.items.map(item => formatLocationName(item.toLocation, warehouses, dealers)))]; return toLocs.length === 1 ? toLocs[0] : '다양'; })()}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{group.items.length === 1 ? (group.items[0].note || '-') : (group.note || '다중 상품')}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); openTransactionDetail(group); }}>상세</Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* 페이지네이션 */}
            {filteredTransactions.length > itemsPerPage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
            </>
          )}

          {transactionViewMode === 'table' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>기간: {dateKeys[0]} ~ {dateKeys[dateKeys.length - 1]}</Typography>
              <Grid container spacing={2}>
                {warehouses.map(w => {
                  const wid = w.id;
                  const productIdsWithMoves = Object.entries(ioByWarehouseProductDate[wid] || {})
                    .filter(([, dates]) => Object.values(dates).some(v => (v.inQty || 0) > 0 || (v.outQty || 0) > 0))
                    .map(([pid]) => Number(pid));
                  const productCols = products.filter(p => productIdsWithMoves.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
                  return (
                    <Grid item xs={12} key={`wh-table-${wid}`}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 1 }}>{w.name}</Typography>
                          <TableContainer component={Paper}>
                            <Table>
                              <TableHead>
                                <TableRow>
                                  <TableCell>날짜</TableCell>
                                  {productCols.map(p => (
                                    <TableCell key={`prod-col-${wid}-${p.id}`} align="right">{p.name}</TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {dateKeys.length === 0 ? (
                                  <TableRow><TableCell colSpan={1 + productCols.length} align="center">해당 기간 움직임이 없습니다.</TableCell></TableRow>
                                ) : (
                                  dateKeys.map(dk => {
                                    // 해당 날짜에 해당 창고의 입출고 이력이 있는지 확인
                                    const hasAnyMovement = productCols.some(p => {
                                      const io = ioByWarehouseProductDate[wid]?.[p.id]?.[dk] || { inQty: 0, outQty: 0 };
                                      return (io.inQty || 0) > 0 || (io.outQty || 0) > 0;
                                    });
                                    
                                    // 이력이 없으면 행을 렌더링하지 않음
                                    if (!hasAnyMovement) return null;
                                    
                                    // 해당 날짜/창고의 거래에서 출발지/목적지 정보 수집
                                    const dayTransactions = transactions.filter(tx => {
                                      if (!tx || !tx.date) return false;
                                      const txDate = typeof tx.date === 'string' ? tx.date.split('T')[0] : new Date(tx.date).toISOString().split('T')[0];
                                      return txDate === dk && (tx.toLocation === wid || tx.fromLocation === wid);
                                    });
                                    const fromSet = new Set();
                                    const toSet = new Set();
                                    dayTransactions.forEach(tx => {
                                      if (tx.fromLocation && tx.fromLocation !== wid) {
                                        const loc = formatLocationName(tx.fromLocation, warehouses, dealers);
                                        fromSet.add(loc);
                                      }
                                      if (tx.toLocation && tx.toLocation !== wid) {
                                        const loc = warehouses.find(w => w.id === tx.toLocation)?.name || dealers.find(d => d.id === tx.toLocation)?.name || tx.toLocation;
                                        toSet.add(loc);
                                      }
                                    });
                                    const fromText = fromSet.size > 0 ? Array.from(fromSet).join(', ') : '';
                                    const toText = toSet.size > 0 ? Array.from(toSet).join(', ') : '';
                                    return (
                                      <TableRow key={`date-row-${wid}-${dk}`} hover>
                                        <TableCell sx={{ fontWeight: 'bold' }}>
                                          <Box>{dk}</Box>
                                          {fromText && (<Box sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>출: {fromText}</Box>)}
                                          {toText && (<Box sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>도: {toText}</Box>)}
                                        </TableCell>
                                        {productCols.map(p => {
                                          const io = ioByWarehouseProductDate[wid]?.[p.id]?.[dk] || { inQty: 0, outQty: 0 };
                                          const hasAny = (io.inQty || 0) > 0 || (io.outQty || 0) > 0;
                                          return (
                                             <TableCell key={`cell-${wid}-${dk}-${p.id}`} align="right">
                                               {hasAny ? (
                                                 <Box 
                                                   sx={{ 
                                                     display: 'inline-flex', 
                                                     gap: 0.5, 
                                                     cursor: 'pointer',
                                                     '&:hover': { opacity: 0.7 }
                                                   }}
                                                   onMouseEnter={(e) => handleTableCellHover(e, wid, p.id, dk)}
                                                   onMouseLeave={handleTableCellHoverLeave}
                                                   onClick={() => handleTableCellClick(wid, p.id, dk)}
                                                 >
                                                   {io.inQty > 0 && (<span style={{ color: 'var(--mui-palette-success-main, #2e7d32)', fontWeight: 'bold', fontSize: '0.95rem' }}>+{io.inQty.toLocaleString()}</span>)}
                                                   {io.outQty > 0 && (<span style={{ color: 'var(--mui-palette-error-main, #d32f2f)', fontWeight: 'bold', fontSize: '0.95rem' }}>−{io.outQty.toLocaleString()}</span>)}
                                                 </Box>
                                               ) : ''}
                                             </TableCell>
                                          );
                                        })}
                                      </TableRow>
                                    );
                                  })
                                )}
                                {/* 현재 재고 잔량 행 */}
                                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                  <TableCell sx={{ backgroundColor: 'action.hover', fontWeight: 'bold' }}>현재 재고</TableCell>
                                  {productCols.map(p => {
                                    const currentStock = inventory[wid]?.[p.id] || 0;
                                    return (
                                      <TableCell key={`stock-${wid}-${p.id}`} align="right" sx={{ backgroundColor: 'action.hover', fontWeight: 'bold', fontSize: '0.95rem' }}>
                                        <span style={{ fontWeight: 'bold', color: currentStock > 0 ? 'var(--mui-palette-primary-main, #1976d2)' : 'var(--mui-palette-text-secondary, #666)' }}>
                                          {currentStock.toLocaleString()}
                                        </span>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                                {/* 출고 대기 잔량 행 */}
                                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                  <TableCell sx={{ backgroundColor: 'action.hover', fontWeight: 'bold', color: 'var(--mui-palette-warning-main, #ed6c02)' }}>출고 대기</TableCell>
                                  {productCols.map(p => {
                                    const pendingOut = pendingInventory[wid]?.[p.id] || 0;
                                    return (
                                      <TableCell key={`pending-${wid}-${p.id}`} align="right" sx={{ backgroundColor: 'action.hover', fontWeight: 'bold', fontSize: '0.95rem' }}>
                                        <span style={{ fontWeight: 'bold', color: pendingOut > 0 ? 'var(--mui-palette-warning-main, #ed6c02)' : 'var(--mui-palette-text-secondary, #666)' }}>
                                          {pendingOut.toLocaleString()}
                                        </span>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Box>
      )}

        {activeTab === 5 && (
          <Box>
            {/* 입출고 통계 필터 */}
            <Card sx={{ p: 1.5, mb: 1.5 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>통계 필터</Typography>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="시작 날짜"
                    value={dealerStatsFilter.dateFrom}
                    onChange={(e) => setDealerStatsFilter(prev => ({ ...prev, dateFrom: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="종료 날짜"
                    value={dealerStatsFilter.dateTo}
                    onChange={(e) => setDealerStatsFilter(prev => ({ ...prev, dateTo: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    label="대리점 선택"
                    value={dealerStatsFilter.dealer || ''}
                    onChange={(e) => setDealerStatsFilter(prev => ({ ...prev, dealer: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    <option value="">전체 대리점</option>
                    {dealers.map(dealer => (
                      <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Button
                    fullWidth
                    size="small"
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={() => {
                      showSnackbar('통계 필터가 적용되었습니다.', 'success');
                    }}
                  >
                    검색
                  </Button>
                </Grid>
              </Grid>
            </Card>

            {/* 요약 통계 카드 - 컴팩트하게 */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">총 재고</Typography>
                    <Typography variant="h6" color="primary" sx={{ mt: 0.5 }}>
                      {Object.values(inventory).reduce((total, products) => 
                        total + Object.values(products).reduce((sum, qty) => sum + qty, 0), 0
                      ).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">총 입고량</Typography>
                    <Typography variant="h6" color="success.main" sx={{ mt: 0.5 }}>
                      {totalInboundStats.totalQuantity.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">창고 수</Typography>
                    <Typography variant="h6" color="secondary" sx={{ mt: 0.5 }}>
                      {warehouses.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">대리점 수</Typography>
                    <Typography variant="h6" color="success.main" sx={{ mt: 0.5 }}>
                      {dealers.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* 총 이동 수령 (총 입고량) 표시 - 컴팩트 */}
            <Card sx={{ p: 1.5, mb: 1.5, backgroundColor: '#f5f5f5' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>
                총 이동 수령 (총 입고량) - {totalInboundStats.totalQuantity.toLocaleString()}개 ({totalInboundStats.totalTransactions}건)
              </Typography>
              <TableContainer>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5 }}>기간</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>수량</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>건수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const periodStats = dealerStatsFilter.period === 'day' ? totalInboundStats.dailyStats :
                                         dealerStatsFilter.period === 'week' ? totalInboundStats.weeklyStats :
                                         dealerStatsFilter.period === 'month' ? totalInboundStats.monthlyStats :
                                         totalInboundStats.yearlyStats;
                      const sortedPeriods = Object.keys(periodStats).sort().reverse().slice(0, 10);
                      return sortedPeriods.map(period => (
                        <TableRow key={period}>
                          <TableCell sx={{ py: 0.5 }}>
                            {dealerStatsFilter.period === 'day' ? period :
                             dealerStatsFilter.period === 'week' ? period.split('-W')[1] + '주차' :
                             dealerStatsFilter.period === 'month' ? period.split('-')[0] + '년 ' + parseInt(period.split('-')[1]) + '월' :
                             period + '년'}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>{periodStats[period].quantity.toLocaleString()}개</TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>{periodStats[period].transactions}건</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>

            {/* 창고별/모델별 출고 수량 통계 - 2열로 배치 */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 1.5 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>창고별 출고량</Typography>
                  <TableContainer>
                    <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ py: 0.5 }}>창고명</TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>출고량</TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>건수</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.values(warehouseStats)
                          .filter(stat => stat.outTransactions > 0)
                          .sort((a, b) => b.outTotalQuantity - a.outTotalQuantity)
                          .map((stat, index) => (
                            <TableRow key={index} hover>
                              <TableCell sx={{ py: 0.5 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {stat.name}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{stat.outTotalQuantity.toLocaleString()}</TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{stat.outTransactions}</TableCell>
                            </TableRow>
                          ))}
                        {Object.values(warehouseStats).filter(stat => stat.outTransactions > 0).length > 0 && (
                          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableCell sx={{ py: 0.5, fontWeight: 'bold' }}>합계</TableCell>
                            <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                              {Object.values(warehouseStats).reduce((sum, stat) => sum + stat.outTotalQuantity, 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                              {Object.values(warehouseStats).reduce((sum, stat) => sum + stat.outTransactions, 0)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 1.5 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>모델별 출고량</Typography>
                  <TableContainer>
                    <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ py: 0.5 }}>제품명</TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>출고량</TableCell>
                          <TableCell align="right" sx={{ py: 0.5 }}>건수</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.values(productStats)
                          .filter(stat => stat.outTransactions > 0)
                          .sort((a, b) => b.outTotalQuantity - a.outTotalQuantity)
                          .slice(0, 15)
                          .map((stat, index) => (
                            <TableRow key={index} hover>
                              <TableCell sx={{ py: 0.5 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {stat.productName}
                                </Typography>
                                {stat.productCode && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {stat.productCode}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{stat.outTotalQuantity.toLocaleString()}</TableCell>
                              <TableCell align="right" sx={{ py: 0.5 }}>{stat.outTransactions}</TableCell>
                            </TableRow>
                          ))}
                        {Object.values(productStats).filter(stat => stat.outTransactions > 0).length > 0 && (
                          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableCell sx={{ py: 0.5, fontWeight: 'bold' }}>합계</TableCell>
                            <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                              {Object.values(productStats).reduce((sum, stat) => sum + stat.outTotalQuantity, 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                              {Object.values(productStats).reduce((sum, stat) => sum + stat.outTransactions, 0)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              </Grid>
            </Grid>

            {/* 입출고 통계 테이블 */}
            <Card sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>지점별 입출고 통계</Typography>
              <TableContainer>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5 }}>대리점명</TableCell>
                      <TableCell sx={{ py: 0.5 }}>지역</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>입고량</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>입고건</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>출고량</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>출고건</TableCell>
                      <TableCell sx={{ py: 0.5 }}>최근 입고일</TableCell>
                      <TableCell sx={{ py: 0.5 }}>최근 출고일</TableCell>
                    </TableRow>
                  </TableHead>
                <TableBody>
                  {Object.values(dealerStats)
                    .filter(stat => {
                      // 대리점 필터 적용
                      const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                      
                      // 거래가 있는 대리점만 표시 (입고/출고 둘 중 하나라도 존재)
                      const hasTransactions = (stat.outTransactions > 0) || (stat.inTransactions > 0);
                      
                      return dealerFilter && hasTransactions;
                    })
                    .sort((a, b) => (b.outTotalQuantity + b.inTotalQuantity) - (a.outTotalQuantity + a.inTotalQuantity))
                    .map((stat, index) => (
                    <TableRow key={index} hover>
                      <TableCell sx={{ py: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {stat.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>{stat.location}</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>{stat.inTotalQuantity.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>{stat.inTransactions}</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>{stat.outTotalQuantity.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ py: 0.5 }}>{stat.outTransactions}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{stat.inLastDate || '-'}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{stat.outLastDate || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {Object.values(dealerStats).filter(stat => {
                    const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                    const hasTransactions = (stat.outTransactions > 0) || (stat.inTransactions > 0);
                    return dealerFilter && hasTransactions;
                  }).length > 0 && (
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell colSpan={2} sx={{ py: 0.5, fontWeight: 'bold' }}>합계</TableCell>
                      <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                        {Object.values(dealerStats)
                          .filter(stat => {
                            const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                            const hasTransactions = (stat.outTransactions > 0) || (stat.inTransactions > 0);
                            return dealerFilter && hasTransactions;
                          })
                          .reduce((sum, stat) => sum + stat.inTotalQuantity, 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                        {Object.values(dealerStats)
                          .filter(stat => {
                            const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                            const hasTransactions = (stat.outTransactions > 0) || (stat.inTransactions > 0);
                            return dealerFilter && hasTransactions;
                          })
                          .reduce((sum, stat) => sum + stat.inTransactions, 0)}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                        {Object.values(dealerStats)
                          .filter(stat => {
                            const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                            const hasTransactions = (stat.outTransactions > 0) || (stat.inTransactions > 0);
                            return dealerFilter && hasTransactions;
                          })
                          .reduce((sum, stat) => sum + stat.outTotalQuantity, 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                        {Object.values(dealerStats)
                          .filter(stat => {
                            const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                            const hasTransactions = (stat.outTransactions > 0) || (stat.inTransactions > 0);
                            return dealerFilter && hasTransactions;
                          })
                          .reduce((sum, stat) => sum + stat.outTransactions, 0)}
                      </TableCell>
                      <TableCell colSpan={2} sx={{ py: 0.5 }}>-</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </TableContainer>
            </Card>

            {/* 기간별 상세 통계 - 컴팩트 (월별 제외) */}
            {dealerStatsFilter.period !== 'day' && dealerStatsFilter.period !== 'month' && (
              <Card sx={{ p: 1.5, mt: 1.5 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>
                  {dealerStatsFilter.period === 'week' ? '주별' : '년별'} 대리점별 상세 통계
                </Typography>
                <Grid container spacing={1.5}>
                  {Object.values(dealerStats)
                    .filter(stat => {
                      const dealerFilter = !dealerStatsFilter.dealer || stat.name === dealers.find(d => d.id === dealerStatsFilter.dealer)?.name;
                      const hasTransactions = stat.totalTransactions > 0;
                      return dealerFilter && hasTransactions;
                    })
                    .slice(0, 6)
                    .map((stat, index) => {
                      const periodStats = dealerStatsFilter.period === 'week' ? stat.weeklyStats :
                                       dealerStatsFilter.period === 'month' ? stat.monthlyStats :
                                       stat.yearlyStats;
                      
                      const sortedPeriods = Object.keys(periodStats).sort().reverse().slice(0, 8);
                      
                      return (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                          <Card variant="outlined" sx={{ p: 1 }}>
                            <Typography variant="body2" fontWeight="bold" gutterBottom sx={{ mb: 0.5 }}>
                              {stat.name} ({stat.location})
                            </Typography>
                            <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ py: 0.3, px: 1 }}>기간</TableCell>
                                  <TableCell align="right" sx={{ py: 0.3, px: 1 }}>수량</TableCell>
                                  <TableCell align="right" sx={{ py: 0.3, px: 1 }}>건수</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {sortedPeriods.map(period => (
                                  <TableRow key={period}>
                                    <TableCell sx={{ py: 0.3, px: 1 }}>
                                      <Typography variant="caption">
                                        {dealerStatsFilter.period === 'week' ? period.split('-W')[1] + '주차' :
                                         dealerStatsFilter.period === 'month' ? parseInt(period.split('-')[1]) + '월' :
                                         period + '년'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.3, px: 1 }}>
                                      <Typography variant="caption" fontWeight="medium">
                                        {periodStats[period].quantity.toLocaleString()}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 0.3, px: 1 }}>
                                      <Typography variant="caption">
                                        {periodStats[period].transactions}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Card>
                        </Grid>
                      );
                    })}
                </Grid>
              </Card>
            )}
          </Box>
        )}

      {/* 전체보기 탭 */}
      {activeTab === 3 && (
        <Box>
          <Card sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">재고 현황</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="상품명/코드 검색"
                  value={overallSearch}
                  onChange={(e) => setOverallSearch(e.target.value)}
                />
                <Button
                  size="small"
                  variant={overallStockFilter === 'all' ? 'contained' : 'outlined'}
                  onClick={() => setOverallStockFilter('all')}
                >
                  전체
                </Button>
                <Button
                  size="small"
                  variant={overallStockFilter === 'inStock' ? 'contained' : 'outlined'}
                  onClick={() => setOverallStockFilter('inStock')}
                >
                  재고 있음
                </Button>
                <Button
                  size="small"
                  variant={overallStockFilter === 'outOfStock' ? 'contained' : 'outlined'}
                  onClick={() => setOverallStockFilter('outOfStock')}
                >
                  재고 없음
                </Button>
              </Box>
            </Box>
          </Card>

          <TableContainer component={Paper} sx={{ width: '100%', maxHeight: 600, overflowX: 'hidden', overflowY: 'auto' }}>
            <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'fixed', border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(224, 224, 224, 1)' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 3, backgroundColor: 'background.paper', width: 240, maxWidth: 240 }}>상품</TableCell>
                  <TableCell sx={{ width: 120, maxWidth: 120 }}>바코드</TableCell>
                  <TableCell sx={{ width: 120, maxWidth: 120 }}>제품코드</TableCell>
                  {warehouses.map(w => (
                    <TableCell key={`wh-col-${w.id}`} align="right" sx={{ width: 120, maxWidth: 140 }}>{w.name}</TableCell>
                  ))}
                  <TableCell align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>상품별 총합</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const term = overallSearch.trim().toLowerCase();
                  let rows = (products || []).filter(p => !term || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
                  rows = rows.filter(p => {
                    const stocks = warehouses.map(w => (inventory[w.id]?.[p.id] || 0));
                    const anyStock = stocks.some(q => q !== 0);
                    if (overallStockFilter === 'inStock') return anyStock;
                    if (overallStockFilter === 'outOfStock') return !anyStock;
                    return true;
                  });
                  
                  // 창고별 총합 계산
                  const warehouseTotals = warehouses.map(w => 
                    rows.reduce((sum, p) => sum + (inventory[w.id]?.[p.id] || 0), 0)
                  );
                  
                  // 전체 총합 계산
                  const grandTotal = warehouseTotals.reduce((sum, total) => sum + total, 0);
                  
                  return [
                    // 상품별 행들
                    ...rows.map(p => {
                      const productTotal = warehouses.reduce((sum, w) => sum + (inventory[w.id]?.[p.id] || 0), 0);
                      return (
                        <TableRow key={`prod-row-${p.id}`} hover>
                          <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'background.paper', fontWeight: 'bold', width: 240, maxWidth: 240 }}>
                            {p.name}
                          </TableCell>
                          <TableCell sx={{ width: 120, maxWidth: 120 }}>{p.barcode || '-'}</TableCell>
                          <TableCell sx={{ width: 120, maxWidth: 120 }}>{p.code || '-'}</TableCell>
                          {warehouses.map(w => (
                            <TableCell key={`cell-${p.id}-${w.id}`} align="right" sx={{ width: 120, maxWidth: 140 }}>{(inventory[w.id]?.[p.id] || 0).toLocaleString()}</TableCell>
                          ))}
                          <TableCell align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                            {productTotal.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    }),
                    // 창고별 총합 행
                    <TableRow key="warehouse-totals" sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e3f2fd', fontWeight: 'bold', width: 240, maxWidth: 240 }}>
                        창고별 총합
                      </TableCell>
                      <TableCell sx={{ backgroundColor: '#e3f2fd' }}></TableCell>
                      <TableCell sx={{ backgroundColor: '#e3f2fd' }}></TableCell>
                      {warehouses.map((w, index) => (
                        <TableCell key={`warehouse-total-${w.id}`} align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                          {warehouseTotals[index].toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#bbdefb', fontWeight: 'bold' }}>
                        {grandTotal.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ];
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}



      {/* 입출고 등록 다이얼로그 (통합) */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          다중 상품 입출고 등록
        </DialogTitle>
        <DialogContent>
          {/* 통합 폼 */}
          <Box sx={{ pt: 2 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                  label="거래 날짜"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="공통 메모"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="모든 상품에 적용될 공통 메모"
                  />
                </Grid>
              </Grid>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              상품 목록
              <Button
                variant="outlined"
                size="small"
                onClick={addIoProductRow}
              >
                상품 추가
              </Button>
            </Typography>

            {multipleIoProducts.map((product, index) => (
                <Box key={product.id} sx={{ mb: 1, p: 1 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={12} md={3}>
                        <Autocomplete
                          fullWidth
                          options={products}
                          getOptionLabel={(option) => `${option.name} (${option.code}) [${option.supplier || 'NEARBIKE'}]`}
                          value={products.find(p => p.id === product.productId) || null}
                          onChange={(event, value) => 
                          updateIoProductRow(product.id, 'productId', value?.id || '')
                          }
                          getOptionDisabled={(option) => {
                            const srcId = product.fromLocation;
                            const isOutbound = warehouses.find(w => w.id === srcId);
                            if (!isOutbound) return false;
                            const available = (inventory[srcId]?.[option.id]) || 0;
                            return available <= 0;
                          }}
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {option.name}
                                </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {(() => {
                                      const srcId = product.fromLocation;
                                      const isOutbound = warehouses.find(w => w.id === srcId);
                                      if (isOutbound) {
                                        const available = (inventory[srcId]?.[option.id]) || 0;
                                        return `${option.code} • ${option.category} • ${option.supplier || 'NEARBIKE'} • ${option.price?.toLocaleString()}원 • 출발지 재고 ${available}개`;
                                      }
                                      return `${option.code} • ${option.category} • ${option.supplier || 'NEARBIKE'} • ${option.price?.toLocaleString()}원`;
                                    })()}
                                  </Typography>
                              </Box>
                            </Box>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                            label={`상품 선택 ${products.find(p => p.id === product.productId) ? `[${products.find(p => p.id === product.productId)?.supplier || 'NEARBIKE'}]` : ''}`}
                              required
                              fullWidth
                              size="small"
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} md={1}>
                      <TextField
                        fullWidth
                        label="수량"
                        type="number"
                        size="small"
                        value={product.quantity}
                      onChange={(e) => updateIoProductRow(product.id, 'quantity', e.target.value)}
                        required
                        helperText={(() => {
                          const srcId = product.fromLocation;
                          const isOutbound = warehouses.find(w => w.id === srcId);
                          if (!isOutbound) return '';
                          const pid = parseInt(product.productId) || 0;
                          const available = (inventory[srcId]?.[pid]) || 0;
                          return `가용: ${available.toLocaleString()}개`;
                        })()}
                      />
                    </Grid>
                      <Grid item xs={12} md={2.5}>
                      <Autocomplete
                        options={[
                          { id: '', name: '외부 (신규입고)', type: 'external' },
                          ...warehouses.map(w => ({ ...w, type: 'warehouse' })),
                          ...dealers.map(d => ({ ...d, type: 'dealer' }))
                        ]}
                        getOptionLabel={(option) => {
                          if (option.type === 'external') return option.name;
                          return `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`;
                        }}
                        value={(() => {
                        if (!product.fromLocation || product.fromLocation === '') return { id: '', name: '외부 (신규입고)', type: 'external' };
                          const warehouse = warehouses.find(w => w.id === product.fromLocation);
                          if (warehouse) return { ...warehouse, type: 'warehouse' };
                          const dealer = dealers.find(d => d.id === product.fromLocation);
                          if (dealer) return { ...dealer, type: 'dealer' };
                          return null;
                        })()}
                        onChange={(event, value) => 
                        updateIoProductRow(product.id, 'fromLocation', value?.id || '')
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="출발지"
                            size="small"
                            fullWidth
                          />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2">
                                {option.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.type === 'external' ? '신규입고' : 
                                 option.type === 'warehouse' ? '창고' : '대리점'}
                                {option.location && ` • ${option.location}`}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        isOptionEqualToValue={(option, value) => option?.id === value?.id}
                      />
                    </Grid>
                      <Grid item xs={12} md={2.5}>
                      <Autocomplete
                        options={[
                          ...warehouses.map(w => ({ ...w, type: 'warehouse' })),
                          ...dealers.map(d => ({ ...d, type: 'dealer' }))
                        ]}
                        getOptionLabel={(option) => 
                          `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`
                        }
                        value={(() => {
                        const warehouse = warehouses.find(w => w.id === product.toLocation);
                          if (warehouse) return { ...warehouse, type: 'warehouse' };
                        const dealer = dealers.find(d => d.id === product.toLocation);
                          if (dealer) return { ...dealer, type: 'dealer' };
                          return null;
                        })()}
                        onChange={(event, value) => 
                        updateIoProductRow(product.id, 'toLocation', value?.id || '')
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="목적지"
                            size="small"
                            fullWidth
                            required
                          />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box>
                              <Typography variant="body2">
                                {option.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.type === 'warehouse' ? '창고' : '대리점'} • {option.location}
                                {option.manager && ` • 담당: ${option.manager}`}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        isOptionEqualToValue={(option, value) => option?.id === value?.id}
                      />
                    </Grid>
                      <Grid item xs={12} md={1}>
                      <TextField
                        fullWidth
                        label="개별 메모"
                        size="small"
                        value={product.note}
                      onChange={(e) => updateIoProductRow(product.id, 'note', e.target.value)}
                        placeholder="개별 메모"
                      />
                    </Grid>
                      <Grid item xs={12} md={1.5}>
                      <TextField
                        fullWidth
                        label={
                          (() => {
                            const isToWarehouse = warehouses.find(w => w.id === product.toLocation);
                            return isToWarehouse ? "박스 번호 (필수)" : "박스 번호 (선택)";
                          })()
                        }
                        size="small"
                        required={!!warehouses.find(w => w.id === product.toLocation)}
                        value={product.boxNo || ''}
                      onChange={(e) => updateIoProductRow(product.id, 'boxNo', e.target.value)}
                        placeholder="박스 묶음"
                      />
                    </Grid>
                      <Grid item xs={12} md={0.5}>
                      <IconButton
                        color="error"
                      onClick={() => removeIoProductRow(product.id)}
                      disabled={multipleIoProducts.length === 1}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Box>
              ))}
              
              {/* 전체 수량 표시 */}
              <Box sx={{ 
                mt: 2, 
                p: 1, 
                backgroundColor: '#f0f8ff', 
                border: '1px solid #b3d9ff', 
                borderRadius: 1,
                textAlign: 'center',
                mx: 1
              }}>
                <Typography variant="h6" color="primary" fontWeight="bold">
                총 수량: {multipleIoProducts.reduce((sum, product) => {
                    const quantity = parseInt(product.quantity) || 0;
                    return sum + quantity;
                  }, 0).toLocaleString()}개
                </Typography>
                <Typography variant="body2" color="text.secondary">
                등록된 상품: {multipleIoProducts.length}개
                </Typography>
              </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button onClick={handleSubmitTransaction} variant="contained">
            {`입출고 등록 (${multipleIoProducts.length}개 상품)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* 거래내역 상세 Dialog */}
      <Dialog open={transactionDetailOpen} onClose={closeTransactionDetail} maxWidth="xl" fullWidth>
        <DialogTitle>
          거래내역 상세 정보
          <IconButton
            aria-label="close"
            onClick={closeTransactionDetail}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTransaction && (
            <Box>
              {selectedTransaction.items && selectedTransaction.items.length >= 1 ? (
                // 그룹화된 거래 상세
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {getTransactionTypeInfo(selectedTransaction).label} 상세 내역 ({editMode ? editProducts.length : selectedTransaction.items.length}개 상품)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    거래 날짜: {selectedTransaction.date} | 처리 시간: {selectedTransaction.createdAt}
                  </Typography>
                  
                  {editMode ? (
                    // 수정 모드: 상품 추가/삭제 가능 + 공통 메모/날짜 수정
                    <Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="거래 날짜"
                            value={editFormData.date || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="공통 메모"
                            value={editFormData.note || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="해당 거래에 대한 공통 메모"
                          />
                        </Grid>
                      </Grid>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">상품 목록</Typography>
                        <Button
                          variant="outlined"
                          onClick={addEditProduct}
                          startIcon={<AddIcon />}
                          size="small"
                        >
                          상품 추가
                        </Button>
                      </Box>
                      
                      {editProducts.map((product, index) => (
                        <Card key={index} sx={{ mb: 2, p: 2 }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                              <Autocomplete
                                size="small"
                                options={products}
                                getOptionLabel={(option) => option ? `${option.name} (${option.code})` : ''}
                                value={product.product}
                                onChange={(event, newValue) => updateEditProduct(index, 'product', newValue)}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                renderInput={(params) => (
                                  <TextField {...params} label="상품 선택" placeholder="상품을 선택하세요" />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {option.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.code} | {option.supplier} | 재고: {option.stock}개
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} md={1.5}>
                              <TextField
                                fullWidth
                                label="수량"
                                type="number"
                                size="small"
                                value={product.quantity}
                                onChange={(e) => updateEditProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                                inputProps={{ min: 1 }}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <Autocomplete
                                size="small"
                                options={[
                                  ...warehouses.map(w => ({ ...w, type: 'warehouse' })),
                                  ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                ]}
                                getOptionLabel={(option) => option ? `${option.name} (${option.id})` : ''}
                                value={(() => {
                                  const w = warehouses.find(w => w.id === product.fromLocation);
                                  if (w) return { ...w, type: 'warehouse' };
                                  const d = dealers.find(d => d.id === product.fromLocation);
                                  if (d) return { ...d, type: 'dealer' };
                                  return null;
                                })()}
                                onChange={(event, value) => updateEditProduct(index, 'fromLocation', value?.id || '')}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                renderInput={(params) => (
                                  <TextField {...params} label="출발지" placeholder="출발지 선택" />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Box>
                                      <Typography variant="body2">{option.name} ({option.id})</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.type === 'warehouse' ? '창고' : '대리점'}{option.location ? ` • ${option.location}` : ''}
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <Autocomplete
                                size="small"
                                options={[
                                  ...warehouses.map(w => ({ ...w, type: 'warehouse' })),
                                  ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                ]}
                                getOptionLabel={(option) => option ? `${option.name} (${option.id})` : ''}
                                value={(() => {
                                  const w = warehouses.find(w => w.id === product.toLocation);
                                  if (w) return { ...w, type: 'warehouse' };
                                  const d = dealers.find(d => d.id === product.toLocation);
                                  if (d) return { ...d, type: 'dealer' };
                                  return null;
                                })()}
                                onChange={(event, value) => updateEditProduct(index, 'toLocation', value?.id || '')}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                renderInput={(params) => (
                                  <TextField {...params} label="목적지" placeholder="목적지 선택" />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Box>
                                      <Typography variant="body2">{option.name} ({option.id})</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.type === 'warehouse' ? '창고' : '대리점'}{option.location ? ` • ${option.location}` : ''}
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <TextField
                                fullWidth
                                label="메모"
                                size="small"
                                value={product.note}
                                onChange={(e) => updateEditProduct(index, 'note', e.target.value)}
                                placeholder="메모"
                              />
                            </Grid>
                            <Grid item xs={12} md={2.5}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                  fullWidth
                                  label="개별 메모"
                                  size="small"
                                  value={product.additionalNote}
                                  onChange={(e) => updateEditProduct(index, 'additionalNote', e.target.value)}
                                  placeholder="개별 메모"
                                  sx={{ flex: 1 }}
                                />
                                <IconButton
                                  color="error"
                                  onClick={() => removeEditProduct(index)}
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </Grid>
                          </Grid>
                        </Card>
                      ))}
                      
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          총 수량: {editProducts.reduce((sum, product) => sum + (parseInt(product.quantity) || 0), 0)}개
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    // 읽기 모드: 경계선 없는 테이블 표시
                    <TableContainer component={Box} sx={{ mt: 2 }}>
                      <Table size="small" sx={{ '& td, & th': { border: 0 } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>상품명</TableCell>
                            <TableCell>브랜드</TableCell>
                            <TableCell>바코드</TableCell>
                            <TableCell align="center">수량</TableCell>
                            <TableCell>출발지</TableCell>
                            <TableCell>목적지</TableCell>
                            <TableCell>메모</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedTransaction.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.productSupplier || 'NEARBIKE'}</TableCell>
                              <TableCell>{item.productCode}</TableCell>
                              <TableCell align="center">{item.quantity}</TableCell>
                              <TableCell>
                                {(() => {
                                  const srcId = item.fromLocation;
                                  if (!srcId || srcId === '외부') return '외부';
                                  const w = warehouses.find(w => w.id === srcId);
                                  if (w) return w.name;
                                  const d = dealers.find(d => d.id === srcId);
                                  if (d) return d.name;
                                  return srcId;
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const destId = item.toLocation;
                                  const w = warehouses.find(w => w.id === destId);
                                  if (w) return w.name;
                                  const d = dealers.find(d => d.id === destId);
                                  if (d) return d.name;
                                  return destId;
                                })()}
                              </TableCell>
                              <TableCell>
                                {item.note && <div>{item.note}</div>}
                                {item.additionalNote && <div style={{ fontSize: '0.8em', color: '#666' }}>{item.additionalNote}</div>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  
                  {!editMode && (
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        총 수량: {selectedTransaction.items.reduce((sum, item) => {
                          const quantity = parseInt(item.quantity) || 0;
                          return sum + quantity;
                        }, 0).toLocaleString()}개
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                // 개별 거래 상세
                <Box>
                  {editMode ? (
                    // 수정 모드: 상품 추가/삭제 가능 + 공통 메모/날짜 수정
                    <Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label="거래 날짜"
                            value={editFormData.date || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="공통 메모"
                            value={editFormData.note || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="해당 거래에 대한 공통 메모"
                          />
                        </Grid>
                      </Grid>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">상품 목록</Typography>
                        <Button
                          variant="outlined"
                          onClick={addEditProduct}
                          startIcon={<AddIcon />}
                          size="small"
                        >
                          상품 추가
                        </Button>
                      </Box>
                      
                      {editProducts.map((product, index) => (
                        <Card key={index} sx={{ mb: 2, p: 2 }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={3}>
                              <Autocomplete
                                size="small"
                                options={products}
                                getOptionLabel={(option) => option ? `${option.name} (${option.code})` : ''}
                                value={product.product}
                                onChange={(event, newValue) => updateEditProduct(index, 'product', newValue)}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                renderInput={(params) => (
                                  <TextField {...params} label="상품 선택" placeholder="상품을 선택하세요" />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {option.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.code} | {option.supplier} | 재고: {option.stock}개
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} md={1.5}>
                              <TextField
                                fullWidth
                                label="수량"
                                type="number"
                                size="small"
                                value={product.quantity}
                                onChange={(e) => updateEditProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                                inputProps={{ min: 1 }}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <Autocomplete
                                size="small"
                                options={[
                                  ...warehouses.map(w => ({ ...w, type: 'warehouse' })),
                                  ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                ]}
                                getOptionLabel={(option) => option ? `${option.name} (${option.id})` : ''}
                                value={(() => {
                                  const w = warehouses.find(w => w.id === product.fromLocation);
                                  if (w) return { ...w, type: 'warehouse' };
                                  const d = dealers.find(d => d.id === product.fromLocation);
                                  if (d) return { ...d, type: 'dealer' };
                                  return null;
                                })()}
                                onChange={(event, value) => updateEditProduct(index, 'fromLocation', value?.id || '')}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                renderInput={(params) => (
                                  <TextField {...params} label="출발지" placeholder="출발지 선택" />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Box>
                                      <Typography variant="body2">{option.name} ({option.id})</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.type === 'warehouse' ? '창고' : '대리점'}{option.location ? ` • ${option.location}` : ''}
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <Autocomplete
                                size="small"
                                options={[
                                  ...warehouses.map(w => ({ ...w, type: 'warehouse' })),
                                  ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                ]}
                                getOptionLabel={(option) => option ? `${option.name} (${option.id})` : ''}
                                value={(() => {
                                  const w = warehouses.find(w => w.id === product.toLocation);
                                  if (w) return { ...w, type: 'warehouse' };
                                  const d = dealers.find(d => d.id === product.toLocation);
                                  if (d) return { ...d, type: 'dealer' };
                                  return null;
                                })()}
                                onChange={(event, value) => updateEditProduct(index, 'toLocation', value?.id || '')}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                renderInput={(params) => (
                                  <TextField {...params} label="목적지" placeholder="목적지 선택" />
                                )}
                                renderOption={(props, option) => (
                                  <Box component="li" {...props}>
                                    <Box>
                                      <Typography variant="body2">{option.name} ({option.id})</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.type === 'warehouse' ? '창고' : '대리점'}{option.location ? ` • ${option.location}` : ''}
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                              />
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <TextField
                                fullWidth
                                label="메모"
                                size="small"
                                value={product.note}
                                onChange={(e) => updateEditProduct(index, 'note', e.target.value)}
                                placeholder="메모"
                              />
                            </Grid>
                            <Grid item xs={12} md={1.5}>
                              <TextField
                                fullWidth
                                label="개별 메모"
                                size="small"
                                value={product.additionalNote}
                                onChange={(e) => updateEditProduct(index, 'additionalNote', e.target.value)}
                                placeholder="개별 메모"
                              />
                            </Grid>
                            <Grid item xs={12} md={1}>
                              <IconButton
                                color="error"
                                onClick={() => removeEditProduct(index)}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </Card>
                      ))}
                      
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          총 수량: {editProducts.reduce((sum, product) => sum + (parseInt(product.quantity) || 0), 0)}개
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    // 읽기 모드: 기존 카드 레이아웃
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              기본 정보
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">거래 ID:</Typography>
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.id}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">거래 유형:</Typography>
                                <Chip 
                                  label={getTransactionTypeInfo(selectedTransaction).label} 
                                  size="small"
                                  color={getTransactionTypeInfo(selectedTransaction).color}
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">거래 날짜:</Typography>
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.date}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">처리 시간:</Typography>
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.createdAt}</Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              상품 정보
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">상품명:</Typography>
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.productName}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">수량:</Typography>
                                <Typography variant="body2" fontWeight="medium" color="primary.main">
                                  {selectedTransaction.quantity}개
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  )}
                  
                  {!editMode && (
                    <>
                      <Grid item xs={12}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              이동 정보
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">출발지:</Typography>
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.fromLocation}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">↓</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">목적지:</Typography>
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.toLocation}</Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              메모
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {selectedTransaction.note || '메모가 없습니다.'}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!editMode ? (
            <>
              <Button onClick={closeTransactionDetail}>닫기</Button>
              <Button onClick={startEditTransaction} variant="outlined" color="primary">
                수정
              </Button>
            </>
          ) : (
            <>
              <Button onClick={cancelEditTransaction}>취소</Button>
              <Button onClick={saveEditTransaction} variant="contained" color="primary">
                저장
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* 엑셀 업로드 다이얼로그 */}
      <Dialog open={excelUploadOpen} onClose={handleCloseExcelUpload} maxWidth="md" fullWidth>
        <DialogTitle>
          입출고 엑셀 업로드
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* 템플릿 다운로드 */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                📋 엑셀 템플릿 다운로드
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                아래 버튼을 클릭하여 입출고 통합 템플릿을 다운로드하세요. 출발지/목적지 정보로 입고/출고가 자동 판단됩니다.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  onClick={downloadExcelTemplate}
                  startIcon={<DownloadIcon />}
                >
                  표준 템플릿
                </Button>
                <Button
                  variant="outlined"
                  onClick={downloadNearbikeTemplate}
                  startIcon={<DownloadIcon />}
                >
                  다중 파츠 템플릿 양식
                </Button>
              </Box>
            </Box>

            {/* 파일 업로드 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                📁 엑셀 파일 업로드
              </Typography>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileUpload}
                style={{ display: 'none' }}
                id="excel-file-input"
              />
              
              {/* 드래그 앤 드롭 영역 */}
              <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                  border: `2px dashed ${isDragOver ? '#1976d2' : '#ccc'}`,
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  backgroundColor: isDragOver ? '#f3f8ff' : '#fafafa',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: '#f0f0f0',
                    borderColor: '#999'
                  }
                }}
                onClick={() => document.getElementById('excel-file-input').click()}
              >
                <UploadIcon sx={{ fontSize: 48, color: isDragOver ? '#1976d2' : '#999', mb: 1 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {isDragOver ? '파일을 놓아주세요' : '엑셀 파일을 드래그하거나 클릭하여 업로드'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  .xlsx, .xls 파일만 지원됩니다
                </Typography>
                {excelFile && (
                  <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                    선택된 파일: {excelFile.name}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* 업로드된 데이터 미리보기 */}
            {excelData.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  📊 업로드된 데이터 미리보기 ({excelData.length}개 상품)
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table stickyHeader size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>상품코드</TableCell>
                        <TableCell>상품명</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell>출발지</TableCell>
                        <TableCell>목적지</TableCell>
                        <TableCell>메모</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {excelData.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.productCode}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell>{item.fromLocation}</TableCell>
                          <TableCell>{item.toLocation}</TableCell>
                          <TableCell>{item.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {excelData.length > 10 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    ... 및 {excelData.length - 10}개 더
                  </Typography>
                )}
              </Box>
            )}

            {/* 날짜 및 공통 메모 */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="거래 날짜"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="공통 메모"
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="모든 상품에 적용될 공통 메모"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExcelUpload}>취소</Button>
          <Button 
            onClick={handleExcelDataSubmit} 
            variant="contained"
            disabled={excelData.length === 0}
          >
            입출고 처리 ({excelData.length}개 상품)
          </Button>
        </DialogActions>
      </Dialog>

      {/* 창고/대리점 관리 탭 (마지막) */}
      {activeTab === 6 && (
        <LocationManagement
          warehouses={warehouses}
          setWarehouses={setWarehouses}
          dealers={dealers}
          setDealers={setDealers}
          onLocationUpdate={handleLocationUpdate}
          onToggleSync={toggleWarehouseSync}
          onRefreshProducts={refreshProductsFromPartsManagement}
          onSyncWarehouseStock={syncWarehouseStock}
          loading={loading}
        />
      )}

      {/* 표보기 마우스 오버 시 거래 상세 팝오버 */}
      <Popover
        open={Boolean(hoverAnchorEl)}
        anchorEl={hoverAnchorEl}
        onClose={handleTableCellHoverLeave}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableRestoreFocus
        sx={{
          pointerEvents: 'none',
        }}
        PaperProps={{
          onMouseLeave: handleTableCellHoverLeave,
          sx: {
            pointerEvents: 'auto',
            maxWidth: 600,
            maxHeight: 400,
            overflow: 'auto'
          }
        }}
      >
        {hoverTransactions.length > 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              {hoverTransactions[0].date} - {hoverTransactions.length}건의 거래
            </Typography>
            <TableContainer>
              <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>유형</TableCell>
                    <TableCell>상품</TableCell>
                    <TableCell align="right">수량</TableCell>
                    <TableCell>출발지</TableCell>
                    <TableCell>목적지</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hoverTransactions.slice(0, 10).map((tx, idx) => {
                    const product = products.find(p => p.id === tx.productId);
                    const fromLocation = formatLocationName(tx.fromLocation, warehouses, dealers);
                    const toLocation = formatLocationName(tx.toLocation, warehouses, dealers);
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Chip 
                            label={getTransactionTypeInfo(tx).label} 
                            size="small"
                            color={getTransactionTypeInfo(tx).color}
                          />
                        </TableCell>
                        <TableCell>{product?.name || tx.productName || '알 수 없음'}</TableCell>
                        <TableCell align="right">{tx.quantity.toLocaleString()}</TableCell>
                        <TableCell>{fromLocation}</TableCell>
                        <TableCell>{toLocation}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {hoverTransactions.length > 10 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                ... 및 {hoverTransactions.length - 10}개 더 (클릭하여 전체 보기)
              </Typography>
            )}
          </Box>
        )}
      </Popover>

      {/* 표보기 클릭 시 거래 상세 모달 */}
      <Dialog 
        open={tableModalOpen} 
        onClose={() => setTableModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          거래 상세 내역
          <IconButton
            onClick={() => setTableModalOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedTableTransactions.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedTableTransactions[0].date} - {selectedTableTransactions.length}건의 거래
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>시간</TableCell>
                      <TableCell>유형</TableCell>
                      <TableCell>상품</TableCell>
                      <TableCell align="right">수량</TableCell>
                      <TableCell>출발지</TableCell>
                      <TableCell>목적지</TableCell>
                      <TableCell>메모</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedTableTransactions.map((tx) => {
                      const product = products.find(p => p.id === tx.productId);
                      const fromLocation = formatLocationName(tx.fromLocation, warehouses, dealers);
                      const toLocation = formatLocationName(tx.toLocation, warehouses, dealers);
                      
                      return (
                        <TableRow key={tx.id} hover>
                          <TableCell>
                            {new Date(tx.createdAt || tx.date).toLocaleTimeString('ko-KR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={getTransactionTypeInfo(tx).label} 
                              size="small"
                              color={getTransactionTypeInfo(tx).color}
                            />
                          </TableCell>
                          <TableCell>{product?.name || '알 수 없음'}</TableCell>
                          <TableCell align="right">{tx.quantity.toLocaleString()}</TableCell>
                          <TableCell>{fromLocation}</TableCell>
                          <TableCell>{toLocation}</TableCell>
                          <TableCell>{tx.note || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTableModalOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 매장/온라인 출고 탭 */}
      {activeTab === 2 && (
        <StoreOnlineOutboundTab />
      )}

      {/* 박스 관리 탭 */}
      {activeTab === 4 && (
        <BoxStatusTab />
      )}

      {/* 카페24 재고 비교 탭 */}
      {activeTab === 7 && (
        <Cafe24InventoryReconciliation 
          products={products}
          warehouses={warehouses}
          recalculatedInventory={inventory}
        />
      )}

      {/* 바코드 스캐너 */}
      <BarcodeScanner
        open={barcodeScannerOpen}
        onClose={() => {
          setBarcodeScannerOpen(false);
          setCurrentScanningRow(null);
        }}
        onScan={handleBarcodeScan}
        onError={handleBarcodeScanError}
      />

    </Box>
  );
}

export default InventoryManagement;
