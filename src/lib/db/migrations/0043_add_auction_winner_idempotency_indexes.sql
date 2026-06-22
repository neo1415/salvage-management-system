-- Ensure auction closure retries cannot create duplicate winner chains.
-- Existing polluted duplicate rows are collapsed by keeping the oldest row.

WITH ranked_by_rank AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY auction_id, rank
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM auction_winners
)
DELETE FROM auction_winners
WHERE id IN (
  SELECT id
  FROM ranked_by_rank
  WHERE row_number > 1
);

WITH ranked_by_vendor AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY auction_id, vendor_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM auction_winners
)
DELETE FROM auction_winners
WHERE id IN (
  SELECT id
  FROM ranked_by_vendor
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_winners_unique_rank
  ON auction_winners (auction_id, rank);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_winners_unique_vendor
  ON auction_winners (auction_id, vendor_id);
