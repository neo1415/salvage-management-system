CREATE TABLE IF NOT EXISTS image_upload_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  image_index NUMERIC(6, 0),
  purpose VARCHAR(80) NOT NULL DEFAULT 'evidence',
  uploaded_by UUID REFERENCES users(id),
  source VARCHAR(80),
  original_filename VARCHAR(255),
  mime_type VARCHAR(120),
  file_size_bytes NUMERIC(14, 0),
  browser_last_modified_at TIMESTAMP,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMP,
  gps_latitude NUMERIC(10, 7),
  gps_longitude NUMERIC(10, 7),
  gps_altitude NUMERIC(10, 2),
  device_make VARCHAR(120),
  device_model VARCHAR(120),
  device_software VARCHAR(255),
  orientation NUMERIC(4, 0),
  width NUMERIC(8, 0),
  height NUMERIC(8, 0),
  metadata_status VARCHAR(30) NOT NULL DEFAULT 'unavailable',
  metadata_warnings TEXT[],
  sha256_hash VARCHAR(64),
  raw_metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_metadata_entity
  ON image_upload_metadata(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_image_metadata_uploaded_by
  ON image_upload_metadata(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_image_metadata_image_url
  ON image_upload_metadata(image_url);

CREATE INDEX IF NOT EXISTS idx_image_metadata_captured_at
  ON image_upload_metadata(captured_at);

CREATE INDEX IF NOT EXISTS idx_image_metadata_uploaded_at
  ON image_upload_metadata(uploaded_at);
