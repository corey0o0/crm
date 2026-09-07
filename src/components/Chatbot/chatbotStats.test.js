import { calculateChatbotStats, filterLogsByDays } from './chatbotStats';

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
