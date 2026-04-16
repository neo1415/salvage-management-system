/**
 * Diagnostic Script: My Performance Data
 * Checks what data exists for the logged-in user
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, users, auctions, payments } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

async function diagnose() {
  console.log('=== MY PERFORMANCE DATA DIAGNOSTIC ===\n');

  // Get all users with claims_adjuster role
  console.log('1. Finding claims adjusters...');
  const adjusters = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
    })
    .from(users)
    .where(eq(users.role, 'claims_adjuster'));

  console.log(`Found ${adjusters.length} claims adjusters:`);
  adjusters.forEach(adj => {
    console.log(`  - ${adj.fullName} (${adj.email}) - ID: ${adj.id}`);
  });

  if (adjusters.length === 0) {
    console.log('\n❌ No claims adjusters found in the system!');
    return;
  }

  // Check cases for each adjuster
  console.log('\n2. Checking cases for each adjuster...');
  for (const adjuster of adjusters) {
    const cases = await db
      .select({
        id: salvageCases.id,
        status: salvageCases.status,
        createdAt: salvageCases.createdAt,
        approvedAt: salvageCases.approvedAt,
        marketValue: salvageCases.marketValue,
      })
      .from(salvageCases)
      .where(eq(salvageCases.createdBy, adjuster.id))
      .orderBy(desc(salvageCases.createdAt))
      .limit(5);

    console.log(`\n  ${adjuster.fullName}:`);
    console.log(`    Total cases: ${cases.length}`);
    
    if (cases.length > 0) {
      console.log(`    Recent cases:`);
      cases.forEach(c => {
        console.log(`      - ${c.id}: ${c.status} (created: ${c.createdAt.toISOString().split('T')[0]})`);
      });

      // Check date range
      const oldestCase = cases[cases.length - 1];
      const newestCase = cases[0];
      console.log(`    Date range: ${oldestCase.createdAt.toISOString().split('T')[0]} to ${newestCase.createdAt.toISOString().split('T')[0]}`);
    } else {
      console.log(`    ❌ No cases found for this adjuster`);
    }
  }

  // Check the date range being queried
  console.log('\n3. Checking current date range filter...');
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  console.log(`  Current date: ${now.toISOString().split('T')[0]}`);
  console.log(`  30 days ago: ${thirtyDaysAgo.toISOString().split('T')[0]}`);

  // Check cases in the last 30 days
  console.log('\n4. Cases in the last 30 days:');
  for (const adjuster of adjusters) {
    const recentCases = await db
      .select({
        id: salvageCases.id,
        status: salvageCases.status,
        createdAt: salvageCases.createdAt,
      })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.createdBy, adjuster.id),
          gte(salvageCases.createdAt, thirtyDaysAgo)
        )
      );

    console.log(`  ${adjuster.fullName}: ${recentCases.length} cases`);
  }

  // Check all cases regardless of date
  console.log('\n5. Total cases by adjuster (all time):');
  for (const adjuster of adjusters) {
    const allCases = await db
      .select({
        id: salvageCases.id,
      })
      .from(salvageCases)
      .where(eq(salvageCases.createdBy, adjuster.id));

    console.log(`  ${adjuster.fullName}: ${allCases.length} cases`);
  }

  // Check if there are any cases at all
  console.log('\n6. Checking all cases in the system...');
  const allCases = await db
    .select({
      id: salvageCases.id,
      createdBy: salvageCases.createdBy,
      createdAt: salvageCases.createdAt,
      status: salvageCases.status,
    })
    .from(salvageCases)
    .orderBy(desc(salvageCases.createdAt))
    .limit(10);

  console.log(`  Total cases in system: ${allCases.length}`);
  if (allCases.length > 0) {
    console.log(`  Recent cases:`);
    allCases.forEach(c => {
      console.log(`    - ${c.id}: created by ${c.createdBy} on ${c.createdAt.toISOString().split('T')[0]} (${c.status})`);
    });
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
