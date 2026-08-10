import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  canAccessDepartmentPortfolio,
  getStaffDepartmentAccess,
} from '@/features/departments/department-access';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await getStaffDepartmentAccess(session.user.id);
  return NextResponse.json({
    success: true,
    access,
    canAccessCasePortfolio: canAccessDepartmentPortfolio(session.user.role, access),
    isManagingDirector: session.user.role === 'system_admin' && access.departmentCode === 'managing_director',
  });
}
