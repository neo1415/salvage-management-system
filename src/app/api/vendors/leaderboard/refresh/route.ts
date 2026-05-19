import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { cache } from '@/lib/redis/client';
import { calculateLeaderboard, type LeaderboardEntry } from '@/features/vendors/services/leaderboard.service';

const LEADERBOARD_CACHE_KEY = 'leaderboard:monthly';
const LEADERBOARD_CACHE_TTL = 5 * 60;

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user || !['system_admin', 'salvage_manager'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Salvage Manager access required' },
        { status: 403 }
      );
    }

    await cache.del(LEADERBOARD_CACHE_KEY);

    const leaderboard = await calculateLeaderboard(10);
    const now = new Date();
    const response: LeaderboardResponse = {
      leaderboard,
      lastUpdated: now.toISOString(),
      nextUpdate: new Date(now.getTime() + LEADERBOARD_CACHE_TTL * 1000).toISOString(),
    };

    await cache.set(LEADERBOARD_CACHE_KEY, response, LEADERBOARD_CACHE_TTL);

    return NextResponse.json(
      {
        message: 'Leaderboard refreshed successfully',
        ...response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error refreshing leaderboard:', error);

    return NextResponse.json(
      {
        error: 'Failed to refresh leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
