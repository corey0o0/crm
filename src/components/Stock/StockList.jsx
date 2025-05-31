import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button, MenuItem, CircularProgress, Snackbar, Alert, IconButton, Dialog, DialogTitle, DialogContent,
  Checkbox, FormControlLabel, Stack, InputAdornment
} from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { sendTelegramNotification } from '../../lib/telegram';

// 메모이제이션된 옵션 상수
const BRAND_OPTIONS = ['전체', 'XRB', 'NB'];
const STOCK_FILTER_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: '품절 제외', label: '품절 제외' },
  { value: '품절', label: '품절' },
  { value: '3개 이하', label: '3개 이하' },
  { value: '1개 이하', label: '1개 이하' }
];

function StockList() {
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

  useEffect(() => {
    fetchParts();
  }, [brand]);

  const fetchParts = async () => {
    setLoading(true);
    let query = supabase.from('parts').select('*');
    if (brand !== '전체') query = query.eq('brand', brand);
    const { data, error } = await query;
    if (error) {
      setSnackbar({ open: true, message: '재고 목록을 불러오지 못했습니다.', severity: 'error' });
      setParts([]);
    } else {
      setParts(data || []);
    }
    setLoading(false);
  };

  const handleStockChange = (id, value) => {
    // 숫자가 아닌 입력 제거
    const numericValue = value.replace(/[^0-9]/g, '');
    // 숫자로 변환
    const stockValue = numericValue === '' ? 0 : parseInt(numericValue, 10);
    setParts(prev => prev.map(p => p.id === id ? { ...p, stock: stockValue } : p));
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

      // 재고 로그 기록
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
        });
      } catch (telegramError) {
        console.error('재고조정 텔레그램 알림 전송 중 오류:', telegramError);
      }

      console.log('알림 등록:', {
        type: 'stock',
        message: `재고조정[${parts.find(p => p.id === id)?.name}](${parts.find(p => p.id === id)?.code}) - 현재고: ${stockValue}`,
        link: `/stock`
      });

      setSnackbar({ open: true, message: '재고가 저장되었습니다.', severity: 'success' });
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

  // 검색어 입력 처리 함수 - 입력만 처리하고 검색은 실행하지 않음
  const handleSearchInput = (event) => {
    setSearchInput(event.target.value);
  };

  // 검색 실행 함수 - 엔터키나 검색 버튼 클릭 시에만 실행
  const executeSearch = () => {
    setSearchTerm(searchInput.toLowerCase().trim());
  };

  // 검색어 초기화 함수
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };

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
  }, []);

  // 재고 상태 필터 핸들러 메모이제이션
  const handleStockFilterChange = useCallback((e) => {
    setStockFilter(e.target.value);
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
          });
        } catch (telegramError) {
          console.error('재고 일괄 저장(선택) 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }
      
      setSnackbar({ open: true, message: `${selectedItems.length}개 항목의 재고가 저장되었습니다.`, severity: 'success' });
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
          });
        } catch (telegramError) {
          console.error('재고 일괄 저장(전체) 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }
      
      setSnackbar({ open: true, message: `${partsToSave.length}개 항목의 재고가 저장되었습니다.`, severity: 'success' });
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

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon sx={{ fontSize: 32 }} /> 재고 관리
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
          <TextField
            label="제품명/코드 검색"
            value={searchInput}
            onChange={handleSearchInput}
            onKeyPress={(event) => { // onKeyPress 직접 처리
              if (event.key === 'Enter') {
                executeSearch();
              }
            }}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClearSearch}
                    edge="end"
                  >
                    <CloseIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained"
            onClick={executeSearch}
            sx={{ height: 40, ml: 1 }}
          >
            검색
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={handleOpenAllLogs}
            sx={{ height: 40 }}
          >
            변동내역
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
          <Table size="small">
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
              {sortedParts.map(part => (
                <TableRow key={part.id}>
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
                    <TextField
                      type="number"
                      size="small"
                      value={part.stock ?? 0}
                      onChange={e => handleStockChange(part.id, e.target.value)}
                        sx={{ 
                          width: 80,
                          '& input': {
                            fontWeight: (part.stock > 0) ? 700 : 400,
                            color: (part.stock === 0) ? 'error.main' : 'inherit'
                          }
                        }}
                        inputProps={{ 
                          min: 0,
                          style: { 
                            textAlign: 'right',
                          }
                        }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
          
          {/* 저장 버튼 영역 */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                disabled={selectedItems.length === 0}
                onClick={handleSaveSelectedItems}
              >
                선택 저장 ({selectedItems.length}개)
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveAllItems}
              >
                전체 저장 ({filteredParts.length}개)
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
            <Table size="small">
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
              <Table size="small">
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
    </Box>
  );
}

// 컴포넌트 메모이제이션
export default React.memo(StockList); 