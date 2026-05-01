import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, Stack, TextField, Grid, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Chip, Snackbar, Alert, TablePagination } from '@mui/material';
import { Search as SearchIcon, FileDownload as FileDownloadIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export default function TaxInvoiceManagement() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [agencies, setAgencies] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    type: 'order_date',
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => {
    async function loadAgencies() {
      const { data, error } = await supabase.from('agencies').select('*');
      if (data) {
        const agMap = {};
        data.forEach(ag => {
          agMap[ag.name] = ag;
        });
        setAgencies(agMap);
      }
    }
    loadAgencies();
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [page, rowsPerPage, searchTrigger]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      let query = supabase.from('shipments').select('*, shipment_parts(*)', { count: 'exact' });
      
      // B2B 수기 및 일반출고 (세금계산서 대상)
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      } else {
        // 기본적으로 완료된 건 위주로 표시
        // query = query.in('status', ['출고완료', '완료']);
      }

      if (dateFilter.startDate) {
        query = query.gte(dateFilter.type, `${dateFilter.startDate}T00:00:00+09:00`);
      }
      if (dateFilter.endDate) {
        query = query.lte(dateFilter.type, `${dateFilter.endDate}T23:59:59+09:00`);
      }

      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,sales_channel.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%`);
      }

      query = query.order('order_date', { ascending: false })
                   .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      
      setShipments(data || []);
      setSelectedItems([]);
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
      if (page !== 0) setPage(0);
      else setSearchTrigger(prev => prev + 1);
    }
  };

  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let start = ''; let end = '';

    switch (period) {
      case 'today':
        start = end = format(today, 'yyyy-MM-dd');
        break;
      case 'thisMonth':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(today), 1);
        start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      default:
        break;
    }
    setDateFilter(prev => ({ ...prev, startDate: start, endDate: end }));
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = shipments.map((n) => n.id);
      setSelectedItems(newSelecteds);
      return;
    }
    setSelectedItems([]);
  };

  const handleClick = (event, id) => {
    const selectedIndex = selectedItems.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedItems, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedItems.slice(1));
    } else if (selectedIndex === selectedItems.length - 1) {
      newSelected = newSelected.concat(selectedItems.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedItems.slice(0, selectedIndex),
        selectedItems.slice(selectedIndex + 1),
      );
    }
    setSelectedItems(newSelected);
  };

  const handleExportHometaxExcel = async () => {
    if (selectedItems.length === 0) {
      setSnackbar({ open: true, message: '발행할 내역을 선택해주세요.', severity: 'warning' });
      return;
    }

    try {
      const selectedData = shipments.filter(s => selectedItems.includes(s.id));
      
      const { downloadExcel } = await import('../../utils/excelUtils');
      
      const headers = [
        { key: 'seq', label: '건별번호' },
        { key: 'buyer_biz_no', label: '공급받는자 사업자등록번호' },
        { key: 'buyer_sub_no', label: '공급받는자 종사업장번호' },
        { key: 'buyer_name', label: '공급받는자 상호' },
        { key: 'buyer_ceo', label: '공급받는자 성명' },
        { key: 'buyer_addr', label: '공급받는자 사업장주소' },
        { key: 'buyer_biz_type', label: '공급받는자 업태' },
        { key: 'buyer_biz_cat', label: '공급받는자 종목' },
        { key: 'buyer_email1', label: '공급받는자 이메일1' },
        { key: 'buyer_email2', label: '공급받는자 이메일2' },
        { key: 'issue_date', label: '작성일자' },
        { key: 'supply_price', label: '공급가액' },
        { key: 'vat', label: '세액' },
        { key: 'note', label: '비고' },
        { key: 'item_day', label: '일자1' },
        { key: 'item_name', label: '품목1' },
        { key: 'item_spec', label: '규격1' },
        { key: 'item_qty', label: '수량1' },
        { key: 'item_price', label: '단가1' },
        { key: 'item_supply', label: '공급가액1' },
        { key: 'item_vat', label: '세액1' },
        { key: 'item_note', label: '품목비고1' }
      ];

      const excelData = selectedData.map((s, index) => {
        const partCount = s.shipment_parts?.length || 0;
        const repPart = s.shipment_parts?.[0]?.part_name || '부품 및 서비스';
        const productName = partCount > 1 ? `${repPart} 외 ${partCount - 1}건` : repPart;
        
        const total = Number(s.price || 0);
        // 부가세 포함 금액에서 공급가액 및 세액 역산
        const supplyPrice = Math.round(total / 1.1);
        const vat = total - supplyPrice;

        const agency = agencies[s.customer_name] || {};

        return {
          seq: index + 1,
          buyer_biz_no: agency.business_number ? agency.business_number.replace(/-/g, '') : '',
          buyer_sub_no: '',
          buyer_name: agency.name || s.customer_name,
          buyer_ceo: agency.ceo_name || '',
          buyer_addr: agency.address || '',
          buyer_biz_type: agency.business_type || '',
          buyer_biz_cat: agency.business_category || '',
          buyer_email1: agency.email || '',
          buyer_email2: '',
          issue_date: dayjs(s.order_date).format('YYYYMMDD'), // 홈택스는 YYYYMMDD 형식 선호
          supply_price: supplyPrice,
          vat: vat,
          note: s.note || '',
          item_day: dayjs(s.order_date).format('DD'),
          item_name: productName,
          item_spec: '',
          item_qty: 1,
          item_price: supplyPrice,
          item_supply: supplyPrice,
          item_vat: vat,
          item_note: ''
        };
      });

      await downloadExcel(excelData, headers, `홈택스_일괄발행_양식_${dayjs().format('YYYYMMDD')}`);
      setSnackbar({ open: true, message: '홈택스 일괄발행용 엑셀이 다운로드 되었습니다.', severity: 'success' });
    } catch (err) {
      console.error(err);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <Box p={3} sx={{ maxWidth: 1600, margin: '0 auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon fontSize="large" color="primary" /> 전자세금계산서 발행 (홈택스)
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md="auto">
            <FormControl size="small" sx={{ width: 130 }}>
              <InputLabel>상태</InputLabel>
              <Select value={statusFilter} label="상태" onChange={e => setStatusFilter(e.target.value)}>
                <MenuItem value="all">전체 상태</MenuItem>
                <MenuItem value="출고대기">출고대기</MenuItem>
                <MenuItem value="출고완료">출고완료</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5 }}>
              <FormControl size="small" sx={{ width: 120, flexShrink: 0 }}>
                <InputLabel>기준 날짜</InputLabel>
                <Select value={dateFilter.type} label="기준 날짜" onChange={(e) => handleDateFilterChange('type', e.target.value)}>
                  <MenuItem value="order_date">주문/작성일자</MenuItem>
                </Select>
              </FormControl>

              <ButtonGroup size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => handleDateFilterChange('startDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 140 } } }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => handleDateFilterChange('endDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 140 } } }}
                  />
                </Box>
              </LocalizationProvider>
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="고객명/거래처 검색"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyPress={executeSearch}
                sx={{ flexGrow: 1, maxWidth: 500 }}
              />
              <Button variant="contained" onClick={executeSearch} sx={{ bgcolor: '#3182f6' }}>검색</Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button 
                variant="contained" 
                color="success" 
                startIcon={<FileDownloadIcon />} 
                onClick={handleExportHometaxExcel}
                sx={{ fontWeight: 'bold' }}
              >
                {selectedItems.length > 0 ? `홈택스 일괄발행 엑셀 다운로드 (${selectedItems.length}건)` : '홈택스 일괄발행 엑셀 다운로드'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 800, border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={selectedItems.length > 0 && selectedItems.length < shipments.length}
                  checked={shipments.length > 0 && selectedItems.length === shipments.length}
                  onChange={handleSelectAllClick}
                />
              </TableCell>
              <TableCell width="12%">작성일자</TableCell>
              <TableCell width="20%">공급받는자 (거래처)</TableCell>
              <TableCell width="15%">사업자번호</TableCell>
              <TableCell width="20%">대표 품목</TableCell>
              <TableCell width="12%" align="right">공급가액</TableCell>
              <TableCell width="10%" align="right">세액 (VAT)</TableCell>
              <TableCell width="11%" align="center">총 합계액</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center">로딩 중...</TableCell></TableRow>
            ) : shipments.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center">조회된 판매 내역이 없습니다.</TableCell></TableRow>
            ) : shipments.map(s => {
              const isItemSelected = selectedItems.indexOf(s.id) !== -1;
              const partCount = s.shipment_parts?.length || 0;
              const repPart = s.shipment_parts?.[0]?.part_name || '-';
              
              const total = Number(s.price || 0);
              const supplyPrice = Math.round(total / 1.1);
              const vat = total - supplyPrice;

              const agency = agencies[s.customer_name];
              const hasBizNo = agency && agency.business_number;

              return (
                <TableRow 
                  key={s.id}
                  hover
                  selected={isItemSelected}
                  sx={{ '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' } }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      checked={isItemSelected}
                      onChange={(event) => handleClick(event, s.id)}
                    />
                  </TableCell>
                  <TableCell>{dayjs(s.order_date).format('YYYY-MM-DD')}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{s.customer_name}</Typography>
                    {!hasBizNo && <Typography variant="caption" color="error">사업자정보 없음</Typography>}
                  </TableCell>
                  <TableCell>
                    {hasBizNo ? agency.business_number : <Chip label="미등록" size="small" color="warning" variant="outlined" />}
                  </TableCell>
                  <TableCell>{partCount > 1 ? `${repPart} 외 ${partCount - 1}건` : repPart}</TableCell>
                  <TableCell align="right">{supplyPrice.toLocaleString()}원</TableCell>
                  <TableCell align="right">{vat.toLocaleString()}원</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{total.toLocaleString()}원</TableCell>
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
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
