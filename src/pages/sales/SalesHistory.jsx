import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, TextField,
  Select, MenuItem, FormControl, InputLabel, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, TablePagination
} from '@mui/material';
import { Delete as DeleteIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ customer_name: '', sales_channel: '', price: 0, note: '' });
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    let shipQuery = supabase
      .from('shipments')
      .select(`
        id, order_date, customer_name, price, sales_channel, status, note,
        shipment_parts ( part_name, quantity, price, total_price )
      `)
      .in('status', ['출고완료', '완료'])
      .order('order_date', { ascending: false })
      .limit(500);

    if (startDate) shipQuery = shipQuery.gte('order_date', format(startDate, 'yyyy-MM-dd'));
    if (endDate) shipQuery = shipQuery.lte('order_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

    let asQuery = supabase
      .from('services')
      .select(`
        id, reception_date, completion_date, customer_name, total_cost, status, note,
        service_parts ( quantity, parts(name) ),
        agencies(name)
      `)
      .in('status', ['완료', '수령대기', '결제대기', '수령완료', '출고완료'])
      .order('completion_date', { ascending: false })
      .limit(500);

    // services uses completion_date as the primary date for 'sales'
    if (startDate) asQuery = asQuery.gte('completion_date', format(startDate, 'yyyy-MM-dd'));
    if (endDate) asQuery = asQuery.lte('completion_date', format(endDate, 'yyyy-MM-dd') + 'T23:59:59');

    const [shipRes, asRes] = await Promise.all([shipQuery, asQuery]);

    if (shipRes.error) console.error('Ship fetch error:', shipRes.error);
    if (asRes.error && asRes.error.code !== 'PGRST200') console.error('A/S fetch error:', asRes.error);

    const mappedShipments = (shipRes.data || []).map(s => ({
      _type: 'shipment',
      id: s.id,
      date_val: s.order_date || Date.now(),
      customer_name: s.customer_name,
      price: s.price,
      sales_channel: s.sales_channel,
      status: s.status,
      note: s.note,
      parts_list: s.shipment_parts?.map(p => ({ name: p.part_name, quantity: p.quantity })) || []
    }));

    const mappedAs = (asRes.data || []).map(s => ({
      _type: 'service',
      id: s.id,
      date_val: s.completion_date || s.reception_date || Date.now(),
      customer_name: s.customer_name,
      price: s.total_cost || 0,
      sales_channel: (s.agencies && s.agencies.name) ? s.agencies.name : 'A/S센터',
      status: s.status,
      note: s.note ? `[A/S] ${s.note}` : '[A/S건]',
      parts_list: s.service_parts?.map(p => ({ name: p.parts?.name || '알 수 없음', quantity: p.quantity })) || []
    }));

    const combined = [...mappedShipments, ...mappedAs].sort((a, b) => new Date(b.date_val) - new Date(a.date_val));
    setSales(combined);
    setLoading(false);
  };

  const filteredSales = sales.filter(s =>
    (s.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.sales_channel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.note || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = filteredSales.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
  const totalItems = filteredSales.reduce((acc, curr) => acc + (curr.parts_list?.length || 0), 0);
  
  const paginatedSales = filteredSales.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleDeleteClick = (sale) => {
    setSelectedSale(sale);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSale) return;
    try {
      if (selectedSale._type === 'shipment') {
        await supabase.from('shipments').delete().eq('id', selectedSale.id);
      } else {
        await supabase.from('services').delete().eq('id', selectedSale.id);
      }
      fetchSales();
      setDeleteDialog(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRowClick = (sale) => {
    setSelectedSale(sale);
    setEditForm({
      customer_name: sale.customer_name || '',
      sales_channel: sale.sales_channel || '',
      price: sale.price || 0,
      note: sale.note || ''
    });
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    try {
      const tableName = selectedSale._type === 'shipment' ? 'shipments' : 'services';
      const payload = selectedSale._type === 'shipment' 
        ? {
            customer_name: editForm.customer_name,
            sales_channel: editForm.sales_channel,
            price: Number(editForm.price),
            note: editForm.note
          }
        : {
            customer_name: editForm.customer_name,
            total_cost: Number(editForm.price),
            note: editForm.note
          };

      const { error } = await supabase.from(tableName).update(payload).eq('id', selectedSale.id);

      if (error) throw error;

      setEditDialog(false);
      fetchSales(); // Refresh
    } catch (err) {
      console.error(err);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">판매 현황 (집계 내역)</Typography>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6}>
           <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#e3f2fd' }}>
             <AssessmentIcon color="primary" fontSize="large" />
             <Box>
               <Typography variant="body2" color="textSecondary">조회된 총 판매액</Typography>
               <Typography variant="h4" fontWeight="bold">{totalRevenue.toLocaleString()}원</Typography>
             </Box>
           </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
           <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f3e5f5' }}>
             <AssessmentIcon color="secondary" fontSize="large" />
             <Box>
               <Typography variant="body2" color="textSecondary">조회된 판매 건수 (품목 종류 수)</Typography>
               <Typography variant="h4" fontWeight="bold">{totalItems.toLocaleString()}건</Typography>
             </Box>
           </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField 
            label="고객/경로/메모 검색" 
            variant="outlined" 
            size="small" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 250 }}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DatePicker
              label="시작일"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
            />
            <Typography>~</Typography>
            <DatePicker
              label="종료일"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
            />
          </LocalizationProvider>
          <Button variant="contained" onClick={fetchSales}>검색/새로고침</Button>
          <Button variant="outlined" color="secondary" onClick={() => { setStartDate(null); setEndDate(null); setSearchTerm(''); }}>초기화</Button>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>판매 일자</TableCell>
              <TableCell>구분 (A/S건/매장출고)</TableCell>
              <TableCell>판매처</TableCell>
              <TableCell>창고</TableCell>
              <TableCell>고객명</TableCell>
              <TableCell>상품명</TableCell>
              <TableCell align="right">금액</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>로딩 중...</TableCell></TableRow>
            ) : paginatedSales.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>조회된 판매 내역이 없습니다.</TableCell></TableRow>
            ) : (
              paginatedSales.map((sale) => (
                <TableRow key={sale.id + sale._type} hover onClick={() => handleRowClick(sale)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{format(new Date(sale.date_val), 'yyyy-MM-dd')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sale._type === 'service' || sale.note?.includes('A/S') ? 'A/S건' : '매장출고'} color={sale._type === 'service' || sale.note?.includes('A/S') ? 'warning' : 'primary'} variant="outlined" />
                  </TableCell>
                  <TableCell>{sale.sales_channel || '공홈/기타'}</TableCell>
                  <TableCell>
                    {sale.note && sale.note.match(/창고명:\s*([^,\n]+)/) ? sale.note.match(/창고명:\s*([^,\n]+)/)[1] : '-'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{sale.customer_name}</TableCell>
                  <TableCell>
                    {sale.parts_list?.map((part, idx) => (
                      <Typography key={idx} variant="body2" color="textSecondary">
                        • {part.name} x {part.quantity}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {Number(sale.price).toLocaleString()}원
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" color="error" onClick={() => handleDeleteClick(sale)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredSales.length}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        labelRowsPerPage="페이지당 행:"
      />

      {/* 삭제 경고 팝업 */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>판매 내역 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography color="error">
            해당 판매 내역을 삭제하시겠습니까? 삭제된 내역은 복구할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>삭제하기</Button>
        </DialogActions>
      </Dialog>

      {/* 기본 정보 수정 모달 */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>판매 정보 수정</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField label="고객명(누구에게)" value={editForm.customer_name} onChange={(e) => setEditForm({...editForm, customer_name: e.target.value})} fullWidth />
            <TextField label="판매처(어디서)" value={editForm.sales_channel} onChange={(e) => setEditForm({...editForm, sales_channel: e.target.value})} fullWidth />
            <TextField label="금액" type="number" value={editForm.price} onChange={(e) => setEditForm({...editForm, price: e.target.value})} fullWidth />
            <TextField label="메모(어떻게/창고명 등)" value={editForm.note} onChange={(e) => setEditForm({...editForm, note: e.target.value})} fullWidth multiline rows={2} />
            <Button variant="outlined" color="primary" onClick={() => navigate(selectedSale?._type === 'service' ? `/services/${selectedSale.id}` : `/shipment/${selectedSale?.id}`)} sx={{ mt: 1 }}>
              품목(재고) 수정 및 반품은 여기를 클릭하세요. ➔
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>취소</Button>
          <Button color="primary" variant="contained" onClick={handleEditSave}>기본 정보 저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SalesHistory;
