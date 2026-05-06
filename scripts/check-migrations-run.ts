import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkMigrations() {
  try {
    // Check if __drizzle_migrations table exists
    const migrationsTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      )
    `);
    
    if (!migrationsTableExists.rows[0]?.exists) {
      console.log('❌ __drizzle_migrations table does not exist. No migrations have been run.');
      process.exit(1);
    }
    
    console.log('✅ __drizzle_migrations table exists\n');
    
    // Get all migrations
    const migrations = await db.execute(sql`
      SELECT * FROM __drizzle_migrations 
      ORDER BY created_at DESC
    `);
    
    console.log(`📋 Total migrations run: ${migrations.rows.length}\n`);
    
    // Check for auction deposit migration
    const auctionDepositMigration = migrations.rows.find((m: any) => 
      m.hash?.includes('0028') || m.hash?.includes('auction_deposit')
    );
    
    if (auctionDepositMigration) {
      console.log('✅ Auction deposit migration (0028) found:');
      console.log(`   - Hash: ${auctionDepositMigration.hash}`);
      console.log(`   - Created: ${auctionDepositMigration.created_at}`);
    } else {
      console.log('❌ Auction deposit migration (0028) NOT found');
      console.log('\n📋 Recent migrations:');
      migrations.rows.slice(0, 5).forEach((m: any) => {
        console.log(`   - ${m.hash} (${m.created_at})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMigrations();
