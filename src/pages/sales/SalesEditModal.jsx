import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Grid, TextField, Typography,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Divider, CircularProgress, Chip
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function SalesEditModal({ open, onClose, orderId, orderType, onRefresh }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (open && orderId) fetchDetails();
  }, [open, orderId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      if (orderType === 'shipment') {
        const { data, error } = await supabase
          .from('shipments')
          .select('*, shipment_parts(id, part_name, quantity, price, total_price)')
          .eq('id', orderId)
          .single();
        if (error) throw error;
        setOrderData(data);
        setItems((data.shipment_parts || []).map(p => ({
          id: p.id,
          part_name: p.part_name || '상품',
          quantity: Number(p.quantity || 1),
          price: Number(p.price || 0),
          total_price: Number(p.total_price || 0),
        })));
      } else if (orderType === 'service') {
        const { data, error } = await supabase
          .from('services')
          .select('*, service_parts(id, quantity, part_id, parts(name, price))')
          .eq('id', orderId)
          .single();
        if (error) throw error;
        setOrderData(data);
        setItems((data.service_parts || []).map(sp => {
          const unitPrice = Number(sp.parts?.price || 0);
          const qty = Number(sp.quantity || 1);
          return {
            id: sp.id,
            part_name: sp.parts?.name || '부품',
            quantity: qty,
            price: unitPrice,
            total_price: unitPrice * qty,
          };
        }));
      } else if (orderType === 'cafe24') {
        const { data, error } = await supabase
          .from('cafe24_orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (error) throw error;
        setOrderData({
          ...data,
          customer_name: data.buyer_name,
          note: data.status,
          order_date: data.order_date
        });
        const orderItems = data.order_items || [];
        setItems(orderItems.map((item, i) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.product_price || item.price || 0);
          return {
            id: `cafe_item_${i}`,
            part_name: item.product_name || item.name || '온라인상품',
            quantity: qty,
            price: price,
            total_price: qty * price
          };
        }));
      }
    } catch (err) {
      console.error(err);
      alert('데이터를 불러오는데 실패했습니다.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const calcVAT = (total) => {
    const supply = Math.round(total / 1.1);
    return { supply, vat: total - supply };
  };

  const handleItemChange = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    const qty = Number(field === 'quantity' ? value : next[idx].quantity) || 1;
    const price = Number(field === 'price' ? value : next[idx].price) || 0;
    const total = Number(field === 'total_price' ? value : qty * price);
    next[idx].total_price = field === 'total_price' ? Number(value) : total;
    if (field !== 'total_price') next[idx].price = price;
    setItems(next);
  };

  const totalQty = items.reduce((a, i) => a + Number(i.quantity || 0), 0);
  const totalAmt = items.reduce((a, i) => a + Number(i.total_price || 0), 0);
  const totalSupply = Math.round(totalAmt / 1.1);
  const totalVat = totalAmt - totalSupply;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (orderType === 'shipment') {
        await supabase.from('shipments').update({
          customer_name: orderData.customer_name,
          sales_channel: orderData.sales_channel,
          note: orderData.note,
          price: totalAmt,
        }).eq('id', orderId);

        for (const item of items) {
          if (item.id) {
            await supabase.from('shipment_parts').update({
              quantity: Number(item.quantity),
              price: Number(item.price),
              total_price: Number(item.total_price),
            }).eq('id', item.id);
          }
        }
      } else if (orderType === 'service') {
        await supabase.from('services').update({
          customer_name: orderData.customer_name,
          note: orderData.note,
        }).eq('id', orderId);

        for (const item of items) {
          if (item.id) {
            await supabase.from('service_parts').update({
              quantity: Number(item.quantity),
            }).eq('id', item.id);
          }
        }
      } else if (orderType === 'cafe24') {
        await supabase.from('cafe24_orders').update({
          buyer_name: orderData.customer_name,
          status: orderData.note,
        }).eq('id', orderId);
        // Cafe24 품목은 직접 수정하지 않습니다 (연동 데이터 기준)
      }

      onRefresh?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const dateStr = orderData
    ? format(new Date(orderData.order_date || orderData.completion_date || orderData.reception_date || Date.now()), 'yyyy-MM-dd')
    : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {/* 헤더 */}
      <DialogTitle sx={{ bgcolor: '#3f51b5', color: 'white', py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6" fontWeight="bold">판매 수정</Typography>
          {orderType && (
            <Chip
              label={orderType === 'cafe24' ? '온라인주문' : (orderType === 'service' ? 'A/S건' : '매장출고')}
              size="small"
              sx={{ bgcolor: orderType === 'cafe24' ? '#4caf50' : (orderType === 'service' ? '#ff9800' : '#1976d2'), color: 'white', fontWeight: 'bold' }}
            />
          )}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={5}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* 기본 정보 */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight="bold">기본 정보</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <TextField label="일자" size="small" fullWidth value={dateStr} disabled />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="고객명"
                    size="small"
                    fullWidth
                    value={orderData?.customer_name || ''}
                    onChange={e => setOrderData({ ...orderData, customer_name: e.target.value })}
                  />
                </Grid>
                {orderType === 'shipment' && (
                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="판매채널"
                      size="small"
                      fullWidth
                      value={orderData?.sales_channel || ''}
                      onChange={e => setOrderData({ ...orderData, sales_channel: e.target.value })}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={orderType === 'shipment' ? 3 : 6}>
                  <TextField
                    label="메모"
                    size="small"
                    fullWidth
                    value={orderData?.note || ''}
                    onChange={e => setOrderData({ ...orderData, note: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* 품목 표 */}
            <Typography variant="subtitle2" color="text.secondary" mb={1} fontWeight="bold">품목 내역</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell width={40} align="center">No</TableCell>
                    <TableCell>품목명</TableCell>
                    <TableCell width={80} align="center">수량</TableCell>
                    <TableCell width={110} align="right">단가</TableCell>
                    <TableCell width={110} align="right">공급가액</TableCell>
                    <TableCell width={90} align="right">부가세</TableCell>
                    <TableCell width={120} align="right">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, idx) => {
                    const { supply, vat } = calcVAT(Number(item.total_price || 0));
                    return (
                      <TableRow key={idx} hover>
                        <TableCell align="center" sx={{ color: 'text.secondary' }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{item.part_name}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            variant="standard"
                            size="small"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                            inputProps={{ style: { textAlign: 'center', width: 60 } }}
                            disabled={orderType === 'cafe24'}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            variant="standard"
                            size="small"
                            value={item.price}
                            onChange={e => handleItemChange(idx, 'price', e.target.value)}
                            inputProps={{ style: { textAlign: 'right', width: 90 } }}
                            disabled={orderType !== 'shipment'}
                          />
                        </TableCell>
                        <TableCell align="right">{supply.toLocaleString()}</TableCell>
                        <TableCell align="right">{vat.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            variant="standard"
                            size="small"
                            value={item.total_price}
                            onChange={e => handleItemChange(idx, 'total_price', e.target.value)}
                            inputProps={{ style: { textAlign: 'right', width: 100, fontWeight: 'bold' } }}
                            disabled={orderType !== 'shipment'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        등록된 품목이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}

                  {/* 총합계 행 */}
                  <TableRow sx={{ bgcolor: '#fff8e1', '& td': { fontWeight: 'bold' } }}>
                    <TableCell colSpan={2} align="right" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>합 계</TableCell>
                    <TableCell align="center">{totalQty.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                    <TableCell align="right">{totalSupply.toLocaleString()}</TableCell>
                    <TableCell align="right">{totalVat.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: '#1565c0', fontSize: '1rem' }}>{totalAmt.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1, justifyContent: 'space-between' }}>
        <Box>
           {(orderType === 'shipment' || orderType === 'service') && (
              <Button 
                variant="outlined" 
                color="error"
                onClick={() => {
                   onClose();
                   navigate(`/${orderType}/${orderId}`);
                }}
              >
                상세 원본 보기 / 완전 삭제하기
              </Button>
           )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">취소</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || loading}
            sx={{ minWidth: 100 }}
          >
            {saving ? <CircularProgress size={20} /> : '저장'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
