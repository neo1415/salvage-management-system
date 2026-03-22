/**
 * GET /api/valuations/makes
 * Returns all available vehicle makes from database
 * Cached for 1 hour in Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { sql } from 'drizzle-orm';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check cache first
    const cachedMakes = await autocompleteCache.getMakes();
    const responseTime = Date.now() - startTime;
    
    if (cachedMakes) {
      // Log cache hit with performance metrics
      console.log('[Autocomplete Analytics] Makes endpoint - Cache HIT', {
        endpoint: '/api/valuations/makes',
        responseTime: `${responseTime}ms`,
        cached: true,
        resultCount: cachedMakes.length,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json({
        makes: cachedMakes,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Query database for distinct makes
    const result = await db
      .selectDistinct({ make: vehicleValuations.make })
      .from(vehicleValuations)
      .orderBy(vehicleValuations.make);

    const makes = result.map((row) => row.make);

    // Cache the results (only if non-empty to prevent caching empty state)
    if (makes.length > 0) {
      await autocompleteCache.setMakes(makes);
    }

    const finalResponseTime = Date.now() - startTime;
    
    // Log cache miss with performance metrics
    console.log('[Autocomplete Analytics] Makes endpoint - Cache MISS', {
      endpoint: '/api/valuations/makes',
      responseTime: `${finalResponseTime}ms`,
      cached: false,
      resultCount: makes.length,
      timestamp: new Date().toISOString(),
    });
    
    // Alert if response time exceeds threshold
    if (finalResponseTime > 500) {
      console.warn('[Autocomplete Analytics] ⚠️ SLOW RESPONSE - Makes endpoint exceeded 500ms', {
        endpoint: '/api/valuations/makes',
        responseTime: `${finalResponseTime}ms`,
        threshold: '500ms',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      makes,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponseTime = Date.now() - startTime;
    
    // Log error with analytics
    console.error('[Autocomplete Analytics] Makes endpoint - ERROR', {
      endpoint: '/api/valuations/makes',
      responseTime: `${errorResponseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        error: 'Failed to fetch vehicle makes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
