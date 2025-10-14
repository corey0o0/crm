# 개인/공유 메모 구현 완료 - 적용 가이드 🎯

## ✅ 완료된 작업

1. ✅ `user_memos` 테이블 SQL 생성
2. ✅ `MemoPanel.jsx` 컴포넌트 생성
3. ✅ 개인/공유 메모 분리 기능

---

## 🚀 적용 단계

### 1단계: 데이터베이스 테이블 생성

**Supabase Dashboard > SQL Editor**에서 실행:

```
/Users/weird/Desktop/Work/AS/crm-app/supabase/migrations/create_user_memos.sql
```

파일 내용을 복사해서 SQL Editor에 붙여넣고 **RUN** 버튼 클릭

**✅ 확인**: 테이블 목록에 `user_memos`가 생성되었는지 확인

---

### 2단계: Dashboard에 통합

#### 옵션 A: 기존 메모 완전 교체 (추천) ⭐

`src/components/Dashboard.jsx`에서 메모 관련 코드를 모두 제거하고 `MemoPanel`로 교체:

```jsx
// 1. Import 추가
import MemoPanel from './Dashboard/MemoPanel';

// 2. 메모 관련 모든 state 제거 (100줄 정도)
// - memoList, setMemoList
// - memoNames, setMemoNames
// - 모든 메모 관련 useEffect
// - 모든 메모 관련 함수들

// 3. 렌더링 부분 교체
// 기존 메모 섹션을 찾아서:
<Grid item xs={12} md={6}>
  <Paper sx={{ p: 2, height: 500 }}>
    <Typography variant="h6" gutterBottom>
      메모
    </Typography>
    <MemoPanel />
  </Paper>
</Grid>
```

#### 옵션 B: 기존 메모 유지하면서 추가

기존 메모를 남겨두고 새 메모를 추가하려면:

```jsx
// Dashboard.jsx에 추가
import MemoPanel from './Dashboard/MemoPanel';

// 렌더링 부분에 새로운 Grid 추가
<Grid item xs={12} md={6}>
  <Paper sx={{ p: 2, height: 500 }}>
    <Typography variant="h6" gutterBottom>
      새 메모 시스템
    </Typography>
    <MemoPanel />
  </Paper>
</Grid>
```

---

## 🎨 UI 구조

```
┌─────────────────────────────────┐
│  [개인 메모 나만] [공유 메모 전체] │  ← 메모 타입 선택
├─────────────────────────────────┤
│  [메모 1] [메모 2] [메모 3]  [저장] │  ← 메모 탭
├─────────────────────────────────┤
│                                 │
│   리치 텍스트 에디터 영역         │
│                                 │
│   - 굵게, 기울임, 밑줄          │
│   - 글머리 기호                 │
│   - 색상, 배경색                │
│                                 │
└─────────────────────────────────┘
```

---

## 🔧 기능 설명

### 개인 메모
- ✅ 각 사용자별로 독립적인 메모
- ✅ 다른 사용자는 볼 수 없음
- ✅ 메모 3개 (이름 변경 가능)
- ✅ 실시간 동기화

### 공유 메모
- ✅ 모든 사용자가 같은 메모 공유
- ✅ 누구나 편집 가능
- ✅ 메모 3개 (이름 변경 가능)
- ✅ 실시간 동기화

### 공통 기능
- ✅ 리치 텍스트 에디터 (ReactQuill)
- ✅ 메모 이름 변경 (Edit 아이콘 클릭)
- ✅ 자동 실시간 업데이트
- ✅ 마지막 저장 시간 표시

---

## 🧪 테스트 방법

### 1. 개인 메모 테스트

1. 사용자 A(`master@slimpack.com`)로 로그인
2. **개인 메모** 탭 선택
3. "메모 1"에 내용 입력
4. **저장** 버튼 클릭
5. 사용자 B로 로그인 (다른 브라우저 또는 시크릿 모드)
6. **개인 메모** 탭 확인
7. ✅ 사용자 B는 빈 메모를 봐야 함 (A의 개인 메모는 안 보임)

### 2. 공유 메모 테스트

1. 사용자 A로 로그인
2. **공유 메모** 탭 선택
3. "메모 1"에 "테스트 공유 메모" 입력
4. **저장** 버튼 클릭
5. 사용자 B로 로그인
6. **공유 메모** 탭 확인
7. ✅ 사용자 B도 "테스트 공유 메모"를 봐야 함

### 3. 실시간 업데이트 테스트

1. 두 개의 브라우저 창 열기 (같은 사용자 또는 다른 사용자)
2. 양쪽 모두 **공유 메모** 탭 선택
3. 한쪽에서 내용 수정 후 저장
4. ✅ 다른 쪽에서 자동으로 내용이 업데이트되어야 함

---

## 📊 데이터베이스 확인

### Supabase Dashboard에서 확인:

#### user_memos 테이블
```sql
SELECT * FROM user_memos;
```

예상 결과:
```
id  | user_id          | memo1        | memo2 | memo3 | memo_name_1
----|------------------|--------------|-------|-------|-------------
1   | abc123...        | 개인내용...   |       |       | 개인 메모 1
2   | def456...        | 다른내용...   |       |       | 개인 메모 1
```

#### shared_memos 테이블
```sql
SELECT * FROM shared_memos;
```

예상 결과 (하나의 레코드만):
```
id  | memo1        | memo2 | memo3 | memo_name_1
----|--------------|-------|-------|-------------
1   | 공유내용...   |       |       | 공유 메모 1
```

---

## ⚠️ 문제 해결

### 메모가 저장되지 않음

1. 브라우저 콘솔 확인 (F12)
2. Supabase 테이블 확인
3. RLS 정책 확인:

```sql
-- user_memos RLS 확인
SELECT * FROM pg_policies WHERE tablename = 'user_memos';

-- shared_memos RLS 확인
SELECT * FROM pg_policies WHERE tablename = 'shared_memos';
```

### 실시간 업데이트 안 됨

1. Supabase Realtime 활성화 확인
2. 테이블에 Realtime 권한 부여:

```sql
ALTER TABLE user_memos REPLICA IDENTITY FULL;
ALTER TABLE shared_memos REPLICA IDENTITY FULL;
```

### 개인 메모가 공유됨

1. `user_memos` 테이블에 `user_id`가 올바르게 저장되는지 확인
2. RLS 정책이 활성화되어 있는지 확인

---

## 🎯 최종 확인 체크리스트

- [ ] Supabase에서 `create_user_memos.sql` 실행 완료
- [ ] `user_memos` 테이블 생성 확인
- [ ] `MemoPanel.jsx` 파일 생성 확인
- [ ] Dashboard에 `MemoPanel` import 추가
- [ ] Dashboard에서 `<MemoPanel />` 렌더링
- [ ] 브라우저에서 메모 탭이 보이는지 확인
- [ ] 개인 메모 저장 테스트 완료
- [ ] 공유 메모 저장 테스트 완료
- [ ] 실시간 업데이트 테스트 완료
- [ ] 메모 이름 변경 테스트 완료

---

## ✨ 추가 개선 아이디어

### 1. 자동 저장
```jsx
// MemoPanel.jsx에 추가
useEffect(() => {
  const timer = setTimeout(() => {
    handleSave();
  }, 3000); // 3초 후 자동 저장

  return () => clearTimeout(timer);
}, [currentMemoContent]);
```

### 2. 메모 내보내기
```jsx
const handleExport = () => {
  const blob = new Blob([currentMemoContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentMemoName}.html`;
  a.click();
};
```

### 3. 메모 검색
```jsx
const [searchTerm, setSearchTerm] = useState('');
const filteredMemos = Object.entries(currentMemos)
  .filter(([key, value]) => 
    key.startsWith('memo') && value.includes(searchTerm)
  );
```

---

## 📞 지원

문제가 발생하면:
1. 브라우저 콘솔 (F12) 확인
2. Supabase Dashboard > Logs 확인
3. `PERSONAL_SHARED_MEMO_GUIDE.md` 참고

---

## 🎉 완료!

모든 단계를 완료하면 개인 메모와 공유 메모가 정상 작동합니다!

**다음 단계**: 팀원들에게 사용법 안내 📣

