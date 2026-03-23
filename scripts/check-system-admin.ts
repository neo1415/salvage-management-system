#!/usr/bin/env tsx

import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkSystemAdmin() {
  try {
    const result = await db.execute(sql`
      SELECT id, email, role FROM users WHERE role = 'system_admin' LIMIT 5
    `);
    
    console.log('System admin users found:', result.length);
    if (result.length > 0) {
      console.log('Users:', result);
    } else {
      console.log('No system admin users found. Creating audit log without user reference.');
    }
  } catch (error) {
    console.error('Error checking system admin users:', error);
  }
}

checkSystemAdmin();