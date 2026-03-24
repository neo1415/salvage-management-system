/**
 * Apply Performance Indexes Migration
 * Phase 1 Scalability: Add database indexes for 2-5x query performance
 */

import { config } from 'dotenv';
config();

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyIndexes() {
  console.log('🚀 Applying performance indexes...');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not found');
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'drizzle', 'migrations', 'add-performance-indexes.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} index creation statements`);

    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
        const indexName = statement.match(/idx_\w+/)?.[0] || 'unknown';
        console.log(`✅ Created index: ${indexName}`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error instanceof Error && error.message.includes('already exists')) {
          const indexName = statement.match(/idx_\w+/)?.[0] || 'unknown';
          console.log(`⏭️  Index already exists: ${indexName}`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ All performance indexes applied successfully!');
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyIndexes()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
