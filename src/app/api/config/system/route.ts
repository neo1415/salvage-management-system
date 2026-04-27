/**
 * System Configuration API
 * 
 * Provides read-only access to system configuration for client-side use.
 * This endpoint is public (no authentication required) as configuration
 * values are not sensitive and are needed for proper UI functionality.
 * 
 * GET /api/config/system
 * Returns current system configuration values
 */

import { NextResponse } from 'next/server';
import { configService } from '@/features/auction-deposit/services/config.service';

export async function GET() {
  try {
    const config = await configService.getConfig();
    
    return NextResponse.json(
      {
        success: true,
        config: {
          minimumBidIncrement: config.minimumBidIncrement,
          depositRate: config.depositRate,
          documentValidityPeriod: config.documentValidityPeriod,
          paymentDeadlineAfterSigning: config.paymentDeadlineAfterSigning,
          graceExtensionDuration: config.graceExtensionDuration,
          fallbackBufferPeriod: config.fallbackBufferPeriod,
          maxGraceExtensions: config.maxGraceExtensions,
          forfeiturePercentage: config.forfeiturePercentage,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch system config:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
