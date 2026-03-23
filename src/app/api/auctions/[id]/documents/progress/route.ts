/**
 * Document Progress API
 * 
 * GET /api/auctions/[id]/documents/progress
 * Returns document signing progress for an auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getDocumentProgress } from '@/features/documents/services/document.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params in Next.js 15+
    const { id: auctionId } = await params;

    // Get vendor ID from session
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Get document progress
    const progress = await getDocumentProgress(auctionId, vendor.id);

    return NextResponse.json({
      totalDocuments: progress.totalDocuments,
      signedDocuments: progress.signedDocuments,
      progress: progress.progress,
      allSigned: progress.allSigned,
      documents: progress.documents || [],
    });
  } catch (error) {
    console.error('Error fetching document progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document progress' },
      { status: 500 }
    );
  }
}
