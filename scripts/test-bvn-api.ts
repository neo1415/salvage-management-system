/**
 * Test BVN Verification API
 * 
 * This script tests the BVN verification endpoint to debug the 400 error
 */

async function testBVNAPI() {
  const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  console.log('Testing BVN Verification API...\n');
  
  // Test data
  const testData = {
    bvn: '12345678901',
    dateOfBirth: '1990-01-01',
  };
  
  console.log('Request data:', testData);
  console.log('API URL:', `${API_URL}/api/vendors/verify-bvn`);
  console.log('\nSending request...\n');
  
  try {
    const response = await fetch(`${API_URL}/api/vendors/verify-bvn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse body:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.log('\n❌ Request failed with status:', response.status);
      console.log('Error:', data.error);
      console.log('Message:', data.message);
    } else {
      console.log('\n✅ Request successful!');
    }
  } catch (error) {
    console.error('\n❌ Request error:', error);
  }
}

testBVNAPI();
