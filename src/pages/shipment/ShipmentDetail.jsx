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
  DialogActions
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  Edit as EditIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';

function ShipmentDetail() {
  const [loading, setLoading] = useState(true);
  const [shipmentData, setShipmentData] = useState(null);
  const [shipmentParts, setShipmentParts] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editableParts, setEditableParts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

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
  const handleStartEdit = () => {
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
                  ${shipmentParts.map(part => part.part_name).join(', ')}
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

  const getStatusColor = (status) => {
    switch (status) {
      case '준비중':
        return 'info';
      case '출고완료':
        return 'success';
      case '배송중':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case '기체':
        return 'primary';
      case '파츠':
        return 'secondary';
      case '공임':
        return 'success';
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
        const { data, error } = await supabase
          .from('parts')
          .select('*')
          .eq('brand', shipmentData?.brand || 'XRB');
          
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
              <Button 
                variant="outlined" 
                color="error"
                startIcon={<DeleteIcon />} 
                onClick={handleOpenConfirmDialog}
                sx={{ mr: 1 }}
              >
                삭제
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
          <Chip 
            label={shipmentData.status} 
            color={getStatusColor(shipmentData.status)}
            sx={{ fontSize: '1rem', py: 0.5, height: 'auto' }}
          />
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
            <Typography variant="h6" gutterBottom>출고 정보</Typography>
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
                    <Typography variant="body2" color="text.secondary">판매처</Typography>
                    <Typography variant="body1">
                      {getSalesChannel()}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">배송방법</Typography>
                    <Typography variant="body1">
                      {shipmentData.delivery_method || '-'}
                    </Typography>
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
                
                {editableParts.length > 0 ? (
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
                        {editableParts.map((part) => (
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
                          <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>
                            총 합계
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {editableParts.reduce((sum, part) => sum + (part.total_price || (part.price * part.quantity)), 0).toLocaleString()}원
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shipmentParts.map((part, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{part.part_name}</TableCell>
                          <TableCell>{part.part_code}</TableCell>
                          <TableCell>
                            <Chip label={part.part_category || '기타'} size="small" color="primary" variant="outlined" />
                          </TableCell>
                          <TableCell>{part.quantity}</TableCell>
                          <TableCell>{part.price?.toLocaleString()}원</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {(part.price * part.quantity)?.toLocaleString()}원
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* 총합계 */}
                      <TableRow>
                        <TableCell colSpan={5} align="right" sx={{ fontWeight: 700, bgcolor: '#e9ecef' }}>
                          총 합계
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#e9ecef' }}>
                          {shipmentParts.reduce((sum, p) => sum + (p.price * p.quantity), 0).toLocaleString()}원
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