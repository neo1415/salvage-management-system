/**
 * GET /api/valuations/models?make={make}
 * Returns all models for specified make
 * Cached for 1 hour in Redis per make
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get make from query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make');

    // Validate required parameter
    if (!make) {
      return NextResponse.json(
        {
          error: 'Missing required parameter',
          message: 'The "make" query parameter is required',
        },
        { status: 400 }
      );
    }

    // Check cache first
    const cachedModels = await autocompleteCache.getModels(make);
    const responseTime = Date.now() - startTime;
    
    if (cachedModels) {
      // Log cache hit with performance metrics and search tracking
      console.log('[Autocomplete Analytics] Models endpoint - Cache HIT', {
        endpoint: '/api/valuations/models',
        make,
        responseTime: `${responseTime}ms`,
        cached: true,
        resultCount: cachedModels.length,
        timestamp: new Date().toISOString(),
      });
      
      // Track frequently searched makes
      console.log('[Autocomplete Analytics] Popular search - Make', {
        make,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json({
        make,
        models: cachedModels,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Query database for distinct models for the specified make
    const result = await db
      .selectDistinct({ model: vehicleValuations.model })
      .from(vehicleValuations)
      .where(eq(vehicleValuations.make, make))
      .orderBy(vehicleValuations.model);

    const models = result.map((row) => row.model);

    // Cache the results (only if non-empty to prevent caching empty state)
    if (models.length > 0) {
      await autocompleteCache.setModels(make, models);
    }

    const finalResponseTime = Date.now() - startTime;
    
    // Log cache miss with performance metrics and search tracking
    console.log('[Autocomplete Analytics] Models endpoint - Cache MISS', {
      endpoint: '/api/valuations/models',
      make,
      responseTime: `${finalResponseTime}ms`,
      cached: false,
      resultCount: models.length,
      timestamp: new Date().toISOString(),
    });
    
    // Track frequently searched makes
    console.log('[Autocomplete Analytics] Popular search - Make', {
      make,
      timestamp: new Date().toISOString(),
    });
    
    // Alert if response time exceeds threshold
    if (finalResponseTime > 500) {
      console.warn('[Autocomplete Analytics] ⚠️ SLOW RESPONSE - Models endpoint exceeded 500ms', {
        endpoint: '/api/valuations/models',
        make,
        responseTime: `${finalResponseTime}ms`,
        threshold: '500ms',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      make,
      models,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponseTime = Date.now() - startTime;
    
    // Log error with analytics
    console.error('[Autocomplete Analytics] Models endpoint - ERROR', {
      endpoint: '/api/valuations/models',
      make: request.nextUrl.searchParams.get('make'),
      responseTime: `${errorResponseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        error: 'Failed to fetch vehicle models',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
