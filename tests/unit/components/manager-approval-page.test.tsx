/**
 * Unit Tests for Manager Approval Page - Price Override UI
 * 
 * Requirements: 4.1, 4.2, 4.5
 * 
 * Tests:
 * - Edit mode activation
 * - Price field rendering
 * - Comment field requirement
 * - Validation error display
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ApprovalsPage from '@/app/(dashboard)/manager/approvals/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: 'manager-1',
        email: 'manager@test.com',
        role: 'salvage_manager',
      },
    },
    status: 'authenticated',
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock fetch
global.fetch = vi.fn();

const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
};

const mockCase = {
  id: 'case-1',
  claimReference: 'CLM-2025-001',
  assetType: 'vehicle' as const,
  assetDetails: {
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
  },
  marketValue: '8500000',
  estimatedSalvageValue: '5300000',
  reservePrice: '3710000',
  damageSeverity: 'moderate' as const,
  aiAssessment: {
    labels: ['Front Damage', 'Bumper Damage'],
    confidenceScore: 85,
    damagePercentage: 35,
    processedAt: '2025-02-01T10:00:00Z',
  },
  gpsLocation: {
    x: 3.3792,
    y: 6.5244,
  },
  locationName: 'Lagos, Nigeria',
  photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
  voiceNotes: [],
  status: 'pending_approval',
  createdBy: 'adjuster-1',
  createdAt: '2025-02-01T09:00:00Z',
  adjusterName: 'John Adjuster',
  approvedBy: null,
  approvedAt: null,
};

describe('Manager Approval Page - Price Override UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    
    // Mock successful fetch for cases list
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [mockCase] }),
    });
  });

  describe('Edit Mode Activation', () => {
    it('should show "Edit Prices" button when viewing a pending case', async () => {
      render(<ApprovalsPage />);

      // Wait for cases to load
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });

      // Click on the case to view details
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('💰 Valuation')).toBeInTheDocument();
      });

      // Check for Edit Prices button
      expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
    });

    it('should not show "Edit Prices" button for already approved cases', async () => {
      const approvedCase = {
        ...mockCase,
        approvedBy: 'manager-1',
        approvedAt: '2025-02-01T11:00:00Z',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [approvedCase] }),
      });

      render(<ApprovalsPage />);

      // Wait for cases to load and click on case
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('Case Already Approved')).toBeInTheDocument();
      });

      // Edit Prices button should not be present
      expect(screen.queryByText('✏️ Edit Prices')).not.toBeInTheDocument();
    });

    it('should enter edit mode when "Edit Prices" button is clicked', async () => {
      render(<ApprovalsPage />);

      // Wait for cases to load and click on case
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });

      // Click Edit Prices button
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      // Should show Cancel button
      await waitFor(() => {
        expect(screen.getByText('✕ Cancel')).toBeInTheDocument();
      });

      // Should show "Approve with Changes" button
      expect(screen.getByText('Cancel Edits')).toBeInTheDocument();
    });

    it('should exit edit mode when cancel button is clicked', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        expect(screen.getByText('✕ Cancel')).toBeInTheDocument();
      });

      // Click Cancel button
      fireEvent.click(screen.getByText('✕ Cancel'));

      // Should return to view mode
      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
    });
  });

  describe('Price Field Rendering', () => {
    it('should render all price fields in view mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('Market Value')).toBeInTheDocument();
      });

      // Check all price fields are present
      expect(screen.getByText('Market Value')).toBeInTheDocument();
      expect(screen.getByText('Estimated Salvage Value')).toBeInTheDocument();
      expect(screen.getByText('Reserve Price')).toBeInTheDocument();

      // Check values are displayed with currency formatting
      expect(screen.getByText(/₦8,500,000/)).toBeInTheDocument();
      expect(screen.getByText(/₦5,300,000/)).toBeInTheDocument();
      expect(screen.getByText(/₦3,710,000/)).toBeInTheDocument();
    });

    it('should render price fields as editable inputs in edit mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      // Wait for edit mode
      await waitFor(() => {
        expect(screen.getByText('✕ Cancel')).toBeInTheDocument();
      });

      // Check for input fields (there should be 3 number inputs)
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(3);
    });

    it('should display AI estimates when prices are overridden', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Change market value
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      // Should show AI estimate
      await waitFor(() => {
        expect(screen.getByText(/AI estimate: ₦8,500,000/)).toBeInTheDocument();
      });
    });
  });

  describe('Comment Field Requirement', () => {
    it('should show comment field when prices are edited', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Change a price
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      // Comment field should appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      // Should show required indicator
      expect(screen.getByText('Reason for Changes')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should not show comment field when no prices are edited', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        expect(screen.getByText('✕ Cancel')).toBeInTheDocument();
      });

      // Comment field should not be present
      expect(screen.queryByPlaceholderText(/Explain why you're adjusting these prices/)).not.toBeInTheDocument();
    });

    it('should show character count warning for short comments', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail, enter edit mode, and change a price
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      // Enter short comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Short' } });

      // Should show character count warning
      await waitFor(() => {
        expect(screen.getByText(/Comment must be at least 10 characters/)).toBeInTheDocument();
      });
    });

    it('should disable approve button when comment is too short', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail, enter edit mode, and change a price
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      // Enter short comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Short' } });

      // Approve button should be disabled
      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).toBeDisabled();
      });
    });

    it('should enable approve button when comment is valid', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail, enter edit mode, and change a price
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      // Enter valid comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Market research shows higher value' } });

      // Approve button should be enabled
      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).not.toBeDisabled();
      });
    });
  });

  describe('Validation Error Display', () => {
    it('should show validation error when salvage value exceeds market value', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Set salvage value higher than market value
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '5000000' } }); // Market value
      fireEvent.change(inputs[1], { target: { value: '6000000' } }); // Salvage value

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Salvage value cannot exceed market value/)).toBeInTheDocument();
      });
    });

    it('should show validation error when reserve price exceeds salvage value', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Set reserve price higher than salvage value
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[1], { target: { value: '5000000' } }); // Salvage value
      fireEvent.change(inputs[2], { target: { value: '6000000' } }); // Reserve price

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Reserve price cannot exceed salvage value/)).toBeInTheDocument();
      });
    });

    it('should show validation error when market value is zero or negative', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Set market value to zero
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '0' } });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Market value must be greater than zero/)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when values become valid', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Create validation error
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '5000000' } }); // Market value
      fireEvent.change(inputs[1], { target: { value: '6000000' } }); // Salvage value

      await waitFor(() => {
        expect(screen.getByText(/Salvage value cannot exceed market value/)).toBeInTheDocument();
      });

      // Fix the error
      fireEvent.change(inputs[1], { target: { value: '4000000' } }); // Salvage value

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/Salvage value cannot exceed market value/)).not.toBeInTheDocument();
      });
    });

    it('should disable approve button when validation errors exist', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Create validation error
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '5000000' } }); // Market value
      fireEvent.change(inputs[1], { target: { value: '6000000' } }); // Salvage value

      await waitFor(() => {
        expect(screen.getByText(/Salvage value cannot exceed market value/)).toBeInTheDocument();
      });

      // Add valid comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Valid comment here' } });

      // Approve button should still be disabled due to validation error
      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).toBeDisabled();
      });
    });
  });
});

/**
 * Property-Based Test for AI Warnings Pass-Through
 * 
 * Feature: case-creation-and-approval-enhancements
 * Property 15: AI Warnings Pass-Through
 * 
 * **Validates: Requirements 8.3**
 * 
 * For any AI assessment that generates warnings, all warnings should be 
 * displayed on the approval page without modification.
 */

import fc from 'fast-check';

describe('Property 15: AI Warnings Pass-Through', () => {
  it('should display all AI warnings without modification', async () => {
    // Feature: case-creation-and-approval-enhancements, Property 15: AI Warnings Pass-Through
    await fc.assert(
      fc.asyncProperty(
        // Generate array of warning strings (1-3 warnings for faster tests)
        // Filter out whitespace-only strings
        fc.array(
          fc.string({ minLength: 15, maxLength: 100 }).filter(s => s.trim().length >= 10),
          { minLength: 1, maxLength: 3 }
        ),
        async (warnings) => {
          // Create case with warnings
          const caseWithWarnings = {
            ...mockCase,
            aiAssessment: {
              ...mockCase.aiAssessment,
              warnings,
            },
          };

          // Mock fetch to return case with warnings
          (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ data: [caseWithWarnings] }),
          });

          // Render component
          const { container, unmount } = render(<ApprovalsPage />);

          try {
            // Wait for cases to load and click on case
            await waitFor(() => {
              expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
            }, { timeout: 2000 });
            
            fireEvent.click(screen.getByText('CLM-2025-001'));

            // Wait for detail view
            await waitFor(() => {
              expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
            }, { timeout: 2000 });

            // Verify all warnings are displayed
            for (const warning of warnings) {
              await waitFor(() => {
                expect(screen.getByText(warning)).toBeInTheDocument();
              }, { timeout: 1000 });
            }

            // Verify warning section header is present
            expect(screen.getByText(/AI Warnings:/)).toBeInTheDocument();

            // Verify each warning is in its own container
            const warningElements = container.querySelectorAll('.bg-orange-50');
            expect(warningElements.length).toBe(warnings.length);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 10, timeout: 10000 } // Reduced runs for faster execution
    );
  }, 15000); // Increase test timeout

  it('should not display warning section when no warnings exist', async () => {
    // Feature: case-creation-and-approval-enhancements, Property 15: AI Warnings Pass-Through
    await fc.assert(
      fc.asyncProperty(
        // Generate cases with no warnings or empty warnings array
        fc.constantFrom(undefined, []),
        async (warnings) => {
          // Create case without warnings
          const caseWithoutWarnings = {
            ...mockCase,
            aiAssessment: {
              ...mockCase.aiAssessment,
              warnings: warnings as any,
            },
          };

          // Mock fetch to return case without warnings
          (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ data: [caseWithoutWarnings] }),
          });

          // Render component
          const { unmount } = render(<ApprovalsPage />);

          try {
            // Wait for cases to load and click on case
            await waitFor(() => {
              expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
            }, { timeout: 2000 });
            
            fireEvent.click(screen.getByText('CLM-2025-001'));

            // Wait for detail view
            await waitFor(() => {
              expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
            }, { timeout: 2000 });

            // Verify warning section is not displayed
            expect(screen.queryByText(/AI Warnings:/)).not.toBeInTheDocument();
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  }, 15000);

  it('should preserve warning text exactly as provided by AI', async () => {
    // Feature: case-creation-and-approval-enhancements, Property 15: AI Warnings Pass-Through
    
    // Test with specific warning examples
    const testWarnings = [
      'Low photo quality detected - confidence may be reduced',
      'Vehicle make/model not clearly visible',
      'Damage assessment may be incomplete due to photo angles'
    ];

    const caseWithWarnings = {
      ...mockCase,
      aiAssessment: {
        ...mockCase.aiAssessment,
        warnings: testWarnings,
      },
    };

    // Mock fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [caseWithWarnings] }),
    });

    // Render component
    render(<ApprovalsPage />);

    // Navigate to case detail
    await waitFor(() => {
      expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('CLM-2025-001'));

    await waitFor(() => {
      expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
    });

    // Verify each warning is displayed exactly as provided
    for (const warning of testWarnings) {
      const element = screen.getByText(warning);
      expect(element).toBeInTheDocument();
      // Verify the text content matches exactly
      expect(element.textContent).toBe(warning);
    }
  });
});


/**
 * Edge Case Tests for AI Confidence Display
 * 
 * Requirements: 8.2, 8.5
 * 
 * Tests:
 * - Low confidence warning display
 * - Missing mileage notice
 * - Missing condition notice
 */

describe('Edge Cases: AI Confidence Display', () => {
  describe('Edge Case 1: Low Confidence Warning', () => {
    it('should display prominent warning when confidence is below 70%', async () => {
      const lowConfidenceCase = {
        ...mockCase,
        aiAssessment: {
          ...mockCase.aiAssessment,
          confidenceScore: 65,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [lowConfidenceCase] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify low confidence warning is displayed
      expect(screen.getByText('Low Confidence Score')).toBeInTheDocument();
      expect(screen.getByText(/Manual review strongly recommended/)).toBeInTheDocument();
      
      // Verify confidence score is displayed in red
      const confidenceScore = screen.getByText('65%');
      expect(confidenceScore).toHaveClass('text-red-600');
    });

    it('should not display warning when confidence is 70% or above', async () => {
      const goodConfidenceCase = {
        ...mockCase,
        aiAssessment: {
          ...mockCase.aiAssessment,
          confidenceScore: 75,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [goodConfidenceCase] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify low confidence warning is NOT displayed
      expect(screen.queryByText('Low Confidence Score')).not.toBeInTheDocument();
    });

    it('should display confidence score in yellow when between 70-79%', async () => {
      const mediumConfidenceCase = {
        ...mockCase,
        aiAssessment: {
          ...mockCase.aiAssessment,
          confidenceScore: 75,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mediumConfidenceCase] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify confidence score is displayed in yellow
      const confidenceScore = screen.getByText('75%');
      expect(confidenceScore).toHaveClass('text-yellow-600');
    });

    it('should display confidence score in green when 80% or above', async () => {
      const highConfidenceCase = {
        ...mockCase,
        aiAssessment: {
          ...mockCase.aiAssessment,
          confidenceScore: 90,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [highConfidenceCase] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify confidence score is displayed in green
      const confidenceScore = screen.getByText('90%');
      expect(confidenceScore).toHaveClass('text-green-600');
    });
  });

  describe('Edge Case 2: Missing Mileage Notice', () => {
    it('should display notice when mileage is not provided for vehicle', async () => {
      const caseWithoutMileage = {
        ...mockCase,
        vehicleMileage: undefined,
        vehicleCondition: 'good' as const,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [caseWithoutMileage] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify mileage shows "Not provided"
      expect(screen.getByText('Not provided')).toBeInTheDocument();
      expect(screen.getByText('Estimated from vehicle age')).toBeInTheDocument();

      // Verify notice about missing data
      expect(screen.getByText(/Mileage data not provided/)).toBeInTheDocument();
    });

    it('should display mileage value when provided', async () => {
      const caseWithMileage = {
        ...mockCase,
        vehicleMileage: 75000,
        vehicleCondition: 'good' as const,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [caseWithMileage] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify mileage is displayed with formatting
      expect(screen.getByText('75,000 km')).toBeInTheDocument();
      
      // Verify no "Not provided" message
      expect(screen.queryByText('Not provided')).not.toBeInTheDocument();
    });
  });

  describe('Edge Case 3: Missing Condition Notice', () => {
    it('should display notice when condition is not provided for vehicle', async () => {
      const caseWithoutCondition = {
        ...mockCase,
        vehicleMileage: 75000,
        vehicleCondition: undefined,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [caseWithoutCondition] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify condition shows "Good (default)"
      expect(screen.getByText('Good (default)')).toBeInTheDocument();
      expect(screen.getByText('Default assumption')).toBeInTheDocument();

      // Verify notice about missing data
      expect(screen.getByText(/Condition data not provided/)).toBeInTheDocument();
    });

    it('should display condition value when provided', async () => {
      const caseWithCondition = {
        ...mockCase,
        vehicleMileage: 75000,
        vehicleCondition: 'excellent' as const,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [caseWithCondition] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify condition is displayed
      expect(screen.getByText(/excellent/i)).toBeInTheDocument();
      
      // Verify no "default" message
      expect(screen.queryByText('Good (default)')).not.toBeInTheDocument();
      expect(screen.queryByText('Default assumption')).not.toBeInTheDocument();
    });
  });

  describe('Edge Case: Combined Missing Data', () => {
    it('should display combined notice when both mileage and condition are missing', async () => {
      const caseWithoutBoth = {
        ...mockCase,
        vehicleMileage: undefined,
        vehicleCondition: undefined,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [caseWithoutBoth] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify combined notice
      expect(screen.getByText(/Mileage and condition data not provided/)).toBeInTheDocument();
    });

    it('should not display missing data notice for non-vehicle assets', async () => {
      const propertyCase = {
        ...mockCase,
        assetType: 'property' as const,
        vehicleMileage: undefined,
        vehicleCondition: undefined,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [propertyCase] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText(/AI Damage Assessment/)).toBeInTheDocument();
      });

      // Verify mileage/condition sections are not displayed for property
      expect(screen.queryByText('📊 Mileage')).not.toBeInTheDocument();
      expect(screen.queryByText('⭐ Condition')).not.toBeInTheDocument();
      expect(screen.queryByText(/Mileage and condition data not provided/)).not.toBeInTheDocument();
    });
  });
});


/**
 * Button State Tests
 * 
 * Requirements: 4.1, 5.5
 * 
 * Tests:
 * - Button visibility in different modes
 * - Button enabled/disabled states
 * - Button click handlers
 */

describe('Button States', () => {
  describe('Normal Mode Buttons', () => {
    it('should show Approve and Reject buttons in normal mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('💰 Valuation')).toBeInTheDocument();
      });

      // Verify Approve and Reject buttons are present
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      expect(screen.getByText('✕ Reject')).toBeInTheDocument();
    });

    it('should enable both Approve and Reject buttons when not submitting', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      });

      // Verify buttons are enabled
      const approveButton = screen.getByText('✓ Approve');
      const rejectButton = screen.getByText('✕ Reject');
      
      expect(approveButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
    });

    it('should not show Edit Mode buttons in normal mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      });

      // Verify Edit Mode buttons are not present
      expect(screen.queryByText('✓ Approve with Changes')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel Edits')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode Buttons', () => {
    it('should show Approve with Changes and Cancel Edits buttons in edit mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      // Wait for edit mode
      await waitFor(() => {
        expect(screen.getByText('Cancel Edits')).toBeInTheDocument();
      });

      // Verify Edit Mode buttons are present
      expect(screen.getByText('✓ Approve with Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel Edits')).toBeInTheDocument();
    });

    it('should not show normal Approve/Reject buttons in edit mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      // Wait for edit mode
      await waitFor(() => {
        expect(screen.getByText('Cancel Edits')).toBeInTheDocument();
      });

      // Verify normal buttons are not present (only the edit mode buttons should be visible)
      const approveButtons = screen.queryAllByText('✓ Approve');
      const rejectButtons = screen.queryAllByText('✕ Reject');
      
      // Should not find the normal approve button (only "Approve with Changes")
      expect(approveButtons.length).toBe(0);
      expect(rejectButtons.length).toBe(0);
    });

    it('should disable Approve with Changes button when no overrides exist', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      // Wait for edit mode
      await waitFor(() => {
        expect(screen.getByText('✓ Approve with Changes')).toBeInTheDocument();
      });

      // Verify Approve with Changes button is disabled (no overrides yet)
      const approveButton = screen.getByText('✓ Approve with Changes');
      expect(approveButton).toBeDisabled();
    });

    it('should disable Approve with Changes button when comment is too short', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Change a price to create an override
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      // Enter short comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Short' } });

      // Verify button is disabled
      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).toBeDisabled();
      });
    });

    it('should enable Approve with Changes button when overrides and valid comment exist', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Change a price to create an override
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      // Enter valid comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Market research shows higher value for this model' } });

      // Verify button is enabled
      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).not.toBeDisabled();
      });
    });

    it('should disable Approve with Changes button when validation errors exist', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Create validation error (salvage > market)
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '5000000' } }); // Market value
      fireEvent.change(inputs[1], { target: { value: '6000000' } }); // Salvage value

      await waitFor(() => {
        expect(screen.getByText(/Salvage value cannot exceed market value/)).toBeInTheDocument();
      });

      // Enter valid comment
      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Valid comment here' } });

      // Verify button is still disabled due to validation error
      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).toBeDisabled();
      });
    });

    it('should enable Cancel Edits button in edit mode', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      // Wait for edit mode
      await waitFor(() => {
        expect(screen.getByText('Cancel Edits')).toBeInTheDocument();
      });

      // Verify Cancel Edits button is enabled
      const cancelButton = screen.getByText('Cancel Edits');
      expect(cancelButton).not.toBeDisabled();
    });
  });

  describe('Button Click Handlers', () => {
    it('should call handleApprovalAction when Approve button is clicked', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      });

      // Click Approve button
      fireEvent.click(screen.getByText('✓ Approve'));

      // Should show comment field for approval
      await waitFor(() => {
        expect(screen.getByText('✓ Approving Case')).toBeInTheDocument();
      });
    });

    it('should call handleApprovalAction when Reject button is clicked', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('✕ Reject')).toBeInTheDocument();
      });

      // Click Reject button
      fireEvent.click(screen.getByText('✕ Reject'));

      // Should show comment field for rejection
      await waitFor(() => {
        expect(screen.getByText('✕ Rejecting Case')).toBeInTheDocument();
      });
    });

    it('should exit edit mode when Cancel Edits button is clicked', async () => {
      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        expect(screen.getByText('Cancel Edits')).toBeInTheDocument();
      });

      // Click Cancel Edits button
      fireEvent.click(screen.getByText('Cancel Edits'));

      // Should return to normal mode
      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });

      // Edit mode buttons should not be present
      expect(screen.queryByText('Cancel Edits')).not.toBeInTheDocument();
      expect(screen.queryByText('✓ Approve with Changes')).not.toBeInTheDocument();
    });

    it('should call handleSubmit when Approve with Changes button is clicked', async () => {
      // Mock successful approval
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/cases/case-1/approve')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { notifiedVendors: 5 } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockCase] }),
        });
      });

      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Change a price and add comment
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Market research shows higher value' } });

      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).not.toBeDisabled();
      });

      // Click Approve with Changes button
      const approveButton = screen.getByText('✓ Approve with Changes');
      fireEvent.click(approveButton);

      // Verify the API was called (the button click triggered handleSubmit)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cases/case-1/approve'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Button States During Submission', () => {
    it('should disable buttons during submission', async () => {
      // Mock slow approval to test loading state
      let resolveApproval: any;
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/cases/case-1/approve')) {
          return new Promise((resolve) => {
            resolveApproval = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockCase] }),
        });
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      });

      // Click Approve button
      fireEvent.click(screen.getByText('✓ Approve'));

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });

      // Click Confirm button
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(confirmButton).toBeDisabled();
      });

      // Cleanup
      if (resolveApproval) {
        resolveApproval({
          ok: true,
          json: async () => ({ data: { notifiedVendors: 5 } }),
        });
      }
    });

    it('should disable Approve with Changes button during submission', async () => {
      // Mock slow approval
      let resolveApproval: any;
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/cases/case-1/approve')) {
          return new Promise((resolve) => {
            resolveApproval = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockCase] }),
        });
      });

      render(<ApprovalsPage />);

      // Navigate to case detail and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      await waitFor(() => {
        expect(screen.getByText('✏️ Edit Prices')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Edit Prices'));

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
      });

      // Change a price and add comment
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '9000000' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Explain why you're adjusting these prices/)).toBeInTheDocument();
      });

      const commentField = screen.getByPlaceholderText(/Explain why you're adjusting these prices/);
      fireEvent.change(commentField, { target: { value: 'Market research shows higher value' } });

      await waitFor(() => {
        const approveButton = screen.getByText('✓ Approve with Changes');
        expect(approveButton).not.toBeDisabled();
      });

      // Click Approve with Changes button
      const approveButton = screen.getByText('✓ Approve with Changes');
      fireEvent.click(approveButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(approveButton).toBeDisabled();
      });

      // Cleanup
      if (resolveApproval) {
        resolveApproval({
          ok: true,
          json: async () => ({ data: { notifiedVendors: 5 } }),
        });
      }
    });
  });

  describe('Button States for Already Approved Cases', () => {
    it('should not show any action buttons for already approved cases', async () => {
      const approvedCase = {
        ...mockCase,
        approvedBy: 'manager-1',
        approvedAt: '2025-02-01T11:00:00Z',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [approvedCase] }),
      });

      render(<ApprovalsPage />);

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('Case Already Approved')).toBeInTheDocument();
      });

      // Verify no action buttons are present
      expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('✕ Reject')).not.toBeInTheDocument();
      expect(screen.queryByText('✓ Approve with Changes')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel Edits')).not.toBeInTheDocument();
    });

    it('should not show any action buttons for rejected cases', async () => {
      const rejectedCase = {
        ...mockCase,
        status: 'rejected',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [rejectedCase] }),
      });

      render(<ApprovalsPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Case Approvals')).toBeInTheDocument();
      });
      
      // Click on Rejected tab button (use getAllByRole to find the button specifically)
      const buttons = screen.getAllByRole('button');
      const rejectedTabButton = buttons.find(btn => btn.textContent === 'Rejected' && btn.className.includes('flex-1'));
      
      if (rejectedTabButton) {
        fireEvent.click(rejectedTabButton);
      }

      // Navigate to case detail
      await waitFor(() => {
        expect(screen.getByText('CLM-2025-001')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('CLM-2025-001'));

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByText('Case Rejected')).toBeInTheDocument();
      });

      // Verify no action buttons are present
      expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('✕ Reject')).not.toBeInTheDocument();
      expect(screen.queryByText('✓ Approve with Changes')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel Edits')).not.toBeInTheDocument();
    });
  });
});
