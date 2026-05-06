import 'dotenv/config';

async function testVendorsAPI() {
  try {
    console.log('🔍 Testing Vendors API KYC Status...\n');

    const vendorId = 'fb12a54e-1a81-4d6c-aec8-054218d38458';
    const url = `http://localhost:3000/api/vendors?tier=tier1_bvn&page=1&pageSize=50`;

    console.log(`📡 Fetching: ${url}\n`);

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success || !data.data) {
      console.error('❌ API returned error:', data);
      return;
    }

    const vendor = data.data.find((v: any) => v.id === vendorId);

    if (!vendor) {
      console.error('❌ Vendor not found in API response');
      return;
    }

    console.log('📋 Vendor Data from API:');
    console.log('   ID:', vendor.id);
    console.log('   Business Name:', vendor.businessName);
    console.log('   KYC Status:', vendor.kycStatus);
    console.log('   Tier:', vendor.tier);
    console.log('   Status:', vendor.status);
    console.log('   Tier 2 Submitted At:', vendor.tier2SubmittedAt);
    console.log('   Tier 2 Approved At:', vendor.tier2ApprovedAt);
    console.log('   Tier 2 Rejection Reason:', vendor.tier2RejectionReason);
    console.log('\n✅ Test complete');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testVendorsAPI();
