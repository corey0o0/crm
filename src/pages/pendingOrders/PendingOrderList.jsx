import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TextField,
  InputAdornment,
  Snackbar,
  Alert,
  Grid,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  ShoppingCart as ShoppingCartIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getPendingOrders } from '../../utils/pendingOrderUtils';
import { format } from 'date-fns';

function PendingOrderList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    fetchPendingOrders();
  }, [selectedBrand, statusFilter]);

  const fetchPendingOrders = async () => {
    try {
      setLoading(true);
      const filters = {};
      
      if (selectedBrand !== 'all') {
        filters.brand = selectedBrand;
      }
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const result = await getPendingOrders(filters);
      
      if (result.success) {
        setPendingOrders(result.data || []);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('주문대기 목록 조회 중 오류:', error);
      setSnackbar({
        open: true,
        message: `주문대기 목록 조회 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBrandChange = (event) => {
    setSelectedBrand(event.target.value);
  };

  const handleStatusChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleSearch = () => {
    fetchPendingOrders();
  };

  const handleViewDetail = (orderId) => {
    navigate(`/pending-orders/${orderId}`);
  };

  const handleOrderProcessing = (orderId) => {
    navigate(`/pending-orders/${orderId}?action=order`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'processing':
        return '처리중';
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      default:
        return status;
    }
  };

  const getBrandLabel = (brand) => {
    switch (brand) {
      case 'XRB':
        return 'X-RIDER';
      case 'NB':
        return 'NEARBIKE';
      default:
        return brand;
    }
  };

  const getReferenceTypeLabel = (type) => {
    switch (type) {
      case 'service':
        return 'A/S';
      case 'shipment':
        return '출고';
      default:
        return type;
    }
  };

  const filteredOrders = pendingOrders.filter(order => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      order.reference_id.toString().includes(searchLower) ||
      order.reference_type.toLowerCase().includes(searchLower) ||
      (order.pending_order_items && order.pending_order_items.some(
        item => item.part_name.toLowerCase().includes(searchLower)
      ))
    );
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          주문대기 관리
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchPendingOrders}
        >
          새로고침
        </Button>
      </Box>

      {/* 필터 및 검색 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>브랜드</InputLabel>
              <Select
                value={selectedBrand}
                onChange={handleBrandChange}
                label="브랜드"
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="XRB">X-RIDER</MenuItem>
                <MenuItem value="NB">NEARBIKE</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>상태</InputLabel>
              <Select
                value={statusFilter}
                onChange={handleStatusChange}
                label="상태"
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="pending">대기중</MenuItem>
                <MenuItem value="processing">처리중</MenuItem>
                <MenuItem value="completed">완료</MenuItem>
                <MenuItem value="failed">실패</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="참조 ID, 부품명으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
            >
              검색
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                전체 주문대기
              </Typography>
              <Typography variant="h4">
                {pendingOrders.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                대기중
              </Typography>
              <Typography variant="h4" color="default.main">
                {pendingOrders.filter(o => o.status === 'pending').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                처리중
              </Typography>
              <Typography variant="h4" color="warning.main">
                {pendingOrders.filter(o => o.status === 'processing').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                완료
              </Typography>
              <Typography variant="h4" color="success.main">
                {pendingOrders.filter(o => o.status === 'completed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 주문대기 목록 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>참조 타입</TableCell>
              <TableCell>참조 ID</TableCell>
              <TableCell>브랜드</TableCell>
              <TableCell>상품 수</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>생성일</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    주문대기 목록이 없습니다.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    {getReferenceTypeLabel(order.reference_type)}
                  </TableCell>
                  <TableCell>
                    {order.reference_id}
                  </TableCell>
                  <TableCell>
                    {getBrandLabel(order.brand)}
                  </TableCell>
                  <TableCell>
                    {order.pending_order_items?.length || 0}개
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(order.status)}
                      color={getStatusColor(order.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetail(order.id)}
                        color="primary"
                        title="상세보기"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      {order.status === 'pending' && (
                        <IconButton
                          size="small"
                          onClick={() => handleOrderProcessing(order.id)}
                          color="success"
                          title="주문 처리"
                        >
                          <ShoppingCartIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PendingOrderList;

