import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Select, MenuItem, CircularProgress, Alert, Chip
} from '@mui/material';
import { getCafe24Malls, compareCafe24Inventory } from '../../utils/cafe24Api';

const Cafe24InventoryReconciliation = ({ products = [], warehouses = [], recalculatedInventory = {} }) => {
  const [malls, setMalls] = useState([]);
  const [selectedMall, setSelectedMall] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  const [comparisonData, setComparisonData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'ERROR', 'MATCH', 'UNLINKED'

  useEffect(() => {
    fetchMalls();
  }, []);

  const fetchMalls = async () => {
    setLoadingConfig(true);
    try {
      const res = await getCafe24Malls();
      if (res.success && res.malls) {
        setMalls(res.malls);
        if (res.malls.length > 0) {
          setSelectedMall(res.malls[0].mall_id);
        }
      }
    } catch (err) {
      console.error('Failed to load malls', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedMall) return;
    setLoadingData(true);
    setError(null);
    try {
      const res = await compareCafe24Inventory(selectedMall);
      if (res.success && res.cafe24Variants) {
        const cafe24Variants = res.cafe24Variants;
        
        // CRM 상품들을 기준으로 순회하며 매칭
        const newComparisonData = products.map(product => {
          // 바코드가 없는 CRM 상품도 일단 목록에는 표시합니다.
          const barcode = (product.barcode || '').trim();
          
          let matchedVariant = null;
          if (barcode) {
            matchedVariant = cafe24Variants.find(v => 
              v.custom_variant_code && v.custom_variant_code.trim() === barcode
            );
          }
          
          // 총 재고 계산
          let totalCrmStock = 0;
          const warehouseStocks = {};
          
          warehouses.forEach(w => {
            const stock = recalculatedInventory[w.id]?.[product.id] || 0;
            warehouseStocks[w.id] = stock;
            totalCrmStock += stock;
          });
          
          let isMatch = false;
          let matchStatus = '바코드 없음';
          
          if (matchedVariant) {
            if (!matchedVariant.use_inventory) {
              matchStatus = '재고 설정 미사용';
            } else if (parseInt(matchedVariant.quantity || 0) === totalCrmStock) {
              isMatch = true;
              matchStatus = '일치';
            } else {
              matchStatus = '불일치';
            }
          } else if (barcode) {
             matchStatus = '미연동';
          }

          return {
            part_id: product.id,
            crm_name: product.name,
            crm_barcode: barcode || '-',
            totalCrmStock,
            warehouseStocks,
            
            cafe24_product_name: matchedVariant ? matchedVariant.product_name : '-',
            cafe24_stock: matchedVariant && matchedVariant.use_inventory ? parseInt(matchedVariant.quantity || 0) : null,
            use_inventory: matchedVariant ? matchedVariant.use_inventory : false,
            
            is_match: isMatch,
            matchStatus
          };
        });
        
        setComparisonData(newComparisonData);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const filteredData = comparisonData.filter(item => {
    if (filter === 'MATCH') return item.is_match;
    if (filter === 'UNLINKED') return item.matchStatus === '미연동' || item.matchStatus === '바코드 없음';
    if (filter === 'ERROR') return item.matchStatus === '불일치';
    return true; // 'ALL'
  });

  if (loadingConfig) {
    return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Typography variant="h6">🌐 카페24 재고 비교 (바코드 및 창고 기준)</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Select
            size="small"
            value={selectedMall}
            onChange={e => setSelectedMall(e.target.value)}
            disabled={malls.length === 0}
            sx={{ minWidth: 200 }}
          >
            {malls.length === 0 && <MenuItem value="">등록된 몰이 없습니다</MenuItem>}
            {malls.map(m => (
              <MenuItem key={m.mall_id} value={m.mall_id}>{m.mall_id}</MenuItem>
            ))}
          </Select>
          <Button variant="contained" onClick={handleCompare} disabled={!selectedMall || loadingData}>
            {loadingData ? <CircularProgress size={24} color="inherit" /> : '재고 비교 실행'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {comparisonData.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button variant={filter === 'ALL' ? 'contained' : 'outlined'} onClick={() => setFilter('ALL')}>
              전체 CRM 상품 ({comparisonData.length})
            </Button>
            <Button variant={filter === 'MATCH' ? 'contained' : 'outlined'} color="success" onClick={() => setFilter('MATCH')}>
              일치 ({comparisonData.filter(d => d.is_match).length})
            </Button>
            <Button variant={filter === 'ERROR' ? 'contained' : 'outlined'} color="error" onClick={() => setFilter('ERROR')}>
              불일치 ({comparisonData.filter(d => d.matchStatus === '불일치').length})
            </Button>
            <Button variant={filter === 'UNLINKED' ? 'contained' : 'outlined'} color="warning" onClick={() => setFilter('UNLINKED')}>
              미연동 및 바코드 없음 ({comparisonData.filter(d => d.matchStatus === '미연동' || d.matchStatus === '바코드 없음').length})
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>바코드</TableCell>
                  <TableCell>CRM 상품명</TableCell>
                  <TableCell>Cafe24 상품명</TableCell>
                  <TableCell align="center">매칭 상태</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Cafe24 몰 재고</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>CRM 총 재고</TableCell>
                  {warehouses.map(w => (
                    <TableCell key={w.id} align="right" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {w.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((row, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: row.matchStatus === '불일치' ? 'error.light' : (row.matchStatus === '미연동' ? 'warning.light' : 'inherit') }}>
                    <TableCell>{row.crm_barcode}</TableCell>
                    <TableCell>{row.crm_name}</TableCell>
                    <TableCell>{row.cafe24_product_name}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={row.matchStatus} 
                        color={
                          row.is_match ? "success" : 
                          row.matchStatus === '불일치' ? "error" : 
                          "default"
                        } 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {row.cafe24_product_name !== '-' ? 
                        (row.use_inventory ? row.cafe24_stock : '재고미사용') 
                        : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.totalCrmStock}</TableCell>
                    {warehouses.map(w => (
                     <TableCell key={w.id} align="right" sx={{ color: 'text.secondary' }}>
                       {row.warehouseStocks[w.id]}
                     </TableCell>
                    ))}
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6 + warehouses.length} align="center" sx={{ py: 4 }}>
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default Cafe24InventoryReconciliation;
