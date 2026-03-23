-- Create ratings table
CREATE TABLE IF NOT EXISTS "ratings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "auction_id" uuid NOT NULL REFERENCES "auctions"("id") ON DELETE CASCADE,
  "rated_by" uuid NOT NULL REFERENCES "users"("id"),
  "overall_rating" integer NOT NULL CHECK ("overall_rating" >= 1 AND "overall_rating" <= 5),
  "category_ratings" jsonb NOT NULL,
  "review" varchar(500),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_ratings_vendor_id" ON "ratings"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_ratings_auction_id" ON "ratings"("auction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ratings_auction_vendor_unique" ON "ratings"("auction_id", "vendor_id");
