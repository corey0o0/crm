import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, CircularProgress, Alert, Chip, TextField, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CachedIcon from '@mui/icons-material/Cached';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { getCafe24Malls, compareCafe24Inventory } from '../../utils/cafe24Api';

const CACHE_KEY = 'cafe24_inventory_comparison_cache';

const Cafe24InventoryReconciliation = ({ products = [], warehouses = [], recalculatedInventory = {} }) => {
  const [malls, setMalls] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  const [comparisonData, setComparisonData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'ERROR', 'MATCH', 'UNLINKED'
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchMalls();
  }, []);

  // 캐시에서 이전 비교 결과 로드
  useEffect(() => {
    if (products.length > 0 && warehouses.length > 0) {
      loadCachedData();
    }
  }, [products, warehouses, recalculatedInventory]);

  const fetchMalls = async () => {
    setLoadingConfig(true);
    try {
      const res = await getCafe24Malls();
      if (res.success && res.malls) {
        setMalls(res.malls);
      }
    } catch (err) {
      console.error('Failed to load malls', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadCachedData = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return;

      const { data, fetchedAt, mallIds } = JSON.parse(cached);
      if (data && data.length > 0) {
        // 캐시된 카페24 데이터를 현재 CRM 재고와 다시 비교
        const refreshed = rebuildComparison(data, mallIds);
        setComparisonData(refreshed);
        setLastFetchedAt(fetchedAt);
      }
    } catch (err) {
      console.warn('[Cafe24Cache] 캐시 로드 실패:', err);
    }
  };

  /**
   * 캐시된 카페24 원본 데이터를 현재 CRM 재고와 다시 비교
   */
  const rebuildComparison = (cachedItems, mallIds) => {
    const nonLaborProducts = products.filter(p => p.note !== '공임');

    return nonLaborProducts.map(product => {
      const barcode = (product.barcode || '').trim();

      let totalCrmStock = 0;
      const warehouseStocks = {};
      warehouses.forEach(w => {
        const stock = recalculatedInventory[w.id]?.[product.id] || 0;
        warehouseStocks[w.id] = stock;
        totalCrmStock += stock;
      });

      const cafe24Data = {};
      let allMatch = true;
      let anyMissing = false;
      let anyDisabled = false;

      (mallIds || []).forEach(mallId => {
        const cachedMall = cachedItems.find(c => c.mall_id === mallId);
        const matchedVariant = (barcode && cachedMall)
          ? cachedMall.variants.find(v => v.custom_variant_code && v.custom_variant_code.trim() === barcode)
          : null;

        let mallMatchStatus = '';
        let mallStock = null;
        if (matchedVariant) {
          if (!matchedVariant.use_inventory) {
            mallMatchStatus = '재고 설정 미사용';
            anyDisabled = true;
            allMatch = false;
          } else {
            mallStock = parseInt(matchedVariant.quantity, 10) || 0;
            if (mallStock === totalCrmStock) {
              mallMatchStatus = '일치';
            } else {
              mallMatchStatus = '불일치';
              allMatch = false;
            }
          }
        } else {
          if (barcode) {
            mallMatchStatus = '미연동';
            anyMissing = true;
            allMatch = false;
          } else {
            mallMatchStatus = '바코드 없음';
            anyMissing = true;
            allMatch = false;
          }
        }

        cafe24Data[mallId] = {
          product_name: matchedVariant ? matchedVariant.product_name : '-',
          custom_variant_code: matchedVariant ? matchedVariant.custom_variant_code : '-',
          stock: mallStock,
          use_inventory: matchedVariant ? matchedVariant.use_inventory : false,
          status: mallMatchStatus
        };
      });

      let finalStatus = '바코드 없음';
      if (barcode) {
        if (allMatch) finalStatus = '일치';
        else if (anyMissing) finalStatus = '미연동 (일부/전체)';
        else if (anyDisabled) finalStatus = '재고 미사용 (일부/전체)';
        else finalStatus = '불일치';
      }

      return {
        part_id: product.id,
        crm_name: product.name,
        crm_barcode: barcode || '-',
        totalCrmStock,
        warehouseStocks,
        cafe24Data,
        is_match: allMatch && !!barcode,
        matchStatus: finalStatus
      };
    });
  };

  const handleCompare = async () => {
    if (malls.length === 0) return;
    setLoadingData(true);
    setError(null);
    try {
      // 1. 모든 몰의 재고 정보 병렬로 가져오기 (부분 실패 허용)
      const settledResults = await Promise.allSettled(malls.map(async m => {
        const res = await compareCafe24Inventory(m.mall_id);
        return { 
          mall_id: m.mall_id, 
          variants: (res.success && res.cafe24Variants) ? res.cafe24Variants : [] 
        };
      }));

      const mallVariants = settledResults.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        console.error(`Failed to fetch variants for mall ${malls[index].mall_id}`, result.reason);
        return { mall_id: malls[index].mall_id, variants: [] };
      });

      const mallIds = malls.map(m => m.mall_id);

      // 2. 캐시에 카페24 원본 데이터 저장
      const fetchedAt = new Date().toISOString();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: mallVariants,
          mallIds,
          fetchedAt
        }));
      } catch (e) {
        console.warn('[Cafe24Cache] 캐시 저장 실패:', e);
      }

      // 3. CRM 재고와 비교
      const newComparisonData = rebuildComparison(mallVariants, mallIds);
      setComparisonData(newComparisonData);
      setLastFetchedAt(fetchedAt);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // 검색 + 필터
  const filteredData = comparisonData.filter(item => {
    // 필터
    if (filter === 'MATCH' && !item.is_match) return false;
    if (filter === 'UNLINKED' && item.matchStatus !== '미연동' && !item.matchStatus.includes('미연동') && item.matchStatus !== '바코드 없음') return false;
    if (filter === 'ERROR' && item.matchStatus !== '불일치') return false;

    // 검색
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        item.crm_name.toLowerCase().includes(q) ||
        item.crm_barcode.toLowerCase().includes(q) ||
        Object.values(item.cafe24Data).some(d => 
          d.product_name?.toLowerCase().includes(q) ||
          d.custom_variant_code?.toLowerCase().includes(q)
        )
      );
    }
    return true;
  });

  if (loadingConfig) {
    return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  }

  const mallIds = malls.map(m => m.mall_id);
  // 캐시된 데이터에 다른 몰 ID가 있을 수 있으므로
  const displayMallIds = comparisonData.length > 0
    ? [...new Set([...mallIds, ...Object.keys(comparisonData[0]?.cafe24Data || {})])]
    : mallIds;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6">카페24 재고 비교 (자체 품목코드 ↔ CRM 바코드)</Typography>
          {lastFetchedAt && (
            <Typography variant="caption" color="text.secondary">
              <SaveAltIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              마지막 조회: {new Date(lastFetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
              {' '}(다시 비교 실행 전까지 이 데이터가 유지됩니다)
            </Typography>
          )}
        </Box>
        <Button 
          variant="contained" 
          startIcon={loadingData ? <CircularProgress size={18} color="inherit" /> : <CachedIcon />}
          onClick={handleCompare} 
          disabled={malls.length === 0 || loadingData}
        >
          {loadingData ? '조회 중...' : `비교 실행 (${malls.length}개 몰)`}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {comparisonData.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant={filter === 'ALL' ? 'contained' : 'outlined'} size="small" onClick={() => setFilter('ALL')}>
              전체 ({comparisonData.length})
            </Button>
            <Button variant={filter === 'MATCH' ? 'contained' : 'outlined'} size="small" color="success" onClick={() => setFilter('MATCH')}>
              일치 ({comparisonData.filter(d => d.is_match).length})
            </Button>
            <Button variant={filter === 'ERROR' ? 'contained' : 'outlined'} size="small" color="error" onClick={() => setFilter('ERROR')}>
              불일치 ({comparisonData.filter(d => d.matchStatus === '불일치').length})
            </Button>
            <Button variant={filter === 'UNLINKED' ? 'contained' : 'outlined'} size="small" color="warning" onClick={() => setFilter('UNLINKED')}>
              미연동/바코드없음 ({comparisonData.filter(d => d.matchStatus.includes('미연동') || d.matchStatus === '바코드 없음').length})
            </Button>
            <TextField
              size="small"
              placeholder="상품명 / 바코드 / 품목코드 검색"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              sx={{ ml: 'auto', minWidth: 250 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              }}
            />
          </Box>

          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>CRM 바코드</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>CRM 상품명</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>매칭 상태</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>CRM 총 재고</TableCell>
                  {displayMallIds.map(mallId => (
                    <React.Fragment key={mallId}>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'primary.50', color: 'primary.main', fontSize: '0.8rem' }}>
                        {mallId}<br />품목코드
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'primary.50', color: 'primary.main' }}>
                        {mallId}<br />재고
                      </TableCell>
                    </React.Fragment>
                  ))}
                  {warehouses.map(w => (
                    <TableCell key={w.id} align="right" sx={{ color: 'text.secondary', fontSize: '0.8rem', bgcolor: 'grey.50' }}>
                      {w.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((row, idx) => {
                  const rowBg = row.matchStatus === '불일치' ? '#fff3f3'
                    : row.matchStatus.includes('미연동') ? '#fff8e1'
                    : row.is_match ? '#f1f8e9' : 'inherit';

                  return (
                    <TableRow key={idx} sx={{ bgcolor: rowBg, '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.crm_barcode}</TableCell>
                      <TableCell>{row.crm_name}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.matchStatus}
                          color={
                            row.is_match ? 'success' :
                            row.matchStatus === '불일치' ? 'error' :
                            row.matchStatus.includes('미연동') ? 'warning' : 'default'
                          }
                          size="small"
                          variant={row.is_match ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.totalCrmStock}</TableCell>
                      {displayMallIds.map(mallId => {
                        const mallData = row.cafe24Data[mallId];
                        const stockDiff = mallData?.stock != null ? mallData.stock - row.totalCrmStock : null;
                        return (
                          <React.Fragment key={mallId}>
                            <TableCell align="center" sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                              {mallData?.custom_variant_code || '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ 
                              fontWeight: 'bold', 
                              color: mallData?.status === '불일치' ? 'error.main' : 
                                     mallData?.status === '일치' ? 'success.main' : 'text.secondary' 
                            }}>
                              {mallData ? (mallData.use_inventory ? (
                                <>
                                  {mallData.stock}
                                  {stockDiff != null && stockDiff !== 0 && (
                                    <Typography component="span" variant="caption" sx={{ 
                                      ml: 0.5, 
                                      color: stockDiff > 0 ? 'info.main' : 'error.main',
                                      fontWeight: 'bold'
                                    }}>
                                      ({stockDiff > 0 ? '+' : ''}{stockDiff})
                                    </Typography>
                                  )}
                                </>
                              ) : '재고미사용') : '-'}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                      {warehouses.map(w => (
                        <TableCell key={w.id} align="right" sx={{ color: 'text.secondary' }}>
                          {row.warehouseStocks[w.id]}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4 + displayMallIds.length * 2 + warehouses.length} align="center" sx={{ py: 4 }}>
                      {comparisonData.length > 0 ? '필터/검색 조건에 맞는 데이터가 없습니다.' : '비교 실행 버튼을 눌러주세요.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              표시: {filteredData.length} / 전체: {comparisonData.length}
            </Typography>
          </Box>
        </Paper>
      )}

      {comparisonData.length === 0 && !loadingData && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            상단의 <strong>"비교 실행"</strong> 버튼을 눌러 카페24 재고를 CRM 재고와 비교하세요.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            카페24 <strong>자체 품목코드</strong>와 CRM <strong>바코드</strong>가 일치하는 상품끼리 매칭됩니다.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default Cafe24InventoryReconciliation;
