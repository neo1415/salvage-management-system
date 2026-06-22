import { getDocumentProgress } from '@/features/documents/services/document.service';

export interface PaymentDocumentGateResult {
  allowed: boolean;
  signedDocuments: number;
  totalDocuments: number;
  missingDocuments: string[];
}

export async function checkPaymentVerificationDocumentGate(
  auctionId: string,
  vendorId: string
): Promise<PaymentDocumentGateResult> {
  const documentProgress = await getDocumentProgress(auctionId, vendorId);

  return {
    allowed: documentProgress.allSigned,
    signedDocuments: documentProgress.signedDocuments,
    totalDocuments: documentProgress.totalDocuments,
    missingDocuments: documentProgress.documents
      .filter((document) => document.status !== 'signed')
      .map((document) => document.type),
  };
}
