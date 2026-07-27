# 챗봇 공지사항 기능 설계 (2026-07-28, 단순화 버전)

## 배경 / 목적

상품 재입고일 등 "새로운 소식"을 챗봇이 답변에 반영한다. 처음엔 별도 테이블+API+관리탭+대시보드카드로 설계했으나, 기존 FAQ 시스템과 별개 파이프라인을 하나 더 만드는 게 과하다고 판단 — **기존 `faq_items`에 "공지사항" 플래그만 얹는 방식**으로 단순화.

## 최종 요구사항

- 별도 테이블 없음. 기존 FAQ 항목에 "공지사항" 체크박스로 구분
- 공지사항으로 체크된 항목만 시작일/종료일 지정 가능 (자동 만료). 미지정 시 기존 `is_active`(수동 ON/OFF)만 적용 — 일반 FAQ와 동일
- 공지사항 항목은 FAQ 목록(관리 화면) 상단에 표시, 뱃지로 구분
- 대시보드 카드는 폐기
- 챗봇 답변(RAG) 반영은 기존 FAQ 파이프라인을 그대로 타므로 추가 작업 불필요 — 정렬만 신경 쓰면 됨

## 변경 내역

### 1. DB — `faq_items` 컬럼 추가

```sql
ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;
```

일반 FAQ는 `is_announcement=false`, `start_date`/`end_date` NULL 유지 → 날짜 필터가 기존 FAQ에 영향 없음(NULL은 항상 통과).

### 2. 조회 쿼리 2곳 — 정렬 + 날짜 필터 추가

- `netlify/functions/chatbot-faq-list.js` (위젯이 호출)
- `netlify/functions/chatbot-naver-worker-background.js`의 `loadFaqs()` (네이버 톡톡)

두 곳 모두 동일 패턴 추가:
```js
const today = new Date().toISOString().slice(0, 10);
// ...
.or(`start_date.is.null,start_date.lte.${today}`)
.or(`end_date.is.null,end_date.gte.${today}`)
.order('is_announcement', { ascending: false })  // 공지 먼저
.order('sort_order', { ascending: true })
```

이 두 함수의 결과가 위젯의 `FAQS`/`knowledge`와 네이버워커의 `knowledge`를 그대로 구성하므로, 정렬만 바꾸면 챗봇 답변(RAG)·관리 화면 모두에 "공지 우선" 순서가 자동 반영됨. 새 함수·새 통합 코드 불필요.

### 3. 관리 UI — `FaqManagement.jsx` (기존 FAQ 목록 탭 내부만 수정, 새 탭 없음)

- `EMPTY_FORM`에 `is_announcement: false, start_date: '', end_date: ''` 추가
- `fetchFaqs` 정렬에 `is_announcement DESC` 추가 (목록 상단 고정)
- 테이블 행: `is_announcement=true`면 레이블 앞에 "공지" 뱃지(Chip) 표시
- 편집 다이얼로그: "공지사항" 스위치 추가, 체크 시에만 시작일/종료일 date 필드 노출
- `handleSave`: 저장 전 빈 날짜 문자열 → `null` 변환 (Postgres date 컬럼에 빈 문자열 저장 방지)

## 제외 범위

- 대시보드 카드 (폐기 결정)
- 별도 테이블/함수/관리탭 (기존 FAQ에 통합)
- 조회수 트래킹, 알림 연동 (기존과 동일하게 없음)

관련: [[챗봇위젯]]
