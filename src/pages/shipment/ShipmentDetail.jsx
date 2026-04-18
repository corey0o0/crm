import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
  Grid,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Snackbar,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import { processShipmentCompletion, processShipmentRevert, processPartialReturn } from '../../utils/inventoryUtils';
import { pendingOutboundApi } from '../../api/pendingOutboundApi';
import { useAuth } from '../../contexts/AuthContext';
import { MASTER_ACCOUNTS } from '../../config/menuConfig';
// import { addShipmentPartsToPendingOrders } from '../../utils/pendingOrderUtils'; // 주문대기 기능 비활성화

function ShipmentDetail() {
  const [loading, setLoading] = useState(true);
  const [shipmentData, setShipmentData] = useState(null);
  const [shipmentParts, setShipmentParts] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editableParts, setEditableParts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [isInspectionEnabled, setIsInspectionEnabled] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isMaster = user?.email && MASTER_ACCOUNTS.includes(user.email);

  const handleAddToPendingOutbounds = async () => {
    if (shipmentData.status !== '준비중') {
       alert("출고 상태가 '준비중'일 때만 검수 대기열에 등록할 수 있습니다.");
       return;
    }
    if (!shipmentParts || shipmentParts.length === 0) {
       alert("출고할 부품/상품 내역이 없습니다.");
       return;
    }

    if (!window.confirm("이 출고건을 '출고 검수' 대기열로 전송하시겠습니까?")) return;

    try {
      setAddingToQueue(true);
      const orderData = {
        order_no: `SHP-${shipmentData.id.slice(0, 8).toUpperCase()}`,
        type: '일반 출고',
        source_id: shipmentData.id,
        status: '대기',
        items: shipmentParts.map(part => ({
          part_id: part.part_id,
          name: part.part_name,
          code: part.part_code || '',
          barcode: part.part_code || '',
          expected_qty: part.quantity
        }))
      };
      
      await pendingOutboundApi.create(orderData);
      
      // 검수 대기열 등록에 성공하면, 출고서의 상태도 '부품준비'로 자동 변경
      await supabase.from('shipments').update({ status: '부품준비' }).eq('id', id);
      setShipmentData(prev => ({ ...prev, status: '부품준비' }));
      
      setSnackbar({
        open: true,
        message: '검수 대기열에 등록되었으며, 부품준비 상태로 변경되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: '대기열 등록 중 오류가 발생했습니다: ' + err.message,
        severity: 'error'
      });
    } finally {
      setAddingToQueue(false);
    }
  };

  // Snackbar 상태 추가
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // 1. 부품 추가 다이얼로그 상태 및 부품 목록 상태 추가
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [modifiedPrice, setModifiedPrice] = useState('');
  const [partInputValue, setPartInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(0);
  const rowsPerPage = 15;

  useEffect(() => {
    if (id) {
      fetchShipmentDetail();
    }
  }, [id]);

  const fetchShipmentDetail = async () => {
    try {
      setLoading(true);

      // 출고 정보 조회
      const { data: shipment, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setShipmentData(shipment);

      // 부품 정보 조회
      try {
        const { data: parts, error: partsError } = await supabase
          .from('shipment_parts')
          .select('*')
          .eq('shipment_id', id);

        if (!partsError) {
          const partsData = parts || [];
          setShipmentParts(partsData);

          // 부품 정보가 없지만 shipment 데이터에 product_name이 있는 경우 
          // 자동으로 데이터 마이그레이션 실행
          if (partsData.length === 0 && shipment.product_name) {
            migrateProductData(shipment);
          }
        }
      } catch (partsError) {
        console.error('Error fetching shipment parts:', partsError);
      }

    } catch (error) {
      console.error('Error fetching shipment details:', error);
    } finally {
      setLoading(false);
    }
  };

  // 제품 데이터 마이그레이션 함수
  const migrateProductData = async (shipment) => {
    try {
      setMigrating(true);

      // 제품 카테고리 추정
      let category = '기체';
      if (shipment.product_code) {
        const code = shipment.product_code.toUpperCase();
        if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
          category = '파츠';
        } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
          category = '공임';
        }
      }

      // 부품 데이터 생성
      const partData = {
        shipment_id: shipment.id,
        part_name: shipment.product_name,
        part_code: shipment.product_code || '',
        part_category: category,
        quantity: shipment.quantity || 1,
        price: shipment.price ? (shipment.price / (shipment.quantity || 1)) : 0,
        total_price: shipment.price || 0,
        created_at: new Date().toISOString()
      };

      // 부품 정보 저장
      const { data, error } = await supabase
        .from('shipment_parts')
        .insert([partData])
        .select();

      if (error) {
        throw error;
      }

      // 저장 성공 시 부품 목록 업데이트
      if (data && data.length > 0) {
        setShipmentParts(data);
        setSnackbar({
          open: true,
          message: '제품 정보가 성공적으로 업데이트되었습니다.',
          severity: 'success'
        });
      }

    } catch (error) {
      console.error('Error migrating product data:', error);
      setSnackbar({
        open: true,
        message: '제품 정보 업데이트 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setMigrating(false);
    }
  };

  // 수정 시작 함수
  const handleStartEdit = async () => {
    if (shipmentData?.status === '출고완료') {
      const confirmEdit = window.confirm("이미 재고가 차감 처리된 건입니다. 부품을 수정하기 위해서는 안전한 재고 연동을 위해 상태가 '준비중'으로 우선 변경되며, 현재 차감된 재고가 창고로 다시 복구됩니다.\n진행하시겠습니까?");
      if (!confirmEdit) return;
      
      // 안전한 수정을 위해 강제로 준비중 상태로 돌림 (내부적으로 재고 원상복구 진행됨)
      await handleStatusChange('준비중');
    }

    // 현재 부품 데이터를 편집 가능한 상태로 복사
    setEditableParts([...shipmentParts]);
    setIsEditing(true);
  };

  // 수정 취소 함수
  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // 가격 수정 함수
  const handlePriceChange = (partId, newPrice) => {
    setEditableParts(prev => prev.map(part => {
      if (part.id === partId) {
        const price = parseFloat(newPrice) || 0;
        return {
          ...part,
          price: price,
          total_price: price * (part.quantity || 1)
        };
      }
      return part;
    }));
  };

  // 수량 수정 함수
  const handleQuantityChange = (partId, newQuantity) => {
    setEditableParts(prev => prev.map(part => {
      if (part.id === partId) {
        const quantity = parseInt(newQuantity) || 1;
        return {
          ...part,
          quantity: quantity,
          total_price: (part.price || 0) * quantity
        };
      }
      return part;
    }));
  };

  // 제품 삭제 함수
  const handleRemovePart = (partId) => {
    setEditableParts(prev => prev.filter(part => part.id !== partId));
  };

  const handleReturnPart = async (part) => {
    const qtyStr = window.prompt(`'${part.part_name}' 총 ${part.quantity}개 중 반품(재입고)할 수량을 입력하세요:`, part.quantity);
    if (qtyStr === null) return; // 취소

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0 || qty > part.quantity) {
      alert(`잘못된 수량입니다. 1에서 ${part.quantity} 사이의 숫자를 입력해주세요.`);
      return;
    }

    try {
      setSnackbar({ open: true, message: '반품 처리 중...', severity: 'info' });
      
      let brandCode = 'XRB';
      if (shipmentData?.product_code && (shipmentData.product_code.startsWith('NB') || shipmentData.product_code.includes('NEARBIKE'))) {
        brandCode = 'NB';
      } else if (shipmentParts.length > 0 && shipmentParts[0]?.part_code?.startsWith('NB')) {
        brandCode = 'NB';
      }

      const res = await processPartialReturn('shipment', id, part.id, qty, brandCode);
      if (!res.success && !res.skipped) throw new Error(res.message);
      
      const newNoteSuffix = qty === part.quantity ? '[반품완료]' : `[부분반품:${qty}개]`;

      setShipmentParts(prev => prev.map(p => 
        p.id === part.id ? { ...p, note: (p.note ? p.note + ' ' : '') + newNoteSuffix } : p
      ));
      
      setSnackbar({ open: true, message: '부품 반품(재입고) 처리가 완료되었습니다.', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '반품 처리 중 오류가 발생했습니다: ' + err.message, severity: 'error' });
    }
  };

  // 변경 사항 저장 함수
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      if (editableParts.length === 0) {
        setSnackbar({
          open: true,
          message: '제품이 최소 하나 이상 필요합니다.',
          severity: 'warning'
        });
        setSaving(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from('shipment_parts')
        .delete()
        .eq('shipment_id', id);

      if (deleteError) {
        console.error("Error deleting old parts:", deleteError);
        throw new Error(`기존 부품 정보 삭제 중 오류: ${deleteError.message}`);
      }

      const partsData = editableParts.map(part => ({
        shipment_id: id,
        part_name: part.part_name,
        part_code: part.part_code || '',
        part_category: part.part_category || '기체',
        quantity: part.quantity || 1,
        price: part.price || 0,
        total_price: part.total_price || (part.price || 0) * (part.quantity || 1),
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('shipment_parts')
        .insert(partsData);

      if (insertError) {
        console.error("Error inserting new parts:", insertError);
        throw new Error(`새 부품 정보 저장 중 오류: ${insertError.message}`);
      }

      const totalQuantity = editableParts.reduce((sum, part) => sum + (parseInt(part.quantity) || 0), 0);
      const totalPrice = editableParts.reduce((sum, part) => sum + ((parseFloat(part.price) || 0) * (parseInt(part.quantity) || 0)), 0);
      const combinedProductName = editableParts.map(p => p.part_name).join(', ');

      const shipmentUpdateData = {
        product_name: combinedProductName,
        product_code: editableParts[0]?.part_code || '',
        quantity: totalQuantity,
        price: totalPrice,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('shipments')
        .update(shipmentUpdateData)
        .eq('id', id);

      if (updateError) {
        console.error("Error updating shipment:", updateError);
        throw new Error(`출고 정보 업데이트 중 오류: ${updateError.message}`);
      }

      setSnackbar({
        open: true,
        message: '제품 정보가 성공적으로 업데이트되었습니다.',
        severity: 'success'
      });

      setIsEditing(false);
      await fetchShipmentDetail();

    } catch (error) {
      console.error('Error saving changes:', error);
      setSnackbar({
        open: true,
        message: `저장 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // 삭제 확인 다이얼로그 열기
  const handleOpenConfirmDialog = () => {
    setConfirmDialogOpen(true);
  };

  // 출고 삭제 함수
  const handleDeleteShipment = async () => {
    if (!isMaster && ['부품준비', '검수완료', '출고대기', '출고완료'].includes(shipmentData.status)) {
      setSnackbar({
        open: true,
        message: '검수가 진행된 건은 보안을 위해 직접 삭제할 수 없습니다. (취소 필요 시 마스터 또는 관리자 문의)',
        severity: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const { error: deletePartsError } = await supabase
        .from('shipment_parts')
        .delete()
        .eq('shipment_id', id);

      if (deletePartsError) {
        console.error("Error deleting shipment parts:", deletePartsError);
        setSnackbar({
          open: true,
          message: `출고된 부품 정보 삭제 중 오류가 발생했지만, 출고 정보 삭제를 계속 진행합니다: ${deletePartsError.message}`,
          severity: 'warning'
        });
      }

      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('group_id', id);

      if (txError) {
        console.error("Error deleting related transactions:", txError);
      }

      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting shipment:", error);
        throw new Error(`출고 정보 삭제 중 오류: ${error.message}`);
      }

      setSnackbar({
        open: true,
        message: '출고 정보가 삭제되었습니다.',
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/shipment');
      }, 1500);

    } catch (error) {
      console.error('Error deleting shipment:', error);
      setSnackbar({
        open: true,
        message: `삭제 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  const handleBack = () => {
    navigate('/shipment');
  };

  const handleEdit = () => {
    navigate(`/shipment/edit/${id}`);
  };

  // 상태 변경 및 재고 처리
  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      const previousStatus = shipmentData.status;

      // === [검수 락 (관리자 바이패스 및 토글 체크)] ===
      if (isInspectionEnabled && ['출고완료', '출고대기'].includes(newStatus) && !['출고완료', '출고대기'].includes(previousStatus) && !isMaster) {
        // 출고 창고 지정 기능이 제거되었으므로, 모든 일반 계정 출고 건은 
        // 출고 검수 탭을 통해 검수 프로세스를 거쳐야만 출고 확정이 가능하도록 기본 설정됨.
        const { data: po } = await supabase.from('pending_outbounds').select('status').eq('source_id', id).maybeSingle();
        if (!po || po.status !== '완료') {
          alert('출고 확정 시 반드시 [출고 검수] 탭에서 검수를 완료(' + (po?po.status:'미등록') + ')해야만 확정 처리가 가능합니다. (일반 계정 제한)');
          setSaving(false);
          return;
        }
      }
      // ===================================

      // 브랜드 코드 확인 (출고 정보에서 브랜드 추정)
      let brandCode = 'XRB'; // 기본값

      // shipment_parts에서 part_code를 확인하여 브랜드 추정
      if (shipmentParts.length > 0) {
        const firstPartCode = shipmentParts[0]?.part_code;
        if (firstPartCode) {
          if (firstPartCode.startsWith('NB') || firstPartCode.includes('NEARBIKE')) {
            brandCode = 'NB';
          }
        }
      }

      // 상태 업데이트 데이터 준비
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // 출고대기/출고완료로 변경 시 출고일도 현재 시점으로 업데이트
      // (요청사항: 출고상태가 '출고대기' 또는 '출고완료'로 변경되면 출고일을 현재 날짜로 설정)
      if (newStatus === '출고완료' || newStatus === '출고대기') {
        updateData.shipment_date = new Date().toISOString().split('T')[0];
      }

      const { error: updateError } = await supabase
        .from('shipments')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        throw new Error(`상태 업데이트 실패: ${updateError.message}`);
      }

      let inventoryMessage = '';
      let pendingOrderMessage = '';

      // 재고 처리 로직
      if (newStatus === '출고완료' && previousStatus !== '출고완료') {
        // 출고 처리로 변경: 재고 차감
        console.log(`출고 차감 처리 시작 - 출고ID: ${id}, 브랜드: ${brandCode}`);

        const inventoryResult = await processShipmentCompletion(id, brandCode);

        if (inventoryResult.success) {
          if (!inventoryResult.skipped) {
            inventoryMessage = `, ${inventoryResult.message}`;
          }
        } else {
          inventoryMessage = ` (재고 차감 오류: ${inventoryResult.message})`;
          console.error('재고 차감 오류 상세:', inventoryResult.errors);
        }

        // 주문대기 추가 처리 (비활성화됨)
        // try {
        //   console.log(`주문대기 추가 시작 - 출고ID: ${id}, 브랜드: ${brandCode}`);
        //   
        //   const pendingOrderResult = await addShipmentPartsToPendingOrders(id, brandCode);
        //   
        //   if (pendingOrderResult.success) {
        //     if (pendingOrderResult.skipped) {
        //       pendingOrderMessage = `, 주문대기: ${pendingOrderResult.message}`;
        //     } else {
        //       pendingOrderMessage = `, 주문대기: ${pendingOrderResult.message}`;
        //     }
        //   } else {
        //     pendingOrderMessage = `, 주문대기 추가 실패: ${pendingOrderResult.message}`;
        //     console.error('주문대기 추가 오류:', pendingOrderResult.message);
        //   }
        // } catch (pendingOrderError) {
        //   console.error('주문대기 추가 중 예외:', pendingOrderError);
        //   pendingOrderMessage = `, 주문대기 추가 실패: ${pendingOrderError.message}`;
        // }
      } else if (previousStatus === '출고완료' && newStatus !== '출고완료') {
        // 출고 상태에서 일반 상태로 변경: 재고 복구
        console.log(`출고 상태 복구 처리 시작 - 출고ID: ${id}, 브랜드: ${brandCode}`);

        const inventoryResult = await processShipmentRevert(id, brandCode);

        if (inventoryResult.success) {
          if (!inventoryResult.skipped) {
            inventoryMessage = `, ${inventoryResult.message}`;
          }
        } else {
          inventoryMessage = ` (재고 복구 오류: ${inventoryResult.message})`;
          console.error('재고 복구 오류 상세:', inventoryResult.errors);
        }
      }

      setSnackbar({
        open: true,
        message: `상태가 '${newStatus}'로 변경되었습니다${inventoryMessage}${pendingOrderMessage}`,
        severity: inventoryMessage.includes('오류') || pendingOrderMessage.includes('실패') ? 'warning' : 'success'
      });

      // 데이터 새로고침
      await fetchShipmentDetail();

    } catch (error) {
      console.error('상태 변경 중 오류:', error);
      setSnackbar({
        open: true,
        message: `상태 변경 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    // 인쇄 전에 마이그레이션이 완료되었는지 확인
    if (migrating) {
      setSnackbar({
        open: true,
        message: '제품 정보 업데이트 중입니다. 잠시 후 다시 시도해주세요.',
        severity: 'warning'
      });
      return;
    }

    const printContent = `
      <html>
        <head>
          <title>출고 상세내역</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .header { text-align: center; margin-bottom: 20px; }
            .section { margin-bottom: 15px; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .category { 
              display: inline-block;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              color: white;
              background-color: #3182f6;
            }
            .category-파츠 { background-color: #f50057; }
            .category-공임 { background-color: #4caf50; }
            .category-기타 { background-color: #ff9800; }
            .total-row { font-weight: bold; }
            .product-card {
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 15px;
              margin-bottom: 15px;
              background-color: #fff;
            }
            .product-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .product-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
            }
            .product-quantity {
              color: #666;
            }
            .product-price {
              font-weight: bold;
            }
            .product-parts {
              margin-top: 10px;
              border-top: 1px dashed #eee;
              padding-top: 10px;
            }
            .product-part {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>출고 상세내역</h2>
            <p>출고일자: ${shipmentData?.shipment_date ? format(parseISO(shipmentData.shipment_date), 'yyyy-MM-dd') : '-'}</p>
          </div>
          
          <div class="section">
            <div class="label">고객 정보</div>
            <p>고객명: ${shipmentData?.customer_name || '-'}</p>
            <p>연락처: ${shipmentData?.customer_phone || '-'}</p>
            <p>주소: ${shipmentData?.customer_address || '-'}</p>
          </div>
          
          <div class="section">
            <div class="label">배송 정보</div>
            <p>배송방법: ${shipmentData?.delivery_method || '-'}</p>
            <p>송장번호: ${shipmentData?.tracking_number || '-'}</p>
            <p>판매처: ${getSalesChannel() || '공홈'}</p>
          </div>
          
          <div class="section">
            <div class="label">제품 정보</div>
            <div class="product-card">
              ${shipmentParts.length > 0 ? `
                <div class="product-title">
                  ${shipmentParts.length > 1 ? `${shipmentParts[0]?.part_name || '기체모델명'} 외 ${shipmentParts.length - 1}건` : shipmentParts.map(part => part.part_name).join(', ')}
                </div>
                <div class="product-details">
                  <div class="product-quantity">
                    ${shipmentParts.reduce((total, part) => total + (part.quantity || 0), 0)}개
                  </div>
                  <div class="product-price">
                    ${calculateTotalSum().toLocaleString()}원
                  </div>
                </div>
                ${shipmentParts.length > 1 ? `
                  <div class="product-parts">
                    <div style="color: #999; font-size: 12px; margin-bottom: 8px;">세부 제품 내역</div>
                    ${shipmentParts.map(part => `
                      <div class="product-part">
                        <div>
                          ${part.part_name}
                          <span class="category category-${part.part_category || '기체'}">${part.part_category || '기체'}</span>
                          <span style="color: #666; font-size: 12px;">${part.quantity || 1}개</span>
                        </div>
                        <div>
                          ${calculateTotal(part).toLocaleString()}원
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              ` : `
                <div class="product-title">
                  ${shipmentData.product_name || '-'}
                </div>
                <div class="product-details">
                  <div class="product-quantity">
                    ${shipmentData.quantity || 1}개
                  </div>
                  <div class="product-price">
                    ${(shipmentData.price || 0).toLocaleString()}원
                  </div>
                </div>
              `}
            </div>
          </div>
          
          <div class="section">
            <div class="label">메모</div>
            <p>${shipmentData?.note ? shipmentData.note.replace(/\[판매처: .*?\]/, '').trim() : '-'}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // 한글 금액 변환 함수(간단 버전)
  function numberToKorean(num) {
    const hanA = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십"];
    const danA = ["", "만", "억", "조", "경"];
    let result = "";
    let i = 0;
    while (num > 0) {
      let str = "";
      let tmpNum = num % 10000;
      num = Math.floor(num / 10000);
      let unit = 1000;
      while (unit > 0) {
        let digit = Math.floor(tmpNum / unit);
        if (digit > 0) str += hanA[digit] + (unit > 1 ? (unit === 1000 ? "천" : unit === 100 ? "백" : "십") : "");
        tmpNum %= unit;
        unit = Math.floor(unit / 10);
      }
      if (str !== "") result = str + danA[i] + result;
      i++;
    }
    return result === "" ? "영" : result + "원";
  }

  const handlePrintEstimate = () => {
    const today = new Date();
    const estimateTotal = shipmentParts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
    const taxTotal = Math.round(estimateTotal * 0.1);
    const totalInKorean = numberToKorean(estimateTotal);
    const printContent = `
      <html>
        <head>
          <title>견적서</title>
          <style>
            body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 0; padding: 40px; }
            .title { font-size: 2.2rem; font-weight: bold; margin-bottom: 24px; }
            .estimate-header { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 18px; 
              gap: 32px; 
              width: 100%;
              box-sizing: border-box;
            }
            .customer-info { flex: 1; min-width: 220px; }
            .company-info { flex: 1; min-width: 260px; text-align: right; }
            .estimate-box {
              border: 2.5px solid #111;
              margin: 18px 0 12px 0;
              padding: 12px 0;
              text-align: center;
              font-size: 1.2rem;
              font-weight: 600;
              width: 100%;
              box-sizing: border-box;
            }
            .estimate-box .note { font-size: 1rem; text-align: right; }
            .estimate-table {
              width: 100%;
              box-sizing: border-box;
              border-collapse: collapse;
              margin-top: 0;
              font-size: 1rem;
            }
            .estimate-table th, .estimate-table td {
              border: 1.5px solid #222;
              padding: 10px 8px;
              text-align: center;
              word-break: keep-all;
              white-space: nowrap;
            }
            .estimate-table th {
              background: #f8f9fa;
              font-weight: 500;
            }
            .estimate-table .empty-row td { height: 32px; }
            .estimate-table .total-row { font-weight: bold; background: #f8f9fa; }
            .validity { margin-top: 18px; font-size: 1rem; color: #444; }
          </style>
        </head>
        <body>
          <div class="title">견적서</div>
          <div class="estimate-header">
            <div class="customer-info">
              <div style="font-weight:600; margin-bottom:8px; font-size:1.08rem;">고객 정보</div>
              <div><b>고객명</b>: ${shipmentData?.customer_name || ''}</div>
              <div><b>연락처</b>: ${shipmentData?.customer_phone || ''}</div>
              <div><b>견적날짜</b>: ${today.getFullYear()}년 ${String(today.getMonth() + 1).padStart(2, '0')}월 ${String(today.getDate()).padStart(2, '0')}일</div>
              <div><b>유효기간</b>: 견적일로부터 1개월</div>
            </div>
            <div class="company-info">
              <div style="font-weight:600; margin-bottom:8px; font-size:1.08rem;">회사 정보</div>
              <div><b>상호</b>: (주)슬림팩</div>
              <div><b>사업자번호</b>: 230-81-03757</div>
              <div><b>대표</b>: 이영종</div>
              <div><b>주소</b>: 서울시 강남구 도산대로55길 18 1층</div>
              <div><b>연락처</b>: 02-548-8890</div>
            </div>
          </div>
          <div class="estimate-box">
            견적금액 <span style="margin-left:16px; font-size:1.25rem; font-weight:700;">( ￦${estimateTotal.toLocaleString()}원 )</span>
            <span class="note" style="margin-left:16px; font-size:1rem; font-weight:400;">※ 부가세포함</span>
          </div>
          <table class="estimate-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>세부내용</th>
                <th>수량</th>
                <th>단가</th>
                <th>금액</th>
                <th>세액</th>
              </tr>
            </thead>
            <tbody>
              ${shipmentParts.map((part, idx) => {
      const amount = (part.price || 0) * (part.quantity || 1);
      const tax = Math.round(amount * 0.1);
      return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${part.part_name}</td>
                    <td>${part.quantity}</td>
                    <td>${(part.price || 0).toLocaleString()}</td>
                    <td>${amount.toLocaleString()}</td>
                    <td>${tax.toLocaleString()}</td>
                  </tr>
                `;
    }).join('')}
              ${Array.from({ length: Math.max(5 - shipmentParts.length, 0) }).map(() => `
                <tr class="empty-row">
                  <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4">합계</td>
                <td>${estimateTotal.toLocaleString()}</td>
                <td>${taxTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div class="validity">※ 본 견적서의 유효기간은 견적일로부터 1개월입니다.</div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '준비중':
        return 'info';
      case '부품준비':
        return 'secondary';
      case '검수완료':
      case '출고대기':
        return 'warning';
      case '출고완료':
        return 'success';
      default:
        return 'default';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case '기체':
        return 'primary';
      case '파츠':
        return 'success';
      case '공임':
        return 'warning';
      default:
        return 'default';
    }
  };

  const calculateTotal = (part) => {
    const total = part.total_price != null ? part.total_price : (part.price || 0) * (part.quantity || 0);
    return isNaN(total) ? 0 : total;
  };

  const calculateTotalSum = () => {
    if (shipmentParts && shipmentParts.length > 0) {
      return shipmentParts.reduce((sum, part) => sum + calculateTotal(part), 0);
    }
    return (shipmentData?.price || 0);
  };

  const getSalesChannel = () => {
    if (!shipmentData?.note) return '공홈';

    const salesChannelMatch = shipmentData.note.match(/\[판매처: (.*?)\]/);
    if (salesChannelMatch && salesChannelMatch[1]) {
      return salesChannelMatch[1];
    }

    return shipmentData.sales_channel || '공홈';
  };

  const getChannelColorInfo = (channel) => {
    const colors = {
      '공홈': { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
      '스마트스토어': { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
      '네이버': { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
      '쿠팡': { bg: '#fbe9e7', color: '#d84315', border: '#ffab91' },
      '청담매장': { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
      '인스타': { bg: '#fce4ec', color: '#c2185b', border: '#f48fb1' },
      '라이클-우리': { bg: '#fff8e1', color: '#f57f17', border: '#ffe082' },
      '스마트할부': { bg: '#ebf8fa', color: '#00838f', border: '#80deea' },
      '블로그': { bg: '#e8eaf6', color: '#283593', border: '#9fa8da' }
    };
    return colors[channel] || { bg: '#f5f5f5', color: '#616161', border: '#e0e0e0' };
  };

  const getDeliveryColorInfo = (method) => {
    const colors = {
      '택배': { bg: '#e3f2fd', color: '#1565c0' },
      '방문수령': { bg: '#f3e5f5', color: '#6a1b9a' },
      '화물': { bg: '#424242', color: '#ffffff' },
      '퀵-선불': { bg: '#424242', color: '#ffffff' },
      '퀵-착불': { bg: '#ffebee', color: '#c62828' }
    };
    return colors[method] || { bg: '#f5f5f5', color: '#616161' };
  };

  // 메모이제이션된 필터링 함수
  const filteredParts = useMemo(() => {
    setIsSearching(true);

    if (!searchTerm) {
      setIsSearching(false);
      return availableParts.slice(0, 50); // 검색어 없을 때는 처음 50개만 표시
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = availableParts.filter(part =>
      (part.name && part.name.toLowerCase().includes(searchLower)) ||
      (part.code && part.code.toLowerCase().includes(searchLower))
    ).slice(0, 100); // 최대 100개 결과로 제한

    setIsSearching(false);
    return filtered;
  }, [searchTerm, availableParts]);

  // 페이지네이션된 결과
  const paginatedParts = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredParts.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredParts, page]);

  // 페이지 변경 처리
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // 향상된 부품 다이얼로그 열기 함수
  const handleOpenPartsDialog = async () => {
    setOpenPartsDialog(true);
    setPartInputValue('');
    setSearchTerm('');
    setSelectedPart(null);
    setPartQuantity(1);
    setModifiedPrice('');
    setPage(0);

    // 부품 데이터가 없는 경우에만 로드 (최적화)
    if (availableParts.length === 0) {
      try {
        const brand = shipmentData?.brand || 'XRB';
        const { data, error } = await supabase
          .from('parts')
          .select('*')
          .in('brand', [brand, 'COMMON']); // 선택된 브랜드 + 공용 파츠 포함

        if (!error) {
          setAvailableParts(data || []);
        }
      } catch (err) {
        console.error('부품 데이터 로드 중 오류:', err);
      }
    }
  };

  // 검색어 처리 함수 수정
  const handlePartInputChange = (e) => {
    setPartInputValue(e.target.value);
  };

  // 검색 실행 함수 추가
  const handleSearch = () => {
    setSearchTerm(partInputValue);
    setPage(0);
  };

  // 엔터키 처리 함수 수정
  const handlePartKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setSearchTerm(partInputValue);
      setPage(0);
    }
  };

  // 부품 추가 함수 (즉시 추가하는 로직으로 변경)
  const handleAddPartToList = (partToAdd) => { // 함수명 변경하여 Form과 통일성 부여
    if (!partToAdd) return;

    setEditableParts(prevParts => {
      const existingPartIndex = prevParts.findIndex(p =>
        (p.part_code === partToAdd.code && p.part_name === partToAdd.name) ||
        (p.id === partToAdd.id) // 기존 부품 ID로도 체크 (새로 추가되는 경우와 구분)
      );

      let categoryFromPart = '기체';
      if (partToAdd.note) { // 간단한 카테고리 추론 예시 (ShipmentForm의 determinePartCategory와 유사하게)
        const note = partToAdd.note.toLowerCase();
        if (note.includes('파츠') || note.includes('part')) categoryFromPart = '파츠';
        else if (note.includes('공임') || note.includes('작업')) categoryFromPart = '공임';
      } else if (partToAdd.code) {
        const code = partToAdd.code.toUpperCase();
        if (code.startsWith('XRBP-') || code.startsWith('NBP-')) categoryFromPart = '파츠';
        else if (code.startsWith('XRBS-') || code.startsWith('NBS-')) categoryFromPart = '공임';
      }
      // 실제 사용 시에는 partToAdd에 category 정보가 있거나, 더 정교한 로직 필요
      categoryFromPart = partToAdd.category || partToAdd.part_category || categoryFromPart;

      if (existingPartIndex >= 0) {
        const updatedParts = [...prevParts];
        updatedParts[existingPartIndex].quantity = (updatedParts[existingPartIndex].quantity || 0) + 1;
        updatedParts[existingPartIndex].total_price = (updatedParts[existingPartIndex].price || 0) * updatedParts[existingPartIndex].quantity;
        return updatedParts;
      } else {
        const newPartEntry = {
          id: Date.now(), // 새 부품은 임시 ID 사용
          shipment_id: id,
          part_name: partToAdd.name,
          part_code: partToAdd.code,
          part_category: categoryFromPart,
          quantity: 1,
          price: partToAdd.price || 0,
          total_price: (partToAdd.price || 0) * 1,
          // created_at: new Date().toISOString() // 저장 시점에 생성되므로 여기서 불필요
        };
        return [...prevParts, newPartEntry];
      }
    });

    setSnackbar({
      open: true,
      message: `${partToAdd.name} 추가됨 (또는 수량 증가)`,
      severity: 'success'
    });
    // 다이얼로그는 닫지 않음. selectedPart, partQuantity, modifiedPrice 관련 상태 초기화 불필요
  };

  // 제품 정보 테이블(조회용)에서 정렬된 배열 사용
  const sortedParts = [...shipmentParts].sort((a, b) => {
    if ((a.part_category || '기체') === '기체' && (b.part_category || '기체') !== '기체') return -1;
    if ((a.part_category || '기체') !== '기체' && (b.part_category || '기체') === '기체') return 1;
    return 0;
  });
  // 제품 정보 테이블(수정모드)에서 정렬된 배열 사용
  const sortedEditableParts = [...editableParts].sort((a, b) => {
    if ((a.part_category || '기체') === '기체' && (b.part_category || '기체') !== '기체') return -1;
    if ((a.part_category || '기체') !== '기체' && (b.part_category || '기체') === '기체') return 1;
    return 0;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!shipmentData) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" color="error" align="center">
          출고 정보를 찾을 수 없습니다.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
            목록으로 돌아가기
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
          목록으로
        </Button>
        <Box>
          {isEditing ? (
            <>
              <Button
                variant="outlined"
                onClick={handleCancelEdit}
                sx={{ mr: 1 }}
                disabled={saving}
              >
                취소
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveChanges}
                disabled={saving}
              >
                {saving ? '저장 중...' : '변경사항 저장'}
              </Button>
            </>
          ) : (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={isInspectionEnabled}
                    onChange={(e) => setIsInspectionEnabled(e.target.checked)}
                    color="secondary"
                  />
                }
                label="검수과정 사용"
                sx={{ mr: 2 }}
              />
              {isInspectionEnabled && (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleAddToPendingOutbounds}
                  disabled={addingToQueue || shipmentData.status !== '준비중'}
                  sx={{ mr: 1, bgcolor: '#9c27b0', '&:hover': { bgcolor: '#7b1fa2' } }}
                >
                  검수 대기열 등록
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleOpenConfirmDialog}
                disabled={['부품준비', '검수완료', '출고대기', '출고완료'].includes(shipmentData.status) && !isMaster}
                sx={{ mr: 1 }}
                title={['부품준비', '검수완료', '출고대기', '출고완료'].includes(shipmentData.status) && !isMaster ? "검수가 진행된 건은 삭제할 수 없습니다." : ""}
              >
                삭제
              </Button>
              <Button
                variant="outlined"
                startIcon={<ReceiptIcon />}
                onClick={handlePrintEstimate}
                sx={{ mr: 1 }}
              >
                견적서
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ mr: 1 }}
              >
                인쇄하기
              </Button>
              <Button variant="contained" startIcon={<EditIcon />} onClick={handleEdit}>
                수정하기
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            출고 상세 정보
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={shipmentData.status}
              color={getStatusColor(shipmentData.status)}
              sx={{ fontSize: '1rem', py: 0.5, height: 'auto' }}
            />
            {!isEditing && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>상태 변경</InputLabel>
                <Select
                  value=""
                  onChange={(e) => handleStatusChange(e.target.value)}
                  label="상태 변경"
                  disabled={saving}
                >
                  {(() => {
                    const STATUS_ORDER = { '준비중': 0, '부품준비': 1, '검수완료': 2, '출고대기': 3, '출고완료': 4 };
                    const currentOrder = STATUS_ORDER[shipmentData.status] ?? 0;
                    const items = ['준비중', '부품준비', '검수완료', '출고대기', '출고완료'];
                    
                    return items.map(status => {
                      // 마스터 권한이 아니면 이전 상태로 되돌릴 수 없음
                      const isDisabled = !isMaster && STATUS_ORDER[status] < currentOrder;
                      return (
                        <MenuItem key={status} value={status} disabled={isDisabled}>
                          {status} {isDisabled ? '(변경 불가)' : ''}
                        </MenuItem>
                      );
                    });
                  })()}
                </Select>
              </FormControl>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>고객 정보</Typography>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                  {shipmentData.customer_name}
                </Typography>
                <Typography variant="body1" sx={{ mb: 0.5 }}>
                  {shipmentData.customer_phone}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {shipmentData.customer_address}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">출고 정보</Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  출고 ID
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'medium', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {shipmentData.id}
                </Typography>
              </Box>
            </Box>
            <Card variant="outlined">
              <CardContent>
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">주문일</Typography>
                    <Typography variant="body1">
                      {shipmentData.order_date ? format(parseISO(shipmentData.order_date), 'yyyy-MM-dd') :
                        shipmentData.created_at ? format(parseISO(shipmentData.created_at), 'yyyy-MM-dd') : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">출고일</Typography>
                    <Typography variant="body1">
                      {shipmentData.shipment_date ? format(parseISO(shipmentData.shipment_date), 'yyyy-MM-dd') : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>판매처</Typography>
                    {(() => {
                      const channelName = getSalesChannel();
                      const channelColor = getChannelColorInfo(channelName);
                      return (
                        <Chip
                          label={channelName}
                          size="small"
                          sx={{
                            backgroundColor: channelColor.bg,
                            color: channelColor.color,
                            borderColor: channelColor.border,
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            height: 24
                          }}
                        />
                      );
                    })()}
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>배송방법</Typography>
                    {(() => {
                      const method = shipmentData.delivery_method;
                      if (!method) return <Typography variant="body1">-</Typography>;
                      const delColor = getDeliveryColorInfo(method);
                      return (
                        <Chip
                          label={method}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '0.8rem',
                            bgcolor: delColor.bg,
                            color: delColor.color,
                            fontWeight: 600
                          }}
                        />
                      );
                    })()}
                  </Grid>
                  <Grid item xs={8}>
                    <Typography variant="body2" color="text.secondary">송장번호</Typography>
                    <Typography variant="body1">
                      {shipmentData.tracking_number || '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            제품 정보
          </Typography>
          {shipmentParts.length > 0 && !isEditing && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleStartEdit}
              size="small"
            >
              가격 수정
            </Button>
          )}
        </Box>

        <Card variant="outlined">
          <CardContent>
            {loading || migrating ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {migrating ? '제품 정보 업데이트 중...' : '로딩 중...'}
                </Typography>
              </Box>
            ) : isEditing ? (
              // 제품 정보 수정 UI
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  제품 정보 수정 모드
                </Typography>

                {sortedEditableParts.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>제품명</TableCell>
                          <TableCell>구분</TableCell>
                          <TableCell align="right">수량</TableCell>
                          <TableCell align="right">단가</TableCell>
                          <TableCell align="right">합계</TableCell>
                          <TableCell align="center">삭제</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedEditableParts.map((part) => (
                          <TableRow key={part.id}>
                            <TableCell>
                              {part.part_name}
                              {part.part_code && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {part.part_code}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={part.part_category || '기체'}
                                size="small"
                                color={getCategoryColor(part.part_category || '기체')}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                size="small"
                                variant="outlined"
                                value={part.quantity || 1}
                                onChange={(e) => handleQuantityChange(part.id, e.target.value)}
                                InputProps={{
                                  inputProps: { min: 1, style: { textAlign: 'right', padding: '4px 8px' } }
                                }}
                                sx={{ width: '70px' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                size="small"
                                variant="outlined"
                                value={part.price || 0}
                                onChange={(e) => handlePriceChange(part.id, e.target.value)}
                                InputProps={{
                                  inputProps: { min: 0, style: { textAlign: 'right', padding: '4px 8px' } },
                                  endAdornment: <InputAdornment position="end">원</InputAdornment>
                                }}
                                sx={{ width: '120px' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {(part.total_price || (part.price * part.quantity)).toLocaleString()}원
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemovePart(part.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold' }}>
                            총 합계
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {sortedEditableParts.reduce((sum, part) => sum + (part.quantity || 0), 0)}개
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            -
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {sortedEditableParts.reduce((sum, part) => sum + (part.total_price || (part.price * part.quantity)), 0).toLocaleString()}원
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography color="text.secondary">제품을 추가하려면 전체 수정 기능을 사용하세요.</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate(`/shipment/edit/${id}`)}
                      sx={{ mt: 2 }}
                    >
                      전체 수정하기
                    </Button>
                  </Box>
                )}
                <Button
                  variant="contained"
                  size="small"
                  sx={{ mb: 2, bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' } }}
                  onClick={handleOpenPartsDialog}
                >
                  부품 추가
                </Button>
              </Box>
            ) : shipmentParts.length > 0 ? (
              <>
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    제품 정보
                  </Typography>
                  <Table size="small" sx={{ minWidth: 650, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 180 }}>제품명</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 120 }}>상품코드</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 100 }}>카테고리</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 80 }}>수량</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 100 }}>단가</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 120 }}>합계</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 100, textAlign: 'center' }}>작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedParts.map((part, idx) => (
                        <TableRow key={idx} sx={part.note && part.note.includes('[반품완료]') ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                          <TableCell>{part.part_name}</TableCell>
                          <TableCell>{part.part_code}</TableCell>
                          <TableCell>
                            <Chip
                              label={part.part_category || '기타'}
                              size="small"
                              color={getCategoryColor(part.part_category || '기타')}
                              variant="filled"
                            />
                          </TableCell>
                          <TableCell>{part.quantity}</TableCell>
                          <TableCell>{part.price?.toLocaleString()}원</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {(part.price * part.quantity)?.toLocaleString()}원
                          </TableCell>
                          <TableCell align="center">
                            {shipmentData?.status === '출고완료' && !(part.note && part.note.includes('[반품완료]')) && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                onClick={() => handleReturnPart(part)}
                                sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: 0.5 }}
                              >
                                반품
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* 총합계 */}
                      <TableRow>
                        <TableCell colSpan={4} align="right" sx={{ fontWeight: 700, bgcolor: '#e9ecef' }}>
                          총 합계
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#e9ecef' }}>
                          {shipmentParts.reduce((sum, p) => p.note && p.note.includes('[반품완료]') ? sum : sum + (p.quantity || 0), 0)}개
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#e9ecef' }}>
                          -
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#e9ecef' }}>
                          {shipmentParts.reduce((sum, p) => p.note && p.note.includes('[반품완료]') ? sum : sum + (p.price * p.quantity), 0).toLocaleString()}원
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              </>
            ) : shipmentData.product_name ? (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  {shipmentData.product_name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {shipmentData.quantity || 1}개
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {(shipmentData.price || 0).toLocaleString()}원
                  </Typography>
                </Box>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => migrateProductData(shipmentData)}
                    disabled={migrating}
                  >
                    {migrating ? '처리 중...' : '제품 정보 업데이트'}
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography color="text.secondary">제품 정보가 없습니다.</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(`/shipment/edit/${id}`)}
                  sx={{ mt: 2 }}
                >
                  제품 정보 추가하기
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Paper>

      {shipmentData.note && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            메모
          </Typography>
          <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body1" whiteSpace="pre-wrap">
              {shipmentData.note.replace(/\[판매처: .*?\]/, '')}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>출고 정보 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            정말로 이 출고 정보를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>취소</Button>
          <Button onClick={handleDeleteShipment} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar 추가 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 부품 추가 다이얼로그 */}
      <Dialog open={openPartsDialog} onClose={() => setOpenPartsDialog(false)}>
        <DialogTitle>부품 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <TextField
              fullWidth
              placeholder="부품명, 코드로 검색"
              value={partInputValue}
              onChange={handlePartInputChange}
              onKeyPress={handlePartKeyPress}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              startIcon={<SearchIcon />}
              sx={{ minWidth: '90px' }}
            >
              검색
            </Button>
          </Box>

          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {isSearching ? '검색 중...' :
                filteredParts.length > 100
                  ? '100개 이상의 결과 (구체적으로 검색해주세요)'
                  : `검색 결과: ${filteredParts.length}개`}
            </Typography>
            <Box>
              <Button
                disabled={page === 0}
                onClick={() => handlePageChange(page - 1)}
                size="small"
              >
                이전
              </Button>
              <Typography variant="caption" sx={{ mx: 1 }}>
                {page + 1} / {Math.max(1, Math.ceil(filteredParts.length / rowsPerPage))}
              </Typography>
              <Button
                disabled={page >= Math.ceil(filteredParts.length / rowsPerPage) - 1}
                onClick={() => handlePageChange(page + 1)}
                size="small"
              >
                다음
              </Button>
            </Box>
          </Box>

          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell align="right">단가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedParts.map((part) => (
                  <TableRow
                    key={part.id}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{part.name}</TableCell>
                    <TableCell>{part.code}</TableCell>
                    <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleAddPartToList(part)}
                      >
                        <AddIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedParts.length === 0 && !isSearching && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      검색 결과가 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {isSearching && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 2 }}>검색 중...</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPartsDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ShipmentDetail;