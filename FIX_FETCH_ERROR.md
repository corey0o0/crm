# "Failed to fetch" 오류 해결 방법

## 🔴 오류 내용
```
서비스 데이터 조회 오류: 
{message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch'}
```

---

## ✅ 해결 방법

### 1단계: 개발 서버 재시작 (필수)

**터미널에서 실행 중인 개발 서버를 중지하고 재시작하세요:**

```bash
# 1. 현재 실행 중인 개발 서버 중지
# Ctrl + C (또는 터미널 종료)

# 2. 개발 서버 재시작
npm start
```

**이유**: `.env` 파일의 환경 변수가 제대로 로드되지 않았을 수 있습니다.

---

### 2단계: 브라우저 캐시 완전 삭제

**Chrome/Edge:**
1. `Cmd + Shift + R` (Mac) 또는 `Ctrl + Shift + R` (Windows)
2. 또는 개발자 도구 (F12) → Network 탭 → "Disable cache" 체크

**Safari:**
1. `Cmd + Option + E` (캐시 비우기)
2. `Cmd + R` (새로고침)

---

### 3단계: 환경 변수 확인

**브라우저 콘솔에서 확인:**

```javascript
console.log('Supabase URL:', process.env.REACT_APP_SUPABASE_URL);
console.log('Supabase Key:', process.env.REACT_APP_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
```

**예상 출력:**
```
Supabase URL: https://fextlagqverlrajlmkon.supabase.co
Supabase Key: eyJhbGciOiJIUzI1NiIsInR5...
```

**만약 `undefined`가 출력되면:**
- `.env` 파일이 프로젝트 루트에 있는지 확인
- 개발 서버를 완전히 재시작

---

### 4단계: Supabase 프로젝트 상태 확인

**Supabase Dashboard 접속:**
https://supabase.com/dashboard/project/fextlagqverlrajlmkon

**확인 사항:**
1. ✅ 프로젝트가 활성 상태인지
2. ✅ "Paused" 또는 "Inactive" 상태가 아닌지
3. ✅ 최근에 프로젝트가 재시작되었는지

**만약 프로젝트가 일시 중지되었다면:**
- Dashboard에서 "Restore project" 버튼 클릭
- 몇 분 기다린 후 재시도

---

### 5단계: 네트워크 탭에서 실제 요청 확인

**Chrome 개발자 도구 (F12) > Network 탭:**

1. Network 탭 열기
2. 페이지 새로고침
3. `services` 또는 `supabase` 관련 요청 찾기
4. 요청 클릭 → Headers 확인

**확인 사항:**
- Request URL이 올바른지
- Status Code (200, 401, 403, 500 등)
- Response 내용

**일반적인 상태 코드:**
- `200`: 성공 (정상)
- `401`: 인증 실패 (API 키 문제)
- `403`: 권한 없음 (RLS 정책)
- `500`: 서버 오류
- `(failed)`: 네트워크 연결 실패

---

## 🔧 추가 디버깅

### 터미널에서 Supabase 연결 테스트

```bash
curl -I https://fextlagqverlrajlmkon.supabase.co/rest/v1/services \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4"
```

**예상 출력:**
```
HTTP/2 200  (← 정상)
HTTP/2 401  (← API 키 문제)
HTTP/2 403  (← 권한 문제)
```

---

## 🆘 여전히 오류가 발생하면

### A. 로그인 상태 확인

```javascript
// 브라우저 콘솔
const { data: { session } } = await supabase.auth.getSession();
console.log('현재 세션:', session);
```

**세션이 없다면:**
- 로그아웃 후 재로그인
- 로컬 스토리지 삭제: `localStorage.clear()`

### B. RLS 정책 확인

**Supabase Dashboard > Table Editor > services 테이블:**

1. 우측 상단 "RLS" 토글 확인
2. Policies 탭에서 SELECT 정책 확인

**임시로 RLS 비활성화 (개발 중):**
```sql
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
```

**⚠️ 주의**: 프로덕션에서는 반드시 RLS를 활성화하고 적절한 정책 설정!

### C. 다른 테이블 테스트

```javascript
// 브라우저 콘솔에서 간단한 테스트
const { data, error } = await supabase.from('roles').select('*').limit(1);
console.log('테스트 결과:', { data, error });
```

---

## 📋 체크리스트

- [ ] 개발 서버 재시작 (npm start)
- [ ] 브라우저 캐시 삭제 (Cmd/Ctrl + Shift + R)
- [ ] 브라우저 콘솔에서 환경 변수 확인
- [ ] Supabase 프로젝트 상태 확인
- [ ] 네트워크 탭에서 실제 요청 확인
- [ ] 로그인 상태 확인
- [ ] RLS 정책 확인

---

## 💡 가장 흔한 원인

1. **개발 서버가 환경 변수를 로드하지 못함** → 재시작
2. **브라우저 캐시** → 강제 새로고침
3. **Supabase 프로젝트 일시 중지** → Dashboard에서 복원
4. **로그인 세션 만료** → 재로그인
5. **RLS 정책** → 정책 확인 또는 임시 비활성화

---

## 🎯 현재 상황 진단

**증상**: `TypeError: Failed to fetch`

**의미**: 
- 네트워크 요청이 아예 실패함
- 서버에 도달하지 못함
- CORS 문제 또는 네트워크 차단

**가능성 높은 원인 (순서대로):**
1. ⭐ **개발 서버가 환경 변수를 못 읽음** (90% 확률)
2. 🔄 브라우저 캐시 (5% 확률)
3. 🌐 Supabase 프로젝트 일시 중지 (3% 확률)
4. 🔒 네트워크/방화벽 (2% 확률)

---

## ✅ 해결 후 확인

**브라우저 콘솔에 다음과 같은 로그가 표시되어야 합니다:**

```
Supabase URL: https://fextlagqverlrajlmkon.supabase.co
Supabase 연결 시작...
서비스 데이터 조회 성공: XX 건
```

**대시보드가 정상적으로 로드되면 완료!** 🎉

