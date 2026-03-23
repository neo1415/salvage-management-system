# Termii Sender ID Approval Guide

## Problem

Your SMS shows as "SENT" in Termii dashboard but doesn't reach your phone because **you don't have an approved Sender ID**.

### What Happened
- ✅ SMS sent to Termii API successfully
- ✅ Termii accepted the request (Message ID: 3017699633886152429702363)
- ✅ Dashboard shows "SENT" status
- ❌ **But SMS never reaches your phone**

### Why
Termii requires **approved Sender IDs** before they can deliver SMS to phones. Without an approved sender ID, the SMS is accepted but not delivered.

## Solution: Get Your Sender ID Approved

### Step 1: Login to Termii Dashboard
1. Go to https://termii.com
2. Login with your credentials

### Step 2: Request a Sender ID
1. Navigate to **"Sender ID"** section in the dashboard
2. Click **"Request Sender ID"**
3. Enter your desired sender ID:
   - **Recommended**: `NEMSAL` (already in your .env)
   - **Alternative**: `NEM`, `NEMSALV`, `SALVAGE`
   - **Rules**: 
     - 3-11 characters
     - Alphanumeric only
     - No spaces or special characters

### Step 3: Provide Required Information
Termii will ask for:
- **Company Name**: NEM Insurance / NEM Salvage
- **Purpose**: Transactional SMS (OTP, notifications, alerts)
- **Sample Message**: "Your NEM Salvage verification code is: 123456"
- **Business Documents**: May require CAC documents

### Step 4: Wait for Approval
- **Timeline**: Usually 24-48 hours
- **Status**: Check dashboard for approval status
- **Notification**: You'll receive email when approved

### Step 5: Update Your Code (if needed)
If you use a different sender ID than "NEMSAL", update your `.env`:

```bash
TERMII_SENDER_ID=YOUR_APPROVED_SENDER_ID
```

## Temporary Workaround: Use Termii Dashboard

While waiting for sender ID approval, you can test SMS delivery using Termii dashboard:

1. Go to https://termii.com
2. Navigate to **"Send SMS"** section
3. Enter phone number: `2348141252812`
4. Enter message
5. Click **"Send"**

This will show you if the issue is:
- ✅ Sender ID approval (if dashboard SMS works)
- ❌ Network/phone issue (if dashboard SMS also doesn't work)

## Alternative: Use Different SMS Provider

If you need immediate SMS delivery, consider using **Africa's Talking** as a fallback:

### Africa's Talking Setup
1. Sign up at https://africastalking.com
2. Get API key
3. Add to `.env`:

```bash
AFRICAS_TALKING_API_KEY=your-api-key
AFRICAS_TALKING_USERNAME=your-username
AFRICAS_TALKING_SENDER_ID=your-sender-id
```

4. The SMS service will automatically fallback to Africa's Talking if Termii fails

## Why "generic" Channel Requires Sender ID

Termii has different channels:

| Channel | Sender ID Required | Cost | Delivery |
|---------|-------------------|------|----------|
| `generic` | ✅ Yes (must be approved) | ₦5/SMS | Best delivery |
| `dnd` | ❌ No | ₦7/SMS | DND-enabled numbers only |
| `whatsapp` | ❌ No | ₦10/SMS | Requires WhatsApp setup |

You're using `generic` channel (best for production), which requires an approved sender ID.

## Current Status

### What's Working
- ✅ Termii API integration
- ✅ API authentication
- ✅ Message formatting
- ✅ Balance check (₦4,631.16 available)
- ✅ Request accepted by Termii

### What's Not Working
- ❌ SMS delivery to phone (sender ID not approved)

### Cost Analysis
- **First test**: 4 pages = ₦20 (message was too long)
- **Second test**: 1 page = ₦5 (message under 160 chars)
- **Total spent**: ₦25
- **Remaining balance**: ₦4,631.16

## Next Steps

### Immediate (Today)
1. ✅ Login to Termii dashboard
2. ✅ Request sender ID approval for "NEMSAL"
3. ✅ Test SMS delivery using Termii dashboard

### Short-term (24-48 hours)
1. ⏳ Wait for sender ID approval
2. ⏳ Test SMS delivery again once approved
3. ⏳ Verify SMS reaches your phone

### Long-term (Production)
1. 📋 Keep messages under 160 characters (1 page = ₦5)
2. 📋 Use SMS templates to ensure consistent formatting
3. 📋 Monitor Termii balance and delivery rates
4. 📋 Set up Africa's Talking as fallback

## Message Length Optimization

To avoid multi-page charges:

### Bad (4 pages = ₦20)
```
🎉 Test SMS from NEM Salvage Management System! 

This is a REAL SMS sent at 5:21:39 PM.

If you received this, your SMS service is working perfectly! ✅

- Termii Integration: Active
- Phone: 2348141252812
- Time: 2/1/2026, 5:21:39 PM
```
**Length**: ~250 characters = 4 pages

### Good (1 page = ₦5)
```
Test SMS from NEM Salvage at 5:31:44 PM. If you got this, it works! Reply OK.
```
**Length**: ~80 characters = 1 page

### SMS Length Rules
- **1 page**: 0-160 characters = ₦5
- **2 pages**: 161-306 characters = ₦10
- **3 pages**: 307-459 characters = ₦15
- **4 pages**: 460-612 characters = ₦20

**Tip**: Keep messages under 160 characters to minimize costs!

## Testing Checklist

Once sender ID is approved:

- [ ] Run `npx tsx scripts/send-direct-sms.ts`
- [ ] Check Termii dashboard for "SENT" status
- [ ] Wait 30 seconds
- [ ] Check phone for SMS
- [ ] If received, SMS service is working! ✅
- [ ] If not received, check:
  - [ ] Phone has signal
  - [ ] Phone is not in airplane mode
  - [ ] SIM card is active
  - [ ] Try different phone number

## Support

If sender ID approval takes too long or you need help:

- **Termii Support**: support@termii.com
- **Termii Dashboard**: https://termii.com
- **Documentation**: https://developers.termii.com

## Summary

**Current Issue**: Sender ID "NEMSAL" is not approved yet

**Solution**: Request sender ID approval in Termii dashboard

**Timeline**: 24-48 hours for approval

**Workaround**: Use Termii dashboard to send test SMS manually

**Alternative**: Set up Africa's Talking as fallback provider

---

**Once sender ID is approved, your SMS service will work perfectly!** 🎉
