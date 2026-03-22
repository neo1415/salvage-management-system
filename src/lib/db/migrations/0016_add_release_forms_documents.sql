-- Migration 0016: Release Forms and Document Management System
-- Purpose: Add comprehensive document management for salvage auctions
-- Date: 2026-01-XX

-- Document types enum
CREATE TYPE document_type AS ENUM (
  'bill_of_sale',
  'liability_waiver',
  'pickup_authorization',
  'salvage_certificate'
);

-- Document status enum
CREATE TYPE document_status AS ENUM (
  'pending',
  'signed',
  'voided',
  'expired'
);

-- Release forms table
CREATE TABLE release_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  
  -- Digital signature data
  digital_signature TEXT, -- Base64 encoded signature image
  signed_at TIMESTAMP,
  signature_ip_address VARCHAR(45),
  signature_device_type VARCHAR(20),
  signature_user_agent VARCHAR(500),
  
  -- Document storage
  pdf_url VARCHAR(500), -- Cloudinary URL
  pdf_public_id VARCHAR(255), -- Cloudinary public ID for deletion
  
  -- Document metadata
  document_data JSONB NOT NULL DEFAULT '{}', -- Pre-filled form data
  
  -- Audit trail
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id),
  voided_at TIMESTAMP,
  voided_by UUID REFERENCES users(id),
  voided_reason TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document downloads audit table
CREATE TABLE document_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_form_id UUID NOT NULL REFERENCES release_forms(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Download metadata
  downloaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  user_agent VARCHAR(500) NOT NULL,
  
  -- Download context
  download_method VARCHAR(50) NOT NULL, -- 'email', 'portal', 'api'
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_release_forms_auction_id ON release_forms(auction_id);
CREATE INDEX idx_release_forms_vendor_id ON release_forms(vendor_id);
CREATE INDEX idx_release_forms_document_type ON release_forms(document_type);
CREATE INDEX idx_release_forms_status ON release_forms(status);
CREATE INDEX idx_release_forms_signed_at ON release_forms(signed_at);

CREATE INDEX idx_document_downloads_release_form_id ON document_downloads(release_form_id);
CREATE INDEX idx_document_downloads_vendor_id ON document_downloads(vendor_id);
CREATE INDEX idx_document_downloads_downloaded_at ON document_downloads(downloaded_at DESC);

-- Comments for documentation
COMMENT ON TABLE release_forms IS 'Stores all legal documents for salvage auctions (bill of sale, liability waivers, pickup authorizations, salvage certificates)';
COMMENT ON TABLE document_downloads IS 'Audit trail of all document downloads for compliance and tracking';

COMMENT ON COLUMN release_forms.digital_signature IS 'Base64 encoded PNG image of vendor signature captured via canvas';
COMMENT ON COLUMN release_forms.document_data IS 'Pre-filled form data (buyer info, seller info, asset details, prices, etc.)';
COMMENT ON COLUMN release_forms.pdf_url IS 'Cloudinary URL for the generated PDF document';
COMMENT ON COLUMN release_forms.pdf_public_id IS 'Cloudinary public ID for document deletion';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_release_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_release_forms_updated_at
  BEFORE UPDATE ON release_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_release_forms_updated_at();
