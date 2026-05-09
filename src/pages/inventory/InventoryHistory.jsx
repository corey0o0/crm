import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination, TablePagination, TableFooter, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon, Remove as RemoveIcon, Add as AddIcon, Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';

export default function InventoryHistory() {
  const context = useOutletContext();
  const {
    filter, setFilter, dateFilter, setDateFilter, handleDateFilterClick, transactionViewMode, setTransactionViewMode,
    selectedTransactions, setSelectedTransactions, handleDeleteSelectedTransactions,
    filteredTransactions, itemsPerPage, setItemsPerPage, setCurrentPage, pendingInventory, paginatedTransactions, getTransactionTypeInfo, products, formatLocationName, warehouses, dealers,
    openTransactionDetail, handleTableCellHover, handleTableCellHoverLeave, handleTableCellClick,
    hoverAnchorEl, hoverTransactions, dateKeys, ioByWarehouseProductDate, totalPages, currentPage,
    handlePageChange, showSnackbar, tableModalOpen, setTableModalOpen, selectedTableTransactions,
    transactions, inventory, fetchProducts, fetchTransactions, recalculateInventoryFromTransactions,
    handleCloseDialog, openDialog, dialogType, formData, setFormData, editMode, editFormData, setEditFormData,
    editProducts, setEditProducts, saveEditTransaction, cancelEditTransaction, addEditProduct, removeEditProduct,
    updateEditProduct, handleDeleteTransaction, handleViewOriginal, multipleIoProducts, setMultipleIoProducts,
    handleMultipleSubmit, addIoProductRow, removeIoProductRow, updateIoProductRow, excelUploadOpen,
    handleCloseExcelUpload, handleExcelFileUpload, excelFile, excelUploadType, setExcelUploadType,
    handleExcelUploadSubmit, handleOpenExcelUpload, transactionDetailOpen, closeTransactionDetail,
    selectedTransaction, startEditTransaction
  } = context;

  return (

        <Box>
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
                      <MenuItem value="adjustment">재고 조정</MenuItem>
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
                    label="메모 검색"
                    value={filter.note}
                    onChange={(e) => setFilter(prev => ({ ...prev, note: e.target.value }))}
                    sx={{ width: 150 }}
                  />
                  
                  <Button variant="contained" onClick={() => showSnackbar('필터가 적용되었습니다.', 'success')} sx={{ bgcolor: '#3182f6' }}>검색</Button>
                  <Button variant="outlined" onClick={() => {
                    setFilter({
                      dateFrom: '', dateTo: '', fromLocation: '', toLocation: '', product: '', note: '', type: 'all', sortBy: 'date', sortOrder: 'desc'
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
            <Box sx={{ display: 'inline-flex', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Button size="small" variant={transactionViewMode === 'list' ? 'contained' : 'text'} onClick={() => setTransactionViewMode('list')}>리스트 보기</Button>
              <Button size="small" variant={transactionViewMode === 'table' ? 'contained' : 'text'} onClick={() => setTransactionViewMode('table')}>표 보기</Button>
            </Box>
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
        </Box>

  );
}
