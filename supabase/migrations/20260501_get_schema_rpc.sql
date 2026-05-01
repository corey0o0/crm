CREATE OR REPLACE FUNCTION public.get_column_type(t_name TEXT, c_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ctype TEXT;
BEGIN
  SELECT data_type INTO ctype
  FROM information_schema.columns
  WHERE table_name = t_name AND column_name = c_name;
  RETURN ctype;
END;
$$;
