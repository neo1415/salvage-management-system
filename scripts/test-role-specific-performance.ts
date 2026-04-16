/**
 * Test Role-Specific My Performance Report
 * 
 * This script tests the new role-specific implementation:
 * - Claims Adjusters: See cases they created
 * - Salvage Managers: See team dashboard with all adjusters
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, users, auctions, payments } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { MyPerformanceService } from '@/features/reports/user-performance/services';

async function testRoleSpecificPerformance() {
  console.log('='.repeat(80));
  console.log('TESTING ROLE-SPECIFIC MY PERFORMANCE REPORT');
  console.log('='.repeat(80));

  // Get a salvage manager and a claims adjuster
  const allUsers = await db.select().from(users);
  const manager = allUsers.find(u => u.role === 'salvage_manager');
  const adjuster = allUsers.find(u => u.role === 'claims_adjuster');

  if (!manager) {
    console.log('\n❌ No salvage manager found in database');
    return;
  }

  if (!adjuster) {
    console.log('\n❌ No claims adjuster found in database');
    return;
  }

  console.log(`\n✅ Found Manager: ${manager.fullName} (${manager.id})`);
  console.log(`✅ Found Adjuster: ${adjuster.fullName} (${adjuster.id})`);

  // Date range: last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const filters = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  console.log(`\n📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  // Test 1: Claims Adjuster Personal Report
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: CLAIMS ADJUSTER PERSONAL REPORT');
  console.log('='.repeat(80));

  const adjusterReport = await MyPerformanceService.generateReport(
    filters,
    adjuster.id,
    'claims_adjuster'
  );

  console.log('\n📊 Adjuster Personal Metrics:');
  console.log(`   Cases Processed: ${adjusterReport.casesProcessed}`);
  console.log(`   Avg Processing Time: ${adjusterReport.avgProcessingTime.toFixed(1)} days`);
  console.log(`   Approval Rate: ${adjusterReport.approvalRate.toFixed(1)}%`);
  console.log(`   Quality Score: ${adjusterReport.qualityScore.toFixed(1)}/100`);
  console.log(`   Revenue Contribution: ₦${adjusterReport.revenueContribution.toLocaleString()}`);
  console.log(`   Team Breakdown: ${adjusterReport.teamBreakdown ? 'YES (WRONG!)' : 'NO (CORRECT)'}`);
  console.log(`   Pending Approval: ${adjusterReport.pendingApproval !== undefined ? 'YES (WRONG!)' : 'NO (CORRECT)'}`);

  // Verify the data
  const adjusterCases = await db
    .select()
    .from(salvageCases)
    .where(
      and(
        eq(salvageCases.createdBy, adjuster.id),
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate)
      )
    );

  console.log(`\n✅ Verification: Found ${adjusterCases.length} cases created by adjuster`);
  console.log(`   Approved: ${adjusterCases.filter(c => c.status === 'approved' || c.status === 'active_auction' || c.status === 'sold').length}`);
  console.log(`   Rejected: ${adjusterCases.filter(c => c.status === 'draft' && c.approvedAt !== null).length}`);
  console.log(`   Pending: ${adjusterCases.filter(c => c.status === 'pending_approval').length}`);

  // Test 2: Salvage Manager Team Report
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: SALVAGE MANAGER TEAM REPORT');
  console.log('='.repeat(80));

  const managerReport = await MyPerformanceService.generateReport(
    filters,
    manager.id,
    'salvage_manager'
  );

  console.log('\n📊 Manager Team Metrics:');
  console.log(`   Total Team Cases: ${managerReport.casesProcessed}`);
  console.log(`   Avg Processing Time: ${managerReport.avgProcessingTime.toFixed(1)} days`);
  console.log(`   Team Approval Rate: ${managerReport.approvalRate.toFixed(1)}%`);
  console.log(`   Team Quality Score: ${managerReport.qualityScore.toFixed(1)}/100`);
  console.log(`   Total Revenue: ₦${managerReport.revenueContribution.toLocaleString()}`);
  console.log(`   Pending Approval: ${managerReport.pendingApproval !== undefined ? managerReport.pendingApproval : 'MISSING (WRONG!)'}`);
  console.log(`   Team Breakdown: ${managerReport.teamBreakdown ? 'YES (CORRECT)' : 'NO (WRONG!)'}`);

  if (managerReport.teamBreakdown && managerReport.teamBreakdown.length > 0) {
    console.log('\n👥 Team Breakdown by Adjuster:');
    console.log('   ' + '-'.repeat(76));
    console.log('   Adjuster                  | Cases | Approved | Rejected | Rate  | Time  | Revenue');
    console.log('   ' + '-'.repeat(76));
    
    for (const adj of managerReport.teamBreakdown) {
      const name = adj.adjusterName.padEnd(25);
      const cases = adj.casesSubmitted.toString().padStart(5);
      const approved = adj.casesApproved.toString().padStart(8);
      const rejected = adj.casesRejected.toString().padStart(8);
      const rate = `${adj.approvalRate.toFixed(1)}%`.padStart(5);
      const time = `${adj.avgProcessingTime.toFixed(1)}d`.padStart(5);
      const revenue = `₦${adj.revenue.toLocaleString()}`.padStart(12);
      
      console.log(`   ${name} | ${cases} | ${approved} | ${rejected} | ${rate} | ${time} | ${revenue}`);
    }
    console.log('   ' + '-'.repeat(76));
  }

  // Verify the data
  const allCases = await db
    .select()
    .from(salvageCases)
    .where(
      and(
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate)
      )
    );

  console.log(`\n✅ Verification: Found ${allCases.length} total cases in date range`);
  console.log(`   Pending Approval: ${allCases.filter(c => c.status === 'pending_approval').length}`);
  console.log(`   Approved: ${allCases.filter(c => c.status === 'approved' || c.status === 'active_auction' || c.status === 'sold').length}`);
  console.log(`   Rejected: ${allCases.filter(c => c.status === 'draft' && c.approvedAt !== null).length}`);

  // Test 3: Revenue Calculation
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: REVENUE CALCULATION VERIFICATION');
  console.log('='.repeat(80));

  const soldCases = await db
    .select({
      caseId: salvageCases.id,
      status: salvageCases.status,
      auctionId: auctions.id,
      paymentAmount: payments.amount,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .leftJoin(
      payments,
      and(
        eq(auctions.id, payments.auctionId),
        eq(payments.status, 'verified')
      )
    )
    .where(
      and(
        eq(salvageCases.status, 'sold'),
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate)
      )
    );

  const totalRevenue = soldCases
    .filter(c => c.paymentAmount)
    .reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);

  console.log(`\n💰 Revenue Analysis:`);
  console.log(`   Sold Cases: ${soldCases.length}`);
  console.log(`   Cases with Verified Payments: ${soldCases.filter(c => c.paymentAmount).length}`);
  console.log(`   Total Verified Revenue: ₦${totalRevenue.toLocaleString()}`);
  console.log(`   Manager Report Revenue: ₦${managerReport.revenueContribution.toLocaleString()}`);
  console.log(`   Match: ${totalRevenue === managerReport.revenueContribution ? '✅ YES' : '❌ NO'}`);

  // Test 4: Quality Score vs Trend Graph
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: QUALITY SCORE CONSISTENCY');
  console.log('='.repeat(80));

  console.log(`\n📈 Manager Report:`);
  console.log(`   Quality Score (main): ${managerReport.qualityScore.toFixed(1)}`);
  console.log(`   Approval Rate: ${managerReport.approvalRate.toFixed(1)}%`);
  console.log(`   Should Match: ${managerReport.qualityScore === managerReport.approvalRate ? '✅ YES' : '❌ NO'}`);

  if (managerReport.trends.length > 0) {
    console.log(`\n   Trend Data (last ${managerReport.trends.length} periods):`);
    for (const trend of managerReport.trends) {
      console.log(`   ${trend.period}: ${trend.cases} cases, ${trend.quality.toFixed(1)}% quality`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ TESTING COMPLETE');
  console.log('='.repeat(80));
}

testRoleSpecificPerformance()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
