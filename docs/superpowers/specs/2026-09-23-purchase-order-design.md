# 발주 관리 (Purchase Order Management) 설계

## 배경 / 목적
기초등록 > 상품 관리(`PartsManagement.jsx`, `parts` 테이블)를 기준으로, 부품별 **일자별 발주수량**과 **입고 여부**를 관리하는 신규 화면을 만든다. 기존 상품 관리 화면은 건드리지 않고 별도 메뉴/라우트로 분리한다.

## 범위
- 신규 테이블 `purchase_orders`
- 신규 화면 `src/components/Purchase/PurchaseOrderManagement.jsx`
- 신규 라우트 `/purchase-orders`, 신규 메뉴 "발주 관리" (기초등록 하위)
- 상품 마스터 데이터 수정 기능은 이 화면에 없음 (읽기 전용 참고용 리스트만)
- 실제 재고(`parts.stock`) 반영 없음 — 발주/입고 추적 전용 대장. 재고 처리는 기존 `StockList.jsx`에서 계속 수동으로 함

## 데이터 모델

```sql
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id integer NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  order_date date NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  received boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_part_order_date UNIQUE (part_id, order_date)
);

CREATE INDEX idx_purchase_orders_part_id ON public.purchase_orders(part_id);
CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders(order_date);

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_orders_updated_at();
```

`part_id` 타입은 `part_sync_relations.part_id_1/2`(가장 최근 파츠 관련 마이그레이션, `20251126_create_part_sync_relations.sql`) 및 `PartsManagement.jsx`의 `Number(part.id)` 사용 패턴과 일치시켜 `integer`로 결정. 구현 착수 시 실제 Supabase `parts.id` 타입을 1회 확인해서 다르면 맞춘다(첫 실행 스텝).

파츠당 특정 날짜에 발주 1건(수량 합산)만 존재 — 하루 여러 건 분할 발주가 필요해지면 이후 확장.

### RLS
```sql
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON public.purchase_orders FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert"
ON public.purchase_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update"
ON public.purchase_orders FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete"
ON public.purchase_orders FOR DELETE USING (auth.role() = 'authenticated');
```
`part_sync_relations`와 동일 패턴(로그인 여부만 체크). 메뉴 단위 접근 제한은 DB가 아니라 기존 `MENU_KEYS`/`role_permissions` 앱 레벨 권한(`PermissionRoute`)으로 처리 — 이 프로젝트 기존 컨벤션과 동일.

## 화면 / 라우팅
- `src/App.jsx`: `<Route path="purchase-orders" element={<PermissionRoute requiredPermission={MENU_KEYS.PURCHASE_ORDERS}><PurchaseOrderManagement /></PermissionRoute>} />` — 기존 `parts` 라우트와 동일 패턴
- `src/components/Layout.jsx`: 기초등록 메뉴 children에 `{ text: '발주 관리', icon: <...Icon />, path: '/purchase-orders', key: 'purchaseOrders' }` 추가
- `src/config/menuConfig.js`(또는 `MENU_KEYS` 정의 위치)에 `PURCHASE_ORDERS` 키 추가, 기존 권한 관리 화면에서 노출되도록 등록

## UI / 상호작용
- 상단: 년/월 선택 (`@mui/x-date-pickers`, 기존 설치된 라이브러리 재사용 — 새 라이브러리 추가 안 함)
- 왼쪽: 상품 리스트 (브랜드/코드/이름, 읽기 전용 — `parts` 테이블에서 `id, name, brand, code, track_inventory` 정도만 select, 검색창으로 필터링. `PartsManagement.jsx`는 import/재사용하지 않고 이 화면 전용으로 가볍게 별도 조회)
- 오른쪽: 선택된 년/월의 1일~말일 컬럼을 가로로 나열한 테이블. 각 셀 = 수량 입력(`TextField` size small) + 입고 체크박스
- 데이터 로딩: 선택된 월의 `order_date` 범위로 `purchase_orders` 조회 → `part_id + date` 키의 Map으로 변환해 셀 렌더링에 사용
- 저장: 버튼 없이 셀 단위 autosave
  - 수량: `onBlur` 시 값이 바뀌었으면 upsert (`onConflict: 'part_id,order_date'`)
  - 입고 체크: `onChange` 즉시 upsert, 체크 ON이면 `received_at = now()`, OFF면 `received_at = null`
- 스크롤: 컬럼이 많아지므로(최대 31개) 오른쪽 그리드는 가로 스크롤, 왼쪽 상품명 컬럼은 sticky

## 에러 처리
- upsert 실패 시 스낵바로 에러 알림 + 해당 셀 값을 직전 값으로 롤백 (변경 전 값을 로컬에 잠깐 보관해뒀다가 실패 시 복원)
- 기존 `PartsManagement.jsx`의 `showSnackbar` 패턴과 동일한 방식 재사용

## 테스트
이 프로젝트에는 테스트 프레임워크가 구성되어 있지 않음(`CLAUDE.md`에 명시: "No linting or type checking scripts configured - verify manually before commits"). 브라우저 수동 검증으로 대체:
- 수량 입력 → 새로고침 후 유지 확인
- 입고 체크 on/off → `received_at` 반영 확인
- 년/월 이동 시 그리드 갱신 확인
- 상품 리스트 검색 필터링 확인
- 미인증/권한 없는 계정에서 메뉴 비노출 확인

## 명시적으로 하지 않는 것 (YAGNI)
- 실제 재고(`parts.stock`) 자동 반영
- 발주 이력의 엑셀 일괄 업로드/다운로드 (필요해지면 별도 요청으로)
- 하루 다중 발주 라인
- 역할별 세부 RLS 제한 (현재 컨벤션과 동일하게 로그인 여부만 체크)
