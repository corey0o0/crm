import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { format } from 'date-fns';

const CustomerHistoryDialog = ({
  open,
  onClose,
  selectedCustomer,
  historyData,
  loading
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            고객 이력 - {selectedCustomer?.name} ({selectedCustomer?.phone})
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : historyData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              이 고객의 이력이 없습니다.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>구분</TableCell>
                  <TableCell>날짜</TableCell>
                  <TableCell>내용</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell align="right">금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyData.map((record, index) => (
                  <TableRow key={`${record.type}-${record.id}-${index}`}>
                    <TableCell>
                      <Chip
                        label={record.type === 'service' ? 'A/S' : '출고'}
                        size="small"
                        sx={{
                          bgcolor: record.type === 'service' ? '#e3f2fd' : '#f3e5f5',
                          color: record.type === 'service' ? '#1976d2' : '#7b1fa2'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.date), 'yyyy.MM.dd')}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {record.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {record.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: record.status === '완료' || record.status === '출고완료' ? '#4caf50' : '#ff9800',
                          color: record.status === '완료' || record.status === '출고완료' ? '#4caf50' : '#ff9800'
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {record.amount ? `${record.amount.toLocaleString()}원` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomerHistoryDialog;