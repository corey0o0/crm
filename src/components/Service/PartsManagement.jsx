import React, { useState, useEffect } from 'react';
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
  TableSortLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

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
  const [uploadStatus, setUploadStatus] = useState({
    open: false,
    step: 0,
    total: 0,
    current: 0,
    message: ''
  });
  
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('code');

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

  const handleOpenDialog = (part = null) => {
    if (part) {
      setSelectedPart(part);
      setFormData({
        name: part.name || '',
        brand: part.brand || '',
        code: part.code || '',
        supplyPrice: part.supply_price?.toString() || '',
        price: part.price?.toString() || '',
        barcode: part.barcode || '',
        note: part.note || ''
      });
    } else {
      setSelectedPart(null);
      setFormData({
        name: '',
        brand: selectedBrand,
        code: '',
        supplyPrice: '',
        price: '',
        barcode: '',
        note: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPart(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['price', 'supplyPrice'].includes(name) ? value.replace(/[^0-9]/g, '') : value
    }));
  };

  const handleSubmit = async () => {
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
  };

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

  const filteredParts = parts.filter(part => {
    const matchesBrand = part.brand === selectedBrand;
    const matchesSearch = 
      part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.barcode?.includes(searchTerm) ||
      part.note?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  const sortedParts = sortData([...filteredParts], order, orderBy);

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

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">파츠 관리</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="엑셀 템플릿 다운로드">
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
            >
              템플릿
            </Button>
          </Tooltip>
          <Tooltip title="엑셀 파일 업로드">
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              component="label"
            >
              엑셀 등록
              <input
                type="file"
                hidden
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
              />
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            파츠 등록
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Tabs
          value={selectedBrand}
          onChange={(e, newValue) => setSelectedBrand(newValue)}
        >
          {brands.map((brand) => (
            <Tab key={brand} value={brand} label={brand === 'XRB' ? 'X-RIDER' : 'NEARBIKE'} />
          ))}
        </Tabs>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="파츠명, 상품코드, 바코드, 비고 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')}>
                <CloseIcon />
              </IconButton>
            </InputAdornment>
          )
        }}
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {renderSortableHeader('code', '상품코드')}
              {renderSortableHeader('name', '파츠명')}
              {renderSortableHeader('supply_price', '공급가', 'right')}
              {renderSortableHeader('price', '판매가', 'right')}
              {renderSortableHeader('barcode', '바코드', 'center')}
              {renderSortableHeader('note', '비고')}
              <TableCell align="center" sx={{ width: '14%' }}>관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedParts.length > 0 ? (
              sortedParts.map((part) => (
                <TableRow key={part.id} sx={{ '& td': { py: 1 } }}>
                  <TableCell>{part.code}</TableCell>
                  <TableCell>{part.name}</TableCell>
                  <TableCell align="right">{part.supply_price?.toLocaleString()}원</TableCell>
                  <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                  <TableCell align="center">{part.barcode}</TableCell>
                  <TableCell>{part.note}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleOpenDialog(part)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(part.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedPart ? '파츠 수정' : '파츠 등록'}
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
                label="비고"
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
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedPart ? '수정' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
}

export default PartsManagement; 