import React, { useState } from 'react';
import {
  Paper,
  Tabs,
  Tab,
  Box,
  Button,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Download as DownloadIcon
} from '@mui/icons-material';
import CustomerList from './CustomerList';
import AddCustomer from './AddCustomer';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      inert={value !== index ? "" : undefined}
      id={`customer-tabpanel-${index}`}
      aria-labelledby={`customer-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function CustomerManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // 고객 목록 엑셀 다운로드
  const handleDownloadExcel = async () => {
    try {
      // Supabase에서 모든 고객 데이터 가져오기
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 데이터 가공
      const exportData = data.map(customer => ({
        고객명: customer.name,
        연락처: customer.phone,
        주소: customer.address,
        등급: customer.grade === 'V1' ? 'V1 (VIP)' : 
             customer.grade === 'V2' ? 'V2 (우수)' : 'V3 (일반)',
        등록일: new Date(customer.created_at).toLocaleDateString()
      }));

      // 엑셀 워크북 생성
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "고객목록");

      // 컬럼 너비 설정
      const wscols = [
        { wch: 15 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 40 },  // 주소
        { wch: 12 },  // 등급
        { wch: 12 },  // 등록일
      ];
      ws['!cols'] = wscols;

      // 파일 다운로드
      XLSX.writeFile(wb, `고객목록_${new Date().toLocaleDateString()}.xlsx`);

    } catch (error) {
      console.error('Error downloading excel:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <Paper sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Tabs 
            value={tabValue} 
            onChange={handleChange}
            aria-label="customer management tabs"
          >
            <Tab label="고객 목록" />
            <Tab label="고객 등록" />
          </Tabs>
          {tabValue === 0 && (
            <Tooltip title="고객 목록 다운로드">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
              >
                엑셀 다운로드
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <CustomerList refreshTrigger={refreshTrigger} onRefresh={handleRefresh} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <AddCustomer onSuccess={() => {
          setTabValue(0);
          handleRefresh();
        }} />
      </TabPanel>
    </Paper>
  );
}

export default CustomerManagement; 