/**
 * Test script to diagnose the delete user API issue
 * This will help us understand why the API is returning HTML instead of JSON
 */

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function testDeleteUserAPI() {
  console.log('🔍 Testing Delete User API...\n');

  try {
    // Find a user to test with (Dante Dan based on the error message)
    const testUser = await db.query.users.findFirst({
      where: eq(users.fullName, 'Dante Dan'),
    });

    if (!testUser) {
      console.log('❌ Test user "Dante Dan" not found');
      console.log('📋 Available users:');
      const allUsers = await db.query.users.findMany({
        columns: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      });
      console.table(allUsers);
      return;
    }

    console.log('✅ Found test user:');
    console.log(`   ID: ${testUser.id}`);
    console.log(`   Name: ${testUser.fullName}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Phone: ${testUser.phone}`);
    console.log(`   Role: ${testUser.role}`);
    console.log(`   Status: ${testUser.status}\n`);

    // Check for foreign key constraints
    console.log('🔗 Checking foreign key constraints...\n');

    // Check salvage cases
    const cases = await db.execute(`
      SELECT COUNT(*) as count FROM salvage_cases WHERE created_by = '${testUser.id}'
    `);
    const casesCount = cases[0]?.count || 0;
    console.log(`   Salvage cases created: ${casesCount}`);

    // Check vendor profile
    const vendor = await db.execute(`
      SELECT COUNT(*) as count FROM vendors WHERE user_id = '${testUser.id}'
    `);
    const vendorCount = vendor[0]?.count || 0;
    console.log(`   Vendor profile: ${vendorCount}`);

    // Check bids
    const bids = await db.execute(`
      SELECT COUNT(*) as count FROM bids WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id = '${testUser.id}')
    `);
    const bidsCount = bids[0]?.count || 0;
    console.log(`   Bids placed: ${bidsCount}`);

    // Check payments
    const payments = await db.execute(`
      SELECT COUNT(*) as count FROM payments WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id = '${testUser.id}')
    `);
    const paymentsCount = payments[0]?.count || 0;
    console.log(`   Payments: ${paymentsCount}`);

    // Check auctions as current bidder
    const auctions = await db.execute(`
      SELECT COUNT(*) as count FROM auctions WHERE current_bidder_id IN (SELECT id FROM vendors WHERE user_id = '${testUser.id}')
    `);
    const auctionsCount = auctions[0]?.count || 0;
    console.log(`   Auctions as current bidder: ${auctionsCount}`);

    // Check audit logs
    const auditLogs = await db.execute(`
      SELECT COUNT(*) as count FROM audit_logs WHERE user_id = '${testUser.id}'
    `);
    const auditLogsCount = auditLogs[0]?.count || 0;
    console.log(`   Audit logs: ${auditLogsCount}`);

    // Check escrow wallets
    const wallets = await db.execute(`
      SELECT COUNT(*) as count FROM escrow_wallets WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id = '${testUser.id}')
    `);
    const walletsCount = wallets[0]?.count || 0;
    console.log(`   Escrow wallets: ${walletsCount}\n`);

    console.log('💡 Analysis:');
    console.log('   The DELETE endpoint does a SOFT delete (sets status to "deleted")');
    console.log('   This should NOT trigger foreign key constraint errors.');
    console.log('   The HTML error suggests the endpoint might not be reachable.\n');

    console.log('🔧 Possible causes:');
    console.log('   1. Route file not found or not compiled');
    console.log('   2. Authentication middleware redirecting to login');
    console.log('   3. Next.js routing issue');
    console.log('   4. Build/compilation error\n');

    console.log('✅ Recommendation:');
    console.log('   1. Restart the dev server');
    console.log('   2. Check browser console for the actual error');
    console.log('   3. Try accessing the endpoint directly in browser');
    console.log('   4. Check if other admin endpoints work\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDeleteUserAPI();
