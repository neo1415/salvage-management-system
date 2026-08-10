import { describe, expect, it } from 'vitest';
import {
  canAccessDepartmentPortfolio,
  canHoldDepartmentDesignation,
  canViewDepartmentCase,
  isExecutiveDepartment,
  type StaffDepartmentAccess,
} from '@/features/departments/department-access';

const baseAccess: StaffDepartmentAccess = {
  departmentId: 'department-1',
  departmentCode: 'motor_claims',
  departmentName: 'Motor Claims',
  departmentKind: 'claims',
  insuranceClasses: ['Motor', 'Motor Commercial'],
  isDepartmentHead: false,
};

describe('department portfolio authorization', () => {
  it('keeps an ordinary claims adjuster scoped to their own cases', () => {
    expect(canAccessDepartmentPortfolio('claims_adjuster', baseAccess)).toBe(false);
    expect(canViewDepartmentCase('claims_adjuster', 'adjuster-1', 'adjuster-2', 'Motor', baseAccess)).toBe(false);
    expect(canViewDepartmentCase('claims_adjuster', 'adjuster-1', 'adjuster-1', 'Fire', baseAccess)).toBe(true);
  });

  it('allows a mapped claims department head to view matching classes only', () => {
    const access = { ...baseAccess, isDepartmentHead: true };

    expect(canAccessDepartmentPortfolio('claims_adjuster', access)).toBe(true);
    expect(canViewDepartmentCase('claims_adjuster', 'head-1', 'adjuster-2', ' motor ', access)).toBe(true);
    expect(canViewDepartmentCase('claims_adjuster', 'head-1', 'adjuster-2', 'Fire and Special Perils', access)).toBe(false);
  });

  it('allows Head of Claims to view all insurance classes', () => {
    const access: StaffDepartmentAccess = {
      ...baseAccess,
      departmentCode: 'head_of_claims',
      departmentKind: 'executive',
      insuranceClasses: [],
    };

    expect(canAccessDepartmentPortfolio('claims_adjuster', access)).toBe(true);
    expect(canViewDepartmentCase('claims_adjuster', 'head-claims', 'adjuster-2', 'Marine', access)).toBe(true);
  });

  it('does not grant the claims portfolio to another application role', () => {
    const access = { ...baseAccess, isDepartmentHead: true };
    expect(canAccessDepartmentPortfolio('vendor', access)).toBe(false);
  });

  it('recognizes executive designations that do not use a head toggle', () => {
    expect(isExecutiveDepartment('managing_director')).toBe(true);
    expect(isExecutiveDepartment('executive_director')).toBe(true);
    expect(isExecutiveDepartment('head_of_claims')).toBe(true);
    expect(isExecutiveDepartment('motor_claims')).toBe(false);
  });

  it('binds executive designations to the intended application roles', () => {
    expect(canHoldDepartmentDesignation('system_admin', 'managing_director')).toBe(true);
    expect(canHoldDepartmentDesignation('salvage_manager', 'managing_director')).toBe(false);
    expect(canHoldDepartmentDesignation('system_admin', 'executive_director')).toBe(true);
    expect(canHoldDepartmentDesignation('claims_adjuster', 'head_of_claims')).toBe(true);
    expect(canHoldDepartmentDesignation('system_admin', 'head_of_claims')).toBe(false);
    expect(canHoldDepartmentDesignation('claims_adjuster', 'motor_claims')).toBe(true);
    expect(canHoldDepartmentDesignation('vendor', 'motor_claims')).toBe(false);
  });
});
