import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

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