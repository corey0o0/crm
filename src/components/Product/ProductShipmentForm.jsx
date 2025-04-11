import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { supabase } from '../../lib/supabaseClient';

function ProductShipmentForm({ onSave }) {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    sales_channel: '',
    status: '준비중',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const { error } = await supabase.from('shipments').insert(formData);
    if (error) {
      console.error('Error saving shipment:', error);
    } else {
      onSave();
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        출고 등록
      </Typography>
      <TextField
        label="이름"
        name="customer_name"
        value={formData.customer_name}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <TextField
        label="연락처"
        name="customer_phone"
        value={formData.customer_phone}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <TextField
        label="판매처"
        name="sales_channel"
        value={formData.sales_channel}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <Button variant="contained" color="primary" onClick={handleSubmit}>
        저장
      </Button>
    </Box>
  );
}

export default ProductShipmentForm;
