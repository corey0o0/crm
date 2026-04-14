import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Login from './components/Auth/Login';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import theme from './theme';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { setupStorage } from './lib/setupStorage';
// DebugPanel import removed from App.jsx

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
import SystemHealthCheck from './components/Test/SystemHealthCheck';
import TelegramTest from './components/Test/TelegramTest';
import ServiceStats from './components/Stats/ServiceStats';
import SalesStats from './components/Stats/SalesStats';
import OnlineStats from './components/Stats/OnlineStats';
import StockList from './components/Stock/StockList';
import ServiceAnalysis from './components/Service/ServiceAnalysis';
import BrandSettings from './components/Settings/BrandSettings';
import InventoryLogs from './components/Inventory/InventoryLogs';
import InventoryManagement from './components/Inventory/InventoryManagement';
// import RoleManagement from './components/Settings/RoleManagement'; // 제거됨 - 이메일 기반으로 대체
import BackupManager from './components/Backup/BackupManager';
// import PermissionRoute from './components/Auth/PermissionRoute'; // 제거됨 - 이메일 기반으로 대체
// import XRiderManual from './components/Manual/XRiderManual';
// import NewManual from './components/Manual/NewManual';

// 새로운 출고 관리 페이지 import
import ShipmentList from './pages/shipment/ShipmentList';
import ShipmentDetail from './pages/shipment/ShipmentDetail';
import ShipmentForm from './pages/shipment/ShipmentForm';
import SalesEntry from './pages/sales/SalesEntry';
import SalesHistory from './pages/sales/SalesHistory';
import AgencyManagement from './pages/agency/AgencyManagement';
import AdminTools from './pages/admin/AdminTools';
import BoardList from './pages/board/BoardList';
import BoardNew from './pages/board/BoardNew';
import BoardDetail from './pages/board/BoardDetail';
import BoardEdit from './pages/board/BoardEdit';
import PendingOrderList from './pages/pendingOrders/PendingOrderList';
import PendingOrderDetail from './pages/pendingOrders/PendingOrderDetail';
import Cafe24Settings from './components/Settings/Cafe24Settings';
import ProductComparisonDashboard from './components/Settings/ProductComparisonDashboard';
import Cafe24OrderList from './pages/cafe24/Cafe24OrderList';

function AppRouter() {
  const { session } = useAuth();

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

    if (session) {
      initializeApp();
    }
  }, [session]);

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
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

          {/* 거래처 관리 */}
          <Route path="agencies" element={<AgencyManagement />} />

          {/* 새로운 출고 관리 페이지 라우팅 */}
          <Route path="shipment" element={<ShipmentList />} />
          <Route path="shipment/new" element={<ShipmentForm />} />
          <Route path="shipment/edit/:id" element={<ShipmentForm />} />
          <Route path="shipment/:id" element={<ShipmentDetail />} />

          <Route path="receipts" element={<ReceiptScanner />} />
          <Route path="system-health-check" element={<SystemHealthCheck />} />
          <Route path="telegram-test" element={<TelegramTest />} />
          <Route path="service" element={<ServiceList />} />
          <Route path="service/add" element={<AddService />} />
          <Route path="service/stats" element={<ServiceStats />} />
          <Route path="service/analysis" element={<ServiceAnalysis />} />
          <Route path="service/:id" element={<ServiceDetail />} />
          <Route path="sales/stats" element={<SalesStats />} />
          <Route path="online/stats" element={<OnlineStats />} />
          <Route path="stocks" element={<StockList />} />
          <Route path="stats/service" element={<ServiceStats />} />
          <Route path="brand-settings" element={<BrandSettings />} />
          <Route path="inventory-logs" element={<InventoryLogs />} />
          <Route path="inventory-management" element={<InventoryManagement />} />
          
          {/* 데이터 백업/복원 */}
          <Route path="backup" element={<BackupManager />} />

          {/* 관리자 도구 */}
          <Route path="admin/tools" element={<AdminTools />} />

          {/* 카페24 연동 설정 */}
          <Route path="settings/cafe24" element={<Cafe24Settings />} />
          <Route path="cafe24/orders" element={<Cafe24OrderList />} />
          <Route path="settings/product-sync" element={<ProductComparisonDashboard />} />

          {/* 게시판 */}
          <Route path="board" element={<BoardList />} />
          <Route path="board/new" element={<BoardNew />} />
          <Route path="board/:id" element={<BoardDetail />} />
          <Route path="board/:id/edit" element={<BoardEdit />} />

          {/* 출고/판매 관리 */}
          <Route path="sales/entry" element={<SalesEntry />} />
          <Route path="sales/history" element={<SalesHistory />} />
          <Route path="pending-orders" element={<PendingOrderList />} />
          <Route path="pending-orders/:id" element={<PendingOrderDetail />} />
        </Route>
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppRouter />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App; 