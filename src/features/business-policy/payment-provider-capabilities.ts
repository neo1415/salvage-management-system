import type { PaymentPolicy, PaymentProvider } from './types';

export type PaymentProviderCapability = {
  provider: PaymentProvider;
  label: string;
  policyFlag: keyof Pick<PaymentPolicy, 'paystackEnabled' | 'flutterwaveEnabled' | 'manualPaymentEnabled'>;
  executionStatus: 'wired' | 'available_not_routed' | 'manual_review_required';
  note: string;
};

export const PAYMENT_PROVIDER_CAPABILITIES: PaymentProviderCapability[] = [
  {
    provider: 'paystack',
    label: 'Paystack',
    policyFlag: 'paystackEnabled',
    executionStatus: 'wired',
    note: 'Current online checkout and webhook flow.',
  },
  {
    provider: 'flutterwave',
    label: 'Flutterwave',
    policyFlag: 'flutterwaveEnabled',
    executionStatus: 'available_not_routed',
    note: 'Service exists, but checkout routing is not switched by business policy yet.',
  },
  {
    provider: 'manual',
    label: 'Manual review',
    policyFlag: 'manualPaymentEnabled',
    executionStatus: 'manual_review_required',
    note: 'Useful when finance teams need offline payment review.',
  },
];

export function getPaymentProviderCapability(provider: PaymentProvider): PaymentProviderCapability {
  return PAYMENT_PROVIDER_CAPABILITIES.find((capability) => capability.provider === provider)
    ?? PAYMENT_PROVIDER_CAPABILITIES[0];
}

export function isPaymentProviderEnabled(policy: PaymentPolicy, provider: PaymentProvider): boolean {
  const capability = getPaymentProviderCapability(provider);
  return Boolean(policy[capability.policyFlag]);
}
