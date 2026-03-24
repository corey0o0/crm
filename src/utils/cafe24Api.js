/**
 * 카페24 다중 몰 연동 API 유틸리티
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

export async function getCafe24Malls() {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/malls`);
  if (!resp.ok) return { success: false, malls: [] };
  return resp.json();
}

export async function addCafe24Mall({ mall_id, client_id, client_secret }) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/malls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mall_id, client_id, client_secret })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '쇼핑몰 추가 실패');
  }
  return resp.json();
}

export async function deleteCafe24Mall(mall_id) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/malls/${mall_id}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('쇼핑몰 삭제 실패');
  return resp.json();
}

export async function updateCafe24BoardNo(mall_id, board_no) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/malls/${mall_id}/board`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_no })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '게시판 설정 저장 실패');
  }
  return resp.json();
}

export function openCafe24AuthPopup({ mallId, clientId, redirectUri }) {
  const scope = [
    'mall.read_community',
    'mall.write_community',
    'mall.read_product'
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

  return window.open(authUrl, 'cafe24_auth', `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`);
}

export async function exchangeCafe24Code({ code, redirectUri, mallId }) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri, mall_id: mallId })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '인증 실패');
  }
  return resp.json();
}

export async function getCafe24Boards(mall_id) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/boards/${mall_id}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '게시판 목록 조회 실패');
  }
  return resp.json();
}

export async function syncCafe24Posts(mall_id, board_no) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/sync/${mall_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_no })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '동기화 실패');
  }
  return resp.json();
}

export async function postCafe24Comment({ mall_id, board_no, article_no, content }) {
  const resp = await fetch(
    `${BACKEND_URL}/api/cafe24/boards/${mall_id}/${board_no}/articles/${article_no}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '댓글 작성 실패');
  }
  return resp.json();
}
