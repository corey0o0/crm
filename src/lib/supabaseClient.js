import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  storage: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 연결 상태 확인 (개발 환경에서만 실행)
if (process.env.NODE_ENV === 'development') {
  supabase
    .from('services')
    .select('count', { count: 'exact' })
    .then(() => {
      // 연결 성공 - 로그 없음
    })
    .catch(() => {
      console.error('Database connection failed')
    })
} 