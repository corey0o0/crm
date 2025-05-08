import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Box,
  Typography,
  Grid,
  MenuItem,
  InputAdornment,
  Tooltip,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  TableSortLabel,
  Switch,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FileCopy as FileCopyIcon,
  CheckBox as CheckBoxIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// 입력 폼 컴포넌트 분리
const PartsFormDialog = memo(({ 
  open, 
  onClose, 
  onSubmit, 
  initialData, 
  brands 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    code: '',
    supplyPrice: '',
    price: '',
    barcode: '',
    note: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        brand: initialData.brand || '',
        code: initialData.code || '',
        supplyPrice: initialData.supply_price?.toString() || '',
        price: initialData.price?.toString() || '',
        barcode: initialData.barcode || '',
        note: initialData.note || ''
      });
    } else {
      setFormData({
        name: '',
        brand: brands[0] || '',
        code: '',
        supplyPrice: '',
        price: '',
        barcode: '',
        note: ''
      });
    }
  }, [initialData, brands]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['price', 'supplyPrice'].includes(name) ? value.replace(/[^0-9]/g, '') : value
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(formData);
  }, [formData, onSubmit]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth 
      transitionDuration={0}
    >
      <DialogTitle>
        {initialData ? '파츠 수정' : '파츠 등록'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 2 }}>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label="브랜드"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              required
            >
              {brands.map((brand) => (
                <MenuItem key={brand} value={brand}>
                  {brand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="상품코드"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="파츠명"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="공급가"
              name="supplyPrice"
              value={formData.supplyPrice}
              onChange={handleChange}
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">원</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="판매가"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">원</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="바코드"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="구분"
              name="note"
              value={formData.note}
              onChange={handleChange}
              multiline
              rows={2}
              placeholder="추가 정보를 입력하세요"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained">
          {initialData ? '수정' : '등록'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

PartsFormDialog.displayName = 'PartsFormDialog';

function PartsManagement() {
  const [parts, setParts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    code: '',
    supplyPrice: '',
    price: '',
    barcode: '',
    note: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    open: false,
    step: 0,
    total: 0,
    current: 0,
    message: ''
  });
  
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('code');
  const [showSupplyPrice, setShowSupplyPrice] = useState(false);
  
  // 체크박스 관련 상태 추가
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [openCopyDialog, setOpenCopyDialog] = useState(false);
  const [copyTargetBrand, setCopyTargetBrand] = useState('');

  // 디바운스 타이머 상태 추가
  const [searchDebounce, setSearchDebounce] = useState(null);

  const brands = ['XRB', 'NB']; // 브랜드 목록 수정
  const navigate = useNavigate();

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('brand')
        .order('name');
      
      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      console.error('Error fetching parts:', err);
      showSnackbar('부품 목록을 불러오는데 실패했습니다.', 'error');
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortData = (data, order, orderBy) => {
    return data.sort((a, b) => {
      if (orderBy === 'supply_price' || orderBy === 'price') {
        const aValue = a[orderBy] || 0;
        const bValue = b[orderBy] || 0;
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aValue = (a[orderBy] || '').toString().toLowerCase();
      const bValue = (b[orderBy] || '').toString().toLowerCase();
      
      if (order === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  };

  const handleOpenDialog = useCallback((part = null) => {
    setSelectedPart(part);
    setOpenDialog(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedPart(null);
  }, []);

  const handleSubmit = useCallback(async (formData) => {
    try {
      const partData = {
        name: formData.name,
        brand: formData.brand,
        code: formData.code,
        supply_price: Number(formData.supplyPrice),
        price: Number(formData.price)
      };

      if (formData.barcode) partData.barcode = formData.barcode;
      if (formData.note) partData.note = formData.note;

      if (selectedPart) {
        const { error } = await supabase
          .from('parts')
          .update(partData)
          .eq('id', selectedPart.id);
        
        if (error) throw error;
        
        showSnackbar(`부품이 성공적으로 수정되었습니다.`, 'success');
      } else {
        const { error } = await supabase
          .from('parts')
          .insert([partData]);
        
        if (error) throw error;
        
        showSnackbar(`부품이 성공적으로 등록되었습니다.`, 'success');
      }

      fetchParts();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving part:', err);
      showSnackbar('저장 중 오류가 발생했습니다.', 'error');
    }
  }, [selectedPart]);

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('parts')
          .delete()
          .eq('id', id);

        if (error) throw error;

        fetchParts(); // 목록 새로고침
        showSnackbar('부품이 삭제되었습니다.', 'success');
      } catch (err) {
        console.error('Error deleting part:', err);
        showSnackbar('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  };

  const closeUploadStatus = () => {
    setUploadStatus({
      open: false,
      step: 0,
      total: 0,
      current: 0,
      message: ''
    });
  };

  const validateExcelData = (data) => {
    const errors = [];
    const validData = [];

    data.forEach((row, index) => {
      const rowErrors = [];
      
      if (!row.brand) rowErrors.push('brand');
      if (!row.code) rowErrors.push('code');
      if (!row.name) rowErrors.push('name');

      if (row.brand && !['XRB', 'NB'].includes(String(row.brand).toUpperCase())) {
        errors.push(`${index + 2}번 행: 브랜드는 XRB 또는 NB만 입력 가능합니다.`);
        return;
      }

      if (row.supplyPrice !== undefined && row.supplyPrice !== '' && 
          isNaN(Number(String(row.supplyPrice).replace(/[^0-9]/g, '')))) {
        errors.push(`${index + 2}번 행: 공급가는 숫자만 입력 가능합니다.`);
        return;
      }
      if (row.price !== undefined && row.price !== '' && 
          isNaN(Number(String(row.price).replace(/[^0-9]/g, '')))) {
        errors.push(`${index + 2}번 행: 판매가는 숫자만 입력 가능합니다.`);
        return;
      }

      if (rowErrors.length > 0) {
        errors.push(`${index + 2}번 행: ${rowErrors.join(', ')} 필드가 누락되었습니다.`);
        return;
      }

      validData.push(row);
    });

    return { validData, errors };
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExt)) {
      showSnackbar('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.', 'error');
      event.target.value = '';
      return;
    }

    setUploadStatus({
      open: true,
      step: 1,
      total: 100,
      current: 0,
      message: '엑셀 파일 읽는 중...'
    });

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
          closeUploadStatus();
          showSnackbar('엑셀 파일에 데이터가 없습니다.', 'error');
          event.target.value = '';
          return;
        }

        setUploadStatus(prev => ({
          ...prev,
          step: 2,
          message: '데이터 검증 중...',
          current: 30
        }));

        const { validData, errors } = validateExcelData(data);

        if (errors.length > 0) {
          closeUploadStatus();
          showSnackbar(`데이터 검증 중 오류가 발생했습니다:\n${errors.join('\n')}`, 'error');
          event.target.value = '';
          return;
        }

        const formattedData = validData.map(row => ({
          brand: String(row.brand).toUpperCase(),
          code: String(row.code).trim(),
          name: String(row.name).trim(),
          supply_price: row.supplyPrice === undefined || row.supplyPrice === '' 
            ? 0 
            : Number(String(row.supplyPrice).replace(/[^0-9]/g, '')),
          price: row.price === undefined || row.price === '' 
            ? 0 
            : Number(String(row.price).replace(/[^0-9]/g, '')),
          barcode: row.barcode ? String(row.barcode).trim() : null,
          note: row.note ? String(row.note).trim() : null
        }));

        setUploadStatus(prev => ({
          ...prev,
          step: 3,
          message: '중복 데이터 확인 중...',
          current: 60
        }));

        const { data: existingParts, error: checkError } = await supabase
          .from('parts')
          .select('code')
          .in('code', formattedData.map(d => d.code));

        if (checkError) throw checkError;

        const duplicateCodes = existingParts.map(p => p.code);
        if (duplicateCodes.length > 0) {
          closeUploadStatus();
          showSnackbar(`다음 상품코드는 이미 존재합니다: ${duplicateCodes.join(', ')}`, 'error');
          event.target.value = '';
          return;
        }

        setUploadStatus(prev => ({
          ...prev,
          step: 4,
          message: '데이터 저장 중...',
          current: 80
        }));

        const { error: insertError } = await supabase
          .from('parts')
          .insert(formattedData);

        if (insertError) throw insertError;

        setUploadStatus(prev => ({
          ...prev,
          step: 5,
          message: '저장 완료!',
          current: 100
        }));

        await fetchParts(); // 목록 새로고침
        
        setTimeout(() => {
          closeUploadStatus();
          showSnackbar(`${formattedData.length}개의 파츠가 성공적으로 등록되었습니다.`, 'success');
        }, 1000);

        event.target.value = '';

      } catch (error) {
        closeUploadStatus();
        console.error('엑셀 파일 처리 중 오류:', error);
        showSnackbar(
          error.code === '23505' 
            ? '동일한 상품코드를 가진 파츠가 이미 존재합니다.'
            : '엑셀 파일 처리 중 오류가 발생했습니다: ' + error.message,
          'error'
        );
        event.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        brand: 'XRB',
        code: 'XL-001',
        name: '컴프레서',
        supplyPrice: '100000',
        price: '150000',
        barcode: '8801234567890',
        note: '예시 데이터입니다'
      },
      {
        brand: 'XRB',
        code: 'XL-002',
        name: '필터',
        supplyPrice: '',  // 빈 값 예시
        price: '0',       // 0 값 예시
        barcode: '',      // 빈 값 예시
        note: ''          // 빈 값 예시
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    const columnDescriptions = [
      ['필수 입력 항목: 브랜드(XRB/NB), 상품코드, 파츠명'],
      ['선택 입력 항목: 공급가, 판매가, 바코드, 비고'],
      ['* 브랜드는 반드시 XRB 또는 NB로 입력해주세요.'],
      ['* 금액은 숫자만 입력하거나 비워두세요. (빈 값은 0으로 처리됩니다)']
    ];

    XLSX.utils.sheet_add_aoa(ws, columnDescriptions, { origin: -1 });

    const wscols = [
      { wch: 10 },  // brand
      { wch: 15 },  // code
      { wch: 20 },  // name
      { wch: 12 },  // supplyPrice
      { wch: 12 },  // price
      { wch: 15 },  // barcode
      { wch: 30 },  // note
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, "parts_template.xlsx");
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // 필터링된 파츠 목록 최적화
  const filteredParts = useMemo(() => {
    if (!searchTerm && selectedBrand === '전체') return parts;

    const searchTermLower = searchTerm.toLowerCase();
    return parts.filter(part => {
      // 브랜드로 필터링
      const brandMatch = selectedBrand === '전체' || part.brand === selectedBrand;
      if (!brandMatch) return false;
      
      // 검색어가 없으면 브랜드 필터링만 적용
      if (!searchTerm) return true;

      // 검색어 필터링 (대소문자 구분 없이)
      return part.name?.toLowerCase().includes(searchTermLower) ||
        part.code?.toLowerCase().includes(searchTermLower) ||
        part.barcode?.toLowerCase().includes(searchTermLower) ||
        part.note?.toLowerCase().includes(searchTermLower);
    });
  }, [parts, searchTerm, selectedBrand]);

  // 검색 입력 처리 함수 최적화
  const handleSearchInputChange = useCallback((e) => {
    setSearchInput(e.target.value);
  }, []);

  // 검색 실행 함수 최적화
  const executeSearch = useCallback(() => {
    setIsSearching(true);
    setSearchTerm(searchInput);
    setIsSearching(false);
  }, [searchInput]);

  // 엔터키 처리 함수 추가
  const handleKeyPress = useCallback((event) => {
    if (event.key === 'Enter') {
      executeSearch();
    }
  }, [executeSearch]);

  // 검색어 초기화 함수 최적화
  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
  }, []);

  // 정렬된 파츠 목록
  const sortedParts = useMemo(() => {
    return sortData([...filteredParts], order, orderBy);
  }, [filteredParts, order, orderBy]);

  const renderSortableHeader = (id, label, align = 'left') => (
    <TableCell 
      align={align} 
      sortDirection={orderBy === id ? order : false}
      sx={{ cursor: 'pointer' }}
    >
      <TableSortLabel
        active={orderBy === id}
        direction={orderBy === id ? order : 'asc'}
        onClick={() => handleRequestSort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  // 체크박스 선택 처리 함수
  const handleSelectItem = (id) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // 전체 선택 처리 함수
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      const filteredIds = filteredParts.map(part => part.id);
      setSelectedItems(filteredIds);
    }
    setSelectAll(!selectAll);
  };

  // useEffect로 selectAll 상태 업데이트
  useEffect(() => {
    // 모든 항목이 선택되었는지 확인
    if (filteredParts.length > 0 && selectedItems.length === filteredParts.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedItems, filteredParts]);

  // 복사 다이얼로그 열기
  const handleOpenCopyDialog = () => {
    if (selectedItems.length === 0) {
      showSnackbar('복사할 항목을 선택해주세요.', 'warning');
      return;
    }
    
    // 다른 브랜드 선택 (현재 선택된 항목의 브랜드와 다른 브랜드)
    const selectedParts = parts.filter(part => selectedItems.includes(part.id));
    const currentBrands = [...new Set(selectedParts.map(part => part.brand))];
    
    // 타겟 브랜드 기본값 설정
    const availableBrands = brands.filter(brand => !currentBrands.includes(brand));
    if (availableBrands.length > 0) {
      setCopyTargetBrand(availableBrands[0]);
    } else {
      setCopyTargetBrand('');
    }
    
    setOpenCopyDialog(true);
  };

  // 복사 다이얼로그 닫기
  const handleCloseCopyDialog = () => {
    setOpenCopyDialog(false);
  };

  // 파츠 복사 실행
  const handleCopyParts = async () => {
    if (!copyTargetBrand) {
      showSnackbar('대상 브랜드를 선택해주세요.', 'error');
      return;
    }

    try {
      // 선택된 파츠 정보 가져오기
      const selectedPartsData = parts.filter(part => selectedItems.includes(part.id));
      
      // 각 파츠를 새로운 브랜드로 복사
      const newPartsData = selectedPartsData.map(part => ({
        name: part.name,
        brand: copyTargetBrand,
        code: part.code,
        supply_price: part.supply_price,
        price: part.price,
        barcode: part.barcode || null,
        note: part.note || null,
        stock: 0 // 초기 재고는 0으로 설정
      }));
      
      // 중복 체크를 위한 쿼리
      for (const newPart of newPartsData) {
        // 동일한 코드와 브랜드 조합 체크
        const { data: existingPart, error: checkError } = await supabase
          .from('parts')
          .select('id, code')
          .eq('code', newPart.code)
          .eq('brand', newPart.brand)
          .limit(1);
          
        if (checkError) throw checkError;
        
        // 이미 존재하는 경우 덮어쓰기
        if (existingPart && existingPart.length > 0) {
          const { error: updateError } = await supabase
            .from('parts')
            .update({
              name: newPart.name,
              supply_price: newPart.supply_price,
              price: newPart.price,
              barcode: newPart.barcode,
              note: newPart.note
            })
            .eq('id', existingPart[0].id);
            
          if (updateError) throw updateError;
        } else {
          // 새로 생성
          const { error: insertError } = await supabase
            .from('parts')
            .insert([newPart]);
            
          if (insertError) throw insertError;
        }
      }
      
      showSnackbar(`${newPartsData.length}개 파츠가 ${copyTargetBrand} 브랜드로 복사되었습니다.`, 'success');
      handleCloseCopyDialog();
      fetchParts(); // 목록 새로고침
    } catch (error) {
      console.error('파츠 복사 중 오류:', error);
      showSnackbar('파츠 복사 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon />
        파츠 관리
      </Typography>
      <Box sx={{ mt: 3, mb: 3 }}>
        {/* 상단 액션 버튼 영역 */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
              >
                추가
              </Button>
            </Grid>
            
            <Grid item>
              <Button
                variant="contained"
                startIcon={<FileCopyIcon />}
                onClick={handleOpenCopyDialog}
                disabled={selectedItems.length === 0}
                sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' } }}
              >
                선택 항목 복사
              </Button>
            </Grid>
            
            <Grid item>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={selectAll}
                    onChange={handleSelectAll}
                    icon={<CheckBoxIcon fontSize="small" />}
                  />
                }
                label={`전체 선택 ${selectedItems.length > 0 ? `(${selectedItems.length}개)` : ''}`}
              />
            </Grid>

            <Grid item xs />

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => document.getElementById('excel-upload').click()}
              >
                파츠 업로드
              </Button>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
                style={{ display: 'none' }}
              />
            </Grid>
            
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
              >
                템플릿 다운로드
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 검색 및 필터 영역 */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="브랜드"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                <MenuItem value="전체">전체</MenuItem>
                {brands.map(brand => (
                  <MenuItem key={brand} value={brand}>
                    {brand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="제품명, 코드, 바코드로 검색"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  onKeyPress={handleKeyPress}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={handleClearSearch}
                          edge="end"
                        >
                          <CloseIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  variant="contained"
                  onClick={executeSearch}
                  disabled={isSearching}
                  sx={{ 
                    minWidth: '100px',
                    height: '40px',
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isSearching ? (
                    <CircularProgress size={20} />
                  ) : (
                    '검색'
                  )}
                </Button>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showSupplyPrice}
                    onChange={(e) => setShowSupplyPrice(e.target.checked)}
                  />
                }
                label="매입가 표시"
                sx={{ m: 0 }}
              />
            </Grid>
          </Grid>

          {/* 검색 결과 카운트 */}
          {searchTerm && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                검색어: <strong>{searchTerm}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                검색 결과: <strong>{filteredParts.length}건</strong>
              </Typography>
              <IconButton 
                size="small" 
                onClick={handleClearSearch}
                sx={{ ml: 1 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Paper>
      </Box>

      {/* 브랜드 탭 */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={selectedBrand}
          onChange={(e, newValue) => setSelectedBrand(newValue)}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minWidth: 120,
              fontWeight: 'medium'
            }
          }}
        >
          {brands.map((brand) => (
            <Tab 
              key={brand} 
              value={brand} 
              label={brand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'}
              sx={{
                '&.Mui-selected': {
                  fontWeight: 'bold'
                }
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 테이블 영역 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </TableCell>
              {renderSortableHeader('brand', '브랜드')}
              {renderSortableHeader('code', '코드')}
              {renderSortableHeader('name', '제품명')}
              {showSupplyPrice && renderSortableHeader('supply_price', '매입가', 'right')}
              {renderSortableHeader('price', '판매가', 'right')}
              {renderSortableHeader('stock', '재고', 'right')}
              {renderSortableHeader('note', '구분')}
              <TableCell align="right">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedParts.map((part) => (
              <TableRow key={part.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedItems.includes(part.id)}
                    onChange={() => handleSelectItem(part.id)}
                  />
                </TableCell>
                <TableCell>{part.brand}</TableCell>
                <TableCell>{part.code}</TableCell>
                <TableCell>{part.name}</TableCell>
                {showSupplyPrice && <TableCell align="right">{part.supply_price?.toLocaleString()}</TableCell>}
                <TableCell align="right">{part.price?.toLocaleString()}</TableCell>
                <TableCell align="right">{part.stock || 0}</TableCell>
                <TableCell>
                  <Typography 
                    sx={{ 
                      fontSize: '0.875rem',
                      color: part.note ? 'text.primary' : 'text.secondary',
                      fontStyle: part.note ? 'normal' : 'italic'
                    }}
                  >
                    {part.note || '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(part)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(part.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <PartsFormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        initialData={selectedPart}
        brands={brands}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={uploadStatus.open}
        maxWidth="sm"
        fullWidth
        transitionDuration={0}
        PaperProps={{
          sx: { p: 2 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          엑셀 파일 등록 중...
        </DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mt: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={uploadStatus.current} 
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography sx={{ mt: 2, mb: 1 }} variant="body1">
              {uploadStatus.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {uploadStatus.step}/5 단계
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 파츠 복사 다이얼로그 */}
      <Dialog open={openCopyDialog} onClose={handleCloseCopyDialog}>
        <DialogTitle>파츠 복사</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: 400, mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              선택된 {selectedItems.length}개 항목을 다른 브랜드로 복사합니다.
            </Typography>
            
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>대상 브랜드</InputLabel>
              <Select
                value={copyTargetBrand}
                onChange={(e) => setCopyTargetBrand(e.target.value)}
                label="대상 브랜드"
              >
                {brands.map(brand => (
                  <MenuItem key={brand} value={brand}>
                    {brand}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              * 이미 존재하는 코드는 정보가 업데이트됩니다.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              * 복사된 항목의 초기 재고는 0으로 설정됩니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCopyDialog}>취소</Button>
          <Button 
            onClick={handleCopyParts} 
            variant="contained" 
            color="primary"
            disabled={!copyTargetBrand}
          >
            복사
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PartsManagement; 