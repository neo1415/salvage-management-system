# Comprehensive Reporting System - Technical Architecture

**Version**: 1.0  
**Date**: 2026-04-14  
**Status**: Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Integration Points](#integration-points)
7. [Security Architecture](#security-architecture)
8. [Performance & Scalability](#performance--scalability)
9. [Deployment Architecture](#deployment-architecture)

---

## System Overview

The Comprehensive Reporting System is an enterprise-grade business intelligence platform that provides role-specific reports, user performance metrics, financial analytics, operational KPIs, and compliance tracking across the NEM Insurance salvage operations platform.

### Key Features
- 27 API endpoints across 8 report categories
- Role-based access control for 5 user roles
- Real-time and historical reporting
- Multiple export formats (PDF, Excel, CSV, JSON)
- Automated report scheduling and distribution
- Comprehensive audit logging
- Advanced caching for performance
- Mobile-responsive UI

---

## Architecture Principles

### 1. Layered Architecture
```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (React Components, Next.js Pages)      │
├─────────────────────────────────────────┤
│         API Layer                       │
│  (Next.js API Routes, REST)             │
├─────────────────────────────────────────┤
│         Service Layer                   │
│  (Business Logic, Report Generation)    │
├─────────────────────────────────────────┤
│         Data Access Layer               │
│  (Repositories, Drizzle ORM)            │
├─────────────────────────────────────────┤
│         Database Layer                  │
│  (PostgreSQL)                           │
└─────────────────────────────────────────┘
```

### 2. Separation of Concerns
- **Presentation**: UI components, user interactions
- **API**: Request handling, validation, authorization
- **Service**: Business logic, calculations, aggregations
- **Repository**: Data access, query building
- **Database**: Data storage, persistence

### 3. Single Responsibility
- Each service handles one report category
- Each repository handles one data domain
- Each component renders one UI concern

### 4. Dependency Injection
- Services receive dependencies via constructor
- Testable and mockable
- Loose coupling

---

## Component Architecture

### Service Layer

#### Core Services
```typescript
// Base report service
ReportService
├── hasPermission()
├── filterDataByRole()
├── generateReport()
├── validateDateRange()
└── calculatePercentage()

// Caching service
ReportCacheService
├── cacheReport()
├── getCachedReport()
├── invalidateCache()
└── invalidateUserCache()

// Audit service
ReportAuditService
├── logReportGeneration()
├── logReportExport()
├── logReportSchedule()
└── getAuditLogs()
```

#### Financial Services
```typescript
RevenueAnalysisService
├── generateReport()
├── calculateTotalRevenue()
├── calculateRecoveryRate()
└── analyzeTrends()

PaymentAnalyticsService
├── generateReport()
├── analyzeProcessingTimes()
├── calculateAutoVerificationRate()
└── trackPaymentAging()

VendorSpendingService
├── generateReport()
├── identifyTopSpenders()
├── analyzeSpendingPatterns()
└── calculateLifetimeValue()

ProfitabilityService
├── generateReport()
├── calculateGrossProfit()
├── calculateNetProfit()
└── analyzeROI()
```

#### Operational Services
```typescript
CaseProcessingService
├── generateReport()
├── calculateProcessingTimes()
├── analyzeApprovalRates()
└── identifyBottlenecks()

AuctionPerformanceService
├── generateReport()
├── calculateSuccessRates()
├── analyzeBiddingPatterns()
└── optimizeAuctionTiming()

VendorPerformanceService
├── generateReport()
├── calculateVendorRankings()
├── analyzeWinRates()
└── trackCompliance()
```

#### User Performance Services
```typescript
AdjusterMetricsService
├── generateReport()
├── trackCasesProcessed()
├── calculateQualityScores()
└── analyzeRevenueContribution()

FinanceMetricsService
├── generateReport()
├── trackPaymentsProcessed()
├── calculateVerificationRates()
└── measureRevenueImpact()

ManagerMetricsService
├── generateReport()
├── trackTeamProductivity()
├── measureOperationalEfficiency()
└── assessStrategicImpact()
```

### Repository Layer

```typescript
FinancialDataRepository
├── getRevenueData()
├── getPaymentData()
├── getVendorSpendingData()
└── getProfitabilityData()

OperationalDataRepository
├── getCaseProcessingData()
├── getAuctionPerformanceData()
├── getDocumentManagementData()
└── getVendorPerformanceData()

UserPerformanceRepository
├── getAdjusterMetrics()
├── getFinanceMetrics()
├── getManagerMetrics()
└── getAdminMetrics()

ComplianceDataRepository
├── getRegulatoryComplianceData()
├── getAuditTrailData()
└── getDocumentComplianceData()
```

### API Layer

```
/api/reports/
├── financial/
│   ├── revenue-analysis/route.ts
│   ├── payment-analytics/route.ts
│   ├── vendor-spending/route.ts
│   └── profitability/route.ts
├── operational/
│   ├── case-processing/route.ts
│   ├── auction-performance/route.ts
│   ├── document-management/route.ts
│   └── vendor-performance/route.ts
├── user-performance/
│   ├── adjusters/route.ts
│   ├── finance/route.ts
│   ├── managers/route.ts
│   └── admins/route.ts
├── compliance/
│   ├── regulatory/route.ts
│   ├── audit-trail/route.ts
│   └── document-compliance/route.ts
├── executive/
│   ├── kpi-dashboard/route.ts
│   └── strategic-insights/route.ts
├── master/
│   ├── comprehensive/route.ts
│   └── role-specific/route.ts
└── schedule/
    ├── route.ts (GET, POST)
    └── [id]/route.ts (GET, PUT, DELETE)
```

### Presentation Layer

```
src/components/reports/
├── common/
│   ├── report-filters.tsx
│   ├── export-button.tsx
│   ├── report-header.tsx
│   └── date-range-picker.tsx
├── financial/
│   ├── revenue-analysis-report.tsx
│   ├── payment-analytics-report.tsx
│   ├── vendor-spending-report.tsx
│   └── profitability-report.tsx
├── operational/
│   ├── case-processing-report.tsx
│   ├── auction-performance-report.tsx
│   ├── document-management-report.tsx
│   └── vendor-performance-report.tsx
├── user-performance/
│   ├── my-performance-report.tsx
│   ├── adjuster-metrics-report.tsx
│   ├── finance-metrics-report.tsx
│   └── manager-metrics-report.tsx
├── compliance/
│   ├── regulatory-compliance-report.tsx
│   ├── audit-trail-report.tsx
│   └── document-compliance-report.tsx
└── executive/
    ├── kpi-dashboard.tsx
    ├── strategic-insights.tsx
    └── master-report.tsx
```

---

## Data Flow

### Report Generation Flow

```
User Request
    ↓
[UI Component]
    ↓
[API Route]
    ├→ Authentication Check (401 if fails)
    ├→ Authorization Check (403 if fails)
    ├→ Input Validation (400 if fails)
    ↓
[Report Service]
    ├→ Check Cache (return if hit)
    ├→ Call Domain Service
    ↓
[Domain Service]
    ├→ Call Repository
    ↓
[Repository]
    ├→ Build Query
    ├→ Execute Query
    ├→ Transform Data
    ↓
[Domain Service]
    ├→ Calculate Metrics
    ├→ Aggregate Data
    ├→ Format Response
    ↓
[Report Service]
    ├→ Cache Result
    ├→ Log Audit Entry
    ↓
[API Route]
    ├→ Format Response
    ↓
[UI Component]
    ├→ Render Data
    ├→ Display Charts
    ↓
User sees report
```

### Export Flow

```
User clicks Export
    ↓
[Export Button Component]
    ↓
[Export API]
    ├→ Authentication
    ├→ Authorization
    ├→ Get Report Data
    ↓
[Export Service]
    ├→ Generate PDF/Excel/CSV
    ├→ Add Branding
    ├→ Add Charts
    ↓
[API Response]
    ├→ Return File Buffer
    ↓
[Browser]
    ├→ Download File
    ↓
User has exported report
```

### Scheduled Report Flow

```
Cron Job Triggers
    ↓
[Schedule Executor]
    ├→ Get Active Schedules
    ├→ Check if due
    ↓
[Report Generator]
    ├→ Generate Report
    ├→ Export to Format
    ↓
[Distribution Service]
    ├→ Send Email
    ├→ Archive Report
    ├→ Log Execution
    ↓
Recipients receive report
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **Charts**: Chart.js / Recharts
- **State Management**: React Hooks
- **Forms**: React Hook Form
- **Validation**: Zod

### Backend
- **Runtime**: Node.js 20
- **Framework**: Next.js API Routes
- **Language**: TypeScript 5
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL 15
- **Cache**: Redis
- **Authentication**: NextAuth.js
- **Email**: Nodemailer

### Infrastructure
- **Hosting**: Vercel / AWS
- **Database**: PostgreSQL (managed)
- **Cache**: Redis (managed)
- **Storage**: S3 (for exports)
- **CDN**: Cloudflare
- **Monitoring**: Sentry / DataDog

### Development
- **Package Manager**: npm
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Vitest, Playwright
- **CI/CD**: GitHub Actions

---

## Integration Points

### Internal Systems
```typescript
// Database
PostgreSQL
├── salvage_cases
├── auctions
├── bids
├── payments
├── vendors
├── users
├── documents
├── wallet_transactions
└── deposit_events

// Authentication
NextAuth.js
├── Session management
├── JWT tokens
└── Role-based access

// Notification System
Email Service
├── Report delivery
├── Schedule notifications
└── Alert emails

// Document System
PDF Generator
├── Report exports
└── Branded documents
```

### External Systems (Future)
- Business Intelligence tools (Tableau, Power BI)
- Data warehouses (Snowflake, BigQuery)
- Third-party analytics (Google Analytics)
- Regulatory reporting systems

---

## Security Architecture

### Authentication Flow
```
User Login
    ↓
[NextAuth.js]
    ├→ Validate Credentials
    ├→ Generate JWT
    ├→ Create Session
    ↓
User Authenticated
```

### Authorization Flow
```
API Request
    ↓
[Auth Middleware]
    ├→ Verify JWT
    ├→ Load User Session
    ↓
[Authorization Check]
    ├→ Check Role Permissions
    ├→ Check Report Access
    ├→ Filter Data by Role
    ↓
Authorized Request
```

### Data Protection
- **In Transit**: HTTPS/TLS 1.3
- **At Rest**: PostgreSQL encryption
- **Cache**: Redis encryption
- **Exports**: Encrypted storage

### Audit Logging
```typescript
Every Request
    ↓
[Audit Service]
    ├→ Log User ID
    ├→ Log Action
    ├→ Log IP Address
    ├→ Log User Agent
    ├→ Log Timestamp
    ├→ Log Success/Failure
    ↓
Audit Trail Complete
```

---

## Performance & Scalability

### Caching Strategy

#### Report Data Cache
```typescript
// Cache key format
`report:${reportType}:${hash(filters)}`

// TTL by report type
- Standard reports: 15 minutes
- Complex reports: 5 minutes
- Real-time reports: 1 minute

// Cache invalidation
- On data changes
- Manual invalidation
- TTL expiration
```

#### Query Result Cache
```typescript
// Database query cache
- Frequently accessed queries
- Aggregation results
- Lookup tables

// Cache warming
- Pre-cache common reports
- Background refresh
```

### Database Optimization

#### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_cases_created_at ON salvage_cases(created_at);
CREATE INDEX idx_cases_status ON salvage_cases(status);
CREATE INDEX idx_auctions_created_at ON auctions(created_at);
CREATE INDEX idx_auctions_status ON auctions(status);
```

#### Connection Pooling
```typescript
// PostgreSQL connection pool
{
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### Scalability Considerations

#### Horizontal Scaling
- Stateless API design
- Load balancer ready
- Session in Redis (shared)
- Database read replicas

#### Vertical Scaling
- Optimized queries
- Efficient algorithms
- Memory management
- CPU optimization

#### Performance Targets
- Standard reports: <5 seconds
- Complex reports: <30 seconds
- API response: <2 seconds
- Cache hit rate: >70%
- Concurrent users: 50+

---

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────┐
│           Load Balancer                 │
│         (Cloudflare CDN)                │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼────┐                 ┌───▼────┐
│ App    │                 │ App    │
│ Server │                 │ Server │
│ (Next) │                 │ (Next) │
└───┬────┘                 └───┬────┘
    │                           │
    └─────────────┬─────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼────────┐          ┌──────▼─────┐
│ PostgreSQL │          │   Redis    │
│  (Primary) │          │   Cache    │
└────────────┘          └────────────┘
```

### Staging Environment
- Mirror of production
- Separate database
- Separate cache
- Test data

### Development Environment
- Local PostgreSQL
- Local Redis
- Hot reload
- Debug mode

---

## Monitoring & Observability

### Metrics
- Report generation time
- API response time
- Cache hit rate
- Database query time
- Error rate
- User activity

### Logging
- Application logs
- Error logs
- Audit logs
- Performance logs

### Alerts
- Slow report generation
- High error rate
- Cache failures
- Database issues
- Scheduled report failures

---

## Conclusion

The Comprehensive Reporting System is built on a solid architectural foundation with clear separation of concerns, robust security, excellent performance, and enterprise-grade scalability.

**Key Strengths**:
- Layered architecture
- Role-based security
- Comprehensive caching
- Audit logging
- Scalable design
- Production-ready

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-14  
**Maintained By**: Engineering Team
