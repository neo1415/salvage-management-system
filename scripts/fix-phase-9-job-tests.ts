/**
 * Fix Phase 9 Job Tests
 * 
 * This script fixes all failing tests in Phase 9 (Background Jobs)
 * by updating job implementations to match test expectations.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const fixes = [
  {
    name: 'accuracy-tracking.job.ts - Fix alert function signature',
    file: 'src/features/intelligence/jobs/accuracy-tracking.job.ts',
    search: `async function sendAccuracyAlert(
  type: 'prediction' | 'recommendation',
  currentValue: number,
  threshold: number
): Promise<void> {
  try {
    console.error(\`🚨 ACCURACY ALERT: \${type} accuracy (\${currentValue.toFixed(2)}%) below threshold (\${threshold}%)\`);
    
    // TODO: Send Socket.IO notification to admins
    // TODO: Send email alert
  } catch (error) {
    console.error('Error sending accuracy alert:', error);
  }
}`,
    replace: `async function sendAccuracyAlert(
  type: 'prediction' | 'recommendation',
  currentValue: number,
  threshold: number
): Promise<void> {
  try {
    const alertData = {
      type,
      currentValue,
      threshold,
      timestamp: new Date().toISOString()
    };
    
    console.error(\`🚨 ACCURACY ALERT: \${type} accuracy (\${currentValue.toFixed(2)}%) below threshold (\${threshold}%)\`, alertData);
    
    // TODO: Send Socket.IO notification to admins
    // TODO: Send email alert
  } catch (error) {
    console.error('Error sending accuracy alert:', error);
  }
}`,
  },
  {
    name: 'analytics-aggregation.job.ts - Add retry logic to manual run',
    file: 'src/features/intelligence/jobs/analytics-aggregation.job.ts',
    search: `/**
 * Manual run for testing
 */
export async function runAnalyticsAggregationNow(type: 'hourly' | 'daily' | 'weekly' | 'monthly') {
  console.log(\`🔄 Running \${type} rollup manually...\`);
  
  try {
    switch (type) {
      case 'hourly':
        await aggregationService.runHourlyRollup();
        break;
      case 'daily':
        await aggregationService.runDailyRollup();
        break;
      case 'weekly':
        await aggregationService.runWeeklyRollup();
        break;
      case 'monthly':
        await aggregationService.runMonthlyRollup();
        break;
    }
    
    console.log(\`✅ \${type} rollup completed successfully\`);
    return { success: true };
  } catch (error) {
    console.error(\`❌ \${type} rollup failed:\`, error);
    return { success: false, error };
  }
}`,
    replace: `/**
 * Manual run for testing
 */
export async function runAnalyticsAggregationNow(type: 'hourly' | 'daily' | 'weekly' | 'monthly') {
  console.log(\`🔄 Running \${type} rollup manually...\`);
  
  const lockKey = \`job:lock:\${type}_rollup\`;
  
  try {
    const jobFunction = async () => {
      switch (type) {
        case 'hourly':
          await aggregationService.runHourlyRollup();
          break;
        case 'daily':
          await aggregationService.runDailyRollup();
          break;
        case 'weekly':
          await aggregationService.runWeeklyRollup();
          break;
        case 'monthly':
          await aggregationService.runMonthlyRollup();
          break;
      }
    };
    
    await runWithRetry(\`\${type}_rollup\`, lockKey, jobFunction);
    
    console.log(\`✅ \${type} rollup completed successfully\`);
    return { success: true };
  } catch (error) {
    console.error(\`❌ \${type} rollup failed:\`, error);
    return { success: false, error };
  }
}`,
  },
  {
    name: 'data-maintenance.job.ts - Propagate errors in manual run',
    file: 'src/features/intelligence/jobs/data-maintenance.job.ts',
    search: `/**
 * Manual run for testing
 */
export async function runDataMaintenanceNow(
  type: 'interactions' | 'logs' | 'segments' | 'performance' | 'vectors'
) {
  console.log(\`🔄 Running \${type} maintenance manually...\`);
  
  try {
    switch (type) {
      case 'interactions':
        await cleanupOldInteractions();
        break;
      case 'logs':
        await rotateOldLogs();
        break;
      case 'segments':
        await updateVendorSegments();
        break;
      case 'performance':
        await updateAssetPerformance();
        break;
      case 'vectors':
        await updateFeatureVectors();
        break;
    }
    
    console.log(\`✅ \${type} maintenance completed\`);
    return { success: true };
  } catch (error) {
    console.error(\`❌ \${type} maintenance failed:\`, error);
    return { success: false, error };
  }
}`,
    replace: `/**
 * Manual run for testing
 */
export async function runDataMaintenanceNow(
  type: 'interactions' | 'logs' | 'segments' | 'performance' | 'vectors'
) {
  console.log(\`🔄 Running \${type} maintenance manually...\`);
  
  // For testing, we need to propagate errors instead of catching them internally
  switch (type) {
    case 'interactions':
      await cleanupOldInteractions();
      break;
    case 'logs':
      await rotateOldLogs();
      break;
    case 'segments':
      await updateVendorSegments();
      break;
    case 'performance':
      await updateAssetPerformance();
      break;
    case 'vectors':
      await updateFeatureVectors();
      break;
  }
  
  console.log(\`✅ \${type} maintenance completed\`);
  return { success: true };
}`,
  },
];

console.log('🔧 Fixing Phase 9 job implementations...\n');

let successCount = 0;
let failCount = 0;

for (const fix of fixes) {
  try {
    const filePath = join(process.cwd(), fix.file);
    let content = readFileSync(filePath, 'utf-8');
    
    if (!content.includes(fix.search)) {
      console.log(`⚠️  ${fix.name}`);
      console.log(`   Pattern not found in ${fix.file}`);
      failCount++;
      continue;
    }
    
    content = content.replace(fix.search, fix.replace);
    writeFileSync(filePath, content, 'utf-8');
    
    console.log(`✅ ${fix.name}`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${fix.name}`);
    console.log(`   Error: ${error}`);
    failCount++;
  }
}

console.log(`\n📊 Summary: ${successCount} fixes applied, ${failCount} failed`);

if (successCount > 0) {
  console.log('\n✅ Job implementations updated successfully!');
  console.log('   Run tests again to verify fixes.');
}
