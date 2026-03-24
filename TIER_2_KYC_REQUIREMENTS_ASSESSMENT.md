# Tier 2 KYC Requirements Assessment for NEM Salvage System

**Assessment Date**: January 24, 2026  
**KYC Provider**: Dojah  
**Regulatory Framework**: CBN 3-Tiered KYC + NAICOM Insurance Requirements  
**Status**: ⚠️ REVIEW REQUIRED

---

## Executive Summary

Based on Nigerian regulatory requirements (CBN, NAICOM, NFIU) and Dojah's capabilities, here's what you need for **Tier 2 KYC verification** for your salvage auction platform.

---

## 📋 CBN TIER 2 KYC REQUIREMENTS (Official)

According to the Central Bank of Nigeria's 3-Tiered KYC Framework:

### Tier 2: Medium-Value Accounts

**Account Limits**:
- Daily transaction limit: ₦200,000
- Cumulative balance: ₦500,000
- Suitable for medium-value transactions

**Required Documents**:
1. ✅ **BVN (Bank Verification Number)** - MANDATORY
2. ✅ **NIN (National Identification Number)** - MANDATORY (as of 2024 CBN directive)
3. ✅ **Passport Photograph**
4. ✅ **Valid Government-Issued ID** (one of):
   - National e-ID Card
   - International Passport
   - Permanent Voter's Card (PVC)
   - Driver's License
5. ✅ **Proof of Address** (one of):
   - Utility bill (electricity, water) - within last 3 months
   - Tenancy/lease agreement
   - Bank statement
   - Employer letter

**Verification Requirements**:
- ✅ Face-to-face interaction OR electronic verification
- ✅ Verification against government-backed databases (NIMC, NIBSS)
- ✅ Biometric matching (optional but recommended)
- ✅ Liveness detection (for remote verification)

**Account Type**:
- Strictly savings accounts
- Fund transfers within Nigeria only
- Can be linked to mobile phone
- No minimum opening balance

---

## 🏢 ADDITIONAL REQUIREMENTS FOR BUSINESS/CORPORATE VENDORS

Since your platform deals with business vendors (salvage buyers), you also need:

### For Corporate Entities (Tier 2 Business)

1. ✅ **CAC Certificate of Incorporation**
2. ✅ **Tax Identification Number (TIN)**
3. ✅ **CAC Form CO7** (directors and shareholders)
4. ✅ **Business Address Proof** (utility bill)
5. ✅ **Valid ID for Directors/Signatories** (BVN + NIN + Photo ID)
6. ✅ **Business Bank Account Details**

---

## 🔍 WHAT DOJAH CAN VERIFY

Based on Dojah's API capabilities, here's what they can do:

### ✅ Available Verifications

1. **BVN Verification** ✅
   - Instant verification via NIBSS integration
   - Returns: Name, DOB, Phone, Photo
   - Validates against customer-provided data

2. **NIN Verification** ✅
   - Instant verification via NIMC integration
   - Returns: Name, DOB, Address, Photo
   - Biometric data available

3. **Phone Number Verification** ✅
   - OTP-based verification
   - Carrier lookup
   - Active number check

4. **Document Verification** ✅
   - ID card scanning (Passport, Voter's Card, Driver's License)
   - AI-powered fraud detection
   - Document authenticity checks

5. **Biometric Verification** ✅
   - Facial recognition
   - Liveness detection
   - Selfie matching against ID photo

6. **Address Verification** ✅
   - Utility bill verification
   - Address data extraction
   - Cross-reference with NIN address

7. **CAC Lookup** ✅ (For Business Vendors)
   - Company registration verification
   - Business status check
   - Director information

8. **AML Screening** ✅
   - PEP (Politically Exposed Persons) check
   - Sanctions list screening
   - Adverse media monitoring

---

## ⚠️ WHAT'S MISSING IN YOUR CURRENT IMPLEMENTATION

Let me check your current vendor schema to see what you have:

<function_calls>
<invoke name="grepSearch">
<parameter name="explanation">Finding vendor schema to check current KYC fields