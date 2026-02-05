/**
 * Test Session Isolation Script
 * 
 * This script tests that sessions are properly isolated between users
 * and that the session hijacking issue is resolved.
 */

import { db } from '../src/lib/db/drizzle';
import { users } from '../src/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { kv } from '@vercel/kv';

async function testSessionIsolation() {
  console.log('=== Testing Session Isolation ===\n');

  try {
    // 1. Check the new user
    console.log('1. Checking new user (adetimilehin502@gmail.com)...');
    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'adetimilehin502@gmail.com'))
      .limit(1);

    if (newUser) {
      console.log('✓ New user found:');
      console.log(`  ID: ${newUser.id}`);
      console.log(`  Name: ${newUser.fullName}`);
      console.log(`  Role: ${newUser.role}`);
      console.log(`  Require Password Change: ${newUser.requirePasswordChange}`);
      
      // Check for any sessions
      const userSessionKey = `user:${newUser.id}:session`;
      const sessionId = await kv.get(userSessionKey);
      
      if (sessionId) {
        console.log(`  Active Session ID: ${sessionId}`);
        const sessionData = await kv.get(`session:${sessionId}`);
        if (sessionData) {
          console.log(`  Session Data: ${JSON.stringify(sessionData, null, 2)}`);
        }
      } else {
        console.log('  No active session found (expected before login)');
      }
    } else {
      console.log('✗ New user not found');
    }

    // 2. Check the admin user
    console.log('\n2. Checking admin user...');
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.role, 'system_admin'))
      .limit(1);

    if (adminUser) {
      console.log('✓ Admin user found:');
      console.log(`  ID: ${adminUser.id}`);
      console.log(`  Name: ${adminUser.fullName}`);
      console.log(`  Email: ${adminUser.email}`);
      
      // Check for any sessions
      const userSessionKey = `user:${adminUser.id}:session`;
      const sessionId = await kv.get(userSessionKey);
      
      if (sessionId) {
        console.log(`  Active Session ID: ${sessionId}`);
        const sessionData = await kv.get(`session:${sessionId}`);
        if (sessionData) {
          console.log(`  Session Data: ${JSON.stringify(sessionData, null, 2)}`);
        }
      } else {
        console.log('  No active session found');
      }
    } else {
      console.log('✗ Admin user not found');
    }

    // 3. List all active sessions
    console.log('\n3. Listing all active sessions...');
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    
    let activeSessionCount = 0;
    for (const user of allUsers) {
      const userSessionKey = `user:${user.id}:session`;
      const sessionId = await kv.get(userSessionKey);
      
      if (sessionId) {
        activeSessionCount++;
        console.log(`  ✓ Active session for ${user.email}: ${sessionId}`);
      }
    }
    
    console.log(`\nTotal active sessions: ${activeSessionCount}`);

    // 4. Verify session isolation
    console.log('\n4. Session Isolation Verification:');
    if (newUser && adminUser) {
      const newUserSessionKey = `user:${newUser.id}:session`;
      const adminUserSessionKey = `user:${adminUser.id}:session`;
      
      const newUserSessionId = await kv.get(newUserSessionKey);
      const adminUserSessionId = await kv.get(adminUserSessionKey);
      
      if (newUserSessionId && adminUserSessionId) {
        if (newUserSessionId === adminUserSessionId) {
          console.log('  ✗ CRITICAL: Both users share the same session ID!');
          console.log(`    Session ID: ${newUserSessionId}`);
        } else {
          console.log('  ✓ Sessions are properly isolated');
          console.log(`    New user session: ${newUserSessionId}`);
          console.log(`    Admin session: ${adminUserSessionId}`);
        }
      } else if (!newUserSessionId && !adminUserSessionId) {
        console.log('  ℹ No active sessions for either user (expected after clearing)');
      } else {
        console.log('  ℹ Only one user has an active session');
        if (newUserSessionId) console.log(`    New user: ${newUserSessionId}`);
        if (adminUserSessionId) console.log(`    Admin: ${adminUserSessionId}`);
      }
    }

    console.log('\n=== Test Complete ===');
    console.log('\nNext Steps:');
    console.log('1. Run: npx tsx scripts/clear-all-sessions.ts');
    console.log('2. Clear ALL browser cookies for localhost:3000');
    console.log('3. Close ALL browser windows');
    console.log('4. Open a fresh browser window');
    console.log('5. Try logging in as the new user');
    console.log('6. Verify you are NOT logged in as admin');
    
  } catch (error) {
    console.error('Error testing session isolation:', error);
  }

  process.exit(0);
}

testSessionIsolation().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
