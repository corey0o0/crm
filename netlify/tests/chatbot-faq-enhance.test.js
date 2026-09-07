const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQuestionGroups, normalizeSuggestions } = require('../functions/chatbot-faq-enhance');

test('groups repeated customer questions and skips system noise', () => {
  const result = buildQuestionGroups([
    { user_message: '배터리 충전이 안 돼요' },
    { user_message: '  배터리   충전이 안 돼요  ' },
    { user_message: '[FAQ 선택] 배송조회' },
    { user_message: '[상담원 연결 요청]' },
    { user_message: '네' },
    { user_message: '' },
    { user_message: '타이어 공기압 알려주세요' },
  ]);

  assert.deepEqual(result.groups, [
    { id: 'G1', text: '배터리 충전이 안 돼요', count: 2, samples: ['배터리 충전이 안 돼요'] },
    { id: 'G2', text: '타이어 공기압 알려주세요', count: 1, samples: ['타이어 공기압 알려주세요'] },
  ]);
  assert.deepEqual(result.summary, {
    analyzed: 7,
    unique_questions: 2,
    total_question_count: 3,
  });
});

test('attaches evidence from returned group ids instead of trusting AI counts', () => {
  const suggestions = normalizeSuggestions([
    {
      label: '충전 문제',
      keywords: ['충전'],
      answer: '충전기 표시등과 연결 순서를 확인하세요.',
      question_count: 99,
      estimated_saves: 99,
      sample_questions: ['AI가 만든 샘플'],
      groups: ['G1', 'G2'],
    },
  ], [], [
    { id: 'G1', count: 2, samples: ['배터리 충전이 안 돼요'] },
    { id: 'G2', count: 1, samples: ['충전기 불이 안 들어와요'] },
  ]);

  assert.deepEqual(suggestions[0].groups, ['G1', 'G2']);
  assert.equal(suggestions[0].question_count, 3);
  assert.equal(suggestions[0].estimated_saves, 3);
  assert.deepEqual(suggestions[0].sample_questions, ['배터리 충전이 안 돼요', '충전기 불이 안 들어와요']);
});

test('normalizes AI suggestions and removes invalid or duplicate FAQs', () => {
  const suggestions = normalizeSuggestions([
    {
      label: ' 배터리 충전 ',
      keywords: [' 배터리 ', '', '충전'],
      answer: '1. 충전기를 먼저 연결하세요.\n2. 표시등을 확인하세요.',
      reason: '반복 문의 2건',
      question_count: 2,
      sample_questions: ['배터리 충전이 안 돼요', '  '],
      estimated_saves: 0,
      confidence: 'high',
    },
    { label: '배송조회', keywords: ['배송'], answer: '기존 FAQ와 중복' },
    { label: '답변 없음', keywords: ['누락'], answer: '' },
  ], [{ label: '배송조회' }]);

  assert.deepEqual(suggestions, [
    {
      label: '배터리 충전',
      keywords: ['배터리', '충전'],
      answer: '1. 충전기를 먼저 연결하세요.\n2. 표시등을 확인하세요.',
      reason: '반복 문의 2건',
      question_count: 2,
      sample_questions: ['배터리 충전이 안 돼요'],
      estimated_saves: 2,
      confidence: 'high',
    },
  ]);
});
