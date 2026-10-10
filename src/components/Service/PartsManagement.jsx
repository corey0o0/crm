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
  Avatar,
  Divider,
  Autocomplete
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
  LinkOff as LinkOffIcon,
  WarningAmber as WarningAmberIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { downloadExcel, readExcelFile } from '../../utils/excelUtils';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MASTER_ACCOUNTS } from '../../config/menuConfig';
import { sendTelegramNotification } from '../../lib/telegram';
import { getErrorMessage, isOffline, safeRetry } from '../../utils/networkUtils';
import { getSyncedParts, createSyncRelation, deleteSyncRelationById } from '../../utils/partSyncUtils';
import { sortProducts, SORT_OPTIONS } from '../Product/productSortUtils';
import Barcode from 'react-barcode';
import { uploadFileToR2 as uploadToR2 } from '../../utils/cloudflareR2Utils';
import ExcelJS from 'exceljs';
import { syncCafe24ProductImages } from '../../utils/cafe24Api';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { logAction } from '../../utils/auditLog';
import { ALL_MODEL_NAMES, toEnglishModelName, matchAllKnownAirframeModels } from '../../utils/airframeModelNormalize';

const BRANDS = ['XRB', 'NB', 'COMMON'];

// 기종 미선택 시 파츠명 끝부분(" - X200GT/X100GT" 또는 "X200GT")에서 기종 추출
function extractModelFromName(name) {
  if (!name) return null;
  const dashIdx = name.lastIndexOf(' - ');
  const candidate = dashIdx >= 0 ? name.slice(dashIdx + 3).trim() : name.trim().split(' ').pop();
  if (!candidate) return null;
  const segments = candidate.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const matched = matchAllKnownAirframeModels(candidate);
  if (matched.length !== segments.length) return null; // 전부 매칭돼야 안전
  return { tokens: matched, suffixText: candidate, hasDash: dashIdx >= 0 };
}

// 입력 폼 컴포넌트 분리
const PartsFormDialog = memo(({
  open,
  onClose,
  onSubmit,
  initialData,
  brands,
  getNextPartCode,
  getNextBarcode,
  existingParts = [],
  isMaster = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    brand: '',
    model: '',
    code: '',
    costPrice: '',
    supplyPrice: '',
    specialPrice: '',
    price: '',
    barcode: '',
    memo: '',
    note: '파츠',
    purchaseSource: '',
    image_url: '',
    track_inventory: true
  });

  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const [dupWarning, setDupWarning] = useState({ code: null, barcode: null, name: null });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [enlargedImage, setEnlargedImage] = useState(null);

  // 폼이 열려있는지 추적하여 불필요한 리셋 방지
  const isOpenRef = useRef(open);
  const prevInitialDataRef = useRef(initialData);
  // 기종 변경 시 이름/영문명에 자동 추가한 접미사 추적 (다음 변경 때 이전 접미사만 제거하기 위함)
  const modelSuffixRef = useRef({ kr: '', en: '' });

  useEffect(() => {
    // 닫혀있다가 열릴 때, 또는 initialData가 변경될 때만 초기화
    const justOpened = open && !isOpenRef.current;
    const dataChanged = initialData !== prevInitialDataRef.current;

    if (justOpened || (open && dataChanged)) {
      setImageFile(null);
      setDupWarning({ code: null, barcode: null, name: null });
      if (initialData) {
        // 기종 기존 유무와 무관하게 이름에서 접미사를 추출해둬야, 나중에 기종을 바꿀 때
        // 기존 접미사를 제대로 제거하고 새 접미사를 붙여서 중복 추가되는 걸 막을 수 있음
        const extracted = extractModelFromName(initialData.name || '');
        let autoModel = initialData.model || '';
        if (!autoModel && extracted) {
          autoModel = extracted.tokens.join('/');
        }
        const autoSuffixKr = extracted ? ((extracted.hasDash ? ' - ' : ' ') + extracted.suffixText) : '';
        const modelTokensNow = autoModel ? autoModel.split('/').filter(Boolean) : [];
        const expectedSuffixEn = modelTokensNow.length ? ` for ${modelTokensNow.map(toEnglishModelName).join('/')}` : '';
        const autoSuffixEn = (expectedSuffixEn && (initialData.name_en || '').endsWith(expectedSuffixEn)) ? expectedSuffixEn : '';
        modelSuffixRef.current = { kr: autoSuffixKr, en: autoSuffixEn };
        setFormData({
          name: initialData.name || '',
          name_en: initialData.name_en || '',
          brand: initialData.brand || '',
          model: autoModel,
          code: initialData.code || '',
          costPrice: initialData.cost_price?.toString() || '',
          supplyPrice: initialData.supply_price?.toString() || '',
          specialPrice: initialData.special_price?.toString() || '',
          price: initialData.price?.toString() || '',
          barcode: initialData.barcode || '',
          memo: initialData.memo || '',
          note: initialData.note || '파츠',
          purchaseSource: initialData.purchase_source || '',
          image_url: initialData.image_url || '',
          track_inventory: initialData.track_inventory !== false
        });
        setImagePreview(initialData.image_url || '');
      } else {
        modelSuffixRef.current = { kr: '', en: '' };
        const defaultBrand = brands[0] || '';
        const defaultCategory = '파츠';
        // 신규 등록일 때만 코드 추천
        const suggestedCode = typeof getNextPartCode === 'function' ? getNextPartCode(defaultBrand, defaultCategory) : '';
        setFormData({
          name: '',
          name_en: '',
          brand: defaultBrand,
          model: '',
          code: suggestedCode,
          costPrice: '',
          supplyPrice: '',
          specialPrice: '',
          price: '',
          barcode: '',
          memo: '',
          note: defaultCategory,
          purchaseSource: '',
          image_url: '',
          track_inventory: defaultCategory !== '공임'
        });
        setImagePreview('');
      }
    }
    isOpenRef.current = open;
    prevInitialDataRef.current = initialData;
  }, [open, initialData, brands, getNextPartCode]);

  const checkDuplicate = useCallback((field, val) => {
    if (!val) { setDupWarning(prev => ({ ...prev, [field]: null })); return; }
    const match = existingParts.find(p => {
      if (initialData?.id && p.id === initialData.id) return false;
      if (field === 'code') return (p.code || '').toLowerCase() === val.toLowerCase();
      if (field === 'barcode') return p.barcode && p.barcode === val;
      if (field === 'name') return (p.name || '').toLowerCase() === val.toLowerCase();
      return false;
    });
    setDupWarning(prev => ({ ...prev, [field]: match ? `중복: ${match.code} - ${match.name}` : null }));
  }, [existingParts, initialData]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const cleanedValue = ['price', 'supplyPrice', 'costPrice', 'specialPrice', 'barcode'].includes(name) ? value.replace(/[^0-9]/g, '') : value;
    setFormData(prev => {
      const next = { ...prev, [name]: cleanedValue };
      const shouldSuggest = (!prev.code || prev.code.trim() === '');
      if ((name === 'brand' || name === 'note') && typeof getNextPartCode === 'function') {
        if (shouldSuggest) {
          const brandForCode = name === 'brand' ? value : prev.brand;
          const categoryForCode = name === 'note' ? value : prev.note;
          next.code = getNextPartCode(brandForCode, categoryForCode);
        }
      }
      if (name === 'note' && value === '공임') {
        next.track_inventory = false;
      } else if (name === 'note' && prev.note === '공임' && value !== '공임') {
        next.track_inventory = true;
      }
      return next;
    });
    if (['code', 'barcode', 'name'].includes(name)) {
      checkDuplicate(name, cleanedValue);
    }
  }, [getNextPartCode, checkDuplicate]);

  // 기종 선택을 다시 안 해도, 영문명 직접 입력 후 포커스 벗어나면 기종 접미사 자동 추가
  const handleNameEnBlur = useCallback(() => {
    setFormData(prev => {
      const tokens = prev.model ? prev.model.split('/').filter(Boolean) : [];
      if (!tokens.length || !prev.name_en) return prev;
      const suffixEn = ` for ${tokens.map(toEnglishModelName).join('/')}`;
      if (prev.name_en.endsWith(suffixEn)) return prev;
      modelSuffixRef.current = { ...modelSuffixRef.current, en: suffixEn };
      return { ...prev, name_en: prev.name_en + suffixEn };
    });
  }, []);

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

  const handleSupplyPercentChange = useCallback((e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setFormData(prev => {
      const priceNum = Number(prev.price || 0);
      if (raw === '') return { ...prev, supplyPrice: '' };
      if (!priceNum) return prev;
      return { ...prev, supplyPrice: Math.round(priceNum * Number(raw) / 100).toString() };
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

  const supplyPricePercent = (() => {
    const priceNum = Number(formData.price || 0);
    const supplyNum = Number(formData.supplyPrice || 0);
    return priceNum > 0 && supplyNum > 0 ? Math.round((supplyNum / priceNum) * 100).toString() : '';
  })();

  const handleSubmit = useCallback(() => {
    if (dupWarning.code || dupWarning.barcode || dupWarning.name) return;
    onSubmit(formData, imageFile);
  }, [formData, imageFile, onSubmit, dupWarning]);

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
              {['파츠 전체', '파츠 - 일반 부품', '파츠 - 전기 부품', '기체', '악세서리', '공임', '기타'].map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              freeSolo
              fullWidth
              options={ALL_MODEL_NAMES}
              getOptionLabel={(m) => toEnglishModelName(m)}
              value={formData.model ? formData.model.split('/').filter(Boolean) : []}
              onChange={(e, newValue) => {
                const expanded = newValue.flatMap((v) => String(v).split(/[/,]/).map((s) => s.trim()).filter(Boolean));
                const tokens = Array.from(new Set(expanded));
                const newSuffixKr = tokens.length ? ` - ${tokens.join('/')}` : '';
                const newSuffixEn = tokens.length ? ` for ${tokens.map(toEnglishModelName).join('/')}` : '';
                setFormData(prev => {
                  const stripSuffix = (text, suffix) => (suffix && text.endsWith(suffix)) ? text.slice(0, -suffix.length) : text;
                  const baseName = stripSuffix(prev.name || '', modelSuffixRef.current.kr);
                  const baseNameEn = stripSuffix(prev.name_en || '', modelSuffixRef.current.en);
                  return { ...prev, model: tokens.join('/'), name: baseName + newSuffixKr, name_en: baseNameEn + newSuffixEn };
                });
                modelSuffixRef.current = { kr: newSuffixKr, en: newSuffixEn };
              }}
              renderInput={(params) => <TextField {...params} label="기종" placeholder="선택 또는 직접 입력" />}
            />
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
                error={!!dupWarning.code}
                helperText={dupWarning.code || ''}
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
                error={!!dupWarning.barcode}
                helperText={dupWarning.barcode || ''}
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
              error={!!dupWarning.name}
              helperText={dupWarning.name || ''}
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
              onBlur={handleNameEnBlur}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="매입처"
              name="purchaseSource"
              value={formData.purchaseSource}
              onChange={handleChange}
              placeholder="어디서 매입하는 상품인지 입력"
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
          {isMaster && (
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
          )}
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
            {supplyPricePercent && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                ({100 - Number(supplyPricePercent)}%)
              </Typography>
            )}
            {renderVatButtons('supplyPrice')}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="공급가율로 입력"
              value={supplyPricePercent}
              onChange={handleSupplyPercentChange}
              placeholder="예: 70"
              helperText="판매가 기준 % 입력 시 공급가 자동 계산"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            />
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
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.track_inventory}
                  onChange={(e) => setFormData(prev => ({ ...prev, track_inventory: e.target.checked }))}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">재고 관리 여부</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formData.track_inventory 
                      ? '이 상품의 재고를 추적합니다 (입출고 시 재고 증감)' 
                      : '이 상품은 재고를 추적하지 않습니다 (공임/서비스 등)'}
                  </Typography>
                </Box>
              }
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
  const { hasActionPermission, user } = useAuth();
  const canEditBasic = hasActionPermission('can_edit_basic');
  const isMaster = user?.email && MASTER_ACCOUNTS.includes(user.email);

  const [parts, setParts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [selectedPurchaseSource, setSelectedPurchaseSource] = useState('전체');
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
  const [imageUploadStatus, setImageUploadStatus] = useState({
    open: false,
    current: 0,
    total: 0,
    message: ''
  });

  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('code');
  const [sortOption, setSortOption] = useState('newest'); // 'legacy'면 컬럼헤더 클릭 정렬 사용
  const [showSupplyPrice, setShowSupplyPrice] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedModel, setSelectedModel] = useState([]);

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

  // 숨김 상품 표시 토글
  const [showHiddenParts, setShowHiddenParts] = useState(false);

  // 엑셀 업로드 중복 처리 상태
  const [duplicateDialog, setDuplicateDialog] = useState({
    open: false,
    duplicates: [],       // { newData, existingData, selected: true }
    newOnly: [],          // 중복 아닌 신규 데이터
    selectAll: true,
    fileInputEvent: null
  });

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
    setSortOption('legacy');
  };

  const handleSortOptionChange = (e) => {
    setSortOption(e.target.value);
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
        image_url: finalImageUrl,
        track_inventory: formData.track_inventory !== false
      };

      partData.barcode = formData.barcode || null;
      partData.memo = formData.memo || null;
      partData.note = formData.note || null;
      partData.purchase_source = formData.purchaseSource || null;
      partData.model = formData.model || null;

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

        // 감사 로그: 상품 수정
        try {
          await logAction({
            action: '수정',
            targetTable: 'parts',
            targetId: selectedPart.id,
            summary: `[상품 수정] ${partData.code} - ${partData.name} (브랜드: ${partData.brand})`,
            details: { before: selectedPart, after: partData }
          });
        } catch (logErr) {
          console.warn('[AuditLog] 상품 수정 로그 실패:', logErr);
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

          // 감사 로그: 상품 등록
          try {
            await logAction({
              action: '등록',
              targetTable: 'parts',
              targetId: newPart.id,
              summary: `[상품 등록] ${newPart.code} - ${newPart.name} (브랜드: ${newPart.brand})`,
              details: newPart
            });
          } catch (logErr) {
            console.warn('[AuditLog] 상품 등록 로그 실패:', logErr);
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
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      // 삭제 전 참조 여부 확인
      const refs = [];

      const { count: serviceCount } = await supabase
        .from('service_parts')
        .select('*', { count: 'exact', head: true })
        .eq('part_id', id);
      if (serviceCount > 0) refs.push(`A/S 이력 ${serviceCount}건`);

      const { count: shipmentCount } = await supabase
        .from('shipment_parts')
        .select('*', { count: 'exact', head: true })
        .eq('part_id', id);
      if (shipmentCount > 0) refs.push(`출고 이력 ${shipmentCount}건`);

      const { count: txCount } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('part_id', id);
      if (txCount > 0) refs.push(`재고 입출고 이력 ${txCount}건`);

      if (refs.length > 0) {
        showSnackbar(
          `이 부품은 삭제할 수 없습니다. 사용 중인 이력이 있습니다: ${refs.join(', ')}`,
          'warning'
        );
        return;
      }

      const { error } = await supabase
        .from('parts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchParts();
      showSnackbar('부품이 삭제되었습니다.', 'success');

      // 감사 로그: 상품 삭제
      try {
        const deletedPart = parts.find(p => p.id === id);
        await logAction({
          action: '삭제',
          targetTable: 'parts',
          targetId: id,
          summary: `[상품 삭제] ${deletedPart?.code || ''} - ${deletedPart?.name || ''} (브랜드: ${deletedPart?.brand || ''})`,
          details: deletedPart
        });
      } catch (logErr) {
        console.warn('[AuditLog] 상품 삭제 로그 실패:', logErr);
      }
    } catch (err) {
      console.error('Error deleting part:', err);
      if (err?.code === '23503') {
        showSnackbar('이 부품은 다른 곳에서 사용 중이므로 삭제할 수 없습니다.', 'warning');
      } else {
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
        // 비마스터는 원가(cost_price)를 import하지 않음 (기존 값 보존)
        ...(isMaster ? { cost_price: Number(String(cost_price).replace(/[^0-9]/g, '') || 0) } : {}),
        supply_price: Number(String(supply_price).replace(/[^0-9]/g, '') || 0),
        special_price: Number(String(special_price).replace(/[^0-9]/g, '') || 0),
        price: Number(String(price).replace(/[^0-9]/g, '') || 0),
        barcode: barcode ? String(barcode).replace(/[^0-9]/g, '') : null,
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

        // DB에서 기존 코드 조회 (전체 정보 포함)
        const { data: existingParts, error: checkError } = await supabase
          .from('parts')
          .select('*')
          .in('code', withCodes.map(d => d.code));

        if (checkError) throw checkError;

        const dbExistingMap = {};
        (existingParts || []).forEach(p => { dbExistingMap[p.code] = p; });
        const dbExisting = new Set(Object.keys(dbExistingMap));

        // 자동 생성된 코드가 DB에 있으면 충돌 해소를 위해 증가
        const finalAssigned = new Set(withCodes.map(r => r.code));
        const resolvedCodes = withCodes.map((row) => {
          if (row.__auto && dbExisting.has(row.code)) {
            let code = row.code;
            while (dbExisting.has(code) || finalAssigned.has(code)) {
              code = bumpCode(code);
            }
            finalAssigned.add(code);
            return { ...row, code };
          }
          return row;
        }).map(({ __auto, ...rest }) => rest);

        // 사용자가 직접 입력한 코드 중 DB에 이미 있는 것 분리
        const duplicates = [];
        const newOnly = [];
        resolvedCodes.forEach(row => {
          if (dbExisting.has(row.code)) {
            duplicates.push({
              newData: row,
              existingData: dbExistingMap[row.code],
              selected: true  // 기본적으로 덮어쓰기 선택
            });
          } else {
            newOnly.push(row);
          }
        });

        closeUploadStatus();

        // 중복이 있으면 다이얼로그 표시
        if (duplicates.length > 0) {
          setDuplicateDialog({
            open: true,
            duplicates,
            newOnly,
            selectAll: true,
            fileInputEvent: event
          });
          return;
        }

        // 중복 없으면 바로 저장
        await executeExcelInsert(newOnly, [], event);

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

  // 엑셀 셀에 삽입된 이미지를 추출해 바코드 기준으로 매칭 후 일괄 업로드
  const handleImageExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExt)) {
      showSnackbar('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.', 'error');
      event.target.value = '';
      return;
    }

    setImageUploadStatus({ open: true, current: 0, total: 0, message: '엑셀 파일 읽는 중...' });

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) throw new Error('워크시트를 찾을 수 없습니다.');

      // 1~5행을 스캔해 "바코드" 헤더가 있는 컬럼/행 탐색
      let barcodeCol = null;
      let headerRowNumber = 1;
      for (let r = 1; r <= Math.min(5, worksheet.rowCount); r++) {
        let found = null;
        worksheet.getRow(r).eachCell((cell, colNumber) => {
          if (!found && cell.value && String(cell.value).includes('바코드')) found = colNumber;
        });
        if (found) {
          barcodeCol = found;
          headerRowNumber = r;
          break;
        }
      }
      if (!barcodeCol) {
        throw new Error('엑셀에서 "바코드" 헤더를 찾을 수 없습니다.');
      }

      const images = worksheet.getImages();
      if (images.length === 0) {
        throw new Error('엑셀 파일에서 이미지를 찾을 수 없습니다.');
      }

      const notFound = [];
      const failed = [];
      let successCount = 0;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        setImageUploadStatus(prev => ({ ...prev, total: images.length, current: i + 1, message: `이미지 ${i + 1}/${images.length} 처리 중...` }));

        const rowNumber = img.range.tl.nativeRow + 1;
        if (rowNumber <= headerRowNumber) continue;

        const barcodeCellValue = worksheet.getRow(rowNumber).getCell(barcodeCol).value;
        const barcode = barcodeCellValue ? String(barcodeCellValue).replace(/[^0-9]/g, '') : '';
        if (!barcode) continue;

        const matchedPart = parts.find((p) => (p.barcode || '').replace(/[^0-9]/g, '') === barcode);
        if (!matchedPart) {
          notFound.push(barcode);
          continue;
        }

        try {
          const media = workbook.getImage(img.imageId);
          const mimeExt = media.extension === 'jpg' ? 'jpeg' : media.extension;
          const blob = new Blob([media.buffer], { type: `image/${mimeExt}` });
          const imageFile = new File([blob], `barcode_${barcode}.${media.extension}`, { type: `image/${mimeExt}` });

          const uploadResult = await uploadToR2(imageFile, 'parts');
          const { error: updateError } = await supabase
            .from('parts')
            .update({ image_url: uploadResult.url })
            .eq('id', matchedPart.id);
          if (updateError) throw updateError;

          successCount++;
        } catch (err) {
          failed.push(barcode);
        }
      }

      setImageUploadStatus({ open: false, current: 0, total: 0, message: '' });
      await fetchParts();

      const summary = [
        `성공 ${successCount}개`,
        notFound.length > 0 ? `매칭 안됨 ${notFound.length}개 (${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? ' 등' : ''})` : null,
        failed.length > 0 ? `업로드 실패 ${failed.length}개` : null
      ].filter(Boolean).join(' / ');
      showSnackbar(`이미지 일괄 업로드 완료: ${summary}`, notFound.length > 0 || failed.length > 0 ? 'warning' : 'success');
    } catch (error) {
      console.error('이미지 엑셀 업로드 중 오류:', error);
      showSnackbar('이미지 업로드 중 오류가 발생했습니다: ' + error.message, 'error');
      setImageUploadStatus({ open: false, current: 0, total: 0, message: '' });
    } finally {
      event.target.value = '';
    }
  };

  // 카페24 연동 상품 이미지를 바코드 매칭으로 파츠에 일괄 반영 (서버에서 다운로드+R2 업로드까지 처리)
  const handleCafe24ImageSync = async () => {
    setImageUploadStatus({ open: true, current: 0, total: 0, message: '카페24 상품 이미지 동기화 중... (시간이 걸릴 수 있습니다)' });
    try {
      const result = await syncCafe24ProductImages();
      console.log('카페24 이미지 동기화 결과:', result);
      setImageUploadStatus({ open: false, current: 0, total: 0, message: '' });
      await fetchParts();

      const summary = [
        `성공 ${result.updated}개`,
        result.notFoundCount > 0 ? `매칭 안됨 ${result.notFoundCount}개` : null,
        result.failedCount > 0 ? `업로드 실패 ${result.failedCount}개` : null
      ].filter(Boolean).join(' / ');
      showSnackbar(`카페24 이미지 동기화 완료: ${summary}`, result.notFoundCount > 0 || result.failedCount > 0 ? 'warning' : 'success');
    } catch (error) {
      console.error('카페24 이미지 동기화 중 오류:', error);
      showSnackbar('카페24 이미지 동기화 중 오류가 발생했습니다: ' + error.message, 'error');
      setImageUploadStatus({ open: false, current: 0, total: 0, message: '' });
    }
  };

  // 엑셀 업로드 실제 저장 처리 (신규 + 선택된 중복 업데이트)
  const executeExcelInsert = async (newItems, overwriteItems, fileEvent) => {
    try {
      setUploadStatus({
        open: true,
        step: 4,
        total: 100,
        current: 60,
        message: '데이터 저장 중...'
      });

      let savedCount = 0;

      // 1. 신규 데이터 INSERT
      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from('parts')
          .insert(newItems);
        if (insertError) throw insertError;
        savedCount += newItems.length;
      }

      setUploadStatus(prev => ({ ...prev, current: 80, message: '중복 데이터 업데이트 중...' }));

      // 2. 덮어쓰기 선택된 중복 데이터 UPDATE
      let updatedCount = 0;
      for (const item of overwriteItems) {
        const { code, ...updateData } = item;
        const { error: updateError } = await supabase
          .from('parts')
          .update(updateData)
          .eq('code', code);
        if (updateError) {
          console.error(`코드 ${code} 업데이트 실패:`, updateError);
        } else {
          updatedCount++;
        }
      }

      setUploadStatus(prev => ({ ...prev, step: 5, current: 100, message: '저장 완료!' }));

      // 텔레그램 알림 전송
      const allSaved = [...newItems, ...overwriteItems];
      for (const newPart of allSaved) {
        try {
          await sendTelegramNotification({
            message: `부품 ${overwriteItems.includes(newPart) ? '수정' : '등록'} (코드: ${newPart.code}) - 품명: ${newPart.name}`,
            link: `/parts`
          }, { eventType: overwriteItems.includes(newPart) ? 'part_edit' : 'part_add' });
        } catch (telegramError) {
          console.error('텔레그램 알림 전송 중 오류:', telegramError);
        }
      }

      await fetchParts();

      setTimeout(() => {
        closeUploadStatus();
        const msgs = [];
        if (savedCount > 0) msgs.push(`${savedCount}개 신규 등록`);
        if (updatedCount > 0) msgs.push(`${updatedCount}개 업데이트`);
        const skippedCount = overwriteItems.length - updatedCount;
        showSnackbar(`파츠 업로드 완료: ${msgs.join(', ')}`, 'success');
      }, 1000);

      if (fileEvent?.target) fileEvent.target.value = '';

    } catch (error) {
      closeUploadStatus();
      console.error('엑셀 저장 중 오류:', error);
      showSnackbar('엑셀 파일 저장 중 오류가 발생했습니다: ' + error.message, 'error');
      if (fileEvent?.target) fileEvent.target.value = '';
    }
  };

  // 중복 다이얼로그 확인 처리
  const handleDuplicateConfirm = async () => {
    const { duplicates, newOnly, fileInputEvent } = duplicateDialog;
    const overwriteItems = duplicates
      .filter(d => d.selected)
      .map(d => d.newData);
    
    setDuplicateDialog(prev => ({ ...prev, open: false }));
    await executeExcelInsert(newOnly, overwriteItems, fileInputEvent);
  };

  // 중복 다이얼로그 취소
  const handleDuplicateCancel = () => {
    if (duplicateDialog.fileInputEvent?.target) {
      duplicateDialog.fileInputEvent.target.value = '';
    }
    setDuplicateDialog({
      open: false,
      duplicates: [],
      newOnly: [],
      selectAll: true,
      fileInputEvent: null
    });
    showSnackbar('업로드가 취소되었습니다.', 'info');
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        '브랜드': 'XRB',
        '코드': 'XL-001',
        '제품명': '컴프레서',
        '영문명': 'Compressor',
        ...(isMaster ? { '원가': 80000 } : {}),
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
        ...(isMaster ? { '원가': 0 } : {}),
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
      ...(isMaster ? [{ label: '원가', key: '원가' }] : []),
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
      ...(isMaster ? { '원가': Number(part.cost_price) || 0 } : {}),
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
      ...(isMaster ? [{ label: '원가', key: '원가' }] : []),
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

  // 숨김 상품 토글 핸들러
  const handleToggleHiddenPart = async (part) => {
    const isCurrentlyHidden = (part.memo || '').includes('[HIDDEN]');
    const newMemo = isCurrentlyHidden
      ? (part.memo || '').replace('[HIDDEN]', '').trim()
      : `[HIDDEN] ${(part.memo || '').trim()}`.trim();
    try {
      const { error } = await supabase.from('parts').update({ memo: newMemo }).eq('id', part.id);
      if (error) throw error;
      setParts(prev => prev.map(p => p.id === part.id ? { ...p, memo: newMemo } : p));
      showSnackbar(isCurrentlyHidden ? `${part.name} 상품이 표시됩니다.` : `${part.name} 상품이 숨김 처리되었습니다.`, 'success');
    } catch (err) {
      console.error('숨김 처리 실패:', err);
      showSnackbar('숨김 처리에 실패했습니다.', 'error');
    }
  };

  // 일괄 숨김 처리 핸들러
  const handleBatchToggleHidden = async (hide = true) => {
    if (selectedItems.length === 0) {
      showSnackbar('숨김 처리할 항목을 선택해주세요.', 'warning');
      return;
    }
    const action = hide ? '숨김' : '표시';
    if (!window.confirm(`선택한 ${selectedItems.length}개 항목을 ${action} 처리하시겠습니까?`)) return;
    try {
      for (const id of selectedItems) {
        const part = parts.find(p => p.id === id);
        if (!part) continue;
        const isHidden = (part.memo || '').includes('[HIDDEN]');
        if (hide && isHidden) continue; // 이미 숨김
        if (!hide && !isHidden) continue; // 이미 표시
        const newMemo = hide
          ? `[HIDDEN] ${(part.memo || '').trim()}`.trim()
          : (part.memo || '').replace('[HIDDEN]', '').trim();
        await supabase.from('parts').update({ memo: newMemo }).eq('id', id);
      }
      await fetchParts();
      setSelectedItems([]);
      showSnackbar(`${selectedItems.length}개 항목이 ${action} 처리되었습니다.`, 'success');
    } catch (err) {
      console.error('일괄 숨김 처리 실패:', err);
      showSnackbar('일괄 숨김 처리에 실패했습니다.', 'error');
    }
  };

  const hiddenPartsCount = useMemo(() => parts.filter(p => (p.memo || '').includes('[HIDDEN]')).length, [parts]);

  const filteredParts = useMemo(() => {
    const searchTermLower = searchTerm.toLowerCase();
    return parts.filter(part => {
      // 숨김 필터링
      const isHidden = (part.memo || '').includes('[HIDDEN]');
      if (isHidden && !showHiddenParts) return false;

      // 브랜드로 필터링
      const brandMatch = selectedBrand === '전체' || part.brand === selectedBrand;
      if (!brandMatch) return false;
      // 구분(카테고리)로 필터링
      const categoryMatch = selectedCategory === '전체' || (part.note || '') === selectedCategory;
      if (!categoryMatch) return false;
      // 매입처로 필터링
      const purchaseSourceMatch = selectedPurchaseSource === '전체' || (part.purchase_source || '') === selectedPurchaseSource;
      if (!purchaseSourceMatch) return false;
      // 기종으로 필터링
      const modelMatch = selectedModel.length === 0 || (part.model || '').split('/').filter(Boolean).some(m => selectedModel.includes(m));
      if (!modelMatch) return false;

      // 검색어가 없으면 필터링만 적용
      if (!searchTerm) return true;

      // 검색어 필터링 — 공백으로 쪼갠 단어가 모두 포함되면 매치(순서 무관, 대소문자 구분 없이)
      const haystack = `${part.name || ''} ${part.name_en || ''} ${part.code || ''} ${part.barcode || ''} ${part.note || ''} ${part.memo || ''} ${part.purchase_source || ''}`.toLowerCase();
      const tokens = searchTermLower.trim().split(/\s+/).filter(Boolean);
      return tokens.every(tok => haystack.includes(tok));
    });
  }, [parts, searchTerm, selectedBrand, selectedCategory, selectedPurchaseSource, selectedModel, showHiddenParts]);

  // 정렬된 파츠 목록
  const sortedParts = useMemo(() => {
    if (sortOption !== 'legacy') {
      return sortProducts(filteredParts, sortOption);
    }
    return sortData([...filteredParts], order, orderBy);
  }, [filteredParts, order, orderBy, sortOption]);

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
        name_en: part.name_en || null,
        brand: copyTargetBrand,
        code: part.code,
        cost_price: part.cost_price || 0,
        supply_price: part.supply_price,
        special_price: part.special_price || 0,
        price: part.price,
        barcode: part.barcode || null,
        image_url: part.image_url || null,
        memo: part.memo || null,
        note: part.note || null,
        model: part.model || null,
        purchase_source: part.purchase_source || null,
        agency_price: part.agency_price || 0,
        track_inventory: part.track_inventory !== false,
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
              name_en: newPart.name_en,
              cost_price: newPart.cost_price,
              supply_price: newPart.supply_price,
              special_price: newPart.special_price,
              price: newPart.price,
              barcode: newPart.barcode,
              image_url: newPart.image_url,
              memo: newPart.memo,
              note: newPart.note,
              model: newPart.model,
              purchase_source: newPart.purchase_source,
              agency_price: newPart.agency_price,
              track_inventory: newPart.track_inventory
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
    if (batchEditTarget === 'purchase_source') {
      try {
        setIsBatchUpdating(true);
        const selectedPartsData = parts.filter(part => selectedItems.includes(part.id));
        const updatePromises = selectedPartsData.map(part =>
          supabase
            .from('parts')
            .update({ purchase_source: batchEditValue.trim() || null })
            .eq('id', part.id)
        );

        await Promise.all(updatePromises);
        showSnackbar(`${selectedItems.length}개 항목의 매입처가 일괄 수정되었습니다.`, 'success');
        handleCloseBatchEditDialog();
        setSelectedItems([]);
        fetchParts();
      } catch (error) {
        console.error('일괄 매입처 수정 오류:', error);
        showSnackbar('매입처 수정 중 오류가 발생했습니다.', 'error');
      } finally {
        setIsBatchUpdating(false);
      }
      return;
    }

    if (batchEditTarget === 'note') {
      try {
        setIsBatchUpdating(true);
        const selectedPartsData = parts.filter(part => selectedItems.includes(part.id));
        const updatePromises = selectedPartsData.map(part =>
          supabase
            .from('parts')
            .update({ note: batchEditValue })
            .eq('id', part.id)
        );

        await Promise.all(updatePromises);
        showSnackbar(`${selectedItems.length}개 항목의 구분이 일괄 수정되었습니다.`, 'success');
        handleCloseBatchEditDialog();
        setSelectedItems([]);
        fetchParts();
      } catch (error) {
        console.error('일괄 구분 수정 오류:', error);
        showSnackbar('구분 수정 중 오류가 발생했습니다.', 'error');
      } finally {
        setIsBatchUpdating(false);
      }
      return;
    }

    if (batchEditTarget === 'model') {
      try {
        setIsBatchUpdating(true);
        const selectedPartsData = parts.filter(part => selectedItems.includes(part.id));
        const updatePromises = selectedPartsData.map(part =>
          supabase
            .from('parts')
            .update({ model: batchEditValue.trim() || null })
            .eq('id', part.id)
        );

        await Promise.all(updatePromises);
        showSnackbar(`${selectedItems.length}개 항목의 기종이 일괄 수정되었습니다.`, 'success');
        handleCloseBatchEditDialog();
        setSelectedItems([]);
        fetchParts();
      } catch (error) {
        console.error('일괄 기종 수정 오류:', error);
        showSnackbar('기종 수정 중 오류가 발생했습니다.', 'error');
      } finally {
        setIsBatchUpdating(false);
      }
      return;
    }

    if (!batchEditValue || isNaN(Number(batchEditValue))) {
      showSnackbar('유효한 숫자를 입력해주세요.', 'warning');
      return;
    }

    const value = Number(batchEditValue);
    if (batchEditMode === 'percent' && (value < 0 || value > 200)) {
       showSnackbar('유효한 퍼센트 범위를 입력해주세요 (0~200).', 'warning');
       return;
    }

    // 비마스터는 원가(cost_price) 일괄 수정 불가
    if (batchEditTarget === 'cost_price' && !isMaster) {
      showSnackbar('원가 수정 권한이 없습니다.', 'warning');
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
    <Box sx={{ p: 3, width: '100%', boxSizing: 'border-box' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddIcon />
        상품 관리
      </Typography>
      <Box sx={{ mt: 3, mb: 3 }}>
        {/* 상단 액션 버튼 영역 */}
        {canEditBasic && (
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
                일괄 수정
              </Button>
            </Grid>

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<VisibilityOffIcon />}
                onClick={() => handleBatchToggleHidden(true)}
                disabled={selectedItems.length === 0}
                size="small"
              >
                선택 숨김
              </Button>
            </Grid>
            {showHiddenParts && (
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<VisibilityIcon />}
                onClick={() => handleBatchToggleHidden(false)}
                disabled={selectedItems.length === 0}
                color="success"
                size="small"
              >
                선택 표시
              </Button>
            </Grid>
            )}
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
          </Grid>
        </Paper>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            {canEditBasic && (
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
            )}

            {canEditBasic && (
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => document.getElementById('image-excel-upload').click()}
              >
                이미지 일괄 업로드
              </Button>
              <input
                id="image-excel-upload"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImageExcelUpload}
                style={{ display: 'none' }}
              />
            </Grid>
            )}

            {canEditBasic && (
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={handleCafe24ImageSync}
              >
                카페24 이미지 동기화
              </Button>
            </Grid>
            )}

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
              >
                엑셀 다운로드
              </Button>
            </Grid>

            {canEditBasic && (
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
              >
                템플릿 다운로드
              </Button>
            </Grid>
            )}
          </Grid>
        </Paper>

        {/* 검색 및 필터 영역 */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={2}>
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
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="매입처"
                value={selectedPurchaseSource}
                onChange={(e) => setSelectedPurchaseSource(e.target.value)}
              >
                <MenuItem value="전체">전체 매입처</MenuItem>
                {Array.from(new Set(parts.map(p => p.purchase_source).filter(Boolean))).map(source => (
                  <MenuItem key={source} value={source}>{source}</MenuItem>
                ))}
                <MenuItem value="">(매입처 없음)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>기종</InputLabel>
                <Select
                  multiple
                  label="기종"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  renderValue={(selected) => selected.length === 0 ? '전체 기종' : selected.map(toEnglishModelName).join(', ')}
                >
                  {Array.from(new Set(parts.flatMap(p => (p.model || '').split('/').filter(Boolean)))).sort((a, b) => a.localeCompare(b, 'ko')).map(m => (
                    <MenuItem key={m} value={m}>
                      <Checkbox size="small" checked={selectedModel.includes(m)} />
                      {toEnglishModelName(m)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={12} md={4}>
              <SearchInput
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                onSearch={executeSearch}
                onClear={handleClearSearch}
                isSearching={isSearching}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="구분"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {['전체', '파츠 전체', '파츠 - 일반 부품', '파츠 - 전기 부품', '기체', '악세서리', '공임', '기타'].map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="정렬"
                value={sortOption === 'legacy' ? 'default' : sortOption}
                onChange={handleSortOptionChange}
              >
                {SORT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {isMaster && (
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
            )}
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showHiddenParts}
                    onChange={(e) => setShowHiddenParts(e.target.checked)}
                    color="warning"
                  />
                }
                label={`숨김 상품 표시${hiddenPartsCount > 0 ? ` (${hiddenPartsCount})` : ''}`}
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
          <Tab
            value="전체"
            label="전체"
            sx={{
              '&.Mui-selected': {
                fontWeight: 'bold'
              }
            }}
          />
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
              {renderSortableHeader('model', '기종')}
              {renderSortableHeader('memo', '적요')}
              {renderSortableHeader('purchase_source', '매입처')}
              <TableCell sx={{ display: 'none' }} />
              {/* <TableCell>연동</TableCell> */}
              <TableCell align="right">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedParts.map((part) => (
              <TableRow key={part.id} sx={(part.memo || '').includes('[HIDDEN]') ? { opacity: 0.5, bgcolor: '#f5f5f5' } : {}}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedItems.includes(part.id)}
                    onChange={() => handleSelectItem(part.id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar src={part.image_url} alt={part.name} variant="rounded" sx={{ width: 52, height: 52, bgcolor: 'transparent', border: '1px solid #ddd', cursor: part.image_url ? 'pointer' : 'default', '& .MuiAvatar-img': { objectFit: 'contain' } }} onClick={() => part.image_url && setEnlargedImage(part.image_url)}>
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
                      fontStyle: part.barcode ? 'normal' : 'italic',
                      fontWeight: part.barcode ? 'bold' : 'normal'
                    }}
                  >
                    {part.barcode || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box component="span" sx={{ fontWeight: 'bold' }}>{part.name}</Box>
                  {part.track_inventory === false && (
                    <Chip size="small" label="재고미관리" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                  )}
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
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {part.supply_price?.toLocaleString() || '-'}
                  {!!part.supply_price && !!part.price && (
                    <Typography component="div" variant="caption" color="text.secondary" sx={{ fontWeight: 'normal' }}>
                      ({100 - Math.round((part.supply_price / part.price) * 100)}%)
                    </Typography>
                  )}
                </TableCell>
                {showSupplyPrice && <TableCell align="right">{part.special_price?.toLocaleString() || '-'}</TableCell>}
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{part.price?.toLocaleString() || '-'}</TableCell>
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
                  <Typography sx={{ fontSize: '0.875rem', color: part.model ? 'text.primary' : 'text.secondary', fontStyle: part.model ? 'normal' : 'italic' }}>
                    {part.model ? part.model.split('/').filter(Boolean).map(toEnglishModelName).join('/') : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: '0.875rem', color: part.memo ? 'text.primary' : 'text.secondary', fontStyle: part.memo ? 'normal' : 'italic' }}>
                    {part.memo || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: '0.875rem', color: part.purchase_source ? 'text.primary' : 'text.secondary', fontStyle: part.purchase_source ? 'normal' : 'italic' }}>
                    {part.purchase_source || '-'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: 'none' }} />
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
                  {canEditBasic && (
                  <>
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
                  <Tooltip title={(part.memo || '').includes('[HIDDEN]') ? '상품 표시' : '상품 숨김'}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleHiddenPart(part)}
                      color={(part.memo || '').includes('[HIDDEN]') ? 'success' : 'default'}
                    >
                      {(part.memo || '').includes('[HIDDEN]') ? <VisibilityIcon /> : <VisibilityOffIcon />}
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(part.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                  </>
                  )}
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
        existingParts={parts}
        isMaster={isMaster}
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

      <Dialog
        open={imageUploadStatus.open}
        maxWidth="sm"
        fullWidth
        transitionDuration={0}
        PaperProps={{ sx: { p: 2 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          이미지 일괄 업로드 중...
        </DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mt: 1 }}>
            <LinearProgress
              variant={imageUploadStatus.total > 0 ? 'determinate' : 'indeterminate'}
              value={imageUploadStatus.total > 0 ? (imageUploadStatus.current / imageUploadStatus.total) * 100 : 0}
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography sx={{ mt: 2, mb: 1 }} variant="body1">
              {imageUploadStatus.message}
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
        <DialogTitle sx={{ fontWeight: 'bold' }}>선택 항목 일괄 수정 ({selectedItems.length}개)</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {batchEditTarget === 'purchase_source'
              ? `선택한 ${selectedItems.length}개 항목의 매입처를 일괄 적용합니다.`
              : batchEditTarget === 'note'
              ? `선택한 ${selectedItems.length}개 항목의 구분을 일괄 적용합니다.`
              : batchEditTarget === 'model'
              ? `선택한 ${selectedItems.length}개 항목의 기종을 일괄 적용합니다.`
              : <>선택한 {selectedItems.length}개 항목의 대상을 지정한 후, 해당 항목의 <strong>판매가</strong>를 기준으로 일괄 계산하여 적용합니다.</>}
          </Typography>

          <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>적용 대상 선택</Typography>
            <RadioGroup row value={batchEditTarget} onChange={(e) => setBatchEditTarget(e.target.value)}>
              {isMaster && <FormControlLabel value="cost_price" control={<Radio />} label="매입가" />}
              <FormControlLabel value="supply_price" control={<Radio />} label="공급가" />
              <FormControlLabel value="special_price" control={<Radio />} label="특별 공급가" />
              <FormControlLabel value="purchase_source" control={<Radio />} label="매입처" />
              <FormControlLabel value="note" control={<Radio />} label="구분" />
              <FormControlLabel value="model" control={<Radio />} label="기종" />
            </RadioGroup>
          </FormControl>

          {batchEditTarget === 'purchase_source' ? (
            <TextField
              fullWidth
              label="매입처"
              value={batchEditValue}
              onChange={(e) => setBatchEditValue(e.target.value)}
              placeholder="어디서 매입하는 상품인지 입력"
              helperText="빈칸으로 두고 적용하면 매입처가 비워집니다."
            />
          ) : batchEditTarget === 'note' ? (
            <TextField
              select
              fullWidth
              label="구분"
              value={batchEditValue}
              onChange={(e) => setBatchEditValue(e.target.value)}
            >
              {['파츠 전체', '파츠 - 일반 부품', '파츠 - 전기 부품', '기체', '악세서리', '공임', '기타'].map(opt => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          ) : batchEditTarget === 'model' ? (
            <TextField
              fullWidth
              label="기종"
              value={batchEditValue}
              onChange={(e) => setBatchEditValue(e.target.value)}
              placeholder="예: X200GT/X100GT (슬래시로 구분)"
              helperText="여러 기종은 슬래시(/)로 구분하여 입력하세요."
            />
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={handleCloseBatchEditDialog} color="inherit">취소</Button>
          <Button
            onClick={handleBatchUpdatePrices}
            variant="contained"
            color="primary"
            disabled={isBatchUpdating || (batchEditTarget !== 'purchase_source' && !batchEditValue)}
          >
            {isBatchUpdating ? <CircularProgress size={24} /> : '일괄 적용'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 엑셀 업로드 중복 처리 다이얼로그 */}
      <Dialog 
        open={duplicateDialog.open} 
        onClose={handleDuplicateCancel} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon sx={{ color: 'warning.main' }} />
            <Typography variant="h6">중복 상품 확인</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            업로드 파일에 이미 등록된 상품코드가 {duplicateDialog.duplicates.length}건 있습니다. 
            덮어쓸 항목을 선택해주세요.
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {/* 상단 일괄 선택 */}
          <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={duplicateDialog.selectAll}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDuplicateDialog(prev => ({
                      ...prev,
                      selectAll: checked,
                      duplicates: prev.duplicates.map(d => ({ ...d, selected: checked }))
                    }));
                  }}
                />
              }
              label={<Typography variant="body2" fontWeight="bold">전체 덮어쓰기</Typography>}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`신규 ${duplicateDialog.newOnly.length}건`} 
                color="success" 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                label={`중복 ${duplicateDialog.duplicates.length}건`} 
                color="warning" 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                label={`덮어쓰기 ${duplicateDialog.duplicates.filter(d => d.selected).length}건`} 
                color="primary" 
                size="small" 
              />
            </Box>
          </Box>

          {/* 중복 목록 테이블 */}
          <TableContainer sx={{ maxHeight: 'calc(85vh - 240px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 50 }}></TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>코드</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 80 }}>구분</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>기존 제품명</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', minWidth: 200, bgcolor: 'primary.50' }}>→ 새 제품명</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 80 }}>기존 공급가</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 80, bgcolor: 'primary.50' }}>→ 새 공급가</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 80 }}>기존 판매가</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', minWidth: 80, bgcolor: 'primary.50' }}>→ 새 판매가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {duplicateDialog.duplicates.map((dup, idx) => {
                  const nameChanged = dup.existingData.name !== dup.newData.name;
                  const supplyChanged = Number(dup.existingData.supply_price || 0) !== Number(dup.newData.supply_price || 0);
                  const priceChanged = Number(dup.existingData.price || 0) !== Number(dup.newData.price || 0);
                  
                  return (
                    <TableRow 
                      key={idx} 
                      hover
                      sx={{ 
                        bgcolor: dup.selected ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: dup.selected ? 'rgba(25, 118, 210, 0.08)' : 'action.hover' }
                      }}
                      onClick={() => {
                        setDuplicateDialog(prev => {
                          const updated = [...prev.duplicates];
                          updated[idx] = { ...updated[idx], selected: !updated[idx].selected };
                          return {
                            ...prev,
                            duplicates: updated,
                            selectAll: updated.every(d => d.selected)
                          };
                        });
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={dup.selected} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight="bold">
                          {dup.newData.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{dup.newData.brand}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: nameChanged ? 'text.secondary' : 'text.primary', textDecoration: nameChanged ? 'line-through' : 'none' }}>
                          {dup.existingData.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'rgba(25, 118, 210, 0.02)' }}>
                        <Typography variant="body2" sx={{ color: nameChanged ? 'primary.main' : 'text.primary', fontWeight: nameChanged ? 'bold' : 'normal' }}>
                          {dup.newData.name}
                          {nameChanged && <Chip label="변경" size="small" color="primary" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: supplyChanged ? 'text.secondary' : 'text.primary', textDecoration: supplyChanged ? 'line-through' : 'none' }}>
                          {Number(dup.existingData.supply_price || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.02)' }}>
                        <Typography variant="body2" sx={{ color: supplyChanged ? 'primary.main' : 'text.primary', fontWeight: supplyChanged ? 'bold' : 'normal' }}>
                          {Number(dup.newData.supply_price || 0).toLocaleString()}
                          {supplyChanged && <Chip label="변경" size="small" color="primary" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: priceChanged ? 'text.secondary' : 'text.primary', textDecoration: priceChanged ? 'line-through' : 'none' }}>
                          {Number(dup.existingData.price || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ bgcolor: 'rgba(25, 118, 210, 0.02)' }}>
                        <Typography variant="body2" sx={{ color: priceChanged ? 'primary.main' : 'text.primary', fontWeight: priceChanged ? 'bold' : 'normal' }}>
                          {Number(dup.newData.price || 0).toLocaleString()}
                          {priceChanged && <Chip label="변경" size="small" color="primary" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            선택된 {duplicateDialog.duplicates.filter(d => d.selected).length}건은 덮어쓰기, 
            나머지 {duplicateDialog.duplicates.filter(d => !d.selected).length}건은 건너뜁니다.
            {duplicateDialog.newOnly.length > 0 && ` 신규 ${duplicateDialog.newOnly.length}건은 새로 등록됩니다.`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleDuplicateCancel} color="inherit">취소</Button>
            <Button 
              onClick={handleDuplicateConfirm} 
              variant="contained" 
              color="primary"
            >
              확인 ({duplicateDialog.newOnly.length + duplicateDialog.duplicates.filter(d => d.selected).length}건 처리)
            </Button>
          </Box>
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