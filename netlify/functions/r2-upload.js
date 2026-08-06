'use strict';
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const BUCKET = 'crm-img';

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}
function err(statusCode, message) {
  return { statusCode, headers: CORS, body: JSON.stringify({ error: message }) };
}
function preflight() {
  return { statusCode: 200, headers: CORS, body: '' };
}

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function getPublicUrl() {
  return process.env.R2_PUBLIC_URL || 'https://pub-27aaa3bc54074d938a076a095676c921.r2.dev';
}

// 로그인한 CRM 사용자만 통과시킨다 — 없으면 아무나 R2 에 파일을 넣고 뺄 수 있다.
async function requireUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST only');

  const user = await requireUser(event);
  if (!user) return err(401, '로그인이 필요합니다.');

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return err(400, 'invalid json');
  }

  const { action } = body;

  if (action === 'upload') {
    const { fileName, contentType, folderPrefix } = body;
    if (!fileName) return err(400, 'fileName 필수');

    const safeName = String(fileName).replace(/\s+/g, '_');
    const key = folderPrefix && folderPrefix !== 'root'
      ? `${folderPrefix}/${Date.now()}_${safeName}`
      : `uploads/${Date.now()}_${safeName}`;

    try {
      const client = getR2Client();
      const cmd = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
      });
      const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 300 }); // 5분
      const publicUrl = `${getPublicUrl()}/${key}`;
      return ok({ uploadUrl, key, publicUrl });
    } catch (e) {
      console.error('[r2-upload] presign 실패:', e.message);
      return err(500, 'presign 실패');
    }
  }

  if (action === 'delete') {
    const { key } = body;
    if (!key) return err(400, 'key 필수');

    try {
      const client = getR2Client();
      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      return ok({ success: true });
    } catch (e) {
      console.error('[r2-upload] 삭제 실패:', e.message);
      return err(500, '삭제 실패');
    }
  }

  return err(400, 'unknown action');
};
