const test = require('node:test');
const assert = require('node:assert/strict');
const { mapCafe24Comments } = require('./cafe24Router');

test('maps Cafe24 comments to board post answers', () => {
  const answers = mapCafe24Comments([
    {
      comment_no: 12,
      content: '답변입니다.',
      writer: { name: '관리자', email: 'admin@example.com' },
      created_date: '2026-09-08T10:00:00+09:00',
    },
    {
      comment_no: 13,
      writer: null,
    },
  ]);

  assert.deepEqual(answers, [
    {
      comment_no: 12,
      content: '답변입니다.',
      writer_name: '관리자',
      writer_email: 'admin@example.com',
      created_date: '2026-09-08T10:00:00+09:00',
    },
    {
      comment_no: 13,
      content: '',
      writer_name: null,
      writer_email: null,
      created_date: null,
    },
  ]);
});
