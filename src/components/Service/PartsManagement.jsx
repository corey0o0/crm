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
  Tab
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

  const brands = ['XRB', 'NB']; // 브랜드 목록 수정

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

      // barcode와 note가 있는 경우에만 추가
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

  const handleExcelUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const validData = data.filter(row => {
          const isValid = 
            row.brand && 
            row.code && 
            row.name && 
            row.supplyPrice && 
            row.price;
          
          return isValid;
        });

        if (validData.length === 0) {
          showSnackbar('유효한 데이터가 없습니다.', 'error');
          return;
        }

        const formattedData = validData.map(row => ({
          id: Date.now() + Math.random(),
          brand: String(row.brand).toUpperCase(),
          code: String(row.code),
          name: String(row.name),
          supplyPrice: Number(row.supplyPrice),
          price: Number(row.price),
          barcode: row.barcode ? String(row.barcode) : '',
          note: row.note ? String(row.note) : ''
        }));

        setParts(prev => [...prev, ...formattedData]);
        showSnackbar(`${formattedData.length}개의 파츠가 등록되었습니다.`, 'success');
      } catch (error) {
        console.error('엑셀 파일 처리 중 오류:', error);
        showSnackbar('엑셀 파일 처리 중 오류가 발생했습니다.', 'error');
      }
    };

    if (file) {
      reader.readAsBinaryString(file);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        brand: 'XRB',
        code: 'XL-001',
        name: '컴프레서',
        supplyPrice: '100000',
        price: '150000',
        barcode: '8801234567890'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    // 컬럼 너비 설정
    const wscols = [
      { wch: 10 },  // brand
      { wch: 15 },  // code
      { wch: 20 },  // name
      { wch: 12 },  // supplyPrice
      { wch: 12 },  // price
      { wch: 15 },  // barcode
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
      part.barcode?.includes(searchTerm);
    return matchesBrand && matchesSearch;
  });

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
        placeholder="파츠명, 상품코드, 바코드로 검색"
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
              <TableCell sx={{ width: '15%' }}>상품코드</TableCell>
              <TableCell sx={{ width: '20%' }}>파츠명</TableCell>
              <TableCell align="right" sx={{ width: '12%' }}>공급가</TableCell>
              <TableCell align="right" sx={{ width: '12%' }}>판매가</TableCell>
              <TableCell align="center" sx={{ width: '12%' }}>바코드</TableCell>
              <TableCell sx={{ width: '15%' }}>비고</TableCell>
              <TableCell align="center" sx={{ width: '14%' }}>관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredParts.length > 0 ? (
              filteredParts.map((part) => (
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
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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
    </Box>
  );
}

export default PartsManagement; 