/**
 * Location Autocomplete API
 *
 * Suggests location names from past cases; includes stored GPS when available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: { locations: [], suggestions: [] },
      });
    }

    const pattern = `%${query}%`;

    const rows = await db.execute(sql`
      SELECT DISTINCT ON (LOWER(sc.location_name))
        sc.location_name,
        (sc.gps_location)[1] AS latitude,
        (sc.gps_location)[0] AS longitude
      FROM salvage_cases sc
      WHERE LOWER(sc.location_name) LIKE LOWER(${pattern})
        AND sc.location_name IS NOT NULL
      ORDER BY LOWER(sc.location_name), sc.created_at DESC
      LIMIT 10
    `);

    const resultRows = (Array.isArray(rows) ? rows : []) as Array<{
      location_name: string;
      latitude: number | null;
      longitude: number | null;
    }>;

    const suggestions = resultRows
      .filter((row) => row.location_name)
      .map((row) => ({
        name: row.location_name,
        latitude: row.latitude != null ? Number(row.latitude) : undefined,
        longitude: row.longitude != null ? Number(row.longitude) : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const locations = suggestions.map((s) => s.name);

    return NextResponse.json({
      success: true,
      data: { locations, suggestions },
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
