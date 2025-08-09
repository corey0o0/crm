import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Typography,
  Chip,
  Stack
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

// 접수방법과 배송방법 옵션
const RECEPTION_TYPES = ['공홈', '방문', '전화', '대리점', '기타'];
const DELIVERY_METHODS = ['방문수령', '택배', '퀵-선불', '퀵-착불'];

const FormBasicInfo = ({
  formData,
  onFormChange,
  onCustomerSearch,
  timeOptions,
  brands = []
}) => {
  const handleInputChange = (field) => (event) => {
    onFormChange({
      ...formData,
      [field]: event.target.value
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        기본 정보
      </Typography>
      
      <Grid container spacing={2}>
        {/* 고객 정보 */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="고객명"
            value={formData.customer_name || ''}
            onChange={handleInputChange('customer_name')}
            InputProps={{
              endAdornment: (
                <Button
                  size="small"
                  onClick={onCustomerSearch}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  <SearchIcon fontSize="small" />
                </Button>
              )
            }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="연락처"
            value={formData.customer_phone || ''}
            onChange={handleInputChange('customer_phone')}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            label="주소"
            value={formData.customer_address || ''}
            onChange={handleInputChange('customer_address')}
          />
        </Grid>

        {/* 브랜드 및 제품 정보 */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth size="small">
            <InputLabel>브랜드</InputLabel>
            <Select
              value={formData.brand || ''}
              onChange={handleInputChange('brand')}
              label="브랜드"
            >
              {brands.map((brand) => (
                <MenuItem key={brand} value={brand}>
                  {brand}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="제품명"
            value={formData.product_name || ''}
            onChange={handleInputChange('product_name')}
          />
        </Grid>

        {/* 날짜 및 시간 */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            label="접수일자"
            type="date"
            value={formData.reception_date || ''}
            onChange={handleInputChange('reception_date')}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>접수시간</InputLabel>
            <Select
              value={formData.reception_time || ''}
              onChange={handleInputChange('reception_time')}
              label="접수시간"
            >
              {timeOptions.map((time) => (
                <MenuItem key={time} value={time}>
                  {time}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>접수방법</InputLabel>
            <Select
              value={formData.reception_type || ''}
              onChange={handleInputChange('reception_type')}
              label="접수방법"
            >
              {RECEPTION_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* 증상 및 처리내역 */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            label="증상/문의내용"
            value={formData.symptom || ''}
            onChange={handleInputChange('symptom')}
            multiline
            rows={3}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            label="처리내역"
            value={formData.solution || ''}
            onChange={handleInputChange('solution')}
            multiline
            rows={3}
          />
        </Grid>

        {/* 기타 정보 */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="구매처"
            value={formData.seller || ''}
            onChange={handleInputChange('seller')}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth size="small">
            <InputLabel>배송방법</InputLabel>
            <Select
              value={formData.delivery_method || ''}
              onChange={handleInputChange('delivery_method')}
              label="배송방법"
            >
              {DELIVERY_METHODS.map((method) => (
                <MenuItem key={method} value={method}>
                  {method}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            label="메모"
            value={formData.note || ''}
            onChange={handleInputChange('note')}
            multiline
            rows={2}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default FormBasicInfo;