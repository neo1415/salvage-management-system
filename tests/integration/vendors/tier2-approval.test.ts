import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import * as authHelpers from '@/lib/auth';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

/**
 * Integration tests for Tier 2 approval workflow
 * Tests the complete approval/rejection flow including notifications
 */

// Mock authentication
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// Mock notification services
vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Tier 2 Approval Workflow Integration Tests', () => {
  let testVendorUser: any;
  let testVendor: any;
  let testManager: any;

  beforeEach(async () => {
    // Clear mocks
    vi.clearAllMocks();

    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `manager-${Date.now()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'hashed_password',
        role: 'salvage_manager',
        status: 'verified_tier_1',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1985-01-01'),
      })
      .returning();

    testManager = manager;

    // Create test vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor-${Date.now()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'hashed_password',
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    testVendorUser = vendorUser;

    // Create test vendor with pending Tier 2 application
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testVendorUser.id,
        businessName: 'Test Business Ltd',
        tier: 'tier1_bvn',
        status: 'pending',
        bvnEncrypted: 'encrypted_bvn',
        bvnVerifiedAt: new Date(),
        cacNumber: 'RC123456',
        tin: 'TIN123456',
        bankAccountNumber: '0123456789',
        bankName: 'Test Bank',
        bankAccountName: 'Test Business Ltd',
        categories: ['vehicle'],
      })
      .returning();

    testVendor = vendor;

    // Mock session for manager
    vi.mocked(authHelpers.getSession).mockResolvedValue({
      user: {
        id: testManager.id,
        email: testManager.email,
        name: testManager.fullName,
        role: testManager.role,
        status: testManager.status,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  describe('POST /api/vendors/[id]/approve - Approval', () => {
    it('should approve Tier 2 application successfully', async () => {
      // Import the route handler
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
          'user-agent': 'test-agent',
        },
        body: JSON.stringify({
          action: 'approve',
          comment: 'All documents verified successfully',
        }),
      });

      // Call the route handler
      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('approved successfully');
      expect(data.data.status).toBe('approved');
      expect(data.data.tier).toBe('tier2_full');

      // Verify database updates
      const [updatedVendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, testVendor.id))
        .limit(1);

      expect(updatedVendor.status).toBe('approved');
      expect(updatedVendor.tier).toBe('tier2_full');
      expect(updatedVendor.approvedBy).toBe(testManager.id);
      expect(updatedVendor.approvedAt).toBeTruthy();

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testVendorUser.id))
        .limit(1);

      expect(updatedUser.status).toBe('verified_tier_2');

      // Verify notifications were sent
      expect(smsService.sendSMS).toHaveBeenCalledWith({
        to: testVendorUser.phone,
        message: expect.stringContaining('Congratulations'),
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: testVendorUser.email,
        subject: expect.stringContaining('Tier 2 Verification Approved'),
        html: expect.stringContaining('Tier 2 Verification Approved'),
      });
    });

    it('should reject approval without comment', async () => {
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
          // No comment provided
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Comment is required');
    });

    it('should reject non-pending vendor', async () => {
      // Update vendor to approved status
      await db
        .update(vendors)
        .set({ status: 'approved' })
        .where(eq(vendors.id, testVendor.id));

      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not in pending status');
    });
  });

  describe('POST /api/vendors/[id]/approve - Rejection', () => {
    it('should reject Tier 2 application with comment', async () => {
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const rejectionComment = 'CAC certificate is not clear. Please resubmit a higher quality scan.';

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
          'user-agent': 'test-agent',
        },
        body: JSON.stringify({
          action: 'reject',
          comment: rejectionComment,
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('rejected');
      expect(data.data.status).toBe('approved'); // Maintains Tier 1
      expect(data.data.tier).toBe('tier1_bvn');
      expect(data.data.reason).toBe(rejectionComment);

      // Verify database updates - should maintain Tier 1
      const [updatedVendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, testVendor.id))
        .limit(1);

      expect(updatedVendor.status).toBe('approved');
      expect(updatedVendor.tier).toBe('tier1_bvn');

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, testVendorUser.id))
        .limit(1);

      // User status should remain Tier 1
      expect(updatedUser.status).toBe('verified_tier_1');

      // Verify notifications were sent
      expect(smsService.sendSMS).toHaveBeenCalledWith({
        to: testVendorUser.phone,
        message: expect.stringContaining('additional information'),
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: testVendorUser.email,
        subject: expect.stringContaining('Additional Information Required'),
        html: expect.stringContaining(rejectionComment),
      });
    });

    it('should allow vendor to resubmit after rejection', async () => {
      // First, reject the application
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const rejectRequest = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
          comment: 'Please resubmit with clearer documents',
        }),
      });

      await POST(rejectRequest, { params: Promise.resolve({ id: testVendor.id }) });

      // Verify vendor can resubmit (status is approved, not suspended)
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, testVendor.id))
        .limit(1);

      expect(vendor.status).toBe('approved');
      expect(vendor.tier).toBe('tier1_bvn');

      // Vendor should be able to update and resubmit
      await db
        .update(vendors)
        .set({ status: 'pending' })
        .where(eq(vendors.id, testVendor.id));

      const [resubmittedVendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, testVendor.id))
        .limit(1);

      expect(resubmittedVendor.status).toBe('pending');
    });
  });

  describe('Authorization Tests', () => {
    it('should reject unauthorized users', async () => {
      // Mock no session
      vi.mocked(authHelpers.getSession).mockResolvedValue(null);

      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject non-manager users', async () => {
      // Create a vendor user trying to approve
      const [vendorUser] = await db
        .insert(users)
        .values({
          email: `vendor2-${Date.now()}@test.com`,
          phone: `+234${Math.floor(Math.random() * 10000000000)}`,
          passwordHash: 'hashed_password',
          role: 'vendor',
          status: 'verified_tier_1',
          fullName: 'Another Vendor',
          dateOfBirth: new Date('1990-01-01'),
        })
        .returning();

      // Mock session for vendor
      vi.mocked(authHelpers.getSession).mockResolvedValue({
        user: {
          id: vendorUser.id,
          email: vendorUser.email,
          name: vendorUser.fullName,
          role: vendorUser.role,
          status: vendorUser.status,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Only Salvage Managers');
    });
  });

  describe('Validation Tests', () => {
    it('should reject invalid action', async () => {
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invalid_action',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: testVendor.id }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should handle non-existent vendor', async () => {
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'non-existent-id' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid vendor ID format');
    });

    it('should handle valid UUID that does not exist', async () => {
      const { POST } = await import('@/app/api/vendors/[id]/approve/route');

      const nonExistentUUID = '00000000-0000-0000-0000-000000000000';

      const request = new NextRequest('http://localhost:3000/api/vendors/test/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: nonExistentUUID }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vendor not found');
    });
  });
});


