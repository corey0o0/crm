import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

const CustomerSearchModal = ({
  open,
  onClose,
  searchValue,
  onSearchChange,
  onSearchKeyPress,
  searchResults,
  searchLoading,
  historyCounts,
  onHistoryClick,
  onCustomerSelect,
  historyLoading
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>고객 검색</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="고객명 또는 연락처를 입력하세요 (2글자 이상)"
          value={searchValue}
          onChange={onSearchChange}
          onKeyPress={onSearchKeyPress}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchLoading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            )
          }}
        />
        
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>고객명</TableCell>
                <TableCell>연락처</TableCell>
                <TableCell>주소</TableCell>
                <TableCell>기종</TableCell>
                <TableCell>구입처</TableCell>
                <TableCell>브랜드</TableCell>
                <TableCell align="center">기록보기</TableCell>
                <TableCell align="center">선택</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {searchResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {searchValue.length > 0 
                      ? '검색 결과가 없습니다.'
                      : '검색어를 입력하세요. (2글자 이상)'}
                  </TableCell>
                </TableRow>
              ) : (
                searchResults.map((customer, index) => (
                  <TableRow key={`${customer.phone}-${index}`}>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.address}</TableCell>
                    <TableCell>{customer.product_name || '-'}</TableCell>
                    <TableCell>{customer.seller || '-'}</TableCell>
                    <TableCell>{customer.brand || '-'}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onHistoryClick(customer)}
                        disabled={historyLoading}
                        sx={{
                          minWidth: '50px',
                          color: '#ff9800',
                          borderColor: '#ff9800',
                          '&:hover': {
                            bgcolor: 'rgba(255, 152, 0, 0.04)',
                            borderColor: '#f57c00'
                          }
                        }}
                      >
                        {historyLoading ? '...' : 
                          (historyCounts[`${customer.phone}_${customer.name}`] || '')
                        }
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        onClick={() => onCustomerSelect(customer)}
                        variant="contained"
                        sx={{
                          bgcolor: '#3182f6',
                          color: 'white',
                          '&:hover': {
                            bgcolor: '#1b64da'
                          }
                        }}
                      >
                        선택
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerSearchModal;