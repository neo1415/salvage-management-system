/**
 * Check Pickup Notification
 * Quick script to see if PAYMENT_UNLOCKED notification exists
 */

import { db } from '@/lib/db/drizzle';
import { notifications } from '@/lib/db/schema/notifications';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, desc } from 'drizzle-orm';

async function checkNotification(auctionId: string) {
  console.log(`\n🔍 Checking PAYMENT_UNLOCKED notification for auction: ${auctionId}\n`);

  // Get all PAYMENT_UNLOCKED notifications
  const allNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.type, 'PAYMENT_UNLOCKED'))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  console.log(`Found ${allNotifications.length} PAYMENT_UNLOCKED notifications:\n`);

  for (const notif of allNotifications) {
    const data = notif.data as any;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Notification ID: ${notif.id}`);
    console.log(`User ID: ${notif.userId}`);
    console.log(`Created: ${notif.createdAt.toISOString()}`);
    console.log(`Read: ${notif.read ? 'YES' : 'NO'}`);
    console.log(`Title: ${notif.title}`);
    console.log(`Message: ${notif.message}`);
    console.log(`\nData:`);
    console.log(`  Auction ID: ${data?.auctionId || 'N/A'}`);
    console.log(`  Payment ID: ${data?.paymentId || 'N/A'}`);
    console.log(`  Pickup Code: ${data?.pickupAuthCode || 'N/A'}`);
    console.log(`  Pickup Location: ${data?.pickupLocation || 'N/A'}`);
    console.log(`  Pickup Deadline: ${data?.pickupDeadline || 'N/A'}`);
    
    if (data?.auctionId === auctionId) {
      console.log(`\n✅ THIS IS THE ONE FOR YOUR AUCTION!`);
      
      // Get vendor info
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.userId, notif.userId))
        .limit(1);
      
      if (vendor) {
        console.log(`\nVendor Info:`);
        console.log(`  Vendor ID: ${vendor.id}`);
        console.log(`  Business Name: ${vendor.businessName}`);
      }
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  // Check if notification exists for this auction
  const targetNotif = allNotifications.find(n => (n.data as any)?.auctionId === auctionId);
  
  if (!targetNotif) {
    console.log(`\n❌ NO NOTIFICATION FOUND FOR AUCTION ${auctionId}`);
    console.log(`\nThis means the notification was never created.`);
    console.log(`Check the document service logs to see if fund release happened.\n`);
  } else {
    console.log(`\n✅ Notification EXISTS for auction ${auctionId}`);
    console.log(`\nThe modal should appear with polling every 5 seconds.`);
    console.log(`Check browser console for: "✅ Payment unlocked notification found"\n`);
  }
}

const auctionId = process.argv[2];

if (!auctionId) {
  console.error('Usage: npx tsx scripts/check-pickup-notification.ts <auctionId>');
  console.error('Example: npx tsx scripts/check-pickup-notification.ts 091f2626-...');
  process.exit(1);
}

checkNotification(auctionId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
