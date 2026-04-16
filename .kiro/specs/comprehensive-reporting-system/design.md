# Comprehensive Enterprise Reporting System - Design

## Design Overview

This document outlines the technical architecture and implementation design for transforming the basic reporting system into a comprehensive enterprise-grade business intelligence platform.

## Architecture Principles

### 1. Layered Architecture
```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (UI Components, Pages, Export)         │
├─────────────────────────────────────────┤
│         API Layer                       │
│  (REST Endpoints, Authentication)       │
├─────────────────────────────────────────┤
│         Service Layer                   │
│  (Business Logic, Report Generation)    │
├─────────────────────────────────────────┤
│         Data Access Layer               │
│  (Repositories, Query Builders)         │
├─────────────────────────────────────────┤
│         Database Layer                  │
│  (PostgreSQL, Existing Schema)          │
└─────────────────────────────────────────┘
```

### 2. Existing Infrastructure Integration

**MANDATORY FIRST STEP**: Audit existing reporting infrastructure before building anything new.

**Known Existing Components to Leverage**:
- Existing report pages in salvage manager dashboard
- Database schema (cases, auctions, payments, vendors, users)
- Authentication/authorization system
- PDF generation capabilities
- Gemini 2.5 Flash integration (for AI narratives)
- Chart/visualization libraries
- Export utilities

**Gap Analysis Required**:
- What report types already exist?
- What services can be extended vs rebuilt?
- What UI components can be reused?
- What APIs already provide report data?

## System Components

### 1. Report Engine Core

#### 1.1 Report Service (Extend or Create)
```typescript
// Check if exists: src/features/reports/ or src/services/reports/
// If exists, extend. If not, create new.

interface ReportService {
  generateReport(config: ReportConfig): Promise<ReportResult>;
  scheduleReport(schedule: ReportSchedule): Promise<void>;
  exportReport(reportId: string, format: ExportFormat): Promise<Buffer>;
}
```

#### 1.2 Data Aggregation Service
```typescript
// Handles complex queries and data aggregation
interface DataAggregationService {
  aggregateFinancialMetrics(filters: ReportFilters): Promise<FinancialMetrics>;
  aggregateOperationalMetrics(filters: ReportFilters): Promise<OperationalMetrics>;
  aggregateUserPerformance(filters: ReportFilters): Promise<UserPerformanceMetrics>;
  aggregateVendorAnalytics(filters: ReportFilters): Promise<VendorAnalytics>;
}
```

#### 1.3 Query Builder Service
```typescript
// Builds optimized SQL queries for reports
interface QueryBuilderService {
  buildFinancialQuery(filters: ReportFilters): SQL;
  buildOperationalQuery(filters: ReportFilters): SQL;
  buildUserPerformanceQuery(filters: ReportFilters): SQL;
  optimizeQuery(query: SQL): SQL;
}
```

### 2. Report Types Implementation

#### 2.1 Financial Reports Module
```
src/features/reports/financial/
├── services/
│   ├── revenue-analysis.service.ts
│   ├── payment-analytics.service.ts
│   ├── vendor-spending.service.ts
│   └── profitability.service.ts
├── repositories/
│   └── financial-data.repository.ts
└── types/
    └── financial-reports.types.ts
```

#### 2.2 Operational Reports Module
```
src/features/reports/operational/
├── services/
│   ├── case-processing.service.ts
│   ├── auction-performance.service.ts
│   ├── document-management.service.ts
│   └── vendor-performance.service.ts
├── repositories/
│   └── operational-data.repository.ts
└── types/
    └── operational-reports.types.ts
```

#### 2.3 User Performance Reports Module
```
src/features/reports/user-performance/
├── services/
│   ├── adjuster-metrics.service.ts
│   ├── finance-metrics.service.ts
│   ├── manager-metrics.service.ts
│   └── admin-metrics.service.ts
├── repositories/
│   └── user-performance.repository.ts
└── types/
    └── user-performance.types.ts
```

#### 2.4 Compliance & Audit Module
```
src/features/reports/compliance/
├── services/
│   ├── regulatory-compliance.service.ts
│   ├── audit-trail.service.ts
│   └── document-compliance.service.ts
├── repositories/
│   └── compliance-data.repository.ts
└── types/
    └── compliance-reports.types.ts
```

### 3. Export System

#### 3.1 PDF Export Service
```typescript
// Check existing PDF generation first
// Likely exists for documents - extend it

interface PDFExportService {
  generatePDF(report: Report, options: PDFOptions): Promise<Buffer>;
  addBranding(pdf: PDFDocument): PDFDocument;
  addCharts(pdf: PDFDocument, charts: Chart[]): PDFDocument;
  addTableOfContents(pdf: PDFDocument): PDFDocument;
}

interface PDFOptions {
  includeLogo: boolean;
  includeLetterhead: boolean;
  includeFooter: boolean;
  pageNumbers: boolean;
  tableOfContents: boolean;
}
```

#### 3.2 Excel Export Service
```typescript
interface ExcelExportService {
  generateWorkbook(report: Report): Promise<Buffer>;
  addBranding(workbook: Workbook): Workbook;
  addCharts(workbook: Workbook, charts: Chart[]): Workbook;
  formatHeaders(workbook: Workbook): Workbook;
}
```

#### 3.3 CSV Export Service
```typescript
interface CSVExportService {
  generateCSV(data: ReportData): Promise<string>;
  addHeaders(csv: string): string;
  formatData(data: any[]): string;
}
```

### 4. AI Magazine Report Generator

#### 4.1 AI Narrative Service
```typescript
// Leverages existing Gemini integration
// Check: src/lib/integrations/gemini-*

interface AIReportNarrativeService {
  generateMagazineReport(data: ReportData): Promise<MagazineReport>;
  generateExecutiveSummary(data: ReportData): Promise<string>;
  generateSectionNarrative(section: ReportSection, data: any): Promise<string>;
  generateRecommendations(data: ReportData): Promise<string[]>;
  generateInsights(data: ReportData): Promise<Insight[]>;
}

interface MagazineReport {
  coverPage: {
    headline: string;
    subheadline: string;
    keyHighlights: string[];
  };
  featureStory: {
    title: string;
    content: string;
    pullQuotes: string[];
  };
  sections: MagazineSection[];
  closingNotes: {
    summary: string;
    recommendations: string[];
    outlook: string;
  };
}
```

#### 4.2 Magazine Layout Service
```typescript
interface MagazineLayoutService {
  createMagazineLayout(report: MagazineReport, charts: Chart[]): PDFDocument;
  addCoverPage(pdf: PDFDocument, cover: CoverPage): PDFDocument;
  addFeatureStory(pdf: PDFDocument, story: FeatureStory): PDFDocument;
  addSection(pdf: PDFDocument, section: MagazineSection): PDFDocument;
  addChartWithCaption(pdf: PDFDocument, chart: Chart, caption: string): PDFDocument;
}
```

### 5. Visualization System

#### 5.1 Chart Generation Service
```typescript
// Check existing chart libraries (likely Chart.js or Recharts)

interface ChartGenerationService {
  generateLineChart(data: TimeSeriesData, options: ChartOptions): Chart;
  generateBarChart(data: CategoryData, options: ChartOptions): Chart;
  generatePieChart(data: DistributionData, options: ChartOptions): Chart;
  generateHeatmap(data: MatrixData, options: ChartOptions): Chart;
  generateScatterPlot(data: CorrelationData, options: ChartOptions): Chart;
  exportChartAsImage(chart: Chart): Promise<Buffer>;
}
```

#### 5.2 Dashboard Layout Service
```typescript
interface DashboardLayoutService {
  createDashboard(widgets: Widget[]): Dashboard;
  arrangeWidgets(widgets: Widget[], layout: LayoutConfig): Dashboard;
  optimizeForMobile(dashboard: Dashboard): Dashboard;
}
```

### 6. Scheduling & Automation

#### 6.1 Report Scheduler Service
```typescript
interface ReportSchedulerService {
  scheduleReport(config: ScheduleConfig): Promise<ScheduledReport>;
  cancelSchedule(scheduleId: string): Promise<void>;
  executeScheduledReport(scheduleId: string): Promise<void>;
  getScheduledReports(userId: string): Promise<ScheduledReport[]>;
}

interface ScheduleConfig {
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  filters: ReportFilters;
  format: ExportFormat;
}
```

#### 6.2 Report Distribution Service
```typescript
interface ReportDistributionService {
  distributeReport(report: Report, recipients: string[]): Promise<void>;
  sendEmail(recipients: string[], report: Buffer, format: string): Promise<void>;
  archiveReport(report: Report): Promise<void>;
}
```

### 7. Caching & Performance

#### 7.1 Report Cache Service
```typescript
interface ReportCacheService {
  cacheReport(reportId: string, data: ReportData, ttl: number): Promise<void>;
  getCachedReport(reportId: string): Promise<ReportData | null>;
  invalidateCache(reportId: string): Promise<void>;
  invalidateUserCache(userId: string): Promise<void>;
}
```

#### 7.2 Query Optimization Service
```typescript
interface QueryOptimizationService {
  optimizeQuery(query: SQL): SQL;
  addIndexHints(query: SQL): SQL;
  analyzeQueryPerformance(query: SQL): Promise<QueryAnalysis>;
  suggestIndexes(query: SQL): Promise<IndexSuggestion[]>;
}
```

## API Design

### REST Endpoints Structure

```
/api/reports/
├── financial/
│   ├── revenue-analysis
│   ├── payment-analytics
│   ├── vendor-spending
│   └── profitability
├── operational/
│   ├── case-processing
│   ├── auction-performance
│   ├── document-management
│   └── vendor-performance
├── user-performance/
│   ├── adjusters
│   ├── finance
│   ├── managers
│   └── admins
├── compliance/
│   ├── regulatory
│   ├── audit-trail
│   └── document-compliance
├── executive/
│   ├── kpi-dashboard
│   └── strategic-insights
├── master/
│   ├── comprehensive
│   └── role-specific
├── ai-magazine/
│   └── generate
├── export/
│   ├── pdf
│   ├── excel
│   ├── csv
│   └── json
└── schedule/
    ├── create
    ├── list
    ├── update
    └── delete
```

### API Endpoint Examples

#### Generate Financial Report
```typescript
POST /api/reports/financial/revenue-analysis
Authorization: Bearer <token>
Content-Type: application/json

{
  "filters": {
    "startDate": "2026-01-01",
    "endDate": "2026-03-31",
    "assetTypes": ["vehicle", "electronics"],
    "regions": ["Lagos", "Abuja"]
  },
  "groupBy": "month",
  "includeCharts": true
}

Response:
{
  "reportId": "rep_123",
  "data": {
    "totalRevenue": 15000000,
    "recoveryRate": 0.85,
    "trends": [...],
    "byAssetType": {...},
    "byRegion": {...}
  },
  "charts": [...],
  "generatedAt": "2026-04-14T10:30:00Z"
}
```

#### Generate AI Magazine Report
```typescript
POST /api/reports/ai-magazine/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "period": {
    "startDate": "2026-03-01",
    "endDate": "2026-03-31"
  },
  "includeFinancial": true,
  "includeOperational": true,
  "includeUserPerformance": true,
  "tone": "professional-optimistic",
  "audience": "executive"
}

Response:
{
  "reportId": "mag_456",
  "magazine": {
    "coverPage": {...},
    "featureStory": {...},
    "sections": [...],
    "closingNotes": {...}
  },
  "pdfUrl": "/api/reports/export/pdf/mag_456",
  "generatedAt": "2026-04-14T10:35:00Z"
}
```

#### Export Report
```typescript
GET /api/reports/export/pdf/:reportId
Authorization: Bearer <token>

Response:
Content-Type: application/pdf
Content-Disposition: attachment; filename="report-2026-03.pdf"
<PDF Binary Data>
```

#### Schedule Report
```typescript
POST /api/reports/schedule/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "reportType": "financial/revenue-analysis",
  "frequency": "monthly",
  "dayOfMonth": 1,
  "time": "08:00",
  "recipients": ["cfo@neminsurance.com", "manager@neminsurance.com"],
  "filters": {...},
  "format": "pdf"
}

Response:
{
  "scheduleId": "sch_789",
  "nextRun": "2026-05-01T08:00:00Z",
  "status": "active"
}
```

## Database Design

### New Tables (If Needed)

#### report_templates
```sql
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### scheduled_reports
```sql
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_type VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  schedule_config JSONB NOT NULL,
  recipients JSONB NOT NULL,
  filters JSONB,
  format VARCHAR(20) NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### report_cache
```sql
CREATE TABLE IF NOT EXISTS report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key VARCHAR(255) UNIQUE NOT NULL,
  report_data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_cache_key ON report_cache(report_key);
CREATE INDEX idx_report_cache_expires ON report_cache(expires_at);
```

#### report_audit_log
```sql
CREATE TABLE IF NOT EXISTS report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  report_type VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  filters JSONB,
  export_format VARCHAR(20),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_audit_user ON report_audit_log(user_id);
CREATE INDEX idx_report_audit_created ON report_audit_log(created_at);
```

### Indexes for Performance

```sql
-- Optimize financial queries
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount);

-- Optimize case queries
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON salvage_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_status ON salvage_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_adjuster ON salvage_cases(adjuster_id);

-- Optimize auction queries
CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON auctions(created_at);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_winner ON auctions(winner_id);

-- Optimize vendor queries
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
```

## UI/UX Design

### Page Structure

```
/dashboard/reports/
├── index (Reports Hub)
├── financial/
│   ├── revenue-analysis
│   ├── payment-analytics
│   ├── vendor-spending
│   └── profitability
├── operational/
│   ├── case-processing
│   ├── auction-performance
│   ├── document-management
│   └── vendor-performance
├── user-performance/
│   ├── my-performance (for all users)
│   ├── team-performance (for managers)
│   └── all-users (for admins)
├── compliance/
│   ├── regulatory
│   ├── audit-trail
│   └── document-compliance
├── executive/
│   ├── kpi-dashboard
│   └── strategic-insights
├── master/
│   ├── comprehensive
│   └── role-specific
├── ai-magazine/
│   └── generate
└── scheduled/
    └── manage
```

### Component Structure

```
src/components/reports/
├── common/
│   ├── report-filters.tsx
│   ├── date-range-picker.tsx
│   ├── export-button.tsx
│   ├── schedule-button.tsx
│   └── report-header.tsx
├── charts/
│   ├── line-chart.tsx
│   ├── bar-chart.tsx
│   ├── pie-chart.tsx
│   ├── heatmap.tsx
│   └── chart-wrapper.tsx
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
│   ├── adjuster-metrics-report.tsx
│   ├── finance-metrics-report.tsx
│   ├── manager-metrics-report.tsx
│   └── performance-comparison.tsx
├── compliance/
│   ├── regulatory-compliance-report.tsx
│   ├── audit-trail-report.tsx
│   └── document-compliance-report.tsx
├── executive/
│   ├── kpi-dashboard.tsx
│   ├── strategic-insights.tsx
│   └── executive-summary.tsx
├── master/
│   ├── comprehensive-report.tsx
│   └── role-specific-report.tsx
└── ai-magazine/
    ├── magazine-generator.tsx
    ├── magazine-preview.tsx
    └── magazine-section.tsx
```

### Reports Hub Design

```typescript
// Main reports landing page
interface ReportsHubProps {
  userRole: UserRole;
  availableReports: ReportCategory[];
}

// Shows:
// - Quick access to favorite reports
// - Recently generated reports
// - Scheduled reports
// - Report categories
// - Search functionality
```

## Security & Authorization

### Role-Based Access Control

```typescript
interface ReportPermissions {
  canViewFinancial: boolean;
  canViewOperational: boolean;
  canViewUserPerformance: boolean;
  canViewCompliance: boolean;
  canViewExecutive: boolean;
  canViewAllUsers: boolean;
  canScheduleReports: boolean;
  canExportReports: boolean;
  canViewAuditLogs: boolean;
}

const rolePermissions: Record<UserRole, ReportPermissions> = {
  admin: {
    canViewFinancial: true,
    canViewOperational: true,
    canViewUserPerformance: true,
    canViewCompliance: true,
    canViewExecutive: true,
    canViewAllUsers: true,
    canScheduleReports: true,
    canExportReports: true,
    canViewAuditLogs: true,
  },
  salvage_manager: {
    canViewFinancial: true,
    canViewOperational: true,
    canViewUserPerformance: true,
    canViewCompliance: true,
    canViewExecutive: true,
    canViewAllUsers: true,
    canScheduleReports: true,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  finance_officer: {
    canViewFinancial: true,
    canViewOperational: false,
    canViewUserPerformance: false,
    canViewCompliance: true,
    canViewExecutive: false,
    canViewAllUsers: false,
    canScheduleReports: true,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  claims_adjuster: {
    canViewFinancial: false,
    canViewOperational: false,
    canViewUserPerformance: true, // Own only
    canViewCompliance: false,
    canViewExecutive: false,
    canViewAllUsers: false,
    canScheduleReports: false,
    canExportReports: true,
    canViewAuditLogs: false,
  },
  vendor: {
    canViewFinancial: false,
    canViewOperational: false,
    canViewUserPerformance: true, // Own only
    canViewCompliance: false,
    canViewExecutive: false,
    canViewAllUsers: false,
    canScheduleReports: false,
    canExportReports: true,
    canViewAuditLogs: false,
  },
};
```

### Data Filtering by Role

```typescript
interface DataAccessControl {
  filterByRole(data: any[], userRole: UserRole, userId: string): any[];
  canAccessUserData(requestingUserId: string, targetUserId: string, role: UserRole): boolean;
  canAccessVendorData(requestingUserId: string, targetVendorId: string, role: UserRole): boolean;
}
```

## Performance Optimization

### Caching Strategy

1. **Report Data Caching**
   - Cache frequently accessed reports for 5-15 minutes
   - Invalidate on data changes
   - Use Redis for distributed caching

2. **Query Result Caching**
   - Cache expensive aggregation queries
   - Use database query cache
   - Implement smart cache invalidation

3. **Chart Image Caching**
   - Cache generated chart images
   - Reuse for PDF exports
   - Store in CDN for web display

### Query Optimization

1. **Use Materialized Views** (if needed)
   ```sql
   CREATE MATERIALIZED VIEW mv_monthly_revenue AS
   SELECT 
     DATE_TRUNC('month', created_at) as month,
     SUM(amount) as total_revenue,
     COUNT(*) as transaction_count
   FROM payments
   WHERE status = 'completed'
   GROUP BY DATE_TRUNC('month', created_at);
   
   CREATE INDEX idx_mv_monthly_revenue_month ON mv_monthly_revenue(month);
   ```

2. **Optimize Joins**
   - Use appropriate join types
   - Add indexes on join columns
   - Limit result sets early

3. **Pagination**
   - Implement cursor-based pagination for large datasets
   - Limit default page sizes
   - Provide total count efficiently

## Testing Strategy

### Unit Tests
- Test each service independently
- Mock database calls
- Test calculation logic
- Test data transformations

### Integration Tests
- Test API endpoints
- Test database queries
- Test report generation flow
- Test export functionality

### Performance Tests
- Load test report generation
- Test with large datasets
- Measure query performance
- Test concurrent users

### E2E Tests
- Test complete report workflows
- Test role-based access
- Test export formats
- Test scheduled reports

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. Audit existing reporting infrastructure
2. Set up base services and repositories
3. Implement core report engine
4. Create database tables/indexes

### Phase 2: Financial Reports (Week 3-4)
1. Implement financial report services
2. Create financial report APIs
3. Build financial report UI components
4. Add export functionality

### Phase 3: Operational Reports (Week 5-6)
1. Implement operational report services
2. Create operational report APIs
3. Build operational report UI components
4. Add visualization components

### Phase 4: User Performance (Week 7-8)
1. Implement user performance services
2. Create user performance APIs
3. Build user performance UI
4. Add role-based filtering

### Phase 5: Advanced Features (Week 9-10)
1. Implement AI magazine reports
2. Add scheduling system
3. Implement caching
4. Add compliance reports

### Phase 6: Polish & Optimization (Week 11-12)
1. Performance optimization
2. UI/UX refinements
3. Comprehensive testing
4. Documentation

## Monitoring & Observability

### Metrics to Track
- Report generation time
- API response times
- Cache hit rates
- Export success rates
- Scheduled report execution
- User engagement with reports

### Logging
- Log all report generation requests
- Log export operations
- Log scheduled report execution
- Log errors and failures
- Log performance metrics

### Alerts
- Alert on slow report generation
- Alert on failed scheduled reports
- Alert on high error rates
- Alert on cache failures

## Documentation Requirements

### Technical Documentation
- API documentation (OpenAPI/Swagger)
- Service documentation
- Database schema documentation
- Deployment guide

### User Documentation
- User guide for each report type
- How to schedule reports
- How to export reports
- How to interpret metrics

### Developer Documentation
- Architecture overview
- Code organization
- Testing guide
- Contribution guidelines

---

**Document Version**: 1.0  
**Created**: 2026-04-14  
**Status**: Draft  
**Next Step**: Create tasks.md
