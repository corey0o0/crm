/**
 * 쿠키 설정 함수
 * @param {string} name - 쿠키 이름
 * @param {string} value - 쿠키 값
 * @param {number} days - 쿠키 유효기간(일)
 */
export const setCookie = (name, value, days = 7) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

/**
 * 쿠키 읽기 함수
 * @param {string} name - 쿠키 이름
 * @returns {string} 쿠키 값 (없으면 빈 문자열)
 */
export const getCookie = (name) => {
  const cookieName = `${name}=`;
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return '';
};

/**
 * 쿠키 삭제 함수
 * @param {string} name - 삭제할 쿠키 이름
 */
export const removeCookie = (name) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

/**
 * JSON 객체를 쿠키에 저장
 * @param {string} name - 쿠키 이름
 * @param {object} value - JSON 객체
 * @param {number} days - 쿠키 유효기간(일)
 */
export const setJSONCookie = (name, value, days = 7) => {
  const jsonValue = JSON.stringify(value);
  setCookie(name, encodeURIComponent(jsonValue), days);
};

/**
 * 쿠키에서 JSON 객체 읽기
 * @param {string} name - 쿠키 이름
 * @returns {object|null} JSON 객체 (없으면 null)
 */
export const getJSONCookie = (name) => {
  const cookieValue = getCookie(name);
  if (!cookieValue) return null;
  
  try {
    return JSON.parse(decodeURIComponent(cookieValue));
  } catch (error) {
    console.error('쿠키에서 JSON 파싱 오류:', error);
    return null;
  }
}; 