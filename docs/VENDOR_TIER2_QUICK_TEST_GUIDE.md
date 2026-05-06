# Vendor Tier 2 - Quick Test Guide

**Test Vendor**: neowalker502@gmail.com  
**Password**: (your password)  
**Status**: ✅ Approved as Tier 2

---

## Quick Test: Verify Unlimited Bidding

### Step 1: Login
```
1. Go to: https://your-app-url.com/login
2. Email: neowalker502@gmail.com
3. Password: [your password]
4. Click "Sign In"
```

### Step 2: Navigate to Any Auction
```
1. Click "Auctions" in the sidebar
2. Click on any active auction
3. Click "Place Bid" button
```

### Step 3: Verify NO Tier Limit Displayed
```
✅ EXPECTED: You should NOT see "Your Bid Limit: ₦500,000"
✅ EXPECTED: You can enter any bid amount
✅ EXPECTED: No tier limit validation error

❌ WRONG: If you see "Tier 1 limit: ₦500,000" → Issue not fixed
```

### Step 4: Check Browser Console
```
1. Press F12 to open DevTools
2. Go to Console tab
3. Look for: "✅ Tier 1 limit loaded from config: ₦500,000"
4. This confirms the hook is fetching config correctly
```

---

## What You Should See

### Tier 2 Vendor (You)
```
Bid Form:
┌─────────────────────────────────┐
│ Place Your Bid                  │
├─────────────────────────────────┤
│ Current Bid: ₦1,500,000         │
│ Minimum Bid: ₦1,550,000         │
│                                 │
│ [Enter bid amount]              │
│                                 │
│ ✅ NO "Your Bid Limit" section │
│                                 │
│ [Request OTP]                   │
└─────────────────────────────────┘
```

### Tier 1 Vendor (For Comparison)
```
Bid Form:
┌─────────────────────────────────┐
│ Place Your Bid                  │
├─────────────────────────────────┤
│ Current Bid: ₦400,000           │
│ Minimum Bid: ₦450,000           │
│ Your Bid Limit: ₦500,000 ⚠️     │
│                                 │
│ [Enter bid amount]              │
│                                 │
│ [Request OTP]                   │
└─────────────────────────────────┘
```

---

## Troubleshooting

### Issue: Still seeing "Tier 1 limit: ₦500,000"

**Solution 1: Hard Refresh**
```
1. Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. This clears browser cache
3. Try again
```

**Solution 2: Check Vendor Tier in Database**
```bash
npx tsx scripts/diagnose-vendor-tier-and-profile.ts
```

**Expected Output**:
```
✅ Vendor Database State:
  Tier: tier2_full
  Status: approved
💰 Bidding Limits:
  Tier 2: Unlimited (Full business KYC)
```

**Solution 3: Check Browser Console**
```
1. Press F12
2. Go to Console tab
3. Look for errors
4. Share screenshot if issue persists
```

---

## Profile Page Test

### Step 1: Navigate to Profile
```
1. Click "Settings" in sidebar
2. Click "Profile"
```

### Step 2: Verify Tier 2 Badge
```
✅ EXPECTED: "Tier 2" badge (green)
✅ EXPECTED: "Fully Verified" status
✅ EXPECTED: Business details displayed
✅ EXPECTED: Tier 2 Approved date shown
✅ EXPECTED: Tier 2 Expires date shown (1 year from approval)
```

### Step 3: Check for Errors
```
❌ WRONG: If you see "Cannot convert undefined or null to object"
→ Take screenshot of browser console (F12)
→ Share with developer
```

---

## Diagnostic Commands

### Check Vendor State
```bash
npx tsx scripts/diagnose-vendor-tier-and-profile.ts
```

### Test Approval Flow
```bash
npx tsx scripts/test-vendor-approval-flow.ts
```

---

## Expected Results Summary

| Feature | Expected Behavior |
|---------|-------------------|
| **Tier Badge** | "Tier 2" (green) |
| **Status** | "Fully Verified" |
| **Bid Limit Display** | NOT shown (unlimited) |
| **Bid Validation** | No tier limit error |
| **Max Bid Amount** | Unlimited |
| **Profile Page** | Loads without errors |
| **Business Details** | Displayed correctly |

---

## If Everything Works

✅ **Success!** Your Tier 2 approval is complete and working correctly.

You can now:
- Bid unlimited amounts on any auction
- Access all premium features
- Participate in leaderboard
- Get priority support

---

## If Issues Persist

1. **Take Screenshots**:
   - Bid form showing tier limit
   - Browser console (F12 → Console tab)
   - Profile page

2. **Run Diagnostic**:
   ```bash
   npx tsx scripts/diagnose-vendor-tier-and-profile.ts
   ```

3. **Share Results**:
   - Screenshots
   - Diagnostic output
   - Any error messages

---

## Contact

If you encounter any issues, provide:
1. Screenshots of the issue
2. Browser console output (F12 → Console)
3. Diagnostic script output
4. Steps to reproduce

This will help quickly identify and fix any remaining issues.
