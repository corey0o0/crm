import React, { useState, useRef, useEffect } from 'react';
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
  LinearProgress,
  Autocomplete,
  TextField,
  Divider,
  Paper,
  Grid
} from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { readExcelFile } from '../../utils/excelUtils';
import { processServiceCompletion } from '../../utils/inventoryUtils';
import { useAuth } from '../../contexts/AuthContext';

const ECountBulkUploader = ({ onUploadSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const fileInputRef = useRef(null);

  // States for processing
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [mappingDialog, setMappingDialog] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [groupedDataKeys, setGroupedDataKeys] = useState([]);
  const [groupedDataCache, setGroupedDataCache] = useState({});

  // States for DB data
  const [dbParts, setDbParts] = useState([]);
  const [dbAgencies, setDbAgencies] = useState([]);
  const [dbWarehouses, setDbWarehouses] = useState([]);

  // States for mapping
  const [missingParts, setMissingParts] = useState([]); // List of unmatched part names
  const [mappingChoices, setMappingChoices] = useState({}); // { 'rawName': 'part_id' or null }

  useEffect(() => {
    // 맵핑 UI가 닫힐 때 선택 상태 초기화
    if (!mappingDialog && !confirmDialog) {
      setMissingParts([]);
      setMappingChoices({});
    }
  }, [mappingDialog, confirmDialog]);

  const showMessage = (msg, severity = 'info') => {
    setSnackbarMessage(msg);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const fetchDependencies = async () => {
    const [partsRes, agenciesRes, whRes] = await Promise.all([
      supabase.from('parts').select('id, name, code'),
      supabase.from('agencies').select('id, name'),
      supabase.from('warehouses').select('id, name')
    ]);
    const parts = partsRes?.data || [];
    setDbParts(parts);
    setDbAgencies(agenciesRes?.data || []);
    setDbWarehouses(whRes?.data || []);
    return { parts };
  };

  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      setLoading(true);
      showMessage('파일을 읽는 중입니다...', 'info');

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
      
      // 의존성 데이터 불러오기
      const { parts } = await fetchDependencies();

      // 그룹핑 및 매칭 분석
      const groupedData = {};
      const missingSet = new Set();

      jsonRows.forEach(row => {
        const key = row['일자-No.'] || row['주문번호'];
        if (!key) return;

        if (!groupedData[key]) {
          // 날짜 파싱: 일자-No. 의 앞쪽 날짜 부분 추출
          let recDate = new Date().toISOString().split('T')[0];
          const dateNumber = row['일자-No.'];
          if (dateNumber) {
            const dateMatch = dateNumber.match(/^(\d{4}\/\d{2}\/\d{2})/);
            if (dateMatch) {
              recDate = dateMatch[1].replace(/\//g, '-');
            }
          }

          groupedData[key] = {
            dateNumber: row['일자-No.'],
            parsedDate: recDate,
            orderNumber: row['주문번호'],
            agencyName: row['거래처명'],
            projectName: row['프로젝트명'],
            items: []
          };
        }
        groupedData[key].items.push(row);

        // 부품 매칭 분석
        const rawName = row['품목명(규격)'] || row['품목명(요약)'];
        if (rawName && rawName !== '배송비' && !rawName.includes('개인결제건')) {
          const matchedPart = parts.find(p => rawName.includes(p.name) || (p.code && rawName.includes(p.code)));
          if (!matchedPart) {
            missingSet.add(rawName);
          }
        }
      });

      setGroupedDataCache(groupedData);
      setGroupedDataKeys(Object.keys(groupedData));

      if (missingSet.size > 0) {
        setMissingParts(Array.from(missingSet));
        setMappingDialog(true);
      } else {
        setConfirmDialog(true);
      }

    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoading(false);
    }
  };

  const handleMappingComplete = () => {
    setMappingDialog(false);
    setConfirmDialog(true);
  };

  const executeMigration = async () => {
    try {
      setConfirmDialog(false);
      setLoading(true);
      setProgress(0);

      let successCount = 0;

      for (let i = 0; i < groupedDataKeys.length; i++) {
        const group = groupedDataCache[groupedDataKeys[i]];
        
        // 1. 거래처(Agency) 자동 매핑
        let agencyId = null;
        if (group.agencyName) {
           const matchedAgency = dbAgencies.find(a => group.agencyName.includes(a.name) || a.name.includes(group.agencyName));
           if (matchedAgency) agencyId = matchedAgency.id;
        }

        // 2. 브랜드 추정
        let brand = 'XRB';
        if (group.projectName?.includes('NB')) brand = 'NB';

        // 3. 총합계
        const totalPriceText = group.items.reduce((sum, item) => sum + (parseFloat(String(item['합계']||item['공급가액']||'0').replace(/,/g, '')) || 0), 0);
        
        // 서비스(매출) 생성 (엑셀의 날짜 그대로 적용)
        const serviceData = {
          brand,
          reception_date: group.parsedDate, 
          customer_name: group.agencyName || '이카운트 고객',
          agency_id: agencyId,
          symptom: '단순 판매 (Ecount 일괄 업로드)',
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
          continue;
        }

        const serviceId = insertedService.id;
        const partsToProcess = [];

        for (const item of group.items) {
          const rawName = item['품목명(규격)'] || item['품목명(요약)'];
          if (!rawName) continue;

          let matchedPartId = null;
          if (rawName !== '배송비' && !rawName.includes('개인결제건')) {
            // 이름 자동 매칭
            const matchedPart = dbParts.find(p => rawName.includes(p.name) || (p.code && rawName.includes(p.code)));
            if (matchedPart) {
              matchedPartId = matchedPart.id;
            } else {
              // 수동 맵핑(MappingChoices) 확인
              matchedPartId = mappingChoices[rawName] || null;
            }
          }

          // 창고 맵핑
          let warehouseId = null;
          const warehouseName = item['창고명'];
          if (warehouseName) {
              const matchedWh = dbWarehouses.find(w => warehouseName.includes(w.name) || w.name.includes(warehouseName));
              if (matchedWh) warehouseId = matchedWh.id;
          }

          // 수량/단가
          const qty = parseInt(String(item['수량'] || '1').replace(/,/g, '')) || 1;
          const uPrice = parseInt(String(item['공급가액'] || item['단가'] || item['합계'] || '0').replace(/,/g, '')) || 0;

          // service_parts Insert
          const servicePartData = {
            service_id: serviceId,
            part_id: matchedPartId,
            part_name: rawName,
            price: uPrice,
            quantity: qty,
            total_price: uPrice * qty,
            warehouse_id: warehouseId
          };

          const { data: insertedPart, error: partError } = await supabase
            .from('service_parts')
            .insert([servicePartData])
            .select()
            .single();

          if (!partError && insertedPart) {
             // processServiceCompletion를 위해 배열에 담기
             // 단, null 부품(메모용)이라도 이력은 남을 수 있음 (inventoryUtils.js 로직에 따름)
             partsToProcess.push({
               ...insertedPart,
               id: insertedPart.id, // service_part id
               part_id: insertedPart.part_id,
               quantity: insertedPart.quantity,
               part_name: rawName,
             });
          }
        }

        // 재고(트랜잭션) 처리 연동
        if (partsToProcess.length > 0) {
           await processServiceCompletion(serviceId, partsToProcess, user?.id || null);
        }

        successCount++;
        setProgress(Math.round(((i + 1) / groupedDataKeys.length) * 100));
      }

      showMessage(`총 ${groupedDataKeys.length}개 묶음 중 ${successCount}건 처리 완료!`, 'success');
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
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          ref={fileInputRef}
        />
      </Button>

      {/* 부품 매핑 다이얼로그 */}
      <Dialog 
        open={mappingDialog} 
        onClose={() => setMappingDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>미등록 부품 매핑 확인</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f8f9fa' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            엑셀의 품목명 중 CRM 부품과 정확히 자동 일치하지 않는 내역이 <b>{missingParts.length}개</b> 발견되었습니다.<br/>
            알맞은 부품을 검색해 연결하시거나, 비워두시면 '미등록 품목'으로 메모만 남고 재고는 차감되지 않습니다.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {missingParts.map((rawName, index) => (
              <Paper key={index} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ width: '40%', fontWeight: 'bold', wordBreak: 'break-all' }}>
                  {rawName}
                </Typography>
                <Box sx={{ width: '60%' }}>
                  <Autocomplete
                    options={dbParts}
                    getOptionLabel={(option) => `${option.name} ${option.code ? `(${option.code})` : ''}`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(e, newValue) => {
                      setMappingChoices(prev => ({
                        ...prev,
                        [rawName]: newValue ? newValue.id : null
                      }));
                    }}
                    renderInput={(params) => <TextField {...params} label="CRM 부품 직접 연결" size="small" />}
                    noOptionsText="검색 결과가 없습니다"
                  />
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingDialog(false)} color="inherit">취소</Button>
          <Button onClick={handleMappingComplete} color="primary" variant="contained">
            위 설정으로 계속 (매핑 완료)
          </Button>
        </DialogActions>
      </Dialog>

      {/* 최종 확인 및 진행 다이얼로그 */}
      <Dialog open={confirmDialog} onClose={!loading ? () => setConfirmDialog(false) : undefined}>
        <DialogTitle>매출 및 재고 일괄 반영</DialogTitle>
        <DialogContent>
          {loading ? (
             <Box sx={{ width: '100%', mt: 2 }}>
               <Typography variant="body2" gutterBottom>
                 {progress}% 처리 중... (완료될 때까지 창을 닫지 마세요)
               </Typography>
               <LinearProgress variant="determinate" value={progress} />
             </Box>
          ) : (
            <Typography variant="body1" sx={{ mt: 1 }}>
              총 <b>{groupedDataKeys.length}개의 통합 출고 그룹</b>(총 {parsedData.length}개 품목)으로 분류되었습니다.<br /><br />
              <b>"일괄 생성"</b> 버튼을 누르면 이카운트 엑셀의 <b>날짜 형태 그대로</b> 수기판매 상세 장부(services)가 작성되며, 매핑된 부품들의 재고가 지정된 거래처 실적으로 전송/차감됩니다.
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
