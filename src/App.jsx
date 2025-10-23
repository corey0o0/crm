import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Login from './components/Auth/Login';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { AuthProvider } from './contexts/AuthContext';
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
import InventoryManagement from './components/Inventory/InventoryManagement';
import RoleManagement from './components/Settings/RoleManagement';
import BackupManager from './components/Backup/BackupManager';
import PermissionRoute from './components/Auth/PermissionRoute';
// import XRiderManual from './components/Manual/XRiderManual';
// import NewManual from './components/Manual/NewManual';

// 새로운 출고 관리 페이지 import
import ShipmentList from './pages/shipment/ShipmentList';
import ShipmentDetail from './pages/shipment/ShipmentDetail';
import ShipmentForm from './pages/shipment/ShipmentForm';
import BoardList from './pages/board/BoardList';
import BoardNew from './pages/board/BoardNew';
import BoardDetail from './pages/board/BoardDetail';
import BoardEdit from './pages/board/BoardEdit';

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
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={
              <PermissionRoute requiredPermission="dashboard">
                <Dashboard />
              </PermissionRoute>
            } />
            <Route path="customers" element={
              <PermissionRoute requiredPermission="customers">
                <CustomerManagement />
              </PermissionRoute>
            } />
            <Route path="services" element={
              <PermissionRoute requiredPermission="services">
                <ServiceList />
              </PermissionRoute>
            } />
            <Route path="services/:id" element={
              <PermissionRoute requiredPermission="services">
                <ServiceDetail />
              </PermissionRoute>
            } />
            <Route path="add-service" element={
              <PermissionRoute requiredPermission="services">
                <AddService />
              </PermissionRoute>
            } />
            <Route path="service-statistics" element={
              <PermissionRoute requiredPermission="services">
                <ServiceStatistics />
              </PermissionRoute>
            } />
            <Route path="parts" element={
              <PermissionRoute requiredPermission="parts">
                <PartsManagement />
              </PermissionRoute>
            } />
            
            {/* 기존 출고 관리 페이지 */}
            <Route path="shipments" element={
              <PermissionRoute requiredPermission="shipment">
                <ProductShipment />
              </PermissionRoute>
            } />
            <Route path="shipments/:id" element={
              <PermissionRoute requiredPermission="shipment">
                <ProductShipment />
              </PermissionRoute>
            } />
            <Route path="shipments/new" element={
              <PermissionRoute requiredPermission="shipment">
                <ProductShipment />
              </PermissionRoute>
            } />
            
            {/* 새로운 출고 관리 페이지 라우팅 */}
            <Route path="shipment" element={
              <PermissionRoute requiredPermission="shipment">
                <ShipmentList />
              </PermissionRoute>
            } />
            <Route path="shipment/new" element={
              <PermissionRoute requiredPermission="shipment">
                <ShipmentForm />
              </PermissionRoute>
            } />
            <Route path="shipment/edit/:id" element={
              <PermissionRoute requiredPermission="shipment">
                <ShipmentForm />
              </PermissionRoute>
            } />
            <Route path="shipment/:id" element={
              <PermissionRoute requiredPermission="shipment">
                <ShipmentDetail />
              </PermissionRoute>
            } />
            
            <Route path="receipts" element={
              <PermissionRoute requiredPermission="receipts">
                <ReceiptScanner />
              </PermissionRoute>
            } />
            <Route path="google-drive-test" element={
              <PermissionRoute requiredPermission="google_drive_test">
                <GoogleDriveTest />
              </PermissionRoute>
            } />
            <Route path="service" element={
              <PermissionRoute requiredPermission="services">
                <ServiceList />
              </PermissionRoute>
            } />
            <Route path="service/add" element={
              <PermissionRoute requiredPermission="services">
                <AddService />
              </PermissionRoute>
            } />
            <Route path="service/stats" element={
              <PermissionRoute requiredPermission="services">
                <ServiceStats />
              </PermissionRoute>
            } />
            <Route path="service/:id" element={
              <PermissionRoute requiredPermission="services">
                <ServiceDetail />
              </PermissionRoute>
            } />
            <Route path="sales/stats" element={
              <PermissionRoute requiredPermission="sales_stats">
                <SalesStats />
              </PermissionRoute>
            } />
            <Route path="stocks" element={
              <PermissionRoute requiredPermission="stocks">
                <StockList />
              </PermissionRoute>
            } />
            <Route path="stats/service" element={
              <PermissionRoute requiredPermission="services">
                <ServiceStats />
              </PermissionRoute>
            } />
            <Route path="brand-settings" element={
              <PermissionRoute requiredPermission="brand_settings">
                <BrandSettings />
              </PermissionRoute>
            } />
            <Route path="inventory-logs" element={
              <PermissionRoute requiredPermission="inventory_management">
                <InventoryLogs />
              </PermissionRoute>
            } />
            <Route path="inventory-management" element={
              <PermissionRoute requiredPermission="inventory_management">
                <InventoryManagement />
              </PermissionRoute>
            } />
            
            {/* 권한 설정 */}
            <Route path="role-settings" element={
              <PermissionRoute requiredPermission="role_settings">
                <RoleManagement />
              </PermissionRoute>
            } />
            
            {/* 데이터 백업/복원 */}
            <Route path="backup" element={
              <PermissionRoute requiredPermission="backup_management">
                <BackupManager />
              </PermissionRoute>
            } />
            
            {/* 게시판 */}
            <Route path="board" element={
              <PermissionRoute requiredPermission="board">
                <BoardList />
              </PermissionRoute>
            } />
            <Route path="board/new" element={
              <PermissionRoute requiredPermission="board">
                <BoardNew />
              </PermissionRoute>
            } />
            <Route path="board/:id" element={
              <PermissionRoute requiredPermission="board">
                <BoardDetail />
              </PermissionRoute>
            } />
            <Route path="board/:id/edit" element={
              <PermissionRoute requiredPermission="board">
                <BoardEdit />
              </PermissionRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
    </AuthProvider>
  );
}

export default App; 