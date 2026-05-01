const fs = require('fs');

// Fix InventoryStatus.jsx
let statusContent = fs.readFileSync('src/pages/inventory/InventoryStatus.jsx', 'utf8');
if (!statusContent.includes('Card,')) {
  statusContent = statusContent.replace('Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, IconButton, Switch, FormControlLabel, Badge, Autocomplete, InputAdornment, Popover', 'Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, IconButton, Switch, FormControlLabel, Badge, Autocomplete, InputAdornment, Popover, Card, TableFooter');
}
if (!statusContent.includes('setFilter')) {
  statusContent = statusContent.replace('overallStockFilter, setOverallStockFilter,', 'overallStockFilter, setOverallStockFilter, setFilter, setDateFilter, setActiveTab,');
}
fs.writeFileSync('src/pages/inventory/InventoryStatus.jsx', statusContent);

// Fix InventoryHistory.jsx
let historyContent = fs.readFileSync('src/pages/inventory/InventoryHistory.jsx', 'utf8');
if (!historyContent.includes('Card,')) {
  historyContent = historyContent.replace('Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination, TableFooter, IconButton, Dialog, DialogTitle, DialogContent, DialogActions', 'Box, Paper, Grid, Stack, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Button, TextField, Typography, TableContainer, Table, TableHead, TableRow, TableCell, Checkbox, TableBody, Chip, Tooltip, Pagination, TableFooter, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent');
}
if (!historyContent.includes('filteredTransactions')) {
  historyContent = historyContent.replace('paginatedTransactions, getTransactionTypeInfo', 'filteredTransactions, itemsPerPage, pendingInventory, paginatedTransactions, getTransactionTypeInfo');
}
fs.writeFileSync('src/pages/inventory/InventoryHistory.jsx', historyContent);

console.log('Fixed components missing vars');
