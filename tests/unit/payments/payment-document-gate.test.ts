import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPaymentVerificationDocumentGate } from '@/features/payments/services/payment-document-gate.service';
import { getDocumentProgress } from '@/features/documents/services/document.service';

vi.mock('@/features/documents/services/document.service', () => ({
  getDocumentProgress: vi.fn(),
}));

const getDocumentProgressMock = vi.mocked(getDocumentProgress);

describe('checkPaymentVerificationDocumentGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks payment verification when required auction documents are unsigned', async () => {
    getDocumentProgressMock.mockResolvedValueOnce({
      totalDocuments: 2,
      signedDocuments: 1,
      progress: 50,
      allSigned: false,
      documents: [
        {
          id: 'bill-of-sale',
          type: 'bill_of_sale',
          status: 'signed',
          signedAt: new Date('2026-06-22T10:00:00Z'),
        },
        {
          id: 'liability-waiver',
          type: 'liability_waiver',
          status: 'pending',
          signedAt: null,
        },
      ],
    });

    await expect(checkPaymentVerificationDocumentGate('auction-1', 'vendor-1')).resolves.toEqual({
      allowed: false,
      signedDocuments: 1,
      totalDocuments: 2,
      missingDocuments: ['liability_waiver'],
    });
  });

  it('allows payment verification when every required auction document is signed', async () => {
    getDocumentProgressMock.mockResolvedValueOnce({
      totalDocuments: 2,
      signedDocuments: 2,
      progress: 100,
      allSigned: true,
      documents: [
        {
          id: 'bill-of-sale',
          type: 'bill_of_sale',
          status: 'signed',
          signedAt: new Date('2026-06-22T10:00:00Z'),
        },
        {
          id: 'liability-waiver',
          type: 'liability_waiver',
          status: 'signed',
          signedAt: new Date('2026-06-22T10:05:00Z'),
        },
      ],
    });

    await expect(checkPaymentVerificationDocumentGate('auction-1', 'vendor-1')).resolves.toEqual({
      allowed: true,
      signedDocuments: 2,
      totalDocuments: 2,
      missingDocuments: [],
    });
  });
});
