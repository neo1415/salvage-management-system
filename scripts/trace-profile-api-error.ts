/**
 * Trace Profile API Error
 * 
 * Add detailed logging to find exactly where Object.entries is being called
 */

import { db } from '@/lib/db/drizzle';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function traceError() {
  console.log('🔍 Tracing Profile API Error\n');

  try {
    // Find the test vendor
    console.log('1️⃣ Finding vendor with email: neowalker502@gmail.com');
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, 'neowalker502@gmail.com'))
      .limit(1);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.id);

    // Simulate EXACTLY what the profile API does
    console.log('\n2️⃣ Simulating profile API query...');
    
    const [vendor] = await db
      .select({
        businessName: vendors.businessName,
        businessType: vendors.businessType,
        address: vendors.address,
        city: vendors.city,
        state: vendors.state,
        cacNumber: vendors.cacNumber,
        tin: vendors.tin,
        bankAccountNumber: vendors.bankAccountNumber,
        bankAccountName: vendors.bankAccountName,
        bankName: vendors.bankName,
        tier: vendors.tier,
        status: vendors.status,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2ExpiresAt: vendors.tier2ExpiresAt,
      })
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    console.log('\n3️⃣ Raw vendor object from Drizzle:');
    console.log('Type:', typeof vendor);
    console.log('Is null?', vendor === null);
    console.log('Is undefined?', vendor === undefined);
    
    if (vendor) {
      console.log('\n4️⃣ Checking each field:');
      const fields = Object.keys(vendor);
      console.log('Fields:', fields);
      
      for (const key of fields) {
        const value = (vendor as any)[key];
        console.log(`\n${key}:`);
        console.log('  Type:', typeof value);
        console.log('  Is null?', value === null);
        console.log('  Is undefined?', value === undefined);
        
        if (value !== null && value !== undefined && typeof value === 'object') {
          try {
            const entries = Object.entries(value);
            console.log(`  ✅ Object.entries works: ${entries.length} entries`);
          } catch (err) {
            console.log(`  ❌ Object.entries FAILED:`, err);
          }
        }
      }
      
      // Now try to build the response object
      console.log('\n5️⃣ Building response object...');
      try {
        const response = {
          vendor: vendor ? {
            businessName: vendor.businessName || null,
            businessType: vendor.businessType || null,
            address: vendor.address || null,
            city: vendor.city || null,
            state: vendor.state || null,
            cacNumber: vendor.cacNumber || null,
            tin: vendor.tin || null,
            bankAccountNumber: vendor.bankAccountNumber || null,
            bankAccountName: vendor.bankAccountName || null,
            bankName: vendor.bankName || null,
            tier: vendor.tier || 'tier0',
            status: vendor.status || 'pending',
            tier2ApprovedAt: vendor.tier2ApprovedAt || null,
            tier2ExpiresAt: vendor.tier2ExpiresAt || null,
          } : null,
        };
        
        console.log('✅ Response object built successfully');
        
        // Try to JSON.stringify it
        console.log('\n6️⃣ Testing JSON.stringify...');
        const jsonString = JSON.stringify(response);
        console.log('✅ JSON.stringify works, length:', jsonString.length);
        
      } catch (err) {
        console.log('❌ Error building response:', err);
        if (err instanceof Error) {
          console.log('Error message:', err.message);
          console.log('Error stack:', err.stack);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during trace:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

traceError()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
