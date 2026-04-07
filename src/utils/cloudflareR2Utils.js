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
 * 구글 드라이브 findOrCreateFolder의 Drop-in 대체제
 * R2는 폴더(디렉토리) 개념 대신 Prefix(접두사) 경로를 사용하므로 Prefix 경로만 조립해서 반환합니다.
 */
export const findOrCreateFolder = async (folderName, parentFolderId = null, accessToken = null) => {
  let prefix = "";
  if (parentFolderId && parentFolderId !== "root") {
    // 이미 부모가 경로 형태인 경우 처리
    prefix = parentFolderId.endsWith("/") ? parentFolderId : `${parentFolderId}/`;
  }
  return { id: `${prefix}${folderName}` };
};

/**
 * 구글 드라이브 uploadFileToGoogleDrive의 Drop-in 대체제
 */
export const uploadFileToGoogleDrive = async (file, folderPrefix = null, accessToken = null) => {
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
    
    const r2PublicUrl = window._env_?.REACT_APP_R2_PUBLIC_URL || process.env.REACT_APP_R2_PUBLIC_URL;
    const publicUrl = `${r2PublicUrl}/${key}`;
    console.log("R2 업로드 완료:", publicUrl);
    
    // 기존 구글 드라이브 응답 구조를 유지하여 컴포넌트 수정을 최소화합니다.
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
 * 구글 드라이브 deleteGoogleDriveFile의 Drop-in 대체제
 */
export const deleteGoogleDriveFile = async (fileKey, accessToken = null) => {
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
 * getGoogleDriveFileInfo 대체제 (R2에서는 URL만 만들어서 반환)
 */
export const getGoogleDriveFileInfo = async (fileKey, accessToken = null) => {
   const r2PublicUrl = window._env_?.REACT_APP_R2_PUBLIC_URL || process.env.REACT_APP_R2_PUBLIC_URL;
   const publicUrl = `${r2PublicUrl}/${fileKey}`;
   return { id: fileKey, webViewLink: publicUrl };
};

export const getGoogleDriveDownloadUrl = (fileKey) => {
    const r2PublicUrl = window._env_?.REACT_APP_R2_PUBLIC_URL || process.env.REACT_APP_R2_PUBLIC_URL;
    return `${r2PublicUrl}/${fileKey}`;
};

export const getGoogleDrivePreviewUrl = (fileKey) => {
    const r2PublicUrl = window._env_?.REACT_APP_R2_PUBLIC_URL || process.env.REACT_APP_R2_PUBLIC_URL;
    return `${r2PublicUrl}/${fileKey}`;
};

/**
 * 구글 드라이브 shareGoogleDriveFile 대체제 (R2는 public url이므로 기본 true 반환)
 */
export const shareGoogleDriveFile = async (fileKey, accessToken, role, type) => {
    return true; // R2 버킷은 이미 Public으로 설정되어 있으므로 별도 권한 설정 불필요
};

/**
 * googleDriveConfig.js의 uploadToGoogleDrive 대체제 (영수증 업로드용)
 */
export const uploadToGoogleDrive = async (file, fileName) => {
    let uploadFile = file;
    if (fileName && file.name !== fileName) {
        uploadFile = new File([file], fileName, { type: file.type });
    }
    return await uploadFileToGoogleDrive(uploadFile, "receipts");
};
