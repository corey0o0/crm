import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// S3 클라이언트 초기화
const initR2Client = () => {
  if (!process.env.REACT_APP_R2_ACCESS_KEY_ID) {
    console.warn("R2 설정이 .env 파일에 누락되었습니다.");
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: process.env.REACT_APP_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.REACT_APP_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
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

  // 브라우저의 File 객체를 그대로 넣으면 AWS SDK v3 버그(readableStream.getReader is not a function)가
  // 발생할 수 있으므로 ArrayBuffer(Uint8Array) 타입으로 변환해서 전송합니다.
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
    
    const publicUrl = `${process.env.REACT_APP_R2_PUBLIC_URL}/${key}`;
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
    console.error("R2 업로드 오류:", error);
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
   const publicUrl = `${process.env.REACT_APP_R2_PUBLIC_URL}/${fileKey}`;
   return { id: fileKey, webViewLink: publicUrl };
};

export const getGoogleDriveDownloadUrl = (fileKey) => {
    return `${process.env.REACT_APP_R2_PUBLIC_URL}/${fileKey}`;
};

export const getGoogleDrivePreviewUrl = (fileKey) => {
    return `${process.env.REACT_APP_R2_PUBLIC_URL}/${fileKey}`;
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
