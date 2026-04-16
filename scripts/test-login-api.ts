/**
 * Test Login API Directly
 */

async function testLogin() {
  console.log('Testing login API...\n');

  try {
    const response = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        emailOrPhone: 'vendor-e2e@test.com',
        password: 'Test123!@#',
        redirect: 'false',
        json: 'true',
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);

    if (response.ok) {
      console.log('\n✅ Login successful!');
    } else {
      console.log('\n❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLogin();
