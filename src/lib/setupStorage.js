import { supabase } from './supabaseClient';

const BUCKET_NAME = 'receipts';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation(operation, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Operation failed, retrying... (${i + 1}/${retries})`);
      await delay(RETRY_DELAY);
    }
  }
}

export async function setupStorage() {
  try {
    // 세션 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('No active session found');
      return false;
    }

    // 버킷 존재 여부 확인
    const { data: buckets, error: bucketsError } = await retryOperation(async () => {
      const response = await supabase.storage.listBuckets();
      if (response.error) throw response.error;
      return response;
    });

    if (bucketsError) {
      console.error('버킷 목록 조회 중 오류:', bucketsError);
      return false;
    }

    // 버킷이 존재하는지 확인
    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      // 버킷이 없으면 생성
      const { error: createError } = await retryOperation(async () => {
        const response = await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['image/*', 'application/pdf']
        });
        if (response.error) throw response.error;
        return response;
      });

      if (createError) {
        console.error('버킷 생성 중 오류:', createError);
        return false;
      }

      console.log('버킷이 성공적으로 생성되었습니다.');
    }

    // 버킷 접근 테스트
    const testResult = await retryOperation(async () => {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
        limit: 1,
        offset: 0
      });
      if (error) throw error;
      return { data, error };
    });

    if (testResult.error) {
      console.error('버킷 접근 테스트 중 오류:', testResult.error);
      return false;
    }

    console.log('스토리지 설정이 완료되었습니다.');
    return true;
  } catch (error) {
    console.error('스토리지 설정 중 오류 발생:', error);
    return false;
  }
} 