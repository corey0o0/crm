/**
 * 이메일 기반 메뉴 권한 동적 설정
 * 
 * 동적 권한(userMenuPermissions)을 받아와서 사용자별 메뉴를 반환합니다.
 */

// 마스터 계정 (모든 메뉴 무조건 접근 가능)
// ⚠️ 실제 존재하는 계정만 등록할 것 — 죽은 이메일을 남겨두면 추후 동일 이메일 가입 시 자동 마스터 권한 부여됨
export const MASTER_ACCOUNTS = [
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
    const userSettings = dynamicSettings[userEmail];
    if (Array.isArray(userSettings)) {
      return userSettings;
    }
    if (userSettings && typeof userSettings === 'object' && userSettings.menus) {
      return userSettings.menus;
    }
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
 * 사용자 이메일로 허용된 쇼핑몰(mall_id) 목록 가져오기
 * @param {string} userEmail - 사용자 이메일
 * @param {object} dynamicSettings - DB에서 불러온 사용자별 메뉴 권한 맵
 * @returns {string|Array} - 'all' 또는 쇼핑몰 키 배열
 */
export const getAllowedMalls = (userEmail, dynamicSettings = {}) => {
  if (!userEmail) return [];
  if (MASTER_ACCOUNTS.includes(userEmail)) return 'all';
  
  if (dynamicSettings && dynamicSettings[userEmail]) {
    const userSettings = dynamicSettings[userEmail];
    if (userSettings && !Array.isArray(userSettings) && typeof userSettings === 'object') {
       if (userSettings.malls && userSettings.malls.length > 0) {
           return userSettings.malls;
       }
    }
  }
  // 제한이 없거나 구버전 데이터면 'all'로 간주 (기존 기능 유지)
  return 'all';
};

/**
 * 사용자 이메일로 허용된 브랜드(XRB, NB) 목록 가져오기
 * @param {string} userEmail - 사용자 이메일
 * @param {object} dynamicSettings - DB에서 불러온 사용자별 메뉴 권한 맵
 * @returns {string|Array} - 'all' 또는 브랜드 키 배열 (['XRB'], ['NB'], ['XRB','NB'])
 */
export const getAllowedBrands = (userEmail, dynamicSettings = {}) => {
  if (!userEmail) return [];
  if (MASTER_ACCOUNTS.includes(userEmail)) return 'all';
  
  if (dynamicSettings && dynamicSettings[userEmail]) {
    const userSettings = dynamicSettings[userEmail];
    if (userSettings && !Array.isArray(userSettings) && typeof userSettings === 'object') {
       if (userSettings.brands && userSettings.brands.length > 0) {
           return userSettings.brands;
       }
    }
  }
  // 제한이 없으면 'all'로 간주
  return 'all';
};

/**
 * 사용자가 특정 동작 권한을 가지고 있는지 확인
 * @param {string} userEmail - 사용자 이메일
 * @param {string} actionKey - 동작 키 (예: 'can_edit_basic')
 * @param {object} dynamicSettings - DB에서 불러온 사용자별 메뉴 권한 맵
 * @returns {boolean} - 동작 권한 여부
 */
export const hasActionPermission = (userEmail, actionKey, dynamicSettings = {}) => {
  if (!userEmail) return false;
  if (MASTER_ACCOUNTS.includes(userEmail)) return true;

  if (dynamicSettings && dynamicSettings[userEmail]) {
    const userSettings = dynamicSettings[userEmail];
    if (userSettings && !Array.isArray(userSettings) && typeof userSettings === 'object') {
       if (userSettings.actions && userSettings.actions[actionKey] !== undefined) {
           return userSettings.actions[actionKey];
       }
    }
  }
  // 명시적으로 권한이 제한되지 않은 경우 기존 호환성을 위해 true 반환
  return true;
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
  INVENTORY_HISTORY: 'inventory_history',
  INVENTORY_SCAN: 'inventory_scan',
  INVENTORY_STATUS: 'inventory_status',
  INVENTORY_BOXES: 'inventory_boxes',
  INVENTORY_CAFE24_SYNC: 'inventory_cafe24_sync',
  INVENTORY_LOCATIONS: 'inventory_locations',
  SALES: 'sales',
  SALES_ENTRY: 'sales_entry',
  SALES_HISTORY: 'sales_history',
  MANUAL_SALES: 'manual_sales',
  ONLINE_STATS: 'online_stats',
  SALES_HISTORY_STATS: 'sales_history_stats',
  AGENCY_SALES_STATS: 'agency_sales_stats',
  SERVICE_STATS: 'service_stats',
  CHATBOT_FAQ: 'chatbot_faq',
};

