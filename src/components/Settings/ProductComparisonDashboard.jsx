import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, CircularProgress, Alert
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://crm-production-067b.up.railway.app' 
  : 'http://localhost:5001';

export default function ProductComparisonDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mergedData, setMergedData] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch CRM Parts
      const { data: crmParts, error: crmErr } = await supabase.from('parts').select('*');
      if (crmErr) throw crmErr;

      // 2. Fetch Ecount Products
      const ecountRes = await fetch(`${BACKEND_URL}/api/ecount/products`);
      const ecountData = await ecountRes.json();
      if (!ecountData.success) throw new Error(ecountData.error || '이카운트 조회 실패');

      // 3. Fetch Cafe24 Products
      const cafe24Res = await fetch(`${BACKEND_URL}/api/cafe24/products`);
      const cafe24Data = await cafe24Res.json();
      if (!cafe24Data.success) throw new Error(cafe24Data.error || '카페24 조회 실패');

      // 4. Merge datasets by Product Code
      const codeMap = {}; // Key: product_code

      // Add CRM data
      (crmParts || []).forEach(p => {
        if (!codeMap[p.code]) codeMap[p.code] = { code: p.code, crm: null, ecount: null, cafe24: null };
        codeMap[p.code].crm = { name: p.name, barcode: p.barcode };
      });

      // Add Ecount data
      (ecountData.products || []).forEach(p => {
        const code = p.PROD_CD;
        if (!codeMap[code]) codeMap[code] = { code, crm: null, ecount: null, cafe24: null };
        codeMap[code].ecount = { name: p.PROD_DES, barcode: p.BAR_CODE };
      });

      // Add Cafe24 data
      (cafe24Data.products || []).forEach(p => {
        // Cafe24 utilizes custom_product_code primarily in ERPs
        const code = p.custom_product_code || p.product_code; 
        if (!codeMap[code]) codeMap[code] = { code, crm: null, ecount: null, cafe24: null };
        codeMap[code].cafe24 = { name: p.product_name, barcode: p.barcode };
      });

      setMergedData(Object.values(codeMap));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">상품 비교 대시보드 (CRM vs 이카운트 vs 카페24)</Typography>
        <Button variant="contained" onClick={fetchData} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : '새로고침'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell rowSpan={2} align="center" sx={{ borderRight: '1px solid #ddd', fontWeight: 'bold' }}>상품 코드</TableCell>
              <TableCell colSpan={2} align="center" sx={{ borderRight: '1px solid #ddd', fontWeight: 'bold', color: 'primary.main' }}>CRM (내부 DB)</TableCell>
              <TableCell colSpan={2} align="center" sx={{ borderRight: '1px solid #ddd', fontWeight: 'bold', color: 'success.main' }}>이카운트 ERP</TableCell>
              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>카페24</TableCell>
            </TableRow>
            <TableRow>
              <TableCell align="center">품명</TableCell>
              <TableCell align="center" sx={{ borderRight: '1px solid #ddd' }}>바코드</TableCell>
              <TableCell align="center">품명</TableCell>
              <TableCell align="center" sx={{ borderRight: '1px solid #ddd' }}>바코드</TableCell>
              <TableCell align="center">품명</TableCell>
              <TableCell align="center">바코드</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mergedData.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} align="center">데이터가 없습니다.</TableCell></TableRow>
            )}
            {mergedData.map(row => {
              // 불일치 여부 계산 (간단 예시: 이름이 다를 경우)
              // 여기서는 일단 유무(존재 여부) 및 바코드 불일치만 하이라이트 할 수 있습니다.
              return (
                <TableRow key={row.code} hover>
                  <TableCell align="center" sx={{ fontWeight: 'bold', borderRight: '1px solid #ddd' }}>{row.code}</TableCell>
                  
                  {/* CRM */}
                  <TableCell align="center" sx={{ bgcolor: row.crm ? 'transparent' : '#fff0f0' }}>{row.crm?.name || '-'}</TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid #ddd', bgcolor: row.crm ? 'transparent' : '#fff0f0' }}>{row.crm?.barcode || '-'}</TableCell>
                  
                  {/* Ecount */}
                  <TableCell align="center" sx={{ bgcolor: row.ecount ? 'transparent' : '#fff0f0' }}>{row.ecount?.name || '-'}</TableCell>
                  <TableCell align="center" sx={{ borderRight: '1px solid #ddd', bgcolor: row.ecount ? 'transparent' : '#fff0f0' }}>{row.ecount?.barcode || '-'}</TableCell>
                  
                  {/* Cafe24 */}
                  <TableCell align="center" sx={{ bgcolor: row.cafe24 ? 'transparent' : '#fff0f0' }}>{row.cafe24?.name || '-'}</TableCell>
                  <TableCell align="center" sx={{ bgcolor: row.cafe24 ? 'transparent' : '#fff0f0' }}>{row.cafe24?.barcode || '-'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
