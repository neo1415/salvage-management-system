# ML Training Data Pipeline Documentation

## Overview

The ML Training Data Pipeline exports structured datasets for training advanced machine learning models. The pipeline includes feature engineering, data anonymization, and multiple export formats.

**Key Features**:
- Automated feature vector computation
- Cyclical encoding for temporal features
- Normalization and one-hot encoding
- PII anonymization (GDPR compliant)
- Multiple export formats (CSV, JSON, Parquet)
- Train/validation/test splitting

## Feature Engineering

### Auction Features
- Asset attributes (make, model, year, condition)
- Market conditions (competition, trend, seasonality)
- Historical performance metrics
- Temporal features (hour, day, month)
- Geographic features (region, location)

### Vendor Features
- Bidding patterns (frequency, timing, amounts)
- Performance stats (win rate, avg bid, payment time)
- Behavioral metrics (session duration, engagement)
- Preference vectors (asset types, price ranges)

## Dataset Export Process

1. **Feature Extraction**: Compute feature vectors from raw data
2. **Normalization**: Scale numerical features to [0, 1]
3. **Encoding**: Convert categorical features to numerical
4. **Anonymization**: Remove PII, replace with hashed IDs
5. **Splitting**: Stratified split into train/validation/test
6. **Export**: Generate files in requested format

## Export Formats

### CSV
- Standard comma-separated values
- Header row with feature names
- Compatible with Excel, pandas, R

### JSON
- Nested structure with metadata
- Includes schema definition
- Easy to parse programmatically

### Parquet
- Columnar storage format
- Efficient compression
- Fast query performance
- Ideal for big data tools (Spark, Dask)

## Data Anonymization

All PII is removed before export:
- User names  Hashed vendor IDs
- Email addresses  Removed
- Phone numbers  Removed
- IP addresses  Removed
- GPS coordinates  Rounded to region level

## Quality Validation

- Missing value checks
- Outlier detection
- Feature correlation analysis
- Class balance verification
- Schema validation

## API Usage

POST /api/intelligence/ml/export-dataset
{
  "datasetType": "predictions",
  "format": "csv",
  "startDate": "2024-01-01",
  "endDate": "2024-02-15",
  "splitRatio": {
    "train": 0.7,
    "validation": 0.15,
    "test": 0.15
  },
  "anonymize": true
}

## References

- Service: src/features/intelligence/services/feature-engineering.service.ts
- API: src/app/api/intelligence/ml/export-dataset/route.ts
