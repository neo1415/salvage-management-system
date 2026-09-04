import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('@/components/landing/home-templates', () => ({
  WhiteLabelHomeTemplates: () => null,
}));

import { EnterprisePolicyEditor } from '@/components/admin/enterprise-policy-editor';

describe('Enterprise Setup workflow controls', () => {
  it('mounts department controls only in the Workflow step', () => {
    render(
      <EnterprisePolicyEditor
        initialPolicy={DEFAULT_BUSINESS_POLICY}
        workflowExtras={<div data-testid="department-controls">Department controls</div>}
      />
    );

    expect(screen.queryByTestId('department-controls')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Workflow.*Asset types/i }));
    expect(screen.queryByTestId('department-controls')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Business.*Names, colors/i }));
    expect(screen.queryByTestId('department-controls')).toBeNull();
  });
});
