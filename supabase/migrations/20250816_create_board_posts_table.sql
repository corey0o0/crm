-- 게시판 테이블 생성
create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid,
  author_email text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS 활성화 및 기본 정책 (필요시 강화 가능)
alter table public.board_posts enable row level security;

-- 모두 조회 가능 (기존 정책이 있으면 삭제 후 생성)
drop policy if exists "board_posts_select_all" on public.board_posts;
create policy "board_posts_select_all"
on public.board_posts for select
using (true);

-- 인증 사용자만 작성/수정/삭제 가능 (존재 시 삭제 후 생성)
drop policy if exists "board_posts_insert_auth" on public.board_posts;
create policy "board_posts_insert_auth"
on public.board_posts for insert
with check (auth.role() = 'authenticated');

drop policy if exists "board_posts_update_auth" on public.board_posts;
create policy "board_posts_update_auth"
on public.board_posts for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "board_posts_delete_auth" on public.board_posts;
create policy "board_posts_delete_auth"
on public.board_posts for delete
using (auth.role() = 'authenticated');

-- 업데이트 트리거로 updated_at 갱신
create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_board_posts on public.board_posts;
create trigger set_timestamp_board_posts
before update on public.board_posts
for each row execute procedure public.set_timestamp();


