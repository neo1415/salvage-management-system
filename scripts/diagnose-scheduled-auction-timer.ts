import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

async function diagnoseScheduledAuctionTimer() {
  console.log('🔍 Diagnosing Scheduled Auction Timer Issue\n');
  console.log('='.repeat(70));

  // Find all scheduled auctions
  const scheduledAuctions = await db
    .select()
    .from(auctions)
    .where(eq(auctions.status, 'scheduled'));

  console.log(`\n📊 Found ${scheduledAuctions.length} scheduled auction(s)\n`);

  if (scheduledAuctions.length === 0) {
    console.log('⚠️  No scheduled auctions found in the database.');
    console.log('   This might be why the timer is showing "Ends in" instead of "Starts in"');
    console.log('   The auction status might not be set to "scheduled".\n');
    
    // Check for auctions with scheduledStartTime but wrong status
    const allAuctions = await db.select().from(auctions);
    const auctionsWithScheduledTime = allAuctions.filter(a => a.scheduledStartTime);
    
    console.log(`\n🔍 Found ${auctionsWithScheduledTime.length} auction(s) with scheduledStartTime:\n`);
    
    for (const auction of auctionsWithScheduledTime) {
      const now = new Date();
      const scheduledStart = new Date(auction.scheduledStartTime!);
      const end = new Date(auction.endTime);
      
      console.log(`Auction ID: ${auction.id.substring(0, 8)}...`);
      console.log(`  Status: ${auction.status} ❌ (should be "scheduled" if not started yet)`);
      console.log(`  Scheduled Start: ${scheduledStart.toLocaleString()}`);
      console.log(`  End Time: ${end.toLocaleString()}`);
      console.log(`  Current Time: ${now.toLocaleString()}`);
      console.log(`  Time until start: ${Math.floor((scheduledStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}d ${Math.floor(((scheduledStart.getTime() - now.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h`);
      console.log(`  Time until end: ${Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}d ${Math.floor(((end.getTime() - now.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h`);
      
      if (auction.status !== 'scheduled' && scheduledStart > now) {
        console.log(`  ⚠️  ISSUE: Status is "${auction.status}" but scheduled start is in the future!`);
        console.log(`      This will cause the timer to show "Ends in" instead of "Starts in"`);
      }
      console.log('');
    }
    
    return;
  }

  // Analyze each scheduled auction
  for (const auction of scheduledAuctions) {
    const now = new Date();
    const scheduledStart = auction.scheduledStartTime ? new Date(auction.scheduledStartTime) : null;
    const end = new Date(auction.endTime);

    console.log(`\nAuction ID: ${auction.id.substring(0, 8)}...`);
    console.log(`Full ID: ${auction.id}`);
    console.log('-'.repeat(70));
    
    console.log(`\n📋 Status Information:`);
    console.log(`  Status: ${auction.status} ✅`);
    console.log(`  Scheduled Start Time: ${scheduledStart ? scheduledStart.toLocaleString() : '❌ NULL (PROBLEM!)'}`);
    console.log(`  End Time: ${end.toLocaleString()}`);
    console.log(`  Current Time: ${now.toLocaleString()}`);

    if (!scheduledStart) {
      console.log(`\n❌ PROBLEM FOUND: scheduledStartTime is NULL!`);
      console.log(`   The timer logic checks for scheduledStartTime, but it's missing.`);
      console.log(`   This will cause the timer to fall through to the "Ends in" logic.`);
      continue;
    }

    const timeUntilStart = scheduledStart.getTime() - now.getTime();
    const timeUntilEnd = end.getTime() - now.getTime();

    console.log(`\n⏱️  Timer Calculations:`);
    
    if (timeUntilStart > 0) {
      const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      console.log(`  Time until START: ${days}d ${hours}h ✅`);
      console.log(`  Expected Label: "Starts in" ✅`);
      console.log(`  Expected Display: "${days}d ${hours}h" ✅`);
    } else {
      console.log(`  Time until START: PASSED (should be active now) ⚠️`);
    }

    const endDays = Math.floor(timeUntilEnd / (1000 * 60 * 60 * 24));
    const endHours = Math.floor((timeUntilEnd % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    console.log(`  Time until END: ${endDays}d ${endHours}h`);

    console.log(`\n🔍 What the Timer Logic Should Do:`);
    console.log(`  1. Check status === 'scheduled' ✅ (${auction.status === 'scheduled'})`);
    console.log(`  2. Check scheduledStartTime exists ✅ (${!!scheduledStart})`);
    console.log(`  3. Calculate time until scheduledStartTime ✅`);
    console.log(`  4. Set timerLabel to "Starts in" ✅`);
    console.log(`  5. Display countdown to START, not END ✅`);

    if (timeUntilStart > 0) {
      console.log(`\n✅ This auction should display correctly as "Starts in: ${endDays}d ${endHours}h"`);
    } else {
      console.log(`\n⚠️  This auction's scheduled start time has passed. It should be activated.`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 Summary:');
  console.log('   If you see "Ends in" instead of "Starts in" for scheduled auctions:');
  console.log('   1. Check if auction.status === "scheduled" in the database');
  console.log('   2. Check if auction.scheduledStartTime is NOT NULL');
  console.log('   3. Verify the timer logic is receiving the correct auction data');
  console.log('   4. Check browser console for any errors in the timer useEffect');
  console.log('\n');
}

diagnoseScheduledAuctionTimer()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
