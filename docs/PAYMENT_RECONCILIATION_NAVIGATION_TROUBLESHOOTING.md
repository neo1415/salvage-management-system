# Payment Reconciliation Navigation Troubleshooting Guide

## Issue
The Reconciliation navigation link is not visible in the sidebar for finance_officer and system_admin users.

## Navigation Configuration

The Reconciliation link has been correctly added to the sidebar with the following configuration:

```typescript
{
  label: 'Reconciliation',
  href: '/finance/reconciliation',
  icon: Database,
  roles: ['finance_officer', 'system_admin'],
}
```

**Location:** `src/components/layout/dashboard-sidebar.tsx` (lines 169-174)
**Position:** Finance section, between "Payment Transactions" and "Auction Management"

## Verification Steps

### 1. Use the Diagnostic Tool

Open this URL in your browser while logged in:
```
http://localhost:3000/test-reconciliation-navigation.html
```

This tool will:
- ✅ Check if you're logged in
- ✅ Verify your user role
- ✅ Confirm session structure
- ✅ Provide specific troubleshooting steps

### 2. Manual Session Check

Open browser console (F12) and run:
```javascript
fetch("/api/auth/session").then(r => r.json()).then(console.log)
```

**Expected output:**
```json
{
  "user": {
    "id": "...",
    "email": "...",
    "role": "finance_officer" // or "system_admin"
  }
}
```

### 3. Check Database Roles

Run this script to verify roles in database:
```bash
npx tsx scripts/check-reconciliation-navigation-role.ts
```

## Common Issues & Solutions

### Issue 1: Role Not Matching
**Symptom:** Session shows a different role (e.g., "vendor", "claims_adjuster")
**Solution:** 
- Contact administrator to update your role in the database
- Required roles: `finance_officer` or `system_admin`

### Issue 2: Session Not Updated
**Symptom:** Role is correct in database but not in session
**Solution:**
1. Log out completely
2. Clear browser cache and cookies
3. Log back in
4. Check session again

### Issue 3: JavaScript Error
**Symptom:** Console shows errors related to sidebar component
**Solution:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check for any ad blockers or extensions interfering

### Issue 4: Cached Component
**Symptom:** Everything looks correct but link still not visible
**Solution:**
1. Stop the development server
2. Delete `.next` folder
3. Run `npm run build`
4. Restart server

## Technical Details

### Role Authorization
The sidebar filters navigation items based on the user's role:

```typescript
const userRole = session?.user?.role || 'vendor';
const filteredNavItems = navigationItems.filter((item) =>
  item.roles.includes(userRole)
);
```

### Session Configuration
The role is included in the session via NextAuth callbacks:

```typescript
// JWT callback (line 464-465 in next-auth.config.ts)
session.user.role = token.role as string;

// Session type definition (src/types/next-auth.d.ts)
interface Session {
  user: {
    role: string; // ✅ Properly typed
  }
}
```

### Database Schema
Valid roles from `src/lib/db/schema/users.ts`:
- `vendor`
- `claims_adjuster`
- `salvage_manager`
- `finance_officer` ✅
- `system_admin` ✅

## Verification Checklist

- [ ] User is logged in
- [ ] User role is `finance_officer` or `system_admin`
- [ ] Session includes `role` field
- [ ] No JavaScript errors in console
- [ ] Browser cache cleared
- [ ] Hard refresh performed
- [ ] Logged out and back in

## API Endpoint Verification

The reconciliation API endpoint is also properly authorized:

**File:** `src/app/api/finance/reconciliation/route.ts`
**Authorized Roles:** `finance_officer`, `system_admin`

Test the API directly:
```bash
curl http://localhost:3000/api/finance/reconciliation \
  -H "Cookie: your-session-cookie"
```

## Support

If the issue persists after trying all solutions:

1. **Check the diagnostic tool output** at `/test-reconciliation-navigation.html`
2. **Verify database role** using the check script
3. **Review browser console** for any errors
4. **Test with a different browser** to rule out browser-specific issues

## Files Modified

- ✅ `src/components/layout/dashboard-sidebar.tsx` - Navigation link added
- ✅ `src/app/api/finance/reconciliation/route.ts` - API endpoint authorized
- ✅ `src/lib/auth/next-auth.config.ts` - Session includes role
- ✅ `src/types/next-auth.d.ts` - Role properly typed

## Expected Behavior

When logged in as `finance_officer` or `system_admin`:

1. **Sidebar Navigation:**
   - Finance section should be visible
   - "Reconciliation" link should appear between "Payment Transactions" and "Auction Management"
   - Uses Database icon from lucide-react

2. **Page Access:**
   - Clicking the link navigates to `/finance/reconciliation`
   - Page loads successfully with reconciliation dashboard
   - Shows ledger balances, recent transactions, and discrepancy detection

## Next Steps

If you've verified everything and the link is still not visible:

1. Take a screenshot of the diagnostic tool output
2. Check browser console for errors
3. Verify the exact role string in your session
4. Ensure you're looking in the correct section (Finance, not Admin or Vendor)
