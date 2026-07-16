import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, TextField, Stack, TablePagination, Grid, FormControl, InputLabel, Select, MenuItem, ButtonGroup, Checkbox, Tooltip } from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Edit as EditIcon, FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { processShipmentRevert, processShipmentCompletion } from '../../utils/inventoryUtils';
import { logAction } from '../../utils/auditLog';
import { useAuth } from '../../contexts/AuthContext';

export default function ManualSalesList({ isEmbedded = false }) {
  const { getAllowedBrands } = useAuth();
  const allowedBrands = getAllowedBrands();
  // 브랜드 접근 권한: 제한 시 해당 브랜드만 조회 (NB는 NEARBIKE 표기 포함)
  const brandFilterList = (allowedBrands === 'all' || !Array.isArray(allowedBrands) || allowedBrands.length === 0)
    ? null
    : [...new Set(allowedBrands.flatMap(b => (b === 'NB' ? ['NB', 'NEARBIKE'] : [b])))];
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [sellers, setSellers] = useState(['전체']);
  const [customers, setCustomers] = useState(['전체']);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    type: 'order_date',
    startDate: '',
    endDate: ''
  });

  const [selectedItems, setSelectedItems] = useState([]);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  // B2B 수기판매 전표 식별 조건: '과거 이카운트 이관'이거나 메모/채널에 'B2B수기판매' 등 포함
  useEffect(() => {
    async function loadInitialData() {
      const { data: whData } = await supabase.from('warehouses').select('id, name');
      if (whData) setWarehouses(whData);

      const { data: agData } = await supabase.from('agencies').select('name');
      if (agData) setCustomers(['전체', ...agData.map(a => a.name).sort()]);
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    fetchManualSales();
  }, [page, rowsPerPage, searchTrigger]);

  const fetchManualSales = async () => {
    setLoading(true);
    try {
      let query = supabase.from('shipments').select('*, shipment_parts(*)', { count: 'exact' });
      
      // 수기 판매 및 엑셀 업로드 데이터만 조회
      query = query.in('record_type', ['manual_sale', 'excel_upload']);
      // 브랜드 접근 권한 적용
      if (brandFilterList) query = query.in('brand', brandFilterList);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (sellerFilter !== 'all') {
        query = query.eq('sales_channel', sellerFilter);
      }

      if (customerFilter !== 'all') {
        query = query.eq('customer_name', customerFilter);
      }

      if (dateFilter.startDate) {
        query = query.gte(dateFilter.type, `${dateFilter.startDate}T00:00:00+09:00`);
      }
      if (dateFilter.endDate) {
        query = query.lte(dateFilter.type, `${dateFilter.endDate}T23:59:59+09:00`);
      }

      if (searchTerm) {
        let orQuery = `customer_name.ilike.%${searchTerm}%,sales_channel.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%,tracking_number.ilike.%${searchTerm}%`;
        const cleanTerm = searchTerm.replace(/^(shp-|SHP-)/i, '').trim();
        if (cleanTerm && /^[0-9a-fA-F-]+$/.test(cleanTerm)) {
           orQuery += `,id::text.ilike.%${cleanTerm}%`;
        }
        query = query.or(orQuery);
      }

      query = query.order('order_date', { ascending: false })
                   .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      
      setShipments(data || []);
      setSelectedItems([]);
      setTotalCount(count || 0);

      // 전체 합계 계산 (현재 필터 조건 반영)
      let sumQuery = supabase.from('shipments').select('price').in('record_type', ['manual_sale', 'excel_upload']);
      if (brandFilterList) sumQuery = sumQuery.in('brand', brandFilterList);
      if (statusFilter !== 'all') sumQuery = sumQuery.eq('status', statusFilter);
      if (sellerFilter !== 'all') sumQuery = sumQuery.eq('sales_channel', sellerFilter);
      if (customerFilter !== 'all') sumQuery = sumQuery.eq('customer_name', customerFilter);
      if (dateFilter.startDate) sumQuery = sumQuery.gte(dateFilter.type, `${dateFilter.startDate}T00:00:00+09:00`);
      if (dateFilter.endDate) sumQuery = sumQuery.lte(dateFilter.type, `${dateFilter.endDate}T23:59:59+09:00`);
      if (searchTerm) {
        let orQuery = `customer_name.ilike.%${searchTerm}%,sales_channel.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%,tracking_number.ilike.%${searchTerm}%`;
        const cleanTerm = searchTerm.replace(/^(shp-|SHP-)/i, '').trim();
        if (cleanTerm && /^[0-9a-fA-F-]+$/.test(cleanTerm)) {
           orQuery += `,id::text.ilike.%${cleanTerm}%`;
        }
        sumQuery = sumQuery.or(orQuery);
      }
      
      const { data: sumData } = await sumQuery;
      const calcTotal = (sumData || []).reduce((acc, curr) => acc + Number(curr.price || 0), 0);
      setTotalAmount(calcTotal);

      // 판매처 목록 동적 수집 (B2B 수기판매 대상 한정)
      if (sellers.length === 1 && data && data.length > 0) {
        const uniqueSellers = new Set();
        data.forEach(s => {
          if (s.sales_channel && s.sales_channel !== '과거 이카운트 이관') {
            uniqueSellers.add(s.sales_channel);
          }
        });
        if (uniqueSellers.size > 0) {
           setSellers(['전체', ...Array.from(uniqueSellers)]);
        }
      }
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '데이터 불러오기 실패: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const executeSearch = (e) => {
    if ((e.key && e.key === 'Enter') || !e.key) {
      if (page !== 0) {
        setPage(0);
      } else {
        setSearchTrigger(prev => prev + 1);
      }
    }
  };

  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let start = '';
    let end = '';

    switch (period) {
      case 'today':
        start = end = format(today, 'yyyy-MM-dd');
        break;
      case 'yesterday':
        start = end = format(subDays(today, 1), 'yyyy-MM-dd');
        break;
      case 'thisWeek':
        start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'lastWeek':
        const lastWeek = subDays(today, 7);
        start = format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'thisMonth':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(today), 1);
        start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      default:
        break;
    }

    setDateFilter(prev => ({ ...prev, startDate: start, endDate: end }));
  };

  const handleSaveFilter = () => {
    const filterData = {
      statusFilter,
      sellerFilter,
      customerFilter,
      dateFilter,
      searchTerm
    };
    localStorage.setItem('manualSalesFilter', JSON.stringify(filterData));
    setSnackbar({ open: true, message: '현재 필터가 저장되었습니다.', severity: 'success' });
  };

  const handleLoadFilter = () => {
    const savedFilter = localStorage.getItem('manualSalesFilter');
    if (savedFilter) {
      try {
        const parsed = JSON.parse(savedFilter);
        setStatusFilter(parsed.statusFilter || 'all');
        setSellerFilter(parsed.sellerFilter || 'all');
        setCustomerFilter(parsed.customerFilter || 'all');
        setDateFilter(parsed.dateFilter || { type: 'order_date', startDate: '', endDate: '' });
        setSearchTerm(parsed.searchTerm || '');
        if (page !== 0) {
          setPage(0);
        } else {
          setSearchTrigger(prev => prev + 1);
        }
        setSnackbar({ open: true, message: '저장된 필터를 불러왔습니다.', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: '필터를 불러오는 중 오류가 발생했습니다.', severity: 'error' });
      }
    } else {
      setSnackbar({ open: true, message: '저장된 필터가 없습니다.', severity: 'warning' });
    }
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({ ...prev, [field]: value }));
  };

  const handleDeleteConfirm = async () => {
    try {
      // 1. 재고 복구 (실제 차감된 품목만 내부적으로 판별)
      // status 문자열('완료'/'출고완료'/'작업완료' 등 생성 경로마다 다름)로 게이트하지 않음 —
      // processShipmentRevert는 shipment_parts.inventory_deducted 플래그로 정확히 판별하므로 항상 호출해도 안전함
      // transactions는 삭제하지 않음: 전표가 지워져도 차감/복구 수량 이력은 입출고 내역에 그대로 남아야 함
      await processShipmentRevert(targetToDelete.id, targetToDelete.brand);

      // 2. 부품 내역 삭제
      await supabase.from('shipment_parts').delete().eq('shipment_id', targetToDelete.id);
      
      // 3. 전표(Shipment) 본체 삭제
      const { error } = await supabase.from('shipments').delete().eq('id', targetToDelete.id);
      if (error) throw error;
      
      setSnackbar({ open: true, message: '안전하게 삭제되었으며 재고 및 통계에 반영되었습니다.', severity: 'success' });
      fetchManualSales();

      // 감사 로그: 수기 판매 삭제
      try {
        await logAction({
          action: '삭제',
          targetTable: 'shipments',
          targetId: targetToDelete.id,
          summary: `[수기판매 삭제] ${targetToDelete.customer_name} - ${targetToDelete.product_name} (금액: ${Number(targetToDelete.price || 0).toLocaleString()}원)`,
          details: targetToDelete
        });
      } catch (logErr) {
        console.warn('[AuditLog] 수기판매 삭제 로그 실패:', logErr);
      }
    } catch (err) {
      setSnackbar({ open: true, message: '삭제 실패: ' + err.message, severity: 'error' });
    } finally {
      setDeleteDialog(false);
      setTargetToDelete(null);
    }
  };


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

  
  const handleBulkAnalyze = async () => {
    if (!window.confirm(`${selectedItems.length}개 항목의 부품 구성을 최신 상품 정보 기준으로 재분석하여 덮어씁니다. 진행하시겠습니까?`)) {
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeProgress({ current: 0, total: selectedItems.length });

    try {
      let currentIdx = 0;
      for (const id of selectedItems) {
        // 1. 출고 정보 조회
        const { data: shipment, error: fetchErr } = await supabase
          .from('shipments')
          .select('*')
          .eq('id', id)
          .single();
          
        if (fetchErr || !shipment || !shipment.product_name) {
          currentIdx++;
          setAnalyzeProgress({ current: currentIdx, total: selectedItems.length });
          continue;
        }

        const productNames = shipment.product_name.split(',').map(name => name.trim()).filter(name => name);
        if (productNames.length === 0) {
          currentIdx++;
          setAnalyzeProgress({ current: currentIdx, total: selectedItems.length });
          continue;
        }

        const newParts = [];
        let partsUpdated = 0;

        for (let i = 0; i < productNames.length; i++) {
          const productName = productNames[i];
          let category = '기체';
          let price = 0;
          let partCode = '';
          let partId = null;

          // 1. 정확한 이름으로 검색
          let partFromDB = null;
          const { data: exactMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .eq('name', productName)
            .limit(1);

          if (exactMatchParts && exactMatchParts.length > 0) {
            partFromDB = exactMatchParts[0];
          } else {
            // 2. 부분 일치 검색
            const { data: partialMatchParts } = await supabase
              .from('parts')
              .select('*')
              .eq('brand', shipment.brand)
              .ilike('name', `%${productName}%`)
              .limit(1);

            if (partialMatchParts && partialMatchParts.length > 0) {
              partFromDB = partialMatchParts[0];
            }
          }

          if (partFromDB) {
            if (partFromDB.note) {
              const note = partFromDB.note.toLowerCase();
              if (note.includes('파츠') || note.includes('part') || note.includes('부품')) {
                category = '파츠';
              } else if (note.includes('공임') || note.includes('작업') || note.includes('서비스')) {
                category = '공임';
              } else if (note.includes('기타') || note.includes('etc')) {
                category = '기타';
              } else if (note.includes('기체') || note.includes('바이크') || note.includes('자전거')) {
                category = '기체';
              }
            }

            if (partFromDB.code) {
              const code = partFromDB.code.toUpperCase();
              if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
                category = '파츠';
              } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
                category = '공임';
              } else if (code.startsWith('XRBM-') || code.startsWith('NBM-') || code.includes('BIKE')) {
                category = '기체';
              }
            }

            partCode = partFromDB.code || '';
            partId = partFromDB.id || null;
            partsUpdated++;
          } else {
            partCode = '';
          }

          // 기존 금액 유지를 위해 전표의 총 금액을 품목 개수만큼 등분 (나머지는 마지막 항목에 몰아줌)
          const basePrice = shipment.price ? Math.floor(shipment.price / productNames.length) : 0;
          let currentPrice = basePrice;
          if (i === productNames.length - 1 && shipment.price) {
            currentPrice = shipment.price - (basePrice * (productNames.length - 1));
          }

          newParts.push({
            shipment_id: shipment.id,
            part_name: productName,
            part_code: partCode,
            part_category: category,
            quantity: 1, // 기본값
            price: currentPrice,
            total_price: currentPrice,
            warehouse_id: shipment.warehouse_id,
            created_at: new Date().toISOString(),
            _part_id: partId // 임시용
          });
        }

        // 기존 부품 정보 삭제
        if (shipment.status === '출고완료') {
          await processShipmentRevert(shipment.id, shipment.brand);
        }
        await supabase.from('shipment_parts').delete().eq('shipment_id', shipment.id);
        
        // 새 부품 정보 삽입
        const partsToInsert = newParts.map(p => {
           const { _part_id, ...rest } = p;
           return rest;
        });
        await supabase.from('shipment_parts').insert(partsToInsert);

        // 총 수량 업데이트 (금액은 기존 값 유지)
        const totalQuantity = newParts.reduce((sum, p) => sum + p.quantity, 0);

        await supabase.from('shipments').update({
          quantity: totalQuantity,
          product_code: newParts[0]?.part_code || '',
          updated_at: new Date().toISOString()
        }).eq('id', shipment.id);

        // 출고 완료인 경우 수불부 재동기화
        if (shipment.status === '출고완료') {
          await processShipmentCompletion(shipment.id, shipment.brand, '출고완료', true);
        }

        currentIdx++;
        setAnalyzeProgress({ current: currentIdx, total: selectedItems.length });
      }

      setSnackbar({ open: true, message: `${selectedItems.length}개 항목의 파츠 재분석 및 동기화가 완료되었습니다.`, severity: 'success' });
      fetchManualSales();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '분석 중 오류 발생: ' + err.message, severity: 'error' });
    } finally {
      setIsAnalyzing(false);
      setSelectedItems([]);
    }
  };


  const handleBulkDelete = async () => {
    try {
      setLoading(true);
      // 1. 재고 복구 (실제 차감된 품목만 내부적으로 판별)
      // transactions는 삭제하지 않음: 전표가 지워져도 차감/복구 수량 이력은 입출고 내역에 그대로 남아야 함
      const shipmentsToDelete = shipments.filter(s => selectedItems.includes(s.id));
      for (const shipment of shipmentsToDelete) {
        await processShipmentRevert(shipment.id, shipment.brand);
      }
      // 2. 부품 내역 삭제
      await supabase.from('shipment_parts').delete().in('shipment_id', selectedItems);
      // 3. 전표(Shipment) 본체 삭제
      const { error } = await supabase.from('shipments').delete().in('id', selectedItems);
      
      if (error) throw error;
      
      setSnackbar({ open: true, message: `${selectedItems.length}개의 항목이 안전하게 삭제되었습니다.`, severity: 'success' });
      fetchManualSales();

      // 감사 로그: 수기 판매 일괄 삭제
      try {
        await logAction({
          action: '일괄삭제',
          targetTable: 'shipments',
          targetId: selectedItems[0],
          summary: `[수기판매 일괄삭제] ${selectedItems.length}건 삭제`,
          details: { deletedIds: selectedItems, count: selectedItems.length }
        });
      } catch (logErr) {
        console.warn('[AuditLog] 수기판매 일괄삭제 로그 실패:', logErr);
      }
    } catch (err) {
      setSnackbar({ open: true, message: '일괄 삭제 실패: ' + err.message, severity: 'error' });
    } finally {
      setBulkDeleteDialog(false);
      setSelectedItems([]);
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      let query = supabase.from('shipments').select('*, shipment_parts(*)');
      // 브랜드 접근 권한 적용 (선택 항목/전체 모두)
      if (brandFilterList) query = query.in('brand', brandFilterList);

      if (selectedItems.length > 0) {
        // 선택된 항목만 다운로드
        query = query.in('id', selectedItems);
      } else {
        query = query.in('record_type', ['manual_sale', 'excel_upload']);

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (sellerFilter !== 'all') query = query.eq('sales_channel', sellerFilter);
        if (dateFilter.startDate) query = query.gte(dateFilter.type, `${dateFilter.startDate}T00:00:00+09:00`);
        if (dateFilter.endDate) query = query.lte(dateFilter.type, `${dateFilter.endDate}T23:59:59+09:00`);
        if (searchTerm) {
          let orQuery = `customer_name.ilike.%${searchTerm}%,sales_channel.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%,tracking_number.ilike.%${searchTerm}%`;
          const cleanTerm = searchTerm.replace(/^(shp-|SHP-)/i, '').trim();
          if (cleanTerm && /^[0-9a-fA-F-]+$/.test(cleanTerm)) {
             orQuery += `,id::text.ilike.%${cleanTerm}%`;
          }
          query = query.or(orQuery);
        }
      }

      query = query.order('order_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const { downloadExcel } = await import('../../utils/excelUtils');
      const headers = [
        { key: 'order_date', label: '주문/출고일자' },
        { key: 'customer_name', label: '고객명/거래처' },
        { key: 'sales_channel', label: '구분(판매처)' },
        { key: 'product_name', label: '대표 품목' },
        { key: 'price', label: '금액' },
        { key: 'status', label: '상태' },
        { key: 'warehouse_name', label: '출고창고' },
        { key: 'note', label: '비고' }
      ];

      const excelData = data.map(s => {
        const partCount = s.shipment_parts?.length || 0;
        const repPart = s.shipment_parts?.[0]?.part_name || '-';
        const productName = partCount > 1 ? `${repPart} 외 ${partCount - 1}건` : repPart;
        
        return {
          ...s,
          order_date: dayjs(s.order_date).format('YYYY-MM-DD'),
          product_name: productName,
          warehouse_name: s.warehouse_id ? (warehouses.find(w => w.id === s.warehouse_id)?.name || '알 수 없는 창고') : '-'
        };
      });

      await downloadExcel(excelData, headers, `수기판매내역_${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error(err);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <Box p={isEmbedded ? 0 : 3} sx={{ maxWidth: 1600, margin: '0 auto' }}>
      {!isEmbedded && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" fontWeight="bold">수기 판매관리</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/sales/manual/new')}>
              새 수기 판매 등록
            </Button>
          </Stack>
        </Box>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* 상태 & 판매처 & 거래처 드롭다운 */}
          <Grid item xs={12} md="auto">
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ width: 130 }}>
                <InputLabel>상태</InputLabel>
                <Select
                  value={statusFilter}
                  label="상태"
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 상태</MenuItem>
                  <MenuItem value="접수">접수</MenuItem>
                  <MenuItem value="출고대기">출고대기</MenuItem>
                  <MenuItem value="출고완료">출고완료</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 140 }}>
                <InputLabel>판매처</InputLabel>
                <Select
                  value={sellerFilter}
                  label="판매처"
                  onChange={e => setSellerFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 판매처</MenuItem>
                  {sellers.filter(s => s !== '전체').map(seller => (
                    <MenuItem key={seller} value={seller}>{seller}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 140 }}>
                <InputLabel>거래처(고객명)</InputLabel>
                <Select
                  value={customerFilter}
                  label="거래처(고객명)"
                  onChange={e => setCustomerFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 거래처</MenuItem>
                  {customers.filter(c => c !== '전체').map(customer => (
                    <MenuItem key={customer} value={customer}>{customer}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Grid>

          {/* 날짜 필터 & 퀵버튼 */}
          <Grid item xs={12} md>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '6px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#e0e0e0', borderRadius: '4px' } }}>
              <FormControl size="small" sx={{ width: 120, flexShrink: 0 }}>
                <InputLabel>날짜 유형</InputLabel>
                <Select
                  value={dateFilter.type}
                  label="날짜 유형"
                  onChange={(e) => handleDateFilterChange('type', e.target.value)}
                >
                  <MenuItem value="order_date">주문일자</MenuItem>
                  <MenuItem value="shipment_date">출고일자</MenuItem>
                </Select>
              </FormControl>

              <ButtonGroup size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('lastWeek')}>지난주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => handleDateFilterChange('startDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 140 } } }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => handleDateFilterChange('endDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 140 } } }}
                  />
                </Box>
              </LocalizationProvider>
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="고객명, 연락처, 제품명 등 검색"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyPress={executeSearch}
                sx={{ flexGrow: 1, maxWidth: 500 }}
              />
              <Button variant="contained" onClick={executeSearch} sx={{ bgcolor: '#3182f6' }}>검색</Button>
              <Button variant="outlined" onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSellerFilter('all');
                setCustomerFilter('all');
                setDateFilter({ type: 'order_date', startDate: '', endDate: '' });
                if (page !== 0) {
                  setPage(0);
                } else {
                  setSearchTrigger(prev => prev + 1);
                }
              }}>초기화</Button>
              <Button variant="outlined" color="secondary" onClick={handleSaveFilter}>필터 저장</Button>
              <Button variant="outlined" color="secondary" onClick={handleLoadFilter}>필터 불러오기</Button>
              <Box sx={{ flexGrow: 1 }} />
              {selectedItems.length > 0 && (
                <Button 
                  variant="outlined" 
                  color="warning" 
                  onClick={() => handleBulkAnalyze()}
                  sx={{ mr: 1 }}
                >
                  선택 분석 ({selectedItems.length})
                </Button>
              )}
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
                {selectedItems.length > 0 ? `선택 추출 (${selectedItems.length})` : '조건 추출'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
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
              <TableCell width="11%">주문/출고일자</TableCell>
              <TableCell width="11%">주문번호(ID)</TableCell>
              <TableCell width="12%">거래처(요청채널)</TableCell>
              <TableCell width="10%">출고처(창고)</TableCell>
              <TableCell width="18%">대표 품목</TableCell>
              <TableCell width="15%">메모</TableCell>
              <TableCell width="8%" align="right">금액</TableCell>
              <TableCell width="7%" align="center">상태</TableCell>
              <TableCell width="8%" align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} align="center">로딩 중...</TableCell></TableRow>
            ) : shipments.length === 0 ? (
              <TableRow><TableCell colSpan={10} align="center">등록된 수기 판매 내역이 없습니다.</TableCell></TableRow>
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
                  <TableCell>{dayjs(s.order_date).format('YYYY-MM-DD')}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="primary" sx={{ fontSize: '0.85rem' }}>
                      {s.tracking_number || (s.note?.match(/20\d{6}-\d{7}/) ? s.note.match(/20\d{6}-\d{7}/)[0] : '-')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {`SHP-${s.id.slice(0, 8).toUpperCase()}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{s.customer_name}</Typography>
                    {s.sales_channel && <Typography variant="caption" color="text.secondary">{s.sales_channel}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {s.warehouse_id ? (warehouses.find(w => w.id === s.warehouse_id)?.name || '알 수 없는 창고') : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{partCount > 1 ? `${repPart} 외 ${partCount - 1}건` : repPart}</TableCell>
                  <TableCell>
                    <Tooltip title={s.note || ''}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {s.note || '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{Number(s.price || 0).toLocaleString()}원</TableCell>
                  <TableCell align="center"><Chip label={s.status} size="small" color={s.status === '출고완료' ? 'success' : 'default'} /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => navigate(`/sales/manual/edit/${s.id}`)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => { setTargetToDelete(s); setDeleteDialog(true); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell colSpan={7} align="right" sx={{ fontWeight: 'bold', py: 2 }}>검색 결과 총 합계</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1976d2', py: 2 }}>{totalAmount.toLocaleString()}원</TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        <TablePagination
          component="div"
          count={totalCount || 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </TableContainer>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>수기 판매 전표 삭제</DialogTitle>
        <DialogContent>정말로 삭제하시겠습니까? 삭제 즉시 통계 매상에서 빠지며, 출고되어 차감되었던 장부 재고가 원래대로 복구됩니다.</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">삭제 및 재고 복구</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

      {/* 일괄 분석 진행 모달 */}
      <Dialog open={isAnalyzing}>
        <DialogTitle>일괄 분석 진행 중...</DialogTitle>
        <DialogContent sx={{ minWidth: 300, textAlign: 'center', py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {analyzeProgress.current} / {analyzeProgress.total} 개 완료
          </Typography>
        </DialogContent>
      </Dialog>

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
}