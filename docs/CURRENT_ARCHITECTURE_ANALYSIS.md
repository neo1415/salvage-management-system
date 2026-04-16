# NEM Salvage Management System - Current Architecture Analysis
**Prepared for Multi-Tenancy SaaS Transformation Consultation**  
**Date:** April 2, 2026

---

## Executive Summary

This document provides a comprehensive analysis of the NEM Salvage Management System's current architecture, features, strengths, weaknesses, and readiness for multi-tenancy transformation. It is intended for external consultation to obtain expert recommendations on the feasibility and approach for converting this single-tenant application into a multi-tenant SaaS platform.

**Current State:** Production-ready, single-tenant salvage auction platform serving NEM Insurance Nigeria  
**Target State:** Multi-tenant SaaS platform serving multiple insurance companies internationally  
**Timeline Goal:** Complete transformation within weeks of current launch to enable rapid SaaS deployment

---

## 1. Application Overview

### What It Does
NEM Salvage Management System is a mobile-first, AI-enhanced platform that manages the complete lifecycle of salvage auctions for damaged assets (vehicles, property, electronics, machinery). It enables:

- **Claims Adjusters** to create salvage cases with photos, voice notes, and GPS location
- **AI-powered damage assessment** using Google Gemini 2.5 Flash with automatic valuation
- **Salvage Managers** to approve cases, override prices, and create auctions
- **Vendors** to bid in real-time auctions with automatic extension logic
- **Finance Officers** to verify payments and manage escrow
- **System Admins** to monitor fraud, manage users, and generate reports

### Business Model (Current)
Single insurance company (NEM Insurance) using the platform internally to liquidate salvaged assets through vendor auctions.

### Business Model (Target)
Multi-tenant SaaS with two potential revenue models under consideration:
1. **Subscription-based:** Monthly/annual fees per organization
2. **Revenue share:** Percentage of salvage value recovered per transaction

---

## 2. Technology Stack

### Frontend
- **Framework:** Next.js 15 (App Router) with React 19.2
- **Language:** TypeScript 5.3+ (strict mode)
- **Styling:** Tailwind CSS 3.4 with custom design system
- **State Management:** Zustand (global), React Query (server state), React Hook Form (forms)
- **UI Components:** Custom components with Lucide React icons, Framer Motion animations
- **PWA:** Service Workers with Workbox for offline capability

### Backend
- **Runtime:** Node.js with custom HTTP server (server.ts)
- **API:** Next.js API Routes (App Router)
- **Real-time:** Socket.io 4.8.3 for bidding and auction updates
- **Authentication:** NextAuth.js v5 with JWT tokens

### Database & Caching
- **Database:** PostgreSQL (Supabase) with Drizzle ORM 0.45
- **Connection Pooling:** 200 connections (production), 20 (dev), 10 (test)
- **Caching:** Vercel KV (Redis) for sessions, rate limiting, and data caching
- **Cache Strategy:** TTL-based (15 min profiles, 5 min auctions, 10 min vendors)

### External Integrations
| Service | Purpose | Cost Model |
|---------|---------|------------|
| Google Gemini 2.5 Flash | AI damage detection | Free tier: 10 req/min, 1500/day |
| Google Vision API | Fallback damage detection | Pay-per-use |
| Dojah | KYC verification (NIN, BVN, AML, CAC) | Pay-per-verification |
| Paystack & Flutterwave | Payment processing | Transaction fees |
| Termii & Africa's Talking | SMS delivery | Pay-per-SMS |
| Resend | Email delivery | Pay-per-email |
| Cloudinary | File storage & CDN | Storage + bandwidth |
| Vercel KV | Redis caching | Storage + operations |

### Deployment
- **Platform:** Vercel (Next.js optimized)
- **Database:** Supabase (managed PostgreSQL)
- **CDN:** Cloudinary for media, Vercel Edge Network for static assets
- **Docker:** Multi-stage build support for alternative deployment

---

## 3. Core Features & Functionality

### 3.1 Case Management
- Create salvage cases with photos (up to 5MB each), voice notes, GPS location
- AI-powered damage assessment across 5 categories (structural, mechanical, cosmetic, electrical, interior)
- Damage severity classification (minor/moderate/severe)
- Total loss determination and repair cost estimation
- Manager price overrides with audit trail
- Offline case creation with sync capability (PWA)

### 3.2 Auction System
- Real-time bidding with Socket.io WebSocket connections
- Auto-extension when bids placed in final 5 minutes
- Minimum bid increments (₦20,000 configurable)
- Auction watching/unwatching with live viewer count
- Automatic closure at end time with document generation
- Vendor notifications (outbid alerts, winning notifications)

### 3.3 Payment Processing
- Paystack & Flutterwave integration with inline popup
- 24-hour payment deadline after winning bid
- Auto-verification via webhook (idempotent with row-level locking)
- Escrow wallet system with freeze/release
- Bank transfer proof uploads with manual verification
- Pickup authorization codes (6-digit OTP)

### 3.4 KYC & Vendor Management
- **Tier 1:** BVN verification (basic access)
- **Tier 2:** Full KYC (NIN, photo ID, biometrics, address proof, AML screening, CAC)
- Dojah integration for automated verification
- Fraud risk scoring with auto-suspension thresholds
- Vendor performance tracking (win rate, payment time, pickup rate)
- Vendor leaderboard with rankings

### 3.5 Fraud Detection & Compliance
- Bidding pattern analysis (rapid bidding, bid sniping detection)
- AML screening via Dojah
- Fraud flags with configurable auto-suspension
- Comprehensive audit trail (25+ action types)
- Before/after state tracking for all critical operations

### 3.6 Notifications
- Push notifications (Web Push API)
- SMS (Termii with Africa's Talking fallback)
- Email (Resend)
- Notification types: outbid alerts, auction ending, payment reminders, KYC status

### 3.7 Reporting & Analytics
- Vendor rankings/leaderboard
- Payment aging reports
- Escrow performance reports
- Recovery summary reports
- Bid history export
- Fraud alert dashboard

---

## 4. Database Schema & Data Models

### Core Tables (15 primary tables)

**users** - User accounts
- Fields: id, email, phone, role, status, passwordHash, fullName, dateOfBirth, profilePictureUrl, notificationPreferences
- Roles: vendor, claims_adjuster, salvage_manager, finance_officer, system_admin
- Status: unverified_tier_0, phone_verified_tier_0, verified_tier_1, verified_tier_2, suspended, deleted

**vendors** - Vendor profiles
- Fields: userId, businessName, tier, bvnEncrypted, categories, performanceStats, rating
- Tier 2 KYC: ninEncrypted, photoIdUrl, selfieUrl, addressProofUrl, amlScreeningData
- Performance: totalBids, totalWins, winRate, avgPaymentTimeHours, onTimePickupRate, fraudFlags

**salvage_cases** - Salvage items
- Fields: claimReference, assetType, assetDetails, marketValue, estimatedSalvageValue, reservePrice
- AI Assessment: damageSeverity, aiAssessment (JSON with detailed analysis)
- Media: photos (array), voiceNotes (array), gpsLocation (point)
- Status: draft, pending_approval, approved, active_auction, sold, cancelled

**auctions** - Auction listings
- Fields: caseId, startTime, endTime, originalEndTime, extensionCount
- Bidding: currentBid, currentBidder, minimumIncrement, watchingCount
- Status: scheduled, active, extended, closed, cancelled, forfeited
- Pickup: pickupConfirmedVendor, pickupConfirmedAdmin, pickupConfirmedAdminBy

**bids** - Bid history
- Fields: auctionId, vendorId, amount, timestamp, otpVerified

**payments** - Payment records
- Fields: auctionId, vendorId, amount, paymentMethod, paymentReference, paymentProofUrl
- Status: pending, verified, rejected, overdue
- Escrow: escrowStatus (none, frozen, released)
- Verification: verifiedBy, verifiedAt, autoVerified, paymentDeadline

**notifications** - User notifications
- Fields: userId, type, content, read, createdAt

**audit_logs** - Audit trail
- Fields: userId, actionType, entityType, entityId, beforeState, afterState, ipAddress, deviceType

**ratings** - Vendor ratings
- Fields: auctionId, vendorId, rating, comment, createdAt

**release_forms** - Pickup authorization
- Fields: auctionId, vendorId, authorizationCode, signedAt, signedBy

### Indexes
- Composite: (tier, status), (status, end_time) for auctions
- Single: email, phone, role, status, rating, created_at
- GIN: notification_preferences (JSONB)

### **CRITICAL OBSERVATION:** No organization/tenant concept exists in current schema

---

## 5. Authentication & Authorization

### Authentication Flow
1. User registers with email/phone + password (bcryptjs hashing)
2. OTP verification via SMS (5-minute expiry)
3. NextAuth JWT token issued with device-specific TTL
4. Token stored in secure HTTP-only cookie
5. Middleware validates token on protected routes

### Authorization (RBAC)
- 5 roles with distinct permissions
- Role-based route protection via Next.js middleware
- Per-endpoint role checks in API routes
- Audit logging for all sensitive actions

### Session Management
- **Mobile:** 2-hour TTL (frequent re-auth for security)
- **Desktop:** 24-hour TTL
- Redis-backed session cache
- Account lockout: 5 failed attempts → 30-minute lock

### Security Measures
- Password hashing with bcryptjs (10 rounds)
- Rate limiting: 200 req/min (general), 20 req/min (bidding)
- CSRF protection via NextAuth
- CSP headers with Paystack/Flutterwave allowlist
- X-Frame-Options: DENY
- HSTS enabled (31536000s)
- NIN/BVN encryption at rest
- Sensitive data never logged

---

## 6. Real-Time Architecture (Socket.io)

### Event Types
**Server → Client:**
- `auction:updated` - Auction data changes
- `auction:new-bid` - New bid placed
- `auction:extended` - Auction time extended
- `auction:closed` - Auction ended
- `auction:watching-count` - Viewer count update
- `vendor:outbid` - Vendor outbid notification
- `vendor:won` - Vendor won notification
- `notification:new` - System notification

**Client → Server:**
- `auction:watch` / `auction:unwatch` - Track auction viewers
- `bid:place` - Place bid with OTP verification
- `subscribe:auctions` / `unsubscribe:auctions` - Subscribe to auction updates

### Room Architecture
- User-specific: `user:{userId}`
- Vendor-specific: `vendor:{vendorId}`
- Auction-specific: `auction:{auctionId}`
- Global: `auctions:all`, `auctions:type:{assetType}`

### Scalability Considerations
- **Current:** Single server instance
- **Ready for:** Redis adapter for horizontal scaling (commented out in code)
- Connection limits: 1MB max message, 45s connection timeout
- Ping/pong: 25s interval, 60s timeout

### **CRITICAL OBSERVATION:** Socket.io rooms not tenant-aware (no organization context)

---

## 7. File Storage & Media Handling

### Cloudinary Integration
- **Folder structure:** `salvage-cases/{caseId}`, `kyc-documents/{vendorId}`, `profile-pictures/{role}/{userId}`
- **Transformation presets:** thumbnail (200x200), medium (800x600), large (1920x1080), compressed
- **Compression:** TinyPNG before upload, client-side canvas compression
- **Security:** Signed upload URLs for client-side uploads
- **Validation:** Max 5MB per image, allowed types (JPEG, PNG, HEIC, PDF)

### Image Optimization
- Client-side compression in browser (canvas API)
- Quality reduction: 0.85 → 0.5 iteratively
- Max dimensions: 1920x1920
- Aspect ratio preservation
- Base64 encoding for upload

### **CRITICAL OBSERVATION:** File storage not organized by tenant (no organization folder structure)

---

## 8. Performance Optimization

### Database
- Connection pooling (200 connections in production)
- Prepared statements enabled
- Composite indexes on frequently queried columns
- Query retry logic with exponential backoff
- Idle timeout: 20s, Max lifetime: 10 minutes

### Caching Strategy
- User profiles: 15 min TTL
- Auction data: 5 min TTL
- Vendor data: 10 min TTL
- Session cache: device-specific TTL
- Cache invalidation on data mutations

### Frontend
- Dynamic imports with code splitting
- Image optimization (WebP, AVIF formats)
- Lazy loading components
- Skeleton loaders for perceived performance
- Bundle optimization (tree-shaking)

### API
- Rate limiting per IP/user
- Compression enabled
- Efficient pagination
- Selective field queries

---

## 9. Current Multi-User Support

### Role-Based Access Control

| Role | Permissions | Data Access |
|------|-------------|-------------|
| **Vendor** | Bid on auctions, view own cases, manage profile, track payments | Own bids, payments, auctions watched |
| **Claims Adjuster** | Create cases, upload photos, view case details | Cases they created |
| **Salvage Manager** | Approve cases, override prices, manage auctions | All cases (no region filter) |
| **Finance Officer** | Verify payments, manage escrow, generate reports | All payments |
| **System Admin** | User management, fraud monitoring, system configuration | All data |

### Current Isolation Mechanisms
- Role-based route protection (middleware)
- Per-endpoint authorization checks
- User can only see own data (vendor sees own bids/payments)
- Manager sees all cases (no region/organization field)
- Admin sees all data

### **CRITICAL LIMITATION:** Single-tenant architecture
- No organization/company field in schema
- No data isolation at database level
- All users share same database
- No tenant-specific configurations
- No multi-organization support
- No concept of "switching organizations"

---

## 10. Strengths (Scalability Readiness)

### ✅ Well-Architected Foundation
1. **Clean separation of concerns** - Feature-based modules, clear boundaries
2. **Stateless API design** - JWT tokens, no server-side session state
3. **Horizontal scaling ready** - Connection pooling, Redis caching, Socket.io adapter support
4. **Modern tech stack** - Next.js 15, React 19, TypeScript, Drizzle ORM
5. **Comprehensive audit trail** - All actions logged with before/after state

### ✅ Performance Optimizations
1. **Database connection pooling** - 200 connections, efficient resource usage
2. **Redis caching** - Reduces database load, fast data retrieval
3. **CDN integration** - Cloudinary for media, Vercel Edge for static assets
4. **Image compression** - TinyPNG + client-side compression
5. **Rate limiting** - Prevents abuse, protects resources

### ✅ Security Best Practices
1. **Password hashing** - bcryptjs with 10 rounds
2. **Encryption at rest** - NIN/BVN encrypted
3. **HTTPS enforced** - HSTS enabled
4. **CSRF protection** - NextAuth built-in
5. **Audit logging** - Comprehensive trail for compliance

### ✅ Real-Time Capabilities
1. **Socket.io implementation** - Production-ready real-time bidding
2. **Room-based architecture** - Efficient message routing
3. **Redis adapter ready** - Commented out, easy to enable for multi-server
4. **Graceful degradation** - Polling fallback if WebSocket fails

### ✅ Mobile-First Design
1. **PWA support** - Service Workers, offline capability
2. **Responsive design** - 375px - 1920px
3. **Image optimization** - WebP, AVIF, compression
4. **Mobile-specific session TTL** - 2 hours for security

---

## 11. Weaknesses (Multi-Tenancy Blockers)

### ❌ Single-Tenant Architecture
1. **No organization concept** - No `organization_id` field in any table
2. **No tenant context** - Queries don't filter by organization
3. **Shared data** - All users see same data pool (filtered by role only)
4. **No tenant-specific configurations** - Single configuration for all users

### ❌ Data Isolation Gaps
1. **No row-level security** - PostgreSQL RLS not implemented
2. **Application-layer filtering only** - Relies on code, not database constraints
3. **Cross-tenant access possible** - If application logic fails, data leaks
4. **No tenant validation** - No middleware to inject organization context

### ❌ Caching Not Tenant-Aware
1. **Shared cache keys** - No organization prefix in Redis keys
2. **Cross-tenant cache pollution** - One tenant's data could be served to another
3. **Cache invalidation** - No tenant-specific invalidation

### ❌ Socket.io Not Tenant-Aware
1. **Room names lack organization context** - `auction:{auctionId}` instead of `org:{orgId}:auction:{auctionId}`
2. **Cross-tenant real-time updates possible** - If room names collide
3. **No organization validation on connection** - Any authenticated user can join any room

### ❌ File Storage Not Tenant-Aware
1. **Folder structure lacks organization** - `salvage-cases/{caseId}` instead of `org/{orgId}/salvage-cases/{caseId}`
2. **No access control on file downloads** - If URL is known, file is accessible
3. **Cross-tenant file access possible** - No validation of organization ownership

### ❌ Reporting & Analytics
1. **No organization filters** - Reports show all data
2. **No tenant-specific dashboards** - Single dashboard for all users
3. **No per-organization metrics** - Can't track usage per tenant

### ❌ Billing & Licensing
1. **No subscription concept** - No billing integration
2. **No feature flags** - Can't enable/disable features per tenant
3. **No usage tracking** - Can't measure per-organization consumption

---

## 12. Scalability Bottlenecks

### Database
- **Connection pool exhaustion** - 200 connections shared across all tenants
- **Query performance** - No tenant-specific indexes
- **Lock contention** - Row-level locking on shared tables

### Caching
- **Cache key collisions** - No tenant prefix
- **Memory usage** - All tenants share same Redis instance
- **Eviction policy** - No tenant-specific TTL

### Real-Time
- **Socket.io memory** - All connections in single process
- **Room management** - No tenant-specific room limits
- **Message broadcasting** - No tenant-specific rate limits

### File Storage
- **Cloudinary bandwidth** - All tenants share same account
- **Storage limits** - No per-tenant quotas
- **CDN costs** - No tenant-specific cost tracking

---

## 13. International Expansion Considerations

### Current Limitations
1. **Single region deployment** - Vercel (likely US or EU)
2. **No data residency controls** - All data in one region
3. **No multi-region support** - Single database instance
4. **No CDN edge caching** - Cloudinary CDN only

### Compliance Gaps
1. **GDPR** - No data residency controls for EU users
2. **CCPA** - No California-specific data handling
3. **LGPD** - No Brazil-specific compliance
4. **Data localization** - No country-specific storage

### Performance Issues
1. **Latency** - Users far from server experience high latency
2. **No edge computing** - All API calls go to origin server
3. **No regional failover** - Single point of failure

---

## 14. Estimated Transformation Effort

### Phase 1: Database Schema (2-3 days)
- Add `organizations` table (id, name, tier, settings, createdAt)
- Add `organization_id` (UUID) to all tables
- Create tenant-specific indexes
- Implement PostgreSQL Row-Level Security (RLS) policies
- Migration scripts for existing data

### Phase 2: Middleware & Isolation (3-4 days)
- Create organization context middleware
- Add `organizationId` to JWT token
- Validate organization membership on every request
- Implement tenant filter injection
- Add cross-tenant access prevention

### Phase 3: API Updates (5-7 days)
- Add organization context to all endpoints
- Validate tenant ownership before operations
- Update all queries to include `organization_id` filter
- Implement tenant-specific rate limits
- Add tenant-specific configurations

### Phase 4: Socket.io Updates (2-3 days)
- Add organization to room names
- Validate organization membership on connection
- Prevent cross-tenant real-time updates
- Update event handlers for tenant context

### Phase 5: Caching Updates (1-2 days)
- Prefix cache keys with organization ID
- Implement tenant-specific cache invalidation
- Separate cache namespaces per tenant

### Phase 6: File Storage Updates (2-3 days)
- Organize Cloudinary folders by organization
- Implement access control for file downloads
- Prevent cross-tenant file access
- Update upload/download logic

### Phase 7: Reporting & Analytics (2-3 days)
- Add organization filters to all reports
- Implement tenant-specific dashboards
- Separate metrics per organization

### Phase 8: Billing & Licensing (3-5 days)
- Add subscription tier per organization
- Implement feature flags per tier
- Usage tracking per organization
- Billing integration (Stripe/Paddle)

### Phase 9: Testing & Validation (3-4 days)
- Unit tests for tenant isolation
- Integration tests for cross-tenant access prevention
- Load testing for multi-tenant performance
- Security audit

### **Total Estimated Effort: 3-4 weeks** for basic multi-tenancy

---

## 15. Risk Assessment

### High Risk
1. **Data leakage** - Cross-tenant data access if isolation fails
2. **Performance degradation** - Shared resources under load
3. **Migration complexity** - Existing data needs organization assignment
4. **Compliance violations** - GDPR, CCPA if data residency not handled

### Medium Risk
1. **Cache key collisions** - If tenant prefixing not implemented correctly
2. **Socket.io room collisions** - If organization context not added
3. **File access control** - If Cloudinary access not validated
4. **Billing errors** - If usage tracking not accurate

### Low Risk
1. **Authentication** - NextAuth supports multi-tenancy well
2. **Database performance** - PostgreSQL RLS is production-ready
3. **API structure** - Clean separation makes updates easier
4. **Frontend** - React components can be tenant-aware

---

## 16. Questions for External Consultation

### Architecture
1. Should we use PostgreSQL RLS (Row-Level Security) or schema-per-tenant?
2. Is Vercel suitable for multi-region deployment, or should we consider AWS/GCP?
3. How should we handle Socket.io scaling across multiple regions?
4. Should we use a separate database per tenant for enterprise customers?

### Pricing Model
1. Subscription vs revenue share - which is more sustainable for salvage auctions?
2. How should we tier pricing (by users, by auction volume, by features)?
3. Should we offer a freemium tier for small insurance companies?
4. How do we handle international pricing (currency, payment methods)?

### Compliance
1. What data residency requirements exist for insurance data in different countries?
2. How do we handle GDPR, CCPA, LGPD compliance across regions?
3. What certifications do we need (SOC2, ISO 27001, HIPAA)?
4. How do we handle data deletion requests (GDPR right to be forgotten)?

### Scaling
1. What's the most cost-effective way to scale Socket.io for real-time bidding?
2. Should we use edge computing for API routes, or keep everything in origin?
3. How do we handle database connection pooling across multiple tenants?
4. What's the best CDN strategy for international media delivery?

### Migration
1. How do we migrate existing NEM Insurance data to the first tenant?
2. Should we run single-tenant and multi-tenant versions in parallel?
3. What's the rollback strategy if multi-tenancy fails?
4. How do we test multi-tenancy without production data?

---

## 17. Conclusion

The NEM Salvage Management System is a **well-architected, production-ready application** with strong foundations for multi-tenancy transformation. The codebase demonstrates best practices in security, performance, and real-time capabilities.

**Key Strengths:**
- Clean architecture with clear separation of concerns
- Comprehensive audit trail and security measures
- Real-time bidding with Socket.io
- AI-powered damage assessment
- Mobile-first PWA design

**Key Challenges:**
- No organization concept in current schema
- No data isolation at database level
- Caching, Socket.io, and file storage not tenant-aware
- No billing or licensing infrastructure
- No multi-region support

**Feasibility Assessment:**
Multi-tenancy transformation is **highly feasible** with an estimated **3-4 weeks** of focused development. The application's clean architecture and modern tech stack make it well-suited for this evolution. However, careful planning is required for:
- Data isolation strategy (RLS vs schema-per-tenant)
- International compliance (GDPR, data residency)
- Pricing model (subscription vs revenue share)
- Scaling strategy (single-region vs multi-region)

**Recommendation:**
Proceed with multi-tenancy transformation, but invest time upfront in architectural decisions (database isolation, multi-region strategy, pricing model) to avoid costly refactoring later. Consider a phased rollout: basic multi-tenancy first, then international expansion, then advanced features (custom domains, white-labeling).

---

**Document prepared by:** Kiro AI Assistant  
**For:** External consultation on multi-tenancy SaaS transformation  
**Next Steps:** Review with external consultants, finalize architecture decisions, create detailed implementation spec
