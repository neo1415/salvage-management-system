/**
 * GET /api/valuations/years?make={make}&model={model}
 * Returns all years for specified make and model
 * Cached for 1 hour in Redis per make/model combination
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get make and model from query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make');
    const model = searchParams.get('model');

    // Validate required parameters
    if (!make || !model) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'Both "make" and "model" query parameters are required',
        },
        { status: 400 }
      );
    }

    // Check cache first
    const cachedYears = await autocompleteCache.getYears(make, model);
    const responseTime = Date.now() - startTime;
    
    if (cachedYears) {
      // Log cache hit with performance metrics and search tracking
      console.log('[Autocomplete Analytics] Years endpoint - Cache HIT', {
        endpoint: '/api/valuations/years',
        make,
        model,
        responseTime: `${responseTime}ms`,
        cached: true,
        resultCount: cachedYears.length,
        timestamp: new Date().toISOString(),
      });
      
      // Track frequently searched make/model combinations
      console.log('[Autocomplete Analytics] Popular search - Make/Model', {
        make,
        model,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json({
        make,
        model,
        years: cachedYears,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Query database for distinct years for the specified make and model
    const result = await db
      .selectDistinct({ year: vehicleValuations.year })
      .from(vehicleValuations)
      .where(
        and(
          eq(vehicleValuations.make, make),
          eq(vehicleValuations.model, model)
        )
      )
      .orderBy(vehicleValuations.year);

    const years = result.map((row) => row.year);

    // Cache the results (only if non-empty to prevent caching empty state)
    if (years.length > 0) {
      await autocompleteCache.setYears(make, model, years);
    }

    const finalResponseTime = Date.now() - startTime;
    
    // Log cache miss with performance metrics and search tracking
    console.log('[Autocomplete Analytics] Years endpoint - Cache MISS', {
      endpoint: '/api/valuations/years',
      make,
      model,
      responseTime: `${finalResponseTime}ms`,
      cached: false,
      resultCount: years.length,
      timestamp: new Date().toISOString(),
    });
    
    // Track frequently searched make/model combinations
    console.log('[Autocomplete Analytics] Popular search - Make/Model', {
      make,
      model,
      timestamp: new Date().toISOString(),
    });
    
    // Alert if response time exceeds threshold
    if (finalResponseTime > 500) {
      console.warn('[Autocomplete Analytics] ⚠️ SLOW RESPONSE - Years endpoint exceeded 500ms', {
        endpoint: '/api/valuations/years',
        make,
        model,
        responseTime: `${finalResponseTime}ms`,
        threshold: '500ms',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      make,
      model,
      years,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorResponseTime = Date.now() - startTime;
    
    // Log error with analytics
    console.error('[Autocomplete Analytics] Years endpoint - ERROR', {
      endpoint: '/api/valuations/years',
      make: request.nextUrl.searchParams.get('make'),
      model: request.nextUrl.searchParams.get('model'),
      responseTime: `${errorResponseTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        error: 'Failed to fetch vehicle years',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
