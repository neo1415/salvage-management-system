# Account Suspension Feature - Recommendations

**Date**: December 2024  
**File**: `src/lib/cron/payment-deadlines.ts`  
**Status**: ⚠️ Requires Decision

---

## Current Behavior

The system automatically:
1. **48 hours after payment deadline**: Forfeits auction win and suspends vendor account for 7 days
2. Sends email: "Auction Forfeited - Account Suspended"
3. Updates vendor status to 'suspended'
4. Prevents vendor from bidding on new auctions

---

## Why This Happened

User received suspension emails at 3:17 AM because:
- Some auctions had outdated payment deadlines due to previous bugs
- The cron job found payments >48 hours overdue
- It automatically suspended both vendor accounts

---

## Recommendations

### Option 1: Disable Automatic Suspension (Recommended)

**Pros**:
- Prevents false positives from system bugs
- Gives Finance Officers manual control
- More forgiving to legitimate vendors
- Can be re-enabled after system stabilizes

**Cons**:
- Requires manual Finance Officer intervention
- May delay enforcement actions

**Implementation**:
```typescript
// In src/lib/cron/payment-deadlines.ts, line 177-185
// Comment out the suspension logic:

// TEMPORARILY DISABLED: Automatic suspension too aggressive after recent bugs
// await db
//   .update(vendors)
//   .set({ 
//     status: 'suspended',
//     updatedAt: now,
//   })
//   .where(eq(vendors.id, vendor.id));

// Still send notifications but don't suspend
await smsService.sendSMS({
  to: user.phone,
  message: `URGENT: Your auction win #${auction.id} payment is severely overdue. Please contact support immediately.`,
});

await emailService.sendEmail({
  to: user.email,
  subject: 'URGENT: Payment Severely Overdue - Action Required',
  html: `<p>Your payment is severely overdue. Please contact our support team immediately to avoid auction cancellation.</p>`,
});
```

---

### Option 2: Add Grace Period Check

**Pros**:
- Respects Finance Officer decisions
- Allows manual intervention before auto-suspension
- More flexible enforcement

**Cons**:
- Requires database schema changes
- More complex logic

**Implementation**:
```typescript
// Check if Finance Officer granted grace period
const [graceRecord] = await db
  .select()
  .from(paymentGracePeriods)
  .where(eq(paymentGracePeriods.paymentId, payment.id))
  .limit(1);

if (graceRecord) {
  console.log(`⏸️  Grace period granted for payment ${payment.id}. Skipping auto-suspension.`);
  continue; // Skip this payment
}

// Otherwise, proceed with suspension
```

---

### Option 3: Increase Threshold to 72 Hours

**Pros**:
- Gives vendors more time
- Reduces false positives
- Still enforces deadlines

**Cons**:
- Delays enforcement
- May encourage late payments

**Implementation**:
```typescript
// Change from 48 hours to 72 hours
const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

const forfeitPayments = await db
  .select({
    payment: payments,
    auction: auctions,
    vendor: vendors,
    user: users,
  })
  .from(payments)
  .innerJoin(auctions, eq(payments.auctionId, auctions.id))
  .innerJoin(vendors, eq(payments.vendorId, vendors.id))
  .innerJoin(users, eq(vendors.userId, users.id))
  .where(
    and(
      eq(payments.status, 'overdue'),
      lt(payments.paymentDeadline, seventyTwoHoursAgo) // Changed from 48 to 72
    )
  );
```

---

### Option 4: Add Manual Review Flag

**Pros**:
- Surgical approach - only affects flagged payments
- Doesn't change behavior for normal payments
- Easy to implement

**Cons**:
- Requires manual flagging
- May miss some edge cases

**Implementation**:
```typescript
// Add requiresManualReview column to payments table
// Then check it before auto-suspension:

if (payment.requiresManualReview) {
  console.log(`⏸️  Payment ${payment.id} requires manual review. Skipping auto-suspension.`);
  
  // Send alert to Finance Officer instead
  await sendManualReviewAlert(payment, vendor, user);
  continue;
}

// Otherwise, proceed with suspension
```

---

## Recommended Approach

**Immediate Action** (Today):
1. **Disable automatic suspension** (Option 1)
2. Keep sending overdue notifications
3. Alert Finance Officers for manual intervention

**Short-term** (This Week):
1. Implement **Option 2** (Grace Period Check)
2. Add UI for Finance Officers to grant grace periods
3. Test thoroughly with edge cases

**Long-term** (Next Sprint):
1. Add **Option 4** (Manual Review Flag)
2. Build Finance Officer dashboard for payment management
3. Add analytics to track suspension patterns
4. Consider implementing a "warning" status before suspension

---

## Implementation Steps

### Step 1: Disable Auto-Suspension (Immediate)

```bash
# Edit src/lib/cron/payment-deadlines.ts
# Comment out lines 177-185 (vendor suspension logic)
# Change email subject and content to be less severe
```

### Step 2: Update Email Template

```typescript
await emailService.sendEmail({
  to: user.email,
  subject: '🚨 URGENT: Payment Severely Overdue - Contact Support',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Payment Severely Overdue</h2>
      <p>Dear ${user.fullName},</p>
      <p>Your payment for auction #${auction.id} is now <strong>${daysOverdue} days overdue</strong>.</p>
      
      <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #991b1b;">Immediate Action Required</h3>
        <p><strong>Amount Due:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
        <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
      </div>

      <h3>⚠️ Important Notice</h3>
      <p>Please contact our support team immediately to resolve this issue. Failure to do so may result in:</p>
      <ul>
        <li>Auction cancellation</li>
        <li>Account suspension</li>
        <li>Loss of bidding privileges</li>
      </ul>

      <h3>Contact Support</h3>
      <ul>
        <li>Phone: ${process.env.SUPPORT_PHONE || '234-02-014489560'}</li>
        <li>Email: ${process.env.SUPPORT_EMAIL || 'nemsupport@nem-insurance.com'}</li>
      </ul>

      <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Finance Team</strong></p>
    </div>
  `,
});
```

### Step 3: Alert Finance Officers

```typescript
// Send alert to Finance Officers for manual review
const financeOfficers = await db
  .select()
  .from(users)
  .where(eq(users.role, 'finance_officer'))
  .limit(5);

for (const officer of financeOfficers) {
  await emailService.sendEmail({
    to: officer.email,
    subject: `🚨 Payment Severely Overdue - Manual Review Required - ${auction.id.substring(0, 8)}`,
    html: `
      <h2>Payment Severely Overdue - Manual Review Required</h2>
      <p>Dear ${officer.fullName},</p>
      <p>A payment is severely overdue and requires your manual review.</p>
      
      <h3>Payment Details</h3>
      <ul>
        <li><strong>Auction ID:</strong> ${auction.id}</li>
        <li><strong>Vendor:</strong> ${user.fullName} (${user.email})</li>
        <li><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</li>
        <li><strong>Days Overdue:</strong> ${daysOverdue}</li>
      </ul>

      <h3>Recommended Actions</h3>
      <ol>
        <li>Contact vendor to understand the situation</li>
        <li>Review payment history and vendor performance</li>
        <li>Decide whether to:
          <ul>
            <li>Grant grace period (if legitimate reason)</li>
            <li>Suspend account (if no response or bad faith)</li>
            <li>Cancel auction and re-list item</li>
          </ul>
        </li>
      </ol>

      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/finance/payments">View Payment Dashboard</a></p>
    `,
  });
}
```

---

## Testing Checklist

After implementing changes:

- [ ] Verify cron job runs without errors
- [ ] Confirm overdue notifications are still sent
- [ ] Verify vendors are NOT automatically suspended
- [ ] Confirm Finance Officers receive manual review alerts
- [ ] Test grace period functionality (if implemented)
- [ ] Verify email templates render correctly
- [ ] Check audit logs are created properly

---

## Rollback Plan

If issues arise:

1. Re-enable automatic suspension by uncommenting the code
2. Adjust threshold to 72 hours instead of 48 hours
3. Add manual review flag to affected payments
4. Notify Finance Officers of the change

---

## Conclusion

**Recommended**: Implement Option 1 (Disable Auto-Suspension) immediately, then work towards Option 2 (Grace Period Check) for long-term solution.

This approach:
- ✅ Prevents false positives from system bugs
- ✅ Gives Finance Officers control
- ✅ Maintains payment enforcement
- ✅ Improves vendor experience
- ✅ Reduces support burden
