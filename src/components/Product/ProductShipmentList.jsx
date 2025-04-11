import React, { useState, useEffect } from 'react';
import { Box, Typography, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Chip } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

function ProductShipmentList() {
  const [shipments, setShipments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    const { data, error } = await supabase.from('shipments').select('*');
    if (error) {
      console.error('Error fetching shipments:', error);
    } else {
      setShipments(data);
    }
  };

  const handleEdit = (id) => {
    navigate(`/shipments/${id}`);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('shipments').delete().eq('id', id);
    if (error) {
      console.error('Error deleting shipment:', error);
    } else {
      setShipments((prev) => prev.filter((shipment) => shipment.id !== id));
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        출고 목록
      </Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>주문일자</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>연락처</TableCell>
              <TableCell>판매처</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shipments.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell>{shipment.shipment_date}</TableCell>
                <TableCell>{shipment.customer_name}</TableCell>
                <TableCell>{shipment.customer_phone}</TableCell>
                <TableCell>
                  <Chip label={shipment.sales_channel} size="small" />
                </TableCell>
                <TableCell>{shipment.status}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(shipment.id)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(shipment.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ProductShipmentList;
