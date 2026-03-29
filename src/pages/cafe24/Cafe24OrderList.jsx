import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete, TextField, Tabs, Tab, Select, MenuItem, FormControl, InputLabel, Checkbox
} from '@mui/material';
import { Sync as SyncIcon } from '@mui/icons-material';
import Cafe24Settings from '../../components/Settings/Cafe24Settings';
import { supabase } from '../../lib/supabaseClient';
import { getCafe24Malls, syncCafe24Orders, addCafe24ProductMapping, transferCafe24Orders } from '../../utils/cafe24Api';

const STATUS_KO = {
  'N00': '입금대기', 'N10': '상품준비중', 'N20': '배송보류', 'N21': '배송대기',
  'N22': '배송중', 'N30': '배송완료', 'N40': '자동배송완료', 'C00': '취소접수',
  'C10': '취소처리중', 'C40': '취소완료', 'E00': '교환접수', 'E10': '교환처리중',
  'E40': '교환완료', 'R00': '반품접수', 'R10': '반품처리중', 'R40': '반품완료'
};
const getKoStatus = (status) => STATUS_KO[status] || status;
const getBadgeColor = (status) => {
  if (!status) return 'default';
  if (status.startsWith('C')) return 'error'; // 취소 (빨간색)
  if (status.startsWith('R')) return 'warning'; // 반품/환불 (주황색)
  if (status.startsWith('E')) return 'secondary'; // 교환 (보라색/Secondary)
  if (status === 'N30' || status === 'N40') return 'success'; // 완료
  return 'primary'; // 배송중 등 기본 단계
};

const MEMBER_GROUPS = {
  '12': '사업자회원',
  '15': '엑스라이더',
};
const getGroupName = (no) => MEMBER_GROUPS[no] || `그룹:${no}`;

// 날짜 포맷팅 헬퍼
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function Cafe24OrderList() {
  const [orders, setOrders] = useState([]);
  const [malls, setMalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedMall, setSelectedMall] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState([]);
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
        .neq('is_deleted', true)
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

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = orders.filter(order => selectedMall === 'all' || order.mall_id === selectedMall).map(n => n.id);
      setSelectedOrders(newSelecteds);
      return;
    }
    setSelectedOrders([]);
  };

  const handleSelectRow = (event, id) => {
    const selectedIndex = selectedOrders.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedOrders, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedOrders.slice(1));
    } else if (selectedIndex === selectedOrders.length - 1) {
      newSelected = newSelected.concat(selectedOrders.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selectedOrders.slice(0, selectedIndex), selectedOrders.slice(selectedIndex + 1));
    }
    setSelectedOrders(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (!selectedOrders.length) return;
    if (!window.confirm(`선택한 ${selectedOrders.length}건의 주문을 목록에서 영구히 삭제하시겠습니까? (삭제 시 재수집해도 나타나지 않습니다)`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('cafe24_orders')
        .update({ is_deleted: true })
        .in('id', selectedOrders);
      if (error) throw error;

      alert('삭제되었습니다.');
      setSelectedOrders([]);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleSalesTransfer = async () => {
    if (!selectedOrders.length) return;
    const ordersToTransfer = orders.filter(o => selectedOrders.includes(o.id) && !o.is_transferred);
    
    if (ordersToTransfer.length === 0) {
      alert('선택한 주문 중 판매 전송 가능한 건이 없습니다. (이미 전송 완료된 건 제외)');
      return;
    }

    if (!window.confirm(`${ordersToTransfer.length}건의 주문을 매출(출고) 내역으로 전송하시겠습니까?`)) return;

    try {
      setLoading(true);
      await transferCafe24Orders(ordersToTransfer.map(o => o.id));
      alert('전송이 완료되었습니다.');
      setSelectedOrders([]);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert(`전송 실패: ${err.message}`);
      setLoading(false);
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
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>온라인주문관리</Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)}>
          <Tab label="주문 내역" />
          <Tab label="카페24 연동 관리" />
        </Tabs>
      </Box>

      <div role="tabpanel" hidden={tabValue !== 0}>
        {tabValue === 0 && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white' }}>
                  <InputLabel>쇼핑몰 선택</InputLabel>
                  <Select value={selectedMall} label="쇼핑몰 선택" onChange={e => setSelectedMall(e.target.value)}>
                    <MenuItem value="all">전체 쇼핑몰</MenuItem>
                    {malls.map(m => <MenuItem key={m.mall_id} value={m.mall_id}>{m.mall_id === 'slimpack79' ? '엑스라이더(slimpack79)' : m.mall_id === 'nearbike' ? '니어바이크(nearbike)' : m.mall_id}</MenuItem>)}
                  </Select>
                </FormControl>

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

          {selectedOrders.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ ml: 2, borderLeft: 1, borderColor: 'divider', pl: 2 }}>
              <Button size="small" variant="contained" color="error" onClick={handleDeleteSelected}>
                선택 삭제
              </Button>
              <Button size="small" variant="contained" color="primary" onClick={handleSalesTransfer}>
                판매 전송
              </Button>
            </Stack>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1500, whiteSpace: 'nowrap' }}>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < orders.length}
                  checked={orders.length > 0 && selectedOrders.length === orders.length}
                  onChange={handleSelectAllClick}
                />
              </TableCell>
              <TableCell><strong>수집처</strong></TableCell>
              <TableCell><strong>쇼핑몰명</strong></TableCell>
              <TableCell><strong>주문번호</strong></TableCell>
              <TableCell><strong>주문자(ID)</strong></TableCell>
              <TableCell><strong>주문일시 (상태)</strong></TableCell>
              <TableCell><strong>쇼핑몰상품명</strong></TableCell>
              <TableCell><strong>상품 옵션</strong></TableCell>
              <TableCell align="right"><strong>수량</strong></TableCell>
              <TableCell align="right"><strong>상품단가</strong></TableCell>
              <TableCell align="right"><strong>주문금액</strong></TableCell>
              <TableCell align="right"><strong>상품별할인금액</strong></TableCell>
              <TableCell align="right"><strong>묶음할인금액</strong></TableCell>
              <TableCell align="right"><strong>실결제금액</strong></TableCell>
              <TableCell align="right"><strong>배송비</strong></TableCell>
              <TableCell align="right"><strong>전체할인/적립금</strong></TableCell>
              <TableCell><strong>품목코드(ERP)</strong></TableCell>
              <TableCell><strong>품목명(ERP)</strong></TableCell>
              <TableCell><strong>배송메시지</strong></TableCell>
              <TableCell><strong>판매전송</strong></TableCell>
              <TableCell><strong>상태별처리기능</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={16} align="center" sx={{ py: 3 }}><CircularProgress /></TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={16} align="center" sx={{ py: 3 }}>데이터가 없습니다.</TableCell></TableRow>
            ) : (
              orders.filter(order => selectedMall === 'all' || order.mall_id === selectedMall).reduce((acc, order) => {
                const items = order.order_items || [];
                if (items.length === 0) {
                  // 빈 주문인 경우 빈 행 하나 추가
                  acc.push(
                    <TableRow key={order.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => handleSelectRow(e, order.id)}
                          disabled={order.is_transferred}
                        />
                      </TableCell>
                      <TableCell>카페24</TableCell>
                      <TableCell>카페24 - {order.mall_id}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{order.order_id}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{order.buyer_name || '비회원'}</Typography>
                          {order.buyer_id && <Typography variant="caption" color="text.secondary">({order.buyer_id})</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(order.order_date)}</TableCell>
                      <TableCell colSpan={14} align="center" sx={{ color: 'text.secondary' }}>상품 정보가 없습니다</TableCell>
                    </TableRow>
                  );
                  return acc;
                }

                items.forEach((item, idx) => {
                  const matchedPart = item.part_id ? availableParts.find(p => p.id === item.part_id) : null;
                  const erpCode = matchedPart ? (matchedPart.barcode || matchedPart.code) : '';
                  const erpName = matchedPart ? matchedPart.name : '';
                  const needsMapping = !item.part_id && (item.custom_product_code || item.product_code);
                  
                  // 계산된 적립금/전체할인 구하기 (DB에 없을 경우를 대비해 프론트엔드에서도 계산)
                  const orderItemsSum = items.reduce((sum, it) => sum + Number(it.payment_amount || 0), 0);
                  const calculatedUsedPoints = Math.max(0, orderItemsSum + Number(order.shipping_fee || 0) - Number(order.total_amount || 0));
                  const displayUsedPoints = Number(order.used_points !== undefined && order.used_points !== null ? order.used_points : calculatedUsedPoints);

                  acc.push(
                    <TableRow key={`${order.id}-${idx}`} hover selected={selectedOrders.includes(order.id)}>
                      {idx === 0 && (
                        <TableCell padding="checkbox" rowSpan={items.length}>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => handleSelectRow(e, order.id)}
                            disabled={order.is_transferred}
                          />
                        </TableCell>
                      )}
                      {idx === 0 && <TableCell rowSpan={items.length}>카페24</TableCell>}
                      {idx === 0 && <TableCell rowSpan={items.length}>카페24 - {order.mall_id}</TableCell>}
                      {idx === 0 && <TableCell rowSpan={items.length} sx={{ fontFamily: 'monospace' }}>{order.order_id}</TableCell>}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          <Box>
                            <Typography variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {order.buyer_name || '비회원'}
                              {order.buyer_group_no && order.buyer_group_no !== '1' && <Chip size="small" label={getGroupName(order.buyer_group_no)} sx={{ height: 16, fontSize: '0.65rem' }} color={order.buyer_group_no === '12' ? 'success' : order.buyer_group_no === '15' ? 'warning' : 'default'}/>}
                              {order.member_authentication === 'B' && <Chip size="small" label="특별관리" color="error" sx={{ height: 16, fontSize: '0.65rem' }} />}
                            </Typography>
                            {order.buyer_id && <Typography variant="caption" color="text.secondary" component="div">({order.buyer_id})</Typography>}
                          </Box>
                        </TableCell>
                      )}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          <Box>
                            <Typography variant="body2">{formatDate(order.order_date)}</Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              <Chip label={getKoStatus(order.status)} size="small" color={getBadgeColor(order.status)} variant={order.status.startsWith('N') ? 'outlined' : 'filled'} />
                            </Stack>
                          </Box>
                        </TableCell>
                      )}
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.options || '-'}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{Number(item.price || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(item.item_discount || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{Number(item.bundle_discount || item.discount_amount || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{((Number(item.payment_amount === undefined ? (Number(item.price || 0) * Number(item.quantity || 1)) : item.payment_amount)) + (idx === 0 ? Number(order.shipping_fee || 0) : 0)).toLocaleString()}</TableCell>
                      {idx === 0 && <TableCell align="right" rowSpan={items.length}>{Number(order.shipping_fee || 0).toLocaleString()}</TableCell>}
                      {idx === 0 && <TableCell align="right" rowSpan={items.length}>{displayUsedPoints > 0 ? `-${displayUsedPoints.toLocaleString()}` : '0'}</TableCell>}
                      <TableCell>
                        {erpCode || (needsMapping ? <Chip size="small" label="미스매칭" color="warning" /> : '-')}
                      </TableCell>
                      <TableCell>
                        {erpName ? erpName : (
                          needsMapping ? (
                            <Button size="small" variant="outlined" color="warning" onClick={() => openMappingModal(order, item)}>
                              수동 연결
                            </Button>
                          ) : '-'
                        )}
                      </TableCell>
                      {idx === 0 && (
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={order.shipping_message} rowSpan={items.length}>
                          {order.shipping_message || '-'}
                        </TableCell>
                      )}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          {order.is_transferred ? <Chip size="small" label="완료" color="success" /> : '미전송'}
                        </TableCell>
                      )}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          <Button size="small" variant="text">주문확인</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                });
                return acc;
              }, [])
            )}
          </TableBody>
        </Table>
      </TableContainer>
          </>
        )}
      </div>

      <div role="tabpanel" hidden={tabValue !== 1}>
        {tabValue === 1 && (
          <Cafe24Settings />
        )}
      </div>

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
