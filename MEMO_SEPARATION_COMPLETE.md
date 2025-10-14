# 개인 메모 & 공유 메모 분리 완료 ✅

## 🎯 구현 완료

대시보드에서 **개인 메모**와 **공유 메모**를 탭으로 구분하여 사용할 수 있습니다.

---

## 📊 기능 구조

### 1. 개인 메모 (`user_memos`)
- ✅ 사용자별로 독립적인 메모
- ✅ 다른 사용자는 볼 수 없음
- ✅ `user_id`로 필터링
- ✅ 메모 3개 (이름 변경 가능)

### 2. 공유 메모 (`shared_memos`)
- ✅ 모든 사용자가 공유
- ✅ 누구나 편집 가능
- ✅ 전체가 같은 내용 공유
- ✅ 메모 3개 (이름 변경 가능)

---

## 🚀 사용 방법

### 필수 작업: 데이터베이스 테이블 생성

**Supabase Dashboard > SQL Editor**에서 두 파일 모두 실행:

#### 1. 개인 메모 테이블
```
supabase/migrations/create_user_memos.sql
```

#### 2. 공유 메모 테이블  
```
supabase/migrations/create_shared_memos.sql
```

---

## 🎨 UI 구조

```
대시보드
├─────────────────────────────────────────
│ [개인 메모 (나만 보기) 개인] [공유 메모 (전체 공유) 공유]
├─────────────────────────────────────────
│
│ ┌─────────────────┐  ┌─────────────────┐
│ │ [메모 1] [메모 3]│  │ [메모 2]         │
│ ├─────────────────┤  ├─────────────────┤
│ │                 │  │                 │
│ │  리치 텍스트     │  │  리치 텍스트     │
│ │  에디터         │  │  에디터         │
│ │                 │  │                 │
│ │  - 굵게, 색상   │  │  - 굵게, 색상   │
│ │  - 자동 저장    │  │  - 자동 저장    │
│ │                 │  │                 │
│ └─────────────────┘  └─────────────────┘
```

---

## 🔧 주요 기능

### 1. 탭 전환
- **개인 메모 탭**: 파란색 "개인" 칩 표시
- **공유 메모 탭**: 초록색 "공유" 칩 표시
- 클릭 한 번으로 전환

### 2. 자동 저장
- 3초 후 자동 저장
- 저장 상태 실시간 표시
- 타입별 독립적 저장

### 3. 실시간 동기화
- **개인 메모**: 본인의 메모만 실시간 업데이트
- **공유 메모**: 모든 사용자 실시간 동기화

### 4. 메모 이름 변경
- 메모 이름 클릭으로 편집
- Enter로 저장
- 타입별 독립적 이름 관리

---

## 📝 테스트 시나리오

### 개인 메모 테스트
1. **사용자 A** 로그인
2. **개인 메모** 탭 선택
3. "메모 1"에 "A의 개인 메모" 작성
4. 자동 저장 대기
5. **사용자 B** 로그인
6. **개인 메모** 탭 확인
7. ✅ 사용자 B는 빈 메모를 봐야 함

### 공유 메모 테스트
1. **사용자 A** 로그인
2. **공유 메모** 탭 선택
3. "메모 1"에 "모두 함께 보는 메모" 작성
4. 자동 저장 대기
5. **사용자 B** 로그인
6. **공유 메모** 탭 확인
7. ✅ 사용자 B도 같은 내용을 봐야 함

### 실시간 동기화 테스트
1. 브라우저 2개 열기 (같은 사용자 또는 다른 사용자)
2. 양쪽 모두 **공유 메모** 탭 선택
3. 한쪽에서 내용 수정
4. ✅ 다른 쪽에서 자동으로 내용 업데이트

---

## 🔍 데이터베이스 확인

### Supabase Dashboard에서 확인:

#### 개인 메모
```sql
SELECT 
  u.email,
  um.memo_name_1,
  substring(um.memo1, 1, 50) as memo1_preview
FROM user_memos um
JOIN auth.users u ON um.user_id = u.id;
```

예상 결과:
```
email                | memo_name_1     | memo1_preview
---------------------|-----------------|------------------
master@slimpack.com  | 개인 메모 1     | A의 개인 메모...
kim@slimpack.com     | 개인 메모 1     | B의 개인 메모...
```

#### 공유 메모
```sql
SELECT 
  memo_name_1,
  substring(memo1, 1, 50) as memo1_preview
FROM shared_memos;
```

예상 결과 (단 하나의 레코드):
```
memo_name_1     | memo1_preview
----------------|------------------
공유 메모 1     | 모두 함께 보는...
```

---

## 💾 저장 방식

### 개인 메모
```javascript
// user_memos 테이블에 저장
await supabase
  .from('user_memos')
  .upsert({
    user_id: user.id,  // ← 사용자별 구분
    memo1: content1,
    memo2: content2,
    memo3: content3,
    memo_name_1: name1,
    memo_name_2: name2,
    memo_name_3: name3
  }, {
    onConflict: 'user_id'
  });
```

### 공유 메모
```javascript
// shared_memos 테이블에 저장 (하나의 레코드만 존재)
const { data: existingMemo } = await supabase
  .from('shared_memos')
  .select('id')
  .maybeSingle();

if (existingMemo) {
  // 기존 레코드 업데이트
  await supabase
    .from('shared_memos')
    .update({
      memo1: content1,
      memo2: content2,
      memo3: content3
    })
    .eq('id', existingMemo.id);
}
```

---

## ⚡ 로컬 스토리지

임의 저장 키:
- 개인 메모: `temp_personal_memo_0`, `temp_personal_memo_1`, `temp_personal_memo_2`
- 공유 메모: `temp_shared_memo_0`, `temp_shared_memo_1`, `temp_shared_memo_2`

---

## 🎯 장점

### 1. 유연성
- 개인 작업은 개인 메모에
- 팀 공유 사항은 공유 메모에

### 2. 실시간 협업
- 공유 메모로 실시간 협업
- 누가 수정해도 즉시 반영

### 3. 개인 프라이버시
- 개인 메모는 타인이 볼 수 없음
- 안전한 개인 메모 저장

### 4. 직관적 UI
- 탭 한 번으로 전환
- 색상 코드 (파란색=개인, 초록색=공유)

---

## 🐛 문제 해결

### 메모가 저장되지 않음

1. **브라우저 콘솔 확인** (F12 > Console)
2. **Supabase 테이블 확인**
   ```sql
   SELECT * FROM user_memos WHERE user_id = 'YOUR_USER_ID';
   SELECT * FROM shared_memos;
   ```
3. **RLS 정책 확인**
   - `user_memos`: 자신의 메모만 읽기/쓰기 가능
   - `shared_memos`: 모두 읽기/쓰기 가능

### 실시간 업데이트 안 됨

1. Supabase Realtime 활성화 확인
2. 테이블 Replica Identity 설정:
   ```sql
   ALTER TABLE user_memos REPLICA IDENTITY FULL;
   ALTER TABLE shared_memos REPLICA IDENTITY FULL;
   ```

### 개인 메모가 공유됨

- `user_memos` 테이블의 RLS 정책 확인
- `user_id` 필터링이 제대로 작동하는지 확인

---

## 📦 파일 구조

```
/src/components/Dashboard.jsx  - 메인 대시보드 (개인/공유 메모 통합)
/supabase/migrations/
  ├─ create_user_memos.sql     - 개인 메모 테이블
  └─ create_shared_memos.sql   - 공유 메모 테이블
```

---

## ✨ 다음 단계 (선택사항)

### 1. 메모 내보내기
```jsx
const exportMemo = (content, name) => {
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.html`;
  a.click();
};
```

### 2. 메모 검색
```jsx
const [searchTerm, setSearchTerm] = useState('');
const filteredMemos = memoList.filter(memo => 
  memo.content.includes(searchTerm)
);
```

### 3. 메모 태그
```jsx
const [tags, setTags] = useState([]);
const addTag = (memoIdx, tag) => {
  // 메모에 태그 추가 기능
};
```

---

## 🎉 완료!

이제 대시보드에서 **개인 메모**와 **공유 메모**를 자유롭게 사용할 수 있습니다!

**사용자 경험**:
1. 로그인
2. 대시보드 접속
3. 메모 타이프 선택 (개인/공유)
4. 메모 작성
5. 자동 저장 (3초)
6. 실시간 동기화 ✅

**팀 협업 시나리오**:
- 개인 메모: 개인 TO-DO, 메모
- 공유 메모: 팀 공지, 공유 TO-DO, 회의록

