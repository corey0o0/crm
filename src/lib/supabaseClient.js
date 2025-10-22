import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.')
}

console.log('[Supabase Client] Using URL:', supabaseUrl);
console.log('[Supabase Client] Environment:', process.env.NODE_ENV);

// 매번 새로운 클라이언트 인스턴스 생성
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};

// 기본 클라이언트 (하위 호환성)
export const supabase = createSupabaseClient(); 