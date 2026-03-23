import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { seedRegistry } from '@/lib/db/schema/seed-registry';
import { eq } from 'drizzle-orm';

const scriptName = process.argv[2];

if (!scriptName) {
  console.error('Usage: npx tsx scripts/delete-seed-registry-entry.ts <script-name>');
  process.exit(1);
}

async function deleteEntry() {
  console.log(`\n🗑️  Deleting seed registry entry for: ${scriptName}\n`);
  
  const result = await db
    .delete(seedRegistry)
    .where(eq(seedRegistry.scriptName, scriptName))
    .returning();
  
  if (result.length > 0) {
    console.log(`✅ Deleted ${result.length} entry`);
  } else {
    console.log(`⚠️  No entry found for: ${scriptName}`);
  }
  
  process.exit(0);
}

deleteEntry().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
