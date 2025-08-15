create table public.model_settings (
  id uuid primary key default gen_random_uuid(),
  model_name text not null unique,
  series text not null,
  parameters jsonb not null default '{}'::jsonb,
  descriptions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS 활성화
alter table public.model_settings enable row level security;

-- 모든 사용자가 읽을 수 있도록 정책 설정
create policy "Allow public read access"
on public.model_settings for select
using (true);

-- 인증된 사용자가 자신의 설정을 업데이트할 수 있도록 정책 설정
-- 이 예제에서는 모든 인증된 사용자가 업데이트할 수 있도록 허용합니다.
-- 실제 운영 환경에서는 'user_id' 컬럼을 추가하고, 해당 사용자만 수정할 수 있도록 제한해야 합니다.
create policy "Allow authenticated users to update"
on public.model_settings for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- 인증된 사용자가 설정을 삽입할 수 있도록 정책 설정
create policy "Allow authenticated users to insert"
on public.model_settings for insert
with check (auth.role() = 'authenticated');
