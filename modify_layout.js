const fs = require('fs');

let content = fs.readFileSync('src/pages/inventory/InventoryLayout.jsx', 'utf8');

// Also add Outlet to imports if not there
if (!content.includes('Outlet')) {
  content = content.replace("import { useLocation, useNavigate } from 'react-router-dom';", "import { useLocation, useNavigate, Outlet } from 'react-router-dom';");
}

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

// Insert contextValue right before the return statement
content = content.replace('  return (', contextValueStr + '\n  return (');

// Cut off the tabs and replace with Outlet
const startOfTabs = '{/* 탭 메뉴 */}';
const endRegex = /<BarcodeScanner[\s\S]*?\/>\s*<\/Box>/;

const startIdx = content.indexOf(startOfTabs);
if (startIdx !== -1) {
  const match = endRegex.exec(content);
  if (match) {
    const endIdx = match.index;
    const replacement = `<Outlet context={contextValue} />\n\n      `;
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  }
}

// Rename InventoryManagement to InventoryLayout
content = content.replace(/function InventoryManagement\(\) \{/g, 'function InventoryLayout() {');
content = content.replace(/export default InventoryManagement;/g, 'export default InventoryLayout;');

fs.writeFileSync('src/pages/inventory/InventoryLayout.jsx', content);
console.log('Modified InventoryLayout.jsx');
