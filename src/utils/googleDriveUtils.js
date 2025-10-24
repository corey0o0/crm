/**
 * 구글 드라이브 API 유틸리티
 * 파일 업로드, 다운로드, 폴더 생성 등의 기능을 제공합니다.
 */

// 구글 드라이브 API 설정
const GOOGLE_DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3';

/**
 * 구글 드라이브에 파일 업로드
 * @param {File} file - 업로드할 파일
 * @param {string} folderId - 업로드할 폴더 ID (선택사항)
 * @param {string} accessToken - 구글 액세스 토큰
 * @returns {Promise<Object>} 업로드된 파일 정보
 */
export const uploadFileToGoogleDrive = async (file, folderId = null, accessToken) => {
  try {
    console.log('구글 드라이브 파일 업로드 시작:', file.name);
    
    if (!accessToken) {
      throw new Error('구글 드라이브 액세스 토큰이 필요합니다.');
    }

    // 파일 메타데이터 생성
    const metadata = {
      name: file.name,
      parents: folderId ? [folderId] : undefined
    };

    // 멀티파트 업로드 (작은 파일용)
    if (file.size < 5 * 1024 * 1024) { // 5MB 미만
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const response = await fetch(`${GOOGLE_UPLOAD_API_URL}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('업로드 응답 오류:', response.status, errorText);
        throw new Error(`업로드 실패: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('파일 업로드 완료:', result);
      return result;
    } 
    // Resumable 업로드 (큰 파일용)
    else {
      // 1단계: 업로드 세션 시작
      const sessionResponse = await fetch(`${GOOGLE_UPLOAD_API_URL}/files?uploadType=resumable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error('세션 생성 오류:', sessionResponse.status, errorText);
        throw new Error(`업로드 세션 생성 실패: ${sessionResponse.status} - ${errorText}`);
      }

      const sessionUrl = sessionResponse.headers.get('Location');
      if (!sessionUrl) {
        throw new Error('업로드 세션 URL을 받지 못했습니다.');
      }

      // 2단계: 파일 데이터 업로드
      const uploadResponse = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': file.size.toString()
        },
        body: file
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('파일 업로드 오류:', uploadResponse.status, errorText);
        throw new Error(`파일 업로드 실패: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      console.log('파일 업로드 완료:', result);
      return result;
    }

  } catch (error) {
    console.error('구글 드라이브 업로드 오류:', error);
    throw error;
  }
};

/**
 * 구글 드라이브에서 폴더 생성
 * @param {string} folderName - 폴더 이름
 * @param {string} parentFolderId - 부모 폴더 ID (선택사항)
 * @param {string} accessToken - 구글 액세스 토큰
 * @returns {Promise<Object>} 생성된 폴더 정보
 */
export const createFolderInGoogleDrive = async (folderName, parentFolderId = null, accessToken) => {
  try {
    console.log('구글 드라이브 폴더 생성:', folderName);
    
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined
    };

    const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      throw new Error(`폴더 생성 실패: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('폴더 생성 완료:', result);
    return result;

  } catch (error) {
    console.error('구글 드라이브 폴더 생성 오류:', error);
    throw error;
  }
};

/**
 * 구글 드라이브에서 폴더 찾기 또는 생성
 * @param {string} folderName - 폴더 이름
 * @param {string} parentFolderId - 부모 폴더 ID (선택사항)
 * @param {string} accessToken - 구글 액세스 토큰
 * @returns {Promise<Object>} 폴더 정보
 */
export const findOrCreateFolder = async (folderName, parentFolderId = null, accessToken) => {
  try {
    // 먼저 폴더가 존재하는지 확인
    const searchQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `${GOOGLE_DRIVE_API_URL}/files?q=${encodeURIComponent(searchQuery)}${parentFolderId ? ` and '${parentFolderId}' in parents` : ''}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.files && searchResult.files.length > 0) {
        console.log('기존 폴더 발견:', searchResult.files[0]);
        return searchResult.files[0];
      }
    }

    // 폴더가 없으면 생성
    console.log('폴더가 없어서 새로 생성합니다.');
    return await createFolderInGoogleDrive(folderName, parentFolderId, accessToken);

  } catch (error) {
    console.error('폴더 찾기/생성 오류:', error);
    throw error;
  }
};

/**
 * 구글 드라이브 파일 공유 설정
 * @param {string} fileId - 파일 ID
 * @param {string} accessToken - 구글 액세스 토큰
 * @param {string} role - 공유 역할 (reader, writer, owner)
 * @param {string} type - 공유 타입 (user, group, domain, anyone)
 * @returns {Promise<Object>} 공유 설정 결과
 */
export const shareGoogleDriveFile = async (fileId, accessToken, role = 'reader', type = 'anyone') => {
  try {
    const permission = {
      role: role,
      type: type
    };

    const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(permission)
    });

    if (!response.ok) {
      throw new Error(`파일 공유 설정 실패: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('파일 공유 설정 완료:', result);
    return result;

  } catch (error) {
    console.error('파일 공유 설정 오류:', error);
    throw error;
  }
};

/**
 * 구글 드라이브 파일 정보 조회
 * @param {string} fileId - 파일 ID
 * @param {string} accessToken - 구글 액세스 토큰
 * @returns {Promise<Object>} 파일 정보
 */
export const getGoogleDriveFileInfo = async (fileId, accessToken) => {
  try {
    const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`파일 정보 조회 실패: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('파일 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 구글 드라이브 파일 삭제
 * @param {string} fileId - 파일 ID
 * @param {string} accessToken - 구글 액세스 토큰
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export const deleteGoogleDriveFile = async (fileId, accessToken) => {
  try {
    const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`파일 삭제 실패: ${response.status} ${response.statusText}`);
    }

    console.log('파일 삭제 완료:', fileId);
    return true;

  } catch (error) {
    console.error('파일 삭제 오류:', error);
    throw error;
  }
};

/**
 * 구글 드라이브 파일 다운로드 URL 생성
 * @param {string} fileId - 파일 ID
 * @param {string} accessToken - 구글 액세스 토큰
 * @returns {string} 다운로드 URL
 */
export const getGoogleDriveDownloadUrl = (fileId) => {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

/**
 * 구글 드라이브 파일 미리보기 URL 생성
 * @param {string} fileId - 파일 ID
 * @returns {string} 미리보기 URL
 */
export const getGoogleDrivePreviewUrl = (fileId) => {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
};
