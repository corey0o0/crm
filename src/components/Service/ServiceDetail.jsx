import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, ensureConnection } from '../../lib/supabaseClient';
import useAutoSave from '../../hooks/useAutoSave';
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Typography,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  ButtonGroup,
  Chip,
  Autocomplete,
  Stack,
  Popover,
  ImageList,
  ImageListItem,
  Link,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Switch,
  FormControlLabel
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { ko } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import {
  Close as CloseIconMui,
  ZoomIn as ZoomInIcon,
  Preview as PreviewIcon,
  Print as PrintIcon,
  Description as DescriptionIcon,
  CloudDone as CloudDoneIcon
} from '@mui/icons-material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { formatKoreanDateTime } from '../../utils/dateUtils';
import { format } from 'date-fns';
import { sendTelegramNotification } from '../../lib/telegram';
import { processServiceCompletion, processPartialReturn, processServiceRevert, normalizeServiceStatus } from '../../utils/inventoryUtils';
import { getAppSetting } from '../../api/settingsApi';
import { useAuth } from '../../contexts/AuthContext';
import { MASTER_ACCOUNTS } from '../../config/menuConfig';
import { pendingOutboundApi } from '../../api/pendingOutboundApi';
// import { addServicePartsToPendingOrders } from '../../utils/pendingOrderUtils'; // 주문대기 기능 비활성화
import {
  uploadFileToR2,
  findOrCreateFolder,
  getFixedR2Url
} from '../../utils/cloudflareR2Utils';

// PDF worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;


export const getReturnedQty = (usage) => {
  if (!usage) return 0;
  if (usage.includes('[반품완료]')) return -1; // -1 means fully returned
  let rQty = 0;
  if (usage.includes('[부분반품:')) {
    const matches = usage.match(/\[부분반품:(\d+)개\]/g);
    if (matches) {
      matches.forEach(m => {
        const qMatch = m.match(/\[부분반품:(\d+)개\]/);
        if (qMatch) rQty += parseInt(qMatch[1], 10);
      });
    }
  }
  return rQty;
};

function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [initialStatus, setInitialStatus] = useState(null); // 초기 상태 저장
  const [formData, setFormData] = useState({
    brand: '',
    reception_date: null,
    reception_time: '',
    repair_date: null,
    completion_date: null,
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    product_name: '',
    mileage: '',
    note: '',
    symptom: '',
    solution: '',
    reception_type: '',
    status: '',
    delivery_method: '',
    seller: '',
    writer: ''
  });
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [selectedParts, setSelectedParts] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [tags, setTags] = useState([]);
  const [availableTags] = useState([
    '배터리스위치', '전체점검', '브레이크-패드', '브레이크-로터', '브레이크-교체', '배터리', '펑크',
    '충전기', '모터', '워런티', '사고-보험', 'E07', 'E09', 'E010'
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);

  const handleAddToPendingOutbounds = async () => {
    const partsToInspect = selectedParts.filter(part => !part.record_id && !(part.usage && part.usage.includes('[반품완료]')));

    if (partsToInspect.length === 0) {
      alert("검수 대기열에 추가할 새 부품이 없습니다. (이미 저장된 부품만 존재합니다)");
      return;
    }

    if (!window.confirm("새로 추가된 부품을 검수 대기열로 전송하시겠습니까? (현재 작성중인 내용이 자동으로 저장됩니다.)")) return;

    try {
      setAddingToQueue(true);

      await handleSubmit(null, { status: '부품준비' });

      const orderData = {
        order_no: `AS-${id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`, // 식별을 위해 타임스탬프 추가
        type: 'A/S 출고',
        source_id: id,
        status: '대기',
        items: partsToInspect.map(part => ({
          part_id: part.part_id || part.id,
          name: part.part_name || part.name,
          code: part.part_code || part.code || '',
          barcode: part.part_code || part.code || '',
          expected_qty: part.quantity
        }))
      };
      
      await pendingOutboundApi.create(orderData);
      
      setFormData(prev => ({ ...prev, status: '부품준비' }));
      setInitialStatus('부품준비');
      
      setSnackbar({
        open: true,
        message: '자동 저장 및 검수 대기열 등록이 완료되었습니다.',
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

  // 파일 업로드 관련 상태
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [modifiedPrice, setModifiedPrice] = useState('');
  const [partDialogOpen, setPartDialogOpen] = useState(false);
  const [tag, setTag] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [brand, setBrand] = useState('');

  // 창고 상태 추가
  const [warehouses, setWarehouses] = useState([]);
  const [isInspectionEnabled, setIsInspectionEnabled] = useState(false);

  // 창고 목록 불러오기
  const fetchWarehouses = async () => {
    try {
      const { data } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(data || []);
    } catch (e) {
      console.error('창고 로딩 에러:', e);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    const fetchSettings = async () => {
      const { data } = await getAppSetting('inspection_settings');
      if (data && typeof data.as_enabled !== 'undefined') {
        setIsInspectionEnabled(!!data.as_enabled);
      }
    };
    fetchSettings();
  }, []);

  // 변경사항 감지를 위한 상태 추가
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  // 로딩 상태 추적을 위한 ref
  const isLoadingRef = React.useRef(false);

  // 강제 리렌더링을 위한 key 상태
  const [componentKey, setComponentKey] = useState(0);

  // 자동저장 Hook (수정 모드일 때만 활성화)
  const autoSave = useAutoSave(
    {
      formData,
      selectedParts,
      tags
    },
    `serviceDetail_${id}`,
    30000, // 30초
    isEditing // 수정 중일 때만 자동저장
  );

  // 변경사항 감지 함수
  const checkForChanges = useCallback(() => {
    if (!initialData || isFormSubmitted || !isEditing) return;

    const currentData = {
      formData,
      selectedParts: selectedParts.map(part => ({
        id: part.id,
        part_id: part.part_id,
        quantity: part.quantity,
        price: part.price,
        usage: part.usage
      })),
      tags: tags.slice().sort()
    };

    const hasChanges = JSON.stringify(currentData) !== JSON.stringify(initialData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, selectedParts, tags, initialData, isFormSubmitted, isEditing]);

  // 폼 데이터 변경 감지
  useEffect(() => {
    checkForChanges();
  }, [checkForChanges]);

  // 페이지 떠날 때 확인 메시지
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 브라우저 새로고침/닫기 방지
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

  // 접수시간 옵션 (10:00~20:00, 30분 단위)
  const RECEPTION_TIME_OPTIONS = [];
  for (let h = 10; h <= 20; h++) {
    RECEPTION_TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 20) RECEPTION_TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
  }

  const fetchServiceDetail = React.useCallback(async (retryCount = 0) => {
    try {
      console.log(`[ServiceDetail] fetchServiceDetail 호출됨 - retryCount: ${retryCount}, isLoadingRef: ${isLoadingRef.current}`);

      // 이미 로딩 중이면 중복 요청 방지 (재시도가 아닌 경우에만)
      if (isLoadingRef.current && retryCount === 0) {
        console.log('[ServiceDetail] 이미 로딩 중이므로 요청을 건너뜁니다.');
        return;
      }

      // 상태 초기화
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('[ServiceDetail] 상태 초기화 완료, 데이터 로딩 시작');

      // ID 유효성 검사 추가
      if (!id) {
        console.error('[ServiceDetail] ID가 없습니다.');
        throw new Error('A/S ID가 없습니다.');
      }

      // 유휴 후 재연결 확인
      console.log('[ServiceDetail] 연결 상태 확인 중...');
      const connectionOk = await ensureConnection();
      if (!connectionOk) {
        console.warn('[ServiceDetail] 재연결 실패 - 계속 시도');
      }

      console.log(`[ServiceDetail] 데이터 로딩 시작 - 시도 ${retryCount + 1}/3, ID: ${id}`);

      // 단순 쿼리로 먼저 서비스 데이터만 가져오기
      console.log('[ServiceDetail] Supabase 쿼리 시작 (단순 쿼리)');

      let serviceData = null;
      let serviceError = null;

      try {
        // 3초 타임아웃 (빠른 응답 없으면 즉시 새로고침)
        const queryTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('쿼리 시간 초과')), 3000);
        });

        const serviceQuery = supabase
          .from('services')
          .select('*')
          .eq('id', id)
          .single();

        const result = await Promise.race([
          serviceQuery,
          queryTimeout
        ]);

        serviceData = result.data;
        serviceError = result.error;

        console.log('[ServiceDetail] 쿼리 응답 수신:', {
          hasData: !!serviceData,
          hasError: !!serviceError,
          errorMsg: serviceError?.message
        });
      } catch (timeoutError) {
        // Promise.race에서 reject된 경우 (타임아웃)
        console.error('[ServiceDetail] 쿼리 타임아웃 발생:', timeoutError.message);
        serviceError = timeoutError;
      }

      console.log('[ServiceDetail] 기본 데이터 쿼리 완료 - 데이터:', !!serviceData, '에러:', !!serviceError);

      // 기본 데이터 로딩 후 추가 데이터(parts, tags) 별도로 로딩
      let serviceParts = [];
      let serviceTags = [];

      if (serviceData && !serviceError) {
        try {
          // 부품 정보 로딩
          const { data: partsData } = await supabase
            .from('service_parts')
            .select('id, part_id, quantity, price, usage, status')
            .eq('service_id', id);

          serviceParts = partsData || [];
          console.log('[ServiceDetail] 부품 데이터 로딩 완료:', serviceParts.length);

          // 태그 정보 로딩
          const { data: tagsData } = await supabase
            .from('service_tags')
            .select('tag_name')
            .eq('service_id', id);

          serviceTags = tagsData || [];
          console.log('[ServiceDetail] 태그 데이터 로딩 완료:', serviceTags.length);
        } catch (extraErr) {
          console.warn('[ServiceDetail] 추가 데이터 로딩 오류 (무시):', extraErr);
          // 추가 데이터 로딩 실패는 무시하고 진행
        }
      }

      if (serviceError) {
        console.error(`[ServiceDetail] 데이터 로딩 오류 (시도 ${retryCount + 1}):`, serviceError);

        // 재시도 로직 개선 - 타임아웃은 즉시 새로고침
        const isTimeout = serviceError.message.includes('쿼리 시간 초과') ||
          serviceError.message.includes('timeout') ||
          serviceError.name === 'AbortError';

        if (retryCount < 2 && (
          isTimeout ||
          serviceError.code === 'PGRST116' ||
          serviceError.message.includes('network') ||
          serviceError.message.includes('fetch') ||
          serviceError.message.includes('Failed to fetch') ||
          serviceError.message.includes('JWT') ||
          serviceError.message.includes('auth') ||
          serviceError.message.includes('401')
        )) {
          // 1차 타임아웃 시 즉시 페이지 새로고침 (가장 확실한 해결책)
          if (retryCount === 0 && isTimeout) {
            console.log('[ServiceDetail] 1차 타임아웃 - 페이지 새로고침으로 즉시 복구');
            // 에러 메시지 없이 바로 새로고침 (로딩 상태 유지)
            setTimeout(() => {
              console.log('[ServiceDetail] 데이터 로딩 지연 확인됨');
              window.alert('데이터 로딩 지연으로 인해 일시적인 오류가 발생했습니다. 잠시 후 새로고침(F5) 해주세요.');
              // 자동 새로고침 비활성화
              // window.location.reload();
            }, 500);
            return;
          }

          // 기타 에러는 일반 재시도
          console.log(`[ServiceDetail] 재시도 준비 중... (${retryCount + 1}/2)`);
          const retryDelay = 1000 * (retryCount + 1);
          console.log(`[ServiceDetail] ${retryDelay}ms 후 재시도...`);

          setTimeout(() => {
            fetchServiceDetail(retryCount + 1);
          }, retryDelay);
          return;
        }

        throw serviceError;
      }

      if (!serviceData) {
        console.error('[ServiceDetail] 서비스 데이터가 null입니다.');
        throw new Error('서비스 데이터를 찾을 수 없습니다.');
      }

      // 별도로 로딩한 parts, tags 데이터를 serviceData에 추가
      serviceData.service_parts = serviceParts;
      serviceData.service_tags = serviceTags;

      console.log('[ServiceDetail] 데이터 로딩 성공:', {
        id: serviceData.id,
        customer_name: serviceData.customer_name,
        status: serviceData.status,
        service_parts_count: serviceParts.length,
        service_tags_count: serviceTags.length
      });

      let receptionDate = null;
      let receptionTime = '10:30'; // 기본값
      let completionDate = null;
      let completionTime = '00:00';

      if (serviceData.reception_date) {
        const dateObj = new Date(serviceData.reception_date);
        const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\.$/, '');
        let hour = String(dateObj.getHours()).padStart(2, '0');
        let min = String(dateObj.getMinutes()).padStart(2, '0');
        let timeStr = `${hour}:${min}`;
        // RECEPTION_TIME_OPTIONS에 없는 값이면 기본값('10:30')으로 대체
        if (!RECEPTION_TIME_OPTIONS.includes(timeStr)) {
          timeStr = '10:30';
        }
        receptionDate = dateStr;
        receptionTime = timeStr;
      }

      if (serviceData.completion_date) {
        const dateObj = new Date(serviceData.completion_date);
        const dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace(/\.$/, '');
        const timeStr = dateObj.toTimeString().slice(0, 5);
        completionDate = dateStr;
        completionTime = timeStr;

        console.log('Loading Completion DateTime:', {
          original: serviceData.completion_date,
          convertedDate: completionDate,
          convertedTime: completionTime
        });
      }

      if (serviceData.note && !serviceData.seller) {
        const { error: updateError } = await supabase
          .from('services')
          .update({
            seller: serviceData.note,
            note: ''
          })
          .eq('id', id);

        if (!updateError) {
          serviceData.seller = serviceData.note;
          serviceData.note = '';
        }
      }

      if (Array.isArray(serviceData.service_tags)) {
        setTags(serviceData.service_tags.map(t => t.tag_name));
      }

      const mileage = serviceData.mileage === null ? '' : serviceData.mileage;

      // 초기 상태 저장 (구 상태값 정규화 포함)
      const normalizedStatus = normalizeServiceStatus(serviceData.status);
      setInitialStatus(normalizedStatus);

      let defaultWarehouseId = serviceData.warehouse_id;
      if (!defaultWarehouseId) {
        const { data: defaultWh } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').limit(1).maybeSingle();
        if (defaultWh) defaultWarehouseId = defaultWh.id;
      }

      setFormData({
        ...serviceData,
        status: normalizedStatus,
        reception_date: receptionDate,
        reception_time: receptionTime,
        completion_date: completionDate,
        completion_time: completionTime,
        service_parts: (serviceData.service_parts || []).map(sp => ({
          ...sp,
          status: normalizeServiceStatus(sp.status || serviceData.status)
        })),
        writer: serviceData.writer || '관리자',
        mileage: mileage,
        warehouse_id: defaultWarehouseId
      });

      console.log('Loaded reception data:', {
        original: serviceData.reception_date,
        convertedDate: receptionDate,
        convertedTime: receptionTime,
        fullDate: serviceData.reception_date ? new Date(serviceData.reception_date).toISOString() : null
      });

      // 업로드된 파일 정보 로딩
      try {
        const { data: filesData, error: filesError } = await supabase
          .from('service_files')
          .select('*')
          .eq('service_id', id)
          .order('upload_date', { ascending: false });

        if (!filesError && filesData) {
          const formattedFiles = filesData.map(file => ({
            id: file.file_id,
            name: file.file_name,
            webViewLink: file.web_view_link,
            webContentLink: file.web_content_link,
            size: file.file_size,
            type: file.file_type,
            uploadDate: file.upload_date,
            dbId: file.id  // DB의 primary key 저장
          }));
          setUploadedFiles(formattedFiles);
          console.log('[ServiceDetail] 업로드된 파일 로딩 완료:', formattedFiles.length);
        }
      } catch (filesErr) {
        console.warn('[ServiceDetail] 파일 정보 로딩 오류 (무시):', filesErr);
        // 파일 로딩 실패는 무시하고 진행
      }

      if (Array.isArray(serviceData.service_parts) && serviceData.service_parts.length > 0) {
        const partIds = serviceData.service_parts.map(sp => sp.part_id);
        const { data: partsData, error: partsError } = await supabase
          .from('parts')
          .select('*')
          .in('id', partIds);

        if (partsError) throw partsError;

        const selectedParts = serviceData.service_parts.map(sp => {
          const part = partsData.find(p => p.id === sp.part_id);
          return {
            ...part,
            record_id: sp.id,
            quantity: sp.quantity,
            price: sp.price,
            status: normalizeServiceStatus(sp.status || serviceData.status),
            usage: sp.usage || 'A/S',
            total: sp.price * sp.quantity
          };
        });

        setSelectedParts(selectedParts);

        // 초기 데이터 설정 (변경사항 감지용)
        setInitialData({
          formData: {
            ...serviceData,
            reception_date: receptionDate,
            reception_time: receptionTime,
            completion_date: completionDate,
            completion_time: completionTime,
            service_parts: serviceData.service_parts || [],
            writer: serviceData.writer || '관리자',
            mileage: mileage
          },
          selectedParts: selectedParts.map(part => ({
            id: part.id,
            part_id: part.part_id,
            quantity: part.quantity,
            price: part.price,
            status: part.status,
            usage: part.usage
          })),
          tags: Array.isArray(serviceData.service_tags) ? serviceData.service_tags.map(t => t.tag_name).sort() : [],
        });
      } else {
        // 부품이 없는 경우에도 초기 데이터 설정
        setInitialData({
          formData: {
            ...serviceData,
            reception_date: receptionDate,
            reception_time: receptionTime,
            completion_date: completionDate,
            completion_time: completionTime,
            service_parts: serviceData.service_parts || [],
            writer: serviceData.writer || '관리자',
            mileage: mileage
          },
          selectedParts: [],
          tags: Array.isArray(serviceData.service_tags) ? serviceData.service_tags.map(t => t.tag_name).sort() : [],
        });
      }
    } catch (err) {
      console.error('[ServiceDetail] 데이터 로딩 최종 실패:', err);

      let errorMessage = '데이터를 불러오는 중 오류가 발생했습니다.';

      if (err.message.includes('JWT') || err.message.includes('auth') || err.message.includes('401') || err.message.includes('Unauthorized')) {
        errorMessage = '데이터 로딩 중 오류가 발생했습니다. 다시 시도해주세요.';
        // 자동 리다이렉트 제거
      } else if (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        errorMessage = '네트워크 연결을 확인해주세요.';
      } else if (err.message.includes('PGRST116') || err.code === 'PGRST116') {
        errorMessage = '해당 A/S 정보를 찾을 수 없습니다.';
      } else if (err.message.includes('A/S ID가 없습니다')) {
        errorMessage = 'A/S ID가 없습니다.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [id]);

  // ID 변경 시 데이터 로딩 (디바운싱 적용)
  useEffect(() => {
    if (!id) {
      console.warn('[ServiceDetail] ID가 없어서 데이터 로딩을 건너뜁니다.');
      setError('A/S ID가 없습니다.');
      setLoading(false);
      return;
    }

    console.log('[ServiceDetail] ID 변경 감지, 데이터 재로딩:', id);

    // 디바운싱을 위한 타이머
    const timeoutId = setTimeout(() => {
      setError(null);
      fetchServiceDetail();
    }, 100); // 100ms 디바운싱

    return () => {
      clearTimeout(timeoutId);
    };
  }, [id, fetchServiceDetail]);

  useEffect(() => {
  }, [formData]);

  const getCurrentTimeForCompletion = () => {
    const now = new Date();
    let hour = now.getHours();
    let min = now.getMinutes();
    // 30분 단위 반올림
    if (min > 44) {
      hour += 1;
      min = 0;
    } else if (min > 14) {
      min = 30;
    } else {
      min = 0;
    }
    // 시간 범위 제한: 범위 밖이면 10:30으로 고정
    if (hour < 10 || hour > 20 || (hour === 20 && min > 0)) {
      hour = 10;
      min = 30;
    }
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const applyStatusChange = (newStatus) => {
    // 상품(부품)들의 상태값 자동 동기화 (반품완료된 항목 제외)
    setSelectedParts(prev => prev.map(p => {
      if (p.status === '반품완료' || (p.usage && p.usage.includes('[반품완료]'))) return p;
      return { ...p, status: newStatus };
    }));
    setHasUnsavedChanges(true);

    setFormData(prev => ({
      ...prev,
      status: newStatus
    }));
    setIsEditing(true);
  };

  const handleStatusChange = (newStatus) => {
    // 1. 준비완료 -> 준비중 제한 (부품이 추가되어 있으면 반품 필요)
    if (formData.status === '준비완료' && newStatus === '준비중') {
      const hasActiveParts = selectedParts.some(p => p.status !== '반품완료' && (!p.usage || !p.usage.includes('[반품완료]')));
      if (hasActiveParts) {
        setSnackbar({
          open: true,
          message: '사용 부품이 추가되어 있어 준비중 상태로 변경할 수 없습니다. 부품을 먼저 반품해주세요.',
          severity: 'warning'
        });
        return; // 상태 변경 중단
      }
    }

    // 2. 준비중 -> 준비완료 확인 메시지
    if (formData.status === '준비중' && newStatus === '준비완료') {
      setConfirmDialog({
        open: true,
        title: '상태 변경 확인',
        message: 'A/S 상태를 준비완료로 변경하시겠습니까?',
        onConfirm: () => {
          applyStatusChange(newStatus);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
      return;
    }

    // 3. 출고완료 확인 메시지
    if (newStatus === '출고완료') {
      setConfirmDialog({
        open: true,
        title: 'A/S 완료 확인',
        message: '해당 A/S를 완료 처리하시겠습니까?',
        onConfirm: () => {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10);
          const timeStr = getCurrentTimeForCompletion();
          
          setSelectedParts(prev => prev.map(p => {
            if (p.status === '반품완료' || (p.usage && p.usage.includes('[반품완료]'))) return p;
            return { ...p, status: newStatus };
          }));
          setHasUnsavedChanges(true);

          setFormData(prev => {
            const updatedData = { ...prev, status: newStatus, completion_date: dateStr, completion_time: timeStr };
            return updatedData;
          });
          setIsEditing(true);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      });
      return;
    }

    // 그 외 일반적인 상태 변경
    applyStatusChange(newStatus);
  };

  const formatDateWithHour = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  const formatHourForDisplay = (dateStr) => {
    if (!dateStr) return '00';
    const date = new Date(dateStr);
    return String(date.getHours()).padStart(2, '0');
  };

  const handleAddToInspectionQueue = async () => {
    if (!selectedParts || selectedParts.length === 0) {
      setSnackbar({ open: true, message: '사용 부품을 먼저 추가해주세요.', severity: 'warning' });
      return;
    }
    await handleStatusChange('부품준비');
    setSnackbar({ open: true, message: '검수 대기열(부품준비)에 추가되었습니다.', severity: 'success' });
  };



  const handleSubmit = async (e, overrideData = {}) => {
    if (e) e.preventDefault();
    if (submitting) return; // 이중 클릭 방지
    setSubmitting(true);
    setIsFormSubmitted(true); // 폼 제출 상태로 변경

    try {
      let receptionDateTime = null;
      let completionDateTime = null;

      if (formData.reception_date && formData.reception_time) {
        receptionDateTime = `${formData.reception_date}T${formData.reception_time}:00+09:00`;
      }

      if (formData.completion_date && formData.completion_time) {
        completionDateTime = `${formData.completion_date}T${formData.completion_time}:00+09:00`;
      }

      const updateData = {
        brand: formData.brand,
        reception_date: receptionDateTime,
        completion_date: completionDateTime,
        delivery_method: formData.delivery_method,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_address: formData.customer_address,
        product_name: formData.product_name,
        symptom: formData.symptom,
        solution: formData.solution,
        status: formData.status,
        note: formData.note,
        seller: formData.seller,
        mileage: formData.mileage,
        writer: formData.writer,
        warehouse_id: formData.warehouse_id || null,
        reception_type: formData.reception_type,
        ...overrideData,
        updated_at: new Date().toISOString()
      };

      const { error: serviceError } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', id);

      if (serviceError) {
        console.error('Service update error:', serviceError);
        throw new Error(`서비스 정보 업데이트 중 오류: ${serviceError.message}`);
      }

      const { error: deletePartsError } = await supabase
        .from('service_parts')
        .delete()
        .eq('service_id', id);

      if (deletePartsError) {
        // 부품 삭제 오류는 경고로 처리하고 계속 진행할 수 있습니다. (선택적)
        console.warn('Deleting service parts error (may not be critical):', deletePartsError);
        // 또는 여기서 throw new Error로 중단할 수 있습니다.
        // throw new Error(`기존 부품 정보 삭제 중 오류: ${deletePartsError.message}`);
      }

      if (selectedParts.length > 0) {
        const partsData = selectedParts.map(part => ({
          service_id: id,
          part_id: part.id,
          quantity: part.quantity,
          price: part.price,
          status: part.status || '준비중',
          usage: part.usage || 'A/S'
        }));

        const { error: insertPartsError } = await supabase
          .from('service_parts')
          .insert(partsData);

        if (insertPartsError) {
          console.error('Inserting service parts error:', insertPartsError);
          throw new Error(`새 부품 정보 저장 중 오류: ${insertPartsError.message}`);
        }
      }

      const { error: tagDeleteError } = await supabase
        .from('service_tags')
        .delete()
        .eq('service_id', id);

      if (tagDeleteError) {
        // 태그 삭제 오류도 경고로 처리하고 계속 진행할 수 있습니다. (선택적)
        console.warn('Deleting service tags error (may not be critical):', tagDeleteError);
        // throw new Error(`기존 태그 정보 삭제 중 오류: ${tagDeleteError.message}`);
      }

      if (tags.length > 0) {
        const tagData = tags.map(tag => ({
          service_id: id,
          tag_name: tag
        }));

        const { error: tagInsertError } = await supabase
          .from('service_tags')
          .insert(tagData);

        if (tagInsertError) {
          console.error('Inserting service tags error:', tagInsertError);
          throw new Error(`새 태그 정보 저장 중 오류: ${tagInsertError.message}`);
        }
      }

      // A/S 수정 알림 및 텔레그램 전송 (비동기 처리)
      const statusChanged = initialStatus !== null && initialStatus !== formData.status;
      Promise.resolve().then(async () => {
        try {
          const notificationPayload = {
            type: 'service_update',
            message: `A/S 수정 (접수번호: ${id}) - 고객: ${formData.customer_name}, 연락처: ${formData.customer_phone}`,
            link: `/service/${id}`
          };
          await supabase.from('notifications').insert(notificationPayload);
        } catch (e) {
          console.error('A/S 수정 알림 등록 중 예외 발생:', e);
        }

        if (statusChanged) {
          try {
            await sendTelegramNotification({
              message: `A/S 상태 변경 (접수번호: ${id}) - 상태: ${initialStatus} → ${formData.status}, 고객: ${formData.customer_name}, 연락처: ${formData.customer_phone}`,
              link: `/service/${id}`
            }, { eventType: 'service_edit' });
          } catch (e) {
            console.error('A/S 상태 변경 텔레그램 알림 전송 중 오류:', e);
          }
        }
      });

      // 재고 차감/동기화 처리 (상태와 무관하게 부품이 있거나 기존 차감 내역이 있으면 항상 동기화)
      let inventoryMessage = '';
      let pendingOrderMessage = '';
      
      try {
        console.log(`A/S 재고 동기화 시작 - 서비스ID: ${id}, 브랜드: ${formData.brand}`);

        const inventoryResult = await processServiceCompletion(id, formData.brand);

        if (inventoryResult.success) {
          if (inventoryResult.results && inventoryResult.results.length > 0) {
             const deducted = inventoryResult.results.filter(r => r.change_type === 'deducted').length;
             const restored = inventoryResult.results.filter(r => r.change_type === 'restored').length;
             if (deducted > 0 || restored > 0) {
               inventoryMessage = ` (재고 동기화: 차감 ${deducted}건, 복구 ${restored}건)`;
             }
          }
        } else {
          inventoryMessage = ` 하지만 재고 동기화 중 오류 발생: ${inventoryResult.message}`;
          console.error('재고 동기화 오류 상세:', inventoryResult.errors);
        }
      } catch (inventoryError) {
        console.error('재고 동기화 처리 중 예외:', inventoryError);
        inventoryMessage = ` 하지만 재고 동기화 중 오류 발생: ${inventoryError.message}`;
      }

      // 모든 DB 작업 완료 후 데이터 다시 불러오기
      // await fetchServiceDetail(); // handleSubmit 이후 navigate 하므로, 여기서는 호출 불필요

      setSnackbar({
        open: true,
        message: '성공적으로 저장되었습니다.' + inventoryMessage + pendingOrderMessage,
        severity: !inventoryMessage.includes('오류') && !pendingOrderMessage.includes('실패') ? 'success' : 'warning'
      });

      // 변경사항 초기화
      setHasUnsavedChanges(false);
      setIsEditing(false);

      // 자동저장 데이터 삭제
      autoSave.clear();
      console.log('[ServiceDetail] 저장 성공 - 자동저장 데이터 삭제');

      localStorage.setItem('highlightServiceId', id);

      // 성공적으로 모든 작업 완료 후 페이지 이동
      navigate('/services');

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setSnackbar({
        open: true,
        message: `오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
      setIsFormSubmitted(false); // 오류 발생 시 제출 상태 해제
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'completion_date') {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        status: value ? '출고완료' : prev.status
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
    setIsEditing(true);
  };

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .in('brand', [formData.brand, 'COMMON']) // 선택된 브랜드 + 공용 파츠 포함
        .order('name');

      if (error) throw error;

      console.log('Available parts:', data);

      setAvailableParts(data);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setError(err.message);
    }
  };

  const filteredParts = availableParts.filter(part =>
  (part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenPartsDialog = () => {
    fetchParts();
    setOpenPartsDialog(true);
    setSearchTerm('');
  };

  const handlePartSelect = (part) => {
    setSelectedPart(part);
  };

  const handleOpenPartDialog = () => {
    setPartDialogOpen(true);
  };

  const handleClosePartDialog = () => {
    setPartDialogOpen(false);
    setSelectedPart(null);
    setPartQuantity(1);
    setModifiedPrice('');
  };

  const handleAddPart = () => {
    if (selectedPart && partQuantity > 0) {
      const existingPartIndex = selectedParts.findIndex(p => p.id === selectedPart.id);

      if (existingPartIndex >= 0) {
        const updatedParts = [...selectedParts];
        updatedParts[existingPartIndex].quantity += partQuantity;
        updatedParts[existingPartIndex].total = updatedParts[existingPartIndex].price * updatedParts[existingPartIndex].quantity;
        setSelectedParts(updatedParts);
      } else {
        const newPart = {
          id: selectedPart.id,
          name: selectedPart.name,
          code: selectedPart.code,
          quantity: partQuantity,
          price: modifiedPrice || selectedPart.price || 0,
          total: (modifiedPrice || selectedPart.price || 0) * partQuantity,
          usage: 'A/S'
        };
        setSelectedParts(prev => [...prev, newPart]);
      }

      setSelectedPart(null);
      setPartQuantity(1);
      setModifiedPrice('');
      
      setSnackbar({
        open: true,
        message: '부품이 추가되었습니다. 계속해서 다른 부품을 추가할 수 있습니다.',
        severity: 'success'
      });
      
      if (formData.status === '출고완료') {
        try {
          supabase.from('services').update({ status: '준비완료' }).eq('id', id).then(() => {
            setFormData(prev => ({ ...prev, status: '준비완료' }));
            setInitialStatus('준비완료');
            setSnackbar({ open: true, message: '부품이 추가되어 전체 진행상태가 [준비완료]로 변경되었습니다.', severity: 'success' });
          });
        } catch (e) {
          console.error(e);
        }
      }
      // 연속 등록을 위해 다이얼로그를 닫지 않습니다.
      // handleClosePartDialog();
    }
  };

  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(part => part.id !== partId));
  };

  const isDeducted = ['부품준비', '준비완료', '반품완료', '출고완료', '취소'].includes(formData?.status);

  const handleReturnPart = async (part) => {
    const qtyStr = window.prompt(`'${part.name}' 총 ${part.quantity}개 중 반품(재입고)할 수량을 입력하세요:`, part.quantity);
    if (qtyStr === null) return; // 취소

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0 || qty > part.quantity) {
      alert(`잘못된 수량입니다. 1에서 ${part.quantity} 사이의 숫자를 입력해주세요.`);
      return;
    }

    try {
      setSnackbar({ open: true, message: '반품 처리 중...', severity: 'info' });
      const res = await processPartialReturn('service', id, part.record_id || part.id, qty, formData.brand_code);
      if (!res.success && !res.skipped) throw new Error(res.message);
      
      const newUsageSuffix = qty === part.quantity ? '[반품완료]' : `[부분반품:${qty}개]`;

      setSelectedParts(prev => prev.map(p => 
        p.id === part.id ? { ...p, usage: (p.usage ? p.usage + ' ' : '') + newUsageSuffix } : p
      ));
      
      if (formData.status === '출고완료') {
        try {
          await supabase.from('services').update({ status: '준비완료' }).eq('id', id);
          setFormData(prev => ({ ...prev, status: '준비완료' }));
          setInitialStatus('준비완료');
          setSnackbar({ open: true, message: '부품이 반품되어 전체 진행상태가 [준비완료]로 변경되었습니다.', severity: 'success' });
        } catch (e) {
          console.error(e);
        }
      } else {
        setSnackbar({ open: true, message: '부품 반품(재입고) 처리가 완료되었습니다.', severity: 'success' });
      }
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '반품 처리 중 오류가 발생했습니다: ' + err.message, severity: 'error' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '준비중': return 'info';
      case '부품준비': return 'warning';
      case '준비완료': return 'warning';
      case '반품완료': return 'error';
      case '출고완료': return 'success';
      default: return 'info';
    }
  };

  const buttonStyle = (isSelected, currentStatus) => {
    const getBgColor = () => {
      switch (currentStatus) {
        case '준비중': return '#1976d2';
        case '부품준비': return '#ed6c02';
        case '준비완료': return '#f57c00';
        case '반품완료': return '#d32f2f';
        case '출고완료': return '#2e7d32';
        default: return '#1976d2';
      }
    };

    const getHoverBgColor = () => {
      switch (currentStatus) {
        case '준비중': return '#1565c0';
        case '부품준비': return '#e65100';
        case '준비완료': return '#e65100';
        case '반품완료': return '#c62828';
        case '출고완료': return '#1b5e20';
        default: return '#1565c0';
      }
    };

    return {
      marginRight: '8px',
      color: isSelected ? '#fff' : getBgColor(),
      borderColor: getBgColor(),
      backgroundColor: isSelected ? getBgColor() : 'transparent',
      '&:hover': {
        backgroundColor: isSelected ? getHoverBgColor() : 'rgba(0, 0, 0, 0.04)',
        borderColor: getHoverBgColor(),
      }
    };
  };

  const sectionStyle = {
    pb: 1,
    mb: 2,
    borderBottom: '1px solid #f2f2f2',
    color: '#333333',
    fontSize: '1.1rem',
    fontWeight: 600
  };

  const paperStyle = {
    p: 4,
    borderRadius: 3,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
    bgcolor: '#ffffff'
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return '';
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'A/S 정보 삭제',
      message: '해당 A/S 정보를 삭제하시겠습니까?\n(차감된 재고가 있다면 자동으로 입고 복구됩니다)',
      onConfirm: async () => {
        try {
          setSubmitting(true);

          // A/S 삭제 전 재고 원복 처리 (기존 부품 재고를 창고로 다시 입고)
          try {
            await processServiceRevert(id, formData.brand);
            console.log(`[A/S Delete] 재고 원복 완료 - 서비스ID: ${id}`);
          } catch (revertErr) {
            console.error('A/S 삭제 시 재고 원복 중 오류:', revertErr);
          }

          const { error: deleteTagsError } = await supabase
            .from('service_tags')
            .delete()
            .eq('service_id', id);

          if (deleteTagsError) throw deleteTagsError;

          const { error: deletePartsError } = await supabase
            .from('service_parts')
            .delete()
            .eq('service_id', id);

          if (deletePartsError) throw deletePartsError;

          const { error: txError } = await supabase
            .from('transactions')
            .delete()
            .eq('group_id', id);
          if (txError) console.error("Error deleting related transactions:", txError);

          const { error: deleteServiceError } = await supabase
            .from('services')
            .delete()
            .eq('id', id);

          if (deleteServiceError) throw deleteServiceError;

          setSnackbar({
            open: true,
            message: '출고 정보가 삭제되었습니다.',
            severity: 'success'
          });

          setTimeout(() => {
            navigate('/services');
          }, 2000);

        } catch (err) {
          console.error('Error deleting service:', err);
          setSnackbar({
            open: true,
            message: `오류가 발생했습니다: ${err.message}`,
            severity: 'error'
          });
        } finally {
          setSubmitting(false);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  const handlePriceChange = (index, newPrice) => {
    try {
      console.log('가격 수정 시작:', {
        index,
        newPrice,
        '기존 가격': selectedParts[index].price,
        '기존 총액': selectedParts[index].total
      });

      const updatedParts = [...selectedParts];
      const priceValue = newPrice === '' ? 0 : Number(newPrice);

      updatedParts[index] = {
        ...updatedParts[index],
        price: priceValue,
        total: priceValue * updatedParts[index].quantity
      };

      console.log('수정된 부품 정보:', {
        '부품명': updatedParts[index].name,
        '수정된 가격': priceValue,
        '수량': updatedParts[index].quantity,
        '새로운 총액': updatedParts[index].total
      });

      setSelectedParts(updatedParts);

      console.log('전체 선택된 부품 목록:', updatedParts);
    } catch (err) {
      console.error('가격 수정 중 오류:', err);
      setSnackbar({
        open: true,
        message: '가격 수정 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  const handleSavePrice = async (index) => {
    try {
      const updatedPart = selectedParts[index];

      console.log('가격 저장 시작:', {
        '부품명': updatedPart.name,
        '부품 ID': updatedPart.id,
        '새 가격': updatedPart.price,
        '수량': updatedPart.quantity,
        '총액': updatedPart.total
      });

      const { error: updateError } = await supabase
        .from('service_parts')
        .update({
          price: updatedPart.price,
          quantity: updatedPart.quantity,
          usage: updatedPart.usage || 'A/S'
        })
        .eq('service_id', id)
        .eq('part_id', updatedPart.id);

      if (updateError) {
        console.error('부품 데이터 업데이트 중 오류:', updateError);
        throw updateError;
      }

      console.log('가격 저장 완료:', {
        '서비스 ID': id,
        '부품 ID': updatedPart.id,
        '업데이트된 가격': updatedPart.price
      });

      setSnackbar({
        open: true,
        message: '가격이 성공적으로 저장되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('가격 저장 중 오류:', err);
      setSnackbar({
        open: true,
        message: `가격 저장 중 오류가 발생했습니다: ${err.message}`,
        severity: 'error'
      });
    }
  };


  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const handleTagInput = (event, value, reason) => {
    if (reason === 'input') {
      setTags(value ? [...new Set([...tags, value])] : tags);
    } else {
      setTags(value);
    }
  };

  const handlePreview = (url) => {
    if (!url) return;

    const fileType = url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
    setPreviewType(fileType);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleDateChange = (date, field) => {
    setFormData(prev => ({
      ...prev,
      [field]: date
    }));
  };

  const handleComplete = async () => {
    try {
      let completionDate = formData.completion_date;

      if (!completionDate) {
        completionDate = new Date();
      }

      const { error } = await supabase
        .from('services')
        .update({
          status: '출고완료',
          completion_date: completionDate
        })
        .eq('id', id);

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        status: '출고완료',
        completion_date: completionDate
      }));

      setSnackbar({
        open: true,
        message: 'A/S가 완료 처리되었습니다.',
        severity: 'success'
      });

    } catch (error) {
      console.error('Error completing service:', error);
      setSnackbar({
        open: true,
        message: '완료 처리 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };




  const fetchProductNames = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('product_name, brand')
        .not('product_name', 'is', null)
        .order('product_name');

      if (error) throw error;

      const uniqueProducts = [...new Set(
        data
          .filter(item => item.brand === formData.brand)
          .map(item => item.product_name)
      )].filter(Boolean);

      setProductOptions(uniqueProducts);
    } catch (err) {
      console.error('제품명 목록 조회 중 오류:', err);
    }
  };

  useEffect(() => {
    if (formData.brand) {
      fetchProductNames();
    }
  }, [formData.brand]);



  const handleUsageChange = (index, newUsage) => {
    const updatedParts = [...selectedParts];
    updatedParts[index] = {
      ...updatedParts[index],
      usage: newUsage
    };
    setSelectedParts(updatedParts);
  };

  const handlePartStatusChange = (index, newStatus) => {
    const updatedParts = [...selectedParts];
    updatedParts[index].status = newStatus;
    setSelectedParts(updatedParts);
    setHasUnsavedChanges(true);
  };

  const handleQuantityChange = (index, newQuantity) => {
    const updatedParts = [...selectedParts];
    const qty = Math.max(1, Number(newQuantity) || 1);
    updatedParts[index] = {
      ...updatedParts[index],
      quantity: qty,
      total: updatedParts[index].price * qty
    };
    setSelectedParts(updatedParts);
  };

  const handleCustomerSearchInput = (event) => {
    setCustomerInputValue(event.target.value);
  };

  const executeCustomerSearch = async () => {
    const term = customerInputValue.trim();
    await searchCustomers(term);
  };

  const handleCustomerSearchKeyPress = (event) => {
    if (event.key === 'Enter') {
      executeCustomerSearch();
    }
  };

  const searchCustomers = async (searchTerm) => {
    try {
      setSearchLoading(true);
      if (searchTerm.length < 2) {
        // 최근 고객 정보 조회 (A/S + 출고)
        const { data: recentServices, error: recentServicesError } = await supabase
          .from('services')
          .select('customer_name, customer_phone, customer_address, brand, product_name, seller')
          .eq('brand', formData.brand)
          .order('created_at', { ascending: false })
          .limit(5);
        const { data: recentShipments, error: recentShipmentsError } = await supabase
          .from('shipments')
          .select('customer_name, customer_phone, customer_address, brand, product_name')
          .eq('brand', formData.brand)
          .order('created_at', { ascending: false })
          .limit(5);
        if (recentServicesError) throw recentServicesError;
        if (recentShipmentsError) throw recentShipmentsError;
        const allRecentCustomers = [...(recentServices || []), ...(recentShipments || [])];

        // 이름 + 전화번호 조합으로 중복 제거
        const recentUniqueMap = new Map();
        allRecentCustomers.forEach(customer => {
          if (customer.customer_name && customer.customer_phone) {
            const key = `${customer.customer_name.trim()}_${customer.customer_phone.trim()}`;
            if (!recentUniqueMap.has(key)) {
              recentUniqueMap.set(key, {
                id: key,
                name: customer.customer_name,
                phone: customer.customer_phone,
                address: customer.customer_address || '',
                product_name: customer.product_name || '',
                seller: customer.seller || '',
                brand: customer.brand || ''
              });
            } else {
              // 기존 고객이 있으면 product_name이 있는 경우 업데이트
              const existing = recentUniqueMap.get(key);
              if (customer.product_name && !existing.product_name) {
                existing.product_name = customer.product_name;
              }
            }
          }
        });

        const uniqueRecentCustomers = Array.from(recentUniqueMap.values()).slice(0, 10);
        setCustomerSearchResults(uniqueRecentCustomers);
        return;
      }
      const cleanSearchTerm = searchTerm.replace(/-/g, '');
      const originalSearchTerm = searchTerm.trim();
      const safeOriginal = originalSearchTerm.replace(/"/g, '');
      const safeClean = cleanSearchTerm.replace(/"/g, '');
      const { data: serviceResults, error: serviceError } = await supabase
        .from('services')
        .select('customer_name, customer_phone, customer_address, brand, product_name, seller')
        .eq('brand', formData.brand)
        .or(`customer_phone.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeClean}%",customer_name.ilike."%${safeOriginal}%"`)
        .order('created_at', { ascending: false });
      if (serviceError) throw serviceError;
      const { data: shipmentResults, error: shipmentError } = await supabase
        .from('shipments')
        .select('customer_name, customer_phone, customer_address, brand, product_name')
        .eq('brand', formData.brand)
        .or(`customer_phone.ilike."%${safeOriginal}%",customer_phone.ilike."%${safeClean}%",customer_name.ilike."%${safeOriginal}%"`)
        .order('created_at', { ascending: false });
      if (shipmentError) throw shipmentError;
      const allResults = [...(serviceResults || []), ...(shipmentResults || [])];

      // 이름 + 전화번호 조합으로 중복 제거
      const uniqueMap = new Map();
      allResults.forEach(customer => {
        if (customer.customer_name && customer.customer_phone) {
          const key = `${customer.customer_name.trim()}_${customer.customer_phone.trim()}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
              id: key,
              name: customer.customer_name,
              phone: customer.customer_phone,
              address: customer.customer_address || '',
              product_name: customer.product_name || '',
              seller: customer.seller || '',
              brand: customer.brand || ''
            });
          } else {
            // 기존 고객이 있으면 product_name이 있는 경우 업데이트
            const existing = uniqueMap.get(key);
            if (customer.product_name && !existing.product_name) {
              existing.product_name = customer.product_name;
            }
          }
        }
      });

      const uniqueResults = Array.from(uniqueMap.values());
      setCustomerSearchResults(uniqueResults);
    } catch (err) {
      setSnackbar({
        open: true,
        message: '고객 검색 중 오류가 발생했습니다.',
        severity: 'error'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address || '',
      product_name: customer.product_name || prev.product_name,
      seller: customer.seller || prev.seller
    }));
    setCustomerSearchOpen(false);
    setCustomerInputValue('');
    setCustomerSearchResults([]);
  };



  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) pastedFiles.push(file);
        }
    }

    if (pastedFiles.length > 0) {
        // Prevent default only if an image was caught so we don't break text pasting
        e.preventDefault(); 
        handleFileUpload({ target: { files: pastedFiles, value: '' } });
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // 파일 크기 검증 (10MB 제한)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
      setSnackbar({
        open: true,
        message: `다음 파일의 크기가 10MB를 초과합니다: ${oversizedFiles.map(f => f.name).join(', ')}`,
        severity: 'error'
      });
      event.target.value = ''; // 파일 입력 초기화
      return;
    }

    // 총 파일 개수 검증 (최대 20개)
    const MAX_TOTAL_FILES = 20;
    if (uploadedFiles.length + files.length > MAX_TOTAL_FILES) {
      setSnackbar({
        open: true,
        message: `최대 ${MAX_TOTAL_FILES}개의 파일만 업로드할 수 있습니다. (현재: ${uploadedFiles.length}개)`,
        severity: 'error'
      });
      event.target.value = '';
      return;
    }

    try {
      setUploadingFiles(true);

      // 업로드 서브 폴더 설정 (환경변수 활용)
      const subFolderName = 'upload_crm';

      // 서브폴더(upload_crm)를 생성/탐색
      const subRootFolder = await findOrCreateFolder(subFolderName, null, null);

      // 서비스별 하위 폴더 생성 (upload_crm/AS_...)
      const serviceFolderName = `AS_${formData.customer_name}_${formData.product_name}_${id}`;
      const serviceFolder = await findOrCreateFolder(serviceFolderName, subRootFolder?.id, null);

      const uploadResults = [];

      for (const file of files) {
        try {
          // 파일 업로드
          const uploadResult = await uploadFileToR2(file, serviceFolder.id);

          uploadResults.push({
            id: uploadResult.id,
            name: uploadResult.name,
            webViewLink: uploadResult.webViewLink,
            webContentLink: uploadResult.webContentLink,
            size: file.size,
            type: file.type,
            uploadDate: new Date().toISOString()
          });

        } catch (fileError) {
          console.error(`파일 ${file.name} 업로드 실패:`, fileError);
          setSnackbar({
            open: true,
            message: `파일 ${file.name} 업로드 실패: ${fileError.message}`,
            severity: 'error'
          });
        }
      }

      if (uploadResults.length > 0) {
        // DB에 파일 정보 저장
        try {
          const fileRecords = uploadResults.map(file => ({
            service_id: parseInt(id),
            file_id: file.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            web_view_link: file.webViewLink,
            web_content_link: file.webContentLink,
            upload_date: file.uploadDate
          }));

          const { data: insertedFiles, error: insertError } = await supabase
            .from('service_files')
            .insert(fileRecords)
            .select();

          if (insertError) {
            console.error('[ServiceDetail] 파일 정보 DB 저장 오류:', insertError);
            throw insertError;
          }

          // DB의 primary key를 포함하여 상태 업데이트
          const filesWithDbId = uploadResults.map((file, index) => ({
            ...file,
            dbId: insertedFiles[index].id
          }));

          setUploadedFiles(prev => [...prev, ...filesWithDbId]);
          console.log('[ServiceDetail] 파일 정보 DB 저장 완료:', insertedFiles.length);

        } catch (dbError) {
          console.error('[ServiceDetail] 파일 정보 DB 저장 실패:', dbError);
          // DB 저장 실패 시에도 로컬 상태는 업데이트 (파일은 이미 구글 드라이브에 업로드됨)
          setUploadedFiles(prev => [...prev, ...uploadResults]);

          setSnackbar({
            open: true,
            message: `파일은 업로드되었으나 DB 저장 중 오류가 발생했습니다: ${dbError.message}`,
            severity: 'warning'
          });
          return;
        }

        setSnackbar({
          open: true,
          message: `${uploadResults.length}개 파일이 성공적으로 업로드되었습니다.`,
          severity: 'success'
        });
      }

    } catch (error) {
      console.error('파일 업로드 실패:', error);
      setSnackbar({
        open: true,
        message: `파일 업로드 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setUploadingFiles(false);
      // 파일 입력 초기화
      event.target.value = '';
    }
  };

  // 파일 삭제 핸들러
  const handleFileDelete = async (fileId, dbId) => {
    try {
      // DB에서 파일 정보 삭제
      if (dbId) {
        const { error: deleteError } = await supabase
          .from('service_files')
          .delete()
          .eq('id', dbId);

        if (deleteError) {
          console.error('[ServiceDetail] DB 파일 정보 삭제 오류:', deleteError);
          throw deleteError;
        }
        console.log('[ServiceDetail] DB 파일 정보 삭제 완료:', dbId);
      }

      // Cloudflare R2에서 파일 삭제
      try {
        const { deleteFileFromR2 } = await import('../../utils/cloudflareR2Utils');
        await deleteFileFromR2(fileId);
        console.log('[ServiceDetail] 파일 보관소(R2) 삭제 완료:', fileId);
      } catch (driveError) {
        console.warn('[ServiceDetail] 파일 보관소(R2) 삭제 실패 (무시):', driveError);
        // 삭제 실패는 무시 (DB에서는 이미 삭제됨)
      }

      // 로컬 상태에서 제거
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId));

      setSnackbar({
        open: true,
        message: '파일이 삭제되었습니다.',
        severity: 'success'
      });

    } catch (error) {
      console.error('[ServiceDetail] 파일 삭제 실패:', error);
      setSnackbar({
        open: true,
        message: `파일 삭제 실패: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // 프린트 출력 함수 추가
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>A/S 작업지시서</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .header { text-align: center; margin-bottom: 20px; }
            .section { margin-bottom: 15px; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .row { display: flex; }
            .col { flex: 1; padding: 0 10px; }
            
            /* 절취선 스타일 수정 - 가로로 변경, 여백 제거 */
            .cut-section {
              margin-top: 50px;
              border-top: 1px dashed #999;
              width: 100%;
            }
            .cut-box {
              width: 100%;
              height: 60px;
              text-align: center;
              display: flex;
              flex-direction: row;
              justify-content: center;
              align-items: center;
              border-bottom: 1px dashed #999;
              padding: 0;
            }
            .customer-info {
              font-size: 24px;
              font-weight: bold;
              white-space: nowrap;
            }
            
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>A/S 작업지시서</h2>
            <p>접수일자: ${formatKoreanDateTime(formData.reception_date && formData.reception_time ? `${formData.reception_date}T${formData.reception_time}:00` : formData.reception_date)}</p>
            ${formData.status === '출고완료' ? `<p>완료일자: ${formatKoreanDateTime(formData.completion_date && formData.completion_time ? `${formData.completion_date}T${formData.completion_time}:00` : formData.completion_date)}</p>` : ''}
            <p><strong>상태: ${formData.status || '-'}</strong></p>
          </div>
          
          <div class="row">
            <div class="col">
              <div class="section">
                <div class="label">고객 정보</div>
                <p>고객명: ${formData.customer_name || '-'}</p>
                <p>연락처: ${formData.customer_phone || '-'}</p>
                <p>주소: ${formData.customer_address || '-'}</p>
              </div>
            </div>
            
            <div class="col">
              <div class="section">
                <div class="label">제품 정보</div>
                <p>브랜드: ${formData.brand || '-'}</p>
                <p>제품명: ${formData.product_name || '-'}</p>
                <p>주행거리: ${formData.mileage || '-'}</p>
                <p>구입처: ${formData.seller || '-'}</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="label">A/S 내역</div>
            <div class="label">문의내용:</div>
            <p style="white-space: pre-line;">${formData.symptom || '-'}</p>
            <div class="label">처리내역:</div>
            <p style="white-space: pre-line;">${formData.solution || '-'}</p>
          </div>
          
          <!-- 사용 부품란 삭제 -->
          
          <!-- 절취선 섹션 수정 - 가로로 변경, 이름과 연락처 한 줄에 -->
          <div class="cut-section">
            <div class="cut-box">
              <div class="customer-info">${formData.customer_name || '-'} ${formData.customer_phone || '-'}</div>
            </div>
            <div class="cut-box">
              <div class="customer-info">${formData.customer_name || '-'} ${formData.customer_phone || '-'}</div>
            </div>
            <div class="cut-box">
              <div class="customer-info">${formData.customer_name || '-'} ${formData.customer_phone || '-'}</div>
            </div>
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

  // 견적서 출력 함수
  const handlePrintEstimate = () => {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1);  // 1달로 수정

    const estimateHtml = `
      <html>
        <head>
          <title>견적서</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
            body { 
              font-family: 'Noto Sans KR', sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
            }
            h1 { 
              font-size: 32px; 
              font-weight: 700;
              margin-bottom: 40px;
              text-align: left;
            }
            .header-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 40px;
            }
            .header-item {
              display: grid;
              grid-template-columns: 120px 1fr;
              border-bottom: 1px solid #ddd;
              padding: 8px 0;
            }
            .header-label {
              font-weight: 500;
            }
            .estimate-amount {
              border: 2px solid #000;
              padding: 15px;
              margin: 20px 0;
              text-align: center;
              font-size: 18px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              border-top: 2px solid #000;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: center;
            }
            th { 
              background: #f8f9fa;
              font-weight: 500;
            }
            .total-row { 
              font-weight: 500;
              background: #f8f9fa;
            }
            .amount-cell {
              text-align: right;
            }
            .note-section {
              margin-top: 30px;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
            .note-title {
              font-weight: 500;
              margin-bottom: 10px;
            }
            .note-content {
              white-space: pre-line;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <h1>견적서</h1>
          <div class="header-grid">
            <div>
              <div class="header-item">
                <span class="header-label">수신</span>
                <span>${formData?.customer_name || ''}</span>
              </div>
              <div class="header-item">
                <span class="header-label">견적명</span>
                <span>${formData?.product_name || ''} 수리</span>
              </div>
              <div class="header-item">
                <span class="header-label">견적날짜</span>
                <span>${today.toLocaleDateString('ko-KR')}</span>
              </div>
              <div class="header-item">
                <span class="header-label">유효기간</span>
                <span>견적일로부터 1개월</span>
              </div>
            </div>
            <div>
              <div class="header-item">
                <span class="header-label">상호</span>
                <span>(주)슬림팩</span>
              </div>
              <div class="header-item">
                <span class="header-label">사업자번호</span>
                <span>230-81-03757</span>
              </div>
              <div class="header-item">
                <span class="header-label">주소</span>
                <span>서울시 강남구 도산대로55길 18 1층</span>
              </div>
              <div class="header-item">
                <span class="header-label">연락처</span>
                <span>02-548-8890</span>
              </div>
            </div>
          </div>

          <div class="estimate-amount">
            견적금액: 일금 ${selectedParts.reduce((sum, p) => {
              const rQty = getReturnedQty(p.usage);
              const effective = rQty === -1 ? 0 : Math.max(0, (Number(p.quantity) || 1) - rQty);
              return sum + (Number(p.price) || 0) * effective;
            }, 0).toLocaleString()}원 (￦${selectedParts.reduce((sum, p) => {
              const rQty = getReturnedQty(p.usage);
              const effective = rQty === -1 ? 0 : Math.max(0, (Number(p.quantity) || 1) - rQty);
              return sum + (Number(p.price) || 0) * effective;
            }, 0).toLocaleString()}) ※ 부가세포함
          </div>

          <table>
            <thead>
              <tr>
                <th>세부내용</th>
                <th>수량</th>
                <th>단가</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              ${selectedParts.map(part => {
      const amount = (part.price || 0) * (part.quantity || 1);
      // 요청에 따라 세액 열 및 계산을 제거했습니다.
      return `
                  <tr>
                    <td>${part.name}</td>
                    <td>${part.quantity}</td>
                    <td class="amount-cell">${(part.price || 0).toLocaleString()}</td>
                    <td class="amount-cell">${amount.toLocaleString()}</td>
                  </tr>
                `;
    }).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align:center;">합계</td>
                <td class="amount-cell">${selectedParts.reduce((sum, p) => {
              const rQty = getReturnedQty(p.usage);
              const effective = rQty === -1 ? 0 : Math.max(0, (Number(p.quantity) || 1) - rQty);
              return sum + (Number(p.price) || 0) * effective;
            }, 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="note-section">
            <div class="note-title">비고</div>
            <div class="note-content">${formData.solution || ''}</div>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(estimateHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // 대문자 변환 함수 추가
  const toUpperCaseIfEnglish = (value) => {
    if (!value) return '';
    return value.replace(/[a-z]/g, (c) => c.toUpperCase());
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
        // 페이지 상태 복원을 위한 플래그 설정
        sessionStorage.setItem('restorePageState', 'true');
        navigate('/services', { replace: false });
      }
    } else {
      // 페이지 상태 복원을 위한 플래그 설정
      sessionStorage.setItem('restorePageState', 'true');
      navigate('/services', { replace: false });
    }
  };

  // 편집 시작 핸들러
  const handleStartEdit = () => {
    setIsEditing(true);
    // 편집 시작 시 현재 상태를 초기 데이터로 재설정
    if (initialData) {
      setInitialData({
        formData: { ...formData },
        selectedParts: selectedParts.map(part => ({
          id: part.id,
          part_id: part.part_id,
          quantity: part.quantity,
          price: part.price,
          usage: part.usage
        })),
        tags: tags.slice().sort()
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        mt: 4,
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          A/S 정보를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4, p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error" sx={{ mb: 2 }}>
          데이터 로딩 실패
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {error}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={() => {
              console.log('[ServiceDetail] 재시도 버튼 클릭됨 - 페이지 새로고침');

              // 현재 URL로 페이지 새로고침 (가장 확실한 방법)
              window.location.reload();
            }}
            sx={{
              bgcolor: '#3182f6',
              '&:hover': { bgcolor: '#1b64da' }
            }}
          >
            다시 시도
          </Button>
          {error.includes('인증') || error.includes('로그인') ? (
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{
                bgcolor: '#dc3545',
                '&:hover': { bgcolor: '#c82333' }
              }}
            >
              로그인하기
            </Button>
          ) : null}
          <Button
            variant="outlined"
            onClick={() => navigate('/services')}
            sx={{
              borderColor: '#3182f6',
              color: '#3182f6',
              '&:hover': {
                borderColor: '#1b64da',
                color: '#1b64da',
                bgcolor: 'rgba(49, 130, 246, 0.04)'
              }
            }}
          >
            목록으로 돌아가기
          </Button>
        </Box>
      </Box>
    );
  }

  const partsSection = (
    <Box sx={{ 
      mt: 4, 
      p: 2, 
      bgcolor: selectedParts.length > 0 ? '#f1f3f5' : 'transparent', 
      borderRadius: 1,
      transition: 'background-color 0.3s ease'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{
          color: '#191f28',
          fontWeight: 600,
          mr: 2,
          '&::after': {
            display: 'none'
          }
        }}>
          사용 부품
        </Typography>
        
        <Button
          size="small"
          startIcon={<AddIcon />}
          variant="contained"
          onClick={handleOpenPartsDialog}
          sx={{
            bgcolor: '#3182f6',
            '&:hover': { bgcolor: '#1b64da' }
          }}
        >
          부품 추가
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        <FormControlLabel
          control={
            <Checkbox
              checked={showPriceEdit}
              onChange={e => setShowPriceEdit(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={<Typography variant="body2">가격 수정</Typography>}
          sx={{ m: 0 }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '45%' }}>부품명</TableCell>
              <TableCell align="right" sx={{ width: '10%' }}>단가</TableCell>
              <TableCell align="right" sx={{ width: '9%' }}>수량</TableCell>
              <TableCell align="right" sx={{ width: '13%' }}>금액</TableCell>
              <TableCell align="right" sx={{ width: '13%' }}>가격 수정</TableCell>
              <TableCell align="center" sx={{ width: '5%' }}>용도</TableCell>
              <TableCell align="center" sx={{ width: '5%' }}>작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedParts.map((part, index) => {
              const rQty = getReturnedQty(part.usage);
              const isFullyReturned = rQty === -1;
              const effectiveQty = isFullyReturned ? 0 : Math.max(0, (part.quantity || 1) - rQty);
              const rowStyle = isFullyReturned ? { opacity: 0.5, textDecoration: 'line-through' } : (rQty > 0 ? { bgcolor: '#fff3e0' } : {});
              return (
              <TableRow key={part.id} sx={rowStyle}>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Box>{part.name} {rQty > 0 && <span style={{color: '#ed6c02', fontSize: '0.8rem', marginLeft: 4}}>[{rQty}개 반품]</span>}</Box>
                    <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>{part.code}</Box>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {part.price.toLocaleString()}원
                </TableCell>
                <TableCell align="right">
                  <TextField
                    variant="standard"
                    type="number"
                    size="small"
                    value={part.quantity}
                    onChange={e => handleQuantityChange(index, e.target.value)}
                    sx={{
                      width: '80px',
                      '& .MuiInput-root': {
                        borderRadius: 1,
                        bgcolor: '#f9fafb'
                      }
                    }}
                    InputProps={{
                      inputProps: { min: 1, step: '1' }
                    }}
                  />
                  {rQty > 0 && <div style={{ fontSize: '0.8rem', color: '#ed6c02', marginTop: 4 }}>적용: {effectiveQty}개</div>}
                </TableCell>
                <TableCell align="right">
                  {(part.price * effectiveQty).toLocaleString()}원
                </TableCell>
                <TableCell align="right">
                  {showPriceEdit && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                      <TextField
                        variant="standard"
                        type="number"
                        size="small"
                        value={part.price}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        onBlur={() => console.log('가격 입력 필드 blur - 현재 값:', {
                          '부품명': part.name,
                          '가격': part.price,
                          '총액': part.price * effectiveQty
                        })}
                        sx={{
                          width: '120px',
                          '& .MuiInput-root': {
                            borderRadius: 1,
                            bgcolor: '#f9fafb'
                          }
                        }}
                        InputProps={{
                          inputProps: {
                            min: 0,
                            step: "1"
                          },
                          startAdornment: <InputAdornment position="start">₩</InputAdornment>
                        }}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSavePrice(index)}
                        sx={{
                          minWidth: 'auto',
                          px: 2,
                          bgcolor: '#3182f6',
                          '&:hover': { bgcolor: '#1b64da' }
                        }}
                      >
                        저장
                      </Button>
                    </Box>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Select
                    size="small"
                    value={part.usage || 'A/S'}
                    onChange={(e) => handleUsageChange(index, e.target.value)}
                    sx={{
                      minWidth: 100,
                      height: '32px',
                      '& .MuiSelect-select': {
                        py: 0.5
                      }
                    }}
                  >
                    <MenuItem value="A/S">A/S</MenuItem>
                    <MenuItem value="판매">판매</MenuItem>
                    <MenuItem value="워런티">워런티</MenuItem>
                  </Select>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                    <Select
                      size="small"
                      value={part.status || '준비중'}
                      onChange={(e) => handlePartStatusChange(index, e.target.value)}
                      sx={{ minWidth: 90, height: '32px' }}
                    >
                      {['준비중', '부품준비', '준비완료', '출고완료']
                        .filter(s => s !== '부품준비' || isInspectionEnabled)
                        .map(s => (
                          <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                    {(!isDeducted || !part.record_id) ? (
                      <IconButton
                        size="small"
                        onClick={() => handleRemovePart(part.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      (part.usage && part.usage.includes('[반품완료]')) ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          disabled
                          sx={{ whiteSpace: 'nowrap', minWidth: '70px', px: 1.5, py: 0.5 }}
                        >
                          반품완료
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          onClick={() => handleReturnPart(part)}
                          sx={{ whiteSpace: 'nowrap', minWidth: '70px', px: 1.5, py: 0.5 }}
                        >
                          반품
                        </Button>
                      )
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )})}
            <TableRow>
              <TableCell colSpan={4} align="right">
                <Typography variant="subtitle2">합계</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2">
                  {selectedParts.reduce((sum, p) => {
                    const rQty = getReturnedQty(p.usage);
                    const effective = rQty === -1 ? 0 : Math.max(0, (Number(p.quantity) || 1) - rQty);
                    return sum + (Number(p.price) || 0) * effective;
                  }, 0).toLocaleString()}원
                </Typography>
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openPartsDialog} onClose={() => setOpenPartsDialog(false)}>
        <DialogTitle>부품 추가</DialogTitle>
        <DialogContent>
          <TextField
            variant="standard"
            fullWidth
            placeholder="부품명, 코드, 브랜드로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell>브랜드</TableCell>
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
                    <TableCell>{part.brand}</TableCell>
                    <TableCell align="right">{part.price.toLocaleString()}원</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {selectedPart && (
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <TextField
                variant="standard"
                type="number"
                label="수량"
                value={partQuantity}
                onChange={(e) => setPartQuantity(Number(e.target.value))}
                sx={{ flex: 1 }}
                InputProps={{
                  inputProps: { min: 1 }
                }}
              />
              <TextField
                variant="standard"
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
          <Button onClick={handleAddPart} disabled={!selectedPart}>
            추가
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko} key={componentKey}>
      <Box component="form" onSubmit={handleSubmit} onPaste={handlePaste} sx={{ mt: 3, mx: 'auto', width: '95%', maxWidth: 1400 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            sx={{
              color: 'text.secondary',
              fontSize: '0.95rem',
              fontWeight: 500,
              '&:hover': {
                bgcolor: 'grey.100'
              }
            }}
          >
            A/S 관리
          </Button>
        </Box>

        <Paper sx={paperStyle}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h5" sx={{
              color: '#191f28',
              fontWeight: 600
            }}>
              A/S 상세 정보
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* 자동저장 상태 표시 (수정 모드일 때만) */}
              {isEditing && autoSave.lastSaved && (
                <Chip
                  size="small"
                  icon={<CloudDoneIcon />}
                  label={`자동저장 ${format(autoSave.lastSaved, 'HH:mm:ss')}`}
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              )}

              {isEditing && autoSave.isSaving && (
                <Chip
                  size="small"
                  icon={<CircularProgress size={16} />}
                  label="저장 중..."
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              )}

              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  A/S ID
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'medium', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {id}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={sectionStyle}>
                  기본 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                          접수일시*
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            variant="standard"
                            required
                            type="date"
                            name="reception_date"
                            value={formData.reception_date || ''}
                            onChange={handleChange}
                            size="small"
                            sx={{
                              flex: 2,
                              '& .MuiInput-root': {
                                height: '36px',
                                borderRadius: 1,
                                bgcolor: '#f9fafb'
                              }
                            }}
                          />
                          <TextField
                            variant="standard"
                            select
                            required
                            name="reception_time"
                            value={RECEPTION_TIME_OPTIONS.includes(formData.reception_time) ? formData.reception_time : RECEPTION_TIME_OPTIONS[0]}
                            onChange={(e) => handleChange({
                              target: {
                                name: 'reception_time',
                                value: e.target.value
                              }
                            })}
                            size="small"
                            sx={{
                              flex: 1,
                              '& .MuiInput-root': {
                                height: '36px',
                                borderRadius: 1,
                                bgcolor: '#f9fafb'
                              }
                            }}
                          >
                            {RECEPTION_TIME_OPTIONS.map((time) => (
                              <MenuItem key={time} value={time}>{time}</MenuItem>
                            ))}
                          </TextField>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                          완료일시
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            variant="standard"
                            type="date"
                            name="completion_date"
                            value={formData.completion_date || ''}
                            onChange={handleChange}
                            size="small"
                            sx={{
                              flex: 2,
                              '& .MuiInput-root': {
                                height: '36px',
                                borderRadius: 1,
                                bgcolor: '#f9fafb'
                              }
                            }}
                          />
                          <TextField
                            variant="standard"
                            select
                            name="completion_time"
                            value={formData.completion_time?.split(':')[0] || '00'}
                            onChange={(e) => handleChange({
                              target: {
                                name: 'completion_time',
                                value: `${e.target.value}:00`
                              }
                            })}
                            size="small"
                            sx={{
                              flex: 1,
                              '& .MuiInput-root': {
                                height: '36px',
                                borderRadius: 1,
                                bgcolor: '#f9fafb'
                              }
                            }}
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <MenuItem key={i} value={String(i).padStart(2, '0')}>
                                {String(i).padStart(2, '0')}시
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {(isInspectionEnabled 
                           ? ['준비중', '부품준비', '준비완료', '출고완료'] 
                           : ['준비중', '준비완료', '출고완료']
                         ).map((st) => (
                            <Button 
                            key={st}
                            onClick={() => handleStatusChange(st)}
                            variant={formData.status === st ? "contained" : "outlined"}
                            size="small"
                            sx={buttonStyle(formData.status === st, st)}
                          >
                            {st}
                          </Button>
                        ))}
                      </Box>
                      <TextField
                        variant="standard"
                        size="small"
                        name="writer"
                        label="작성자"
                        value={formData.writer || ''}
                        onChange={handleChange}
                        sx={{
                          width: '150px',
                          '& .MuiInput-root': {
                            height: '36px',
                            borderRadius: 1,
                            bgcolor: '#f9fafb'
                          }
                        }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={4}>
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Box sx={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '45px' }}>
                      <Box>고객 정보</Box>
                      <Button
                        size="small"
                        startIcon={<SearchIcon />}
                        onClick={() => setCustomerSearchOpen(true)}
                        sx={{
                          color: '#3182f6',
                          fontSize: '0.875rem',
                          height: '32px',
                          '&:hover': {
                            bgcolor: 'rgba(49, 130, 246, 0.04)'
                          }
                        }}
                      >
                        고객 검색
                      </Button>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          fullWidth
                          required
                          size="small"
                          label="고객명"
                          name="customer_name"
                          value={formData.customer_name}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          fullWidth
                          required
                          size="small"
                          label="연락처"
                          name="customer_phone"
                          value={formData.customer_phone}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          fullWidth
                          size="small"
                          label="주소"
                          name="customer_address"
                          value={formData.customer_address}
                          onChange={handleChange}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box>
                    <Box sx={{ ...sectionStyle, display: 'flex', alignItems: 'center', minHeight: '45px' }}>
                      <Box>제품 정보</Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          select
                          fullWidth
                          size="small"
                          name="brand"
                          label="브랜드"
                          value={formData.brand}
                          onChange={handleChange}
                        >
                          <MenuItem value="XRB">X-RIDER</MenuItem>
                          <MenuItem value="NB">NEARBIKE</MenuItem>
                        </TextField>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Autocomplete
                          freeSolo
                          options={productOptions}
                          value={formData.product_name}
                          onChange={(event, newValue) => {
                            setFormData(prev => ({
                              ...prev,
                              product_name: toUpperCaseIfEnglish(newValue)
                            }));
                          }}
                          onInputChange={(event, newInputValue) => {
                            setFormData(prev => ({
                              ...prev,
                              product_name: toUpperCaseIfEnglish(newInputValue)
                            }));
                          }}
                          renderInput={(params) => (
                            <TextField
                              variant="standard"
                              {...params}
                              fullWidth
                              size="small"
                              label="제품명"
                              name="product_name"
                              sx={{
                                '& .MuiInput-root': {
                                  borderRadius: 1,
                                  bgcolor: '#f9fafb'
                                }
                              }}
                              onChange={e => setFormData(prev => ({
                                ...prev,
                                product_name: toUpperCaseIfEnglish(e.target.value)
                              }))}
                            />
                          )}
                          renderOption={(props, option) => {
                            const { key, ...otherProps } = props;
                            return (
                              <li key={key} {...otherProps}>
                                <Typography noWrap>
                                  {option}
                                </Typography>
                              </li>
                            );
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          fullWidth
                          size="small"
                          name="mileage"
                          label="주행거리"
                          value={formData.mileage}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          fullWidth
                          size="small"
                          name="seller"
                          label="구입처"
                          value={formData.seller || ''}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          select
                          fullWidth
                          size="small"
                          name="reception_type"
                          label="접수방법"
                          value={formData.reception_type}
                          onChange={handleChange}
                        >
                          <MenuItem value="공홈">공홈</MenuItem>
                          <MenuItem value="방문">방문</MenuItem>
                          <MenuItem value="전화">전화</MenuItem>
                          <MenuItem value="온라인">온라인</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          select
                          fullWidth
                          size="small"
                          name="delivery_method"
                          label="배송방법"
                          value={formData.delivery_method || ''}
                          onChange={handleChange}
                        >
                          <MenuItem value="방문수령">방문수령</MenuItem>
                          <MenuItem value="퀵-선불">퀵-선불</MenuItem>
                          <MenuItem value="퀵-착불">퀵-착불</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          variant="standard"
                          select
                          fullWidth
                          size="small"
                          name="warehouse_id"
                          label="A/S 담당 창고"
                          value={formData.warehouse_id || ''}
                          onChange={handleChange}
                        >
                          <MenuItem value=""><em>지정 안 함</em></MenuItem>
                          {warehouses.map((w) => (
                            <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle1" sx={sectionStyle}>
                  A/S 내역
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      variant="outlined"
                      fullWidth
                      multiline
                      minRows={5}
                      maxRows={15}
                      name="symptom"
                      label="문의내용"
                      value={formData.symptom}
                      onChange={handleChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 0,
                          fontSize: '1.1rem',
                          lineHeight: '1.6'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      variant="outlined"
                      fullWidth
                      multiline
                      minRows={5}
                      maxRows={15}
                      name="solution"
                      label="처리내역"
                      value={formData.solution}
                      onChange={handleChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 0,
                          fontSize: '1.1rem',
                          lineHeight: '1.6'
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Autocomplete
                      multiple
                      freeSolo
                      options={availableTags}
                      value={tags}
                      onChange={handleTagInput}
                      renderInput={(params) => (
                        <TextField
                          variant="standard"
                          {...params}
                          label="태그"
                          placeholder="태그를 입력하거나 선택하세요"
                          helperText="엔터를 눌러 새 태그를 추가하세요"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                          const { key, ...tagProps } = getTagProps({ index });
                          return (
                            <Chip
                              key={key}
                              label={option}
                              {...tagProps}
                              sx={{
                                bgcolor: '#e8f3ff',
                                color: '#3182f6',
                                '& .MuiChip-deleteIcon': {
                                  color: '#3182f6',
                                  '&:hover': {
                                    color: '#1b64da'
                                  }
                                }
                              }}
                            />
                          );
                        })
                      }
                    />
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {availableTags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          onClick={() => {
                            if (!tags.includes(tag)) {
                              setTags([...tags, tag]);
                            }
                          }}
                          sx={{
                            bgcolor: tags.includes(tag) ? '#e8f3ff' : '#f2f4f6',
                            color: tags.includes(tag) ? '#3182f6' : '#4e5968',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: tags.includes(tag) ? '#e8f3ff' : '#e5e8eb'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          {/* 파일 업로드 섹션 */}
          <Grid item xs={12}>
            <Box sx={{ mt: 4 }}>
              <Typography variant="subtitle1" sx={sectionStyle}>
                첨부 파일
              </Typography>
              <Box sx={{ mt: 2 }}>
                {/* 파일 업로드 버튼 */}
                <Box sx={{ mb: 2 }}>
                  <input
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                    style={{ display: 'none' }}
                    id="file-upload"
                    multiple
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                  />
                  <label htmlFor="file-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={uploadingFiles ? <CircularProgress size={20} /> : <AddIcon />}
                      disabled={uploadingFiles}
                      sx={{ mb: 2 }}
                    >
                      {uploadingFiles ? '업로드 중...' : '파일 추가 (사진/영상/문서)'}
                    </Button>
                  </label>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, display: 'block' }}>
                    첨부된 파일은 클라우드 보관소에 자동으로 업로드됩니다. (이 창 어디서나 <b>Ctrl+V / Cmd+V</b>로 클립보드 붙여넣기 가능)
                  </Typography>
                </Box>

                {/* 업로드된 파일 목록 */}
                {uploadedFiles.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      업로드된 파일 ({uploadedFiles.length}개)
                    </Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>파일명</TableCell>
                            <TableCell>크기</TableCell>
                            <TableCell>업로드일</TableCell>
                            <TableCell align="center">작업</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {uploadedFiles.map((file) => (
                            <TableRow key={file.id}>
                              <TableCell>
                                <Link
                                  href={getFixedR2Url(file.webViewLink)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ textDecoration: 'none' }}
                                >
                                  {file.name}
                                </Link>
                              </TableCell>
                              <TableCell>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </TableCell>
                              <TableCell>
                                {new Date(file.uploadDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  onClick={() => handlePreview(getFixedR2Url(file.webViewLink))}
                                  title="미리보기"
                                  sx={{ mr: 1 }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleFileDelete(file.id, file.dbId)}
                                  color="error"
                                  title="파일 삭제"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12}>
            {partsSection}
          </Grid>

          <Box sx={{
            mt: 5,
            pt: 3,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            borderTop: '1px solid #f2f2f2'
          }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                onClick={handleDelete}
                startIcon={<DeleteIcon />}
                sx={{
                  color: '#dc3545',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(220, 53, 69, 0.04)'
                  }
                }}
              >
                삭제
              </Button>
              <Button
                onClick={handleBack}
                sx={{
                  color: '#4e5968',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: '#f2f4f6'
                  }
                }}
              >
                목록
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {isInspectionEnabled && (
                <Button
                  onClick={handleAddToPendingOutbounds}
                  disabled={addingToQueue || isEditing}
                  startIcon={<AddIcon />}
                  sx={{
                    color: '#9c27b0',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: 'rgba(156, 39, 176, 0.04)'
                    }
                  }}
                >
                  검수 대기열 등록
                </Button>
              )}
              <Button
                onClick={handlePrintEstimate}
                startIcon={<DescriptionIcon />}
                sx={{
                  color: '#3182f6',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(49, 130, 246, 0.04)'
                  }
                }}
              >
                견적서
              </Button>
              <Button
                onClick={handlePrint}
                startIcon={<PrintIcon />}
                sx={{
                  color: '#3182f6',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(49, 130, 246, 0.04)'
                  }
                }}
              >
                프린트
              </Button>
              {isEditing ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{
                    bgcolor: '#3182f6',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    px: 4,
                    '&:hover': {
                      bgcolor: '#1b64da'
                    }
                  }}
                >
                  저장
                </Button>
              ) : (
                <Button
                  onClick={handleStartEdit}
                  variant="contained"
                  sx={{
                    bgcolor: '#3182f6',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    px: 4,
                    '&:hover': {
                      bgcolor: '#1b64da'
                    }
                  }}
                >
                  수정
                </Button>
              )}
            </Box>
          </Box>
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={2000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            top: '50% !important',
            transform: 'translateY(-50%)'
          }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            variant="filled"
            sx={{
              width: '100%',
              minWidth: '300px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '1rem',
              '.MuiAlert-icon': {
                fontSize: '24px'
              }
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        <Dialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        >
          <DialogTitle>{confirmDialog.title}</DialogTitle>
          <DialogContent>
            <Typography>{confirmDialog.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
              sx={{ color: '#666' }}
            >
              취소
            </Button>
            <Button
              onClick={confirmDialog.onConfirm}
              variant="contained"
              sx={{
                bgcolor: '#3182f6',
                '&:hover': { bgcolor: '#1b64da' }
              }}
            >
              확인
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>이미지 미리보기</Typography>
              <IconButton onClick={() => setPreviewOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{
              width: '100%',
              height: '80vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {previewType === 'pdf' ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title="PDF 미리보기"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="첨부파일 이미지"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              )}
            </Box>
          </DialogContent>
        </Dialog>

        <Dialog
          open={customerSearchOpen}
          onClose={() => setCustomerSearchOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            고객 검색
            <IconButton
              onClick={() => setCustomerSearchOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <TextField
                variant="standard"
                fullWidth
                size="small"
                placeholder="고객명 또는 연락처로 검색"
                value={customerInputValue}
                onChange={handleCustomerSearchInput}
                onKeyPress={handleCustomerSearchKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchLoading && (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>고객명</TableCell>
                    <TableCell>연락처</TableCell>
                    <TableCell>주소</TableCell>
                    <TableCell>기종</TableCell>
                    <TableCell>구입처</TableCell>
                    <TableCell align="center">선택</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customerSearchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {customerInputValue.length > 0
                          ? '검색 결과가 없습니다.'
                          : '검색어를 입력하세요. (2글자 이상)'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerSearchResults.map((customer) => (
                      <TableRow key={customer.id} hover>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{customer.address}</TableCell>
                        <TableCell>{customer.product_name || '-'}</TableCell>
                        <TableCell>{customer.seller || '-'}</TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            onClick={() => handleCustomerSelect(customer)}
                            sx={{
                              minWidth: 'auto',
                              color: '#3182f6',
                              '&:hover': {
                                bgcolor: 'rgba(49, 130, 246, 0.04)'
                              }
                            }}
                          >
                            선택
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default ServiceDetail; 