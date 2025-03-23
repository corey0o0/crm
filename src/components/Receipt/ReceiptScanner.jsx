import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  IconButton,
  TextField,
  CircularProgress,
  Alert,
  Snackbar,
  Stack,
  Stepper,
  Step,
  StepLabel,
  ImageList,
  ImageListItem,
  LinearProgress,
  Tooltip,
  Card,
  CardHeader,
  CardContent,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Tab,
  Tabs
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ShoppingCart as ShoppingCartIcon,
  Receipt as ReceiptIcon,
  PictureAsPdf as PdfIcon,
  HelpOutline as HelpOutlineIcon,
  Add as AddIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';
import { useNavigate } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
// pdf.js 라이브러리 추가
import * as pdfjsLib from 'pdfjs-dist';
import { API_CONFIG } from '../../config/api';

// pdf.js 설정 - Worker 없이 동작하도록 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// 접수방법과 배송방법 옵션
const RECEPTION_TYPES = ['방문', '전화', '대리점','기타'];

function ReceiptScanner({ 
  onPartsSelected, 
  currentServiceId, 
  isDialogMode = false 
}) {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState('XRB');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ocrResults, setOcrResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [partsData, setPartsData] = useState([]);
  const [matchedProducts, setMatchedProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // 이미지 확대 보기 상태
  const [zoomImage, setZoomImage] = useState({
    open: false,
    url: ''
  });
  
  // 처리 시간 측정
  const [processingTime, setProcessingTime] = useState(null);
  
  // 파일 유형 (이미지 또는 PDF)
  const [fileType, setFileType] = useState('image');

  // OCR 엔진은 항상 Claude API 사용
  const ocrEngine = 'openai';

  const steps = [
    '파일 선택',
    '업로드 중',
    '분석 중',
    '처리 완료'
  ];

  // 업로드 방식 선택을 위한 상태 추가
  const [uploadMethod, setUploadMethod] = useState('file');
  const [imageUrl, setImageUrl] = useState('');
  
  // 파츠 데이터 로드
  useEffect(() => {
    fetchPartsData();
  }, [selectedBrand]);

  // 매칭된 상품 및 합계 금액 계산
  useEffect(() => {
    if (ocrResults.length > 0) {
      calculateMatchedProducts();
    }
  }, [ocrResults, selectedItems]);

  const fetchPartsData = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('brand', selectedBrand);
      
      if (error) throw error;
      setPartsData(data || []);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setSnackbar({
        open: true,
        message: '파츠 데이터를 불러오는데 실패했습니다.',
        severity: 'error'
      });
    }
  };

  // 문자열 유사도 계산 함수 (개선된 버전)
  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // 완전 일치
    if (s1 === s2) return 1;
    
    // 포함 관계 (모델명이나 부품번호가 포함된 경우)
    if (s1.includes(s2) || s2.includes(s1)) {
      // 길이 차이가 적을수록 더 높은 유사도
      const lengthDiff = Math.abs(s1.length - s2.length);
      const maxLength = Math.max(s1.length, s2.length);
      const lengthRatio = 1 - (lengthDiff / maxLength);
      
      return 0.8 * lengthRatio;
    }
    
    // 단어 단위 비교 (공백으로 분리된 단어들 중 일치하는 것이 있는지)
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    
    let matchCount = 0;
    let totalWeight = 0;
    
    // 단어 길이에 따른 가중치 부여
    for (const word1 of words1) {
      if (word1.length < 2) continue; // 너무 짧은 단어는 무시
      
      // 단어 길이에 따른 가중치 (긴 단어가 더 중요)
      const wordWeight = Math.min(1, word1.length / 10);
      totalWeight += wordWeight;
      
      let bestWordMatch = 0;
      
      for (const word2 of words2) {
        if (word2.length < 2) continue;
        
        // 단어 간 유사도 계산
        let wordSimilarity = 0;
        
        // 완전 일치
        if (word1 === word2) {
          wordSimilarity = 1;
        } 
        // 포함 관계
        else if (word1.includes(word2) || word2.includes(word1)) {
          const minLength = Math.min(word1.length, word2.length);
          const maxLength = Math.max(word1.length, word2.length);
          wordSimilarity = 0.8 * (minLength / maxLength);
        }
        // 부분 일치 (첫 3글자 이상 일치)
        else if (word1.length >= 3 && word2.length >= 3 && 
                 word1.substring(0, 3) === word2.substring(0, 3)) {
          wordSimilarity = 0.6;
        }
        
        // 최고 유사도 저장
        bestWordMatch = Math.max(bestWordMatch, wordSimilarity);
      }
      
      matchCount += bestWordMatch * wordWeight;
    }
    
    const wordSimilarity = totalWeight > 0 ? matchCount / totalWeight : 0;
    
    // 레벤슈타인 거리 계산
    const matrix = Array(s1.length + 1).fill().map(() => Array(s2.length + 1).fill(0));
    
    for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const maxLength = Math.max(s1.length, s2.length);
    const levenshteinSimilarity = 1 - (matrix[s1.length][s2.length] / maxLength);
    
    // 여러 유사도 측정 방법의 가중 평균
    return Math.max(
      levenshteinSimilarity * 0.5,
      wordSimilarity * 0.5
    );
  };

  // OCR 결과와 파츠 매칭 (개선된 버전)
  const matchPartsWithOCR = (ocrItems) => {
    // 상품명 정제 함수
    const cleanItemName = (name) => {
      if (!name) return '';
      
      // 불필요한 문자 및 공백 제거
      let cleaned = name.trim()
        .replace(/\s{2,}/g, ' ')  // 연속된 공백을 하나로
        .replace(/[^\w\s가-힣.,()-]/g, ''); // 허용된 특수문자 외 제거
      
      return cleaned;
    };
    
    // 각 OCR 항목에 대해 처리
    return ocrItems.map(item => {
      // 상품명 정제
      const cleanedItemName = cleanItemName(item.item_name);
      
      if (cleanedItemName.length < 2) {
        return {
          ...item,
          matched_part: null,
          similarity: 0
        };
      }
      
      // 가장 유사한 파츠 찾기
      let bestMatch = null;
      let bestSimilarity = 0;
      let secondBestMatch = null;
      let secondBestSimilarity = 0;

      partsData.forEach(part => {
        // 파츠명 정제
        const cleanedPartName = cleanItemName(part.name);
        
        // 유사도 계산
        const similarity = calculateSimilarity(cleanedItemName, cleanedPartName);
        
        // 최고 유사도 업데이트
        if (similarity > bestSimilarity) {
          secondBestMatch = bestMatch;
          secondBestSimilarity = bestSimilarity;
          bestSimilarity = similarity;
          bestMatch = part;
        } else if (similarity > secondBestSimilarity) {
          secondBestSimilarity = similarity;
          secondBestMatch = part;
        }
      });
      
      // 유사도 임계값 (최소 40% 이상 유사해야 매칭)
      const similarityThreshold = 0.4;
      
      // 최고 유사도와 두 번째 유사도의 차이가 크면 더 신뢰할 수 있음
      const confidenceGap = bestSimilarity - secondBestSimilarity;
      const isConfident = confidenceGap > 0.2; // 20% 이상 차이나면 신뢰도 높음
      
      // 최종 매칭 결정
      const finalMatch = (bestSimilarity >= similarityThreshold) ? bestMatch : null;
      
      // 신뢰도에 따라 유사도 점수 조정
      const adjustedSimilarity = isConfident ? bestSimilarity * 1.1 : bestSimilarity;
      
      return {
        ...item,
        item_name: cleanedItemName, // 정제된 상품명으로 업데이트
        matched_part: finalMatch,
        similarity: Math.min(1, adjustedSimilarity), // 1을 초과하지 않도록
        confidence: isConfident ? 'high' : 'low'
      };
    });
  };

  // 매칭된 상품 및 합계 금액 계산
  const calculateMatchedProducts = () => {
    // 선택된 항목만 필터링
    const selectedData = ocrResults.filter(item => selectedItems[item.id]);
    
    // 매칭된 상품만 필터링
    const matched = selectedData.filter(item => item.matched_part);
    
    // 상품별로 그룹화 (동일 상품이 여러 개 있을 경우 수량 합산)
    const groupedProducts = matched.reduce((acc, item) => {
      const partId = item.matched_part.id;
      
      if (!acc[partId]) {
        acc[partId] = {
          ...item.matched_part,
          quantity: parseInt(item.quantity) || 1,
          amount: parseInt(item.amount) || 0,
          originalItems: [item]
        };
      } else {
        acc[partId].quantity += parseInt(item.quantity) || 1;
        acc[partId].amount += parseInt(item.amount) || 0;
        acc[partId].originalItems.push(item);
      }
      
      return acc;
    }, {});
    
    // 객체를 배열로 변환
    const matchedProductsList = Object.values(groupedProducts);
    
    // 합계 금액 계산
    const total = matchedProductsList.reduce((sum, product) => sum + product.amount, 0);
    
    setMatchedProducts(matchedProductsList);
    setTotalAmount(total);
  };

  const preprocessImage = async (file) => {
    try {
      let processedFile = file;

      // HEIC/HEIF 포맷 처리
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        const blob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.7 // 품질 낮춤
        });
        processedFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
          type: 'image/jpeg'
        });
      }

      // 이미지 압축 옵션 (속도 최적화)
      const options = {
        maxSizeMB: 0.8, // 파일 크기 제한
        maxWidthOrHeight: 1200, // 해상도 제한
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.7, // 초기 품질 낮춤
        maxIteration: 5, // 반복 횟수 제한
        exifOrientation: 1,
        onProgress: (progress) => {
          setUploadProgress(Math.round(progress * 100));
        }
      };

      // 이미지 압축
      const compressedFile = await imageCompression(processedFile, options);

      // 이미지를 로드하여 캔버스에 그리기
      const img = new Image();
      const imgLoaded = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (error) => reject(error);
        img.src = URL.createObjectURL(compressedFile);
      });
      
      await imgLoaded;
      
      // 캔버스 생성 및 크기 설정
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 이미지 크기 조정 (더 작게)
      const maxDimension = 1200;
      let width = img.width;
      let height = img.height;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);
      
      // 이미지 향상 처리 (최소화)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 대비 향상 (단순화)
      const factor = 1.1; // 대비 증가 계수 낮춤
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
      }
      
      ctx.putImageData(imageData, 0, 0);

      // Canvas를 Blob으로 변환 (품질 낮춤)
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.7);
      });

      // 객체 URL 해제
      URL.revokeObjectURL(img.src);

      // Blob을 File로 변환
      return new File([blob], 'processed_' + file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg'
      });

    } catch (error) {
      console.error('이미지 전처리 실패:', error);
      throw new Error('이미지 처리 중 오류가 발생했습니다: ' + error.message);
    }
  };
  
  // 이미지 방향 정보 가져오기
  const getImageOrientation = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const view = new DataView(e.target.result);
        
        // EXIF 데이터가 없는 경우
        if (view.byteLength < 2 || view.getUint16(0, false) !== 0xFFD8) {
          resolve(1); // 기본 방향
          return;
        }
        
        let offset = 2;
        let marker;
        
        while (offset < view.byteLength) {
          marker = view.getUint16(offset, false);
          offset += 2;
          
          // EXIF 앱 마커 찾기
          if (marker === 0xFFE1) {
            if (view.getUint32(offset + 2, false) !== 0x45786966) {
              resolve(1); // EXIF 아님
              return;
            }
            
            const little = view.getUint16(offset + 8, false) === 0x4949;
            offset += 8;
            
            // TIFF 태그 찾기
            const tags = view.getUint16(offset, little);
            offset += 2;
            
            for (let i = 0; i < tags; i++) {
              // 방향 태그 (0x0112) 찾기
              if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                const orientation = view.getUint16(offset + (i * 12) + 8, little);
                resolve(orientation);
                return;
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break; // 유효하지 않은 마커
          } else {
            offset += view.getUint16(offset, false);
          }
        }
        
        resolve(1); // 방향 정보 없음, 기본값
      };
      
      reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // 처음 64KB만 읽기
    });
  };
  
  // 이미지 방향에 따른 변환 적용
  const applyOrientation = (ctx, orientation, width, height) => {
    switch (orientation) {
      case 2: // 수평 대칭
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        break;
      case 3: // 180° 회전
        ctx.translate(width, height);
        ctx.rotate(Math.PI);
        break;
      case 4: // 수직 대칭
        ctx.translate(0, height);
        ctx.scale(1, -1);
        break;
      case 5: // 수평 대칭 + 90° 회전
        ctx.rotate(0.5 * Math.PI);
        ctx.scale(1, -1);
        break;
      case 6: // 90° 회전
        ctx.rotate(0.5 * Math.PI);
        ctx.translate(0, -height);
        break;
      case 7: // 수평 대칭 + 270° 회전
        ctx.rotate(1.5 * Math.PI);
        ctx.scale(1, -1);
        break;
      case 8: // 270° 회전
        ctx.rotate(1.5 * Math.PI);
        ctx.translate(-width, 0);
        break;
      default:
        // 기본 방향 (1)
        break;
    }
  };

  // OCR을 위한 이미지 향상 함수
  const enhanceImageForOCR = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // 그레이스케일 변환 및 대비 향상 (모바일 환경에 맞게 조정)
    for (let i = 0; i < data.length; i += 4) {
      // 그레이스케일 변환 (가중치 적용)
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
      // 대비 향상 (모바일 환경에 맞게 조정)
      const threshold = 128;
      const contrast = 1.3; // 대비 증가 계수 조정
      
      // 대비 향상 적용
      let enhancedValue;
      if (gray < threshold) {
        enhancedValue = Math.max(0, gray - (threshold - gray) * (contrast - 1));
      } else {
        enhancedValue = Math.min(255, gray + (gray - threshold) * (contrast - 1));
      }
      
      // 이진화 처리 (텍스트 선명도 향상)
      const binaryThreshold = 150; // 임계값 조정
      const finalValue = enhancedValue < binaryThreshold ? 0 : 255;
      
      // RGB 채널에 동일한 값 적용 (그레이스케일)
      data[i] = finalValue;
      data[i + 1] = finalValue;
      data[i + 2] = finalValue;
      // 알파 채널은 유지
    }
    
    return imageData;
  };

  // 파일 업로드 전에 사용자 인증 상태 확인
  const checkUserAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (!session) {
        console.warn('사용자가 로그인되어 있지 않습니다. 스토리지 업로드가 제한될 수 있습니다.');
        return { authenticated: false, userId: null };
      }
      
      return { authenticated: true, userId: session.user.id };
    } catch (err) {
      console.error('인증 상태 확인 오류:', err);
      return { authenticated: false, userId: null };
    }
  };

  // PDF를 이미지로 변환하는 함수 수정
  const convertPdfToImages = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // pdf.js를 사용하여 PDF 문서 로드
      const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
      const pdf = await loadingTask.promise;
      const images = [];
      const pageCount = pdf.numPages;
      
      // 각 페이지를 이미지로 변환
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({scale: 2.0}); // 스케일 조정으로 이미지 품질 향상
        
        // 캔버스 생성 및 크기 설정
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // 페이지를 캔버스에 렌더링
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // 이미지 품질 향상을 위한 처리
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const enhancedImageData = enhanceImageForOCR(imageData);
        context.putImageData(enhancedImageData, 0, 0);
        
        // 이미지 데이터 URL 생성 (고품질 설정)
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        images.push({
          url: imageDataUrl,
          name: `Page ${i}`,
          type: 'image/jpeg'
        });
        
        // 진행 상황 업데이트
        setUploadProgress(Math.round((i / pageCount) * 100));
      }
      
      return images;
    } catch (error) {
      console.error('PDF 변환 오류:', error);
      throw new Error('PDF를 이미지로 변환하는 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    try {
      setLoading(true);
      setActiveStep(1);
      setUploadProgress(0);
      setOcrResults([]);
      setSelectedItems({});
      setMatchedProducts([]);
      setTotalAmount(0);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let processedFile;
        let base64Data;
        
        if (!file.type.startsWith('image/') && 
            !file.type.includes('heic') && 
            !file.type.includes('heif')) {
          throw new Error('지원되지 않는 파일 형식입니다. (JPG, PNG, HEIC 등)');
        }

        // 이미지 전처리
        processedFile = await preprocessImage(file);
        base64Data = await convertToBase64(processedFile);
        
        // 이미지 파일 표시
        setUploadedFiles([{
          url: base64Data,
          name: file.name,
          type: file.type
        }]);
        
        // 이미지 분석
        setActiveStep(2);
        setOcrProgress(30);
        const startTime = Date.now();
        const jsonResult = await processWithClaude(base64Data, file.type);
        const endTime = Date.now();
        setProcessingTime(endTime - startTime);
        setOcrResults(jsonResult.items);
        setOcrProgress(100);
        
        const allIds = jsonResult.items.reduce((acc, item) => {
          acc[item.id] = true;
          return acc;
        }, {});
        setSelectedItems(allIds);
      }

      setActiveStep(3);
      setSnackbar({
        open: true,
        message: '파일이 성공적으로 처리되었습니다.',
        severity: 'success'
      });

    } catch (err) {
      console.error('Error processing files:', err);
      setError(err.message);
      setSnackbar({
        open: true,
        message: '파일 처리 중 오류가 발생했습니다: ' + err.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setOcrProgress(0);
    }
  };

  // OpenAI API 호출 함수
  const callOpenAIAPI = async (base64Image, promptText) => {
    try {
      if (!API_CONFIG.OPENAI.API_KEY) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      console.log('API 호출 시작:', {
        endpoint: API_CONFIG.OPENAI.ENDPOINT,
        model: API_CONFIG.OPENAI.MODEL
      });

      const response = await fetch(API_CONFIG.OPENAI.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.OPENAI.API_KEY}`
        },
        body: JSON.stringify({
          model: API_CONFIG.OPENAI.MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: promptText
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

      console.log('API 응답 상태:', response.status);
      console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API 오류 응답:', errorText);
        throw new Error(`API 호출 실패 (${response.status}): ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('잘못된 응답 형식:', contentType, errorText);
        throw new Error(`잘못된 응답 형식: ${contentType}`);
      }

      const result = await response.json();
      console.log('API 응답 데이터:', result);

      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error('예상치 못한 API 응답 형식:', result);
        throw new Error('API 응답 형식이 올바르지 않습니다.');
      }

      return result;
    } catch (error) {
      console.error('OpenAI API 호출 중 오류:', error);
      throw new Error(`OpenAI API 오류: ${error.message}`);
    }
  };

  // processWithClaude 함수 수정
  const processWithClaude = async (base64Data, fileType) => {
    try {
      const promptText = "이 영수증 이미지에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. 상품명은 정확하게 추출하고, 수량이 명시되지 않은 경우 1로 설정하세요. 금액은 숫자만 추출하세요. 영수증에 있는 모든 상품을 빠짐없이 추출해주세요. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}";
      
      // 테스트 모드 여부 확인
      const isTestMode = process.env.REACT_APP_TEST_MODE === 'true';
      
      if (isTestMode) {
        console.log('API 테스트 모드 활성화 - 더미 데이터 반환');
        return {
          items: [
            { id: 1, item_name: "테스트 상품 1", quantity: 2, amount: 15000 },
            { id: 2, item_name: "테스트 상품 2", quantity: 1, amount: 8000 }
          ]
        };
      }

      // 이미지 크기 최적화
      const maxImageSize = 1024 * 1024; // 1MB
      let optimizedBase64 = base64Data;
      
      if (base64Data.length > maxImageSize) {
        // 이미지 크기가 큰 경우 추가 압축
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = base64Data;
        });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 이미지 크기 조정
        let width = img.width;
        let height = img.height;
        const maxDimension = 800;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        optimizedBase64 = canvas.toDataURL('image/jpeg', 0.6);
      }

      const result = await callOpenAIAPI(optimizedBase64, promptText);
      
      try {
        // JSON 부분 추출 및 파싱
        const content = result.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error('JSON 형식의 응답을 찾을 수 없습니다.');
        }
        
        const parsedContent = JSON.parse(jsonMatch[0]);
        
        if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
          throw new Error('잘못된 응답 형식입니다.');
        }
        
        // 각 항목의 필수 필드 확인 및 보정
        const processedItems = parsedContent.items.map((item, index) => ({
          id: item.id || index + 1,
          item_name: item.item_name || '알 수 없는 상품',
          quantity: parseInt(item.quantity) || 1,
          amount: parseInt(String(item.amount).replace(/[^0-9]/g, '')) || 0
        }));
        
        // OCR 결과와 파츠 매칭
        const matchedItems = matchPartsWithOCR(processedItems);
        
        return { items: matchedItems };
      } catch (parseError) {
        console.error('응답 파싱 실패:', parseError);
        throw new Error('분석 결과 파싱에 실패했습니다.');
      }
    } catch (error) {
      console.error('OpenAI 처리 실패:', error);
      throw error;
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allIds = ocrResults.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {});
      setSelectedItems(allIds);
    } else {
      setSelectedItems({});
    }
  };

  const handleExportToExcel = () => {
    try {
      // 선택된 항목만 필터링
      const selectedData = ocrResults.filter(item => selectedItems[item.id]);
      
      if (selectedData.length === 0) {
        setSnackbar({
          open: true,
          message: '내보낼 항목을 선택해주세요.',
          severity: 'warning'
        });
        return;
      }
      
      // 엑셀 데이터 형식 변환
      const excelData = selectedData.map(item => ({
        '상품명': item.item_name,
        '수량': item.quantity,
        '금액': item.amount,
        '매칭된 파츠': item.matched_part ? item.matched_part.name : '매칭 없음',
        '매칭 유사도': item.similarity ? (item.similarity * 100).toFixed(2) + '%' : '0%'
      }));
      
      // 워크시트 생성
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // 워크북 생성
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '영수증 분석 결과');
      
      // 엑셀 파일 저장
      XLSX.writeFile(wb, `영수증_분석_결과_${new Date().toISOString().slice(0, 10)}.xlsx`);
      
      setSnackbar({
        open: true,
        message: '엑셀 파일이 성공적으로 저장되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Excel export error:', error);
      setSnackbar({
        open: true,
        message: '엑셀 파일 저장 중 오류가 발생했습니다.',
        severity: 'error'
      });
    }
  };

  // 이미지 확대 보기 함수
  const handleZoomImage = (url) => {
    setZoomImage({
      open: true,
      url
    });
  };

  // 이미지 확대 보기 닫기 함수
  const handleCloseZoom = () => {
    setZoomImage({
      open: false,
      url: ''
    });
  };

  // A/S 서비스에 매칭된 상품 추가
  const handleAddToService = () => {
    // 서비스 ID 입력 다이얼로그 열기
    setServiceIdDialog({
      open: true,
      serviceId: ''
    });
  };

  // 서비스 ID 입력 다이얼로그 상태
  const [serviceIdDialog, setServiceIdDialog] = useState({
    open: false,
    serviceId: ''
  });

  // 서비스 ID 입력 처리
  const handleServiceIdChange = (e) => {
    setServiceIdDialog(prev => ({
      ...prev,
      serviceId: e.target.value
    }));
  };

  // 서비스에 상품 추가 처리
  const handleConfirmAddToService = async () => {
    try {
      const serviceId = serviceIdDialog.serviceId.trim();
      
      if (!serviceId) {
        setSnackbar({
          open: true,
          message: 'A/S 서비스 ID를 입력해주세요.',
          severity: 'warning'
        });
        return;
      }
      
      // 서비스 존재 여부 확인
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id')
        .eq('id', serviceId)
        .single();
      
      if (serviceError || !serviceData) {
        setSnackbar({
          open: true,
          message: '해당 ID의 A/S 서비스를 찾을 수 없습니다.',
          severity: 'error'
        });
        return;
      }
      
      // 선택된 매칭 상품만 필터링
      const selectedMatchedProducts = matchedProducts.filter(product => 
        product.originalItems.some(item => selectedItems[item.id])
      );
      
      if (selectedMatchedProducts.length === 0) {
        setSnackbar({
          open: true,
          message: '추가할 상품을 선택해주세요.',
          severity: 'warning'
        });
        return;
      }
      
      // 서비스 부품 데이터 준비
      const serviceParts = selectedMatchedProducts.map(product => ({
        service_id: serviceId,
        part_id: product.id,
        quantity: product.quantity,
        price: product.price || 0
      }));
      
      // 서비스 부품 추가
      const { error: insertError } = await supabase
        .from('service_parts')
        .insert(serviceParts);
      
      if (insertError) {
        console.error('부품 추가 오류:', insertError);
        throw new Error('부품 추가 중 오류가 발생했습니다.');
      }
      
      // 다이얼로그 닫기
      setServiceIdDialog({
        open: false,
        serviceId: ''
      });
      
      // 성공 메시지 표시
      setSnackbar({
        open: true,
        message: `${selectedMatchedProducts.length}개 상품이 A/S 서비스에 추가되었습니다.`,
        severity: 'success'
      });
      
      // 서비스 상세 페이지로 이동 여부 확인
      const shouldNavigate = window.confirm('A/S 서비스 상세 페이지로 이동하시겠습니까?');
      if (shouldNavigate) {
        navigate(`/services/${serviceId}`);
      }
      
    } catch (error) {
      console.error('서비스에 상품 추가 오류:', error);
      setSnackbar({
        open: true,
        message: `오류가 발생했습니다: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // 부품 선택 완료 처리 함수 추가
  const handleConfirmSelection = () => {
    if (onPartsSelected && matchedProducts.length > 0) {
      onPartsSelected(matchedProducts);
    }
  };

  // URL 유효성 검사 함수
  const isValidImageUrl = (url) => {
    return url.match(/\.(jpg|jpeg|png|gif|heic|heif)$/i);
  };

  // URL을 통한 이미지 처리
  const handleUrlUpload = async () => {
    if (!imageUrl) {
      setSnackbar({
        open: true,
        message: '이미지 URL을 입력해주세요.',
        severity: 'warning'
      });
      return;
    }

    if (!isValidImageUrl(imageUrl)) {
      setSnackbar({
        open: true,
        message: '유효한 이미지 URL이 아닙니다.',
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      setActiveStep(1);
      setUploadProgress(0);
      setOcrResults([]);
      setSelectedItems({});
      setMatchedProducts([]);
      setTotalAmount(0);

      // URL에서 이미지 가져오기
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'image_from_url.jpg', { type: blob.type });

      // 이미지 전처리
      const processedFile = await preprocessImage(file);
      const base64Data = await convertToBase64(processedFile);

      // 이미지 파일 표시
      setUploadedFiles([{
        url: base64Data,
        name: 'image_from_url.jpg',
        type: blob.type
      }]);

      // 이미지 분석
      setActiveStep(2);
      setOcrProgress(30);
      const startTime = Date.now();
      const jsonResult = await processWithClaude(base64Data, blob.type);
      const endTime = Date.now();
      setProcessingTime(endTime - startTime);
      setOcrResults(jsonResult.items);
      setOcrProgress(100);

      const allIds = jsonResult.items.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {});
      setSelectedItems(allIds);

      setActiveStep(3);
      setSnackbar({
        open: true,
        message: '파일이 성공적으로 처리되었습니다.',
        severity: 'success'
      });

    } catch (err) {
      console.error('Error processing URL:', err);
      setError(err.message);
      setSnackbar({
        open: true,
        message: '이미지 처리 중 오류가 발생했습니다: ' + err.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setOcrProgress(0);
    }
  };

  return (
    <Box sx={{ p: isDialogMode ? 2 : 3 }}>
      {!isDialogMode && (
        <Typography variant="h4" gutterBottom>
          영수증 분석 및 상품 매칭
        </Typography>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle1">
            영수증 분석
          </Typography>
          
          {processingTime && (
            <Chip 
              icon={<ReceiptIcon />} 
              label={`처리 시간: ${processingTime}ms`} 
              variant="outlined" 
              color="primary"
            />
          )}
        </Box>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          이미지 파일(JPG, PNG, HEIC 등)을 업로드하거나 이미지 URL을 입력하여 영수증을 분석할 수 있습니다.
        </Alert>
        
        <Tabs
          value={uploadMethod}
          onChange={(e, newValue) => setUploadMethod(newValue)}
          sx={{ mb: 2 }}
        >
          <Tab value="file" label="파일 업로드" icon={<CloudUploadIcon />} iconPosition="start" />
          <Tab value="url" label="URL 입력" icon={<LinkIcon />} iconPosition="start" />
        </Tabs>

        <Grid container spacing={2}>
          {uploadMethod === 'file' ? (
            <Grid item xs={12}>
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUploadIcon />}
                disabled={loading}
                fullWidth
              >
                영수증 이미지 업로드
                <input
                  type="file"
                  hidden
                  accept="image/*,.heic,.heif"
                  multiple
                  onChange={handleFileUpload}
                />
              </Button>
            </Grid>
          ) : (
            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  placeholder="이미지 URL을 입력하세요"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={loading}
                />
                <Button
                  variant="contained"
                  onClick={handleUrlUpload}
                  disabled={loading || !imageUrl}
                  startIcon={<LinkIcon />}
                >
                  분석
                </Button>
              </Stack>
            </Grid>
          )}
        </Grid>
        
        {(uploadProgress > 0 && uploadProgress < 100) && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              업로드 중... {Math.round(uploadProgress)}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}
        
        {(ocrProgress > 0 && ocrProgress < 100) && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              분석 중... {Math.round(ocrProgress)}%
            </Typography>
            <LinearProgress variant="determinate" value={ocrProgress} />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
      
      {/* 업로드된 파일과 분석 결과를 나란히 표시 */}
      <Grid container spacing={3}>
        {/* 업로드된 파일 미리보기 */}
        <Grid item xs={12} md={6}>
          {uploadedFiles.length > 0 && (
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                업로드된 파일
              </Typography>
              <Box sx={{ height: '500px', overflow: 'auto' }}>
                {uploadedFiles.map((file, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    {file.type === 'pdf' ? (
                      <Box
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: '#f5f5f5',
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          p: 2
                        }}
                      >
                        <PdfIcon sx={{ fontSize: 60, color: '#f44336' }} />
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {file.name}
                        </Typography>
                        <Button
                          size="small"
                          href={file.url}
                          target="_blank"
                          sx={{ mt: 1 }}
                        >
                          PDF 보기
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ position: 'relative' }}>
                        <img
                          src={file.url}
                          alt={file.name}
                          style={{ 
                            width: '100%',
                            height: 'auto',
                            cursor: 'zoom-in',
                            borderRadius: '4px'
                          }}
                          onClick={() => handleZoomImage(file.url)}
                        />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            mt: 1, 
                            display: 'block',
                            color: 'text.secondary'
                          }}
                        >
                          {file.name}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </Grid>

        {/* 매칭된 상품 리스트 및 합계 금액 */}
        <Grid item xs={12} md={6}>
          {matchedProducts.length > 0 && (
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                매칭된 상품 리스트
              </Typography>
              <Box sx={{ mb: 2 }}>
                {isDialogMode ? (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleConfirmSelection}
                    sx={{ mr: 1 }}
                  >
                    선택한 부품 추가하기
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddToService()}
                    sx={{ mr: 1 }}
                  >
                    A/S 서비스에 추가
                  </Button>
                )}
              </Box>
              <TableContainer sx={{ maxHeight: '400px', overflow: 'auto' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>상품명</TableCell>
                      <TableCell align="right">수량</TableCell>
                      <TableCell align="right">단가</TableCell>
                      <TableCell align="right">금액</TableCell>
                      <TableCell>매칭 정보</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {matchedProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell align="right">{product.quantity}</TableCell>
                        <TableCell align="right">
                          {product.price ? `${product.price.toLocaleString()}원` : '-'}
                        </TableCell>
                        <TableCell align="right">{product.amount.toLocaleString()}원</TableCell>
                        <TableCell>
                          <Tooltip title={product.originalItems.map(item => item.item_name).join(', ')}>
                            <Chip 
                              size="small" 
                              color="success" 
                              label={`${product.originalItems.length}개 항목 매칭`} 
                            />
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>
                        합계 금액:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {totalAmount.toLocaleString()}원
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Grid>
      </Grid>
      
      {/* 이미지 확대 보기 다이얼로그 */}
      <Dialog
        open={zoomImage.open}
        onClose={handleCloseZoom}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent>
          <img
            src={zoomImage.url}
            alt="확대된 영수증"
            style={{ width: '100%', height: 'auto' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseZoom}>닫기</Button>
        </DialogActions>
      </Dialog>
      
      {/* 서비스 ID 입력 다이얼로그 - 다이얼로그 모드가 아닐 때만 표시 */}
      {!isDialogMode && (
        <Dialog 
          open={serviceIdDialog.open} 
          onClose={() => setServiceIdDialog(prev => ({ ...prev, open: false }))}
          keepMounted={false}
        >
          <DialogTitle>A/S 서비스에 상품 추가</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="A/S 서비스 ID"
              type="text"
              fullWidth
              value={serviceIdDialog.serviceId}
              onChange={handleServiceIdChange}
              helperText="추가할 A/S 서비스의 ID를 입력하세요"
              aria-label="A/S 서비스 ID 입력"
            />
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setServiceIdDialog(prev => ({ ...prev, open: false }))}
              aria-label="취소"
            >
              취소
            </Button>
            <Button 
              onClick={handleConfirmAddToService} 
              color="primary"
              aria-label="추가"
            >
              추가
            </Button>
          </DialogActions>
        </Dialog>
      )}
      
      {/* 스낵바 */}
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
    </Box>
  );
}

export default ReceiptScanner; 