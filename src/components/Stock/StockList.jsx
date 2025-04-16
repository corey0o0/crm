import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button, MenuItem, CircularProgress, Snackbar, Alert, IconButton
} from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';

function StockList() {
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [brand, setBrand] = useState('전체');
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [sortConfig, setSortConfig] = useState({ key: 'brand', direction: 'asc' });
  const brandOptions = ['전체', 'XRB', 'NB'];

  useEffect(() => {
    fetchParts();
  }, [brand]);

  const fetchParts = async () => {
    setLoading(true);
    let query = supabase.from('parts').select('*');
    if (brand !== '전체') query = query.eq('brand', brand);
    const { data, error } = await query;
    if (error) {
      setSnackbar({ open: true, message: '재고 목록을 불러오지 못했습니다.', severity: 'error' });
      setParts([]);
    } else {
      setParts(data || []);
    }
    setLoading(false);
  };

  const handleStockChange = (id, value) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, stock: value } : p));
  };

  const handleSaveStock = async (id, stock) => {
    const { error } = await supabase.from('parts').update({ stock: Number(stock) }).eq('id', id);
    if (error) {
      setSnackbar({ open: true, message: '재고 저장 실패', severity: 'error' });
    } else {
      setSnackbar({ open: true, message: '재고가 저장되었습니다.', severity: 'success' });
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        return { key, direction: 'asc' };
      }
    });
  };

  const filteredParts = parts.filter(part =>
    part.name?.toLowerCase().includes(search.toLowerCase()) ||
    part.code?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedParts = [...filteredParts].sort((a, b) => {
    const { key, direction } = sortConfig;
    let aValue = a[key];
    let bValue = b[key];
    // 숫자 정렬
    if (key === 'price' || key === 'stock') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    } else {
      aValue = aValue ? aValue.toString().toLowerCase() : '';
      bValue = bValue ? bValue.toString().toLowerCase() : '';
    }
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortArrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon sx={{ fontSize: 32 }} /> 재고 관리
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            label="브랜드"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            sx={{ width: 150 }}
          >
            {brandOptions.map(opt => (
              <MenuItem key={opt} value={opt}>{opt === 'XRB' ? 'X-RIDER' : opt === 'NB' ? 'NEARBIKE' : '전체'}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="제품명/코드 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ width: 300 }}
          />
        </Box>
      </Paper>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell onClick={() => handleSort('brand')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  브랜드{sortArrow('brand')}
                </TableCell>
                <TableCell onClick={() => handleSort('name')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  제품명{sortArrow('name')}
                </TableCell>
                <TableCell onClick={() => handleSort('code')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  코드{sortArrow('code')}
                </TableCell>
                <TableCell align="right" onClick={() => handleSort('price')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  단가{sortArrow('price')}
                </TableCell>
                <TableCell align="right" onClick={() => handleSort('stock')} sx={{ cursor: 'pointer', fontWeight: 700 }}>
                  재고{sortArrow('stock')}
                </TableCell>
                <TableCell align="center">
                  저장
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedParts.map(part => (
                <TableRow key={part.id}>
                  <TableCell>{part.brand}</TableCell>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{part.code}</TableCell>
                  <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      size="small"
                      value={part.stock ?? 0}
                      onChange={e => handleStockChange(part.id, e.target.value)}
                      sx={{ width: 80 }}
                      inputProps={{ min: 0 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleSaveStock(part.id, part.stock)}
                    >
                      저장
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default StockList; 