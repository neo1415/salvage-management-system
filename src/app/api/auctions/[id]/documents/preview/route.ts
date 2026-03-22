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
import { eq } from 'drizzle-orm';

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

    // Extract asset details
    const assetDetails = caseData.assetDetails as {
      make?: string;
      model?: string;
      year?: number;
      vin?: string;
    };

    const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || caseData.assetType;

    // Generate document content based on type
    let title = '';
    let content = '';

    switch (documentType) {
      case 'liability_waiver':
        title = 'Release & Waiver of Liability';
        content = `
          <div class="document-content">
            <p class="mb-4"><strong>I, ${vendorUser.fullName}, hereby acknowledge and agree:</strong></p>
            
            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">1. AS-IS CONDITION</h3>
              <p class="text-gray-700">
                I am purchasing the salvage item(s) in "AS-IS, WHERE-IS" condition with ALL FAULTS and NO WARRANTIES, express or implied.
              </p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">2. INSPECTION OPPORTUNITY</h3>
              <p class="text-gray-700">
                I have had the opportunity to inspect the item(s) through photos, descriptions, and damage assessment provided by NEM Insurance.
              </p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">3. RELEASE OF LIABILITY</h3>
              <p class="text-gray-700">
                I hereby release, waive, and forever discharge NEM Insurance Plc, its officers, employees, and agents from any and all liability, 
                claims, demands, or causes of action arising from:
              </p>
              <ul class="list-disc ml-6 mt-2 text-gray-700">
                <li>Injuries or death resulting from use of the salvage item(s)</li>
                <li>Property damage caused by the salvage item(s)</li>
                <li>Defects, malfunctions, or failures of the salvage item(s)</li>
                <li>Any misrepresentation or omission regarding the item's condition</li>
              </ul>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">4. ASSUMPTION OF RISK</h3>
              <p class="text-gray-700">
                I understand and accept all risks associated with purchasing and using salvage property, including but not limited to:
              </p>
              <ul class="list-disc ml-6 mt-2 text-gray-700">
                <li>Structural damage not visible in photos</li>
                <li>Mechanical failures</li>
                <li>Safety hazards</li>
                <li>Environmental contamination</li>
              </ul>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">5. INDEMNIFICATION</h3>
              <p class="text-gray-700">
                I agree to indemnify and hold harmless NEM Insurance Plc from any claims by third parties arising from my ownership or use of the salvage item(s).
              </p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">6. FINAL SALE</h3>
              <p class="text-gray-700">
                I understand this sale is FINAL and NON-REFUNDABLE.
              </p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">7. GOVERNING LAW</h3>
              <p class="text-gray-700">
                This agreement is governed by the laws of Nigeria.
              </p>
            </div>

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
              <p class="text-gray-700">Name: NEM Insurance Plc</p>
              <p class="text-gray-700">Address: 199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
              <p class="text-gray-700">Contact: 234-02-014489560</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">BUYER INFORMATION</h3>
              <p class="text-gray-700">Name: ${vendorUser.fullName}</p>
              <p class="text-gray-700">Email: ${vendorUser.email}</p>
              <p class="text-gray-700">Phone: ${vendorUser.phone}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">ASSET INFORMATION</h3>
              <p class="text-gray-700">Type: ${caseData.assetType}</p>
              <p class="text-gray-700">Description: ${assetDescription}</p>
              <p class="text-gray-700">Condition: ${caseData.vehicleCondition || 'salvage'}</p>
              ${assetDetails.vin ? `<p class="text-gray-700">VIN: ${assetDetails.vin}</p>` : ''}
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">FINANCIAL INFORMATION</h3>
              <p class="text-gray-700">Sale Price: ₦${Number(auction.currentBid || 0).toLocaleString()}</p>
              <p class="text-gray-700">Payment Method: To be determined</p>
            </div>

            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
              <p class="text-sm text-yellow-800">
                <strong>AS-IS, WHERE-IS SALE:</strong> This asset is sold "AS-IS, WHERE-IS" with NO WARRANTIES, express or implied. Buyer accepts all risks and responsibilities associated with this purchase.
              </p>
            </div>
          </div>
        `;
        break;

      case 'pickup_authorization':
        title = 'Pickup Authorization';
        const authCode = `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;
        content = `
          <div class="document-content">
            <div class="mb-6 bg-[#FFD700] p-4 rounded-lg text-center">
              <h3 class="text-2xl font-bold text-[#800020] mb-2">AUTHORIZATION CODE</h3>
              <p class="text-3xl font-mono font-bold text-[#800020]">${authCode}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">AUTHORIZED VENDOR</h3>
              <p class="text-gray-700">Name: ${vendorUser.fullName}</p>
              <p class="text-gray-700">Phone: ${vendorUser.phone}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">ASSET INFORMATION</h3>
              <p class="text-gray-700">Description: ${assetDescription}</p>
              <p class="text-gray-700">Auction ID: ${auctionId}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">PAYMENT CONFIRMATION</h3>
              <p class="text-gray-700">Amount Paid: ₦${Number(auction.currentBid || 0).toLocaleString()}</p>
              <p class="text-gray-700">Payment Reference: To be updated</p>
              <p class="text-gray-700">Payment Date: ${new Date().toLocaleDateString('en-NG')}</p>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold mb-2">PICKUP DETAILS</h3>
              <p class="text-gray-700">Location: ${caseData.locationName || 'NEM Insurance Salvage Yard'}</p>
              <p class="text-gray-700">Contact: 234-02-014489560</p>
              <p class="text-gray-700 font-bold">Deadline: ${new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG')}</p>
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
