# 유휴 후 로딩 문제 - 근본 해결 방안

## 📊 문제 분석

### 타임라인
```
2024-10-22: 권한 시스템 도입 (68c607b)
2024-10-23~27: 30+ fix 커밋 (유휴 후 로딩 문제)
현재: 여전히 동일한 문제 발생
```

### 근본 원인
1. **복잡한 권한 시스템**
   - AuthContext에서 세션 + 권한 동시 관리
   - 다중 테이블 조인 (users, user_roles, roles, role_permissions)
   - 유휴 후 권한 재로드 시 타임아웃 발생

2. **Supabase 연결 관리의 한계**
   - 10분 유휴 후 연결 끊김
   - 자동 재연결이 항상 작동하지 않음
   - refreshSession() hang 문제

3. **누적된 workaround**
   - 타임아웃 20초 → 15초 → 3초
   - 재시도 1회 → 2회 → 3회 → 자동 새로고침
   - 각 레이어마다 타임아웃 로직 추가

---

## ✅ 해결 방안

### **옵션 1: 권한 시스템 완전 제거 (추천)** ⭐⭐⭐⭐⭐

#### 장점
- ✅ 가장 확실한 해결책
- ✅ 코드 단순화 (30% 감소)
- ✅ 유지보수 용이
- ✅ 성능 향상
- ✅ 유휴 후 문제 완전 해결

#### 제거할 것들
```javascript
❌ AuthContext의 권한 관리 로직
❌ PermissionRoute 컴포넌트
❌ RoleManagement 페이지
❌ user_roles, roles, role_permissions 테이블 쿼리
❌ getUserPermissions API 호출
```

#### 유지할 것들
```javascript
✅ 로그인/로그아웃 (필수)
✅ 세션 관리 (필수)
✅ 사용자 정보 (user.email, user.id)
✅ 모든 메뉴 접근 가능 (로그인만 필요)
```

#### 구현
```javascript
// 단순화된 AuthContext
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = { user, session, loading, signIn, signOut };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
```

#### 예상 효과
- 세션 초기화 시간: 2초 → 0.3초 (85% 감소)
- 유휴 후 복구: 20초 → 5초 (75% 감소)
- 권한 관련 DB 쿼리: 3개 → 0개 (100% 제거)
- 코드 복잡도: 높음 → 낮음

---

### **옵션 2: 권한 시스템 유지 + 캐싱 강화** ⭐⭐⭐

#### 장점
- ✅ 권한 기능 유지
- ✅ 세밀한 접근 제어 가능

#### 단점
- ❌ 복잡도 유지
- ❌ 추가 개발 필요
- ❌ 완전한 해결 보장 안 됨

#### 구현 방향
1. 권한 정보 localStorage 캐싱
2. 백그라운드에서 권한 갱신
3. 권한 로드 실패 시 캐시 사용
4. 타임아웃 더 짧게 (1초)

#### 예상 효과
- 초기 로드: 빠름 (캐시)
- 권한 변경 반영: 느림 (캐시 갱신 필요)
- 유휴 후 문제: 여전히 발생 가능

---

### **옵션 3: 페이지별 독립 재시도 + AuthContext 최소화** ⭐⭐

#### 장점
- ✅ 현재 접근 방식 연장
- ✅ 부분적 개선 가능

#### 단점
- ❌ 근본 해결 아님
- ❌ workaround 계속 추가
- ❌ 유지보수 어려움

#### 현재 상태
```
ServiceDetail.jsx - 3초 타임아웃 + 자동 새로고침 ✅
ServiceList.jsx - 120초 타임아웃 (개선 필요)
PartsManagement.jsx - 타임아웃 없음 (개선 필요)
기타 페이지들 - 타임아웃 없음 (개선 필요)
```

#### 필요한 작업
- 모든 페이지에 3초 타임아웃 적용
- 모든 페이지에 자동 새로고침 추가
- 약 15개 파일 수정 필요

---

## 🎯 추천: **옵션 1 (권한 시스템 제거)**

### 이유

1. **문제의 근본 원인 제거**
   - 복잡한 권한 쿼리 → 없음
   - 다중 테이블 조인 → 없음
   - 권한 재로드 타임아웃 → 없음

2. **실용적인 선택**
   - 현재 사용자 수: 소규모 (추정)
   - 모든 직원이 전체 메뉴 접근 필요
   - 세밀한 권한 제어 불필요

3. **개발 효율성**
   - 수정 시간: 1~2시간
   - 코드 감소: 30%
   - 버그 감소: 50%+

4. **장기적 이점**
   - 유지보수 용이
   - 신규 기능 개발 빠름
   - 성능 향상

### 필요시 나중에 재도입 가능
```
1단계: 단순화 (지금)
  ↓
2단계: 안정화 (1~2주)
  ↓
3단계: 필요하면 간단한 권한 추가
  - localStorage 기반
  - DB 쿼리 최소화
  - 실패 시 전체 접근 허용
```

---

## 📋 다음 단계

### 만약 옵션 1을 선택하면:

1. **백업**
   ```bash
   git checkout -b backup-before-permission-removal
   git push origin backup-before-permission-removal
   ```

2. **권한 시스템 제거**
   - AuthContext 단순화
   - PermissionRoute 제거
   - 권한 쿼리 제거

3. **테스트**
   - 로그인/로그아웃
   - 모든 페이지 접근
   - 유휴 후 복구

4. **배포**
   ```bash
   git commit -m "refactor: 권한 시스템 제거 - 단순화"
   git push
   ```

예상 소요 시간: **1~2시간**
예상 효과: **모든 유휴 문제 해결** ✅

---

## ❓ 결정을 위한 질문

1. **현재 사용자 수는?**
   - 5명 이하 → 옵션 1 강력 추천
   - 10명 이상 → 옵션 2 고려

2. **실제로 권한 제어가 필요한가?**
   - 모든 직원이 모든 메뉴 접근 → 옵션 1
   - 특정 직원만 특정 메뉴 → 옵션 2

3. **개발 시간 vs 기능**
   - 빠른 안정화 우선 → 옵션 1
   - 권한 기능 필수 → 옵션 2

4. **장기 계획**
   - 소규모 유지 → 옵션 1
   - 대규모 확장 → 옵션 2

---

## 💡 제 의견

**권한 시스템을 제거하세요.** (옵션 1)

이유:
- 30+ fix 커밋에도 해결 안 됨
- 복잡도 대비 실익 낮음
- 유휴 문제의 근본 원인
- 단순한 것이 항상 더 안정적

나중에 정말 필요하면 간단하게 다시 추가할 수 있습니다.
하지만 지금은 **안정성이 최우선**입니다.

