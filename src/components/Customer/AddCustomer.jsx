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
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { handlePhoneInput, normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phoneUtils';

function AddCustomer({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    addressDetail: '',
    grade: 'V3'
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (/[ㄱ-ㅎㅏ-ㅣ]/.test(formData.phone)) {
      setSnackbar({ open: true, message: '전화번호에 한글 자모가 포함되어 있습니다. 숫자로 입력해주세요.', severity: 'warning' });
      return;
    }

    if (!isValidPhoneNumber(formData.phone)) {
      setSnackbar({ open: true, message: '올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)', severity: 'warning' });
      return;
    }

    try {
      const normalizedPhone = normalizePhoneNumber(formData.phone);

      const { error } = await supabase
        .from('customers')
        .insert([{
          name: formData.name,
          phone: normalizedPhone,
          address: `${formData.address} ${formData.addressDetail}`.trim(),
          grade: formData.grade
        }]);

      if (error) throw error;

      setSnackbar({ open: true, message: '고객이 정상적으로 등록되었습니다.', severity: 'success' });
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err) {
      console.error('Error adding customer:', err);
      setSnackbar({ open: true, message: '고객 등록 중 오류가 발생했습니다.', severity: 'error' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const normalizedPhone = handlePhoneInput(value);
      setFormData({
        ...formData,
        [name]: normalizedPhone
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = await readExcelFile(file);

        const formattedData = data.map(row => ({
          name: row.name || '',
          phone: row.phone || '',
          address: row.address || '',
          grade: ['V1', 'V2', 'V3'].includes(row.grade) ? row.grade : 'V3'
        }));

        const validData = formattedData.filter(row =>
          row.name &&
          row.phone &&
          row.address
        );

        if (validData.length === 0) {
          setSnackbar({ open: true, message: '유효한 데이터가 없습니다.', severity: 'warning' });
          return;
        }

        const { error } = await supabase
          .from('customers')
          .insert(validData);

        if (error) throw error;

        setSnackbar({ open: true, message: `${validData.length}명의 고객이 등록되었습니다.`, severity: 'success' });
        if (onSuccess) setTimeout(onSuccess, 1500);

      } catch (error) {
        console.error('Error processing excel:', error);
        setSnackbar({ open: true, message: '엑셀 처리 중 오류가 발생했습니다.', severity: 'error' });
      }
    };

    if (file) {
      reader.readAsBinaryString(file);
    }
  };

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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: '50% !important', transform: 'translateY(-50%)' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ minWidth: '300px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '1rem' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AddCustomer;
