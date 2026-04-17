import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, TextField, Stack, TablePagination } from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Edit as EditIcon, CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

export default function ManualSalesList() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);

  // B2B 수기판매 전표 식별 조건: '과거 이카운트 이관'이거나 메모/채널에 'B2B수기판매' 등 포함
  useEffect(() => {
    async function loadWarehouses() {
      const { data } = await supabase.from('warehouses').select('id, name');
      if (data) setWarehouses(data);
    }
    loadWarehouses();
  }, []);

  useEffect(() => {
    fetchManualSales();
  }, [page, rowsPerPage]);

  const fetchManualSales = async () => {
    setLoading(true);
    try {
      let query = supabase.from('shipments').select('*, shipment_parts(*)', { count: 'exact' });
      
      // B2B & 과거 매출 판별 (기존 이카운트 데이터 + 대리점 매핑 데이터 + 신규 B2B태그)
      let condition = `sales_channel.eq.과거 이카운트 이관,note.ilike.%[B2B수기판매]%,note.ilike.%[과거 이카운트 이관]%,note.ilike.%[엑셀일괄등록]%`;
      query = query.or(condition);

      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,sales_channel.ilike.%${searchTerm}%`);
      }

      query = query.order('order_date', { ascending: false })
                   .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      
      setShipments(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '데이터 불러오기 실패: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = (e) => {
    if ((e.key && e.key === 'Enter') || !e.key) {
      setPage(0);
      fetchManualSales();
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      // 1. Transaction(수불부) 연동 삭제
      await supabase.from('transactions').delete().eq('group_id', targetToDelete.id);
      
      // 2. 부품 내역 삭제
      await supabase.from('shipment_parts').delete().eq('shipment_id', targetToDelete.id);
      
      // 3. 전표(Shipment) 본체 삭제
      const { error } = await supabase.from('shipments').delete().eq('id', targetToDelete.id);
      if (error) throw error;
      
      setSnackbar({ open: true, message: '안전하게 삭제되었으며 재고 및 통계에 반영되었습니다.', severity: 'success' });
      fetchManualSales();
    } catch (err) {
      setSnackbar({ open: true, message: '삭제 실패: ' + err.message, severity: 'error' });
    } finally {
      setDeleteDialog(false);
      setTargetToDelete(null);
    }
  };

  return (
    <Box p={3} sx={{ maxWidth: 1200, margin: '0 auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">수기 판매 관리 (대리점/B2B)</Typography>
        <Stack direction="row" spacing={2}>
           <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => navigate('/settings/ecount-uploader')}>
            이카운트 엑셀 일괄등록
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/sales/manual/new')}>
            새 수기 판매 등록
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          label="대리점명 또는 거래처명 검색"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyPress={executeSearch}
          sx={{ width: 300 }}
        />
        <Button variant="outlined" onClick={executeSearch}>검색</Button>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>주문/출고일자</TableCell>
              <TableCell>거래처(요청채널)</TableCell>
              <TableCell>출고처(창고)</TableCell>
              <TableCell>대표 품목</TableCell>
              <TableCell align="right">금액</TableCell>
              <TableCell align="center">상태</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center">로딩 중...</TableCell></TableRow>
            ) : shipments.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">등록된 수기 판매 내역이 없습니다.</TableCell></TableRow>
            ) : shipments.map(s => {
              const partCount = s.shipment_parts?.length || 0;
              const repPart = s.shipment_parts?.[0]?.part_name || '-';
              
              return (
                <TableRow key={s.id}>
                  <TableCell>{dayjs(s.order_date).format('YYYY-MM-DD')}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{s.customer_name}</Typography>
                    {s.sales_channel && <Typography variant="caption" color="text.secondary">{s.sales_channel}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {s.warehouse_id ? (warehouses.find(w => w.id === s.warehouse_id)?.name || '알 수 없는 창고') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{partCount > 1 ? `${repPart} 외 ${partCount - 1}건` : repPart}</TableCell>
                  <TableCell align="right">{Number(s.price || 0).toLocaleString()}원</TableCell>
                  <TableCell align="center"><Chip label={s.status} size="small" color={s.status === '출고완료' ? 'success' : 'default'} /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => navigate(`/sales/manual/edit/${s.id}`)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { setTargetToDelete(s); setDeleteDialog(true); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </TableContainer>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>수기 판매 전표 삭제</DialogTitle>
        <DialogContent>정말로 삭제하시겠습니까? 삭제 즉시 통계 매상에서 빠지며, 출고되어 차감되었던 장부 재고가 원래대로 복구됩니다.</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">삭제 및 재고 복구</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}