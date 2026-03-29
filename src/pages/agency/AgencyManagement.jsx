import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Checkbox, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, InputAdornment, Tooltip, Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
  AccountBalance as BankIcon,
  Close as CloseIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { transactionApi } from '../../api/transactionApi';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001'
});

export default function AgencyManagement() {
  const [agencies, setAgencies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  
  // Modals
  const [openForm, setOpenForm] = useState(false);
  const [openBankForm, setOpenBankForm] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [editData, setEditData] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const res = await api.get('/api/agencies');
      if (res.data.success) {
        setAgencies(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load agencies:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('선택한 거래처를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/api/agencies/${id}`);
      fetchAgencies();
      setSelectedItems(prev => prev.filter(item => item !== id));
    } catch (err) {
      alert('삭제 실패했습니다.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`선택한 ${selectedItems.length}개 거래처를 삭제하시겠습니까?`)) return;
    
    try {
      await Promise.all(selectedItems.map(id => api.delete(`/api/agencies/${id}`)));
      setSelectedItems([]);
      fetchAgencies();
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // 1. Read sheet as 2D array to dynamically find the header row
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i];
          if (row && Array.isArray(row)) {
            const rowText = row.join('');
            if (rowText.includes('거래처코드') || rowText.includes('거래처명')) {
              headerRowIndex = i;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          alert('엑셀 파일에서 "거래처코드" 또는 "거래처명" 헤더를 찾을 수 없습니다.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const headers = rawData[headerRowIndex].map(h => (h ? h.toString().trim() : ''));
        const dataRows = rawData.slice(headerRowIndex + 1);

        const items = dataRows.map(rowArray => {
          const row = {};
          headers.forEach((h, idx) => {
            if (h) row[h] = rowArray[idx];
          });

          return {
            business_number: row['거래처코드']?.toString().trim() || '',
            name: (row['거래처명'] || row['상호'])?.toString().trim() || '이름 없음',
            ceo_name: row['대표자명']?.toString().trim() || '',
            address: (row['주소1'] || row['주소'] || row['사업장주소'] || row['사업장 주소'] || '')?.toString().trim(),
            email: (row['이메일'] || row['Email'] || row['email'])?.toString().trim() || '',
            business_type: row['업태']?.toString().trim() || '',
            business_category: row['종목']?.toString().trim() || '',
            phone: row['전화']?.toString().trim() || '',
            mobile: (row['모바일'] || row['휴대전화'])?.toString().trim() || '',
            keywords: (row['검색창내용'] || row['키워드'])?.toString().trim() || '',
            memo: (row['적요'] || row['메모'])?.toString().trim() || ''
          };
        }).filter(item => item.business_number || item.name !== '이름 없음');

        if (items.length === 0) {
          alert('처리할 데이터가 없습니다.');
          return;
        }

        const res = await api.post('/api/agencies/bulk', { items });
        if (res.data.success) {
          alert(`${res.data.count}건의 거래처가 성공적으로 업로드되었습니다.`);
          fetchAgencies();
        }
      } catch (err) {
        console.error('Excel upload error:', err);
        alert('엑셀 업로드 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleExcelDownload = () => {
    if (filteredData.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const exportData = filteredData.map(v => ({
      '거래처코드': v.business_number || '',
      '거래처명': v.name || '',
      '대표자명': v.ceo_name || '',
      '이메일': v.email || '',
      '주소': v.address || '',
      '업태': v.business_type || '',
      '종목': v.business_category || '',
      '전화': v.phone || '',
      '모바일': v.mobile || '',
      '검색창내용': v.keywords || '',
      '적요': v.memo || '',
      '은행명': v.transfer_info?.bank || '',
      '계좌번호': v.transfer_info?.account || '',
      '예금주': v.transfer_info?.owner || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래처목록');
    
    // Auto-size columns slightly
    const colWidths = [
      { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, 
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
      { wch: 15 }, { wch: 20 }, { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `거래처목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredData = agencies.filter(v => 
    v.name.includes(searchTerm) || 
    (v.business_number && v.business_number.includes(searchTerm)) ||
    (v.keywords && v.keywords.includes(searchTerm))
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>거래처 관리</Typography>
          <Typography variant="body2" color="text.secondary">협력사, 대리점 및 거래처의 정보를 관리합니다.</Typography>
          <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
            💡 엑셀 업로드 시 <strong>[거래처코드]</strong> 기준으로 기존 데이터가 자동으로 업데이트(덮어쓰기) 됩니다.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleExcelUpload}
          />
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            엑셀 업로드
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExcelDownload}
          >
            엑셀 다운로드
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditData(null);
              setOpenForm(true);
            }}
          >
            신규 등록
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="거래처명, 코드, 검색어 입력"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ width: 300 }}
          />
          {selectedItems.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleDeleteSelected}
              startIcon={<DeleteIcon />}
            >
              선택 삭제 ({selectedItems.length})
            </Button>
          )}
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={agencies.length > 0 && selectedItems.length === filteredData.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems(filteredData.map(v => v.id));
                    } else {
                      setSelectedItems([]);
                    }
                  }}
                />
              </TableCell>
              <TableCell>거래처코드</TableCell>
              <TableCell>거래처명</TableCell>
              <TableCell>대표자명</TableCell>
              <TableCell align="center">카페24 연동 ID</TableCell>
              <TableCell>주소</TableCell>
              <TableCell>전화</TableCell>
              <TableCell>모바일</TableCell>
              <TableCell>적요</TableCell>
              <TableCell align="center">이체정보</TableCell>
              <TableCell align="right">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map(row => (
              <TableRow key={row.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedItems.includes(row.id)}
                    onChange={() => {
                      setSelectedItems(prev => 
                        prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                      );
                    }}
                  />
                </TableCell>
                <TableCell>{row.business_number}</TableCell>
                <TableCell sx={{ fontWeight: 'medium' }}>{row.name}</TableCell>
                <TableCell>{row.ceo_name}</TableCell>
                <TableCell align="center">
                  {row.cafe24_member_id ? <Chip label={row.cafe24_member_id} size="small" color="info" variant="outlined" /> : '-'}
                </TableCell>
                <TableCell>
                  <Tooltip title={row.address || '주소 없음'}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: '-webkit-box', 
                        WebkitLineClamp: 2, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden',
                        maxWidth: 150
                      }}
                    >
                      {row.address || '-'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>{row.mobile}</TableCell>
                <TableCell>{row.memo}</TableCell>
                <TableCell align="center">
                  <Button 
                    size="small" 
                    variant={row.transfer_info?.bank ? "contained" : "outlined"}
                    color={row.transfer_info?.bank ? "primary" : "inherit"}
                    sx={{ minWidth: 60, height: 26, fontSize: '0.75rem' }}
                    onClick={() => {
                      setEditData(row);
                      setOpenBankForm(true);
                    }}
                  >
                    {row.transfer_info?.bank ? '수정' : '등록'}
                  </Button>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="출고/거래 내역">
                    <IconButton size="small" color="info" onClick={() => { setEditData(row); setOpenHistory(true); }}>
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => { setEditData(row); setOpenForm(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">데이터가 없습니다.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 기본 폼 모달 */}
      <AgencyFormDialog 
        open={openForm} 
        data={editData} 
        onClose={() => setOpenForm(false)} 
        onSave={fetchAgencies} 
      />

      {/* 이체정보 모달 */}
      <BankInfoDialog 
        open={openBankForm} 
        data={editData} 
        onClose={() => setOpenBankForm(false)} 
        onSave={fetchAgencies} 
      />

      {/* 거래내역 모달 */}
      <AgencyHistoryDialog
        open={openHistory}
        agency={editData}
        onClose={() => setOpenHistory(false)}
      />
    </Box>
  );
}

// ----------------------------------------------------
// Agency Form Component (거래처 등록/수정)
// ----------------------------------------------------
function AgencyFormDialog({ open, data, onClose, onSave }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (open) {
      setFormData(data || {
        business_number: '', name: '', ceo_name: '', address: '', email: '', business_type: '', business_category: '', phone: '', mobile: '', keywords: '', memo: '', cafe24_member_id: ''
      });
    }
  }, [open, data]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('거래처명은 필수입니다.');
      return;
    }
    try {
      if (data?.id) {
        await api.put(`/api/agencies/${data.id}`, formData);
      } else {
        await api.post('/api/agencies', formData);
      }
      onSave();
      onClose();
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{data?.id ? '거래처 수정' : '거래처 등록'}</DialogTitle>
      <DialogContent dividers sx={{ p: 2, overflowY: 'auto' }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="거래처코드 (사업자번호 등)" name="business_number" value={formData.business_number || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="카페24 연동 ID" name="cafe24_member_id" value={formData.cafe24_member_id || ''} onChange={handleChange} placeholder="mall_id" />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="거래처명" name="name" required value={formData.name || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="대표자명" name="ceo_name" value={formData.ceo_name || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="전화번호" name="phone" value={formData.phone || ''} onChange={handleChange} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="모바일" name="mobile" value={formData.mobile || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="이메일" name="email" value={formData.email || ''} onChange={handleChange} type="email" />
          </Grid>

          <Grid item xs={12}>
            <TextField size="small" fullWidth label="사업장 주소" name="address" value={formData.address || ''} onChange={handleChange} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="업태" name="business_type" value={formData.business_type || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="종목" name="business_category" value={formData.business_category || ''} onChange={handleChange} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="검색 키워드 (띄어쓰기로 구분)" name="keywords" value={formData.keywords || ''} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField size="small" fullWidth label="적요 (메모)" name="memo" value={formData.memo || ''} onChange={handleChange} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained">저장</Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------
// Bank Info Form Component (이체정보 등록)
// ----------------------------------------------------
function BankInfoDialog({ open, data, onClose, onSave }) {
  const [bankInfo, setBankInfo] = useState({ bank: '', account: '', owner: '' });

  useEffect(() => {
    if (open && data) {
      setBankInfo(data.transfer_info || { bank: '', account: '', owner: '' });
    }
  }, [open, data]);

  const handleChange = (e) => {
    setBankInfo({ ...bankInfo, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      await api.put(`/api/agencies/${data.id}`, { transfer_info: bankInfo });
      onSave();
      onClose();
    } catch (err) {
      alert('이체정보 저장 실패: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>이체정보 등록 - {data?.name}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth label="은행명" name="bank" value={bankInfo.bank || ''} onChange={handleChange} placeholder="예: 국민은행" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="계좌번호" name="account" value={bankInfo.account || ''} onChange={handleChange} placeholder="예: 123-456-789012" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="예금주" name="owner" value={bankInfo.owner || ''} onChange={handleChange} placeholder="예: 홍길동" />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">저장</Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------
// Agency History Component (거래처 출고/거래 내역)
// ----------------------------------------------------
function AgencyHistoryDialog({ open, agency, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (open && agency) {
      fetchHistory();
    } else {
      setTransactions([]);
    }
  }, [open, agency]);

  const fetchHistory = async () => {
    if (!agency?.id) return;
    setLoading(true);
    try {
      const data = await transactionApi.getByLocation(agency.id);
      setTransactions(data || []);
    } catch (err) {
      console.error('거래처 내역 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.date >= startDate && t.date <= endDate
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6">{agency?.name} 거래/출고 내역</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, overflowX: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            type="date"
            label="시작일"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Typography color="text.secondary">~</Typography>
          <TextField
            size="small"
            type="date"
            label="종료일"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="primary" fontWeight="bold">
            기간 내 거래 건수: {filteredTransactions.length}건
          </Typography>
        </Box>
        
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">로딩 중...</Typography></Box>
        ) : filteredTransactions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">조회된 내역이 없습니다.</Typography></Box>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>날짜</TableCell>
                  <TableCell>구분</TableCell>
                  <TableCell>상품명</TableCell>
                  <TableCell>제품코드</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell>관련 메모</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{t.date}</TableCell>
                    <TableCell>
                      {t.fromLocation === String(agency.id) || t.fromLocation === Number(agency.id) ? (
                        <Typography variant="body2" color="error">반품/출고</Typography>
                      ) : (
                        <Typography variant="body2" color="primary">입고/수신</Typography>
                      )}
                    </TableCell>
                    <TableCell>{t.productName}</TableCell>
                    <TableCell>{t.productCode || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t.quantity}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {t.note || '-'} {t.additionalNote ? `(${t.additionalNote})` : ''}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
