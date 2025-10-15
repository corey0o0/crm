import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  Typography,
  Paper,
  Grid,
  Box,
  CircularProgress,
  Alert,
  Button,
  Tabs,
  Tab,
  TextField,
  IconButton,
  Container,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import ServiceCalendar from './ServiceCalendar';
import { sendTelegramNotification } from '../lib/telegram';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import SendIcon from '@mui/icons-material/Send';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
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
  
  // Quill 에디터 참조를 위한 ref 배열
  const quillRefs = [
    React.createRef(),
    React.createRef(), 
    React.createRef()
  ];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [telegramResult, setTelegramResult] = useState({ open: false, message: '', success: true });

  // 초기 사용자 세션 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && !authLoading) {
          // 세션이 없는 경우 자동 로그인 시도
          const { error: signInError } = await supabase.auth.signInWithPassword({
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
          logger.error('개인 메모 조회 오류:', error);
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
        logger.error('개인 메모 불러오기 오류:', err);
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
        logger.debug('공유 메모 불러오기 시작...');
        
        const { data: sharedMemo, error } = await supabase
          .from('shared_memos')
          .select('*')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          logger.error('공유 메모 조회 오류:', error);
          return;
        }

        if (sharedMemo) {
          logger.debug('공유 메모 데이터:', sharedMemo);
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
          logger.info('공유 메모가 없어서 초기 레코드 생성 중...');
          const { error: insertError } = await supabase
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
            logger.error('공유 메모 초기 레코드 생성 오류:', insertError);
          } else {
            logger.info('공유 메모 초기 레코드 생성 완료');
          }
        }
      } catch (err) {
        logger.error('공유 메모 불러오기 오류:', err);
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

      logger.debug(`${memoType} 메모 저장 완료`);

    } catch (error) {
      logger.error('자동 저장 오류:', error);
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
          logger.error('개인 메모 이름 저장 오류:', error);
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
            logger.error('공유 메모 이름 저장 오류:', error);
          }
        }
      }
    } catch (err) {
      logger.error('메모 이름 저장 오류:', err);
    }
  };


  // 데이터 가져오기
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 타임아웃 설정 (30초)
      const timeoutId = setTimeout(() => {
        logger.warn('데이터 로딩 타임아웃 (30초)');
        setError('데이터 로딩 시간이 초과되었습니다. 페이지를 새로고침해주세요.');
        setLoading(false);
      }, 30000);

      // Supabase 연결 테스트
      logger.debug('Supabase URL:', process.env.REACT_APP_SUPABASE_URL);
      logger.debug('Supabase 연결 시작...');

      // 1. 서비스 데이터 가져오기 (재시도 로직 포함)
      let services = [];
      let servicesError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.debug(`서비스 데이터 조회 시도 ${attempt}/3`);
          const result = await supabase
            .from('services')
            .select('*')
            .order('reception_date', { ascending: false });
          
          services = result.data;
          servicesError = result.error;
          
          if (!servicesError) {
            logger.info('서비스 데이터 조회 성공:', services?.length, '건');
            break;
          }
          
          if (attempt < 3) {
            logger.warn(`서비스 데이터 조회 실패 (시도 ${attempt}/3), 재시도 중...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        } catch (fetchError) {
          logger.error(`서비스 데이터 조회 네트워크 오류 (시도 ${attempt}/3):`, fetchError);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          } else {
            throw new Error('네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.');
          }
        }
      }

      if (servicesError) {
        logger.error('서비스 데이터 조회 오류:', servicesError);
        logger.error('오류 상세:', {
          message: servicesError.message,
          details: servicesError.details,
          hint: servicesError.hint,
          code: servicesError.code
        });
        throw new Error('서비스 데이터를 불러오는데 실패했습니다.');
      }

      logger.info('서비스 데이터 조회 성공:', services?.length, '건');

      // 2. 출고 데이터 가져오기 (재시도 로직 포함)
      let shipments = [];
      let shipmentsError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.debug(`출고 데이터 조회 시도 ${attempt}/3`);
          const result = await supabase
            .from('shipments')
            .select('*')
            .order('created_at', { ascending: false });
          
          shipments = result.data || [];
          shipmentsError = result.error;
          
          if (!shipmentsError) {
            logger.info('출고 데이터 조회 성공:', shipments?.length, '건');
            break;
          }
          
          if (attempt < 3) {
            logger.warn(`출고 데이터 조회 실패 (시도 ${attempt}/3), 재시도 중...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        } catch (fetchError) {
          logger.error(`출고 데이터 조회 네트워크 오류 (시도 ${attempt}/3):`, fetchError);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          } else {
            logger.warn('출고 데이터 조회 실패, 빈 배열로 설정');
            shipments = [];
            break;
          }
        }
      }

      if (shipmentsError) {
        logger.error('출고 데이터 조회 오류:', shipmentsError);
        shipments = []; // 오류 시 빈 배열로 설정
      }

      // 3. 최근 서비스 데이터 가져오기
      const { error: recentServicesError } = await supabase
        .from('services')
        .select(`
          id,
          customer_name,
          product_name,
          status,
          reception_date,
          brand
        `)
        .order('reception_date', { ascending: false });

      if (recentServicesError) {
        console.error('최근 서비스 데이터 조회 오류:', recentServicesError);
        throw new Error('최근 서비스 데이터를 불러오는데 실패했습니다.');
      }




      // 삭제된 현황 섹션들과 관련된 데이터 처리 완료
      
      // 타임아웃 클리어
      clearTimeout(timeoutId);
      setIsDataLoaded(true);
      logger.info('대시보드 데이터 로딩 완료');

    } catch (err) {
      logger.error('대시보드 데이터 로딩 오류:', err);
      
      // 네트워크 오류인지 확인
      if (err.message.includes('Failed to fetch') || err.message.includes('ERR_QUIC_PROTOCOL_ERROR')) {
        setError('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
      } else if (err.message.includes('timeout')) {
        setError('데이터 로딩 시간이 초과되었습니다. 페이지를 새로고침해주세요.');
      } else {
        setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      }
      
      // 에러 발생 시 기본 상태 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 데이터가 이미 로드되었으면 다시 로드하지 않음
    if (!isDataLoaded) {
      fetchDashboardData();
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      // 타임아웃 정리 (필요시)
    };
  }, [isDataLoaded, fetchDashboardData]);






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
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '70vh',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          대시보드 데이터를 불러오는 중...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          잠시만 기다려주세요
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '70vh',
        gap: 3,
        p: 4
      }}>
        <Alert severity="error" sx={{ width: '100%', maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            데이터 로딩 실패
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button 
            variant="contained"
            startIcon={<RefreshIcon />} 
            onClick={fetchDashboardData}
            size="large"
          >
            다시 시도
          </Button>
          
          <Button 
            variant="outlined"
            onClick={() => window.location.reload()}
            size="large"
          >
            페이지 새로고침
          </Button>
          
          {error.includes('네트워크') && (
            <Button 
              variant="outlined"
              onClick={() => {
                // 네트워크 연결 테스트
                fetch('https://fextlagqverlrajlmkon.supabase.co/rest/v1/', { 
                  method: 'HEAD',
                  mode: 'no-cors'
                }).then(() => {
                  alert('네트워크 연결이 정상입니다. 다시 시도해주세요.');
                }).catch(() => {
                  alert('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.');
                });
              }}
              size="large"
              color="warning"
            >
              연결 확인
            </Button>
          )}
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
          문제가 계속되면 관리자에게 문의해주세요.
        </Typography>
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