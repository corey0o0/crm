const fs = require('fs');

let content = fs.readFileSync('src/pages/inventory/InventoryStatus.jsx', 'utf8');

const startIdx = content.indexOf('{activeTab === 3 && (() => {');
const endIdx = content.indexOf('{activeTab === 4 && (');

if (startIdx !== -1 && endIdx !== -1) {
  let block = content.substring(startIdx + 29, endIdx);
  // remove trailing `      })()}`
  block = block.replace(/\s*}\)\(\)\s*}\s*$/s, '');

  const newContent = `import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, Tooltip, IconButton, Switch, FormControlLabel
} from '@mui/material';
import { Refresh as RefreshIcon, Store as StoreIcon, Sync as SyncIcon, SyncDisabled as SyncDisabledIcon } from '@mui/icons-material';

export default function InventoryStatus() {
  const {
    products, warehouses, dealers, inventory, overallSearch, setOverallSearch,
    overallStockFilter, setOverallStockFilter, fetchProducts, fetchWarehouses,
    fetchDealers, toggleWarehouseSync, openWarehouseDetail
  } = useOutletContext();

  ${block}
}
`;
  fs.writeFileSync('src/pages/inventory/InventoryStatus.jsx', newContent);
  console.log('Modified InventoryStatus.jsx');
}
