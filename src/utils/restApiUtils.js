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

  // Egress 절감을 위한 안전장치: limit이 명시되지 않으면 기본값 1000 적용
  // 무제한 조회를 방지하여 예상치 못한 대량 데이터 전송 방지
  const safeLimit = limit !== null ? limit : 1000;

  // URL 구성
  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  
  if (filter) {
    url += `&${filter}`;
  }
  
  if (order) {
    url += `&order=${encodeURIComponent(order)}`;
  }
  
  // limit이 null이어도 기본값 적용
  url += `&limit=${safeLimit}`;
  if (offset && Number.isFinite(offset) && offset > 0) {
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
    signal = null
  } = options;

  // 필터 조건 구성
  let filter = '';
  const filters = [];

  if (selectedBrand && selectedBrand !== 'ALL') {
    filters.push(`brand=eq.${encodeURIComponent(selectedBrand)}`);
  }

  if (searchTerm) {
    filters.push(`or=(customer_name.ilike.*${encodeURIComponent(searchTerm)}*,product_name.ilike.*${encodeURIComponent(searchTerm)}*,phone.ilike.*${encodeURIComponent(searchTerm)}*)`);
  }

  if (statusFilter) {
    filters.push(`status=eq.${encodeURIComponent(statusFilter)}`);
  }

  if (filters.length > 0) {
    filter = filters.join('&');
  }

  // 페이지네이션
  const offset = page * pageSize;

  return fetchFromSupabase('services', {
    select: '*,service_tags(tag_name),service_parts(id,part_id,quantity,price,usage,parts(name,code))',
    filter: filter,
    order: 'reception_date.desc',
    limit: pageSize,
    offset: offset,
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
    filters.push(`or=(customer_name.ilike.*${encodeURIComponent(searchTerm)}*,product_name.ilike.*${encodeURIComponent(searchTerm)}*,phone.ilike.*${encodeURIComponent(searchTerm)}*)`);
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
export const fetchShipments = async (options = {}) => {
  const {
    selectedBrand = '',
    dateFilter = {},
    page = 0,
    pageSize = 50,
    signal = null
  } = options;

  // 필터 조건 구성
  let filter = '';
  const filters = [];

  if (selectedBrand && selectedBrand !== 'ALL') {
    filters.push(`brand=eq.${encodeURIComponent(selectedBrand)}`);
  }

  // 날짜 필터 적용
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

  if (filters.length > 0) {
    filter = filters.join('&');
  }

  // 페이지네이션
  const offset = page * pageSize;
  
  return fetchFromSupabase('shipments', {
    select: '*',
    filter: filter,
    order: 'created_at.desc',
    limit: pageSize,
    offset,
    signal
  });
};

/**
 * 출고 데이터 카운트 (브랜드 및 날짜 필터링 포함)
 */
export const countShipments = async (options = {}) => {
  const {
    selectedBrand = '',
    dateFilter = {},
    signal = null
  } = options;

  // 필터 조건 구성 (fetchShipments와 동일)
  let filter = '';
  const filters = [];

  if (selectedBrand && selectedBrand !== 'ALL') {
    filters.push(`brand=eq.${encodeURIComponent(selectedBrand)}`);
  }

  // 날짜 필터 적용
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

  if (filters.length > 0) {
    filter = filters.join('&');
  }

  return countFromSupabase('shipments', filter, signal);
};

/**
 * 브랜드별 준비중+배송중 건수 조회
 */
export const countPendingAndShippingByBrand = async (brand, signal = null) => {
  try {
    // 각 상태를 개별적으로 조회하여 합산 (더 안정적)
    const [preparingCount, shippingCount] = await Promise.all([
      countFromSupabase('shipments', `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('준비중')}`, signal),
      countFromSupabase('shipments', `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('배송중')}`, signal)
    ]);
    
    const totalCount = (preparingCount || 0) + (shippingCount || 0);
    console.log(`[REST API] Brand ${brand} - 준비중: ${preparingCount || 0}, 배송중: ${shippingCount || 0}, 합계: ${totalCount}`);
    
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
      `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('접수')}&reception_date=gte.${encodeURIComponent(oneWeekAgoStr)}`,
      signal
    );
    
    // 처리중건: 전체
    const processingCount = await countFromSupabase(
      'services',
      `brand=eq.${encodeURIComponent(brand)}&status=eq.${encodeURIComponent('처리중')}`,
      signal
    );
    
    console.log(`[REST API] Brand ${brand} - 접수(최근 일주일): ${receptionCount || 0}, 처리중: ${processingCount || 0}`);
    
    return {
      reception: receptionCount || 0,
      processing: processingCount || 0
    };
  } catch (error) {
    console.error(`[REST API] Error counting service status for brand ${brand}:`, error);
    return { reception: 0, processing: 0 };
  }
};
