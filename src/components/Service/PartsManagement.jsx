import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Box,
  Typography,
  Grid,
  MenuItem,
  InputAdornment,
  Tooltip,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  TableSortLabel,
  Switch,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  TablePagination,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  FileCopy as FileCopyIcon,
  CheckBox as CheckBoxIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon
} from '@mui/icons-material';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { sendTelegramNotification } from '../../lib/telegram';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';
import { getSyncedParts, createSyncRelation, deleteSyncRelationById } from '../../utils/partSyncUtils';

const BRANDS = ['XRB', 'NB', 'COMMON'];

// 입력 폼 컴포넌트 분리
const PartsFormDialog = memo(({
  open,
  onClose,
  onSubmit,
  initialData,
  brands,
  getNextPartCode
}) => {
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    code: '',
    supplyPrice: '',
    price: '',
    barcode: '',
    note: '파츠'
  });

  // 폼이 열려있는지 추적하여 불필요한 리셋 방지
  const isOpenRef = useRef(open);
  const prevInitialDataRef = useRef(initialData);

  useEffect(() => {
    // 닫혀있다가 열릴 때, 또는 initialData가 변경될 때만 초기화
    const justOpened = open && !isOpenRef.current;
    const dataChanged = initialData !== prevInitialDataRef.current;

    if (justOpened || (open && dataChanged)) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          brand: initialData.brand || '',
          code: initialData.code || '',
          supplyPrice: initialData.supply_price?.toString() || '',
          price: initialData.price?.toString() || '',
          barcode: initialData.barcode || '',
          note: initialData.note || '파츠'
        });
      } else {
        const defaultBrand = brands[0] || '';
        const defaultCategory = '파츠';
        // 신규 등록일 때만 코드 추천
        const suggestedCode = typeof getNextPartCode === 'function' ? getNextPartCode(defaultBrand, defaultCategory) : '';
        setFormData({
          name: '',
          brand: defaultBrand,
          code: suggestedCode,
          supplyPrice: '',
          price: '',
          barcode: '',
          note: defaultCategory
        });
      }
    }
    isOpenRef.current = open;
    prevInitialDataRef.current = initialData;
  }, [open, initialData, brands, getNextPartCode]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = {
        ...prev,
        [name]: ['price', 'supplyPrice'].includes(name) ? value.replace(/[^0-9]/g, '') : value
      };
      const shouldSuggest = (!prev.code || prev.code.trim() === '');
      if ((name === 'brand' || name === 'note') && typeof getNextPartCode === 'function') {
        if (shouldSuggest) {
          const brandForCode = name === 'brand' ? value : prev.brand;
          const categoryForCode = name === 'note' ? value : prev.note;
          next.code = getNextPartCode(brandForCode, categoryForCode);
        }
      }
      return next;
    });
  }, [getNextPartCode]);

  const handleSubmit = useCallback(() => {
    onSubmit(formData);
  }, [formData, onSubmit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      transitionDuration={0}
    >
      <DialogTitle>
        {initialData ? '파츠 수정' : '파츠 등록'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 2 }}>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label="브랜드"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              required
            >
              {brands.map((brand) => (
                <MenuItem key={brand} value={brand}>
                  {brand === 'XRB' ? 'X-RIDER' : brand === 'NB' ? 'NEARBIKE' : '공용'}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                fullWidth
                label="상품코드"
                name="code"
                value={formData.code}
                onChange={handleChange}
                required
              />
              <Button
                variant="outlined"
                sx={{ height: 56, minWidth: 100 }}
                onClick={() => {
                  if (typeof getNextPartCode === 'function') {
                    const newCode = getNextPartCode(formData.brand, formData.note);
                    setFormData(prev => ({ ...prev, code: newCode }));
                  }
                }}
              >
                코드생성
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="파츠명"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="공급가"
              name="supplyPrice"
              value={formData.supplyPrice}
              onChange={handleChange}
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">원</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="판매가"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              InputProps={{
                endAdornment: <InputAdornment position="end">원</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="바코드"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label="구분"
              name="note"
              value={formData.note}
              onChange={handleChange}
            >
              {['파츠', '기체', '공임', '기타'].map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained">
          {initialData ? '수정' : '등록'}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

PartsFormDialog.displayName = 'PartsFormDialog';

// [1] 검색 입력창 분리 (React.memo)
const SearchInput = React.memo(function SearchInput({
  searchInput,
  setSearchInput,
  onSearch,
  onClear,
  isSearching
}) {
  const handleInputChange = (e) => setSearchInput(e.target.value);
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') onSearch();
  };
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
      <TextField
        fullWidth
        size="small"
        placeholder="제품명, 코드, 바코드로 검색"
        value={searchInput}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchInput && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={onClear} edge="end">
                <CloseIcon />
              </IconButton>
            </InputAdornment>
          )
        }}
      />
      <Button
        variant="contained"
        onClick={onSearch}
        disabled={isSearching}
        sx={{
          minWidth: { xs: '100%', sm: '100px' },
          height: { xs: 44, sm: 40 },
          px: { xs: 2, sm: 3 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isSearching ? <CircularProgress size={20} /> : '검색'}
      </Button>
    </Stack>
  );
});

// [useDebounce 커스텀 훅 추가]
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function PartsManagement() {
  const [parts, setParts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    open: false,
    step: 0,
    total: 0,
    current: 0,
    message: ''
  });

  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('code');
  const [showSupplyPrice, setShowSupplyPrice] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');

  // 체크박스 관련 상태 추가
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [openCopyDialog, setOpenCopyDialog] = useState(false);
  const [copyTargetBrand, setCopyTargetBrand] = useState('');

  // 연동 관련 상태 추가
  const [openSyncDialog, setOpenSyncDialog] = useState(false);
  const [syncTargetPart, setSyncTargetPart] = useState(null);
  const [syncSearchTerm, setSyncSearchTerm] = useState('');
  const [syncedPartsMap, setSyncedPartsMap] = useState({}); // partId -> [syncedParts]

  // 다음 상품코드 생성기: 같은 브랜드의 기존 코드 중 숫자 접미사를 증가
  // 다음 상품코드 생성기: 브랜드+카테고리 약어 조합
  const getNextPartCode = useCallback((brandCode, category = '파츠') => {
    try {
      const brandPrefix = String(brandCode || '').toUpperCase();

      // 1. 브랜드 코드 매핑
      // XRB -> XRB, NB -> NB, COMMON -> COM
      const basePrefix = brandPrefix === 'COMMON' ? 'COM' : brandPrefix;

      // 2. 카테고리 코드 매핑
      // 파츠: P, 기체: M, 공임: S, 기타: E
      let categorySuffix = 'P';
      if (category === '기체') categorySuffix = 'M';
      else if (category === '공임') categorySuffix = 'S';
      else if (category === '기타') categorySuffix = 'E';

      // 최종 접두사: Brand + Category (예: XRBP, NBM, COMS)
      const fullPrefix = `${basePrefix}${categorySuffix}`;

      // 해당 접두사로 시작하는 파츠들만 필터링
      // 예: XRBP- 로 시작하는 코드들 찾기
      const brandParts = parts.filter(p => p.brand === brandPrefix && typeof p.code === 'string');
      const categoryParts = brandParts.filter(p => p.code.startsWith(fullPrefix));

      if (categoryParts.length === 0) {
        // 해당 카테고리 첫 아이템
        return `${fullPrefix}-001`;
      }

      // 코드에서 숫자 꼬리를 추출하여 최대값+1 생성
      let maxNum = 0;
      categoryParts.forEach(p => {
        // 접두사 뒤의 숫자를 찾음
        const match = p.code.match(new RegExp(`^${fullPrefix}-(\\d+)$`));
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n)) maxNum = Math.max(maxNum, n);
        }
      });
      const nextNum = maxNum + 1;
      const padded = String(nextNum).padStart(3, '0'); // 기본 3자리, 필요시 늘어남
      return `${fullPrefix}-${padded}`;
    } catch (e) {
      console.error('Error generating code:', e);
      // Fallback
      return `${String(brandCode || 'XRB')}-001`;
    }
  }, [parts]);

  // [디바운스 적용]
  const debouncedSearchInput = useDebounce(searchInput, 300);
  React.useEffect(() => {
    // 입력이 멈춘 뒤 300ms 후에만 검색 실행
    setSearchTerm(debouncedSearchInput);
  }, [debouncedSearchInput]);

  // [검색 버튼/엔터는 즉시 검색]
  const executeSearch = useCallback(() => {
    setIsSearching(true);
    setSearchTerm(searchInput);
    setIsSearching(false);
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
  }, []);

  const brands = BRANDS; // 브랜드 목록 수정 (공용 추가)
  const navigate = useNavigate();

  useEffect(() => {
    fetchParts();
  }, []);

  // 연동된 파츠 정보 로드
  useEffect(() => {
    const loadSyncedParts = async () => {
      const map = {};
      for (const part of parts) {
        const synced = await getSyncedParts(part.id);
        if (synced.length > 0) {
          map[part.id] = synced;
        }
      }
      setSyncedPartsMap(map);
    };

    if (parts.length > 0) {
      loadSyncedParts();
    }
  }, [parts]);

  const fetchParts = async () => {
    try {
      // 오프라인 상태 체크
      if (isOffline()) {
        console.log('[PartsManagement] 오프라인 상태 - 부품 데이터 로딩 건너뛰기');
        showSnackbar('오프라인 상태입니다. 인터넷 연결을 확인해주세요.', 'error');
        return;
      }

      // 안전한 재시도 로직 적용
      const { data, error } = await safeRetry(async () => {
        return await supabase
          .from('parts')
          .select('*')
          .order('brand')
          .order('name');
      }, {
        maxRetries: 3,
        maxTime: 30000,
        baseDelay: 1000
      });

      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      console.error('Error fetching parts:', err);

      // 스마트 오류 처리
      const errorMessage = getErrorMessage(err);
      showSnackbar(`부품 목록을 불러오는데 실패했습니다: ${errorMessage}`, 'error');
    }
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortData = (data, order, orderBy) => {
    return data.sort((a, b) => {
      if (orderBy === 'supply_price' || orderBy === 'price') {
        const aValue = a[orderBy] || 0;
        const bValue = b[orderBy] || 0;
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aValue = (a[orderBy] || '').toString().toLowerCase();
      const bValue = (b[orderBy] || '').toString().toLowerCase();

      if (order === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  };

  const handleOpenDialog = useCallback((part = null) => {
    setSelectedPart(part);
    setOpenDialog(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedPart(null);
  }, []);

  const handleSubmit = useCallback(async (formData) => {
    try {
      const partData = {
        name: formData.name,
        brand: formData.brand,
        code: formData.code,
        supply_price: Number(formData.supplyPrice),
        price: Number(formData.price)
      };

      if (formData.barcode) partData.barcode = formData.barcode;
      if (formData.note) partData.note = formData.note;

      if (selectedPart) {
        const { error } = await supabase
          .from('parts')
          .update(partData)
          .eq('id', selectedPart.id);

        if (error) throw error;

        showSnackbar(`부품이 성공적으로 수정되었습니다.`, 'success');

        // 텔레그램 알림 전송 (수정) - 정지됨
        // try {
        //   await sendTelegramNotification({
        //     message: `부품 수정 (코드: ${partData.code}) - 품명: ${partData.name}`,
        //     link: `/parts`
        //   });
        // } catch (telegramError) {
        //   console.error('부품 정보 수정 텔레그램 알림 전송 중 오류:', telegramError);
        // }

      } else {
        const { data: insertedPart, error } = await supabase
          .from('parts')
          .insert([partData])
          .select(); // 등록된 데이터 가져오기

        if (error) throw error;

        showSnackbar(`부품이 성공적으로 등록되었습니다.`, 'success');

        // 텔레그램 알림 전송 (신규 등록) - 정지됨
        // if (insertedPart && insertedPart.length > 0) {
        //   const newPart = insertedPart[0];
        //   try {
        //     await sendTelegramNotification({
        //       message: `부품 등록 (코드: ${newPart.code}) - 품명: ${newPart.name}`,
        //       link: `/parts`
        //     });
        //   } catch (telegramError) {
        //     console.error('신규 부품 등록 텔레그램 알림 전송 중 오류:', telegramError);
        //   }
        // }
      }

      fetchParts();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving part:', err);
      showSnackbar('저장 중 오류가 발생했습니다.', 'error');
    }
  }, [selectedPart]);

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('parts')
          .delete()
          .eq('id', id);

        if (error) throw error;

        fetchParts(); // 목록 새로고침
        showSnackbar('부품이 삭제되었습니다.', 'success');
      } catch (err) {
        console.error('Error deleting part:', err);
        showSnackbar('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  };

  const closeUploadStatus = () => {
    setUploadStatus({
      open: false,
      step: 0,
      total: 0,
      current: 0,
      message: ''
    });
  };

  const validateExcelData = (data) => {
    const errors = [];
    const validData = [];

    data.forEach((row, index) => {
      const rowErrors = [];

      if (!row.brand) rowErrors.push('brand');
      if (!row.name) rowErrors.push('name');

      if (row.brand && !['XRB', 'NB', 'COMMON'].includes(String(row.brand).toUpperCase())) {
        errors.push(`${index + 2}번 행: 브랜드는 XRB, NB 또는 COMMON(공용)만 입력 가능합니다.`);
        return;
      }

      if (row.supplyPrice !== undefined && row.supplyPrice !== '' &&
        isNaN(Number(String(row.supplyPrice).replace(/[^0-9]/g, '')))) {
        errors.push(`${index + 2}번 행: 공급가는 숫자만 입력 가능합니다.`);
        return;
      }
      if (row.price !== undefined && row.price !== '' &&
        isNaN(Number(String(row.price).replace(/[^0-9]/g, '')))) {
        errors.push(`${index + 2}번 행: 판매가는 숫자만 입력 가능합니다.`);
        return;
      }

      if (rowErrors.length > 0) {
        errors.push(`${index + 2}번 행: ${rowErrors.join(', ')} 필드가 누락되었습니다.`);
        return;
      }

      validData.push(row);
    });

    return { validData, errors };
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExt)) {
      showSnackbar('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.', 'error');
      event.target.value = '';
      return;
    }

    setUploadStatus({
      open: true,
      step: 1,
      total: 100,
      current: 0,
      message: '엑셀 파일 읽는 중...'
    });

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = await readExcelFile(file);

        if (data.length === 0) {
          closeUploadStatus();
          showSnackbar('엑셀 파일에 데이터가 없습니다.', 'error');
          event.target.value = '';
          return;
        }

        setUploadStatus(prev => ({
          ...prev,
          step: 2,
          message: '데이터 검증 중...',
          current: 30
        }));

        const { validData, errors } = validateExcelData(data);

        if (errors.length > 0) {
          closeUploadStatus();
          showSnackbar(`데이터 검증 중 오류가 발생했습니다:\n${errors.join('\n')}`, 'error');
          event.target.value = '';
          return;
        }

        // 1) 기본 포맷 변환 (code는 비어있을 수 있음)
        const formattedData = validData.map(row => ({
          brand: String(row.brand).toUpperCase(),
          code: (row.code !== undefined && row.code !== null) ? String(row.code).trim() : '',
          name: String(row.name).trim(),
          supply_price: row.supplyPrice === undefined || row.supplyPrice === ''
            ? 0
            : Number(String(row.supplyPrice).replace(/[^0-9]/g, '')),
          price: row.price === undefined || row.price === ''
            ? 0
            : Number(String(row.price).replace(/[^0-9]/g, '')),
          barcode: row.barcode ? String(row.barcode).trim() : null,
          note: row.note ? String(row.note).trim() : null
        }));

        // 2) 업로드 배치 내에서 고유 코드를 만들기 위한 헬퍼
        const bumpCode = (code) => {
          const match = String(code).match(/(.*?)(\d+)$/);
          if (!match) return `${code}-001`;
          const prefix = match[1];
          const num = match[2];
          const next = String(parseInt(num, 10) + 1).padStart(num.length, '0');
          return `${prefix}${next}`;
        };

        // 3) 비어있는 코드 자동 생성 + 배치 내 중복 방지
        const assigned = new Set();
        const withCodes = formattedData.map((row) => {
          const originalProvided = !!(row.code && row.code.trim() !== '');
          let code = row.code || '';
          if (!originalProvided) {
            // 기본 카테고리
            const category = row.note || '파츠';
            // 기존 함수 활용 (현재 parts 상태 기준)
            code = getNextPartCode(row.brand, category);
          }
          // 배치 내 중복 해결
          while (assigned.has(code)) {
            code = bumpCode(code);
          }
          assigned.add(code);
          return { ...row, code, __auto: !originalProvided };
        });

        setUploadStatus(prev => ({
          ...prev,
          step: 3,
          message: '중복 데이터 확인 중...',
          current: 60
        }));

        const { data: existingParts, error: checkError } = await supabase
          .from('parts')
          .select('code')
          .in('code', withCodes.map(d => d.code));

        if (checkError) throw checkError;

        const dbExisting = new Set((existingParts || []).map(p => p.code));
        // 사용자가 직접 입력한 코드가 DB에 이미 있으면 에러
        const userDupes = withCodes
          .filter(r => !r.__auto && dbExisting.has(r.code))
          .map(r => r.code);
        if (userDupes.length > 0) {
          closeUploadStatus();
          showSnackbar(`다음 상품코드는 이미 존재합니다: ${userDupes.join(', ')}`, 'error');
          event.target.value = '';
          return;
        }

        // 자동 생성된 코드가 DB에 있으면 충돌 해소를 위해 증가
        const finalAssigned = new Set(withCodes.map(r => r.code));
        const finalData = withCodes.map((row) => {
          if (row.__auto && dbExisting.has(row.code)) {
            let code = row.code;
            // DB 및 배치 내 중복 모두 해결될 때까지 증가
            while (dbExisting.has(code) || finalAssigned.has(code)) {
              code = bumpCode(code);
            }
            finalAssigned.add(code);
            return { ...row, code };
          }
          return row;
        }).map(({ __auto, ...rest }) => rest);

        setUploadStatus(prev => ({
          ...prev,
          step: 4,
          message: '데이터 저장 중...',
          current: 80
        }));

        const { error: insertError } = await supabase
          .from('parts')
          .insert(finalData);

        if (insertError) throw insertError;

        setUploadStatus(prev => ({
          ...prev,
          step: 5,
          message: '저장 완료!',
          current: 100
        }));

        // 텔레그램 알림 전송 (엑셀 업로드) - 정지됨
        // for (const newPart of finalData) {
        //   try {
        //     await sendTelegramNotification({
        //       message: `부품 등록 (코드: ${newPart.code}) - 품명: ${newPart.name}`,
        //       link: `/parts`
        //     });
        //   } catch (telegramError) {
        //     console.error('엑셀 부품 등록 텔레그램 알림 전송 중 오류:', telegramError);
        //     // 개별 알림 실패는 전체 프로세스를 중단시키지 않도록 처리
        //   }
        // }

        await fetchParts(); // 목록 새로고침

        setTimeout(() => {
          closeUploadStatus();
          showSnackbar(`${formattedData.length}개의 파츠가 성공적으로 등록되었습니다.`, 'success');
        }, 1000);

        event.target.value = '';

      } catch (error) {
        closeUploadStatus();
        console.error('엑셀 파일 처리 중 오류:', error);
        showSnackbar(
          error.code === '23505'
            ? '동일한 상품코드를 가진 파츠가 이미 존재합니다.'
            : '엑셀 파일 처리 중 오류가 발생했습니다: ' + error.message,
          'error'
        );
        event.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        brand: 'XRB',
        code: 'XL-001',
        name: '컴프레서',
        supplyPrice: '100000',
        price: '150000',
        barcode: '8801234567890',
        note: '예시 데이터입니다'
      },
      {
        brand: 'NB',
        code: 'NB-001',
        name: '필터',
        supplyPrice: '',  // 빈 값 예시
        price: '0',       // 0 값 예시
        barcode: '',      // 빈 값 예시
        note: ''          // 빈 값 예시
      },
      {
        brand: 'COMMON',
        code: 'COM-001',
        name: '공용 파츠 예시',
        supplyPrice: '50000',
        price: '75000',
        barcode: '',
        note: '파츠'
      }
    ];

    const headers = [
      { label: 'brand', key: 'brand' },
      { label: 'code', key: 'code' },
      { label: 'name', key: 'name' },
      { label: 'supplyPrice', key: 'supplyPrice' },
      { label: 'price', key: 'price' },
      { label: 'barcode', key: 'barcode' },
      { label: 'note', key: 'note' }
    ];

    downloadExcel(template, headers, "parts_template.xlsx");
  };

  const handleDownloadExcel = () => {
    if (!filteredParts || filteredParts.length === 0) {
      showSnackbar('다운로드할 데이터가 없습니다.', 'warning');
      return;
    }

    const exportData = filteredParts.map(part => ({
      '브랜드': part.brand || '',
      '코드': part.code || '',
      '제품명': part.name || '',
      '매입가': Number(part.supply_price) || 0,
      '판매가': Number(part.price) || 0,
      '재고': Number(part.stock) || 0,
      '바코드': part.barcode || '',
      '구분': part.note || ''
    }));

    const headers = [
      { label: '브랜드', key: '브랜드' },
      { label: '코드', key: '코드' },
      { label: '제품명', key: '제품명' },
      { label: '매입가', key: '매입가' },
      { label: '판매가', key: '판매가' },
      { label: '재고', key: '재고' },
      { label: '바코드', key: '바코드' },
      { label: '구분', key: '구분' }
    ];

    const today = new Date().toISOString().split('T')[0];
    const brandText = selectedBrand || '전체';
    downloadExcel(exportData, headers, `parts_${brandText}_${today}.xlsx`);
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // 필터링된 파츠 목록 최적화
  const filteredParts = useMemo(() => {
    if (selectedBrand === '전체' && !searchTerm) {
      return parts;
    }

    const searchTermLower = searchTerm.toLowerCase();
    return parts.filter(part => {
      // 브랜드로 필터링
      const brandMatch = selectedBrand === '전체' || part.brand === selectedBrand;
      if (!brandMatch) return false;
      // 구분(카테고리)로 필터링
      const categoryMatch = selectedCategory === '전체' || (part.note || '') === selectedCategory;
      if (!categoryMatch) return false;

      // 검색어가 없으면 브랜드 필터링만 적용
      if (!searchTerm) return true;

      // 검색어 필터링 (대소문자 구분 없이)
      return part.name?.toLowerCase().includes(searchTermLower) ||
        part.code?.toLowerCase().includes(searchTermLower) ||
        part.barcode?.toLowerCase().includes(searchTermLower) ||
        part.note?.toLowerCase().includes(searchTermLower);
    });
  }, [parts, searchTerm, selectedBrand, selectedCategory]);

  // 정렬된 파츠 목록
  const sortedParts = useMemo(() => {
    return sortData([...filteredParts], order, orderBy);
  }, [filteredParts, order, orderBy]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // 페이지네이션 핸들러
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 페이지네이션 적용된 파츠 목록
  const pagedParts = useMemo(() => {
    return sortedParts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedParts, page, rowsPerPage]);

  const renderSortableHeader = (id, label, align = 'left') => (
    <TableCell
      align={align}
      sortDirection={orderBy === id ? order : false}
      sx={{ cursor: 'pointer' }}
    >
      <TableSortLabel
        active={orderBy === id}
        direction={orderBy === id ? order : 'asc'}
        onClick={() => handleRequestSort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  // 체크박스 선택 처리 함수
  const handleSelectItem = (id) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // 전체 선택 처리 함수
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      const filteredIds = filteredParts.map(part => part.id);
      setSelectedItems(filteredIds);
    }
    setSelectAll(!selectAll);
  };

  // useEffect로 selectAll 상태 업데이트
  useEffect(() => {
    // 모든 항목이 선택되었는지 확인
    if (filteredParts.length > 0 && selectedItems.length === filteredParts.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedItems, filteredParts]);

  // 복사 다이얼로그 열기
  const handleOpenCopyDialog = () => {
    if (selectedItems.length === 0) {
      showSnackbar('복사할 항목을 선택해주세요.', 'warning');
      return;
    }

    // 다른 브랜드 선택 (현재 선택된 항목의 브랜드와 다른 브랜드)
    const selectedParts = parts.filter(part => selectedItems.includes(part.id));
    const currentBrands = [...new Set(selectedParts.map(part => part.brand))];

    // 타겟 브랜드 기본값 설정
    const availableBrands = brands.filter(brand => !currentBrands.includes(brand));
    if (availableBrands.length > 0) {
      setCopyTargetBrand(availableBrands[0]);
    } else {
      setCopyTargetBrand('');
    }

    setOpenCopyDialog(true);
  };

  // 복사 다이얼로그 닫기
  const handleCloseCopyDialog = () => {
    setOpenCopyDialog(false);
  };

  // 파츠 복사 실행
  const handleCopyParts = async () => {
    if (!copyTargetBrand) {
      showSnackbar('대상 브랜드를 선택해주세요.', 'error');
      return;
    }

    try {
      // 선택된 파츠 정보 가져오기
      const selectedPartsData = parts.filter(part => selectedItems.includes(part.id));

      // 각 파츠를 새로운 브랜드로 복사
      const newPartsData = selectedPartsData.map(part => ({
        name: part.name,
        brand: copyTargetBrand,
        code: part.code,
        supply_price: part.supply_price,
        price: part.price,
        barcode: part.barcode || null,
        note: part.note || null,
        stock: 0 // 초기 재고는 0으로 설정
      }));

      // 중복 체크를 위한 쿼리
      for (const newPart of newPartsData) {
        // 동일한 코드와 브랜드 조합 체크
        const { data: existingPart, error: checkError } = await supabase
          .from('parts')
          .select('id, code')
          .eq('code', newPart.code)
          .eq('brand', newPart.brand)
          .limit(1);

        if (checkError) throw checkError;

        // 이미 존재하는 경우 덮어쓰기
        if (existingPart && existingPart.length > 0) {
          const { error: updateError } = await supabase
            .from('parts')
            .update({
              name: newPart.name,
              supply_price: newPart.supply_price,
              price: newPart.price,
              barcode: newPart.barcode,
              note: newPart.note
            })
            .eq('id', existingPart[0].id);

          if (updateError) throw updateError;

          // 텔레그램 알림 (정보 업데이트) - 정지됨
          // try {
          //   await sendTelegramNotification({
          //     message: `부품 수정 (코드: ${newPart.code}) - 품명: ${newPart.name}, 브랜드: ${copyTargetBrand}`,
          //     link: `/parts`
          //   });
          // } catch (telegramError) {
          //   console.error('부품 정보 수정(복사) 텔레그램 알림 전송 중 오류:', telegramError);
          // }

        } else {
          // 새로 생성
          const { error: insertError } = await supabase
            .from('parts')
            .insert([newPart]);

          if (insertError) throw insertError;

          // 텔레그램 알림 (신규 등록) - 정지됨
          // try {
          //   await sendTelegramNotification({
          //     message: `부품 등록 (코드: ${newPart.code}) - 품명: ${newPart.name}, 브랜드: ${copyTargetBrand}`,
          //     link: `/parts`
          //   });
          // } catch (telegramError) {
          //   console.error('신규 부품 등록(복사) 텔레그램 알림 전송 중 오류:', telegramError);
          // }
        }
      }

      showSnackbar(`${newPartsData.length}개 파츠가 ${copyTargetBrand} 브랜드로 복사되었습니다.`, 'success');
      handleCloseCopyDialog();
      fetchParts(); // 목록 새로고침
    } catch (error) {
      console.error('파츠 복사 중 오류:', error);
      showSnackbar('파츠 복사 중 오류가 발생했습니다.', 'error');
    }
  };

  // 연동 다이얼로그 열기
  const handleOpenSyncDialog = (part) => {
    setSyncTargetPart(part);
    setSyncSearchTerm('');
    setOpenSyncDialog(true);
  };

  // 연동 다이얼로그 닫기
  const handleCloseSyncDialog = () => {
    setOpenSyncDialog(false);
    setSyncTargetPart(null);
    setSyncSearchTerm('');
  };

  // 연동 관계 생성
  const handleCreateSync = async (targetPartId) => {
    if (!syncTargetPart) return;

    try {
      const result = await createSyncRelation(syncTargetPart.id, targetPartId);
      if (result.success) {
        showSnackbar('파츠 연동이 완료되었습니다.', 'success');
        handleCloseSyncDialog();
        fetchParts(); // 목록 새로고침
      } else {
        showSnackbar(result.error || '연동 실패', 'error');
      }
    } catch (error) {
      console.error('연동 생성 중 오류:', error);
      showSnackbar('연동 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  // 연동 관계 삭제
  const handleDeleteSync = async (relationId, partId) => {
    if (!window.confirm('연동을 해제하시겠습니까?')) return;

    try {
      const result = await deleteSyncRelationById(relationId);
      if (result.success) {
        showSnackbar('연동이 해제되었습니다.', 'success');
        fetchParts(); // 목록 새로고침
      } else {
        showSnackbar(result.error || '연동 해제 실패', 'error');
      }
    } catch (error) {
      console.error('연동 삭제 중 오류:', error);
      showSnackbar('연동 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  // 연동할 파츠 검색 필터링
  const filteredSyncParts = useMemo(() => {
    if (!syncTargetPart) return [];

    const searchLower = syncSearchTerm.toLowerCase();
    return parts.filter(part => {
      // 자기 자신 제외
      if (part.id === syncTargetPart.id) return false;
      // 이미 연동된 파츠 제외
      const synced = syncedPartsMap[syncTargetPart.id] || [];
      if (synced.some(sp => sp.part.id === part.id)) return false;
      // 검색어 필터링
      if (!syncSearchTerm) return true;
      return part.name?.toLowerCase().includes(searchLower) ||
        part.code?.toLowerCase().includes(searchLower);
    });
  }, [parts, syncTargetPart, syncSearchTerm, syncedPartsMap]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon />
        파츠 관리
      </Typography>
      <Box sx={{ mt: 3, mb: 3 }}>
        {/* 상단 액션 버튼 영역 */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
              >
                추가
              </Button>
            </Grid>

            <Grid item>
              <Button
                variant="contained"
                startIcon={<FileCopyIcon />}
                onClick={handleOpenCopyDialog}
                disabled={selectedItems.length === 0}
                sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' } }}
              >
                선택 항목 복사
              </Button>
            </Grid>

            <Grid item>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectAll}
                    onChange={handleSelectAll}
                    icon={<CheckBoxIcon fontSize="small" />}
                  />
                }
                label={`전체 선택 ${selectedItems.length > 0 ? `(${selectedItems.length}개)` : ''}`}
              />
            </Grid>

            <Grid item xs />

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => document.getElementById('excel-upload').click()}
              >
                파츠 업로드
              </Button>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
                style={{ display: 'none' }}
              />
            </Grid>

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
              >
                엑셀 다운로드
              </Button>
            </Grid>

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
              >
                템플릿 다운로드
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 검색 및 필터 영역 */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="브랜드"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                <MenuItem value="전체">전체</MenuItem>
                {brands.map(brand => (
                  <MenuItem key={brand} value={brand}>
                    {brand === 'XRB' ? 'X-RIDER' : brand === 'NB' ? 'NEARBIKE' : '공용'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <SearchInput
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                onSearch={executeSearch}
                onClear={handleClearSearch}
                isSearching={isSearching}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="구분"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {['전체', '파츠', '기체', '공임', '기타'].map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showSupplyPrice}
                    onChange={(e) => setShowSupplyPrice(e.target.checked)}
                  />
                }
                label="매입가 표시"
                sx={{ m: 0 }}
              />
            </Grid>
          </Grid>

          {/* 검색 결과 카운트 */}
          {searchTerm && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                검색어: <strong>{searchTerm}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                검색 결과: <strong>{filteredParts.length}건</strong>
              </Typography>
              <IconButton
                size="small"
                onClick={handleClearSearch}
                sx={{ ml: 1 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Paper>
      </Box>

      {/* 브랜드 탭 */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={selectedBrand}
          onChange={(e, newValue) => setSelectedBrand(newValue)}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minWidth: 120,
              fontWeight: 'medium'
            }
          }}
        >
          {brands.map((brand) => (
            <Tab
              key={brand}
              value={brand}
              label={brand === 'XRB' ? 'X-RIDER' : brand === 'NB' ? 'NEARBIKE' : '공용'}
              sx={{
                '&.Mui-selected': {
                  fontWeight: 'bold'
                }
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 테이블 영역 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </TableCell>
              {renderSortableHeader('brand', '브랜드')}
              {renderSortableHeader('code', '코드')}
              {renderSortableHeader('barcode', '바코드')}
              {renderSortableHeader('name', '제품명')}
              {showSupplyPrice && renderSortableHeader('supply_price', '매입가', 'right')}
              {renderSortableHeader('price', '판매가', 'right')}
              {renderSortableHeader('stock', '재고', 'right')}
              {renderSortableHeader('note', '구분')}
              <TableCell>연동</TableCell>
              <TableCell align="right">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedParts.map((part) => (
              <TableRow key={part.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedItems.includes(part.id)}
                    onChange={() => handleSelectItem(part.id)}
                  />
                </TableCell>
                <TableCell>{part.brand}</TableCell>
                <TableCell>{part.code}</TableCell>
                <TableCell>
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      color: part.barcode ? 'text.primary' : 'text.secondary',
                      fontStyle: part.barcode ? 'normal' : 'italic'
                    }}
                  >
                    {part.barcode || '-'}
                  </Typography>
                </TableCell>
                <TableCell>{part.name}</TableCell>
                {showSupplyPrice && <TableCell align="right">{part.supply_price?.toLocaleString()}</TableCell>}
                <TableCell align="right">{part.price?.toLocaleString()}</TableCell>
                <TableCell align="right">{part.stock || 0}</TableCell>
                <TableCell>
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      color: part.note ? 'text.primary' : 'text.secondary',
                      fontStyle: part.note ? 'normal' : 'italic'
                    }}
                  >
                    {part.note || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  {syncedPartsMap[part.id] && syncedPartsMap[part.id].length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {syncedPartsMap[part.id].map((sp, idx) => (
                        <Box key={sp.relationId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LinkIcon fontSize="small" color="primary" />
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            {sp.part.brand} {sp.part.code}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteSync(sp.relationId, part.id)}
                            sx={{ p: 0, ml: 0.5 }}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      없음
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(part)}
                  >
                    <EditIcon />
                  </IconButton>
                  <Tooltip title="연동 설정">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenSyncDialog(part)}
                      sx={{
                        color: (syncedPartsMap[part.id] && syncedPartsMap[part.id].length > 0)
                          ? 'primary.main'
                          : 'action.disabled'
                      }}
                    >
                      <LinkIcon />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(part.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={sortedParts.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="페이지당 표시"
        />
      </TableContainer>

      <PartsFormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        initialData={selectedPart}
        brands={brands}
        getNextPartCode={getNextPartCode}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={uploadStatus.open}
        maxWidth="sm"
        fullWidth
        transitionDuration={0}
        PaperProps={{
          sx: { p: 2 }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          엑셀 파일 등록 중...
        </DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={uploadStatus.current}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography sx={{ mt: 2, mb: 1 }} variant="body1">
              {uploadStatus.message}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {uploadStatus.step}/5 단계
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 파츠 복사 다이얼로그 */}
      <Dialog open={openCopyDialog} onClose={handleCloseCopyDialog}>
        <DialogTitle>파츠 복사</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: 400, mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              선택된 {selectedItems.length}개 항목을 다른 브랜드로 복사합니다.
            </Typography>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>대상 브랜드</InputLabel>
              <Select
                value={copyTargetBrand}
                onChange={(e) => setCopyTargetBrand(e.target.value)}
                label="대상 브랜드"
              >
                {brands.map(brand => (
                  <MenuItem key={brand} value={brand}>
                    {brand === 'XRB' ? 'X-RIDER' : brand === 'NB' ? 'NEARBIKE' : '공용'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              * 이미 존재하는 코드는 정보가 업데이트됩니다.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              * 복사된 항목의 초기 재고는 0으로 설정됩니다.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCopyDialog}>취소</Button>
          <Button
            onClick={handleCopyParts}
            variant="contained"
            color="primary"
            disabled={!copyTargetBrand}
          >
            복사
          </Button>
        </DialogActions>
      </Dialog>

      {/* 파츠 연동 다이얼로그 */}
      <Dialog open={openSyncDialog} onClose={handleCloseSyncDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">파츠 연동 설정</Typography>
            <IconButton onClick={handleCloseSyncDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {syncTargetPart && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>{syncTargetPart.name}</strong> ({syncTargetPart.code}, {syncTargetPart.brand})
              </Typography>

              {/* 현재 연동된 파츠 목록 */}
              {syncedPartsMap[syncTargetPart.id] && syncedPartsMap[syncTargetPart.id].length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>현재 연동된 파츠:</Typography>
                  {syncedPartsMap[syncTargetPart.id].map((sp) => (
                    <Box key={sp.relationId} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <LinkIcon color="primary" />
                      <Typography variant="body2">
                        {sp.part.name} ({sp.part.code}, {sp.part.brand}) - 재고: {sp.part.stock || 0}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteSync(sp.relationId, syncTargetPart.id)}
                        color="error"
                      >
                        <LinkOffIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* 연동할 파츠 검색 */}
              <TextField
                fullWidth
                size="small"
                placeholder="연동할 파츠 검색 (이름 또는 코드)"
                value={syncSearchTerm}
                onChange={(e) => setSyncSearchTerm(e.target.value)}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />

              {/* 연동 가능한 파츠 목록 */}
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>브랜드</TableCell>
                      <TableCell>코드</TableCell>
                      <TableCell>파츠명</TableCell>
                      <TableCell align="right">재고</TableCell>
                      <TableCell align="right">액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSyncParts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          {syncSearchTerm ? '검색 결과가 없습니다.' : '연동할 파츠를 검색해주세요.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSyncParts.map((part) => (
                        <TableRow key={part.id} hover>
                          <TableCell>{part.brand}</TableCell>
                          <TableCell>{part.code}</TableCell>
                          <TableCell>{part.name}</TableCell>
                          <TableCell align="right">{part.stock || 0}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LinkIcon />}
                              onClick={() => handleCreateSync(part.id)}
                            >
                              연동
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                * 연동된 파츠들은 재고가 함께 차감됩니다.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSyncDialog}>닫기</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default PartsManagement; 