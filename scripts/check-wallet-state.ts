import { db } from '@/lib/db/drizzle';
import { escrowWallets, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkWallet() {
  console.log('Checking wallet state...\n');
  
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.businessName, 'Master')
  });
  
  if (!vendor) {
    console.error('Vendor not found');
    return;
  }
  
  const wallet = await db.query.escrowWallets.findFirst({
    where: eq(escrowWallets.vendorId, vendor.id)
  });
  
  if (!wallet) {
    console.error('Wallet not found');
    return;
  }
  
  console.log('Vendor:', vendor.businessName);
  console.log('Wallet ID:', wallet.id);
  console.log('');
  console.log('Balance: ₦' + parseFloat(wallet.balance).toLocaleString());
  console.log('Available: ₦' + parseFloat(wallet.availableBalance).toLocaleString());
  console.log('Frozen: ₦' + parseFloat(wallet.frozenAmount).toLocaleString());
  console.log('Forfeited: ₦' + parseFloat(wallet.forfeitedAmount || '0').toLocaleString());
}

checkWallet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
