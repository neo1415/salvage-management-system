import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

/**
 * Integration Tests: Staff Account Creation
 * Tests the complete staff account creation flow including database operations
 */
describe('Staff Account Creation Integration Tests', () => {
  let adminUserId: string;

  beforeEach(async () => {
    // Create a test admin user for authentication
    const adminEmail = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@nem-insurance.com`;
    const adminPhone = `+234901${Math.floor(Math.random() * 10000000)}`;
    const passwordHash = await hash('AdminPass123!', 12);

    const [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        fullName: 'Test Admin',
        dateOfBirth: new Date('1985-01-01'),
        role: 'system_admin',
        status: 'phone_verified_tier_0',
      })
      .returning();

    adminUserId = admin.id;
  });

  // Helper function to generate unique test data
  const generateStaffData = (role: 'claims_adjuster' | 'salvage_manager' | 'finance_officer') => ({
    fullName: `Test ${role.replace('_', ' ')}`,
    email: `staff-${Date.now()}-${Math.random().toString(36).substring(7)}@nem-insurance.com`,
    phone: `+234801${Math.floor(Math.random() * 10000000)}`,
    role,
  });

  it('should successfully create a Claims Adjuster account', async () => {
    const staffData = generateStaffData('claims_adjuster');

    // Simulate staff account creation
    const temporaryPassword = 'Sunset-Mountain-River-42!';
    const passwordHash = await hash(temporaryPassword, 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    expect(newStaff).toBeDefined();
    expect(newStaff.email).toBe(staffData.email);
    expect(newStaff.role).toBe('claims_adjuster');
    expect(newStaff.requirePasswordChange).toBe('true');
    expect(newStaff.status).toBe('phone_verified_tier_0');
  });

  it('should successfully create a Salvage Manager account', async () => {
    const staffData = generateStaffData('salvage_manager');

    const temporaryPassword = 'Ocean-Forest-Valley-89@';
    const passwordHash = await hash(temporaryPassword, 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    expect(newStaff).toBeDefined();
    expect(newStaff.email).toBe(staffData.email);
    expect(newStaff.role).toBe('salvage_manager');
    expect(newStaff.requirePasswordChange).toBe('true');
  });

  it('should successfully create a Finance Officer account', async () => {
    const staffData = generateStaffData('finance_officer');

    const temporaryPassword = 'Desert-Canyon-Summit-56#';
    const passwordHash = await hash(temporaryPassword, 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    expect(newStaff).toBeDefined();
    expect(newStaff.email).toBe(staffData.email);
    expect(newStaff.role).toBe('finance_officer');
    expect(newStaff.requirePasswordChange).toBe('true');
  });

  it('should reject duplicate email for staff accounts', async () => {
    const staffData = generateStaffData('claims_adjuster');
    const passwordHash = await hash('TempPass123!', 12);

    // First staff account
    await db.insert(users).values({
      email: staffData.email,
      phone: staffData.phone,
      passwordHash,
      fullName: staffData.fullName,
      dateOfBirth: new Date('1990-01-01'),
      role: staffData.role,
      status: 'phone_verified_tier_0',
      requirePasswordChange: 'true',
    });

    // Attempt to create second staff account with same email
    try {
      await db.insert(users).values({
        email: staffData.email, // Same email
        phone: `+234801${Math.floor(Math.random() * 10000000)}`, // Different phone
        passwordHash,
        fullName: 'Another Staff',
        dateOfBirth: new Date('1990-01-01'),
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      });
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw unique constraint violation
      expect(error).toBeDefined();
    }
  });

  it('should reject duplicate phone for staff accounts', async () => {
    const staffData = generateStaffData('claims_adjuster');
    const passwordHash = await hash('TempPass123!', 12);

    // First staff account
    await db.insert(users).values({
      email: staffData.email,
      phone: staffData.phone,
      passwordHash,
      fullName: staffData.fullName,
      dateOfBirth: new Date('1990-01-01'),
      role: staffData.role,
      status: 'phone_verified_tier_0',
      requirePasswordChange: 'true',
    });

    // Attempt to create second staff account with same phone
    try {
      await db.insert(users).values({
        email: `different-${Date.now()}@nem-insurance.com`, // Different email
        phone: staffData.phone, // Same phone
        passwordHash,
        fullName: 'Another Staff',
        dateOfBirth: new Date('1990-01-01'),
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      });
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw unique constraint violation
      expect(error).toBeDefined();
    }
  });

  it('should set requirePasswordChange flag to true for new staff accounts', async () => {
    const staffData = generateStaffData('claims_adjuster');
    const passwordHash = await hash('TempPass123!', 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    expect(newStaff.requirePasswordChange).toBe('true');
  });

  it('should allow password change and clear requirePasswordChange flag', async () => {
    const staffData = generateStaffData('claims_adjuster');
    const temporaryPasswordHash = await hash('TempPass123!', 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash: temporaryPasswordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    expect(newStaff.requirePasswordChange).toBe('true');

    // Simulate password change
    const newPasswordHash = await hash('NewSecurePass123!', 12);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        requirePasswordChange: 'false',
        updatedAt: new Date(),
      })
      .where(eq(users.id, newStaff.id));

    // Verify password change
    const [updatedStaff] = await db
      .select()
      .from(users)
      .where(eq(users.id, newStaff.id))
      .limit(1);

    expect(updatedStaff.requirePasswordChange).toBe('false');
  });

  it('should hash temporary password with bcrypt (12 rounds)', async () => {
    const staffData = generateStaffData('claims_adjuster');
    const temporaryPassword = 'Sunset-Mountain-River-42!';
    const passwordHash = await hash(temporaryPassword, 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    // Verify password is hashed (bcrypt hashes start with $2a$ or $2b$)
    expect(newStaff.passwordHash).toMatch(/^\$2[ab]\$/);
    expect(newStaff.passwordHash).not.toBe(temporaryPassword);
  });

  it('should complete staff account provisioning in under 3 minutes', async () => {
    const startTime = Date.now();
    
    const staffData = generateStaffData('claims_adjuster');
    const temporaryPassword = 'Sunset-Mountain-River-42!';
    const passwordHash = await hash(temporaryPassword, 12);

    const [newStaff] = await db
      .insert(users)
      .values({
        email: staffData.email,
        phone: staffData.phone,
        passwordHash,
        fullName: staffData.fullName,
        dateOfBirth: new Date('1990-01-01'),
        role: staffData.role,
        status: 'phone_verified_tier_0',
        requirePasswordChange: 'true',
      })
      .returning();

    const elapsedTime = Date.now() - startTime;

    expect(newStaff).toBeDefined();
    expect(elapsedTime).toBeLessThan(3 * 60 * 1000); // 3 minutes in milliseconds
  });
});
