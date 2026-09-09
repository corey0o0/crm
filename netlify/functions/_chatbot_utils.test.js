const test = require('node:test');
const assert = require('node:assert/strict');
const { insertChatLog } = require('./_chatbot_utils');

function fakeSupabase(insertResults) {
  const inserted = [];
  return {
    inserted,
    from(table) {
      assert.equal(table, 'chat_logs');
      return {
        insert(payload) {
          inserted.push(payload);
          return insertResults.shift() || { error: null };
        },
      };
    },
  };
}

test('insertChatLog stores Naver user id from legacy session id', async () => {
  const supabase = fakeSupabase([{ error: null }]);

  await insertChatLog(supabase, {
    session_id: 'naver:talk-user-1',
    brand: 'nb',
    user_message: '문의',
  });

  assert.equal(supabase.inserted[0].naver_user_id, 'talk-user-1');
});

test('insertChatLog keeps explicit Naver user id over session id', async () => {
  const supabase = fakeSupabase([{ error: null }]);

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
