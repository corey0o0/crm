import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const PartsSelectionDialog = ({
  open,
  onClose,
  searchTerm,
  onSearchChange,
  onSearchKeyPress,
  parts,
  selectedPart,
  onPartSelect,
  onAddPart,
  quantity,
  onQuantityChange
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">부품 선택</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="부품명 또는 코드로 검색"
            value={searchTerm}
            onChange={onSearchChange}
            onKeyPress={onSearchKeyPress}
          />
          <TextField
            label="수량"
            type="number"
            size="small"
            value={quantity}
            onChange={onQuantityChange}
            sx={{ minWidth: 120 }}
            inputProps={{ min: 1 }}
          />
        </Box>
        
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>부품명</TableCell>
                <TableCell>부품코드</TableCell>
                <TableCell>브랜드</TableCell>
                <TableCell align="right">가격</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    검색 결과가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                parts.map((part) => (
                  <TableRow
                    key={part.id}
                    hover
                    selected={selectedPart?.id === part.id}
                    onClick={() => onPartSelect(part)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{part.name}</TableCell>
                    <TableCell>{part.code}</TableCell>
                    <TableCell>{part.brand}</TableCell>
                    <TableCell align="right">{part.price.toLocaleString()}원</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button 
          onClick={onAddPart} 
          variant="contained" 
          disabled={!selectedPart}
        >
          추가
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PartsSelectionDialog;