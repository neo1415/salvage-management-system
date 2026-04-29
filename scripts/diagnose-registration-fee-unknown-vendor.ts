import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnoseRegistrationFeeVendor() {
  console.log('🔍 Diagnosing Registration Fee with Unknown Vendor Name...\n');

  // Get the latest registration fee payments (identified by NULL auction_id)
  const payments = await db.execute(sql`
    SELECT 
      p.id,
      p.vendor_id,
      p.amount,
      p.payment_method,
      p.status,
      p.created_at,
      v.business_name,
      v.id as vendor_table_id
    FROM payments p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.auction_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT 10
  `);

  console.log('📋 Latest Registration Fee Payments:');
  console.log('=====================================\n');

  for (const payment of payments as any[]) {
    console.log(`Payment ID: ${payment.id}`);
    console.log(`Vendor ID in payment: ${payment.vendor_id}`);
    console.log(`Vendor ID from vendors table: ${payment.vendor_table_id}`);
    console.log(`Business Name: ${payment.business_name || 'NULL/MISSING'}`);
    console.log(`Amount: ₦${payment.amount}`);
    console.log(`Payment Method: ${payment.payment_method}`);
    console.log(`Status: ${payment.status}`);
    console.log(`Created: ${payment.created_at}`);
    console.log('---');
  }

  // Check if there are any vendors with NULL business_name
  const vendorsWithoutName = await db.execute(sql`
    SELECT 
      id,
      business_name,
      email,
      created_at
    FROM vendors
    WHERE business_name IS NULL OR business_name = ''
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('\n🚨 Vendors with NULL or Empty Business Name:');
  console.log('=============================================\n');
  
  if ((vendorsWithoutName as any[]).length === 0) {
    console.log('✅ No vendors found with NULL or empty business_name');
  } else {
    for (const vendor of vendorsWithoutName as any[]) {
      console.log(`Vendor ID: ${vendor.id}`);
      console.log(`Business Name: ${vendor.business_name || 'NULL'}`);
      console.log(`Email: ${vendor.email}`);
      console.log(`Created: ${vendor.created_at}`);
      console.log('---');
    }
  }

  // Check the specific payment from 4/29/2026
  const specificPayment = await db.execute(sql`
    SELECT 
      p.id,
      p.vendor_id,
      p.amount,
      p.payment_method,
      p.status,
      p.created_at,
      v.business_name,
      v.email,
      v.id as vendor_exists
    FROM payments p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.auction_id IS NULL
      AND p.created_at >= '2026-04-29'
      AND p.created_at < '2026-04-30'
    ORDER BY p.created_at DESC
  `);

  console.log('\n🎯 Payment from 4/29/2026:');
  console.log('===========================\n');

  if ((specificPayment as any[]).length > 0) {
    const payment = (specificPayment as any[])[0];
    console.log(`Payment ID: ${payment.id}`);
    console.log(`Vendor ID: ${payment.vendor_id}`);
    console.log(`Vendor Exists in vendors table: ${payment.vendor_exists ? 'YES' : 'NO'}`);
    console.log(`Business Name: ${payment.business_name || 'NULL/MISSING'}`);
    console.log(`Email: ${payment.email || 'N/A'}`);
    console.log(`Amount: ₦${payment.amount}`);
    console.log(`Status: ${payment.status}`);

    // If vendor_id exists but business_name is null, check the vendor record
    if (payment.vendor_id && !payment.business_name) {
      console.log('\n⚠️  ISSUE FOUND: vendor_id exists but business_name is NULL');
      
      const vendorRecord = await db.execute(sql`
        SELECT * FROM vendors WHERE id = ${payment.vendor_id}
      `);

      console.log('\n📝 Full Vendor Record:');
      console.log(JSON.stringify(vendorRecord[0], null, 2));
    }
  } else {
    console.log('❌ No payment found for 4/29/2026');
  }

  // Check where the report is getting its data from
  console.log('\n📊 Checking Report Query Logic...\n');
  
  const reportQuery = await db.execute(sql`
    SELECT 
      COALESCE(v.business_name, 'Unknown') as vendor_name,
      p.amount,
      p.payment_method,
      p.status,
      p.created_at
    FROM payments p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.auction_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT 5
  `);

  console.log('Report Query Results (with COALESCE):');
  console.log('======================================\n');
  for (const row of reportQuery as any[]) {
    console.log(`Vendor: ${row.vendor_name}`);
    console.log(`Amount: ₦${row.amount}`);
    console.log(`Date: ${row.created_at}`);
    console.log('---');
  }
}

diagnoseRegistrationFeeVendor()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
