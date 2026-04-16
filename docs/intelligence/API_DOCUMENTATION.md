# AI Marketplace Intelligence - API Documentation

## Overview

The AI Marketplace Intelligence system provides RESTful API endpoints for price predictions, personalized recommendations, fraud detection, analytics, and ML training data export. All endpoints follow Next.js App Router conventions and require authentication via JWT tokens.

**Base URL**: `/api/intelligence`

**Authentication**: All endpoints require a valid JWT token in the Authorization header or session cookie.

**Response Format**: JSON

**Error Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing or invalid authentication)
- `404`: Not Found
- `500`: Internal Server Error

---

## Table of Contents

1. [Prediction Endpoints](#prediction-endpoints)
2. [Recommendation Endpoints](#recommendation-endpoints)
3. [Interaction Tracking](#interaction-tracking)
4. [Analytics Endpoints](#analytics-endpoints)
5. [ML Training Endpoints](#ml-training-endpoints)
6. [Admin Endpoints](#admin-endpoints)
7. [Fraud Detection](#fraud-detection)
8. [Privacy & Export](#privacy--export)

---

## Prediction Endpoints

### GET /api/auctions/[id]/prediction

Get price prediction for a specific auction.

**Authentication**: Required (Vendor or Admin)

**Parameters**:
- `id` (path): Auction UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "auctionId": "uuid",
    "predictedPrice": 1250000,
    "lowerBound": 1150000,
    "upperBound": 1350000,
    "confidenceScore": 82,
    "confidenceLevel": "High",
    "algorithmVersion": "v1.2.0",
    "fallbackMethod": "historical",
    "similarAuctionCount": 12,
    "marketConditions": {
      "competitionLevel": "medium",
      "trendMultiplier": 1.05,
      "seasonalMultiplier": 1.0
    },
    "timestamp": "2024-02-15T10:30:00Z"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Auction not found"
}
```

**Caching**: 5-minute TTL in Redis

**Real-time Updates**: Emits `prediction:updated` Socket.IO event when prediction changes by >10%

---

## Recommendation Endpoints

### GET /api/vendors/[id]/recommendations

Get personalized auction recommendations for a vendor.

**Authentication**: Required (Vendor - must match ID, or Admin)

**Parameters**:
- `id` (path): Vendor UUID
- `limit` (query, optional): Number of results (default: 20, max: 50)
- `offset` (query, optional): Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "uuid",
        "auctionId": "uuid",
        "matchScore": 87,
        "reasonCodes": [
          "similar_to_previous_bids",
          "preferred_make_model",
          "price_range_match"
        ],
        "auction": {
          "id": "uuid",
          "title": "2020 Toyota Camry - Moderate Damage",
          "currentBid": 850000,
          "reservePrice": 800000,
          "endTime": "2024-02-20T18:00:00Z",
          "watchingCount": 15,
          "caseDetails": {
            "assetType": "vehicle",
            "make": "Toyota",
            "model": "Camry",
            "year": 2020,
            "damageSeverity": "moderate"
          }
        },
        "timestamp": "2024-02-15T10:30:00Z"
      }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

**Caching**: 15-minute TTL in Redis

**Real-time Updates**: Emits `recommendation:new` Socket.IO event for new matching auctions

---

## Interaction Tracking

### POST /api/intelligence/interactions

Record vendor interaction events (views, bids, wins).

**Authentication**: Required (Vendor or System)

**Request Body**:
```json
{
  "vendorId": "uuid",
  "auctionId": "uuid",
  "eventType": "view",
  "sessionId": "session-uuid",
  "metadata": {
    "deviceType": "mobile",
    "predictionShown": true,
    "predictionValue": 1250000
  }
}
```

**Event Types**:
- `view`: Vendor viewed auction
- `bid`: Vendor placed bid
- `win`: Vendor won auction

**Response**:
```json
{
  "success": true,
  "data": {
    "interactionId": "uuid",
    "recorded": true
  }
}
```

**Side Effects**:
- Updates vendor bidding patterns materialized view (async)
- Updates vendor profile cache
- Triggers recommendation recalculation if needed

---

## Analytics Endpoints

### GET /api/intelligence/analytics/asset-performance

Get asset performance metrics by type, make, model.

**Authentication**: Required (Admin)

**Query Parameters**:
- `assetType` (optional): Filter by asset type
- `make` (optional): Filter by make
- `model` (optional): Filter by model
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "assetType": "vehicle",
      "make": "Toyota",
      "model": "Camry",
      "avgFinalPrice": 1250000,
      "avgBidCount": 8.5,
      "avgTimeToSell": 4.2,
      "sellThroughRate": 0.85,
      "demandScore": 78,
      "totalAuctions": 45,
      "period": "2024-02"
    }
  ]
}
```

### GET /api/intelligence/analytics/attribute-performance

Get performance metrics for specific attributes (color, trim, storage).

**Authentication**: Required (Admin)

**Query Parameters**:
- `attributeType`: "color" | "trim" | "storage"
- `assetType` (optional): Filter by asset type
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "attributeType": "color",
      "attributeValue": "black",
      "assetType": "vehicle",
      "avgPricePremium": 50000,
      "demandScore": 82,
      "totalAuctions": 120,
      "avgTimeToSell": 3.8
    }
  ]
}
```

### GET /api/intelligence/analytics/temporal-patterns

Get bidding patterns by hour, day, month.

**Authentication**: Required (Admin)

**Query Parameters**:
- `granularity`: "hourly" | "daily" | "monthly"
- `assetType` (optional): Filter by asset type

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "hour": 14,
      "dayOfWeek": 3,
      "avgBidCount": 12.5,
      "avgFinalPrice": 1350000,
      "peakActivityScore": 85,
      "totalAuctions": 78
    }
  ]
}
```

### GET /api/intelligence/analytics/geographic-patterns

Get regional pricing and demand patterns.

**Authentication**: Required (Admin)

**Query Parameters**:
- `region` (optional): Filter by region
- `assetType` (optional): Filter by asset type

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "region": "Lagos",
      "avgFinalPrice": 1450000,
      "priceVariance": 0.15,
      "demandScore": 88,
      "totalAuctions": 234,
      "topAssetTypes": ["vehicle", "electronics"]
    }
  ]
}
```

### GET /api/intelligence/analytics/vendor-segments

Get vendor segmentation data.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "segment": "Premium Buyers",
      "vendorCount": 45,
      "avgBidAmount": 2500000,
      "avgWinRate": 0.35,
      "characteristics": {
        "preferredAssetTypes": ["vehicle"],
        "avgSessionDuration": 1200,
        "returnRate": 0.78
      }
    }
  ]
}
```

### GET /api/intelligence/analytics/session-metrics

Get vendor session analytics.

**Authentication**: Required (Admin)

**Query Parameters**:
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```json
{
  "success": true,
  "data": {
    "avgSessionDuration": 850,
    "avgPagesPerSession": 8.5,
    "bounceRate": 0.12,
    "returnRate": 0.68,
    "conversionRate": 0.15
  }
}
```

### GET /api/intelligence/analytics/conversion-funnel

Get conversion funnel metrics.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "success": true,
  "data": {
    "stages": [
      {
        "stage": "view",
        "count": 10000,
        "conversionRate": 1.0
      },
      {
        "stage": "watch",
        "count": 3500,
        "conversionRate": 0.35
      },
      {
        "stage": "bid",
        "count": 1500,
        "conversionRate": 0.15
      },
      {
        "stage": "win",
        "count": 450,
        "conversionRate": 0.045
      }
    ]
  }
}
```

### GET /api/intelligence/analytics/rollups

Get pre-aggregated analytics data.

**Authentication**: Required (Admin)

**Query Parameters**:
- `granularity`: "hourly" | "daily" | "weekly" | "monthly"
- `metric`: "predictions" | "recommendations" | "interactions"
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "period": "2024-02-15",
      "metric": "predictions",
      "count": 1250,
      "avgAccuracy": 0.88,
      "avgConfidence": 0.75
    }
  ]
}
```

### GET /api/intelligence/analytics/export

Export analytics data to Excel.

**Authentication**: Required (Admin)

**Query Parameters**:
- `startDate`: ISO date string
- `endDate`: ISO date string
- `includeAssets` (optional): boolean
- `includeVendors` (optional): boolean
- `includeTemporal` (optional): boolean

**Response**: Excel file download

---

## ML Training Endpoints

### POST /api/intelligence/ml/export-dataset

Export ML training dataset.

**Authentication**: Required (Admin)

**Request Body**:
```json
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
```

**Dataset Types**:
- `predictions`: Price prediction training data
- `recommendations`: Recommendation training data
- `fraud`: Fraud detection training data

**Formats**:
- `csv`: Comma-separated values
- `json`: JSON format
- `parquet`: Apache Parquet (columnar)

**Response**:
```json
{
  "success": true,
  "data": {
    "datasetId": "uuid",
    "downloadUrl": "/api/intelligence/ml/datasets/uuid/download",
    "recordCount": 15000,
    "features": 45,
    "splits": {
      "train": 10500,
      "validation": 2250,
      "test": 2250
    },
    "expiresAt": "2024-02-16T10:30:00Z"
  }
}
```

### GET /api/intelligence/ml/datasets

List available ML datasets.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "datasetType": "predictions",
      "format": "csv",
      "recordCount": 15000,
      "createdAt": "2024-02-15T10:30:00Z",
      "expiresAt": "2024-02-16T10:30:00Z",
      "downloadUrl": "/api/intelligence/ml/datasets/uuid/download"
    }
  ]
}
```

---

## Admin Endpoints

### GET /api/intelligence/admin/dashboard

Get admin intelligence dashboard metrics.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "success": true,
  "data": {
    "predictions": {
      "total": 15000,
      "avgAccuracy": 0.88,
      "avgConfidence": 0.75,
      "accuracyTrend": [
        { "date": "2024-02-01", "accuracy": 0.85 },
        { "date": "2024-02-15", "accuracy": 0.88 }
      ]
    },
    "recommendations": {
      "total": 45000,
      "clickThroughRate": 0.25,
      "bidConversionRate": 0.18,
      "avgMatchScore": 72
    },
    "fraudAlerts": {
      "pending": 5,
      "confirmed": 12,
      "dismissed": 8,
      "highRisk": 2
    },
    "systemHealth": {
      "avgResponseTime": 145,
      "cacheHitRate": 0.85,
      "errorRate": 0.002
    }
  }
}
```

### POST /api/intelligence/admin/config

Update algorithm configuration.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "configKey": "prediction.similarity_threshold",
  "configValue": 65,
  "description": "Minimum similarity score for historical matching"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "configId": "uuid",
    "version": 2,
    "updatedBy": "admin-uuid",
    "updatedAt": "2024-02-15T10:30:00Z"
  }
}
```

### GET /api/intelligence/admin/inspect/[predictionId]

Inspect detailed prediction calculation.

**Authentication**: Required (Admin)

**Parameters**:
- `predictionId` (path): Prediction UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "predictionId": "uuid",
    "auctionId": "uuid",
    "calculation": {
      "similarAuctions": [
        {
          "auctionId": "uuid",
          "finalPrice": 1200000,
          "similarityScore": 85,
          "timeWeight": 0.95,
          "combinedWeight": 0.8075
        }
      ],
      "weightedAverage": 1250000,
      "marketAdjustments": {
        "competition": 1.05,
        "trend": 1.0,
        "seasonal": 1.0
      },
      "confidenceFactors": {
        "sampleSize": 0.8,
        "recency": 0.9,
        "variance": 0.85
      }
    }
  }
}
```

### POST /api/intelligence/admin/schema/validate

Validate pending schema changes.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "changeId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "impact": {
      "tablesAffected": ["asset_performance_analytics"],
      "estimatedMigrationTime": 120
    }
  }
}
```

### GET /api/intelligence/admin/schema/pending

Get pending schema evolution changes.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "changeType": "new_asset_type",
      "details": {
        "assetType": "machinery",
        "detectedAt": "2024-02-15T10:30:00Z"
      },
      "status": "pending",
      "impact": "medium"
    }
  ]
}
```

### GET /api/intelligence/admin/accuracy-trend

Get prediction accuracy trend over time.

**Authentication**: Required (Admin)

**Query Parameters**:
- `days` (optional): Number of days (default: 30)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-02-15",
      "avgAccuracy": 0.88,
      "avgConfidence": 0.75,
      "predictionCount": 450
    }
  ]
}
```

### GET /api/intelligence/admin/match-score-distribution

Get recommendation match score distribution.

**Authentication**: Required (Admin)

**Response**:
```json
{
  "success": true,
  "data": {
    "distribution": [
      { "range": "0-20", "count": 50 },
      { "range": "21-40", "count": 150 },
      { "range": "41-60", "count": 300 },
      { "range": "61-80", "count": 450 },
      { "range": "81-100", "count": 200 }
    ]
  }
}
```

---

## Fraud Detection

### POST /api/intelligence/fraud/analyze

Analyze entity for fraud patterns.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "entityType": "vendor",
  "entityId": "uuid"
}
```

**Entity Types**:
- `vendor`: Analyze vendor behavior
- `case`: Analyze salvage case
- `auction`: Analyze auction patterns
- `user`: Analyze user account

**Response**:
```json
{
  "success": true,
  "data": {
    "entityType": "vendor",
    "entityId": "uuid",
    "riskScore": 75,
    "riskLevel": "high",
    "flagReasons": [
      {
        "type": "shill_bidding",
        "severity": "high",
        "evidence": "Consecutive bids on 5 auctions from same adjuster",
        "confidence": 0.85
      },
      {
        "type": "bid_timing_pattern",
        "severity": "medium",
        "evidence": "80% of bids placed in last 5 minutes",
        "confidence": 0.72
      }
    ],
    "recommendations": [
      "Review vendor-adjuster relationship",
      "Monitor future bidding patterns",
      "Consider temporary suspension"
    ],
    "analyzedAt": "2024-02-15T10:30:00Z"
  }
}
```

### GET /api/intelligence/fraud/alerts/[id]/review

Get fraud alert details for review.

**Authentication**: Required (Admin)

**Parameters**:
- `id` (path): Fraud alert UUID

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "entityType": "vendor",
    "entityId": "uuid",
    "riskScore": 75,
    "flagReasons": [...],
    "status": "pending",
    "createdAt": "2024-02-15T10:30:00Z",
    "evidence": {
      "photoHashes": [...],
      "biddingPatterns": [...],
      "collusion": [...]
    }
  }
}
```

### POST /api/intelligence/fraud/alerts/[id]/review

Submit fraud alert review decision.

**Authentication**: Required (Admin)

**Parameters**:
- `id` (path): Fraud alert UUID

**Request Body**:
```json
{
  "decision": "confirmed",
  "notes": "Evidence of shill bidding confirmed",
  "action": "suspend_vendor"
}
```

**Decisions**:
- `confirmed`: Fraud confirmed
- `dismissed`: False positive
- `pending`: Needs more investigation

**Response**:
```json
{
  "success": true,
  "data": {
    "alertId": "uuid",
    "status": "confirmed",
    "reviewedBy": "admin-uuid",
    "reviewedAt": "2024-02-15T10:30:00Z"
  }
}
```

---

## Privacy & Export

### GET /api/intelligence/privacy/export

Export all intelligence data for a vendor (GDPR compliance).

**Authentication**: Required (Vendor - must match session, or Admin)

**Response**: JSON file download containing:
- All predictions viewed
- All recommendations received
- All interactions recorded
- Algorithm configuration used

### POST /api/intelligence/privacy/opt-out

Opt out of personalized recommendations.

**Authentication**: Required (Vendor)

**Request Body**:
```json
{
  "optOut": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "vendorId": "uuid",
    "optedOut": true,
    "updatedAt": "2024-02-15T10:30:00Z"
  }
}
```

**Effect**: Vendor will see popularity-based recommendations instead of personalized ones.

### GET /api/intelligence/export

Export intelligence data for analysis.

**Authentication**: Required (Admin)

**Query Parameters**:
- `dataType`: "predictions" | "recommendations" | "interactions" | "all"
- `format`: "csv" | "json"
- `startDate`: ISO date string
- `endDate`: ISO date string
- `anonymize` (optional): boolean (default: true)

**Response**: File download in requested format

### GET /api/intelligence/logs/export

Export intelligence system logs.

**Authentication**: Required (Admin)

**Query Parameters**:
- `startDate`: ISO date string
- `endDate`: ISO date string
- `logType` (optional): "prediction" | "recommendation" | "fraud"

**Response**: JSON file download

### POST /api/intelligence/logs/search

Search intelligence logs.

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "query": "high_risk_fraud",
  "startDate": "2024-02-01",
  "endDate": "2024-02-15",
  "limit": 100
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "logType": "fraud_detection",
        "message": "High risk fraud alert generated",
        "metadata": {...},
        "timestamp": "2024-02-15T10:30:00Z"
      }
    ],
    "total": 45,
    "limit": 100
  }
}
```

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

- **Prediction endpoints**: 100 requests per minute per vendor
- **Recommendation endpoints**: 50 requests per minute per vendor
- **Analytics endpoints**: 200 requests per minute per admin
- **Fraud detection**: 20 requests per minute per admin
- **Export endpoints**: 10 requests per hour per admin

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708000000
```

---

## WebSocket Events (Socket.IO)

The intelligence system emits real-time events via Socket.IO:

### prediction:updated

Emitted when a prediction changes significantly (>10% price change).

**Room**: `vendor:{vendorId}`

**Payload**:
```json
{
  "auctionId": "uuid",
  "prediction": {
    "predictedPrice": 1300000,
    "lowerBound": 1200000,
    "upperBound": 1400000,
    "confidenceScore": 80
  }
}
```

### recommendation:new

Emitted when a new auction matches vendor preferences.

**Room**: `vendor:{vendorId}`

**Payload**:
```json
{
  "recommendationId": "uuid",
  "auctionId": "uuid",
  "matchScore": 85,
  "reasonCodes": ["preferred_make_model"]
}
```

### recommendation:closing_soon

Emitted 1 hour before recommended auction closes.

**Room**: `vendor:{vendorId}`

**Payload**:
```json
{
  "auctionId": "uuid",
  "closingIn": 3600,
  "currentBid": 850000
}
```

### fraud:alert

Emitted when high-risk fraud detected (admin only).

**Room**: `admin`

**Payload**:
```json
{
  "alertId": "uuid",
  "entityType": "vendor",
  "riskScore": 85,
  "flagReasons": [...]
}
```

### schema:new_asset_type

Emitted when new asset type detected (admin only).

**Room**: `admin`

**Payload**:
```json
{
  "assetType": "machinery",
  "detectedAt": "2024-02-15T10:30:00Z"
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

**Common Error Codes**:
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request parameters
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

## Best Practices

1. **Caching**: Leverage client-side caching for predictions (5 min) and recommendations (15 min)
2. **Pagination**: Use `limit` and `offset` for large result sets
3. **Real-time**: Subscribe to Socket.IO events for live updates instead of polling
4. **Error Handling**: Implement exponential backoff for retries
5. **Rate Limits**: Monitor rate limit headers and throttle requests accordingly
6. **Security**: Never expose JWT tokens in logs or client-side code

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Get prediction
const response = await fetch(`/api/auctions/${auctionId}/prediction`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { data } = await response.json();

// Get recommendations
const recommendations = await fetch(`/api/vendors/${vendorId}/recommendations?limit=20`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Track interaction
await fetch('/api/intelligence/interactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    vendorId,
    auctionId,
    eventType: 'view',
    sessionId
  })
});

// Subscribe to real-time updates
import { io } from 'socket.io-client';

const socket = io();
socket.emit('join', `vendor:${vendorId}`);
socket.on('prediction:updated', (data) => {
  console.log('Prediction updated:', data);
});
```

---

## Changelog

### v1.2.0 (2024-02-15)
- Added geographic analytics endpoint
- Added vendor segmentation endpoint
- Improved fraud detection accuracy
- Added ML dataset export in Parquet format

### v1.1.0 (2024-01-15)
- Added real-time Socket.IO events
- Added admin dashboard endpoint
- Added fraud alert review workflow
- Improved prediction confidence calculation

### v1.0.0 (2024-01-01)
- Initial release
- Prediction and recommendation endpoints
- Basic analytics
- GDPR compliance features
