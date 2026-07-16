import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Snackbar,
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
  LocalShipping as ShippingIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CloudDownload as CloudDownloadIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import * as ExcelJS from 'exceljs';
import { warehouseApi } from '../../api/warehouseApi';
import { dealerApi } from '../../api/dealerApi';
import { useAuth } from '../../contexts/AuthContext';

function LocationManagement({ 
  warehouses, 
  setWarehouses, 
  dealers, 
  setDealers,
  onLocationUpdate,
  onToggleSync,
  onRefreshProducts,
  onSyncWarehouseStock,
  loading = false
}) {
  const { hasActionPermission } = useAuth();
  const canEditBasic = hasActionPermission ? hasActionPermission('can_edit_basic') : false;

  const [activeTab, setActiveTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState(''); // 'warehouse' | 'dealer'
  const [editingItem, setEditingItem] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // 창고 엑셀 업로드 관련 상태
  const [warehouseExcelOpen, setWarehouseExcelOpen] = useState(false);
  const [warehouseExcelFile, setWarehouseExcelFile] = useState(null);
  const [warehouseExcelData, setWarehouseExcelData] = useState([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [showHiddenWarehouses, setShowHiddenWarehouses] = useState(false);

  // 폼 데이터
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    location: '',
    phone: '',
    address: '',
    manager: '',
    note: ''
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleOpenDialog = (type, item = null) => {
    setDialogType(type);
    setEditingItem(item);
    
    if (item) {
      setFormData({
        id: item.id || '',
        name: item.name || '',
        location: item.location || '',
        phone: item.phone || '',
        address: item.address || '',
        manager: item.manager || '',
        note: item.note || ''
      });
    } else {
      // 새로 추가할 때 ID 자동 생성
      const prefix = type === 'warehouse' ? 'W' : 'D';
      const existingItems = type === 'warehouse' ? warehouses : dealers;
      const maxNum = existingItems.length > 0 
        ? Math.max(...existingItems.map(item => {
            const numPart = item.id.replace(/[^0-9]/g, '');
            return numPart ? parseInt(numPart) : 0;
          }))
        : 0;
      const newId = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
      
      setFormData({
        id: newId,
        name: '',
        location: '',
        phone: '',
        address: '',
        manager: '',
        note: ''
      });
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
    setFormData({
      id: '',
      name: '',
      location: '',
      phone: '',
      address: '',
      manager: '',
      note: ''
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.location) {
      showSnackbar('필수 항목을 입력해주세요.', 'error');
      return;
    }

    const newItem = {
      id: formData.id,
      name: formData.name,
      location: formData.location,
      phone: formData.phone,
      address: formData.address,
      manager: formData.manager,
      note: formData.note,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (dialogType === 'warehouse') {
        if (editingItem) {
          // 서버에서 창고 수정
          await warehouseApi.update(editingItem.id, newItem);
          const updatedWarehouses = warehouses.map(w => w.id === editingItem.id ? newItem : w);
          setWarehouses(updatedWarehouses);
          showSnackbar('창고 정보가 수정되었습니다.', 'success');
        } else {
          // 서버에 창고 생성
          await warehouseApi.create(newItem);
          const updatedWarehouses = [...warehouses, newItem];
          setWarehouses(updatedWarehouses);
          showSnackbar('새 창고가 추가되었습니다.', 'success');
        }
      } else {
        if (editingItem) {
          // 서버에서 대리점 수정
          await dealerApi.update(editingItem.id, newItem);
          const updatedDealers = dealers.map(d => d.id === editingItem.id ? newItem : d);
          setDealers(updatedDealers);
          showSnackbar('대리점 정보가 수정되었습니다.', 'success');
        } else {
          // 서버에 대리점 생성
          await dealerApi.create(newItem);
          const updatedDealers = [...dealers, newItem];
          setDealers(updatedDealers);
          showSnackbar('새 대리점이 추가되었습니다.', 'success');
        }
      }
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      showSnackbar('데이터 저장에 실패했습니다.', 'error');
      return;
    }

    // 부모 컴포넌트에 변경사항 알림
    if (onLocationUpdate) {
      onLocationUpdate();
    }

    handleCloseDialog();
  };

  const handleDelete = async (type, id) => {
    if (window.confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        if (type === 'warehouse') {
          // 참조 무결성 확인: inventory 또는 transactions에서 사용 중인지 체크
          const { supabase } = await import('../../lib/supabaseClient');
          const { count: invCount } = await supabase
            .from('inventory')
            .select('*', { count: 'exact', head: true })
            .eq('warehouse_id', id)
            .neq('quantity', 0);
          
          const { count: txCount } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .or(`from_location.eq.${id},to_location.eq.${id}`);

          if ((invCount && invCount > 0) || (txCount && txCount > 0)) {
            showSnackbar(`이 창고는 재고(${invCount || 0}건) 또는 입출고 내역(${txCount || 0}건)에서 사용 중이므로 삭제할 수 없습니다.`, 'error');
            return;
          }

          // 서버에서 창고 삭제
          await warehouseApi.delete(id);
          const updatedWarehouses = warehouses.filter(w => w.id !== id);
          setWarehouses(updatedWarehouses);
          showSnackbar('창고가 삭제되었습니다.', 'success');
        } else {
          // 서버에서 대리점 삭제
          await dealerApi.delete(id);
          const updatedDealers = dealers.filter(d => d.id !== id);
          setDealers(updatedDealers);
          showSnackbar('대리점이 삭제되었습니다.', 'success');
        }

        // 부모 컴포넌트에 변경사항 알림
        if (onLocationUpdate) {
          onLocationUpdate();
        }
      } catch (error) {
        console.error('삭제 실패:', error);
        showSnackbar('삭제에 실패했습니다.', 'error');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // 창고 엑셀 업로드 다이얼로그 열기
  const handleOpenWarehouseExcel = () => {
    setWarehouseExcelOpen(true);
    setWarehouseExcelFile(null);
    setWarehouseExcelData([]);
  };

  // 창고 엑셀 업로드 다이얼로그 닫기
  const handleCloseWarehouseExcel = () => {
    setWarehouseExcelOpen(false);
    setWarehouseExcelFile(null);
    setWarehouseExcelData([]);
  };

  // 창고 엑셀 파일 처리
  const handleWarehouseExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setWarehouseExcelFile(file);
    
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.getWorksheet(1);
      const data = [];
      
      // 헤더 행 건너뛰고 데이터 읽기 (2행부터)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 헤더 행 건너뛰기
        
        // ExcelJS row.values는 1-based이며 index 1이 A열(일련번호). 템플릿 컬럼: A=colA, B=창고ID, C=창고명, D=지역/위치, E=연락처, F=재고연동
        const rowData = row.values;
        const isNoteRow = String(rowData[1] || '').trim().startsWith('※'); // 템플릿 하단 "※ 설명:" 안내 행 제외
        if (!isNoteRow && rowData.length >= 5 && rowData[2]) { // 최소 필수 데이터 확인
          const item = {
            id: rowData[2] || '', // B열: 창고ID
            name: rowData[3] || '', // C열: 창고명
            location: rowData[4] || '', // D열: 지역/위치
            phone: rowData[5] || '', // E열: 연락처
            syncWithProductStock: rowData[6] === 'Y' || rowData[6] === 'true' || rowData[6] === true, // F열: 재고연동 여부
            stockSync: rowData[6] === 'Y' || rowData[6] === 'true' || rowData[6] === true
          };
          data.push(item);
        }
      });

      setWarehouseExcelData(data);
      showSnackbar(`${data.length}개의 창고 데이터를 읽었습니다.`, 'success');
    } catch (error) {
      console.error('창고 엑셀 파일 읽기 오류:', error);
      showSnackbar('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'error');
    }
  };

  // 창고 엑셀 데이터로 창고 추가
  const handleWarehouseExcelSubmit = async () => {
    if (warehouseExcelData.length === 0) {
      showSnackbar('처리할 데이터가 없습니다.', 'error');
      return;
    }

    try {
      const newWarehouses = [];
      let addedCount = 0;
      let duplicateCount = 0;

      for (const item of warehouseExcelData) {
        // 중복 ID 체크
        const existingWarehouse = warehouses.find(w => w.id === item.id);
        if (existingWarehouse) {
          duplicateCount++;
          continue;
        }

        const newWarehouse = {
          id: item.id,
          name: item.name,
          location: item.location,
          phone: item.phone,
          syncWithProductStock: item.syncWithProductStock || false,
          stockSync: item.stockSync || false
        };
        
        newWarehouses.push(newWarehouse);
        addedCount++;
      }

      if (newWarehouses.length > 0) {
        // 서버에 창고들 일괄 생성
        await warehouseApi.createMany(newWarehouses);
        
        const updatedWarehouses = [...warehouses, ...newWarehouses];
        setWarehouses(updatedWarehouses);
        
        showSnackbar(`${addedCount}개의 창고가 추가되었습니다. (중복: ${duplicateCount}개)`, 'success');
        handleCloseWarehouseExcel();
        
        // 부모 컴포넌트에 변경사항 알림
        if (onLocationUpdate) {
          onLocationUpdate();
        }
      } else {
        showSnackbar('추가할 창고가 없습니다.', 'warning');
      }
    } catch (error) {
      console.error('창고 엑셀 업로드 실패:', error);
      showSnackbar('창고 엑셀 업로드에 실패했습니다.', 'error');
    }
  };

  // 창고 엑셀 템플릿 다운로드
  const downloadWarehouseTemplate = () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('창고 관리 템플릿');
    
    // 헤더 설정
    worksheet.columns = [
      { header: 'A', key: 'colA', width: 10 },
      { header: '창고ID', key: 'id', width: 15 },
      { header: '창고명', key: 'name', width: 20 },
      { header: '지역/위치', key: 'location', width: 20 },
      { header: '연락처', key: 'phone', width: 15 },
      { header: '재고연동', key: 'syncWithProductStock', width: 15 }
    ];

    // 샘플 데이터 추가
    worksheet.addRow({
      colA: '1',
      id: 'W001',
      name: '서울 창고',
      location: '서울시 강남구',
      phone: '02-1234-5678',
      syncWithProductStock: 'Y'
    });

    worksheet.addRow({
      colA: '2',
      id: 'W002',
      name: '부산 창고',
      location: '부산시 해운대구',
      phone: '051-9876-5432',
      syncWithProductStock: 'N'
    });

    // 스타일 적용
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // 설명 추가
    worksheet.addRow({});
    worksheet.addRow({ 
      colA: '※ 설명:', 
      id: '재고연동: Y(연동), N(독립)',
      name: '창고ID는 고유해야 합니다.',
      location: '지역/위치는 창고의 실제 위치를 입력하세요.'
    });

    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '창고관리_템플릿.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
    });
  };

  // 엑셀 업로드 처리
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.getWorksheet(1);
      const newDealers = [];
      
      // 헤더 행 건너뛰고 데이터 읽기 (2행부터)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 헤더 행 건너뛰기
        
        const rowData = row.values;
        if (rowData.length >= 6 && rowData[2]) { // 최소 필수 데이터 확인
          const newDealer = {
            id: `D${String(dealers.length + newDealers.length + 1).padStart(3, '0')}`,
            name: rowData[2] || '', // B열: 대리점명
            location: rowData[3] || '', // C열: 지역
            phone: rowData[4] || '', // D열: 연락처
            manager: rowData[5] || '', // E열: 담당자
            address: rowData[6] || '' // F열: 주소
          };
          newDealers.push(newDealer);
        }
      });

      if (newDealers.length > 0) {
        try {
          // 서버에 대리점들 일괄 생성
          await dealerApi.createMany(newDealers);
          
          const updatedDealers = [...dealers, ...newDealers];
          setDealers(updatedDealers);
          showSnackbar(`${newDealers.length}개의 대리점이 성공적으로 추가되었습니다.`, 'success');
          if (onLocationUpdate) onLocationUpdate();
        } catch (error) {
          console.error('대리점 엑셀 업로드 실패:', error);
          showSnackbar('대리점 엑셀 업로드에 실패했습니다.', 'error');
        }
      } else {
        showSnackbar('유효한 대리점 데이터를 찾을 수 없습니다.', 'warning');
      }
    } catch (error) {
      console.error('엑셀 업로드 오류:', error);
      showSnackbar('엑셀 파일 업로드 중 오류가 발생했습니다.', 'error');
    }
    
    // 파일 입력 초기화
    event.target.value = '';
    setUploadDialogOpen(false);
  };

  // 엑셀 템플릿 다운로드
  const downloadDealerTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('대리점 템플릿');

      // 헤더 설정
      const headers = ['ID', '대리점명', '지역', '연락처', '담당자', '주소'];
      worksheet.addRow(headers);

      // 헤더 스타일 적용
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // 샘플 데이터 추가
      const sampleData = [
        ['D001', '대리점 샘플1', '서울', '02-1234-5678', '김대리', '서울시 강남구 테헤란로 123'],
        ['D002', '대리점 샘플2', '부산', '051-1234-5678', '박대리', '부산시 해운대구 마린시티 456'],
        ['D003', '대리점 샘플3', '대구', '053-1234-5678', '이대리', '대구시 수성구 범어동 789']
      ];

      sampleData.forEach(row => {
        worksheet.addRow(row);
      });

      // 컬럼 너비 자동 조정
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      // 파일 다운로드
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '대리점_업로드_템플릿.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);

      showSnackbar('대리점 업로드 템플릿이 다운로드되었습니다.', 'success');
    } catch (error) {
      console.error('템플릿 다운로드 오류:', error);
      showSnackbar('템플릿 다운로드 중 오류가 발생했습니다.', 'error');
    }
  };

  // 창고 숨김 토글
  const handleToggleHidden = async (warehouse) => {
    const isCurrentlyHidden = (warehouse.note || '').includes('[HIDDEN]');
    const newNote = isCurrentlyHidden 
      ? (warehouse.note || '').replace('[HIDDEN]', '').trim()
      : `[HIDDEN] ${(warehouse.note || '').trim()}`.trim();
    
    try {
      await warehouseApi.update(warehouse.id, { ...warehouse, note: newNote });
      const updatedWarehouses = warehouses.map(w => 
        w.id === warehouse.id ? { ...w, note: newNote } : w
      );
      setWarehouses(updatedWarehouses);
      showSnackbar(isCurrentlyHidden ? `${warehouse.name} 창고가 표시됩니다.` : `${warehouse.name} 창고가 숨김 처리되었습니다.`, 'success');
      if (onLocationUpdate) onLocationUpdate();
    } catch (error) {
      console.error('숨김 처리 실패:', error);
      showSnackbar('숨김 처리에 실패했습니다.', 'error');
    }
  };

  const visibleWarehouses = showHiddenWarehouses 
    ? warehouses 
    : warehouses.filter(w => !(w.note || '').includes('[HIDDEN]'));
  const hiddenCount = warehouses.filter(w => (w.note || '').includes('[HIDDEN]')).length;

  return (
    <Box>
      {/* 탭 메뉴 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StoreIcon />
                창고 관리 ({visibleWarehouses.length}{hiddenCount > 0 ? ` / 숨김 ${hiddenCount}` : ''})
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShippingIcon />
                대리점 관리 ({dealers.length})
              </Box>
            } 
          />
        </Tabs>
      </Box>

      {/* 전체 파츠 동기화 버튼 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={onRefreshProducts}
          disabled={loading}
          size="small"
          color="primary"
          startIcon={<SyncIcon />}
        >
          전체 파츠 동기화
        </Button>
      </Box>

      {/* 창고 관리 탭 */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">창고 관리</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hiddenCount > 0 && (
                <Button
                  variant={showHiddenWarehouses ? 'contained' : 'outlined'}
                  size="small"
                  color="warning"
                  startIcon={showHiddenWarehouses ? <VisibilityIcon /> : <VisibilityOffIcon />}
                  onClick={() => setShowHiddenWarehouses(!showHiddenWarehouses)}
                >
                  숨김 창고 {showHiddenWarehouses ? '포함' : `보기 (${hiddenCount})`}
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadWarehouseTemplate}
              >
                템플릿 다운로드
              </Button>
              {canEditBasic && (
              <>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={handleOpenWarehouseExcel}
              >
                엑셀 업로드
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog('warehouse')}
              >
                새 창고 추가
              </Button>
              </>
              )}
            </Box>
          </Box>

          <Grid container spacing={2}>
            {visibleWarehouses.map(warehouse => {
              const isHidden = (warehouse.note || '').includes('[HIDDEN]');
              return (
              <Grid item xs={12} md={6} lg={4} key={warehouse.id}>
                <Card sx={{ opacity: isHidden ? 0.6 : 1, border: isHidden ? '2px dashed #bbb' : 'none' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {warehouse.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                          <Chip label={warehouse.id} size="small" color="primary" />
                          {warehouse.syncWithProductStock ? (
                            <Chip 
                              icon={<SyncIcon />}
                              label="재고 연동"
                              size="small"
                              color="success"
                              onClick={() => onToggleSync && onToggleSync(warehouse.id)}
                              sx={{ cursor: 'pointer' }}
                            />
                          ) : (
                            <Chip 
                              icon={<SyncDisabledIcon />}
                              label="독립 재고"
                              size="small"
                              color="default"
                              onClick={() => onToggleSync && onToggleSync(warehouse.id)}
                              sx={{ cursor: 'pointer' }}
                            />
                          )}
                          {warehouse.syncWithProductStock && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onSyncWarehouseStock && onSyncWarehouseStock(warehouse.id)}
                              sx={{ minWidth: 'auto', px: 1, height: 24 }}
                            >
                              동기화
                            </Button>
                          )}
                        </Box>
                      </Box>
                      <Box>
                        {canEditBasic && (
                        <>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog('warehouse', warehouse)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color={isHidden ? 'success' : 'default'}
                          onClick={() => handleToggleHidden(warehouse)}
                          title={isHidden ? '창고 표시' : '창고 숨김'}
                        >
                          {isHidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDelete('warehouse', warehouse.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                        </>
                        )}
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <LocationIcon color="action" sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2" color="text.secondary">
                        {warehouse.location}
                      </Typography>
                    </Box>
                    
                    {warehouse.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PhoneIcon color="action" sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2" color="text.secondary">
                          {warehouse.phone}
                        </Typography>
                      </Box>
                    )}
                    
                    {warehouse.manager && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        담당자: {warehouse.manager}
                      </Typography>
                    )}
                    
                    {warehouse.address && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        주소: {warehouse.address}
                      </Typography>
                    )}
                    
                    {warehouse.note && (
                      <Typography variant="body2" color="text.secondary" sx={{ 
                        mt: 1, 
                        p: 1, 
                        bgcolor: 'grey.50', 
                        borderRadius: 1,
                        fontSize: '0.75rem'
                      }}>
                        {(warehouse.note || '').replace('[HIDDEN]', '').trim()}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              );
            })}
          </Grid>

          {warehouses.length === 0 && (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <StoreIcon color="disabled" sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  등록된 창고가 없습니다
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  새 창고를 추가하여 재고 관리를 시작하세요
                </Typography>
                {canEditBasic && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog('warehouse')}
                >
                  첫 번째 창고 추가
                </Button>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* 대리점 관리 탭 */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">🏪 대리점 목록 (거래처 관리 연동)</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="info"
                onClick={() => window.location.href = '/agencies'}
              >
                거래처 관리로 이동
              </Button>
            </Box>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>대리점명 (상호)</TableCell>
                  <TableCell>사업자번호</TableCell>
                  <TableCell>연락처</TableCell>
                  <TableCell>대표자</TableCell>
                  <TableCell>주소</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dealers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <ShippingIcon color="disabled" sx={{ fontSize: 48, mb: 2, display: 'block', mx: 'auto' }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        등록된 대리점이 없습니다
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        좌측 메뉴의 '거래처 관리'에서 신규 대리점을 추가/관리할 수 있습니다.
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => window.location.href = '/agencies'}
                      >
                        거래처 관리 바로가기
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  dealers.map(dealer => (
                    <TableRow key={dealer.id}>
                      <TableCell>
                        <Chip label={dealer.id} size="small" color="secondary" />
                      </TableCell>
                      <TableCell fontWeight="bold">{dealer.name}</TableCell>
                      <TableCell>{dealer.business_number || '-'}</TableCell>
                      <TableCell>{dealer.phone || dealer.mobile || '-'}</TableCell>
                      <TableCell>{dealer.ceo_name || '-'}</TableCell>
                      <TableCell>{dealer.address || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem 
            ? `${dialogType === 'warehouse' ? '창고' : '대리점'} 수정`
            : `새 ${dialogType === 'warehouse' ? '창고' : '대리점'} 추가`
          }
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="ID"
                name="id"
                value={formData.id}
                onChange={handleInputChange}
                disabled={editingItem !== null}
                required
                helperText="자동 생성됩니다"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={`${dialogType === 'warehouse' ? '창고' : '대리점'}명`}
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="지역/위치"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="연락처"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="010-0000-0000"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="담당자"
                name="manager"
                value={formData.manager}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="주소"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="메모"
                name="note"
                value={formData.note}
                onChange={handleInputChange}
                multiline
                rows={3}
                placeholder="특이사항이나 참고사항을 입력하세요"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingItem ? '수정' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 엑셀 업로드 다이얼로그 */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          📊 대리점 엑셀 업로드
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              대리점 정보를 엑셀 파일로 업로드하세요
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              먼저 템플릿을 다운로드하여 양식을 확인하고, 데이터를 입력한 후 업로드해주세요.
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<CloudDownloadIcon />}
                onClick={downloadDealerTemplate}
                sx={{ mr: 2 }}
              >
                템플릿 다운로드
              </Button>
            </Box>

            <Box sx={{ 
              border: '2px dashed #ccc', 
              borderRadius: 2, 
              p: 3, 
              backgroundColor: '#fafafa',
              mb: 2
            }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                style={{ display: 'none' }}
                id="excel-upload-input"
              />
              <label htmlFor="excel-upload-input">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<UploadIcon />}
                  size="large"
                >
                  엑셀 파일 선택
                </Button>
              </label>
            </Box>

            <Alert severity="info" sx={{ textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>업로드 형식:</strong><br/>
                • 파일 형식: .xlsx, .xls<br/>
                • 필수 컬럼: 대리점명, 지역, 연락처, 담당자, 주소<br/>
                • 첫 번째 행은 헤더로 인식됩니다<br/>
                • ID는 자동으로 생성됩니다
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            취소
          </Button>
        </DialogActions>
      </Dialog>

      {/* 창고 엑셀 업로드 다이얼로그 */}
      <Dialog open={warehouseExcelOpen} onClose={handleCloseWarehouseExcel} maxWidth="md" fullWidth>
        <DialogTitle>
          창고 엑셀 업로드
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* 템플릿 다운로드 */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                📋 창고 템플릿 다운로드
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                아래 버튼을 클릭하여 창고 관리 템플릿을 다운로드하세요.
              </Typography>
              <Button
                variant="outlined"
                onClick={downloadWarehouseTemplate}
                startIcon={<DownloadIcon />}
              >
                템플릿 다운로드
              </Button>
            </Box>

            {/* 파일 업로드 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                📁 엑셀 파일 업로드
              </Typography>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleWarehouseExcelUpload}
                style={{ display: 'none' }}
                id="warehouse-excel-file-input"
              />
              <label htmlFor="warehouse-excel-file-input">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<UploadIcon />}
                  disabled={!warehouseExcelFile}
                >
                  {warehouseExcelFile ? warehouseExcelFile.name : '엑셀 파일 선택'}
                </Button>
              </label>
            </Box>

            {/* 업로드된 데이터 미리보기 */}
            {warehouseExcelData.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  📊 업로드된 데이터 미리보기 ({warehouseExcelData.length}개 창고)
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>창고ID</TableCell>
                        <TableCell>창고명</TableCell>
                        <TableCell>지역/위치</TableCell>
                        <TableCell>연락처</TableCell>
                        <TableCell>재고연동</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {warehouseExcelData.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.phone}</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.syncWithProductStock ? '연동' : '독립'} 
                              color={item.syncWithProductStock ? 'primary' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {warehouseExcelData.length > 10 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    ... 및 {warehouseExcelData.length - 10}개 더
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWarehouseExcel}>취소</Button>
          <Button 
            onClick={handleWarehouseExcelSubmit} 
            variant="contained"
            disabled={warehouseExcelData.length === 0}
          >
            창고 추가 ({warehouseExcelData.length}개)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default LocationManagement;
