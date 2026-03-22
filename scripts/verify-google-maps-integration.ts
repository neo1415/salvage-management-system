/**
 * Verification Script: Google Maps Integration
 * 
 * This script verifies that the LocationMap component is properly
 * integrated into all required detail pages.
 */

import fs from 'fs';
import path from 'path';

interface VerificationResult {
  file: string;
  hasLocationMap: boolean;
  hasImport: boolean;
  hasMapUsage: boolean;
  status: 'pass' | 'fail' | 'skip';
  reason?: string;
}

const filesToCheck = [
  {
    path: 'src/app/(dashboard)/adjuster/cases/[id]/page.tsx',
    required: true,
    description: 'Adjuster Case Details',
  },
  {
    path: 'src/app/(dashboard)/manager/approvals/page.tsx',
    required: true,
    description: 'Manager Approval Page',
  },
  {
    path: 'src/app/(dashboard)/vendor/auctions/[id]/page.tsx',
    required: false, // Already had maps
    description: 'Vendor Auction Details',
  },
  {
    path: 'src/app/(dashboard)/bid-history/[auctionId]/page.tsx',
    required: false, // Already had maps
    description: 'Bid History Details',
  },
];

function verifyFile(filePath: string, required: boolean): VerificationResult {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    return {
      file: filePath,
      hasLocationMap: false,
      hasImport: false,
      hasMapUsage: false,
      status: 'fail',
      reason: 'File not found',
    };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  
  // Check for LocationMap import
  const hasImport = content.includes("import { LocationMap } from '@/components/ui/location-map'") ||
                    content.includes('import { LocationMap }');
  
  // Check for LocationMap usage
  const hasMapUsage = content.includes('<LocationMap') || 
                      content.includes('LocationMap');
  
  // Check for Google Maps iframe (alternative implementation)
  const hasGoogleMapsIframe = content.includes('maps.google.com/maps/embed') ||
                              content.includes('maps/embed/v1/place');
  
  const hasLocationMap = hasImport && hasMapUsage;
  
  let status: 'pass' | 'fail' | 'skip' = 'pass';
  let reason: string | undefined;
  
  if (required) {
    if (!hasLocationMap && !hasGoogleMapsIframe) {
      status = 'fail';
      reason = 'Missing LocationMap component or Google Maps implementation';
    } else if (hasLocationMap) {
      reason = 'Uses LocationMap component';
    } else if (hasGoogleMapsIframe) {
      reason = 'Uses inline Google Maps implementation';
    }
  } else {
    status = 'skip';
    if (hasLocationMap) {
      reason = 'Uses LocationMap component (optional)';
    } else if (hasGoogleMapsIframe) {
      reason = 'Uses inline Google Maps implementation (pre-existing)';
    } else {
      reason = 'No map implementation (optional)';
    }
  }
  
  return {
    file: filePath,
    hasLocationMap,
    hasImport,
    hasMapUsage,
    status,
    reason,
  };
}

function main() {
  console.log('🗺️  Google Maps Integration Verification\n');
  console.log('=' .repeat(80));
  console.log();
  
  const results: VerificationResult[] = [];
  
  for (const file of filesToCheck) {
    console.log(`📄 Checking: ${file.description}`);
    console.log(`   File: ${file.path}`);
    
    const result = verifyFile(file.path, file.required);
    results.push(result);
    
    const statusIcon = result.status === 'pass' ? '✅' : 
                       result.status === 'skip' ? '⏭️' : '❌';
    
    console.log(`   Status: ${statusIcon} ${result.status.toUpperCase()}`);
    console.log(`   Import: ${result.hasImport ? '✓' : '✗'}`);
    console.log(`   Usage: ${result.hasMapUsage ? '✓' : '✗'}`);
    if (result.reason) {
      console.log(`   Reason: ${result.reason}`);
    }
    console.log();
  }
  
  console.log('=' .repeat(80));
  console.log();
  
  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  console.log('📊 Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📝 Total: ${results.length}`);
  console.log();
  
  // Check LocationMap component exists
  const componentPath = 'src/components/ui/location-map.tsx';
  const componentExists = fs.existsSync(path.join(process.cwd(), componentPath));
  
  console.log('🧩 Component Status:');
  console.log(`   LocationMap Component: ${componentExists ? '✅ Exists' : '❌ Missing'}`);
  
  if (componentExists) {
    const componentContent = fs.readFileSync(
      path.join(process.cwd(), componentPath),
      'utf-8'
    );
    
    const hasLatLongProps = componentContent.includes('latitude?:') && 
                            componentContent.includes('longitude?:');
    const hasAddressProp = componentContent.includes('address?:');
    const hasGoogleMapsEmbed = componentContent.includes('google.com/maps/embed') ||
                                componentContent.includes('maps/embed/v1/place');
    
    console.log(`   - Latitude/Longitude props: ${hasLatLongProps ? '✓' : '✗'}`);
    console.log(`   - Address prop: ${hasAddressProp ? '✓' : '✗'}`);
    console.log(`   - Google Maps Embed: ${hasGoogleMapsEmbed ? '✓' : '✗'}`);
  }
  console.log();
  
  // Check documentation
  const docPath = 'src/components/ui/location-map.README.md';
  const docExists = fs.existsSync(path.join(process.cwd(), docPath));
  
  console.log('📚 Documentation:');
  console.log(`   Component README: ${docExists ? '✅ Exists' : '❌ Missing'}`);
  console.log();
  
  // Final result
  if (failed > 0) {
    console.log('❌ VERIFICATION FAILED');
    console.log('   Some required files are missing Google Maps integration.');
    process.exit(1);
  } else {
    console.log('✅ VERIFICATION PASSED');
    console.log('   All required files have Google Maps integration.');
    process.exit(0);
  }
}

main();
