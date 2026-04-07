import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, MenuItem, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton
} from '@mui/material';
import { Search as SearchIcon, Visibility as VisibilityIcon, Inventory as BoxIcon } from '@mui/icons-material';

const DUMMY_BOXES = [];

function BoxStatusTab() {
  const [boxes, setBoxes] = useState(DUMMY_BOXES);
  const [filterLocation, setFilterLocation] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchBoxId, setSearchBoxId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState(null);

  const handleOpenDetail = (box) => { setSelectedBox(box); setDetailOpen(true); };
  const handleCloseDetail = () => { setDetailOpen(false); setSelectedBox(null); };

  const filteredBoxes = boxes.filter(box => {
    if (filterLocation !== 'ALL' && !box.location.includes(filterLocation)) return false;
    if (filterStatus !== 'ALL' && box.status !== filterStatus) return false;
    if (searchBoxId && !box.id.toLowerCase().includes(searchBoxId.toLowerCase())) return false;
    return true;
  });

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField select fullWidth size="small" label="위치 필터" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
                <MenuItem value="ALL">전체 위치</MenuItem>
                <MenuItem value="A 창고">A 창고 (광주)</MenuItem>
                <MenuItem value="B 창고">B 창고 (청담)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField fullWidth size="small" label="박스 번호 검색" value={searchBoxId} onChange={(e) => setSearchBoxId(e.target.value)} />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" color="primary" sx={{ height: 40 }}><SearchIcon /> 검색</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}><BoxIcon color="primary" sx={{ mr: 1, verticalAlign: 'middle' }} />박스 목록 ({filteredBoxes.length}건)</Typography>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
            <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell>박스 번호</TableCell>
                  <TableCell>위치</TableCell>
                  <TableCell align="center">상태</TableCell>
                  <TableCell align="right">포함 상품 수</TableCell>
                  <TableCell align="center">상세</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBoxes.map(box => (
                  <TableRow key={box.id}>
                    <TableCell fontWeight="bold">{box.id}</TableCell>
                    <TableCell>{box.location}</TableCell>
                    <TableCell align="center"><Chip size="small" label={box.status} color="success" /></TableCell>
                    <TableCell align="right">{box.items.length}종</TableCell>
                    <TableCell align="center"><IconButton size="small" color="primary" onClick={() => handleOpenDetail(box)}><VisibilityIcon /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      {selectedBox && (
        <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="sm" fullWidth>
          <DialogTitle>박스 상세 정보 [{selectedBox.id}]</DialogTitle>
          <DialogContent dividers>
            <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}><TableHead><TableRow><TableCell>SKU</TableCell><TableCell>수량</TableCell></TableRow></TableHead><TableBody>
              {selectedBox.items.map((item, idx) => (<TableRow key={idx}><TableCell>{item.sku}</TableCell><TableCell>{item.qty}</TableCell></TableRow>))}
            </TableBody></Table>
          </DialogContent>
          <DialogActions><Button onClick={handleCloseDetail}>닫기</Button></DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default BoxStatusTab;
