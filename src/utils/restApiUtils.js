/**
 * Supabase REST API 직접 호출 유틸리티
 * Supabase JS SDK의 idle 연결 문제를 우회하기 위한 함수들
 */

import { supabase } from '../lib/supabaseClient';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.');
}

/**
 * 현재 사용자 세션 토큰 가져오기
 * @returns {Promise<string>} 사용자 토큰 또는 anon key
 */
const getAuthToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    }
  } catch (error) {
    console.warn('[REST API] 세션 토큰 가져오기 실패:', error);
  }
  return supabaseKey;
};

/**
 * 기본 REST API 호출 함수
 * @param {string} table - 테이블 이름
 * @param {Object} options - 쿼리 옵션
 * @param {string} options.select - 선택할 컬럼들
 * @param {string} options.filter - 필터 조건
 * @param {string} options.order - 정렬 조건
 * @param {number} options.limit - 제한 개수
 * @param {AbortSignal} options.signal - AbortController signal
 * @returns {Promise<Array>} 조회 결과
 */
export const fetchFromSupabase = async (table, options = {}) => {
  const {
    select = '*',
    filter = '',
    order = '',
    limit = null,
    offset = 0,
    signal = null
  } = options;

  // URL 구성
  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

  if (filter) {
    url += `&${filter}`;
  }

  if (order) {
    url += `&order=${encodeURIComponent(order)}`;
  }

  if (limit !== null && limit !== undefined && limit !== 'none') {
    url += `&limit=${limit}`;
  }
  if (offset !== null && offset !== undefined && offset > 0) {
    url += `&offset=${offset}`;
  }

  console.log(`[REST API] Fetching from ${table}:`, url.substring(0, 150) + '...');

  // 사용자 세션 토큰 가져오기
  const authToken = await getAuthToken();

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    signal
  });

  console.log(`[REST API] ${table} response status:`, response.status);

  if (!response.ok) {
    throw new Error(`REST API error for ${table}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`[REST API] ${table} data received:`, data?.length || 0, 'items');

  return data;
};

/**
 * 카운트 조회 함수
 * @param {string} table - 테이블 이름
 * @param {string} filter - 필터 조건
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise<number>} 총 개수
 */
export const countFromSupabase = async (table, filter = '', signal = null) => {
  let url = `${supabaseUrl}/rest/v1/${table}?select=count`;

  if (filter) {
    url += `&${filter}`;
  }

  console.log(`[REST API] Counting from ${table}:`, url.substring(0, 150) + '...');

  // 사용자 세션 토큰 가져오기
  const authToken = await getAuthToken();

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact'
    },
    signal
  });

  console.log(`[REST API] ${table} count response status:`, response.status);

  if (!response.ok) {
    throw new Error(`REST API count error for ${table}: ${response.status} ${response.statusText}`);
  }

  // Content-Range 헤더에서 총 개수 추출
  const contentRange = response.headers.get('Content-Range');
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)$/);
    if (match) {
      const count = parseInt(match[1], 10);
      console.log(`[REST API] ${table} total count:`, count);
      return count;
    }
  }

  // 헤더가 없으면 응답 데이터에서 추출
  const data = await response.json();
  const count = data?.[0]?.count || 0;
  console.log(`[REST API] ${table} count from data:`, count);

  return count;
};

/**
 * 서비스 데이터 조회 (브랜드 필터링 포함)
 */
export const fetchServices = async (options = {}) => {
  const {
    selectedBrand = '',
    searchTerm = '',
    statusFilter = '',
    page = 0,
    pageSize = 50,
    offset,
    signal = null
  } = options;

  // 필터 조건 구성
  let filter = '';
  const filters = [];

  if (selectedBrand && selectedBrand !== 'ALL') {
    filters.push(`brand=eq.${encodeURIComponent(selectedBrand)}`);
  }

  if (searchTerm) {
    const safeTerm = searchTerm.replace(/["]/g, '').replace(/,/g, ' ').trim();
    filters.push(`or=(customer_name.ilike.*${encodeURIComponent(safeTerm)}*,product_name.ilike.*${encodeURIComponent(safeTerm)}*,phone.ilike.*${encodeURIComponent(safeTerm)}*)`);
  }

  if (statusFilter) {
    filters.push(`status=eq.${encodeURIComponent(statusFilter)}`);
  }

  if (filters.length > 0) {
    filter = filters.join('&');
  }

  // 페이지네이션
  const actualOffset = offset !== undefined ? offset : page * pageSize;

  return fetchFromSupabase('services', {
    select: '*,service_tags(tag_name),service_parts(id,part_id,quantity,price,usage,parts(name,code))',
    filter: filter,
    order: 'reception_date.desc',
    limit: pageSize,
    offset: actualOffset,
    signal
  });
};

/**
 * 서비스 데이터 카운트 (브랜드 필터링 포함)
 */
export const countServices = async (options = {}) => {
  const {
    selectedBrand = '',
    searchTerm = '',
    statusFilter = '',
    signal = null
  } = options;

  // 필터 조건 구성 (fetchServices와 동일)
  let filter = '';
  const filters = [];

  if (selectedBrand && selectedBrand !== 'ALL') {
    filters.push(`brand=eq.${encodeURIComponent(selectedBrand)}`);
  }

  if (searchTerm) {
    const safeTerm = searchTerm.replace(/["]/g, '').replace(/,/g, ' ').trim();
    filters.push(`or=(customer_name.ilike.*${encodeURIComponent(safeTerm)}*,product_name.ilike.*${encodeURIComponent(safeTerm)}*,phone.ilike.*${encodeURIComponent(safeTerm)}*)`);
  }

  if (statusFilter) {
    filters.push(`status=eq.${encodeURIComponent(statusFilter)}`);
  }

  if (filters.length > 0) {
    filter = filters.join('&');
  }

  return countFromSupabase('services', filter, signal);
};

/**
 * 출고 데이터 조회 (브랜드 및 날짜 필터링 포함)
 */
// 파츠명으로 매칭되는 출고 ID 조회 (shipment_parts는 별도 테이블이라 or= 절에 직접 넣을 수 없음)
const fetchShipmentIdsByPartName = async (term, signal) => {
  const rows = await fetchFromSupabase('shipment_parts', {
    select: 'shipment_id',
    filter: `part_name=ilike.*${encodeURIComponent(term)}*`,
    signal
  });
  return [...new Set((rows || []).map(r => r.shipment_id).filter(Boolean))];
};

// 공통 필터 생성 유틸리티
const buildShipmentFilters = async (options) => {
  const {
    selectedBrand = '',
    searchTerm = '',
    dateFilter = {},
    statusFilter = 'all',
    sellerFilter = 'all',
    recordType = 'store_shipment', // 기본값은 매장출고
    signal = null
  } = options;

  const filters = [];

  if (selectedBrand && selectedBrand !== 'ALL') {
    filters.push(`brand=eq.${encodeURIComponent(selectedBrand)}`);
  }

  if (recordType) {
    filters.push(`record_type=eq.${encodeURIComponent(recordType)}`);
  }

  if (statusFilter && statusFilter !== 'all') {
    filters.push(`status=eq.${encodeURIComponent(statusFilter)}`);
  }

  if (sellerFilter && sellerFilter !== 'all') {
    if (sellerFilter === '공홈') {
      filters.push(`or=(sales_channel.eq.${encodeURIComponent('공홈')},sales_channel.is.null,sales_channel.eq.)`);
    } else {
      filters.push(`sales_channel=eq.${encodeURIComponent(sellerFilter)}`);
    }
  }

  if (dateFilter.startDate && dateFilter.endDate) {
    const startDate = dateFilter.startDate;
    const endDate = dateFilter.endDate;

    if (dateFilter.type === 'order_date') {
      filters.push(`order_date=gte.${startDate}`);
      filters.push(`order_date=lte.${endDate}`);
    } else if (dateFilter.type === 'completion_date') {
      filters.push(`shipment_date=gte.${startDate}`);
      filters.push(`shipment_date=lte.${endDate}`);
    }
  }

  if (searchTerm) {
    // PostgREST는 큰따옴표로 감싼(quoted) 값 안에서는 ilike의 * 와일드카드를 문자 그대로
    // 취급해 절대 매칭되지 않는다 — 따옴표 없이 보내야 실제로 검색됨(콤마만 제거해 or= 절 깨짐 방지)
    const safeTerm = searchTerm.replace(/["]/g, '').replace(/,/g, ' ').trim();
    // 공백으로 쪼갠 단어마다 or(...) 그룹을 만들고 and(...)로 묶어 — 순서 무관, 모든 단어 포함 매치
    const tokens = safeTerm.split(/\s+/).filter(Boolean);

    const buildTokenOrInner = async (token) => {
      const cleanTerm = token.replace(/^(shp-|SHP-)/i, '').trim();
      let idSearch = '';
      if (/^[a-fA-F0-9]{8}$/.test(cleanTerm)) {
        idSearch = `,and(id.gte.${cleanTerm}-0000-0000-0000-000000000000,id.lte.${cleanTerm}-ffff-ffff-ffff-ffffffffffff)`;
      }
      let partIdSearch = '';
      const matchingIds = await fetchShipmentIdsByPartName(token, signal);
      if (matchingIds.length > 0) {
        partIdSearch = `,id.in.(${matchingIds.join(',')})`;
      }
      return `customer_name.ilike.*${encodeURIComponent(token)}*,customer_phone.ilike.*${encodeURIComponent(token)}*,tracking_number.ilike.*${encodeURIComponent(token)}*,sales_channel.ilike.*${encodeURIComponent(token)}*,note.ilike.*${encodeURIComponent(token)}*${idSearch}${partIdSearch}`;
    };

    if (tokens.length === 1) {
      filters.push(`or=(${await buildTokenOrInner(tokens[0])})`);
    } else if (tokens.length > 1) {
      const groups = await Promise.all(tokens.map(async (t) => `or(${await buildTokenOrInner(t)})`));
      filters.push(`and=(${groups.join(',')})`);
    }
  }

  return filters.length > 0 ? filters.join('&') : '';
};

export const fetchShipments = async (options = {}) => {
  const {
    dateFilter = {},
    page = 0,
    pageSize = 50,
    signal = null
  } = options;

  const filter = await buildShipmentFilters(options);

  // 기준일자에 따른 DB 정렬 기준 동적 설정 (신규 항목 상단 보장)
  let orderString = 'created_at.desc,order_date.desc.nullslast';
  if (dateFilter.type === 'completion_date') {
    orderString = 'shipment_date.desc.nullslast,created_at.desc';
  }

  const offset = page * pageSize;

  return fetchFromSupabase('shipments', {
    select: '*,shipment_parts(id,part_name,part_category,quantity)',
    filter: filter,
    order: orderString,
    limit: pageSize,
    offset,
    signal
  });
};

/**
 * 출고 데이터 카운트 (브랜드 및 날짜 필터링 포함)
 */
export const countShipments = async (options = {}) => {
  const { signal = null } = options;
  const filter = await buildShipmentFilters(options);
  return countFromSupabase('shipments', filter, signal);
};

/**
 * 브랜드별 접수+부품준비 건수 조회
 */
export const countPendingAndShippingByBrand = async (brand, signal = null) => {
  try {
    // 각 상태를 개별적으로 조회하여 합산 (더 안정적)
    const [receptionCount, partsCount] = await Promise.all([
      countFromSupabase('shipments', `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('접수')}&record_type=eq.store_shipment`, signal),
      countFromSupabase('shipments', `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('부품준비')}&record_type=eq.store_shipment`, signal)
    ]);

    const totalCount = (receptionCount || 0) + (partsCount || 0);
    console.log(`[REST API] Brand ${brand} - 접수: ${receptionCount || 0}, 부품준비: ${partsCount || 0}, 합계: ${totalCount}`);

    return totalCount;
  } catch (error) {
    console.error(`[REST API] Error counting pending/shipping for brand ${brand}:`, error);
    return 0;
  }
};

/**
 * 브랜드별 접수건(최근 일주일) 및 처리중 건수 조회
 */
export const countServiceStatusByBrand = async (brand, signal = null) => {
  try {
    // 최근 일주일 계산
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0] + ' 00:00:00';

    // 접수건: 최근 일주일 내 접수된 것만
    const receptionCount = await countFromSupabase(
      'services',
      `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('준비중')}&reception_date=gte.${encodeURIComponent(oneWeekAgoStr)}`,
      signal
    );

    // 처리중건: 전체
    const processingCount = await countFromSupabase(
      'services',
      `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('부품준비')}`,
      signal
    );

    console.log(`[REST API] Brand ${brand} - 준비중(최근 일주일): ${receptionCount || 0}, 부품준비: ${processingCount || 0}`);

    return {
      reception: receptionCount || 0,
      processing: processingCount || 0
    };
  } catch (error) {
    console.error(`[REST API] Error counting service status for brand ${brand}:`, error);
    return { reception: 0, processing: 0 };
  }
};
