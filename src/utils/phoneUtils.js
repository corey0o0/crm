// 전화번호 관련 유틸리티 함수들

/**
 * 한글 자모를 숫자로 변환하는 함수
 * @param {string} text - 변환할 텍스트
 * @returns {string} - 변환된 텍스트
 */
export const convertHangulToNumber = (text) => {
  if (!text) return '';
  
  const hangulMap = {
    'ㅂ': '1', 'ㅈ': '1', 'ㄷ': '1', 'ㄱ': '1', 'ㅅ': '1', 'ㅛ': '1', 'ㅕ': '1', 'ㅑ': '1', 'ㅐ': '1', 'ㅔ': '1',
    'ㅁ': '2', 'ㄴ': '2', 'ㅇ': '2', 'ㄹ': '2', 'ㅎ': '2', 'ㅗ': '2', 'ㅓ': '2', 'ㅏ': '2', 'ㅣ': '2',
    'ㅋ': '3', 'ㅌ': '3', 'ㅊ': '3', 'ㅍ': '3', 'ㅠ': '3', 'ㅜ': '3', 'ㅡ': '3',
    'ㅃ': '1', 'ㅉ': '1', 'ㄸ': '1', 'ㄲ': '1', 'ㅆ': '1',
    'ㅒ': '1', 'ㅖ': '1'
  };
  
  return text.replace(/[ㄱ-ㅎㅏ-ㅣ]/g, (char) => hangulMap[char] || char);
};

/**
 * 전화번호 형식을 정규화하는 함수
 * @param {string} phone - 전화번호
 * @returns {string} - 정규화된 전화번호
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  
  // 한글 자모가 포함된 경우 빈 문자열 반환
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(phone)) {
    return '';
  }
  
  // 숫자만 추출
  let normalized = phone.replace(/\D/g, '');
  
  // 010으로 시작하는 11자리 번호인 경우 하이픈 추가
  if (normalized.length === 11 && normalized.startsWith('010')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  
  // 010으로 시작하는 10자리 번호인 경우 0 추가 후 하이픈 추가
  if (normalized.length === 10 && normalized.startsWith('010')) {
    normalized = '0' + normalized;
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  
  // 유효하지 않은 형식이지만 숫자가 포함된 경우 원본 반환
  if (normalized.length > 0) {
    return phone; // 원본 전화번호 반환 (하이픈 등이 포함된 경우)
  }
  
  return '';
};

/**
 * 전화번호 유효성을 검사하는 함수
 * @param {string} phone - 전화번호
 * @returns {boolean} - 유효한 전화번호인지 여부
 */
export const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  
  // 한글 자모가 포함된 경우 false 반환
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(phone)) {
    return false;
  }
  
  // 숫자만 추출하여 검증
  const numbersOnly = phone.replace(/\D/g, '');
  
  // 010으로 시작하는 11자리 또는 10자리 번호인지 확인
  if (numbersOnly.length === 11 && numbersOnly.startsWith('010')) {
    return true;
  }
  
  if (numbersOnly.length === 10 && numbersOnly.startsWith('010')) {
    return true;
  }
  
  return false;
};

/**
 * 전화번호 입력 시 실시간 변환을 위한 함수
 * @param {string} value - 입력된 값
 * @returns {string} - 변환된 값
 */
export const handlePhoneInput = (value) => {
  if (!value) return '';
  
  // 한글 자모가 포함된 경우 경고하고 원본 반환
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(value)) {
    return value; // 한글 자모가 있으면 그대로 반환하여 사용자가 수정하도록 함
  }
  
  // 숫자와 하이픈만 허용
  let converted = value.replace(/[^\d-]/g, '');
  
  // 하이픈이 2개 이상인 경우 첫 번째만 유지
  const hyphenCount = (converted.match(/-/g) || []).length;
  if (hyphenCount > 2) {
    const firstHyphen = converted.indexOf('-');
    const secondHyphen = converted.indexOf('-', firstHyphen + 1);
    converted = converted.substring(0, secondHyphen) + converted.substring(secondHyphen + 1);
  }
  
  // 자동 하이픈 추가 (010-1234-5678 형식)
  if (converted.length === 11 && !converted.includes('-') && converted.startsWith('010')) {
    converted = `${converted.slice(0, 3)}-${converted.slice(3, 7)}-${converted.slice(7)}`;
  }
  
  return converted;
};
