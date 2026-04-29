import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnoseNullBusinessName() {
  console.log('🔍 Investigating NULL business_name issue...\n');

  // Check the specific vendor from the 4/29/2026 payment
  const vendorId = 'fb12a54e-1a81-4d6c-aec8-054218d38458';
  
  const vendor = await db.execute(sql`
    SELECT 
      id,
      user_id,
      business_name,
      tier,
      status,
      registration_fee_paid,
      registration_fee_paid_at,
      created_at,
      updated_at
    FROM vendors
    WHERE id = ${vendorId}
  `);

  console.log('📋 Vendor Record:');
  console.log('=================\n');
  
  if ((vendor as any[]).length > 0) {
    const v = (vendor as any[])[0];
    console.log(`Vendor ID: ${v.id}`);
    console.log(`User ID: ${v.user_id}`);
    console.log(`Business Name: ${v.business_name || 'NULL ⚠️'}`);
    console.log(`Tier: ${v.tier}`);
    console.log(`Status: ${v.status}`);
    console.log(`Registration Fee Paid: ${v.registration_fee_paid}`);
    console.log(`Registration Fee Paid At: ${v.registration_fee_paid_at || 'N/A'}`);
    console.log(`Created: ${v.created_at}`);
    console.log(`Updated: ${v.updated_at}`);

    // Check the user record
    console.log('\n👤 Associated User Record:');
    console.log('==========================\n');
    
    const user = await db.execute(sql`
      SELECT 
        id,
        name,
        phone,
        role,
        created_at
      FROM users
      WHERE id = ${v.user_id}
    `);

    if ((user as any[]).length > 0) {
      const u = (user as any[])[0];
      console.log(`User ID: ${u.id}`);
      console.log(`Name: ${u.name || 'NULL'}`);
      console.log(`Phone: ${u.phone || 'NULL'}`);
      console.log(`Role: ${u.role}`);
      console.log(`Created: ${u.created_at}`);
    }
  } else {
    console.log('❌ Vendor not found!');
  }

  // Check all vendors with NULL business_name
  console.log('\n\n🚨 All Vendors with NULL business_name:');
  console.log('========================================\n');

  const nullVendors = await db.execute(sql`
    SELECT 
      v.id,
      v.user_id,
      v.business_name,
      v.tier,
      v.status,
      v.registration_fee_paid,
      v.created_at,
      u.name as user_name,
      u.phone as user_phone
    FROM vendors v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.business_name IS NULL OR v.business_name = ''
    ORDER BY v.created_at DESC
    LIMIT 10
  `);

  if ((nullVendors as any[]).length === 0) {
    console.log('✅ No vendors with NULL business_name found');
  } else {
    console.log(`Found ${(nullVendors as any[]).length} vendor(s) with NULL business_name:\n`);
    
    for (const v of nullVendors as any[]) {
      console.log(`Vendor ID: ${v.id}`);
      console.log(`User Name: ${v.user_name || 'NULL'}`);
      console.log(`User Phone: ${v.user_phone || 'NULL'}`);
      console.log(`Business Name: ${v.business_name || 'NULL ⚠️'}`);
      console.log(`Tier: ${v.tier}`);
      console.log(`Status: ${v.status}`);
      console.log(`Registration Fee Paid: ${v.registration_fee_paid}`);
      console.log(`Created: ${v.created_at}`);
      console.log('---');
    }
  }

  // Check the registration fees report query
  console.log('\n\n📊 Registration Fees Report Data:');
  console.log('==================================\n');

  const reportData = await db.execute(sql`
    SELECT 
      COALESCE(v.business_name, 'Unknown') as vendor_name,
      v.business_name as raw_business_name,
      v.id as vendor_id,
      u.name as user_name,
      p.amount,
      p.status,
      p.created_at
    FROM payments p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN users u ON v.user_id = u.id
    WHERE p.auction_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT 5
  `);

  for (const row of reportData as any[]) {
    console.log(`Vendor Name (displayed): ${row.vendor_name}`);
    console.log(`Raw Business Name: ${row.raw_business_name || 'NULL'}`);
    console.log(`User Name: ${row.user_name || 'NULL'}`);
    console.log(`Vendor ID: ${row.vendor_id}`);
    console.log(`Amount: ₦${row.amount}`);
    console.log(`Status: ${row.status}`);
    console.log(`Date: ${row.created_at}`);
    console.log('---');
  }
}

diagnoseNullBusinessName()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
