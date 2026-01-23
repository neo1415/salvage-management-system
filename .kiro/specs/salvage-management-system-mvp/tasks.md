# Implementation Plan: Salvage Management System MVP

## Overview

This implementation plan breaks down the 8-week MVP development into granular, actionable tasks following Clean Architecture principles and enterprise-grade development standards. Each task references specific requirements, includes testing requirements, and specifies exact file paths using Next.js 15 App Router conventions.

**Timeline**: 8 weeks (4 sprints × 2 weeks)
**Tech Stack**: Next.js 15, TypeScript, PostgreSQL, Drizzle ORM, Socket.io, Tailwind CSS
**Architecture**: Clean Architecture with mobile-first PWA approach

## Sprint 1: Foundation & Authentication (Week 1-2)

### Epic 0: Public Landing Page

- [x] 0.1 Install animation and UI libraries
  - Install Framer Motion: `npm install framer-motion`
  - Install React Type Animation: `npm install react-type-animation`
  - Install Spline for 3D: `npm install @splinetool/react-spline`
  - Install Three.js: `npm install three @react-three/fiber @react-three/drei`
  - Install AOS: `npm install aos`
  - Install GSAP: `npm install gsap`
  - Install React Intersection Observer: `npm install react-intersection-observer`
  - Install Lucide React for icons: `npm install lucide-react`
  - _Requirements: 0, Enterprise Standards Section 9.1_

- [x] 0.2 Create landing page layout and navigation
  - Create `src/app/page.tsx` as landing page root
  - Create `src/components/landing/navigation.tsx` with sticky header
  - Implement responsive navigation: desktop horizontal menu, mobile hamburger
  - Add navigation links: Home, How It Works, Pricing, Contact, Login (outlined), Sign Up (filled gold button)
  - Add NEM Insurance logo with Burgundy color scheme
  - Implement smooth scroll to sections
  - _Requirements: 0.17, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.3 Build hero section with morphing animations
  - Create `src/components/landing/hero-section.tsx`
  - Implement typing animation for headline using React Type Animation
  - Add morphing background shapes with Framer Motion (circles → squares → organic forms)
  - Implement gradient background (Burgundy #800020 to Gold #FFD700)
  - Add parallax effect on background elements (0.5x scroll speed)
  - Create dual CTAs: "Start Bidding" (primary gold) and "Watch Demo" (outlined white)
  - Implement SVG line drawing animations
  - Target hero load time <1.5s
  - _Requirements: 0.2, 0.3, 0.4, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.4 Build value propositions section with micro-interactions
  - Create `src/components/landing/value-props.tsx`
  - Create 4 value prop cards: Instant Payments, Mobile PWA, AI Assessment, Gamified Leaderboards
  - Implement card hover effects: lift (translateY: -8px), shadow expansion, glow pulse
  - Add icon bounce animation on hover using Framer Motion
  - Implement scroll-triggered fade-in with stagger effect (0.1s delay between cards)
  - Use gradient text for section heading (Burgundy → Gold)
  - _Requirements: 0.5, 0.12, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.5 Build 3D product showcase with Spline
  - Create `src/components/landing/product-showcase.tsx`
  - Integrate Spline 3D dashboard mockup (draggable/rotatable)
  - Implement parallax layers for mobile app screens
  - Add hover zoom effect on screenshots
  - Create zigzag layout: text left, 3D model right (alternating)
  - Add feature checklist with animated checkmarks
  - Lazy load 3D model on viewport entry
  - _Requirements: 0.6, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.6 Build "How It Works" section with step animations
  - Create `src/components/landing/how-it-works.tsx`
  - Create 5 steps: Register & Verify, Browse Auctions, Place Bids, Pay Instantly, Collect Salvage
  - Implement zigzag layout with alternating image/text blocks
  - Add animated progress line that draws as user scrolls
  - Implement step icons with entrance animations (slide from sides)
  - Add step numbers with circular progress indicators
  - _Requirements: 0.17, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.7 Build social proof section with animated counters
  - Create `src/components/landing/social-proof.tsx`
  - Implement animated stat counters: "₦10M+ Processed", "500+ Active Vendors", "35-45% Recovery Rate"
  - Create customer testimonials carousel with auto-play and manual controls
  - Add trust badges: "Powered by NEM Insurance", "Secure BVN Verification", "SSL Encrypted"
  - Implement counter animation on scroll into view (count from 0 to target)
  - Add vendor testimonials with photos and ratings
  - _Requirements: 0.8, 0.20, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.8 Build collapsible FAQ section
  - Create `src/components/landing/faq-section.tsx`
  - Add 5-8 common questions with collapsible answers
  - Implement smooth height transitions (max-height animation)
  - Add rotate animation for chevron icons
  - Implement subtle background color change on hover
  - Add search/filter functionality for FAQs
  - _Requirements: 0.9, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.9 Build contact section with embedded map
  - Create `src/components/landing/contact-section.tsx`
  - Display contact info: Phone "234-02-014489560", Email "nemsupport@nem-insurance.com"
  - Display address: "NEM Insurance Plc, 199 Ikorodu Road, Obanikoro, Lagos"
  - Embed Google Maps with NEM Insurance location marker
  - Add contact form with validation (name, email, phone, message)
  - Implement form submission with success/error states
  - _Requirements: 0.10, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.10 Build sticky floating CTA with progress bar
  - Create `src/components/landing/floating-cta.tsx`
  - Implement sticky button that appears after 30% scroll
  - Add morphing text: "Start Free" → "Join 500+ Vendors" → "Get Started Now"
  - Display scroll progress bar below button
  - Add pulsing animation every 5 seconds
  - Implement click handler to scroll to registration
  - _Requirements: 0.11, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.11 Build footer section
  - Create `src/components/landing/footer.tsx`
  - Add company info and logo
  - Add quick links: About, Privacy Policy, Terms of Service, Contact
  - Add social media icons (LinkedIn, Twitter, Facebook)
  - Display copyright notice
  - Implement newsletter signup form
  - _Requirements: 0.17, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.12 Implement scroll-triggered animations with AOS
  - Initialize AOS library in root layout
  - Add fade-in animations to all major sections
  - Implement slide-in animations for cards and images
  - Add zoom-in effects for icons and badges
  - Configure animation duration (800ms) and easing (ease-out)
  - Ensure animations trigger once (no repeat on scroll up)
  - _Requirements: 0.2, 0.3, NFR5.3, Enterprise Standards Section 9.1_

- [x] 0.13 Optimize landing page performance
  - Implement lazy loading for images using Next.js Image component
  - Add WebP format with fallback to JPG/PNG
  - Lazy load 3D models and heavy animations on viewport entry
  - Implement code splitting for animation libraries
  - Add service worker caching for static assets
  - Optimize bundle size (target: <500KB initial load)
  - Run Lighthouse audit (target: 90+ score)
  - _Requirements: 0.15, 0.22, NFR1.1, Enterprise Standards Section 8.3_

- [x] 0.14 Implement SEO optimization
  - Add meta title: "Salvage Management System - AI-Powered Auctions for Nigerian Vendors"
  - Add meta description (155 characters max)
  - Add Open Graph tags for social sharing
  - Add Twitter Card tags
  - Implement structured data (JSON-LD) for organization
  - Add canonical URL
  - Create sitemap.xml
  - Create robots.txt
  - _Requirements: 0.21, Enterprise Standards Section 11_

- [x] 0.15 Test landing page responsiveness
  - Test on mobile devices: iPhone 13 (390x844), Samsung Galaxy S21 (360x800), Tecno Spark (375x667)
  - Test on tablet: iPad (1024x768)
  - Test on desktop: 1920x1080, 1366x768
  - Verify all animations work smoothly on mobile
  - Test touch interactions (tap, swipe, pinch-zoom)
  - Verify page load <2s on 3G network
  - _Requirements: 0.16, NFR5.2, NFR5.3, Enterprise Standards Section 7_

### Epic 1: Project Setup & Infrastructure

- [x] 1. Initialize Next.js 15 project with TypeScript strict mode
  - Create Next.js 15 app with App Router: `npx create-next-app@latest salvage-management-system --typescript --tailwind --app`
  - Configure `tsconfig.json` with strict mode: `"strict": true, "noImplicitAny": true, "strictNullChecks": true`
  - Configure `next.config.js` for PWA support
  - Set up folder structure following Clean Architecture (src/app, src/components, src/features, src/lib)
  - Configure Tailwind CSS with NEM Insurance color scheme (Burgundy #800020, White #FFFFFF, Gold #FFD700)
  - _Requirements: NFR5.2, Enterprise Standards Section 1.1_

- [x] 2. Set up database with Drizzle ORM and PostgreSQL
  - Install Drizzle ORM: `npm install drizzle-orm postgres`
  - Install Drizzle Kit: `npm install -D drizzle-kit`
  - Create `drizzle.config.ts` with Supabase connection
  - Create database schema files in `src/lib/db/schema/`:
    - `users.ts` with userRoleEnum, userStatusEnum, deviceTypeEnum
    - `vendors.ts` with vendorTierEnum, vendorStatusEnum, assetTypeEnum
    - `cases.ts` with damageSeverityEnum, caseStatusEnum
    - `auctions.ts` with auctionStatusEnum
    - `bids.ts`
    - `payments.ts` with paymentMethodEnum, escrowStatusEnum, paymentStatusEnum
    - `escrow.ts` with transactionTypeEnum
    - `audit-logs.ts`
  - Create indexes for all foreign keys and frequently queried columns
  - Generate and run initial migration: `npx drizzle-kit generate:pg && npx drizzle-kit push:pg`
  - _Requirements: NFR2.1, Enterprise Standards Section 4_

- [x] 2.1 Write property test for database schema validation
  - **Property 1: Registration Input Validation** (email, phone, password format)
  - **Validates: Requirements 1.2, 1.3, 1.4**
  - Test file: `tests/unit/db/schema-validation.test.ts`
  - Use fast-check to generate random user data and validate against schema constraints

- [ ] 3. Configure authentication with NextAuth.js v5
  - Install NextAuth.js v5: `npm install next-auth@beta`
  - Create `src/lib/auth/next-auth.config.ts` with JWT strategy
  - Configure credentials provider for email/phone + password login
  - Configure OAuth providers (Google, Facebook)
  - Create `src/app/api/auth/[...nextauth]/route.ts`
  - Implement session management with Redis caching
  - Configure JWT token expiry (24h desktop, 2h mobile)
  - _Requirements: 8, 9, NFR4.1, Enterprise Standards Section 6.1_

- [ ] 4. Set up Redis for caching and session management
  - Install Redis client: `npm install ioredis`
  - Create `src/lib/redis/client.ts` with connection configuration
  - Implement session storage in Redis
  - Implement cache utilities for frequently accessed data
  - Configure TTL for different cache types (sessions: 2h mobile/24h desktop, auction data: 5min)
  - _Requirements: NFR1.2, NFR2.1, Enterprise Standards Section 8.3_

- [ ] 5. Configure file storage with Cloudinary
  - Install Cloudinary SDK: `npm install cloudinary`
  - Create `src/lib/storage/cloudinary.ts` with upload/delete functions
  - Configure image transformation presets (compression, resizing)
  - Implement signed upload URLs for secure uploads
  - Configure folder structure: `/salvage-cases/{caseId}/`, `/kyc-documents/{vendorId}/`
  - _Requirements: 12.8, 12.9, Enterprise Standards Section 14.2_

- [ ] 6. Set up PWA with service workers
  - Install Workbox: `npm install workbox-webpack-plugin workbox-window`
  - Create `public/sw.js` with Workbox service worker
  - Implement caching strategies: CacheFirst for images, NetworkFirst for API, StaleWhileRevalidate for static assets
  - Implement background sync for offline case submissions
  - Create `public/manifest.json` with PWA configuration
  - Configure Next.js for PWA support in `next.config.js`
  - _Requirements: 13, NFR5.2, Enterprise Standards Section 14.2_

- [ ] 6.1 Write E2E test for PWA installation
  - Test file: `tests/e2e/pwa-installation.spec.ts`
  - Verify PWA can be installed on mobile devices
  - Verify offline mode works correctly
  - Verify service worker caches assets


### Epic 2: User Registration & Authentication

- [ ] 7. Implement user registration API
  - Create `src/app/api/auth/register/route.ts` with POST handler
  - Create `src/features/auth/services/auth.service.ts` with `register()` method
  - Implement input validation using Zod schema in `src/lib/utils/validation.ts`
  - Hash passwords with bcrypt (12 rounds)
  - Create user record with status 'unverified_tier_0'
  - Send welcome email via Resend
  - Create audit log entry
  - _Requirements: 1, Enterprise Standards Section 6.1_

- [ ] 7.1 Write property test for password validation
  - **Property 1: Registration Input Validation** (password requirements)
  - **Validates: Requirement 1.2**
  - Test file: `tests/unit/auth/password-validation.test.ts`
  - Generate random passwords and verify validation logic

- [ ] 7.2 Write unit tests for registration edge cases
  - Test duplicate email/phone rejection
  - Test invalid email format rejection
  - Test weak password rejection
  - Test missing required fields
  - Test file: `tests/unit/auth/registration.test.ts`

- [ ] 8. Implement OAuth registration (Google & Facebook)
  - Configure Google OAuth in NextAuth.js config
  - Configure Facebook OAuth in NextAuth.js config
  - Create OAuth callback handler in `src/features/auth/services/oauth.service.ts`
  - Auto-populate user data from OAuth provider
  - Prompt for phone number if not provided by OAuth
  - Create user record with status 'unverified_tier_0'
  - _Requirements: 2, Enterprise Standards Section 6.1_

- [ ] 9. Implement SMS OTP verification
  - Install Termii SDK: `npm install termii-node`
  - Create `src/features/auth/services/otp.service.ts`
  - Implement `sendOTP()` method with Termii API integration
  - Implement `verifyOTP()` method with 5-minute expiry check
  - Store OTP in Redis with 5-minute TTL
  - Implement rate limiting (max 3 attempts before resend required)
  - Update user status to 'phone_verified_tier_0' on success
  - Create audit log entry
  - _Requirements: 3, Enterprise Standards Section 6.1_

- [ ] 9.1 Write property test for OTP expiry and validation
  - **Property 4: OTP Expiry and Validation**
  - **Validates: Requirements 3.3, 3.4, 3.5**
  - Test file: `tests/unit/auth/otp-validation.test.ts`
  - Generate random OTPs and verify expiry logic

- [ ] 10. Implement login API (email/phone + password)
  - Create `src/app/api/auth/login/route.ts` (handled by NextAuth.js)
  - Implement credentials provider in NextAuth.js config
  - Support login with email OR phone number
  - Verify password with bcrypt
  - Generate JWT token with appropriate expiry (24h desktop, 2h mobile)
  - Store session in Redis
  - Implement account lockout after 5 failed attempts (30-minute cooldown)
  - Create audit log entry with IP address and device type
  - _Requirements: 8, NFR4.1, Enterprise Standards Section 6.1_

- [ ] 10.1 Write integration test for login flow
  - Test file: `tests/integration/auth/login.test.ts`
  - Test successful login with email
  - Test successful login with phone
  - Test failed login with wrong password
  - Test account lockout after 5 failures

- [ ] 11. Implement comprehensive audit logging
  - Create `src/lib/utils/audit-logger.ts` with `logAction()` function
  - Implement middleware to capture IP address, device type, user agent
  - Create audit log entries for all user actions (authentication, case management, bidding, payments, KYC, profile updates, admin actions)
  - Store logs in `audit_logs` table with immutable constraint
  - Implement 2-year retention policy
  - _Requirements: 11, NFR4.3, Enterprise Standards Section 6.4_

- [ ] 11.1 Write property test for audit logging
  - **Property 3: Comprehensive Audit Logging**
  - **Validates: Requirements 11.1-11.6**
  - Test file: `tests/unit/audit/logging.test.ts`
  - Verify all actions create audit logs with required fields

- [ ] 12. Build registration UI components
  - Create `src/components/forms/vendor-registration-form.tsx` with React Hook Form + Zod
  - Create `src/app/(auth)/register/page.tsx` with registration form
  - Implement mobile-responsive design (Tailwind CSS)
  - Add password strength indicator
  - Add real-time validation feedback
  - Implement OAuth buttons (Google, Facebook)
  - Add terms and conditions checkbox
  - _Requirements: 1, 2, NFR5.3, Enterprise Standards Section 9.1_

- [ ] 13. Build OTP verification UI
  - Create `src/app/(auth)/verify-otp/page.tsx` with OTP input
  - Implement 6-digit OTP input with auto-focus
  - Add countdown timer showing remaining time (5 minutes)
  - Add resend OTP button (disabled until timer expires)
  - Display error messages for invalid/expired OTPs
  - _Requirements: 3, NFR5.3_

- [ ] 14. Build login UI components
  - Create `src/app/(auth)/login/page.tsx` with login form
  - Support email OR phone number input
  - Add "Remember me" checkbox
  - Add "Forgot password" link
  - Implement OAuth login buttons
  - Display account lockout message after 5 failed attempts
  - _Requirements: 8, 9, NFR5.3_

- [ ] 15. Checkpoint - Ensure all authentication tests pass
  - Run all unit tests: `npm run test:unit`
  - Run all integration tests: `npm run test:integration`
  - Verify 80%+ code coverage for auth module
  - Test registration flow end-to-end on mobile device
  - Test OAuth flow with Google and Facebook
  - Test OTP verification flow
  - Ask the user if questions arise


## Sprint 2: Core Features & Payments (Week 3-4)

### Epic 3: Vendor KYC & Verification

- [ ] 16. Implement BVN verification service
  - Install Mono/Okra SDK: `npm install @mono.co/connect-node` or `npm install okra-js`
  - Create `src/features/vendors/services/bvn-verification.service.ts`
  - Implement `verifyBVN()` method calling Mono/Okra API
  - Implement BVN matching logic (name, DOB, phone)
  - Implement `encryptBVN()` using AES-256 encryption
  - Implement `decryptBVN()` for internal use
  - Implement `maskBVN()` to show only last 4 digits (****7890)
  - _Requirements: 4, NFR4.2, Enterprise Standards Section 6.1_

- [ ] 16.1 Write property test for BVN encryption round-trip
  - **Property 5: BVN Security (Encryption and Masking)**
  - **Validates: Requirements 4.8, 4.9, NFR4.3**
  - Test file: `tests/unit/vendors/bvn-encryption.test.ts`
  - Verify encrypt → decrypt produces original value

- [ ] 16.2 Write property test for BVN verification matching
  - **Property 6: BVN Verification Matching**
  - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
  - Test file: `tests/unit/vendors/bvn-verification.test.ts`
  - Generate random BVN responses and test matching logic

- [ ] 17. Implement Tier 1 KYC API
  - Create `src/app/api/vendors/verify-bvn/route.ts` with POST handler
  - Validate 11-digit BVN format
  - Call BVN verification service
  - Match BVN details against user registration data
  - Auto-approve to Tier 1 on successful match
  - Update vendor status to 'verified_tier_1'
  - Send SMS + Email notification
  - Create audit log entry
  - _Requirements: 4, Enterprise Standards Section 6.1_

- [ ] 18. Implement Tier 2 KYC API
  - Create `src/app/api/vendors/tier2-kyc/route.ts` with POST handler
  - Accept document uploads (CAC certificate, bank statement, NIN card)
  - Upload documents to Cloudinary with encryption
  - Extract NIN from ID using Google Document AI OCR
  - Verify NIN via API
  - Verify bank account via Paystack/Mono API
  - Validate CAC number against SCUML/CAC database (if available)
  - Set status to 'pending' for manual review
  - Notify Salvage Manager
  - Send SMS + Email to vendor
  - _Requirements: 6, Enterprise Standards Section 6.1_

- [ ] 19. Implement Tier 2 approval workflow
  - Create `src/app/api/vendors/[id]/approve/route.ts` with POST handler
  - Allow Salvage Manager to approve/reject Tier 2 applications
  - Display all uploaded documents and verification statuses
  - Require comment for rejection
  - Update vendor status to 'verified_tier_2' on approval
  - Send SMS + Email notification
  - Create audit log entry
  - _Requirements: 7, Enterprise Standards Section 6.1_

- [ ] 20. Build Tier 1 KYC UI
  - Create `src/app/(dashboard)/vendor/kyc/tier1/page.tsx`
  - Add BVN input field (11 digits)
  - Add date of birth confirmation
  - Display verification progress indicator
  - Show success message with Tier 1 badge
  - Show specific error messages for mismatches
  - _Requirements: 4, NFR5.3_

- [ ] 21. Build Tier 2 KYC UI
  - Create `src/app/(dashboard)/vendor/kyc/tier2/page.tsx`
  - Add business information form (business name, CAC, TIN)
  - Add bank account details form
  - Add document upload fields (CAC certificate, bank statement, NIN card)
  - Implement drag-and-drop file upload
  - Show upload progress
  - Display pending approval status
  - _Requirements: 6, NFR5.3_

- [ ] 22. Build Tier 2 approval UI for Salvage Manager
  - Create `src/app/(dashboard)/manager/vendors/page.tsx`
  - Display Tier 2 KYC review queue
  - Show vendor details and uploaded documents
  - Display verification statuses (BVN ✓, NIN ✓, Bank Account ✓, CAC pending)
  - Add approve/reject buttons with comment field
  - _Requirements: 7, NFR5.3_

- [ ] 23. Implement Tier upgrade prompts
  - Create modal component `src/components/ui/tier-upgrade-modal.tsx`
  - Display modal when Tier 1 vendor clicks auction >₦500k
  - Show Tier 2 benefits (unlimited bidding, priority support, leaderboard)
  - Add "Upgrade Now" button redirecting to Tier 2 KYC page
  - Display dismissible banner in vendor dashboard
  - Reappear banner every 3 days after dismissal
  - _Requirements: 5, NFR5.3_


### Epic 4: Mobile Case Creation

- [ ] 24. Implement AI damage assessment service
  - Install Google Cloud Vision SDK: `npm install @google-cloud/vision`
  - Install Google Document AI SDK: `npm install @google-cloud/documentai`
  - Create `src/features/cases/services/ai-assessment.service.ts`
  - Implement `assessDamage()` method calling Google Cloud Vision API
  - Parse API response to extract damage labels and confidence scores
  - Calculate damage severity (Minor 40-60%, Moderate 20-40%, Severe 5-20%)
  - Calculate estimated salvage value: marketValue × damagePercentage
  - Calculate reserve price: estimatedValue × 0.7
  - Implement `extractTextFromDocument()` for OCR
  - _Requirements: 14, Enterprise Standards Section 5_

- [ ] 24.1 Write property test for AI assessment completeness
  - **Property 9: AI Damage Assessment Completeness**
  - **Validates: Requirements 14.3-14.7**
  - Test file: `tests/unit/cases/ai-assessment.test.ts`
  - Verify all required fields are present in assessment

- [ ] 25. Implement image compression service
  - Install TinyPNG SDK: `npm install tinify`
  - Create `src/lib/integrations/tinypng.ts`
  - Implement `compressImage()` method
  - Configure compression settings for mobile data savings
  - Integrate with Cloudinary upload pipeline
  - _Requirements: 12.9, Enterprise Standards Section 14.2_

- [ ] 25.1 Write property test for image compression
  - **Property 8: Image Compression**
  - **Validates: Requirement 12.9**
  - Test file: `tests/unit/cases/image-compression.test.ts`
  - Verify compressed size ≤ original size

- [ ] 26. Implement case creation API
  - Create `src/app/api/cases/route.ts` with POST handler
  - Create `src/features/cases/services/case.service.ts`
  - Validate claim reference uniqueness
  - Validate asset type and required details
  - Upload photos to Cloudinary with compression
  - Call AI assessment service
  - Capture GPS coordinates
  - Save voice-to-text notes
  - Create case record with status 'draft' or 'pending_approval'
  - Create audit log entry
  - _Requirements: 12, Enterprise Standards Section 5_

- [ ] 26.1 Write property test for case creation validation
  - **Property 7: Case Creation Field Validation**
  - **Validates: Requirements 12.3-12.8**
  - Test file: `tests/unit/cases/case-validation.test.ts`
  - Generate random case data and verify validation

- [ ] 27. Implement offline case sync
  - Create IndexedDB schema for offline cases in `src/lib/db/indexeddb.ts`
  - Implement service worker background sync
  - Create sync queue in `src/features/cases/services/offline-sync.service.ts`
  - Implement conflict resolution (show modal if case edited online while offline)
  - Display sync progress indicator
  - _Requirements: 13, Enterprise Standards Section 14.2_

- [ ] 27.1 Write property test for offline case sync
  - **Property 23: Offline Case Sync**
  - **Validates: Requirements 13.5-13.9**
  - Test file: `tests/unit/cases/offline-sync.test.ts`
  - Verify cases sync correctly when connection restored

- [ ] 28. Build mobile case creation UI
  - Create `src/app/(dashboard)/adjuster/cases/new/page.tsx`
  - Implement mobile-optimized form with React Hook Form + Zod
  - Add claim reference input with auto-validation
  - Add asset type dropdown with conditional fields
  - Add market value input with ₦ formatting
  - Implement mobile camera upload (3-10 photos)
  - Add GPS auto-capture with location display
  - Implement Web Speech API for voice-to-text notes
  - Add "Save as Draft" and "Submit for Approval" buttons
  - Display AI assessment results
  - Show offline indicator when no internet
  - _Requirements: 12, 13, NFR5.3, Enterprise Standards Section 9.1_

- [ ] 29. Implement case approval API
  - Create `src/app/api/cases/[id]/approve/route.ts` with POST handler
  - Allow Salvage Manager to approve/reject cases
  - Require comment for rejection
  - Auto-create auction on approval
  - Update case status to 'approved' or return to adjuster
  - Notify vendors matching asset categories
  - Create audit log entry
  - _Requirements: 15, Enterprise Standards Section 5_

- [ ] 30. Build mobile case approval UI for Salvage Manager
  - Create `src/app/(dashboard)/manager/approvals/page.tsx`
  - Display approval queue in mobile-optimized card layout
  - Show case details: ID, asset type, estimated value, AI confidence, adjuster, submission time
  - Implement swipeable photo gallery
  - Display AI assessment results
  - Show GPS location on map
  - Add approve/reject buttons with comment field
  - Send push notification when new case awaits approval
  - _Requirements: 15, NFR5.3, Enterprise Standards Section 9.1_


### Epic 5: Payment Processing

- [ ] 31. Implement Paystack integration
  - Install Paystack SDK: `npm install paystack`
  - Create `src/features/payments/services/paystack.service.ts`
  - Implement `initiatePayment()` method generating payment link
  - Implement `verifyPayment()` method for manual verification
  - Implement webhook handler in `src/app/api/webhooks/paystack/route.ts`
  - Verify webhook signature using Paystack secret
  - Validate payment reference and amount
  - Auto-verify payment and generate pickup authorization
  - Send SMS + Email notification
  - Create audit log entry
  - _Requirements: 24, 27, Enterprise Standards Section 6.2_

- [ ] 31.1 Write property test for webhook verification
  - **Property 14: Payment Webhook Verification**
  - **Validates: Requirements 24.6, 24.7, 24.8**
  - Test file: `tests/unit/payments/paystack-webhook.test.ts`
  - Generate random webhook payloads and verify signature validation

- [ ] 31.2 Write integration test for payment flow
  - Test file: `tests/integration/payments/paystack-payment.test.ts`
  - Test complete payment flow from initiation to verification
  - Test webhook processing
  - Test pickup authorization generation

- [ ] 32. Implement Flutterwave integration (backup)
  - Install Flutterwave SDK: `npm install flutterwave-node-v3`
  - Create `src/features/payments/services/flutterwave.service.ts`
  - Implement same methods as Paystack service
  - Implement webhook handler in `src/app/api/webhooks/flutterwave/route.ts`
  - _Requirements: 24, Enterprise Standards Section 6.2_

- [ ] 33. Implement bank transfer payment
  - Create `src/app/api/payments/[id]/upload-proof/route.ts` with POST handler
  - Accept payment receipt/screenshot upload (JPG/PDF, max 5MB)
  - Upload to Cloudinary
  - Set payment status to 'pending'
  - Notify Finance Officer
  - _Requirements: 25, Enterprise Standards Section 6.2_

- [ ] 34. Implement manual payment verification
  - Create `src/app/api/payments/[id]/verify/route.ts` with POST handler
  - Allow Finance Officer to approve/reject payments
  - Verify amount matches invoice
  - Verify bank details match vendor registration
  - Generate pickup authorization on approval
  - Send SMS + Email notification
  - Create audit log entry
  - _Requirements: 28, Enterprise Standards Section 6.2_

- [ ] 35. Implement payment deadline enforcement
  - Create cron job in `src/lib/cron/payment-deadlines.ts`
  - Run every hour to check payment deadlines
  - Send SMS reminder 12 hours before deadline
  - Flag payments as 'overdue' after 24 hours
  - Forfeit auction winner after 48 hours
  - Re-list item for auction
  - Suspend vendor for 7 days
  - Create audit log entries
  - _Requirements: 29, 30, Enterprise Standards Section 5_

- [ ] 35.1 Write property test for payment deadline enforcement
  - **Property 17: Payment Deadline Enforcement**
  - **Validates: Requirements 29.1, 30.2-30.8**
  - Test file: `tests/unit/payments/deadline-enforcement.test.ts`
  - Verify deadline logic works correctly

- [ ] 36. Build payment UI for vendors
  - Create `src/app/(dashboard)/vendor/payments/[id]/page.tsx`
  - Display item details, winning bid amount, payment deadline countdown
  - Add "Pay Now with Paystack" button
  - Add "Pay via Bank Transfer" option with bank details
  - Add payment proof upload for bank transfers
  - Display payment status (Pending, Verified, Rejected, Overdue)
  - _Requirements: 24, 25, NFR5.3_

- [ ] 37. Build payment verification UI for Finance Officer
  - Create `src/app/(dashboard)/finance/payments/page.tsx`
  - Display pending payments queue
  - Show total payments today, auto-verified count, pending manual verification count, overdue count
  - Display pie chart: auto-verified vs manual (target: 90%+ auto)
  - Show uploaded payment receipts
  - Add approve/reject buttons with comments
  - _Requirements: 27, 28, NFR5.3_

- [ ] 38. Checkpoint - Ensure all core features tests pass
  - Run all unit tests: `npm run test:unit`
  - Run all integration tests: `npm run test:integration`
  - Verify 80%+ code coverage for vendors, cases, and payments modules
  - Test BVN verification flow end-to-end
  - Test case creation flow on mobile device
  - Test payment flow with Paystack webhook
  - Ask the user if questions arise


## Sprint 3: Real-Time Bidding & Gamification (Week 5-6)

### Epic 6: Auction & Bidding System

- [ ] 39. Set up Socket.io server
  - Install Socket.io: `npm install socket.io socket.io-client`
  - Create `src/lib/socket/server.ts` with Socket.io server configuration
  - Implement authentication middleware for Socket.io
  - Define Socket.io events (auction:watch, auction:unwatch, bid:place, auction:updated, auction:new-bid, etc.)
  - Integrate with Next.js API route: `src/app/api/socket/route.ts`
  - _Requirements: 16-21, NFR1.1, Enterprise Standards Section 10_

- [ ] 40. Implement auction creation service
  - Create `src/features/auctions/services/auction.service.ts`
  - Implement `createAuction()` method (auto-triggered on case approval)
  - Set start time = now, end time = now + 5 days
  - Set minimum increment = ₦10,000
  - Set status = 'active'
  - Notify matching vendors via SMS + Email + Push
  - Create audit log entry
  - _Requirements: 15, 22, Enterprise Standards Section 5_

- [ ] 41. Implement bidding service
  - Create `src/features/auctions/services/bidding.service.ts`
  - Implement `placeBid()` method with OTP verification
  - Validate bid amount > current bid + minimum increment
  - Validate vendor tier vs auction value (Tier 1 ≤₦500k, Tier 2 unlimited)
  - Validate auction is in 'active' status
  - Update auction current bid and current bidder
  - Broadcast new bid via Socket.io within 2 seconds
  - Send push notification to previous highest bidder within 5 seconds
  - Create audit log entry with IP address
  - _Requirements: 18, 19, Enterprise Standards Section 5_

- [ ] 41.1 Write property test for bid validation
  - **Property 11: Bid Validation**
  - **Validates: Requirements 18.2, 18.3, 5.6**
  - Test file: `tests/unit/auctions/bid-validation.test.ts`
  - Generate random bids and verify validation logic

- [ ] 41.2 Write property test for real-time bid broadcasting
  - **Property 12: Real-Time Bid Broadcasting**
  - **Validates: Requirements 18.8, 19.4**
  - Test file: `tests/unit/auctions/bid-broadcasting.test.ts`
  - Verify WebSocket broadcasts within 2 seconds

- [ ] 42. Implement auction auto-extension logic
  - Create `src/features/auctions/services/auto-extend.service.ts`
  - Check if bid placed when <5 minutes remaining
  - Extend end time by 2 minutes
  - Update status to 'extended'
  - Increment extension count
  - Broadcast extension via Socket.io
  - Send push + SMS notification to all bidders
  - Continue extending unlimited times
  - Close auction when no bids for 5 consecutive minutes
  - _Requirements: 21, Enterprise Standards Section 5_

- [ ] 42.1 Write property test for auction auto-extension
  - **Property 13: Auction Auto-Extension**
  - **Validates: Requirements 21.1-21.6**
  - Test file: `tests/unit/auctions/auto-extension.test.ts`
  - Verify extension logic works correctly

- [ ] 43. Implement auction closure service
  - Create `src/features/auctions/services/closure.service.ts`
  - Implement cron job to close auctions at end time
  - Identify winning bidder
  - Update auction status to 'closed'
  - Generate invoice for winner
  - Set payment deadline to 24 hours
  - Send SMS + Email + Push notification with payment link
  - Create audit log entry
  - _Requirements: 24, Enterprise Standards Section 5_

- [ ] 44. Implement watching count tracking
  - Create `src/features/auctions/services/watching.service.ts`
  - Track vendors viewing auction >10 seconds
  - Increment watching count
  - Broadcast updated count via Socket.io
  - Anonymize vendor names
  - _Requirements: 20, Enterprise Standards Section 5_

- [ ] 45. Build mobile auction browsing UI
  - Create `src/app/(dashboard)/vendor/auctions/page.tsx`
  - Display auctions in mobile-optimized card layout (2 cards per row)
  - Show main photo, asset name, current bid, time remaining countdown, watching count
  - Implement filters: asset type, price range, time ending, location
  - Implement search by asset name and claim reference
  - Implement lazy loading (20 auctions initially)
  - Implement infinite scroll
  - Implement pull-to-refresh
  - Target page load <2 seconds on 3G
  - _Requirements: 16, NFR1.1, NFR5.3, Enterprise Standards Section 9.1_

- [ ] 46. Build countdown timer component
  - Create `src/components/ui/countdown-timer.tsx`
  - Format: "Xd Xh Xm Xs" (>24h), "Xh Xm Xs" (1-24h), "Xm Xs" (<1h)
  - Color coding: green (>24h), yellow (1-24h), red (<1h)
  - Pulsing animation when <1h
  - Update every 1 second
  - Sync with server time
  - Send push notification at 1 hour remaining
  - Send SMS notification at 30 minutes remaining
  - _Requirements: 17, NFR5.3_

- [ ] 46.1 Write property test for countdown timer formatting
  - **Property 10: Countdown Timer Formatting**
  - **Validates: Requirements 17.1-17.8**
  - Test file: `tests/unit/components/countdown-timer.test.ts`
  - Generate random time remaining values and verify formatting

- [ ] 47. Build bid placement UI
  - Create `src/components/auction/bid-form.tsx`
  - Display modal with bid amount input
  - Show real-time validation (minimum bid amount)
  - Request SMS OTP on "Confirm Bid"
  - Display OTP input (6 digits, 3 minutes validity)
  - Submit bid after OTP verification
  - Display success message
  - Target total time <1 minute from tap to confirmed bid
  - _Requirements: 18, NFR5.3_

- [ ] 48. Build auction details page
  - Create `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
  - Display full asset details and photos (swipeable gallery)
  - Display AI assessment results
  - Display GPS location on map
  - Display current bid and time remaining
  - Display bid history chart (Recharts line chart)
  - Display watching count
  - Add "Place Bid" button
  - Add "Watch Auction" button
  - Real-time updates via Socket.io
  - _Requirements: 16-22, NFR5.3_


### Epic 7: Notifications & Communication

- [ ] 49. Implement SMS notification service
  - Install Termii SDK: `npm install termii-node`
  - Create `src/features/notifications/services/sms.service.ts`
  - Implement `sendSMS()` method with Termii API
  - Implement SMS templates for: OTP, auction ending, payment reminders, outbid alerts, pickup authorization
  - Implement delivery logging in audit trail
  - Implement fallback to Africa's Talking if Termii fails
  - _Requirements: 40, Enterprise Standards Section 7_

- [ ] 50. Implement email notification service
  - Install Resend SDK: `npm install resend`
  - Create `src/features/notifications/services/email.service.ts`
  - Implement `sendEmail()` method with Resend API
  - Create HTML email templates in `src/features/notifications/templates/`
  - Implement templates for: welcome, OTP, case approval, auction start, bid alerts, payment confirmation
  - Implement delivery logging
  - _Requirements: 40, Enterprise Standards Section 7_

- [ ] 51. Implement push notification service
  - Implement PWA push notification API in `src/features/notifications/services/push.service.ts`
  - Request notification permission on first login
  - Implement `sendPushNotification()` method
  - Implement push templates for: outbid alerts, auction ending soon, payment confirmations, leaderboard updates
  - Implement delivery within 5 seconds
  - Implement fallback to SMS/Email if push fails
  - _Requirements: 19, 40, Enterprise Standards Section 7_

- [ ] 51.1 Write property test for multi-channel notification delivery
  - **Property 24: Multi-Channel Notification Delivery**
  - **Validates: Requirements 40.1-40.6**
  - Test file: `tests/unit/notifications/multi-channel.test.ts`
  - Verify notifications sent via all enabled channels

- [ ] 52. Implement notification preferences
  - Create `src/app/api/notifications/preferences/route.ts` with PUT handler
  - Allow users to toggle SMS, Email, Push on/off
  - Allow per-notification-type control (bid alerts, auction ending, payment reminders, leaderboard updates)
  - Prevent opt-out of critical notifications (OTP, payment deadlines, account suspension)
  - Save preferences to user profile
  - Create audit log entry
  - _Requirements: 39, Enterprise Standards Section 7_

- [ ] 53. Build notification preferences UI
  - Create `src/app/(dashboard)/vendor/settings/notifications/page.tsx`
  - Display toggles for SMS, Email, Push
  - Display per-notification-type controls
  - Disable toggles for critical notifications
  - Save changes immediately
  - _Requirements: 39, NFR5.3_

- [ ] 54. Checkpoint - Ensure all bidding and notification tests pass
  - Run all unit tests: `npm run test:unit`
  - Run all integration tests: `npm run test:integration`
  - Verify 80%+ code coverage for auctions and notifications modules
  - Test real-time bidding with multiple concurrent users
  - Test Socket.io connection stability
  - Test push notification delivery on mobile devices
  - Test auction auto-extension logic
  - Ask the user if questions arise


## Sprint 4: Advanced Features & Polish (Week 7-8)

### Epic 8: Escrow Wallet & Advanced Payments

- [ ] 55. Implement escrow wallet service
  - Create `src/features/payments/services/escrow.service.ts`
  - Implement `fundWallet()` method with Paystack integration
  - Implement `freezeFunds()` method when vendor wins auction
  - Implement `releaseFunds()` method after pickup confirmation
  - Implement `getBalance()` method with Redis caching
  - Implement `getTransactions()` method
  - Maintain invariant: balance = availableBalance + frozenAmount
  - Create wallet transaction records
  - _Requirements: 26, Enterprise Standards Section 5_

- [ ] 55.1 Write property test for wallet balance invariant
  - **Property 15: Escrow Wallet Balance Invariant**
  - **Validates: Requirements 26.4-26.9**
  - Test file: `tests/unit/payments/escrow-wallet.test.ts`
  - Verify balance invariant holds after all transactions

- [ ] 55.2 Write property test for wallet transaction round-trip
  - **Property 16: Wallet Transaction Round-Trip**
  - **Validates: Requirements 26.5-26.8**
  - Test file: `tests/unit/payments/wallet-round-trip.test.ts`
  - Verify freeze → unfreeze restores original state

- [ ] 56. Implement escrow wallet API
  - Create `src/app/api/payments/wallet/fund/route.ts` with POST handler
  - Create `src/app/api/payments/wallet/balance/route.ts` with GET handler
  - Create `src/app/api/payments/wallet/transactions/route.ts` with GET handler
  - Accept funding amounts ₦50k - ₦5M
  - Credit funds immediately after Paystack confirmation
  - Cache balance in Redis for instant checks
  - _Requirements: 26, Enterprise Standards Section 5_

- [ ] 57. Build escrow wallet UI
  - Create `src/app/(dashboard)/vendor/wallet/page.tsx`
  - Display wallet balance prominently
  - Display available balance and frozen amount
  - Add "Add Funds" button redirecting to Paystack
  - Display transaction history table (date, type, amount, balance)
  - Show real-time balance updates
  - _Requirements: 26, NFR5.3_

### Epic 9: Dashboards & Reporting

- [ ] 58. Implement Manager dashboard API
  - Create `src/app/api/dashboard/manager/route.ts` with GET handler
  - Calculate KPIs: active auctions count, total bids today, average recovery rate, cases pending approval count
  - Generate charts data: recovery rate trend (last 30 days), top 5 vendors by volume, payment status breakdown
  - Cache dashboard data in Redis (5-minute TTL)
  - Auto-refresh every 30 seconds
  - _Requirements: 31, Enterprise Standards Section 6_

- [ ] 59. Build Manager dashboard UI
  - Create `src/app/(dashboard)/manager/dashboard/page.tsx`
  - Display KPI cards (mobile-responsive)
  - Display charts using Recharts (recovery rate trend, top vendors, payment status)
  - Implement filters: date range, asset type
  - Implement tap-to-drill-down on charts
  - Target load time <2 seconds on mobile
  - _Requirements: 31, NFR5.3, Enterprise Standards Section 9.1_

- [ ] 60. Implement Vendor dashboard API
  - Create `src/app/api/dashboard/vendor/route.ts` with GET handler
  - Calculate performance stats: win rate, average payment time, on-time pickup rate, 5-star rating, leaderboard position
  - Calculate badges: '10 Wins', 'Top Bidder', 'Fast Payer' (avg <6 hours)
  - Calculate comparison to last month
  - _Requirements: 32, Enterprise Standards Section 6_

- [ ] 61. Build Vendor dashboard UI
  - Create `src/app/(dashboard)/vendor/dashboard/page.tsx`
  - Display performance stats in mobile-optimized cards
  - Display badges with icons
  - Display comparison to last month with trend indicators (↑ ↓)
  - Display leaderboard position
  - _Requirements: 32, NFR5.3_

- [ ] 62. Implement vendor leaderboard
  - Create `src/app/api/vendors/leaderboard/route.ts` with GET handler
  - Calculate Top 10 vendors monthly by: total bids, wins, total spent, on-time pickup rate
  - Update weekly (every Monday)
  - Cache leaderboard in Redis
  - _Requirements: 23, Enterprise Standards Section 6_

- [ ] 63. Build vendor leaderboard UI
  - Create `src/app/(dashboard)/vendor/leaderboard/page.tsx`
  - Display Top 10 vendors with metrics
  - Highlight current vendor's position if in Top 10
  - Display trophy icons for Top 3
  - _Requirements: 23, NFR5.3_

- [ ] 64. Implement report generation
  - Create `src/app/api/reports/recovery-summary/route.ts` with GET handler
  - Create `src/app/api/reports/vendor-rankings/route.ts` with GET handler
  - Create `src/app/api/reports/payment-aging/route.ts` with GET handler
  - Create `src/app/api/reports/generate-pdf/route.ts` with POST handler
  - Generate mobile-optimized PDFs (<2MB)
  - Support date range selection
  - Target generation time <10 seconds
  - _Requirements: 33, Enterprise Standards Section 6_

- [ ] 65. Build report generation UI
  - Create `src/app/(dashboard)/manager/reports/page.tsx`
  - Display report options: recovery summary, vendor rankings, payment aging
  - Add date range picker
  - Add "Generate PDF" button
  - Implement native mobile share button (WhatsApp, Email, SMS)
  - _Requirements: 33, NFR5.3_


### Epic 10: Fraud Detection & Security

- [ ] 66. Implement fraud detection service
  - Create `src/features/fraud/services/fraud-detection.service.ts`
  - Implement pattern detection on every bid submission:
    - Pattern 1: Same IP address bidding against itself in same auction
    - Pattern 2: Bid >3x previous bid from vendor account <7 days old
    - Pattern 3: Multiple vendor accounts from same phone/BVN
  - Flag suspicious bids with specific pattern type
  - Send push + email alert to System Admin
  - Mark auction 'Under Review'
  - Temporarily hold vendor's bid
  - Create audit log entry
  - _Requirements: 34, Enterprise Standards Section 6.3_

- [ ] 66.1 Write property test for fraud detection
  - **Property 18: Fraud Detection Pattern Matching**
  - **Validates: Requirements 34.2-34.4**
  - Test file: `tests/unit/fraud/fraud-detection.test.ts`
  - Generate suspicious patterns and verify detection

- [ ] 67. Implement fraud alert review API
  - Create `src/app/api/admin/fraud-alerts/route.ts` with GET handler
  - Create `src/app/api/admin/fraud-alerts/[id]/dismiss/route.ts` with POST handler
  - Create `src/app/api/admin/fraud-alerts/[id]/suspend-vendor/route.ts` with POST handler
  - Allow Admin to dismiss flag (false positive)
  - Allow Admin to suspend vendor (7/30/90 days/permanent)
  - Cancel all active bids on suspension
  - Send SMS + Email notification to vendor
  - Create audit log entry
  - _Requirements: 35, Enterprise Standards Section 6.3_

- [ ] 68. Implement auto-suspend for repeat offenders
  - Create `src/lib/cron/fraud-auto-suspend.ts`
  - Check for vendors with 3+ confirmed fraud flags
  - Auto-suspend account for 30 days
  - Cancel all active bids
  - Send SMS + Email notification
  - Allow Admin to review and reinstate
  - Create audit log entry
  - _Requirements: 36, Enterprise Standards Section 6.3_

- [ ] 69. Build fraud alert dashboard for Admin
  - Create `src/app/(dashboard)/admin/fraud/page.tsx`
  - Display all flagged auctions
  - Show vendor details, bid history, IP addresses, evidence
  - Add actions: dismiss flag, suspend vendor, cancel auction
  - Display suspension duration options (7/30/90 days/permanent)
  - _Requirements: 35, NFR5.3_

### Epic 11: Vendor Ratings & Trust

- [ ] 70. Implement vendor rating service
  - Create `src/features/vendors/services/rating.service.ts`
  - Implement `rateVendor()` method (triggered after pickup confirmation)
  - Accept 5-star rating (1-5 stars)
  - Accept optional text review (max 500 characters)
  - Accept rating categories: payment speed, communication, pickup punctuality
  - Calculate average rating
  - Prevent rating same transaction twice
  - Create audit log entry
  - _Requirements: 37, Enterprise Standards Section 5_

- [ ] 70.1 Write property test for vendor rating calculation
  - **Property 19: Vendor Rating Calculation**
  - **Validates: Requirements 37.5, 37.6**
  - Test file: `tests/unit/vendors/rating-calculation.test.ts`
  - Verify average rating calculation is correct

- [ ] 71. Implement vendor rating API
  - Create `src/app/api/vendors/[id]/ratings/route.ts` with POST handler
  - Validate rating is 1-5 stars
  - Validate review is ≤500 characters
  - Update vendor average rating
  - _Requirements: 37, Enterprise Standards Section 5_

- [ ] 72. Build vendor rating UI
  - Create rating modal component `src/components/vendor/rating-modal.tsx`
  - Display after pickup confirmation
  - Show 5-star rating input
  - Show optional text review textarea
  - Show rating categories (payment speed, communication, pickup punctuality)
  - _Requirements: 37, NFR5.3_

- [ ] 73. Implement trust badges
  - Create badge component `src/components/vendor/trust-badges.tsx`
  - Display badges: 'Verified BVN' (Tier 1), 'Verified Business' (Tier 2), 'Top Rated' (≥4.5 stars), 'Fast Payer' (avg <6 hours)
  - Display on vendor profile, auction bid list, leaderboard
  - Add tooltip on hover explaining badge meaning
  - _Requirements: 38, NFR5.3_

### Epic 12: Admin & System Management

- [ ] 74. Implement staff account creation
  - Create `src/app/api/admin/users/route.ts` with POST handler
  - Allow Admin to create staff accounts (Claims Adjuster, Salvage Manager, Finance Officer)
  - Generate temporary password
  - Email temporary password to new user
  - Force password change on first login
  - Auto-assign role-based permissions
  - Create audit log entry
  - Target provisioning time <3 minutes
  - _Requirements: 10, Enterprise Standards Section 6.1_

- [ ] 75. Build admin user management UI
  - Create `src/app/(dashboard)/admin/users/page.tsx`
  - Display user list with filters (role, status)
  - Add "Add New User" button
  - Display form: full name, email, phone, role dropdown
  - _Requirements: 10, NFR5.3_

- [ ] 76. Implement audit log viewer
  - Create `src/app/api/admin/audit-logs/route.ts` with GET handler
  - Support filtering by: user, date range, action type, entity type
  - Support pagination (50 logs per page)
  - Support export to CSV/Excel
  - _Requirements: 11, Enterprise Standards Section 6.4_

- [ ] 77. Build audit log viewer UI
  - Create `src/app/(dashboard)/admin/audit-logs/page.tsx`
  - Display audit logs table with filters
  - Show: timestamp, user, action type, entity, IP address, device type
  - Add export button
  - _Requirements: 11, NFR5.3_


### Epic 13: Testing & Quality Assurance

- [ ] 78. Write comprehensive unit tests
  - Achieve 80%+ code coverage overall
  - Achieve 100% coverage for critical paths: payment processing, BVN verification, auction closure, security/authentication
  - Write unit tests for all services, utilities, and validation functions
  - Use Vitest + React Testing Library
  - Test files in `tests/unit/` matching source structure
  - _Requirements: All, Enterprise Standards Section 7_

- [ ] 79. Write integration tests
  - Test API endpoints with Supertest
  - Test database operations with test database
  - Test external API integrations with mocks
  - Test complete user flows (registration → KYC → bidding → payment)
  - Test files in `tests/integration/`
  - _Requirements: All, Enterprise Standards Section 7_

- [ ] 80. Write E2E tests with Playwright
  - Test complete user journeys from UI to database
  - Test vendor registration flow (standard + OAuth + OTP + BVN)
  - Test case creation flow on mobile
  - Test bidding flow with real-time updates
  - Test payment flow with Paystack
  - Test on real mobile devices (iPhone 13, Samsung Galaxy S21, Tecno Spark)
  - Test files in `tests/e2e/`
  - _Requirements: All, Enterprise Standards Section 7_

- [ ] 81. Perform load testing with k6
  - Test 200 concurrent users (70% mobile, 30% desktop)
  - Test 50 concurrent bidders on single auction
  - Verify API response time <500ms (95th percentile)
  - Verify real-time bid updates <1s latency
  - Verify page load <2s on 3G network
  - Test files in `tests/load/`
  - _Requirements: NFR1.1, NFR1.2, Enterprise Standards Section 8_

- [ ] 82. Perform security testing
  - Run OWASP ZAP vulnerability scan
  - Test SQL injection prevention
  - Test XSS prevention
  - Test CSRF protection
  - Test authentication bypass attempts
  - Test authorization bypass attempts
  - Test session hijacking prevention
  - Test BVN encryption verification
  - Test webhook signature validation
  - Test rate limiting enforcement
  - _Requirements: NFR4, Enterprise Standards Section 6_

- [ ] 83. Perform mobile testing
  - Test PWA installation on iPhone 13, Samsung Galaxy S21, Tecno Spark
  - Test offline mode functionality
  - Test camera upload from mobile
  - Test GPS location capture
  - Test touch-friendly UI (44x44px minimum)
  - Test mobile network performance (3G simulation)
  - Test image compression effectiveness
  - Test push notification delivery
  - Test responsive layout (375x667, 390x844, 414x896)
  - Test service worker caching
  - _Requirements: NFR5, Enterprise Standards Section 7_

### Epic 14: Deployment & Launch Preparation

- [ ] 84. Set up CI/CD pipeline
  - Create GitHub Actions workflow in `.github/workflows/ci.yml`
  - Configure pre-commit checks: linting (ESLint), formatting (Prettier), type checking (TypeScript)
  - Configure pre-push checks: unit tests must pass
  - Configure pre-merge checks: all tests pass, code coverage ≥80%, security scan passes, build succeeds
  - _Requirements: NFR3, Enterprise Standards Section 12_

- [ ] 85. Configure production environment
  - Set up Supabase PostgreSQL database (production)
  - Set up Redis cache (production)
  - Set up Cloudinary storage (production)
  - Configure environment variables for production
  - Set up monitoring with Sentry
  - Set up logging with CloudWatch
  - Configure CDN (Cloudflare/Bunny) for static assets
  - _Requirements: NFR2, NFR3, Enterprise Standards Section 12_

- [ ] 86. Implement monitoring and alerting
  - Set up Sentry for error tracking
  - Set up CloudWatch for server health monitoring
  - Configure alerts: error rate >1%, API response time >1s, server down, payment webhook failures
  - Set up uptime monitoring (target: 99.5%)
  - _Requirements: NFR3, Enterprise Standards Section 12_

- [ ] 87. Create deployment documentation
  - Write README.md with setup instructions
  - Document environment variables
  - Document database migrations
  - Document deployment process
  - Document monitoring and alerting
  - _Requirements: Enterprise Standards Section 13_

- [ ] 88. Perform beta testing
  - Deploy to staging environment
  - Invite 20 vendors for beta testing
  - Collect feedback on usability, performance, and bugs
  - Fix critical bugs
  - Iterate based on feedback
  - _Requirements: All_

- [ ] 89. Final checkpoint - Production readiness
  - Verify all tests pass (unit, integration, E2E, load, security)
  - Verify 80%+ code coverage
  - Verify all critical bugs fixed
  - Verify performance targets met (API <500ms, mobile load <2s, uptime 99.5%)
  - Verify security requirements met (NDPR compliance, encryption, audit logs)
  - Verify mobile-first design (70%+ mobile traffic target)
  - Deploy to production
  - Monitor for 48 hours
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive MVP delivery with 80%+ test coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- E2E tests validate complete user flows
- Load tests validate performance under concurrent load
- Security tests validate OWASP Top 10 compliance
- Mobile tests validate PWA functionality and responsive design

