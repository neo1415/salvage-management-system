-- Create market_data_cache table
CREATE TABLE IF NOT EXISTS "market_data_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_hash" varchar(64) NOT NULL UNIQUE,
  "property_type" varchar(20) NOT NULL,
  "property_details" jsonb NOT NULL,
  "median_price" numeric(12, 2) NOT NULL,
  "min_price" numeric(12, 2) NOT NULL,
  "max_price" numeric(12, 2) NOT NULL,
  "source_count" integer NOT NULL,
  "scraped_at" timestamp NOT NULL DEFAULT now(),
  "stale_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for market_data_cache
CREATE INDEX IF NOT EXISTS "idx_market_data_property_hash" ON "market_data_cache"("property_hash");
CREATE INDEX IF NOT EXISTS "idx_market_data_stale" ON "market_data_cache"("scraped_at");
CREATE INDEX IF NOT EXISTS "idx_market_data_type" ON "market_data_cache"("property_type");

-- Create market_data_sources table
CREATE TABLE IF NOT EXISTS "market_data_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cache_id" uuid NOT NULL REFERENCES "market_data_cache"("id") ON DELETE CASCADE,
  "source_name" varchar(50) NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'NGN',
  "listing_url" text NOT NULL,
  "listing_title" text NOT NULL,
  "scraped_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for market_data_sources
CREATE INDEX IF NOT EXISTS "idx_market_sources_cache" ON "market_data_sources"("cache_id");
CREATE INDEX IF NOT EXISTS "idx_market_sources_name" ON "market_data_sources"("source_name");

-- Create scraping_logs table
CREATE TABLE IF NOT EXISTS "scraping_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_hash" varchar(64) NOT NULL,
  "source_name" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL,
  "prices_found" integer DEFAULT 0,
  "duration_ms" integer NOT NULL,
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for scraping_logs
CREATE INDEX IF NOT EXISTS "idx_scraping_logs_property" ON "scraping_logs"("property_hash");
CREATE INDEX IF NOT EXISTS "idx_scraping_logs_source" ON "scraping_logs"("source_name", "created_at");
CREATE INDEX IF NOT EXISTS "idx_scraping_logs_status" ON "scraping_logs"("status");

-- Create background_jobs table
CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_type" varchar(50) NOT NULL,
  "property_hash" varchar(64) NOT NULL,
  "property_details" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "completed_at" timestamp
);

-- Create indexes for background_jobs
CREATE INDEX IF NOT EXISTS "idx_background_jobs_status" ON "background_jobs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_background_jobs_property" ON "background_jobs"("property_hash");
