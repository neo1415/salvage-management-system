/**
 * Check Termii Sender ID Status
 * 
 * This script checks if your sender ID is approved and suggests alternatives
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'NEMSAL';

async function checkSenderIDStatus() {
  console.log('🔍 Checking Termii Sender ID Status...\n');
  console.log('─'.repeat(60));
  console.log(`📤 Current Sender ID: ${TERMII_SENDER_ID}`);
  console.log('─'.repeat(60));

  if (!TERMII_API_KEY) {
    console.error('\n❌ ERROR: TERMII_API_KEY is not set');
    process.exit(1);
  }

  try {
    // Check sender IDs
    console.log('\n⏳ Fetching sender IDs from Termii...');
    const response = await axios.get(
      `https://api.ng.termii.com/api/sender-id?api_key=${TERMII_API_KEY}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('\n✅ Sender IDs Retrieved:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(response.data, null, 2));
    console.log('─'.repeat(60));

    const senderIds =
      response.data?.content ?? response.data?.data ?? [];

    if (!Array.isArray(senderIds) || senderIds.length === 0) {
      console.log('\n⚠️  NO SENDER IDs FOUND!');
      console.log('Request sender IDs at https://accounts.termii.com/');
    } else {
      console.log('\n📋 Your Sender IDs:');
      senderIds.forEach((sender: { sender_id: string; status: string; createdAt?: string }, index: number) => {
        console.log(`\n${index + 1}. ${sender.sender_id}`);
        console.log(`   Status: ${sender.status}`);
        if (sender.createdAt) console.log(`   Created: ${sender.createdAt}`);
      });

      const currentSender = senderIds.find((s: { sender_id: string }) => s.sender_id === TERMII_SENDER_ID);
      if (currentSender) {
        console.log(`\n✅ Your sender ID "${TERMII_SENDER_ID}" is ${currentSender.status}`);
        if (currentSender.status !== 'active' && currentSender.status !== 'approved') {
          console.log('\n⚠️  Sender ID is not active/approved yet.');
        }
      } else {
        console.log(`\n⚠️  Sender ID "${TERMII_SENDER_ID}" not found in your account!`);
        console.log('\nAvailable sender IDs:');
        senderIds.forEach((s: { sender_id: string; status: string }) =>
          console.log(`  - ${s.sender_id} (${s.status})`)
        );
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR checking sender IDs:');
    if (axios.isAxiosError(error) && error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error);
    }
  }

  // Try sending with DND channel (bypasses sender ID requirement)
  console.log('\n\n🔄 ALTERNATIVE: Try sending with DND channel...');
  console.log('─'.repeat(60));
  console.log('The DND channel can deliver SMS without approved sender ID');
  console.log('but may have higher costs and requires DND-enabled numbers.');
  console.log('\nWould you like to try? Update the script to use:');
  console.log('  channel: "dnd" instead of channel: "generic"');
}

checkSenderIDStatus().catch(console.error);
