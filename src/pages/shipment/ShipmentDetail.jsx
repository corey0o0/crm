import React, { useState, useEffect } from 'react';
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
  Search as SearchIcon
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
  const [partSearchTerm, setPartSearchTerm] = useState('');

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
    try {
      setSaving(true);

      // 부품이 하나도 없는 경우 경고
      if (editableParts.length === 0) {
        setSnackbar({
          open: true,
          message: '제품이 최소 하나 이상 필요합니다.',
          severity: 'warning'
        });
        return;
      }

      // 부품 정보 업데이트
      const { error: deleteError } = await supabase
        .from('shipment_parts')
        .delete()
        .eq('shipment_id', id);

      if (deleteError) throw deleteError;

      // 새 부품 정보 저장
      const partsData = editableParts.map(part => ({
        shipment_id: id,
        part_name: part.part_name,
        part_code: part.part_code || '',
        part_category: part.part_category || '기체',
        quantity: part.quantity || 1,
        price: part.price || 0,
        total_price: part.total_price || part.price * part.quantity,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('shipment_parts')
        .insert(partsData);

      if (insertError) throw insertError;

      // 모든 제품의 총 수량과 총 금액 계산
      const totalQuantity = editableParts.reduce((sum, part) => sum + (parseInt(part.quantity) || 0), 0);
      const totalPrice = editableParts.reduce((sum, part) => sum + ((parseFloat(part.price) || 0) * (parseInt(part.quantity) || 0)), 0);
      
      // 모든 제품명을 쉼표로 구분하여 하나의 문자열로 결합
      const combinedProductName = editableParts.map(p => p.part_name).join(', ');

      // 출고 정보 업데이트
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

      if (updateError) throw updateError;

      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: '제품 정보가 성공적으로 업데이트되었습니다.',
        severity: 'success'
      });

      // 수정 모드 종료 및 데이터 다시 로드
      setIsEditing(false);
      fetchShipmentDetail();
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
    try {
      setLoading(true);
      
      // 부품 정보 먼저 삭제
      await supabase
        .from('shipment_parts')
        .delete()
        .eq('shipment_id', id);
      
      // 출고 정보 삭제
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setSnackbar({
        open: true,
        message: '출고 정보가 삭제되었습니다.',
        severity: 'success'
      });
      
      // 목록 페이지로 이동
      setTimeout(() => {
        navigate('/shipment');
      }, 1000);
      
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

  // 2. 부품 다이얼로그 열 때 한 번만 전체 부품 불러오기
  const handleOpenPartsDialog = async () => {
    if (availableParts.length === 0) {
      const { data, error } = await supabase.from('parts').select('*');
      if (!error) setAvailableParts(data);
    }
    setOpenPartsDialog(true);
    setPartInputValue('');
    setPartSearchTerm('');
    setSelectedPart(null);
    setPartQuantity(1);
    setModifiedPrice('');
  };

  // 3. 부품 검색어 입력 및 엔터 시 검색
  const handlePartInputChange = (e) => setPartInputValue(e.target.value);
  const handlePartKeyPress = (e) => {
    if (e.key === 'Enter') setPartSearchTerm(partInputValue);
  };
  const filteredParts = availableParts.filter(part =>
    part.name?.toLowerCase().includes(partSearchTerm.toLowerCase()) ||
    part.code?.toLowerCase().includes(partSearchTerm.toLowerCase())
  );

  // 4. 부품 선택 및 추가
  const handlePartSelect = (part) => setSelectedPart(part);
  const handleAddPart = () => {
    if (selectedPart && partQuantity > 0) {
      const newPart = {
        id: selectedPart.id,
        part_name: selectedPart.name,
        part_code: selectedPart.code,
        part_category: selectedPart.category || '기체',
        quantity: partQuantity,
        price: modifiedPrice || selectedPart.price || 0,
        total_price: (modifiedPrice || selectedPart.price || 0) * partQuantity,
        created_at: new Date().toISOString()
      };
      setEditableParts(prev => [...prev, newPart]);
      setOpenPartsDialog(false);
      setSelectedPart(null);
      setPartQuantity(1);
      setModifiedPrice('');
    }
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
          <TextField
            fullWidth
            placeholder="부품명, 코드로 검색"
            value={partInputValue}
            onChange={handlePartInputChange}
            onKeyPress={handlePartKeyPress}
            sx={{ mb: 2, mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell align="right">단가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredParts.map((part) => (
                  <TableRow
                    key={part.id}
                    selected={selectedPart?.id === part.id}
                    onClick={() => handlePartSelect(part)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{part.name}</TableCell>
                    <TableCell>{part.code}</TableCell>
                    <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {selectedPart && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <TextField
                type="number"
                label="수량"
                value={partQuantity}
                onChange={(e) => setPartQuantity(Number(e.target.value))}
                sx={{ flex: 1 }}
                InputProps={{ inputProps: { min: 1 } }}
              />
              <TextField
                type="number"
                label="가격"
                value={modifiedPrice || selectedPart.price}
                onChange={(e) => setModifiedPrice(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  inputProps: { min: 0 },
                  startAdornment: <InputAdornment position="start">₩</InputAdornment>
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPartsDialog(false)}>취소</Button>
          <Button onClick={handleAddPart} disabled={!selectedPart}>추가</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ShipmentDetail; 