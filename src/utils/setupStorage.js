import { supabase } from '../lib/supabaseClient';

/**
 * Supabase 스토리지 버킷을 생성하고 설정하는 유틸리티 함수
 */

/**
 * 스토리지 버킷 생성
 * @param {string} bucketName - 생성할 버킷 이름
 * @param {Object} options - 버킷 옵션
 * @param {boolean} options.public - 공개 접근 여부 (기본값: false)
 * @param {string[]} options.allowedMimeTypes - 허용할 파일 타입 (예: ['image/*'])
 * @param {string} options.fileSizeLimit - 파일 크기 제한 (예: '5MB')
 * @returns {Promise<Object>} - 생성된 버킷 정보
 */
export const createBucket = async (bucketName, options = {}) => {
  try {
    const { data, error } = await supabase.storage.createBucket(bucketName, options);
    
    if (error) {
      console.error('버킷 생성 오류:', error);
      throw error;
    }
    
    console.log(`버킷 '${bucketName}' 생성 완료:`, data);
    return data;
  } catch (err) {
    console.error('버킷 생성 중 예외 발생:', err);
    throw err;
  }
};

/**
 * 스토리지 버킷 목록 조회
 * @returns {Promise<Array>} - 버킷 목록
 */
export const listBuckets = async () => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('버킷 목록 조회 오류:', error);
      throw error;
    }
    
    return data || [];
  } catch (err) {
    console.error('버킷 목록 조회 중 예외 발생:', err);
    throw err;
  }
};

/**
 * 버킷 존재 여부 확인 및 없으면 생성
 * @param {string} bucketName - 확인할 버킷 이름
 * @param {Object} options - 버킷 생성 옵션
 * @returns {Promise<Object>} - 버킷 정보
 */
export const ensureBucketExists = async (bucketName, options = {}) => {
  try {
    // 버킷 목록 조회
    const buckets = await listBuckets();
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    // 버킷이 없으면 생성
    if (!bucketExists) {
      console.log(`버킷 '${bucketName}'이 존재하지 않아 새로 생성합니다.`);
      return await createBucket(bucketName, options);
    }
    
    console.log(`버킷 '${bucketName}'이 이미 존재합니다.`);
    return buckets.find(bucket => bucket.name === bucketName);
  } catch (err) {
    console.error('버킷 확인 중 예외 발생:', err);
    throw err;
  }
};

/**
 * 애플리케이션에 필요한 모든 버킷 설정
 * @returns {Promise<void>}
 */
export const setupAllBuckets = async () => {
  try {
    // 영수증 저장용 버킷
    await ensureBucketExists('receipts', {
      public: false,
      allowedMimeTypes: ['image/*', 'application/pdf'],
      fileSizeLimit: '10MB'
    });
    
    // 프로필 이미지 저장용 버킷
    await ensureBucketExists('avatars', {
      public: true,
      allowedMimeTypes: ['image/*'],
      fileSizeLimit: '2MB'
    });
    
    // 서비스 문서 저장용 버킷
    await ensureBucketExists('documents', {
      public: false,
      allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      fileSizeLimit: '20MB'
    });
    
    console.log('모든 버킷 설정이 완료되었습니다.');
  } catch (err) {
    console.error('버킷 설정 중 오류 발생:', err);
    throw err;
  }
};

/**
 * 파일 업로드 함수
 * @param {string} bucketName - 버킷 이름
 * @param {string} filePath - 저장할 경로
 * @param {File} file - 업로드할 파일
 * @param {Object} options - 업로드 옵션
 * @returns {Promise<Object>} - 업로드 결과
 */
export const uploadFile = async (bucketName, filePath, file, options = {}) => {
  try {
    // 버킷 존재 확인
    await ensureBucketExists(bucketName);
    
    // 파일 업로드
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        ...options
      });
    
    if (error) {
      console.error('파일 업로드 오류:', error);
      throw error;
    }
    
    return data;
  } catch (err) {
    console.error('파일 업로드 중 예외 발생:', err);
    throw err;
  }
};

/**
 * 파일 URL 가져오기
 * @param {string} bucketName - 버킷 이름
 * @param {string} filePath - 파일 경로
 * @returns {string} - 파일 URL
 */
export const getFileUrl = (bucketName, filePath) => {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};

export default {
  createBucket,
  listBuckets,
  ensureBucketExists,
  setupAllBuckets,
  uploadFile,
  getFileUrl
}; 