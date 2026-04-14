import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  Box, Typography, Button, Paper, Tabs, Tab, Container,
  Grid, TextField, CircularProgress, Snackbar, Alert,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Select, MenuItem, FormControl, InputLabel, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete
import { Delete as DeleteIcon, CloudUpload as CloudUploadIcon, Add as AddIcon } from '@mui/icons-material';
import { readExcelFile } from '../../utils/excelUtils';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

function SalesEntry() {
  const [tabIndex, setTabIndex] = useState(0);
  const [agencies, setAgencies] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [{ data: agData }, { data: pData }] = await Promise.all([
        supabase.from('agencies').select('*'),
        supabase.from('parts').select('id, name, code, barcode, category, supplier, price')
      ]);
      if (agData) setAgencies(agData);
      if (pData) setParts(pData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (e, newIndex) => setTabIndex(newIndex);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>수기 판매 등록</Typography>
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tabIndex} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
          <Tab label="단건 빠른 등록" />
          <Tab label="엑셀 대량 업로드 (과거 자료)" />
        </Tabs>
      </Paper>
      
      {loading ? (
        <Box display="flex" justifyContent="center" m={5}><CircularProgress /></Box>
      ) : (
        <>
          {tabIndex === 0 && <SingleEntryForm agencies={agencies} parts={parts} setSnackbar={setSnackbar} />}
          {tabIndex === 1 && <ExcelBatchUpload agencies={agencies} parts={parts} setSnackbar={setSnackbar} />}
        </>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}

function SingleEntryForm({ agencies, parts, setSnackbar }) {
  // Simple form logic for fast single entry
  const [formData, setFormData] = useState({
    order_date: new Date(),
    buyer_name: '',
    agency_id: '',
    note: ''
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredParts = parts.filter(p => p.name.includes(searchQuery) || p.code?.includes(searchQuery)).slice(0, 50);

  const addItem = (part) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.part_id === part.id);
      if (existing) {
        return prev.map(i => i.part_id === part.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { part_id: part.id, name: part.name, code: part.code, price: part.price || 0, qty: 1 }];
    });
  };

  const removeItem = (id) => setSelectedItems(prev => prev.filter(i => i.part_id !== id));

  const submit = async () => {
    if (!formData.buyer_name && !formData.agency_id) {
      return setSnackbar({ open: true, message: '고객명이나 대리점을 입력하세요.', severity: 'warning' });
    }
    if (selectedItems.length === 0) {
      return setSnackbar({ open: true, message: '품목을 1개 이상 추가하세요.', severity: 'warning' });
    }
    setIsSubmitting(true);
    try {
      // Create shipment + shipment_parts + transactions logic here
      const totalQty = selectedItems.reduce((a, b) => a + b.qty, 0);
      const totalAmt = selectedItems.reduce((a, b) => a + (b.price * b.qty), 0);
      const combinedTitle = selectedItems.map(i => i.name).join(', ');

      const agencyName = formData.agency_id ? agencies.find(a => a.id === formData.agency_id)?.name : null;
      const salesChannel = agencyName || '공홈';

      // 1. Insert Shipment
      const { data: newShipment, error: shpErr } = await supabase.from('shipments').insert([{
        brand: 'XRB', order_date: format(formData.order_date, 'yyyy-MM-dd'), shipment_date: format(formData.order_date, 'yyyy-MM-dd'),
        status: '완료', customer_name: formData.buyer_name || agencyName || '비회원', sales_channel: salesChannel,
        product_name: combinedTitle, quantity: totalQty, price: totalAmt, note: formData.note
      }]).select();
      if (shpErr) throw shpErr;

      const sid = newShipment[0].id;
      
      // 2. Insert Parts
      const pData = selectedItems.map(it => ({
        shipment_id: sid, part_name: it.name, part_code: it.code, quantity: it.qty, price: it.price, total_price: it.price * it.qty, created_at: new Date().toISOString()
      }));
      await supabase.from('shipment_parts').insert(pData);

      // 3. Transactions (out)
      const txData = selectedItems.map(it => ({
        group_id: sid, type: 'out', product_id: it.part_id, product_name: it.name, quantity: it.qty, from_location: 'DEFAULT', date: format(formData.order_date, 'yyyy-MM-dd'),
        status: '완료', note: '[빠른판매] ' + (formData.buyer_name || agencyName || '비회원')
      }));
      await supabase.from('transactions').insert(txData);

      setSnackbar({ open: true, message: '판매가 등록되었습니다.', severity: 'success' });
      setFormData({ order_date: new Date(), buyer_name: '', agency_id: '', note: '' });
      setSelectedItems([]);
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, message: '저장 오류: ' + e.message, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2}>1. 기본 정보</Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker label="판매/출고일" value={formData.order_date} onChange={(d) => setFormData({ ...formData, order_date: d })} slotProps={{ textField: { fullWidth: true, size: "small" } }} />
            </LocalizationProvider>
            <TextField label="고객명 (일반)" size="small" fullWidth value={formData.buyer_name} onChange={e => setFormData({ ...formData, buyer_name: e.target.value })} helperText="대리점 주문일 경우 비워둬도 무방" />
            <FormControl size="small" fullWidth>
              <InputLabel>대리점 (B2B)</InputLabel>
              <Select value={formData.agency_id} label="대리점 (B2B)" onChange={e => setFormData({ ...formData, agency_id: e.target.value })}>
                <MenuItem value="">선택 안함</MenuItem>
                {agencies.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="메모" size="small" fullWidth value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
           <Typography variant="subtitle1" fontWeight="bold" mb={2}>2. 상품 검색/추가</Typography>
           <TextField label="상품명/코드 검색" size="small" fullWidth value={searchQuery} onChange={e => setSearchQuery(e.target.value)} sx={{ mb: 2 }} />
           <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 1 }}>
              {filteredParts.map(p => (
                <Box key={p.id} sx={{ p: 1, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', '&:hover': { bgcolor: '#f5f5f5' } }}>
                  <Box>
                    <Typography variant="body2">{p.name}</Typography>
                    <Typography variant="caption" color="textSecondary">{p.code}</Typography>
                  </Box>
                  <IconButton size="small" color="primary" onClick={() => addItem(p)}><AddIcon /></IconButton>
                </Box>
              ))}
           </Box>
        </Grid>

        <Grid item xs={12} md={4}>
           <Typography variant="subtitle1" fontWeight="bold" mb={2}>3. 추가된 항목</Typography>
           <Box sx={{ minHeight: 300, border: '1px dashed #ccc', borderRadius: 1, p: 2, display: 'flex', flexDirection: 'column' }}>
             {selectedItems.length === 0 ? <Typography color="textSecondary" align="center" mt={5}>선택된 상품이 없습니다.</Typography> : (
               selectedItems.map((it, idx) => (
                 <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, p: 1, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                   <Box>
                     <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>{it.name}</Typography>
                     <Typography variant="caption" color="textSecondary">{Number(it.price).toLocaleString()}원</Typography>
                   </Box>
                   <Box display="flex" alignItems="center" gap={1}>
                     <TextField type="number" size="small" value={it.qty} onChange={e => {
                        const v = Number(e.target.value);
                        setSelectedItems(prev => prev.map(o => o.part_id === it.part_id ? { ...o, qty: v } : o));
                     }} sx={{ width: 60 }} inputProps={{ min: 1 }} />
                     <IconButton size="small" color="error" onClick={() => removeItem(it.part_id)}><DeleteIcon /></IconButton>
                   </Box>
                 </Box>
               ))
             )}
             <Box mt="auto" pt={2} borderTop="1px solid #ddd" display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">총 합계: {selectedItems.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()}원</Typography>
                <Button variant="contained" disabled={isSubmitting || selectedItems.length === 0} onClick={submit}>
                  {isSubmitting ? <CircularProgress size={24} /> : '등록하기'}
                </Button>
             </Box>
           </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

function ExcelBatchUpload({ agencies, parts, setSnackbar }) {
  const [data, setData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappingDialog, setMappingDialog] = useState(false);
  const [missingParts, setMissingParts] = useState([]);
  const [mappingChoices, setMappingChoices] = useState({});

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await readExcelFile(file);
      const normalized = parsed.map(row => {
        const newRow = {};
        for (let key in row) {
          const cleanKey = key.replace(/\s+/g, '');
          newRow[cleanKey] = row[key];
        }
        return newRow;
      });
      setData(normalized);
    } catch (err) {
      setSnackbar({ open: true, message: '엑셀 파싱 실패', severity: 'error' });
    }
  };

  const handlePreUpload = () => {
    if (data.length === 0) return;
    const missing = new Set();
    for (const row of data) {
       const pcodeRaw = row['매칭부품코드'] || row['부품코드'] || row['상품코드'] || row['품목코드'] || row['바코드'];
       const pNameRaw = row['상품명'] || row['품목명'] || row['부품명'] || row['품목명(규격)'] || row['품목명(요약)'];

       const matchedPart = parts.find(p => p.code === pcodeRaw || (p.barcode && p.barcode === String(pcodeRaw))) || parts.find(p => p.name === pNameRaw);
       if (!matchedPart && pNameRaw) {
          missing.add(pNameRaw);
       }
    }

    if (missing.size > 0) {
      setMissingParts(Array.from(missing));
      setMappingDialog(true);
    } else {
      uploadBatch({});
    }
  };

  const uploadBatch = async (maps = mappingChoices) => {
    if (data.length === 0) return;
    setIsProcessing(true);
    setMappingDialog(false);
    let successCount = 0;
    try {
      for (const row of data) {
         const orderDate = row['주문일자'] || row['주문일시'] || row['주문일'] || row['결제일'] || row['일자'] || row['전표일자'] || row['일자-No.'] || format(new Date(), 'yyyy-MM-dd');
         const customer = row['주문자'] || row['대리점명'] || row['고객명'] || row['대리점'] || row['수령인'] || row['거래처명'] || row['거래처'] || '공홈';
         const pName = row['상품명'] || row['품목명'] || row['부품명'] || row['품목명(규격)'] || row['품목명(요약)'];
         const pcode = row['매칭부품코드'] || row['부품코드'] || row['상품코드'] || row['품목코드'] || row['바코드'];
         
         const matchedPart = parts.find(p => p.code === pcode || (p.barcode && p.barcode === String(pcode))) 
           || parts.find(p => p.name === pName)
           || (maps[pName] ? parts.find(p => p.id === maps[pName].id) : null);

         if (!matchedPart && !pName) continue;

         const qty = Number(row['수량'] || row['주문수량'] || 1);
         let priceStr = row['판매가'] || row['결제금액'] || row['결제액'] || row['상품구매금액'] || row['합계금액'] || row['단가'] || row['실판매가'];
         if (typeof priceStr === 'string') priceStr = priceStr.replace(/,/g, '');
         const price = Number(priceStr || matchedPart?.price || 0);
         const total = qty * price;

         const { data: newShp, error } = await supabase.from('shipments').insert([{
           brand: 'XRB', order_date: orderDate,
           shipment_date: orderDate,
           status: '완료', customer_name: customer,
           sales_channel: customer, product_name: matchedPart?.name || pName,
           quantity: qty, price: total, note: row['메모'] || '[엑셀일괄등록]'
         }]).select();

         if (!error && newShp && newShp[0] && matchedPart) {
           successCount++;
           const sid = newShp[0].id;
           await supabase.from('shipment_parts').insert([{
              shipment_id: sid, part_name: matchedPart.name, part_code: matchedPart.code, quantity: qty, price, total_price: total
           }]);
           await supabase.from('transactions').insert([{
              group_id: sid, type: 'out', product_id: matchedPart.id, product_name: matchedPart.name, quantity: qty, from_location: 'DEFAULT', 
              date: orderDate, status: '완료', note: '[엑셀등록]'
           }]);
         }
      }
      setSnackbar({ open: true, message: `${successCount}건 대량 등록 완료!`, severity: 'success' });
      setData([]);
    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, message: '일부 데이터 업로드 중 오류가 발생했습니다.', severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" mb={2}>
           <Box>
            <Typography variant="subtitle1" fontWeight="bold">과거 자료 엑셀 업로드</Typography>
            <Typography variant="caption" color="textSecondary">필요 컬럼: 주문일자, 주문자, 대리점명, 매칭부품코드(또는 상품명), 수량, 판매가</Typography>
           </Box>
           <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
              엑셀 파일 선택
              <input type="file" hidden accept=".xlsx, .xls" onChange={handleFileUpload} />
           </Button>
        </Box>
        <TableContainer sx={{ maxHeight: 400, border: '1px solid #eee' }}>
          <Table stickyHeader size="small">
             <TableHead>
               <TableRow>
                 <TableCell>상태</TableCell>
                 <TableCell>주문일자</TableCell>
                 <TableCell>주문자/대리점</TableCell>
                 <TableCell>부품코드</TableCell>
                 <TableCell>부품명</TableCell>
                 <TableCell align="right">수량</TableCell>
                 <TableCell align="right">판매가</TableCell>
               </TableRow>
             </TableHead>
             <TableBody>
               {data.slice(0, 30).map((row, i) => {
                 const orderDate = row['주문일자'] || row['주문일시'] || row['주문일'] || row['결제일'] || row['일자'] || row['전표일자'] || row['일자-No.'] || '-';
                 const customer = row['주문자'] || row['대리점명'] || row['고객명'] || row['대리점'] || row['수령인'] || row['거래처명'] || row['거래처'] || '-';
                 
                 const pcodeRaw = row['매칭부품코드'] || row['부품코드'] || row['상품코드'] || row['품목코드'] || row['바코드'];
                 const pNameRaw = row['상품명'] || row['품목명'] || row['부품명'] || row['품목명(규격)'] || row['품목명(요약)'];
                 const matchedPart = parts.find(p => p.code === pcodeRaw || (p.barcode && p.barcode === String(pcodeRaw))) 
                   || parts.find(p => p.name === pNameRaw)
                   || (mappingChoices[pNameRaw] ? parts.find(p => p.id === mappingChoices[pNameRaw].id) : null);
                 const isMatch = !!matchedPart;

                 const pcode = pcodeRaw || '-';
                 const pName = pNameRaw || '-';
                 const qty = row['수량'] || row['주문수량'] || '-';
                 const price = row['판매가'] || row['결제금액'] || row['상품구매금액'] || row['합계금액'] || row['단가'] || row['실판매가'] || '-';
                 
                 return (
                   <TableRow key={i} sx={{ backgroundColor: isMatch ? 'inherit' : '#fff0f0' }}>
                     <TableCell>
                       {isMatch ? '✅ 가능' : '❌ 불가'}
                     </TableCell>
                     <TableCell>{orderDate}</TableCell>
                     <TableCell>{customer}</TableCell>
                     <TableCell>{pcode}</TableCell>
                     <TableCell sx={{ color: isMatch ? 'inherit' : 'error.main', fontWeight: isMatch ? 'normal' : 'bold' }}>
                        {pName}
                     </TableCell>
                     <TableCell align="right">{qty}</TableCell>
                     <TableCell align="right">{price}</TableCell>
                   </TableRow>
                 );
               })}
               {data.length > 30 && <TableRow><TableCell colSpan={7} align="center">... 외 {data.length - 30}건</TableCell></TableRow>}
               {data.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>미리보기가 여기에 표시됩니다.</TableCell></TableRow>}
             </TableBody>
           </Table>
        </TableContainer>

        {/* 수동 매칭 팝업 */}
        <Dialog open={mappingDialog} maxWidth="md" fullWidth onClose={() => setMappingDialog(false)}>
          <DialogTitle>수동 매칭이 필요한 항목</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ mb: 3 }} color="textSecondary">
              다음 항목들은 자동으로 부품을 찾지 못했습니다. 올바른 부품으로 선택해주시거나, 재고 차감이 필요 없으실 경우 "선택 안 함"으로 비워두시면 텍스트 이력으로만 기록됩니다.
            </Typography>
            {missingParts.map((rawName, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ width: '40%', fontWeight: 'bold' }}>{rawName}</Typography>
                <Autocomplete
                  sx={{ width: '60%' }}
                  options={parts}
                  getOptionLabel={o => `${o.name} (${o.code})`}
                  value={mappingChoices[rawName] || null}
                  onChange={(e, val) => setMappingChoices(prev => ({ ...prev, [rawName]: val }))}
                  renderInput={(params) => <TextField {...params} label="부품 연결" size="small" />}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                />
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMappingDialog(false)}>취소</Button>
            <Button 
              variant="contained" 
              onClick={() => uploadBatch(mappingChoices)}
              disabled={isProcessing}
            >
              매칭 정보로 업로드 실행
            </Button>
          </DialogActions>
        </Dialog>
    </Paper>
  );
}

export default SalesEntry;
