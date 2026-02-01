/**
 * Test Email Templates Script
 * Tests all email templates with sample data
 */

import { emailService } from '../src/features/notifications/services/email.service';

async function testEmailTemplates() {
  console.log('🧪 Testing Email Templates...\n');

  // Test 1: Welcome Email
  console.log('1️⃣ Testing Welcome Email...');
  const welcomeResult = await emailService.sendWelcomeEmail(
    'test@example.com',
    'John Doe'
  );
  console.log(`   Result: ${welcomeResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!welcomeResult.success) {
    console.log(`   Error: ${welcomeResult.error}`);
  }
  console.log();

  // Test 2: OTP Email
  console.log('2️⃣ Testing OTP Email...');
  const otpResult = await emailService.sendOTPEmail(
    'test@example.com',
    'John Doe',
    '123456',
    5
  );
  console.log(`   Result: ${otpResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!otpResult.success) {
    console.log(`   Error: ${otpResult.error}`);
  }
  console.log();

  // Test 3: Case Approval Email
  console.log('3️⃣ Testing Case Approval Email...');
  const caseApprovalResult = await emailService.sendCaseApprovalEmail(
    'adjuster@example.com',
    {
      adjusterName: 'John Adjuster',
      caseId: 'CASE-001',
      claimReference: 'CLM-2024-001',
      assetType: 'Vehicle',
      status: 'approved',
      managerName: 'Jane Manager',
      appUrl: 'https://salvage.nem-insurance.com',
    }
  );
  console.log(`   Result: ${caseApprovalResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!caseApprovalResult.success) {
    console.log(`   Error: ${caseApprovalResult.error}`);
  }
  console.log();

  // Test 4: Auction Start Email
  console.log('4️⃣ Testing Auction Start Email...');
  const auctionStartResult = await emailService.sendAuctionStartEmail(
    'vendor@example.com',
    {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetType: 'Vehicle',
      assetName: '2020 Toyota Camry',
      reservePrice: 500000,
      startTime: 'January 15, 2024 10:00 AM',
      endTime: 'January 16, 2024 10:00 AM',
      location: 'Lagos, Nigeria',
      appUrl: 'https://salvage.nem-insurance.com',
    }
  );
  console.log(`   Result: ${auctionStartResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!auctionStartResult.success) {
    console.log(`   Error: ${auctionStartResult.error}`);
  }
  console.log();

  // Test 5: Bid Alert Email (Outbid)
  console.log('5️⃣ Testing Bid Alert Email (Outbid)...');
  const bidAlertResult = await emailService.sendBidAlertEmail(
    'vendor@example.com',
    {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetName: '2020 Toyota Camry',
      alertType: 'outbid',
      yourBid: 500000,
      currentBid: 550000,
      timeRemaining: '2 hours',
      appUrl: 'https://salvage.nem-insurance.com',
    }
  );
  console.log(`   Result: ${bidAlertResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!bidAlertResult.success) {
    console.log(`   Error: ${bidAlertResult.error}`);
  }
  console.log();

  // Test 6: Bid Alert Email (Won)
  console.log('6️⃣ Testing Bid Alert Email (Won)...');
  const bidWonResult = await emailService.sendBidAlertEmail(
    'vendor@example.com',
    {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetName: '2020 Toyota Camry',
      alertType: 'won',
      yourBid: 550000,
      appUrl: 'https://salvage.nem-insurance.com',
    }
  );
  console.log(`   Result: ${bidWonResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!bidWonResult.success) {
    console.log(`   Error: ${bidWonResult.error}`);
  }
  console.log();

  // Test 7: Payment Confirmation Email
  console.log('7️⃣ Testing Payment Confirmation Email...');
  const paymentResult = await emailService.sendPaymentConfirmationEmail(
    'vendor@example.com',
    {
      vendorName: 'Vendor Company',
      auctionId: 'AUC-001',
      assetName: '2020 Toyota Camry',
      paymentAmount: 550000,
      paymentMethod: 'Paystack',
      paymentReference: 'PAY-REF-001',
      pickupAuthCode: 'AUTH-123456',
      pickupLocation: 'NEM Insurance Warehouse, Lagos',
      pickupDeadline: 'January 20, 2024',
      appUrl: 'https://salvage.nem-insurance.com',
    }
  );
  console.log(`   Result: ${paymentResult.success ? '✅ Success' : '❌ Failed'}`);
  if (!paymentResult.success) {
    console.log(`   Error: ${paymentResult.error}`);
  }
  console.log();

  console.log('✅ All email template tests completed!');
  console.log('\n📝 Note: If RESEND_API_KEY is not configured, emails will not be sent but templates will be validated.');
}

// Run tests
testEmailTemplates().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
