import { calculateChatbotStats, filterLogsByDays, getChatLogRange, getNaverUserId, groupLogsByNaverUser, shouldApplyChatLogResponse } from './chatbotStats';

const NOW = new Date('2026-09-06T12:00:00.000Z');

test('calculates chatbot response and handoff rates', () => {
  const logs = [
    { created_at: '2026-09-06T11:00:00.000Z', reply_type: 'faq', bot_reply: 'FAQ 답변', response_ms: 200 },
    { created_at: '2026-09-06T11:01:00.000Z', reply_type: 'rag', bot_reply: 'AI 답변', response_ms: 1200 },
    { created_at: '2026-09-06T11:02:00.000Z', reply_type: 'handoff', bot_reply: '상담원 연결', handoff_requested: true, handoff_executed: true, response_ms: 500 },
    { created_at: '2026-09-06T11:03:00.000Z', reply_type: 'agent', user_message: '[상담원 응대]', bot_reply: '상담원 답변', handoff_executed: true },
    { created_at: '2026-09-06T11:04:00.000Z', reply_type: 'error', user_message: '오류 질문' },
  ];

  expect(calculateChatbotStats(logs)).toMatchObject({
    total: 5,
    aiReplies: 3,
    aiRate: 60,
    avgResponseMs: 633,
    handoffRequests: 1,
    handoffRequestRate: 20,
    handoffExecuted: 1,
    handoffExecutionRate: 100,
    agentInterventions: 1,
    agentInterventionRate: 20,
  });
});

test('filters logs by recent days', () => {
  const logs = [
    { created_at: '2026-09-06T11:00:00.000Z' },
    { created_at: '2026-08-20T11:00:00.000Z' },
  ];

  expect(filterLogsByDays(logs, 7, NOW)).toHaveLength(1);
  expect(filterLogsByDays(logs, 30, NOW)).toHaveLength(2);
});

test('calculates Supabase range for chat log pages', () => {
  expect(getChatLogRange(0, 300)).toEqual({ from: 0, to: 299 });
  expect(getChatLogRange(2, 300)).toEqual({ from: 600, to: 899 });
});

test('ignores stale chat log page responses', () => {
  expect(shouldApplyChatLogResponse(3, 3)).toBe(true);
  expect(shouldApplyChatLogResponse(2, 3)).toBe(false);
});

test('extracts Naver user id from explicit field or legacy session id', () => {
  expect(getNaverUserId({ naver_user_id: 'talk-user-1', session_id: 'naver:old' })).toBe('talk-user-1');
  expect(getNaverUserId({ session_id: 'naver:talk-user-2' })).toBe('talk-user-2');
  expect(getNaverUserId({ session_id: 'web:abc' })).toBeNull();
  expect(getNaverUserId({})).toBeNull();
});

test('groups chat logs by Naver user id with latest question first', () => {
  const groups = groupLogsByNaverUser([
    { id: 1, session_id: 'naver:user-a', user_message: '첫 질문', created_at: '2026-09-06T11:00:00.000Z', reply_type: 'faq' },
    { id: 2, naver_user_id: 'user-b', user_message: '다른 질문', created_at: '2026-09-06T11:05:00.000Z', reply_type: 'llm' },
    { id: 3, session_id: 'naver:user-a', user_message: '최근 질문', created_at: '2026-09-06T11:10:00.000Z', reply_type: 'handoff' },
    { id: 4, session_id: 'web:skip', user_message: '웹 질문', created_at: '2026-09-06T11:20:00.000Z', reply_type: 'faq' },
  ]);

  expect(groups).toEqual([
    {
      naverUserId: 'user-a',
      count: 2,
      lastMessage: '최근 질문',
      lastAt: '2026-09-06T11:10:00.000Z',
      replyTypes: ['faq', 'handoff'],
      logs: [
        { id: 3, session_id: 'naver:user-a', user_message: '최근 질문', created_at: '2026-09-06T11:10:00.000Z', reply_type: 'handoff' },
        { id: 1, session_id: 'naver:user-a', user_message: '첫 질문', created_at: '2026-09-06T11:00:00.000Z', reply_type: 'faq' },
      ],
    },
    {
      naverUserId: 'user-b',
      count: 1,
      lastMessage: '다른 질문',
      lastAt: '2026-09-06T11:05:00.000Z',
      replyTypes: ['llm'],
      logs: [
        { id: 2, naver_user_id: 'user-b', user_message: '다른 질문', created_at: '2026-09-06T11:05:00.000Z', reply_type: 'llm' },
      ],
    },
  ]);
});
