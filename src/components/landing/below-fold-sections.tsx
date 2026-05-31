import { ValuePropsSection } from './value-props';
import { ProductShowcase } from './product-showcase';
import { HowItWorksSection } from './how-it-works';
import { SocialProofSection } from './social-proof';
import { FAQSection } from './faq-section';
import { ContactSection } from './contact-section';
import { Footer } from './footer';
import { FloatingCTA } from './floating-cta';
import type { BrandingPolicy } from '@/features/business-policy/types';

export default function BelowFoldSections({ brandingOverride }: { brandingOverride?: BrandingPolicy } = {}) {
  return (
    <>
      <ValuePropsSection />
      <ProductShowcase />
      <HowItWorksSection />
      <SocialProofSection />
      <FAQSection />
      <ContactSection brandingOverride={brandingOverride} />
      <Footer brandingOverride={brandingOverride} />
      <FloatingCTA />
    </>
  );
}
