import React, { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, TextField } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabaseClient';

const Dashboard = () => {
  const { user } = useAuth();
  const [memo, setMemo] = useState('');
  const [saveTimeout, setSaveTimeout] = useState(null);
  
  // 메모 불러오기
  useEffect(() => {
    const fetchMemo = async () => {
      try {
        const { data, error } = await supabase
          .from('user_memos')
          .select('content')
          .eq('user_id', user.id)
          .single();
          
        if (error) throw error;
        if (data) setMemo(data.content);
      } catch (err) {
        console.error('Error fetching memo:', err);
      }
    };
    
    if (user) fetchMemo();
  }, [user]);
  
  // 메모 자동저장
  const saveMemo = useCallback(async (content) => {
    try {
      const { error } = await supabase
        .from('user_memos')
        .upsert({
          user_id: user.id,
          content: content,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
        
      if (error) throw error;
    } catch (err) {
      console.error('Error saving memo:', err);
    }
  }, [user]);
  
  // 메모 내용 변경 시 자동저장
  const handleMemoChange = (e) => {
    const newContent = e.target.value;
    setMemo(newContent);
    
    // 이전 타이머 취소
    if (saveTimeout) clearTimeout(saveTimeout);
    
    // 새로운 타이머 설정 (1초 후 저장)
    const timeoutId = setTimeout(() => {
      saveMemo(newContent);
    }, 1000);
    
    setSaveTimeout(timeoutId);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper 
        elevation={0}
        sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: '#f8f9fa',
          border: '1px solid #e9ecef'
        }}
      >
        <Typography 
          variant="subtitle2" 
          sx={{ 
            mb: 1, 
            color: '#4e5968',
            fontSize: '0.875rem',
            fontWeight: 600 
          }}
        >
          메모
        </Typography>
        <TextField
          multiline
          fullWidth
          minRows={2}
          maxRows={4}
          value={memo}
          onChange={handleMemoChange}
          placeholder="메모를 입력하세요..."
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: '#fff',
              fontSize: '0.875rem',
              '& fieldset': {
                borderColor: '#e9ecef'
              },
              '&:hover fieldset': {
                borderColor: '#dee2e6'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#3182f6'
              }
            }
          }}
        />
      </Paper>
      
      {/* 기존 대시보드 내용 */}
      // ... existing code ...
    </Box>
  );
};

export default Dashboard; 