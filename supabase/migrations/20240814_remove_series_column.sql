-- Remove series column from model_settings table
ALTER TABLE public.model_settings
DROP COLUMN IF EXISTS series;
