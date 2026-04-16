-- Migration: Add unique constraint to prevent duplicate documents
-- Ensures only one document per auction/vendor/documentType combination
-- This prevents race conditions during document generation

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_forms_unique_document 
ON release_forms (auction_id, vendor_id, document_type);

-- Add comment for documentation
COMMENT ON INDEX idx_release_forms_unique_document IS 'Prevents duplicate document generation for the same auction, vendor, and document type';
