import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Alert, Snackbar, Stack,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { readExcelFile } from '../../utils/excelUtils';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

export default function EcountDataUploader() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [warehouses, setWarehouses] = useState([]);
  const [manualWarehouseId, setManualWarehouseId] = useState('');
  const [agencies, setAgencies] = useState([]);
  const { user } = useAuth();

  React.useEffect(() => {
    async function fetchBaseData() {
      const [{ data: wData }, { data: aData }] = await Promise.all([
        supabase.from('warehouses').select('id, name'),
        supabase.from('agencies').select('id, name')
      ]);
      if (wData) setWarehouses(wData);
      if (aData) setAgencies(aData);
    }
    fetchBaseData();
  }, []);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setPreviewData([]);
    setDuplicateCount(0);

    try {
      // 엑셀 파싱
      const rawData = await readExcelFile(selectedFile);
      if (!rawData || rawData.length === 0) {
        throw new Error("데이터가 비어있거나 올바르지 않은 양식입니다.");
      }

      // 1. 전체 Parts DB 룩업 맵핑용으로 미리 불러오기 (비고 필드가 카테고리로 쓰임)
      const { data: dbParts, error: partsErr } = await supabase.from('parts').select('id, name, code, barcode, brand, note');
      if (partsErr) throw partsErr;

      // 그룹화 및 매핑 로직 (Ecount 방식: 일자-No. 와 거래처 기준)
      const grouped = {};
      rawData.forEach((row, idx) => {
        // 필수 헤더 및 바코드 정보
        const dateNo = row['일자-No.'] || row['일자'] || '';
        const customer = row['거래처명'] || row['거래처'] || '미상 거래처';
        const partName = row['품목명(규격)'] || row['품목명'] || `품목-${idx}`;
        const excelCode = row['품목코드'] || row['상품코드'] || '';
        const excelBarcode = row['바코드'] || '';
        
        const qty = Number(row['수량'] || 1);
        const price = Number(row['단가'] || 0);
        const total = Number(row['합계'] || (qty * price));
        const xlWarehouseName = row['출하창고'] || row['창고'] || row['출고지'] || '';
        const noteInfo = `[주문:${row['주문번호'] || ''}] [프로젝트:${row['프로젝트명'] || ''}]`;

        // 날짜 추출 (YYYY-MM-DD-No 에서 앞 3 덩어리)
        let orderDate = '';
        if (dateNo.includes('-')) {
          const parts = dateNo.split('-');
          if (parts.length >= 3) {
            orderDate = parts.slice(0, 3).join('-');
          } else {
             orderDate = dateNo;
          }
        } else {
           orderDate = dateNo.substring(0, 10);
        }

        // 유효한 날짜가 없으면 현재 날짜로 폴백
        if (orderDate.length < 8) {
           orderDate = new Date().toISOString().split('T')[0];
        }

        const groupKey = `${orderDate}_${customer}_${dateNo}`;

        // 바코드/품목코드 기반 DB 매핑 시도
        let finalBrand = 'XRB'; // 기본값
        let finalCategory = '기타';
        let finalCode = excelCode || excelBarcode;

        const matchedPart = dbParts.find(p => 
           (excelCode && (p.code === excelCode || p.barcode === excelCode)) ||
           (excelBarcode && (p.barcode === excelBarcode || p.code === excelBarcode)) ||
           (p.name && partName && p.name.includes(partName)) // 이름으로도 부분 일치 시도 (옵션)
        );

        if (matchedPart) {
           finalBrand = matchedPart.brand || 'XRB';
           finalCategory = matchedPart.note || '기타';
           finalCode = matchedPart.code;
        } else {
           // 매핑 실패 시 이름 기반 단순 추정 폴백
           if (partName.toUpperCase().includes('NB') || partName.includes('니어')) { finalBrand = 'NEARBIKE'; }
           if (partName.includes('파츠') || partName.includes('부품')) { finalCategory = '부품'; }
        }

        if (!grouped[groupKey]) {
           let matchedWh = null;
           if (xlWarehouseName && warehouses.length > 0) {
              matchedWh = warehouses.find(w => w.name.includes(xlWarehouseName) || xlWarehouseName.includes(w.name));
           }
           grouped[groupKey] = {
             order_date: orderDate,
             customer_name: customer,
             note: noteInfo.trim(),
             brand: finalBrand, // 첫 번째 발견된 제품의 브랜드 대표
             excel_warehouse_id: matchedWh ? matchedWh.id : null,
             total_price: 0,
             parts: []
           };
        }

        grouped[groupKey].parts.push({
           part_name: partName,
           part_code: finalCode,
           part_category: finalCategory,
           quantity: qty,
           price: price,
           total_price: total
        });
        grouped[groupKey].total_price += total;
      });

      const parsedPreview = Object.values(grouped);

      // 전체 기존 데이터 중복 검사를 위한 쿼리
      const { data: existingShipments, error: dbError } = await supabase
        .from('shipments')
        .select('order_date, customer_name, price')
        .eq('status', '출고완료');

      if (dbError) throw dbError;

      // 간단한 중복 체크 로직 (날짜, 고객명, 총액이 동일하면 중복으로 간주)
      let dupCount = 0;
      parsedPreview.forEach(item => {
         const isDup = existingShipments.some(existing => 
            existing.order_date === item.order_date &&
            existing.customer_name === item.customer_name &&
            Number(existing.price || 0) === Number(item.total_price)
         );
         item.isDuplicate = isDup;
         if (isDup) dupCount++;
      });

      setPreviewData(parsedPreview);
      setDuplicateCount(dupCount);

    } catch (e) {
      console.error(e);
      setSnackbar({ open: true, message: `파일 파싱 오류: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const executeUpload = async () => {
    if (previewData.length === 0) return;
    const toUpload = previewData.filter(d => !d.isDuplicate);
    if (toUpload.length === 0) {
      setSnackbar({ open: true, message: '업로드할 새로운 (중복되지 않은) 데이터가 없습니다.', severity: 'warning' });
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      // 청크 단위 삽입 대신, 안정성을 위해 하나씩 또는 소규모 청크로 Insert 진행
      for (const item of toUpload) {
         // 대리점 고객인 경우 판매처를 대리점 이름으로 할당 (B2B 출고 인식용)
         const isAgency = agencies.some(a => a.name === item.customer_name || item.customer_name.includes(a.name) || a.name.includes(item.customer_name));
         const finalSalesChannel = isAgency ? item.customer_name : '과거 이카운트 이관';

         // 1. Shipment 기록 생성
         const shipmentData = {
           brand: item.brand,
           order_date: item.order_date,
           shipment_date: item.order_date,
           status: '출고완료',
           customer_name: item.customer_name,
           note: `[과거 이카운트 이관] ${item.note}`,
           sales_channel: finalSalesChannel, // 대리점 여부에 따라 자동 적용
           price: item.total_price,
           warehouse_id: manualWarehouseId || item.excel_warehouse_id || null
         };

         const { data: newShipment, error: insertError } = await supabase
           .from('shipments')
           .insert([shipmentData])
           .select('id')
           .single();

         if (insertError) {
           console.error("출고 기록 에러:", insertError);
           continue; 
         }

         const shipmentId = newShipment.id;

         // 2. Shipment Parts 기록 생성
         if (item.parts && item.parts.length > 0) {
           const partsData = item.parts.map(p => ({
             shipment_id: shipmentId,
             part_name: p.part_name,
             part_code: p.part_code || '',
             quantity: p.quantity,
             price: p.price,
             total_price: p.total_price
           }));

           const { error: partErr } = await supabase.from('shipment_parts').insert(partsData);
           if (partErr) console.error("부품 등록 에러:", partErr);
         }
         successCount++;
      }

      setSnackbar({ open: true, message: `성공적으로 ${successCount}건의 과거 출고 내역을 동기화했습니다!`, severity: 'success' });
      setFile(null);
      setPreviewData([]);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: `업로드 중 오류: ${err.message}`, severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" mb={2}>과거 이카운트(Ecount) 매출 연동</Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        과거 이카운트의 전표 데이터를 엑셀로 업로드하여 장부에 동기화합니다.<br/>
        <b>[매출 꼬임 방지 장치 적용됨]</b> 중복 건은 자동으로 무시되며, 데이터에는 특별 태그가 부착되어 기존 재고 수량을 차감하지 않습니다.
      </Alert>

      <Stack direction="row" spacing={2} mb={3} alignItems="center">
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>일괄 적용 출고창고 (선택)</InputLabel>
          <Select
            value={manualWarehouseId}
            label="일괄 적용 출고창고 (선택)"
            onChange={(e) => setManualWarehouseId(e.target.value)}
          >
            <MenuItem value=""><em>엑셀 원본 값 사용(없을시 미지정)</em></MenuItem>
            {warehouses.map(w => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={loading || uploading}>
          이카운트 엑셀 업로드
          <input type="file" hidden accept=".xlsx, .csv" onChange={handleFileChange} />
        </Button>
        {loading && <CircularProgress size={24} sx={{ mt: 1 }} />}
      </Stack>

      {file && <Typography variant="body2" sx={{ mb: 2 }}>선택된 파일: {file.name}</Typography>}

      {previewData.length > 0 && (
        <Box>
           <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
             <Typography variant="subtitle1" fontWeight="bold">모의 업로드 분석 리포트</Typography>
             <Typography variant="body2">총 발견된 그룹(전표): <b>{previewData.length}</b>건</Typography>
             <Typography variant="body2" color="error">기존 시스템 중복 예상 건: <b>{duplicateCount}</b>건 (무시됨)</Typography>
             <Typography variant="body2" color="primary">실제 신규 등록 대기 건: <b>{previewData.length - duplicateCount}</b>건</Typography>
             
             <Button 
                variant="contained" 
                color="primary" 
                startIcon={<PlayArrowIcon />} 
                onClick={executeUpload}
                disabled={uploading || previewData.length - duplicateCount === 0}
                sx={{ mt: 2 }}
             >
               {uploading ? '동기화 진행 중...' : '안전 동기화 (최종 업로드) 시작'}
             </Button>
           </Paper>

           <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
             <Table stickyHeader size="small">
               <TableHead>
                 <TableRow>
                   <TableCell>주문날짜</TableCell>
                   <TableCell>거래처(고객명)</TableCell>
                   <TableCell>상세 품목 (상품명, 코드, 수량)</TableCell>
                   <TableCell align="right">합산금액</TableCell>
                   <TableCell>상태</TableCell>
                 </TableRow>
               </TableHead>
               <TableBody>
                 {previewData.map((row, idx) => (
                   <TableRow key={idx} sx={{ bgcolor: row.isDuplicate ? '#ffebee' : 'inherit' }}>
                     <TableCell>{row.order_date}</TableCell>
                     <TableCell>{row.customer_name}</TableCell>
                     <TableCell>
                       {row.parts && row.parts.map((p, i) => (
                         <Typography key={i} variant="body2" sx={{ fontSize: '0.75rem' }}>
                           • {p.part_name} <span style={{ color: '#666' }}>[{p.part_code || '미지정'}]</span> : <b>{p.quantity}개</b>
                         </Typography>
                       ))}
                     </TableCell>
                     <TableCell align="right">{row.total_price.toLocaleString()}원</TableCell>
                     <TableCell>
                       {row.isDuplicate ? 
                         <Typography color="error" variant="caption">중복(건너뜀)</Typography> : 
                         <Typography color="primary" variant="caption">신규등록</Typography>}
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </TableContainer>
        </Box>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
