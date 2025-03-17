import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Login from './components/Auth/Login';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import theme from './theme';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { setupAllBuckets } from './utils/setupStorage';

// 컴포넌트 import
import Dashboard from './components/Dashboard';
import CustomerManagement from './components/Customer/CustomerManagement';
import ServiceList from './components/Service/ServiceList';
import AddService from './components/Service/AddService';
import ServiceDetail from './components/Service/ServiceDetail';
import ServiceStatistics from './components/Service/ServiceStatistics';
import PartsManagement from './components/Service/PartsManagement';
import ProductShipment from './components/Product/ProductShipment';
import ReceiptScanner from './components/Receipt/ReceiptScanner';

function App() {
  const [session, setSession] = useState(null);
  const [storageInitialized, setStorageInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 스토리지 버킷 초기화
  useEffect(() => {
    if (session) {
      // 로그인된 경우에만 스토리지 버킷 설정
      const initializeStorage = async () => {
        try {
          await setupAllBuckets();
          setStorageInitialized(true);
          console.log('스토리지 버킷 초기화 완료');
        } catch (error) {
          console.error('스토리지 버킷 초기화 실패:', error);
        }
      };

      initializeStorage();
    }
  }, [session]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<CustomerManagement />} />
            <Route path="services" element={<ServiceList />} />
            <Route path="services/:id" element={<ServiceDetail />} />
            <Route path="add-service" element={<AddService />} />
            <Route path="service-statistics" element={<ServiceStatistics />} />
            <Route path="parts" element={<PartsManagement />} />
            <Route path="shipments" element={<ProductShipment />} />
            <Route path="receipts" element={<ReceiptScanner />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 