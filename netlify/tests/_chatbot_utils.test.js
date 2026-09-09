'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { insertChatLog } = require('../functions/_chatbot_utils');

function fakeSupabase(insertResults = [{ error: null }]) {
  const inserts = [];
  return {
    inserts,
    inserted: inserts,
    from(table) {
      assert.equal(table, 'chat_logs');
      return {
        async insert(payload) {
          inserts.push(payload);
          return insertResults.shift() || { error: null };
        },
      };
    },
  };
}

test('chat log insert retries without optional stats columns when migration is not applied yet', async () => {
  const supabase = fakeSupabase([
    { error: { code: 'PGRST204', message: "Could not find the 'response_ms' column" } },
  ]);

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

test('insertChatLog stores Naver user id from legacy session id', async () => {
  const supabase = fakeSupabase();

  await insertChatLog(supabase, {
    session_id: 'naver:talk-user-1',
    brand: 'nb',
    user_message: '문의',
  });

  assert.equal(supabase.inserted[0].naver_user_id, 'talk-user-1');
});

test('insertChatLog keeps explicit Naver user id over session id', async () => {
  const supabase = fakeSupabase();

  await insertChatLog(supabase, {
    naver_user_id: 'explicit-user',
    session_id: 'naver:legacy-user',
    brand: 'nb',
  });

  assert.equal(supabase.inserted[0].naver_user_id, 'explicit-user');
});

test('insertChatLog fallback drops Naver user id before migration exists', async () => {
  const supabase = fakeSupabase([
    { error: { code: 'PGRST204', message: 'Could not find the naver_user_id column' } },
    { error: null },
  ]);

  const result = await insertChatLog(supabase, {
    session_id: 'naver:talk-user-1',
    brand: 'nb',
    response_ms: 120,
  });

  assert.deepEqual(result, { error: null });
  assert.equal(supabase.inserted.length, 2);
  assert.equal(supabase.inserted[0].naver_user_id, 'talk-user-1');
  assert.equal(Object.hasOwn(supabase.inserted[1], 'naver_user_id'), false);
});
