import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete, TextField, Tabs, Tab, Select, MenuItem, FormControl, FormControlLabel, InputLabel, Checkbox, IconButton, Tooltip, InputAdornment, TablePagination, ToggleButton, ToggleButtonGroup, TableFooter, Grid, ButtonGroup, Backdrop
} from '@mui/material';
import { Sync as SyncIcon, PersonAdd as PersonAddIcon, Search as SearchIcon, Edit as EditIcon, PlaylistAdd as PlaylistAddIcon, Close as CloseIcon, FileDownload as FileDownloadIcon, CallSplit as CallSplitIcon } from '@mui/icons-material';
import Cafe24Settings from '../../components/Settings/Cafe24Settings';
import { supabase } from '../../lib/supabaseClient';
import { getCafe24Malls, syncCafe24Orders, addCafe24ProductMapping, getCafe24ProductMappings, deleteCafe24ProductMapping,  transferCafe24Orders, cancelSalesTransfer, returnCafe24Inventory } from '../../utils/cafe24Api';
import { agencyApi } from '../../api/agencyApi';
import { warehouseApi } from '../../api/warehouseApi';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_KO = {
  'N00': '입금전', 'N10': '상품준비중', 'N20': '배송준비중', 'N21': '배송대기',
  'N22': '배송보류', 'N30': '배송중', 'N40': '배송완료', 'N50': '구매확정',
  // 취소 (C)
  'C00': '취소신청', 'C10': '취소 접수 - 관리자', 'C34': '취소처리중 - 환불전', 'C36': '취소처리중 - 환불보류',
  'C40': '취소 완료', 'C47': '입금전취소 - 구매자', 'C48': '입금전취소 - 자동취소', 'C49': '입금전취소 - 관리자',
  // 반품 (R)
  'R00': '반품신청', 'R10': '반품 접수', 'R12': '반품 보류', 'R30': '반품처리중 - 수거전',
  'R34': '반품처리중 - 환불전', 'R36': '반품처리중 - 환불보류', 'R40': '반품완료 - 환불완료',
  // 교환 (E)
  'E00': '교환신청', 'E10': '교환접수', 'E12': '교환보류', 'E20': '교환준비',
  'E30': '교환처리중 - 수거전', 'E32': '교환처리중 - 입금전', 'E34': '교환처리중 - 환불전', 'E36': '교환처리중 - 환불보류', 'E40': '교환 완료',
  // 배송 등 영문자 단일 상태 보완
  'M': '배송준비중', 'T': '배송중', 'F': '배송완료', 'W': '배송보류',
  'C': '취소 완료', 'E': '교환 완료', 'R': '반품완료', 'null': '상태없음'
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
  const { getAllowedMalls } = useAuth();
  const allowedMalls = getAllowedMalls();

  const [orders, setOrders] = useState([]);
  const [malls, setMalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
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

  const [editItemsModalOpen, setEditItemsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingItems, setEditingItems] = useState([]);
  const [addingPart, setAddingPart] = useState(null);
  const [editItemsSaving, setEditItemsSaving] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  useEffect(() => {
    setPage(0);
    setSelectedOrders([]);
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

  const [mappingListModalOpen, setMappingListModalOpen] = useState(false);
  const [mappingsList, setMappingsList] = useState([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);

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
    fetchParts();
    fetchAgencies();
    fetchWarehouses();
  }, []);

  // 날짜 범위(또는 마운트 시) 주문 목록 불러오기
  useEffect(() => {
    fetchOrders();
  }, [startDate, endDate]);

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
      // Supabase DB에서 직접 읽어서 토큰 만료 여부와 무관하게 쇼핑몰 목록 표시
      const { data, error: dbErr } = await supabase
        .from('cafe24_settings')
        .select('mall_id, client_id, access_token, token_expires_at, board_no, last_synced_at')
        .order('created_at', { ascending: true });
      
      if (dbErr) throw dbErr;
      
      const mallList = (data || []).map(m => {
        const tokenExpired = m.token_expires_at ? new Date(m.token_expires_at) < new Date() : true;
        return {
          mall_id: m.mall_id,
          client_id: m.client_id,
          connected: !!m.access_token && !tokenExpired,
          token_expired: tokenExpired,
          board_no: m.board_no,
          last_synced_at: m.last_synced_at
        };
      }).filter(m => allowedMalls.includes('all') || allowedMalls.includes(m.mall_id));
      
      setMalls(mallList);
    } catch (err) {
      console.error(err);
      setError('쇼핑몰 설정 정보를 불러오지 못했습니다.');
    }
  };

  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('id, name, barcode, code, brand, price').order('name');
    if (data) setAvailableParts(data);
  };

  const handleExportExcel = async () => {
    try {
      const { downloadExcel } = await import('../../utils/excelUtils');
      const headers = [
        { key: 'mall_id', label: '쇼핑몰명' },
        { key: 'order_id', label: '주문번호' },
        { key: 'order_date', label: '주문일자' },
        { key: 'buyer_name', label: '주문자' },
        { key: 'buyer_id', label: '주문자ID' },
        { key: 'product_name', label: '상품명(옵션)' },
        { key: 'quantity', label: '수량' },
        { key: 'total_amount', label: '결제금액' },
        { key: 'status', label: '주문상태' },
        { key: 'shipping_message', label: '배송메시지' },
        { key: 'is_transferred', label: '이관완료' },
        { key: 'is_deleted', label: '반영무시여부' }
      ];

      const excelData = [];
      baseFilteredOrders.forEach(order => {
        const items = order.order_items || [];
        if (items.length === 0) {
           excelData.push({
             ...order,
             status: getKoStatus(order.status),
             product_name: '-',
             quantity: 0,
             is_transferred: order.is_transferred ? 'O' : 'X',
             is_deleted: order.is_deleted ? 'O' : 'X'
           });
        } else {
           items.forEach(item => {
             excelData.push({
               ...order,
               status: getKoStatus(order.status),
               product_name: `${item.name || ''} ${item.option_value || ''}`.trim(),
               quantity: item.quantity || 1,
               is_transferred: order.is_transferred ? 'O' : 'X',
               is_deleted: order.is_deleted ? 'O' : 'X'
             });
           });
        }
      });
      await downloadExcel(excelData, headers, `온라인주문내역_${getFormattedDate(new Date())}`);
    } catch (err) {
      console.error(err);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      // startDate~endDate 기간 내의 주문만을 불러옵니다 (요청에 따라 날짜 엄격하게 필터링 적용)
      const { data, error: dbErr } = await supabase
        .from('cafe24_orders')
        .select('*')
        .gte('order_date', `${startDate}T00:00:00+09:00`)
        .lte('order_date', `${endDate}T23:59:59+09:00`)
        .order('order_date', { ascending: false })
        .limit(3000);

      if (dbErr) throw dbErr;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      setError('주문 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // DB에 갓 불러온 orders 데이터의 is_transferred 가 true인 경우,
  // order_items 내부에 있는 _warehouse_id 를 읽어서 warehouseConfig에 세팅해줍니다.
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    
    setWarehouseConfig(prev => {
      const newConfig = { ...prev };
      let changed = false;

      // "청담"이나 "본점", "기본" 단어가 포함된 창고를 DEFAULT 매핑용으로 탐색
      const defaultWh = warehouses.find(w => w.name.includes('청담') || w.name.includes('본점') || w.name.includes('NEARBIKE'));

      orders.forEach(o => {
        if (o.is_transferred && o.order_items) {
          o.order_items.forEach((item, idx) => {
            if (item._warehouse_id) {
              if (!newConfig[o.id]) newConfig[o.id] = {};
              
              let wid = item._warehouse_id;
              if (wid === 'DEFAULT' && defaultWh) wid = defaultWh.id;
              else if (wid === 'DEFAULT') wid = '';

              if (newConfig[o.id][idx] !== wid) {
                newConfig[o.id][idx] = wid;
                changed = true;
              }
            }
          });
        }
      });
      return changed ? newConfig : prev;
    });
  }, [orders, warehouses]);

  const handleSync = async () => {
    if (malls.length === 0) {
      alert('등록된 카페24 쇼핑몰이 없습니다. 설정 메뉴에서 쇼핑몰을 등록해주세요.');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const syncMalls = selectedMall === 'all' 
        ? malls 
        : malls.filter(m => m.mall_id === selectedMall);

      const results = [];
      for (const m of syncMalls) {
        try {
          await syncCafe24Orders(m.mall_id, startDate, endDate);
          results.push({ mall_id: m.mall_id, success: true });
        } catch (err) {
          console.error(`[${m.mall_id}] 동기화 오류:`, err.message);
          results.push({ mall_id: m.mall_id, success: false, error: err.message });
        }
      }

      await fetchOrders();

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        const failMsgs = failures.map(f => `[${f.mall_id}] ${f.error}`).join('\n');
        setError(`일부 쇼핑몰 동기화 실패:\n${failMsgs}\n\n토큰이 만료된 경우 연동관리에서 재인증해주세요.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const baseFilteredOrders = orders.filter(order => {
    if (!allowedMalls.includes('all') && !allowedMalls.includes(order.mall_id)) return false;
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

  // 주문 전체가 반품/취소/교환인지 판별
  // - 주문 메인 status가 C/R/E이면 무조건 반품/취소
  // - is_transferred된 주문에서 일부 아이템만 교환/취소된 경우는 반품 건으로 보지 않음 (반영 완료로 유지)
  // - 미반영 주문에서 아이템 일부라도 C/R/E이면 반품/취소교환으로 분류
  const isOrderReturned = (order) => {
    const s = String(order.status).trim();
    // 1. 주문 메인 상태 자체가 취소/반품/교환이면 무조건 반품건
    if (s.startsWith('C') || s.startsWith('R') || s.startsWith('E')) return true;
    
    // 2. 이미 반영 완료된 주문은 일부 아이템 교환/취소가 있어도 "반영 완료"로 유지
    if (order.is_transferred) return false;
    
    // 3. 미반영 주문: 아이템 중 하나라도 취소/반품/교환 상태면 반품건으로 분류
    if (order.order_items && order.order_items.some(item => {
      const itemStatus = String(item.order_status).trim();
      return itemStatus.startsWith('C') || itemStatus.startsWith('R') || itemStatus.startsWith('E');
    })) return true;
    return false;
  };

  const transferCounts = {
    all: baseFilteredOrders.filter(o => !o.is_deleted).length,
    not_transferred: baseFilteredOrders.filter(o => !o.is_transferred && !o.is_deleted && !isOrderReturned(o)).length,
    transferred: baseFilteredOrders.filter(o => o.is_transferred && !o.is_deleted && !isOrderReturned(o)).length,
    returned: baseFilteredOrders.filter(o => !o.is_deleted && isOrderReturned(o)).length,
    ignored: baseFilteredOrders.filter(o => o.is_deleted).length,
  };

  const filteredOrders = baseFilteredOrders.filter(order => {
    if (transferFilter === 'ignored') {
      return order.is_deleted === true || (order.order_items && order.order_items.some(item => item._warehouse_id === 'EXCLUDE'));
    }
    // For all other filters, hide ignored
    if (order.is_deleted) return false;
    
    if (transferFilter === 'returned') return isOrderReturned(order);
    if (isOrderReturned(order) && transferFilter !== 'all') return false;
    
    if (transferFilter === 'transferred' && !order.is_transferred) return false;
    if (transferFilter === 'not_transferred' && order.is_transferred) return false;
    return true;
  });

  const visibleOrders = filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const visibleSelectableIds = visibleOrders.map(n => n.id);

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = [...new Set([...selectedOrders, ...visibleSelectableIds])];
      setSelectedOrders(newSelecteds);
    } else {
      const newSelecteds = selectedOrders.filter(id => !visibleSelectableIds.includes(id));
      setSelectedOrders(newSelecteds);
    }
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

    // 전송 완료 건이 포함되어 있으면 차단 (재고/매출 미정리 방지)
    const transferredInSelection = orders.filter(o => selectedOrders.includes(o.id) && o.is_transferred);
    if (transferredInSelection.length > 0) {
      setAlertDialog({ open: true, title: '삭제 불가', message: `선택한 주문 중 ${transferredInSelection.length}건이 이미 판매 반영(전송 완료) 상태입니다.\n전송 완료 건은 먼저 [판매반영 취소]를 진행한 후 삭제해주세요.` });
      return;
    }

    if (!window.confirm(`선택한 ${selectedOrders.length}건의 주문을 목록에서 삭제하시겠습니까? (삭제 후 '주문 동기화' 클릭 시 카페24에서 다시 수집됩니다)`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('cafe24_orders')
        .delete()
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
    const ordersToTransfer = orders.filter(o => selectedOrders.includes(o.id) && !o.is_transferred && !o.is_deleted && String(o.status).trim() !== 'N00');
    
    if (ordersToTransfer.length === 0) {
      setAlertDialog({ open: true, title: '알림', message: '선택한 주문 중 판매 전송 가능한 건이 없습니다. (이미 전송 완료된 건 또는 입금전 건 제외)' });
      return;
    }

    let missingWarehouse = false;
    for (const order of ordersToTransfer) {
      const items = order.order_items || [];
      for (let i = 0; i < items.length; i++) {
        const val = warehouseConfig[order.id] && warehouseConfig[order.id][i];
        if (!val) {
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
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
        if (isCancelled) continue;
        if (!item.part_id && (item.custom_product_code || item.product_code)) {
          hasUnmappedItems = true;
          break;
        }
      }
      if (hasUnmappedItems) break;
    }

    let transferMessage = `${ordersToTransfer.length}건의 주문을 분할 전송(매출/출고 등록 및 재고 차감)하시겠습니까?`;
    if (hasUnmappedItems) {
      transferMessage = `⚠️ 주의: 품목코드가 미스매칭(수동 연결 필요)인 항목이 포함되어 있습니다.\n\n해당 품목들(예: 개인결제건, 배송비 등)은 재고 차감 및 매출 기록에서 [자동 제외(스킵)]됩니다.\n\n그래도 계속 전송하시겠습니까?`;
    }

    setConfirmDialog({
      open: true,
      title: hasUnmappedItems ? '판매 반영(전송) - 매핑 누락 포함' : '판매 반영(전송)',
      message: transferMessage,
      onConfirm: async () => {
        try {
          setIsTransferring(true);
          await transferCafe24Orders(ordersToTransfer.map(o => o.id), warehouseConfig);
          setAlertDialog({ open: true, title: '성공', message: '전송이 완료되었습니다.' });
          setSelectedOrders([]);
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '전송 실패', message: err.message });
        } finally {
          setIsTransferring(false);
        }
      }
    });
  };

  const handleSingleSalesTransfer = async (order) => {
    if (order.is_transferred) return;
    const items = order.order_items || [];
    let missingWarehouse = false;
    for (let i = 0; i < items.length; i++) {
      const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(items[i].order_status);
      if (isCancelled) continue;
      const val = warehouseConfig[order.id] && warehouseConfig[order.id][i];
      if (!val) {
        missingWarehouse = true;
        break;
      }
    }
    if (missingWarehouse) {
      setAlertDialog({ open: true, title: '주의', message: '🔴 창고(출고처)가 지정되지 않은 항목이 있습니다.\n해당 주문의 품목에 있는 [출고창고]를 모두 지정해주세요.' });
      return;
    }

    const hasUnmappedItem = items.some(item => {
      const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
      if (isCancelled) return false;
      return !item.part_id && (item.custom_product_code || item.product_code);
    });
    let transferMessage = `주문(Cafe24 ID: ${order.order_id})을 전송(매출/출고 등록 및 재고 차감)하시겠습니까?`;
    if (hasUnmappedItem) {
      transferMessage = `⚠️ 주의: 품목코드가 미스매칭(수동 연결 필요)인 항목이 포함되어 있습니다.\n\n해당 품목(예: 개인결제건, 배송비 등)은 재고 차감 및 매출 기록에서 [자동 제외(스킵)]됩니다.\n\n그래도 계속 전송하시겠습니까?`;
    }
    
    setConfirmDialog({
      open: true,
      title: hasUnmappedItem ? '개별 판매 전송 - 매핑 누락 포함' : '개별 판매 전송',
      message: transferMessage,
      onConfirm: async () => {
        try {
          setIsTransferring(true);
          await transferCafe24Orders([order.id], warehouseConfig);
          setAlertDialog({ open: true, title: '성공', message: '전송이 완료되었습니다.' });
          fetchOrders();
        } catch (err) {
          console.error(err);
          setAlertDialog({ open: true, title: '전송 실패', message: err.message });
        } finally {
          setIsTransferring(false);
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
      message: `선택한 ${ordersToIgnore.length}건을 매출 및 재고 변동 없이 [전송 완료] 처리하여 리스트에서 넘기시겠습니까? \n(실제 재고는 차감되지 않습니다.)`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from('cafe24_orders')
            .update({ is_deleted: true, is_transferred: false }) // '반영 무시' 탭으로 명확히 이동
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
  const handleUnignoreOrders = async () => {
    if (!selectedOrders.length) return;
    const ordersToUnignore = orders.filter(o => selectedOrders.includes(o.id) && o.is_deleted);
    
    if (ordersToUnignore.length === 0) {
      setAlertDialog({ open: true, title: '알림', message: '선택한 주문 중 복구할 반영 무시 건이 없습니다.' });
      return;
    }

    setConfirmDialog({
      open: true,
      title: '반영 무시 복구',
      message: `선택한 ${ordersToUnignore.length}건의 반영 무시 상태를 해제하고 다시 미전송 상태로 복구하시겠습니까?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from('cafe24_orders')
            .update({ is_deleted: false, is_transferred: false })
            .in('id', ordersToUnignore.map(o => o.id));
          if (error) throw error;
          
          setAlertDialog({ open: true, title: '처리 완료', message: '선택 항목이 반영 무시 해제(복구) 처리되었습니다.' });
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

  const handleSingleUnignoreOrder = async (order) => {
    setConfirmDialog({
      open: true,
      title: '반영 무시 해제(복구)',
      message: `주문(Cafe24 ID: ${order.order_id})의 반영 무시 상태를 해제하고 다시 미전송 상태로 복구하시겠습니까?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from('cafe24_orders')
            .update({ is_deleted: false, is_transferred: false })
            .eq('id', order.id);
          if (error) throw error;
          
          setAlertDialog({ open: true, title: '처리 완료', message: '반영 무시가 해제되었습니다.' });
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
      message: `주문(Cafe24 ID: ${order.order_id})을 매출 및 재고 변동 없이 [전송 완료] 처리하여 리스트에서 넘기시겠습니까? \n(실제 재고는 차감되지 않습니다.)`,
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from('cafe24_orders')
            .update({ is_deleted: true, is_transferred: false })
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
      message: `선택한 ${ordersToCancel.length}건의 주문에 대해 판매 반영 및 모든 입출고 내역/통계를 취소하시겠습니까?\n(청담 창고에서 이미 검수 완료된 건은 자동 제외됩니다.)`,
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
      message: `주문(Cafe24 ID: ${order.order_id})의 판매 반영 내역(입출고 등)을 취소하고 미전송 상태로 되돌리시겠습니까?\n(청담 창고에서 이미 검수 완료된 건은 초기화할 수 없습니다.)`,
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

  const handleSmartResolve = async (order) => {
    // 교환건인지 확인
    const isExchange = String(order.status).trim().startsWith('E') || 
                       (order.order_items && order.order_items.some(i => String(i.order_status).trim().startsWith('E')));

    if (isExchange) {
      setConfirmDialog({
        open: true,
        title: '스마트 교환 처리',
        message: '기존 전송 내역을 취소(재고 원복)하고, 최신 교환 품목 데이터를 불러온 뒤, 원래 지정했던 창고로 자동 판매반영(재고 차감)을 다시 진행하시겠습니까?',
        onConfirm: async () => {
          setLoading(true);
          try {
            // 1. Get previous warehouse configuration
            let prevWarehouse = (warehouses.find(w => w.name.includes('청담')) || warehouses[0])?.id || '';
            if (order.order_items) {
              const prevItem = order.order_items.find(i => i._warehouse_id && i._warehouse_id !== 'EXCLUDE');
              if (prevItem) prevWarehouse = prevItem._warehouse_id;
            }

            // 2. Rollback Transfer if it was transferred
            if (order.is_transferred) {
              const { data } = await supabase.from('pending_outbounds').select('status').eq('order_no', order.order_id).maybeSingle();
              if (data && data.status === '완료') {
                await returnCafe24Inventory([order.id]);
              } else {
                await cancelSalesTransfer([order.id]);
              }
              await supabase.from('cafe24_orders').update({ is_transferred: false }).eq('id', order.id);
            }

            // 3. Sync from Cafe24 (for the order's date)
            const orderDateStr = order.order_date.split('T')[0];
            await syncCafe24Orders(order.mall_id, orderDateStr, orderDateStr);

            // 4. Fetch the updated order items
            const { data: updatedOrder, error: fetchErr } = await supabase.from('cafe24_orders').select('*').eq('id', order.id).single();
            if (fetchErr) throw fetchErr;

            // 5. Build new warehouse config
            const tempConfig = { [updatedOrder.id]: {} };
            if (updatedOrder.order_items) {
              updatedOrder.order_items.forEach((item, idx) => {
                if (!['C11', 'C40', 'R40', 'E40'].includes(item.order_status)) {
                  tempConfig[updatedOrder.id][idx] = prevWarehouse;
                }
              });
            }

            // 6. Transfer sales
            await transferCafe24Orders([updatedOrder.id], tempConfig);

            setAlertDialog({ open: true, title: '스마트 교환 완료', message: '교환건의 재고 복구, 새 품목 동기화, 및 새 품목의 판매반영(재고 차감)이 자동으로 완료되었습니다.' });
            
            setWarehouseConfig(prev => ({
              ...prev,
              ...tempConfig
            }));
            
            fetchOrders();
          } catch(err) {
            setAlertDialog({ open: true, title: '교환 자동 처리 실패', message: err.message });
          } finally {
            setLoading(false);
          }
        }
      });
      return;
    }

    // 1. 미전송 상태인 경우 무시 처리
    if (!order.is_transferred) {
      setConfirmDialog({
        open: true,
        title: '반영 예외(무시) 자동 처리',
        message: '아직 장부에 전송되지 않은 주문입니다. 장부 반영 없이 "반영 완료(조치 완료)" 상태로 무시 처리하시겠습니까?',
        onConfirm: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.from('cafe24_orders').update({ is_deleted: true, is_transferred: false }).eq('id', order.id);
            if (error) throw error;
            setAlertDialog({ open: true, title: '처리 완료', message: '무시 처리가 완료되었습니다.' });
            fetchOrders();
          } catch(err) {
            setAlertDialog({ open: true, title: '처리 실패', message: err.message });
          } finally {
            setLoading(false);
          }
        }
      });
      return;
    }

    // 2. 이미 전송된 주문의 경우, 출고 확정(검수 완료) 여부를 1차 판단
    setLoading(true);
    let poHeader = null;
    try {
      const { data } = await supabase.from('pending_outbounds').select('status').eq('order_no', order.order_id).maybeSingle();
      poHeader = data;
    } catch(err) {
      console.error(err);
    }
    setLoading(false);

    if (poHeader && poHeader.status === '완료') {
      // 경우 3: 이미 출고된 상태 -> 재고 환입 부분 입고 권장
      setConfirmDialog({
        open: true,
        title: '재고 환입 (반품 원상복구) 및 무시 처리',
        message: '이미 포장/출고 검수가 완료된 물품이라 일반적인 전송 취소가 불가능합니다.\n반품된 부품 수량만큼을 원래 창고에 [재고 플러스(+)] 하도록 재입고 처리 시키고, 리스트에서 바로 무시(제외) 처리하시겠습니까?',
        onConfirm: async () => {
          setLoading(true);
          try {
            const res = await returnCafe24Inventory([order.id]);
            await supabase.from('cafe24_orders').update({ is_deleted: true, is_transferred: false }).eq('id', order.id);
            setAlertDialog({ open: true, title: '환입 및 무시 완료', message: res.message || '환입 및 리스트 무시 처리가 성공적으로 완료되었습니다.' });
            fetchOrders();
          } catch(err) {
            setAlertDialog({ open: true, title: '환입 실패', message: err.message });
          } finally {
            setLoading(false);
          }
        }
      });
    } else {
      // 경우 2: 아직 출고 전이라면 롤백
      setConfirmDialog({
        open: true,
        title: '판매 반영 취소(전체 롤백) 및 무시 처리',
        message: '장부에 반영되었으나 아직 출고 검수는 안 되었습니다. 출고 및 매출 내역을 완전히 취소(롤백)하고, 즉시 리스트에서 무시(제외) 처리하시겠습니까?',
        onConfirm: async () => {
          setLoading(true);
          try {
            await cancelSalesTransfer([order.id]);
            await supabase.from('cafe24_orders').update({ is_deleted: true, is_transferred: false }).eq('id', order.id);
            setAlertDialog({ open: true, title: '롤백 및 무시 완료', message: '반영 취소, 롤백 및 무시 처리가 한 번에 깔끔하게 완료되었습니다!' });
            fetchOrders();
          } catch(err) {
            setAlertDialog({ open: true, title: '취소 실패', message: err.message });
          } finally {
            setLoading(false);
          }
        }
      });
    }
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
      
      // 즉시 로컬 상태의 order_items 업데이트 (서버에서는 이미 처리됨)
      setOrders(prevOrders => prevOrders.map(order => {
        if (!order.order_items) return order;
        let modified = false;
        const newItems = order.order_items.map(item => {
           const code = item.custom_product_code || item.variant_code || item.product_code || item.raw_custom_variant || item.raw_custom_product;
           if (String(code).trim() === String(mappingItem.product_code).trim()) {
             modified = true;
             return { ...item, part_id: selectedPart.id };
           }
           return item;
        });
        if (modified) return { ...order, order_items: newItems };
        return order;
      }));

      alert('수동 매핑이 저장되어 해당 상품 코드의 누락된 매칭이 즉시 반영되었습니다.');
      setMappingModalOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setMappingSaving(false);
    }
  };

  const loadMappingsList = async () => {
    setMappingsLoading(true);
    try {
      const data = await getCafe24ProductMappings();
      const enrichedData = (data || []).map(m => {
        let foundName = '';
        for (const o of orders) {
          if (!o.order_items) continue;
          const matchedItem = o.order_items.find(i => 
            i.custom_product_code === m.cafe24_product_code || 
            i.variant_code === m.cafe24_product_code || 
            i.product_code === m.cafe24_product_code ||
            i.raw_custom_variant_code === m.cafe24_product_code ||
            i.raw_custom_product_code === m.cafe24_product_code
          );
          if (matchedItem) {
            foundName = matchedItem.name;
            break;
          }
        }
        return { ...m, dynamic_product_name: foundName };
      });
      setMappingsList(enrichedData);
    } catch (e) {
      alert(e.message);
    } finally {
      setMappingsLoading(false);
    }
  };

  const handleOpenMappingList = () => {
    setMappingListModalOpen(true);
    loadMappingsList();
  };

  const handleDeleteMapping = async (mapping) => {
    if (!window.confirm(`이 상품의 매핑을 삭제하시겠습니까?\n(${mapping.cafe24_product_code})`)) return;
    try {
      await deleteCafe24ProductMapping(mapping.mall_id, mapping.cafe24_product_code);
      setMappingsList(prev => prev.filter(m => m.cafe24_product_code !== mapping.cafe24_product_code));
    } catch (e) {
      alert(e.message);
    }
  };

  const [updateAllOrdersOfBuyer, setUpdateAllOrdersOfBuyer] = useState(false);

  const handleOpenAgencyMatchModal = (order) => {
    setSelectedOrderForAgencyMatch(order);
    const existing = order.agency_id ? agencies.find(a => a.id === order.agency_id) : null;
    setSelectedAgency(existing || null);
    setUpdateAllOrdersOfBuyer(false);
    setAgencyMatchModalOpen(true);
  };

  const handleSaveAgencyMatch = async () => {
    if (!selectedOrderForAgencyMatch || !selectedAgency) return;
    setAgencyMatchSaving(true);
    try {
      if (updateAllOrdersOfBuyer) {
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
        const { data: updatedOrders, error: updateErr } = await supabase
          .from('cafe24_orders')
          .update({ agency_id: selectedAgency.id })
          .eq('buyer_id', selectedOrderForAgencyMatch.buyer_id)
          .select('order_id');
          
        if (updateErr) throw updateErr;

        // 3. 이미 전송된 주문의 트랜잭션 기록도 함께 업데이트
        if (updatedOrders && updatedOrders.length > 0) {
          for (const order of updatedOrders) {
            try {
              const { error: txErr } = await supabase.from('transactions')
                .update({ to_location: `대리점:${selectedAgency.name}` })
                .like('note', `%주문: ${order.order_id}%`);
              if (txErr) console.error(`Failed to update transaction for order ${order.order_id}:`, txErr);
            } catch (err) {
              console.error(`Exception updating transaction for order ${order.order_id}:`, err);
            }
          }
        }

        alert('거래처 매칭이 완료되었으며, 이 주문자의 기존 주문(판매 기록 포함)들도 모두 업데이트되었습니다.');
      } else {
        // 단일 주문의 판매처만 강제 업데이트
        const { error: updateErr } = await supabase
          .from('cafe24_orders')
          .update({ agency_id: selectedAgency.id })
          .eq('id', selectedOrderForAgencyMatch.id);
          
        if (updateErr) throw updateErr;

        // 이미 전송된 단일 주문의 트랜잭션 기록 업데이트
        await supabase.from('transactions')
          .update({ to_location: `대리점:${selectedAgency.name}` })
          .like('note', `%주문: ${selectedOrderForAgencyMatch.order_id}%`);

        alert('선택한 주문의 결제/출고용 거래처(판매 기록 포함)가 성공적으로 변경되었습니다.');
      }
      
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
    const currentVal = order.total_amount || 0;
    setNewAmount(currentVal);
    setAmountEditModalOpen(true);
  };

  const handleSaveAmount = async () => {
    if (!amountEditOrder) return;
    setAmountEditSaving(true);
    try {
      const { error } = await supabase.from('cafe24_orders')
        .update({ total_amount: Number(newAmount) })
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

  const handleOpenEditItemsModal = (order) => {
    setEditingOrder(order);
    setEditingItems(JSON.parse(JSON.stringify(order.order_items || [])));
    setAddingPart(null);
    setEditItemsModalOpen(true);
  };

  const handleRemoveEditingItem = (index) => {
    setEditingItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSplitEditingItem = (index) => {
    setEditingItems(prev => {
      const updated = [...prev];
      const targetItem = updated[index];
      const origQty = Number(targetItem.quantity || 1);
      
      if (origQty <= 1) {
        alert('수량이 1개 이하인 품목은 분할할 수 없습니다.');
        return updated;
      }
      
      const origPaymentAmt = Number(targetItem.payment_amount || 0);
      
      const newItemQty = 1;
      const remainingQty = origQty - 1;
      
      const remainingPaymentAmt = Math.floor((origPaymentAmt * remainingQty) / origQty);
      const newPaymentAmt = origPaymentAmt - remainingPaymentAmt;
      
      targetItem.quantity = remainingQty;
      targetItem.payment_amount = remainingPaymentAmt;
      
      const splitItem = { ...targetItem, quantity: newItemQty, payment_amount: newPaymentAmt };
      
      updated.splice(index + 1, 0, splitItem);
      return updated;
    });
  };

  const handleAddEditingPart = () => {
    if (!addingPart) return;
    const newItem = {
      product_code: addingPart.code,
      custom_product_code: addingPart.barcode || addingPart.code,
      name: addingPart.name,
      product_name: addingPart.name,
      quantity: 1,
      price: addingPart.price || 0,
      product_price: addingPart.price || 0,
      payment_amount: addingPart.price || 0,
      part_id: addingPart.id,
      is_manual_added: true
    };
    setEditingItems(prev => [...prev, newItem]);
    setAddingPart(null);
  };

  const handleEditingItemChange = (index, field, value) => {
    const updated = [...editingItems];
    updated[index][field] = value;
    
    // 수량이나 단가를 수정한 경우, 라인 총 결제액(payment_amount)을 자동 재계산
    if (field === 'quantity' || field === 'product_price') {
      const qty = Number(updated[index].quantity || 1);
      const uPrice = Number(updated[index].product_price || 0);
      updated[index].payment_amount = qty * uPrice;
    }
    
    setEditingItems(updated);
  };

  const handleSaveEditedItems = async () => {
    if (!editingOrder) return;
    setEditItemsSaving(true);
    try {
      const sanitizedItems = editingItems.map(item => ({
        ...item,
        quantity: Number(item.quantity || 1),
        payment_amount: Number(item.payment_amount || 0),
        is_edited_in_crm: true
      }));

      const { error } = await supabase.from('cafe24_orders')
        .update({ order_items: sanitizedItems })
        .eq('id', editingOrder.id);
        
      if (error) throw error;
      
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === editingOrder.id) {
          return { ...order, order_items: sanitizedItems };
        }
        return order;
      }));
      
      setEditItemsModalOpen(false);
    } catch (err) {
      alert('품목 저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setEditItemsSaving(false);
    }
  };

  const renderActionBar = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
      <Typography variant="body2" sx={{ mr: 2, fontWeight: 'bold', color: '#1565c0' }}>
        총 {filteredOrders.length}건 검색됨 {selectedOrders.length > 0 && `(현재 ${selectedOrders.length}건 선택됨)`}
      </Typography>
      
      {selectedOrders.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ml: 'auto', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140, bgcolor: 'white' }}>
            <InputLabel>선택 일괄 창고지정</InputLabel>
            <Select 
              value={batchWarehouse} 
              onChange={e => setBatchWarehouse(e.target.value)}
              label="선택 일괄 창고지정"
            >
              <MenuItem value=""><em>미선택</em></MenuItem>
              <MenuItem value="EXCLUDE" sx={{ color: 'error.main' }}>🚫 전송 제외</MenuItem>
              {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button size="small" variant="contained" color="secondary" onClick={handleBatchApplyWarehouse} sx={{ height: 40, px: 2, whiteSpace: 'nowrap' }}>
            일괄적용
          </Button>
          <Box sx={{ width: '1px', height: 30, bgcolor: 'divider', mx: 1 }} />
          <Button size="small" variant="outlined" color="error" onClick={handleDeleteSelected} sx={{ height: 40, px: 2, whiteSpace: 'nowrap' }}>
            삭제
          </Button>
          <Button size="small" variant="contained" color="error" onClick={handleCancelTransfer} sx={{ height: 40, lineHeight: 1.2, px: 2, textAlign: 'center' }}>
            판매반영<br/>취소
          </Button>
          <Button size="small" variant="outlined" color="warning" onClick={handleIgnoreOrders} sx={{ height: 40, lineHeight: 1.2, px: 2, textAlign: 'center' }}>
            판매반영<br/>예외(무시)
          </Button>
          <Button size="small" variant="outlined" color="info" onClick={handleUnignoreOrders} sx={{ height: 40, lineHeight: 1.2, px: 2, textAlign: 'center' }}>
            무시<br/>복구
          </Button>
          <Button size="small" variant="contained" color="primary" onClick={handleSalesTransfer} sx={{ height: 40, lineHeight: 1.2, px: 2, textAlign: 'center' }}>
            판매반영<br/>(전송)
          </Button>
        </Box>
      ) : (
        <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
          주문을 체크하면 '판매 반영(매출 연동)' 및 삭제 메뉴가 활성화됩니다.
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>온라인 주문관리</Typography>

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
              <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  
                  {/* Row 1: 상태 & 토글 필터 */}
                  <Grid item xs={12} md="auto">
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <ToggleButtonGroup
                        color="primary"
                        value={transferFilter}
                        exclusive
                        onChange={(e, val) => { if (val) setTransferFilter(val); }}
                        size="small"
                        sx={{ bgcolor: 'white' }}
                      >
                        <ToggleButton value="all" sx={{ px: 2 }}>
                          전체 내역 <Chip label={transferCounts.all} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'all' ? "primary" : "default"} />
                        </ToggleButton>
                        <ToggleButton value="not_transferred" sx={{ px: 2 }}>
                          반영 전 <Chip label={transferCounts.not_transferred} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'not_transferred' ? "warning" : "default"} />
                        </ToggleButton>
                        <ToggleButton value="transferred" sx={{ px: 2 }}>
                          반영 완료 <Chip label={transferCounts.transferred} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'transferred' ? "success" : "default"} />
                        </ToggleButton>
                        <ToggleButton value="returned" sx={{ px: 2 }}>
                          반품/취소교환 <Chip label={transferCounts.returned} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'returned' ? "secondary" : "default"} />
                        </ToggleButton>
                        <ToggleButton value="ignored" sx={{ px: 2 }}>
                          반영 무시 <Chip label={transferCounts.ignored} size="small" sx={{ ml: 1, height: 20, fontSize: '0.75rem' }} color={transferFilter === 'ignored' ? "error" : "default"} />
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
                        sx={{ bgcolor: 'white' }}
                      >
                        <ToggleButton value="all" sx={{ px: 2 }}>전체 등급</ToggleButton>
                        <ToggleButton value="normal" sx={{ px: 2 }}>일반회원</ToggleButton>
                        <ToggleButton value="special" sx={{ px: 2 }}>특별관리(B)</ToggleButton>
                        <ToggleButton value="xrider" sx={{ px: 2 }}>엑스라이더</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                  </Grid>

                  {/* Row 2: 날짜 필터 & 퀵버튼 */}
                  <Grid item xs={12} md>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '6px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#e0e0e0', borderRadius: '4px' } }}>
                      <ButtonGroup size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                        <Button onClick={() => setPeriod(0)}>금일</Button>
                        <Button onClick={setYesterday}>전일</Button>
                        <Button onClick={() => setPeriod(7)}>일주일</Button>
                        <Button onClick={() => setPeriod(30)}>1개월</Button>
                      </ButtonGroup>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField type="date" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} sx={{ width: 140, bgcolor: 'white' }} />
                        <Typography variant="body2">~</Typography>
                        <TextField type="date" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} sx={{ width: 140, bgcolor: 'white' }} />
                      </Box>
                    </Stack>
                  </Grid>

                  {/* Row 3: 검색명 입력 & 버튼 그룹 */}
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <TextField
                        size="small"
                        label="통합 검색 (주문번호, 이름, 상품명 등)"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                        }}
                        sx={{ flexGrow: 1, maxWidth: 500, bgcolor: 'white' }}
                      />
                      <Button variant="contained" onClick={() => fetchOrders()} sx={{ bgcolor: '#3182f6' }}>검색</Button>
                      <Button variant="outlined" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTransferFilter('all'); setBadgeFilter('all'); setPeriod(0); }}>초기화</Button>
                      
                      <Box sx={{ flexGrow: 1 }} />
                      
                      <ToggleButton
                        value="check"
                        selected={showPriceDetails}
                        onChange={() => setShowPriceDetails(!showPriceDetails)}
                        color="secondary"
                        size="small"
                        sx={{ bgcolor: 'white', px: 2, whiteSpace: 'nowrap' }}
                      >
                        금액 상세 {showPriceDetails ? '접기' : '펼침'}
                      </ToggleButton>
                      <Button 
                        variant="outlined" 
                        color="success"
                        startIcon={<FileDownloadIcon />} 
                        onClick={handleExportExcel}
                        disabled={baseFilteredOrders.length === 0}
                        sx={{ bgcolor: 'white' }}
                      >
                        엑셀 다운로드
                      </Button>
                      <Button 
                        variant="outlined" 
                        color="secondary"
                        startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />} 
                        onClick={handleSync}
                        disabled={syncing}
                        sx={{ bgcolor: 'white' }}
                      >
                        {syncing ? '수집 중...' : (selectedMall === 'all' ? '전체 쇼핑몰 수집' : '선택된 쇼핑몰 주문 수집')}
                      </Button>
                      <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={handleOpenMappingList}
                        sx={{ bgcolor: 'white' }}
                      >
                        수동 매핑 관리
                      </Button>
                    </Stack>
                  </Grid>
                  
                </Grid>
              </Paper>

              {/* 두 번째 줄: 실행 액션 관리들 (위쪽) */}
              {renderActionBar()}
            </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ 
          minWidth: '100%', 
          border: '1px solid rgba(224, 224, 224, 1)',
          '& th, & td': { 
            border: '1px solid rgba(224, 224, 224, 1)',
            whiteSpace: 'normal',
            wordBreak: 'break-word'
          },
          '& .MuiTableCell-root': {
            fontSize: '0.82rem',
            padding: '4px 6px',
            lineHeight: 1.3
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
                  indeterminate={
                    visibleSelectableIds.length > 0 && 
                    visibleSelectableIds.some(id => selectedOrders.includes(id)) && 
                    !visibleSelectableIds.every(id => selectedOrders.includes(id))
                  }
                  checked={
                    visibleSelectableIds.length > 0 && 
                    visibleSelectableIds.every(id => selectedOrders.includes(id))
                  }
                  onChange={handleSelectAllClick}
                />
              </TableCell>
              <TableCell><strong>쇼핑몰명</strong></TableCell>
              <TableCell><strong>주문번호(일시/상태)</strong></TableCell>
              <TableCell><strong>주문자(ID)</strong></TableCell>
              <TableCell><strong>쇼핑몰상품명(옵션)</strong></TableCell>
              <TableCell align="right"><strong>수량</strong></TableCell>
              {showPriceDetails && <TableCell align="right"><strong>판매가</strong></TableCell>}
              {showPriceDetails && <TableCell align="right"><strong>배송비</strong></TableCell>}
              {showPriceDetails && <TableCell align="right"><strong>등급할인</strong></TableCell>}
              {showPriceDetails && <TableCell align="right"><strong>실결제액</strong></TableCell>}
              <TableCell align="right"><strong>적립금</strong></TableCell>
              <TableCell align="right"><strong>총결제액</strong></TableCell>
              <TableCell><strong>품목코드(ERP)</strong></TableCell>
              <TableCell><strong>품목명(ERP)</strong></TableCell>
              <TableCell><strong>출고창고(필수)</strong></TableCell>
              <TableCell><strong>판매전송</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={showPriceDetails ? 15 : 11} align="center" sx={{ py: 3 }}><CircularProgress /></TableCell></TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow><TableCell colSpan={showPriceDetails ? 15 : 11} align="center" sx={{ py: 3 }}>수집·필터 조건에 맞는 주문 데이터가 없습니다.</TableCell></TableRow>
            ) : (
             visibleOrders.reduce((acc, order) => {
                const items = order.order_items || [];
                if (items.length === 0) {
                  // 빈 주문인 경우 빈 행 하나 추가
                  acc.push(
                    <TableRow key={order.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => handleSelectRow(e, order.id)}
                        />
                      </TableCell>
                      <TableCell>카페24</TableCell>
                      <TableCell>카페24 - {order.mall_id}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {String(order.order_id || '').includes('_') ? String(order.order_id).split('_').slice(1).join('_') : order.order_id}
                          </Typography>
                          {order.shipping_message && (
                            <Tooltip title={order.shipping_message} placement="top" arrow>
                              <Chip label="메세지" size="small" color="info" sx={{ height: 16, fontSize: '0.65rem', cursor: 'pointer' }} />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{order.buyer_name || '비회원'}</Typography>
                          {order.buyer_id && <Typography variant="caption" color="text.secondary">({order.buyer_id})</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(order.order_date)}</TableCell>
                      <TableCell colSpan={showPriceDetails ? 12 : 8} align="center" sx={{ color: 'text.secondary' }}>상품 정보가 없습니다</TableCell>
                    </TableRow>
                  );
                  return acc;
                }

                items.forEach((item, idx) => {
                  const matchedPart = item.part_id ? availableParts.find(p => p.id === item.part_id) : null;
                  const erpCode = matchedPart ? (matchedPart.barcode || matchedPart.code) : '';
                  const erpName = matchedPart ? matchedPart.name : '';
                  const isCancelledItem = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
                  const needsMapping = !item.part_id && (item.custom_product_code || item.product_code) && !isCancelledItem;
                  
                  // 계산된 적립금/전체할인 구하기 (DB에 없을 경우를 대비해 프론트엔드에서도 계산)
                  const orderItemsSum = items.reduce((sum, it) => {
                    const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(it.order_status);
                    return sum + (isCancelled ? 0 : Number(it.payment_amount || 0));
                  }, 0);
                  // 회원등급 할인 합계 (item_discount)
                  const gradeDiscountSum = items.reduce((sum, it) => {
                    const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(it.order_status);
                    return sum + (isCancelled ? 0 : Number(it.item_discount || 0));
                  }, 0);
                  // 결제수단 분류: 외부 실결제(카드/무통장) vs 내부재화(적립금/회원할인)
                  const itemPaymentMethod = (items[0]?.payment_method || '').toLowerCase();
                  const isRealPaymentMethod =
                    itemPaymentMethod.includes('카드') || itemPaymentMethod.includes('card') ||
                    itemPaymentMethod.includes('무통장') || itemPaymentMethod.includes('계좌이체');
                  // isNearbikeMemberDiscount: 적립금/회원할인 전액으로 실결제 0원인 nearbike 주문
                  const isNearbikeMemberDiscount = String(order.order_id || '').startsWith('nearbike_') && Number(order.total_amount || 0) === 0 && !isRealPaymentMethod;
                  const effectiveTotalAmount = !isNearbikeMemberDiscount && Number(order.total_amount || 0) === 0 && orderItemsSum > 0 ? orderItemsSum : Number(order.total_amount || 0);
                  // 선불금: 외부 결제수단·반영완료·회원할인 주문에는 표시 안 함
                  const isPrepaid = !isNearbikeMemberDiscount && !isRealPaymentMethod && !order.is_transferred && Number(order.total_amount || 0) === 0 && orderItemsSum > 0;
                  const calculatedUsedPoints = Math.max(0, orderItemsSum + Number(order.shipping_fee || 0) - effectiveTotalAmount);
                  const isUnpaidOrder = order.status === 'N10' || (items.length > 0 && items[0].order_status === 'N10');
                  // displayUsedPoints 결정:
                  // - 외부 결제수단이면서 DB total_amount=0(잘못 저장) → DB used_points도 잘못된 값이므로 재계산 사용
                  // - 적립금 주문에서 DB used_points=0이지만 계산값이 있으면 → 계산값 사용 (mileage 미캡처 방어)
                  const displayUsedPoints = isUnpaidOrder ? 0 : (() => {
                    if (isRealPaymentMethod && Number(order.total_amount || 0) === 0) return calculatedUsedPoints;
                    if (isNearbikeMemberDiscount && !order.used_points && calculatedUsedPoints > 0) return calculatedUsedPoints;
                    return Number(order.used_points !== undefined && order.used_points !== null ? order.used_points : calculatedUsedPoints);
                  })();

                  acc.push(
                    <TableRow key={`${order.id}-${idx}`} hover selected={selectedOrders.includes(order.id)}>
                      {idx === 0 && (
                        <TableCell padding="checkbox" rowSpan={items.length}>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => handleSelectRow(e, order.id)}
                          />
                        </TableCell>
                      )}
                      {idx === 0 && <TableCell rowSpan={items.length}>카페24 - {order.mall_id}</TableCell>}
                      {idx === 0 && (
                        <TableCell rowSpan={items.length}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                {String(order.order_id || '').includes('_') ? String(order.order_id).split('_').slice(1).join('_') : order.order_id}
                              </Typography>
                              {(order.shipping_message || order.buyer_message) ? (
                                <Tooltip title={order.shipping_message || order.buyer_message} placement="top" arrow>
                                  <Chip label="메세지" size="small" color="info" sx={{ height: 16, fontSize: '0.65rem', cursor: 'pointer' }} />
                                </Tooltip>
                              ) : null}
                            </Box>
                            <Typography variant="caption" color="text.secondary">{formatDate(order.order_date)}</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: item.options ? 0.5 : 0 }}>
                          {item.order_status && item.order_status.match(/^[CRE]/) && (
                            <Chip size="small" label={getKoStatus(item.order_status)} color={getBadgeColor(item.order_status)} variant="filled" sx={{ mr: 1, height: 20, fontSize: '0.65rem' }} />
                          )}
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              textDecoration: item.order_status && item.order_status.match(/^(C40|C47|C48|C49|R40|C11|C34|C36|R34|R36)$/) ? 'line-through' : 'none',
                              color: item.order_status && item.order_status.match(/^(C40|C47|C48|C49|R40|C11|C34|C36|R34|R36)$/) ? 'text.disabled' : 'inherit'
                            }}
                          >
                            {item.name}
                          </Typography>
                        </Box>
                        {item.options && <Typography variant="caption" color="text.secondary" display="block">{item.options}</Typography>}
                        {(item.raw_custom_variant_code || item.raw_custom_product_code || item.custom_product_code) && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                            {(item.raw_custom_variant_code || item.custom_product_code) && (
                              <Typography variant="caption" color="primary" sx={{ fontSize: '0.65rem' }}>
                                자체 품목코드: {item.raw_custom_variant_code || item.custom_product_code}
                              </Typography>
                            )}
                            {item.raw_custom_product_code && (
                              <Typography variant="caption" color="secondary" sx={{ fontSize: '0.65rem' }}>
                                자체 상품코드: {item.raw_custom_product_code}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      {showPriceDetails && <TableCell align="right">{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</TableCell>}
                      {showPriceDetails && idx === 0 && <TableCell align="right" rowSpan={items.length}>{Number(order.shipping_fee || 0).toLocaleString()}</TableCell>}
                      {showPriceDetails && idx === 0 && <TableCell align="right" rowSpan={items.length}>
                        {gradeDiscountSum > 0 ? (
                          <Typography variant="body2" color="warning.main" fontWeight="bold">
                            -{gradeDiscountSum.toLocaleString()}
                          </Typography>
                        ) : '-'}
                      </TableCell>}
                      {showPriceDetails && <TableCell align="right">
                        {['C11', 'C40', 'R40', 'E40'].includes(item.order_status) ? (
                          <Typography variant="body2" color="error" sx={{ textDecoration: 'line-through' }}>
                            {Number(item.payment_amount === undefined ? (Number(item.price || 0) * Number(item.quantity || 1)) : item.payment_amount).toLocaleString()}
                          </Typography>
                        ) : (
                          Number(item.payment_amount === undefined ? (Number(item.price || 0) * Number(item.quantity || 1)) : item.payment_amount).toLocaleString()
                        )}
                      </TableCell>}
                      {idx === 0 && <TableCell align="right" rowSpan={items.length}>
                        {displayUsedPoints > 0 ? (
                          <Typography variant="body2" color="secondary.main" fontWeight="bold">
                            -{displayUsedPoints.toLocaleString()}
                          </Typography>
                        ) : '-'}
                      </TableCell>}
                      {idx === 0 && <TableCell align="right" rowSpan={items.length}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                            <strong>{effectiveTotalAmount.toLocaleString()}</strong>
                          </Box>
                          {isPrepaid && (
                            <Chip label="선불금 처리" size="small" color="info" variant="filled" sx={{ height: 16, fontSize: '0.6rem' }} />
                          )}
                          {items[0]?.payment_method && (
                            <Chip label={items[0].payment_method} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem', color: 'text.secondary' }} />
                          )}
                        </Box>
                      </TableCell>}
                      <TableCell>
                        {erpCode || (needsMapping ? <Chip size="small" label="미스매칭" color="warning" /> : '-')}
                      </TableCell>
                      <TableCell>
                        {['C11', 'C40', 'R40', 'E40'].includes(item.order_status) ? (
                          <Typography variant="caption" color="text.secondary">- (반영 제외)</Typography>
                        ) : (
                          erpName ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                              {erpName}
                              <IconButton size="small" onClick={() => openMappingModal(order, item)} title="매칭 변경" disabled={order.is_transferred}>
                                <SyncIcon fontSize="small" color={order.is_transferred ? "disabled" : "action"} />
                              </IconButton>
                            </Box>
                          ) : (
                            needsMapping ? (
                              <Tooltip title={order.is_transferred ? "반영 완료(전송 완료) 건은 [반영 취소] 후 매핑할 수 있습니다." : "ERP 부품과 연결"}>
                                <span>
                                  <Button size="small" variant="outlined" color="warning" onClick={() => openMappingModal(order, item)} disabled={order.is_transferred}>
                                    수동 연결
                                  </Button>
                                </span>
                              </Tooltip>
                            ) : '-'
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        {['C11', 'C40', 'R40', 'E40'].includes(item.order_status) ? (
                           <Typography variant="caption" color="text.secondary">취소건 (제외)</Typography>
                        ) : order.is_transferred ? (
                          <Typography variant="body2" color="text.secondary">
                            {(() => {
                              const wid = (warehouseConfig[order.id] && warehouseConfig[order.id][idx] !== undefined) 
                                ? String(warehouseConfig[order.id][idx]) 
                                : (item._warehouse_id ? String(item._warehouse_id) : '');
                              if (wid === 'EXCLUDE') return <span style={{ color: '#d32f2f' }}>전송 제외됨</span>;
                              if (wid && wid !== 'DEFAULT') {
                                return warehouses.find(w => String(w.id) === wid)?.name || '전송완료';
                              }
                              return '전송완료';
                            })()}
                          </Typography>
                        ) : (
                          <FormControl size="small" fullWidth sx={{ minWidth: 100 }} error={!order.is_transferred && !(warehouseConfig[order.id] && warehouseConfig[order.id][idx])}>
                             <Select 
                                value={(warehouseConfig[order.id] && warehouseConfig[order.id][idx] !== undefined) ? String(warehouseConfig[order.id][idx]) : (item._warehouse_id ? String(item._warehouse_id) : '')}
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
                               <MenuItem value="EXCLUDE" sx={{ color: 'error.main' }}>🚫 전송 제외</MenuItem>
                               {warehouses.map(w => <MenuItem key={w.id} value={String(w.id)}>{w.name}</MenuItem>)}
                             </Select>
                          </FormControl>
                        )}
                      </TableCell>
                      {idx === 0 && (
                        <TableCell rowSpan={items.length} align="center">
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                              {(!order.is_transferred) && (
                                <Button size="small" variant="outlined" color="info" onClick={() => handleOpenEditItemsModal(order)} sx={{ width: '100%', mb: 1, py: 0.5, fontSize: '0.75rem', whiteSpace: 'nowrap', borderStyle: 'dashed' }}>
                                  품목 교체
                                </Button>
                              )}
                              {(() => {
                                const isCanceledOrReturned = order.status && (String(order.status).trim().startsWith('C') || String(order.status).trim().startsWith('R') || String(order.status).trim().startsWith('E'));
                                if (isCanceledOrReturned) {
                                   return (
                                     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center', width: '100%', mb: 1, pb: 1, borderBottom: '1px dashed #e0e0e0' }}>
                                        <Button size="small" variant="contained" color="secondary" disableElevation onClick={() => handleSmartResolve(order)} sx={{ width: '100%', py: 0.5, fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                          스마트 처리
                                        </Button>
                                     </Box>
                                   );
                                }
                                return null;
                              })()}
                              
                              {order.is_transferred ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', width: '100%' }}>
                                  <Chip size="small" label="완료" color="success" sx={{ width: '100%' }} />
                                  <Button size="small" variant="text" color="error" onClick={() => handleSingleCancelTransfer(order)} sx={{ fontSize: '0.7rem', padding: '2px 4px', minWidth: 'auto' }}>
                                    반영취소
                                  </Button>
                                </Box>
                              ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                                  <Button size="small" variant="contained" color="primary" disabled={String(order.status).trim() === 'N00'} onClick={() => handleSingleSalesTransfer(order)} sx={{ width: '100%', py: 0.5, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                    {String(order.status).trim() === 'N00' ? '입금대기' : '판매반영'}
                                  </Button>
                                  {order.is_deleted ? (
                                    <Button size="small" variant="outlined" color="info" onClick={() => handleSingleUnignoreOrder(order)} sx={{ width: '100%', py: 0.5, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                      무시복구
                                    </Button>
                                  ) : (
                                    <Button size="small" variant="outlined" color="warning" onClick={() => handleSingleIgnoreOrder(order)} sx={{ width: '100%', py: 0.5, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                      반영무시
                                    </Button>
                                  )}
                                </Box>
                              )}
                            </Box>
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

      {/* 테이블 하단에도 실행 액션 관리들 (아래쪽) 배치 */}
      <Box sx={{ mt: 2, mb: 4 }}>
        {renderActionBar()}
      </Box>
      
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
            getOptionLabel={(option) => `${option.brand ? `[${option.brand}] ` : ''}${option.name} [${option.code}${option.barcode && option.barcode !== option.code ? ` | ${option.barcode}` : ''}]`}
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

      {/* 수동 매핑 관리(목록) 모달 */}
      <Dialog open={mappingListModalOpen} onClose={() => setMappingListModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>수동 상품 매핑 관리</DialogTitle>
        <DialogContent dividers>
          {mappingsLoading ? (
            <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
          ) : mappingsList.length === 0 ? (
            <Typography align="center" color="text.secondary" p={2}>등록된 수동 매핑이 없습니다.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell>쇼핑몰</TableCell>
                    <TableCell>카페24 자체품목코드 (또는 상품코드)</TableCell>
                    <TableCell>카페24 상품명 (최근 주문 기준)</TableCell>
                    <TableCell>CRM 매핑된 부품명</TableCell>
                    <TableCell align="center">관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mappingsList.map(item => (
                    <TableRow key={`${item.mall_id}-${item.cafe24_product_code}`}>
                      <TableCell>{item.mall_id}</TableCell>
                      <TableCell><code>{item.cafe24_product_code}</code></TableCell>
                      <TableCell>{item.dynamic_product_name ? <Typography variant="body2">{item.dynamic_product_name}</Typography> : <Typography variant="body2" color="text.secondary">(이름 미확인)</Typography>}</TableCell>
                      <TableCell>{item.parts?.name}</TableCell>
                      <TableCell align="center">
                        <Button color="error" size="small" onClick={() => handleDeleteMapping(item)}>삭제</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingListModalOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 주문자 - 거래처 수동 매칭 모달 */}
      <Dialog open={agencyMatchModalOpen} onClose={() => setAgencyMatchModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>주문자 - 거래처 수동 변경 및 매칭</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 3 }}>
            카페24 주문 <b>"{selectedOrderForAgencyMatch?.buyer_name || '비회원'}"</b> (주문번호: {selectedOrderForAgencyMatch?.order_id}) 의 <b>실제 매출 및 검수용 <span style={{color: '#d32f2f'}}>판매처(거래처)</span></b>를 수동으로 지정합니다.<br /><br />
            기본적으로 <b>현재 선택한 이 주문 1건에 대해서만</b> 판매처 정보가 즉시 변경됩니다.
          </Alert>

          <Autocomplete
            options={agencies}
            getOptionLabel={(option) => `${option.name} ${option.ceo_name ? `[${option.ceo_name}]` : ''} ${option.business_number ? `(${option.business_number})` : ''}`}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            value={selectedAgency}
            onChange={(event, newValue) => setSelectedAgency(newValue)}
            renderInput={(params) => <TextField {...params} label="변경할 거래처 검색" />}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props;
              return (
                <li key={option.id || key} {...otherProps}>
                  <Box>
                    <Typography variant="body1">{option.name} {option.ceo_name && <span style={{fontSize:'0.85em', color:'gray'}}>[{option.ceo_name}]</span>}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">주소: {option.address || '미등록'}</Typography>
                    <Typography variant="caption" color="text.secondary">사업자번호: {option.business_number || '없음'} | 연동ID: {option.cafe24_member_id || '미연동'}</Typography>
                  </Box>
                </li>
              );
            }}
          />
          
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={updateAllOrdersOfBuyer}
                  onChange={(e) => setUpdateAllOrdersOfBuyer(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  이 구매자(ID: {selectedOrderForAgencyMatch?.buyer_id})의 기존/미래 카페24 주문 내역도 앞으로 해당 판매처로 영구 고정합니다. (구매자-대리점 일괄 매칭)
                </Typography>
              }
            />
          </Box>
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

      {/* 품목 수정 모달 */}
      <Dialog open={editItemsModalOpen} onClose={() => setEditItemsModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>주문 품목 직접 교체/추가 ({editingOrder?.order_id})</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            카페24 쇼핑몰에서 넘어온 <b>주문 정보(상품명, 결제금액 등)는 원본 그대로 보존</b>하면서, 실제 출고될 <b>[CRM 부품 매칭]만 강제로 교체</b>할 수 있습니다.<br/>
            (더미 상품을 여러 개의 실제 부품으로 쪼개거나, 매핑이 잘못된 품목을 올바른 품목으로 바꿀 때 유용합니다.)
          </Alert>
          
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>상품명</TableCell>
                <TableCell width="80">수량</TableCell>
                <TableCell width="120">단가(원)</TableCell>
                <TableCell width="140">라인 총결제액(합계)</TableCell>
                <TableCell width="60" align="center">삭제</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {editingItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
                      {item.order_status && item.order_status.match(/^[CRE]/) && (
                        <Chip size="small" label={getKoStatus(item.order_status) || item.order_status} color={getBadgeColor(item.order_status) || 'default'} variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />
                      )}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 500, 
                          color: item.order_status && item.order_status.match(/^(C40|C47|C48|C49|R40|E40|C11|C34|C36|R34|R36)$/) ? 'text.disabled' : 'text.primary', 
                          textDecoration: item.order_status && item.order_status.match(/^(C40|C47|C48|C49|R40|E40|C11|C34|C36|R34|R36)$/) ? 'line-through' : 'none'
                        }}
                      >
                        {item.name || item.product_name}
                      </Typography>
                    </Box>
                    {item.options && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>{item.options}</Typography>}
                    <Autocomplete
                      size="small"
                      options={availableParts}
                      getOptionLabel={(option) => `${option.brand ? `[${option.brand}] ` : ''}${option.name} [${option.code}]`}
                      isOptionEqualToValue={(option, value) => option.id === value?.id}
                      value={item.part_id ? availableParts.find(p => p.id === item.part_id) || null : null}
                      onChange={(e, val) => handleEditingItemChange(idx, 'part_id', val ? val.id : null)}
                      renderInput={(params) => <TextField {...params} label="매칭될 CRM 부품 (출고 대상)" placeholder="검색하여 연결" />}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                          <li key={option.id || key} {...otherProps}>
                            <Box>
                              <Typography variant="body2">{option.name}</Typography>
                              <Typography variant="caption" color="text.secondary">코드: {option.code}</Typography>
                            </Box>
                          </li>
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                      type="number" size="small" 
                      value={item.quantity} 
                      onChange={e => handleEditingItemChange(idx, 'quantity', e.target.value)}
                      inputProps={{ min: 1, style: { padding: '4px 8px' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" type="number"
                      value={item.product_price || 0}
                      onChange={e => handleEditingItemChange(idx, 'product_price', e.target.value)}
                      inputProps={{ style: { padding: '4px 8px' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={item.payment_amount !== undefined ? item.payment_amount : (item.product_price || 0) * (item.quantity || 1)}
                      onChange={e => handleEditingItemChange(idx, 'payment_amount', e.target.value)}
                      inputProps={{ style: { padding: '4px 8px' } }}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="1개 분할하기 (수량이 2개 이상일 때)">
                      <span>
                        <IconButton size="small" color="primary" onClick={() => handleSplitEditingItem(idx)} disabled={Number(item.quantity || 1) <= 1} sx={{ mr: 0.5 }}>
                          <CallSplitIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => handleRemoveEditingItem(idx)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {editingItems.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">모든 항목이 삭제되었습니다. 아래에서 출고할 부품을 추가해주세요.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow sx={{ bgcolor: '#f8fbff' }}>
                <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                  등록된 품목의 총결제액 합계
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1rem' }}>
                  {editingItems.reduce((acc, item) => {
                    const isCanceled = item.order_status && item.order_status.match(/^(C40|C47|C48|C49|R40|E40|C11|C34|C36|R34|R36)$/);
                    if (isCanceled) return acc;
                    return acc + Number(item.payment_amount !== undefined ? item.payment_amount : (item.product_price || 0) * (item.quantity || 1));
                  }, 0).toLocaleString()}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>

          <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle2" mb={1} color="primary">➕ 실제 기체/부품 새롭게 교체 추가</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Autocomplete
                sx={{ flexGrow: 1 }}
                options={availableParts}
                getOptionLabel={(option) => `${option.brand ? `[${option.brand}] ` : ''}${option.name} [${option.code}${option.barcode && option.barcode !== option.code ? ` | ${option.barcode}` : ''}]`}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                value={addingPart}
                onChange={(e, val) => setAddingPart(val)}
                renderInput={(params) => <TextField {...params} label="CRM 기체/부품명 검색" size="small" sx={{ bgcolor: 'white' }} />}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <li key={option.id || key} {...otherProps}>
                      <Box>
                        <Typography variant="body2">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">코드: {option.code} | 기준가: {(option.price||0).toLocaleString()}원</Typography>
                      </Box>
                    </li>
                  );
                }}
              />
              <Button variant="contained" onClick={handleAddEditingPart} disabled={!addingPart} sx={{ height: '40px', whiteSpace: 'nowrap' }}>
                추가
              </Button>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItemsModalOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleSaveEditedItems} disabled={editItemsSaving || editingItems.length === 0}>
            {editItemsSaving ? '저장중...' : '수정 내역 저장'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => Math.max(theme.zIndex.drawer, theme.zIndex.modal) + 1, display: 'flex', flexDirection: 'column', gap: 2 }}
        open={isTransferring}
      >
        <CircularProgress color="inherit" />
        <Typography variant="h6">판매 반영 등록 중입니다...</Typography>
      </Backdrop>
    </Box>
  );
}
