-- 네이버 톡톡 대화 상태 저장 테이블
-- 톡톡은 익명 user ID(al-...)만 주므로, 다단계 플로우(주문조회/AS접수) 진행상태를 서버에 보관한다.
create table if not exists chatbot_naver_sessions (
  naver_user text primary key,
  state      jsonb not null default '{"step":"IDLE","data":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 맥락유지(RAG history) + 핸드오버(상담원 인계) 기능용 컬럼
-- _naver_utils.js의 getHistory/appendHistory/setHandover/isHandover 가 참조함.
-- (이 ALTER를 실제 Supabase에 적용하지 않으면 history/handover select가 조용히 실패해
--  매 턴 대화 맥락이 비어있는 것처럼 동작함 — 컬럼 없음 → data:null → [] 로 폴백되기 때문)
alter table chatbot_naver_sessions add column if not exists history  jsonb not null default '[]'::jsonb;
alter table chatbot_naver_sessions add column if not exists handover boolean not null default false;

-- 오래된 세션 정리용 인덱스 (선택)
create index if not exists idx_naver_sessions_updated on chatbot_naver_sessions (updated_at);

-- RLS: service_role(백엔드)만 접근. anon 차단.
alter table chatbot_naver_sessions enable row level security;

-- (선택) 24시간 지난 세션 정리 — pg_cron 사용 시:
-- select cron.schedule('naver_session_cleanup','0 4 * * *',
--   $$ delete from chatbot_naver_sessions where updated_at < now() - interval '24 hours' $$);
