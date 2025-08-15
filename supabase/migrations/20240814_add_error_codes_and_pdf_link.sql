-- Add error_codes and pdf_link columns to model_settings table
ALTER TABLE public.model_settings
ADD COLUMN IF NOT EXISTS error_codes JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pdf_link TEXT DEFAULT '';

-- Add comments for the new columns
COMMENT ON COLUMN public.model_settings.error_codes IS 'Error codes for the model (JSON format)';
COMMENT ON COLUMN public.model_settings.pdf_link IS 'PDF manual link for the model';
