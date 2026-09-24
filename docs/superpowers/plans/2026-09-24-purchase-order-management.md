# 발주 관리 (Purchase Order Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기초등록 > 상품 관리를 참고 데이터로 삼아, 부품별 일자별 발주수량과 입고 여부를 관리하는 신규 독립 화면(`/purchase-orders`)을 만든다.

**Architecture:** 신규 테이블 `purchase_orders` (1건 = 특정 부품 + 특정 날짜의 발주수량+입고여부) + 신규 React 컴포넌트 `PurchaseOrderManagement.jsx` (좌: 읽기전용 상품 리스트, 우: 선택 월의 일자별 셀 그리드, 셀 단위 autosave). 기존 `parts` 테이블/`PartsManagement.jsx`는 수정하지 않고 참조만 한다. 실제 재고(`parts.stock`)에는 반영하지 않는 순수 발주 추적 대장이다.

**Tech Stack:** React 18.2.0, Material-UI 5.15.6, `@mui/x-date-pickers` 6.18.7 (`AdapterDateFns` + `date-fns/locale` `ko`), `date-fns` (`getDaysInMonth` 등), Supabase JS client. 테스트 프레임워크 없음 — 브라우저 수동 검증으로 대체.

**Spec:** `docs/superpowers/specs/2026-09-23-purchase-order-design.md`

## Global Constraints

- `parts.id` FK 타입은 반드시 실제 Supabase 스키마 확인 후 결정 (Task 1의 첫 스텝).
- 발주관리 화면에는 상품 수정 기능을 절대 넣지 않는다 (읽기 전용 리스트만).
- 실제 재고(`parts.stock`)는 이 기능으로 변경되지 않는다.
- RLS는 `part_sync_relations` 컨벤션과 동일: 로그인 여부만 체크, 역할별 세분화 없음.
- 새 라이브러리 추가 금지 — 기존 설치된 `@mui/x-date-pickers`, `date-fns`만 사용.
- 메뉴 노출은 `MENU_KEYS` + `hasMenuAccess` + `PermissionRoute` 기존 패턴을 그대로 따른다. 별도로 `UserMenuSettings.jsx`의 `AVAILABLE_PERMISSIONS` 배열도 동기화해야 관리자 화면에서 권한 부여가 가능하다 (스펙 문서에는 없던 추가 발견 사항, 이 플랜에서 포함).
- 이 프로젝트에는 자동화 테스트가 없다 (`CLAUDE.md`: "No linting or type checking scripts configured"). 모든 태스크의 "테스트" 스텝은 브라우저 수동 검증 절차로 대체한다.

---

### Task 1: DB 마이그레이션 — `purchase_orders` 테이블

**Files:**
- Create: `supabase/migrations/20260924_create_purchase_orders.sql`

**Interfaces:**
- Produces: 테이블 `public.purchase_orders(id uuid, part_id integer, order_date date, quantity integer, received boolean, received_at timestamptz, updated_at timestamptz)`, unique 제약 `(part_id, order_date)`. 이후 모든 태스크가 이 스키마로 upsert/select한다.

- [ ] **Step 1: 실제 `parts.id` 컬럼 타입 확인**

Supabase 대시보드 SQL Editor 또는 `psql`에서 아래 쿼리 실행:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'parts' AND column_name = 'id';
```

`data_type`이 `integer`가 아니면(예: `bigint`, `uuid`), 아래 Step 2의 `part_id integer`를 실제 타입으로 바꿔서 진행한다. (앱 코드의 `Number(part.id)` 사용 패턴상 숫자 타입일 가능성이 높음 — `bigint`면 `bigint`로, `uuid`면 이 플랜 전체에서 `part_id`를 `uuid`로 바꿔야 함.)

- [ ] **Step 2: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260924_create_purchase_orders.sql

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

- [ ] **Step 3: Supabase에 마이그레이션 적용**

Supabase 대시보드 SQL Editor에서 위 SQL 전체 실행 (이 프로젝트는 로컬 Supabase CLI 마이그레이션 자동 적용 파이프라인이 없으므로 수동 실행).

- [ ] **Step 4: 수동 검증**

SQL Editor에서:
```sql
INSERT INTO public.purchase_orders (part_id, order_date, quantity)
VALUES ((SELECT id FROM public.parts LIMIT 1), '2026-09-24', 5);

SELECT * FROM public.purchase_orders;

DELETE FROM public.purchase_orders WHERE order_date = '2026-09-24';
```
Expected: insert 성공, select에 1행 표시, delete 성공. RLS 정책 때문에 실패하면(비로그인 SQL Editor 세션은 `service_role`로 실행되므로 보통 통과함) 정책 재확인.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260924_create_purchase_orders.sql
git commit -m "feat: purchase_orders 테이블 마이그레이션 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: 메뉴/권한/라우팅 배선 (스켈레톤 페이지)

**Files:**
- Modify: `src/config/menuConfig.js:132-165` (`MENU_KEYS` 객체)
- Modify: `src/components/Settings/UserMenuSettings.jsx:31-` (`AVAILABLE_PERMISSIONS` 배열)
- Modify: `src/components/Layout.jsx:343-354` (기초등록 `children` 배열)
- Modify: `src/App.jsx:22` (import), `src/App.jsx:108` 인근 (route 추가)
- Create: `src/components/Purchase/PurchaseOrderManagement.jsx` (이 태스크에서는 최소 스켈레톤만, 본문은 Task 3~7에서 채움)

**Interfaces:**
- Consumes: `MENU_KEYS`(from `src/config/menuConfig.js`), `PermissionRoute`(from `src/components/Auth/PermissionRoute.jsx`, props `requiredPermission`), `hasMenuAccess`.
- Produces: `MENU_KEYS.PURCHASE_ORDERS = 'purchase_orders'` — Task 3~7의 `PurchaseOrderManagement.jsx`가 이 값을 직접 참조하지는 않지만, 라우트/메뉴 가시성 제어는 이 키에 의존함.

- [ ] **Step 1: `MENU_KEYS`에 신규 키 추가**

`src/config/menuConfig.js:164` (`CHATBOT_FAQ: 'chatbot_faq',` 다음 줄)에 추가:

```js
  CHATBOT_FAQ: 'chatbot_faq',
  PURCHASE_ORDERS: 'purchase_orders',
};
```

- [ ] **Step 2: 관리자 권한 설정 화면에 항목 추가**

`src/components/Settings/UserMenuSettings.jsx:43` (`{ key: 'parts', label: '상품 관리' },` 다음 줄)에 추가:

```js
  { key: 'parts', label: '상품 관리' },
  { key: 'purchase_orders', label: '발주 관리' },
```

- [ ] **Step 3: Layout.jsx 기초등록 메뉴에 항목 추가**

`src/components/Layout.jsx:349` (상품 관리 children 항목 바로 아래)에 추가. 아이콘은 이미 import되어 있는 `CalendarTodayIcon` 재사용(날짜 그리드 화면 성격과 일치, 신규 import 불필요):

```js
      children: [
        { text: '상품 관리', icon: <InventoryIcon />, path: '/parts', key: 'parts' },
        { text: '발주 관리', icon: <CalendarTodayIcon />, path: '/purchase-orders', key: 'purchaseOrders' },
        { text: '거래처 관리', icon: <InventoryIcon />, path: '/agencies', key: 'agencies' },
        { text: '고객 관리', icon: <PeopleIcon />, path: '/customers', key: 'customers' },
      ]
```

- [ ] **Step 4: 최소 스켈레톤 컴포넌트 생성**

`src/components/Purchase/PurchaseOrderManagement.jsx` (신규 파일):

```jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

function PurchaseOrderManagement() {
  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>발주 관리</Typography>
    </Box>
  );
}

export default PurchaseOrderManagement;
```

- [ ] **Step 5: App.jsx에 import + route 추가**

`src/App.jsx:22` (`import PartsManagement ...` 다음 줄)에 추가:

```js
import PartsManagement from './components/Service/PartsManagement';
import PurchaseOrderManagement from './components/Purchase/PurchaseOrderManagement';
```

`src/App.jsx:108` (`parts` route) 다음 줄에 추가:

```jsx
          <Route path="parts" element={<PermissionRoute requiredPermission={MENU_KEYS.PARTS}><PartsManagement /></PermissionRoute>} />
          <Route path="purchase-orders" element={<PermissionRoute requiredPermission={MENU_KEYS.PURCHASE_ORDERS}><PurchaseOrderManagement /></PermissionRoute>} />
```

- [ ] **Step 6: 수동 검증**

1. `npm start`
2. 마스터 계정으로 로그인 → 사이드바 "기초등록 > 발주 관리" 메뉴 노출 확인, 클릭 시 `/purchase-orders`로 이동하고 "발주 관리" 제목만 뜨는 빈 화면 확인
3. 설정 > 사용자 메뉴 권한 화면에서 "발주 관리" 항목이 체크박스 목록에 나타나는지 확인
4. 해당 메뉴 권한이 없는 일반 계정으로 로그인 → 사이드바에 "발주 관리" 항목이 보이지 않는지, `/purchase-orders` 직접 접근 시 접근 제한 화면이 뜨는지 확인

- [ ] **Step 7: 커밋**

```bash
git add src/config/menuConfig.js src/components/Settings/UserMenuSettings.jsx src/components/Layout.jsx src/App.jsx src/components/Purchase/PurchaseOrderManagement.jsx
git commit -m "feat: 발주 관리 메뉴/라우트 배선 (스켈레톤 페이지)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: 좌측 상품 리스트 패널 (읽기 전용)

**Files:**
- Modify: `src/components/Purchase/PurchaseOrderManagement.jsx`

**Interfaces:**
- Consumes: `supabase`(from `src/lib/supabaseClient.js`), `safeRetry`/`getErrorMessage`/`isOffline`(from `src/utils/networkUtils.js`).
- Produces: 컴포넌트 내부 state `parts`(배열, `{id, name, brand, code, track_inventory}[]`), `selectedPartId`(number|null) — Task 4~7의 그리드가 `selectedPartId` 대신 **전체 `parts` 리스트를 행으로 렌더링**하므로, 실제로는 `parts` state와 검색 필터 state `searchTerm`만 이후 태스크가 그대로 사용. (참고: 발주관리는 상품 1개 선택이 아니라 상품별 행 전체를 그리드로 보여주는 구조 — 스펙 75행 "왼쪽: 상품 리스트... / 오른쪽: ... 각 셀" 참조. 좌측 리스트는 검색/필터 + 스크롤 동기화용 참고 패널이며, 우측 그리드의 각 행이 곧 상품 하나임)

- [ ] **Step 1: 데이터 로딩 + 검색 UI 구현**

`src/components/Purchase/PurchaseOrderManagement.jsx` 전체 교체:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { supabase } from '../../lib/supabaseClient';
import { safeRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';

function PurchaseOrderManagement() {
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchParts = useCallback(async () => {
    setLoadingParts(true);
    try {
      if (isOffline()) {
        showSnackbar('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return;
      }
      const { data, error } = await safeRetry(() =>
        supabase.from('parts').select('id, name, brand, code, track_inventory').order('brand').order('name')
      );
      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingParts(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const filteredParts = parts.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.brand || '').toLowerCase().includes(term) ||
      (p.code || '').toLowerCase().includes(term)
    );
  });

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h5" gutterBottom>발주 관리</Typography>

      <TextField
        size="small"
        placeholder="브랜드/코드/이름 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, width: 300 }}
      />

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <TableContainer component={Paper} sx={{ maxWidth: 500 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>브랜드</TableCell>
                <TableCell>코드</TableCell>
                <TableCell>이름</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.brand}</TableCell>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PurchaseOrderManagement;
```

- [ ] **Step 2: 수동 검증**

`npm start` → `/purchase-orders` 접속 → 상품 리스트가 브랜드/이름순으로 표시되는지, 검색창에 부품 이름/브랜드/코드 일부를 입력했을 때 필터링되는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/components/Purchase/PurchaseOrderManagement.jsx
git commit -m "feat: 발주 관리 - 상품 리스트 조회/검색

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: 년/월 선택 + 일자별 그리드 스켈레톤 (데이터 없이 컬럼만)

**Files:**
- Modify: `src/components/Purchase/PurchaseOrderManagement.jsx`

**Interfaces:**
- Consumes: `parts`/`filteredParts`(Task 3에서 생성).
- Produces: state `selectedMonth`(Date, 해당 월의 1일 자정), 함수 `getDaysArray(date)` → `Date[]`(1일~말일). Task 5가 이 배열을 순회하며 셀을 렌더링한다.

- [ ] **Step 1: 년/월 피커 + 그리드 스켈레톤 추가**

`src/components/Purchase/PurchaseOrderManagement.jsx` import 구역에 추가:

```jsx
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { startOfMonth, getDaysInMonth, format } from 'date-fns';
```

컴포넌트 내부에 state 및 헬퍼 추가 (`searchTerm` state 선언 다음 줄):

```jsx
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));

  const getDaysArray = (monthStart) => {
    const total = getDaysInMonth(monthStart);
    return Array.from({ length: total }, (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1));
  };

  const days = getDaysArray(selectedMonth);
```

렌더링에서 검색창 아래, 좌측 리스트 테이블 위쪽에 년/월 선택 UI 추가하고, 전체 레이아웃을 좌우 분할로 변경 (기존 `TextField`~`TableContainer` 블록을 아래로 교체):

```jsx
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
        <DatePicker
          views={['year', 'month']}
          label="년/월"
          value={selectedMonth}
          onChange={(newValue) => newValue && setSelectedMonth(startOfMonth(newValue))}
          slotProps={{ textField: { size: 'small', sx: { width: 160, mb: 2 } } }}
        />
      </LocalizationProvider>

      <TextField
        size="small"
        placeholder="브랜드/코드/이름 검색"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, ml: 2, width: 300 }}
      />

      {loadingParts ? (
        <CircularProgress size={24} />
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: '75vh', overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper', minWidth: 200 }}>
                  상품명
                </TableCell>
                {days.map((d) => (
                  <TableCell key={d.toISOString()} align="center" sx={{ minWidth: 90 }}>
                    {format(d, 'd')}일
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper' }}>
                    {p.brand} / {p.name}
                  </TableCell>
                  {days.map((d) => (
                    <TableCell key={d.toISOString()} align="center">
                      -
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
```

- [ ] **Step 2: 수동 검증**

`/purchase-orders` 접속 → 년/월 선택기 표시 확인, 월 변경 시 컬럼 개수가 해당 월의 일수(28~31)에 맞게 바뀌는지 확인, 좌측 상품명 컬럼이 가로 스크롤 시 고정(sticky)되는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/components/Purchase/PurchaseOrderManagement.jsx
git commit -m "feat: 발주 관리 - 년/월 선택 및 일자별 그리드 스켈레톤

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `purchase_orders` 데이터 로딩 + 셀 값 표시

**Files:**
- Modify: `src/components/Purchase/PurchaseOrderManagement.jsx`

**Interfaces:**
- Consumes: `selectedMonth`, `days`(Task 4).
- Produces: state `ordersMap`(`Map<string, {quantity:number, received:boolean, received_at:string|null}>`, 키 포맷 `` `${part_id}_${yyyy-MM-dd}` ``). Task 6/7의 셀 입력/체크박스가 이 맵을 읽고 쓴다.

- [ ] **Step 1: 조회 함수 + `ordersMap` 빌드**

`getDaysArray`/`days` 선언 다음에 추가:

```jsx
  const [ordersMap, setOrdersMap] = useState(new Map());
  const [loadingOrders, setLoadingOrders] = useState(true);

  const orderKey = (partId, dateObj) => `${partId}_${format(dateObj, 'yyyy-MM-dd')}`;

  const fetchOrders = useCallback(async (monthStart) => {
    setLoadingOrders(true);
    try {
      if (isOffline()) {
        showSnackbar('오프라인 상태입니다. 네트워크 연결을 확인하세요.', 'error');
        return;
      }
      const rangeStart = format(monthStart, 'yyyy-MM-dd');
      const rangeEnd = format(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0), 'yyyy-MM-dd');
      const { data, error } = await safeRetry(() =>
        supabase
          .from('purchase_orders')
          .select('part_id, order_date, quantity, received, received_at')
          .gte('order_date', rangeStart)
          .lte('order_date', rangeEnd)
      );
      if (error) throw error;
      const map = new Map();
      (data || []).forEach((row) => {
        map.set(`${row.part_id}_${row.order_date}`, {
          quantity: row.quantity,
          received: row.received,
          received_at: row.received_at,
        });
      });
      setOrdersMap(map);
    } catch (err) {
      showSnackbar(getErrorMessage(err), 'error');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(selectedMonth);
  }, [selectedMonth, fetchOrders]);
```

셀 렌더링(`-` 자리)을 실제 값으로 교체:

```jsx
                  {days.map((d) => {
                    const cell = ordersMap.get(orderKey(p.id, d)) || { quantity: 0, received: false };
                    return (
                      <TableCell key={d.toISOString()} align="center">
                        {cell.quantity || ''}
                      </TableCell>
                    );
                  })}
```

`{loadingParts ? ... : (` 조건을 `{(loadingParts || loadingOrders) ? ... : (`로 변경.

- [ ] **Step 2: 수동 검증**

Task 1의 Step 4에서 넣었던 테스트 insert(있다면 삭제됐으므로 재생성) 또는 SQL Editor에서 임의 행을 하나 넣고, 해당 월/상품/날짜 셀에 수량이 표시되는지 확인. 월 이동 시 그리드가 갱신되는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/components/Purchase/PurchaseOrderManagement.jsx
git commit -m "feat: 발주 관리 - 월별 발주 데이터 조회 및 셀 표시

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: 수량 셀 편집 + autosave (onBlur upsert + 실패 롤백)

**Files:**
- Modify: `src/components/Purchase/PurchaseOrderManagement.jsx`

**Interfaces:**
- Consumes: `ordersMap`, `orderKey`(Task 5).
- Produces: 함수 `handleQuantityBlur(partId, dateObj, newValue)` — Task 7과 동일한 upsert 패턴을 공유하되 필드만 다름.

- [ ] **Step 1: 수량 입력 필드로 셀 교체 + upsert 핸들러**

`fetchOrders` 다음에 추가:

```jsx
  const upsertOrder = async (partId, dateObj, patch) => {
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    const key = `${partId}_${dateStr}`;
    const prev = ordersMap.get(key) || { quantity: 0, received: false, received_at: null };
    const next = { ...prev, ...patch };

    setOrdersMap((m) => new Map(m).set(key, next));

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .upsert(
          { part_id: partId, order_date: dateStr, quantity: next.quantity, received: next.received, received_at: next.received_at },
          { onConflict: 'part_id,order_date' }
        );
      if (error) throw error;
    } catch (err) {
      setOrdersMap((m) => new Map(m).set(key, prev));
      showSnackbar(getErrorMessage(err), 'error');
    }
  };

  const handleQuantityBlur = (partId, dateObj, rawValue) => {
    const parsed = parseInt(rawValue, 10);
    const quantity = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const key = orderKey(partId, dateObj);
    const prev = ordersMap.get(key) || { quantity: 0, received: false };
    if (prev.quantity === quantity) return;
    upsertOrder(partId, dateObj, { quantity });
  };
```

셀 렌더링을 `TextField`로 교체:

```jsx
                  {days.map((d) => {
                    const cell = ordersMap.get(orderKey(p.id, d)) || { quantity: 0, received: false };
                    return (
                      <TableCell key={d.toISOString()} align="center" sx={{ p: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          defaultValue={cell.quantity || ''}
                          key={`${p.id}_${d.toISOString()}_${cell.quantity}`}
                          onBlur={(e) => handleQuantityBlur(p.id, d, e.target.value)}
                          inputProps={{ min: 0, style: { width: 50, textAlign: 'center' } }}
                        />
                      </TableCell>
                    );
                  })}
```

(`key`에 `cell.quantity`를 포함시켜, DB 반영 후 `ordersMap`이 바뀌면 `TextField`가 리마운트되어 `defaultValue`가 최신값으로 갱신되도록 함 — uncontrolled input의 표준 리셋 트릭.)

- [ ] **Step 2: 수동 검증**

셀에 숫자 입력 후 다른 곳 클릭(blur) → 새로고침 후에도 값 유지되는지 확인. 네트워크를 끊고(개발자도구 offline 모드) 값을 바꿔보고 실패 시 스낵바 에러 + 셀 값이 직전 값으로 롤백되는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/components/Purchase/PurchaseOrderManagement.jsx
git commit -m "feat: 발주 관리 - 수량 셀 autosave

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: 입고 체크박스 + autosave

**Files:**
- Modify: `src/components/Purchase/PurchaseOrderManagement.jsx`

**Interfaces:**
- Consumes: `upsertOrder`(Task 6).
- Produces: 함수 `handleReceivedChange(partId, dateObj, checked)`.

- [ ] **Step 1: 체크박스 추가 + 핸들러**

`handleQuantityBlur` 다음에 추가:

```jsx
  const handleReceivedChange = (partId, dateObj, checked) => {
    upsertOrder(partId, dateObj, {
      received: checked,
      received_at: checked ? new Date().toISOString() : null,
    });
  };
```

셀 렌더링에 체크박스 추가 (수량 `TextField` 아래):

```jsx
                  {days.map((d) => {
                    const cell = ordersMap.get(orderKey(p.id, d)) || { quantity: 0, received: false };
                    return (
                      <TableCell key={d.toISOString()} align="center" sx={{ p: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          defaultValue={cell.quantity || ''}
                          key={`${p.id}_${d.toISOString()}_${cell.quantity}`}
                          onBlur={(e) => handleQuantityBlur(p.id, d, e.target.value)}
                          inputProps={{ min: 0, style: { width: 50, textAlign: 'center' } }}
                        />
                        <Checkbox
                          size="small"
                          checked={!!cell.received}
                          onChange={(e) => handleReceivedChange(p.id, d, e.target.checked)}
                          sx={{ p: 0 }}
                        />
                      </TableCell>
                    );
                  })}
```

import 구역에 `Checkbox` 추가:

```jsx
import {
  Box, Typography, TextField, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Snackbar, Alert, CircularProgress, Checkbox,
} from '@mui/material';
```

- [ ] **Step 2: 수동 검증 (스펙의 전체 테스트 체크리스트 최종 실행)**

1. 수량 입력 → 새로고침 후 유지 확인
2. 입고 체크 on/off → 체크 유지 확인, SQL Editor에서 `received_at`이 on 시 채워지고 off 시 `null`로 돌아오는지 확인
3. 년/월 이동 시 그리드 갱신 확인 (다른 월은 빈 값으로 시작)
4. 상품 리스트 검색 필터링 확인 (그리드 행도 함께 필터링되는지)
5. 미인증/권한 없는 계정에서 메뉴 비노출 확인 (Task 2 Step 6에서 이미 확인했지만 최종 통합 후 재확인)
6. 상품 관리(`/parts`) 화면이 이번 작업으로 전혀 변경되지 않았는지 `git diff`로 확인 (`src/components/Service/PartsManagement.jsx` 미변경 확인)

- [ ] **Step 3: 커밋**

```bash
git add src/components/Purchase/PurchaseOrderManagement.jsx
git commit -m "feat: 발주 관리 - 입고 체크박스 autosave

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review 결과

- **Spec coverage**: 배경/목적, 데이터 모델(DDL/RLS 100% 동일), 화면/라우팅, UI/상호작용(년월 선택, 좌우 분할, sticky, autosave, 에러 롤백), 테스트 체크리스트, YAGNI 항목 모두 태스크로 매핑됨. 스펙에 없던 `UserMenuSettings.jsx` 동기화는 Task 2에 추가 반영.
- **Placeholder scan**: 전 태스크 코드 블록에 TODO/TBD 없음. 모든 스텝이 실행 가능한 구체 코드/명령.
- **Type consistency**: `orderKey(partId, dateObj)` 시그니처가 Task 5에서 정의되고 Task 6·7에서 동일하게 사용됨. `upsertOrder(partId, dateObj, patch)`가 Task 6에서 정의되고 Task 7에서 동일 시그니처로 재사용됨. `ordersMap` 키 포맷 `` `${part_id}_${yyyy-MM-dd}` `` 전 태스크 일관.

---

**Execution 선택 필요:**

1. **Subagent-Driven (권장)** — 태스크별 새 서브에이전트 디스패치, 태스크 사이 리뷰, 빠른 반복
2. **Inline Execution** — 이 세션에서 순차 실행, 체크포인트마다 확인

어느 방식으로 진행할지 선택해줘.
