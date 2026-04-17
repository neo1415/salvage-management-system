import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { OperationalDataRepository } from '@/features/reports/operational/repositories/operational-data.repository';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor performance data for the last 30 days
    const filters = {
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
    };

    const vendorData = await OperationalDataRepository.getVendorPerformanceData(filters) || [];

    // Calculate leaderboard entries with proper metrics
    const leaderboard = vendorData.map((vendor, index) => ({
      rank: index + 1,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      businessName: vendor.businessName || null,
      profilePictureUrl: vendor.profilePictureUrl || null,
      tier: vendor.tier,
      totalBids: vendor.totalBids,
      wins: vendor.totalWins,
      totalSpent: vendor.totalSpent || '0',
      winRate: vendor.winRate,
      participationRate: vendor.participationRate,
      onTimePickupRate: vendor.onTimePickupRate || 0,
      rating: vendor.rating || '0',
    })).slice(0, 10); // Top 10

    return NextResponse.json({
      leaderboard,
      lastUpdated: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
