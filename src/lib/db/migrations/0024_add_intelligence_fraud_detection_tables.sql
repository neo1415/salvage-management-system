-- Migration: Add AI-Powered Marketplace Intelligence Fraud Detection Tables
-- Description: Creates photo_hashes, photo_hash_index, and duplicate_photo_matches tables for perceptual hashing and fraud detection
-- Date: 2025-01-21

-- ============================================================================
-- PHOTO HASHES TABLE
-- ============================================================================

CREATE TABLE photo_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES salvage_cases(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NOT NULL,
  photo_index INTEGER NOT NULL,
  p_hash VARCHAR(64) NOT NULL,
  exif_data JSONB,
  complexity INTEGER CHECK (complexity >= 0 AND complexity <= 100),
  is_low_complexity BOOLEAN NOT NULL DEFAULT FALSE,
  authenticity_analysis JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Photo hashes indexes
CREATE INDEX idx_photo_hashes_case_id ON photo_hashes(case_id);
CREATE INDEX idx_photo_hashes_p_hash ON photo_hashes(p_hash);
CREATE INDEX idx_photo_hashes_photo_url ON photo_hashes(photo_url);
CREATE INDEX idx_photo_hashes_complexity ON photo_hashes(is_low_complexity) WHERE is_low_complexity = TRUE;
CREATE INDEX idx_photo_hashes_created_at ON photo_hashes(created_at DESC);

-- ============================================================================
-- PHOTO HASH INDEX TABLE (Multi-Index Hashing)
-- ============================================================================

CREATE TABLE photo_hash_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_hash_id UUID NOT NULL REFERENCES photo_hashes(id) ON DELETE CASCADE,
  segment_number INTEGER NOT NULL CHECK (segment_number >= 1 AND segment_number <= 4),
  segment_value VARCHAR(16) NOT NULL,
  full_p_hash VARCHAR(64) NOT NULL,
  case_id UUID NOT NULL,
  photo_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Photo hash index indexes
CREATE INDEX idx_photo_hash_index_photo_hash_id ON photo_hash_index(photo_hash_id);
CREATE INDEX idx_photo_hash_index_segment ON photo_hash_index(segment_number, segment_value);
CREATE INDEX idx_photo_hash_index_case_id ON photo_hash_index(case_id);
CREATE INDEX idx_photo_hash_index_segment_value ON photo_hash_index(segment_value);

-- ============================================================================
-- DUPLICATE PHOTO MATCHES TABLE
-- ============================================================================

CREATE TABLE duplicate_photo_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_photo_hash_id UUID NOT NULL REFERENCES photo_hashes(id) ON DELETE CASCADE,
  source_case_id UUID NOT NULL,
  source_photo_url VARCHAR(500) NOT NULL,
  matched_photo_hash_id UUID NOT NULL REFERENCES photo_hashes(id) ON DELETE CASCADE,
  matched_case_id UUID NOT NULL,
  matched_photo_url VARCHAR(500) NOT NULL,
  hamming_distance INTEGER NOT NULL CHECK (hamming_distance >= 0 AND hamming_distance <= 64),
  similarity_score INTEGER NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 100),
  same_user BOOLEAN NOT NULL,
  days_between INTEGER,
  asset_mismatch BOOLEAN,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  is_fraudulent BOOLEAN,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  notes VARCHAR(1000),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Duplicate photo matches indexes
CREATE INDEX idx_duplicate_matches_source ON duplicate_photo_matches(source_photo_hash_id);
CREATE INDEX idx_duplicate_matches_matched ON duplicate_photo_matches(matched_photo_hash_id);
CREATE INDEX idx_duplicate_matches_source_case ON duplicate_photo_matches(source_case_id);
CREATE INDEX idx_duplicate_matches_matched_case ON duplicate_photo_matches(matched_case_id);
CREATE INDEX idx_duplicate_matches_hamming ON duplicate_photo_matches(hamming_distance);
CREATE INDEX idx_duplicate_matches_risk_score ON duplicate_photo_matches(risk_score DESC);
CREATE INDEX idx_duplicate_matches_is_fraudulent ON duplicate_photo_matches(is_fraudulent) WHERE is_fraudulent = TRUE;
CREATE INDEX idx_duplicate_matches_created_at ON duplicate_photo_matches(created_at DESC);

-- ============================================================================
-- HELPER FUNCTION: Calculate Hamming Distance
-- ============================================================================

CREATE OR REPLACE FUNCTION hamming_distance(hash1 VARCHAR(64), hash2 VARCHAR(64))
RETURNS INTEGER AS $$
DECLARE
  distance INTEGER := 0;
  i INTEGER;
  char1 VARCHAR(1);
  char2 VARCHAR(1);
  bit1 INTEGER;
  bit2 INTEGER;
BEGIN
  -- Ensure both hashes are the same length
  IF LENGTH(hash1) != LENGTH(hash2) THEN
    RETURN NULL;
  END IF;
  
  -- Compare each character (hex digit)
  FOR i IN 1..LENGTH(hash1) LOOP
    char1 := SUBSTRING(hash1 FROM i FOR 1);
    char2 := SUBSTRING(hash2 FROM i FOR 1);
    
    -- Convert hex to integer
    bit1 := ('x' || char1)::bit(4)::integer;
    bit2 := ('x' || char2)::bit(4)::integer;
    
    -- Count differing bits using XOR
    distance := distance + BIT_COUNT((bit1 # bit2)::bit(4));
  END LOOP;
  
  RETURN distance;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- HELPER FUNCTION: Split pHash into Segments
-- ============================================================================

CREATE OR REPLACE FUNCTION split_phash_into_segments(p_hash VARCHAR(64))
RETURNS TABLE(segment_number INTEGER, segment_value VARCHAR(16)) AS $$
BEGIN
  RETURN QUERY
  SELECT 1, SUBSTRING(p_hash FROM 1 FOR 16)
  UNION ALL
  SELECT 2, SUBSTRING(p_hash FROM 17 FOR 16)
  UNION ALL
  SELECT 3, SUBSTRING(p_hash FROM 33 FOR 16)
  UNION ALL
  SELECT 4, SUBSTRING(p_hash FROM 49 FOR 16);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- TRIGGER: Auto-create photo hash index entries
-- ============================================================================

CREATE OR REPLACE FUNCTION create_photo_hash_index_entries()
RETURNS TRIGGER AS $$
DECLARE
  segment RECORD;
BEGIN
  -- Create index entries for each segment
  FOR segment IN SELECT * FROM split_phash_into_segments(NEW.p_hash) LOOP
    INSERT INTO photo_hash_index (
      photo_hash_id,
      segment_number,
      segment_value,
      full_p_hash,
      case_id,
      photo_url
    ) VALUES (
      NEW.id,
      segment.segment_number,
      segment.segment_value,
      NEW.p_hash,
      NEW.case_id,
      NEW.photo_url
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_photo_hash_index
  AFTER INSERT ON photo_hashes
  FOR EACH ROW
  EXECUTE FUNCTION create_photo_hash_index_entries();
