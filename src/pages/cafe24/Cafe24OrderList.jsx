import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete, TextField, IconButton, Tooltip
} from '@mui/material';
import { Sync as SyncIcon, Warning as WarningIcon, Link as LinkIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { getCafe24Malls, syncCafe24Orders, addCafe24ProductMapping } from '../../utils/cafe24Api';

// 날짜 포맷팅 헬퍼
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function Cafe24OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const getFormattedDate = (date) => {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getFormattedDate(d);
  });
  const [endDate, setEndDate] = useState(() => getFormattedDate(new Date()));

  const setPeriod = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setEndDate(getFormattedDate(end));
    setStartDate(getFormattedDate(start));
  };

  // 매핑 모달 상태
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingItem, setMappingItem] = useState(null); // { mall_id, product_code, custom_product_code, name }
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [mappingSaving, setMappingSaving] = useState(false);

  useEffect(() => {
    fetchMalls();
    fetchOrders();
    fetchParts();
  }, []);

  const fetchMalls = async () => {
    try {
      const res = await getCafe24Malls();
      if (res.success && res.malls) {
        setMalls(res.malls.filter(m => m.connected));
      }
    } catch (err) {
      console.error(err);
      setError('쇼핑몰 설정 정보를 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
    }
  };

  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('id, name, barcode, code').order('name');
    if (data) setAvailableParts(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('cafe24_orders')
        .select('*')
        .order('order_date', { ascending: false })
        .limit(200);

      if (dbErr) throw dbErr;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      setError('주문 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (malls.length === 0) {
      alert('연동된 카페24 쇼핑몰이 없습니다. 설정 메뉴에서 쇼핑몰을 연동해주세요.');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      // 선택된 시작/종료일 기준으로 동기화
      for (const m of malls) {
        await syncCafe24Orders(m.mall_id, startDate, endDate); 
      }
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const openMappingModal = (order, item) => {
    const targetCode = item.custom_product_code || item.product_code;
    setMappingItem({
      mall_id: order.mall_id,
      product_code: targetCode,
      name: item.name
    });
    setSelectedPart(null);
    setMappingModalOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!mappingItem || !selectedPart) return;
    setMappingSaving(true);
    try {
      await addCafe24ProductMapping(mappingItem.mall_id, mappingItem.product_code, selectedPart.id);
      alert('수동 매핑이 저장되었습니다. 동기화를 다시 실행하여 반영할 수 있습니다.');
      setMappingModalOpen(false);
      // 재동기화 권장
      handleSync();
    } catch (err) {
      alert(err.message);
    } finally {
      setMappingSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">🛒 예약 및 매장 주문 수집 (Cafe24)</Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="시작일"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Typography>~</Typography>
            <TextField
              label="종료일"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => setPeriod(0)}>금일</Button>
            <Button variant="outlined" size="small" onClick={() => setPeriod(7)}>7일</Button>
            <Button variant="outlined" size="small" onClick={() => setPeriod(30)}>1개월</Button>
          </Stack>

          <Button 
            variant="contained" 
            startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />} 
            onClick={handleSync}
            disabled={syncing}
            sx={{ ml: 'auto' }}
          >
            {syncing ? '동기화 중...' : '선택 기간 주문 수집'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><strong>주문일시</strong></TableCell>
              <TableCell><strong>쇼핑몰ID</strong></TableCell>
              <TableCell><strong>주문번호</strong></TableCell>
              <TableCell><strong>주문자</strong></TableCell>
              <TableCell><strong>주문상품</strong></TableCell>
              <TableCell><strong>상태</strong></TableCell>
              <TableCell><strong>매칭 상태</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}><CircularProgress /></TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>데이터가 없습니다.</TableCell></TableRow>
            ) : (
              orders.map(order => {
                const items = order.order_items || [];
                // 매칭 실패 항목 확인 (바코드가 설정되었으나 part_id가 없는 항목 등)
                // 단순히 옵션품목일 수 있으므로 product_code/custom_product_code가 있는 항목에 대해서만 매칭을 요구
                const unmappedItems = items.filter(i => !i.part_id && (i.custom_product_code || i.product_code));
                
                return (
                  <TableRow key={order.id} hover>
                    <TableCell>{formatDate(order.order_date)}</TableCell>
                    <TableCell>{order.mall_id}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{order.order_id}</TableCell>
                    <TableCell>
                      {order.buyer_name || '-'}<br/>
                      <Typography variant="caption" color="text.secondary">{order.buyer_phone}</Typography>
                    </TableCell>
                    <TableCell>
                      {items.map((item, idx) => (
                        <Box key={idx} sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">• {item.name} {item.options ? `[${item.options}]` : ''} - {item.quantity}개</Typography>
                          {(!item.part_id && (item.custom_product_code || item.product_code)) && (
                            <Tooltip title="CRM 상품과 매칭되지 않았습니다. 클릭하여 수동 매칭하세요.">
                              <IconButton size="small" color="warning" onClick={() => openMappingModal(order, item)} sx={{ p: 0.5 }}>
                                <WarningIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {item.part_id && (
                            <Tooltip title="정상 매칭됨">
                              <LinkIcon fontSize="small" color="success" />
                            </Tooltip>
                          )}
                        </Box>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Chip label={order.status} size="small" />
                    </TableCell>
                    <TableCell>
                      {unmappedItems.length > 0 ? (
                        <Chip label={`${unmappedItems.length}건 미매칭`} color="warning" size="small" />
                      ) : (
                        <Chip label="매칭 완료" color="success" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 수동 매칭 모달 */}
      <Dialog open={mappingModalOpen} onClose={() => setMappingModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>수동 상품 매핑</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            카페24 상품 <b>"{mappingItem?.name}"</b> 에 해당하는 CRM 부품을 찾아 연결합니다.<br />
            (고유 코드: {mappingItem?.product_code})
          </Alert>

          <Autocomplete
            options={availableParts}
            getOptionLabel={(option) => `${option.name} (${option.barcode || option.code})`}
            value={selectedPart}
            onChange={(event, newValue) => setSelectedPart(newValue)}
            renderInput={(params) => <TextField {...params} label="CRM 부품 검색 (이름 또는 바코드)" />}
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography variant="body1">{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary">바코드: {option.barcode || '없음'} | 코드: {option.code}</Typography>
                </Box>
              </li>
            )}
          />

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingModalOpen(false)}>취소</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveMapping} 
            disabled={!selectedPart || mappingSaving}
          >
            {mappingSaving ? '저장중...' : '매핑 저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
