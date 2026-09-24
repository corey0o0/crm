import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';

function PurchaseOrderManagement() {
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchParts = useCallback(async () => {
    setLoadingParts(true);
    try {
      if (isOffline()) {
        showSnackbar('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return;
      }
      const { data, error } = await safeRetry(() =>
        supabase.from('parts').select('id, name, brand, code, track_inventory').order('brand').order('name')
      );
      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingParts(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const filteredParts = parts.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
  });

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>발주 관리</Typography>

      <TextField
        size="small"
        placeholder="브랜드/코드/이름 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, width: 300 }}
      />

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <TableContainer component={Paper} sx={{ maxWidth: 500 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>브랜드</TableCell>
                <TableCell>코드</TableCell>
                <TableCell>이름</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.brand}</TableCell>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PurchaseOrderManagement;
