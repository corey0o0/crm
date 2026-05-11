import React, { useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, IconButton, Switch, FormControlLabel, Badge, Autocomplete, InputAdornment, Popover, Card, TableFooter, TablePagination
} from '@mui/material';
import { Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon, Search as SearchIcon, FilterList as FilterIcon, ArrowDownward as ArrowDownwardIcon, Download as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';

export default function InventoryStatus() {
  const context = useOutletContext();
  const navigate = useNavigate();
  const {
    products, warehouses, dealers, inventory, overallSearch, setOverallSearch,
    overallStockFilter, setOverallStockFilter, setFilter, setDateFilter, fetchProducts, fetchWarehouses,
    fetchDealers, toggleWarehouseSync, openWarehouseDetail, fetchTransactions, fetchInventoryData, warehouseDetailOpen, closeWarehouseDetail, warehouseDetailTarget, warehouseDetailFilter, setWarehouseDetailFilter, warehouseDetailSearch, setWarehouseDetailSearch, warehouseDetailBelow, setWarehouseDetailBelow, handleDirectInventoryEdit
  } = context;

  const [editPopoverAnchor, setEditPopoverAnchor] = useState(null);
  const [editData, setEditData] = useState({ warehouseId: '', productId: '', currentQty: 0, newQty: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [statusPage, setStatusPage] = useState(0);
  const [statusRowsPerPage, setStatusRowsPerPage] = useState(50);

  const handleOpenEdit = (e, warehouseId, productId, currentQty) => {
    setEditData({ warehouseId, productId, currentQty, newQty: currentQty, reason: '재고 현황에서 직접 수정' });
    setEditPopoverAnchor(e.currentTarget);
  };

  const handleCloseEdit = () => {
    setEditPopoverAnchor(null);
  };

  const submitEdit = async () => {
    if (saving) return;
    if (editData.newQty === '' || isNaN(editData.newQty)) return;
    setSaving(true);
    try {
      await handleDirectInventoryEdit(editData.warehouseId, editData.productId, editData.currentQty, Number(editData.newQty), editData.reason);
      handleCloseEdit();
    } finally {
      setSaving(false);
    }
  };

        const term = overallSearch.trim().toLowerCase();
        let rows = (products || []).filter(p => !p.is_deleted && p.track_inventory !== false && (!term || p.name?.toLowerCase().includes(term) || p.code?.toLowerCase().includes(term) || p.barcode?.toLowerCase().includes(term)));
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
                    placeholder="상품명/코드/바코드 검색"
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
                    color="success"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportExcel}
                  >
                    엑셀 다운로드
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      fetchProducts();
                      fetchInventoryData();
                      fetchTransactions();
                    }}
                  >
                    새로고침
                  </Button>
                </Box>
              </Box>
            </Card>

            <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'hidden' }}>
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
                  {rows.slice(statusPage * statusRowsPerPage, statusPage * statusRowsPerPage + statusRowsPerPage).map(p => {
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
                            navigate('/inventory-management/history');
                          }}
                        >
                          {p.name}
                        </TableCell>
                        <TableCell sx={{ width: 120, maxWidth: 120 }}>{p.barcode || '-'}</TableCell>
                        <TableCell sx={{ width: 120, maxWidth: 120 }}>{p.code || '-'}</TableCell>
                        {warehouses.map(w => (
                          <TableCell 
                            key={`cell-${p.id}-${w.id}`} 
                            align="right" 
                            sx={{ width: 120, maxWidth: 140, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            onClick={(e) => handleOpenEdit(e, w.id, p.id, inventory[w.id]?.[p.id] || 0)}
                          >
                            {(inventory[w.id]?.[p.id] || 0).toLocaleString()}
                          </TableCell>
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

            {rows.length > 0 && (
              <TablePagination
                component="div"
                count={rows.length}
                page={statusPage}
                onPageChange={(e, newPage) => setStatusPage(newPage)}
                rowsPerPage={statusRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setStatusRowsPerPage(parseInt(e.target.value, 10));
                  setStatusPage(0);
                }}
                rowsPerPageOptions={[20, 50, 100, 200]}
                labelRowsPerPage="페이지당 행 수"
                labelDisplayedRows={({ from, to, count }) => `${count}개 중 ${from}-${to}`}
              />
            )}

            <Popover
              open={Boolean(editPopoverAnchor)}
              anchorEl={editPopoverAnchor}
              onClose={handleCloseEdit}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 250 }}>
                <Typography variant="subtitle2">재고 직접 수정</Typography>
                <TextField 
                  label="현재 재고" 
                  size="small" 
                  value={editData.currentQty} 
                  disabled 
                />
                <TextField 
                  label="수정할 재고" 
                  type="number" 
                  size="small" 
                  value={editData.newQty} 
                  onChange={(e) => setEditData({...editData, newQty: e.target.value})} 
                  autoFocus
                />
                <TextField 
                  label="수정 사유 (선택)" 
                  size="small" 
                  value={editData.reason} 
                  onChange={(e) => setEditData({...editData, reason: e.target.value})} 
                />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={handleCloseEdit} color="inherit" disabled={saving}>취소</Button>
                  <Button size="small" variant="contained" onClick={submitEdit} color="primary" disabled={saving}>
                    {saving ? '처리 중...' : '저장'}
                  </Button>
                </Box>
              </Box>
            </Popover>
          </Box>
        );
}
