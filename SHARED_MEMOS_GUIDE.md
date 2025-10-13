# 공유 메모 기능 가이드 📝

## 개요
대시보드의 메모 기능이 **전체 사용자 공유 방식**으로 변경되었습니다.

### 변경 사항
- **이전**: 각 사용자별로 개별 메모 (`user_memos` 테이블)
- **이후**: 모든 사용자가 같은 메모 공유 (`shared_memos` 테이블)

---

## 🚀 설정 방법

### 1단계: 공유 메모 테이블 생성

**Supabase Dashboard > SQL Editor**에서 다음 파일을 실행:
```
supabase/migrations/create_shared_memos.sql
```

이 스크립트는 다음을 수행합니다:
- ✅ `shared_memos` 테이블 생성
- ✅ RLS (Row Level Security) 정책 설정
- ✅ 기본 공유 메모 레코드 생성
- ✅ 자동 업데이트 트리거 설정

### 2단계: 애플리케이션 재시작

변경사항이 이미 코드에 반영되어 있으므로 브라우저를 새로고침하면 바로 적용됩니다!

---

## 📋 주요 기능

### 1. 실시간 동기화
- 한 사용자가 메모를 수정하면 **다른 모든 사용자의 화면에 실시간으로 반영**됩니다.
- 별도의 새로고침 없이 자동으로 업데이트됩니다.

### 2. 자동 저장
- 메모 입력 후 **3초 뒤 자동으로 저장**됩니다.
- 저장 상태가 화면에 표시됩니다:
  - 🟡 "저장 중..." - 저장 진행 중
  - 🔴 "저장되지 않은 변경사항" - 아직 저장되지 않음
  - ⚪ "마지막 저장: 2025.01.15 14:30" - 저장 완료

### 3. 수동 저장
- "저장" 버튼을 클릭하여 즉시 저장 가능
- 자동 저장을 기다리지 않고 바로 저장됩니다.

### 4. 메모 이름 변경
- 메모 이름을 클릭하면 수정 가능
- 변경된 이름은 **모든 사용자에게 공유**됩니다.

---

## 💡 사용 시나리오

### 시나리오 1: 업무 지시사항 공유
**상황**: 관리자가 중요한 공지사항을 메모에 작성

1. 관리자가 메모 1에 "오늘 중요 업무" 작성
2. 자동 저장 (3초 후)
3. 다른 직원들의 대시보드에 **즉시 표시**
4. 모든 팀원이 같은 내용을 확인

### 시나리오 2: 고객 정보 공유
**상황**: A 직원이 고객 정보를 메모에 기록

1. A 직원이 메모 2에 "김철수 고객 - 오후 3시 방문 예정" 작성
2. B 직원이 대시보드를 보면 **동일한 내용** 표시
3. B 직원도 추가 정보 입력 가능
4. 실시간으로 서로의 수정 내용이 반영됨

### 시나리오 3: 재고 현황 공유
**상황**: 재고 담당자가 재고 현황을 업데이트

1. 재고 담당자가 메모 3에 "A 부품 재고 부족" 작성
2. 서비스 담당자가 대시보드를 열면 **즉시 확인 가능**
3. 재고가 입고되면 담당자가 메모 수정
4. 모든 직원이 최신 재고 정보를 공유

---

## ⚠️ 주의사항

### 1. 동시 편집 시
- 여러 사용자가 동시에 같은 메모를 수정하면 **마지막 저장이 우선**됩니다.
- 중요한 내용은 수정 전에 다른 사람이 편집 중인지 확인하세요.

### 2. 삭제 기능
- 메모 내용을 완전히 지우고 저장하면 모든 사용자에게 **빈 메모**로 표시됩니다.
- 실수로 삭제한 경우 복구가 어려우니 주의하세요.

### 3. 민감한 정보
- 공유 메모는 **모든 로그인 사용자가 볼 수 있습니다**.
- 개인 정보나 민감한 정보는 작성하지 마세요.

### 4. 권한
- 로그인한 **모든 사용자**가 읽기/쓰기 가능합니다.
- 현재 버전에서는 특정 사용자만 편집하도록 제한할 수 없습니다.

---

## 🔧 기술 정보

### 데이터베이스 구조

```sql
CREATE TABLE shared_memos (
  id UUID PRIMARY KEY,
  memo1 TEXT,                    -- 첫 번째 메모 내용
  memo2 TEXT,                    -- 두 번째 메모 내용
  memo3 TEXT,                    -- 세 번째 메모 내용
  memo_name_1 VARCHAR(100),      -- 첫 번째 메모 이름
  memo_name_2 VARCHAR(100),      -- 두 번째 메모 이름
  memo_name_3 VARCHAR(100),      -- 세 번째 메모 이름
  updated_at TIMESTAMP,          -- 마지막 수정 시각
  updated_by UUID,               -- 마지막 수정한 사용자
  created_at TIMESTAMP           -- 생성 시각
);
```

### 실시간 동기화 원리
- **Supabase Realtime** 기능 사용
- `shared_memos` 테이블의 변경사항을 실시간 구독
- 변경 발생 시 모든 연결된 클라이언트에 자동 전파

### 보안 정책 (RLS)
```sql
-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "Anyone can view shared memos"
  ON shared_memos FOR SELECT
  USING (auth.role() = 'authenticated');

-- 모든 인증된 사용자가 수정 가능
CREATE POLICY "Anyone can update shared memos"
  ON shared_memos FOR UPDATE
  USING (auth.role() = 'authenticated');
```

---

## 🆘 문제 해결

### ❌ "메모를 불러올 수 없습니다" 오류
**원인**: `shared_memos` 테이블이 생성되지 않음
**해결**:
1. `create_shared_memos.sql` 파일 실행 확인
2. Supabase Table Editor에서 `shared_memos` 테이블 존재 확인

### ❌ 실시간 동기화가 안 됨
**원인**: Supabase Realtime이 비활성화됨
**해결**:
1. Supabase Dashboard > Database > Replication 확인
2. `shared_memos` 테이블의 Realtime 활성화
3. 브라우저 새로고침

### ❌ 저장이 안 됨
**원인**: RLS 정책 오류 또는 권한 부족
**해결**:
1. 로그인 상태 확인
2. SQL Editor에서 정책 확인:
```sql
SELECT * FROM pg_policies WHERE tablename = 'shared_memos';
```

### ❌ 이전 개인 메모가 보이지 않음
**원인**: 이전 `user_memos`에서 `shared_memos`로 마이그레이션 필요
**해결**:
1. 이전 개인 메모 데이터를 보존하려면 수동으로 복사
2. SQL Editor에서:
```sql
-- 특정 사용자의 메모를 공유 메모로 복사
UPDATE shared_memos
SET 
  memo1 = (SELECT memo1 FROM user_memos WHERE user_id = '사용자_ID'),
  memo2 = (SELECT memo2 FROM user_memos WHERE user_id = '사용자_ID'),
  memo3 = (SELECT memo3 FROM user_memos WHERE user_id = '사용자_ID');
```

---

## 📊 비교표

| 항목 | 개인 메모 (이전) | 공유 메모 (현재) |
|------|-----------------|-----------------|
| 저장 위치 | `user_memos` | `shared_memos` |
| 공유 범위 | 개인만 | 모든 사용자 |
| 실시간 동기화 | ❌ | ✅ |
| 사용자별 필터 | ✅ | ❌ |
| 협업 | ❌ | ✅ |
| 개인정보 보호 | ✅ | ⚠️ 주의 필요 |

---

## ✅ 체크리스트

설정을 완료했는지 확인하세요:

- [ ] `create_shared_memos.sql` 실행 완료
- [ ] Supabase Table Editor에서 `shared_memos` 테이블 확인
- [ ] 대시보드에서 메모 작성 테스트
- [ ] 다른 브라우저/계정에서 실시간 동기화 확인
- [ ] 팀원들에게 공유 메모 사용법 안내

모두 완료했다면 공유 메모 시스템이 준비되었습니다! 🎉

---

## 📞 추가 문의

문제가 계속되면 다음 정보와 함께 문의하세요:
- 발생한 오류 메시지
- 브라우저 콘솔 로그 (F12 → Console)
- Supabase 프로젝트 설정

