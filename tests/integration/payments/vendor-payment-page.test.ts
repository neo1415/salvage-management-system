/**
 * Integration Tests: Vendor Payment Page
 * 
 * Tests the vendor payment page with different payment methods:
 * - Escrow Wallet payment flow
 * - Paystack payment flow
 * - Bank Transfer payment flow
 * 
 * Validates: Requirements 1.1-1.8 (Vendor Wallet Payment Confirmation UI)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PaymentPage from '@/app/(dashboard)/vendor/payments/[id]/page';

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Vendor Payment Page - Integration Tests', () => {
  const mockRouter = {
    push: vi.fn(),
    back: vi.fn(),
  };

  const mockSession = {
    user: {
      id: 'user-123',
      vendorId: 'vendor-123',
      email: 'vendor@example.com',
      role: 'vendor',
    },
  };

  const basePayment = {
    id: 'payment-123',
    auctionId: 'auction-123',
    amount: '500000',
    status: 'pending',
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
        marketValue: '800000',
        estimatedSalvageValue: '500000',
        locationName: 'Lagos',
        photos: ['https://example.com/photo1.jpg'],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue({ id: 'payment-123' });
    (useSession as any).mockReturnValue({ data: mockSession });
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Escrow Wallet Payment Method', () => {
    it('should display WalletPaymentConfirmation for escrow_wallet payment', async () => {
      const escrowPayment = {
        ...basePayment,
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
      };

      const walletBalance = {
        availableBalance: '1000000',
        frozenAmount: '500000',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(escrowPayment),
          });
        }
        if (url.includes('/api/payments/wallet/balance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(walletBalance),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment Details')).toBeInTheDocument();
      });

      // Verify escrow wallet payment UI is displayed
      expect(screen.getByText('Payment from Wallet')).toBeInTheDocument();
      expect(screen.getByText('Payment Source: Escrow Wallet')).toBeInTheDocument();
      expect(screen.getByText(/₦500,000 frozen in your wallet/i)).toBeInTheDocument();

      // Verify wallet balance is displayed
      expect(screen.getByTestId('frozen-amount')).toHaveTextContent('₦500,000');

      // Verify Paystack and Bank Transfer options are NOT displayed
      expect(screen.queryByText('Pay Now with Paystack')).not.toBeInTheDocument();
      expect(screen.queryByText('Pay via Bank Transfer')).not.toBeInTheDocument();
    });

    it('should confirm wallet payment and show success banner with documents link', async () => {
      const escrowPayment = {
        ...basePayment,
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
      };

      const walletBalance = {
        availableBalance: '1000000',
        frozenAmount: '500000',
      };

      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/payments/payment-123') && !options) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(escrowPayment),
          });
        }
        if (url.includes('/api/payments/wallet/balance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(walletBalance),
          });
        }
        if (url.includes('/api/payments/payment-123/confirm-wallet') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              payment: { ...escrowPayment, status: 'wallet_confirmed' },
              documentsUrl: '/vendor/documents?auctionId=auction-123',
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment from Wallet')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText('Confirm Wallet Payment')).toBeInTheDocument();
      });

      // Confirm in modal
      const modalConfirmButton = screen.getByText('Confirm');
      fireEvent.click(modalConfirmButton);

      // Wait for success banner
      await waitFor(() => {
        expect(screen.getByTestId('wallet-confirmed-banner')).toBeInTheDocument();
      });

      // Verify success message
      expect(screen.getByText('Wallet Payment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText(/Please sign all 3 documents/i)).toBeInTheDocument();

      // Verify documents link is present
      const documentsLink = screen.getByTestId('documents-link');
      expect(documentsLink).toHaveAttribute('href', '/vendor/documents?auctionId=auction-123');
    });

    it('should handle insufficient frozen funds error', async () => {
      const escrowPayment = {
        ...basePayment,
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
      };

      const walletBalance = {
        availableBalance: '1000000',
        frozenAmount: '300000', // Less than payment amount
      };

      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/payments/payment-123') && !options) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(escrowPayment),
          });
        }
        if (url.includes('/api/payments/wallet/balance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(walletBalance),
          });
        }
        if (url.includes('/api/payments/payment-123/confirm-wallet') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              error: 'Insufficient frozen funds. Please contact support.',
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment from Wallet')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);

      // Wait for modal and confirm
      await waitFor(() => {
        expect(screen.getByText('Confirm Wallet Payment')).toBeInTheDocument();
      });

      const modalConfirmButton = screen.getByText('Confirm');
      fireEvent.click(modalConfirmButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          'Insufficient frozen funds. Please contact support.'
        );
      });
    });
  });

  describe('Paystack Payment Method', () => {
    it('should display Paystack payment option for paystack payment method', async () => {
      const paystackPayment = {
        ...basePayment,
        paymentMethod: 'paystack',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(paystackPayment),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment Details')).toBeInTheDocument();
      });

      // Verify Paystack payment option is displayed
      expect(screen.getByText('Pay Now with Paystack')).toBeInTheDocument();
      expect(screen.getByText(/Instant verification/i)).toBeInTheDocument();

      // Verify Bank Transfer option is also displayed
      expect(screen.getByText('Pay via Bank Transfer')).toBeInTheDocument();

      // Verify WalletPaymentConfirmation is NOT displayed
      expect(screen.queryByText('Payment from Wallet')).not.toBeInTheDocument();
    });

    it('should initiate Paystack payment when button is clicked', async () => {
      const paystackPayment = {
        ...basePayment,
        paymentMethod: 'paystack',
      };

      const mockPaymentUrl = 'https://paystack.co/pay/abc123';

      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/payments/payment-123') && !options) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(paystackPayment),
          });
        }
        if (url.includes('/api/payments/payment-123/initiate') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ paymentUrl: mockPaymentUrl }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Mock window.location.href
      delete (window as any).location;
      (window as any).location = { href: '' };

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Pay Now with Paystack')).toBeInTheDocument();
      });

      // Click Paystack button
      const paystackButton = screen.getByText('Pay Now with Paystack');
      fireEvent.click(paystackButton);

      // Verify redirect to Paystack
      await waitFor(() => {
        expect(window.location.href).toBe(mockPaymentUrl);
      });
    });
  });

  describe('Bank Transfer Payment Method', () => {
    it('should display bank transfer details for bank_transfer payment method', async () => {
      const bankTransferPayment = {
        ...basePayment,
        paymentMethod: 'bank_transfer',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bankTransferPayment),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment Details')).toBeInTheDocument();
      });

      // Verify bank transfer details are displayed
      expect(screen.getByText('Pay via Bank Transfer')).toBeInTheDocument();
      expect(screen.getByText('Access Bank')).toBeInTheDocument();
      expect(screen.getByText('0123456789')).toBeInTheDocument();
      expect(screen.getByText('NEM Insurance Plc - Salvage')).toBeInTheDocument();

      // Verify file upload input is present
      const fileInput = screen.getByLabelText(/Upload Payment Proof/i);
      expect(fileInput).toBeInTheDocument();
    });

    it('should upload payment proof for bank transfer', async () => {
      const bankTransferPayment = {
        ...basePayment,
        paymentMethod: 'bank_transfer',
      };

      const updatedPayment = {
        ...bankTransferPayment,
        paymentProofUrl: 'https://example.com/proof.jpg',
      };

      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/payments/payment-123') && !options) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bankTransferPayment),
          });
        }
        if (url.includes('/api/payments/payment-123/upload-proof') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(updatedPayment),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Mock alert
      global.alert = vi.fn();

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Pay via Bank Transfer')).toBeInTheDocument();
      });

      // Create a mock file
      const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });

      // Upload file
      const fileInput = screen.getByLabelText(/Upload Payment Proof/i) as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for upload to complete
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Payment proof uploaded successfully! Finance team will verify within 4 hours.'
        );
      });

      // Verify payment proof URL is displayed
      await waitFor(() => {
        expect(screen.getByText(/View uploaded proof/i)).toBeInTheDocument();
      });
    });
  });

  describe('Payment Status Display', () => {
    it('should display verified status with pickup message', async () => {
      const verifiedPayment = {
        ...basePayment,
        status: 'verified',
        paymentMethod: 'escrow_wallet',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(verifiedPayment),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Verified ✓')).toBeInTheDocument();
      });

      // Verify pickup message is displayed
      expect(screen.getByText(/Check your email for pickup authorization code/i)).toBeInTheDocument();
    });

    it('should display overdue status with support message', async () => {
      const overduePayment = {
        ...basePayment,
        status: 'overdue',
        paymentMethod: 'paystack',
        paymentDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(overduePayment),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Overdue')).toBeInTheDocument();
      });

      // Verify support message is displayed
      expect(screen.getByText(/Please contact support/i)).toBeInTheDocument();
    });
  });

  describe('Payment Deadline Countdown', () => {
    it('should display countdown timer for pending payments', async () => {
      const pendingPayment = {
        ...basePayment,
        status: 'pending',
        paymentMethod: 'paystack',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(pendingPayment),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment Deadline')).toBeInTheDocument();
      });

      // Verify countdown is displayed
      expect(screen.getByText('Time Remaining')).toBeInTheDocument();
      
      // Countdown should show hours/minutes/seconds
      await waitFor(() => {
        const countdownElement = screen.getByText(/\d+[hms]/);
        expect(countdownElement).toBeInTheDocument();
      });
    });
  });

  describe('LocalStorage Management', () => {
    it('should set payment-visited flag in localStorage', async () => {
      const escrowPayment = {
        ...basePayment,
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(escrowPayment),
          });
        }
        if (url.includes('/api/payments/wallet/balance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ availableBalance: '1000000', frozenAmount: '500000' }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment from Wallet')).toBeInTheDocument();
      });

      // Verify localStorage flag is set
      expect(localStorage.getItem('payment-visited-payment-123')).toBe('true');
    });

    it('should clear payment-unlocked-modal dismissal flag', async () => {
      // Set dismissal flag
      localStorage.setItem('payment-unlocked-modal-payment-123-dismissed', 'true');

      const escrowPayment = {
        ...basePayment,
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/payments/payment-123')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(escrowPayment),
          });
        }
        if (url.includes('/api/payments/wallet/balance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ availableBalance: '1000000', frozenAmount: '500000' }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<PaymentPage />);

      // Wait for payment details to load
      await waitFor(() => {
        expect(screen.getByText('Payment from Wallet')).toBeInTheDocument();
      });

      // Verify dismissal flag is cleared
      expect(localStorage.getItem('payment-unlocked-modal-payment-123-dismissed')).toBeNull();
    });
  });
});
