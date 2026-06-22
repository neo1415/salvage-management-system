/**
 * GET /api/auctions/[id]/documents/preview
 * Get document content preview for signing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { payments } from '@/lib/db/schema/payments';
import { and, desc, eq } from 'drizzle-orm';
import { businessPolicyService } from '@/features/business-policy';
import { formatAssetName } from '@/lib/utils/asset-name';

function formatPaymentMethod(method: string | null | undefined): string {
  const labels: Record<string, string> = {
    paystack: 'Paystack',
    flutterwave: 'Flutterwave',
    bank_transfer: 'Bank Transfer',
    escrow_wallet: 'Escrow Wallet',
  };

  return method ? labels[method] ?? method.replace(/_/g, ' ') : 'To be determined';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id || !session.user.vendorId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get document type from query params
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type');

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type required' },
        { status: 400 }
      );
    }

    // Fetch auction and related data
    const [auctionData] = await db
      .select({
        auction: auctions,
        case: salvageCases,
        vendor: vendors,
        vendorUser: users,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(vendors, eq(vendors.id, session.user.vendorId))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auctionData) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    const { auction, case: caseData, vendorUser } = auctionData;
    const [verifiedPayment] = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentReference: payments.paymentReference,
        verifiedAt: payments.verifiedAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, session.user.vendorId),
          eq(payments.status, 'verified')
        )
      )
      .orderBy(desc(payments.verifiedAt), desc(payments.updatedAt))
      .limit(1);
    const effectivePolicy = await businessPolicyService.getEffectivePolicy();
    const { branding, legal, documents } = effectivePolicy;
    const sellerName = escapeHtml(branding.legalName || branding.brandName);
    const sellerAddress = escapeHtml([legal.addressLine1, legal.addressLine2].filter(Boolean).join(', ') || 'Configured pickup location');
    const supportPhone = escapeHtml(branding.supportPhone || 'Contact support');

    // Extract asset details
    const assetDetails = caseData.assetDetails as {
      make?: string;
      model?: string;
      year?: number;
      vin?: string;
    };

    const assetDescription = formatAssetName(
      caseData.assetType,
      caseData.assetDetails as Record<string, unknown>,
      caseData.claimReference
    );

    // Generate document content based on type
    let title = '';
    let content = '';

    switch (documentType) {
      case 'liability_waiver':
        title = 'Release & Waiver of Liability';
        content = `
          <div class="document-content">
            <p class="mb-4"><strong>I, ${escapeHtml(vendorUser.fullName)}, hereby acknowledge and agree:</strong></p>
            ${documents.liabilityWaiverClauses.map((clause, index) => `
              <div class="mb-6">
                <h3 class="text-lg font-bold mb-2">${index + 1}. ${escapeHtml(clause.title)}</h3>
                <p class="text-gray-700">${escapeHtml(clause.body)}</p>
              </div>
            `).join('')}

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
              <p class="text-sm text-yellow-800">
                <strong>Important:</strong> By signing this document, you acknowledge that you have read, understood, and agree to all terms and conditions stated above.
              </p>
            </div>
          </div>
        `;
        break;

      case 'bill_of_sale':
        title = 'Bill of Sale';
        content = `
          <div class="document-content">
            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">TRANSACTION DETAILS</h3>
              <p class="text-gray-700">Transaction ID: ${auctionId}</p>
              <p class="text-gray-700">Date: ${new Date().toLocaleDateString('en-NG')}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">SELLER INFORMATION</h3>
              <p class="text-gray-700">Name: ${sellerName}</p>
              <p class="text-gray-700">Address: ${sellerAddress}</p>
              <p class="text-gray-700">Contact: ${supportPhone}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">BUYER INFORMATION</h3>
              <p class="text-gray-700">Name: ${escapeHtml(vendorUser.fullName)}</p>
              <p class="text-gray-700">Email: ${escapeHtml(vendorUser.email)}</p>
              <p class="text-gray-700">Phone: ${escapeHtml(vendorUser.phone || '')}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">ASSET INFORMATION</h3>
              <p class="text-gray-700">Type: ${escapeHtml(caseData.assetType)}</p>
              <p class="text-gray-700">Description: ${escapeHtml(assetDescription)}</p>
              <p class="text-gray-700">Condition: ${escapeHtml(caseData.vehicleCondition || 'salvage')}</p>
              ${assetDetails.vin ? `<p class="text-gray-700">VIN: ${escapeHtml(assetDetails.vin)}</p>` : ''}
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">FINANCIAL INFORMATION</h3>
              <p class="text-gray-700">Sale Price: ₦${Number(verifiedPayment?.amount ?? auction.currentBid ?? 0).toLocaleString()}</p>
              <p class="text-gray-700">Payment Method: ${escapeHtml(formatPaymentMethod(verifiedPayment?.paymentMethod))}</p>
              ${verifiedPayment?.paymentReference ? `<p class="text-gray-700">Payment Reference: ${escapeHtml(verifiedPayment.paymentReference)}</p>` : ''}
            </div>

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
              <p class="text-sm text-yellow-800">
                <strong>${escapeHtml(documents.billOfSaleDisclaimerTitle)}:</strong> ${escapeHtml(documents.billOfSaleDisclaimerBody)}
              </p>
            </div>
          </div>
        `;
        break;

      case 'pickup_authorization':
        title = 'Pickup Authorization';
        const authCode = `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;
        const pickupDeadlineHours = Math.max(1, effectivePolicy.auctions.documentValidityHours);
        content = `
          <div class="document-content">
            <div class="mb-6 bg-[var(--brand-primary)] p-4 rounded-lg text-center">
              <h3 class="text-2xl font-bold text-white mb-2">AUTHORIZATION CODE</h3>
              <p class="text-3xl font-mono font-bold text-white">${authCode}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">AUTHORIZED VENDOR</h3>
              <p class="text-gray-700">Name: ${escapeHtml(vendorUser.fullName)}</p>
              <p class="text-gray-700">Phone: ${escapeHtml(vendorUser.phone || '')}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">ASSET INFORMATION</h3>
              <p class="text-gray-700">Description: ${escapeHtml(assetDescription)}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">PAYMENT CONFIRMATION</h3>
              <p class="text-gray-700">Amount Paid: ₦${Number(verifiedPayment?.amount ?? auction.currentBid ?? 0).toLocaleString()}</p>
              <p class="text-gray-700">Payment Method: ${escapeHtml(formatPaymentMethod(verifiedPayment?.paymentMethod))}</p>
              <p class="text-gray-700">Payment Reference: ${escapeHtml(verifiedPayment?.paymentReference || verifiedPayment?.id || 'Pending verification reference')}</p>
              <p class="text-gray-700">Payment Date: ${(verifiedPayment?.verifiedAt ?? new Date()).toLocaleDateString('en-NG')}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">PICKUP DETAILS</h3>
              <p class="text-gray-700">Location: ${caseData.locationName || sellerAddress}</p>
              <p class="text-gray-700">Contact: ${supportPhone}</p>
              <p class="text-gray-700 font-bold">Deadline: ${new Date(Date.now() + pickupDeadlineHours * 60 * 60 * 1000).toLocaleDateString('en-NG')}</p>
            </div>

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
              <p class="text-sm text-yellow-800 font-bold mb-2">IMPORTANT NOTICE:</p>
              <ul class="list-disc ml-6 text-sm text-yellow-800">
                <li>Present this authorization and valid ID at pickup location</li>
                <li>Pickup must be completed before deadline to avoid storage fees</li>
                <li>Authorization code must match system records</li>
              </ul>
            </div>
          </div>
        `;
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported document type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      title,
      content,
      assetDescription,
      auctionId,
    });
  } catch (error) {
    console.error('Error fetching document preview:', error);
    console.error('Error details:', {
      auctionId: (await params).id,
      documentType: new URL(request.url).searchParams.get('type'),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to fetch document preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return entities[char] ?? char;
  });
}
