import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  TextField,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Tabs,
  Tab,
  ButtonGroup,
  Tooltip,
  Snackbar,
  Alert,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  TablePagination
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  CloudUpload as CloudUploadIcon,
  Clear as ClearIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';
import dayjs from 'dayjs';

function ShipmentList() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(() => {
    const savedBrand = getCookie('shipment_selectedBrand');
    return savedBrand || 'XRB';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const savedStatus = getCookie('shipment_statusFilter');
    return savedStatus || 'all';
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    const savedSearchTerm = getCookie('shipment_searchTerm');
    return savedSearchTerm || '';
  });
  const [inputValue, setInputValue] = useState(() => {
    const savedSearchTerm = getCookie('shipment_searchTerm');
    return savedSearchTerm || '';
  });
  const [sellerFilter, setSellerFilter] = useState(() => {
    const savedSeller = getCookie('shipment_sellerFilter');
    return savedSeller || 'all';
  });
  const [sellers, setSellers] = useState(['전체']);
  const [dateFilter, setDateFilter] = useState(() => {
    const savedDateFilter = getJSONCookie('shipment_dateFilter');
    return savedDateFilter || {
      type: 'order_date',
      startDate: '',
      endDate: ''
    };
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  
  // 엑셀 업로드 관련 상태 추가
  const [excelUploadDialog, setExcelUploadDialog] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // 마이그레이션 관련 상태 추가
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStats, setMigrationStats] = useState({ 
    total: 0, 
    migrated: 0, 
    skipped: 0, 
    failed: 0,
    split: 0
  });

  // 페이징 상태 추가
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setCookie('shipment_selectedBrand', selectedBrand);
  }, [selectedBrand]);

  useEffect(() => {
    setCookie('shipment_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setCookie('shipment_sellerFilter', sellerFilter);
  }, [sellerFilter]);

  useEffect(() => {
    setCookie('shipment_searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setJSONCookie('shipment_dateFilter', dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    fetchShipments();
  }, [selectedBrand, dateFilter, statusFilter, sellerFilter]);

  useEffect(() => {
    return () => {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/shipment')) {
        removeCookie('shipment_selectedBrand');
        removeCookie('shipment_statusFilter');
        removeCookie('shipment_sellerFilter');
        removeCookie('shipment_searchTerm');
        removeCookie('shipment_dateFilter');
      }
    };
  }, []);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('shipments')
        .select('*')
        .eq('brand', selectedBrand);

      // 날짜 필터 적용
      if (dateFilter.startDate && dateFilter.endDate) {
        const startDate = format(new Date(dateFilter.startDate), 'yyyy-MM-dd 00:00:00');
        const endDate = format(new Date(dateFilter.endDate), 'yyyy-MM-dd 23:59:59');
        
        if (dateFilter.type === 'order_date') {
          query = query
            .gte('order_date', startDate)
            .lte('order_date', endDate);
        } else if (dateFilter.type === 'completion_date') {
          query = query
            .gte('shipment_date', startDate)
            .lte('shipment_date', endDate);
        }
      }

      query = query.order('order_date', { ascending: false });
      const { data, error } = await query;

      if (error) throw error;
      
      // 날짜 기준으로 정렬
      const sortedData = [...(data || [])].sort((a, b) => {
        let dateA, dateB;
        if (dateFilter.type === 'order_date') {
          dateA = a.order_date ? new Date(a.order_date) : new Date(a.created_at || 0);
          dateB = b.order_date ? new Date(b.order_date) : new Date(b.created_at || 0);
        } else if (dateFilter.type === 'completion_date') {
          dateA = a.shipment_date ? new Date(a.shipment_date) : new Date(a.created_at || 0);
          dateB = b.shipment_date ? new Date(b.shipment_date) : new Date(b.created_at || 0);
        } else {
          dateA = new Date(a.created_at || 0);
          dateB = new Date(b.created_at || 0);
        }
        return dateB - dateA;
      });
      
      setShipments(sortedData);
      
      // 판매처 목록 업데이트
      const uniqueSellers = new Set(['전체', '공홈', '청담매장', '라이클-우리', '기타']);
      data.forEach(shipment => {
        const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
        if (salesChannelMatch && salesChannelMatch[1]) {
          uniqueSellers.add(salesChannelMatch[1]);
        }
      });
      setSellers(Array.from(uniqueSellers));
    } catch (error) {
      console.error('Error fetching shipments:', error);
      setSnackbar({
        open: true,
        message: '출고 목록을 불러오는 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // filteredShipments useMemo로 계산
  const filteredShipments = useMemo(() => {
    let filtered = shipments;

    // 검색
    if (searchTerm) {
      filtered = filtered.filter(shipment =>
        shipment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(shipment => shipment.status === statusFilter);
    }

    // 판매처 필터
    if (sellerFilter !== 'all') {
      filtered = filtered.filter(shipment => {
        const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
        const currentSeller = salesChannelMatch ? salesChannelMatch[1] : '공홈';
        return currentSeller === sellerFilter;
      });
    }

    // 날짜 필터 - 메모리에서의 추가 필터링 제거
    // DB 쿼리에서 이미 필터링된 결과만 사용

    // 정렬
    filtered.sort((a, b) => {
      let dateA, dateB;
      if (dateFilter.type === 'order_date') {
        dateA = a.order_date ? new Date(a.order_date) : new Date(0);
        dateB = b.order_date ? new Date(b.order_date) : new Date(0);
      } else if (dateFilter.type === 'completion_date') {
        dateA = a.shipment_date ? new Date(a.shipment_date) : new Date(0);
        dateB = b.shipment_date ? new Date(b.shipment_date) : new Date(0);
      }
      return dateB - dateA;
    });

    return filtered;
  }, [shipments, searchTerm, statusFilter, sellerFilter, dateFilter.type]);

  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleSellerFilterChange = (event) => {
    setSellerFilter(event.target.value);
  };

  const handleSearchInput = (event) => {
    setInputValue(event.target.value);
  };

  const executeSearch = () => {
    setSearchTerm(inputValue);
    fetchShipments();
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      executeSearch();
    }
  };

  const resetDateFilter = () => {
    const resetFilter = {
      type: 'order_date',
      startDate: '',
      endDate: ''
    };
    setDateFilter(resetFilter);
  };

  const handleDateFilterChange = (type, value) => {
    const newDateFilter = { ...dateFilter, [type]: value };
    setDateFilter(newDateFilter);
  };

  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch(period) {
      case 'today':
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        start.setHours(0,0,0,0);
        end.setDate(today.getDate() - 1);
        end.setHours(23,59,59,999);
        break;
      case 'thisWeek':
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        start.setHours(0,0,0,0);
        end = new Date();
        end.setHours(23,59,59,999);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23,59,59,999);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23,59,59,999);
        break;
      default:
        return;
    }
    
    const newDateFilter = {
      ...dateFilter,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
    };
    
    setDateFilter(newDateFilter);
  };

  const handleAddNew = () => {
    navigate('/shipment/new');
  };

  const handleViewDetails = (id) => {
    navigate(`/shipment/${id}`);
  };

  const handleEdit = (id, event) => {
    if (event) {
      event.stopPropagation();
    }
    navigate(`/shipment/edit/${id}`);
  };

  const handleDeleteClick = (shipment, event) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedShipment(shipment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', selectedShipment.id);

      if (error) throw error;
      
      fetchShipments();
      
      setSnackbar({
        open: true,
        message: '출고 정보가 성공적으로 삭제되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('출고 정보 삭제 중 오류:', error);
      setSnackbar({
        open: true,
        message: '출고 정보 삭제 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedShipment(null);
      setLoading(false);
    }
  };

  const handleExcelDownload = () => {
    try {
      const exportData = shipments.map(shipment => ({
        '고객명': shipment.customer_name,
        '연락처': shipment.customer_phone,
        '주소': shipment.customer_address,
        '제품명': shipment.product_name,
        '수량': shipment.quantity,
        '판매처': (() => {
          const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
          return salesChannelMatch ? salesChannelMatch[1] : '공홈';
        })(),
        '배송방법': shipment.delivery_method,
        '출고일': shipment.shipment_date,
        '메모': shipment.note,
        '상태': shipment.status
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "출고목록");

      const wscols = [
        { wch: 15 },
        { wch: 15 },
        { wch: 30 },
        { wch: 30 },
        { wch: 8 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 30 },
        { wch: 10 }
      ];
      worksheet['!cols'] = wscols;

      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      XLSX.writeFile(workbook, `출고목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

      setSnackbar({
        open: true,
        message: '엑셀 파일이 다운로드되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('엑셀 다운로드 중 오류:', error);
      setSnackbar({
        open: true,
        message: '엑셀 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
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

  // 엑셀 템플릿 다운로드 함수
  const handleDownloadTemplate = () => {
    try {
      // 템플릿 데이터 생성
      const templateData = [
        {
          '고객명': '홍길동',
          '연락처': '010-1234-5678',
          '주소': '서울시 강남구',
          '제품명': 'X-RIDER 전기자전거',
          '제품코드': 'XRBM-001',
          '수량': '1',
          '가격': '1500000',
          '카테고리': '기체',
          '판매처': '공홈',
          '배송방법': '택배',
          '주문일': '2024-05-01',
          '출고일': '2024-05-05',
          '메모': '배송 전 연락 요망'
        },
        {
          '고객명': '김철수',
          '연락처': '010-9876-5432',
          '주소': '부산시 해운대구',
          '제품명': 'X-RIDER MINI',
          '제품코드': 'XRBM-002',
          '수량': '1',
          '가격': '1200000',
          '카테고리': '기체',
          '판매처': '청담매장',
          '배송방법': '방문수령',
          '주문일': '2024-05-02',
          '출고일': '',
          '메모': '주문확인 완료'
        },
        {
          '고객명': '김철수',
          '연락처': '010-9876-5432',
          '주소': '부산시 해운대구',
          '제품명': '배터리 충전기',
          '제품코드': 'XRBP-001',
          '수량': '1',
          '가격': '50000',
          '카테고리': '파츠',
          '판매처': '청담매장',
          '배송방법': '방문수령',
          '주문일': '2024-05-02',
          '출고일': '',
          '메모': ''
        }
      ];

      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(templateData);

      // 열 너비 설정
      const wscols = [
        { wch: 15 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 30 },  // 주소
        { wch: 25 },  // 제품명
        { wch: 15 },  // 제품코드
        { wch: 8 },   // 수량
        { wch: 12 },  // 가격
        { wch: 10 },  // 카테고리
        { wch: 10 },  // 판매처
        { wch: 10 },  // 배송방법
        { wch: 12 },  // 주문일
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

  // 카테고리 결정 함수 (코드 패턴 기반)
  const determineCategory = (code, name, price) => {
    if (!code) return '기타';
    
    const upperCode = code.toUpperCase();
    
    // 코드 패턴 기반 카테고리 결정
    if (upperCode.startsWith('XRBM-') || upperCode.startsWith('NBM-') || upperCode.includes('BIKE')) {
      return '기체';
    } else if (upperCode.startsWith('XRBP-') || upperCode.startsWith('NBP-') || upperCode.includes('PART')) {
      return '파츠';
    } else if (upperCode.startsWith('XRBS-') || upperCode.startsWith('NBS-') || upperCode.includes('SERVICE')) {
      return '공임';
    }
    
    // 기본값
    return '기타';
  };

  // 엑셀 파일 업로드 핸들러
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setUploadProgress(50);
        
        if (jsonData.length === 0) {
          setSnackbar({
            open: true,
            message: '업로드한 파일에 데이터가 없습니다.',
            severity: 'warning'
          });
          setIsUploading(false);
          return;
        }

        // 프리뷰 데이터 생성 (최대 5개 항목)
        setPreviewData(jsonData.slice(0, 5));
        
        // 전체 데이터 저장
        setUploadedData(jsonData);
        
        setUploadProgress(100);
        setExcelUploadDialog(true);
        setIsUploading(false);
      } catch (error) {
        console.error('엑셀 파일 처리 중 오류:', error);
        setSnackbar({
          open: true,
          message: '엑셀 파일 형식이 올바르지 않습니다.',
          severity: 'error'
        });
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setSnackbar({
        open: true,
        message: '파일 읽기 중 오류가 발생했습니다.',
        severity: 'error'
      });
      setIsUploading(false);
    };

    reader.readAsArrayBuffer(file);
    
    // 파일 input 초기화
    event.target.value = '';
  };

  // 엑셀 데이터 저장 처리
  const handleSaveExcelData = async () => {
    if (uploadedData.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // 중복 확인을 위한 고객 정보별 그룹화
      const customerGroups = {};
      uploadedData.forEach((item, index) => {
        const customer = `${item['고객명'] || ''}/${item['연락처'] || ''}/${item['주문일'] || ''}`;
        if (!customerGroups[customer]) {
          customerGroups[customer] = {
            customer: {
              name: item['고객명'],
              phone: item['연락처'],
              address: item['주소'] || ''
            },
            orderDate: item['주문일'] || new Date().toISOString().split('T')[0],
            shipmentDate: item['출고일'] || '',
            note: item['메모'] || '',
            salesChannel: item['판매처'] || '공홈',
            deliveryMethod: item['배송방법'] || '택배',
            status: item['출고일'] ? '출고완료' : '준비중',
            products: []
          };
        }
        
        // 제품 정보 추가
        customerGroups[customer].products.push({
          name: item['제품명'],
          code: item['제품코드'] || '',
          quantity: parseInt(item['수량']) || 1,
          price: parseFloat(item['가격']) || 0,
          category: item['카테고리'] || determineCategory(item['제품코드'], item['제품명'], item['가격'])
        });
      });
      
      const totalGroups = Object.keys(customerGroups).length;
      let processedGroups = 0;
      
      // 각 고객 그룹별로 출고 정보 저장
      for (const customer of Object.keys(customerGroups)) {
        const groupData = customerGroups[customer];
        
        // 기본 출고 정보 데이터 준비
        const mainProduct = groupData.products[0]; // 첫 번째 제품을 메인 제품으로 사용
        const totalQuantity = groupData.products.reduce((sum, p) => sum + p.quantity, 0);
        const totalPrice = groupData.products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const productNames = groupData.products.map(p => p.name).join(', ');
        
        // 판매처 정보를 메모에 포함
        const finalNote = `[판매처: ${groupData.salesChannel}] ${groupData.note || ''}`;
        
        // 출고 데이터 생성
        const shipmentData = {
          brand: selectedBrand,
          customer_name: groupData.customer.name,
          customer_phone: groupData.customer.phone,
          customer_address: groupData.customer.address,
          order_date: groupData.orderDate,
          shipment_date: groupData.shipmentDate || null,
          status: groupData.status,
          delivery_method: groupData.deliveryMethod,
          tracking_number: '',
          note: finalNote,
          product_name: productNames,
          product_code: mainProduct.code || '',
          quantity: totalQuantity,
          price: totalPrice,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // 출고 정보 저장
        const { data: savedShipment, error: shipmentError } = await supabase
          .from('shipments')
          .insert([shipmentData])
          .select();
          
        if (shipmentError) {
          console.error('출고 정보 저장 중 오류:', shipmentError);
          continue; // 오류가 있어도 다음 데이터 처리
        }
        
        const shipmentId = savedShipment[0].id;
        
        // 제품별 상세 정보 저장
        const partsData = groupData.products.map(product => ({
          shipment_id: shipmentId,
          part_name: product.name,
          part_code: product.code || '',
          part_category: product.category || '기타',
          quantity: product.quantity,
          price: product.price,
          total_price: product.price * product.quantity,
          created_at: new Date().toISOString()
        }));
        
        try {
          await supabase
            .from('shipment_parts')
            .insert(partsData);
        } catch (partsError) {
          console.error('제품 상세 정보 저장 중 오류:', partsError);
          // 오류가 있어도 진행
        }
        
        processedGroups++;
        setUploadProgress(Math.round((processedGroups / totalGroups) * 100));
      }
      
      // 모든 데이터 처리 완료
      setSnackbar({
        open: true,
        message: `${Object.keys(customerGroups).length}건의 출고 정보가 성공적으로 등록되었습니다.`,
        severity: 'success'
      });
      
      // 데이터 새로고침
      fetchShipments();
      
    } catch (error) {
      console.error('엑셀 데이터 저장 중 오류:', error);
      setSnackbar({
        open: true,
        message: '엑셀 데이터 저장 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setIsUploading(false);
      setExcelUploadDialog(false);
      setUploadedData([]);
      setPreviewData([]);
    }
  };

  // 데이터 마이그레이션 함수
  const handleBulkMigration = async () => {
    try {
      setMigrating(true);
      setMigrationProgress(0);
      setMigrationStats({ total: 0, migrated: 0, skipped: 0, failed: 0, split: 0 });
      
      // 1. 모든 출고 정보 조회
      const { data: allShipments, error } = await supabase
        .from('shipments')
        .select('id, product_name, product_code, quantity, price, brand')
        .eq('brand', selectedBrand);
        
      if (error) throw error;
      
      if (!allShipments || allShipments.length === 0) {
        setSnackbar({
          open: true,
          message: '마이그레이션할 출고 정보가 없습니다.',
          severity: 'info'
        });
        setMigrating(false);
        return;
      }
      
      // 2. 각 출고 정보별로 부품 정보 유무 확인
      const stats = { total: allShipments.length, migrated: 0, skipped: 0, failed: 0, split: 0 };
      setMigrationStats(stats);
      
      for (let i = 0; i < allShipments.length; i++) {
        const shipment = allShipments[i];
        setMigrationProgress(Math.floor((i / allShipments.length) * 100));
        
        // 제품명이 없으면 스킵
        if (!shipment.product_name) {
          stats.skipped++;
          continue;
        }
        
        // 이미 부품 정보가 있는지 확인
        const { data: existingParts, error: partsError } = await supabase
          .from('shipment_parts')
          .select('id')
          .eq('shipment_id', shipment.id);
          
        if (partsError) {
          stats.failed++;
          continue;
        }
        
        // 이미 부품 정보가 있으면 스킵
        if (existingParts && existingParts.length > 0) {
          stats.skipped++;
          continue;
        }
        
        // 제품명이 여러 개인지 확인 (쉼표로 구분)
        const productNames = shipment.product_name.split(',').map(name => name.trim()).filter(name => name);
        
        // 여러 제품으로 구분된 경우
        if (productNames.length > 1) {
          // 여러 파트로 분리해서 등록
          const partsData = [];
          
          // 각 제품별로 처리
          for (let j = 0; j < productNames.length; j++) {
            const productName = productNames[j];
            
            // 카테고리 추정
            let category = '기체'; // 기본값
            
            // 파츠 관리 시스템에서 매칭되는 제품 검색
            let partFromDB = null;
            try {
              const { data: matchingParts } = await supabase
                .from('parts')
                .select('*')
                .eq('brand', shipment.brand)
                .ilike('name', `%${productName}%`)
                .limit(1);
                
              if (matchingParts && matchingParts.length > 0) {
                partFromDB = matchingParts[0];
                
                // 파츠 관리에 설정된 구분 확인
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
                
                // 코드 패턴으로 카테고리 추정
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
              }
            } catch (searchError) {
              console.error('파츠 검색 중 오류:', searchError);
            }
            
            // 가격 계산 - 제품별 가격 정보가 없으면 전체 가격을 균등 분배
            const estimatedPrice = shipment.price ? Math.round(shipment.price / productNames.length) : 0;
            
            // 새 부품 정보 생성
            partsData.push({
              shipment_id: shipment.id,
              part_name: productName,
              part_code: partFromDB?.code || '',
              part_category: category,
              quantity: Math.ceil((shipment.quantity || 1) / productNames.length), // 수량 분배
              price: partFromDB?.price || estimatedPrice,
              total_price: partFromDB?.price 
                ? partFromDB.price * Math.ceil((shipment.quantity || 1) / productNames.length)
                : estimatedPrice * Math.ceil((shipment.quantity || 1) / productNames.length),
              created_at: new Date().toISOString()
            });
          }
          
          // 부품 정보 저장
          try {
            const { error: insertError } = await supabase
              .from('shipment_parts')
              .insert(partsData);
              
            if (insertError) {
              console.error('분리된 제품 정보 저장 중 오류:', insertError);
              stats.failed++;
            } else {
              stats.migrated++;
              stats.split++;
            }
          } catch (insertError) {
            console.error('제품 정보 저장 중 오류:', insertError);
            stats.failed++;
          }
        } else {
          // 단일 제품 - 기존 코드 사용
          // 카테고리 추정
          let category = '기체';
          if (shipment.product_code) {
            const code = shipment.product_code.toUpperCase();
            if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
              category = '파츠';
            } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
              category = '공임';
            }
          }
          
          // 새 부품 정보 생성
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
          const { error: insertError } = await supabase
            .from('shipment_parts')
            .insert([partData]);
            
          if (insertError) {
            stats.failed++;
          } else {
            stats.migrated++;
          }
        }
        
        // 상태 업데이트
        setMigrationStats({...stats});
      }
      
      setMigrationProgress(100);
      
      // 작업 완료 메시지
      setSnackbar({
        open: true,
        message: `마이그레이션 완료: ${stats.migrated}개 성공 (${stats.split}개 제품 분리), ${stats.skipped}개 스킵, ${stats.failed}개 실패`,
        severity: 'success'
      });
      
      // 데이터 새로고침
      fetchShipments();
      
    } catch (error) {
      console.error('Error during bulk migration:', error);
      setSnackbar({
        open: true,
        message: '마이그레이션 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setMigrating(false);
      setTimeout(() => setMigrateDialogOpen(false), 2000);
    }
  };

  // 페이지 변경 핸들러
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '1800px', mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">출고 관리</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleAddNew}
            sx={{
              bgcolor: '#3182f6',
              '&:hover': { bgcolor: '#1b64da' }
            }}
          >
            신규 등록
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExcelDownload}
          >
            엑셀 다운로드
          </Button>
          <Tooltip title="부품 정보가 없는 출고 정보에 대해 일괄적으로 부품 정보를 추가합니다">
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setMigrateDialogOpen(true)}
              disabled={migrating}
            >
              제품 정보 일괄 업데이트
            </Button>
          </Tooltip>
        </Stack>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
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
      </Box>

      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} lg={3}>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>상태</InputLabel>
                <Select
                  value={statusFilter}
                  label="상태"
                  onChange={handleStatusFilterChange}
                >
                  <MenuItem value="all">전체 상태</MenuItem>
                  <MenuItem value="준비중">준비중</MenuItem>
                  <MenuItem value="배송중">배송중</MenuItem>
                  <MenuItem value="출고완료">출고완료</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>판매처</InputLabel>
                <Select
                  value={sellerFilter}
                  label="판매처"
                  onChange={handleSellerFilterChange}
                >
                  <MenuItem value="all">전체 판매처</MenuItem>
                  {sellers.map(seller => (
                    <MenuItem key={seller} value={seller}>{seller}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Grid>
          
          <Grid item xs={12} sm={6} lg={9}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>날짜 유형</InputLabel>
                <Select
                  value={dateFilter.type}
                  label="날짜 유형"
                  onChange={(e) => handleDateFilterChange('type', e.target.value)}
                >
                  <MenuItem value="order_date">주문일자</MenuItem>
                  <MenuItem value="completion_date">출고일자</MenuItem>
                </Select>
              </FormControl>
              
              <ButtonGroup size="small" variant="outlined">
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>
              
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => {
                      handleDateFilterChange('startDate', newValue ? format(newValue, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { width: 120 }
                      }
                    }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => {
                      handleDateFilterChange('endDate', newValue ? format(newValue, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { width: 120 }
                      }
                    }}
                  />
                  {(dateFilter.startDate || dateFilter.endDate) && (
                    <IconButton 
                      size="small" 
                      onClick={resetDateFilter}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </LocalizationProvider>
            </Stack>
          </Grid>
        </Grid>
      </Box>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          placeholder="고객명, 연락처, 제품명으로 검색"
          variant="outlined"
          size="small"
          value={inputValue}
          onChange={handleSearchInput}
          onKeyPress={handleKeyPress}
          sx={{ flexGrow: 1, width: '70%' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button 
          variant="contained" 
          onClick={executeSearch}
          size="small"
        >
          검색
        </Button>
        <Button 
          variant="outlined" 
          onClick={() => {
            setInputValue('');
            setSearchTerm('');
          }}
          size="small"
        >
          초기화
        </Button>
      </Box>
      
      {filteredShipments.length === 0 ? (
        <Typography align="center" sx={{ mt: 3 }}>
          {searchTerm || statusFilter !== 'all' || sellerFilter !== 'all' || dateFilter.startDate || dateFilter.endDate ? 
            '검색 조건에 맞는 출고 정보가 없습니다.' : 
            '등록된 출고 정보가 없습니다.'}
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 650, width: '100%', tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell width="10%">주문일자</TableCell>
                <TableCell width="10%">출고일자</TableCell>
                <TableCell width="10%">고객명</TableCell>
                <TableCell width="12%">연락처</TableCell>
                <TableCell width="20%">제품정보</TableCell>
                <TableCell width="10%">판매처</TableCell>
                <TableCell width="20%">배송정보</TableCell>
                <TableCell width="8%">상태</TableCell>
                <TableCell width="10%">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredShipments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((shipment) => (
                  <TableRow 
                    key={shipment.id}
                    hover
                    onClick={() => handleViewDetails(shipment.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      {shipment.order_date
                        ? dayjs(shipment.order_date).format('YYYY-MM-DD')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {isValid(parseISO(shipment.shipment_date)) 
                        ? format(parseISO(shipment.shipment_date), 'yyyy-MM-dd')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 'bold' }}>
                        {shipment.customer_name}
                      </Typography>
                    </TableCell>
                    <TableCell>{shipment.customer_phone}</TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shipment.product_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {shipment.quantity}개 / {shipment.price?.toLocaleString()}원
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const match = shipment.note?.match(/\[판매처: (.*?)\]/);
                        const salesChannel = match && match[1] ? match[1] : '공홈';
                        return (
                          <Chip
                            label={salesChannel}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Typography>{shipment.delivery_method}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {shipment.tracking_number || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={shipment.status} 
                        color={getStatusColor(shipment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleEdit(shipment.id, e)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="default"
                        sx={{ color: 'grey.500' }}
                        onClick={(e) => handleDeleteClick(shipment, e)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredShipments.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[30, 50, 100]}
            labelRowsPerPage="페이지당 행 수"
          />
        </TableContainer>
      )}
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({...prev, open: false}))}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          출고 정보 삭제
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography id="alert-dialog-description">
              선택한 출고 정보를 삭제하시겠습니까?
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
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained" 
            color="error" 
            autoFocus
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 엑셀 업로드 다이얼로그 */}
      <Dialog
        open={excelUploadDialog}
        onClose={() => !isUploading && setExcelUploadDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>엑셀 데이터 업로드 확인</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom>
              총 {uploadedData.length}개의 항목이 발견되었습니다. 다음 데이터를 업로드하시겠습니까?
            </Typography>
            
            {isUploading && (
              <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                <Typography variant="body2" align="center">
                  데이터 처리 중... {uploadProgress}%
                </Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 10,
                    bgcolor: '#eee',
                    borderRadius: 5,
                    mt: 1,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      bgcolor: '#3182f6',
                      width: `${uploadProgress}%`,
                      transition: 'width 0.3s ease-in-out'
                    }}
                  />
                </Box>
              </Box>
            )}
            
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>미리보기 (최대 5개 항목)</Typography>
            
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>고객명</TableCell>
                    <TableCell>연락처</TableCell>
                    <TableCell>제품명</TableCell>
                    <TableCell>제품코드</TableCell>
                    <TableCell>카테고리</TableCell>
                    <TableCell>수량</TableCell>
                    <TableCell>가격</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row['고객명']}</TableCell>
                      <TableCell>{row['연락처']}</TableCell>
                      <TableCell>{row['제품명']}</TableCell>
                      <TableCell>{row['제품코드'] || '-'}</TableCell>
                      <TableCell>
                        {row['카테고리'] || determineCategory(row['제품코드'], row['제품명'], row['가격'])}
                      </TableCell>
                      <TableCell>{row['수량'] || '1'}</TableCell>
                      <TableCell>{parseInt(row['가격']).toLocaleString() || '0'}원</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  • 같은 고객/주문일/판매처의 항목은 하나의 출고 정보로 그룹화됩니다.<br />
                  • 제품코드가 없는 제품도 등록이 가능하며, 카테고리가 지정되지 않은 경우 '기타'로 분류됩니다.<br />
                  • 출고일이 지정된 항목은 '출고완료' 상태로, 그렇지 않은 항목은 '준비중' 상태로 등록됩니다.
                </Typography>
              </Alert>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setExcelUploadDialog(false)} 
            disabled={isUploading}
          >
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveExcelData} 
            disabled={isUploading || uploadedData.length === 0}
          >
            업로드
          </Button>
        </DialogActions>
      </Dialog>

      {/* 마이그레이션 다이얼로그 */}
      <Dialog
        open={migrateDialogOpen}
        onClose={() => !migrating && setMigrateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>제품 정보 일괄 업데이트</DialogTitle>
        <DialogContent>
          {migrating ? (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography align="center" gutterBottom>
                제품 정보 업데이트 중입니다...
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                  <LinearProgress variant="determinate" value={migrationProgress} />
                </Box>
                <Box sx={{ minWidth: 35 }}>
                  <Typography variant="body2" color="text.secondary">{`${Math.round(migrationProgress)}%`}</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  총 {migrationStats.total}개 중 {migrationStats.migrated + migrationStats.skipped + migrationStats.failed}개 처리됨
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Chip label={`성공: ${migrationStats.migrated}`} color="success" size="small" />
                  <Chip label={`분리: ${migrationStats.split}`} color="secondary" size="small" />
                  <Chip label={`스킵: ${migrationStats.skipped}`} color="info" size="small" />
                  <Chip label={`실패: ${migrationStats.failed}`} color="error" size="small" />
                </Box>
              </Box>
            </Box>
          ) : (
            <>
              <Typography sx={{ mt: 2 }}>
                제품 정보가 없는 모든 출고 내역에 대해 자동으로 제품 정보를 업데이트합니다.
                이 작업은 대량의 데이터를 처리하므로 시간이 소요될 수 있습니다.
              </Typography>
              <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
                진행하시겠습니까?
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setMigrateDialogOpen(false)} 
            disabled={migrating}
          >
            취소
          </Button>
          <Button 
            onClick={handleBulkMigration} 
            variant="contained" 
            color="primary"
            disabled={migrating}
          >
            진행
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ShipmentList; 