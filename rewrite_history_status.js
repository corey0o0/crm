const fs = require('fs');
const content = fs.readFileSync('src/components/Inventory/InventoryManagement.jsx', 'utf8');
const lines = content.split('\n');

// Extract History (from `{activeTab === 1 && (` down to line 3429)
let historyLines = lines.slice(2602, 3429); // lines 2603 to 3429
// Replace the wrapper `{activeTab === 1 && (` and the trailing `)}`
if (historyLines[0].includes('{activeTab === 1 && (')) {
  historyLines[0] = historyLines[0].replace('{activeTab === 1 && (', '');
}
if (historyLines[historyLines.length - 1].trim() === ')}' || historyLines[historyLines.length - 2].trim() === ')}') {
  historyLines.pop();
  if (historyLines[historyLines.length - 1].trim() === ')}') {
    historyLines.pop();
  }
}

const historyContent = `import React, { useMemo } from 'react';
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
${historyLines.join('\n')}
  );
}
`;
fs.writeFileSync('src/pages/inventory/InventoryHistory.jsx', historyContent);

// Extract Status (from `{activeTab === 3 && (() => {` down to line 4596)
let statusLines = lines.slice(3430, 4596); // lines 3431 to 4596
if (statusLines[0].includes('{activeTab === 3 && (() => {')) {
  statusLines.shift(); // remove the wrapper
}
// remove trailing `})()}`
while (statusLines.length > 0 && (statusLines[statusLines.length - 1].trim() === '})()}' || statusLines[statusLines.length - 1].trim() === '}' || statusLines[statusLines.length - 1].trim() === ')' || statusLines[statusLines.length - 1].trim() === '')) {
  statusLines.pop();
}

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

  ${statusLines.join('\n')}
}
`;
fs.writeFileSync('src/pages/inventory/InventoryStatus.jsx', statusContent);
console.log('Fixed History and Status components.');
