import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';

const InventoryLogs = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [logs, setLogs] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    brandCode: '',
    changeType: '',
    referenceType: '',
    startDate: null,
    endDate: null,
    partName: ''
  });

  // 재고 로그 조회
  const fetchInventoryLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      // 필터 적용
      if (filters.brandCode) {
        query = query.eq('brand_code', filters.brandCode);
      }
      if (filters.changeType) {
        query = query.eq('change_type', filters.changeType);
      }
      if (filters.referenceType) {
        query = query.eq('reference_type', filters.referenceType);
      }
      if (filters.partName) {
        query = query.ilike('part_name', `%${filters.partName}%`);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`재고 로그 조회 실패: ${error.message}`);
      }

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('재고 로그 조회 중 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // stock_logs 조회
  const fetchStockLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('stock_logs')
        .select(`
          *,
          parts!inner(name, code, brand)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      // 필터 적용
      if (filters.partName) {
        query = query.ilike('parts.name', `%${filters.partName}%`);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`재고 로그 조회 실패: ${error.message}`);
      }

      setStockLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('재고 로그 조회 중 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 0) {
      fetchInventoryLogs();
    } else {
      fetchStockLogs();
    }
  }, [page, rowsPerPage, filters, currentTab]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
    setPage(0);
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setPage(0);
    setFilters({
      brandCode: '',
      changeType: '',
      referenceType: '',
      startDate: null,
      endDate: null,
      partName: ''
    });
  };

  const getChangeTypeLabel = (changeType) => {
    switch (changeType) {
      case 'shipment_complete':
        return '출고 완료';
      case 'service_complete':
        return 'A/S 완료';
      case 'shipment_revert':
        return '출고 취소';
      case 'service_revert':
        return 'A/S 취소';
      case 'manual_adjust':
        return '수동 조정';
      default:
        return changeType;
    }
  };


  const getBrandName = (brandCode) => {
    switch (brandCode) {
      case 'XRB':
        return 'X-RIDER';
      case 'NB':
        return 'NEARBIKE';
      default:
        return brandCode;
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box sx={{ maxWidth: '1400px', mx: 'auto', p: 3 }}>
        <Typography variant="h4" gutterBottom>
          재고 변경 내역
        </Typography>

        {/* 탭 메뉴 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label="자동 처리 내역" />
            <Tab label="수동 변경 내역" />
          </Tabs>
        </Paper>

        {/* 필터 섹션 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              필터 옵션
            </Typography>
            <Grid container spacing={2}>
              {currentTab === 0 && (
                <>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>브랜드</InputLabel>
                      <Select
                        value={filters.brandCode}
                        label="브랜드"
                        onChange={(e) => handleFilterChange('brandCode', e.target.value)}
                      >
                        <MenuItem value="">전체</MenuItem>
                        <MenuItem value="XRB">X-RIDER</MenuItem>
                        <MenuItem value="NB">NEARBIKE</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>변경 유형</InputLabel>
                      <Select
                        value={filters.changeType}
                        label="변경 유형"
                        onChange={(e) => handleFilterChange('changeType', e.target.value)}
                      >
                        <MenuItem value="">전체</MenuItem>
                        <MenuItem value="shipment_complete">출고 완료</MenuItem>
                        <MenuItem value="service_complete">A/S 완료</MenuItem>
                        <MenuItem value="shipment_revert">출고 취소</MenuItem>
                        <MenuItem value="service_revert">A/S 취소</MenuItem>
                        <MenuItem value="manual_adjust">수동 조정</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>처리 구분</InputLabel>
                      <Select
                        value={filters.referenceType}
                        label="처리 구분"
                        onChange={(e) => handleFilterChange('referenceType', e.target.value)}
                      >
                        <MenuItem value="">전체</MenuItem>
                        <MenuItem value="shipment">출고 처리</MenuItem>
                        <MenuItem value="service">A/S 처리</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="부품명 검색"
                  value={filters.partName}
                  onChange={(e) => handleFilterChange('partName', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <DatePicker
                  label="시작 날짜"
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <DatePicker
                  label="종료 날짜"
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 요약 정보 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            검색 결과: 총 {totalCount}건
          </Typography>
        </Paper>

        {/* 로그 테이블 */}
        <Paper sx={{ mb: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>변경 일시</TableCell>
                  {currentTab === 0 ? (
                    <>
                      <TableCell>브랜드</TableCell>
                      <TableCell>변경 유형</TableCell>
                      <TableCell>부품명</TableCell>
                      <TableCell>부품 코드</TableCell>
                      <TableCell align="center">변경 수량</TableCell>
                      <TableCell align="center">이전 수량</TableCell>
                      <TableCell align="center">변경 후 수량</TableCell>
                      <TableCell>참조 ID</TableCell>
                      <TableCell>비고</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>브랜드</TableCell>
                      <TableCell>부품명</TableCell>
                      <TableCell>부품 코드</TableCell>
                      <TableCell align="center">변경 수량</TableCell>
                      <TableCell align="center">이전 수량</TableCell>
                      <TableCell align="center">변경 후 수량</TableCell>
                      <TableCell>사유</TableCell>
                      <TableCell>수정자</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {currentTab === 0 ? (
                  logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <Alert severity="info" sx={{ border: 'none', boxShadow: 'none' }}>
                          검색 조건에 맞는 재고 변경 내역이 없습니다.
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateTime(log.created_at)}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Chip 
                          label={getBrandName(log.brand_code)} 
                          size="small" 
                          variant="outlined"
                          color={log.brand_code === 'NB' ? 'success' : 'default'}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {getChangeTypeLabel(log.change_type)}
                          </Typography>
                          {log.reference_type && (
                            <Typography variant="caption" color="text.secondary">
                              ({log.reference_type === 'shipment' ? '출고완료' : 'A/S완료'} 처리)
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {log.part_name}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {log.part_code || '-'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Typography 
                          variant="body2" 
                          color={log.quantity_change > 0 ? 'success.main' : 'error.main'}
                          fontWeight="medium"
                        >
                          {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Typography variant="body2">
                          {log.previous_quantity}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          {log.new_quantity}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        {log.reference_id ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label={log.reference_type === 'shipment' ? '출고' : 'A/S'}
                              size="small"
                              color={log.reference_type === 'shipment' ? 'primary' : 'secondary'}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              {log.reference_id.slice(-8)}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {log.notes || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                  )
                ) : (
                  stockLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Alert severity="info" sx={{ border: 'none', boxShadow: 'none' }}>
                          검색 조건에 맞는 수동 변경 내역이 없습니다.
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockLogs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDateTime(log.created_at)}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Chip 
                            label={getBrandName(log.parts.brand)} 
                            size="small" 
                            variant="outlined"
                            color={log.parts.brand === 'NB' ? 'success' : 'default'}
                          />
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {log.parts.name}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {log.parts.code || '-'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Typography 
                            variant="body2" 
                            color={log.quantity_change > 0 ? 'success.main' : 'error.main'}
                            fontWeight="medium"
                          >
                            {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Typography variant="body2">
                            {log.previous_quantity}
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="medium">
                            {log.new_quantity}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {log.reason || '-'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {log.updated_by || 'System'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="페이지당 행 수:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 총 ${count}개`}
          />
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default InventoryLogs;