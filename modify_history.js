const fs = require('fs');

let content = fs.readFileSync('src/pages/inventory/InventoryHistory.jsx', 'utf8');

// The activeTab 1 block starts at `{activeTab === 1 && (` and ends at the next `)}` or `activeTab === 2`
const startIdx = content.indexOf('{activeTab === 1 && (');
const endIdx = content.indexOf('{activeTab === 2 && (');

if (startIdx !== -1 && endIdx !== -1) {
  let block = content.substring(startIdx + 21, endIdx);
  // Remove trailing `      )}`
  block = block.replace(/\s*}\)\s*$/s, '');

  const newContent = `import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination
} from '@mui/material';

export default function InventoryHistory() {
  const {
    filter, setFilter, dateFilter, handleDateFilterClick, transactionViewMode, setTransactionViewMode,
    selectedTransactions, setSelectedTransactions, handleDeleteSelectedTransactions,
    paginatedTransactions, getTransactionTypeInfo, products, formatLocationName, warehouses, dealers,
    openTransactionDetail, handleTableCellHover, handleTableCellHoverLeave, handleTableCellClick,
    hoverAnchorEl, hoverTransactions, dateKeys, ioByWarehouseProductDate, totalPages, currentPage,
    handlePageChange, showSnackbar, tableModalOpen
  } = useOutletContext();

  return (
    ${block}
  );
}
`;
  fs.writeFileSync('src/pages/inventory/InventoryHistory.jsx', newContent);
  console.log('Modified InventoryHistory.jsx');
}
