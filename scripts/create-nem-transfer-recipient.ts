/**
 * Script: Create NEM Insurance Transfer Recipient
 * 
 * Purpose: One-time setup to create a Paystack transfer recipient for NEM Insurance.
 * This recipient code is used to transfer auction payments from vendor wallets to NEM Insurance.
 * 
 * Usage:
 * 1. Update NEM_BANK_DETAILS with actual bank information
 * 2. Run: npm run script scripts/create-nem-transfer-recipient.ts
 * 3. Copy the recipient code to .env as PAYSTACK_NEM_RECIPIENT_CODE
 * 
 * IMPORTANT: Run this in PRODUCTION with LIVE Paystack keys
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

// TODO: Update with actual NEM Insurance bank details
const NEM_BANK_DETAILS = {
  accountNumber: '0123456789',  // Replace with actual account number
  bankCode: '058',              // Replace with actual bank code (e.g., 058 for GTBank)
  accountName: 'NEM Insurance Plc', // Must match bank records exactly
};

async function createNEMRecipient() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('CREATE NEM INSURANCE TRANSFER RECIPIENT');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ ERROR: PAYSTACK_SECRET_KEY not found in environment variables');
    console.error('   Please set PAYSTACK_SECRET_KEY in your .env file\n');
    process.exit(1);
  }

  // Check if using test or live key
  const isTestMode = PAYSTACK_SECRET_KEY.startsWith('sk_test_');
  const isLiveMode = PAYSTACK_SECRET_KEY.startsWith('sk_live_');

  if (isTestMode) {
    console.log('⚠️  WARNING: Using TEST mode Paystack key');
    console.log('   This will create a test recipient (no real money transfers)');
    console.log('   For production, use LIVE Paystack key (sk_live_xxxxx)\n');
  } else if (isLiveMode) {
    console.log('✅ Using LIVE mode Paystack key');
    console.log('   This will create a REAL recipient for production transfers\n');
  } else {
    console.error('❌ ERROR: Invalid Paystack secret key format');
    console.error('   Key should start with sk_test_ or sk_live_\n');
    process.exit(1);
  }

  console.log('📋 NEM Insurance Bank Details:');
  console.log(`   Account Number: ${NEM_BANK_DETAILS.accountNumber}`);
  console.log(`   Bank Code: ${NEM_BANK_DETAILS.bankCode}`);
  console.log(`   Account Name: ${NEM_BANK_DETAILS.accountName}\n`);

  // Verify bank details before proceeding
  if (NEM_BANK_DETAILS.accountNumber === '0123456789') {
    console.error('❌ ERROR: Please update NEM_BANK_DETAILS with actual bank information');
    console.error('   Edit this script and replace placeholder values\n');
    process.exit(1);
  }

  try {
    console.log('🚀 Creating transfer recipient...\n');

    const response = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: NEM_BANK_DETAILS.accountName,
        account_number: NEM_BANK_DETAILS.accountNumber,
        bank_code: NEM_BANK_DETAILS.bankCode,
        currency: 'NGN',
        description: 'NEM Insurance - Salvage Auction Payments',
      }),
    });

    const data = await response.json();

    if (data.status) {
      console.log('✅ Transfer recipient created successfully!\n');
      console.log('═══════════════════════════════════════════════════════');
      console.log('RECIPIENT DETAILS');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`Recipient Code: ${data.data.recipient_code}`);
      console.log(`Name: ${data.data.name}`);
      console.log(`Account Number: ${data.data.details.account_number}`);
      console.log(`Account Name: ${data.data.details.account_name || 'N/A'}`);
      console.log(`Bank: ${data.data.details.bank_name} (${data.data.details.bank_code})`);
      console.log(`Currency: ${data.data.currency}`);
      console.log(`Status: ${data.data.active ? 'Active' : 'Inactive'}`);
      console.log('═══════════════════════════════════════════════════════\n');

      console.log('📝 NEXT STEPS:\n');
      console.log('1. Add this to your .env file:');
      console.log(`   PAYSTACK_NEM_RECIPIENT_CODE=${data.data.recipient_code}\n`);
      console.log('2. Restart your application to load the new environment variable\n');
      console.log('3. Test fund release with a small auction payment\n');
      console.log('4. Monitor transfers in Paystack dashboard:\n');
      console.log(`   ${isLiveMode ? 'https://dashboard.paystack.com/#/transfers' : 'https://dashboard.paystack.com/#/test/transfers'}\n`);

      // Save recipient details to file for reference
      const fs = await import('fs/promises');
      const recipientData = {
        recipientCode: data.data.recipient_code,
        name: data.data.name,
        accountNumber: data.data.details.account_number,
        accountName: data.data.details.account_name,
        bankCode: data.data.details.bank_code,
        bankName: data.data.details.bank_name,
        currency: data.data.currency,
        active: data.data.active,
        createdAt: new Date().toISOString(),
        mode: isLiveMode ? 'live' : 'test',
      };

      const filename = `nem-recipient-${isLiveMode ? 'live' : 'test'}-${Date.now()}.json`;
      await fs.writeFile(filename, JSON.stringify(recipientData, null, 2));
      console.log(`💾 Recipient details saved to: ${filename}\n`);

    } else {
      console.error('❌ Failed to create transfer recipient\n');
      console.error('Error:', data.message);
      
      if (data.errors) {
        console.error('\nValidation Errors:');
        for (const [field, errors] of Object.entries(data.errors)) {
          console.error(`  ${field}: ${errors}`);
        }
      }
      
      console.error('\n💡 Common Issues:');
      console.error('   - Invalid account number format');
      console.error('   - Invalid bank code (use Paystack bank codes)');
      console.error('   - Account name doesn\'t match bank records');
      console.error('   - Duplicate account number (recipient already exists)\n');
      
      console.error('📚 Get valid bank codes:');
      console.error('   curl https://api.paystack.co/bank \\');
      console.error('     -H "Authorization: Bearer YOUR_SECRET_KEY"\n');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error creating transfer recipient:', error);
    process.exit(1);
  }
}

// Main execution
createNEMRecipient();
