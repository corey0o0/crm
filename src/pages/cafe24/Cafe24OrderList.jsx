import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete, TextField, Tabs, Tab, Select, MenuItem, FormControl, InputLabel, Checkbox, IconButton, Tooltip, InputAdornment, TablePagination, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { Sync as SyncIcon, PersonAdd as PersonAddIcon, Search as SearchIcon, Edit as EditIcon } from '@mui/icons-material';
import Cafe24Settings from '../../components/Settings/Cafe24Settings';
import { supabase } from '../../lib/supabaseClient';
import { getCafe24Malls, syncCafe24Orders, addCafe24ProductMapping, transferCafe24Orders, cancelSalesTransfer } from '../../utils/cafe24Api';
import { agencyApi } from '../../api/agencyApi';
import { warehouseApi } from '../../api/warehouseApi';

const STATUS_KO = {
  'N00': '입금전', 'N10': '상품준비중', 'N20': '배송준비중', 'N21': '배송대기',
  'N22': '배송보류', 'N30': '배송중', 'N40': '배송완료', 'N50': '구매확정',
  'C00': '취소접수', 'C10': '취소처리중', 'C40': '취소처리', 
  'E00': '교환접수', 'E10': '교환처리중', 'E40': '교환처리', 
  'R00': '반품접수', 'R10': '반품처리중', 'R40': '반품처리',
  // 배송 등 영문자 단일 상태 보완
  'M': '배송준비중', 'T': '배송중', 'F': '배송완료', 'W': '배송보류',
  'C': '취소처리', 'E': '교환처리', 'R': '반품처리', 'null': '상태없음'
};
const getKoStatus = (status) => STATUS_KO[String(status).trim()] || status;
const getBadgeColor = (status) => {
  if (!status) return 'default';
  const s = String(status).trim();
  if (s.startsWith('C')) return 'error';
  if (s.startsWith('R')) return 'warning';
  if (s.startsWith('E')) return 'secondary';
  if (s === 'N30' || s === 'N40' || s === 'N50' || s === 'F') return 'success';
  return 'primary';
};

const MEMBER_GROUPS = {
  '12': '사업자회원',
  '15': '엑스라이더',
};
const getGroupName = (no) => MEMBER_GROUPS[no] || `그룹:${no}`;

// 날짜 포맷팅 헬퍼
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function Cafe24OrderList() {
  const [orders, setOrders] = useState([]);
  const [malls, setMalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseConfig, setWarehouseConfig] = useState({});
  const [batchWarehouse, setBatchWarehouse] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [selectedMall, setSelectedMall] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [transferFilter, setTransferFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPriceDetails, setShowPriceDetails] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  useEffect(() => {
    setPage(0);
  }, [selectedMall, transferFilter, statusFilter, searchQuery]);

  const getFormattedDate = (date) => {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return getFormattedDate(d);
  });
  const [endDate, setEndDate] = useState(() => getFormattedDate(new Date()));

  const setPeriod = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setEndDate(getFormattedDate(end));
    setStartDate(getFormattedDate(start));
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setStartDate(getFormattedDate(yesterday));
    setEndDate(getFormattedDate(yesterday));
  };

  // 매핑 모달 상태
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingItem, setMappingItem] = useState(null); // { mall_id, product_code, custom_product_code, name }
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [mappingSaving, setMappingSaving] = useState(false);

  // 커스텀 알림창 상태
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [alertDialog, setAlertDialog] = useState({ open: false, title: '알림', message: '' });

  // 거래처 연동 상태
  const [agencies, setAgencies] = useState([]);
  const [agencyMatchModalOpen, setAgencyMatchModalOpen] = useState(false);
  const [selectedOrderForAgencyMatch, setSelectedOrderForAgencyMatch] = useState(null);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [agencyMatchSaving, setAgencyMatchSaving] = useState(false);

  // 금액 수정 모달 상태
  const [amountEditModalOpen, setAmountEditModalOpen] = useState(false);
  const [amountEditOrder, setAmountEditOrder] = useState(null);
  const [newAmount, setNewAmount] = useState('');
  const [amountEditSaving, setAmountEditSaving] = useState(false);

  useEffect(() => {
    fetchMalls();
    fetchOrders();
    fetchParts();
    fetchAgencies();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (warehouses.length > 0 && orders.length > 0) {
      const defaultWh = warehouses.find(w => w.name.includes('청담'));
      if (!defaultWh) return;
      
      setWarehouseConfig(prev => {
        let changed = false;
        const next = { ...prev };
        orders.forEach(order => {
          if (order.is_transferred) return;
          const items = order.order_items || [];
          if (!next[order.id]) {
            next[order.id] = {};
          }
          items.forEach((_, idx) => {
            if (!next[order.id][idx]) {
              next[order.id][idx] = defaultWh.id;
              changed = true;
            }
          });
        });
        return changed ? next : prev;
      });
    }
  }, [warehouses, orders]);

  const fetchWarehouses = async () => {
    try {
      const data = await warehouseApi.getAll();
      setWarehouses(data || []);
    } catch(e) { console.error('fetch wh err', e) }
  };

  const fetchAgencies = async () => {
    try {
      const data = await agencyApi.getAll();
      setAgencies(data || []);
    } catch (err) {
      console.error('거래처 목록 불러오기 실패:', err);
    }
  };

  const fetchMalls = async () => {
    try {
      const res = await getCafe24Malls();
      if (res.success && res.malls) {
        setMalls(res.malls.filter(m => m.connected));
      }
    } catch (err) {
      console.error(err);
      setError('쇼핑몰 설정 정보를 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
    }
  };

  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('id, name, barcode, code').order('name');
    if (data) setAvailableParts(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('cafe24_orders')
        .select('*')
        .neq('is_deleted', true)
        .order('order_date', { ascending: false })
        .limit(200);

      if (dbErr) throw dbErr;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      setError('주문 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (malls.length === 0) {
      alert('연동된 카페24 쇼핑몰이 없습니다. 설정 메뉴에서 쇼핑몰을 연동해주세요.');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      // 선택된 쇼핑몰만 동기화하도록 변경. all인 경우 전체.
      const syncMalls = selectedMall === 'all' 
        ? malls 
        : malls.filter(m => m.mall_id === selectedMall);

      for (const m of syncMalls) {
        await syncCafe24Orders(m.mall_id, startDate, endDate); 
      }
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const baseFilteredOrders = orders.filter(order => {
    if (selectedMall !== 'all' && order.mall_id !== selectedMall) return false;
    if (statusFilter !== 'all' && getKoStatus(order.status) !== statusFilter) return false;
    
    // 뱃지 필터링
    const groupNo = String(order.buyer_group_no || '').trim();
    if (badgeFilter === 'special' && order.member_authentication !== 'B') return false;
    if (badgeFilter === 'xrider' && groupNo !== '15') return false;
    if (badgeFilter === 'normal' && (order.member_authentication === 'B' || groupNo === '15')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrderId = String(order.order_id || '').toLowerCase().includes(q);
      const matchBuyerName = String(order.buyer_name || '').toLowerCase().includes(q);
      const matchBuyerId = String(order.buyer_id || '').toLowerCase().includes(q);
      const items = order.order_items || [];
      const matchProduct = items.some(item => String(item.name || '').toLowerCase().includes(q) || String(item.product_code || '').toLowerCase().includes(q));
      
      if (!matchOrderId && !matchBuyerName && !matchBuyerId && !matchProduct) return false;
    }
    return true;
  });

  const transferCounts = {
    all: baseFilteredOrders.length,
    not_transferred: baseFilteredOrders.filter(o => !o.is_transferred).length,
    transferred: baseFilteredOrders.filter(o => o.is_transferred).length,
  };

  const filteredOrders = baseFilteredOrders.filter(order => {
    if (transferFilter === 'transferred' && !order.is_transferred) return false;
    if (transferFilter === 'not_transferred' && order.is_transferred) return false;
    return true;
  });

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filteredOrders.map(n => n.id);
      setSelectedOrders(newSelecteds);
      return;
    }
    setSelectedOrders([]);
  };

  const handleSelectRow = (event, id) => {
    const selectedIndex = selectedOrders.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedOrders, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedOrders.slice(1));
    } else if (selectedIndex === selectedOrders.length - 1) {
      newSelected = newSelected.concat(selectedOrders.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selectedOrders.slice(0, selectedIndex), selectedOrders.slice(selectedIndex + 1));
    }
    setSelectedOrders(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (!selectedOrders.length) return;
    if (!window.confirm(`선택한 ${selectedOrders.length}건의 주문을 목록에서 영구히 삭제하시겠습니까? (삭제 시 재수집해도 나타나지 않습니다)`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('cafe24_orders')
        .update({ is_deleted: true })
        .in('id', selectedOrders);
      if (error) throw error;

      alert('삭제되었습니다.');
      setSelectedOrders([]);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleBatchApplyWarehouse = () => {
    if (!batchWarehouse) {
      alert('일괄 적용할 창고를 선택해주세요.');
      return;
    }
    if (!selectedOrders.length) {
      alert('창고를 일괄 지정할 주문을 먼저 체크해주세요.');
      return;
    }
    setWarehouseConfig(prev => {
      const next = { ...prev };
      selectedOrders.forEach(orderId => {
        const order = orders.find(o => o.id === orderId);
        if (order && !order.is_transferred) {
          if (!next[orderId]) next[orderId] = {};
          (order.order_items || []).forEach((_, idx) => {
             next[orderId][idx] = batchWarehouse;
          });
        }
      });
      return next;
    });
    alert('체크된 주문의 모든 품목에 출고 창고가 일괄 지정되었습니다.');
  };

  const handleSalesTransfer = async () => {
    if (!selectedOrders.length) return;
    const ordersToTransfer = orders.filter(o => selectedOrders.includes(o.id) && !o.is_transferred);
    
    if (ordersToTransfer.length === 0) {
      setAlertDialog({ open: true, title: '알림', message: '선택한 주문 중 판매 전송 가능한 건이 없습니다. (이미 전송 완료된 건 제외)' });
      return;
    }

    let missingWarehouse = false;
    for (const order of ordersToTransfer) {
      const items = order.order_items || [];
      for (let i = 0; i < items.length; i++) {
        if (!warehouseConfig[order.id] || !warehouseConfig[order.id][i]) {
          missingWarehouse = true;
          break;
        }
      }
      if (missingWarehouse) break;
    }

    if (missingWarehouse) {
      setAlertDialog({ open: true, title: '주의', message: '🔴 창고(출고처)가 지정되지 않은 항목이 있습니다.\n전송할 모든 주문의 품목 끝에 있는 [출고창고]를 지정해주세요.' });
      return;
    }

    let hasUnmappedItems = false;
    for (const order of ordersToTransfer) {
      const items = order.order_items || [];
      for (const item of items) {
        if (!item.part_id && (item.custom_product_code || item.product_code)) {
          hasUnmappedItems = true;
          break;
        }
      }
      if (hasUnmappedItems) break;
    }

    if (hasUnmappedItems) {
      setAlertDialog({ open: true, title: '매핑 누락', message: '🔴 품목코드가 미스매칭(수동 연결 필요) 상태인 항목이 포함되어 있습니다.\n해당 품목의 [수동 연결] 버튼을 눌러 먼저 ERP 품목과 매핑을 완료해주세요.' });
      return;
    }

    setConfirmDialog({
      open: true,
      title: '판매 반영(전송)',
      message: `${ordersToTransfer.length}건의 주문을 분할 전송(매출/출고 등록 및 재고 차감)하시겠습니까?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          await transferCafe24Orders(ordersToTransfer.map(o => o.id), warehouseConfig);
          setAlertDialog({ open: true, title: '성공', message: '전송이 완료되었습니다.' });
          setSelectedOrders([]);
          setWarehouseConfig(prev => {
            const next = { ...prev };
            ordersToTransfer.forEach(o => delete next[o.id]);
            return next;
          });
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '전송 실패', message: err.message });
          setLoading(false);
        }
      }
    });
  };

  const handleSingleSalesTransfer = async (order) => {
    if (order.is_transferred) return;
    const items = order.order_items || [];
    let missingWarehouse = false;
    for (let i = 0; i < items.length; i++) {
      if (!warehouseConfig[order.id] || !warehouseConfig[order.id][i]) {
        missingWarehouse = true;
        break;
      }
    }
    if (missingWarehouse) {
      setAlertDialog({ open: true, title: '주의', message: '🔴 창고(출고처)가 지정되지 않은 항목이 있습니다.\n해당 주문의 품목에 있는 [출고창고]를 모두 지정해주세요.' });
      return;
    }

    const hasUnmappedItem = items.some(item => !item.part_id && (item.custom_product_code || item.product_code));
    if (hasUnmappedItem) {
      setAlertDialog({ open: true, title: '매핑 누락', message: '🔴 품목코드가 미스매칭(수동 연결 필요) 상태인 항목이 있습니다.\n해당 품목의 [수동 연결] 버튼을 눌러 먼저 ERP 품목과 매핑을 완료해주세요.' });
      return;
    }
    
    setConfirmDialog({
      open: true,
      title: '개별 판매 전송',
      message: `주문(Cafe24 ID: ${order.order_id})을 전송(매출/출고 등록 및 재고 차감)하시겠습니까?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          await transferCafe24Orders([order.id], warehouseConfig);
          setAlertDialog({ open: true, title: '성공', message: '전송이 완료되었습니다.' });
          setWarehouseConfig(prev => {
            const next = { ...prev };
            delete next[order.id];
            return next;
          });
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '전송 실패', message: err.message });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleIgnoreOrders = async () => {
    if (!selectedOrders.length) return;
    const ordersToIgnore = orders.filter(o => selectedOrders.includes(o.id) && !o.is_transferred);
    
    if (ordersToIgnore.length === 0) {
      setAlertDialog({ open: true, title: '알림', message: '선택한 주문 중 제외할 미전송 건이 없습니다.' });
      return;
    }

    setConfirmDialog({
      open: true,
      title: '판매 반영 예외 처리 (무시)',
      message: `선택한 ${ordersToIgnore.length}건을 매출 및 재고 변동 없이 [전송 완료] 처리하여 리스트에서 넘기시겠습니까? \\n(실제 재고는 차감되지 않습니다.)`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from('cafe24_orders')
            .update({ is_transferred: true }) // 실제론 전송을 안하고 상태만 넘김
            .in('id', ordersToIgnore.map(o => o.id));
          if (error) throw error;
          
          setAlertDialog({ open: true, title: '처리 완료', message: '선택 항목이 반영 예외(완료) 처리되었습니다.' });
          setSelectedOrders([]);
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '처리 실패', message: err.message });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSingleIgnoreOrder = async (order) => {
    if (order.is_transferred) return;
    
    setConfirmDialog({
      open: true,
      title: '판매 반영 예외 처리 (무시)',
      message: `주문(Cafe24 ID: ${order.order_id})을 매출 및 재고 변동 없이 [전송 완료] 처리하여 리스트에서 넘기시겠습니까? \\n(실제 재고는 차감되지 않습니다.)`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from('cafe24_orders')
            .update({ is_transferred: true })
            .eq('id', order.id);
          if (error) throw error;
          
          setAlertDialog({ open: true, title: '처리 완료', message: '반영 예외(완료) 처리되었습니다.' });
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '처리 실패', message: err.message });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCancelTransfer = async () => {
    if (!selectedOrders.length) return;
    const ordersToCancel = orders.filter(o => selectedOrders.includes(o.id) && o.is_transferred);
    
    if (ordersToCancel.length === 0) {
      setAlertDialog({ open: true, title: '알림', message: '선택한 주문 중 판매 반영(전송)이 완료된 주문이 없습니다.' });
      return;
    }

    setConfirmDialog({
      open: true,
      title: '판매 반영 취소',
      message: `선택한 ${ordersToCancel.length}건의 주문에 대해 판매 반영 및 모든 입출고 내역/통계를 취소하시겠습니까?\\n(청담 창고에서 이미 검수 완료된 건은 자동 제외됩니다.)`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const orderIds = ordersToCancel.map(o => o.id);
          const res = await cancelSalesTransfer(orderIds);
          setAlertDialog({ open: true, title: '취소 성공', message: res.message || '판매 전송 취소가 완료되었습니다.' });
          // 선택 해제
          setSelectedOrders(prev => prev.filter(id => !orderIds.includes(id)));
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '취소 실패', message: err.message });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSingleCancelTransfer = async (order) => {
    if (!order.is_transferred) return;
    
    setConfirmDialog({
      open: true,
      title: '판매 반영 취소',
      message: `주문(Cafe24 ID: ${order.order_id})의 판매 반영 내역(입출고 등)을 취소하고 미전송 상태로 되돌리시겠습니까?\\n(청담 창고에서 이미 검수 완료된 건은 초기화할 수 없습니다.)`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await cancelSalesTransfer([order.id]);
          setAlertDialog({ open: true, title: '취소 성공', message: res.message || '판매 전송 취소가 완료되었습니다.' });
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '취소 실패', message: err.message });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const openMappingModal = (order, item) => {
    const targetCode = item.custom_product_code || item.product_code;
    setMappingItem({
      mall_id: order.mall_id,
      product_code: targetCode,
      name: item.name
    });
    setSelectedPart(null);
    setMappingModalOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!mappingItem || !selectedPart) return;
    setMappingSaving(true);
    try {
      await addCafe24ProductMapping(mappingItem.mall_id, mappingItem.product_code, selectedPart.id);
      alert('수동 매핑이 저장되었습니다. 동기화를 다시 실행하여 반영할 수 있습니다.');
      setMappingModalOpen(false);
      // 재동기화 권장
      handleSync();
    } catch (err) {
      alert(err.message);
    } finally {
      setMappingSaving(false);
    }
  };

  const handleOpenAgencyMatchModal = (order) => {
    setSelectedOrderForAgencyMatch(order);
    const existing = order.agency_id ? agencies.find(a => a.id === order.agency_id) : null;
    setSelectedAgency(existing || null);
    setAgencyMatchModalOpen(true);
  };

  const handleSaveAgencyMatch = async () => {
    if (!selectedOrderForAgencyMatch || !selectedAgency) return;
    setAgencyMatchSaving(true);
    try {
      // 1. 거래처에 카페24 연동 ID 등록 (여러 아이디를 쉼표로 관리)
      const existingIds = selectedAgency.cafe24_member_id ? selectedAgency.cafe24_member_id.split(',').map(s => s.trim()).filter(Boolean) : [];
      let newCafe24MemberId = selectedAgency.cafe24_member_id || '';
      
      if (!existingIds.includes(selectedOrderForAgencyMatch.buyer_id)) {
        newCafe24MemberId = newCafe24MemberId 
          ? `${newCafe24MemberId}, ${selectedOrderForAgencyMatch.buyer_id}` 
          : selectedOrderForAgencyMatch.buyer_id;
      }
      
      await agencyApi.update(selectedAgency.id, {
        cafe24_member_id: newCafe24MemberId
      });
      
      // 2. 이 사용자(buyer_id)의 모든 기존 주문을 새로운 일괄 업데이트
      const { error: updateErr } = await supabase
        .from('cafe24_orders')
        .update({ agency_id: selectedAgency.id })
        .eq('buyer_id', selectedOrderForAgencyMatch.buyer_id);
        
      if (updateErr) throw updateErr;

      alert('거래처 매칭이 완료되었으며, 이 주문자의 기존 주문들도 모두 업데이트되었습니다.');
      setAgencyMatchModalOpen(false);
      
      // 목록 갱신
      fetchOrders();
      fetchAgencies();
    } catch (err) {
      console.error(err);
      alert('매칭 저장 중 오류가 발생했습니다.');
    } finally {
      setAgencyMatchSaving(false);
    }
  };

  const handleOpenAmountEditModal = (order) => {
    setAmountEditOrder(order);
    const currentVal = order.actual_payment_amount !== undefined && order.actual_payment_amount !== null ? order.actual_payment_amount : (order.total_amount || 0);
    setNewAmount(currentVal);
    setAmountEditModalOpen(true);
  };

  const handleSaveAmount = async () => {
    if (!amountEditOrder) return;
    setAmountEditSaving(true);
    try {
      const { error } = await supabase.from('cafe24_orders')
        .update({ total_amount: Number(newAmount), actual_payment_amount: Number(newAmount) })
        .eq('id', amountEditOrder.id);
        
      if (error) throw error;
      
      setAmountEditModalOpen(false);
      fetchOrders();
    } catch (err) {
      alert('금액 수정 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setAmountEditSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>온라인주문관리</Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)}>
          <Tab label="주문 내역" />
          <Tab label="카페24 연동 관리" />
        </Tabs>
      </Box>

      <div role="tabpanel" hidden={tabValue !== 0}>
        {tabValue === 0 && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              {/* 쇼핑몰 탭 (Sub-Tabs) */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={selectedMall} 
                  onChange={(e, val) => setSelectedMall(val)} 
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label="전체 쇼핑몰" value="all" />
                  {malls.map(m => (
                    <Tab 
                      key={m.mall_id} 
                      value={m.mall_id} 
                      label={m.mall_id === 'slimpack79' ? '엑스라이더(slimpack79)' : m.mall_id === 'nearbike' ? '니어바이크(nearbike)' : m.mall_id} 
                    />
                  ))}
                </Tabs>
              </Box>

              {/* 첫 번째 줄: 필터 및 일반 설정 */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>

                <ToggleButtonGroup
                  color="primary"
                  value={transferFilter}
                  exclusive
                  onChange={(e, val) => { if (val) setTransferFilter(val); }}
                  size="small"
                  sx={{ bgcolor: 'white', height: 40 }}
                >
                  <ToggleButton value="all" sx={{ px: 2 }}>
                    전체 내역 <Chip label={transferCounts.all} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'all' ? "primary" : "default"} />
                  </ToggleButton>
                  <ToggleButton value="not_transferred" sx={{ px: 2 }}>
                    미전송 <Chip label={transferCounts.not_transferred} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'not_transferred' ? "warning" : "default"} />
                  </ToggleButton>
                  <ToggleButton value="transferred" sx={{ px: 2 }}>
                    전송완료 <Chip label={transferCounts.transferred} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'transferred' ? "success" : "default"} />
                  </ToggleButton>
                </ToggleButtonGroup>

                <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white' }}>
                  <InputLabel>주문 상태</InputLabel>
                  <Select value={statusFilter} label="주문 상태" onChange={e => setStatusFilter(e.target.value)}>
                    <MenuItem value="all">모든 상태</MenuItem>
                    {[...new Set(orders.map(o => getKoStatus(o.status)))].filter(Boolean).sort().map(label => (
                      <MenuItem key={label} value={label}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <ToggleButtonGroup
                  color="info"
                  value={badgeFilter}
                  exclusive
                  onChange={(e, val) => { if (val) setBadgeFilter(val); }}
                  size="small"
                  sx={{ bgcolor: 'white', height: 40 }}
                >
                  <ToggleButton value="all" sx={{ px: 2 }}>전체 등급</ToggleButton>
                  <ToggleButton value="normal" sx={{ px: 2 }}>일반회원</ToggleButton>
                  <ToggleButton value="special" sx={{ px: 2 }}>특별관리(B)</ToggleButton>
                  <ToggleButton value="xrider" sx={{ px: 2 }}>엑스라이더</ToggleButton>
                </ToggleButtonGroup>

                <ToggleButton
                  value="check"
                  selected={showPriceDetails}
                  onChange={() => setShowPriceDetails(!showPriceDetails)}
                  color="secondary"
                  size="small"
                  sx={{ bgcolor: 'white', height: 40, px: 2 }}
                >
                  금액 상세 {showPriceDetails ? '접기' : '펼침'}
                </ToggleButton>

                <TextField
                  size="small"
                  label="통합 검색 (주문번호, 이름, 상품명 등)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                  }}
                  sx={{ width: 300, bgcolor: 'white' }}
                />

                <Box sx={{ flexGrow: 1 }} />

                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField type="date" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} sx={{ width: 130 }} />
                  <Typography>~</Typography>
                  <TextField type="date" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} sx={{ width: 130 }} />
                </Stack>
                <Button variant="outlined" size="small" onClick={() => setPeriod(0)}>금일</Button>
                <Button variant="outlined" size="small" onClick={setYesterday}>전일</Button>
                <Button variant="outlined" size="small" onClick={() => setPeriod(7)}>일주일</Button>
                <Button variant="outlined" size="small" onClick={() => setPeriod(30)}>1개월</Button>
                
                <Button 
                  variant="outlined" 
                  color="secondary"
                  startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />} 
                  onClick={handleSync}
                  disabled={syncing}
                  sx={{ ml: 1 }}
                >
                  {syncing ? '수집 중...' : (selectedMall === 'all' ? '전체 쇼핑몰 대량 수집' : '선택된 쇼핑몰 주문 수집')}
                </Button>
              </Box>

              {/* 두 번째 줄: 실행 액션 관리들 */}
              <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ mr: 2, fontWeight: 'bold', color: '#1565c0' }}>
                  총 {filteredOrders.length}건 검색됨 {selectedOrders.length > 0 && `(현재 ${selectedOrders.length}건 선택됨)`}
                </Typography>
                
                {selectedOrders.length > 0 ? (
                  <Stack direction="row" spacing={2} sx={{ ml: 'auto', alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 140, bgcolor: 'white' }}>
                      <InputLabel>선택 일괄 창고지정</InputLabel>
                      <Select 
                        value={batchWarehouse} 
                        onChange={e => setBatchWarehouse(e.target.value)}
                        label="선택 일괄 창고지정"
                      >
                        <MenuItem value=""><em>미선택</em></MenuItem>
                        {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button size="small" variant="contained" color="secondary" onClick={handleBatchApplyWarehouse}>
                      일괄적용
                    </Button>
                    <Box sx={{ width: 1, height: 30, bgcolor: 'divider', mx: 1 }} />
                    <Button size="small" variant="outlined" color="error" onClick={handleDeleteSelected}>
                      삭제
                    </Button>
                    <Button size="medium" variant="contained" color="error" onClick={handleCancelTransfer}>
                      판매 반영 취소
                    </Button>
                    <Button size="medium" variant="outlined" color="warning" onClick={handleIgnoreOrders}>
                      판매 반영 예외(무시)
                    </Button>
                    <Button size="medium" variant="contained" color="primary" onClick={handleSalesTransfer}>
                      판매 반영(전송)
                    </Button>
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
                    주문을 체크하면 '판매 반영(매출 연동)' 및 삭제 메뉴가 활성화됩니다.
                  </Typography>
                )}
              </Box>
            </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ 
          minWidth: 1500, 
          whiteSpace: 'nowrap',
          border: '1px solid rgba(224, 224, 224, 1)',
          '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' },
          '& .MuiTableCell-root': {
            fontSize: '0.85rem',
            padding: '3px 6px',
            lineHeight: 1.2
          },
          '& .MuiTableHead-root .MuiTableCell-root': {
            fontWeight: 600,
            fontSize: '0.85rem'
          }
        }}>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length}
                  checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                  onChange={handleSelectAllClick}
                />
              </TableCell>
              <TableCell><strong>쇼핑몰명</strong></TableCell>
              <TableCell><strong>주문번호(일시/상태)</strong></TableCell>
              <TableCell><strong>주문자(ID)</strong></TableCell>
              <TableCell><strong>쇼핑몰상품명(옵션)</strong></TableCell>
              <TableCell align="right"><strong>수량</strong></TableCell>
              {showPriceDetails && <TableCell align="right"><strong>단가</strong></TableCell>}
              {showPriceDetails && <TableCell align="right"><strong>주문액</strong></TableCell>}
              {showPriceDetails && <TableCell align="right"><strong>상품할인</strong></TableCell>}
              {showPriceDetails && <TableCell align="right"><strong>묶음할인</strong></TableCell>}
              <TableCell align="right"><strong>실결제액</strong></TableCell>
              <TableCell align="right"><strong>배송비</strong></TableCell>
              <TableCell align="right"><strong>할인/적립금</strong></TableCell>
              <TableCell align="right"><strong>총결제액</strong></TableCell>
              <TableCell><strong>품목코드(ERP)</strong></TableCell>
              <TableCell><strong>품목명(ERP)</strong></TableCell>
              <TableCell><strong>배송메시지</strong></TableCell>
              <TableCell><strong>출고창고(필수)</strong></TableCell>
              <TableCell><strong>판매전송</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={16} align="center" sx={{ py: 3 }}><CircularProgress /></TableCell></TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow><TableCell colSpan={16} align="center" sx={{ py: 3 }}>수집·필터 조건에 맞는 주문 데이터가 없습니다.</TableCell></TableRow>
            ) : (
              filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).reduce((acc, order) => {
                const items = order.order_items || [];
                if (items.length === 0) {
                  // 빈 주문인 경우 빈 행 하나 추가
                  acc.push(
                    <TableRow key={order.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => handleSelectRow(e, order.id)}
                          disabled={order.is_transferred}
                        />
                      </TableCell>
                      <TableCell>카페24</TableCell>
                      <TableCell>카페24 - {order.mall_id}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{order.order_id}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{order.buyer_name || '비회원'}</Typography>
                          {order.buyer_id && <Typography variant="caption" color="text.secondary">({order.buyer_id})</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(order.order_date)}</TableCell>
                      <TableCell colSpan={13} align="center" sx={{ color: 'text.secondary' }}>상품 정보가 없습니다</TableCell>
                    </TableRow>
                  );
                  return acc;
                }

                items.forEach((item, idx) => {
                  const matchedPart = item.part_id ? availableParts.find(p => p.id === item.part_id) : null;
                  const erpCode = matchedPart ? (matchedPart.barcode || matchedPart.code) : '';
                  const erpName = matchedPart ? matchedPart.name : '';
                  const needsMapping = !item.part_id && (item.custom_product_code || item.product_code);
                  
                  // 계산된 적립금/전체할인 구하기 (DB에 없을 경우를 대비해 프론트엔드에서도 계산)
                  const orderItemsSum = items.reduce((sum, it) => sum + Number(it.payment_amount || 0), 0);
                  const calculatedUsedPoints = Math.max(0, orderItemsSum + Number(order.shipping_fee || 0) - Number(order.total_amount || 0));
                  const displayUsedPoints = Number(order.used_points !== undefined && order.used_points !== null ? order.used_points : calculatedUsedPoints);

                  acc.push(
                    <TableRow key={`${order.id}-${idx}`} hover selected={selectedOrders.includes(order.id)}>
                      {idx === 0 && (
                        <TableCell padding="checkbox" rowSpan={items.length}>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => handleSelectRow(e, order.id)}
                            disabled={order.is_transferred}
                          />
                        </TableCell>
                      )}
                      {idx === 0 && <TableCell rowSpan={items.length}>카페24 - {order.mall_id}</TableCell>}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>{order.order_id}</Typography>
                            <Typography variant="caption" color="text.secondary">{formatDate(order.order_date)}</Typography>
                            <Box>
                              <Chip label={getKoStatus(order.status)} size="small" color={getBadgeColor(order.status)} variant={order.status.startsWith('N') ? 'outlined' : 'filled'} sx={{ height: 18, fontSize: '0.7rem' }} />
                            </Box>
                          </Box>
                        </TableCell>
                      )}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          <Box>
                            {(() => {
                               const bgNo = String(order.buyer_group_no || '').trim();
                               const hasSpecial = order.member_authentication === 'B';
                               const hasGroupBadge = bgNo && bgNo !== '1' && bgNo !== '12';
                               if (!hasSpecial && !hasGroupBadge) return null;
                               return (
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                                    {hasGroupBadge && <Chip size="small" label={getGroupName(bgNo)} sx={{ height: 16, fontSize: '0.65rem' }} color={bgNo === '15' ? 'warning' : 'default'}/>}
                                    {hasSpecial && <Chip size="small" label="특별관리" color="error" sx={{ height: 16, fontSize: '0.65rem' }} />}
                                  </Box>
                               );
                            })()}
                            <Typography variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {order.buyer_name || '비회원'}
                            </Typography>
                            {order.buyer_id && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">({order.buyer_id})</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {order.agency_id && agencies.find(a => a.id === order.agency_id) ? (
                                    <Chip size="small" label={agencies.find(a => a.id === order.agency_id).name} color="info" sx={{ height: 18, fontSize: '0.7rem' }} />
                                  ) : null}
                                  <Tooltip title="거래처 수동 매칭">
                                    <IconButton size="small" sx={{ padding: 0.2 }} onClick={() => handleOpenAgencyMatchModal(order)}>
                                      <PersonAddIcon fontSize="small" color="action" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2">{item.name}</Typography>
                        {item.options && <Typography variant="caption" color="text.secondary" display="block">{item.options}</Typography>}
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      {showPriceDetails && <TableCell align="right">{Number(item.price || 0).toLocaleString()}</TableCell>}
                      {showPriceDetails && <TableCell align="right">{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</TableCell>}
                      {showPriceDetails && <TableCell align="right">{Number(item.item_discount || 0).toLocaleString()}</TableCell>}
                      {showPriceDetails && <TableCell align="right">{Number(item.bundle_discount || item.discount_amount || 0).toLocaleString()}</TableCell>}
                      <TableCell align="right">{((Number(item.payment_amount === undefined ? (Number(item.price || 0) * Number(item.quantity || 1)) : item.payment_amount)) + (idx === 0 ? Number(order.shipping_fee || 0) : 0)).toLocaleString()}</TableCell>
                      {idx === 0 && <TableCell align="right" rowSpan={items.length}>{Number(order.shipping_fee || 0).toLocaleString()}</TableCell>}
                      {idx === 0 && <TableCell align="right" rowSpan={items.length}>
                        <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                          <strong>{Number(order.actual_payment_amount !== undefined && order.actual_payment_amount !== null ? order.actual_payment_amount : (order.total_amount || 0)).toLocaleString()}</strong>
                          {!order.is_transferred && (
                            <IconButton size="small" onClick={() => handleOpenAmountEditModal(order)} title="금액 직접 수정">
                              <EditIcon fontSize="small" color="action" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>}
                      <TableCell>
                        {erpCode || (needsMapping ? <Chip size="small" label="미스매칭" color="warning" /> : '-')}
                      </TableCell>
                      <TableCell>
                        {erpName ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                            {erpName}
                            <IconButton size="small" onClick={() => openMappingModal(order, item)} title="매칭 변경">
                              <SyncIcon fontSize="small" color="action" />
                            </IconButton>
                          </Box>
                        ) : (
                          needsMapping ? (
                            <Button size="small" variant="outlined" color="warning" onClick={() => openMappingModal(order, item)}>
                              수동 연결
                            </Button>
                          ) : '-'
                        )}
                      </TableCell>
                      {idx === 0 && (
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={order.shipping_message} rowSpan={items.length}>
                          {order.shipping_message || '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <FormControl size="small" fullWidth sx={{ minWidth: 100 }} error={!order.is_transferred && !(warehouseConfig[order.id] && warehouseConfig[order.id][idx])}>
                           <Select 
                              value={(warehouseConfig[order.id] && warehouseConfig[order.id][idx]) || ''}
                              onChange={e => setWarehouseConfig(prev => ({
                                ...prev,
                                [order.id]: {
                                  ...(prev[order.id] || {}),
                                  [idx]: e.target.value
                                }
                              }))}
                              displayEmpty
                              disabled={order.is_transferred}
                              sx={{ fontSize: '0.8rem', height: 28 }}
                           >
                             <MenuItem value="" disabled><em>선택안됨</em></MenuItem>
                             {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                           </Select>
                        </FormControl>
                      </TableCell>
                      {idx === 0 && (
                        <TableCell rowSpan={items.length} align="center">
                          {order.is_transferred ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                              <Chip size="small" label="완료" color="success" />
                              <Button size="small" variant="text" color="error" onClick={() => handleSingleCancelTransfer(order)} sx={{ fontSize: '0.7rem', padding: '2px 4px', minWidth: 'auto' }}>
                                반영취소
                              </Button>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Button size="small" variant="contained" color="primary" onClick={() => handleSingleSalesTransfer(order)}>판매반영</Button>
                              <Button size="small" variant="outlined" color="warning" onClick={() => handleSingleIgnoreOrder(order)}>반영무시</Button>
                            </Box>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                });
                return acc;
              }, [])
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        component="div"
        count={filteredOrders.length}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[20, 50, 100]}
        labelRowsPerPage="페이지당 행:"
      />
          </>
        )}
      </div>

      <div role="tabpanel" hidden={tabValue !== 1}>
        {tabValue === 1 && (
          <Cafe24Settings />
        )}
      </div>

      {/* 수동 매칭 모달 */}
      <Dialog open={mappingModalOpen} onClose={() => setMappingModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>수동 상품 매핑</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            카페24 상품 <b>"{mappingItem?.name}"</b> 에 해당하는 CRM 부품을 찾아 연결합니다.<br />
            (고유 코드: {mappingItem?.product_code})
          </Alert>

          <Autocomplete
            options={availableParts}
            getOptionLabel={(option) => `${option.name} (${option.barcode || option.code})`}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            value={selectedPart}
            onChange={(event, newValue) => setSelectedPart(newValue)}
            renderInput={(params) => <TextField {...params} label="CRM 부품 검색 (이름 또는 바코드)" />}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <li key={option.id || key} {...otherProps}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">바코드: {option.barcode || '없음'} | 코드: {option.code}</Typography>
                  </Box>
                </li>
              );
            }}
          />

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingModalOpen(false)}>취소</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveMapping} 
            disabled={!selectedPart || mappingSaving}
          >
            {mappingSaving ? '저장중...' : '매핑 저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 주문자 - 거래처 수동 매칭 모달 */}
      <Dialog open={agencyMatchModalOpen} onClose={() => setAgencyMatchModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>주문자 - 거래처 수동 매칭</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            카페24 주문자 <b>"{selectedOrderForAgencyMatch?.buyer_name || '비회원'}"</b> (ID: {selectedOrderForAgencyMatch?.buyer_id}) 의 정보를 CRM 거래처와 연결합니다.<br /><br />
            저장 시 이 거래처에 연동 ID가 등록되며, 이 주문자 ID의 과거 주문 내역들도 자동으로 이 거래처로 일괄 변경됩니다.
          </Alert>

          <Autocomplete
            options={agencies}
            getOptionLabel={(option) => `${option.name} ${option.business_number ? `(${option.business_number})` : ''}`}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            value={selectedAgency}
            onChange={(event, newValue) => setSelectedAgency(newValue)}
            renderInput={(params) => <TextField {...params} label="거래처 검색" />}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <li key={option.id || key} {...otherProps}>
                  <Box>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">사업자번호: {option.business_number || '없음'} | 연동ID: {option.cafe24_member_id || '미연동'}</Typography>
                  </Box>
                </li>
              );
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgencyMatchModalOpen(false)}>취소</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveAgencyMatch} 
            disabled={!selectedAgency || agencyMatchSaving}
          >
            {agencyMatchSaving ? '저장중...' : '매칭 및 일괄 업데이트'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 커스텀 Alert/Confirm Dialog */}
      <Dialog open={alertDialog.open} onClose={() => setAlertDialog({ ...alertDialog, open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{alertDialog.title}</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{alertDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialog({ ...alertDialog, open: false })} variant="contained">
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            취소
          </Button>
          <Button 
            onClick={() => {
              setConfirmDialog({ ...confirmDialog, open: false });
              if (confirmDialog.onConfirm) confirmDialog.onConfirm();
            }} 
            variant="contained" color="primary"
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* 금액 직접 수정 모달 */}
      <Dialog open={amountEditModalOpen} onClose={() => setAmountEditModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>실결제액 수정 ({amountEditOrder?.order_id})</DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              마일리지/포인트 100% 결제 또는 연동 오류로 인해 계산된 실결제액이 잘못된 경우, 여기서 강제로 수정할 수 있습니다. 수정한 결제액은 매출 통계에 즉시 반영됩니다.
            </Typography>
            <TextField 
              fullWidth 
              label="총 실결제액 (원)" 
              type="number"
              value={newAmount} 
              onChange={e => setNewAmount(e.target.value)} 
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAmountEditModalOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveAmount} disabled={amountEditSaving}>
            {amountEditSaving ? <CircularProgress size={24} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
