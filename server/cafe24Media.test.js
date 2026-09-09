const test = require('node:test');
const assert = require('node:assert/strict');
const { rewriteCafe24Media, defaultFetchImage } = require('./cafe24Media');

test('uploads Cafe24 images to R2 and keeps safe video embeds', async () => {
  const html = [
    '<p><img src="https://cdn.example.com/a.jpg"></p>',
    '<iframe src="https://evil.example/embed/1"></iframe>',
    '<iframe src="https://www.youtube.com/embed/abc"></iframe>',
    '<video controls src="https://cdn.example.com/movie.mp4"></video>',
  ].join('');

  const rewritten = await rewriteCafe24Media(html, {
    mallId: 'nearbike',
    boardNo: 9,
    articleNo: 12,
    fetchImage: async () => ({ body: Buffer.from('image'), contentType: 'image/jpeg' }),
    uploadImage: async ({ key }) => `https://r2.example/${key}`,
  });

  assert.match(rewritten, /<img src="https:\/\/r2\.example\/cafe24-board\/nearbike\/9\/12\/[a-f0-9]{16}\.jpg">/);
  assert.match(rewritten, /<a href="https:\/\/evil\.example\/embed\/1"[^>]*>영상 원본 보기<\/a>/);
  assert.match(rewritten, /<iframe src="https:\/\/www\.youtube\.com\/embed\/abc"><\/iframe>/);
  assert.match(rewritten, /<video controls src="https:\/\/cdn\.example\.com\/movie\.mp4"><\/video>/);
});

test('keeps original image src when R2 copy fails', async () => {
  const html = '<p><img src="https://cdn.example.com/a.jpg"></p>';

  const rewritten = await rewriteCafe24Media(html, {
    mallId: 'nearbike',
    boardNo: 9,
    articleNo: 12,
    fetchImage: async () => { throw new Error('download failed'); },
    uploadImage: async () => { throw new Error('should not upload'); },
    logger: { warn: () => {} },
  });

  assert.equal(rewritten, html);
});

test('does not fetch private or local image URLs', async () => {
  const html = '<p><img src="http://127.0.0.1/private.jpg"><img src="http://localhost/a.jpg"></p>';
  let fetchCount = 0;

  const rewritten = await rewriteCafe24Media(html, {
    mallId: 'nearbike',
    boardNo: 9,
    articleNo: 12,
    fetchImage: async () => { fetchCount += 1; throw new Error('should not fetch'); },
    uploadImage: async () => { throw new Error('should not upload'); },
    logger: { warn: () => {} },
  });

  assert.equal(fetchCount, 0);
  assert.equal(rewritten, html);
});

test('rejects non-image responses before buffering', async () => {
  const originalFetch = global.fetch;
  let buffered = false;
  global.fetch = async () => ({
    ok: true,
    headers: { get: () => 'text/html' },
    arrayBuffer: async () => { buffered = true; return Buffer.from('<html></html>'); },
  });

  try {
    await assert.rejects(
      () => defaultFetchImage('https://cdn.example.com/not-image'),
      /허용되지 않는 이미지 타입/
    );
    assert.equal(buffered, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects oversized images by content-length before buffering', async () => {
  const originalFetch = global.fetch;
  let buffered = false;
  global.fetch = async () => ({
    ok: true,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'image/jpeg' : '10485761' },
    arrayBuffer: async () => { buffered = true; return Buffer.alloc(1); },
  });

  try {
    await assert.rejects(
      () => defaultFetchImage('https://cdn.example.com/huge.jpg'),
      /이미지가 너무 큽니다/
    );
    assert.equal(buffered, false);
  } finally {
    global.fetch = originalFetch;
  }
});
