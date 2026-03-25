-- setup_agencies_schema.sql

-- 1. Create agencies table
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_number text UNIQUE,     -- 거래처코드
  name text NOT NULL,              -- 거래처명
  ceo_name text,                   -- 대표자명
  phone text,                      -- 전화
  mobile text,                     -- 모바일
  address text,                    -- 주소
  email text,                      -- 이메일
  business_type text,              -- 업태
  business_category text,          -- 종목
  keywords text,                   -- 검색창내용
  memo text,                       -- 적요
  transfer_info jsonb,             -- 이체정보 { bank: '', account: '', owner: '' }
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Create index for faster search
CREATE INDEX IF NOT EXISTS idx_agencies_name ON public.agencies(name);
CREATE INDEX IF NOT EXISTS idx_agencies_business_number ON public.agencies(business_number);

-- 3. Set up Row Level Security (RLS) policies
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agencies;
CREATE POLICY "Enable read access for all users" ON public.agencies
  FOR SELECT USING (true);

-- Allow all changes to all authenticated users
DROP POLICY IF EXISTS "Enable all modifications for all users" ON public.agencies;
CREATE POLICY "Enable all modifications for all users" ON public.agencies
  FOR ALL USING (true);
  
-- 4. Alter table for existing database (safe to run multiple times)
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS business_category text;
