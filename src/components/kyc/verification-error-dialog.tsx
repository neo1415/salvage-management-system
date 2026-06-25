'use client';

import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ResolvedVerificationError, VerificationErrorSource } from '@/lib/kyc/kyc-user-messages';
import { sourceHint } from '@/lib/kyc/kyc-user-messages';
import { usePublicBranding } from '@/hooks/use-public-branding';

interface VerificationErrorAlertProps {
  error: ResolvedVerificationError;
  className?: string;
}

/** Inline alert for forms and verification pages. */
export function VerificationErrorAlert({ error, className = '' }: VerificationErrorAlertProps) {
  const { branding } = usePublicBranding();
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-red-900">{error.title}</p>
          <p className="text-red-800 mt-1">{error.message}</p>
          {error.detail ? (
            <p className="text-red-700/90 mt-2 text-xs">{error.detail}</p>
          ) : null}
          <p className="text-red-600/80 mt-2 text-xs">{sourceHint(error.source, branding.brandName)}</p>
          {error.mismatches && error.mismatches.length > 0 ? (
            <ul className="mt-2 text-red-700 space-y-1 list-disc list-inside">
              {error.mismatches.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface VerificationErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: ResolvedVerificationError | null;
  confirmLabel?: string;
}

/** Modal for failed verification attempts (Tier 1 / Tier 2). */
export function VerificationErrorDialog({
  open,
  onOpenChange,
  error,
  confirmLabel = 'Try again',
}: VerificationErrorDialogProps) {
  const { branding } = usePublicBranding();
  if (!error) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" aria-hidden />
            </div>
            <DialogTitle className="text-left">{error.title}</DialogTitle>
          </div>
          <DialogDescription className="text-left text-gray-700">{error.message}</DialogDescription>
        </DialogHeader>
        {error.detail ? (
          <p className="text-sm text-gray-600 border border-gray-100 rounded-lg p-3 bg-gray-50">{error.detail}</p>
        ) : null}
        <p className="text-xs text-gray-500">{sourceHint(error.source, branding.brandName)}</p>
        {error.mismatches && error.mismatches.length > 0 ? (
          <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
            {error.mismatches.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto bg-[var(--brand-primary)] text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { VerificationErrorSource, ResolvedVerificationError };
