# 메모 테이블 설정 가이드

## 🚨 공유 메모가 로딩되지 않는 문제 해결

공유 메모와 개인 메모 테이블이 데이터베이스에 생성되어 있지 않을 수 있습니다.

---

## ✅ 해결 방법 (3분 소요)

### 1단계: Supabase Dashboard 접속

https://supabase.com/dashboard/project/fextlagqverlrajlmkon/sql

---

### 2단계: SQL Editor에서 두 파일 모두 실행

#### A. 개인 메모 테이블 생성

**파일 경로:** `supabase/migrations/create_user_memos.sql`

**실행 방법:**
1. SQL Editor에서 "New Query" 클릭
2. 아래 파일 내용 복사/붙여넣기
3. "Run" 버튼 클릭

**또는 직접 파일 열기:**
```bash
code supabase/migrations/create_user_memos.sql
```

---

#### B. 공유 메모 테이블 생성

**파일 경로:** `supabase/migrations/create_shared_memos.sql`

**실행 방법:**
1. SQL Editor에서 "New Query" 클릭
2. 아래 파일 내용 복사/붙여넣기
3. "Run" 버튼 클릭

**또는 직접 파일 열기:**
```bash
code supabase/migrations/create_shared_memos.sql
```

---

### 3단계: 테이블 생성 확인

**Supabase Dashboard > Table Editor**

다음 두 테이블이 보여야 합니다:
- ✅ `user_memos` - 개인 메모
- ✅ `shared_memos` - 공유 메모

---

### 4단계: 브라우저 새로고침

앱으로 돌아가서 브라우저를 새로고침하세요.

**Mac:** `Cmd + Shift + R`
**Windows:** `Ctrl + Shift + R`

---

## 🧪 테스트

### 개인 메모 테스트
1. 대시보드 접속
2. **개인 메모 (나만 보기)** 탭 선택
3. 메모 작성
4. 3초 후 자동 저장 확인

### 공유 메모 테스트
1. 대시보드 접속
2. **공유 메모 (전체 공유)** 탭 선택
3. 메모 작성
4. 3초 후 자동 저장 확인

---

## 🔍 문제가 계속되면

### A. 브라우저 콘솔 확인 (F12)

**예상 로그:**
```
공유 메모 불러오기 시작...
공유 메모 데이터: {id: "...", memo1: "", memo2: "", ...}
```

**또는 (초기 생성 시):**
```
공유 메모 불러오기 시작...
공유 메모가 없어서 초기 레코드 생성 중...
공유 메모 초기 레코드 생성 완료
```

### B. 오류가 표시되면

**오류 예시 1: 테이블이 없음**
```
error: relation "shared_memos" does not exist
```
→ **해결**: SQL 파일을 다시 실행하세요.

**오류 예시 2: 권한 문제**
```
error: permission denied for table shared_memos
```
→ **해결**: RLS 정책 확인

```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE shared_memos ENABLE ROW LEVEL SECURITY;

-- 정책 재생성
DROP POLICY IF EXISTS "Anyone can view shared memos" ON shared_memos;
DROP POLICY IF EXISTS "Anyone can update shared memos" ON shared_memos;
DROP POLICY IF EXISTS "Anyone can insert shared memos" ON shared_memos;

CREATE POLICY "Anyone can view shared memos"
  ON shared_memos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can update shared memos"
  ON shared_memos FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone can insert shared memos"
  ON shared_memos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

### C. Supabase에서 직접 확인

**SQL Editor에서 실행:**

```sql
-- 공유 메모 확인
SELECT * FROM shared_memos;

-- 개인 메모 확인
SELECT * FROM user_memos;
```

**예상 결과:**

**공유 메모 (1개 레코드만 존재):**
```
id | memo1 | memo2 | memo3 | memo_name_1 | ...
```

**개인 메모 (사용자별로 1개씩):**
```
id | user_id | memo1 | memo2 | memo3 | ...
```

---

## 📋 빠른 체크리스트

- [ ] `create_user_memos.sql` 실행 완료
- [ ] `create_shared_memos.sql` 실행 완료
- [ ] Table Editor에서 두 테이블 확인
- [ ] 브라우저 강제 새로고침
- [ ] 개인 메모 탭에서 메모 작성 테스트
- [ ] 공유 메모 탭에서 메모 작성 테스트

---

## 🎯 완료 확인

### 성공 시 보이는 화면:

```
대시보드
├─────────────────────────────────────────
│ [개인 메모 (나만 보기) 개인] [공유 메모 (전체 공유) 공유]
│                                    ↑ 클릭 가능
├─────────────────────────────────────────
│
│ 메모 에디터 표시 ✅
│ - 메모 작성 가능
│ - 자동 저장 작동
│ - 저장 상태 표시
```

### 브라우저 콘솔 로그:
```
공유 메모 불러오기 시작...
공유 메모 데이터: {id: "xxx", memo1: "", ...}
```

---

## 💡 핵심 요약

**문제:** 공유 메모 테이블이 데이터베이스에 생성되지 않음

**해결:** 
1. Supabase SQL Editor 접속
2. `create_shared_memos.sql` 실행
3. `create_user_memos.sql` 실행
4. 브라우저 새로고침

**소요 시간:** 3분 이하

---

## 🆘 여전히 안 되면

터미널에서 다음 명령어 실행:

```bash
# 1. SQL 파일 내용 확인
cat supabase/migrations/create_shared_memos.sql

# 2. 복사된 내용을 Supabase SQL Editor에 붙여넣고 실행
```

또는 스크린샷을 공유해주세요:
1. Supabase Table Editor 화면
2. 브라우저 콘솔 (F12) 화면

