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
import ManualSalesList from './pages/sales/ManualSalesList';
import SystemHealthCheck from './components/Test/SystemHealthCheck';
import TelegramTest from './components/Test/TelegramTest';
import ServiceStats from './components/Stats/ServiceStats';
import SalesStats from './components/Stats/SalesStats';
import OnlineStats from './components/Stats/OnlineStats';
import StockList from './components/Stock/StockList';
import ServiceAnalysis from './components/Service/ServiceAnalysis';
import BrandSettings from './components/Settings/BrandSettings';
import InventoryLogs from './components/Inventory/InventoryLogs';
import InventoryLayout from './pages/inventory/InventoryLayout';
import InventoryHistory from './pages/inventory/InventoryHistory';
import InventoryStatus from './pages/inventory/InventoryStatus';
import StoreOnlineOutboundTab from './components/Inventory/tabs/StoreOnlineOutboundTab';
import BoxStatusTab from './components/Inventory/tabs/BoxStatusTab';
import InventoryLocations from './pages/inventory/InventoryLocations';
import Cafe24SyncTab from './components/Inventory/tabs/Cafe24SyncTab';
// import RoleManagement from './components/Settings/RoleManagement'; // 제거됨 - 이메일 기반으로 대체
import BackupManager from './components/Backup/BackupManager';
import PermissionRoute from './components/Auth/PermissionRoute';
import { MENU_KEYS } from './config/menuConfig';
// import XRiderManual from './components/Manual/XRiderManual';
// import NewManual from './components/Manual/NewManual';

// 새로운 출고 관리 페이지 import
import ShipmentList from './pages/shipment/ShipmentList';
import ShipmentDetail from './pages/shipment/ShipmentDetail';
import ShipmentForm from './pages/shipment/ShipmentForm';
import SalesEntry from './pages/sales/SalesEntry';
import SalesHistory from './pages/sales/SalesHistory';
import SalesHistoryStats from './components/Stats/SalesHistoryStats';
import TaxInvoiceManagement from './pages/sales/TaxInvoiceManagement';
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
import EcountDataUploader from './components/Settings/EcountDataUploader';

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
          <Route index element={<PermissionRoute requiredPermission={MENU_KEYS.DASHBOARD}><Dashboard /></PermissionRoute>} />
          <Route path="customers" element={<PermissionRoute requiredPermission={MENU_KEYS.CUSTOMERS}><CustomerManagement /></PermissionRoute>} />
          <Route path="services" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceList /></PermissionRoute>} />
          <Route path="services/:id" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceDetail /></PermissionRoute>} />
          <Route path="add-service" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><AddService /></PermissionRoute>} />
          <Route path="service-statistics" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceStatistics /></PermissionRoute>} />
          <Route path="parts" element={<PermissionRoute requiredPermission={MENU_KEYS.PARTS}><PartsManagement /></PermissionRoute>} />

          {/* 기존 출고 관리 페이지 */}
          <Route path="shipments" element={<ProductShipment />} />
          <Route path="shipments/:id" element={<ProductShipment />} />
          <Route path="shipments/new" element={<ProductShipment />} />

          {/* 거래처 관리 */}
          <Route path="agencies" element={<AgencyManagement />} />

          {/* 새로운 출고 관리 페이지 라우팅 */}
          <Route path="shipment" element={<PermissionRoute requiredPermission={MENU_KEYS.SHIPMENT}><ShipmentList /></PermissionRoute>} />
          <Route path="shipment/new" element={<PermissionRoute requiredPermission={MENU_KEYS.SHIPMENT}><ShipmentForm /></PermissionRoute>} />
          <Route path="shipment/edit/:id" element={<PermissionRoute requiredPermission={MENU_KEYS.SHIPMENT}><ShipmentForm /></PermissionRoute>} />
          <Route path="shipment/:id" element={<PermissionRoute requiredPermission={MENU_KEYS.SHIPMENT}><ShipmentDetail /></PermissionRoute>} />

          <Route path="system-health-check" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><SystemHealthCheck /></PermissionRoute>} />
          <Route path="telegram-test" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><TelegramTest /></PermissionRoute>} />
          <Route path="service" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceList /></PermissionRoute>} />
          <Route path="service/add" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><AddService /></PermissionRoute>} />
          <Route path="service/stats" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceStats /></PermissionRoute>} />
          <Route path="service/analysis" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceAnalysis /></PermissionRoute>} />
          <Route path="service/:id" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceDetail /></PermissionRoute>} />
          <Route path="sales/stats" element={<PermissionRoute requiredPermission={MENU_KEYS.SALES_STATS}><SalesStats /></PermissionRoute>} />
          <Route path="sales/history-stats" element={<PermissionRoute requiredPermission={MENU_KEYS.SALES_HISTORY_STATS}><SalesHistoryStats /></PermissionRoute>} />
          <Route path="online/stats" element={<PermissionRoute requiredPermission={MENU_KEYS.ONLINE_STATS}><OnlineStats /></PermissionRoute>} />
          <Route path="stocks" element={<PermissionRoute requiredPermission={MENU_KEYS.STOCKS}><StockList /></PermissionRoute>} />
          <Route path="stats/service" element={<PermissionRoute requiredPermission={MENU_KEYS.SERVICES}><ServiceStats /></PermissionRoute>} />
          <Route path="brand-settings" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><BrandSettings /></PermissionRoute>} />
          <Route path="inventory-logs" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_HISTORY}><InventoryLogs /></PermissionRoute>} />
          <Route path="inventory-management" element={<PermissionRoute requiredPermission={[MENU_KEYS.INVENTORY, MENU_KEYS.INVENTORY_HISTORY, MENU_KEYS.INVENTORY_SCAN, MENU_KEYS.INVENTORY_STATUS, MENU_KEYS.INVENTORY_BOXES, MENU_KEYS.INVENTORY_CAFE24_SYNC, MENU_KEYS.INVENTORY_LOCATIONS]}><InventoryLayout /></PermissionRoute>}>
            <Route index element={<Navigate to="history" replace />} />
            <Route path="history" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_HISTORY}><InventoryHistory /></PermissionRoute>} />
            <Route path="scan" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_SCAN}><StoreOnlineOutboundTab /></PermissionRoute>} />
            <Route path="status" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_STATUS}><InventoryStatus /></PermissionRoute>} />
            <Route path="boxes" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_BOXES}><BoxStatusTab /></PermissionRoute>} />
            <Route path="cafe24-sync" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_CAFE24_SYNC}><Cafe24SyncTab /></PermissionRoute>} />
            <Route path="locations" element={<PermissionRoute requiredPermission={MENU_KEYS.INVENTORY_LOCATIONS}><InventoryLocations /></PermissionRoute>} />
          </Route>
          
          {/* 데이터 백업/복원 */}
          <Route path="backup" element={<PermissionRoute requiredPermission={MENU_KEYS.BACKUP}><BackupManager /></PermissionRoute>} />

          {/* 관리자 도구 */}
          <Route path="admin/tools" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><AdminTools /></PermissionRoute>} />

          {/* 카페24 연동 설정 */}
          <Route path="settings/ecount-uploader" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><EcountDataUploader /></PermissionRoute>} />
          <Route path="settings/cafe24" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><Cafe24Settings /></PermissionRoute>} />
          <Route path="cafe24/orders" element={<PermissionRoute requiredPermission={MENU_KEYS.CAFE24_ORDERS}><Cafe24OrderList /></PermissionRoute>} />
          <Route path="settings/product-sync" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><ProductComparisonDashboard /></PermissionRoute>} />

          {/* 게시판 */}
          <Route path="board" element={<PermissionRoute requiredPermission={[MENU_KEYS.BOARD_GROUP, MENU_KEYS.BOARD_INTERNAL, MENU_KEYS.BOARD_CAFE24]}><BoardList /></PermissionRoute>} />
          <Route path="board/new" element={<PermissionRoute requiredPermission={[MENU_KEYS.BOARD_GROUP, MENU_KEYS.BOARD_INTERNAL, MENU_KEYS.BOARD_CAFE24]}><BoardNew /></PermissionRoute>} />
          <Route path="board/:id" element={<PermissionRoute requiredPermission={[MENU_KEYS.BOARD_GROUP, MENU_KEYS.BOARD_INTERNAL, MENU_KEYS.BOARD_CAFE24]}><BoardDetail /></PermissionRoute>} />
          <Route path="board/:id/edit" element={<PermissionRoute requiredPermission={[MENU_KEYS.BOARD_GROUP, MENU_KEYS.BOARD_INTERNAL, MENU_KEYS.BOARD_CAFE24]}><BoardEdit /></PermissionRoute>} />

          {/* 출고/판매 관리 */}
          <Route path="sales/entry" element={<PermissionRoute requiredPermission={MENU_KEYS.SALES_ENTRY}><SalesEntry /></PermissionRoute>} />
          <Route path="sales/history" element={<PermissionRoute requiredPermission={MENU_KEYS.SALES_HISTORY}><SalesHistory /></PermissionRoute>} />
          <Route path="sales/manual" element={<PermissionRoute requiredPermission={MENU_KEYS.MANUAL_SALES}><ManualSalesList /></PermissionRoute>} />
          <Route path="sales/manual/new" element={<PermissionRoute requiredPermission={MENU_KEYS.MANUAL_SALES}><ShipmentForm isManualB2B={true} /></PermissionRoute>} />
          <Route path="sales/manual/edit/:id" element={<PermissionRoute requiredPermission={MENU_KEYS.MANUAL_SALES}><ShipmentForm isManualB2B={true} /></PermissionRoute>} />
          <Route path="sales/tax-invoice" element={<PermissionRoute requiredPermission={MENU_KEYS.ADMIN_TOOLS}><TaxInvoiceManagement /></PermissionRoute>} />
          
          <Route path="pending-orders" element={<PermissionRoute requiredPermission={MENU_KEYS.PENDING_ORDERS}><PendingOrderList /></PermissionRoute>} />
          <Route path="pending-orders/:id" element={<PermissionRoute requiredPermission={MENU_KEYS.PENDING_ORDERS}><PendingOrderDetail /></PermissionRoute>} />
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