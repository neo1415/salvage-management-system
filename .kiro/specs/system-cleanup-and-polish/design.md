# Design Document: System Cleanup and Polish

## Overview

This design addresses 23 identified issues across the salvage management system, focusing on data integrity bugs, UI/UX improvements, export functionality, pagination, and PDF standardization. The approach prioritizes surgical fixes that resolve specific issues without introducing regressions.

### Design Philosophy

1. **Minimal Invasiveness**: Each fix targets only the affected component/service
2. **Reusability**: Create shared utilities for common patterns (export, pagination, PDF generation)
3. **Consistency**: Standardize implementations across similar features
4. **Safety**: Thorough testing and validation before deployment

### Scope

- **Data/Logic Bugs**: 6 requirements (auction status, redirects, fraud alerts, reports, currency, notifications)
- **UI/UX Fixes**: 5 requirements (search, filters, auction cards, notification alignment, button removal)
- **Export Functionality**: 6 requirements (payments, cases, wallet, bids, logs)
- **Pagination**: 3 requirements (wallet transactions, system logs, users)
- **Standardization**: 2 requirements (PDF letterhead/footer, test user cleanup)
- **Parser/Serializer**: 1 requirement (CSV round-trip validation)

## Architecture

### High-Level Component Organization

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (Dashboard Pages, UI Components, Filters, Search)          │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auction      │  │ Export       │  │ PDF          │     │
│  │ Status       │  │ Service      │  │ Generator    │     │
│  │ Service      │  └──────────────┘  └──────────────┘     │
│  └──────────────┘                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Search/      │  │ Pagination   │  │ Leaderboard  │     │
│  │ Filter       │  │ Service      │  │ Service      │     │
│  │ Service      │  └──────────────┘  └──────────────┘     │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│                     Data Layer                               │
│  (Database Queries, Cache Management, Audit Logging)        │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Auction Status Management**: Use existing cron job (`/api/cron/auction-closure`) but add real-time status checks in UI components
2. **Export Service**: Create reusable `ExportService` class with CSV and PDF generation methods
3. **PDF Standardization**: Extract letterhead/footer functions into shared utilities
4. **Search/Filter**: Enhance existing `FacetedFilter` and `SearchInput` components with proper backend integration
5. **Pagination**: Create reusable `PaginationService` utility for consistent pagination logic

## Components and Interfaces

### 1. Auction Status Service Enhancement

**File**: `src/features/auctions/services/status.service.ts` (NEW)

```typescript
export class AuctionStatusService {
  /**
   * Get real-time auction status
   * Checks if auction has expired and returns correct status
   */
  static getAuctionStatus(auction: {
    status: string;
    endTime: Date;
  }): 'active' | 'extended' | 'closed' | 'cancelled' | 'forfeited' {
    // If auction is already closed/cancelled/forfeited, return as-is
    if (['closed', 'cancelled', 'forfeited'].includes(auction.status)) {
      return auction.status as any;
    }
    
    // Check if auction has expired
    const now = new Date();
    if (auction.endTime < now && (auction.status === 'active' || auction.status === 'extended')) {
      return 'closed'; // Expired but not yet processed by cron
    }
    
    return auction.status as any;
  }
  
  /**
   * Check if auction is truly active (not expired)
   */
  static isAuctionActive(auction: { status: string; endTime: Date }): boolean {
    const status = this.getAuctionStatus(auction);
    return status === 'active' || status === 'extended';
  }
}
```

**Integration Points**:
- Case card components: Use `AuctionStatusService.getAuctionStatus()` before displaying status
- Auction list pages: Filter by real-time status
- Dashboard stats: Count only truly active auctions

### 2. Export Service

**File**: `src/features/export/services/export.service.ts` (NEW)

```typescript
export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename: string;
  columns: ExportColumn[];
  data: any[];
  title?: string; // For PDF
}

export class ExportService {
  /**
   * Generate CSV export
   * Implements RFC 4180 standard with proper escaping
   */
  static generateCSV(options: ExportOptions): string {
    const { columns, data } = options;
    
    // Header row
    const headers = columns.map(col => this.escapeCSVField(col.header));
    const rows = [headers.join(',')];
    
    // Data rows
    for (const item of data) {
      const row = columns.map(col => {
        const value = item[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? '');
        return this.escapeCSVField(formatted);
      });
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }
  
  /**
   * Escape CSV field according to RFC 4180
   */
  private static escapeCSVField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
  
  /**
   * Generate PDF export with standardized letterhead/footer
   */
  static async generatePDF(options: ExportOptions): Promise<Buffer> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Add letterhead
    await PDFTemplateService.addLetterhead(doc, options.title || 'Export');
    
    // Add table data
    let y = 60; // Start below letterhead
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxY = pageHeight - 35; // Reserve space for footer
    
    // Add headers
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    let x = 20;
    for (const col of options.columns) {
      doc.text(col.header, x, y);
      x += 40; // Column spacing
    }
    
    y += 7;
    doc.setFont('helvetica', 'normal');
    
    // Add data rows
    for (const item of options.data) {
      if (y > maxY) {
        // Add footer to current page
        PDFTemplateService.addFooter(doc);
        // Start new page
        doc.addPage();
        await PDFTemplateService.addLetterhead(doc, options.title || 'Export');
        y = 60;
      }
      
      x = 20;
      for (const col of options.columns) {
        const value = item[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? '');
        doc.text(formatted.substring(0, 30), x, y); // Truncate long values
        x += 40;
      }
      y += 7;
    }
    
    // Add footer to last page
    PDFTemplateService.addFooter(doc);
    
    return Buffer.from(doc.output('arraybuffer'));
  }
}
```

### 3. PDF Template Service

**File**: `src/features/documents/services/pdf-template.service.ts` (NEW)

Extract letterhead and footer functions from `pdf-generation.service.ts` into reusable utilities:

```typescript
export class PDFTemplateService {
  /**
   * Add standardized NEM Insurance letterhead
   * Same format as Bill of Sale
   */
  static async addLetterhead(doc: jsPDF, title: string): Promise<void> {
    // Implementation extracted from existing pdf-generation.service.ts
    // Burgundy header bar, logo, company name, title
  }
  
  /**
   * Add standardized footer
   * Same format as Bill of Sale
   */
  static addFooter(doc: jsPDF, additionalInfo?: string): void {
    // Implementation extracted from existing pdf-generation.service.ts
    // Company info, contact details, generation timestamp
  }
  
  /**
   * Get maximum Y position for content to avoid footer overlap
   */
  static getMaxContentY(doc: jsPDF): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    return pageHeight - 35; // Reserve 35px for footer
  }
}
```

### 4. Search and Filter Service

**File**: `src/features/search/services/search-filter.service.ts` (NEW)

```typescript
export class SearchFilterService {
  /**
   * Perform case-insensitive partial matching search
   * Searches across multiple fields
   */
  static buildSearchCondition(
    searchQuery: string,
    fields: string[]
  ): SQL {
    if (!searchQuery) return sql`true`;
    
    const query = searchQuery.toLowerCase();
    const conditions = fields.map(field => 
      sql`LOWER(${sql.raw(field)}) LIKE ${`%${query}%`}`
    );
    
    // OR logic: match any field
    return sql`(${sql.join(conditions, sql` OR `)})`;
  }
  
  /**
   * Build multi-select filter condition (OR logic within category)
   * Example: assetType IN ('vehicle', 'electronics')
   */
  static buildMultiSelectFilter(
    column: any,
    selectedValues: string[]
  ): SQL | undefined {
    if (selectedValues.length === 0) return undefined;
    
    return sql`${column} IN (${sql.join(
      selectedValues.map(v => sql`${v}`),
      sql`, `
    )})`;
  }
}
```

### 5. Pagination Service

**File**: `src/lib/utils/pagination.service.ts` (NEW)

```typescript
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class PaginationService {
  /**
   * Calculate pagination metadata
   */
  static getPaginationMeta(
    page: number,
    limit: number,
    total: number
  ) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
  
  /**
   * Get offset for database query
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }
  
  /**
   * Validate and sanitize pagination parameters
   */
  static validateParams(
    page: string | null,
    limit: string | null,
    maxLimit: number = 100
  ): PaginationOptions {
    const pageNum = Math.max(1, parseInt(page || '1'));
    const limitNum = Math.min(
      maxLimit,
      Math.max(1, parseInt(limit || '20'))
    );
    
    return { page: pageNum, limit: limitNum };
  }
}
```

## Data Models

### Export Metadata

```typescript
interface ExportMetadata {
  generatedBy: string; // User ID
  generatedAt: Date;
  exportType: 'csv' | 'pdf';
  recordCount: number;
  filters?: Record<string, any>; // Applied filters
}
```

### Pagination State (Frontend)

```typescript
interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}
```

### Search Filter State (Frontend)

```typescript
interface SearchFilterState {
  searchQuery: string;
  selectedCategories: string[]; // Multi-select with OR logic
  selectedStatuses: string[];
  locationQuery: string;
  priceRange?: { min: number; max: number };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Auction Status Real-Time Determination

*For any* auction with an endTime in the past and status of "active" or "extended", the `AuctionStatusService.getAuctionStatus()` function should return "closed" regardless of the database status value.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Case List Ordering After Creation

*For any* newly created case, when querying the My Cases list ordered by creation date descending, the new case should appear as the first item in the results.

**Validates: Requirements 2.4**

### Property 3: Fraud Alert Count Consistency

*For any* admin dashboard load, the fraud alert count displayed should equal the number of fraud alert records returned when clicking through to the fraud alerts detail page.

**Validates: Requirements 3.1, 3.3**

### Property 4: Fraud Alert Filtering

*For any* fraud alert query, only alerts with status "pending" (not "dismissed" or "resolved") should be included in the count.

**Validates: Requirements 3.4**

### Property 5: Cache Invalidation on Fraud Alert Changes

*For any* fraud alert creation or dismissal action, the admin dashboard cache should be invalidated immediately, forcing a fresh query on the next dashboard load.

**Validates: Requirements 3.6**

### Property 6: Payment Aging Report Structure

*For any* Payment Aging report generation, the report should contain aging buckets (0-7 days, 8-14 days, 15-21 days, 22+ days) with columns for payment status, amount, due date, and days overdue.

**Validates: Requirements 4.2, 4.3**

### Property 7: Report Error Handling

*For any* report generation failure, the system should return a specific error message indicating which report type failed and the reason for failure.

**Validates: Requirements 4.6**

### Property 8: Currency Symbol Consistency

*For any* currency display in the finance dashboard, the formatted string should contain the Naira symbol (₦) and follow the format "₦X,XXX,XXX.XX".

**Validates: Requirements 5.1, 5.3**

### Property 9: Automatic Notification on Document Generation

*For any* auction closure with a winning bidder, when documents are generated, notifications should be automatically sent to the winner and logged in the audit trail.

**Validates: Requirements 6.2, 6.5**

### Property 10: Case-Insensitive Partial Search

*For any* search query string and target field, the search function should match records where the field contains the query string, ignoring case differences.

**Validates: Requirements 7.1**

### Property 11: Auction Search Field Coverage

*For any* auction search query, the search should check the assetDetails JSON fields (make, model, description) and return matches from any of these fields.

**Validates: Requirements 7.3**

### Property 12: Case Search Field Coverage

*For any* case search query, the search should check claimReference, assetType, and assetDetails fields and return matches from any of these fields.

**Validates: Requirements 7.3**

### Property 13: Vendor Search Field Coverage

*For any* vendor search query, the search should check company name, email, and phone number fields and return matches from any of these fields.

**Validates: Requirements 7.4**

### Property 14: User Search Field Coverage

*For any* user search query, the search should check name, email, and role fields and return matches from any of these fields.

**Validates: Requirements 7.5**

### Property 15: Multi-Category Filter OR Logic

*For any* set of selected asset type filters (e.g., ["vehicle", "electronics"]), the filter should return auctions matching ANY of the selected types (OR logic), not requiring all types simultaneously.

**Validates: Requirements 8.1, 8.6**

### Property 16: Active Filter Count Display

*For any* filter state with N selected filters, the UI should display a count badge showing N active filters.

**Validates: Requirements 8.4**

### Property 17: Location Partial Matching

*For any* location filter query "Lagos", the results should include all locations containing "Lagos" as a substring (case-insensitive), such as "Lagos Island", "Lagos Mainland", etc.

**Validates: Requirements 9.1**

### Property 18: Location Autocomplete Suggestions

*For any* location input, the autocomplete should suggest only locations that exist in the database and match the input prefix.

**Validates: Requirements 9.3**

### Property 19: Combined Filter Application

*For any* combination of location filter and other filters (category, price, search), all filters should be applied with AND logic between different filter types.

**Validates: Requirements 9.4**

### Property 20: Asset Name Extraction for Vehicles

*For any* auction with assetType "vehicle" and assetDetails containing make, model, and year, the displayed asset name should be formatted as "{make} {model} {year}".

**Validates: Requirements 10.2**

### Property 21: Asset Name Extraction for Other Types

*For any* auction with assetType "electronics" or "property" and assetDetails containing an item name, the displayed asset name should be the specific item name from assetDetails.

**Validates: Requirements 10.3**

### Property 22: Asset Name Truncation

*For any* asset name longer than 50 characters, the displayed name should be truncated to 50 characters with an ellipsis ("...") appended.

**Validates: Requirements 10.5**

### Property 23: CSV Export Data Completeness

*For any* export request, the generated CSV should include all columns specified in the export configuration and all rows matching the current filters.

**Validates: Requirements 12.2, 12.4, 12.5, 13.2, 13.4, 13.5, 14.2, 14.4, 14.5, 15.2, 15.4, 15.6, 16.2, 16.4, 16.5, 17.2, 17.4, 17.5**

### Property 24: PDF Export Template Consistency

*For any* PDF export, the document should include the standardized NEM Insurance letterhead (logo, company name, contact info) and footer (company details, generation timestamp).

**Validates: Requirements 12.3, 13.3, 14.3, 15.3, 16.3, 17.3**

### Property 25: Export Filename Format

*For any* export download, the filename should follow the pattern "{export-type}-{date}.{format}" where date is in YYYY-MM-DD format.

**Validates: Requirements 12.7, 13.7, 14.7, 15.8, 16.7, 17.7**

### Property 26: Pagination Metadata Accuracy

*For any* paginated query with page P, limit L, and total count T, the pagination metadata should correctly calculate totalPages = ceil(T/L), hasNext = (P < totalPages), and hasPrev = (P > 1).

**Validates: Requirements 18.4, 19.4, 20.4**

### Property 27: Pagination Filter Preservation

*For any* pagination navigation (next/previous page), the current search query and filter selections should be preserved in the URL parameters and applied to the new page query.

**Validates: Requirements 18.5, 19.5, 20.5**

### Property 28: Pagination Button State

*For any* pagination state, the "Previous" button should be disabled when on page 1, and the "Next" button should be disabled when on the last page.

**Validates: Requirements 18.7, 18.8, 19.7, 19.8, 20.7, 20.8**

### Property 29: PDF Letterhead Consistency

*For any* PDF document generated by the system (exports, reports, or legal documents), the letterhead should use the same format with NEM burgundy header, logo, company name, and contact information.

**Validates: Requirements 21.1, 21.3**

### Property 30: PDF Footer Consistency

*For any* PDF document generated by the system, the footer should use the same format with company details, contact information, and generation timestamp.

**Validates: Requirements 21.2, 21.4**

### Property 31: PDF Export Metadata

*For any* PDF export, the document should include the document type/title below the letterhead and the generation timestamp with user ID in the footer.

**Validates: Requirements 21.6, 21.7**

### Property 32: Leaderboard Test User Exclusion by Email

*For any* leaderboard calculation, users with email addresses containing "test", "demo", or "uat" (case-insensitive) should be excluded from the rankings.

**Validates: Requirements 22.1**

### Property 33: Leaderboard Test User Exclusion by Name

*For any* leaderboard calculation, users with names containing "Test", "Demo", or "UAT" (case-insensitive) should be excluded from the rankings.

**Validates: Requirements 22.2**

### Property 34: Leaderboard Test User Exclusion by Pattern

*For any* leaderboard calculation, users with vendorId matching known test patterns (e.g., starting with "test-", "demo-", "uat-") should be excluded from the rankings.

**Validates: Requirements 22.3**

### Property 35: CSV RFC 4180 Compliance

*For any* CSV export, fields containing commas, quotes, or newlines should be wrapped in double quotes, and internal quotes should be escaped by doubling them ("").

**Validates: Requirements 23.1, 23.2**

### Property 36: CSV Header Row Presence

*For any* CSV export, the first row should contain column headers matching the configured column names.

**Validates: Requirements 23.3**

### Property 37: CSV UTF-8 Encoding

*For any* CSV export, the file should be encoded in UTF-8 to properly handle special characters including the Naira symbol (₦).

**Validates: Requirements 23.4**

### Property 38: CSV Round-Trip Preservation

*For any* CSV export, parsing the exported CSV file and re-exporting it should produce a file with equivalent data (round-trip property).

**Validates: Requirements 23.5**

### Property 39: CSV Parse Error Reporting

*For any* CSV parsing failure, the error message should include the line number where the error occurred and a description of the issue.

**Validates: Requirements 23.6**

### Property 40: Export Data Validation

*For any* export operation, the system should validate that all required fields are non-null and of the correct data type before generating the export file.

**Validates: Requirements 23.7**

## Error Handling

### Auction Status Service

**Error Scenarios**:
1. Auction record not found
2. Invalid auction status value
3. Null or invalid endTime

**Handling Strategy**:
- Return safe defaults (treat missing auctions as closed)
- Log warnings for data integrity issues
- Never throw exceptions in status determination (used in UI rendering)

### Export Service

**Error Scenarios**:
1. No data to export (empty result set)
2. Export size exceeds limits (>10,000 records)
3. PDF generation fails (missing logo, font issues)
4. CSV escaping fails (invalid characters)

**Handling Strategy**:
- Empty exports: Generate file with headers only, show warning message
- Size limits: Return error with message to apply filters
- PDF failures: Fall back to CSV export, log error for investigation
- CSV failures: Return 500 error with specific message

### Search and Filter Service

**Error Scenarios**:
1. Invalid search query (SQL injection attempts)
2. Invalid filter values
3. Database query timeout

**Handling Strategy**:
- Sanitize all inputs using parameterized queries
- Validate filter values against allowed enums
- Set query timeout to 5 seconds, return partial results with warning

### Pagination Service

**Error Scenarios**:
1. Invalid page number (negative, zero, beyond total pages)
2. Invalid limit (negative, zero, exceeds maximum)
3. Total count query fails

**Handling Strategy**:
- Clamp page to valid range [1, totalPages]
- Clamp limit to valid range [1, maxLimit]
- If count fails, return empty results with error message

## Testing Strategy

### Unit Testing

**Focus Areas**:
1. **Status Determination Logic**: Test `AuctionStatusService.getAuctionStatus()` with various auction states and times
2. **CSV Escaping**: Test RFC 4180 compliance with edge cases (quotes, commas, newlines, special characters)
3. **Search Matching**: Test case-insensitive partial matching with various inputs
4. **Filter Logic**: Test OR logic for multi-select, AND logic for cross-filter
5. **Asset Name Formatting**: Test extraction and formatting for all asset types
6. **Pagination Calculations**: Test edge cases (empty data, single page, boundary conditions)
7. **Test User Filtering**: Test pattern matching for email, name, and vendorId

**Test Data Generators**:
- Random auction states with various endTimes (past, present, future)
- Random CSV data with special characters requiring escaping
- Random search queries and filter combinations
- Random asset details for all asset types
- Random pagination parameters

### Property-Based Testing

**Configuration**: Minimum 100 iterations per property test

**Property Test Examples**:

```typescript
// Property 1: Auction Status Real-Time Determination
describe('Property 1: Auction status determination', () => {
  it('should return closed for expired auctions regardless of DB status', () => {
    fc.assert(
      fc.property(
        fc.record({
          status: fc.constantFrom('active', 'extended'),
          endTime: fc.date({ max: new Date(Date.now() - 1000) }) // Past date
        }),
        (auction) => {
          const status = AuctionStatusService.getAuctionStatus(auction);
          expect(status).toBe('closed');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 15: Multi-Category Filter OR Logic
describe('Property 15: Multi-category filter OR logic', () => {
  it('should return items matching ANY selected category', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('vehicle', 'electronics', 'property'), { minLength: 2 }),
        fc.array(fc.record({
          id: fc.uuid(),
          assetType: fc.constantFrom('vehicle', 'electronics', 'property')
        }), { minLength: 10 }),
        (selectedCategories, allItems) => {
          const filtered = SearchFilterService.applyMultiCategoryFilter(
            allItems,
            selectedCategories
          );
          
          // Every filtered item should match at least one selected category
          for (const item of filtered) {
            expect(selectedCategories).toContain(item.assetType);
          }
          
          // Every item matching a selected category should be in results
          const expectedItems = allItems.filter(item => 
            selectedCategories.includes(item.assetType)
          );
          expect(filtered.length).toBe(expectedItems.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 35: CSV RFC 4180 Compliance
describe('Property 35: CSV escaping', () => {
  it('should properly escape special characters', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const escaped = ExportService.escapeCSVField(value);
          
          // If value contains special chars, should be quoted
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            expect(escaped).toMatch(/^".*"$/);
            // Internal quotes should be doubled
            if (value.includes('"')) {
              expect(escaped).toContain('""');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 38: CSV Round-Trip Preservation
describe('Property 38: CSV round-trip', () => {
  it('should preserve data through export-parse-export cycle', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          name: fc.string(),
          amount: fc.float(),
          description: fc.string()
        }), { minLength: 1, maxLength: 100 }),
        (data) => {
          // Export to CSV
          const csv1 = ExportService.generateCSV({
            filename: 'test.csv',
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'name', header: 'Name' },
              { key: 'amount', header: 'Amount' },
              { key: 'description', header: 'Description' }
            ],
            data
          });
          
          // Parse CSV
          const parsed = CSVParser.parse(csv1);
          
          // Re-export
          const csv2 = ExportService.generateCSV({
            filename: 'test.csv',
            columns: [
              { key: 'id', header: 'ID' },
              { key: 'name', header: 'Name' },
              { key: 'amount', header: 'Amount' },
              { key: 'description', header: 'Description' }
            ],
            data: parsed
          });
          
          // Should be equivalent
          expect(csv1).toBe(csv2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Test Tags**: Each property test must include a comment tag:
```typescript
/**
 * Feature: system-cleanup-and-polish, Property 1: Auction Status Real-Time Determination
 */
```

### Integration Testing

**Focus Areas**:
1. **End-to-End Export Flow**: Test export button → API call → file download
2. **Search with Filters**: Test combined search + filters + pagination
3. **Auction Status in UI**: Test that UI components show correct real-time status
4. **Cache Invalidation**: Test that fraud alert changes invalidate dashboard cache
5. **PDF Generation**: Test that all PDFs use standardized templates

### Manual Testing Checklist

**UI/UX Fixes**:
- [ ] Verify auction status shows "Closed" for expired auctions on all case list pages
- [ ] Verify case creation redirects to `/adjuster/my-cases`
- [ ] Verify fraud alert count matches detail page
- [ ] Verify currency displays show ₦ symbol in finance dashboard
- [ ] Verify "Send Notification" button is removed from auction management
- [ ] Verify search works for "toyota", "lagos", vendor names, etc.
- [ ] Verify multi-category filter shows items from ANY selected category
- [ ] Verify location filter shows partial matches
- [ ] Verify auction cards show specific asset names (not just "Vehicle")
- [ ] Verify notification dropdown aligns with bell icon on mobile and desktop

**Export Functionality**:
- [ ] Verify CSV export downloads with correct filename
- [ ] Verify CSV contains all expected columns and data
- [ ] Verify CSV respects current filters
- [ ] Verify PDF export has NEM letterhead and footer
- [ ] Verify PDF export downloads with correct filename
- [ ] Test export with empty data (should show headers only)
- [ ] Test export with special characters (₦, quotes, commas)

**Pagination**:
- [ ] Verify wallet transactions show 10 per page
- [ ] Verify system logs show 20 per page
- [ ] Verify users list shows 20 per page
- [ ] Verify pagination controls work (next, previous, page numbers)
- [ ] Verify pagination preserves filters when navigating
- [ ] Verify "Previous" disabled on first page
- [ ] Verify "Next" disabled on last page

**Leaderboard**:
- [ ] Verify test users are excluded from leaderboard
- [ ] Verify leaderboard shows only real vendors
- [ ] Test with various test user patterns (test@, demo-, UAT User, etc.)

## Implementation Plan

### Phase 1: Core Services (Week 1)

1. Create `AuctionStatusService` with real-time status determination
2. Create `ExportService` with CSV and PDF generation
3. Create `PDFTemplateService` with standardized letterhead/footer
4. Create `SearchFilterService` with case-insensitive partial matching
5. Create `PaginationService` with reusable pagination logic

### Phase 2: Data Fixes (Week 1-2)

1. Fix auction status display in all case list components
2. Fix case creation redirect to `/adjuster/my-cases`
3. Fix fraud alert count query to exclude dismissed/resolved
4. Fix admin dashboard cache invalidation on fraud alert changes
5. Implement Payment Aging report
6. Fix currency symbol to ₦ in finance dashboard

### Phase 3: UI/UX Fixes (Week 2)

1. Remove "Send Notification" button from auction management
2. Fix search functionality for auctions, cases, vendors, users
3. Fix multi-category filter to use OR logic
4. Fix location filter to use partial matching
5. Enhance auction cards to show specific asset names
6. Fix notification dropdown alignment

### Phase 4: Export Functionality (Week 2-3)

1. Add export buttons to all 6 pages (payments, cases, wallet, bids, my-cases, logs)
2. Implement CSV export for each page
3. Implement PDF export for each page
4. Add export metadata (user, timestamp, filters)
5. Test round-trip CSV parsing

### Phase 5: Pagination (Week 3)

1. Add pagination to wallet transactions (10 per page)
2. Add pagination to system logs (20 per page)
3. Add pagination to users list (20 per page)
4. Implement URL parameter persistence
5. Test filter preservation across pages

### Phase 6: Standardization (Week 3-4)

1. Refactor all PDF generation to use `PDFTemplateService`
2. Update Bill of Sale, Liability Waiver, Pickup Authorization
3. Update all report PDFs
4. Implement test user filtering in leaderboard
5. Add admin UI for marking test accounts

### Phase 7: Testing and Validation (Week 4)

1. Write unit tests for all new services
2. Write property-based tests for critical properties
3. Run integration tests
4. Perform manual testing checklist
5. Fix any discovered issues

## Deployment Strategy

### Pre-Deployment

1. **Database Backup**: Full backup before deployment
2. **Cache Warming**: Pre-populate Redis cache with leaderboard data
3. **Feature Flags**: Enable features gradually (export, pagination, filters)

### Deployment Steps

1. Deploy backend services (no breaking changes)
2. Deploy frontend components (backward compatible)
3. Run database migrations (if any)
4. Clear Redis cache for affected keys
5. Monitor error logs for 24 hours

### Rollback Plan

1. Revert frontend deployment (UI changes only)
2. Restore previous service implementations
3. Clear Redis cache
4. Verify system stability

### Post-Deployment Monitoring

1. Monitor export API response times
2. Monitor search/filter query performance
3. Monitor pagination query performance
4. Check error rates for new endpoints
5. Verify cache hit rates for dashboard and leaderboard

## Performance Considerations

### Database Query Optimization

1. **Search Queries**: Add indexes on frequently searched fields
   - `salvageCases`: Index on `claimReference`, `assetType`, `locationName`
   - `auctions`: Index on `status`, `endTime`
   - `users`: Index on `email`, `fullName`
   - `vendors`: Index on `businessName`, `status`

2. **Pagination Queries**: Use cursor-based pagination for large datasets
   - Wallet transactions: Index on `(vendorId, createdAt DESC)`
   - System logs: Index on `(createdAt DESC, id)`
   - Users: Index on `(role, status, createdAt DESC)`

3. **Export Queries**: Limit to 10,000 records maximum
   - Add warning message if more records exist
   - Suggest applying filters to reduce dataset

### Caching Strategy

1. **Dashboard Stats**: Cache for 5 minutes
   - Invalidate on fraud alert changes
   - Invalidate on user status changes

2. **Leaderboard**: Cache for 7 days (weekly update)
   - Invalidate on manual refresh
   - Invalidate on cron job completion

3. **Search Results**: No caching (real-time data)

4. **Export Files**: No caching (generate on demand)

### Frontend Optimization

1. **Lazy Loading**: Load auction cards in batches of 20
2. **Debouncing**: 300ms debounce on search input
3. **Virtual Scrolling**: Use for large lists (>100 items)
4. **Memoization**: Cache formatted asset names and currency values

## Security Considerations

### Input Validation

1. **Search Queries**: Sanitize to prevent SQL injection
   - Use parameterized queries only
   - Validate max length (500 characters)
   - Strip HTML tags

2. **Filter Values**: Validate against allowed enums
   - Asset types: ['vehicle', 'electronics', 'property']
   - Statuses: Validate against schema enums
   - Pagination: Clamp to valid ranges

3. **Export Requests**: Rate limiting
   - Max 10 exports per user per hour
   - Max 100 exports per IP per day
   - Log all export requests for audit

### Data Access Control

1. **Export Permissions**: Verify user role
   - Finance payments: Finance officer only
   - System logs: Admin only
   - My cases: Adjuster only (own cases)
   - Wallet transactions: Vendor only (own transactions)

2. **Search Scope**: Filter by user role
   - Vendors: See only active auctions
   - Adjusters: See only own cases
   - Managers: See all cases
   - Admins: See all data

### Audit Logging

1. **Export Actions**: Log all exports
   - User ID, timestamp, export type
   - Record count, filters applied
   - File size, generation time

2. **Search Actions**: Log searches (sampling)
   - Sample 10% of searches for analytics
   - Log failed searches (no results)
   - Track popular search terms

## Accessibility Considerations

1. **Export Buttons**: Keyboard accessible, ARIA labels
2. **Pagination Controls**: Keyboard navigation, screen reader support
3. **Search Input**: ARIA live region for result count
4. **Filter Chips**: Removable with keyboard, announced to screen readers
5. **Notification Dropdown**: Focus trap, ESC to close

## Documentation Requirements

1. **API Documentation**: Update OpenAPI spec for new endpoints
2. **User Guide**: Add section on export functionality
3. **Admin Guide**: Document test user filtering configuration
4. **Developer Guide**: Document new services and utilities
5. **Runbook**: Add troubleshooting for common export/search issues

---

## Summary

This design provides a comprehensive solution to 23 identified issues across the salvage management system. The approach prioritizes:

1. **Reusability**: Shared services for export, pagination, search, and PDF generation
2. **Consistency**: Standardized implementations across similar features
3. **Safety**: Thorough testing with property-based tests for critical logic
4. **Performance**: Optimized queries, caching, and lazy loading
5. **Security**: Input validation, access control, and audit logging

The implementation is structured in 7 phases over 4 weeks, with careful attention to testing, deployment, and monitoring. Each fix is surgical and targeted, minimizing the risk of introducing new bugs while systematically addressing all identified issues.
