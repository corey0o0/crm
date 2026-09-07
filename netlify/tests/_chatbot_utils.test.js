'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { insertChatLog } = require('../functions/_chatbot_utils');

function fakeSupabase(firstError) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      assert.equal(table, 'chat_logs');
      return {
        async insert(payload) {
          inserts.push(payload);
          if (inserts.length === 1 && firstError) return { error: firstError };
          return { error: null };
        },
      };
    },
  };
}

test('chat log insert retries without optional stats columns when migration is not applied yet', async () => {
  const supabase = fakeSupabase({ code: 'PGRST204', message: "Could not find the 'response_ms' column" });

  const result = await insertChatLog(supabase, {
    session_id: 's1',
    brand: 'nb2',
    user_message: '문의',
    bot_reply: '답변',
    reply_type: 'rag',
    response_ms: 1234,
    handoff_requested: false,
    handoff_executed: false,
  });

  assert.equal(result.error, null);
  assert.equal(supabase.inserts.length, 2);
  assert.equal(supabase.inserts[0].response_ms, 1234);
  assert.equal(supabase.inserts[1].response_ms, undefined);
  assert.equal(supabase.inserts[1].handoff_requested, undefined);
  assert.equal(supabase.inserts[1].handoff_executed, undefined);
});
