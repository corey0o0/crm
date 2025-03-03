import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  Box, 
  Grid, 
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel 
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';

function AddCustomer({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    addressDetail: '',
    grade: 'V3'  // 기본 등급
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('customers')
        .insert([{
          name: formData.name,
          phone: formData.phone,
          address: `${formData.address} ${formData.addressDetail}`.trim(),
          grade: formData.grade
        }]);

      if (error) throw error;
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 600, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        고객 정보 입력
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            label="고객명"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            label="연락처"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="010-0000-0000"
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="주소"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="기본 주소"
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="상세 주소"
            name="addressDetail"
            value={formData.addressDetail}
            onChange={handleChange}
            placeholder="상세 주소를 입력해주세요"
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>고객 등급</InputLabel>
            <Select
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              label="고객 등급"
            >
              <MenuItem value="V1">V1 (VIP)</MenuItem>
              <MenuItem value="V2">V2 (우수)</MenuItem>
              <MenuItem value="V3">V3 (일반)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          type="submit" 
          variant="contained" 
          size="large"
        >
          고객 등록
        </Button>
      </Box>
    </Box>
  );
}

export default AddCustomer; 