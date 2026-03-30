/**
 * POST /api/auctions/[id]/close
 * Close an auction immediately (idempotent)
 * 
 * Called by:
 * - Client-side timer when auction expires
 * - Manager "End Early" button
 * - Cron job (backup)
 * 
 * Requirements:
 * - Requirement 24: Paystack Instant Payment
 * - Real-time auction closure with document generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { auctionClosureService } from '@/features/auctions/services/closure.service';

/**
 * POST /api/auctions/[id]/close
 * Close an auction (idempotent - safe to call multiple times)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    
    // Authenticate user (NextAuth v5)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log(`🎯 Close auction request: ${auctionId}`);
    console.log(`   - Requested by: ${session.user.id} (${session.user.role})`);
    console.log(`   - Timestamp: ${new Date().toISOString()}`);
    
    // Close auction (idempotent - safe to call multiple times)
    const result = await auctionClosureService.closeAuction(auctionId);
    
    if (!result.success) {
      console.error(`❌ Auction closure failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error || 'Failed to close auction' },
        { status: 400 }
      );
    }
    
    console.log(`✅ Auction ${auctionId} closed successfully`);
    console.log(`   - Winner: ${result.winnerId || 'No winner'}`);
    console.log(`   - Winning Bid: ${result.winningBid ? `₦${result.winningBid.toLocaleString()}` : 'N/A'}`);
    console.log(`   - Payment ID: ${result.paymentId || 'N/A'}`);
    
    return NextResponse.json({
      success: true,
      data: {
        auctionId: result.auctionId,
        winnerId: result.winnerId,
        winningBid: result.winningBid,
        paymentId: result.paymentId,
      },
    });
  } catch (error) {
    console.error('❌ Error closing auction:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
