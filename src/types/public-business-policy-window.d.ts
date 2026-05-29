import type { PublicBusinessPolicy } from '@/features/business-policy/types';

declare global {
  interface Window {
    __PUBLIC_BUSINESS_POLICY__?: PublicBusinessPolicy;
  }
}

export {};
