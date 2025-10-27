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
    'inventory_management',
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
  // 기본 권한 (설정 없는 사용자)
  // ========================================
  'default': [
    'dashboard',
    'services',
    'board'
  ]
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
  INVENTORY: 'inventory_management',
  SALES_STATS: 'sales_stats',
  BOARD: 'board',
  BACKUP: 'backup_management'
};

