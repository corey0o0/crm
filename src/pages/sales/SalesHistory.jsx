import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Chip, TextField,
  Select, MenuItem, FormControl, InputLabel, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid
} from '@mui/material';
import { Delete as DeleteIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';

function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [datePeriod, setDatePeriod] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    fetchSales();
  }, [datePeriod]);

  const fetchSales = async () => {
    setLoading(true);
    let query = supabase
      .from('shipments')
      .select(`
        id, order_date, customer_name, price, sales_channel, status,
        shipment_parts (
          part_name, quantity, price, total_price
        )
      `)
      .order('order_date', { ascending: false });

    // Date filtering can be expanded here based on `datePeriod`
    // Defaulting to 150 items for status viewing
    query = query.limit(150);

    const { data, error } = await query;
    if (error) console.error(error);
    else {
      // Filter out pure internal moves if necessary, keeping actual 'Sales'
      const onlySales = (data || []).filter(item => item.status === '출고완료' || item.status === '완료');
      setSales(onlySales);
    }
    setLoading(false);
  };

  const filteredSales = sales.filter(s =>
    (s.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = filteredSales.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
  const totalItems = filteredSales.reduce((acc, curr) => acc + (curr.shipment_parts?.length || 0), 0);

  const handleDeleteClick = (sale) => {
    setSelectedSale(sale);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSale) return;
    try {
      // Delete shipment (this cascades to shipment_parts if set, but we also should reverse transactions if needed)
      // Because this is a CRM and user asked for simple delete, we mimic ShipmentList.jsx's delete behavior
      await supabase.from('shipments').delete().eq('id', selectedSale.id);
      fetchSales();
      setDeleteDialog(false);
    } catch (err) {
      console.error(err);
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
        <Box display="flex" gap={2}>
          <TextField 
            label="고객명/주문번호 검색" 
            variant="outlined" 
            size="small" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 300 }}
          />
          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>기간 설정</InputLabel>
            <Select value={datePeriod} onChange={(e) => setDatePeriod(e.target.value)} label="기간 설정">
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="month">최근 1개월</MenuItem>
              <MenuItem value="week">최근 1주일</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={fetchSales}>검색/새로고침</Button>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>주문 번호</TableCell>
              <TableCell>판매 일자</TableCell>
              <TableCell>구매자/거래처</TableCell>
              <TableCell>경로(분류)</TableCell>
              <TableCell>판매 품목 리스트</TableCell>
              <TableCell align="right">총 결제액</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>로딩 중...</TableCell></TableRow>
            ) : filteredSales.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>조회된 판매 내역이 없습니다.</TableCell></TableRow>
            ) : (
              filteredSales.map((sale) => (
                <TableRow key={sale.id} hover>
                  <TableCell>{sale.id}</TableCell>
                  <TableCell>{format(new Date(sale.order_date || Date.now()), 'yyyy-MM-dd')}</TableCell>
                  <TableCell>{sale.customer_name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={sale.sales_channel || '공홈/기타'} color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {sale.shipment_parts?.map((part, idx) => (
                      <Typography key={idx} variant="body2" color="textSecondary">
                        • {part.part_name} x {part.quantity}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {Number(sale.price).toLocaleString()}원
                  </TableCell>
                  <TableCell align="center">
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
    </Box>
  );
}

export default SalesHistory;
