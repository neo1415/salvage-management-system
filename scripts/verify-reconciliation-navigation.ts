/**
 * Verify Reconciliation Navigation Integration
 * 
 * This script verifies that the reconciliation navigation link
 * is properly configured in the sidebar.
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying Reconciliation Navigation Integration...\n');

// Read the sidebar file
const sidebarPath = path.join(process.cwd(), 'src/components/layout/dashboard-sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

// Check for reconciliation navigation item
const checks = [
  {
    name: 'Reconciliation label exists',
    pattern: /label:\s*['"]Reconciliation['"]/,
    required: true,
  },
  {
    name: 'Reconciliation href exists',
    pattern: /href:\s*['"]\/finance\/reconciliation['"]/,
    required: true,
  },
  {
    name: 'Database icon imported',
    pattern: /Database.*from.*lucide-react|from.*lucide-react.*Database/s,
    required: true,
  },
  {
    name: 'Database icon used',
    pattern: /icon:\s*Database/,
    required: true,
  },
  {
    name: 'Finance officer role authorized',
    pattern: /roles:\s*\[.*['"]finance_officer['"]/,
    required: true,
  },
  {
    name: 'System admin role authorized',
    pattern: /roles:\s*\[.*['"]system_admin['"]/,
    required: true,
  },
];

let allPassed = true;

checks.forEach((check) => {
  const passed = check.pattern.test(sidebarContent);
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
  
  if (!passed && check.required) {
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(60));

if (allPassed) {
  console.log('✅ All navigation checks passed!');
  console.log('\n📍 Navigation Path: Sidebar → Finance → Reconciliation');
  console.log('🔗 URL: /finance/reconciliation');
  console.log('👥 Authorized Roles: finance_officer, system_admin');
  console.log('🎨 Icon: Database (lucide-react)');
  process.exit(0);
} else {
  console.log('❌ Some navigation checks failed!');
  process.exit(1);
}
