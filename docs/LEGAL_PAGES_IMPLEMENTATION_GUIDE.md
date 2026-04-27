# Legal Pages Implementation Guide

**Date**: April 27, 2026  
**Status**: ✅ READY FOR IMPLEMENTATION  
**Compliance**: NDPA 2023, Nigerian Law

---

## Overview

This document provides comprehensive legal content for NEM Insurance's Salvage Auction Platform. All documents are drafted to:

1. **Protect NEM Insurance** from liability
2. **Comply with NDPA 2023** (Nigeria Data Protection Act)
3. **Follow Nigerian legal requirements**
4. **Provide maximum legal protection** for a solo developer
5. **Use enterprise-standard language** and structure

---

## Files Created

### ✅ 1. Terms of Service
**Location**: `src/app/(legal)/terms/page.tsx`  
**Status**: CREATED  
**URL**: `/terms`

**Key Protections**:
- "AS-IS, WHERE-IS" sale disclaimer
- Comprehensive limitation of liability
- Binding bid acknowledgment
- Indemnification clause
- No warranties on AI assessments
- No returns/refunds policy
- Fraud prevention terms

---

## Files to Create

### 2. Privacy Policy
**Location**: `src/app/(legal)/privacy/page.tsx`  
**URL**: `/privacy`

**Required Sections**:

#### 1. Introduction
- Data controller: NEM Insurance Plc
- NDPA 2023 compliance statement
- Contact: dpo@neminsurance.com

#### 2. Data We Collect
**Personal Data**:
- Name, email, phone number
- BVN (Tier 1 KYC)
- NIN, passport, selfie (Tier 2 KYC via Dojah)
- Business registration documents
- Bank account details

**Technical Data**:
- IP address, device fingerprint
- Browser type, operating system
- GPS location (for case creation)
- Cookies and session data
- Bidding history and patterns

**Transaction Data**:
- Payment information (via Paystack)
- Wallet balance and transactions
- Auction participation records
- Document signatures

#### 3. How We Use Data
- **Contract Performance**: Process auctions, payments, KYC
- **Legal Obligation**: Fraud detection, AML compliance
- **Legitimate Interest**: Platform improvement, analytics
- **Consent**: Marketing communications (opt-in)

#### 4. Data Sharing
**Third-Party Services**:
- Paystack (payment processing)
- Dojah (KYC verification)
- Google Maps (location display)
- Gemini AI (damage assessment)
- Supabase (file storage)

**Legal Disclosures**:
- Law enforcement (when required)
- Court orders and legal proceedings
- Regulatory authorities (NAICOM, NITDA)

#### 5. Data Security
- Encryption in transit (TLS/SSL)
- Encryption at rest
- Access controls and authentication
- Regular security audits
- Incident response procedures

#### 6. Data Retention
- Active accounts: Duration of relationship + 7 years
- Inactive accounts: 2 years then anonymization
- Legal requirements: As mandated by law
- Right to deletion (with exceptions)

#### 7. Your Rights (NDPA 2023)
- Right to access your data
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object to processing
- Right to withdraw consent
- Right to lodge complaint with NITDA

#### 8. International Transfers
- Data stored in Nigeria (primary)
- Cloud services may process data internationally
- Adequate safeguards in place

#### 9. Children's Privacy
- Platform not intended for users under 18
- No knowing collection of children's data

#### 10. Changes to Policy
- Notification of material changes
- Continued use = acceptance

---

### 3. Cookie Policy
**Location**: `src/app/(legal)/cookies/page.tsx`  
**URL**: `/cookies`

**Required Sections**:

#### 1. What Are Cookies
- Definition and purpose
- Types of cookies used

#### 2. Cookies We Use

**Essential Cookies** (No consent required):
- `next-auth.session-token` - Authentication
- `next-auth.csrf-token` - Security
- `auction-session` - Bidding state

**Functional Cookies** (Consent required):
- `user-preferences` - UI settings
- `language` - Language preference
- `timezone` - Time display

**Analytics Cookies** (Consent required):
- Google Analytics (if implemented)
- Platform usage analytics
- Performance monitoring

**Marketing Cookies** (Consent required):
- Social media pixels (if implemented)
- Retargeting cookies

#### 3. Managing Cookies
- Browser settings instructions
- Opt-out mechanisms
- Impact of disabling cookies

#### 4. Third-Party Cookies
- Paystack payment cookies
- Google Maps cookies
- Social media cookies

---

### 4. NDPR Compliance Page
**Location**: `src/app/(legal)/ndpr/page.tsx`  
**URL**: `/ndpr`

**Required Sections**:

#### 1. NDPA 2023 Compliance Statement
- Commitment to data protection
- Registration with NITDA (if required)
- Data Protection Officer contact

#### 2. Legal Basis for Processing
- Contract performance
- Legal obligations
- Legitimate interests
- Consent (where applicable)

#### 3. Data Subject Rights
- How to exercise rights
- Response timeframes (30 days)
- Verification procedures
- Exceptions and limitations

#### 4. Data Breach Procedures
- 72-hour notification to NITDA
- User notification procedures
- Incident response plan

#### 5. Cross-Border Data Transfers
- Safeguards in place
- Adequacy decisions
- Standard contractual clauses

#### 6. Data Protection Impact Assessments
- High-risk processing activities
- DPIA procedures
- Mitigation measures

#### 7. Contact Information
- Data Protection Officer
- NITDA contact information
- Complaint procedures

---

## Implementation Checklist

### Phase 1: Create Pages ✅
- [x] Terms of Service page created
- [ ] Privacy Policy page
- [ ] Cookie Policy page
- [ ] NDPR Compliance page

### Phase 2: Legal Review
- [ ] Have Nigerian lawyer review all documents
- [ ] Ensure NDPA 2023 compliance
- [ ] Verify insurance industry requirements
- [ ] Check NAICOM regulations

### Phase 3: Technical Implementation
- [ ] Add cookie consent banner
- [ ] Implement data export functionality
- [ ] Create data deletion workflow
- [ ] Set up NITDA breach notification system
- [ ] Document data retention policies

### Phase 4: Operational
- [ ] Appoint Data Protection Officer
- [ ] Register with NITDA (if required)
- [ ] Train staff on data protection
- [ ] Establish incident response procedures
- [ ] Create user rights request forms

---

## Key Legal Protections

### 1. Limitation of Liability
```
TO THE MAXIMUM EXTENT PERMITTED BY NIGERIAN LAW, NEM INSURANCE SHALL NOT BE LIABLE FOR:
- Indirect, incidental, special, consequential, or punitive damages
- Loss of profits, revenue, data, or business opportunities
- Damages from unauthorized access
- Third-party service failures
```

**Liability Cap**: Lesser of (a) amount paid in last 12 months, or (b) ₦50,000

### 2. "AS-IS" Disclaimer
```
ALL ASSETS ARE SOLD ON AN "AS-IS, WHERE-IS" BASIS WITH ALL FAULTS.
NO WARRANTIES, express or implied, regarding condition, quality, merchantability, or fitness.
```

### 3. Binding Bids
```
ALL BIDS PLACED ON THE PLATFORM ARE LEGALLY BINDING AND IRREVOCABLE.
```

### 4. No Returns
```
ALL SALES ARE FINAL. No returns, refunds, or exchanges except as required by mandatory Nigerian consumer protection law.
```

### 5. Indemnification
```
Users agree to indemnify NEM Insurance from claims arising from:
- User's violation of Terms
- User's fraudulent conduct
- User's violation of third-party rights
```

---

## NDPA 2023 Compliance Requirements

### Data Controller Obligations
1. **Lawful Processing**: Identify legal basis for each processing activity
2. **Transparency**: Clear privacy notices
3. **Purpose Limitation**: Process only for specified purposes
4. **Data Minimization**: Collect only necessary data
5. **Accuracy**: Keep data accurate and up-to-date
6. **Storage Limitation**: Retain only as long as necessary
7. **Security**: Implement appropriate technical and organizational measures
8. **Accountability**: Demonstrate compliance

### Data Subject Rights
1. **Right to Access**: Provide copy of data within 30 days
2. **Right to Rectification**: Correct inaccurate data
3. **Right to Erasure**: Delete data (with exceptions)
4. **Right to Restrict Processing**: Limit processing in certain circumstances
5. **Right to Data Portability**: Provide data in machine-readable format
6. **Right to Object**: Object to processing based on legitimate interests
7. **Right to Withdraw Consent**: Easy withdrawal mechanism

### Breach Notification
- **To NITDA**: Within 72 hours of becoming aware
- **To Data Subjects**: Without undue delay if high risk
- **Content**: Nature of breach, likely consequences, measures taken

---

## Contact Information Template

```
Data Protection Officer
NEM Insurance Plc
199 Ikorodu Road, Obanikoro
Lagos, Nigeria

Email: dpo@neminsurance.com
Privacy: privacy@neminsurance.com
Legal: legal@neminsurance.com
Support: support@neminsurance.com

NITDA Contact:
National Information Technology Development Agency
Plot 28, Port Harcourt Crescent
Off Gimbiya Street, Area 11, Garki
Abuja, Nigeria
Email: info@nitda.gov.ng
Website: www.nitda.gov.ng
```

---

## Next Steps

1. **Create remaining pages** using the structure above
2. **Implement cookie consent banner** (use a library like `react-cookie-consent`)
3. **Add data export API** (`/api/users/export-data`)
4. **Add data deletion API** (`/api/users/delete-account`)
5. **Create DPO email** (dpo@neminsurance.com)
6. **Legal review** by Nigerian lawyer
7. **NITDA registration** (if required for your data processing volume)

---

## Important Notes

### For Solo Developer Protection

1. **These documents provide maximum legal protection** under Nigerian law
2. **Limitation of liability clauses** protect you from catastrophic losses
3. **"AS-IS" disclaimers** protect against asset condition disputes
4. **Indemnification clauses** shift liability to users for their misconduct
5. **Binding bid terms** create enforceable contracts

### Compliance Priority

1. **NDPA 2023** is mandatory - non-compliance can result in fines up to ₦10 million or 2% of annual gross revenue
2. **Data breach notification** is legally required within 72 hours
3. **User rights requests** must be responded to within 30 days
4. **Consent for marketing** must be explicit opt-in

### Risk Mitigation

1. **Insurance**: Consider professional indemnity insurance
2. **Legal counsel**: Have a Nigerian lawyer on retainer
3. **Incident response plan**: Document procedures for data breaches
4. **Regular audits**: Review compliance quarterly
5. **Staff training**: Ensure all staff understand data protection obligations

---

## Disclaimer

**This document is provided for informational purposes only and does not constitute legal advice. You should consult with a qualified Nigerian lawyer to ensure compliance with all applicable laws and regulations.**

---

**Document prepared by**: Kiro AI Assistant  
**Date**: April 27, 2026  
**Version**: 1.0
