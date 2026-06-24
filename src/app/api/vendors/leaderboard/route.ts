import { NextResponse } from 'next/server';
import { cache } from '@/lib/redis/client';
import { calculateLeaderboard, type LeaderboardEntry } from '@/features/vendors/services/leaderboard.service';

const LEADERBOARD_CACHE_KEY = 'leaderboard:v3';
const LEADERBOARD_CACHE_TTL = 5 * 60;

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
}

function getNextRefreshTime(): Date {
  return new Date(Date.now() + LEADERBOARD_CACHE_TTL * 1000);
}

export async function GET() {
  try {
    const cached = await cache.get<LeaderboardResponse>(LEADERBOARD_CACHE_KEY);

    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const leaderboard = await calculateLeaderboard(25);
    const now = new Date();

    const response: LeaderboardResponse = {
      leaderboard,
      lastUpdated: now.toISOString(),
      nextUpdate: getNextRefreshTime().toISOString(),
    };

    await cache.set(LEADERBOARD_CACHE_KEY, response, LEADERBOARD_CACHE_TTL);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
