-- Remove unique constraint from model_name column
ALTER TABLE public.model_settings
DROP CONSTRAINT IF EXISTS model_settings_model_name_key;
