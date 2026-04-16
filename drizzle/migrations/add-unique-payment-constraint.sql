-- Add unique constraint to prevent duplicate payment records
-- This ensures only one payment record can exist per auction-vendor pair

-- First, check if constraint already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_auction_vendor_payment'
    ) THEN
        -- Add unique constraint
        ALTER TABLE payments 
        ADD CONSTRAINT unique_auction_vendor_payment 
        UNIQUE (auction_id, vendor_id);
        
        RAISE NOTICE 'Added unique constraint: unique_auction_vendor_payment';
    ELSE
        RAISE NOTICE 'Unique constraint already exists: unique_auction_vendor_payment';
    END IF;
END $$;

-- Create index for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_payments_auction_vendor 
ON payments(auction_id, vendor_id);

COMMENT ON CONSTRAINT unique_auction_vendor_payment ON payments IS 
'Prevents duplicate payment records for the same auction and vendor. Added to fix concurrent auction closure issue.';
