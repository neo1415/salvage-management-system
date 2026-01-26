# Requirements Document

## Introduction

The Salvage Management System is a mobile-first, AI-enhanced, payment-optimized salvage management platform for NEM Insurance Nigeria. This system revolutionizes how Nigerian insurance companies recover value from damaged assets through instant payments, gamified bidding, vendor trust-building, and Nigerian market psychology-driven design.

### Business Objectives

- Reduce salvage processing time by 65% (from 14+ days to <5 days average)
- Increase salvage recovery rates by 35-45% (from 22% to 35-40% of claim value)
- Achieve 99.5% system uptime for business-critical operations
- Generate at least ₦50M+ annual revenue from transaction fees by Year 2
- Achieve 70%+ mobile traffic within the first 90 days

### Success Metrics

- **Operational**: Processing time <3 days per case (reduced from 7 days)
- **Financial**: Recovery rate 35-45% of claim value (increased from 30-40%)
- **Technical**: Page load <2s mobile, <1.5s desktop, uptime 99.5%
- **Mobile Adoption**: >70% of vendor traffic from mobile devices
- **Payment Speed**: <10 minutes payment confirmation (reduced from 4 hours)
- **Vendor Engagement**: >40% repeat bidders monthly
- **User Satisfaction**: 4.5+/5 rating across all user roles

## Glossary

- **System**: The Salvage Management System platform
- **Claims_Adjuster**: Insurance staff who create salvage cases from accident sites
- **Salvage_Manager**: Insurance staff who approve cases and manage vendors
- **Vendor**: External buyers who bid on salvage items (Tier 1 or Tier 2)
- **Finance_Officer**: Insurance staff who verify payments
- **System_Administrator**: Technical staff who manage system configuration
- **PWA**: Progressive Web App - mobile-first web application with offline capabilities
- **BVN**: Bank Verification Number - Nigerian national identity number for banking
- **NIN**: National Identification Number - Nigerian national ID
- **CAC**: Corporate Affairs Commission - Nigerian business registration authority
- **TIN**: Tax Identification Number
- **Tier_1_Vendor**: Vendor verified via BVN only, can bid up to ₦500k
- **Tier_2_Vendor**: Vendor with full business documentation, can bid unlimited amounts
- **Escrow_Wallet**: Pre-funded vendor wallet where bid amounts are frozen until pickup
- **NDPR**: Nigeria Data Protection Regulation - data privacy compliance requirement
- **OTP**: One-Time Password for authentication
- **Salvage_Case**: A damaged asset available for auction
- **Auction**: A bidding process for a salvage case
- **Reserve_Price**: Minimum acceptable bid amount for an auction


## Requirements

### Epic 0: Public Landing Page & Marketing

### Requirement 0: Modern Landing Page with Interactive UI

**User Story:** As a Potential Vendor, I want to view an impressive, modern landing page that explains the platform's value proposition, so that I understand the benefits and am motivated to register.

**Priority:** Critical | **Story Points:** 13 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN visitor accesses root URL (/) THEN THE System SHALL display modern landing page with NEM Insurance branding (Burgundy #800020, White #FFFFFF, Gold #FFD700)
2. WHEN landing page loads THEN THE System SHALL display hero section with morphing animations: headline types out with cursor blink effect, background shapes morph between gradients, and SVG elements draw themselves
3. WHEN visitor scrolls THEN THE System SHALL trigger scroll-triggered animations: stats counters animate up (e.g., "35-45% Recovery Rate"), feature cards slide in from sides, and elements fade in sequentially
4. WHEN landing page displays THEN THE System SHALL show hero section with headline "Transform Salvage Recovery with AI-Powered Auctions", subheadline "Instant payments, real-time bidding, mobile-first platform for Nigerian vendors", and dual CTAs: "Start Bidding" (primary) and "Watch Demo" (secondary)
5. WHEN landing page displays THEN THE System SHALL show key value propositions with micro-interactions: "⚡ Instant Paystack Payments" (button pulses on hover), "📱 Mobile-First PWA" (icon bounces), "🤖 AI Damage Assessment" (glow effect), "🏆 Gamified Leaderboards" (shimmer animation)
6. WHEN landing page displays THEN THE System SHALL show "How It Works" section with 3D product mockups: interactive dashboard preview (rotate on drag), mobile app screens with parallax layers, and step-by-step flow with animated transitions
7. WHEN landing page displays THEN THE System SHALL show real customer context carousel: animated screenshots of vendor dashboard in use, case creation flow on mobile device, and live auction bidding interface with hover zoom
8. WHEN landing page displays THEN THE System SHALL show trust indicators: "Powered by NEM Insurance Plc" badge, "Secure BVN Verification" icon, "₦10M+ Processed Monthly" stat counter, and "500+ Active Vendors" animated number
9. WHEN landing page displays THEN THE System SHALL show collapsible/accordion FAQ section: "How do I get verified?", "What payment methods are supported?", "How does the bidding work?", and "What are the fees?" with smooth height transitions
10. WHEN landing page displays THEN THE System SHALL show contact section: phone "234-02-014489560", email "nemsupport@nem-insurance.com", address "NEM Insurance Plc, 199 Ikorodu Road, Obanikoro, Lagos", and embedded Google Maps
11. WHEN landing page displays THEN THE System SHALL show sticky floating CTA: bottom-right button morphs from "Start Free" to "Join 500+ Vendors" on scroll with progress bar showing "You've scrolled 50%"
12. WHEN visitor hovers over elements THEN THE System SHALL display micro-interactions: buttons pulse and glow, input fields animate with fill effects, checkmarks burst on form submit, and nav toggles have smooth transitions
13. WHEN landing page displays THEN THE System SHALL use playful bold typography: gradient-filled serif headlines with kinetic text (letter-by-letter reveals), mixed font pairings, and vibrant non-flat color palette
14. WHEN landing page displays THEN THE System SHALL use modular asymmetric grid layout: flexible card arrangements, zigzag feature sections, scannable Z/F patterns, and generous white space
15. WHEN landing page loads THEN THE System SHALL complete initial render in <2 seconds on 3G network
16. WHEN landing page displays THEN THE System SHALL be fully responsive: mobile (375px-768px), tablet (768px-1024px), and desktop (1024px+)
17. WHEN landing page displays THEN THE System SHALL include navigation: "Home", "How It Works", "Pricing", "Contact", "Login", and "Sign Up" (highlighted)
18. WHEN visitor clicks "Login" THEN THE System SHALL redirect to /login page
19. WHEN visitor clicks "Sign Up" THEN THE System SHALL redirect to /register page with UX writing: "Join 500+ vendors earning more from salvage"
20. WHEN landing page displays THEN THE System SHALL show social proof: vendor testimonials with photos, "4.8/5 rating from 200+ vendors", and case study highlights
21. WHEN landing page displays THEN THE System SHALL be SEO-optimized: meta title "Salvage Management System - AI-Powered Auctions for Nigerian Vendors", meta description, Open Graph tags, and structured data
22. WHEN landing page displays THEN THE System SHALL lazy-load images and use WebP format for optimal performance
23. WHEN landing page displays THEN THE System SHALL implement smooth scroll behavior and anchor links for navigation

### Epic 1: User Registration & Authentication

### Requirement 1: Standard Vendor Registration

**User Story:** As a Vendor, I want to register with standard information (name, email, phone, password, date of birth), so that I can create an account to access the platform.

**Priority:** Critical | **Story Points:** 5 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN a Vendor submits registration form THEN THE System SHALL collect full name, email, phone number, password, and date of birth
2. WHEN a Vendor enters password THEN THE System SHALL validate minimum 8 characters, 1 uppercase, 1 number, 1 special character
3. WHEN a Vendor enters email THEN THE System SHALL validate email format
4. WHEN a Vendor enters phone number THEN THE System SHALL validate Nigerian phone format
5. WHEN a Vendor submits registration THEN THE System SHALL require terms and conditions acceptance
6. WHEN registration is successful THEN THE System SHALL create account with status 'Unverified - Tier 0'
7. WHEN account is created THEN THE System SHALL send welcome email with verification link

### Requirement 2: OAuth Vendor Registration

**User Story:** As a Vendor, I want to register using Google or Facebook OAuth, so that I can sign up quickly without creating a new password.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN a Vendor clicks 'Sign up with Google' THEN THE System SHALL integrate OAuth 2.0 authentication
2. WHEN a Vendor clicks 'Sign up with Facebook' THEN THE System SHALL integrate OAuth 2.0 authentication
3. WHEN OAuth authentication succeeds THEN THE System SHALL auto-populate name and email from OAuth provider
4. IF phone number is provided by OAuth THEN THE System SHALL capture it ELSE THE System SHALL prompt user to enter phone number
5. WHEN OAuth registration completes THEN THE System SHALL require terms and conditions acceptance
6. WHEN OAuth account is created THEN THE System SHALL set status to 'Unverified - Tier 0'
7. WHEN OAuth registration succeeds THEN THE System SHALL follow same welcome flow as standard registration

### Requirement 3: Multi-Factor Authentication via SMS OTP

**User Story:** As a Vendor, I want to complete Multi-Factor Authentication (MFA) via SMS OTP during registration, so that my phone number is verified and my account is secured.

**Priority:** Critical | **Story Points:** 5 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN registration completes THEN THE System SHALL display MFA screen requesting phone number verification
2. WHEN phone number is provided THEN THE System SHALL send SMS OTP via Termii or Africa's Talking API
3. WHEN OTP is generated THEN THE System SHALL set validity to 5 minutes
4. WHEN Vendor enters OTP THEN THE System SHALL validate 6-digit code
5. IF OTP verification fails 3 times THEN THE System SHALL require resend
6. WHEN OTP is verified THEN THE System SHALL mark phone number as 'verified' in database
7. WHEN phone verification completes THEN THE System SHALL log activity 'Phone verification completed via OTP'
8. WHEN phone is verified THEN THE System SHALL update account status to 'Phone Verified - Tier 0'


### Requirement 4: Tier 1 KYC Verification (BVN)

**User Story:** As a Vendor, I want to complete Tier 1 KYC verification using BVN, so that I can start bidding on salvage items up to ₦500k immediately.

**Priority:** Critical | **Story Points:** 13 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN phone verification completes THEN THE System SHALL display KYC prompt 'Verify your identity to start bidding'
2. WHEN Vendor enters 11-digit BVN THEN THE System SHALL call Paystack BVN verification API with BVN, DOB, and phone
3. WHEN BVN API responds THEN THE System SHALL match BVN details against registered name, DOB, and phone
4. IF BVN match is successful THEN THE System SHALL auto-approve Tier 1 vendor status
5. IF BVN mismatch occurs THEN THE System SHALL show specific error message indicating mismatch details
6. WHEN BVN verification is initiated THEN THE System SHALL log activity 'BVN verification initiated'
7. WHEN BVN verification completes THEN THE System SHALL log activity 'BVN verification successful' or 'BVN verification failed'
8. WHEN BVN is stored THEN THE System SHALL encrypt using AES-256
9. WHEN BVN is displayed THEN THE System SHALL mask all digits except last 4 (****7890)
10. WHEN Tier 1 approval succeeds THEN THE System SHALL update account status to 'Verified - Tier 1'
11. WHEN Tier 1 approval succeeds THEN THE System SHALL send SMS and email 'Congratulations! You can now bid up to ₦500,000'
12. WHEN Tier 1 status is active THEN THE System SHALL display Tier 1 badge on vendor profile

### Requirement 5: Tier 2 Upgrade Prompts

**User Story:** As a Vendor, I want to be prompted to upgrade to Tier 2 when viewing auctions above ₦500k, so that I understand I need higher verification to access premium auctions.

**Priority:** High | **Story Points:** 3 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Tier 1 vendor clicks auction with value >₦500k THEN THE System SHALL display modal 'Upgrade to Tier 2 to bid on this item'
2. WHEN upgrade modal displays THEN THE System SHALL explain Tier 2 benefits: unlimited bidding, priority support, leaderboard eligibility
3. WHEN Vendor clicks 'Upgrade Now' THEN THE System SHALL redirect to Tier 2 KYC page
4. WHEN Tier 1 vendor views dashboard THEN THE System SHALL display subtle banner 'Unlock premium auctions - Upgrade to Tier 2'
5. IF high-value auctions exist THEN THE System SHALL show count 'X high-value auctions available' in banner
6. WHEN Vendor dismisses banner THEN THE System SHALL allow dismissal but reappear every 3 days

### Requirement 6: Tier 2 KYC Verification (Full Documentation)

**User Story:** As a Vendor, I want to complete Tier 2 KYC verification with full business documentation, so that I can bid on high-value salvage items above ₦500k and access premium features.

**Priority:** Critical | **Story Points:** 13 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Vendor accesses Tier 2 KYC form THEN THE System SHALL collect business name, CAC registration number, TIN, and bank account details
2. WHEN Vendor uploads documents THEN THE System SHALL accept CAC certificate (PDF/JPG, max 5MB), bank statement (last 3 months, PDF, max 10MB), and valid ID (NIN card/Driver's license/Passport, JPG, max 5MB)
3. WHEN ID is uploaded THEN THE System SHALL extract NIN using Google Document AI OCR
4. WHEN NIN is extracted THEN THE System SHALL verify via API against full name and DOB
5. WHEN CAC number is provided THEN THE System SHALL validate against SCUML/CAC database API if available
6. IF CAC API is unavailable THEN THE System SHALL flag for manual review by Salvage Manager
7. WHEN bank account details are provided THEN THE System SHALL verify account number and account name using Paystack Bank Account Resolution API
8. WHEN bank account is verified THEN THE System SHALL ensure account name matches registered business name
9. WHEN documents are uploaded THEN THE System SHALL store in AWS S3 with encryption
10. WHEN Tier 2 KYC is initiated THEN THE System SHALL log activities: 'Tier 2 KYC initiated', 'NIN verified', 'CAC uploaded', 'Bank details verified', 'Tier 2 KYC submitted for review'
11. WHEN Tier 2 application is submitted THEN THE System SHALL set status to 'Pending Manager Approval'
12. WHEN Tier 2 application is submitted THEN THE System SHALL send SMS and email 'Your Tier 2 application is under review. We'll notify you within 24 hours'
13. WHEN Tier 2 application is submitted THEN THE System SHALL notify Salvage Manager to review application


### Requirement 7: Salvage Manager Reviews Tier 2 Applications

**User Story:** As a Salvage Manager, I want to review and approve/reject Tier 2 vendor KYC applications, so that I can ensure only legitimate businesses access high-value auctions.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Salvage Manager accesses dashboard THEN THE System SHALL display Tier 2 KYC review queue
2. WHEN Manager views application THEN THE System SHALL display all submitted documents (CAC, Bank statement, ID) in modal
3. WHEN Manager views application THEN THE System SHALL show verification status: BVN ✓, NIN ✓, Bank Account ✓, CAC (pending manual review)
4. WHEN Manager reviews application THEN THE System SHALL provide Approve/Reject buttons with mandatory comment field for rejection
5. IF Manager approves application THEN THE System SHALL update account status to 'Verified - Tier 2'
6. IF Manager approves application THEN THE System SHALL enable vendor to bid >₦500k
7. IF Manager approves application THEN THE System SHALL send SMS and email 'Congratulations! Your Tier 2 verification is complete'
8. IF Manager approves application THEN THE System SHALL display Tier 2 badge on vendor profile
9. IF Manager rejects application THEN THE System SHALL maintain Tier 1 status
10. IF Manager rejects application THEN THE System SHALL send SMS and email with rejection reason and next steps
11. IF Manager rejects application THEN THE System SHALL allow vendor to resubmit corrected documents
12. WHEN Manager completes review THEN THE System SHALL log activity 'Tier 2 application approved/rejected by [Manager Name]'
13. WHEN Tier 2 application is submitted THEN THE System SHALL target review completion within 24 hours

### Requirement 8: Email/Phone Login

**User Story:** As a Vendor, I want to log in with email/phone and password, so that I can access my account securely.

**Priority:** Critical | **Story Points:** 5 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN Vendor submits login form THEN THE System SHALL accept email OR phone number plus password
2. WHEN login is successful THEN THE System SHALL generate JWT token valid for 24 hours on desktop or 2 hours on mobile
3. WHEN login is successful THEN THE System SHALL store session in Vercel KV (Redis) cache
4. IF login fails 5 times THEN THE System SHALL lock account for 30-minute cooldown
5. WHEN login succeeds THEN THE System SHALL log activity 'Login successful from [IP address] - [Device type]'
6. WHEN login succeeds THEN THE System SHALL redirect to vendor dashboard

### Requirement 9: OAuth Login

**User Story:** As a Vendor, I want to log in using Google/Facebook OAuth, so that I can access my account quickly without entering password.

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN Vendor clicks 'Sign in with Google' THEN THE System SHALL initiate OAuth flow
2. WHEN Vendor clicks 'Sign in with Facebook' THEN THE System SHALL initiate OAuth flow
3. WHEN OAuth flow completes THEN THE System SHALL validate user credentials with provider
4. WHEN OAuth login succeeds THEN THE System SHALL generate JWT token
5. WHEN OAuth login succeeds THEN THE System SHALL manage session same as standard login
6. WHEN OAuth login succeeds THEN THE System SHALL log activity 'OAuth login successful via [Provider]'

### Requirement 10: Staff Account Creation

**User Story:** As a System Admin, I want to create staff accounts for Claims Adjusters, Salvage Managers, and Finance Officers, so that I can onboard internal team members with appropriate role-based access.

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN Admin accesses user management page THEN THE System SHALL display 'Add New User' button
2. WHEN Admin clicks 'Add New User' THEN THE System SHALL display form collecting full name, email, phone, and role
3. WHEN Admin selects role THEN THE System SHALL provide dropdown: Claims Adjuster, Salvage Manager, Finance Officer
4. WHEN Admin creates user THEN THE System SHALL generate temporary password and email it to new user
5. WHEN new user first logs in THEN THE System SHALL force password change
6. WHEN user is created THEN THE System SHALL auto-assign role-based permissions
7. WHEN user is created THEN THE System SHALL log activity 'User [Name] created by Admin [Admin Name] with role [Role]'
8. WHEN Admin creates user THEN THE System SHALL complete provisioning in <3 minutes


### Requirement 11: Comprehensive Activity Logging

**User Story:** As All Users, I want all my actions logged with timestamp, IP address, and device type, so that the platform maintains security and audit compliance (NDPR).

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 1

#### Acceptance Criteria

1. WHEN any user performs action THEN THE System SHALL log user ID, action type, timestamp (UTC + WAT), IP address, device type, and browser/user agent
2. WHEN logs are created THEN THE System SHALL store in PostgreSQL with minimum 2 years retention
3. WHEN logs are stored THEN THE System SHALL make them immutable (cannot be edited/deleted)
4. WHEN Admin searches logs THEN THE System SHALL allow filtering by user, date range, and action type
5. WHEN Admin exports logs THEN THE System SHALL support CSV/Excel format for compliance reporting
6. WHEN user performs action THEN THE System SHALL log: authentication, case management, bidding, payments, KYC verification, profile updates, and admin actions

### Epic 2: Mobile Case Creation (PWA)

### Requirement 12: Mobile PWA Case Creation

**User Story:** As a Claims Adjuster, I want to create a salvage case from my mobile browser using PWA, so that I can document accident scenes immediately without waiting to return to office.

**Priority:** Critical | **Story Points:** 13 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Claims Adjuster accesses PWA via mobile browser THEN THE System SHALL support Chrome and Safari iOS
2. WHEN Adjuster views mobile navigation THEN THE System SHALL display prominent 'Create Case' button
3. WHEN Adjuster creates case THEN THE System SHALL collect claim reference number with auto-validation against policy system
4. WHEN Adjuster selects asset type THEN THE System SHALL provide dropdown: Vehicle, Property, Electronics
5. WHEN Adjuster selects asset type THEN THE System SHALL display conditional fields based on type (e.g., Vehicle: Make, Model, Year, VIN)
6. WHEN Adjuster enters market value THEN THE System SHALL validate numeric input with ₦ symbol
7. WHEN Adjuster taps 'Add Photo' THEN THE System SHALL open mobile camera
8. WHEN Adjuster captures photos THEN THE System SHALL accept 3-10 photos (max 5MB each, JPG/PNG/HEIC)
9. WHEN photos are captured THEN THE System SHALL auto-compress via TinyPNG API before upload
10. WHEN case is created THEN THE System SHALL request location permission from browser
11. WHEN location permission is granted THEN THE System SHALL auto-tag GPS coordinates (latitude, longitude)
12. WHEN GPS is captured THEN THE System SHALL display as 'Location: Lagos, Nigeria' with map preview
13. WHEN Adjuster taps microphone icon THEN THE System SHALL activate Web Speech API for live speech-to-text
14. WHEN Adjuster speaks THEN THE System SHALL convert speech to text in real-time and save as text note
15. WHEN Adjuster clicks 'Save as Draft' THEN THE System SHALL save offline in IndexedDB if no internet
16. WHEN Adjuster clicks 'Submit for Approval' THEN THE System SHALL upload to server
17. WHEN case is created from accident site THEN THE System SHALL complete in <5 minutes

### Requirement 13: Offline Mode with Auto-Sync

**User Story:** As a Claims Adjuster, I want to create cases offline and have them auto-sync when internet returns, so that I can work in areas with poor connectivity without losing data.

**Priority:** High | **Story Points:** 13 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN PWA is loaded THEN THE System SHALL cache app shell and forms using Workbox service worker
2. WHEN Adjuster is offline THEN THE System SHALL display indicator 'You're offline. Changes will sync automatically'
3. WHEN Adjuster creates case offline THEN THE System SHALL store draft in browser IndexedDB
4. WHEN photos are captured offline THEN THE System SHALL store compressed in IndexedDB
5. WHEN internet connection is detected THEN THE System SHALL trigger service worker auto-sync
6. WHEN auto-sync runs THEN THE System SHALL display upload queue 'Syncing 2 of 3 items'
7. WHEN sync completes THEN THE System SHALL display success notification 'All cases synced successfully'
8. IF case was edited online while offline THEN THE System SHALL show conflict modal with option to keep offline version or discard
9. WHEN case is created offline THEN THE System SHALL log activity 'Case created offline'
10. WHEN case is synced THEN THE System SHALL log activity 'Case synced at [timestamp]'


### Requirement 14: AI Damage Assessment

**User Story:** As a Claims Adjuster, I want to receive AI damage assessment results after uploading photos, so that I get instant valuation guidance without manual inspection expertise.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN photos are uploaded THEN THE System SHALL display loading spinner 'AI analyzing damage...'
2. WHEN photos are uploaded THEN THE System SHALL analyze images using Google Cloud Vision API within 5 seconds
3. WHEN AI analysis completes THEN THE System SHALL display damage severity (Minor 40-60%, Moderate 20-40%, Severe 5-20%)
4. WHEN AI analysis completes THEN THE System SHALL display confidence score (e.g., 85% confident)
5. WHEN AI analysis completes THEN THE System SHALL display damage labels (e.g., 'Front bumper dent', 'Shattered windshield')
6. WHEN AI assessment completes THEN THE System SHALL auto-calculate estimated salvage value: [Market value] × [Damage %]
7. WHEN estimated value is calculated THEN THE System SHALL suggest reserve price at 70% of estimated value
8. WHEN AI assessment displays THEN THE System SHALL provide manual override option 'This doesn't look right? Adjust manually'
9. WHEN AI assessment completes THEN THE System SHALL log activity 'AI assessment completed with [confidence]% confidence'

### Requirement 15: Mobile Case Approval

**User Story:** As a Salvage Manager, I want to review and approve/reject salvage cases from mobile PWA, so that I can keep cases moving even when away from my desk.

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN Manager accesses mobile PWA THEN THE System SHALL display approval queue in mobile-optimized card layout
2. WHEN Manager views queue THEN THE System SHALL show case ID, asset type, estimated value, AI confidence score, adjuster name, and submission time on each card
3. WHEN Manager taps card THEN THE System SHALL display full details: swipeable photo gallery, AI assessment results, GPS location on map, asset details, and adjuster notes
4. WHEN Manager views case details THEN THE System SHALL display Approve/Reject buttons at bottom
5. IF Manager rejects case THEN THE System SHALL require comment (minimum 10 characters)
6. IF Manager approves case THEN THE System SHALL auto-create auction
7. IF Manager approves case THEN THE System SHALL notify vendors
8. IF Manager approves case THEN THE System SHALL log activity 'Case approved by [Manager]'
9. IF Manager rejects case THEN THE System SHALL return case to Adjuster with feedback
10. IF Manager rejects case THEN THE System SHALL log activity 'Case rejected - Reason: [comment]'
11. WHEN new case awaits approval THEN THE System SHALL send push notification to Manager
12. WHEN case is submitted THEN THE System SHALL target approval/rejection within 12 hours

### Epic 3: Real-Time Bidding & Gamification

### Requirement 16: Mobile Auction Browsing

**User Story:** As a Vendor, I want to browse active auctions in mobile-optimized card layout, so that I can easily find salvage items to bid on from my phone.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN Vendor accesses auction listing THEN THE System SHALL display card layout with 2 cards per row on mobile
2. WHEN Vendor views auction card THEN THE System SHALL show main photo, asset name, current bid amount, time remaining countdown, and 'X vendors watching' count
3. WHEN Vendor filters auctions THEN THE System SHALL support filtering by asset type, price range, time ending (soonest first), and location
4. WHEN Vendor searches auctions THEN THE System SHALL support search by asset name and claim reference
5. WHEN auction listing loads THEN THE System SHALL initially load 20 auctions with lazy loading
6. WHEN Vendor scrolls THEN THE System SHALL implement infinite scroll for additional auctions
7. WHEN auction listing loads THEN THE System SHALL complete page load in <2 seconds on 3G network
8. WHEN Vendor pulls down THEN THE System SHALL refresh auction list with pull-to-refresh gesture


### Requirement 17: Live Countdown Timers

**User Story:** As a Vendor, I want to see live countdown timer for auctions, so that I feel urgency and don't miss bidding opportunities.

**Priority:** Critical | **Story Points:** 5 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN auction has >1 day remaining THEN THE System SHALL display countdown format '2d 14h 35m 12s'
2. WHEN auction has <1 day but >1 hour remaining THEN THE System SHALL display countdown format '14h 35m 12s'
3. WHEN auction has <1 hour remaining THEN THE System SHALL display countdown format '35m 12s'
4. WHEN countdown displays THEN THE System SHALL update every 1 second using client-side JavaScript
5. WHEN auction has >24 hours remaining THEN THE System SHALL display timer in green color
6. WHEN auction has 1-24 hours remaining THEN THE System SHALL display timer in yellow color
7. WHEN auction has <1 hour remaining THEN THE System SHALL display timer in red color
8. WHEN auction has <1 hour remaining THEN THE System SHALL apply pulsing CSS animation to timer
9. WHEN auction has <1 hour remaining THEN THE System SHALL send mobile push notification '1 hour left to bid on [Item]'
10. WHEN auction has <30 minutes remaining THEN THE System SHALL send SMS notification '30 minutes left to bid on [Item]'
11. WHEN timer displays THEN THE System SHALL sync with server time to prevent client manipulation

### Requirement 18: Bid Placement with OTP

**User Story:** As a Vendor, I want to place a bid with SMS OTP verification, so that my bid is secure and I complete bidding in under 1 minute.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN Vendor taps 'Place Bid' button THEN THE System SHALL display modal for bid amount entry
2. WHEN Vendor enters bid amount THEN THE System SHALL validate bid is greater than current bid plus minimum increment (e.g., ₦10,000)
3. IF bid validation fails THEN THE System SHALL show real-time error 'Minimum bid: ₦510,000'
4. WHEN Vendor taps 'Confirm Bid' THEN THE System SHALL send SMS OTP to registered phone
5. WHEN OTP is sent THEN THE System SHALL set validity to 3 minutes
6. WHEN Vendor enters 6-digit OTP THEN THE System SHALL verify code
7. WHEN OTP is verified THEN THE System SHALL submit bid
8. WHEN bid is submitted THEN THE System SHALL broadcast new bid via WebSocket to all viewers within 2 seconds
9. WHEN bid is placed THEN THE System SHALL log activity 'Bid placed: ₦[amount] for auction [ID]'
10. WHEN Vendor places bid THEN THE System SHALL complete total process in <1 minute from tap to confirmed bid

### Requirement 19: Outbid Push Notifications

**User Story:** As a Vendor, I want to receive push notification when I've been outbid, so that I can respond immediately and stay competitive.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN another vendor bids higher THEN THE System SHALL send PWA push notification to outbid vendor
2. WHEN push notification is sent THEN THE System SHALL display item name, new bid amount, and time remaining
3. WHEN Vendor taps notification THEN THE System SHALL open auction page directly
4. WHEN new bid is placed THEN THE System SHALL deliver notification within 5 seconds
5. WHEN Vendor accesses notification preferences THEN THE System SHALL allow disabling outbid notifications
6. WHEN outbid notification is sent THEN THE System SHALL log activity 'Outbid notification sent'

### Requirement 20: Vendors Watching Count

**User Story:** As a Vendor, I want to see how many vendors are watching an auction, so that I understand demand and bid strategically.

**Priority:** Medium | **Story Points:** 3 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN Vendor views auction card THEN THE System SHALL display 'X vendors watching' count
2. WHEN vendor views auction for >10 seconds THEN THE System SHALL increment watching count
3. WHEN watching count changes THEN THE System SHALL update in real-time via WebSocket
4. WHEN watching count displays THEN THE System SHALL anonymize (no vendor names shown)
5. WHEN high-demand items display THEN THE System SHALL create FOMO effect with watching count


### Requirement 21: Auto-Extend Auctions

**User Story:** As a Vendor, I want to see auction auto-extend if bids placed in final 5 minutes, so that I have fair chance to respond to last-second bids (no sniping).

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. IF bid is placed when <5 minutes remaining THEN THE System SHALL add 2 minutes to auction timer
2. WHEN auction extends THEN THE System SHALL apply extension unlimited times
3. WHEN auction extends THEN THE System SHALL send push and SMS notification to all bidders 'Auction extended by 2 minutes'
4. WHEN auction is in extension mode THEN THE System SHALL change timer color to orange
5. WHEN no bids occur for 5 consecutive minutes THEN THE System SHALL determine final winner
6. WHEN auction extends THEN THE System SHALL log activity 'Auction auto-extended at [timestamp]'

### Requirement 22: Bid History Graph

**User Story:** As a Vendor, I want to view bid history graph for an auction, so that I can analyze bidding patterns.

**Priority:** Low | **Story Points:** 3 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Vendor views auction details THEN THE System SHALL display line chart showing bid amounts over time using Recharts
2. WHEN chart displays THEN THE System SHALL show time on X-axis and bid amount (₦) on Y-axis
3. WHEN Vendor touches chart point THEN THE System SHALL show exact bid and time
4. WHEN chart displays bids THEN THE System SHALL color-code by anonymized vendor (Vendor A, B, C)
5. WHEN chart loads THEN THE System SHALL complete mobile-optimized rendering in <2 seconds

### Requirement 23: Vendor Leaderboard

**User Story:** As a Vendor, I want to see my position on vendor leaderboard, so that I feel recognized and want to improve my ranking.

**Priority:** Medium | **Story Points:** 5 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Vendor accesses leaderboard page THEN THE System SHALL show Top 10 vendors monthly
2. WHEN leaderboard displays THEN THE System SHALL show metrics: total bids, wins, total spent (₦), and on-time pickup rate (%)
3. IF Vendor is in Top 10 THEN THE System SHALL highlight their position
4. WHEN leaderboard displays Top 3 THEN THE System SHALL show trophy icons
5. WHEN leaderboard updates THEN THE System SHALL refresh weekly (every Monday)
6. WHEN Vendor views leaderboard THEN THE System SHALL log activity 'Leaderboard viewed'

### Epic 4: Payment Processing & Escrow

### Requirement 24: Paystack Instant Payment

**User Story:** As a Vendor, I want to pay for won auction via Paystack instant card payment, so that I complete payment in minutes and secure my salvage.

**Priority:** Critical | **Story Points:** 13 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Vendor wins auction THEN THE System SHALL send SMS, email, and push notification 'You won! Pay within 24 hours to secure your item'
2. WHEN Vendor accesses payment page THEN THE System SHALL display item details, winning bid amount, and payment deadline (24 hours countdown)
3. WHEN Vendor clicks 'Pay Now with Paystack' THEN THE System SHALL generate payment link
4. WHEN payment link is generated THEN THE System SHALL redirect to Paystack payment page supporting card, bank transfer, USSD, and bank account
5. WHEN Vendor completes payment THEN THE System SHALL receive Paystack webhook at /api/webhooks/payment-confirmation
6. WHEN webhook is received THEN THE System SHALL verify signature, payment reference, and amount matches invoice
7. WHEN payment is verified THEN THE System SHALL auto-verify within 10 minutes
8. WHEN payment is verified THEN THE System SHALL auto-generate pickup authorization
9. WHEN pickup authorization is generated THEN THE System SHALL send via SMS and email
10. WHEN payment is initiated THEN THE System SHALL log activity 'Payment initiated via Paystack'
11. WHEN payment is verified THEN THE System SHALL log activity 'Payment verified automatically'


### Requirement 25: Bank Transfer Payment

**User Story:** As a Vendor, I want to pay via bank transfer and upload payment proof, so that I have alternative payment method if I don't have card.

**Priority:** Medium | **Story Points:** 5 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Vendor selects 'Pay via Bank Transfer' THEN THE System SHALL display company bank details
2. WHEN Vendor uploads payment proof THEN THE System SHALL accept receipt/screenshot (JPG/PDF, max 5MB)
3. WHEN payment proof is uploaded THEN THE System SHALL trigger notification to Finance Officer
4. WHEN payment proof is submitted THEN THE System SHALL set status to 'Payment Pending Verification'
5. WHEN Finance Officer reviews THEN THE System SHALL target manual verification within 4 hours
6. WHEN bank transfer proof is uploaded THEN THE System SHALL log activity 'Bank transfer proof uploaded'
7. WHEN Finance Officer verifies THEN THE System SHALL log activity 'Payment verified by Finance Officer [Name]'

### Requirement 26: Escrow Wallet Pre-Funding

**User Story:** As a Vendor, I want to pre-fund escrow wallet to speed up future payments, so that I can bid and pay instantly without payment delays.

**Priority:** High | **Story Points:** 8 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Vendor views dashboard THEN THE System SHALL display 'Escrow Wallet Balance: ₦0'
2. WHEN Vendor clicks 'Add Funds' THEN THE System SHALL redirect to Paystack
3. WHEN Vendor adds funds THEN THE System SHALL accept ₦50k - ₦5M to wallet
4. WHEN Paystack confirms payment THEN THE System SHALL credit funds immediately
5. WHEN Vendor wins auction THEN THE System SHALL auto-freeze bid amount in wallet
6. WHEN bid amount is frozen THEN THE System SHALL set status to 'Funds Reserved'
7. WHEN pickup is confirmed THEN THE System SHALL release funds to NEM Insurance
8. WHEN funds are released THEN THE System SHALL make remaining balance available for next bid
9. WHEN wallet balance is checked THEN THE System SHALL cache in Vercel KV (Redis) for instant checks
10. WHEN Vendor views wallet THEN THE System SHALL display transaction history: date, type (Credit/Debit), amount, and balance
11. WHEN wallet is funded THEN THE System SHALL log activity 'Wallet funded ₦[amount]'
12. WHEN funds are frozen THEN THE System SHALL log activity 'Funds frozen for auction [ID]'
13. WHEN funds are released THEN THE System SHALL log activity 'Funds released'

### Requirement 27: Auto-Verified Payments Dashboard

**User Story:** As a Finance Officer, I want to see payments auto-verified via Paystack webhook, so that I don't waste time manually checking statements.

**Priority:** Critical | **Story Points:** 8 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Finance Officer accesses dashboard THEN THE System SHALL display total payments today, auto-verified (green ✓), pending manual verification (yellow ⚠), and overdue (red ⚠)
2. WHEN Finance Officer views dashboard THEN THE System SHALL display pie chart showing auto-verified vs manual (target: 90%+ auto)
3. WHEN Paystack payment displays THEN THE System SHALL show 'Auto-verified' badge
4. WHEN Finance Officer reviews payments THEN THE System SHALL show only bank transfer payments requiring manual review
5. WHEN payment is auto-verified THEN THE System SHALL log activity 'Payment auto-verified via Paystack webhook'

### Requirement 28: Manual Payment Verification

**User Story:** As a Finance Officer, I want to manually verify bank transfer payments, so that I can approve legacy payment methods securely.

**Priority:** Medium | **Story Points:** 5 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Finance Officer accesses pending payments queue THEN THE System SHALL display uploaded receipts
2. WHEN Finance Officer clicks receipt THEN THE System SHALL display full-size image
3. WHEN Finance Officer reviews receipt THEN THE System SHALL verify amount matches invoice, bank details match vendor registration, and reference number is visible
4. WHEN Finance Officer completes review THEN THE System SHALL provide Approve/Reject with comments
5. IF Finance Officer approves THEN THE System SHALL send pickup authorization
6. IF Finance Officer approves THEN THE System SHALL log activity 'Payment verified by [Finance Officer]'
7. IF Finance Officer rejects THEN THE System SHALL send SMS and email to vendor with reason
8. IF Finance Officer rejects THEN THE System SHALL allow vendor to resubmit


### Requirement 29: Payment Deadline Reminders

**User Story:** As a Vendor, I want to receive SMS reminder before payment deadline, so that I don't miss deadlines and avoid penalties.

**Priority:** Medium | **Story Points:** 3 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN 12 hours remain before 24-hour deadline THEN THE System SHALL send SMS reminder
2. WHEN SMS is sent THEN THE System SHALL include message 'Reminder: Pay ₦[amount] for [Item] by [Time] tomorrow. Pay now: [Link]'
3. WHEN SMS is sent THEN THE System SHALL include payment link
4. WHEN SMS is sent THEN THE System SHALL use Termii or Africa's Talking API
5. WHEN SMS is delivered THEN THE System SHALL log delivery in SMS audit trail

### Requirement 30: Auto-Flag Overdue Payments

**User Story:** As System, I want to auto-flag overdue payments after 24 hours, so that late payments are tracked and vendors can be penalized.

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN cron job runs every hour THEN THE System SHALL check payment deadlines
2. IF payment not received 24 hours after auction end THEN THE System SHALL set status to 'Overdue'
3. IF payment is overdue THEN THE System SHALL flag vendor in performance stats
4. IF payment is overdue THEN THE System SHALL send SMS and email 'Payment overdue. Item may be re-auctioned'
5. IF payment overdue >48 hours THEN THE System SHALL forfeit auction winner
6. IF payment overdue >48 hours THEN THE System SHALL re-list item for auction
7. IF payment overdue >48 hours THEN THE System SHALL suspend vendor for 7 days
8. IF payment deadline is missed THEN THE System SHALL log activity 'Payment deadline missed - Auction [ID] re-listed'

### Epic 5: Mobile Dashboards & Reporting

### Requirement 31: Manager Real-Time Dashboard

**User Story:** As a Salvage Manager, I want to view real-time KPIs on mobile PWA dashboard, so that I monitor performance on the go.

**Priority:** High | **Story Points:** 8 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Manager accesses mobile PWA dashboard THEN THE System SHALL display active auctions (number), total bids today, average recovery rate (%), and cases pending approval (number)
2. WHEN Manager views dashboard THEN THE System SHALL display charts using Recharts: recovery rate trend (last 30 days), top 5 vendors by volume, and payment status breakdown
3. WHEN dashboard displays THEN THE System SHALL auto-refresh every 30 seconds
4. WHEN Manager filters dashboard THEN THE System SHALL support filtering by date range and asset type
5. WHEN dashboard loads on mobile THEN THE System SHALL complete loading in <2 seconds
6. WHEN Manager taps charts THEN THE System SHALL provide drill-down functionality

### Requirement 32: Vendor Performance Dashboard

**User Story:** As a Vendor, I want to view my performance stats and leaderboard position, so that I track my success and improve.

**Priority:** Medium | **Story Points:** 5 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Vendor accesses dashboard THEN THE System SHALL display win rate (%), average payment time (hours), on-time pickup rate (%), 5-star rating (average), and leaderboard position (#X of Y vendors)
2. WHEN Vendor views dashboard THEN THE System SHALL display badges for achievements: '10 Wins' badge, 'Top Bidder' badge, and 'Fast Payer' badge (avg <6 hours)
3. WHEN Vendor views dashboard THEN THE System SHALL show comparison to last month (e.g., '↑ Win rate increased by 5%')
4. WHEN Vendor accesses dashboard on mobile THEN THE System SHALL display mobile-optimized card layout

### Requirement 33: WhatsApp Report Sharing

**User Story:** As a Salvage Manager, I want to export and share reports via WhatsApp, so that I quickly share insights with stakeholders.

**Priority:** Medium | **Story Points:** 5 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Manager accesses reports page THEN THE System SHALL provide options: recovery summary, vendor rankings, and payment aging
2. WHEN Manager generates report THEN THE System SHALL allow date range selection
3. WHEN Manager clicks 'Generate PDF' THEN THE System SHALL create mobile-optimized PDF (<2MB)
4. WHEN PDF is generated THEN THE System SHALL display native mobile share button supporting WhatsApp, email, and SMS
5. WHEN PDF is generated THEN THE System SHALL complete generation in <10 seconds
6. WHEN report is shared THEN THE System SHALL log activity 'Report generated and shared via [Channel]'


### Epic 6: Fraud Detection & Security

### Requirement 34: Automated Fraud Detection

**User Story:** As System, I want to detect and flag suspicious bidding patterns automatically, so that platform integrity is protected from manipulation.

**Priority:** High | **Story Points:** 8 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN bid is submitted THEN THE System SHALL run fraud detection
2. IF same IP address bids against itself THEN THE System SHALL flag 'Suspicious - Same IP'
3. IF sudden bid >3x previous bid from new vendor (<7 days) THEN THE System SHALL flag 'Suspicious - Unusual bid pattern'
4. IF multiple vendor accounts from same phone/BVN THEN THE System SHALL flag 'Suspicious - Duplicate identity'
5. WHEN fraud is flagged THEN THE System SHALL send push and email alert to System Admin
6. WHEN fraud is flagged THEN THE System SHALL mark auction 'Under Review'
7. WHEN fraud is flagged THEN THE System SHALL temporarily hold vendor's bid
8. WHEN fraud is flagged THEN THE System SHALL log activity 'Fraud flag raised - Pattern: [type], Auction: [ID], Vendor: [ID]'

### Requirement 35: Fraud Alert Review

**User Story:** As a System Admin, I want to review fraud alerts and take action, so that I can investigate suspicious activity and protect the platform.

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN Admin accesses fraud dashboard THEN THE System SHALL display all flagged auctions
2. WHEN Admin views flag THEN THE System SHALL show vendor details, bid history, IP addresses, and evidence (e.g., 'Same IP: 192.168.1.1')
3. WHEN Admin reviews flag THEN THE System SHALL provide actions: dismiss flag (if false positive), suspend vendor (7/30/90 days/permanent), or cancel auction and re-list
4. IF Admin suspends vendor THEN THE System SHALL cancel all active bids
5. IF Admin suspends vendor THEN THE System SHALL send SMS and email notification
6. IF Admin suspends vendor THEN THE System SHALL log activity 'Vendor suspended - Reason: [fraud type]'
7. IF Admin dismisses flag THEN THE System SHALL allow auction to continue normally
8. IF Admin dismisses flag THEN THE System SHALL log activity 'Fraud flag dismissed by Admin [Name]'

### Requirement 36: Auto-Suspend Repeat Offenders

**User Story:** As System, I want to auto-suspend vendors with 3+ fraud flags, so that repeat offenders are removed automatically.

**Priority:** High | **Story Points:** 5 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN vendor receives 3rd confirmed fraud flag THEN THE System SHALL auto-suspend account for 30 days
2. WHEN vendor is auto-suspended THEN THE System SHALL cancel all active bids
3. WHEN vendor is auto-suspended THEN THE System SHALL send SMS and email 'Your account has been suspended due to suspicious activity. Contact support if you believe this is an error'
4. WHEN vendor is auto-suspended THEN THE System SHALL allow Admin to review and reinstate
5. WHEN vendor is auto-suspended THEN THE System SHALL log activity 'Vendor auto-suspended - 3 fraud flags reached'

### Epic 7: Vendor Ratings & Trust

### Requirement 37: Vendor Rating System

**User Story:** As a Salvage Manager, I want to rate vendors after successful pickup, so that vendor reputation system builds trust.

**Priority:** Medium | **Story Points:** 5 | **Sprint:** Sprint 4

#### Acceptance Criteria

1. WHEN pickup is confirmed THEN THE System SHALL display rating prompt
2. WHEN Manager rates vendor THEN THE System SHALL accept 5-star rating (1-5 stars)
3. WHEN Manager rates vendor THEN THE System SHALL accept optional text review (max 500 characters)
4. WHEN Manager rates vendor THEN THE System SHALL collect rating categories: payment speed, communication, and pickup punctuality
5. WHEN rating is submitted THEN THE System SHALL display rating on vendor profile
6. WHEN ratings are collected THEN THE System SHALL calculate and display average rating
7. WHEN transaction is rated THEN THE System SHALL prevent rating same transaction twice
8. WHEN vendor is rated THEN THE System SHALL log activity 'Vendor [ID] rated [X] stars by Manager [Name]'

### Requirement 38: Trust Badges Display

**User Story:** As a Vendor, I want to see trust badges on my profile, so that I build credibility with other users.

**Priority:** Medium | **Story Points:** 2 | **Sprint:** Sprint 2

#### Acceptance Criteria

1. WHEN Tier 1 KYC completes THEN THE System SHALL display 'Verified BVN' badge (green checkmark)
2. WHEN Tier 2 KYC completes THEN THE System SHALL display 'Verified Business' badge
3. IF vendor rating ≥4.5 stars THEN THE System SHALL display 'Top Rated' badge
4. IF vendor average payment time <6 hours THEN THE System SHALL display 'Fast Payer' badge
5. WHEN badges display THEN THE System SHALL show on vendor profile, auction bid list, and leaderboard
6. WHEN user hovers over badge THEN THE System SHALL display tooltip 'This vendor's identity has been verified via BVN'


### Epic 8: Notifications & Communication

### Requirement 39: Notification Preferences

**User Story:** As a Vendor, I want to customize my notification preferences, so that I only receive alerts via my preferred channels.

**Priority:** Medium | **Story Points:** 3 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN Vendor accesses notification settings THEN THE System SHALL display toggles for SMS (on/off), email (on/off), and push (on/off)
2. WHEN Vendor customizes preferences THEN THE System SHALL provide per-notification-type control: bid alerts, auction ending, payment reminders, and leaderboard updates
3. WHEN Vendor opts out THEN THE System SHALL prevent opt-out of critical notifications: OTP codes, payment deadlines, and account suspension
4. WHEN Vendor changes preferences THEN THE System SHALL save immediately
5. WHEN preferences are updated THEN THE System SHALL log activity 'Notification preferences updated'

### Requirement 40: Multi-Channel Notifications

**User Story:** As All Users, I want to receive notifications via SMS, Email, and Push based on my preferences, so that I stay informed through my preferred channels.

**Priority:** High | **Story Points:** 8 | **Sprint:** Sprint 3

#### Acceptance Criteria

1. WHEN critical notification is triggered THEN THE System SHALL send SMS via Termii or Africa's Talking (OTP, payment deadlines, auction ending)
2. WHEN notification is triggered THEN THE System SHALL send email via SendGrid for all notification types using HTML templates
3. WHEN real-time alert is triggered THEN THE System SHALL send PWA push notification (outbid, auction ending soon)
4. WHEN notification is sent THEN THE System SHALL log delivery in audit trail
5. IF push notification fails THEN THE System SHALL fallback to SMS or email
6. WHEN notifications are sent THEN THE System SHALL target delivery rate >95%

## Non-Functional Requirements

### NFR1: Performance

#### NFR1.1 - Response Time

1. THE System SHALL complete API responses within 500ms (95th percentile)
2. THE System SHALL complete mobile page load within 2 seconds (median)
3. THE System SHALL complete desktop page load within 1.5 seconds (median)
4. THE System SHALL complete image upload within 8 seconds per image
5. THE System SHALL deliver real-time bid updates with <1 second latency

#### NFR1.2 - Throughput

1. THE System SHALL support 200 concurrent users (100 desktop + 100 mobile)
2. THE System SHALL handle 50 concurrent bids during peak auctions
3. THE System SHALL process 2,000 photo uploads per day

### NFR2: Scalability

#### NFR2.1 - Horizontal Scaling

1. THE System SHALL scale application servers horizontally via Kubernetes
2. THE System SHALL support database read replicas for reporting queries
3. THE System SHALL use CDN (Cloudflare/Bunny) for media delivery
4. THE System SHALL use Vercel KV (Redis) caching for frequently accessed data

#### NFR2.2 - Growth Targets

1. THE System SHALL handle 10x user growth (2,000 users) without redesign
2. THE System SHALL support 500,000+ salvage cases in database
3. THE System SHALL accommodate 5TB+ of media in file storage

### NFR3: Availability & Reliability

#### NFR3.1 - Uptime

1. THE System SHALL maintain 99.5% uptime (max 3.6 hours downtime/month)
2. THE System SHALL schedule planned maintenance during off-peak hours (2-6 AM WAT)
3. THE System SHALL send uptime alerts to admins if downtime >5 minutes

#### NFR3.2 - Backup & Recovery

1. THE System SHALL run database backups daily at 2 AM WAT
2. THE System SHALL store backups in geographically separate location
3. THE System SHALL maintain Recovery Point Objective (RPO) of 24 hours
4. THE System SHALL maintain Recovery Time Objective (RTO) of 4 hours


### NFR4: Security

#### NFR4.1 - Authentication

1. THE System SHALL enforce multi-factor authentication for Admin users
2. THE System SHALL lock accounts after 5 failed login attempts
3. THE System SHALL expire sessions after 2 hours inactivity on mobile
4. THE System SHALL integrate Paystack Identity API for BVN verification

#### NFR4.2 - Data Protection

1. THE System SHALL encrypt passwords using bcrypt (minimum 12 rounds)
2. THE System SHALL encrypt data in transit using TLS 1.3
3. THE System SHALL encrypt sensitive data at rest (PII, bank details, BVN)

#### NFR4.3 - Compliance

1. THE System SHALL comply with Nigeria Data Protection Regulation (NDPR)
2. THE System SHALL provide data export functionality for GDPR-style requests
3. THE System SHALL support data deletion requests within 30 days
4. THE System SHALL mask BVN numbers (show only last 4 digits)

### NFR5: Usability

#### NFR5.1 - Accessibility

1. THE System SHALL support screen readers (WCAG 2.1 Level A)
2. THE System SHALL maintain 4.5:1 color contrast ratio
3. THE System SHALL be keyboard-navigable

#### NFR5.2 - Browser Support

1. THE System SHALL support mobile PWA on Chrome 100+, Safari 15+ (iOS), and Samsung Internet
2. THE System SHALL support desktop browsers: Chrome 100+, Firefox 100+, Safari 15+, and Edge 100+
3. THE System SHALL be responsive for mobile (375x667, 390x844, 414x896), tablet (1024x768), and desktop (1920x1080)

#### NFR5.3 - User Experience

1. THE System SHALL complete critical user flows in <5 clicks
2. THE System SHALL complete vendor registration in <3 minutes (Tier 1)
3. THE System SHALL complete bid placement in <1 minute
4. THE System SHALL provide actionable and user-friendly error messages in Nigerian English
5. THE System SHALL provide help tooltips for complex fields

## Success Metrics Summary

### Week 1-4 (MVP Launch)
- 50+ Tier 1 vendors registered via BVN
- 70%+ mobile traffic from vendor users
- <3 min average case creation time (mobile)
- <10 min payment verification (Paystack)

### Month 2-3 (Growth Phase)
- 200+ salvage cases processed
- 35%+ recovery rate (vs 22% baseline)
- <3 days average processing time (vs 14+ days)
- 40%+ repeat bidders monthly

### Month 4-6 (Scale Phase)
- 500+ active vendors (100 Tier 2, 400 Tier 1)
- ₦10M+ transaction volume monthly
- 99.5%+ uptime
- 4.5+/5 user satisfaction rating

## Implementation Timeline (8-Week Sprint)

### Week 1-2: Foundation & Mobile Core
- PWA setup (Workbox, service workers)
- Mobile-responsive UI (Tailwind CSS)
- User authentication (JWT + OAuth + biometric)
- Mobile camera upload
- Voice-to-text integration
- Offline mode implementation

### Week 3-4: Core Features & Payments
- Salvage case creation (mobile-optimized)
- AI damage assessment (Google Vision)
- Paystack/Flutterwave integration
- BVN verification (Paystack Identity API)
- Tiered vendor registration
- SMS/Email notifications (Termii/SendGrid)

### Week 5-6: Bidding & Gamification
- Real-time bidding (WebSockets)
- Countdown timers
- Auto-extend logic
- Push notifications
- Vendor leaderboards
- Ratings & reviews

### Week 7-8: Polish & Launch
- Escrow wallet system
- Fraud detection (basic)
- Mobile dashboards (PWA)
- WhatsApp sharing
- Testing (mobile devices, load, security)
- Beta launch (20 vendors)

