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
  Select,
  Radio
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
  FilterAlt as FilterAltIcon,
  CloudUpload as CloudUploadIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import ResponsiveTable from '../common/ResponsiveTable';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format, parseISO, isValid } from 'date-fns';
import * as XLSX from 'xlsx';

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
  
  const [dateFilter, setDateFilter] = useState({
    type: 'order_date',
    startDate: '',
    endDate: ''
  });
  
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
    // 브랜드와 검색어, 상태 필터, 날짜 필터 모두 적용
    const filtered = shipments.filter(shipment => {
      const matchesBrand = shipment.brand === selectedBrand;
      const matchesSearch = searchTerm === '' || 
        shipment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || shipment.status === statusFilter;

      // 날짜 필터링 수정
      let matchesDate = true;
      if (dateFilter.startDate || dateFilter.endDate) {
        let targetDate;
        if (dateFilter.type === 'order_date') {
          targetDate = shipment.created_at;
        } else if (dateFilter.type === 'completion_date') {
          targetDate = shipment.shipment_date;
        }

        if (targetDate) {
          const shipmentDate = format(parseISO(targetDate), 'yyyy-MM-dd');
          
          if (dateFilter.startDate && shipmentDate < dateFilter.startDate) {
            matchesDate = false;
          }
          if (dateFilter.endDate && shipmentDate > dateFilter.endDate) {
            matchesDate = false;
          }
        } else {
          matchesDate = false;
        }
      }

      return matchesBrand && matchesSearch && matchesStatus && matchesDate;
    });
    setFilteredShipments(filtered);
    setPage(0);
  }, [searchTerm, statusFilter, shipments, selectedBrand, dateFilter]);

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
      setOpenDialog(false); // 메인 다이얼로그도 닫기
      
      setSnackbar({
        open: true,
        message: '출고 정보가 삭제되었습니다.',
        severity: 'success'
      });

      // 출고 목록 새로고침
      fetchShipments();
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
      
      // selectedParts 배열로 제품 검증
      if (!selectedParts || selectedParts.length === 0) {
        setSnackbar({
          open: true,
          message: '하나 이상의 제품을 추가해주세요.',
          severity: 'warning'
        });
        return;
      }

      // 첫 번째 제품 정보를 기본 필드에 저장
      const mainProduct = selectedParts[0];
      
      // 모든 제품의 총 수량과 총 금액 계산
      const totalQuantity = selectedParts.reduce((sum, product) => sum + (parseInt(product.quantity) || 0), 0);
      const totalPrice = selectedParts.reduce((sum, product) => sum + ((parseFloat(product.price) || 0) * (parseInt(product.quantity) || 0)), 0);
      
      // 판매처 정보를 note에 포함
      const noteWithSalesChannel = `[판매처: ${selectedShipment.sales_channel || '공홈'}] ${selectedShipment.note?.trim() || ''}`;

      // 기존 note에 이미 판매처 정보가 있으면 교체
      let finalNote = noteWithSalesChannel;
      if (selectedShipment.note?.includes('[판매처:')) {
        finalNote = selectedShipment.note.replace(/\[판매처: .*?\]/, `[판매처: ${selectedShipment.sales_channel || '공홈'}]`);
      }

      const shipmentData = {
        brand: selectedBrand,
        shipment_date: selectedShipment.shipment_date,
        status: selectedShipment.status || '준비중',
        customer_name: selectedShipment.customer_name?.trim(),
        customer_phone: selectedShipment.customer_phone?.trim(),
        customer_address: selectedShipment.customer_address?.trim(),
        delivery_method: selectedShipment.delivery_method || '택배',
        tracking_number: selectedShipment.tracking_number?.trim() || '',
        note: finalNote,
        product_name: selectedParts.map(p => p.name).join(', '),
        product_code: mainProduct.code,
        quantity: totalQuantity,
        price: totalPrice,
        updated_at: new Date().toISOString()
      };

      // ID가 있는 경우 (수정)에만 ID 포함
      if (selectedShipment.id) {
        shipmentData.id = selectedShipment.id;
      }

      // 출고 정보 저장
      const { data: savedShipment, error: shipmentError } = await supabase
        .from('shipments')
        .upsert(shipmentData)
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      // 고객 정보 저장 - 먼저 동일한 연락처의 고객이 있는지 확인
      const { data: existingCustomers, error: customerCheckError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', selectedShipment.customer_phone?.trim())
        .eq('brand', selectedShipment.brand)  // 브랜드도 함께 확인
        .limit(1);

      if (customerCheckError) throw customerCheckError;

      // 고객 정보 데이터 준비
      const customerData = {
        brand: selectedShipment.brand,
        name: selectedShipment.customer_name?.trim(),
        phone: selectedShipment.customer_phone?.trim(),
        address: selectedShipment.customer_address?.trim(),
        grade: selectedShipment.brand === 'XRB' ? 'NORMAL' : 'V3',
        note: `출고 관리에서 등록됨 (${new Date().toLocaleDateString()})`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!existingCustomers || existingCustomers.length === 0) {
        // 새 고객 추가
        const { error: addCustomerError } = await supabase
          .from('customers')
          .insert([customerData]);

        if (addCustomerError) throw addCustomerError;

        setSnackbar({
          open: true,
          message: '출고 정보가 저장되었으며, 새로운 고객이 등록되었습니다.',
          severity: 'success'
        });
      } else {
        // 기존 고객 정보 업데이트
        const existingCustomer = existingCustomers[0];
        const updatedCustomerData = {
          name: selectedShipment.customer_name?.trim(),
          address: selectedShipment.customer_address?.trim(),
          note: existingCustomer.note 
            ? `${existingCustomer.note}\n출고 관리에서 업데이트됨 (${new Date().toLocaleDateString()})`
            : `출고 관리에서 업데이트됨 (${new Date().toLocaleDateString()})`,
          updated_at: new Date().toISOString()
        };

        const { error: updateCustomerError } = await supabase
          .from('customers')
          .update(updatedCustomerData)
          .eq('id', existingCustomer.id)
          .eq('brand', selectedShipment.brand);

        if (updateCustomerError) throw updateCustomerError;

        setSnackbar({
          open: true,
          message: '출고 정보가 저장되었으며, 고객 정보가 업데이트되었습니다.',
          severity: 'success'
        });
      }

      setOpenDialog(false);
      setSelectedParts([]);
      fetchShipments();

    } catch (err) {
      console.error('Error saving shipment:', err);
      setSnackbar({
        open: true,
        message: `저장 중 오류가 발생했습니다: ${err.message}`,
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

  const handleExcelDownload = () => {
    try {
      const exportData = shipments.map(shipment => ({
        '고객명': shipment.customer_name,
        '연락처': shipment.customer_phone,
        '주소': shipment.customer_address,
        '제품명': shipment.product_name,
        '수량': shipment.quantity,
        '판매처': shipment.sales_channel,
        '배송방법': shipment.delivery_method,
        '출고일': shipment.shipment_date,
        '메모': shipment.note,
        '상태': shipment.status
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "출고목록");

      const wscols = [
        { wch: 15 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 30 },  // 주소
        { wch: 30 },  // 제품명
        { wch: 8 },   // 수량
        { wch: 10 },  // 판매처
        { wch: 10 },  // 배송방법
        { wch: 12 },  // 출고일
        { wch: 30 },  // 메모
        { wch: 10 }   // 상태
      ];
      worksheet['!cols'] = wscols;

      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      XLSX.writeFile(workbook, `출고목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

    } catch (error) {
      console.error('엑셀 다운로드 중 오류:', error);
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

      // 새 제품 추가
      setSelectedParts(prev => [...prev, newPart]);
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
    { id: 'created_at', label: '주문일자',
      render: (row) => (
        <Typography>
          {isValid(parseISO(row.created_at)) 
            ? format(parseISO(row.created_at), 'yyyy-MM-dd')
            : '-'}
        </Typography>
      )
    },
    { id: 'shipment_date', label: '출고일자',
      render: (row) => (
        <Typography>
          {isValid(parseISO(row.shipment_date)) 
            ? format(parseISO(row.shipment_date), 'yyyy-MM-dd')
            : '-'}
        </Typography>
      )
    },
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
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={row.status}
            color={getStatusColor(row.status)}
            size="small"
          />
          {row.status === '출고완료' && row.shipment_date && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
              {format(parseISO(row.shipment_date), 'yyyy-MM-dd')}
            </Typography>
          )}
        </Box>
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
              배송방법:
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
      [name]: value,
      ...(name === 'status' && value === '출고완료' ? {
        completion_date: new Date().toISOString()
      } : {})
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

  // 엑셀 템플릿 다운로드 함수 수정
  const handleDownloadTemplate = () => {
    try {
      // 템플릿 데이터 생성
      const templateData = [
        {
          '고객명': '홍길동',
          '연락처': '010-1234-5678',
          '주소': '서울시 강남구',
          '제품명': 'X-RIDER 전기자전거',
          '수량': '1',
          '판매처': '공홈',
          '배송방법': '택배',
          '출고일': '2024-03-20',
          '메모': '배송 전 연락 요망'
        }
      ];

      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      // 열 너비 설정
      const wscols = [
        { wch: 15 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 30 },  // 주소
        { wch: 30 },  // 제품명
        { wch: 8 },   // 수량
        { wch: 10 },  // 판매처
        { wch: 10 },  // 배송방법
        { wch: 12 },  // 출고일
        { wch: 30 },  // 메모
      ];
      worksheet['!cols'] = wscols;

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "출고등록템플릿");

      // 파일 다운로드
      XLSX.writeFile(workbook, `출고등록템플릿_${selectedBrand}.xlsx`);

      setSnackbar({
        open: true,
        message: '템플릿이 다운로드되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('템플릿 다운로드 중 오류:', err);
      setSnackbar({
        open: true,
        message: '템플릿 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 엑셀 파일 업로드 처리 함수 수정
  const handleFileUpload = (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const excelData = XLSX.utils.sheet_to_json(worksheet);

          console.log('엑셀 데이터 파싱 결과:', excelData);

          // 데이터 유효성 검사
          const invalidRows = [];
          const validData = excelData.map((row, index) => {
            if (!row['고객명'] || !row['연락처'] || !row['제품명']) {
              invalidRows.push(index + 2);
              return null;
            }

            return {
              brand: selectedBrand,
              customer_name: row['고객명'],
              customer_phone: row['연락처'],
              customer_address: row['주소'] || '',
              product_name: row['제품명'],
              quantity: parseInt(row['수량']) || 1,
              sales_channel: row['판매처'] || '공홈',
              delivery_method: row['배송방법'] || '택배',
              shipment_date: row['출고일'] || new Date().toISOString().split('T')[0],
              note: row['메모'] || '',
              status: '준비중',
              created_at: new Date().toISOString()
            };
          }).filter(item => item !== null);

          if (invalidRows.length > 0) {
            setSnackbar({
              open: true,
              message: `다음 행에 필수 정보가 누락되었습니다: ${invalidRows.join(', ')}`,
              severity: 'warning'
            });
            return;
          }

          // 데이터 일괄 등록
          const { data: insertedData, error } = await supabase
            .from('shipments')
            .insert(validData)
            .select();

          if (error) throw error;

          console.log('등록된 데이터:', insertedData);
          
          setSnackbar({
            open: true,
            message: `${validData.length}건의 출고 정보가 등록되었습니다.`,
            severity: 'success'
          });

          // 다이얼로그 닫기
          setOpenDialog(false);
          
          // 목록 새로고침
          fetchShipments();
        } catch (err) {
          console.error('엑셀 데이터 처리 중 오류:', err);
          throw err;
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('파일 업로드 중 오류:', err);
      setSnackbar({
        open: true,
        message: '파일 업로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
    // 파일 입력 초기화
    event.target.value = '';
  };

  // 프린터 출력 함수 추가
  const handlePrint = () => {
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
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>출고 상세내역</h2>
            <p>출고일자: ${selectedShipment?.shipment_date || '-'}</p>
          </div>
          
          <div class="section">
            <div class="label">고객 정보</div>
            <p>고객명: ${selectedShipment?.customer_name || '-'}</p>
            <p>연락처: ${selectedShipment?.customer_phone || '-'}</p>
            <p>주소: ${selectedShipment?.customer_address || '-'}</p>
          </div>
          
          <div class="section">
            <div class="label">배송 정보</div>
            <p>배송방법: ${selectedShipment?.delivery_method || '-'}</p>
            <p>송장번호: ${selectedShipment?.tracking_number || '-'}</p>
            <p>판매처: ${selectedShipment?.sales_channel || '공홈'}</p>
          </div>
          
          <div class="section">
            <div class="label">제품 정보</div>
            <table>
              <thead>
                <tr>
                  <th>제품명</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                ${selectedParts.map(part => `
                  <tr>
                    <td>${part.name}</td>
                    <td>${part.quantity}</td>
                    <td>${part.price?.toLocaleString()}원</td>
                    <td>${(part.price * part.quantity)?.toLocaleString()}원</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="label">메모</div>
            <p>${selectedShipment?.note || '-'}</p>
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

  // 날짜 필터 초기화 함수 추가
  const resetDateFilter = () => {
    setDateFilter({
      type: 'order_date',
      startDate: '',
      endDate: ''
    });
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
    <Box sx={{ maxWidth: '1800px', width: 'auto', mx: 'auto' }}>
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddShipment}
              sx={{
                bgcolor: '#3182f6',
                '&:hover': { bgcolor: '#1b64da' }
              }}
            >
              신규 등록
            </Button>
            <Tooltip title="출고 목록 다운로드">
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExcelDownload}
              >
                엑셀 다운로드
              </Button>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleDownloadTemplate}
              sx={{ 
                color: '#3182f6',
                borderColor: '#3182f6',
                '&:hover': { 
                  bgcolor: 'rgba(49, 130, 246, 0.04)',
                  borderColor: '#1b64da'
                }
              }}
            >
              엑셀 템플릿
            </Button>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              sx={{ 
                color: '#3182f6',
                borderColor: '#3182f6',
                '&:hover': { 
                  bgcolor: 'rgba(49, 130, 246, 0.04)',
                  borderColor: '#1b64da'
                }
              }}
            >
              엑셀 등록
              <input
                type="file"
                accept=".xlsx, .xls"
                hidden
                onChange={handleFileUpload}
              />
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            sx={{ width: 150 }}
            size="small"
          >
            <MenuItem value="all">전체 상태</MenuItem>
            <MenuItem value="준비중">준비중</MenuItem>
            <MenuItem value="배송중">배송중</MenuItem>
            <MenuItem value="출고완료">출고완료</MenuItem>
          </TextField>

          <TextField
            select
            value={dateFilter.type}
            onChange={(e) => setDateFilter(prev => ({ ...prev, type: e.target.value }))}
            sx={{ width: 150 }}
            size="small"
          >
            <MenuItem value="order_date">주문일자</MenuItem>
            <MenuItem value="completion_date">출고일자</MenuItem>
          </TextField>

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DatePicker
                value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                onChange={(newValue) => {
                  setDateFilter(prev => ({
                    ...prev,
                    startDate: newValue ? format(newValue, 'yyyy-MM-dd') : ''
                  }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    sx={{ width: 150 }}
                  />
                )}
              />
              <Typography variant="body2">~</Typography>
              <DatePicker
                value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                onChange={(newValue) => {
                  setDateFilter(prev => ({
                    ...prev,
                    endDate: newValue ? format(newValue, 'yyyy-MM-dd') : ''
                  }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    sx={{ width: 150 }}
                  />
                )}
              />
              {(dateFilter.startDate || dateFilter.endDate) && (
                <IconButton 
                  size="small" 
                  onClick={resetDateFilter}
                  sx={{ ml: 1 }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </LocalizationProvider>
        </Box>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="고객명, 연락처, 제품명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        {searchTerm && (
          <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
            검색 결과: {filteredShipments.length}건
          </Typography>
        )}
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
                    <MenuItem value="청담매장">청담매장</MenuItem>
                    <MenuItem value="라이클-우리">라이클-우리</MenuItem>
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
              
              {/* 제품 관련 섹션 */}
              <Grid item xs={12}>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleOpenPartsDialog}
                    fullWidth
                  >
                    제품 추가
                  </Button>
                </Box>
                
                {selectedParts.length > 0 && (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>제품명</TableCell>
                          <TableCell align="right">수량</TableCell>
                          <TableCell align="right">가격</TableCell>
                          <TableCell align="right">합계</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedParts.map((part) => (
                          <TableRow key={part.id}>
                            <TableCell>{part.name}</TableCell>
                            <TableCell align="right">{part.quantity}</TableCell>
                            <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                            <TableCell align="right">{(part.price * part.quantity)?.toLocaleString()}원</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleRemovePart(part.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Grid>
              
              <Grid item xs={12} md={6}>
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
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>배송 방법</InputLabel>
                  <Select
                    name="delivery_method"
                    value={selectedShipment.delivery_method || '택배'}
                    onChange={handleChange}
                    label="배송 방법"
                  >
                    <MenuItem value="택배">택배</MenuItem>
                    <MenuItem value="방문수령">방문수령</MenuItem>
                    <MenuItem value="퀵-선불">퀵-선불</MenuItem>
                    <MenuItem value="퀵-착불">퀵-착불</MenuItem>
                    <MenuItem value="기타">기타</MenuItem>
                  </Select>
                </FormControl>
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
        <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.5 }}>
          <Box>
            {selectedShipment && selectedShipment.id && (
              <ButtonGroup 
                variant="outlined" 
                size="medium"
                sx={{ 
                  '& .MuiButton-root': {
                    borderRadius: '20px !important',
                    mx: 0.5,
                    px: 2
                  }
                }}
              >
                <Button
                  onClick={() => handleChange({ target: { name: 'status', value: '준비중' } })}
                  color={selectedShipment.status === '준비중' ? 'info' : 'inherit'}
                  variant={selectedShipment.status === '준비중' ? 'contained' : 'outlined'}
                >
                  준비중
                </Button>
                <Button
                  onClick={() => handleChange({ target: { name: 'status', value: '배송중' } })}
                  color={selectedShipment.status === '배송중' ? 'warning' : 'inherit'}
                  variant={selectedShipment.status === '배송중' ? 'contained' : 'outlined'}
                >
                  배송중
                </Button>
                <Button
                  onClick={() => handleChange({ target: { name: 'status', value: '출고완료' } })}
                  color={selectedShipment.status === '출고완료' ? 'success' : 'inherit'}
                  variant={selectedShipment.status === '출고완료' ? 'contained' : 'outlined'}
                >
                  출고완료
                </Button>
              </ButtonGroup>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setOpenDialog(false)}>취소</Button>
            {selectedShipment && selectedShipment.id && (
              <>
                <Button 
                  onClick={handlePrint}
                  color="primary"
                  startIcon={<PrintIcon />}
                >
                  프린트
                </Button>
                <Button 
                  onClick={() => handleDeleteClick(selectedShipment)}
                  color="error"
                  startIcon={<DeleteIcon />}
                >
                  삭제
                </Button>
              </>
            )}
            <Button onClick={handleSave} variant="contained" color="primary" disabled={!selectedShipment}>
              저장
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      
      {/* 제품 선택 다이얼로그 */}
      <Dialog open={openPartsDialog} onClose={handleClosePartsDialog} maxWidth="md" fullWidth>
        <DialogTitle>제품 선택</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="제품 검색"
              value={partSearchTerm}
              onChange={(e) => setPartSearchTerm(e.target.value)}
              placeholder="제품명 또는 코드로 검색"
              sx={{ mb: 2 }}
            />
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>제품명</TableCell>
                    <TableCell>코드</TableCell>
                    <TableCell align="right">가격</TableCell>
                    <TableCell>선택</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredParts.map((part) => (
                    <TableRow 
                      key={part.id}
                      selected={selectedPart?.id === part.id}
                      hover
                      onClick={() => setSelectedPart(part)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{part.name}</TableCell>
                      <TableCell>{part.code}</TableCell>
                      <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                      <TableCell>
                        <Radio
                          checked={selectedPart?.id === part.id}
                          onChange={() => setSelectedPart(part)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {selectedPart && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="수량"
                  type="number"
                  value={partsQuantity}
                  onChange={(e) => setPartsQuantity(parseInt(e.target.value) || 1)}
                  InputProps={{ inputProps: { min: 1 } }}
                  size="small"
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePartsDialog}>취소</Button>
          <Button 
            onClick={handleAddPart}
            variant="contained" 
            disabled={!selectedPart || partsQuantity < 1}
          >
            추가
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>출고 정보 삭제</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography>
              다음 출고 정보를 삭제하시겠습니까?
            </Typography>
            {selectedShipment && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  고객명: {selectedShipment.customer_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  연락처: {selectedShipment.customer_phone}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  제품: {selectedShipment.product_name}
                </Typography>
              </Box>
            )}
            <Typography color="error" sx={{ mt: 2 }}>
              * 삭제된 정보는 복구할 수 없습니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            variant="contained" 
            color="error"
            startIcon={<DeleteIcon />}
          >
            삭제
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