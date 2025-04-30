import React, { useState, useEffect } from 'react';
import {
  Box,
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
  TablePagination,
  Paper,
  IconButton,
  Typography,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  MenuItem,
  InputAdornment
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon
} from '@mui/icons-material';
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => {
    const savedSearchTerm = getCookie('product_searchTerm');
    return savedSearchTerm || '';
  });
  const [categoryFilter, setCategoryFilter] = useState(() => {
    const savedCategory = getCookie('product_categoryFilter');
    return savedCategory || 'all';
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const savedRowsPerPage = getCookie('product_rowsPerPage');
    return savedRowsPerPage ? parseInt(savedRowsPerPage, 10) : 10;
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const savedSortConfig = getJSONCookie('product_sortConfig');
    return savedSortConfig || {
      key: null,
      direction: 'asc'
    };
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    price: '',
    stock: '',
    description: ''
  });

  // 상태 변경 시 쿠키에 저장
  useEffect(() => {
    setCookie('product_searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setCookie('product_categoryFilter', categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    setCookie('product_rowsPerPage', rowsPerPage.toString());
  }, [rowsPerPage]);
  
  useEffect(() => {
    setJSONCookie('product_sortConfig', sortConfig);
  }, [sortConfig]);

  // 컴포넌트 언마운트 시 쿠키 정리
  useEffect(() => {
    return () => {
      if (window.location.pathname !== '/products') {
        removeCookie('product_searchTerm');
        removeCookie('product_categoryFilter');
        removeCookie('product_rowsPerPage');
        removeCookie('product_sortConfig');
      }
    };
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // 임시 데이터
      const dummyData = [
        { id: 1, code: 'P001', name: '제품1', category: '카테고리1', price: 10000, stock: 100, description: '설명1' },
        { id: 2, code: 'P002', name: '제품2', category: '카테고리2', price: 20000, stock: 200, description: '설명2' },
        { id: 3, code: 'P003', name: '제품3', category: '카테고리1', price: 15000, stock: 150, description: '설명3' },
        { id: 4, code: 'P004', name: '제품4', category: '카테고리3', price: 25000, stock: 50, description: '설명4' },
      ];
      setProducts(dummyData);
    } catch (error) {
      showSnackbar('제품 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 정렬된/필터링된 제품 목록
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      return a[sortConfig.key] > b[sortConfig.key] ? direction : -direction;
    });

  // 페이지네이션된 제품 목록
  const paginatedProducts = filteredProducts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 고유 카테고리 목록
  const categories = ['all', ...new Set(products.map(p => p.category))];

  const handleSort = (key) => {
    const newSortConfig = {
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    };
    setSortConfig(newSortConfig);
    setJSONCookie('product_sortConfig', newSortConfig);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    setCookie('product_rowsPerPage', newRowsPerPage.toString());
  };

  const handleSubmit = async () => {
    try {
      // 유효성 검사
      if (!formData.name || !formData.code || !formData.price || !formData.stock) {
        showSnackbar('필수 항목을 모두 입력해주세요.', 'error');
        return;
      }

      if (selectedProduct) {
        setProducts(prev => prev.map(p => 
          p.id === selectedProduct.id ? { ...formData, id: selectedProduct.id } : p
        ));
        showSnackbar('제품이 수정되었습니다.', 'success');
      } else {
        const newProduct = {
          ...formData,
          id: Date.now(),
          price: Number(formData.price),
          stock: Number(formData.stock)
        };
        setProducts(prev => [...prev, newProduct]);
        showSnackbar('제품이 등록되었습니다.', 'success');
      }
      handleCloseDialog();
    } catch (error) {
      showSnackbar('제품 저장에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        setProducts(prev => prev.filter(p => p.id !== id));
        showSnackbar('제품이 삭제되었습니다.', 'success');
      } catch (error) {
        showSnackbar('제품 삭제에 실패했습니다.', 'error');
      }
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData(product);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedProduct(null);
    setFormData({
      name: '',
      code: '',
      category: '',
      price: '',
      stock: '',
      description: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCookie('product_searchTerm', value);
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    setCategoryFilter(value);
    setCookie('product_categoryFilter', value);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">상품 관리</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            placeholder="검색..."
            value={searchTerm}
            onChange={handleSearchChange}
            sx={{ width: '50%' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            value={categoryFilter}
            onChange={handleCategoryChange}
            sx={{ minWidth: 120 }}
          >
            {categories.map((category) => (
              <MenuItem key={category} value={category}>
                {category === 'all' ? '전체 카테고리' : category}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            상품 등록
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell 
                onClick={() => handleSort('code')}
                sx={{ cursor: 'pointer' }}
              >
                코드
                {sortConfig.key === 'code' && (
                  sortConfig.direction === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
                )}
              </TableCell>
              <TableCell 
                onClick={() => handleSort('name')}
                sx={{ cursor: 'pointer' }}
              >
                상품명
                {sortConfig.key === 'name' && (
                  sortConfig.direction === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
                )}
              </TableCell>
              <TableCell>카테고리</TableCell>
              <TableCell 
                align="right"
                onClick={() => handleSort('price')}
                sx={{ cursor: 'pointer' }}
              >
                가격
                {sortConfig.key === 'price' && (
                  sortConfig.direction === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
                )}
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => handleSort('stock')}
                sx={{ cursor: 'pointer' }}
              >
                재고
                {sortConfig.key === 'stock' && (
                  sortConfig.direction === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
                )}
              </TableCell>
              <TableCell>설명</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  데이터가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.code}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell align="right">{product.price.toLocaleString()}원</TableCell>
                  <TableCell align="right">{product.stock}</TableCell>
                  <TableCell>{product.description}</TableCell>
                  <TableCell align="center">
                    <IconButton onClick={() => handleEdit(product)} size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(product.id)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredProducts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="페이지당 행 수:"
        />
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedProduct ? '상품 수정' : '상품 등록'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 2 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="상품 코드"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                required
                error={!formData.code}
                helperText={!formData.code && "상품 코드를 입력해주세요"}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="상품명"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                error={!formData.name}
                helperText={!formData.name && "상품명을 입력해주세요"}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="카테고리"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="가격"
                name="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                required
                error={!formData.price}
                helperText={!formData.price && "가격을 입력해주세요"}
                InputProps={{
                  endAdornment: <InputAdornment position="end">원</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="재고"
                name="stock"
                type="number"
                value={formData.stock}
                onChange={handleInputChange}
                required
                error={!formData.stock}
                helperText={!formData.stock && "재고를 입력해주세요"}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="설명"
                name="description"
                multiline
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedProduct ? '수정' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ProductList; 