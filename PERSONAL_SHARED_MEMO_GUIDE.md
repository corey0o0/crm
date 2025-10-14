# 개인 메모 + 공유 메모 구현 가이드 🎯

## 개요

대시보드에 **개인 메모**(계정별)와 **공유 메모**(전체 공유) 두 가지를 탭으로 구분하여 제공합니다.

---

## 📋 준비 단계

### 1단계: 데이터베이스 테이블 생성

**Supabase Dashboard > SQL Editor**에서 실행:

```sql
-- /supabase/migrations/create_user_memos.sql 파일 내용을 실행
```

이미 `shared_memos` 테이블은 생성되어 있으므로, `user_memos` 테이블만 추가하면 됩니다.

---

## 🏗️ 구조

```
대시보드
├── [개인 메모] 탭
│   ├── 개인 메모 1
│   ├── 개인 메모 2
│   └── 개인 메모 3
└── [공유 메모] 탭
    ├── 공유 메모 1
    ├── 공유 메모 2
    └── 공유 메모 3
```

---

## 🔧 구현 방법

### 옵션 1: 빠른 구현 (추천) ⭐

Dashboard를 완전히 새로 작성하는 대신, **메모 컴포넌트를 분리**합니다.

#### 1. MemoPanel 컴포넌트 생성

```jsx
// src/components/Dashboard/MemoPanel.jsx
import React, { useState, useEffect } from 'react';
import { Tabs, Tab, Box, Button } from '@mui/material';
import ReactQuill from 'react-quill';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

function MemoPanel() {
  const { user } = useAuth();
  const [memoType, setMemoType] = useState('personal');
  const [personalMemos, setPersonalMemos] = useState(['', '', '']);
  const [sharedMemos, setSharedMemos] = useState(['', '', '']);
  const [selectedTab, setSelectedTab] = useState(0);

  // 개인 메모 불러오기
  useEffect(() => {
    if (!user) return;
    
    const fetchPersonalMemos = async () => {
      const { data } = await supabase
        .from('user_memos')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setPersonalMemos([data.memo1, data.memo2, data.memo3]);
      }
    };

    fetchPersonalMemos();
  }, [user]);

  // 공유 메모 불러오기
  useEffect(() => {
    const fetchSharedMemos = async () => {
      const { data } = await supabase
        .from('shared_memos')
        .select('*')
        .single();

      if (data) {
        setSharedMemos([data.memo1, data.memo2, data.memo3]);
      }
    };

    fetchSharedMemos();
  }, []);

  // 저장 함수
  const handleSave = async () => {
    if (memoType === 'personal') {
      await supabase
        .from('user_memos')
        .upsert({
          user_id: user.id,
          memo1: personalMemos[0],
          memo2: personalMemos[1],
          memo3: personalMemos[2]
        });
    } else {
      await supabase
        .from('shared_memos')
        .update({
          memo1: sharedMemos[0],
          memo2: sharedMemos[1],
          memo3: sharedMemos[2]
        })
        .eq('id', 1); // 공유 메모는 하나의 레코드만 사용
    }
  };

  const currentMemos = memoType === 'personal' ? personalMemos : sharedMemos;
  const setCurrentMemos = memoType === 'personal' ? setPersonalMemos : setSharedMemos;

  return (
    <Box>
      {/* 메모 타입 탭 */}
      <Tabs value={memoType} onChange={(e, v) => setMemoType(v)}>
        <Tab label="개인 메모" value="personal" />
        <Tab label="공유 메모" value="shared" />
      </Tabs>

      {/* 메모 내용 탭 */}
      <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)}>
        <Tab label="메모 1" />
        <Tab label="메모 2" />
        <Tab label="메모 3" />
      </Tabs>

      {/* 에디터 */}
      <ReactQuill
        value={currentMemos[selectedTab]}
        onChange={(value) => {
          const newMemos = [...currentMemos];
          newMemos[selectedTab] = value;
          setCurrentMemos(newMemos);
        }}
      />

      <Button onClick={handleSave}>저장</Button>
    </Box>
  );
}

export default MemoPanel;
```

#### 2. Dashboard에 통합

```jsx
// src/components/Dashboard.jsx
import MemoPanel from './Dashboard/MemoPanel';

// Dashboard 컴포넌트 안에서:
<Grid item xs={12} md={6}>
  <Paper sx={{ p: 2, height: '100%' }}>
    <Typography variant="h6" gutterBottom>
      메모
    </Typography>
    <MemoPanel />
  </Paper>
</Grid>
```

---

### 옵션 2: 기존 Dashboard 수정

현재 Dashboard.jsx가 매우 크고 복잡하므로 단계별로 수정합니다.

#### 수정 필요한 부분:

1. **State 분리** (이미 완료)
   - ✅ `personalMemoList`, `sharedMemoList`
   - ✅ `personalMemoNames`, `sharedMemoNames`

2. **Fetch 함수 수정**
   - 개인 메모: `fetchPersonalMemos()` 추가
   - 공유 메모: `fetchSharedMemos()` 수정 (이미 존재)

3. **Save 함수 수정**
   - `handleAutoSave()` 수정: memoType에 따라 다른 테이블에 저장

4. **UI 수정**
   - 메모 타입 선택 탭 추가
   - 현재 타입에 따라 적절한 state 사용

---

## 🚀 빠른 시작 (옵션 1 추천)

### 1. SQL 실행
```bash
cd /Users/weird/Desktop/Work/AS/crm-app
# Supabase Dashboard에서 create_user_memos.sql 실행
```

### 2. MemoPanel 컴포넌트 생성
```bash
mkdir -p src/components/Dashboard
# MemoPanel.jsx 생성 (위의 코드 복사)
```

### 3. Dashboard에 통합
```jsx
import MemoPanel from './Dashboard/MemoPanel';
```

---

## 📊 데이터 구조

### user_memos (개인 메모)
```sql
CREATE TABLE user_memos (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL, -- 계정별로 다름
  memo1 TEXT,
  memo2 TEXT,
  memo3 TEXT,
  memo_name_1 TEXT,
  memo_name_2 TEXT,
  memo_name_3 TEXT
);
```

### shared_memos (공유 메모)
```sql
CREATE TABLE shared_memos (
  id UUID PRIMARY KEY,
  -- user_id 없음! 모든 사용자가 같은 레코드 공유
  memo1 TEXT,
  memo2 TEXT,
  memo3 TEXT,
  memo_name_1 TEXT,
  memo_name_2 TEXT,
  memo_name_3 TEXT
);
```

---

## 🧪 테스트

### 1. 개인 메모 테스트
1. 사용자 A로 로그인
2. "개인 메모" 탭 선택
3. 메모 작성 후 저장
4. 사용자 B로 로그인
5. 사용자 B는 사용자 A의 개인 메모를 볼 수 없어야 함 ✅

### 2. 공유 메모 테스트
1. 사용자 A로 로그인
2. "공유 메모" 탭 선택
3. 메모 작성 후 저장
4. 사용자 B로 로그인
5. 사용자 B도 같은 공유 메모를 볼 수 있어야 함 ✅

---

## 💡 추가 기능

### 실시간 업데이트 (공유 메모용)

```jsx
useEffect(() => {
  const channel = supabase
    .channel('shared_memos_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'shared_memos' },
      (payload) => {
        setSharedMemos([
          payload.new.memo1,
          payload.new.memo2,
          payload.new.memo3
        ]);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

---

## ⚠️ 주의사항

1. **개인 메모**는 `user_id`로 필터링됩니다.
2. **공유 메모**는 단 하나의 레코드만 존재합니다 (id = 1).
3. RLS 정책이 올바르게 설정되어야 합니다.

---

## 📞 문의

구현 중 문제가 발생하면:
1. 브라우저 콘솔 확인 (F12)
2. Supabase 로그 확인
3. RLS 정책 확인

---

## ✅ 완료 체크리스트

- [ ] `user_memos` 테이블 생성
- [ ] `MemoPanel.jsx` 생성
- [ ] Dashboard에 통합
- [ ] 개인 메모 테스트
- [ ] 공유 메모 테스트
- [ ] 실시간 업데이트 테스트

모두 완료되면 개인 메모와 공유 메모가 정상 작동합니다! 🎉

