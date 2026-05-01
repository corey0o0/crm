const fs = require('fs');

const content = fs.readFileSync('src/pages/inventory/InventoryLayout.jsx', 'utf8');

// Find all `const [something, setSomething] = useState(`
const stateRegex = /const\s+\[([a-zA-Z0-9_]+),\s*([a-zA-Z0-9_]+)\]\s*=\s*useState/g;
let match;
const contextKeys = [];

while ((match = stateRegex.exec(content)) !== null) {
  contextKeys.push(match[1]);
  contextKeys.push(match[2]);
}

// Find all `const something = useMemo(`
const memoRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*useMemo/g;
while ((match = memoRegex.exec(content)) !== null) {
  contextKeys.push(match[1]);
}

// Add known functions
const functions = [
  'fetchProducts', 'fetchWarehouses', 'fetchDealers', 'fetchTransactions', 
  'recalculateInventoryFromTransactions', 'handleLocationUpdate', 'toggleWarehouseSync', 
  'openWarehouseDetail', 'closeWarehouseDetail', 'openTransactionDetail', 
  'closeTransactionDetail', 'startEditTransaction', 'cancelEditTransaction', 
  'addEditProduct', 'removeEditProduct', 'updateEditProduct', 'saveEditTransaction', 
  'handleDeleteTransaction', 'handleCloseDialog', 'handleOpenDialog', 'addIoProductRow', 
  'removeIoProductRow', 'updateIoProductRow', 'handleMultipleSubmit', 'handleExcelFileUpload', 
  'handleExcelUploadSubmit', 'handleCloseExcelUpload', 'handleOpenExcelUpload', 
  'showSnackbar', 'handleCloseSnackbar', 'getTransactionTypeInfo', 'formatLocationName', 
  'handleDeleteSelectedTransactions', 'handleViewOriginal', 'handleDateFilterClick', 
  'handleTableCellClick', 'handleTableCellHover', 'handleTableCellHoverLeave', 
  'handlePageChange', 'handleBarcodeScan', 'startBarcodeScan', 'handleBarcodeScanError', 
  'handleDragOver', 'handleDragLeave', 'handleDrop'
];

contextKeys.push(...functions);

console.log('const contextValue = {');
console.log('  ' + Array.from(new Set(contextKeys)).join(',\n  '));
console.log('};');
