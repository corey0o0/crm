const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeChatSessionId } = require('../functions/chatbot-chat');

function sign(sessionId) {
  return crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_KEY).update(sessionId).digest('hex');
}

test('keeps Naver session id only with internal worker signature', () => {
  process.env.SUPABASE_SERVICE_KEY = 'test-secret';

  assert.equal(normalizeChatSessionId('naver:talk-user-1', sign('naver:talk-user-1')), 'naver:talk-user-1');
  assert.equal(normalizeChatSessionId('naver:talk-user-1', 'naver:talk-user-1'), null);
  assert.equal(normalizeChatSessionId('naver:talk-user-1', sign('naver:other-user')), null);
  assert.equal(normalizeChatSessionId('web:abc', ''), 'web:abc');
  assert.equal(normalizeChatSessionId('', ''), null);

  delete process.env.SUPABASE_SERVICE_KEY;
  assert.equal(normalizeChatSessionId('naver:talk-user-1', ''), null);
});
