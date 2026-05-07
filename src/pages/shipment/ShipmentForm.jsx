
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  InputAdornment,
  Chip,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MASTER_ACCOUNTS } from '../../config/menuConfig';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { sendTelegramNotification } from '../../lib/telegram';
import { processShipmentCompletion, processShipmentRevert } from '../../utils/inventoryUtils';


// 부품 카테고리 자동 결정 함수 (setSelectedCategory 호출 제거, 카테고리 반환)
const determinePartCategory = (part) => {
  if (!part) return '기타';

  let category = '기타';

  if (part.note) {
    const note = part.note.toLowerCase();
    if (note.includes('파츠') || note.includes('part') || note.includes('부품')) category = '파츠';
    else if (note.includes('공임') || note.includes('작업') || note.includes('서비스')) category = '공임';
    else if (note.includes('기타') || note.includes('etc')) category = '기타';
    else if (note.includes('기체') || note.includes('바이크') || note.includes('자전거')) category = '기체';
  }

  if ((category === '기타' || !part.note) && part.code) {
    const code = part.code.toUpperCase();
    if (code.startsWith('XRBM-')) category = '기체';
    else if (code.startsWith('XRBP-')) category = '파츠';
    else if (code.startsWith('XRBS-')) category = '공임';
    else if (code.startsWith('NBM-')) category = '기체';
    else if (code.startsWith('NBP-')) category = '파츠';
    else if (code.startsWith('NBS-')) category = '공임';
    else if (code.includes('PART') || code.includes('SPARE')) category = '파츠';
    else if (code.includes('SERVICE')) category = '공임';
    else if (code.includes('BIKE')) category = '기체';
  }
  return category;
};

// 합계 금액 계산 함수
const calculateTotal = (part) => {
  return (part.price || 0) * (part.quantity || 1);
};

// ... 기존 import 위에 추가
const TEMP_KEY = 'shipmentFormTemp';

function ShipmentForm({ isManualB2B = false }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [shipmentData, setShipmentData] = useState({
    brand: 'XRB',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    order_date: new Date().toISOString().split('T')[0],
    shipment_date: new Date().toISOString().split('T')[0],
    status: isManualB2B ? '출고완료' : '접수',
    delivery_method: isManualB2B ? '수기판매' : '방문수령',
    tracking_number: '',
    note: isManualB2B ? '[B2B수기판매] ' : '',
    sales_channel: isManualB2B ? '[B2B수기]' : '청담매장',
    warehouse_id: ''
  });

  const [selectedParts, setSelectedParts] = useState([]);
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [partInputValue, setPartInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [allParts, setAllParts] = useState([]);

  // 창고 및 거래처 상태 추가
  const [warehouses, setWarehouses] = useState([]);
  const [agencies, setAgencies] = useState([]);

  // 엑셀 업로드 관련 상태 추가
  const [excelUploadDialog, setExcelUploadDialog] = useState(false);
  const [uploadedData, setUploadedData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const navigate = useNavigate();
  const submitActionRef = useRef('list');
  const { id } = useParams();
  const isEditMode = !!id;
  const { user } = useAuth();
  const isMaster = MASTER_ACCOUNTS.includes(user?.email);
  const [isInspectionEnabled, setIsInspectionEnabled] = useState(false);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const { data } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'shipment_inspection')
          .maybeSingle();
        if (data && data.value && data.value.enabled !== undefined) {
          setIsInspectionEnabled(data.value.enabled);
        }
      } catch (e) {
        console.error('검수 설정 로드 실패:', e);
      }
    };
    fetchGlobalSettings();
  }, []);

  // 검색을 위한 상태 수정
  const [isSearching] = useState(false);

  // 변경사항 감지를 위한 상태 추가
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  // 임시 저장
  const [hasTempData, setHasTempData] = useState(false);

  // 창고 및 대리점 목록 불러오기
  const fetchWarehouses = async () => {
    try {
      const [whRes, agRes] = await Promise.all([
        supabase.from('warehouses').select('*').order('name'),
        supabase.from('agencies').select('*').order('name')
      ]);

      if (whRes.error) console.error('창고 로딩 에러:', whRes.error);
      if (agRes.error) console.error('대리점 로딩 에러:', agRes.error);

      const whData = whRes.data || [];
      const agData = agRes.data || [];

      setWarehouses(whData);
      setAgencies(agData);
      
      // 새 출고 등록 시 기본 창고(청담) 설정
      if (!isEditMode && whData.length > 0) {
         const cheongdam = whData.find(w => w.name.includes('청담'));
         if (cheongdam) {
           setShipmentData(prev => ({ ...prev, warehouse_id: cheongdam.id }));
         }
      }
    } catch (e) {
      console.error('기준 정보 로딩 에러:', e);
    }
  };

  // 변경사항 감지 함수
  const checkForChanges = useCallback(() => {
    if (!initialData || isFormSubmitted) return;

    const currentData = {
      shipmentData,
      selectedParts: selectedParts.map(part => ({
        part_name: part.part_name,
        part_code: part.part_code,
        category: part.category,
        quantity: part.quantity,
        price: part.price,
        totalPrice: part.totalPrice
      }))
    };

    const hasChanges = JSON.stringify(currentData) !== JSON.stringify(initialData);
    setHasUnsavedChanges(hasChanges);
  }, [shipmentData, selectedParts, initialData, isFormSubmitted]);

  // 폼 데이터 변경 감지
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // 페이지 떠날 때 확인 메시지
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !isFormSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isFormSubmitted]);

  // 브라우저 뒤로가기 방지
  useEffect(() => {
    if (hasUnsavedChanges && !isFormSubmitted) {
      // 현재 페이지를 히스토리에 추가
      window.history.pushState(null, '', window.location.href);

      const handlePopState = (event) => {
        if (hasUnsavedChanges && !isFormSubmitted) {
          // 브라우저 뒤로가기 시 확인 다이얼로그 표시
          const confirmLeave = window.confirm('변경사항이 저장되지 않았습니다. 정말 나가시겠습니까?');

          if (confirmLeave) {
            // 사용자가 확인하면 실제로 뒤로가기 실행
            setHasUnsavedChanges(false);
            window.history.back();
          } else {
            // 사용자가 취소하면 현재 페이지 유지
            window.history.pushState(null, '', window.location.href);
          }
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [hasUnsavedChanges, isFormSubmitted]);

  // 임시 데이터 불러오기
  const loadTempData = () => {
    const temp = localStorage.getItem(TEMP_KEY);
    if (temp) {
      const { shipmentData, selectedParts } = JSON.parse(temp);
      setShipmentData(shipmentData);
      setSelectedParts(selectedParts);
    }
  };

  // 임시 데이터 삭제
  const clearTempData = () => {
    localStorage.removeItem(TEMP_KEY);
    setHasTempData(false);
  };

  // 마운트 시 임시 데이터 존재 여부 확인
  useEffect(() => {
    setHasTempData(!!localStorage.getItem(TEMP_KEY));
  }, []);

  // 폼 데이터 변경 시 임시 저장
  useEffect(() => {
    const shouldSaveTemp = hasUnsavedChanges && !isFormSubmitted;
    if (shouldSaveTemp) {
      const temp = {
        shipmentData,
        selectedParts
      };
      localStorage.setItem(TEMP_KEY, JSON.stringify(temp));
      setHasTempData(true);
    }
  }, [shipmentData, selectedParts, hasUnsavedChanges, isFormSubmitted]);

  // 정상 등록 시 임시 데이터 삭제
  useEffect(() => {
    if (isFormSubmitted) {
      clearTempData();
    }
  }, [isFormSubmitted]);

  // 메모이제이션된 필터링 함수
  const filteredParts = useMemo(() => {
    if (!searchTerm) {
      return allParts.slice(0, 50); // 검색어 없을 때는 처음 50개만 표시
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = allParts.filter(part =>
      (part.name && part.name.toLowerCase().includes(searchLower)) ||
      (part.code && part.code.toLowerCase().includes(searchLower))
    ).slice(0, 100); // 최대 100개 결과로 제한

    return filtered;
  }, [searchTerm, allParts]);

  // 윈도우 가상화를 위한 페이지네이션 처리
  const [page, setPage] = useState(0);
  const rowsPerPage = 20;

  // 페이지네이션된 결과만 보여주도록 수정
  const paginatedParts = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredParts.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredParts, page]);

  // 페이지 변경 함수
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  useEffect(() => {
    if (isEditMode) {
      fetchShipmentData();
    }
    fetchAllParts();
    fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchShipmentData = async () => {
    try {
      setLoading(true);
      // 출고 정보 조회
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // 날짜 형식 조정
      const shipmentInfo = {
        ...data,
        order_date: data.order_date || data.created_at?.split('T')[0],
        shipment_date: data.shipment_date || new Date().toISOString().split('T')[0],
        sales_channel: data.sales_channel || extractSalesChannel(data.note) || '공홈',
        order_no: data.note ? (data.note.match(/\[주문:(.*?)\]/)?.[1] || data.note.match(/20\d{6}-\d{7}/)?.[0] || '') : ''
      };

      setShipmentData(shipmentInfo);

      // 부품 정보 조회
      try {
        const { data: parts, error: partsError } = await supabase
          .from('shipment_parts')
          .select('*')
          .eq('shipment_id', id);

        if (!partsError && parts) {
          const isLegacyEcount = shipmentInfo.note?.includes('[과거 이카운트 이관]') || shipmentInfo.sales_channel === '과거 이카운트 이관';

          const formattedParts = parts.map(part => {
            let actualPrice = part.price;
            let actualTotalPrice = part.total_price || (actualPrice * part.quantity);

            // 과거 이카운트 데이터 처리 (업로더에서 합계 금액은 이미 부가세 처리가 완료되어 total_price에 저장됨)
            if (isLegacyEcount) {
              if (part.total_price != null && part.total_price !== 0) {
                actualTotalPrice = part.total_price;
                actualPrice = Math.round(actualTotalPrice / (part.quantity || 1));
              } else {
                // total_price가 없는 과거 데이터에 대한 폴백 처리
                actualPrice = Math.round(actualPrice * 1.1);
                actualTotalPrice = actualPrice * part.quantity;
              }
            }

            return {
              id: part.id,
              part_name: part.part_name,
              part_code: part.part_code,
              category: part.part_category || '기체',
              quantity: part.quantity,
              price: actualPrice,
              totalPrice: actualTotalPrice,
              status: part.status || '접수'
            };
          });

          setSelectedParts(formattedParts);

          // 초기 데이터 설정 (변경사항 감지용)
          setInitialData({
            shipmentData: shipmentInfo,
            selectedParts: formattedParts.map(part => ({
              part_name: part.part_name,
              part_code: part.part_code,
              category: part.category,
              quantity: part.quantity,
              price: part.price,
              totalPrice: part.totalPrice,
              status: part.status
            }))
          });
        }
      } catch (partsError) {
        console.error('Error fetching shipment parts:', partsError);
      }
    } catch (error) {
      console.error('Error fetching shipment:', error);
      setSnackbar({
        open: true,
        message: '출고 정보를 불러오는데 실패했습니다',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // 초기 데이터 설정 (새 등록 모드)
  useEffect(() => {
    if (!isEditMode && !initialData) {
      setInitialData({
        shipmentData: {
          brand: 'XRB',
          customer_name: '',
          customer_phone: '',
          customer_address: '',
          order_date: new Date().toISOString().split('T')[0],
          shipment_date: new Date().toISOString().split('T')[0],
          status: '접수',
          delivery_method: '방문수령',
          tracking_number: '',
          note: '',
          sales_channel: '청담매장',
          order_no: ''
        },
        selectedParts: []
      });
    }
  }, [isEditMode, initialData]);

  const fetchAllParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name');

      if (error) throw error;
      setAllParts(data || []);
      // 필터링된 부품 목록 초기화는 useMemo에서 처리
    } catch (error) {
      console.error('Error fetching parts:', error);
    }
  };

  // 컴포넌트 마운트 시 전체 부품 목록 가져오기
  useEffect(() => {
    fetchAllParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // 엔터키 처리 함수 수정
  const handlePartKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 폼 제출 방지
      setSearchTerm(partInputValue);
      setPage(0); // 검색 결과의 첫 페이지로 이동
    }
  };

  // 검색 버튼 클릭 처리 함수 추가
  const handleSearch = () => {
    setSearchTerm(partInputValue);
    setPage(0);
  };

  // 판매처 정보 추출 함수
  const extractSalesChannel = (note) => {
    if (!note) return null;

    const match = note.match(/\[판매처: (.*?)\]/);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'status') {
      const previousStatus = shipmentData.status;
      const newStatus = value;

      // 1. 작업완료 -> 접수 제한
      if (previousStatus === '작업완료' && newStatus === '접수') {
        const hasActiveParts = selectedParts.some(p => p.status !== '반품완료' && (!p.note || !p.note.includes('[반품완료]')));
        if (hasActiveParts) {
          alert('추가된 품목이 있어 접수 상태로 변경할 수 없습니다. 품목을 먼저 부분반품 처리해주세요.');
          return;
        }
      }

      // 2. 접수 -> 작업완료 확인
      if (previousStatus === '접수' && newStatus === '작업완료') {
        if (!window.confirm('출고 상태를 작업완료로 변경하시겠습니까? (하위 품목들의 상태도 함께 동기화됩니다)')) {
          return;
        }
      }

      // 3. 출고완료 확인
      if (newStatus === '출고완료' && previousStatus !== '출고완료') {
        if (!window.confirm('해당 출고건을 완료 처리하시겠습니까?')) {
          return;
        }
      }
      
      // 하위 품목 동기화 로직
      setSelectedParts(prev => prev.map(p => {
        if (p.status === '반품완료' || (p.note && p.note.includes('[반품완료]'))) return p;
        return { ...p, status: newStatus };
      }));
    }

    setShipmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateChange = (name) => (date) => {
    setShipmentData(prev => ({
      ...prev,
      [name]: date ? format(date, 'yyyy-MM-dd') : null
    }));
  };

  const handleOpenPartsDialog = () => {
    setOpenPartsDialog(true);
    setPartInputValue('');
    setSearchTerm('');
    setPage(0);
    // 부품 추가 다이얼로그를 열 때 현재 브랜드의 부품 목록을 새로 불러오기
    fetchAllParts();
  };

  const handleClosePartsDialog = () => {
    setOpenPartsDialog(false);
  };

  const handleAddPartToList = (partToAdd) => {
    if (!partToAdd) return;

    setSelectedParts(prevParts => {
      const existingPartIndex = prevParts.findIndex(p => p.part_code === partToAdd.code && p.part_name === partToAdd.name);

      const categoryForNewPart = determinePartCategory(partToAdd);

      if (existingPartIndex >= 0) {
        const updatedParts = [...prevParts];
        updatedParts[existingPartIndex].quantity = (updatedParts[existingPartIndex].quantity || 0) + 1;
        updatedParts[existingPartIndex].totalPrice = calculateTotal(updatedParts[existingPartIndex]);
        return updatedParts;
      } else {
        const newPartEntry = {
          id: Date.now(),
          part_name: partToAdd.name,
          part_code: partToAdd.code,
          category: categoryForNewPart,
          quantity: 1,
          price: partToAdd.price || 0,
          totalPrice: (partToAdd.price || 0) * 1
        };
        return [...prevParts, newPartEntry];
      }
    });

    setSnackbar({
      open: true,
      message: `${partToAdd.name} 추가됨(또는 수량 증가)`,
      severity: 'success'
    });
  };

  const handleRemovePart = (id) => {
    setSelectedParts(prev => prev.filter(part => part.id !== id));
  };

  const handleSubmit = async () => {
    if (saving) return; // 이중 클릭 방지
    // 필수 입력값 검증
    const requiredFields = [
      { field: 'customer_name', label: '고객명' },
      { field: 'customer_phone', label: '연락처' },
      { field: 'shipment_date', label: '출고일' },
      { field: 'warehouse_id', label: '출고 창고' }
    ];

    const missingFields = requiredFields.filter(({ field }) => !shipmentData[field]);

    if (missingFields.length > 0) {
      setSnackbar({
        open: true,
        message: `다음 필수 정보를 입력해주세요: ${missingFields.map(f => f.label).join(', ')} `,
        severity: 'warning'
      });
      return;
    }

    if (selectedParts.length === 0) {
      setSnackbar({
        open: true,
        message: '하나 이상의 제품을 추가해주세요',
        severity: 'warning'
      });
      return;
    }

    // 데이터 무결성 검증 (서버 검증 대체용)
    for (const part of selectedParts) {
      const qty = Number(part.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        setSnackbar({
          open: true,
          message: `잘못된 수량입니다 (${part.part_name}): 수량은 1 이상의 정수여야 합니다.`,
          severity: 'error'
        });
        return;
      }
      
      const price = Number(part.price);
      if (isNaN(price) || price < 0) {
        setSnackbar({
          open: true,
          message: `잘못된 단가입니다 (${part.part_name}): 단가는 0 이상의 숫자여야 합니다.`,
          severity: 'error'
        });
        return;
      }
    }

    setSaving(true);
    setIsFormSubmitted(true); // 폼 제출 상태로 변경
    let shipmentId = id;

    try {
      // 판매처 및 주문번호 정보를 메모에 포함
      let finalNote = shipmentData.note || '';
      
      finalNote = finalNote.replace(/\[주문:.*?\]\s*/g, '');
      if (shipmentData.order_no) {
        finalNote = `[주문:${shipmentData.order_no}] ${finalNote}`.trim();
      }

      if (shipmentData.sales_channel) {
        if (finalNote.includes('[판매처:')) {
          finalNote = finalNote.replace(/\[판매처: .*?\]/, `[판매처: ${shipmentData.sales_channel}]`);
        } else {
          finalNote = `[판매처: ${shipmentData.sales_channel}] ${finalNote} `.trim();
        }
      }

      const totalQuantity = selectedParts.reduce((sum, part) => sum + (parseInt(part.quantity) || 0), 0);
      const totalPrice = selectedParts.reduce((sum, part) => sum + calculateTotal(part), 0);
      const combinedProductName = selectedParts.map(p => p.part_name).join(', ');

      const shipmentSaveData = {
        brand: shipmentData.brand,
        order_date: shipmentData.order_date,
        shipment_date: shipmentData.shipment_date,
        status: shipmentData.status,
        customer_name: (shipmentData.customer_name || '').trim(),
        customer_phone: (shipmentData.customer_phone || '').trim(),
        customer_address: (shipmentData.customer_address || '').trim(),
        delivery_method: shipmentData.delivery_method,
        tracking_number: shipmentData.tracking_number?.trim() || '',
        note: finalNote.trim(),
        product_name: combinedProductName,
        product_code: selectedParts[0]?.part_code || '',
        quantity: totalQuantity,
        price: totalPrice,
        warehouse_id: shipmentData.warehouse_id, // 이제 필수로 들어감
        sales_channel: shipmentData.sales_channel,
        updated_at: new Date().toISOString()
      };

      let currentStatus = null;
      if (isEditMode && shipmentId) {
        const { data: currentShipment } = await supabase.from('shipments').select('status').eq('id', shipmentId).single();
        currentStatus = currentShipment?.status;
      }
      const wasCompleted = isEditMode && currentStatus === '출고완료';
      const isNowCompleted = shipmentSaveData.status === '출고완료';

      // 1. 만약 기존 상태가 '출고완료'였다면, DB를 업데이트하기 '전에' 기존 재고 차감을 복구(Revert)합니다.
      // (processShipmentRevert는 DB에 저장된 기존 shipment_parts를 읽어와서 복구하므로 업데이트 전에 실행해야 함)
      if (wasCompleted && shipmentId) {
        const revertResult = await processShipmentRevert(shipmentId, shipmentData.brand);
        if (!revertResult.success) {
          throw new Error('기존 재고 복구 중 오류: ' + revertResult.message);
        }
      }

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('shipments')
          .update(shipmentSaveData)
          .eq('id', id);
        if (updateError) throw new Error(`출고 정보 업데이트 중 오류: ${updateError.message} `);
      } else {
        const { data: newShipment, error: insertError } = await supabase
          .from('shipments')
          .insert([shipmentSaveData])
          .select();
        if (insertError) throw new Error(`새 출고 정보 저장 중 오류: ${insertError.message} `);
        shipmentId = newShipment[0].id;
      }

      if (!shipmentId) {
        throw new Error('출고 ID를 가져오지 못했습니다.');
      }

      // 부품 정보 저장
      if (isEditMode) {
        const { error: deletePartsError } = await supabase
          .from('shipment_parts')
          .delete()
          .eq('shipment_id', shipmentId);
        if (deletePartsError) {
          // 삭제 오류는 일단 로깅만 하고 진행 (필수 부품이 아닐 수 있음)
          console.warn('기존 부품 정보 삭제 중 오류 (수정 모드): ', deletePartsError.message);
        }
      }

      if (selectedParts.length > 0) {
        const partsData = selectedParts.map(part => ({
          shipment_id: shipmentId,
          part_name: part.part_name,
          part_code: part.part_code || '',
          part_category: part.category || '기체',
          quantity: part.quantity || 1,
          price: part.price || 0,
          total_price: part.totalPrice || calculateTotal(part),
          warehouse_id: shipmentData.warehouse_id, // 이제 필수로 들어감
          status: part.status || shipmentData.status || '접수',
          created_at: new Date().toISOString()
        }));

        const { error: insertPartsError } = await supabase
          .from('shipment_parts')
          .insert(partsData);
        if (insertPartsError) throw new Error(`부품 정보 저장 중 오류: ${insertPartsError.message} `);
      }

      // ==== 매장/일반 출고 재고 차감 (수불부 동기화) ====
      if (shipmentId && isNowCompleted) {
        const deductResult = await processShipmentCompletion(shipmentId, shipmentSaveData.brand);
        if (!deductResult.success) {
          console.error('[Inventory Deduct Error]:', deductResult.message);
        }
      } else if (shipmentId && !isNowCompleted) {
        // 출고완료가 아니면 (접수 등) 기존 트랜잭션이 있을 경우 방어적으로 삭제
        const { error: txDelErr } = await supabase.from('transactions').delete().eq('group_id', shipmentId);
        if (txDelErr) {
          console.error('[Inventory Transaction Delete Error]:', txDelErr.message);
        }
      }
      // ==== 재고 차감 끝 ====

      // 등록 성공 후 알림 추가
      setSnackbar({
        open: true,
        message: isEditMode ? '출고 정보가 수정되었습니다.' : '출고 정보가 등록되었습니다.',
        severity: 'success'
      });

      // 텔레그램 알림 전송
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          await sendTelegramNotification({
            message: `${title}(SHP-${String(shipmentId).slice(0, 8).toUpperCase()}) - 고객: ${shipmentData.customer_name}, 연락처: ${shipmentData.customer_phone}, 제품: ${combinedProductName}`,
            link: `/shipment/${shipmentId}`
          }, { eventType });
        } catch (telegramError) {
          console.error('출고 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }

      // 변경사항 초기화
      setInitialData({
        shipmentData: { ...shipmentData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      setTimeout(() => {
        if (submitActionRef.current === 'detail' && shipmentId) {
          navigate(isManualB2B ? `/sales/manual` : `/shipment/${shipmentId}`);
        } else {
          navigate(isManualB2B ? '/sales/manual' : '/shipment');
        }
      }, 500);

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setSnackbar({
        open: true,
        message: `오류가 발생했습니다: ${error.message} `,
        severity: 'error'
      });
      setIsFormSubmitted(false); // 오류 발생 시 제출 상태 해제
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
        navigate(isManualB2B ? '/sales/manual' : '/shipment');
      }
    } else {
      navigate(isManualB2B ? '/sales/manual' : '/shipment');
    }
  };

  // 제품 정보 다시 분석 함수 추가
  const handleAnalyzeProduct = async () => {
    try {
      setAnalyzing(true);

      if (!isEditMode) {
        setSnackbar({
          open: true,
          message: '새 출고 등록에서는 이 기능을 사용할 수 없습니다.',
          severity: 'warning'
        });
        return;
      }

      // 1. 출고 정보 조회
      const { data: shipment, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!shipment.product_name) {
        setSnackbar({
          open: true,
          message: '분석할 제품 정보가 없습니다.',
          severity: 'warning'
        });
        return;
      }

      // 기존에 이미 분리된 부품 정보가 있는지 확인
      let partsExists = selectedParts.length > 0;
      let priceUpdated = 0;

      // 기존에 분리된 부품이 있는 경우, 각 부품에 대해 상품 관리에서 가격 정보 업데이트 시도
      if (partsExists) {
        const updatedParts = [];

        for (const part of selectedParts) {
          let foundPart = null;
          let updatedPart = { ...part };

          // 1. 올인원 검색 (바코드, 코드, 제품명)
          const searchName = part.part_name ? part.part_name.replace(/[\s-]/g, '').toLowerCase() : '';
          foundPart = allParts.find(p => 
            (part.part_code && p.code === part.part_code) ||
            (part.part_code && p.barcode === part.part_code) ||
            (p.code === part.part_name) ||
            (p.barcode === part.part_name) ||
            (p.name === part.part_name) ||
            (searchName && p.name && searchName.includes(p.name.replace(/[\s-]/g, '').toLowerCase()))
          );

          // 상품 관리에서 해당 부품을 찾았다면 가격 제외한 정보 업데이트
          if (foundPart) {
            // 정보가 다른 경우에만 업데이트 카운트 증가
            if (foundPart.name !== updatedPart.part_name || foundPart.code !== updatedPart.part_code) {
              priceUpdated++;
            }

            // 상품 관리의 이름과 코드를 적용 (단가는 수기 판매 내역의 원본 유지를 위해 덮어쓰지 않음)
            updatedPart.part_name = foundPart.name || updatedPart.part_name;
            updatedPart.part_code = foundPart.code || updatedPart.part_code;
            // price와 totalPrice는 기존 값 유지

            // 카테고리 업데이트 로직
            let category = updatedPart.category;

            // 1. CRM 상품 관리에서 설정된 카테고리(note)가 있으면 최우선으로 적용
            if (foundPart.note && ['파츠', '공임', '기타', '기체'].includes(foundPart.note.trim())) {
              category = foundPart.note.trim();
            } else {
              // 2. 명확한 카테고리가 없는 경우 텍스트 포함 여부나 코드로 추론
              if (foundPart.note) {
                const note = foundPart.note.toLowerCase();
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

              // 노트로 판단 안 된 경우 코드에서 추론
              if (!['파츠', '공임', '기타', '기체'].includes(category) && foundPart.code) {
                const code = foundPart.code.toUpperCase();
                if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
                  category = '파츠';
                } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
                  category = '공임';
                } else if (code.startsWith('XRBM-') || code.startsWith('NBM-') || code.includes('BIKE')) {
                  category = '기체';
                }
              }
            }

            updatedPart.category = category;
          }

          updatedParts.push(updatedPart);
        }

        // 업데이트된 부품 정보 적용
        setSelectedParts(updatedParts);

        setSnackbar({
          open: true,
          message: `${priceUpdated > 0 ? `${priceUpdated}개 제품의 ` : ''}제품 정보(이름, 코드, 분류)가 동기화되었습니다. (단가 유지)`,
          severity: 'success'
        });

        setAnalyzing(false);
        return;
      }

      // 기존에 분리된 부품이 없는 경우, 제품명을 기반으로 분석 진행
      // 2. 제품명이 여러 개인지 확인 (쉼표로 구분)
      const productNames = shipment.product_name.split(',').map(name => name.trim()).filter(name => name);

      // 제품이 여러 개로 구분된 경우
      if (productNames.length > 1) {
        // 새 부품 정보 배열 생성
        const newParts = [];
        let partsUpdated = 0;

        // 각 제품별로 처리
        for (let i = 0; i < productNames.length; i++) {
          const productName = productNames[i];

          // 카테고리 기본값
          let category = '기체';
          let price = 0;
          let partCode = '';

          // 상품 관리 시스템에서 매칭되는 제품 검색 - 이름이 정확히 일치하는 항목 우선
          let partFromDB = null;

          // 1. 올인원 검색 (바코드, 코드, 제품명)
          const searchName = productName ? productName.replace(/[\s-]/g, '').toLowerCase() : '';
          partFromDB = allParts.find(p => 
            (partCode && p.code === partCode) ||
            (partCode && p.barcode === partCode) ||
            (p.code === productName) ||
            (p.barcode === productName) ||
            (p.name === productName) ||
            (searchName && p.name && searchName.includes(p.name.replace(/[\s-]/g, '').toLowerCase()))
          );

          if (partFromDB) {
            // 상품 관리에 설정된 구분 확인
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

            // 상품 관리 시스템에서 코드 패턴으로 카테고리 추정
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

            // 상품 관리의 가격 사용 (중요: 항상 상품 관리의 가격 우선 적용)
            price = partFromDB.price || 0;
            partCode = partFromDB.code || '';
            partsUpdated++;
          } else {
            // DB에서 매칭되는 제품이 없는 경우
            // 전체 금액을 제품 개수로 나눈 예상 가격 계산
            price = shipment.price ? Math.round(shipment.price / productNames.length) : 0;
            partCode = '';
          }

          // 새 부품 정보 생성
          newParts.push({
            id: Date.now() + i, // 임시 ID (각각 고유하게)
            part_name: productName,
            part_code: partCode,
            category: category,
            quantity: 1, // 기본값
            price: price,
            totalPrice: price
          });
        }

        // 부품 정보 업데이트
        setSelectedParts(newParts);

        setSnackbar({
          open: true,
          message: `${newParts.length}개의 제품으로 분리하여 분석했습니다.${partsUpdated}개의 제품 가격과 구분이 상품 관리 기준으로 업데이트되었습니다.`,
          severity: 'success'
        });
      } else {
        // 단일 제품인 경우 (기존 코드)
        // 2. 제품 카테고리 추정
        let category = '기체';
        let price = 0; // 기본 가격은 0으로 설정
        let partCode = shipment.product_code || '';
        let updatedFromDB = false;

        if (shipment.product_code) {
          const code = shipment.product_code.toUpperCase();
          if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
            category = '파츠';
          } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
            category = '공임';
          }
        }

        // 3. 상품 관리 시스템에서 매칭되는 제품 검색 - 이름이 정확히 일치하는 항목 우선
        let partFromDB = null;

        // 1. 올인원 검색 (바코드, 코드, 제품명)
        const searchName = shipment.product_name ? shipment.product_name.replace(/[\s-]/g, '').toLowerCase() : '';
        partFromDB = allParts.find(p => 
          (partCode && p.code === partCode) ||
          (partCode && p.barcode === partCode) ||
          (p.code === shipment.product_name) ||
          (p.barcode === shipment.product_name) ||
          (p.name === shipment.product_name) ||
          (searchName && p.name && searchName.includes(p.name.replace(/[\s-]/g, '').toLowerCase()))
        );

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

          // 상품 관리의 코드와 가격 사용 (중요: 항상 상품 관리의 가격 우선 적용)
          partCode = partFromDB.code || partCode;
          price = partFromDB.price || 0;
          updatedFromDB = true;
        } else {
          // 상품 관리에서 찾지 못한 경우 기존 가격 사용
          price = shipment.price ? (shipment.price / (shipment.quantity || 1)) : 0;
        }

        // 4. 새 부품 정보 생성
        const newPart = {
          id: Date.now(), // 임시 ID
          part_name: shipment.product_name,
          part_code: partCode,
          category: category,
          quantity: shipment.quantity || 1,
          price: price,
          totalPrice: price * (shipment.quantity || 1)
        };

        // 5. 기존 부품 정보 업데이트
        setSelectedParts([newPart]);

        setSnackbar({
          open: true,
          message: updatedFromDB
            ? '제품 정보가 상품 관리 기준으로 업데이트되었습니다.'
            : '제품 정보가 성공적으로 분석되었습니다.',
          severity: 'success'
        });
      }

    } catch (error) {
      console.error('Error analyzing product data:', error);
      setSnackbar({
        open: true,
        message: '제품 정보 분석 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // 가격 수정 함수 추가
  const handlePriceChange = (id, newPrice) => {
    setSelectedParts(prev => prev.map(part => {
      if (part.id === id) {
        const price = parseFloat(newPrice) || 0;
        return {
          ...part,
          price: price,
          totalPrice: price * part.quantity
        };
      }
      return part;
    }));
  };

  // 상태 수정 함수 추가
  const handlePartStatusChange = (id, newStatus) => {
    setSelectedParts(prev => prev.map(part => {
      if (part.id === id) {
        return {
          ...part,
          status: newStatus
        };
      }
      return part;
    }));
  };

  // 수량 수정 함수 추가
  const handlePartQuantityChange = (id, newQuantity) => {
    setSelectedParts(prev => prev.map(part => {
      if (part.id === id) {
        const quantity = parseInt(newQuantity) || 1;
        return {
          ...part,
          quantity: quantity,
          totalPrice: part.price * quantity
        };
      }
      return part;
    }));
  };

  // 엑셀 파일 업로드 핸들러
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const jsonData = await readExcelFile(file);

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

    // 파일 input 초기화
    event.target.value = '';
  };

  // 엑셀 데이터를 부품 목록으로 변환
  const handleProcessExcelData = () => {
    if (uploadedData.length === 0) return;

    try {
      // 엑셀 데이터를 부품 목록으로 변환
      const newParts = uploadedData.map((item, index) => {
        let finalPartName = item['제품명'] || '';
        let finalPartCode = item['제품코드'] || '';
        const excelBarcode = item['바코드'] || item['제품코드'] || '';

        // DB 부품과 매칭 시도 (바코드, 코드, 제품명)
        const searchName = finalPartName.replace(/[\s-]/g, '').toLowerCase();
        const foundPart = allParts.find(p => 
          (excelBarcode && p.code === excelBarcode) ||
          (excelBarcode && p.barcode === excelBarcode) ||
          (finalPartCode && p.code === finalPartCode) ||
          (finalPartCode && p.barcode === finalPartCode) ||
          (p.name === finalPartName) ||
          (searchName && p.name && searchName.includes(p.name.replace(/[\s-]/g, '').toLowerCase()))
        );

        if (foundPart) {
          finalPartName = foundPart.name || finalPartName;
          finalPartCode = foundPart.code || finalPartCode;
        }

        // 카테고리 결정
        let category = item['카테고리'];
        if (!category) {
          if (foundPart && foundPart.note) {
            const note = foundPart.note.toLowerCase();
            if (note.includes('파츠') || note.includes('part') || note.includes('부품')) category = '파츠';
            else if (note.includes('공임') || note.includes('작업') || note.includes('서비스')) category = '공임';
            else if (note.includes('기타') || note.includes('etc')) category = '기타';
            else if (note.includes('기체') || note.includes('바이크') || note.includes('자전거')) category = '기체';
          }
          if (!category) {
             category = determineCategoryForExcel(item['제품코드'], item['제품명'], item['가격']);
          }
        }

        return {
          id: Date.now() + index, // 임시 ID
          part_name: finalPartName,
          part_code: finalPartCode,
          category: category,
          quantity: parseInt(item['수량']) || 1,
          price: parseFloat(item['가격']) || 0,
          totalPrice: (parseFloat(item['가격']) || 0) * (parseInt(item['수량']) || 1)
        };
      });

      // 고객 정보 설정 (첫 항목 기준)
      if (uploadedData.length > 0 && !isEditMode) {
        const firstItem = uploadedData[0];

        // 판매처 정보를 메모에 포함
        let finalNote = shipmentData.note || '';
        const salesChannel = firstItem['판매처'] || '공홈';

        // 메모 설정
        if (firstItem['메모']) {
          finalNote = `[판매처: ${salesChannel}] ${firstItem['메모']} `;
        } else {
          finalNote = `[판매처: ${salesChannel}]`;
        }

        setShipmentData(prev => ({
          ...prev,
          customer_name: firstItem['고객명'] || '',
          customer_phone: firstItem['연락처'] || '',
          customer_address: firstItem['주소'] || '',
          order_date: firstItem['주문일'] || new Date().toISOString().split('T')[0],
          shipment_date: firstItem['출고일'] || new Date().toISOString().split('T')[0],
          delivery_method: firstItem['배송방법'] || '택배',
          note: finalNote,
          sales_channel: salesChannel
        }));
      }

      // 기존 부품 목록에 새 부품 추가
      setSelectedParts(prev => [...prev, ...newParts]);

      setSnackbar({
        open: true,
        message: `${newParts.length}개 제품이 추가되었습니다.`,
        severity: 'success'
      });

    } catch (error) {
      console.error('엑셀 데이터 처리 중 오류:', error);
      setSnackbar({
        open: true,
        message: '엑셀 데이터 처리 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setExcelUploadDialog(false);
      setUploadedData([]);
      setPreviewData([]);
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
      const headers = [
        { label: '고객명', key: '고객명' },
        { label: '연락처', key: '연락처' },
        { label: '주소', key: '주소' },
        { label: '제품명', key: '제품명' },
        { label: '제품코드', key: '제품코드' },
        { label: '수량', key: '수량' },
        { label: '가격', key: '가격' },
        { label: '카테고리', key: '카테고리' },
        { label: '판매처', key: '판매처' },
        { label: '배송방법', key: '배송방법' },
        { label: '주문일', key: '주문일' },
        { label: '출고일', key: '출고일' },
        { label: '메모', key: '메모' }
      ];

      // 파일 다운로드
      downloadExcel(templateData, headers, `출고등록템플릿_${shipmentData.brand}.xlsx`);

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

  // 엑셀 카테고리 결정 함수 (기존 determineCategory는 그대로 두거나, determinePartCategory로 대체)
  const determineCategoryForExcel = (code, name, price) => { // 이름 변경 또는 determinePartCategory 활용
    // 이 함수는 determinePartCategory({code, name, price}) 형태로 호출 가능
    return determinePartCategory({ code, name, price, note: null }); // note는 없다고 가정
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 제품 정보 테이블(조회/수정 모두)에서 정렬된 배열 사용
  const sortedParts = [...selectedParts].sort((a, b) => {
    if ((a.category || '기체') === '기체' && (b.category || '기체') !== '기체') return -1;
    if ((a.category || '기체') !== '기체' && (b.category || '기체') === '기체') return 1;
    return 0;
  });

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
          목록으로
        </Button>
        {hasTempData && (
          <>
            <Button
              variant="outlined"
              onClick={loadTempData}
              sx={{ ml: 2, minWidth: 150 }}
            >
              임시 데이터 불러오기
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={clearTempData}
              sx={{ ml: 1, minWidth: 120 }}
            >
              임시 데이터 삭제
            </Button>
          </>
        )}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          {isManualB2B ? (isEditMode ? '수기 판매 전표 수정' : '새 수기 판매 전표 작성') : (isEditMode ? '출고 정보 수정' : '신규 출고 등록')}
        </Typography>
        <Box>
          {isEditMode ? (
            <>
              <Button
                variant="outlined"
                onClick={() => { submitActionRef.current = 'list'; handleSubmit(); }}
                disabled={saving || analyzing}
                sx={{ mr: 1 }}
              >
                저장/목록
              </Button>
              <Button
                variant="contained"
                onClick={() => { submitActionRef.current = 'detail'; handleSubmit(); }}
                disabled={saving || analyzing}
              >
                {saving ? '저장 중...' : '저장/계속'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ mr: 1 }}
              >
                엑셀 템플릿
              </Button>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                disabled={isUploading}
                sx={{ mr: 1 }}
              >
                엑셀 업로드
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>
              <Button
                variant="outlined"
                onClick={() => { submitActionRef.current = 'list'; handleSubmit(); }}
                disabled={saving || analyzing}
                sx={{ mr: 1 }}
              >
                저장/목록
              </Button>
              <Button
                variant="contained"
                onClick={() => { submitActionRef.current = 'detail'; handleSubmit(); }}
                disabled={saving || analyzing}
              >
                {saving ? '저장 중...' : '저장/계속'}
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>기본 정보</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>브랜드</InputLabel>
              <Select
                name="brand"
                value={shipmentData.brand || 'XRB'}
                onChange={handleChange}
                label="브랜드"
              >
                <MenuItem value="XRB">X-RIDER</MenuItem>
                <MenuItem value="NB">NEARBIKE</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <Autocomplete
              freeSolo
              options={agencies.map(a => a.name)}
              value={shipmentData.customer_name || ''}
              onInputChange={(e, newValue) => {
                const typedValue = newValue || '';
                const matchedAgency = agencies.find(a => a.name === typedValue);
                
                setShipmentData(prev => ({ 
                  ...prev, 
                  customer_name: typedValue,
                  ...(matchedAgency && {
                    sales_channel: matchedAgency.name,
                    customer_phone: (matchedAgency.mobile || matchedAgency.phone) || prev.customer_phone
                  })
                }));
              }}
              onChange={(e, newValue) => {
                if (newValue) {
                  // 목록에서 대리점을 클릭/선택한 경우 거래처 자동 연동
                  const matchedAgency = agencies.find(a => a.name === newValue);
                  setShipmentData(prev => ({ 
                    ...prev, 
                    customer_name: newValue,
                    sales_channel: matchedAgency ? matchedAgency.name : prev.sales_channel,
                    customer_phone: matchedAgency && (matchedAgency.mobile || matchedAgency.phone) 
                      ? (matchedAgency.mobile || matchedAgency.phone) 
                      : prev.customer_phone
                  }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="고객명(대리점 자동완성)"
                  required
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="연락처"
              name="customer_phone"
              value={shipmentData.customer_phone || ''}
              onChange={handleChange}
              required
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>상태</InputLabel>
              <Select
                name="status"
                value={shipmentData.status || '준비중'}
                onChange={handleChange}
                label="상태"
              >
                {(() => {
                  const STATUS_ORDER = { '접수': 0, '출고대기': 0, '부품준비': 1, '준비완료': 2, '작업완료': 3, '반품완료': 4, '출고완료': 5 };
                  const currentOrder = STATUS_ORDER[shipmentData.status] ?? 0;
                  const baseItems = isInspectionEnabled 
                    ? ['접수', '부품준비', '준비완료', '작업완료', '반품완료', '출고완료']
                    : ['접수', '작업완료', '출고완료'];
                  const items = [...baseItems];
                  if (shipmentData.status && !items.includes(shipmentData.status)) {
                    items.unshift(shipmentData.status);
                  }
                  
                  return items.map(status => {
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
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="주소"
              name="customer_address"
              value={shipmentData.customer_address || ''}
              onChange={handleChange}
              multiline
              rows={2}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                label="주문일"
                value={shipmentData.order_date ? new Date(shipmentData.order_date) : null}
                onChange={handleDateChange('order_date')}
                slotProps={{
                  textField: {
                    fullWidth: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>판매처</InputLabel>
              <Select
                name="sales_channel"
                value={shipmentData.sales_channel}
                onChange={handleChange}
                label="판매처"
              >
                <MenuItem value="공홈">공홈</MenuItem>
                <MenuItem value="청담매장">청담매장</MenuItem>
                <MenuItem value="라이클-우리">라이클-우리</MenuItem>
                <MenuItem value="스마트할부">스마트할부</MenuItem>
                <MenuItem value="스마트스토어">스마트스토어</MenuItem>
                <MenuItem value="기타">기타</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>출고 창고</InputLabel>
              <Select
                name="warehouse_id"
                value={shipmentData.warehouse_id || ''}
                onChange={handleChange}
                label="출고 창고"
                required
              >
                <MenuItem value="" disabled>
                  <em>창고를 선택하세요</em>
                </MenuItem>
                {warehouses.map(w => (
                  <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>배송 방법</InputLabel>
              <Select
                name="delivery_method"
                value={shipmentData.delivery_method}
                onChange={handleChange}
                label="배송 방법"
              >
                <MenuItem value="택배">택배</MenuItem>
                <MenuItem value="방문수령">방문수령</MenuItem>
                <MenuItem value="퀵-선불">퀵-선불</MenuItem>
                <MenuItem value="퀵-착불">퀵-착불</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                label="출고일"
                value={shipmentData.shipment_date ? new Date(shipmentData.shipment_date) : null}
                onChange={handleDateChange('shipment_date')}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="주문번호 (선택)"
              name="order_no"
              value={shipmentData.order_no || ''}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="송장번호"
              name="tracking_number"
              value={shipmentData.tracking_number}
              onChange={handleChange}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">제품 정보</Typography>
          <Box>
            {isEditMode && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<RefreshIcon />}
                onClick={handleAnalyzeProduct}
                disabled={analyzing}
                sx={{ mr: 1 }}
              >
                {analyzing ? '분석 중...' : '제품 정보 다시 분석'}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenPartsDialog}
              disabled={analyzing}
            >
              제품 추가
            </Button>
          </Box>
        </Box>

        {selectedParts.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography color="text.secondary">
              제품을 추가해주세요
            </Typography>
            {isEditMode && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<RefreshIcon />}
                onClick={handleAnalyzeProduct}
                disabled={analyzing}
                size="small"
                sx={{ mt: 2 }}
              >
                제품 정보 분석하기
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            {analyzing && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 3 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ ml: 2 }}>제품 정보 분석 중...</Typography>
              </Box>
            )}
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>제품명</TableCell>
                  <TableCell>구분</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell align="right">단가</TableCell>
                  <TableCell align="right">합계</TableCell>
                  <TableCell align="center">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedParts.map((part) => (
                  <TableRow key={part.id} sx={part.status === '반품완료' ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
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
                        label={part.category}
                        size="small"
                        color={
                          part.category === '기체' ? 'primary' :
                            part.category === '파츠' ? 'secondary' :
                              part.category === '공임' ? 'success' : 'default'
                        }
                      />
                    </TableCell>

                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        variant="outlined"
                        value={part.quantity}
                        onChange={(e) => handlePartQuantityChange(part.id, e.target.value)}
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
                        value={part.price}
                        onChange={(e) => handlePriceChange(part.id, e.target.value)}
                        InputProps={{
                          inputProps: { min: 0, style: { textAlign: 'right', padding: '4px 8px' } },
                          endAdornment: <InputAdornment position="end">원</InputAdornment>
                        }}
                        sx={{ width: '160px' }}
                      />
                    </TableCell>
                    <TableCell align="right">{part.totalPrice?.toLocaleString() || calculateTotal(part).toLocaleString()}원</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Select
                          size="small"
                          value={part.status || '접수'}
                          onChange={(e) => handlePartStatusChange(part.id, e.target.value)}
                          sx={{ minWidth: 90 }}
                        >
                          {(() => {
                            const items = ['접수', '부품준비', '준비완료', '작업완료', '반품완료', '출고완료'];
                            if (part.status && !items.includes(part.status)) {
                              items.unshift(part.status);
                            }
                            return items.map(s => (
                              <MenuItem key={s} value={s}>{s}</MenuItem>
                            ));
                          })()}
                        </Select>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemovePart(part.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>
                    총 합계
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {sortedParts.reduce((sum, part) => sum + (part.totalPrice || calculateTotal(part)), 0).toLocaleString()}원
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

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
              총 {uploadedData.length}개의 항목이 발견되었습니다. 다음 데이터를 추가하시겠습니까?
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
                      width: `${uploadProgress}% `,
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
                        {row['카테고리'] || determineCategoryForExcel(row['제품코드'], row['제품명'], row['가격'])}
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
                  • 엑셀 데이터의 제품 정보가 현재 폼에 추가됩니다.<br />
                  • 새 출고 등록 시 첫 번째 항목의 고객 정보가 자동으로 설정됩니다.<br />
                  • 카테고리가 지정되지 않은 경우 제품 코드를 기준으로 자동 분류됩니다.
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
            onClick={handleProcessExcelData}
            disabled={isUploading || uploadedData.length === 0}
          >
            추가
          </Button>
        </DialogActions>
      </Dialog>

      {/* 부품 선택 다이얼로그 */}
      <Dialog open={openPartsDialog} onClose={handleClosePartsDialog} maxWidth="md" fullWidth transitionDuration={0}>
        <DialogTitle>제품 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="제품 검색"
                placeholder="제품명 또는 코드로 검색"
                value={partInputValue}
                onChange={(e) => setPartInputValue(e.target.value)}
                onKeyPress={handlePartKeyPress}
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                startIcon={<SearchIcon />}
                sx={{ minWidth: '100px' }}
              >
                검색
              </Button>
            </Box>

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {isSearching ? '검색 중...' :
                  filteredParts.length > 100
                    ? '100개 이상의 결과 (구체적으로 검색해주세요)'
                    : `검색 결과: ${filteredParts.length} 개`}
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

            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>제품명</TableCell>
                    <TableCell>코드</TableCell>
                    <TableCell align="right">가격</TableCell>
                    <TableCell>선택</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedParts.map((part) => (
                    <TableRow
                      key={part.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{part.name}</TableCell>
                      <TableCell>{part.code}</TableCell>
                      <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                      <TableCell>
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
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        검색 결과가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {isSearching && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" sx={{ ml: 2 }}>검색 중...</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePartsDialog}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>메모</Typography>
        <TextField
          fullWidth
          name="note"
          value={shipmentData.note || ''}
          onChange={handleChange}
          multiline
          rows={3}
          placeholder="메모를 입력하세요"
        />
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ShipmentForm; 