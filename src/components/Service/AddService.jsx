import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { read, utils, writeFile } from 'xlsx';
import ReceiptScanner from '../Receipt/ReceiptScanner';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Autocomplete,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { API_CONFIG } from '../../config/api';

// 접수방법과 배송방법 옵션
const RECEPTION_TYPES = ['방문', '전화', '대리점','기타'];
const DELIVERY_METHODS = ['방문수령', '택배', '퀵-선불', '퀵-착불'];

// 사전 정의된 태그 목록
const PREDEFINED_TAGS = [
  'DBSM', '배터리', '모터', '컨트롤러', '브레이크', '타이어', '전체점검',
  'E010', 'E004', 'E007', '사고수리', '충전안됨'
];

function AddService() {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [formData, setFormData] = useState({
    brand: 'XRB',
    reception_date: new Date().toISOString().split('T')[0],
    repair_date: '',
    completion_date: '',
    reception_type: '',
    delivery_method: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    product_name: '',
    mileage: '',
    symptom: '',
    solution: '',
    note: ''
  });
  const [tags, setTags] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
  const [openPartsDialog, setOpenPartsDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [partQuantity, setPartQuantity] = useState(1);

  // 부품 목록 조회
  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', selectedBrand)
        .order('name');

      if (error) throw error;
      setAvailableParts(data);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setSnackbar({
        open: true,
        message: '부품 목록을 불러오는 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 부품 검색 다이얼로그 열기
  const handleOpenPartsDialog = () => {
    setOpenPartsDialog(true);
    setSearchTerm('');
    fetchParts();
  };

  // 부품 검색 다이얼로그 닫기
  const handleClosePartsDialog = () => {
    setOpenPartsDialog(false);
    setSearchTerm('');
    setPartQuantity(1);
  };

  // 부품 추가
  const handleAddPart = (part) => {
    const existingPart = selectedParts.find(p => p.id === part.id);
    if (existingPart) {
      setSelectedParts(prev => prev.map(p => 
        p.id === part.id 
          ? { ...p, quantity: p.quantity + partQuantity }
          : p
      ));
    } else {
      setSelectedParts(prev => [...prev, { ...part, quantity: partQuantity }]);
    }
    setPartQuantity(1);
  };

  // 부품 삭제
  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(p => p.id !== partId));
  };

  // 영수증 이미지 분석 함수
  const analyzeReceiptImage = async (imageData) => {
    try {
      const base64Image = await convertToBase64(imageData);
      
      const response = await fetch(API_CONFIG.OPENAI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "이 영수증 이미지에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error('영수증 분석 API 호출 실패');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('영수증 분석 중 오류:', error);
      throw error;
    }
  };

  // 파츠 매칭 함수
  const matchPartsWithItems = async (items) => {
    try {
      const { data: parts, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', selectedBrand);

      if (error) throw error;

      return items.map(item => {
        const matchedPart = parts.find(part => 
          part.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(part.name.toLowerCase())
        );

        return matchedPart ? {
          part_id: matchedPart.id,
          quantity: item.quantity || 1,
          price: matchedPart.price
        } : null;
      }).filter(Boolean);
    } catch (error) {
      console.error('파츠 매칭 중 오류:', error);
      return [];
    }
  };

  // Base64 변환 함수
  const convertToBase64 = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // 엑셀 템플릿 다운로드 함수
  const handleDownloadTemplate = () => {
    try {
      // 템플릿 데이터 생성
      const templateData = [
        {
          '날짜': new Date().toLocaleDateString(),
          '완료 여부': '',
          '작성자': '',
          '이름': '홍길동',
          '연락처': '010-1234-5678',
          '기종명': 'X200T',
          '누적 주행거리': '1000',
          '구입처': '',
          '문의내용': '브레이크 소음',
          '처리내용': '',
          'PDF': '',
          'JPG': '',
          '기타': '',
          '문의 위치': '방문'
        }
      ];

      // 워크시트 생성
      const ws = utils.json_to_sheet(templateData);

      // 컬럼 너비 설정
      const wscols = [
        { wch: 12 },  // 날짜
        { wch: 12 },  // 완료 여부
        { wch: 10 },  // 작성자
        { wch: 10 },  // 이름
        { wch: 15 },  // 연락처
        { wch: 15 },  // 기종명
        { wch: 12 },  // 누적 주행거리
        { wch: 12 },  // 구입처
        { wch: 40 },  // 문의내용
        { wch: 40 },  // 처리내용
        { wch: 40 },  // PDF
        { wch: 40 },  // JPG
        { wch: 20 },  // 기타
        { wch: 15 },  // 문의 위치
      ];
      ws['!cols'] = wscols;

      // 워크북 생성
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Template");

      // 파일 다운로드
      const brandName = selectedBrand === 'XRB' ? 'X-RIDER' : 'NEARBIKE';
      writeFile(wb, `AS등록_${brandName}_템플릿.xlsx`);

      setSnackbar({
        open: true,
        message: '템플릿이 다운로드되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      setSnackbar({
        open: true,
        message: '템플릿 다운로드 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 영수증 이미지 URL에서 이미지 데이터 가져오기
  const fetchImageFromUrl = async (url) => {
    try {
      // Google Drive 공유 링크를 직접 다운로드 링크로 변환
      const fileId = url.match(/\/d\/(.*?)\/view/)?.[1];
      if (!fileId) throw new Error('Invalid Google Drive URL');
      
      const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const response = await fetch(directUrl);
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  };

  // 날짜 변환 함수 수정
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    
    try {
      // 날짜가 이미 Date 객체인 경우
      if (dateStr instanceof Date) {
        return dateStr.toISOString().split('T')[0];
      }

      // 문자열이 아닌 경우 문자열로 변환
      const dateString = String(dateStr);

      // 8/1 형식 처리
      if (dateString.includes('/')) {
        const [month, day] = dateString.split('/').map(num => String(num).trim());
        const year = new Date().getFullYear();
        const formattedMonth = month.padStart(2, '0');
        const formattedDay = day.padStart(2, '0');
        return `${year}-${formattedMonth}-${formattedDay}`;
      }

      // Excel의 날짜 형식(시리얼 넘버) 처리
      const excelDate = parseInt(dateString);
      if (!isNaN(excelDate)) {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
      }

      // 기타 형식의 날짜 문자열 처리
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      console.error('날짜 변환 중 오류:', error);
      return null;
    }
  };

  // 엑셀 업로드 처리 함수 수정
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = utils.sheet_to_json(worksheet);

          // 각 행에 대해 처리
          for (const row of jsonData) {
            try {
              // 완료 여부에서 날짜 추출
              const completionMatch = row['완료 여부']?.match(/완료\((.*?)\)/);
              const completionDate = completionMatch ? parseDate(completionMatch[1]) : null;

              // 영수증 이미지 처리
              let receiptAnalysisResult = null;
              if (row['JPG']) {
                const imageBlob = await fetchImageFromUrl(row['JPG']);
                if (imageBlob) {
                  receiptAnalysisResult = await analyzeReceiptImage(imageBlob);
                }
              }

              // 서비스 데이터 구성
              const serviceData = {
                brand: selectedBrand,
                reception_date: parseDate(row['날짜']) || new Date().toISOString().split('T')[0],
                repair_date: completionDate,
                completion_date: completionDate,
                reception_type: row['문의 위치'] || '',
                customer_name: row['이름'] || '',
                customer_phone: row['연락처'] || '',
                product_name: row['기종명'] || '',
                mileage: row['누적 주행거리'] || '',
                symptom: row['문의내용'] || '',
                solution: row['처리내용'] || '',
                note: `작성자: ${row['작성자'] || ''}\n구입처: ${row['구입처'] || ''}\n기타: ${row['기타'] || ''}\nPDF: ${row['PDF'] || ''}\nJPG: ${row['JPG'] || ''}`,
                status: completionDate ? '완료' : '접수'
              };

              // 필수 필드 검증
              if (!serviceData.customer_name || !serviceData.customer_phone || !serviceData.product_name || !serviceData.symptom) {
                console.warn('필수 정보 누락:', serviceData);
                continue;
              }

              // 서비스 등록
              const { data: newService, error: serviceError } = await supabase
                .from('services')
                .insert(serviceData)
                .select()
                .single();

              if (serviceError) throw serviceError;

              // 영수증 분석 결과가 있는 경우 부품 매칭 및 등록
              if (receiptAnalysisResult && receiptAnalysisResult.items) {
                const matchedParts = await matchPartsWithItems(receiptAnalysisResult.items);
                
                if (matchedParts.length > 0) {
                  const { error: partsError } = await supabase
                    .from('service_parts')
                    .insert(matchedParts.map(part => ({
                      service_id: newService.id,
                      part_id: part.part_id,
                      quantity: part.quantity,
                      price: part.price
                    })));

                  if (partsError) throw partsError;
                }
              }

            } catch (rowError) {
              console.error('행 처리 중 오류:', rowError);
              continue;
            }
          }

          setSnackbar({
            open: true,
            message: `${jsonData.length}개의 A/S가 성공적으로 등록되었습니다.`,
            severity: 'success'
          });

          // 3초 후 목록 페이지로 이동
          setTimeout(() => {
            navigate('/services');
          }, 3000);

        } catch (error) {
          console.error('Excel processing error:', error);
          setSnackbar({
            open: true,
            message: '엑셀 처리 중 오류가 발생했습니다.',
            severity: 'error'
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('File reading error:', error);
      setSnackbar({
        open: true,
        message: '파일 읽기 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    try {
      // 필수 필드 검증
      if (!formData.customer_name || !formData.customer_phone || !formData.product_name || !formData.symptom) {
        setSnackbar({
          open: true,
          message: '필수 정보를 모두 입력해주세요.',
          severity: 'error'
        });
        return;
      }

      // 1. 서비스 등록
      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert({
          brand: selectedBrand,
          reception_date: formData.reception_date,
          repair_date: formData.repair_date || null,
          completion_date: formData.completion_date || null,
          reception_type: formData.reception_type,
          delivery_method: formData.delivery_method,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_address: formData.customer_address,
          product_name: formData.product_name,
          mileage: formData.mileage,
          symptom: formData.symptom,
          solution: formData.solution,
          note: formData.note,
          status: '접수'
        })
        .select()
        .single();

      if (serviceError) throw serviceError;

      // 2. 태그 등록
      if (tags.length > 0) {
        const { error: tagsError } = await supabase
          .from('service_tags')
          .insert(tags.map(tag => ({
            service_id: newService.id,
            tag_name: tag
          })));

        if (tagsError) throw tagsError;
      }

      // 3. 부품 등록
      if (selectedParts.length > 0) {
        const { error: partsError } = await supabase
          .from('service_parts')
          .insert(selectedParts.map(part => ({
            service_id: newService.id,
            part_id: part.id,
            quantity: part.quantity,
            price: part.price
          })));

        if (partsError) throw partsError;
      }

      setSnackbar({
        open: true,
        message: 'A/S가 성공적으로 등록되었습니다.',
        severity: 'success'
      });

      // 3초 후 목록 페이지로 이동
      setTimeout(() => {
        navigate('/services');
      }, 3000);

    } catch (error) {
      console.error('Error adding service:', error);
      setSnackbar({
        open: true,
        message: '서비스 등록 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  const handleOpenReceiptScanner = () => {
    setOpenReceiptDialog(true);
  };

  const handleCloseReceiptScanner = () => {
    setOpenReceiptDialog(false);
  };

  const handlePartsSelected = async (selectedParts) => {
    // 선택된 파츠 처리 로직
    setOpenReceiptDialog(false);
  };

  // 스타일 상수 추가
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

  return (
    <Box sx={{ maxWidth: '1800px', width: '95%', mx: 'auto' }}>
      <Box sx={{ mt: 3, mx: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <Button
            onClick={() => navigate('/services')}
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
          <Typography variant="h5" gutterBottom sx={{ 
            mb: 4, 
            color: '#191f28',
            fontWeight: 600 
          }}>
            A/S 등록
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
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
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              component="label"
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
                hidden
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
              />
            </Button>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs 
              value={selectedBrand} 
              onChange={(e, newValue) => {
                setSelectedBrand(newValue);
                setFormData(prev => ({ ...prev, brand: newValue }));
              }}
            >
              <Tab value="XRB" label="X-RIDER" />
              <Tab value="NRB" label="NEARBIKE" />
            </Tabs>
          </Box>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              {/* 왼쪽 컬럼: 기본 정보, 고객 정보와 제품 정보 */}
              <Grid item xs={12} md={6}>
                {/* 기본 정보 섹션 */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={sectionStyle}>
                    기본 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        required
                        label="접수일자"
                        type="date"
                        name="reception_date"
                        value={formData.reception_date}
                        onChange={handleInputChange}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            bgcolor: '#f9fafb'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="완료일"
                        type="date"
                        name="repair_date"
                        value={formData.repair_date}
                        onChange={handleInputChange}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            bgcolor: '#f9fafb'
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* 고객 정보와 제품 정보를 나란히 배치 */}
                <Grid container spacing={4}>
                  {/* 고객 정보 섹션 */}
                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle1" sx={sectionStyle}>
                        고객 정보
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            required
                            size="small"
                            label="고객명"
                            name="customer_name"
                            value={formData.customer_name}
                            onChange={handleInputChange}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            required
                            size="small"
                            label="연락처"
                            name="customer_phone"
                            value={formData.customer_phone}
                            onChange={handleInputChange}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="주소"
                            name="customer_address"
                            value={formData.customer_address}
                            onChange={handleInputChange}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>

                  {/* 제품 정보 섹션 */}
                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle1" sx={sectionStyle}>
                        제품 정보
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            name="brand"
                            label="브랜드"
                            value={selectedBrand}
                            onChange={(e) => {
                              setSelectedBrand(e.target.value);
                              setFormData(prev => ({ ...prev, brand: e.target.value }));
                            }}
                          >
                            <MenuItem value="XRB">X-RIDER</MenuItem>
                            <MenuItem value="NRB">NEARBIKE</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            required
                            size="small"
                            label="제품"
                            name="product_name"
                            value={formData.product_name}
                            onChange={handleInputChange}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            size="small"
                            label="주행거리"
                            name="mileage"
                            value={formData.mileage}
                            onChange={handleInputChange}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            name="reception_type"
                            label="접수방법"
                            value={formData.reception_type}
                            onChange={handleInputChange}
                          >
                            {RECEPTION_TYPES.map((type) => (
                              <MenuItem key={type} value={type}>{type}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            name="delivery_method"
                            label="배송방법"
                            value={formData.delivery_method}
                            onChange={handleInputChange}
                          >
                            {DELIVERY_METHODS.map((method) => (
                              <MenuItem key={method} value={method}>{method}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>

              {/* 오른쪽 컬럼: A/S 내역 */}
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="subtitle1" sx={sectionStyle}>
                    A/S 내역
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        multiline
                        rows={5}
                        name="symptom"
                        label="증상"
                        value={formData.symptom}
                        onChange={handleInputChange}
                        sx={{
                          '& .MuiInputBase-root': {
                            fontSize: '1.1rem',
                            lineHeight: '1.6'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={5}
                        name="solution"
                        label="처리내역"
                        value={formData.solution}
                        onChange={handleInputChange}
                        sx={{
                          '& .MuiInputBase-root': {
                            fontSize: '1.1rem',
                            lineHeight: '1.6'
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            </Grid>

            {/* 부품 정보 섹션 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={sectionStyle}>
                사용 부품
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Button
                    startIcon={<SearchIcon />}
                    variant="contained"
                    onClick={handleOpenPartsDialog}
                    sx={{ 
                      bgcolor: '#3182f6',
                      '&:hover': { bgcolor: '#1b64da' }
                    }}
                  >
                    수동으로 부품 추가
                  </Button>
                  <Button
                    startIcon={<ReceiptIcon />}
                    variant="outlined"
                    onClick={handleOpenReceiptScanner}
                    sx={{ 
                      color: '#3182f6',
                      borderColor: '#3182f6',
                      '&:hover': { 
                        bgcolor: 'rgba(49, 130, 246, 0.04)',
                        borderColor: '#1b64da'
                      }
                    }}
                  >
                    영수증으로 부품 추가
                  </Button>
                </Box>
                {selectedParts.length > 0 && (
                  <TableContainer component={Paper} sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>부품명</TableCell>
                          <TableCell>코드</TableCell>
                          <TableCell align="right">단가</TableCell>
                          <TableCell align="right">수량</TableCell>
                          <TableCell align="right">금액</TableCell>
                          <TableCell align="center">삭제</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedParts.map((part) => (
                          <TableRow key={part.id}>
                            <TableCell>{part.name}</TableCell>
                            <TableCell>{part.code}</TableCell>
                            <TableCell align="right">
                              {part.price ? part.price.toLocaleString() : '0'}원
                            </TableCell>
                            <TableCell align="right">{part.quantity}</TableCell>
                            <TableCell align="right">
                              {((part.price || 0) * part.quantity).toLocaleString()}원
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => handleRemovePart(part.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={4} align="right">
                            <Typography variant="subtitle2">합계</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2">
                              {selectedParts.reduce((sum, part) => {
                                const partTotal = part.price && part.quantity 
                                  ? part.price * part.quantity 
                                  : 0;
                                return sum + partTotal;
                              }, 0).toLocaleString()}원
                            </Typography>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Grid>

            <Box sx={{ 
              mt: 5, 
              pt: 3, 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 2,
              borderTop: '1px solid #f2f2f2' 
            }}>
              <Button 
                onClick={() => navigate('/services')}
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
                취소
              </Button>
              <Button 
                type="submit" 
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
                등록
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>

      {/* 영수증 스캐너 다이얼로그 */}
      <Dialog
        open={openReceiptDialog}
        onClose={handleCloseReceiptScanner}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>영수증 스캔</DialogTitle>
        <DialogContent>
          <ReceiptScanner
            onPartsSelected={(parts) => {
              // 선택된 파츠를 현재 선택된 파츠 목록에 추가
              const newParts = parts.map(part => ({
                id: part.id,
                name: part.name,
                code: part.code,
                price: part.price,
                quantity: part.quantity || 1
              }));
              
              setSelectedParts(prevParts => {
                const updatedParts = [...prevParts];
                newParts.forEach(newPart => {
                  const existingPartIndex = updatedParts.findIndex(p => p.id === newPart.id);
                  if (existingPartIndex >= 0) {
                    updatedParts[existingPartIndex].quantity += newPart.quantity;
                  } else {
                    updatedParts.push(newPart);
                  }
                });
                return updatedParts;
              });
              
              handleCloseReceiptScanner();
            }}
            isDialogMode={true}
          />
        </DialogContent>
      </Dialog>

      {/* 부품 검색 다이얼로그 */}
      <Dialog
        open={openPartsDialog}
        onClose={handleClosePartsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>부품 검색</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="부품명 또는 코드 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>부품명</TableCell>
                  <TableCell>코드</TableCell>
                  <TableCell align="right">단가</TableCell>
                  <TableCell align="center">수량</TableCell>
                  <TableCell align="center">추가</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableParts
                  .filter(part => 
                    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    part.code.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((part) => (
                    <TableRow key={part.id}>
                      <TableCell>{part.name}</TableCell>
                      <TableCell>{part.code}</TableCell>
                      <TableCell align="right">{part.price?.toLocaleString()}원</TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          size="small"
                          value={partQuantity}
                          onChange={(e) => setPartQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          inputProps={{ min: 1, style: { textAlign: 'center' } }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          color="primary"
                          onClick={() => handleAddPart(part)}
                        >
                          <AddIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePartsDialog}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AddService;


