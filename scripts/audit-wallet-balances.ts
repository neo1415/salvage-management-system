/**
 * Audit escrow wallet balances — lists every wallet contributing to the reconciliation total.
 * Run: npx tsx scripts/audit-wallet-balances.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { sql, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';

async function main() {
  const totals = await db
    .select({
      count: sql<string>`count(*)::text`,
      totalBalance: sql<string>`coalesce(sum(balance::numeric), 0)::text`,
      totalAvailable: sql<string>`coalesce(sum(available_balance::numeric), 0)::text`,
      totalFrozen: sql<string>`coalesce(sum(frozen_amount::numeric), 0)::text`,
      totalForfeited: sql<string>`coalesce(sum(forfeited_amount::numeric), 0)::text`,
    })
    .from(escrowWallets);

  const rows = await db
    .select({
      vendorId: escrowWallets.vendorId,
      balance: escrowWallets.balance,
      available: escrowWallets.availableBalance,
      frozen: escrowWallets.frozenAmount,
      forfeited: escrowWallets.forfeitedAmount,
      email: users.email,
      fullName: users.fullName,
      businessName: vendors.businessName,
      vendorCreated: vendors.createdAt,
      userStatus: users.status,
    })
    .from(escrowWallets)
    .leftJoin(vendors, eq(escrowWallets.vendorId, vendors.id))
    .leftJoin(users, eq(vendors.userId, users.id))
    .orderBy(desc(sql`balance::numeric`));

  const t = totals[0];
  console.log('\n=== ESCROW WALLET AUDIT ===');
  console.log(`Wallets: ${t.count}`);
  console.log(`Total balance:     ₦${Number(t.totalBalance).toLocaleString()}`);
  console.log(`Total available:   ₦${Number(t.totalAvailable).toLocaleString()}`);
  console.log(`Total frozen:      ₦${Number(t.totalFrozen).toLocaleString()}`);
  console.log(`Total forfeited:   ₦${Number(t.totalForfeited).toLocaleString()}`);
  console.log('\n=== ALL WALLETS (sorted by balance) ===\n');

  let running = 0;
  for (const r of rows) {
    const bal = Number(r.balance);
    running += bal;
    const label = r.businessName || r.fullName || 'Unknown';
    console.log(
      [
        `₦${bal.toLocaleString()}`,
        `avail ₦${Number(r.available).toLocaleString()}`,
        `frozen ₦${Number(r.frozen).toLocaleString()}`,
        label,
        r.email ?? 'no-email',
        `vendor=${r.vendorId}`,
        r.userStatus ?? 'unknown-status',
      ].join(' | ')
    );
  }

  console.log(`\nRunning sum check: ₦${running.toLocaleString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
