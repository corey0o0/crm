import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from "../lib/supabaseClient";

// --- 신규 경로: Netlify 함수가 발급하는 presigned URL 사용 (R2 키가 브라우저에 없음) ---

const getAuthToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
};

const callR2Function = async (payload) => {
  const token = await getAuthToken();
  if (!token) throw new Error("로그인 세션 없음");

  const res = await fetch("/.netlify/functions/r2-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`r2-upload 함수 응답 오류: ${res.status}`);
  return res.json();
};

// --- 구 경로: 브라우저에서 R2 키로 직접 업로드 (신규 경로 실패 시 폴백용으로만 유지) ---
// TODO: 신규 경로가 안정화되면 이 블록과 REACT_APP_R2_* 환경변수를 제거할 것

const initR2ClientLegacy = () => {
  const accessKey = window._env_?.REACT_APP_R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID;
  const secretKey = window._env_?.REACT_APP_R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY;
  const endpoint = window._env_?.REACT_APP_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT;

  if (!accessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });
};

const r2ClientLegacy = initR2ClientLegacy();

const getR2PublicUrl = () => {
  return window._env_?.REACT_APP_R2_PUBLIC_URL ||
    process.env.REACT_APP_R2_PUBLIC_URL ||
    'https://pub-27aaa3bc54074d938a076a095676c921.r2.dev';
};

const uploadFileToR2Legacy = async (file, folderPrefix, safeName, fileName, key) => {
  if (!r2ClientLegacy) throw new Error("R2 클라이언트가 초기화되지 않았습니다.");

  let fileBody = file;
  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    fileBody = new Uint8Array(arrayBuffer);
  }

  await r2ClientLegacy.send(new PutObjectCommand({
    Bucket: "crm-img",
    Key: key,
    Body: fileBody,
    ContentType: file.type || "application/octet-stream",
  }));

  const publicUrl = `${getR2PublicUrl()}/${key}`;
  return {
    fileId: key,
    id: key,
    webViewLink: publicUrl,
    url: publicUrl,
    name: file.name
  };
};

const deleteFileFromR2Legacy = async (fileKey) => {
  if (!r2ClientLegacy) return true;
  await r2ClientLegacy.send(new DeleteObjectCommand({ Bucket: "crm-img", Key: fileKey }));
  return true;
};

// ---------------------------------------------------------------------------

/**
 * R2에서 폴더(디렉토리) 개념 대신 Prefix(접두사) 경로를 사용하므로 Prefix 경로만 조립해서 반환합니다.
 */
export const findOrCreateFolder = async (folderName, parentFolderId = null) => {
  let prefix = "";
  if (parentFolderId && parentFolderId !== "root") {
    prefix = parentFolderId.endsWith("/") ? parentFolderId : `${parentFolderId}/`;
  }
  return { id: `${prefix}${folderName}` };
};

/**
 * Cloudflare R2에 파일 업로드 — 서버(Netlify 함수)가 발급한 presigned URL로 직접 PUT.
 * 함수 호출이 실패하면(배포 직후 환경변수 미설정 등) 구 방식으로 자동 폴백한다.
 */
export const uploadFileToR2 = async (file, folderPrefix = null) => {
  const safeName = file.name ? file.name.replace(/\s+/g, '_') : 'unnamed_file';
  const contentType = file.type || "application/octet-stream";

  try {
    const { uploadUrl, key, publicUrl } = await callR2Function({
      action: "upload",
      fileName: safeName,
      contentType,
      folderPrefix,
    });

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!putRes.ok) throw new Error(`R2 업로드 실패: ${putRes.status}`);

    return { fileId: key, id: key, webViewLink: publicUrl, url: publicUrl, name: file.name };
  } catch (error) {
    console.warn("R2 presigned 업로드 실패, 구 방식으로 폴백:", error.message);
    const fileName = `${Date.now()}_${safeName}`;
    const key = (folderPrefix && folderPrefix !== "root") ? `${folderPrefix}/${fileName}` : `uploads/${fileName}`;
    try {
      return await uploadFileToR2Legacy(file, folderPrefix, safeName, fileName, key);
    } catch (legacyError) {
      console.error("R2 업로드 오류(구 방식도 실패):", legacyError);
      if (legacyError.name === 'TypeError' || legacyError.message === 'Failed to fetch' || (legacyError.$metadata && legacyError.$metadata.attempts)) {
        throw new Error("네트워크 오류 또는 CORS 설정 문제입니다. R2 버킷의 CORS 설정을 확인하세요.");
      }
      throw legacyError;
    }
  }
};

/**
 * Cloudflare R2에서 파일 삭제 — 서버(Netlify 함수) 경유. 실패 시 구 방식 폴백.
 */
export const deleteFileFromR2 = async (fileKey) => {
  try {
    await callR2Function({ action: "delete", key: fileKey });
    return true;
  } catch (error) {
    console.warn("R2 presigned 삭제 실패, 구 방식으로 폴백:", error.message);
    try {
      return await deleteFileFromR2Legacy(fileKey);
    } catch (legacyError) {
      console.error("R2 파일 삭제 오류(구 방식도 실패):", legacyError);
      throw legacyError;
    }
  }
};

/**
 * R2 파일 정보 조회 (URL 생성)
 */
export const getR2FileInfo = async (fileKey) => {
  const r2PublicUrl = getR2PublicUrl();
  const publicUrl = `${r2PublicUrl}/${fileKey}`;
  return { id: fileKey, webViewLink: publicUrl };
};

export const getR2DownloadUrl = (fileKey) => {
  const r2PublicUrl = getR2PublicUrl();
  return `${r2PublicUrl}/${fileKey}`;
};

export const getR2PreviewUrl = (fileKey) => {
  const r2PublicUrl = getR2PublicUrl();
  return `${r2PublicUrl}/${fileKey}`;
};

export const getFixedR2Url = (url) => {
  if (!url) return url;
  let fixedUrl = url;
  if (fixedUrl.startsWith('undefined/')) {
    const r2Url = getR2PublicUrl();
    fixedUrl = fixedUrl.replace('undefined/', `${r2Url}/`);
  }
  // 이전에 환경변수 미적용으로 인해 DB에 하드코딩된 폴더명이 들어갔을 경우, Cloudflare에서 %RE 에러(400)가 발생하므로 강제 인코딩

  return fixedUrl;
};
