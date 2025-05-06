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
  Radio,
  RadioGroup
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
import { getCookie, setCookie, removeCookie, getJSONCookie, setJSONCookie } from '../../utils/cookieUtils';
import { alpha } from '@mui/material/styles';

// 부품 카테고리 정의
const PART_CATEGORIES = ['기체', '파츠', '공임', '기타'];

function ProductShipment() {
  const [selectedBrand, setSelectedBrand] = useState(() => {
    const savedBrand = getCookie('shipment_selectedBrand');
    return savedBrand || 'XRB';
  });
  const [shipments, setShipments] = useState([]);
  const [statusFilter, setStatusFilter] = useState(() => {
    const savedStatus = getCookie('shipment_statusFilter');
    return savedStatus || 'all';
  });
  const [sellerFilter, setSellerFilter] = useState(() => {
    const savedSeller = getCookie('shipment_sellerFilter');
    return savedSeller || 'all';
  });
  const [sellers, setSellers] = useState(['전체']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [filteredShipments, setFilteredShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => {
    const savedSearchTerm = getCookie('shipment_searchTerm');
    return savedSearchTerm || '';
  });
  const [inputValue, setInputValue] = useState(() => {
    const savedSearchTerm = getCookie('shipment_searchTerm');
    return savedSearchTerm || '';
  });
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
  const [partInputValue, setPartInputValue] = useState('');
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
    key: 'order_date',
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
  
  const [dateFilter, setDateFilter] = useState(() => {
    const savedDateFilter = getJSONCookie('shipment_dateFilter');
    return savedDateFilter || {
    type: 'order_date',
    startDate: '',
    endDate: ''
    };
  });
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 기존 state 선언부 아래에 highlightedId state 추가
  const [highlightedId, setHighlightedId] = useState(() => {
    const savedHighlightId = getCookie('shipment_highlightedId');
    return savedHighlightId ? parseInt(savedHighlightId) : null;
  });

  // 하이라이트 ID 저장 effect 추가
  useEffect(() => {
    if (highlightedId) {
      setCookie('shipment_highlightedId', highlightedId.toString());
    } else {
      removeCookie('shipment_highlightedId');
    }
  }, [highlightedId]);

  // cleanup effect에 highlightedId 정리 추가
  useEffect(() => {
    return () => {
      if (window.location.pathname !== '/shipments') {
        removeCookie('shipment_highlightedId');
        // ... 기존 cleanup 코드 ...
      }
    };
  }, []);

  // 상태가 변경될 때마다 쿠키에 저장
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

  // 컴포넌트가 언마운트될 때 쿠키 정리 함수 추가
  useEffect(() => {
    return () => {
      // 페이지를 완전히 벗어날 때(예: 로그아웃)만 쿠키 정리
      if (window.location.pathname !== '/shipments') {
        removeCookie('shipment_selectedBrand');
        removeCookie('shipment_statusFilter');
        removeCookie('shipment_sellerFilter');
        removeCookie('shipment_searchTerm');
        removeCookie('shipment_dateFilter');
      }
    };
  }, []);

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
        .order('order_date', { ascending: false });

      if (error) throw error;

      setShipments(data);
      
      // 판매처 목록 추출 및 설정 (기본 판매처만 포함)
      const uniqueSellers = new Set(['공홈', '청담매장', '라이클-우리', '기타']);
      data.forEach(shipment => {
        const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
        if (salesChannelMatch && salesChannelMatch[1]) {
          uniqueSellers.add(salesChannelMatch[1]);
        }
      });
      setSellers(Array.from(uniqueSellers));

    } catch (error) {
      console.error('Error fetching shipments:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000; // 5초

    const setupRealtimeSubscription = async () => {
      try {
        // 기존 구독이 있다면 제거
        if (window.shipmentSubscription) {
          await window.shipmentSubscription.unsubscribe();
        }

        const channel = supabase
          .channel('shipments-changes')
          .on('postgres_changes',
            { 
              event: '*', 
              schema: 'public', 
              table: 'shipments',
              filter: `brand=eq.${selectedBrand}`
            },
            payload => {
              console.log('Realtime update received:', payload);
              
              try {
                if (payload.eventType === 'INSERT') {
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
              } catch (error) {
                console.error('Error handling realtime update:', error);
              }
            }
          );

        const subscription = await channel.subscribe((status) => {
          console.log('Realtime subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to realtime changes');
            window.shipmentSubscription = channel;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel error occurred');
            retrySubscription();
          }
        });

        return () => {
          if (window.shipmentSubscription) {
            window.shipmentSubscription.unsubscribe();
          }
        };
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
        retrySubscription();
      }
    };

    const retrySubscription = () => {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying subscription (attempt ${retryCount}/${maxRetries})...`);
        setTimeout(setupRealtimeSubscription, retryDelay);
      } else {
        console.error('Max retry attempts reached for realtime subscription');
        setSnackbar({
          open: true,
          message: '실시간 업데이트 연결에 실패했습니다. 페이지를 새로고침해주세요.',
          severity: 'error'
        });
      }
    };

    setupRealtimeSubscription();
  }, [selectedBrand]);

  useEffect(() => {
    // 브랜드와 검색어, 상태 필터, 날짜 필터 모두 적용
    let filtered = shipments.filter(shipment => {
      const matchesBrand = shipment.brand === selectedBrand;
      const matchesSearch = searchTerm === '' || 
        shipment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || shipment.status === statusFilter;

      // 판매처 필터 적용
      const matchesSeller = sellerFilter === 'all' || (() => {
        const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
        const currentSeller = salesChannelMatch ? salesChannelMatch[1] : '공홈';
        return currentSeller === sellerFilter;
      })();

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

      return matchesBrand && matchesSearch && matchesStatus && matchesDate && matchesSeller;
    });

    // 판매처로 정렬
    if (sortConfig.key === 'sales_channel') {
      filtered.sort((a, b) => {
        const getSalesChannel = (shipment) => {
          const match = shipment.note?.match(/\[판매처: (.*?)\]/);
          return match ? match[1] : '공홈';
        };

        const channelA = getSalesChannel(a);
        const channelB = getSalesChannel(b);

        if (sortConfig.direction === 'asc') {
          return channelA.localeCompare(channelB);
        } else {
          return channelB.localeCompare(channelA);
        }
      });
    }
    // 주문일자 또는 출고일자로 정렬
    else if (sortConfig.key === 'order_date' || sortConfig.key === 'shipment_date') {
      filtered.sort((a, b) => {
        let dateA, dateB;
        
        if (sortConfig.key === 'order_date') {
          // 주문일자가 있으면 사용, 없으면 created_at 사용
          dateA = a.order_date ? new Date(a.order_date) : new Date(a.created_at || 0);
          dateB = b.order_date ? new Date(b.order_date) : new Date(b.created_at || 0);
        } else {
          dateA = new Date(a.shipment_date || 0);
          dateB = new Date(b.shipment_date || 0);
        }
        
        if (sortConfig.direction === 'asc') {
          return dateA - dateB;
        } else {
          return dateB - dateA;
        }
      });
    }
    // 기본 정렬
    else if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        
        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    }

    setFilteredShipments(filtered);
    setPage(0);
  }, [searchTerm, statusFilter, sellerFilter, shipments, selectedBrand, dateFilter, sortConfig]);

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

  const handleEdit = async (shipmentIdOrObject) => {
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

    // 선택된 행 하이라이트
    setHighlightedId(shipment.id);
    
    // note에서 판매처 정보 추출
    let salesChannel = '공홈';
    const salesChannelMatch = shipment.note?.match(/\[판매처: (.*?)\]/);
    if (salesChannelMatch && salesChannelMatch[1]) {
      salesChannel = salesChannelMatch[1];
    } else if (shipment.sales_channel) {
      salesChannel = shipment.sales_channel;
    }
    
    // 제품명을 쉼표로 분리하여 여러 제품 정보로 나누기
    const productNames = shipment.product_name.split(',').map(name => name.trim());
    const productParts = [];
    
    // 기본 제품 정보 (첫 번째 제품)
    const mainPart = parts.find(p => p.code === shipment.product_code);
    
    try {
      // shipment_parts 테이블에서 카테고리 정보 및 상세 부품 정보 조회
      const { data: shipmentParts, error: partsError } = await supabase
        .from('shipment_parts')
        .select('*')
        .eq('shipment_id', shipment.id);
      
      if (partsError) {
        console.warn('출고 부품 상세 정보 조회 중 오류:', partsError);
        // 테이블이 없거나 오류가 있으면 기본 정보로 진행
      }
      
      // shipment_parts 테이블에 데이터가 있으면 해당 정보 사용
      if (!partsError && shipmentParts && shipmentParts.length > 0) {
        console.log('출고 부품 상세 정보 조회 결과:', shipmentParts);
        
        // 조회된 부품 정보로 productParts 배열 생성
        shipmentParts.forEach(part => {
          // 조회된 부품과 일치하는 파츠 테이블의 데이터 확인
          const matchingPart = parts.find(p => p.code === part.part_code);
          
          // 기본값 설정
          let category = '기타'; // 기본값을 기타로 변경
          
          // 1. 먼저 파츠 테이블의 note 필드를 확인하여 카테고리 결정 (최우선)
          if (matchingPart && matchingPart.note) {
            const note = matchingPart.note.toLowerCase();
            
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
          
          // 2. 부품 코드로 카테고리 결정 (비고에 정보가 없는 경우)
          // 비고 필드에서 카테고리가 결정되지 않은 경우 (여전히 기본값인 경우)에만 실행
          if (category === '기타' && part.part_code) {
            const code = part.part_code.toUpperCase();
            
            // X-RIDER 코드 분류
            if (code.startsWith('XRBM-')) {
              category = '기체';
            } else if (code.startsWith('XRBP-')) {
              category = '파츠';
            } else if (code.startsWith('XRBS-')) {
              category = '공임';
            } 
            // NEARBIKE 코드 분류
            else if (code.startsWith('NBM-')) {
              category = '기체';
            } else if (code.startsWith('NBP-')) {
              category = '파츠';
            } else if (code.startsWith('NBS-')) {
              category = '공임';
            }
            // 다른 일반적인 코드 패턴 검사
            else if (code.includes('PART') || code.includes('SPARE')) {
              category = '파츠';
            } else if (code.includes('SERVICE')) {
              category = '공임';
            } else if (code.includes('BIKE')) {
              category = '기체';
            }
            // 그 외는 기타로 유지
          }
          
          // 3. 부품명으로 카테고리 결정 (코드로도 결정되지 않은 경우)
          if (category === '기타' && part.part_name) {
            const partName = part.part_name.toLowerCase();
            
            // 명확한 기체 키워드
            const bikeKeywords = ['자전거', '바이크', 'bike', '기체', 'x200', 'x300', 'x400', 'x500'];
            // 명확한 파츠 키워드
            const partsKeywords = ['배터리', '컨트롤러', '브레이크', '타이어', '휠', '바퀴', '시트', '안장', '핸들', '모터', 
                                  '거치대', '스탠드', '페달', '클립', '벨', '체인'];
            // 명확한 공임 키워드
            const serviceKeywords = ['공임', '조립', '수리', '점검', '교체', '설치', '작업', '서비스', '수정', '점검', '정비'];
            
            if (bikeKeywords.some(keyword => partName.includes(keyword))) {
              category = '기체';
            } else if (partsKeywords.some(keyword => partName.includes(keyword))) {
              category = '파츠';
            } else if (serviceKeywords.some(keyword => partName.includes(keyword))) {
              category = '공임';
            }
          }
          
          // 4. 부품 가격으로 추정 (최후의 방법)
          if (category === '기타' && part.price) {
            if (part.price > 500000) {
              // 50만원 초과면 기체일 가능성이 높음
              category = '기체';
            } else if (part.price < 100000) {
              // 10만원 미만이면 파츠일 가능성이 높음
              category = '파츠';
            }
          }
          
          // 5. 기존 part_category 필드 확인 (데이터베이스에 이미 저장된 값)
          if (part.part_category && part.part_category.trim() !== '') {
            // 기존에 지정된 카테고리가 있으면 사용 (기존 데이터 존중)
            category = part.part_category;
          }
          
          const partInfo = {
            id: matchingPart?.id || part.id || `part_${Math.random().toString(36).substr(2, 9)}`,
            brand: shipment.brand,
            code: part.part_code || '',
            name: part.part_name,
            price: part.price || 0,
            quantity: part.quantity || 1,
            totalPrice: part.total_price || part.price * part.quantity,
            supply_price: matchingPart?.supply_price || 0,
            barcode: matchingPart?.barcode || '',
            note: part.note || matchingPart?.note || '',
            category: category
          };
          
          console.log(`카테고리 결정 - ${part.part_name}: ${category} (코드: ${part.part_code}, 가격: ${part.price})`);
          
          productParts.push(partInfo);
        });
      } else {
        // shipment_parts 테이블에 데이터가 없으면 기존 로직으로 처리
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
            note: shipment.note || '',
            category: '기체' // 기본 카테고리 설정
      };
      productParts.push(productInfo);
    } else {
      // 다중 제품인 경우
      productNames.forEach((name, index) => {
        // 제품명으로 parts에서 찾기 
        const matchingPart = parts.find(p => p.name === name);
            
            // 제품명으로 카테고리 추정
            let estimatedCategory = '기체'; // 기본값
            
            // 이름으로 타입 추정
            const partsKeywords = ['배터리', '컨트롤러', '브레이크', '타이어', '휠', '바퀴', '시트', '안장', '핸들', '모터'];
            if (partsKeywords.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()))) {
              estimatedCategory = '파츠';
            } else if (index > 0) {
              // 첫 번째가 아닌 제품은 파츠로 추정
              estimatedCategory = '파츠';
            }
        
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
              note: '',
              category: estimatedCategory
        };
        
        productParts.push(partInfo);
      });
        }
    }
    
    setSelectedParts(productParts);
    setSelectedShipment({
      ...shipment,
      order_date: shipment.order_date || shipment.created_at?.split('T')[0],
      sales_channel: salesChannel,
      products: productParts
    });
    setOpenDialog(true);
      
    } catch (err) {
      console.error('출고 정보 수정 준비 중 오류:', err);
      
      // 에러 발생 시 기본 정보만으로 진행
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
          note: shipment.note || '',
          category: shipment.note ? '기체' : '기타' // note가 있으면 기체, 없으면 기타
        };
        productParts.push(productInfo);
      } else {
        // 다중 제품인 경우 - 간단하게 처리
        productNames.forEach((name, index) => {
          // 제품명으로 카테고리 추정
          let estimatedCategory = '기체'; // 기본값
          
          // 이름으로 타입 추정
          const partsKeywords = ['배터리', '컨트롤러', '브레이크', '타이어', '휠', '바퀴', '시트', '안장', '핸들', '모터'];
          if (partsKeywords.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()))) {
            estimatedCategory = '파츠';
          } else if (index > 0) {
            // 첫 번째가 아닌 제품은 파츠로 추정
            estimatedCategory = '파츠';
          }
          
          const partInfo = {
            id: `${shipment.product_code}_${index}`,
            brand: shipment.brand,
            code: index === 0 ? shipment.product_code : '',
            name: name,
            price: shipment.price / productNames.length,
            quantity: 1,
            totalPrice: shipment.price / productNames.length,
            category: estimatedCategory
          };
          productParts.push(partInfo);
        });
      }
      
      setSelectedParts(productParts);
      setSelectedShipment({
        ...shipment,
        order_date: shipment.order_date || shipment.created_at?.split('T')[0],
        sales_channel: salesChannel,
        products: productParts
      });
      setOpenDialog(true);
    }
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
      
      // 모든 제품명을 쉼표로 구분하여 하나의 문자열로 결합
      const combinedProductName = selectedParts.map(p => p.name).join(', ');
      
      console.log('출고 정보 저장 전 계산:', {
        총_부품_개수: selectedParts.length,
        총_수량: totalQuantity,
        총_금액: totalPrice,
        제품명_목록: combinedProductName,
        각_부품_정보: selectedParts.map(p => ({
          이름: p.name,
          코드: p.code,
          수량: p.quantity,
          단가: p.price,
          합계: p.price * p.quantity
        }))
      });
      
      // 판매처 정보를 note에 포함 - 변수명 변경하여 중복 선언 오류 해결
      const salesChannelNote = `[판매처: ${selectedShipment.sales_channel || '공홈'}] ${selectedShipment.note?.trim() || ''}`;

      // 기존 note에 이미 판매처 정보가 있으면 교체
      let finalNote = salesChannelNote;
      if (selectedShipment.note?.includes('[판매처:')) {
        finalNote = selectedShipment.note.replace(/\[판매처: .*?\]/, `[판매처: ${selectedShipment.sales_channel || '공홈'}]`);
      }

      const shipmentData = {
        brand: selectedBrand,
        order_date: selectedShipment.order_date,
        shipment_date: selectedShipment.shipment_date,
        status: selectedShipment.status || '준비중',
        customer_name: selectedShipment.customer_name?.trim(),
        customer_phone: selectedShipment.customer_phone?.trim(),
        customer_address: selectedShipment.customer_address?.trim(),
        delivery_method: selectedShipment.delivery_method || '택배',
        tracking_number: selectedShipment.tracking_number?.trim() || '',
        note: finalNote,
        product_name: combinedProductName,
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

      // 선택된 부품 정보를 shipment_parts 테이블에 저장
      try {
        // 기존 부품 정보 삭제 (수정 시)
        if (selectedShipment.id) {
          const { error: deletePartsError } = await supabase
            .from('shipment_parts')
            .delete()
            .eq('shipment_id', selectedShipment.id);
          
          if (deletePartsError) {
            console.error('기존 부품 삭제 중 오류:', deletePartsError);
            // 오류가 있지만 계속 진행 (테이블이 없을 수 있음)
          }
        }

        // 선택된 부품들의 코드 목록 추출
        const partCodes = selectedParts
          .map(part => part.code)
          .filter(code => code && code.trim() !== '');
        
        // 파츠 테이블에서 최신 가격 정보 조회
        let partPrices = {};
        if (partCodes.length > 0) {
          const { data: partsData, error: partsError } = await supabase
            .from('parts')
            .select('code, price')
            .in('code', partCodes)
            .eq('brand', selectedBrand);
          
          if (!partsError && partsData) {
            partsData.forEach(part => {
              partPrices[part.code] = part.price;
            });
            console.log('파츠 테이블에서 조회한 가격 정보:', partPrices);
          } else {
            console.warn('파츠 가격 정보 조회 중 오류:', partsError);
          }
        }

        // 새 부품 정보 저장
        const shipmentId = savedShipment.id;
        const partInsertData = selectedParts.map(part => {
          // 파츠 테이블에서 조회한 가격이 있으면 사용하고, 없으면 기존 가격 사용
          const price = part.code && partPrices[part.code] !== undefined 
            ? partPrices[part.code] 
            : part.price || 0;
          
          const quantity = part.quantity || 0;
          const totalPrice = price * quantity;
          
          // 디버깅 로그 추가
          console.log('저장할 부품 정보:', {
            이름: part.name,
            코드: part.code,
            카테고리: part.category || '기체',
            수량: quantity,
            단가: price,
            총액: totalPrice,
            원래단가: part.price,
            파츠DB단가: part.code ? partPrices[part.code] : undefined
          });
          
          return {
            shipment_id: shipmentId,
            part_name: part.name,
            part_code: part.code || '',
            part_category: part.category || '기체', // 카테고리 정보 저장
            quantity: quantity,
            price: price,
            total_price: totalPrice,
            created_at: new Date().toISOString(),
            note: part.note || ''
          };
        });

        if (partInsertData.length > 0) {
          const { error: insertPartsError } = await supabase
            .from('shipment_parts')
            .insert(partInsertData);
          
          if (insertPartsError) {
            console.error('부품 정보 저장 중 오류:', insertPartsError);
            // 테이블이 없는 경우에 대한 특별 처리
            if (insertPartsError.code === '42P01') { // 테이블 없음 에러 코드
              console.warn('shipment_parts 테이블이 없습니다. 테이블 생성이 필요합니다.');
              setSnackbar({
                open: true,
                message: '출고 정보는 저장되었으나, 부품 상세 정보 저장을 위한 테이블이 필요합니다. 관리자에게 문의하세요.',
                severity: 'warning'
              });
            }
            // 부품 정보 저장 실패는 전체 프로세스를 중단시키지 않음
          } else {
            console.log('출고 부품 정보가 저장되었습니다.');
          }
        }
      } catch (partsError) {
        console.error('부품 정보 처리 중 오류:', partsError);
        // 부품 정보 저장 실패는 전체 프로세스를 중단시키지 않음
      }

      // 고객 정보 저장 로직 수정
      try {
        // 고객 정보 데이터 준비
        const customerData = {
          brand: selectedBrand,
          name: selectedShipment.customer_name?.trim(),
          phone: selectedShipment.customer_phone?.trim(),
          address: selectedShipment.customer_address?.trim(),
          grade: selectedBrand === 'XRB' ? 'NORMAL' : 'V3',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // 기존 고객 검색 (전화번호와 브랜드로)
        const { data: existingCustomers, error: customerCheckError } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', customerData.phone)
          .eq('brand', customerData.brand);

        if (customerCheckError) throw customerCheckError;

        if (!existingCustomers || existingCustomers.length === 0) {
          // 새 고객 추가
          const { error: addCustomerError } = await supabase
            .from('customers')
            .insert([{
              ...customerData,
              note: `출고 관리에서 등록됨 (${format(new Date(), 'yyyy-MM-dd')})`
            }]);

          if (addCustomerError) {
            console.error('고객 추가 중 오류:', addCustomerError);
            throw addCustomerError;
          }

          setSnackbar({
            open: true,
            message: '출고 정보가 저장되었으며, 새로운 고객이 등록되었습니다.',
            severity: 'success'
          });
        } else {
          // 기존 고객 정보 업데이트
          const existingCustomer = existingCustomers[0];
          const updatedCustomerData = {
            name: customerData.name,
            address: customerData.address,
            updated_at: new Date().toISOString(),
            note: existingCustomer.note 
              ? `${existingCustomer.note}\n출고 관리에서 업데이트됨 (${format(new Date(), 'yyyy-MM-dd')})`
              : `출고 관리에서 업데이트됨 (${format(new Date(), 'yyyy-MM-dd')})`
          };

          const { error: updateCustomerError } = await supabase
            .from('customers')
            .update(updatedCustomerData)
            .eq('id', existingCustomer.id)
            .eq('brand', customerData.brand);

          if (updateCustomerError) {
            console.error('고객 정보 업데이트 중 오류:', updateCustomerError);
            throw updateCustomerError;
          }

          setSnackbar({
            open: true,
            message: '출고 정보가 저장되었으며, 고객 정보가 업데이트되었습니다.',
            severity: 'success'
          });
        }

        // 저장 성공 후 하이라이트 제거
        setHighlightedId(null);

        setOpenDialog(false);
        setSelectedParts([]);
        fetchShipments();

      } catch (err) {
        console.error('고객 정보 저장 중 오류:', err);
        throw err;
      }

    } catch (err) {
      console.error('Error saving shipment:', err);
      setSnackbar({
        open: true,
        message: `저장 중 오류가 발생했습니다: ${err.message}`,
        severity: 'error'
      });
    }
  };

  // 기존의 handleBrandChange 함수 수정
  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
    setCookie('shipment_selectedBrand', newValue);
  };

  // 기존의 handleStatusFilterChange 함수 수정
  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setCookie('shipment_statusFilter', event.target.value);
  };

  // 기존의 handleSellerFilterChange 함수 수정
  const handleSellerFilterChange = (event) => {
    setSellerFilter(event.target.value);
    setCookie('shipment_sellerFilter', event.target.value);
  };

  // 검색어 변경 핸들러 수정
  const handleSearchInput = (event) => {
    setInputValue(event.target.value);
    // 검색어 입력 시에는 inputValue만 업데이트하고 검색은 실행하지 않음
  };

  // 검색 실행 함수
  const executeSearch = () => {
    setSearchTerm(inputValue);
    setCookie('shipment_searchTerm', inputValue);
  };

  // 엔터키 처리 함수
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      executeSearch();
    }
  };

  // 날짜 필터 초기화 함수 수정
  const resetDateFilter = () => {
    const resetFilter = {
      type: 'order_date',
      startDate: '',
      endDate: ''
    };
    setDateFilter(resetFilter);
    setJSONCookie('shipment_dateFilter', resetFilter);
  };

  // 날짜 필터 변경 핸들러 추가
  const handleDateFilterChange = (type, value) => {
    const newDateFilter = { ...dateFilter, [type]: value };
    setDateFilter(newDateFilter);
    setJSONCookie('shipment_dateFilter', newDateFilter);
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
      order_date: new Date().toISOString().split('T')[0],
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

  const handleOpenPartsDialog = async () => {
    if (parts.length === 0) {
      const { data, error } = await supabase.from('parts').select('*').eq('brand', selectedBrand);
      if (!error) setParts(data);
    }
    setOpenPartsDialog(true);
    setPartInputValue('');
    setPartSearchTerm('');
    setSelectedPart(null);
    setPartsQuantity(1);
    setSelectedPartCategory('기체');
  };

  const handleClosePartsDialog = () => {
    setOpenPartsDialog(false);
    setSelectedPart(null);
    setPartsQuantity(1);
    setPartSearchTerm('');
    setPartInputValue('');
  };

  const handleAddPart = () => {
    if (selectedPart && partsQuantity > 0) {
      console.log('부품 추가 전 정보:', {
        선택된_부품: selectedPart,
        수량: partsQuantity,
        단가: selectedPart.price,
        총액: selectedPart.price * partsQuantity,
        카테고리: selectedPartCategory // 사용자 선택 카테고리
      });
      
      // 파츠 테이블에서 선택된 부품의 최신 정보 확인
      const fetchLatestPriceInfo = async () => {
        if (selectedPart.code) {
          try {
            const { data, error } = await supabase
              .from('parts')
              .select('price, note, code, name')
              .eq('code', selectedPart.code)
              .eq('brand', selectedBrand)
              .single();
            
            if (!error && data) {
              console.log('파츠 테이블에서 조회한 최신 정보:', data);
              
              // 최신 정보를 사용하여 부품 추가
              let estimatedCategory = '기타'; // 기본값을 기타로 변경
              
              // 1. 먼저 note 필드로 카테고리 추정 (최우선)
              if (data.note) {
                const note = data.note.toLowerCase();
                
                if (note.includes('파츠') || note.includes('part') || note.includes('부품')) {
                  estimatedCategory = '파츠';
                } else if (note.includes('공임') || note.includes('작업') || note.includes('서비스')) {
                  estimatedCategory = '공임';
                } else if (note.includes('기타') || note.includes('etc')) {
                  estimatedCategory = '기타';
                } else if (note.includes('기체') || note.includes('바이크') || note.includes('자전거')) {
                  estimatedCategory = '기체';
                }
              }
              
              // 2. 부품 코드로 카테고리 추정 (비고에 정보가 없는 경우)
              // 비고 필드에서 카테고리가 결정되지 않은 경우 (여전히 기본값인 경우)에만 실행
              if (estimatedCategory === '기타' && data.code) {
                const code = data.code.toUpperCase();
                
                // X-RIDER 코드 분류
                if (code.startsWith('XRBM-')) {
                  estimatedCategory = '기체';
                } else if (code.startsWith('XRBP-')) {
                  estimatedCategory = '파츠';
                } else if (code.startsWith('XRBS-')) {
                  estimatedCategory = '공임';
                } 
                // NEARBIKE 코드 분류
                else if (code.startsWith('NBM-')) {
                  estimatedCategory = '기체';
                } else if (code.startsWith('NBP-')) {
                  estimatedCategory = '파츠';
                } else if (code.startsWith('NBS-')) {
                  estimatedCategory = '공임';
                }
                // 다른 일반적인 코드 패턴 검사
                else if (code.includes('PART') || code.includes('SPARE')) {
                  estimatedCategory = '파츠';
                } else if (code.includes('SERVICE')) {
                  estimatedCategory = '공임';
                } else if (code.includes('BIKE')) {
                  estimatedCategory = '기체';
                }
                // 그 외는 기타로 유지
              }
              
              // 3. 부품명으로 카테고리 추정 (코드로도 결정되지 않은 경우)
              if (estimatedCategory === '기타' && data.name) {
                const partName = data.name.toLowerCase();
                
                // 명확한 기체 키워드
                const bikeKeywords = ['자전거', '바이크', 'bike', '기체', 'x200', 'x300', 'x400', 'x500'];
                // 명확한 파츠 키워드
                const partsKeywords = ['배터리', '컨트롤러', '브레이크', '타이어', '휠', '바퀴', '시트', '안장', '핸들', '모터', 
                                      '거치대', '스탠드', '페달', '클립', '벨', '체인'];
                // 명확한 공임 키워드
                const serviceKeywords = ['공임', '조립', '수리', '점검', '교체', '설치', '작업', '서비스', '수정', '점검', '정비'];
                
                if (bikeKeywords.some(keyword => partName.includes(keyword))) {
                  estimatedCategory = '기체';
                } else if (partsKeywords.some(keyword => partName.includes(keyword))) {
                  estimatedCategory = '파츠';
                } else if (serviceKeywords.some(keyword => partName.includes(keyword))) {
                  estimatedCategory = '공임';
                }
              }
              
              // 4. 부품 가격으로 추정 (최후의 방법)
              if (estimatedCategory === '기타' && data.price) {
                if (data.price > 500000) {
                  // 50만원 초과면 기체일 가능성이 높음
                  estimatedCategory = '기체';
                } else if (data.price < 100000) {
                  // 10만원 미만이면 파츠일 가능성이 높음
                  estimatedCategory = '파츠';
                }
              }
              
              // 5. 기존 part_category 필드 확인 (데이터베이스에 이미 저장된 값)
              if (selectedPart.part_category && selectedPart.part_category.trim() !== '') {
                // 기존에 지정된 카테고리가 있으면 사용 (기존 데이터 존중)
                estimatedCategory = selectedPart.part_category;
              }
              
              addPartWithPrice(data.price, data.note, estimatedCategory);
            } else {
              console.log('최신 가격 정보를 찾을 수 없음, 현재 가격 사용');
              addPartWithPrice(selectedPart.price, selectedPart.note, selectedPartCategory || '기타');
            }
          } catch (e) {
            console.error('가격 정보 조회 중 오류:', e);
            addPartWithPrice(selectedPart.price, selectedPart.note, selectedPartCategory || '기타');
          }
        } else {
          // 코드가 없는 경우 현재 가격 사용
          addPartWithPrice(selectedPart.price, selectedPart.note, selectedPartCategory || '기타');
        }
      };
      
      // 지정된 가격으로 부품 추가
      const addPartWithPrice = (price, note, category) => {
      const newPart = {
        id: selectedPart.id,
        brand: selectedPart.brand,
        code: selectedPart.code,
        name: selectedPart.name,
        supply_price: selectedPart.supply_price,
          price: price, // 업데이트된 가격 또는 원래 가격
        barcode: selectedPart.barcode,
          note: note || selectedPart.note || '',
        quantity: partsQuantity,
          totalPrice: price * partsQuantity,
          category: category // 추정 카테고리 또는 사용자 선택 카테고리
      };

        console.log('추가할 부품 정보:', newPart);

      // 새 제품 추가
      setSelectedParts(prev => [...prev, newPart]);
      handleClosePartsDialog();
      };
      
      // 최신 가격 정보 조회 및 부품 추가 실행
      fetchLatestPriceInfo();
    }
  };

  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(p => p.id !== partId));
    setSelectedShipment(prev => ({
      ...prev,
      products: (prev.products || []).filter(p => p.id !== partId)
    }));
  };

  // 파츠 검색어 입력 처리 함수
  const handlePartSearchInput = (event) => {
    setPartInputValue(event.target.value);
    // 검색어 입력 시에는 partInputValue만 업데이트하고 검색은 실행하지 않음
  };

  // 파츠 검색 실행 함수
  const executePartSearch = () => {
    setPartSearchTerm(partInputValue);
  };

  // 파츠 검색 엔터키 처리 함수
  const handlePartKeyPress = (event) => {
    if (event.key === 'Enter') {
      executePartSearch();
    }
  };

  const columns = [
    { id: 'order_date', label: '주문일자',
      render: (row) => (
        <Typography>
          {isValid(parseISO(row.order_date)) 
            ? format(parseISO(row.order_date), 'yyyy-MM-dd')
            : isValid(parseISO(row.created_at))
              ? format(parseISO(row.created_at), 'yyyy-MM-dd')
              : '-'}
        </Typography>
      ),
      sortable: true
    },
    { id: 'shipment_date', label: '출고일자',
      render: (row) => (
        <Typography>
          {isValid(parseISO(row.shipment_date)) 
            ? format(parseISO(row.shipment_date), 'yyyy-MM-dd')
            : '-'}
        </Typography>
      ),
      sortable: true
    },
    { id: 'customer_name', label: '이름',
      render: (row) => (
        <Typography sx={{ fontWeight: 700 }}>{row.customer_name}</Typography>
      ),
      sortable: true
    },
    { id: 'customer_phone', label: '연락처',
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.customer_phone}</Typography>
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
      },
      sortable: true
    },
    { id: 'product_info', label: '제품정보',
      render: (row) => (
        <Box>
          {row.product_name?.split(',').map((name, idx) => (
            <Typography key={idx} sx={{ 
              mb: idx < row.product_name.split(',').length - 1 ? 0.5 : 0
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
    if (sortConfig.key === 'sales_channel') {
      result.sort((a, b) => {
        const getSalesChannel = (shipment) => {
          const match = shipment.note?.match(/\[판매처: (.*?)\]/);
          return match ? match[1] : '공홈';
        };

        const channelA = getSalesChannel(a);
        const channelB = getSalesChannel(b);
          
          if (sortConfig.direction === 'asc') {
          return channelA.localeCompare(channelB);
          } else {
          return channelB.localeCompare(channelA);
          }
      });
    }
    // 주문일자 또는 출고일자로 정렬
    else if (sortConfig.key === 'order_date' || sortConfig.key === 'shipment_date') {
      result.sort((a, b) => {
        let dateA, dateB;
        
        if (sortConfig.key === 'order_date') {
          // 주문일자가 있으면 사용, 없으면 created_at 사용
          dateA = a.order_date ? new Date(a.order_date) : new Date(a.created_at || 0);
          dateB = b.order_date ? new Date(b.order_date) : new Date(b.created_at || 0);
        } else {
          dateA = new Date(a.shipment_date || 0);
          dateB = new Date(b.shipment_date || 0);
          }
          
          if (sortConfig.direction === 'asc') {
          return dateA - dateB;
          } else {
          return dateB - dateA;
          }
      });
    }
    // 기본 정렬
    else if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        
        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
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
          '주문일': '2024-03-19',
          '출고일': '2024-03-20', // 출고일 입력 시 자동으로 출고완료 상태로 처리됨
          '메모': '배송 전 연락 요망'
        },
        {
          '고객명': '김철수',
          '연락처': '010-9876-5432',
          '주소': '부산시 해운대구',
          '제품명': 'X-RIDER MINI',
          '수량': '2',
          '판매처': '청담매장',
          '배송방법': '방문수령',
          '주문일': '2024-03-20',
          '출고일': '', // 출고일 미입력 시 준비중 상태로 처리됨
          '메모': '주문확인 완료'
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
        message: '템플릿이 다운로드되었습니다.\n• 출고일 입력 시 자동으로 출고완료 처리됩니다.\n• 유사한 제품명은 자동으로 매칭됩니다.',
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

  // 비슷한 상품명을 찾는 유틸리티 함수 추가
  const findSimilarProductName = (productName, partsList) => {
    if (!productName || !partsList || partsList.length === 0) return null;
    
    // 정확히 일치하는 상품명이 있는지 먼저 확인
    const exactMatch = partsList.find(
      part => part.name.toLowerCase() === productName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    // 부분 일치하는 상품명 찾기 (상품명이 포함된 경우)
    const partialMatches = partsList.filter(
      part => part.name.toLowerCase().includes(productName.toLowerCase()) || 
              productName.toLowerCase().includes(part.name.toLowerCase())
    );
    
    // 부분 일치하는 상품이 있으면 가장 짧은 이름의 상품 반환 (보통 메인 모델명이 더 짧음)
    if (partialMatches.length > 0) {
      return partialMatches.sort((a, b) => a.name.length - b.name.length)[0];
    }
    
    // 단어 단위 매칭 시도
    const productWords = productName.toLowerCase().split(/\s+|[-_.,]/);
    let bestMatch = null;
    let maxMatchCount = 0;
    
    partsList.forEach(part => {
      const partWords = part.name.toLowerCase().split(/\s+|[-_.,]/);
      let matchCount = 0;
      
      for (const word of productWords) {
        if (word.length < 2) continue; // 너무 짧은 단어는 제외
        
        for (const partWord of partWords) {
          if (partWord.includes(word) || word.includes(partWord)) {
            matchCount++;
            break;
          }
        }
      }
      
      // 매칭 점수가 더 높은 상품 선택
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestMatch = part;
      }
    });
    
    // 일정 수준 이상 매칭되면 반환
    if (maxMatchCount >= 1) {
      return bestMatch;
    }
    
    return null;
  };
  
  const handleFileUpload = (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      // 로딩 표시 스낵바 추가
      setSnackbar({
        open: true,
        message: '엑셀 파일을 처리 중입니다...',
        severity: 'info'
      });

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const excelData = XLSX.utils.sheet_to_json(worksheet);

          console.log('엑셀 데이터 파싱 결과:', excelData);

          if (!excelData || excelData.length === 0) {
            setSnackbar({
              open: true,
              message: '처리할 데이터가 없습니다. 파일 형식과 내용을 확인해주세요.',
              severity: 'warning'
            });
            return;
          }
          
          // 전체 파츠 데이터 로드 (유사 제품명 매칭에 사용)
          const { data: partsData, error: partsError } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', selectedBrand);
          
          if (partsError) {
            console.warn('파츠 데이터 로드 중 오류:', partsError);
          }
          
          const allParts = partsError ? [] : partsData || [];
          console.log(`${allParts.length}개의 파츠 데이터를 로드했습니다.`);

          // 데이터 유효성 검사
          const invalidRows = [];
          const processedData = excelData.map((row, index) => {
            if (!row['고객명'] || !row['연락처'] || !row['제품명']) {
              invalidRows.push(index + 2);
              return null;
            }

            // 현재 날짜
            const currentDate = new Date().toISOString().split('T')[0];
            
            // 주문일 처리 - '주문일' 필드가 있으면 해당 값 사용, 없으면 현재 날짜
            let orderDate = row['주문일'] || currentDate;
            
            // Excel에서 날짜가 숫자로 들어올 경우 변환
            if (typeof orderDate === 'number') {
              const excelDateValue = row['주문일'];
              const jsDate = new Date((excelDateValue - 25569) * 86400 * 1000);
              orderDate = jsDate.toISOString().split('T')[0];
            }

            // 출고일 처리
            let shipmentDate = row['출고일'] || currentDate;
            
            // Excel에서 날짜가 숫자로 들어올 경우 변환
            if (typeof shipmentDate === 'number') {
              const excelDateValue = row['출고일'];
              const jsDate = new Date((excelDateValue - 25569) * 86400 * 1000);
              shipmentDate = jsDate.toISOString().split('T')[0];
            }
            
            // 출고일자가 있는 경우 상태를 '출고완료'로 설정
            const hasCustomShipmentDate = row['출고일'] !== undefined && row['출고일'] !== null;
            const status = hasCustomShipmentDate ? '출고완료' : '준비중';

            // 주요 식별 정보 (고객명, 연락처, 주문일, 출고일)를 키로 사용
            const groupKey = `${row['고객명']}_${row['연락처']}_${orderDate}_${shipmentDate}`;
            
            // 제품 정보 처리 (유사 상품명 매칭)
            const productName = row['제품명'];
            let productCode = '';
            let productPrice = parseFloat(row['가격'] || '0');
            
            // 파츠 데이터에서 유사한 상품명 찾기
            const similarProduct = findSimilarProductName(productName, allParts);
            if (similarProduct) {
              console.log(`상품명 "${productName}"에 유사한 상품을 찾았습니다: "${similarProduct.name}" (${similarProduct.code})`);
              productCode = similarProduct.code || '';
              // 가격이 0이거나 없는 경우에만 상품 가격 사용
              if (!productPrice) {
                productPrice = similarProduct.price || 0;
              }
            }

            return {
              groupKey,
              data: {
              brand: selectedBrand,
                order_date: orderDate,
              customer_name: row['고객명'],
              customer_phone: row['연락처'],
              customer_address: row['주소'] || '',
                product_name: productName,
                product_code: productCode, // 매칭된 제품 코드 설정
              quantity: parseInt(row['수량']) || 1,
                price: productPrice,
              sales_channel: row['판매처'] || '공홈',
              delivery_method: row['배송방법'] || '택배',
                shipment_date: shipmentDate,
                note: row['메모'] ? `[판매처: ${row['판매처'] || '공홈'}] ${row['메모']}` : `[판매처: ${row['판매처'] || '공홈'}]`,
                status: status, // 출고일자 기반으로 상태 설정
              created_at: new Date().toISOString()
              }
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

          // 같은 날짜/고객 정보를 가진 항목 그룹화
          const groupedData = {};
          processedData.forEach(item => {
            if (!groupedData[item.groupKey]) {
              groupedData[item.groupKey] = {
                ...item.data,
                products: [{ 
                  name: item.data.product_name, 
                  code: item.data.product_code, // 코드 정보 추가
                  quantity: item.data.quantity,
                  price: item.data.price
                }]
              };
            } else {
              // 이미 존재하는 그룹에 제품 추가
              groupedData[item.groupKey].products.push({
                name: item.data.product_name,
                code: item.data.product_code, // 코드 정보 추가
                quantity: item.data.quantity,
                price: item.data.price
              });
              
              // 수량 및 가격 갱신
              groupedData[item.groupKey].quantity += item.data.quantity;
              
              // 제품명 결합 (쉼표로 구분)
              groupedData[item.groupKey].product_name += `, ${item.data.product_name}`;
            }
          });

          // 그룹화된 데이터를 배열로 변환
          const validData = Object.values(groupedData);
          
          // 그룹화된 데이터에 대한 합계 가격 계산
          validData.forEach(item => {
            if (item.products) {
              // 각 제품의 가격 * 수량의 합계 계산
              item.price = item.products.reduce((total, product) => {
                return total + (product.price * product.quantity);
              }, 0);
            }
          });

          console.log('그룹화된 데이터:', validData);

          // 데이터 일괄 등록 - products 필드 제거
          const dataToInsert = validData.map(item => {
            // shipments 테이블에 존재하는 필드만 포함
            const { products, ...shipmentData } = item;
            return shipmentData;
          });

          console.log('저장할 데이터:', dataToInsert);

          // 데이터 일괄 등록
          const { data: insertedShipments, error: insertError } = await supabase
            .from('shipments')
            .insert(dataToInsert)
            .select();

          if (insertError) {
            console.error('출고 정보 등록 오류:', insertError);
            throw new Error(`출고 정보 등록 중 오류가 발생했습니다: ${insertError.message || insertError.details || '알 수 없는 오류'}`);
          }

          console.log('등록된 데이터:', insertedShipments);

          // 고객별 그룹화 정보 수집
          const customerGroups = {};
          insertedShipments.forEach(shipment => {
            if (!customerGroups[shipment.customer_name]) {
              customerGroups[shipment.customer_name] = 1;
            } else {
              customerGroups[shipment.customer_name]++;
            }
          });

          // 고객 정보 메시지 생성
          const customerSummary = Object.entries(customerGroups)
            .map(([name, count]) => `${name}(${count}건)`)
            .join(', ');
            
          // 코드 매칭 결과 정보
          const matchedProductCount = processedData.filter(item => item.data.product_code).length;
          const totalProductCount = processedData.length;
          const matchedProductRate = totalProductCount > 0 
            ? Math.round((matchedProductCount / totalProductCount) * 100) 
            : 0;
          const matchingInfo = `제품코드 매칭: ${matchedProductCount}/${totalProductCount}개 (${matchedProductRate}%)`;

          // 제품 상세 정보를 shipment_parts 테이블에 저장
          try {
            const shipmentPartsData = [];
            
            insertedShipments.forEach(shipment => {
              // 해당 출고에 대한 그룹데이터 찾기
              const groupData = validData.find(g => 
                g.customer_name === shipment.customer_name && 
                g.customer_phone === shipment.customer_phone && 
                g.order_date === shipment.order_date
              );
              
              if (groupData && groupData.products) {
                groupData.products.forEach((product, index) => {
                  shipmentPartsData.push({
                    shipment_id: shipment.id,
                    part_name: product.name,
                    part_code: product.code || '',
                    part_category: (index === 0 ? '기체' : '파츠'), // 첫 번째는 기체, 나머지는 파츠로 설정
                    quantity: product.quantity,
                    price: product.price,
                    total_price: product.price * product.quantity,
                    created_at: new Date().toISOString()
                  });
                });
              }
            });
            
            let partsSuccessMessage = '';
            
            if (shipmentPartsData.length > 0) {
              // shipment_parts 테이블에 데이터 삽입
              const { error: partsError } = await supabase
                .from('shipment_parts')
                .insert(shipmentPartsData);
                
              if (partsError) {
                console.warn('부품 상세 정보 저장 중 오류:', partsError);
                // 오류가 있어도 진행 (테이블이 없을 수 있음)
                partsSuccessMessage = ' (부품 상세 정보는 저장하지 못했습니다.)';
              } else {
                partsSuccessMessage = ' (부품 상세 정보도 저장되었습니다.)';
              }
            }
          
          setSnackbar({
            open: true,
              message: `${validData.length}건의 출고 정보가 성공적으로 등록되었습니다.${partsSuccessMessage}\n[고객: ${customerSummary}]\n${matchingInfo}`,
            severity: 'success'
          });

          // 다이얼로그 닫기
          setOpenDialog(false);
          
          // 목록 새로고침
          fetchShipments();
            
          } catch (partsError) {
            console.warn('부품 정보 처리 중 오류:', partsError);
            // 부품 정보 저장 실패는 전체 프로세스를 중단시키지 않음
            setSnackbar({
              open: true,
              message: `${validData.length}건의 출고 정보가 등록되었으나, 부품 상세정보 저장 중 오류가 발생했습니다.\n[고객: ${customerSummary}]\n${matchingInfo}`,
              severity: 'success'
            });
            
            // 목록 새로고침
            fetchShipments();
          }

        } catch (err) {
          console.error('엑셀 데이터 처리 중 오류:', err);
          setSnackbar({
            open: true,
            message: `엑셀 데이터 처리 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`,
            severity: 'error'
          });
        }
      };

      reader.onerror = (err) => {
        console.error('파일 읽기 오류:', err);
        setSnackbar({
          open: true,
          message: '파일을 읽는 중 오류가 발생했습니다.',
          severity: 'error'
        });
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('파일 업로드 중 오류:', err);
      setSnackbar({
        open: true,
        message: `파일 업로드 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`,
        severity: 'error'
      });
    }
    // 파일 입력 초기화
    event.target.value = '';
  };

  // 프린트 함수 수정
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
                  <th>구분</th>
                  <th>수량</th>
                  <th>단가</th>
                  <th>합계</th>
                </tr>
              </thead>
              <tbody>
                ${selectedParts.map(part => `
                  <tr>
                    <td>${part.name}</td>
                    <td><span class="category category-${part.category || '기체'}">${part.category || '기체'}</span></td>
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

  const getRowStyle = (row) => ({
    backgroundColor: 
      row.status === '준비중' ? alpha('#42a5f5', 0.05) : // 연한 파란색
      row.status === '배송중' ? alpha('#ff9800', 0.05) : // 연한 주황색
      row.status === '출고완료' ? alpha('#4caf50', 0.05) : // 연한 녹색
      'transparent',
    borderLeft: 
      row.status === '준비중' ? `4px solid ${alpha('#42a5f5', 0.7)}` : // 파란색
      row.status === '배송중' ? `4px solid ${alpha('#ff9800', 0.7)}` : // 주황색
      row.status === '출고완료' ? `4px solid ${alpha('#4caf50', 0.7)}` : // 녹색
      '4px solid transparent',
  });

  // 정렬 처리 함수 추가
  const handleSortChange = (columnId) => {
    // 이미 같은 컬럼으로 정렬중이면 방향만 전환
    if (sortConfig.key === columnId) {
      setSortConfig({
        ...sortConfig,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // 새로운 컬럼으로 정렬 시 기본 내림차순
      setSortConfig({
        key: columnId,
        direction: 'desc'
      });
    }
  };
  
  // localStorage에서 정렬 설정 불러오기
  useEffect(() => {
    const savedSortConfig = localStorage.getItem('shipment_sortConfig');
    if (savedSortConfig) {
      try {
        setSortConfig(JSON.parse(savedSortConfig));
      } catch (e) {
        console.error('정렬 설정 로드 중 오류:', e);
      }
    }
  }, []);
  
  // 정렬 설정 저장
  useEffect(() => {
    localStorage.setItem('shipment_sortConfig', JSON.stringify(sortConfig));
  }, [sortConfig]);

  // 헤더 아이템 렌더링 함수 (정렬 표시 추가)
  const renderSortableHeader = (column) => {
    if (!column.sortable) {
      return column.label;
    }
    
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => handleSortChange(column.id)}
      >
        {column.label}
        <Box
          component="span"
          sx={{ 
            opacity: sortConfig.key === column.id ? 1 : 0.3,
            ml: 0.5,
            transition: 'transform 0.2s',
            transform: sortConfig.key === column.id && sortConfig.direction === 'asc' 
              ? 'rotate(180deg)'
              : 'none'
          }}
        >
          ▼
        </Box>
      </Box>
    );
  };
  
  // 빠른 날짜 필터 함수 추가
  const handleQuickDateFilter = (period) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch(period) {
      case 'today':
        // 오늘
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        break;
      case 'yesterday':
        // 어제
        start.setDate(today.getDate() - 1);
        start.setHours(0,0,0,0);
        end.setDate(today.getDate() - 1);
        end.setHours(23,59,59,999);
        break;
      case 'thisWeek':
        // 이번 주 (월요일부터 일요일까지)
        const day = today.getDay(); // 0: 일요일, 1: 월요일, ...
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 이번 주 월요일 구하기
        start = new Date(today.setDate(diff));
        start.setHours(0,0,0,0);
        end = new Date();
        end.setHours(23,59,59,999);
        break;
      case 'thisMonth':
        // 이번 달
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23,59,59,999);
        break;
      case 'lastMonth':
        // 지난 달
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
    setJSONCookie('shipment_dateFilter', newDateFilter);
  };

  // 카테고리 상태 추가 (openPartsDialog 함수 위에 추가)
  const [selectedPartCategory, setSelectedPartCategory] = useState('기체');

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
            value={sellerFilter}
            onChange={handleSellerFilterChange}
            sx={{ width: 150 }}
            size="small"
          >
            <MenuItem value="all">전체 판매처</MenuItem>
            {sellers.map((seller) => (
              <MenuItem key={seller} value={seller}>
                {seller}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            value={dateFilter.type}
            onChange={(e) => handleDateFilterChange('type', e.target.value)}
            sx={{ width: 150 }}
            size="small"
          >
            <MenuItem value="order_date">주문일자</MenuItem>
            <MenuItem value="completion_date">출고일자</MenuItem>
          </TextField>

          <ButtonGroup size="small" variant="outlined" sx={{ mr: 1 }}>
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
                    sx: { width: 150 }
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
                    sx: { width: 150 }
                  }
                }}
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

      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          variant="outlined"
          placeholder="제품명, 연락처로 검색"
          value={inputValue}
          onChange={handleSearchInput}
          onKeyPress={handleKeyPress}
          sx={{ mb: 2, width: '70%' }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={executeSearch}
            startIcon={<SearchIcon />}
            sx={{ 
              height: '40px',
              bgcolor: '#3182f6',
              '&:hover': { bgcolor: '#1b64da' }
            }}
          >
            검색
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setInputValue('');
              setSearchTerm('');
            }}
            startIcon={<ClearIcon />}
            sx={{ height: '40px' }}
          >
            초기화
          </Button>
        </Box>
        {searchTerm && (
          <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
            검색 결과: {filteredShipments.length}건
          </Typography>
        )}
      </Box>

      <ResponsiveTable
        columns={columns.map(column => ({
          ...column,
          label: column.sortable ? renderSortableHeader(column) : column.label
        }))}
        data={filteredShipments}
        renderMobileCard={renderMobileCard}
        onRowClick={(id) => handleEdit(id)}
        hoverEffect={true}
        rowSx={(row) => getRowStyle(row)}
        sx={{
          '& .MuiTableRow-root': {
            transition: 'background-color 0.3s ease',
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
                          <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                            {shipment.customer_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {shipment.customer_phone}
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
                        
                        <Grid item xs={12}>
                          <Typography variant="body2">
                            {shipment.product_name} ({shipment.quantity}개)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {shipment.product_code}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            배송방법:
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
                          <TableCell>카테고리</TableCell>
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
                            <TableCell>
                              <Chip 
                                label={part.category || '기체'} 
                                size="small"
                                color={
                                  part.category === '기체' ? 'primary' : 
                                  part.category === '파츠' ? 'secondary' : 
                                  part.category === '공임' ? 'success' : 'default'
                                }
                              />
                            </TableCell>
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
              
              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                  <DatePicker
                    label="주문일"
                    value={selectedShipment.order_date ? new Date(selectedShipment.order_date) : null}
                    onChange={(newDate) => {
                      handleChange({
                        target: {
                          name: 'order_date',
                          value: newDate ? format(newDate, 'yyyy-MM-dd') : null
                        }
                      });
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        sx: { 
                          '& .MuiInputBase-root': { 
                            height: 40 
                          } 
                        }
                          } 
                        }}
                    format="yyyy-MM-dd"
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                  <DatePicker
                    label="출고일"
                    value={selectedShipment.shipment_date ? new Date(selectedShipment.shipment_date) : null}
                    onChange={handleDateChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                        size: "small",
                        sx: { 
                          '& .MuiInputBase-root': { 
                            height: 40 
                          } 
                        }
                          } 
                        }}
                    format="yyyy-MM-dd"
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12} md={4}>
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
                    mx: 1,
                    px: 3
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
              value={partInputValue}
              onChange={handlePartSearchInput}
              onKeyPress={handlePartKeyPress}
              placeholder="제품명 또는 코드로 검색"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setPartSearchTerm(partInputValue)}>
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>카테고리 선택</Typography>
              <RadioGroup
                row
                name="category"
                value={selectedPartCategory}
                onChange={(e) => setSelectedPartCategory(e.target.value)}
              >
                {PART_CATEGORIES.map((category) => (
                  <FormControlLabel 
                    key={category} 
                    value={category} 
                    control={<Radio />} 
                    label={category} 
                  />
                ))}
              </RadioGroup>
            </FormControl>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>제품명</TableCell>
                    <TableCell>코드</TableCell>
                    <TableCell align="right">가격</TableCell>
                    <TableCell>카테고리</TableCell>
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
                      <TableCell>{selectedPart?.id === part.id ? selectedPartCategory : '-'}</TableCell>
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
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          position: 'fixed',
          top: '50% !important',
          left: '50% !important',
          transform: 'translate(-50%, -50%)',
          width: 'auto'
        }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ 
            minWidth: '300px',
            maxWidth: '500px',
            bgcolor: snackbar.severity === 'success' ? '#3182f6' : 
                     snackbar.severity === 'error' ? '#f04452' :
                     snackbar.severity === 'warning' ? '#ff9800' : 
                     snackbar.severity === 'info' ? '#0288d1' : '#3182f6',
            color: 'white',
            '& .MuiAlert-icon': {
              color: 'white'
            },
            '& .MuiAlert-message': {
              whiteSpace: 'pre-line',
              wordBreak: 'break-word'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ProductShipment; 