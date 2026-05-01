import re

with open('src/components/Inventory/InventoryManagement.jsx', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# InventoryHistory
history_lines = lines[2602:3008]
if history_lines[0].strip().startswith('{activeTab === 1'):
    history_lines[0] = ''
if history_lines[-1].strip() == ')}':
    history_lines[-1] = ''
elif history_lines[-1].strip() == ')':
    history_lines[-1] = ''

history_content = """import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination, TableFooter, IconButton, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon, Remove as RemoveIcon, Add as AddIcon, Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon } from '@mui/icons-material';

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
""" + "\n".join(history_lines) + """
  );
}
"""
with open('src/pages/inventory/InventoryHistory.jsx', 'w', encoding='utf-8') as f:
    f.write(history_content)

# InventoryStatus
status_lines = lines[3430:3555]
if status_lines[0].strip().startswith('{activeTab === 3'):
    status_lines[0] = ''
while status_lines and status_lines[-1].strip() in ['})()}', '}', ')']:
    status_lines.pop()

status_content = """import React, { useMemo } from 'react';
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

  return (
""" + "\n".join(status_lines) + """
  );
}
"""
with open('src/pages/inventory/InventoryStatus.jsx', 'w', encoding='utf-8') as f:
    f.write(status_content)

# InventoryLayout
layout_lines = []
layout_lines.extend(lines[0:2308]) # up to the return
layout_lines.append(lines[2308]) # `  return (`
layout_lines.append(lines[2309]) # `<Box ...>`
layout_lines.extend(lines[2310:2396]) # header
layout_lines.append('      <Outlet context={contextValue} />')
layout_lines.extend(lines[3558:4596]) # dialogs
layout_lines.extend(lines[4775:4798]) # scanner and closing

layout_content = "\n".join(layout_lines)

# Fix imports
layout_content = layout_content.replace("import { useLocation, useNavigate } from 'react-router-dom';", "import { useLocation, useNavigate, Outlet } from 'react-router-dom';")
layout_content = layout_content.replace("'./tabs/", "'../../components/Inventory/tabs/")
layout_content = layout_content.replace("'./Cafe24InventoryReconciliation'", "'../../components/Inventory/Cafe24InventoryReconciliation'")
layout_content = layout_content.replace("'./LocationManagement'", "'../../components/Inventory/LocationManagement'")
layout_content = layout_content.replace("'./BarcodeScanner'", "'../../components/Inventory/BarcodeScanner'")
layout_content = layout_content.replace("export default InventoryManagement;", "export default InventoryLayout;")
layout_content = layout_content.replace("function InventoryManagement() {", "function InventoryLayout() {")

# Insert contextValue right before `return (`
context_value_str = """
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
"""

layout_content = layout_content.replace('  return (\n    <Box', context_value_str + '  return (\n    <Box')

with open('src/pages/inventory/InventoryLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(layout_content)
    
print('Rebuild successful')
