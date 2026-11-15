// 발주관리 엑셀 업로드 파싱 로직 (순수 함수 — 테스트용으로 분리)
// 헤더: "2026-11-13 (메모) Order" → order_date / label / 필드명
export const DATE_HEADER_RE = /^(\d{4}-\d{2}-\d{2})(?:\s*\((.*)\))?\s+(Order|Received|Status|Memo|Price \(USD\))$/;

// headerTexts: 1-based 인덱스 배열 (headerTexts[colNumber])
export function parseDateHeaders(headerTexts) {
  const byKey = new Map();
  headerTexts.forEach((text, colNumber) => {
    if (!colNumber) return; // 인덱스 0은 미사용
    const m = DATE_HEADER_RE.exec(String(text ?? '').trim());
    if (!m) return;
    const key = `${m[1]}|${(m[2] || '').trim()}`;
    if (!byKey.has(key)) byKey.set(key, { order_date: m[1], label: (m[2] || '').trim(), cols: {} });
    byKey.get(key).cols[m[3]] = colNumber;
  });
  return [...byKey.values()];
}

const toText = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    return '';
  }
  return String(v);
};

const toQty = (v) => {
  const n = Number(toText(v));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const toUsd = (v) => {
  const text = toText(v).replace(/[^0-9.\-]/g, '');
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// getValue(colNumber) → 셀 값. dc = parseDateHeaders 결과 항목.
export function extractDateColumnValues(getValue, dc) {
  const raw = (field) => (dc.cols?.[field] ? getValue(dc.cols[field]) : null);
  const quantity = toQty(raw('Order'));
  const received_quantity = toQty(raw('Received'));
  const memo = toText(raw('Memo')).trim();
  const price_usd = toUsd(raw('Price (USD)'));
  const isEmpty = quantity === 0 && received_quantity === 0 && !memo && price_usd == null;
  return { quantity, received_quantity, memo, price_usd, isEmpty };
}
