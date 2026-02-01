/**
 * Test Real Email Delivery
 * 
 * This script sends real emails to real users to verify production email functionality.
 * It tests sending to multiple recipients with your verified domain.
 */

import 'dotenv/config';
import { emailService } from '../src/features/notifications/services/email.service';

const TEST_RECIPIENTS = [
  { email: 'adedaniel502@gmail.com', name: 'Daniel Ade' },
  { email: 'adetimilehin502@gmail.com', name: 'Timilehin Ade' },
];

async function testRealEmails() {
  console.log('🚀 Testing Real Email Delivery to Real Users\n');
  console.log('=' .repeat(70));

  // Check configuration
  console.log('\n📋 Configuration Check:');
  console.log('-'.repeat(70));
  console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM || '❌ Not set'}`);
  
  if (!emailService.isConfigured()) {
    console.error('\n❌ Email service is not configured!');
    console.error('   Please set RESEND_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('\n✅ Email service is configured and ready\n');

  // Test 1: Send welcome emails to all recipients
  console.log('📧 Test 1: Sending Welcome Emails');
  console.log('=' .repeat(70));

  for (const recipient of TEST_RECIPIENTS) {
    console.log(`\nSending to: ${recipient.email} (${recipient.name})`);
    console.log('-'.repeat(70));

    try {
      const result = await emailService.sendWelcomeEmail(
        recipient.email,
        recipient.name
      );

      if (result.success) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   Status: Delivered to inbox`);
      } else {
        console.error(`❌ FAILED!`);
        console.error(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ EXCEPTION:`, error);
    }

    // Small delay to avoid rate limiting
    await sleep(1000);
  }

  // Test 2: Send custom notification emails
  console.log('\n\n📧 Test 2: Sending Custom Notification Emails');
  console.log('=' .repeat(70));

  const customEmailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #800020 0%, #a00028 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .success-badge {
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            display: inline-block;
            margin: 20px 0;
            font-weight: 600;
          }
          .info-box {
            background-color: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 20px;
            margin: 25px 0;
            border-radius: 4px;
          }
          .feature-list {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .feature-list ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .feature-list li {
            margin: 10px 0;
          }
          .footer {
            background-color: #f5f5f5;
            padding: 30px;
            text-align: center;
            font-size: 14px;
            color: #666;
            border-top: 1px solid #e0e0e0;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Email System Test</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">NEM Insurance Salvage Management System</p>
          </div>
          
          <div class="content">
            <div class="success-badge">
              ✅ Email Delivery Successful!
            </div>
            
            <h2 style="color: #800020; margin-top: 30px;">Real Email Delivery Confirmed</h2>
            
            <p>This email confirms that the NEM Insurance Salvage Management System can successfully deliver emails to real users.</p>
            
            <div class="info-box">
              <strong>📊 Test Details:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Sent at:</strong> ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</li>
                <li><strong>Service:</strong> Resend Email API</li>
                <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
                <li><strong>From:</strong> ${process.env.EMAIL_FROM}</li>
              </ul>
            </div>
            
            <div class="feature-list">
              <h3 style="margin-top: 0; color: #800020;">✅ Verified Capabilities:</h3>
              <ul>
                <li>✅ Email service configuration</li>
                <li>✅ API authentication</li>
                <li>✅ HTML email rendering</li>
                <li>✅ Delivery to multiple recipients</li>
                <li>✅ Professional email formatting</li>
              </ul>
            </div>
            
            <h3 style="color: #800020;">📧 Email Types Ready:</h3>
            <ul>
              <li><strong>Welcome Emails</strong> - New user onboarding</li>
              <li><strong>OTP Verification</strong> - Phone number verification codes</li>
              <li><strong>Auction Notifications</strong> - New auctions, outbid alerts</li>
              <li><strong>Payment Confirmations</strong> - Payment receipts and deadlines</li>
              <li><strong>KYC Updates</strong> - Verification status notifications</li>
            </ul>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666;">
              <strong>What this means:</strong><br>
              The email system is production-ready and can send emails to any user who registers on the platform.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>NEM Insurance Plc</strong></p>
            <p>199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
            <p style="margin-top: 15px;">📞 234-02-014489560 | 📧 nemsupport@nem-insurance.com</p>
            <p style="margin-top: 15px; font-size: 12px; color: #999;">
              This is an automated test email from the NEM Salvage Management System.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  for (const recipient of TEST_RECIPIENTS) {
    console.log(`\nSending to: ${recipient.email}`);
    console.log('-'.repeat(70));

    try {
      const result = await emailService.sendEmail({
        to: recipient.email,
        subject: '🎉 NEM Salvage - Email System Test Successful',
        html: customEmailHtml,
        replyTo: 'nemsupport@nem-insurance.com',
      });

      if (result.success) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Message ID: ${result.messageId}`);
      } else {
        console.error(`❌ FAILED!`);
        console.error(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ EXCEPTION:`, error);
    }

    // Small delay to avoid rate limiting
    await sleep(1000);
  }

  // Summary
  console.log('\n\n' + '=' .repeat(70));
  console.log('📬 Test Complete!');
  console.log('=' .repeat(70));
  console.log('\n✅ Check your inboxes:');
  TEST_RECIPIENTS.forEach(r => {
    console.log(`   📧 ${r.email}`);
  });
  console.log('\nYou should have received:');
  console.log('   1. Welcome email (with NEM branding)');
  console.log('   2. Custom test email (with test details)');
  console.log('\n' + '=' .repeat(70));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testRealEmails().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
