import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Box, Grid, Card, CardContent, Typography, TextField, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Paper, Divider, List, 
  ListItemButton, Chip, LinearProgress, Checkbox
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import BarcodeScanner from '../BarcodeScanner';
import { pendingOutboundApi } from '../../../api/pendingOutboundApi';

function StoreOnlineOutboundTab() {
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [alertState, setAlertState] = useState({ show: false, type: 'info', message: '' });
  
  const inputRef = useRef(null);

  const fetchData = async () => {
    try {
      const data = await pendingOutboundApi.getAll();
      const formatted = data.map(d => ({
        id: d.id,
        orderNo: d.order_no,
        type: d.type,
        date: new Date(d.created_at).toLocaleString(),
        status: d.status,
        items: (d.items || []).map(i => ({
          id: i.id,
          name: i.name,
          code: i.code,
          barcode: i.barcode,
          expected: i.expected_qty,
          scanned: i.scanned_qty
        }))
      })).filter(o => o.status !== '완료' && o.status !== '취소'); // 진행/대기만 표시
      
      setOrders(formatted);
    } catch (e) {
      console.error(e);
      showAlert('error', '대기열 데이터를 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleOrder = (order) => {
    setSelectedOrders(prev => {
      const isSelected = prev.some(o => o.id === order.id);
      if (isSelected) {
        return prev.filter(o => o.id !== order.id);
      } else {
        return [...prev, JSON.parse(JSON.stringify(order))];
      }
    });
    setLogs([]);
    setAlertState({ show: false, type: 'info', message: '' });
  };

  const showAlert = (type, message) => {
    setAlertState({ show: true, type, message });
    setTimeout(() => setAlertState({ show: false, type: 'info', message: '' }), 3000);
  };

  const processBarcode = (barcode) => {
    if (!barcode.trim() || selectedOrders.length === 0) return;
    
    const code = barcode.trim();
    let skuName = '';
    
    const newOrders = [...selectedOrders];
    let allocated = false;
    let overScannedItemMap = null;
    
    for (let oIndex = 0; oIndex < newOrders.length; oIndex++) {
      const order = newOrders[oIndex];
      const item = order.items.find(i => (i.barcode === code || i.code === code));
      if (item) {
        skuName = item.name;
        if (item.scanned < item.expected) {
          item.scanned += 1;
          allocated = true;
          break;
        } else if (!overScannedItemMap) {
          overScannedItemMap = { orderIndex: oIndex, item };
        }
      }
    }

    if (allocated) {
      setSelectedOrders(newOrders);
      showAlert('success', `정상: ${skuName} 스캔됨`);
      setLogs(prev => [{ sku: skuName, time: new Date().toLocaleTimeString(), status: '정상 스캔', type: 'success' }, ...prev]);
    } else if (overScannedItemMap) {
      overScannedItemMap.item.scanned += 1;
      setSelectedOrders(newOrders);
      showAlert('warning', `경고: 예정 수량 초과 스캔입니다. (${skuName})`);
      setLogs(prev => [{ sku: skuName, time: new Date().toLocaleTimeString(), status: '수량 초과', type: 'warning' }, ...prev]);
    } else {
      showAlert('error', `오류: 스캔 대기열 내역 중에 없는 상품입니다. (${code})`);
      setLogs(prev => [{ sku: code, time: new Date().toLocaleTimeString(), status: '예정 외/오류', type: 'error' }, ...prev]);
    }
    
    setScanInput('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    processBarcode(scanInput);
  };

  const handleConfirm = async () => {
    if (selectedOrders.length === 0) return;
    
    const isComplete = selectedOrders.every(order => 
      order.items.every(i => i.scanned === i.expected)
    );
    
    const confirmMsg = isComplete 
      ? `선택된 ${selectedOrders.length}건의 출고를 확정하시겠습니까?`
      : '검수되지 않거나 수량이 맞지 않는 항목이 있습니다. 강제 확정/출고하시겠습니까?';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      for (const order of selectedOrders) {
        await pendingOutboundApi.updateScannedItems(order.items);
        await pendingOutboundApi.updateStatus(order.id, '완료');
      }
      
      alert(`출고가 확정되었습니다.`);
      const completedIds = selectedOrders.map(o => o.id);
      setOrders(orders.filter(o => !completedIds.includes(o.id)));
      setSelectedOrders([]);
    } catch (error) {
      console.error(error);
      showAlert('error', '출고 확정 중 오류가 발생했습니다.');
    }
  };

  // 선택된 주문들의 품목을 병합 (UI에 렌더링하기 위함)
  const mergedItems = useMemo(() => {
    const map = new Map();
    selectedOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.barcode || item.code || item.name;
        if (!map.has(key)) {
          map.set(key, { ...item });
        } else {
          const merged = map.get(key);
          merged.expected += item.expected;
          merged.scanned += item.scanned;
        }
      });
    });
    return Array.from(map.values());
  }, [selectedOrders]);

  const totalExpected = mergedItems.reduce((acc, cur) => acc + cur.expected, 0);
  const totalScanned = mergedItems.reduce((acc, cur) => acc + cur.scanned, 0);
  const progressPercent = totalExpected === 0 ? 0 : Math.min((totalScanned / totalExpected) * 100, 100);

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>출고 대기열 통합 다중 검수</Typography>
      
      <Grid container spacing={3}>
        {/* 좌측: 출고 대기열 (Pending Orders) */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ height: 'calc(100vh - 200px)', minHeight: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">출고 대기열 ({orders.length}건)</Typography>
              {selectedOrders.length > 0 && (
                <Typography variant="body2" fontWeight="bold">({selectedOrders.length}건 선택됨)</Typography>
              )}
            </Box>
            <List sx={{ p: 0 }}>
              {orders.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">대기 중인 출고 요청이 없습니다.</Typography>
                </Box>
              )}
              {orders.map((order) => {
                const isSelected = selectedOrders.some(o => o.id === order.id);
                return (
                  <React.Fragment key={order.id}>
                    <ListItemButton 
                      onClick={() => handleToggleOrder(order)}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        p: 2, 
                        borderLeft: isSelected ? '4px solid #1976d2' : '4px solid transparent',
                        bgcolor: isSelected ? 'rgba(25, 118, 210, 0.04)' : 'transparent'
                      }}
                    >
                      <Checkbox 
                        checked={isSelected}
                        disableRipple
                        sx={{ p: 0, mr: 1, mt: 0.5 }}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Chip 
                            size="small" 
                            label={order.type} 
                            color={order.type.includes('AS') ? 'warning' : order.type.includes('온라인') ? 'info' : 'default'} 
                          />
                          <Typography variant="caption" color="text.secondary">{order.date}</Typography>
                        </Box>
                        <Typography variant="body1" fontWeight="bold">{order.orderNo}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>품목: {order.items.length}종 / 총 수량: {order.items.reduce((a,c)=>a+c.expected_qty || c.expected, 0)}개</Typography>
                      </Box>
                    </ListItemButton>
                    <Divider />
                  </React.Fragment>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* 우측: 바코드 검수 대시보드 */}
        <Grid item xs={12} md={9}>
          {selectedOrders.length === 0 ? (
            <Paper sx={{ height: 'calc(100vh - 200px)', minHeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f9f9f9' }}>
              <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                <QrCodeScannerIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6">좌측에서 확인/검수할 출고건을 하나 이상 선택하세요.</Typography>
              </Box>
            </Paper>
          ) : (
            <Box sx={{ height: 'calc(100vh - 200px)', minHeight: 600, display: 'flex', flexDirection: 'column', gap: 2 }}>
              
              {/* 상단 요약 바 */}
              <Card>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">동시 검수 진행 중 ({selectedOrders.length}건)</Typography>
                      <Typography variant="body2" color="text.secondary">선택된 모든 지시서의 품목이 아래에 통합되어 표시됩니다.</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h5" color="primary" fontWeight="bold">진행률: {totalScanned} / {totalExpected}</Typography>
                    </Box>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={progressPercent} 
                    sx={{ height: 10, borderRadius: 5, mb: 1 }} 
                    color={progressPercent === 100 ? "success" : "primary"}
                  />
                </CardContent>
              </Card>

              {/* 입력 및 검수 내역 영역 */}
              <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                
                {/* 좌측 서브: 스캐너 입력 폼 & 최신 스캔 로그 */}
                <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Paper 
                    sx={{ 
                      p: 3, 
                      bgcolor: alertState.show 
                        ? alertState.type === 'error' ? '#ffebee' : alertState.type === 'warning' ? '#fff3e0' : '#e8f5e9'
                        : '#f5f5f5', 
                      textAlign: 'center', 
                      transition: 'background-color 0.3s'
                    }}
                  >
                    <Typography variant="h6" sx={{ mb: 2, color: alertState.show ? alertState.type + '.main' : 'text.primary', fontWeight: 'bold' }}>
                      {alertState.show ? alertState.message : '스캐너 대기 중'}
                    </Typography>
                    
                    <form onSubmit={handleScanSubmit}>
                      <TextField 
                        inputRef={inputRef}
                        fullWidth 
                        autoFocus
                        placeholder="바코드를 스캔하세요" 
                        value={scanInput} 
                        onChange={e => setScanInput(e.target.value)} 
                        inputProps={{ style: { fontSize: 20, textAlign: 'center', letterSpacing: 2 } }}
                        autoComplete="off"
                      />
                    </form>
                    
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      size="large" 
                      startIcon={<QrCodeScannerIcon />}
                      sx={{ mt: 2 }}
                      onClick={() => setScannerOpen(true)}
                    >
                      카메라 스캔 (휴대폰/태블릿)
                    </Button>
                  </Paper>

                  <Paper sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>최근 스캔 기록</Typography>
                    {logs.length === 0 && <Typography variant="body2" color="text.secondary" align="center">스캔 내역이 없습니다.</Typography>}
                    {logs.map((log, i) => (
                      <Box key={i} sx={{ p: 1, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{log.sku}</Typography>
                          <Typography variant="caption" color="text.secondary">{log.time}</Typography>
                        </Box>
                        <Chip 
                          size="small" 
                          label={log.status} 
                          color={log.type} 
                          icon={log.type === 'success' ? <CheckCircleIcon /> : log.type === 'error' ? <ErrorIcon /> : <WarningIcon />}
                        />
                      </Box>
                    ))}
                  </Paper>
                </Grid>

                {/* 우측 서브: 품목 리스트 및 진행 현황 */}
                <Grid item xs={12} md={7}>
                  <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>검수 대상 통합 품목 리스트</Typography>
                    <TableContainer sx={{ flexGrow: 1 }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                          <TableRow>
                            <TableCell>상품명</TableCell>
                            <TableCell>바코드</TableCell>
                            <TableCell align="center">통합 지시수량</TableCell>
                            <TableCell align="center">현재 스캔수량</TableCell>
                            <TableCell align="center">상태</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {mergedItems.map((item, idx) => {
                            const isComplete = item.scanned === item.expected;
                            const isOver = item.scanned > item.expected;
                            return (
                              <TableRow key={idx} sx={{ bgcolor: isComplete ? '#f1f8e9' : isOver ? '#ffebee' : 'inherit' }}>
                                <TableCell sx={{ fontWeight: isComplete ? 'bold' : 'normal' }}>{item.name}</TableCell>
                                <TableCell>{item.barcode || item.code}</TableCell>
                                <TableCell align="center" sx={{ fontSize: '1.1rem' }}>{item.expected}</TableCell>
                                <TableCell align="center" sx={{ fontSize: '1.2rem', fontWeight: 'bold', color: isComplete ? 'success.main' : isOver ? 'error.main' : 'primary.main' }}>
                                  {item.scanned}
                                </TableCell>
                                <TableCell align="center">
                                  {isComplete ? (
                                    <Chip size="small" label="일치" color="success" />
                                  ) : isOver ? (
                                    <Chip size="small" label="초과" color="error" />
                                  ) : item.scanned > 0 ? (
                                    <Chip size="small" label="진행중" color="primary" />
                                  ) : (
                                    <Chip size="small" label="대기" variant="outlined" />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                      <Button variant="outlined" onClick={() => setSelectedOrders([])}>선택 취소</Button>
                      <Button variant="contained" color="primary" size="large" onClick={handleConfirm} disabled={totalScanned === 0}>
                        선택건 출고 확정
                      </Button>
                    </Box>
                  </Paper>
                </Grid>

              </Grid>
            </Box>
          )}
        </Grid>
      </Grid>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => { setScannerOpen(false); if (inputRef.current) inputRef.current.focus(); }}
        onScan={(code) => { setScanInput(code); processBarcode(code); }}
        onError={(err) => console.error(err)}
      />
    </Box>
  );
}

export default StoreOnlineOutboundTab;
