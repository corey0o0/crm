/**
 * 이메일 기반 메뉴 권한 동적 설정
 * 
 * 동적 권한(userMenuPermissions)을 받아와서 사용자별 메뉴를 반환합니다.
 */

// 관리자 계정 (모든 메뉴 무조건 접근 가능)
export const MASTER_ACCOUNTS = [
  'admin@xrider.com',
  'manager@xrider.com',
  'master@slimpack.com'
];

/**
 * 사용자 이메일로 메뉴 권한 가져오기
 * @param {string} userEmail - 사용자 이메일
 * @param {object} dynamicSettings - DB에서 불러온 사용자별 메뉴 권한 맵 {"email": ["menu1", "menu2"]}
 * @returns {string|Array} - 'all' 또는 메뉴 키 배열
 */
export const getUserMenuKeys = (userEmail, dynamicSettings = {}) => {
  if (!userEmail) return [];

  // 가장 먼저 마스터 계정인지 확인
  if (MASTER_ACCOUNTS.includes(userEmail)) {
    return 'all';
  }

  // DB에 저장된 동적 커스텀 권한이 있는지 확인
  if (dynamicSettings && dynamicSettings[userEmail]) {
    return dynamicSettings[userEmail];
  }

  // 기본 권한 (설정 없는 사용자)
  return []; 
};

/**
 * 사용자가 특정 메뉴에 접근 가능한지 확인
 * @param {string} userEmail - 사용자 이메일
 * @param {string} menuKey - 메뉴 키
 * @param {object} dynamicSettings - DB에서 불러온 사용자별 메뉴 권한 맵
 * @returns {boolean} - 접근 가능 여부
 */
export const hasMenuAccess = (userEmail, menuKey, dynamicSettings = {}) => {
  const userMenuKeys = getUserMenuKeys(userEmail, dynamicSettings);

  if (userMenuKeys === 'all') {
    return true;
  }

  if (Array.isArray(userMenuKeys)) {
    return userMenuKeys.includes(menuKey);
  }
  
  return false;
};

/**
 * 시스템에서 사용되는 모든 메뉴 키 목록
 */
export const MENU_KEYS = {
  DASHBOARD: 'dashboard',
  CUSTOMERS: 'customers',
  SERVICES: 'services',
  SHIPMENT: 'shipment',
  PARTS: 'parts',
  STOCKS: 'stocks',
  INVENTORY: 'inventory_management', // 입출고 관리
  SALES_STATS: 'sales_stats',
  BOARD_GROUP: 'board_group',
  BOARD_INTERNAL: 'board_internal',
  BOARD_CAFE24: 'board_cafe24',
  PENDING_ORDERS: 'pending_orders',
  BACKUP: 'backup_management',
  ADMIN_TOOLS: 'admin_tools',
  CAFE24_ORDERS: 'cafe24_orders',
  OUTBOUND_SCAN: 'outbound_scan',
  INVENTORY_GROUP: 'inventory_group',
  INVENTORY_STATUS: 'inventory_status',
  INVENTORY_STATS: 'inventory_stats'
};

