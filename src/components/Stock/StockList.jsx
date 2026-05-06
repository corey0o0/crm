import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button, MenuItem, CircularProgress, Snackbar, Alert, IconButton, Dialog, DialogTitle, DialogContent,
  Checkbox, FormControlLabel, Stack, InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SearchIcon from '@mui/icons-material/Search';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { sendTelegramNotification } from '../../lib/telegram';
import TablePagination from '@mui/material/TablePagination';
import { useNavigate } from 'react-router-dom';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { getSyncedParts } from '../../utils/partSyncUtils';
import LinkIcon from '@mui/icons-material/Link';

// 메모이제이션된 옵션 상수
const BRAND_OPTIONS = ['전체', 'XRB', 'NB'];
const STOCK_FILTER_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: '품절 제외', label: '품절 제외' },
  { value: '품절', label: '품절' },
  { value: '3개 이하', label: '3개 이하' },
  { value: '1개 이하', label: '1개 이하' }
];

// [검색 입력창 분리]
const SearchInput = React.memo(function SearchInput({
  searchInput,
  setSearchInput,
  onSearch,
  onClear,
  isSearching
}) {
  const handleInputChange = (e) => setSearchInput(e.target.value);
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') onSearch();
  };
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
      <TextField
        label="제품명/코드 검색"
        value={searchInput}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        size="small"
        sx={{ 
          flex: { xs: '1 1 100%', sm: '1 1 auto' },
          width: { xs: '100%', sm: 300 }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchInput && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={onClear} edge="end">
                <CloseIcon />
              </IconButton>
            </InputAdornment>
          )
        }}
      />
      <Button
        variant="contained"
        onClick={onSearch}
        disabled={isSearching}
        sx={{ 
          height: { xs: 44, sm: 40 },
          width: { xs: '100%', sm: 'auto' },
          minWidth: { xs: 'auto', sm: 100 }
        }}
      >
        {isSearching ? <CircularProgress size={20} /> : '검색'}
      </Button>
    </Stack>
  );
});

function StockList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [brand, setBrand] = useState('전체');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('전체');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [sortConfig, setSortConfig] = useState({ key: 'code', direction: 'asc' });
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [stockLogs, setStockLogs] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAllLogsDialog, setShowAllLogsDialog] = useState(false);
  const [allStockLogs, setAllStockLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showSupplyPrice, setShowSupplyPrice] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [changedItems, setChangedItems] = useState(new Set());
  const [originalStocks, setOriginalStocks] = useState({});
  const [syncedPartsMap, setSyncedPartsMap] = useState({}); // 연동 파츠 정보

  useEffect(() => {
    fetchParts();
  }, [brand]);

  // 연동된 파츠 정보 로드
  useEffect(() => {
    const loadSyncedParts = async () => {
      try {
        const { getAllSyncRelations } = await import('../../utils/partSyncUtils');
        const relations = await getAllSyncRelations();
        const map = {};
        
        relations.forEach(rel => {
          if (!map[rel.part_id_1]) map[rel.part_id_1] = [];
          map[rel.part_id_1].push({
            relationId: rel.id,
            part: rel.parts_2
          });
          
          if (!map[rel.part_id_2]) map[rel.part_id_2] = [];
          map[rel.part_id_2].push({
            relationId: rel.id,
            part: rel.parts_1
          });
        });
        
        setSyncedPartsMap(map);
      } catch (err) {
        console.error('연동 파츠 로딩 실패:', err);
      }
    };
    
    if (parts.length > 0) {
      loadSyncedParts();
    }
  }, [parts]);

  const fetchParts = async () => {
    try {
      // 오프라인 상태 체크
      if (isOffline()) {
        console.log('[StockList] 오프라인 상태 - 재고 데이터 로딩 건너뛰기');
        setSnackbar({ open: true, message: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.', severity: 'error' });
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // 안전한 재시도 로직 적용
      const { data, error } = await safeRetry(async () => {
        let query = supabase.from('parts').select('*');
        if (brand !== '전체') query = query.eq('brand', brand);
        return await query;
      }, {
        maxRetries: 3,
        maxTime: 30000,
        baseDelay: 1000
      });
      
      if (error) {
        // 스마트 오류 처리
        const errorMessage = getErrorMessage(error);
        setSnackbar({ open: true, message: `재고 목록을 불러오지 못했습니다: ${errorMessage}`, severity: 'error' });
        setParts([]);
        setOriginalStocks({});
      } else {
        setParts(data || []);
        // 원본 재고 값 저장
        const originalStockData = {};
        (data || []).forEach(part => {
          originalStockData[part.id] = part.stock;
        });
        setOriginalStocks(originalStockData);
        // 변경된 항목 초기화
        setChangedItems(new Set());
      }
    } catch (err) {
      console.error('Error fetching parts:', err);
      const errorMessage = getErrorMessage(err);
      setSnackbar({ open: true, message: `재고 목록을 불러오지 못했습니다: ${errorMessage}`, severity: 'error' });
      setParts([]);
      setOriginalStocks({});
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (id, value) => {
    // 숫자가 아닌 입력 제거
    const numericValue = value.replace(/[^0-9]/g, '');
    // 숫자로 변환
    const stockValue = numericValue === '' ? 0 : parseInt(numericValue, 10);
    
    // 재고 값 업데이트
    setParts(prev => prev.map(p => p.id === id ? { ...p, stock: stockValue } : p));
    
    // 변경된 항목 추적
    setChangedItems(prev => {
      const newSet = new Set(prev);
      if (originalStocks[id] !== stockValue) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSaveStock = async (id, currentStock, newStock) => {
    try {
      const stockValue = parseInt(newStock, 10) || 0;
      const { error: updateError } = await supabase
        .from('parts')
        .update({ stock: stockValue })
        .eq('id', id)
        .select();

      if (updateError) throw updateError;

      // 부품 정보 조회 (inventory_logs 기록용)
      const { data: partInfo, error: partError } = await supabase
        .from('parts')
        .select('name, code, brand')
        .eq('id', id)
        .single();

      if (partError) {
        console.error('부품 정보 조회 실패:', partError);
      } else {
        // inventory_logs 테이블에 기록 (재고변경내역에서 확인 가능)
        const { error: inventoryLogError } = await supabase
          .from('inventory_logs')
          .insert({
            part_id: id,
            part_name: partInfo.name,
            part_code: partInfo.code,
            brand_code: partInfo.brand || 'UNKNOWN',
            change_type: 'manual_adjust',
            quantity_change: stockValue - currentStock,
            previous_quantity: currentStock,
            new_quantity: stockValue,
            reference_id: null,
            reference_type: null,
            notes: '재고 관리에서 개별 수정'
          });

        if (inventoryLogError) {
          console.error('재고 변경 내역 기록 실패:', inventoryLogError);
        }
      }

      // 기존 stock_logs 테이블에도 기록 (호환성 유지)
      const { error: logError } = await supabase
        .from('stock_logs')
        .insert({
          product_id: id,
          previous_quantity: currentStock,
          new_quantity: stockValue,
          change_quantity: stockValue - currentStock,
          reason: '수동 재고 조정',
          created_by: (await supabase.auth.getUser()).data.user?.email || '관리자'
        });

      if (logError) throw logError;

      // 등록 성공 후 알림 추가
      await supabase.from('notifications').insert({
        type: 'stock',
        message: `재고조정[${parts.find(p => p.id === id)?.name}](${parts.find(p => p.id === id)?.code}) - 현재고: ${stockValue}`,
        link: `/stock`
      });

      // 텔레그램 알림 전송
      try {
        await sendTelegramNotification({
          message: `재고 조정 (코드: ${parts.find(p => p.id === id)?.code}) - 품명: ${parts.find(p => p.id === id)?.name}, 현재고: ${stockValue}`,
          link: `/stock`
        }, { eventType: 'stock_adjust' });
      } catch (telegramError) {
        console.error('재고조정 텔레그램 알림 전송 중 오류:', telegramError);
      }

      console.log('알림 등록:', {
        type: 'stock',
        message: `재고조정[${parts.find(p => p.id === id)?.name}](${parts.find(p => p.id === id)?.code}) - 현재고: ${stockValue}`,
        link: `/stock`
      });

      setSnackbar({ open: true, message: '재고가 저장되었습니다.', severity: 'success' });
      
      // 변경된 항목에서 해당 아이템 제거
      setChangedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      // 원본 재고 값 업데이트
      setOriginalStocks(prev => ({
        ...prev,
        [id]: stockValue
      }));
      
      fetchParts();
    } catch (error) {
      console.error('재고 저장 중 오류:', error);
      setSnackbar({ open: true, message: '재고 저장 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        return { key, direction: 'asc' };
      }
    });
  };

  // [검색 버튼/엔터는 즉시 검색만]
  const executeSearch = () => {
    setIsSearching(true);
    setSearchTerm(searchInput.toLowerCase().trim());
    setPage(0); // 검색 시 페이지 초기화
    setIsSearching(false);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setPage(0); // 검색 초기화 시 페이지 리셋
  };

  // 디바운스 적용: searchInput 변경 시 500ms 후 searchTerm 업데이트
  useEffect(() => {
    if (searchInput === '') {
      setSearchTerm('');
      return;
    }
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.toLowerCase().trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // 필터링 로직 최적화
  const filteredParts = useMemo(() => {
    // 브랜드와 재고 상태로 1차 필터링
    let filtered = parts.filter(part => {
      const matchesBrand = brand === '전체' || part.brand === brand;
      
      let matchesStock = true;
      if (stockFilter !== '전체') {
        switch (stockFilter) {
          case '품절 제외':
            matchesStock = part.stock > 0;
            break;
          case '품절':
            matchesStock = part.stock === 0;
            break;
          case '3개 이하':
            matchesStock = part.stock <= 3 && part.stock >= 0;
            break;
          case '1개 이하':
            matchesStock = part.stock <= 1 && part.stock >= 0;
            break;
          default: // 예기치 않은 값에 대한 방어 코드
            matchesStock = true;
            break;
        }
      }
      
      return matchesBrand && matchesStock;
    });

    // 검색어로 2차 필터링
    if (searchTerm) {
      const searchLower = searchTerm; // executeSearch에서 이미 toLowerCase().trim() 처리됨
      filtered = filtered.filter(part => 
        (part.name?.toLowerCase().includes(searchLower) ||
        part.code?.toLowerCase().includes(searchLower))
  );
    }

    return filtered;
  }, [parts, brand, stockFilter, searchTerm]);

  // 정렬 로직 최적화 - 정렬 설정이나 필터링 결과가 변경될 때만 재계산
  const sortedParts = useMemo(() => {
    const { key, direction } = sortConfig;
    const sorted = [...filteredParts];
    
    sorted.sort((a, b) => {
    let aValue = a[key];
    let bValue = b[key];
      
      // 숫자 필드 처리
      if (key === 'price' || key === 'stock' || key === 'supply_price') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    } else {
        // 문자열 필드 처리
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
    }
      
      if (direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return sorted;
  }, [filteredParts, sortConfig]);

  // 브랜드 선택 핸들러 메모이제이션
  const handleBrandChange = useCallback((e) => {
    setBrand(e.target.value);
    setPage(0); // 필터 변경 시 페이지 초기화
  }, []);

  // 재고 상태 필터 핸들러 메모이제이션
  const handleStockFilterChange = useCallback((e) => {
    setStockFilter(e.target.value);
    setPage(0); // 필터 변경 시 페이지 초기화
  }, []);

  const sortArrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : '';

  // 재고 로그 조회 함수
  const fetchStockLogs = async (productId) => {
    try {
      const { data, error } = await supabase
        .from('stock_logs')
        .select('*, parts(name, code)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStockLogs(data || []);
    } catch (err) {
      console.error('재고 로그 조회 중 오류:', err);
      setSnackbar({
        open: true,
        message: '재고 로그 조회 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 재고 로그 기록 함수
  const createStockLog = async (productId, oldQuantity, newQuantity, reason) => {
    try {
      const { error } = await supabase
        .from('stock_logs')
        .insert({
          product_id: productId,
          previous_quantity: oldQuantity,
          new_quantity: newQuantity,
          change_quantity: newQuantity - oldQuantity,
          reason: reason,
          created_by: '관리자', // 실제 사용자 정보로 대체 필요
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err) {
      console.error('재고 로그 기록 중 오류:', err);
    }
  };

  // 재고 수정 함수 수정
  const handleQuantityChange = async (productId, newQuantity) => {
    try {
      // 현재 재고 정보 조회
      const { data: currentStock, error: stockError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', productId)
        .single();

      if (stockError) throw stockError;

      // 재고 업데이트
      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', productId);

      if (updateError) throw updateError;

      // 재고 로그 기록
      await createStockLog(
        productId,
        currentStock.quantity,
        newQuantity,
        '수동 재고 조정'
      );

      setSnackbar({
        open: true,
        message: '재고가 성공적으로 수정되었습니다.',
        severity: 'success'
      });

      // 목록 새로고침
      fetchParts();
    } catch (err) {
      console.error('재고 수정 중 오류:', err);
      setSnackbar({
        open: true,
        message: '재고 수정 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 재고 로그 다이얼로그 열기
  const handleOpenLogDialog = (product) => {
    setSelectedProduct(product);
    fetchStockLogs(product.id);
    setShowLogDialog(true);
  };

  // 전체 재고 변동 내역 조회
  const fetchAllStockLogs = async () => {
    setLogsLoading(true);
    try {
      let query = supabase
        .from('stock_logs')
        .select(`
          *,
          parts (
            name,
            code,
            brand
          )
        `)
        .order('created_at', { ascending: false });

      // 날짜 필터 적용
      if (dateRange.startDate) {
        query = query.gte('created_at', dateRange.startDate + 'T00:00:00');
      }
      if (dateRange.endDate) {
        query = query.lte('created_at', dateRange.endDate + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) throw error;
      setAllStockLogs(data || []);
    } catch (err) {
      console.error('재고 변동 내역 조회 중 오류:', err);
      setSnackbar({
        open: true,
        message: '재고 변동 내역 조회 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenAllLogs = () => {
    setShowAllLogsDialog(true);
    fetchAllStockLogs();
  };

  // 체크박스 선택 처리 함수
  const handleSelectItem = (id) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // 전체 선택 처리 함수
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredParts.map(part => part.id));
    }
    setSelectAll(!selectAll);
  };

  // 체크된 항목들 저장 처리 함수
  const handleSaveSelectedItems = async () => {
    if (selectedItems.length === 0) {
      setSnackbar({ open: true, message: '선택된 항목이 없습니다.', severity: 'warning' });
      return;
    }

    try {
      // 선택된 항목들의 현재 상태 얻기
      const selectedParts = parts.filter(part => selectedItems.includes(part.id));
      
      // 각 항목 저장
      for (const part of selectedParts) {
        // 현재 DB에 저장된 값 조회
        const { data: currentData, error: fetchError } = await supabase
          .from('parts')
          .select('stock')
          .eq('id', part.id)
          .single();
          
        if (fetchError) throw fetchError;
        
        const currentStock = currentData.stock;
        
        // 변경된 값 저장
        const { error: updateError } = await supabase
          .from('parts')
          .update({ stock: part.stock })
          .eq('id', part.id);
          
        if (updateError) throw updateError;
        
        // 재고 로그 기록
        if (currentStock !== part.stock) {
          const { error: logError } = await supabase
            .from('stock_logs')
            .insert({
              product_id: part.id,
              previous_quantity: currentStock,
              new_quantity: part.stock,
              change_quantity: part.stock - currentStock,
              reason: '일괄 재고 수정',
              created_by: (await supabase.auth.getUser()).data.user?.email || '관리자'
            });
            
          if (logError) throw logError;
        }

        // DB 알림 추가
        await supabase.from('notifications').insert({
          type: 'stock',
          message: `재고조정[${part.name}](${part.code}) - 현재고: ${part.stock}`,
          link: `/stock`
        });

        // 텔레그램 알림 전송
        try {
          await sendTelegramNotification({
            message: `재고 조정 (코드: ${part.code}) - 품명: ${part.name}, 현재고: ${part.stock}`,
            link: `/stock`
          }, { eventType: 'stock_bulk_save' });
        } catch (telegramError) {
          console.error('재고 일괄 저장(선택) 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }
      
      setSnackbar({ open: true, message: `${selectedItems.length}개 항목의 재고가 저장되었습니다.`, severity: 'success' });
      
      // 저장된 항목들의 하이라이트 제거
      setChangedItems(prev => {
        const newSet = new Set(prev);
        selectedItems.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      // 저장된 항목들의 원본 재고 값 업데이트
      const updatedOriginalStocks = { ...originalStocks };
      selectedParts.forEach(part => {
        updatedOriginalStocks[part.id] = part.stock;
      });
      setOriginalStocks(updatedOriginalStocks);
      
      fetchParts(); // 목록 새로고침
      setSelectedItems([]); // 선택 초기화
      setSelectAll(false); // 전체 선택 해제
    } catch (error) {
      console.error('재고 일괄 저장 중 오류:', error);
      setSnackbar({ open: true, message: '재고 저장 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  // 전체 항목 저장 처리 함수
  const handleSaveAllItems = async () => {
    try {
      // 화면에 표시된 모든 항목(필터링된 항목) 저장
      const partsToSave = filteredParts;
      
      if (partsToSave.length === 0) {
        setSnackbar({ open: true, message: '저장할 항목이 없습니다.', severity: 'warning' });
        return;
      }
      
      // 각 항목 저장
      for (const part of partsToSave) {
        // 현재 DB에 저장된 값 조회
        const { data: currentData, error: fetchError } = await supabase
          .from('parts')
          .select('stock')
          .eq('id', part.id)
          .single();
          
        if (fetchError) throw fetchError;
        
        const currentStock = currentData.stock;
        
        // 변경된 값 저장
        const { error: updateError } = await supabase
          .from('parts')
          .update({ stock: part.stock })
          .eq('id', part.id);
          
        if (updateError) throw updateError;
        
        // 재고 로그 기록 (값이 실제로 변경된 경우에만)
        if (currentStock !== part.stock) {
          // inventory_logs 테이블에 기록 (재고변경내역에서 확인 가능)
          const { error: inventoryLogError } = await supabase
            .from('inventory_logs')
            .insert({
              part_id: part.id,
              part_name: part.name,
              part_code: part.code,
              brand_code: part.brand || 'UNKNOWN',
              change_type: 'manual_adjust',
              quantity_change: part.stock - currentStock,
              previous_quantity: currentStock,
              new_quantity: part.stock,
              reference_id: null,
              reference_type: null,
              notes: '재고 관리에서 수동 수정'
            });

          if (inventoryLogError) {
            console.error('재고 변경 내역 기록 실패:', inventoryLogError);
          }

          // 기존 stock_logs 테이블에도 기록 (호환성 유지)
          const { error: logError } = await supabase
            .from('stock_logs')
            .insert({
              product_id: part.id,
              previous_quantity: currentStock,
              new_quantity: part.stock,
              change_quantity: part.stock - currentStock,
              reason: '전체 재고 수정',
              created_by: (await supabase.auth.getUser()).data.user?.email || '관리자'
            });
            
          if (logError) throw logError;
        }

        // DB 알림 추가
        await supabase.from('notifications').insert({
          type: 'stock',
          message: `재고조정[${part.name}](${part.code}) - 현재고: ${part.stock}`,
          link: `/stock`
        });

        // 텔레그램 알림 전송
        try {
          await sendTelegramNotification({
            message: `재고 조정 (코드: ${part.code}) - 품명: ${part.name}, 현재고: ${part.stock}`,
            link: `/stock`
          }, { eventType: 'stock_bulk_save' });
        } catch (telegramError) {
          console.error('재고 일괄 저장(전체) 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }
      
      setSnackbar({ open: true, message: `${partsToSave.length}개 항목의 재고가 저장되었습니다.`, severity: 'success' });
      
      // 저장된 항목들의 하이라이트 제거
      setChangedItems(prev => {
        const newSet = new Set(prev);
        partsToSave.forEach(part => newSet.delete(part.id));
        return newSet;
      });
      
      // 저장된 항목들의 원본 재고 값 업데이트
      const updatedOriginalStocks = { ...originalStocks };
      partsToSave.forEach(part => {
        updatedOriginalStocks[part.id] = part.stock;
      });
      setOriginalStocks(updatedOriginalStocks);
      
      fetchParts(); // 목록 새로고침
    } catch (error) {
      console.error('재고 일괄 저장 중 오류:', error);
      setSnackbar({ open: true, message: '재고 저장 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  // useEffect로 selectAll 상태 업데이트
  useEffect(() => {
    // 모든 항목이 선택되었는지 확인
    if (filteredParts.length > 0 && selectedItems.length === filteredParts.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedItems, filteredParts]);

  // 페이지네이션 핸들러
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 페이지네이션 적용된 파츠 목록
  const pagedParts = useMemo(() => {
    return sortedParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedParts, page, rowsPerPage]);

  // 엑셀 다운로드 함수
  const handleDownloadExcel = () => {
    if (filteredParts.length === 0) {
      setSnackbar({ open: true, message: '다운로드할 데이터가 없습니다.', severity: 'warning' });
      return;
    }

    const exportData = filteredParts.map(part => ({
      '브랜드': part.brand,
      '제품코드': part.code,
      '제품명': part.name,
      '바코드': part.barcode || '',
      '공급가': part.supply_price || 0,
      '단가': part.price || 0,
      '재고': part.stock || 0,
      '비고': part.note || ''
    }));

    const headers = [
      { label: '브랜드', key: '브랜드' },
      { label: '제품코드', key: '제품코드' },
      { label: '제품명', key: '제품명' },
      { label: '바코드', key: '바코드' },
      { label: '공급가', key: '공급가' },
      { label: '단가', key: '단가' },
      { label: '재고', key: '재고' },
      { label: '비고', key: '비고' }
    ];

    const today = new Date().toISOString().split('T')[0];
    const brandText = brand === '전체' ? '전체' : brand;
    downloadExcel(exportData, headers, `재고목록_${brandText}_${today}`);
  };

  // 엑셀 템플릿 다운로드 함수
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        '브랜드': 'XRB',
        '제품코드': 'SAMPLE001',
        '제품명': '샘플 제품',
        '공급가': 10000,
        '단가': 15000,
        '재고': 10,
        '비고': '샘플 데이터입니다.'
      },
      {
        '브랜드': 'NB',
        '제품코드': 'SAMPLE002',
        '제품명': '샘플 제품 2',
        '공급가': 20000,
        '단가': 25000,
        '재고': 5,
        '비고': '이 행을 삭제하고 실제 데이터를 입력하세요.'
      }
    ];

    const headers = [
      { label: '브랜드', key: '브랜드' },
      { label: '제품코드', key: '제품코드' },
      { label: '제품명', key: '제품명' },
      { label: '공급가', key: '공급가' },
      { label: '단가', key: '단가' },
      { label: '재고', key: '재고' },
      { label: '비고', key: '비고' }
    ];

    downloadExcel(templateData, headers, '재고_업로드_템플릿');
  };

  // 엑셀 파일 업로드 처리
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await readExcelFile(file);
      console.log('업로드된 엑셀 데이터:', data);
      
      // 필수 컬럼 확인
      // 최소 식별자 검사 (코드, 바코드, 이름 중 하나)
      const missingIdentity = data.some(row => {
        const hasCode = row['제품코드'] || row['상품코드'] || row['품목코드'];
        const hasBarcode = row['바코드'];
        const hasName = row['제품명'] || row['상품명'] || row['품목명'];
        return !(hasCode || hasBarcode || hasName);
      });
      
      if (missingIdentity) {
        throw new Error('모든 행에 제품 식별자(코드, 바코드, 이름 중 1개 이상)가 있어야 합니다.');
      }

      // 데이터 유효성 검사 및 변환
      const processedData = data.map((row, index) => {
        const lineNumber = index + 2; // 헤더를 제외한 실제 행 번호
        
        const code = row['제품코드'] || row['상품코드'] || row['품목코드'] || '';
        const name = row['제품명'] || row['상품명'] || row['품목명'] || '';
        const barcode = row['바코드'] || '';
        const brand = row['브랜드'] || '';
        
        if (brand && !['XRB', 'NB'].includes(brand)) {
          throw new Error(`${lineNumber}행: 브랜드는 'XRB' 또는 'NB'만 가능합니다.`);
        }

        // 숫자 필드 변환
        const supply_price = row['공급가'] !== undefined ? parseFloat(row['공급가']) : undefined;
        const price = row['단가'] !== undefined ? parseFloat(row['단가']) : undefined;
        const stock = (row['재고'] !== undefined || row['수량'] !== undefined) ? parseInt(row['재고'] || row['수량'] || 0) : undefined;

        if (price !== undefined && (isNaN(price) || price < 0)) {
          throw new Error(`${lineNumber}행: 단가는 0 이상의 숫자여야 합니다.`);
        }
        if (stock !== undefined && (isNaN(stock) || stock < 0)) {
          throw new Error(`${lineNumber}행: 재고는 0 이상의 정수여야 합니다.`);
        }

        return {
          brand: brand,
          code: code,
          barcode: barcode,
          name: name,
          supply_price: supply_price,
          price: price,
          stock: stock,
          note: row['비고'] || undefined
        };
      });

      setUploadedData(processedData);
      setUploadFile(file);
      setUploadDialogOpen(true);
      
      setSnackbar({
        open: true,
        message: `${processedData.length}개의 데이터가 성공적으로 읽어졌습니다.`,
        severity: 'success'
      });

    } catch (error) {
      console.error('엑셀 파일 처리 중 오류:', error);
      setSnackbar({
        open: true,
        message: `파일 처리 중 오류: ${error.message}`,
        severity: 'error'
      });
    }

    // 파일 입력 초기화
    event.target.value = '';
  };

  // 업로드된 데이터를 데이터베이스에 저장
  const handleConfirmUpload = async () => {
    if (uploadedData.length === 0) return;

    try {
      let updatedCount = 0;
      let insertedCount = 0;
      const errors = [];

      for (const item of uploadedData) {
        try {
          // 기존 제품 확인 (코드, 바코드, 이름 중 제공된 모든 조건으로 OR 매칭)
          let orConditions = [];
          if (item.code) orConditions.push(`code.eq.${item.code}`);
          if (item.barcode) orConditions.push(`barcode.eq.${item.barcode}`);
          if (item.name) orConditions.push(`name.eq.${item.name}`);

          if (orConditions.length === 0) {
            throw new Error('제품 식별자가 없습니다.');
          }

          const { data: existingParts, error: findError } = await supabase
            .from('parts')
            .select('id, stock')
            .or(orConditions.join(','));

          const existingPart = existingParts && existingParts.length > 0 ? existingParts[0] : null;

          if (findError && findError.code !== 'PGRST116') { // PGRST116은 데이터 없음 에러
            throw findError;
          }

          if (existingPart) {
            // 기존 제품 업데이트
            const updates = {};
            if (item.brand) updates.brand = item.brand;
            if (item.name) updates.name = item.name;
            if (item.supply_price !== undefined) updates.supply_price = item.supply_price;
            if (item.price !== undefined) updates.price = item.price;
            if (item.stock !== undefined) updates.stock = item.stock;
            if (item.note !== undefined) updates.note = item.note;

            if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabase
                .from('parts')
                .update(updates)
                .eq('id', existingPart.id);

              if (updateError) throw updateError;
            }

            // 재고 변경 로그 기록 (재고가 변경된 경우만)
            if (item.stock !== undefined && existingPart.stock !== item.stock) {
              await supabase
                .from('inventory_logs')
                .insert({
                  part_id: existingPart.id,
                  part_name: item.name,
                  part_code: item.code,
                  brand_code: item.brand,
                  change_type: 'manual_adjust',
                  quantity_change: item.stock - existingPart.stock,
                  previous_quantity: existingPart.stock,
                  new_quantity: item.stock,
                  reference_id: null,
                  reference_type: null,
                  notes: '엑셀 업로드를 통한 재고 수정'
                });

              await supabase
                .from('stock_logs')
                .insert({
                  product_id: existingPart.id,
                  previous_quantity: existingPart.stock,
                  new_quantity: item.stock,
                  change_quantity: item.stock - existingPart.stock,
                  reason: '엑셀 업로드',
                  created_by: (await supabase.auth.getUser()).data.user?.email || '관리자'
                });
            }

            updatedCount++;
          } else {
            // 새 제품 추가
            if (!item.name) throw new Error('새 제품을 추가하려면 제품명이 필수입니다.');
            
            const { error: insertError } = await supabase
              .from('parts')
              .insert({
                brand: item.brand || 'NB',
                code: item.code,
                name: item.name,
                supply_price: item.supply_price || 0,
                price: item.price || 0,
                stock: item.stock || 0,
                note: item.note || ''
              });

            if (insertError) throw insertError;
            insertedCount++;
          }
        } catch (itemError) {
          errors.push(`제품코드 ${item.code}: ${itemError.message}`);
        }
      }

      if (errors.length > 0) {
        setSnackbar({
          open: true,
          message: `일부 항목 처리 실패: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ` 외 ${errors.length - 3}건` : ''}`,
          severity: 'warning'
        });
      } else {
        setSnackbar({
          open: true,
          message: `업로드 완료: 신규 ${insertedCount}개, 수정 ${updatedCount}개`,
          severity: 'success'
        });
      }

      // 업로드 완료 후 목록 새로고침
      fetchParts();
      setUploadDialogOpen(false);
      setUploadedData([]);
      setUploadFile(null);

    } catch (error) {
      console.error('데이터 업로드 중 오류:', error);
      setSnackbar({
        open: true,
        message: `데이터 업로드 중 오류: ${error.message}`,
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
        재고 관리
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            select
            label="브랜드"
            value={brand}
            onChange={handleBrandChange}
            size="small"
            sx={{ width: 150, height: 40, '& .MuiInputBase-root': { height: 40, fontSize: '1rem' } }}
          >
            {BRAND_OPTIONS.map(opt => (
              <MenuItem key={opt} value={opt}>
                {opt === 'XRB' ? 'X-RIDER' : opt === 'NB' ? 'NEARBIKE' : '전체'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="재고 상태"
            value={stockFilter}
            onChange={handleStockFilterChange}
            size="small"
            sx={{ width: 150, height: 40, '& .MuiInputBase-root': { height: 40, fontSize: '1rem' } }}
          >
            {STOCK_FILTER_OPTIONS.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant={stockFilter === '품절 제외' ? 'contained' : 'outlined'}
            onClick={() => setStockFilter('품절 제외')}
            size="small"
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            재고 있음
          </Button>
          <Button
            variant={stockFilter === '품절' ? 'contained' : 'outlined'}
            onClick={() => setStockFilter('품절')}
            size="small"
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            재고 없음
          </Button>
          <SearchInput
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSearch={executeSearch}
            onClear={handleClearSearch}
            isSearching={isSearching}
          />
          <Button
            variant="outlined"
            onClick={() => navigate('/inventory-logs')}
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            재고 변경 이력
          </Button>
          <Button
            variant="outlined"
            onClick={handleDownloadExcel}
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            엑셀 다운로드
          </Button>
          <Button
            variant="contained"
            component="label"
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            엑셀 업로드
            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleFileUpload}
            />
          </Button>
          <Button
            variant="text"
            onClick={handleDownloadTemplate}
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            템플릿
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/brand-settings')}
            sx={{ height: 40, minWidth: 'max-content' }}
          >
            브랜드 설정
          </Button>
          <IconButton
            onClick={() => setShowSupplyPrice(!showSupplyPrice)}
            sx={{ 
              ml: 'auto',
              bgcolor: showSupplyPrice ? 'primary.main' : 'transparent',
              color: showSupplyPrice ? 'white' : 'primary.main',
              '&:hover': {
                bgcolor: showSupplyPrice ? 'primary.dark' : 'action.hover'
              }
            }}
            size="small"
          >
            {showSupplyPrice ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </IconButton>
        </Box>
      </Paper>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
        <TableContainer component={Paper}>
          <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
            <TableHead>
              <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                <TableCell onClick={() => handleSort('brand')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  브랜드{sortArrow('brand')}
                </TableCell>
                  <TableCell onClick={() => handleSort('code')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                    코드{sortArrow('code')}
                </TableCell>
                <TableCell onClick={() => handleSort('barcode')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  바코드{sortArrow('barcode')}
                </TableCell>
                <TableCell onClick={() => handleSort('name')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  제품명{sortArrow('name')}
                </TableCell>
                  {showSupplyPrice && (
                    <TableCell align="right" onClick={() => handleSort('supply_price')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                      공급가{sortArrow('supply_price')}
                </TableCell>
                  )}
                <TableCell align="right" onClick={() => handleSort('price')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  단가{sortArrow('price')}
                </TableCell>
                <TableCell align="right" onClick={() => handleSort('stock')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  재고{sortArrow('stock')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedParts.map(part => (
                <TableRow 
                  key={part.id}
                  sx={{
                    backgroundColor: changedItems.has(part.id) ? 'rgba(255, 235, 59, 0.15)' : 'inherit',
                    borderLeft: changedItems.has(part.id) ? '4px solid #ffcc02' : 'none',
                    transition: 'background-color 0.3s ease, border-left 0.3s ease',
                    '&:hover': {
                      backgroundColor: changedItems.has(part.id) ? 'rgba(255, 235, 59, 0.25)' : 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedItems.includes(part.id)}
                        onChange={() => handleSelectItem(part.id)}
                      />
                    </TableCell>
                  <TableCell>{part.brand}</TableCell>
                    <TableCell>
                      <Typography sx={{ 
                        fontSize: '0.95rem', 
                        letterSpacing: '0.01em',
                        color: 'text.primary' 
                      }}>
                        {part.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ 
                        fontSize: '0.9rem',
                        color: part.barcode ? 'text.primary' : 'text.secondary',
                        fontStyle: part.barcode ? 'normal' : 'italic'
                      }}>
                        {part.barcode || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ 
                        fontSize: '0.95rem', 
                        letterSpacing: '0.01em' 
                      }}>
                        {part.name}
                      </Typography>
                    </TableCell>
                    {showSupplyPrice && (
                      <TableCell align="right">{part.supply_price?.toLocaleString()}원</TableCell>
                    )}
                  <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const next = Math.max(0, (part.stock ?? 0) - 1);
                            handleStockChange(part.id, String(next));
                          }}
                          aria-label="decrement"
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <TextField
                          type="number"
                          size="small"
                          value={part.stock ?? 0}
                          onChange={e => handleStockChange(part.id, e.target.value)}
                          sx={{ 
                            width: 80,
                            '& input': {
                              fontWeight: (part.stock > 0) ? 700 : 400,
                              color: (part.stock === 0) ? 'error.main' : 'inherit',
                              backgroundColor: changedItems.has(part.id) ? 'rgba(255, 235, 59, 0.3)' : 'inherit'
                            },
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': {
                                borderColor: changedItems.has(part.id) ? '#ffcc02' : 'inherit',
                              borderWidth: changedItems.has(part.id) ? '2px' : '1px'
                            }
                          }
                        }}
                        inputProps={{ 
                          min: 0,
                          style: { textAlign: 'right' }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          const next = (part.stock ?? 0) + 1;
                          handleStockChange(part.id, String(next));
                        }}
                        aria-label="increment"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {/* 연동 파츠 정보 표시 */}
                    {syncedPartsMap[part.id] && syncedPartsMap[part.id].length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <LinkIcon fontSize="small" color="primary" sx={{ fontSize: '0.875rem' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          연동: {syncedPartsMap[part.id].map(sp => `${sp.part.brand}(${sp.part.stock || 0})`).join(', ')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedParts.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="페이지당 표시"
          />
        </TableContainer>
          
          {/* 저장 버튼 영역 */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                disabled={selectedItems.length === 0}
                onClick={handleSaveSelectedItems}
                sx={{
                  backgroundColor: selectedItems.some(id => changedItems.has(id)) ? '#ff9800' : 'primary.main',
                  '&:hover': {
                    backgroundColor: selectedItems.some(id => changedItems.has(id)) ? '#f57c00' : 'primary.dark'
                  }
                }}
              >
                선택 저장 ({selectedItems.length}개)
                {selectedItems.filter(id => changedItems.has(id)).length > 0 && 
                  ` - 변경된 ${selectedItems.filter(id => changedItems.has(id)).length}개`
                }
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSaveAllItems}
                sx={{
                  borderColor: changedItems.size > 0 ? '#ff9800' : 'primary.main',
                  color: changedItems.size > 0 ? '#ff9800' : 'primary.main',
                  '&:hover': {
                    borderColor: changedItems.size > 0 ? '#f57c00' : 'primary.dark',
                    backgroundColor: changedItems.size > 0 ? 'rgba(255, 152, 0, 0.04)' : 'rgba(25, 118, 210, 0.04)'
                  }
                }}
              >
                전체 저장 ({filteredParts.length}개)
                {changedItems.size > 0 && ` - 변경된 ${changedItems.size}개`}
              </Button>
            </Stack>
          </Box>
        </>
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      {/* 재고 로그 다이얼로그 */}
      <Dialog
        open={showLogDialog}
        onClose={() => setShowLogDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              재고 변동 이력
              {selectedProduct && ` - ${selectedProduct.name} (${selectedProduct.code})`}
            </Typography>
            <IconButton onClick={() => setShowLogDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>일자</TableCell>
                  <TableCell align="right">이전 수량</TableCell>
                  <TableCell align="right">변동 수량</TableCell>
                  <TableCell align="right">변경 후 수량</TableCell>
                  <TableCell>사유</TableCell>
                  <TableCell>담당자</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography sx={{ py: 2, color: 'text.secondary' }}>
                        재고 변동 이력이 없습니다.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  stockLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.created_at).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell align="right">{log.previous_quantity}</TableCell>
                      <TableCell 
                        align="right"
                        sx={{
                          color: log.change_quantity > 0 ? 'success.main' : 'error.main',
                          fontWeight: 500
                        }}
                      >
                        {log.change_quantity > 0 ? '+' : ''}{log.change_quantity}
                      </TableCell>
                      <TableCell align="right">{log.new_quantity}</TableCell>
                      <TableCell>{log.reason}</TableCell>
                      <TableCell>{log.created_by}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
      </Dialog>
      {/* 전체 재고 변동 내역 다이얼로그 */}
      <Dialog
        open={showAllLogsDialog}
        onClose={() => setShowAllLogsDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              전체 재고 변동 내역
            </Typography>
            <IconButton onClick={() => setShowAllLogsDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              type="date"
              label="시작일"
              value={dateRange.startDate}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                fetchAllStockLogs();
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              label="종료일"
              value={dateRange.endDate}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                fetchAllStockLogs();
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>일자</TableCell>
                    <TableCell>브랜드</TableCell>
                    <TableCell>제품명</TableCell>
                    <TableCell>제품코드</TableCell>
                    <TableCell align="right">이전 수량</TableCell>
                    <TableCell align="right">변동 수량</TableCell>
                    <TableCell align="right">변경 후 수량</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allStockLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography sx={{ py: 2, color: 'text.secondary' }}>
                          재고 변동 내역이 없습니다.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    allStockLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>{log.parts?.brand}</TableCell>
                        <TableCell>{log.parts?.name}</TableCell>
                        <TableCell>{log.parts?.code}</TableCell>
                        <TableCell align="right">{log.previous_quantity}</TableCell>
                        <TableCell 
                          align="right"
                          sx={{
                            color: log.change_quantity > 0 ? 'success.main' : 'error.main',
                            fontWeight: 500
                          }}
                        >
                          {log.change_quantity > 0 ? '+' : ''}{log.change_quantity}
                        </TableCell>
                        <TableCell align="right">{log.new_quantity}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* 엑셀 업로드 확인 다이얼로그 */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              엑셀 업로드 미리보기
            </Typography>
            <IconButton onClick={() => setUploadDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              업로드할 데이터를 확인하세요. 제품코드가 중복되는 경우 기존 데이터가 수정됩니다.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
              총 {uploadedData.length}개 항목
            </Typography>
          </Box>
          
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>브랜드</TableCell>
                  <TableCell>제품코드</TableCell>
                  <TableCell>제품명</TableCell>
                  <TableCell align="right">공급가</TableCell>
                  <TableCell align="right">단가</TableCell>
                  <TableCell align="right">재고</TableCell>
                  <TableCell>비고</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadedData.slice(0, 10).map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.brand}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.supply_price?.toLocaleString()}원</TableCell>
                    <TableCell align="right">{item.price?.toLocaleString()}원</TableCell>
                    <TableCell align="right">{item.stock}</TableCell>
                    <TableCell>{item.note}</TableCell>
                  </TableRow>
                ))}
                {uploadedData.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>
                      ... 외 {uploadedData.length - 10}개 항목
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setUploadDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmUpload}
              color="primary"
            >
              업로드 확인
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

    </Box>
  );
}

// 컴포넌트 메모이제이션
export default React.memo(StockList); 