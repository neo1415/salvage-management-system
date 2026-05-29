import { ContactSection } from '@/components/landing/contact-section';
import { businessPolicyService } from '@/features/business-policy';

export async function generateMetadata() {
  const policy = await businessPolicyService.getPublicPolicy();

  return {
    title: `Contact | ${policy.branding.brandName}`,
    description: `Contact ${policy.branding.brandName} support`,
  };
}

export default function ContactPage() {
  return <ContactSection />;
}
