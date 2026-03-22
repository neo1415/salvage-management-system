/**
 * Unit tests for DocumentSigningProgress component
 * 
 * Tests cover:
 * - Component rendering with progress data
 * - Progress bar display and calculations
 * - Document list with status badges
 * - Success banner display when all signed
 * - Responsive design (mobile and desktop)
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Various progress states (0/3, 1/3, 2/3, 3/3)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentSigningProgress } from '@/components/documents/document-signing-progress';

describe('DocumentSigningProgress', () => {
  const mockDocuments = [
    {
      id: 'doc-1',
      type: 'bill_of_sale' as const,
      status: 'signed' as const,
      title: 'Bill of Sale',
      signedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'doc-2',
      type: 'liability_waiver' as const,
      status: 'pending' as const,
      title: 'Liability Waiver',
      signedAt: null,
    },
    {
      id: 'doc-3',
      type: 'pickup_authorization' as const,
      status: 'pending' as const,
      title: 'Pickup Authorization',
      signedAt: null,
    },
  ];

  describe('Rendering', () => {
    it('should render component with title', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      expect(screen.getByText('Document Signing Progress')).toBeInTheDocument();
    });

    it('should display progress text correctly', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const progressText = screen.getByTestId('progress-text');
      expect(progressText).toHaveTextContent('1/3 Documents Signed');
    });

    it('should display progress percentage correctly', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const progressPercentage = screen.getByTestId('progress-percentage');
      expect(progressPercentage).toHaveTextContent('33%');
    });

    it('should render all documents in the list', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      expect(screen.getByText('Bill of Sale')).toBeInTheDocument();
      expect(screen.getByText('Liability Waiver')).toBeInTheDocument();
      expect(screen.getByText('Pickup Authorization')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should display progress bar with correct width for 0/3', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 0,
        progress: 0,
        allSigned: false,
      };

      const allPending = mockDocuments.map(doc => ({ ...doc, status: 'pending' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allPending}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should display progress bar with correct width for 1/3', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '33%' });
    });

    it('should display progress bar with correct width for 2/3', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 2,
        progress: 67,
        allSigned: false,
      };

      const twoSigned = [
        { ...mockDocuments[0], status: 'signed' as const },
        { ...mockDocuments[1], status: 'signed' as const },
        { ...mockDocuments[2], status: 'pending' as const },
      ];

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={twoSigned}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '67%' });
    });

    it('should display progress bar with correct width for 3/3', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should use burgundy color when not all signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveClass('bg-burgundy-900');
    });

    it('should use green color when all signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveClass('bg-green-500');
    });
  });

  describe('Status Badges', () => {
    it('should display "Signed" badge with green styling for signed documents', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const signedBadge = screen.getByTestId('status-badge-bill_of_sale');
      expect(signedBadge).toHaveTextContent('Signed');
      expect(signedBadge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should display "Pending" badge with yellow styling for pending documents', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const pendingBadge = screen.getByTestId('status-badge-liability_waiver');
      expect(pendingBadge).toHaveTextContent('Pending');
      expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should display "Voided" badge with red styling for voided documents', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 0,
        progress: 0,
        allSigned: false,
      };

      const voidedDocs = [
        { ...mockDocuments[0], status: 'voided' as const },
        { ...mockDocuments[1], status: 'pending' as const },
        { ...mockDocuments[2], status: 'pending' as const },
      ];

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={voidedDocs}
        />
      );

      const voidedBadge = screen.getByTestId('status-badge-bill_of_sale');
      expect(voidedBadge).toHaveTextContent('Voided');
      expect(voidedBadge).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  describe('Success Banner', () => {
    it('should not display success banner when not all signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
    });

    it('should display success banner when all documents signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      const banner = screen.getByTestId('success-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('All documents signed! Payment is being processed.');
    });

    it('should have green styling for success banner', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      const banner = screen.getByTestId('success-banner');
      expect(banner).toHaveClass('bg-green-50', 'border-green-200');
    });
  });

  describe('Helper Text', () => {
    it('should display helper text when not all signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      expect(
        screen.getByText('Sign all documents to complete the payment process')
      ).toBeInTheDocument();
    });

    it('should not display helper text when all signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      expect(
        screen.queryByText('Sign all documents to complete the payment process')
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for region', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const region = screen.getByRole('region');
      expect(region).toHaveAttribute('aria-label', 'Document signing progress');
    });

    it('should have proper progressbar role and attributes', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '33');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-label', '1 of 3 documents signed');
    });

    it('should have proper list role for document list', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const list = screen.getByRole('list', { name: 'Document list' });
      expect(list).toBeInTheDocument();
    });

    it('should have proper listitem roles for documents', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const listitems = screen.getAllByRole('listitem');
      expect(listitems).toHaveLength(3);
    });

    it('should have proper status role and aria-label for badges', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const signedBadge = screen.getByTestId('status-badge-bill_of_sale');
      expect(signedBadge).toHaveAttribute('role', 'status');
      expect(signedBadge).toHaveAttribute('aria-label', 'Bill of Sale status: Signed');
    });

    it('should announce success banner to screen readers', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      const banner = screen.getByTestId('success-banner');
      expect(banner).toHaveAttribute('role', 'alert');
      expect(banner).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes for padding', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      const { container } = render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass('p-4', 'sm:p-6');
    });

    it('should have responsive text sizes for heading', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const heading = screen.getByText('Document Signing Progress');
      expect(heading).toHaveClass('text-lg', 'sm:text-xl');
    });

    it('should have responsive text sizes for progress text', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      const progressText = screen.getByTestId('progress-text');
      expect(progressText).toHaveClass('text-sm', 'sm:text-base');
    });
  });

  describe('Various Progress States', () => {
    it('should render correctly with 0/3 documents signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 0,
        progress: 0,
        allSigned: false,
      };

      const allPending = mockDocuments.map(doc => ({ ...doc, status: 'pending' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allPending}
        />
      );

      expect(screen.getByTestId('progress-text')).toHaveTextContent('0/3 Documents Signed');
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('0%');
      expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
    });

    it('should render correctly with 1/3 documents signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mockDocuments}
        />
      );

      expect(screen.getByTestId('progress-text')).toHaveTextContent('1/3 Documents Signed');
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('33%');
      expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
    });

    it('should render correctly with 2/3 documents signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 2,
        progress: 67,
        allSigned: false,
      };

      const twoSigned = [
        { ...mockDocuments[0], status: 'signed' as const },
        { ...mockDocuments[1], status: 'signed' as const },
        { ...mockDocuments[2], status: 'pending' as const },
      ];

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={twoSigned}
        />
      );

      expect(screen.getByTestId('progress-text')).toHaveTextContent('2/3 Documents Signed');
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('67%');
      expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
    });

    it('should render correctly with 3/3 documents signed', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 3,
        progress: 100,
        allSigned: true,
      };

      const allSigned = mockDocuments.map(doc => ({ ...doc, status: 'signed' as const }));

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={allSigned}
        />
      );

      expect(screen.getByTestId('progress-text')).toHaveTextContent('3/3 Documents Signed');
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('100%');
      expect(screen.getByTestId('success-banner')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty document list', () => {
      const progress = {
        totalDocuments: 0,
        signedDocuments: 0,
        progress: 0,
        allSigned: false,
      };

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={[]}
        />
      );

      expect(screen.getByTestId('progress-text')).toHaveTextContent('0/0 Documents Signed');
      const listitems = screen.queryAllByRole('listitem');
      expect(listitems).toHaveLength(0);
    });

    it('should handle long document titles with truncation', () => {
      const progress = {
        totalDocuments: 1,
        signedDocuments: 0,
        progress: 0,
        allSigned: false,
      };

      const longTitleDoc = [
        {
          id: 'doc-1',
          type: 'bill_of_sale' as const,
          status: 'pending' as const,
          title: 'This is a very long document title that should be truncated on small screens',
          signedAt: null,
        },
      ];

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={longTitleDoc}
        />
      );

      const title = screen.getByText('This is a very long document title that should be truncated on small screens');
      expect(title).toHaveClass('truncate');
    });

    it('should handle mixed document statuses', () => {
      const progress = {
        totalDocuments: 3,
        signedDocuments: 1,
        progress: 33,
        allSigned: false,
      };

      const mixedDocs = [
        { ...mockDocuments[0], status: 'signed' as const },
        { ...mockDocuments[1], status: 'voided' as const },
        { ...mockDocuments[2], status: 'pending' as const },
      ];

      render(
        <DocumentSigningProgress
          progress={progress}
          documents={mixedDocs}
        />
      );

      expect(screen.getByTestId('status-badge-bill_of_sale')).toHaveTextContent('Signed');
      expect(screen.getByTestId('status-badge-liability_waiver')).toHaveTextContent('Voided');
      expect(screen.getByTestId('status-badge-pickup_authorization')).toHaveTextContent('Pending');
    });
  });
});
