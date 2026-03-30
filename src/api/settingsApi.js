import { supabase } from '../lib/supabaseClient';

/**
 * 전역 앱 설정을 가져오는 함수
 * @param {string} key - 설정 키 (예: 'user_menu_permissions')
 * @returns {Promise<{data: any, error: any}>}
 */
export const getAppSetting = async (key) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없는 경우 (새로 만들어야 함)
        return { data: null, error: null };
      }
      throw error;
    }
    
    return { data: data?.value, error: null };
  } catch (error) {
    console.error(`설정 조회 오류 (${key}):`, error);
    return { data: null, error };
  }
};

/**
 * 전역 앱 설정을 저장(또는 덮어쓰기)하는 함수
 * @param {string} key - 설정 키
 * @param {any} value - 저장할 JSON 데이터
 * @returns {Promise<{data: any, error: any}>}
 */
export const saveAppSetting = async (key, value) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error(`설정 저장 오류 (${key}):`, error);
    return { data: null, error };
  }
};
