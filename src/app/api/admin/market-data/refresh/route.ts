/**
 * Admin API: Manual Market Data Refresh
 * 
 * Allows administrators to manually trigger market data refresh for a specific property.
 * This forces re-scraping regardless of cache state.
 * 
 * Requirements: 2.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { refreshMarketPrice } from '@/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds max

/**
 * POST /api/admin/market-data/refresh
 * 
 * Manually refresh market data for a property
 * 
 * Body:
 * {
 *   "property": {
 *     "type": "vehicle",
 *     "make": "Toyota",
 *     "model": "Camry",
 *     "year": 2020
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { property } = body as { property: PropertyIdentifier };

    // Validate property
    if (!property || !property.type) {
      return NextResponse.json(
        { error: 'Invalid property - type is required' },
        { status: 400 }
      );
    }

    // Validate property type
    if (!['vehicle', 'electronics', 'building'].includes(property.type)) {
      return NextResponse.json(
        { error: 'Invalid property type - must be vehicle, electronics, or building' },
        { status: 400 }
      );
    }

    // Validate required fields based on property type
    if (property.type === 'vehicle') {
      if (!property.make || !property.model || !property.year) {
        return NextResponse.json(
          { error: 'Invalid vehicle property - make, model, and year are required' },
          { status: 400 }
        );
      }
    } else if (property.type === 'electronics') {
      if (!property.brand || !property.productModel || !property.productType) {
        return NextResponse.json(
          { error: 'Invalid electronics property - brand, productModel, and productType are required' },
          { status: 400 }
        );
      }
    } else if (property.type === 'building') {
      if (!property.location || !property.propertyType || !property.size) {
        return NextResponse.json(
          { error: 'Invalid building property - location, propertyType, and size are required' },
          { status: 400 }
        );
      }
    }

    console.log('[ADMIN] Manual refresh requested by admin:', session.user.email);
    console.log('[ADMIN] Property:', property);

    // Trigger refresh
    await refreshMarketPrice(property);

    console.log('[ADMIN] Market data refresh completed');

    return NextResponse.json({
      success: true,
      message: 'Market data refresh initiated successfully',
      property,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ADMIN] Error refreshing market data:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to refresh market data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

