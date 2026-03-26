# Requirements Document: Tier 2 KYC Dojah Integration

## Introduction

This document specifies the requirements for implementing comprehensive Tier 2 KYC (Know Your Customer) verification for the NEM Salvage auction platform using Dojah's identity verification APIs. The system will enable vendors to upgrade from Tier 1 (BVN-only verification with ₦500,000 bidding limit) to Tier 2 (full KYC with unlimited bidding) by completing NIN verification, biometric liveness checks, document verification, and AML screening.

The implementation must comply with Central Bank of Nigeria (CBN) Tier 2 KYC requirements, NAICOM insurance regulations, and AML/CFT (Anti-Money Laundering/Combating the Financing of Terrorism) standards.

## Glossary

- **System**: The NEM Salvage Tier 2 KYC verification system
- **Dojah_API**: Third-party identity verification service provider
- **Vendor**: A registered user who purchases salvage items through auctions
- **Tier_1**: Basic KYC level with BVN verification only (₦500,000 bid limit)
- **Tier_2**: Full KYC level with comprehensive verification (unlimited bidding)
- **NIN**: National Identification Number (11-digit unique identifier issued by NIMC)
- **NIMC**: National Identity Management Commission (Nigerian government agency)
- **BVN**: Bank Verification Number (11-digit unique identifier issued by CBN)
- **Liveness_Check**: Biometric verification to confirm a real person (not photo/video spoofing)
- **AML_Screening**: Anti-Money Laundering checks including PEP, sanctions, and adverse media
- **PEP**: Politically Exposed Persons (government officials, politicians)
- **Sanctions_List**: International watchlists (UN, OFAC, EU) for restricted individuals
- **Adverse_Media**: Negative news about terrorism, financial crime, organized crime, violent crime
- **Photo_ID**: Government-issued identification document (Passport, Voter's Card, Driver's License)
- **Utility_Bill**: Proof of address document (electricity, water bill within 3 months)
- **CAC**: Corporate Affairs Commission (Nigerian business registration authority)
- **Salvage_Manager**: NEM Insurance staff member who reviews and approves KYC applications
- **Risk_Level**: AML screening result classification (Low, Medium, High)
- **Match_Score**: Biometric similarity percentage between selfie and ID photo
- **Round_Trip_Property**: Verification that parse(format(data)) equals original data
- **Encryption_Service**: AES-256 encryption for sensitive data (NIN, BVN)
- **Audit_Trail**: Immutable log of all verification steps and status changes
- **Grace_Period**: Time allowed for vendors to complete Tier 2 upgrade before restrictions apply


## Requirements

### Requirement 1: NIN Verification

**User Story:** As a vendor, I want to verify my National Identification Number, so that I can prove my identity to NEM Insurance and upgrade to Tier 2.

#### Acceptance Criteria

1. WHEN a vendor submits an 11-digit NIN, THE System SHALL validate the NIN format before calling Dojah_API
2. WHEN the NIN format is invalid, THE System SHALL return an error message within 100ms without calling Dojah_API
3. WHEN a valid NIN is submitted, THE System SHALL call Dojah_API NIN Lookup endpoint within 2 seconds
4. WHEN Dojah_API returns NIN data, THE System SHALL extract full name, date of birth, gender, phone number, and photo
5. WHEN NIN data is received, THE System SHALL compare the NIN name against the vendor's registered name with 80% fuzzy match threshold
6. WHEN the name match score is below 80%, THE System SHALL flag the verification for manual review by Salvage_Manager
7. WHEN the NIN verification succeeds, THE System SHALL encrypt the NIN using Encryption_Service before storing in database
8. WHEN the NIN is stored, THE System SHALL record the verification timestamp and Dojah_API response data
9. IF Dojah_API returns an error, THEN THE System SHALL log the error and return a user-friendly message
10. THE System SHALL cache successful NIN verifications for 24 hours to avoid duplicate API calls for the same NIN

### Requirement 2: Advanced NIN Data Retrieval

**User Story:** As a Salvage Manager, I want to access detailed NIN information including address and employment history, so that I can perform thorough due diligence on high-risk vendors.

#### Acceptance Criteria

1. WHERE a vendor is flagged for manual review, THE System SHALL provide an option to retrieve advanced NIN data
2. WHEN advanced NIN lookup is requested, THE System SHALL call Dojah_API Advanced NIN Lookup endpoint
3. WHEN advanced data is received, THE System SHALL extract full address, education level, employment status, marital status, height, and tax ID
4. WHEN address data is available, THE System SHALL compare it against the vendor's provided address proof document
5. THE System SHALL store advanced NIN data in encrypted JSONB format in the database
6. THE System SHALL track the cost of advanced NIN lookups separately from basic lookups for billing purposes


### Requirement 3: Liveness Check and Biometric Verification

**User Story:** As a vendor, I want to take a selfie for biometric verification, so that I can prove I am a real person and not using someone else's identity.

#### Acceptance Criteria

1. WHEN a vendor accesses the Tier 2 upgrade page, THE System SHALL display camera access instructions for selfie capture
2. WHEN the vendor grants camera permission, THE System SHALL activate the device camera for selfie capture
3. WHEN a selfie is captured, THE System SHALL upload the image to Cloudinary with folder path `kyc-documents/{vendorId}/selfie`
4. WHEN the selfie is uploaded, THE System SHALL call Dojah_API Liveness Check endpoint with the selfie URL
5. WHEN Dojah_API returns liveness results, THE System SHALL extract the liveness probability score (0-100)
6. WHEN the liveness score is below 50, THE System SHALL reject the selfie and prompt the vendor to retake
7. WHEN the liveness score is 50 or above, THE System SHALL proceed to biometric matching
8. WHEN biometric matching is performed, THE System SHALL compare the selfie against the NIN photo using Dojah_API
9. WHEN the Match_Score is 80% or above, THE System SHALL mark biometric verification as successful
10. WHEN the Match_Score is below 80%, THE System SHALL flag the verification for manual review
11. THE System SHALL store the selfie URL, liveness score, and Match_Score in the database
12. THE System SHALL record the biometric verification timestamp when successful

### Requirement 4: Photo ID Document Verification

**User Story:** As a vendor, I want to upload my government-issued ID card, so that I can provide additional proof of identity beyond NIN.

#### Acceptance Criteria

1. WHEN a vendor selects a Photo_ID type, THE System SHALL accept one of: Passport, Voter's Card, or Driver's License
2. WHEN a vendor uploads a Photo_ID file, THE System SHALL validate the file size is less than 5MB
3. WHEN the file size exceeds 5MB, THE System SHALL return an error message without uploading
4. WHEN a valid file is uploaded, THE System SHALL upload to Cloudinary with folder path `kyc-documents/{vendorId}/photo-id`
5. WHEN the upload succeeds, THE System SHALL call Dojah_API Document Analysis endpoint with the Photo_ID URL
6. WHEN Dojah_API analyzes the document, THE System SHALL extract document type, ID number, full name, date of birth, and expiry date
7. WHEN document data is extracted, THE System SHALL validate the document is not expired
8. IF the document is expired, THEN THE System SHALL reject the verification and prompt for a valid document
9. WHEN the document is valid, THE System SHALL compare extracted name against vendor's registered name with 80% fuzzy match
10. WHEN the ID number is extracted, THE System SHALL store it in encrypted format in the database
11. THE System SHALL detect document authenticity using Dojah_API fraud detection algorithms
12. WHEN fraud indicators are detected, THE System SHALL flag the document for manual review by Salvage_Manager


### Requirement 5: Utility Bill Address Verification

**User Story:** As a vendor, I want to upload a recent utility bill, so that I can prove my residential address to NEM Insurance.

#### Acceptance Criteria

1. WHEN a vendor uploads a Utility_Bill file, THE System SHALL validate the file size is less than 10MB
2. WHEN the file size exceeds 10MB, THE System SHALL return an error message without uploading
3. WHEN a valid file is uploaded, THE System SHALL upload to Cloudinary with folder path `kyc-documents/{vendorId}/address-proof`
4. WHEN the upload succeeds, THE System SHALL call Dojah_API Utility Bill Verification endpoint
5. WHEN Dojah_API analyzes the bill, THE System SHALL extract full address, bill date, utility provider, and account holder name
6. WHEN the bill date is extracted, THE System SHALL validate the bill is within the last 3 months
7. IF the bill is older than 3 months, THEN THE System SHALL reject the verification and prompt for a recent bill
8. WHEN the account holder name is extracted, THE System SHALL compare it against the vendor's registered name with 70% fuzzy match
9. WHEN the address is extracted, THE System SHALL compare it against the NIN address data if available
10. WHEN address discrepancies are detected, THE System SHALL flag the verification for manual review
11. THE System SHALL store the extracted address data in the database
12. THE System SHALL record the address verification timestamp when successful

### Requirement 6: Business Document Verification (CAC Certificate)

**User Story:** As a business vendor, I want to upload my CAC certificate, so that I can verify my company registration and access business-level features.

#### Acceptance Criteria

1. WHERE a vendor indicates business entity type, THE System SHALL require CAC certificate upload
2. WHEN a vendor uploads a CAC certificate file, THE System SHALL validate the file size is less than 10MB
3. WHEN a valid file is uploaded, THE System SHALL upload to Cloudinary with folder path `kyc-documents/{vendorId}/cac-certificate`
4. WHEN the upload succeeds, THE System SHALL call Dojah_API Business Document Verification endpoint
5. WHEN Dojah_API analyzes the certificate, THE System SHALL extract company name, RC number, registration date, and business type
6. WHEN the RC number is extracted, THE System SHALL call Dojah_API CAC Lookup endpoint to verify company status
7. WHEN CAC Lookup returns data, THE System SHALL validate the company status is "Active" or "Registered"
8. IF the company status is "Dissolved" or "Inactive", THEN THE System SHALL reject the verification
9. WHEN the company name is extracted, THE System SHALL compare it against the vendor's provided business name with 90% exact match
10. WHEN verification succeeds, THE System SHALL store the RC number, company name, and registration date in the database
11. THE System SHALL record the CAC verification timestamp when successful
12. THE System SHALL extract director names from the certificate for future director KYC verification


### Requirement 7: AML Screening (PEP, Sanctions, Adverse Media)

**User Story:** As a Salvage Manager, I want to screen vendors against PEP lists, sanctions lists, and adverse media, so that I can identify high-risk individuals and comply with AML regulations.

#### Acceptance Criteria

1. WHEN all document verifications are complete, THE System SHALL automatically trigger AML_Screening
2. WHEN AML_Screening is triggered, THE System SHALL call Dojah_API AML Screening v2 endpoint with vendor's full name and date of birth
3. WHEN Dojah_API returns screening results, THE System SHALL extract PEP matches, sanctions matches, and adverse media matches
4. WHEN PEP matches are found, THE System SHALL classify the vendor as "High" Risk_Level
5. WHEN sanctions matches are found, THE System SHALL classify the vendor as "High" Risk_Level and block Tier 2 upgrade
6. WHEN adverse media matches are found for terrorism or financial crime, THE System SHALL classify the vendor as "High" Risk_Level
7. WHEN adverse media matches are found for organized crime or violent crime, THE System SHALL classify the vendor as "Medium" Risk_Level
8. WHEN no matches are found, THE System SHALL classify the vendor as "Low" Risk_Level
9. THE System SHALL store all AML screening results in JSONB format in the database
10. THE System SHALL record the AML screening timestamp
11. WHEN Risk_Level is "High", THE System SHALL require Salvage_Manager approval before Tier 2 upgrade
12. WHEN Risk_Level is "Medium", THE System SHALL flag for Salvage_Manager review but allow conditional approval
13. WHEN Risk_Level is "Low", THE System SHALL proceed with automatic Tier 2 upgrade after all verifications pass

### Requirement 8: Multi-Step Tier 2 Upgrade Workflow

**User Story:** As a vendor, I want to complete Tier 2 verification through a guided multi-step process, so that I understand what documents are needed and can track my progress.

#### Acceptance Criteria

1. WHEN a Tier_1 vendor accesses the Tier 2 upgrade page, THE System SHALL display a progress indicator showing 5 steps
2. THE System SHALL display Step 1: NIN Verification with input field for 11-digit NIN
3. WHEN Step 1 is complete, THE System SHALL enable Step 2: Photo ID Upload
4. THE System SHALL display Step 2: Photo ID Upload with dropdown for ID type and file upload button
5. WHEN Step 2 is complete, THE System SHALL enable Step 3: Selfie Capture
6. THE System SHALL display Step 3: Selfie Capture with camera activation button and liveness instructions
7. WHEN Step 3 is complete, THE System SHALL enable Step 4: Address Proof Upload
8. THE System SHALL display Step 4: Address Proof Upload with file upload button and date requirements
9. WHEN Step 4 is complete, THE System SHALL enable Step 5: Business Documents (optional)
10. THE System SHALL display Step 5: Business Documents with CAC certificate upload (optional for individual vendors)
11. WHEN all required steps are complete, THE System SHALL display a review screen showing all submitted documents
12. WHEN the vendor confirms submission, THE System SHALL trigger all Dojah_API verifications in parallel
13. WHEN verifications are in progress, THE System SHALL display a loading screen with estimated completion time (30-60 seconds)
14. WHEN all verifications complete successfully, THE System SHALL display a success message and redirect to dashboard
15. IF any verification fails, THEN THE System SHALL display specific error messages and allow the vendor to retry failed steps


### Requirement 9: Salvage Manager Review and Approval

**User Story:** As a Salvage Manager, I want to review flagged Tier 2 KYC applications, so that I can manually verify documents and approve or reject vendors.

#### Acceptance Criteria

1. WHEN a vendor's verification is flagged for manual review, THE System SHALL create a pending approval record
2. WHEN a pending approval is created, THE System SHALL send SMS notification to all Salvage_Manager users
3. WHEN a pending approval is created, THE System SHALL send email notification to all Salvage_Manager users with vendor details
4. WHEN a Salvage_Manager accesses the approvals page, THE System SHALL display all pending Tier 2 KYC applications
5. THE System SHALL display vendor name, submission date, verification status, and flagged reasons for each application
6. WHEN a Salvage_Manager clicks on an application, THE System SHALL display all uploaded documents with preview capability
7. THE System SHALL display NIN verification results, biometric Match_Score, and AML_Screening Risk_Level
8. WHEN a Salvage_Manager approves an application, THE System SHALL upgrade the vendor to Tier_2 status
9. WHEN a Salvage_Manager rejects an application, THE System SHALL require a rejection reason comment
10. WHEN an application is approved, THE System SHALL send SMS and email notification to the vendor
11. WHEN an application is rejected, THE System SHALL send SMS and email notification with rejection reason
12. THE System SHALL record the Salvage_Manager's user ID, decision, and timestamp in the Audit_Trail
13. WHEN an application is rejected, THE System SHALL allow the vendor to resubmit after 24 hours

### Requirement 10: Tier 2 Transaction Limit Enforcement

**User Story:** As a system administrator, I want to enforce transaction limits based on vendor tier, so that unverified vendors cannot exceed regulatory limits.

#### Acceptance Criteria

1. WHEN a Tier_1 vendor attempts to bid above ₦500,000, THE System SHALL block the bid and display an upgrade prompt
2. WHEN a Tier_2 vendor places a bid, THE System SHALL allow unlimited bid amounts
3. WHEN a Tier_1 vendor wins an auction above ₦500,000, THE System SHALL block payment processing
4. WHEN payment is blocked, THE System SHALL display a message requiring Tier 2 upgrade within 48 hours
5. WHEN a vendor upgrades to Tier_2 within the Grace_Period, THE System SHALL unlock the payment
6. IF the Grace_Period expires without upgrade, THEN THE System SHALL cancel the auction win and refund the deposit
7. THE System SHALL log all tier-based transaction blocks in the Audit_Trail
8. WHEN a vendor's Tier_2 status is revoked, THE System SHALL immediately enforce Tier_1 limits on future transactions


### Requirement 11: Sensitive Data Encryption and Security

**User Story:** As a security officer, I want all sensitive KYC data encrypted at rest, so that we comply with data protection regulations and prevent data breaches.

#### Acceptance Criteria

1. WHEN a NIN is received from Dojah_API, THE System SHALL encrypt it using AES-256-CBC before database storage
2. WHEN a BVN is stored, THE System SHALL encrypt it using AES-256-CBC before database storage
3. WHEN encryption is performed, THE System SHALL generate a random 16-byte initialization vector (IV) for each encryption
4. THE System SHALL store the IV prepended to the encrypted data in format `{IV}:{encrypted_data}`
5. WHEN encrypted data is retrieved, THE System SHALL decrypt it using the stored IV and encryption key
6. THE System SHALL store the encryption key in environment variable ENCRYPTION_KEY with 64-character hex string
7. THE System SHALL never log or display unencrypted NIN or BVN values in application logs
8. WHEN displaying NIN or BVN to users, THE System SHALL mask all digits except the last 4 (e.g., *******8901)
9. THE System SHALL implement Round_Trip_Property test: decrypt(encrypt(nin)) equals original nin
10. THE System SHALL restrict database access to encrypted fields using row-level security policies
11. WHEN a vendor requests data deletion, THE System SHALL securely delete all encrypted KYC data
12. THE System SHALL rotate encryption keys every 12 months and re-encrypt all stored data

### Requirement 12: Audit Trail and Compliance Logging

**User Story:** As a compliance officer, I want a complete audit trail of all KYC verification steps, so that I can demonstrate regulatory compliance during audits.

#### Acceptance Criteria

1. WHEN a vendor initiates Tier 2 upgrade, THE System SHALL log the action with timestamp, user ID, and IP address
2. WHEN each Dojah_API call is made, THE System SHALL log the endpoint, request parameters (excluding sensitive data), and response status
3. WHEN verification results are received, THE System SHALL log the verification type, result (pass/fail), and match scores
4. WHEN documents are uploaded, THE System SHALL log the document type, file size, upload timestamp, and Cloudinary URL
5. WHEN a Salvage_Manager reviews an application, THE System SHALL log the manager's user ID, decision, and comments
6. WHEN a vendor's tier status changes, THE System SHALL log the old status, new status, reason, and timestamp
7. THE System SHALL store all audit logs in an immutable audit_logs table with no update or delete permissions
8. THE System SHALL retain audit logs for 7 years to comply with CBN record-keeping requirements
9. WHEN a compliance officer requests audit reports, THE System SHALL generate CSV exports filtered by date range and vendor ID
10. THE System SHALL include audit log entries in all KYC-related API responses for transparency
11. WHEN suspicious activity is detected, THE System SHALL create high-priority audit log entries for investigation
12. THE System SHALL implement log integrity verification using cryptographic hashing to prevent tampering


### Requirement 13: Cost Management and API Call Optimization

**User Story:** As a finance officer, I want to minimize Dojah API costs, so that we can scale the KYC system cost-effectively.

#### Acceptance Criteria

1. WHEN a NIN is verified successfully, THE System SHALL cache the verification result for 24 hours
2. WHEN a cached NIN verification exists, THE System SHALL return cached data without calling Dojah_API
3. WHEN a vendor retries verification within 24 hours, THE System SHALL use cached results and avoid duplicate charges
4. THE System SHALL use basic NIN lookup (₦80) by default instead of advanced NIN lookup (₦150)
5. WHERE advanced NIN data is required, THE System SHALL only call advanced lookup after Salvage_Manager approval
6. WHEN multiple verifications are needed, THE System SHALL batch API calls where Dojah_API supports batching
7. THE System SHALL track API call costs per vendor in a verification_costs table
8. THE System SHALL record: verification_type, cost_amount, currency (NGN), timestamp, and vendor_id
9. WHEN monthly costs exceed ₦100,000, THE System SHALL send alert email to finance officers
10. THE System SHALL generate monthly cost reports showing total spend by verification type
11. WHEN Dojah_API rate limits are reached, THE System SHALL implement exponential backoff retry logic
12. THE System SHALL display estimated verification cost (₦510-630) to vendors before they start Tier 2 upgrade

### Requirement 14: Notification System Integration

**User Story:** As a vendor, I want to receive SMS and email notifications about my KYC verification status, so that I stay informed about my application progress.

#### Acceptance Criteria

1. WHEN a vendor submits Tier 2 application, THE System SHALL send SMS confirmation within 30 seconds
2. WHEN a vendor submits Tier 2 application, THE System SHALL send email confirmation within 2 minutes
3. WHEN all verifications pass automatically, THE System SHALL send SMS and email with "Approved" status
4. WHEN verification is flagged for manual review, THE System SHALL send SMS and email with "Under Review" status
5. WHEN a Salvage_Manager approves the application, THE System SHALL send SMS and email with "Approved" status and Tier 2 benefits
6. WHEN a Salvage_Manager rejects the application, THE System SHALL send SMS and email with rejection reason
7. THE System SHALL include a direct link to the vendor dashboard in all email notifications
8. WHEN AML screening detects high risk, THE System SHALL send internal alert to all Salvage_Manager users
9. WHEN a vendor's Tier 2 status is about to expire (30 days before), THE System SHALL send renewal reminder
10. THE System SHALL respect vendor notification preferences (SMS enabled/disabled, email enabled/disabled)
11. WHEN SMS delivery fails, THE System SHALL log the failure and retry once after 5 minutes
12. WHEN email delivery fails, THE System SHALL log the failure and retry once after 10 minutes


### Requirement 15: Database Schema Extensions

**User Story:** As a database administrator, I want to extend the vendors table with Tier 2 KYC fields, so that we can store all verification data properly.

#### Acceptance Criteria

1. THE System SHALL add column `nin_number` (VARCHAR 11) to vendors table for encrypted NIN storage
2. THE System SHALL add column `nin_verification_data` (JSONB) to vendors table for NIMC response data
3. THE System SHALL add column `nin_verified_at` (TIMESTAMP) to vendors table for verification timestamp
4. THE System SHALL add column `photo_id_url` (VARCHAR 500) to vendors table for ID document URL
5. THE System SHALL add column `photo_id_type` (VARCHAR 50) to vendors table for ID type (passport/voters_card/drivers_license)
6. THE System SHALL add column `photo_id_verified_at` (TIMESTAMP) to vendors table for ID verification timestamp
7. THE System SHALL add column `selfie_url` (VARCHAR 500) to vendors table for selfie image URL
8. THE System SHALL add column `liveness_score` (NUMERIC 5,2) to vendors table for liveness probability (0-100)
9. THE System SHALL add column `biometric_match_score` (NUMERIC 5,2) to vendors table for face match percentage
10. THE System SHALL add column `biometric_verified_at` (TIMESTAMP) to vendors table for biometric verification timestamp
11. THE System SHALL add column `address_proof_url` (VARCHAR 500) to vendors table for utility bill URL
12. THE System SHALL add column `address_verified_at` (TIMESTAMP) to vendors table for address verification timestamp
13. THE System SHALL add column `aml_screening_data` (JSONB) to vendors table for AML screening results
14. THE System SHALL add column `aml_risk_level` (VARCHAR 20) to vendors table for risk classification (Low/Medium/High)
15. THE System SHALL add column `aml_screened_at` (TIMESTAMP) to vendors table for AML screening timestamp
16. THE System SHALL add column `business_type` (VARCHAR 50) to vendors table for entity type (individual/sole_proprietor/limited_company)
17. THE System SHALL add column `cac_form7_url` (VARCHAR 500) to vendors table for directors list document
18. THE System SHALL add column `director_ids` (JSONB) to vendors table for director KYC data array
19. THE System SHALL add column `tier2_submitted_at` (TIMESTAMP) to vendors table for application submission timestamp
20. THE System SHALL add column `tier2_approved_at` (TIMESTAMP) to vendors table for approval timestamp
21. THE System SHALL add column `tier2_approved_by` (UUID) to vendors table for Salvage_Manager user ID foreign key
22. THE System SHALL add column `tier2_rejection_reason` (TEXT) to vendors table for rejection comments
23. THE System SHALL create index on `nin_verified_at` for performance optimization
24. THE System SHALL create index on `aml_risk_level` for filtering high-risk vendors
25. THE System SHALL create composite index on `tier` and `status` for vendor listing queries


### Requirement 16: Dojah API Integration Service

**User Story:** As a backend developer, I want a centralized Dojah service class, so that all API calls are consistent and maintainable.

#### Acceptance Criteria

1. THE System SHALL create a DojahService class in `src/features/kyc/services/dojah.service.ts`
2. THE System SHALL read Dojah API credentials from environment variables: DOJAH_API_KEY, DOJAH_APP_ID, DOJAH_PUBLIC_KEY
3. WHEN DojahService is instantiated without credentials, THE System SHALL throw a configuration error
4. THE System SHALL implement method `verifyNIN(nin: string)` that calls Dojah NIN Lookup endpoint
5. THE System SHALL implement method `verifyNINAdvanced(nin: string)` that calls Dojah Advanced NIN Lookup endpoint
6. THE System SHALL implement method `checkLiveness(selfieUrl: string)` that calls Dojah Liveness Check endpoint
7. THE System SHALL implement method `verifyDocument(documentUrl: string, documentType: string)` that calls Dojah Document Analysis endpoint
8. THE System SHALL implement method `verifyUtilityBill(billUrl: string)` that calls Dojah Utility Bill Verification endpoint
9. THE System SHALL implement method `verifyCAC(rcNumber: string)` that calls Dojah CAC Lookup endpoint
10. THE System SHALL implement method `verifyBusinessDocument(documentUrl: string)` that calls Dojah Business Document Verification endpoint
11. THE System SHALL implement method `screenAML(fullName: string, dateOfBirth: string)` that calls Dojah AML Screening v2 endpoint
12. WHEN any Dojah_API call fails with network error, THE System SHALL retry up to 3 times with exponential backoff
13. WHEN Dojah_API returns 429 rate limit error, THE System SHALL wait 60 seconds before retry
14. WHEN Dojah_API returns 500 server error, THE System SHALL log the error and return a service unavailable message
15. THE System SHALL set request timeout to 30 seconds for all Dojah_API calls
16. THE System SHALL log all API requests and responses (excluding sensitive data) for debugging
17. THE System SHALL implement Round_Trip_Property test for all API response parsing functions

### Requirement 17: Leaderboard Tier 2 Eligibility

**User Story:** As a vendor, I want to appear on the leaderboard only after completing Tier 2 verification, so that I can compete with other verified vendors.

#### Acceptance Criteria

1. WHEN calculating leaderboard rankings, THE System SHALL exclude all Tier_1 vendors
2. WHEN a vendor upgrades to Tier_2, THE System SHALL include them in leaderboard calculations within 5 minutes
3. WHEN displaying the leaderboard, THE System SHALL show a "Tier 2 Verified" badge next to each vendor name
4. WHEN a Tier_1 vendor views the leaderboard, THE System SHALL display a banner prompting Tier 2 upgrade
5. THE System SHALL recalculate leaderboard rankings every 6 hours
6. WHEN a vendor's Tier_2 status is revoked, THE System SHALL remove them from the leaderboard immediately


### Requirement 18: High-Value Auction Access Control

**User Story:** As an auction manager, I want to restrict high-value auctions (above ₦500,000) to Tier 2 vendors only, so that we minimize payment default risk.

#### Acceptance Criteria

1. WHEN creating an auction with reserve price above ₦500,000, THE System SHALL mark it as "Tier 2 Only"
2. WHEN a Tier_1 vendor views a Tier 2 Only auction, THE System SHALL display the auction details but disable the bid button
3. WHEN a Tier_1 vendor attempts to bid on a Tier 2 Only auction, THE System SHALL block the bid and display upgrade prompt
4. WHEN a Tier_2 vendor views any auction, THE System SHALL enable bidding regardless of auction value
5. THE System SHALL display a "Tier 2 Required" badge on all Tier 2 Only auction cards
6. WHEN filtering auctions, THE System SHALL provide a "Tier 2 Only" filter option
7. WHEN a vendor upgrades to Tier_2, THE System SHALL send email notification highlighting newly accessible high-value auctions

### Requirement 19: Vendor Profile Tier 2 Badge Display

**User Story:** As a vendor, I want to display my Tier 2 verification badge on my profile, so that other users can see my verified status.

#### Acceptance Criteria

1. WHEN a Tier_2 vendor's profile is displayed, THE System SHALL show a gold "Tier 2 Verified" badge next to their name
2. WHEN a Tier_1 vendor's profile is displayed, THE System SHALL show a silver "Tier 1 Verified" badge next to their name
3. WHEN hovering over the Tier 2 badge, THE System SHALL display a tooltip with verification details and date
4. THE System SHALL display the badge on: vendor profile page, bid history, auction winner announcements, and leaderboard
5. WHEN a vendor's profile picture is displayed, THE System SHALL overlay a small verification checkmark icon

### Requirement 20: Tier 2 Re-verification and Expiry

**User Story:** As a compliance officer, I want Tier 2 verification to expire after 12 months, so that we maintain up-to-date KYC information.

#### Acceptance Criteria

1. WHEN a vendor completes Tier 2 verification, THE System SHALL set an expiry date 12 months from approval date
2. WHEN the expiry date is 30 days away, THE System SHALL send SMS and email reminder to the vendor
3. WHEN the expiry date is 7 days away, THE System SHALL send a second SMS and email reminder
4. WHEN the expiry date is reached, THE System SHALL downgrade the vendor to Tier_1 status
5. WHEN a vendor is downgraded, THE System SHALL send SMS and email notification with re-verification instructions
6. WHEN a downgraded vendor has active bids above ₦500,000, THE System SHALL allow those bids to complete but block new high-value bids
7. THE System SHALL allow vendors to re-verify 60 days before expiry date
8. WHEN re-verification is completed, THE System SHALL extend the expiry date by 12 months from completion date
9. THE System SHALL run a daily cron job to check for expired Tier 2 verifications
10. THE System SHALL log all expiry-related status changes in the Audit_Trail


### Requirement 21: Error Handling and User Feedback

**User Story:** As a vendor, I want clear error messages when verification fails, so that I know exactly what to fix and can retry successfully.

#### Acceptance Criteria

1. WHEN NIN format is invalid, THE System SHALL display error: "Invalid NIN format. Please enter exactly 11 digits."
2. WHEN NIN verification fails at Dojah_API, THE System SHALL display error: "Unable to verify NIN. Please check your NIN and try again."
3. WHEN name mismatch is detected, THE System SHALL display error: "Name on NIN does not match your registered name. Please contact support."
4. WHEN liveness check fails, THE System SHALL display error: "Liveness check failed. Please ensure good lighting and retake your selfie."
5. WHEN biometric match score is low, THE System SHALL display error: "Face does not match ID photo. Please ensure clear photos and try again."
6. WHEN document is expired, THE System SHALL display error: "Document has expired. Please upload a valid, unexpired document."
7. WHEN utility bill is too old, THE System SHALL display error: "Utility bill must be within the last 3 months. Please upload a recent bill."
8. WHEN file size exceeds limit, THE System SHALL display error: "File size exceeds 5MB. Please compress the file and try again."
9. WHEN Dojah_API is unavailable, THE System SHALL display error: "Verification service is temporarily unavailable. Please try again in a few minutes."
10. WHEN network timeout occurs, THE System SHALL display error: "Request timed out. Please check your internet connection and try again."
11. THE System SHALL provide a "Contact Support" button on all error screens with pre-filled error details
12. THE System SHALL log all user-facing errors with full context for support team investigation

### Requirement 22: Performance and Scalability

**User Story:** As a system administrator, I want the Tier 2 KYC system to handle 1,000 concurrent verifications, so that we can scale to 100,000+ vendors.

#### Acceptance Criteria

1. WHEN 1,000 vendors submit Tier 2 applications simultaneously, THE System SHALL process all requests without errors
2. WHEN processing verifications, THE System SHALL complete each vendor's full verification within 60 seconds
3. THE System SHALL implement database connection pooling with minimum 10 and maximum 50 connections
4. THE System SHALL implement Redis caching for NIN verification results with 24-hour TTL
5. WHEN uploading documents to Cloudinary, THE System SHALL use parallel uploads for multiple files
6. THE System SHALL implement rate limiting: maximum 10 verification attempts per vendor per hour
7. WHEN rate limit is exceeded, THE System SHALL return HTTP 429 with retry-after header
8. THE System SHALL implement database indexes on all foreign keys and frequently queried columns
9. THE System SHALL use database transactions for all multi-step verification processes
10. WHEN a transaction fails, THE System SHALL rollback all changes and return the vendor to the previous step
11. THE System SHALL implement health check endpoint `/api/health/kyc` that verifies Dojah_API connectivity
12. THE System SHALL monitor API response times and alert when average exceeds 5 seconds


### Requirement 23: Testing and Quality Assurance

**User Story:** As a QA engineer, I want comprehensive test coverage for the KYC system, so that we can deploy with confidence.

#### Acceptance Criteria

1. THE System SHALL implement unit tests for all DojahService methods with 90% code coverage
2. THE System SHALL implement integration tests for the complete Tier 2 upgrade workflow
3. THE System SHALL implement property-based tests for encryption Round_Trip_Property
4. THE System SHALL implement property-based tests for name fuzzy matching with various Nigerian name formats
5. THE System SHALL implement mock Dojah_API responses for all test scenarios
6. THE System SHALL implement test fixtures for: valid NIN, invalid NIN, expired documents, low liveness scores
7. THE System SHALL implement end-to-end tests using Playwright for the complete UI workflow
8. THE System SHALL implement load tests simulating 1,000 concurrent verifications
9. THE System SHALL implement security tests for SQL injection, XSS, and CSRF vulnerabilities
10. THE System SHALL implement accessibility tests ensuring WCAG 2.1 AA compliance for all KYC pages
11. THE System SHALL implement visual regression tests for all KYC UI components
12. THE System SHALL run all tests in CI/CD pipeline before deployment

### Requirement 24: Documentation and Developer Experience

**User Story:** As a developer, I want comprehensive documentation for the KYC system, so that I can maintain and extend it easily.

#### Acceptance Criteria

1. THE System SHALL include JSDoc comments for all public methods in DojahService
2. THE System SHALL include README.md in `src/features/kyc/` explaining the verification flow
3. THE System SHALL include API documentation for all KYC endpoints using OpenAPI/Swagger
4. THE System SHALL include database schema documentation with entity-relationship diagrams
5. THE System SHALL include example code snippets for common KYC operations
6. THE System SHALL include troubleshooting guide for common Dojah_API errors
7. THE System SHALL include deployment guide with environment variable setup instructions
8. THE System SHALL include cost estimation calculator for different verification volumes
9. THE System SHALL include compliance checklist mapping requirements to CBN/NAICOM regulations
10. THE System SHALL include runbook for handling production incidents (API downtime, verification failures)


### Requirement 25: Dojah API Response Parsing and Validation

**User Story:** As a backend developer, I want robust parsing of Dojah API responses, so that the system handles all response formats correctly.

#### Acceptance Criteria

1. WHEN Dojah_API returns NIN data, THE System SHALL validate the response contains required fields: first_name, last_name, date_of_birth
2. WHEN required fields are missing, THE System SHALL log the error and return a validation failure message
3. THE System SHALL implement Zod schemas for all Dojah_API response types
4. WHEN parsing Dojah_API responses, THE System SHALL use Zod schema validation before processing
5. WHEN Zod validation fails, THE System SHALL log the validation errors and return a structured error response
6. THE System SHALL implement Round_Trip_Property test: parse(format(dojahResponse)) equals original response
7. WHEN date fields are received, THE System SHALL normalize all dates to ISO 8601 format (YYYY-MM-DD)
8. WHEN phone numbers are received, THE System SHALL normalize to E.164 format (+234XXXXXXXXXX)
9. WHEN address fields contain multiple lines, THE System SHALL concatenate with comma separators
10. THE System SHALL handle null/undefined fields gracefully without throwing exceptions
11. WHEN Dojah_API returns unexpected response structure, THE System SHALL log the raw response for debugging
12. THE System SHALL implement type-safe response interfaces for all Dojah_API endpoints

### Requirement 26: Vendor Dashboard Tier 2 Status Display

**User Story:** As a vendor, I want to see my Tier 2 verification status on my dashboard, so that I know what steps remain and when my application will be reviewed.

#### Acceptance Criteria

1. WHEN a Tier_1 vendor views their dashboard, THE System SHALL display a prominent "Upgrade to Tier 2" card
2. THE System SHALL display current tier, verification status, and maximum bid limit on the dashboard
3. WHEN a vendor has started but not completed Tier 2 upgrade, THE System SHALL display progress percentage
4. THE System SHALL display which verification steps are complete and which are pending
5. WHEN verification is flagged for manual review, THE System SHALL display "Under Review" status with estimated review time (24-48 hours)
6. WHEN verification is approved, THE System SHALL display "Tier 2 Verified" badge with approval date
7. WHEN verification is rejected, THE System SHALL display rejection reason and "Resubmit" button
8. THE System SHALL display Tier 2 expiry date for verified vendors
9. WHEN expiry is within 30 days, THE System SHALL display a renewal reminder banner
10. THE System SHALL provide a "View Verification Details" link that shows all submitted documents and verification results


### Requirement 27: Mobile Responsiveness and Accessibility

**User Story:** As a vendor using a mobile device, I want to complete Tier 2 verification on my phone, so that I don't need a computer.

#### Acceptance Criteria

1. WHEN a vendor accesses the Tier 2 upgrade page on mobile, THE System SHALL display a mobile-optimized layout
2. THE System SHALL enable native camera access on mobile devices for selfie capture
3. WHEN capturing a selfie on mobile, THE System SHALL display camera preview in portrait orientation
4. THE System SHALL support file upload from mobile photo gallery for document uploads
5. THE System SHALL compress images on mobile devices before upload to reduce data usage
6. WHEN displaying progress steps on mobile, THE System SHALL use a vertical stepper layout
7. THE System SHALL ensure all buttons and input fields have minimum 44x44px touch targets
8. THE System SHALL support screen readers for all form fields and error messages
9. THE System SHALL provide alternative text for all images and icons
10. THE System SHALL ensure color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for text)
11. THE System SHALL support keyboard navigation for all interactive elements
12. THE System SHALL display loading states with accessible ARIA labels during verification

### Requirement 28: Fraud Detection and Risk Scoring

**User Story:** As a risk officer, I want automated fraud detection during KYC verification, so that we can identify suspicious applications early.

#### Acceptance Criteria

1. WHEN a vendor submits multiple applications with different names but same NIN, THE System SHALL flag as potential identity fraud
2. WHEN a vendor uploads a document with detected tampering, THE System SHALL flag for manual review
3. WHEN biometric Match_Score is between 60-79%, THE System SHALL flag as potential impersonation
4. WHEN a vendor's IP address is associated with multiple accounts, THE System SHALL flag for investigation
5. WHEN a vendor completes verification unusually fast (under 2 minutes), THE System SHALL flag as potential bot activity
6. WHEN AML screening returns multiple sanctions matches, THE System SHALL automatically reject the application
7. THE System SHALL calculate a composite fraud risk score (0-100) based on all verification signals
8. WHEN fraud risk score exceeds 70, THE System SHALL require additional verification steps
9. THE System SHALL log all fraud detection signals in the Audit_Trail
10. THE System SHALL provide a fraud dashboard for risk officers showing flagged applications
11. WHEN a vendor is flagged for fraud, THE System SHALL suspend their account pending investigation
12. THE System SHALL implement machine learning model to improve fraud detection over time (future enhancement)


### Requirement 29: Regulatory Compliance Reporting

**User Story:** As a compliance officer, I want to generate regulatory reports for CBN and NAICOM audits, so that we can demonstrate KYC compliance.

#### Acceptance Criteria

1. THE System SHALL provide a report showing total Tier 1 and Tier 2 vendors by month
2. THE System SHALL provide a report showing verification success rates by verification type
3. THE System SHALL provide a report showing average verification completion time
4. THE System SHALL provide a report showing AML screening results by Risk_Level
5. THE System SHALL provide a report showing rejected applications with rejection reasons
6. THE System SHALL provide a report showing expired Tier 2 verifications and renewal rates
7. THE System SHALL export all reports in CSV and PDF formats
8. THE System SHALL include report generation date, officer name, and digital signature
9. WHEN generating reports, THE System SHALL filter by date range, tier, and status
10. THE System SHALL retain all reports for 7 years in secure storage
11. THE System SHALL provide API endpoint for automated report generation
12. THE System SHALL send monthly compliance summary reports to designated compliance officers

### Requirement 30: Vendor Support and Help System

**User Story:** As a vendor, I want access to help documentation and support during KYC verification, so that I can resolve issues quickly.

#### Acceptance Criteria

1. WHEN a vendor accesses the Tier 2 upgrade page, THE System SHALL display a "Help" button in the top-right corner
2. WHEN the Help button is clicked, THE System SHALL display a sidebar with FAQs and troubleshooting tips
3. THE System SHALL provide step-by-step video tutorials for each verification step
4. THE System SHALL provide example images of acceptable documents (utility bills, ID cards)
5. THE System SHALL provide a live chat widget for real-time support during business hours (9 AM - 5 PM WAT)
6. WHEN live chat is unavailable, THE System SHALL display a contact form for email support
7. THE System SHALL provide a "Common Issues" section with solutions for: poor lighting, blurry photos, expired documents
8. THE System SHALL track which help articles are most viewed and update content accordingly
9. THE System SHALL provide multilingual support for English, Yoruba, Hausa, and Igbo
10. THE System SHALL display estimated response time for support requests (24-48 hours)


### Requirement 31: Environment Configuration and Deployment

**User Story:** As a DevOps engineer, I want clear environment configuration for Dojah integration, so that I can deploy to staging and production safely.

#### Acceptance Criteria

1. THE System SHALL require environment variable DOJAH_API_KEY for API authentication
2. THE System SHALL require environment variable DOJAH_APP_ID for application identification
3. THE System SHALL require environment variable DOJAH_PUBLIC_KEY for client-side SDK (if used)
4. THE System SHALL require environment variable ENCRYPTION_KEY (64-character hex) for NIN/BVN encryption
5. THE System SHALL require environment variable DOJAH_BASE_URL with default `https://api.dojah.io`
6. THE System SHALL support separate Dojah credentials for staging and production environments
7. WHEN required environment variables are missing, THE System SHALL fail startup with clear error messages
8. THE System SHALL validate ENCRYPTION_KEY length is exactly 64 characters on startup
9. THE System SHALL provide `.env.example` file with all required KYC environment variables
10. THE System SHALL document environment variable setup in deployment guide
11. THE System SHALL use different Cloudinary folders for staging and production KYC documents
12. THE System SHALL implement feature flag `ENABLE_TIER2_KYC` to enable/disable Tier 2 functionality

## Correctness Properties

### Property 1: NIN Encryption Round-Trip (Invariant)

**Property:** For all valid NIN strings, decrypting an encrypted NIN SHALL return the original NIN.

**Test:** `decrypt(encrypt(nin)) === nin` for all 11-digit NIN values.

**Rationale:** This ensures data integrity for sensitive NIN storage. If encryption/decryption fails, vendors cannot be verified correctly.

### Property 2: Verification Idempotence

**Property:** Verifying the same NIN multiple times within 24 hours SHALL return identical results without calling Dojah_API.

**Test:** `verifyNIN(nin) === verifyNIN(nin)` when called twice within cache TTL.

**Rationale:** This prevents duplicate API charges and ensures consistent verification results.

### Property 3: Tier Upgrade Monotonicity

**Property:** A vendor's tier SHALL never decrease except through explicit downgrade actions (expiry, suspension).

**Test:** For all tier changes, `newTier >= oldTier` OR action is "expire" OR action is "suspend".

**Rationale:** This prevents accidental tier downgrades that could disrupt vendor operations.


### Property 4: Audit Trail Immutability

**Property:** Once an audit log entry is created, it SHALL never be modified or deleted.

**Test:** For all audit log records, `record.createdAt === record.updatedAt` AND no DELETE operations exist.

**Rationale:** This ensures compliance with regulatory requirements for tamper-proof audit trails.

### Property 5: Document Upload Atomicity

**Property:** Either all documents for a verification step are uploaded successfully, or none are stored.

**Test:** For all verification attempts, `count(uploadedDocuments) === expectedDocumentCount` OR `count(uploadedDocuments) === 0`.

**Rationale:** This prevents partial verification states that could cause data inconsistency.

### Property 6: Biometric Match Score Bounds

**Property:** All biometric match scores SHALL be between 0 and 100 inclusive.

**Test:** For all biometric verifications, `0 <= matchScore <= 100`.

**Rationale:** This ensures match scores are valid percentages and prevents calculation errors.

### Property 7: AML Risk Level Consistency

**Property:** If AML screening finds sanctions matches, Risk_Level SHALL always be "High".

**Test:** For all AML screenings, `sanctionsMatches.length > 0` implies `riskLevel === "High"`.

**Rationale:** This ensures critical risk indicators are never downgraded incorrectly.

### Property 8: Tier 2 Transaction Limit Enforcement

**Property:** A Tier 1 vendor SHALL never successfully place a bid above ₦500,000.

**Test:** For all bids, `vendor.tier === "tier1_bvn"` implies `bidAmount <= 500000`.

**Rationale:** This enforces regulatory transaction limits and prevents compliance violations.

### Property 9: Notification Delivery Guarantee

**Property:** For every tier status change, at least one notification (SMS or email) SHALL be sent.

**Test:** For all status changes, `smsDelivered === true` OR `emailDelivered === true`.

**Rationale:** This ensures vendors are always informed of their verification status.

### Property 10: Dojah API Response Parsing Round-Trip

**Property:** Parsing and formatting Dojah API responses SHALL preserve all data.

**Test:** `parse(format(dojahResponse)) === dojahResponse` for all response types.

**Rationale:** This ensures no data loss during API response processing.


## Edge Cases and Error Conditions

### Edge Case 1: Duplicate NIN Submissions

**Scenario:** Multiple vendors attempt to verify using the same NIN.

**Expected Behavior:** THE System SHALL allow the first verification to succeed and flag subsequent attempts for fraud investigation.

### Edge Case 2: Network Timeout During Verification

**Scenario:** Dojah API call times out after 30 seconds.

**Expected Behavior:** THE System SHALL retry the request up to 3 times, then return a user-friendly error message and allow the vendor to retry manually.

### Edge Case 3: Partial Document Upload Failure

**Scenario:** Selfie uploads successfully but Photo ID upload fails.

**Expected Behavior:** THE System SHALL rollback the selfie upload and return the vendor to the document upload step with an error message.

### Edge Case 4: Vendor Deletes Account During Verification

**Scenario:** A vendor deletes their account while Tier 2 verification is in progress.

**Expected Behavior:** THE System SHALL cancel all pending verifications, delete uploaded documents from Cloudinary, and remove all KYC data from the database.

### Edge Case 5: Dojah API Returns Malformed Response

**Scenario:** Dojah API returns JSON with missing required fields.

**Expected Behavior:** THE System SHALL log the malformed response, return a validation error, and allow the vendor to retry.

### Edge Case 6: Concurrent Verification Attempts

**Scenario:** A vendor opens two browser tabs and submits verification in both simultaneously.

**Expected Behavior:** THE System SHALL use database locking to process only one verification attempt and return "Verification in progress" error for the second attempt.

### Edge Case 7: Expired Document Uploaded

**Scenario:** A vendor uploads a passport that expired 2 years ago.

**Expected Behavior:** THE System SHALL detect the expiry date, reject the document, and display a clear error message requesting a valid document.

### Edge Case 8: Liveness Check False Negative

**Scenario:** A real person's selfie is flagged as fake due to poor lighting.

**Expected Behavior:** THE System SHALL allow the vendor to retake the selfie up to 3 times, then flag for manual review if all attempts fail.

### Edge Case 9: Name Mismatch Due to Marriage

**Scenario:** A vendor's NIN has their maiden name but they registered with their married name.

**Expected Behavior:** THE System SHALL flag the name mismatch for manual review and allow Salvage_Manager to approve after verifying marriage certificate.

### Edge Case 10: High-Risk AML Match for Common Name

**Scenario:** A vendor has the same name as a person on the sanctions list but is not the same individual.

**Expected Behavior:** THE System SHALL flag for manual review and allow Salvage_Manager to verify using additional identifiers (date of birth, NIN, address).

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Ready for Review  
**Next Phase:** Design Document Creation
