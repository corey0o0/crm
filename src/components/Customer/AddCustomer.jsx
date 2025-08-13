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
  InputLabel,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';

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

  // 엑셀 업로드 처리
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = await readExcelFile(file);

        // 데이터 형식 검증 및 변환
        const formattedData = data.map(row => ({
          name: row.name || '',
          phone: row.phone || '',
          address: row.address || '',
          grade: ['V1', 'V2', 'V3'].includes(row.grade) ? row.grade : 'V3'
        }));

        // 유효성 검사
        const validData = formattedData.filter(row => 
          row.name && 
          row.phone && 
          row.address
        );

        if (validData.length === 0) {
          alert('유효한 데이터가 없습니다.');
          return;
        }

        // Supabase에 데이터 삽입
        const { error } = await supabase
          .from('customers')
          .insert(validData);

        if (error) throw error;

        alert(`${validData.length}명의 고객이 등록되었습니다.`);
        if (onSuccess) onSuccess();

      } catch (error) {
        console.error('Error processing excel:', error);
        alert('엑셀 처리 중 오류가 발생했습니다.');
      }
    };

    if (file) {
      reader.readAsBinaryString(file);
    }
  };

  // 엑셀 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const template = [
      {
        name: '홍길동',
        phone: '010-1234-5678',
        address: '서울시 강남구 테헤란로 123',
        grade: 'V3'
      }
    ];

    const headers = [
      { label: 'name', key: 'name' },
      { label: 'phone', key: 'phone' },
      { label: 'address', key: 'address' },
      { label: 'grade', key: 'grade' }
    ];

    downloadExcel(template, headers, "customer_template.xlsx");
  };

  return (
    <Box sx={{ maxWidth: 600, m: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Tooltip title="엑셀 템플릿 다운로드">
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
          >
            템플릿
          </Button>
        </Tooltip>
        <Tooltip title="엑셀 파일 업로드">
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            component="label"
          >
            엑셀 등록
            <input
              type="file"
              hidden
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
            />
          </Button>
        </Tooltip>
      </Stack>

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
    </Box>
  );
}

export default AddCustomer; 