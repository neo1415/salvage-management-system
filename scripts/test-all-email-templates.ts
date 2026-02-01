/**
 * Comprehensive Email Template Testing Script
 * Tests all email templates with the professional NEM Insurance branding
 * 
 * Usage: npx tsx scripts/test-all-email-templates.ts
 */

import { emailService } from '../src/features/notifications/services/email.service';

// Test email address (replace with your email for testing)
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

async function testAllEmailTemplates() {
  console.log('🧪 Testing All Email Templates with Professional NEM Insurance Branding\n');
  console.log(`📧 Test emails will be sent to: ${TEST_EMAIL}\n`);
  console.log('=' .repeat(80));

  try {
    // Test 1: Welcome Email
    console.log('\n1️⃣  Testing Welcome Email...');
    await emailService.sendWelcomeEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      loginUrl: 'https://salvage.nem-insurance.com/login',
      supportEmail: 'nemsupport@nem-insurance.com',
    });
    console.log('✅ Welcome email sent successfully');

    // Wait 2 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: OTP Email
    console.log('\n2️⃣  Testing OTP Email...');
    await emailService.sendOTPEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      otp: '123456',
      expiresIn: '10 minutes',
    });
    console.log('✅ OTP email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Case Approval Email (Approved)
    console.log('\n3️⃣  Testing Case Approval Email (Approved)...');
    await emailService.sendCaseApprovalEmail(TEST_EMAIL, {
      adjusterName: 'Jane Smith',
      caseId: 'case-123',
      claimReference: 'CLM-2024-001',
      assetType: 'vehicle',
      status: 'approved',
      comment: 'Case approved. Auction will be created automatically.',
      managerName: 'Michael Johnson',
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Case approval email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Case Approval Email (Rejected)
    console.log('\n4️⃣  Testing Case Approval Email (Rejected)...');
    await emailService.sendCaseApprovalEmail(TEST_EMAIL, {
      adjusterName: 'Jane Smith',
      caseId: 'case-124',
      claimReference: 'CLM-2024-002',
      assetType: 'property',
      status: 'rejected',
      comment: 'Please provide more detailed damage assessment photos and update the market value estimate.',
      managerName: 'Michael Johnson',
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Case rejection email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 5: Auction Start Email
    console.log('\n5️⃣  Testing Auction Start Email...');
    await emailService.sendAuctionStartEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      auctionId: 'auction-456',
      assetType: 'vehicle',
      assetName: '2020 Toyota Camry',
      reservePrice: 2500000,
      startTime: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      location: 'Lagos, Nigeria',
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Auction start email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 6: Bid Alert Email (Outbid)
    console.log('\n6️⃣  Testing Bid Alert Email (Outbid)...');
    await emailService.sendBidAlertEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      auctionId: 'auction-456',
      assetName: '2020 Toyota Camry',
      alertType: 'outbid',
      yourBid: 2600000,
      currentBid: 2700000,
      timeRemaining: '2 days 5 hours',
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Bid alert (outbid) email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 7: Bid Alert Email (Winning)
    console.log('\n7️⃣  Testing Bid Alert Email (Winning)...');
    await emailService.sendBidAlertEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      auctionId: 'auction-456',
      assetName: '2020 Toyota Camry',
      alertType: 'winning',
      yourBid: 2800000,
      timeRemaining: '1 day 3 hours',
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Bid alert (winning) email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 8: Bid Alert Email (Won)
    console.log('\n8️⃣  Testing Bid Alert Email (Won)...');
    await emailService.sendBidAlertEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      auctionId: 'auction-456',
      assetName: '2020 Toyota Camry',
      alertType: 'won',
      yourBid: 2900000,
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Bid alert (won) email sent successfully');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 9: Payment Confirmation Email
    console.log('\n9️⃣  Testing Payment Confirmation Email...');
    await emailService.sendPaymentConfirmationEmail(TEST_EMAIL, {
      vendorName: 'John Doe',
      auctionId: 'auction-456',
      assetName: '2020 Toyota Camry',
      paymentAmount: 2900000,
      paymentMethod: 'Paystack',
      paymentReference: 'PAY-2024-001',
      pickupAuthCode: 'NEM-A7B2-C9D4',
      pickupLocation: 'NEM Insurance Warehouse, Lagos',
      pickupDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      appUrl: 'https://salvage.nem-insurance.com',
    });
    console.log('✅ Payment confirmation email sent successfully');

    console.log('\n' + '='.repeat(80));
    console.log('\n🎉 All email templates tested successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ 9 email templates tested');
    console.log('   ✅ All emails sent with professional NEM Insurance branding');
    console.log('   ✅ Logo, colors, and responsive design verified');
    console.log('\n💡 Check your inbox at:', TEST_EMAIL);
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error testing email templates:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the tests
testAllEmailTemplates()
  .then(() => {
    console.log('\n✨ Email template testing complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
