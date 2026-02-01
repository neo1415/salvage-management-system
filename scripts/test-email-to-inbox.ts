/**
 * Test Email Delivery to Inbox
 * 
 * This script tests that emails are actually delivered to the configured email addresses.
 * It sends test emails to both verified addresses and confirms delivery.
 */

import 'dotenv/config';
import { emailService } from '../src/features/notifications/services/email.service';

const VERIFIED_EMAILS = [
  'adedaniel502@gmail.com',
  'adetimilehin502@gmail.com',
];

async function testEmailDelivery() {
  console.log('🧪 Testing Email Delivery to Inbox\n');
  console.log('=' .repeat(60));

  // Check if email service is configured
  if (!emailService.isConfigured()) {
    console.error('❌ Email service is not configured!');
    console.error('   Please set RESEND_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('✅ Email service is configured\n');

  // Test sending welcome emails to both addresses
  for (const email of VERIFIED_EMAILS) {
    console.log(`\n📧 Sending test welcome email to: ${email}`);
    console.log('-'.repeat(60));

    try {
      const result = await emailService.sendWelcomeEmail(
        email,
        'Test User'
      );

      if (result.success) {
        console.log(`✅ Email sent successfully!`);
        console.log(`   Message ID: ${result.messageId}`);
        console.log(`   📬 Check your inbox at: ${email}`);
      } else {
        console.error(`❌ Failed to send email`);
        console.error(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Exception occurred:`, error);
    }
  }

  // Test sending custom email
  console.log('\n\n📧 Sending custom test email to both addresses');
  console.log('-'.repeat(60));

  const customHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #800020;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .success-badge {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            display: inline-block;
            margin: 20px 0;
          }
          .info-box {
            background-color: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Email Delivery Test</h1>
        </div>
        <div class="content">
          <h2>Success! Your email is working!</h2>
          
          <div class="success-badge">
            🎉 Email Service is Operational
          </div>
          
          <div class="info-box">
            <strong>Test Details:</strong>
            <ul>
              <li>Sent at: ${new Date().toLocaleString()}</li>
              <li>Service: Resend Email API</li>
              <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
            </ul>
          </div>
          
          <p>This is a test email to confirm that the NEM Insurance Salvage Management System can successfully deliver emails to your inbox.</p>
          
          <p><strong>What this means:</strong></p>
          <ul>
            <li>✅ Email service is properly configured</li>
            <li>✅ API credentials are valid</li>
            <li>✅ Emails will be delivered to users</li>
          </ul>
          
          <p style="margin-top: 30px;">
            <strong>Next Steps:</strong><br>
            You can now confidently use the email service for:
          </p>
          <ul>
            <li>Welcome emails for new users</li>
            <li>OTP verification codes</li>
            <li>Auction notifications</li>
            <li>Payment confirmations</li>
          </ul>
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            If you received this email, the test was successful! 🎊
          </p>
        </div>
      </body>
    </html>
  `;

  for (const email of VERIFIED_EMAILS) {
    try {
      const result = await emailService.sendEmail({
        to: email,
        subject: '✅ NEM Salvage System - Email Test Successful',
        html: customHtml,
        replyTo: 'nemsupport@nem-insurance.com',
      });

      if (result.success) {
        console.log(`✅ Custom email sent to ${email}`);
        console.log(`   Message ID: ${result.messageId}`);
      } else {
        console.error(`❌ Failed to send custom email to ${email}`);
        console.error(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Exception for ${email}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📬 Test Complete! Check your inbox for the test emails.');
  console.log('   If you received the emails, the service is working correctly!');
  console.log('='.repeat(60));
}

// Run the test
testEmailDelivery().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
