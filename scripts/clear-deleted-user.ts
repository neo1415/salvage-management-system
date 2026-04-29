import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * Script to clear deleted user records for development/testing
 * This allows re-registration with the same phone number
 * 
 * Usage: npx tsx scripts/clear-deleted-user.ts
 */

async function clearDeletedUser() {
  console.log('🧹 Clearing Deleted User Records...\n');

  // Get phone number from command line or use default
  const phone = process.argv[2] || '+2348012345678';

  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Create database connection
    const client = postgres(connectionString);
    const db = drizzle(client);

    console.log(`🔍 Searching for deleted users with phone: ${phone}\n`);

    // Find deleted users with this phone number
    const deletedUsers = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone));

    if (deletedUsers.length === 0) {
      console.log('✅ No users found with this phone number');
      console.log('   You can register with this phone number\n');
      await client.end();
      process.exit(0);
    }

    console.log(`📋 Found ${deletedUsers.length} user(s):\n`);
    
    for (const user of deletedUsers) {
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Full Name: ${user.fullName}`);
      console.log(`   Deleted At: ${user.deletedAt || 'Not deleted'}`);
      console.log('');
    }

    // Delete all users with this phone number (including soft-deleted ones)
    // Handle all foreign key relationships
    console.log('🗑️  Deleting related records (this may take a moment)...\n');
    
    for (const user of deletedUsers) {
      const vendorResult = await client.unsafe(`SELECT id FROM vendors WHERE user_id = $1`, [user.id]);
      const vendorId = vendorResult[0]?.id;
      
      if (vendorId) {
        // Get wallet ID for this vendor
        const walletResult = await client.unsafe(`SELECT id FROM escrow_wallets WHERE vendor_id = $1`, [vendorId]);
        const walletId = walletResult[0]?.id;
        
        // Clear auction references (set current_bidder to NULL)
        await client.unsafe(`UPDATE auctions SET current_bidder = NULL WHERE current_bidder = $1`, [vendorId]);
        console.log(`   ✓ Cleared auction references for vendor ${vendorId}`);
        
        // Delete bids
        await client.unsafe(`DELETE FROM bids WHERE vendor_id = $1`, [vendorId]);
        console.log(`   ✓ Deleted bids for vendor ${vendorId}`);
        
        // Delete wallet transactions (if wallet exists)
        if (walletId) {
          await client.unsafe(`DELETE FROM wallet_transactions WHERE wallet_id = $1`, [walletId]);
          console.log(`   ✓ Deleted wallet transactions for wallet ${walletId}`);
          
          // Delete escrow wallet
          await client.unsafe(`DELETE FROM escrow_wallets WHERE id = $1`, [walletId]);
          console.log(`   ✓ Deleted escrow wallet ${walletId}`);
        }
        
        // Delete payments
        await client.unsafe(`DELETE FROM payments WHERE vendor_id = $1`, [vendorId]);
        console.log(`   ✓ Deleted payments for vendor ${vendorId}`);
        
        // Delete vendor profile
        await client.unsafe(`DELETE FROM vendors WHERE id = $1`, [vendorId]);
        console.log(`   ✓ Deleted vendor profile ${vendorId}`);
      }
      
      // Delete salvage cases created by this user
      await client.unsafe(`DELETE FROM salvage_cases WHERE created_by = $1`, [user.id]);
      console.log(`   ✓ Deleted salvage cases created by user ${user.id}`);
      
      // Delete audit logs
      await client.unsafe(`DELETE FROM audit_logs WHERE user_id = $1`, [user.id]);
      console.log(`   ✓ Deleted audit logs for user ${user.id}`);
      
      // Delete the user
      await client.unsafe(`DELETE FROM users WHERE id = $1`, [user.id]);
      console.log(`   ✓ Deleted user ${user.id}`);
    }

    console.log('\n✅ Successfully removed all user records and related data!');
    console.log(`   Phone: ${phone}`);
    console.log(`   Users deleted: ${deletedUsers.length}`);
    console.log('\n💡 You can now register again with this phone number\n');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to clear deleted user:', error);
    console.log('\n⚠️  Troubleshooting:');
    console.log('   1. Check your DATABASE_URL in .env');
    console.log('   2. Ensure the database is accessible');
    console.log('   3. Verify the phone number format (+234...)');
    console.log('\n💡 Usage: npx tsx scripts/clear-deleted-user.ts +2348012345678\n');
    process.exit(1);
  }
}

clearDeletedUser().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
