// Google OAuth 및 Drive API 설정
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;

export const initializeGoogleAPI = () => {
  return new Promise((resolve, reject) => {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.onload = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiInited = true;
          maybeResolve();
        } catch (err) {
          reject(err);
        }
      });
    };
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // 콜백은 요청 시 정의
        prompt: 'consent',
        ux_mode: 'popup',
        redirect_uri: window.location.origin, // 기본 도메인으로 변경
        access_type: 'offline',
        include_granted_scopes: true
      });
      gisInited = true;
      maybeResolve();
    };
    document.body.appendChild(script2);

    function maybeResolve() {
      if (gapiInited && gisInited) {
        resolve();
      }
    }
  });
};

export const getAccessToken = () => {
  return new Promise((resolve, reject) => {
    try {
      tokenClient.callback = (response) => {
        if (response.error) {
          reject(response);
        }
        resolve(response.access_token);
      };
      if (window.gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (err) {
      reject(err);
    }
  });
};

export const uploadToGoogleDrive = async (file, fileName) => {
  try {
    await getAccessToken();

    const metadata = {
      name: fileName,
      parents: [process.env.REACT_APP_GOOGLE_DRIVE_RECEIPT_FOLDER_ID]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
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

export const getFileLink = async (fileId) => {
  try {
    await getAccessToken();

    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'webViewLink'
    });

    return response.result.webViewLink;
  } catch (error) {
    console.error('Error getting file link:', error);
    throw error;
  }
}; 