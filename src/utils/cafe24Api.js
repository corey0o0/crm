/**
 * 카페24 다중 몰 연동 API 유틸리티
 */

import { supabase } from '../lib/supabaseClient';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

export async function getCafe24Malls() {
  try {
    const { data, error } = await supabase.from('cafe24_settings').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    
    const malls = (data || []).map(m => {
      const tokenExpired = m.token_expires_at ? new Date(m.token_expires_at) < new Date() : true;
      return {
        mall_id: m.mall_id,
        client_id: m.client_id,
        client_secret: m.client_secret, // keep for frontend if needed
        connected: !!m.access_token && !tokenExpired,
        board_no: m.board_no,
        last_synced_at: m.last_synced_at,
        token_expired: tokenExpired
      };
    });
    
    return { success: true, malls };
  } catch (err) {
    console.error('Failed to get cafe24 malls from Supabase:', err);
    return { success: false, malls: [] };
  }
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
    'mall.read_product',
    'mall.read_order'
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

export async function syncCafe24Orders(mall_id, startDate, endDate) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/sync/orders/${mall_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_date: startDate, end_date: endDate })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '주문 동기화 실패');
  }
  return resp.json();
}

export async function addCafe24ProductMapping(mall_id, cafe24_product_code, part_id) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mall_id, cafe24_product_code, part_id })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '상품 매핑 저장 실패');
  }
  return resp.json();
}

export async function transferCafe24Orders(orderIds, warehouseConfig = {}) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/transfer/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds, warehouseConfig })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '판매 전송 실패');
  }
  return resp.json();
}

export async function cancelSalesTransfer(orderIds) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/transfer/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '판매 전송 취소 실패');
  }
  return resp.json();
}

export async function compareCafe24Inventory(mall_id) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/inventory/compare/${mall_id}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '재고 비교 실패');
  }
  return resp.json();
}

export async function returnCafe24Inventory(orderIds) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/transfer/return-inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '재고 환입 처리 실패');
  }
  return resp.json();
}

export async function getCafe24ProductMappings() {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/mappings`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '수동 매핑 목록 조회 실패');
  }
  return resp.json();
}

export async function deleteCafe24ProductMapping(mall_id, cafe24_product_code) {
  const resp = await fetch(`${BACKEND_URL}/api/cafe24/mappings`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mall_id, cafe24_product_code })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '매핑 삭제 실패');
  }
  return resp.json();
}
