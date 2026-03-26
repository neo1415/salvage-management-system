import { NextResponse } from 'next/server';
import { getDojahService } from '@/features/kyc/services/dojah.service';
import { checkDatabaseConnection } from '@/lib/db/drizzle';
import { redis } from '@/lib/redis/client';

/**
 * GET /api/health/kyc
 * Health check for KYC service dependencies.
 */
export async function GET() {
  const [dbResult, redisResult, dojahResult] = await Promise.allSettled([
    checkDatabaseConnection(),
    redis.ping().then(() => true).catch(() => false),
    getDojahService().ping(),
  ]);

  const db = dbResult.status === 'fulfilled' ? dbResult.value.healthy : false;
  const redisOk = redisResult.status === 'fulfilled' ? redisResult.value : false;
  const dojah = dojahResult.status === 'fulfilled' ? dojahResult.value : false;

  const allHealthy = db && redisOk && dojah;

  return NextResponse.json(
    { status: allHealthy ? 'ok' : 'degraded', db, redis: redisOk, dojah },
    { status: allHealthy ? 200 : 503 }
  );
}
