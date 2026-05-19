-- Lock down Supabase Data API access for the app-owned public schema.
--
-- This app reads/writes data through trusted Next.js API routes using Drizzle
-- and DATABASE_URL. Browser clients should not read or mutate tables directly
-- through Supabase's anon/authenticated Data API roles.
--
-- Important: do not use FORCE ROW LEVEL SECURITY here. The backend database
-- role must continue to work through server-side Drizzle.

BEGIN;

-- Remove direct table/sequence access from Supabase client API roles.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Keep future raw-SQL-created tables/sequences from being exposed by default
-- when this migration role owns them.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Enable RLS on all existing ordinary and partitioned tables in public.
-- With no policies for anon/authenticated, Supabase Data API access is denied.
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT quote_ident(n.nspname) AS schema_name, quote_ident(c.relname) AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %s.%s ENABLE ROW LEVEL SECURITY',
        table_record.schema_name,
        table_record.table_name
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped %.%: insufficient privilege',
          table_record.schema_name,
          table_record.table_name;
      WHEN feature_not_supported THEN
        RAISE NOTICE 'Skipped %.%: RLS not supported',
          table_record.schema_name,
          table_record.table_name;
    END;
  END LOOP;
END $$;

-- Defense-in-depth for public schema functions. The app should call its own
-- API routes, not arbitrary database functions through the exposed API roles.
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
