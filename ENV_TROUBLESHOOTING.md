# 환경 변수 문제 해결 가이드

## 🔍 문제 진단 체크리스트

환경 변수가 동작하지 않을 때 다음을 순서대로 확인하세요.

### 1단계: 브라우저 콘솔에서 확인

브라우저 개발자 도구(F12) → Console 탭에서 다음 명령어 실행:

```javascript
// 환경 변수 객체 확인
console.log('window._env_ 전체:', window._env_);

// 특정 변수 확인 (예: 텔레그램 토큰)
console.log('텔레그램 토큰:', window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN);

// 모든 키 확인
console.log('환경 변수 키 목록:', Object.keys(window._env_ || {}));
```

**예상 결과:**
- `window._env_`가 객체로 표시되어야 함
- 변경한 변수가 새 값으로 표시되어야 함

### 2단계: 파일 확인

#### `public/env.js` 파일 확인
```bash
# 파일이 존재하는지 확인
cat public/env.js

# 변경한 변수가 올바른 값으로 설정되어 있는지 확인
grep "REACT_APP_TELEGRAM_BOT_TOKEN" public/env.js
```

#### `build/env.js` 파일 확인 (프로덕션 빌드 시)
```bash
# 빌드된 파일 확인
cat build/env.js
```

### 3단계: 네트워크 탭에서 확인

1. 개발자 도구(F12) → Network 탭
2. 페이지 새로고침 (Ctrl+R 또는 Cmd+R)
3. `env.js` 파일 찾기
4. 클릭하여 Response 확인
5. 변경한 값이 포함되어 있는지 확인

### 4단계: 캐시 확인

#### 브라우저 캐시 클리어
- **Windows/Linux**: `Ctrl + Shift + R` 또는 `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`
- 또는 개발자 도구 → Network 탭 → "Disable cache" 체크

#### 서비스 워커 캐시 (PWA인 경우)
```javascript
// 콘솔에서 실행
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
});
location.reload();
```

## 🛠️ 해결 방법

### 방법 1: 개발 서버 재시작

```bash
# 개발 서버 중지 (Ctrl+C)
# 개발 서버 재시작
npm start
```

### 방법 2: 빌드 재생성 (프로덕션)

```bash
# 빌드 폴더 삭제
rm -rf build

# 재빌드
npm run build
```

### 방법 3: 하드 리프레시

1. 개발자 도구 열기 (F12)
2. Network 탭 → "Disable cache" 체크
3. 새로고침 버튼을 길게 클릭 → "Empty Cache and Hard Reload"

### 방법 4: 시크릿 모드에서 테스트

브라우저 시크릿 모드에서 열어서 캐시 없이 테스트:
- **Chrome/Edge**: `Ctrl + Shift + N` (Windows) / `Cmd + Shift + N` (Mac)
- **Firefox**: `Ctrl + Shift + P` (Windows) / `Cmd + Shift + P` (Mac)
- **Safari**: `Cmd + Shift + N`

## 🔧 자주 발생하는 문제

### 문제 1: 변수가 undefined로 표시됨

**원인**: `env.js` 파일이 로드되지 않음

**해결**:
1. `public/env.js` 파일이 존재하는지 확인
2. `public/index.html`에서 `env.js` 로드 확인:
   ```html
   <script src="%PUBLIC_URL%/env.js"></script>
   ```
3. 네트워크 탭에서 `env.js` 파일이 404 에러인지 확인

### 문제 2: 이전 값이 계속 표시됨

**원인**: 브라우저 캐시

**해결**:
1. 하드 리프레시 실행
2. 개발 서버 재시작
3. 시크릿 모드에서 테스트

### 문제 3: Netlify에서 동작하지 않음

**원인**: Netlify 환경 변수가 설정되지 않음

**해결**:
1. Netlify 대시보드 → Site settings → Environment variables 확인
2. 변수명이 정확한지 확인 (`REACT_APP_` 접두사 필수)
3. 재배포 실행 (Deploys → Trigger deploy → Clear cache and deploy site)

### 문제 4: 일부 변수만 동작하지 않음

**원인**: 변수명 오타 또는 `public/index.html`에 누락

**해결**:
1. `public/index.html`의 병합 스크립트에 변수가 포함되어 있는지 확인
2. 변수명 대소문자 정확히 일치하는지 확인
3. 콘솔에서 `window._env_` 객체 확인

## 📊 진단 스크립트

브라우저 콘솔에서 실행하여 환경 변수 상태를 확인:

```javascript
// 환경 변수 진단 스크립트
(function() {
  console.log('=== 환경 변수 진단 ===');
  
  // 1. window._env_ 존재 확인
  if (typeof window === 'undefined') {
    console.error('❌ window 객체가 없습니다');
    return;
  }
  
  if (!window._env_) {
    console.error('❌ window._env_가 정의되지 않았습니다');
    console.log('env.js 파일이 로드되지 않았을 수 있습니다');
    return;
  }
  
  console.log('✅ window._env_ 존재:', true);
  
  // 2. 모든 환경 변수 키 확인
  const envKeys = Object.keys(window._env_);
  console.log('📋 환경 변수 키 목록:', envKeys);
  console.log('📊 총 변수 개수:', envKeys.length);
  
  // 3. 필수 변수 확인
  const requiredVars = [
    'REACT_APP_SUPABASE_URL',
    'REACT_APP_SUPABASE_ANON_KEY',
    'REACT_APP_TELEGRAM_BOT_TOKEN',
    'REACT_APP_TELEGRAM_CHAT_ID'
  ];
  
  console.log('\n=== 필수 변수 확인 ===');
  requiredVars.forEach(key => {
    const value = window._env_[key];
    if (value) {
      const displayValue = key.includes('TOKEN') || key.includes('KEY') 
        ? value.substring(0, 20) + '...' 
        : value;
      console.log(`✅ ${key}: ${displayValue}`);
    } else {
      console.error(`❌ ${key}: 설정되지 않음`);
    }
  });
  
  // 4. env.js 파일 로드 확인
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const envScript = scripts.find(s => s.src.includes('env.js'));
  if (envScript) {
    console.log('✅ env.js 스크립트 태그 발견:', envScript.src);
  } else {
    console.error('❌ env.js 스크립트 태그를 찾을 수 없습니다');
  }
  
  console.log('\n=== 진단 완료 ===');
})();
```

## ✅ 확인 체크리스트

환경 변수 변경 후 다음을 확인하세요:

- [ ] `public/env.js` 파일에 변경사항이 저장되었는가?
- [ ] 개발 서버를 재시작했는가? (`npm start`)
- [ ] 브라우저 캐시를 클리어했는가? (Ctrl+Shift+R)
- [ ] 콘솔에서 `window._env_`가 새 값을 표시하는가?
- [ ] 네트워크 탭에서 `env.js` 파일이 올바르게 로드되는가?
- [ ] 변수명에 오타가 없는가? (대소문자 확인)
- [ ] `REACT_APP_` 접두사가 있는가?

## 🆘 여전히 해결되지 않는 경우

1. **브라우저 콘솔 에러 확인**
   - 빨간색 에러 메시지 확인
   - 에러 내용을 기록

2. **네트워크 탭 확인**
   - `env.js` 파일이 404 에러인지 확인
   - 파일이 로드되었지만 내용이 비어있는지 확인

3. **파일 권한 확인**
   ```bash
   ls -la public/env.js
   ```

4. **다른 브라우저에서 테스트**
   - Chrome, Firefox, Safari 등에서 테스트

5. **프로젝트 재설정**
   ```bash
   # node_modules 재설치
   rm -rf node_modules
   npm install
   
   # 개발 서버 재시작
   npm start
   ```

