CREATE OR REPLACE FUNCTION public.cleanup_background_jobs()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        policy RECORD;
      BEGIN
        -- Get retention policy
        SELECT retention_days, cleanup_batch_size 
        INTO policy
        FROM data_retention_policies 
        WHERE table_name = 'background_jobs' AND is_enabled = true;
        
        IF NOT FOUND THEN
          RAISE NOTICE 'No retention policy found for background_jobs';
          RETURN 0;
        END IF;
        
        -- Delete completed/failed jobs older than retention period
        LOOP
          DELETE FROM background_jobs 
          WHERE ctid IN (
            SELECT ctid FROM background_jobs 
            WHERE status IN ('completed', 'failed', 'cancelled')
              AND created_at < NOW() - (policy.retention_days || ' days')::INTERVAL
            LIMIT policy.cleanup_batch_size
          );
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          total_deleted := total_deleted + deleted_count;
          
          EXIT WHEN deleted_count = 0;
          PERFORM pg_sleep(0.1);
        END LOOP;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = 'background_jobs';
        
        RAISE NOTICE 'Background jobs cleanup completed. Deleted % rows.', total_deleted;
        RETURN total_deleted;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_market_data_cache()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        policy RECORD;
      BEGIN
        -- Get retention policy
        SELECT retention_days, cleanup_batch_size 
        INTO policy
        FROM data_retention_policies 
        WHERE table_name = 'market_data_cache' AND is_enabled = true;
        
        IF NOT FOUND THEN
          RAISE NOTICE 'No retention policy found for market_data_cache';
          RETURN 0;
        END IF;
        
        -- Delete stale entries older than retention period
        LOOP
          DELETE FROM market_data_cache 
          WHERE ctid IN (
            SELECT ctid FROM market_data_cache 
            WHERE (
              stale_at < NOW() - (policy.retention_days || ' days')::INTERVAL
              OR created_at < NOW() - (policy.retention_days || ' days')::INTERVAL
            )
            LIMIT policy.cleanup_batch_size
          );
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          total_deleted := total_deleted + deleted_count;
          
          EXIT WHEN deleted_count = 0;
          PERFORM pg_sleep(0.1);
        END LOOP;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = 'market_data_cache';
        
        RAISE NOTICE 'Market data cache cleanup completed. Deleted % rows.', total_deleted;
        RETURN total_deleted;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_data(target_table text, retention_days integer, batch_size integer DEFAULT 1000, date_column text DEFAULT 'created_at'::text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        cutoff_date TIMESTAMP;
      BEGIN
        -- Calculate cutoff date
        cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Log cleanup start
        RAISE NOTICE 'Starting cleanup for table % with cutoff date %', target_table, cutoff_date;
        
        -- Delete in batches to avoid long locks
        LOOP
          EXECUTE format(
            'DELETE FROM %I WHERE %I < $1 AND ctid IN (SELECT ctid FROM %I WHERE %I < $1 LIMIT $2)',
            target_table, date_column, target_table, date_column
          ) USING cutoff_date, batch_size;
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          total_deleted := total_deleted + deleted_count;
          
          -- Exit if no more rows to delete
          EXIT WHEN deleted_count = 0;
          
          -- Small delay between batches
          PERFORM pg_sleep(0.1);
        END LOOP;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = target_table;
        
        RAISE NOTICE 'Cleanup completed for table %. Deleted % rows.', target_table, total_deleted;
        RETURN total_deleted;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_records(target_table text, retention_days integer, batch_size integer DEFAULT 1000)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
      DECLARE
        deleted_count INTEGER := 0;
        total_deleted INTEGER := 0;
        cutoff_date TIMESTAMP;
      BEGIN
        cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Different cleanup strategies for different tables
        IF target_table = 'market_data_cache' THEN
          -- For market data cache, delete stale entries
          LOOP
            DELETE FROM market_data_cache 
            WHERE ctid IN (
              SELECT ctid FROM market_data_cache 
              WHERE (stale_at < cutoff_date OR created_at < cutoff_date)
              LIMIT batch_size
            );
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            total_deleted := total_deleted + deleted_count;
            EXIT WHEN deleted_count = 0;
            PERFORM pg_sleep(0.1);
          END LOOP;
          
        ELSIF target_table = 'background_jobs' THEN
          -- For background jobs, only delete completed/failed jobs
          LOOP
            DELETE FROM background_jobs 
            WHERE ctid IN (
              SELECT ctid FROM background_jobs 
              WHERE status IN ('completed', 'failed', 'cancelled')
                AND created_at < cutoff_date
              LIMIT batch_size
            );
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            total_deleted := total_deleted + deleted_count;
            EXIT WHEN deleted_count = 0;
            PERFORM pg_sleep(0.1);
          END LOOP;
          
        ELSE
          -- Generic cleanup for other tables (only if table exists)
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = target_table) THEN
            LOOP
              EXECUTE format(
                'DELETE FROM %I WHERE ctid IN (SELECT ctid FROM %I WHERE created_at < $1 LIMIT $2)',
                target_table, target_table
              ) USING cutoff_date, batch_size;
              
              GET DIAGNOSTICS deleted_count = ROW_COUNT;
              total_deleted := total_deleted + deleted_count;
              EXIT WHEN deleted_count = 0;
              PERFORM pg_sleep(0.1);
            END LOOP;
          END IF;
        END IF;
        
        -- Update last cleanup time
        UPDATE data_retention_policies 
        SET last_cleanup_at = NOW() 
        WHERE table_name = target_table;
        
        RETURN total_deleted;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.create_table_backup(table_name text, backup_type text DEFAULT 'full'::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
      DECLARE
        backup_table_name TEXT;
        timestamp_suffix TEXT;
        result_message TEXT;
      BEGIN
        timestamp_suffix := to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
        backup_table_name := table_name || '_backup_' || timestamp_suffix;
        
        IF backup_type = 'full' THEN
          EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I', backup_table_name, table_name);
          result_message := 'Full backup created: ' || backup_table_name;
        ELSIF backup_type = 'schema_only' THEN
          EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I WHERE false', backup_table_name, table_name);
          result_message := 'Schema backup created: ' || backup_table_name;
        END IF;
        
        EXECUTE format('COMMENT ON TABLE %I IS ''Backup of %I created at %s''', 
          backup_table_name, table_name, NOW()::TEXT);
        
        RETURN result_message;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.restore_from_backup(original_table text, backup_table text, restore_mode text DEFAULT 'replace'::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
      DECLARE
        row_count INTEGER;
        result_message TEXT;
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = backup_table) THEN
          RETURN 'ERROR: Backup table ' || backup_table || ' does not exist';
        END IF;
        
        IF restore_mode = 'replace' THEN
          EXECUTE format('TRUNCATE TABLE %I', original_table);
          EXECUTE format('INSERT INTO %I SELECT * FROM %I', original_table, backup_table);
          result_message := 'Replaced all data in ' || original_table;
        ELSIF restore_mode = 'append' THEN
          EXECUTE format('INSERT INTO %I SELECT * FROM %I', original_table, backup_table);
          result_message := 'Appended data to ' || original_table;
        END IF;
        
        EXECUTE format('SELECT COUNT(*) FROM %I', original_table) INTO row_count;
        
        RETURN result_message || '. Final row count: ' || row_count;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup(force_all boolean DEFAULT false)
 RETURNS TABLE(table_name text, deleted_rows integer, cleanup_duration interval, status text)
 LANGUAGE plpgsql
AS $function$
      DECLARE
        policy RECORD;
        deleted_count INTEGER;
        start_time TIMESTAMP;
        end_time TIMESTAMP;
        should_cleanup BOOLEAN;
      BEGIN
        FOR policy IN 
          SELECT * FROM data_retention_policies 
          WHERE is_enabled = true 
          ORDER BY table_name
        LOOP
          start_time := NOW();
          deleted_count := 0;
          
          -- Check if cleanup is due
          should_cleanup := force_all OR 
            policy.last_cleanup_at IS NULL OR
            (policy.cleanup_frequency = 'daily' AND policy.last_cleanup_at < NOW() - INTERVAL '1 day') OR
            (policy.cleanup_frequency = 'weekly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 week') OR
            (policy.cleanup_frequency = 'monthly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 month');
          
          IF should_cleanup THEN
            -- Use specialized cleanup functions where available
            IF policy.table_name = 'market_data_cache' THEN
              SELECT cleanup_market_data_cache() INTO deleted_count;
            ELSIF policy.table_name = 'background_jobs' THEN
              SELECT cleanup_background_jobs() INTO deleted_count;
            ELSE
              -- Use generic cleanup for other tables
              BEGIN
                SELECT cleanup_old_data(
                  policy.table_name, 
                  policy.retention_days, 
                  policy.cleanup_batch_size
                ) INTO deleted_count;
              EXCEPTION WHEN OTHERS THEN
                deleted_count := -1; -- Error indicator
              END;
            END IF;
            
            end_time := NOW();
            
            RETURN QUERY SELECT 
              policy.table_name,
              deleted_count,
              end_time - start_time,
              CASE 
                WHEN deleted_count = -1 THEN 'ERROR'
                WHEN deleted_count = 0 THEN 'NO_DATA_TO_CLEAN'
                ELSE 'SUCCESS'
              END;
          ELSE
            RETURN QUERY SELECT 
              policy.table_name,
              0,
              INTERVAL '0',
              'SKIPPED_NOT_DUE';
          END IF;
        END LOOP;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.run_retention_cleanup(force_all boolean DEFAULT false)
 RETURNS TABLE(table_name text, deleted_rows integer, status text, message text)
 LANGUAGE plpgsql
AS $function$
      DECLARE
        policy RECORD;
        deleted_count INTEGER;
        should_cleanup BOOLEAN;
      BEGIN
        FOR policy IN 
          SELECT * FROM data_retention_policies 
          WHERE is_enabled = true 
          ORDER BY table_name
        LOOP
          -- Check if cleanup is due
          should_cleanup := force_all OR 
            policy.last_cleanup_at IS NULL OR
            (policy.cleanup_frequency = 'daily' AND policy.last_cleanup_at < NOW() - INTERVAL '1 day') OR
            (policy.cleanup_frequency = 'weekly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 week') OR
            (policy.cleanup_frequency = 'monthly' AND policy.last_cleanup_at < NOW() - INTERVAL '1 month');
          
          IF should_cleanup THEN
            BEGIN
              SELECT cleanup_old_records(
                policy.table_name, 
                policy.retention_days, 
                policy.cleanup_batch_size
              ) INTO deleted_count;
              
              RETURN QUERY SELECT 
                policy.table_name::TEXT,
                deleted_count,
                'SUCCESS'::TEXT,
                ('Cleaned ' || deleted_count || ' old records')::TEXT;
                
            EXCEPTION WHEN OTHERS THEN
              RETURN QUERY SELECT 
                policy.table_name::TEXT,
                0,
                'ERROR'::TEXT,
                SQLERRM::TEXT;
            END;
          ELSE
            RETURN QUERY SELECT 
              policy.table_name::TEXT,
              0,
              'SKIPPED'::TEXT,
              'Not due for cleanup'::TEXT;
          END IF;
        END LOOP;
      END;
      $function$
;
DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename); END LOOP; END $$;
