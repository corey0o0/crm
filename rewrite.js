const fs = require('fs');

const content = fs.readFileSync('src/components/Inventory/InventoryManagement.jsx', 'utf8');

const mainReturnIndex = content.indexOf(`  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>`);

if (mainReturnIndex === -1) {
  console.log('Main return not found!');
  process.exit(1);
}

// Extract History
const historyStartStr = '{activeTab === 1 && (';
const historyStart = content.indexOf(historyStartStr, mainReturnIndex);
const statusStartStr = '{activeTab === 3 && (() => {';
const statusStart = content.indexOf(statusStartStr, mainReturnIndex);

if (historyStart === -1 || statusStart === -1) {
  console.log('Tabs not found!');
  process.exit(1);
}

// Find end of history block (the closing `)}` right before `{activeTab === 2 && (`)
const activeTab2StartStr = '{activeTab === 2 && (';
const activeTab2Start = content.indexOf(activeTab2StartStr, mainReturnIndex);
const historyBlock = content.substring(historyStart + historyStartStr.length, activeTab2Start).trim().replace(/}\)$/, '').trim();

// Find end of status block (the closing `})()}` right before `{activeTab === 6 && (`)
const activeTab6StartStr = '{activeTab === 6 && (';
const activeTab6Start = content.indexOf(activeTab6StartStr, mainReturnIndex);
const statusBlock = content.substring(statusStart + statusStartStr.length, activeTab6Start).trim().replace(/}\)\(\)}$/, '').trim();

// Create InventoryHistory.jsx
const historyContent = `import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination, TableFooter, IconButton
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon, Remove as RemoveIcon, Add as AddIcon } from '@mui/icons-material';

export default function InventoryHistory() {
  const context = useOutletContext();
  const {
    filter, setFilter, dateFilter, setDateFilter, handleDateFilterClick, transactionViewMode, setTransactionViewMode,
    selectedTransactions, setSelectedTransactions, handleDeleteSelectedTransactions,
    paginatedTransactions, getTransactionTypeInfo, products, formatLocationName, warehouses, dealers,
    openTransactionDetail, handleTableCellHover, handleTableCellHoverLeave, handleTableCellClick,
    hoverAnchorEl, hoverTransactions, dateKeys, ioByWarehouseProductDate, totalPages, currentPage,
    handlePageChange, showSnackbar, tableModalOpen, setTableModalOpen, selectedTableTransactions,
    transactions, inventory, fetchProducts, fetchTransactions, recalculateInventoryFromTransactions,
    handleCloseDialog, openDialog, dialogType, formData, setFormData, editMode, editFormData, setEditFormData,
    editProducts, setEditProducts, saveEditTransaction, cancelEditTransaction, addEditProduct, removeEditProduct,
    updateEditProduct, handleDeleteTransaction, handleViewOriginal, multipleIoProducts, setMultipleIoProducts,
    handleMultipleSubmit, addIoProductRow, removeIoProductRow, updateIoProductRow, excelUploadOpen,
    handleCloseExcelUpload, handleExcelFileUpload, excelFile, excelUploadType, setExcelUploadType,
    handleExcelUploadSubmit, handleOpenExcelUpload, transactionDetailOpen, closeTransactionDetail,
    selectedTransaction, startEditTransaction
  } = context;

  return (
    ${historyBlock}
  );
}
`;
fs.writeFileSync('src/pages/inventory/InventoryHistory.jsx', historyContent);

// Create InventoryStatus.jsx
const statusContent = `import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, IconButton, Switch, FormControlLabel, Badge, Autocomplete, InputAdornment, Popover
} from '@mui/material';
import { Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon, Search as SearchIcon, FilterList as FilterIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';

export default function InventoryStatus() {
  const context = useOutletContext();
  const {
    products, warehouses, dealers, inventory, overallSearch, setOverallSearch,
    overallStockFilter, setOverallStockFilter, fetchProducts, fetchWarehouses,
    fetchDealers, toggleWarehouseSync, openWarehouseDetail, fetchTransactions, recalculateInventoryFromTransactions, warehouseDetailOpen, closeWarehouseDetail, warehouseDetailTarget, warehouseDetailFilter, setWarehouseDetailFilter, warehouseDetailSearch, setWarehouseDetailSearch, warehouseDetailBelow, setWarehouseDetailBelow
  } = context;

  ${statusBlock}
}
`;
fs.writeFileSync('src/pages/inventory/InventoryStatus.jsx', statusContent);

// Modify InventoryLayout.jsx
let layoutContent = content;

// Replace imports
layoutContent = layoutContent.replace("import { useLocation, useNavigate } from 'react-router-dom';", "import { useLocation, useNavigate, Outlet } from 'react-router-dom';");

layoutContent = layoutContent.replace(/'\.\/tabs\//g, "'../../components/Inventory/tabs/");
layoutContent = layoutContent.replace(/'\.\/Cafe24InventoryReconciliation'/g, "'../../components/Inventory/Cafe24InventoryReconciliation'");
layoutContent = layoutContent.replace(/'\.\/LocationManagement'/g, "'../../components/Inventory/LocationManagement'");
layoutContent = layoutContent.replace(/'\.\/BarcodeScanner'/g, "'../../components/Inventory/BarcodeScanner'");

const contextValueStr = `
  const contextValue = {
    activeTab, setActiveTab, openDialog, setOpenDialog, warehouseDetailOpen, setWarehouseDetailOpen,
    warehouseDetailTarget, setWarehouseDetailTarget, warehouseDetailSearch, setWarehouseDetailSearch,
    warehouseDetailFilter, setWarehouseDetailFilter, warehouseDetailBelow, setWarehouseDetailBelow,
    dealerStatsFilter, setDealerStatsFilter, overallSearch, setOverallSearch, overallStockFilter, setOverallStockFilter,
    excelUploadOpen, setExcelUploadOpen, excelFile, setExcelFile, transactionViewMode, setTransactionViewMode,
    tableModalOpen, setTableModalOpen, selectedTableTransactions, setSelectedTableTransactions,
    selectedTransactions, setSelectedTransactions, hoverAnchorEl, setHoverAnchorEl, hoverTransactions, setHoverTransactions,
    excelData, setExcelData, excelUploadType, setExcelUploadType, transactionDetailOpen, setTransactionDetailOpen,
    selectedTransaction, setSelectedTransaction, editMode, setEditMode, editFormData, setEditFormData,
    editProducts, setEditProducts, dialogType, setDialogType, transactions, setTransactions, inventory, setInventory,
    pendingInventory, setPendingInventory, loading, setLoading, snackbar, setSnackbar, warehouses, setWarehouses,
    dealers, setDealers, formData, setFormData, multipleIoProducts, setMultipleIoProducts, products, setProducts,
    filter, setFilter, dateFilter, setDateFilter, currentPage, setCurrentPage, barcodeScannerOpen, setBarcodeScannerOpen,
    currentScanningRow, setCurrentScanningRow, isDragOver, setIsDragOver, groupedTransactions, dealerStats,
    warehouseStats, totalInboundStats, productStats, locationMappings, dateKeys, ioByWarehouseProductDate,
    filteredTransactions, dashboardStats, paginatedTransactions, fetchProducts, fetchWarehouses, fetchDealers,
    fetchTransactions, recalculateInventoryFromTransactions, handleLocationUpdate, toggleWarehouseSync,
    openWarehouseDetail, closeWarehouseDetail, openTransactionDetail, closeTransactionDetail, startEditTransaction,
    cancelEditTransaction, addEditProduct, removeEditProduct, updateEditProduct, saveEditTransaction,
    handleDeleteTransaction, handleCloseDialog, handleOpenDialog, addIoProductRow, removeIoProductRow,
    updateIoProductRow, handleMultipleSubmit, handleExcelFileUpload, handleExcelUploadSubmit, handleCloseExcelUpload,
    handleOpenExcelUpload, showSnackbar, handleCloseSnackbar, getTransactionTypeInfo, formatLocationName,
    handleDeleteSelectedTransactions, handleViewOriginal, handleDateFilterClick, handleTableCellClick,
    handleTableCellHover, handleTableCellHoverLeave, handlePageChange, handleBarcodeScan, startBarcodeScan,
    handleBarcodeScanError, handleDragOver, handleDragLeave, handleDrop
  };
`;

const tabsStartIdx = layoutContent.indexOf('{/* 탭 메뉴 */}');
const tabsEndIdx = layoutContent.lastIndexOf('</Box>');

// insert contextValue before the main return
layoutContent = layoutContent.replace(/  return \(\n    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>/, contextValueStr + `\n  return (\n    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>`);

// replace everything from tabsStartIdx to the end with Outlet and Dialogs
const originalEndBlock = layoutContent.substring(tabsStartIdx, tabsEndIdx);
const dialogsStartStr = '{/* 공통/입출고 등록 모달 */}';
const dialogsStartIdx = originalEndBlock.indexOf(dialogsStartStr);

if (dialogsStartIdx !== -1) {
  const dialogsBlock = originalEndBlock.substring(dialogsStartIdx);
  layoutContent = layoutContent.substring(0, tabsStartIdx) + '<Outlet context={contextValue} />\n\n      ' + dialogsBlock + '\n    </Box>\n  );\n}\n\nexport default InventoryLayout;';
}

layoutContent = layoutContent.replace(/function InventoryManagement\(\) \{/g, 'function InventoryLayout() {');

fs.writeFileSync('src/pages/inventory/InventoryLayout.jsx', layoutContent);
console.log('Success!');
