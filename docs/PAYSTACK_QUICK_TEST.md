# Paystack Payment - Quick Test Guide

## 🚀 Quick Start

### 1. Run Test Script (Recommended First Step)
```bash
npx tsx scripts/test-paystack-payment-flow.ts
```

**What it does:**
- Tests Paystack API directly
- Shows if configuration is correct
- Reveals exact error if any

**Expected output:**
```
✅ Found winner
✅ Vendor details
✅ Payment calculation
✅ Environment variables
✅ All validations passed
✅ SUCCESS! Paystack payment initialized
```

### 2. Test in Browser

1. **Open DevTools**: Press F12
2. **Go to Console tab**
3. **Click "Pay with Paystack"**
4. **Watch for logs**

### 3. Check Server Logs

Look in your terminal for:
```
Paystack initialization details: {...}
Paystack API request payload: {...}
Paystack API response status: 200
```

## 🔍 What to Look For

### ✅ Success Signs
- Test script shows "SUCCESS!"
- Browser console shows "Paystack response: { authorization_url: '...' }"
- Modal opens with Paystack payment page
- No errors in console or terminal

### ❌ Failure Signs
- Test script shows error
- Browser console shows "Paystack error response"
- Alert shows error message
- Button returns to normal without opening modal

## 🐛 Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "PAYSTACK_SECRET_KEY not configured" | Missing env var | Add to `.env`, restart server |
| "Amount too small" | Remaining < ₦100 | Increase bid or reduce deposit |
| "Invalid email" | User has no email | Add email to user record |
| "Paystack initialization failed" | Invalid API key | Check key in Paystack dashboard |
| No logs at all | JavaScript error | Check browser console for errors |

## 📋 Quick Checklist

Before asking for help:
- [ ] Ran test script
- [ ] Checked browser console
- [ ] Checked server terminal
- [ ] Copied all logs
- [ ] Verified `.env` has PAYSTACK_SECRET_KEY

## 📝 What to Share

When reporting the issue, share:
1. **Test script output** (full terminal output)
2. **Browser console logs** (all logs from clicking button)
3. **Server terminal logs** (all logs from the request)
4. **Error message** (if any alert appeared)

## 🎯 Expected Flow

```
User clicks button
  ↓
Frontend: "Initiating Paystack payment"
  ↓
Backend: "Paystack initialization details"
  ↓
Backend: Calls Paystack API
  ↓
Backend: "Paystack API response status: 200"
  ↓
Frontend: "Paystack response: { authorization_url }"
  ↓
Modal opens with Paystack page
```

## 🔧 Environment Check

Verify these are in your `.env`:
```bash
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📚 Full Documentation

- Detailed guide: `docs/PAYSTACK_PAYMENT_DEBUG_GUIDE.md`
- Fix summary: `docs/PAYSTACK_SILENT_FAILURE_FIX.md`
- Test script: `scripts/test-paystack-payment-flow.ts`
