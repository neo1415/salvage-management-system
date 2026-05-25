import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { businessPolicyService, validateBusinessPolicy } from '@/features/business-policy';
import { EnterpriseSetupPreview } from '@/components/admin/enterprise-setup-preview';
import { EnterprisePolicyEditor } from '@/components/admin/enterprise-policy-editor';

export const metadata = {
  title: 'Enterprise Setup | System Admin',
  description: 'Preview white-label business policy and enterprise setup configuration',
};

export default async function EnterpriseSetupPage() {
  const session = await auth();

  if (!session || session.user.role !== 'system_admin') {
    redirect('/unauthorized');
  }

  const [policy, publishedPolicy, versions] = await Promise.all([
    businessPolicyService.getEffectivePolicy(),
    businessPolicyService.getPublishedPolicy(),
    businessPolicyService.listPolicyVersions(),
  ]);
  const validation = validateBusinessPolicy(policy);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <EnterprisePolicyEditor initialPolicy={policy} />
      </div>
      <EnterpriseSetupPreview
        policy={policy}
        validation={validation}
        storageMode={publishedPolicy ? 'published_policy' : 'runtime_default'}
        publishedVersion={publishedPolicy?.version ?? null}
        versionCount={versions.length}
      />
    </main>
  );
}
