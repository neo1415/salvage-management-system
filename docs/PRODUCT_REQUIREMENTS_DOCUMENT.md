PRODUCT REQUIREMENTS DOCUMENT
Salvage Management System - Enterprise Insurance Platform

Document Version: 2.0
Last Updated: January 21, 2026
Project Status: Pre-Development
Target Launch: March 2026 (8-week development cycle)
Client: NEM Insurance Nigeria
Market Positioning: Nigeria's First Mobile-First Digital Salvage Platform

EXECUTIVE SUMMARY
Product Vision
A mobile-first, AI-enhanced, payment-optimized salvage management platform that revolutionizes how Nigerian insurance companies recover value from damaged assets through instant payments, gamified bidding, vendor trust-building, and Nigerian market psychology-driven design.
Business Objectives 
Reduce salvage processing time by 65% (from 14+ days to <5 days average)
Increase salvage recovery rates by 35-45% (from 22% to 35-40% of claim value)
Achieve 99.5% system uptime for business-critical operations
Generate at least ₦50M+ annual revenue from transaction fees by Year 2
Achieve 70%+ mobile traffic within the first 90 days
Success Metrics 
Operational: Processing time <3 days per case (reduced from 7 days)
Financial: Recovery rate 35-45% of claim value (increased from 30-40%)
Technical: Page load <2s mobile, <1.5s desktop, uptime 99.5%
Mobile Adoption: >70% of vendor traffic from mobile devices
Payment Speed: <10 minutes payment confirmation (reduced from 4 hours)
Vendor Engagement: >40% repeat bidders monthly
User Satisfaction: 4.5+/5 rating across all user roles

PRODUCT SCOPE
In-Scope Features (2-Month MVP)
Core Salvage Workflows (MOBILE-FIRST)
Multi-role user management (5 user types)
Progressive Web App (PWA) for mobile-first experience
Asset discovery with mobile camera upload (photos/videos from accident sites)
Tiered vendor registration (instant BVN approval + full doc verification)
Real-time bidding with gamification (countdown timers, leaderboards, FOMO triggers)
Instant payment via Paystack/Flutterwave + escrow wallet
Multi-level approval workflows with mobile notifications
Comprehensive audit trails with NDPR compliance
Voice-to-text notes for field adjusters
GPS auto-tagging of salvage locations
Offline mode with auto-sync
AI/ML Features (ENHANCED)
Google Cloud Vision API for damage assessment
Basic ML price estimation based on historical data
OCR document scanning (Google Document AI)
Smart vendor matching algorithm
AI fraud detection for suspicious bids (basic pattern matching)
Image compression for mobile data savings (TinyPNG API)
Payment & Trust Features
Paystack/Flutterwave integration for instant card payments (CRITICAL)
Escrow wallet system (vendors pre-fund, released on pickup)
BVN verification API (Mono/Okra) for instant vendor approval (CRITICAL)
SMS OTP authentication (Termii/Africa's Talking)
WhatsApp notifications for critical updates
Auto-payment verification via webhooks (<10 min confirmation)
Gamification & Engagement
Live auction countdown timers (creates urgency/FOMO)
Auto-extend feature (last 5 min bidding extends auction by 2 min)
Vendor leaderboard (top bidders, highest spenders, best pickup times)
Push notifications ("You've been outbid!" alerts)
Vendor ratings & reviews (Uber-style 5-star system)
"Vendors watching" count for social proof
Reporting & Analytics (ENHANCED)
Role-specific mobile dashboards (PWA optimized)
Real-time BI dashboards (not just Excel exports)
WhatsApp-shareable reports (PDF exports optimized for mobile)
SMS/Email/Push notifications (multi-channel strategy)
Recovery rate comparison (vs previous period)
Out-of-Scope Features (Future Roadmap)
Phase 2 (Month 3-6)
Native iOS/Android apps (PWA sufficient for MVP)
Advanced predictive analytics (beyond basic ML)
Custom ML model training
Bulk upload capabilities
API for third-party integrations
Multi-language support (Yoruba, Igbo, Hausa)
Phase 3 (Month 7-12)
IoT GPS tracking for salvage items
Blockchain-based bidding (if required)
Multi-currency support (USD, GBP)
Advanced fraud detection (deep learning models)
Integration with NIID (National Insurance Database)

USER PERSONAS & ROLES
1. Claims Adjuster (PRIMARY MOBILE USER)
Primary Goal: Create salvage cases from accident sites using phone
Pain Points:
Manual data entry on desktop only
Slow approval processes
Can't work offline at accident sites
Need to return to office to upload photos
Key Features:
Mobile camera upload (not desktop drag-drop)
Voice-to-text notes (hands-free at accident scene)
AI damage assessment
Offline mode with auto-sync
GPS auto-tagging of salvage location
Success Criteria: Create a case in <5 minutes from the accident site
2. Salvage Manager
Primary Goal: Maximize recovery value through efficient vendor management
Pain Points:
Limited vendor pool visibility
Manual auction monitoring
Can't approve cases on the go
Key Features:
Mobile approval queue (approve from anywhere)
Real-time auction dashboard (PWA optimized)
Vendor management
Push notifications for urgent approvals
Success Criteria: Approve/reject cases in <12 hours
3. Vendor/Buyer (HIGHEST MOBILE USAGE - 80%+)
Primary Goal: Win quality salvage items at fair prices from anywhere
Pain Points:
Complex registration (CAC docs for informal traders)
Missed bidding opportunities (no mobile alerts)
Don't trust online platforms (CRITICAL)
Key Features:
Instant BVN registration (Tier 1 vendors)
Mobile-optimized auction browsing (PWA)
Push notifications for outbid alerts
Countdown timers for FOMO
Vendor ratings & social proof
Escrow protection badge
Success Criteria:
Complete bid in <1 minute
70%+ of bids placed via mobile
4. Finance Officer (AUTOMATION-FIRST)
Primary Goal: Zero manual payment verification (auto-confirm Paystack)
Pain Points:
Manual payment proof uploads
4-hour verification delays
Payment fraud risks
Key Features:
Paystack webhook auto-verification
Payment verification dashboard (mobile-responsive)
Escrow wallet management
Automated reports
Success Criteria:
Verify payments in <10 minutes
90%+ auto-verified via Paystack
5. System Administrator
Primary Goal: Maintain system security and operational integrity
Pain Points:
Manual user provisioning
Limited audit visibility
No fraud detection tools
Key Features:
User management
System configuration
Fraud detection dashboard
Audit logs
Success Criteria: Provision users in <3 minutes
FUNCTIONAL REQUIREMENTS
FR1: User Authentication & Authorization (MOBILE-FIRST)
FR1.1 - User Registration (ENHANCED)
System SHALL support role-based registration via mobile PWA
System SHALL require SMS OTP verification (not just email)
System SHALL enforce password complexity rules (min 8 chars, 1 uppercase, 1 number, 1 special char)
System MUST support OAuth 2.0 / JWT for session management
System SHALL support "Login with Google/Facebook" for vendors
System SHALL auto-logout after 2 hours inactivity on mobile (security)
FR1.2 - Role-Based Access Control (RBAC)
System SHALL implement 5 distinct user roles: Claims Adjuster, Salvage Manager, Vendor, Finance Officer, Administrator
System SHALL enforce role-specific permissions at module level
System MUST log all permission changes in audit trail
System SHALL support biometric login on mobile (fingerprint/face ID)
Testing Requirements:
Unit tests for password validation logic
Integration tests for role permission enforcement
Security tests for session hijacking prevention
Penetration testing for authentication bypass attempts
Mobile PWA authentication flow testing

FR2: Salvage Case Management (MOBILE-OPTIMIZED)
FR2.1 - Case Creation (ENHANCED FOR FIELD USE)
System SHALL allow Claims Adjusters to create salvage cases from mobile phones
System SHALL auto-populate policy details from claim reference
System SHALL support 3-10 photo uploads via mobile camera (max 5MB each, formats: JPG, PNG, HEIC)
System SHALL trigger AI damage assessment on photo upload
System SHALL support voice-to-text for asset notes (hands-free at accident sites)
System SHALL auto-tag GPS coordinates of salvage location
System SHALL work offline and sync when internet available
System SHALL compress images before upload (TinyPNG API) to save mobile data
FR2.2 - AI Damage Assessment
System SHALL integrate Google Cloud Vision API for image analysis
System SHALL return damage labels within 5 seconds of upload
System SHALL categorize damage as: Minor (40-60% value), Moderate (20-40% value), Severe (5-20% value)
System SHALL allow manual override of AI assessment by Salvage Manager
FR2.3 - Price Estimation
System SHALL calculate estimated salvage value based on:
Market value input
AI damage severity
Historical sales data (if available)
System SHALL suggest reserve price at 70% of estimated value
System MUST allow manual price adjustment by Salvage Manager
Testing Requirements:
Unit tests for price calculation formulas
Integration tests for Google Vision API responses
Mobile camera upload testing
Offline mode sync testing
GPS tagging accuracy testing
Load tests for concurrent image uploads (50+ users)
End-to-end tests for complete case creation workflow
AI accuracy tests comparing manual vs automated assessments (target: 75%+ accuracy)

FR3: Vendor Management (TIERED SYSTEM)
FR3.1 - Vendor Registration (TIERED INSTANT APPROVAL)
System SHALL provide public vendor registration portal (mobile-optimized PWA)
TIER 1 (INSTANT APPROVAL):
System SHALL require ONLY: Phone number + BVN for instant verification
System SHALL integrate BVN verification API (Mono/Okra)
System SHALL auto-approve Tier 1 vendors for bids <₦500k
System SHALL send SMS OTP for registration confirmation
TIER 2 (FULL VERIFICATION):
System SHALL require: Business name, CAC number, TIN, bank details
System SHALL support document uploads (CAC certificate, bank details)
System SHALL allow bids >₦500k after full verification
System SHALL manually approve Tier 2 vendors (Salvage Manager)
System SHALL allow vendor categorization (vehicles, electronics, property, etc.)
System SHALL send email/SMS notification on approval/rejection
FR3.2 - Vendor Approval
System SHALL allow Salvage Managers to approve/reject Tier 2 vendors
System SHALL auto-approve Tier 1 vendors via BVN match
System SHALL send SMS + Email notification on approval/rejection
System SHALL enable vendor categorization (vehicles, electronics, property, etc.)
System MUST prevent unapproved Tier 2 vendors from bidding >₦500k
FR3.3 - Vendor Performance Tracking (GAMIFICATION)
System SHALL track: Total bids, wins, win rate percentage, average payment time
System SHALL flag vendors with >24 hour payment delays
System SHALL allow Manager to suspend vendor accounts
System SHALL display vendor leaderboard (Top 10 bidders monthly)
System SHALL show vendor ratings (5-star system, like Uber)
System SHALL track "pickup on time" rate (vendor reliability metric)
Testing Requirements:
Unit tests for vendor status transitions
Integration tests for email/SMS notification delivery
BVN API integration testing
Tier 1 vs Tier 2 bid limit enforcement testing
Security tests for unauthorized auction access
Performance tests for vendor list queries (1000+ vendors)

FR4: Bidding System (GAMIFIED & MOBILE-OPTIMIZED)
FR4.1 - Auction Creation 
System SHALL auto-create auctions upon salvage case approval
System SHALL set auction duration (default: 5 days, configurable)
System SHALL notify matching vendors via SMS + Email + Push
System SHALL enforce minimum bid (reserve price) and bid increment rules
System SHALL display live countdown timer (hours:minutes:seconds)
System SHALL auto-extend auction by 2 minutes if bid placed in last 5 minutes (prevents sniping)
FR4.2 - Real-Time Bidding (MOBILE-FIRST)
System SHALL update bid displays in real-time (max 2-second latency via WebSockets)
System SHALL support concurrent bidding from multiple vendors
System SHALL validate bid amount > current highest + increment
System SHALL require SMS OTP verification for bid submission
System SHALL send push notification when vendor is outbid
System SHALL show "X vendors watching" count (social proof)
System SHALL display bid history graph (mobile-optimized chart)
FR4.3 - Auction Closure (ENHANCED WITH NOTIFICATIONS)
System SHALL auto-close auctions at end time
System SHALL identify winning bidder
System SHALL generate invoice for winner
System SHALL send SMS + Email + Push notification with payment deadline (24 hours)
System SHALL freeze bid amount in escrow wallet if vendor pre-funded
System SHALL send "auction ending in 1 hour" alert to all bidders
Testing Requirements:
Unit tests for bid validation logic
Integration tests for real-time WebSocket updates
Mobile push notification delivery testing
Countdown timer accuracy testing
Auto-extend logic testing
Load tests for 50+ concurrent bidders
Stress tests for auction closure under high load
Edge case tests: tie bids, last-second bids, network failures
FR5: Payment Processing (INSTANT AUTOMATION)
FR5.1 - Payment Submission (PAYSTACK INTEGRATION)
System SHALL integrate Paystack/Flutterwave for instant card payments
System SHALL support escrow wallet (vendors pre-fund, balance held until pickup)
System SHALL accept payment via bank transfer (legacy option)
System SHALL allow the winner to upload payment proof (receipt, screenshot) - only for bank transfers
System SHALL auto-confirm Paystack payments via webhook (no manual verification)
FR5.2 - Payment Verification (AUTOMATED)
System SHALL auto-verify Paystack payments within <10 minutes via webhook
System SHALL notify the Finance Officer ONLY for bank transfer payments
System SHALL display uploaded payment proof for manual verification (bank transfers only)
System SHALL allow Finance to mark as Verified/Rejected
System SHALL trigger pickup authorization on verification
System SHALL auto-release escrow funds after successful pickup confirmation
FR5.3 - Payment Tracking (REAL-TIME)
System SHALL track payment status: Pending, Verified, Rejected, Overdue
System SHALL auto-flag payments overdue by 24+ hours
System SHALL calculate days to payment for vendor performance metrics
System SHALL send SMS reminders at 12 hours before payment deadline
Testing Requirements:
Paystack webhook integration testing
Escrow wallet balance management testing
Unit tests for payment status transitions
Integration tests for file upload validation
Security tests for payment proof tampering
End-to-end tests for complete payment workflow
Auto-verification vs manual verification flow testing
FR6: Reporting & Analytics (MOBILE-OPTIMIZED)
FR6.1 - Dashboard Views (PWA RESPONSIVE)
System SHALL provide role-specific dashboards:
Adjuster: My cases, pending approvals (mobile-optimized cards)
Manager: Approval queue, active auctions, vendor stats (real-time charts)
Vendor: Watchlist, my bids, wins, leaderboard position
Finance: Pending payments, revenue summary, auto-verified vs manual
Admin: System health, user activity, fraud alerts
System SHALL display real-time KPIs (not just static reports) System SHALL support voice-activated search ("Show me auctions ending today")
FR6.2 - Report Generation (WHATSAPP-SHAREABLE)
System SHALL generate reports:
Salvage recovery summary (monthly/quarterly/annual)
Vendor performance rankings
Auction success rates
Payment aging reports
Recovery rate comparison (vs previous period)
System SHALL export reports to Excel/PDF (mobile-optimized) System SHALL share reports via WhatsApp (direct share button) System SHALL schedule automated email reports
Testing Requirements:
Unit tests for report calculation accuracy
Mobile dashboard rendering testing
WhatsApp share functionality testing
Performance tests for large dataset exports (1000+ records)
Integration tests for scheduled report delivery
Cross-browser tests for dashboard rendering
FR7: Notifications (MULTI-CHANNEL STRATEGY)
FR7.1 - Email Notifications
System SHALL send email on:
User registration confirmation
Case status change (submitted, approved, rejected)
Auction start/end
Bid outbid alerts
Payment reminders
System SHALL use HTML email templates. System SHALL track email delivery status
FR7.2 - SMS Notifications (PRIORITY CHANNEL FOR NIGERIA)
System SHALL send SMS for critical actions:
OTP for bid verification
Auction closing (1 hour before)
Payment deadline reminder (12 hours before)
"You've been outbid!" alerts
Pickup authorization
System SHALL integrate with Termii/Africa's Talking API
FR7.3 - Push Notifications (MOBILE ENGAGEMENT)
System SHALL send PWA push notifications for:
Real-time bid alerts
Auction ending soon (30 min, 5 min warnings)
Payment confirmations
Leaderboard position changes
System SHALL support notification preferences (users can opt out per channel)
FR7.4 - WhatsApp Notifications (FUTURE ROADMAP - Phase 2)
Placeholder for WhatsApp Business API integration
Testing Requirements:
Unit tests for notification trigger logic
Integration tests for email/SMS/push delivery
PWA push notification testing
Load tests for bulk notification sending (100+ recipients)
Fallback tests when notification services fail
FR8: Audit & Compliance (ENHANCED FRAUD DETECTION)
FR8.1 - Audit Trail
System SHALL log all user actions:
Login/logout timestamps
Case creation/updates
Bid placements with IP addresses
Status changes with before/after values
Payment verifications
System SHALL store logs for a minimum of 2 years. System SHALL prevent log modification/deletion
FR8.2 - Compliance Reports
System SHALL generate compliance reports for:
User activity by date range
Case processing timelines
Bid history per auction
Payment verification delays
FR8.3 - Fraud Detection
System SHALL flag suspicious bidding patterns:
Same IP address bidding against itself
Sudden high bids from new vendors
Multiple accounts from same phone number
System SHALL alert Salvage Manager on fraud flags System SHALL auto-suspend vendors with 3+ fraud flags
Testing Requirements:
Unit tests for audit log creation
Fraud detection pattern matching testing
Security tests for log tampering prevention
Performance tests for log query speed (100k+ records)
Compliance validation against NDPR requirements

NON-FUNCTIONAL REQUIREMENTS
NFR1: Performance (MOBILE-FIRST TARGETS)
NFR1.1 - Response Time (TIGHTENED FOR MOBILE)
API responses MUST complete within 500ms (95th percentile)
Mobile page load MUST complete within 2 seconds (median)
Desktop page load MUST complete within 1.5 seconds (median)
Image upload MUST complete within 8 seconds per image
Real-time bid updates MUST have <1 second latency
NFR1.2 - Throughput
System MUST support 200 concurrent users (100 desktop + 100 mobile)
System MUST handle 50 concurrent bids during peak auctions
System MUST process 2,000 photo uploads per day
Testing:
Load testing using k6: 200 concurrent users (70% mobile, 30% desktop), 15-minute duration
Stress testing: Identify breaking point (target: 500+ concurrent users)
Spike testing: Sudden 0-200 user surge
NFR2: Scalability (10X GROWTH READY)
NFR2.1 - Horizontal Scaling
Application servers MUST scale horizontally via Kubernetes
Database MUST support read replicas for reporting queries
File storage MUST use CDN (Cloudflare/Bunny) for media delivery
System SHALL use Redis caching for frequently accessed data
NFR2.2 - Growth Targets
System MUST handle 10x user growth (2,000 users) without redesign
Database MUST support 500,000+ salvage cases
File storage MUST accommodate 5TB+ of media
Testing:
Scalability testing: Gradually increase load to 1,000 users
Database stress testing: Insert 500k records, measure query performance
NFR3: Availability & Reliability
NFR3.1 - Uptime
System MUST maintain 99.5% uptime (max 3.6 hours downtime/month)
Planned maintenance MUST occur during off-peak hours (2-6 AM WAT)
System MUST send uptime alerts to admins if downtime >5 minutes
NFR3.2 - Backup & Recovery
Database backups MUST run daily at 2 AM WAT
Backups MUST be stored in geographically separate location
Recovery Point Objective (RPO): 24 hours
Recovery Time Objective (RTO): 4 hours
Testing:
Disaster recovery testing: Simulate database failure, measure recovery time
Backup restoration testing: Monthly test of backup integrity
NFR4: Security (ENHANCED WITH BVN/BIOMETRIC)
NFR4.1 - Authentication (MOBILE-ENHANCED)
System MUST enforce multi-factor authentication for Admin users
System MUST lock accounts after 5 failed login attempts
System MUST expire sessions after 2 hours inactivity on mobile
System SHALL support biometric authentication (fingerprint/face ID)
System SHALL integrate BVN verification API (Mono/Okra)
NFR4.2 - Data Protection
System MUST encrypt passwords using bcrypt (min 12 rounds)
System MUST encrypt data in transit using TLS 1.3
System MUST encrypt sensitive data at rest (PII, bank details, BVN)
NFR4.3 - Compliance (ENHANCED)
System MUST comply with Nigeria Data Protection Regulation (NDPR)
System MUST provide data export functionality for GDPR-style requests
System MUST support data deletion requests within 30 days
System SHALL mask BVN numbers (show only last 4 digits)
Testing:
Penetration testing: OWASP Top 10 vulnerability scan
Security audits: Quarterly review by external security firm
Compliance validation: NDPR checklist verification
BVN API security testing
NFR5: Usability (MOBILE-FIRST UX)
NFR5.1 - Accessibility
System MUST support screen readers (WCAG 2.1 Level A)
System MUST maintain 4.5:1 color contrast ratio
System MUST be keyboard-navigable
NFR5.2 - Browser Support (MOBILE PRIORITY)
Mobile PWA MUST support:
Chrome 100+
Safari 15+ (iOS)
Samsung Internet
Desktop MUST support:
Chrome 100+
Firefox 100+
Safari 15+
Edge 100+
System MUST be responsive for:
Mobile (375x667, 390x844, 414x896) - PRIMARY
Tablet (1024x768)
Desktop (1920x1080)
NFR5.3 - User Experience (NIGERIAN MARKET-OPTIMIZED)
Critical user flows MUST be completable in <5 clicks
Vendor registration MUST be completable in <3 minutes (Tier 1)
Bid placement MUST be completable in <1 minute
Error messages MUST be actionable and user-friendly (Nigerian English)
Help tooltips MUST be available for complex fields
System SHALL support pidgin English tooltips (optional)
Testing:
Usability testing: 10+ user sessions per role (50% mobile, 50% desktop)
Accessibility testing: axe DevTools automated scan
Mobile UX testing: Real device testing (iPhone 13, Samsung Galaxy S21, Tecno Spark)
Cross-browser testing: BrowserStack for all supported browsers
TECHNICAL ARCHITECTURE
System Components
Frontend (MOBILE-FIRST)
Framework: NextJs with TypeScript
PWA Framework: Workbox for offline caching + service workers
State Management: Redux Toolkit
UI Library: Tailwind CSS (core utility classes only)
Charts: Recharts
File Upload: React Dropzone + mobile camera API
Voice-to-text: Web Speech API
Push Notifications: PWA Push API
Backend
Framework: Node.js with Express.js
API: RESTful with OpenAPI 3.0 documentation
Real-time: WebSockets (Socket.io) for bidding
Authentication: JWT + OAuth 2.0 + BVN verification
Escrow Wallet: PostgreSQL + Redis (balance caching)
Database
Primary: PostgreSQL 15+
Caching: Redis for session management + auction countdown caching
Object Storage: AWS S3 / Cloudinary for media
Read Replicas for reporting queries
Third-Party Integrations
Google Cloud Vision API (damage assessment)
Google Document AI (OCR)
Termii / Africa's Talking (SMS + OTP)
SendGrid (Email)
Paystack / Flutterwave (payments) — CRITICAL
Mono / Okra (BVN verification) — CRITICAL
TinyPNG API (image compression for mobile)
Cloudflare Bot Protection (fraud prevention)
Hosting & Infrastructure
Cloud Provider: AWS (Lagos region) for low latency
Compute: EC2 / ECS for application servers
Load Balancer: AWS ALB
CDN: Cloudflare / Bunny CDN for static assets + images
Monitoring: CloudWatch + Sentry for error tracking
Kubernetes (future scalability)

DATA MODEL (KEY ENTITIES)
Users Table
- id (UUID, PK)
- email (unique, indexed)
- phone (unique, indexed)
- password_hash
- role (enum: adjuster, manager, vendor, finance, admin)
- status (enum: active, suspended, deleted)
- created_at, updated_at
- last_login_at
- login_device_type (enum: mobile, desktop, tablet)

Salvage Cases Table
- id (UUID, PK)
- claim_reference (indexed)
- asset_type (enum: vehicle, property, electronics)
- asset_details (JSON: make, model, year, VIN)
- market_value (decimal)
- estimated_salvage_value (decimal)
- damage_severity (enum: minor, moderate, severe)
- ai_assessment (JSON: labels, confidence scores)
- gps_location (point)
- status (enum: draft, pending_approval, approved, active, sold, cancelled)
- created_by (FK: Users)
- approved_by (FK: Users, nullable)
- created_at, updated_at, approved_at

Vendors Table
- id (UUID, PK)
- user_id (FK: Users)
- business_name
- tier (enum: tier1_bvn, tier2_full)
- bvn (encrypted, nullable)
- bvn_verified_at (nullable)
- cac_number (nullable)
- tin (nullable)
- categories (array: vehicles, electronics, etc.)
- status (enum: pending, approved, suspended)
- performance_stats (JSON: win_rate, avg_payment_time, pickup_on_time_rate)
- rating (decimal 0-5)
- approved_by (FK: Users, nullable)
- created_at, updated_at

Payments Table
- id (UUID, PK)
- auction_id (FK: Auctions)
- vendor_id (FK: Vendors)
- amount (decimal)
- payment_method (enum: paystack, flutterwave, bank_transfer, escrow)
- payment_reference (nullable)
- payment_proof_url (S3 URL, nullable)
- escrow_status (enum: none, frozen, released)
- status (enum: pending, verified, rejected)
- verified_by (FK: Users, nullable)
- verified_at (nullable)
- auto_verified (boolean)
- created_at, updated_at

INTEGRATION SPECIFICATIONS
Paystack/Flutterwave Integration (CRITICAL)
Payment Flow:
Vendor clicks "Pay Now" → System generates payment link
Vendor completes payment via Paystack/Flutterwave
Webhook auto-confirms payment within <10 minutes
System auto-releases pickup authorization
Webhook Endpoint: /api/webhooks/payment-confirmation
Security:
Verify webhook signature
Validate payment reference
Double-check amount matches invoice
BVN Verification Integration (CRITICAL)
Provider: Mono/Okra API
Flow:
Tier 1 vendor enters phone + BVN
System calls BVN verification API
Auto-approve if match successful
Send SMS OTP for final confirmation
Endpoint: POST /api/vendors/verify-bvn



NIGERIAN MARKET PSYCHOLOGY INTEGRATION
Based on research from "How to Sell to Nigerians" and market analysis:
1. Trust & Credibility Factors (BUILT INTO SYSTEM)
Vendor ratings (social proof - "Nigerians buy from those they trust")
"X vendors watching" count (social proof)
Escrow protection badge (reduces fear of scams)
BVN verification (instant trust)
Mobile-first (Nigerians are mobile-first users)
2. Urgency & FOMO (GAMIFICATION)
Countdown timers (creates urgency)
Auto-extend (prevents sniping, keeps tension high)
"You've been outbid!" alerts (triggers competitive instinct)
Leaderboards (status/ego appeal)
3. Simplicity & Accessibility (SACHETIZATION)
Tiered registration (Tier 1 = instant for small traders)
Voice-to-text (for low-literacy users)
Offline mode (for poor connectivity areas)
SMS notifications (Nigerians check SMS more than email)
4. Payment Psychology
Instant payments (Nigerians love speed - "credit alert")
Escrow wallet (pre-funding shows commitment)
Multiple payment options (Paystack, bank transfer, escrow)

IMPLEMENTATION TIMELINE (8-WEEK SPRINT)
Week 1-2: Foundation & Mobile Core
PWA setup (Workbox, service workers)
Mobile-responsive UI (Tailwind CSS)
User authentication (JWT + OAuth + biometric)
Mobile camera upload
Voice-to-text integration
Offline mode implementation
Week 3-4: Core Features & Payments
Salvage case creation (mobile-optimized)
AI damage assessment (Google Vision)
Paystack/Flutterwave integration
BVN verification (Mono/Okra)
Tiered vendor registration
SMS/Email notifications (Termii/SendGrid)
Week 5-6: Bidding & Gamification
Real-time bidding (WebSockets)
Countdown timers
Auto-extend logic
Push notifications
Vendor leaderboards
Ratings & reviews
Week 7-8: Polish & Launch
Escrow wallet system
Fraud detection (basic)
Mobile dashboards (PWA)
WhatsApp sharing
Testing (mobile devices, load, security)
Beta launch (20 vendors)

RISKS & MITIGATION
Technical Risks
Risk
Impact
Probability
Mitigation
Paystack/Flutterwave downtime
High
Low
Fallback to manual bank transfer; queue payments for retry
BVN API rate limits
Medium
Medium
Cache verified BVNs; implement retry logic
Mobile network instability
High
High
Offline mode with sync; compress images; use SMS fallback
Real-time bidding at scale
High
Medium
Load test 100+ concurrent bidders; horizontal scaling with WebSockets

Business Risks (NIGERIA-SPECIFIC)
Risk
Impact
Probability
Mitigation
Vendor fraud (fake BVNs)
High
Medium
BVN verification API; fraud detection; manual review for Tier 2
Low mobile data adoption
Medium
Low
Image compression; offline mode; SMS-heavy communication
Payment defaults
High
Medium
Escrow wallet; 24-hour payment deadline; auto-suspension after 3 defaults
Informal traders resistance
Medium
Medium
Tier 1 BVN-only registration; pidgin English support; WhatsApp onboarding


SUCCESS METRICS DASHBOARD (KPIs TO TRACK)
Week 1-4 (MVP Launch)
50+ Tier 1 vendors registered via BVN
70%+ mobile traffic from vendor users
<3 min average case creation time (mobile)
<10 min payment verification (Paystack)
Month 2-3 (Growth Phase)
200+ salvage cases processed
35%+ recovery rate (vs 22% baseline)
<3 days average processing time (vs 14+ days)
40%+ repeat bidders monthly
Month 4-6 (Scale Phase)
500+ active vendors (100 Tier 2, 400 Tier 1)
₦10M+ transaction volume monthly
99.5%+ uptime
4.5+/5 user satisfaction rating

APPENDICES
Appendix A: Nigerian Market Research Sources
"How to Sell to Nigerians" - Akin Alabi (2021)
"Building a StoryBrand" - Donald Miller (2017)
Podcast: "Totally on Brand" - Nigerian Consumer Psychology (2021)
NEM Insurance internal data (2020-2025)
Appendix B: Competitive Analysis
Platform
Strengths
Market Gap
Mitchell SalvageWorks (US)
AI assessment, mobile app, 80% accuracy
N/A
IAA (US)
96% buyer satisfaction, mobile-first
N/A
Salvage Sale (UK)
48-hour payment cycles
N/A
Nigerian Market
NO dedicated salvage platforms
Manual phone/physical auctions only

Appendix C: Payment Gateway Comparison
Feature
Paystack
Flutterwave
Nigerian market share
40%
35%
Webhook reliability
99.9%
99.7%
Transaction fee
1.5% + ₦100
1.4% + ₦100
Settlement time
T+1
T+1
Recommendation
Primary
Backup


CONCLUSION
This GOLD STANDARD PRD transforms the original salvage management system into a mobile-first, payment-optimized, trust-driven platform specifically designed for the Nigerian market.
Key Enhancements:
✅ 70%+ mobile traffic target (vs 0% in original)
✅ <10 min payment verification (vs 4 hours)
✅ Instant BVN approval for informal traders
✅ Gamification (leaderboards, countdowns, FOMO)
✅ Nigerian psychology (trust, urgency, simplicity)
Expected Outcomes:
2X faster case processing (3 days vs 7 days)
2X higher recovery rates (35-45% vs 22%)
5X more vendors (50 vs 10 in first 3 months)
₦50M+ annual revenue by Year 2

DOCUMENT APPROVAL
Role
Name
Signature
Date
Product Owner
[NEM Insurance]
_________
_____
Technical Lead
_________
_________
_____
UX/Mobile Lead
_________
_________
_____


END OF PRD

