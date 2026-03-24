/**
 * Migration Script: Add 'machinery' to asset_type enum
 * 
 * This script adds support for machinery/equipment as an asset type in the database.
 */

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/drizzle';

async function addMachineryAssetType() {
  console.log('🔄 Adding machinery to asset_type enum...');
  
  try {
    // Add the new value to the enum
    await db.execute(sql`ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'machinery'`);
    
    console.log('✅ Successfully added machinery to asset_type enum');
    console.log('   Supported asset types: vehicle, property, electronics, machinery');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addMachineryAssetType();
