-- Migration 0019: Add Unique Constraint to Prevent Duplicate Documents
-- 
-- Problem: When auction expires, documents don't show immediately. 
-- User reloads page and gets DUPLICATE documents (4 instead of 2).
--
-- Solution: Add unique constraint on (auction_id, vendor_id, document_type)
-- to prevent duplicate documents from being created.
--
-- This ensures that only ONE document of each type can exist per auction/vendor combination.

-- Add unique constraint to release_forms table
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_forms_unique_document 
ON release_forms (auction_id, vendor_id, document_type);

-- Add comment to explain the constraint
COMMENT ON INDEX idx_release_forms_unique_document IS 
'Prevents duplicate documents: Only one document of each type per auction/vendor combination';
