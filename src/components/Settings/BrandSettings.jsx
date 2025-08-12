import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';

const BrandSettings = () => {
  const [brandSettings, setBrandSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // 브랜드 설정 조회
  const fetchBrandSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_settings')
        .select('*')
        .order('brand_code');

      if (error) {
        throw new Error(`브랜드 설정 조회 실패: ${error.message}`);
      }

      setBrandSettings(data || []);
    } catch (err) {
      console.error('브랜드 설정 조회 중 오류:', err);
      setSnackbar({
        open: true,
        message: `브랜드 설정 조회 실패: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // 자동 재고 차감 설정 변경
  const handleToggleInventoryDeduction = async (brandCode, currentValue) => {
    setUpdating(prev => ({ ...prev, [brandCode]: true }));

    try {
      const { error } = await supabase
        .from('brand_settings')
        .update({ 
          auto_inventory_deduction: !currentValue,
          updated_at: new Date().toISOString()
        })
        .eq('brand_code', brandCode);

      if (error) {
        throw new Error(`설정 업데이트 실패: ${error.message}`);
      }

      // 로컬 상태 업데이트
      setBrandSettings(prev => 
        prev.map(brand => 
          brand.brand_code === brandCode 
            ? { ...brand, auto_inventory_deduction: !currentValue }
            : brand
        )
      );

      setSnackbar({
        open: true,
        message: `${brandCode} 브랜드의 자동 재고 차감이 ${!currentValue ? '활성화' : '비활성화'}되었습니다.`,
        severity: 'success'
      });

    } catch (err) {
      console.error('설정 변경 중 오류:', err);
      setSnackbar({
        open: true,
        message: `설정 변경 실패: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setUpdating(prev => ({ ...prev, [brandCode]: false }));
    }
  };

  useEffect(() => {
    fetchBrandSettings();
  }, []);

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        브랜드 설정
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            자동 재고 차감 기능
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            브랜드별로 출고 완료 및 A/S 완료 시 자동으로 재고를 차감할지 설정할 수 있습니다.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>주의:</strong> 자동 재고 차감이 활성화된 브랜드의 경우, 상태를 "출고완료" 또는 "완료"로 변경하면 
            사용된 부품의 재고가 자동으로 차감됩니다.
          </Alert>
        </CardContent>
      </Card>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          브랜드별 설정
        </Typography>
        
        <Divider sx={{ mb: 3 }} />

        {brandSettings.length === 0 ? (
          <Alert severity="warning">
            등록된 브랜드가 없습니다. 데이터베이스에 브랜드 정보를 추가해주세요.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>브랜드</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell align="center">자동 재고 차감</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>마지막 수정</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brandSettings.map((brand) => (
                  <TableRow key={brand.brand_code} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight="medium">
                        {brand.brand_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={brand.brand_code} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={brand.auto_inventory_deduction}
                            onChange={() => handleToggleInventoryDeduction(
                              brand.brand_code, 
                              brand.auto_inventory_deduction
                            )}
                            disabled={updating[brand.brand_code]}
                            color="primary"
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                      {updating[brand.brand_code] && (
                        <CircularProgress size={16} sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={brand.auto_inventory_deduction ? '활성화' : '비활성화'}
                        color={brand.auto_inventory_deduction ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {brand.updated_at ? new Date(brand.updated_at).toLocaleDateString('ko-KR') : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ mt: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>재고 차감 대상:</strong><br />
              • <strong>출고관리</strong>: "출고완료" 상태로 변경 시<br />
              • <strong>A/S관리</strong>: "완료" 상태로 변경 시<br />
              <br />
              모든 재고 변동 내역은 <strong>재고 로그</strong>에서 확인할 수 있습니다.
            </Typography>
          </Alert>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BrandSettings;