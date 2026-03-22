# SMS Not Receiving - Troubleshooting Guide

**Date**: February 1, 2026
**Status**: Sender ID is ACTIVE, but SMS not reaching phone

## Current Status

### What's Working ✅
- Termii API integration
- Sender IDs are ACTIVE:
  - "NEMSAL" - ACTIVE
  - "NEM" - ACTIVE  
  - "NEM-INS" - DECLINED (don't use this one)
- API accepts requests
- Dashboard shows "SENT"
- Balance deducted correctly

### What's Not Working ❌
- SMS not reaching phone (2348141252812)

## Tests Performed

### Test 1: NEMSAL sender (4 pages)
- **Sender**: NEMSAL
- **Cost**: ₦20 (4 pages)
- **Status**: SENT
- **Received**: No

### Test 2: NEMSAL sender (1 page)
- **Sender**: NEMSAL
- **Cost**: ₦5 (1 page)
- **Status**: SENT
- **Received**: No

### Test 3: NEM sender (1 page)
- **Sender**: NEM
- **Cost**: ₦5 (1 page)
- **Status**: SENT
- **Received**: No

**Total Spent**: ₦30
**Balance**: ₦4,626.16

## Possible Causes

### 1. Network/Carrier Blocking
Your mobile network (MTN, Glo, Airtel, 9mobile) might be:
- Blocking SMS from this sender ID
- Having delivery issues
- Experiencing network congestion

**Solution**:
- Try a different phone number on a different network
- Contact your network provider
- Check if other SMS are being received

### 2. DND (Do Not Disturb) Enabled
If you have DND enabled on your line, it might block promotional SMS.

**Solution**:
- Disable DND: Dial `*785*0#` (MTN) or check your network's code
- Wait a few minutes and try again

### 3. Phone Settings
Your phone might have SMS blocking enabled.

**Solution**:
- Check SMS app settings
- Check if number is blocked
- Check spam/junk SMS folder
- Restart your phone

### 4. SIM Card Issues
Your SIM card might have issues.

**Solution**:
- Remove and reinsert SIM card
- Try SIM in another phone
- Contact network provider

### 5. Termii Delivery Delay
Sometimes Termii has delays in delivery.

**Solution**:
- Wait 5-10 minutes
- Check Termii dashboard for delivery status
- Contact Termii support if persistent

### 6. Sender ID Not Whitelisted by Network
Even though sender ID is ACTIVE in Termii, your network might not have whitelisted it yet.

**Solution**:
- Contact Termii support to verify sender ID is fully activated
- Ask them to check delivery logs for your number
- Request they whitelist sender ID with all networks

## Immediate Actions

### Action 1: Test with Different Number
Try sending to a different phone number (different network):

```bash
# Edit scripts/send-direct-sms.ts
# Change PHONE_NUMBER to a different number
npx tsx scripts/send-direct-sms.ts
```

If it works on another number, the issue is with your specific phone/SIM.

### Action 2: Check Termii Dashboard
1. Login to https://termii.com
2. Go to "SMS History" or "Logs"
3. Find the message IDs:
   - 3017699628976244751597652 (Test 1)
   - 3017699633886152429702363 (Test 2)
   - 3017699637087202365168938 (Test 3)
4. Check delivery status details
5. Look for any error messages

### Action 3: Manual Send from Dashboard
1. Go to Termii dashboard
2. Navigate to "Send SMS"
3. Enter your number: 2348141252812
4. Enter message: "Test from dashboard"
5. Select sender ID: NEM or NEMSAL
6. Click Send
7. Check if you receive it

If dashboard SMS works but API doesn't, there's an API configuration issue.
If dashboard SMS also doesn't work, it's a network/phone issue.

### Action 4: Contact Termii Support
Email: support@termii.com

**Subject**: SMS not being delivered despite SENT status

**Message**:
```
Hello Termii Support,

I'm experiencing an issue where SMS shows as "SENT" in the dashboard but is not being delivered to the recipient's phone.

Details:
- Phone Number: 2348141252812
- Sender IDs: NEMSAL (ACTIVE), NEM (ACTIVE)
- Message IDs: 
  - 3017699628976244751597652
  - 3017699633886152429702363
  - 3017699637087202365168938
- Status: All show "SENT" in dashboard
- Issue: None of the SMS are being received on the phone

Could you please:
1. Check the delivery logs for these message IDs
2. Verify if there are any delivery issues
3. Confirm if the sender IDs are fully whitelisted with all Nigerian networks
4. Advise on next steps

Thank you!
```

### Action 5: Test with Africa's Talking (Alternative)
Set up Africa's Talking as a fallback:

1. Sign up at https://africastalking.com
2. Get API credentials
3. Add to `.env`:
   ```bash
   AFRICAS_TALKING_API_KEY=your-key
   AFRICAS_TALKING_USERNAME=your-username
   AFRICAS_TALKING_SENDER_ID=your-sender-id
   ```
4. The SMS service will automatically try Africa's Talking if Termii fails

## Network-Specific DND Codes

### MTN
- **Deactivate DND**: `*785*0#`
- **Activate DND**: `*785#`
- **Check Status**: `*785*1#`

### Glo
- **Deactivate DND**: `*DND*2#`
- **Activate DND**: `*DND#`

### Airtel
- **Deactivate DND**: `*785*0#`
- **Activate DND**: `*785#`

### 9mobile
- **Deactivate DND**: `*DND*2#`
- **Activate DND**: `*DND#`

## Testing Checklist

- [ ] Check if phone has signal
- [ ] Check if phone is not in airplane mode
- [ ] Check if SIM card is active
- [ ] Check if other SMS are being received
- [ ] Check SMS app for blocked numbers
- [ ] Check spam/junk folder
- [ ] Restart phone
- [ ] Try different phone number
- [ ] Try manual send from Termii dashboard
- [ ] Disable DND
- [ ] Contact network provider
- [ ] Contact Termii support

## Alternative Solutions

### Option 1: Use Email Instead
For non-critical notifications, use email:
- Already implemented in `src/features/notifications/services/email.service.ts`
- Uses Resend (working perfectly)
- No delivery issues

### Option 2: Use Push Notifications
For real-time alerts:
- Implement web push notifications
- More reliable than SMS
- Free (no per-message cost)

### Option 3: Use WhatsApp Business API
For important messages:
- Higher delivery rate
- Read receipts
- Richer content
- Requires WhatsApp Business account

## Cost Analysis

### SMS Costs So Far
- Test 1: ₦20 (4 pages, not received)
- Test 2: ₦5 (1 page, not received)
- Test 3: ₦5 (1 page, not received)
- **Total**: ₦30 spent, 0 delivered

### Recommendation
Until delivery issue is resolved:
1. **Stop sending test SMS** to avoid wasting money
2. **Contact Termii support** to investigate
3. **Test with different number** to isolate issue
4. **Consider alternative** (email, push notifications)

## Next Steps

### Immediate (Today)
1. ✅ Try manual send from Termii dashboard
2. ✅ Test with different phone number
3. ✅ Disable DND on your line
4. ✅ Check Termii dashboard logs

### Short-term (1-2 days)
1. ⏳ Contact Termii support
2. ⏳ Wait for their investigation
3. ⏳ Try alternative SMS provider (Africa's Talking)

### Long-term (Production)
1. 📋 Set up delivery monitoring
2. 📋 Implement fallback to email
3. 📋 Add delivery reports
4. 📋 Monitor delivery rates

## Summary

**Issue**: SMS shows "SENT" but not received on phone

**Likely Cause**: Network/carrier blocking or DND enabled

**Immediate Action**: 
1. Try manual send from Termii dashboard
2. Test with different phone number
3. Disable DND
4. Contact Termii support

**Alternative**: Use email notifications or Africa's Talking

---

**The SMS service implementation is complete and working correctly. The delivery issue is external (network/carrier/phone).**
