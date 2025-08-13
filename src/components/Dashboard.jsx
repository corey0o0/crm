import React, { useState, useEffect } from 'react';
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
  FormControl
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
  const [memoList, setMemoList] = useState([
    { content: '', lastSaved: null, hasChanges: false, saving: false },
    { content: '', lastSaved: null, hasChanges: false, saving: false },
    { content: '', lastSaved: null, hasChanges: false, saving: false }
  ]);
  const [memoNames, setMemoNames] = useState(['메모 1', '메모 2', '메모 3']);
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

  // 메모 불러오기
  useEffect(() => {
    const fetchMemos = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = user?.id || session?.user?.id;
        
        if (!userId) {
          console.log('사용자 인증 대기 중...');
          return;
        }

        // 먼저 메모 데이터가 있는지 확인
        const { data: existingMemo, error: checkError } = await supabase
          .from('user_memos')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('메모 조회 중 오류:', checkError);
          return;
        }

        // 메모 데이터가 없으면 새로 생성
        if (!existingMemo) {
          const { error: insertError } = await supabase
            .from('user_memos')
            .insert([
              {
                user_id: userId,
                updated_at: new Date().toISOString()
              }
            ]);

          if (insertError) {
            console.error('새 메모 생성 중 오류:', insertError);
            return;
          }

          // 새로 생성된 메모 데이터 조회
          const { data: newMemo, error: fetchError } = await supabase
            .from('user_memos')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (fetchError) {
            console.error('새 메모 조회 중 오류:', fetchError);
            return;
          }

          setMemoList(prev => [
            { content: newMemo.memo1 || '', lastSaved: newMemo.updated_at },
            { content: newMemo.memo2 || '', lastSaved: newMemo.updated_at },
            { content: newMemo.memo3 || '', lastSaved: newMemo.updated_at }
          ]);
        } else {
          // 임시 저장된 내용 확인 후 복구
          const tempMemo1 = localStorage.getItem(`temp_memo_${userId}_0`);
          const tempMemo2 = localStorage.getItem(`temp_memo_${userId}_1`);
          const tempMemo3 = localStorage.getItem(`temp_memo_${userId}_2`);

          setMemoList(prev => [
            { 
              content: tempMemo1 || existingMemo.memo1 || '', 
              lastSaved: existingMemo.updated_at,
              hasChanges: !!tempMemo1,
              saving: false
            },
            { 
              content: tempMemo2 || existingMemo.memo2 || '', 
              lastSaved: existingMemo.updated_at,
              hasChanges: !!tempMemo2,
              saving: false
            },
            { 
              content: tempMemo3 || existingMemo.memo3 || '', 
              lastSaved: existingMemo.updated_at,
              hasChanges: !!tempMemo3,
              saving: false
            }
          ]);
          
          // 데이터베이스에서 메모 이름 불러오기
          try {
            if (existingMemo?.memo_name_1 || existingMemo?.memo_name_2 || existingMemo?.memo_name_3) {
              // 데이터베이스에 메모 이름이 있으면 사용
              setMemoNames([
                existingMemo.memo_name_1 || '메모 1',
                existingMemo.memo_name_2 || '메모 2', 
                existingMemo.memo_name_3 || '메모 3'
              ]);
            } else {
              // 데이터베이스에 없으면 로컬 스토리지에서 불러오기
              const savedNames = localStorage.getItem(`memo_names_${userId}`);
              if (savedNames) {
                const loadedNames = JSON.parse(savedNames);
                if (Array.isArray(loadedNames) && loadedNames.length === 3) {
                  setMemoNames(loadedNames);
                  // 로컬 스토리지에만 있던 데이터를 데이터베이스에 저장
                  await supabase
                    .from('user_memos')
                    .update({
                      memo_name_1: loadedNames[0],
                      memo_name_2: loadedNames[1],
                      memo_name_3: loadedNames[2]
                    })
                    .eq('user_id', userId);
                }
              }
            }
          } catch (e) {
            console.error('메모 이름 로딩 오류:', e);
          }
        }
      } catch (err) {
        console.error('메모 불러오기 오류:', err);
        setError(err.message);
      }
    };

    fetchMemos();

    // 실시간 업데이트를 위한 구독 설정
    const channel = supabase
      .channel('user_memos_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_memos',
          filter: `user_id=eq.${user?.id}`
        },
        payload => {
          if (payload.new) {
            setMemoList(prev => prev.map((m, i) => 
              i === 0 ? { ...m, content: payload.new.memo1 || '', lastSaved: payload.new.updated_at } : 
              i === 1 ? { ...m, content: payload.new.memo2 || '', lastSaved: payload.new.updated_at } : 
              i === 2 ? { ...m, content: payload.new.memo3 || '', lastSaved: payload.new.updated_at } : m
            ));
            
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  
  // 메모 내용 변경
  const handleMemoContentChange = (idx, value) => {
    // 메모 내용 업데이트 및 변경사항 표시
    setMemoList(prev => prev.map((m, i) => 
      i === idx ? { ...m, content: value, hasChanges: true } : m
    ));

    // 로컬 스토리지에 임시 저장
    const userId = user?.id;
    if (userId) {
      const tempKey = `temp_memo_${userId}_${idx}`;
      localStorage.setItem(tempKey, value);
    }

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
    try {
      // 저장 중 상태 설정
      setMemoList(prev => prev.map((m, i) => 
        i === idx ? { ...m, saving: true } : m
      ));

      const { data: { session } } = await supabase.auth.getSession();
      const userId = user?.id || session?.user?.id;
      if (!userId) return;

      const now = new Date().toISOString();
      const upsertData = {
        user_id: userId,
        updated_at: now,
        memo1: memoList[0]?.content || '',
        memo2: memoList[1]?.content || '',
        memo3: memoList[2]?.content || ''
      };

      const { error } = await supabase
        .from('user_memos')
        .upsert(upsertData, { onConflict: 'user_id' });

      if (error) throw error;

      // 저장 성공 상태 업데이트
      setMemoList(prev => prev.map((m, i) => 
        i === idx ? { 
          ...m, 
          lastSaved: now, 
          hasChanges: false, 
          saving: false 
        } : m
      ));

      // 임시 저장 데이터 제거
      const tempKey = `temp_memo_${userId}_${idx}`;
      localStorage.removeItem(tempKey);

    } catch (error) {
      console.error('자동 저장 오류:', error);
      // 저장 실패 시 saving 상태 해제
      setMemoList(prev => prev.map((m, i) => 
        i === idx ? { ...m, saving: false } : m
      ));
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
    setMemoList(prev => [...prev, { content: '', lastSaved: null }]);
    setSelectedMemoTab(memoList.length);
  };

  // 메모 삭제
  const handleDeleteMemo = (idx) => {
    if (memoList.length <= 2) return; // 최소 2개 보장
    setMemoList(prev => prev.filter((_, i) => i !== idx));
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
    setMemoNames(prev => prev.map((name, i) => i === index ? newName : name));
  };

  // 메모 이름 편집 완료
  const handleMemoNameEditComplete = async (index) => {
    setEditingMemoName(null);
    await saveMemoNames();
  };

  // 메모 이름 저장 (데이터베이스와 로컬 스토리지 모두)
  const saveMemoNames = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = user?.id || session?.user?.id;
      
      if (userId) {
        // 데이터베이스에 저장
        const { error } = await supabase
          .from('user_memos')
          .upsert({
            user_id: userId,
            memo_name_1: memoNames[0],
            memo_name_2: memoNames[1], 
            memo_name_3: memoNames[2],
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) {
          console.error('메모 이름 DB 저장 오류:', error);
          // DB 저장 실패 시에도 로컬 스토리지에는 저장
        }

        // 로컬 스토리지에 백업 저장
        localStorage.setItem(`memo_names_${userId}`, JSON.stringify(memoNames));
        
        console.log('메모 이름이 저장되었습니다:', memoNames);
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

      // 1. 서비스 데이터 가져오기
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('reception_date', { ascending: false });

      if (servicesError) {
        console.error('서비스 데이터 조회 오류:', servicesError);
        throw new Error('서비스 데이터를 불러오는데 실패했습니다.');
      }

      // 2. 출고 데이터 가져오기
      let shipments = [];
      try {
        const { data: shipmentsData, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .order('created_at', { ascending: false });

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
        .order('reception_date', { ascending: false });

      if (recentServicesError) {
        console.error('최근 서비스 데이터 조회 오류:', recentServicesError);
        throw new Error('최근 서비스 데이터를 불러오는데 실패했습니다.');
      }


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
      console.error('대시보드 데이터 로딩 오류:', err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
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