import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl) // 디버깅용
console.log('Supabase Key exists:', !!supabaseKey) // 디버깅용

if (!supabaseUrl || !supabaseKey) {
  throw new Error('환경 변수가 올바르게 설정되지 않았습니다.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// 연결 테스트
supabase
  .from('services')
  .select('count')
  .then(({ data, error }) => {
    if (error) {
      console.error('Supabase connection error:', error)
    } else {
      console.log('Supabase connected successfully')
    }
  }) 