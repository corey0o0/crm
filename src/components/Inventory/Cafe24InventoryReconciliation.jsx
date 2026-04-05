import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Select, MenuItem, CircularProgress, Alert, Chip
} from '@mui/material';
import { getCafe24Malls, compareCafe24Inventory } from '../../utils/cafe24Api';

const Cafe24InventoryReconciliation = ({ products = [], warehouses = [], recalculatedInventory = {} }) => {
  const [malls, setMalls] = useState([]);
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
      }
    } catch (err) {
      console.error('Failed to load malls', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCompare = async () => {
    if (malls.length === 0) return;
    setLoadingData(true);
    setError(null);
    try {
      // 1. 모든 몰의 재고 정보 병렬로 가져오기
      const mallVariants = await Promise.all(malls.map(async m => {
        const res = await compareCafe24Inventory(m.mall_id);
        return { 
          mall_id: m.mall_id, 
          variants: (res.success && res.cafe24Variants) ? res.cafe24Variants : [] 
        };
      }));

      // 2. 공임(note === '공임') 성격의 파츠는 재고 비교에서 제외
      const nonLaborProducts = products.filter(p => p.note !== '공임');

      const newComparisonData = nonLaborProducts.map(product => {
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

        malls.forEach(m => {
          const mv = mallVariants.find(v => v.mall_id === m.mall_id);
          const matchedVariant = (barcode && mv) ? mv.variants.find(v => 
            v.custom_variant_code && v.custom_variant_code.trim() === barcode
          ) : null;
          
          let mallMatchStatus = '';
          let mallStock = null;
          if (matchedVariant) {
            if (!matchedVariant.use_inventory) {
              mallMatchStatus = '재고 설정 미사용';
              anyDisabled = true;
              allMatch = false;
            } else {
              mallStock = parseInt(matchedVariant.quantity || 0);
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
          
          cafe24Data[m.mall_id] = {
            product_name: matchedVariant ? matchedVariant.product_name : '-',
            stock: mallStock,
            use_inventory: matchedVariant ? matchedVariant.use_inventory : false,
            status: mallMatchStatus
          };
        });

        let finalStatus = '바코드 없음';
        if (barcode) {
          if (allMatch) {
            finalStatus = '일치';
          } else if (anyMissing) {
            finalStatus = '미연동 (일부/전체)';
          } else if (anyDisabled) {
            finalStatus = '재고 미사용 (일부/전체)';
          } else {
            finalStatus = '불일치';
          }
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
      
      setComparisonData(newComparisonData);
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
          <Button variant="contained" onClick={handleCompare} disabled={malls.length === 0 || loadingData}>
            {loadingData ? <CircularProgress size={24} color="inherit" /> : `등록된 모든 쇼핑몰(${malls.length}곳) 동시 비교 실행`}
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
              미연동 및 바코드 없음 ({comparisonData.filter(d => d.matchStatus.includes('미연동') || d.matchStatus === '바코드 없음').length})
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>바코드</TableCell>
                  <TableCell>CRM 상품명</TableCell>
                  <TableCell align="center">매칭 상태</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>CRM 총 재고</TableCell>
                  {malls.map(m => (
                    <TableCell key={m.mall_id} align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {m.mall_id} 재고
                    </TableCell>
                  ))}
                  {warehouses.map(w => (
                    <TableCell key={w.id} align="right" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {w.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map((row, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: row.matchStatus === '불일치' ? 'error.light' : (row.matchStatus.includes('미연동') ? 'warning.light' : 'inherit') }}>
                    <TableCell>{row.crm_barcode}</TableCell>
                    <TableCell>{row.crm_name}</TableCell>
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
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.totalCrmStock}</TableCell>
                    {malls.map(m => {
                      const mallData = row.cafe24Data[m.mall_id];
                      return (
                        <TableCell key={m.mall_id} align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {mallData ? (mallData.use_inventory ? mallData.stock : '재고미사용') : '-'}
                        </TableCell>
                      );
                    })}
                    {warehouses.map(w => (
                     <TableCell key={w.id} align="right" sx={{ color: 'text.secondary' }}>
                       {row.warehouseStocks[w.id]}
                     </TableCell>
                    ))}
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4 + malls.length + warehouses.length} align="center" sx={{ py: 4 }}>
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
