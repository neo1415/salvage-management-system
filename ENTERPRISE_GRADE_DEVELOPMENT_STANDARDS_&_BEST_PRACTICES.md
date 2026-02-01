ENTERPRISE-GRADE DEVELOPMENT STANDARDS & BEST PRACTICES
Salvage Management System - NEM Insurance Nigeria
Document Version: 1.0
 Last Updated: January 21, 2026
 Target Quality Level: Google/Fortune 500 Enterprise Standard
 Purpose: Ensure world-class code quality, scalability, security, and maintainability

EXECUTIVE SUMMARY
This document defines mandatory development standards for the Salvage Management System to ensure the codebase meets enterprise-grade quality comparable to systems at Google, Microsoft, or Fortune 500 companies. These are non-negotiable requirements, not suggestions.
Core Philosophy:
Code should be self-documenting and readable by any developer globally
Every line of code must serve a clear purpose (no bloat)
Security is built-in from day one, not added later
Performance is a feature, not an afterthought
Scalability from 100 users to 100,000 users without major rewrites

1. ARCHITECTURAL PRINCIPLES
1.1 Clean Architecture (Mandatory)
What it means: Separate your application into distinct layers where each layer has one responsibility and doesn't know about layers above it.
Required Structure:
Backend (Node.js/TypeScript):
├── api/           → HTTP routes and endpoints only
├── controllers/   → Handle requests, call services, return responses
├── services/      → Business logic (KYC verification, auction closure, payments)
├── repositories/  → Database queries only
├── domain/        → Business entities and rules
├── infrastructure/→ External services (AWS S3, Redis, Payment APIs)
└── shared/        → Utilities, constants, types

Frontend (React/TypeScript):
├── pages/         → Full page components
├── components/    → Reusable UI components
├── features/      → Feature-specific logic (auctions, bidding, payments)
├── services/      → API calls
├── store/         → Redux state management
├── hooks/         → Custom React hooks
└── utils/         → Helper functions

Why this matters: When a new developer joins, they know exactly where to find payment logic (services), database queries (repositories), or UI components. No hunting through spaghetti code.
1.2 Separation of Concerns
Rule: One file/class = One responsibility
Examples:
✅ AuctionClosureService.ts - Only handles closing auctions
✅ PaystackWebhookHandler.ts - Only processes Paystack webhooks
❌ AuctionService.ts - Handles auctions, payments, emails, notifications (too many responsibilities)
Why this matters: When bugs occur, you know exactly which file to fix. When features change, you only modify one place.
1.3 Dependency Injection
What it means: Don't create dependencies inside your classes. Pass them in from outside (constructor or parameters).
Why this matters:
Makes code testable (you can inject mock dependencies)
Reduces tight coupling between components
Allows easy swapping of implementations (e.g., switch from Paystack to Flutterwave)
Key Rule: If a class needs a database, logger, or external API client, it should receive it as a parameter, not create it internally.

2. TYPESCRIPT STANDARDS
2.1 Strict Type Safety (Non-Negotiable)
Mandatory TypeScript Settings:
strict: true - Enables all strict type checking
noImplicitAny: true - No any types allowed
strictNullChecks: true - Must handle null/undefined explicitly
noUnusedLocals: true - No unused variables
noUnusedParameters: true - No unused function parameters
Rule: NEVER use any type. Use unknown if you genuinely don't know the type, then validate it.
Why this matters: Prevents 90% of runtime errors before code even runs. TypeScript catches bugs during development, not in production.
2.2 Explicit Types Everywhere
Required:
All function parameters must have types
All function return types must be declared
All variables should have inferred or explicit types
All API request/response objects must have interfaces
Why this matters: Another developer (or AI assistant) can understand what your function does without reading implementation. IDEs provide perfect autocomplete.
2.3 Interface-First Design
Rule: Define interfaces BEFORE writing implementation code.
Why this matters: Forces you to think about what data you need before writing code. Makes refactoring easier because contracts are clear.

3. CODE QUALITY & MAINTAINABILITY
3.1 DRY Principle (Don't Repeat Yourself)
Rule: If you copy-paste code more than once, create a reusable function/component.
Examples:
✅ Create formatCurrency() utility for all money formatting
✅ Create <CountdownTimer> component for all auction timers
❌ Copy-paste date formatting logic in 15 different files
Why this matters: Fix bugs once, not 15 times. Change behavior once, not 15 times.
3.2 SOLID Principles
S - Single Responsibility: One class/function does one thing
 O - Open/Closed: Open for extension, closed for modification
 L - Liskov Substitution: Subtypes must be substitutable for base types
 I - Interface Segregation: Many small interfaces > one large interface
 D - Dependency Inversion: Depend on abstractions, not concrete implementations
Why this matters: Makes code flexible, testable, and maintainable over years.
3.3 Naming Conventions
MANDATORY Standards:
Variables & Functions:
Use camelCase for variables and functions
Use descriptive names (no abbreviations except common ones)
Boolean variables start with is, has, should, can
Examples: isVerified, hasPermission, canBid, getUserById
Classes & Interfaces:
Use PascalCase for classes and interfaces
Interfaces for data: VendorProfile, AuctionData
Classes for services: PaymentService, BVNVerificationClient
Constants:
Use UPPER_SNAKE_CASE for true constants
Example: MAX_BID_AMOUNT, DEFAULT_AUCTION_DURATION
Files:
Use kebab-case for file names
Example: auction-closure.service.ts, vendor-registration.component.tsx
Why this matters: Any developer globally can read your code without confusion. Consistency = professionalism.
3.4 Code Comments
When to comment:
Complex business logic that isn't obvious
"Why" decisions were made (not "what" the code does)
API integrations with external services
Security-critical sections
Workarounds for known issues
When NOT to comment:
Obvious code (if code is obvious, don't comment)
Dead code (delete it instead)
Outdated information (comments that lie are worse than no comments)
Best Practice: Self-documenting code (clear names) > comments

4. DATABASE DESIGN (POSTGRESQL)
4.1 Naming Conventions
Tables: Plural, lowercase, snake_case
Examples: vendors, salvage_cases, auction_bids
Columns: Lowercase, snake_case
Examples: created_at, full_name, bvn_encrypted
Indexes: Prefix with idx_
Example: idx_vendors_email, idx_auctions_status_end_time
Foreign Keys: Prefix with fk_
Example: fk_bids_vendor_id
4.2 Data Types
CRITICAL Rules:
Money: Use NUMERIC(12, 2) NEVER FLOAT or REAL
Dates: Use TIMESTAMPTZ (with timezone) NEVER TIMESTAMP
UUIDs: Use UUID type with gen_random_uuid() default
Booleans: Use BOOLEAN not INTEGER (0/1)
Enums: Use PostgreSQL ENUM types for fixed values
Why this matters:
FLOAT loses precision with money (₦500,000 might become ₦499,999.99)
Missing timezones causes bugs across regions
Proper types enforce data integrity at database level
4.3 Indexing Strategy
Required Indexes:
Primary keys (automatic with UUID)
Foreign keys (ALWAYS index these)
Columns used in WHERE clauses frequently
Columns used in ORDER BY
Columns used in JOIN conditions
Example: If you query WHERE status = 'active' AND end_time < NOW() frequently, create:
CREATE INDEX idx_auctions_status_end_time 
ON auctions(status, end_time) 
WHERE status = 'active';

Why this matters: Queries run 100x-1000x faster with proper indexes.
4.4 Data Integrity
Mandatory Constraints:
NOT NULL for required fields
UNIQUE for fields that must be unique (email, phone, BVN)
CHECK constraints for business rules (bid amount > reserve price)
Foreign key constraints with ON DELETE CASCADE or RESTRICT
Why this matters: Database enforces rules even if application code has bugs.

5. API DESIGN (RESTful)
5.1 URL Structure
Standard Format:
GET    /api/v1/auctions           - List all auctions
GET    /api/v1/auctions/:id       - Get single auction
POST   /api/v1/auctions           - Create auction
PUT    /api/v1/auctions/:id       - Full update
PATCH  /api/v1/auctions/:id       - Partial update
DELETE /api/v1/auctions/:id       - Delete auction

Rules:
Use plural nouns (auctions not auction)
No verbs in URLs (/create-auction is WRONG)
Use HTTP methods correctly (GET, POST, PUT, PATCH, DELETE)
Versioning in URL (/api/v1/)
5.2 Response Format
MANDATORY Standard Response:
{
  "status": "success" | "error",
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 150
  }
}

Error Response:
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Bid amount too low",
    "details": { ... }
  }
}

5.3 HTTP Status Codes
Use correctly:
200 OK - Successful GET, PUT, PATCH
201 Created - Successful POST
204 No Content - Successful DELETE
400 Bad Request - Invalid input
401 Unauthorized - Not logged in
403 Forbidden - Logged in but no permission
404 Not Found - Resource doesn't exist
409 Conflict - Duplicate or state conflict
422 Unprocessable Entity - Validation failed
429 Too Many Requests - Rate limit exceeded
500 Internal Server Error - Server fault
503 Service Unavailable - Temporary downtime
Why this matters: Frontend can handle errors correctly. APIs are self-documenting.
5.4 Rate Limiting
Mandatory for all endpoints:
Authentication: 5 requests/minute
Bids: 10 requests/minute per vendor
General API: 100 requests/15 minutes
Why this matters: Prevents abuse, DDoS attacks, and ensures fair resource usage.

6. SECURITY STANDARDS
6.1 Authentication & Authorization
JWT Best Practices:
Short expiry (2 hours mobile, 24 hours desktop)
Refresh tokens for long sessions
Store tokens securely (HTTP-only cookies or secure storage)
Never expose secrets in frontend code
Password Requirements:
Minimum 8 characters
At least 1 uppercase, 1 lowercase, 1 number, 1 special character
Hash with bcrypt (12+ rounds)
Never store plain text passwords
BVN/NIN Security:
Encrypt sensitive data at rest (AES-256)
Mask when displaying (show only last 4 digits: ****7890)
Never log sensitive data
Strict access control (only authorized roles)
6.2 Input Validation
CRITICAL Rule: Never trust user input. Validate EVERYTHING.
Required Validations:
Email format
Phone number format (Nigerian: +234...)
BVN (exactly 11 digits)
Money amounts (positive numbers only)
File uploads (type, size limits)
SQL injection prevention (use parameterized queries)
XSS prevention (sanitize HTML inputs)
Use validation libraries:
Backend: Joi, Zod, or class-validator
Frontend: React Hook Form with Zod
6.3 HTTPS & Data Protection
Mandatory:
All traffic over HTTPS (TLS 1.3)
Encrypt data in transit
Encrypt sensitive data at rest (passwords, BVN, payment details)
CORS properly configured (whitelist allowed origins)
Security headers (Content-Security-Policy, X-Frame-Options, etc.)
6.4 Audit Logging
Log ALL security-relevant events:
Login/logout (with IP address, device type)
Failed login attempts
Permission changes
Sensitive data access (BVN verification, payment details)
Admin actions
Storage:
Logs must be immutable (cannot be edited/deleted)
Minimum 2 years retention
Searchable and exportable
Why this matters: Compliance (NDPR), forensics after security incidents, debugging.

7. TESTING STANDARDS
7.1 Test Coverage Requirements
MANDATORY Minimum:
80% code coverage overall
100% coverage for:
Payment processing logic
BVN/KYC verification logic
Auction closure logic
Security/authentication logic
Test Types Required:
Unit Tests - Test individual functions in isolation
Integration Tests - Test multiple components together
End-to-End (E2E) Tests - Test full user flows
Security Tests - Penetration testing, vulnerability scanning
7.2 Testing Tools
Backend:
Unit/Integration: Jest, Mocha, or Vitest
E2E: Playwright or Cypress
Load Testing: k6, Apache JMeter
Frontend:
Unit/Integration: Jest + React Testing Library
E2E: Playwright or Cypress
Visual Regression: Percy or Chromatic
7.3 Test-Driven Development (TDD)
Best Practice (strongly recommended):
Write test first (defines expected behavior)
Write minimal code to make test pass
Refactor code while keeping tests green
Why this matters: Prevents bugs before they happen. Ensures code is testable (good design).

8. PERFORMANCE STANDARDS
8.1 Response Time Requirements
MANDATORY Targets:
API responses: <500ms (95th percentile)
Mobile page load: <2 seconds
Desktop page load: <1.5 seconds
Image uploads: <8 seconds
Real-time updates (WebSocket): <1 second latency
How to achieve:
Database query optimization (proper indexes)
Caching (Redis for frequently accessed data)
Image compression (TinyPNG API before upload)
CDN for static assets (Cloudflare/Bunny CDN)
Code splitting (load only what's needed)
8.2 Database Query Optimization
Rules:
Use EXPLAIN ANALYZE to check query performance
Avoid SELECT * (select only needed columns)
Use pagination for large datasets (LIMIT/OFFSET)
Minimize N+1 queries (use JOINs or batch loading)
Index columns used in WHERE, ORDER BY, JOIN
Example: If listing auctions loads vendors separately for each auction (N+1 problem), load all vendors in one query.
8.3 Caching Strategy
What to cache:
User sessions (Redis)
Frequently accessed data (auction countdown states)
API responses for read-heavy endpoints
Static assets (CSS, JS, images) via CDN
Cache invalidation:
Set expiry times (TTL)
Invalidate on data changes (e.g., new bid invalidates auction cache)
Why this matters: Reduces database load by 70-90%. Improves response times dramatically.

9. UI/UX DESIGN STANDARDS
9.1 Mobile-First Design Principles
CRITICAL: Design for mobile screens FIRST, then scale up to desktop.
Key Rules:
Touch-Friendly: Buttons minimum 44x44px (Apple guideline)
Thumb-Friendly: Place important actions within thumb reach (bottom of screen)
Minimalist: One primary action per screen
Progressive Disclosure: Show essentials first, hide advanced features behind "More" buttons
Fast Load: Optimize images, minimize bundle size
Why this matters: 70%+ of your traffic will be mobile (per PRD requirements).
9.2 Color & Typography
Color Guidelines:
Primary Action: High contrast, attention-grabbing (e.g., Blue/Green for "Bid Now")
Destructive Action: Red (e.g., "Delete", "Cancel Bid")
Success: Green (e.g., "Payment Confirmed")
Warning: Orange/Yellow (e.g., "Auction ending soon")
Neutral: Gray for secondary actions
Contrast Ratio: Minimum 4.5:1 for text (WCAG AA standard)
Typography:
Mobile: 16px minimum font size (prevents auto-zoom on iOS)
Headings: Clear hierarchy (H1 > H2 > H3)
Line Height: 1.5 for body text (readability)
9.3 Financial UI Best Practices
Trust-Building Elements:
Security Badges: Display "BVN Verified", "Encrypted", "Secure Payment"
Real-Time Feedback: Show loading states, confirmation messages immediately
Transparency: Show exactly what's happening ("Processing payment..." not just spinner)
Error Clarity: Explain what went wrong and how to fix it
Social Proof: Display "X vendors watching", ratings, transaction count
Fintech-Specific Rules:
Display money amounts prominently with ₦ symbol
Use green for positive (profit, savings) and red for negative (spending, loss)
Show transaction status clearly (Pending, Confirmed, Failed)
Provide instant confirmation after critical actions (bid placed, payment sent)
9.4 Accessibility (WCAG 2.1 Level AA)
Mandatory Requirements:
Keyboard navigation (all actions possible without mouse)
Screen reader support (proper ARIA labels)
Color contrast 4.5:1 minimum
Alt text for all images
Form labels for all inputs
Focus indicators visible
Why this matters: Legal compliance, inclusivity, better UX for everyone.

10. WEBSOCKET & REAL-TIME STANDARDS
10.1 WebSocket Connection Management
Best Practices:
Auto-reconnect on disconnection (exponential backoff)
Heartbeat/ping-pong to keep connection alive
Graceful degradation (fall back to polling if WebSocket fails)
Connection state visible to user ("Connected", "Reconnecting...")
Why this matters: Mobile networks are unstable. Users shouldn't lose bids due to dropped connections.
10.2 Event Broadcasting
Rules:
Broadcast only to relevant users (don't spam all connected clients)
Include minimal data (send IDs, not full objects)
Throttle high-frequency updates (max 1 update/second)
Example: New bid on Auction X → broadcast to users viewing Auction X only, not all users.

11. ERROR HANDLING & LOGGING
11.1 Error Handling Strategy
Mandatory Pattern:
Catch errors at appropriate level (don't swallow errors silently)
Log errors with context (user ID, action attempted, timestamp)
Return user-friendly messages (not stack traces)
Notify relevant teams (Sentry/logging service for critical errors)
Example:
Database connection fails → Log error, return "Service temporarily unavailable" to user, alert DevOps team
11.2 Logging Levels
Use correctly:
ERROR - Something broke, needs immediate attention
WARN - Something unusual, might become a problem
INFO - Important business events (payment completed, user registered)
DEBUG - Detailed information for troubleshooting (only in development)
Production Rule: Log INFO and above only (not DEBUG).
11.3 Structured Logging
Required Format (JSON):
{
  "level": "ERROR",
  "message": "Payment verification failed",
  "timestamp": "2026-01-21T10:30:00Z",
  "userId": "uuid",
  "auctionId": "uuid",
  "error": "Paystack webhook signature invalid",
  "stack": "..."
}

Why this matters: Searchable, parseable logs. Easy to filter and analyze.

12. DEVOPS & DEPLOYMENT
12.1 Version Control (Git)
Branch Strategy (GitFlow):
main - Production code (always deployable)
develop - Integration branch
feature/* - New features
bugfix/* - Bug fixes
hotfix/* - Urgent production fixes
Commit Messages:
Use conventional commits format
Examples:
feat: add SMS OTP verification for bids
fix: resolve payment webhook signature validation
refactor: extract bid validation logic to service
12.2 CI/CD Pipeline
Required Stages:
Lint & Format - Check code style
Type Check - TypeScript validation
Unit Tests - Run all tests
Build - Compile code
Integration Tests - Test with real database (test environment)
Security Scan - Check for vulnerabilities
Deploy - Only if all above pass
Deployment Strategy:
Staging Environment - Deploy here first, test manually
Production Deployment - Blue-green or rolling deployment (zero downtime)
12.3 Monitoring & Alerting
Required Monitoring:
Server health (CPU, memory, disk usage)
API response times
Error rates
Database query performance
User activity metrics
Alerting Rules:
Error rate >1% → Alert DevOps
API response time >1s → Alert team
Server down → Immediate alert
Payment webhook failures → Alert Finance + DevOps
Tools: CloudWatch, Sentry, Datadog, or Grafana

13. DOCUMENTATION STANDARDS
13.1 Code Documentation
Required Documentation:
README.md with setup instructions
API documentation (OpenAPI/Swagger)
Database schema documentation
Deployment guide
Environment variables documentation
README Template:
# Project Name

## Setup
1. Prerequisites (Node.js 18+, PostgreSQL 15+)
2. Installation steps
3. Environment variables
4. Database migrations
5. Running locally

## Architecture
- Brief overview of folder structure

## Testing
- How to run tests

## Deployment
- How to deploy

13.2 API Documentation
Use OpenAPI 3.0 Specification:
Document all endpoints
Include request/response examples
Document error responses
Authentication requirements
Tool: Use Swagger UI or Redoc for interactive documentation.

14. NIGERIAN MARKET-SPECIFIC STANDARDS
14.1 Data Sovereignty
NDPR Compliance (Nigerian Data Protection Regulation):
Obtain explicit consent for data collection
Allow users to export their data
Allow users to delete their data (within 30 days)
Keep data within Nigeria when possible
14.2 Mobile Network Optimization
Nigeria-Specific Challenges:
Slow 3G networks common
Expensive data plans
Intermittent connectivity
Solutions:
Aggressive image compression (TinyPNG API)
Offline-first PWA (service workers)
Minimal bundle sizes (<200KB JavaScript initial load)
Progressive image loading
14.3 Payment Integration Standards
Paystack/Flutterwave Integration:
ALWAYS verify webhook signatures (prevent fraud)
Double-check transaction amount matches invoice
Handle failed payments gracefully
Provide fallback to bank transfer
Log all payment attempts (successful or failed)

15. SCALABILITY PLANNING
15.1 Horizontal Scaling Readiness
Design for Scale from Day 1:
Stateless application servers (session in Redis, not memory)
Database read replicas for reporting queries
Load balancer ready (AWS ALB or NGINX)
Background jobs via queue (Bull/BullMQ with Redis)
Why this matters: When you grow from 100 to 10,000 users, you add more servers, not rewrite code.
15.2 Database Scaling
Strategies:
Read Replicas: Send read queries to replicas, writes to primary
Connection Pooling: Reuse database connections (PgBouncer)
Query Optimization: Regular EXPLAIN ANALYZE reviews
Partitioning: Partition large tables by date (future consideration)
15.3 Caching Layers
Multi-Level Caching:
Browser Cache: Static assets (CSS, JS, images)
CDN Cache: Media files, avatars
Redis Cache: Session data, frequently accessed data
Database Query Cache: PostgreSQL built-in caching

16. MAINTENANCE & TECHNICAL DEBT
16.1 Code Reviews
MANDATORY for all code changes:
At least 1 peer review before merging to develop
Review checklist:
TypeScript types correct?
Tests included?
Security considerations addressed?
Performance optimized?
Documentation updated?
16.2 Refactoring Schedule
Regular Refactoring:
Dedicate 20% of sprint time to refactoring
Address technical debt before it compounds
Refactor when adding new features (Boy Scout Rule: leave code better than you found it)
16.3 Dependency Updates
Security Updates:
Weekly security updates (automated via Dependabot)
Monthly minor version updates
Quarterly major version updates (with testing)

APPENDIX: TOOLS & LIBRARIES
Backend Stack
Framework: Node.js with Express.js or NestJS
Language: TypeScript (strict mode)
Database: PostgreSQL 15+ with Knex.js or TypeORM
Caching: Redis
Queue: BullMQ
Validation: Zod or Joi
Testing: Jest + Supertest
Logging: Winston or Pino
Monitoring: Sentry
Frontend Stack
Framework: React 18+ with TypeScript
State Management: Redux Toolkit
Forms: React Hook Form + Zod
Styling: Tailwind CSS (core utility classes only)
Charts: Recharts
Testing: Jest + React Testing Library + Playwright
PWA: Workbox
DevOps
Cloud: AWS (Lagos region)
CI/CD: GitHub Actions or GitLab CI
Containerization: Docker
Orchestration: Kubernetes (future)
Monitoring: CloudWatch + Sentry
CDN: Cloudflare or Bunny CDN

ENFORCEMENT & COMPLIANCE
Code Quality Gates
Pre-Commit Checks (Git Hooks):
Linting (ESLint)
Formatting (Prettier)
Type checking (TypeScript)
Pre-Push Checks:
Unit tests must pass
Pre-Merge Checks (CI):
All tests pass
Code coverage ≥80%
Security scan passes
Build succeeds
If any check fails → Code cannot be merged.

CONCLUSION
These standards are designed to ensure the Salvage Management System is:
✅ Readable: Any developer can understand the codebase
✅ Maintainable: Easy to fix bugs and add features
✅ Scalable: Handles 10x growth without rewrites
✅ Secure: Protects user data and prevents fraud
✅ Performant: Fast response times on mobile networks
✅ Professional: Comparable to Fortune 500 codebases
These are NOT optional guidelines. They are MANDATORY requirements for all code.
When in doubt, ask: "Would Google accept this code?"

Document Approval:
[ ] Technical Lead
[ ] Product Owner
[ ] Security Officer
Effective Date: Immediate
 Review Cycle: Quarterly updates based on industry best practices

