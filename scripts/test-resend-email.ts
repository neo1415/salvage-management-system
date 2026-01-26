import 'dotenv/config';

/**
 * Test Resend Email Integration
 * 
 * This script tests if Resend API is working correctly
 * Usage: npx tsx scripts/test-resend-email.ts your.email@example.com
 */

async function testResendEmail(toEmail: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('📧 Testing Resend Email Integration...');
  console.log(`   To: ${toEmail}`);
  console.log(`   From: ${fromEmail}`);
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  console.log('');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: 'Test Email from NEM Salvage',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email from your NEM Salvage Management System.</p>
          <p>If you received this, your email integration is working correctly!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This is a test email. You can safely ignore it.
          </p>
        `,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Resend API Error:');
      console.error(JSON.stringify(result, null, 2));
      console.log('');
      
      if (result.name === 'validation_error' && result.message?.includes('own email address')) {
        console.log('🔧 SOLUTION:');
        console.log('   Resend free tier only sends to verified email addresses.');
        console.log('');
        console.log('   Option 1: Send to your verified email (adedaniel502@gmail.com)');
        console.log('   Option 2: Verify a domain at https://resend.com/domains');
        console.log('');
        console.log('   For testing, update .env:');
        console.log('   EMAIL_FROM=adedaniel502@gmail.com');
        console.log('');
        console.log('   Then you can send to ANY email address.');
      }
      
      process.exit(1);
    }

    console.log('✅ Email sent successfully!');
    console.log('');
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log(`📧 Check your inbox at ${toEmail}`);
    console.log('   (Check spam folder if not in inbox)');
  } catch (error) {
    console.error('❌ Error sending email:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/test-resend-email.ts <email>');
  console.error('Example: npx tsx scripts/test-resend-email.ts adedaniel502@gmail.com');
  process.exit(1);
}

testResendEmail(email);
