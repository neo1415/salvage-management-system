import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { businessPolicyService } from '@/features/business-policy';
import { EnterprisePolicyEditor } from '@/components/admin/enterprise-policy-editor';

export const metadata = {
  title: 'Enterprise Setup | System Admin',
  description: 'Configure business rules, brand, documents, and onboarding',
};

export default async function EnterpriseSetupPage() {
  const session = await auth();

  if (!session || session.user.role !== 'system_admin') {
    redirect('/unauthorized');
  }

  const policy = await businessPolicyService.getEffectivePolicy();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <EnterprisePolicyEditor initialPolicy={policy} />
      </div>
    </main>
  );
}
