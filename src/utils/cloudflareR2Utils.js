import { supabase } from "../lib/supabaseClient";

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

const getR2PublicUrl = () => {
  return window._env_?.REACT_APP_R2_PUBLIC_URL ||
    process.env.REACT_APP_R2_PUBLIC_URL ||
    'https://pub-27aaa3bc54074d938a076a095676c921.r2.dev';
};

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
 * R2 키는 서버에만 있고 브라우저에는 전달되지 않는다.
 */
export const uploadFileToR2 = async (file, folderPrefix = null) => {
  const safeName = file.name ? file.name.replace(/\s+/g, '_') : 'unnamed_file';
  const contentType = file.type || "application/octet-stream";

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
};

/**
 * Cloudflare R2에서 파일 삭제 — 서버(Netlify 함수) 경유.
 */
export const deleteFileFromR2 = async (fileKey) => {
  await callR2Function({ action: "delete", key: fileKey });
  return true;
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
