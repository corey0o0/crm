import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// S3 클라이언트 초기화
const initR2Client = () => {
  const accessKey = window._env_?.REACT_APP_R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID;
  const secretKey = window._env_?.REACT_APP_R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY;
  const endpoint = window._env_?.REACT_APP_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT;

  if (!accessKey) {
    console.warn("R2 설정이 환경 변수에 누락되었습니다.");
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    forcePathStyle: true, // Cloudflare R2 필수 옵션
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });
};

const r2Client = initR2Client();

/**
 * R2에서 폴더(디렉토리) 개념 대신 Prefix(접두사) 경로를 사용하므로 Prefix 경로만 조립해서 반환합니다.
 */
export const findOrCreateFolder = async (folderName, parentFolderId = null) => {
  let prefix = "";
  if (parentFolderId && parentFolderId !== "root") {
    // 이미 부모가 경로 형태인 경우 처리
    prefix = parentFolderId.endsWith("/") ? parentFolderId : `${parentFolderId}/`;
  }
  return { id: `${prefix}${folderName}` };
};

const getR2PublicUrl = () => {
    return window._env_?.REACT_APP_R2_PUBLIC_URL || 
           process.env.REACT_APP_R2_PUBLIC_URL || 
           'https://pub-27aaa3bc54074d938a076a095676c921.r2.dev';
};

/**
 * Cloudflare R2에 파일 업로드
 */
export const uploadFileToR2 = async (file, folderPrefix = null) => {
  if (!r2Client) throw new Error("R2 클라이언트가 초기화되지 않았습니다.");
  
  // 한글 깨짐 및 공백 처리
  const safeName = file.name ? file.name.replace(/\s+/g, '_') : 'unnamed_file';
  const fileName = `${Date.now()}_${safeName}`;
  const key = (folderPrefix && folderPrefix !== "root") ? `${folderPrefix}/${fileName}` : `uploads/${fileName}`;

  let fileBody = file;
  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    fileBody = new Uint8Array(arrayBuffer);
  }

  const params = {
    Bucket: "crm-img", // 고정 버킷
    Key: key,
    Body: fileBody,
    ContentType: file.type || "application/octet-stream",
  };

  try {
    console.log(`Cloudflare R2 파일 업로드 시작: ${key}`);
    await r2Client.send(new PutObjectCommand(params));
    
    const r2PublicUrl = getR2PublicUrl();
    const publicUrl = `${r2PublicUrl}/${key}`;
    console.log("R2 업로드 완료:", publicUrl);
    
    // 기존 응답 구조를 유지하여 컴포넌트 수정을 최소화합니다.
    return {
      fileId: key,
      id: key,
      webViewLink: publicUrl,
      url: publicUrl,
      name: file.name
    };
  } catch (error) {
    console.error("R2 업로드 오류 상세:", error);
    if (error.name === 'TypeError' || error.message === 'Failed to fetch' || (error.$metadata && error.$metadata.attempts)) {
      console.warn("⚠️ 클라우드플레어 R2 CORS 설정이 누락되었을 수 있습니다. Cloudflare 대시보드에서 버킷의 CORS 설정을 확인해주세요.");
      throw new Error("네트워크 오류 또는 CORS 설정 문제입니다. R2 버킷의 CORS 설정을 확인하세요.");
    }
    throw error;
  }
};

/**
 * Cloudflare R2에서 파일 삭제
 */
export const deleteFileFromR2 = async (fileKey) => {
  if (!r2Client) return true;
  try {
    const params = { Bucket: "crm-img", Key: fileKey };
    await r2Client.send(new DeleteObjectCommand(params));
    console.log('R2 파일 삭제 완료:', fileKey);
    return true;
  } catch (error) {
    console.error("R2 파일 삭제 오류:", error);
    throw error;
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
