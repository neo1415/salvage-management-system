/**
 * Clear All Sessions Script
 * 
 * This script clears all active sessions from Redis to help debug
 * the session hijacking issue. It handles both old and new session key formats.
 */

import { kv } from '@vercel/kv';
import { db } from '../src/lib/db/drizzle';
import { users } from '../src/lib/db/schema/users';

async function clearAllSessions() {
  console.log('=== Clearing All Sessions ===\n');

  try {
    // Get all users
    const allUsers = await db.select({ id: users.id }).from(users);
    
    console.log(`Found ${allUsers.length} users. Clearing their sessions...\n`);

    let clearedCount = 0;
    
    // Clear old-style session keys (session:userId)
    for (const user of allUsers) {
      const oldSessionKey = `session:${user.id}`;
      try {
        const deleted = await kv.del(oldSessionKey);
        if (deleted > 0) {
          clearedCount++;
          console.log(`✓ Cleared old-style session for user ID: ${user.id}`);
        }
      } catch (error) {
        console.log(`✗ Error clearing old session for ${user.id}:`, error);
      }
      
      // Clear user-to-session mapping
      const userSessionKey = `user:${user.id}:session`;
      try {
        const sessionId = await kv.get(userSessionKey);
        if (sessionId) {
          // Delete the actual session
          await kv.del(`session:${sessionId}`);
          // Delete the mapping
          await kv.del(userSessionKey);
          clearedCount++;
          console.log(`✓ Cleared new-style session for user ID: ${user.id} (session: ${sessionId})`);
        }
      } catch (error) {
        console.log(`✗ Error clearing new session for ${user.id}:`, error);
      }
    }

    // Also try to clear any orphaned session keys
    console.log('\nScanning for orphaned session keys...');
    try {
      // Note: Vercel KV doesn't support SCAN, so we can only clear known keys
      console.log('(Vercel KV does not support key scanning - only clearing known user sessions)');
    } catch (error) {
      console.log('Could not scan for orphaned keys:', error);
    }

    console.log(`\n=== Complete ===`);
    console.log(`Cleared ${clearedCount} active sessions`);
    console.log('\nAll users must now log in again with fresh credentials.');
    console.log('\nIMPORTANT: Also clear browser cookies in ALL browser windows/profiles:');
    console.log('  1. Open DevTools (F12)');
    console.log('  2. Go to Application > Cookies');
    console.log('  3. Delete all cookies for localhost:3000');
    console.log('  4. Close ALL browser windows');
    console.log('  5. Open a fresh browser window and try logging in');
    
  } catch (error) {
    console.error('Error clearing sessions:', error);
  }

  process.exit(0);
}

clearAllSessions().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
