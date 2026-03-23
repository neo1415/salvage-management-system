/**
 * Integration Test: Pickup Reminder Notifications
 * 
 * Tests the pickup reminder cron job that sends SMS reminders
 * 24 hours before the pickup deadline (48 hours from payment verification)
 * 
 * Validates Task 6.3:
 * - 6.3.1: Create cron job to check pickup deadlines
 * - 6.3.2: Send reminder SMS 24 hours before deadline
 * - 6.3.3: Write integration tests for reminders
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendPickupReminders } from '@/lib/cron/pickup-reminders';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { smsService } from '@/features/notifications/services/sms.service';

// Mock SMS service
vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Integration Test: Pickup Reminder Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send reminder SMS 24 hours before pickup deadline', async () => {
    // Arrange: Create test data
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: 'vendor@example.com',
        phone: '+2348012345678',
        passwordHash: 'hashed_password',
        fullName: 'John Doe',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    // Create vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: 'Test Vendor',
        status: 'approved',
      })
      .returning();

    // Create salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-001',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2020,
        status: 'sold',
        locationName: 'Lagos Salvage Yard',
      })
      .returning();

    // Create auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: salvageCase.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '500000',
        currentBidder: vendor.id,
        status: 'closed',
        pickupConfirmedVendor: false, // Not confirmed yet
      })
      .returning();

    // Create payment verified 24 hours ago
    await db.insert(payments).values({
      auctionId: auction.id,
      vendorId: vendor.id,
      amount: '500000',
      paymentMethod: 'escrow_wallet',
      escrowStatus: 'released',
      status: 'verified',
      verifiedAt: twentyFourHoursAgo,
      paymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      paymentReference: 'AUTH-ABC123',
    });

    // Act: Run the cron job
    const result = await sendPickupReminders();

    // Assert: Reminder was sent
    expect(result.remindersSent).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Assert: SMS was sent with correct content
    expect(smsService.sendSMS).toHaveBeenCalledTimes(1);
    const smsCall = vi.mocked(smsService.sendSMS).mock.calls[0][0];
    expect(smsCall.to).toBe('+2348012345678');
    expect(smsCall.message).toContain('Reminder');
    expect(smsCall.message).toContain('AUTH-ABC123');
    expect(smsCall.message).toContain('Lagos Salvage Yard');
    expect(smsCall.userId).toBe(user.id);
  });

  it('should not send reminder if vendor already confirmed pickup', async () => {
    // Arrange: Create test data with pickup confirmed
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [user] = await db
      .insert(users)
      .values({
        email: 'vendor2@example.com',
        phone: '+2348012345679',
        passwordHash: 'hashed_password',
        fullName: 'Jane Smith',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: 'Test Vendor 2',
        status: 'approved',
      })
      .returning();

    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-002',
        vehicleMake: 'Honda',
        vehicleModel: 'Accord',
        vehicleYear: 2019,
        status: 'sold',
        locationName: 'Abuja Salvage Yard',
      })
      .returning();

    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: salvageCase.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '600000',
        currentBidder: vendor.id,
        status: 'closed',
        pickupConfirmedVendor: true, // Already confirmed
        pickupConfirmedVendorAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      })
      .returning();

    await db.insert(payments).values({
      auctionId: auction.id,
      vendorId: vendor.id,
      amount: '600000',
      paymentMethod: 'paystack',
      status: 'verified',
      verifiedAt: twentyFourHoursAgo,
      paymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      paymentReference: 'AUTH-XYZ789',
    });

    // Act: Run the cron job
    const result = await sendPickupReminders();

    // Assert: No reminder was sent
    expect(result.remindersSent).toBe(0);
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });

  it('should not send reminder if payment was verified outside 24-hour window', async () => {
    // Arrange: Create test data with payment verified 30 hours ago
    const now = new Date();
    const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);

    const [user] = await db
      .insert(users)
      .values({
        email: 'vendor3@example.com',
        phone: '+2348012345680',
        passwordHash: 'hashed_password',
        fullName: 'Bob Johnson',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: 'Test Vendor 3',
        status: 'approved',
      })
      .returning();

    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-003',
        vehicleMake: 'Ford',
        vehicleModel: 'Focus',
        vehicleYear: 2018,
        status: 'sold',
      })
      .returning();

    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: salvageCase.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '400000',
        currentBidder: vendor.id,
        status: 'closed',
        pickupConfirmedVendor: false,
      })
      .returning();

    await db.insert(payments).values({
      auctionId: auction.id,
      vendorId: vendor.id,
      amount: '400000',
      paymentMethod: 'bank_transfer',
      status: 'verified',
      verifiedAt: thirtyHoursAgo, // Outside 23-25 hour window
      paymentDeadline: new Date(now.getTime() + 18 * 60 * 60 * 1000),
    });

    // Act: Run the cron job
    const result = await sendPickupReminders();

    // Assert: No reminder was sent
    expect(result.remindersSent).toBe(0);
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });

  it('should handle multiple payments needing reminders', async () => {
    // Arrange: Create multiple test payments
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Create first vendor
    const [user1] = await db
      .insert(users)
      .values({
        email: 'vendor4@example.com',
        phone: '+2348012345681',
        passwordHash: 'hashed_password',
        fullName: 'Alice Williams',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    const [vendor1] = await db
      .insert(vendors)
      .values({
        userId: user1.id,
        businessName: 'Test Vendor 4',
        status: 'approved',
      })
      .returning();

    const [case1] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-004',
        vehicleMake: 'Nissan',
        vehicleModel: 'Altima',
        vehicleYear: 2021,
        status: 'sold',
      })
      .returning();

    const [auction1] = await db
      .insert(auctions)
      .values({
        caseId: case1.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '550000',
        currentBidder: vendor1.id,
        status: 'closed',
        pickupConfirmedVendor: false,
      })
      .returning();

    await db.insert(payments).values({
      auctionId: auction1.id,
      vendorId: vendor1.id,
      amount: '550000',
      paymentMethod: 'escrow_wallet',
      escrowStatus: 'released',
      status: 'verified',
      verifiedAt: twentyFourHoursAgo,
      paymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    // Create second vendor
    const [user2] = await db
      .insert(users)
      .values({
        email: 'vendor5@example.com',
        phone: '+2348012345682',
        passwordHash: 'hashed_password',
        fullName: 'Charlie Brown',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    const [vendor2] = await db
      .insert(vendors)
      .values({
        userId: user2.id,
        businessName: 'Test Vendor 5',
        status: 'approved',
      })
      .returning();

    const [case2] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-005',
        vehicleMake: 'Mazda',
        vehicleModel: 'CX-5',
        vehicleYear: 2020,
        status: 'sold',
      })
      .returning();

    const [auction2] = await db
      .insert(auctions)
      .values({
        caseId: case2.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '650000',
        currentBidder: vendor2.id,
        status: 'closed',
        pickupConfirmedVendor: false,
      })
      .returning();

    await db.insert(payments).values({
      auctionId: auction2.id,
      vendorId: vendor2.id,
      amount: '650000',
      paymentMethod: 'paystack',
      status: 'verified',
      verifiedAt: twentyFourHoursAgo,
      paymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    // Act: Run the cron job
    const result = await sendPickupReminders();

    // Assert: Both reminders were sent
    expect(result.remindersSent).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(smsService.sendSMS).toHaveBeenCalledTimes(2);
  });

  it('should handle SMS sending errors gracefully', async () => {
    // Arrange: Mock SMS service to fail
    vi.mocked(smsService.sendSMS).mockRejectedValueOnce(new Error('SMS service unavailable'));

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [user] = await db
      .insert(users)
      .values({
        email: 'vendor6@example.com',
        phone: '+2348012345683',
        passwordHash: 'hashed_password',
        fullName: 'David Miller',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: 'Test Vendor 6',
        status: 'approved',
      })
      .returning();

    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-006',
        vehicleMake: 'Chevrolet',
        vehicleModel: 'Malibu',
        vehicleYear: 2019,
        status: 'sold',
      })
      .returning();

    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: salvageCase.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '450000',
        currentBidder: vendor.id,
        status: 'closed',
        pickupConfirmedVendor: false,
      })
      .returning();

    await db.insert(payments).values({
      auctionId: auction.id,
      vendorId: vendor.id,
      amount: '450000',
      paymentMethod: 'escrow_wallet',
      escrowStatus: 'released',
      status: 'verified',
      verifiedAt: twentyFourHoursAgo,
      paymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    // Act: Run the cron job
    const result = await sendPickupReminders();

    // Assert: Error was recorded but job didn't crash
    expect(result.remindersSent).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('SMS service unavailable');
  });

  it('should use correct pickup deadline format in SMS', async () => {
    // Arrange
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [user] = await db
      .insert(users)
      .values({
        email: 'vendor7@example.com',
        phone: '+2348012345684',
        passwordHash: 'hashed_password',
        fullName: 'Emma Davis',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
      })
      .returning();

    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: 'Test Vendor 7',
        status: 'approved',
      })
      .returning();

    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        caseNumber: 'CASE-007',
        vehicleMake: 'Hyundai',
        vehicleModel: 'Elantra',
        vehicleYear: 2020,
        status: 'sold',
        locationName: 'Port Harcourt Salvage Yard',
      })
      .returning();

    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: salvageCase.id,
        startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        originalEndTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        currentBid: '520000',
        currentBidder: vendor.id,
        status: 'closed',
        pickupConfirmedVendor: false,
      })
      .returning();

    await db.insert(payments).values({
      auctionId: auction.id,
      vendorId: vendor.id,
      amount: '520000',
      paymentMethod: 'escrow_wallet',
      escrowStatus: 'released',
      status: 'verified',
      verifiedAt: twentyFourHoursAgo,
      paymentDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      paymentReference: 'AUTH-TEST123',
    });

    // Act
    const result = await sendPickupReminders();

    // Assert: SMS contains properly formatted deadline
    expect(result.remindersSent).toBe(1);
    const smsCall = vi.mocked(smsService.sendSMS).mock.calls[0][0];
    
    // Deadline should be 48 hours from verification (24 hours from now)
    const expectedDeadline = new Date(twentyFourHoursAgo.getTime() + 48 * 60 * 60 * 1000);
    
    // Check that message contains key components
    expect(smsCall.message).toContain('Reminder');
    expect(smsCall.message).toContain('AUTH-TEST123');
    expect(smsCall.message).toContain('Port Harcourt Salvage Yard');
    
    // Verify deadline is approximately correct (within the message)
    // The exact format depends on locale, but should contain date elements
    expect(smsCall.message).toMatch(/\d{1,2}:\d{2}/); // Time format
  });
});
