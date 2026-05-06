/**
 * Setup KYC Supabase Bucket
 * 
 * This script creates the 'kyc-documents' bucket in Supabase Storage
 * if it doesn't already exist.
 * 
 * Usage:
 *   npx tsx scripts/setup-kyc-supabase-bucket.ts
 */

import { config } from 'dotenv';
import { getDocumentUploadService } from '../src/features/kyc/services/document-upload.service';

// Load environment variables
config();

async function setupBucket() {
  console.log('🔧 Setting up KYC Supabase bucket...\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration:');
    if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL is not set');
    if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY is not set');
    console.error('\nPlease add these to your .env file');
    process.exit(1);
  }

  console.log('✅ Supabase configuration found');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
  console.log('');

  try {
    const uploadService = getDocumentUploadService();
    
    console.log('📦 Creating/verifying kyc-documents bucket...');
    await uploadService.ensureBucketExists();
    
    console.log('✅ Bucket setup complete!');
    console.log('');
    console.log('The kyc-documents bucket is now ready for use.');
    console.log('Configuration:');
    console.log('  - Bucket name: kyc-documents');
    console.log('  - Access: Private (requires authentication)');
    console.log('  - Max file size: 5MB');
    console.log('  - Allowed types: JPEG, PNG, WebP, PDF');
    
  } catch (error) {
    console.error('❌ Failed to setup bucket:', error);
    process.exit(1);
  }
}

setupBucket();
