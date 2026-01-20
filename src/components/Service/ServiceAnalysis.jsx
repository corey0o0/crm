import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  MenuItem,
  CircularProgress,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Chip
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Analytics as AnalyticsIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import AIInsights from './AIInsights';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import AutoReport from './AutoReport';
import AnomalyDetection from './AnomalyDetection';
import { supabase } from '../../lib/supabaseClient';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { getOllamaModels, aiNormalizeServiceData } from '../../utils/aiAnalysisUtils';
import { API_CONFIG } from '../../config/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

// 텍스트 정규화 함수
const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // 공백 제거 및 소문자 변환
  let normalized = text.trim().toLowerCase();
  
  // 연속된 공백을 하나로
  normalized = normalized.replace(/\s+/g, ' ');
  
  // 특수문자 제거 (한글, 영문, 숫자만 유지)
  normalized = normalized.replace(/[^\w\s가-힣]/g, '');
  
  return normalized;
};

// 기종명 정규화 함수 (공백, 대소문자, 한글/영문 변환 통일)
const normalizeProductName = (productName) => {
  if (!productName || typeof productName !== 'string') return '';
  
  let normalized = productName.trim();
  
  // 대문자로 통일
  normalized = normalized.toUpperCase();
  
  // 한글/영문 혼용 처리 및 설명어 제거
  const replacements = {
    // 버전/등급 관련
    '프로': 'PRO',
    '플러스': 'PLUS',
    '미니': 'MINI',
    '맥스': 'MAX',
    '에어': 'AIR',
    '프리미엄': 'PREMIUM',
    '스탠다드': 'STANDARD',
    '베이직': 'BASIC',
    '라이트': 'LIGHT',
    '헤비': 'HEAVY',
    '슈퍼': 'SUPER',
    '울트라': 'ULTRA',
    '엑스': 'X',
    '와이': 'Y',
    '제트': 'Z',
    // 모터 타입 관련 (제거 대상)
    '미드모터': '',
    '미드': '',
    '리어휠': '',
    '리어': '',
    '프론트휠': '',
    '프론트': '',
    '휠': '',
    '모터': '',
    // 기타 설명어 제거
    '전기': '',
    '자전거': '',
    '전동': '',
    '스쿠터': '',
    '바이크': '',
    '기체': '',
    '본체': ''
  };
  
  // 한글을 영문으로 변환하거나 제거
  Object.entries(replacements).forEach(([korean, english]) => {
    if (english === '') {
      // 설명어는 제거
      normalized = normalized.replace(new RegExp(korean, 'gi'), '');
    } else {
      // 버전/등급은 영문으로 변환
      normalized = normalized.replace(new RegExp(korean, 'gi'), english);
    }
  });
  
  // 모든 공백 제거
  normalized = normalized.replace(/\s+/g, '');
  
  // 숫자와 영문만 남기기 (특수문자 및 남은 한글 제거)
  normalized = normalized.replace(/[^A-Z0-9]/g, '');
  
  // 빈 문자열이면 원본 반환 (최소한의 정규화)
  if (!normalized) {
    // 원본에서 숫자와 영문만 추출
    normalized = productName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  
  return normalized;
};


// 빈도 분석 함수
const analyzeFrequency = (items) => {
  const frequency = {};
  
  items.forEach(item => {
    const normalized = normalizeText(item);
    if (!normalized) return;
    
    // 원본 텍스트를 키로 사용 (정규화된 버전은 보조로)
    const key = item.trim() || normalized;
    frequency[key] = (frequency[key] || 0) + 1;
  });
  
  // 빈도순으로 정렬
  return Object.entries(frequency)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
};

function ServiceAnalysis() {
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [startDate, setStartDate] = useState(dayjs().subtract(6, 'month').startOf('month'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month'));
  const [completedOnly, setCompletedOnly] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    // localStorage에서 저장된 모델 불러오기
    const saved = localStorage.getItem('selectedOllamaModel');
    return saved || (API_CONFIG.LOCAL_LLM.ENABLED ? API_CONFIG.LOCAL_LLM.MODEL : '');
  });
  const [useAiNormalization, setUseAiNormalization] = useState(false);
  
  const [analysisData, setAnalysisData] = useState({
    totalCount: 0,
    completedCount: 0,
    uniqueSymptoms: 0,
    uniqueSolutions: 0,
    symptomStats: [],
    solutionStats: [],
    relationshipData: [],
    productStats: [],
    productSymptomData: [],
    mileageStats: [],
    mileageSymptomData: [],
    partsStats: [],
    partsSymptomData: [],
    partsSolutionData: [],
    tagStats: [],
    tagSymptomData: [],
    tagSolutionData: [],
    tagProductData: [],
    tagPartsData: []
  });
  const [aiNormalizationSamples, setAiNormalizationSamples] = useState({
    products: [],
    symptoms: [],
    solutions: []
  });

  const fetchAnalysisData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 날짜 범위 설정
      const startDateStr = startDate.format('YYYY-MM-DD');
      const endDateStr = endDate.format('YYYY-MM-DD');
      
      // A/S 데이터 조회 (부품 정보 및 태그 포함)
      let query = supabase
        .from('services')
        .select(`
          id, 
          symptom, 
          solution, 
          status, 
          brand, 
          reception_date, 
          completion_date,
          product_name,
          mileage,
          service_parts (
            id,
            part_id,
            quantity,
            price,
            usage,
            parts (
              id,
              name,
              code
            )
          ),
          service_tags (
            tag_name
          )
        `)
        .gte('reception_date', startDateStr)
        .lte('reception_date', endDateStr);
      
      if (selectedBrand !== '전체') {
        query = query.eq('brand', selectedBrand);
      }
      
      if (completedOnly) {
        query = query.eq('status', '완료');
      }
      
      const { data: services, error } = await query;
      
      if (error) throw error;
      
      // symptom과 solution 필터링 (빈 값 제외)
      const validServices = services.filter(service => 
        service.symptom && service.symptom.trim() !== ''
      );

      // AI 정규화 적용 (옵션)
      let processedServices = validServices;
      if (useAiNormalization && validServices.length > 0) {
        const maps = await aiNormalizeServiceData(validServices, { model: selectedModel });
        processedServices = validServices.map(service => {
          const originalProduct = service.product_name;
          const originalSymptom = service.symptom;
          const originalSolution = service.solution;
          return {
            ...service,
            original_product_name: originalProduct,
            original_symptom: originalSymptom,
            original_solution: originalSolution,
            product_name: maps.productMap[originalProduct?.trim()] || originalProduct,
            symptom: maps.symptomMap[originalSymptom?.trim()] || originalSymptom,
            solution: maps.solutionMap[originalSolution?.trim()] || originalSolution
          };
        });

        const productSamples = Object.entries(maps.productMap || {})
          .filter(([orig, norm]) => orig && norm && orig.trim() !== norm.trim())
          .slice(0, 8)
          .map(([orig, norm]) => ({ original: orig, normalized: norm }));
        const symptomSamples = Object.entries(maps.symptomMap || {})
          .filter(([orig, norm]) => orig && norm && orig.trim() !== norm.trim())
          .slice(0, 8)
          .map(([orig, norm]) => ({ original: orig, normalized: norm }));
        const solutionSamples = Object.entries(maps.solutionMap || {})
          .filter(([orig, norm]) => orig && norm && orig.trim() !== norm.trim())
          .slice(0, 8)
          .map(([orig, norm]) => ({ original: orig, normalized: norm }));

        setAiNormalizationSamples({
          products: productSamples,
          symptoms: symptomSamples,
          solutions: solutionSamples
        });
      } else {
        setAiNormalizationSamples({
          products: [],
          symptoms: [],
          solutions: []
        });
      }
      
      const completedServices = processedServices.filter(service => 
        service.status === '완료' && service.solution && service.solution.trim() !== ''
      );
      
      // 접수 내용 분석
      const symptoms = processedServices.map(s => s.symptom);
      const symptomStats = analyzeFrequency(symptoms);
      
      // 해결 방법 분석 (완료된 건만)
      const solutions = completedServices.map(s => s.solution);
      const solutionStats = analyzeFrequency(solutions);
      
      // 관계 분석 (접수 내용 -> 해결 방법)
      const relationshipMap = {};
      completedServices.forEach(service => {
        const symptom = service.symptom.trim();
        const solution = service.solution.trim();
        
        if (!relationshipMap[symptom]) {
          relationshipMap[symptom] = {};
        }
        
        relationshipMap[symptom][solution] = (relationshipMap[symptom][solution] || 0) + 1;
      });
      
      // 관계 데이터 변환
      const relationshipData = Object.entries(relationshipMap)
        .map(([symptom, solutions]) => ({
          symptom,
          solutions: Object.entries(solutions)
            .map(([solution, count]) => ({ solution, count }))
            .sort((a, b) => b.count - a.count)
        }))
        .sort((a, b) => {
          const aTotal = a.solutions.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.solutions.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        });
      
      // 기종별 분석 (정규화하여 같은 기종으로 묶기)
      const productNormalizedMap = {}; // 정규화된 이름 -> 원본 이름들
      const productCounts = {};
      const productSymptomMap = {};
      const productNameFrequency = {}; // 원본 이름별 빈도
      
      processedServices.forEach(service => {
        const originalProduct = service.product_name?.trim() || '미지정';
        const normalizedProduct = normalizeProductName(originalProduct) || '미지정';
        
        // 정규화된 이름으로 그룹화
        if (!productNormalizedMap[normalizedProduct]) {
          productNormalizedMap[normalizedProduct] = new Set();
        }
        productNormalizedMap[normalizedProduct].add(originalProduct);
        
        // 원본 이름별 빈도 계산
        if (!productNameFrequency[originalProduct]) {
          productNameFrequency[originalProduct] = 0;
        }
        productNameFrequency[originalProduct] += 1;
        
        // 가장 많이 사용된 원본 이름을 대표 이름으로 사용
        if (!productCounts[normalizedProduct]) {
          productCounts[normalizedProduct] = { count: 0, originalNames: new Set() };
        }
        productCounts[normalizedProduct].count += 1;
        productCounts[normalizedProduct].originalNames.add(originalProduct);
        
        if (!productSymptomMap[normalizedProduct]) {
          productSymptomMap[normalizedProduct] = {};
        }
        const symptom = service.symptom.trim();
        productSymptomMap[normalizedProduct][symptom] = (productSymptomMap[normalizedProduct][symptom] || 0) + 1;
      });
      
      // 대표 이름 선택 (가장 많이 사용된 원본 이름, 동일하면 설명어가 없는 간단한 이름 우선)
      const getRepresentativeName = (normalizedName) => {
        const names = Array.from(productCounts[normalizedName].originalNames);
        if (names.length === 0) return normalizedName;
        
        // 설명어 패턴 (제거 대상)
        const descriptionPatterns = [
          /미드모터/i, /리어휠/i, /프론트휠/i, /미드/i, /리어/i, /프론트/i,
          /전기/i, /자전거/i, /전동/i, /스쿠터/i, /바이크/i, /기체/i, /본체/i
        ];
        
        // 설명어가 없는 이름 찾기
        const simpleNames = names.filter(name => 
          !descriptionPatterns.some(pattern => pattern.test(name))
        );
        
        // 설명어가 없는 이름이 있으면 그 중 가장 많이 사용된 것
        if (simpleNames.length > 0) {
          return simpleNames.sort((a, b) => 
            productNameFrequency[b] - productNameFrequency[a] || a.length - b.length
          )[0];
        }
        
        // 모두 설명어가 있으면 가장 많이 사용된 것
        return names.sort((a, b) => 
          productNameFrequency[b] - productNameFrequency[a] || a.length - b.length
        )[0];
      };
      
      const productStats = Object.entries(productCounts)
        .map(([normalized, data]) => ({
          product: getRepresentativeName(normalized),
          normalized: normalized,
          count: data.count,
          aliases: Array.from(data.originalNames).filter(n => n !== getRepresentativeName(normalized))
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      const productSymptomData = Object.entries(productSymptomMap)
        .map(([normalized, symptoms]) => ({
          product: getRepresentativeName(normalized),
          normalized: normalized,
          symptoms: Object.entries(symptoms)
            .map(([symptom, count]) => ({ symptom, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.symptoms.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.symptoms.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      // 거리별 분석
      const mileageRanges = {
        '0-1000': { min: 0, max: 1000, label: '0-1,000km' },
        '1000-5000': { min: 1000, max: 5000, label: '1,000-5,000km' },
        '5000-10000': { min: 5000, max: 10000, label: '5,000-10,000km' },
        '10000-20000': { min: 10000, max: 20000, label: '10,000-20,000km' },
        '20000+': { min: 20000, max: Infinity, label: '20,000km 이상' },
        '미기록': { min: -1, max: -1, label: '미기록' }
      };
      
      const mileageCounts = {};
      const mileageSymptomMap = {};
      
      processedServices.forEach(service => {
        const mileage = service.mileage ? parseFloat(service.mileage) : null;
        let range = '미기록';
        
        if (mileage !== null && !isNaN(mileage)) {
          for (const [key, rangeData] of Object.entries(mileageRanges)) {
            if (key === '미기록') continue;
            if (mileage >= rangeData.min && mileage < rangeData.max) {
              range = key;
              break;
            }
          }
          if (mileage >= 20000) range = '20000+';
        }
        
        mileageCounts[range] = (mileageCounts[range] || 0) + 1;
        
        if (!mileageSymptomMap[range]) {
          mileageSymptomMap[range] = {};
        }
        const symptom = service.symptom.trim();
        mileageSymptomMap[range][symptom] = (mileageSymptomMap[range][symptom] || 0) + 1;
      });
      
      const mileageStats = Object.entries(mileageCounts)
        .map(([range, count]) => ({
          range: mileageRanges[range]?.label || range,
          count
        }))
        .sort((a, b) => {
          const aOrder = Object.keys(mileageRanges).indexOf(
            Object.keys(mileageRanges).find(k => mileageRanges[k]?.label === a.range)
          );
          const bOrder = Object.keys(mileageRanges).indexOf(
            Object.keys(mileageRanges).find(k => mileageRanges[k]?.label === b.range)
          );
          return aOrder - bOrder;
        });
      
      const mileageSymptomData = Object.entries(mileageSymptomMap)
        .map(([range, symptoms]) => ({
          range: mileageRanges[range]?.label || range,
          symptoms: Object.entries(symptoms)
            .map(([symptom, count]) => ({ symptom, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.symptoms.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.symptoms.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        });
      
      // 부품별 분석
      const partsCounts = {};
      const partsSymptomMap = {};
      const partsSolutionMap = {};
      
      processedServices.forEach(service => {
        if (service.service_parts && service.service_parts.length > 0) {
          service.service_parts.forEach(sp => {
            const partName = sp.parts?.name || sp.parts?.code || '알 수 없음';
            partsCounts[partName] = (partsCounts[partName] || 0) + (sp.quantity || 1);
            
            if (!partsSymptomMap[partName]) {
              partsSymptomMap[partName] = {};
            }
            const symptom = service.symptom.trim();
            partsSymptomMap[partName][symptom] = (partsSymptomMap[partName][symptom] || 0) + 1;
            
            if (service.status === '완료' && service.solution) {
              if (!partsSolutionMap[partName]) {
                partsSolutionMap[partName] = {};
              }
              const solution = service.solution.trim();
              partsSolutionMap[partName][solution] = (partsSolutionMap[partName][solution] || 0) + 1;
            }
          });
        }
      });
      
      const partsStats = Object.entries(partsCounts)
        .map(([part, count]) => ({ part, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      const partsSymptomData = Object.entries(partsSymptomMap)
        .map(([part, symptoms]) => ({
          part,
          symptoms: Object.entries(symptoms)
            .map(([symptom, count]) => ({ symptom, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.symptoms.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.symptoms.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      const partsSolutionData = Object.entries(partsSolutionMap)
        .map(([part, solutions]) => ({
          part,
          solutions: Object.entries(solutions)
            .map(([solution, count]) => ({ solution, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.solutions.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.solutions.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      // 태그별 분석
      const tagCounts = {};
      const tagSymptomMap = {};
      const tagSolutionMap = {};
      const tagProductMap = {};
      const tagPartsMap = {};
      
      processedServices.forEach(service => {
        if (service.service_tags && service.service_tags.length > 0) {
          service.service_tags.forEach(tagObj => {
            const tag = tagObj.tag_name?.trim();
            if (!tag) return;
            
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            
            // 태그별 접수 내용
            if (!tagSymptomMap[tag]) {
              tagSymptomMap[tag] = {};
            }
            const symptom = service.symptom.trim();
            tagSymptomMap[tag][symptom] = (tagSymptomMap[tag][symptom] || 0) + 1;
            
            // 태그별 해결 방법 (완료된 건만)
            if (service.status === '완료' && service.solution) {
              if (!tagSolutionMap[tag]) {
                tagSolutionMap[tag] = {};
              }
              const solution = service.solution.trim();
              tagSolutionMap[tag][solution] = (tagSolutionMap[tag][solution] || 0) + 1;
            }
            
            // 태그별 기종
            if (service.product_name) {
              const normalizedProduct = normalizeProductName(service.product_name);
              if (!tagProductMap[tag]) {
                tagProductMap[tag] = {};
              }
              tagProductMap[tag][normalizedProduct] = (tagProductMap[tag][normalizedProduct] || 0) + 1;
            }
            
            // 태그별 부품
            if (service.service_parts && service.service_parts.length > 0) {
              service.service_parts.forEach(sp => {
                const partName = sp.parts?.name || sp.parts?.code || '알 수 없음';
                if (!tagPartsMap[tag]) {
                  tagPartsMap[tag] = {};
                }
                tagPartsMap[tag][partName] = (tagPartsMap[tag][partName] || 0) + (sp.quantity || 1);
              });
            }
          });
        }
      });
      
      const tagStats = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      const tagSymptomData = Object.entries(tagSymptomMap)
        .map(([tag, symptoms]) => ({
          tag,
          symptoms: Object.entries(symptoms)
            .map(([symptom, count]) => ({ symptom, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.symptoms.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.symptoms.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      const tagSolutionData = Object.entries(tagSolutionMap)
        .map(([tag, solutions]) => ({
          tag,
          solutions: Object.entries(solutions)
            .map(([solution, count]) => ({ solution, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.solutions.reduce((sum, s) => sum + s.count, 0);
          const bTotal = b.solutions.reduce((sum, s) => sum + s.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      const tagProductData = Object.entries(tagProductMap)
        .map(([tag, products]) => ({
          tag,
          products: Object.entries(products)
            .map(([product, count]) => ({ product, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.products.reduce((sum, p) => sum + p.count, 0);
          const bTotal = b.products.reduce((sum, p) => sum + p.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      const tagPartsData = Object.entries(tagPartsMap)
        .map(([tag, parts]) => ({
          tag,
          parts: Object.entries(parts)
            .map(([part, count]) => ({ part, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        }))
        .sort((a, b) => {
          const aTotal = a.parts.reduce((sum, p) => sum + p.count, 0);
          const bTotal = b.parts.reduce((sum, p) => sum + p.count, 0);
          return bTotal - aTotal;
        })
        .slice(0, 10);
      
      setAnalysisData({
        totalCount: processedServices.length,
        completedCount: completedServices.length,
        uniqueSymptoms: symptomStats.length,
        uniqueSolutions: solutionStats.length,
        symptomStats: symptomStats.slice(0, 20), // 상위 20개
        solutionStats: solutionStats.slice(0, 20), // 상위 20개
        relationshipData: relationshipData.slice(0, 10), // 상위 10개 접수 내용
        productStats: productStats,
        productSymptomData: productSymptomData,
        mileageStats: mileageStats,
        mileageSymptomData: mileageSymptomData,
        partsStats: partsStats,
        partsSymptomData: partsSymptomData,
        partsSolutionData: partsSolutionData,
        tagStats: tagStats,
        tagSymptomData: tagSymptomData,
        tagSolutionData: tagSolutionData,
        tagProductData: tagProductData,
        tagPartsData: tagPartsData
      });
      
    } catch (error) {
      console.error('분석 데이터 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBrand, startDate, endDate, completedOnly, useAiNormalization, selectedModel]);

  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  // Ollama 모델 목록 가져오기
  useEffect(() => {
    const fetchOllamaModels = async () => {
      if (API_CONFIG.LOCAL_LLM.ENABLED) {
        try {
          const models = await getOllamaModels();
          setOllamaModels(models);
          
          // 저장된 모델이 목록에 없으면 기본 모델로 설정
          if (models.length > 0 && !models.find(m => m.name === selectedModel)) {
            const defaultModel = models[0].name;
            setSelectedModel(defaultModel);
            localStorage.setItem('selectedOllamaModel', defaultModel);
          }
        } catch (error) {
          console.error('Ollama 모델 목록 조회 실패:', error);
        }
      }
    };
    
    fetchOllamaModels();
  }, []);

  // 모델 변경 핸들러
  const handleModelChange = (event) => {
    const newModel = event.target.value;
    setSelectedModel(newModel);
    localStorage.setItem('selectedOllamaModel', newModel);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AnalyticsIcon /> A/S 접수-해결 분석
      </Typography>

      {/* 필터 섹션 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="브랜드"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="전체">전체</MenuItem>
              <MenuItem value="XRB">X-RIDER</MenuItem>
              <MenuItem value="NB">NEARBIKE</MenuItem>
            </TextField>
          </Grid>
          {API_CONFIG.LOCAL_LLM.ENABLED && ollamaModels.length > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="AI 모델"
                value={selectedModel}
                onChange={handleModelChange}
                fullWidth
                size="small"
                helperText="Ollama 모델 선택"
              >
                {ollamaModels.map((model) => (
                  <MenuItem key={model.name} value={model.name}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Typography variant="body2">{model.name}</Typography>
                      {model.details?.parameter_size && (
                        <Chip 
                          label={model.details.parameter_size} 
                          size="small" 
                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          <Grid item xs={12} sm={6} md={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
              <DatePicker
                label="시작일"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
                format="YYYY-MM-DD"
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
              <DatePicker
                label="종료일"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
                format="YYYY-MM-DD"
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={completedOnly}
                  onChange={(e) => setCompletedOnly(e.target.checked)}
                />
              }
              label="완료 건만 보기"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={useAiNormalization}
                  onChange={(e) => setUseAiNormalization(e.target.checked)}
                />
              }
              label="AI 정규화(기종/문의/해결)"
            />
            <Typography variant="caption" color="textSecondary">
              로컬 LLM을 이용해 라벨을 표준화합니다.
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {useAiNormalization && (aiNormalizationSamples.products.length > 0 || aiNormalizationSamples.symptoms.length > 0 || aiNormalizationSamples.solutions.length > 0) && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            AI 정규화 샘플
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>기종 매핑</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>원본</TableCell>
                      <TableCell>정규화</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aiNormalizationSamples.products.map((item, idx) => (
                      <TableRow key={`prod-${idx}`}>
                        <TableCell>{item.original}</TableCell>
                        <TableCell>{item.normalized}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>문의 내용 매핑</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>원본</TableCell>
                      <TableCell>정규화</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aiNormalizationSamples.symptoms.map((item, idx) => (
                      <TableRow key={`sym-${idx}`}>
                        <TableCell>{item.original}</TableCell>
                        <TableCell>{item.normalized}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>해결 방법 매핑</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>원본</TableCell>
                      <TableCell>정규화</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                    {aiNormalizationSamples.solutions.map((item, idx) => (
                      <TableRow key={`sol-${idx}`}>
                        <TableCell>{item.original}</TableCell>
                        <TableCell>{item.normalized}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <BuildIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                총 접수 건수
              </Typography>
              <Typography variant="h4">
                {analysisData.totalCount.toLocaleString()}건
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                완료 건수
              </Typography>
              <Typography variant="h4">
                {analysisData.completedCount.toLocaleString()}건
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <DescriptionIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                고유 접수 내용
              </Typography>
              <Typography variant="h4">
                {analysisData.uniqueSymptoms.toLocaleString()}개
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                <SettingsIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                고유 해결 방법
              </Typography>
              <Typography variant="h4">
                {analysisData.uniqueSolutions.toLocaleString()}개
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 탭 메뉴 */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="접수 내용 분석" />
          <Tab label="해결 방법 분석" />
          <Tab label="관계 분석" />
          <Tab label="기종별 분석" />
          <Tab label="거리별 분석" />
          <Tab label="부품별 분석" />
          <Tab label="태그별 분석" />
          <Tab label="AI 인사이트" />
          <Tab label="자연어 질의" />
          <Tab label="자동 리포트" />
          <Tab label="이상 패턴" />
        </Tabs>
      </Paper>

      {/* 접수 내용 분석 */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            접수 내용별 빈도 분석
          </Typography>
          
          {analysisData.symptomStats.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              분석할 데이터가 없습니다.
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 400, mb: 3 }}>
                <ResponsiveContainer>
                  <BarChart data={analysisData.symptomStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="text" 
                      angle={-45}
                      textAnchor="end"
                      height={120}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="건수" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>순위</TableCell>
                      <TableCell>접수 내용</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.symptomStats.map((stat, index) => (
                      <TableRow key={stat.text}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {stat.text}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{stat.count}건</TableCell>
                        <TableCell align="right">
                          {((stat.count / analysisData.totalCount) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Paper>
      )}

      {/* 해결 방법 분석 */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            해결 방법별 빈도 분석
          </Typography>
          
          {analysisData.solutionStats.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              완료된 건이 없어 분석할 데이터가 없습니다.
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 400, mb: 3 }}>
                <ResponsiveContainer>
                  <BarChart data={analysisData.solutionStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="text" 
                      angle={-45}
                      textAnchor="end"
                      height={120}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="건수" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>순위</TableCell>
                      <TableCell>해결 방법</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.solutionStats.map((stat, index) => (
                      <TableRow key={stat.text}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {stat.text}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{stat.count}건</TableCell>
                        <TableCell align="right">
                          {((stat.count / analysisData.completedCount) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Paper>
      )}

      {/* 관계 분석 */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            접수 내용 → 해결 방법 매핑 분석
          </Typography>
          
          {analysisData.relationshipData.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              완료된 건이 없어 분석할 데이터가 없습니다.
            </Typography>
          ) : (
            <Box>
              {analysisData.relationshipData.map((item, index) => {
                const totalCount = item.solutions.reduce((sum, s) => sum + s.count, 0);
                const chartData = item.solutions.slice(0, 5).map(s => ({
                  name: s.solution.length > 20 ? s.solution.substring(0, 20) + '...' : s.solution,
                  value: s.count
                }));
                
                return (
                  <Paper key={index} sx={{ p: 2, mb: 3, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                      {index + 1}. {item.symptom}
                      <Chip 
                        label={`총 ${totalCount}건`} 
                        size="small" 
                        sx={{ ml: 1 }} 
                        color="primary"
                      />
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ height: 250 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, value, percent }) => 
                                  `${name}: ${value}건 (${(percent * 100).toFixed(1)}%)`
                                }
                              >
                                {chartData.map((entry, idx) => (
                                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>해결 방법</TableCell>
                                <TableCell align="right">건수</TableCell>
                                <TableCell align="right">비율</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {item.solutions.map((solution, solIdx) => (
                                <TableRow key={solIdx}>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {solution.solution}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">{solution.count}건</TableCell>
                                  <TableCell align="right">
                                    {((solution.count / totalCount) * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Paper>
      )}

      {/* 기종별 분석 */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            기종별 접수 분석
          </Typography>
          
          {analysisData.productStats.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              분석할 데이터가 없습니다.
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 400, mb: 3 }}>
                <ResponsiveContainer>
                  <BarChart data={analysisData.productStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="product" 
                      angle={-45}
                      textAnchor="end"
                      height={120}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="건수" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>순위</TableCell>
                      <TableCell>기종</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.productStats.map((stat, index) => (
                      <TableRow key={stat.product}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{stat.product}</TableCell>
                        <TableCell align="right">{stat.count}건</TableCell>
                        <TableCell align="right">
                          {((stat.count / analysisData.totalCount) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                기종별 주요 접수 내용
              </Typography>
              {analysisData.productSymptomData.map((item, index) => {
                const totalCount = item.symptoms.reduce((sum, s) => sum + s.count, 0);
                return (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                      {item.product}
                      <Chip 
                        label={`총 ${totalCount}건`} 
                        size="small" 
                        sx={{ ml: 1 }} 
                        color="primary"
                      />
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>접수 내용</TableCell>
                            <TableCell align="right">건수</TableCell>
                            <TableCell align="right">비율</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {item.symptoms.map((symptom, symIdx) => (
                            <TableRow key={symIdx}>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {symptom.symptom}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{symptom.count}건</TableCell>
                              <TableCell align="right">
                                {((symptom.count / totalCount) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}
            </>
          )}
        </Paper>
      )}

      {/* 거리별 분석 */}
      {tabValue === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            거리별 접수 분석
          </Typography>
          
          {analysisData.mileageStats.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              분석할 데이터가 없습니다.
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 400, mb: 3 }}>
                <ResponsiveContainer>
                  <BarChart data={analysisData.mileageStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="range" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="건수" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>거리 구간</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.mileageStats.map((stat) => (
                      <TableRow key={stat.range}>
                        <TableCell>{stat.range}</TableCell>
                        <TableCell align="right">{stat.count}건</TableCell>
                        <TableCell align="right">
                          {((stat.count / analysisData.totalCount) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                거리 구간별 주요 접수 내용
              </Typography>
              {analysisData.mileageSymptomData.map((item, index) => {
                const totalCount = item.symptoms.reduce((sum, s) => sum + s.count, 0);
                return (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                      {item.range}
                      <Chip 
                        label={`총 ${totalCount}건`} 
                        size="small" 
                        sx={{ ml: 1 }} 
                        color="primary"
                      />
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>접수 내용</TableCell>
                            <TableCell align="right">건수</TableCell>
                            <TableCell align="right">비율</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {item.symptoms.map((symptom, symIdx) => (
                            <TableRow key={symIdx}>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {symptom.symptom}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{symptom.count}건</TableCell>
                              <TableCell align="right">
                                {((symptom.count / totalCount) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}
            </>
          )}
        </Paper>
      )}

      {/* 부품별 분석 */}
      {tabValue === 5 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            부품별 사용 분석
          </Typography>
          
          {analysisData.partsStats.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              사용된 부품 데이터가 없습니다.
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 400, mb: 3 }}>
                <ResponsiveContainer>
                  <BarChart data={analysisData.partsStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="part" 
                      angle={-45}
                      textAnchor="end"
                      height={120}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="사용 횟수" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>순위</TableCell>
                      <TableCell>부품명</TableCell>
                      <TableCell align="right">사용 횟수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.partsStats.map((stat, index) => (
                      <TableRow key={stat.part}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{stat.part}</TableCell>
                        <TableCell align="right">{stat.count}회</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                부품별 접수 내용 분석
              </Typography>
              {analysisData.partsSymptomData.map((item, index) => {
                const totalCount = item.symptoms.reduce((sum, s) => sum + s.count, 0);
                return (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                      {item.part}
                      <Chip 
                        label={`총 ${totalCount}건`} 
                        size="small" 
                        sx={{ ml: 1 }} 
                        color="primary"
                      />
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>접수 내용</TableCell>
                            <TableCell align="right">건수</TableCell>
                            <TableCell align="right">비율</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {item.symptoms.map((symptom, symIdx) => (
                            <TableRow key={symIdx}>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {symptom.symptom}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{symptom.count}건</TableCell>
                              <TableCell align="right">
                                {((symptom.count / totalCount) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}

              {analysisData.partsSolutionData.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                    부품별 해결 방법 분석
                  </Typography>
                  {analysisData.partsSolutionData.map((item, index) => {
                    const totalCount = item.solutions.reduce((sum, s) => sum + s.count, 0);
                    return (
                      <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                          {item.part}
                          <Chip 
                            label={`총 ${totalCount}건`} 
                            size="small" 
                            sx={{ ml: 1 }} 
                            color="primary"
                          />
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>해결 방법</TableCell>
                                <TableCell align="right">건수</TableCell>
                                <TableCell align="right">비율</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {item.solutions.map((solution, solIdx) => (
                                <TableRow key={solIdx}>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {solution.solution}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">{solution.count}건</TableCell>
                                  <TableCell align="right">
                                    {((solution.count / totalCount) * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    );
                  })}
                </>
              )}
            </>
          )}
        </Paper>
      )}

      {/* 태그별 분석 */}
      {tabValue === 6 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            태그별 분석
          </Typography>
          
          {analysisData.tagStats.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              태그 데이터가 없습니다.
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 400, mb: 3 }}>
                <ResponsiveContainer>
                  <BarChart data={analysisData.tagStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="tag" 
                      angle={-45}
                      textAnchor="end"
                      height={120}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="사용 횟수" fill="#8884D8" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>순위</TableCell>
                      <TableCell>태그</TableCell>
                      <TableCell align="right">사용 횟수</TableCell>
                      <TableCell align="right">비율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.tagStats.map((stat, index) => (
                      <TableRow key={stat.tag}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Chip label={stat.tag} size="small" color="primary" />
                        </TableCell>
                        <TableCell align="right">{stat.count}회</TableCell>
                        <TableCell align="right">
                          {((stat.count / analysisData.totalCount) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                태그별 접수 내용 분석
              </Typography>
              {analysisData.tagSymptomData.map((item, index) => {
                const totalCount = item.symptoms.reduce((sum, s) => sum + s.count, 0);
                return (
                  <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                      <Chip label={item.tag} size="small" color="primary" sx={{ mr: 1 }} />
                      <Chip 
                        label={`총 ${totalCount}건`} 
                        size="small" 
                        color="secondary"
                      />
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>접수 내용</TableCell>
                            <TableCell align="right">건수</TableCell>
                            <TableCell align="right">비율</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {item.symptoms.map((symptom, symIdx) => (
                            <TableRow key={symIdx}>
                              <TableCell>
                                <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {symptom.symptom}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{symptom.count}건</TableCell>
                              <TableCell align="right">
                                {((symptom.count / totalCount) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}

              {analysisData.tagSolutionData.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                    태그별 해결 방법 분석
                  </Typography>
                  {analysisData.tagSolutionData.map((item, index) => {
                    const totalCount = item.solutions.reduce((sum, s) => sum + s.count, 0);
                    return (
                      <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                          <Chip label={item.tag} size="small" color="primary" sx={{ mr: 1 }} />
                          <Chip 
                            label={`총 ${totalCount}건`} 
                            size="small" 
                            color="secondary"
                          />
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>해결 방법</TableCell>
                                <TableCell align="right">건수</TableCell>
                                <TableCell align="right">비율</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {item.solutions.map((solution, solIdx) => (
                                <TableRow key={solIdx}>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {solution.solution}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">{solution.count}건</TableCell>
                                  <TableCell align="right">
                                    {((solution.count / totalCount) * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    );
                  })}
                </>
              )}

              {analysisData.tagProductData.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                    태그별 기종 분석
                  </Typography>
                  {analysisData.tagProductData.map((item, index) => {
                    const totalCount = item.products.reduce((sum, p) => sum + p.count, 0);
                    return (
                      <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                          <Chip label={item.tag} size="small" color="primary" sx={{ mr: 1 }} />
                          <Chip 
                            label={`총 ${totalCount}건`} 
                            size="small" 
                            color="secondary"
                          />
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>기종</TableCell>
                                <TableCell align="right">건수</TableCell>
                                <TableCell align="right">비율</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {item.products.map((product, prodIdx) => (
                                <TableRow key={prodIdx}>
                                  <TableCell>{product.product}</TableCell>
                                  <TableCell align="right">{product.count}건</TableCell>
                                  <TableCell align="right">
                                    {((product.count / totalCount) * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    );
                  })}
                </>
              )}

              {analysisData.tagPartsData.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 4, mb: 2 }}>
                    태그별 부품 분석
                  </Typography>
                  {analysisData.tagPartsData.map((item, index) => {
                    const totalCount = item.parts.reduce((sum, p) => sum + p.count, 0);
                    return (
                      <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0' }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
                          <Chip label={item.tag} size="small" color="primary" sx={{ mr: 1 }} />
                          <Chip 
                            label={`총 ${totalCount}회`} 
                            size="small" 
                            color="secondary"
                          />
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>부품명</TableCell>
                                <TableCell align="right">사용 횟수</TableCell>
                                <TableCell align="right">비율</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {item.parts.map((part, partIdx) => (
                                <TableRow key={partIdx}>
                                  <TableCell>{part.part}</TableCell>
                                  <TableCell align="right">{part.count}회</TableCell>
                                  <TableCell align="right">
                                    {((part.count / totalCount) * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    );
                  })}
                </>
              )}
            </>
          )}
        </Paper>
      )}

      {/* AI 인사이트 */}
      {tabValue === 7 && (
        <AIInsights analysisData={analysisData} />
      )}

      {/* 자연어 질의 */}
      {tabValue === 8 && (
        <NaturalLanguageQuery analysisData={analysisData} />
      )}

      {/* 자동 리포트 */}
      {tabValue === 9 && (
        <AutoReport 
          analysisData={analysisData}
          filters={{
            selectedBrand,
            startDate,
            endDate,
            completedOnly
          }}
        />
      )}

      {/* 이상 패턴 탐지 */}
      {tabValue === 10 && (
        <AnomalyDetection analysisData={analysisData} />
      )}
    </Box>
  );
}

export default ServiceAnalysis;
