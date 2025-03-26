import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';

function ReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setReceipts(data);
    } catch (err) {
      console.error('Error fetching receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '분석중': return 'warning';
      case '완료': return 'success';
      case '오류': return 'error';
      default: return 'default';
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>업로드 일시</TableCell>
            <TableCell>파일명</TableCell>
            <TableCell>상태</TableCell>
            <TableCell align="center">원본 보기</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {receipts.map((receipt) => (
            <TableRow key={receipt.id} hover>
              <TableCell>
                {new Date(receipt.upload_date).toLocaleString()}
              </TableCell>
              <TableCell>{receipt.original_filename}</TableCell>
              <TableCell>
                <Chip
                  label={receipt.status}
                  color={getStatusColor(receipt.status)}
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Tooltip title="원본 영수증 보기">
                  <IconButton
                    size="small"
                    href={receipt.drive_view_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ReceiptList; 