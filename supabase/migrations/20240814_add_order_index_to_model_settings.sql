-- Add order_index column to model_settings table
ALTER TABLE public.model_settings
ADD COLUMN order_index INTEGER;
