/**
 * FAQ 테이블 생성 스크립트
 * 실행: node scratch_create_faq_tables.js
 *
 * Supabase 대시보드 SQL Editor에서 아래 SQL을 직접 실행해도 됩니다:
 * migrations/001_faq_tables.sql
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function main() {
  console.log('Supabase URL:', process.env.REACT_APP_SUPABASE_URL ? '✓' : '✗ 없음');

  // 테이블 존재 여부 확인
  const { data: faqCheck, error: faqErr } = await supabase
    .from('faq_items').select('id').limit(1);

  if (!faqErr) {
    console.log('✓ faq_items 테이블이 이미 존재합니다.');
  } else {
    console.log('✗ faq_items 테이블이 없습니다.');
    console.log('  → Supabase 대시보드 SQL Editor에서 migrations/001_faq_tables.sql 을 실행해주세요.');
    console.log('  → 경로: https://app.supabase.com → SQL Editor');
  }

  const { data: logCheck, error: logErr } = await supabase
    .from('chat_logs').select('id').limit(1);

  if (!logErr) {
    console.log('✓ chat_logs 테이블이 이미 존재합니다.');
  } else {
    console.log('✗ chat_logs 테이블이 없습니다.');
    console.log('  → migrations/001_faq_tables.sql 을 실행해주세요.');
  }
}

main().catch(console.error);
