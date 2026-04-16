# Comprehensive Reporting System - API Documentation

**Version**: 1.0  
**Base URL**: `https://api.neminsurance.com`  
**Date**: 2026-04-14

---

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [Common Patterns](#common-patterns)
4. [Financial Reports APIs](#financial-reports-apis)
5. [Operational Reports APIs](#operational-reports-apis)
6. [User Performance APIs](#user-performance-apis)
7. [Compliance Reports APIs](#compliance-reports-apis)
8. [Executive Dashboard APIs](#executive-dashboard-apis)
9. [Report Scheduling APIs](#report-scheduling-apis)
10. [Error Handling](#error-handling)

---

## Authentication

All API endpoints require authentication via JWT token.

### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Getting a Token
```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@neminsurance.com",
  "password": "password"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@neminsurance.com",
    "role": "salvage_manager"
  }
}
```

---

## Authorization

Access to reports is controlled by user role:

| Role | Financial | Operational | User Perf | Compliance | Executive |
|------|-----------|-------------|-----------|------------|-----------|
| System Admin | ✅ | ✅ | ✅ (All) | ✅ | ✅ |
| Salvage Manager | ✅ | ✅ | ✅ (All) | ✅ | ✅ |
| Finance Officer | ✅ | ❌ | ❌ | ✅ | ❌ |
| Claims Adjuster | ❌ | ❌ | ✅ (Own) | ❌ | ❌ |
| Vendor | ❌ | ❌ | ✅ (Own) | ❌ | ❌ |

---

## Common Patterns

### Query Parameters
All report endpoints support these common parameters:

```typescript
{
  startDate: string;      // ISO date (required)
  endDate: string;        // ISO date (required)
  assetTypes?: string;    // Comma-separated
  regions?: string;       // Comma-separated
  groupBy?: string;       // 'day' | 'week' | 'month'
  sortBy?: string;        // Field name
  sortOrder?: string;     // 'asc' | 'desc'
}
```

### Response Format
All successful responses follow this format:

```json
{
  "status": "success",
  "data": { /* report data */ },
  "metadata": {
    "generatedAt": "2026-04-14T10:30:00Z",
    "generatedBy": "user-123",
    "filters": { /* applied filters */ },
    "recordCount": 150,
    "executionTimeMs": 2340,
    "cached": false
  }
}
```

### Error Format
All error responses follow this format:

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2026-04-14T10:30:00Z"
  }
}
```

---

## Financial Reports APIs

### 1. Revenue Analysis

**Endpoint**: `GET /api/reports/financial/revenue-analysis`

**Authorization**: Finance Officer, Salvage Manager, System Admin

**Query Parameters**:
```typescript
{
  startDate: string;      // Required
  endDate: string;        // Required
  assetTypes?: string;    // Optional: "vehicle,electronics"
  regions?: string;       // Optional: "Lagos,Abuja"
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalRevenue": 15000000,
    "recoveryRate": 85.5,
    "trends": [
      {
        "date": "2026-01-01",
        "revenue": 5000000,
        "recoveryRate": 84.2
      }
    ],
    "byAssetType": {
      "vehicle": {
        "revenue": 12000000,
        "count": 45,
        "avgRecoveryRate": 86.3
      },
      "electronics": {
        "revenue": 3000000,
        "count": 120,
        "avgRecoveryRate": 82.1
      }
    },
    "byRegion": {
      "Lagos": {
        "revenue": 10000000,
        "count": 100
      },
      "Abuja": {
        "revenue": 5000000,
        "count": 65
      }
    }
  },
  "metadata": { /* ... */ }
}
```

**Example Request**:
```bash
curl -X GET \
  'https://api.neminsurance.com/api/reports/financial/revenue-analysis?startDate=2026-01-01&endDate=2026-03-31&assetTypes=vehicle' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

---

### 2. Payment Analytics

**Endpoint**: `GET /api/reports/financial/payment-analytics`

**Authorization**: Finance Officer, Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalPayments": 165,
    "totalAmount": 15000000,
    "avgProcessingTime": 2.5,
    "autoVerificationRate": 78.5,
    "paymentMethods": {
      "bank_transfer": {
        "count": 100,
        "amount": 10000000,
        "avgTime": 2.1
      },
      "paystack": {
        "count": 65,
        "amount": 5000000,
        "avgTime": 0.5
      }
    },
    "aging": {
      "current": 120,
      "overdue_1_7": 30,
      "overdue_8_30": 10,
      "overdue_30_plus": 5
    }
  },
  "metadata": { /* ... */ }
}
```

---

### 3. Vendor Spending

**Endpoint**: `GET /api/reports/financial/vendor-spending`

**Authorization**: Finance Officer, Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalSpending": 15000000,
    "totalVendors": 45,
    "avgSpendingPerVendor": 333333,
    "topSpenders": [
      {
        "vendorId": "vendor-123",
        "businessName": "ABC Motors",
        "totalSpent": 2500000,
        "transactionCount": 15,
        "avgTransactionValue": 166667,
        "lifetimeValue": 3000000
      }
    ],
    "spendingByAssetType": {
      "vehicle": 12000000,
      "electronics": 3000000
    },
    "trends": [
      {
        "month": "2026-01",
        "spending": 5000000,
        "vendors": 30
      }
    ]
  },
  "metadata": { /* ... */ }
}
```

---

### 4. Profitability

**Endpoint**: `GET /api/reports/financial/profitability`

**Authorization**: Finance Officer, Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "grossProfit": 5000000,
    "netProfit": 4000000,
    "profitMargin": 26.7,
    "roi": 35.5,
    "byAssetType": {
      "vehicle": {
        "grossProfit": 4000000,
        "netProfit": 3200000,
        "margin": 28.5
      }
    },
    "costBreakdown": {
      "operational": 500000,
      "administrative": 300000,
      "marketing": 200000
    },
    "trends": [
      {
        "month": "2026-01",
        "grossProfit": 1500000,
        "netProfit": 1200000
      }
    ]
  },
  "metadata": { /* ... */ }
}
```

---

## Operational Reports APIs

### 5. Case Processing

**Endpoint**: `GET /api/reports/operational/case-processing`

**Authorization**: Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalCases": 165,
    "avgProcessingTime": 3.5,
    "approvalRate": 85.5,
    "byStatus": {
      "pending": 20,
      "approved": 120,
      "rejected": 15,
      "in_auction": 10
    },
    "byAssetType": {
      "vehicle": 100,
      "electronics": 65
    },
    "bottlenecks": [
      {
        "stage": "assessment",
        "avgTime": 2.5,
        "cases": 45
      }
    ],
    "trends": [
      {
        "date": "2026-01-01",
        "cases": 50,
        "avgTime": 3.2
      }
    ]
  },
  "metadata": { /* ... */ }
}
```

---

### 6. Auction Performance

**Endpoint**: `GET /api/reports/operational/auction-performance`

**Authorization**: Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalAuctions": 120,
    "successRate": 92.5,
    "avgBidsPerAuction": 5.5,
    "bidToWinConversion": 18.2,
    "avgDuration": 48,
    "reservePriceHitRate": 85.0,
    "byAssetType": {
      "vehicle": {
        "auctions": 75,
        "successRate": 94.7,
        "avgBids": 6.2
      }
    },
    "competitiveBidding": {
      "high": 45,
      "medium": 60,
      "low": 15
    }
  },
  "metadata": { /* ... */ }
}
```

---

### 7. Vendor Performance

**Endpoint**: `GET /api/reports/operational/vendor-performance`

**Authorization**: Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalVendors": 45,
    "activeVendors": 38,
    "rankings": [
      {
        "rank": 1,
        "vendorId": "vendor-123",
        "businessName": "ABC Motors",
        "totalBids": 50,
        "totalWins": 15,
        "winRate": 30.0,
        "avgPaymentTime": 2.5,
        "onTimePickupRate": 95.0,
        "rating": 4.8
      }
    ],
    "byTier": {
      "gold": 10,
      "silver": 20,
      "bronze": 15
    },
    "engagement": {
      "high": 15,
      "medium": 20,
      "low": 10
    }
  },
  "metadata": { /* ... */ }
}
```

---

## User Performance APIs

### 8. Adjuster Metrics

**Endpoint**: `GET /api/reports/user-performance/adjusters`

**Authorization**: Salvage Manager, System Admin, Claims Adjuster (own data)

**Query Parameters**:
```typescript
{
  startDate: string;
  endDate: string;
  userId?: string;  // Optional, admins/managers can specify
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "adjusters": [
      {
        "userId": "adj-123",
        "name": "John Doe",
        "casesProcessed": 45,
        "avgProcessingTime": 3.2,
        "approvalRate": 88.9,
        "rejectionRate": 11.1,
        "assessmentAccuracy": 92.5,
        "recoveryRate": 86.3,
        "qualityScore": 4.5,
        "revenueContribution": {
          "direct": 5000000,
          "indirect": 2000000
        }
      }
    ],
    "teamAverage": {
      "casesProcessed": 38,
      "avgProcessingTime": 3.5,
      "approvalRate": 85.0
    }
  },
  "metadata": { /* ... */ }
}
```

---

### 9. Finance Officer Metrics

**Endpoint**: `GET /api/reports/user-performance/finance`

**Authorization**: Salvage Manager, System Admin, Finance Officer (own data)

**Response**:
```json
{
  "status": "success",
  "data": {
    "officers": [
      {
        "userId": "fin-123",
        "name": "Jane Smith",
        "paymentsProcessed": 120,
        "avgVerificationTime": 2.1,
        "autoVerificationRate": 82.5,
        "paymentAccuracy": 98.5,
        "disputeResolutionTime": 1.5,
        "reconciliationMetrics": {
          "completed": 45,
          "pending": 5
        },
        "auditCompliance": 100.0,
        "revenueImpact": 15000000
      }
    ]
  },
  "metadata": { /* ... */ }
}
```

---

### 10. Manager Metrics

**Endpoint**: `GET /api/reports/user-performance/managers`

**Authorization**: System Admin, Salvage Manager (own data)

**Response**:
```json
{
  "status": "success",
  "data": {
    "managers": [
      {
        "userId": "mgr-123",
        "name": "Bob Johnson",
        "teamSize": 10,
        "teamProductivity": 92.5,
        "revenueGenerated": 50000000,
        "operationalEfficiency": 88.5,
        "vendorRelationships": {
          "active": 45,
          "satisfaction": 4.5
        },
        "strategicImpact": {
          "processImprovements": 5,
          "costSavings": 2000000
        }
      }
    ]
  },
  "metadata": { /* ... */ }
}
```

---

## Compliance Reports APIs

### 11. Regulatory Compliance

**Endpoint**: `GET /api/reports/compliance/regulatory`

**Authorization**: Finance Officer, Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "complianceScore": 95.5,
    "checklist": [
      {
        "requirement": "KYC Verification",
        "status": "compliant",
        "lastCheck": "2026-04-14"
      }
    ],
    "filingDeadlines": [
      {
        "filing": "Quarterly Report",
        "deadline": "2026-04-30",
        "status": "pending"
      }
    ],
    "violations": [],
    "remediation": []
  },
  "metadata": { /* ... */ }
}
```

---

### 12. Audit Trail

**Endpoint**: `GET /api/reports/compliance/audit-trail`

**Authorization**: System Admin only

**Query Parameters**:
```typescript
{
  startDate: string;
  endDate: string;
  userId?: string;
  action?: string;
  reportType?: string;
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "totalEvents": 1250,
    "events": [
      {
        "id": "audit-123",
        "userId": "user-123",
        "userName": "John Doe",
        "action": "generate",
        "reportType": "revenue-analysis",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "timestamp": "2026-04-14T10:30:00Z",
        "success": true
      }
    ]
  },
  "metadata": { /* ... */ }
}
```

---

## Executive Dashboard APIs

### 13. KPI Dashboard

**Endpoint**: `GET /api/reports/executive/kpi-dashboard`

**Authorization**: Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "data": {
    "kpis": {
      "totalRevenue": {
        "value": 15000000,
        "trend": "up",
        "change": 12.5
      },
      "recoveryRate": {
        "value": 85.5,
        "trend": "up",
        "change": 2.3
      },
      "activeCases": {
        "value": 165,
        "trend": "down",
        "change": -5.2
      },
      "vendorSatisfaction": {
        "value": 4.5,
        "trend": "stable",
        "change": 0.1
      }
    },
    "alerts": [
      {
        "type": "warning",
        "message": "Payment aging increasing",
        "severity": "medium"
      }
    ],
    "predictions": {
      "nextMonthRevenue": 16500000,
      "confidence": 85.0
    }
  },
  "metadata": { /* ... */ }
}
```

---

## Report Scheduling APIs

### 14. Create Schedule

**Endpoint**: `POST /api/reports/schedule`

**Authorization**: Finance Officer, Salvage Manager, System Admin

**Request Body**:
```json
{
  "reportType": "revenue-analysis",
  "frequency": "monthly",
  "scheduleConfig": {
    "dayOfMonth": 1,
    "time": "08:00",
    "timezone": "Africa/Lagos"
  },
  "recipients": [
    "cfo@neminsurance.com",
    "manager@neminsurance.com"
  ],
  "filters": {
    "assetTypes": ["vehicle"]
  },
  "format": "pdf"
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "scheduleId": "sch-123",
    "nextRun": "2026-05-01T08:00:00Z",
    "status": "active"
  }
}
```

---

### 15. List Schedules

**Endpoint**: `GET /api/reports/schedule`

**Authorization**: All authenticated users

**Response**:
```json
{
  "status": "success",
  "data": {
    "schedules": [
      {
        "id": "sch-123",
        "reportType": "revenue-analysis",
        "frequency": "monthly",
        "nextRun": "2026-05-01T08:00:00Z",
        "status": "active",
        "createdAt": "2026-04-01T10:00:00Z"
      }
    ]
  }
}
```

---

### 16. Update Schedule

**Endpoint**: `PUT /api/reports/schedule/:id`

**Authorization**: Schedule owner, Salvage Manager, System Admin

**Request Body**: Same as Create Schedule

---

### 17. Delete Schedule

**Endpoint**: `DELETE /api/reports/schedule/:id`

**Authorization**: Schedule owner, Salvage Manager, System Admin

**Response**:
```json
{
  "status": "success",
  "message": "Schedule deleted successfully"
}
```

---

## Error Handling

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Example Error Response

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access financial reports",
    "timestamp": "2026-04-14T10:30:00Z"
  }
}
```

---

## Rate Limiting

- **Standard Users**: 60 requests per minute
- **Premium Users**: 120 requests per minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Versioning

Current API version: `v1`

Future versions will be accessible via:
- URL: `/api/v2/reports/...`
- Header: `Accept: application/vnd.neminsurance.v2+json`

---

## Support

For API support, contact:
- **Email**: api-support@neminsurance.com
- **Documentation**: https://docs.neminsurance.com
- **Status Page**: https://status.neminsurance.com

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-14  
**Maintained By**: API Team
