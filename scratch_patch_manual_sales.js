const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/pages/sales/ManualSalesList.jsx');
let content = fs.readFileSync(file, 'utf8');

// The replacement logic:
// 1. imports
content = content.replace(
  "Alert, TextField, Stack, TablePagination, Grid, FormControl, InputLabel, Select, MenuItem, ButtonGroup } from '@mui/material';",
  "Alert, TextField, Stack, TablePagination, Grid, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Checkbox } from '@mui/material';"
);

// 2. Add state
const stateInsertion = `  const [dateFilter, setDateFilter] = useState({
    type: 'order_date',
    startDate: '',
    endDate: ''
  });

  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
`;
content = content.replace(
  `  const [dateFilter, setDateFilter] = useState({\n    type: 'order_date',\n    startDate: '',\n    endDate: ''\n  });`,
  stateInsertion
);

// clear selectedItems when fetching
content = content.replace(
  `      setShipments(data || []);`,
  `      setShipments(data || []);\n      setSelectedItems([]);`
);

// 3. Selection Handlers
const handlerInsertion = `
  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = shipments.map((n) => n.id);
      setSelectedItems(newSelecteds);
      return;
    }
    setSelectedItems([]);
  };

  const handleClick = (event, id) => {
    const selectedIndex = selectedItems.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedItems, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedItems.slice(1));
    } else if (selectedIndex === selectedItems.length - 1) {
      newSelected = newSelected.concat(selectedItems.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedItems.slice(0, selectedIndex),
        selectedItems.slice(selectedIndex + 1),
      );
    }
    setSelectedItems(newSelected);
  };

  const handleBulkDelete = async () => {
    try {
      setLoading(true);
      // 1. Transaction(수불부) 연동 삭제
      await supabase.from('transactions').delete().in('group_id', selectedItems);
      // 2. 부품 내역 삭제
      await supabase.from('shipment_parts').delete().in('shipment_id', selectedItems);
      // 3. 전표(Shipment) 본체 삭제
      const { error } = await supabase.from('shipments').delete().in('id', selectedItems);
      
      if (error) throw error;
      
      setSnackbar({ open: true, message: \`\${selectedItems.length}개의 항목이 안전하게 삭제되었습니다.\`, severity: 'success' });
      fetchManualSales();
    } catch (err) {
      setSnackbar({ open: true, message: '일괄 삭제 실패: ' + err.message, severity: 'error' });
    } finally {
      setBulkDeleteDialog(false);
      setSelectedItems([]);
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {`;
content = content.replace(
  `  const handleExportExcel = async () => {`,
  handlerInsertion
);

// 4. Selective Excel Logic
const excelLogicReplacement = `    try {
      let query = supabase.from('shipments').select('*, shipment_parts(*)');
      
      if (selectedItems.length > 0) {
        // 선택된 항목만 다운로드
        query = query.in('id', selectedItems);
      } else {
        let condition = \`sales_channel.eq.과거 이카운트 이관,sales_channel.eq.[B2B수기],note.ilike.%[B2B수기판매]%,note.ilike.%[과거 이카운트 이관]%,note.ilike.%[엑셀일괄등록]%,note.ilike.%[수기판매]%\`;
        query = query.or(condition);

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (sellerFilter !== 'all') query = query.eq('sales_channel', sellerFilter);
        if (dateFilter.startDate) query = query.gte(dateFilter.type, \`\${dateFilter.startDate}T00:00:00\`);
        if (dateFilter.endDate) query = query.lte(dateFilter.type, \`\${dateFilter.endDate}T23:59:59\`);
        if (searchTerm) query = query.or(\`customer_name.ilike.%\${searchTerm}%,sales_channel.ilike.%\${searchTerm}%,note.ilike.%\${searchTerm}%\`);
      }

      query = query.order('order_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;`;
content = content.replace(
  `    try {
      let query = supabase.from('shipments').select('*, shipment_parts(*)');
      let condition = \`sales_channel.eq.과거 이카운트 이관,sales_channel.eq.[B2B수기],note.ilike.%[B2B수기판매]%,note.ilike.%[과거 이카운트 이관]%,note.ilike.%[엑셀일괄등록]%,note.ilike.%[수기판매]%\`;
      query = query.or(condition);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (sellerFilter !== 'all') query = query.eq('sales_channel', sellerFilter);
      if (dateFilter.startDate) query = query.gte(dateFilter.type, \`\${dateFilter.startDate}T00:00:00\`);
      if (dateFilter.endDate) query = query.lte(dateFilter.type, \`\${dateFilter.endDate}T23:59:59\`);
      if (searchTerm) query = query.or(\`customer_name.ilike.%\${searchTerm}%,sales_channel.ilike.%\${searchTerm}%,note.ilike.%\${searchTerm}%\`);

      query = query.order('order_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;`,
  excelLogicReplacement
);

// 5. Update Buttons (Export and Delete)
const buttonsReplacement = `              <Box sx={{ flexGrow: 1 }} />
              {selectedItems.length > 0 && (
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<DeleteIcon />} 
                  onClick={() => setBulkDeleteDialog(true)}
                  sx={{ mr: 1 }}
                >
                  선택 삭제 ({selectedItems.length})
                </Button>
              )}
              <Button 
                variant="outlined" 
                color="success" 
                startIcon={<FileDownloadIcon />} 
                onClick={handleExportExcel}
              >
                {selectedItems.length > 0 ? \`선택 추출 (\${selectedItems.length})\` : '조건 추출'}
              </Button>`;

content = content.replace(
  `              <Box sx={{ flexGrow: 1 }} />
              <Button 
                variant="outlined" 
                color="success" 
                startIcon={<FileDownloadIcon />} 
                onClick={handleExportExcel}
              >
                엑셀 추출
              </Button>`,
  buttonsReplacement
);

// 6. Table Borders and styling
const tableReplacement = `      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 650, width: '100%', tableLayout: 'auto', border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={selectedItems.length > 0 && selectedItems.length < shipments.length}
                  checked={shipments.length > 0 && selectedItems.length === shipments.length}
                  onChange={handleSelectAllClick}
                />
              </TableCell>
              <TableCell width="12%">주문/출고일자</TableCell>
              <TableCell width="14%">거래처(요청채널)</TableCell>
              <TableCell width="12%">출고처(창고)</TableCell>
              <TableCell width="25%">대표 품목</TableCell>
              <TableCell width="15%" align="right">금액</TableCell>
              <TableCell width="10%" align="center">상태</TableCell>
              <TableCell width="10%" align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center">로딩 중...</TableCell></TableRow>
            ) : shipments.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center">등록된 수기 판매 내역이 없습니다.</TableCell></TableRow>
            ) : shipments.map(s => {
              const isItemSelected = selectedItems.indexOf(s.id) !== -1;
              const partCount = s.shipment_parts?.length || 0;
              const repPart = s.shipment_parts?.[0]?.part_name || '-';
              
              return (
                <TableRow 
                  key={s.id}
                  hover
                  selected={isItemSelected}
                  sx={{ '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' } }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      checked={isItemSelected}
                      onChange={(event) => handleClick(event, s.id)}
                    />
                  </TableCell>
                  <TableCell>{dayjs(s.order_date).format('YYYY-MM-DD')}</TableCell>`;

content = content.replace(
  `      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell>주문/출고일자</TableCell>
              <TableCell>거래처(요청채널)</TableCell>
              <TableCell>출고처(창고)</TableCell>
              <TableCell>대표 품목</TableCell>
              <TableCell align="right">금액</TableCell>
              <TableCell align="center">상태</TableCell>
              <TableCell align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center">로딩 중...</TableCell></TableRow>
            ) : shipments.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">등록된 수기 판매 내역이 없습니다.</TableCell></TableRow>
            ) : shipments.map(s => {
              const partCount = s.shipment_parts?.length || 0;
              const repPart = s.shipment_parts?.[0]?.part_name || '-';
              
              return (
                <TableRow key={s.id}>
                  <TableCell>{dayjs(s.order_date).format('YYYY-MM-DD')}</TableCell>`,
  tableReplacement
);

// 7. Add Bulk Delete Dialog at the end
const bulkDeleteDialogMarkup = `
      {/* 일괄 삭제 모달 */}
      <Dialog open={bulkDeleteDialog} onClose={() => setBulkDeleteDialog(false)}>
        <DialogTitle>일괄 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>선택한 {selectedItems.length}개의 항목을 삭제하시겠습니까?</Typography>
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            이 작업은 수불부(재고)와 통계에 영향을 미치며, 삭제 후 복구할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialog(false)} color="inherit">취소</Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            삭제하기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}`;

content = content.replace(
  `    </Box>\n  );\n}`,
  bulkDeleteDialogMarkup
);

fs.writeFileSync(file, content);
console.log('Script ran successfully');
