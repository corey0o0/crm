const AI_REPLY_TYPES = new Set(['faq', 'faq_llm', 'llm', 'rag', 'handoff']);

const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export function getChatLogRange(page, pageSize) {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function shouldApplyChatLogResponse(requestId, latestRequestId) {
  return requestId === latestRequestId;
}

export function filterLogsByDays(logs, days, now = new Date()) {
  const since = now.getTime() - days * 24 * 3600 * 1000;
  return (logs || []).filter((log) => new Date(log.created_at).getTime() >= since);
}

export function getNaverUserId(log) {
  const explicit = String(log?.naver_user_id || '').trim();
  if (explicit) return explicit;

  const sessionId = String(log?.session_id || '');
  return sessionId.startsWith('naver:') ? sessionId.slice('naver:'.length) : null;
}

export function groupLogsByNaverUser(logs) {
  const byUser = new Map();
  for (const log of logs || []) {
    const naverUserId = getNaverUserId(log);
    if (!naverUserId) continue;
    if (!byUser.has(naverUserId)) byUser.set(naverUserId, []);
    byUser.get(naverUserId).push(log);
  }

  return Array.from(byUser.entries()).map(([naverUserId, userLogs]) => {
    const sorted = [...userLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return {
      naverUserId,
      count: sorted.length,
      lastMessage: sorted[0]?.user_message || '',
      lastAt: sorted[0]?.created_at || null,
      replyTypes: Array.from(new Set(sorted.map(log => log.reply_type).filter(Boolean))).sort(),
      logs: sorted,
    };
  }).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

export function calculateChatbotStats(logs) {
  const rows = logs || [];
  const total = rows.length;
  const aiReplies = rows.filter((log) => AI_REPLY_TYPES.has(log.reply_type) && log.bot_reply).length;
  const isHandoffRequest = (log) => log.handoff_requested || log.reply_type === 'handoff';
  const handoffRequests = rows.filter(isHandoffRequest).length;
  const handoffExecuted = rows.filter((log) => isHandoffRequest(log) && log.handoff_executed).length;
  const agentInterventions = rows.filter((log) => log.reply_type === 'agent').length;
  const responseTimes = rows.map((log) => Number(log.response_ms)).filter((n) => Number.isFinite(n) && n >= 0);
  const avgResponseMs = responseTimes.length
    ? Math.round(responseTimes.reduce((sum, n) => sum + n, 0) / responseTimes.length)
    : 0;

  return {
    total,
    aiReplies,
    aiRate: percent(aiReplies, total),
    avgResponseMs,
    handoffRequests,
    handoffRequestRate: percent(handoffRequests, total),
    handoffExecuted,
    handoffExecutionRate: percent(handoffExecuted, handoffRequests),
    agentInterventions,
    agentInterventionRate: percent(agentInterventions, total),
  };
}
