import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  InputAdornment,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Autocomplete,
  ButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Badge,
  Drawer,
  Toolbar,
  useMediaQuery,
  useTheme,
  Divider,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  DateRange as DateRangeIcon,
  Store as StoreIcon,
  FilterAlt as FilterAltIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import ResponsiveTable from '../common/ResponsiveTable';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO, isValid } from 'date-fns';

function ProductShipment() {
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [shipments, setShipments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [filteredShipments, setFilteredShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [parts, setParts] = useState([]);
  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [filteredParts, setFilteredParts] = useState([]);
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partsQuantity, setPartsQuantity] = useState(1);
  const [selectedParts, setSelectedParts] = useState([]);
  const location = useLocation();
  
  // 추가: 페이지네이션 상태
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // 추가: 정렬 및 필터 상태
  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc'
  });
  
  const [filterConfig, setFilterConfig] = useState({
    dateRange: {
      startDate: null,
      endDate: null
    },
    salesChannels: [],
    searchTerm: '',
    showFilters: false
  });
  
  // 추가: 필터 적용 여부 표시를 위한 상태
  const [activeFilters, setActiveFilters] = useState(0);
  
  // 추가: 판매처 목록
  const [salesChannels, setSalesChannels] = useState([]);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    fetchShipments();
  }, [selectedBrand]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const autoOpen = queryParams.get('autoOpen');
    
    if (autoOpen === 'true') {
      // URL 쿼리 파라미터에서 고객 정보 가져오기
      const name = queryParams.get('name');
      const phone = queryParams.get('phone');
      const address = queryParams.get('address');
      
      // 신규 등록 다이얼로그 열기
      setSelectedParts([]);
      setSelectedShipment({
        brand: selectedBrand,
        shipment_date: new Date().toISOString().split('T')[0],
        status: '준비중',
        sales_channel: '공홈',
        customer_name: name || '',
        customer_phone: phone || '',
        customer_address: address || '',
        delivery_method: '택배',
        tracking_number: '',
        note: '',
        products: []
      });
      
      setOpenDialog(true);
      
      // URL에서 쿼리 파라미터 제거
      window.history.replaceState({}, document.title, '/shipments');
    }
  }, [location, selectedBrand]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('brand', selectedBrand)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setShipments(data);
      
      // 추가: 판매처 목록 추출
      const channels = new Set();
      data.forEach(shipment => {
        let salesChannel = '공홈';
        const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
        if (salesChannelMatch && salesChannelMatch[1]) {
          salesChannel = salesChannelMatch[1];
        } else if (shipment.sales_channel) {
          salesChannel = shipment.sales_channel;
        }
        channels.add(salesChannel);
      });
      setSalesChannels(Array.from(channels));
      
    } catch (error) {
      console.error('Error fetching shipments:', error);
      setSnackbar({
        open: true,
        message: '출고 정보를 불러오는데 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('shipments-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        payload => {
          if (payload.eventType === 'INSERT' && payload.new.brand === selectedBrand) {
            setShipments(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setShipments(prev => prev.map(shipment =>
              shipment.id === payload.new.id ? payload.new : shipment
            ));
          } else if (payload.eventType === 'DELETE') {
            setShipments(prev => prev.filter(shipment =>
              shipment.id !== payload.old.id
            ));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedBrand]);

  useEffect(() => {
    const filtered = shipments.filter(shipment => {
      const matchesBrand = shipment.brand === selectedBrand;
      const matchesSearch =
        shipment.customer_name?.includes(searchTerm) ||
        shipment.customer_phone?.includes(searchTerm) ||
        shipment.product_name?.includes(searchTerm);

      const matchesStatus =
        statusFilter === 'all' || shipment.status === statusFilter;

      return matchesBrand && matchesSearch && matchesStatus;
    });
    setFilteredShipments(filtered);
  }, [searchTerm, statusFilter, shipments, selectedBrand]);

  useEffect(() => {
    fetchParts();
  }, [selectedBrand]);

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', selectedBrand)
        .order('name');
      
      if (error) throw error;
      setParts(data || []);
      setFilteredParts(data || []);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setSnackbar({
        open: true,
        message: '파츠 목록을 불러오는데 실패했습니다.',
        severity: 'error'
      });
    }
  };

  useEffect(() => {
    const filtered = parts.filter(part =>
      part.name?.toLowerCase().includes(partSearchTerm.toLowerCase()) ||
      part.code?.toLowerCase().includes(partSearchTerm.toLowerCase())
    );
    setFilteredParts(filtered);
  }, [partSearchTerm, parts]);

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

  const handleEdit = (shipmentIdOrObject) => {
    const shipment = typeof shipmentIdOrObject === 'object' 
      ? shipmentIdOrObject 
      : shipments.find(s => s.id === shipmentIdOrObject);
    
    if (!shipment) {
      console.error(`Shipment not found`);
      setSnackbar({
        open: true,
        message: '출고 정보를 찾을 수 없습니다.',
        severity: 'error'
      });
      return;
    }
    
    // note에서 판매처 정보 추출
    let salesChannel = '공홈';
    const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
    if (salesChannelMatch && salesChannelMatch[1]) {
      salesChannel = salesChannelMatch[1];
    }
    
    // 제품명을 쉼표로 분리하여 여러 제품 정보로 나누기
    const productNames = shipment.product_name.split(',').map(name => name.trim());
    const productParts = [];
    
    // 기본 제품 정보 (첫 번째 제품)
    const mainPart = parts.find(p => p.code === shipment.product_code);
    
    if (productNames.length === 1) {
      // 단일 제품인 경우
      const productInfo = {
        id: mainPart?.id || shipment.product_code,
        brand: shipment.brand,
        code: shipment.product_code,
        name: productNames[0],
        price: mainPart?.price || (shipment.price / shipment.quantity),
        quantity: shipment.quantity,
        totalPrice: shipment.price,
        supply_price: mainPart?.supply_price || 0,
        barcode: mainPart?.barcode || '',
        note: shipment.note || ''
      };
      productParts.push(productInfo);
    } else {
      // 다중 제품인 경우
      productNames.forEach((name, index) => {
        // 제품명으로 parts에서 찾기 
        const matchingPart = parts.find(p => p.name === name);
        
        // 기본 제품 정보 설정
        const partInfo = {
          id: matchingPart?.id || `${shipment.product_code}_${index}`,
          brand: shipment.brand,
          code: matchingPart?.code || (index === 0 ? shipment.product_code : ''),
          name: name,
          price: matchingPart?.price || (shipment.price / shipment.quantity / productNames.length),
          quantity: 1, // 기본값 1로 설정
          totalPrice: matchingPart?.price || (shipment.price / productNames.length),
          supply_price: matchingPart?.supply_price || 0,
          barcode: matchingPart?.barcode || '',
          note: ''
        };
        
        productParts.push(partInfo);
      });
    }
    
    setSelectedParts(productParts);
    setSelectedShipment({
      ...shipment,
      sales_channel: salesChannel, // 추출한 판매처 정보 설정
      products: productParts
    });
    setOpenDialog(true);
  };

  const handleDeleteClick = (shipment) => {
    setSelectedShipment(shipment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', selectedShipment.id);

      if (error) throw error;

      setShipments(prev => prev.filter(s => s.id !== selectedShipment.id));
      setDeleteDialogOpen(false);
      setSnackbar({
        open: true,
        message: '출고 정보가 삭제되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error deleting shipment:', err);
      setSnackbar({
        open: true,
        message: '출고 정보 삭제 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  const handleSave = async () => {
    try {
      // 필수 필드 검증
      const requiredFields = {
        brand: '브랜드',
        shipment_date: '출고일자',
        status: '상태',
        customer_name: '고객명',
        customer_phone: '연락처',
        customer_address: '주소',
        delivery_method: '배송 방법'
      };

      const missingFields = Object.entries(requiredFields)
        .filter(([key]) => !selectedShipment[key])
        .map(([_, label]) => label);

      if (missingFields.length > 0) {
        setSnackbar({
          open: true,
          message: `다음 필드를 입력해주세요: ${missingFields.join(', ')}`,
          severity: 'warning'
        });
        return;
      }
      
      if (!selectedShipment.products || selectedShipment.products.length === 0) {
        setSnackbar({
          open: true,
          message: '최소 하나 이상의 제품을 추가해주세요.',
          severity: 'warning'
        });
        return;
      }

      // 첫 번째 제품 정보를 기본 필드에 저장
      const mainProduct = selectedShipment.products[0];
      
      // 모든 제품의 총 수량과 총 금액 계산
      const totalQuantity = selectedShipment.products.reduce((sum, product) => sum + (parseInt(product.quantity) || 0), 0);
      const totalPrice = selectedShipment.products.reduce((sum, product) => sum + ((parseFloat(product.price) || 0) * (parseInt(product.quantity) || 0)), 0);
      
      // 판매처 정보를 note에 포함
      const noteWithSalesChannel = `[판매처: ${selectedShipment.sales_channel || '공홈'}] ${selectedShipment.note?.trim() || ''}`;

      // 기존 note에 이미 판매처 정보가 있으면 교체
      let finalNote = noteWithSalesChannel;
      if (selectedShipment.note?.includes('[판매처:')) {
        finalNote = selectedShipment.note.replace(/\[판매처: .*?\]/, `[판매처: ${selectedShipment.sales_channel || '공홈'}]`);
      }

      const shipmentData = {
        brand: selectedShipment.brand,
        shipment_date: selectedShipment.shipment_date,
        status: selectedShipment.status || '준비중',
        customer_name: selectedShipment.customer_name?.trim(),
        customer_phone: selectedShipment.customer_phone?.trim(),
        customer_address: selectedShipment.customer_address?.trim(),
        delivery_method: selectedShipment.delivery_method,
        tracking_number: selectedShipment.tracking_number?.trim() || '',
        note: finalNote,
        product_name: selectedShipment.products.map(p => p.name).join(', '),
        product_code: mainProduct.code,
        quantity: totalQuantity,
        price: totalPrice,
        updated_at: new Date().toISOString()
      };

      // ID가 있는 경우 (수정)에만 ID 포함
      if (selectedShipment.id) {
        shipmentData.id = selectedShipment.id;
      }

      console.log('Saving shipment data:', shipmentData);

      // 출고 정보 저장
      const { data, error } = await supabase
        .from('shipments')
        .upsert(shipmentData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // 고객 정보 저장 - 먼저 동일한 연락처의 고객이 있는지 확인
      const { data: existingCustomers, error: customerCheckError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', selectedShipment.customer_phone?.trim())
        .limit(1);

      if (customerCheckError) {
        console.error('Error checking existing customer:', customerCheckError);
        // 고객 정보 저장 실패해도 출고 정보는 저장되었으므로 계속 진행
      } else {
        // 고객 정보 데이터 준비 (brand 필드 제거)
        const customerData = {
          name: selectedShipment.customer_name?.trim(),
          phone: selectedShipment.customer_phone?.trim(),
          address: selectedShipment.customer_address?.trim(),
          grade: 'V3', // 기본 등급 설정
          note: `출고 관리에서 등록됨 (${new Date().toLocaleDateString()})`,
          updated_at: new Date().toISOString()
        };

        // 고객이 존재하지 않으면 새로 추가, 존재하면 업데이트
        if (!existingCustomers || existingCustomers.length === 0) {
          // 새 고객 추가
          const { error: addCustomerError } = await supabase
            .from('customers')
            .insert(customerData);

          if (addCustomerError) {
            console.error('Error adding customer:', addCustomerError);
            setSnackbar({
              open: true,
              message: '출고 정보는 저장되었으나, 고객 정보 등록에 실패했습니다.',
              severity: 'warning'
            });
          } else {
            console.log('New customer added to customer management');
            setSnackbar({
              open: true,
              message: '출고 정보가 저장되었으며, 고객 정보도 등록되었습니다.',
              severity: 'success'
            });
          }
        } else {
          // 기존 고객 정보 업데이트 (이름, 주소, 메모 업데이트)
          const updateData = {
            name: selectedShipment.customer_name?.trim(),
            address: selectedShipment.customer_address?.trim(),
            updated_at: new Date().toISOString()
          };
          
          // 기존 메모가 있으면 보존하고 새 메모 추가
          if (existingCustomers[0].note) {
            updateData.note = `${existingCustomers[0].note}\n출고 관리에서 업데이트됨 (${new Date().toLocaleDateString()})`;
          } else {
            updateData.note = `출고 관리에서 업데이트됨 (${new Date().toLocaleDateString()})`;
          }

          const { error: updateCustomerError } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', existingCustomers[0].id);

          if (updateCustomerError) {
            console.error('Error updating customer:', updateCustomerError);
            setSnackbar({
              open: true,
              message: '출고 정보는 저장되었으나, 고객 정보 업데이트에 실패했습니다.',
              severity: 'warning'
            });
          } else {
            console.log('Existing customer updated in customer management');
            setSnackbar({
              open: true,
              message: '출고 정보가 저장되었으며, 고객 정보도 업데이트되었습니다.',
              severity: 'success'
            });
          }
        }
      }

      setOpenDialog(false);
      setSelectedParts([]);
      fetchShipments();
    } catch (err) {
      console.error('Error saving shipment:', err);
      setSnackbar({
        open: true,
        message: `출고 정보 저장 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류가 발생했습니다.'}`,
        severity: 'error'
      });
    }
  };

  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleAddShipment = () => {
    // localStorage에서 고객 정보 가져오기
    const selectedCustomer = localStorage.getItem('selectedCustomer');
    let customerData = {
      customer_name: '',
      customer_phone: '',
      customer_address: ''
    };
    
    if (selectedCustomer) {
      const parsedData = JSON.parse(selectedCustomer);
      customerData = {
        customer_name: parsedData.name || '',
        customer_phone: parsedData.phone || '',
        customer_address: parsedData.address || ''
      };
      
      // 사용 후 localStorage에서 제거
      localStorage.removeItem('selectedCustomer');
    }
    
    setSelectedParts([]);
    setSelectedShipment({
      brand: selectedBrand,
      shipment_date: new Date().toISOString().split('T')[0],
      status: '준비중',
      sales_channel: '공홈',
      customer_name: customerData.customer_name,
      customer_phone: customerData.customer_phone,
      customer_address: customerData.customer_address,
      delivery_method: '택배',
      tracking_number: '',
      note: '',
      products: []
    });
    setOpenDialog(true);
  };

  const handleDownloadExcel = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('brand', selectedBrand)
        .order('shipment_date', { ascending: false });

      if (error) throw error;

      const exportData = data.map(shipment => ({
        주문일자: shipment.shipment_date || '',
        고객명: shipment.customer_name || '',
        연락처: shipment.customer_phone || '',
        주소: shipment.customer_address || '',
        제품: shipment.product_name || '',
        수량: shipment.quantity || '',
        배송방법: shipment.delivery_method || '',
        '운송장번호/날짜': shipment.tracking_number || '',
        상태: shipment.status || '',
        메모: shipment.note || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "출고목록");

      const wscols = [
        { wch: 12 },  // 주문일자
        { wch: 12 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 40 },  // 주소
        { wch: 20 },  // 제품
        { wch: 8 },   // 수량
        { wch: 12 },  // 배송방법
        { wch: 15 },  // 운송장번호/날짜
        { wch: 10 },  // 상태
        { wch: 30 },  // 메모
      ];
      ws['!cols'] = wscols;

      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      XLSX.writeFile(wb, `출고목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

    } catch (error) {
      console.error('Error downloading excel:', error);
      setSnackbar({
        open: true,
        message: '엑셀 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  const handleOpenPartsDialog = () => {
    setOpenPartsDialog(true);
    setSelectedPart(null);
    setPartsQuantity(1);
  };

  const handleClosePartsDialog = () => {
    setOpenPartsDialog(false);
    setSelectedPart(null);
    setPartsQuantity(1);
  };

  const handleAddPart = () => {
    if (selectedPart && partsQuantity > 0) {
      const newPart = {
        id: selectedPart.id,
        brand: selectedPart.brand,
        code: selectedPart.code,
        name: selectedPart.name,
        supply_price: selectedPart.supply_price,
        price: selectedPart.price,
        barcode: selectedPart.barcode,
        note: selectedPart.note,
        quantity: partsQuantity,
        totalPrice: selectedPart.price * partsQuantity
      };

      // 기존 제품 목록을 유지하면서 새 제품 추가
      const updatedParts = [...selectedParts, newPart];
      setSelectedParts(updatedParts);
      
      // selectedShipment의 products 배열도 업데이트
      setSelectedShipment(prev => ({
        ...prev,
        products: updatedParts
      }));

      handleClosePartsDialog();
    }
  };

  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(p => p.id !== partId));
    setSelectedShipment(prev => ({
      ...prev,
      products: (prev.products || []).filter(p => p.id !== partId)
    }));
  };

  const columns = [
    { id: 'shipment_date', label: '주문일자' },
    { id: 'customer_name', label: '이름',
      render: (row) => (
        <Typography>{row.customer_name}</Typography>
      )
    },
    { id: 'customer_phone', label: '연락처',
      render: (row) => (
        <Typography variant="body2">{row.customer_phone}</Typography>
      )
    },
    { id: 'sales_channel', label: '판매처',
      render: (row) => {
        const salesChannelMatch = row.note?.match(/\[판매처: (.*?)\]/);
        const salesChannel = salesChannelMatch ? salesChannelMatch[1] : '공홈';
        return (
          <Chip
            label={salesChannel}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      }
    },
    { id: 'product_info', label: '제품정보',
      render: (row) => (
        <Box>
          {row.product_name?.split(',').map((name, idx) => (
            <Typography key={idx} sx={{ 
              mb: idx < row.product_name.split(',').length - 1 ? 0.5 : 0,
              fontWeight: idx === 0 ? 'medium' : 'normal' 
            }}>
              {name.trim()}
            </Typography>
          ))}
          <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
            총 {row.quantity}개 / {row.price?.toLocaleString()}원
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {row.product_code}
          </Typography>
        </Box>
      )
    },
    { id: 'delivery_info', label: '배송정보',
      render: (row) => (
        <Box>
          <Typography>{row.delivery_method}</Typography>
          <Typography variant="caption" color="textSecondary">
            {row.tracking_number}
          </Typography>
        </Box>
      )
    },
    { id: 'status', label: '상태',
      render: (row) => (
        <Chip
          label={row.status}
          color={getStatusColor(row.status)}
          size="small"
        />
      )
    },
    { id: 'actions', label: '관리',
      render: (row) => (
        <Box>
          <IconButton size="small" onClick={() => handleEdit(row.id)}>
            <EditIcon />
          </IconButton>
          <IconButton size="small" onClick={() => handleDeleteClick(row)}>
            <DeleteIcon />
          </IconButton>
        </Box>
      )
    }
  ];

  const renderMobileCard = (row) => (
    <Card sx={{ mb: 1 }}>
      <CardContent>
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Typography variant="subtitle1" gutterBottom>
              {row.customer_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {row.customer_phone}
            </Typography>
          </Grid>
          <Grid item xs={6} sx={{ textAlign: 'right' }}>
            <Chip
              label={(() => {
                const salesChannelMatch = row.note?.match(/\[판매처: (.*?)\]/);
                return salesChannelMatch ? salesChannelMatch[1] : '공홈';
              })()}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {isValid(parseISO(row.shipment_date)) 
                ? format(parseISO(row.shipment_date), 'yyyy-MM-dd') 
                : '-'}
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body2">
              {row.product_name} ({row.quantity}개)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.product_code}
            </Typography>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              송장번호:
            </Typography>
            <Typography variant="body2">
              {row.tracking_number || '-'}
            </Typography>
          </Grid>
          
          <Grid item xs={6} sx={{ textAlign: 'right' }}>
            <IconButton size="small" color="primary" onClick={() => handleEdit(row.id)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  // 추가: 정렬 및 필터 적용 효과
  useEffect(() => {
    applyFiltersAndSort();
  }, [shipments, sortConfig, filterConfig]);
  
  // 추가: 활성 필터 개수 계산
  useEffect(() => {
    let count = 0;
    
    if (filterConfig.dateRange.startDate || filterConfig.dateRange.endDate) count++;
    if (filterConfig.salesChannels.length > 0) count++;
    if (filterConfig.searchTerm) count++;
    
    setActiveFilters(count);
  }, [filterConfig]);

  // 추가: 정렬 및 필터 적용 함수
  const applyFiltersAndSort = () => {
    let result = [...shipments];
    
    // 검색어 필터 적용
    if (filterConfig.searchTerm) {
      const searchTerm = filterConfig.searchTerm.toLowerCase();
      result = result.filter(shipment => 
        shipment.customer_name?.toLowerCase().includes(searchTerm) ||
        shipment.product_name?.toLowerCase().includes(searchTerm) ||
        shipment.tracking_number?.toLowerCase().includes(searchTerm) ||
        shipment.note?.toLowerCase().includes(searchTerm)
      );
    }
    
    // 날짜 범위 필터 적용
    if (filterConfig.dateRange.startDate) {
      const startDate = new Date(filterConfig.dateRange.startDate);
      startDate.setHours(0, 0, 0, 0);
      result = result.filter(shipment => {
        const shipmentDate = new Date(shipment.shipment_date);
        return shipmentDate >= startDate;
      });
    }
    
    if (filterConfig.dateRange.endDate) {
      const endDate = new Date(filterConfig.dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(shipment => {
        const shipmentDate = new Date(shipment.shipment_date);
        return shipmentDate <= endDate;
      });
    }
    
    // 판매처 필터 적용
    if (filterConfig.salesChannels.length > 0) {
      result = result.filter(shipment => {
        let salesChannel = '공홈';
        const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
        if (salesChannelMatch && salesChannelMatch[1]) {
          salesChannel = salesChannelMatch[1];
        } else if (shipment.sales_channel) {
          salesChannel = shipment.sales_channel;
        }
        
        return filterConfig.salesChannels.includes(salesChannel);
      });
    }
    
    // 정렬 적용
    if (sortConfig.key) {
      result.sort((a, b) => {
        // 날짜 필드 특별 처리
        if (sortConfig.key === 'shipment_date' || sortConfig.key === 'created_at') {
          const dateA = new Date(a[sortConfig.key] || 0);
          const dateB = new Date(b[sortConfig.key] || 0);
          
          if (sortConfig.direction === 'asc') {
            return dateA - dateB;
          } else {
            return dateB - dateA;
          }
        }
        
        // 판매처 특별 처리
        if (sortConfig.key === 'sales_channel') {
          let salesChannelA = '공홈';
          const salesChannelMatchA = a.note?.match(/\[판매처: (.*?)\]/);
          if (salesChannelMatchA && salesChannelMatchA[1]) {
            salesChannelA = salesChannelMatchA[1];
          } else if (a.sales_channel) {
            salesChannelA = a.sales_channel;
          }
          
          let salesChannelB = '공홈';
          const salesChannelMatchB = b.note?.match(/\[판매처: (.*?)\]/);
          if (salesChannelMatchB && salesChannelMatchB[1]) {
            salesChannelB = salesChannelMatchB[1];
          } else if (b.sales_channel) {
            salesChannelB = b.sales_channel;
          }
          
          if (sortConfig.direction === 'asc') {
            return salesChannelA.localeCompare(salesChannelB);
          } else {
            return salesChannelB.localeCompare(salesChannelA);
          }
        }
        
        // 일반 필드 처리
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredShipments(result);
  };

  // 추가: handleChange 함수 정의
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSelectedShipment(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 추가: handleDateChange 함수 정의
  const handleDateChange = (date) => {
    setSelectedShipment(prev => ({
      ...prev,
      shipment_date: date ? format(date, 'yyyy-MM-dd') : null
    }));
  };

  // 수정: handleDelete 함수 정의 (기존 handleDeleteClick과 handleDeleteConfirm 함수 활용)
  const handleDelete = (id) => {
    const shipment = shipments.find(s => s.id === id);
    if (!shipment) {
      console.error(`Shipment with id ${id} not found`);
      setSnackbar({
        open: true,
        message: '출고 정보를 찾을 수 없습니다.',
        severity: 'error'
      });
      return;
    }
    setSelectedShipment(shipment);
    setDeleteDialogOpen(true);
  };

  // 페이지네이션 핸들러 추가
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4, color: 'error.main' }}>
        에러가 발생했습니다: {error}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Tabs
            value={selectedBrand}
            onChange={handleBrandChange}
          >
            <Tab
              label="X-RIDER"
              value="XRB"
              sx={{ fontWeight: 'bold' }}
            />
            <Tab
              label="NEARBIKE"
              value="NB"
              sx={{ fontWeight: 'bold' }}
            />
          </Tabs>
          <Stack direction="row" spacing={2}>
            <Tooltip title="출고 목록 다운로드">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
              >
                엑셀 다운로드
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              onClick={handleAddShipment}
            >
              신규 등록
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextField
          select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          sx={{ width: 150 }}
        >
          <MenuItem value="all">전체 상태</MenuItem>
          <MenuItem value="준비중">준비중</MenuItem>
          <MenuItem value="배송중">배송중</MenuItem>
          <MenuItem value="출고완료">출고완료</MenuItem>
        </TextField>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
      </Box>

      <ResponsiveTable
        columns={columns}
        data={filteredShipments}
        renderMobileCard={renderMobileCard}
        onRowClick={(id) => handleEdit(id)}
        rowSx={{
          '&:hover': {
            backgroundColor: theme.palette.primary.lighter,
          }
        }}
      />

      {/* 모바일 카드 뷰 */}
      {isMobile && (
        <Box sx={{ mt: 2, display: { xs: 'block', md: 'none' } }}>
          {loading ? (
            <Typography align="center">데이터를 불러오는 중...</Typography>
          ) : filteredShipments.length === 0 ? (
            <Typography align="center">
              {activeFilters > 0 ? '필터 조건에 맞는 출고 정보가 없습니다.' : '등록된 출고 정보가 없습니다.'}
            </Typography>
          ) : (
            filteredShipments
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((shipment) => {
                // 판매처 정보 추출
                let salesChannel = '공홈';
                const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
                if (salesChannelMatch && salesChannelMatch[1]) {
                  salesChannel = salesChannelMatch[1];
                } else if (shipment.sales_channel) {
                  salesChannel = shipment.sales_channel;
                }
                
                return (
                  <Card key={shipment.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Grid container spacing={1}>
                        <Grid item xs={8}>
                          <Typography variant="h6" component="div">
                            {shipment.customer_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {shipment.product_name} ({shipment.quantity}개)
                          </Typography>
                        </Grid>
                        <Grid item xs={4} sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={salesChannel} 
                            size="small" 
                            color={salesChannel === '공홈' ? 'primary' : 'default'}
                          />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {isValid(parseISO(shipment.shipment_date)) 
                              ? format(parseISO(shipment.shipment_date), 'yyyy-MM-dd') 
                              : '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Divider sx={{ my: 1 }} />
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            송장번호:
                          </Typography>
                          <Typography variant="body2">
                            {shipment.tracking_number || '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6} sx={{ textAlign: 'right' }}>
                          <IconButton size="small" color="primary" onClick={() => handleEdit(shipment.id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(shipment.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </Box>
      )}
      
      {/* 출고 정보 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedShipment && selectedShipment.id ? '출고 정보 수정' : '신규 출고 등록'}
        </DialogTitle>
        <DialogContent>
          {selectedShipment && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="고객명"
                  name="customer_name"
                  value={selectedShipment.customer_name || ''}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="연락처"
                  name="customer_phone"
                  value={selectedShipment.customer_phone || ''}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>판매처</InputLabel>
                  <Select
                    name="sales_channel"
                    value={selectedShipment.sales_channel || '공홈'}
                    onChange={handleChange}
                    label="판매처"
                  >
                    <MenuItem value="공홈">공홈</MenuItem>
                    <MenuItem value="스마트스토어">스마트스토어</MenuItem>
                    <MenuItem value="쿠팡">쿠팡</MenuItem>
                    <MenuItem value="11번가">11번가</MenuItem>
                    <MenuItem value="G마켓">G마켓</MenuItem>
                    <MenuItem value="옥션">옥션</MenuItem>
                    <MenuItem value="인터파크">인터파크</MenuItem>
                    <MenuItem value="기타">기타</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="주소"
                  name="customer_address"
                  value={selectedShipment.customer_address || ''}
                  onChange={handleChange}
                  multiline
                  rows={2}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="상품명"
                  name="product_name"
                  value={selectedShipment.product_name || ''}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="수량"
                  name="quantity"
                  type="number"
                  value={selectedShipment.quantity || 1}
                  onChange={handleChange}
                  required
                  InputProps={{ inputProps: { min: 1 } }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                  <DatePicker
                    label="출고일"
                    value={selectedShipment.shipment_date ? new Date(selectedShipment.shipment_date) : null}
                    onChange={handleDateChange}
                    renderInput={(params) => <TextField {...params} fullWidth required />}
                    inputFormat="yyyy-MM-dd"
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="송장번호"
                  name="tracking_number"
                  value={selectedShipment.tracking_number || ''}
                  onChange={handleChange}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="메모"
                  name="note"
                  value={selectedShipment.note || ''}
                  onChange={handleChange}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button onClick={handleSave} variant="contained" color="primary" disabled={!selectedShipment}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ProductShipment; 