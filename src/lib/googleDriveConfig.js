import { google } from 'googleapis';

// Google OAuth 및 Drive API 설정
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

let tokenClient;
let accessToken = null;

// Google OAuth 초기화
const initializeGoogleOAuth = () => {
  return new Promise((resolve, reject) => {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: (tokenResponse) => {
          if (tokenResponse.error !== undefined) {
            reject(tokenResponse);
          }
          accessToken = tokenResponse.access_token;
          resolve(tokenResponse);
        },
      });
    } catch (err) {
      reject(err);
    }
  });
};

// 액세스 토큰 가져오기
const getAccessToken = async () => {
  if (!tokenClient) {
    await initializeGoogleOAuth();
  }
  
  if (!accessToken) {
    return new Promise((resolve, reject) => {
      try {
        tokenClient.requestAccessToken();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
  return Promise.resolve();
};

// Google Drive에 파일 업로드
export const uploadToGoogleDrive = async (file, fileName) => {
  try {
    await getAccessToken();

    // 파일을 FormData로 변환
    const metadata = {
      name: fileName,
      parents: [process.env.REACT_APP_GOOGLE_DRIVE_RECEIPT_FOLDER_ID]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    // fetch API를 사용하여 파일 업로드
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    const result = await response.json();
    return {
      fileId: result.id,
      webViewLink: result.webViewLink
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
};

// 파일 링크 가져오기
export const getFileLink = async (fileId) => {
  try {
    await getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get file link');
    }

    const result = await response.json();
    return result.webViewLink;
  } catch (error) {
    console.error('Error getting file link:', error);
    throw error;
  }
}; 