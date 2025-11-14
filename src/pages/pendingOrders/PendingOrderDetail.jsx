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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  Grid,
  Card,
  CardContent,
  Stack,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { 
  getPendingOrders,
  matchProductToWebsiteItem,
  updatePendingOrderStatus,
  createOrderProcessingLog,
  updateOrderProcessingLog
} from '../../utils/pendingOrderUtils';
import { processOrderWithPlaywright, executeOrderSteps, searchProductOnWebsite, checkBackendServer } from '../../utils/orderAutomation';
import { downloadSetupScript, downloadStartScript, detectPlatform } from '../../utils/fileDownloadUtils';
import { format } from 'date-fns';

function PendingOrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [matchingDialog, setMatchingDialog] = useState({ open: false, item: null });
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [serverStatus, setServerStatus] = useState({ checked: false, online: false, message: '' });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    fetchPendingOrderDetail();
    checkServerStatus();
  }, [id]);

  const checkServerStatus = async () => {
    const status = await checkBackendServer();
    setServerStatus({
      checked: true,
      online: status.success,
      message: status.message
    });
  };

  useEffect(() => {
    if (action === 'order' && pendingOrder && orderItems.length > 0) {
      // 주문 처리 모드로 전환
      setSelectedItems(orderItems.filter(item => item.status !== 'out_of_stock'));
    }
  }, [action, pendingOrder, orderItems]);

  const fetchPendingOrderDetail = async () => {
    try {
      setLoading(true);
      const result = await getPendingOrders({});
      
      if (result.success) {
        const order = result.data.find(o => o.id === id);
        if (order) {
          setPendingOrder(order);
          setOrderItems(order.pending_order_items || []);
          setSelectedItems(order.pending_order_items?.filter(item => item.status !== 'out_of_stock') || []);
        } else {
          throw new Error('주문대기 정보를 찾을 수 없습니다.');
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('주문대기 상세 조회 중 오류:', error);
      setSnackbar({
        open: true,
        message: `주문대기 상세 조회 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/pending-orders');
  };

  const handleItemSelection = (itemId, checked) => {
    if (checked) {
      setSelectedItems(prev => [...prev, orderItems.find(item => item.id === itemId)]);
    } else {
      setSelectedItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const handleOpenMatchingDialog = (item) => {
    setMatchingDialog({ open: true, item });
    setSearchResult(null);
  };

  const handleCloseMatchingDialog = () => {
    setMatchingDialog({ open: false, item: null });
    setSearchResult(null);
  };

  const handleSearchProduct = async () => {
    if (!matchingDialog.item) return;

    // 서버 상태 확인
    if (!serverStatus.online) {
      setSnackbar({
        open: true,
        message: '백엔드 서버가 실행되지 않았습니다. 서버를 실행한 후 다시 시도하세요.',
        severity: 'error'
      });
      return;
    }

    try {
      setSearching(true);
      
      setSnackbar({
        open: true,
        message: '웹사이트에서 상품을 검색합니다. 백엔드 서버가 브라우저를 실행합니다.',
        severity: 'info'
      });

      // 백엔드 API를 통해 Playwright 실행하여 상품 검색
      const result = await searchProductOnWebsite(
        pendingOrder.brand,
        matchingDialog.item.part_name,
        matchingDialog.item.part_code,
        matchingDialog.item.barcode
      );
      
      if (result.success) {
        setSearchResult(result);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('상품 검색 중 오류:', error);
      setSnackbar({
        open: true,
        message: `상품 검색 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSearching(false);
    }
  };

  const handleMatchProduct = async (websiteProductId, websiteProductName) => {
    try {
      const result = await matchProductToWebsiteItem(
        matchingDialog.item.id,
        websiteProductId,
        websiteProductName
      );

      if (result.success) {
        // 로컬 상태 업데이트
        setOrderItems(prev => prev.map(item => 
          item.id === matchingDialog.item.id
            ? { ...item, matched_product_id: websiteProductId, matched_product_name: websiteProductName, status: 'matched' }
            : item
        ));

        setSnackbar({
          open: true,
          message: '상품 매칭이 완료되었습니다.',
          severity: 'success'
        });

        handleCloseMatchingDialog();
        fetchPendingOrderDetail();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('상품 매칭 중 오류:', error);
      setSnackbar({
        open: true,
        message: `상품 매칭 실패: ${error.message}`,
        severity: 'error'
      });
    }
  };

  const handleProcessOrder = async () => {
    if (selectedItems.length === 0) {
      setSnackbar({
        open: true,
        message: '주문할 상품을 선택해주세요.',
        severity: 'warning'
      });
      return;
    }

    // 서버 상태 확인
    if (!serverStatus.online) {
      setSnackbar({
        open: true,
        message: '백엔드 서버가 실행되지 않았습니다. 서버를 실행한 후 다시 시도하세요.',
        severity: 'error'
      });
      return;
    }

    // 매칭되지 않은 상품 확인
    const unmatchedItems = selectedItems.filter(item => !item.matched_product_id && item.status !== 'matched');
    if (unmatchedItems.length > 0) {
      const confirm = window.confirm(
        `매칭되지 않은 상품 ${unmatchedItems.length}개가 있습니다. 계속하시겠습니까?`
      );
      if (!confirm) return;
    }

    try {
      setProcessing(true);

      // 주문 처리 로그 시작
      const logResult = await createOrderProcessingLog(id, pendingOrder.brand, 'processing');
      if (!logResult.success) {
        throw new Error(`주문 처리 로그 생성 실패: ${logResult.message}`);
      }

      const logId = logResult.data.id;

      try {
        // 주문대기 상태를 처리중으로 변경
        await updatePendingOrderStatus(id, 'processing');

        // 주문 항목 준비
        const orderItemsForProcessing = selectedItems.map(item => ({
          itemId: item.id,
          partName: item.part_name,
          partCode: item.part_code,
          quantity: item.quantity,
          options: item.options || {},
          matchedProductId: item.matched_product_id,
          matchedProductName: item.matched_product_name || item.part_name,
          status: item.status
        }));

        // 백엔드 API를 통해 Playwright 실행하여 주문 처리
        const orderResult = await processOrderWithPlaywright(
          pendingOrder.brand,
          orderItemsForProcessing,
          id
        );

        if (orderResult.success) {
          // 주문 처리 로그 업데이트 (성공)
          await updateOrderProcessingLog(logId, 'success', orderResult.orderId);

          // 주문대기 상태를 완료로 변경
          await updatePendingOrderStatus(id, 'completed');

          setSnackbar({
            open: true,
            message: `주문이 완료되었습니다. 주문번호: ${orderResult.orderId || '미확인'}`,
            severity: 'success'
          });

          // 데이터 새로고침
          await fetchPendingOrderDetail();
        } else {
          throw new Error(orderResult.message);
        }
      } catch (orderError) {
        // 주문 처리 로그 업데이트 (실패)
        await updateOrderProcessingLog(logId, 'failed', null, orderError.message);

        // 주문대기 상태를 실패로 변경
        await updatePendingOrderStatus(id, 'failed');

        throw orderError;
      }
    } catch (error) {
      console.error('주문 처리 중 오류:', error);
      setSnackbar({
        open: true,
        message: `주문 처리 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'matched':
        return 'info';
      case 'out_of_stock':
        return 'error';
      case 'ordered':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'matched':
        return '매칭완료';
      case 'out_of_stock':
        return '품절';
      case 'ordered':
        return '주문완료';
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pendingOrder) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          주문대기 정보를 찾을 수 없습니다.
        </Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          목록으로 돌아가기
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          주문대기 상세
        </Typography>
      </Box>

      {/* 주문대기 정보 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                참조 타입
              </Typography>
              <Typography variant="body1">
                {pendingOrder.reference_type === 'service' ? 'A/S' : '출고'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                참조 ID
              </Typography>
              <Typography variant="body1">
                {pendingOrder.reference_id}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                브랜드
              </Typography>
              <Typography variant="body1">
                {getBrandLabel(pendingOrder.brand)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                상태
              </Typography>
              <Chip
                label={getStatusLabel(pendingOrder.status)}
                color={getStatusColor(pendingOrder.status)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                생성일
              </Typography>
              <Typography variant="body1">
                {format(new Date(pendingOrder.created_at), 'yyyy-MM-dd HH:mm')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                상품 수
              </Typography>
              <Typography variant="body1">
                {orderItems.length}개
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 백엔드 서버 상태 표시 */}
      {serverStatus.checked && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={serverStatus.online ? '백엔드 서버 실행 중' : '백엔드 서버 미실행'}
                  color={serverStatus.online ? 'success' : 'error'}
                  size="small"
                />
                <Typography variant="body2" color="textSecondary">
                  {serverStatus.message}
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={checkServerStatus}
              >
                확인
              </Button>
            </Box>
            {!serverStatus.online && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="body2" color="warning.dark" sx={{ mb: 2 }}>
                  백엔드 서버가 실행되지 않았습니다. 주문 처리를 하려면 서버를 실행해야 합니다.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={async () => {
                      const platform = detectPlatform();
                      const result = await downloadSetupScript(platform);
                      if (result.success) {
                        setSnackbar({
                          open: true,
                          message: `${result.filename} 파일이 다운로드되었습니다.`,
                          severity: 'success'
                        });
                      } else {
                        setSnackbar({
                          open: true,
                          message: `다운로드 실패: ${result.error}`,
                          severity: 'error'
                        });
                      }
                    }}
                  >
                    설치 스크립트 다운로드
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={async () => {
                      const platform = detectPlatform();
                      const result = await downloadStartScript(platform);
                      if (result.success) {
                        setSnackbar({
                          open: true,
                          message: `${result.filename} 파일이 다운로드되었습니다.`,
                          severity: 'success'
                        });
                      } else {
                        setSnackbar({
                          open: true,
                          message: `다운로드 실패: ${result.error}`,
                          severity: 'error'
                        });
                      }
                    }}
                  >
                    실행 스크립트 다운로드
                  </Button>
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
                  <strong>사용 방법:</strong>
                  <br />
                  1. 설치 스크립트를 다운로드하여 server 디렉토리에서 실행하세요.
                  <br />
                  2. 설치가 완료되면 실행 스크립트를 다운로드하여 서버를 시작하세요.
                  <br />
                  3. 또는 터미널에서 <code>cd server && npm start</code> 명령어로 서버를 실행하세요.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* 주문 처리 버튼 */}
      {pendingOrder.status === 'pending' && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchPendingOrderDetail}
          >
            새로고침
          </Button>
          <Button
            variant="contained"
            startIcon={<ShoppingCartIcon />}
            onClick={handleProcessOrder}
            disabled={processing || selectedItems.length === 0 || !serverStatus.online}
          >
            {processing ? '주문 처리 중...' : '주문 처리'}
          </Button>
        </Box>
      )}

      {processing && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            주문 처리 중입니다. 잠시만 기다려주세요...
          </Typography>
        </Box>
      )}

      {/* 주문 상품 목록 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {pendingOrder.status === 'pending' && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedItems.length > 0 && selectedItems.length < orderItems.length}
                    checked={orderItems.length > 0 && selectedItems.length === orderItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(orderItems.filter(item => item.status !== 'out_of_stock'));
                      } else {
                        setSelectedItems([]);
                      }
                    }}
                  />
                </TableCell>
              )}
              <TableCell>부품명</TableCell>
              <TableCell>부품 코드</TableCell>
              <TableCell>수량</TableCell>
              <TableCell>매칭 상품</TableCell>
              <TableCell>상태</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orderItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={pendingOrder.status === 'pending' ? 7 : 6} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    주문 상품이 없습니다.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orderItems.map((item) => (
                <TableRow 
                  key={item.id}
                  sx={{
                    backgroundColor: item.status === 'out_of_stock' ? 'rgba(211, 47, 47, 0.08)' : 'inherit'
                  }}
                >
                  {pendingOrder.status === 'pending' && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedItems.some(selected => selected.id === item.id)}
                        onChange={(e) => handleItemSelection(item.id, e.target.checked)}
                        disabled={item.status === 'out_of_stock'}
                      />
                    </TableCell>
                  )}
                  <TableCell>{item.part_name}</TableCell>
                  <TableCell>{item.part_code || '-'}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {item.matched_product_name || item.matched_product_id || '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(item.status)}
                      color={getStatusColor(item.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    {pendingOrder.status === 'pending' && item.status !== 'out_of_stock' && !item.matched_product_id && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenMatchingDialog(item)}
                        color="primary"
                        title="상품 매칭"
                      >
                        <SearchIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 상품 매칭 다이얼로그 */}
      <Dialog
        open={matchingDialog.open}
        onClose={handleCloseMatchingDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>상품 매칭</DialogTitle>
        <DialogContent>
          {matchingDialog.item && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                부품 정보
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    부품명
                  </Typography>
                  <Typography variant="body1">
                    {matchingDialog.item.part_name}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    부품 코드
                  </Typography>
                  <Typography variant="body1">
                    {matchingDialog.item.part_code || '-'}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<SearchIcon />}
                  onClick={handleSearchProduct}
                  disabled={searching}
                >
                  {searching ? '검색 중...' : '웹사이트에서 상품 검색'}
                </Button>
              </Box>

              {searchResult && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    검색 결과
                  </Typography>
                  {searchResult.outOfStock ? (
                    <Alert severity="warning">
                      해당 상품은 품절되었습니다.
                    </Alert>
                  ) : (
                    <Card>
                      <CardContent>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                          {searchResult.productName}
                        </Typography>
                        {searchResult.options && searchResult.options.length > 0 && (
                          <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>옵션 선택</InputLabel>
                            <Select
                              value=""
                              label="옵션 선택"
                            >
                              {searchResult.options.map((option, index) => (
                                <MenuItem key={index} value={option}>
                                  {option}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        <Button
                          variant="contained"
                          fullWidth
                          sx={{ mt: 2 }}
                          onClick={() => handleMatchProduct(searchResult.productId, searchResult.productName)}
                        >
                          이 상품으로 매칭
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMatchingDialog}>닫기</Button>
        </DialogActions>
      </Dialog>

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

export default PendingOrderDetail;

