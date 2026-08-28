// 레트로투어 입고지연(태풍)/페달끌림 개선/컨트롤러 스펙, 보조바퀴 예외, 스프린터 E21 오류코드 반영
// dry-run 기본, --apply 로 실제 반영
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APPLY = process.argv.includes('--apply');

const updates = [
  {
    id: 107,
    label: '레트로투어입고지연',
    keywords: ['레트로투어', '출시', '입고', '예약판매', '태풍', '입고지연', '밀렸', '언제와요', '언제입고'],
    answer: '레트로 투어는 현재 예약판매 중이며, 태풍의 영향으로 입고가 다소 지연되고 있습니다.\n확정된 입고 일정은 공식몰(nearbike.co.kr)에서 확인해 주세요.',
  },
  {
    id: 106,
    answer: `레트로 투어(Retro Tour)는 니어바이크 정식 라인업 모델입니다.
• 판매가: 1,890,000원
• 색상: 블랙 / 샌드크림 / 베이지 / 매트그린
• 배터리: 48V 20Ah 국내제조 볼턴배터리
• 주행방식: PAS(페달) 또는 PM(스로틀+페달) 선택 가능
• 싱글기어 구조
• 크랭크 160mm
• 컨트롤러 20A
• 16x4.0인치 광폭 타이어
• 48V 500W 모터
• 스마트 히팅그립 장착
• 최대하중 120kg
• 무게 29kg
• 크기 160x100cm
자세한 스펙은 공식몰 상세페이지를 참고해 주세요.`,
  },
  {
    id: 77,
    answer: `타사에서 아동용·성인용 보조바퀴를 판매하지만, 프레임 형태에 따라 호환이 안 되는 경우가 있습니다.
특히 기어가 달린 모델은 기어와 간섭이 있어 체결이 어려울수 있으니, 참고 부탁드립니다.
안장을 낮춰 발이 지면에 닿도록 타시면 안정감에 도움이 됩니다.

※ 레트로 투어는 전용 보조바퀴 장착홀이 있어 기어 간섭 없이 장착 가능합니다.`,
  },
];

const inserts = [
  {
    brand: 'NB',
    label: '레트로투어 페달끌림',
    keywords: ['페달끌림', '페달지면', '코너링', '코너돌때', '기울어질때', '크랭크길이'],
    answer: '레트로 투어는 코너링 시 페달이 지면에 끌리는 현상이 개선되어, 크랭크 160mm로 적용됩니다.',
    category: '부품·제원',
  },
  {
    brand: 'NB',
    label: '스프린터 오류코드 E21',
    keywords: ['스프린터', 'E21', '21번오류', '21번에러', '오류21', '에러21', '컨트롤러오류'],
    answer: '스프린터에서 표시되는 21번(E21) 오류는 컨트롤러 오류입니다. A/S 접수로 남겨주시면 확인 후 안내해 드립니다.',
    category: '부품·제원',
  },
  {
    brand: 'NB',
    label: '스프린터 배터리 인증제조국',
    keywords: ['스프린터', '배터리', '고속충전기', 'KC인증', 'KC인증품', '제조국', '중국산', '어디서만든'],
    answer: '스프린터 배터리·고속충전기는 KC인증을 받은 제품이며, 제조국은 중국입니다.',
    category: '부품·제원',
  },
];

(async () => {
  console.log(APPLY ? '=== 실제 반영 ===' : '=== DRY RUN (--apply 로 실제 반영) ===');

  for (const u of updates) {
    const { data: before } = await sb.from('faq_items').select('label,answer').eq('id', u.id).single();
    console.log(`\n[UPDATE id=${u.id}] ${before?.label} → ${u.label || before?.label}`);
    if (APPLY) {
      const payload = { answer: u.answer };
      if (u.label) payload.label = u.label;
      if (u.keywords) payload.keywords = u.keywords;
      const { error } = await sb.from('faq_items').update(payload).eq('id', u.id);
      if (error) console.error('  실패:', error.message);
      else console.log('  완료');
    }
  }

  for (const ins of inserts) {
    console.log(`\n[INSERT] ${ins.brand} :: ${ins.label}`);
    if (APPLY) {
      const { error } = await sb.from('faq_items').insert([{ ...ins, is_active: true }]);
      if (error) console.error('  실패:', error.message);
      else console.log('  완료');
    }
  }
})();
