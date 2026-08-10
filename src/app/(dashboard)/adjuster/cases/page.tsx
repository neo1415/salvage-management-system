import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canAccessDepartmentPortfolio, getStaffDepartmentAccess } from '@/features/departments/department-access';
import { CasePortfolioPage } from '@/app/(dashboard)/adjuster/my-cases/page';

export default async function CasesPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'claims_adjuster') redirect('/login');
  const access = await getStaffDepartmentAccess(session.user.id);
  if (!canAccessDepartmentPortfolio(session.user.role, access)) redirect('/adjuster/cases/new');
  return <CasePortfolioPage departmentPortfolio />;
}
