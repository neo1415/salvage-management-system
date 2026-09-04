import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DepartmentManager } from '@/components/admin/department-manager';

const classes = [
  { value: 'motor', label: 'Motor' },
  { value: 'other', label: 'Other' },
];

describe('DepartmentManager', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requires a typed value for Other and submits the normalized class', async () => {
    let resolvePost: ((value: Response) => void) | undefined;
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation((_, init) => {
      if (!init?.method) return Promise.resolve(new Response(JSON.stringify({ departments: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { resolvePost = resolve; });
    });

    render(<DepartmentManager insuranceClasses={classes} />);
    fireEvent.change(screen.getByPlaceholderText('Department name'), { target: { value: 'Special Risks' } });
    fireEvent.click(screen.getByLabelText('Other'));

    const addButton = screen.getByRole('button', { name: 'Add' });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Other insurance class'), { target: { value: '  Oil   and Gas ' } });
    fireEvent.click(addButton);

    expect(screen.getByRole('button', { name: 'Adding...' }).getAttribute('aria-busy')).toBe('true');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      name: 'Special Risks',
      insuranceClasses: ['Oil and Gas'],
    });

    await act(async () => resolvePost?.(new Response(JSON.stringify({ success: true }), { status: 201 })));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true));
  });

  it('surfaces a failed request and restores the button', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ departments: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Temporary network failure' }), { status: 503 }));

    render(<DepartmentManager insuranceClasses={classes} />);
    fireEvent.change(screen.getByPlaceholderText('Department name'), { target: { value: 'Motor Claims' } });
    fireEvent.click(screen.getByLabelText('Motor'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Temporary network failure');
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
