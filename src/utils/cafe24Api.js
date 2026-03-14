/**
 * 카페24 API 유틸리티
 * CRM 백엔드 프록시를 통해 카페24 API를 호출합니다
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
console.log('[카페24 API] 사용 중인 백엔드 URL:', BACKEND_URL);

/**
 * 카페24 OAuth 인증 URL 생성 및 팝업 창 열기
 */
export function openCafe24AuthPopup({ mallId, clientId, redirectUri, scopes }) {
  const scope = scopes || [
    'mall.read_community',
    'mall.write_community'
  ].join(',');

  const authUrl = `https://${mallId}.cafe24api.com/api/v2/oauth/authorize`
    + `?response_type=code`
    + `&client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&scope=${encodeURIComponent(scope)}`;

  const width = 600;
  const height = 700;
  const left = window.screenLeft + (window.outerWidth - width) / 2;
  const top = window.screenTop + (window.outerHeight - height) / 2;

  return window.open(
    authUrl,
    'cafe24_auth',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
  );
}

/**
 * OAuth 인증 코드로 액세스 토큰 교환 (백엔드 프록시 사용)
 */
export async function exchangeCafe24Code({ code, mallId, clientId, clientSecret, redirectUri }) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      mall_id: mallId,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '카페24 인증에 실패했습니다.');
  }

  return resp.json();
}

/**
 * 카페24 연동 상태 확인
 */
export async function getCafe24Status() {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/cafe24/status`);
    if (!resp.ok) return { connected: false };
    return resp.json();
  } catch {
    return { connected: false };
  }
}

/**
 * 카페24 게시판 목록 조회
 */
export async function getCafe24Boards() {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/boards`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '게시판 목록 조회 실패');
  }
  return resp.json();
}

/**
 * 카페24 게시글 → CRM 동기화 실행
 * @param {number} boardNo - 동기화할 카페24 게시판 번호
 */
export async function syncCafe24Posts(boardNo) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_no: boardNo })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '동기화에 실패했습니다.');
  }

  return resp.json();
}

/**
 * 카페24 게시글에 댓글 작성
 */
export async function postCafe24Comment({ boardNo, articleNo, content }) {
  const resp = await fetch(
    `${BACKEND_URL}/api/cafe24/boards/${boardNo}/articles/${articleNo}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '댓글 작성에 실패했습니다.');
  }

  return resp.json();
}
