import { supabase } from '../lib/supabaseClient';
import { fetchFromSupabase } from '../utils/restApiUtils';

// 옵션 C: 실제 운영 테이블/뷰(`parts`)을 읽기 전용 소스로 사용합니다.
// 브랜드 필터가 필요한 경우 .env 또는 public/env.js에 REACT_APP_PARTS_BRAND 를 설정하세요.
const PARTS_TABLE = 'parts';
const PARTS_BRAND = (typeof window !== 'undefined' && window._env_?.REACT_APP_PARTS_BRAND) || process.env.REACT_APP_PARTS_BRAND || '';

// parts 레코드를 인벤토리에서 사용하는 product 형태로 매핑
function mapPartToProduct(part) {
  return {
    id: part.id,
    code: part.code || '',
    barcode: part.barcode || '',
    name: part.name || '',
    category: part.category || null,
    price: Number(part.price) || 0,
    cost_price: part.cost_price ?? null, // parts에 없을 수 있음
    stock: Number(part.stock ?? 0) || 0, // parts에 재고 필드가 없다면 0으로 처리
    min_stock: Number(part.min_stock ?? 0) || 0,
    description: part.note || part.description || null,
    supplier: part.brand || part.supplier || null,
    status: 'active',
    _source: 'parts'
  };
}

// 임시 니어바이크 상품 데이터
const tempNearbikeProducts = [
  { id: 'nb-frame-001', code: 'NB-FRAME-001', name: '니어바이크 프레임 모델 A', category: '프레임', price: 450000, cost_price: 320000, stock: 25, min_stock: 5, description: '고급 알루미늄 합금 프레임, 경량화 설계', supplier: '니어바이크', status: 'active' },
  { id: 'nb-frame-002', code: 'NB-FRAME-002', name: '니어바이크 프레임 모델 B', category: '프레임', price: 520000, cost_price: 380000, stock: 18, min_stock: 3, description: '카본 파이버 프레임, 최고급 모델', supplier: '니어바이크', status: 'active' },
  { id: 'nb-wheel-001', code: 'NB-WHEEL-001', name: '니어바이크 휠셋 표준형', category: '휠/타이어', price: 180000, cost_price: 125000, stock: 40, min_stock: 8, description: '26인치 표준 휠셋, 내구성 우수', supplier: '니어바이크', status: 'active' },
  { id: 'nb-wheel-002', code: 'NB-WHEEL-002', name: '니어바이크 휠셋 고급형', category: '휠/타이어', price: 250000, cost_price: 180000, stock: 22, min_stock: 5, description: '29인치 고급 휠셋, 경량 설계', supplier: '니어바이크', status: 'active' },
  { id: 'nb-brake-001', code: 'NB-BRAKE-001', name: '니어바이크 디스크 브레이크', category: '브레이크', price: 85000, cost_price: 58000, stock: 60, min_stock: 12, description: '유압 디스크 브레이크 시스템', supplier: '니어바이크', status: 'active' },
  { id: 'nb-brake-002', code: 'NB-BRAKE-002', name: '니어바이크 V브레이크', category: '브레이크', price: 35000, cost_price: 22000, stock: 80, min_stock: 15, description: '경제형 V브레이크 시스템', supplier: '니어바이크', status: 'active' },
  { id: 'nb-gear-001', code: 'NB-GEAR-001', name: '니어바이크 21단 변속기', category: '변속기', price: 120000, cost_price: 85000, stock: 35, min_stock: 7, description: '시마노 호환 21단 변속 시스템', supplier: '니어바이크', status: 'active' },
  { id: 'nb-gear-002', code: 'NB-GEAR-002', name: '니어바이크 27단 변속기', category: '변속기', price: 180000, cost_price: 128000, stock: 28, min_stock: 5, description: '고급 27단 변속 시스템', supplier: '니어바이크', status: 'active' },
  { id: 'nb-saddle-001', code: 'NB-SADDLE-001', name: '니어바이크 안장 컴포트', category: '안장/시트포스트', price: 45000, cost_price: 28000, stock: 100, min_stock: 20, description: '편안한 젤 패드 안장', supplier: '니어바이크', status: 'active' },
  { id: 'nb-saddle-002', code: 'NB-SADDLE-002', name: '니어바이크 안장 스포츠', category: '안장/시트포스트', price: 65000, cost_price: 42000, stock: 75, min_stock: 15, description: '스포츠용 경량 안장', supplier: '니어바이크', status: 'active' },
  { id: 'nb-handle-001', code: 'NB-HANDLE-001', name: '니어바이크 핸들바 표준', category: '핸들바/스템', price: 38000, cost_price: 24000, stock: 90, min_stock: 18, description: '알루미늄 핸들바, 표준형', supplier: '니어바이크', status: 'active' },
  { id: 'nb-handle-002', code: 'NB-HANDLE-002', name: '니어바이크 핸들바 에어로', category: '핸들바/스템', price: 58000, cost_price: 38000, stock: 45, min_stock: 10, description: '에어로 다이나믹 핸들바', supplier: '니어바이크', status: 'active' },
  { id: 'nb-pedal-001', code: 'NB-PEDAL-001', name: '니어바이크 페달 기본형', category: '페달', price: 25000, cost_price: 15000, stock: 120, min_stock: 25, description: '플라스틱 기본 페달', supplier: '니어바이크', status: 'active' },
  { id: 'nb-pedal-002', code: 'NB-PEDAL-002', name: '니어바이크 페달 알루미늄', category: '페달', price: 45000, cost_price: 28000, stock: 85, min_stock: 18, description: '알루미늄 고급 페달', supplier: '니어바이크', status: 'active' },
  { id: 'nb-chain-001', code: 'NB-CHAIN-001', name: '니어바이크 체인 표준', category: '체인/스프라켓', price: 18000, cost_price: 11000, stock: 150, min_stock: 30, description: 'KMC 호환 표준 체인', supplier: '니어바이크', status: 'active' },
  { id: 'nb-light-001', code: 'NB-LIGHT-001', name: '니어바이크 LED 전조등', category: '조명/액세서리', price: 35000, cost_price: 22000, stock: 65, min_stock: 12, description: 'USB 충전식 LED 전조등', supplier: '니어바이크', status: 'active' },
  { id: 'nb-light-002', code: 'NB-LIGHT-002', name: '니어바이크 LED 후미등', category: '조명/액세서리', price: 25000, cost_price: 15000, stock: 80, min_stock: 15, description: 'USB 충전식 LED 후미등', supplier: '니어바이크', status: 'active' },
  { id: 'nb-helmet-001', code: 'NB-HELMET-001', name: '니어바이크 헬멧 기본형', category: '헬멧/보호장비', price: 55000, cost_price: 35000, stock: 45, min_stock: 10, description: '안전 인증 기본 헬멧', supplier: '니어바이크', status: 'active' },
  { id: 'nb-helmet-002', code: 'NB-HELMET-002', name: '니어바이크 헬멧 고급형', category: '헬멧/보호장비', price: 85000, cost_price: 58000, stock: 32, min_stock: 8, description: '통풍 시스템 고급 헬멧', supplier: '니어바이크', status: 'active' },
  { id: 'nb-tool-001', code: 'NB-TOOL-001', name: '니어바이크 멀티툴', category: '공구/정비용품', price: 28000, cost_price: 18000, stock: 95, min_stock: 20, description: '15가지 기능 멀티툴', supplier: '니어바이크', status: 'active' }
];

export const productApi = {
  // 모든 상품 조회 (옵션 C: parts 테이블 기반, 읽기 전용) - REST API 버전
  getAll: async (retryCount = 0) => {
    try {
      console.log(`[ProductAPI] Fetching products via REST API... (retry: ${retryCount})`);
      
      // 필터 구성
      let filter = '';
      if (PARTS_BRAND) {
        filter = `brand=eq.${encodeURIComponent(PARTS_BRAND)}`;
      }

      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('제품 데이터 로딩 시간 초과')), 10000)
      );

      const dataPromise = fetchFromSupabase(PARTS_TABLE, {
        select: 'id,code,barcode,name,price,brand,note',
        filter: filter,
        order: 'name.asc'
      });

      const data = await Promise.race([dataPromise, timeoutPromise]);
      
      console.log('[ProductAPI] Products data received:', data?.length || 0, 'items');
      
      if (data && data.length > 0) {
        console.log(`Supabase parts에서 ${data.length}개의 실제 파츠를 가져왔습니다.${PARTS_BRAND ? ` (brand=${PARTS_BRAND})` : ''}`);
        return data.map(mapPartToProduct);
      } else {
        console.log('Supabase parts 결과가 비어있습니다.');
        return [];
      }
    } catch (error) {
      console.error(`[ProductAPI] Error fetching products (retry: ${retryCount}):`, error);
      
      // 타임아웃 또는 네트워크 오류 시 재시도
      const isTimeout = error.message?.includes('시간 초과') || 
                       error.message?.includes('timeout') ||
                       error.name === 'AbortError';
      
      if (retryCount < 2 && (
        isTimeout ||
        error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch')
      )) {
        const delay = isTimeout ? 0 : 1000 * (retryCount + 1);
        console.log(`[ProductAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return productApi.getAll(retryCount + 1);
      }
      
      return [];
    }
  },

  // 카테고리별 상품 조회 (parts: category 컬럼이 없을 수 있어 미지원)
  getByCategory: async (category) => {
    console.warn('[productApi.getByCategory] parts 소스는 category 필드가 없어 필터링을 지원하지 않습니다.');
    return [];
  },

  // 상품 검색 (parts: name/code/note 검색)
  search: async (searchTerm, retryCount = 0) => {
    try {
      console.log(`[ProductAPI] Searching products: "${searchTerm}" (retry: ${retryCount})`);
      
      let filterExpr = `name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%`;
      let query = supabase
        .from(PARTS_TABLE)
        .select('id, code, barcode, name, price, brand, note')
        .or(filterExpr);

      if (PARTS_BRAND) {
        query = query.eq('brand', PARTS_BRAND);
      }

      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('제품 검색 시간 초과')), 10000)
      );

      const { data, error } = await Promise.race([
        query.order('name', { ascending: true }),
        timeoutPromise
      ]);
      
      if (error) {
        console.error('Supabase parts 검색 오류:', error);
        throw error;
      }
      
      return (data || []).map(mapPartToProduct);
    } catch (error) {
      console.error(`[ProductAPI] Error searching products (retry: ${retryCount}):`, error);
      
      // 타임아웃 또는 네트워크 오류 시 재시도
      const isTimeout = error.message?.includes('시간 초과') || 
                       error.message?.includes('timeout') ||
                       error.name === 'AbortError';
      
      if (retryCount < 2 && (
        isTimeout ||
        error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch')
      )) {
        const delay = isTimeout ? 0 : 1000 * (retryCount + 1);
        console.log(`[ProductAPI] ${isTimeout ? '타임아웃 -' : ''} 검색 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return productApi.search(searchTerm, retryCount + 1);
      }
      
      return [];
    }
  },

  // 상품 생성 (옵션 C: 읽기 전용 - 미지원)
  create: async (productData) => {
    console.warn('[productApi.create] parts 소스는 읽기 전용입니다. 생성이 불가합니다.');
    throw new Error('Parts source is read-only');
  },

  // 상품 수정 (옵션 C: 읽기 전용 - 미지원)
  update: async (id, updates) => {
    console.warn('[productApi.update] parts 소스는 읽기 전용입니다. 수정이 불가합니다.');
    throw new Error('Parts source is read-only');
  },

  // 상품 삭제 (옵션 C: 읽기 전용 - 미지원)
  delete: async (id) => {
    console.warn('[productApi.delete] parts 소스는 읽기 전용입니다. 삭제가 불가합니다.');
    throw new Error('Parts source is read-only');
  },

  // 재고 업데이트 (옵션 C: parts에는 재고 마스터가 없으므로 미지원)
  updateStock: async (id, newStock) => {
    console.warn('[productApi.updateStock] parts 소스는 재고 마스터가 없어 업데이트 불가합니다.');
    throw new Error('Parts source does not support stock updates');
  },

  // 카테고리 목록 조회 (parts: category 미운영 가정 → 빈 배열)
  getCategories: async () => {
    return [];
  },

  // 재고 부족 상품 조회 (parts에는 재고 마스터가 없어 빈 배열)
  getLowStockProducts: async () => {
    return [];
  }
}
