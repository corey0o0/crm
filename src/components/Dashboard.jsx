import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Stack,
  LinearProgress,
  Tabs,
  Tab,
  TextField,
  Container,
  IconButton,
  ButtonGroup,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  Build as BuildIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  LocalShipping as LocalShippingIcon,
  Close as CloseIcon,
  FormatBold as FormatBoldIcon,
  Highlight as HighlightIcon,
  FormatSize as FormatSizeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import ServiceCalendar from './ServiceCalendar';
import { sendTelegramNotification } from '../lib/telegram';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import SendIcon from '@mui/icons-material/Send';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, setUser } = useAuth();
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  
  // 메모 타입 (개인/공유)
  const [memoType, setMemoType] = useState('personal');
  
  // 개인 메모
  const [personalMemoList, setPersonalMemoList] = useState([
    { content: '', lastSaved: null, hasChanges: false, saving: false },
    { content: '', lastSaved: null, hasChanges: false, saving: false },
    { content: '', lastSaved: null, hasChanges: false, saving: false }
  ]);
  const [personalMemoNames, setPersonalMemoNames] = useState(['개인 메모 1', '개인 메모 2', '개인 메모 3']);
  
  // 공유 메모
  const [sharedMemoList, setSharedMemoList] = useState([
    { content: '', lastSaved: null, hasChanges: false, saving: false },
    { content: '', lastSaved: null, hasChanges: false, saving: false },
    { content: '', lastSaved: null, hasChanges: false, saving: false }
  ]);
  const [sharedMemoNames, setSharedMemoNames] = useState(['공유 메모 1', '공유 메모 2', '공유 메모 3']);
  
  // 현재 활성화된 메모 (useMemo로 최적화)
  const memoList = useMemo(() => {
    return memoType === 'personal' ? personalMemoList : sharedMemoList;
  }, [memoType, personalMemoList, sharedMemoList]);
  
  const memoNames = useMemo(() => {
    return memoType === 'personal' ? personalMemoNames : sharedMemoNames;
  }, [memoType, personalMemoNames, sharedMemoNames]);
  
  const [editingMemoName, setEditingMemoName] = useState(null);
  const [selectedMemoTab, setSelectedMemoTab] = useState(0);
  const [autoSaveTimers, setAutoSaveTimers] = useState([null, null, null]);
  const [memoFormats, setMemoFormats] = useState([
    { bold: false, highlight: false, fontSize: 'medium' },
    { bold: false, highlight: false, fontSize: 'medium' },
    { bold: false, highlight: false, fontSize: 'medium' }
  ]);
  const [selectedText, setSelectedText] = useState('');
  const [textSelection, setTextSelection] = useState({ start: 0, end: 0, memoIndex: -1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [telegramResult, setTelegramResult] = useState({ open: false, message: '', success: true });

  // 초기 사용자 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && !authLoading) {
          // 세션이 없는 경우 자동 로그인 시도
          const { data: { user: signInUser }, error: signInError } = await supabase.auth.signInWithPassword({
            email: localStorage.getItem('userEmail'),
            password: localStorage.getItem('userPassword')
          });

          if (signInError) throw signInError;
        }
      } catch (err) {
        console.error('세션 확인 중 오류:', err);
        setError(err.message);
      }
    };

    checkSession();
  }, [authLoading]);

  // 개인 메모 불러오기
  useEffect(() => {
    const fetchPersonalMemos = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = user?.id || session?.user?.id;
        
        if (!userId) {
          console.log('사용자 인증 대기 중...');
          return;
        }

        const { data: userMemo, error } = await supabase
          .from('user_memos')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('개인 메모 조회 오류:', error);
          return;
        }

        if (userMemo) {
          setPersonalMemoList([
            { content: userMemo.memo1 || '', lastSaved: userMemo.updated_at, hasChanges: false, saving: false },
            { content: userMemo.memo2 || '', lastSaved: userMemo.updated_at, hasChanges: false, saving: false },
            { content: userMemo.memo3 || '', lastSaved: userMemo.updated_at, hasChanges: false, saving: false }
          ]);
          setPersonalMemoNames([
            userMemo.memo_name_1 || '개인 메모 1',
            userMemo.memo_name_2 || '개인 메모 2', 
            userMemo.memo_name_3 || '개인 메모 3'
          ]);
        }
      } catch (err) {
        console.error('개인 메모 불러오기 오류:', err);
      }
    };

    fetchPersonalMemos();

    const userId = user?.id;
    if (userId) {
      const channel = supabase
        .channel('user_memos_changes')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_memos',
            filter: `user_id=eq.${userId}`
          },
          payload => {
            if (payload.new) {
              setPersonalMemoList(prev => [
                { ...prev[0], content: payload.new.memo1 || '', lastSaved: payload.new.updated_at, hasChanges: false },
                { ...prev[1], content: payload.new.memo2 || '', lastSaved: payload.new.updated_at, hasChanges: false },
                { ...prev[2], content: payload.new.memo3 || '', lastSaved: payload.new.updated_at, hasChanges: false }
              ]);
              setPersonalMemoNames([
                payload.new.memo_name_1 || '개인 메모 1',
                payload.new.memo_name_2 || '개인 메모 2',
                payload.new.memo_name_3 || '개인 메모 3'
              ]);
            }
          }
        )
        .subscribe();

      return () => channel.unsubscribe();
    }
  }, [user]);

  // 공유 메모 불러오기
  useEffect(() => {
    const fetchSharedMemos = async () => {
      try {
        console.log('공유 메모 불러오기 시작...');
        
        const { data: sharedMemo, error } = await supabase
          .from('shared_memos')
          .select('*')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('공유 메모 조회 오류:', error);
          return;
        }

        if (sharedMemo) {
          console.log('공유 메모 데이터:', sharedMemo);
          setSharedMemoList([
            { content: sharedMemo.memo1 || '', lastSaved: sharedMemo.updated_at, hasChanges: false, saving: false },
            { content: sharedMemo.memo2 || '', lastSaved: sharedMemo.updated_at, hasChanges: false, saving: false },
            { content: sharedMemo.memo3 || '', lastSaved: sharedMemo.updated_at, hasChanges: false, saving: false }
          ]);
          setSharedMemoNames([
            sharedMemo.memo_name_1 || '공유 메모 1',
            sharedMemo.memo_name_2 || '공유 메모 2', 
            sharedMemo.memo_name_3 || '공유 메모 3'
          ]);
        } else {
          // 공유 메모가 없으면 초기 레코드 생성
          console.log('공유 메모가 없어서 초기 레코드 생성 중...');
          const { data: newMemo, error: insertError } = await supabase
            .from('shared_memos')
            .insert([{
              memo1: '',
              memo2: '',
              memo3: '',
              memo_name_1: '공유 메모 1',
              memo_name_2: '공유 메모 2',
              memo_name_3: '공유 메모 3'
            }])
            .select()
            .single();

          if (insertError) {
            console.error('공유 메모 초기 레코드 생성 오류:', insertError);
          } else {
            console.log('공유 메모 초기 레코드 생성 완료');
          }
        }
      } catch (err) {
        console.error('공유 메모 불러오기 오류:', err);
      }
    };

    fetchSharedMemos();

    const channel = supabase
      .channel('shared_memos_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_memos'
        },
        payload => {
          if (payload.new) {
            setSharedMemoList(prev => [
              { ...prev[0], content: payload.new.memo1 || '', lastSaved: payload.new.updated_at, hasChanges: false },
              { ...prev[1], content: payload.new.memo2 || '', lastSaved: payload.new.updated_at, hasChanges: false },
              { ...prev[2], content: payload.new.memo3 || '', lastSaved: payload.new.updated_at, hasChanges: false }
            ]);
            setSharedMemoNames([
              payload.new.memo_name_1 || '공유 메모 1',
              payload.new.memo_name_2 || '공유 메모 2',
              payload.new.memo_name_3 || '공유 메모 3'
            ]);
          }
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [user]);


  
  // 메모 내용 변경
  const handleMemoContentChange = (idx, value) => {
    // 타입에 따라 다른 state 업데이트
    if (memoType === 'personal') {
      setPersonalMemoList(prev => prev.map((m, i) => 
        i === idx ? { ...m, content: value, hasChanges: true } : m
      ));
    } else {
      setSharedMemoList(prev => prev.map((m, i) => 
        i === idx ? { ...m, content: value, hasChanges: true } : m
      ));
    }

    // 로컬 스토리지에 임시 저장
    const tempKey = `temp_${memoType}_memo_${idx}`;
    localStorage.setItem(tempKey, value);

    // 기존 자동 저장 타이머 해제
    if (autoSaveTimers[idx]) {
      clearTimeout(autoSaveTimers[idx]);
    }

    // 3초 후 자동 저장 설정
    const newTimer = setTimeout(() => {
      handleAutoSave(idx);
    }, 3000);

    setAutoSaveTimers(prev => prev.map((timer, i) => i === idx ? newTimer : timer));
  };

  // 자동 저장 함수
  const handleAutoSave = async (idx) => {
    if (!user?.id) return;
    
    try {
      // 저장 중 상태 설정
      if (memoType === 'personal') {
        setPersonalMemoList(prev => prev.map((m, i) => 
          i === idx ? { ...m, saving: true } : m
        ));
      } else {
        setSharedMemoList(prev => prev.map((m, i) => 
          i === idx ? { ...m, saving: true } : m
        ));
      }

      const now = new Date().toISOString();
      
      // 로컬 스토리지에서 최신 값 가져오기
      const memo1Content = localStorage.getItem(`temp_${memoType}_memo_0`) || memoList[0]?.content || '';
      const memo2Content = localStorage.getItem(`temp_${memoType}_memo_1`) || memoList[1]?.content || '';
      const memo3Content = localStorage.getItem(`temp_${memoType}_memo_2`) || memoList[2]?.content || '';
      
      if (memoType === 'personal') {
        // 개인 메모 저장
        const { error } = await supabase
          .from('user_memos')
          .upsert({
            user_id: user.id,
            memo1: memo1Content,
            memo2: memo2Content,
            memo3: memo3Content
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
        
        setPersonalMemoList(prev => prev.map((m, i) => 
          i === idx ? { ...m, lastSaved: now, hasChanges: false, saving: false } : m
        ));
      } else {
        // 공유 메모 저장
        const { data: existingMemo } = await supabase
          .from('shared_memos')
          .select('id')
          .maybeSingle();

        if (existingMemo) {
          const { error } = await supabase
            .from('shared_memos')
            .update({
              memo1: memo1Content,
              memo2: memo2Content,
              memo3: memo3Content
            })
            .eq('id', existingMemo.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('shared_memos')
            .insert({
              memo1: memo1Content,
              memo2: memo2Content,
              memo3: memo3Content
            });

          if (error) throw error;
        }
        
        setSharedMemoList(prev => prev.map((m, i) => 
          i === idx ? { ...m, lastSaved: now, hasChanges: false, saving: false } : m
        ));
      }

      // 임시 저장 데이터 제거
      localStorage.removeItem(`temp_${memoType}_memo_0`);
      localStorage.removeItem(`temp_${memoType}_memo_1`);
      localStorage.removeItem(`temp_${memoType}_memo_2`);

      console.log(`${memoType} 메모 저장 완료`);

    } catch (error) {
      console.error('자동 저장 오류:', error);
      if (memoType === 'personal') {
        setPersonalMemoList(prev => prev.map((m, i) => 
          i === idx ? { ...m, saving: false } : m
        ));
      } else {
        setSharedMemoList(prev => prev.map((m, i) => 
          i === idx ? { ...m, saving: false } : m
        ));
      }
    }
  };

  // 수동 저장 함수
  const handleSaveMemo = async (idx) => {
    try {
      // 자동 저장 타이머 해제
      if (autoSaveTimers[idx]) {
        clearTimeout(autoSaveTimers[idx]);
        setAutoSaveTimers(prev => prev.map((timer, i) => i === idx ? null : timer));
      }

      // 수동 저장 실행
      await handleAutoSave(idx);
      
      setTelegramResult({ 
        open: true, 
        message: `${memoNames[idx]} 저장이 완료되었습니다.`, 
        success: true 
      });
    } catch (error) {
      console.error('수동 저장 오류:', error);
      setTelegramResult({ 
        open: true, 
        message: '저장 중 오류가 발생했습니다.', 
        success: false 
      });
    }
  };


  // 폰트 사이즈 변경
  const handleFontSize = (memoIndex, fontSize) => {
    const newFormats = [...memoFormats];
    newFormats[memoIndex] = { ...newFormats[memoIndex], fontSize };
    setMemoFormats(newFormats);
  };

  // Quill 에디터 설정
  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'background': ['yellow', 'lightblue', 'lightgreen'] }],
      [{ 'size': ['small', false, 'large'] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  const quillFormats = [
    'bold', 'italic', 'underline', 'background', 'size',
    'list', 'bullet'
  ];


  // Quill 에디터 참조를 위한 ref 배열
  const [quillRefs, setQuillRefs] = useState([
    React.createRef(),
    React.createRef(), 
    React.createRef()
  ]);

  // 새 메모 추가
  const handleAddMemo = () => {
    if (memoList.length >= 5) return; // 최대 5개 제한
    if (memoType === 'personal') {
      setPersonalMemoList(prev => [...prev, { content: '', lastSaved: null, hasChanges: false, saving: false }]);
    } else {
      setSharedMemoList(prev => [...prev, { content: '', lastSaved: null, hasChanges: false, saving: false }]);
    }
    setSelectedMemoTab(memoList.length);
  };

  // 메모 삭제
  const handleDeleteMemo = (idx) => {
    if (memoList.length <= 2) return; // 최소 2개 보장
    if (memoType === 'personal') {
      setPersonalMemoList(prev => prev.filter((_, i) => i !== idx));
    } else {
      setSharedMemoList(prev => prev.filter((_, i) => i !== idx));
    }
    setSelectedMemoTab(0);
  };

  // 메모 탭 변경
  const handleMemoTabChange = (event, newValue) => setSelectedMemoTab(newValue);

  // 메모 이름 편집 시작
  const handleMemoNameEdit = (index) => {
    setEditingMemoName(index);
  };

  // 메모 이름 변경
  const handleMemoNameChange = (index, newName) => {
    if (memoType === 'personal') {
      setPersonalMemoNames(prev => prev.map((name, i) => i === index ? newName : name));
    } else {
      setSharedMemoNames(prev => prev.map((name, i) => i === index ? newName : name));
    }
  };

  // 메모 이름 편집 완료
  const handleMemoNameEditComplete = async (index) => {
    setEditingMemoName(null);
    await saveMemoNames();
  };

  // 메모 이름 저장
  const saveMemoNames = async () => {
    if (!user?.id) return;
    
    try {
      if (memoType === 'personal') {
        // 개인 메모 이름 저장
        const { error } = await supabase
          .from('user_memos')
          .upsert({
            user_id: user.id,
            memo_name_1: personalMemoNames[0],
            memo_name_2: personalMemoNames[1], 
            memo_name_3: personalMemoNames[2]
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          console.error('개인 메모 이름 저장 오류:', error);
        }
      } else {
        // 공유 메모 이름 저장
        const { data: existingMemo } = await supabase
          .from('shared_memos')
          .select('id')
          .maybeSingle();

        if (existingMemo) {
          const { error } = await supabase
            .from('shared_memos')
            .update({
              memo_name_1: sharedMemoNames[0],
              memo_name_2: sharedMemoNames[1], 
              memo_name_3: sharedMemoNames[2]
            })
            .eq('id', existingMemo.id);

          if (error) {
            console.error('공유 메모 이름 저장 오류:', error);
          }
        }
      }
    } catch (err) {
      console.error('메모 이름 저장 오류:', err);
    }
  };

  // 상태별 색상 정의
  const statusColors = {
    '접수': '#3182f6',
    '처리중': '#ffa927',
    '부분완료': '#4e5968',
    '완료': '#00c773'
  };

  // 데이터 가져오기
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Supabase 연결 테스트
      console.log('Supabase URL:', process.env.REACT_APP_SUPABASE_URL);
      console.log('Supabase 연결 시작...');

      // Abort + timeout (12s) 공통 컨트롤러
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // 1. 서비스 데이터 가져오기
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('reception_date', { ascending: false })
        .abortSignal(controller.signal);

      if (servicesError) {
        console.error('서비스 데이터 조회 오류:', servicesError);
        console.error('오류 상세:', {
          message: servicesError.message,
          details: servicesError.details,
          hint: servicesError.hint,
          code: servicesError.code
        });
        throw new Error('서비스 데이터를 불러오는데 실패했습니다.');
      }

      console.log('서비스 데이터 조회 성공:', services?.length, '건');

      // 2. 출고 데이터 가져오기
      let shipments = [];
      try {
        const { data: shipmentsData, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal);

        if (shipmentsError) {
          console.error('출고 데이터 조회 오류:', shipmentsError);
          throw new Error(`출고 데이터를 불러오는데 실패했습니다: ${shipmentsError.message}`);
        }

        if (!shipmentsData) {
          console.warn('출고 데이터가 없습니다.');
          shipments = [];
        } else {
          shipments = shipmentsData;
        }
      } catch (shipmentError) {
        console.error('출고 데이터 처리 중 오류:', shipmentError);
        throw new Error('출고 데이터 처리 중 오류가 발생했습니다.');
      }

      // 3. 최근 서비스 데이터 가져오기
      const { data: recentServices, error: recentServicesError } = await supabase
        .from('services')
        .select(`
          id,
          customer_name,
          product_name,
          status,
          reception_date,
          brand
        `)
        .order('reception_date', { ascending: false })
        .abortSignal(controller.signal);

      if (recentServicesError) {
        console.error('최근 서비스 데이터 조회 오류:', recentServicesError);
        throw new Error('최근 서비스 데이터를 불러오는데 실패했습니다.');
      }

      // 타임아웃 해제
      clearTimeout(timeoutId);


      // 안전한 데이터 처리를 위한 기본값 설정
      const safeServices = services || [];
      const safeShipments = shipments || [];
      const safeRecentServices = recentServices || [];

      // 고객 수 계산
      const uniqueCustomers = [...new Set(safeServices.map(service => service.customer_phone))];
      const totalCustomers = uniqueCustomers.length;

      // 날짜 기준 설정
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 이번 달 서비스 데이터 필터링
      const monthlyServices = safeServices.filter(service => 
        new Date(service.reception_date) >= startOfMonth
      );


      // 삭제된 현황 섹션들과 관련된 데이터 처리 완료

    } catch (err) {
      console.error('[Dashboard] 데이터 로딩 오류:', err);
      if (err?.name === 'AbortError') {
        setError('요청이 시간 초과로 취소되었습니다. 다시 시도해주세요.');
      } else {
        const msg = String(err?.message || '');
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setError('네트워크 연결 문제가 발생했습니다. 브라우저 연결이 유휴 상태였다면 페이지를 새로고침해주세요.');
        } else {
          setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // 포커스/가시성 복귀 시 재요청
    const onFocus = () => { if (!loading) fetchDashboardData(); };
    const onVisibility = () => { if (document.visibilityState === 'visible' && !loading) fetchDashboardData(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);


  const handleBrandChange = (event, newValue) => {
    setSelectedBrand(newValue);
  };




  const handleSendMemoToTelegram = async (idx) => {
    const content = memoList[idx]?.content?.trim();
    if (!content) {
      setTelegramResult({ open: true, message: '메모 내용이 비어 있습니다.', success: false });
      return;
    }
    try {
      const memoName = memoNames[idx] || `메모 ${idx + 1}`;
      const message = `[${memoName}]\n${content}`;
      await sendTelegramNotification(message);
      setTelegramResult({ open: true, message: '텔레그램 전송 성공!', success: true });
    } catch (e) {
      setTelegramResult({ open: true, message: '텔레그램 전송 실패', success: false });
    }
  };






  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          startIcon={<RefreshIcon />} 
          onClick={fetchDashboardData}
          sx={{ mt: 2 }}
        >
          다시 시도
        </Button>
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ mt: 3 }}>
    <Box sx={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        width: '100%',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
          대시보드
        </Typography>
        <Button 
          startIcon={<RefreshIcon />} 
          onClick={fetchDashboardData}
          size="small"
          sx={{ 
            color: 'primary.main',
            bgcolor: 'primary.light',
            '&:hover': { bgcolor: 'primary.light', opacity: 0.9 },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          새로고침
        </Button>
      </Box>


      {/* 메모 타입 선택 */}
      <Box sx={{ mb: 2 }}>
        <Tabs 
          value={memoType} 
          onChange={(e, newValue) => setMemoType(newValue)}
          sx={{
            minHeight: '40px',
            '& .MuiTab-root': {
              minHeight: '40px',
              py: 1,
              fontWeight: 600
            }
          }}
        >
          <Tab 
            label="개인 메모 (나만 보기)" 
            value="personal"
            icon={<Chip label="개인" size="small" color="primary" sx={{ ml: 1 }} />}
            iconPosition="end"
          />
          <Tab 
            label="공유 메모 (전체 공유)" 
            value="shared"
            icon={<Chip label="공유" size="small" color="success" sx={{ ml: 1 }} />}
            iconPosition="end"
          />
        </Tabs>
      </Box>

      {/* 메모 섹션 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 메모 1과 메모 3 탭 */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', border: '1px solid #e9ecef', minHeight: '200px' }}>
            <Tabs value={selectedMemoTab} onChange={handleMemoTabChange} variant="scrollable" scrollButtons="auto">
              <Tab label={memoNames[0]} />
              <Tab label={memoNames[2]} />
            </Tabs>
            
            {/* 메모 1 내용 */}
            {selectedMemoTab === 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {editingMemoName === 0 ? (
                    <TextField
                      size="small"
                      value={memoNames[0]}
                      onChange={(e) => handleMemoNameChange(0, e.target.value)}
                      onBlur={() => handleMemoNameEditComplete(0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleMemoNameEditComplete(0);
                        } else if (e.key === 'Escape') {
                          setEditingMemoName(null);
                        }
                      }}
                      sx={{ 
                        width: '120px', 
                        '& .MuiInputBase-input': { 
                          fontSize: '0.875rem', 
                          fontWeight: 600,
                          padding: '4px 8px',
                          color: '#4e5968'
                        } 
                      }}
                      autoFocus
                    />
                  ) : (
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        color: '#4e5968', 
                        fontSize: '0.875rem', 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', borderRadius: '4px', padding: '2px 4px' }
                      }}
                      onClick={() => handleMemoNameEdit(0)}
                    >
                      {memoNames[0]}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {memoList[0]?.saving && (
                      <Typography variant="caption" sx={{ color: '#ffa927', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CircularProgress size={12} />
                        저장 중...
                      </Typography>
                    )}
                    {!memoList[0]?.saving && memoList[0]?.hasChanges && (
                      <Typography variant="caption" sx={{ color: '#ff6b6b', fontSize: '0.75rem' }}>
                        • 저장되지 않은 변경사항
                      </Typography>
                    )}
                    {!memoList[0]?.saving && !memoList[0]?.hasChanges && memoList[0]?.lastSaved && (
                      <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.75rem' }}>
                        마지막 저장: {dayjs(memoList[0].lastSaved).locale('ko').format('YYYY.MM.DD HH:mm')}
                      </Typography>
                    )}
                    <Tooltip title="이 메모를 텔레그램으로 전송">
                      <IconButton onClick={() => handleSendMemoToTelegram(0)} size="small">
                        <SendIcon fontSize="small" color="primary" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                {/* ReactQuill 에디터 */}
                <Box sx={{ 
                  '& .ql-editor': {
                    minHeight: '100px',
                    fontSize: memoFormats[0]?.fontSize === 'large' ? '1.2rem' : 
                             memoFormats[0]?.fontSize === 'small' ? '0.8rem' : '0.875rem',
                  },
                  '& .ql-toolbar': {
                    borderTop: '1px solid #ccc',
                    borderLeft: '1px solid #ccc',
                    borderRight: '1px solid #ccc',
                  },
                  '& .ql-container': {
                    borderBottom: '1px solid #ccc',
                    borderLeft: '1px solid #ccc',
                    borderRight: '1px solid #ccc',
                  }
                }}>
                  <ReactQuill
                    key={`${memoType}-memo-0`}
                    ref={quillRefs[0]}
                    theme="snow"
                    value={memoList[0]?.content || ''}
                    onChange={(content) => handleMemoContentChange(0, content)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="메모를 입력하세요..."
                  />
                </Box>
                <Button
                  variant="contained"
                  onClick={() => handleSaveMemo(0)}
                  sx={{ bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, alignSelf: 'flex-end' }}
                >
                  저장
                </Button>
              </Box>
            )}
            
            {/* 메모 3 내용 */}
            {selectedMemoTab === 1 && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {editingMemoName === 2 ? (
                    <TextField
                      size="small"
                      value={memoNames[2]}
                      onChange={(e) => handleMemoNameChange(2, e.target.value)}
                      onBlur={() => handleMemoNameEditComplete(2)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleMemoNameEditComplete(2);
                        } else if (e.key === 'Escape') {
                          setEditingMemoName(null);
                        }
                      }}
                      sx={{ 
                        width: '120px', 
                        '& .MuiInputBase-input': { 
                          fontSize: '0.875rem', 
                          fontWeight: 600,
                          padding: '4px 8px',
                          color: '#4e5968'
                        } 
                      }}
                      autoFocus
                    />
                  ) : (
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        color: '#4e5968', 
                        fontSize: '0.875rem', 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', borderRadius: '4px', padding: '2px 4px' }
                      }}
                      onClick={() => handleMemoNameEdit(2)}
                    >
                      {memoNames[2]}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {memoList[2]?.saving && (
                      <Typography variant="caption" sx={{ color: '#ffa927', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CircularProgress size={12} />
                        저장 중...
                      </Typography>
                    )}
                    {!memoList[2]?.saving && memoList[2]?.hasChanges && (
                      <Typography variant="caption" sx={{ color: '#ff6b6b', fontSize: '0.75rem' }}>
                        • 저장되지 않은 변경사항
                      </Typography>
                    )}
                    {!memoList[2]?.saving && !memoList[2]?.hasChanges && memoList[2]?.lastSaved && (
                      <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.75rem' }}>
                        마지막 저장: {dayjs(memoList[2].lastSaved).locale('ko').format('YYYY.MM.DD HH:mm')}
                      </Typography>
                    )}
                    <Tooltip title="이 메모를 텔레그램으로 전송">
                      <IconButton onClick={() => handleSendMemoToTelegram(2)} size="small">
                        <SendIcon fontSize="small" color="primary" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                {/* ReactQuill 에디터 */}
                <Box sx={{ 
                  '& .ql-editor': {
                    minHeight: '100px',
                    fontSize: memoFormats[2]?.fontSize === 'large' ? '1.2rem' : 
                             memoFormats[2]?.fontSize === 'small' ? '0.8rem' : '0.875rem',
                  },
                  '& .ql-toolbar': {
                    borderTop: '1px solid #ccc',
                    borderLeft: '1px solid #ccc',
                    borderRight: '1px solid #ccc',
                  },
                  '& .ql-container': {
                    borderBottom: '1px solid #ccc',
                    borderLeft: '1px solid #ccc',
                    borderRight: '1px solid #ccc',
                  }
                }}>
                  <ReactQuill
                    key={`${memoType}-memo-2`}
                    ref={quillRefs[2]}
                    theme="snow"
                    value={memoList[2]?.content || ''}
                    onChange={(content) => handleMemoContentChange(2, content)}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="메모를 입력하세요..."
                  />
                </Box>
                <Button
                  variant="contained"
                  onClick={() => handleSaveMemo(2)}
                  sx={{ bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, alignSelf: 'flex-end' }}
                >
                  저장
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
        {/* 메모 2 */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', border: '1px solid #e9ecef', minHeight: '200px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {editingMemoName === 1 ? (
                <TextField
                  size="small"
                  value={memoNames[1]}
                  onChange={(e) => handleMemoNameChange(1, e.target.value)}
                  onBlur={() => handleMemoNameEditComplete(1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleMemoNameEditComplete(1);
                    } else if (e.key === 'Escape') {
                      setEditingMemoName(null);
                    }
                  }}
                  sx={{ 
                    width: '120px', 
                    '& .MuiInputBase-input': { 
                      fontSize: '0.875rem', 
                      fontWeight: 600,
                      padding: '4px 8px',
                      color: '#4e5968'
                    } 
                  }}
                  autoFocus
                />
              ) : (
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    color: '#4e5968', 
                    fontSize: '0.875rem', 
                    fontWeight: 600, 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', borderRadius: '4px', padding: '2px 4px' }
                  }}
                  onClick={() => handleMemoNameEdit(1)}
                >
                  {memoNames[1]}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {memoList[1]?.saving && (
                  <Typography variant="caption" sx={{ color: '#ffa927', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CircularProgress size={12} />
                    저장 중...
                  </Typography>
                )}
                {!memoList[1]?.saving && memoList[1]?.hasChanges && (
                  <Typography variant="caption" sx={{ color: '#ff6b6b', fontSize: '0.75rem' }}>
                    • 저장되지 않은 변경사항
                  </Typography>
                )}
                {!memoList[1]?.saving && !memoList[1]?.hasChanges && memoList[1]?.lastSaved && (
                  <Typography variant="caption" sx={{ color: '#868e96', fontSize: '0.75rem' }}>
                    마지막 저장: {dayjs(memoList[1].lastSaved).locale('ko').format('YYYY.MM.DD HH:mm')}
                  </Typography>
                )}
                <Tooltip title="이 메모를 텔레그램으로 전송">
                  <IconButton onClick={() => handleSendMemoToTelegram(1)} size="small">
                    <SendIcon fontSize="small" color="primary" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* ReactQuill 에디터 */}
            <Box sx={{ 
              '& .ql-editor': {
                minHeight: '100px',
                fontSize: memoFormats[1]?.fontSize === 'large' ? '1.2rem' : 
                         memoFormats[1]?.fontSize === 'small' ? '0.8rem' : '0.875rem',
              },
              '& .ql-toolbar': {
                borderTop: '1px solid #ccc',
                borderLeft: '1px solid #ccc',
                borderRight: '1px solid #ccc',
              },
              '& .ql-container': {
                borderBottom: '1px solid #ccc',
                borderLeft: '1px solid #ccc',
                borderRight: '1px solid #ccc',
              }
            }}>
              <ReactQuill
                key={`${memoType}-memo-1`}
                ref={quillRefs[1]}
                theme="snow"
                value={memoList[1]?.content || ''}
                onChange={(content) => handleMemoContentChange(1, content)}
                modules={quillModules}
                formats={quillFormats}
                placeholder="메모를 입력하세요..."
              />
            </Box>
            <Button
              variant="contained"
              onClick={() => handleSaveMemo(1)}
              sx={{ bgcolor: '#3182f6', '&:hover': { bgcolor: '#1b64da' }, alignSelf: 'flex-end', mt: 2 }}
            >
              저장
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* 캘린더 섹션 */}
      <Box sx={{ mb: 4 }}>
        <ServiceCalendar />
      </Box>


    </Box>
    

    <Snackbar
      open={telegramResult.open}
      autoHideDuration={2500}
      onClose={() => setTelegramResult(r => ({ ...r, open: false }))}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <MuiAlert
        onClose={() => setTelegramResult(r => ({ ...r, open: false }))}
        severity={telegramResult.success ? 'success' : 'error'}
        sx={{ width: '100%' }}
        elevation={6}
        variant="filled"
      >
        {telegramResult.message}
      </MuiAlert>
    </Snackbar>
    </Container>
  );
}

export default Dashboard; 