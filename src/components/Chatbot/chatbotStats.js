const AI_REPLY_TYPES = new Set(['faq', 'faq_llm', 'llm', 'rag', 'handoff']);

const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export function filterLogsByDays(logs, days, now = new Date()) {
  const since = now.getTime() - days * 24 * 3600 * 1000;
  return (logs || []).filter((log) => new Date(log.created_at).getTime() >= since);
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
