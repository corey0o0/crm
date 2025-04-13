import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Chip,
  IconButton,
  Typography,
  TextField,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Grid,
  Alert,
  Stack,
  Input,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  TableFooter,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  TableSortLabel,
  TablePagination,
} from '@mui/material';
import { 
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { serviceApi } from '../../api/services';
import { supabase } from '../../lib/supabaseClient';
import ResponsiveTable from '../common/ResponsiveTable';
import AddService from './AddService';

function ServiceList() {
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [services, setServices] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [filteredServices, setFilteredServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPart, setNewPart] = useState({ name: '', price: '' });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState([]);
  const [selectedOcrItems, setSelectedOcrItems] = useState({});
  const [ocrBoxes, setOcrBoxes] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [orderBy, setOrderBy] = useState('reception_date');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [excelUploadDialogOpen, setExcelUploadDialogOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const brandColors = {
    xlider: {
      main: '#000000',  // 검정색
      light: '#f5f5f5',
      text: '#ffffff'   // 흰색 텍스트
    },
    nearbike: {
      main: '#1976d2',  // 파란색
      light: '#e3f2fd',
      text: '#ffffff'   // 흰색 텍스트
    }
  };

  const steps = [
    '파일 선택',
    '업로드 중',
    'OCR 처리 중',
    '처리 완료'
  ];

  useEffect(() => {
    fetchServices();
  }, [selectedBrand]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      
      // 1. 서비스 데이터와 태그 데이터를 함께 가져오기
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          service_tags (
            tag_name
          )
        `)
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false });

      if (servicesError) throw servicesError;

      // 2. 서비스와 태그 데이터 병합
      const servicesWithTags = servicesData.map(service => ({
        ...service,
        tags: service.service_tags?.map(tag => tag.tag_name) || []
      }));

      setServices(servicesWithTags);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 실시간 업데이트 구독
  useEffect(() => {
    const channel = supabase
      .channel('services-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'services' }, 
        payload => {
          console.log('Received real-time update:', payload); // 디버깅용
          if (payload.eventType === 'INSERT' && payload.new.brand === selectedBrand) {
            setServices(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setServices(prev => prev.map(service => 
              service.id === payload.new.id ? payload.new : service
            ));
          } else if (payload.eventType === 'DELETE') {
            setServices(prev => prev.filter(service => 
              service.id !== payload.old.id
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
    // 브랜드와 검색어, 상태 필터 모두 적용
    const filtered = services.filter(service => {
      const matchesBrand = service.brand === selectedBrand;
      const matchesSearch = searchTerm === '' || 
        service.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.symptom?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || service.status === statusFilter;

      return matchesBrand && matchesSearch && matchesStatus;
    });
    setFilteredServices(filtered);
    // 검색 결과가 변경될 때마다 첫 페이지로 이동
    setPage(0);
  }, [searchTerm, statusFilter, services, selectedBrand]);

  // 데이터 로딩 상태 확인을 위한 useEffect
  useEffect(() => {
    console.log('Current services state:', services); // 현재 services 상태 확인
    console.log('Current loading state:', loading); // 로딩 상태 확인
    console.log('Current error state:', error); // 에러 상태 확인
  }, [services, loading, error]);

  const getStatusColor = (status) => {
    switch(status) {
      case '접수':
        return 'info';
      case '처리중':
        return 'warning';
      case '부분완료':
        return 'secondary';
      case '완료':
        return 'success';
      default:
        return 'default';
    }
  };

  const handleEdit = (serviceId) => {
    navigate(`/services/${serviceId}`);
  };

  const handleDeleteClick = (service) => {
    setSelectedService(service);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', selectedService.id);

      if (error) throw error;

      setServices(prev => prev.filter(s => s.id !== selectedService.id));
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting service:', err);
      setError(err.message);
    }
  };

  const handleSave = () => {
    if (selectedService) {
      // API 호출로 데이터 업데이트
      const updatedServices = services.map(service => 
        service.id === selectedService.id 
          ? selectedService
          : service
      );
      setServices(updatedServices);
      setFilteredServices(updatedServices);
      setOpenDialog(false);
    }
  };

  const processImage = async (file) => {
    try {
      // 이미지를 base64로 변환
      const base64Image = await convertToBase64(file);
      
      // Google Cloud Vision API 요청 데이터 준비
      const requestData = {
        requests: [
          {
            image: {
              content: base64Image.split(',')[1]
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 50
              }
            ],
            imageContext: {
              languageHints: ['ko', 'en']
            }
          }
        ]
      };

      // API 호출
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.REACT_APP_GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        }
      );

      const result = await response.json();
      
      if (result.responses && result.responses[0].textAnnotations) {
        return processOcrResult(result.responses[0].textAnnotations);
      } else {
        throw new Error('텍스트를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('OCR 처리 실패:', error);
      throw error;
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processOcrResult = (annotations) => {
    const extractedItems = [];
    let currentItem = null;
    
    annotations.slice(1).forEach(annotation => {
      const text = annotation.description;
      const bbox = annotation.boundingPoly.vertices;
      
      const pricePattern = /(\d{1,3}(,\d{3})*원|\d+원)/;
      const partNamePattern = /[가-힣a-zA-Z0-9\s]+/;

      if (pricePattern.test(text)) {
        if (currentItem) {
          currentItem.price = parseInt(text.replace(/[^0-9]/g, ''));
          currentItem.box = bbox;
          extractedItems.push(currentItem);
          currentItem = null;
        }
      } else if (partNamePattern.test(text) && !currentItem) {
        currentItem = {
          id: extractedItems.length + 1,
          name: text,
          box: bbox
        };
      }
    });

    return extractedItems;
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    try {
      const file = files[0];
      setActiveStep(1);

      // OCR 처리
      setActiveStep(2);
      const result = await processImage(file);
      
      // OCR 결과 처리
      const extractedItems = result;
      
      // 신뢰도가 높은 항목만 필터링 (70% 이상)
      const filteredResults = extractedItems.filter(item => item.confidence > 0.7);
      
      setOcrResults(filteredResults);
      setOcrBoxes(filteredResults.map(item => ({
        ...item.box,
        id: item.id,
        isHighlighted: false,
        confidence: item.confidence
      })));

      // 신뢰도 높은 항목 자동 선택
      const initialSelection = {};
      filteredResults.forEach(item => {
        initialSelection[item.id] = item.confidence > 0.9;
      });
      setSelectedOcrItems(initialSelection);

      // 파일 저장
      setUploadedFiles([{
        url: URL.createObjectURL(file),
        name: file.name,
        type: 'image'
      }]);

      setActiveStep(3);

    } catch (error) {
      console.error('OCR 처리 중 오류:', error);
      setSnackbar({
        open: true,
        message: 'OCR 처리 중 오류가 발생했습니다.',
        severity: 'error'
      });
      setActiveStep(0);
    }

    setUploadProgress(0);
    setOcrProgress(0);
  };

  const handleOcrItemHover = (itemId, isHovered) => {
    setOcrBoxes(prev => 
      prev.map(box => ({
        ...box,
        isHighlighted: box.id === itemId ? isHovered : box.isHighlighted
      }))
    );
  };

  const handleOcrItemSelect = (itemId) => {
    setSelectedOcrItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleApplyOcrResults = () => {
    // 선택된 항목만 파츠에 추가
    const selectedParts = ocrResults.filter(item => selectedOcrItems[item.id]);
    
    setSelectedService(prev => ({
      ...prev,
      parts: [...(prev.parts || []), ...selectedParts]
    }));

    // OCR 결과 초기화
    setOcrResults([]);
    setSelectedOcrItems({});
  };

  const handleServiceChange = (event) => {
    const { name, value } = event.target;
    setSelectedService(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 파츠 총합 계산 함수
  const calculatePartsTotal = (parts) => {
    return parts?.reduce((sum, part) => sum + (part.price || 0), 0) || 0;
  };

  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleAddService = () => {
    navigate('/add-service', { state: { selectedBrand } });
  };

  const handleAddServiceSuccess = () => {
    fetchServices(); // 목록 새로고침
    setSnackbar({
      open: true,
      message: 'A/S가 성공적으로 등록되었습니다.',
      severity: 'success'
    });
  };

  // 엑셀 다운로드 함수 추가
  const handleDownloadExcel = async () => {
    try {
      // 현재 선택된 브랜드의 서비스 데이터 가져오기
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('brand', selectedBrand)
        .order('reception_date', { ascending: false });

      if (error) throw error;

      // 데이터 가공
      const exportData = data.map(service => ({
        접수일자: service.reception_date || '',
        접수방법: service.reception_type || '',
        입고일: service.repair_date || '',
        출고일: service.completion_date || '',
        배송방법: service.delivery_method || '',
        고객명: service.customer_name || '',
        연락처: service.customer_phone || '',
        주소: service.customer_address || '',
        제품: service.product_name || '',
        증상: service.symptom || '',
        처리내역: service.solution || '',
        상태: service.status || '',
        총비용: service.total_cost || 0,
        메모: service.note || ''
      }));

      // 엑셀 워크북 생성
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AS목록");

      // 컬럼 너비 설정
      const wscols = [
        { wch: 12 },  // 접수일자
        { wch: 10 },  // 접수방법
        { wch: 12 },  // 입고일
        { wch: 12 },  // 출고일
        { wch: 10 },  // 배송방법
        { wch: 12 },  // 고객명
        { wch: 15 },  // 연락처
        { wch: 40 },  // 주소
        { wch: 20 },  // 제품
        { wch: 40 },  // 증상
        { wch: 40 },  // 처리내역
        { wch: 10 },  // 상태
        { wch: 12 },  // 총비용
        { wch: 30 },  // 메모
      ];
      ws['!cols'] = wscols;

      // 파일 다운로드 (브랜드명 포함)
      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      XLSX.writeFile(wb, `AS목록_${brandName}_${new Date().toLocaleDateString()}.xlsx`);

    } catch (error) {
      console.error('Error downloading excel:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleRowClick = (service) => {
    if (!service || !service.id) {
      setSnackbar({
        open: true,
        message: 'A/S 정보를 찾을 수 없습니다.',
        severity: 'error'
      });
      return;
    }
    navigate(`/services/${service.id}`);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortData = (data) => {
    return [...data].sort((a, b) => {
      if (!a[orderBy] || !b[orderBy]) return 0;
      
      let comparison = 0;
      if (orderBy === 'customer_info') {
        // 고객 정보는 고객명으로 정렬
        comparison = a.customer_name.localeCompare(b.customer_name);
      } else if (orderBy === 'tags') {
        // 태그는 첫 번째 태그로 정렬
        const tagA = a.tags?.[0] || '';
        const tagB = b.tags?.[0] || '';
        comparison = tagA.localeCompare(tagB);
      } else {
        // 나머지 필드는 직접 비교
        comparison = String(a[orderBy]).localeCompare(String(b[orderBy]));
      }
      
      return order === 'desc' ? -comparison : comparison;
    });
  };

  // 페이지 변경 핸들러
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 페이지당 행 수 변경 핸들러
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 현재 페이지에 표시할 데이터 계산
  const paginatedServices = sortData(filteredServices).slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 테이블 컬럼 정의
  const columns = [
    { 
      id: 'reception_date', 
      label: '접수일자',
      sortable: true
    },
    { 
      id: 'customer_info', 
      label: '이름',
      sortable: true,
      render: (row) => (
        <Box>
          <Typography>{row.customer_name}</Typography>          
        </Box>
      )
    },
    { 
      id: 'customer_info', 
      label: '연락처',
      sortable: true,
      render: (row) => (
        <Box>
          <Typography>{row.customer_phone}</Typography>
        </Box>
      )
    },
    { 
      id: 'product_name', 
      label: '제품',
      sortable: true,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography>{row.product_name}</Typography>
          {row.note && row.note.includes('JPG:') && (
            <Tooltip title="영수증 첨부됨">
              <ReceiptIcon 
                sx={{ 
                  fontSize: '1rem', 
                  color: 'primary.main',
                  opacity: 0.7 
                }} 
              />
            </Tooltip>
          )}
        </Box>
      )
    },
    { 
      id: 'symptom', 
      label: '증상',
      sortable: true
    },
    { 
      id: 'tags', 
      label: '태그',
      sortable: true,
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {row.tags?.map((tag, index) => (
            <Chip
              key={index}
              label={tag}
              size="small"
              sx={{
                height: '20px',
                fontSize: '0.75rem',
                bgcolor: 'primary.lighter',
                color: 'primary.main'
              }}
            />
          ))}
        </Box>
      )
    },
    { 
      id: 'status', 
      label: '상태',
      sortable: true,
      render: (row) => (
        <Chip
          label={row.status}
          color={getStatusColor(row.status)}
          size="small"
        />
      )
    },
    { 
      id: 'actions', 
      label: '관리',
      sortable: false,
      render: (row) => (
        <Box>
          <IconButton size="small" onClick={(e) => {
            e.stopPropagation();
            handleEdit(row.id);
          }}>
            <EditIcon />
          </IconButton>
          <IconButton size="small" onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(row);
          }}>
            <DeleteIcon />
          </IconButton>
        </Box>
      )
    }
  ];

  // 모바일용 카드 렌더링 함수
  const renderMobileCard = (row, index) => (
    <Card key={index} onClick={() => handleRowClick(row)} sx={{ cursor: 'pointer' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {row.customer_name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {row.customer_phone}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">
            제품: {row.product_name}
          </Typography>
          {row.note && row.note.includes('JPG:') && (
            <Tooltip title="영수증 첨부됨">
              <ReceiptIcon 
                sx={{ 
                  fontSize: '1rem', 
                  color: 'primary.main',
                  opacity: 0.7 
                }} 
              />
            </Tooltip>
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }}>
          증상: {row.symptom}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {row.tags?.map((tag, index) => (
            <Chip
              key={index}
              label={tag}
              size="small"
              sx={{
                height: '20px',
                fontSize: '0.75rem',
                bgcolor: 'primary.lighter',
                color: 'primary.main'
              }}
            />
          ))}
        </Box>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            label={row.status}
            color={getStatusColor(row.status)}
            size="small"
          />
          <Box>
            <IconButton size="small" onClick={(e) => {
              e.stopPropagation();
              handleEdit(row.id);
            }}>
              <EditIcon />
            </IconButton>
            <IconButton size="small" onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // 엑셀 업로드 핸들러
  const handleExcelUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploadLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // 데이터 형식 변환
          const formattedData = jsonData.map(row => ({
            brand: selectedBrand,
            reception_date: row['접수일자'] || new Date().toISOString().split('T')[0],
            reception_type: row['접수방법'] || '',
            repair_date: row['입고일'] || '',
            completion_date: row['출고일'] || '',
            delivery_method: row['배송방법'] || '',
            customer_name: row['고객명'] || '',
            customer_phone: row['연락처'] || '',
            customer_address: row['주소'] || '',
            product_name: row['제품'] || '',
            symptom: row['증상'] || '',
            solution: row['처리내역'] || '',
            status: row['상태'] || '접수',
            note: row['메모'] || ''
          }));

          // 데이터 일괄 등록
          const { data: insertedData, error } = await supabase
            .from('services')
            .insert(formattedData)
            .select();

          if (error) throw error;

          // 성공 메시지 표시
          setSnackbar({
            open: true,
            message: `${insertedData.length}건의 A/S 데이터가 등록되었습니다.`,
            severity: 'success'
          });

          // 목록 새로고침
          fetchServices();

        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Error uploading excel:', error);
        setSnackbar({
          open: true,
          message: '엑셀 업로드 중 오류가 발생했습니다.',
          severity: 'error'
        });
      } finally {
        setUploadLoading(false);
      }
    };

    input.click();
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
    <Box sx={{ 
      maxWidth: '1800px', 
      width: 'auto', 
      mx: 'auto'
    }}>
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
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={handleExcelUpload}
            >
              엑셀 등록
            </Button>
            <Tooltip title="A/S 목록 다운로드">
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
              startIcon={<AddIcon />}
              onClick={handleAddService}
              sx={{
                bgcolor: '#3182f6',
                '&:hover': { bgcolor: '#1b64da' }
              }}
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
          <MenuItem value="접수">접수</MenuItem>
          <MenuItem value="처리중">처리중</MenuItem>
          <MenuItem value="완료">완료</MenuItem>
        </TextField>
      </Box>

      {/* 검색 및 필터 영역 */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="고객명, 연락처, 제품명, 증상으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        {searchTerm && (
          <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
            검색 결과: {filteredServices.length}건
          </Typography>
        )}
      </Box>

      {/* A/S 목록 테이블 */}
      <ResponsiveTable
        columns={columns.map(column => ({
          ...column,
          label: column.sortable ? (
            <TableSortLabel
              active={orderBy === column.id}
              direction={orderBy === column.id ? order : 'asc'}
              onClick={() => handleSort(column.id)}
            >
              {column.label}
            </TableSortLabel>
          ) : column.label
        }))}
        data={paginatedServices}
        renderMobileCard={renderMobileCard}
        onRowClick={handleRowClick}
        hoverEffect={true}
      />

      {/* 페이지네이션 추가 */}
      <TablePagination
        component="div"
        count={filteredServices.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="페이지당 행 수"
        labelDisplayedRows={({ from, to, count }) => 
          `${count}개 중 ${from}-${to}`
        }
        sx={{
          '.MuiTablePagination-select': {
            paddingTop: '6px',
            paddingBottom: '6px',
          },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontSize: '0.875rem',
          }
        }}
      />

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

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="md" 
        fullWidth
        keepMounted={false}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">A/S 작업</Typography>
            <IconButton 
              onClick={() => setOpenDialog(false)} 
              size="small"
              aria-label="닫기"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="접수일자"
                type="date"
                name="reception_date"
                value={selectedService?.reception_date || ''}
                onChange={handleServiceChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="입고일"
                type="date"
                name="repair_date"
                value={selectedService?.repair_date || ''}
                onChange={handleServiceChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="출고일"
                type="date"
                name="completion_date"
                value={selectedService?.completion_date || ''}
                onChange={handleServiceChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="접수 방법"
                name="reception_type"
                value={selectedService?.reception_type || ''}
                onChange={handleServiceChange}
              >
                <MenuItem value="공홈">공홈</MenuItem>
                <MenuItem value="방문">방문</MenuItem>
                <MenuItem value="전화">전화</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="배송 방법"
                name="delivery_method"
                value={selectedService?.delivery_method || ''}
                onChange={handleServiceChange}
              >
                <MenuItem value="방문수령">방문수령</MenuItem>
                <MenuItem value="택배">택배</MenuItem>
                <MenuItem value="설치기사">설치기사</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="고객명"
                name="customer_name"
                value={selectedService?.customer_name || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="연락처"
                name="customer_phone"
                value={selectedService?.customer_phone || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="주소"
                name="customer_address"
                value={selectedService?.customer_address || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="제품명"
                name="product_name"
                value={selectedService?.product_name || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="문제 설명"
                name="symptom"
                multiline
                rows={4}
                value={selectedService?.symptom || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="처리 내역"
                name="solution"
                multiline
                rows={4}
                value={selectedService?.solution || ''}
                onChange={handleServiceChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="상태"
                name="status"
                value={selectedService?.status || ''}
                onChange={handleServiceChange}
              >
                <MenuItem value="접수">접수</MenuItem>
                <MenuItem value="처리중">처리중</MenuItem>
                <MenuItem value="부분완료">부분완료</MenuItem>
                <MenuItem value="완료">완료</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                영수증/이미지 업로드
              </Typography>
              
              {/* 업로드 진행 상태 */}
              <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {uploadProgress > 0 && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={uploadProgress} 
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    업로드 중... {uploadProgress}%
                  </Typography>
                </Box>
              )}

              {ocrProgress > 0 && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={ocrProgress} 
                    color="secondary"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    OCR 처리 중... {ocrProgress}%
                  </Typography>
                </Box>
              )}

              {/* 파일 업로드 버튼 */}
              <Box sx={{ mb: 2 }}>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  id="file-upload"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <label htmlFor="file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                  >
                    파일 업로드
                  </Button>
                </label>
                <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                  * 영수증 이미지 업로드 시 자동으로 항목을 인식합니다.
                </Typography>
              </Box>

              {/* 업로드된 파일 목록 */}
              {uploadedFiles.length > 0 && (
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <ImageList sx={{ maxHeight: 400 }} cols={1} rowHeight={400}>
                    {uploadedFiles.map((file, index) => (
                      <ImageListItem key={index} sx={{ position: 'relative' }}>
                        {file.type === 'image' ? (
                          <>
                            <img
                              src={file.url}
                              alt={file.name}
                              loading="lazy"
                              style={{ objectFit: 'contain' }}
                            />
                            {/* OCR 인식 영역 표시 */}
                            {ocrBoxes.map((box) => (
                              <Box
                                key={box.id}
                                sx={{
                                  position: 'absolute',
                                  left: `${box.x}px`,
                                  top: `${box.y}px`,
                                  width: `${box.width}px`,
                                  height: `${box.height}px`,
                                  border: '2px solid',
                                  borderColor: box.isHighlighted ? 'primary.main' : 'success.main',
                                  backgroundColor: box.isHighlighted ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                                  transition: 'all 0.2s',
                                  pointerEvents: 'none'
                                }}
                              />
                            ))}
                          </>
                        ) : (
                          <Box
                            sx={{
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'grey.100'
                            }}
                          >
                            <DescriptionIcon sx={{ fontSize: 40 }} />
                          </Box>
                        )}
                        <IconButton
                          sx={{
                            position: 'absolute',
                            top: 5,
                            right: 5,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            },
                          }}
                          size="small"
                          onClick={() => {
                            setUploadedFiles(prev => 
                              prev.filter((_, i) => i !== index)
                            );
                            setOcrBoxes([]);
                            setOcrResults([]);
                          }}
                        >
                          <DeleteIcon sx={{ color: 'white' }} />
                        </IconButton>
                      </ImageListItem>
                    ))}
                  </ImageList>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                사용 파츠
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>품목</TableCell>
                      <TableCell align="right">가격</TableCell>
                      <TableCell align="right">작업</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedService?.parts?.map((part, index) => (
                      <TableRow key={index}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell align="right">
                          {part.price?.toLocaleString()}원
                        </TableCell>
                        <TableCell align="right">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setSelectedService({
                                ...selectedService,
                                parts: selectedService.parts.filter(p => p.id !== part.id)
                              });
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>총합</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {calculatePartsTotal(selectedService?.parts).toLocaleString()}원
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12}>
              <Alert 
                severity="success" 
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={handleApplyOcrResults}
                  >
                    파츠에 추가
                  </Button>
                }
                sx={{ mb: 2 }}
              >
                영수증에서 다음 항목들이 인식되었습니다.
              </Alert>
              
              <List>
                {ocrResults.map((item) => (
                  <ListItem 
                    key={item.id} 
                    dense
                    onMouseEnter={() => handleOcrItemHover(item.id, true)}
                    onMouseLeave={() => handleOcrItemHover(item.id, false)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <Checkbox
                      edge="start"
                      checked={selectedOcrItems[item.id] || false}
                      onChange={() => handleOcrItemSelect(item.id)}
                    />
                    <ListItemText
                      primary={item.name}
                      secondary={`${item.price.toLocaleString()}원`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button onClick={handleSave} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            정말로 이 A/S 기록을 삭제하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error">삭제</Button>
        </DialogActions>
      </Dialog>

      {/* 상세 정보 다이얼로그 */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">A/S 상세 정보</Typography>
            <IconButton onClick={() => setDetailDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedService && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">고객 정보</Typography>
                <Typography variant="body1">{selectedService.customer_name}</Typography>
                <Typography variant="body2" color="textSecondary">{selectedService.customer_phone}</Typography>
                <Typography variant="body2" color="textSecondary">{selectedService.customer_address}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">제품 정보</Typography>
                <Typography variant="body1">{selectedService.product_name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  주행거리: {selectedService.mileage || '-'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">증상</Typography>
                <Typography variant="body1">{selectedService.symptom}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">처리내역</Typography>
                <Typography variant="body1">{selectedService.solution || '-'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">태그</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                  {selectedService.tags?.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      sx={{
                        height: '20px',
                        fontSize: '0.75rem',
                        bgcolor: 'primary.lighter',
                        color: 'primary.main'
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>닫기</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setDetailDialogOpen(false);
              handleEdit(selectedService.id);
            }}
          >
            수정하기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 로딩 인디케이터 추가 */}
      {uploadLoading && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 9999 
        }}>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );
}

export default ServiceList; 