/**
 * Investigation Script: Vendor Registration Fee System
 * 
 * This script investigates the existing database structure and authentication flow
 * to understand how to implement the vendor registration fee system.
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { payments } from '@/lib/db/schema/payments';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { sql } from 'drizzle-orm';

async function investigateVendorRegistrationFee() {
  console.log('🔍 VENDOR REGISTRATION FEE SYSTEM INVESTIGATION\n');
  console.log('=' .repeat(80));

  // 1. Check vendors table structure
  console.log('\n📊 1. VENDORS TABLE STRUCTURE');
  console.log('-'.repeat(80));
  
  const vendorsTableInfo = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'vendors'
    ORDER BY ordinal_position;
  `);
  
  console.log('Columns in vendors table:');
  if (vendorsTableInfo.rows && Array.isArray(vendorsTableInfo.rows)) {
    vendorsTableInfo.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });
  } else {
    console.log('  ⚠️  Unable to fetch table info');
  }

  // 2. Check users table structure
  console.log('\n📊 2. USERS TABLE STRUCTURE');
  console.log('-'.repeat(80));
  
  const usersTableInfo = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `);
  
  console.log('Columns in users table:');
  usersTableInfo.rows.forEach((row: any) => {
    console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
  });

  // 3. Check payments table structure
  console.log('\n📊 3. PAYMENTS TABLE STRUCTURE');
  console.log('-'.repeat(80));
  
  const paymentsTableInfo = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'payments'
    ORDER BY ordinal_position;
  `);
  
  console.log('Columns in payments table:');
  paymentsTableInfo.rows.forEach((row: any) => {
    console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
  });

  // 4. Check escrow_wallets table structure
  console.log('\n📊 4. ESCROW_WALLETS TABLE STRUCTURE');
  console.log('-'.repeat(80));
  
  const escrowWalletsTableInfo = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'escrow_wallets'
    ORDER BY ordinal_position;
  `);
  
  console.log('Columns in escrow_wallets table:');
  escrowWalletsTableInfo.rows.forEach((row: any) => {
    console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
  });

  // 5. Check user status enum values
  console.log('\n📊 5. USER STATUS ENUM VALUES');
  console.log('-'.repeat(80));
  
  const userStatusEnum = await db.execute(sql`
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = (
      SELECT oid
      FROM pg_type
      WHERE typname = 'user_status'
    )
    ORDER BY enumsortorder;
  `);
  
  console.log('User status enum values:');
  userStatusEnum.rows.forEach((row: any) => {
    console.log(`  - ${row.enumlabel}`);
  });

  // 6. Check vendor tier enum values
  console.log('\n📊 6. VENDOR TIER ENUM VALUES');
  console.log('-'.repeat(80));
  
  const vendorTierEnum = await db.execute(sql`
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = (
      SELECT oid
      FROM pg_type
      WHERE typname = 'vendor_tier'
    )
    ORDER BY enumsortorder;
  `);
  
  console.log('Vendor tier enum values:');
  vendorTierEnum.rows.forEach((row: any) => {
    console.log(`  - ${row.enumlabel}`);
  });

  // 7. Check payment method enum values
  console.log('\n📊 7. PAYMENT METHOD ENUM VALUES');
  console.log('-'.repeat(80));
  
  const paymentMethodEnum = await db.execute(sql`
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = (
      SELECT oid
      FROM pg_type
      WHERE typname = 'payment_method'
    )
    ORDER BY enumsortorder;
  `);
  
  console.log('Payment method enum values:');
  paymentMethodEnum.rows.forEach((row: any) => {
    console.log(`  - ${row.enumlabel}`);
  });

  // 8. Sample vendor records
  console.log('\n📊 8. SAMPLE VENDOR RECORDS (First 3)');
  console.log('-'.repeat(80));
  
  const sampleVendors = await db.execute(sql`
    SELECT 
      v.id,
      v.user_id,
      v.business_name,
      v.tier,
      v.status,
      v.bvn_verified_at,
      v.tier2_approved_at,
      u.status as user_status,
      u.full_name,
      u.email,
      u.phone
    FROM vendors v
    JOIN users u ON v.user_id = u.id
    ORDER BY v.created_at DESC
    LIMIT 3;
  `);
  
  console.log('Sample vendor records:');
  sampleVendors.rows.forEach((row: any, index: number) => {
    console.log(`\n  Vendor ${index + 1}:`);
    console.log(`    - ID: ${row.id}`);
    console.log(`    - User ID: ${row.user_id}`);
    console.log(`    - Business Name: ${row.business_name || 'N/A'}`);
    console.log(`    - Tier: ${row.tier}`);
    console.log(`    - Status: ${row.status}`);
    console.log(`    - BVN Verified: ${row.bvn_verified_at ? 'Yes' : 'No'}`);
    console.log(`    - Tier 2 Approved: ${row.tier2_approved_at ? 'Yes' : 'No'}`);
    console.log(`    - User Status: ${row.user_status}`);
    console.log(`    - Full Name: ${row.full_name}`);
    console.log(`    - Email: ${row.email}`);
    console.log(`    - Phone: ${row.phone}`);
  });

  // 9. Check for existing registration fee related columns
  console.log('\n📊 9. EXISTING REGISTRATION FEE COLUMNS');
  console.log('-'.repeat(80));
  
  const registrationFeeColumns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'vendors'
    AND column_name LIKE '%registration%'
    OR column_name LIKE '%fee%';
  `);
  
  if (registrationFeeColumns.rows.length > 0) {
    console.log('Found registration fee related columns:');
    registrationFeeColumns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
  } else {
    console.log('❌ No registration fee columns found in vendors table');
  }

  // 10. Check Paystack integration environment variables
  console.log('\n📊 10. PAYSTACK INTEGRATION ENVIRONMENT');
  console.log('-'.repeat(80));
  
  console.log('Paystack environment variables:');
  console.log(`  - PAYSTACK_SECRET_KEY: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  - PAYSTACK_PUBLIC_KEY: ${process.env.PAYSTACK_PUBLIC_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  - NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'Not set'}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ INVESTIGATION COMPLETE\n');
}

// Run investigation
investigateVendorRegistrationFee()
  .then(() => {
    console.log('Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Investigation failed:', error);
    process.exit(1);
  });
