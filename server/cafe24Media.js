const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SAFE_IFRAME_HOSTS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
  'cafe24.com',
  'cafe24api.com',
  'cafe24img.com',
];

function getR2Config() {
  return {
    endpoint: process.env.R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || process.env.REACT_APP_R2_BUCKET_NAME || 'crm-img',
    publicUrl: process.env.R2_PUBLIC_URL || process.env.REACT_APP_R2_PUBLIC_URL || 'https://pub-27aaa3bc54074d938a076a095676c921.r2.dev',
  };
}

function extensionFor(contentType, url) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';

  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  } catch (_) {}
  return 'jpg';
}

function mediaKey({ mallId, boardNo, articleNo, src, contentType }) {
  const hash = crypto.createHash('sha256').update(src).digest('hex').slice(0, 16);
  const ext = extensionFor(contentType, src);
  return `cafe24-board/${mallId}/${boardNo}/${articleNo}/${hash}.${ext}`;
}

async function defaultFetchImage(src) {
  const res = await fetch(src, { redirect: 'follow' });
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(normalized)) throw new Error(`허용되지 않는 이미지 타입: ${contentType}`);

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error(`이미지가 너무 큽니다: ${contentLength} bytes`);

  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_IMAGE_BYTES) throw new Error(`이미지가 너무 큽니다: ${body.length} bytes`);

  return { body, contentType };
}

async function defaultUploadImage({ key, body, contentType }) {
  const cfg = getR2Config();
  if (!cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error('R2 환경변수가 없습니다.');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return `${cfg.publicUrl.replace(/\/$/, '')}/${key}`;
}

function isSafeRemoteUrl(src) {
  try {
    const url = new URL(src);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const parts = host.split('.').map(Number);
      if (parts[0] === 10) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

function isSafeIframeSrc(src) {
  if (!isSafeRemoteUrl(src)) return false;

  try {
    const host = new URL(src).hostname.toLowerCase();
    return SAFE_IFRAME_HOSTS.some(safe => host === safe || host.endsWith(`.${safe}`));
  } catch (_) {
    return false;
  }
}

function replaceSrc(tag, nextSrc) {
  return tag.replace(/\ssrc=(['"])(.*?)\1/i, ` src=$1${nextSrc}$1`);
}

async function rewriteImages(html, options) {
  const imgTags = [...html.matchAll(/<img\b[^>]*\ssrc=(['"])(.*?)\1[^>]*>/gi)];
  let rewritten = html;

  for (const match of imgTags) {
    const [tag, , src] = match;
    if (!isSafeRemoteUrl(src)) continue;

    try {
      const fetched = await options.fetchImage(src);
      const key = mediaKey({ ...options, src, contentType: fetched.contentType });
      const publicUrl = await options.uploadImage({ key, ...fetched, src });
      rewritten = rewritten.replace(tag, replaceSrc(tag, publicUrl));
    } catch (e) {
      options.logger?.warn('[Cafe24 Media] 이미지 R2 복사 실패:', src, e.message);
    }
  }

  return rewritten;
}

function rewriteIframes(html) {
  return html.replace(/<iframe\b[^>]*\ssrc=(['"])(.*?)\1[^>]*>\s*<\/iframe>/gi, (tag, quote, src) => {
    if (isSafeIframeSrc(src)) return tag;
    return `<a href=${quote}${src}${quote} target="_blank" rel="noopener noreferrer">영상 원본 보기</a>`;
  });
}

async function rewriteCafe24Media(html, options = {}) {
  if (!html) return html;

  const mediaOptions = {
    mallId: options.mallId,
    boardNo: options.boardNo,
    articleNo: options.articleNo,
    fetchImage: options.fetchImage || defaultFetchImage,
    uploadImage: options.uploadImage || defaultUploadImage,
    logger: options.logger || console,
  };

  const withImages = await rewriteImages(html, mediaOptions);
  return rewriteIframes(withImages);
}

module.exports = {
  rewriteCafe24Media,
  mediaKey,
  isSafeIframeSrc,
  isSafeRemoteUrl,
  defaultFetchImage,
};
