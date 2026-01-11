import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Button,
  Typography,
  TextField,
  IconButton,
  Paper,
  Chip,
  Stack
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import QuillEditor from '../common/QuillEditor';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

function MemoPanel() {
  const { user } = useAuth();
  
  // 메모 타입 (개인/공유)
  const [memoType, setMemoType] = useState('personal');
  
  // 개인 메모
  const [personalMemos, setPersonalMemos] = useState({
    memo1: '',
    memo2: '',
    memo3: '',
    memo_name_1: '개인 메모 1',
    memo_name_2: '개인 메모 2',
    memo_name_3: '개인 메모 3'
  });
  
  // 공유 메모
  const [sharedMemos, setSharedMemos] = useState({
    memo1: '',
    memo2: '',
    memo3: '',
    memo_name_1: '공유 메모 1',
    memo_name_2: '공유 메모 2',
    memo_name_3: '공유 메모 3'
  });
  
  const [selectedMemoTab, setSelectedMemoTab] = useState(0);
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // 개인 메모 불러오기
  useEffect(() => {
    if (!user) return;
    
    const fetchPersonalMemos = async () => {
      try {
        const { data, error } = await supabase
          .from('user_memos')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('개인 메모 조회 오류:', error);
          return;
        }

        if (data) {
          setPersonalMemos({
            memo1: data.memo1 || '',
            memo2: data.memo2 || '',
            memo3: data.memo3 || '',
            memo_name_1: data.memo_name_1 || '개인 메모 1',
            memo_name_2: data.memo_name_2 || '개인 메모 2',
            memo_name_3: data.memo_name_3 || '개인 메모 3'
          });
        }
      } catch (err) {
        console.error('개인 메모 불러오기 실패:', err);
      }
    };

    fetchPersonalMemos();

    // 실시간 구독
    const channel = supabase
      .channel('personal_memos_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_memos',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new) {
            setPersonalMemos({
              memo1: payload.new.memo1 || '',
              memo2: payload.new.memo2 || '',
              memo3: payload.new.memo3 || '',
              memo_name_1: payload.new.memo_name_1 || '개인 메모 1',
              memo_name_2: payload.new.memo_name_2 || '개인 메모 2',
              memo_name_3: payload.new.memo_name_3 || '개인 메모 3'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 공유 메모 불러오기
  useEffect(() => {
    const fetchSharedMemos = async () => {
      try {
        const { data, error } = await supabase
          .from('shared_memos')
          .select('*')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('공유 메모 조회 오류:', error);
          return;
        }

        if (data) {
          setSharedMemos({
            memo1: data.memo1 || '',
            memo2: data.memo2 || '',
            memo3: data.memo3 || '',
            memo_name_1: data.memo_name_1 || '공유 메모 1',
            memo_name_2: data.memo_name_2 || '공유 메모 2',
            memo_name_3: data.memo_name_3 || '공유 메모 3'
          });
        }
      } catch (err) {
        console.error('공유 메모 불러오기 실패:', err);
      }
    };

    fetchSharedMemos();

    // 실시간 구독
    const channel = supabase
      .channel('shared_memos_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_memos'
        },
        (payload) => {
          if (payload.new) {
            setSharedMemos({
              memo1: payload.new.memo1 || '',
              memo2: payload.new.memo2 || '',
              memo3: payload.new.memo3 || '',
              memo_name_1: payload.new.memo_name_1 || '공유 메모 1',
              memo_name_2: payload.new.memo_name_2 || '공유 메모 2',
              memo_name_3: payload.new.memo_name_3 || '공유 메모 3'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 메모 내용 변경
  const handleMemoChange = (index, value) => {
    const memoKey = `memo${index + 1}`;
    
    if (memoType === 'personal') {
      setPersonalMemos(prev => ({
        ...prev,
        [memoKey]: value
      }));
    } else {
      setSharedMemos(prev => ({
        ...prev,
        [memoKey]: value
      }));
    }
  };

  // 메모 저장
  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    
    try {
      if (memoType === 'personal') {
        // 개인 메모 저장
        const { error } = await supabase
          .from('user_memos')
          .upsert({
            user_id: user.id,
            memo1: personalMemos.memo1,
            memo2: personalMemos.memo2,
            memo3: personalMemos.memo3,
            memo_name_1: personalMemos.memo_name_1,
            memo_name_2: personalMemos.memo_name_2,
            memo_name_3: personalMemos.memo_name_3
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
        console.log('개인 메모 저장 성공');
      } else {
        // 공유 메모 저장
        const { data: existingMemo, error: fetchError } = await supabase
          .from('shared_memos')
          .select('id')
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (existingMemo) {
          // 업데이트
          const { error } = await supabase
            .from('shared_memos')
            .update({
              memo1: sharedMemos.memo1,
              memo2: sharedMemos.memo2,
              memo3: sharedMemos.memo3,
              memo_name_1: sharedMemos.memo_name_1,
              memo_name_2: sharedMemos.memo_name_2,
              memo_name_3: sharedMemos.memo_name_3
            })
            .eq('id', existingMemo.id);

          if (error) throw error;
          console.log('공유 메모 업데이트 성공');
        } else {
          // 생성
          const { error } = await supabase
            .from('shared_memos')
            .insert({
              memo1: sharedMemos.memo1,
              memo2: sharedMemos.memo2,
              memo3: sharedMemos.memo3,
              memo_name_1: sharedMemos.memo_name_1,
              memo_name_2: sharedMemos.memo_name_2,
              memo_name_3: sharedMemos.memo_name_3
            });

          if (error) throw error;
          console.log('공유 메모 생성 성공');
        }
      }

      setLastSaved(new Date());
    } catch (error) {
      console.error('메모 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 메모 이름 편집 시작
  const handleStartEditName = (index) => {
    setEditingName(index);
    const currentMemos = memoType === 'personal' ? personalMemos : sharedMemos;
    setTempName(currentMemos[`memo_name_${index + 1}`]);
  };

  // 메모 이름 저장
  const handleSaveName = async () => {
    if (editingName === null) return;
    
    const nameKey = `memo_name_${editingName + 1}`;
    
    if (memoType === 'personal') {
      setPersonalMemos(prev => ({
        ...prev,
        [nameKey]: tempName
      }));
    } else {
      setSharedMemos(prev => ({
        ...prev,
        [nameKey]: tempName
      }));
    }
    
    setEditingName(null);
    setTempName('');
    
    // 이름만 저장
    await handleSave();
  };

  // 현재 활성화된 메모
  const currentMemos = memoType === 'personal' ? personalMemos : sharedMemos;
  const currentMemoContent = currentMemos[`memo${selectedMemoTab + 1}`];
  const currentMemoName = currentMemos[`memo_name_${selectedMemoTab + 1}`];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 메모 타입 선택 */}
      <Tabs
        value={memoType}
        onChange={(e, v) => setMemoType(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="개인 메모" value="personal" icon={<Chip label="나만" size="small" color="primary" />} iconPosition="end" />
        <Tab label="공유 메모" value="shared" icon={<Chip label="전체" size="small" color="success" />} iconPosition="end" />
      </Tabs>

      {/* 메모 탭 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Tabs value={selectedMemoTab} onChange={(e, v) => setSelectedMemoTab(v)}>
          {[0, 1, 2].map((index) => (
            <Tab
              key={index}
              label={
                editingName === index ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      size="small"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ width: 100 }}
                    />
                    <IconButton size="small" onClick={handleSaveName}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {currentMemos[`memo_name_${index + 1}`]}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditName(index);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )
              }
            />
          ))}
        </Tabs>
        
        <Stack direction="row" spacing={1} alignItems="center">
          {lastSaved && (
            <Typography variant="caption" color="text.secondary">
              마지막 저장: {lastSaved.toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            size="small"
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Stack>
      </Box>

      {/* 에디터 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <QuillEditor
          value={currentMemoContent}
          onChange={(value) => handleMemoChange(selectedMemoTab, value)}
          style={{ height: 'calc(100% - 42px)' }}
          modules={{
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ color: [] }, { background: [] }],
              ['clean']
            ]
          }}
        />
      </Box>
    </Box>
  );
}

export default MemoPanel;

