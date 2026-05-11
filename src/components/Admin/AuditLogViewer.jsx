import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, MenuItem, Button, Chip, IconButton,
  TablePagination, CircularProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, InputAdornment, Grid, Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon,
  LocalShipping as ShippingIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { fetchAuditLogs } from '../../utils/auditLog';

const ACTION_COLORS = {
  '입고': 'success',
  '출고': 'info',
  '반품': 'warning',
  '삭제': 'error',
  '수정': 'default',
  '등록': 'primary',
  '취소': 'error',
  '상태변경': 'secondary'
};

const ACTION_ICONS = {
  '입고': <InventoryIcon fontSize="small" />,
  '출고': <ShippingIcon fontSize="small" />,
  '반품': <UndoIcon fontSize="small" />,
  '삭제': <DeleteIcon fontSize="small" />,
  '수정': <EditIcon fontSize="small" />,
  '등록': <AddIcon fontSize="small" />,
  '취소': <CloseIcon fontSize="small" />,
  '상태변경': <BuildIcon fontSize="small" />
};

const TABLE_LABELS = {
  'inventory_transactions': '입출고',
  'shipments': '출고관리',
  'shipment_parts': '출고부품',
  'services': 'A/S',
  'service_parts': 'A/S부품',
  'parts': '상품',
  'agencies': '거래처',
  'customers': '고객'
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // 필터
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 상세 보기
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };
      if (actionFilter) filters.action = actionFilter;
      if (tableFilter) filters.targetTable = tableFilter;
      if (userFilter) filters.userEmail = userFilter;
      if (searchTerm) filters.searchTerm = searchTerm;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const { data, count } = await fetchAuditLogs(filters);
      setLogs(data);
      setTotalCount(count);
    } catch (err) {
      console.error('로그 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, actionFilter, tableFilter, userFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearch = () => {
    setPage(0);
    loadLogs();
  };

  const handleReset = () => {
    setActionFilter('');
    setTableFilter('');
    setUserFilter('');
    setSearchTerm('');
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setPage(0);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const renderDetailsJson = (details) => {
    if (!details) return <Typography color="text.secondary">데이터 없음</Typography>;
    try {
      const str = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
      return (
        <Box
          component="pre"
          sx={{
            bgcolor: '#f5f5f5',
            p: 2,
            borderRadius: 1,
            fontSize: '0.8rem',
            maxHeight: 400,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {str}
        </Box>
      );
    } catch {
      return <Typography color="error">데이터 파싱 실패</Typography>;
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        📋 감사 로그
        <Chip label={`총 ${totalCount.toLocaleString()}건`} size="small" color="primary" variant="outlined" />
      </Typography>

      {/* 필터 영역 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              size="small"
              fullWidth
              type="date"
              label="시작일"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              size="small"
              fullWidth
              type="date"
              label="종료일"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              select
              size="small"
              fullWidth
              label="동작"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {['입고', '출고', '반품', '삭제', '수정', '등록', '취소', '상태변경'].map(a => (
                <MenuItem key={a} value={a}>{a}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}>
            <TextField
              select
              size="small"
              fullWidth
              label="모듈"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {Object.entries(TABLE_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              size="small"
              fullWidth
              placeholder="내용 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleSearch} startIcon={<SearchIcon />}>
                조회
              </Button>
              <Button variant="outlined" size="small" onClick={handleReset}>
                초기화
              </Button>
              <IconButton size="small" onClick={loadLogs} color="primary">
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* 로그 테이블 */}
      <TableContainer component={Paper}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        <Table size="small" sx={{ 
          border: '1px solid rgba(224, 224, 224, 1)', 
          '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' },
          '& .MuiTableCell-root': { fontSize: '0.85rem', padding: '6px 10px' }
        }}>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell width={130}>시간</TableCell>
              <TableCell width={70} align="center">동작</TableCell>
              <TableCell width={80} align="center">모듈</TableCell>
              <TableCell>내용</TableCell>
              <TableCell width={140}>사용자</TableCell>
              <TableCell width={50} align="center">상세</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">조회된 로그가 없습니다.</Typography>
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  {formatDate(log.created_at)}
                </TableCell>
                <TableCell align="center">
                  <Chip
                    icon={ACTION_ICONS[log.action]}
                    label={log.action}
                    size="small"
                    color={ACTION_COLORS[log.action] || 'default'}
                    variant="outlined"
                    sx={{ fontWeight: 600, minWidth: 60 }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={TABLE_LABELS[log.target_table] || log.target_table}
                    size="small"
                    variant="filled"
                    sx={{ 
                      bgcolor: 'grey.100', 
                      fontWeight: 500,
                      fontSize: '0.75rem'
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title={log.summary || ''} placement="top-start">
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {log.summary || '-'}
                    </Typography>
                  </Tooltip>
                  {log.group_id && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      그룹: {log.group_id}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {log.user_email ? log.user_email.split('@')[0] : '-'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {log.details && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedLog(log);
                        setDetailOpen(true);
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[20, 50, 100]}
        labelRowsPerPage="페이지당 행:"
      />

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            📋 로그 상세
            {selectedLog && (
              <Chip
                label={selectedLog.action}
                size="small"
                color={ACTION_COLORS[selectedLog.action] || 'default'}
              />
            )}
          </Box>
          <IconButton size="small" onClick={() => setDetailOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">시간</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatDate(selectedLog.created_at)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">사용자</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedLog.user_email}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">모듈</Typography>
                  <Typography variant="body2" fontWeight="bold">{TABLE_LABELS[selectedLog.target_table] || selectedLog.target_table}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">대상 ID</Typography>
                  <Typography variant="body2" fontWeight="bold">{selectedLog.target_id || '-'}</Typography>
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary">내용</Typography>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                {selectedLog.summary}
              </Typography>

              {selectedLog.group_id && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">그룹 ID</Typography>
                  <Typography variant="body2">{selectedLog.group_id}</Typography>
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                데이터 스냅샷
              </Typography>
              {renderDetailsJson(selectedLog.details)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
