# 📦 데이터 백업/복원 기능 완전성 분석 보고서

작성일: 2025-10-27
분석 대상: CRM 애플리케이션 백업/복원 시스템

---

## 🎯 요약

**결론: ⚠️ 부분적으로 완전함 (주의사항 있음)**

백업/복원 기능은 대부분의 데이터를 안전하게 백업하고 복원할 수 있지만, **외래 키 제약 조건**과 **순서 의존성** 때문에 완전한 복원을 위해서는 주의가 필요합니다.

---

## 📋 백업 대상 테이블 목록

현재 백업되는 테이블 (13개):

| 번호 | 테이블명 | 설명 | 관계 |
|-----|---------|------|------|
| 1 | `services` | A/S 정보 | 메인 테이블 |
| 2 | `service_tags` | A/S 태그 | services 의존 (FK) |
| 3 | `service_parts` | A/S 사용 부품 | services, parts 의존 (FK) |
| 4 | `shipments` | 출고 정보 | 독립 테이블 |
| 5 | `parts` | 부품 마스터 | 독립 테이블 |
| 6 | `warehouses` | 창고 정보 | 독립 테이블 |
| 7 | `dealers` | 딜러 정보 | 독립 테이블 |
| 8 | `transactions` | 거래 정보 | parts 의존 (FK) |
| 9 | `inventory` | 재고 정보 | parts, warehouses 의존 (FK) |
| 10 | `model_settings` | 모델 설정 | 독립 테이블 |
| 11 | `brand_settings` | 브랜드 설정 | 독립 테이블 |
| 12 | `user_memos` | 사용자 메모 | 독립 테이블 |
| 13 | `board_posts` | 게시판 게시물 | 독립 테이블 |

---

## ✅ 백업 기능 분석

### 장점
1. **포괄적인 데이터 수집**: 모든 주요 테이블의 데이터를 백업
2. **메타데이터 포함**: 백업 시간, 버전, 테이블 통계 저장
3. **에러 처리**: 개별 테이블 백업 실패 시에도 다른 테이블 계속 백업
4. **JSON 형식**: 사람이 읽을 수 있는 형식, 쉬운 검증
5. **진행률 표시**: 사용자에게 백업 진행 상황 표시

### 단점
1. ⚠️ **외래 키 정보 미포함**: 테이블 간 관계 정보 저장 안 됨
2. ⚠️ **복원 순서 미정의**: 의존 관계를 고려한 순서 없음
3. ⚠️ **시퀀스/AUTO_INCREMENT 미백업**: ID 자동 증가 상태 미보존

---

## ⚠️ 복원 기능 분석

### 장점
1. **유연한 옵션**: 
   - `clearExisting`: 기존 데이터 삭제 여부 선택
   - `skipErrors`: 오류 발생 시 계속 진행 여부
   - `tables`: 특정 테이블만 선택 복원
2. **진행률 표시**: 복원 과정 시각화
3. **상세한 결과 보고**: 성공/실패/스킵 테이블 목록 제공

### 주요 문제점

#### 1. **외래 키 제약 조건 위반 위험** 🔴

**문제:**
```javascript
// 현재 복원 순서 (배열 순서대로)
1. services
2. service_tags      // ← services.id 필요 (FK)
3. service_parts     // ← services.id, parts.id 필요 (FK)
4. shipments
5. parts
6. warehouses
7. dealers
8. transactions      // ← parts.id 필요 (FK)
9. inventory         // ← parts.id, warehouses.id 필요 (FK)
```

**시나리오:**
- `service_parts`를 복원할 때 `services`는 복원됨
- 하지만 `parts`는 아직 복원 안 됨
- `service_parts`의 `part_id`가 존재하지 않는 `parts.id`를 참조
- **복원 실패! ❌**

#### 2. **ID 충돌 가능성** 🟡

**문제:**
```javascript
// 기존 DB: services.id = 1, 2, 3
// 백업 데이터: services.id = 1, 2, 3, 4, 5
// clearExisting: false

// 복원 시도:
// INSERT services (id=1) → 충돌! 이미 존재
// INSERT services (id=2) → 충돌! 이미 존재
// INSERT services (id=3) → 충돌! 이미 존재
// INSERT services (id=4) → 성공
// INSERT services (id=5) → 성공
```

**결과:** 부분 복원만 성공, 불완전한 데이터

#### 3. **시퀀스 불일치** 🟡

**문제:**
```javascript
// 복원 후:
// services: id = 1~100 (백업 데이터)
// sequence 상태: nextval = 50 (이전 상태)

// 새 데이터 입력:
// INSERT services → id = 50 (자동 할당)
// → 충돌! id=50 이미 존재
```

---

## 🔧 해결 방안

### 1. **올바른 복원 순서 정의**

```javascript
// backupUtils.js 수정 필요
const RESTORE_ORDER = [
  // 1단계: 의존성 없는 독립 테이블
  'parts',
  'warehouses', 
  'dealers',
  'model_settings',
  'brand_settings',
  'user_memos',
  'board_posts',
  
  // 2단계: 1단계 테이블에만 의존
  'services',
  'shipments',
  'inventory',        // parts, warehouses 의존
  'transactions',     // parts 의존
  
  // 3단계: 2단계 테이블에 의존
  'service_tags',     // services 의존
  'service_parts'     // services, parts 의존
];
```

### 2. **clearExisting: true 필수 권장**

완전한 복원을 위해서는 **반드시 기존 데이터를 삭제**해야 합니다.

```javascript
// 권장 사용법
restoreBackup(backupData, {
  clearExisting: true,    // ✅ 필수!
  skipErrors: false,      // 오류 발생 시 중단
  tables: null            // 전체 테이블 복원
});
```

### 3. **시퀀스 재설정 추가**

```javascript
// 복원 후 시퀀스 재설정 필요
// PostgreSQL 예시
SELECT setval('services_id_seq', (SELECT MAX(id) FROM services));
SELECT setval('shipments_id_seq', (SELECT MAX(id) FROM shipments));
// ... 기타 테이블
```

---

## 🧪 테스트 체크리스트

### ✅ 완전한 복원 테스트

**준비:**
1. 현재 데이터베이스 상태 확인
   ```sql
   SELECT COUNT(*) FROM services;
   SELECT COUNT(*) FROM service_parts;
   SELECT COUNT(*) FROM parts;
   ```

**백업 생성:**
1. "데이터 백업/복원" 메뉴 접속
2. "백업 생성" 버튼 클릭
3. 백업 파일 다운로드 확인
4. JSON 파일 내용 확인 (텍스트 에디터)

**데이터 삭제 (테스트):**
```sql
-- ⚠️ 주의: 테스트 환경에서만!
DELETE FROM service_parts;
DELETE FROM service_tags;
DELETE FROM services;
-- ... 기타 테이블
```

**복원 실행:**
1. "복원" 버튼 클릭
2. 백업 파일 선택
3. **"기존 데이터 삭제" 체크박스 선택** ✅
4. "복원 시작" 버튼 클릭
5. 진행률 확인

**검증:**
1. 데이터 개수 확인
   ```sql
   SELECT COUNT(*) FROM services;        -- 백업 개수와 일치?
   SELECT COUNT(*) FROM service_parts;   -- 백업 개수와 일치?
   SELECT COUNT(*) FROM parts;           -- 백업 개수와 일치?
   ```

2. 관계 무결성 확인
   ```sql
   -- service_parts의 모든 part_id가 parts에 존재하는가?
   SELECT COUNT(*) 
   FROM service_parts sp
   LEFT JOIN parts p ON sp.part_id = p.id
   WHERE p.id IS NULL;
   -- 결과: 0이어야 함 ✅
   
   -- service_parts의 모든 service_id가 services에 존재하는가?
   SELECT COUNT(*) 
   FROM service_parts sp
   LEFT JOIN services s ON sp.service_id = s.id
   WHERE s.id IS NULL;
   -- 결과: 0이어야 함 ✅
   ```

3. 새 데이터 입력 테스트
   - A/S 관리에서 새 A/S 등록
   - 부품 추가 가능한지 확인
   - ID 충돌 없는지 확인

---

## 📊 복원 시나리오별 결과 예측

### 시나리오 1: clearExisting = true (권장) ✅

**조건:**
- 기존 데이터 전체 삭제
- 백업 데이터 전체 복원

**예상 결과:**
- ✅ 완전한 복원 성공
- ✅ 외래 키 제약 조건 충족 (순서만 맞으면)
- ✅ ID 충돌 없음
- ⚠️ 시퀀스 수동 재설정 필요할 수 있음

**위험도:** 🟢 낮음 (순서만 올바르면)

---

### 시나리오 2: clearExisting = false ⚠️

**조건:**
- 기존 데이터 유지
- 백업 데이터 추가

**예상 결과:**
- ❌ ID 충돌로 인한 부분 실패 가능
- ❌ 불완전한 데이터 복원
- ❌ 외래 키 참조 문제 발생 가능

**위험도:** 🔴 높음 (권장하지 않음)

---

### 시나리오 3: 특정 테이블만 복원 ⚠️

**조건:**
- 예: `services` 테이블만 복원

**예상 결과:**
- ⚠️ 관련 테이블(`service_parts`, `service_tags`)과 불일치
- ⚠️ 고아 레코드 발생 가능
- ⚠️ 데이터 무결성 훼손

**위험도:** 🟡 중간 (주의 필요)

---

## 🎯 권장 사용 방법

### ✅ 안전한 백업/복원 절차

1. **정기 백업**
   ```
   주기: 매일 또는 주요 작업 전
   저장: 여러 버전 보관 (최소 3개)
   확인: 백업 파일 크기 및 내용 검증
   ```

2. **복원 전 준비**
   ```
   1. 현재 데이터 백업 (복원 실패 대비)
   2. 테스트 환경에서 먼저 테스트 (가능하다면)
   3. 작업 시간 공지 (서비스 중단 필요)
   ```

3. **복원 실행**
   ```
   1. 백업 파일 선택
   2. "기존 데이터 삭제" 체크 ✅
   3. "오류 시 건너뛰기" 체크 해제 (실패 시 중단)
   4. 복원 시작
   ```

4. **복원 후 검증**
   ```
   1. 데이터 개수 확인
   2. 관계 무결성 확인 (위의 SQL 실행)
   3. 주요 기능 테스트
      - A/S 관리: 조회, 등록, 수정
      - 출고 관리: 조회, 등록
      - 부품 관리: 조회, 재고 확인
   4. 새 데이터 입력 테스트
   ```

---

## 🚨 주의사항

### ❗ 절대 하지 말아야 할 것

1. **프로덕션에서 테스트 금지**
   - 반드시 테스트 환경에서 먼저 시도

2. **clearExisting=false로 복원 금지**
   - ID 충돌 위험 높음

3. **백업 없이 복원 금지**
   - 복원 전 현재 데이터 백업 필수

4. **부분 테이블 복원 주의**
   - 의존 관계 고려 필수

---

## 📝 개선 권장사항

### 우선순위 높음 🔴

1. **복원 순서 수정**
   ```javascript
   // src/utils/backupUtils.js
   const RESTORE_ORDER = [...]; // 위의 순서 적용
   ```

2. **clearExisting 기본값 변경**
   ```javascript
   // 기본값을 true로 변경하여 안전성 향상
   clearExisting: true  // 기본값
   ```

3. **시퀀스 재설정 추가**
   ```javascript
   // 복원 후 자동으로 시퀀스 재설정
   await resetSequences(tables);
   ```

### 우선순위 중간 🟡

4. **복원 전 유효성 검사 강화**
   ```javascript
   // 외래 키 참조 무결성 사전 검증
   validateForeignKeys(backupData);
   ```

5. **복원 후 자동 검증**
   ```javascript
   // 복원 완료 후 데이터 무결성 자동 체크
   await verifyRestoration(results);
   ```

6. **롤백 기능 추가**
   ```javascript
   // 복원 실패 시 자동 롤백
   if (results.failed.length > 0) {
     await rollback(checkpoint);
   }
   ```

### 우선순위 낮음 🟢

7. **증분 백업 지원**
   - 변경된 데이터만 백업

8. **압축 저장**
   - JSON 압축하여 파일 크기 감소

9. **클라우드 백업**
   - 자동으로 클라우드에 백업

---

## ✅ 최종 체크리스트

**백업/복원을 실행하기 전에 확인하세요:**

- [ ] 테스트 환경에서 먼저 테스트했는가?
- [ ] 현재 데이터를 백업했는가?
- [ ] 복원 옵션을 올바르게 설정했는가? (clearExisting: true)
- [ ] 백업 파일이 유효한가? (JSON 형식 확인)
- [ ] 복원 후 검증 계획이 있는가?
- [ ] 문제 발생 시 대응 방안이 있는가?

---

## 📞 지원

문제 발생 시:
1. 복원 로그 확인 (`console.log` 출력)
2. 브라우저 개발자 도구 콘솔 확인
3. Supabase 대시보드에서 테이블 상태 확인

---

**작성자 메모:**
현재 백업/복원 기능은 기본적으로 작동하지만, 완전한 복원을 위해서는 위의 개선사항을 적용하는 것이 좋습니다. 특히 **복원 순서**와 **시퀀스 재설정**은 필수적입니다.

