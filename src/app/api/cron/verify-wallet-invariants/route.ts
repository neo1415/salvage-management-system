/**
 * Wallet Invariant Verification Cron Job
 * 
 * Runs daily to verify wallet invariant for all escrow wallets.
 * Invariant: balance = availableBalance + frozenAmount + forfeitedAmount
 * 
 * Alerts administrators on violations via console logs.
 * In production, should integrate with monitoring/alerting system.
 * 
 * Vercel Cron Configuration:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/verify-wallet-invariants",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 * 
 * Requirements:
 * - Requirement 26.2: Verify wallet invariant for all escrow wallets
 * - Requirement 26.3: Alert administrators on violations
 * - Requirement 26.4: Log all violations for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time (checking all wallets)

interface WalletViolation {
  vendorId: string;
  vendorName: string;
  balance: number;
  availableBalance: number;
  frozenAmount: number;
  forfeitedAmount: number;
  calculatedBalance: number;
  difference: number;
}

/**
 * GET /api/cron/verify-wallet-invariants
 * Verifies wallet invariant for all escrow wallets
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Wallet Invariant Cron] Unauthorized attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`[Wallet Invariant Cron] Starting verification at ${now.toISOString()}`);

    // Get all escrow wallets with vendor information
    const wallets = await db
      .select({
        wallet: escrowWallets,
        vendor: vendors,
        user: users,
      })
      .from(escrowWallets)
      .innerJoin(vendors, eq(escrowWallets.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id));

    console.log(`[Wallet Invariant Cron] Checking ${wallets.length} wallets`);

    const violations: WalletViolation[] = [];
    let checkedCount = 0;

    for (const { wallet, vendor, user } of wallets) {
      checkedCount++;

      const balance = parseFloat(wallet.balance);
      const availableBalance = parseFloat(wallet.availableBalance);
      const frozenAmount = parseFloat(wallet.frozenAmount);
      const forfeitedAmount = parseFloat(wallet.forfeitedAmount || '0');

      // Calculate expected balance
      const calculatedBalance = availableBalance + frozenAmount + forfeitedAmount;

      // Check invariant (allow 0.01 difference for floating point precision)
      const difference = Math.abs(balance - calculatedBalance);
      const TOLERANCE = 0.01;

      if (difference > TOLERANCE) {
        const violation: WalletViolation = {
          vendorId: vendor.id,
          vendorName: user.fullName,
          balance,
          availableBalance,
          frozenAmount,
          forfeitedAmount,
          calculatedBalance,
          difference,
        };

        violations.push(violation);

        // Log violation with details
        console.error(`[Wallet Invariant Cron] ❌ VIOLATION DETECTED`);
        console.error(`  Vendor: ${user.fullName} (${vendor.id})`);
        console.error(`  Balance: ₦${balance.toLocaleString()}`);
        console.error(`  Available: ₦${availableBalance.toLocaleString()}`);
        console.error(`  Frozen: ₦${frozenAmount.toLocaleString()}`);
        console.error(`  Forfeited: ₦${forfeitedAmount.toLocaleString()}`);
        console.error(`  Calculated: ₦${calculatedBalance.toLocaleString()}`);
        console.error(`  Difference: ₦${difference.toLocaleString()}`);
        console.error(`  ---`);
      }
    }

    if (violations.length === 0) {
      console.log(`[Wallet Invariant Cron] ✅ All ${checkedCount} wallets passed invariant check`);
    } else {
      console.error(`[Wallet Invariant Cron] ❌ Found ${violations.length} violations out of ${checkedCount} wallets`);
      
      // In production, send alert to monitoring system
      // Example: await sendSlackAlert(violations);
      // Example: await sendEmailAlert(violations);
      
      // Log summary
      console.error(`[Wallet Invariant Cron] VIOLATION SUMMARY:`);
      for (const violation of violations) {
        console.error(`  - ${violation.vendorName}: ₦${violation.difference.toLocaleString()} difference`);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      walletsChecked: checkedCount,
      violationsFound: violations.length,
      violations: violations.map(v => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        balance: v.balance,
        availableBalance: v.availableBalance,
        frozenAmount: v.frozenAmount,
        forfeitedAmount: v.forfeitedAmount,
        calculatedBalance: v.calculatedBalance,
        difference: v.difference,
      })),
    });
  } catch (error) {
    console.error('[Wallet Invariant Cron] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify wallet invariants',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
