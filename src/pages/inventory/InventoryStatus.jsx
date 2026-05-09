import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, IconButton, Switch, FormControlLabel, Badge, Autocomplete, InputAdornment, Popover, Card, TableFooter
} from '@mui/material';
import { Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon, Search as SearchIcon, FilterList as FilterIcon, ArrowDownward as ArrowDownwardIcon, Download as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';

export default function InventoryStatus() {
  const context = useOutletContext();
  const {
    products, warehouses, dealers, inventory, overallSearch, setOverallSearch,
    overallStockFilter, setOverallStockFilter, setFilter, setDateFilter, setActiveTab, fetchProducts, fetchWarehouses,
    fetchDealers, toggleWarehouseSync, openWarehouseDetail, fetchTransactions, recalculateInventoryFromTransactions, warehouseDetailOpen, closeWarehouseDetail, warehouseDetailTarget, warehouseDetailFilter, setWarehouseDetailFilter, warehouseDetailSearch, setWarehouseDetailSearch, warehouseDetailBelow, setWarehouseDetailBelow
  } = context;

        const term = overallSearch.trim().toLowerCase();
        let rows = (products || []).filter(p => !p.is_deleted && (!term || p.name?.toLowerCase().includes(term) || p.code?.toLowerCase().includes(term)));
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

        const handleExportExcel = () => {
          // 헤더 구성
          const headers = ['상품', '바코드', '제품코드', ...warehouses.map(w => w.name), '상품별 총합'];
          
          // 데이터 구성
          const data = rows.map(p => {
            const productTotal = warehouses.reduce((sum, w) => sum + (inventory[w.id]?.[p.id] || 0), 0);
            return [
              p.name,
              p.barcode || '-',
              p.code || '-',
              ...warehouses.map(w => inventory[w.id]?.[p.id] || 0),
              productTotal
            ];
          });
          
          // 푸터 구성
          const footer = ['창고별 총합', '', '', ...warehouseTotals, grandTotal];
          
          // 워크시트 생성
          const ws = XLSX.utils.aoa_to_sheet([headers, ...data, footer]);
          
          // 열 너비 설정
          ws['!cols'] = [
            { wch: 30 }, // 상품
            { wch: 15 }, // 바코드
            { wch: 15 }, // 제품코드
            ...warehouses.map(() => ({ wch: 12 })), // 창고
            { wch: 15 }  // 상품별 총합
          ];

          // 워크북 생성 및 저장
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, '재고현황');
          
          const today = new Date();
          const dateStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
          XLSX.writeFile(wb, `재고현황_${dateStr}.xlsx`);
        };

        return (
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
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={async () => {
                      try {
                        const { supabase } = await import('../../lib/supabaseClient');
                        const { data: parts } = await supabase.from('parts').select('id, name, stock').neq('stock', 0).not('stock', 'is', null);
                        if (!parts || parts.length === 0) {
                          alert('이미 남은 기존 재고가 없습니다.');
                          return;
                        }
                        const txs = parts.map(p => ({
                          product_id: p.id,
                          product_name: p.name,
                          type: 'out',
                          quantity: p.stock,
                          from_location: 'adjustment',
                          to_location: null,
                          date: new Date().toISOString(),
                          note: '기초 재고 세팅 전 0 초기화 (실사 조정)',
                          status: '완료'
                        }));
                        const { error: txErr } = await supabase.from('transactions').insert(txs);
                        if (txErr) throw txErr;
                        const updates = parts.map(p => ({ id: p.id, stock: 0 }));
                        const { error: pErr } = await supabase.from('parts').upsert(updates);
                        if (pErr) throw pErr;
                        alert('기존 재고 0 초기화 완료!');
                        window.location.reload();
                      } catch(e) {
                        alert(e.message);
                      }
                    }}
                  >
                    임시 재고 0 초기화
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportExcel}
                  >
                    엑셀 다운로드
                  </Button>
                </Box>
              </Box>
            </Card>

            <TableContainer component={Paper} sx={{ width: '100%', maxHeight: 600, overflowX: 'hidden', overflowY: 'auto' }}>
              <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'fixed', borderTop: '1px solid rgba(224, 224, 224, 1)', borderLeft: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderRight: '1px solid rgba(224, 224, 224, 1)', borderBottom: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ position: 'sticky', left: 0, zIndex: 3, backgroundColor: '#f5f5f5', width: 240, maxWidth: 240, fontWeight: 'bold' }}>상품</TableCell>
                    <TableCell sx={{ width: 120, maxWidth: 120 }}>바코드</TableCell>
                    <TableCell sx={{ width: 120, maxWidth: 120 }}>제품코드</TableCell>
                    {warehouses.map(w => (
                      <TableCell key={`wh-col-${w.id}`} align="right" sx={{ width: 120, maxWidth: 140 }}>{w.name}</TableCell>
                    ))}
                    <TableCell align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>상품별 총합</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(p => {
                    const productTotal = warehouses.reduce((sum, w) => sum + (inventory[w.id]?.[p.id] || 0), 0);
                    return (
                      <TableRow key={`prod-row-${p.id}`} hover>
                        <TableCell 
                          sx={{ 
                            position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'background.paper', 
                            fontWeight: 'bold', width: 240, maxWidth: 240, 
                            cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' 
                          }}
                          onClick={() => {
                            setFilter(prev => ({ 
                              ...prev, product: p.name, type: 'all', 
                              dateFrom: '', dateTo: '', fromLocation: '', toLocation: '', note: '' 
                            }));
                            setDateFilter('all');
                            setActiveTab(1); // 거래 내역 탭으로 이동
                          }}
                        >
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
                  })}
                </TableBody>
                <TableFooter sx={{ position: 'sticky', bottom: 0, zIndex: 4 }}>
                  <TableRow sx={{ backgroundColor: '#e0e0e0' }}>
                    <TableCell sx={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#e0e0e0', fontWeight: 'bold', width: 240, maxWidth: 240 }}>
                      창고별 총합
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#e0e0e0' }}></TableCell>
                    <TableCell sx={{ backgroundColor: '#e0e0e0' }}></TableCell>
                    {warehouses.map((w, index) => (
                      <TableCell key={`warehouse-total-${w.id}`} align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                        {warehouseTotals[index].toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ width: 120, maxWidth: 140, backgroundColor: '#d5d5d5', fontWeight: 'bold' }}>
                      {grandTotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>
          </Box>
        );
}
