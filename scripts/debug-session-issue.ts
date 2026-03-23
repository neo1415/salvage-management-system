/**
 * Debug Session Issue Script
 * 
 * This script helps debug the session hijacking issue where logging in
 * as a new user results in being logged in as the system admin.
 */

import { db } from '../src/lib/db/drizzle';
import { users } from '../src/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { kv } from '@vercel/kv';

async function debugSessionIssue() {
  console.log('=== Session Issue Debugger ===\n');

  // 1. List all users
  console.log('1. Fetching all users from database...');
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    status: users.status,
    lastLoginAt: users.lastLoginAt,
  }).from(users);

  console.log(`Found ${allUsers.length} users:\n`);
  allUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.fullName} (${user.email})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Last Login: ${user.lastLoginAt || 'Never'}\n`);
  });

  // 2. Check Redis sessions
  console.log('\n2. Checking Redis sessions...');
  try {
    // Get all session keys
    const sessionKeys: string[] = [];
    for (const user of allUsers) {
      const key = `session:${user.id}`;
      sessionKeys.push(key);
    }

    console.log(`Checking ${sessionKeys.length} potential session keys...\n`);

    for (const key of sessionKeys) {
      try {
        const sessionData = await kv.get(key);
        if (sessionData) {
          console.log(`✓ Active session found: ${key}`);
          console.log(`  Data: ${JSON.stringify(sessionData, null, 2)}\n`);
        }
      } catch (error) {
        console.log(`✗ Error checking ${key}:`, error);
      }
    }
  } catch (error) {
    console.error('Error checking Redis sessions:', error);
  }

  // 3. Check for the specific user mentioned in the issue
  console.log('\n3. Checking specific user: adetimilehin502@gmail.com');
  const [specificUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'adetimilehin502@gmail.com'))
    .limit(1);

  if (specificUser) {
    console.log('User found:');
    console.log(`  ID: ${specificUser.id}`);
    console.log(`  Name: ${specificUser.fullName}`);
    console.log(`  Role: ${specificUser.role}`);
    console.log(`  Status: ${specificUser.status}`);
    console.log(`  Require Password Change: ${specificUser.requirePasswordChange}`);
    console.log(`  Last Login: ${specificUser.lastLoginAt}`);
  } else {
    console.log('User not found in database');
  }

  // 4. Check for system admin
  console.log('\n4. Checking system admin user...');
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);

  if (adminUser) {
    console.log('System admin found:');
    console.log(`  ID: ${adminUser.id}`);
    console.log(`  Name: ${adminUser.fullName}`);
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Last Login: ${adminUser.lastLoginAt}`);
  } else {
    console.log('No system admin found');
  }

  console.log('\n=== Debug Complete ===');
  process.exit(0);
}

debugSessionIssue().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
