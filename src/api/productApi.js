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
