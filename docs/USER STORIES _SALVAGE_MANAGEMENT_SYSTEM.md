USER STORIES - SALVAGE MANAGEMENT SYSTEM
Mobile-First PWA Platform for NEM Insurance Nigeria
8-Week MVP Development Sprint
PROJECT SUMMARY
Total User Stories: 40
 Total Story Points: 235
 Number of Epics: 9
 Timeline: 8 weeks (2 months)
 Scope: MVP (Minimum Viable Product) only
EPIC 1: USER REGISTRATION & AUTHENTICATION (ALL ROLES)
US-001: Standard Vendor Registration
As a Vendor
 I want to register with standard information (name, email, phone, password, date of birth)
 So that I can create an account to access the platform
Acceptance Criteria:
Registration form collects: Full name, Email, Phone number, Password, Date of birth
Password validation: min 8 chars, 1 uppercase, 1 number, 1 special char
Email format validation
Phone number format validation (Nigerian format)
Terms and conditions acceptance checkbox
Account created with status 'Unverified - Tier 0'
Welcome email sent with verification link
Priority: Critical
 Story Points: 5
 Sprint: Sprint 1
US-002: OAuth Vendor Registration
As a Vendor
 I want to register using Google or Facebook OAuth
 So that I can sign up quickly without creating a new password
Acceptance Criteria:
'Sign up with Google' button integrated (OAuth 2.0)
'Sign up with Facebook' button integrated (OAuth 2.0)
Auto-populate: Name, Email from OAuth provider
If phone number provided by OAuth, capture it; if not, prompt user to enter
User still needs to accept Terms and Conditions
Account created with status 'Unverified - Tier 0'
Same welcome flow as standard registration
Priority: Critical
 Story Points: 8
 Sprint: Sprint 1
US-003: Multi-Factor Authentication via SMS OTP
As a Vendor
 I want to complete Multi-Factor Authentication (MFA) via SMS OTP during registration
 So that My phone number is verified and my account is secured
Acceptance Criteria:
After registration, MFA screen appears requesting phone number (if not already captured)
SMS OTP sent to phone number via Termii/Africa's Talking API
OTP valid for 5 minutes
User enters 6-digit OTP code
Max 3 OTP verification attempts before resend required
Phone number marked as 'verified' in database
Activity logged: 'Phone verification completed via OTP'
Account status updated to 'Phone Verified - Tier 0'
Priority: Critical
 Story Points: 5
 Sprint: Sprint 1
US-004: Tier 1 KYC Verification (BVN)
As a Vendor
 I want to complete Tier 1 KYC verification using BVN
 So that I can start bidding on salvage items up to ₦500k immediately
Acceptance Criteria:
KYC prompt appears after phone verification: 'Verify your identity to start bidding'
User enters 11-digit BVN number
System calls BVN verification API (Mono/Okra) with BVN + DOB + Phone
BVN details matched against user's registered name, DOB, phone
If match successful: Auto-approve Tier 1 vendor status
If mismatch: Show specific error (e.g., 'Name mismatch: BVN shows John Doe but you registered as Jane Doe')
Activity logged: 'BVN verification initiated', 'BVN verification successful/failed'
BVN stored encrypted (AES-256), displayed masked (****7890)
Account status updated to 'Verified - Tier 1'
SMS + Email: 'Congratulations! You can now bid up to ₦500,000'
Tier 1 badge displayed on vendor profile
Priority: Critical
 Story Points: 13
 Sprint: Sprint 2
US-005: Tier 2 Upgrade Prompts
As a Vendor
 I want to be prompted to upgrade to Tier 2 when viewing auctions above ₦500k
 So that I understand I need higher verification to access premium auctions
Acceptance Criteria:
When Tier 1 vendor clicks auction >₦500k, modal appears: 'Upgrade to Tier 2 to bid on this item'
Modal explains Tier 2 benefits: 'Bid on unlimited amounts, priority support, leaderboard eligibility'
'Upgrade Now' button redirects to Tier 2 KYC page
Subtle banner in vendor dashboard: 'Unlock premium auctions - Upgrade to Tier 2'
Banner shows 'X high-value auctions available' (if any exist)
Banner dismissible but reappears every 3 days
Priority: High
 Story Points: 3
 Sprint: Sprint 2
US-006: Tier 2 KYC Verification (Full Documentation)
As a Vendor
 I want to complete Tier 2 KYC verification with full business documentation
 So that I can bid on high-value salvage items above ₦500k and access premium features
Acceptance Criteria:
Tier 2 KYC form collects: Business name, CAC registration number, TIN, Bank account details (Account number, Bank name, Account name)
Document uploads: CAC certificate (PDF/JPG, max 5MB), Bank statement (last 3 months, PDF, max 10MB), Valid ID (NIN card/Driver's license/Passport, JPG, max 5MB)
NIN verification: OCR extracts NIN from uploaded ID using Google Document AI, NIN verified via API against full name and DOB
CAC verification: CAC number validated against SCUML/CAC database API (if available), If API unavailable, manual review by Salvage Manager
Bank account verification: Account number verified against BVN using Paystack/Mono API, Ensures account name matches registered business name
All uploads stored in AWS S3 with encryption
Activity logged: 'Tier 2 KYC initiated', 'NIN verified', 'CAC uploaded', 'Bank details verified', 'Tier 2 KYC submitted for review'
Application status: 'Pending Manager Approval'
SMS + Email: 'Your Tier 2 application is under review. We'll notify you within 24 hours'
Salvage Manager receives notification to review Tier 2 application
Priority: Critical
 Story Points: 13
 Sprint: Sprint 2
US-007: Salvage Manager Reviews Tier 2 Applications
As a Salvage Manager
 I want to review and approve/reject Tier 2 vendor KYC applications
 So that I can ensure only legitimate businesses access high-value auctions
Acceptance Criteria:
Tier 2 KYC review queue visible in Manager dashboard
View all submitted documents (CAC, Bank statement, ID) in modal
See verification status: BVN ✓, NIN ✓, Bank Account ✓, CAC (pending manual review)
Approve/Reject buttons with mandatory comment field for rejection
If approved: Account status updated to 'Verified - Tier 2', Vendor can now bid >₦500k, SMS + Email: 'Congratulations! Your Tier 2 verification is complete', Tier 2 badge displayed on vendor profile
If rejected: Account remains Tier 1, SMS + Email with rejection reason and next steps, Vendor can resubmit corrected documents
Activity logged: 'Tier 2 application approved/rejected by [Manager Name]'
Review completed in <24 hours (target KPI)
Priority: Critical
 Story Points: 8
 Sprint: Sprint 2
US-008: Email/Phone Login
As a Vendor
 I want to log in with email/phone and password
 So that I can access my account securely
Acceptance Criteria:
Login form accepts email OR phone number + password
JWT token generated on successful login (valid for 24 hours desktop, 2 hours mobile)
Session stored in Redis cache
Account locked after 5 failed login attempts (30-minute cooldown)
Activity logged: 'Login successful from [IP address] - [Device type]'
Redirect to vendor dashboard after login
Priority: Critical
 Story Points: 5
 Sprint: Sprint 1
US-009: OAuth Login
As a Vendor
 I want to log in using Google/Facebook OAuth
 So that I can access my account quickly without entering password
Acceptance Criteria:
'Sign in with Google' button
'Sign in with Facebook' button
OAuth flow validates user credentials with provider
JWT token generated on successful OAuth login
Session management same as standard login
Activity logged: 'OAuth login successful via [Provider]'
Priority: High
 Story Points: 5
 Sprint: Sprint 1
US-010: Staff Account Creation
As a System Admin
 I want to create staff accounts for Claims Adjusters, Salvage Managers, and Finance Officers
 So that I can onboard internal team members with appropriate role-based access
Acceptance Criteria:
Admin user management page with 'Add New User' button
Form collects: Full name, Email, Phone, Role (dropdown: Claims Adjuster, Salvage Manager, Finance Officer)
System generates temporary password and emails it to new user
User forced to change password on first login
Role-based permissions auto-assigned based on selected role
Activity logged: 'User [Name] created by Admin [Admin Name] with role [Role]'
User provisioning completed in <3 minutes
Priority: High
 Story Points: 5
 Sprint: Sprint 1
US-011: Comprehensive Activity Logging
As All Users
 I want all my actions logged with timestamp, IP address, and device type
 So that The platform maintains security and audit compliance (NDPR)
Acceptance Criteria:
Audit trail table logs: User ID, Action type (login, logout, case created, bid placed, payment made, etc.), Timestamp (UTC + WAT), IP address, Device type (mobile/desktop/tablet), Browser/User agent
Logs stored in PostgreSQL (minimum 2 years retention)
Logs immutable (cannot be edited/deleted)
Admin can search/filter audit logs by user, date range, action type
Audit export to CSV/Excel for compliance reporting
Activity logged for: Authentication, Case management, Bidding, Payments, KYC verification, Profile updates, Admin actions
Priority: Critical
 Story Points: 8
 Sprint: Sprint 1
EPIC 2: MOBILE CASE CREATION (PWA)
US-012: Mobile PWA Case Creation
As a Claims Adjuster
 I want to create a salvage case from my mobile browser using PWA
 So that I can document accident scenes immediately without waiting to return to office
Acceptance Criteria:
PWA accessible via mobile browser (Chrome, Safari iOS)
'Create Case' button prominent in mobile navigation
Form fields: Claim reference number (auto-validates against policy system), Asset type (dropdown: Vehicle, Property, Electronics), Asset details (conditional fields based on type - e.g., Vehicle: Make, Model, Year, VIN)
Market value input (₦, numeric validation)
Photo upload: Tap 'Add Photo' → Opens mobile camera, Capture 3-10 photos (max 5MB each, JPG/PNG/HEIC), Photos auto-compressed via TinyPNG API before upload
GPS auto-capture: Browser requests location permission, GPS coordinates (latitude, longitude) auto-tagged to case, Displayed as 'Location: Lagos, Nigeria' with map preview
Voice notes: Tap microphone icon → Records audio note (max 2 minutes), Saved as .mp3, optional transcript via Web Speech API if supported
'Save as Draft' button (saves offline in IndexedDB if no internet)
'Submit for Approval' button (uploads to server)
Case created in <5 minutes from accident site
Priority: Critical
 Story Points: 13
 Sprint: Sprint 2
US-013: Offline Mode with Auto-Sync
As a Claims Adjuster
 I want to create cases offline and have them auto-sync when internet returns
 So that I can work in areas with poor connectivity without losing data
Acceptance Criteria:
PWA service worker (Workbox) caches app shell and forms
Offline indicator displayed: 'You're offline. Changes will sync automatically'
Draft cases stored in browser IndexedDB
Photos stored in IndexedDB (compressed)
When internet detected: Service worker triggers auto-sync, Upload queue shows: 'Syncing 2 of 3 items', Success notification: 'All cases synced successfully'
Conflict resolution: If case edited online while offline, show conflict modal with option to keep offline version or discard
Activity logged: 'Case created offline', 'Case synced at [timestamp]'
Priority: High
 Story Points: 13
 Sprint: Sprint 2
US-014: AI Damage Assessment
As a Claims Adjuster
 I want to receive AI damage assessment results after uploading photos
 So that I get instant valuation guidance without manual inspection expertise
Acceptance Criteria:
After photo upload, loading spinner: 'AI analyzing damage...'
Google Cloud Vision API analyzes images (max 5 seconds)
Results displayed: Damage severity (Minor 40-60%, Moderate 20-40%, Severe 5-20%), Confidence score (e.g., 85% confident), Damage labels (e.g., 'Front bumper dent', 'Shattered windshield')
Estimated salvage value auto-calculated: [Market value] × [Damage %]
Reserve price suggested at 70% of estimated value
Manual override option: 'This doesn't look right? Adjust manually'
Activity logged: 'AI assessment completed with [confidence]% confidence'
Priority: Critical
 Story Points: 8
 Sprint: Sprint 2
US-015: Mobile Case Approval
As a Salvage Manager
 I want to review and approve/reject salvage cases from mobile PWA
 So that I can keep cases moving even when away from my desk
Acceptance Criteria:
Mobile-optimized approval queue (card layout)
Each card shows: Case ID, Asset type, Estimated value, AI confidence score, Adjuster name, Submission time
Tap card to view full details: All photos (swipeable gallery), AI assessment results, GPS location on map, Asset details, Adjuster notes
Approve/Reject buttons at bottom
Rejection requires comment (min 10 characters)
If approved: Auction auto-created, Vendors notified, Activity logged: 'Case approved by [Manager]'
If rejected: Case returned to Adjuster with feedback, Activity logged: 'Case rejected - Reason: [comment]'
Push notification when new case awaits approval
Target: Approve/reject within 12 hours
Priority: High
 Story Points: 5
 Sprint: Sprint 3
EPIC 3: REAL-TIME BIDDING & GAMIFICATION
US-016: Mobile Auction Browsing
As a Vendor
 I want to browse active auctions in mobile-optimized card layout
 So that I can easily find salvage items to bid on from my phone
Acceptance Criteria:
Auction listing page with card layout (2 cards per row on mobile)
Each card shows: Main photo, Asset name (e.g., '2019 Toyota Camry'), Current bid amount, Time remaining (countdown), 'X vendors watching' count
Filter by: Asset type, Price range, Time ending (soonest first), Location
Search bar: Search by asset name, claim reference
Lazy loading: Load 20 auctions initially, infinite scroll for more
Page load <2 seconds on 3G network
Pull-to-refresh gesture refreshes auction list
Priority: Critical
 Story Points: 8
 Sprint: Sprint 3

US-017: Live Countdown Timers
As a Vendor
 I want to see live countdown timer for auctions
 So that I feel urgency and don't miss bidding opportunities
Acceptance Criteria:
Countdown timer format: 2d 14h 35m 12s (if >1 day), 14h 35m 12s (if <1 day, >1 hour), 35m 12s (if <1 hour)
Timer updates every 1 second (client-side JS)
Color coding: Green if >24 hours, Yellow if 1-24 hours, Red if <1 hour
When <1 hour: Timer pulses (CSS animation)
Mobile push notification: '1 hour left to bid on [Item]'
SMS notification: '30 minutes left to bid on [Item]'
Timer synced with server time (prevents client manipulation)
Priority: Critical
 Story Points: 5
 Sprint: Sprint 3

US-018: Bid Placement with OTP
As a Vendor
 I want to place a bid with SMS OTP verification
 So that My bid is secure and I complete bidding in under 1 minute
Acceptance Criteria:
Tap 'Place Bid' button on auction page
Modal appears: Enter bid amount (must be > current bid + minimum increment, e.g., ₦10,000)
Real-time validation: Shows 'Minimum bid: ₦510,000' if validation fails
Tap 'Confirm Bid' → SMS OTP sent to registered phone
Enter 6-digit OTP (valid 3 minutes)
Bid submitted after OTP verification
WebSocket broadcasts new bid to all viewers in <2 seconds
Activity logged: 'Bid placed: ₦[amount] for auction [ID]'
Total time: <1 minute from tap to confirmed bid
Priority: Critical
 Story Points: 8
 Sprint: Sprint 3
US-019: Outbid Push Notifications
As a Vendor
 I want to receive push notification when I've been outbid
 So that I can respond immediately and stay competitive
Acceptance Criteria:
PWA push notification sent when another vendor bids higher
Notification shows: '[Item name]', 'You've been outbid! New bid: ₦[amount]', '[Time remaining]'
Tap notification → Opens auction page directly
Notification delivered in <5 seconds of new bid
User can disable in notification preferences
Activity logged: 'Outbid notification sent'
Priority: Critical
 Story Points: 8
 Sprint: Sprint 3
US-020: Vendors Watching Count
As a Vendor
 I want to see how many vendors are watching an auction
 So that I understand demand and bid strategically
Acceptance Criteria:
Display '7 vendors watching' on auction card
Count increments when vendor views auction >10 seconds
Real-time update via WebSocket
Anonymized (no vendor names shown)
Creates FOMO for high-demand items
Priority: Medium
 Story Points: 3
 Sprint: Sprint 3
US-021: Auto-Extend Auctions
As a Vendor
 I want to see auction auto-extend if bids placed in final 5 minutes
 So that I have fair chance to respond to last-second bids (no sniping)
Acceptance Criteria:
If bid placed when <5 minutes remaining, add 2 minutes to timer
Extension applies unlimited times
Push + SMS notification to all bidders: 'Auction extended by 2 minutes'
Timer color changes to orange during extension mode
Final winner determined when no bids for 5 consecutive minutes
Activity logged: 'Auction auto-extended at [timestamp]'
Priority: High
 Story Points: 5
 Sprint: Sprint 3
US-022: Bid History Graph
As a Vendor
 I want to view bid history graph for an auction
 So that I can analyze bidding patterns
Acceptance Criteria:
Line chart (Recharts) shows bid amounts over time
X-axis: Time, Y-axis: Bid amount (₦)
Touch point to see exact bid and time
Color-coded by anonymized vendor (Vendor A, B, C)
Mobile-optimized, loads in <2 seconds
Priority: Low
 Story Points: 3
 Sprint: Sprint 4
US-023: Vendor Leaderboard
As a Vendor
 I want to see my position on vendor leaderboard
 So that I feel recognized and want to improve my ranking
Acceptance Criteria:
Leaderboard page shows Top 10 vendors monthly
Metrics: Total bids, Wins, Total spent (₦), On-time pickup rate (%)
My position highlighted if in Top 10
Trophy icons for Top 3 
Updated weekly (every Monday)
Activity logged: 'Leaderboard viewed'
Priority: Medium
 Story Points: 5
 Sprint: Sprint 4
EPIC 4: PAYMENT PROCESSING & ESCROW
US-024: Paystack Instant Payment
As a Vendor
 I want to pay for won auction via Paystack instant card payment
 So that I complete payment in minutes and secure my salvage
Acceptance Criteria:
After auction win, SMS + Email + Push: 'You won! Pay within 24 hours to secure your item'
Payment page shows: Item details, Winning bid amount, Payment deadline (24 hours countdown)
'Pay Now with Paystack' button generates payment link
Redirected to Paystack payment page (supports: Card, Bank transfer, USSD, Bank account)
After payment, Paystack webhook hits /api/webhooks/payment-confirmation
Webhook verifies: Signature, Payment reference, Amount matches invoice
Payment auto-verified in <10 minutes
Pickup authorization auto-generated and sent via SMS + Email
Activity logged: 'Payment initiated via Paystack', 'Payment verified automatically'
Priority: Critical
 Story Points: 13
 Sprint: Sprint 2
US-025: Bank Transfer Payment
As a Vendor
 I want to pay via bank transfer and upload payment proof
 So that I have alternative payment method if I don't have card
Acceptance Criteria:
'Pay via Bank Transfer' option shows company bank details
Upload payment receipt/screenshot (JPG/PDF, max 5MB)
Submission triggers notification to Finance Officer
Status: 'Payment Pending Verification'
Finance Officer manually verifies (target: <4 hours)
Activity logged: 'Bank transfer proof uploaded', 'Payment verified by Finance Officer [Name]'
Priority: Medium
 Story Points: 5
 Sprint: Sprint 2
US-026: Escrow Wallet Pre-Funding
As a Vendor
 I want to pre-fund escrow wallet to speed up future payments
 So that I can bid and pay instantly without payment delays
Acceptance Criteria:
Vendor dashboard shows 'Escrow Wallet Balance: ₦0'
'Add Funds' button redirects to Paystack
Add ₦50k - ₦5M to wallet
Funds credited immediately after Paystack confirmation
When vendor wins auction: Bid amount auto-frozen in wallet, Status: 'Funds Reserved'
After pickup confirmation: Funds released to NEM Insurance, Remaining balance available for next bid
Wallet balance cached in Redis for instant checks
Transaction history: Date, Type (Credit/Debit), Amount, Balance
Activity logged: 'Wallet funded ₦[amount]', 'Funds frozen for auction [ID]', 'Funds released'
Priority: High
 Story Points: 8
 Sprint: Sprint 4
US-027: Auto-Verified Payments Dashboard
As a Finance Officer
 I want to see payments auto-verified via Paystack webhook
 So that I don't waste time manually checking statements
Acceptance Criteria:
Finance dashboard shows: Total payments today, Auto-verified (green ✓), Pending manual verification (yellow ), Overdue (red )
Pie chart: Auto-verified vs Manual (target: 90%+ auto)
Paystack payments show 'Auto-verified' badge
Only bank transfer payments require manual review
Activity logged: 'Payment auto-verified via Paystack webhook'
Priority: Critical
 Story Points: 8
 Sprint: Sprint 2
US-028: Manual Payment Verification
As a Finance Officer
 I want to manually verify bank transfer payments
 So that I can approve legacy payment methods securely
Acceptance Criteria:
Pending payments queue shows uploaded receipts
Click to view full-size image
Verify: Amount matches invoice, Bank details match vendor registration, Reference number visible
Approve/Reject with comments
If approved: Pickup authorization sent, Activity logged: 'Payment verified by [Finance Officer]'
If rejected: SMS + Email to vendor with reason, Vendor can resubmit
Priority: Medium
 Story Points: 5
 Sprint: Sprint 2
US-029: Payment Deadline Reminders
As a Vendor
 I want to receive SMS reminder before payment deadline
 So that I don't miss deadlines and avoid penalties
Acceptance Criteria:
SMS sent 12 hours before 24-hour deadline
Message: 'Reminder: Pay ₦[amount] for [Item] by [Time] tomorrow. Pay now: [Link]'
Payment link included in SMS
Sent via Termii/Africa's Talking
Delivery logged in SMS audit trail
Priority: Medium
 Story Points: 3
 Sprint: Sprint 2
US-030: Auto-Flag Overdue Payments
As System
 I want to auto-flag overdue payments after 24 hours
 So that Late payments are tracked and vendors can be penalized
Acceptance Criteria:
Cron job runs every hour checking payment deadlines
If payment not received 24 hours after auction end: Status: 'Overdue', Vendor flagged in performance stats, SMS + Email: 'Payment overdue. Item may be re-auctioned'
If overdue >48 hours: Auction winner forfeited, Item re-listed for auction, Vendor suspended for 7 days, Activity logged: 'Payment deadline missed - Auction [ID] re-listed'
Priority: High
 Story Points: 5
 Sprint: Sprint 2
EPIC 5: MOBILE DASHBOARDS & REPORTING
US-031: Manager Real-Time Dashboard
As a Salvage Manager
 I want to view real-time KPIs on mobile PWA dashboard
 So that I monitor performance on the go
Acceptance Criteria:
Manager dashboard (PWA-responsive) shows: Active auctions (number), Total bids today, Average recovery rate (%), Cases pending approval (number)
Charts (Recharts): Recovery rate trend (last 30 days), Top 5 vendors by volume, Payment status breakdown
Auto-refresh every 30 seconds
Filter by: Date range, Asset type
Loads in <2 seconds on mobile
Tap charts for drill-down
Priority: High
 Story Points: 8
 Sprint: Sprint 4
US-032: Vendor Performance Dashboard
As a Vendor
 I want to view my performance stats and leaderboard position
 So that I track my success and improve
Acceptance Criteria:
Vendor dashboard shows: Win rate (%), Average payment time (hours), On-time pickup rate (%), 5-star rating (average), Leaderboard position (#X of Y vendors)
Badges for achievements: '10 Wins' badge, 'Top Bidder' badge, 'Fast Payer' badge (avg <6 hours)
Comparison to last month: '↑ Win rate increased by 5%'
Mobile-optimized card layout
Priority: Medium
 Story Points: 5
 Sprint: Sprint 4
US-033: WhatsApp Report Sharing
As a Salvage Manager
 I want to export and share reports via WhatsApp
 So that I quickly share insights with stakeholders
Acceptance Criteria:
Reports page with options: Recovery summary, Vendor rankings, Payment aging
Select date range
'Generate PDF' button creates mobile-optimized PDF (<2MB)
Native mobile share button: Share via WhatsApp, Email, SMS
PDF generation <10 seconds
Activity logged: 'Report generated and shared via [Channel]'
Priority: Medium
 Story Points: 5
 Sprint: Sprint 4
EPIC 6: FRAUD DETECTION & SECURITY
US-034: Automated Fraud Detection
As System
 I want to detect and flag suspicious bidding patterns automatically
 So that Platform integrity is protected from manipulation
Acceptance Criteria:
Fraud detection runs on every bid submission
Pattern 1 - Self-bidding: Same IP address bidding against itself, Flag: 'Suspicious - Same IP'
Pattern 2 - Shill bidding: Sudden bid >3x previous bid from new vendor (<7 days), Flag: 'Suspicious - Unusual bid pattern'
Pattern 3 - Multi-accounting: Multiple vendor accounts from same phone/BVN, Flag: 'Suspicious - Duplicate identity'
When flagged: Push + Email alert to System Admin, Auction marked 'Under Review', Vendor's bid temporarily held
Activity logged: 'Fraud flag raised - Pattern: [type], Auction: [ID], Vendor: [ID]'
Priority: High
 Story Points: 8
 Sprint: Sprint 4

US-035: Fraud Alert Review
As a System Admin
 I want to review fraud alerts and take action
 So that I can investigate suspicious activity and protect the platform
Acceptance Criteria:
Fraud dashboard shows all flagged auctions
Each flag shows: Vendor details, Bid history, IP addresses, Evidence (e.g., 'Same IP: 192.168.1.1')
Actions: Dismiss flag (if false positive), Suspend vendor (7/30/90 days/permanent), Cancel auction and re-list
If vendor suspended: All active bids canceled, SMS + Email notification, Activity logged: 'Vendor suspended - Reason: [fraud type]'
If flag dismissed: Auction continues normally, Activity logged: 'Fraud flag dismissed by Admin [Name]'
Priority: High
Story Points: 5
Sprint: Sprint 4

US-036: Auto-Suspend Repeat Offenders
As System
 I want to auto-suspend vendors with 3+ fraud flags
 So that Repeat offenders are removed automatically
Acceptance Criteria:
After 3rd confirmed fraud flag: Vendor account auto-suspended (30 days)
All active bids canceled
SMS + Email: 'Your account has been suspended due to suspicious activity. Contact support if you believe this is an error'
Admin can review and reinstate
Activity logged: 'Vendor auto-suspended - 3 fraud flags reached'
Priority: High
 Story Points: 5
 Sprint: Sprint 4

EPIC 7: VENDOR RATINGS & TRUST
US-037: Vendor Rating System
As a Salvage Manager
 I want to rate vendors after successful pickup
 So that Vendor reputation system builds trust
Acceptance Criteria:
After pickup confirmed, rating prompt appears
5-star rating (1-5 stars)
Optional text review (max 500 chars)
Rating categories: Payment speed, Communication, Pickup punctuality
Rating visible on vendor profile
Average rating calculated and displayed
Cannot rate same transaction twice
Activity logged: 'Vendor [ID] rated [X] stars by Manager [Name]
Priority: Medium
 Story Points: 5
 Sprint: Sprint 4

US-038: Trust Badges Display
As a Vendor
 I want to see trust badges on my profile
 So that I build credibility with other users
Acceptance Criteria:
'Verified BVN' badge (green checkmark) after Tier 1 KYC
'Verified Business' badge after Tier 2 KYC
'Top Rated' badge if rating ≥4.5 stars
'Fast Payer' badge if avg payment time <6 hours
Badges displayed: Vendor profile, Auction bid list, Leaderboard
Tooltip on hover: 'This vendor's identity has been verified via BVN'
Priority: Medium
 Story Points: 2
 Sprint: Sprint 2

EPIC 8: NOTIFICATIONS & COMMUNICATION
US-039: Notification Preferences
As a Vendor
 I want to customize my notification preferences
 So that I only receive alerts via my preferred channels
Acceptance Criteria:
Notification settings page with toggles: SMS (on/off), Email (on/off), Push (on/off)
Per-notification-type control: Bid alerts, Auction ending, Payment reminders, Leaderboard updates
Cannot opt-out of critical notifications: OTP codes, Payment deadlines, Account suspension
Changes saved immediately
Activity logged: 'Notification preferences updated'
Priority: Medium
 Story Points: 3
 Sprint: Sprint 3

US-040: Multi-Channel Notifications
As All Users
 I want to receive notifications via SMS, Email, and Push based on my preferences
 So that I stay informed through my preferred channels
Acceptance Criteria:
SMS via Termii/Africa's Talking (critical only: OTP, payment deadlines, auction ending)
Email via SendGrid (all notification types, HTML templates)
PWA Push notifications (real-time alerts: outbid, auction ending soon)
Notification delivery logged in audit trail
Fallback: If push fails, send SMS/Email
Delivery rate target: >95%
Priority: High
 Story Points: 8
 Sprint: Sprint 3

SUMMARY STATISTICS
By Priority:
Critical: 17 stories (43%)
High: 14 stories (35%)
Medium: 8 stories (20%)
Low: 1 story (2%)
By Sprint:
Sprint 1: 6 stories (Foundation & Auth)
Sprint 2: 13 stories (Core Features & Payments)
Sprint 3: 10 stories (Bidding & Notifications)
Sprint 4: 11 stories (Advanced Features & Polish)
By Epic:
User Registration & Authentication: 11 stories, 62 points
Mobile Case Creation: 4 stories, 39 points
Real-Time Bidding & Gamification: 8 stories, 37 points
Payment Processing & Escrow: 7 stories, 47 points
Mobile Dashboards & Reporting: 3 stories, 18 points
Fraud Detection & Security: 3 stories, 18 points
Vendor Ratings & Trust: 2 stories, 7 points
Notifications & Communication: 2 stories, 11 points
TOTAL: 40 User Stories | 235 Story Points | 8-Week Timeline

NOTES FOR DEVELOPMENT TEAM
Mobile-First Approach: All features must be PWA-optimized and mobile-responsive
Security: Every action must be logged for NDPR compliance
Performance: Page load <2s mobile, API response <500ms
Testing: Each story requires unit tests, integration tests, and mobile device testing
Documentation: API documentation required for all endpoints
Code Quality: TypeScript required, minimum 80% test coverage

END OF USER STORIES DOCUMENT
 Document Version: 1.0
 Last Updated: January 21, 2026
 Status: Approved for Development



