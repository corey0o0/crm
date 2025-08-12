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
import { setupStorage } from './lib/setupStorage';

// 컴포넌트 import
import Dashboard from './components/Dashboard';
import CustomerManagement from './components/Customer/CustomerManagement';
import ServiceList from './components/Service/ServiceList';
import AddService from './components/Service/AddService';
import ServiceDetail from './components/Service/ServiceDetail';
import ServiceStatistics from './components/Statistics/ServiceStatistics';
import PartsManagement from './components/Service/PartsManagement';
import ProductShipment from './components/Product/ProductShipment';
import ReceiptScanner from './components/Receipt/ReceiptScanner';
import GoogleDriveTest from './components/Test/GoogleDriveTest';
import ServiceStats from './components/Stats/ServiceStats';
import SalesStats from './components/Stats/SalesStats';
import StockList from './components/Stock/StockList';
import BrandSettings from './components/Settings/BrandSettings';
import InventoryLogs from './components/Inventory/InventoryLogs';

// 새로운 출고 관리 페이지 import
import ShipmentList from './pages/shipment/ShipmentList';
import ShipmentDetail from './pages/shipment/ShipmentDetail';
import ShipmentForm from './pages/shipment/ShipmentForm';

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
    const initializeApp = async () => {
      try {
        const storageInitialized = await setupStorage();
        if (!storageInitialized) {
          console.warn('스토리지 초기화에 실패했습니다. 일부 기능이 제한될 수 있습니다.');
        }
      } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
      }
    };

    initializeApp();
  }, []);

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
            
            {/* 기존 출고 관리 페이지 */}
            <Route path="shipments" element={<ProductShipment />} />
            <Route path="shipments/:id" element={<ProductShipment />} />
            <Route path="shipments/new" element={<ProductShipment />} />
            
            {/* 새로운 출고 관리 페이지 라우팅 */}
            <Route path="shipment" element={<ShipmentList />} />
            <Route path="shipment/new" element={<ShipmentForm />} />
            <Route path="shipment/edit/:id" element={<ShipmentForm />} />
            <Route path="shipment/:id" element={<ShipmentDetail />} />
            
            <Route path="receipts" element={<ReceiptScanner />} />
            <Route path="google-drive-test" element={<GoogleDriveTest />} />
            <Route path="service" element={<ServiceList />} />
            <Route path="service/add" element={<AddService />} />
            <Route path="service/stats" element={<ServiceStats />} />
            <Route path="service/:id" element={<ServiceDetail />} />
            <Route path="sales/stats" element={<SalesStats />} />
            <Route path="stocks" element={<StockList />} />
            <Route path="stats/service" element={<ServiceStats />} />
            <Route path="brand-settings" element={<BrandSettings />} />
            <Route path="inventory-logs" element={<InventoryLogs />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 