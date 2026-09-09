-- 카페24 게시판 운영 컬럼 명시 보강
-- 기존 코드가 사용하는 필드를 새 환경에서도 안전하게 생성한다.

ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS cafe24_article_no integer;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS cafe24_board_no integer;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS cafe24_mall_id text;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS cafe24_writer_name text;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS cafe24_writer_email text;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS cafe24_url text;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.board_posts ADD COLUMN IF NOT EXISTS answer_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS board_posts_source_created_at_idx
  ON public.board_posts (source, created_at DESC);

CREATE INDEX IF NOT EXISTS board_posts_cafe24_lookup_idx
  ON public.board_posts (cafe24_mall_id, cafe24_board_no, cafe24_article_no);
