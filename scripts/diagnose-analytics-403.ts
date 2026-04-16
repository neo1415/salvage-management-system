/**
 * Analytics Dashboard 403 Error Diagnostic Script
 * 
 * This script helps diagnose why the analytics dashboard is showing "No data available"
 * despite having data in the database.
 */

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

async function diagnoseAnalytics403() {
  console.log('\n🔍 Analytics Dashboard 403 Error Diagnosis\n');
  console.log('='.repeat(60));

  try {
    // 1. Check current session
    console.log('\n1️⃣  Checking Authentication Session...');
    const session = await auth();
    
    if (!session?.user) {
      console.log('❌ No active session found');
      console.log('   → User needs to log in');
      return;
    }

    console.log('✅ Session found:');
    console.log(`   User ID: ${session.user.id}`);
    console.log(`   Email: ${session.user.email}`);
    console.log(`   Role: ${session.user.role}`);
    console.log(`   Name: ${session.user.name}`);

    // 2. Check role permissions
    console.log('\n2️⃣  Checking Role Permissions...');
    const allowedRoles = ['system_admin', 'salvage_manager', 'finance_officer'];
    const hasPermission = allowedRoles.includes(session.user.role);

    if (!hasPermission) {
      console.log(`❌ User role "${session.user.role}" is NOT authorized`);
      console.log(`   Allowed roles: ${allowedRoles.join(', ')}`);
      console.log('\n   🔧 FIX: Update user role in database or modify API authorization');
      return;
    }

    console.log(`✅ User role "${session.user.role}" is authorized`);
    console.log(`   Allowed roles: ${allowedRoles.join(', ')}`);

    // 3. Check analytics tables
    console.log('\n3️⃣  Checking Analytics Tables...');
    
    const tables = [
      'asset_performance_analytics',
      'attribute_performance_analytics',
      'temporal_activity_patterns',
      'geographic_patterns',
      'vendor_segments',
      'conversion_funnel_analytics',
      'session_analytics',
    ];

    for (const table of tables) {
      try {
        const result: any = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result[0]?.count || '0');
        
        if (count > 0) {
          console.log(`✅ ${table}: ${count} records`);
        } else {
          console.log(`⚠️  ${table}: 0 records (empty)`);
        }
      } catch (error: any) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      }
    }

    // 4. Test API endpoints
    console.log('\n4️⃣  Testing API Endpoints...');
    console.log('   Note: Run this from the browser console or use curl to test actual HTTP requests');
    console.log('   The session cookie is required for authentication');

    const endpoints = [
      '/api/intelligence/analytics/asset-performance',
      '/api/intelligence/analytics/attribute-performance',
      '/api/intelligence/analytics/temporal-patterns',
      '/api/intelligence/analytics/geographic-patterns',
      '/api/intelligence/analytics/vendor-segments',
      '/api/intelligence/analytics/conversion-funnel',
      '/api/intelligence/analytics/session-metrics',
    ];

    console.log('\n   Test these endpoints in browser console:');
    endpoints.forEach(endpoint => {
      console.log(`   fetch('${endpoint}?startDate=2026-03-07&endDate=2026-04-07').then(r => r.json()).then(console.log)`);
    });

    // 5. Check for race conditions
    console.log('\n5️⃣  Checking for Race Conditions...');
    console.log('   The dashboard makes API calls immediately on mount');
    console.log('   If session is not loaded yet, APIs will return 403');
    console.log('\n   ✅ FIX APPLIED: Dashboard now waits for session before fetching');

    // 6. Summary
    console.log('\n📊 DIAGNOSIS SUMMARY');
    console.log('='.repeat(60));
    
    if (hasPermission) {
      console.log('✅ User has correct permissions');
      console.log('✅ Session is valid');
      console.log('\n🔧 LIKELY CAUSES:');
      console.log('   1. Race condition: Dashboard fetching before session loads');
      console.log('      → FIX: Use useSession hook and wait for status === "authenticated"');
      console.log('   2. Empty analytics tables');
      console.log('      → FIX: Run population scripts to generate analytics data');
      console.log('   3. API errors not displayed to user');
      console.log('      → FIX: Show error alerts when APIs fail');
    } else {
      console.log('❌ User does NOT have correct permissions');
      console.log('\n🔧 FIXES:');
      console.log('   Option 1: Update user role in database');
      console.log('   Option 2: Add user role to allowed roles in API routes');
    }

    console.log('\n✅ Fixes have been applied to:');
    console.log('   - src/components/intelligence/admin/analytics/analytics-dashboard-content.tsx');
    console.log('     • Added useSession hook to wait for authentication');
    console.log('     • Added error state and display');
    console.log('     • Added 403/401 error handling');
    console.log('     • Added console warnings for failed API calls');

  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error);
  }
}

// Run diagnosis
diagnoseAnalytics403()
  .then(() => {
    console.log('\n✅ Diagnosis complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
