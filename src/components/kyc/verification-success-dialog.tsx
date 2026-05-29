'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VerificationSuccessDialogProps {
  open: boolean;
  title: string;
  message: string;
  redirectSeconds?: number;
  onRedirect: () => void;
}

/** Full-screen success modal with countdown before redirecting to the dashboard. */
export function VerificationSuccessDialog({
  open,
  title,
  message,
  redirectSeconds = 5,
  onRedirect,
}: VerificationSuccessDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(redirectSeconds);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(redirectSeconds);
      return;
    }

    setSecondsLeft(redirectSeconds);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          onRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open, redirectSeconds, onRedirect]);

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" aria-hidden />
            </div>
            <DialogTitle className="text-left text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left text-gray-700 text-base">{message}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-gray-500 text-center">
          Redirecting to your dashboard in {secondsLeft} second{secondsLeft === 1 ? '' : 's'}…
        </p>
        <button
          type="button"
          onClick={onRedirect}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold py-3 rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          Go to dashboard now
        </button>
      </DialogContent>
    </Dialog>
  );
}
