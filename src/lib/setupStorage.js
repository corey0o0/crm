import { supabase } from './supabaseClient';

const BUCKET_NAME = 'receipts';

export async function setupStorage() {
  try {
    // 버킷 존재 여부 확인
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('버킷 목록 조회 중 오류:', bucketsError);
      throw bucketsError;
    }

    // 버킷이 존재하는지 확인
    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      // 버킷이 없으면 생성
      const { error: createError } = await supabase
        .storage
        .createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });

      if (createError) {
        console.error('버킷 생성 중 오류:', createError);
        throw createError;
      }

      console.log('버킷이 성공적으로 생성되었습니다.');
    }

    // 버킷 접근 권한 확인
    const { data: bucketPolicy, error: policyError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .list();

    if (policyError) {
      console.error('버킷 접근 권한 확인 중 오류:', policyError);
      throw policyError;
    }

    console.log('스토리지 설정이 완료되었습니다.');
    return true;
  } catch (error) {
    console.error('스토리지 설정 중 오류 발생:', error);
    return false;
  }
} 