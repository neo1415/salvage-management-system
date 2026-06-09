import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getKYCRepository } from '@/features/kyc/repositories/kyc.repository';
import { getDocumentUploadService } from '@/features/kyc/services/document-upload.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType, getIpAddress } from '@/lib/utils/audit-logger';
import type { PendingApproval } from '@/features/kyc/types/kyc.types';

export const dynamic = 'force-dynamic';

type DocumentEntry = {
  key: string;
  label: string;
  url?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentKey: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'salvage_manager' && session.user.role !== 'system_admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { id: vendorId, documentKey } = await params;
  const detail = await getKYCRepository().getApprovalDetailByVendorId(vendorId);
  if (!detail) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const document = collectDocuments(detail.approval).find((entry) => entry.key === documentKey);
  if (!document?.url) {
    return NextResponse.json({ error: 'Document not available' }, { status: 404 });
  }

  const documentUrl = /^https:\/\//i.test(document.url)
    ? document.url
    : await getDocumentUploadService().getSignedUrl(document.url);

  if (!documentUrl) {
    return NextResponse.json({ error: 'Document could not be authorized' }, { status: 502 });
  }

  await logAction({
    userId: session.user.id,
    actionType: AuditActionType.KYC_DOCUMENT_VIEWED,
    entityType: AuditEntityType.KYC,
    entityId: vendorId,
    ipAddress: getIpAddress(request.headers),
    deviceType: DeviceType.DESKTOP,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    afterState: {
      documentKey,
      label: document.label,
      source: 'protected_kyc_document_proxy',
    },
  });

  const upstream = await fetch(documentUrl, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Document could not be loaded' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${safeFilename(document.label)}"`,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function collectDocuments(approval: PendingApproval): DocumentEntry[] {
  const documents: DocumentEntry[] = [];
  addDocument(documents, { key: 'photo-id', label: 'Photo ID', url: approval.photoIdUrl });
  addDocument(documents, { key: 'nin-card', label: 'Government ID', url: approval.ninCardUrl });
  addDocument(documents, { key: 'address-proof', label: 'Address proof', url: approval.addressProofUrl });
  addDocument(documents, { key: 'business-registration', label: 'Business registration', url: approval.cacCertificateUrl });
  addDocument(documents, { key: 'selfie', label: 'Selfie', url: approval.selfieUrl });

  (approval.providerDocuments ?? []).forEach((document, index) => {
    addDocument(documents, {
      key: `provider-${index}`,
      label: document.label,
      url: document.url,
    });
  });

  return documents;
}

function addDocument(documents: DocumentEntry[], document: DocumentEntry) {
  if (!document.url) return;
  if (documents.some((entry) => entry.url === document.url)) return;
  documents.push(document);
}

function safeFilename(label: string): string {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kyc-document'}`;
}
