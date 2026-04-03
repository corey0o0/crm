import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, Button, Grid, Paper, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress,
  Chip
} from '@mui/material';
import {
  QrCodeScanner as QrCodeScannerIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import BarcodeScanner from '../BarcodeScanner';

// 임시 모의 출고 데이터 (차후 DB/API 연동)
const MOCK_EXPECTED_ITEMS = [
  { id: 1, name: 'S-Works Tarmac SL8', code: 'SKU-001', barcode: '88881234', expected: 2, scanned: 0 },
  { id: 2, name: 'Allez Sprint Comp', code: 'SKU-002', barcode: '88885678', expected: 1, scanned: 0 },
  { id: 3, name: 'Romin EVO Pro Saddle', code: 'SKU-003', barcode: '88889999', expected: 5, scanned: 0 }
];

function BarcodeInspectTab() {
  const [scanInput, setScanInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [expectedItems, setExpectedItems] = useState(MOCK_EXPECTED_ITEMS);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [alertState, setAlertState] = useState({ show: false, type: 'info', message: '' });
  
  const inputRef = useRef(null);

  // 화면 진입 시 오디오 파일 로드 문제될 수 있으므로 브라우저 알림음 또는 시각적 효과로 대체
  const playSound = (type) => {
    // 향후 실제 오디오 파일 객체로 교체 가능
    console.log(`Playing sound: ${type}`);
  };

  const showAlert = (type, message) => {
    setAlertState({ show: true, type, message });
    setTimeout(() => setAlertState({ show: false, type: 'info', message: '' }), 3000);
  };

  const processBarcode = (barcode) => {
    if (!barcode.trim()) return;
    
    const code = barcode.trim();
    let foundIndex = expectedItems.findIndex(item => item.barcode === code || item.code === code);
    
    if (foundIndex === -1) {
      // 리스트에 없는 상품 스캔 (강력한 경고)
      playSound('error');
      showAlert('error', `오류: 예정 목록에 없는 바코드입니다. (${code})`);
      setLogs(prev => [{ sku: code, time: new Date().toLocaleTimeString(), status: '예정 외/오류', type: 'error' }, ...prev]);
    } else {
      let updatedItems = [...expectedItems];
      let item = updatedItems[foundIndex];
      
      if (item.scanned >= item.expected) {
        // 이미 수량 충족됨 (경고)
        playSound('warning');
        showAlert('warning', `경고: 예정 수량 초과 스캔입니다. (${item.name})`);
        setLogs(prev => [{ sku: item.name, time: new Date().toLocaleTimeString(), status: '수량 초과', type: 'warning' }, ...prev]);
      } else {
        // 정상 스캔
        item.scanned += 1;
        setExpectedItems(updatedItems);
        playSound('success');
        
        let msg = `정상: ${item.name} (${item.scanned}/${item.expected})`;
        if (item.scanned === item.expected) msg += ' - 수량 완료!';
        showAlert('success', msg);
        
        setLogs(prev => [{ sku: item.name, time: new Date().toLocaleTimeString(), status: '정상 스캔', type: 'success' }, ...prev]);
      }
    }
    
    setScanInput(''); // 입력창 초기화
    if (inputRef.current) inputRef.current.focus(); // 포커스 유지
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    processBarcode(scanInput);
  };

  const handleConfirm = () => {
    const isComplete = expectedItems.every(i => i.scanned === i.expected);
    if (isComplete) {
      alert('모든 내역이 정상적으로 검수되었습니다. 출고를 확정합니다.');
      // API call to confirm
    } else {
      if(window.confirm('검수되지 않거나 수량이 맞지 않는 항목이 있습니다. 강제 출고 확정하시겠습니까?')) {
        // API call to force confirm
      }
    }
  };

  // 진행률 계산
  const totalExpected = expectedItems.reduce((acc, cur) => acc + cur.expected, 0);
  const totalScanned = expectedItems.reduce((acc, cur) => acc + cur.scanned, 0);
  const progressPercent = totalExpected === 0 ? 0 : Math.min((totalScanned / totalExpected) * 100, 100);

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">출고/이동 검수 화면 (B창고 → C창고)</Typography>
              <Typography variant="body2" color="text.secondary">
                출고 지시서: ORD-20231024-001 (데모)
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h5" color="primary" fontWeight="bold">
                진행률: {totalScanned} / {totalExpected}
              </Typography>
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

      <Grid container spacing={2}>
        {/* 스캔 컨트롤 영역 */}
        <Grid item xs={12} md={5}>
          <Paper 
            sx={{ 
              p: 3, 
              bgcolor: alertState.show 
                ? alertState.type === 'error' ? '#ffebee' : alertState.type === 'warning' ? '#fff3e0' : '#e8f5e9'
                : '#f5f5f5', 
              textAlign: 'center', 
              mb: 2,
              transition: 'background-color 0.3s'
            }}
          >
            <Typography variant="h5" sx={{ mb: 2, color: alertState.show ? alertState.type + '.main' : 'text.primary', fontWeight: 'bold' }}>
              {alertState.show ? alertState.message : '스캐너 대기 중'}
            </Typography>
            
            <form onSubmit={handleScanSubmit}>
              <TextField 
                inputRef={inputRef}
                fullWidth 
                autoFocus
                placeholder="USB 스캐너를 사용하여 바코드를 읽어주세요" 
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
              휴대폰 / 태블릿 카메라 스캔 켜기
            </Button>
          </Paper>

          {/* 스캔 로그 (직전 기록들) */}
          <Paper sx={{ p: 2, maxHeight: 350, overflowY: 'auto' }}>
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

        {/* 검수 대조표 영역 */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>실시간 검수 대조표</Typography>
            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell>상품명</TableCell>
                    <TableCell>바코드</TableCell>
                    <TableCell align="center">지시 수량</TableCell>
                    <TableCell align="center">스캔 수량</TableCell>
                    <TableCell align="center">상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expectedItems.map((item) => {
                    const isComplete = item.scanned === item.expected;
                    const isOver = item.scanned > item.expected;
                    return (
                      <TableRow key={item.id} sx={{ bgcolor: isComplete ? '#f1f8e9' : isOver ? '#ffebee' : 'inherit' }}>
                        <TableCell sx={{ fontWeight: isComplete ? 'bold' : 'normal' }}>{item.name}</TableCell>
                        <TableCell>{item.barcode}</TableCell>
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
              <Button variant="contained" color="primary" size="large" onClick={handleConfirm}>
                출고/검수 확정
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* 모바일 카메라 스캐너 */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          if (inputRef.current) inputRef.current.focus();
        }}
        onScan={(code) => {
          setScanInput(code);
          processBarcode(code);
        }}
        onError={(err) => {
          console.error(err);
        }}
      />
    </Box>
  );
}

export default BarcodeInspectTab;
