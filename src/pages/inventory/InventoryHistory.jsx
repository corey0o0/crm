import ExcelJS from 'exceljs';
import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination, TablePagination, TableFooter, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Autocomplete, Switch, FormControlLabel, Snackbar, Alert, CircularProgress
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon, Remove as RemoveIcon, Add as AddIcon, Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon, Delete as DeleteIcon, Upload as UploadIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { inventoryApi } from '../../api/inventoryApi';
import LocationManagement from '../../components/Inventory/LocationManagement';
import BarcodeScanner from '../../components/Inventory/BarcodeScanner';

export default function InventoryHistory() {
  const context = useOutletContext();
  const {
    filter, setFilter, dateFilter, setDateFilter, handleDateFilterClick, transactionViewMode, setTransactionViewMode,
    selectedTransactions, setSelectedTransactions, handleDeleteSelectedTransactions,
    filteredTransactions, itemsPerPage, setItemsPerPage, setCurrentPage, pendingInventory, paginatedTransactions, getTransactionTypeInfo, products, formatLocationName, warehouses, visibleWarehouses, dealers,
    openTransactionDetail, handleTableCellHover, handleTableCellHoverLeave, handleTableCellClick,
    hoverAnchorEl, hoverTransactions, dateKeys, ioByWarehouseProductDate, totalPages, currentPage,
    handlePageChange, showSnackbar, tableModalOpen, setTableModalOpen, selectedTableTransactions,
    transactions, inventory, setInventory, fetchProducts, fetchTransactions, fetchInventoryData,
    handleCloseDialog, handleOpenDialog, openDialog, dialogType, formData, setFormData, editMode, editFormData, setEditFormData,
    editProducts, setEditProducts, saveEditTransaction, cancelEditTransaction, addEditProduct, removeEditProduct,
    updateEditProduct, handleViewOriginal, multipleIoProducts, setMultipleIoProducts,
    addIoProductRow, removeIoProductRow, updateIoProductRow, excelUploadOpen,
    handleCloseExcelUpload, handleExcelFileUpload, excelFile, excelUploadType, setExcelUploadType,
    handleOpenExcelUpload, transactionDetailOpen, closeTransactionDetail,
    selectedTransaction, startEditTransaction, recalculateAllInventory, deleteTransaction
  , batchFromLocation, setBatchFromLocation, batchToLocation, setBatchToLocation, showOriginalHistory, setShowOriginalHistory, handleSubmitTransaction, downloadExcelTemplate, handleDragOver, handleDragLeave, handleDrop, handleExcelDataSubmit, handleBatchApplyLocation, warehouseDetailTarget, warehouseDetailOpen, closeWarehouseDetail, barcodeScannerOpen, setBarcodeScannerOpen, setCurrentScanningRow, handleBarcodeScan, handleBarcodeScanError, excelData, isDragOver, snackbar, setSnackbar, isSubmittingTransaction,
    editBatchFromLocation, setEditBatchFromLocation, editBatchToLocation, setEditBatchToLocation, handleEditBatchApplyLocation,
    verifyInventory, verifyResults, verifyOpen, setVerifyOpen, verifyLoading} = context;

  const [detailProcessing, setDetailProcessing] = useState(false);

  return (

        <Box>
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">
          입출고 관리
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            단축키: ESC(닫기) | Enter(행추가) | Ctrl+N(새등록)
          </Typography>
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
            color="warning"
            onClick={verifyInventory}
            disabled={verifyLoading}
            startIcon={verifyLoading ? <CircularProgress size={16} /> : null}
          >
            재고 검증
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              fetchProducts();
              fetchTransactions();
              setTimeout(() => {
                fetchInventoryData();
              }, 100);
            }}
          >
            새로고침
          </Button>
        </Box>
      </Box>
          {/* 검색/기간 통합 필터 UI */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              
              {/* 거래 유형 & 정렬 드롭다운 */}
              <Grid item xs={12} md="auto">
                <Stack direction="row" spacing={1}>
                  <FormControl size="small" sx={{ width: 120 }}>
                    <InputLabel>거래 유형</InputLabel>
                    <Select
                      value={filter.type}
                      label="거래 유형"
                      onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <MenuItem value="all">전체</MenuItem>
                      <MenuItem value="import">수입</MenuItem>
                      <MenuItem value="in">입고</MenuItem>
                      <MenuItem value="out">출고</MenuItem>
                      <MenuItem value="warehouse_transfer">창고이동</MenuItem>
                      <MenuItem value="direct_edit">직접 수정</MenuItem>
                      <MenuItem value="adjustment">재고 조정</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ width: 130 }}>
                    <InputLabel>판매 구분</InputLabel>
                    <Select
                      value={filter.saleType}
                      label="판매 구분"
                      onChange={(e) => setFilter(prev => ({ ...prev, saleType: e.target.value }))}
                    >
                      <MenuItem value="all">전체</MenuItem>
                      <MenuItem value="online">온라인판매</MenuItem>
                      <MenuItem value="store">매장판매</MenuItem>
                      <MenuItem value="manual_sale">수기판매</MenuItem>
                      <MenuItem value="as">A/S</MenuItem>
                      <MenuItem value="direct">직접등록</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ width: 130 }}>
                    <InputLabel>정렬 기준</InputLabel>
                    <Select
                      value={filter.sortBy}
                      label="정렬 기준"
                      onChange={(e) => setFilter(prev => ({ ...prev, sortBy: e.target.value }))}
                    >
                      <MenuItem value="date">날짜</MenuItem>
                      <MenuItem value="type">유형</MenuItem>
                      <MenuItem value="product">상품</MenuItem>
                      <MenuItem value="quantity">수량</MenuItem>
                      <MenuItem value="from">출발지</MenuItem>
                      <MenuItem value="to">목적지</MenuItem>
                      <MenuItem value="note">메모</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ width: 120 }}>
                    <InputLabel>정렬</InputLabel>
                    <Select
                      value={filter.sortOrder}
                      label="정렬"
                      onChange={(e) => setFilter(prev => ({ ...prev, sortOrder: e.target.value }))}
                    >
                      <MenuItem value="asc">오름차순</MenuItem>
                      <MenuItem value="desc">내림차순</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>

              {/* 날짜 필터 & 퀵버튼 */}
              <Grid item xs={12} md>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '6px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#e0e0e0', borderRadius: '4px' } }}>
                  <ButtonGroup size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                    <Button variant={dateFilter === 'all' ? 'contained' : 'outlined'} onClick={() => handleDateFilterClick('all')}>전체</Button>
                    <Button variant={dateFilter === 'today' ? 'contained' : 'outlined'} onClick={() => handleDateFilterClick('today')}>당일</Button>
                    <Button variant={dateFilter === 'week' ? 'contained' : 'outlined'} onClick={() => handleDateFilterClick('week')}>이번주</Button>
                    <Button variant={dateFilter === 'month' ? 'contained' : 'outlined'} onClick={() => handleDateFilterClick('month')}>당월</Button>
                    <Button variant={dateFilter === 'prevMonth' ? 'contained' : 'outlined'} onClick={() => handleDateFilterClick('prevMonth')}>전월</Button>
                  </ButtonGroup>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      size="small"
                      type="date"
                      value={filter.dateFrom}
                      onChange={(e) => setFilter(prev => ({ ...prev, dateFrom: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 140 }}
                    />
                    <Typography variant="body2">~</Typography>
                    <TextField
                      size="small"
                      type="date"
                      value={filter.dateTo}
                      onChange={(e) => setFilter(prev => ({ ...prev, dateTo: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 140 }}
                    />
                  </Box>
                </Stack>
              </Grid>

              {/* 검색명 입력 & 버튼 그룹 */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <TextField
                    size="small"
                    label="상품명 검색"
                    value={filter.product}
                    onChange={(e) => setFilter(prev => ({ ...prev, product: e.target.value }))}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    label="출발지 검색"
                    value={filter.fromLocation}
                    onChange={(e) => setFilter(prev => ({ ...prev, fromLocation: e.target.value }))}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    label="목적지 검색"
                    value={filter.toLocation}
                    onChange={(e) => setFilter(prev => ({ ...prev, toLocation: e.target.value }))}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    label="메모/주문번호 검색"
                    value={filter.note}
                    onChange={(e) => setFilter(prev => ({ ...prev, note: e.target.value }))}
                    sx={{ width: 180 }}
                  />
                  
                  <Button variant="contained" onClick={() => showSnackbar('필터가 적용되었습니다.', 'success')} sx={{ bgcolor: '#3182f6' }}>검색</Button>
                  <Button variant="outlined" onClick={() => {
                    setFilter({
                      dateFrom: '', dateTo: '', fromLocation: '', toLocation: '', product: '', note: '', type: 'all', saleType: 'all', sortBy: 'date', sortOrder: 'desc'
                    });
                    setDateFilter('all');
                  }}>초기화</Button>
                </Stack>
              </Grid>

            </Grid>
          </Paper>

          {/* 거래 내역 보기 전환 및 렌더 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box>
              {transactionViewMode === 'list' && selectedTransactions.length > 0 && (
                <Button size="small" variant="outlined" color="error" onClick={handleDeleteSelectedTransactions}>
                  선택 삭제 ({selectedTransactions.length})
                </Button>
              )}
            </Box>
            {/* 리스트보기/표보기 전환 버튼 - 숨김 처리 */}
            {false && (
            <Box sx={{ display: 'inline-flex', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Button size="small" variant={transactionViewMode === 'list' ? 'contained' : 'text'} onClick={() => setTransactionViewMode('list')}>리스트 보기</Button>
              <Button size="small" variant={transactionViewMode === 'table' ? 'contained' : 'text'} onClick={() => setTransactionViewMode('table')}>표 보기</Button>
            </Box>
            )}
          </Box>

          {transactionViewMode === 'list' && (
            <>
              <TableContainer component={Paper}>
              <Table size="small" sx={{ borderTop: '1px solid rgba(224, 224, 224, 1)', borderLeft: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { borderRight: '1px solid rgba(224, 224, 224, 1)', borderBottom: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
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
                    <TableCell align="center">확정</TableCell>
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
                          {group.isConfirmed === false ? (
                            <Chip label="미확정" size="small" color="warning" variant="outlined" />
                          ) : (
                            <Chip label="확정" size="small" color="success" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {group.items.length === 1 ? (
                            group.items[0].productName
                          ) : (
                            <Tooltip
                              title={
                                <Box sx={{ p: 0.5 }}>
                                  {group.items.map((item, i) => (
                                    <Typography key={i} variant="body2" sx={{ fontSize: '0.8rem' }}>
                                      • {item.productName} ({item.quantity}개)
                                    </Typography>
                                  ))}
                                </Box>
                              }
                              arrow
                              placement="top"
                            >
                              <Box sx={{ display: 'flex', flexDirection: 'column', borderBottom: '1px dashed #999', pb: 0.5 }}>
                                {group.items.slice(0, 3).map((item, idx) => (
                                  <Typography key={idx} variant="body2" sx={{ cursor: 'pointer' }}>
                                    {item.productName}
                                  </Typography>
                                ))}
                                {group.items.length > 3 && (
                                  <Typography variant="body2" color="text.secondary" sx={{ cursor: 'pointer', mt: 0.5 }}>
                                    외 {group.items.length - 3}개
                                  </Typography>
                                )}
                              </Box>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="center">{group.items.length}</TableCell>
                        <TableCell align="center">{group.items.length === 1 ? group.items[0].quantity : group.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</TableCell>
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
            
            {/* 페이지네이션 (A/S관리 스타일) */}
            {filteredTransactions.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
                <TablePagination
                  component="div"
                  count={filteredTransactions.length}
                  page={currentPage - 1}
                  onPageChange={(event, newPage) => {
                    setCurrentPage(newPage + 1);
                  }}
                  rowsPerPage={itemsPerPage}
                  onRowsPerPageChange={(event) => {
                    setItemsPerPage(parseInt(event.target.value, 10));
                    setCurrentPage(1);
                  }}
                  rowsPerPageOptions={[20, 50, 100, 200, 500]}
                  labelRowsPerPage="페이지당 행 수"
                  labelDisplayedRows={({ from, to, count }) => 
                    `${count}개 중 ${from}-${to}`
                  }
                  sx={{
                    '.MuiTablePagination-select': {
                      paddingTop: '6px',
                      paddingBottom: '6px',
                    },
                    '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                      fontSize: '0.875rem',
                    }
                  }}
                />
              </Box>
            )}
            </>
          )}

          {transactionViewMode === 'table' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {dateKeys.length > 0 ? `기간: ${dateKeys[0]} ~ ${dateKeys[dateKeys.length - 1]}` : '기간 내역 없음'}
              </Typography>
              <Grid container spacing={2}>
                {visibleWarehouses.map(w => {
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
                            <Table size="small" sx={{ borderTop: '1px solid rgba(224, 224, 224, 1)', borderLeft: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { borderRight: '1px solid rgba(224, 224, 224, 1)', borderBottom: '1px solid rgba(224, 224, 224, 1)' } }}>
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
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
      {/* 입출고 등록 다이얼로그 (통합) */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          다중 상품 입출고 등록
        </DialogTitle>
        <DialogContent>
          {/* 통합 폼 */}
          <Box sx={{ pt: 2 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    variant="standard"
                  label="거래 날짜"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    variant="standard"
                    label="공통 메모"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="모든 상품에 적용될 공통 메모"
                  />
                </Grid>
                <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isConfirmed ?? true}
                        onChange={(e) => setFormData(prev => ({ ...prev, isConfirmed: e.target.checked }))}
                        color="success"
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight="bold" color={(formData.isConfirmed ?? true) ? 'success.main' : 'warning.main'}>
                        {(formData.isConfirmed ?? true) ? '확정' : '미확정'}
                      </Typography>
                    }
                  />
                </Grid>
              </Grid>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                상품 목록
                <Button
                  variant="outlined"
                  size="small"
                  onClick={addIoProductRow}
                >
                  상품 추가
                </Button>
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fafafa' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1, fontWeight: 'medium' }}>출발지/목적지 일괄 적용:</Typography>
                <Autocomplete
                  sx={{ width: 150 }}
                  options={[
                    { id: '', name: '외부 (신규입고)', type: 'external' },
                    { id: 'adjustment', name: '재고 조정', type: 'external' },
                    ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                    ...dealers.map(d => ({ ...d, type: 'dealer' }))
                  ]}
                  getOptionLabel={(option) => {
                    if (option.type === 'external') return option.name;
                    return `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`;
                  }}
                  value={(() => {
                    if (batchFromLocation === 'adjustment') return { id: 'adjustment', name: '재고 조정', type: 'external' };
                    if (!batchFromLocation || batchFromLocation === '') return null;
                    const warehouse = warehouses.find(w => w.id === batchFromLocation);
                    if (warehouse) return { ...warehouse, type: 'warehouse' };
                    const dealer = dealers.find(d => d.id === batchFromLocation);
                    if (dealer) return { ...dealer, type: 'dealer' };
                    return null;
                  })()}
                  onChange={(event, value) => setBatchFromLocation(value?.id ?? '')}
                  renderInput={(params) => <TextField {...params} variant="standard" label="일괄 출발지" size="small" placeholder="출발지 선택" />}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                />
                <Autocomplete
                  sx={{ width: 150 }}
                  options={[
                    ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                    ...dealers.map(d => ({ ...d, type: 'dealer' }))
                  ]}
                  getOptionLabel={(option) => `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`}
                  value={(() => {
                    if (!batchToLocation) return null;
                    const warehouse = warehouses.find(w => w.id === batchToLocation);
                    if (warehouse) return { ...warehouse, type: 'warehouse' };
                    const dealer = dealers.find(d => d.id === batchToLocation);
                    if (dealer) return { ...dealer, type: 'dealer' };
                    return null;
                  })()}
                  onChange={(event, value) => setBatchToLocation(value?.id || '')}
                  renderInput={(params) => <TextField {...params} variant="standard" label="일괄 목적지" size="small" />}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                />
                <Button variant="contained" size="small" onClick={handleBatchApplyLocation} disabled={!batchFromLocation && !batchToLocation}>
                  적용
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell sx={{ minWidth: 250, fontWeight: 'bold' }}>상품 선택 (필수)</TableCell>
                    <TableCell sx={{ width: 100, fontWeight: 'bold' }}>수량 (필수)</TableCell>
                    <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>출발지</TableCell>
                    <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>목적지 (필수)</TableCell>
                    <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>개별 메모</TableCell>
                    <TableCell sx={{ minWidth: 120, fontWeight: 'bold' }}>박스 번호</TableCell>
                    <TableCell sx={{ width: 50, fontWeight: 'bold' }}>삭제</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {multipleIoProducts.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell sx={{ p: 1 }}>
                        <Autocomplete
                          fullWidth
                          options={products}
                          getOptionLabel={(option) => `${option.name} (${option.code})${option.barcode ? ` [바코드:${option.barcode}]` : ''} [${option.supplier || '-'}]`}
                          value={products.find(p => p.id === product.productId) || null}
                          onChange={(event, value) => updateIoProductRow(product.id, 'productId', value?.id || '')}
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
                                      return `${option.code} • ${option.category} • ${option.supplier || '-'} • ${option.price?.toLocaleString()}원 • 출발지 재고 ${available}개`;
                                    }
                                    return `${option.code} • ${option.category} • ${option.supplier || '-'} • ${option.price?.toLocaleString()}원`;
                                  })()}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              variant="standard"
                              required
                              fullWidth
                              size="small"
                              placeholder="상품 검색"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1 }}>
                        <TextField
                          fullWidth
                          variant="standard"
                          type="number"
                          size="small"
                          value={product.quantity}
                          onChange={(e) => updateIoProductRow(product.id, 'quantity', e.target.value)}
                          required
                          helperText={(() => {
                            const srcId = product.fromLocation;
                            const isOutbound = warehouses.find(w => w.id === srcId);
                            if (!isOutbound) return '';
                            const pid = parseInt(product.productId, 10) || 0;
                            const available = (inventory[srcId]?.[pid]) || 0;
                            return `잔여:${available}`;
                          })()}
                          FormHelperTextProps={{ sx: { margin: 0, marginTop: '2px', fontSize: '0.7rem' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1 }}>
                        <Autocomplete
                          options={[
                            { id: '', name: '외부 (신규입고)', type: 'external' },
                            { id: 'adjustment', name: '재고 조정', type: 'external' },
                            ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                            ...dealers.map(d => ({ ...d, type: 'dealer' }))
                          ]}
                          getOptionLabel={(option) => {
                            if (option.type === 'external') return option.name;
                            return `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`;
                          }}
                          value={(() => {
                            if (product.fromLocation === 'adjustment') return { id: 'adjustment', name: '재고 조정', type: 'external' };
                            if (!product.fromLocation || product.fromLocation === '') return null;
                            const warehouse = warehouses.find(w => w.id === product.fromLocation);
                            if (warehouse) return { ...warehouse, type: 'warehouse' };
                            const dealer = dealers.find(d => d.id === product.fromLocation);
                            if (dealer) return { ...dealer, type: 'dealer' };
                            return null;
                          })()}
                          onChange={(event, value) => updateIoProductRow(product.id, 'fromLocation', value?.id ?? '')}
                          renderInput={(params) => <TextField {...params} variant="standard" size="small" fullWidth placeholder="출발지 선택" />}
                          isOptionEqualToValue={(option, value) => option?.id === value?.id}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1 }}>
                        <Autocomplete
                          options={[
                            ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                            ...dealers.map(d => ({ ...d, type: 'dealer' }))
                          ]}
                          getOptionLabel={(option) => `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`}
                          value={(() => {
                            const warehouse = warehouses.find(w => w.id === product.toLocation);
                            if (warehouse) return { ...warehouse, type: 'warehouse' };
                            const dealer = dealers.find(d => d.id === product.toLocation);
                            if (dealer) return { ...dealer, type: 'dealer' };
                            return null;
                          })()}
                          onChange={(event, value) => updateIoProductRow(product.id, 'toLocation', value?.id || '')}
                          renderInput={(params) => <TextField {...params} variant="standard" size="small" fullWidth required />}
                          isOptionEqualToValue={(option, value) => option?.id === value?.id}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1 }}>
                        <TextField
                          fullWidth
                          variant="standard"
                          size="small"
                          value={product.note}
                          onChange={(e) => updateIoProductRow(product.id, 'note', e.target.value)}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1 }}>
                        <TextField
                          fullWidth
                          variant="standard"
                          size="small"
                          value={product.boxNo || ''}
                          onChange={(e) => updateIoProductRow(product.id, 'boxNo', e.target.value)}
                        />
                      </TableCell>
                      <TableCell sx={{ p: 1, textAlign: 'center' }}>
                        <IconButton
                          color="error"
                          onClick={() => removeIoProductRow(product.id)}
                          disabled={multipleIoProducts.length === 1}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
              
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
                    const quantity = parseInt(product.quantity, 10) || 0;
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
          <Button
            onClick={handleSubmitTransaction}
            variant="contained"
            disabled={isSubmittingTransaction}
            startIcon={isSubmittingTransaction ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSubmittingTransaction ? '등록 중...' : `입출고 등록 (${multipleIoProducts.length}개 상품)`}
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            거래내역 상세 정보
            {(selectedTransaction?.group_id || selectedTransaction?.id) && (selectedTransaction?.group_id !== 'none' && selectedTransaction?.id !== 'none') && (
              <Button 
                variant="outlined" 
                color="primary" 
                size="small" 
                onClick={handleViewOriginal}
              >
                원본 보기
              </Button>
            )}
          </Box>
          <IconButton
            aria-label="close"
            onClick={closeTransactionDetail}
            sx={{
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      {getTransactionTypeInfo(selectedTransaction).label} 상세 내역 ({editMode ? editProducts.length : (showOriginalHistory && selectedTransaction.rawItems ? selectedTransaction.rawItems.length : selectedTransaction.items.length)}개 상품)
                    </Typography>
                    {!editMode && selectedTransaction.rawItems && selectedTransaction.rawItems.length > selectedTransaction.items.length && (
                      <FormControlLabel
                        control={<Switch checked={showOriginalHistory} onChange={(e) => setShowOriginalHistory(e.target.checked)} size="small" />}
                        label={<Typography variant="body2" fontWeight="medium" sx={{ cursor: 'pointer' }}>원본 작업 전체 보기</Typography>}
                        sx={{ m: 0 }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, mt: -1 }}>
                    거래 날짜: {selectedTransaction.date} {selectedTransaction.createdAt ? selectedTransaction.createdAt.split(' ').slice(1).join(' ') || '' : ''}
                  </Typography>
                  
                  {editMode ? (
                    // 수정 모드: 상품 추가/삭제 가능 + 공통 메모/날짜 수정
                    <Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            variant="standard"
                            type="date"
                            label="거래 날짜"
                            value={editFormData.date || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={5}>
                          <TextField
                            fullWidth
                            size="small"
                            variant="standard"
                            label="공통 메모"
                            value={editFormData.note || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="해당 거래에 대한 공통 메모"
                          />
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editFormData.isConfirmed ?? true}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, isConfirmed: e.target.checked }))}
                                color="success"
                                size="small"
                              />
                            }
                            label={
                              <Typography variant="body2" fontWeight="bold" color={(editFormData.isConfirmed ?? true) ? 'success.main' : 'warning.main'}>
                                {(editFormData.isConfirmed ?? true) ? '확정 (재고반영)' : '미확정 (재고미반영)'}
                              </Typography>
                            }
                          />
                        </Grid>
                      </Grid>

                      {/* 출발지/목적지 일괄 적용 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1.5, backgroundColor: '#f0f4ff', borderRadius: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium', whiteSpace: 'nowrap' }}>출발지/목적지 일괄 적용:</Typography>
                        <Autocomplete
                          sx={{ width: 160 }}
                          size="small"
                          options={[
                            ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                            ...dealers.map(d => ({ ...d, type: 'dealer' }))
                          ]}
                          getOptionLabel={(option) => `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`}
                          value={(() => {
                            const w = warehouses.find(w => w.id === editBatchFromLocation);
                            if (w) return { ...w, type: 'warehouse' };
                            const d = dealers.find(d => d.id === editBatchFromLocation);
                            if (d) return { ...d, type: 'dealer' };
                            return null;
                          })()}
                          onChange={(event, value) => setEditBatchFromLocation(value?.id || '')}
                          isOptionEqualToValue={(option, value) => option?.id === value?.id}
                          renderInput={(params) => <TextField {...params} variant="standard" label="일괄 출발지" placeholder="출발지 선택" />}
                        />
                        <Autocomplete
                          sx={{ width: 160 }}
                          size="small"
                          options={[
                            ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                            ...dealers.map(d => ({ ...d, type: 'dealer' }))
                          ]}
                          getOptionLabel={(option) => `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`}
                          value={(() => {
                            const w = warehouses.find(w => w.id === editBatchToLocation);
                            if (w) return { ...w, type: 'warehouse' };
                            const d = dealers.find(d => d.id === editBatchToLocation);
                            if (d) return { ...d, type: 'dealer' };
                            return null;
                          })()}
                          onChange={(event, value) => setEditBatchToLocation(value?.id || '')}
                          isOptionEqualToValue={(option, value) => option?.id === value?.id}
                          renderInput={(params) => <TextField {...params} variant="standard" label="일괄 목적지" placeholder="목적지 선택" />}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleEditBatchApplyLocation}
                          disabled={!editBatchFromLocation && !editBatchToLocation}
                        >
                          전체 적용
                        </Button>
                      </Box>

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

                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableRow>
                              <TableCell sx={{ minWidth: 250, fontWeight: 'bold' }}>상품 선택 (필수)</TableCell>
                              <TableCell sx={{ width: 80, fontWeight: 'bold' }}>수량</TableCell>
                              <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>출발지</TableCell>
                              <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>목적지</TableCell>
                              <TableCell sx={{ minWidth: 130, fontWeight: 'bold' }}>메모</TableCell>
                              <TableCell sx={{ minWidth: 130, fontWeight: 'bold' }}>개별 메모</TableCell>
                              <TableCell sx={{ width: 50, fontWeight: 'bold' }}>삭제</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {editProducts.map((product, index) => (
                              <TableRow key={index}>
                                <TableCell sx={{ p: 1 }}>
                                  <Autocomplete
                                    size="small"
                                    options={products}
                                    getOptionLabel={(option) => option ? `${option.name} (${option.code})${option.barcode ? ` [${option.barcode}]` : ''}` : ''}
                                    value={product.product}
                                    onChange={(event, newValue) => updateEditProduct(index, 'product', newValue)}
                                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                    renderInput={(params) => (
                                      <TextField {...params} variant="standard" placeholder="상품명/코드/바코드 검색" />
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
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    type="number"
                                    size="small"
                                    value={product.quantity}
                                    onChange={(e) => updateEditProduct(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                                    inputProps={{ min: 1 }}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <Autocomplete
                                    size="small"
                                    options={[
                                      ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                                      ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                    ]}
                                    getOptionLabel={(option) => option ? `${option.name}` : ''}
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
                                      <TextField {...params} variant="standard" placeholder="출발지 선택" />
                                    )}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <Autocomplete
                                    size="small"
                                    options={[
                                      ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                                      ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                    ]}
                                    getOptionLabel={(option) => option ? `${option.name}` : ''}
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
                                      <TextField {...params} variant="standard" placeholder="목적지 선택" />
                                    )}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    size="small"
                                    value={product.note}
                                    onChange={(e) => updateEditProduct(index, 'note', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    size="small"
                                    value={product.additionalNote}
                                    onChange={(e) => updateEditProduct(index, 'additionalNote', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1, textAlign: 'center' }}>
                                  <IconButton
                                    color="error"
                                    onClick={() => removeEditProduct(index)}
                                    size="small"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          총 수량: {editProducts.reduce((sum, product) => sum + (parseInt(product.quantity, 10) || 0), 0)}개
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    // 읽기 모드: 표준 디자인 테이블 표시
                    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>상품명</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>브랜드</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>바코드</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>상품코드</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>수량</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>출발지</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>목적지</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {[...(showOriginalHistory && selectedTransaction.rawItems ? selectedTransaction.rawItems : selectedTransaction.items)]
                            .sort((a, b) => a.productName.localeCompare(b.productName))
                            .map((item, index) => {
                            const isReturn = item.note?.includes('취소') || item.note?.includes('환불') || item.fromLocation?.includes('취소');
                            return (
                            <TableRow key={index} hover sx={{ bgcolor: isReturn ? 'rgba(244, 67, 54, 0.05)' : 'inherit' }}>
                              <TableCell sx={{ color: isReturn ? 'text.secondary' : 'inherit' }}>{item.productName}</TableCell>
                              <TableCell>
                                {(() => {
                                  const p = products.find(prod => prod.id === item.productId || prod.code === item.productCode);
                                  const dbBrand = p ? p.supplier : null;
                                  const txBrand = item.productSupplier && item.productSupplier !== 'NEARBIKE' ? item.productSupplier : null;
                                  return dbBrand || txBrand || '-';
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const p = products.find(prod => prod.id === item.productId || prod.code === item.productCode);
                                  return p?.barcode || '-';
                                })()}
                              </TableCell>
                              <TableCell>{item.productCode || '-'}</TableCell>
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
                                {showOriginalHistory && <div style={{ fontSize: '0.75em', color: '#1976d2', marginTop: 4 }}>({item.type === 'in' ? '입고/취소' : '출고'})</div>}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  
                  {!editMode && (
                    <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        총 수량: {selectedTransaction.items.reduce((sum, item) => {
                          const quantity = parseInt(item.quantity, 10) || 0;
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
                            variant="standard"
                            type="date"
                            label="거래 날짜"
                            value={editFormData.date || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} md={5}>
                          <TextField
                            fullWidth
                            size="small"
                            variant="standard"
                            label="공통 메모"
                            value={editFormData.note || ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="해당 거래에 대한 공통 메모"
                          />
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'flex-end' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editFormData.isConfirmed ?? true}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, isConfirmed: e.target.checked }))}
                                color="success"
                                size="small"
                              />
                            }
                            label={
                              <Typography variant="body2" fontWeight="bold" color={(editFormData.isConfirmed ?? true) ? 'success.main' : 'warning.main'}>
                                {(editFormData.isConfirmed ?? true) ? '확정 (재고반영)' : '미확정 (재고미반영)'}
                              </Typography>
                            }
                          />
                        </Grid>
                      </Grid>

                      {/* 출발지/목적지 일괄 적용 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, p: 1.5, backgroundColor: '#f0f4ff', borderRadius: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium', whiteSpace: 'nowrap' }}>출발지/목적지 일괄 적용:</Typography>
                        <Autocomplete
                          sx={{ width: 160 }}
                          size="small"
                          options={[
                            ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                            ...dealers.map(d => ({ ...d, type: 'dealer' }))
                          ]}
                          getOptionLabel={(option) => `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`}
                          value={(() => {
                            const w = warehouses.find(w => w.id === editBatchFromLocation);
                            if (w) return { ...w, type: 'warehouse' };
                            const d = dealers.find(d => d.id === editBatchFromLocation);
                            if (d) return { ...d, type: 'dealer' };
                            return null;
                          })()}
                          onChange={(event, value) => setEditBatchFromLocation(value?.id || '')}
                          isOptionEqualToValue={(option, value) => option?.id === value?.id}
                          renderInput={(params) => <TextField {...params} variant="standard" label="일괄 출발지" placeholder="출발지 선택" />}
                        />
                        <Autocomplete
                          sx={{ width: 160 }}
                          size="small"
                          options={[
                            ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                            ...dealers.map(d => ({ ...d, type: 'dealer' }))
                          ]}
                          getOptionLabel={(option) => `${option.name} (${option.type === 'warehouse' ? '창고' : '대리점'})`}
                          value={(() => {
                            const w = warehouses.find(w => w.id === editBatchToLocation);
                            if (w) return { ...w, type: 'warehouse' };
                            const d = dealers.find(d => d.id === editBatchToLocation);
                            if (d) return { ...d, type: 'dealer' };
                            return null;
                          })()}
                          onChange={(event, value) => setEditBatchToLocation(value?.id || '')}
                          isOptionEqualToValue={(option, value) => option?.id === value?.id}
                          renderInput={(params) => <TextField {...params} variant="standard" label="일괄 목적지" placeholder="목적지 선택" />}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleEditBatchApplyLocation}
                          disabled={!editBatchFromLocation && !editBatchToLocation}
                        >
                          전체 적용
                        </Button>
                      </Box>

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

                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableRow>
                              <TableCell sx={{ minWidth: 250, fontWeight: 'bold' }}>상품 선택 (필수)</TableCell>
                              <TableCell sx={{ width: 80, fontWeight: 'bold' }}>수량</TableCell>
                              <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>출발지</TableCell>
                              <TableCell sx={{ minWidth: 150, fontWeight: 'bold' }}>목적지</TableCell>
                              <TableCell sx={{ minWidth: 130, fontWeight: 'bold' }}>메모</TableCell>
                              <TableCell sx={{ minWidth: 130, fontWeight: 'bold' }}>개별 메모</TableCell>
                              <TableCell sx={{ width: 50, fontWeight: 'bold' }}>삭제</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {editProducts.map((product, index) => (
                              <TableRow key={index}>
                                <TableCell sx={{ p: 1 }}>
                                  <Autocomplete
                                    size="small"
                                    options={products}
                                    getOptionLabel={(option) => option ? `${option.name} (${option.code})${option.barcode ? ` [${option.barcode}]` : ''}` : ''}
                                    value={product.product}
                                    onChange={(event, newValue) => updateEditProduct(index, 'product', newValue)}
                                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                    renderInput={(params) => (
                                      <TextField {...params} variant="standard" placeholder="상품명/코드/바코드 검색" />
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
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    type="number"
                                    size="small"
                                    value={product.quantity}
                                    onChange={(e) => updateEditProduct(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                                    inputProps={{ min: 1 }}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <Autocomplete
                                    size="small"
                                    options={[
                                      ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                                      ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                    ]}
                                    getOptionLabel={(option) => option ? `${option.name}` : ''}
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
                                      <TextField {...params} variant="standard" placeholder="출발지 선택" />
                                    )}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <Autocomplete
                                    size="small"
                                    options={[
                                      ...visibleWarehouses.map(w => ({ ...w, type: 'warehouse' })),
                                      ...dealers.map(d => ({ ...d, type: 'dealer' }))
                                    ]}
                                    getOptionLabel={(option) => option ? `${option.name}` : ''}
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
                                      <TextField {...params} variant="standard" placeholder="목적지 선택" />
                                    )}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    size="small"
                                    value={product.note}
                                    onChange={(e) => updateEditProduct(index, 'note', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1 }}>
                                  <TextField
                                    fullWidth
                                    variant="standard"
                                    size="small"
                                    value={product.additionalNote}
                                    onChange={(e) => updateEditProduct(index, 'additionalNote', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 1, textAlign: 'center' }}>
                                  <IconButton
                                    color="error"
                                    onClick={() => removeEditProduct(index)}
                                    size="small"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      
                      <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          총 수량: {editProducts.reduce((sum, product) => sum + (parseInt(product.quantity, 10) || 0), 0)}개
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
                                <Typography variant="body2" fontWeight="medium">{`TRX-${String(selectedTransaction.id).slice(0, 8).toUpperCase()}`}</Typography>
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
                                <Typography variant="body2" fontWeight="medium">{selectedTransaction.date} {selectedTransaction.createdAt ? selectedTransaction.createdAt.split(' ').slice(1).join(' ') || '' : ''}</Typography>
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
              <Button
                onClick={async () => {
                  if (!selectedTransaction) return;
                  try {
                    const wb = new ExcelJS.Workbook();
                    const ws = wb.addWorksheet('거래내역 상세');

                    const items = selectedTransaction.items || [selectedTransaction];
                    const typeLabel = getTransactionTypeInfo(selectedTransaction).label;
                    const txDate = selectedTransaction.date || '';

                    // 헤더 정보
                    ws.addRow(['거래내역 상세']);
                    ws.addRow(['유형', typeLabel, '날짜', txDate]);
                    ws.addRow([]);

                    // 테이블 헤더
                    const headerRow = ws.addRow(['상품명', '브랜드', '바코드', '상품코드', '수량', '출발지', '목적지', '메모']);
                    headerRow.eachCell(cell => {
                      cell.font = { bold: true };
                      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
                      cell.border = { bottom: { style: 'thin' } };
                    });

                    let totalQty = 0;
                    items.forEach(item => {
                      const p = products.find(prod => prod.id === item.productId || prod.code === item.productCode);
                      const brand = p?.supplier || item.productSupplier || '-';
                      const barcode = p?.barcode || '-';
                      const productCode = item.productCode || p?.code || '-';
                      const qty = Number(item.quantity || 0);
                      totalQty += qty;

                      const fromLoc = (() => {
                        const srcId = item.fromLocation;
                        if (!srcId || srcId === '외부') return '외부';
                        return warehouses.find(w => w.id === srcId)?.name || dealers.find(d => d.id === srcId)?.name || srcId;
                      })();
                      const toLoc = (() => {
                        const destId = item.toLocation;
                        return warehouses.find(w => w.id === destId)?.name || dealers.find(d => d.id === destId)?.name || destId || '-';
                      })();
                      const note = [item.note, item.additionalNote].filter(Boolean).join(' / ');

                      ws.addRow([item.productName || p?.name || '-', brand, barcode, productCode, qty, fromLoc, toLoc, note]);
                    });

                    // 합계행
                    ws.addRow([]);
                    ws.addRow(['', '', '', '합계', totalQty]);

                    // 열 너비
                    ws.columns = [
                      { width: 30 }, { width: 15 }, { width: 15 }, { width: 10 },
                      { width: 15 }, { width: 15 }, { width: 25 }
                    ];

                    const buffer = await wb.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `거래내역_${txDate}_${typeLabel}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showSnackbar('엑셀 다운로드 완료', 'success');
                  } catch (err) {
                    console.error('Excel download error:', err);
                    showSnackbar('엑셀 다운로드 중 오류가 발생했습니다.', 'error');
                  }
                }}
                variant="outlined"
                color="success"
                startIcon={<DownloadIcon />}
                size="small"
              >
                엑셀 다운로드
              </Button>
              <Button onClick={closeTransactionDetail} disabled={detailProcessing}>닫기</Button>
              <Button 
                disabled={detailProcessing}
                onClick={async () => {
                  if (!selectedTransaction) return;
                  if (!window.confirm('이 거래내역을 삭제하시겠습니까? 재고가 자동으로 재계산됩니다.')) return;
                  setDetailProcessing(true);
                  try {
                    const items = selectedTransaction.items || [selectedTransaction];
                    for (const item of items) {
                      await deleteTransaction(item.id);
                    }
                    closeTransactionDetail();
                    showSnackbar('거래내역이 삭제되었습니다.', 'success');
                  } finally {
                    setDetailProcessing(false);
                  }
                }} 
                variant="outlined" 
                color="error"
              >
                {detailProcessing ? '처리 중...' : '삭제'}
              </Button>
              <Button onClick={startEditTransaction} variant="outlined" color="primary" disabled={detailProcessing}>
                수정
              </Button>
            </>
          ) : (
            <>
              <Button onClick={cancelEditTransaction} disabled={detailProcessing}>취소</Button>
              <Button 
                disabled={detailProcessing}
                onClick={async () => {
                  setDetailProcessing(true);
                  try {
                    await saveEditTransaction();
                  } finally {
                    setDetailProcessing(false);
                  }
                }} 
                variant="contained" 
                color="primary"
              >
                {detailProcessing ? '처리 중...' : '저장'}
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
                엑셀 템플릿 다운로드
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
                {/* 
                <Button
                  variant="outlined"
                  onClick={downloadNearbikeTemplate}
                  startIcon={<DownloadIcon />}
                >
                  다중 파츠 템플릿 양식
                </Button>
                */}
              </Box>
            </Box>

            {/* 파일 업로드 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                엑셀 파일 업로드
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
                  업로드된 데이터 미리보기 ({excelData.length}개 상품)
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table stickyHeader size="small" sx={{ borderTop: '1px solid rgba(224, 224, 224, 1)', borderLeft: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { borderRight: '1px solid rgba(224, 224, 224, 1)', borderBottom: '1px solid rgba(224, 224, 224, 1)' } }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell>상태</TableCell>
                        <TableCell>상품코드</TableCell>
                        <TableCell>상품명</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell>출발지</TableCell>
                        <TableCell>목적지</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {excelData.slice(0, 10).map((item, index) => (
                        <TableRow key={index} sx={{ bgcolor: item.error ? 'rgba(211, 47, 47, 0.08)' : 'inherit' }}>
                          <TableCell>
                            {item.error ? (
                              <Typography color="error" variant="caption" sx={{ fontWeight: 'bold' }}>
                                ⚠️ {item.error}
                              </Typography>
                            ) : (
                              <Typography color="success.main" variant="caption" sx={{ fontWeight: 'bold' }}>
                                ✅ 정상
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{item.productCode}</TableCell>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell>{item.fromLocation}</TableCell>
                          <TableCell>{item.toLocation}</TableCell>
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
                
                {/* 에러 요약본 (하단에 상세 안내) */}
                {excelData.filter(d => d.error).length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: '#fff4f4', borderRadius: 1, border: '1px solid #ffcdd2' }}>
                    <Typography variant="subtitle2" color="error" sx={{ mb: 1, fontWeight: 'bold' }}>
                      ⚠️ 다음 {excelData.filter(d => d.error).length}건은 업로드 시 무시됩니다:
                    </Typography>
                    <Box sx={{ maxHeight: 100, overflowY: 'auto' }}>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#d32f2f' }}>
                        {excelData.filter(d => d.error).map((errItem, idx) => (
                          <li key={idx}>
                            {errItem.productName || errItem.productCode || '이름없음'} - {errItem.error}
                          </li>
                        ))}
                      </ul>
                    </Box>
                  </Box>
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
            disabled={excelData.filter(d => !d.error).length === 0}
          >
            입출고 처리 ({excelData.filter(d => !d.error).length}개 상품 정상)
          </Button>
        </DialogActions>
      </Dialog>

      {/* 창고/매장 상세 모달 */}
      {warehouseDetailOpen && warehouseDetailTarget && (
        <LocationManagement
          open={warehouseDetailOpen}
          onClose={closeWarehouseDetail}
          locationId={warehouseDetailTarget.id}
          locationName={warehouseDetailTarget.name}
          locationType={warehouseDetailTarget.type}
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

      {/* 재고 검증 결과 Dialog */}
      <Dialog open={verifyOpen || false} onClose={() => setVerifyOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          재고 검증 결과
          <IconButton onClick={() => setVerifyOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {verifyResults && (
            <>
              <Box sx={{ mb: 2 }}>
                {verifyResults.length === 0 ? (
                  <Alert severity="success">모든 창고 재고가 트랜잭션 기록과 일치합니다. ✓</Alert>
                ) : (
                  <Alert severity="warning">
                    불일치 {verifyResults.length}건 발견 — 트랜잭션 합산값과 DB 실제값이 다릅니다.
                  </Alert>
                )}
              </Box>
              {verifyResults.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell>창고</TableCell>
                        <TableCell>제품</TableCell>
                        <TableCell align="right">트랜잭션 합산</TableCell>
                        <TableCell align="right">DB 실제값</TableCell>
                        <TableCell align="right">차이</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {verifyResults.map((r, i) => (
                        <TableRow key={i} sx={{ bgcolor: Math.abs(r.diff) >= 10 ? 'error.50' : 'warning.50' }}>
                          <TableCell>{r.whName}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{r.productName}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.productCode}</Typography>
                          </TableCell>
                          <TableCell align="right">{r.expectedQty}</TableCell>
                          <TableCell align="right">{r.actualQty}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: r.diff > 0 ? 'success.main' : 'error.main' }}>
                            {r.diff > 0 ? '+' : ''}{r.diff}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}


