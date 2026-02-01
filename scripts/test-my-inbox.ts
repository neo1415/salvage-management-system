/**
 * Quick Email Test - Send to Your Inbox
 * 
 * This script sends a test email to adedaniel502@gmail.com to verify email delivery.
 */

import 'dotenv/config';
import { emailService } from '../src/features/notifications/services/email.service';

const MY_EMAIL = 'adedaniel502@gmail.com';

async function testMyInbox() {
  console.log('📧 Sending test email to your inbox...\n');

  if (!emailService.isConfigured()) {
    console.error('❌ Email service not configured. Check RESEND_API_KEY in .env');
    process.exit(1);
  }

  // Send welcome email
  console.log(`Sending welcome email to: ${MY_EMAIL}`);
  const welcomeResult = await emailService.sendWelcomeEmail(MY_EMAIL, 'Daniel Ade');

  if (welcomeResult.success) {
    console.log(`✅ Welcome email sent! Message ID: ${welcomeResult.messageId}`);
  } else {
    console.error(`❌ Failed: ${welcomeResult.error}`);
  }

  // Send custom test email
  console.log(`\nSending custom test email to: ${MY_EMAIL}`);
  
  const customResult = await emailService.sendEmail({
    to: MY_EMAIL,
    subject: '🎉 NEM Salvage - Email Test Successful!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #800020 0%, #a00028 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; }
            .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 10px; }
            .badge { background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .info { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✅ Email Delivery Test</h1>
            <p>NEM Insurance Salvage Management System</p>
          </div>
          <div class="content">
            <div class="badge">🎉 Email Service is Working!</div>
            
            <h2>Success!</h2>
            <p>If you're reading this, the email service is properly configured and working.</p>
            
            <div class="info">
              <strong>Test Details:</strong>
              <ul>
                <li>Sent at: ${new Date().toLocaleString()}</li>
                <li>Service: Resend Email API</li>
                <li>Recipient: ${MY_EMAIL}</li>
              </ul>
            </div>
            
            <p><strong>What's working:</strong></p>
            <ul>
              <li>✅ Email service configuration</li>
              <li>✅ API credentials validation</li>
              <li>✅ Email delivery to inbox</li>
              <li>✅ HTML email rendering</li>
            </ul>
            
            <p style="margin-top: 30px; color: #666;">
              This confirms that users will receive emails for:
            </p>
            <ul>
              <li>Welcome messages</li>
              <li>OTP verification codes</li>
              <li>Auction notifications</li>
              <li>Payment confirmations</li>
            </ul>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 14px;">
              <strong>NEM Insurance Plc</strong><br>
              199 Ikorodu Road, Obanikoro, Lagos, Nigeria
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (customResult.success) {
    console.log(`✅ Custom email sent! Message ID: ${customResult.messageId}`);
  } else {
    console.error(`❌ Failed: ${customResult.error}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📬 Check your inbox at: ' + MY_EMAIL);
  console.log('   You should have received 2 test emails!');
  console.log('='.repeat(60));
}

testMyInbox().catch(console.error);
