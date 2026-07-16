import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from '@/app/global-error';

const captureException = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureException: (error: unknown) => captureException(error),
}));

vi.mock('next/error', () => ({
  default: ({ statusCode }: { statusCode: number }) => (
    <main>
      <h1>Application error</h1>
      <p>Status: {statusCode}</p>
    </main>
  ),
}));

describe('GlobalError', () => {
  it('records the original exception and renders a fallback', async () => {
    const originalError = new Error('original route failure');

    render(<GlobalError error={originalError} />);

    expect(screen.getByRole('heading', { name: /application error/i })).toBeTruthy();
    await waitFor(() => expect(captureException).toHaveBeenCalledWith(originalError));
  });
});
