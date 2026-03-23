import 'dotenv/config';

/**
 * Check Termii Account Status and Message History
 * 
 * This script checks your Termii balance and recent message status
 * Usage: npx tsx scripts/check-termii-status.ts
 */

async function checkTermiiStatus() {
  const apiKey = process.env.TERMII_API_KEY;
  
  if (!apiKey) {
    console.error('❌ TERMII_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('🔍 Checking Termii Account Status...\n');

  try {
    // Check balance
    console.log('1️⃣ Checking Balance...');
    const balanceResponse = await fetch(`https://api.ng.termii.com/api/get-balance?api_key=${apiKey}`);
    const balanceData = await balanceResponse.json();
    
    if (balanceResponse.ok) {
      console.log('✅ Balance:', balanceData);
      console.log(`   Currency: ${balanceData.currency}`);
      console.log(`   Balance: ${balanceData.balance} credits`);
    } else {
      console.log('❌ Balance check failed:', balanceData);
    }
    console.log('');

    // Check sender IDs
    console.log('2️⃣ Checking Sender IDs...');
    const senderResponse = await fetch(`https://api.ng.termii.com/api/sender-id?api_key=${apiKey}`);
    const senderData = await senderResponse.json();
    
    if (senderResponse.ok) {
      console.log('✅ Sender IDs:', senderData);
      if (senderData.data && senderData.data.length > 0) {
        senderData.data.forEach((sender: any) => {
          console.log(`   - ${sender.sender_id}: ${sender.status}`);
        });
      }
    } else {
      console.log('❌ Sender ID check failed:', senderData);
    }
    console.log('');

    // Check message history (last 5 messages)
    console.log('3️⃣ Checking Recent Message History...');
    const historyResponse = await fetch(`https://api.ng.termii.com/api/sms/inbox?api_key=${apiKey}`);
    const historyData = await historyResponse.json();
    
    if (historyResponse.ok) {
      console.log('✅ Message History:', historyData);
    } else {
      console.log('⚠️  Message history not available (may require higher plan)');
    }
    console.log('');

    // Recommendations
    console.log('📋 Recommendations:');
    console.log('');
    
    if (balanceData.balance < 10) {
      console.log('⚠️  LOW BALANCE: You have less than 10 SMS credits');
      console.log('   Top up at: https://accounts.termii.com/');
      console.log('');
    }

    console.log('🔍 If SMS not received, check:');
    console.log('   1. Phone number format: Must be +234XXXXXXXXXX (not 0XXXXXXXXXX)');
    console.log('   2. Network signal on receiving phone');
    console.log('   3. SMS inbox (not spam/blocked)');
    console.log('   4. Termii dashboard for delivery status');
    console.log('   5. Try a different phone number to test');
    console.log('');
    console.log('📱 Termii Dashboard: https://accounts.termii.com/');
    console.log('📊 Message Logs: https://accounts.termii.com/messaging');

  } catch (error) {
    console.error('❌ Error checking Termii status:', error);
    process.exit(1);
  }
}

checkTermiiStatus();
