/**
 * Location Autocomplete API
 * 
 * Provides autocomplete suggestions for location search based on existing locations in database.
 * Requirements: 9.2, 9.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { salvageCases } from '@/lib/db/schema/cases';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Return empty array if query is too short
    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: { locations: [] },
      });
    }

    // Query distinct locations that match the query (case-insensitive partial match)
    const locations = await db
      .selectDistinct({ locationName: salvageCases.locationName })
      .from(salvageCases)
      .where(sql`LOWER(${salvageCases.locationName}) LIKE LOWER(${`%${query}%`})`)
      .limit(10)
      .execute();

    // Extract location names and sort alphabetically
    const locationNames = locations
      .map((loc) => loc.locationName)
      .filter((name): name is string => name !== null)
      .sort();

    return NextResponse.json({
      success: true,
      data: { locations: locationNames },
    });
  } catch (error) {
    console.error('Error fetching location autocomplete:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch location suggestions',
      },
      { status: 500 }
    );
  }
}
