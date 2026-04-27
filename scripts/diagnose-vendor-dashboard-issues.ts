/**
 * Diagnostic Script: Vendor Dashboard Issues
 * 
 * This script checks:
 * 1. What the registration fee API actually returns
 * 2. What the config table has for registrationFee
 * 3. Sample auction data to verify timer fields exist
 */

import { db } from '@/lib/db/drizzle';
import { config } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { cases } from '@/lib/db/schema/cases';
import { eq, and, or } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 VENDOR DASHBOARD DIAGNOSTIC\n');
  console.log('=' .repeat(60));

  // 1. Check config table for registrationFee
  console.log('\n1️⃣ CHECKING CONFIG TABLE FOR REGISTRATION FEE');
  console.log('-'.repeat(60));
  
  try {
    const [configRow] = await db
      .select()
      .from(config)
      .limit(1);

    if (configRow) {
      console.log('✅ Config found:');
      console.log(`   Registration Fee: ₦${Number(configRow.registrationFee).toLocaleString()}`);
      console.log(`   Deposit Percentage: ${configRow.depositPercentage}%`);
      console.log(`   Updated At: ${configRow.updatedAt}`);
    } else {
      console.log('❌ No config found in database!');
    }
  } catch (error) {
    console.error('❌ Error reading config:', error);
  }

  // 2. Test the registration fee API logic
  console.log('\n2️⃣ TESTING REGISTRATION FEE API LOGIC');
  console.log('-'.repeat(60));
  
  try {
    const { configService } = await import('@/features/auction-deposit/services/config.service');
    const configData = await configService.getConfig();
    
    console.log('✅ Config Service returned:');
    console.log(`   Registration Fee: ₦${Number(configData.registrationFee).toLocaleString()}`);
    console.log(`   Type: ${typeof configData.registrationFee}`);
    console.log(`   Raw value: ${configData.registrationFee}`);
  } catch (error) {
    console.error('❌ Error calling config service:', error);
  }

  // 3. Check sample auction data for timer fields
  console.log('\n3️⃣ CHECKING SAMPLE AUCTION DATA');
  console.log('-'.repeat(60));
  
  try {
    const sampleAuctions = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        startTime: auctions.startTime,
        endTime: auctions.endTime,
        scheduledStartTime: auctions.scheduledStartTime,
        caseId: auctions.caseId,
        claimReference: cases.claimReference,
        assetType: cases.assetType,
      })
      .from(auctions)
      .leftJoin(cases, eq(auctions.caseId, cases.id))
      .where(
        or(
          eq(auctions.status, 'active'),
          eq(auctions.status, 'extended'),
          eq(auctions.status, 'scheduled')
        )
      )
      .limit(5);

    if (sampleAuctions.length > 0) {
      console.log(`✅ Found ${sampleAuctions.length} active/scheduled auctions:`);
      
      sampleAuctions.forEach((auction, index) => {
        console.log(`\n   Auction ${index + 1}:`);
        console.log(`   - ID: ${auction.id}`);
        console.log(`   - Status: ${auction.status}`);
        console.log(`   - Claim Ref: ${auction.claimReference}`);
        console.log(`   - Asset Type: ${auction.assetType}`);
        console.log(`   - Start Time: ${auction.startTime}`);
        console.log(`   - End Time: ${auction.endTime}`);
        console.log(`   - Scheduled Start: ${auction.scheduledStartTime || 'N/A'}`);
        
        // Check if endTime is valid
        if (auction.endTime) {
          const endDate = new Date(auction.endTime);
          const now = new Date();
          const diff = endDate.getTime() - now.getTime();
          const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          
          console.log(`   - Time Remaining: ${hoursRemaining}h ${minutesRemaining}m`);
          console.log(`   - Timer should show: ${diff > 0 ? '✅ YES' : '❌ NO (expired)'}`);
        } else {
          console.log(`   - ❌ NO END TIME!`);
        }
      });
    } else {
      console.log('⚠️  No active or scheduled auctions found');
    }
  } catch (error) {
    console.error('❌ Error reading auctions:', error);
  }

  // 4. Check what the API endpoint would return
  console.log('\n4️⃣ SIMULATING API RESPONSE');
  console.log('-'.repeat(60));
  
  try {
    const { configService } = await import('@/features/auction-deposit/services/config.service');
    const config = await configService.getConfig();
    const feeAmount = config.registrationFee;
    
    const apiResponse = {
      success: true,
      data: {
        paid: false, // Example
        amount: null,
        paidAt: null,
        reference: null,
        feeAmount: feeAmount,
      },
    };
    
    console.log('✅ API would return:');
    console.log(JSON.stringify(apiResponse, null, 2));
    console.log(`\n   Component would display: ₦${Number(feeAmount).toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error simulating API:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ DIAGNOSTIC COMPLETE\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
