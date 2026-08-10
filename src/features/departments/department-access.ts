import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { departments, EXECUTIVE_DEPARTMENT_CODES } from '@/lib/db/schema/departments';
import { users } from '@/lib/db/schema/users';

export type StaffDepartmentAccess = {
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  departmentKind: 'executive' | 'claims' | 'support' | null;
  insuranceClasses: string[];
  isDepartmentHead: boolean;
};

export async function getStaffDepartmentAccess(userId: string): Promise<StaffDepartmentAccess> {
  const [row] = await db
    .select({
      departmentId: users.departmentId,
      departmentCode: departments.code,
      departmentName: departments.name,
      departmentKind: departments.kind,
      insuranceClasses: departments.insuranceClasses,
      isDepartmentHead: users.isDepartmentHead,
    })
    .from(users)
    .leftJoin(departments, and(eq(users.departmentId, departments.id), eq(departments.isActive, true)))
    .where(eq(users.id, userId))
    .limit(1);

  return {
    departmentId: row?.departmentId ?? null,
    departmentCode: row?.departmentCode ?? null,
    departmentName: row?.departmentName ?? null,
    departmentKind: row?.departmentKind ?? null,
    insuranceClasses: Array.isArray(row?.insuranceClasses) ? row.insuranceClasses : [],
    isDepartmentHead: row?.isDepartmentHead ?? false,
  };
}

export function canAccessDepartmentPortfolio(
  role: string | undefined,
  access: StaffDepartmentAccess
): boolean {
  if (role !== 'claims_adjuster') return false;
  return access.departmentCode === 'head_of_claims' ||
    (access.departmentKind === 'claims' && access.isDepartmentHead && access.insuranceClasses.length > 0);
}

export function canViewDepartmentCase(
  role: string | undefined,
  userId: string,
  caseOwnerId: string,
  insuranceClass: string | null,
  access: StaffDepartmentAccess
): boolean {
  if (role !== 'claims_adjuster') return true;
  if (userId === caseOwnerId) return true;
  if (!canAccessDepartmentPortfolio(role, access)) return false;
  if (access.departmentCode === 'head_of_claims') return true;
  const normalized = insuranceClass?.trim().toLowerCase();
  return Boolean(normalized && access.insuranceClasses.some((item) => item.trim().toLowerCase() === normalized));
}

export function isExecutiveDepartment(code: string): boolean {
  return (EXECUTIVE_DEPARTMENT_CODES as readonly string[]).includes(code);
}

export function canHoldDepartmentDesignation(role: string, departmentCode: string): boolean {
  if (departmentCode === 'managing_director' || departmentCode === 'executive_director') {
    return role === 'system_admin';
  }

  if (departmentCode === 'head_of_claims') {
    return role === 'claims_adjuster';
  }

  return role !== 'vendor';
}

export async function isManagingDirector(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role, departmentCode: departments.code })
    .from(users)
    .innerJoin(departments, and(eq(users.departmentId, departments.id), eq(departments.isActive, true)))
    .where(eq(users.id, userId))
    .limit(1);

  return row?.role === 'system_admin' && row.departmentCode === 'managing_director';
}
