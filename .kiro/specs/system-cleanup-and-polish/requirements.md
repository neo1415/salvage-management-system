# Requirements Document: System Cleanup and Polish

## Introduction

This feature addresses 22 identified issues across the salvage management system, focusing on data integrity, UI/UX improvements, export functionality, pagination, and PDF standardization. The goal is to systematically fix bugs, enhance user experience, and ensure data consistency without introducing new issues.

## Glossary

- **System**: The salvage management platform
- **Auction_Status_Service**: Service responsible for determining and displaying auction status
- **Search_Filter_Service**: Service that processes search queries and filters across all list views
- **Export_Service**: Service that generates CSV and PDF exports from system data
- **PDF_Generator**: Service that creates PDF documents with standardized formatting
- **Leaderboard_Service**: Service that calculates and displays vendor rankings
- **Fraud_Alert_System**: System component that detects and displays fraud alerts
- **Report_Generator**: Service that generates various financial and operational reports
- **Pagination_Service**: Service that handles paginated data display
- **Notification_UI**: User interface component for displaying notifications

## Requirements

### Requirement 1: Auction Status Accuracy

**User Story:** As a user viewing cases, I want to see accurate auction status, so that I don't see "Active Auction" for auctions that closed long ago.

#### Acceptance Criteria

1. WHEN an auction's endTime has passed, THE Auction_Status_Service SHALL update the status to "closed" within 30 seconds
2. WHEN a case is displayed with an associated auction, THE System SHALL show the current auction status based on real-time data
3. WHEN displaying auction status on case cards, THE System SHALL verify the auction endTime against current time before displaying "Active Auction"
4. IF an auction status is "active" but endTime < current time, THEN THE System SHALL trigger status reconciliation
5. THE Auction_Status_Service SHALL run a background check every 30 seconds to identify and close expired auctions
6. FOR ALL case displays (My Cases, Adjuster Cases, etc.), THE System SHALL use consistent status determination logic

### Requirement 2: Case Creation Redirect Correction

**User Story:** As an adjuster creating a case, I want to be redirected to the correct My Cases page after successful creation, so that I can immediately see my newly created case.

#### Acceptance Criteria

1. WHEN a case is successfully created, THE System SHALL redirect to `/adjuster/my-cases` (sidebar navigation page)
2. THE System SHALL NOT redirect to any other "My Cases" page variant
3. WHEN the redirect occurs, THE System SHALL display a success message confirming case creation
4. WHEN the My Cases page loads after redirect, THE System SHALL show the newly created case at the top of the list
5. THE System SHALL preserve any active filters on the My Cases page after redirect

### Requirement 3: Fraud Alerts Data Integrity

**User Story:** As an admin viewing the dashboard, I want fraud alert counts to match actual alerts, so that I don't see ghost data showing "1 or 2 alerts" when none exist.

#### Acceptance Criteria

1. WHEN the admin dashboard displays fraud alert count, THE System SHALL query actual fraud alerts from the database
2. WHEN no fraud alerts exist, THE System SHALL display "0" alerts with "All clear" status
3. WHEN fraud alerts are clicked, THE System SHALL display the exact alerts counted on the dashboard
4. THE Fraud_Alert_System SHALL NOT count dismissed or resolved alerts in the pending count
5. THE System SHALL cache fraud alert counts for maximum 5 minutes to ensure freshness
6. WHEN fraud alerts are dismissed or created, THE System SHALL invalidate the dashboard cache immediately

### Requirement 4: Reports Functionality Restoration

**User Story:** As a manager, I want all reports to work correctly, so that I can access Payment Aging and other reports beyond just Recovery Summary.

#### Acceptance Criteria

1. WHEN "Recovery Summary" report is requested, THE Report_Generator SHALL generate the report successfully (existing functionality)
2. WHEN "Payment Aging" report is requested, THE Report_Generator SHALL generate aging buckets (0-7 days, 8-14 days, 15-21 days, 22+ days)
3. WHEN "Payment Aging" report is requested, THE Report_Generator SHALL include payment status, amount, due date, and days overdue
4. THE Report_Generator SHALL handle empty data sets gracefully with "No data available" message
5. THE Report_Generator SHALL complete report generation within 3 seconds for datasets up to 1000 records
6. WHEN any report fails to generate, THE System SHALL display a specific error message indicating which report failed and why

### Requirement 5: Currency Icon Standardization

**User Story:** As a finance officer viewing the dashboard, I want to see the Naira symbol (₦) instead of dollar signs, so that the currency matches our Nigerian market.

#### Acceptance Criteria

1. THE System SHALL use Naira symbol (₦) for all currency displays in the finance dashboard
2. THE System SHALL NOT display dollar sign ($) or DollarSign icon in any finance-related views
3. WHEN displaying currency amounts, THE System SHALL format as "₦X,XXX,XXX.XX"
4. THE System SHALL use consistent currency formatting across all dashboard stat cards
5. WHERE currency icons are used for visual decoration, THE System SHALL use a generic currency icon or Naira-specific icon

### Requirement 6: Auction Management UI Cleanup

**User Story:** As an admin managing auctions, I want the Send Notification button removed, so that I don't manually send notifications that are already auto-sent after document generation.

#### Acceptance Criteria

1. THE System SHALL NOT display "Send Notification" button in the Auction Management page
2. WHEN documents are generated for an auction, THE System SHALL automatically send notifications to the winner
3. THE System SHALL display a status indicator showing "Notifications Sent" after automatic notification delivery
4. WHERE notification sending fails, THE System SHALL display "Retry Notification" button as an exception
5. THE System SHALL log all automatic notification sends for audit purposes

### Requirement 7: Search Functionality Restoration

**User Story:** As a user searching for items, I want search bars to return matching results, so that typing "toyota" shows Toyota vehicles instead of empty results.

#### Acceptance Criteria

1. WHEN a user types a search query in any search bar, THE Search_Filter_Service SHALL perform case-insensitive partial matching
2. WHEN searching for "toyota" in auctions, THE System SHALL search in assetDetails JSON fields (make, model, description)
3. WHEN searching in cases, THE System SHALL search in claimReference, assetType, and assetDetails fields
4. WHEN searching in vendor lists, THE System SHALL search in company name, email, and phone number
5. WHEN searching in user lists, THE System SHALL search in name, email, and role
6. THE Search_Filter_Service SHALL return results within 500ms for datasets up to 10,000 records
7. WHEN no results match the search query, THE System SHALL display "No results found for '{query}'" message
8. THE System SHALL highlight or indicate which field matched the search query in results

### Requirement 8: Multi-Category Filter Correction

**User Story:** As a vendor filtering auctions, I want to select multiple categories (electronics AND vehicle) and see both types, so that I can browse multiple asset types simultaneously.

#### Acceptance Criteria

1. WHEN multiple asset type filters are selected, THE Search_Filter_Service SHALL use OR logic (show items matching ANY selected category)
2. WHEN "electronics" AND "vehicle" are selected, THE System SHALL display auctions for both electronics and vehicles
3. THE System SHALL NOT use AND logic that requires items to match all categories simultaneously
4. WHEN category filters are applied, THE System SHALL display a count of active filters
5. THE System SHALL allow clearing individual category filters or all filters at once
6. THE Search_Filter_Service SHALL combine category filters with other filters (price, location, search) using AND logic between filter types

### Requirement 9: Location Filter Correction

**User Story:** As a user filtering by location, I want location search to work properly, so that I can find items in specific areas.

#### Acceptance Criteria

1. WHEN a location filter is applied, THE Search_Filter_Service SHALL perform case-insensitive partial matching on locationName field
2. WHEN searching for "Lagos", THE System SHALL return items in "Lagos", "Lagos Island", "Lagos Mainland", etc.
3. THE System SHALL support location autocomplete suggestions based on existing locations in the database
4. WHEN location filter is combined with other filters, THE System SHALL apply all filters correctly
5. THE Search_Filter_Service SHALL handle location variations (abbreviations, full names) gracefully

### Requirement 10: Auction Card Content Enhancement

**User Story:** As a vendor browsing auctions, I want to see actual item names on auction cards, so that I know what specific item is being auctioned instead of just seeing categories/brands.

#### Acceptance Criteria

1. WHEN displaying auction cards, THE System SHALL show the specific asset name from assetDetails (e.g., "Toyota Camry 2015" not just "Vehicle")
2. WHERE assetDetails contains make and model, THE System SHALL display "{make} {model} {year}"
3. WHERE assetDetails contains item name for electronics/property, THE System SHALL display the specific item name
4. WHERE specific asset name is unavailable, THE System SHALL fall back to "{assetType} - {claimReference}"
5. THE System SHALL limit asset name display to 50 characters with ellipsis for overflow
6. THE System SHALL maintain consistent asset name formatting across all auction card displays

### Requirement 11: Notification UI Alignment

**User Story:** As a user on any screen size, I want the notification icon and dropdown to be properly aligned, so that the dropdown appears next to the icon on both desktop and mobile.

#### Acceptance Criteria

1. WHEN the notification bell icon is clicked, THE Notification_UI SHALL display the dropdown aligned to the icon position
2. THE Notification_UI SHALL position the dropdown relative to the bell icon, not fixed to screen edges
3. WHEN viewed on mobile devices, THE Notification_UI SHALL ensure dropdown is fully visible within viewport
4. WHEN viewed on desktop, THE Notification_UI SHALL display dropdown below and aligned to the right of the bell icon
5. THE Notification_UI SHALL prevent dropdown from being cut off by screen edges on any device
6. THE System SHALL ensure notification bell icon and dropdown maintain consistent positioning across all dashboard layouts

### Requirement 12: Finance Payments Export

**User Story:** As a finance officer, I want to export payment data to CSV/PDF, so that I can analyze payments offline or share reports with stakeholders.

#### Acceptance Criteria

1. WHEN viewing the Finance Payments page, THE System SHALL display an "Export" dropdown button
2. WHEN "Export to CSV" is selected, THE Export_Service SHALL generate a CSV file with all visible payment records
3. WHEN "Export to PDF" is selected, THE Export_Service SHALL generate a PDF file with standardized letterhead and footer
4. THE Export_Service SHALL include columns: Payment ID, Auction ID, Vendor Name, Amount, Status, Payment Method, Created Date, Verified Date
5. THE Export_Service SHALL respect current filters and search when exporting (export only filtered results)
6. THE Export_Service SHALL complete export generation within 5 seconds for up to 1000 records
7. WHEN export is ready, THE System SHALL trigger automatic download with filename "finance-payments-{date}.{format}"

### Requirement 13: Cases Created Export

**User Story:** As a manager, I want to export cases data to CSV/PDF, so that I can track case creation metrics and share reports.

#### Acceptance Criteria

1. WHEN viewing cases lists (Adjuster Cases, Manager Cases), THE System SHALL display an "Export" dropdown button
2. WHEN "Export to CSV" is selected, THE Export_Service SHALL generate a CSV file with all visible case records
3. WHEN "Export to PDF" is selected, THE Export_Service SHALL generate a PDF file with standardized letterhead and footer
4. THE Export_Service SHALL include columns: Claim Reference, Asset Type, Status, Created Date, Adjuster Name, Market Value, Reserve Price, Location
5. THE Export_Service SHALL respect current status filters and search when exporting
6. THE Export_Service SHALL complete export generation within 5 seconds for up to 1000 records
7. WHEN export is ready, THE System SHALL trigger automatic download with filename "cases-{status}-{date}.{format}"

### Requirement 14: Wallet Transactions Export

**User Story:** As a vendor, I want to export my wallet transaction history to CSV/PDF, so that I can maintain personal financial records.

#### Acceptance Criteria

1. WHEN viewing the Wallet Transactions page, THE System SHALL display an "Export" dropdown button
2. WHEN "Export to CSV" is selected, THE Export_Service SHALL generate a CSV file with all transaction records for the current user
3. WHEN "Export to PDF" is selected, THE Export_Service SHALL generate a PDF file with standardized letterhead and footer
4. THE Export_Service SHALL include columns: Transaction ID, Type, Amount, Balance After, Description, Date, Reference
5. THE Export_Service SHALL respect date range filters when exporting
6. THE Export_Service SHALL complete export generation within 5 seconds for up to 1000 records
7. WHEN export is ready, THE System SHALL trigger automatic download with filename "wallet-transactions-{date}.{format}"

### Requirement 15: Bid History Export

**User Story:** As a vendor, I want to export my bid history to CSV/PDF, so that I can track my bidding activity and analyze my auction participation.

#### Acceptance Criteria

1. WHEN viewing the Bid History page, THE System SHALL display an "Export" dropdown button
2. WHEN "Export to CSV" is selected, THE Export_Service SHALL generate a CSV file with all bid records (excluding watching data)
3. WHEN "Export to PDF" is selected, THE Export_Service SHALL generate a PDF file with standardized letterhead and footer
4. THE Export_Service SHALL include columns: Auction ID, Asset Name, Bid Amount, Bid Date, Status (Won/Lost/Active), Final Price
5. THE Export_Service SHALL NOT include "watching" auctions in the export (only actual bids placed)
6. THE Export_Service SHALL respect auction status filters when exporting
7. THE Export_Service SHALL complete export generation within 5 seconds for up to 1000 records
8. WHEN export is ready, THE System SHALL trigger automatic download with filename "bid-history-{date}.{format}"

### Requirement 16: My Cases Export

**User Story:** As an adjuster, I want to export my cases to CSV/PDF, so that I can maintain offline records of my case portfolio.

#### Acceptance Criteria

1. WHEN viewing the My Cases page, THE System SHALL display an "Export" dropdown button
2. WHEN "Export to CSV" is selected, THE Export_Service SHALL generate a CSV file with all cases created by the current adjuster
3. WHEN "Export to PDF" is selected, THE Export_Service SHALL generate a PDF file with standardized letterhead and footer
4. THE Export_Service SHALL include columns: Claim Reference, Asset Type, Status, Created Date, Market Value, Reserve Price, Location, Damage Severity
5. THE Export_Service SHALL respect status filters and search when exporting
6. THE Export_Service SHALL complete export generation within 5 seconds for up to 1000 records
7. WHEN export is ready, THE System SHALL trigger automatic download with filename "my-cases-{date}.{format}"

### Requirement 17: System Logs Export

**User Story:** As an admin, I want to export system logs to CSV/PDF, so that I can perform offline analysis and maintain audit trails.

#### Acceptance Criteria

1. WHEN viewing the System Logs page (admin only), THE System SHALL display an "Export" dropdown button
2. WHEN "Export to CSV" is selected, THE Export_Service SHALL generate a CSV file with all visible log records
3. WHEN "Export to PDF" is selected, THE Export_Service SHALL generate a PDF file with standardized letterhead and footer
4. THE Export_Service SHALL include columns: Timestamp, User, Action, Resource Type, Resource ID, IP Address, Status
5. THE Export_Service SHALL respect date range and action type filters when exporting
6. THE Export_Service SHALL complete export generation within 10 seconds for up to 5000 records
7. WHEN export is ready, THE System SHALL trigger automatic download with filename "system-logs-{date}.{format}"
8. THE Export_Service SHALL handle large log datasets by limiting exports to 5000 most recent records with a warning message

### Requirement 18: Wallet Transactions Pagination

**User Story:** As a vendor with many transactions, I want wallet transactions paginated, so that the page loads quickly and I can navigate through my transaction history easily.

#### Acceptance Criteria

1. WHEN viewing the Wallet Transactions page, THE Pagination_Service SHALL display 10 transactions per page
2. THE System SHALL display pagination controls (Previous, Page Numbers, Next) at the bottom of the transaction list
3. WHEN navigating to a different page, THE System SHALL load the next set of transactions within 500ms
4. THE System SHALL display total transaction count and current page range (e.g., "Showing 11-20 of 156 transactions")
5. THE Pagination_Service SHALL preserve filters and search when navigating between pages
6. THE System SHALL remember the current page when user navigates away and returns to the page
7. WHEN on the first page, THE System SHALL disable the "Previous" button
8. WHEN on the last page, THE System SHALL disable the "Next" button

### Requirement 19: System Logs Pagination

**User Story:** As an admin viewing system logs, I want logs paginated, so that I can efficiently browse through large volumes of audit data.

#### Acceptance Criteria

1. WHEN viewing the System Logs page, THE Pagination_Service SHALL display 20 log entries per page
2. THE System SHALL display pagination controls (Previous, Page Numbers, Next) at the bottom of the logs list
3. WHEN navigating to a different page, THE System SHALL load the next set of logs within 500ms
4. THE System SHALL display total log count and current page range (e.g., "Showing 21-40 of 2,543 logs")
5. THE Pagination_Service SHALL preserve date range and action type filters when navigating between pages
6. THE System SHALL default to showing the most recent logs first (descending order by timestamp)
7. WHEN on the first page, THE System SHALL disable the "Previous" button
8. WHEN on the last page, THE System SHALL disable the "Next" button

### Requirement 20: Users List Pagination

**User Story:** As an admin managing users, I want the users list paginated, so that I can efficiently browse and manage large numbers of users.

#### Acceptance Criteria

1. WHEN viewing the Admin Users page, THE Pagination_Service SHALL display 20 users per page
2. THE System SHALL display pagination controls (Previous, Page Numbers, Next) at the bottom of the users list
3. WHEN navigating to a different page, THE System SHALL load the next set of users within 500ms
4. THE System SHALL display total user count and current page range (e.g., "Showing 21-40 of 156 users")
5. THE Pagination_Service SHALL preserve role and status filters when navigating between pages
6. THE System SHALL preserve search query when navigating between pages
7. WHEN on the first page, THE System SHALL disable the "Previous" button
8. WHEN on the last page, THE System SHALL disable the "Next" button

### Requirement 21: PDF Standardization

**User Story:** As a user receiving PDF exports and reports, I want all PDFs to have consistent branding, so that documents look professional and match the Bill of Sale format.

#### Acceptance Criteria

1. THE PDF_Generator SHALL use the same letterhead format for all generated PDFs (exports, reports, documents)
2. THE PDF_Generator SHALL use the same footer format for all generated PDFs matching the Bill of Sale document
3. WHEN generating any PDF, THE PDF_Generator SHALL include company logo, name, and contact information in the header
4. WHEN generating any PDF, THE PDF_Generator SHALL include page numbers, generation date, and disclaimer text in the footer
5. THE PDF_Generator SHALL use consistent fonts, colors, and spacing across all PDF types
6. THE PDF_Generator SHALL include document type and title prominently below the letterhead
7. FOR ALL PDF exports, THE PDF_Generator SHALL include generation timestamp and user who generated the export

### Requirement 22: Leaderboard Test User Cleanup

**User Story:** As a vendor viewing the leaderboard, I want to see only real vendors, so that test accounts don't clutter the rankings.

#### Acceptance Criteria

1. WHEN calculating leaderboard rankings, THE Leaderboard_Service SHALL exclude users with email addresses containing "test", "demo", or "uat"
2. WHEN calculating leaderboard rankings, THE Leaderboard_Service SHALL exclude users with names containing "Test", "Demo", or "UAT"
3. THE Leaderboard_Service SHALL exclude users with vendorId matching known test account patterns
4. THE System SHALL provide an admin configuration option to mark specific users as "test accounts" for exclusion
5. WHEN leaderboard is displayed, THE System SHALL show only production vendors with real transaction history
6. THE Leaderboard_Service SHALL cache filtered leaderboard results for 5 minutes to improve performance
7. WHEN a test user is identified, THE System SHALL automatically exclude them from future leaderboard calculations without manual intervention

### Requirement 23: Parser and Serializer Requirements

**User Story:** As a developer maintaining the export system, I want robust CSV and PDF generation with round-trip validation, so that exported data can be reliably re-imported if needed.

#### Acceptance Criteria

1. WHEN the Export_Service generates a CSV file, THE CSV_Parser SHALL format data according to RFC 4180 standard
2. THE CSV_Parser SHALL properly escape special characters (commas, quotes, newlines) in field values
3. THE CSV_Parser SHALL include a header row with column names in all CSV exports
4. THE Pretty_Printer SHALL format CSV data with consistent column alignment and proper encoding (UTF-8)
5. FOR ALL CSV exports, parsing the exported CSV then re-exporting SHALL produce an equivalent file (round-trip property)
6. WHEN CSV parsing fails, THE System SHALL return a descriptive error indicating the line number and issue
7. THE Export_Service SHALL validate data integrity before export by checking for null values and data type consistency
