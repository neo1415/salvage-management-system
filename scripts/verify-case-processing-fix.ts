import { CaseProcessingService } from '@/features/reports/operational/services';

async function verify() {
  const report = await CaseProcessingService.generateReport({
    startDate: '2026-02-01',
    endDate: '2026-04-29',
  });

  console.log('Case Processing Report:');
  console.log(`Total Cases: ${report.summary.totalCases}`);
  console.log(`Avg Processing: ${report.summary.averageProcessingTimeDays} days`);
  console.log(`Approval Rate: ${report.summary.approvalRate}%`);
  console.log(`Approved: ${report.summary.approvedCases}`);
  console.log(`Sold: ${report.summary.soldCases}`);
  console.log(`Pending: ${report.summary.pendingCases}`);
  
  console.log('\nBy Asset Type:');
  report.byAssetType.forEach(at => {
    console.log(`${at.assetType}: ${at.count} cases, ${at.averageProcessingTime} days, ${at.approvalRate}% approval`);
  });

  process.exit(0);
}

verify().catch(console.error);
