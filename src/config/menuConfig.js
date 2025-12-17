/**
 * 이메일 기반 메뉴 권한 설정
 * 
 * 사용법:
 * 1. 특정 이메일에 'all' 지정 → 모든 메뉴 접근
 * 2. 특정 이메일에 배열 지정 → 해당 메뉴만 접근
 * 3. 설정 없는 이메일 → 'default' 권한 적용
 */

export const MENU_CONFIG = {
  // ========================================
  // 관리자 계정 (모든 메뉴 접근)
  // ========================================
  'admin@xrider.com': 'all',
  'manager@xrider.com': 'all',
  'master@slimpack.com': 'all',  // Slimpack 관리자
  
  // ========================================
  // A/S 담당자 (A/S 관련 메뉴만)
  // ========================================
  'service@xrider.com': [
    'dashboard',
    'customers',
    'services',
    'parts',
    'board'
  ],
  
  // ========================================
  // 재고 담당자 (재고 관련 메뉴만)
  // ========================================
  'stock@xrider.com': [
    'dashboard',
    'shipment',
    'parts',
    'stocks',
    // 'inventory_management',  // 입출고 관리 비활성화
    'board'
  ],
  
  // ========================================
  // 영업 담당자 (영업 관련 메뉴만)
  // ========================================
  'sales@xrider.com': [
    'dashboard',
    'customers',
    'shipment',
    'sales_stats',
    'board'
  ],
  
  // ========================================
  // CRM 담당자 (파츠/입출고/백업 제외)
  // ========================================
  'crm@slimpack.com': [
    'dashboard',        // 대시보드
    'customers',        // 고객 관리
    'services',         // A/S 관리
    'shipment',         // 출고 관리
    'stocks',           // 매장 재고 관리
    'sales_stats',      // 매출 통계
    'board'             // 게시판
    // 'parts',         // 파츠 관리 (제외)
    // 'inventory_management',  // 입출고 관리 (제외)
    // 'backup_management'      // 데이터 백업/복원 (제외)
  ],
  
  // ========================================
  // 기본 권한 (설정 없는 사용자)
  // ========================================
  'default': []  // 등록된 계정만 사용 (기타 사용자 접근 불가)
};

/**
 * 사용자 이메일로 메뉴 권한 가져오기
 * @param {string} userEmail - 사용자 이메일
 * @returns {string|Array} - 'all' 또는 메뉴 키 배열
 */
export const getUserMenuKeys = (userEmail) => {
  if (!userEmail) return [];
  
  // 이메일별 설정 확인
  const permissions = MENU_CONFIG[userEmail];
  
  // 'all' 권한
  if (permissions === 'all') {
    return 'all';
  }
  
  // 특정 메뉴 배열
  if (Array.isArray(permissions)) {
    return permissions;
  }
  
  // 기본 권한
  return MENU_CONFIG['default'];
};

/**
 * 사용자가 특정 메뉴에 접근 가능한지 확인
 * @param {string} userEmail - 사용자 이메일
 * @param {string} menuKey - 메뉴 키
 * @returns {boolean} - 접근 가능 여부
 */
export const hasMenuAccess = (userEmail, menuKey) => {
  const userMenuKeys = getUserMenuKeys(userEmail);
  
  if (userMenuKeys === 'all') {
    return true;
  }
  
  return userMenuKeys.includes(menuKey);
};

/**
 * 메뉴 키 목록
 * (참고용)
 */
export const MENU_KEYS = {
  DASHBOARD: 'dashboard',
  CUSTOMERS: 'customers',
  SERVICES: 'services',
  SHIPMENT: 'shipment',
  PARTS: 'parts',
  STOCKS: 'stocks',
  // INVENTORY: 'inventory_management', // 입출고 관리 비활성화
  SALES_STATS: 'sales_stats',
  BOARD: 'board',
  BACKUP: 'backup_management'
};

