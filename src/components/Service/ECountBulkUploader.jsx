import React, { useState, useRef } from 'react';
import {
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  LinearProgress
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { readExcelFile } from '../../utils/excelUtils';
import { processServiceCompletion } from '../../utils/inventoryUtils';

const ECountBulkUploader = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const fileInputRef = useRef(null);

  const [confirmDialog, setConfirmDialog] = useState(false);
  const [parsedData, setParsedData] = useState([]);

  // 거래처명 추출 후 agency_id 매핑용
  const fetchAgencies = async () => {
    const { data } = await supabase.from('agencies').select('id, name');
    return data || [];
  };

  // 품목명 매핑용
  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('id, name, code');
    return data || [];
  };
  
  // 창고 맵핑 로직 (이카운트 창고명 -> DB warehouse_id)
  const fetchWarehouses = async () => {
      const { data } = await supabase.from('warehouses').select('id, name');
      return data || [];
  };

  const showMessage = (msg, severity = 'info') => {
    setSnackbarMessage(msg);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      setLoading(true);
      showMessage('파일을 읽는 중입니다...', 'info');

      // ExcelJS (readExcelFile) accepts XLSX and implicitly falls back or fails on CSV.
      // ECount files are often downloaded as .csv, but ExcelJS can actually read csv if configured, 
      // however our readExcelFile utility uses workbook.xlsx.load which might throw on strict CSV.
      // We will try standard readExcelFile first. If users upload CSV, they should resave as XLSX.
      let jsonRows = [];
      try {
        jsonRows = await readExcelFile(file);
      } catch (err) {
        throw new Error('엑셀 파싱 실패. 이카운트에서 다운로드 후 엑셀(xlsx) 형식으로 저장해서 다시 올려주세요.');
      }

      if (!jsonRows || jsonRows.length === 0) {
        throw new Error('데이터가 비어있습니다.');
      }

      setParsedData(jsonRows);
      setConfirmDialog(true);
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoading(false);
    }
  };

  const executeMigration = async () => {
    try {
      setConfirmDialog(false);
      setLoading(true);
      setProgress(0);

      const agencies = await fetchAgencies();
      const parts = await fetchParts();
      const warehouses = await fetchWarehouses();

      // 1. 데이터 그룹핑: 일자-No. 통일성을 위해
      // 이카운트 csv 예시: '일자-No.', '거래처명', '품목명(규격)', '합계', '창고명', '수량', '단가'
      const groupedData = {};

      parsedData.forEach(row => {
        // 일자-No. 키 우선, 없으면 주문번호 우선
        const key = row['일자-No.'] || row['주문번호'];
        if (!key) return; // 무효 라인 건너뛰기

        if (!groupedData[key]) {
          groupedData[key] = {
            dateNumber: row['일자-No.'],
            orderNumber: row['주문번호'],
            agencyName: row['거래처명'],
            projectName: row['프로젝트명'],
            items: []
          };
        }
        groupedData[key].items.push(row);
      });

      const groupKeys = Object.keys(groupedData);
      let successCount = 0;

      for (let i = 0; i < groupKeys.length; i++) {
        const group = groupedData[groupKeys[i]];
        
        // 1. Agency 매핑
        let agencyId = null;
        if (group.agencyName) {
           const matchedAgency = agencies.find(a => group.agencyName.includes(a.name) || a.name.includes(group.agencyName));
           if (matchedAgency) agencyId = matchedAgency.id;
        }

        // 2. 브랜드 추정
        let brand = 'XRB';
        if (group.projectName?.includes('NB')) brand = 'NB';

        // 3. 총합계
        const totalPriceText = group.items.reduce((sum, item) => sum + (parseFloat(String(item['합계']||'0').replace(/,/g, '')) || 0), 0);
        
        // 날짜 파싱 (2025/11/30 -1 -> 2025-11-30)
        let recDate = new Date().toISOString().split('T')[0];
        if (group.dateNumber) {
            const dateMatch = group.dateNumber.match(/^(\d{4}\/\d{2}\/\d{2})/);
            if (dateMatch) recDate = dateMatch[1].replace(/\//g, '-');
        }

        // 서비스(매출) 생성
        const serviceData = {
          brand,
          reception_date: recDate,
          customer_name: group.agencyName || '이카운트 고객',
          agency_id: agencyId, // 거래처 ID 맵핑
          symptom: '단순 판매 (Ecount 업로드)',
          status: '완료',
          is_simple_sale: true,
          price: parseInt(totalPriceText),
          note: group.orderNumber ? `주문번호: ${group.orderNumber}` : `이카운트 No. ${group.dateNumber}`,
          created_at: new Date().toISOString()
        };

        const { data: insertedService, error: serviceError } = await supabase
          .from('services')
          .insert([serviceData])
          .select()
          .single();

        if (serviceError) {
          console.error('Service Insert Error', serviceError);
          continue; // 실패 시 다음 건 진행
        }

        const serviceId = insertedService.id;

        // 부품 및 재고 처리 준비
        const partsToProcess = [];

        for (const item of group.items) {
          const rawName = item['품목명(규격)'] || item['품목명(요약)'];
          if (!rawName || rawName === '배송비') continue;

          let matchedPartId = null;
          // 이름 매칭
          const matchedPart = parts.find(p => rawName.includes(p.name) || (p.code && rawName.includes(p.code)));
          if (matchedPart) {
            matchedPartId = matchedPart.id;
          }

          // 창고 맵핑 (이카운트 창고 -> 시스템 창고)
          let warehouseId = null;
          const warehouseName = item['창고명'];
          if (warehouseName) {
              const matchedWh = warehouses.find(w => warehouseName.includes(w.name) || w.name.includes(warehouseName));
              if (matchedWh) warehouseId = matchedWh.id;
          }

          // 단가, 수량 파싱
          const qty = parseInt(String(item['수량']).replace(/,/g, '')) || 1;
          const uPrice = parseInt(String(item['공급가액'] || item['합계'] || '0').replace(/,/g, '')) || 0; // 이카운트는 부가세 별도/포함 혼합이므로 적당히 합계 또는 공급가로

          // service_parts Insert
          const servicePartData = {
            service_id: serviceId,
            part_id: matchedPartId,
            part_name: rawName, // 미등록 부품일 경우 표시용
            price: uPrice,
            quantity: qty,
            total_price: uPrice * qty,
            warehouse_id: warehouseId // 창고 직접 지정 (선택사항)
          };

          const { data: insertedPart, error: partError } = await supabase
            .from('service_parts')
            .insert([servicePartData])
            .select()
            .single();

          if (!partError && insertedPart) {
             // processServiceCompletion를 위한 객체 구성
             partsToProcess.push({
               ...insertedPart,
               id: insertedPart.id,
               part_id: insertedPart.part_id,
               quantity: insertedPart.quantity,
               part_name: rawName,
               // 만약 창고가 있으면 지정된 창고에서 출고되게 하려면 inventoryUtils가 지원해야 함.
               // 현재 CRM은 processServiceCompletion에서 재고 차감 로직을 수행할 때 
               // part_id, quantity, record_id (service.id) 등을 전달함.
             });
          }
        }

        // 재고 차감 (processServiceCompletion)
        if (partsToProcess.length > 0) {
           await processServiceCompletion(serviceId, partsToProcess, user?.id || null);
        }

        successCount++;
        setProgress(Math.round(((i + 1) / groupKeys.length) * 100));
      }

      showMessage(`총 ${groupKeys.length}개 그룹 중 ${successCount}건 업로드 성공!`, 'success');
      if (onUploadSuccess) onUploadSuccess();

    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        component="label"
        variant="outlined"
        startIcon={<CloudUploadIcon />}
        disabled={loading}
        sx={{ mr: 1, borderColor: '#4caf50', color: '#4caf50', '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.04)' } }}
      >
        이카운트 엑셀 업로드
        <input
          type="file"
          hidden
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          ref={fileInputRef}
        />
      </Button>

      {/* 확인 및 진행 다이얼로그 */}
      <Dialog open={confirmDialog} onClose={!loading ? () => setConfirmDialog(false) : undefined}>
        <DialogTitle>이카운트 매출 일괄 등록</DialogTitle>
        <DialogContent>
          {loading ? (
             <Box sx={{ width: '100%', mt: 2 }}>
               <Typography variant="body2" gutterBottom>
                 {progress}% 진행 중... (창을 닫지 마세요)
               </Typography>
               <LinearProgress variant="determinate" value={progress} />
             </Box>
          ) : (
            <Typography variant="body1" sx={{ mt: 1 }}>
              파싱된 엑셀 데이터 <b>{parsedData.length}줄</b>을 바탕으로 <br />
              매출 장부와 입출고 재고 차감 기록을 일괄 생성하시겠습니까?<br/><br/>
              <b>경고: 이 작업은 대량의 DB를 수정하므로 실행 후 복구가 어렵습니다.</b>
            </Typography>
          )}
        </DialogContent>
        {!loading && (
          <DialogActions>
            <Button onClick={() => setConfirmDialog(false)} color="inherit">취소</Button>
            <Button onClick={executeMigration} color="error" variant="contained">
              일괄 생성 (매출+재고)
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <Snackbar 
        open={openSnackbar} 
        autoHideDuration={6000} 
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ECountBulkUploader;
