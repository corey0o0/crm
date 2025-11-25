-- Enable RLS and add policies for public.notifications

-- Ensure the table exists before modifying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    RAISE NOTICE 'Table public.notifications does not exist; skipping RLS setup.';
  ELSE
    EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Allow authenticated users to read notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated read notifications" ON public.notifications;
    CREATE POLICY "Allow authenticated read notifications" ON public.notifications
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Allow authenticated users to insert notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated insert notifications" ON public.notifications;
    CREATE POLICY "Allow authenticated insert notifications" ON public.notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
