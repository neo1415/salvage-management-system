CREATE TABLE IF NOT EXISTS pickup_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES salvage_cases(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id),
  photo_urls VARCHAR[] NOT NULL,
  notes TEXT,
  comparison_status VARCHAR(40) NOT NULL DEFAULT 'not_reviewed',
  comparison_summary JSONB NOT NULL,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_evidence_auction ON pickup_evidence(auction_id);
CREATE INDEX IF NOT EXISTS idx_pickup_evidence_case ON pickup_evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_pickup_evidence_vendor ON pickup_evidence(vendor_id);
CREATE INDEX IF NOT EXISTS idx_pickup_evidence_status ON pickup_evidence(comparison_status);
CREATE INDEX IF NOT EXISTS idx_pickup_evidence_created_at ON pickup_evidence(created_at);
