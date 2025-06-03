import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Chip,
  InputAdornment,
  Autocomplete,
  LinearProgress
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CloudUpload as CloudUploadIcon,
  Print as PrintIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { debounce } from 'lodash';

// 부품 카테고리 정의
const PART_CATEGORIES = ['기체', '파츠', '공임', '기타'];

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

function ShipmentForm() {
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
    status: '준비중',
    delivery_method: '택배',
    tracking_number: '',
    note: '',
    sales_channel: '공홈'
  });

  const [selectedParts, setSelectedParts] = useState([]);
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [partInputValue, setPartInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [allParts, setAllParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('기체');
  
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
  const { id } = useParams();
  const isEditMode = !!id;

  // 검색을 위한 상태 수정
  const [isSearching, setIsSearching] = useState(false);

  // 메모이제이션된 필터링 함수
  const filteredParts = useMemo(() => {
    setIsSearching(true);
    
    if (!searchTerm) {
      setIsSearching(false);
      return allParts.slice(0, 50); // 검색어 없을 때는 처음 50개만 표시
    }
    
    const searchLower = searchTerm.toLowerCase();
    const filtered = allParts.filter(part => 
      (part.name && part.name.toLowerCase().includes(searchLower)) ||
      (part.code && part.code.toLowerCase().includes(searchLower))
    ).slice(0, 100); // 최대 100개 결과로 제한
    
    setIsSearching(false);
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
      setShipmentData({
        ...data,
        order_date: data.order_date || data.created_at?.split('T')[0],
        shipment_date: data.shipment_date || new Date().toISOString().split('T')[0],
        sales_channel: extractSalesChannel(data.note) || '공홈'
      });

      // 부품 정보 조회
      try {
        const { data: parts, error: partsError } = await supabase
          .from('shipment_parts')
          .select('*')
          .eq('shipment_id', id);

        if (!partsError && parts) {
          const formattedParts = parts.map(part => ({
            id: part.id,
            part_name: part.part_name,
            part_code: part.part_code,
            category: part.part_category || '기체',
            quantity: part.quantity,
            price: part.price,
            totalPrice: part.total_price || part.price * part.quantity
          }));
          
          setSelectedParts(formattedParts);
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

  const fetchAllParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', shipmentData.brand)
        .order('name');

      if (error) throw error;
      setAllParts(data || []);
      // 필터링된 부품 목록 초기화는 useMemo에서 처리
    } catch (error) {
      console.error('Error fetching parts:', error);
    }
  };

  // 브랜드 변경 시 부품 목록 가져오기
  useEffect(() => {
    // 브랜드가 변경되면 부품 목록 다시 가져오기
    fetchAllParts();
  }, [shipmentData.brand]);

  // 검색어 처리 함수 최적화 (디바운싱 적용)
  const handlePartInputChange = (e) => {
    setPartInputValue(e.target.value);
    setPage(0); // 검색어 변경 시 첫 페이지로 이동
  };

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
    setShipmentData(prev => ({
      ...prev,
      [name]: value
    }));

    // 판매처가 청담매장인 경우 자동으로 주소 채우기
    if (name === 'sales_channel' && value === '청담매장') {
      setShipmentData(prev => ({
        ...prev,
        customer_address: '서울특별시 강남구 청담동 88-6 1층'
      }));
    }
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
      message: `${partToAdd.name} 추가됨 (또는 수량 증가)`,
      severity: 'success'
    });
  };

  const handleRemovePart = (id) => {
    setSelectedParts(prev => prev.filter(part => part.id !== id));
  };

  // 텔레그램 알림 전송 함수 (컴포넌트 내에 추가)
  const sendTelegramNotification = async (message) => {
    const botToken = '7355852231:AAE4d36OyayXQbhSDPCJydDi0hte0f4R2x0';
    const chatId = '-4682658690';
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      const responseData = await response.json();
      if (!response.ok) {
        console.error('텔레그램 API 에러:', responseData);
        setSnackbar({
          open: true,
          message: `텔레그램 알림 전송 실패: ${responseData.description || '알 수 없는 오류'}`,
          severity: 'error'
        });
      }
    } catch (e) {
      console.error('텔레그램 알림 전송 중 네트워크/기타 실패:', e);
      setSnackbar({
        open: true,
        message: '텔레그램 알림 전송 중 오류 발생 (네트워크 등)',
        severity: 'error'
      });
    }
  };

  const handleSubmit = async () => {
    // 필수 입력값 검증
    const requiredFields = [
      { field: 'customer_name', label: '고객명' },
      { field: 'customer_phone', label: '연락처' },
      { field: 'shipment_date', label: '출고일' }
    ];
    
    const missingFields = requiredFields.filter(({ field }) => !shipmentData[field]);
    
    if (missingFields.length > 0) {
      setSnackbar({
        open: true,
        message: `다음 필수 정보를 입력해주세요: ${missingFields.map(f => f.label).join(', ')}`,
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
    
    setSaving(true);
    let shipmentId = id;

    try {
      // 판매처 정보를 메모에 포함
      let finalNote = shipmentData.note || '';
      if (shipmentData.sales_channel) {
        if (finalNote.includes('[판매처:')) {
          finalNote = finalNote.replace(/\[판매처: .*?\]/, `[판매처: ${shipmentData.sales_channel}]`);
        } else {
          finalNote = `[판매처: ${shipmentData.sales_channel}] ${finalNote}`.trim();
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
        customer_name: shipmentData.customer_name.trim(),
        customer_phone: shipmentData.customer_phone.trim(),
        customer_address: shipmentData.customer_address.trim(),
        delivery_method: shipmentData.delivery_method,
        tracking_number: shipmentData.tracking_number?.trim() || '',
        note: finalNote.trim(),
        product_name: combinedProductName,
        product_code: selectedParts[0]?.part_code || '',
        quantity: totalQuantity,
        price: totalPrice,
        updated_at: new Date().toISOString()
      };
      
      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('shipments')
          .update(shipmentSaveData)
          .eq('id', id);
        if (updateError) throw new Error(`출고 정보 업데이트 중 오류: ${updateError.message}`);
      } else {
        const { data: newShipment, error: insertError } = await supabase
          .from('shipments')
          .insert([shipmentSaveData])
          .select();
        if (insertError) throw new Error(`새 출고 정보 저장 중 오류: ${insertError.message}`);
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
          created_at: new Date().toISOString()
        }));
        
        const { error: insertPartsError } = await supabase
          .from('shipment_parts')
          .insert(partsData);
        if (insertPartsError) throw new Error(`부품 정보 저장 중 오류: ${insertPartsError.message}`);
      }
      
      // 등록 성공 후 알림 추가
      const notificationPayload = {
        type: isEditMode ? 'shipment_update' : 'shipment_create',
        message: isEditMode 
          ? `출고 수정 (출고번호: ${id}) - 고객: ${shipmentSaveData.customer_name}, 연락처: ${shipmentSaveData.customer_phone}`
          : `출고 등록 (출고번호: ${shipmentId}) - 고객: ${shipmentSaveData.customer_name}, 연락처: ${shipmentSaveData.customer_phone}`,
        link: `/shipment/${isEditMode ? id : shipmentId}`
      };
      
      const { error: notificationError } = await supabase.from('notifications').insert(notificationPayload);
      if (notificationError) {
        console.error('Supabase 알림 저장 실패:', notificationError);
        // 알림 저장 실패는 사용자에게 심각한 오류로 알리지 않되, 로깅은 중요
        setSnackbar({
          open: true,
          message: '출고 정보는 저장되었으나, 알림 등록에 실패했습니다.',
          severity: 'warning'
        });
      } else {
        console.log('Supabase 알림 저장 성공.');
      }

      // 텔레그램 알림은 여기서 await으로 결과 기다림
      await sendTelegramNotification(notificationPayload.message);
      console.log('텔레그램 알림 전송 시도 완료.');

      setSnackbar({
        open: true,
        message: isEditMode ? '출고 정보가 성공적으로 수정되었습니다.' : '출고 정보가 성공적으로 등록되었습니다.',
        severity: 'success'
      });
      
      // 모든 작업이 성공적으로 끝난 후 목록 페이지로 이동
      setTimeout(() => {
        navigate('/shipment');
      }, 1500); // 사용자 메시지 인지 시간
      
    } catch (error) {
      console.error('Error saving shipment:', error);
      setSnackbar({
        open: true,
        message: `저장 중 오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/shipment');
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

      // 기존에 분리된 부품이 있는 경우, 각 부품에 대해 파츠 관리에서 가격 정보 업데이트 시도
      if (partsExists) {
        const updatedParts = [];
        
        for (const part of selectedParts) {
          let foundPart = null;
          let updatedPart = { ...part };
          
          // 1. 정확한 이름으로 검색
          const { data: exactMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .eq('name', part.part_name)
            .limit(1);
            
          if (exactMatchParts && exactMatchParts.length > 0) {
            foundPart = exactMatchParts[0];
          } else {
            // 2. 부분 일치 검색
            const { data: partialMatchParts } = await supabase
              .from('parts')
              .select('*')
              .eq('brand', shipment.brand)
              .ilike('name', `%${part.part_name}%`)
              .limit(1);
              
            if (partialMatchParts && partialMatchParts.length > 0) {
              foundPart = partialMatchParts[0];
            }
          }
          
          // 파츠 관리에서 해당 부품을 찾았다면 가격 업데이트
          if (foundPart) {
            // 가격이 다른 경우에만 업데이트 카운트 증가
            if (foundPart.price !== updatedPart.price) {
              priceUpdated++;
            }
            
            // 파츠 관리의 코드와 가격 적용
            updatedPart.part_code = foundPart.code || updatedPart.part_code;
            updatedPart.price = foundPart.price || 0;
            updatedPart.totalPrice = foundPart.price * (updatedPart.quantity || 1);
            
            // 카테고리 업데이트 로직
            let category = updatedPart.category;
            
            // 노트에서 카테고리 정보 확인
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
            
            // 코드에서 카테고리 정보 확인
            if (foundPart.code) {
              const code = foundPart.code.toUpperCase();
              if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
                category = '파츠';
              } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
                category = '공임';
              } else if (code.startsWith('XRBM-') || code.startsWith('NBM-') || code.includes('BIKE')) {
                category = '기체';
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
          message: `${priceUpdated}개 제품의 가격 정보가 파츠 관리 기준으로 업데이트되었습니다.`,
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
          
          // 파츠 관리 시스템에서 매칭되는 제품 검색 - 이름이 정확히 일치하는 항목 우선
          let partFromDB = null;
          
          // 1. 정확한 이름으로 검색 (정확히 일치하는 제품 먼저 찾기)
          const { data: exactMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .eq('name', productName)
            .limit(1);
            
          if (exactMatchParts && exactMatchParts.length > 0) {
            partFromDB = exactMatchParts[0];
          } else {
            // 2. 정확히 일치하는 제품이 없으면 부분 일치 검색
            const { data: partialMatchParts } = await supabase
              .from('parts')
              .select('*')
              .eq('brand', shipment.brand)
              .ilike('name', `%${productName}%`)
              .limit(1);
              
            if (partialMatchParts && partialMatchParts.length > 0) {
              partFromDB = partialMatchParts[0];
            }
          }
            
          if (partFromDB) {
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
            
            // 파츠 관리 시스템에서 코드 패턴으로 카테고리 추정
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
            
            // 파츠 관리의 가격 사용 (중요: 항상 파츠 관리의 가격 우선 적용)
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
          message: `${newParts.length}개의 제품으로 분리하여 분석했습니다. ${partsUpdated}개의 제품 가격과 구분이 파츠 관리 기준으로 업데이트되었습니다.`,
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

        // 3. 파츠 관리 시스템에서 매칭되는 제품 검색 - 이름이 정확히 일치하는 항목 우선
        let partFromDB = null;
        
        // 1. 정확한 이름으로 검색 (정확히 일치하는 제품 먼저 찾기)
        const { data: exactMatchParts } = await supabase
          .from('parts')
          .select('*')
          .eq('brand', shipment.brand)
          .eq('name', shipment.product_name)
          .limit(1);
          
        if (exactMatchParts && exactMatchParts.length > 0) {
          partFromDB = exactMatchParts[0];
        } else {
          // 2. 정확히 일치하는 제품이 없으면 부분 일치 검색
          const { data: partialMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .ilike('name', `%${shipment.product_name}%`)
            .limit(1);
            
          if (partialMatchParts && partialMatchParts.length > 0) {
            partFromDB = partialMatchParts[0];
          }
        }

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
          
          // 파츠 관리의 코드와 가격 사용 (중요: 항상 파츠 관리의 가격 우선 적용)
          partCode = partFromDB.code || partCode;
          price = partFromDB.price || 0;
          updatedFromDB = true;
        } else {
          // 파츠 관리에서 찾지 못한 경우 기존 가격 사용
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
            ? '제품 정보가 파츠 관리 기준으로 업데이트되었습니다.' 
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

  // 엑셀 데이터를 부품 목록으로 변환
  const handleProcessExcelData = () => {
    if (uploadedData.length === 0) return;
    
    try {
      // 엑셀 데이터를 부품 목록으로 변환
      const newParts = uploadedData.map((item, index) => {
        // 카테고리 결정
        const category = item['카테고리'] || determineCategoryForExcel(item['제품코드'], item['제품명'], item['가격']);
        
        return {
          id: Date.now() + index, // 임시 ID
          part_name: item['제품명'],
          part_code: item['제품코드'] || '',
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
          finalNote = `[판매처: ${salesChannel}] ${firstItem['메모']}`;
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
      XLSX.writeFile(workbook, `출고등록템플릿_${shipmentData.brand}.xlsx`);

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

  // 견적서 출력 함수 (이미지 양식 참고)
  const handlePrintEstimate = () => {
    const today = new Date();
    const estimateTotal = selectedParts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
    const taxTotal = Math.round(estimateTotal * 0.1);
    const totalInKorean = '영'; // 숫자 한글 변환 함수 필요시 추가
    const printHtml = `
      <html>
        <head>
          <title>견적서</title>
          <style>
            body { font-family: 'Noto Sans KR', Arial, sans-serif; margin: 0; padding: 40px; }
            .title { font-size: 2.2rem; font-weight: bold; margin-bottom: 24px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .info-table td { padding: 6px 10px; font-size: 1rem; border: none; }
            .info-table .label { font-weight: 500; width: 110px; }
            .info-table .value { font-weight: 400; }
            .info-table .section { font-weight: 500; width: 80px; }
            .info-table .right { text-align: right; }
            .info-table .bold { font-weight: bold; }
            .info-table .border-b { border-bottom: 1.5px solid #222; }
            .estimate-box {
              border: 2.5px solid #111;
              margin: 18px 0 12px 0;
              padding: 12px 0;
              display: flex;
              align-items: center;
              font-size: 1.1rem;
              font-weight: 500;
            }
            .estimate-box > div { flex: 1; text-align: center; }
            .estimate-box .label { font-weight: bold; font-size: 1.1rem; }
            .estimate-box .amount { font-size: 1.2rem; font-weight: bold; }
            .estimate-box .note { font-size: 1rem; text-align: right; }
            .estimate-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 0;
              font-size: 1rem;
            }
            .estimate-table th, .estimate-table td {
              border: 1.5px solid #222;
              padding: 8px 6px;
              text-align: center;
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
          <table class="info-table">
            <tr>
              <td class="label">수&nbsp;&nbsp;&nbsp;&nbsp;신</td>
              <td class="value">${shipmentData.customer_name || ''}</td>
              <td class="label">상&nbsp;&nbsp;&nbsp;&nbsp;호</td>
              <td class="value">(주)슬림팩</td>
              <td class="label">대표</td>
              <td class="value"> </td>
            </tr>
            <tr>
              <td class="label">견적명</td>
              <td class="value">${shipmentData.product_name || ''} 출고</td>
              <td class="label">사업자번호</td>
              <td class="value">230-81-03757</td>
              <td class="label">전화번호</td>
              <td class="value">02-548-8890</td>
            </tr>
            <tr>
              <td class="label">견적날짜</td>
              <td class="value">${today.getFullYear()}년 ${String(today.getMonth()+1).padStart(2,'0')}월 ${String(today.getDate()).padStart(2,'0')}일</td>
              <td class="label">주소</td>
              <td class="value" colspan="3">서울시 강남구 도산대로55길 18 1층</td>
            </tr>
            <tr>
              <td class="label">유효기간</td>
              <td class="value">견적일로부터 1개월</td>
              <td class="label">E-mail</td>
              <td class="value" colspan="3"></td>
            </tr>
          </table>
          <div class="estimate-box">
            <div class="label">견적금액</div>
            <div>일금&nbsp;${totalInKorean}</div>
            <div class="amount">( ￦${estimateTotal.toLocaleString()} )</div>
            <div class="note">※ 부가세포함</div>
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
              ${selectedParts.map((part, idx) => {
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
              ${Array.from({length: Math.max(5 - selectedParts.length, 0)}).map(() => `
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
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
          목록으로
        </Button>
        <Typography variant="h5">
          {isEditMode ? '출고 정보 수정' : '신규 출고 등록'}
        </Typography>
        <Box>
          {isEditMode ? (
            <Button 
              variant="contained" 
              startIcon={<SaveIcon />} 
              onClick={handleSubmit}
              disabled={saving || analyzing}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
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
                variant="contained" 
                startIcon={<SaveIcon />} 
                onClick={handleSubmit}
                disabled={saving || analyzing}
              >
                {saving ? '저장 중...' : '저장'}
              </Button>
            </>
          )}
        </Box>
      </Box>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>기본 정보</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>브랜드</InputLabel>
              <Select
                name="brand"
                value={shipmentData.brand}
                onChange={handleChange}
                label="브랜드"
              >
                <MenuItem value="XRB">X-RIDER</MenuItem>
                <MenuItem value="NB">NEARBIKE</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="고객명"
              name="customer_name"
              value={shipmentData.customer_name}
              onChange={handleChange}
              required
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="연락처"
              name="customer_phone"
              value={shipmentData.customer_phone}
              onChange={handleChange}
              required
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="주소"
              name="customer_address"
              value={shipmentData.customer_address}
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
                <MenuItem value="기타">기타</MenuItem>
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
            <FormControl fullWidth>
              <InputLabel>상태</InputLabel>
              <Select
                name="status"
                value={shipmentData.status}
                onChange={handleChange}
                label="상태"
              >
                <MenuItem value="준비중">준비중</MenuItem>
                <MenuItem value="배송중">배송중</MenuItem>
                <MenuItem value="출고완료">출고완료</MenuItem>
              </Select>
            </FormControl>
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
                  <TableCell align="right">관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedParts.map((part) => (
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
                        sx={{ width: '120px' }}
                      />
                    </TableCell>
                    <TableCell align="right">{part.totalPrice?.toLocaleString() || calculateTotal(part).toLocaleString()}원</TableCell>
                    <TableCell align="right">
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
                    {selectedParts.reduce((sum, part) => sum + (part.totalPrice || calculateTotal(part)), 0).toLocaleString()}원
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
          value={shipmentData.note}
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