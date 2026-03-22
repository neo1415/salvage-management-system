/**
 * Google APIs Verification Script
 * 
 * Verifies that Google APIs are properly configured and working:
 * 1. Geolocation API
 * 2. Cloud Vision API
 * 
 * Run with: npx tsx scripts/verify-google-apis.ts
 */

import * as dotenv from 'dotenv';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

interface VerificationResult {
  service: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

/**
 * Verify Geolocation API configuration
 */
async function verifyGeolocationAPI(): Promise<void> {
  console.log('\n🌍 Verifying Geolocation API...');
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'your-google-maps-api-key-here' || apiKey === '') {
    results.push({
      service: 'Geolocation API',
      status: 'error',
      message: 'API key not configured',
      details: 'Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env file'
    });
    return;
  }
  
  try {
    // Test the Geolocation API
    const response = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          considerIp: true,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      results.push({
        service: 'Geolocation API',
        status: 'error',
        message: 'API request failed',
        details: error.error?.message || JSON.stringify(error)
      });
      return;
    }
    
    const data = await response.json();
    
    if (data.location) {
      results.push({
        service: 'Geolocation API',
        status: 'success',
        message: 'Working correctly',
        details: `Location: ${data.location.lat}, ${data.location.lng} (accuracy: ${data.accuracy}m)`
      });
    } else {
      results.push({
        service: 'Geolocation API',
        status: 'warning',
        message: 'API responded but no location data',
        details: JSON.stringify(data)
      });
    }
  } catch (error) {
    results.push({
      service: 'Geolocation API',
      status: 'error',
      message: 'Request failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Verify Cloud Vision API configuration
 */
async function verifyCloudVisionAPI(): Promise<void> {
  console.log('\n👁️  Verifying Cloud Vision API...');
  
  const mockMode = process.env.MOCK_AI_ASSESSMENT === 'true';
  
  if (mockMode) {
    results.push({
      service: 'Cloud Vision API',
      status: 'warning',
      message: 'Running in MOCK MODE',
      details: 'Set MOCK_AI_ASSESSMENT=false in .env to use real API'
    });
    return;
  }
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!projectId) {
    results.push({
      service: 'Cloud Vision API',
      status: 'error',
      message: 'Project ID not configured',
      details: 'Set GOOGLE_CLOUD_PROJECT_ID in .env file'
    });
    return;
  }
  
  if (!credentialsPath) {
    results.push({
      service: 'Cloud Vision API',
      status: 'error',
      message: 'Credentials path not configured',
      details: 'Set GOOGLE_APPLICATION_CREDENTIALS in .env file'
    });
    return;
  }
  
  // Check if credentials file exists
  const fullPath = path.resolve(process.cwd(), credentialsPath);
  if (!fs.existsSync(fullPath)) {
    results.push({
      service: 'Cloud Vision API',
      status: 'error',
      message: 'Credentials file not found',
      details: `File not found: ${fullPath}`
    });
    return;
  }
  
  try {
    // Initialize Vision API client
    const visionClient = new ImageAnnotatorClient({
      keyFilename: credentialsPath,
    });
    
    // Test with a simple image URL (Google's logo)
    const testImageUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
    
    const [result] = await visionClient.labelDetection(testImageUrl);
    const labels = result.labelAnnotations || [];
    
    if (labels.length > 0) {
      results.push({
        service: 'Cloud Vision API',
        status: 'success',
        message: 'Working correctly',
        details: `Detected ${labels.length} labels. Top label: "${labels[0].description}" (${Math.round((labels[0].score || 0) * 100)}% confidence)`
      });
    } else {
      results.push({
        service: 'Cloud Vision API',
        status: 'warning',
        message: 'API responded but no labels detected',
        details: 'This might be normal depending on the test image'
      });
    }
  } catch (error) {
    results.push({
      service: 'Cloud Vision API',
      status: 'error',
      message: 'API request failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Print results in a formatted table
 */
function printResults(): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  results.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${result.service}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Message: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    console.log('');
    
    if (result.status === 'error') hasErrors = true;
    if (result.status === 'warning') hasWarnings = true;
  });
  
  console.log('='.repeat(80));
  
  if (hasErrors) {
    console.log('\n❌ ERRORS FOUND - Please fix the issues above before proceeding');
    console.log('📖 See GOOGLE_APIS_REAL_SETUP_GUIDE.md for setup instructions\n');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  WARNINGS FOUND - Review the warnings above');
    console.log('📖 See GOOGLE_APIS_REAL_SETUP_GUIDE.md for more information\n');
  } else {
    console.log('\n✅ ALL CHECKS PASSED - Google APIs are configured correctly!\n');
  }
}

/**
 * Main verification function
 */
async function main(): Promise<void> {
  console.log('🔍 Starting Google APIs verification...');
  console.log('This will test your API configuration without creating any cases.\n');
  
  await verifyGeolocationAPI();
  await verifyCloudVisionAPI();
  
  printResults();
}

// Run verification
main().catch((error) => {
  console.error('\n❌ Verification script failed:', error);
  process.exit(1);
});
