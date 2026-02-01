import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import PaymentPage from '@/app/(dashboard)/vendor/payments/[id]/page';

// Mock Next.js hooks
vi.mock('next-auth/react');
vi.mock('next/navigation');

// Mock fetch
global.fetch = vi.fn();

describe('PaymentPage Component', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'vendor@test.com',
      name: 'Test Vendor',
    },
  };

  const mockPaymentData = {
    id: 'payment-123',
    auctionId: 'auction-123',
    amount: '500000',
    status: 'pending',
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'paystack',
    paymentReference: null,
    paymentProofUrl: null,
    createdAt: new Date().toISOString(),
    auction: {
      id: 'auction-123',
      caseId: 'case-123',
      currentBid: '500000',
      case: {
        claimReference: 'CLM-2024-001',
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: '2020',
        },
        marketValue: '2000000',
        estimatedSalvageValue: '500000',
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });

    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'payment-123',
    });

    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
    });
  });

  it('should display payment details correctly', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaymentData,
    });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    expect(screen.getByText('CLM-2024-001')).toBeInTheDocument();
    expect(screen.getByText(/₦500,000/)).toBeInTheDocument();
    expect(screen.getByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Camry')).toBeInTheDocument();
  });

  it('should show countdown timer', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaymentData,
    });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Deadline')).toBeInTheDocument();
    });

    expect(screen.getByText('Time Remaining')).toBeInTheDocument();
  });

  it('should validate file size before upload', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaymentData,
    });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    // Find file input by its type attribute
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create a file larger than 5MB
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/File size must be less than 5MB/i)).toBeInTheDocument();
    });
  });

  it('should validate file type before upload', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaymentData,
    });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    // Find file input by its type attribute
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create an invalid file type
    const invalidFile = new File(['content'], 'document.txt', {
      type: 'text/plain',
    });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Only JPG, PNG, and PDF files are allowed/i)).toBeInTheDocument();
    });
  });

  it('should handle upload errors gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentData,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' }),
      });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    // Find file input by its type attribute
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const validFile = new File(['content'], 'receipt.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it('should display correct status badges', async () => {
    const verifiedPayment = {
      ...mockPaymentData,
      status: 'verified',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => verifiedPayment,
    });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText(/Verified ✓/i)).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<PaymentPage />);

    expect(screen.getByText(/Loading payment details/i)).toBeInTheDocument();
  });

  it('should handle payment initiation', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paymentUrl: 'https://paystack.co/pay/abc123',
        }),
      });

    // Mock window.location.href using Object.defineProperty
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const payButton = screen.getByText(/Pay Now with Paystack/i);
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(window.location.href).toBe('https://paystack.co/pay/abc123');
    });
  });

  it('should reject invalid payment URLs', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paymentUrl: 'https://malicious-site.com/pay',
        }),
      });

    render(<PaymentPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeInTheDocument();
    });

    const payButton = screen.getByText(/Pay Now with Paystack/i);
    fireEvent.click(payButton);

    await waitFor(() => {
      // The code throws "Invalid payment URL format" for malformed URLs
      // and "Invalid payment URL domain" for valid URLs with wrong domain
      expect(screen.getByText(/Invalid payment URL/i)).toBeInTheDocument();
    });
  });
});
