/**
 * SMS Service Integration Tests
 * 
 * These tests make REAL API calls to Termii and Africa's Talking.
 * They will cost money and should only be run when needed.
 * 
 * To run these tests:
 * npm run test:integration -- tests/integration/notifications/sms.integration.test.ts
 * 
 * Requirements: 40, Enterprise Standards Section 7
 */

import { describe, it, expect } from 'vitest';
import { SMSService } from '@/features/notifications/services/sms.service';

// Skip these tests by default to avoid costs
// Remove .skip to run them when you want to test with real APIs
describe.skip('SMSService - Integration Tests (Real APIs)', () => {
  const smsService = new SMSService();

  // Use a verified test number from the service
  const TEST_PHONE = '2348141252812'; // This is in the verified list

  it('should send real SMS via Termii', async () => {
    const result = await smsService.sendSMS({
      to: TEST_PHONE,
      message: 'Integration test message from Termii',
    });

    console.log('Termii result:', result);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toContain('termii');
  }, 30000); // 30 second timeout

  it('should send OTP via real API', async () => {
    const result = await smsService.sendOTP(
      TEST_PHONE,
      '123456',
      'test-user-id'
    );

    console.log('OTP result:', result);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 30000);

  it('should send auction ending alert via real API', async () => {
    const result = await smsService.sendAuctionEndingSoon(
      TEST_PHONE,
      'Toyota Camry 2020',
      '30 minutes',
      'test-user-id'
    );

    console.log('Auction alert result:', result);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 30000);

  it('should send outbid alert via real API', async () => {
    const result = await smsService.sendOutbidAlert(
      TEST_PHONE,
      'Toyota Camry 2020',
      '₦500,000',
      'test-user-id'
    );

    console.log('Outbid alert result:', result);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 30000);

  it('should send payment reminder via real API', async () => {
    const result = await smsService.sendPaymentReminder(
      TEST_PHONE,
      'Toyota Camry 2020',
      '₦500,000',
      'tomorrow 5pm',
      'test-user-id'
    );

    console.log('Payment reminder result:', result);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 30000);

  it('should send pickup authorization via real API', async () => {
    const result = await smsService.sendPickupAuthorization(
      TEST_PHONE,
      'AUTH-12345',
      'Toyota Camry 2020',
      'test-user-id'
    );

    console.log('Pickup authorization result:', result);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 30000);

  it('should handle invalid phone number gracefully', async () => {
    const result = await smsService.sendSMS({
      to: '123', // Invalid
      message: 'Test message',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid Nigerian phone number format');
  });

  it('should verify service is configured', () => {
    expect(smsService.isConfigured()).toBe(true);
  });
});

// Tests that can run without making API calls
describe('SMSService - Integration Tests (No API Calls)', () => {
  const smsService = new SMSService();

  it('should normalize phone numbers correctly', async () => {
    // This won't actually send because the number is not in verified list
    const result = await smsService.sendSMS({
      to: '08099999999', // Not in verified list
      message: 'Test message',
    });

    // Should return success (test mode blocked) without making API call
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-mode-blocked');
  });

  it('should validate required fields', async () => {
    const result = await smsService.sendSMS({
      to: '',
      message: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should check configuration status', () => {
    const isConfigured = smsService.isConfigured();
    console.log('SMS Service configured:', isConfigured);
    expect(typeof isConfigured).toBe('boolean');
  });
});
