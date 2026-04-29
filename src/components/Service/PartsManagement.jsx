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
  RadioGroup,
  Radio,
  InputLabel,
  Select,
  CircularProgress,
  TablePagination,
  Stack,
  Chip,
  Avatar
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
import { getErrorMessage, isOffline, safeRetry } from '../../utils/networkUtils';
import { getSyncedParts, createSyncRelation, deleteSyncRelationById } from '../../utils/partSyncUtils';
import Barcode from 'react-barcode';
import { uploadFileToGoogleDrive as uploadToR2 } from '../../utils/cloudflareR2Utils';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';

const BRANDS = ['XRB', 'NB', 'COMMON'];

// 입력 폼 컴포넌트 분리
const PartsFormDialog = memo(({
  open,
  onClose,
  onSubmit,
  initialData,
  brands,
  getNextPartCode,
  getNextBarcode
}) => {
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    brand: '',
    code: '',
    costPrice: '',
    supplyPrice: '',
    specialPrice: '',
    price: '',
    barcode: '',
    memo: '',
    note: '파츠',
    image_url: ''
  });

  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [enlargedImage, setEnlargedImage] = useState(null);

  // 폼이 열려있는지 추적하여 불필요한 리셋 방지
  const isOpenRef = useRef(open);
  const prevInitialDataRef = useRef(initialData);

  useEffect(() => {
    // 닫혀있다가 열릴 때, 또는 initialData가 변경될 때만 초기화
    const justOpened = open && !isOpenRef.current;
    const dataChanged = initialData !== prevInitialDataRef.current;

    if (justOpened || (open && dataChanged)) {
      setImageFile(null);
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          name_en: initialData.name_en || '',
          brand: initialData.brand || '',
          code: initialData.code || '',
          costPrice: initialData.cost_price?.toString() || '',
          supplyPrice: initialData.supply_price?.toString() || '',
          specialPrice: initialData.special_price?.toString() || '',
          price: initialData.price?.toString() || '',
          barcode: initialData.barcode || '',
          memo: initialData.memo || '',
          note: initialData.note || '파츠',
          image_url: initialData.image_url || ''
        });
        setImagePreview(initialData.image_url || '');
      } else {
        const defaultBrand = brands[0] || '';
        const defaultCategory = '파츠';
        // 신규 등록일 때만 코드 추천
        const suggestedCode = typeof getNextPartCode === 'function' ? getNextPartCode(defaultBrand, defaultCategory) : '';
        setFormData({
          name: '',
          name_en: '',
          brand: defaultBrand,
          code: suggestedCode,
          costPrice: '',
          supplyPrice: '',
          specialPrice: '',
          price: '',
          barcode: '',
          memo: '',
          note: defaultCategory,
          image_url: ''
        });
        setImagePreview('');
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
        [name]: ['price', 'supplyPrice', 'costPrice', 'specialPrice'].includes(name) ? value.replace(/[^0-9]/g, '') : value
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

  const handleVatCalc = useCallback((field, type) => {
    setFormData(prev => {
      const val = parseInt(prev[field]?.toString().replace(/,/g, '') || '0', 10);
      if (!val) return prev;
      let newVal = val;
      if (type === 'add') {
        newVal = Math.round(val * 1.1);
      } else if (type === 'remove') {
        newVal = Math.round(val / 1.1);
      }
      return { ...prev, [field]: newVal.toString() };
    });
  }, []);

  const renderVatButtons = (field) => (
    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, justifyContent: 'flex-end' }}>
      <Typography 
        variant="caption" 
        color="primary" 
        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
        onClick={() => handleVatCalc(field, 'add')}
      >
        VAT 포함
      </Typography>
      <Typography 
        variant="caption" 
        color="secondary" 
        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
        onClick={() => handleVatCalc(field, 'remove')}
      >
        VAT 제외
      </Typography>
    </Box>
  );

  const handleSubmit = useCallback(() => {
    onSubmit(formData, imageFile);
  }, [formData, imageFile, onSubmit]);

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > 300) {
              height = Math.round(height * (300 / width));
              width = 300;
            }
          } else {
            if (height > 300) {
              width = Math.round(width * (300 / height));
              height = 300;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
              resolve({ file: compressedFile, dataUrl: canvas.toDataURL('image/jpeg') });
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          }, 'image/jpeg', 0.85);
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processImageFile = async (file) => {
    if (file) {
      if (file.type.startsWith('image/')) {
        try {
          const { file: compressedFile, dataUrl } = await compressImage(file);
          setImageFile(compressedFile);
          setImagePreview(dataUrl);
        } catch (err) {
          console.error('Image compression error:', err);
          setImageFile(file); // fallback
          setImagePreview(URL.createObjectURL(file));
        }
      } else {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      }
    }
  };

  const handleImageChange = (e) => {
    processImageFile(e.target.files[0]);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          // Prevent default only if an image was caught so we don't break text pasting
          e.preventDefault(); 
          processImageFile(file);
        }
        break;
      }
    }
  };

  return (
    <>
      <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      transitionDuration={0}
      onPaste={handlePaste}
    >
      <DialogTitle>
        {initialData ? '파츠 수정' : '파츠 등록'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 2 }}>
          <Grid item xs={12} md={6}>
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
          <Grid item xs={12} md={6}>
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
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                label="바코드"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
              />
              <Button
                variant="outlined"
                sx={{ height: 56, minWidth: 60 }}
                onClick={() => {
                  if (typeof getNextBarcode === 'function') {
                    const newBarcode = getNextBarcode();
                    setFormData(prev => ({ ...prev, barcode: newBarcode }));
                  } else {
                    const randomCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
                    setFormData(prev => ({ ...prev, barcode: randomCode }));
                  }
                }}
              >
                생성
              </Button>
              <Button
                variant="outlined"
                sx={{ height: 56, minWidth: 60 }}
                disabled={!formData.barcode}
                onClick={() => setShowBarcodePreview(true)}
              >
                보기
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="파츠명 (국문) 필수"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </Grid>
          {/* 이미지 업로드 영역 */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
              <Avatar
                src={imagePreview}
                variant="rounded"
                sx={{ width: 80, height: 80, bgcolor: 'background.paper', border: '1px solid #ddd', cursor: imagePreview ? 'pointer' : 'default' }}
                onClick={() => imagePreview && setEnlargedImage(imagePreview)}
              >
                {!imagePreview && <Box sx={{ fontSize: '0.7rem', color: '#999' }}>이미지 없음</Box>}
              </Avatar>
              <Box>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="parts-image-upload"
                  type="file"
                  onChange={handleImageChange}
                />
                <label htmlFor="parts-image-upload">
                  <Button variant="outlined" component="span" size="small" startIcon={<CloudUploadIcon />}>
                    이미지 업로드
                  </Button>
                </label>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  추천 크기: 300x300픽셀 (최대 1장) <br/>
                  (이 창 어디서나 <b>Ctrl+V / Cmd+V</b>로 클립보드 붙여넣기 가능)
                </Typography>
                {imagePreview && (
                  <Button size="small" color="error" onClick={() => { setImageFile(null); setImagePreview(''); setFormData(prev => ({...prev, image_url: ''})); }} sx={{ mt: 0.5, p: 0, minWidth: 'auto', textTransform: 'none' }}>
                    등록된 이미지 삭제
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="파츠명 (영문)"
              name="name_en"
              value={formData.name_en}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="판매가 (소비자가)"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
            />
            {renderVatButtons('price')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="원가 (매입가)"
              name="costPrice"
              value={formData.costPrice}
              onChange={handleChange}
              InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
            />
            {renderVatButtons('costPrice')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="공급가 (대리점가)"
              name="supplyPrice"
              value={formData.supplyPrice}
              onChange={handleChange}
              required
              InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
            />
            {renderVatButtons('supplyPrice')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="특별 공급가"
              name="specialPrice"
              value={formData.specialPrice}
              onChange={handleChange}
              InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
            />
            {renderVatButtons('specialPrice')}
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="적요"
              name="memo"
              value={formData.memo}
              onChange={handleChange}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained">
          {initialData ? '수정' : '등록'}
        </Button>
      </DialogActions>

      {/* 바코드 미리보기 모달 */}
      <Dialog
        open={showBarcodePreview}
        onClose={() => setShowBarcodePreview(false)}
        maxWidth="xs"
      >
        <DialogTitle sx={{ textAlign: 'center' }}>바코드 미리보기</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          {formData.barcode && (
            <Barcode value={formData.barcode} width={2} height={80} displayValue={true} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBarcodePreview(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
      </Dialog>
      
      {/* 이미지 확대 모달 (PartForm용) */}
      <Dialog open={!!enlargedImage} onClose={() => setEnlargedImage(null)} maxWidth="md">
        <DialogContent sx={{ p: 1, position: 'relative', bgcolor: 'transparent', textAlign: 'center' }}>
          <IconButton 
            onClick={() => setEnlargedImage(null)} 
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            <CloseIcon />
          </IconButton>
          <img src={enlargedImage} alt="Enlarged" style={{ maxWidth: '100%', height: 'auto', display: 'block', maxHeight: '80vh', objectFit: 'contain', margin: '0 auto' }} />
        </DialogContent>
      </Dialog>
    </>
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
  const [enlargedImage, setEnlargedImage] = useState(null);
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

  // 일괄 가격 수정 상태
  const [openBatchEditDialog, setOpenBatchEditDialog] = useState(false);
  const [batchEditTarget, setBatchEditTarget] = useState('supply_price'); // 'cost_price', 'supply_price', 'special_price'
  const [batchEditMode, setBatchEditMode] = useState('percent'); // 'percent', 'amount'
  const [batchEditValue, setBatchEditValue] = useState('');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // 연동 관련 상태 추가
  const [openSyncDialog, setOpenSyncDialog] = useState(false);
  const [syncTargetPart, setSyncTargetPart] = useState(null);
  const [syncSearchTerm, setSyncSearchTerm] = useState('');
  const [syncedPartsMap, setSyncedPartsMap] = useState({}); // partId -> [syncedParts]
  
  // Cafe24 연동 상태
  const [cafe24Links, setCafe24Links] = useState(new Set());

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

  // 다음 바코드 생성기 (EAN-13, 접두사 88092499)
  const getNextBarcode = useCallback(() => {
    const prefix = '88092499';
    // 해당 접두사로 시작하는 13자리 바코드 추출
    const existingBarcodes = parts
      .map(p => p.barcode)
      .filter(b => b && b.startsWith(prefix) && b.length === 13);
    
    // 기본적으로 시작할 상품코드 (사용자 요청에 따라 2008 이후인 2009부터 생성되도록 기준 2008 설정)
    let maxItemNum = 2008;
    
    if (existingBarcodes.length > 0) {
      // 바코드에서 상품코드(4자리) 추출하여 최댓값 구하기
      // 예: 8809249920085 -> 88092499(8자리) + 2008(4자리) + 5(1자리)
      const itemNumbers = existingBarcodes.map(b => parseInt(b.substring(8, 12), 10));
      const currentMax = Math.max(...itemNumbers);
      if (currentMax > maxItemNum) {
        maxItemNum = currentMax;
      }
    }
    
    const nextItemNum = maxItemNum + 1;
    // 상품코드 4자리 패딩 (예: 2009)
    const nextItemStr = String(nextItemNum).padStart(4, '0');
    const base12 = prefix + nextItemStr; // 12자리 기본 번호
    
    // EAN-13 체크디짓 계산 루틴
    let oddSum = 0;
    let evenSum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base12[i], 10);
      // 인덱스가 짝수면 위치로는 홀수번째 -> 홀수합(1배)
      // 인덱스가 홀수면 위치로는 짝수번째 -> 짝수합(3배)
      if (i % 2 === 0) {
        oddSum += digit;
      } else {
        evenSum += digit;
      }
    }
    
    const totalSum = oddSum + (evenSum * 3);
    const checkDigit = (10 - (totalSum % 10)) % 10;
    
    return base12 + checkDigit.toString();
  }, [parts]);

  // [디바운스 적용]
  const debouncedSearchInput = useDebounce(searchInput, 300);
  React.useEffect(() => {
    // 입력이 멈춘 뒤 300ms 후에만 검색 실행
    setSearchTerm(debouncedSearchInput);
    setPage(0); // 검색 시 페이지 초기화
  }, [debouncedSearchInput]);

  // [검색 버튼/엔터는 즉시 검색]
  const executeSearch = useCallback(() => {
    setIsSearching(true);
    setSearchTerm(searchInput);
    setPage(0); // 검색 시 페이지 초기화
    setIsSearching(false);
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
    setPage(0); // 초기화 시 페이지 리셋
  }, []);

  const brands = BRANDS; // 브랜드 목록 수정 (공용 추가)
  const navigate = useNavigate();

  useEffect(() => {
    fetchParts();
  }, []);

  // 연동된 파츠 정보 로드
  useEffect(() => {
    const loadSyncedParts = async () => {
      try {
        const { getAllSyncRelations } = await import('../../utils/partSyncUtils');
        const relations = await getAllSyncRelations();
        const map = {};
        
        relations.forEach(rel => {
          if (!map[rel.part_id_1]) map[rel.part_id_1] = [];
          map[rel.part_id_1].push({
            relationId: rel.id,
            part: rel.parts_2
          });
          
          if (!map[rel.part_id_2]) map[rel.part_id_2] = [];
          map[rel.part_id_2].push({
            relationId: rel.id,
            part: rel.parts_1
          });
        });
        
        setSyncedPartsMap(map);
      } catch (err) {
        console.error('연동 파츠 로딩 실패:', err);
      }
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
      
      // Cafe24 연동 데이터 가져오기 (매칭된 상품)
      const { data: cafe24Data, error: cafe24Error } = await safeRetry(async () => {
        return await supabase.from('cafe24_product_to_part').select('part_id');
      });
      if (!cafe24Error && cafe24Data) {
        setCafe24Links(new Set(cafe24Data.map(d => Number(d.part_id))));
      }

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

  const handleSubmit = useCallback(async (formData, imageFile) => {
    try {
      let finalImageUrl = formData.image_url;

      // 이미지가 새로 업로드된 경우
      if (imageFile) {
        showSnackbar('이미지를 클라우드에 업로드 중입니다...', 'info');
        const uploadResult = await uploadToR2(imageFile, 'parts');
        finalImageUrl = uploadResult.url;
      }

      const partData = {
        name: formData.name,
        name_en: formData.name_en || null,
        brand: formData.brand,
        code: formData.code,
        cost_price: Number(formData.costPrice || 0),
        supply_price: Number(formData.supplyPrice || 0),
        special_price: Number(formData.specialPrice || 0),
        price: Number(formData.price || 0),
        image_url: finalImageUrl
      };

      if (formData.barcode) partData.barcode = formData.barcode;
      if (formData.memo) partData.memo = formData.memo;
      if (formData.note) partData.note = formData.note;

      if (selectedPart) {
        const { error } = await supabase
          .from('parts')
          .update(partData)
          .eq('id', selectedPart.id);

        if (error) throw error;

        showSnackbar(`부품이 성공적으로 수정되었습니다.`, 'success');

        // 텔레그램 알림 전송 (수정)
        try {
          await sendTelegramNotification({
            message: `부품 수정 (코드: ${partData.code}) - 품명: ${partData.name}`,
            link: `/parts`
          }, { eventType: 'part_edit' });
        } catch (telegramError) {
          console.error('부품 정보 수정 텔레그램 알림 전송 중 오류:', telegramError);
        }

      } else {
        const { data: insertedPart, error } = await supabase
          .from('parts')
          .insert([partData])
          .select(); // 등록된 데이터 가져오기

        if (error) throw error;

        showSnackbar(`부품이 성공적으로 등록되었습니다.`, 'success');

        // 텔레그램 알림 전송 (신규 등록)
        if (insertedPart && insertedPart.length > 0) {
          const newPart = insertedPart[0];
          try {
            await sendTelegramNotification({
              message: `부품 등록 (코드: ${newPart.code}) - 품명: ${newPart.name}`,
              link: `/parts`
            }, { eventType: 'part_add' });
          } catch (telegramError) {
            console.error('신규 부품 등록 텔레그램 알림 전송 중 오류:', telegramError);
          }
        }
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

      const brand = row.brand || row['브랜드'] || '';
      const name = row.name || row['제품명'] || '';
      const code = row.code || row['코드'] || '';
      const name_en = row.name_en || row['영문명'] || '';
      const cost_price = row.costPrice || row.cost_price || row['원가'] || 0;
      const supply_price = row.supplyPrice || row.supply_price || row['매입가'] || row['공급가'] || 0;
      const special_price = row.specialPrice || row.special_price || row['특별공급가'] || 0;
      const price = row.price || row['판매가'] || 0;
      const barcode = row.barcode || row['바코드'] || '';
      const note = row.note || row['구분'] || row['카테고리'] || '';

      if (!brand) rowErrors.push('브랜드');
      if (!name) rowErrors.push('제품명');

      if (brand && !['XRB', 'NB', 'COMMON', '공용'].includes(String(brand).toUpperCase())) {
        errors.push(`${index + 2}번 행: 브랜드는 XRB, NB 또는 COMMON(공용)만 입력 가능합니다.`);
        return;
      }

      if (rowErrors.length > 0) {
        errors.push(`${index + 2}번 행: ${rowErrors.join(', ')} 필드가 누락되었습니다.`);
        return;
      }

      validData.push({
        brand: String(brand).toUpperCase() === '공용' ? 'COMMON' : String(brand).toUpperCase(),
        code: code ? String(code).trim() : '',
        name: String(name).trim(),
        name_en: String(name_en).trim(),
        cost_price: Number(String(cost_price).replace(/[^0-9]/g, '') || 0),
        supply_price: Number(String(supply_price).replace(/[^0-9]/g, '') || 0),
        special_price: Number(String(special_price).replace(/[^0-9]/g, '') || 0),
        price: Number(String(price).replace(/[^0-9]/g, '') || 0),
        barcode: barcode ? String(barcode).trim() : null,
        note: note ? String(note).trim() : null
      });
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

        // 1) 포맷팅 완료된 validData 활용
        const formattedData = validData;

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

        // 텔레그램 알림 전송 (엑셀 업로드)
        for (const newPart of finalData) {
          try {
            await sendTelegramNotification({
              message: `부품 등록 (코드: ${newPart.code}) - 품명: ${newPart.name}`,
              link: `/parts`
            }, { eventType: 'part_add' });
          } catch (telegramError) {
            console.error('엑셀 부품 등록 텔레그램 알림 전송 중 오류:', telegramError);
            // 개별 알림 실패는 전체 프로세스를 중단시키지 않도록 처리
          }
        }

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
        '브랜드': 'XRB',
        '코드': 'XL-001',
        '제품명': '컴프레서',
        '영문명': 'Compressor',
        '원가': 80000,
        '공급가': 100000,
        '특별공급가': 95000,
        '판매가': 150000,
        '바코드': '8801234567890',
        '구분': '파츠'
      },
      {
        '브랜드': 'NB',
        '코드': 'NB-001',
        '제품명': '필터',
        '영문명': '',
        '원가': 0,
        '공급가': 0,
        '특별공급가': 0,
        '판매가': 0,
        '바코드': '',
        '구분': ''
      }
    ];

    const headers = [
      { label: '브랜드', key: '브랜드' },
      { label: '코드', key: '코드' },
      { label: '제품명', key: '제품명' },
      { label: '영문명', key: '영문명' },
      { label: '원가', key: '원가' },
      { label: '공급가', key: '공급가' },
      { label: '특별공급가', key: '특별공급가' },
      { label: '판매가', key: '판매가' },
      { label: '바코드', key: '바코드' },
      { label: '구분', key: '구분' }
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
      '영문명': part.name_en || '',
      '원가': Number(part.cost_price) || 0,
      '공급가': Number(part.supply_price) || 0,
      '특별공급가': Number(part.special_price) || 0,
      '판매가': Number(part.price) || 0,
      '재고': Number(part.stock) || 0,
      '바코드': part.barcode || '',
      '구분': part.note || ''
    }));

    const headers = [
      { label: '브랜드', key: '브랜드' },
      { label: '코드', key: '코드' },
      { label: '제품명', key: '제품명' },
      { label: '영문명', key: '영문명' },
      { label: '원가', key: '원가' },
      { label: '공급가', key: '공급가' },
      { label: '특별공급가', key: '특별공급가' },
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

          // 텔레그램 알림 (정보 업데이트)
          try {
            await sendTelegramNotification({
              message: `부품 수정 (코드: ${newPart.code}) - 품명: ${newPart.name}, 브랜드: ${copyTargetBrand}`,
              link: `/parts`
            }, { eventType: 'part_edit' });
          } catch (telegramError) {
            console.error('부품 정보 수정(복사) 텔레그램 알림 전송 중 오류:', telegramError);
          }

        } else {
          // 새로 생성
          const { error: insertError } = await supabase
            .from('parts')
            .insert([newPart]);

          if (insertError) throw insertError;

          // 텔레그램 알림 (신규 등록)
          try {
            await sendTelegramNotification({
              message: `부품 등록 (코드: ${newPart.code}) - 품명: ${newPart.name}, 브랜드: ${copyTargetBrand}`,
              link: `/parts`
            }, { eventType: 'part_add' });
          } catch (telegramError) {
            console.error('신규 부품 등록(복사) 텔레그램 알림 전송 중 오류:', telegramError);
          }
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

  // 일괄 가격 수정 다이얼로그 열기
  const handleOpenBatchEditDialog = () => {
    if (selectedItems.length === 0) {
      showSnackbar('수정할 항목을 선택해주세요.', 'warning');
      return;
    }
    setBatchEditValue('');
    setOpenBatchEditDialog(true);
  };

  const handleCloseBatchEditDialog = () => {
    setOpenBatchEditDialog(false);
  };

  const handleBatchUpdatePrices = async () => {
    if (!batchEditValue || isNaN(Number(batchEditValue))) {
      showSnackbar('유효한 숫자를 입력해주세요.', 'warning');
      return;
    }

    const value = Number(batchEditValue);
    if (batchEditMode === 'percent' && (value < 0 || value > 200)) {
       showSnackbar('유효한 퍼센트 범위를 입력해주세요 (0~200).', 'warning');
       return;
    }

    try {
      setIsBatchUpdating(true);
      const selectedPartsData = parts.filter(part => selectedItems.includes(part.id));
      const updatePromises = selectedPartsData.map(part => {
        const salesPrice = Number(part.price || 0);
        let newValue = 0;
        
        if (batchEditMode === 'percent') {
          newValue = Math.round(salesPrice * (value / 100));
        } else if (batchEditMode === 'amount') {
          newValue = Math.max(0, salesPrice - value);
        }

        const updates = {};
        updates[batchEditTarget] = newValue;

        return supabase
          .from('parts')
          .update(updates)
          .eq('id', part.id);
      });

      await Promise.all(updatePromises);
      showSnackbar(`${selectedItems.length}개 항목의 가격이 일괄 수정되었습니다.`, 'success');
      handleCloseBatchEditDialog();
      setSelectedItems([]);
      fetchParts();
    } catch (error) {
      console.error('일괄 가격 수정 오류:', error);
      showSnackbar('가격 수정 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsBatchUpdating(false);
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
        상품 관리
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
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleOpenBatchEditDialog}
                disabled={selectedItems.length === 0}
                sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' }, color: 'white' }}
              >
                일괄 가격 수정
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
        <Table size="small" sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>이미지</TableCell>
              {renderSortableHeader('brand', '브랜드')}
              {renderSortableHeader('code', '코드')}
              {renderSortableHeader('barcode', '바코드')}
              {renderSortableHeader('name', '제품명')}
              {showSupplyPrice && renderSortableHeader('cost_price', '매입가(원가)', 'right')}
              {renderSortableHeader('supply_price', '공급가', 'right')}
              {showSupplyPrice && renderSortableHeader('special_price', '특별공급가', 'right')}
              {renderSortableHeader('price', '판매가', 'right')}
              {renderSortableHeader('note', '구분')}
              {/* <TableCell>연동</TableCell> */}
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
                <TableCell>
                  <Avatar src={part.image_url} alt={part.name} variant="rounded" sx={{ width: 40, height: 40, bgcolor: 'transparent', border: '1px solid #ddd', cursor: part.image_url ? 'pointer' : 'default' }} onClick={() => part.image_url && setEnlargedImage(part.image_url)}>
                    <Box sx={{ fontSize: '0.4rem', color: '#999' }}>No img</Box>
                  </Avatar>
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
                <TableCell>
                  {part.name}
                  {part.name_en && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {part.name_en}
                    </Typography>
                  )}
                  {cafe24Links.has(Number(part.id)) && (
                    <Chip size="small" label="Cafe24 연동" color="info" sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }} />
                  )}
                </TableCell>
                {showSupplyPrice && <TableCell align="right">{part.cost_price?.toLocaleString() || '-'}</TableCell>}
                <TableCell align="right">{part.supply_price?.toLocaleString() || '-'}</TableCell>
                {showSupplyPrice && <TableCell align="right">{part.special_price?.toLocaleString() || '-'}</TableCell>}
                <TableCell align="right">{part.price?.toLocaleString() || '-'}</TableCell>
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
                {/* 
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
                */}
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(part)}
                  >
                    <EditIcon />
                  </IconButton>
                  {/*
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
                  */}
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
        getNextBarcode={getNextBarcode}
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
                        {sp.part.name} ({sp.part.code}, {sp.part.brand})
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
                <Table size="small" stickyHeader sx={{ border: '1px solid rgba(224, 224, 224, 1)', '& th, & td': { border: '1px solid rgba(224, 224, 224, 1)' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>브랜드</TableCell>
                      <TableCell>코드</TableCell>
                      <TableCell>파츠명</TableCell>
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

      <Dialog open={openBatchEditDialog} onClose={handleCloseBatchEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>선택 항목 일괄 가격 수정 ({selectedItems.length}개)</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            선택한 {selectedItems.length}개 항목의 대상을 지정한 후, 해당 항목의 <strong>판매가</strong>를 기준으로 일괄 계산하여 적용합니다.
          </Typography>

          <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>적용 대상 선택</Typography>
            <RadioGroup row value={batchEditTarget} onChange={(e) => setBatchEditTarget(e.target.value)}>
              <FormControlLabel value="cost_price" control={<Radio />} label="매입가" />
              <FormControlLabel value="supply_price" control={<Radio />} label="공급가" />
              <FormControlLabel value="special_price" control={<Radio />} label="특별 공급가" />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>계산 방식 (판매가 기준)</Typography>
            <RadioGroup row value={batchEditMode} onChange={(e) => setBatchEditMode(e.target.value)}>
              <FormControlLabel value="percent" control={<Radio />} label="판매가의 % 적용" />
              <FormControlLabel value="amount" control={<Radio />} label="판매가에서 정액 차감" />
            </RadioGroup>
          </FormControl>

          <TextField
            fullWidth
            label={batchEditMode === 'percent' ? "비율 (%)" : "차감 금액 (원)"}
            type="number"
            value={batchEditValue}
            onChange={(e) => setBatchEditValue(e.target.value)}
            placeholder={batchEditMode === 'percent' ? "예: 70" : "예: 10000"}
            helperText={batchEditMode === 'percent' 
              ? "예: 70 입력 시 '판매가 × 0.7'로 일괄 적용됩니다." 
              : "예: 10000 입력 시 '판매가 - 10,000원'으로 일괄 적용됩니다."}
            InputProps={{
              endAdornment: <InputAdornment position="end">{batchEditMode === 'percent' ? '%' : '원'}</InputAdornment>,
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={handleCloseBatchEditDialog} color="inherit">취소</Button>
          <Button onClick={handleBatchUpdatePrices} variant="contained" color="primary" disabled={isBatchUpdating || !batchEditValue}>
            {isBatchUpdating ? <CircularProgress size={24} /> : '일괄 적용'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 이미지 확대 모달 (리스트용) */}
      <Dialog open={!!enlargedImage} onClose={() => setEnlargedImage(null)} maxWidth="md">
        <DialogContent sx={{ p: 1, position: 'relative', bgcolor: 'transparent', textAlign: 'center' }}>
          <IconButton 
            onClick={() => setEnlargedImage(null)} 
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            <CloseIcon />
          </IconButton>
          <img src={enlargedImage} alt="Enlarged" style={{ maxWidth: '100%', height: 'auto', display: 'block', maxHeight: '80vh', objectFit: 'contain', margin: '0 auto' }} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default PartsManagement; 